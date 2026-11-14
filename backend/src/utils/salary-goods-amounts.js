'use strict'

const { isMoneyInput } = require('./input-values')
const { readSnapshot, conflict } = require('./salary-goods-settlement')
const { createHash } = require('node:crypto')
const { formatLocalDate } = require('./time')

function cents(value) {
  const numeric = Number(value), scaled = numeric * 100, rounded = Math.round(scaled)
  if ((!isMoneyInput(value) && !(typeof value === 'number' && Number.isFinite(value) && Math.abs(scaled - rounded) < 0.00001)) ||
    !Number.isSafeInteger(rounded) || Math.abs(rounded) > 9999999999) conflict('工资金额必须为有效两位金额且不超出范围')
  return rounded
}

function basis(snapshot) {
  const saved = readSnapshot(snapshot), base = saved.salary_basis
  if (!base || Object.keys(base).length !== 2 || !Number.isSafeInteger(base.commission_cents) || !Number.isSafeInteger(base.net_cents) ||
    Math.abs(base.commission_cents) > 9999999999 || Math.abs(base.net_cents) > 9999999999) conflict('工资缺少有效的商品计提前金额凭据，请重新计算')
  return { saved, base }
}

function validateSalary(record) {
  const { saved, base } = basis(record.goods_commission_snapshot)
  if (cents(record.commission_amount) !== base.commission_cents + saved.net_cents ||
    cents(record.net_salary) !== base.net_cents + saved.net_cents) conflict('工资提成或实发金额与商品核销快照不一致')
  return saved
}

/** 原手机提成及手工金额作为基数保存；商品净额只加一次。 */
function applyGoods(salary, plan) {
  const saved = readSnapshot(plan), base = { commission_cents: cents(salary.commission_amount ?? 0), net_cents: cents(salary.net_salary ?? 0) }
  const commission = (base.commission_cents + saved.net_cents) / 100, net = (base.net_cents + saved.net_cents) / 100
  cents(commission); cents(net)
  return { ...salary, commission_amount: commission, net_salary: net,
    goods_commission_snapshot: JSON.stringify({ ...saved, salary_basis: base }) }
}

/** 从服务器旧记录剥离商品净额，再合并手工基数及本次核对结果。 */
function removeGoods(record) {
  if (!record.goods_commission_snapshot) return { ...record }
  const saved = validateSalary(record)
  return { ...record, commission_amount: (cents(record.commission_amount) - saved.net_cents) / 100,
    net_salary: (cents(record.net_salary) - saved.net_cents) / 100 }
}

function manualSalary(base, write) {
  const salary = { ...base, ...write }
  const additions = ['base_salary', 'commission_amount', 'overtime_pay', 'performance_bonus', 'other_bonus']
  const deductions = ['leave_deduction', 'other_deduction']
  if ([...additions, ...deductions].some(key => Object.hasOwn(write, key)) && !Object.hasOwn(write, 'net_salary')) {
    salary.net_salary = (additions.reduce((total, key) => total + cents(salary[key] ?? 0), 0) -
      deductions.reduce((total, key) => total + cents(salary[key] ?? 0), 0)) / 100
  }
  return salary
}

/** 只规范服务器公式结果；外部手工金额仍严格拒绝超过两位小数。 */
function calculatedSalary(value) {
  const salary = { ...value }
  const fields = ['base_salary', 'base_salary_adjustment', 'commission_amount', 'overtime_pay',
    'performance_bonus', 'other_bonus', 'leave_deduction', 'other_deduction']
  for (const key of fields) {
    const number = Number(salary[key] ?? 0)
    if (!Number.isFinite(number)) conflict('工资计算产生无效金额')
    salary[key] = Math.sign(number) * Math.round((Math.abs(number) + Number.EPSILON) * 100) / 100
    cents(salary[key])
  }
  return manualSalary(salary, { base_salary: salary.base_salary })
}

function publicSalary(record) {
  if (!record) return record
  const { goods_commission_snapshot: snapshot, ...result } = record
  if (!snapshot) return { ...result, goods_commission: null, calculation_version: calculationVersion(record) }
  const saved = validateSalary(record)
  return { ...result, calculation_version: calculationVersion(record), goods_commission: { earned_amount: saved.earned_cents / 100, reversal_amount: saved.reversal_cents / 100,
    net_amount: saved.net_cents / 100, entries: saved.entries.map(entry => ({ kind: entry.kind, order_id: entry.order_id,
      order_item_id: entry.order_item_id, aftersale_id: entry.aftersale_id, aftersale_item_id: entry.aftersale_item_id,
      original_salary_record_id: entry.original_salary_record_id,
      quantity: entry.quantity, business_time: entry.business_time, recorded_at: entry.recorded_at, amount: entry.amount_cents / 100 })) } }
}

/** 核对版本只用于防止预览后静默改额，不代替权限或服务器来源核验。 */
function calculationVersion(record) {
  const fields = ['employee_id', 'salary_template_id', 'period_start', 'period_end', 'actual_work_days', 'base_salary',
    'base_salary_adjustment', 'base_salary_note', 'commission_amount', 'commission_detail', 'sales_count', 'overtime_hours',
    'overtime_pay', 'performance_bonus', 'other_bonus', 'leave_days', 'leave_deduction', 'other_deduction', 'net_salary']
  const payload = Object.fromEntries(fields.map(key => [key, record[key] ?? null]))
  for (const key of fields) {
    if (key.startsWith('period_')) payload[key] = formatDate(payload[key])
    else if (!['commission_detail', 'base_salary_note'].includes(key) && payload[key] !== null) payload[key] = Number(payload[key])
  }
  if (record.goods_commission_snapshot) {
    const { through: _through, ...saved } = readSnapshot(record.goods_commission_snapshot)
    payload.goods = saved
  }
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')
}

const formatDate = value => value instanceof Date ? formatLocalDate(value) : value

function assertCalculationVersion(record, expected) {
  if (expected !== undefined && (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || calculationVersion(record) !== expected)) {
    throw Object.assign(new Error('工资金额或商品来源已变化，请重新核对后确认'), {
      statusCode: 409, code: 'SALARY_GOODS_RECALCULATION_REQUIRED'
    })
  }
}

module.exports = { cents, applyGoods, removeGoods, manualSalary, calculatedSalary, validateSalary, publicSalary, assertCalculationVersion }
