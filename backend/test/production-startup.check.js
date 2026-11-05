'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  PRODUCTION_RUNTIME_ENV,
  configureProductionEnvironment
} = require('../start-production')
const { PRODUCTION_RUNTIME_FILES } = require('../src/config/runtime-files')
const ecosystem = require('../ecosystem.production.config')

test('生产启动入口固定使用生产环境文件且不继承开发配置', () => {
  const env = {
    NODE_ENV: 'development',
    ENV_FILE: '.env',
    PORT: '5176'
  }

  configureProductionEnvironment(env)

  assert.deepEqual(env, PRODUCTION_RUNTIME_ENV)
})

test('生产 PM2 配置复用生产启动入口并关闭文件监听', () => {
  const [app] = ecosystem.apps

  assert.equal(app.name, 'backend')
  assert.equal(app.script, './start-production.js')
  assert.equal(app.cwd, path.resolve(__dirname, '..'))
  assert.equal(app.watch, false)
  assert.deepEqual(app.env, PRODUCTION_RUNTIME_ENV)
  assert.deepEqual(app.env_production, PRODUCTION_RUNTIME_ENV)
})

test('运行文件清单只保留唯一生产 PM2 配置', () => {
  assert.deepEqual(PRODUCTION_RUNTIME_FILES, [
    'server.js',
    'start-production.js',
    'ecosystem.production.config.js'
  ])
  assert.equal(PRODUCTION_RUNTIME_FILES.includes('ecosystem.config.js'), false)
  assert.equal(PRODUCTION_RUNTIME_FILES.includes('ecosystem.production.js'), false)
  assert.equal(fs.existsSync(path.resolve(__dirname, '../ecosystem.config.js')), false)
  assert.equal(fs.existsSync(path.resolve(__dirname, '../ecosystem.production.js')), false)
  assert.equal(fs.existsSync(path.resolve(__dirname, '../restart.sh')), false)
  assert.equal(fs.existsSync(path.resolve(__dirname, '../../ecosystem.config.js')), false)
})
