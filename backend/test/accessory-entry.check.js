'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const inventoryFixture = require('./helpers/accessory-inventory')
const AccessoryController = require('../src/controllers/accessory.controller')
const { withConnection } = require('../src/core/db/connection')
const { migrate } = require('../scripts/migrate-accessory-product-model')
const { migrate: migrateCatalog } = require('../scripts/migrate-accessory-product-catalog')

const actor = { id: 7, name: '入库员', store_ids: [2, 3], store_id: 2 }

test('商品资料迁移预览不写库，执行要求备份，回填保留商品原更新时间且可重复运行', async () => {
  const tables = new Set()
  const columns = new Set()
  const product = { category_id: null, unit_id: null, updated_at: '2026-11-01 12:00:00' }
  let writes = 0
  const db = {
    async query(sql) {
      if (sql.includes('information_schema.TABLES') && sql.includes('TABLE_NAME IN')) {
        return [[...tables].map(TABLE_NAME => ({ TABLE_NAME }))]
      }
      if (sql.includes('information_schema.COLUMNS')) return [[...columns].map(COLUMN_NAME => ({ COLUMN_NAME }))]
      if (sql.includes('information_schema.TABLES')) return [[{ present: 1 }]]
      if (sql.includes('SELECT COUNT(*) AS count')) return [[{ count: product.category_id && product.unit_id ? 0 : 1 }]]
      writes++
      const created = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)
      if (created) tables.add(created[1])
      const added = sql.match(/ADD COLUMN (\w+)/)
      if (added) columns.add(added[1])
      if (sql.startsWith('UPDATE accessories')) {
        if (sql.includes('a.category_id = c.id')) product.category_id = 10
        if (sql.includes('a.unit_id = u.id')) product.unit_id = 20
        if (!/a\.updated_at\s*=\s*a\.updated_at/.test(sql)) product.updated_at = 'migration time'
      }
      return [[], []]
    }
  }
  assert.equal((await migrateCatalog(db)).status, 'dry_run')
  assert.equal(writes, 0)
  await assert.rejects(migrateCatalog(db, { apply: true }), /backup-confirmed/)
  assert.equal(writes, 0)
  assert.equal((await migrateCatalog(db, { apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
  assert.deepEqual(product, { category_id: 10, unit_id: 20, updated_at: '2026-11-01 12:00:00' })
  const completedWrites = writes
  assert.equal((await migrateCatalog(db, { apply: true, backupConfirmed: true })).status, 'already_ready')
  assert.equal(writes, completedWrites)
})
const entry = () => ({
  request_key: require('node:crypto').randomBytes(16).toString('hex'),
  name: '充电头', category: '充电头', product_model: 'C65',
  brand_id: 10, model_id: 20, color_id: 30, supplier_id: 40,
  purchase_cost: 10.25, sale_price: 20, total_quantity: 5, store_id: 2,
  distribution: [{ store_id: 3, quantity: 2 }], min_stock: 0,
  operator_id: 999, operator_name: '伪造人员'
})

const sequenceExecutor = () => {
  let sequence = 0
  return async (sql, params = []) => {
    if (sql.includes('SELECT current_sequence')) return [[{ current_sequence: sequence }]]
    if (sql.includes('UPDATE invoice_sequences')) sequence = params[0]
    else assert.match(sql, /(?:CREATE TABLE IF NOT EXISTS|INSERT IGNORE INTO) invoice_sequences/)
    return [{ affectedRows: 1 }]
  }
}

function fixture({ failStock = false, failBegin = false, existing = null } = {}) {
  const events = []
  const connection = {
    execute: sequenceExecutor(),
    async query() { return [{ affectedRows: 0 }] },
    async beginTransaction() { events.push('begin'); if (failBegin) throw new Error('begin failed') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const writes = []
  let created
  const repository = {
    async lockFilmConfiguration() { return false },
    async assertUniqueFreeFilms() {},
    syncProductProfileSnapshots: AccessoryRepository.prototype.syncProductProfileSnapshots,
    withConnection: callback => withConnection({ getConnection: async () => connection }, callback),
    async getReference(id, field, executor) {
      if (executor !== undefined) assert.equal(executor, connection)
      // 商品品牌与手机型号所属品牌刻意不同，适配引用不能修改任一公共主档。
      return { id, name: field, status: 1, brand_id: 99 }
    },
    async getAccessoryById(id, executor) { if (executor !== undefined) assert.equal(executor, connection); return existing || created || null },
    async getAccessoryByBarcode() { return existing },
    async lockAccessory(id, executor) {
      assert.equal(executor, connection)
      return existing?.template_id === Number(id) ? { id: Number(id), status: 1 } : existing
    },
    async getBrandVariant() { return null },
    resolveBrandProfileTarget: AccessoryRepository.prototype.resolveBrandProfileTarget,
    async createAccessory(data, executor) {
      if (executor !== undefined) assert.equal(executor, connection)
      writes.push(['product', data])
      created = { ...data, id: 55 }
      return 55
    },
    async createStockInRecord(data, executor) { assert.equal(executor, connection); writes.push(['entry', data]); return 31 },
    async updateAccessoryStock(id, storeId, quantity, operation, minStock, executor) {
      assert.equal(executor, connection)
      writes.push(['stock', { id, storeId, quantity, operation, minStock }])
      if (failStock && storeId === 3) throw new Error('stock failed')
    },
    async lockStoreStock(id, store, executor) { assert.equal(executor, connection); return null },
    async getAccessoryStock(id, executor) { assert.equal(executor, connection); return { total_stock: 5, stores: [] } }
  }
  require('./helpers/accessory-stock-in')(repository, () => writes.filter(([kind]) => kind === 'entry').map(([, row]) => row))
  return { events, writes, repository, service: new AccessoryService({ repository, inventoryService: inventoryFixture({}) }) }
}

test('配件入库保存配件型号，分配守恒，操作员取认证身份，整单同连接提交', async () => {
  const context = fixture()
  const input = entry()
  const before = structuredClone(input)
  const result = await context.service.stockIn(input, actor)
  assert.equal(result.success, true)
  assert.deepEqual(input, before)
  assert.deepEqual(context.events, ['begin', 'commit', 'release'])
  const product = context.writes.find(([kind]) => kind === 'product')[1]
  assert.equal(product.product_model, 'C65')
  assert.equal(product.brand_id, 10)
  assert.equal(product.model_id, 20)
  const record = context.writes.find(([kind]) => kind === 'entry')[1]
  assert.equal(record.operator_id, 7)
  assert.equal(record.operator_name, actor.name)
  assert.equal(record.total_amount, 51.25)
  assert.deepEqual(JSON.parse(record.distribution), [{ store_id: 2, quantity: 3 }, { store_id: 3, quantity: 2 }])
  assert.match(record.inventory_time, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(context.writes.filter(([kind]) => kind === 'stock').every(([, row]) => row.minStock === 0), true)
})

for (const [label, change, code] of [
  ['超分配', { distribution: [{ store_id: 2, quantity: 6 }] }, 'VALIDATION_ERROR'],
  ['负分配', { distribution: [{ store_id: 2, quantity: -1 }] }, 'VALIDATION_ERROR'],
  ['小数入库', { total_quantity: 1.5 }, 'VALIDATION_ERROR'],
  ['非法成本', { purchase_cost: 'NaN' }, 'VALIDATION_ERROR'],
  ['金额精度', { purchase_cost: 1.234 }, 'VALIDATION_ERROR'],
  ['总额溢出', { purchase_cost: 99999999 }, 'VALIDATION_ERROR'],
  ['跨未授权店', { distribution: [{ store_id: 9, quantity: 1 }] }, 'STORE_SCOPE_DENIED']
]) {
  test(`配件入库拒绝${label}，不写入数据`, async () => {
    const context = fixture()
    const result = await context.service.stockIn({ ...entry(), ...change }, actor)
    assert.equal(result.success, false)
    assert.equal(result.code, code)
    assert.deepEqual(context.writes, [])
    assert.deepEqual(context.events, [])
  })
}

test('重复门店分配合并计数，后续门店写入失败整单回滚且只释放一次', async () => {
  const context = fixture({ failStock: true })
  const result = await context.service.stockIn({ ...entry(), distribution: [{ store_id: 2, quantity: 1 }, { store_id: 2, quantity: 1 }, { store_id: 3, quantity: 2 }] }, actor)
  assert.equal(result.success, false)
  assert.deepEqual(context.events, ['begin', 'rollback', 'release'])
  const record = context.writes.find(([kind]) => kind === 'entry')[1]
  assert.deepEqual(JSON.parse(record.distribution), [{ store_id: 2, quantity: 3 }, { store_id: 3, quantity: 2 }])
})

test('事务开启失败仍释放，不对未开启事务回滚', async () => {
  const context = fixture({ failBegin: true })
  assert.equal((await context.service.stockIn(entry(), actor)).success, false)
  assert.deepEqual(context.events, ['begin', 'release'])
  assert.deepEqual(context.writes, [])
})

test('补货只引用已有配件，不改公共资料或商品档案', async () => {
  const existing = { id: 55, status: 1, sale_price: 20, brand_id: 10 }
  for (const suppliedPrice of [undefined, 99]) {
    const context = fixture({ existing })
    const input = { ...entry(), accessory_id: 55, supplier_id: 41, purchase_cost: 3, sale_price: suppliedPrice }
    const result = await context.service.stockIn(input, actor)
    assert.equal(result.success, true)
    assert.equal(result.data.accessory_id, 55)
    assert.equal(existing.sale_price, 20)
    assert.equal(context.writes.some(([kind]) => kind === 'product'), false)
    const record = context.writes.find(([kind]) => kind === 'entry')[1]
    assert.equal(record.supplier_id, 41)
    assert.equal(record.purchase_cost, 3)
    assert.equal(record.total_amount, 15)
    assert.equal('sale_price' in record, false)
  }
})

test('默认零售价在模板新建/编辑及首次入库共用金额校验，补货不修改售价', async () => {
  const context = fixture()
  for (const sale_price of [-1, 1.234, 'NaN', null, '', true, 100000000]) {
    const result = await context.service.createAccessory({ name: '钢化膜', sale_price })
    assert.equal(result.code, 'VALIDATION_ERROR')
    await assert.rejects(context.service.validateProduct({ sale_price }, { id: 55 }), { code: 'VALIDATION_ERROR' })
    assert.equal((await context.service.stockIn({ ...entry(), sale_price }, actor)).code, 'VALIDATION_ERROR')
  }
  assert.deepEqual(context.writes, [])
  assert.equal((await context.service.validateProduct({ sale_price: '20.50' })).sale_price, 20.5)
})

test('模板分页与检索在数据库执行，全部状态不按启用过滤且搜索值保持参数化', async () => {
  const repository = new AccessoryRepository({ columnExists: async () => false })
  const queries = []
  repository.queryRows = async (sql, params) => {
    queries.push({ sql, params })
    return sql.includes('COUNT(DISTINCT a.id)') ? [{ total: 101 }] : [{ id: 55, status: 0 }]
  }
  const keyword = "膜' OR 1=1 --"
  const result = await repository.getAccessories({ page: 2, page_size: 16, status: null, search: keyword,
    search_fields: ['name', 'brand_name', 'model_name', 'product_model', 'not_a_column'] })
  assert.equal(result.pagination.total, 101)
  assert.equal(result.pagination.page, 2)
  assert.equal(result.pagination.has_next, true)
  assert.deepEqual(queries[1].params.slice(-2), [16, 16])
  assert.equal(queries.every(({ sql }) => !sql.includes(keyword) && !sql.includes('not_a_column')), true)
  assert.equal(queries.every(({ sql }) => !sql.includes('a.status = ?')), true)
  for (const token of keyword.split(/\s+/u)) {
    assert.equal(queries.every(({ params }) => params.includes(`%${token}%`)), true)
  }
  assert.equal(queries.every(({ sql }) => sql.includes('LEFT JOIN brands b') && sql.includes('search_am.accessory_id = COALESCE(a.template_id, a.id)')), true)
})

test('编辑模板可修改/清空条码，拒绝其他模板（含停用）占用的条码，更新以商品ID关联', async () => {
  const context = fixture({ existing: { id: 55, status: 1, barcode: 'OLD' } })
  const updates = []
  let duplicate = null
  context.repository.getAccessoryByBarcode = async (_barcode, _executor, options) => {
    assert.equal(options.includeInactive, true)
    return duplicate
  }
  context.repository.updateAccessory = async (id, data) => { updates.push({ id, data }); return true }
  assert.equal((await context.service.updateAccessory('55', { barcode: ' NEW ' })).success, true)
  assert.deepEqual(updates[0], { id: '55', data: { barcode: 'NEW' } })
  assert.equal((await context.service.updateAccessory('55', { barcode: '' })).success, true)
  assert.equal(updates[1].data.barcode, null)
  duplicate = { id: 66, status: 0 }
  assert.equal((await context.service.updateAccessory('55', { barcode: 'TAKEN' })).code, 'DUPLICATE_BARCODE')
  assert.equal(updates.length, 2)
  duplicate = { id: 55, status: 1 }
  assert.equal((await context.service.updateAccessory('55', { barcode: 'SELF' })).success, true)
  for (const barcode of [true, 123, 'A'.repeat(101)]) {
    assert.equal((await context.service.updateAccessory(55, { barcode })).code, 'VALIDATION_ERROR')
  }
})

test('更正已有业务商品品牌会同步旧采购/销售快照，保持交易数量和金额原样', async () => {
  const queries = [], writes = [], events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    async query(sql, params) { queries.push({ sql, params }); return [{ affectedRows: 1 }] },
    release() { events.push('release') }
  }
  let current = { id: 56, template_id: 55, brand_id: 1, brand_name: '苹果', name: '旧商品', category: '充电器',
    product_model: 'PD-L', color_name: '白色', unit: '个', status: 1 }
  const repository = {
    async lockFilmConfiguration() { return false },
    async assertUniqueFreeFilms() {},
    syncProductProfileSnapshots: AccessoryRepository.prototype.syncProductProfileSnapshots,
    withConnection: callback => withConnection({ getConnection: async () => connection }, callback),
    async getAccessoryById(id) { return Number(id) === 56 ? current : { id: 55, brand_id: 3, status: 1 } },
    async getCompatibleModelIds() { return [] },
    async lockAccessory(id) { return Number(id) === 56 ? current : { id: 55, brand_id: 3, status: 1 } },
    async getBrandVariant() { return null },
    resolveBrandProfileTarget: AccessoryRepository.prototype.resolveBrandProfileTarget,
    async getReference(id, field) { return { id: Number(id), name: '沃品', status: 1, business_scope: 'accessory', ...(field === 'model_id' ? { brand_business_scope: 'phone' } : {}) } },
    async updateAccessory(id, data) { writes.push({ id: Number(id), data }); current = { ...current, ...data, brand_id: 2, brand_name: '沃品' }; return true }
  }
  const service = new AccessoryService({ repository, inventoryService: inventoryFixture({}) })
  const result = await service.updateAccessory(56, { brand_id: 2 }, actor)
  assert.equal(result.success, true)
  assert.deepEqual(writes, [{ id: 56, data: { brand_id: 2 } }])
  assert.deepEqual(events, ['begin', 'commit', 'release'])
  assert.equal(queries.length, 2)
  assert.deepEqual(queries.map(query => query.params), [[55, 55], [55, 55]])
  assert.match(queries[0].sql, /UPDATE accessory_stock_in/)
  assert.match(queries[0].sql, /product\.template_id = \?/)
  assert.match(queries[1].sql, /UPDATE sales_order_items/)
  assert.match(queries[1].sql, /product\.template_id = \?/)
  assert.equal(queries.some(({ sql }) => /SET[^;]*(quantity|purchase_cost|total_amount|unit_price|refund)/i.test(sql)), false)
})

for (const [sourceId, storedModelIds] of [55, 56].flatMap(id => [[20], '20', '20,21'].map(ids => [id, ids]))) {
  test(`从${sourceId === 55 ? '模板' : '库存档案'}修改共有资料（已有型号${JSON.stringify(storedModelIds)}），同模板商品双向联动且其他模板不变`, async () => {
    const products = new Map([
      [55, { id: 55, name: '旧名称', brand_id: null, status: 1, sale_price: 20, unit_id: 1, model_ids: storedModelIds }],
      [56, { id: 56, template_id: 55, name: '旧副本', brand_id: 1, status: 1, purchase_cost: 8 }],
      [57, { id: 57, template_id: 55, name: '旧副本', brand_id: 2, status: 1, purchase_cost: 9 }],
      [58, { id: 58, name: '其他模板', brand_id: null, status: 1, sale_price: 99 }]
    ])
    const events = [], writes = [], snapshots = []
    const shared = ['name', 'barcode', 'category', 'category_id', 'model_id', 'color_id', 'sale_price', 'unit', 'unit_id', 'model_ids', 'product_model', 'remarks', 'status']
    const read = id => {
      const product = products.get(Number(id))
      if (!product) return null
      const root = products.get(product.template_id || product.id)
      return { ...product, ...Object.fromEntries(shared.map(field => [field, root[field]])) }
    }
    const connection = {
      async beginTransaction() { events.push('begin') }, async commit() { events.push('commit') },
      async rollback() { events.push('rollback') }
    }
    const repository = {
    async lockFilmConfiguration() { return false },
    async assertUniqueFreeFilms() {},
      withConnection: callback => callback(connection),
      async getAccessoryById(id) { return read(id) },
      async lockAccessory(id, executor) { assert.equal(executor, connection); return products.get(Number(id)) },
      async getReference(id, field) { return { id, name: field, status: 1, business_scope: 'both', brand_business_scope: 'phone' } },
      async updateAccessory(id, data, executor) {
        assert.equal(executor, connection); writes.push(Number(id)); Object.assign(products.get(Number(id)), data); return true
      },
      async replaceCompatibleModels(id, modelIds, executor) {
        assert.equal(executor, connection); assert.equal(Number(id), 55); products.get(55).model_ids = modelIds
      },
      async syncProductProfileSnapshots(id, rootId, executor) {
        assert.equal(executor, connection); snapshots.push({ id, rootId, committed: events.includes('commit') })
      }
    }
    const service = new AccessoryService({ repository, inventoryService: inventoryFixture({}) })
    const before = structuredClone([...products.values()])
    const result = await service.updateAccessory(sourceId, {
      name: '统一新名称', category_id: 12, color_id: 3, unit_id: 2, model_ids: [30, 40], sale_price: 39, product_model: 'NEW-PD', remarks: '全部共享备注', status: 0
    })
    assert.equal(result.success, true)
    assert.deepEqual(writes, [55])
    assert.deepEqual(events, ['begin', 'commit'])
    assert.deepEqual(snapshots, [{ id: sourceId, rootId: 55, committed: false }])
    for (const id of [55, 56, 57]) assert.deepEqual(await repository.getAccessoryById(id), {
      ...read(id), name: '统一新名称', category: 'category_id', category_id: 12, color_id: 3,
      unit: 'unit_id', unit_id: 2, model_id: 30, model_ids: [30, 40], sale_price: 39, product_model: 'NEW-PD', remarks: '全部共享备注', status: 0
    })
    assert.deepEqual(products.get(56), before[1])
    assert.deepEqual(products.get(57), before[2])
    assert.deepEqual(products.get(58), before[3])
  })
}

test('品牌合并遇到业务活动时拒绝；历史同步失败整单回滚', async () => {
  const context = fixture({ existing: { id: 56, template_id: 55, brand_id: 1, status: 1 } })
  context.repository.lockAccessory = async id => ({ id: Number(id), template_id: Number(id) === 56 ? 55 : null, brand_id: null, status: 1 })
  context.repository.getBrandVariant = async () => ({ id: 57 })
  context.repository.checkUnusedBrandVariant = async () => ({ code: 'ACCESSORY_DELETE_HAS_HISTORY' })
  context.repository.mergeUnusedBrandVariant = async () => {
    throw Object.assign(new Error('该品牌商品关联了销售记录，不能合并'), { statusCode: 409, code: 'ACCESSORY_DELETE_HAS_ACTIVITY' })
  }
  const blocked = await context.service.updateAccessory(56, { brand_id: 2 })
  assert.equal(blocked.code, 'ACCESSORY_DELETE_HAS_ACTIVITY')
  assert.equal(blocked.statusCode, 409)
  assert.deepEqual(context.events, ['begin', 'rollback', 'release'])
  assert.deepEqual(context.writes, [])
  context.events.length = 0
  context.repository.getBrandVariant = async () => null
  context.repository.updateAccessory = async () => true
  context.repository.syncProductProfileSnapshots = async () => { throw new Error('snapshot sync failed') }
  const failed = await context.service.updateAccessory(56, { brand_id: 2 })
  assert.equal(failed.success, false)
  assert.equal(failed.code, 'DATABASE_ERROR')
  assert.deepEqual(context.events, ['begin', 'rollback', 'release'])
})

test('更正到已存在品牌时合并无业务活动商品，保留采购历史并返回目标商品', async () => {
  const context = fixture({ existing: { id: 56, template_id: 55, brand_id: 1, status: 1 } })
  const products = new Map([
    [56, { id: 56, template_id: 55, brand_id: 1, status: 1 }],
    [57, { id: 57, template_id: 55, brand_id: 2, brand_name: '沃品', status: 1 }]
  ])
  const merges = []
  context.repository.getAccessoryById = async id => products.get(Number(id)) || null
  context.repository.lockAccessory = async id => products.get(Number(id)) || { id: 55, brand_id: null, status: 1 }
  context.repository.getBrandVariant = async () => products.get(57)
  context.repository.checkUnusedBrandVariant = async () => ({ code: 'ACCESSORY_DELETE_HAS_HISTORY' })
  context.repository.mergeUnusedBrandVariant = async (sourceId, targetId, rootId, connection) => {
    merges.push([Number(sourceId), Number(targetId), Number(rootId)])
    assert.ok(connection)
    products.delete(Number(sourceId))
    return Number(targetId)
  }
  const result = await context.service.updateAccessory(56, { brand_id: 2 })
  assert.equal(result.success, true)
  assert.equal(result.data.id, 57)
  assert.deepEqual(merges, [[56, 57, 55]])
  assert.equal(products.has(56), false)
  assert.deepEqual(context.events, ['begin', 'commit', 'release'])
})

test('配件自身品牌与适配手机品牌按业务范围区分，旧关联仅保留回显', async () => {
  const repository = new AccessoryRepository({ columnExists: async () => false })
  repository.queryRows = async sql => sql.includes('FROM brands WHERE') ? [
    { id: 1, status: 1, business_scope: 'phone' },
    { id: 2, status: 1, business_scope: 'accessory' },
    { id: 3, status: 1, business_scope: 'both' }
  ] : []
  const options = await repository.getEntryOptions({ storeScope: { allStores: true } })
  assert.deepEqual(options.brands.map(row => row.id), [2, 3])
  assert.deepEqual(options.model_brands.map(row => row.id), [1, 3])
  const legacy = await repository.getEntryOptions({ storeScope: { allStores: true }, current: { brand_id: 1, model_brand_id: 2 } })
  assert.deepEqual(legacy.brands.map(row => row.id), [1, 2, 3])
  assert.deepEqual(legacy.model_brands.map(row => row.id), [1, 2, 3])
})

test('服务端拒绝配件新选手机专属品牌及配件品牌的适配机型，原关联不被强制替换', async () => {
  const service = new AccessoryService({ repository: {
    getReference: async (id, field) => ({ id, name: '品牌', status: 1,
      ...(field === 'brand_id' ? { business_scope: 'phone' } : { brand_business_scope: 'accessory' }) })
  } })
  await assert.rejects(service.validateProduct({ brand_id: 1 }), { code: 'INVALID_REFERENCE' })
  assert.equal((await service.validateProduct({ brand_id: 1 }, { brand_id: 1 })).brand_id, 1)
  await assert.rejects(service.validateProduct({ model_ids: [2] }), { code: 'INVALID_REFERENCE' })
  assert.deepEqual((await service.validateProduct({ model_ids: [2] }, { model_ids: [2] })).model_ids, [2])
})

test('已有适配型号兼容数据库聚合字符串，保留旧停用关联且拒绝新增停用或不存在型号', async () => {
  const service = new AccessoryService({ repository: {
    getReference: async id => id === 99 ? null : { id, status: 0, brand_business_scope: 'phone' }
  } })
  for (const storedModelIds of [[20, 21], '20,21']) {
    const existing = { model_ids: storedModelIds }
    assert.deepEqual((await service.validateProduct({ model_ids: [20, 21, 20] }, existing)).model_ids, [20, 21])
    await assert.rejects(service.validateProduct({ model_ids: [20, 22] }, existing), { code: 'INVALID_REFERENCE' })
    await assert.rejects(service.validateProduct({ model_ids: [99] }, { model_ids: '99' }), { code: 'INVALID_REFERENCE' })
  }
  assert.deepEqual((await service.validateProduct({ model_ids: [20] }, { model_ids: '20' })).model_ids, [20])
  assert.deepEqual((await service.validateProduct({ model_ids: [20] }, { model_id: 20, model_ids: null })).model_ids, [20])
  for (const storedModelIds of [null, undefined, '']) {
    await assert.rejects(service.validateProduct({ model_ids: [20] }, { model_ids: storedModelIds }), { code: 'INVALID_REFERENCE' })
  }
  await assert.rejects(service.validateProduct({ model_ids: '20,21' }), { code: 'VALIDATION_ERROR' })
})

test('单独创建商品档案只写商品主档，不创建采购记录或门店库存', async () => {
  const context = fixture()
  const result = await context.service.createAccessory({
    name: '透明手机壳', category: '手机壳', product_model: 'CASE-ARCHIVE',
    sale_price: 29, unit: '个'
  })
  assert.equal(result.success, true)
  assert.equal(result.data.id, 55)
  assert.deepEqual(context.writes.map(([kind]) => kind), ['product'])
  assert.deepEqual(context.events, ['begin', 'commit', 'release'])
})

test('条码预检后发生并发占用时返回重复条码提示，创建事务回滚', async () => {
  const context = fixture({ existing: { id: 55, status: 1, barcode: 'OLD' } })
  context.repository.getAccessoryByBarcode = async () => null
  const duplicateWrite = async () => { throw Object.assign(new Error('duplicate barcode'), { code: 'ER_DUP_ENTRY' }) }
  context.repository.createAccessory = duplicateWrite
  context.repository.updateAccessory = duplicateWrite
  assert.equal((await context.service.createAccessory({ name: '钢化膜', barcode: 'NEW', sale_price: 20 })).code, 'DUPLICATE_BARCODE')
  assert.deepEqual(context.events, ['begin', 'rollback', 'release'])
  assert.equal((await context.service.updateAccessory(55, { barcode: 'NEW' })).code, 'DUPLICATE_BARCODE')
})

test('非法/停用公共资料拒绝；保留原停用引用可编辑，清空型号合法', async () => {
  const service = new AccessoryService({ repository: {
    getReference: async id => id === 8 ? null : { id, status: 0 }
  } })
  await assert.rejects(service.validateProduct({ model_id: '1 OR 1=1' }), { code: 'VALIDATION_ERROR' })
  await assert.rejects(service.validateProduct({ model_id: 8 }), { code: 'INVALID_REFERENCE' })
  await assert.rejects(service.validateProduct({ model_id: 9 }), { code: 'INVALID_REFERENCE' })
  assert.equal((await service.validateProduct({ model_id: 9 }, { model_id: 9 })).model_id, 9)
  assert.equal((await service.validateProduct({ model_id: null }, { model_id: 9 })).model_id, null)
})

test('供应商范围限制配件新档案，旧配件保留既有关联', async () => {
  const service = new AccessoryService({ repository: {
    getReference: async id => ({ id, name: '手机供应商', status: 1, business_scope: 'phone' })
  } })
  await assert.rejects(service.validateProduct({ supplier_id: 40 }), { code: 'INVALID_REFERENCE' })
  assert.equal((await service.validateProduct({ supplier_id: 40 }, { supplier_id: 40 })).supplier_id, 40)
})

test('入库选项只读公共资料、按品牌完整查型号、限制门店且分类来自配件', async () => {
  const repository = new AccessoryRepository({ columnExists: async () => false })
  const queries = []
  repository.getConnection = () => ({
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('FROM brands')) return [[{ id: 1, name: '品牌', status: 1 }]]
      return [[]]
    }
  })
  const request = { storeScope: { allStores: false, storeIds: [2] }, current: {} }
  await repository.getEntryOptions(request)
  assert.equal(queries.some(({ sql }) => sql.includes('FROM models')), false)
  queries.length = 0
  await repository.getEntryOptions({ ...request, brandId: 4 })
  assert.equal(queries.every(({ sql }) => /^SELECT/.test(sql)), true)
  const modelQuery = queries.find(({ sql }) => sql.includes('FROM models'))
  assert.deepEqual(modelQuery.params, [4])
  assert.doesNotMatch(modelQuery.sql, /LIMIT/)
  assert.match(queries.find(({ sql }) => sql.includes('FROM stores')).sql, /id IN \(\?\)/)
  const supplierQuery = queries.find(({ sql }) => sql.includes('FROM suppliers'))
  assert.match(supplierQuery.sql, /business_scope IN \('accessory', 'both'\)/)
  assert.deepEqual(supplierQuery.params, [null])
  assert.match(queries.find(({ sql }) => sql.includes('FROM accessory_categories')).sql, /WHERE status = 1 OR id = \? /)
  assert.match(queries.find(({ sql }) => sql.includes('FROM accessory_units')).sql, /WHERE status = 1 OR id = \? /)
})

test('选项隐藏整个资料组，适配品牌与商品品牌分别受控', async () => {
  const controller = new AccessoryController({
    service: { getEntryOptions: async () => ({ brands: [{ id: 1 }], model_brands: [{ id: 2 }], models: [], suppliers: [{ id: 4 }], categories: [], stores: [], colors: [] }) },
    masking: { getUserFieldPermissions: async () => ({ hiddenFields: ['basic_info.brand_name', 'basic_info.supplier_name'] }) },
    response: { success(res, data) { res.data = data } }
  })
  const res = {}
  await controller.entryOptions({ user: actor, query: {} }, res)
  assert.deepEqual(res.data.brands, [])
  assert.deepEqual(res.data.suppliers, [])
  assert.deepEqual(res.data.model_brands, [{ id: 2 }])
})

test('配件编辑/停用读取 mysql2 写入结果，更新规格不误报失败', async () => {
  const repository = new AccessoryRepository({ columnExists: async () => false })
  const queries = []
  repository.getConnection = () => ({
    async query(sql, params) { queries.push({ sql, params }); return [{ affectedRows: 1 }] }
  })
  assert.equal(await repository.updateAccessory(55, { product_model: 'C65', model_id: null }), true)
  assert.equal(await repository.deleteAccessory(55), true)
  assert.equal(queries.every(({ sql }) => /UPDATE accessories/.test(sql)), true)
  assert.deepEqual(queries[0].params, ['C65', null, 55])
})

function schemaFixture({ exists = false, values = 0 } = {}) {
  const queries = []
  let ready = exists
  return {
    queries,
    async query(sql) {
      queries.push(sql)
      if (sql.includes('information_schema')) return [[{ COLUMN_NAME: 'id' }, ...(ready ? [{ COLUMN_NAME: 'product_model', COLUMN_TYPE: 'varchar(100)', IS_NULLABLE: 'YES' }] : [])]]
      if (sql.startsWith('SELECT COUNT')) return [[{ count: values }]]
      if (sql.includes('ADD COLUMN')) ready = true
      if (sql.includes('DROP COLUMN')) ready = false
      return [[]]
    }
  }
}

test('配件型号迁移默认只预览，执行需确认备份，重复执行不改数据', async () => {
  const db = schemaFixture()
  assert.equal((await migrate(db)).status, 'dry_run')
  assert.equal(db.queries.some(sql => sql.startsWith('ALTER')), false)
  await assert.rejects(migrate(db, { apply: true }), /备份/)
  assert.equal((await migrate(db, { apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
  assert.equal((await migrate(db, { apply: true })).status, 'already_ready')
  assert.equal(db.queries.filter(sql => sql.startsWith('ALTER')).length, 1)
})

test('回退拒绝删除已有配件型号的数据；空字段方可授权回退', async () => {
  const populated = schemaFixture({ exists: true, values: 1 })
  await assert.rejects(migrate(populated, { rollback: true, apply: true, backupConfirmed: true }), /已有数据/)
  assert.equal(populated.queries.some(sql => sql.startsWith('ALTER')), false)
  const empty = schemaFixture({ exists: true })
  assert.equal((await migrate(empty, { rollback: true, apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
})

function variantSchemaFixture({ populated = false } = {}) {
  let column = false
  let index = false
  const queries = []
  return { queries, async query(sql) {
    queries.push(sql)
    if (sql.includes('information_schema.COLUMNS')) return [[
      { COLUMN_NAME: 'id', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO' },
      ...(column ? [{ COLUMN_NAME: 'template_id', COLUMN_TYPE: 'int', IS_NULLABLE: 'YES' }] : [])
    ]]
    if (sql.includes('information_schema.STATISTICS')) return [index ? [
      { COLUMN_NAME: 'template_id', SEQ_IN_INDEX: 1, NON_UNIQUE: 0 },
      { COLUMN_NAME: 'brand_id', SEQ_IN_INDEX: 2, NON_UNIQUE: 0 }
    ] : []]
    if (sql.includes('SELECT COUNT')) return [[{ count: populated ? 1 : 0 }]]
    if (sql.includes('ADD COLUMN')) column = true
    if (sql.includes('ADD UNIQUE')) index = true
    if (sql.includes('DROP INDEX')) index = false
    if (sql.includes('DROP COLUMN')) column = false
    return [[]]
  } }
}

test('模板品牌迁移只增关联和唯一索引，默认预览、可重入、已有商品拒绝回退', async () => {
  const { migrate: migrateVariants } = require('../scripts/migrate-accessory-brand-variants')
  const db = variantSchemaFixture()
  assert.equal((await migrateVariants(db)).status, 'dry_run')
  assert.equal(db.queries.some(sql => sql.startsWith('ALTER')), false)
  await assert.rejects(migrateVariants(db, { apply: true }), /备份/)
  assert.equal((await migrateVariants(db, { apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
  assert.equal((await migrateVariants(db, { apply: true })).status, 'already_ready')
  assert.equal(db.queries.filter(sql => sql.startsWith('ALTER')).length, 2)
  assert.equal((await migrateVariants(db, { rollback: true, apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
  const used = variantSchemaFixture({ populated: true })
  await migrateVariants(used, { apply: true, backupConfirmed: true })
  await assert.rejects(migrateVariants(used, { rollback: true, apply: true, backupConfirmed: true }), /已有品牌库存商品/)
  assert.equal(used.queries.some(sql => sql.includes('DROP')), false)
})

test('同模板不同品牌独立商品及库存，同品牌换供应商补货复用ID，模板及售价不被覆盖', async () => {
  const template = { id: 55, name: '通用充电宝', brand_id: null, model_id: null, status: 1, sale_price: 50 }
  const products = new Map([[55, template]])
  const stock = new Map()
  const entries = []
  let nextId = 56
  let pendingLock = Promise.resolve()
  const execute = sequenceExecutor()
  const service = new AccessoryService({ inventoryService: inventoryFixture({}), repository: {
    async withConnection(callback) {
      let unlock
      const connection = { execute, async beginTransaction() {}, async commit() { unlock?.() }, async rollback() { unlock?.() } }
      connection.acquire = async () => {
        const previous = pendingLock
        pendingLock = new Promise(resolve => { unlock = resolve })
        await previous
      }
      return callback(connection)
    },
    getReference: async id => ({ id, status: 1, business_scope: 'both' }),
    getAccessoryById: async id => products.get(Number(id)),
    async lockAccessory(id, connection) { await connection.acquire(); return products.get(Number(id)) },
    getBrandVariant: async (id, brandId) => [...products.values()].find(row => row.template_id === id && row.brand_id === brandId),
    async createAccessory(data) { const id = nextId++; products.set(id, { ...data, id }); return id },
    async createStockInRecord(data) { entries.push(data); return entries.length },
    async lockStoreStock(id, storeId) { return { quantity: stock.get(`${id}:${storeId}`) || 0 } },
    async updateAccessoryStock(id, storeId, quantity) { const key = `${id}:${storeId}`; stock.set(key, (stock.get(key) || 0) + quantity) },
    getAccessoryStock: async () => ({ stores: [] })
  } })
  require('./helpers/accessory-stock-in')(service.accessoryRepository, () => entries)
  const purchase = (brandId, supplierId = 40) => service.stockIn({ ...entry(), accessory_id: 55, brand_id: brandId,
    supplier_id: supplierId, sale_price: 999, name: '伪造名称', model_ids: [99] }, actor)
  // 模拟两个员工同时采购同品牌；最终只建一个品牌商品。
  const [first, second] = await Promise.all([purchase(10), purchase(10, 41)])
  const third = await purchase(11)
  assert.equal(first.success && second.success && third.success, true)
  assert.equal(first.data.accessory_id, second.data.accessory_id)
  assert.notEqual(first.data.accessory_id, third.data.accessory_id)
  assert.equal(products.size, 3)
  assert.deepEqual(template, { id: 55, name: '通用充电宝', brand_id: null, model_id: null, status: 1, sale_price: 50 })
  assert.equal(products.get(first.data.accessory_id).sale_price, 50)
  assert.equal(products.get(first.data.accessory_id).name, '通用充电宝')
  assert.equal(products.get(first.data.accessory_id).barcode, null)
  assert.equal(products.get(first.data.accessory_id).template_id, 55)
  assert.deepEqual(entries.map(row => row.supplier_id), [40, 41, 40])
  assert.deepEqual([...stock.values()], [6, 4, 3, 2])
  assert.equal(stock.has('55:2'), false)
})

test('停用模板拒绝采购；库存档案可独立更正品牌，不创建采购或库存', async () => {
  const context = fixture({ existing: { id: 55, status: 0, brand_id: 10 } })
  assert.equal((await context.service.stockIn({ ...entry(), accessory_id: 55 }, actor)).code, 'INVALID_REFERENCE')
  assert.equal(context.writes.length, 0)
  assert.deepEqual(context.events, ['begin', 'rollback', 'release'])
  const variant = fixture({ existing: { id: 56, template_id: 55, status: 1 } })
  const updates = []
  variant.repository.updateAccessory = async (id, data) => { updates.push({ id, data }); return true }
  assert.equal((await variant.service.updateAccessory(56, { brand_id: 11 })).success, true)
  assert.deepEqual(updates, [{ id: 56, data: { brand_id: 11 } }])
  assert.equal(variant.writes.length, 0)
})

test('模板列表排除品牌商品，库存列表仅查真实库存，模板资料关联统一读取', async () => {
  const repository = new AccessoryRepository({ columnExists: async () => false })
  const queries = []
  repository.queryRows = async (sql, params) => { queries.push({ sql, params }); return sql.includes('COUNT(DISTINCT') ? [{ total: 0 }] : [] }
  await repository.getAccessories({ mode: 'templates', search: '通用', search_fields: ['barcode', 'model_name'] })
  assert.equal(queries.every(({ sql }) => sql.includes('a.template_id IS NULL')), true)
  assert.equal(queries.every(({ sql }) => sql.includes('LEFT JOIN accessories t ON t.id = a.template_id')), true)
  queries.length = 0
  await repository.getAccessories({ mode: 'inventory' })
  assert.equal(queries.every(({ sql }) => sql.includes('current_stock.accessory_id = a.id')), true)
  assert.match(queries[1].sql, /IF\(a.template_id IS NULL, a.sale_price, t.sale_price\) AS sale_price/)
  assert.match(queries[1].sql, /cm.accessory_id = COALESCE\(a.template_id, a.id\)/)
  const locks = []
  repository.queryRows = async (sql, params) => { locks.push({ sql, params }); return [{ id: 55 }] }
  await repository.lockAccessory(55, {})
  await repository.getBrandVariant(55, 10, {})
  assert.equal(locks.every(({ sql }) => sql.endsWith('FOR UPDATE')), true)
  assert.deepEqual(locks[1].params, [55, 10])
})
