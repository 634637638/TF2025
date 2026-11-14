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
  it('手机默认档位继续拒绝纯数字SN；配件不删除厂商S前缀', () => {
    expect(parseDeviceScanResult('serial', '000001234567').value).toBeNull()
    expect(parseDeviceScanResult('serial', 'SABC123456', { serialProfile: 'accessory', appleSerialBarcode: true }).value).toBe('SABC123456')
  })
})
