'use strict'

const { clearCache } = require('../middleware/cache')
const SubsidyAuditRepository = require('../repositories/subsidy-audit.repository')

class SubsidyAuditService {
  constructor({ repository = new SubsidyAuditRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async audit(recordId) {
    const updated = await this.repository.markAudited(recordId)
    if (updated) this.invalidateCache('/subsidy')
    return updated
  }
}

module.exports = SubsidyAuditService
