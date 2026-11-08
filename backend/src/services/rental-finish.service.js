'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const RentalFinishRepository = require('../repositories/rental-finish.repository')
const { ensureRentalSchema } = require('../utils/rental-schema')
const { isBuyoutMode } = require('../utils/rental-calculations')

class RentalFinishService {
  constructor({
    repository = new RentalFinishRepository(),
    databaseProvider = getDatabase,
    ensureSchema = ensureRentalSchema,
    withConnectionFn = withConnection
  } = {}) {
    this.repository = repository
    this.databaseProvider = databaseProvider
    this.ensureSchema = ensureSchema
    this.withConnection = withConnectionFn
  }

  async finish(rentalId) {
    await this.ensureSchema()
    return this.withConnection(this.databaseProvider, async connection => {
      try {
        await connection.beginTransaction()
        const rental = await this.repository.getForUpdate(connection, rentalId)
        if (!rental) throw new Error('租赁合同不存在')
        if (rental.status !== 'active' && rental.status !== 'overdue') throw new Error('该合同已经结束')
        if (isBuyoutMode(rental.billing_mode)) throw new Error('到期买断合同不能执行归还')

        const totalCost = await this.repository.calculateTotalCost(connection, rental.id)
        await this.repository.finishRental(connection, rental.id, totalCost)
        await this.repository.restorePhone(connection, rental.phone_id)
        await connection.commit()
        return rental.id
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }
}

module.exports = RentalFinishService
