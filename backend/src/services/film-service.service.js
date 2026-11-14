'use strict'

const Repository = require('../repositories/film-service.repository')
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
    tableExists = hasTable, columnExists = hasColumn, now = getBeijingTimeString } = {}) {
    Object.assign(this, { repository, permissionCheck, tableExists, columnExists, now })
  }

  normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => key !== 'customer_id') || !validId(value.customer_id)) reject('请选择已存在的贴膜客户')
    return { customer_id: Number(value.customer_id) }
  }

  async authorize(actor) {
    if (!getActorId(actor)) reject('请先登录', 401, 'UNAUTHORIZED')
    for (const permission of ['query:view', 'query:film', 'accessories:view']) {
      if (!await this.permissionCheck(actor, permission)) reject('无权办理或查看客户贴膜服务', 403, 'PERMISSION_DENIED')
    }
  }

  async ready(connection) {
    if (!await this.tableExists('customer_film_services', connection) ||
      !await this.columnExists('accessory_categories', 'film_enabled', connection)) {
      reject('贴膜服务结构尚未就绪，请先完成部署迁移', 409, 'FILM_SERVICE_NOT_READY')
    }
  }

  /** 由共同结算在同一客户锁事务中调用；只读资格、类型，不另扣库存。 */
  async prepare(connection, input, customerId, { lock = true } = {}) {
    await this.ready(connection)
    if (Number(customerId) !== input.film_service.customer_id || input.phones.length || input.quick_phone) reject('贴膜须使用当前客户单独办理，不能同时新售手机')
    if (input.time > this.now()) reject('贴膜日期不能晚于当前时间')
    const qualification = await this.repository.qualification(connection, Number(customerId), input.time, { lock })
    if (input.accessories.some(row => row.sale_type === 'gift') && !qualification) {
      reject('客户没有有效手机购买记录，不能办理免费贴膜', 409, 'FILM_QUALIFICATION_REQUIRED')
    }
    for (const row of input.accessories) {
      const product = await this.repository.product(connection, row.accessory_id, { lock })
      if (!product || Number(product.film_enabled) !== 1 || Number(product.category_status) !== 1) {
        reject('请选择已启用且标记为用于贴膜的商品类型', 409, 'FILM_PRODUCT_REQUIRED')
      }
    }
    return { qualification_sale_id: qualification ? Number(qualification.id) : null }
  }

  async append(connection, input, result, qualification) {
    const id = await this.repository.append(connection, { order_id: result.order_id,
      customer_id: input.film_service.customer_id, ...qualification,
      store_id: input.store_id, operator_id: input.operator_id, created_by: input.actor_id,
      quantity: input.accessories.reduce((total, row) => total + row.quantity, 0),
      business_time: input.time, created_at: this.now() })
    if (!validId(id)) reject('贴膜记录保存失败', 409, 'FILM_SERVICE_CONFLICT')
    return Number(id)
  }

  async context(actor, customerId, query = {}) {
    await this.authorize(actor)
    if (!validId(customerId) || !query || typeof query !== 'object' || Array.isArray(query) ||
      Object.keys(query).some(key => !['page', 'page_size'].includes(key))) reject('贴膜查询条件无效')
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
        const qualification = await this.repository.qualification(connection, Number(customerId), this.now())
        const history = await this.repository.history(connection, Number(customerId), { page: Number(page), page_size: Number(size) })
        return { customer_id: Number(customerId), eligible_for_free: Boolean(qualification),
          service_count: history.total, film_quantity: history.total_quantity,
          // 公开字段显式投影，后续仓储增加内部核验列也不会暴露原购买单、创建人或成本。
          data: history.rows.map(row => ({ id: row.id, order_id: row.order_id, order_no: row.order_no ?? null,
            quantity: row.quantity, store_id: row.store_id, store_name: row.store_name ?? null,
            operator_id: row.operator_id, operator_name: row.operator_name ?? null,
            business_time: row.business_time, created_at: row.created_at,
            items: history.items.filter(item => Number(item.order_id) === Number(row.order_id))
              .map(({ name, sale_type, quantity, total_amount }) => ({ name, sale_type, quantity, total_amount })) })),
          pagination: { page: Number(page), page_size: Number(size), total: history.total,
            total_pages: Math.ceil(history.total / Number(size)), has_next: Number(page) * Number(size) < history.total, has_prev: Number(page) > 1 } }
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
