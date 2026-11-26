'use strict'

const Repository = require('../repositories/film-service.repository')
const AccessoryService = require('./accessory.service')
const { hasTable, hasColumn } = require('./schema-inspector.service')
const { getActorId } = require('../types/actor')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const { validId } = require('../utils/sale-input')
const { getBeijingTimeString } = require('../utils/time')

const reject = (message, statusCode = 400, code = 'FILM_SERVICE_INVALID') => {
  throw Object.assign(new Error(message), { statusCode, code })
}

/** 服务客户跨店享受权益；本次出库门店仍由共同结算的统一门店范围约束。 */
class FilmService {
  constructor({ repository = new Repository(), permissionCheck = hasUnifiedPermission,
    tableExists = hasTable, columnExists = hasColumn, now = getBeijingTimeString, products = new AccessoryService() } = {}) {
    Object.assign(this, { repository, permissionCheck, tableExists, columnExists, now, products })
  }

  normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['customer_id', 'phone_id', 'mode', 'quantity', 'accessory_id'].includes(key)) ||
      !validId(value.customer_id) || !validId(value.phone_id) || !['free', 'paid'].includes(value.mode) ||
      value.mode === 'free' && (!validId(value.quantity) || Number(value.quantity) > 1000) ||
      value.mode === 'paid' && (value.quantity !== undefined || value.accessory_id !== undefined)) reject('请选择当前手机记录及有效的贴膜方式、商品和数量')
    return { customer_id: Number(value.customer_id), phone_id: Number(value.phone_id), mode: value.mode,
      ...(value.mode === 'free' ? { quantity: Number(value.quantity), ...(value.accessory_id === undefined ? {} : { accessory_id: Number(value.accessory_id) }) } : {}) }
  }

  async authorize(actor) {
    if (!getActorId(actor)) reject('请先登录', 401, 'UNAUTHORIZED')
    for (const permission of ['query:view', 'query:film']) {
      if (!await this.permissionCheck(actor, permission)) reject('无权办理或查看客户贴膜服务', 403, 'PERMISSION_DENIED')
    }
  }

  /** 专用候选只接受真实客户/设备关联；型号和适配范围由服务端确定。 */
  async productOptions(actor, customerId, query = {}, searchFields) {
    await this.authorize(actor)
    if (!validId(customerId) || !query || typeof query !== 'object' || Array.isArray(query) ||
      Object.keys(query).some(key => !['phone_id', 'store_id', 'search', 'page', 'page_size', 'free_only', 'search_mode'].includes(key)) ||
      !validId(query.phone_id) || query.free_only !== undefined && ![true, false, 'true', 'false'].includes(query.free_only)) reject('贴膜商品查询条件无效')
    const device = await this.repository.withConnection(async connection => {
      await this.ready(connection)
      return this.repository.device(connection, Number(query.phone_id), Number(customerId))
    })
    if (!device || !validId(device.model_id)) reject('当前手机与客户关联无效，请刷新记录', 409, 'FILM_DEVICE_REQUIRED')
    const { phone_id: _phoneId, free_only: freeOnly, ...params } = query
    const result = await this.products.getSaleOptions(actor, { ...params, film_only: true,
      film_model_id: Number(device.model_id), ...(freeOnly === undefined ? {} : { film_free_only: freeOnly }) }, searchFields, false)
    const keys = ['id', 'name', 'barcode', 'category', 'brand_name', 'product_model', 'color_name', 'unit', 'sale_price', 'quantity', 'serial_quantity', 'serial_number']
    return { ...result, data: result.data.map(row => Object.fromEntries(keys.filter(key => key in row).map(key => [key, row[key]]))) }
  }

  async isReady(connection) {
    return await this.tableExists('customer_film_services', connection) &&
      await this.columnExists('accessories', 'free_film', connection) &&
      await this.columnExists('customer_film_services', 'phone_snapshot', connection) &&
      await this.columnExists('customer_film_services', 'phone_id', connection) &&
      await this.columnExists('customer_film_services', 'model_id', connection) &&
      await this.tableExists('accessory_template_colors', connection)
  }

  async ready(connection) {
    if (!await this.isReady(connection)) {
      reject('贴膜服务结构尚未就绪，请先完成部署迁移', 409, 'FILM_SERVICE_NOT_READY')
    }
  }

  /** 手机成交随单自动消耗一张免费专用膜；只返回零价赠送明细，实际出库仍由商品服务完成。 */
  async prepareAutomaticForSale(connection, phones, storeId, { lock = true, selectedGoods = [] } = {}) {
    if (!await this.isReady(connection)) return []
    const accessories = []
    const reserved = new Map()
    // SN 出库同时减少总库存及 SN 库存，只需为手选的普通数量预留。
    for (const row of selectedGoods) {
      if (row.serial_numbers?.length) continue
      reserved.set(row.accessory_id, (reserved.get(row.accessory_id) || 0) + row.quantity)
    }
    for (const phone of phones) {
      if (!validId(phone?.id) || !validId(phone?.model_id)) continue
      const matches = await this.repository.matchingTemplates(connection, Number(phone.model_id), { lock })
      if (matches.length !== 1) continue
      const stock = await this.repository.availableProducts(connection, Number(matches[0].id), Number(storeId), { lock })
      const plain = stock.filter(row => Number(row.quantity) > Number(row.serial_quantity))
      if (plain.length !== 1) continue
      const product = plain[0]
      const available = Number(product.quantity) - Number(product.serial_quantity)
      const alreadyReserved = reserved.get(Number(product.id)) || 0
      if (available - alreadyReserved < 1) continue
      reserved.set(Number(product.id), alreadyReserved + 1)
      accessories.push({ key: `auto-film:${Number(phone.id)}`, accessory_id: Number(product.id), quantity: 1, unit_price: 0,
        sale_type: 'gift', linked_phone_id: Number(phone.id), serial_numbers: [], redeem_points: 0, gift_return_unit_price: null,
        auto_film: true })
    }
    return accessories
  }

  /** 由共同结算在同一事务中调用；重新核验所选膜、适配型号及服务店库存。 */
  async prepare(connection, input, customerId, { lock = true } = {}) {
    await this.ready(connection)
    if (Number(customerId) !== input.film_service.customer_id || input.phones.length || input.quick_phone) reject('贴膜须使用当前客户单独办理，不能同时新售手机')
    if (input.time > this.now()) reject('贴膜日期不能晚于当前时间')
    const device = await this.repository.device(connection, input.film_service.phone_id, Number(customerId), { lock })
    if (!device || !validId(device.model_id)) reject('当前手机与客户关联无效或缺少型号，请刷新手机记录', 409, 'FILM_DEVICE_REQUIRED')
    let accessories = input.accessories
    if (input.film_service.mode === 'free') {
      if (accessories.length) reject('免费贴膜商品由已选商品编号关联，不接受独立商品或价格明细')
      const productId = input.film_service.accessory_id
      if (!productId) {
        const matches = await this.repository.matchingTemplates(connection, Number(device.model_id), { lock })
        if (matches.length !== 1) reject(matches.length ? '当前型号配置了多款免费膜，请选择具体商品' : '当前手机型号尚未配置免费膜模板', 409, 'FILM_TEMPLATE_REQUIRED')
        const stock = await this.repository.availableProducts(connection, Number(matches[0].id), input.store_id, { lock })
        const plain = stock.filter(row => Number(row.quantity) > Number(row.serial_quantity))
        if (plain.length > 1) reject('该模板在服务店存在多个品牌或颜色的可用商品，请选择具体商品', 409, 'FILM_STOCK_AMBIGUOUS')
        const quantity = input.film_service.quantity, product = plain[0]
        if (!product || Number(product.quantity) - Number(product.serial_quantity) < quantity) reject('服务门店适配膜数量不足；SN耗材须按实际SN通过选品办理', 409, 'FILM_STOCK_INSUFFICIENT')
        accessories = [{ key: 'free-film', accessory_id: Number(product.id), quantity, unit_price: 0, sale_type: 'gift',
          linked_phone_id: null, serial_numbers: [], redeem_points: 0, gift_return_unit_price: null }]
      } else {
        const product = await this.repository.product(connection, productId, { lock })
        if (!product || Number(product.status) !== 1 || Number(product.category_status) !== 1 || !String(product.category_name || '').includes('膜') || Number(product.free_film) !== 1 ||
        !await this.repository.compatible(connection, product, Number(device.model_id))) {
          reject('请选择当前型号适配且已启用“免费专用”的商品', 409, 'FILM_PRODUCT_REQUIRED')
        }
        const stock = await this.repository.availableProduct(connection, Number(product.id), input.store_id, { lock })
        const quantity = input.film_service.quantity
        if (!stock || Number(stock.quantity) - Number(stock.serial_quantity) < quantity) reject('所选贴膜商品在服务门店的普通库存不足', 409, 'FILM_STOCK_INSUFFICIENT')
        accessories = [{ key: 'free-film', accessory_id: Number(product.id), quantity, unit_price: 0, sale_type: 'gift',
          linked_phone_id: null, serial_numbers: [], redeem_points: 0, gift_return_unit_price: null }]
      }
    } else {
      if (!accessories.length) reject('请选择本次使用的贴膜商品')
      for (const row of accessories) {
        const product = await this.repository.product(connection, row.accessory_id, { lock })
        if (!product || Number(product.category_status) !== 1 || Number(product.status) !== 1 || String(product.category_name || '').includes('膜') === false ||
          !await this.repository.compatible(connection, product, Number(device.model_id))) {
          reject('请选择当前手机型号适配且商品模板与类型均已启用的商品', 409, 'FILM_PRODUCT_REQUIRED')
        }
      }
    }
    return { qualification_sale_id: null, phone_id: Number(device.phone_id), model_id: Number(device.model_id),
      phone_snapshot: { model_name: device.model_name, sale_id: Number(device.sale_id) }, accessories }
  }

  async append(connection, input, result, qualification) {
    const id = await this.repository.append(connection, { order_id: result.order_id,
      customer_id: input.film_service.customer_id, qualification_sale_id: qualification.qualification_sale_id,
      phone_id: qualification.phone_id, model_id: qualification.model_id, phone_snapshot: qualification.phone_snapshot,
      store_id: input.store_id, operator_id: input.operator_id, created_by: input.actor_id,
      quantity: input.accessories.reduce((total, row) => total + row.quantity, 0),
      business_time: input.time, created_at: this.now() })
    if (!validId(id)) reject('贴膜记录保存失败', 409, 'FILM_SERVICE_CONFLICT')
    return Number(id)
  }

  /** 手机销售自动赠膜也写入统一贴膜历史，库存与该销售共用同一事务。 */
  async appendAutomatic(connection, { orderId, customerId, storeId, operatorId, createdBy, businessTime, request, phone, saleId, issuedQuantity }) {
    if (!request?.auto_film || !validId(orderId) || !validId(customerId) || !validId(storeId) ||
      !validId(operatorId) || !validId(createdBy) || !validId(request.linked_phone_id) || !validId(saleId) ||
      !phone || !validId(phone.model_id) || !validId(issuedQuantity ?? request.quantity)) {
      reject('自动赠膜记录资料不完整', 409, 'FILM_SERVICE_INVALID')
    }
    const id = await this.repository.append(connection, {
      order_id: Number(orderId), customer_id: Number(customerId), qualification_sale_id: null,
      phone_id: Number(request.linked_phone_id), model_id: Number(phone.model_id),
      phone_snapshot: { model_name: phone.model_name ?? null, sale_id: Number(saleId), automatic: true },
      store_id: Number(storeId), operator_id: Number(operatorId), created_by: Number(createdBy),
      quantity: Number(issuedQuantity ?? request.quantity), business_time: businessTime, created_at: this.now()
    })
    if (!validId(id)) reject('自动赠膜记录保存失败', 409, 'FILM_SERVICE_CONFLICT')
    return Number(id)
  }

  async context(actor, customerId, query = {}) {
    await this.authorize(actor)
    if (!validId(customerId) || !query || typeof query !== 'object' || Array.isArray(query) ||
      Object.keys(query).some(key => !['page', 'page_size', 'phone_id', 'sale_type'].includes(key))) reject('贴膜查询条件无效')
    if (query.phone_id !== undefined && !validId(query.phone_id)) reject('贴膜手机参数无效')
    if (query.sale_type !== undefined && !['all', 'sale', 'gift'].includes(query.sale_type)) reject('贴膜方式筛选无效')
    const page = query.page ?? 1, size = query.page_size ?? 20
    if (!validId(page) || Number(page) > 1000000 || !validId(size) || Number(size) > 100) reject('分页参数无效')
    return this.repository.withConnection(async connection => {
      let started = false
      try {
        await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await connection.beginTransaction()
        started = true
        await this.ready(connection)
        if (!await this.repository.customer(connection, Number(customerId))) reject('客户不存在', 404, 'NOT_FOUND')
        const device = query.phone_id === undefined ? null : await this.repository.device(connection, Number(query.phone_id), Number(customerId))
        if (query.phone_id !== undefined && (!device || !validId(device.model_id))) reject('当前手机与客户关联无效，请刷新记录', 409, 'FILM_DEVICE_REQUIRED')
        const history = await this.repository.history(connection, Number(customerId), {
          page: Number(page), page_size: Number(size), phone_id: device ? Number(device.phone_id) : null,
          sale_type: query.sale_type ?? 'all' })
        return { customer_id: Number(customerId), eligible_for_free: Boolean(device),
          device: device ? { phone_id: Number(device.phone_id), model_id: Number(device.model_id), model_name: device.model_name } : null,
          service_count: history.total, film_quantity: history.total_quantity,
          free_count: history.free_count, paid_count: history.paid_count,
          device_service_count: history.device_total, device_film_quantity: history.device_total_quantity,
          // 公开字段显式投影，后续仓储增加内部核验列也不会暴露原购买单、创建人或成本。
          data: history.rows.map(row => ({ id: row.id, order_id: row.order_id, order_no: row.order_no ?? null,
            quantity: row.quantity, store_id: row.store_id, store_name: row.store_name ?? null,
            operator_id: row.operator_id, operator_name: row.operator_name ?? null,
            business_time: row.business_time, created_at: row.created_at,
            phone_id: row.phone_id ?? null, model_id: row.model_id ?? null, phone_model_name: row.phone_model_name ?? null,
            items: history.items.filter(item => Number(item.order_id) === Number(row.order_id) &&
              (!row.automatic || Number(item.linked_phone_sale_id) === Number(row.phone_sale_id)))
              .map(({ name, unit, sale_type, quantity, total_amount }) => ({ name, unit: unit || null, sale_type, quantity, total_amount })) })),
          pagination: { page: Number(page), page_size: Number(size), total: history.filtered_total,
            total_pages: Math.ceil(history.filtered_total / Number(size)), has_next: Number(page) * Number(size) < history.filtered_total, has_prev: Number(page) > 1 } }
      } finally {
        if (!started) connection.destroy()
        else {
          try { await connection.rollback() }
          catch (error) { connection.destroy(); throw error }
        }
      }
    })
  }
}

module.exports = FilmService
