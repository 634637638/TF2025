'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const axios = require('axios')
const crypto = require('node:crypto')
const { CloudBackupService, parseRefreshToken } = require('../src/services/cloud-backup.service')
const { AliyunDriveClient, CloudUploadError } = require('../src/services/aliyun-drive-client')
const CloudBackupRepository = require('../src/repositories/cloud-backup.repository')
const CloudBackupController = require('../src/controllers/cloud-backup.controller')
const backupService = require('../src/services/backup.service')

const TEST_TOKEN = 'synthetic-refresh-token-1234567890'
const TEST_KEY = 'test-only-cloud-config-key-32-characters'
const filename = 'backup_20261110_120000.zip'

async function fixture(t, clientFactory) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cloud-backup-'))
  const source = path.join(root, 'source')
  fs.mkdirSync(source)
  fs.writeFileSync(path.join(source, 'asset.txt'), 'synthetic uploaded asset')
  await backupService.compressBackup(source, path.join(root, filename))
  fs.rmSync(source, { recursive: true })
  const previous = process.env.CONFIG_ENCRYPTION_KEY
  process.env.CONFIG_ENCRYPTION_KEY = TEST_KEY
  const repository = new CloudBackupRepository(path.join(root, '.cloud'))
  const backup = {
    getBackupDir: () => root,
    isValidBackupFilename: backupService.isValidBackupFilename.bind(backupService),
    resolveBackupPath: value => path.join(root, value),
    getBackupList: () => [{ filename }]
  }
  let now = 1_000_000
  const options = { backup, repository, clientFactory, now: () => now, logger: { warn() {}, error() {} } }
  const service = new CloudBackupService(options)
  t.after(() => {
    service.stop()
    if (previous === undefined) delete process.env.CONFIG_ENCRYPTION_KEY
    else process.env.CONFIG_ENCRYPTION_KEY = previous
    fs.rmSync(root, { recursive: true, force: true })
  })
  const account = service.saveAccount({ name: '测试网盘', token: TEST_TOKEN })
  service.saveSettings({ enabled: true, accountId: account.id, folderId: 'target-folder', driveId: '' })
  return { root, service, repository, options, advance: ms => { now += ms } }
}

test('网页登录 Token 支持 JSON，配置加密落盘且 API 不回传凭据', async t => {
  assert.equal(parseRefreshToken(JSON.stringify({ refresh_token: TEST_TOKEN, access_token: 'ignored' })), TEST_TOKEN)
  assert.throws(() => parseRefreshToken('{broken'), /JSON/)
  assert.throws(() => parseRefreshToken(JSON.stringify({ access_token: TEST_TOKEN })), /refresh_token/)
  const { service, repository } = await fixture(t)
  const disk = fs.readFileSync(repository.filename, 'utf8')
  assert.equal(disk.includes(TEST_TOKEN), false)
  assert.match(repository.read().accounts[0].token, /^enc:v1:/)
  assert.equal(fs.statSync(repository.filename).mode & 0o777, 0o600)
  assert.deepEqual(service.getSettings(), {
    accountId: repository.read().accounts[0].id, accounts: service.getAccounts().accounts,
    enabled: true, hasToken: true, driveId: '', folderId: 'target-folder', folderName: '',
    schedule: service.getSchedule(repository.read()), retention: service.getRetention(repository.read()), lastError: ''
  })
  service.saveSettings({ enabled: false, folderId: 'target-folder', driveId: '', token: '' })
  assert.equal(service.getSettings().hasToken, true)
})

test('只填 Token 即可连接并识别云盘，未选择目录不会开始自动上传', async t => {
  const { service } = await fixture(t, () => ({ async drives() {
    return { drives: [{ id: 'resource', name: '资源库' }], defaultDriveId: 'resource' }
  } }))
  service.saveSettings({ enabled: false, folderId: '', driveId: '' })
  const result = await service.connect({ accountId: service.getSettings().accountId })
  assert.equal(result.settings.enabled, false)
  assert.equal(result.settings.folderId, '')
  assert.equal(result.settings.hasToken, true)
  assert.equal(result.drives[0].id, 'resource')
  assert.equal(JSON.stringify(result).includes(TEST_TOKEN), false)
  assert.throws(() => service.saveSettings({ enabled: true, folderId: '', driveId: '' }), /目录/)
  assert.throws(() => service.enqueue(filename), /配置/)
})

test('云盘目录与回收站支持分页且只向前端回传文件白名单字段', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  const calls = []
  client.request = async (endpoint, body) => {
    calls.push({ endpoint, body })
    if (endpoint.endsWith('/user/get')) return { resource_drive_id: 'resource', backup_drive_id: 'backup', default_drive_id: 'resource' }
    if (endpoint.endsWith('/file/get')) return { file_id: body.file_id, type: 'folder', name: '业务备份' }
    return { items: [{ file_id: 'file-1', type: 'file', name: '备份.zip', size: 1024,
      download_url: 'https://secret.invalid/signed', access_token: TEST_TOKEN }], next_marker: 'next-page' }
  }
  assert.equal((await client.drives()).drives.length, 2)
  const root = await client.files({ driveId: 'resource', folderId: 'root', marker: '', trash: false })
  assert.equal(root.folder.folderId, 'root')
  assert.equal(root.nextMarker, 'next-page')
  assert.equal(calls.at(-1).body.url_expire_sec, undefined, '云盘拒绝零有效期，不传该参数使用服务端默认值')
  assert.deepEqual(root.items, [{ id: 'file-1', type: 'file', name: '备份.zip', size: 1024 }])
  const folder = await client.files({ driveId: 'resource', folderId: 'business', marker: 'next-page', trash: false })
  assert.equal(folder.folder.folderName, '业务备份')
  assert.equal(calls.at(-1).body.marker, 'next-page')
  const trash = await client.files({ driveId: 'resource', folderId: 'root', marker: '', trash: true })
  assert.equal(trash.folder, null)
  assert.equal(calls.at(-1).endpoint, '/v2/recyclebin/list')
  assert.equal('parent_file_id' in calls.at(-1).body, false)
})

test('从用户服务识别资源库和备份盘，文件列表仍使用文件服务，不遗漏非默认盘文件', async () => {
  const calls = []
  const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
    async post(url, body, options) {
      calls.push({ url, body })
      assert.equal(options.headers.Authorization, 'Bearer synthetic-access')
      if (url === 'https://user.alipan.com/v2/user/get') return { status: 200, data: {
        resource_drive_id: 'resource', backup_drive_id: 'backup', default_drive_id: 'backup',
        sbox_drive_id: 'private', user_name: 'not-exposed'
      } }
      // 旧地址仅返回空的默认盘；测试同时防止请求地址退回旧实现。
      if (url === 'https://api.alipan.com/v2/user/get') return { status: 200, data: { default_drive_id: 'backup' } }
      assert.equal(url, 'https://api.alipan.com/v2/file/list')
      return { status: 200, data: { items: body.drive_id === 'resource'
        ? [{ file_id: 'folder', name: '业务备份', type: 'folder' }] : [], next_marker: '' } }
    }
  } })
  client.accessToken = 'synthetic-access'
  client.expiresAt = Date.now() + 3600_000
  const connection = await client.drives()
  assert.deepEqual(connection, {
    drives: [{ id: 'resource', name: '资源库' }, { id: 'backup', name: '备份盘' }],
    defaultDriveId: 'backup'
  })
  const empty = await client.files({ driveId: 'backup', folderId: 'root', marker: '', trash: false })
  assert.deepEqual(empty.items, [])
  const resource = await client.files({ driveId: 'resource', folderId: 'root', marker: '', trash: false })
  assert.equal(resource.items[0].name, '业务备份')
  assert.equal(calls[0].url, 'https://user.alipan.com/v2/user/get')
})

test('云盘文件和文件夹可移入回收站，重复删除正常完成，根目录和未完成文件受保护', async t => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  let metadata = { file_id: 'remote-file', type: 'folder', status: 'available' }
  const calls = []
  client.request = async (endpoint, body) => {
    calls.push({ endpoint, body })
    if (endpoint.endsWith('/file/get')) return metadata
    return {}
  }
  await client.trashFile('drive', 'remote-file')
  assert.equal(calls.at(-1).endpoint, '/v2/recyclebin/trash')
  await assert.rejects(() => client.trashFile('drive', 'root'), /根目录/)
  metadata = { ...metadata, type: 'file', status: 'uploading' }
  await assert.rejects(() => client.trashFile('drive', 'remote-file'), /未完成/)
  metadata.status = 'available'
  await client.trashFile('drive', 'remote-file')
  assert.equal(calls.at(-1).endpoint, '/v2/recyclebin/trash')
  metadata.trashed = true
  const trashCalls = calls.filter(call => call.endpoint === '/v2/recyclebin/trash').length
  await client.trashFile('drive', 'remote-file')
  assert.equal(calls.filter(call => call.endpoint === '/v2/recyclebin/trash').length, trashCalls)
  await assert.rejects(() => client.file('drive', 'remote-file'), error => error.statusCode === 409)
  metadata.trashed = false
  const { service, root } = await fixture(t, () => ({
    async upload() { return { fileId: 'remote-file', driveId: 'drive' } },
    trashFile: client.trashFile.bind(client), file: client.file.bind(client)
  }))
  await service.tick()
  await service.trashFile('drive', 'remote-file')
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.match(service.getTasks()[0].error, /云端已删除/)
  assert.equal(fs.existsSync(path.join(root, filename)), true)
  await assert.rejects(() => service.browse({ driveId: '../drive' }), /格式/)
  await assert.rejects(() => service.browse({ driveId: 'drive', trash: {} }), /类型/)
})

test('删除兼容上游 204 空响应，重复删除修正任务状态且保留本地文件', async t => {
  let trashed = false, deletes = 0
  let client
  const { service, repository, root } = await fixture(t, options => {
    client = new AliyunDriveClient({ ...options, http: {
      async post(url) {
        if (url.endsWith('/v2/file/get')) return { status: 200, data: {
          file_id: 'remote-file', type: 'file', status: 'available', trashed
        } }
        assert.equal(url, 'https://api.alipan.com/v2/recyclebin/trash')
        deletes++
        trashed = true
        return { status: 204, data: '' }
      }
    } })
    client.accessToken = 'synthetic-access'
    client.expiresAt = Date.now() + 7200_000
    return client
  })
  const state = repository.read()
  state.tasks.push({ accountId: state.config.accountId, id: 'success-task', filename, revision: state.accounts[0].revision, status: 'success',
    remote: { driveId: 'drive', fileId: 'remote-file' } })
  repository.write(state)
  const controller = new CloudBackupController(service)
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const request = { params: { driveId: 'drive', fileId: 'remote-file' } }
  const first = response()
  await controller.trashFile(request, first)
  assert.equal(first.statusCode, 200)
  assert.equal(first.body.success, true)
  assert.equal(deletes, 1)
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.match(service.getTasks()[0].error, /云端已删除/)
  assert.equal(fs.existsSync(path.join(root, filename)), true)

  // 兼容旧错误响应留下的“云端已删除、本地仍成功”状态。
  const stale = repository.read()
  stale.tasks[0].status = 'success'
  repository.write(stale)
  const repeated = response()
  await controller.trashFile(request, repeated)
  assert.equal(repeated.statusCode, 200)
  assert.equal(repeated.body.success, true)
  assert.equal(deletes, 1)
  assert.equal(service.getTasks()[0].status, 'invalid')
  await assert.rejects(() => client.renameFile('drive', 'remote-file', 'new.sql'), error => error.statusCode === 409)

  const empty = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
    async post() { return { status: 204, data: '' } }
  } })
  await assert.rejects(() => empty.json('https://example.invalid/files', {}), /无效响应/)
})

test('并发删除仅在回读确认已入回收站后成功，不将任意找不到文件当作成功', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  let gets = 0, confirmTrashed = true
  client.request = async endpoint => {
    if (endpoint === '/v2/file/get') {
      return { file_id: 'file', type: 'file', status: 'available', trashed: gets++ % 2 === 1 && confirmTrashed }
    }
    throw Object.assign(new CloudUploadError('找不到文件', false, 404), { providerCode: 'NotFound.FileId' })
  }
  await client.trashFile('drive', 'file')
  confirmTrashed = false
  await assert.rejects(() => client.trashFile('drive', 'file'), error => error.statusCode === 404)

  for (const [code, status] of [['NotFound.FileId', 404], ['AccessTokenExpired', 409], ['AlreadyExist.File', 409], ['InvalidParameter.Name', 400]]) {
    const provider = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
      async post() { return { status: 400, data: { code, message: TEST_TOKEN } } }
    } })
    await assert.rejects(() => provider.json('https://example.invalid/files', {}), error => {
      const controller = new CloudBackupController({})
      const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
      controller.failure(res, error)
      assert.equal(res.statusCode, status)
      assert.equal(res.body.success, false)
      assert.equal(JSON.stringify(res.body).includes(TEST_TOKEN), false)
      return true
    })
  }
})

test('后台上传时仍可浏览、新建及改名，复用上传客户端且删除保持保护', async t => {
  let releaseUpload, started
  const ready = new Promise(resolve => { started = resolve })
  const waiting = new Promise(resolve => { releaseUpload = resolve })
  let clients = 0
  const { service } = await fixture(t, () => {
    clients++
    return {
      async upload() { started(); await waiting; return { fileId: 'remote' } },
      async files() { return { items: [], folder: { folderId: 'root' }, nextMarker: '' } },
      async createFolder(driveId, folderId, name) { return { driveId, folderId: 'new-folder', folderName: name } },
      async renameFile() {}
    }
  })
  const tick = service.tick()
  await ready
  try {
    const result = await service.browse({ driveId: 'drive' })
    assert.deepEqual(result.items, [])
    assert.equal(clients, 1)
    assert.deepEqual(await service.createFolder({ driveId: 'drive', folderId: 'root', name: '新目录' }), {
      driveId: 'drive', folderId: 'new-folder', folderName: '新目录'
    })
    await service.renameFile('drive', 'file', { name: '新名称' })
    assert.equal(clients, 1)
    await assert.rejects(() => service.trashFile('drive', 'file'), error => error.statusCode === 409)
  } finally { releaseUpload(); await tick }
})

test('上传完成后仍保留在途改名的工作锁，保存名称和轮换授权不覆盖上传进度', async t => {
  let releaseUpload, releaseRename, uploadStarted, renameStarted
  const uploading = new Promise(resolve => { uploadStarted = resolve })
  const renaming = new Promise(resolve => { renameStarted = resolve })
  const uploadWait = new Promise(resolve => { releaseUpload = resolve })
  const renameWait = new Promise(resolve => { releaseRename = resolve })
  const { service, repository } = await fixture(t, options => ({
    async upload() { uploadStarted(); await uploadWait; return { fileId: 'remote', driveId: 'drive' } },
    async renameFile() { renameStarted(); await renameWait; options.persistToken('synthetic-concurrent-rotated-token') }
  }))
  const tick = service.tick()
  await uploading
  const rename = service.renameFile('drive', 'target-folder', { name: '新备份目录' })
  await renaming
  try {
    releaseUpload()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(service.getTasks()[0].status, 'success')
    assert.equal(service.running, true)
    assert.equal(repository.acquireLock(), null)
    assert.throws(() => service.saveSettings({ enabled: true, driveId: 'drive', folderId: 'other' }), error => error.statusCode === 409)
  } finally {
    releaseUpload()
    releaseRename()
    await Promise.allSettled([tick, rename])
  }
  await rename
  const state = repository.read()
  assert.equal(state.accounts[0].folderName, '新备份目录')
  assert.equal(require('../src/utils/config-secret-crypto').decryptConfigSecret(state.accounts[0].token), 'synthetic-concurrent-rotated-token')
  assert.equal(state.tasks[0].status, 'success')
  assert.equal(state.tasks[0].progress, 100)
  assert.equal(service.running, false)
  const release = repository.acquireLock()
  assert.equal(typeof release, 'function')
  release()
})

test('新建及改名成功响应缺少名称时回读核验，不重复提交且拒绝错误目录归属', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  const calls = []
  let name = '新目录', parent = 'root'
  client.request = async (endpoint, body) => {
    calls.push(endpoint)
    if (endpoint === '/adrive/v2/file/createWithFolders') return { file_id: 'new-folder' }
    if (endpoint === '/v3/file/update') { name = body.name; return { file_id: body.file_id } }
    return { file_id: body.file_id, name, type: 'folder', parent_file_id: parent, drive_id: 'drive' }
  }
  assert.deepEqual(await client.createFolder('drive', 'root', name), { driveId: 'drive', folderId: 'new-folder', folderName: name })
  assert.equal(calls.filter(endpoint => endpoint === '/adrive/v2/file/createWithFolders').length, 1)
  await client.renameFile('drive', 'new-folder', '改名后的目录')
  assert.equal(calls.filter(endpoint => endpoint === '/v3/file/update').length, 1)
  parent = 'another-folder'
  await assert.rejects(() => client.createFolder('drive', 'root', name), error => error.statusCode === 409)
})

test('新建与重命名拒绝覆盖重名内容，校验返回结果并保留输入白名单', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  const calls = []
  client.request = async (endpoint, body) => {
    calls.push({ endpoint, body })
    if (endpoint === '/v2/file/get') return { file_id: body.file_id, name: '原目录', type: 'folder' }
    return { file_id: body.file_id || 'new-folder', name: body.name, type: 'folder', access_token: TEST_TOKEN }
  }
  assert.deepEqual(await client.createFolder('drive', 'root', '新目录'), { driveId: 'drive', folderId: 'new-folder', folderName: '新目录' })
  assert.deepEqual(calls.at(-1), { endpoint: '/adrive/v2/file/createWithFolders', body: {
    drive_id: 'drive', parent_file_id: 'root', name: '新目录', type: 'folder', check_name_mode: 'refuse'
  } })
  await client.renameFile('drive', 'folder', '新名称')
  assert.deepEqual(calls.at(-1), { endpoint: '/v3/file/update', body: {
    drive_id: 'drive', file_id: 'folder', name: '新名称', check_name_mode: 'refuse'
  } })
  client.request = async () => ({ file_id: 'wrong', name: 'wrong', type: 'folder' })
  await assert.rejects(() => client.createFolder('drive', 'root', '新目录'), /新建目录/)
})

test('云盘名称、ID、根目录有服务端校验，重命名当前备份目录同步显示名称', async t => {
  const calls = []
  const { service, repository } = await fixture(t, () => ({
    async createFolder(...args) { calls.push(args); return { folderId: 'new' } },
    async renameFile(...args) { calls.push(args) }
  }))
  for (const name of ['', '.', '..', '../file', 'bad\\name', 'bad\nname', 'a'.repeat(256), {}, null]) {
    await assert.rejects(() => service.createFolder({ driveId: 'drive', folderId: 'root', name }), error => error.statusCode === 400)
    await assert.rejects(() => service.renameFile('drive', 'file', { name }), error => error.statusCode === 400)
  }
  await assert.rejects(() => service.renameFile('drive', 'root', { name: '改名' }), /根目录/)
  await assert.rejects(() => service.trashFile('drive', 'root'), /根目录/)
  await assert.rejects(() => service.createFolder({ driveId: '../drive', folderId: 'root', name: '目录' }), /格式/)
  assert.equal(calls.length, 0)
  await service.createFolder({ driveId: 'drive', folderId: 'root', name: ' 新目录 ' })
  assert.deepEqual(calls[0], ['drive', 'root', '新目录'])
  const revision = repository.read().accounts[0].revision
  await service.renameFile('drive', 'target-folder', { name: '新备份目录' })
  assert.equal(service.getSettings().folderName, '新备份目录')
  assert.equal(repository.read().accounts[0].revision, revision)
})

test('目录祖先检查拒绝循环与异常层级，支持多层目录', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  const parents = { target: 'parent', parent: 'root', cycle: 'cycle' }
  client.request = async (_endpoint, body) => ({ file_id: body.file_id, type: 'folder', parent_file_id: parents[body.file_id] })
  assert.equal(await client.containsFolder('drive', 'target', 'parent'), true)
  assert.equal(await client.containsFolder('drive', 'target', 'other'), false)
  await assert.rejects(() => client.containsFolder('drive', 'cycle', 'other'), /层级/)
  await assert.rejects(() => client.containsFolder('drive', 'unknown', 'other'), /层级/)
})

test('禁止删除备份目录及父目录，删除其他目录同步其后代成功任务且不覆盖轮换授权', async t => {
  let trashed = 0
  const { service, repository } = await fixture(t, () => ({
    async file() { return { type: 'folder' } },
    async drives() { return { defaultDriveId: 'drive' } },
    async containsFolder(_drive, folder, ancestor) { return folder === ancestor || (folder === 'target-folder' && ancestor === 'parent') || (folder === 'old-sub' && ancestor === 'old-folder') },
    async trashFile() {
      trashed++
      const state = repository.read()
      state.accounts[0].token = 'synthetic-rotated-ciphertext'
      repository.write(state)
    }
  }))
  await assert.rejects(() => service.trashFile('drive', 'target-folder'), error => error.statusCode === 409)
  await assert.rejects(() => service.trashFile('drive', 'parent'), error => error.statusCode === 409)
  assert.equal(trashed, 0)
  const state = repository.read()
  state.tasks.push({ accountId: state.config.accountId, id: 'old-success', status: 'success', remote: { driveId: 'drive', fileId: 'old-file', folderId: 'old-sub' } })
  repository.write(state)
  await service.trashFile('drive', 'old-folder')
  assert.equal(trashed, 1)
  assert.equal(repository.read().tasks[0].status, 'invalid')
  assert.equal(repository.read().accounts[0].token, 'synthetic-rotated-ciphertext')
})

test('并行云盘请求只刷新一次 Token', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {} })
  let calls = 0
  client.refreshAuthorization = async () => { calls++; await new Promise(resolve => setImmediate(resolve)) }
  await Promise.all([client.refresh(), client.refresh(), client.refresh()])
  assert.equal(calls, 1)
})

test('已完成 ZIP 自动上传、重复扫描去重，断点会保存且成功解除删除保护', async t => {
  let uploads = 0
  const { service, repository } = await fixture(t, () => ({
    async upload({ checkpoint, progress }) {
      uploads++
      assert.equal(service.isProtected(filename), true)
      await checkpoint({ fileId: 'remote-file', uploadId: 'upload-session', nextPart: 2 })
      progress(75)
      assert.equal(repository.read().tasks[0].session.nextPart, 2)
      return { fileId: 'remote-file' }
    }
  }))
  await service.tick()
  await service.tick()
  assert.equal(uploads, 1)
  assert.equal(service.getTasks()[0].status, 'success')
  assert.equal(service.getTasks()[0].progress, 100)
  assert.equal(service.isProtected(filename), false)
  assert.equal('session' in service.getTasks()[0], false)
  assert.equal(repository.read().tasks[0].session, null)
})

test('SQL 与 ZIP 共用自动队列，完成的 SQL 去重、失败重试并解除删除保护，临时或未完成文件不入队', async t => {
  const sql = 'sql-20261110_120000.sql'
  let sqlAttempts = 0
  const { service, root, options, advance } = await fixture(t, () => ({
    async upload({ filename: name }) {
      assert.equal(service.isProtected(name), true)
      if (name === sql && sqlAttempts++ === 0) throw new CloudUploadError('模拟网络中断', true)
      return { fileId: name }
    }
  }))
  fs.writeFileSync(path.join(root, `${sql}.tmp`), 'SELECT 1;')
  options.backup.getBackupList = () => [filename, sql].filter(name => fs.existsSync(path.join(root, name))).map(name => ({ filename: name }))
  await service.tick()
  assert.equal(service.getTasks().some(task => task.filename === sql), false)
  fs.renameSync(path.join(root, `${sql}.tmp`), path.join(root, sql))
  await service.tick()
  assert.equal(service.getTasks().some(task => task.filename === sql), false, '无完成标记的 SQL 不上传')
  fs.appendFileSync(path.join(root, sql), '\n-- TF2025 database backup complete\n')
  await service.tick()
  assert.equal(service.getTasks().find(task => task.filename === sql).status, 'retrying')
  assert.equal(service.isProtected(sql), true)
  advance(60_001)
  await service.tick()
  await service.tick()
  assert.equal(sqlAttempts, 2)
  assert.equal(service.getTasks().find(task => task.filename === sql).status, 'success')
  assert.equal(service.isProtected(sql), false)
  assert.equal(service.getTasks().length, 2)
  const legacy = 'database_20261110_130000.sql'
  fs.writeFileSync(path.join(root, legacy), '-- synthetic dump\nSET FOREIGN_KEY_CHECKS=1;\n')
  assert.equal(service.enqueue(legacy).status, 'queued', '兼容既有程序导出的 SQL')
  fs.writeFileSync(path.join(root, legacy), '-- synthetic dump\n-- Dump completed on 2026-11-10 12:00:00\n')
  assert.ok(service.backupInfo(legacy).size > 0, '兼容既有 mysqldump SQL')
  assert.throws(() => service.enqueue(`${sql}.tmp`), /普通文件/)
  const empty = 'sql-20261110_140000.sql'
  fs.writeFileSync(path.join(root, empty), '')
  assert.throws(() => service.enqueue(empty), /尚未完成/)
})

test('云盘浏览、新建、重命名和删除独立鉴权，拒绝后不调用云端', async t => {
  const Module = require('node:module')
  const express = require('express')
  const routePath = require.resolve('../src/routes/backup')
  const previousRoute = require.cache[routePath]
  const originalLoad = Module._load
  let browsed = 0, deleted = 0, created = 0, renamed = 0, connected = 0, restored = 0, purged = 0, saved = 0
  class Service {
    start() {}
    getAccounts() { return { accountId: 'stored', accounts: [] } }
    saveAccount() { return { id: 'new-account', name: '测试网盘' } }
    saveSettings() { saved++; return {} }
    async browse() { browsed++; return { items: [] } }
    async trashFile() { deleted++ }
    async connect() { connected++; return { drives: [] } }
    async createFolder() { created++; return { folderId: 'new' } }
    async renameFile() { renamed++ }
    async restoreFile() { restored++ }
    async purgeFile() { purged++ }
  }
  let router
  try {
    delete require.cache[routePath]
    Module._load = function (name, parent, isMain) {
      if (parent?.filename === routePath && name === '../middleware/unified-auth') return {
        unifiedAuth(req, res, next) { return req.headers['x-test-auth'] ? next() : res.status(401).end() },
        requirePermission: permission => (req, res, next) => String(req.headers['x-test-permission'] || '').split(',').includes(permission) ? next() : res.status(403).end()
      }
      if (parent?.filename === routePath && name === '../services/cloud-backup.service') return { CloudBackupService: Service }
      return originalLoad.call(this, name, parent, isMain)
    }
    router = require(routePath)
  } finally {
    Module._load = originalLoad
    if (previousRoute) require.cache[routePath] = previousRoute
    else delete require.cache[routePath]
  }
  const app = express()
  app.use(express.json())
  app.use('/api/backup', router)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/backup/cloud`
  const policyRequest = (permissions, body) => fetch(`${base}/settings`, { method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-test-auth': 'yes', 'x-test-permission': permissions }, body: JSON.stringify(body) })
  assert.equal((await policyRequest('backup:create', { schedule: { enabled: true, intervalHours: 24, type: 'full' } })).status, 200)
  assert.equal(saved, 1)
  assert.equal((await policyRequest('backup:create', { retention: { enabled: true, sqlCount: 10, zipCount: 10 } })).status, 403)
  assert.equal(saved, 1, '无删除权限不能开启自动清理或更改数量')
  assert.equal((await policyRequest('backup:delete', { retention: { enabled: true, sqlCount: 10, zipCount: 10 } })).status, 403)
  assert.equal((await policyRequest('backup:create,backup:delete', { retention: { enabled: true, sqlCount: 10, zipCount: 10 } })).status, 200)
  assert.equal(saved, 2)
  assert.equal((await fetch(`${base}/files`)).status, 401)
  assert.equal((await fetch(`${base}/files`, { headers: { 'x-test-auth': 'yes', 'x-test-permission': 'backup:edit' } })).status, 403)
  assert.equal((await fetch(`${base}/files`, { headers: { 'x-test-auth': 'yes', 'x-test-permission': 'backup:view' } })).status, 200)
  for (const [route, method, permission, status] of [
    ['/drives', 'GET', 'backup:view', 200], ['/folders', 'POST', 'backup:create', 201],
    ['/accounts', 'GET', 'backup:view', 200], ['/accounts', 'POST', 'backup:create', 200],
    ['/accounts/account', 'PATCH', 'backup:create', 200],
    ['/files/drive/file', 'PATCH', 'backup:edit', 200],
    ['/trash/drive/file/restore', 'POST', 'backup:edit', 200],
    ['/trash/drive/file', 'DELETE', 'backup:delete', 200]
  ]) {
    assert.equal((await fetch(`${base}${route}`, { method })).status, 401)
    assert.equal((await fetch(`${base}${route}`, { method, headers: { 'x-test-auth': 'yes', 'x-test-permission': permission === 'backup:delete' ? 'backup:view' : 'backup:delete' } })).status, 403)
    assert.equal((await fetch(`${base}${route}`, { method, headers: { 'x-test-auth': 'yes', 'x-test-permission': permission } })).status, status)
  }
  assert.equal((await fetch(`${base}/files/drive/file`, { method: 'DELETE', headers: { 'x-test-auth': 'yes', 'x-test-permission': 'backup:create' } })).status, 403)
  assert.equal(deleted, 0)
  assert.equal((await fetch(`${base}/files/drive/file`, { method: 'DELETE', headers: { 'x-test-auth': 'yes', 'x-test-permission': 'backup:delete' } })).status, 200)
  assert.equal(browsed, 1)
  assert.equal(deleted, 1)
  assert.equal(created, 1)
  assert.equal(renamed, 1)
  assert.equal(connected, 1)
  assert.equal(restored, 1)
  assert.equal(purged, 1)
})

test('可重试故障持久化，进程重建后从相同云端会话继续', async t => {
  let attempt = 0
  const fixtureData = await fixture(t, () => ({
    async upload({ session, checkpoint }) {
      attempt++
      if (attempt === 1) {
        await checkpoint({ fileId: 'remote-file', uploadId: 'same-session', nextPart: 3 })
        throw new CloudUploadError('模拟网络中断', true)
      }
      assert.equal(session.uploadId, 'same-session')
      assert.equal(session.nextPart, 3)
      return { fileId: 'remote-file' }
    }
  }))
  await fixtureData.service.tick()
  assert.equal(fixtureData.service.getTasks()[0].status, 'retrying')
  assert.equal(fixtureData.service.isProtected(filename), true)
  const restarted = new CloudBackupService(fixtureData.options)
  await restarted.tick()
  assert.equal(attempt, 1)
  fixtureData.advance(60_001)
  await restarted.tick()
  assert.equal(attempt, 2)
  assert.equal(restarted.getTasks()[0].status, 'success')
})

test('更换目录后旧成功记录不阻止新目标上传', async t => {
  const { service, repository } = await fixture(t, () => ({ async upload() { return { fileId: 'remote-file' } } }))
  await service.tick()
  assert.equal(service.getTasks()[0].status, 'success')
  service.saveSettings({ enabled: false, folderId: 'another-folder', driveId: '' })
  assert.deepEqual(service.getTasks(), [])
  service.enqueue(filename)
  await service.tick()
  assert.equal(service.getTasks()[0].folderId, 'another-folder')
  assert.equal(service.getTasks()[0].status, 'success')
  assert.equal(repository.read().tasks.length, 2, '历史成功记录继续保留用于去重')
})

test('云盘明确返回分片会话失效后，手动重传会创建新会话', async t => {
  const provider = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
    async post() { return { status: 400, data: { code: 'NoSuchUpload' } } }
  } })
  let attempts = 0
  const { service, repository } = await fixture(t, () => ({
    async upload({ session, checkpoint, progress }) {
      if (attempts++ === 0) {
        await checkpoint({ uploadId: 'expired-session', nextPart: 3 })
        progress(50)
        await provider.json('https://example.invalid', {})
      }
      assert.equal(session, null)
      return { fileId: 'new-file' }
    }
  }))
  await service.tick()
  assert.equal(service.getTasks()[0].status, 'failed')
  assert.equal(repository.read().tasks[0].session, null)
  assert.equal(service.getTasks()[0].progress, 0)
  service.enqueue(filename)
  await service.tick()
  assert.equal(service.getTasks()[0].status, 'success')
})

test('自动重试最多五次；关闭自动上传、路径穿越、符号链接及半成品受到限制', async t => {
  let count = 0
  const { service, root, advance } = await fixture(t, () => ({
    async upload() { count++; throw new CloudUploadError('模拟持续网络故障', true) }
  }))
  for (let attempt = 0; attempt < 7; attempt++) { await service.tick(); advance(60 * 60_000) }
  assert.equal(count, 5)
  assert.equal(service.getTasks()[0].status, 'failed')
  assert.throws(() => service.enqueue('../secret.zip'), /普通文件/)
  const link = 'backup_20261110_130000.zip'
  fs.symlinkSync(path.join(root, filename), path.join(root, link))
  assert.throws(() => service.enqueue(link), /无效|尚未完成/)
  const incomplete = 'backup_20261110_140000.zip'
  fs.writeFileSync(path.join(root, incomplete), Buffer.alloc(80))
  assert.throws(() => service.enqueue(incomplete), /尚未完成/)
  service.saveSettings({ enabled: false, folderId: 'target-folder', driveId: '' })
  await service.tick()
  assert.equal(count, 5)
  service.enqueue(filename)
  await service.tick()
  assert.equal(count, 6, '停用自动扫描后仍可手动上传')
})

test('云盘刷新 Token 先保存，再校验目录；分片无站内/云盘认证头，失败重试，完成才成功', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cloud-parts-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'large.zip')
  const size = 17 * 1024 * 1024
  fs.writeFileSync(source, Buffer.alloc(size, 1))
  let savedToken = '', uploaded = 0, failures = 0, completed = false
  const checkpoints = []
  const http = {
    async post(url, body, options) {
      if (url.includes('/account/token')) return { status: 200, data: {
        access_token: 'synthetic-access', refresh_token: 'synthetic-refreshed', user_id: 'test-user', default_drive_id: 'drive', expires_in: 7200
      } }
      assert.equal(savedToken, 'synthetic-refreshed')
      assert.equal(options.headers.Authorization, 'Bearer synthetic-access')
      assert.equal(options.headers['X-Signature'].length, 130)
      if (url.endsWith('/create_session')) return { status: 200, data: { success: true } }
      if (url.endsWith('/user/get')) return { status: 200, data: { default_drive_id: 'drive' } }
      if (url.endsWith('/file/get')) return { status: 200, data: { file_id: 'folder', type: 'folder', name: 'backup' } }
      if (url.endsWith('/createWithFolders')) {
        assert.equal(body.part_info_list.length, 2)
        assert.equal(body.check_name_mode, 'auto_rename')
        return { status: 200, data: { file_id: 'remote', upload_id: 'session' } }
      }
      if (url.endsWith('/get_upload_url')) return { status: 200, data: {
        part_info_list: [{ part_number: body.part_info_list[0].part_number, upload_url: 'https://test.aliyundrive.net/upload?signature=synthetic' }]
      } }
      if (url.endsWith('/complete')) {
        assert.equal(uploaded, size)
        completed = true
        return { status: 200, data: { file_id: 'remote', size } }
      }
      assert.fail(`unexpected endpoint ${url}`)
    },
    async put(_url, stream, options) {
      assert.equal(options.headers.Authorization, undefined)
      assert.equal(options.maxRedirects, 0)
      if (!failures++) throw new Error('temporary failure')
      let bytes = 0
      for await (const buffer of stream) bytes += buffer.length
      assert.equal(bytes, options.headers['Content-Length'])
      uploaded += bytes
      return { status: 200 }
    }
  }
  const client = new AliyunDriveClient({
    config: { refreshToken: TEST_TOKEN, deviceKey: '1'.repeat(64), deviceId: 'device', folderId: 'folder' },
    persistToken: value => { savedToken = value }, http, wait: async () => {}
  })
  const result = await client.upload({ filename: 'large.zip', filePath: source, size,
    checkpoint: session => checkpoints.push({ ...session }), progress: () => {} })
  assert.equal(completed, true)
  assert.equal(result.fileId, 'remote')
  assert.equal(checkpoints.at(-1).nextPart, 3)
  await assert.rejects(() => client.uploadPart('https://127.0.0.1/secret', source, 0, 9), /地址不受支持/)
  await assert.rejects(() => client.uploadPart('http://test.aliyundrive.net/upload', source, 0, 9), /地址不受支持/)
})

test('真实 Axios 分片请求保持签名所需的空类型头，发送正确字节且不附带认证', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cloud-part-http-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'backup.sql')
  fs.writeFileSync(source, '0123456789')
  let received
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    received = { method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() }
    const signatureMatches = req.headers['content-type'] === ''
    res.writeHead(signatureMatches ? 200 : 403)
    res.end(signatureMatches ? '' : '<Error><Code>SignatureDoesNotMatch</Code></Error>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: axios.create({
    // 保留真实 Axios 请求转换与 Node 序列化，只将测试流量送到本机接收端。
    proxy: false, maxRedirects: 0,
    transport: { request: (options, callback) => http.request({
      hostname: '127.0.0.1', port: server.address().port, method: options.method,
      path: options.path, headers: options.headers
    }, callback) }
  }) })
  await client.uploadPart('https://test.aliyundrive.net/upload?signature=synthetic', source, 2, 7)
  assert.equal(received.method, 'PUT')
  assert.equal(received.body, '234567')
  assert.equal(received.headers['content-length'], '6')
  assert.equal(received.headers['content-type'], '')
  assert.equal(received.headers.authorization, undefined)
  assert.equal(received.headers.cookie, undefined)
  assert.equal(received.headers['x-csrf-token'], undefined)
})

test('分片签名与权限错误不盲目重试，会话失效可重建，临时故障可重试且响应脱敏', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cloud-part-errors-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'backup.sql')
  fs.writeFileSync(source, 'synthetic')
  const cases = [
    { status: 403, code: 'SignatureDoesNotMatch', message: /签名校验/, retryable: false },
    { status: 403, code: 'AccessDenied', message: /拒绝分片/, retryable: false },
    { status: 403, code: 'RequestTimeTooSkewed', message: /校准服务器时间/, retryable: false },
    { status: 404, code: 'NoSuchUpload', message: /会话已失效/, retryable: false, expired: true },
    { status: 409, code: 'PartAlreadyExist', message: /分片已存在/, retryable: false },
    { status: 403, code: 'RequestExpired', message: /地址已过期/, retryable: true },
    { status: 429, code: 'SlowDown', message: /HTTP 429/, retryable: true },
    { status: 503, code: 'ServiceUnavailable', message: /HTTP 503/, retryable: true },
    { status: 400, code: 'InvalidArgument', message: /分片参数/, retryable: false },
    { status: 400, code: TEST_TOKEN, message: /HTTP 400/, retryable: false }
  ]
  for (const sample of cases) {
    const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
      async put() { return { status: sample.status, data: `<Error><Code>${sample.code}</Code><Message>${TEST_TOKEN}</Message><StringToSign>https://test.aliyundrive.net/?signature=secret</StringToSign></Error>` } }
    } })
    await assert.rejects(() => client.uploadPart('https://test.aliyundrive.net/upload', source, 0, 8), error => {
      assert.match(error.message, sample.message)
      assert.equal(error.retryable, sample.retryable)
      assert.equal(error.uploadSessionExpired, sample.expired === true)
      assert.equal(JSON.stringify(error).includes(TEST_TOKEN), false)
      assert.equal(error.message.includes('signature='), false)
      return true
    })
  }
  for (const [code, message, retryable] of [['ETIMEDOUT', /超时/, true], ['ECONNRESET', /网络异常/, true], ['EACCES', /读取本地/, false]]) {
    const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
      async put() { throw Object.assign(new Error(TEST_TOKEN), { code }) }
    } })
    await assert.rejects(() => client.uploadPart('https://test.aliyundrive.net/upload', source, 0, 8), error => {
      assert.match(error.message, message)
      assert.equal(error.retryable, retryable)
      assert.equal(error.message.includes(TEST_TOKEN), false)
      return true
    })
  }
})

test('已接收但未保存断点的分片按大小和 ETag 核验，匹配才继续，不重复记为失败', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cloud-part-resume-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const source = path.join(root, 'backup.sql')
  const content = Buffer.from('synthetic backup data')
  fs.writeFileSync(source, content)
  const etag = crypto.createHash('md5').update(content).digest('hex').toUpperCase()
  for (const mode of ['matching', 'conflict', 'wrong-hash', 'wrong-size', 'missing']) {
    let completed = false, puts = 0, pages = 0
    const checkpoints = []
    const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
      async put(_url, stream) {
        for await (const chunk of stream) assert.deepEqual(chunk, content)
        puts++
        return { status: 409, data: '<Error><Code>PartAlreadyExist</Code></Error>' }
      }
    } })
    client.target = async () => ({ driveId: 'drive', folderId: 'folder' })
    client.request = async (endpoint, body) => {
      if (endpoint === '/v2/file/get_upload_url') return { part_info_list: [{ part_number: 1, upload_url: 'https://test.aliyundrive.net/upload' }] }
      if (endpoint === '/adrive/v2/file/createWithFolders') return { file_id: 'remote', upload_id: 'session' }
      if (endpoint === '/v2/file/list_uploaded_parts') {
        pages++
        if (!body.part_number_marker) return { uploaded_parts: [], next_part_number_marker: 'next-page' }
        assert.equal(body.part_number_marker, 'next-page')
        return { uploaded_parts: mode === 'missing' ? [] : [{ part_number: 1,
          part_size: mode === 'wrong-size' ? content.length + 1 : content.length,
          etag: mode === 'wrong-hash' ? '0'.repeat(32) : `"${etag}"`
        }], next_part_number_marker: '' }
      }
      assert.equal(endpoint, '/v2/file/complete')
      completed = true
      return { file_id: 'remote', size: content.length }
    }
    const upload = client.upload({ filename: 'backup.sql', filePath: source, size: content.length,
      session: mode === 'conflict' ? null : { driveId: 'drive', fileId: 'remote', uploadId: 'session', nextPart: 1, partSize: 16 * 1024 * 1024 },
      checkpoint: session => checkpoints.push({ ...session }), progress() {}
    })
    if (['matching', 'conflict'].includes(mode)) {
      assert.equal((await upload).fileId, 'remote')
      assert.equal(completed, true)
      assert.equal(checkpoints.at(-1).nextPart, 2)
    } else {
      await assert.rejects(() => upload, /无法核对内容|内容不一致/)
      assert.equal(completed, false)
      assert.deepEqual(checkpoints, [])
    }
    assert.equal(puts, ['conflict', 'missing'].includes(mode) ? 1 : 0)
    assert.equal(pages, mode === 'missing' ? 4 : 2)
  }
})

test('云盘错误不包含 Token、签名 URL 或第三方响应体', async () => {
  const client = new AliyunDriveClient({ config: {}, persistToken() {}, http: {
    async post() { return { status: 401, data: { code: 'AccessTokenInvalid', message: TEST_TOKEN } } }
  } })
  await assert.rejects(() => client.json('https://example.invalid', {}), error => {
    assert.equal(error.message.includes(TEST_TOKEN), false)
    return error.expired === true
  })
  const controller = new CloudBackupController({ saveSettings() { throw new Error(TEST_TOKEN) } })
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  controller.saveSettings({ body: {} }, res)
  assert.equal(res.statusCode, 500)
  assert.equal(JSON.stringify(res.body).includes(TEST_TOKEN), false)
})

test('旧版单账户状态兼容迁移，保留授权、目标、任务及分片断点且脱敏', async t => {
  const { service, repository } = await fixture(t)
  const state = repository.read()
  const account = state.accounts[0]
  repository.write({ version: 1, config: { ...account, enabled: true }, tasks: [
    { id: 'legacy-task', filename, revision: account.revision, status: 'retrying', session: { uploadId: 'same-upload', nextPart: 2 } }
  ] })
  const migrated = repository.read()
  assert.equal(migrated.version, 2)
  assert.equal(migrated.accounts[0].name, '默认网盘')
  assert.equal(migrated.accounts[0].token, account.token)
  assert.equal(migrated.accounts[0].revision, account.revision)
  assert.equal(migrated.tasks[0].accountId, migrated.config.accountId)
  assert.equal(migrated.tasks[0].session.uploadId, 'same-upload')
  assert.equal(service.getTasks()[0].status, 'retrying')
  const publicSettings = JSON.stringify(service.getSettings())
  assert.equal(publicSettings.includes(account.token), false)
  assert.equal(publicSettings.includes(account.deviceKey), false)
})

test('命名账户保存、选择与浏览相互隔离，轮换凭据只更新对应账户', async t => {
  const { decryptConfigSecret } = require('../src/utils/config-secret-crypto')
  const clients = []
  const { service, repository } = await fixture(t, options => {
    const client = { options, async drives() { return { drives: [{ id: 'drive', name: '资源库' }], defaultDriveId: 'drive' } },
      async directory(driveId, folderId) { return { driveId, folderId, folderName: '云端目录' } },
      async files() { return { items: [{ id: options.config.refreshToken, type: 'folder' }] } },
      async upload() { return { fileId: 'same-file', driveId: 'drive' } },
      async file() { return { type: 'file' } }, async trashFile() {} }
    clients.push(client)
    return client
  })
  const original = service.getSettings()
  await service.connect({ accountId: original.accountId })
  const identified = repository.read()
  assert.equal(identified.accounts[0].driveName, '资源库')
  assert.equal(identified.accounts[0].driveId, '', '补全展示盘名不改变上传目标')
  const originalRevision = identified.accounts[0].revision
  const secondToken = 'synthetic-second-account-token'
  const second = service.saveAccount({ name: ' 自己的网盘 ', token: secondToken })
  assert.equal(second.name, '自己的网盘')
  assert.equal(service.getSettings().accountId, original.accountId, '新增账户不切换存储目标')
  assert.equal(service.getSettings().enabled, true)
  assert.throws(() => service.saveAccount({ name: '自己的网盘', token: TEST_TOKEN }), error => error.statusCode === 409)
  assert.throws(() => service.saveAccount({ name: '', token: TEST_TOKEN }), error => error.statusCode === 400)
  assert.throws(() => service.saveAccount({ name: 'x\ny', token: TEST_TOKEN }), error => error.statusCode === 400)
  const connection = await service.connect({ accountId: second.id })
  assert.equal(connection.accountId, second.id)
  assert.equal(connection.settings.accountId, original.accountId)
  assert.equal(repository.read().accounts[0].revision, originalRevision)
  assert.equal((await service.browse({ accountId: second.id, driveId: 'drive' })).items[0].id, secondToken)
  assert.equal(service.getSettings().accountId, original.accountId)
  const secondClient = clients.find(client => client.options.config.refreshToken === secondToken)
  secondClient.options.persistToken('synthetic-second-rotated-token')
  const state = repository.read()
  assert.equal(decryptConfigSecret(state.accounts[0].token), TEST_TOKEN)
  assert.equal(decryptConfigSecret(state.accounts[1].token), 'synthetic-second-rotated-token')
  service.saveAccount({ name: '网盘改名' }, second.id)
  assert.equal(decryptConfigSecret(repository.read().accounts[1].token), 'synthetic-second-rotated-token')
  await service.tick()
  const firstTask = service.getTasks()[0]
  service.saveSettings({ accountId: second.id, enabled: true, driveId: 'drive', folderId: 'second-target' })
  await service.tick()
  assert.equal(service.getTasks()[0].accountId, second.id)
  assert.equal(repository.read().tasks.length, 2)
  await service.trashFile('drive', 'same-file', second.id)
  assert.equal(repository.read().tasks.find(task => task.id === firstTask.id).status, 'success', '同名远端 ID 不影响其他账户任务')
  assert.equal(service.getTasks()[0].status, 'invalid')
  await assert.rejects(() => service.connect({ accountId: 'missing' }), error => error.statusCode === 404)
  await assert.rejects(() => service.browse({ accountId: [], driveId: 'drive' }), error => error.statusCode === 400)
  assert.equal(JSON.stringify(service.getAccounts()).includes('synthetic-'), false)
})

test('账户切换和授权替换受待上传任务保护，上传中浏览不复用其他账户客户端', async t => {
  let resolveUpload, entered
  const started = new Promise(resolve => { entered = resolve })
  const { service } = await fixture(t, options => ({
    async upload() { entered(); return new Promise(resolve => { resolveUpload = resolve }) },
    async drives() { return { drives: [{ id: options.config.deviceId, name: '当前账户' }], defaultDriveId: options.config.deviceId } },
    async directory(driveId, folderId) { return { driveId, folderId, folderName: '上传目标已改名' } }
  }))
  const first = service.getSettings().accountId
  const second = service.saveAccount({ name: '另一个账户', token: 'synthetic-other-account-token' })
  service.enqueue(filename)
  assert.throws(() => service.saveSettings({ accountId: second.id, enabled: true, driveId: 'drive', folderId: 'target' }), error => error.statusCode === 409)
  assert.throws(() => service.saveAccount({ name: '新授权', token: 'synthetic-replacement-token' }, first), error => error.statusCode === 409)
  const uploading = service.tick()
  await started
  try {
    const refreshed = await service.connect({ accountId: first })
    assert.equal(refreshed.accountId, first)
    assert.equal(refreshed.directory.folderName, '上传目标已改名')
    await assert.rejects(() => service.connect({ accountId: second.id }), error => error.statusCode === 409)
  } finally { resolveUpload({ fileId: 'remote' }); await uploading }
  service.saveAccount({ name: '更换授权', token: 'synthetic-replacement-token' }, first)
  assert.equal(service.getSettings().enabled, false)
  assert.equal(service.getSettings().folderId, '', '新授权不沿用旧账户目录')
})

test('连接按已保存 ID 同步云端名称，保留轮换授权、任务进度及目标版本，不重复上传', async t => {
  const { decryptConfigSecret } = require('../src/utils/config-secret-crypto')
  const calls = []
  let name = '云端改名后', uploads = 0
  const { service, repository } = await fixture(t, options => ({
    async drives() { return { drives: [{ id: 'drive', name: '资源库' }], defaultDriveId: 'drive' } },
    async directory(driveId, folderId) {
      calls.push({ driveId, folderId })
      options.persistToken('synthetic-name-refresh-rotated-token')
      const state = repository.read()
      state.tasks[0].updatedAt = '2026-11-10T11:00:00.000Z'
      repository.write(state)
      return { driveId, folderId, folderName: name }
    },
    async upload() { uploads++; return { fileId: 'uploaded-file', driveId: 'drive' } }
  }))
  service.saveSettings({ enabled: true, driveId: 'drive', folderId: 'target-folder', folderName: '旧名称' })
  await service.tick()
  const before = repository.read()
  const result = await service.connect()
  const after = repository.read()
  assert.deepEqual(calls, [{ driveId: 'drive', folderId: 'target-folder' }])
  assert.deepEqual(result.directory, { driveId: 'drive', folderId: 'target-folder', folderName: name, driveName: '资源库' })
  assert.equal(result.settings.folderName, name)
  assert.equal(after.accounts[0].folderName, name)
  assert.equal(after.accounts[0].revision, before.accounts[0].revision)
  assert.equal(after.accounts[0].driveId, 'drive')
  assert.equal(after.accounts[0].folderId, 'target-folder')
  assert.equal(decryptConfigSecret(after.accounts[0].token), 'synthetic-name-refresh-rotated-token')
  assert.deepEqual(after.config, before.config)
  assert.deepEqual(after.tasks, before.tasks.map(task => ({ ...task, updatedAt: '2026-11-10T11:00:00.000Z' })))
  name = '再次改名'
  assert.equal((await service.connect()).directory.folderName, name)
  await service.tick()
  assert.equal(uploads, 1)
})

test('刷新预览账户的名称不切换储存账户，根目录及未选目标正确返回', async t => {
  let reads = 0
  const { service, repository } = await fixture(t, () => {
    const client = new AliyunDriveClient({ config: {}, persistToken() {} })
    client.drives = async () => ({ drives: [{ id: 'resource', name: '资源库' }], defaultDriveId: 'resource' })
    client.file = async () => { reads++; return { type: 'folder', name: '第二账户最新名称' } }
    return client
  })
  const first = service.getSettings().accountId
  const second = service.saveAccount({ name: '预览账户', token: 'synthetic-preview-account-token' })
  const state = repository.read()
  Object.assign(state.accounts[1], { driveId: 'resource', folderId: 'second-target', folderName: '第二账户旧名' })
  repository.write(state)
  const result = await service.connect({ accountId: second.id })
  assert.equal(result.directory.folderName, '第二账户最新名称')
  assert.equal(result.settings.accountId, first)
  assert.equal(result.settings.folderName, '')
  assert.equal(result.settings.enabled, true)
  assert.equal(repository.read().accounts[1].folderName, '第二账户最新名称')
  service.saveSettings({ accountId: second.id, driveId: 'resource', folderId: 'root', enabled: false })
  const root = await service.connect({ accountId: second.id })
  assert.equal(root.directory.folderName, '根目录')
  assert.equal(reads, 1, '根目录不调用文件详情接口')
  service.saveSettings({ accountId: second.id, driveId: '', folderId: '', enabled: false })
  const empty = await service.connect({ accountId: second.id })
  assert.equal(empty.directory, null)
  assert.equal(empty.directoryError, '')
  assert.equal(reads, 1, '未选择目录无需额外请求')
})

test('目标目录不可用时保留原名称并返回提示，仍能浏览云盘重新选目录', async t => {
  const { service, repository } = await fixture(t, () => ({
    async drives() { return { drives: [{ id: 'drive', name: '资源库' }], defaultDriveId: 'drive' } },
    async directory() { throw new CloudUploadError('不应回传的第三方响应') },
    async files() { return { items: [], nextMarker: '' } }
  }))
  service.saveSettings({ enabled: true, driveId: 'drive', folderId: 'target-folder', folderName: '原名称' })
  const before = repository.read()
  const result = await service.connect()
  assert.equal(result.directory, null)
  assert.match(result.directoryError, /读取备份目录失败/)
  assert.equal(JSON.stringify(result).includes('不应回传'), false)
  assert.deepEqual(repository.read(), before)
  assert.deepEqual((await service.browse({ driveId: 'drive' })).items, [])
})

test('读取名称期间目标发生变更，不把旧目录的名称写入新配置', async t => {
  const { service, repository } = await fixture(t, () => ({
    async drives() { return { drives: [{ id: 'drive', name: '资源库' }], defaultDriveId: 'drive' } },
    async directory(driveId, folderId) {
      const state = repository.read()
      Object.assign(state.accounts[0], { folderId: 'changed-target', folderName: '新目标名称', revision: 'changed-revision' })
      repository.write(state)
      return { driveId, folderId, folderName: '迟到旧名称' }
    }
  }))
  await assert.rejects(() => service.connect(), error => error.statusCode === 409)
  const account = repository.read().accounts[0]
  assert.equal(account.folderId, 'changed-target')
  assert.equal(account.folderName, '新目标名称')
  assert.equal(account.revision, 'changed-revision')
})

test('自动扫描覆盖新增格式及子目录，等待文件稳定、保留层级，排除内部凭据、临时文件和符号链接', async t => {
  const uploaded = [], folders = []
  const { service, root, advance } = await fixture(t, () => ({
    async upload(input) { uploaded.push(input); return { fileId: input.filename } },
    async target() { return { driveId: 'drive', folderId: 'target-folder' } },
    async files() { return { items: [], nextMarker: '' } },
    async createFolder(_drive, _parent, name) { folders.push(name); return { folderId: `folder-${name}` } }
  }))
  fs.writeFileSync(path.join(root, 'future-rule.json'), '{"version":1}')
  fs.mkdirSync(path.join(root, 'reports'))
  fs.writeFileSync(path.join(root, 'reports', 'report.csv'), 'synthetic,data')
  fs.writeFileSync(path.join(root, '.secret'), TEST_TOKEN)
  fs.writeFileSync(path.join(root, 'unfinished.tar.tmp'), 'partial')
  fs.mkdirSync(path.join(root, 'backup_20261110_142759'))
  fs.writeFileSync(path.join(root, 'backup_20261110_142759', 'cloudsql.sql'), 'partial')
  fs.symlinkSync(path.join(root, 'reports'), path.join(root, 'linked-directory'))
  fs.symlinkSync(path.join(root, 'future-rule.json'), path.join(root, 'linked-file'))
  await service.tick()
  assert.equal(service.getTasks().length, 1)
  advance(30_000)
  fs.appendFileSync(path.join(root, 'future-rule.json'), '\n')
  await service.tick()
  advance(30_000)
  await service.tick()
  assert.equal(service.getTasks().some(task => task.filename === 'future-rule.json'), false)
  assert.equal(service.getTasks().find(task => task.filename === 'reports/report.csv').status, 'success')
  assert.deepEqual(folders, ['reports'])
  const nested = uploaded.find(input => input.filename === 'report.csv')
  assert.equal(nested.directory.folderId, 'folder-reports')
  advance(30_000)
  await service.tick()
  assert.equal(service.getTasks().find(task => task.filename === 'future-rule.json').status, 'success')
  assert.equal(service.getTasks().length, 3)
  for (const name of ['../secret', '.cloud/state.json', '.secret', 'unfinished.tar.tmp', 'reports/../../secret', 'linked-directory/report.csv', 'linked-file']) {
    assert.throws(() => service.enqueue(name), error => error.statusCode === 400)
  }
})

test('回收站恢复和彻底删除核对真实结果，兼容 204 及异步任务，不删除正常文件', async () => {
  let trashed = true, missing = false, taskCalls = 0, deletes = 0, restores = 0
  const client = new AliyunDriveClient({ config: {}, persistToken() {}, wait: async () => {}, http: {
    async post(url) {
      if (url.endsWith('/v2/file/get')) return missing
        ? { status: 404, data: { code: 'NotFound.FileId' } }
        : { status: 200, data: { file_id: 'file', type: 'file', status: 'available', trashed, size: 100 } }
      if (url.endsWith('/v2/recyclebin/restore')) { restores++; trashed = false; return { status: 204, data: '' } }
      if (url.endsWith('/v3/file/delete')) { deletes++; return { status: 202, data: { task_id: 'synthetic-task' } } }
      assert.ok(url.endsWith('/v3/async_task/get'))
      taskCalls++
      if (taskCalls === 2) missing = true
      return { status: 200, data: { state: taskCalls === 2 ? 'Succeed' : 'Running' } }
    }
  } })
  client.accessToken = 'synthetic-access'
  client.expiresAt = Date.now() + 3600_000
  assert.equal((await client.restoreFile('drive', 'file')).trashed, false)
  await client.restoreFile('drive', 'file')
  assert.equal(restores, 1, '重复恢复已正常的文件幂等返回')
  await assert.rejects(() => client.purgeFile('drive', 'file'), error => error.statusCode === 409)
  assert.equal(deletes, 0, '正常文件不能从永久删除入口删除')
  trashed = true
  await client.purgeFile('drive', 'file')
  assert.equal(deletes, 1)
  assert.equal(taskCalls, 2)
  await assert.rejects(() => client.restoreFile('drive', 'root'), /根目录/)
})

test('回收站处理未完成、云端未确认或恢复同名冲突时不误报成功，错误脱敏', async () => {
  for (const mode of ['still-trashed', 'restore-conflict', 'delete-not-applied', 'task-failed', 'task-pending']) {
    const client = new AliyunDriveClient({ config: {}, persistToken() {}, wait: async () => {} })
    let mutationCalls = 0
    client.request = async endpoint => {
      if (endpoint === '/v2/file/get') return { file_id: 'file', type: 'file', status: 'available', trashed: true }
      if (endpoint === '/v3/async_task/get') return { state: mode === 'task-failed' ? 'Failed' : 'Running' }
      mutationCalls++
      if (mode === 'restore-conflict') {
        return client.json('https://synthetic.invalid', {})
      }
      return mode.startsWith('task-') ? { task_id: 'synthetic-task' } : {}
    }
    client.http = { async post() { return { status: 409, data: { code: 'AlreadyExist.File', message: TEST_TOKEN } } } }
    const operation = mode.startsWith('restore') || mode === 'still-trashed' ? 'restoreFile' : 'purgeFile'
    await assert.rejects(() => client[operation]('drive', 'file'), error => {
      assert.equal(error.statusCode, 409)
      assert.equal(error.message.includes(TEST_TOKEN), false)
      return true
    })
    assert.equal(mutationCalls, 1)
  }
})

test('恢复与永久删除同步本账户备份状态、保留本地文件及轮换凭据，上传时拒绝操作', async t => {
  let trashed = false, size = 0, purges = 0
  const { service, root, repository } = await fixture(t, options => ({
    async upload(input) { size = input.size; return { fileId: 'remote-file', driveId: 'drive' } },
    async file() { return { type: 'file', trashed, size } },
    async trashFile() { trashed = true },
    async restoreFile() { trashed = false; return { type: 'file', trashed, size } },
    async purgeFile() { purges++; options.persistToken('synthetic-rotated-after-purge') }
  }))
  await service.tick()
  await service.trashFile('drive', 'remote-file')
  assert.equal(service.getTasks()[0].status, 'invalid')
  await service.restoreFile('drive', 'remote-file')
  assert.equal(service.getTasks()[0].status, 'success')
  assert.equal(service.getTasks()[0].progress, 100)
  await assert.rejects(() => service.purgeFile('drive', 'remote-file'), error => error.statusCode === 409)
  assert.equal(purges, 0)
  await service.trashFile('drive', 'remote-file')
  const originalSize = size
  size++
  await service.restoreFile('drive', 'remote-file')
  assert.equal(service.getTasks()[0].status, 'invalid', '大小不匹配的历史备份不标为成功')
  size = originalSize
  trashed = true
  const state = repository.read()
  state.tasks.push({ id: 'unrelated-account', accountId: 'another-account', status: 'success', remote: { driveId: 'drive', fileId: 'remote-file' } })
  repository.write(state)
  await service.purgeFile('drive', 'remote-file')
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.match(service.getTasks()[0].error, /云端已删除/)
  assert.equal(repository.read().tasks.find(task => task.id === 'unrelated-account').status, 'success')
  assert.equal(fs.existsSync(path.join(root, filename)), true)
  const { decryptConfigSecret } = require('../src/utils/config-secret-crypto')
  assert.equal(decryptConfigSecret(repository.read().accounts[0].token), 'synthetic-rotated-after-purge')
  service.running = true
  try {
    for (const method of ['restoreFile', 'purgeFile']) {
      await assert.rejects(() => service[method]('drive', 'remote-file'), error => error.statusCode === 409)
      await assert.rejects(() => service[method]('../drive', 'file'), error => error.statusCode === 400)
      await assert.rejects(() => service[method]('drive', 'root'), error => error.statusCode === 400)
    }
  } finally { service.running = false }
})

test('目录恢复及彻底删除不受无关已删除历史目录阻断，只同步已核实归属的任务', async t => {
  const { service, root, repository } = await fixture(t, () => ({
    async restoreFile() { return { type: 'folder', trashed: false } },
    async containsFolder(_drive, folder, ancestor) {
      if (folder === 'missing-history') throw new CloudUploadError('历史目录已删除', false, 404)
      return folder === ancestor
    },
    async file(_drive, id) {
      return id === 'restored-folder' ? { type: 'folder', trashed: true }
        : { type: 'file', size: fs.statSync(path.join(root, filename)).size, trashed: false }
    },
    async purgeFile() {}
  }))
  const state = repository.read()
  const tracked = { accountId: state.config.accountId, revision: state.accounts[0].revision,
    status: 'failed', error: '云端文件已移入回收站，可手动重新上传',
    size: fs.statSync(path.join(root, filename)).size, filename }
  state.tasks.push({ ...tracked, id: 'restored-backup', remote: { driveId: 'drive', folderId: 'restored-folder', fileId: 'remote-backup' } },
    { ...tracked, id: 'unrelated-history', remote: { driveId: 'drive', folderId: 'missing-history', fileId: 'missing-file' } })
  repository.write(state)
  await service.restoreFile('drive', 'restored-folder')
  assert.equal(repository.read().tasks.find(task => task.id === 'restored-backup').status, 'success')
  assert.equal(repository.read().tasks.find(task => task.id === 'unrelated-history').status, 'failed')
  await service.purgeFile('drive', 'restored-folder')
  assert.match(repository.read().tasks.find(task => task.id === 'restored-backup').error, /云端已删除/)
  assert.match(repository.read().tasks.find(task => task.id === 'unrelated-history').error, /移入回收站/)
})

test('云端直接删除及恢复自动核验，文件失效与上传失败分开，不重复上传', async t => {
  let trashed = false, missing = false, size, uploads = 0, reads = 0
  const { service, repository, advance } = await fixture(t, () => ({
    async upload(input) { uploads++; size = input.size; return { driveId: 'drive', fileId: 'remote-file' } },
    async file() {
      reads++
      if (missing) throw new CloudUploadError('找不到文件', false, 404)
      return { type: 'file', trashed, size }
    }
  }))
  await service.tick()
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks()[0].status, 'success')
  trashed = true
  advance(60_000)
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.equal(service.getTasks()[0].error, '该文件云端已删除，可重新上传！')
  assert.equal(service.getTasks()[0].progress, 0)
  await service.tick()
  assert.equal(uploads, 1, '删除后不由自动扫描重新上传')
  const before = reads
  await service.refreshRemoteTasks()
  assert.equal(reads, before, '每个文件一分钟内不重复核验')
  trashed = false
  advance(60_000)
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks()[0].status, 'success')
  assert.equal(service.getTasks()[0].progress, 100)
  assert.equal(service.getTasks()[0].error, '')
  missing = true
  advance(60_000)
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.equal(repository.read().tasks[0].remote.fileId, 'remote-file')
  service.enqueue(filename)
  await service.tick()
  assert.equal(uploads, 2, '文件失效仍可手动重新上传')
})

test('旧删除失败记录兼容显示为文件失效，外部恢复后核对大小，保留轮换授权', async t => {
  const { decryptConfigSecret } = require('../src/utils/config-secret-crypto')
  let size, actualSize
  const { service, repository, advance } = await fixture(t, options => ({
    async upload(input) { size = input.size; actualSize = size; return { driveId: 'drive', fileId: 'remote-file' } },
    async file() { options.persistToken('synthetic-status-check-rotated-token'); return { type: 'file', size: actualSize, trashed: false } }
  }))
  await service.tick()
  const state = repository.read()
  Object.assign(state.tasks[0], { status: 'failed', error: '云端文件已移入回收站，可手动重新上传', progress: 0 })
  state.tasks.push({ ...state.tasks[0], id: 'upload-error', status: 'failed', error: '云盘网络请求失败' },
    { ...state.tasks[0], id: 'other-account', accountId: 'another-account' })
  repository.write(state)
  assert.equal(service.getTasks().find(task => task.id === state.tasks[0].id).status, 'invalid')
  assert.equal(service.getTasks().find(task => task.id === 'upload-error').status, 'failed')
  actualSize++
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks().find(task => task.id === state.tasks[0].id).status, 'invalid')
  assert.match(service.getTasks().find(task => task.id === state.tasks[0].id).error, /不一致/)
  actualSize = size
  advance(60_000)
  await service.refreshRemoteTasks()
  const current = repository.read()
  assert.equal(current.tasks[0].status, 'success')
  assert.equal(current.tasks.find(task => task.id === 'other-account').status, 'failed')
  assert.equal(current.tasks.find(task => task.id === 'upload-error').status, 'failed')
  assert.equal(decryptConfigSecret(current.accounts[0].token), 'synthetic-status-check-rotated-token')
})

test('授权、网络或文件处理中不误判删除；后台核验去重和失败退避', async t => {
  let reads = 0, responseError = new CloudUploadError('授权失效', false, 409)
  const { service, advance } = await fixture(t, () => ({
    async upload() { return { driveId: 'drive', fileId: 'remote-file' } },
    async file() { reads++; throw responseError }
  }))
  await service.tick()
  for (const error of [responseError, new CloudUploadError('网络故障', true), new CloudUploadError('文件处理中', false, 409)]) {
    responseError = error
    service.requestStatusRefresh()
    const pending = service.statusRefresh
    service.requestStatusRefresh()
    await pending
    assert.equal(service.getTasks()[0].status, 'success')
    assert.equal(service.getTasks()[0].error, '')
    const before = reads
    service.requestStatusRefresh()
    assert.equal(reads, before)
    advance(60_000)
  }
  assert.equal(reads, 3)
})

test('云端详情缺少有效大小时保留原状态，不误判失效或恢复成功', async t => {
  let metadata = {}
  const { service, repository, advance } = await fixture(t, () => ({
    async upload() { return { driveId: 'drive', fileId: 'remote-file' } },
    async file() { return { type: 'file', trashed: false, ...metadata } }
  }))
  await service.tick()
  for (const size of [undefined, null, '20', NaN]) {
    metadata = { size }
    advance(60_000)
    await service.refreshRemoteTasks()
    assert.equal(service.getTasks()[0].status, 'success')
  }
  const state = repository.read()
  Object.assign(state.tasks[0], { status: 'invalid', error: '该文件云端已删除，可重新上传！', progress: 0 })
  repository.write(state)
  metadata = {}
  advance(60_000)
  await service.refreshRemoteTasks()
  assert.equal(service.getTasks()[0].status, 'invalid')
  assert.equal(service.getTasks()[0].error, '该文件云端已删除，可重新上传！')
})

test('核验迟到响应不覆盖手动重传任务', async t => {
  let release, entered
  const started = new Promise(resolve => { entered = resolve })
  const { service, repository } = await fixture(t, () => ({
    async upload(input) { return { driveId: 'drive', fileId: 'remote-file', size: input.size } },
    async file() { entered(); return new Promise(resolve => { release = resolve }) }
  }))
  await service.tick()
  const pending = service.refreshRemoteTasks()
  await started
  try {
    const state = repository.read()
    Object.assign(state.tasks[0], { status: 'queued', attempts: 0, error: '', progress: 0 })
    repository.write(state)
  } finally { release({ type: 'file', trashed: true }); await pending }
  assert.equal(repository.read().tasks[0].status, 'queued')
  assert.equal(repository.read().tasks[0].error, '')
})
