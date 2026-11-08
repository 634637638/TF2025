'use strict'

const PhoneInventoryQueryRepository = require('../repositories/phone-inventory-query.repository')
const pricingService = require('./pricing.service')
const { PAGINATION } = require('../config/constants')

class PhoneInventoryQueryService {
  constructor({ repository = new PhoneInventoryQueryRepository(), pricing = pricingService, now = () => new Date() } = {}) {
    this.repository = repository
    this.pricingService = pricing
    this.now = now
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

  async getSoldTimeline() {
    return this.repository.getSoldTimeline()
  }

  async searchByIdentifier(keyword) {
    return this.repository.searchByIdentifier(keyword)
  }

  async getPhoneDetails(id) {
    return this.repository.getPhoneDetails(id)
  }

  async listInventoryPhones(query = {}) {
    const page = Math.max(parseInt(query.page ?? PAGINATION.DEFAULT_PAGE, 10) || PAGINATION.DEFAULT_PAGE, 1)
    const page_size = Math.min(
      Math.max(parseInt(query.page_size ?? PAGINATION.DEFAULT_LIMIT, 10) || PAGINATION.DEFAULT_LIMIT, 1),
      PAGINATION.MAX_LIMIT
    )
    const { phones, total } = await this.repository.listInventoryPhones(query, { page, page_size })
    const total_pages = Math.ceil(total / page_size)

    return {
      phones: phones.map(phone => ({
        ...phone,
        purchase_cost: phone.purchase_cost ?? null,
        sale_price: phone.sale_price ?? null,
        inventory_time: phone.inventory_time || null,
        sale_time: phone.sale_time || null,
        condition: Number(phone.is_new) === 1 ? 'new' : 'used'
      })),
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
