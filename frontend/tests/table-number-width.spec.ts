import { describe, expect, it } from 'vitest'
import { getNumberColumnMinWidth } from '@/utils/table-layout'

describe('公共序号和 ID 列宽', () => {
  it('保留页面最小宽度，空列表和缺失值仍有可用宽度', () => {
    expect(getNumberColumnMinWidth([], 80)).toBe(80)
    expect(getNumberColumnMinWidth([null, undefined])).toBeGreaterThanOrEqual(54)
  })

  it('跨页长序号和长 ID 会扩列，避免固定窄列裁切', () => {
    const narrow = getNumberColumnMinWidth([1, 2], 50)
    const longSequence = getNumberColumnMinWidth([99981, 99982], 50)
    const longId = getNumberColumnMinWidth([123456789012], 50)
    expect(longSequence).toBeGreaterThan(narrow)
    expect(longSequence).toBeGreaterThan(64)
    expect(longId).toBeGreaterThan(longSequence)
  })

  it('聚合记录 ID 完整预留宽度，不修改原始值', () => {
    const values = ['123456、234567、345678', '456']
    const before = [...values]
    expect(getNumberColumnMinWidth(values, 90)).toBeGreaterThan(90)
    expect(values).toEqual(before)
  })
})
