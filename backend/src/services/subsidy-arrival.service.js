'use strict'

const { resolveStoreScope } = require('../utils/store-scope')

const SubsidyArrivalRepository = require('../repositories/subsidy-arrival.repository')
const { clearCache } = require('../middleware/cache')

class SubsidyArrivalService {
  constructor({ repository = new SubsidyArrivalRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async confirmArrival(id, actor) {
    const updated = await this.repository.confirmArrival(id, resolveStoreScope(actor))
    if (!updated) return false
    this.invalidateCache('/subsidy')
    return true
  }
}

module.exports = SubsidyArrivalService
