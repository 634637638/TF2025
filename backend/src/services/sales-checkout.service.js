'use strict'

const crypto = require('node:crypto')
const SalesCheckoutRepository = require('../repositories/sales-checkout.repository')
const SalesPhoneService = require('./sales-phone.service')
const AccessoryService = require('./accessory.service')
const InventoryService = require('./inventory.service')
const CustomerPointsLedgerService = require('./customer-points-ledger.service')
const FilmService = require('./film-service.service')
const { normalizeCheckoutGoods } = require('../utils/checkout-goods-input')
const { normalizeQuickCheckoutPhone } = require('../utils/quick-checkout-phone')
const { validId, moneyCents } = require('../utils/sale-input')
const { validateSalePayment } = require('../utils/sale-payment')
const { normalizeDateTime } = require('../utils/time')
const { prepareInvoiceNumberTransaction } = require('../utils/invoice-number')
const { getCustomerPointsConfig, creditCheckoutPoints } = require('./customer-points.service')
const { quoteCheckoutPoints } = require('../utils/checkout-points')
const { createGoodsCommission } = require('../utils/goods-commission')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { getActorId } = require('../types/actor')
const { hasUnifiedPermission } = require('../middleware/unified-auth')

const reject = (message, statusCode = 400, code = 'CHECKOUT_INVALID') => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const only = (value, keys) => {
  if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) reject('结算包含无效或尚未支持的字段')
}
const text = (value, max, label) => {
  if (value === undefined) return ''
  if (typeof value !== 'string' || value.trim().length > max) reject(`${label}格式无效或过长`)
  return value.trim()
}
const noRedemption = value => {
  if (value !== undefined && value !== 0 && value !== '0') reject('请在商品明细中填写抵扣积分，手机和整单抵扣尚未开放', 400, 'POINTS_REDEMPTION_NOT_READY')
}
const addCost = (total, cost) => {
  if (cost === null) return null
  const cents = moneyCents(cost)
  if (cents === null) reject('实际采购成本异常，请核对后再结算', 409)
  if (total === null) return null
  if (total + cents >= 10000000000) reject('整单采购成本超出范围', 400)
  return total + cents
}

class SalesCheckoutService {
  constructor({ repository = new SalesCheckoutRepository(), phones = new SalesPhoneService(),
    accessories = new AccessoryService(), inventory = new InventoryService(), pointsLedger = new CustomerPointsLedgerService(), permissionCheck = hasUnifiedPermission,
    prepareInvoice = prepareInvoiceNumberTransaction, getPointsConfig = getCustomerPointsConfig, creditPoints = creditCheckoutPoints,
    normalizeDate = normalizeDateTime, createOrderNo = () => `SO${crypto.randomUUID().replaceAll('-', '')}`, films = new FilmService() } = {}) {
    Object.assign(this, { repository, phones, accessories, inventory, pointsLedger, permissionCheck, prepareInvoice, getPointsConfig, creditPoints, normalizeDate, createOrderNo, films })
  }

  normalize(body, actor) {
    only(body, ['request_key', 'store_id', 'operator_id', 'customer_info', 'phones', 'quick_phone', 'accessories', 'sale_time', 'remarks', 'payment_info', 'redeem_points', 'film_service'])
    noRedemption(body.redeem_points)
    if (typeof body.request_key !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(body.request_key)) reject('结算请求标识无效，请重新打开销售窗口')
    const actorId = getActorId(actor)
    if (!actorId) reject('请先登录', 401, 'UNAUTHORIZED')
    if (!validId(body.store_id) || !validId(body.operator_id ?? actorId)) reject('请选择有效的门店和销售员')
    const storeId = assertStoreInScope(resolveStoreScope(actor, null), body.store_id)
    only(body.customer_info, ['name', 'phone', 'apple_id'])
    const customer = { name: text(body.customer_info.name, 50, '客户姓名'), phone: text(body.customer_info.phone, 20, '手机号').replace(/\D/g, '') }
    if (customer.name.length < 2 || !/^1[3-9]\d{9}$/.test(customer.phone)) reject('请填写客户姓名和有效手机号')
    if (body.customer_info.apple_id !== undefined) customer.apple_id = text(body.customer_info.apple_id, 100, 'Apple ID')
    const time = this.normalizeDate(body.sale_time, false)
    if (!body.sale_time || !time) reject('销售时间格式无效')
    const quickPhone = body.quick_phone === undefined ? null : normalizeQuickCheckoutPhone(body.quick_phone)
    if (quickPhone && body.phones !== undefined && (!Array.isArray(body.phones) || body.phones.length)) reject('快速出库不能同时选择已有库存手机')
    // 临时关联1仅在规范化载荷内标识本次新设备，落账前替换为真实设备ID。
    const phones = quickPhone ? [{ phone_id: 1, sale_price: quickPhone.sale_price }] : body.phones ?? [], accessories = body.accessories ?? []
    if (quickPhone && (!Array.isArray(accessories) || !accessories.length)) reject('快速共同结算须包含搭售或赠送商品')
    if (!Array.isArray(phones) || !Array.isArray(accessories) || !phones.length && !accessories.length || phones.length + accessories.length > 1000) reject('请添加有效的销售明细，每单最多1000条')
    const phoneIds = new Set()
    let total = 0
    const normalizedPhones = phones.map(row => {
      only(row, ['phone_id', 'sale_price', 'redeem_points'])
      noRedemption(row.redeem_points)
      const cents = moneyCents(row.sale_price)
      if (!validId(row.phone_id) || cents === null || !cents || phoneIds.has(Number(row.phone_id))) reject('手机重复或价格无效')
      phoneIds.add(Number(row.phone_id)); total += cents
      return { phone_id: Number(row.phone_id), sale_price: cents / 100 }
    }).sort((a, b) => a.phone_id - b.phone_id)
    const goods = normalizeCheckoutGoods(accessories, { phoneIds, normalizeSerials: value => this.accessories.normalizeSerials(value) })
    const normalizedAccessories = goods.items, goodsTotal = goods.total_cents
    total += goodsTotal
    if (!Number.isSafeInteger(total) || total >= 10000000000) reject('结算总金额超出范围')
    only(body.payment_info, ['payment_method', 'payment_channel', 'transaction_no', 'payment_time', 'payment_amount', 'payment_status'])
    const payment = validateSalePayment(body.payment_info.payment_method, body.payment_info.payment_channel)
    if (body.payment_info.payment_status !== undefined && body.payment_info.payment_status !== 'success') reject('结算收款状态必须为成功')
    const hasRedemption = normalizedAccessories.some(row => row.redeem_points)
    const paidCents = body.payment_info.payment_amount === undefined ? null : moneyCents(body.payment_info.payment_amount)
    if (hasRedemption && paidCents === null) reject('积分抵扣结算须填写实际收款金额')
    if (!hasRedemption && body.payment_info.payment_amount !== undefined && paidCents !== total) reject('实收须与整单明细合计一致，本接口暂不支持定金或部分收款')
    const paymentTime = this.normalizeDate(body.payment_info.payment_time || time, true)
    if (!paymentTime) reject('收款时间格式无效')
    return { request_key: body.request_key.toLowerCase(), store_id: storeId, actor_id: actorId, operator_id: Number(body.operator_id ?? actorId),
      customer, phones: normalizedPhones, accessories: normalizedAccessories, time, remarks: text(body.remarks, 1000, '备注'),
      payment: { ...payment, transaction_no: text(body.payment_info.transaction_no ?? undefined, 100, '交易流水号') || null, payment_time: paymentTime },
      total_cents: total, goods_cents: goodsTotal, ...(hasRedemption ? { paid_cents: paidCents } : {}), ...(quickPhone ? { quick_phone: quickPhone } : {}),
      ...(body.film_service === undefined ? {} : { film_service: this.films.normalize(body.film_service) }) }
  }

  async authorize(input, actor) {
    if (input.film_service) await this.films.authorize(actor)
    const allowed = async permissions => {
      for (const permission of permissions) if (await this.permissionCheck(actor, permission)) return true
      return false
    }
    if (input.phones.length && !await allowed(input.quick_phone ? ['inventory:sell'] : ['sales:sell', 'inventory:sell'])) reject('无权销售手机', 403, 'PERMISSION_DENIED')
    if (input.quick_phone && !await allowed(['query:view'])) reject('无权使用综合查询快速出库', 403, 'PERMISSION_DENIED')
    if (input.quick_phone && !await allowed(['query:create'])) reject('无权创建综合查询快速出库', 403, 'PERMISSION_DENIED')
    if (input.accessories.some(row => row.sale_type === 'sale') && !await allowed(['accessories:create'])) reject('无权销售商品', 403, 'PERMISSION_DENIED')
    if (input.accessories.some(row => row.sale_type === 'gift') && !await allowed(['accessories:gift'])) reject('无权赠送商品', 403, 'PERMISSION_DENIED')
  }

  /** 只读试算，关闭事务释放锁；实际结算仍按当时配置、余额和商品重新核验。 */
  async quote(body, actor) {
    const input = this.normalize(body, actor)
    await this.authorize(input, actor)
    return this.repository.withConnection(async connection => {
      await connection.beginTransaction()
      try {
        if (!await this.repository.validStore(connection, input.store_id)) reject('门店不存在或已停用')
        const customer = await this.repository.customerByPhone(connection, input.customer.phone)
        if (input.film_service) await this.films.prepare(connection, input, customer?.id, { lock: false })
        const config = await this.getPointsConfig(connection)
        const ready = await this.pointsLedger.ready(connection)
        const snapshot = customer && ready ? await this.pointsLedger.snapshot(connection, Number(customer.id)) : null
        const balance = customer ? Number(customer.points) : 0
        const phones = input.quick_phone ? [{ id: 1, store_id: input.store_id, is_new: input.quick_phone.is_new }]
          : await this.repository.phoneSnapshots(connection, input.phones.map(row => row.phone_id))
        if (phones.length !== input.phones.length) reject('部分手机不存在', 404)
        const items = input.phones.map(row => {
          const phone = phones.find(item => Number(item.id) === row.phone_id)
          if (Number(phone.store_id) !== input.store_id) reject('本单手机必须属于选择的销售门店')
          return { key: `phone:${row.phone_id}`, source: Number(phone.is_new) === 1 ? 'new' : 'used',
            amount_cents: moneyCents(row.sale_price), is_gift: false }
        })
        for (const row of input.accessories) {
          const product = await this.accessories.lockSaleProduct(row.accessory_id, connection)
          items.push({ key: `goods:${row.key}`, source: 'accessory', amount_cents: moneyCents(row.unit_price),
            quantity: row.quantity, is_gift: row.sale_type === 'gift', redeem_points: row.redeem_points || 0, category_id: product.category_id })
        }
        const quote = quoteCheckoutPoints({ config, items, availablePoints: snapshot?.available_points || 0, balance })
        const { config_snapshot: _config, ...result } = quote
        return { ...result, available_points: snapshot?.available_points || 0, balance,
          redemption_ready: ready && config.redemption.enabled,
          points_per_yuan: config.redemption.enabled ? config.redemption.points_per_yuan : null }
      } finally { await connection.rollback() }
    })
  }

  async checkout(body, actor) {
    const input = this.normalize(body, actor)
    await this.authorize(input, actor)
    const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
    return this.repository.withConnection(async connection => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (input.phones.length) await this.prepareInvoice(connection)
        await connection.beginTransaction()
        try {
          const previous = await this.repository.findRequest(connection, input.request_key)
          if (previous) {
            if (Number(previous.created_by) !== input.actor_id || previous.request_hash !== hash) reject('此请求标识已用于其他结算，请勿重复修改提交', 409, 'CHECKOUT_REQUEST_CONFLICT')
            if (!previous.checkout_result) reject('结算尚未完成，请稍后核对', 409, 'CHECKOUT_PENDING')
            const result = typeof previous.checkout_result === 'string' ? JSON.parse(previous.checkout_result) : previous.checkout_result
            await connection.commit()
            return result
          }
          const result = await this.execute(connection, input, actor, hash)
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          if (attempt < 2 && ['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) continue
          throw error
        }
      }
    })
  }

  /** 同连接建立商品出库及积分消费事实；不发放奖励、不收款、不完成订单或提交事务。 */
  async issueGoods(connection, input, actor, { orderId, customerId, seller, config, pointsSnapshot, phoneSales = new Map(), linkedSales = new Map(), exchangeSource, initialCost = 0 }) {
    const repo = this.repository
    let goodsPoints = 0, used = 0, deduction = 0, totalCost = initialCost
    const items = []
    const goodsPointSources = []
    for (const row of input.accessories) {
      const linkedPhoneSaleId = linkedSales.get(row.key) ?? phoneSales.get(row.linked_phone_id)
      let quote
      const issued = await this.accessories.issueSale({ ...row, store_id: input.store_id, customer_id: customerId,
        customer_name: input.customer.name, customer_phone: input.customer.phone, remarks: input.remarks }, actor, connection,
      { time: input.time, sellerId: seller.id, sellerName: seller.name || seller.username,
        resolveTotalCents: product => {
          quote = quoteCheckoutPoints({ config, availablePoints: row.redeem_points || 0, items: [{ key: row.key, source: 'accessory',
            amount_cents: moneyCents(row.unit_price), quantity: row.quantity, is_gift: row.sale_type === 'gift',
            redeem_points: row.redeem_points || 0, category_id: product.category_id }] })
          return quote.payable_cents
        } })
      const points = quote.points_awarded
      goodsPoints += points; used += quote.points_used; deduction += quote.deduction_cents
      if (used > (pointsSnapshot?.available_points || 0)) reject('只能使用结算前已有且来源可核对的积分', 400, 'POINTS_AVAILABLE_INSUFFICIENT')
      totalCost = addCost(totalCost, issued.purchase_cost)
      const commission = createGoodsCommission({ employeeId: seller.id, salaryTemplateId: seller.salary_template_id ?? null,
        quantity: row.quantity, saleType: row.sale_type, paidCents: moneyCents(issued.total_price),
        purchaseCostCents: issued.purchase_cost === null ? null : moneyCents(issued.purchase_cost),
        pointsUsed: quote.points_used, rule: seller.goods_commission_rule })
      const itemId = await repo.createItem(connection, { order_id: orderId, key: `goods:${row.key}`, type: 'accessory', accessory_sale_id: issued.sale_id,
        accessory_id: row.accessory_id, linked_phone_sale_id: linkedPhoneSaleId, quantity: row.quantity,
        unit_price: row.unit_price, total_amount: issued.total_price, purchase_cost: issued.purchase_cost, points_awarded: points,
        snapshot: { name: issued.accessory.name, category_id: issued.accessory.category_id, category: issued.accessory.category,
          brand_id: issued.accessory.brand_id, brand_name: issued.accessory.brand_name, product_model: issued.accessory.product_model,
          barcode: issued.accessory.barcode, template_id: issued.accessory.template_id, model_id: issued.accessory.model_id,
          model_ids: issued.accessory.model_ids, compatible_model_names: issued.accessory.compatible_model_names,
          color_id: issued.accessory.color_id, color_name: issued.accessory.color_name, unit: issued.accessory.unit, unit_id: issued.accessory.unit_id,
          sale_type: row.sale_type, sale_no: issued.sale_no, serial_numbers: issued.serial_numbers,
          points_units: quote.lines[0].units, commission,
          points_used: quote.points_used, deduction_cents: quote.deduction_cents, gross_cents: quote.gross_cents,
          points_per_yuan: quote.points_used ? quote.config_snapshot.redemption.points_per_yuan : null,
          gift_return_unit_price: row.sale_type === 'gift' ? row.gift_return_unit_price ?? null : null,
          remarks: input.remarks, ...(exchangeSource ? { exchange_source: exchangeSource } : {}) }, time: input.time })
      items.push({ id: itemId, key: row.key, type: 'accessory', accessory_sale_id: issued.sale_id, linked_phone_sale_id: linkedPhoneSaleId || null })
      goodsPointSources.push({ item_id: itemId, points })
      if (quote.points_used) await this.pointsLedger.consume(connection, { customerId: Number(customerId),
        points: quote.points_used, amountCents: quote.deduction_cents,
        pointsPerYuan: quote.config_snapshot.redemption.points_per_yuan, itemId, snapshot: pointsSnapshot })
    }
    return { items, goodsPoints, used, deduction, totalCost, goodsPointSources }
  }

  async execute(connection, input, actor, requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')) {
    const repo = this.repository
    if (!await repo.validStore(connection, input.store_id)) reject('门店不存在或已停用')
    const seller = await repo.seller(connection, input.operator_id)
    if (!seller) reject('销售员不存在或已停用')
    const customerId = await this.phones.resolveCustomer(connection, input.customer)
    const customer = await repo.lockCustomer(connection, customerId)
    if (!customer || !Number.isSafeInteger(Number(customer.points)) || Number(customer.points) < 0) reject('客户积分余额异常，请核对后结算', 409)
    const film = input.film_service ? await this.films.prepare(connection, input, customerId) : null
    if (input.quick_phone) {
      const phoneId = await this.inventory.stageQuickCheckoutPhone(connection, input.quick_phone, {
        actorId: input.actor_id, storeId: input.store_id, customerId, remarks: input.remarks
      })
      input = { ...input, phones: [{ phone_id: phoneId, sale_price: input.quick_phone.sale_price }],
        accessories: input.accessories.map(row => ({ ...row, linked_phone_id: phoneId })) }
    }
    const config = await this.getPointsConfig(connection)
    const hasRedemption = input.accessories.some(row => row.redeem_points)
    const pointsSnapshot = hasRedemption ? await this.pointsLedger.snapshot(connection, Number(customerId)) : null
    const snapshots = await repo.phoneSnapshots(connection, input.phones.map(row => row.phone_id))
    if (snapshots.length !== input.phones.length) reject('部分手机不存在', 404)
    const scope = resolveStoreScope(actor, null)
    for (const phone of snapshots) {
      assertStoreInScope(scope, phone.store_id)
      if (Number(phone.store_id) !== input.store_id) reject('本单手机必须属于选择的销售门店')
    }
    if (input.phones.length) quoteCheckoutPoints({ config, availablePoints: 0, balance: hasRedemption ? 0 : Number(customer.points), items: input.phones.map(row => ({
      key: String(row.phone_id), source: Number(snapshots.find(phone => Number(phone.id) === row.phone_id).is_new) === 1 ? 'new' : 'used',
      amount_cents: moneyCents(row.sale_price), is_gift: false, redeem_points: 0
    })) })
    const orderNo = this.createOrderNo()
    const orderId = await repo.createOrder(connection, { order_no: orderNo, request_key: input.request_key,
      request_hash: requestHash, customer_id: customerId,
      customer_name: input.customer.name, customer_phone: input.customer.phone, store_id: input.store_id,
      operator_id: input.operator_id, created_by: input.actor_id, time: input.time, remarks: input.remarks, config })
    const phoneSales = new Map(), paymentIds = [], items = []
    let earned = 0, totalCost = 0
    const deferredPhones = []
    if (input.phones.length) {
      const sale = await this.phones.sell({ connection, pointsConfig: config, deferPoints: hasRedemption, userId: input.actor_id,
        body: { phones: input.phones, customer_info: input.customer, store_id: input.store_id, operator_id: input.operator_id,
          sale_time: input.time, remarks: input.remarks, payment_info: { ...input.payment, payment_amount: (input.total_cents - input.goods_cents) / 100 } } })
      if (sale.status !== 200 || !sale.body.success) reject(sale.body.message, sale.status, 'PHONE_SALE_REJECTED')
      if (Number(sale.body.data.customer_id) !== Number(customerId)) reject('销售客户已变化，结算已取消', 409)
      paymentIds.push(...sale.body.data.payment_ids)
      await repo.linkPayments(connection, paymentIds, orderId)
      const rows = await repo.sales(connection, sale.body.data.phone_details.map(row => row.sale_id))
      if (rows.length !== input.phones.length) reject('手机销售明细不完整', 409)
      for (const row of rows) {
        phoneSales.set(Number(row.phone_id), row.id)
        const snapshot = snapshots.find(phone => Number(phone.id) === Number(row.phone_id))
        const phonePoints = hasRedemption ? quoteCheckoutPoints({ config, availablePoints: 0, items: [{
          key: String(row.phone_id), source: Number(snapshot.is_new) === 1 ? 'new' : 'used',
          amount_cents: moneyCents(row.sale_price), is_gift: false
        }] }).points_awarded : Number(row.points_awarded)
        earned += phonePoints
        if (hasRedemption) deferredPhones.push({ saleId: row.id, salePrice: row.sale_price, isNew: snapshot.is_new, points: phonePoints })
        totalCost = addCost(totalCost, row.purchase_cost)
        const id = await repo.createItem(connection, { order_id: orderId, key: `phone:${row.phone_id}`, type: 'phone', sale_id: row.id,
          phone_id: row.phone_id, quantity: 1, unit_price: row.sale_price, total_amount: row.sale_price, purchase_cost: row.purchase_cost,
          points_awarded: phonePoints, snapshot: { ...snapshot, invoice_number: row.invoice_number, remarks: input.remarks }, time: input.time })
        items.push({ id, type: 'phone', phone_id: Number(row.phone_id), sale_id: row.id })
      }
    }
    const goods = await this.issueGoods(connection, input, actor, { orderId, customerId, seller, config, pointsSnapshot, phoneSales, initialCost: totalCost })
    const { goodsPoints, used, deduction, goodsPointSources } = goods
    items.push(...goods.items)
    totalCost = goods.totalCost
    if (!Number.isSafeInteger(earned + goodsPoints) || earned + goodsPoints > 2147483647 || Number(customer.points) - used + earned + goodsPoints > 2147483647) reject('积分余额超出范围', 409)
    const payableCents = input.total_cents - deduction
    if (hasRedemption && input.paid_cents !== payableCents) reject('实收须与积分抵扣后的整单应收一致')
    for (const row of deferredPhones) {
      const result = await this.phones.accountSalePoints({ connection, customerId, config, ...row })
      if (result.points !== row.points) reject('手机积分凭据已变化，结算已取消', 409)
    }
    await this.creditPoints(connection, Number(customerId), goodsPoints, { sources: goodsPointSources })
    if (input.goods_cents - deduction) paymentIds.push(await repo.createPayment(connection, { order_id: orderId, customer_id: customerId,
      ...input.payment, amount: (input.goods_cents - deduction) / 100, time: input.payment.payment_time, remarks: input.remarks, actor_id: input.actor_id }))
    const result = { order_id: orderId, order_no: orderNo, items, payment_ids: paymentIds, total_amount: input.total_cents / 100,
      points_earned: earned + goodsPoints, points_used: used, deduction_amount: deduction / 100, paid_amount: payableCents / 100 }
    if (film) result.film_service_id = await this.films.append(connection, input, result, film)
    await repo.completeOrder(connection, { id: orderId, total_amount: result.total_amount, final_amount: result.paid_amount, total_cost: totalCost === null ? null : totalCost / 100,
      total_profit: totalCost === null ? null : (payableCents - totalCost) / 100, points_awarded: result.points_earned,
      ...input.payment, time: input.time, result })
    return result
  }
}

module.exports = SalesCheckoutService
