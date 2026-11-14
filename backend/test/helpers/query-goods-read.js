'use strict'

const assert = require('node:assert/strict')

// 业务单元夹具只模拟只读事务控制；连接/快照生命周期由独立行为回归覆盖。
async function withReadConnection(operation, connection = {}) {
  const saved = new Map(['execute', 'beginTransaction', 'rollback', 'destroy'].map(key => [key, Object.getOwnPropertyDescriptor(connection, key)]))
  const execute = connection.execute
  Object.assign(connection, {
    async execute(sql, params) {
      if (sql === 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY') return []
      assert.equal(typeof execute, 'function', '业务SQL必须由原夹具处理')
      return execute.call(connection, sql, params)
    },
    async beginTransaction() {},
    async rollback() {},
    destroy() { assert.fail('正常查询不应销毁连接') }
  })
  try { return await operation(connection) }
  finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(connection, key, descriptor)
      else delete connection[key]
    }
  }
}

module.exports = { withReadConnection }
