'use strict'

// 独立规格规则不会被采集、导入或全局加价设置覆盖。
const COLUMNS = [
  ['wholesale_rule_mode', "ENUM('inherit','original','adjustment','extra') NOT NULL DEFAULT 'inherit'"],
  ['wholesale_rule_adjustment', 'DECIMAL(12,2) NOT NULL DEFAULT 0']
]

async function inspectPriceRuleSchema(db) {
  const [rows] = await db.query(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'price_list'`)
  if (!rows.some(row => row.COLUMN_NAME === 'id')) throw new Error('缺少 price_list 表，请核对目标数据库')
  const pending = []
  for (const [name] of COLUMNS) {
    const column = rows.find(row => row.COLUMN_NAME === name)
    if (!column) pending.push({ column: name, operation: 'add' })
    else {
      const expectedType = name === 'wholesale_rule_mode' ? "enum('inherit','original','adjustment','extra')" : 'decimal(12,2)'
      const existingType = String(column.COLUMN_TYPE).toLowerCase()
      const extendMode = name === 'wholesale_rule_mode' && existingType === "enum('inherit','original','adjustment')"
      const validDefault = name === 'wholesale_rule_mode' ? column.COLUMN_DEFAULT === 'inherit' : Number(column.COLUMN_DEFAULT) === 0
      if ((existingType !== expectedType && !extendMode) || column.IS_NULLABLE !== 'NO' || !validDefault) {
        throw new Error(`${name} 结构不一致，拒绝自动覆盖`)
      }
      if (extendMode) pending.push({ column: name, operation: 'extend_enum' })
    }
  }
  return pending
}

async function migratePriceRuleSchema(db, { apply = false } = {}) {
  const pending = await inspectPriceRuleSchema(db)
  if (!apply) return { status: pending.length ? 'dry_run' : 'already_ready', pending }
  if (pending.length) {
    const definitions = Object.fromEntries(COLUMNS)
    await db.query(`ALTER TABLE price_list ${pending.map(({ column, operation }) => `${operation === 'add' ? 'ADD' : 'MODIFY'} COLUMN ${column} ${definitions[column]}`).join(', ')}`)
  }
  if ((await inspectPriceRuleSchema(db)).length) throw new Error('报价规格规则迁移后校验失败')
  return { status: pending.length ? 'migrated_and_verified' : 'already_ready', pending: [] }
}

module.exports = { migratePriceRuleSchema }
