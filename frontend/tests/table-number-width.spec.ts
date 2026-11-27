import { describe, expect, it } from 'vitest'
import { getNumberColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'

describe('公共内容驱动列最小宽度', () => {
  it('按表头和当前页最长值计算，二者较长者决定宽度', () => {
    const headerDriven = getTextColumnMinWidth(['设备型号', 'iPhone'], {
      minWidth: 0,
      horizontalPadding: 20
    })
    const valueDriven = getTextColumnMinWidth(['型号', 'iPhone 18 Pro Max'], {
      minWidth: 0,
      horizontalPadding: 20
    })

    expect(headerDriven).toBe(72)
    expect(valueDriven).toBe(156)
  })

  it('按中英文混排估算内容，并为空值预留展示占位符', () => {
    expect(getTextColumnMinWidth(['A机型B'], {
      minWidth: 0,
      horizontalPadding: 20
    })).toBe(62)
    expect(getTextColumnMinWidth([null, undefined], {
      minWidth: 0,
      horizontalPadding: 20
    })).toBe(28)
  })

  it('将真实水平留白计入安全宽度并应用最大宽度限制', () => {
    expect(getTextColumnMinWidth(['AB'], {
      minWidth: 0,
      horizontalPadding: 32
    })).toBe(48)
    expect(getTextColumnMinWidth(['一二三四五六七'], {
      minWidth: 0,
      maxWidth: 100,
      horizontalPadding: 24
    })).toBe(100)
  })
})

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
