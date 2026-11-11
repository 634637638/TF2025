import { describe, expect, it } from 'vitest'
import { getMemoryBadgeClass } from '@/views/sales/inventory-formatters'

describe('销售对库内存规格', () => {
  it('同一容量的纯数字、GB 和组合规格采用相同分级', () => {
    const expected = getMemoryBadgeClass('256')
    for (const memory of ['256GB', ' 256 gb ', '8+256GB', '8GB + 256GB']) {
      expect(getMemoryBadgeClass(memory)).toBe(expected)
    }
    expect(getMemoryBadgeClass('8+256GB')).not.toBe(getMemoryBadgeClass('8'))
  })

  it('TB 换算后与等值 GB 分级一致', () => {
    expect(getMemoryBadgeClass('1TB')).toBe(getMemoryBadgeClass('1024GB'))
    expect(getMemoryBadgeClass('2 tb')).toBe(getMemoryBadgeClass('2048'))
    expect(getMemoryBadgeClass('0.5TB')).toBe(getMemoryBadgeClass('512GB'))
    expect(getMemoryBadgeClass('1TB')).not.toBe(getMemoryBadgeClass('1GB'))
  })

  it('缺失和非法规格保持中性，不根据部分数字误判', () => {
    for (const memory of [undefined, '', ' ', '未知', '0GB', '-128GB', '256MB', '128GB未知']) {
      expect(getMemoryBadgeClass(memory)).toBe('memory-other')
    }
  })
})
