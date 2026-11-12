'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('项目配置按前后端归位，根目录不再保留 config', () => {
  const projectRoot = path.resolve(__dirname, '../..')
  assert.equal(fs.existsSync(path.join(projectRoot, 'config')), false, '请将配置按所属端归入 backend 或 frontend')
  for (const legacy of ['.eslintrc.js', 'build.sh', 'start-dev-https.sh', 'nginx-backend.conf', 'nginx-frontend.conf', 'nginx-config-for-vue-router.conf']) {
    assert.equal(fs.existsSync(path.join(projectRoot, legacy)), false, `根目录不再保留旧入口 ${legacy}`)
  }
  for (const file of ['backend/deploy/nginx.conf', 'frontend/deploy/nginx.conf', 'frontend/scripts/start-dev-https.sh']) {
    assert.ok(fs.existsSync(path.join(projectRoot, file)), `缺少归位后的入口 ${file}`)
  }
  for (const file of [
    'backend/src/config/reminder-policy.json',
    'backend/scripts/config/field-contracts.json',
    'backend/scripts/config/backend-security-audit.json',
    'backend/scripts/config/backend-route-architecture.json',
    'frontend/scripts/runtime-pattern-audit.json',
    'frontend/scripts/reference-options-audit-allowlist.json'
  ]) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(projectRoot, file), 'utf8')), file)
  }
})

function deployment(t) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-runtime-assets-'))
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }))
  const backendRoot = path.join(temporaryRoot, 'backend')
  for (const relativePath of [
    'scripts/check-runtime-assets.js',
    'src/config/capability-registry.js',
    'src/config/module-permission-capabilities.json',
    'src/config/reminder-policy.json',
    'src/services/reminder.service.js'
  ]) {
    const destination = path.join(backendRoot, relativePath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(__dirname, '..', relativePath), destination)
  }
  const env = { ...process.env }
  delete env.TF2025_CONFIG_DIR
  return {
    root: backendRoot,
    policyPath: path.join(backendRoot, 'src/config/reminder-policy.json'),
    run: () => spawnSync(process.execPath, [path.join(backendRoot, 'scripts/check-runtime-assets.js')], {
      cwd: temporaryRoot, env, encoding: 'utf8', timeout: 10000
    })
  }
}

test('仅部署后端目录且从其他工作目录执行时，运行时配置检查通过', t => {
  const fixture = deployment(t)
  const result = fixture.run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /reminder-policy\.json/)
  assert.equal(fs.existsSync(path.resolve(fixture.root, '../config')), false)
})

test('缺少提醒策略时检查失败，提示同步后端配置目录', t => {
  const fixture = deployment(t)
  fs.unlinkSync(fixture.policyPath)
  const result = fixture.run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /CONFIG_MISSING/)
  assert.match(result.stderr, /backend\/src\/config/)
})

for (const value of ['{', 'null', '{}', '{"mandatory_hours":0}', '{"mandatory_hours":-1}', '{"mandatory_hours":"3"}']) {
  test(`无效提醒策略 ${value} 不能通过部署检查`, t => {
    const fixture = deployment(t)
    fs.writeFileSync(fixture.policyPath, value)
    const result = fixture.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /运行时资源检查失败/)
  })
}

test('提醒服务在独立后端发布目录中可加载，不依赖仓库根配置', t => {
  const fixture = deployment(t)
  // 数据库与 schema 使用禁止调用的替身，仅验证真实模块加载和配置文件解析。
  for (const [relativePath, source] of [
    ['src/core/db/connection.js', 'exports.withConnection = () => { throw new Error("禁止连接数据库") }'],
    ['src/config/database.js', 'exports.getDatabase = () => { throw new Error("禁止连接数据库") }'],
    ['src/utils/reminder-schema.js', 'exports.ensureReminderSchema = () => { throw new Error("禁止修改结构") }']
  ]) {
    const destination = path.join(fixture.root, relativePath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, source)
  }
  const result = spawnSync(process.execPath, ['-e',
    'const assert = require("node:assert/strict"); const service = require("./src/services/reminder.service"); assert.equal(typeof service.pending, "function")'
  ], { cwd: fixture.root, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
})
