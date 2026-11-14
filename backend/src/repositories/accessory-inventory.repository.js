'use strict'
const BaseRepository = require('./base.repository')
const { batchKey } = require('../utils/accessory-batches')
const { appendStoreScopeCondition } = require('../utils/store-scope')
const { purchaseSnapshotText } = require('../utils/accessory-purchase-snapshot')

class AccessoryInventoryRepository extends BaseRepository {
  constructor() { super('accessory_inventory_events') }

  /** 只读余额：与写入分配使用相同批次身份，不锁行、不接续历史库存。 */
  batchQueries(accessoryId, scope, exact = false) {
    const conditions = [exact ? 'a.id = ?' : '(a.id = ? OR a.template_id = ?)'], params = exact ? [accessoryId] : [accessoryId, accessoryId]
    appendStoreScopeCondition(scope, 'e.store_id', conditions, params)
    const groups = `SELECT MIN(e.id) AS event_id, e.accessory_id, e.store_id, e.stock_in_id,
      e.purchase_cost, e.usage_type, e.serial_tracking, SUM(e.quantity_delta) AS quantity, COUNT(*) AS event_count
      FROM accessory_inventory_events e JOIN accessories a ON a.id = e.accessory_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY e.accessory_id, e.store_id, e.stock_in_id, e.purchase_cost, e.usage_type, e.serial_tracking`
    const stockConditions = [exact ? 'a.id = ?' : '(a.id = ? OR a.template_id = ?)'], stockParams = exact ? [accessoryId] : [accessoryId, accessoryId]
    appendStoreScopeCondition(scope, 'st.store_id', stockConditions, stockParams)
    const stocks = `SELECT st.* FROM accessory_stock st JOIN accessories a ON a.id = st.accessory_id
      WHERE ${stockConditions.join(' AND ')}`
    return { groups, params, stocks, stockParams }
  }

  async batchConflict(input, executor) {
    const { groups, params, stocks, stockParams } = this.batchQueries(input.accessoryId, input.scope, input.exact)
    const ledger = `SELECT g.accessory_id, g.store_id, SUM(g.quantity) AS quantity,
      SUM(g.event_count) AS event_count, MIN(g.quantity) AS minimum_quantity,
      SUM(CASE WHEN g.serial_tracking = 1 THEN g.quantity ELSE 0 END) AS serial_quantity,
      SUM(CASE WHEN g.serial_tracking NOT IN (0, 1) OR g.usage_type NOT IN ('sale', 'gift', 'unclassified')
        OR g.purchase_cost < 0 OR (g.stock_in_id IS NOT NULL AND si.id IS NULL) THEN 1 ELSE 0 END) AS invalid_count
      FROM (${groups}) g LEFT JOIN accessory_stock_in si ON si.id = g.stock_in_id AND si.accessory_id = g.accessory_id
      GROUP BY g.accessory_id, g.store_id`
    const [rows] = await executor.query(`SELECT st.accessory_id FROM (${stocks}) st
      LEFT JOIN (${ledger}) l ON l.accessory_id = st.accessory_id AND l.store_id = st.store_id
      LEFT JOIN (SELECT accessory_id, store_id, COUNT(*) AS quantity FROM accessory_serials
        WHERE status = 'in_stock' GROUP BY accessory_id, store_id) sn
        ON sn.accessory_id = st.accessory_id AND sn.store_id = st.store_id
      WHERE st.quantity < 0 OR COALESCE(sn.quantity, 0) > st.quantity OR
        (l.event_count > 0 AND (l.quantity <> st.quantity OR l.minimum_quantity < 0 OR l.invalid_count > 0
          OR l.serial_quantity <> COALESCE(sn.quantity, 0)))
      UNION ALL SELECT l.accessory_id FROM (${ledger}) l LEFT JOIN accessory_stock st
        ON st.accessory_id = l.accessory_id AND st.store_id = l.store_id
      WHERE st.accessory_id IS NULL LIMIT 1`, [...stockParams, ...params, ...params])
    return rows.length > 0
  }

  async currentBatches(input, executor) {
    const { groups, params, stocks, stockParams } = this.batchQueries(input.accessoryId, input.scope, input.exact)
    const tracked = `SELECT CONCAT('event:', g.event_id) AS row_key, g.accessory_id, g.store_id, g.stock_in_id,
      g.purchase_cost, g.usage_type, g.serial_tracking, g.quantity,
      IF(g.stock_in_id IS NULL, 'legacy', 'purchase') AS source_status FROM (${groups}) g WHERE g.quantity > 0`
    const balances = input.stockInId ? `${tracked} AND g.stock_in_id = ?` : `${tracked}
      UNION ALL SELECT CONCAT('stock:', st.accessory_id, ':', st.store_id), st.accessory_id, st.store_id, NULL, NULL, 'unclassified', NULL,
      st.quantity, 'untracked' FROM (${stocks}) st WHERE st.quantity > 0 AND NOT EXISTS
        (SELECT 1 FROM accessory_inventory_events e WHERE e.accessory_id = st.accessory_id AND e.store_id = st.store_id)`
    const values = input.stockInId ? [...params, input.stockInId] : [...params, ...stockParams]
    const [[count]] = await executor.query(`SELECT COUNT(*) AS total, COALESCE(SUM(b.quantity), 0) AS total_quantity FROM (${balances}) b`, values)
    const [data] = await executor.query(`SELECT b.*, s.name AS store_name, brand.name AS brand_name, a.product_model,
      si.batch_no, ${purchaseSnapshotText('supplier_name', 'supplier.name')} AS supplier_name, si.inventory_time, si.operator_name AS inventory_operator_name
      FROM (${balances}) b LEFT JOIN accessories a ON a.id = b.accessory_id
      LEFT JOIN brands brand ON brand.id = a.brand_id LEFT JOIN stores s ON s.id = b.store_id
      LEFT JOIN accessory_stock_in si ON si.id = b.stock_in_id AND si.accessory_id = b.accessory_id
      LEFT JOIN suppliers supplier ON supplier.id = si.supplier_id
      ORDER BY b.store_id, b.accessory_id, b.stock_in_id IS NULL DESC, si.inventory_time, b.stock_in_id, b.row_key
      LIMIT ? OFFSET ?`, [...values, input.pageSize, (input.page - 1) * input.pageSize])
    const total = Number(count.total)
    return { data, ...(input.stockInId ? { current_quantity: Number(count.total_quantity) } : {}), pagination: { page: input.page, page_size: input.pageSize, total,
      total_pages: Math.ceil(total / input.pageSize), has_next: input.page * input.pageSize < total, has_prev: input.page > 1 } }
  }

  async purchaseOrigin(accessoryId, stockInId, executor) {
    const [[row]] = await executor.query(`SELECT COUNT(*) AS event_count,
      COALESCE(SUM(quantity_delta), 0) AS quantity, MIN(purchase_cost) AS min_cost, MAX(purchase_cost) AS max_cost,
      SUM(CASE WHEN quantity_delta <= 0 OR purchase_cost IS NULL THEN 1 ELSE 0 END) AS invalid_count
      FROM accessory_inventory_events WHERE accessory_id = ? AND stock_in_id = ? AND event_type = 'stock_in'`, [accessoryId, stockInId])
    return row
  }

  /** 退供试算只读重查选中实物及其原批次；客户端页码/金额不参与来源核验。 */
  async purchaseReturnSelection(input, executor) {
    let serials = []
    if (input.serialIds.length) {
      const conditions = ['sn.accessory_id = ?', 'sn.stock_in_id = ?', "sn.status = 'in_stock'",
        `sn.id IN (${input.serialIds.map(() => '?').join(',')})`]
      const params = [input.accessoryId, input.stockInId, ...input.serialIds]
      appendStoreScopeCondition(input.scope, 'sn.store_id', conditions, params)
      ;[serials] = await executor.query(`SELECT sn.id, sn.serial_number, sn.accessory_id, sn.stock_in_id, sn.store_id, sn.purchase_cost, sn.status
        FROM accessory_serials sn WHERE ${conditions.join(' AND ')} ORDER BY sn.id`, params)
    }
    const storeIds = [...new Set(serials.map(row => Number(row.store_id)))]
    const choices = [], values = []
    if (input.batchEventIds.length) {
      choices.push(`(g.serial_tracking = 0 AND g.event_id IN (${input.batchEventIds.map(() => '?').join(',')}))`)
      values.push(...input.batchEventIds)
    }
    if (storeIds.length) {
      choices.push(`(g.serial_tracking = 1 AND g.store_id IN (${storeIds.map(() => '?').join(',')}))`)
      values.push(...storeIds)
    }
    if (!choices.length) return { batches: [], serials }
    const { groups, params } = this.batchQueries(input.accessoryId, input.scope, true)
    const [batches] = await executor.query(`SELECT CONCAT('event:', g.event_id) AS row_key, g.accessory_id, g.stock_in_id, g.store_id,
      s.name AS store_name, g.purchase_cost, g.usage_type, g.serial_tracking, g.quantity
      FROM (${groups}) g LEFT JOIN stores s ON s.id = g.store_id
      WHERE g.stock_in_id = ? AND g.quantity > 0 AND (${choices.join(' OR ')})
      ORDER BY g.store_id, g.event_id`, [...params, input.stockInId, ...values])
    return { batches, serials }
  }

  /** 原采购在库SN，按实际商品和当前授权店铺查询，不包含同模板的其他品牌/批次。 */
  async purchaseSerials(input, executor) {
    const conditions = ['sn.accessory_id = ?', 'sn.stock_in_id = ?', "sn.status = 'in_stock'"]
    const params = [input.accessoryId, input.stockInId]
    appendStoreScopeCondition(input.scope, 'sn.store_id', conditions, params)
    // 按字面子串检索，%和_不作为通配符；SN没有业务排序，沿用稳定的逐件ID顺序。
    if (input.serialSearch) { conditions.push('LOCATE(?, sn.serial_number) > 0'); params.push(input.serialSearch) }
    const where = `FROM accessory_serials sn WHERE ${conditions.join(' AND ')}`
    const [[count]] = await executor.query(`SELECT COUNT(*) AS total ${where}`, params)
    const [data] = await executor.query(`SELECT sn.id, sn.serial_number, sn.store_id,
      (SELECT s.name FROM stores s WHERE s.id = sn.store_id) AS store_name ${where}
      ORDER BY sn.id LIMIT ? OFFSET ?`, [...params, input.pageSize, (input.serialPage - 1) * input.pageSize])
    const total = Number(count.total)
    return { data, pagination: { page: input.serialPage, page_size: input.pageSize, total,
      total_pages: Math.ceil(total / input.pageSize), has_next: input.serialPage * input.pageSize < total, has_prev: input.serialPage > 1 } }
  }

  /** 指定原采购的成本及各店SN来源必须吻合；不能仅用全商品SN总数互相抵消。 */
  async purchaseBatchConflict(input, executor) {
    const { groups, params } = this.batchQueries(input.accessoryId, input.scope, true)
    const conditions = ["sn.status = 'in_stock'", 'sn.accessory_id = ?', 'sn.stock_in_id = ?']
    const serialParams = [input.accessoryId, input.stockInId]
    appendStoreScopeCondition(input.scope, 'sn.store_id', conditions, serialParams)
    const serials = `SELECT sn.store_id, sn.purchase_cost, COUNT(*) AS quantity FROM accessory_serials sn
      WHERE ${conditions.join(' AND ')} GROUP BY sn.store_id, sn.purchase_cost`
    const ledger = `SELECT g.store_id, g.purchase_cost, SUM(g.quantity) AS quantity FROM (${groups}) g
      WHERE g.stock_in_id = ? AND g.serial_tracking = 1 GROUP BY g.store_id, g.purchase_cost`
    const [rows] = await executor.query(`SELECT g.store_id FROM (${groups}) g WHERE g.stock_in_id = ?
      AND (g.purchase_cost IS NULL OR g.purchase_cost <> ?)
      UNION ALL SELECT l.store_id FROM (${ledger}) l LEFT JOIN (${serials}) sn
        ON sn.store_id = l.store_id AND sn.purchase_cost = l.purchase_cost
      WHERE l.quantity <> COALESCE(sn.quantity, 0)
      UNION ALL SELECT sn.store_id FROM (${serials}) sn LEFT JOIN (${ledger}) l
        ON l.store_id = sn.store_id AND l.purchase_cost = sn.purchase_cost
      WHERE l.store_id IS NULL LIMIT 1`, [...params, input.stockInId, input.purchaseCost,
      ...params, input.stockInId, ...serialParams, ...serialParams, ...params, input.stockInId])
    return rows.length > 0
  }

  async balances(accessoryId, storeId, executor) {
    // 根模板锁串行化写入；当前读避免RR事务在等待模板锁前建立的快照漏掉已提交流水。
    const [rows] = await executor.query(`SELECT e.id, e.stock_in_id, e.purchase_cost, e.usage_type, e.serial_tracking, e.quantity_delta
      FROM accessory_inventory_events e LEFT JOIN accessory_stock_in si ON si.id = e.stock_in_id
      WHERE e.accessory_id = ? AND e.store_id = ?
      ORDER BY e.stock_in_id IS NULL DESC, si.inventory_time, e.stock_in_id, e.id FOR UPDATE`, [accessoryId, storeId])
    const groups = new Map()
    for (const row of rows) {
      const key = batchKey(row), group = groups.get(key) || { ...row, quantity: 0 }
      group.quantity += Number(row.quantity_delta)
      groups.set(key, group)
    }
    return [...groups.values()]
  }

  async stockSerialOrigins(accessoryId, storeId, executor) {
    const [rows] = await executor.query(`SELECT sn.id, si.id AS stock_in_id, sn.purchase_cost
      FROM accessory_serials sn LEFT JOIN accessory_stock_in si ON si.id = sn.stock_in_id AND si.accessory_id = sn.accessory_id
      WHERE sn.accessory_id = ? AND sn.store_id = ? AND sn.status = 'in_stock' ORDER BY sn.id FOR UPDATE`, [accessoryId, storeId])
    return rows
  }

  async append(data, executor) {
    const [result] = await executor.query(`INSERT INTO accessory_inventory_events
      (accessory_id, store_id, stock_in_id, purchase_cost, usage_type, serial_tracking,
       event_type, quantity_delta, transfer_id, sale_id, operator_id, operator_name, remarks, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.accessory_id, data.store_id, data.stock_in_id ?? null, data.purchase_cost ?? null, data.usage_type,
      data.serial_tracking, data.event_type, data.quantity_delta, data.transfer_id ?? null, data.sale_id ?? null,
      data.operator_id, data.operator_name || null, data.remarks || null, data.time])
    return result.insertId
  }

  async saleEvents(saleId, executor) {
    const [rows] = await executor.query(`SELECT id, accessory_id, store_id, stock_in_id, purchase_cost,
      usage_type, serial_tracking, event_type, quantity_delta, sale_id, source_event_id, return_key, return_hash, created_at
      FROM accessory_inventory_events WHERE sale_id = ? ORDER BY id FOR UPDATE`, [saleId])
    return rows
  }

  async returnRequest(key, executor) {
    const [rows] = await executor.query(`SELECT id, accessory_id, store_id, stock_in_id, purchase_cost,
      usage_type, serial_tracking, event_type, quantity_delta, sale_id, source_event_id, return_key, return_hash, created_at
      FROM accessory_inventory_events WHERE return_key = ? ORDER BY id FOR UPDATE`, [key])
    return rows
  }

  async appendReturn(data, executor) {
    const [result] = await executor.query(`INSERT INTO accessory_inventory_events
      (accessory_id, store_id, stock_in_id, purchase_cost, usage_type, serial_tracking,
       event_type, quantity_delta, sale_id, operator_id, operator_name, remarks, created_at, source_event_id, return_key, return_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.accessory_id, data.store_id, data.stock_in_id, data.purchase_cost, data.usage_type, data.serial_tracking,
      data.event_type, data.quantity_delta, data.sale_id, data.operator_id, data.operator_name || null, data.remarks || null,
      data.time, data.source_event_id, data.return_key, data.return_hash])
    return result.insertId
  }
}
module.exports = AccessoryInventoryRepository
