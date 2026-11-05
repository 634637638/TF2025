import { describe, expect, it } from 'vitest'
import { getCities, getDistricts, getProvinceName, joinCustomerAddress, normalizeRegion, provinces, splitCustomerAddress } from '@/services/region-options'

describe('公共地区选项与客户地址存储契约', () => {
  it('包含 34 个省级单位，港澳台均有可下钻的地区选项', () => {
    expect(provinces).toHaveLength(34)
    expect(new Set(provinces.map(option => option.code)).size).toBe(34)
    for (const province of provinces) {
      expect(getCities(province.code).length).toBeGreaterThan(0)
    }
    for (const province of ['71', '81', '82']) {
      expect(getCities(province).some(city => getDistricts(province, city.name).length > 0)).toBe(true)
    }
  })

  it('广东城市没有重复项，编码能定位正确城市，县区不会跨城市混入', () => {
    const cities = getCities('广东省')
    expect(cities).toHaveLength(21)
    expect(new Set(cities.map(city => city.name)).size).toBe(cities.length)
    expect(normalizeRegion({ province: '440000', city: '440200', district: '' })).toEqual({ province: '44', city: '韶关市', district: '' })
    expect(getDistricts('44', '深圳市').some(district => district.name === '南山区')).toBe(true)
    expect(getDistricts('44', '广州市').some(district => district.name === '南山区')).toBe(false)
    expect(getDistricts('unknown', '深圳市')).toEqual([])
    expect(getDistricts('44', '')).toEqual([])
  })

  it('直辖市显示市与县区，旧版 city 中的县区名称可以回显', () => {
    expect(normalizeRegion({ province: '北京市', city: '东城区', district: '' }))
      .toEqual({ province: '11', city: '北京市', district: '东城区' })
    expect(getProvinceName('81')).toBe('香港特别行政区')
    expect(normalizeRegion({ province: '未登记省', city: '旧城市', district: '' }))
      .toEqual({ province: '未登记省', city: '旧城市', district: '' })
  })

  it('县区保存到现有 address，重新打开可回显，清空或更改县区不丢详细地址', () => {
    const region = { province: '44', city: '深圳市', district: '南山区' }
    const stored = joinCustomerAddress(region.district, '某街道 某村 1号')
    const reopened = splitCustomerAddress(region, stored)
    expect(stored).toBe('南山区 某街道 某村 1号')
    expect(reopened).toEqual({ district: '南山区', detail: '某街道 某村 1号' })
    expect(joinCustomerAddress('', reopened.detail)).toBe('某街道 某村 1号')
    expect(joinCustomerAddress('福田区', reopened.detail)).toBe('福田区 某街道 某村 1号')
    expect(splitCustomerAddress(region, '南山区')).toEqual({ district: '南山区', detail: '' })
  })

  it('无法明确拆分的历史地址原样保留，不猜测或删除地址文本', () => {
    const region = { province: '44', city: '深圳市', district: '' }
    for (const address of ['', '南山区街道1号', '广东省深圳市南山区1号', '未登记县 某村 1号', '  老地址\n第二行']) {
      const split = splitCustomerAddress(region, address)
      expect(joinCustomerAddress(split.district, split.detail)).toBe(address)
    }
  })
})
