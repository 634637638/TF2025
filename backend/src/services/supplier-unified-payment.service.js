'use strict'

const crypto = require('node:crypto')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { appendPurchaseStoreScope } = require('../utils/accessory-purchase-scope')
const { getBeijingTimeString } = require('../utils/time')
const { settlement } = require('../config/payment-methods.json')
const { moneyCents, validId } = require('../utils/sale-input')
const { purchaseSnapshotText } = require('../utils/accessory-purchase-snapshot')
const AccessoryPurchaseService = require('./accessory-purchase.service')
const AccessoryPurchaseRepository = require('../repositories/accessory-purchase.repository')
const { randomUUID } = crypto

const PAYMENT_METHODS = new Set(settlement.map(item => item.value))
const REQUEST_KEY = /^[a-f0-9]{32}$/

class SupplierUnifiedPaymentService {
  constructor({ database = getDatabase, accessoryService = new AccessoryPurchaseService({ repository: new AccessoryPurchaseRepository() }) } = {}) { this.database = database; this.accessoryService = accessoryService }

  error(message, statusCode = 400, code = 'VALIDATION_ERROR') { return Object.assign(new Error(message), { statusCode, code }) }

  validateInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw this.error('合并打款参数无效')
    const supplierId = Number(input.supplier_id)
    if (!Number.isInteger(supplierId) || supplierId < 1) throw this.error('供应商无效')
    const phoneIds = Array.isArray(input.phone_ids) ? [...new Set(input.phone_ids.map(Number))] : []
    const accessoryIds = Array.isArray(input.accessory_purchase_ids) ? [...new Set(input.accessory_purchase_ids.map(Number))] : []
    if (!phoneIds.length && !accessoryIds.length) throw this.error('至少选择一台手机或一张商品采购单')
    if (phoneIds.some(id => !Number.isInteger(id) || id < 1) || accessoryIds.some(id => !Number.isInteger(id) || id < 1)) throw this.error('选择的单据编号无效')
    if (phoneIds.length + accessoryIds.length > 500) throw this.error('一次最多合并500条明细')
    if (!PAYMENT_METHODS.has(input.payment_method)) throw this.error('打款方式无效')
    if (!REQUEST_KEY.test(String(input.request_key || ''))) throw this.error('请求标识无效，请重新打开登记窗口')
    const { paymentTime } = this.accessoryService.paymentDetails(input.payment_method, input.payment_time)
    const remarks = input.remarks === undefined ? '' : input.remarks
    if (typeof remarks !== 'string' || remarks.trim().length > 1000) throw this.error('备注最多1000字')
    const externalReference = input.external_reference === undefined ? '' : input.external_reference
    if (typeof externalReference !== 'string' || externalReference.trim().length > 100) throw this.error('供应商单据号最多100字')
    const actualCents = moneyCents(input.actual_amount)
    if (actualCents === null || actualCents < 0) throw this.error('实付金额无效')
    return { supplierId, phoneIds, accessoryIds, paymentMethod: input.payment_method, paymentTime, externalReference: externalReference.trim(), remarks: remarks.trim(), actualCents, requestKey: String(input.request_key) }
  }

  async options(actor, supplierId) {
    const scope = resolveStoreScope(actor, null)
    return withConnection(this.database, async connection => {
      if (supplierId === undefined || supplierId === null || supplierId === '') {
        const conditions = ['s.status = 1']
        const params = []
        if (scope.allStores) {
          conditions.push(`(EXISTS (SELECT 1 FROM phones p WHERE p.supplier_id=s.id AND p.status!='supplier_proxy' AND (p.payment_status IS NULL OR p.payment_status!='paid')) OR
            EXISTS (SELECT 1 FROM accessory_stock_in si LEFT JOIN accessory_purchase_payments ap ON ap.id=(SELECT MAX(x.id) FROM accessory_purchase_payments x WHERE x.stock_in_id=si.id)
              WHERE si.supplier_id=s.id AND si.status='completed' AND (ap.id IS NULL OR ap.action='cancel')))`)
        } else if (!scope.storeIds.length) conditions.push('1 = 0')
        else {
          const placeholders = scope.storeIds.map(() => '?').join(',')
          conditions.push(`(EXISTS (SELECT 1 FROM phones p WHERE p.supplier_id=s.id AND p.status!='supplier_proxy' AND (p.payment_status IS NULL OR p.payment_status!='paid') AND p.store_id IN (${placeholders})) OR
            EXISTS (SELECT 1 FROM accessory_stock_in si LEFT JOIN accessory_purchase_payments ap ON ap.id=(SELECT MAX(x.id) FROM accessory_purchase_payments x WHERE x.stock_in_id=si.id)
              WHERE si.supplier_id=s.id AND si.status='completed' AND (ap.id IS NULL OR ap.action='cancel') AND si.store_id IN (${placeholders})))`)
          params.push(...scope.storeIds, ...scope.storeIds)
        }
        const [suppliers] = await connection.query(`SELECT s.id, s.name FROM suppliers s WHERE ${conditions.join(' AND ')} ORDER BY s.name, s.id`, params)
        return { suppliers }
      }
      const id = Number(supplierId)
      if (!Number.isInteger(id) || id < 1) throw this.error('供应商无效')
      const phoneConditions = ['p.supplier_id = ?', 'p.supplier_id IS NOT NULL', "p.status != 'supplier_proxy'", "(p.payment_status IS NULL OR p.payment_status != 'paid')"]
      const phoneParams = [id]
      if (!scope.allStores) {
        if (!scope.storeIds.length) phoneConditions.push('1 = 0')
        else { phoneConditions.push(`p.store_id IN (${scope.storeIds.map(() => '?').join(',')})`); phoneParams.push(...scope.storeIds) }
      }
      const purchaseConditions = ["si.status = 'completed'", 'si.supplier_id = ?', 'si.supplier_id IS NOT NULL', "(p.id IS NULL OR p.action = 'cancel')"]
      const purchaseParams = [id]
      appendPurchaseStoreScope(scope, 'si', purchaseConditions, purchaseParams)
      const [phones] = await connection.query(`SELECT p.id, p.store_id, s.name AS supplier_name, st.name AS store_name, br.name AS brand_name, m.name AS model_name,
        c.name AS color_name, mem.size AS memory_name, p.serial_number, p.imei, p.sale_time, p.sale_price, p.payment_time,
        p.status AS phone_status, p.purchase_cost
        FROM phones p LEFT JOIN stores st ON st.id = p.store_id
        LEFT JOIN suppliers s ON s.id=p.supplier_id
        LEFT JOIN brands br ON br.id = p.brand_id LEFT JOIN models m ON m.id = p.model_id
        LEFT JOIN colors c ON c.id = p.color_id LEFT JOIN memories mem ON mem.id = p.memory_id
        WHERE ${phoneConditions.join(' AND ')} ORDER BY p.id DESC`, phoneParams)
      const [purchases] = await connection.query(`SELECT si.id, si.store_id, st.name AS store_name, si.batch_no, si.quantity, si.purchase_cost, si.total_amount,
        ${purchaseSnapshotText('name', 'COALESCE(t.name, a.name)')} AS name,
        ${purchaseSnapshotText('brand_name', 'b.name')} AS brand_name,
        ${purchaseSnapshotText('product_model', 'IF(a.template_id IS NULL, a.product_model, t.product_model)')} AS product_model,
        ${purchaseSnapshotText('color_name', 'c.name')} AS color_name,
        ${purchaseSnapshotText('unit', 'COALESCE(unit.name, t.unit, a.unit)')} AS unit
        FROM accessory_stock_in si LEFT JOIN stores st ON st.id = si.store_id
        LEFT JOIN accessories a ON a.id=si.accessory_id LEFT JOIN accessories t ON t.id=a.template_id
        LEFT JOIN brands b ON b.id=a.brand_id LEFT JOIN colors c ON c.id=IF(a.template_id IS NULL, a.color_id, t.color_id)
        LEFT JOIN accessory_units unit ON unit.id=IF(a.template_id IS NULL, a.unit_id, t.unit_id)
        LEFT JOIN accessory_purchase_payments p ON p.id = (SELECT MAX(last_payment.id) FROM accessory_purchase_payments last_payment WHERE last_payment.stock_in_id = si.id)
        WHERE ${purchaseConditions.join(' AND ')} ORDER BY si.id DESC`, purchaseParams)
      return { supplier_id: id, phones, accessory_purchases: purchases }
    })
  }

  async create(actor, input) {
    const operatorId = Number(actor?.id || actor?.user_id)
    if (!Number.isInteger(operatorId) || operatorId < 1) throw this.error('认证用户信息无效', 401, 'INVALID_ACTOR')
    const data = this.validateInput(input)
    const scope = resolveStoreScope(actor, null)
    const batchId = randomUUID()
    const requestHash = crypto.createHash('sha256').update(JSON.stringify([operatorId, data])).digest('hex')
    return withConnection(this.database, async connection => {
      let started = false
      try {
        await connection.beginTransaction(); started = true
        const [existing] = await connection.query('SELECT id, request_hash, supplier_id, expected_amount, actual_amount, payment_method, payment_time FROM supplier_payment_batches WHERE request_key = ? FOR UPDATE', [data.requestKey])
        if (existing[0]) {
          if (existing[0].request_hash !== requestHash) throw this.error('请求已使用，请刷新后重试', 409, 'PAYMENT_REQUEST_CONFLICT')
          await connection.commit()
          return { ...existing[0], id: existing[0].id, replayed: true }
        }
        const phonePlaceholders = data.phoneIds.map(() => '?').join(',')
        let phones = []
        if (data.phoneIds.length) {
          const conditions = [`p.id IN (${phonePlaceholders})`, 'p.supplier_id = ?', 'p.supplier_id IS NOT NULL', "p.status != 'supplier_proxy'", "(p.payment_status IS NULL OR p.payment_status != 'paid')"]
          const params = [...data.phoneIds, data.supplierId]
          if (!scope.allStores) { if (!scope.storeIds.length) conditions.push('1 = 0'); else { conditions.push(`p.store_id IN (${scope.storeIds.map(() => '?').join(',')})`); params.push(...scope.storeIds) } }
          const [rows] = await connection.query(`SELECT p.id, p.store_id, p.supplier_id, p.purchase_cost FROM phones p WHERE ${conditions.join(' AND ')} FOR UPDATE`, params)
          if (rows.length !== data.phoneIds.length || rows.some(row => Number(row.supplier_id) !== data.supplierId)) throw this.error('手机不存在、供应商不一致、已打款或超出门店权限', 409, 'PAYMENT_SCOPE_CONFLICT')
          rows.forEach(row => assertStoreInScope(scope, row.store_id)); phones = rows
        }
        let purchases = []
        if (data.accessoryIds.length) {
          const conditions = [`si.id IN (${data.accessoryIds.map(() => '?').join(',')})`, "si.status = 'completed'", 'si.supplier_id = ?', 'si.supplier_id IS NOT NULL']
          const params = [...data.accessoryIds, data.supplierId]
          appendPurchaseStoreScope(scope, 'si', conditions, params)
          const [rows] = await connection.query(`SELECT si.id, si.store_id, si.supplier_id, si.quantity, si.purchase_cost, si.total_amount
            FROM accessory_stock_in si
            WHERE ${conditions.join(' AND ')} FOR UPDATE`, params)
          if (rows.length !== data.accessoryIds.length || rows.some(row => Number(row.supplier_id) !== data.supplierId)) throw this.error('商品采购单不存在、供应商不一致或超出门店权限', 409, 'PAYMENT_SCOPE_CONFLICT')
          rows.forEach(row => assertStoreInScope(scope, row.store_id))
          for (const row of rows) {
            const amount = moneyCents(row.total_amount)
            const { last } = await this.accessoryService.reconcilePayments(row, amount, connection)
            if (last?.action === 'pay') throw this.error('商品采购单已打款，请刷新后重新选择', 409, 'PAYMENT_SCOPE_CONFLICT')
          }
          purchases = rows
        }
        const expectedCents = phones.reduce((sum, row) => {
          const cents = moneyCents(row.purchase_cost)
          if (cents === null) throw this.error('手机采购成本无效，请核对原单', 409, 'PAYMENT_AMOUNT_CONFLICT')
          return sum + cents
        }, 0) + purchases.reduce((sum, row) => {
          const amount = moneyCents(row.total_amount), unit = moneyCents(row.purchase_cost)
          if (amount === null || unit === null || !validId(row.quantity) || unit * Number(row.quantity) !== amount || amount <= 0) throw this.error('商品采购金额与原入库不一致', 409, 'PURCHASE_AMOUNT_CONFLICT')
          return sum + amount
        }, 0)
        if (!Number.isSafeInteger(expectedCents)) throw this.error('应付金额超出安全范围', 409, 'PAYMENT_AMOUNT_CONFLICT')
        if (expectedCents !== data.actualCents) throw this.error(`实付金额必须等于应付金额（应付¥${(expectedCents / 100).toFixed(2)}）`, 409, 'PAYMENT_AMOUNT_CONFLICT')
        await connection.query(`INSERT INTO supplier_payment_batches (id, request_key, request_hash, supplier_id, expected_amount, actual_amount, payment_method, payment_time, external_reference, remarks, operator_id, operator_name, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`, [batchId, data.requestKey, requestHash, data.supplierId, expectedCents / 100, data.actualCents / 100, data.paymentMethod, data.paymentTime, data.externalReference, data.remarks, operatorId, actor.name || actor.username || '', getBeijingTimeString()])
        for (const phone of phones) await connection.query('UPDATE phones SET payment_status=\'paid\', payment_method=?, payment_time=?, payment_remarks=?, payment_batch_id=?, payment_operator_id=? WHERE id=?', [data.paymentMethod, data.paymentTime, data.remarks || null, batchId, operatorId, phone.id])
        for (const purchase of purchases) {
          const lineRequestKey = crypto.createHash('sha256').update(`${data.requestKey}:accessory:${purchase.id}`).digest('hex').slice(0, 32)
          const lineHash = crypto.createHash('sha256').update(`${requestHash}:accessory:${purchase.id}`).digest('hex')
          await connection.query(`INSERT INTO accessory_purchase_payments (stock_in_id, supplier_id, action, amount, reference_event_id, request_key, request_hash, payment_method, payment_time, remarks, operator_id, operator_name, created_at, payment_batch_id)
            VALUES (?, ?, 'pay', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [purchase.id, data.supplierId, Number(purchase.total_amount), lineRequestKey, lineHash, data.paymentMethod, data.paymentTime, data.remarks, operatorId, actor.name || actor.username || '', getBeijingTimeString(), batchId])
        }
        await connection.query(`INSERT INTO supplier_payment_batch_lines (batch_id, source_type, source_id, amount) VALUES ${[...phones.map(() => ['phone']), ...purchases.map(() => ['accessory'])].map(() => '(?, ?, ?, ?)').join(',')}`, phones.flatMap(row => [batchId, 'phone', row.id, Number(row.purchase_cost)]).concat(purchases.flatMap(row => [batchId, 'accessory', row.id, Number(row.total_amount)])))
        await connection.commit()
        return { id: batchId, supplier_id: data.supplierId, expected_amount: expectedCents / 100, actual_amount: data.actualCents / 100, phone_count: phones.length, accessory_count: purchases.length, payment_method: data.paymentMethod, payment_time: data.paymentTime, replayed: false }
      } catch (error) {
        if (!started) { connection.destroy(); throw error }
        try { await connection.rollback() } catch (rollbackError) { connection.destroy(); throw rollbackError }
        if (error.code === 'ER_DUP_ENTRY') throw this.error('请求已处理，请刷新后重试', 409, 'PAYMENT_REQUEST_CONFLICT')
        throw error
      }
    })
  }

  async history(actor, input = {}) {
    const page = Number(input.page || 1), pageSize = Number(input.page_size || 20)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw this.error('分页参数无效')
    const scope = resolveStoreScope(actor, null)
    return withConnection(this.database, async connection => {
      const visiblePhone = scope.allStores ? 'p.id IS NOT NULL' : scope.storeIds.length ? `p.id IS NOT NULL AND p.store_id IN (${scope.storeIds.map(() => '?').join(',')})` : '1 = 0'
      const phoneParams = scope.allStores || !scope.storeIds.length ? [] : [...scope.storeIds]
      const accessoryConditions = ['si.id IS NOT NULL']
      const accessoryParams = []
      appendPurchaseStoreScope(scope, 'si', accessoryConditions, accessoryParams)
      const hiddenLine = `NOT EXISTS (SELECT 1 FROM supplier_payment_batch_lines l
        LEFT JOIN phones p ON l.source_type='phone' AND p.id=l.source_id
        LEFT JOIN accessory_stock_in si ON l.source_type='accessory' AND si.id=l.source_id
        WHERE l.batch_id=b.id AND ((l.source_type='phone' AND NOT (${visiblePhone})) OR
          (l.source_type='accessory' AND NOT (${accessoryConditions.join(' AND ')}))))`
      const params = [...phoneParams, ...accessoryParams]
      const [[count]] = await connection.query(`SELECT COUNT(*) AS total FROM supplier_payment_batches b WHERE ${hiddenLine}`, params)
      const [rows] = await connection.query(`SELECT b.id, b.supplier_id, s.name AS supplier_name, b.expected_amount, b.actual_amount,
        b.payment_method, b.payment_time, b.external_reference, b.remarks, b.operator_name, b.created_at,
        COUNT(l.id) AS line_count, SUM(l.source_type='phone') AS phone_count, SUM(l.source_type='accessory') AS accessory_count
        FROM supplier_payment_batches b LEFT JOIN suppliers s ON s.id=b.supplier_id
        LEFT JOIN supplier_payment_batch_lines l ON l.batch_id=b.id WHERE ${hiddenLine}
        GROUP BY b.id ORDER BY b.payment_time DESC, b.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
      return { rows, pagination: { page, page_size: pageSize, total: Number(count.total), total_pages: Math.ceil(Number(count.total) / pageSize) } }
    })
  }

  async details(actor, batchId) {
    if (typeof batchId !== 'string' || !/^[0-9a-f-]{36}$/i.test(batchId)) throw this.error('合并批次编号无效')
    const scope = resolveStoreScope(actor, null)
    return withConnection(this.database, async connection => {
      const [headers] = await connection.query(`SELECT b.id, b.supplier_id, s.name AS supplier_name, b.expected_amount, b.actual_amount,
        b.payment_method, b.payment_time, b.external_reference, b.remarks, b.operator_name, b.created_at
        FROM supplier_payment_batches b LEFT JOIN suppliers s ON s.id=b.supplier_id WHERE b.id=?`, [batchId])
      let header = headers[0]
      let lines
      if (!header) {
        // 旧版手机批量打款只把 UUID 写入 phones.payment_batch_id，没有创建合并批次主表记录。
        // 读取时将这类历史批次转换为同一详情结构，避免旧数据被误报为不存在。
        const legacyConditions = ['p.payment_batch_id = ?', "p.payment_status = 'paid'"]
        const legacyParams = [batchId]
        const [legacyRows] = await connection.query(`SELECT p.id, p.store_id AS phone_store_id, p.supplier_id AS phone_supplier_id,
          st.name AS phone_store_name, p.imei, p.serial_number, p.purchase_cost AS phone_purchase_cost,
          p.sale_price AS phone_sale_price, p.sale_time AS phone_sale_time, p.payment_time AS phone_payment_time,
          p.payment_method AS phone_payment_method, p.payment_remarks AS phone_payment_remarks, p.status AS phone_status,
          br.name AS brand_name, m.name AS model_name, c.name AS color_name, mem.size AS memory_name,
          u.name AS phone_payment_operator_name, s.name AS supplier_name
          FROM phones p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN stores st ON st.id=p.store_id
          LEFT JOIN brands br ON br.id=p.brand_id LEFT JOIN models m ON m.id=p.model_id
          LEFT JOIN colors c ON c.id=p.color_id LEFT JOIN memories mem ON mem.id=p.memory_id
          LEFT JOIN users u ON u.id=p.payment_operator_id
          WHERE ${legacyConditions.join(' AND ')} ORDER BY p.id`, legacyParams)
        if (!legacyRows.length) throw this.error('合并打款批次不存在', 404, 'NOT_FOUND')
        const supplierIds = new Set(legacyRows.map(row => Number(row.phone_supplier_id)))
        if (supplierIds.size !== 1) throw this.error('历史打款批次供应商信息异常', 409, 'PAYMENT_BATCH_CONFLICT')
        const amount = legacyRows.reduce((total, row) => total + Number(row.phone_purchase_cost || 0), 0)
        const first = legacyRows[0]
        header = {
          id: batchId,
          legacy_phone_batch: true,
          supplier_id: first.phone_supplier_id,
          supplier_name: first.supplier_name,
          expected_amount: amount,
          actual_amount: amount,
          payment_method: first.phone_payment_method,
          payment_time: first.phone_payment_time,
          external_reference: '',
          remarks: first.phone_payment_remarks || '',
          operator_name: first.phone_payment_operator_name || '',
          created_at: first.phone_payment_time
        }
        lines = legacyRows.map(row => ({
          id: row.id,
          source_type: 'phone',
          source_id: row.id,
          amount: row.phone_purchase_cost,
          ...row
        }))
      } else {
        [lines] = await connection.query(`SELECT l.id, l.source_type, l.source_id, l.amount,
        p.store_id AS phone_store_id, p.supplier_id AS phone_supplier_id, stp.name AS phone_store_name,
        p.imei, p.serial_number, p.purchase_cost AS phone_purchase_cost, p.sale_price AS phone_sale_price,
        p.sale_time AS phone_sale_time, p.payment_time AS phone_payment_time, p.payment_method AS phone_payment_method,
        p.payment_remarks AS phone_payment_remarks, p.status AS phone_status, br.name AS brand_name, m.name AS model_name,
        c.name AS color_name, mem.size AS memory_name, u.name AS phone_payment_operator_name,
        si.store_id AS accessory_store_id, si.supplier_id AS accessory_supplier_id, sta.name AS accessory_store_name,
        si.batch_no, ${purchaseSnapshotText('name', 'COALESCE(t.name, a.name)')} AS accessory_name,
        ${purchaseSnapshotText('brand_name', 'bacc.name')} AS accessory_brand_name,
        ${purchaseSnapshotText('product_model', 'IF(a.template_id IS NULL, a.product_model, t.product_model)')} AS accessory_model_name,
        ${purchaseSnapshotText('color_name', 'cacc.name')} AS accessory_color_name,
        ${purchaseSnapshotText('unit', 'COALESCE(unit.name, t.unit, a.unit)')} AS accessory_unit,
        si.quantity AS accessory_quantity, si.purchase_cost AS accessory_purchase_cost,
        si.total_amount AS accessory_total_amount, ape.payment_time AS accessory_payment_time,
        ape.payment_method AS accessory_payment_method, ape.remarks AS accessory_payment_remarks,
        ape.operator_name AS accessory_payment_operator_name
        FROM supplier_payment_batch_lines l
        LEFT JOIN phones p ON l.source_type='phone' AND p.id=l.source_id
        LEFT JOIN stores stp ON stp.id=p.store_id LEFT JOIN brands br ON br.id=p.brand_id LEFT JOIN models m ON m.id=p.model_id
        LEFT JOIN colors c ON c.id=p.color_id LEFT JOIN memories mem ON mem.id=p.memory_id
        LEFT JOIN users u ON u.id=p.payment_operator_id
        LEFT JOIN accessory_stock_in si ON l.source_type='accessory' AND si.id=l.source_id
        LEFT JOIN accessories a ON a.id=si.accessory_id LEFT JOIN accessories t ON t.id=a.template_id
        LEFT JOIN brands bacc ON bacc.id=a.brand_id LEFT JOIN colors cacc ON cacc.id=IF(a.template_id IS NULL, a.color_id, t.color_id)
        LEFT JOIN accessory_units unit ON unit.id=IF(a.template_id IS NULL, a.unit_id, t.unit_id)
        LEFT JOIN stores sta ON sta.id=si.store_id
        LEFT JOIN accessory_purchase_payments ape ON ape.id=(SELECT MAX(last_payment.id) FROM accessory_purchase_payments last_payment WHERE last_payment.stock_in_id=si.id)
        WHERE l.batch_id=? ORDER BY l.source_type, l.id`, [batchId])
      }
      if (!lines.length) throw this.error('合并打款批次明细缺失', 409, 'PAYMENT_BATCH_CONFLICT')
      const lineCents = lines.reduce((total, line) => {
        const amount = moneyCents(line.amount)
        if (amount === null) throw this.error('合并批次金额异常', 409, 'PAYMENT_BATCH_CONFLICT')
        return total + amount
      }, 0)
      if (lineCents !== moneyCents(header.expected_amount) || lineCents !== moneyCents(header.actual_amount)) throw this.error('合并批次金额与来源明细不一致', 409, 'PAYMENT_BATCH_CONFLICT')
      for (const line of lines) {
        const sourceSupplierId = line.source_type === 'phone' ? line.phone_supplier_id : line.accessory_supplier_id
        if (Number(sourceSupplierId) !== Number(header.supplier_id)) throw this.error('合并批次供应商与来源明细不一致', 409, 'PAYMENT_BATCH_CONFLICT')
        if (line.source_type === 'phone') assertStoreInScope(scope, line.phone_store_id)
        else if (!await this.accessoryService.repository.getPurchase(Number(line.source_id), scope, connection)) {
          throw this.error('合并批次包含无权查看的采购来源', 403, 'STORE_SCOPE_DENIED')
        }
      }
      return { ...header, lines }
    })
  }

  async cancel(actor, batchId, input = {}) {
    const operatorId = Number(actor?.id || actor?.user_id)
    if (!Number.isInteger(operatorId) || operatorId < 1) throw this.error('认证用户信息无效', 401, 'INVALID_ACTOR')
    if (typeof batchId !== 'string' || !/^[0-9a-f-]{36}$/i.test(batchId)) throw this.error('合并批次编号无效')
    if (!input || typeof input !== 'object' || !REQUEST_KEY.test(String(input.request_key || '')) ||
      typeof input.remarks !== 'string' || !input.remarks.trim() || input.remarks.trim().length > 1000) {
      throw this.error('批量撤销参数无效，请填写撤销原因并重试')
    }
    const remarks = input.remarks.trim()
    const requestKey = String(input.request_key)
    const scope = resolveStoreScope(actor, null)
    return withConnection(this.database, async connection => {
      let started = false
      try {
        await connection.beginTransaction(); started = true
        const [headers] = await connection.query('SELECT id, supplier_id, status FROM supplier_payment_batches WHERE id=? FOR UPDATE', [batchId])
        const header = headers[0]
        if (!header) throw this.error('合并打款批次不存在', 404, 'NOT_FOUND')
        const [lines] = await connection.query('SELECT source_type, source_id, amount FROM supplier_payment_batch_lines WHERE batch_id=? ORDER BY source_type, source_id FOR UPDATE', [batchId])
        if (!lines.length) throw this.error('合并批次明细缺失，无法撤销', 409, 'PAYMENT_BATCH_CONFLICT')
        const phoneIds = lines.filter(line => line.source_type === 'phone').map(line => Number(line.source_id))
        const accessoryIds = lines.filter(line => line.source_type === 'accessory').map(line => Number(line.source_id))
        if (header.status === 'cancelled') {
          await connection.commit()
          return { id: batchId, replayed: true, phone_count: phoneIds.length, accessory_count: accessoryIds.length }
        }
        if (header.status !== 'paid') throw this.error('该打款批次状态已变化，请刷新后重试', 409, 'PAYMENT_STATE_CONFLICT')
        const lineAmount = new Map(lines.map(line => [`${line.source_type}:${Number(line.source_id)}`, moneyCents(line.amount)]))
        if (phoneIds.length) {
          const [phones] = await connection.query(`SELECT id, store_id, supplier_id, purchase_cost, payment_status, payment_batch_id
            FROM phones WHERE id IN (${phoneIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, phoneIds)
          if (phones.length !== phoneIds.length || phones.some(phone => Number(phone.supplier_id) !== Number(header.supplier_id) || phone.payment_status !== 'paid' || phone.payment_batch_id !== batchId || lineAmount.get(`phone:${Number(phone.id)}`) !== moneyCents(phone.purchase_cost))) {
            throw this.error('批次手机状态或来源已变化，请刷新后重试', 409, 'PAYMENT_STATE_CONFLICT')
          }
          phones.forEach(phone => assertStoreInScope(scope, phone.store_id))
        }
        for (const purchaseId of accessoryIds) {
          const purchase = await this.accessoryService.repository.getPurchase(purchaseId, scope, connection, true)
          if (!purchase || Number(purchase.supplier_id) !== Number(header.supplier_id)) throw this.error('批次商品采购单不存在或无权操作', 409, 'PAYMENT_SCOPE_CONFLICT')
          const amount = moneyCents(purchase.total_amount)
          const unit = moneyCents(purchase.purchase_cost)
          if (amount === null || amount <= 0 || unit === null || !validId(purchase.quantity) || unit * Number(purchase.quantity) !== amount) {
            throw this.error('商品采购金额与原单不一致，无法批量撤销', 409, 'PURCHASE_AMOUNT_CONFLICT')
          }
          if (lineAmount.get(`accessory:${purchaseId}`) !== amount) throw this.error('商品采购金额与批次明细不一致，无法批量撤销', 409, 'PAYMENT_BATCH_CONFLICT')
          const { last, summary } = await this.accessoryService.reconcilePayments(purchase, amount, connection)
          if (last?.action !== 'pay' || last.payment_batch_id !== batchId || summary.payment_status !== 'paid') {
            throw this.error('商品采购打款状态或批次已变化，请刷新后重试', 409, 'PAYMENT_STATE_CONFLICT')
          }
          const lineKey = crypto.createHash('sha256').update(`${requestKey}:accessory:${purchaseId}`).digest('hex').slice(0, 32)
          const lineHash = crypto.createHash('sha256').update(JSON.stringify([operatorId, batchId, purchaseId, remarks, Number(last.id)])).digest('hex')
          await this.accessoryService.repository.append({ stock_in_id: purchaseId, supplier_id: purchase.supplier_id,
            action: 'cancel', amount: amount / 100, reference_event_id: last.id, request_key: lineKey, request_hash: lineHash,
            payment_method: last.payment_method, payment_time: last.payment_time, remarks,
            operator_id: operatorId, operator_name: actor.name || actor.username || '', created_at: getBeijingTimeString() }, connection)
        }
        if (phoneIds.length) {
          await connection.query(`UPDATE phones SET payment_status=NULL, payment_method=NULL, payment_time=NULL,
            payment_remarks=NULL, payment_batch_id=NULL, payment_operator_id=NULL WHERE id IN (${phoneIds.map(() => '?').join(',')})`, phoneIds)
        }
        await connection.query("UPDATE supplier_payment_batches SET status='cancelled' WHERE id=?", [batchId])
        await connection.commit()
        return { id: batchId, replayed: false, phone_count: phoneIds.length, accessory_count: accessoryIds.length }
      } catch (error) {
        if (!started) { connection.destroy(); throw error }
        try { await connection.rollback() } catch (rollbackError) { connection.destroy(); throw rollbackError }
        throw error
      }
    })
  }
}

module.exports = SupplierUnifiedPaymentService
