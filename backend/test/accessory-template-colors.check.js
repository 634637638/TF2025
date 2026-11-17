'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const ColorRepository = require('../src/repositories/accessory-template-color.repository')
const { normalizeColorVariants } = require('../src/services/accessory-template-color.service')

function fixture({ ready = true, failLink = false } = {}) {
  let state = { records: [], links: [], models: {}, syncs: [] }, backup
  const events = []
  const connection = {
    async beginTransaction() { backup = structuredClone(state); events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { state = backup; events.push('rollback') }
  }
  const colors = {
    async assertReady(conn) {
      assert.equal(conn, connection)
      if (!ready) throw Object.assign(new Error('多颜色模板结构尚未就绪'), { statusCode: 409, code: 'TEMPLATE_COLOR_NOT_READY' })
    },
    async lockColors(ids) { return ids.filter(id => [3, 4, 5, 6].includes(id)).map(id => ({ id, status: id === 5 ? 0 : 1 })) },
    async families(ids) {
      const owners = state.links.filter(row => ids.includes(row.template_id) || ids.includes(row.accessory_id)).map(row => row.template_id)
      return structuredClone(state.links.filter(row => owners.includes(row.template_id)))
    },
    async link(template_id, accessory_id, color_id, conn) {
      assert.equal(conn, connection)
      if (failLink) throw Object.assign(new Error('颜色关联保存失败'), { statusCode: 409, code: 'TEST_WRITE_FAILED' })
      state.links.push({ template_id, accessory_id, color_id })
    }
  }
  const repository = {
    async lockFilmConfiguration() { return false },
    async assertUniqueFreeFilms() {},
    templateColors: colors,
    async withConnection(work) { try { return await work(connection) } finally { events.push('release') } },
    async getReference(id) { return { id, status: 1, name: '公共资料' } },
    async createAccessory(data, conn) {
      assert.equal(conn, connection)
      const id = state.records.length + 1
      state.records.push({ status: 1, ...data, id }); return id
    },
    async getAccessoryById(id) {
      const row = state.records.find(row => row.id === Number(id))
      if (!row) return null
      const root = row.template_id ? state.records.find(item => item.id === row.template_id) : row
      return structuredClone({ ...root, ...row, barcode: root.barcode, color_id: root.color_id })
    },
    async getAccessoryByBarcode(barcode) { return state.records.find(row => row.barcode?.toLowerCase() === barcode.toLowerCase()) || null },
    async replaceCompatibleModels(id, ids, conn) { assert.equal(conn, connection); state.models[id] = [...ids] },
    async getCompatibleModelIds(id) { return state.models[id] || [] },
    async lockAccessory(id, conn) { assert.equal(conn, connection); return state.records.find(row => row.id === Number(id)) },
    async updateAccessory(id, data, conn) { assert.equal(conn, connection); Object.assign(state.records.find(row => row.id === Number(id)), data); return true },
    async getBrandVariant(rootId, brandId) { return state.records.find(row => row.template_id === rootId && row.brand_id === brandId) },
    async syncProductProfileSnapshots(id, rootId, conn) { assert.equal(conn, connection); state.syncs.push(rootId) }
  }
  return { service: new AccessoryService({ repository }), repository, events, state: () => state }
}
const input = () => ({ name: '充电器', sale_price: 50, model_ids: [8], color_variants: [{ color_id: 3, barcode: 'WHITE-1' }, { color_id: 4, barcode: 'BLACK-1' }] })

test('多颜色模板一次保存公共资料与颜色条码，颜色各自保留采购身份且不写库存', async () => {
  const f = fixture(), result = await f.service.createAccessory(input())
  assert.equal(result.success, true)
  assert.equal(f.state().records.length, 3)
  assert.deepEqual(f.state().links, [{ template_id: 1, accessory_id: 2, color_id: 3 }, { template_id: 1, accessory_id: 3, color_id: 4 }])
  assert.deepEqual(f.state().records.map(row => [row.id, row.color_id, row.barcode, row.brand_id]), [[1, null, null, null], [2, 3, 'WHITE-1', null], [3, 4, 'BLACK-1', null]])
  assert.deepEqual(f.state().models, { 1: [8], 2: [8], 3: [8] })
  assert.deepEqual(f.events, ['begin', 'commit', 'release'])
})

test('颜色无效、停用、条码占用或关联写入失败均回滚整组', async () => {
  for (const [options, change, code] of [
    [{}, [{ color_id: 999 }], 'INVALID_REFERENCE'],
    [{}, [{ color_id: 5 }], 'INVALID_REFERENCE'],
    [{ failLink: true }, undefined, 'TEST_WRITE_FAILED'],
    [{ ready: false }, undefined, 'TEMPLATE_COLOR_NOT_READY']
  ]) {
    const f = fixture(options), result = await f.service.createAccessory({ ...input(), ...(change ? { color_variants: change } : {}) })
    assert.equal(result.success, false); assert.equal(result.code, code)
    assert.deepEqual(f.state().records, []); assert.deepEqual(f.state().links, [])
    assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
  }
  const f = fixture()
  await f.service.createAccessory(input())
  const before = structuredClone(f.state())
  const result = await f.service.createAccessory(input())
  assert.equal(result.code, 'DUPLICATE_BARCODE'); assert.deepEqual(f.state(), before)
})

test('颜色及条码严格校验，允许留空条码，拒绝重复颜色/条码及越界输入', () => {
  assert.deepEqual(normalizeColorVariants([{ color_id: '3', barcode: ' x ' }, { color_id: 4 }]), [{ color_id: 3, barcode: 'x' }, { color_id: 4 }])
  for (const value of [null, [], {}, [{ color_id: true }], [{ color_id: 3, accessory_id: 4 }],
    [{ color_id: 3 }, { color_id: 3 }], [{ color_id: 3, barcode: 'ABC' }, { color_id: 4, barcode: ' abc ' }],
    [{ color_id: 3, barcode: 1 }], [{ color_id: 3, barcode: 'x'.repeat(101) }], Array.from({ length: 101 }, (_, i) => ({ color_id: i + 1 }))]) {
    assert.throws(() => normalizeColorVariants(value), { code: 'VALIDATION_ERROR', statusCode: 400 })
  }
})

test('多颜色公共资料双向同步，颜色条码独立；追加颜色继承公共资料和适配型号', async () => {
  const f = fixture(); await f.service.createAccessory(input())
  const result = await f.service.updateAccessory(2, { name: '更正充电器', barcode: 'WHITE-2', remarks: '共同备注' })
  assert.equal(result.success, true)
  assert.equal(f.state().records.every(row => row.name === '更正充电器' && row.remarks === '共同备注'), true)
  assert.equal(f.state().records[1].barcode, 'WHITE-2'); assert.equal(f.state().records[2].barcode, 'BLACK-1')
  const append = await f.service.updateAccessory(1, { color_variants: [{ color_id: 3 }, { color_id: 4 }, { color_id: 3 }] })
  assert.equal(append.code, 'VALIDATION_ERROR')
  const keep = await f.service.updateAccessory(1, { color_variants: [{ color_id: 3 }, { color_id: 4, barcode: 'BLACK-2' }] })
  assert.equal(keep.success, true); assert.equal(f.state().records[1].barcode, 'WHITE-2')
  assert.equal(f.state().records[2].barcode, 'BLACK-2')
  const added = await f.service.updateAccessory(1, { color_variants: [{ color_id: 3 }, { color_id: 4 }, { color_id: 6, barcode: 'BLUE-1' }] })
  assert.equal(added.success, true)
  assert.equal(f.state().records[3].barcode, 'BLUE-1'); assert.equal(f.state().records[3].name, '更正充电器')
  assert.deepEqual(f.state().models[4], [8])
  assert.ok(f.state().syncs.includes(2)); assert.ok(f.state().syncs.includes(3))
})

test('颜色身份不能随编辑移除或替换，停用全组保持交易身份不变', async () => {
  const f = fixture(); await f.service.createAccessory(input())
  const original = structuredClone(f.state())
  for (const [id, data, code] of [[1, { color_variants: [{ color_id: 3 }] }, 'TEMPLATE_COLOR_IN_USE'],
    [2, { color_id: 4 }, 'VALIDATION_ERROR'], [2, { color_id: 4, color_variants: [{ color_id: 3 }, { color_id: 4 }] }, 'VALIDATION_ERROR']]) {
    const result = await f.service.updateAccessory(id, data)
    assert.equal(result.code, code); assert.deepEqual(f.state(), original)
  }
  assert.equal((await f.service.deleteAccessory(1)).success, true)
  assert.ok(f.state().records.every(row => row.status === 0))
  assert.deepEqual(f.state().links, original.links)
})

test('新模板读取附加颜色映射，缺结构保留旧读，品牌子商品定位具体颜色所属组', async () => {
  const records = [{ id: 1 }, { id: 2 }, { id: 7, template_id: 3 }, { id: 10 }]
  const rows = [{ template_id: 1, accessory_id: 2, color_id: 3, color_name: '白色', barcode: 'W' },
    { template_id: 1, accessory_id: 3, color_id: 4, color_name: '黑色', barcode: 'B' }]
  const repo = new ColorRepository({ tableExists: async () => true })
  const connection = { async query() { return [rows] } }
  const result = await repo.attach(records, connection)
  assert.equal(result[0].color_variants.length, 2)
  assert.equal(result[2].color_template_id, 1); assert.equal(result[2].template_id, 3)
  assert.deepEqual(result[3], { id: 10 })
  const legacy = new ColorRepository({ tableExists: async () => false })
  assert.deepEqual(await legacy.attach(records, { query() { throw new Error('缺表不得读取') } }), records)
})

test('模板按颜色条码检索返回统一父入口，分页计数沿用相同条件且隐藏条码不参与搜索', async () => {
  for (const search_fields of [['name', 'barcode'], ['name']]) {
    const repository = new AccessoryRepository({ columnExists: async () => false, templateColors: { ready: async () => true, attach: async rows => rows } })
    const queries = []
    repository.queryRows = async (sql, params) => { queries.push({ sql, params }); return sql.includes('COUNT(DISTINCT') ? [{ total: 1 }] : [{ id: 1 }] }
    const result = await repository.getAccessories({ mode: 'templates', search: 'BLACK_1', search_fields }, {})
    assert.deepEqual(result.data, [{ id: 1 }])
    assert.equal(queries.every(row => row.sql.includes('NOT EXISTS (SELECT 1 FROM accessory_template_colors')), true)
    assert.equal(queries.every(row => row.sql.includes('color_product.barcode LIKE ?')), search_fields.includes('barcode'))
    assert.ok(queries[0].params.includes('%BLACK!_1%'))
  }
})

test('颜色规格响应逐层脱敏，隐藏条码/颜色的嵌套写入由原字段守卫拒绝', async () => {
  const Controller = require('../src/controllers/accessory.controller')
  const router = require('../src/routes/accessories')
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const product = { id: 1, color_template_id: 1, color_variants: [{ accessory_id: 2, color_id: 3, color_name: '白色', barcode: 'SECRET' }] }
  const controller = new Controller({ masking: { filterSensitiveFields: rows => rows } })
  const masked = await controller.mask({ user: { id: 7 }, fieldPermissions: { hiddenFields: ['basic_info.barcode', 'basic_info.color_name'] } }, product)
  assert.equal(masked.color_variants[0].barcode, null)
  assert.equal(masked.color_variants[0].color_id, null); assert.equal(masked.color_variants[0].color_name, null)
  assert.equal(product.color_variants[0].barcode, 'SECRET')
  for (const [hidden, row, allowed] of [
    [['basic_info.barcode'], { color_id: 3, barcode: 'NEW' }, false],
    [['basic_info.barcode'], { color_id: 3 }, true],
    [['basic_info.color_name'], { color_id: 3 }, false]
  ]) {
    const route = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route
    const req = { user: { id: 7 }, fieldPermissions: { hiddenFields: hidden }, body: { color_variants: [row] } }, res = response()
    let next = false
    await route.stack[2].handle(req, res, error => { assert.ifError(error); next = true })
    assert.equal(next, allowed)
    if (!allowed) { assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED') }
  }
})

test('多颜色创建缺迁移保留409业务码，旧单颜色模板仍可创建和编辑', async () => {
  const Controller = require('../src/controllers/accessory.controller')
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  const controller = new Controller({ service: { createAccessory: async () => ({ success: false, statusCode: 409, message: '尚未迁移', code: 'TEMPLATE_COLOR_NOT_READY' }) } })
  await controller.create({ body: input() }, res)
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'TEMPLATE_COLOR_NOT_READY')
  const f = fixture({ ready: false })
  const created = await f.service.createAccessory({ name: '旧模式', color_id: 3 })
  assert.equal(created.success, true)
  assert.equal((await f.service.updateAccessory(created.data.id, { name: '更正旧模式', color_id: 4 })).success, true)
  assert.equal(f.state().records[0].color_id, 4)
  const changed = await f.service.updateAccessory(created.data.id, { color_variants: [{ color_id: 3 }] })
  assert.equal(changed.code, 'TEMPLATE_COLOR_NOT_READY'); assert.equal(changed.statusCode, 409)
})

test('旧模板显式追加颜色后形成统一入口，原商品、品牌子商品及采购身份不变', async () => {
  const f = fixture()
  await f.service.createAccessory({ name: '旧白色充电器', color_id: 3, barcode: 'WHITE-OLD', model_ids: [8], brand_id: 7, supplier_id: 9, purchase_cost: 20 })
  await f.repository.withConnection(connection => f.repository.createAccessory({ template_id: 1, brand_id: 8, supplier_id: 10, purchase_cost: 15 }, connection))
  const result = await f.service.updateAccessory(1, { name: '多色充电器', color_variants: [{ color_id: 3, barcode: 'WHITE-OLD' }, { color_id: 4, barcode: 'BLACK-NEW' }] })
  assert.equal(result.success, true)
  const state = f.state()
  assert.equal(state.records.length, 4)
  assert.deepEqual(state.links, [{ template_id: 3, accessory_id: 1, color_id: 3 }, { template_id: 3, accessory_id: 4, color_id: 4 }])
  assert.equal(state.records[0].id, 1); assert.equal(state.records[0].template_id, undefined)
  assert.equal(state.records[0].brand_id, 7); assert.equal(state.records[0].supplier_id, 9); assert.equal(state.records[0].purchase_cost, 20)
  assert.deepEqual(state.records[1], { status: 1, id: 2, template_id: 1, brand_id: 8, supplier_id: 10, purchase_cost: 15 })
  assert.equal(state.records[2].color_id, null); assert.equal(state.records[2].barcode, null)
  assert.equal(state.records[3].barcode, 'BLACK-NEW')
  assert.deepEqual(state.models[3], [8]); assert.deepEqual(state.models[4], [8])
  assert.ok(state.syncs.includes(1)); assert.ok(state.syncs.includes(3)); assert.ok(state.syncs.includes(4))
  assert.equal((await f.service.updateAccessory(1, { color_variants: [{ color_id: 3, barcode: 'WHITE-OLD' }, { color_id: 4, barcode: 'BLACK-NEW' }] })).success, true)
  assert.equal(f.state().records.length, 4); assert.equal(f.state().links.length, 2)
})

test('旧商品编辑档案可直接追加模板颜色，品牌更正只作用于当前商品', async () => {
  const f = fixture()
  await f.service.createAccessory({ name: '原模板', color_id: 3, barcode: 'OLD-W', model_ids: [8] })
  await f.repository.withConnection(connection => f.repository.createAccessory({ template_id: 1, brand_id: 8 }, connection))
  const result = await f.service.updateAccessory(2, { name: '统一名称', brand_id: 9, color_variants: [{ color_id: 3 }, { color_id: 4, barcode: 'NEW-B' }] })
  assert.equal(result.success, true)
  assert.equal(f.state().records[1].id, 2); assert.equal(f.state().records[1].template_id, 1); assert.equal(f.state().records[1].brand_id, 9)
  assert.equal(f.state().records[0].barcode, 'OLD-W'); assert.equal(f.state().records[0].name, '统一名称')
  const owner = f.state().links[0].template_id
  const appended = await f.service.updateAccessory(2, { color_variants: [{ color_id: 3 }, { color_id: 4 }, { color_id: 6, barcode: 'BLUE' }] })
  assert.equal(appended.success, true)
  assert.equal(f.state().links.filter(row => row.template_id === owner).length, 3)
  assert.equal(f.state().records[1].brand_id, 9)
})

test('旧模板扩色保留原颜色；无颜色时首个颜色明确归属现有商品，失败整组回滚', async () => {
  const f = fixture()
  await f.service.createAccessory({ name: '旧模板', color_id: 3, barcode: 'OLD' })
  const original = structuredClone(f.state())
  for (const [variants, code] of [
    [[{ color_id: 4 }, { color_id: 6 }], 'TEMPLATE_COLOR_IN_USE'],
    [[{ color_id: 3 }, { color_id: 999 }], 'INVALID_REFERENCE'],
    [[{ color_id: 3 }, { color_id: 4, barcode: 'OLD' }], 'DUPLICATE_BARCODE']
  ]) {
    const result = await f.service.updateAccessory(1, { name: '不得部分保存', color_variants: variants })
    assert.equal(result.code, code); assert.deepEqual(f.state(), original)
  }
  const empty = fixture()
  await empty.service.createAccessory({ name: '未填颜色', barcode: 'FIRST' })
  assert.equal((await empty.service.updateAccessory(1, { color_variants: [{ color_id: 4 }, { color_id: 3 }] })).success, true)
  assert.equal(empty.state().records[0].color_id, 4); assert.equal(empty.state().records[0].barcode, 'FIRST')
  const broken = fixture({ failLink: true })
  await broken.service.createAccessory({ name: '旧模板', color_id: 3 })
  const before = structuredClone(broken.state())
  assert.equal((await broken.service.updateAccessory(1, { color_variants: [{ color_id: 3 }, { color_id: 4 }] })).code, 'TEST_WRITE_FAILED')
  assert.deepEqual(broken.state(), before)
})

test('扩色期间关联已变化或行锁冲突时拒绝旧编辑并回滚，要求刷新后重试', async () => {
  for (const concurrent of ['mapping', 'lock']) {
    const f = fixture()
    await f.service.createAccessory({ name: '旧模板', color_id: 3 })
    const before = structuredClone(f.state())
    if (concurrent === 'mapping') f.repository.templateColors.families = async (_ids, _connection, options = {}) => options.forUpdate ? [{ template_id: 9, accessory_id: 1, color_id: 3 }] : []
    else f.repository.lockAccessory = async () => { throw Object.assign(new Error('并发冲突'), { code: 'ER_LOCK_DEADLOCK' }) }
    const result = await f.service.updateAccessory(1, { color_variants: [{ color_id: 3 }, { color_id: 4 }] })
    assert.equal(result.code, 'PROFILE_CORRECTION_STALE'); assert.equal(result.statusCode, 409)
    assert.deepEqual(f.state(), before); assert.equal(f.events.at(-2), 'rollback')
  }
  const f = fixture()
  await f.service.createAccessory({ name: '旧模板', color_id: 3 })
  const before = structuredClone(f.state())
  f.repository.templateColors.families = async (_ids, _connection, options = {}) => options.currentRead ? [{ template_id: 9, accessory_id: 1, color_id: 3 }] : []
  const stale = await f.service.updateAccessory(1, { name: '过期单色表单' })
  assert.equal(stale.code, 'PROFILE_CORRECTION_STALE'); assert.deepEqual(f.state(), before)
})

test('入库只使用具体颜色采购根，不同颜色同品牌独立建库存商品，重复补货复用原身份', async () => {
  const f = fixture(); await f.service.createAccessory(input())
  const resolve = id => f.repository.withConnection(connection => f.service.resolveStockInProduct({ brand_id: 8 }, { accessoryId: id, supplierId: 9, costCents: 1000 }, connection))
  const white = await resolve(2), black = await resolve(3), restock = await resolve(2)
  assert.notEqual(white.finalId, black.finalId); assert.equal(white.finalId, restock.finalId)
  assert.equal(f.state().records.find(row => row.id === white.finalId).template_id, 2)
  assert.equal(f.state().records.find(row => row.id === black.finalId).template_id, 3)
  Object.assign(f.state().records[0], { color_template_id: 1, color_variants: [{ accessory_id: 2, color_id: 3 }] })
  await assert.rejects(resolve(1), { code: 'COLOR_VARIANT_REQUIRED', statusCode: 400 })
  assert.throws(() => f.service.parseStockInInput({ color_variants: [{ color_id: 3 }] }, { id: 7 }), { code: 'COLOR_VARIANT_REQUIRED' })
})

test('具体颜色根可更正实际品牌且不影响其他颜色，遇同色已有品牌拒绝合并并回滚公共修改', async () => {
  const f = fixture(); await f.service.createAccessory(input())
  await f.repository.withConnection(connection => f.repository.createAccessory({ template_id: 2, brand_id: 8 }, connection))
  assert.equal((await f.service.updateAccessory(2, { brand_id: 9 })).success, true)
  assert.equal(f.state().records[1].brand_id, 9); assert.equal(f.state().records[2].brand_id, null)
  const before = structuredClone(f.state())
  for (const [id, brand] of [[4, 9], [2, 8]]) {
    const result = await f.service.updateAccessory(id, { brand_id: brand, name: '不能保存的名称' })
    assert.equal(result.code, 'DUPLICATE_BRAND_VARIANT'); assert.deepEqual(f.state(), before)
  }
})

test('组更正只排他锁定颜色映射，回执用共享当前读，不排他锁定全局颜色引用', async () => {
  const queries = [], repository = new ColorRepository({ tableExists: async () => true })
  const connection = { async query(sql, values) { queries.push({ sql, values }); return [[{ template_id: 1, accessory_id: 2, color_id: 3 }]] } }
  await repository.families([1], connection, { forUpdate: true })
  assert.match(queries[0].sql, /FOR UPDATE/); assert.doesNotMatch(queries[0].sql, /JOIN colors|JOIN accessories/)
  await repository.families([1], connection, { currentRead: true })
  assert.match(queries[1].sql, /LOCK IN SHARE MODE/)
  assert.deepEqual(queries[0].values, [1, 1])
})

test('不同模板并发占用条码的唯一键拒绝按条码冲突返回，整组更新回滚', async () => {
  const f = fixture(); await f.service.createAccessory(input())
  const before = structuredClone(f.state()), update = f.repository.updateAccessory.bind(f.repository)
  f.repository.updateAccessory = async (id, data, connection) => {
    if (data.barcode === 'RACE') throw Object.assign(new Error('duplicate barcode'), { code: 'ER_DUP_ENTRY' })
    return update(id, data, connection)
  }
  const result = await f.service.updateAccessory(1, { brand_id: null, color_variants: [{ color_id: 3, barcode: 'RACE' }, { color_id: 4 }] })
  assert.equal(result.code, 'DUPLICATE_BARCODE'); assert.deepEqual(f.state(), before)
})
