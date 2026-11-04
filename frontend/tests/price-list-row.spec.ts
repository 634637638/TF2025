import { describe, expect, it } from 'vitest'
import type { PriceListRow } from '@/types/price-list'
import { normalizePriceListRow } from '@/views/price-list/price-list-row'

const row: PriceListRow = {
  id: 12,
  brand_name: '品牌',
  model_number: '型号',
  color_name: '黑色',
  memory: '256GB',
  stock_quantity: 1,
  is_collect: 1,
  status: 1,
  show_price: 1
}

describe('价目表列表归一化', () => {
  it('保留后端销售/批发渠道价，不根据入库价或零售价重新计算', () => {
    const input = { ...row, wholesale_price: '5800', retail_price: '6000', sales_display_price: '6220', wholesale_display_price: '5830' }
    expect(normalizePriceListRow(input)).toMatchObject({ wholesale_price: 5800, retail_price: 6000, sales_display_price: 6220, wholesale_display_price: 5830 })
    expect(input.sales_display_price).toBe('6220')
  })

  it('数值和字符串的零价都保留', () => {
    expect(normalizePriceListRow({ ...row, wholesale_price: 0, retail_price: '0', sales_display_price: 0, wholesale_display_price: '0' }))
      .toMatchObject({ wholesale_price: 0, retail_price: 0, sales_display_price: 0, wholesale_display_price: 0 })
  })

  it.each([null, undefined])('渠道价为 %s 时保留空值，不回退为其他渠道价格', value => {
    expect(normalizePriceListRow({ ...row, retail_price: 6000, wholesale_price: 5800, sales_display_price: value, wholesale_display_price: value }))
      .toMatchObject({ retail_price: 6000, wholesale_price: 5800, sales_display_price: null, wholesale_display_price: null })
  })

  it('优先使用价目表主键并保留来源与显式关闭的状态', () => {
    expect(normalizePriceListRow({ ...row, price_list_id: 23, status: 0, is_collect: 0, source_config_id: 8, source_type: 'public', source_name: '公开来源' }))
      .toMatchObject({ id: 23, price_list_id: 23, status: 0, is_collect: 0, source_config_id: 8, source_type: 'public', source_name: '公开来源' })
  })
})
