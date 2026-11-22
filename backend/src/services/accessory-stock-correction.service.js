'use strict'

const crypto = require('node:crypto')
const BaseService = require('../core/base/base.service')
const Repository = require('../repositories/accessory-stock-correction.repository')
const AccessoryService = require('./accessory.service')
const { validId, moneyCents } = require('../utils/sale-input')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { createPurchaseSnapshot, projectPurchaseSnapshot } = require('../utils/accessory-purchase-snapshot')
const { getBeijingTimeString } = require('../utils/time')
const { prepareInvoiceNumberTransaction } = require('../utils/invoice-number')

const inputKeys = ['request_key', 'accessory_id', 'brand_id', 'product_model', 'supplier_id', 'store_id', 'total_quantity', 'purchase_cost', 'usage_type', 'serial_tracking', 'serial_numbers', 'remarks']

/** 只更正尚未发生后续业务的整批采购。原单、原回执、原事件均保留。 */
class AccessoryStockCorrectionService extends BaseService {
  constructor({ repository = new Repository(), accessoryService = new AccessoryService() } = {}) {
    super(); this.repository = repository; this.accessories = accessoryService
  }

  id(value) {
    if (!validId(value)) throw this.createError('原入库批次无效', 400, 'VALIDATION_ERROR')
    return Number(value)
  }

  async assertReady(connection) {
    if (!await this.repository.ready(connection) || !await this.accessories.accessoryRepository.stockInReady(connection)) {
      throw this.createError('商品库存更正或原采购凭据结构尚未就绪，请先完成受控迁移', 409, 'STOCK_CORRECTION_NOT_READY')
    }
  }

  async options(actor, accessoryId, query = {}) {
    this.getActorId(actor)
    const id = this.id(accessoryId)
    if (Object.keys(query).some(key => !['page', 'page_size'].includes(key))) throw this.createError('批次查询条件无效', 400, 'VALIDATION_ERROR')
    const { page, page_size } = this.accessories.inventoryReadPage(query)
    const scope = resolveStoreScope(actor, null)
    return this.accessories.readInventorySnapshot(async connection => {
      const result = await this.repository.options(id, scope, page, page_size, connection)
      return { ...result, data: result.data.map(row => ({ ...projectPurchaseSnapshot(row), purchase_id: Number(row.purchase_id) })) }
    })
  }

  async original(id, scope, connection, lock = false) {
    const row = await this.repository.purchase(id, scope, connection, lock)
    if (!row) throw this.createError('原入库批次不存在或无权访问', 404, 'NOT_FOUND')
    if (row.status !== 'completed') throw this.createError('该批次已更正或作废，请刷新后选择有效批次', 409, 'STOCK_CORRECTION_STALE')
    // 坏快照不回填当前主档；旧单没有可验证流水时也不能凭空推断。
    const purchase = projectPurchaseSnapshot(row)
    if (!purchase.has_snapshot) throw this.createError('历史入库缺少原资料快照，请先核对，不能直接更正', 409, 'STOCK_CORRECTION_UNTRACKED')
    if (!validId(row.accessory_id) || !validId(row.quantity) || moneyCents(row.purchase_cost) === null ||
      moneyCents(row.total_amount) !== moneyCents(row.purchase_cost) * Number(row.quantity)) this.conflict()
    return { row, purchase }
  }

  conflict() { throw this.createError('原采购、门店或SN流水不一致，无法直接更正，请先核对', 409, 'INVENTORY_LEDGER_CONFLICT') }

  async facts(row, scope, connection, lock = false) {
    const events = await this.repository.events(row.id, connection, lock)
    if (!events.length) throw this.createError('历史入库缺少可核验的原批次流水，无法直接更正', 409, 'STOCK_CORRECTION_UNTRACKED')
    if (events.some(event => event.event_type !== 'stock_in')) throw this.createError('该批次已有销售、赠送、划拨或其他后续业务，不能直接更正原入库', 409, 'STOCK_CORRECTION_USED')
    if (await this.repository.paymentExists(row.id, connection, lock)) throw this.createError('该批次已有付款或撤销付款记录，不能直接更正原入库', 409, 'STOCK_CORRECTION_PAID')
    const usage = events[0].usage_type, tracking = Number(events[0].serial_tracking), quantities = new Map()
    for (const event of events) {
      assertStoreInScope(scope, event.store_id)
      if (Number(event.accessory_id) !== Number(row.accessory_id) || !validId(event.quantity_delta) ||
        moneyCents(event.purchase_cost) !== moneyCents(row.purchase_cost) || event.usage_type !== usage ||
        !['sale', 'gift'].includes(usage) || ![0, 1].includes(tracking) || Number(event.serial_tracking) !== tracking) this.conflict()
      quantities.set(Number(event.store_id), (quantities.get(Number(event.store_id)) || 0) + Number(event.quantity_delta))
    }
    let distribution
    try { distribution = typeof row.distribution === 'string' ? JSON.parse(row.distribution) : row.distribution } catch { this.conflict() }
    if (!Array.isArray(distribution) || distribution.length !== quantities.size || new Set(distribution.map(item => item?.store_id)).size !== distribution.length ||
      distribution.some(item => !validId(item?.store_id) || !validId(item?.quantity) || quantities.get(Number(item.store_id)) !== Number(item.quantity)) ||
      [...quantities.values()].reduce((sum, value) => sum + value, 0) !== Number(row.quantity)) this.conflict()
    if (distribution.length !== 1 || Number(distribution[0].store_id) !== Number(row.store_id)) {
      throw this.createError('原入库分配并非入库店单店收货，当前单店表单不能直接更正，请先核对原分配', 409, 'STOCK_CORRECTION_DISTRIBUTION')
    }
    const allSerials = await this.repository.serials(row.id, connection, lock)
    const serials = allSerials.filter(serial => serial.status !== 'voided')
    const serialCounts = new Map()
    for (const serial of serials) {
      if (serial.status !== 'in_stock' || serial.sale_id || Number(serial.accessory_id) !== Number(row.accessory_id) ||
        !quantities.has(Number(serial.store_id)) || moneyCents(serial.purchase_cost) !== moneyCents(row.purchase_cost)) this.conflict()
      serialCounts.set(Number(serial.store_id), (serialCounts.get(Number(serial.store_id)) || 0) + 1)
    }
    if (tracking ? serials.length !== Number(row.quantity) || distribution.some(item => serialCounts.get(Number(item.store_id)) !== Number(item.quantity)) : serials.length) this.conflict()
    return { events, serials, allSerials, distribution, usage_type: usage, serial_tracking: tracking }
  }

  async context(actor, purchaseId) {
    this.getActorId(actor)
    const id = this.id(purchaseId), scope = resolveStoreScope(actor, null)
    return this.accessories.readInventorySnapshot(async connection => {
      await this.assertReady(connection)
      const { row, purchase } = await this.original(id, scope, connection)
      const facts = await this.facts(row, scope, connection)
      const product = await this.accessories.accessoryRepository.getAccessoryById(row.accessory_id, connection)
      if (!product) this.conflict()
      return { purchase_id: id, batch_no: row.batch_no, inventory_time: row.inventory_time, operator_name: row.operator_name,
        accessory: { ...product, name: purchase.name, category: purchase.category, color_name: purchase.color_name, product_model: purchase.product_model },
        supplier_id: Number(row.supplier_id), supplier_name: purchase.supplier_name, store_id: Number(row.store_id), store_name: purchase.store_name,
        total_quantity: Number(row.quantity), purchase_cost: Number(row.purchase_cost), usage_type: facts.usage_type,
        serial_tracking: facts.serial_tracking, serial_numbers: facts.serials.map(serial => ({ serial_number: serial.serial_number, store_id: Number(serial.store_id) })),
        remarks: row.remarks || '' }
    })
  }

  receipt(row, replayed) {
    return { stock_in_id: Number(row.id), batch_no: row.batch_no, accessory_id: Number(row.accessory_id), quantity: Number(row.quantity),
      total_amount: Number(row.total_amount), inventory_time: row.inventory_time, replayed }
  }

  async correct(actor, purchaseId, body = {}, { includeSerials = true } = {}) {
    this.getActorId(actor)
    const id = this.id(purchaseId)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !inputKeys.includes(key)) ||
      !validId(body.accessory_id) || !['sale', 'gift'].includes(body.usage_type) || ![0, 1].includes(body.serial_tracking)) {
      throw this.createError('请使用入库表单提交完整更正资料，不支持修改模板共享字段', 400, 'VALIDATION_ERROR')
    }
    const input = this.accessories.parseStockInInput(body, actor)
    const { scope, operatorId, quantity, costCents, supplierId, storeId, serials, serialMode } = input
    if (input.distribution.length !== 1 || serials.some(serial => serial.store_id !== storeId)) throw this.createError('本次商品及SN须归属同一入库店铺', 400, 'VALIDATION_ERROR')
    const hash = crypto.createHash('sha256').update(JSON.stringify([id, input.hash])).digest('hex')
    try {
      return await this.repository.withConnection(async connection => {
        await this.assertReady(connection)
        await connection.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
        await prepareInvoiceNumberTransaction(connection)
        await connection.beginTransaction()
        try {
          // 先按稳定顺序锁根模板，再锁原采购，兼容销售/划拨的锁顺序。
          const initial = await this.repository.purchase(id, scope, connection)
          if (!initial) throw this.createError('原入库批次不存在或无权访问', 404, 'NOT_FOUND')
          const products = []
          for (const productId of [initial.accessory_id, input.accessoryId]) {
            const product = await this.accessories.accessoryRepository.getAccessoryById(productId, connection)
            if (!product) throw this.createError('商品不存在', 404, 'NOT_FOUND')
            products.push(product)
          }
          const accessoryRepository = this.accessories.accessoryRepository
          const colorOwners = [...new Set(products.map(product => Number(product.color_template_id)).filter(ownerId => Number.isSafeInteger(ownerId) && ownerId > 0))].sort((a, b) => a - b)
          for (const ownerId of colorOwners) if (!await accessoryRepository.lockAccessory(ownerId, connection)) this.conflict()
          const colorFamilies = colorOwners.length ? await accessoryRepository.templateColors.families(colorOwners, connection, { forUpdate: true }) : []
          for (const rootId of [...new Set([...products.map(product => Number(product.template_id || product.id)), ...colorFamilies.map(row => Number(row.accessory_id))])].sort((a, b) => a - b)) {
            if (!await accessoryRepository.lockAccessory(rootId, connection)) this.conflict()
          }
          const locked = await this.repository.purchase(id, scope, connection, true)
          if (!locked) throw this.createError('原入库批次不存在或无权访问', 404, 'NOT_FOUND')
          const replay = await this.repository.byKey(body.request_key, connection)
          if (replay) {
            if (replay.request_hash !== hash || Number(replay.source_stock_in_id) !== id || Number(replay.operator_id) !== operatorId) throw this.createError('该请求已使用，不能更改原更正内容', 409, 'STOCK_CORRECTION_REQUEST_CONFLICT')
            const target = await this.repository.purchase(replay.target_stock_in_id, scope, connection)
            if (!target) throw this.createError('更正结果不存在或已超出门店授权范围', 404, 'NOT_FOUND')
            await connection.commit()
            return this.receipt(target, true)
          }
          const { row, purchase } = await this.original(id, scope, connection, true)
          const facts = await this.facts(row, scope, connection, true)
          if (!includeSerials && (facts.serial_tracking === 1 || serialMode || serials.length)) throw this.createError('无权更正SN入库资料', 403, 'FIELD_PERMISSION_DENIED')
          const repo = this.accessories.accessoryRepository, inventory = this.accessories.inventoryService
          for (const [index, product] of products.entries()) {
            const current = await repo.getAccessoryById(product.id, connection, { forUpdate: true })
            if (!current || Number(current.template_id || current.id) !== Number(product.template_id || product.id) || index === 0 && Number(current.id) !== Number(row.accessory_id)) this.conflict()
          }
          await this.accessories.validateProduct({ supplier_id: supplierId }, {}, connection)
          const store = await repo.getReference(storeId, 'store_id', connection)
          if (!store || Number(store.status) !== 1) throw this.createError('入库店铺不存在或已停用', 400, 'INVALID_REFERENCE')
          const data = { ...body, brand_id: body.brand_id === undefined ? products[0].brand_id : body.brand_id,
            product_model: body.product_model === undefined ? purchase.product_model : body.product_model }
          const { finalId, minStock } = await this.accessories.resolveStockInProduct(data, input, connection)
          // 原入库型号更正与模板档案、同模板历史展示资料使用同一事务。
          if (body.product_model !== undefined) {
            const rootId = Number(products[1].template_id || products[1].id)
            const profile = await this.accessories.validateProduct({ product_model: body.product_model }, products[1], connection)
            const family = colorFamilies.filter(row => Number(row.template_id) === Number(products[1].color_template_id))
            if (family.length) {
              await this.accessories.templateColors.update({ id: products[1].id, existing: products[1], data: profile, family, connection })
            } else if (!await repo.updateAccessory(rootId, { product_model: profile.product_model }, connection)) {
              throw this.createError('商品模板型号保存失败，请刷新后重试', 500, 'UPDATE_FAILED')
            }
            if (!family.length) await repo.syncProductProfileSnapshots(rootId, rootId, connection)
          }
          const targets = new Map(facts.distribution.map(item => [`${row.accessory_id}:${item.store_id}`, { accessory_id: Number(row.accessory_id), store_id: Number(item.store_id) }]))
          targets.set(`${finalId}:${storeId}`, { accessory_id: Number(finalId), store_id: storeId })
          const time = getBeijingTimeString(), actorName = actor.name || actor.username || ''
          for (const target of [...targets.values()].sort((a, b) => a.accessory_id - b.accessory_id || a.store_id - b.store_id)) {
            const stock = await repo.lockStoreStock(target.accessory_id, target.store_id, connection)
            await inventory.ensureBalance({ ...target, operator_id: operatorId, operator_name: actorName, time }, stock?.quantity || 0, connection)
          }
          if (await inventory.repository.batchConflict({ accessoryId: Number(row.accessory_id), scope, exact: true }, connection)) this.conflict()
          for (const event of facts.events) {
            if (!await this.repository.removeStock(row.accessory_id, event.store_id, Number(event.quantity_delta), time, connection)) this.conflict()
            await inventory.repository.append({ ...event, event_type: 'stock_correct', quantity_delta: -Number(event.quantity_delta),
              operator_id: operatorId, operator_name: actorName, remarks: '原入库资料更正冲回；关联替代批次见更正记录', time }, connection)
          }
          const source = await repo.purchaseSnapshotSource(finalId, supplierId, storeId, connection)
          const sameTemplate = Number(products[0].template_id || products[0].id) === Number(products[1].template_id || products[1].id)
          const snapshot = createPurchaseSnapshot({ ...source,
            ...(sameTemplate ? { name: purchase.name, category: purchase.category, color_name: purchase.color_name, unit: purchase.unit } : {}),
            ...(Number(finalId) === Number(row.accessory_id) ? { brand_name: purchase.brand_name } : {}),
            ...(supplierId === Number(row.supplier_id) ? { supplier_name: purchase.supplier_name } : {}),
            ...(storeId === Number(row.store_id) ? { store_name: purchase.store_name } : {}) }, { accessory_id: finalId, supplier_id: supplierId, store_id: storeId })
          const replacement = { batch_no: await this.accessories.generateBatchNo(connection), accessory_id: finalId, supplier_id: supplierId, store_id: storeId,
            quantity, purchase_cost: costCents / 100, total_amount: costCents * quantity / 100, distribution: JSON.stringify(input.distribution),
            remarks: body.remarks === undefined ? row.remarks : body.remarks.trim(), operator_id: row.operator_id, operator_name: row.operator_name,
            inventory_time: row.inventory_time, status: 'completed', product_snapshot: snapshot, request_key: body.request_key, request_hash: hash }
          const targetId = await repo.createStockInRecord(replacement, connection)
          await repo.updateAccessoryStock(finalId, storeId, quantity, 'add', minStock, connection)
          await inventory.receive({ accessory_id: finalId, store_id: storeId, stock_in_id: targetId, purchase_cost: costCents / 100,
            usage_type: input.usageType, serial_tracking: serialMode ? 1 : 0, operator_id: operatorId, operator_name: actorName, time }, quantity, connection)
          const selected = new Set(serials.map(serial => serial.serial_number))
          const units = await repo.lockSerials([...new Set([...facts.allSerials.map(serial => serial.serial_number), ...selected])].sort(), connection)
          const retained = new Set(facts.allSerials.map(serial => Number(serial.id)))
          if (units.some(unit => !retained.has(Number(unit.id)) && (unit.status !== 'voided' || Number(unit.stock_in_id) !== id))) throw this.createError('SN已被其他商品或批次使用，请核对', 400, 'DUPLICATE_SERIAL')
          for (const unit of units) {
            const keep = selected.has(unit.serial_number)
            if (!await this.repository.correctSerial(unit.id, { accessory_id: finalId,
              stock_in_id: targetId, store_id: storeId,
              purchase_cost: keep ? costCents / 100 : unit.purchase_cost, status: keep ? 'in_stock' : 'voided', time }, connection)) this.conflict()
            await repo.createSerialEvent({ serial_id: unit.id, event_type: 'stock_correct', stock_in_id: targetId,
              store_id: keep ? storeId : unit.store_id, operator_id: operatorId, operator_name: actorName, time }, connection)
          }
          for (const serial of serials.filter(serial => !units.some(unit => unit.serial_number === serial.serial_number))) {
            const serialId = await repo.createSerial({ ...serial, accessory_id: finalId, stock_in_id: targetId, purchase_cost: costCents / 100, time }, connection)
            await repo.createSerialEvent({ serial_id: serialId, event_type: 'stock_in', stock_in_id: targetId, store_id: storeId, operator_id: operatorId, operator_name: actorName, time }, connection)
          }
          if (!await this.repository.cancelOriginal(id, connection)) throw this.createError('原批次已变化，请刷新重试', 409, 'STOCK_CORRECTION_STALE')
          const snapshotFacts = (record, tracking, usage, numbers) => ({ stock_in_id: Number(record.id), accessory_id: Number(record.accessory_id),
            supplier_id: Number(record.supplier_id), store_id: Number(record.store_id), quantity: Number(record.quantity), purchase_cost: Number(record.purchase_cost),
            total_amount: Number(record.total_amount), batch_no: record.batch_no, product_snapshot: record.product_snapshot,
            distribution: record.distribution, remarks: record.remarks, serial_tracking: tracking, usage_type: usage, serial_numbers: numbers })
          await this.repository.append({ source_stock_in_id: id, target_stock_in_id: targetId, request_key: body.request_key, request_hash: hash,
            before_snapshot: snapshotFacts(row, facts.serial_tracking, facts.usage_type, facts.serials.map(serial => serial.serial_number)),
            after_snapshot: snapshotFacts({ ...replacement, id: targetId }, serialMode ? 1 : 0, input.usageType, [...selected]),
            operator_id: operatorId, operator_name: actorName, time }, connection)
          await connection.commit()
          return this.receipt({ ...replacement, id: targetId }, false)
        } catch (error) { await connection.rollback(); throw error }
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK') throw this.createError('更正请求或SN发生冲突，请保持原内容重试并核对批次', 409, 'STOCK_CORRECTION_REQUEST_CONFLICT')
      throw error
    }
  }
}
module.exports = AccessoryStockCorrectionService
