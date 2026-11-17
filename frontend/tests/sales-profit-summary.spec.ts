import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SalesProfitSummary from '@/views/sales/page/SalesProfitSummary.vue'

describe('SalesProfitSummary', () => {
  it('同时汇总手机、收费商品和赠送商品的成本与利润', () => {
    const wrapper = mount(SalesProfitSummary, {
      props: {
        lines: [
          { key: 'phone:1', type: 'phone', name: '手机 PD-L', quantity: 1, purchase_cost: 5999, sale_price: 6000 },
          { key: 'goods:1', type: 'goods', name: '数据线', quantity: 2, purchase_cost: 20, sale_price: 30, sale_type: 'sale' },
          { key: 'goods:2', type: 'goods', name: '保护壳', quantity: 1, purchase_cost: 15, sale_price: 0, sale_type: 'gift' }
        ]
      }
    })

    expect(wrapper.text()).toContain('手机 PD-L')
    expect(wrapper.text()).toContain('数据线')
    expect(wrapper.text()).toContain('赠送')
    expect(wrapper.text()).toContain('总成本 ¥6054')
    expect(wrapper.text()).toContain('总销售 ¥6060')
    expect(wrapper.text()).toContain('总利润 ¥6')
    expect(wrapper.text()).toContain('利润率 0.1%')
  })

  it('商品成本不可见时不伪造利润', () => {
    const wrapper = mount(SalesProfitSummary, {
      props: { lines: [{ key: 'goods:1', type: 'goods', name: '数据线', quantity: 1, purchase_cost: null, sale_price: 30, sale_type: 'sale' }] }
    })
    expect(wrapper.text()).toContain('总利润 待核对')
    expect(wrapper.text()).toContain('结算时按实际入库批次核算利润')
  })
})
