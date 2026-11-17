'use strict'

const crypto = require('node:crypto')
const BaseService = require('../core/base/base.service')
const Repository = require('../repositories/accessory-inventory.repository')
const AccessoryService = require('./accessory.service')
const { validId } = require('../utils/sale-input')
const { isIntegerInput } = require('../utils/input-values')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { getBeijingTimeString } = require('../utils/time')

const REQUEST_KEY = /^[a-f0-9]{32}$/

/** 普通数量商品盘点：只调整当前可用结存，保留采购、销售、赠送和退货事实。 */
class AccessoryInventoryAdjustmentService extends BaseService {
  constructor({ repository = new Repository(), accessoryService = new AccessoryService() } = {}) {
    super()
    this.repository = repository
    this.accessories = accessoryService
  }

  async adjust(actor, accessoryId, body = {}) {
    const operatorId = this.getActorId(actor)
    if (!validId(accessoryId) || !body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['request_key', 'row_key', 'expected_quantity', 'counted_quantity', 'reason'].includes(key)) ||
      typeof body.request_key !== 'string' || !REQUEST_KEY.test(body.request_key) ||
      typeof body.row_key !== 'string' || !/^event:\d+$/.test(body.row_key) ||
      !isIntegerInput(body.counted_quantity) ||
      !Number.isSafeInteger(Number(body.counted_quantity)) || Number(body.counted_quantity) < 0 || Number(body.counted_quantity) > 999999 ||
      typeof body.expected_quantity !== 'number' || !Number.isSafeInteger(body.expected_quantity) || body.expected_quantity < 0 ||
      typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 1000) {
      throw this.createError('请填写有效盘点数量、原因和请求标识', 400, 'VALIDATION_ERROR')
    }
    const id = Number(accessoryId), eventId = Number(body.row_key.slice(6)), counted = Number(body.counted_quantity)
    const scope = resolveStoreScope(actor, null)
    if (!validId(eventId)) throw this.createError('批次编号无效', 400, 'VALIDATION_ERROR')
    const hash = crypto.createHash('sha256').update(JSON.stringify([operatorId, id, body.row_key, counted, body.reason.trim(), body.expected_quantity])).digest('hex')
    return this.repository.withConnection(async connection => {
      await connection.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
      await connection.beginTransaction()
      try {
        if (!await this.repository.adjustmentSchemaReady(connection)) throw this.createError('库存盘点结构尚未就绪，请先完成受控迁移', 409, 'INVENTORY_ADJUSTMENT_NOT_READY')
        const accessory = await this.accessories.accessoryRepository.getAccessoryById(id, connection)
        if (!accessory) throw this.createError('商品不存在', 404, 'NOT_FOUND')
        const rootId = Number(accessory.template_id || accessory.id)
        if (!await this.accessories.accessoryRepository.lockAccessory(rootId, connection)) throw this.createError('商品已变化，请刷新后重试', 409, 'INVENTORY_ADJUSTMENT_STALE')
        const replay = await this.repository.adjustmentByKey(body.request_key, connection, true)
        if (replay) {
          if (replay.request_hash !== hash || Number(replay.accessory_id) !== id || Number(replay.operator_id) !== operatorId) {
            throw this.createError('该盘点请求已使用，不能修改原盘点内容', 409, 'INVENTORY_ADJUSTMENT_REQUEST_CONFLICT')
          }
          assertStoreInScope(scope, replay.store_id)
          await connection.commit()
          return { adjustment_id: Number(replay.id), accessory_id: id, store_id: Number(replay.store_id),
            stock_in_id: Number(replay.stock_in_id), previous_quantity: Number(replay.previous_quantity),
            counted_quantity: Number(replay.counted_quantity), delta: Number(replay.quantity_delta), replayed: true }
        }
        const batch = await this.repository.adjustmentBatch(eventId, id, scope, connection, true)
        if (!batch || !validId(batch.stock_in_id) || batch.purchase_status !== 'completed' ||
          !Number.isSafeInteger(Number(batch.quantity)) || Number(batch.quantity) < 0 || batch.purchase_cost === null) {
          throw this.createError('批次不存在或库存流水无法核对', 409, 'INVENTORY_LEDGER_CONFLICT')
        }
        assertStoreInScope(scope, batch.store_id)
        if (Number(batch.serial_tracking) !== 0) throw this.createError('SN商品暂不支持数量盘点，请先逐件核对串码', 409, 'INVENTORY_ADJUSTMENT_SERIAL_REQUIRED')
        const stock = await this.accessories.accessoryRepository.lockStoreStock(id, Number(batch.store_id), connection)
        const batchScope = { allStores: false, storeIds: [Number(batch.store_id)] }
        if (!stock || await this.repository.batchConflict({ accessoryId: id, exact: true, scope: batchScope }, connection)) {
          throw this.createError('门店库存与批次流水不一致，请先核对差异', 409, 'INVENTORY_LEDGER_CONFLICT')
        }
        if (Number(batch.quantity) !== body.expected_quantity) throw this.createError('批次库存已变化，请刷新后重新盘点', 409, 'INVENTORY_ADJUSTMENT_STALE')
        if (Number(batch.quantity) === counted) {
          await connection.commit()
          return { adjustment_id: null, accessory_id: id, store_id: Number(batch.store_id), stock_in_id: Number(batch.stock_in_id),
            previous_quantity: Number(batch.quantity), counted_quantity: counted, delta: 0, replayed: false, unchanged: true }
        }
        const delta = counted - Number(batch.quantity), time = getBeijingTimeString()
        if (!await this.repository.adjustQuantity(id, Number(batch.store_id), delta, time, connection)) throw this.createError('门店库存不足或已变化，请刷新后重试', 409, 'INVENTORY_ADJUSTMENT_STALE')
        const inventoryEventId = await this.repository.append({
          accessory_id: id, store_id: Number(batch.store_id), stock_in_id: Number(batch.stock_in_id),
          purchase_cost: batch.purchase_cost, usage_type: batch.usage_type, serial_tracking: 0,
          event_type: 'stock_correct', quantity_delta: delta, operator_id: operatorId, operator_name: actor.name || actor.username || '',
          remarks: `库存盘点：${body.reason.trim()}`, time
        }, connection)
        const adjustmentId = await this.repository.appendAdjustmentRecord({
          request_key: body.request_key, request_hash: hash, accessory_id: id, store_id: Number(batch.store_id),
          stock_in_id: Number(batch.stock_in_id), previous_quantity: Number(batch.quantity), counted_quantity: counted,
          quantity_delta: delta, inventory_event_id: Number(inventoryEventId), operator_id: operatorId,
          operator_name: actor.name || actor.username || '', remarks: body.reason.trim(), time
        }, connection)
        await connection.commit()
        return { adjustment_id: Number(adjustmentId), accessory_id: id, store_id: Number(batch.store_id), stock_in_id: Number(batch.stock_in_id),
          previous_quantity: Number(batch.quantity), counted_quantity: counted, delta, replayed: false }
      } catch (error) {
        try { await connection.rollback() } catch (rollbackError) { connection.destroy(); throw rollbackError }
        throw error
      }
    })
  }
}

module.exports = AccessoryInventoryAdjustmentService
