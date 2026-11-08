'use strict'

const log = require('../utils/log')
const dataMaskingService = require('./data-masking.service')
const SubsidyDetailRepository = require('../repositories/subsidy-detail.repository')
const { mapSubsidyPhotoUrls } = require('../utils/subsidy-protected-photo-url')

class SubsidyDetailService {
  constructor({
    repository = new SubsidyDetailRepository(),
    maskingService = dataMaskingService,
    mapPhotos = mapSubsidyPhotoUrls,
    logger = log
  } = {}) {
    this.repository = repository
    this.maskingService = maskingService
    this.mapPhotos = mapPhotos
    this.logger = logger
  }

  async getById(id, userId) {
    const subsidy = await this.repository.findById(id)
    if (!subsidy) return null

    subsidy.sale_price = parseFloat(subsidy.sale_price)
    subsidy.subsidy_amount = parseFloat(subsidy.subsidy_amount)
    subsidy.subsidy_rate = parseFloat(subsidy.subsidy_rate)
    subsidy.sale_time = subsidy.sale_time_formatted
    delete subsidy.sale_time_formatted

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

    const hasHandler = subsidy.has_different_handler === 1 || subsidy.has_different_handler === true
    subsidy.subsidy_photos = this.mapPhotos(photos, userId)
    subsidy.has_different_handler = hasHandler
    subsidy.handler_info = hasHandler ? {
      handler_name: subsidy.handler_name || '',
      handler_phone: subsidy.handler_phone || '',
      handler_idcard: subsidy.handler_idcard || ''
    } : null

    return this.maskingService.maskDataItem(subsidy, userId, 'subsidy_subsidyview')
  }
}

module.exports = SubsidyDetailService
