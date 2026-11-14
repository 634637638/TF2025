'use strict'
const AccessoryInventoryRepository = require('../repositories/accessory-inventory.repository')
const { assertBatchBalance, openingBatches, allocateBatches } = require('../utils/accessory-batches')
const { allocateReturn, validateReturnFacts } = require('../utils/accessory-returns')

/** 事务由配件业务服务拥有；所有库存变动共用根模板锁和已有连接。 */
class AccessoryInventoryService {
  constructor({ repository = new AccessoryInventoryRepository() } = {}) { this.repository = repository }

  async ensureBalance(context, quantity, executor) {
    let balances = await this.repository.balances(context.accessory_id, context.store_id, executor)
    if (!balances.length) {
      const serials = await this.repository.stockSerialOrigins(context.accessory_id, context.store_id, executor)
      balances = openingBatches(quantity, serials)
      for (const row of balances) await this.repository.append({ ...context, ...row, event_type: 'legacy_opening', quantity_delta: row.quantity,
        remarks: '历史库存接续：普通商品来源及成本待核对；SN保留已有采购事实' }, executor)
    }
    assertBatchBalance(balances, quantity)
    return balances
  }

  async receive(context, quantity, executor) {
    await this.repository.append({ ...context, event_type: 'stock_in', quantity_delta: quantity }, executor)
  }

  allocate(input) { return allocateBatches(input) }

  allocateReturn(input) { return allocateReturn(input) }
  validateReturnFacts(input) { return validateReturnFacts(input) }

  async restore(context, allocations, executor) {
    for (const row of allocations) await this.repository.appendReturn({ ...context, ...row,
      event_type: `${context.sale_type}_return`, quantity_delta: row.quantity }, executor)
  }

  async move(context, allocations, executor) {
    for (const row of allocations) {
      await this.repository.append({ ...context, ...row, store_id: context.from_store_id, event_type: 'transfer_out', quantity_delta: -row.quantity }, executor)
      await this.repository.append({ ...context, ...row, store_id: context.to_store_id, event_type: 'transfer_in', quantity_delta: row.quantity }, executor)
    }
  }

  async issue(context, allocations, executor) {
    for (const row of allocations) await this.repository.append({ ...context, ...row, event_type: context.sale_type, quantity_delta: -row.quantity }, executor)
  }
}
module.exports = AccessoryInventoryService
