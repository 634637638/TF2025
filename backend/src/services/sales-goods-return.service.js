'use strict'

const { createHash } = require('node:crypto')
const SalesAftersaleRepository = require('../repositories/sales-aftersale.repository')
const AccessoryService = require('./accessory.service')
const CustomerPointsLedgerService = require('./customer-points-ledger.service')
const { hasTable } = require('./schema-inspector.service')
const { planGoodsReturn } = require('../utils/checkout-goods-return')
const { allocateAftersaleSettlement, readAftersaleSettlement } = require('../utils/sales-aftersale-settlement')
const { validId, moneyCents } = require('../utils/sale-input')
const { isIntegerInput, isMoneyInput } = require('../utils/input-values')
const { validateSalePayment, validateRefundPayment } = require('../utils/sale-payment')
const { normalizeDateTime, getBeijingTimeString } = require('../utils/time')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { getActorId } = require('../types/actor')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const returnOptions = require('../config/return-stock-options.json')

const reject = (message, code = 'CHECKOUT_RETURN_INVALID', statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const only = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) reject('退货包含无效或尚未支持的字段')
}
const validItemId = value => isIntegerInput(value) && Number(value) > 0
const cashCents = value => {
  if (!isMoneyInput(value) || Number(value) < 0 || typeof value === 'string' && value.startsWith('-')) return null
  const raw = Number(value) * 100, cents = Math.round(raw)
  return Number.isSafeInteger(cents) && cents <= 224748364700 && Math.abs(raw - cents) <= Number.EPSILON * Math.max(1, raw) * 4 ? cents : null
}

/** 完整商品退货事务；退款/补款是员工确认的线下资金凭据，不调用第三方支付。 */
class SalesGoodsReturnService {
  constructor({ repository = new SalesAftersaleRepository(), accessories = new AccessoryService(),
    pointsLedger = new CustomerPointsLedgerService(), tableExists = hasTable,
    permissionCheck = hasUnifiedPermission, now = getBeijingTimeString } = {}) {
    Object.assign(this, { repository, accessories, pointsLedger, tableExists, permissionCheck, now })
  }

  normalize(orderId, itemId, body, actor, quote) {
    const actorId = getActorId(actor)
    if (!actorId) reject('请先登录', 'UNAUTHORIZED', 401)
    if (!validId(orderId) || !validItemId(itemId)) reject('原单或商品明细标识无效')
    only(body, ['request_key', 'store_id', 'quantity', 'serial_numbers', 'return_reason', 'reversal_date', 'remarks', 'restock_confirmed', 'settlement'])
    if (typeof body.request_key !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(body.request_key)) reject('退货请求标识无效，请重新打开办理窗口')
    if (!validId(body.store_id) || !isIntegerInput(body.quantity) || Number(body.quantity) < 1 || Number(body.quantity) > 999999) reject('退回门店或数量无效')
    const storeId = assertStoreInScope(resolveStoreScope(actor, null), body.store_id)
    if (!returnOptions.return_reason.includes(body.return_reason)) reject('请选择有效的退货原因')
    if (body.restock_confirmed !== true) reject('请先人工核验退回实物可重新入库；待检、维修或报废暂不通过此入口办理')
    const time = typeof body.reversal_date === 'string' && normalizeDateTime(body.reversal_date, false)
    if (!time || normalizeDateTime(new Date(`${time.replace(' ', 'T')}+08:00`), false) !== time) reject('请选择有效的退货时间')
    if (body.remarks !== undefined && (typeof body.remarks !== 'string' || body.remarks.trim().length > 200)) reject('退货备注最多200字')
    if (body.serial_numbers !== undefined && !Array.isArray(body.serial_numbers)) reject('退回SN必须是列表')
    const serials = this.accessories.normalizeSerials(body.serial_numbers).sort()
    if (serials.length && serials.length !== Number(body.quantity)) reject('SN数量与退货数量不一致')
    let settlement = null
    if (body.settlement !== undefined) {
      only(body.settlement, ['refund_amount', 'collection_amount', 'method', 'channel', 'confirmed'])
      const refund = cashCents(body.settlement.refund_amount), collection = cashCents(body.settlement.collection_amount)
      if (refund === null || collection === null || refund && collection || typeof body.settlement.confirmed !== 'boolean') reject('请明确填写本次退款或补款金额及资金确认状态')
      settlement = { refund_cents: refund, collection_cents: collection,
        method: body.settlement.method ?? null, channel: body.settlement.channel ?? null, confirmed: body.settlement.confirmed }
      if (refund) {
        const payment = validateRefundPayment(settlement.method, settlement.channel)
        settlement.method = payment.refund_method; settlement.channel = payment.refund_channel
      } else if (collection) {
        const payment = validateSalePayment(settlement.method, settlement.channel)
        settlement.method = payment.payment_method; settlement.channel = payment.payment_channel
      } else if (settlement.method !== null || settlement.channel !== null) reject('无资金往来时不填写支付方式或渠道')
    }
    if (!quote && !settlement) reject('提交前请核对退款或补款结果')
    return { request_key: body.request_key.toLowerCase(), actor_id: actorId, order_id: Number(orderId), item_id: Number(itemId),
      store_id: storeId, quantity: Number(body.quantity), serial_numbers: serials, return_reason: body.return_reason,
      time, remarks: body.remarks?.trim() || '', restock_confirmed: true, settlement }
  }

  async authorize(actor) {
    for (const action of ['query:view', 'query:return-to-stock', 'accessories:view']) {
      if (!await this.permissionCheck(actor, action)) reject('无权办理商品退货', 'PERMISSION_DENIED', 403)
    }
  }

  async quote(orderId, itemId, body, actor) { return this.run(orderId, itemId, body, actor, true) }
  async submit(orderId, itemId, body, actor) { return this.run(orderId, itemId, body, actor, false) }

  async ready(connection) {
    for (const table of ['sales_aftersales', 'sales_aftersale_items']) {
      if (!await this.tableExists(table, connection)) reject('共同售后凭据尚未迁移，暂不能办理', 'CHECKOUT_RETURN_NOT_READY', 409)
    }
  }

  /** 仅核对原单剩余件数/SN；不把当前可选状态作为未来提交的授权凭据。 */
  async context(orderId, itemId, actor) {
    if (!getActorId(actor)) reject('请先登录', 'UNAUTHORIZED', 401)
    if (!validId(orderId) || !validItemId(itemId)) reject('原单或商品明细标识无效')
    await this.authorize(actor)
    return this.repository.withConnection(async connection => {
      await this.ready(connection)
      await connection.beginTransaction()
      try {
        const { plan } = await this.load(connection, { order_id: Number(orderId), item_id: Number(itemId), quantity: 0, serial_numbers: [] }, actor)
        return this.contextFacts(plan, Number(orderId), Number(itemId))
      } finally { await connection.rollback() }
    })
  }

  contextFacts(plan, orderId, itemId) {
    return { order_id: orderId, item_id: itemId, name: plan.item.name,
      sale_type: plan.item.sale_type, quantity: plan.item.quantity, returned_quantity: plan.returned_quantity,
      remaining_quantity: plan.remaining_quantity, serial_tracking: plan.item.serial_numbers.length > 0,
      serial_numbers: plan.available_serial_numbers }
  }

  async run(orderId, itemId, body, actor, quote) {
    const input = this.normalize(orderId, itemId, body, actor, quote)
    await this.authorize(actor)
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    return this.repository.withConnection(async connection => {
      await this.ready(connection)
      // 锁等待/死锁只能整体重跑事务，不在部分扣分或返库后继续执行。
      for (let attempt = 0; attempt < 3; attempt++) {
        await connection.beginTransaction()
        try {
          const previous = await this.repository.request(connection, input.request_key)
          if (previous) {
            const scope = resolveStoreScope(actor, null)
            assertStoreInScope(scope, previous.original_store_id); assertStoreInScope(scope, previous.store_id)
            if (Number(previous.created_by) !== input.actor_id || previous.request_hash !== hash) reject('请求标识已按其他内容办理，请核对原售后单', 'CHECKOUT_RETURN_REQUEST_CONFLICT', 409)
            const result = typeof previous.result_snapshot === 'string' ? JSON.parse(previous.result_snapshot) : previous.result_snapshot
            await connection.rollback()
            return { ...result, aftersale_id: Number(previous.id) }
          }
          const result = await this.execute(connection, input, actor, hash, quote)
          if (quote) await connection.rollback()
          else await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          if (attempt < 2 && ['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) continue
          throw error
        }
      }
    })
  }

  async loadOriginal(connection, input, actor, options) {
    const repo = this.repository, order = await repo.order(connection, input.order_id, options)
    if (!order) reject('未找到可办理的共同原单', 'NOT_FOUND', 404)
    assertStoreInScope(resolveStoreScope(actor, null), order.store_id)
    const customer = await repo.lockCustomer(connection, order.customer_id, options)
    if (!customer) reject('原单客户不存在，请核对原单', 'CHECKOUT_RETURN_CONFLICT', 409)
    const row = await repo.item(connection, input.order_id, input.item_id, options)
    if (!row) reject('该商品明细不属于原单', 'NOT_FOUND', 404)
    const history = await repo.returns(connection, input.item_id, options)
    const plan = planGoodsReturn(row, history, input.quantity, input.serial_numbers)
    if (Number(row.sale_customer_id) !== Number(order.customer_id) || Number(row.sale_store_id) !== Number(order.store_id) ||
      Number(row.sale_accessory_id) !== Number(row.accessory_id) || Number(row.sale_quantity) !== plan.item.quantity ||
      moneyCents(row.sale_unit_price) !== moneyCents(plan.item.unit_price) || moneyCents(row.sale_total_price) !== moneyCents(plan.item.total_amount) ||
      row.sale_type !== plan.item.sale_type) reject('原商品销售与共同明细不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
    return { order, row, plan }
  }

  /** 原件及替换件退货共用同一条链核验，不接受快照单方面声明原单关系。 */
  async load(connection, input, actor, options) {
    try {
      const loaded = await this.loadOriginal(connection, input, actor, options)
      return { ...loaded, lineage: await this.lineage(connection, loaded, actor, options) }
    } catch (error) {
      if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) {
        reject('原单或换货关联结构尚未就绪，请先完成售后升级', 'CHECKOUT_RETURN_NOT_READY', 409)
      }
      throw error
    }
  }

  async verifyRootPhone(connection, root, saleId, options) {
    const row = await this.repository.exchangeRootPhone(connection, saleId, options)
    if (!row || Number(row.order_id) !== Number(root.order.id) || row.item_type !== 'phone' ||
      Number(row.sale_id) !== saleId || Number(row.actual_sale_id) !== saleId ||
      !validId(row.phone_id) || Number(row.phone_id) !== Number(row.sale_phone_id) || Number(row.quantity) !== 1 ||
      Number(row.customer_id) !== Number(root.order.customer_id) || Number(row.store_id) !== Number(root.order.store_id) ||
      row.sale_type !== 'retail' || ![null, 'completed', 'cancelled'].includes(row.sale_status) ||
      moneyCents(row.total_amount) === null || moneyCents(row.total_amount) <= 0 ||
      moneyCents(row.unit_price) !== moneyCents(row.total_amount) || moneyCents(row.sale_price) !== moneyCents(row.total_amount)) {
      reject('换货根原单与关联手机销售不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
    }
  }

  /** 每次核对完整祖先链，不能只相信新商品快照声称的原单或手机关联。 */
  async lineage(connection, loaded, actor, { verifyRootPhone = false, lock = true } = {}) {
    const customerId = Number(loaded.order.customer_id), linked = Number(loaded.row.linked_phone_sale_id) || null
    if (loaded.row.linked_phone_sale_id !== null && loaded.row.linked_phone_sale_id !== undefined &&
      !validId(loaded.row.linked_phone_sale_id)) reject('商品关联手机标识异常', 'CHECKOUT_RETURN_CONFLICT', 409)
    let current = loaded, root = null
    const seen = new Set()
    const installed = await this.tableExists('sales_goods_exchanges', connection)
    for (;;) {
      const itemId = Number(current.row.item_id)
      if (seen.has(itemId)) reject('商品换货关联存在循环', 'CHECKOUT_RETURN_CONFLICT', 409)
      seen.add(itemId)
      const link = installed ? await this.repository.exchangeForItem(connection, itemId, { lock }) : null
      const snapshot = typeof current.row.snapshot === 'string' ? JSON.parse(current.row.snapshot) : current.row.snapshot
      if (!link) {
        if (snapshot.exchange_source !== undefined) reject('替换商品缺少原换货关联凭据', 'CHECKOUT_RETURN_CONFLICT', 409)
        if (root && (root.root_order_id !== Number(current.order.id) || root.root_item_id !== itemId)) reject('商品换货根原单不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
        if (linked && (root || verifyRootPhone)) await this.verifyRootPhone(connection, current, linked, { lock })
        return root || { root_order_id: Number(current.order.id), root_item_id: itemId }
      }
      if (!root) root = { root_order_id: Number(link.root_order_id), root_item_id: Number(link.root_item_id) }
      const source = snapshot.exchange_source
      if (Number(link.replacement_item_id) !== itemId || Number(link.replacement_order_id) !== Number(current.order.id) ||
        Number(link.original_item_id) >= itemId || Number(link.quantity) !== current.plan.item.quantity ||
        Number(link.returned_quantity) !== Number(link.quantity) || Number(link.customer_id) !== customerId ||
        Number(link.root_order_id) !== root.root_order_id || Number(link.root_item_id) !== root.root_item_id ||
        link.operation_type !== 'goods_exchange' || !source || typeof source !== 'object' || Array.isArray(source) ||
        Object.keys(source).length !== 4 || source.original_order_id !== Number(link.order_id) ||
        source.original_item_id !== Number(link.original_item_id) || source.root_order_id !== root.root_order_id || source.root_item_id !== root.root_item_id ||
        moneyCents(current.order.final_amount) !== Number(link.replacement_cents) ||
        moneyCents(current.order.paid_amount) !== Math.min(Number(link.collection_cents), Number(link.replacement_cents))) reject('商品换货关联凭据不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
      let parent
      try {
        parent = await this.loadOriginal(connection, { order_id: Number(link.order_id), item_id: Number(link.original_item_id), quantity: 0, serial_numbers: [] }, actor, { lock })
      } catch (error) {
        if (error.statusCode === 404) reject('换货上一级原单或商品明细缺失', 'CHECKOUT_RETURN_CONFLICT', 409)
        throw error
      }
      if (Number(parent.order.customer_id) !== customerId || (Number(parent.row.linked_phone_sale_id) || null) !== linked) reject('替换商品客户或手机关联不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
      const [fact] = readAftersaleSettlement({ ...link, id: Number(link.aftersale_id) }, [{ id: Number(link.aftersale_item_id),
        aftersale_id: Number(link.aftersale_id), original_item_id: Number(link.original_item_id), item_order_id: Number(parent.order.id),
        item_type: 'accessory', quantity: Number(link.quantity), fact_snapshot: link.fact_snapshot }])
      const exchange = fact.fact.exchange
      const giftRefund = Object.hasOwn(fact.fact, 'gift_refund_cents') || Object.hasOwn(fact.fact, 'gift_charge_aftersale_id')
      // 用途转换只接受真实历史中已结清的赠品扣款；不能仅改新件快照放宽原赠品责任。
      if (giftRefund ? parent.plan.item.sale_type !== 'gift' || current.plan.item.sale_type !== 'sale' ||
        current.plan.item.gift_return_unit_price !== null || parent.plan.gift_charge_aftersale_id === null ||
        fact.fact.gift_charge_aftersale_id !== parent.plan.gift_charge_aftersale_id ||
        fact.fact.gift_refund_cents !== Number(link.quantity) * moneyCents(parent.plan.item.gift_return_unit_price) ||
        fact.fact.gift_refund_cents !== fact.settlement.base_refund_cents :
        parent.plan.item.sale_type !== current.plan.item.sale_type || parent.plan.item.gift_return_unit_price !== current.plan.item.gift_return_unit_price) {
        reject('替换商品用途或原赠品实际扣款凭据不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
      }
      if (exchange.replacement_item_id !== itemId || exchange.replacement_order_id !== Number(current.order.id) ||
        exchange.root_order_id !== root.root_order_id || exchange.root_item_id !== root.root_item_id || exchange.quantity !== Number(link.quantity) ||
        Number(link.exchange_credit_cents) !== Math.max(0, fact.settlement.replacement_cents - fact.settlement.collection_cents) ||
        exchange.replacement_cents !== moneyCents(current.plan.item.total_amount)) reject('换货新商品金额或根关联与原售后不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
      current = parent
    }
  }

  /** 原积分撤回/补退与原批次返库共用事务步骤；资金及售后单由外层一次结算。 */
  async returnGoods(connection, input, actor, { order, row, plan }, key) {
    const pointEntries = []
    let recovery = 0, compensation = 0, delta = 0
    if (plan.points_awarded) {
      const result = await this.pointsLedger.returnAward(connection, { customerId: Number(order.customer_id), sourceType: 'checkout_item',
        sourceId: input.item_id, points: plan.points_awarded, requestKey: `${key}:award` })
      recovery = result.recovery_cents; delta += result.points_delta; pointEntries.push(result.entry_id)
    }
    if (plan.points_used) {
      const result = await this.pointsLedger.returnRedemption(connection, { customerId: Number(order.customer_id), itemId: input.item_id,
        points: plan.points_used, requestKey: `${key}:redeem` })
      compensation = result.compensation_cents; delta += result.points_delta; pointEntries.push(result.entry_id)
    }
    const inventory = { inventory_event_ids: [] }
    if (input.quantity) {
      Object.assign(inventory, await this.accessories.returnSaleStock({ sale_id: Number(row.accessory_sale_id), store_id: input.store_id,
        quantity: input.quantity, serial_numbers: input.serial_numbers, request_key: `${key}:stock`, remarks: input.remarks }, actor, connection, { time: input.time }))
      if (inventory.remaining_quantity !== plan.remaining_quantity || Number(inventory.accessory_id) !== Number(row.accessory_id)) reject('原返库数量与售后凭据不一致', 'CHECKOUT_RETURN_CONFLICT', 409)
    }
    const base = plan.payable_cents + plan.gift_refund_cents
    return { base, recovery, compensation, delta, pointEntries, inventory }
  }

  async execute(connection, input, actor, hash, quote) {
    const repo = this.repository
    if (!await repo.validStore(connection, input.store_id)) reject('接收门店不存在或已停用')
    const { order, row, plan } = await this.load(connection, input, actor)
    const { base, recovery, compensation, delta, pointEntries, inventory } = await this.returnGoods(connection, input, actor,
      { order, row, plan }, `gr:${input.request_key}`)
    const giftRefund = plan.gift_charge_aftersale_id !== null
    const allocation = allocateAftersaleSettlement([{ original_item_id: input.item_id,
      base_refund_cents: base, recovery_cents: recovery, compensation_cents: compensation, points_delta: delta,
      ...(giftRefund ? { gift_charge_cents: 0 } : {}) }], { version: giftRefund ? 2 : 1 })
    const { refund_cents: refund, collection_cents: collection } = allocation.totals
    const result = { order_id: input.order_id, item_id: input.item_id, store_id: input.store_id, quantity: input.quantity,
      serial_numbers: input.serial_numbers, remaining_quantity: plan.remaining_quantity,
      base_refund_amount: base / 100, points_recovery_amount: recovery / 100, points_compensation_amount: compensation / 100,
      refund_amount: refund / 100, collection_amount: collection / 100, points_delta: delta,
      points_award_returned: plan.points_awarded, points_redemption_returned: plan.points_used }
    if (quote) return result
    if (input.settlement.refund_cents !== refund || input.settlement.collection_cents !== collection) reject('退款或补款结果已变化，请重新试算核对', 'CHECKOUT_RETURN_QUOTE_CHANGED', 409)
    if ((refund || collection) && !input.settlement.confirmed) reject(collection ? '请确认客户已补足差价后再结清退货' : '请确认已按核对金额退款后再结清退货', 'CHECKOUT_RETURN_PAYMENT_REQUIRED', 409)
    const id = await repo.create(connection, { ...input, original_store_id: Number(order.store_id), customer_id: Number(order.customer_id),
      request_hash: hash, base_refund_cents: base, recovery_cents: recovery, compensation_cents: compensation,
      refund_cents: refund, collection_cents: collection, points_delta: delta, settlement_method: input.settlement.method,
      settlement_channel: input.settlement.channel, created_at: this.now(), result })
    await repo.createAftersaleItem(connection, { aftersale_id: id, original_item_id: input.item_id, quantity: input.quantity,
      fact_snapshot: { unit_ranges: plan.unit_ranges, serial_numbers: input.serial_numbers, points_used: plan.points_used,
        ...(plan.commission_return ? { commission_return: plan.commission_return } : {}),
        points_awarded: plan.points_awarded, payable_cents: base, point_entry_ids: pointEntries,
        ...(giftRefund ? { gift_refund_cents: plan.gift_refund_cents, gift_charge_aftersale_id: plan.gift_charge_aftersale_id } : {}),
        inventory_event_ids: inventory.inventory_event_ids, return_reason: input.return_reason, restock_confirmed: true,
        settlement: allocation.items[0].settlement } })
    return { ...result, aftersale_id: id }
  }
}

module.exports = SalesGoodsReturnService
