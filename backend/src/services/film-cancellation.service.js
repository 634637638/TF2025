'use strict'

const SalesGoodsReturnService = require('./sales-goods-return.service')
const FilmCancellationRepository = require('../repositories/film-cancellation.repository')
const { allocateAftersaleSettlement } = require('../utils/sales-aftersale-settlement')
const { validId } = require('../utils/sale-input')
const { normalizeDateTime } = require('../utils/time')
const { assertStoreInScope, resolveStoreScope } = require('../utils/store-scope')

const reject = (message, code = 'FILM_CANCELLATION_CONFLICT', statusCode = 409) => {
  throw Object.assign(new Error(message), { code, statusCode })
}

/** 整次服务撤销的内部事务；未接HTTP前不启用，操作者、资金和提成沿用原售后账。 */
class FilmCancellationService extends SalesGoodsReturnService {
  constructor(options = {}) {
    super({ ...options, repository: options.repository || new FilmCancellationRepository() })
  }

  normalizeService(serviceId, body, actor, quote) {
    if (!validId(serviceId) || !body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['request_key', 'store_id', 'reversal_date', 'remarks', 'settlement', 'actually_used', 'reason'].includes(key)) ||
      typeof body.actually_used !== 'boolean' || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 200) {
      reject('请选择原贴膜记录、是否实际使用，并填写200字以内的撤销原因', 'FILM_CANCELLATION_INVALID', 400)
    }
    const { actually_used: actuallyUsed, reason, ...common } = body
    const input = this.normalizeOperation(common, actor, quote)
    return { ...input, order_id: null, item_id: null, service_id: Number(serviceId), actually_used: actuallyUsed, reason: reason.trim() }
  }

  async authorize(actor) {
    for (const action of ['query:view', 'query:film', 'query:cancel', 'accessories:view']) {
      if (!await this.permissionCheck(actor, action)) reject('无权撤销客户贴膜服务', 'PERMISSION_DENIED', 403)
    }
  }

  async ready(connection) {
    await super.ready(connection)
    for (const table of ['customer_film_services', 'customer_film_cancellations']) {
      if (!await this.tableExists(table, connection)) reject('贴膜撤销凭据尚未迁移', 'FILM_CANCELLATION_NOT_READY')
    }
  }

  async quote(serviceId, body, actor) { return this.runInput(this.normalizeService(serviceId, body, actor, true), actor, true) }
  async submit(serviceId, body, actor) { return this.runInput(this.normalizeService(serviceId, body, actor, false), actor, false) }

  async execute(connection, input, actor, hash, quote) {
    const repo = this.repository
    const original = await repo.service(connection, input.service_id)
    if (!original) reject('贴膜服务不存在', 'NOT_FOUND', 404)
    // 与普通售后共用先锁原订单的顺序，避免不同入口先后锁服务/订单。
    const order = await repo.order(connection, Number(original.order_id))
    if (!order) reject('原贴膜订单不存在或未完成')
    assertStoreInScope(resolveStoreScope(actor, null), order.store_id)
    const service = await repo.service(connection, input.service_id, { lock: true })
    if (!service || Number(service.order_id) !== Number(order.id) || Number(service.customer_id) !== Number(order.customer_id) ||
      Number(service.store_id) !== Number(order.store_id) || !Number.isSafeInteger(Number(service.quantity)) || Number(service.quantity) < 1) reject('贴膜服务与原订单不一致')
    if (await repo.cancellation(connection, input.service_id)) reject('该次贴膜已经撤销，请查看原撤销记录')
    const serviceTime = normalizeDateTime(service.business_time, false)
    if (!serviceTime || normalizeDateTime(new Date(`${serviceTime.replace(' ', 'T')}+08:00`), false) !== serviceTime) reject('原贴膜日期损坏，请核对原服务记录')
    if (input.time < serviceTime || input.time > this.now()) reject('撤销日期不能早于服务或晚于当前时间', 'FILM_CANCELLATION_INVALID', 400)
    if (!await repo.validStore(connection, input.store_id)) reject('办理门店不存在或已停用', 'FILM_CANCELLATION_INVALID', 400)
    const rows = await repo.serviceItems(connection, Number(order.id))
    if (!rows.length || rows.some(row => row.item_type !== 'accessory')) reject('贴膜订单含有其他业务或缺少商品明细')
    const loaded = []
    let quantity = 0
    for (const row of rows) {
      const current = await this.load(connection, { order_id: Number(order.id), item_id: Number(row.id), quantity: 0, serial_numbers: [] }, actor)
      const plan = current.plan
      if (plan.returned_quantity || plan.gift_charge_aftersale_id !== null) reject('贴膜商品已有退换货，请先核对原售后历史')
      quantity += plan.item.quantity
      const itemInput = { ...input, order_id: Number(order.id), item_id: Number(row.id), quantity: plan.item.quantity,
        serial_numbers: plan.available_serial_numbers }
      // 按原逐件凭据核对完整撤销区间，不用当前商品类型、价格或积分配置重算。
      loaded.push({ input: itemInput, loaded: await this.load(connection, itemInput, actor) })
    }
    if (quantity !== Number(service.quantity)) reject('贴膜耗材数量与原商品明细不一致')
    const lines = []
    for (const row of loaded) {
      const key = `fc:${input.request_key}:${row.input.item_id}`
      const facts = input.actually_used
        ? await this.reverseGoodsPoints(connection, row.input, row.loaded, key)
        : await this.returnGoods(connection, row.input, actor, row.loaded, key)
      lines.push({ ...row, facts })
    }
    const allocation = allocateAftersaleSettlement(lines.map(({ input: row, facts }) => ({ original_item_id: row.item_id,
      base_refund_cents: facts.base, recovery_cents: facts.recovery, compensation_cents: facts.compensation, points_delta: facts.delta })))
    const totals = allocation.totals
    const result = { service_id: input.service_id, order_id: Number(order.id), store_id: input.store_id,
      actually_used: input.actually_used, quantity, restocked_quantity: input.actually_used ? 0 : quantity,
      consumed_quantity: input.actually_used ? quantity : 0,
      base_refund_amount: totals.base_refund_cents / 100, points_recovery_amount: totals.recovery_cents / 100,
      points_compensation_amount: totals.compensation_cents / 100, refund_amount: totals.refund_cents / 100,
      collection_amount: totals.collection_cents / 100, points_delta: totals.points_delta }
    if (quote) return result
    if (input.settlement.refund_cents !== totals.refund_cents || input.settlement.collection_cents !== totals.collection_cents) reject('撤销资金已变化，请重新试算', 'CHECKOUT_RETURN_QUOTE_CHANGED')
    if ((totals.refund_cents || totals.collection_cents) && !input.settlement.confirmed) reject('请确认贴膜撤销退款或补款已完成', 'CHECKOUT_RETURN_PAYMENT_REQUIRED')
    const id = await repo.create(connection, { ...input, order_id: Number(order.id), customer_id: Number(order.customer_id),
      original_store_id: Number(order.store_id), request_hash: hash, ...totals, settlement_method: input.settlement.method,
      settlement_channel: input.settlement.channel, created_at: this.now(), result })
    for (const { input: row, loaded: { plan }, facts } of lines) {
      await repo.createAftersaleItem(connection, { aftersale_id: id, original_item_id: row.item_id, quantity: row.quantity,
        fact_snapshot: { unit_ranges: plan.unit_ranges, serial_numbers: row.serial_numbers, points_used: plan.points_used,
          points_awarded: plan.points_awarded, payable_cents: facts.base, point_entry_ids: facts.pointEntries,
          ...(plan.commission_return ? { commission_return: plan.commission_return } : {}),
          inventory_event_ids: facts.inventory?.inventory_event_ids || [], return_reason: input.reason,
          restock_confirmed: !input.actually_used,
          film_cancellation: { service_id: input.service_id, actually_used: input.actually_used },
          settlement: allocation.items.find(item => item.original_item_id === row.item_id).settlement } })
    }
    const cancellationId = await repo.appendCancellation(connection, { service_id: input.service_id, aftersale_id: id,
      actually_used: input.actually_used, reason: input.reason })
    if (!Number.isSafeInteger(cancellationId) || cancellationId < 1) reject('贴膜撤销关联保存失败')
    return { ...result, aftersale_id: id }
  }
}

module.exports = FilmCancellationService
