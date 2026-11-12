import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { defineComponent, h } from 'vue'
import WholesaleModal from '@/components/WholesaleModal.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  buildEditableWholesalePhones,
  buildTransferSubmitPayload,
  buildWholesaleOpenFormPatch,
  createWholesaleFormData,
  matchCollectedPrice
} from '@/components/wholesale/helpers'
import type { CollectedPriceItem, WholesalePhone } from '@/components/wholesale/types'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), suppliers: vi.fn(), warning: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get, post: mocks.post } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { name: '测试销售员' } }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({
  success: vi.fn(), error: vi.fn(), warning: mocks.warning
}) }))
vi.mock('@/services/reference-options', () => ({
  getCachedSuppliers: mocks.suppliers,
  getCachedStores: vi.fn().mockResolvedValue({ success: true, data: [] }),
  searchOperators: vi.fn().mockResolvedValue({ success: true, data: [] })
}))

const phones: WholesalePhone[] = [
  { id: 11, supplier_id: 1, supplier_name: '来源甲', brand: '测试品牌', model: '测试型号', color: '白色', memory: '256GB', purchase_cost: 3000, store_name: '测试门店', inventory_time: '2026-11-11' },
  { id: 12, supplier_id: 2, supplier_name: '来源乙', brand: '测试品牌', model: '测试型号', color: '黑色', memory: '512GB', purchase_cost: 4000 }
]
const quotes: CollectedPriceItem[] = [
  { brand_name: '测试品牌', model_number: '测试型号', color_name: '白色', memory: '256GB', wholesale_price: '3100', display_wholesale_price: '3180' },
  { brand_name: '测试品牌', model_number: '测试型号', color_name: '黑色', memory: '512GB', wholesale_price: '4100', display_wholesale_price: '4220' }
]
const wrappers: ReturnType<typeof mount>[] = []
const render = (mode: 'wholesale' | 'proxy', selected = phones) => {
  const wrapper = mount(WholesaleModal, {
    props: { visible: true, mode, phones: selected.map(phone => ({ ...phone })), phoneIds: selected.map(phone => phone.id), canViewSupplier: true },
    global: {
      plugins: [ElementPlus],
      components: { LoadingOverlay },
      stubs: { MobileDialog: defineComponent({ setup: (_, { slots }) => () => h('div', [slots.default?.(), slots.footer?.()]) }) }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}
const supplierInput = (wrapper: ReturnType<typeof render>) => wrapper.get<HTMLInputElement>('input[placeholder="暂无供应商"]')
const prices = (wrapper: ReturnType<typeof render>) => wrapper.findAll<HTMLInputElement>('input[placeholder="批发价"]').map(input => input.element.value)

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ success: true, data: quotes })
  mocks.suppliers.mockReset().mockResolvedValue({ success: true, data: [] })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('调货与划拨供应商展示', () => {
  it.each(['wholesale', 'proxy'] as const)('%s 单台供应商在选项为空时仍显示，只保留一个客户信息标题', async mode => {
    const wrapper = render(mode, [phones[0]])
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('来源甲')
    expect(supplierInput(wrapper).element.readOnly).toBe(true)
    expect(wrapper.findAll('.wholesale-party-section .section-title').map(item => item.text())).toEqual(['客户信息'])
    expect(wrapper.findAll('.phone-supplier').map(item => item.text())).toEqual(['供应商: 来源甲'])
    expect(wrapper.get('.phone-store').text()).toBe('门店: 测试门店')
    expect(wrapper.get('.phone-inventory-date').text()).toBe('入库时间: 2026-11-11')
    expect(wrapper.get('.phone-supplier').attributes('aria-label')).toBe('供应商：来源甲')
  })

  it('多台调货顶部取第一台，底部各自显示；更换选择后更新顶部和报价', async () => {
    const wrapper = render('wholesale')
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('来源甲')
    expect(wrapper.findAll('.phone-supplier').map(item => item.text())).toEqual(['供应商: 来源甲', '供应商: 来源乙'])
    expect(prices(wrapper)).toEqual(['3180', '4220'])
    await wrapper.setProps({ phones: [...phones].reverse() })
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('来源乙')
    expect(prices(wrapper)).toEqual(['4220', '3180'])
    expect(phones.map(phone => phone.supplier_id)).toEqual([1, 2])
  })

  it('供应商字段权限撤销时，顶部和逐台信息同时隐藏', async () => {
    const wrapper = render('wholesale')
    await flushPromises()
    await wrapper.setProps({ canViewSupplier: false })
    expect(wrapper.find('input[placeholder="暂无供应商"]').exists()).toBe(false)
    expect(wrapper.find('.phone-supplier').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('来源甲')
    expect(wrapper.text()).not.toContain('来源乙')
  })

  it('切换划拨模式按当前设备同步供应商，混合供应商不生成统一划拨供应商', async () => {
    const wrapper = render('wholesale', [phones[0]])
    await flushPromises()
    await wrapper.setProps({ mode: 'proxy' })
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('来源甲')
    await wrapper.setProps({ phones: [phones[1]], phoneIds: [12] })
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('来源乙')
    await wrapper.setProps({ phones, phoneIds: [11, 12] })
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('')
  })

  it('名称缺失时按首台供应商 ID 查公共选项，首台无供应商时不借用下一台', async () => {
    mocks.suppliers.mockResolvedValue({ success: true, data: [{ id: 1, name: '选项甲' }] })
    const wrapper = render('wholesale', [{ ...phones[0], supplier_name: undefined }, phones[1]])
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('选项甲')
    await wrapper.setProps({ phones: [{ ...phones[0], supplier_id: null, supplier_name: undefined }, phones[1]] })
    await flushPromises()
    expect(supplierInput(wrapper).element.value).toBe('')
  })
})

describe('调货使用批发报价页价格', () => {
  it('展示价优先于采集原价，与报价页相同保留真实小数；不会使用零售价或其他规格', () => {
    expect(matchCollectedPrice(phones[0], [{ ...quotes[0], display_wholesale_price: '3180.6' }])).toBe(3180.6)
    expect(matchCollectedPrice(phones[0], [{ ...quotes[0], display_wholesale_price: undefined }])).toBe(3100)
    for (const quote of [quotes[1], { ...quotes[0], color_name: undefined }, { ...quotes[0], memory: '1TB' }]) {
      expect(matchCollectedPrice(phones[0], [quote])).toBeNull()
    }
    for (const value of [0, -1, '', 'NaN', 'Infinity']) {
      expect(matchCollectedPrice(phones[0], [{ ...quotes[0], display_wholesale_price: value }])).toBeNull()
    }
    expect(matchCollectedPrice(phones[0], [{ ...quotes[0], wholesale_price: null, display_wholesale_price: null }])).toBeNull()
  })

  it('未匹配报价不把成本当批发价；划拨不取报价且仍为零价', () => {
    expect(buildEditableWholesalePhones(phones, 'wholesale', []).map(phone => phone.wholesale_price)).toEqual([null, null])
    expect(buildEditableWholesalePhones(phones, 'proxy', quotes).map(phone => [phone.purchase_cost, phone.wholesale_price])).toEqual([[0, 0], [0, 0]])
  })

  it('复用报价 API 强制实时请求；调货提交不添加统一供应商、不改原始设备', async () => {
    const wrapper = render('wholesale')
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('/public/price/all', expect.objectContaining({ useCache: false, showLoading: false, params: { _t: expect.any(Number) } }))
    expect(prices(wrapper)).toEqual(['3180', '4220'])
    const formData = { ...createWholesaleFormData(), ...buildWholesaleOpenFormPatch({ mode: 'wholesale', phones, operatorName: '测试销售员' }) }
    const payload = buildTransferSubmitPayload({ mode: 'wholesale', phoneIds: [11, 12], phones: buildEditableWholesalePhones(phones, 'wholesale', quotes), formData, selectedCustomer: null })
    expect(payload).not.toHaveProperty('supplier_id')
    expect(payload.phones.map(phone => phone.wholesale_price)).toEqual([3180, 4220])
    expect(phones.map(phone => phone.supplier_id)).toEqual([1, 2])
  })

  it('等待报价禁止提交；失败仍保留设备明细，允许手动填写', async () => {
    let reject!: (reason: Error) => void
    mocks.get.mockReturnValue(new Promise((_, fail) => { reject = fail }))
    const wrapper = render('wholesale')
    await flushPromises()
    expect(wrapper.getComponent(LoadingOverlay).props('text')).toBe('正在获取批发报价...')
    const confirm = wrapper.findAll('button').find(button => button.text() === '确认')!
    expect(confirm.element.disabled).toBe(true)
    await confirm.trigger('click')
    expect(mocks.post).not.toHaveBeenCalled()
    reject(new Error('模拟报价不可用'))
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledWith('获取批发报价失败，请手动填写批发价')
    expect(wrapper.findAll('.phone-item')).toHaveLength(2)
    expect(supplierInput(wrapper).element.value).toBe('来源甲')
    expect(confirm.element.disabled).toBe(false)
    expect(prices(wrapper)).toEqual(['', ''])
  })

  it('旧报价晚返回不能覆盖新选择，关闭弹窗取消请求', async () => {
    let finish!: (value: { success: boolean; data: CollectedPriceItem[] }) => void
    mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const wrapper = render('wholesale')
    await flushPromises()
    const oldSignal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ phones: [phones[1]], phoneIds: [12] })
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    finish({ success: true, data: [{ ...quotes[1], display_wholesale_price: 9999 }] })
    await flushPromises()
    expect(prices(wrapper)).toEqual(['4220'])
    expect(supplierInput(wrapper).element.value).toBe('来源乙')
    const currentSignal = mocks.get.mock.calls[1][1].signal as AbortSignal
    await wrapper.setProps({ visible: false })
    expect(currentSignal.aborted).toBe(true)
  })
})
