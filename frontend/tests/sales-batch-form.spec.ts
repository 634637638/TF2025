import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { reactive } from 'vue'
import SalesBatchForm from '@/views/sales/page/SalesBatchForm.vue'
import type { BatchSaleFormData, BatchSaleItem } from '@/views/sales/types'

const wrappers: ReturnType<typeof mount>[] = []
const viewport = async (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
  await flushPromises()
}
const render = () => {
  const form = reactive<BatchSaleFormData>({
    customer_name: '', customer_phone: '', apple_id: '', sale_price: '12000',
    store_id: '', operator_id: '', sale_time: '2026-11-12', payment_method: 'mobile',
    payment_channel: 'wechat', transaction_no: '', remarks: ''
  })
  const items = reactive<BatchSaleItem[]>([
    { phone_id: 11, imei: '111111111111111', brand: '测试品牌', model: '测试型号', color: '白色', memory: '256GB', purchase_cost: '10000', sale_price: '11000' },
    { phone_id: 12, imei: '222222222222222', brand: '测试品牌', model: '另一型号', color: '黑色', memory: '512GB', purchase_cost: '9000', sale_price: '8000' }
  ])
  const wrapper = mount(SalesBatchForm, {
    props: {
      form, selectedCount: items.length, batchItems: items, selectedCustomer: null,
      customerSearchResults: [], customerSearching: false, showCustomerSearch: false,
      customerCreating: false, customerNameEditing: false, stores: [], operators: [],
      submitting: false, canViewField: () => true, canViewPrice: true,
      isCurrentUser: () => false, totalCost: 19000, totalProfit: 0,
      onUpdateBatchItem: ({ phoneId, field, value }) => {
        const item = items.find(entry => entry.phone_id === phoneId)
        if (item) item[field] = value
      },
      onApplyUnifiedSalePrice: value => items.forEach(item => { item.sale_price = value })
    },
    global: { plugins: [ElementPlus] }
  })
  wrappers.push(wrapper)
  return { wrapper, form, items }
}

afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('批量销售响应式表单', () => {
  it('手机逐台编辑价格和利润联动，切换桌面再回手机保留同一份数据', async () => {
    await viewport(375)
    const { wrapper, items } = render()
    await flushPromises()
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('111111111111111')
    expect(wrapper.get('.batch-item-profit .negative').text()).toBe('¥-1000')
    await wrapper.get('#batch-price-11').setValue('12500')
    await wrapper.get('#batch-price-11').trigger('change')
    await flushPromises()
    expect(items[0].sale_price).toBe('12500')
    expect(wrapper.get('.batch-item-profit').text()).toContain('2500')
    await viewport(1440)
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.find('.el-table').exists()).toBe(true)
    await viewport(375)
    expect(Number(wrapper.get<HTMLInputElement>('#batch-price-11').element.value)).toBe(12500)
  })

  it('真实成本与售价的小数跨手机和 PC 保留，完成编辑不补零', async () => {
    await viewport(375)
    const { wrapper, items } = render()
    items[0].purchase_cost = '200.02'
    items[0].sale_price = '225.20'
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('#batch-cost-11').element.value).toBe('200.02')
    expect(wrapper.get<HTMLInputElement>('#batch-price-11').element.value).toBe('225.2')
    await wrapper.get('#batch-price-11').setValue('225.02')
    await wrapper.get('#batch-price-11').trigger('change')
    await wrapper.get('#batch-price-11').trigger('blur')
    expect(items[0].sale_price).toBe('225.02')
    expect(wrapper.get('.batch-item-profit').text()).toContain('25')
    await viewport(1440)
    expect(wrapper.findAll<HTMLInputElement>('.batch-items-table input').map(input => input.element.value)).toContain('225.02')
    expect(items[0].purchase_cost).toBe('200.02')
  })

  it('手机和桌面沿用相同字段权限，不显示无权查看的成本、售价和利润', async () => {
    await viewport(375)
    const { wrapper } = render()
    await wrapper.setProps({ canViewPrice: false, canViewField: field => !['sale_price', 'purchase_cost'].includes(field) })
    expect(wrapper.find('input[id^="batch-cost-"]').exists()).toBe(false)
    expect(wrapper.find('input[id^="batch-price-"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('单台利润')
    await viewport(1440)
    expect(wrapper.text()).not.toContain('入库价格')
    expect(wrapper.text()).not.toContain('销售价格')
    expect(wrapper.text()).not.toContain('单台利润')
  })

  it('SN 回退值在手机与桌面均以 IMEI 名称展示', async () => {
    await viewport(375)
    const { wrapper, items } = render()
    items[1].imei = 'SN123456789'
    await flushPromises()
    expect(wrapper.text()).toContain('IMEI：SN123456789')
    await viewport(1440)
    expect(wrapper.text()).toContain('IMEI：SN123456789')
  })

  it('统一售价应用至每台设备，备注写入现有表单字段', async () => {
    await viewport(375)
    const { wrapper, form, items } = render()
    await flushPromises()
    const apply = wrapper.findAll('button').find(button => button.text() === '应用')!
    await apply.trigger('click')
    expect(items.map(item => item.sale_price)).toEqual(['12000', '12000'])
    await wrapper.get('textarea[aria-label="备注信息"]').setValue('同一客户，分台销售')
    expect(form.remarks).toBe('同一客户，分台销售')
    form.sale_price = ''
    await flushPromises()
    expect(apply.attributes('disabled')).toBeDefined()
  })

  it('提交等待期间禁用清空、统一价、逐台价格和备注，避免修改待提交数据', async () => {
    await viewport(375)
    const { wrapper } = render()
    await wrapper.setProps({ submitting: true })
    expect(wrapper.get('#batch-price-11').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#batch-cost-11').attributes('disabled')).toBeDefined()
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
  })
})
