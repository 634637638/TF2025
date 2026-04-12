/**
 * 数据生成工具
 * 用于生成IMEI号、序列号、订单号等
 */
import { TimeUtil } from './time'

/**
 * 生成IMEI号
 * @returns 15位IMEI号
 */
export const generateIMEI = (): string => {
  // IMEI格式：15位数字，前14位是设备标识，最后1位是校验位
  let imei = ''

  // 生成前14位
  for (let i = 0; i < 14; i++) {
    if (i === 0) {
      // 第一位：报告类型，通常为0-3
      imei += Math.floor(Math.random() * 4).toString()
    } else if (i === 1) {
      // 第二位：报告版本，通常为0
      imei += '0'
    } else {
      // 其他位：设备标识
      imei += Math.floor(Math.random() * 10).toString()
    }
  }

  // 计算Luhn校验位
  let sum = 0
  let double = false

  for (let i = imei.length - 1; i >= 0; i--) {
    let digit = parseInt(imei[i])

    if (double) {
      digit *= 2
      if (digit > 9) {
        digit = digit - 9
      }
    }

    sum += digit
    double = !double
  }

  const checkDigit = (10 - (sum % 10)) % 10
  imei += checkDigit.toString()

  return imei
}

/**
 * 生成序列号
 * @param prefix 前缀，默认为'SN'
 * @param length 序列号长度，默认为12
 * @returns 序列号
 */
export const generateSerialNumber = (prefix: string = 'SN', length: number = 12): string => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()

  let serial = prefix
  serial += timestamp.slice(-6)
  serial += random.slice(0, length - prefix.length - 6)

  return serial.padEnd(length, '0').substring(0, length)
}

/**
 * 生成订单号
 * @param prefix 前缀，默认为'PO'(Purchase Order)
 * @returns 订单号
 */
export const generateOrderNumber = (prefix: string = 'PO'): string => {
  const now = TimeUtil.now()
  const year = now.format('YY')
  const month = now.format('MM')
  const day = now.format('DD')

  const time = now.valueOf().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

  return `${prefix}${year}${month}${day}${time}${random}`
}

/**
 * 生成会员编号
 * @param prefix 前缀，默认为'M'
 * @returns 会员编号
 */
export const generateMemberNumber = (prefix: string = 'M'): string => {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

  return `${prefix}${timestamp}${random}`
}

/**
 * 生成入库单号
 * @param prefix 前缀，默认为'SI'(Stock In)
 * @returns 入库单号
 */
export const generateStockInNumber = (prefix: string = 'SI'): string => {
  const now = TimeUtil.now()
  const year = now.year()
  const month = now.format('MM')
  const day = now.format('DD')

  const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0')

  return `${prefix}${year}${month}${day}${sequence}`
}

/**
 * 生成出库单号
 * @param prefix 前缀，默认为'SO'(Stock Out)
 * @returns 出库单号
 */
export const generateStockOutNumber = (prefix: string = 'SO'): string => {
  const now = TimeUtil.now()
  const year = now.year()
  const month = now.format('MM')
  const day = now.format('DD')

  const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0')

  return `${prefix}${year}${month}${day}${sequence}`
}

/**
 * 生成调整单号
 * @param prefix 前缀，默认为'AD'(Adjustment)
 * @returns 调整单号
 */
export const generateAdjustNumber = (prefix: string = 'AD'): string => {
  const now = TimeUtil.now()
  const year = now.year()
  const month = now.format('MM')
  const day = now.format('DD')

  const sequence = Math.floor(Math.random() * 999999).toString().padStart(6, '0')

  return `${prefix}${year}${month}${day}${sequence}`
}

/**
 * 验证IMEI号格式
 * @param imei IMEI号
 * @returns 是否有效
 */
export const validateIMEI = (imei: string): boolean => {
  // 检查长度
  if (!/^\d{15}$/.test(imei)) {
    return false
  }

  // 检查Luhn算法
  let sum = 0
  let double = false

  for (let i = imei.length - 2; i >= 0; i--) {
    let digit = parseInt(imei[i])

    if (double) {
      digit *= 2
      if (digit > 9) {
        digit = digit - 9
      }
    }

    sum += digit
    double = !double
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10
  const actualCheckDigit = parseInt(imei[14])

  return expectedCheckDigit === actualCheckDigit
}

/**
 * 生成唯一ID
 * @param prefix 前缀
 * @param length ID总长度
 * @returns 唯一ID
 */
export const generateUniqueId = (prefix: string = '', length: number = 16): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)

  let id = prefix
  id += timestamp
  id += random

  return id.substring(0, length).toUpperCase()
}

/**
 * 生成颜色代码
 * @returns 6位十六进制颜色代码
 */
export const generateColorCode = (): string => {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
}

/**
 * 生成验证码
 * @param length 验证码长度，默认为6
 * @param type 验证码类型：'number' | 'alpha' | 'mixed'
 * @returns 验证码
 */
export const generateCaptcha = (
  length: number = 6,
  type: 'number' | 'alpha' | 'mixed' = 'mixed'
): string => {
  let chars = ''

  switch (type) {
    case 'number':
      chars = '0123456789'
      break
    case 'alpha':
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      break
    case 'mixed':
      chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      break
  }

  let captcha = ''
  for (let i = 0; i < length; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return captcha
}

/**
 * 生成临时文件名
 * @param extension 文件扩展名
 * @param prefix 文件名前缀
 * @returns 临时文件名
 */
export const generateTempFileName = (
  extension: string = '',
  prefix: string = 'temp'
): string => {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')

  let filename = `${prefix}_${timestamp}_${random}`

  if (extension) {
    filename += extension.startsWith('.') ? extension : `.${extension}`
  }

  return filename
}

/**
 * 生成批次号
 * @param prefix 批次号前缀，默认为'BAT'
 * @returns 批次号
 */
export const generateBatchNumber = (prefix: string = 'BAT'): string => {
  const now = TimeUtil.now()
  const year = now.year()
  const month = now.format('MM')
  const day = now.format('DD')

  const time = now.valueOf().toString().slice(-8)

  return `${prefix}${year}${month}${day}${time}`
}

/**
 * 生成二维码内容
 * @param data 要编码的数据
 * @returns 二维码内容字符串
 */
export const generateQRContent = (data: Record<string, any>): string => {
  return JSON.stringify({
    ...data,
    timestamp: Date.now(),
    version: '1.0'
  })
}

export default {
  generateIMEI,
  generateSerialNumber,
  generateOrderNumber,
  generateMemberNumber,
  generateStockInNumber,
  generateStockOutNumber,
  generateAdjustNumber,
  validateIMEI,
  generateUniqueId,
  generateColorCode,
  generateCaptcha,
  generateTempFileName,
  generateBatchNumber,
  generateQRContent
}