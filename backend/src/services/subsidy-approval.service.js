'use strict'

const { clearCache } = require('../middleware/cache')
const SubsidyApprovalRepository = require('../repositories/subsidy-approval.repository')

class SubsidyApprovalService {
  constructor({ repository = new SubsidyApprovalRepository(), invalidateCache = clearCache } = {}) {
    this.repository = repository
    this.invalidateCache = invalidateCache
  }

  async approve(recordId, approved) {
    const updated = await this.repository.setApprovalStatus(recordId, approved ? 'approved' : 'rejected')
    if (updated) this.invalidateCache('/subsidy')
    return updated
  }
}

module.exports = SubsidyApprovalService
