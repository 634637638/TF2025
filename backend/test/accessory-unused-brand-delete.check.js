'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Repository = require('../src/repositories/accessory.repository')

const makeRepository = ({ templateId = 10, stock = [], historyTable = null } = {}) => {
  const actions = []
  const tables = new Set([
    'accessories', 'accessory_stock', 'accessory_stock_in', 'accessory_sales', 'accessory_compatible_models',
    'accessory_transfers', 'accessory_serials', 'accessory_serial_events', 'accessory_inventory_events',
    'accessory_purchase_payments', 'accessory_stock_corrections', 'accessory_inventory_adjustments', 'sales_order_items'
  ])
  const connection = {
    async beginTransaction() { actions.push('begin') },
    async commit() { actions.push('commit') },
    async rollback() { actions.push('rollback') },
    release() { actions.push('release') },
    async query(sql, params = []) {
      actions.push(sql)
      if (sql.includes('information_schema.TABLES')) return [[...tables].map(TABLE_NAME => ({ TABLE_NAME }))]
      if (sql.includes('SELECT id, template_id FROM accessories')) return [[{ id: 20, template_id: templateId }]]
      if (sql.includes('FROM accessory_stock\n')) return [stock]
      if (/SELECT id FROM (accessory_|sales_order_items)/.test(sql)) {
        const table = sql.match(/FROM ([a-z_]+)/)[1]
        return [table === historyTable ? [{ id: 8 }] : []]
      }
      if (sql.startsWith('DELETE FROM accessories')) return [{ affectedRows: 1 }]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new Repository()
  repository.withConnection = async operation => {
    try { return await operation(connection) } finally { connection.release() }
  }
  repository.lockAccessory = async id => ({ id, template_id: id === 20 ? templateId : null })
  return { repository, actions }
}

test('无库存、无出库和无关联的品牌子商品事务删除', async () => {
  const { repository, actions } = makeRepository()
  assert.equal(await repository.deleteUnusedBrandVariant(20), true)
  assert.deepEqual(actions.filter(action => ['begin', 'commit', 'rollback', 'release'].includes(action)), ['begin', 'commit', 'release'])
  assert.ok(actions.some(sql => sql.includes('DELETE FROM accessory_stock')))
  assert.ok(actions.some(sql => sql.startsWith('DELETE FROM accessories')))
})

test('根模板和仍有库存或累计出库的品牌商品被拒绝并回滚', async () => {
  for (const input of [
    { templateId: null, expected: 'ACCESSORY_TEMPLATE_DELETE_BLOCKED' },
    { stock: [{ quantity: 1, total_out: 0 }], expected: 'ACCESSORY_DELETE_HAS_ACTIVITY' },
    { stock: [{ quantity: 0, total_out: 2 }], expected: 'ACCESSORY_DELETE_HAS_ACTIVITY' }
  ]) {
    const { repository, actions } = makeRepository(input)
    await assert.rejects(repository.deleteUnusedBrandVariant(20), error => error.code === input.expected)
    assert.ok(actions.includes('rollback'))
    assert.ok(!actions.some(sql => sql.startsWith('DELETE FROM accessories')))
  }
})

test('有采购或划拨历史的商品保留档案并回滚', async () => {
  for (const historyTable of ['accessory_stock_in', 'accessory_transfers']) {
    const { repository, actions } = makeRepository({ historyTable })
    await assert.rejects(repository.deleteUnusedBrandVariant(20), { code: 'ACCESSORY_DELETE_HAS_HISTORY' })
    assert.ok(actions.includes('rollback'))
    assert.ok(!actions.some(sql => sql.startsWith('DELETE FROM accessories')))
  }
})

test('补填品牌时可移除真正空的目标子档案，原商品库存和采购继续关联原 ID', async () => {
  const { repository, actions } = makeRepository()
  repository.getBrandVariant = async () => ({ id: 20, brand_id: 8 })
  const result = await repository.withConnection(connection =>
    repository.resolveBrandProfileTarget({ id: 10, brand_id: null }, { id: 10, brand_id: null }, 8, connection))
  assert.equal(result, 10)
  assert.ok(actions.some(sql => sql.startsWith('DELETE FROM accessories')))
  assert.ok(!actions.some(sql => sql.startsWith('UPDATE accessory_stock_in')))
})

test('品牌更正合并仅迁移采购及库存流水，不删除采购历史', async () => {
  const actions = []
  const connection = {
    async query(sql, params = []) {
      actions.push({ sql, params })
      if (sql.includes('SELECT id, template_id FROM accessories WHERE id IN')) {
        return [[{ id: 20, template_id: 10 }, { id: 21, template_id: 10 }]]
      }
      if (sql.includes('SELECT quantity, total_out FROM accessory_stock')) return [[{ quantity: 0, total_out: 0 }]]
      if (sql.includes('information_schema.TABLES')) return [[
        { TABLE_NAME: 'accessories' }, { TABLE_NAME: 'accessory_stock' }, { TABLE_NAME: 'accessory_stock_in' },
        { TABLE_NAME: 'accessory_sales' }, { TABLE_NAME: 'accessory_compatible_models' },
        { TABLE_NAME: 'accessory_transfers' }, { TABLE_NAME: 'accessory_serials' },
        { TABLE_NAME: 'accessory_serial_events' }, { TABLE_NAME: 'accessory_inventory_events' },
        { TABLE_NAME: 'accessory_inventory_adjustments' }, { TABLE_NAME: 'sales_order_items' }
      ]]
      if (/SELECT id FROM/.test(sql)) return [[]]
      if (sql.startsWith('DELETE FROM accessories')) return [{ affectedRows: 1 }]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new Repository()
  const target = await repository.mergeUnusedBrandVariant(20, 21, 10, connection)
  assert.equal(target, 21)
  const purchaseUpdate = actions.find(({ sql }) => sql.startsWith('UPDATE accessory_stock_in'))
  assert.deepEqual(purchaseUpdate.params, [21, 21, 20])
  assert.match(purchaseUpdate.sql, /JSON_SET\(product_snapshot, '\$\.accessory_id', CAST\(\? AS UNSIGNED\)\)/)
  assert.match(purchaseUpdate.sql, /updated_at = updated_at/)
  assert.ok(actions.some(({ sql, params }) => sql.startsWith('UPDATE accessory_inventory_events') && params[0] === 21 && params[1] === 20))
  assert.ok(actions.some(({ sql }) => sql.startsWith('DELETE FROM accessories')))
  assert.equal(actions.some(({ sql }) => sql.startsWith('DELETE FROM accessory_stock_in')), false)
})

test('错误品牌写在根模板时保留根模板并恢复无品牌，采购历史迁到目标行', async () => {
  const actions = []
  const connection = {
    async query(sql, params = []) {
      actions.push({ sql, params })
      if (sql.includes('SELECT id, template_id FROM accessories WHERE id IN')) {
        return [[{ id: 20, template_id: null }, { id: 21, template_id: 20 }]]
      }
      if (sql.includes('SELECT quantity, total_out FROM accessory_stock')) return [[{ quantity: 0, total_out: 0 }]]
      if (sql.includes('information_schema.TABLES')) return [[
        { TABLE_NAME: 'accessories' }, { TABLE_NAME: 'accessory_stock' }, { TABLE_NAME: 'accessory_stock_in' },
        { TABLE_NAME: 'accessory_sales' }, { TABLE_NAME: 'accessory_compatible_models' }
      ]]
      if (/SELECT id FROM/.test(sql)) return [[]]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new Repository()
  const target = await repository.mergeUnusedBrandVariant(20, 21, 20, connection)
  assert.equal(target, 21)
  assert.ok(actions.some(({ sql, params }) => sql.startsWith('UPDATE accessories SET brand_id = NULL') && params[0] === 20))
  assert.equal(actions.some(({ sql }) => sql.startsWith('DELETE FROM accessories')), false)
})
