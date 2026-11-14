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
const { creditCheckoutPoints } = require('../src/services/customer-points.service')
const { normalizePointsConfig, validatePointsConfig, quoteCustomerPoints } = require('../src/utils/customer-points-rules')
const { clearSchemaInspectorCache } = require('../src/services/schema-inspector.service')

const backendRoot = path.resolve(__dirname, '..')

test('共同结算商品积分入账复用公共服务及原事务，条件更新限制余额，异常不提交', async () => {
  clearSchemaInspectorCache()
  const calls = [], executor = { async execute(sql, params) {
    if (sql.includes('information_schema.TABLES')) return [[]]
    calls.push({ sql, params }); return [{ affectedRows: 1 }]
  } }
  await creditCheckoutPoints(executor, 9, 3)
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /points <= \?/)
  assert.deepEqual(calls[0].params, [3, 9, 2147483644])
  await creditCheckoutPoints(executor, 9, 0)
  assert.equal(calls.length, 1)
  await assert.rejects(creditCheckoutPoints({ async execute() { return [{ affectedRows: 0 }] } }, 9, 1), { statusCode: 409 })
  for (const points of [-1, 1.5, true, 2147483648]) await assert.rejects(creditCheckoutPoints(executor, 9, points), { statusCode: 400 })
})

const createPointsExecutor = ({ sales, customers }) => ({
  async execute(sql, params = []) {
    if (sql.includes('information_schema.COLUMNS')) return [[{ present: 1 }]]
    if (sql.includes('information_schema.TABLES')) return [[]]

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

test('配件积分来源、抵扣范围和单件上限按明细计算，赠品及抵扣明细不累计', () => {
  const config = validatePointsConfig({
    enabled: true, include_new: true, include_used: true, include_accessories: true,
    new_points_per_100: 1, used_points_per_100: 2, accessory_points_per_100: 3,
    redemption: { enabled: true, points_per_yuan: 10, max_percent: 50, sources: ['accessory'], all_accessory_categories: false, category_ids: [4] }
  })
  const quote = quoteCustomerPoints({ available_points: 100, config, items: [
    { key: 'phone', source: 'new', amount_cents: 10000, category_id: null, is_gift: false, redeem_points: 0 },
    { key: 'charger', source: 'accessory', amount_cents: 5000, category_id: 4, is_gift: false, redeem_points: 100 },
    { key: 'gift', source: 'accessory', amount_cents: 0, category_id: 4, is_gift: true, redeem_points: 0 }
  ] })
  assert.equal(quote.points_used, 100)
  assert.equal(quote.points_awarded, 1)
  assert.equal(quote.deduction_cents, 1000)
  assert.equal(quote.lines[1].payable_cents, 4000)
  assert.equal(quote.lines[1].points_awarded, 0)
  assert.equal(quote.lines[2].points_awarded, 0)
})

test('配件抵扣拒绝未配置商品类型、超过上限及使用本单新积分', () => {
  const base = { enabled: true, include_new: true, include_used: true, include_accessories: true, new_points_per_100: 1, used_points_per_100: 1, accessory_points_per_100: 1,
    redemption: { enabled: true, points_per_yuan: 10, max_percent: 50, sources: ['accessory'], all_accessory_categories: false, category_ids: [4] } }
  assert.throws(() => quoteCustomerPoints({ available_points: 100, config: base, items: [{ key: 'x', source: 'accessory', amount_cents: 1000, category_id: 9, is_gift: false, redeem_points: 10 }] }), /抵扣范围/)
  assert.throws(() => quoteCustomerPoints({ available_points: 100, config: base, items: [{ key: 'x', source: 'accessory', amount_cents: 1000, category_id: 4, is_gift: false, redeem_points: 60 }] }), /最高抵扣比例/)
  assert.throws(() => quoteCustomerPoints({ available_points: 10, config: base, items: [{ key: 'x', source: 'accessory', amount_cents: 1000, category_id: 4, is_gift: false, redeem_points: 11 }] }), /已有积分/)
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

test('无凭据批发转零售时按当前全新二手设置首次发分', async () => {
  clearSchemaInspectorCache()
  const sales = new Map([[6, {
    id: 6,
    customer_id: 60,
    sale_type: 'wholesale',
    sale_price: 350,
    is_new: 0,
    points_awarded: 0,
    points_accounted_at: null
  }]])
  const customers = new Map([[60, 4]])
  const executor = createPointsExecutor({ sales, customers })

  const result = await reconcileCustomerPointsForSale({
    executor,
    saleId: 6,
    customerId: 60,
    saleType: 'retail',
    salePrice: 350,
    isNew: 0,
    config: {
      ...DEFAULT_POINTS_CONFIG,
      include_new: false,
      include_used: true,
      used_points_per_100: 2
    },
    initialize: true
  })

  assert.equal(result.points, 7)
  assert.equal(customers.get(60), 11)
  assert.equal(sales.get(6).points_awarded, 7)
  assert.ok(sales.get(6).points_accounted_at)
})

test('所有销售写入、转换和退库入口统一调用客户积分服务', () => {
  const reconciledEntries = [
    'src/services/sales-phone.service.js',
    'src/controllers/inventory.controller.js',
    'src/services/phone-update.service.js',
    'src/services/rental-create.service.js',
    'src/services/transfer.service.js',
    'src/services/data-import.service.js'
  ]
  for (const relativePath of reconciledEntries) {
    const source = fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')
    assert.match(source, /reconcileCustomerPointsForSale/, `${relativePath} 未接入统一积分服务`)
  }

  const queryRepository = fs.readFileSync(path.join(backendRoot, 'src/services/query-mutation.service.js'), 'utf8')
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

test('抵扣配置严格校验，旧客户端保存不会清空新规则', () => {
  const previous = validatePointsConfig({ ...DEFAULT_POINTS_CONFIG, include_accessories: true,
    redemption: { enabled: true, points_per_yuan: 10, max_percent: 50, sources: ['accessory'], all_accessory_categories: false, category_ids: [4] } })
  assert.deepEqual(validatePointsConfig({ new_points_per_100: 3 }, previous).redemption, previous.redemption)
  for (const input of [{ enabled: 'true' }, { accessory_points_per_100: NaN }, { redemption: { ...previous.redemption, category_ids: [4, '4'] } },
    { redemption: { ...previous.redemption, sources: ['other'] } }, { redemption: { ...previous.redemption, points_per_yuan: null } }]) {
    assert.throws(() => validatePointsConfig(input, previous), { code: 'POINTS_RULE_INVALID', statusCode: 400 })
  }
  assert.equal(validatePointsConfig({ ...DEFAULT_POINTS_CONFIG }).redemption.points_per_yuan, null)
})

test('按每件金额取整、不使用本单新积分，快照独立且兑换精确到分', () => {
  const config = validatePointsConfig({ ...DEFAULT_POINTS_CONFIG, include_accessories: true,
    redemption: { enabled: true, points_per_yuan: 3, max_percent: 100, sources: ['accessory'], all_accessory_categories: true, category_ids: [] } })
  const line = (key, amount, points = 0) => ({ key, source: 'accessory', amount_cents: amount, is_gift: false, redeem_points: points })
  const result = quoteCustomerPoints({ available_points: 3, config, items: [line('a', 9900), line('b', 9900)] })
  assert.equal(result.points_awarded, 0)
  config.redemption.sources.push('new')
  assert.deepEqual(result.config_snapshot.redemption.sources, ['accessory'])
  assert.throws(() => quoteCustomerPoints({ available_points: 0, config, items: [line('earn', 100000), line('spend', 1000, 3)] }), /已有积分/)
  assert.throws(() => quoteCustomerPoints({ available_points: 3, config, items: [line('fraction', 1000, 1)] }), /精确兑换/)
  assert.throws(() => quoteCustomerPoints({ available_points: 2147483647, config, items: [line('overflow', 10000)] }), /余额超出/)
  assert.throws(() => quoteCustomerPoints({ available_points: 0, config, items: [line('same', 1), line('same', 1)] }), /商品明细/)
})


test('历史积分开关继续兼容大小写、空白及数字字符串，新商品和抵扣默认关闭', () => {
  const config = normalizePointsConfig({ enabled: ' TRUE ', include_new: ' OFF ', include_used: '1', used_points_per_100: '2' })
  assert.equal(config.enabled, true)
  assert.equal(config.include_new, false)
  assert.equal(config.include_used, true)
  assert.equal(config.used_points_per_100, 2)
  assert.equal(config.include_accessories, false)
  assert.equal(config.redemption.enabled, false)
})
