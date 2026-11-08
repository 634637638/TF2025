'use strict'

const log = require('../utils/log')
const dataMaskingService = require('./data-masking.service')
const SubsidyListRepository = require('../repositories/subsidy-list.repository')
const buildSubsidyFilters = require('../utils/subsidy-query-filters')
const { mapSubsidyPhotoUrls } = require('../utils/subsidy-protected-photo-url')

const SORT_FIELDS = new Set(['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at'])

class SubsidyListService {
  constructor({ repository = new SubsidyListRepository(), masking = dataMaskingService, mapPhotos = mapSubsidyPhotoUrls, logger = log } = {}) {
    this.repository = repository
    this.masking = masking
    this.mapPhotos = mapPhotos
    this.logger = logger
  }

  async list({ userId, query, onFiltersBuilt = () => {} }) {
    const { sort_by: sortBy = 'sale_time', sort_order: sortOrder = 'desc' } = query
    const page = Math.max(1, Number.parseInt(String(query.page || 1), 10) || 1)
    const pageSize = Math.min(500, Math.max(1, Number.parseInt(String(query.page_size || 20), 10) || 20))
    this.logger.info('🔍 国补列表查询参数:', { page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder, filters: query })

    const { whereConditions, queryParams } = buildSubsidyFilters(query)
    onFiltersBuilt({ page, page_size: pageSize, filterCount: whereConditions.length, queryParamCount: queryParams.length })
    const sortField = SORT_FIELDS.has(sortBy) ? sortBy : 'sale_time'
    const sortDirection = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * pageSize
    this.logger.info('📊 构建的WHERE条件:', whereConditions.join(' AND '))
    this.logger.info('📊 查询参数数量:', queryParams.length)

    const { subsidies, total, listQueryMs, countQueryMs } = await this.repository.list({
      whereConditions,
      queryParams,
      sortField,
      sortDirection,
      pageSize,
      offset
    })
    const formatted = subsidies.map(subsidy => {
      const hasHandler = subsidy.has_different_handler === 1 || subsidy.has_different_handler === true
      let photos = []
      if (subsidy.subsidy_photos) {
        try {
          photos = typeof subsidy.subsidy_photos === 'string'
            ? JSON.parse(subsidy.subsidy_photos)
            : subsidy.subsidy_photos
        } catch (error) {
          this.logger.error('解析 subsidy_photos 失败:', error)
        }
      }
      return {
        ...subsidy,
        sale_price: parseFloat(subsidy.sale_price),
        subsidy_amount: parseFloat(subsidy.subsidy_amount),
        subsidy_rate: parseFloat(subsidy.subsidy_rate),
        subsidy_photos: this.mapPhotos(photos, userId),
        has_different_handler: hasHandler,
        handler_info: hasHandler ? {
          handler_name: subsidy.handler_name,
          handler_phone: subsidy.handler_phone,
          handler_idcard: subsidy.handler_idcard
        } : null
      }
    })
    const data = await this.masking.maskDataList(formatted, userId, 'subsidy_subsidyview')
    const normalizedTotal = Number(total)
    const totalPages = Math.ceil(normalizedTotal / pageSize)
    return {
      data,
      listQueryMs,
      countQueryMs,
      pagination: {
        page,
        page_size: pageSize,
        total: normalizedTotal,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }
}

module.exports = SubsidyListService
