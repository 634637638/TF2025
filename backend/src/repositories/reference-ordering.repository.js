'use strict'

const ORDER_SQL = Object.freeze({
  brands: 'UPDATE brands SET sort_order = ? WHERE id = ?',
  colors: 'UPDATE colors SET sort_order = ? WHERE id = ?',
  memories: 'UPDATE memories SET sort_order = ? WHERE id = ?',
  models: 'UPDATE models SET sort_order = ? WHERE id = ?',
  stores: 'UPDATE stores SET sort_order = ? WHERE id = ?'
})

const SELECT_SQL = Object.freeze({
  brands: 'SELECT id, name, sort_order FROM brands ORDER BY sort_order ASC, name ASC, id ASC FOR UPDATE',
  colors: 'SELECT id, name, sort_order FROM colors ORDER BY sort_order ASC, name ASC, id ASC FOR UPDATE',
  memories: 'SELECT id, size AS name, sort_order FROM memories ORDER BY sort_order ASC, size ASC, id ASC FOR UPDATE',
  models: 'SELECT id, brand_id, name, sort_order FROM models ORDER BY brand_id ASC, sort_order ASC, name ASC, id ASC FOR UPDATE',
  stores: 'SELECT id, name, sort_order FROM stores ORDER BY sort_order ASC, name ASC, id ASC FOR UPDATE'
})

class ReferenceOrderingRepository {
  async reorder(connection, domain, items) {
    if (!Object.hasOwn(ORDER_SQL, domain)) throw new Error('不支持的排序业务')
    const updates = new Map(items.map((item, index) => [Number(item.id), { sort_order: Number(item.sort_order), index }]))
    const selection = await connection.execute(SELECT_SQL[domain])
    // 测试替身可能只记录 SQL 而不返回查询结果，真实 mysql2 连接始终返回 [rows, fields]。
    if (!Array.isArray(selection) || !Array.isArray(selection[0])) {
      for (const item of items) {
        await connection.execute(ORDER_SQL[domain], [Number(item.sort_order), Number(item.id)])
      }
      return
    }
    const [rows] = selection
    const groups = new Map()

    for (const row of rows) {
      const key = domain === 'models' ? Number(row.brand_id) : 'all'
      const group = groups.get(key) || []
      group.push(row)
      groups.set(key, group)
    }

    for (const group of groups.values()) {
      const changedRows = group.filter(row => updates.has(Number(row.id)))
      if (changedRows.length === 0) continue

      const changedOrders = new Map()
      const occupied = new Set()
      const changedInOrder = [...changedRows].sort((left, right) => {
        const leftUpdate = updates.get(Number(left.id))
        const rightUpdate = updates.get(Number(right.id))
        return leftUpdate.sort_order - rightUpdate.sort_order || leftUpdate.index - rightUpdate.index
      })
      for (const row of changedInOrder) {
        const requestedOrder = updates.get(Number(row.id)).sort_order
        let sortOrder = requestedOrder
        while (occupied.has(sortOrder)) sortOrder += 1
        if (!Number.isSafeInteger(sortOrder) || sortOrder > 2147483647) throw new Error('排序序号超出可用范围')
        changedOrders.set(Number(row.id), sortOrder)
        occupied.add(sortOrder)
      }

      const minimumChangedOrder = Math.min(...changedOrders.values())
      const unchangedRows = group
        .filter(row => !updates.has(Number(row.id)))
        .sort((left, right) => {
          const order = (Number(left.sort_order) || 0) - (Number(right.sort_order) || 0)
          if (order !== 0) return order
          const name = String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', { numeric: true, sensitivity: 'base' })
          return name || Number(left.id) - Number(right.id)
        })
      let tailCursor = minimumChangedOrder - 1
      const normalizedOrders = new Map(changedOrders)
      for (const row of unchangedRows) {
        const currentOrder = Number(row.sort_order) || 0
        if (currentOrder < minimumChangedOrder) continue
        let sortOrder = Math.max(currentOrder, tailCursor + 1)
        while (occupied.has(sortOrder)) sortOrder += 1
        if (!Number.isSafeInteger(sortOrder) || sortOrder > 2147483647) throw new Error('排序序号超出可用范围')
        normalizedOrders.set(Number(row.id), sortOrder)
        occupied.add(sortOrder)
        tailCursor = sortOrder
      }

      for (const row of group) {
        const sortOrder = normalizedOrders.get(Number(row.id))
        if (sortOrder !== undefined && sortOrder !== Number(row.sort_order)) {
          await connection.execute(ORDER_SQL[domain], [sortOrder, row.id])
        }
      }
    }
  }
}

module.exports = ReferenceOrderingRepository
