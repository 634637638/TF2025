'use strict'

const fs = require('node:fs')
const crypto = require('node:crypto')
const { finished } = require('node:stream/promises')
const axios = require('axios')
const { secp256k1 } = require('@noble/curves/secp256k1')

const API = 'https://api.alipan.com'
const USER_API = 'https://user.alipan.com'
const AUTH = 'https://auth.alipan.com/v2/account/token'
const APP_ID = '5dde4e1bdf9e4966b387ba58f4b3fdc3'
const PART_SIZE = 16 * 1024 * 1024
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class CloudUploadError extends Error {
  constructor(message, retryable = false, statusCode = 502) {
    super(message)
    this.retryable = retryable
    this.statusCode = statusCode
  }
}

function partResponseError(response) {
  const code = typeof response.data === 'string'
    ? response.data.slice(0, 16_384).match(/<Code>\s*([A-Za-z]+)\s*<\/Code>/)?.[1]
    : response.data?.Code
  // 只映射已知错误，不向任务状态转交 OSS 原文、签名或内部路径。
  const messages = {
    SignatureDoesNotMatch: '云盘分片签名校验失败，请更新后端后重试上传',
    AccessDenied: '云盘拒绝分片上传，请检查账号权限或重新连接云盘',
    InvalidAccessKeyId: '云盘分片授权无效，请重新连接云盘',
    NoSuchUpload: '云盘上传会话已失效，请重新上传',
    PartAlreadyExist: '云盘分片已存在，需要核对断点后继续上传',
    RequestTimeTooSkewed: '服务器时间与云盘不一致，请校准服务器时间后重试',
    RequestExpired: '云盘分片地址已过期，请重试上传',
    InvalidArgument: '云盘拒绝分片参数，请更新后端后重试上传',
    InvalidRequest: '云盘拒绝分片参数，请更新后端后重试上传',
    MissingContentLength: '云盘分片缺少文件长度，请更新后端后重试上传',
    BadDigest: '云盘分片校验失败，请核对本地备份文件后重试',
    InvalidDigest: '云盘分片校验失败，请核对本地备份文件后重试'
  }
  const knownCode = typeof code === 'string' && Object.hasOwn(messages, code) ? code : ''
  const retryable = knownCode ? knownCode === 'RequestExpired'
    : [408, 429].includes(response.status) || response.status >= 500
  const error = new CloudUploadError(
    messages[knownCode] || `云盘分片上传失败（HTTP ${response.status}），请检查云盘服务后重试`, retryable
  )
  error.uploadSessionExpired = knownCode === 'NoSuchUpload'
  error.partAlreadyExists = knownCode === 'PartAlreadyExist'
  return error
}

/** 第三方请求独立客户端：不携带站内 JWT/CSRF，不记录响应体或签名 URL。 */
class AliyunDriveClient {
  constructor({ config, persistToken, http, wait = delay }) {
    this.config = config
    this.persistToken = persistToken
    this.http = http || axios.create({ timeout: 30_000, maxRedirects: 0, proxy: false })
    this.wait = wait
    this.accessToken = ''
    this.expiresAt = 0
    this.signature = ''
    this.userId = ''
  }

  async json(url, body, headers = {}, { allowEmpty = false } = {}) {
    let response
    try {
      response = await this.http.post(url, body, {
        headers: { 'Content-Type': 'application/json', ...headers },
        validateStatus: () => true
      })
    } catch {
      throw new CloudUploadError('云盘网络请求失败，请检查后端网络连接', true)
    }
    const data = response.data
    if (allowEmpty && response.status === 204 && (data === '' || data === null || data === undefined)) return {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new CloudUploadError('云盘返回了无效响应', true)
    }
    if (response.status >= 400 || data.code) {
      const code = String(data.code || '')
      const expired = ['AccessTokenInvalid', 'AccessTokenExpired', 'I400JD'].includes(code)
      const error = new CloudUploadError(
        expired || response.status === 401 ? '云盘授权已失效，请更新 Token'
          : response.status === 429 ? '云盘请求过于频繁，稍后重试'
            : ['AlreadyExist.File', 'AlreadyExist.FileName', 'FileAlreadyExist', 'SameNameFileExists'].includes(code) ? '当前目录已有同名文件或文件夹，请换一个名称'
              : code.startsWith('InvalidParameter.') ? '云盘请求参数不兼容，请检查目录或更新后端'
                : ['NotFound.File', 'NotFound.FileId', 'FileIdNotFound'].includes(code) ? '当前授权的云盘中找不到该目录或文件，请通过浏览云盘重新选择，并核对 Token 对应账号'
                  : '云盘拒绝请求，请检查授权、目录及云盘可用空间',
        response.status === 429 || response.status >= 500
      )
      error.providerCode = code
      error.expired = expired
      error.uploadSessionExpired = ['NoSuchUpload', 'InvalidUploadId', 'UploadIdNotFound', 'NotFound.UploadId'].includes(code)
      if (['NotFound.File', 'NotFound.FileId', 'FileIdNotFound'].includes(code)) error.statusCode = 404
      else if (expired || response.status === 401
        || ['AlreadyExist.File', 'AlreadyExist.FileName', 'FileAlreadyExist', 'SameNameFileExists'].includes(code)) error.statusCode = 409
      else if (code.startsWith('InvalidParameter.')) error.statusCode = 400
      throw error
    }
    return data
  }

  async refresh() {
    if (!this.refreshing) this.refreshing = this.refreshAuthorization().finally(() => { this.refreshing = null })
    return this.refreshing
  }

  async refreshAuthorization() {
    const data = await this.json(AUTH, {
      grant_type: 'refresh_token', refresh_token: this.config.refreshToken
    })
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !data.user_id) {
      throw new CloudUploadError('Token 类型或授权响应无效，请使用阿里云盘网页登录的 refresh_token')
    }
    // 阿里云盘可能轮换 refresh_token，拿到新值后必须先持久化再继续上传。
    await this.persistToken(data.refresh_token)
    this.config.refreshToken = data.refresh_token
    this.accessToken = data.access_token
    this.userId = String(data.user_id)
    this.defaultDriveId = String(data.default_drive_id || '')
    this.expiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 7200) * 1000
    const message = `${APP_ID}:${this.config.deviceId}:${this.userId}:0`
    const digest = crypto.createHash('sha256').update(message).digest()
    const signed = secp256k1.sign(digest, this.config.deviceKey)
    this.signature = signed.toCompactHex() + signed.recovery.toString(16).padStart(2, '0')
    await this.session()
  }

  headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Origin: 'https://www.alipan.com', Referer: 'https://www.alipan.com/',
      'X-Device-Id': this.config.deviceId, 'X-Signature': this.signature,
      'X-Request-Id': crypto.randomUUID()
    }
  }

  session() {
    const publicKey = Buffer.from(secp256k1.getPublicKey(this.config.deviceKey, false)).subarray(1).toString('hex')
    return this.json(`${API}/users/v1/users/device/create_session`, {
      deviceName: 'TF2025 Backup', modelName: 'Server', nonce: 0,
      pubKey: publicKey, refreshToken: this.config.refreshToken
    }, this.headers())
  }

  async request(endpoint, body, origin = API, options = {}) {
    if (!this.accessToken || Date.now() >= this.expiresAt - 60_000) await this.refresh()
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.json(`${origin}${endpoint}`, body, this.headers(), options)
      } catch (error) {
        if (attempt >= 2) throw error
        if (error.expired) await this.refresh()
        else if (error.providerCode === 'DeviceSessionSignatureInvalid') await this.session()
        else if (error.retryable) await this.wait(1000 * (attempt + 1))
        else throw error
      }
    }
  }

  async drives() {
    // 用户服务才返回资源库/备份盘；文件 API 同路径只返回旧默认盘，可能为空。
    const info = await this.request('/v2/user/get', {}, USER_API)
    const candidates = [
      [info.resource_drive_id, '资源库'], [info.backup_drive_id, '备份盘'],
      [info.default_drive_id || this.defaultDriveId, '默认云盘']
    ]
    const drives = []
    for (const [value, name] of candidates) {
      if (value && !drives.some(drive => drive.id === String(value))) drives.push({ id: String(value), name })
    }
    if (!drives.length) throw new CloudUploadError('未找到可访问的云盘')
    return { drives, defaultDriveId: String(info.default_drive_id || this.defaultDriveId || drives[0].id) }
  }

  async directory(driveId, folderId) {
    if (folderId === 'root') return { driveId, folderId, folderName: '根目录' }
    const folder = await this.file(driveId, folderId)
    if (folder.type !== 'folder') throw new CloudUploadError('目标目录不可用，请通过浏览云盘重新选择')
    return { driveId, folderId, folderName: String(folder.name || '未命名文件夹') }
  }

  async file(driveId, fileId, { allowTrashed = false } = {}) {
    if (fileId === 'root') throw new CloudUploadError('不能修改或删除云盘根目录')
    const file = await this.request('/v2/file/get', { drive_id: driveId, file_id: fileId })
    if (file.file_id !== fileId || !['file', 'folder'].includes(file.type)) throw new CloudUploadError('云盘未返回有效的文件信息，请刷新列表后重试')
    if (file.trashed && !allowTrashed) throw new CloudUploadError('文件或文件夹已在回收站，请刷新列表', false, 409)
    if (file.type === 'file' ? file.status !== 'available' : file.status && file.status !== 'available') {
      throw new CloudUploadError('文件或文件夹不可用，请刷新列表；未完成上传的文件暂不能管理', false, 409)
    }
    return file
  }

  async containsFolder(driveId, folderId, ancestorId, options = {}) {
    const visited = new Set()
    while (folderId !== 'root') {
      if (folderId === ancestorId) return true
      if (visited.has(folderId) || visited.size >= 256) throw new CloudUploadError('目录层级无法确认，请刷新后重试')
      visited.add(folderId)
      const folder = await this.file(driveId, folderId, options)
      if (folder.type !== 'folder' || typeof folder.parent_file_id !== 'string' || !folder.parent_file_id) {
        throw new CloudUploadError('目录层级无法确认，请刷新后重试')
      }
      folderId = folder.parent_file_id
    }
    return ancestorId === 'root'
  }

  async createFolder(driveId, folderId, name) {
    await this.directory(driveId, folderId)
    let created = await this.request('/adrive/v2/file/createWithFolders', {
      drive_id: driveId, parent_file_id: folderId, name, type: 'folder', check_name_mode: 'refuse'
    })
    if (typeof created.file_id !== 'string' || !created.file_id || created.file_id === 'root') {
      throw new CloudUploadError('云盘未返回有效的新建目录，请刷新列表核对')
    }
    // 上游部分成功响应只返回 ID；回读确认，不能把缺少展示字段直接判为创建失败。
    if (created.type === undefined || created.name === undefined) created = await this.file(driveId, created.file_id)
    if (created.type !== 'folder' || created.name !== name
      || (created.parent_file_id !== undefined && created.parent_file_id !== folderId)
      || (created.drive_id !== undefined && created.drive_id !== driveId)) {
      throw new CloudUploadError('云盘新建目录结果尚未确认，请刷新列表核对，勿重复提交', false, 409)
    }
    return { driveId, folderId: created.file_id, folderName: created.name }
  }

  async renameFile(driveId, fileId, name) {
    await this.file(driveId, fileId)
    let renamed = await this.request('/v3/file/update', {
      drive_id: driveId, file_id: fileId, name, check_name_mode: 'refuse'
    })
    if (renamed.file_id === fileId && renamed.name === undefined) renamed = await this.file(driveId, fileId)
    if (renamed.file_id !== fileId || renamed.name !== name) throw new CloudUploadError('云盘重命名结果无法确认，请刷新列表核对')
  }

  async target() {
    const { defaultDriveId } = await this.drives()
    return this.directory(this.config.driveId || defaultDriveId, this.config.folderId)
  }

  async files({ driveId, folderId, marker, trash }) {
    const folder = trash ? null : await this.directory(driveId, folderId)
    const data = await this.request(trash ? '/v2/recyclebin/list' : '/v2/file/list', {
      drive_id: driveId, ...(trash ? {} : { parent_file_id: folderId }),
      limit: 100, marker, order_by: 'name', order_direction: 'ASC',
      ...(trash ? {} : { all: false, fields: '*' })
    })
    if (!Array.isArray(data.items)) throw new CloudUploadError('云盘文件列表响应无效')
    return {
      folder, nextMarker: typeof data.next_marker === 'string' ? data.next_marker : '',
      items: data.items.filter(item => item && typeof item.file_id === 'string'
        && ['file', 'folder'].includes(item.type)).map(item => ({
        id: item.file_id, name: String(item.name || '未命名'), type: item.type,
        size: Number.isFinite(item.size) ? item.size : 0
      }))
    }
  }

  async trashFile(driveId, fileId) {
    const file = await this.file(driveId, fileId, { allowTrashed: true })
    if (file.trashed) return
    try {
      await this.request('/v2/recyclebin/trash', { drive_id: driveId, file_id: fileId }, API, { allowEmpty: true })
    } catch (error) {
      // 其他客户端可能在预检后先移入回收站；只在回读确认后视为完成。
      if (['NotFound.File', 'NotFound.FileId', 'FileIdNotFound'].includes(error.providerCode)) {
        const current = await this.file(driveId, fileId, { allowTrashed: true })
        if (current.trashed) return
      }
      throw error
    }
  }

  async waitForFileTask(result) {
    if (!result.task_id) return
    if (typeof result.task_id !== 'string') throw new CloudUploadError('云盘返回了无效处理任务')
    for (let attempt = 0; attempt < 10; attempt++) {
      const task = await this.request('/v3/async_task/get', { task_id: result.task_id })
      if (task.state === 'Succeed') return
      if (task.state === 'Failed') throw new CloudUploadError('云盘文件处理失败，请刷新后重试', false, 409)
      await this.wait(500)
    }
    throw new CloudUploadError('云盘仍在处理文件，请稍后刷新回收站核对结果', false, 409)
  }

  async restoreFile(driveId, fileId) {
    const file = await this.file(driveId, fileId, { allowTrashed: true })
    if (!file.trashed) return file
    const result = await this.request('/v2/recyclebin/restore', { drive_id: driveId, file_id: fileId }, API, { allowEmpty: true })
    await this.waitForFileTask(result)
    return this.file(driveId, fileId)
  }

  async purgeFile(driveId, fileId) {
    const file = await this.file(driveId, fileId, { allowTrashed: true })
    if (!file.trashed) throw new CloudUploadError('仅能彻底删除回收站中的文件或文件夹，请刷新列表', false, 409)
    const result = await this.request('/v3/file/delete', { drive_id: driveId, file_id: fileId }, API, { allowEmpty: true })
    await this.waitForFileTask(result)
    try { await this.file(driveId, fileId, { allowTrashed: true }) }
    catch (error) {
      if (error.statusCode === 404) return
      throw error
    }
    throw new CloudUploadError('云盘尚未确认彻底删除，请稍后刷新回收站核对', false, 409)
  }

  async uploadPart(url, filename, start, end) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
      || !['.aliyundrive.net', '.aliyuncs.com', '.alipan.com'].some(suffix => parsed.hostname.endsWith(suffix))) {
      throw new CloudUploadError('云盘返回的分片上传地址不受支持')
    }
    const stream = fs.createReadStream(filename, {
      start, end, flags: fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
    })
    try {
      let response
      try {
        response = await this.http.put(parsed.href, stream, {
          timeout: 10 * 60_000, maxBodyLength: Infinity, maxRedirects: 0,
          // 分片签名使用空 Content-Type；显式置空也阻止 Axios 自动补充表单类型。
          headers: { 'Content-Type': '', 'Content-Length': end - start + 1 },
          validateStatus: () => true
        })
      } catch (error) {
        if (['ENOENT', 'EACCES', 'EPERM', 'ELOOP', 'EISDIR', 'EIO'].includes(error.code)) {
          throw new CloudUploadError('无法读取本地备份文件，请检查文件是否存在及读取权限')
        }
        throw new CloudUploadError(
          ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
            ? '云盘分片上传超时，请检查后端网络后重试'
            : '云盘分片上传网络异常，请检查后端网络后重试', true
        )
      }
      if (response.status < 200 || response.status >= 300) throw partResponseError(response)
    } finally {
      stream.destroy()
      // 云端提前拒绝时也等待文件句柄关闭；保留原请求错误，不让清理异常覆盖它。
      await finished(stream, { cleanup: true }).catch(() => {})
    }
  }

  async verifyUploadedPart(session, number, filename, start, end, allowMissing = false) {
    const markers = new Set()
    let marker = ''
    let uploaded
    do {
      if (markers.has(marker) || markers.size >= 10_000) throw new CloudUploadError('云盘分片列表分页异常，请重试上传')
      markers.add(marker)
      const data = await this.request('/v2/file/list_uploaded_parts', {
        drive_id: session.driveId, file_id: session.fileId, upload_id: session.uploadId,
        ...(marker ? { part_number_marker: marker } : {}), limit: 1000
      })
      if (!Array.isArray(data.uploaded_parts)) throw new CloudUploadError('云盘未返回有效分片列表，请重试上传')
      uploaded = data.uploaded_parts.find(part => part.part_number === number)
      if (uploaded) break
      const next = data.next_part_number_marker
      if (next !== undefined && typeof next !== 'string' && !Number.isSafeInteger(next)) {
        throw new CloudUploadError('云盘分片列表分页异常，请重试上传')
      }
      marker = next ? String(next) : ''
      if (marker.length > 8192) throw new CloudUploadError('云盘分片列表分页异常，请重试上传')
    } while (marker)
    if (!uploaded && allowMissing) return false
    if (!uploaded || Number(uploaded.part_size) !== end - start + 1
      || typeof uploaded.etag !== 'string' || !/^(?:[a-f0-9]{32}|"[a-f0-9]{32}")$/i.test(uploaded.etag)) {
      throw new CloudUploadError('云端已存在分片但无法核对内容，请重新创建上传任务')
    }
    const digest = crypto.createHash('md5')
    try {
      for await (const chunk of fs.createReadStream(filename, {
        start, end, flags: fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)
      })) digest.update(chunk)
    } catch {
      throw new CloudUploadError('无法读取本地备份文件，请检查文件是否存在及读取权限')
    }
    if (digest.digest('hex') !== uploaded.etag.replace(/"/g, '').toLowerCase()) {
      throw new CloudUploadError('云端分片与本地备份内容不一致，已停止上传，请核对备份文件')
    }
    return true
  }

  async upload({ filename, directory, filePath, size, session, checkpoint, progress }) {
    const target = directory || await this.target()
    const partSize = Math.max(PART_SIZE, Math.ceil(size / 10_000))
    const count = Math.max(1, Math.ceil(size / partSize))
    const parts = Array.from({ length: count }, (_, index) => ({ part_number: index + 1 }))
    let reconcileCheckpoint = Boolean(session)
    if (!session) {
      const created = await this.request('/adrive/v2/file/createWithFolders', {
        drive_id: target.driveId, parent_file_id: target.folderId, name: filename,
        type: 'file', check_name_mode: 'auto_rename', size, content_hash_name: 'none',
        part_info_list: parts
      })
      if (!created.file_id || !created.upload_id) throw new CloudUploadError('云盘未返回有效上传任务')
      session = { fileId: created.file_id, uploadId: created.upload_id, driveId: target.driveId, folderId: target.folderId, nextPart: 1, partSize }
      await checkpoint(session)
    }
    if (session.driveId !== target.driveId || (session.folderId && session.folderId !== target.folderId) || session.partSize !== partSize) {
      throw new CloudUploadError('上传目标或文件分片发生变化，请重新创建上传任务')
    }
    if (session.nextPart > count) {
      const remote = await this.request('/v2/file/get', { drive_id: session.driveId, file_id: session.fileId })
      if (remote.status === 'available' && Number(remote.size) === size && !remote.trashed) {
        return { fileId: session.fileId, driveId: session.driveId, folderId: target.folderId }
      }
    }
    for (let number = session.nextPart; number <= count; number++) {
      let success = false
      const start = (number - 1) * partSize
      const end = Math.min(size, start + partSize) - 1
      if (reconcileCheckpoint) {
        // 串行上传最多有一片已接收却未落盘；恢复时先核对，避免重复传输。
        success = await this.verifyUploadedPart(session, number, filePath, start, end, true)
        reconcileCheckpoint = false
      }
      for (let attempt = 0; !success && attempt < 3; attempt++) {
        try {
          // 每次取当前分片的签名地址，避免大文件传输时地址过期。
          const data = await this.request('/v2/file/get_upload_url', {
            drive_id: session.driveId, file_id: session.fileId, upload_id: session.uploadId,
            part_info_list: [{ part_number: number }]
          })
          const part = data.part_info_list?.find(item => item.part_number === number)
          if (typeof part?.upload_url !== 'string') throw new CloudUploadError('云盘未返回有效分片地址')
          await this.uploadPart(part.upload_url, filePath, start, end)
          success = true
          break
        } catch (error) {
          if (error.partAlreadyExists) {
            await this.verifyUploadedPart(session, number, filePath, start, end)
            success = true
            break
          }
          if (!error.retryable || attempt === 2) throw error
          await this.wait(1000 * (attempt + 1))
        }
      }
      if (success) {
        session.nextPart = number + 1
        await checkpoint(session)
        progress(Math.min(99, Math.floor(number * 100 / count)))
      }
    }
    const completed = await this.request('/v2/file/complete', {
      drive_id: session.driveId, file_id: session.fileId, upload_id: session.uploadId
    })
    if (String(completed.file_id) !== session.fileId || (completed.size !== undefined && Number(completed.size) !== size)) {
      throw new CloudUploadError('云盘完成校验失败，请重试任务')
    }
    return { fileId: session.fileId, driveId: session.driveId, folderId: target.folderId }
  }
}

module.exports = { AliyunDriveClient, CloudUploadError }
