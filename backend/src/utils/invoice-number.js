/**
 * 生成单据编号 (Invoice Number)
 * 规则: 日期 + 序列号后4位 + 类型
 * 格式: YYYYMMDD + 序号后4位 + 类型代码
 * 例如: 20260207001XS (2026年2月7日，序号...001，零售)
 *       20260207002DH (2026年2月7日，序号...002，调货)
 *       20260207003HB (2026年2月7日，序号...003，划拨)
 *
 * @param {string} saleType - 销售类型: 'retail'(零售/默认), 'peer_transfer'(调货), 'supplier_proxy'(供应商划拨)
 * @param {object} connection - 数据库连接 (用于获取序列号)
 * @param {Date|string} saleDate - 销售日期 (可选，默认使用当前时间)
 * @returns {Promise<string>} 单据编号
 */
let sequenceTableReady

const ensureSequenceTable = async (connection) => {
  if (!sequenceTableReady) {
    sequenceTableReady = connection.execute(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        sequence_date CHAR(8) NOT NULL,
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

async function generateInvoiceNumber(saleType = 'retail', connection, saleDate) {
  if (!connection) {
    throw new Error('生成单据编号需要数据库连接')
  }
  // 如果没有提供销售日期，使用当前时间（向后兼容）
  const dateObj = saleDate ? (saleDate instanceof Date ? saleDate : new Date(saleDate)) : new Date()
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`

  // 根据销售类型确定后缀
  const typeSuffixMap = {
    'retail': 'XS',           // 零售
    'peer_transfer': 'DH',    // 调货
    'supplier_proxy': 'HB',   // 供应商划拨
    'batch_item': 'XS',       // 批量销售项
    'wholesale': 'PF'         // 批发
  }
  const typeSuffix = typeSuffixMap[saleType] || 'XS'

  await ensureSequenceTable(connection)
  const prefixPattern = `${dateStr}%${typeSuffix}`

  // 首次使用时从历史销售记录读取最大序号。初始化和递增分开执行，避免
  // INSERT ... SELECT 在并发首次写入同一主键时产生死锁。
  const [[historyRow]] = await connection.execute(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, 9, 4) AS UNSIGNED)), 0) AS sequence
     FROM sales WHERE invoice_number LIKE ?`,
    [prefixPattern]
  )
  const historySequence = Number(historyRow?.sequence) || 0
  await connection.execute(
    `INSERT INTO invoice_sequences (sequence_date, type_suffix, current_sequence)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE current_sequence = GREATEST(current_sequence, VALUES(current_sequence))`,
    [dateStr, typeSuffix, historySequence]
  )
  await connection.execute(
    `UPDATE invoice_sequences
     SET current_sequence = LAST_INSERT_ID(current_sequence + 1)
     WHERE sequence_date = ? AND type_suffix = ?`,
    [dateStr, typeSuffix]
  )
  const [[sequenceRow]] = await connection.execute('SELECT LAST_INSERT_ID() AS sequence')
  const sequence = Number(sequenceRow?.sequence)
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error('生成单据序号失败')
  }

  return `${dateStr}${String(sequence).padStart(4, '0')}${typeSuffix}`
}

/**
 * 生成指定日期的单据编号 (用于批量导入等场景)
 * @param {Date|string} date - 指定日期
 * @param {number} sequence - 序列号
 * @param {string} saleType - 销售类型
 * @returns {string} 单据编号
 */
function generateInvoiceNumberForDate(date, sequence, saleType = 'retail') {
  const targetDate = date instanceof Date ? date : new Date(date)
  const year = targetDate.getFullYear()
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`

  const typeSuffixMap = {
    'retail': 'XS',
    'peer_transfer': 'DH',
    'supplier_proxy': 'HB',
    'batch_item': 'XS',
    'wholesale': 'PF'
  }
  const typeSuffix = typeSuffixMap[saleType] || 'XS'

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
  generateInvoiceNumber,
  generateInvoiceNumberForDate,
  parseInvoiceNumber
}
