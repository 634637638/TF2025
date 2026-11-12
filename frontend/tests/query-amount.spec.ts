import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'
import type { QueryOperationOptions } from '@/types'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 1, name: '测试销售员' } }) }))
vi.mock('@/utils/unified-api', () => { const api = {
  get: vi.fn().mockResolvedValue({ success: true, data: {
    基本信息: { phone_id: 11, status_code: 'in_stock' },
    价格信息: { purchase_cost: '200.02', sale_price: '225.00' },
    时间信息: { inventory_time: '2026-11-12' }
  } }), post: vi.fn(), put: vi.fn()
}; return { default: api, unifiedApi: api } })
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({
  success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), prompt: vi.fn()
}) }))
vi.mock('@/services/reference-options', () => ({
  getModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedBrands: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedColors: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedMemories: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedStores: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedSuppliers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  searchEmployees: vi.fn().mockResolvedValue({ success: true, data: { employees: [] } })
}))
const options: QueryOperationOptions = {
  brands: [{ id: 1, name: '测试品牌' }], suppliers: [], stores: [], models: [], colors: [], memories: [], users: []
}
const wrappers: ReturnType<typeof mount>[] = []
const global = {
  plugins: [ElementPlus],
  stubs: {
    MobileDialog: defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => h('section', slots.default?.()) }),
    OptimizedScanner: true
  }
}
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('综合查询金额输入', () => {
  it.each(['quick', 'edit'] as const)('%s 初始金额和真实小数正常回显，编辑不删除小数点', async mode => {
    const wrapper = mode === 'quick'
      ? mount(QuickSaleModal, { props: { modelValue: false, options, initialData: { purchase_cost: 200.02, sale_price: 225 } }, global })
      : mount(QueryEditModal, { props: { modelValue: false, phoneId: 11, sharedOptions: options }, global })
    wrappers.push(wrapper)
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const cost = wrapper.get<HTMLInputElement>('input[placeholder="请输入入库价格"]')
    const price = wrapper.get<HTMLInputElement>('input[placeholder="请输入销售价格"]')
    expect(cost.element.value).toBe('200.02')
    expect(price.element.value).toBe('225')
    for (const value of ['225.0', '225.02']) {
      price.element.value = value
      await price.trigger('input')
      await flushPromises()
    }
    await price.trigger('change')
    await price.trigger('blur')
    expect(price.element.value).toBe('225.02')
    await cost.setValue('200.20')
    await cost.trigger('change')
    await cost.trigger('blur')
    expect(cost.element.value).toBe('200.2')
    await price.setValue('')
    await price.trigger('change')
    await price.trigger('blur')
    expect(price.element.value).toBe(mode === 'quick' ? '' : '0')
  })
})
