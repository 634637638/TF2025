'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { COLUMNS } = require('../src/config/customer-address')

const ID = '20261113_customer_address_levels'
const checksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

async function inspect(db) {
  const [rows] = await db.execute(`SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'`)
  if (!rows.length) throw new Error('customers 表不存在，禁止创建替代表')
  const present = new Map(rows.map(row => [row.COLUMN_NAME, row]))
  for (const [name, definition] of Object.entries(COLUMNS)) {
    const row = present.get(name)
    if (row && (row.COLUMN_TYPE.toLowerCase() !== definition.split(' ')[0].toLowerCase() || row.IS_NULLABLE !== 'YES')) {
      throw new Error(`既有地址列定义不兼容：${name}`)
    }
  }
  return { columns: rows, missing: Object.keys(COLUMNS).filter(name => !present.has(name)) }
}

async function migrate(db, { apply = false, backupDirectory } = {}) {
  const before = await inspect(db)
  if (!apply || !before.missing.length) return { applied: false, missing: before.missing }
  if (!backupDirectory) throw new Error('执行迁移必须提供备份目录')
  const [[lock]] = await db.execute('SELECT GET_LOCK(?, 10) AS acquired', [ID])
  if (Number(lock.acquired) !== 1) throw new Error('地址迁移正在执行，禁止并发操作')
  try {
    const current = await inspect(db)
    if (!current.missing.length) return { applied: false, missing: [] }
    const [[database]] = await db.execute('SELECT DATABASE() AS name')
    const snapshot = { id: ID, target: checksum(database.name), columns: current.columns, added: current.missing }
    const backup = { ...snapshot, checksum: checksum(snapshot) }
    await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 })
    const file = path.join(backupDirectory, `${ID}-${Date.now()}.json`)
    await fs.writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await db.execute(`ALTER TABLE customers ${current.missing.map(name => `ADD COLUMN ${name} ${COLUMNS[name]}`).join(', ')}`)
    const after = await inspect(db)
    if (after.missing.length) throw new Error('地址迁移回读不完整，请保留备份后检查')
    return { applied: true, added: current.missing, backup: file }
  } finally {
    await db.execute('SELECT RELEASE_LOCK(?)', [ID])
  }
}

async function rollback(db, backupFile, { maintenanceConfirmed = false } = {}) {
  if (!maintenanceConfirmed) throw new Error('物理回滚必须先停止应用写入，并显式确认维护窗口')
  if (!backupFile) throw new Error('回滚必须提供原迁移备份')
  const { checksum: expected, ...snapshot } = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  if (snapshot.id !== ID || checksum(snapshot) !== expected || !Array.isArray(snapshot.added) ||
    !snapshot.added.length || new Set(snapshot.added).size !== snapshot.added.length || snapshot.added.some(name => !Object.hasOwn(COLUMNS, name))) throw new Error('迁移备份无效')
  const [[database]] = await db.execute('SELECT DATABASE() AS name')
  if (snapshot.target !== checksum(database.name)) throw new Error('备份目标不匹配，禁止跨库回滚')
  const [[lock]] = await db.execute('SELECT GET_LOCK(?, 10) AS acquired', [ID])
  if (Number(lock.acquired) !== 1) throw new Error('地址迁移正在执行，禁止并发操作')
  try {
    const state = await inspect(db)
    const present = new Set(state.columns.map(row => row.COLUMN_NAME))
    const drop = snapshot.added.filter(name => present.has(name))
    if (!drop.length) return { rolledBack: false }
    const [[used]] = await db.execute(`SELECT COUNT(*) AS count FROM customers WHERE ${drop.map(name => `(${name} IS NOT NULL AND ${name} <> '')`).join(' OR ')}`)
    if (Number(used.count) !== 0) throw new Error('新地址列已有业务数据，禁止删除；应保留列并回滚应用')
    await db.execute(`ALTER TABLE customers ${drop.map(name => `DROP COLUMN ${name}`).join(', ')}`)
    const after = await inspect(db)
    if (drop.some(name => after.columns.some(row => row.COLUMN_NAME === name))) throw new Error('地址回滚回读失败')
    return { rolledBack: true, dropped: drop }
  } finally {
    await db.execute('SELECT RELEASE_LOCK(?)', [ID])
  }
}

async function main(args) {
  const actions = ['--apply', '--inspect', '--rollback'].filter(flag => args.includes(flag))
  if (actions.length > 1) throw new Error('迁移、预览和回滚不能同时执行')
  if (args.includes('--rollback') && (!args.includes('--maintenance-confirmed') || args.indexOf('--backup') < 0 || !args[args.indexOf('--backup') + 1] || args[args.indexOf('--backup') + 1].startsWith('--'))) throw new Error('回滚须停止应用写入，并提供 --maintenance-confirmed --backup 原迁移备份')
  if (!actions.length) {
    console.log(JSON.stringify({ mode: 'offline-plan', id: ID, columns: COLUMNS, note: '未连接数据库。--inspect 只读；--apply 明确执行；--rollback 必须提供原 --backup 文件且新增列为空。' }))
    return
  }
  const config = require('../src/config')
  const { host, port, user, password, database, charset, timezone, dateStrings, connectTimeout } = config.db
  if (!host || !user || !password || !database) throw new Error('当前环境的数据库配置不完整，禁止连接默认数据库')
  const db = await require('mysql2/promise').createConnection({
    host, port, user, password, database, charset, timezone, dateStrings, connectTimeout
  })
  try {
    const backupIndex = args.indexOf('--backup')
    const result = args.includes('--rollback') ? await rollback(db, args[backupIndex + 1], { maintenanceConfirmed: true })
      : await migrate(db, { apply: args.includes('--apply'), backupDirectory: path.resolve(__dirname, '../backups/migrations') })
    console.log(JSON.stringify(result))
  } finally { await db.end() }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(error.code ? `地址迁移操作失败：${error.code}` : error.message)
  process.exitCode = 1
})
module.exports = { inspect, migrate, rollback, checksum }
