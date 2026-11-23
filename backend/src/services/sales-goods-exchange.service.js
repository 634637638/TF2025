'use strict'

const { hasGoodsPermission } = require('../utils/goods-permission')

const { createHash } = require('node:crypto')
const SalesGoodsReturnService = require('./sales-goods-return.service')
const SalesCheckoutService = require('./sales-checkout.service')
const SalesGoodsExchangeRepository = require('../repositories/sales-goods-exchange.repository')
const { normalizeCheckoutGoods } = require('../utils/checkout-goods-input')
const { allocateAftersaleSettlement } = require('../utils/sales-aftersale-settlement')
const { validId } = require('../utils/sale-input')
const { isIntegerInput } = require('../utils/input-values')
const { hasColumn } = require('./schema-inspector.service')
const { prepareInvoiceNumberTransaction } = require('../utils/invoice-number')

const reject = (message, code = 'CHECKOUT_RETURN_CONFLICT', statusCode = 409) => {
  throw Object.assign(new Error(message), { statusCode, code })
}

/** 原单换货编排；旧件返库、新件出库与净差价凭据在同一连接提交。 */
class SalesGoodsExchangeService extends SalesGoodsReturnService {
  constructor(options = {}) {
    super({ ...options, repository: options.repository || new SalesGoodsExchangeRepository() })
    this.columnExists = options.columnExists || hasColumn
    this.checkout = options.checkout || new SalesCheckoutService({ repository: this.repository,
      accessories: this.accessories, pointsLedger: this.pointsLedger, permissionCheck: this.permissionCheck })
  }

  async authorize(actor) {
    for (const action of ['query:view', 'query:exchange', 'query:goods-view']) {
      if (!await this.permissionCheck(actor, action)) reject('无权办理商品换货', 'PERMISSION_DENIED', 403)
    }
  }

  async prepareTransaction(connection) {
    await prepareInvoiceNumberTransaction(connection)
  }

  contextFacts(plan, orderId, itemId) {
    return { ...super.contextFacts(plan, orderId, itemId),
      replacement_sale_type: plan.item.sale_type === 'gift' ? 'sale' : plan.item.sale_type,
      gift_charge_settled: plan.gift_charge_aftersale_id !== null }
  }

  normalize(orderId, itemId, body, actor, quote) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) reject('换货内容无效', 'CHECKOUT_RETURN_INVALID', 400)
    const { replacement, additional_goods: additionalGoods = [], operator_id: operator, quantity: requestedQuantity, ...common } = body
    if (!replacement || typeof replacement !== 'object' || Array.isArray(replacement) ||
      Object.keys(replacement).some(key => !['accessory_id', 'quantity', 'unit_price', 'serial_numbers', 'redeem_points'].includes(key)) ||
      replacement.serial_numbers !== undefined && !Array.isArray(replacement.serial_numbers)) reject('替换商品内容无效', 'CHECKOUT_RETURN_INVALID', 400)
    const replacementQuantity = replacement.quantity === undefined ? requestedQuantity : replacement.quantity
    if (!isIntegerInput(replacementQuantity) || Number(replacementQuantity) < 1 || requestedQuantity !== undefined && Number(requestedQuantity) !== Number(replacementQuantity)) {
      reject('换入商品数量无效或与本次换货数量不一致', 'CHECKOUT_RETURN_INVALID', 400)
    }
    const input = super.normalize(orderId, itemId, { ...common, quantity: Number(replacementQuantity) }, actor, quote)
    if (operator !== undefined && !validId(operator)) reject('请选择有效的销售员', 'CHECKOUT_RETURN_INVALID', 400)
    const goods = normalizeCheckoutGoods([{ ...replacement, key: 'replacement', quantity: input.quantity,
      sale_type: Number(replacement.unit_price) === 0 ? 'gift' : 'sale' }], {
      normalizeSerials: value => this.accessories.normalizeSerials(value) })
    if (!Array.isArray(additionalGoods) || additionalGoods.length > 999) reject('额外购买商品数量无效', 'CHECKOUT_RETURN_INVALID', 400)
    const additional = normalizeCheckoutGoods(additionalGoods.map((row, index) => ({ ...row, key: `additional_${index}`,
      sale_type: row.sale_type || 'sale', linked_phone_id: null })), { normalizeSerials: value => this.accessories.normalizeSerials(value) })
    if (additional.items.some(row => row.sale_type === 'sale' && row.unit_price <= 0 || row.redeem_points)) {
      reject('额外购买须按正常售价收款，赠送商品不能抵扣积分', 'CHECKOUT_RETURN_INVALID', 400)
    }
    return { ...input, operation_type: 'goods_exchange', operator_id: Number(operator ?? input.actor_id), replacement: goods.items[0], additional_goods: additional.items }
  }

  async ready(connection) {
    await super.ready(connection)
    if (!await this.tableExists('sales_goods_exchanges', connection) || !await this.tableExists('sales_goods_exchange_additions', connection) ||
      !await this.columnExists('sales_aftersales', 'replacement_cents', connection) ||
      !await this.columnExists('sales_aftersales', 'additional_cents', connection)) reject('换货关联及差价凭据尚未迁移', 'CHECKOUT_RETURN_NOT_READY')
    if (!await this.pointsLedger.ready(connection) || !await this.tableExists('customer_points_aftersales', connection)) reject('换货须先完成积分来源及售后凭据迁移', 'POINTS_AFTERSALE_NOT_READY')
  }

  async execute(connection, input, actor, hash, quote) {
    const repo = this.repository
    if (!await repo.validStore(connection, input.store_id)) reject('换货门店不存在或已停用', 'CHECKOUT_RETURN_INVALID', 400)
    const seller = await repo.seller(connection, input.operator_id)
    if (!seller) reject('销售员不存在或已停用', 'CHECKOUT_RETURN_INVALID', 400)
    const loaded = await super.load(connection, input, actor, { verifyRootPhone: true }), { order, row, plan } = loaded
    if (typeof order.customer_name !== 'string' || order.customer_name.trim().length < 2 || order.customer_name.length > 50 ||
      typeof order.customer_phone !== 'string' || !/^1[3-9]\d{9}$/.test(order.customer_phone)) reject('原单客户快照不完整，请先核对原单')
    const root = loaded.lineage
    const giftRefund = plan.gift_charge_aftersale_id !== null
    const replacementType = plan.item.sale_type === 'gift' ? 'sale' : plan.item.sale_type
    if (input.replacement.sale_type !== replacementType) reject('赠品或收费商品换货均按当前换入商品销售价核算，请选择收费商品换货')
    if (!await hasGoodsPermission(actor, replacementType === 'gift' ? 'gift' : 'create', this.permissionCheck)) reject('缺少替换商品销售或赠送权限', 'PERMISSION_DENIED', 403)
    if (input.additional_goods.some(item => item.sale_type === 'sale') && !await hasGoodsPermission(actor, 'create', this.permissionCheck)) reject('缺少额外购买商品销售权限', 'PERMISSION_DENIED', 403)
    if (input.additional_goods.some(item => item.sale_type === 'gift') && !await hasGoodsPermission(actor, 'gift', this.permissionCheck)) reject('缺少额外商品赠送权限', 'PERMISSION_DENIED', 403)
    const config = await this.checkout.getPointsConfig(connection)
    const pointsSnapshot = input.replacement.redeem_points ? await this.pointsLedger.snapshot(connection, Number(order.customer_id), { preserveSources: true }) : null
    const original = await this.returnGoods(connection, input, actor, loaded, `gx:${input.request_key}`)
    const replacement = { ...input.replacement, ...(replacementType === 'gift' && plan.item.gift_return_unit_price !== null ? { gift_return_unit_price: plan.item.gift_return_unit_price } : {}) }
    const orderId = await repo.createOrder(connection, { order_no: await this.checkout.createOrderNo(connection, input.time),
      request_key: createHash('sha256').update(`goods_exchange:${input.request_key}`).digest('hex').slice(0, 32), request_hash: hash,
      customer_id: Number(order.customer_id), customer_name: order.customer_name, customer_phone: order.customer_phone,
      store_id: input.store_id, operator_id: input.operator_id, created_by: input.actor_id, time: input.time, remarks: input.remarks, config })
    const goods = await this.checkout.issueGoods(connection, { ...input, customer: { name: order.customer_name, phone: order.customer_phone }, accessories: [replacement, ...input.additional_goods] }, actor,
      { orderId, customerId: Number(order.customer_id), seller, config, pointsSnapshot, linkedSales: new Map([['replacement', Number(row.linked_phone_sale_id) || null]]),
        exchangeSource: { original_order_id: input.order_id, original_item_id: input.item_id, ...root } })
    await this.checkout.creditPoints(connection, Number(order.customer_id), goods.goodsPoints, { sources: goods.goodsPointSources })
    const replacementItem = goods.items.find(item => item.key === 'replacement')
    const replacementCents = Number(replacementItem?.payable_cents || 0)
    const additionalCents = goods.items.filter(item => item.key !== 'replacement').reduce((sum, item) => sum + Number(item.payable_cents || 0), 0)
    const allocation = allocateAftersaleSettlement([{ original_item_id: input.item_id, base_refund_cents: original.base,
        recovery_cents: original.recovery, compensation_cents: original.compensation, gift_charge_cents: 0, replacement_cents: replacementCents,
        additional_cents: additionalCents, points_delta: original.delta - goods.used + goods.goodsPoints }], { version: 4 }), total = allocation.totals
    const result = { order_id: input.order_id, item_id: input.item_id, store_id: input.store_id, operator_id: input.operator_id, quantity: input.quantity,
      serial_numbers: input.serial_numbers, remaining_quantity: plan.remaining_quantity, replacement_accessory_id: replacement.accessory_id,
      replacement_serial_numbers: replacement.serial_numbers, replacement_amount: replacementCents / 100, additional_amount: additionalCents / 100,
      additional_goods: goods.items.filter(item => item.key !== 'replacement').map(item => ({ accessory_id: input.additional_goods.find(row => row.key === item.key)?.accessory_id,
        quantity: input.additional_goods.find(row => row.key === item.key)?.quantity, amount: Number(item.payable_cents || 0) / 100,
        sale_type: input.additional_goods.find(row => row.key === item.key)?.sale_type,
        serial_numbers: input.additional_goods.find(row => row.key === item.key)?.serial_numbers || [] })),
      points_used: goods.used, points_earned: goods.goodsPoints, deduction_amount: goods.deduction / 100,
      base_refund_amount: original.base / 100, points_recovery_amount: original.recovery / 100, points_compensation_amount: original.compensation / 100,
      points_award_returned: plan.points_awarded, points_redemption_returned: plan.points_used, points_delta: total.points_delta,
      refund_amount: total.refund_cents / 100, collection_amount: total.collection_cents / 100,
      replacement_paid_amount: Math.min(replacementCents, Math.max(0, total.collection_cents - additionalCents)) / 100,
      additional_paid_amount: Math.min(additionalCents, total.collection_cents) / 100,
      original_collection_amount: Math.max(0, total.collection_cents - replacementCents - additionalCents) / 100 }
    if (quote) return result
    if (input.settlement.refund_cents !== total.refund_cents || input.settlement.collection_cents !== total.collection_cents) reject('换货差价已变化，请重新试算', 'CHECKOUT_RETURN_QUOTE_CHANGED')
    if ((total.refund_cents || total.collection_cents) && !input.settlement.confirmed) reject('请确认换货退款或客户补款已完成', 'CHECKOUT_RETURN_PAYMENT_REQUIRED')
    const replacementItemId = Number(replacementItem.id), credit = Math.max(0, replacementCents - result.replacement_paid_amount * 100)
    Object.assign(result, { replacement_order_id: Number(orderId), replacement_item_id: replacementItemId,
      exchange_credit_amount: credit / 100, ...root })
    const id = await repo.create(connection, { ...input, ...total, additional_cents: additionalCents, request_hash: hash, customer_id: Number(order.customer_id),
      original_store_id: Number(order.store_id), settlement_method: input.settlement.method, settlement_channel: input.settlement.channel,
      created_at: this.now(), result })
    await repo.createAftersaleItem(connection, { aftersale_id: id, original_item_id: input.item_id, quantity: input.quantity,
      fact_snapshot: { kind: 'return', unit_ranges: plan.unit_ranges, serial_numbers: input.serial_numbers,
        ...(plan.commission_return ? { commission_return: plan.commission_return } : {}),
        points_used: plan.points_used, points_awarded: plan.points_awarded, payable_cents: original.base,
        point_entry_ids: original.pointEntries, inventory_event_ids: original.inventory.inventory_event_ids,
        ...(giftRefund ? { gift_refund_cents: plan.gift_refund_cents, gift_charge_aftersale_id: plan.gift_charge_aftersale_id } : {}),
        return_reason: input.return_reason, restock_confirmed: true, settlement: allocation.items[0].settlement,
        exchange: { replacement_order_id: Number(orderId), replacement_item_id: replacementItemId, replacement_cents: replacementCents, additional_cents: additionalCents, quantity: input.quantity, ...root } } })
    await repo.createExchange(connection, { aftersale_id: id, original_item_id: input.item_id, replacement_order_id: Number(orderId),
      replacement_item_id: replacementItemId, quantity: input.quantity, exchange_credit_cents: credit, ...root })
    for (const item of goods.items.filter(entry => entry.key !== 'replacement')) await repo.createExchangeAddition(connection, { aftersale_id: id,
      replacement_order_id: Number(orderId), replacement_item_id: Number(item.id), quantity: input.additional_goods.find(row => row.key === item.key)?.quantity || 0,
      amount_cents: Number(item.payable_cents || 0) })
    const orderAmount = goods.items.reduce((sum, item) => sum + Number(item.gross_cents || 0), 0)
    const finalAmount = goods.items.reduce((sum, item) => sum + Number(item.payable_cents || 0), 0)
    await repo.completeExchangeOrder(connection, { id: orderId, total_amount: orderAmount / 100, final_amount: finalAmount / 100,
      total_cost: goods.totalCost === null ? null : goods.totalCost / 100, total_profit: goods.totalCost === null ? null : (finalAmount - goods.totalCost) / 100,
      paid_amount: result.replacement_paid_amount + result.additional_paid_amount, points_awarded: goods.goodsPoints, payment_method: input.settlement.method,
      payment_channel: input.settlement.channel, time: input.time, result: { ...result, aftersale_id: id } })
    return { ...result, aftersale_id: id }
  }
}

module.exports = SalesGoodsExchangeService
