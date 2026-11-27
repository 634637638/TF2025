import { isEmptyInput, isMoneyInput, isValidMobilePhone, isValidPersonName, isValidSingleLineText } from '@/utils/security'
import { isDeviceIMEI, isDeviceSerial, isNoIMEIDeviceIdentifier, normalizeDeviceSerial } from '@/utils/device-identifier'

/** 仅校验实际提交的字段；隐藏或只读字段不参与编辑请求。 */
export function getSubsidyInputError(input: Record<string, unknown>): string | undefined {
  const subjects = [input]
  if (input.handler_info !== undefined && input.handler_info !== null) {
    if (typeof input.handler_info !== 'object' || Array.isArray(input.handler_info)) return '办理人资料格式不正确'
    subjects.push(input.handler_info as Record<string, unknown>)
  }
  for (const subject of subjects) {
    for (const field of ['customer_name', 'handler_name']) {
      if (!isEmptyInput(subject[field]) && !isValidPersonName(subject[field], 50)) return '姓名须为最多50字的单行文本'
    }
    for (const field of ['customer_phone', 'handler_phone']) {
      const value = subject[field]
      if (!isEmptyInput(value) && (typeof value !== 'string' || !isValidMobilePhone(value))) return '请输入正确的手机号'
    }
    for (const field of ['customer_idcard', 'handler_idcard']) {
      if (!isEmptyInput(subject[field]) && !isValidSingleLineText(subject[field], 30)) return '证件须为最多30字的单行文本'
    }
  }
  for (const field of ['sale_price', 'subsidy_amount']) {
    if (input[field] !== undefined && (!isMoneyInput(input[field]) || Number(input[field]) < 0)) return '金额须为大于等于0、最多两位小数的有效数字'
  }
  const serial = input.serial_number
  if (Object.prototype.hasOwnProperty.call(input, 'serial_number') && (isEmptyInput(serial) || (typeof serial === 'string' && !serial.trim()))) return '请输入序列号'
  if (!isEmptyInput(serial) && (typeof serial !== 'string' || !isDeviceSerial(normalizeDeviceSerial(serial.trim())))) return '序列号须为4-50位字母、数字、斜杠或连字符'
  for (const field of ['imei1', 'imei2']) {
    if (!isEmptyInput(input[field]) && !isDeviceIMEI(input[field]) && !(field === 'imei1' && isNoIMEIDeviceIdentifier(input[field], serial))) return 'IMEI须为完整15位数字'
  }
}
