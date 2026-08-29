const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024
const MAX_SPREADSHEET_ROWS = 50000
const MAX_SPREADSHEET_COLUMNS = 200
const ALLOWED_EXTENSIONS = new Set(['.xls', '.xlsx'])
const SAFE_READ_OPTIONS = Object.freeze({
  cellFormula: false,
  cellHTML: false,
  cellNF: false,
  cellStyles: false,
  bookVBA: false,
  WTF: false
})

function createSpreadsheetError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function assertWithinRoot(filePath, rootPath) {
  let resolvedRoot
  let resolvedFile
  try {
    resolvedRoot = fs.realpathSync(path.resolve(rootPath))
    resolvedFile = fs.realpathSync(path.resolve(filePath))
  } catch {
    throw createSpreadsheetError('Excel 文件不存在或不可访问')
  }
  const relativePath = path.relative(resolvedRoot, resolvedFile)

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw createSpreadsheetError('Excel 文件路径不在允许的上传目录内')
  }

  return resolvedFile
}

function validateSpreadsheetFile(filePath, options = {}) {
  const { rootPath, maxBytes = MAX_SPREADSHEET_BYTES } = options

  if (typeof filePath !== 'string' || !filePath.trim() || !rootPath) {
    throw createSpreadsheetError('Excel 文件路径无效')
  }

  const resolvedFile = assertWithinRoot(filePath, rootPath)
  if (!ALLOWED_EXTENSIONS.has(path.extname(resolvedFile).toLowerCase())) {
    throw createSpreadsheetError('只支持 .xls 或 .xlsx 文件')
  }

  const stats = fs.statSync(resolvedFile)
  if (!stats.isFile() || stats.size <= 0 || stats.size > maxBytes) {
    throw createSpreadsheetError(`Excel 文件大小必须在 1 字节到 ${Math.floor(maxBytes / 1024 / 1024)}MB 之间`)
  }

  return resolvedFile
}

function validateSpreadsheetBuffer(buffer, maxBytes = MAX_SPREADSHEET_BYTES) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0 || buffer.length > maxBytes) {
    throw createSpreadsheetError(`Excel 文件大小必须在 1 字节到 ${Math.floor(maxBytes / 1024 / 1024)}MB 之间`)
  }

  const isZipContainer = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  const isOleContainer = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  if (!isZipContainer && !isOleContainer) {
    throw createSpreadsheetError('Excel 文件内容与格式不匹配')
  }
}

function readSpreadsheetFileSafe(filePath, options = {}) {
  const buffer = fs.readFileSync(filePath)
  validateSpreadsheetBuffer(buffer)
  return XLSX.read(buffer, { ...options, ...SAFE_READ_OPTIONS, type: 'buffer' })
}

function readSpreadsheetBufferSafe(buffer, options = {}) {
  validateSpreadsheetBuffer(buffer)
  return XLSX.read(buffer, { ...options, ...SAFE_READ_OPTIONS, type: 'buffer' })
}

function sheetToJsonSafe(worksheet, options = {}) {
  const {
    maxRows = MAX_SPREADSHEET_ROWS,
    maxColumns = MAX_SPREADSHEET_COLUMNS,
    ...sheetOptions
  } = options

  if (!worksheet || !worksheet['!ref']) {
    return []
  }

  let range
  try {
    range = XLSX.utils.decode_range(worksheet['!ref'])
  } catch {
    throw createSpreadsheetError('Excel 工作表范围无效')
  }
  const rowCount = range.e.r - range.s.r + 1
  const columnCount = range.e.c - range.s.c + 1

  if (rowCount > maxRows + 1) {
    throw createSpreadsheetError(`Excel 数据行数不能超过 ${maxRows} 行`)
  }
  if (columnCount > maxColumns) {
    throw createSpreadsheetError(`Excel 列数不能超过 ${maxColumns} 列`)
  }

  return XLSX.utils.sheet_to_json(worksheet, sheetOptions)
}

module.exports = {
  MAX_SPREADSHEET_BYTES,
  validateSpreadsheetBuffer,
  validateSpreadsheetFile,
  readSpreadsheetBufferSafe,
  readSpreadsheetFileSafe,
  sheetToJsonSafe
}
