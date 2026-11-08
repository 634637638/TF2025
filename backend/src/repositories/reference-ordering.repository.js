'use strict'

const ORDER_SQL = Object.freeze({
  colors: 'UPDATE colors SET sort_order = ? WHERE id = ?',
  memories: 'UPDATE memories SET sort_order = ? WHERE id = ?',
  models: 'UPDATE models SET sort_order = ? WHERE id = ?',
  stores: 'UPDATE stores SET sort_order = ? WHERE id = ?'
})

class ReferenceOrderingRepository {
  update(connection, domain, item) {
    if (!Object.hasOwn(ORDER_SQL, domain)) throw new Error('不支持的排序业务')
    return connection.execute(ORDER_SQL[domain], [item.sort_order, item.id])
  }
}

module.exports = ReferenceOrderingRepository
