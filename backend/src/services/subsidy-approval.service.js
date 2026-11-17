'use strict'

const { resolveStoreScope } = require('../utils/store-scope')

const { clearCache } = require('../middleware/cache')
const SubsidyApprovalRepository = require('../repositories/subsidy-approval.repository')

class SubsidyApprovalService {
  constructor({ repository = new SubsidyApprovalRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async approve(recordId, approved, actor) {
    const updated = await this.repository.setApprovalStatus(recordId, approved ? 'approved' : 'rejected', resolveStoreScope(actor))
    if (updated) this.invalidateCache('/subsidy')
    return updated
  }
}

module.exports = SubsidyApprovalService
