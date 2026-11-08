'use strict'

const dataMaskingService = require('./data-masking.service')
const SubsidyFilterOptionsRepository = require('../repositories/subsidy-filter-options.repository')

const FILTER_FIELDS = {
  brands: 'device_info.brand',
  models: 'device_info.model',
  colors: 'device_info.color',
  memories: 'device_info.memory',
  stores: 'store_info.store_name'
}

class SubsidyFilterOptionsService {
  constructor({ repository = new SubsidyFilterOptionsRepository(), masking = dataMaskingService } = {}) {
    this.repository = repository
    this.masking = masking
  }

  async getFilterOptions(userId) {
    const permissions = await this.masking.getUserFieldPermissions(userId, 'subsidy_subsidyview')
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const options = await this.repository.getFilterOptions()
    const visible = key => !hiddenFields.has(FILTER_FIELDS[key])

    return {
      ...(visible('brands') && { brands: options.brands.map(row => row.phone_brand) }),
      ...(visible('models') && { models: options.models.map(row => row.phone_model) }),
      ...(visible('colors') && { colors: options.colors.map(row => row.phone_color) }),
      ...(visible('memories') && { memories: options.memories.map(row => row.phone_memory) }),
      ...(visible('stores') && {
        stores: options.stores.map(row => ({ id: row.store_id, name: row.store_name }))
      })
    }
  }
}

module.exports = SubsidyFilterOptionsService
