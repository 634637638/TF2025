'use strict'

/** 仅核对本批T22结构；不替代权限、期初核对或业务验收，也不执行任何迁移。 */
const migrations = Object.freeze([
  { name: 'accessory-stock-in-requests', dependencies: [] },
  { name: 'accessory-purchase-snapshots', dependencies: [] },
  { name: 'sales-checkout', dependencies: [] },
  { name: 'customer-points-ledger', dependencies: [] },
  { name: 'customer-points-aftersales', dependencies: ['customer-points-ledger'] },
  { name: 'accessory-inventory-returns', dependencies: [] },
  { name: 'sales-aftersales', dependencies: ['sales-checkout'] },
  { name: 'salary-goods-commission', dependencies: [] },
  { name: 'salary-goods-settlement', dependencies: [] },
  { name: 'film-services', dependencies: ['sales-checkout'] }
])

const failed = message => Object.assign(new Error(message), { code: 'ACCESSORY_SCHEMA_CHECK_INVALID' })

/** DDL会隐式提交，不能仅靠READ ONLY阻止误执行；不给迁移预览暴露写入口。 */
function readOnlyExecutor(connection) {
  const read = method => (sql, ...values) => {
    if (typeof sql !== 'string' || !/^\s*(?:SELECT\b|SHOW\s+CREATE\s+TABLE\b)/i.test(sql)) {
      throw failed('结构预览拒绝非读取语句')
    }
    return connection[method](sql, ...values)
  }
  return Object.freeze({ query: read('query'), execute: read('execute') })
}

function statementCount(result) {
  if (!result || result.writes !== false) throw failed('迁移未声明零写入')
  if (result.status === 'already_ready' && result.sql === undefined) return 0
  const statements = typeof result.sql === 'string' ? [result.sql] : result.sql
  if (!Array.isArray(statements) || statements.some(sql => typeof sql !== 'string' || !sql.trim()) ||
    !['already_ready', 'dry_run'].includes(result.status) ||
    result.status === 'already_ready' && statements.length || result.status === 'dry_run' && !statements.length) {
    throw failed('迁移预览返回了无效状态或语句')
  }
  return statements.length
}

async function checkAccessoryReleaseSchema(connection, {
  loadMigration = name => require(`./migrate-${name}.js`).migrate
} = {}) {
  const results = [], db = readOnlyExecutor(connection)
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
  await connection.query('START TRANSACTION READ ONLY')
  try {
    for (const entry of migrations) {
      const command = `npm --prefix backend run migrate:${entry.name}`
      const dependencies = entry.dependencies.filter(name => results.find(row => row.name === name)?.status !== 'ready')
      if (dependencies.length) {
        results.push({ name: entry.name, command, status: 'blocked', dependencies, statements: null })
        continue
      }
      try {
        const migrate = loadMigration(entry.name)
        const result = await migrate(db, { apply: false, rollback: false })
        const statements = statementCount(result)
        results.push({ name: entry.name, command, status: statements ? 'pending' : 'ready', statements })
      } catch {
        // 不输出数据库原始错误、SQL参数或配置；使用单项预览入口在受控终端定位。
        results.push({ name: entry.name, command, status: 'error', statements: null,
          message: '结构读取或迁移契约校验失败，请单独运行该项只读预览核对' })
      }
    }
  } finally { await connection.rollback() }
  const count = status => results.filter(row => row.status === status).length
  return { status: results.every(row => row.status === 'ready') ? 'schema_ready' : 'schema_not_ready', writes: false,
    counts: { ready: count('ready'), pending: count('pending'), blocked: count('blocked'), error: count('error') }, results }
}

async function main(args = process.argv.slice(2)) {
  if (args.length) throw failed('此命令不接受参数，只读核对；不会执行apply或rollback')
  const { db: config } = require('../src/config')
  const connection = await require('mysql2/promise').createConnection({ ...config, multipleStatements: false, connectTimeout: 15000 })
  try {
    const result = await checkAccessoryReleaseSchema(connection)
    console.log(JSON.stringify(result, null, 2))
    if (result.status !== 'schema_ready') process.exitCode = 2
  } finally { await connection.end() }
}

if (require.main === module) main().catch(() => {
  console.error('T22结构检查失败；仅支持无参数只读检查，未输出数据库配置或原始错误。')
  process.exitCode = 1
})

module.exports = { checkAccessoryReleaseSchema, migrations }
