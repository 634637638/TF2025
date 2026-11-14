const { getDatabase } = require('../config/database')
const { hasColumn, hasTable } = require('./schema-inspector.service')
const log = require('../utils/log')
const SalesCheckoutRepository = require('../repositories/sales-checkout.repository')
const checkoutRepository = new SalesCheckoutRepository()
const CustomerPointsLedgerService = require('./customer-points-ledger.service')
const pointsLedger = new CustomerPointsLedgerService()

const POINTS_CONFIG_KEY = 'customer_points_config'
const {
  CUSTOMER_POINTS_AMOUNT_PER_POINT, DEFAULT_POINTS_CONFIG, normalizePointsConfig,
  validatePointsConfig, sourceRate, quoteCustomerPoints
} = require('../utils/customer-points-rules')
const CUSTOMER_POINTS_COLUMN = 'points_awarded'
const CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN = 'points_accounted_at'
const RETAIL_SALE_TYPES = new Set(['', 'retail', 'sale', 'normal', 'batch', 'batch_item'])

const parseStoredConfig = (rawValue) => {
  if (!rawValue) return DEFAULT_POINTS_CONFIG

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    return normalizePointsConfig(parsed)
  } catch (error) {
    log.warn('客户积分配置解析失败，使用默认配置:', error.message)
    return DEFAULT_POINTS_CONFIG
  }
}

const resolveSettingsColumns = async (executor) => {
  const db = executor || getDatabase()
  const settingsExists = await hasTable('settings', db)
  if (!settingsExists) return null

  const hasKeyName = await hasColumn('settings', 'key_name', db)
  const hasValue = await hasColumn('settings', 'value', db)
  if (hasKeyName && hasValue) {
    return {
      keyColumn: 'key_name',
      valueColumn: 'value',
      typeColumn: await hasColumn('settings', 'type', db) ? 'type' : null,
      descriptionColumn: await hasColumn('settings', 'description', db) ? 'description' : null
    }
  }

  const hasSettingKey = await hasColumn('settings', 'setting_key', db)
  const hasSettingValue = await hasColumn('settings', 'setting_value', db)
  if (hasSettingKey && hasSettingValue) {
    return {
      keyColumn: 'setting_key',
      valueColumn: 'setting_value',
      typeColumn: await hasColumn('settings', 'setting_type', db) ? 'setting_type' : null,
      descriptionColumn: await hasColumn('settings', 'description', db) ? 'description' : null
    }
  }

  return null
}

const getCustomerPointsConfig = async (executor = null) => {
  const db = executor || getDatabase()
  const columns = await resolveSettingsColumns(db)

  if (!columns) {
    return normalizePointsConfig()
  }

  const [rows] = await db.execute(
    `SELECT ${columns.valueColumn} AS config_value
     FROM settings
     WHERE ${columns.keyColumn} = ?
     LIMIT 1`,
    [POINTS_CONFIG_KEY]
  )

  return rows.length > 0
    ? parseStoredConfig(rows[0].config_value)
    : normalizePointsConfig()
}

const saveCustomerPointsConfig = async (config, executor = null) => {
  const db = executor || getDatabase()
  const columns = await resolveSettingsColumns(db)

  if (!columns) {
    throw new Error('settings表缺少可用的键值字段，无法保存客户积分设置')
  }

  const normalizedConfig = normalizePointsConfig(config)
  const storedValue = JSON.stringify(normalizedConfig)

  const [existingRows] = await db.execute(
    `SELECT id FROM settings WHERE ${columns.keyColumn} = ? LIMIT 1`,
    [POINTS_CONFIG_KEY]
  )

  if (existingRows.length > 0) {
    const updates = [`${columns.valueColumn} = ?`]
    const params = [storedValue]

    if (columns.typeColumn) {
      updates.push(`${columns.typeColumn} = ?`)
      params.push('json')
    }

    if (columns.descriptionColumn) {
      updates.push(`${columns.descriptionColumn} = ?`)
      params.push('客户积分自动累计规则')
    }

    params.push(POINTS_CONFIG_KEY)
    await db.execute(
      `UPDATE settings SET ${updates.join(', ')} WHERE ${columns.keyColumn} = ?`,
      params
    )
  } else {
    const insertColumns = [columns.keyColumn, columns.valueColumn]
    const placeholders = ['?', '?']
    const params = [POINTS_CONFIG_KEY, storedValue]

    if (columns.typeColumn) {
      insertColumns.push(columns.typeColumn)
      placeholders.push('?')
      params.push('json')
    }

    if (columns.descriptionColumn) {
      insertColumns.push(columns.descriptionColumn)
      placeholders.push('?')
      params.push('客户积分自动累计规则')
    }

    await db.execute(
      `INSERT INTO settings (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      params
    )
  }

  return normalizedConfig
}

const isRetailSaleType = (saleType) => RETAIL_SALE_TYPES.has(String(saleType || '').trim().toLowerCase())

const isEligiblePhoneCondition = (isNew, config) => {
  const isNewPhone = Number(isNew) === 1
  return isNewPhone ? config.include_new : config.include_used
}

const getPhonePointsRate = (isNew, config) => (
  sourceRate(Number(isNew) === 1 ? 'new' : 'used', config)
)

const calculateCustomerPointsForSale = ({ phones = [], saleType = '', config = DEFAULT_POINTS_CONFIG }) => {
  const normalizedConfig = normalizePointsConfig(config)

  if (!normalizedConfig.enabled || !isRetailSaleType(saleType)) {
    return {
      points: 0,
      eligibleAmount: 0,
      amountPerPoint: normalizedConfig.amount_per_point
    }
  }

  const totals = phones.reduce((result, phone) => {
    if (!isEligiblePhoneCondition(phone.is_new, normalizedConfig)) {
      return result
    }

    const price = Number(phone.sale_price ?? phone.price) || 0
    result.eligibleAmount += price
    result.weightedAmount += price * getPhonePointsRate(phone.is_new, normalizedConfig)
    return result
  }, { eligibleAmount: 0, weightedAmount: 0 })

  return {
    points: Math.floor(totals.weightedAmount / normalizedConfig.amount_per_point),
    eligibleAmount: totals.eligibleAmount,
    amountPerPoint: normalizedConfig.amount_per_point
  }
}

const calculateCustomerPointsForSaleRecord = ({
  salePrice,
  saleType = '',
  isNew,
  config = DEFAULT_POINTS_CONFIG
}) => calculateCustomerPointsForSale({
  phones: [{ sale_price: salePrice, is_new: isNew }],
  saleType,
  config
})

const assertCustomerPointsSchema = async (executor) => {
  if (!executor || typeof executor.execute !== 'function') {
    throw new Error('客户积分同步必须使用调用方现有的数据库事务连接')
  }

  const [pointsColumnExists, accountedAtColumnExists] = await Promise.all([
    hasColumn('sales', CUSTOMER_POINTS_COLUMN, executor),
    hasColumn('sales', CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN, executor)
  ])
  if (!pointsColumnExists || !accountedAtColumnExists) {
    throw new Error('sales 销售积分凭据字段尚未迁移，请先执行客户销售积分迁移')
  }
}

const normalizeCustomerId = (value) => {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

const normalizeAwardedPoints = (value) => {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : 0
}

const applyCustomerPointsDelta = async (executor, customerId, delta) => {
  if (!customerId || delta === 0) return

  const [result] = await executor.execute(
    `UPDATE customers
     SET points = GREATEST(0, COALESCE(points, 0) + ?),
         updated_at = NOW()
     WHERE id = ?`,
    [delta, customerId]
  )

  if (result.affectedRows !== 1) {
    throw new Error(`客户不存在，无法同步积分: ${customerId}`)
  }
}

/** 共同订单已锁定客户及保存逐行凭据后调用；不提交、不回滚，失败交由整单处理。 */
const creditCheckoutPoints = async (executor, customerId, points, { sources = [] } = {}) => {
  if (!executor || typeof executor.execute !== 'function' || !Number.isSafeInteger(customerId) || customerId <= 0 ||
    !Number.isSafeInteger(points) || points < 0 || points > 2147483647) throw Object.assign(new Error('共同订单积分入账参数无效'), { statusCode: 400 })
  if (points && await pointsLedger.ready(executor)) {
    if (!Array.isArray(sources) || sources.some(row => !row || !Number.isSafeInteger(row.item_id) || row.item_id <= 0 ||
      !Number.isSafeInteger(row.points) || row.points < 0) || new Set(sources.map(row => row.item_id)).size !== sources.length ||
      sources.reduce((sum, row) => sum + row.points, 0) !== points) throw Object.assign(new Error('商品积分必须关联真实订单明细'), { statusCode: 400 })
    for (const row of sources) if (row.points) await pointsLedger.applyDelta(executor, {
      customerId, delta: row.points, sourceType: 'checkout_item', sourceId: row.item_id
    })
    return
  }
  if (points && !await checkoutRepository.awardPoints(executor, customerId, points)) throw Object.assign(new Error('客户积分余额异常，结算已取消'), { statusCode: 409 })
}

/**
 * 在调用方现有事务内，将一条销售记录的积分同步到目标业务状态。
 * 同步账户余额、销售凭据及已安装的来源账，不提交、不回滚事务。
 */
const reconcileCustomerPointsForSale = async ({
  executor,
  saleId,
  customerId,
  saleType,
  salePrice,
  isNew,
  config = null,
  awardPoints = true,
  initialize = false
}) => {
  await assertCustomerPointsSchema(executor)

  const normalizedSaleId = Number(saleId)
  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
    throw new Error('销售记录ID无效，无法同步客户积分')
  }

  const [saleRows] = await executor.execute(
    `SELECT id, customer_id, ${CUSTOMER_POINTS_COLUMN}, ${CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN},
            phone_id, store_id, operator_id, sale_time
     FROM sales
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [normalizedSaleId]
  )
  if (saleRows.length !== 1) {
    throw new Error(`销售记录不存在，无法同步客户积分: ${normalizedSaleId}`)
  }

  const currentSale = saleRows[0]
  const previousCustomerId = normalizeCustomerId(currentSale.customer_id)
  const nextCustomerId = normalizeCustomerId(customerId)
  const previousPoints = normalizeAwardedPoints(currentSale[CUSTOMER_POINTS_COLUMN])
  const isLegacyUntracked = !currentSale[CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN] && !initialize

  if (isLegacyUntracked) {
    await executor.execute(
      `UPDATE sales
       SET ${CUSTOMER_POINTS_COLUMN} = 0,
           ${CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN} = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [normalizedSaleId]
    )
    return {
      saleId: normalizedSaleId,
      previousCustomerId,
      customerId: nextCustomerId,
      previousPoints: 0,
      points: 0,
      pointsDelta: 0,
      eligibleAmount: 0,
      amountPerPoint: CUSTOMER_POINTS_AMOUNT_PER_POINT,
      legacyUntracked: true
    }
  }

  const pointsConfig = awardPoints ? normalizePointsConfig(config || await getCustomerPointsConfig(executor)) : null
  const pointsAward = awardPoints
    ? calculateCustomerPointsForSaleRecord({
      salePrice,
      saleType,
      isNew,
      config: pointsConfig
    })
    : {
      points: 0,
      eligibleAmount: 0,
      amountPerPoint: CUSTOMER_POINTS_AMOUNT_PER_POINT
    }
  const nextPoints = nextCustomerId ? pointsAward.points : 0

  const customerDeltas = new Map()
  if (previousCustomerId) {
    customerDeltas.set(previousCustomerId, (customerDeltas.get(previousCustomerId) || 0) - previousPoints)
  }
  if (nextCustomerId) {
    customerDeltas.set(nextCustomerId, (customerDeltas.get(nextCustomerId) || 0) + nextPoints)
  }
  for (const [deltaCustomerId, delta] of [...customerDeltas.entries()].sort(([left], [right]) => left - right)) {
    if (delta && !await pointsLedger.applyDelta(executor, { customerId: deltaCustomerId, delta, sourceType: 'phone_sale', sourceId: normalizedSaleId,
      details: { sale_price: salePrice, sale_type: saleType, is_new: Number(isNew) === 1, config: pointsConfig,
        phone_id: currentSale.phone_id, store_id: currentSale.store_id, operator_id: currentSale.operator_id,
        sale_time: currentSale.sale_time, previous_points: previousPoints } })) {
      await applyCustomerPointsDelta(executor, deltaCustomerId, delta)
    }
  }

  await executor.execute(
    `UPDATE sales
     SET ${CUSTOMER_POINTS_COLUMN} = ?,
         ${CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN} = COALESCE(${CUSTOMER_POINTS_ACCOUNTED_AT_COLUMN}, NOW()),
         updated_at = NOW()
     WHERE id = ?`,
    [nextPoints, normalizedSaleId]
  )

  return {
    saleId: normalizedSaleId,
    previousCustomerId,
    customerId: nextCustomerId,
    previousPoints,
    points: nextPoints,
    pointsDelta: nextPoints - previousPoints,
    eligibleAmount: pointsAward.eligibleAmount,
    amountPerPoint: pointsAward.amountPerPoint,
    legacyUntracked: false
  }
}

const reverseCustomerPointsForSale = async ({ executor, saleId }) => {
  const [saleRows] = await executor.execute(
    `SELECT s.customer_id, s.sale_type, s.sale_price, p.is_new
     FROM sales s
     LEFT JOIN phones p ON p.id = s.phone_id
     WHERE s.id = ?
     LIMIT 1`,
    [saleId]
  )
  if (saleRows.length !== 1) {
    throw new Error(`销售记录不存在，无法冲减客户积分: ${saleId}`)
  }

  return reconcileCustomerPointsForSale({
    executor,
    saleId,
    customerId: null,
    saleType: saleRows[0].sale_type,
    salePrice: saleRows[0].sale_price,
    isNew: saleRows[0].is_new,
    awardPoints: false
  })
}

module.exports = {
  CUSTOMER_POINTS_AMOUNT_PER_POINT,
  DEFAULT_POINTS_CONFIG,
  normalizePointsConfig,
  validatePointsConfig,
  quoteCustomerPoints,
  getCustomerPointsConfig,
  saveCustomerPointsConfig,
  calculateCustomerPointsForSale,
  calculateCustomerPointsForSaleRecord,
  reconcileCustomerPointsForSale,
  creditCheckoutPoints,
  reverseCustomerPointsForSale
}
