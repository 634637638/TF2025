/**
 * 配件业务逻辑层
 * 处理所有配件相关的业务逻辑和数据验证
 */
const AccessoryRepository = require('../repositories/accessory.repository')
const log = require('../utils/log')
const { isDatabaseAvailabilityError } = require('../utils/database-errors')
const crypto = require('crypto')
const BaseService = require('../core/base/base.service')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { getBeijingTimeString, isBeijingDateTime, normalizeBusinessDateTime } = require('../utils/time')
const { normalizeImei } = require('../utils/imei')
const SystemSettingsRepository = require('../repositories/system-settings.repository')
const AccessoryInventoryService = require('./accessory-inventory.service')
const { validId, moneyCents } = require('../utils/sale-input')
const { isIntegerInput } = require('../utils/input-values')
const { hasColumn, hasTable } = require('./schema-inspector.service')
const { createPurchaseSnapshot, projectPurchaseSnapshot } = require('../utils/accessory-purchase-snapshot')
const { AccessoryTemplateColorService } = require('./accessory-template-color.service')
const { generateDailyDocumentNumber, prepareInvoiceNumberTransaction } = require('../utils/invoice-number')

const WAREHOUSE_SETTING_KEY = 'accessory_warehouse_store_id'

class AccessoryService extends BaseService {
  constructor({ repository = new AccessoryRepository(), settingsRepository = new SystemSettingsRepository(), inventoryService = new AccessoryInventoryService(), tableExists = hasTable } = {}) {
    super()
    this.accessoryRepository = repository
    this.settingsRepository = settingsRepository
    this.inventoryService = inventoryService
    this.tableExists = tableExists
    this.templateColors = new AccessoryTemplateColorService(repository)
  }

  async getInventoryBatches(actor, accessoryId, query = {}) {
    this.getActorId(actor)
    const invalid = () => { throw this.createError('批次库存查询参数无效', 400, 'VALIDATION_ERROR') }
    if (!validId(accessoryId) || Object.keys(query).some(key => !['page', 'page_size', 'store_id', 'include_zero'].includes(key))) invalid()
    if (query.include_zero !== undefined && !['true', 'false', true, false].includes(query.include_zero)) invalid()
    for (const key of ['page', 'page_size', 'store_id']) if (query[key] !== undefined && !validId(query[key])) invalid()
    const page = Number(query.page ?? 1), pageSize = Number(query.page_size ?? 20)
    if (page > 1000000 || pageSize > 100) invalid()
    const input = { accessoryId: Number(accessoryId), scope: resolveStoreScope(actor, query.store_id), page, pageSize }
    if (query.include_zero === true || query.include_zero === 'true') input.includeZero = true
    return this.readInventorySnapshot(async connection => {
      for (const table of ['accessory_inventory_events', 'accessory_serials', 'accessory_stock', 'accessory_stock_in']) {
        if (!await this.tableExists(table, connection)) throw this.createError('库存流水结构未就绪，请先完成迁移', 409, 'INVENTORY_LEDGER_NOT_READY')
      }
      if (!await this.accessoryRepository.getAccessoryById(input.accessoryId, connection)) throw this.createError('商品不存在', 404, 'NOT_FOUND')
      if (await this.inventoryService.repository.batchConflict(input, connection)) throw this.createError('批次库存与门店或SN汇总不一致，请核对库存流水', 409, 'INVENTORY_LEDGER_CONFLICT')
      const result = await this.inventoryService.repository.currentBatches(input, connection)
      return { ...result, data: result.data.map(row => {
        // 云端BIGINT按字符串返回；仅在响应边界校验并归一编号，金额保持原精度。
        if (!validId(row.accessory_id) || !validId(row.store_id)) throw this.createError('批次库存返回的商品或门店编号无效', 500, 'INVALID_BATCH_RESPONSE')
        return { ...row, accessory_id: Number(row.accessory_id), store_id: Number(row.store_id) }
      }) }
    })
  }

  async readInventorySnapshot(operation) {
    return this.accessoryRepository.withConnection(async connection => {
      let started = false
      try {
        await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await connection.beginTransaction()
        started = true
        return await operation(connection)
      } finally {
        if (!started) connection.destroy()
        else {
          try { await connection.rollback() }
          catch (error) { connection.destroy(); throw error }
        }
      }
    })
  }

  inventoryReadScope(actor, query = {}) {
    this.getActorId(actor)
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw this.createError('库存查询条件无效', 400, 'VALIDATION_ERROR')
    if (query.store_id !== undefined && !validId(query.store_id)) throw this.createError('库存查询门店无效', 400, 'VALIDATION_ERROR')
    return resolveStoreScope(actor, query.store_id)
  }

  inventoryReadPage(query = {}) {
    if (['page', 'page_size'].some(key => query[key] !== undefined && !validId(query[key])) ||
      Number(query.page ?? 1) > 1000000 || Number(query.page_size ?? 50) > 100) {
      throw this.createError('库存查询分页无效', 400, 'VALIDATION_ERROR')
    }
    return { page: Number(query.page ?? 1), page_size: Number(query.page_size ?? 50) }
  }

  optionalId(value, label) {
    if (value === undefined || value === null || value === '') return null
    const id = Number(value)
    if (!isIntegerInput(value) || id <= 0) throw this.createError(`${label}无效`, 400, 'VALIDATION_ERROR')
    return id
  }

  normalizeSerials(input, scope) {
    if (input === undefined) return []
    if (!Array.isArray(input) || input.length > 1000) throw this.createError('SN 必须为列表，每次最多1000件', 400, 'VALIDATION_ERROR')
    const seen = new Set()
    return input.map(item => {
      const raw = scope ? item?.serial_number : item
      if (typeof raw !== 'string') throw this.createError('SN 序列号格式不正确', 400, 'VALIDATION_ERROR')
      const serialNumber = normalizeImei(raw)
      if (!/^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(serialNumber)) throw this.createError('SN 最长100位，只支持字母、数字、点、短横线、下划线或斜线', 400, 'VALIDATION_ERROR')
      if (seen.has(serialNumber)) throw this.createError('本次录入存在重复 SN，请核对', 400, 'DUPLICATE_SERIAL')
      seen.add(serialNumber)
      return scope ? { serial_number: serialNumber, store_id: assertStoreInScope(scope, item.store_id) } : serialNumber
    })
  }

  serialPage(value, fallback, maximum) {
    if (value === undefined) return fallback
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw this.createError('SN分页参数无效', 400, 'VALIDATION_ERROR')
    return number
  }

  async getSerials(actor, accessoryId, query = {}) {
    this.getActorId(actor)
    const id = this.optionalId(accessoryId, '配件')
    if (!id) throw this.createError('请选择商品', 400, 'VALIDATION_ERROR')
    const search = query.search === undefined ? '' : String(query.search).trim().toUpperCase()
    if (search.length > 100) throw this.createError('SN 检索最多100位', 400, 'VALIDATION_ERROR')
    if (query.stock_only !== undefined && ![true, false, 'true', 'false'].includes(query.stock_only)) throw this.createError('库存筛选参数无效', 400, 'VALIDATION_ERROR')
    return this.accessoryRepository.getSerials({ stockOnly: query.stock_only === true || query.stock_only === 'true', accessoryId: id, scope: resolveStoreScope(actor, query.store_id), search,
      page: this.serialPage(query.page, 1, 1000000), pageSize: this.serialPage(query.page_size, 20, 100) })
  }

  async getSaleOptions(actor, query = {}, searchFields = ['name', 'category', 'barcode', 'brand_name', 'product_model', 'serial_number'], includePurchaseCost = false) {
    this.getActorId(actor)
    if (Object.keys(query).some(key => !['store_id', 'search', 'page', 'page_size', 'film_only', 'film_free_only', 'film_model_id', 'search_mode', 'match_mode'].includes(key))) throw this.createError('商品检索参数无效', 400, 'VALIDATION_ERROR')
    if (query.film_model_id !== undefined && (!validId(query.film_model_id) || ![true, 'true'].includes(query.film_only))) throw this.createError('贴膜适配型号无效', 400, 'VALIDATION_ERROR')
    if (query.film_free_only !== undefined && (![true, false, 'true', 'false'].includes(query.film_free_only) || [true, 'true'].includes(query.film_free_only) && ![true, 'true'].includes(query.film_only))) throw this.createError('免费贴膜筛选参数无效', 400, 'VALIDATION_ERROR')
    if (query.search_mode !== undefined && !['regular', 'serial'].includes(query.search_mode)) throw this.createError('商品检索模式无效', 400, 'VALIDATION_ERROR')
    if (query.film_only !== undefined && ![true, false, 'true', 'false'].includes(query.film_only)) throw this.createError('贴膜筛选参数无效', 400, 'VALIDATION_ERROR')
    if (!validId(query.store_id)) throw this.createError('请先选择有效销售门店', 400, 'VALIDATION_ERROR')
    const storeId = Number(query.store_id)
    assertStoreInScope(resolveStoreScope(actor, null), storeId)
    const filmFreeOnly = query.film_free_only === undefined ? undefined : query.film_free_only === true || query.film_free_only === 'true'
    if (filmFreeOnly !== undefined && !await this.accessoryRepository.filmReady()) throw this.createError('贴膜服务结构尚未就绪，请先完成部署迁移', 409, 'FILM_SERVICE_NOT_READY')
    if (['page', 'page_size'].some(key => query[key] !== undefined && !validId(query[key]))) throw this.createError('商品分页参数无效', 400, 'VALIDATION_ERROR')
    if (query.search !== undefined && (typeof query.search !== 'string' || query.search.trim().length > 100)) throw this.createError('商品检索最多100字', 400, 'VALIDATION_ERROR')
    if (query.match_mode !== undefined && (query.match_mode !== 'exact' || !query.search?.trim() || !['regular', 'serial'].includes(query.search_mode))) throw this.createError('商品精确检索参数无效', 400, 'VALIDATION_ERROR')
    return this.accessoryRepository.getSaleOptions({ storeId, search: query.search?.trim() || '', searchFields,
      ...(includePurchaseCost ? { includePurchaseCost: true } : {}),
      ...(filmFreeOnly !== undefined ? { filmFreeOnly } : {}),
      ...(query.search_mode ? { searchMode: query.search_mode } : {}),
      ...(query.match_mode === 'exact' ? { exactMatch: true } : {}),
      ...(query.film_model_id ? { filmModelId: Number(query.film_model_id) } : {}),
      ...(query.film_only === true || query.film_only === 'true' ? { filmOnly: true } : {}),
      page: this.serialPage(query.page, 1, 1000000), pageSize: this.serialPage(query.page_size, 20, 100) })
  }

  async getSerialTrace(actor, serialNumber) {
    this.getActorId(actor)
    const [serial] = this.normalizeSerials([serialNumber])
    const result = await this.accessoryRepository.getSerialTrace(serial, resolveStoreScope(actor, null))
    if (!result) throw this.createError('未找到可查看的 SN 记录', 404, 'NOT_FOUND')
    return result
  }

  async getTransfers(actor, accessoryId, query = {}) {
    this.getActorId(actor)
    const id = this.optionalId(accessoryId, '配件')
    if (!id) throw this.createError('请选择商品', 400, 'VALIDATION_ERROR')
    return this.accessoryRepository.getTransfers(id, resolveStoreScope(actor, null), this.serialPage(query.page, 1, 1000000), this.serialPage(query.page_size, 20, 100))
  }

  async transfer(data, actor) {
    try {
      const operatorId = this.getActorId(actor)
      const accessoryId = this.optionalId(data.accessory_id, '配件')
      const scope = resolveStoreScope(actor, null)
      const fromStore = assertStoreInScope(scope, data.from_store_id)
      const toStore = assertStoreInScope(scope, data.to_store_id)
      const quantity = Number(data.quantity)
      if (!accessoryId || fromStore === toStore || typeof data.quantity === 'boolean' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) throw this.createError('请选择不同的来源店、接收店及有效划拨数量', 400, 'VALIDATION_ERROR')
      if (typeof data.request_key !== 'string' || !/^[a-f0-9]{32}$/.test(data.request_key)) throw this.createError('划拨请求标识无效，请重新打开弹窗', 400, 'VALIDATION_ERROR')
      const serials = this.normalizeSerials(data.serial_numbers).sort()
      const remarks = typeof data.remarks === 'string' ? data.remarks.trim() : ''
      if (remarks.length > 500) throw this.createError('备注最多500字', 400, 'VALIDATION_ERROR')
      const hash = crypto.createHash('sha256').update(JSON.stringify([operatorId, accessoryId, fromStore, toStore, quantity, serials, remarks])).digest('hex')
      const result = await this.accessoryRepository.withConnection(async connection => {
        await connection.beginTransaction()
        try {
          const existing = await this.accessoryRepository.getAccessoryById(accessoryId, connection)
          if (!existing) throw this.createError('配件不存在', 404, 'NOT_FOUND')
          // 与采购/销售共用根模板锁，避免相反方向划拨产生锁顺序冲突。
          const template = await this.accessoryRepository.lockAccessory(existing.template_id || existing.id, connection)
          if (!template) throw this.createError('商品模板不存在', 404, 'NOT_FOUND')
          const replay = await this.accessoryRepository.getTransferByKey(data.request_key, connection)
          if (replay) {
            if (replay.request_hash !== hash) throw this.createError('同一请求不能更改划拨内容，请重新打开弹窗', 409, 'TRANSFER_REQUEST_CONFLICT')
            await connection.commit()
            return { id: replay.id, replayed: true }
          }
          for (const storeId of [fromStore, toStore]) {
            const store = await this.accessoryRepository.getReference(storeId, 'store_id', connection)
            if (!store || Number(store.status) !== 1) throw this.createError('划拨店铺不存在或已停用', 400, 'INVALID_REFERENCE')
          }
          const stock = await this.accessoryRepository.lockStoreStock(accessoryId, fromStore, connection)
          if (!stock || Number(stock.quantity) < quantity) throw this.createError('来源店剩余库存不足', 400, 'INSUFFICIENT_STOCK')
          let units = []
          if (serials.length) {
            if (serials.length !== quantity) throw this.createError('划拨数量必须与所选SN数量一致', 400, 'SERIAL_QUANTITY_MISMATCH')
            units = await this.accessoryRepository.lockSerials(serials, connection)
            if (units.length !== quantity || units.some(unit => Number(unit.accessory_id) !== accessoryId || Number(unit.store_id) !== fromStore || unit.status !== 'in_stock')) throw this.createError('SN不在来源店或已出库，请刷新核对', 400, 'SERIAL_UNAVAILABLE')
          } else if (quantity > Number(stock.quantity) - await this.accessoryRepository.countStockSerials(accessoryId, fromStore, connection)) throw this.createError('无SN库存不足，请选择具体SN划拨', 400, 'INSUFFICIENT_PLAIN_STOCK')
          const time = getBeijingTimeString()
          const context = { accessory_id: accessoryId, store_id: fromStore, operator_id: operatorId, operator_name: actor.name || actor.username || '', remarks, time }
          const balances = await this.inventoryService.ensureBalance(context, stock.quantity, connection)
          const destination = await this.accessoryRepository.lockStoreStock(accessoryId, toStore, connection)
          await this.inventoryService.ensureBalance({ ...context, store_id: toStore }, destination?.quantity || 0, connection)
          const { allocations } = this.inventoryService.allocate({ balances, quantity, serials: units })
          if (!await this.accessoryRepository.moveInventory({ accessory_id: accessoryId, from_store_id: fromStore, to_store_id: toStore, quantity, min_stock: Number(stock.min_stock ?? 5) }, connection)) throw this.createError('来源店剩余库存不足', 400, 'INSUFFICIENT_STOCK')
          for (const unit of units) {
            if (!await this.accessoryRepository.moveSerial(unit.id, fromStore, toStore, time, connection)) throw this.createError('SN位置已变化，请刷新核对', 409, 'SERIAL_UNAVAILABLE')
          }
          const id = await this.accessoryRepository.createTransfer({ request_key: data.request_key, request_hash: hash,
            accessory_id: accessoryId, from_store_id: fromStore, to_store_id: toStore, quantity, serial_numbers: serials,
            operator_id: operatorId, operator_name: actor.name || actor.username || '', remarks, time }, connection)
          await this.inventoryService.move({ ...context, from_store_id: fromStore, to_store_id: toStore, transfer_id: id }, allocations, connection)
          await connection.commit()
          return { id, replayed: false }
        } catch (error) { await connection.rollback(); throw error }
      })
      return this.success('库存划拨成功', result)
    } catch (error) {
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      if (error.code === 'ER_DUP_ENTRY') return { ...this.error('请求已处理，请刷新后核对原划拨单', 'TRANSFER_REQUEST_CONFLICT'), statusCode: 409 }
      log.error('配件划拨失败:', error)
      return this.error('配件划拨失败', 'DATABASE_ERROR')
    }
  }

  async getInventoryLocations(actor, accessoryId, query = {}) {
    this.getActorId(actor)
    const id = this.optionalId(accessoryId, '配件')
    if (!id) throw this.createError('请选择商品', 400, 'VALIDATION_ERROR')
    if (query.include_variants !== undefined && ![true, false, 'true', 'false'].includes(query.include_variants)) throw this.createError('库存商品范围参数无效', 400, 'VALIDATION_ERROR')
    return this.accessoryRepository.getInventoryLocations(id, resolveStoreScope(actor, null), query.include_variants !== false && query.include_variants !== 'false')
  }

  async getEntryOptions(actor, query = {}) {
    this.getActorId(actor)
    const brandId = this.optionalId(query.brand_id, '适配手机品牌')
    const accessoryId = this.optionalId(query.accessory_id, '配件')
    const modelIds = String(query.model_ids || '').split(',').filter(Boolean).map(value => this.optionalId(value, '适配手机型号'))
    const current = accessoryId ? await this.accessoryRepository.getAccessoryById(accessoryId) : {}
    if (!current) throw this.createError('配件不存在', 404, 'NOT_FOUND')
    if (accessoryId && !current.model_ids) current.model_ids = await this.accessoryRepository.getCompatibleModelIds(accessoryId)
    const options = await this.accessoryRepository.getEntryOptions({ storeScope: resolveStoreScope(actor, null), brandId, modelIds, current })
    const warehouse = await this.settingsRepository.getSettingByKey(WAREHOUSE_SETTING_KEY)
    const warehouseId = Number(warehouse?.value || 0)
    return { ...options, default_store_id: options.stores.some(store => Number(store.id) === warehouseId && Number(store.status ?? 1) === 1) ? warehouseId : null }
  }

  async getSettings(actor) {
    this.getActorId(actor)
    const scope = resolveStoreScope(actor, null)
    const [setting, options] = await Promise.all([
      this.settingsRepository.getSettingByKey(WAREHOUSE_SETTING_KEY),
      this.accessoryRepository.getEntryOptions({ storeScope: scope, current: {}, modelIds: [] })
    ])
    const stores = options.stores.filter(store => Number(store.status ?? 1) === 1)
    const id = Number(setting?.value || 0)
    return { warehouse_store_id: stores.some(store => Number(store.id) === id) ? id : null, stores }
  }

  async saveSettings(actor, data) {
    this.getActorId(actor)
    if (!Object.hasOwn(data, 'warehouse_store_id') || Object.keys(data).some(key => key !== 'warehouse_store_id')) {
      throw this.createError('请提交有效的总仓店铺设置', 400, 'VALIDATION_ERROR')
    }
    const id = this.optionalId(data.warehouse_store_id, '总仓店铺')
    if (id) {
      assertStoreInScope(resolveStoreScope(actor, null), id)
      const store = await this.accessoryRepository.getReference(id, 'store_id')
      if (!store || Number(store.status) !== 1) throw this.createError('总仓店铺不存在或已停用', 400, 'INVALID_REFERENCE')
    }
    await this.settingsRepository.upsertSetting(WAREHOUSE_SETTING_KEY, id === null ? '' : String(id), 'string')
    return this.getSettings(actor)
  }

  async validateProduct(data, existing = {}, executor) {
    const normalized = { ...data }
    if (data.film_enabled !== undefined) throw this.createError('用于贴膜开关已停用，请改用商品模板的免费专用设置', 400, 'VALIDATION_ERROR')
    if (data.free_film !== undefined && ![0, 1].includes(data.free_film)) throw this.createError('免费专用开关无效', 400, 'VALIDATION_ERROR')
    if (data.min_stock !== undefined) {
      if (typeof data.min_stock !== 'number' || !Number.isSafeInteger(data.min_stock) || data.min_stock < 0 || data.min_stock > 9999) throw this.createError('预警值必须为0到9999的整数', 400, 'VALIDATION_ERROR')
      normalized.min_stock = data.min_stock
    }
    if (data.status !== undefined && ![0, 1].includes(data.status)) {
      throw this.createError('启用状态无效', 400, 'VALIDATION_ERROR')
    }
    if (data.serial_tracking !== undefined) {
      if (![0, 1].includes(data.serial_tracking)) throw this.createError('SN 管理方式无效', 400, 'VALIDATION_ERROR')
      normalized.serial_tracking = data.serial_tracking
    }
    if (data.sale_price !== undefined) {
      const price = Number(data.sale_price)
      if (data.sale_price === null || data.sale_price === '' || typeof data.sale_price === 'boolean' ||
          !Number.isFinite(price) || price < 0 || price >= 100000000 ||
          Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
        throw this.createError('默认零售价必须为非负金额，最多两位小数且小于1亿元', 400, 'VALIDATION_ERROR')
      }
      normalized.sale_price = price
    }
    for (const [field, maxLength] of [['name', 200], ['category', 100], ['product_model', 100], ['remarks', 1000]]) {
      if (data[field] === undefined) continue
      if (data[field] !== null && typeof data[field] !== 'string') throw this.createError('商品文本字段格式不正确', 400, 'VALIDATION_ERROR')
      const value = (data[field] || '').trim()
      if (value.length > maxLength) throw this.createError(`商品字段超出长度限制（${maxLength}）`, 400, 'VALIDATION_ERROR')
      normalized[field] = value || null
    }
    if (data.name !== undefined && !normalized.name) throw this.createError('配件名称不能为空', 400, 'VALIDATION_ERROR')
    if (data.barcode !== undefined) {
      if (data.barcode !== null && typeof data.barcode !== 'string') throw this.createError('条形码格式不正确', 400, 'VALIDATION_ERROR')
      normalized.barcode = data.barcode?.trim() || null
      if (normalized.barcode?.length > 100) throw this.createError('条形码不能超过100个字符', 400, 'VALIDATION_ERROR')
    }
    const labels = {
      brand_id: '品牌', model_id: '适配手机型号', color_id: '颜色', supplier_id: '供应商',
      category_id: '商品分类', unit_id: '计量单位'
    }
    for (const [field, label] of Object.entries(labels)) {
      if (data[field] === undefined) continue
      const id = this.optionalId(data[field], label)
      normalized[field] = id
      if (!id) continue
      const reference = await this.accessoryRepository.getReference(id, field, executor)
      if (!reference || (Number(reference.status) !== 1 && Number(existing[field]) !== id)) {
        throw this.createError(`${label}不存在或已停用，请重新选择`, 400, 'INVALID_REFERENCE')
      }
      if (field === 'supplier_id' && reference.business_scope === 'phone' && Number(existing[field]) !== id) {
        throw this.createError('该供应商未开通配件业务范围，请重新选择', 400, 'INVALID_REFERENCE')
      }
      if (field === 'brand_id' && reference.business_scope === 'phone' && Number(existing[field]) !== id) {
        throw this.createError('该品牌未开通配件业务范围，请重新选择', 400, 'INVALID_REFERENCE')
      }
      if (field === 'model_id' && reference.brand_business_scope === 'accessory' && Number(existing[field]) !== id) {
        throw this.createError('适配型号必须属于手机业务品牌', 400, 'INVALID_REFERENCE')
      }
    }
    if (data.category_id !== undefined && normalized.category_id) {
      normalized.category = (await this.accessoryRepository.getReference(normalized.category_id, 'category_id', executor)).name
    }
    if (data.unit_id !== undefined && normalized.unit_id) {
      normalized.unit = (await this.accessoryRepository.getReference(normalized.unit_id, 'unit_id', executor)).name
    }
    if (data.model_ids !== undefined) {
      if (!Array.isArray(data.model_ids) || data.model_ids.length > 500) {
        throw this.createError('适配型号格式不正确', 400, 'VALIDATION_ERROR')
      }
      const ids = [...new Set(data.model_ids.map(value => this.optionalId(value, '适配手机型号')).filter(Boolean))]
      // 数据库 GROUP_CONCAT 返回字符串，内存调用也可能传入数组。
      const existingModelIds = new Set((Array.isArray(existing.model_ids)
        ? existing.model_ids : String(existing.model_ids || '').split(',')).map(Number))
      for (const id of ids) {
        const reference = await this.accessoryRepository.getReference(id, 'model_id', executor)
        const isExisting = existingModelIds.has(id) || Number(existing.model_id) === id
        if (reference?.brand_business_scope === 'accessory' && !isExisting) {
          throw this.createError('适配型号必须属于手机业务品牌', 400, 'INVALID_REFERENCE')
        }
        if (!reference || (Number(reference.status) !== 1 && !isExisting)) {
          throw this.createError('适配手机型号不存在或已停用，请重新选择', 400, 'INVALID_REFERENCE')
        }
      }
      normalized.model_ids = ids
      normalized.model_id = ids[0] || null
    }
    return normalized
  }

  async getProductCatalog() {
    return this.success('获取商品资料成功', await this.accessoryRepository.getProductCatalog())
  }

  async saveProductCatalogItem(kind, id, data) {
    if (data.film_enabled !== undefined) {
      throw this.createError('贴膜配置已移至商品模板', 400, 'VALIDATION_ERROR')
    }
    const name = String(data.name || '').trim()
    const sortOrder = Number(data.sort_order ?? 0)
    const status = Number(data.status ?? 1)
    if (!['category', 'unit'].includes(kind) || !name || name.length > (kind === 'category' ? 100 : 32) ||
        !Number.isSafeInteger(sortOrder) || sortOrder < 0 || ![0, 1].includes(status)) {
      throw this.createError('商品资料格式不正确', 400, 'VALIDATION_ERROR')
    }
    const description = kind === 'category' ? String(data.description || '').trim() : undefined
    if (description?.length > 500) throw this.createError('分类说明不能超过500个字符', 400, 'VALIDATION_ERROR')
    const saved = await this.accessoryRepository.saveCatalogItem(kind, id, { name, sort_order: sortOrder, status, description: description || null })
    return this.success('商品资料保存成功', saved)
  }

  /**
   * 生成批次号
   */
  generateBatchNo(connection, time) {
    return generateDailyDocumentNumber('RK', connection, time || getBeijingTimeString(), 6)
  }

  /**
   * 生成销售单号
   */
  generateSaleNo(connection, time) {
    return generateDailyDocumentNumber('PS', connection, time || getBeijingTimeString(), 6)
  }

  /**
   * 创建成功响应
   */
  success(message, data = null) {
    return {
      success: true,
      message,
      data
    }
  }

  /**
   * 创建错误响应
   */
  error(message, code = null) {
    return {
      success: false,
      message,
      code,
      ...(code === 'DATABASE_ERROR' ? { statusCode: 500 } : {})
    }
  }

  /**
   * 获取配件列表
   */
  async getAccessories(params = {}, actor) {
    try {
      const store_scope = this.inventoryReadScope(actor, params), page = this.inventoryReadPage(params)
      if (['brand_id', 'model_id', 'supplier_id', 'color_id'].some(key => params[key] !== undefined && !validId(params[key])) ||
        params.mode !== undefined && !['templates', 'inventory'].includes(params.mode) ||
        params.status !== undefined && params.status !== null && (!isIntegerInput(params.status) || ![0, 1].includes(Number(params.status))) ||
        params.search !== undefined && (typeof params.search !== 'string' || params.search.length > 200) ||
        params.model_name !== undefined && (typeof params.model_name !== 'string' || params.model_name.length > 200) ||
        params.category !== undefined && (typeof params.category !== 'string' || params.category.length > 100)) {
        throw this.createError('商品查询条件无效', 400, 'VALIDATION_ERROR')
      }
      const result = await this.readInventorySnapshot(connection => this.accessoryRepository.getAccessories({
        ...params, ...page, store_scope
      }, connection))
      return this.success('获取配件列表成功', result)
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取配件列表失败:', error)
      return this.error('获取配件列表失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 获取配件详情
   */
  async getAccessoryDetail(id, actor) {
    try {
      const scope = this.inventoryReadScope(actor)
      if (!validId(id)) throw this.createError('商品ID无效', 400, 'VALIDATION_ERROR')
      return await this.readInventorySnapshot(async connection => {
        const accessory = await this.accessoryRepository.getAccessoryById(id, connection, { storeScope: scope })
        if (!accessory) {
          return this.error('配件不存在', 'NOT_FOUND')
        }

        // 获取库存信息
        const stock = await this.accessoryRepository.getAccessoryStock(id, connection, scope)

        return this.success('获取配件详情成功', {
          ...accessory,
          stock
        })
      })
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取配件详情失败:', error)
      return this.error('获取配件详情失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 根据条形码获取配件
   */
  async getAccessoryByBarcode(barcode, actor) {
    try {
      const scope = this.inventoryReadScope(actor)
      if (typeof barcode !== 'string' || !barcode.trim() || barcode.length > 100) throw this.createError('商品条形码无效', 400, 'VALIDATION_ERROR')
      return await this.readInventorySnapshot(async connection => {
        const accessory = await this.accessoryRepository.getAccessoryByBarcode(barcode, connection, { storeScope: scope })
        if (!accessory) {
          return this.error('未找到该条形码的配件', 'NOT_FOUND')
        }

        // 获取库存信息
        const stock = await this.accessoryRepository.getAccessoryStock(accessory.id, connection, scope)

        return this.success('获取配件成功', {
          ...accessory,
          stock
        })
      })
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('根据条形码获取配件失败:', error)
      return this.error('根据条形码获取配件失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 创建配件
   */
  async createAccessory(data) {
    try {
      const colorVariants = data.color_variants
      data = await this.validateProduct(data)
      // 验证必填字段
      if (!data.name) {
        return this.error('配件名称不能为空', 'VALIDATION_ERROR')
      }
      if (colorVariants !== undefined) return this.success('创建多颜色商品模板成功', await this.templateColors.create(data, colorVariants))

      // 检查条形码是否已存在
      if (data.barcode) {
        const existing = await this.accessoryRepository.getAccessoryByBarcode(data.barcode, undefined, { includeInactive: true })
        if (existing) {
          return this.error('该条形码已存在', 'DUPLICATE_BARCODE')
        }
      }

      const accessory = await this.accessoryRepository.withConnection(async connection => {
        await connection.beginTransaction()
        try {
          await this.accessoryRepository.lockFilmConfiguration(connection, data)
          const id = await this.accessoryRepository.createAccessory(data, connection)
          if (data.model_ids !== undefined) await this.accessoryRepository.replaceCompatibleModels(id, data.model_ids, connection)
          const created = await this.accessoryRepository.getAccessoryById(id, connection)
          await connection.commit()
          return created
        } catch (error) {
          await connection.rollback()
          throw error
        }
      })

      return this.success('创建商品模板成功', accessory)
    } catch (error) {
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      if (error.code === 'ER_DUP_ENTRY') return this.error('该条形码已存在，请使用其他条码', 'DUPLICATE_BARCODE')
      log.error('创建配件失败:', error)
      return this.error('创建配件失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 更新配件
   */
  async updateAccessory(id, data) {
    try {
      const colorVariants = data.color_variants
      const existing = await this.accessoryRepository.getAccessoryById(id)
      if (!existing) {
        return this.error('配件不存在', 'NOT_FOUND')
      }
      if (!existing.model_ids && this.accessoryRepository.getCompatibleModelIds) {
        existing.model_ids = await this.accessoryRepository.getCompatibleModelIds(id)
      }

      data = await this.validateProduct(data, existing)

      // 如果要修改条形码，检查是否重复
      if (data.barcode && data.barcode !== existing.barcode) {
        const duplicate = await this.accessoryRepository.getAccessoryByBarcode(data.barcode, undefined, { includeInactive: true })
        if (duplicate && Number(duplicate.id) !== Number(id)) {
          return this.error('该条形码已存在', 'DUPLICATE_BARCODE')
        }
      }

      const updated = await this.accessoryRepository.withConnection(async connection => {
        await connection.beginTransaction()
        try {
          await this.accessoryRepository.lockFilmConfiguration(connection, data)
          const rootId = Number(existing.template_id || existing.id)
          const family = this.accessoryRepository.templateColors
            ? await this.accessoryRepository.templateColors.families([rootId], connection) : []
          if (family.length) {
            const current = await this.templateColors.update({ id, existing, data, input: colorVariants, family, connection })
            await connection.commit()
            return current
          }
          if (colorVariants !== undefined) {
            const current = await this.templateColors.promote({ id, existing, data, input: colorVariants, connection })
            await connection.commit()
            return current
          }
          const root = await this.accessoryRepository.lockAccessory(rootId, connection)
          if (!root) throw this.createError('商品模板不存在，请刷新后重试', 404, 'NOT_FOUND')
          if (this.accessoryRepository.templateColors && (await this.accessoryRepository.templateColors.families([rootId], connection, { currentRead: true })).length) {
            throw this.createError('模板颜色关联已变化，请刷新后重新编辑', 409, 'PROFILE_CORRECTION_STALE')
          }
          if (Number(id) !== rootId && !await this.accessoryRepository.lockAccessory(id, connection)) {
            throw this.createError('商品资料已变化，请刷新后重试', 409, 'PROFILE_CORRECTION_STALE')
          }
          if (data.brand_id !== undefined && Number(data.brand_id || 0) !== Number(existing.brand_id || 0)) {
            const duplicate = Number(root.brand_id || 0) === Number(data.brand_id || 0) ||
              await this.accessoryRepository.getBrandVariant(rootId, data.brand_id, connection)
            if (duplicate && Number(duplicate.id || duplicate) !== Number(id)) {
              throw this.createError('该商品模板下已存在此配件品牌的商品，不能直接合并库存与历史记录', 409, 'DUPLICATE_BRAND_VARIANT')
            }
          }
          const childFields = ['brand_id', 'supplier_id', 'purchase_cost']
          const sharedFields = ['name', 'barcode', 'category', 'category_id', 'model_id', 'color_id', 'sale_price', 'unit', 'unit_id', 'description', 'image_url', 'min_stock', 'serial_tracking', 'product_model', 'status', 'remarks', 'free_film']
          const childData = Object.fromEntries(childFields.filter(field => data[field] !== undefined).map(field => [field, data[field]]))
          const sharedData = Object.fromEntries(sharedFields.filter(field => data[field] !== undefined).map(field => [field, data[field]]))
          // 品牌库存商品继承模板共享资料；档案更正仅独立保留实际商品品牌及采购来源。
          const childSaved = existing.template_id
            ? (!Object.keys(childData).length || await this.accessoryRepository.updateAccessory(id, childData, connection))
            : true
          const sharedSaved = existing.template_id
            ? (!Object.keys(sharedData).length || await this.accessoryRepository.updateAccessory(rootId, sharedData, connection))
            : await this.accessoryRepository.updateAccessory(id, { ...sharedData, ...childData }, connection)
          const saved = childSaved && sharedSaved
          if (!saved) throw this.createError('商品资料保存失败，请刷新后重试', 500, 'UPDATE_FAILED')
          if (data.model_ids !== undefined) await this.accessoryRepository.replaceCompatibleModels(rootId, data.model_ids, connection)
          const current = await this.accessoryRepository.getAccessoryById(id, connection)
          if (!current) throw this.createError('商品资料更新后无法核对，请刷新重试', 409, 'PROFILE_CORRECTION_STALE')
          await this.accessoryRepository.syncProductProfileSnapshots(id, rootId, connection)
          await connection.commit()
          return current
        } catch (error) {
          await connection.rollback()
          throw error
        }
      })
      if (!updated) {
        return this.error('更新配件失败', 'UPDATE_FAILED')
      }

      return this.success('更新配件成功', updated)
    } catch (error) {
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) {
        return { ...this.error('商品资料正在更新，请刷新后重新编辑', 'PROFILE_CORRECTION_STALE'), statusCode: 409 }
      }
      if (error.code === 'ER_DUP_ENTRY') return this.error(data.color_variants === undefined && data.brand_id !== undefined
        ? '该商品模板下已存在相同品牌的商品，不能直接合并库存与历史记录'
        : '该条形码已存在，请使用其他条码', data.color_variants === undefined && data.brand_id !== undefined ? 'DUPLICATE_BRAND_VARIANT' : 'DUPLICATE_BARCODE')
      log.error('更新配件失败:', error)
      return this.error('更新配件失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 删除配件
   */
  async deleteAccessory(id) {
    try {
      const existing = await this.accessoryRepository.getAccessoryById(id)
      if (!existing) {
        return this.error('配件不存在', 'NOT_FOUND')
      }

      if (this.accessoryRepository.templateColors) {
        const result = await this.updateAccessory(id, { status: 0 })
        return result.success ? this.success('删除配件成功') : result
      }
      const deleted = await this.accessoryRepository.deleteAccessory(id)
      if (!deleted) {
        return this.error('删除配件失败', 'DELETE_FAILED')
      }

      return this.success('删除配件成功')
    } catch (error) {
      log.error('删除配件失败:', error)
      return this.error('删除配件失败', 'DATABASE_ERROR')
    }
  }

  /** 新采购与原批次更正共用输入、门店、分币金额及防重摘要。 */
  parseStockInInput(data, actor) {
    if (data.color_variants !== undefined) throw this.createError('请先选择具体颜色再入库，不能提交整组颜色规格', 400, 'COLOR_VARIANT_REQUIRED')
    const operatorId = this.getActorId(actor)
    const inventoryTime = data.inventory_time === undefined ? undefined : normalizeBusinessDateTime(data.inventory_time)
    if ((data.inventory_time !== undefined && !inventoryTime) || (inventoryTime !== undefined && !isBeijingDateTime(inventoryTime))) {
      throw this.createError('请选择有效的入库时间（北京时间，精确到秒）', 400, 'VALIDATION_ERROR')
    }
    if (typeof data.request_key !== 'string' || !/^[a-f0-9]{32}$/.test(data.request_key)) {
      throw this.createError('入库请求标识无效，请重新打开入库窗口', 400, 'VALIDATION_ERROR')
    }
    const scope = resolveStoreScope(actor, null)
    if (data.distribution !== undefined && (!Array.isArray(data.distribution) || data.distribution.length > 1000)) {
      throw this.createError('门店分配格式不正确', 400, 'VALIDATION_ERROR')
    }
    // 公共门店范围兼容查询数组；写入必须先验证原值，不能把数组/布尔转成编号。
    for (const value of [data.store_id, ...(data.distribution || []).map(item => item?.store_id),
      ...(Array.isArray(data.serial_numbers) ? data.serial_numbers.map(item => item?.store_id) : [])]) {
      if (!isIntegerInput(value) || Number(value) <= 0) throw this.createError('入库门店无效', 400, 'VALIDATION_ERROR')
    }
    const serials = this.normalizeSerials(data.serial_numbers, scope)
    const storeId = assertStoreInScope(scope, data.store_id)
    const supplierId = this.optionalId(data.supplier_id, '供应商')
    if (!supplierId) throw this.createError('请选择供应商', 400, 'VALIDATION_ERROR')
    const usageType = data.usage_type === undefined ? 'sale' : data.usage_type
    if (!['sale', 'gift'].includes(usageType)) throw this.createError('请选择收费或赠送入库用途', 400, 'VALIDATION_ERROR')
    if (data.remarks !== undefined && (typeof data.remarks !== 'string' || data.remarks.trim().length > 1000)) throw this.createError('备注必须为文本且最多1000字', 400, 'VALIDATION_ERROR')
    if (data.serial_tracking !== undefined && ![0, 1].includes(data.serial_tracking)) throw this.createError('SN模式无效', 400, 'VALIDATION_ERROR')
    const serialMode = data.serial_tracking === undefined ? serials.length > 0 : data.serial_tracking === 1
    if (!serialMode && serials.length) throw this.createError('普通入库不能携带SN', 400, 'VALIDATION_ERROR')
    const quantity = serialMode ? serials.length : Number(data.total_quantity)
    const costCents = moneyCents(data.purchase_cost)
    if ((!serialMode && !isIntegerInput(data.total_quantity)) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 999999) {
      throw this.createError('入库数量必须为正整数且不超过999999', 400, 'VALIDATION_ERROR')
    }
    if (costCents === null || costCents * quantity >= 10000000000) {
      throw this.createError('价格最多保留两位小数，入库总额不能超过字段范围', 400, 'VALIDATION_ERROR')
    }
    const quantities = new Map()
    for (const item of data.distribution || []) {
      const targetId = assertStoreInScope(scope, item?.store_id)
      const value = Number(item?.quantity)
      if (!isIntegerInput(item?.quantity) || value < 0 || value > 999999) throw this.createError('分配数量必须为非负整数且不超过999999', 400, 'VALIDATION_ERROR')
      quantities.set(targetId, (quantities.get(targetId) || 0) + value)
    }
    const distributed = [...quantities.values()].reduce((sum, value) => sum + value, 0)
    if (distributed > quantity) throw this.createError('门店分配数量不能超过入库总数', 400, 'VALIDATION_ERROR')
    quantities.set(storeId, (quantities.get(storeId) || 0) + quantity - distributed)
    const distribution = [...quantities].filter(([, value]) => value > 0)
      .sort(([a], [b]) => a - b).map(([store_id, quantity]) => ({ store_id, quantity }))
    const accessoryId = this.optionalId(data.accessory_id, '配件')
    const productFields = ['barcode', 'name', 'category', 'category_id', 'product_model', 'brand_id', 'model_id', 'model_ids',
      'color_id', 'sale_price', 'unit', 'unit_id', 'status', 'min_stock', 'description', 'image_url']
    const hash = crypto.createHash('sha256').update(JSON.stringify({
      operator_id: operatorId, accessory_id: accessoryId, supplier_id: supplierId, store_id: storeId,
      ...(inventoryTime === undefined ? {} : { inventory_time: inventoryTime }),
      quantity, cost_cents: costCents, usage_type: usageType, distribution, serial_tracking: serialMode,
      serials: [...serials].sort((a, b) => a.serial_number < b.serial_number ? -1 : a.serial_number > b.serial_number ? 1 : 0), remarks: data.remarks?.trim() || '',
      product: productFields.map(key => [key, data[key] === undefined ? { omitted: true } : data[key]])
    })).digest('hex')
    return { operatorId, scope, serials, storeId, supplierId, usageType, serialMode, quantity, costCents, distribution, accessoryId, hash, inventoryTime }
  }

  /** 调用方持有事务；共享模板及实际品牌商品的建档规则。 */
  async resolveStockInProduct(data, { accessoryId, supplierId, costCents }, connection) {
    let minStock = 5
    let existing = accessoryId ? await this.accessoryRepository.getAccessoryById(accessoryId, connection) : null
    if (accessoryId && !existing) throw this.createError('配件不存在', 404, 'NOT_FOUND')
    if (!existing && data.barcode) existing = await this.accessoryRepository.getAccessoryByBarcode(data.barcode, connection)
    if (existing?.color_variants?.length && Number(existing.color_template_id) === Number(existing.id)) {
      throw this.createError('请选择本次入库的具体商品颜色', 400, 'COLOR_VARIANT_REQUIRED')
    }
    if (existing && Number(existing.status) !== 1) throw this.createError('配件已停用', 400, 'INVALID_REFERENCE')
    let finalId = existing?.id
    if (!finalId) {
      const product = await this.validateProduct({ ...data, supplier_id: supplierId }, {}, connection)
      if (!product.name) throw this.createError('请填写配件名称', 400, 'VALIDATION_ERROR')
      minStock = product.min_stock ?? 5
      finalId = await this.accessoryRepository.createAccessory(product, connection)
      if (product.model_ids !== undefined) await this.accessoryRepository.replaceCompatibleModels(finalId, product.model_ids, connection)
    } else {
      const template = await this.accessoryRepository.lockAccessory(existing.template_id || existing.id, connection)
      if (!template || template.template_id || Number(template.status) !== 1) {
        throw this.createError('商品模板不存在或已停用', 400, 'INVALID_REFERENCE')
      }
      minStock = Number(template.min_stock ?? 5)
      const brandId = data.brand_id === undefined ? (existing.brand_id || null) : this.optionalId(data.brand_id, '品牌')
      await this.validateProduct({ brand_id: brandId, product_model: data.product_model }, existing, connection)
      if (Number(brandId || 0) === Number(template.brand_id || 0)) {
        // 历史有品牌商品继续使用原 ID，既有库存和单据不迁移。
        finalId = template.id
      } else {
        const variant = await this.accessoryRepository.getBrandVariant(template.id, brandId, connection)
        finalId = variant?.id || await this.accessoryRepository.createAccessory({
          ...template, template_id: template.id, barcode: null, brand_id: brandId,
          product_model: template.product_model || null,
          supplier_id: supplierId, purchase_cost: costCents / 100
        }, connection)
      }
    }
    return { finalId, minStock }
  }

  /**
   * 配件入库
   */
  async stockIn(data, actor, transaction) {
    if (data.film_enabled !== undefined || data.free_film !== undefined) return { ...this.error('贴膜规则请在商品模板中设置', 'VALIDATION_ERROR'), statusCode: 400 }
    if (data.entries !== undefined && !transaction) return this.stockInColors(data, actor)
    try {
      const parsed = this.parseStockInInput(data, actor)
      const { operatorId, scope, serials, storeId, supplierId, usageType, serialMode, quantity, costCents, distribution, accessoryId, inventoryTime } = parsed
      const hash = transaction ? crypto.createHash('sha256').update(`${transaction.groupHash}:${parsed.hash}`).digest('hex') : parsed.hash
      const receipt = (row, replayed) => ({ stock_in_id: Number(row.id), batch_no: row.batch_no,
        accessory_id: Number(row.accessory_id), quantity: Number(row.quantity), total_amount: Number(row.total_amount),
        inventory_time: row.inventory_time, replayed })
      const checkReplay = row => {
        if (!row) return null
        if (Number(row.operator_id) !== operatorId || row.request_hash !== hash || (row.status !== 'completed' && !row.corrected) ||
          !isIntegerInput(row.id) || Number(row.id) <= 0 || Number(row.quantity) !== quantity ||
          moneyCents(row.purchase_cost) !== costCents || moneyCents(row.total_amount) !== costCents * quantity ||
          Number(row.supplier_id) !== supplierId || !row.batch_no || !row.inventory_time || inventoryTime !== undefined && row.inventory_time !== inventoryTime) {
          throw this.createError('该入库请求已使用，不能更改原入库内容', 409, 'STOCK_IN_REQUEST_CONFLICT')
        }
        assertStoreInScope(scope, row.store_id)
        let targets
        try { targets = typeof row.distribution === 'string' ? JSON.parse(row.distribution) : row.distribution }
        catch { throw this.createError('原采购分配凭据不完整，请核对原单', 409, 'STOCK_IN_REQUEST_CONFLICT') }
        if (!Array.isArray(targets)) throw this.createError('原采购分配凭据不完整，请核对原单', 409, 'STOCK_IN_REQUEST_CONFLICT')
        if (targets.some(item => !isIntegerInput(item?.store_id) || !isIntegerInput(item?.quantity))) throw this.createError('原采购分配凭据不完整，请核对原单', 409, 'STOCK_IN_REQUEST_CONFLICT')
        const normalizedTargets = targets.map(item => ({ store_id: Number(item.store_id), quantity: Number(item.quantity) })).sort((a, b) => a.store_id - b.store_id)
        if (JSON.stringify(normalizedTargets) !== JSON.stringify(distribution)) throw this.createError('原采购分配凭据不一致，请核对原单', 409, 'STOCK_IN_REQUEST_CONFLICT')
        targets.forEach(item => assertStoreInScope(scope, item.store_id))
        return receipt(row, true)
      }
      const execute = async connection => {
        let started = false
        try {
          if (!await this.accessoryRepository.stockInReady(connection)) {
            throw this.createError('采购入库防重或资料快照结构未就绪，请先完成迁移', 409, 'STOCK_IN_NOT_READY')
          }
          // 在事务外核对已提交采购；并发尚未提交由唯一索引兜底，冲突后回滚再读。
          const replay = checkReplay(await this.accessoryRepository.getStockInByKey(data.request_key, connection))
          if (replay) return replay
          if (transaction?.replayOnly) throw this.createError('多颜色入库凭据不完整，请核对原采购记录', 409, 'STOCK_IN_REQUEST_CONFLICT')
          if (!transaction) {
            await prepareInvoiceNumberTransaction(connection)
            await connection.beginTransaction()
            started = true
          }
          for (const targetId of new Set([storeId, ...distribution.map(item => item.store_id)])) {
            const store = await this.accessoryRepository.getReference(targetId, 'store_id', connection)
            if (!store || Number(store.status) !== 1) throw this.createError('分配门店不存在或已停用', 400, 'INVALID_REFERENCE')
          }
          await this.validateProduct({ supplier_id: supplierId }, {}, connection)
          const { finalId, minStock } = await this.resolveStockInProduct(data, { accessoryId, supplierId, costCents }, connection)
          if (serialMode) {
            if (serials.some(serial => serial.store_id !== storeId) || distribution.some(item => item.store_id !== storeId)) {
              throw this.createError('本次 SN 必须全部归属所选入库店铺；其他店铺请另建入库单', 400, 'SERIAL_STORE_MISMATCH')
            }
            const counts = new Map()
            for (const serial of serials) counts.set(serial.store_id, (counts.get(serial.store_id) || 0) + 1)
            if (counts.size !== distribution.length || distribution.some(item => counts.get(item.store_id) !== item.quantity)) {
              throw this.createError('各门店 SN 数量必须与分配数量一致', 400, 'SERIAL_DISTRIBUTION_MISMATCH')
            }
          }
          const totalAmount = costCents * quantity / 100
          const time = inventoryTime || transaction?.time || getBeijingTimeString()
          const batchNo = await this.generateBatchNo(connection)
          const context = { accessory_id: finalId, operator_id: operatorId, operator_name: actor.name || actor.username || '', time }
          const productSnapshot = createPurchaseSnapshot(
            await this.accessoryRepository.purchaseSnapshotSource(finalId, supplierId, storeId, connection),
            { accessory_id: finalId, supplier_id: supplierId, store_id: storeId })
          for (const item of distribution) {
            const stock = await this.accessoryRepository.lockStoreStock(finalId, item.store_id, connection)
            await this.inventoryService.ensureBalance({ ...context, store_id: item.store_id }, stock?.quantity || 0, connection)
          }
          const stockInId = await this.accessoryRepository.createStockInRecord({
            request_key: data.request_key, request_hash: hash, product_snapshot: productSnapshot,
            batch_no: batchNo, accessory_id: finalId, supplier_id: supplierId, store_id: storeId,
            quantity, purchase_cost: costCents / 100, total_amount: totalAmount,
            barcode_scanned: data.barcode, distribution: JSON.stringify(distribution), remarks: data.remarks?.trim(),
            operator_id: operatorId, operator_name: actor.name || actor.username,
            inventory_time: time, status: 'completed'
          }, connection)
          for (const item of distribution) {
            await this.accessoryRepository.updateAccessoryStock(finalId, item.store_id, item.quantity, 'add', minStock, connection)
            await this.inventoryService.receive({ ...context, store_id: item.store_id, stock_in_id: stockInId,
              purchase_cost: costCents / 100, usage_type: usageType, serial_tracking: serialMode ? 1 : 0 }, item.quantity, connection)
          }
          for (const serial of serials) {
            const id = await this.accessoryRepository.createSerial({ ...serial, accessory_id: finalId, stock_in_id: stockInId, purchase_cost: costCents / 100, time }, connection)
            await this.accessoryRepository.createSerialEvent({ serial_id: id, event_type: 'stock_in', stock_in_id: stockInId,
              store_id: serial.store_id, operator_id: operatorId, operator_name: actor.name || actor.username, time }, connection)
          }
          if (!transaction) { await connection.commit(); started = false }
          return receipt({ id: stockInId, batch_no: batchNo, accessory_id: finalId, quantity,
            total_amount: totalAmount, inventory_time: time }, false)
        } catch (error) {
          if (started) await connection.rollback()
          // 不能只把唯一冲突当成重复SN；不同模板/同请求的竞争也必须重放原采购。
          if (!transaction && (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK')) {
            const replay = checkReplay(await this.accessoryRepository.getStockInByKey(data.request_key, connection))
            if (replay) return replay
          }
          throw error
        }
      }
      const result = transaction ? await execute(transaction.connection) : await this.accessoryRepository.withConnection(execute)
      return this.success(result.replayed ? '该采购已入库，已核对原入库回执' : '入库成功', result)
    } catch (error) {
      // 多颜色编排持有同一事务，必须把异常交还外层整体回滚。
      if (transaction) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      if (error.code === 'ER_DUP_ENTRY') return this.error('SN 或条形码已存在，整单未入库，请核对后重试', 'DUPLICATE_SERIAL')
      log.error('配件入库失败:', error)
      return { ...this.error('配件入库失败', 'DATABASE_ERROR'), statusCode: 500 }
    }
  }

  /** 每色独立采购批次，共用一个事务及绑定整组内容的防重凭据。 */
  async stockInColors(data, actor) {
    try {
      if (typeof data.request_key !== 'string' || !/^[a-f0-9]{32}$/.test(data.request_key) ||
        !Array.isArray(data.entries) || !data.entries.length || data.entries.length > 100) {
        throw this.createError('请填写1至100个颜色的入库数量', 400, 'VALIDATION_ERROR')
      }
      const allowed = new Set(['accessory_id', 'barcode', 'name', 'category', 'category_id', 'product_model', 'brand_id', 'model_id', 'model_ids',
        'color_id', 'supplier_id', 'purchase_cost', 'sale_price', 'unit', 'unit_id', 'status', 'min_stock', 'total_quantity', 'distribution',
        'store_id', 'remarks', 'description', 'image_url', 'usage_type', 'serial_tracking', 'serial_numbers', 'inventory_time'])
      const ids = new Set(), serials = new Set()
      const entries = data.entries.map(entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !allowed.has(key)) || !validId(entry.accessory_id)) {
          throw this.createError('颜色入库资料格式无效', 400, 'VALIDATION_ERROR')
        }
        const id = Number(entry.accessory_id)
        if (ids.has(id)) throw this.createError('同一颜色不能重复入库，请合并数量', 400, 'VALIDATION_ERROR')
        ids.add(id)
        const input = { ...entry, request_key: data.request_key }
        const parsed = this.parseStockInInput(input, actor)
        for (const serial of parsed.serials) {
          if (serials.has(serial.serial_number)) throw this.createError('不同颜色存在重复SN，请核对', 400, 'DUPLICATE_SERIAL')
          serials.add(serial.serial_number)
        }
        return { id, input, parsed }
      }).sort((a, b) => a.id - b.id)
      const first = entries[0].parsed
      if (serials.size > 1000 || entries.reduce((sum, entry) => sum + entry.parsed.quantity, 0) > 999999 ||
        entries.reduce((sum, entry) => sum + entry.parsed.quantity * entry.parsed.costCents, 0) >= 10000000000 ||
        entries.some(({ parsed, input }) => parsed.storeId !== first.storeId || parsed.supplierId !== first.supplierId ||
          parsed.costCents !== first.costCents || parsed.usageType !== first.usageType || parsed.serialMode !== first.serialMode || parsed.inventoryTime !== first.inventoryTime ||
          Number(input.brand_id || 0) !== Number(entries[0].input.brand_id || 0) || parsed.distribution.some(row => row.store_id !== first.storeId))) {
        throw this.createError('各颜色须共用进价、供应商、品牌、店铺、用途及入库时间，总数量最多999999件、SN最多1000条', 400, 'VALIDATION_ERROR')
      }
      const groupHash = crypto.createHash('sha256').update(JSON.stringify(entries.map(entry => entry.parsed.hash))).digest('hex')
      entries.forEach((entry, index) => { entry.input.request_key = index === 0 ? data.request_key
        : crypto.createHash('sha256').update(`${data.request_key}:${entry.id}`).digest('hex').slice(0, 32) })
      const result = await this.accessoryRepository.withConnection(async connection => {
        const time = first.inventoryTime || getBeijingTimeString()
        const run = async replayOnly => {
          const batches = []
          for (const entry of entries) {
            const result = await this.stockIn(entry.input, actor, { connection, groupHash, replayOnly, time })
            batches.push(result.data)
          }
          if (batches.some(batch => batch.replayed !== replayOnly)) throw this.createError('多颜色入库凭据不一致，请核对原采购记录', 409, 'STOCK_IN_REQUEST_CONFLICT')
          return { batches, replayed: replayOnly }
        }
        if (!await this.accessoryRepository.stockInReady(connection)) throw this.createError('采购入库结构未就绪，请先完成迁移', 409, 'STOCK_IN_NOT_READY')
        if (await this.accessoryRepository.getStockInByKey(data.request_key, connection)) return run(true)
        await prepareInvoiceNumberTransaction(connection)
        await connection.beginTransaction()
        try {
          await this.accessoryRepository.templateColors.assertReady(connection)
          const families = await this.accessoryRepository.templateColors.families(entries.map(entry => entry.id), connection, { forUpdate: true })
          const familyId = Number(families.find(row => Number(row.accessory_id) === entries[0].id)?.template_id)
          if (!familyId || entries.some(entry => !families.some(row => Number(row.template_id) === familyId && Number(row.accessory_id) === entry.id &&
            (entry.input.color_id === undefined || Number(row.color_id) === Number(entry.input.color_id))))) {
            throw this.createError('颜色规格已变化或不属于同一模板，请重新选择商品', 400, 'INVALID_REFERENCE')
          }
          const result = await run(false)
          await connection.commit()
          return result
        } catch (error) {
          await connection.rollback()
          if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'STOCK_IN_REQUEST_CONFLICT'].includes(error.code) &&
            await this.accessoryRepository.getStockInByKey(data.request_key, connection)) return run(true)
          throw error
        }
      })
      return this.success(result.replayed ? '已核对全部颜色原入库，未重复入库' : '全部颜色入库成功', result)
    } catch (error) {
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      if (error.code === 'ER_DUP_ENTRY') return { ...this.error('SN或条形码已存在，全部颜色均未入库', 'DUPLICATE_SERIAL'), statusCode: 400 }
      log.error('多颜色入库失败:', error)
      return { ...this.error('多颜色入库失败，请重试原入库核对结果', 'DATABASE_ERROR'), statusCode: 500 }
    }
  }

  /**
   * 获取配件库存列表
   */
  async getStockList(params = {}, actor) {
    try {
      const store_scope = this.inventoryReadScope(actor, params), page = this.inventoryReadPage(params)
      if (params.low_stock_only !== undefined && ![true, false, 'true', 'false'].includes(params.low_stock_only)) throw this.createError('库存预警筛选无效', 400, 'VALIDATION_ERROR')
      const result = await this.readInventorySnapshot(connection => this.accessoryRepository.getAllAccessoryStock({
        ...params, ...page, store_scope, low_stock_only: params.low_stock_only === true || params.low_stock_only === 'true'
      }, connection))
      return this.success('获取库存列表成功', result)
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取库存列表失败:', error)
      return this.error('获取库存列表失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 获取入库记录列表
   */
  async getStockInRecords(params, actor) {
    try {
      this.getActorId(actor)
      for (const key of ['accessory_id', 'supplier_id', 'store_id', 'page', 'page_size']) {
        if (params[key] !== undefined && !validId(params[key])) throw this.createError('入库记录查询参数无效', 400, 'VALIDATION_ERROR')
      }
      if (Number(params.page ?? 1) > 1000000 || Number(params.page_size ?? 50) > 100) throw this.createError('入库记录分页无效', 400, 'VALIDATION_ERROR')
      resolveStoreScope(actor, params.store_id)
      const result = await this.accessoryRepository.getStockInRecords({ ...params, store_scope: resolveStoreScope(actor, null) })
      return this.success('获取入库记录成功', { ...result, data: result.data.map(raw => {
        const { name, ...row } = projectPurchaseSnapshot(raw)
        return { ...row, accessory_name: name }
      }) })
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取入库记录失败:', error)
      return this.error('获取入库记录失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats(params = {}, actor) {
    try {
      const scope = this.inventoryReadScope(actor, params)
      const stats = await this.accessoryRepository.getCategoryStats(scope)
      const rows = stats.map(row => {
        if (!isIntegerInput(row.count) || Number(row.count) < 0) throw this.createError('库存汇总数量无效，请核对库存数据', 409, 'INVENTORY_SUMMARY_CONFLICT')
        return { ...row, count: Number(row.count) }
      })
      return this.success('获取分类统计成功', rows)
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取分类统计失败:', error)
      return this.error('获取分类统计失败', 'DATABASE_ERROR')
    }
  }

  /**
   * 获取库存预警
   */
  async getLowStockWarnings(params = {}, actor) {
    try {
      const scope = this.inventoryReadScope(actor, params)
      if (params.threshold !== undefined && (!isIntegerInput(params.threshold) || Number(params.threshold) < 0 || Number(params.threshold) > 9999)) throw this.createError('库存预警值须为0至9999的整数', 400, 'VALIDATION_ERROR')
      const threshold = params.threshold === undefined ? null : Number(params.threshold)
      const accessories = await this.accessoryRepository.getLowStockAccessories(threshold, scope)
      return this.success('获取库存预警成功', {
        threshold,
        count: accessories.length,
        warnings: accessories
      })
    } catch (error) {
      if (isDatabaseAvailabilityError(error)) throw error
      if (error.statusCode) return { ...this.error(error.message, error.code), statusCode: error.statusCode }
      log.error('获取库存预警失败:', error)
      return this.error('获取库存预警失败', 'DATABASE_ERROR')
    }
  }

  async lockSaleProduct(accessoryId, connection) {
    let existing = await this.accessoryRepository.getAccessoryById(accessoryId, connection)
    if (!existing) throw this.createError('配件不存在', 404, 'NOT_FOUND')
    const template = await this.accessoryRepository.lockAccessory(existing.template_id || existing.id, connection)
    if (!template || Number(template.status) !== 1 || Number(existing.status) !== 1) throw this.createError('配件或商品模板已停用', 400, 'INVALID_REFERENCE')
    const rootId = Number(existing.template_id || existing.id)
    existing = await this.accessoryRepository.getAccessoryById(accessoryId, connection, { forUpdate: true })
    if (!existing || Number(existing.template_id || existing.id) !== rootId || Number(existing.status) !== 1) throw this.createError('商品资料已变化，请刷新后重试', 409, 'INVALID_REFERENCE')
    return existing
  }

  /** 调用方必须已开启事务；只执行同连接出库，不提交或吞掉异常。 */
  async issueSale(data, actor, connection, contextOptions = {}) {
    const operatorId = this.getActorId(actor)
    const accessoryId = this.optionalId(data.accessory_id, '配件')
    if (!accessoryId) throw this.createError('请选择配件', 400, 'VALIDATION_ERROR')
    const storeId = assertStoreInScope(resolveStoreScope(actor, null), data.store_id)
    const quantity = Number(data.quantity)
    const type = data.sale_type === 'gift' ? 'gift' : 'sale'
    const price = Number(data.unit_price)
    if (typeof data.quantity === 'boolean' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 999999) throw this.createError('出库数量必须为正整数', 400, 'VALIDATION_ERROR')
    if (data.unit_price === undefined || data.unit_price === null || data.unit_price === '' || typeof data.unit_price === 'boolean' ||
      !Number.isFinite(price) || price < 0 || (type === 'sale' && price === 0) || (type === 'gift' && price !== 0) ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001 || price * quantity >= 100000000) {
      throw this.createError('销售须填写有效正数单价，赠送单价须为0', 400, 'VALIDATION_ERROR')
    }
    const name = typeof data.customer_name === 'string' ? data.customer_name.trim() : ''
    const phone = typeof data.customer_phone === 'string' ? data.customer_phone.trim() : ''
    if (!name || name.length > 100 || !/^1[3-9]\d{9}$/.test(phone)) throw this.createError('请填写客户姓名和有效手机号，以便追踪出库', 400, 'VALIDATION_ERROR')
    const serialNumbers = this.normalizeSerials(data.serial_numbers)
    const customerId = this.optionalId(data.customer_id, '客户')
    if (data.remarks !== undefined && (typeof data.remarks !== 'string' || data.remarks.trim().length > 1000)) throw this.createError('备注必须为文本且最多1000字', 400, 'VALIDATION_ERROR')
    const remarks = data.remarks?.trim() || ''
    const existing = await this.lockSaleProduct(accessoryId, connection)
    const stock = await this.accessoryRepository.lockStoreStock(accessoryId, storeId, connection)
    if (!stock || Number(stock.quantity) < quantity) throw this.createError('当前门店库存不足', 400, 'INSUFFICIENT_STOCK')
    let serials = []
    if (serialNumbers.length) {
      if (serialNumbers.length !== quantity) throw this.createError('每件出库商品必须指定一个 SN', 400, 'SERIAL_QUANTITY_MISMATCH')
      serials = await this.accessoryRepository.lockSerials([...serialNumbers].sort(), connection)
      if (serials.length !== quantity || serials.some(item => Number(item.accessory_id) !== accessoryId || Number(item.store_id) !== storeId || item.status !== 'in_stock')) {
        throw this.createError('SN 不属于所选门店商品，或已销售/赠送，请刷新核对', 400, 'SERIAL_UNAVAILABLE')
      }
    } else if (quantity > Number(stock.quantity) - await this.accessoryRepository.countStockSerials(accessoryId, storeId, connection)) throw this.createError('无SN库存不足，请指定实际出库SN', 400, 'INSUFFICIENT_PLAIN_STOCK')
    const time = contextOptions.time || getBeijingTimeString()
    const context = { accessory_id: accessoryId, store_id: storeId, operator_id: operatorId, operator_name: actor.name || actor.username || '', remarks, time }
    const balances = await this.inventoryService.ensureBalance(context, stock.quantity, connection)
    const { allocations, costCents } = this.inventoryService.allocate({ balances, quantity, serials, operation: type,
      remarks })
    const grossCents = Math.round(price * 100) * quantity
    const totalCents = contextOptions.resolveTotalCents ? await contextOptions.resolveTotalCents(existing) : grossCents
    if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > grossCents) throw this.createError('商品实收金额异常', 409, 'VALIDATION_ERROR')
    const saleNo = await this.generateSaleNo(connection, time)
    const saleId = await this.accessoryRepository.createSalesRecord({ sale_no: saleNo, sale_type: type,
      accessory_id: accessoryId, store_id: storeId, customer_id: customerId, customer_name: name, customer_phone: phone,
      quantity, unit_price: price, total_price: totalCents / 100, purchase_cost: costCents === null ? null : costCents / 100,
      profit: costCents === null ? null : (totalCents - costCents) / 100, remarks,
      operator_id: contextOptions.sellerId || operatorId, operator_name: contextOptions.sellerName || actor.name || actor.username, sale_time: time }, connection)
    for (const serial of serials) {
      if (!await this.accessoryRepository.markSerialOut(serial.id, saleId, type, time, connection)) throw this.createError('SN 状态已变化，请刷新核对', 400, 'SERIAL_UNAVAILABLE')
      await this.accessoryRepository.createSerialEvent({ serial_id: serial.id, event_type: type, sale_id: saleId,
        store_id: storeId, operator_id: operatorId, operator_name: actor.name || actor.username, time }, connection)
    }
    if (!await this.accessoryRepository.deductStock(accessoryId, storeId, quantity, connection)) throw this.createError('当前门店库存不足', 400, 'INSUFFICIENT_STOCK')
    await this.inventoryService.issue({ ...context, sale_id: saleId, sale_type: type }, allocations, connection)
    return { sale_id: saleId, sale_no: saleNo, sale_type: type, serial_numbers: serialNumbers,
      accessory: existing, quantity, unit_price: price, purchase_cost: costCents === null ? null : costCents / 100,
      total_price: totalCents / 100, profit: costCents === null ? null : (totalCents - costCents) / 100 }
  }

  /** 内部售后返库：外层先校验退货动作/原单并开启事务，同时保存退款、积分及售后凭据。 */
  async returnSaleStock(data, actor, connection, contextOptions = {}) {
    const operatorId = this.getActorId(actor), saleId = this.optionalId(data.sale_id, '原销售')
    const quantity = Number(data.quantity), key = data.request_key
    if (!validId(operatorId) || !saleId || typeof data.sale_id === 'boolean' || !validId(data.store_id) || typeof data.quantity === 'boolean' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999 ||
      typeof key !== 'string' || !/^[A-Za-z0-9:_-]{8,100}$/.test(key)) throw this.createError('原销售、退货数量或请求标识无效', 400, 'VALIDATION_ERROR')
    if (!connection || typeof connection.execute !== 'function') throw this.createError('商品返库必须使用售后原事务', 400, 'TRANSACTION_REQUIRED')
    if (!await hasColumn('accessory_inventory_events', 'source_event_id', connection) ||
      !await hasColumn('accessory_inventory_events', 'return_key', connection) ||
      !await hasColumn('accessory_inventory_events', 'return_hash', connection)) throw this.createError('商品退货流水尚未迁移', 409, 'ACCESSORY_RETURN_NOT_READY')
    const scope = resolveStoreScope(actor, null), storeId = assertStoreInScope(scope, data.store_id)
    const numbers = this.normalizeSerials(data.serial_numbers).sort()
    if (data.remarks !== undefined && (typeof data.remarks !== 'string' || data.remarks.trim().length > 1000)) throw this.createError('备注必须为文本且最多1000字', 400, 'VALIDATION_ERROR')
    const remarks = data.remarks?.trim() || ''
    let sale = await this.accessoryRepository.saleForReturn(saleId, connection)
    if (!sale) throw this.createError('原商品销售不存在', 404, 'NOT_FOUND')
    assertStoreInScope(scope, sale.store_id)
    const product = await this.accessoryRepository.getAccessoryById(sale.accessory_id, connection)
    if (!product) throw this.createError('原商品资料不存在，请核对原单', 409, 'ACCESSORY_RETURN_CONFLICT')
    const rootId = Number(product.template_id || product.id)
    if (!await this.accessoryRepository.lockAccessory(rootId, connection)) throw this.createError('原商品模板不存在', 409, 'ACCESSORY_RETURN_CONFLICT')
    const current = await this.accessoryRepository.getAccessoryById(sale.accessory_id, connection, { forUpdate: true })
    if (!current || Number(current.template_id || current.id) !== rootId) throw this.createError('商品模板关联已变化', 409, 'ACCESSORY_RETURN_CONFLICT')
    sale = await this.accessoryRepository.saleForReturn(saleId, connection, true)
    if (!sale || Number(sale.accessory_id) !== Number(current.id)) throw this.createError('原销售资料已变化', 409, 'ACCESSORY_RETURN_CONFLICT')
    assertStoreInScope(scope, sale.store_id)
    const hash = crypto.createHash('sha256').update(JSON.stringify([operatorId, saleId, storeId, quantity, numbers, remarks, contextOptions.time || null])).digest('hex')
    const previous = await this.inventoryService.repository.returnRequest(key, connection)
    const receipt = (rows, replayed, remaining) => ({ sale_id: saleId, accessory_id: Number(current.id), store_id: storeId,
      quantity, serial_numbers: numbers, purchase_cost: rows.some(row => row.purchase_cost === null) ? null
        : rows.reduce((sum, row) => sum + Math.round(Number(row.purchase_cost) * 100) * Number(row.quantity_delta), 0) / 100,
      inventory_event_ids: rows.map(row => Number(row.id)), remaining_quantity: remaining, replayed })
    if (previous.length) {
      if (previous.some(row => row.return_hash !== hash)) throw this.createError('退货请求已按其他内容处理', 409, 'ACCESSORY_RETURN_REQUEST_CONFLICT')
      if (previous.some(row => Number(row.sale_id) !== saleId || Number(row.accessory_id) !== Number(current.id) || Number(row.store_id) !== storeId ||
        Number(row.serial_tracking) !== Number(numbers.length > 0)) || previous.reduce((sum, row) => sum + Number(row.quantity_delta), 0) !== quantity) throw this.createError('原返库请求凭据异常', 409, 'ACCESSORY_RETURN_CONFLICT')
      // 重试返回本次完成时的剩余量；不因后续别笔退货而改变原回执。
      const events = await this.inventoryService.repository.saleEvents(saleId, connection)
      this.inventoryService.validateReturnFacts({ sale, events })
      const lastId = Math.max(...previous.map(row => Number(row.id)))
      const returned = events.filter(row => Number(row.id) <= lastId && ['sale_return', 'gift_return'].includes(row.event_type)).reduce((sum, row) => sum + Number(row.quantity_delta), 0)
      return receipt(previous, true, Number(sale.quantity) - returned)
    }
    const store = await this.accessoryRepository.getReference(storeId, 'store_id', connection)
    if (!store || Number(store.status) !== 1) throw this.createError('退回店铺不存在或已停用', 400, 'INVALID_REFERENCE')
    const stock = await this.accessoryRepository.lockStoreStock(current.id, storeId, connection)
    const time = contextOptions.time || getBeijingTimeString()
    const context = { accessory_id: Number(current.id), store_id: storeId, sale_id: saleId, sale_type: sale.sale_type,
      operator_id: operatorId, operator_name: actor.name || actor.username || '', remarks, time, return_key: key, return_hash: hash }
    await this.inventoryService.ensureBalance(context, stock?.quantity || 0, connection)
    const events = await this.inventoryService.repository.saleEvents(saleId, connection)
    const serials = numbers.length ? await this.accessoryRepository.lockSerials(numbers, connection) : []
    if (serials.length !== numbers.length || serials.some(row => Number(row.accessory_id) !== Number(current.id) || Number(row.sale_id) !== saleId ||
      row.status !== (sale.sale_type === 'gift' ? 'gifted' : 'sold'))) throw this.createError('SN不属于原销售，或已退回/再次出库', 409, 'SERIAL_UNAVAILABLE')
    const plan = this.inventoryService.allocateReturn({ sale, events, quantity, serials })
    for (const serial of serials) {
      if (!await this.accessoryRepository.returnSerial(serial.id, saleId, storeId, time, connection)) throw this.createError('SN状态已变化', 409, 'SERIAL_UNAVAILABLE')
      await this.accessoryRepository.createSerialEvent({ serial_id: serial.id, event_type: 'return', sale_id: saleId,
        store_id: storeId, operator_id: operatorId, operator_name: context.operator_name, time }, connection)
    }
    if (!await this.accessoryRepository.restoreSaleStock(current.id, storeId, quantity, Number(current.min_stock ?? 5), connection)) throw this.createError('商品返库失败', 409, 'ACCESSORY_RETURN_CONFLICT')
    await this.inventoryService.restore(context, plan.allocations, connection)
    return receipt(await this.inventoryService.repository.returnRequest(key, connection), false, plan.remaining_quantity)
  }


}

module.exports = AccessoryService
