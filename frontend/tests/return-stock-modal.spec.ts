import { computed, defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElDatePicker, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'
import { PaymentMethodSelect, PaymentChannelSelect, PaymentMethodText } from '@/components/payment'
import { REFUND_PAYMENT_METHODS, SALE_PAYMENT_METHODS, getPaymentMethodLabel, getPaymentChannelOptions } from '@/constants/paymentMethods'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import { getModuleFields } from '@/config/moduleFields'

const mocks = vi.hoisted(() => ({ post: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { post: mocks.post } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.success, error: mocks.error }) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => true) }) }))


const DialogStub = defineComponent({
  template: '<div><slot /><slot name="footer" /></div>'
})
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(ReturnStockModal, {
    props: { modelValue: true, deviceInfo: { id: 12 } },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: DialogStub } }
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('退库字段和公共退款方式', () => {
  it('退库类型只有两项，退款方式与全局工具使用同一数据源', () => {
    const wrapper = render()
    expect(RETURN_STOCK_OPTIONS.return_type).toEqual(['退货处理', '申请换货'])
    expect(wrapper.findComponent(PaymentMethodSelect).props('variant')).toBe('refund')
    expect(REFUND_PAYMENT_METHODS).toEqual([
      { label: '现金支付', value: 'cash' },
      { label: '移动支付', value: 'mobile' },
      { label: '银行卡', value: 'bank_card' },
      { label: '原路退回', value: '原路退回' }
    ])
    for (const option of REFUND_PAYMENT_METHODS.slice(0, 3)) {
      expect(option).toBe(SALE_PAYMENT_METHODS.find(item => item.value === option.value))
    }
    for (const option of REFUND_PAYMENT_METHODS) {
      expect(getPaymentMethodLabel(option.value)).toBe(option.label)
    }
    expect(getModuleFields('system_returngoods')).toBe(getModuleFields('returngoods'))
    expect(getModuleFields('system_returngoods').some(field => field.id === 'record.refund_amount')).toBe(true)
  })

  it('移动支付及银行卡显示全局渠道，切换方式清除旧渠道并隐藏无关选择', async () => {
    const wrapper = render()
    const method = wrapper.findComponent(PaymentMethodSelect)
    expect(wrapper.findComponent(PaymentChannelSelect).exists()).toBe(false)
    for (const value of ['mobile', 'bank_card']) {
      method.vm.$emit('update:modelValue', value)
      await flushPromises()
      const channel = wrapper.findComponent(PaymentChannelSelect)
      expect(channel.props('paymentMethod')).toBe(value)
      expect(channel.findAllComponents(ElOption).map(option => ({ label: option.props('label'), value: option.props('value') }))).toEqual(getPaymentChannelOptions(value))
      expect(channel.props('modelValue')).toBe(null)
      channel.vm.$emit('update:modelValue', getPaymentChannelOptions(value)[0].value)
      await flushPromises()
    }
    method.vm.$emit('update:modelValue', '原路退回')
    await flushPromises()
    expect(wrapper.findComponent(PaymentChannelSelect).exists()).toBe(false)
    method.vm.$emit('update:modelValue', 'mobile')
    await flushPromises()
    expect(wrapper.findComponent(PaymentChannelSelect).props('modelValue')).toBe(null)
  })

  it('公共支付文本同时回显退款方式和渠道', () => {
    const wrapper = mount(PaymentMethodText, { props: { value: 'mobile', channel: 'alipay' } })
    wrappers.push(wrapper)
    expect(wrapper.text()).toBe('移动支付 / 支付宝')
  })

  it('下拉未选择时不发送撤销请求', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text().includes('确认退库'))!.trigger('click')
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it.each([
    ['cash', null], ['mobile', 'wechat'], ['mobile', 'alipay'],
    ['bank_card', 'card_consumption'], ['bank_card', 'bank_transfer'], ['原路退回', null]
  ])('提交退款方式%s和渠道%s、完整退库资料和0元', async (refundMethod, refundChannel) => {
    const wrapper = render()
    const fields = wrapper.findAllComponents(ElFormItem)
    const field = (name: string) => fields.find(item => item.props('prop') === name)!
    field('return_reason').findComponent(ElSelect).vm.$emit('update:modelValue', '客户退货')
    field('return_type').findComponent(ElSelect).vm.$emit('update:modelValue', '申请换货')
    field('handle_method').findComponent(ElSelect).vm.$emit('update:modelValue', '供应商退换')
    field('reversal_date').findComponent(ElDatePicker).vm.$emit('update:modelValue', '2026-11-08T10:30')
    field('refund_amount').findComponent(ElInputNumber).vm.$emit('update:modelValue', 0)
    field('refund_method').findComponent(PaymentMethodSelect).vm.$emit('update:modelValue', refundMethod)
    fields.find(item => item.props('label') === '备注')!.findComponent(ElInput).vm.$emit('update:modelValue', '独立备注')
    await flushPromises()
    if (refundChannel) {
      await wrapper.findAll('button').find(button => button.text().includes('确认退库'))!.trigger('click')
      await flushPromises()
      expect(mocks.post).not.toHaveBeenCalled()
      wrapper.findComponent(PaymentChannelSelect).vm.$emit('update:modelValue', refundChannel)
      await flushPromises()
    }
    mocks.post.mockResolvedValue({ success: true })
    await wrapper.findAll('button').find(button => button.text().includes('确认退库'))!.trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/query/12/return-to-stock', {
      return_reason: '客户退货', return_type: '申请换货', handle_method: '供应商退换',
      refund_amount: 0, refund_method: refundMethod, refund_channel: refundChannel,
      reversal_date: '2026-11-08T10:30', remarks: '独立备注'
    })
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
})
