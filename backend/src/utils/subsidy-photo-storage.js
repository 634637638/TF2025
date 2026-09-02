const path = require('path')

function sanitizeSubsidyPart(value, fallback) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '')

  return sanitized || fallback
}

function normalizeSubsidyDate(value) {
  const match = String(value || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!match) {
    return ''
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function getSubsidyPhotoNaming(input = {}) {
  const customerName = input.customerName ?? input.customer_name
  const handlerName = input.handlerName ?? input.handler_name
  const hasDifferentHandler = input.hasDifferentHandler ?? input.has_different_handler
  const serialNumber = input.serialNumber ?? input.serial_number
  const isNew = input.isNew ?? input.is_new
  const inventoryTime = input.inventoryTime ?? input.inventory_time
  const safeSerialNumber = sanitizeSubsidyPart(serialNumber, 'unknown')

  if (Number(isNew) === 0) {
    const inventoryDate = normalizeSubsidyDate(inventoryTime) || 'unknown'
    return {
      directoryName: `${safeSerialNumber}-${inventoryDate}`,
      displayName: safeSerialNumber,
      serialNumber: safeSerialNumber,
      isSecondHand: true
    }
  }

  const displayName = hasDifferentHandler && String(handlerName || '').trim()
    ? handlerName
    : customerName
  const safeDisplayName = sanitizeSubsidyPart(
    displayName,
    hasDifferentHandler ? '未知代办人' : '未知客户'
  )

  return {
    directoryName: `${safeDisplayName}${safeSerialNumber}`,
    displayName: safeDisplayName,
    serialNumber: safeSerialNumber,
    isSecondHand: false
  }
}

function encodeSubsidyPhotoUrl(relativePath, protectedAccess = false) {
  const encodedPath = relativePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  return protectedAccess
    ? `/api/subsidy/files/${encodedPath}`
    : `/uploads/${encodedPath}`
}

function getSubsidyPhotoExtension(filename) {
  return path.extname(String(filename || '')).toLowerCase()
}

module.exports = {
  sanitizeSubsidyPart,
  normalizeSubsidyDate,
  getSubsidyPhotoNaming,
  encodeSubsidyPhotoUrl,
  getSubsidyPhotoExtension
}
