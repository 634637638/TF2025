'use strict'

const SubsidyArrivalRepository = require('../repositories/subsidy-arrival.repository')
const { clearCache } = require('../middleware/cache')

class SubsidyArrivalService {
  constructor({ repository = new SubsidyArrivalRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async confirmArrival(id) {
    const updated = await this.repository.confirmArrival(id)
    if (!updated) return false
    this.invalidateCache('/subsidy')
    return true
  }
}

module.exports = SubsidyArrivalService
