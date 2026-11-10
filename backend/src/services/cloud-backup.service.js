'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { setInterval, clearInterval, setImmediate } = require('node:timers')
const BaseService = require('../core/base/base.service')
const backupService = require('./backup.service')
const CloudBackupRepository = require('../repositories/cloud-backup.repository')
const { encryptConfigSecret, decryptConfigSecret } = require('../utils/config-secret-crypto')
const { AliyunDriveClient, CloudUploadError } = require('./aliyun-drive-client')
const log = require('../utils/log')

const ACTIVE = new Set(['queued', 'uploading', 'retrying'])
const MAX_ATTEMPTS = 5
const HOUR = 60 * 60_000
const POLICY_RETRY = 5 * 60_000
const REMOTE_CHECK_INTERVAL = 60_000
const INVALID_FILE_MESSAGE = '该文件云端已删除，可重新上传！'

function isInvalidTask(task) {
  return task.status === 'invalid' || task.status === 'failed'
    && /^云端文件已(?:移入回收站|彻底删除)/.test(task.error || '')
}

function parseRefreshToken(value) {
  if (typeof value !== 'string' || value.length > 32_768) throw new Error('Token 格式无效')
  let token = value.trim()
  if (token.startsWith('{')) {
    try { token = JSON.parse(token).refresh_token } catch { throw new Error('Token JSON 格式无效') }
  }
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~-]{16,8192}$/.test(token)) {
    throw new Error('请填写 refresh_token 或包含 refresh_token 的完整 Token JSON')
  }
  return token
}

class CloudBackupService extends BaseService {
  constructor({ backup = backupService, repository, clientFactory, now = Date.now, logger = log } = {}) {
    super()
    this.backup = backup
    this.repository = repository || new CloudBackupRepository(path.join(backup.getBackupDir(), '.cloud'))
    this.clientFactory = clientFactory || (options => new AliyunDriveClient(options))
    this.now = now
    this.logger = logger
    this.running = false
    this.clientActions = new Set()
    this.lastError = ''
    this.backup.canDeleteBackup = filename => !this.isProtected(filename)
  }

  account(state, accountId = state.config.accountId) {
    if (typeof accountId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) {
      throw this.createError('请选择云盘账户', 400)
    }
    const account = state.accounts.find(item => item.id === accountId)
    if (!account) throw this.createError('云盘账户不存在，请重新选择', 404)
    return account
  }

  publicAccount(account) {
    return { id: account.id, name: account.name, hasToken: Boolean(account.token),
      driveId: account.driveId || '', driveName: account.driveName || '', folderId: account.folderId || '', folderName: account.folderName || '' }
  }

  getAccounts() {
    const state = this.repository.read()
    return { accountId: state.config.accountId, accounts: state.accounts.map(account => this.publicAccount(account)) }
  }

  getSettings() {
    const state = this.repository.read()
    const account = state.accounts.find(item => item.id === state.config.accountId)
    return {
      ...this.getAccounts(), enabled: state.config.enabled === true, hasToken: Boolean(account?.token),
      driveId: account?.driveId || '', folderId: account?.folderId || '', folderName: account?.folderName || '',
      schedule: this.getSchedule(state), retention: this.getRetention(state), lastError: this.lastError
    }
  }

  getSchedule(state) {
    return { enabled: false, intervalHours: 24, type: 'full', nextRunAt: null,
      lastRunAt: null, lastStatus: 'idle', lastError: '', lastFilename: '', ...state.schedule }
  }

  getRetention(state) {
    return { enabled: false, sqlCount: 10, zipCount: 10, lastRunAt: null, lastDeleted: 0, lastError: '', ...state.retention }
  }

  updatePolicies(state, input) {
    if (input.schedule !== undefined) {
      const value = input.schedule
      if (!value || typeof value.enabled !== 'boolean' || !Number.isInteger(value.intervalHours)
        || value.intervalHours < 1 || value.intervalHours > 720 || !['full', 'database'].includes(value.type)) {
        throw this.createError('定时备份间隔须为 1–720 小时，类型请选择 SQL 或完整 ZIP', 400)
      }
      const previous = this.getSchedule(state)
      const changed = previous.enabled !== value.enabled || previous.intervalHours !== value.intervalHours || previous.type !== value.type
      state.schedule = { ...previous, enabled: value.enabled, intervalHours: value.intervalHours, type: value.type,
        nextRunAt: changed ? value.enabled ? new Date(this.now() + value.intervalHours * HOUR).toISOString() : null : previous.nextRunAt }
    }
    if (input.retention !== undefined) {
      const value = input.retention
      if (!value || typeof value.enabled !== 'boolean' || !Number.isInteger(value.sqlCount) || !Number.isInteger(value.zipCount)
        || value.sqlCount < 1 || value.sqlCount > 1000 || value.zipCount < 1 || value.zipCount > 1000) {
        throw this.createError('本地 SQL 和 ZIP 保留数量须分别为 1–1000 份', 400)
      }
      state.retention = { ...this.getRetention(state), enabled: value.enabled, sqlCount: value.sqlCount, zipCount: value.zipCount }
    }
  }

  saveAccount(input, accountId) {
    const name = typeof input?.name === 'string' ? input.name.trim() : ''
    if (!name || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name)) throw this.createError('账户名称须为 1–50 个字符', 400)
    if (input.token !== undefined && typeof input.token !== 'string') throw this.createError('Token 格式无效', 400)
    const release = this.repository.acquireLock()
    if (!release) throw this.createError('云盘正在使用，请稍后保存账户', 409)
    let id
    try {
      const state = this.repository.read()
      const previous = accountId ? this.account(state, accountId) : null
      if (state.accounts.some(item => item.id !== accountId && item.name === name)) throw this.createError('账户名称已存在', 409)
      let token = previous?.token
      if (input.token) {
        try { token = encryptConfigSecret(parseRefreshToken(input.token)) }
        catch (error) { throw this.createError(error.message, 400) }
      }
      if (!token) throw this.createError('请填写云盘 Token', 400)
      const changed = previous && token !== previous.token
      if (changed && state.tasks.some(task => task.accountId === accountId && ACTIVE.has(task.status))) {
        throw this.createError('该账户还有待上传任务，请完成后再更换 Token', 409)
      }
      const account = { ...previous, id: previous?.id || crypto.randomUUID(), name, token,
        revision: changed || !previous ? crypto.randomUUID() : previous.revision,
        deviceId: previous?.deviceId || crypto.randomUUID(),
        deviceKey: previous?.deviceKey || encryptConfigSecret(crypto.randomBytes(32).toString('hex')),
        // 新授权可能属于另一个网盘，不沿用原目录。
        ...(changed ? { driveId: '', driveName: '', folderId: '', folderName: '' } : {}) }
      if (previous) state.accounts[state.accounts.indexOf(previous)] = account
      else state.accounts.push(account)
      if (changed && state.config.accountId === account.id) state.config.enabled = false
      this.repository.write(state)
      id = account.id
    } finally { release() }
    return this.publicAccount(this.account(this.repository.read(), id))
  }

  saveSettings(input) {
    if (!input || typeof input.enabled !== 'boolean') throw this.createError('请指定是否自动上传', 400)
    const release = this.repository.acquireLock()
    if (!release) throw this.createError('上传任务正在执行，请稍后修改云盘配置', 409)
    try {
      const state = this.repository.read()
      this.updatePolicies(state, input)
      const account = this.account(state, input.accountId)
      if (!input.enabled) {
        for (const task of state.tasks) {
          if (task.automatic && ACTIVE.has(task.status)) Object.assign(task, {
            status: 'failed', error: '已关闭自动上传，可手动重新上传', updatedAt: new Date(this.now()).toISOString()
          })
        }
      }
      const folderId = typeof input.folderId === 'string' ? input.folderId.trim() : ''
      const driveId = typeof input.driveId === 'string' ? input.driveId.trim() : ''
      if ((folderId ? !/^[A-Za-z0-9_-]{1,128}$/.test(folderId) : input.enabled)
        || (driveId && !/^[A-Za-z0-9_-]{1,128}$/.test(driveId))) {
        throw this.createError('请选择有效的云盘备份目录', 400)
      }
      if (!account.token) throw this.createError('请先配置云盘 Token', 400)
      const changed = folderId !== (account.folderId || '') || driveId !== (account.driveId || '')
      if ((changed || state.config.accountId !== account.id) && state.tasks.some(task => ACTIVE.has(task.status))) {
        throw this.createError('还有待上传任务，请等待任务完成后再更换账户或目录', 409)
      }
      Object.assign(account, { folderId, driveId,
        driveName: typeof input.driveName === 'string' ? input.driveName.trim().slice(0, 100)
          : driveId === account.driveId ? account.driveName || '' : '',
        folderName: typeof input.folderName === 'string' ? input.folderName.trim().slice(0, 1024)
          : changed ? '' : account.folderName || '',
        revision: changed ? crypto.randomUUID() : account.revision })
      state.config = { enabled: input.enabled, accountId: account.id }
      this.repository.write(state)
      this.lastError = ''
    } finally { release() }
    return this.getSettings()
  }

  makeClient(account) {
    this.clients ||= new Map()
    const key = `${account.id}:${account.revision}`
    const cached = this.clients.get(key)
    if (cached) {
      if (cached.config) cached.config.refreshToken = decryptConfigSecret(account.token)
      return cached
    }
    const client = this.clientFactory({
      config: {
        refreshToken: decryptConfigSecret(account.token), deviceKey: decryptConfigSecret(account.deviceKey),
        deviceId: account.deviceId, driveId: account.driveId, folderId: account.folderId
      },
      persistToken: value => {
        const state = this.repository.read()
        const current = this.account(state, account.id)
        if (current.revision !== account.revision) throw new CloudUploadError('云盘账户配置已变更，请重新连接')
        current.token = encryptConfigSecret(value)
        this.repository.write(state)
      }
    })
    // 每个账户只保留当前目标的授权实例。
    for (const oldKey of this.clients.keys()) if (oldKey.startsWith(`${account.id}:`)) this.clients.delete(oldKey)
    this.clients.set(key, client)
    return client
  }

  async withClient(action, exclusive = false, accountId) {
    const account = this.account(this.repository.read(), accountId)
    if (exclusive && this.running) throw this.createError('后台正在上传，请等待上传完成后删除或恢复云盘文件', 409)
    if (this.running && this.activeClient && this.activeAccountId === account.id) {
      // 新建和改名保留资源 ID，可与上传共用授权；工作锁须覆盖这些在途请求。
      const client = this.activeClient
      const pending = Promise.resolve().then(() => action(client, account.id))
      this.clientActions.add(pending)
      try { return await pending }
      finally { this.clientActions.delete(pending) }
    }
    const release = this.repository.acquireLock()
    if (!release) throw this.createError('云盘正在连接或由其他进程使用，请稍后重试', 409)
    try {
      return await action(this.makeClient(this.account(this.repository.read(), account.id)), account.id)
    } finally { release() }
  }

  async connect(input = {}) {
    return this.withClient(async (client, accountId) => {
      const connection = await client.drives()
      const account = this.account(this.repository.read(), accountId)
      const drive = connection.drives.find(item => item.id === (account.driveId || connection.defaultDriveId))
      let directory = null
      let directoryError = ''
      if (account.folderId) {
        try {
          directory = { ...await client.directory(account.driveId || connection.defaultDriveId, account.folderId),
            driveName: drive?.name || account.driveName || '' }
        } catch {
          // 目录失效不能阻止浏览云盘、重新选择目标，也不回传第三方错误或凭据。
          directoryError = '读取备份目录失败，当前显示上次保存的名称，请重试或重新选择目录'
        }
      }
      // 云端请求可能轮换 Token 或推进上传；重新读取，只合并同一目标的展示名称。
      const state = this.repository.read()
      const current = this.account(state, accountId)
      if (current.revision !== account.revision || current.driveId !== account.driveId || current.folderId !== account.folderId) {
        throw this.createError('云盘目录配置已变更，请重新连接', 409)
      }
      if (directory && (current.folderName !== directory.folderName || current.driveName !== directory.driveName)) {
        Object.assign(current, { folderName: directory.folderName, driveName: directory.driveName })
        this.repository.write(state)
      }
      return { ...connection, accountId, directory, directoryError, settings: this.getSettings() }
    }, false, input.accountId)
  }

  validateCloudId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      throw this.createError(`${label}格式无效`, 400)
    }
    return value
  }

  async browse(input) {
    const driveId = this.validateCloudId(input.driveId, '云盘 ID')
    const folderId = this.validateCloudId(input.folderId || 'root', '文件夹 ID')
    const marker = input.marker || ''
    if (typeof marker !== 'string' || marker.length > 8192) throw this.createError('分页标记无效', 400)
    if (input.trash !== undefined && !['true', 'false'].includes(input.trash)) throw this.createError('列表类型无效', 400)
    return this.withClient(client => client.files({ driveId, folderId, marker, trash: input.trash === 'true' }), false, input.accountId)
  }

  validateCloudName(value) {
    const name = typeof value === 'string' ? value.trim() : ''
    if (!name || name.length > 255 || ['.', '..'].includes(name) || /[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name)) {
      throw this.createError('名称须为 1–255 个字符，不能包含路径分隔符或特殊字符 \\ / : * ? " < > |', 400)
    }
    return name
  }

  validateFileId(fileId) {
    this.validateCloudId(fileId, '文件 ID')
    if (fileId === 'root') throw this.createError('不能修改或删除云盘根目录', 400)
  }

  async createFolder(input) {
    const driveId = this.validateCloudId(input?.driveId, '云盘 ID')
    const folderId = this.validateCloudId(input?.folderId, '文件夹 ID')
    const name = this.validateCloudName(input?.name)
    return this.withClient(client => client.createFolder(driveId, folderId, name), false, input.accountId)
  }

  async renameFile(driveId, fileId, input) {
    this.validateCloudId(driveId, '云盘 ID')
    this.validateFileId(fileId)
    const name = this.validateCloudName(input?.name)
    return this.withClient(async (client, accountId) => {
      await client.renameFile(driveId, fileId, name)
      const state = this.repository.read()
      const account = this.account(state, accountId)
      if (account.folderId === fileId && (!account.driveId || account.driveId === driveId)) {
        account.folderName = name
        this.repository.write(state)
      }
    }, false, input.accountId)
  }

  async trashFile(driveId, fileId, requestedAccountId) {
    this.validateCloudId(driveId, '云盘 ID')
    this.validateFileId(fileId)
    return this.withClient(async (client, accountId) => {
      const file = await client.file(driveId, fileId, { allowTrashed: true })
      const before = this.repository.read()
      const account = this.account(before, accountId)
      if (file.type === 'folder' && !file.trashed) {
        const targetDriveId = account.driveId || (await client.drives()).defaultDriveId
        if (account.folderId && targetDriveId === driveId
          && await client.containsFolder(driveId, account.folderId, fileId)) {
          throw this.createError('此文件夹是当前备份目录或其父目录，请先更换备份目录后再删除', 409)
        }
      }
      const affected = await this.affectedTasks(client, before, accountId, driveId, fileId, file)
      await client.trashFile(driveId, fileId)
      // 云端操作可能轮换 Token，写任务状态前重新读取，避免覆盖新授权。
      const state = this.repository.read()
      for (const task of state.tasks) {
        if (affected.has(task.id)) {
          Object.assign(task, { status: 'invalid', error: INVALID_FILE_MESSAGE,
            progress: 0, session: null, remoteCheckedAt: null, updatedAt: new Date(this.now()).toISOString() })
        }
      }
      this.repository.write(state)
    }, true, requestedAccountId)
  }

  async affectedTasks(client, state, accountId, driveId, fileId, file) {
    const affected = new Set()
    for (const task of state.tasks) {
      if (task.accountId !== accountId || task.remote?.driveId !== driveId) continue
      if (task.remote.fileId === fileId) { affected.add(task.id); continue }
      if (file.type !== 'folder' || !task.remote.folderId) continue
      try {
        if (await client.containsFolder(driveId, task.remote.folderId, fileId, { allowTrashed: true })) affected.add(task.id)
      } catch (error) {
        // 无关历史目录可能已被其他客户端删除；无法确认归属的任务不修改。
        if (error.statusCode !== 404) throw error
      }
    }
    return affected
  }

  async restoreFile(driveId, fileId, accountId) {
    this.validateCloudId(driveId, '云盘 ID')
    this.validateFileId(fileId)
    return this.withClient(async (client, id) => {
      const file = await client.restoreFile(driveId, fileId)
      const affected = await this.affectedTasks(client, this.repository.read(), id, driveId, fileId, file)
      const verified = new Set()
      for (const task of this.repository.read().tasks) {
        if (!affected.has(task.id) || !isInvalidTask(task)) continue
        // 目录恢复时逐份核对文件；不能把仍缺失或大小变化的历史备份标为成功。
        try {
          const remote = task.remote.fileId === fileId ? file : await client.file(driveId, task.remote.fileId)
          if (!remote.trashed && remote.type === 'file' && Number(remote.size) === task.size) verified.add(task.id)
        } catch (error) { if (error.statusCode !== 404 && error.statusCode !== 409) throw error }
      }
      const state = this.repository.read()
      for (const task of state.tasks) if (verified.has(task.id)) Object.assign(task, {
        status: 'success', progress: 100, error: '', session: null, remoteCheckedAt: null, updatedAt: new Date(this.now()).toISOString()
      })
      this.repository.write(state)
    }, true, accountId)
  }

  async purgeFile(driveId, fileId, accountId) {
    this.validateCloudId(driveId, '云盘 ID')
    this.validateFileId(fileId)
    return this.withClient(async (client, id) => {
      const file = await client.file(driveId, fileId, { allowTrashed: true })
      if (!file.trashed) throw this.createError('仅能彻底删除回收站中的文件或文件夹', 409)
      const affected = await this.affectedTasks(client, this.repository.read(), id, driveId, fileId, file)
      await client.purgeFile(driveId, fileId)
      const state = this.repository.read()
      for (const task of state.tasks) if (affected.has(task.id)) Object.assign(task, {
        status: 'invalid', progress: 0, error: INVALID_FILE_MESSAGE, session: null, remoteCheckedAt: null,
        updatedAt: new Date(this.now()).toISOString()
      })
      this.repository.write(state)
    }, true, accountId)
  }

  async testConnection() {
    const release = this.repository.acquireLock()
    if (!release) throw this.createError('上传任务正在执行，请稍后测试连接', 409)
    try {
      const config = this.account(this.repository.read())
      if (!config.token) throw this.createError('请先保存云盘配置', 400)
      return await this.makeClient(config).target()
    } finally { release() }
  }

  getTasks() {
    const state = this.repository.read()
    const account = state.accounts.find(item => item.id === state.config.accountId)
    return state.tasks.filter(task => task.accountId === account?.id && task.revision === account?.revision).reverse().map(task => ({
      id: task.id, accountId: task.accountId, filename: task.filename, status: isInvalidTask(task) ? 'invalid' : task.status, progress: task.progress,
      attempts: task.attempts, size: task.size, error: task.status === 'failed' && isInvalidTask(task) ? INVALID_FILE_MESSAGE : task.error,
      folderId: task.folderId, createdAt: task.createdAt, updatedAt: task.updatedAt
    }))
  }

  async refreshRemoteTasks() {
    const state = this.repository.read()
    const account = state.accounts.find(item => item.id === state.config.accountId)
    if (!account?.token) return
    const candidates = state.tasks.filter(task => task.accountId === account.id && task.revision === account.revision
      && task.remote?.fileId && task.remote.driveId && (task.status === 'success' || isInvalidTask(task))
      && (!task.remoteCheckedAt || this.now() - Date.parse(task.remoteCheckedAt) >= REMOTE_CHECK_INTERVAL))
      .sort((a, b) => (Date.parse(a.remoteCheckedAt) || 0) - (Date.parse(b.remoteCheckedAt) || 0)).slice(0, 20)
    if (!candidates.length) return
    try {
      await this.withClient(async client => {
        for (const snapshot of candidates) {
          let missing = false, remote
          try { remote = await client.file(snapshot.remote.driveId, snapshot.remote.fileId, { allowTrashed: true }) }
          catch (error) {
            // 只有明确的文件不存在才视为已删除；网络、授权、处理中等错误保留原状态。
            if (error.statusCode === 404) missing = true
            else throw error
          }
          const current = this.repository.read()
          const currentAccount = current.accounts.find(item => item.id === account.id)
          const task = current.tasks.find(item => item.id === snapshot.id)
          if (current.config.accountId !== account.id || currentAccount?.revision !== account.revision) return
          if (!task || task.status !== snapshot.status || task.updatedAt !== snapshot.updatedAt
            || task.remote?.fileId !== snapshot.remote.fileId || task.remote?.driveId !== snapshot.remote.driveId) continue
          let status = task.status, error = task.error
          if (missing || remote?.trashed) { status = 'invalid'; error = INVALID_FILE_MESSAGE }
          else if (remote?.type === 'file' && Number.isFinite(remote.size) && remote.size === task.size) { status = 'success'; error = '' }
          // 大小不符不恢复为成功，也不能宣称文件已删除。
          else if (remote?.type === 'file' && Number.isFinite(remote.size) && remote.size !== task.size) {
            status = 'invalid'; error = '云端文件与备份记录不一致，请核对后重新上传'
          }
          const changed = status !== task.status || error !== task.error
          Object.assign(task, { status, error, remoteCheckedAt: new Date(this.now()).toISOString(),
            ...(changed ? { progress: status === 'success' ? 100 : 0, session: null, updatedAt: new Date(this.now()).toISOString() } : {}) })
          this.repository.write(current)
        }
      }, false, account.id)
    } catch (error) {
      if (error.statusCode !== 409) this.logger.warn('[CloudBackup] 暂时无法核验云端备份状态')
    }
  }

  requestStatusRefresh() {
    if (this.statusRefresh || this.statusRefreshAt !== undefined && this.now() - this.statusRefreshAt < REMOTE_CHECK_INTERVAL) return
    this.statusRefreshAt = this.now()
    this.statusRefresh = this.refreshRemoteTasks().catch(() => {
      this.logger.warn('[CloudBackup] 云端备份状态核验未完成')
    }).finally(() => { this.statusRefresh = null })
  }

  backupInfo(filename) {
    const segments = typeof filename === 'string' ? filename.split('/') : []
    if (!segments.length || filename.length > 4096 || segments.some(segment => !segment || segment.length > 255
      || segment.startsWith('.') || /[\\\u0000-\u001f\u007f]/.test(segment)
      || /(?:\.(?:tmp|temp|part|partial|crdownload|lock|swp)|~)$/i.test(segment)
      || /^(?:tmp|temp|backup_\d{8}_\d{6})$/.test(segment))) {
      throw this.createError('仅支持 backups 目录中已完成的普通文件', 400)
    }
    let filePath = this.backup.getBackupDir()
    for (const segment of segments) {
      filePath = path.join(filePath, segment)
      if (fs.lstatSync(filePath).isSymbolicLink()) throw this.createError('备份文件无效或尚未完成', 400)
    }
    const stat = fs.lstatSync(filePath)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1) throw this.createError('备份文件无效或尚未完成', 400)
    // 校验生成结束标记，防止 ZIP/SQL 半成品进入上传队列。
    const length = Math.min(stat.size, 65_557)
    const tail = Buffer.alloc(length)
    const fd = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
    try { fs.readSync(fd, tail, 0, length, stat.size - length) } finally { fs.closeSync(fd) }
    const isGeneratedBackup = this.backup.isValidBackupFilename(filename)
    let complete = !isGeneratedBackup || filename.endsWith('.sql') && /(?:-- TF2025 database backup complete|-- Dump completed on [^\r\n]+|SET FOREIGN_KEY_CHECKS\s*=\s*1;)\s*$/.test(tail.toString('utf8'))
    for (let offset = filename.endsWith('.zip') ? tail.length - 22 : -1; offset >= 0; offset--) {
      if (tail.readUInt32LE(offset) === 0x06054b50 && offset + 22 + tail.readUInt16LE(offset + 20) === tail.length) {
        complete = true
        break
      }
    }
    if (!complete) throw this.createError('备份文件尚未完成，请等待生成或复制结束', 400)
    return { filePath, size: stat.size, fingerprint: `${stat.size}:${stat.mtimeMs}` }
  }

  scanFiles(directory = this.backup.getBackupDir(), prefix = '') {
    const files = []
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || /^(?:tmp|temp|backup_\d{8}_\d{6})$/.test(entry.name)
        || /(?:\.(?:tmp|temp|part|partial|crdownload|lock|swp)|~)$/i.test(entry.name)) continue
      const filename = prefix + entry.name
      if (entry.isFile()) files.push(filename)
      else if (entry.isDirectory()) files.push(...this.scanFiles(path.join(directory, entry.name), `${filename}/`))
    }
    return files
  }

  async uploadDirectory(client, filename, session) {
    if (!filename.includes('/')) return undefined
    const target = await client.target()
    if (session?.folderId) return client.directory(target.driveId, session.folderId)
    let folderId = target.folderId
    for (const name of filename.split('/').slice(0, -1)) {
      let marker = '', found
      do {
        const page = await client.files({ driveId: target.driveId, folderId, marker, trash: false })
        found = page.items.find(item => item.name === name)
        marker = page.nextMarker
      } while (!found && marker)
      if (found && found.type !== 'folder') throw new CloudUploadError('备份子目录与云端同名文件冲突，请调整云端目录')
      folderId = found?.id || (await client.createFolder(target.driveId, folderId, name)).folderId
    }
    return { ...target, folderId }
  }

  enqueue(filename, automatic = false) {
    const state = this.repository.read()
    const account = this.account(state)
    if (!account.token || !account.folderId) throw this.createError('请先保存云盘配置', 400)
    const info = this.backupInfo(filename)
    let task = state.tasks.find(item => item.filename === filename && item.fingerprint === info.fingerprint
      && item.accountId === account.id && item.revision === account.revision)
    if (task && (task.status === 'success' || ACTIVE.has(task.status))) return task
    if (!task) {
      task = {
        id: crypto.randomUUID(), filename, fingerprint: info.fingerprint, size: info.size,
        accountId: account.id, revision: account.revision, folderId: account.folderId,
        createdAt: new Date(this.now()).toISOString()
      }
      state.tasks.push(task)
    }
    Object.assign(task, { status: 'queued', progress: task.session ? task.progress : 0, attempts: 0,
      automatic, error: '', nextAttempt: 0, updatedAt: new Date(this.now()).toISOString() })
    this.repository.write(state)
    return task
  }

  upload(filename) {
    // 同一进程内的原子状态写入可在云端 I/O 等待时追加任务；其他进程仍受工作锁保护。
    const release = this.running ? () => {} : this.repository.acquireLock()
    if (!release) throw this.createError('后台正在上传，请稍后再添加任务', 409)
    let id
    try { id = this.enqueue(filename).id } finally { release() }
    this.kick()
    return this.getTasks().find(task => task.id === id)
  }

  updateTask(id, updates) {
    const state = this.repository.read()
    const task = state.tasks.find(item => item.id === id)
    if (!task) throw new Error('云盘上传任务不存在')
    Object.assign(task, updates, { updatedAt: new Date(this.now()).toISOString() })
    this.repository.write(state)
  }

  isProtected(filename) {
    return this.repository.read().tasks.some(task => task.filename === filename && ACTIVE.has(task.status))
  }

  async runScheduledBackup() {
    let state = this.repository.read()
    const schedule = this.getSchedule(state)
    if (!schedule.enabled) return
    if (schedule.lastStatus === 'running') {
      state.schedule = { ...schedule, lastStatus: 'failed', lastError: '上次定时备份因后端重启中断，5 分钟后重试',
        nextRunAt: new Date(this.now() + POLICY_RETRY).toISOString() }
      this.repository.write(state)
      return
    }
    if (!schedule.nextRunAt || Date.parse(schedule.nextRunAt) > this.now() || this.backup.creatingBackup) return
    state.schedule = { ...schedule, lastRunAt: new Date(this.now()).toISOString(), lastStatus: 'running', lastError: '',
      nextRunAt: new Date(this.now() + schedule.intervalHours * HOUR).toISOString() }
    this.repository.write(state)
    try {
      const result = await this.backup.createBackup(schedule.type)
      state = this.repository.read()
      state.schedule = { ...state.schedule, lastStatus: 'success', lastFilename: result.filename, lastError: '',
        nextRunAt: new Date(this.now() + schedule.intervalHours * HOUR).toISOString() }
      this.repository.write(state)
    } catch {
      state = this.repository.read()
      state.schedule = { ...state.schedule, lastStatus: 'failed',
        lastError: '定时备份失败，请检查数据库配置、备份目录权限及磁盘空间；5 分钟后重试',
        nextRunAt: new Date(this.now() + POLICY_RETRY).toISOString() }
      this.repository.write(state)
      this.logger.error('[CloudBackup] 定时生成备份失败')
    }
  }

  cleanLocalBackups() {
    const state = this.repository.read()
    const retention = this.getRetention(state)
    if (!retention.enabled || this.backup.creatingBackup) return
    // 清理失败退避；成功后同样每 5 分钟检查，避免每次云盘浏览都扫描磁盘。
    if (retention.lastRunAt && this.now() - Date.parse(retention.lastRunAt) < POLICY_RETRY) return
    let deleted = 0, failed = false
    try {
      const files = []
      for (const file of this.backup.getBackupList()) {
        if (!this.backup.isValidBackupFilename(file.filename)) continue
        try { files.push({ ...file, info: this.backupInfo(file.filename) }) }
        catch (error) { if (error.statusCode !== 400 && error.code !== 'ENOENT') failed = true }
      }
      for (const [extension, keep] of [['.sql', retention.sqlCount], ['.zip', retention.zipCount]]) {
        const group = files.filter(file => file.filename.endsWith(extension))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.filename.localeCompare(a.filename))
        for (const file of group.slice(keep)) {
          try {
            if (this.isProtected(file.filename)) continue
            const info = this.backupInfo(file.filename)
            if (info.fingerprint !== file.info.fingerprint) continue
            if (state.config.enabled) {
              const account = this.account(state)
              const uploaded = state.tasks.some(task => task.filename === file.filename && task.fingerprint === info.fingerprint
                && task.accountId === account.id && task.revision === account.revision && task.status === 'success')
              if (!uploaded) continue
            }
            this.backup.deleteBackup(file.filename)
            deleted++
          } catch { failed = true }
        }
      }
    } catch { failed = true }
    const current = this.repository.read()
    current.retention = { ...retention, lastRunAt: new Date(this.now()).toISOString(), lastDeleted: deleted,
      lastError: failed ? '部分本地旧备份清理失败，请检查目录权限及文件状态；5 分钟后重试' : '' }
    this.repository.write(current)
    if (failed) this.logger.warn('[CloudBackup] 部分本地旧备份清理失败')
  }

  async tick() {
    if (this.running) return
    let release
    try {
      release = this.repository.acquireLock()
      if (!release) return
      this.running = true
      await this.runScheduledBackup()
      let state = this.repository.read()
      const account = state.accounts.find(item => item.id === state.config.accountId)
      if (state.config.enabled && account?.token && account.folderId) {
        const filenames = this.scanFiles()
        this.observedFiles ||= new Map()
        for (const name of this.observedFiles.keys()) if (!filenames.includes(name)) this.observedFiles.delete(name)
        for (const filename of filenames) {
          try {
            const info = this.backupInfo(filename)
            if (!this.backup.isValidBackupFilename(filename)) {
              const observed = this.observedFiles.get(filename)
              if (!observed || observed.fingerprint !== info.fingerprint) {
                this.observedFiles.set(filename, { fingerprint: info.fingerprint, at: this.now() })
                continue
              }
              if (this.now() - observed.at < 60_000) continue
            }
            // 失败任务按重试策略处理，不能每次扫描把失败次数清零。
            const known = this.repository.read().tasks.some(task => task.filename === filename
              && task.fingerprint === info.fingerprint && task.accountId === account.id && task.revision === account.revision)
            if (!known) this.enqueue(filename, true)
          } catch (error) {
            if (error.statusCode !== 400 && error.code !== 'ENOENT') throw error
          }
        }
      }
      state = this.repository.read()
      for (const task of state.tasks) {
        if (!ACTIVE.has(task.status) || (task.automatic && !state.config.enabled) || task.nextAttempt > this.now()) continue
        if (task.accountId !== account?.id || task.revision !== account?.revision) {
          this.updateTask(task.id, { status: 'failed', error: '云盘目录已改变，请重新上传' })
          continue
        }
        this.updateTask(task.id, { status: 'uploading', attempts: task.attempts + 1, error: '' })
        try {
          const info = this.backupInfo(task.filename)
          if (info.fingerprint !== task.fingerprint) throw new CloudUploadError('本地备份文件已改变，请重新上传')
          const client = this.makeClient(this.account(this.repository.read(), task.accountId))
          this.activeClient = client
          this.activeAccountId = task.accountId
          const directory = await this.uploadDirectory(client, task.filename, task.session)
          const result = await client.upload({
            filename: path.basename(task.filename), directory, filePath: info.filePath, size: info.size, session: task.session,
            checkpoint: session => this.updateTask(task.id, { session }),
            progress: progress => this.updateTask(task.id, { progress })
          })
          if (this.backupInfo(task.filename).fingerprint !== task.fingerprint) {
            throw new CloudUploadError('上传期间本地文件发生变化，请重新上传')
          }
          this.updateTask(task.id, { status: 'success', progress: 100, remote: result, session: null })
        } catch (error) {
          const retry = error.retryable === true && task.attempts + 1 < MAX_ATTEMPTS
          this.updateTask(task.id, {
            status: retry ? 'retrying' : 'failed',
            ...(error.uploadSessionExpired ? { session: null, progress: 0 } : {}),
            error: error instanceof CloudUploadError ? error.message : '上传失败，请检查本地备份文件及云盘配置',
            nextAttempt: this.now() + Math.min(30 * 60_000, 60_000 * 2 ** task.attempts)
          })
          this.logger.warn('[CloudBackup] 上传任务未完成', { filename: task.filename, retry })
        } finally {
          this.activeClient = null
          this.activeAccountId = null
          await Promise.allSettled([...this.clientActions])
        }
      }
      this.cleanLocalBackups()
      this.lastError = ''
    } catch {
      this.lastError = '云盘备份任务运行失败，请检查状态目录权限及后端配置密钥'
      this.logger.error('[CloudBackup] 状态读取或任务调度失败')
    } finally {
      this.running = false
      release?.()
    }
  }

  kick() { setImmediate(() => { void this.tick().then(() => { this.requestStatusRefresh() }) }) }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => { void this.tick().then(() => { this.requestStatusRefresh() }) }, 60_000)
    this.timer.unref()
    this.kick()
  }

  stop() { clearInterval(this.timer); this.timer = null }
}

module.exports = { CloudBackupService, parseRefreshToken }
