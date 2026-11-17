import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import ElementPlus, { ElForm } from 'element-plus'
import QueryEditModal from '@/components/query/QueryEditModal.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import type { QueryOperationOptions } from '@/types'

vi.mock('@/utils/unified-api', () => {
  const api = { get: vi.fn(), put: vi.fn().mockResolvedValue({ success: true }) }
  return { default: api, unifiedApi: api }
})
vi.mock('@/composables/useNotification', () => {
  const notifications = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
  return { useNotification: () => notifications }
})
vi.mock('@/services/reference-options', () => ({
  getModels: vi.fn().mockResolvedValue({ success: true, data: [{ id: 2, name: '测试型号', brand_id: 1 }] }),
  getCachedBrands: vi.fn(), getCachedColors: vi.fn(), getCachedMemories: vi.fn(),
  getStores: vi.fn(), getCachedSuppliers: vi.fn(), searchEmployees: vi.fn()
}))

vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canCreate: computed(() => true), canEdit: computed(() => true), requirePermission: () => true
}) }))

const options: QueryOperationOptions = {
  brands: [{ id: 1, name: '测试品牌' }], models: [{ id: 2, name: '测试型号', brand_id: 1 }],
  colors: [{ id: 3, name: '黑色' }], memories: [{ id: 4, name: '128GB', size: '128GB' }],
  suppliers: [], stores: [{ id: 5, name: '测试门店' }], users: []
}
const wrappers: ReturnType<typeof mount>[] = []
const render = async (method: string, channel: string | null, status = 'sold') => {
  vi.mocked(unifiedApi.get).mockResolvedValue({ success: true, data: {
    basic_info: { phone_id: 11, brand_id: 1, brand: '测试品牌', model_id: 2, model: '测试型号',
      color_id: 3, color: '黑色', memory_id: 4, memory: '128GB', serial_number: 'TESTSERIAL', imei: 'TESTSERIAL', is_new: 1, status_code: status },
    price_info: { purchase_cost: 100, sale_price: 200 },
    time_info: { inventory_time: '2026-11-12', sale_time: '2026-11-12' },
    store_info: { store_id: 5 }, sale_info: { payment_method: method, payment_channel: channel }
  } })
  const wrapper = mount(QueryEditModal, {
    props: { modelValue: false, phoneId: 11, sharedOptions: options },
    global: {
      plugins: [ElementPlus],
      stubs: { ElSelect: true, ElOption: true, ElDatePicker: true, MobileDialog: defineComponent({ inheritAttrs: false,
        setup: (_, { slots }) => () => h('section', [slots.header?.(), slots.default?.(), slots.footer?.()]) }) }
    }
  })
  wrappers.push(wrapper)
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}
const save = async (wrapper: ReturnType<typeof mount>) => {
  const button = wrapper.findAll('button').find(item => item.text().includes('保存'))
  expect(button).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('综合查询编辑支付记录', () => {
  it.each([
    { serial_number: 'ABCD中文' }, { serial_number: 'ABCD_123' }, { serial_number: 'A'.repeat(51) },
    { imei: '123456a789012345', isNoIMEIMode: false }
  ])('设备非法原文阻止保存请求：%j', async values => {
    const wrapper = await render('cash', null)
    const model = wrapper.getComponent(ElForm).props('model')
    if (!model) throw new Error('编辑表单缺少数据模型')
    Object.assign(model, values)
    await save(wrapper)
    expect(unifiedApi.put).not.toHaveBeenCalled()
    await expect.poll(() => wrapper.find('.el-form-item__error').exists()).toBe(true)
  })

  it('编辑保留包含分隔符及前导零的长序列号', async () => {
    const wrapper = await render('cash', null)
    const model = wrapper.getComponent(ElForm).props('model')
    if (!model) throw new Error('编辑表单缺少数据模型')
    const serial = '0001/AB-' + 'A'.repeat(42)
    Object.assign(model, { serial_number: serial, imei: serial, isNoIMEIMode: true })
    await save(wrapper)
    expect(unifiedApi.put).toHaveBeenCalledWith('/phones/11', expect.objectContaining({ serial_number: serial, imei: serial }))
  })

  it.each(['-', null, ''])('现金无渠道 %s 直接保存为 null，不提交显示占位符', async channel => {
    const wrapper = await render('cash', channel)
    await save(wrapper)
    expect(unifiedApi.put).toHaveBeenCalledWith('/phones/11', expect.objectContaining({ payment_method: 'cash', payment_channel: null }))
    expect(useNotification().error).not.toHaveBeenCalled()
  })

  it.each(['sold', 'peer_transfer'])('%s 的历史空渠道恢复为空，选择有效渠道后才可保存', async status => {
    const wrapper = await render('mobile', '-', status)
    expect(wrapper.findComponent(PaymentChannelSelect).props('modelValue')).toBe('')
    await save(wrapper)
    expect(unifiedApi.put).not.toHaveBeenCalled()
    expect(useNotification().error).toHaveBeenCalledWith('请选择有效的支付渠道')
    wrapper.findComponent(PaymentChannelSelect).vm.$emit('update:modelValue', 'wechat')
    await flushPromises()
    await save(wrapper)
    expect(unifiedApi.put).toHaveBeenCalledWith('/phones/11', expect.objectContaining({ payment_method: 'mobile', payment_channel: 'wechat' }))
  })

  it('拒绝错配渠道，切换现金后清空旧渠道并保存', async () => {
    const wrapper = await render('bank_card', 'wechat')
    await save(wrapper)
    expect(unifiedApi.put).not.toHaveBeenCalled()
    expect(useNotification().error).toHaveBeenCalledWith('请选择有效的支付渠道')
    const method = wrapper.findComponent(PaymentMethodSelect)
    method.vm.$emit('update:modelValue', 'cash')
    await flushPromises()
    method.vm.$emit('change', 'cash')
    await flushPromises()
    await save(wrapper)
    expect(unifiedApi.put).toHaveBeenCalledWith('/phones/11', expect.objectContaining({ payment_method: 'cash', payment_channel: null }))
  })

  it('支付方式占位符必须重新选择，不提交无效编码', async () => {
    const wrapper = await render('-', '-')
    expect(wrapper.findComponent(PaymentMethodSelect).props('modelValue')).toBe('')
    await save(wrapper)
    expect(unifiedApi.put).not.toHaveBeenCalled()
    expect(useNotification().error).toHaveBeenCalledWith('请选择有效的支付方式')
  })

  it.each([['mobile', 'alipay'], ['bank_card', 'bank_transfer'], ['subsidy_card', 'subsidy_card']])('合法 %s / %s 原样保存', async (method, channel) => {
    const wrapper = await render(method, channel)
    await save(wrapper)
    expect(unifiedApi.put).toHaveBeenCalledWith('/phones/11', expect.objectContaining({ payment_method: method, payment_channel: channel }))
  })
})
