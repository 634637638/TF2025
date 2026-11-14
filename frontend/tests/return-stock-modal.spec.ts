import { computed, defineComponent, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElDatePicker, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'
import PhoneReturnForm from '@/components/query/PhoneReturnForm.vue'
import { PaymentMethodSelect, PaymentChannelSelect, PaymentMethodText } from '@/components/payment'
import { REFUND_PAYMENT_METHODS, SALE_PAYMENT_METHODS, getPaymentMethodLabel, getPaymentChannelOptions } from '@/constants/paymentMethods'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import { getModuleFields } from '@/config/moduleFields'
import DataEmptyState from '@/components/DataEmptyState.vue'
import { isPhoneReturnSource } from '@/utils/sales-checkout'
import type { PhoneReturnSource } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), success: vi.fn(), error: vi.fn(), hidden: new Set<string>() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get, post: mocks.post } }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({
  canView: computed(() => module === 'query' ? permissionState.queryAllowed : permissionState.goodsAllowed), hasPermission: () => permissionState.queryAllowed
}) }))
vi.mock('@/components/accessory-field-permissions', () => ({ canViewAccessoryField: (field: string) => !mocks.hidden.has(field) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.success, error: mocks.error }) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => true) }) }))


const DialogStub = defineComponent({
  props: { beforeClose: { type: Function, required: true } },
  template: '<div><slot /><slot name="footer" /></div>'
})
const permissionState = reactive({ queryAllowed: true, goodsAllowed: true })
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(ReturnStockModal, {
    props: { modelValue: true, deviceInfo: { id: 12 } },
    global: { plugins: [ElementPlus], directives: { permission: {} }, components: { DataEmptyState },
      stubs: { MobileDialog: DialogStub, SectionLoading: { template: '<div>核对中</div>' },
        PhoneReturnForm: { props: ['checklist'], emits: ['cancel', 'success', 'busy'], template: '<div>共同售后办理<button @click="$emit(\'cancel\')">取消</button></div>' } } }
  })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  permissionState.queryAllowed = true; permissionState.goodsAllowed = true; mocks.hidden.clear()
  mocks.get.mockImplementation(async (path: string) => ({ success: true, data: { mode: 'standalone', phone_id: Number(path.split('/')[4]), sale_id: 1 } }))
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('退库字段和公共退款方式', () => {
  it('退库类型只有两项，退款方式与全局工具使用同一数据源', async () => {
    const wrapper = render()
    await flushPromises()
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
    await flushPromises()
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
    await flushPromises()
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

const commonSource = (): PhoneReturnSource => ({ mode: 'checkout', order_id: 8, order_no: 'SO-8', store_id: 1,
  phone: { item_id: 2, phone_id: 12, sale_id: 3, total_amount: 1000, points_awarded: 10 },
  accessories: [{ item_id: 4, accessory_id: 5, accessory_sale_id: 6, sale_type: 'gift', name: '原单充电头',
    quantity: 2, returned_quantity: 1, remaining_quantity: 1, serial_numbers: ['SN001', 'SN002'], available_serial_numbers: ['SN001'],
    unit_price: 0, total_amount: 0, gift_return_unit_price: 20, gift_return_total: 40, remaining_gift_return_total: 20, gift_agreement_state: 'recorded' }] })

const deferredSource = () => {
  let resolve!: (value: { success: boolean; data: PhoneReturnSource }) => void
  const promise = new Promise<{ success: boolean; data: PhoneReturnSource }>(done => { resolve = done })
  return { promise, resolve }
}

describe('手机退库原单核对', () => {
  it('打开即读取原单；共同单显示准确已退与剩余SN，无法提交旧删除式退库', async () => {
    mocks.get.mockResolvedValue({ success: true, data: commonSource() })
    const wrapper = render()
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('/sales/checkout/phones/12/return-checklist', expect.objectContaining({ useCache: false, showLoading: false, signal: expect.any(AbortSignal) }))
    expect(wrapper.text()).toContain('SO-8')
    expect(wrapper.text()).toContain('原单充电头')
    expect(wrapper.text()).toContain('SN001')
    expect(wrapper.text()).not.toContain('SN002')
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(false)
    expect(wrapper.findComponent(PhoneReturnForm).props('checklist')).toMatchObject({ order_id: 8 })
    expect(wrapper.findAll('button').some(button => button.text() === '确认退库')).toBe(false)
    await wrapper.findComponent(DialogStub).vm.$emit('confirm')
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('共同售后使用独立事务表单，提交中禁止关闭，成功通知父页面刷新后关闭', async () => {
    mocks.get.mockResolvedValue({ success: true, data: commonSource() })
    const wrapper = render()
    await flushPromises()
    const child = wrapper.findComponent(PhoneReturnForm)
    child.vm.$emit('busy', true)
    await flushPromises()
    let closes = 0
    const beforeClose = wrapper.findComponent(DialogStub).props('beforeClose') as (done: () => void) => void
    beforeClose(() => { closes++ })
    expect(closes).toBe(0)
    child.vm.$emit('success')
    await flushPromises()
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('读取失败不回退旧单，保留错误并支持重试', async () => {
    mocks.get.mockRejectedValueOnce(new Error('售后结构未就绪'))
    const wrapper = render()
    await flushPromises()
    const failed = wrapper.findComponent(DataEmptyState)
    expect(failed.props('state')).toBe('error')
    expect(failed.props('description')).toContain('售后结构未就绪')
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(false)
    expect(wrapper.findAll('button').find(button => button.text() === '确认退库')!.attributes('disabled')).toBeDefined()
    failed.vm.$emit('action')
    await flushPromises()
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(true)
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })

  it('切换手机取消前请求，晚返回的独立销售不覆盖当前共同单', async () => {
    const pending = deferredSource()
    mocks.get.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ success: true, data: { ...commonSource(), phone: { item_id: 9, phone_id: 13, sale_id: 10, total_amount: 1000, points_awarded: 10 } } })
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ deviceInfo: { id: 13 } })
    await flushPromises()
    expect(signal.aborted).toBe(true)
    pending.resolve({ success: true, data: { mode: 'standalone', phone_id: 12, sale_id: 1 } })
    await flushPromises()
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(false)
    expect(wrapper.text()).toContain('共同售后办理')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('取消直接关闭并取消请求，不接受关闭后的晚响应；重开重新读取', async () => {
    const pending = deferredSource()
    mocks.get.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click')
    expect(signal.aborted).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    pending.resolve({ success: true, data: { mode: 'standalone', phone_id: 12, sale_id: 1 } })
    await flushPromises()
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(false)
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(true)
  })

  it('卸载取消在途原单请求，无权限不读取也不展示提交动作', async () => {
    const pending = deferredSource()
    mocks.get.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.resolve({ success: true, data: commonSource() })
    await flushPromises()
    permissionState.queryAllowed = false
    const denied = render()
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(denied.findAll('button').map(button => button.text())).toEqual(['取消'])
  })

  it('字段脱敏NULL不作为0展示，隐藏的商品金额和SN列不渲染', async () => {
    const data = commonSource()
    if (data.mode !== 'checkout') throw new Error('fixture')
    Object.assign(data.accessories[0], { total_amount: null, unit_price: null, gift_return_unit_price: null, gift_return_total: null,
      remaining_gift_return_total: null, gift_agreement_state: null, serial_numbers: null, available_serial_numbers: null })
    mocks.hidden.add('serial_number'); mocks.hidden.add('unit_price')
    mocks.get.mockResolvedValue({ success: true, data })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('SO-8')
    expect(wrapper.text()).not.toContain('原单核对失败')
    expect(wrapper.text()).not.toContain('未退 SN')
    expect(wrapper.text()).not.toContain('剩余赠品约定金额')
  })

  it('运行时守卫拒绝错手机、重复明细、不守恒数量、SN错配、非法金额和未知模式', () => {
    expect(isPhoneReturnSource(commonSource(), 12)).toBe(true)
    for (const edit of [
      (data: Record<string, unknown>) => { data.mode = 'other' },
      (data: Record<string, unknown>) => { data.phone = { phone_id: 13 } },
      (data: Record<string, unknown>) => { data.accessories = [null] }
    ]) {
      const data = { ...commonSource() }; edit(data)
      expect(isPhoneReturnSource(data, 12)).toBe(false)
    }
    for (const [key, value] of [['remaining_quantity', 2], ['available_serial_numbers', ['WRONG']], ['total_amount', Infinity], ['gift_return_unit_price', -1], ['remaining_gift_return_total', 30]]) {
      const data = commonSource()
      if (data.mode !== 'checkout') throw new Error('fixture')
      Object.assign(data.accessories[0], { [key as string]: value })
      expect(isPhoneReturnSource(data, 12)).toBe(false)
    }
    const duplicate = commonSource()
    if (duplicate.mode !== 'checkout') throw new Error('fixture')
    duplicate.accessories.push({ ...duplicate.accessories[0] })
    expect(isPhoneReturnSource(duplicate, 12)).toBe(false)
  })

  it('请求期间撤销手机权限立即取消，晚返回不得恢复表单；关联配件撤权同样拒绝核对', async () => {
    const pending = deferredSource()
    mocks.get.mockReturnValueOnce(pending.promise)
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    permissionState.queryAllowed = false
    await flushPromises()
    expect(signal.aborted).toBe(true)
    pending.resolve({ success: true, data: { mode: 'standalone', phone_id: 12, sale_id: 1 } })
    await flushPromises()
    expect(wrapper.findComponent(ElFormItem).exists()).toBe(false)
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['取消'])
    mocks.get.mockResolvedValue({ success: true, data: commonSource() })
    permissionState.goodsAllowed = false
    permissionState.queryAllowed = true
    await flushPromises()
    expect(wrapper.findComponent(DataEmptyState).props('description')).toContain('无权查看关联配件')
    expect(wrapper.text()).not.toContain('原单充电头')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('数量和名称全部脱敏时允许查看其余信息，隐藏列不反推已退或剩余', async () => {
    const data = commonSource()
    if (data.mode !== 'checkout') throw new Error('fixture')
    Object.assign(data.accessories[0], { quantity: null, returned_quantity: null, remaining_quantity: null, total_amount: null,
      gift_return_total: null, remaining_gift_return_total: null, name: null, accessory_id: null })
    expect(isPhoneReturnSource(data, 12)).toBe(true)
    mocks.hidden.add('total_quantity'); mocks.hidden.add('name')
    mocks.get.mockResolvedValue({ success: true, data })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('SO-8')
    expect(wrapper.text()).not.toContain('原数量')
    expect(wrapper.text()).not.toContain('剩余赠品约定金额')
    expect(wrapper.text()).not.toContain('原单充电头')
  })
})
