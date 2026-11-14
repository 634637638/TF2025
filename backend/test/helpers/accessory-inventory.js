'use strict'
const AccessoryInventoryService = require('../../src/services/accessory-inventory.service')
const { batchKey } = require('../../src/utils/accessory-batches')

/** 正式事务回归夹具：使用实际分配/接续服务，事件随外层状态一起回滚。 */
module.exports = function inventoryFixture(state, check = () => {}) {
  state.inventoryEvents = []
  const repository = {
    async balances(id, store, executor) {
      check(executor)
      const groups = new Map()
      for (const event of state.inventoryEvents.filter(row => row.accessory_id === id && row.store_id === store)) {
        const key = batchKey(event), group = groups.get(key) || { ...event, quantity: 0 }
        group.quantity += event.quantity_delta; groups.set(key, group)
      }
      return [...groups.values()].sort((a, b) => Number(Boolean(a.stock_in_id)) - Number(Boolean(b.stock_in_id)) ||
        String(state.entries?.find(row => row.id === a.stock_in_id)?.inventory_time || '').localeCompare(String(state.entries?.find(row => row.id === b.stock_in_id)?.inventory_time || '')) ||
        Number(a.stock_in_id || 0) - Number(b.stock_in_id || 0))
    },
    async stockSerialOrigins(id, store, executor) { check(executor); return (state.serials || []).filter(row => row.accessory_id === id && row.store_id === store && row.status === 'in_stock') },
    async append(data, executor) { check(executor); state.inventoryEvents.push({ ...data }); return state.inventoryEvents.length }
  }
  return new AccessoryInventoryService({ repository })
}
