'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const ReferenceOrderingRepository = require('../src/repositories/reference-ordering.repository')

const executeOrdering = async ({ domain, rows, items }) => {
  const writes = []
  const connection = {
    async execute(sql, params) {
      if (sql.startsWith('SELECT')) return [rows, []]
      writes.push({ sql, params })
      return [{ affectedRows: 1 }, []]
    }
  }
  await new ReferenceOrderingRepository().reorder(connection, domain, items)
  return writes
}

test('检索后编辑只按目标记录整理目标之后的冲突，目标之前保持不变', async () => {
  const writes = await executeOrdering({
    domain: 'brands',
    rows: [
      { id: 1, name: '前置', sort_order: 10 },
      { id: 2, name: '目标', sort_order: 25 },
      { id: 3, name: '冲突', sort_order: 25 },
      { id: 4, name: '后续', sort_order: 40 }
    ],
    items: [{ id: 2, sort_order: 25 }]
  })

  assert.deepEqual(writes, [
    { sql: 'UPDATE brands SET sort_order = ? WHERE id = ?', params: [26, 3] }
  ])
})

test('目标移动到前面时，完整范围中的冲突链顺延，不受当前检索集合限制', async () => {
  const writes = await executeOrdering({
    domain: 'colors',
    rows: [
      { id: 1, name: '前置', sort_order: 10 },
      { id: 2, name: '目标', sort_order: 90 },
      { id: 3, name: '冲突一', sort_order: 25 },
      { id: 4, name: '冲突二', sort_order: 25 },
      { id: 5, name: '后续', sort_order: 40 }
    ],
    items: [{ id: 2, sort_order: 25 }]
  })

  assert.deepEqual(writes, [
    { sql: 'UPDATE colors SET sort_order = ? WHERE id = ?', params: [25, 2] },
    { sql: 'UPDATE colors SET sort_order = ? WHERE id = ?', params: [27, 3] },
    { sql: 'UPDATE colors SET sort_order = ? WHERE id = ?', params: [26, 4] }
  ])
})

test('型号排序只在同一品牌内处理冲突', async () => {
  const writes = await executeOrdering({
    domain: 'models',
    rows: [
      { id: 1, brand_id: 10, name: 'A', sort_order: 20 },
      { id: 2, brand_id: 10, name: 'B', sort_order: 20 },
      { id: 3, brand_id: 20, name: 'C', sort_order: 20 }
    ],
    items: [{ id: 2, sort_order: 20 }]
  })

  assert.deepEqual(writes, [
    { sql: 'UPDATE models SET sort_order = ? WHERE id = ?', params: [21, 1] }
  ])
  assert.equal(writes.some(write => write.params[1] === 3), false)
})
