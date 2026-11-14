'use strict'

const { isDeepStrictEqual } = require('node:util')
const SalaryGoodsService = require('./salary-goods.service')
const Repository = require('../repositories/salary-goods-settlement.repository')
const { hasTable, hasColumn } = require('./schema-inspector.service')
const { isIntegerInput } = require('../utils/input-values')
const { normalizeDateTime, formatLocalDate } = require('../utils/time')
const { planSettlement, readSnapshot, sameSettlement, context, conflict } = require('../utils/salary-goods-settlement')
const { validateSalary } = require('../utils/salary-goods-amounts')

/** 内部工资核销编排。调用方须先锁员工，持有一致性事务，并统一提交工资及来源账。 */
class SalaryGoodsSettlementService {
  constructor({ repository = new Repository(), sources = new SalaryGoodsService(), batchSize = 200,
    tableExists = hasTable, columnExists = hasColumn } = {}) {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new TypeError('商品工资核销批次无效')
    Object.assign(this, { repository, sources, batchSize, tableExists, columnExists })
  }

  async ready(connection) {
    if (!await this.tableExists('salary_goods_settlements', connection) ||
      !await this.columnExists('salary_records', 'goods_commission_snapshot', connection)) {
      throw Object.assign(new Error('商品工资核销结构尚未就绪，请先核对部署迁移'), {
        statusCode: 409, code: 'SALARY_GOODS_SETTLEMENT_NOT_READY'
      })
    }
  }

  async pages(load) {
    const result = []
    let afterId = 0
    for (;;) {
      const rows = await load(afterId, this.batchSize)
      if (!rows.length) return result
      for (const row of rows) {
        if (!isIntegerInput(row.id) || Number(row.id) <= afterId) conflict('商品工资核销来源重复或分页顺序异常')
        afterId = Number(row.id); result.push(row)
      }
    }
  }

  async prepare(connection, input) {
    const scope = context(input)
    await this.ready(connection)
    const sources = await this.sources.readSources(connection, scope.employee_id, scope.through)
    const claims = await this.pages((afterId, size) => this.repository.employeeClaims(connection, scope.employee_id, afterId, size))
    const byId = new Map(claims.map(row => [Number(row.id), row]))
    // 按真实来源额外查账，员工或工资归属被错误改写时不能把已领取来源重新发一次。
    for (let offset = 0; offset < sources.entries.length; offset += this.batchSize) {
      const rows = await this.repository.sourceClaims(connection, sources.entries.slice(offset, offset + this.batchSize).map(entry => entry.source_key))
      for (const row of rows) {
        if (!isIntegerInput(row.id) || Number(row.id) <= 0) conflict('商品工资核销编号无效')
        const previous = byId.get(Number(row.id))
        if (previous && !isDeepStrictEqual(previous, row)) conflict('同次商品工资核销读取不一致')
        byId.set(Number(row.id), row)
      }
    }
    const records = await this.pages((afterId, size) => this.repository.records(connection, scope.employee_id, afterId, size))
    for (const record of records) {
      if ((record.status === 'paid' || record.paid_at) && record.goods_commission_snapshot) validateSalary(record)
    }
    return planSettlement(scope, sources, [...byId.values()], records)
  }

  /** 首次发放前重新核对已保存草稿，不自动改动经确认的工资金额。 */
  async confirm(connection, record, through) {
    const saved = validateSalary(record)
    if (record.status !== 'approved' || record.paid_at || Number(record.employee_id) !== saved.employee_id || formatLocalDate(record.period_start) !== saved.period_start ||
      formatLocalDate(record.period_end) !== saved.period_end) conflict('商品工资草稿归属与工资记录不一致')
    const current = await this.prepare(connection, { ...saved, through })
    if (!sameSettlement(saved, { ...current, salary_basis: saved.salary_basis })) throw Object.assign(new Error('商品提成或已核销来源发生变化，请重新计算工资后再发放'), {
      statusCode: 409, code: 'SALARY_GOODS_RECALCULATION_REQUIRED'
    })
    return saved
  }

  /** 原工资首次更新为paid后，在同一事务追加来源；任何失败由原编排整体回滚。 */
  async append(connection, record, confirmed) {
    const saved = validateSalary(record)
    const paidAt = context({ ...saved, through: normalizeDateTime(record.paid_at, false) }).through
    if (!isIntegerInput(record.id) || Number(record.id) <= 0 || record.status !== 'paid' || !record.paid_at ||
      Number(record.employee_id) !== saved.employee_id || formatLocalDate(record.period_start) !== saved.period_start ||
      formatLocalDate(record.period_end) !== saved.period_end || paidAt < saved.through ||
      !isDeepStrictEqual(saved, readSnapshot(confirmed))) conflict('商品工资未按已确认快照首次发放')
    for (const entry of saved.entries) {
      try {
        if (await this.repository.append(connection, Number(record.id), saved.employee_id, entry, paidAt) !== 1) conflict('商品工资来源核销写入失败')
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') conflict('商品提成来源已经核销，请重新计算工资')
        throw error
      }
    }
    return saved.entries.length
  }
}

module.exports = SalaryGoodsSettlementService
