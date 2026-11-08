'use strict'

const RentalDeviceRepository = require('../repositories/rental-device.repository')
const dataMaskingService = require('./data-masking.service')
const { ensureRentalSchema } = require('../utils/rental-schema')

const MODULE_KEY = 'rentals_rentalsview'
const SEARCHABLE_FIELDS = [
  'device_info.imei',
  'device_info.serial_number',
  'device_info.brand',
  'device_info.model',
  'device_info.color',
  'device_info.memory'
]

class RentalDeviceService {
  constructor({
    repository = new RentalDeviceRepository(),
    masking = dataMaskingService,
    ensureSchema = ensureRentalSchema
  } = {}) {
    this.repository = repository
    this.masking = masking
    this.ensureSchema = ensureSchema
  }

  async listAvailable(query, userId) {
    await this.ensureSchema()
    const permissions = await this.masking.getUserFieldPermissions(userId, MODULE_KEY)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const keyword = String(query.keyword || '').trim()
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1)
    const requestedPageSize = Number.parseInt(query.page_size, 10)
    const pageSize = Math.min(Math.max(requestedPageSize || 200, 1), 1000)
    const hasPagination = query.page !== undefined || query.page_size !== undefined

    const searchableFieldIds = SEARCHABLE_FIELDS.filter(fieldId => !hiddenFields.has(fieldId))
    if (keyword && searchableFieldIds.length === 0) return { forbidden: true }

    const rows = await this.repository.listAvailable({
      keyword,
      searchableFieldIds: keyword ? searchableFieldIds : [],
      page,
      pageSize,
      hasPagination
    })
    const visibleRows = this.masking.filterSensitiveFields(rows, permissions)

    return {
      rows: visibleRows,
      pagination: hasPagination ? {
        page,
        page_size: pageSize,
        count: rows.length,
        has_more: rows.length === pageSize
      } : null
    }
  }
}

module.exports = RentalDeviceService
