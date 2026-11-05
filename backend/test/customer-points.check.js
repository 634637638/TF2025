'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  CUSTOMER_POINTS_AMOUNT_PER_POINT,
  DEFAULT_POINTS_CONFIG,
  calculateCustomerPointsForSale,
  reconcileCustomerPointsForSale,
  reverseCustomerPointsForSale
} = require('../src/services/customer-points.service')
const { clearSchemaInspectorCache } = require('../src/services/schemaInspector.service')

const backendRoot = path.resolve(__dirname, '..')

const createPointsExecutor = ({ sales, customers }) => ({
  async execute(sql, params = []) {
    if (sql.includes('information_schema.COLUMNS')) return [[{ present: 1 }]]

    if (sql.includes('SELECT s.customer_id, s.sale_type')) {
      const sale = sales.get(Number(params[0]))
      return [[sale ? { ...sale } : undefined].filter(Boolean)]
    }

    if (sql.includes('SELECT id, customer_id, points_awarded, points_accounted_at')) {
      const sale = sales.get(Number(params[0]))
      return [[sale ? { ...sale } : undefined].filter(Boolean)]
    }

    if (sql.includes('UPDATE customers')) {
      const [delta, customerId] = params
      if (!customers.has(Number(customerId))) return [{ affectedRows: 0 }]
      customers.set(Number(customerId), Math.max(0, customers.get(Number(customerId)) + Number(delta)))
      return [{ affectedRows: 1 }]
    }

    if (sql.includes('SET points_awarded = 0')) {
      const sale = sales.get(Number(params[0]))
      sale.points_awarded = 0
      sale.points_accounted_at = '2026-11-05 00:00:00'
      return [{ affectedRows: 1 }]
    }

    if (sql.includes('SET points_awarded = ?')) {
      const [points, saleId] = params
      const sale = sales.get(Number(saleId))
      sale.points_awarded = Number(points)
      sale.points_accounted_at ||= '2026-11-05 00:00:00'
      return [{ affectedRows: 1 }]
    }

    throw new Error(`未处理的测试SQL: ${sql}`)
  }
})

test('客户积分固定以消费100元为累计基数', () => {
  assert.equal(CUSTOMER_POINTS_AMOUNT_PER_POINT, 100)
  assert.equal(DEFAULT_POINTS_CONFIG.amount_per_point, 100)

  const result = calculateCustomerPointsForSale({
    phones: [
      { is_new: 1, sale_price: 199.99 },
      { is_new: 0, sale_price: 100 }
    ],
    saleType: 'retail',
    config: {
      ...DEFAULT_POINTS_CONFIG,
      amount_per_point: 1,
      new_points_per_100: 1,
      used_points_per_100: 1
    }
  })

  assert.deepEqual(result, {
    points: 2,
    eligibleAmount: 299.99,
    amountPerPoint: 100
  })
})

test('客户积分只累计已选择的全新或二手类型', () => {
  const phones = [
    { is_new: 1, sale_price: 200 },
    { is_new: 0, sale_price: 300 }
  ]

  const newOnly = calculateCustomerPointsForSale({
    phones,
    saleType: 'retail',
    config: { ...DEFAULT_POINTS_CONFIG, include_new: true, include_used: false }
  })
  const usedOnly = calculateCustomerPointsForSale({
    phones,
    saleType: 'retail',
    config: { ...DEFAULT_POINTS_CONFIG, include_new: false, include_used: true }
  })

  assert.equal(newOnly.points, 2)
  assert.equal(newOnly.eligibleAmount, 200)
  assert.equal(usedOnly.points, 3)
  assert.equal(usedOnly.eligibleAmount, 300)
})

test('全新和二手支持同时参与并分别设置每100元积分', () => {
  const result = calculateCustomerPointsForSale({
    phones: [
      { is_new: 1, sale_price: 100 },
      { is_new: 0, sale_price: 200 }
    ],
    saleType: 'retail',
    config: {
      ...DEFAULT_POINTS_CONFIG,
      include_new: true,
      include_used: true,
      new_points_per_100: 2,
      used_points_per_100: 3
    }
  })

  assert.deepEqual(result, {
    points: 8,
    eligibleAmount: 300,
    amountPerPoint: 100
  })
})

for (const saleType of ['wholesale', 'peer_transfer', 'supplier_proxy']) {
  test(`${saleType}批发或划拨交易不累计客户积分`, () => {
    const result = calculateCustomerPointsForSale({
      phones: [{ is_new: 1, sale_price: 1000 }],
      saleType,
      config: DEFAULT_POINTS_CONFIG
    })

    assert.deepEqual(result, {
      points: 0,
      eligibleAmount: 0,
      amountPerPoint: 100
    })
  })
}

test('单条销售积分凭据支持初始化、重复同步和售价差额', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[1, {
    id: 1,
    customer_id: 10,
    sale_type: 'retail',
    sale_price: 250,
    is_new: 1,
    points_awarded: 0,
    points_accounted_at: null
  }]])
  const customers = new Map([[10, 5]])
  const executor = createPointsExecutor({ sales, customers })

  const created = await reconcileCustomerPointsForSale({
    executor,
    saleId: 1,
    customerId: 10,
    saleType: 'retail',
    salePrice: 250,
    isNew: 1,
    config: DEFAULT_POINTS_CONFIG,
    initialize: true
  })
  assert.equal(created.points, 2)
  assert.equal(customers.get(10), 7)
  assert.equal(sales.get(1).points_awarded, 2)

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 1,
    customerId: 10,
    saleType: 'retail',
    salePrice: 250,
    isNew: 1,
    config: DEFAULT_POINTS_CONFIG
  })
  assert.equal(customers.get(10), 7, '重复保存不能重复累计')

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 1,
    customerId: 10,
    saleType: 'retail',
    salePrice: 450,
    isNew: 1,
    config: DEFAULT_POINTS_CONFIG
  })
  assert.equal(customers.get(10), 9)
  assert.equal(sales.get(1).points_awarded, 4)
})

test('销售客户变化时积分从旧客户转移到新客户', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[2, {
    id: 2,
    customer_id: 20,
    sale_type: 'retail',
    sale_price: 300,
    is_new: 0,
    points_awarded: 3,
    points_accounted_at: '2026-11-05 00:00:00'
  }]])
  const customers = new Map([[20, 8], [21, 1]])
  const executor = createPointsExecutor({ sales, customers })

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 2,
    customerId: 21,
    saleType: 'retail',
    salePrice: 300,
    isNew: 0,
    config: DEFAULT_POINTS_CONFIG
  })

  assert.equal(customers.get(20), 5)
  assert.equal(customers.get(21), 4)
})

test('成色变化和批发转零售按当前全新二手规则调整差额', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[5, {
    id: 5,
    customer_id: 50,
    sale_type: 'retail',
    sale_price: 200,
    is_new: 1,
    points_awarded: 2,
    points_accounted_at: '2026-11-05 00:00:00'
  }]])
  const customers = new Map([[50, 2]])
  const executor = createPointsExecutor({ sales, customers })
  const config = {
    ...DEFAULT_POINTS_CONFIG,
    new_points_per_100: 1,
    used_points_per_100: 3
  }

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 5,
    customerId: 50,
    saleType: 'retail',
    salePrice: 200,
    isNew: 0,
    config
  })
  assert.equal(customers.get(50), 6)
  assert.equal(sales.get(5).points_awarded, 6)

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 5,
    customerId: 50,
    saleType: 'wholesale',
    salePrice: 200,
    isNew: 0,
    config
  })
  assert.equal(customers.get(50), 0)

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 5,
    customerId: 50,
    saleType: 'retail',
    salePrice: 200,
    isNew: 0,
    config
  })
  assert.equal(customers.get(50), 6)
  assert.equal(sales.get(5).points_awarded, 6)
})

test('零售转批发或退库时按本单凭据冲减积分', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[3, {
    id: 3,
    customer_id: 30,
    sale_type: 'retail',
    sale_price: 600,
    is_new: 1,
    points_awarded: 6,
    points_accounted_at: '2026-11-05 00:00:00'
  }]])
  const customers = new Map([[30, 9]])
  const executor = createPointsExecutor({ sales, customers })

  await reconcileCustomerPointsForSale({
    executor,
    saleId: 3,
    customerId: 30,
    saleType: 'wholesale',
    salePrice: 600,
    isNew: 1,
    config: DEFAULT_POINTS_CONFIG
  })
  assert.equal(customers.get(30), 3)
  assert.equal(sales.get(3).points_awarded, 0)

  sales.get(3).points_awarded = 2
  customers.set(30, 5)
  await reverseCustomerPointsForSale({ executor, saleId: 3 })
  assert.equal(customers.get(30), 3)
  assert.equal(sales.get(3).points_awarded, 0)
})

test('历史无逐单凭据销售首次编辑只建立零基线，不按当前规则盲目反算', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[4, {
    id: 4,
    customer_id: 40,
    sale_type: 'retail',
    sale_price: 1000,
    is_new: 1,
    points_awarded: 0,
    points_accounted_at: null
  }]])
  const customers = new Map([[40, 20]])
  const executor = createPointsExecutor({ sales, customers })

  const result = await reconcileCustomerPointsForSale({
    executor,
    saleId: 4,
    customerId: 40,
    saleType: 'retail',
    salePrice: 1200,
    isNew: 1,
    config: DEFAULT_POINTS_CONFIG
  })

  assert.equal(result.legacyUntracked, true)
  assert.equal(customers.get(40), 20)
  assert.equal(sales.get(4).points_awarded, 0)
  assert.ok(sales.get(4).points_accounted_at)
})

test('所有销售写入、转换和退库入口统一调用客户积分服务', () => {
  const reconciledEntries = [
    'src/routes/sales.js',
    'src/routes/inventory.js',
    'src/routes/phones.js',
    'src/routes/rentals.js',
    'src/services/transfer.service.js',
    'src/services/sale.service.js',
    'src/services/data-import.service.js',
    'src/repositories/product.repository.js'
  ]
  for (const relativePath of reconciledEntries) {
    const source = fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')
    assert.match(source, /reconcileCustomerPointsForSale/, `${relativePath} 未接入统一积分服务`)
  }

  const queryRepository = fs.readFileSync(path.join(backendRoot, 'src/repositories/query.repository.js'), 'utf8')
  assert.match(queryRepository, /reverseCustomerPointsForSale/)
})

test('客户销售积分迁移默认预览并保留历史积分边界', () => {
  const migration = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-customer-sale-points.js'), 'utf8')
  const packageJson = require('../package.json')

  assert.match(migration, /process\.argv\.includes\('--apply'\)/)
  assert.match(migration, /process\.argv\.includes\('--rollback'\)/)
  assert.match(migration, /points_awarded/)
  assert.match(migration, /points_accounted_at/)
  assert.match(migration, /历史销售没有逐单积分凭据/)
  assert.match(migration, /拒绝删除积分字段/)
  assert.match(migration, /请重启后端服务，清除运行进程中的数据库结构检查缓存/)
  assert.equal(packageJson.scripts['migrate:customer-sale-points'], 'node scripts/migrate-customer-sale-points.js')
})
