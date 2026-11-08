'use strict'

const SalesAvailablePhonesRepository = require('../repositories/sales-available-phones.repository')
const { COMPLETED_TRANSACTION_STATUSES, getEffectivePhoneStatusSql } = require('../utils/phone-status')
const { normalizedModelSql } = require('../utils/search')
const { getBeijingDayStart } = require('../utils/time')

const COMPLETED_TRANSACTION_STATUS_SQL = `COALESCE(p.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`

const buildAvailablePhoneSearch = value => {
  const term = String(value ?? '').trim()
  if (!term) return null

  const pattern = `%${term}%`
  const conditions = [
    'p.imei LIKE ?',
    'p.serial_number LIKE ?',
    'b.name LIKE ?',
    `${normalizedModelSql('m.name')} LIKE CONCAT('%', ${normalizedModelSql('?')}, '%')`,
    'co.name LIKE ?',
    'mem.size LIKE ?'
  ]
  const params = [pattern, pattern, pattern, term, pattern, pattern]
  const isNumeric = /^\d+(\.\d+)?$/.test(term)

  if (isNumeric && term.includes('.')) {
    const priceValue = parseFloat(term)
    conditions.push('p.purchase_cost >= ?', 'p.purchase_cost < ?')
    params.push(priceValue - 0.01, priceValue + 0.01)
  } else if (isNumeric) {
    conditions.push('ABS(p.purchase_cost - ?) < 0.01')
    params.push(parseFloat(term))
  }

  return { sql: `(${conditions.join(' OR ')})`, params }
}

class SalesAvailablePhonesService {
  constructor({ repository = new SalesAvailablePhonesRepository(), now = () => new Date() } = {}) {
    if (!repository
      || typeof repository.findReferenceId !== 'function'
      || typeof repository.getStats !== 'function'
      || typeof repository.getAvailablePhones !== 'function'
      || typeof repository.getAvailablePhonesForExport !== 'function'
      || typeof repository.findPreorderDelivery !== 'function') {
      throw new TypeError('SalesAvailablePhonesService requires a sales available phones repository')
    }
    this.repository = repository
    this.now = now
  }

  findReferenceId(resource, value) {
    return this.repository.findReferenceId(resource, value)
  }

  async getAvailablePhones(query, { page, pageSize, preorderId = null }) {
    let preorderDeliveryPhoneId = null
    if (preorderId) {
      const preorder = await this.repository.findPreorderDelivery(preorderId)
      if (!preorder) {
        throw Object.assign(new Error('预定单不存在'), { statusCode: 404 })
      }
      if (preorder.status !== 'arrived' || !preorder.matched_phone_id) {
        throw Object.assign(new Error('只有已匹配的预定单可以交付'), { statusCode: 400 })
      }
      preorderDeliveryPhoneId = Number(preorder.matched_phone_id)
    }

    const filters = await this.buildFilters(query, { preorderDeliveryPhoneId })
    const result = await this.repository.getAvailablePhones({ ...filters, page, pageSize })
    return {
      phones: result.phones.map(phone => ({
        ...phone,
        sale_price: phone.sale_price === null || phone.sale_price === undefined ? null : Number(phone.sale_price),
        purchase_cost: phone.purchase_cost === null || phone.purchase_cost === undefined ? null : Number(phone.purchase_cost),
        is_new: phone.is_new === 1
      })),
      total: result.total,
      values: result.values
    }
  }

  async getAvailablePhonesForExport(query) {
    const filters = await this.buildFilters(query)
    const phones = await this.repository.getAvailablePhonesForExport(filters)
    return phones.map(phone => ({
      ...phone,
      sale_price: parseFloat(phone.sale_price) || null,
      purchase_cost: parseFloat(phone.purchase_cost) || null,
      is_new: phone.is_new === 1
    }))
  }

  async buildFilters(query = {}, { preorderDeliveryPhoneId = null } = {}) {
    const {
      phone_id,
      search,
      supplier_id,
      store_id,
      operator_id,
      is_new,
      status,
      brand_id,
      model_id,
      color_id,
      memory_id,
      model_exact,
      start_date,
      end_date,
      brand,
      model,
      color,
      memory,
      customer_id,
      sale_status,
      salesman_id,
      price_range
    } = query

    const whereConditions = [COMPLETED_TRANSACTION_STATUS_SQL]
    const queryParams = [...COMPLETED_TRANSACTION_STATUSES]
    if (status) {
      whereConditions.push(`${getEffectivePhoneStatusSql('p')} = ?`)
      queryParams.push(status)
    }

    if (preorderDeliveryPhoneId) {
      whereConditions.push("p.status IN ('in_stock', 'reserved')")
      whereConditions.push('p.id = ?')
      queryParams.push(preorderDeliveryPhoneId)
    }

    if (phone_id) {
      whereConditions.push('p.id = ?')
      queryParams.push(parseInt(phone_id, 10))
    }

    const searchCondition = buildAvailablePhoneSearch(search)
    if (searchCondition) {
      whereConditions.push(searchCondition.sql)
      queryParams.push(...searchCondition.params)
    }

    if (store_id) {
      whereConditions.push('p.store_id = ?')
      queryParams.push(store_id)
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      queryParams.push(supplier_id)
    }

    if (operator_id) {
      whereConditions.push('p.inventory_operator_id = ?')
      queryParams.push(operator_id)
    }

    if (is_new !== undefined && is_new !== '') {
      whereConditions.push('p.is_new = ?')
      queryParams.push(is_new === '1' ? 1 : 0)
    }

    if (start_date || end_date) {
      if (start_date && end_date) {
        whereConditions.push('DATE(p.inventory_time) BETWEEN ? AND ?')
        queryParams.push(start_date, end_date)
      } else if (start_date) {
        whereConditions.push('DATE(p.inventory_time) >= ?')
        queryParams.push(start_date)
      } else if (end_date) {
        whereConditions.push('DATE(p.inventory_time) <= ?')
        queryParams.push(end_date)
      }
    }

    const parsedBrandId = brand_id !== undefined && brand_id !== '' ? parseInt(brand_id, 10) : null
    const parsedModelId = model_id !== undefined && model_id !== '' ? parseInt(model_id, 10) : null
    const parsedColorId = color_id !== undefined && color_id !== '' ? parseInt(color_id, 10) : null
    const parsedMemoryId = memory_id !== undefined && memory_id !== '' ? parseInt(memory_id, 10) : null

    if (parsedBrandId !== null && !Number.isNaN(parsedBrandId)) {
      whereConditions.push('p.brand_id = ?')
      queryParams.push(parsedBrandId)
    } else if (brand) {
      const exactBrandId = await this.repository.findReferenceId('brand', brand)
      if (exactBrandId !== null) {
        whereConditions.push('p.brand_id = ?')
        queryParams.push(exactBrandId)
      } else {
        const fuzzyBrandResult = await this.repository.findBrandsByName(brand)
        whereConditions.push('p.brand_id = ?')
        queryParams.push(fuzzyBrandResult[0]?.id ?? -1)
      }
    }

    if (parsedModelId !== null && !Number.isNaN(parsedModelId)) {
      whereConditions.push('p.model_id = ?')
      queryParams.push(parsedModelId)
    } else if (model) {
      const normalizedModel = model.trim()
      const exactMatch = model_exact === '1' || model_exact === 1 || model_exact === true
      const modelResults = await this.repository.findModelsByName(normalizedModel, exactMatch)
      if (modelResults.length > 0 && exactMatch) {
        whereConditions.push('p.model_id = ?')
        queryParams.push(modelResults[0].id)
      } else if (modelResults.length > 0) {
        const modelIds = modelResults.map(item => item.id)
        whereConditions.push(`p.model_id IN (${modelIds.map(() => '?').join(',')})`)
        queryParams.push(...modelIds)
      } else {
        whereConditions.push('p.model_id = ?')
        queryParams.push(-1)
      }
    }

    if (parsedColorId !== null && !Number.isNaN(parsedColorId)) {
      whereConditions.push('p.color_id = ?')
      queryParams.push(parsedColorId)
    } else if (color) {
      const exactColorId = await this.repository.findReferenceId('color', color)
      whereConditions.push('p.color_id = ?')
      queryParams.push(exactColorId ?? -1)
    }

    if (parsedMemoryId !== null && !Number.isNaN(parsedMemoryId)) {
      whereConditions.push('p.memory_id = ?')
      queryParams.push(parsedMemoryId)
    } else if (memory) {
      const exactMemoryId = await this.repository.findReferenceId('memory', memory)
      whereConditions.push('p.memory_id = ?')
      queryParams.push(exactMemoryId ?? -1)
    }

    if (customer_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')')
      queryParams.push(customer_id)
    }

    if (sale_status) {
      switch (sale_status) {
      case 'available':
        whereConditions.push(`${getEffectivePhoneStatusSql('p')} = 'in_stock' AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status != 'cancelled')`)
        break
      case 'reserved':
        whereConditions.push(`${getEffectivePhoneStatusSql('p')} = 'reserved'`)
        break
      case 'sold':
        whereConditions.push(`${getEffectivePhoneStatusSql('p')} = 'sold'`)
        break
      case 'shipped':
        whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'shipped\')')
        break
      case 'completed':
        whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'completed\')')
        break
      default:
        whereConditions.push(`${getEffectivePhoneStatusSql('p')} = 'in_stock'`)
      }
    }

    if (salesman_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.salesman_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')')
      queryParams.push(salesman_id)
    }

    if (price_range) {
      const [minPrice, maxPrice] = price_range.split('-')
      if (minPrice && maxPrice) {
        whereConditions.push('p.sale_price BETWEEN ? AND ?')
        queryParams.push(parseFloat(minPrice), parseFloat(maxPrice))
      }
    }

    return { whereConditions, queryParams }
  }

  async getStats(query = {}) {
    const filters = await this.buildFilters(query)
    const todayStart = getBeijingDayStart(this.now())
    const todayQueryParams = filters.queryParams.slice(COMPLETED_TRANSACTION_STATUSES.length)
    const stats = await this.repository.getStats({ ...filters, todayQueryParams, todayStart })
    const profitMargin = Number(stats.profitMargin?.count) > 0
      ? stats.profitMargin.total_profit_margin / stats.profitMargin.count
      : 0

    return {
      total_value: parseFloat(stats.totalValue.total_value) || 0,
      today_sold: Number(stats.todaySold.today_sold) || 0,
      avg_profit_margin: profitMargin
    }
  }
}

module.exports = SalesAvailablePhonesService
