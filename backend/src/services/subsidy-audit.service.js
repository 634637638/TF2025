'use strict'

const { resolveStoreScope } = require('../utils/store-scope')

const { clearCache } = require('../middleware/cache')
const SubsidyAuditRepository = require('../repositories/subsidy-audit.repository')

class SubsidyAuditService {
  constructor({ repository = new SubsidyAuditRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async audit(recordId, actor) {
    const updated = await this.repository.markAudited(recordId, resolveStoreScope(actor))
    if (updated) this.invalidateCache('/subsidy')
    return updated
  }
}

module.exports = SubsidyAuditService
