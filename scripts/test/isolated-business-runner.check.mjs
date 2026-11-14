import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createIsolatedEnvironment, phases } from '../test-isolated-business.mjs'

test('隔离入口强制禁用云库、忽略继承凭据和业务环境文件，原环境不被改写', () => {
  const original = { DB_HOST: 'synthetic-host', DB_PASSWORD: 'synthetic-inert', DB_NAME: 'synthetic', TEST_DB_HOST: 'synthetic',
    JWT_SECRET: 'synthetic-inert', NODE_ENV: 'production', ENV_FILE: 'business-env', RUN_DB_TESTS: 'true',
    ERROR_ALERT_ENABLED: 'true', ERROR_ALERT_SMTP_HOST: 'synthetic', PATH: '/synthetic/bin' }
  const env = createIsolatedEnvironment(original, '/synthetic/isolated')
  assert.equal(env.RUN_DB_TESTS, 'false')
  assert.equal(env.NODE_ENV, 'test')
  assert.equal(env.ERROR_ALERT_ENABLED, 'false')
  assert.equal(env.ENV_FILE, '/synthetic/isolated/no-cloud-env')
  for (const key of ['DB_HOST', 'DB_PASSWORD', 'DB_NAME', 'TEST_DB_HOST', 'JWT_SECRET', 'ERROR_ALERT_SMTP_HOST']) assert.equal(env[key], undefined)
  assert.equal(original.RUN_DB_TESTS, 'true')
  assert.equal(env.PATH, original.PATH)
  for (const phase of phases) for (const arg of phase.args.filter(value => /\.(?:check\.js|spec\.ts)$/.test(value))) {
    assert.ok(existsSync(arg.startsWith('tests/') ? join('frontend', arg) : arg), `正式测试不存在：${arg}`)
  }
})
