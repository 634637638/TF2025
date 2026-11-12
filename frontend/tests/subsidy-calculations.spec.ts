import { describe, expect, it } from 'vitest'
import { buildSubsidyRemarks, calculateSubsidyAmount } from '@/views/subsidy/subsidy-calculations'

describe('国补金额与自动备注', () => {
  it.each([[200.1, 30.02], [225.02, 33.75], [3333.3, 500], [6000, 500], [6000.01, 0], [0, 0]])(
    '售价 %s 按分四舍五入且遵守补贴上限', (price, expected) => {
      expect(calculateSubsidyAmount(price)).toBe(expected)
    }
  )

  it('备注消除浮点尾差，刷卡金额与补贴金额之和等于售价', () => {
    const remarks = buildSubsidyRemarks({ sale_price: 200.1, subsidy_amount: 30.014999999999997 })
    expect(remarks).toContain('商品售价：200.1元 国补优惠30.02元 实际刷卡支付170.08元')
  })

  it('整数不补零，真实小数保留，显式零补贴不按缺失处理', () => {
    expect(buildSubsidyRemarks({ sale_price: 200 })).toContain('商品售价：200元 国补优惠30元 实际刷卡支付170元')
    expect(buildSubsidyRemarks({ sale_price: '225.02', subsidy_amount: 0 })).toContain('国补优惠0元 实际刷卡支付225.02元')
  })

  it('保留已有备注与售价资格判断，缺省计算沿用补贴比例', () => {
    expect(buildSubsidyRemarks({ remarks: '人工备注', sale_price: 200.1 })).toBe('人工备注')
    expect(buildSubsidyRemarks({ sale_price: 6000.01 })).toBe('商品售价6000.01元（超过6000元，无法享受国补优惠）')
    expect(buildSubsidyRemarks({ sale_price: 200, subsidy_rate: 10 })).toContain('国补优惠20元 实际刷卡支付180元')
    expect(buildSubsidyRemarks({ sale_price: null })).toBe('')
  })
})
