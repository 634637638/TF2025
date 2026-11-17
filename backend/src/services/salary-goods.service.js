'use strict'

const crypto = require('node:crypto')
const SalaryGoodsRepository = require('../repositories/salary-goods.repository')
const { readCheckoutGoods } = require('../utils/checkout-goods-facts')
const { planGoodsReturn } = require('../utils/checkout-goods-return')
const { validId, moneyCents } = require('../utils/sale-input')
const { isIntegerInput } = require('../utils/input-values')
const { normalizeDateTime } = require('../utils/time')
const { hasTable, hasColumn } = require('./schema-inspector.service')

const conflict = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'SALARY_GOODS_CONFLICT' }) }
const invalid = () => { throw Object.assign(new Error('商品提成核对参数无效'), { statusCode: 400, code: 'SALARY_GOODS_INVALID' }) }
const json = value => {
  try {
    const result = typeof value === 'string' ? JSON.parse(value) : value
    if (result && typeof result === 'object' && !Array.isArray(result)) return result
  } catch { /* 不把损坏历史当成零提成。 */ }
  conflict('商品提成原始凭据损坏')
}
const time = value => {
  // 数据库返回北京时间字符串；Date/带时区输入经公共入口归一化后再检查真实日期。
  let normalized
  try { normalized = normalizeDateTime(value, false) } catch { /* 统一业务冲突。 */ }
  if (!normalized || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) conflict('商品提成凭据时间无效')
  const parsed = new Date(normalized.replace(' ', 'T') + '+08:00')
  if (!Number.isFinite(parsed.getTime()) || normalizeDateTime(parsed, false) !== normalized) conflict('商品提成凭据时间无效')
  return normalized
}
const id = value => {
  if (!isIntegerInput(value) || Number(value) <= 0) conflict('商品提成凭据关联编号无效')
  return Number(value)
}
const nullableId = value => value === null ? null : id(value)
const sameMoney = (first, second) => moneyCents(first) !== null && moneyCents(first) === moneyCents(second)
const total = values => {
  const sum = values.reduce((result, value) => result + BigInt(value), 0n)
  if (sum < BigInt(Number.MIN_SAFE_INTEGER) || sum > BigInt(Number.MAX_SAFE_INTEGER)) conflict('商品提成来源汇总超出安全整数范围')
  return Number(sum)
}
const source = (entry, commission, ranges = null) => ({ ...entry,
  source_hash: crypto.createHash('sha256').update(JSON.stringify({ entry, commission, ranges })).digest('hex') })

/** 内部工资来源核对；调用方持有一致性事务，不提供HTTP授权或修改原单的旁路。 */
class SalaryGoodsService {
  constructor({ repository = new SalaryGoodsRepository(), batchSize = 200, tableExists = hasTable, columnExists = hasColumn } = {}) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) invalid()
    Object.assign(this, { repository, batchSize, tableExists, columnExists })
  }

  /** 独立只读快照；原销售、全部分次售后不能从不同时间点拼接。 */
  async preview(employeeId, through) {
    this.input(employeeId, through)
    return this.repository.withConnection(async connection => {
      let started = false
      try {
        await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        await connection.beginTransaction()
        started = true
        return await this.readSources(connection, employeeId, through)
      } finally {
        if (!started) connection.destroy()
        else {
          try { await connection.rollback() }
          catch (error) { connection.destroy(); throw error }
        }
      }
    })
  }

  input(employeeId, through) {
    if (!validId(employeeId) || typeof through !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(through)) invalid()
    try { time(through) } catch { invalid() }
  }

  /** 返回截止点前的全部来源；不能只读本月销售，否则次月退货会漏掉原提成。 */
  async readSources(connection, employeeId, through) {
    this.input(employeeId, through)
    for (const table of ['sales_orders', 'sales_order_items', 'sales_aftersales', 'sales_aftersale_items']) {
      if (!await this.tableExists(table, connection)) this.notReady()
    }
    // 不能以业务日期代替缺失的实际录入时间，更不能在工资查询执行迁移。
    for (const [table, column] of [['sales_orders', 'created_at'], ['sales_aftersales', 'created_at']]) {
      if (!await this.columnExists(table, column, connection)) this.notReady()
    }
    const entries = [], seenReturns = new Set()
    let afterId = 0, legacyItemCount = 0
    for (;;) {
      const items = await this.repository.items(connection, Number(employeeId), through, afterId, this.batchSize)
      if (!items.length) break
      const histories = await this.repository.returns(connection, items.map(row => id(row.item_id)))
      const byItem = new Map(items.map(row => [id(row.item_id), []]))
      let previousReturn = 0
      for (const row of histories) {
        const returnId = id(row.aftersale_item_id), itemId = id(row.original_item_id)
        if (returnId <= previousReturn || seenReturns.has(returnId) || !byItem.has(itemId) ||
          id(row.aftersale_id) !== id(row.source_aftersale_id) ||
          !['goods_return', 'phone_return', 'goods_exchange'].includes(row.operation_type)) conflict('商品提成售后关联异常或重复')
        previousReturn = returnId; seenReturns.add(returnId)
        byItem.get(itemId).push(row)
      }
      for (const row of items) {
        const itemId = id(row.item_id)
        if (itemId <= afterId) conflict('商品提成原单来源重复或分页顺序异常')
        afterId = itemId
        const snapshot = json(row.snapshot), history = byItem.get(itemId)
        // 无旧提成凭据就不补算；但不能将已存在的冲回凭据当成旧资料丢弃。
        if (!Object.hasOwn(snapshot, 'commission')) {
          if (history.some(previous => Object.hasOwn(json(previous.fact_snapshot), 'commission_return'))) conflict('旧商品存在无原提成的冲回凭据')
          legacyItemCount++
          continue
        }
        const { item, commission } = readCheckoutGoods(row)
        const saleTime = time(row.sale_time), recordedAt = time(row.recorded_at)
        if (id(row.sale_operator_id) !== Number(employeeId) || id(row.order_operator_id) !== Number(employeeId) ||
          id(row.accessory_sale_id) !== id(row.source_sale_id) || id(row.accessory_id) !== id(row.sale_accessory_id) ||
          id(row.store_id) !== id(row.sale_store_id) || nullableId(row.customer_id) !== nullableId(row.sale_customer_id) ||
          Number(row.sale_quantity) !== item.quantity || row.sale_type !== item.sale_type ||
          !sameMoney(row.unit_price, row.sale_unit_price) || !sameMoney(row.total_amount, row.sale_total_price) ||
          (row.purchase_cost === null ? row.sale_purchase_cost !== null : !sameMoney(row.purchase_cost, row.sale_purchase_cost)) ||
          saleTime !== time(row.item_time) || saleTime !== time(row.order_time) || saleTime > through || recordedAt > through) {
          conflict('商品提成原单与销售事实不一致')
        }
        // 共用售后规划核验全部历史区间、SN及冲回；未来日期的历史也不能掩盖重复退货。
        planGoodsReturn(row, history, 0, [])
        const base = { employee_id: Number(employeeId), salary_template_id: commission.salary_template_id,
          order_id: id(row.order_id), order_item_id: itemId, accessory_sale_id: id(row.accessory_sale_id) }
        const originalKey = `goods_sale:${itemId}`
        const identity = { commission, serial_numbers: item.serial_numbers }
        entries.push(source({ ...base, source_key: originalKey, kind: 'sale', original_source_key: null,
          aftersale_id: null, aftersale_item_id: null, quantity: item.quantity, business_time: saleTime,
          recorded_at: recordedAt, amount_cents: commission.earned_cents, reason: commission.reason }, identity))
        for (const previous of history) {
          const fact = json(previous.fact_snapshot), businessTime = time(previous.business_time), recorded = time(previous.recorded_at)
          if (recorded < recordedAt) conflict('商品提成售后记录早于原销售记录')
          // 业务时间可补录，记录时间不可冒充业务时间；两者分别保留供工资核销及跨月判断。
          if (businessTime > through || recorded > through) continue
          entries.push(source({ ...base, source_key: `goods_return:${id(previous.aftersale_item_id)}`, kind: 'return',
            original_source_key: originalKey, aftersale_id: id(previous.aftersale_id), aftersale_item_id: id(previous.aftersale_item_id),
            quantity: Number(previous.quantity), business_time: businessTime, recorded_at: recorded,
            amount_cents: 0 - fact.commission_return.reversal_cents, reason: commission.reason }, identity, fact.unit_ranges))
        }
      }
    }
    return { version: 1, employee_id: Number(employeeId), through, legacy_item_count: legacyItemCount,
      earned_cents: total(entries.filter(entry => entry.kind === 'sale').map(entry => entry.amount_cents)),
      reversal_cents: total(entries.filter(entry => entry.kind === 'return').map(entry => -entry.amount_cents)),
      net_cents: total(entries.map(entry => entry.amount_cents)), entries }
  }

  notReady() {
    throw Object.assign(new Error('商品提成来源结构或录入时间字段尚未就绪，请先核对部署迁移'), {
      statusCode: 409, code: 'SALARY_GOODS_NOT_READY'
    })
  }
}

module.exports = SalaryGoodsService
