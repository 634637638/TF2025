'use strict'

const { hasGoodsPermission } = require('../utils/goods-permission')

const SalesGoodsReturnService = require('./sales-goods-return.service')
const { hasColumn } = require('./schema-inspector.service')
const { planGiftCharge } = require('../utils/checkout-goods-return')
const { allocateAftersaleSettlement } = require('../utils/sales-aftersale-settlement')
const { moneyCents } = require('../utils/sale-input')
const { normalizeReturnStockInfo } = require('./return-stock-validation')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')

const reject = (message, code = 'CHECKOUT_RETURN_CONFLICT', statusCode = 409) => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const validInteger = (value, min, max) => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max

/** 手机与原关联商品共用一次资金确认、一个连接和持久请求幂等，不删除原销售事实。 */
class SalesPhoneReturnService extends SalesGoodsReturnService {
  constructor(options = {}) {
    super(options)
    this.columnExists = options.columnExists || hasColumn
  }

  normalize(orderId, saleId, body, actor, quote) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) reject('退货内容无效', 'CHECKOUT_RETURN_INVALID', 400)
    const { accessories, ...common } = body
    delete common.return_type
    delete common.handle_method
    // 处理意向与旧退库共用选项，仅登记，不在退货事务中执行线下返厂/报废。
    const requestedDetails = {}
    for (const field of ['return_type', 'handle_method']) {
      if (Object.hasOwn(body, field)) requestedDetails[field] = body[field]
    }
    let details
    try { details = normalizeReturnStockInfo(requestedDetails, { partial: true }) }
    catch (error) { reject(error.message, 'CHECKOUT_RETURN_INVALID', 400) }
    // 共用请求键、门店、北京时间、退款/补款方式、线下确认及备注校验。
    const input = super.normalize(orderId, saleId, { ...common, quantity: 1, serial_numbers: [] }, actor, quote)
    if (Object.hasOwn(common, 'quantity') || Object.hasOwn(common, 'serial_numbers') || !Array.isArray(accessories)) {
      reject('手机退货须逐条核对关联商品', 'CHECKOUT_RETURN_INVALID', 400)
    }
    const rows = accessories.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
        Object.keys(row).some(key => !['item_id', 'quantity', 'serial_numbers', 'charge_missing', 'charge_confirmed'].includes(key)) ||
        !validInteger(row.item_id, 1, Number.MAX_SAFE_INTEGER) || !validInteger(row.quantity, 0, 999999) ||
        typeof row.charge_missing !== 'boolean' || typeof row.charge_confirmed !== 'boolean' ||
        !Array.isArray(row.serial_numbers)) reject('关联商品退回数量或赠品处理方式无效', 'CHECKOUT_RETURN_INVALID', 400)
      const serials = this.accessories.normalizeSerials(row.serial_numbers).sort()
      if (serials.length && serials.length !== Number(row.quantity)) reject('退回商品SN数量不一致', 'CHECKOUT_RETURN_INVALID', 400)
      return { item_id: Number(row.item_id), quantity: Number(row.quantity), serial_numbers: serials,
        charge_missing: row.charge_missing, charge_confirmed: row.charge_confirmed }
    }).sort((a, b) => a.item_id - b.item_id)
    if (new Set(rows.map(row => row.item_id)).size !== rows.length) reject('关联商品重复', 'CHECKOUT_RETURN_INVALID', 400)
    return { ...input, ...details, sale_id: Number(saleId), accessories: rows }
  }

  async ready(connection) {
    await super.ready(connection)
    if (!await this.columnExists('sales_aftersales', 'gift_charge_cents', connection)) {
      reject('手机及赠品售后结构尚未升级，暂不能办理', 'CHECKOUT_RETURN_NOT_READY')
    }
  }

  async authorize(actor) {
    for (const action of ['query:view', 'query:return-to-stock']) {
      if (!await this.permissionCheck(actor, action)) reject('无权办理手机退货', 'PERMISSION_DENIED', 403)
    }
  }

  async loadPhone(connection, input, actor) {
    const repo = this.repository, order = await repo.order(connection, input.order_id)
    if (!order) reject('未找到可办理的共同原单', 'NOT_FOUND', 404)
    const scope = resolveStoreScope(actor, null)
    assertStoreInScope(scope, order.store_id)
    if (!await repo.lockCustomer(connection, order.customer_id)) reject('原单客户不存在')
    const phone = await repo.phone(connection, input.order_id, input.sale_id)
    if (!phone) reject('手机销售不属于该原单，或原关联异常')
    const { item, sale } = phone, amount = moneyCents(item.total_amount)
    if (item.item_type !== 'phone' || Number(item.order_id) !== input.order_id || Number(item.sale_id) !== input.sale_id ||
      Number(item.phone_id) !== Number(sale.phone_id) || Number(sale.current_sale_id) !== input.sale_id ||
      sale.phone_status !== 'sold' || sale.sale_type !== 'retail' || sale.sale_status === 'pending' ||
      Number(sale.customer_id) !== Number(order.customer_id) || Number(sale.store_id) !== Number(order.store_id) ||
      Number(item.quantity) !== 1 || amount === null || !amount || moneyCents(item.unit_price) !== amount || moneyCents(sale.sale_price) !== amount ||
      !validInteger(item.points_awarded, 0, 2147483647) || Number(item.points_awarded) !== Number(sale.points_awarded) ||
      !sale.points_accounted_at) reject('手机原销售、金额或积分凭据不一致，请核对原单')
    assertStoreInScope(scope, sale.phone_store_id)
    if ((await repo.returns(connection, item.item_id)).length) reject('该手机原销售已办理售后，请核对历史')
    const linked = await repo.linkedGoods(connection, input.sale_id)
    if (linked.length !== input.accessories.length || linked.some((row, index) => Number(row.item_id) !== input.accessories[index].item_id)) {
      reject('关联商品已变化或未逐条核对，请刷新原单')
    }
    if (linked.length && !await this.permissionCheck(actor, 'query:goods-view')) reject('无权核对关联商品', 'PERMISSION_DENIED', 403)
    const goods = []
    for (const [index, row] of input.accessories.entries()) {
      const orderId = Number(linked[index].order_id)
      const data = await super.load(connection, { ...input, ...row, order_id: orderId }, actor)
      if (data.lineage.root_order_id !== input.order_id || Number(data.row.linked_phone_sale_id) !== input.sale_id ||
        Number(data.order.customer_id) !== Number(order.customer_id)) reject('关联商品不属于手机原单的真实换货链')
      let charge = null
      if (data.plan.item.sale_type === 'gift' && data.plan.remaining_quantity > 0) {
        if (!row.charge_missing || !row.charge_confirmed) reject('赠品必须退回，或核对原单约定并确认未退扣款')
        if (!await hasGoodsPermission(actor, 'gift', this.permissionCheck)) reject('缺少赠品未退扣款确认权限', 'PERMISSION_DENIED', 403)
        charge = planGiftCharge(data.plan, row.serial_numbers)
      } else if (row.charge_missing || row.charge_confirmed) reject('该商品不存在待扣款赠品，不能填写未退扣款确认')
      goods.push({ input: row, ...data, charge })
    }
    return { order, phone, amount, goods }
  }

  async execute(connection, input, actor, hash, quote) {
    const repo = this.repository
    if (!await repo.validStore(connection, input.store_id)) reject('接收门店不存在或已停用', 'CHECKOUT_RETURN_INVALID', 400)
    const { order, phone, amount, goods } = await this.loadPhone(connection, input, actor)
    const key = `pr:${input.request_key}`, facts = [], lines = []
    const phoneAward = Number(phone.item.points_awarded), phoneEntries = []
    let recovery = 0, delta = 0
    if (phoneAward) {
      const result = await this.pointsLedger.returnAward(connection, { customerId: Number(order.customer_id),
        sourceType: 'phone_sale', sourceId: input.sale_id, points: phoneAward, requestKey: `${key}:phone`,
        details: { reason: '手机退货', operator_id: input.actor_id, sale_id: input.sale_id } })
      recovery = result.recovery_cents; delta = result.points_delta; phoneEntries.push(result.entry_id)
    }
    lines.push({ original_item_id: Number(phone.item.item_id), base_refund_cents: amount,
      recovery_cents: recovery, compensation_cents: 0, gift_charge_cents: 0, points_delta: delta })
    facts.push({ original_item_id: Number(phone.item.item_id), quantity: 1,
      fact_snapshot: { kind: 'phone_return', sale_id: input.sale_id, phone_id: Number(phone.sale.phone_id),
        original_store_id: Number(phone.sale.phone_store_id), store_id: input.store_id, original_operator_id: phone.sale.operator_id,
        payable_cents: amount, points_used: 0, points_awarded: phoneAward, point_entry_ids: phoneEntries,
        return_reason: input.return_reason, return_type: input.return_type || '退货处理',
        handle_method: input.handle_method || '重新入库', restock_confirmed: true } })
    for (const { input: row, plan, row: original, order: goodsOrder, charge } of goods) {
      if (!row.quantity && !charge) continue // 明确保留收费搭售，不制造0件退款或返库。
      const { base, recovery: recovered, compensation: compensated, delta: changed, pointEntries: entries, inventory } =
        await this.returnGoods(connection, { ...input, ...row, order_id: Number(goodsOrder.id) }, actor, { order: goodsOrder, row: original, plan }, `${key}:${row.item_id}`)
      lines.push({ original_item_id: row.item_id, base_refund_cents: base, recovery_cents: recovered,
        compensation_cents: compensated, gift_charge_cents: charge?.amount_cents || 0, points_delta: changed })
      facts.push({ original_item_id: row.item_id, quantity: row.quantity, fact_snapshot: {
        kind: charge ? row.quantity ? 'return_and_charge' : 'gift_charge' : 'return', unit_ranges: plan.unit_ranges,
        ...(plan.commission_return ? { commission_return: plan.commission_return } : {}),
        serial_numbers: row.serial_numbers, payable_cents: base, points_used: plan.points_used, points_awarded: plan.points_awarded,
        point_entry_ids: entries, inventory_event_ids: inventory.inventory_event_ids, return_reason: input.return_reason,
        restock_confirmed: row.quantity > 0, ...(charge ? { gift_charge: charge } : {}),
        ...(plan.gift_charge_aftersale_id === null ? {} : { gift_refund_cents: plan.gift_refund_cents, gift_charge_aftersale_id: plan.gift_charge_aftersale_id }) } })
    }
    await repo.cancelPhoneSale(connection, input.sale_id, Number(phone.sale.phone_id), input.store_id, Number(phone.sale.phone_store_id))
    const allocation = allocateAftersaleSettlement(lines, { version: 2 }), total = allocation.totals
    const result = { order_id: input.order_id, sale_id: input.sale_id, phone_id: Number(phone.sale.phone_id), store_id: input.store_id,
      base_refund_amount: total.base_refund_cents / 100, points_recovery_amount: total.recovery_cents / 100,
      points_compensation_amount: total.compensation_cents / 100, gift_charge_amount: total.gift_charge_cents / 100,
      refund_amount: total.refund_cents / 100, collection_amount: total.collection_cents / 100, points_delta: total.points_delta,
      accessories: goods.map(({ input: row, plan, charge }) => ({ item_id: row.item_id, returned_quantity: row.quantity,
        remaining_quantity: plan.remaining_quantity, gift_charge_quantity: charge?.quantity || 0, gift_charge_amount: (charge?.amount_cents || 0) / 100 })) }
    if (quote) return result
    if (input.settlement.refund_cents !== total.refund_cents || input.settlement.collection_cents !== total.collection_cents) {
      reject('退款或补款结果已变化，请重新试算', 'CHECKOUT_RETURN_QUOTE_CHANGED')
    }
    if ((total.refund_cents || total.collection_cents) && !input.settlement.confirmed) reject('请确认退款或客户补款已完成', 'CHECKOUT_RETURN_PAYMENT_REQUIRED')
    const id = await repo.create(connection, { ...input, ...total, operation_type: 'phone_return', request_hash: hash,
      customer_id: Number(order.customer_id), original_store_id: Number(order.store_id), settlement_method: input.settlement.method,
      settlement_channel: input.settlement.channel, time: input.time, created_at: this.now(), result })
    const byId = new Map(allocation.items.map(row => [row.original_item_id, row.settlement]))
    for (const fact of facts) await repo.createAftersaleItem(connection, { ...fact, aftersale_id: id,
      fact_snapshot: { ...fact.fact_snapshot, settlement: byId.get(fact.original_item_id) } })
    return { ...result, aftersale_id: id }
  }
}

module.exports = SalesPhoneReturnService
