'use strict'

const ReferenceOrderingRepository = require('../repositories/reference-ordering.repository')
const { parseReferenceOrder } = require('../utils/reference-options')

class ReferenceOrderingService {
  constructor({ repository, domain, orderingRepository = new ReferenceOrderingRepository() }) {
    this.repository = repository
    this.domain = domain
    this.orderingRepository = orderingRepository
  }

  reorder(items) {
    items = parseReferenceOrder(items)
    return this.repository.withConnection(async connection => {
      try {
        await connection.beginTransaction()
        await this.orderingRepository.reorder(connection, this.domain, items)
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = ReferenceOrderingService
