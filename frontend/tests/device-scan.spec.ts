import { describe, expect, it } from 'vitest'
import { parseDeviceScanResult } from '@/utils/device-scan-result'
import { normalizeIMEIInput, normalizeSerialNumberInput, validateIMEI, validateSerialNumber } from '@/components/stock-in/helpers'
import { formatQuickSaleIMEI, formatQuickSaleSerialNumber } from '@/components/query/quick-sale/helpers'

describe('手机序列号扫码完整校验', () => {
  it.each(['12中文34', 'ABCD_12', 'A'.repeat(51), 'ABCD\n', 'ABCD--12'])('手工输入保留非法原文供校验，不自动洗白：%s', value => {
    const normalized = normalizeSerialNumberInput(value)
    expect(normalized).toBe(value.toUpperCase())
    expect(validateSerialNumber(normalized)).toBe(false)
    expect(normalizeIMEIInput(value, false)).toBe(value)
    expect(formatQuickSaleIMEI(value, false)).toBe(value)
    expect(formatQuickSaleSerialNumber(value)).toBe(value.toUpperCase())
    expect(validateIMEI(value, value, true)).toBe(false)
  })

  it('数字 IMEI 拒绝字母，合法字母数字序列号正常使用', () => {
    expect(normalizeIMEIInput('0123456a789012345', false)).toBe('0123456a789012345')
    expect(validateIMEI('0123456a789012345', '', false)).toBe(false)
    expect(validateSerialNumber('12abc34')).toBe(true)
    expect(validateIMEI('0001/AB-02', '0001/AB-02', true)).toBe(true)
  })
  it.each(['ABCD1234', '0001/AB-02', 'A'.repeat(50)])('保留完整编码 %s', value => {
    expect(parseDeviceScanResult('serial', `SN: ${value}`)).toEqual({ value, error: null })
  })

  it.each(['A'.repeat(51), 'ABCD中文', 'ABCD_1234', 'ABCD<1234', 'ABCD--1234', 'ABCD/'])('标签不能把非法内容截短为合法编码 %s', value => {
    expect(parseDeviceScanResult('serial', `SN: ${value}`).value).toBeNull()
    expect(parseDeviceScanResult('serial', `(S) SERIAL NO: ${value}`).value).toBeNull()
  })

  it('保留字段提取和明确启用的 Apple 条码前缀行为', () => {
    expect(parseDeviceScanResult('serial', 'SN: abcd1234 IMEI: 490154203237518').value).toBe('ABCD1234')
    expect(parseDeviceScanResult('serial', 'SD2GVGWV67V', { appleSerialBarcode: true }).value).toBe('D2GVGWV67V')
    expect(parseDeviceScanResult('serial', 'SD2GVGWV67V').value).toBe('SD2GVGWV67V')
    expect(parseDeviceScanResult('serial', '0000123456').value).toBeNull()
  })

  it.each(['4901542032375189', '490154203237518 9', '490154203237518-9', '4 490154203237518', '4-490154203237518', '490154203237518中文', '490154203237518A'])('IMEI 不从更长或混入字符的字段截取有效前缀：%s', value => {
    expect(parseDeviceScanResult('imei', value).value).toBeNull()
    expect(parseDeviceScanResult('imei', `IMEI1: ${value}`).value).toBeNull()
  })

  it('IMEI 保留完整格式化条码、标签提取和校验位拦截', () => {
    for (const raw of ['490154203237518', '490154 203237 518', 'IMEI1: 490154203237518\nSN: ABCD1234']) {
      expect(parseDeviceScanResult('imei', raw).value).toBe('490154203237518')
    }
    expect(parseDeviceScanResult('imei', 'IMEI1: 490154203237519').value).toBeNull()
  })
})
