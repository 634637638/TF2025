'use strict'

/** 仅供库存原语回归提供外层事务；正式成交由SalesCheckoutService完整编排。 */
module.exports = async (service, input, actor) => {
  try {
    const data = await service.accessoryRepository.withConnection(async connection => {
      await connection.beginTransaction()
      try {
        const { accessory: _accessory, ...receipt } = await service.issueSale(input, actor, connection)
        await connection.commit()
        return receipt
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
    return { success: true, data }
  } catch (error) {
    return { success: false, code: error.statusCode ? error.code : 'DATABASE_ERROR', statusCode: error.statusCode }
  }
}
