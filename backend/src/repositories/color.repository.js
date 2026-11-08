'use strict'

const ReferenceManagementRepository = require('./reference-management.repository')

class ColorRepository extends ReferenceManagementRepository {
  constructor() {
    super('colors')
  }
}

module.exports = ColorRepository
