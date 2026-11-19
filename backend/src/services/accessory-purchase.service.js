'use strict'

const crypto = require('node:crypto')
const BaseService = require('../core/base/base.service')
const Repository = require('../repositories/accessory-purchase.repository')
const { resolveStoreScope } = require('../utils/store-scope')
const { normalizeDateTime, getBeijingTimeString } = require('../utils/time')
const { settlement } = require('../config/payment-methods.json')
const InventoryRepository = require('../repositories/accessory-inventory.repository')
const { hasTable } = require('./schema-inspector.service')
const { validId, moneyCents } = require('../utils/sale-input')
const { projectPurchaseSnapshot } = require('../utils/accessory-purchase-snapshot')
const { parsePurchaseReturnSelection, allocatePurchaseReturn, planPurchaseReturnSettlement } = require('../utils/accessory-purchase-return')
const PAYMENT_RECONCILE_PAGE_SIZE = 100

class AccessoryPurchaseService extends BaseService {
  constructor({ repository = new Repository(), inventory = new InventoryRepository(), tableExists = hasTable } = {}) {
    super(); this.repository = repository; this.inventory = inventory; this.tableExists = tableExists
  }

  async withReadSnapshot(operation) {
    return this.repository.withConnection(async connection => {
      let started = false
      try {
        await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await connection.beginTransaction()
        started = true
        return await operation(connection)
      } finally {
        if (!started) connection.destroy()
        else {
          try { await connection.rollback() }
          catch (error) { connection.destroy(); throw error }
        }
      }
    })
  }

  async returnContext(actor, id, query = {}, { includeSerials = true } = {}) {
    return this.withReturnSnapshot(actor, id, query, { includeSerials })
  }

  async withReturnSnapshot(actor, id, query, { includeSerials }, readSelection) {
    this.getActorId(actor)
    if (!validId(id) || !query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(key => !['page', 'page_size', 'store_id', 'serial_page', 'serial_search'].includes(key)) ||
      ['page', 'page_size', 'store_id', 'serial_page'].some(key => query[key] !== undefined && !validId(query[key])) ||
      Number(query.page ?? 1) > 1000000 || Number(query.serial_page ?? 1) > 1000000 || Number(query.page_size ?? 20) > 100 ||
      (query.serial_search !== undefined && (typeof query.serial_search !== 'string' || query.serial_search.length > 100 || /[\u0000-\u001f\u007f]/.test(query.serial_search)))) {
      throw this.createError('采购退供核对参数无效', 400, 'VALIDATION_ERROR')
    }
    if (!includeSerials && (query.serial_search !== undefined || query.serial_page !== undefined)) {
      throw this.createError('无权检索SN序列号', 403, 'FIELD_PERMISSION_DENIED')
    }
    const scope = resolveStoreScope(actor, query.store_id), purchaseScope = resolveStoreScope(actor, null)
    return this.withReadSnapshot(async connection => {
      for (const table of ['accessory_stock_in', 'accessory_purchase_payments', 'accessory_inventory_events', 'accessory_stock', 'accessory_serials']) {
        if (!await this.tableExists(table, connection)) throw this.createError('采购或库存结构未就绪，请先完成迁移', 409, 'PURCHASE_RETURN_NOT_READY')
      }
      // 原整单授权与库存当前所在店的授权分别核验，划拨不能扩大原采购单的可见范围。
      const original = await this.repository.returnPurchase(Number(id), purchaseScope, connection)
      if (!original) throw this.createError('采购单不存在或无权查看', 404, 'NOT_FOUND')
      const purchase = projectPurchaseSnapshot(original)
      const amount = moneyCents(purchase.total_amount), unit = moneyCents(purchase.purchase_cost)
      if (!validId(purchase.accessory_id) || !validId(purchase.supplier_id) || !validId(purchase.quantity) ||
        amount === null || unit === null || unit * Number(purchase.quantity) !== amount) {
        throw this.createError('原采购数量、单价与金额不一致，请核对原单', 409, 'PURCHASE_AMOUNT_CONFLICT')
      }
      const { summary: payment } = await this.reconcilePayments(purchase, amount, connection)
      const input = { accessoryId: Number(purchase.accessory_id), stockInId: Number(id), purchaseCost: purchase.purchase_cost,
        scope, exact: true, page: Number(query.page ?? 1), pageSize: Number(query.page_size ?? 20) }
      let serials = null
      const origin = await this.inventory.purchaseOrigin(input.accessoryId, input.stockInId, connection)
      let ledgerStatus = 'untracked'
      let batches = { data: [], current_quantity: null, pagination: { page: input.page, page_size: input.pageSize,
        total: 0, total_pages: 0, has_next: false, has_prev: input.page > 1 } }
      if (Number(origin.event_count) > 0) {
        if (Number(origin.invalid_count) !== 0 || Number(origin.quantity) !== Number(purchase.quantity) ||
          moneyCents(origin.min_cost) !== unit || moneyCents(origin.max_cost) !== unit ||
          await this.inventory.batchConflict(input, connection) || await this.inventory.purchaseBatchConflict(input, connection)) {
          throw this.createError('原采购批次、门店或SN流水不一致，请先核对', 409, 'INVENTORY_LEDGER_CONFLICT')
        }
        ledgerStatus = 'verified'
        batches = await this.inventory.currentBatches(input, connection)
        if (!Number.isSafeInteger(batches.current_quantity) || batches.current_quantity < 0 || batches.current_quantity > Number(purchase.quantity)) {
          throw this.createError('原采购批次剩余数量异常，请先核对', 409, 'INVENTORY_LEDGER_CONFLICT')
        }
        if (includeSerials) {
          serials = await this.inventory.purchaseSerials({ ...input, serialPage: Number(query.serial_page ?? 1), serialSearch: (query.serial_search ?? '').trim() }, connection)
          if (!Number.isSafeInteger(serials.pagination.total) || serials.pagination.total < 0 || serials.pagination.total > batches.current_quantity) {
            throw this.createError('原采购在库SN数量异常，请先核对', 409, 'INVENTORY_LEDGER_CONFLICT')
          }
          serials.data = serials.data.map(row => ({ id: Number(row.id), serial_number: row.serial_number,
            store_id: Number(row.store_id), store_name: row.store_name }))
        }
      }
      if (readSelection) return await readSelection({ purchase, payment, input, ledgerStatus, currentQuantity: batches.current_quantity }, connection)
      return { purchase: { ...purchase, id: Number(purchase.id), accessory_id: Number(purchase.accessory_id),
        supplier_id: Number(purchase.supplier_id), store_id: Number(purchase.store_id), ...payment },
      ledger_status: ledgerStatus, current_quantity: batches.current_quantity, serials,
      // 批次内部主键及重复的采购资料不透传；只读核对不签发可供提交的退供凭据。
      data: batches.data.map(row => ({ row_key: row.row_key, store_id: Number(row.store_id), store_name: row.store_name,
        quantity: Number(row.quantity), purchase_cost: row.purchase_cost, usage_type: row.usage_type, serial_tracking: row.serial_tracking })),
      pagination: batches.pagination }
    })
  }

  async quoteReturn(actor, id, body = {}) {
    this.getActorId(actor)
    if (!validId(id)) throw this.createError('原采购单无效', 400, 'VALIDATION_ERROR')
    const { batches, serialIds, settlementMode } = parsePurchaseReturnSelection(body)
    return this.withReturnSnapshot(actor, id, {}, { includeSerials: false }, async ({ purchase, payment, input, ledgerStatus, currentQuantity }, connection) => {
      if (ledgerStatus !== 'verified') throw this.createError('历史采购来源未核对，无法试算退供', 409, 'PURCHASE_RETURN_UNTRACKED')
      const selected = await this.inventory.purchaseReturnSelection({ ...input, serialIds, batchEventIds: batches.map(row => Number(row.row_key.slice(6))) }, connection)
      const plan = allocatePurchaseReturn({ purchase, scope: input.scope, currentQuantity, batches, serialIds, selected })
      return { purchase_id: Number(id), quantity: plan.quantity, purchase_cost: Number(purchase.purchase_cost), total_amount: plan.costCents / 100,
        payment_status: payment.payment_status, latest_event_id: payment.latest_event_id, preview_only: true,
        ...(settlementMode === undefined ? {} : { settlement: planPurchaseReturnSettlement(payment.payment_status, settlementMode, plan.costCents) }),
        data: plan.allocations.map(row => ({ row_key: row.row_key, store_id: row.store_id, store_name: row.store_name,
          quantity: row.quantity, usage_type: row.usage_type, serial_tracking: row.serial_tracking, serial_numbers: row.serial_numbers })) }
    })
  }

  async reconcilePayments(purchase, amount, connection) {
    let last = null, after = 0
    for (;;) {
      const events = await this.repository.paymentEventsAfter(purchase.id, after, PAYMENT_RECONCILE_PAGE_SIZE, connection)
      for (const event of events) {
        try { this.paymentDetails(event.payment_method, event.payment_time) }
        catch (error) {
          if (error.code !== 'VALIDATION_ERROR') throw error
          throw this.createError('采购付款方式或时间不完整，请核对原登记', 409, 'PURCHASE_PAYMENT_CONFLICT')
        }
        const valid = Number.isSafeInteger(Number(event.id)) && Number(event.id) > after &&
          Number(event.stock_in_id) === Number(purchase.id) && Number(event.supplier_id) === Number(purchase.supplier_id) &&
          moneyCents(event.amount) === amount && amount > 0 &&
          (event.action === 'pay' ? last?.action !== 'pay' && event.reference_event_id === null :
            event.action === 'cancel' && last?.action === 'pay' && Number(event.reference_event_id) === Number(last.id) &&
              event.payment_method === last.payment_method && event.payment_time === last.payment_time)
        if (!valid) throw this.createError('采购付款追加账不一致，请核对原登记', 409, 'PURCHASE_PAYMENT_CONFLICT')
        last = event; after = Number(event.id)
      }
      if (events.length < PAYMENT_RECONCILE_PAGE_SIZE) break
    }
    const paid = last?.action === 'pay'
    return { last, summary: { latest_event_id: after, payment_status: paid ? 'paid' : 'unpaid', paid_amount: paid ? amount / 100 : 0, unpaid_amount: paid ? 0 : amount / 100 } }
  }
  integer(value, label, fallback, maximum = Number.MAX_SAFE_INTEGER, min = 1) {
    if (value === undefined && fallback !== undefined) return fallback
    const number = Number(value)
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isSafeInteger(number) || number < min || number > maximum) throw this.createError(`${label}无效`, 400, 'VALIDATION_ERROR')
    return number
  }
  date(value) {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw this.createError('日期格式无效', 400, 'VALIDATION_ERROR')
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw this.createError('日期无效', 400, 'VALIDATION_ERROR')
    return value
  }
  paymentDetails(method, value) {
    if (!settlement.some(item => item.value === method) || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      throw this.createError('请选择打款方式和完整的北京时间', 400, 'VALIDATION_ERROR')
    }
    this.date(value.slice(0, 10))
    const [hours, minutes, seconds] = value.slice(11).split(':').map(Number)
    if (hours > 23 || minutes > 59 || seconds > 59) throw this.createError('打款时间无效', 400, 'VALIDATION_ERROR')
    return { method, paymentTime: normalizeDateTime(value, false) }
  }
  async list(actor, input = {}) {
    this.getActorId(actor)
    const query = { page: this.integer(input.page, '页码', 1, 1000000), page_size: this.integer(input.page_size, '每页数量', 20, 100),
      supplier_id: input.supplier_id === undefined ? undefined : this.integer(input.supplier_id, '供应商'),
      store_id: input.store_id === undefined ? undefined : this.integer(input.store_id, '店铺'),
      payment_status: input.payment_status || 'all', keyword: input.keyword === undefined ? '' : input.keyword,
      product_name: input.product_name === undefined ? '' : input.product_name,
      brand_name: input.brand_name === undefined ? '' : input.brand_name,
      supplier_name: input.supplier_name === undefined ? '' : input.supplier_name,
      store_name: input.store_name === undefined ? '' : input.store_name,
      start_date: this.date(input.start_date), end_date: this.date(input.end_date) }
    if (!['all', 'paid', 'unpaid'].includes(query.payment_status) || typeof query.keyword !== 'string' || query.keyword.length > 100 || (query.start_date && query.end_date && query.start_date > query.end_date)) throw this.createError('检索条件无效', 400, 'VALIDATION_ERROR')
    query.keyword = query.keyword.trim()
    for (const field of ['product_name', 'brand_name', 'supplier_name', 'store_name']) {
      if (typeof query[field] !== 'string' || query[field].length > 100) throw this.createError('商品名称、品牌、供应商或店铺检索条件无效', 400, 'VALIDATION_ERROR')
      query[field] = query[field].trim()
    }
    resolveStoreScope(actor, query.store_id)
    const scope = resolveStoreScope(actor, null)
    return this.withReadSnapshot(async connection => {
      const result = await this.repository.list(scope, query, connection)
      return { ...result, rows: result.rows.map(raw => { const row = projectPurchaseSnapshot(raw); return { ...row, id: Number(row.id),
        accessory_id: row.accessory_id === null || row.accessory_id === undefined ? null : Number(row.accessory_id),
        supplier_id: Number(row.supplier_id), store_id: Number(row.store_id), latest_event_id: Number(row.latest_event_id || 0) } }),
      summary: { ...result.summary, total: Number(result.summary.total) } }
    })
  }

  async options(actor) {
    this.getActorId(actor)
    const scope = resolveStoreScope(actor, null)
    return this.withReadSnapshot(async connection => this.repository.options(scope, connection))
  }

  async history(actor, id, query = {}) {
    this.getActorId(actor)
    const purchaseId = this.integer(id, '采购单')
    const page = this.integer(query.page, '页码', 1, 1000000), pageSize = this.integer(query.page_size, '每页数量', 20, 100)
    const scope = resolveStoreScope(actor, null)
    return this.withReadSnapshot(async connection => {
      if (!await this.repository.getPurchase(purchaseId, scope, connection)) throw this.createError('采购单不存在或无权查看', 404, 'NOT_FOUND')
      const result = await this.repository.history(purchaseId, page, pageSize, connection)
      return { ...result, rows: result.rows.map(row => ({ ...row, id: Number(row.id), stock_in_id: Number(row.stock_in_id),
        reference_event_id: row.reference_event_id === null || row.reference_event_id === undefined ? null : Number(row.reference_event_id), operator_id: Number(row.operator_id) })) }
    })
  }
  async record(actor, id, action, input = {}) {
    const operatorId = this.getActorId(actor)
    const purchaseId = this.integer(id, '采购单')
    const expected = this.integer(input.expected_event_id, '单据版本', undefined, Number.MAX_SAFE_INTEGER, 0)
    if (!['pay', 'cancel'].includes(action) || typeof input.request_key !== 'string' || !/^[a-f0-9]{32}$/.test(input.request_key)) throw this.createError('请求标识无效，请重新打开登记窗口', 400, 'VALIDATION_ERROR')
    const remarks = input.remarks === undefined ? '' : input.remarks
    if (typeof remarks !== 'string' || remarks.trim().length > 1000 || (action === 'cancel' && !remarks.trim())) throw this.createError('请填写有效备注，撤销必须填写原因（最多1000字）', 400, 'VALIDATION_ERROR')
    const { method, paymentTime } = action === 'pay' ? this.paymentDetails(input.payment_method, input.payment_time) : { method: null, paymentTime: null }
    const hash = crypto.createHash('sha256').update(JSON.stringify([operatorId, purchaseId, action, expected, method, paymentTime, remarks.trim()])).digest('hex')
    try {
      return await this.repository.withConnection(async connection => {
        let started = false
        try {
          await connection.beginTransaction()
          started = true
          const purchase = await this.repository.getPurchase(purchaseId, resolveStoreScope(actor, null), connection, true)
          if (!purchase) throw this.createError('采购单不存在或无权操作', 404, 'NOT_FOUND')
          const replay = await this.repository.byKey(input.request_key, connection)
          if (replay) {
            if (replay.request_hash !== hash || Number(replay.stock_in_id) !== purchaseId) throw this.createError('请求已使用，请刷新核对原登记', 409, 'PAYMENT_REQUEST_CONFLICT')
            await connection.commit()
            return { id: Number(replay.id), action: replay.action, amount: Number(replay.amount), replayed: true }
          }
          // 金额只从锁定的真实采购单读取，禁止用库存余额、模板价格或客户端金额结算。
          const cents = moneyCents(purchase.total_amount), unitCents = moneyCents(purchase.purchase_cost)
          if (cents === null || cents <= 0 || unitCents === null || !validId(purchase.quantity) ||
            unitCents * Number(purchase.quantity) !== cents) throw this.createError('采购金额为零或与原登记不符，请先核对采购单', 409, 'PURCHASE_AMOUNT_CONFLICT')
          // 原采购锁串行同单写入；完整链与核对/试算共用规则，不能只信最后一条状态。
          const { last: current, summary } = await this.reconcilePayments(purchase, cents, connection)
          if (summary.latest_event_id !== expected) throw this.createError('打款记录已变化，请刷新后重新操作', 409, 'PAYMENT_VERSION_CONFLICT')
          if ((action === 'pay' && current?.action === 'pay') || (action === 'cancel' && current?.action !== 'pay')) throw this.createError(action === 'pay' ? '该采购单已登记打款' : '该采购单没有可撤销的打款', 409, 'PAYMENT_STATE_CONFLICT')
          const eventId = await this.repository.append({ stock_in_id: purchaseId, supplier_id: purchase.supplier_id,
            action, amount: cents / 100, reference_event_id: action === 'cancel' ? current.id : null,
            request_key: input.request_key, request_hash: hash, payment_method: action === 'cancel' ? current.payment_method : method,
            payment_time: action === 'cancel' ? current.payment_time : paymentTime, remarks: remarks.trim(),
            operator_id: operatorId, operator_name: actor.name || actor.username || '', created_at: getBeijingTimeString() }, connection)
          await connection.commit()
          return { id: Number(eventId), action, amount: cents / 100, replayed: false }
        } catch (error) {
          if (!started) { connection.destroy(); throw error }
          try { await connection.rollback() }
          catch (rollbackError) { connection.destroy(); throw rollbackError }
          throw error
        }
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw this.createError('请求已处理，请刷新核对原登记', 409, 'PAYMENT_REQUEST_CONFLICT')
      throw error
    }
  }
}
module.exports = AccessoryPurchaseService
