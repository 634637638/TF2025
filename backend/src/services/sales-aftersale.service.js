'use strict'

const SalesCheckoutRepository = require('../repositories/sales-checkout.repository')
const SalesGoodsReturnService = require('./sales-goods-return.service')
const { validId, moneyCents } = require('../utils/sale-input')
const { resolveStoreScope } = require('../utils/store-scope')
const { getActorId } = require('../types/actor')
const { hasUnifiedPermission } = require('../middleware/unified-auth')

const reject = (message, statusCode = 409, code = 'CHECKOUT_FACTS_CONFLICT') => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const { planGoodsReturn } = require('../utils/checkout-goods-return')
const points = value => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647

/** 只读原单核对。退款提交仍须在同一事务重新核验，不能把此结果作为结清凭据。 */
class SalesAftersaleService {
  constructor({ repository = new SalesCheckoutRepository(), permissionCheck = hasUnifiedPermission, goodsReturns = new SalesGoodsReturnService() } = {}) {
    this.repository = repository
    this.permissionCheck = permissionCheck
    this.goodsReturns = goodsReturns
  }

  async authorize(actor) {
    if (!getActorId(actor)) reject('请先登录', 401, 'UNAUTHORIZED')
    for (const permission of ['query:view', 'query:return-to-stock']) {
      if (!await this.permissionCheck(actor, permission)) reject('无权查看退货核对信息', 403, 'PERMISSION_DENIED')
    }
  }

  async read(operation) {
    try { return await operation() }
    catch (error) {
      if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) reject('原单或售后结构尚未就绪，请先完成升级核对', 409, 'CHECKOUT_RETURN_NOT_READY')
      throw error
    }
  }

  async phoneReturnChecklist(phoneId, actor) {
    await this.authorize(actor)
    if (!validId(phoneId)) reject('手机标识无效', 400, 'CHECKOUT_INVALID')
    const source = await this.read(() => this.repository.phoneReturnSource(Number(phoneId), resolveStoreScope(actor, null)))
    if (!source) reject('未找到当前手机销售记录，或无权访问该门店', 404, 'NOT_FOUND')
    if (Number(source.phone_id) !== Number(phoneId) || !validId(source.sale_id)) reject('当前手机销售凭据异常，请重新核对')
    if (source.order_id === null) return { mode: 'standalone', phone_id: Number(source.phone_id), sale_id: Number(source.sale_id) }
    if (!validId(source.order_id) || Number(source.checkout_sale_id) !== Number(source.sale_id)) reject('手机共同原单与当前销售记录不一致')
    const data = await this.returnChecklist(source.order_id, source.sale_id, actor)
    if (data.phone.phone_id !== Number(phoneId)) reject('当前手机原单已变化，请重新核对')
    return { mode: 'checkout', ...data }
  }

  async returnChecklist(orderId, saleId, actor) {
    await this.authorize(actor)
    if (!validId(orderId) || !validId(saleId)) reject('订单或手机销售标识无效', 400, 'CHECKOUT_INVALID')
    const rows = await this.read(() => this.repository.returnChecklist(Number(orderId), Number(saleId), resolveStoreScope(actor, null)))
    if (!rows.length) reject('未找到可核对的当前手机原单，或无权访问该门店', 404, 'NOT_FOUND')
    const first = rows[0]
    if (rows.some(row => row.item_id !== null && row.item_id !== undefined) && !await this.permissionCheck(actor, 'accessories:view')) {
      reject('无权查看关联商品，无法完成原单核对', 403, 'PERMISSION_DENIED')
    }
    const amount = moneyCents(first.phone_amount)
    if (Number(first.phone_quantity) !== 1 || amount === null || !amount || !points(first.phone_points)) reject('手机原单金额或积分凭据异常')
    const replacements = new Map()
    const foreign = rows.filter(row => row.item_id !== null && row.item_id !== undefined &&
      row.goods_order_id !== undefined && Number(row.goods_order_id) !== Number(orderId))
    if (foreign.length) await this.read(() => this.goodsReturns.repository.withConnection(async connection => {
      for (const row of foreign) {
        const data = await this.goodsReturns.load(connection, { order_id: Number(row.goods_order_id), item_id: Number(row.item_id),
          quantity: 0, serial_numbers: [] }, actor, { lock: false })
        if (data.lineage.root_order_id !== Number(orderId) || Number(data.row.linked_phone_sale_id) !== Number(saleId)) {
          reject('关联商品不属于手机原单的真实换货链')
        }
        replacements.set(Number(row.item_id), data.plan)
      }
    }))
    const accessories = []
    for (const row of rows) {
      if (row.item_id === null || row.item_id === undefined) continue
      if (!Array.isArray(row.return_history)) reject('关联商品缺少已退核对凭据')
      const plan = replacements.get(Number(row.item_id)) || planGoodsReturn(row, row.return_history, 0, [])
      const item = plan.item
      accessories.push({ ...item, returned_quantity: plan.returned_quantity, remaining_quantity: plan.remaining_quantity,
        available_serial_numbers: plan.available_serial_numbers,
        remaining_gift_return_total: item.sale_type !== 'gift' ? null : plan.remaining_quantity === 0 ? 0 :
          item.gift_return_unit_price === null ? null : moneyCents(item.gift_return_unit_price) * plan.remaining_quantity / 100 })
    }
    return { order_id: Number(first.order_id), order_no: first.order_no, store_id: Number(first.store_id),
      phone: { item_id: first.phone_item_id, sale_id: Number(first.sale_id), phone_id: Number(first.phone_id),
        total_amount: amount / 100, points_awarded: Number(first.phone_points) }, accessories }
  }
}
module.exports = SalesAftersaleService
