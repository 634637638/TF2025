'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const FilmRepository = require('../src/repositories/film-service.repository')
const FilmService = require('../src/services/film-service.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const AccessoryService = require('../src/services/accessory.service')

/** 使用实际SQL和内存行检查匹配，不代替MySQL行锁及云端并发验收。 */
function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close())
  db.function('IF', (condition, yes, no) => condition ? yes : no)
  db.exec(`CREATE TABLE accessories (id INTEGER PRIMARY KEY, template_id, status DEFAULT 1, film_enabled DEFAULT 0,
    free_film DEFAULT 1, category_id DEFAULT 1, model_id);
    CREATE TABLE accessory_categories (id INTEGER PRIMARY KEY, name, status DEFAULT 1);
    INSERT INTO accessory_categories(id, name) VALUES (1, '钢化膜');
    CREATE TABLE accessory_compatible_models (accessory_id, model_id);
    CREATE TABLE accessory_template_colors (template_id, accessory_id);
    CREATE TABLE accessory_stock (accessory_id, store_id, quantity);
    CREATE TABLE accessory_serials (id INTEGER PRIMARY KEY, accessory_id, store_id, status);
    CREATE TABLE customers (id INTEGER PRIMARY KEY);
    CREATE TABLE phones (id INTEGER PRIMARY KEY, model_id);
    CREATE TABLE models (id INTEGER PRIMARY KEY, name);
    CREATE TABLE sales (id INTEGER PRIMARY KEY, phone_id, customer_id);
    INSERT INTO customers VALUES(9); INSERT INTO phones VALUES(11,13);
    INSERT INTO models VALUES(13,'iPhone 13'),(14,'iPhone 14'),(15,'iPhone 13 Pro');
    INSERT INTO sales VALUES(80,11,9);`)
  const queries = []
  const execute = async (sql, params = []) => {
    queries.push({ sql, params })
    const statement = db.prepare(sql.replace(/ FOR UPDATE\s*$/i, ''))
    return [/^SELECT/i.test(sql.trim()) ? statement.all(...params).map(row => ({ ...row })) : statement.run(...params)]
  }
  const connection = { execute, query: execute }
  const repository = new FilmRepository()
  const service = new FilmService({ repository, tableExists: async () => true, columnExists: async () => true, now: () => '2026-11-15 10:00:00' })
  const config = new AccessoryRepository({ columnExists: async () => true, templateColors: { ready: async () => true } })
  const input = { store_id: 2, phones: [], accessories: [], time: '2026-11-15 10:00:00', film_service: { customer_id: 9, phone_id: 11, mode: 'free', quantity: 1 } }
  function template(id, models = []) {
    db.prepare('INSERT INTO accessories(id) VALUES(?)').run(id)
    for (const model of models) db.prepare('INSERT INTO accessory_compatible_models VALUES(?,?)').run(id, model)
  }
  return { db, connection, repository, service, config, input, template, queries }
}

test('一个模板关联13、14、13 Pro时都匹配同一膜，未关联型号不匹配；收费候选与自动匹配口径一致', async t => {
  const f = fixture(t); f.template(1, [13, 14, 15])
  for (const model of [13, 14, 15]) assert.deepEqual(await f.repository.matchingTemplates(f.connection, model), [{ id: 1 }])
  assert.deepEqual(await f.repository.matchingTemplates(f.connection, 16), [])
  for (const model of [13, 14, 15]) assert.equal(await f.repository.compatible(f.connection, { root_id: 1, model_id: null }, model), true)
  assert.equal(await f.repository.compatible(f.connection, { root_id: 1 }, 16), false)
  await f.config.lockFilmConfiguration(f.connection, { free_film: 1 })
  assert.equal(typeof f.config.assertUniqueFreeFilms, 'undefined')
})

test('免费库存严格取服务门店的普通实物，实际用量3记录3件；缺货不改扣其他店或收费模板', async t => {
  const f = fixture(t); f.template(1, [13])
  f.db.exec('INSERT INTO accessories(id,template_id) VALUES(2,1); INSERT INTO accessory_stock VALUES(2,1,99),(2,2,3)')
  const result = await f.service.prepare(f.connection, { ...f.input, film_service: { ...f.input.film_service, quantity: 3 } }, 9)
  assert.deepEqual(result.accessories.map(row => [row.accessory_id, row.quantity, row.sale_type, row.unit_price]), [[2, 3, 'gift', 0]])
  assert.deepEqual(result.phone_snapshot, { model_name: 'iPhone 13', sale_id: 80 })
  await assert.rejects(f.service.prepare(f.connection, { ...f.input, film_service: { ...f.input.film_service, quantity: 4 } }, 9), { code: 'FILM_STOCK_INSUFFICIENT' })
  f.db.exec('DELETE FROM accessory_stock WHERE store_id=2')
  await assert.rejects(f.service.prepare(f.connection, f.input, 9), { code: 'FILM_STOCK_INSUFFICIENT' })
})

test('免费自动匹配只取免费专用，停用旧列不影响办理且运行时不依赖旧列存在', async t => {
  const f = fixture(t); f.template(1, [13])
  f.db.exec('INSERT INTO accessory_stock VALUES(1,2,3)')
  for (const freeFilm of [0, 1]) {
    f.db.exec(`UPDATE accessories SET free_film=${freeFilm}`)
    if (!freeFilm) await assert.rejects(f.service.prepare(f.connection, f.input, 9), { code: 'FILM_TEMPLATE_REQUIRED' })
    else assert.equal((await f.service.prepare(f.connection, f.input, 9)).accessories[0].accessory_id, 1)
  }
  f.db.exec('ALTER TABLE accessories DROP COLUMN film_enabled')
  f.config.columnExists = async (_table, field) => field === 'free_film'
  f.service.columnExists = async (_table, field) => field !== 'film_enabled'
  assert.equal(await f.config.filmReady(f.connection), true)
  assert.match(await f.config.filmSelect(f.connection), /AS free_film$/)
  assert.equal((await f.service.prepare(f.connection, f.input, 9)).accessories[0].quantity, 1)
})

test('真实收费候选包含免费专用和普通膜，按本店、型号及启用状态过滤', async t => {
  const f = fixture(t)
  f.db.exec(`ALTER TABLE accessories ADD COLUMN name;
    ALTER TABLE accessories ADD COLUMN barcode;
    ALTER TABLE accessories ADD COLUMN category;
    ALTER TABLE accessories ADD COLUMN brand_id;
    ALTER TABLE accessories ADD COLUMN product_model;
    ALTER TABLE accessories ADD COLUMN color_id;
    ALTER TABLE accessories ADD COLUMN unit_id;
    ALTER TABLE accessories ADD COLUMN unit;
    ALTER TABLE accessories ADD COLUMN sale_price DEFAULT 20;
    CREATE TABLE brands (id, name);
    CREATE TABLE colors (id, name);
    CREATE TABLE accessory_units (id, name);`)
  for (const id of [1, 2, 3, 4, 5, 6]) f.template(id, [id === 3 ? 14 : 13])
  f.db.exec(`UPDATE accessories SET name='测试膜',free_film=0 WHERE id=2;
    UPDATE accessories SET status=0 WHERE id=4;
    INSERT INTO accessory_stock VALUES(1,2,2),(2,2,3),(3,2,1),(4,2,1),(5,1,1),(6,2,0);`)
  const query = { storeId: 2, search: '', searchFields: ['name'], page: 1, pageSize: 20, filmOnly: true, filmFreeOnly: false, filmModelId: 13 }
  f.config.queryRows = async (sql, params) => (await f.connection.query(sql, params))[0]
  const result = await f.config.getSaleOptions(query)
  assert.deepEqual(result.data.map(row => row.id).sort(), [1, 2])
  assert.equal(result.pagination.total, 2)
  const freeResult = await f.config.getSaleOptions({ ...query, filmFreeOnly: true })
  assert.deepEqual(freeResult.data.map(row => row.id), [1])
  assert.equal(freeResult.pagination.total, 1)
  f.db.exec('UPDATE accessory_categories SET status=0')
  assert.equal((await f.config.getSaleOptions(query)).data.length, 0)
})

test('同型号允许配置多个免费品牌，办理时按人工选择只扣所选品牌库存', async t => {
  const f = fixture(t); f.template(1, [13]); f.template(2, [13])
  f.db.exec('INSERT INTO accessory_stock VALUES(1,2,3),(2,2,4)')
  const selected = { ...f.input, film_service: { ...f.input.film_service, accessory_id: 2 } }
  const result = await f.service.prepare(f.connection, selected, 9)
  assert.equal(result.accessories[0].accessory_id, 2)
  assert.equal(result.accessories[0].quantity, 1)
  f.db.exec('UPDATE accessories SET free_film=0 WHERE id=2')
  await assert.rejects(f.service.prepare(f.connection, selected, 9), { code: 'FILM_PRODUCT_REQUIRED' })
})

test('多颜色同属一个模板不算重复配置，但多种实物并存不能随机扣错库存，SN不当普通数量扣', async t => {
  const f = fixture(t); f.template(1, [13]); f.template(2, [13]); f.template(3, [13])
  f.db.exec('INSERT INTO accessory_template_colors VALUES(1,2),(1,3); INSERT INTO accessory_stock VALUES(2,2,2),(3,2,2)')
  assert.deepEqual(await f.repository.matchingTemplates(f.connection, 13), [{ id: 1 }])
  const auto = () => f.service.prepareAutomaticForSale(f.connection, [{ id: 11, model_id: 13 }], 2)
  assert.deepEqual(await auto(), [])
  await assert.rejects(f.service.prepare(f.connection, f.input, 9), { code: 'FILM_STOCK_AMBIGUOUS' })
  f.db.exec("INSERT INTO accessory_serials(accessory_id,store_id,status) VALUES(3,2,'in_stock'),(3,2,'in_stock')")
  assert.equal((await f.service.prepare(f.connection, f.input, 9)).accessories[0].accessory_id, 2)
  assert.deepEqual((await auto()).map(row => row.accessory_id), [2])
  f.db.exec('UPDATE accessories SET free_film=0 WHERE id=1')
  assert.deepEqual(await auto(), [])
  f.db.exec('UPDATE accessories SET free_film=1 WHERE id=1')
  f.db.exec('UPDATE accessories SET status=0 WHERE id=2')
  assert.deepEqual(await auto(), [])
  f.db.exec('UPDATE accessories SET status=1 WHERE id=2')
  f.db.exec("INSERT INTO accessory_serials(accessory_id,store_id,status) VALUES(2,2,'in_stock'),(2,2,'in_stock')")
  await assert.rejects(f.service.prepare(f.connection, f.input, 9), { code: 'FILM_STOCK_INSUFFICIENT' })
})

test('收费或授权赠送均核验型号、模板及类型状态，收费允许免费专用膜', async t => {
  const f = fixture(t); f.template(1, [14])
  const paid = { ...f.input, film_service: { ...f.input.film_service, mode: 'paid' }, accessories: [{ accessory_id: 1 }] }
  await assert.rejects(f.service.prepare(f.connection, paid, 9), { code: 'FILM_PRODUCT_REQUIRED' })
  f.db.exec('UPDATE accessory_compatible_models SET model_id=13')
  assert.equal((await f.service.prepare(f.connection, paid, 9)).accessories[0].accessory_id, 1)
  for (const freeFilm of [0, 1]) for (const saleType of ['sale', 'gift']) {
    f.db.exec(`UPDATE accessories SET free_film=${freeFilm}`)
    const result = await f.service.prepare(f.connection, { ...paid, accessories: [{ accessory_id: 1, sale_type: saleType }] }, 9)
    assert.equal(result.accessories[0].sale_type, saleType)
  }
  f.db.exec('UPDATE accessories SET status=0')
  await assert.rejects(f.service.prepare(f.connection, paid, 9), { code: 'FILM_PRODUCT_REQUIRED' })
  f.db.exec('UPDATE accessories SET status=1; UPDATE accessory_categories SET status=0')
  await assert.rejects(f.service.prepare(f.connection, paid, 9), { code: 'FILM_PRODUCT_REQUIRED' })
})

test('免费专用仅接受数字开关且不依赖旧用途字段，采购入库不能改写模板规则', async () => {
  const service = new AccessoryService({ repository: {} })
  for (const value of [true, false, null, '1', 2]) {
    await assert.rejects(service.validateProduct({ free_film: value }), { code: 'VALIDATION_ERROR' })
  }
  for (const value of [0, 1]) {
    assert.equal((await service.validateProduct({ free_film: value })).free_film, value)
    await assert.rejects(service.validateProduct({ film_enabled: value }), { code: 'VALIDATION_ERROR' })
  }
  for (const field of ['film_enabled', 'free_film']) {
    const result = await service.stockIn({ [field]: 1 }, {})
    assert.equal(result.statusCode, 400); assert.equal(result.code, 'VALIDATION_ERROR')
  }
})
