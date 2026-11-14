'use strict'

const { normalizeDatabaseIdentifier } = require('./database-identifier')

/** 排除已取消销售；兼容历史 NULL，保留 pending 的既有业务含义。不能用于原单追溯或单号占用。 */
function getActiveSaleSql(alias = 's') {
  const name = normalizeDatabaseIdentifier(alias, '销售表别名')
  return `(${name}.status IS NULL OR ${name}.status IN ('pending', 'completed'))`
}

/** 先确定最新一笔，再检查有效性；已取消时不回退到更早销售，也不按业务/创建时间判断。 */
function getLatestActiveSaleIdSql(phoneAlias = 'p', saleAlias = 's') {
  const phone = normalizeDatabaseIdentifier(phoneAlias, '设备表别名')
  const sale = normalizeDatabaseIdentifier(saleAlias, '销售表别名')
  return `SELECT CASE WHEN ${getActiveSaleSql(sale)} THEN ${sale}.id ELSE NULL END FROM sales ${sale}
    WHERE ${sale}.phone_id = ${phone}.id
    ORDER BY ${sale}.id DESC LIMIT 1`
}

module.exports = { getActiveSaleSql, getLatestActiveSaleIdSql }
