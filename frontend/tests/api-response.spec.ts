import { describe, expect, it } from 'vitest'
import { extractResponseData } from '@/utils/api-response'

describe('公共 API 数据提取', () => {
  const stores = [{ id: 1, name: '门店 A' }, { id: '2', name: '门店 B' }]
  const suppliers = [{ id: 3, name: '供应商 A' }]

  it.each([
    ['直接数组', stores],
    ['标准响应', { success: true, message: '', data: stores }],
    ['单层 data', { data: stores }],
    ['双层 data', { data: { success: true, data: stores } }],
    ['门店包装', { data: { stores } }]
  ])('%s 保留门店内容与 ID 类型', (_, response) => {
    const result = extractResponseData<typeof stores>(response)
    expect(result).toEqual(stores)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe('2')
  })

  it('供应商标准响应复用相同入口', () => {
    expect(extractResponseData<typeof suppliers>({ success: true, data: suppliers })).toEqual(suppliers)
  })

  it.each([undefined, null])('空响应 %s 返回空列表', response => {
    expect(extractResponseData(response)).toEqual([])
  })

  it('泛型不会验证或改变真实数据，非数组仍需调用方判断', () => {
    const data = { total: 2 }
    const result = extractResponseData<typeof stores>({ data })
    expect(Array.isArray(result)).toBe(false)
    expect(result).toEqual(data)
  })
})
