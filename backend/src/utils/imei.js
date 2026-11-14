const { isSingleLineText, isEmptyInput } = require('./input-values')
const inputPatterns = require('../config/input-validation.json')
const serialPattern = new RegExp(inputPatterns.phoneSerial)
const imeiPattern = new RegExp(inputPatterns.imei)
const normalizeImei = (value) => String(value || '').trim().toUpperCase()

const isPhoneSerial = value => typeof value === 'string' && serialPattern.test(value)

const isStandardImei = (value) => imeiPattern.test(normalizeImei(value))

const isNoImeiDevice = (imei, serialNumber) => {
  const normalizedImei = normalizeImei(imei)
  const normalizedSerialNumber = normalizeImei(serialNumber)
  return isSingleLineText(imei) && isSingleLineText(serialNumber)
    && normalizedImei === normalizedSerialNumber && isPhoneSerial(normalizedSerialNumber)
}

const validateImei = (imei, serialNumber) => {
  const normalizedImei = normalizeImei(imei)
  const normalizedSerialNumber = normalizeImei(serialNumber)

  if (!isSingleLineText(imei) || (!isEmptyInput(serialNumber)
    && (!isSingleLineText(serialNumber) || !isPhoneSerial(normalizedSerialNumber)))) {
    return { valid: false, normalizedImei, normalizedSerialNumber, reason: '设备编码格式不正确，序列号须为4-50位字母、数字、斜杠或连字符' }
  }

  if (!normalizedImei) {
    return { valid: false, normalizedImei, normalizedSerialNumber, reason: 'IMEI不能为空' }
  }

  if (isStandardImei(normalizedImei) || isNoImeiDevice(normalizedImei, normalizedSerialNumber)) {
    return { valid: true, normalizedImei, normalizedSerialNumber, isStandardImei: isStandardImei(normalizedImei) }
  }

  return {
    valid: false,
    normalizedImei,
    normalizedSerialNumber,
    reason: 'IMEI必须为15位纯数字，或与序列号相同（无IMEI设备）'
  }
}

module.exports = {
  normalizeImei,
  isPhoneSerial,
  isStandardImei,
  isNoImeiDevice,
  validateImei
}
