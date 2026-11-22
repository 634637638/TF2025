/**
 * 生成单据编号 (Invoice Number)
 * 规则: 日期 + 序列号后4位 + 类型
 * 格式: YYYYMMDD + 序号后4位 + 类型代码
 * 例如: 202602070001XS (2026年2月7日，序号0001，零售)
 *       202602070002PF (2026年2月7日，序号0002，调货/批发)
 *       202602070003HB (2026年2月7日，序号0003，划拨)
 *
 * @param {string} saleType - 销售类型: 'retail'(零售/默认), 'peer_transfer'(调货), 'supplier_proxy'(供应商划拨)
 * @param {object} connection - 数据库连接 (用于获取序列号)
 * @param {Date|string} saleDate - 销售日期 (可选，默认使用当前时间)
 * @returns {Promise<string>} 单据编号
 */
const mysql = require('mysql2/promise')
const config = require('../config')
const { isConnected } = require('../config/database')
const { formatLocalDate, formatBeijingDate, formatBeijingDateTime } = require('./time')
const { schemaChangesAllowed } = require('./schema-change-policy')

let sequenceTableReady
// 每个业务事务独立预留，避免批量分配后尚未写入 sales 时重复使用空号。
const transactionReservations = new WeakMap()
const initializedSequenceKeys = new Set()
const sequenceInitializationTails = new Map()

const INVOICE_TYPE_SUFFIXES = Object.freeze({
  retail: 'XS',
  peer_transfer: 'PF',
  supplier_proxy: 'HB',
  batch_item: 'XS',
  wholesale: 'PF'
})

function getInvoiceTypeSuffix(saleType = 'retail') {
  return INVOICE_TYPE_SUFFIXES[saleType] || 'XS'
}

const ensureSequenceTable = async (connection) => {
  if (!schemaChangesAllowed()) return
  if (!sequenceTableReady) {
    sequenceTableReady = connection.execute(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        sequence_date CHAR(12) NOT NULL,
        type_suffix VARCHAR(4) NOT NULL,
        current_sequence INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (sequence_date, type_suffix)
      ) ENGINE=InnoDB
    `).catch(error => {
      sequenceTableReady = null
      throw error
    })
  }
  await sequenceTableReady
}

/**
 * 必须在 beginTransaction 前调用：完成 DDL 预检，并清除该连接上一次事务的预留。
 * 预留只在当前事务有效；提交前必须把返回的单号写入同一连接的 sales 记录。
 */
async function prepareInvoiceNumberTransaction(connection) {
  await ensureSequenceTable(connection)
  transactionReservations.set(connection, { numbers: new Map(), pending: Promise.resolve() })
}

function getInvoiceDateKey(value) {
  // 日期控件/数据库日期时间保留业务日期；Date、带时区 ISO 和默认当前时间按北京时间取日。
  const localDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|[ T]\d{2}:\d{2}(?::\d{2})?)$/.test(value.trim())
  const date = localDate ? formatLocalDate(value) : formatBeijingDate(value || new Date())
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    throw new Error('销售日期无效，无法生成单据编号')
  }
  return date.replace(/-/g, '')
}

async function generateInvoiceNumber(saleType = 'retail', connection, saleDate) {
  if (!connection) {
    throw new Error('生成单据编号需要数据库连接')
  }
  const scope = transactionReservations.get(connection)
  if (!scope) {
    throw new Error('请在开始业务事务前调用 prepareInvoiceNumberTransaction')
  }
  const dateStr = getInvoiceDateKey(saleDate)
  const typeSuffix = getInvoiceTypeSuffix(saleType)
  // 同一连接即使同时调用多次，也必须在前一次预留完成后再读取空号。
  const allocation = scope.pending.then(() => allocateInvoiceNumber(connection, dateStr, typeSuffix, scope.numbers))
  scope.pending = allocation.then(() => {}, () => {})
  return allocation
}

async function generatePurchaseNumber(connection, purchaseDate = new Date()) {
  if (!connection) throw new Error('生成入库单号需要数据库连接')
  const scope = transactionReservations.get(connection)
  if (!scope) throw new Error('请在开始入库事务前调用 prepareInvoiceNumberTransaction')

  const purchaseTime = getBeijingPurchaseTime(purchaseDate)
  const fullDate = purchaseTime.slice(0, 10).replace(/-/g, '')
  const minute = purchaseTime.slice(11, 13) + purchaseTime.slice(14, 16)
  const compactDate = fullDate.slice(2) + minute
  const sequenceDate = `${fullDate}${minute}`
  const allocation = scope.pending.then(() => allocatePrefixedSequence(connection, {
    sequenceDate,
    sequenceType: 'PO',
    prefix: 'PO',
    displayDate: compactDate,
    digits: 4,
    limit: 9999,
    reservations: scope.numbers
  }))
  scope.pending = allocation.then(() => {}, () => {})
  return allocation
}

async function generateDailyDocumentNumber(prefix, connection, date, digits) {
  if (!connection) throw new Error('生成单据编号需要数据库连接')
  const scope = transactionReservations.get(connection)
  if (!scope) throw new Error('请在开始业务事务前调用 prepareInvoiceNumberTransaction')
  if (!['PS', 'RK', 'SO'].includes(prefix) || !Number.isInteger(digits) || digits < 1 || digits > 8) {
    throw new Error('单据编号规则无效')
  }
  const sequenceDate = getInvoiceDateKey(date)
  const allocation = scope.pending.then(() => allocatePrefixedSequence(connection, {
    sequenceDate,
    sequenceType: prefix,
    prefix,
    displayDate: sequenceDate.slice(2),
    digits,
    limit: 10 ** digits - 1,
    reservations: scope.numbers
  }))
  scope.pending = allocation.then(() => {}, () => {})
  return allocation
}

function getBeijingPurchaseTime(value) {
  if (value instanceof Date || value === undefined) return formatBeijingDateTime(value || new Date())
  if (typeof value !== 'string') throw new Error('采购单号时间无效')
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed} 00:00:00`
  const localMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/)
  let result
  if (localMatch) result = `${localMatch[1]} ${localMatch[2]}:${localMatch[3]}:00`
  else {
    const parsed = new Date(trimmed)
    result = Number.isFinite(parsed.getTime()) ? formatBeijingDateTime(parsed) : ''
  }
  const dateKey = result.slice(0, 10).replace(/-/g, '')
  const parsedDate = new Date(`${result.slice(0, 10)}T00:00:00Z`)
  const hour = Number(result.slice(11, 13)), minute = Number(result.slice(14, 16)), second = Number(result.slice(17, 19))
  if (!/^\d{8}$/.test(dateKey) || Number.isNaN(parsedDate.getTime()) || hour > 23 || minute > 59 || second > 59 ||
    `${String(parsedDate.getUTCFullYear()).padStart(4, '0')}${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}${String(parsedDate.getUTCDate()).padStart(2, '0')}` !== dateKey ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(result)) {
    throw new Error('采购单号时间无效')
  }
  return result
}

async function allocatePrefixedSequence(connection, { sequenceDate, sequenceType, prefix, displayDate, digits, limit, reservations }) {
  const key = `${sequenceDate}:${sequenceType}`
  const reserved = reservations.get(key) || new Set()
  if (!reservations.has(key)) await ensureSequenceRow(connection, sequenceDate, sequenceType)

  const [[sequenceRow]] = await connection.execute(
    `SELECT current_sequence
     FROM invoice_sequences
     WHERE sequence_date = ? AND type_suffix = ?
     FOR UPDATE`,
    [sequenceDate, sequenceType]
  )
  if (!sequenceRow) throw new Error('单号序列表不存在，请先运行数据库结构迁移')

  let sequence = Number(sequenceRow.current_sequence) || 0
  for (const value of reserved) sequence = Math.max(sequence, value)
  sequence += 1
  if (!Number.isSafeInteger(sequence) || sequence > limit) {
    throw new Error('当前单号序列已用尽')
  }

  const [updateResult] = await connection.execute(
    `UPDATE invoice_sequences
     SET current_sequence = ?
     WHERE sequence_date = ? AND type_suffix = ?`,
    [sequence, sequenceDate, sequenceType]
  )
  if (updateResult.affectedRows !== 1) {
    throw new Error('单号序列表更新失败')
  }
  reserved.add(sequence)
  reservations.set(key, reserved)
  return `${prefix}${displayDate}${String(sequence).padStart(digits, '0')}`
}

async function allocateInvoiceNumber(connection, dateStr, typeSuffix, reservations) {
  const prefixPattern = `${dateStr}%${typeSuffix}`
  const key = `${dateStr}${typeSuffix}`
  const reserved = reservations.get(key) || new Set()

  if (!reservations.has(key)) {
    await ensureSequenceRow(connection, dateStr, typeSuffix)
  }

  // 先锁定序列表行，再读取销售占用记录；所有事务遵循同一锁顺序，
  // 避免 sales 间隙锁与 invoice_sequences 行锁交叉等待。
  await connection.execute(
    `SELECT current_sequence
     FROM invoice_sequences
     WHERE sequence_date = ? AND type_suffix = ?
     FOR UPDATE`,
    [dateStr, typeSuffix]
  )

  // 必须使用当前读：事务前面可能已有快照，普通 SELECT 会漏掉刚提交的号码。
  const [rows] = await connection.execute(
    `SELECT invoice_number FROM sales
     WHERE invoice_number LIKE ? ORDER BY invoice_number FOR UPDATE`,
    [prefixPattern]
  )
  const occupied = new Set(reserved)
  let historySequence = 0
  for (const row of rows) {
    const number = String(row.invoice_number || '')
    const digits = number.slice(8, -typeSuffix.length)
    if (number.startsWith(dateStr) && number.endsWith(typeSuffix) && /^\d+$/.test(digits)) {
      const sequence = Number(digits)
      if (Number.isSafeInteger(sequence) && sequence > 0) {
        occupied.add(sequence)
        historySequence = Math.max(historySequence, sequence)
      }
    }
  }
  let sequence = 1
  while (occupied.has(sequence)) sequence += 1
  if (sequence > 9999) throw new Error('当天该类型的四位单据号已用完')

  // 序列表保留历史高水位用于兼容审计；不再把高水位当作下一个可用号码。
  await connection.execute(
    `UPDATE invoice_sequences
     SET current_sequence = GREATEST(current_sequence, ?)
     WHERE sequence_date = ? AND type_suffix = ?`,
    [Math.max(historySequence, sequence), dateStr, typeSuffix]
  )
  reserved.add(sequence)
  reservations.set(key, reserved)

  return `${dateStr}${String(sequence).padStart(4, '0')}${typeSuffix}`
}

async function ensureSequenceRow(connection, dateStr, typeSuffix) {
  const key = `${dateStr}:${typeSuffix}`
  // 单元测试使用传入的内存连接；真实业务使用独立自动提交连接，
  // 避免在业务事务中首次插入序列表行而与其他事务形成间隙锁死锁。
  if (!isConnected()) {
    await connection.execute(
      `INSERT IGNORE INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
       VALUES (?, ?, 0)`,
      [dateStr, typeSuffix]
    )
    return
  }

  if (initializedSequenceKeys.has(key)) {
    return
  }

  const previous = sequenceInitializationTails.get(key) || Promise.resolve()
  const initialization = previous.then(async () => {
    if (initializedSequenceKeys.has(key)) {
      return
    }

    const bootstrapConnection = await mysql.createConnection(config.db)
    try {
      await bootstrapConnection.execute(
        `INSERT IGNORE INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
         VALUES (?, ?, 0)`,
        [dateStr, typeSuffix]
      )
      initializedSequenceKeys.add(key)
    } finally {
      await bootstrapConnection.end()
    }
  })

  sequenceInitializationTails.set(key, initialization.catch(() => {}))
  await initialization
}

/**
 * 生成指定日期的单据编号 (用于批量导入等场景)
 * @param {Date|string} date - 指定日期
 * @param {number} sequence - 序列号
 * @param {string} saleType - 销售类型
 * @returns {string} 单据编号
 */
function generateInvoiceNumberForDate(date, sequence, saleType = 'retail') {
  const dateStr = getInvoiceDateKey(date)

  const typeSuffix = getInvoiceTypeSuffix(saleType)

  const sequenceStr = String(sequence).padStart(4, '0')

  return `${dateStr}${sequenceStr}${typeSuffix}`
}

/**
 * 从单据编号中提取信息
 * @param {string} invoiceNumber - 单据编号
 * @returns {object} 包含日期、序号、类型的信息对象
 */
function parseInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber || invoiceNumber.length < 13) {
    return null
  }

  const dateStr = invoiceNumber.substring(0, 8)
  const sequenceStr = invoiceNumber.substring(8, 12)
  const typeSuffix = invoiceNumber.substring(12)

  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)

  const typeMap = {
    'XS': 'retail',
    // DH 是历史调货单号后缀，仅保留读取兼容；新单号统一使用 PF。
    'DH': 'peer_transfer',
    'HB': 'supplier_proxy',
    'PF': 'wholesale'
  }

  return {
    date: `${year}-${month}-${day}`,
    sequence: parseInt(sequenceStr, 10),
    saleType: typeMap[typeSuffix] || 'retail',
    typeSuffix: typeSuffix
  }
}

module.exports = {
  ensureInvoiceSequenceTable: ensureSequenceTable,
  prepareInvoiceNumberTransaction,
  getInvoiceTypeSuffix,
  generateInvoiceNumber,
  generatePurchaseNumber,
  generateDailyDocumentNumber,
  generateInvoiceNumberForDate,
  parseInvoiceNumber
}
