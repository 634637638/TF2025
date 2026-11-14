'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { assertSingleInstance } = require('../src/config/instance-boundary')
const pm2 = require('../ecosystem.production.config')

test('生产配置固定单实例 fork，明确拒绝 PM2/cluster/声明并发扩容', () => {
  assert.equal(pm2.apps[0].instances, 1)
  assert.equal(pm2.apps[0].exec_mode, 'fork')
  assert.doesNotThrow(() => assertSingleInstance({ NODE_ENV: 'production', NODE_APP_INSTANCE: '0', instances: '1' }, false))
  for (const extra of [{ NODE_APP_INSTANCE: '1' }, { instances: '2' }, { instances: 'max' }, { exec_mode: 'cluster_mode' }, { WEB_CONCURRENCY: '2' }, { PM2_INSTANCES: '4' }]) {
    assert.throws(() => assertSingleInstance({ NODE_ENV: 'production', ...extra }, false), /仅支持生产单实例/)
  }
  assert.throws(() => assertSingleInstance({ NODE_ENV: 'production' }, true), /仅支持生产单实例/)
  assert.doesNotThrow(() => assertSingleInstance({ NODE_ENV: 'test', WEB_CONCURRENCY: '4' }, true))
})
