'use strict'

const dataMaskingService = require('./data-masking.service')
const SubsidyExportRepository = require('../repositories/subsidy-export.repository')
const buildSubsidyFilters = require('../utils/subsidy-query-filters')
const buildSubsidyExportFile = require('../utils/subsidy-export-file')

const SORT_FIELDS = new Set(['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at'])

class SubsidyExportService {
  constructor({
    repository = new SubsidyExportRepository(),
    masking = dataMaskingService,
    buildExportFile = buildSubsidyExportFile
  } = {}) {
    this.repository = repository
    this.masking = masking
    this.buildExportFile = buildExportFile
  }

  async export({ userId, query }) {
    const { whereConditions, queryParams } = buildSubsidyFilters(query)
    const requestedSortField = query.sort_by || 'sale_time'
    const sortField = SORT_FIELDS.has(requestedSortField) ? requestedSortField : 'sale_time'
    const sortDirection = query.sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const rows = await this.repository.listForExport({ whereConditions, queryParams, sortField, sortDirection })
    const permissions = await this.masking.getUserFieldPermissions(userId, 'subsidy_subsidyview')
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const items = rows.map(item => ({
      ...item,
      has_different_handler: item.has_different_handler === 1 || item.has_different_handler === true
    }))
    return this.buildExportFile(items, hiddenFields)
  }
}

module.exports = SubsidyExportService
