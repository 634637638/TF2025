import { describe, expect, it } from 'vitest'
import { parseDeviceScanResult } from '@/utils/device-scan-result'
import { isValidAccessorySerial, normalizeAccessorySerial } from '@/utils/accessory-serial'

describe('配件SN扫码与手动录入', () => {
  it.each(['00000123', 's000abc', 'mwvw3ch/01-A_2.3', 'A'.repeat(100)])('配件档位完整保留SN %s', value => {
    const expected = normalizeAccessorySerial(value)
    expect(isValidAccessorySerial(expected)).toBe(true)
    expect(parseDeviceScanResult('serial', value, { serialProfile: 'accessory' })).toEqual({ value: expected, error: null })
  })
  it.each(['', 'AA BB', 'SN:ABC', 'A'.repeat(101), 'ABC\nDEF', '<script>'])('拒绝无效配件SN %s', value => {
    expect(parseDeviceScanResult('serial', value, { serialProfile: 'accessory' }).value).toBeNull()
  })
  it('手机默认档位继续拒绝纯数字SN；苹果配件去除包装S，普通配件保留厂商S前缀', () => {
    expect(parseDeviceScanResult('serial', '000001234567').value).toBeNull()
    expect(parseDeviceScanResult('serial', 'SD2GVGWV67V', { serialProfile: 'accessory', appleSerialBarcode: true }).value).toBe('D2GVGWV67V')
    expect(parseDeviceScanResult('serial', 'SABC123456', { serialProfile: 'accessory', appleSerialBarcode: false }).value).toBe('SABC123456')
  })
  it('苹果配件长条码只去一个字段标识S，保留SN真实首字母和100位上限', () => {
    const options = { serialProfile: 'accessory', appleSerialBarcode: true } as const
    const longSerial = `S${'A'.repeat(99)}`
    expect(parseDeviceScanResult('serial', `s${longSerial.toLowerCase()}`, options).value).toBe(longSerial)
    expect(parseDeviceScanResult('serial', `S${longSerial}A`, options).value).toBeNull()
    expect(parseDeviceScanResult('serial', 'S00001234567-89', options).value).toBe('S00001234567-89')
    expect(parseDeviceScanResult('serial', longSerial, { serialProfile: 'accessory' }).value).toBe(longSerial)
    expect(parseDeviceScanResult('serial', 'SABC0123456789', { appleSerialBarcode: true }).value).toBe('SABC0123456789')
  })
})


describe('收银商品条码扫码', () => {
  it.each(['00000123', '00ab:+12', 'Sabc001', 'AbC 01', 'A'.repeat(100)])('保留完整商品编码，不套用手机/SN大小写和前缀规则：%s', value => {
    expect(parseDeviceScanResult('serial', value, { serialProfile: 'product', appleSerialBarcode: true })).toEqual({ value, error: null })
  })
  it.each(['', '中文条码', 'ＡＢ１２', 'ABC\nDEF', 'A'.repeat(101)])('拒绝非法或超长商品编码且不截断后识别：%s', value => {
    expect(parseDeviceScanResult('serial', value, { serialProfile: 'product' }).value).toBeNull()
  })
})
