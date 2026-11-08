'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { ScreenLockSettingsService, DEFAULT_SYSTEM_SETTINGS } = require('../src/services/screen-lock-settings.service')

test('屏幕锁设置文件不存在时写入默认值并规范化读取', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-screen-lock-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'nested', 'settings.json')
  const service = new ScreenLockSettingsService({ filePath, logger: { error() {} } })

  assert.deepEqual(await service.load(), DEFAULT_SYSTEM_SETTINGS)
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), DEFAULT_SYSTEM_SETTINGS)
  await service.save({ backgroundType: 'unknown', title: '  Custom  ', imageUrl: 7 })
  assert.deepEqual(await service.load(), {
    backgroundType: 'default', imageUrl: '', videoUrl: '', title: 'Custom', message: '请输入密码解锁'
  })
})

test('屏幕锁设置损坏时返回默认值，写入失败返回 false', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-screen-lock-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'settings.json')
  await fs.writeFile(filePath, '{invalid')
  const service = new ScreenLockSettingsService({ filePath, logger: { error() {} } })

  assert.deepEqual(await service.load(), DEFAULT_SYSTEM_SETTINGS)
  const failedWrite = new ScreenLockSettingsService({
    filePath: path.join(directory, 'missing', 'settings.json'),
    fileSystem: { async mkdir() { throw new Error('permission denied') }, async writeFile() { throw new Error('permission denied') } },
    logger: { error() {} }
  })
  assert.equal(await failedWrite.save(DEFAULT_SYSTEM_SETTINGS), false)
})
