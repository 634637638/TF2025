'use strict'

const QueryGoodsRepository = require('../repositories/query-goods.repository')
const SalesGoodsReturnService = require('./sales-goods-return.service')
const { isIntegerInput } = require('../utils/input-values')
const { validId } = require('../utils/sale-input')
const { getActorId } = require('../types/actor')
const { resolveStoreScope } = require('../utils/store-scope')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { readAftersaleSettlement } = require('../utils/sales-aftersale-settlement')
const { readCheckoutOrder } = require('../utils/checkout-order-facts')

const reject = (message, statusCode = 400, code = 'VALIDATION_ERROR') => { throw Object.assign(new Error(message), { statusCode, code }) }
const integer = (value, fallback, max) => {
  if (value === undefined) return fallback
  if (!validId(value) || Number(value) > max) reject('分页参数无效')
  return Number(value)
}
const date = value => {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) reject('日期格式无效')
  const [year, month, day] = value.split('-').map(Number), parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) reject('日期无效')
  return value
}

const invalidHistory = () => reject('售后凭据不完整，请核对原单历史', 409, 'CHECKOUT_RETURN_CONFLICT')
const historyInteger = (value, min = 0) => {
  if (!['number', 'string'].includes(typeof value) || !/^-?\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) || Number(value) < min) invalidHistory()
  return Number(value)
}
const historyRecord = (row, options, replacement = null) => {
  if (!['goods_return', 'phone_return', 'goods_exchange'].includes(row.operation_type) ||
    (row.operation_type === 'goods_exchange') !== (replacement !== null)) invalidHistory()
  const entries = readAftersaleSettlement(row, row.settlement_items, options)
  const entry = entries.find(item => Number(item.row.id) === Number(row.aftersale_item_id) && item.original_item_id === Number(row.original_item_id))
  if (!entry || entry.row.item_type !== 'accessory') invalidHistory()
  const { fact, settlement } = entry
  const quantity = historyInteger(entry.row.quantity)
  const chargedQuantity = fact.gift_charge ? historyInteger(fact.gift_charge.quantity, 1) : 0
  if (chargedQuantity && (historyInteger(fact.gift_charge.unit_cents) * chargedQuantity !== settlement.gift_charge_cents ||
    !Array.isArray(fact.gift_charge.serial_numbers) || fact.gift_charge.serial_numbers.some(sn => typeof sn !== 'string' || !sn.trim()) ||
    new Set(fact.gift_charge.serial_numbers).size !== fact.gift_charge.serial_numbers.length ||
    fact.gift_charge.serial_numbers.length && fact.gift_charge.serial_numbers.length !== chargedQuantity)) invalidHistory()
  if (!fact || !Array.isArray(fact.serial_numbers) || fact.serial_numbers.some(sn => typeof sn !== 'string' || !sn.trim()) ||
    new Set(fact.serial_numbers).size !== fact.serial_numbers.length || fact.serial_numbers.length && fact.serial_numbers.length !== quantity ||
    typeof fact.return_reason !== 'string' || !fact.return_reason.trim()) invalidHistory()
  const { base_refund_cents: base, recovery_cents: recovery, compensation_cents: compensation,
    refund_cents: refund, collection_cents: collection, offset_cents: offset, points_delta: delta } = settlement
  if (quantity === 0 && (!chargedQuantity || fact.kind !== 'gift_charge') ||
    quantity > 0 && fact.restock_confirmed !== true || quantity === 0 && fact.restock_confirmed !== false ||
    (Number(row.refund_cents) || Number(row.collection_cents) ? typeof row.settlement_method !== 'string' || !row.settlement_method : row.settlement_method !== null || row.settlement_channel !== null) ||
    row.settlement_channel !== null && typeof row.settlement_channel !== 'string') invalidHistory()
  // 明确列出公开字段，不透传请求摘要、原始快照和内部库存/积分凭据。
  return { id: historyInteger(row.id, 1), operation_type: row.operation_type, replacement,
    replacement_amount: (settlement.replacement_cents || 0) / 100,
    exchange_credit_amount: replacement ? Math.max(0, settlement.replacement_cents - collection) / 100 : 0,
    quantity, serial_numbers: fact.serial_numbers, return_reason: fact.return_reason,
    gift_charge_quantity: chargedQuantity, gift_charge_amount: (settlement.gift_charge_cents || 0) / 100,
    base_refund_amount: base / 100, points_recovery_amount: recovery / 100, points_compensation_amount: compensation / 100,
    refund_amount: refund / 100, collection_amount: collection / 100, settlement_offset_amount: offset / 100, points_delta: delta,
    points_award_returned: historyInteger(fact.points_awarded), points_redemption_returned: historyInteger(fact.points_used),
    store_id: row.store_id, store_name: row.store_name, operator_id: row.operator_id, operator_name: row.operator_name,
    settlement_method: row.settlement_method, settlement_channel: row.settlement_channel,
    business_time: row.business_time, created_at: row.created_at, remarks: row.remarks }
}

class QueryGoodsService {
  constructor({ repository = new QueryGoodsRepository(), permissionCheck = hasUnifiedPermission, goodsReturns = new SalesGoodsReturnService() } = {}) {
    Object.assign(this, { repository, permissionCheck, goodsReturns })
  }
  /** 同次查询的分页、原单、逐件SN及售后链共用只读快照，不阻塞业务写入。 */
  async readSnapshot(operation) {
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
  async authorize(actor) {
    if (!getActorId(actor)) reject('请先登录', 401, 'UNAUTHORIZED')
    for (const permission of ['query:view', 'accessories:view']) {
      if (!await this.permissionCheck(actor, permission)) reject('无权查询商品销售记录', 403, 'PERMISSION_DENIED')
    }
  }
  async list(actor, input, searchFields) {
    await this.authorize(actor)
    if (Object.keys(input).some(key => !['page', 'page_size', 'keyword', 'store_id', 'sale_type', 'start_date', 'end_date'].includes(key))) reject('存在不支持的查询条件')
    if (input.store_id !== undefined && !validId(input.store_id)) reject('门店标识无效')
    const query = { page: integer(input.page, 1, 1000000), page_size: integer(input.page_size, 20, 100),
      keyword: input.keyword ?? '', sale_type: input.sale_type, start_date: date(input.start_date), end_date: date(input.end_date) }
    if (typeof query.keyword !== 'string' || query.keyword.length > 100 ||
      (query.sale_type !== undefined && !['sale', 'gift'].includes(query.sale_type)) ||
      (query.start_date && query.end_date && query.start_date > query.end_date)) reject('查询条件无效')
    query.keyword = query.keyword.trim()
    const scope = resolveStoreScope(actor, input.store_id)
    return this.readSnapshot(connection => this.repository.list(scope, query, searchFields, connection))
  }
  async detail(actor, id) {
    await this.authorize(actor)
    if (!validId(id)) reject('销售记录标识无效')
    const scope = resolveStoreScope(actor, null)
    const result = await this.readSnapshot(connection => this.repository.detail(scope, Number(id), connection))
    if (!result) reject('商品销售记录不存在或无权查看', 404, 'NOT_FOUND')
    return result
  }
  /** 客户历史使用真实客户ID，不以手机号或姓名拼接交易归属。 */
  async customerHistory(actor, customerId, input = {}) {
    await this.authorize(actor)
    if (!await this.permissionCheck(actor, 'customers:view')) reject('无权查询客户商品记录', 403, 'PERMISSION_DENIED')
    if (!validId(customerId)) reject('客户标识无效')
    if (Object.keys(input).some(key => !['page', 'page_size'].includes(key))) reject('存在不支持的查询条件')
    const query = { page: integer(input.page, 1, 1000000), page_size: integer(input.page_size, 10, 100), customer_id: Number(customerId) }
    const scope = resolveStoreScope(actor, null)
    const result = await this.readSnapshot(connection => this.repository.list(scope, query, [], connection))
    // 定向列表不输出客户主档、采购成本/利润或内部订单明细ID；原单仍独立鉴权。
    const keys = ['id', 'sale_no', 'order_no', 'linked_phone_invoice', 'sale_type', 'store_name', 'name', 'category',
      'brand_name', 'product_model', 'color_name', 'unit', 'quantity', 'returned_quantity', 'remaining_quantity',
      'unit_price', 'total_price', 'points_awarded', 'points_used', 'deduction_amount', 'operator_name', 'sale_time', 'remarks', 'has_snapshot']
    return { ...result, data: result.data.map(row => ({ ...Object.fromEntries(keys.map(key => [key, row[key]])),
      linked_phone_invoice: scope.allStores || scope.storeIds.includes(Number(row.linked_phone_store_id)) ? row.linked_phone_invoice : null,
      has_order: Boolean(row.order_id) })) }
  }
  async phoneReceipt(actor, saleId) {
    await this.authorize(actor)
    if (!validId(saleId)) reject('手机销售记录标识无效')
    const scope = resolveStoreScope(actor, null)
    const rows = await this.readSnapshot(connection => this.repository.phoneReceipt(scope, Number(saleId), connection))
    return rows.map(({ id, name, brand_name, product_model, color_name, unit, quantity, unit_price,
      total_price, sale_type, points_used, deduction_amount, serial_numbers }) => ({
      id, name, brand_name, product_model, color_name, unit, quantity, unit_price,
      total_price, sale_type, points_used, deduction_amount, serial_numbers
    }))
  }
  async originalOrder(actor, id, source) {
    await this.authorize(actor)
    const validSourceId = source === 'phone' ? validId(id) : isIntegerInput(id) && Number(id) > 0
    if (!validSourceId || !['goods', 'phone'].includes(source)) reject('原单来源无效')
    const scope = resolveStoreScope(actor, null)
    return this.readSnapshot(async connection => {
      const result = await this.repository.originalOrder(scope, Number(id), source, connection)
      if (!result || result.items.some(row => !scope.allStores &&
        (row.sale_store_id !== null && !scope.storeIds.includes(Number(row.sale_store_id)) ||
          row.linked_phone_store_id !== null && row.linked_phone_store_id !== undefined && !scope.storeIds.includes(Number(row.linked_phone_store_id))))) {
        reject('共同原单不存在或无权查看', 404, 'NOT_FOUND')
      }
      const facts = readCheckoutOrder(result.header, result.items)
      const phoneIds = new Set(result.items.filter(row => row.item_type === 'phone').map(row => Number(row.sale_id)))
      let exchanged = false
      for (const row of result.items.filter(row => row.item_type === 'accessory')) {
        const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot
        const externalPhone = row.linked_phone_sale_id && !phoneIds.has(Number(row.linked_phone_sale_id))
        if (snapshot.exchange_source !== undefined || externalPhone) {
          const data = await this.goodsReturns.load(connection, { order_id: Number(row.order_id), item_id: Number(row.id),
            quantity: 0, serial_numbers: [] }, actor, { lock: false })
          if (Number(data.order.id) !== Number(result.header.id) || Number(data.order.customer_id) !== Number(result.header.customer_id) ||
            Number(data.row.item_id) !== Number(row.id) || (Number(data.row.linked_phone_sale_id) || null) !== (Number(row.linked_phone_sale_id) || null) ||
            data.lineage.root_order_id === Number(result.header.id)) invalidHistory()
          exchanged = true
        }
      }
      if (facts.paid_amount !== facts.final_amount && (!exchanged || result.items.length !== 1)) invalidHistory()
      return facts
    })
  }
  async aftersales(actor, id, input = {}) {
    await this.authorize(actor)
    if (!validId(id)) reject('销售记录标识无效')
    if (Object.keys(input).some(key => !['page', 'page_size'].includes(key))) reject('存在不支持的查询条件')
    const query = { page: integer(input.page, 1, 1000000), page_size: integer(input.page_size, 20, 100) }
    let result
    const verified = new Map(), replacements = new Map()
    const scope = resolveStoreScope(actor, null)
    try { result = await this.readSnapshot(connection => this.repository.aftersales(scope, Number(id), query,
      (executor, rows) => this.verifyCrossOrderItems(executor, rows, actor, verified, replacements), connection)) }
    catch (error) {
      if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) reject('售后查询结构尚未就绪，请完成售后凭据升级后重试', 409, 'CHECKOUT_RETURN_NOT_READY')
      throw error
    }
    if (!result) reject('商品销售记录不存在或无权查看', 404, 'NOT_FOUND')
    return { data: result.data.map(row => historyRecord(row, { verifiedItemOrders: verified.get(Number(row.id)) }, replacements.get(Number(row.id)) || null)), pagination: result.pagination }
  }

  /** 跨订单手机售后必须从真实换货关系重建归属，JSON中的根原单声明不能作为授权凭据。 */
  async verifyCrossOrderItems(connection, rows, actor, verified, replacements = new Map()) {
    for (const header of rows) {
      if (verified.has(Number(header.id))) continue
      const items = header.settlement_items, cross = items.filter(item => Number(item.item_order_id) !== Number(header.order_id))
      const orders = new Map()
      verified.set(Number(header.id), orders)
      if (header.operation_type === 'goods_exchange') {
        replacements.set(Number(header.id), await this.verifyExchangeHistory(connection, header, actor))
      }
      if (!cross.length) continue
      const phones = items.filter(item => item.item_type === 'phone' && Number(item.item_order_id) === Number(header.order_id))
      if (header.operation_type !== 'phone_return' || phones.length !== 1 || !validId(phones[0].sale_id)) invalidHistory()
      let phoneFact
      try { phoneFact = typeof phones[0].fact_snapshot === 'string' ? JSON.parse(phones[0].fact_snapshot) : phones[0].fact_snapshot }
      catch { invalidHistory() }
      if (!phoneFact || phoneFact.kind !== 'phone_return' || phoneFact.sale_id !== Number(phones[0].sale_id) ||
        phoneFact.phone_id !== Number(phones[0].phone_id)) invalidHistory()
      const root = await this.goodsReturns.repository.order(connection, Number(header.order_id), { lock: false })
      if (!root || Number(root.customer_id) !== Number(header.customer_id) || Number(root.store_id) !== Number(header.original_store_id)) invalidHistory()
      for (const item of cross) {
        if (item.item_type !== 'accessory') invalidHistory()
        const data = await this.goodsReturns.load(connection, { order_id: Number(item.item_order_id), item_id: Number(item.original_item_id),
          quantity: 0, serial_numbers: [] }, actor, { lock: false })
        if (data.lineage.root_order_id !== Number(header.order_id) || Number(data.row.linked_phone_sale_id) !== Number(phones[0].sale_id) ||
          Number(item.linked_phone_sale_id) !== Number(phones[0].sale_id) || Number(data.order.customer_id) !== Number(header.customer_id)) invalidHistory()
        orders.set(Number(item.original_item_id), Number(data.order.id))
      }
    }
  }

  /** 换货历史必须核验实际关系表及完整祖先链，不能仅按JSON声明展示新商品。 */
  async verifyExchangeHistory(connection, header, actor) {
    const [entry] = readAftersaleSettlement(header, header.settlement_items)
    if (entry.settlement.version !== 3) invalidHistory()
    const exchange = entry.fact.exchange
    let data
    try { data = await this.goodsReturns.load(connection, { order_id: exchange.replacement_order_id,
      item_id: exchange.replacement_item_id, quantity: 0, serial_numbers: [] }, actor, { lock: false }) }
    catch (error) { if (error.statusCode === 404) invalidHistory(); throw error }
    const repository = this.goodsReturns.repository
    const link = await repository.exchangeForItem(connection, exchange.replacement_item_id, { lock: false })
    const original = await repository.order(connection, Number(header.order_id), { lock: false })
    if (!link || !original || Number(link.aftersale_id) !== Number(header.id) ||
      Number(link.original_item_id) !== entry.original_item_id || Number(link.order_id) !== Number(header.order_id) ||
      Number(link.replacement_order_id) !== Number(data.order.id) || Number(link.quantity) !== Number(entry.row.quantity) ||
      Number(original.store_id) !== Number(header.original_store_id) || Number(original.customer_id) !== Number(header.customer_id) ||
      Number(data.order.customer_id) !== Number(header.customer_id) || Number(data.order.store_id) !== Number(header.store_id) ||
      data.lineage.root_order_id !== exchange.root_order_id || data.lineage.root_item_id !== exchange.root_item_id ||
      Number(link.exchange_credit_cents) !== Math.max(0, entry.settlement.replacement_cents - entry.settlement.collection_cents) ||
      typeof data.order.order_no !== 'string' || !data.order.order_no.trim() ||
      typeof data.row.sale_no !== 'string' || !data.row.sale_no.trim() ||
      typeof data.row.sale_operator_name !== 'string' || !data.row.sale_operator_name.trim()) invalidHistory()
    return { order_no: data.order.order_no, sale_no: data.row.sale_no, name: data.plan.item.name,
      operator_name: data.row.sale_operator_name, serial_numbers: data.plan.item.serial_numbers }
  }
}
module.exports = QueryGoodsService
