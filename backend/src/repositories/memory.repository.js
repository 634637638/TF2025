'use strict'

const ReferenceManagementRepository = require('./reference-management.repository')

class MemoryRepository extends ReferenceManagementRepository {
  constructor() {
    super('memories')
  }
}

module.exports = MemoryRepository
