'use strict'

const SalesInventoryReportRepository = require('../repositories/sales-inventory-report.repository')
const { COMPLETED_TRANSACTION_STATUSES } = require('../utils/phone-status')

const COMPLETED_STATUS_SQL = `COALESCE(p.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`

class SalesInventoryReportService {
  constructor({ repository = new SalesInventoryReportRepository() } = {}) {
    if (!repository
      || typeof repository.findReferenceId !== 'function'
      || typeof repository.findModelIds !== 'function'
      || typeof repository.findExactId !== 'function'
      || typeof repository.getSummary !== 'function'
      || typeof repository.getDetail !== 'function') {
      throw new TypeError('SalesInventoryReportService requires an inventory report repository')
    }
    this.repository = repository
  }

  buildScope({ storeId, supplierId, isNew, startDate, endDate } = {}) {
    const whereConditions = [COMPLETED_STATUS_SQL]
    const queryParams = [...COMPLETED_TRANSACTION_STATUSES]
    if (storeId !== null && storeId !== undefined && !Number.isNaN(Number(storeId))) {
      whereConditions.push('p.store_id = ?')
      queryParams.push(storeId)
    }
    if (supplierId !== null && supplierId !== undefined && !Number.isNaN(Number(supplierId))) {
      whereConditions.push('p.supplier_id = ?')
      queryParams.push(supplierId)
    }
    if (isNew !== null && isNew !== undefined && isNew !== '') {
      whereConditions.push('p.is_new = ?')
      queryParams.push(String(isNew) === '1' ? 1 : 0)
    }
    if (startDate && endDate) {
      whereConditions.push('DATE(p.inventory_time) BETWEEN ? AND ?')
      queryParams.push(startDate, endDate)
    } else if (startDate) {
      whereConditions.push('DATE(p.inventory_time) >= ?')
      queryParams.push(startDate)
    } else if (endDate) {
      whereConditions.push('DATE(p.inventory_time) <= ?')
      queryParams.push(endDate)
    }
    return { whereConditions, queryParams }
  }

  async getSummary(query = {}) {
    const { whereConditions, queryParams } = this.buildScope({
      storeId: query.store_id ? Number.parseInt(String(query.store_id), 10) : null,
      supplierId: query.supplier_id ? Number.parseInt(String(query.supplier_id), 10) : null,
      isNew: query.is_new,
      startDate: String(query.start_date ?? '').trim(),
      endDate: String(query.end_date ?? '').trim()
    })

    for (const [field, resource, column] of [
      ['brand', 'brand', 'brand_id'],
      ['color', 'color', 'color_id'],
      ['memory', 'memory', 'memory_id']
    ]) {
      if (!query[field]) continue
      const id = await this.repository.findReferenceId(resource, query[field])
      whereConditions.push(`p.${column} = ?`)
      queryParams.push(id ?? -1)
    }

    if (query.model) {
      const modelIds = await this.repository.findModelIds(query.model)
      whereConditions.push(modelIds.length
        ? `p.model_id IN (${modelIds.map(() => '?').join(',')})`
        : 'p.model_id = ?')
      queryParams.push(...(modelIds.length ? modelIds : [-1]))
    }

    return this.repository.getSummary({ whereConditions, queryParams })
  }

  async getDetail(query = {}, pageSize) {
    const condition = query.condition
    const isNew = condition && condition.trim() ? (condition === '全新' ? 1 : 0) : null
    const supplierId = query.supplier_id ? parseInt(query.supplier_id, 10) : null
    const storeId = query.store_id ? parseInt(query.store_id, 10) : null
    const { whereConditions, queryParams } = this.buildScope({ storeId, supplierId, isNew })
    const brandId = await this.repository.findExactId('brand', query.brand)
    if (brandId === null) return { notFoundBrand: true, brand: query.brand }

    whereConditions.push('p.brand_id = ?')
    queryParams.push(brandId)
    for (const [field, resource] of [['model', 'model'], ['color', 'color'], ['memory', 'memory']]) {
      const value = query[field]
      if (!value || !value.trim()) {
        whereConditions.push(`p.${field}_id IS NULL`)
        continue
      }
      const id = await this.repository.findExactId(resource, value, brandId)
      whereConditions.push(id === null ? `p.${field}_id IS NULL` : `p.${field}_id = ?`)
      if (id !== null) queryParams.push(id)
    }

    const rows = await this.repository.getDetail({ whereConditions, queryParams, pageSize })
    return { rows }
  }
}

module.exports = SalesInventoryReportService
