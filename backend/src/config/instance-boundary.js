'use strict'

const cluster = require('node:cluster')

/** 现阶段含进程内安全计数，部署扩容必须先完成共享状态迁移。 */
function assertSingleInstance(env = process.env, isWorker = cluster.isWorker) {
  if (env.NODE_ENV !== 'production') return
  const configuredCounts = [env.WEB_CONCURRENCY, env.PM2_INSTANCES, env.instances].filter(value => value !== undefined && value !== '')
  const extraInstance = env.NODE_APP_INSTANCE !== undefined && env.NODE_APP_INSTANCE !== '' && env.NODE_APP_INSTANCE !== '0'
  if (isWorker || extraInstance || /cluster/i.test(env.exec_mode || '') || configuredCounts.some(value => String(value) !== '1')) {
    throw new Error('当前版本仅支持生产单实例 fork：缓存、登录安全计数和限流尚未全部共享，禁止直接扩容；参见部署文档 T9 边界')
  }
}

module.exports = { assertSingleInstance }
