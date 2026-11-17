'use strict'

const PhoneInventoryQueryRepository = require('../repositories/phone-inventory-query.repository')
const FieldAccessService = require('./field-access.service')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const pricingService = require('./pricing.service')
const { PAGINATION } = require('../config/constants')

class PhoneInventoryQueryService {
  constructor({ repository = new PhoneInventoryQueryRepository(), pricing = pricingService, now = () => new Date(), fields = moduleKey => new FieldAccessService({ moduleKey, responseKeys: {
    'sale.store_id': ['inventory_store_id', 'inventory_store_name', 'sale_store_id', 'sale_store_name', 'store_id', 'store_name'],
    'store_info.store_name': ['inventory_store_id', 'inventory_store_name', 'sale_store_id', 'sale_store_name'],
    'basic.phone_id': ['id'],
    'sale.supplier_id': ['supplier_name'],
    'sale.operator_id': ['sale_operator_id', 'phone_sale_operator_id', 'sale_operator_name'],
    'sale.payment_method': ['payment_channel'],
    'operator_info.inventory_operator': ['inventory_operator_id', 'inventory_operator_name'],
    'operator_info.inventory_operator_name': ['inventory_operator_id'],
    'operator_info.sale_operator': ['sale_operator_id', 'sale_operator_name']
  } }) } = {}) {
    this.repository = repository
    this.pricingService = pricing
    this.now = now
    this.fields = fields
  }

  async getUsedModels(keyword = '') {
    const pricingConfig = await this.pricingService.getGlobalConfig()
    const rows = await this.repository.getUsedModelRows(keyword)

    return rows.map(row => ({
      ...row,
      stock_quantity: Number(row.stock_quantity) || 0,
      inventory_price: row.inventory_price === null ? null : Number(row.inventory_price) || 0,
      display_inventory_price: row.inventory_price === null
        ? null
        : this.pricingService.calculateUsedInventoryPriceByConfig(row.inventory_price, pricingConfig)
    }))
  }

  async getLongestInventory(filters) {
    const rows = await this.repository.getLongestInventoryRows(filters)
    const today = this.now()
    return rows.map(item => {
      const inventoryDate = new Date(item.inventory_time)
      const diffTime = today.getTime() - inventoryDate.getTime()
      return {
        ...item,
        inventory_days: Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
        inventory_date: item.inventory_date
      }
    })
  }

  async getSoldTimeline(actor) {
    const fields = this.fields('query_queryview')
    const permissions = await fields.getPermissions(actor.id)
    return fields.maskPayload(await this.repository.getSoldTimeline(resolveStoreScope(actor)), permissions)
  }

  async searchByIdentifier(keyword, actor) {
    const fields = this.fields('query_queryview')
    const permissions = await fields.getPermissions(actor.id)
    return fields.maskPayload(await this.repository.searchByIdentifier(keyword, resolveStoreScope(actor)), permissions)
  }

  async getPhoneDetails(id, actor) {
    const rows = await this.repository.getPhoneDetails(id)
    if (rows.length) assertStoreInScope(resolveStoreScope(actor), rows[0].sale_store_id || rows[0].inventory_store_id)
    const fields = this.fields('sales_salesview')
    return fields.maskPayload(rows, await fields.getPermissions(actor.id))
  }

  async listInventoryPhones(query = {}, actor) {
    const scope = resolveStoreScope(actor, query.store_id)
    const fields = this.fields('inventory_inventoryview')
    const permissions = await fields.getPermissions(actor.id)
    const page = Math.max(parseInt(query.page ?? PAGINATION.DEFAULT_PAGE, 10) || PAGINATION.DEFAULT_PAGE, 1)
    const page_size = Math.min(
      Math.max(parseInt(query.page_size ?? PAGINATION.DEFAULT_LIMIT, 10) || PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    )
    const { phones, total } = await this.repository.listInventoryPhones(query, { page, page_size, scope })
    const total_pages = Math.ceil(total / page_size)

    return {
      phones: fields.maskPayload(phones.map(phone => ({
        ...phone,
        purchase_cost: phone.purchase_cost ?? null,
        sale_price: phone.sale_price ?? null,
        inventory_time: phone.inventory_time || null,
        sale_time: phone.sale_time || null,
        condition: Number(phone.is_new) === 1 ? 'new' : 'used'
      })), permissions),
      pagination: {
        page,
        page_size,
        total,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1
      }
    }
  }
}

module.exports = PhoneInventoryQueryService
