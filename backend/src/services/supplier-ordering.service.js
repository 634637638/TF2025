'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const SupplierRepository = require('../repositories/supplier.repository')

class SupplierOrderingService {
  constructor({ database = getDatabase, repository = new SupplierRepository() } = {}) {
    this.database = database
    this.repository = repository
  }

  reorder(items) {
    return withConnection(this.database, async connection => {
      try {
        await connection.beginTransaction()
        for (const item of items) await this.repository.updateSortOrder(connection, item)
        await connection.commit()
        return { updated_count: items.length }
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = SupplierOrderingService
