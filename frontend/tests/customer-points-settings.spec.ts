import { computed, defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElInputNumber, ElSwitch, ElCheckboxGroup, ElCheckbox, ElSelect } from 'element-plus'
import CustomerPointsSettings from '@/views/customers/page/CustomerPointsSettings.vue'
import type { CustomerPointsConfig, CustomerPointsSettingsData } from '@/types/customer-points'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), success: vi.fn(), warning: vi.fn(), view: true, manage: true }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => mocks.view), canManage: computed(() => mocks.manage)
}) }))
const Dialog = defineComponent({ props: { modelValue: Boolean }, template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>' })
const base = (): CustomerPointsConfig => ({ enabled: true, amount_per_point: 100,
  include_new: true, include_used: true, include_accessories: false,
  new_points_per_100: 1, used_points_per_100: 1, accessory_points_per_100: 1,
  redemption: { enabled: false, points_per_yuan: null, max_percent: null, sources: [], all_accessory_categories: false, category_ids: [], accessory_ids: [] }
})
const product = (id = 8, category_id = 4) => ({ id, category_id, name: '充电头' + id, product_model: null, brand_name: '沃品', color_name: '黑色', status: 1 })
const data = (config = base()) => ({ success: true, data: { config, categories: [{ id: 4, name: '充电器', status: 1 }] } })
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(CustomerPointsSettings, { props: { modelValue: true }, global: {
    plugins: [ElementPlus], stubs: { MobileDialog: Dialog, SectionLoading: true }, directives: { permission: {} }
  } })
  wrappers.push(wrapper)
  return wrapper
}
const field = (wrapper: ReturnType<typeof render>, label: string) => wrapper.findAll('.el-form-item')
  .find(item => item.find('.el-form-item__label').text() === label)!
const save = (wrapper: ReturnType<typeof render>) => wrapper.findAll('button').find(item => item.text() === '保存设置')!
beforeEach(() => {
  mocks.view = mocks.manage = true
  mocks.get.mockReset().mockImplementation(async url => url === '/customers/points-products' ? { success: true, data: [product()], pagination: { total: 1 } } : data())
  mocks.put.mockReset().mockResolvedValue({ success: true })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('客户统一积分设置', () => {
  it('读取实时规则及商品类型，旧规则不自动开启商品累计或猜测兑换值', async () => {
    const wrapper = render()
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('/customers/points-config', expect.objectContaining({ params: { include_options: 1 }, useCache: false, showLoading: false }))
    expect(field(wrapper, '配件/商品累计').findComponent(ElSwitch).props('modelValue')).toBe(false)
    expect(field(wrapper, '抵扣1元所需积分').findComponent(ElInputNumber).props('modelValue')).toBeUndefined()
    expect(field(wrapper, '积分抵扣').findComponent(ElSwitch).props('modelValue')).toBe(false)
    expect(save(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('当前结算仅支持收费配件商品抵扣')
    expect(wrapper.text()).toContain('积分累计')
    expect(wrapper.text()).toContain('积分抵扣')
    const sourceOptions = wrapper.findAllComponents(ElCheckbox)
    expect(sourceOptions[0].props('disabled')).toBe(true)
    expect(sourceOptions[1].props('disabled')).toBe(true)
    expect(sourceOptions[2].props('disabled')).toBe(false)
  })

  it('启用抵扣须填写兑换比例、单件上限及范围，按完整配置保存', async () => {
    const wrapper = render()
    await flushPromises()
    field(wrapper, '积分抵扣').findComponent(ElSwitch).vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(save(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(mocks.put).not.toHaveBeenCalled()
    field(wrapper, '抵扣1元所需积分').findComponent(ElInputNumber).vm.$emit('update:modelValue', 10)
    field(wrapper, '单件抵扣上限（%）').findComponent(ElInputNumber).vm.$emit('update:modelValue', 50)
    wrapper.findComponent(ElCheckboxGroup).vm.$emit('update:modelValue', ['accessory'])
    await flushPromises()
    expect(save(wrapper).attributes('disabled')).toBeDefined()
    field(wrapper, '选择商品类型').findComponent(ElSelect).vm.$emit('update:modelValue', [4])
    await flushPromises()
    expect(save(wrapper).attributes('disabled')).toBeDefined()
    field(wrapper, '选择参与商品').findComponent(ElSelect).vm.$emit('update:modelValue', [8])
    await flushPromises()
    await save(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/customers/points-config', expect.objectContaining({ redemption: {
      enabled: true, points_per_yuan: 10, max_percent: 50, sources: ['accessory'], all_accessory_categories: false, category_ids: [4], accessory_ids: [8]
    } }), { showLoading: false })
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('跨类型多选商品，全选读取所有分页而非当前搜索页，取消类型时仅移除该类型商品', async () => {
    const config = base()
    config.redemption.sources = ['accessory']
    mocks.get.mockImplementation(async (url, options) => {
      if (url !== '/customers/points-products') return { ...data(config), data: { ...data(config).data, categories: [{ id: 4, name: '充电头', status: 1 }, { id: 5, name: '数据线', status: 1 }] } }
      const second = options.params.page === 2
      return { success: true, data: second ? [product(9, 5)] : Array.from({ length: 50 }, (_, index) => product(10 + index)), pagination: { total: 51 } }
    })
    const wrapper = render()
    await flushPromises()
    field(wrapper, '选择商品类型').findComponent(ElSelect).vm.$emit('update:modelValue', [4, 5])
    await flushPromises()
    const button = wrapper.findAll('button').find(item => item.text() === '全选所选类型商品')!
    await button.trigger('click')
    await flushPromises()
    expect(field(wrapper, '选择参与商品').findComponent(ElSelect).props('modelValue')).toHaveLength(51)
    expect(mocks.get).toHaveBeenCalledWith('/customers/points-products', expect.objectContaining({ params: expect.objectContaining({ category_ids: '4,5', page: 2, search: '' }) }))
    field(wrapper, '选择商品类型').findComponent(ElSelect).vm.$emit('update:modelValue', [4])
    await flushPromises()
    expect(field(wrapper, '选择参与商品').findComponent(ElSelect).props('modelValue')).not.toContain(9)
    expect(field(wrapper, '选择参与商品').findComponent(ElSelect).props('modelValue')).toHaveLength(50)
  })

  it('全选中后续分页失败保留原选择，关闭重开丢弃旧商品请求', async () => {
    const config = base()
    config.redemption.sources = ['accessory']; config.redemption.category_ids = [4]; config.redemption.accessory_ids = [8]
    mocks.get.mockImplementation(async (url, options) => {
      if (url !== '/customers/points-products') return { success: true, data: { ...data(config).data, products: [product()] } }
      if (options.params.page === 2) throw new Error('network')
      return { success: true, data: [product(9)], pagination: { total: 2 } }
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('button').find(item => item.text() === '全选所选类型商品')!.trigger('click')
    await flushPromises()
    expect(field(wrapper, '选择参与商品').findComponent(ElSelect).props('modelValue')).toEqual([8])
    let resolveOld!: (value: unknown) => void
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    field(wrapper, '选择参与商品').findComponent(ElSelect).props('remoteMethod')('旧请求')
    await flushPromises()
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    resolveOld({ success: true, data: [product(99)], pagination: { total: 1 } })
    await flushPromises()
    expect(field(wrapper, '选择参与商品').findComponent(ElSelect).props('modelValue')).toEqual([8])
    expect(wrapper.findAllComponents(ElSelect).at(-1)!.findAllComponents({ name: 'ElOption' }).some(item => item.props('value') === 99)).toBe(false)
  })

  it('读取失败禁止保存，重试成功；保存中防重复并禁止取消，失败保留草稿', async () => {
    mocks.get.mockRejectedValueOnce(new Error('network'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('读取失败')
    expect(save(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(item => item.text() === '重新读取')!.trigger('click')
    await flushPromises()
    field(wrapper, '配件/商品累计').findComponent(ElSwitch).vm.$emit('update:modelValue', true)
    let rejectSave!: (error: Error) => void
    mocks.put.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject }))
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await wrapper.findAll('button').find(item => item.text() === '取消')!.trigger('click')
    expect(mocks.put).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    rejectSave(new Error('save failed'))
    await flushPromises()
    expect(field(wrapper, '配件/商品累计').findComponent(ElSwitch).props('modelValue')).toBe(true)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(save(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('重开时丢弃旧响应，查看和管理权限分别控制请求及保存', async () => {
    let resolveOld!: (value: { success: boolean; data: CustomerPointsSettingsData }) => void
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    resolveOld(data({ ...base(), include_accessories: true }))
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(field(wrapper, '配件/商品累计').findComponent(ElSwitch).props('modelValue')).toBe(false)
    mocks.manage = false
    const readonly = render()
    await flushPromises()
    await readonly.get('form').trigger('submit')
    expect(mocks.put).not.toHaveBeenCalled()
    expect(save(readonly).attributes('disabled')).toBeDefined()
    mocks.view = false
    mocks.get.mockClear()
    render()
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
