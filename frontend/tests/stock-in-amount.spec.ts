import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import DataEmptyState from '@/components/DataEmptyState.vue'
import { getNumberColumnMinWidth } from '@/utils/table-layout'
import StockInPhoneListSection from '@/components/stock-in/StockInPhoneListSection.vue'
import { createCreateModeStockInForm } from '@/components/stock-in/helpers'
import type { StockInPhoneItem } from '@/components/stock-in/types'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('采购入库金额输入', () => {
  it.each([true, false])('手机分支 %s 保留逐字输入的小数，成本回填不补零', async isMobile => {
    const formData = reactive(createCreateModeStockInForm({ operatorName: '测试销售员' }))
    formData.phones[0].purchase_cost = 225
    const wrapper = mount(StockInPhoneListSection, {
      props: {
        isMobile, cacheVersion: 0, formData, hasRowError: () => false,
        getFilteredBrandsForPhone: () => [], getFilteredModelsForPhone: () => [],
        getFilteredColorsForPhone: () => [], getFilteredMemoriesForPhone: () => [],
        handleBrandFilter: () => true, handleModelFilter: () => true,
        handleColorFilter: () => true, handleMemoryFilter: () => true,
        handleBrandChange: vi.fn(), formatSerialNumber: vi.fn(), formatImei: vi.fn(),
        updatePurchasePrice: (phone: StockInPhoneItem, value: number | null | undefined) => { phone.purchase_cost = value ?? undefined },
        removePhone: vi.fn(), validateSerialOnBlur: vi.fn(), validateImeiOnBlur: vi.fn(),
        scanSerialNumber: vi.fn(), scanImei: vi.fn(), enableNoImeiMode: vi.fn()
      },
      global: { plugins: [ElementPlus], components: { DataEmptyState }, config: { globalProperties: { $getNumberColumnWidth: getNumberColumnMinWidth } } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    const input = wrapper.get<HTMLInputElement>(`input[placeholder="${isMobile ? '请输入入库价格' : '价格'}"]`)
    expect(input.element.value).toBe('225')
    for (const value of ['225.0', '225.02']) {
      input.element.value = value
      await input.trigger('input')
      await flushPromises()
    }
    await input.trigger('change')
    await input.trigger('blur')
    expect(formData.phones[0].purchase_cost).toBe(225.02)
    expect(input.element.value).toBe('225.02')
    formData.phones[0].purchase_cost = 225.2
    await flushPromises()
    expect(input.element.value).toBe('225.2')
  })
})
