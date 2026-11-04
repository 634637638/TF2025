'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  prepareInvoiceNumberTransaction,
  getInvoiceTypeSuffix
} = require('../src/utils/invoice-number')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const CANONICAL_PATTERN = '^[0-9]{12}(XS|PF|HB)$'
const LEGACY_INVOICE_PATTERN = '^([0-9]{11}(XS|PF|HB|DH)|[0-9]{12}DH)$'
const PARSE_INVOICE_PATTERN = /^(\d{8})(\d+)(XS|PF|HB)$/
const applyChanges = process.argv.includes('--apply')

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 30000
  })
}

function getSaleDateKey(saleTime) {
  const matched = String(saleTime || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!matched) {
    throw new Error(`销售日期无效: ${saleTime || '(empty)'}`)
  }
  return `${matched[1]}${matched[2]}${matched[3]}`
}

function getExpectedInvoiceKey(row) {
  return {
    dateKey: getSaleDateKey(row.sale_time),
    suffix: getInvoiceTypeSuffix(row.sale_type)
  }
}

function isInvoiceAligned(row) {
  const { dateKey, suffix } = getExpectedInvoiceKey(row)
  return String(row.invoice_number || '').startsWith(dateKey) &&
    String(row.invoice_number || '').endsWith(suffix)
}

function isCanonicalInvoice(invoiceNumber) {
  return /^\d{12}(XS|PF|HB)$/.test(String(invoiceNumber || ''))
}

function buildOccupiedSequences(invoiceNumbers) {
  const occupied = new Map()
  for (const rawValue of invoiceNumbers) {
    const match = String(rawValue || '').match(PARSE_INVOICE_PATTERN)
    if (!match) continue
    const sequence = Number(match[2])
    if (!Number.isSafeInteger(sequence) || sequence <= 0) continue
    const key = `${match[1]}:${match[3]}`
    const sequences = occupied.get(key) || new Set()
    sequences.add(sequence)
    occupied.set(key, sequences)
  }
  return occupied
}

function allocatePreviewNumber(row, occupied) {
  const { dateKey, suffix } = getExpectedInvoiceKey(row)
  const key = `${dateKey}:${suffix}`
  const sequences = occupied.get(key) || new Set()
  let sequence = 1
  while (sequences.has(sequence)) sequence += 1
  if (sequence > 9999) {
    throw new Error(`${dateKey}${suffix} 的四位单据号已用完`)
  }
  sequences.add(sequence)
  occupied.set(key, sequences)
  return `${dateKey}${String(sequence).padStart(4, '0')}${suffix}`
}

function buildRepairPlan(targetRows, invoiceNumbers) {
  const groups = new Map()
  for (const row of targetRows) {
    const rows = groups.get(row.invoice_number) || []
    rows.push(row)
    groups.set(row.invoice_number, rows)
  }

  const occupied = buildOccupiedSequences(invoiceNumbers)
  const keepers = []
  const candidates = []

  for (const [invoiceNumber, rows] of groups) {
    rows.sort((left, right) =>
      String(left.created_at || '').localeCompare(String(right.created_at || '')) ||
      Number(left.id) - Number(right.id))
    const keeper = rows.length > 1
      ? (rows.find(row => isCanonicalInvoice(row.invoice_number) && isInvoiceAligned(row)) || null)
      : null
    if (keeper) {
      keepers.push({ id: Number(keeper.id), invoice_number: invoiceNumber })
    }
    for (const row of rows) {
      if (keeper && Number(row.id) === Number(keeper.id)) continue
      if (rows.length === 1 && isCanonicalInvoice(row.invoice_number) && isInvoiceAligned(row)) continue
      const { dateKey, suffix } = getExpectedInvoiceKey(row)
      candidates.push({
        id: Number(row.id),
        phone_id: Number(row.phone_id),
        sale_type: row.sale_type,
        sale_time: row.sale_time,
        old_invoice_number: invoiceNumber,
        target_key: `${dateKey}:${suffix}`
      })
    }
  }

  candidates.sort((left, right) =>
    left.target_key.localeCompare(right.target_key) || left.id - right.id)
  const changes = candidates.map(change => ({
    ...change,
    preview_invoice_number: allocatePreviewNumber(change, occupied)
  }))

  return { keepers, changes }
}

async function readRepairState(db, lockRows = false) {
  const [invoiceRows] = await db.execute(
    `SELECT invoice_number
     FROM sales
     WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) <> ''`
  )
  const [targetRows] = await db.execute(
    `SELECT id, phone_id, invoice_number, sale_type, sale_time, created_at
     FROM sales
     WHERE (
       invoice_number REGEXP ?
       AND (
           LEFT(invoice_number, 8) <> DATE_FORMAT(sale_time, '%Y%m%d')
           OR RIGHT(invoice_number, 2) <> CASE
             WHEN sale_type = 'supplier_proxy' THEN 'HB'
             WHEN sale_type IN ('wholesale', 'peer_transfer') THEN 'PF'
             ELSE 'XS'
           END
           OR invoice_number IN (
             SELECT invoice_number
             FROM (
               SELECT invoice_number
               FROM sales
               WHERE invoice_number REGEXP ?
               GROUP BY invoice_number
               HAVING COUNT(*) > 1
             ) duplicate_invoices
           )
       )
     ) OR invoice_number REGEXP ?
     ORDER BY invoice_number, created_at, id${lockRows ? ' FOR UPDATE' : ''}`,
    [CANONICAL_PATTERN, CANONICAL_PATTERN, LEGACY_INVOICE_PATTERN]
  )
  return buildRepairPlan(
    targetRows,
    invoiceRows.map(row => row.invoice_number)
  )
}

async function countCanonicalDuplicates(db) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT invoice_number
       FROM sales
       WHERE invoice_number REGEXP ?
       GROUP BY invoice_number
       HAVING COUNT(*) > 1
     ) duplicate_invoices`,
    [CANONICAL_PATTERN]
  )
  return Number(rows[0].count)
}

async function countMisalignedCanonicalInvoices(db) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM sales
     WHERE invoice_number REGEXP ?
       AND (
         LEFT(invoice_number, 8) <> DATE_FORMAT(sale_time, '%Y%m%d')
         OR RIGHT(invoice_number, 2) <> CASE
           WHEN sale_type = 'supplier_proxy' THEN 'HB'
           WHEN sale_type IN ('wholesale', 'peer_transfer') THEN 'PF'
           ELSE 'XS'
         END
       )`,
    [CANONICAL_PATTERN]
  )
  return Number(rows[0].count)
}

async function countLegacyInvoices(db) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM sales WHERE invoice_number REGEXP ?`,
    [LEGACY_INVOICE_PATTERN]
  )
  return Number(rows[0].count)
}

function chunkRows(rows, size = 100) {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

async function updateInvoiceNumbers(db, changes) {
  for (const chunk of chunkRows(changes)) {
    const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ')
    const conditions = chunk.map(() => '(id = ? AND invoice_number = ?)').join(' OR ')
    const caseParams = chunk.flatMap(change => [change.id, change.preview_invoice_number])
    const conditionParams = chunk.flatMap(change => [change.id, change.old_invoice_number])
    const [result] = await db.execute(
      `UPDATE sales
       SET invoice_number = CASE id ${cases} ELSE invoice_number END,
           updated_at = updated_at
       WHERE ${conditions}`,
      [...caseParams, ...conditionParams]
    )
    if (Number(result.affectedRows) !== chunk.length) {
      throw new Error(`计划修复 ${chunk.length} 条，实际更新 ${result.affectedRows} 条，停止修复`)
    }
  }
}

async function updateSequenceHighWater(db, changes) {
  const highWaterByKey = new Map()
  for (const change of changes) {
    const match = change.preview_invoice_number.match(/^(\d{8})(\d{4})(XS|PF|HB)$/)
    if (!match) throw new Error(`生成的规范单号无效: ${change.preview_invoice_number}`)
    const key = `${match[1]}:${match[3]}`
    highWaterByKey.set(key, Math.max(highWaterByKey.get(key) || 0, Number(match[2])))
  }
  if (highWaterByKey.size === 0) return
  const rows = [...highWaterByKey].map(([key, sequence]) => {
    const [dateKey, suffix] = key.split(':')
    return [dateKey, suffix, sequence]
  })
  for (const chunk of chunkRows(rows, 500)) {
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ')
    await db.execute(
      `INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, VALUES(current_sequence))`,
      chunk.flat()
    )
  }
}

async function applyRepair(db) {
  await prepareInvoiceNumberTransaction(db)
  await db.beginTransaction()
  try {
    const plan = await readRepairState(db, true)
    await updateInvoiceNumbers(db, plan.changes)
    await updateSequenceHighWater(db, plan.changes)
    const applied = plan.changes.map(change => ({
      id: change.id,
      phone_id: change.phone_id,
      old_invoice_number: change.old_invoice_number,
      new_invoice_number: change.preview_invoice_number,
      sale_time: change.sale_time,
      sale_type: change.sale_type
    }))

    const remainingDuplicates = await countCanonicalDuplicates(db)
    if (remainingDuplicates !== 0) {
      throw new Error(`事务校验仍有 ${remainingDuplicates} 组规范单号重复`)
    }
    const remainingMisaligned = await countMisalignedCanonicalInvoices(db)
    if (remainingMisaligned !== 0) {
      throw new Error(`事务校验仍有 ${remainingMisaligned} 条规范单号日期或后缀不一致`)
    }
    const remainingLegacy = await countLegacyInvoices(db)
    if (remainingLegacy !== 0) {
      throw new Error(`事务校验仍有 ${remainingLegacy} 条旧格式单号`)
    }

    await db.commit()
    return {
      keepers: plan.keepers,
      applied_count: applied.length,
      applied_sample: applied.slice(0, 50),
      applied_omitted: Math.max(applied.length - 50, 0)
    }
  } catch (error) {
    await db.rollback()
    throw error
  }
}

async function main() {
  const db = await createConnection()
  try {
    if (!applyChanges) {
      const plan = await readRepairState(db)
      console.log(JSON.stringify({
        status: plan.changes.length > 0 ? 'dry_run' : 'already_clean',
        database: process.env.DB_NAME,
        canonical_pattern: CANONICAL_PATTERN,
        kept_rows: plan.keepers,
        repair_count: plan.changes.length,
        repair_sample: plan.changes.slice(0, 50),
        repair_omitted: Math.max(plan.changes.length - 50, 0),
        instruction: plan.changes.length > 0
          ? '确认预览后使用 --apply 修复规范单号重复及日期/后缀不一致'
          : null
      }, null, 2))
      return
    }

    const result = await applyRepair(db)
    const verification = await readRepairState(db)
    if (verification.changes.length !== 0) {
      throw new Error('提交后复查仍存在规范单号重复')
    }
    console.log(JSON.stringify({
      status: 'repaired_and_verified',
      database: process.env.DB_NAME,
      kept_rows: result.keepers,
      repaired_count: result.applied_count,
      repaired_sample: result.applied_sample,
      repaired_omitted: result.applied_omitted,
      remaining_duplicate_groups: 0,
      remaining_misaligned_rows: 0,
      remaining_legacy_rows: 0
    }, null, 2))
  } finally {
    await db.end()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({
      status: 'failed',
      code: error.code || 'SALE_INVOICE_DUPLICATE_REPAIR_ERROR',
      message: error.message
    }, null, 2))
    process.exitCode = 1
  })
}

module.exports = {
  buildRepairPlan,
  getSaleDateKey,
  isInvoiceAligned,
  isCanonicalInvoice
}
