'use strict'

const { isPersonName, isMobilePhone, normalizePhone, isMoneyInput, isSingleLineText } = require('./input-values')
const { isPhoneSerial, isStandardImei } = require('./imei')

/** 申请与编辑的资料边界；在仓储写入、文件移动和缓存失效之前执行。 */
function validateSubsidyInput(source) {
  const input = { ...source }
  const subjects = [input]
  if (input.handler_info !== undefined && input.handler_info !== null) {
    if (typeof input.handler_info !== 'object' || Array.isArray(input.handler_info)) return { error: '办理人资料格式不正确' }
    input.handler_info = { ...input.handler_info }
    subjects.push(input.handler_info)
  }
  for (const subject of subjects) {
    for (const field of ['customer_name', 'handler_name']) {
      if (subject[field] !== undefined && subject[field] !== null && subject[field] !== '' && !isPersonName(subject[field], 50)) {
        return { error: `${field === 'customer_name' ? '客户' : '办理人'}姓名须为最多50字的单行文本` }
      }
    }
    for (const field of ['customer_phone', 'handler_phone']) {
      if (subject[field] === undefined || subject[field] === null || subject[field] === '') continue
      if (!isMobilePhone(subject[field])) return { error: '手机号格式不正确' }
      subject[field] = normalizePhone(subject[field])
    }
    for (const field of ['customer_idcard', 'handler_idcard']) {
      if (subject[field] !== undefined && subject[field] !== null && !isSingleLineText(subject[field], 30)) return { error: '证件须为单行文本' }
    }
  }
  for (const field of ['sale_price', 'subsidy_amount']) {
    if (input[field] === undefined) continue
    if (field === 'sale_price' && (input[field] === '' || input[field] === null)) return { error: '销售价格不能为空' }
    if (!isMoneyInput(input[field]) || Number(input[field]) < 0) return { error: '金额须为大于等于0、最多两位小数的有效数字' }
  }
  if (input.serial_number !== undefined && input.serial_number !== null && input.serial_number !== '') {
    if (typeof input.serial_number !== 'string' || !isPhoneSerial(input.serial_number.toUpperCase())) return { error: '序列号须为4-50位字母、数字、斜杠或连字符' }
    input.serial_number = input.serial_number.toUpperCase()
  }
  for (const field of ['imei1', 'imei2']) {
    const value = input[field]
    if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || !isSingleLineText(value, 15) || !isStandardImei(value))) return { error: 'IMEI须为完整15位数字' }
  }
  return { input }
}

module.exports = { validateSubsidyInput }
