import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElCheckbox, ElForm, ElInput, ElInputNumber, ElSelect } from 'element-plus'
import Form from '@/components/query/PhoneReturnForm.vue'
import { PaymentMethodSelect, PaymentChannelSelect } from '@/components/payment'
import { isPhoneReturnQuote } from '@/utils/sales-checkout'
import type { PhoneReturnChecklist, PhoneReturnInput, PhoneReturnQuote } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ quote: vi.fn(), submit: vi.fn(), stores: vi.fn(), warning: vi.fn(), success: vi.fn(), hidden: new Set<string>() }))
const permissions = reactive({ query: true, goods: true, gift: true })
vi.mock('@/api/sales-checkout', () => ({ quotePhoneReturn: mocks.quote, submitPhoneReturn: mocks.submit }))
vi.mock('@/services/reference-options', () => ({ getCachedStores: mocks.stores }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'query' ? permissions.query : permissions.goods),
  hasPermission: (action: string) => module === 'query' ? permissions.query : action === 'gift' ? permissions.gift : permissions.goods }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(false) }) }))

const checklist = (): PhoneReturnChecklist => ({ order_id: 10, order_no: 'SO-ORIGINAL', store_id: 1,
  phone: { item_id: 50, sale_id: 20, phone_id: 30, total_amount: 100, points_awarded: 10 },
  accessories: [{ item_id: 51, accessory_id: 5, accessory_sale_id: 1, sale_type: 'sale', name: '收费商品', quantity: 3,
    returned_quantity: 0, remaining_quantity: 3, serial_numbers: [], available_serial_numbers: [], unit_price: 20, total_amount: 60,
    gift_return_unit_price: null, gift_return_total: null, remaining_gift_return_total: null, gift_agreement_state: null },
  { item_id: 52, accessory_id: 6, accessory_sale_id: 2, sale_type: 'gift', name: '原赠品', quantity: 3,
    returned_quantity: 1, remaining_quantity: 2, serial_numbers: ['SN1', 'SN2', 'SN3'], available_serial_numbers: ['SN2', 'SN3'],
    unit_price: 0, total_amount: 0, gift_return_unit_price: 5, gift_return_total: 15, remaining_gift_return_total: 10, gift_agreement_state: 'recorded' }] })
const quote = (input: PhoneReturnInput): PhoneReturnQuote => {
  const rows = input.accessories.map(row => {
    const item = checklist().accessories.find(item => item.item_id === row.item_id)!
    const missing = item.sale_type === 'gift' && row.charge_missing ? item.remaining_quantity! - row.quantity : 0
    return { item_id: row.item_id, returned_quantity: row.quantity, remaining_quantity: item.remaining_quantity! - row.quantity,
      gift_charge_quantity: missing, gift_charge_amount: missing * 5 }
  })
  const base = 100 + input.accessories[0].quantity * 20, charge = rows[1].gift_charge_amount
  return { order_id: 10, sale_id: 20, phone_id: 30, store_id: input.store_id, base_refund_amount: base,
    points_recovery_amount: 0, points_compensation_amount: 0, gift_charge_amount: charge, refund_amount: base - charge,
    collection_amount: 0, points_delta: -10, accessories: rows }
}
const wrappers: ReturnType<typeof mount>[] = []
const render = async (source = checklist()) => {
  const wrapper = mount(Form, { props: { checklist: source }, global: { plugins: [ElementPlus], directives: { permission: {} },
    components: { PaymentMethodSelect, PaymentChannelSelect }, stubs: { SectionLoading: true, DataEmptyState: { emits: ['action'], template: '<button @click="$emit(\'action\')">读取失败，重试</button>' } } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
type Wrapper = Awaited<ReturnType<typeof render>>
const button = (wrapper: Wrapper, text: string) => wrapper.findAll('button').find(item => item.text() === text)!
const complete = async (wrapper: Wrapper) => {
  wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', '客户退货')
  wrapper.findAllComponents(ElCheckbox).find(item => item.text().includes('已核验手机'))!.vm.$emit('update:modelValue', true)
  await flushPromises()
}
const calculate = async (wrapper: Wrapper) => { await complete(wrapper); await button(wrapper, '核对退款').trigger('click'); await flushPromises() }
const pay = async (wrapper: Wrapper, method = 'cash') => {
  wrapper.findComponent(PaymentMethodSelect).vm.$emit('update:modelValue', method)
  wrapper.findAllComponents(ElCheckbox).find(item => item.text().includes('确认已按') || item.text().includes('确认已收取'))!.vm.$emit('update:modelValue', true)
  await flushPromises()
}
beforeEach(() => {
  Object.assign(permissions, { query: true, goods: true, gift: true }); mocks.hidden.clear()
  mocks.stores.mockResolvedValue({ data: [{ id: 1, name: '原销售店' }, { id: 2, name: '接收店' }] })
  mocks.quote.mockImplementation(async (_order, _sale, input: PhoneReturnInput) => ({ success: true, data: quote(input) }))
  mocks.submit.mockImplementation(async (_order, _sale, input: PhoneReturnInput) => ({ success: true, data: { ...quote(input), aftersale_id: 100 } }))
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('收费商品默认保留、赠品默认退回，仅按原可退SN选择；人工核验后一次试算手机和全部关联商品', async () => {
  const wrapper = await render()
  expect(wrapper.text()).toContain('SO-ORIGINAL')
  expect(wrapper.findComponent(ElInputNumber).props('modelValue')).toBe(0)
  expect(wrapper.findAllComponents(ElSelect)[2].props('modelValue')).toEqual(['SN2', 'SN3'])
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  expect(mocks.quote).not.toHaveBeenCalled()
  await calculate(wrapper)
  expect(mocks.quote).toHaveBeenCalledWith(10, 20, expect.objectContaining({ store_id: 1, restock_confirmed: true,
    accessories: [{ item_id: 51, quantity: 0, serial_numbers: [], charge_missing: false, charge_confirmed: false },
      { item_id: 52, quantity: 2, serial_numbers: ['SN2', 'SN3'], charge_missing: false, charge_confirmed: false }] }), expect.any(AbortSignal))
  expect(wrapper.text()).toContain('本次应退款')
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
})

it('未退赠品明确按原约定扣款；部分退回与收费商品一起返库，支付渠道和资金确认后才提交', async () => {
  const wrapper = await render()
  wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2)
  wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 1)
  wrapper.findAllComponents(ElSelect)[2].vm.$emit('update:modelValue', ['SN3'])
  await flushPromises()
  await calculate(wrapper)
  expect(mocks.quote).not.toHaveBeenCalled()
  wrapper.findAllComponents(ElCheckbox).find(item => item.text().includes('按原单约定扣款'))!.vm.$emit('update:modelValue', true)
  await flushPromises(); await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  const input = mocks.quote.mock.calls[0][2]
  expect(input.accessories[1]).toMatchObject({ quantity: 1, serial_numbers: ['SN3'], charge_missing: true, charge_confirmed: true })
  await pay(wrapper, 'mobile')
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  wrapper.findComponent(PaymentChannelSelect).vm.$emit('update:modelValue', 'wechat'); await flushPromises()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[0][2].settlement).toEqual({ refund_amount: 115, collection_amount: 0, method: 'mobile', channel: 'wechat', confirmed: true })
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('原单未约定不得输入现价补算，缺赠品权限只允许退回赠品，金额/数量/SN隐藏时不开放办理', async () => {
  for (const agreement of [null, 5]) {
    const source = checklist(); source.accessories[1].gift_return_unit_price = agreement
    permissions.gift = false
    const wrapper = await render(source)
    wrapper.findAllComponents(ElSelect)[2].vm.$emit('update:modelValue', [])
    await calculate(wrapper)
    expect(mocks.quote).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(agreement === null ? '原单未约定' : '没有赠品未退扣款确认权限')
    wrapper.unmount()
  }
  for (const hidden of ['basic_info.sale_price', 'stock_info.total_quantity', 'price_info.unit_price', 'basic_info.serial_number']) {
    mocks.hidden.add(hidden)
    const wrapper = await render()
    expect(wrapper.text()).toContain('缺少手机或关联商品售后必要权限')
    expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false)
    wrapper.unmount(); mocks.hidden.clear()
  }
})

it('表单改动废弃旧试算、资金方式及确认；晚返回、撤权和卸载不会恢复旧结果', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  wrapper.findAllComponents(ElInput).find(item => item.props('type') === 'textarea')!.vm.$emit('update:modelValue', '修改备注'); await flushPromises()
  expect(wrapper.findComponent(PaymentMethodSelect).exists()).toBe(false)
  let resolve!: (value: unknown) => void
  mocks.quote.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  const input = mocks.quote.mock.calls.at(-1)![2], signal = mocks.quote.mock.calls.at(-1)![3] as AbortSignal
  wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 1); await flushPromises()
  expect(signal.aborted).toBe(true)
  resolve({ success: true, data: quote(input) }); await flushPromises()
  expect(wrapper.findComponent(PaymentMethodSelect).exists()).toBe(false)
  permissions.query = false; await flushPromises()
  expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false)
  expect(wrapper.text()).not.toContain('确认退货')
  permissions.query = true; await flushPromises(); await complete(wrapper)
  mocks.quote.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  const pending = mocks.quote.mock.calls.at(-1)!, successes = wrapper.emitted('success')
  wrapper.unmount()
  expect((pending[3] as AbortSignal).aborted).toBe(true)
  resolve({ success: true, data: quote(pending[2]) }); await flushPromises()
  expect(wrapper.emitted('success')).toEqual(successes)
})

it('退款报价变化明确回滚后解除冻结，必须重新核对和确认资金', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  mocks.submit.mockRejectedValueOnce({ response: { status: 409, data: { success: false, code: 'CHECKOUT_RETURN_QUOTE_CHANGED' } } })
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).not.toContain('提交结果未确认')
  expect(wrapper.emitted('success')).toBeUndefined()
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  await pay(wrapper); await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[1][2]).toEqual(mocks.submit.mock.calls[0][2])
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it.each(['network', 'invalid'])('手机退货结果未知（%s）冻结实物与资金确认，禁止重新试算，同载荷重试', async failure => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  if (failure === 'network') mocks.submit.mockRejectedValueOnce(new Error('network'))
  else mocks.submit.mockResolvedValueOnce({ success: false })
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  const first = mocks.submit.mock.calls[0][2]
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
  expect(wrapper.findAll('input, textarea').every(control => (control.element as HTMLInputElement).disabled)).toBe(true)
  expect(button(wrapper, '核对退款').attributes('disabled')).toBeDefined()
  expect(button(wrapper, '取消').attributes('disabled')).toBeUndefined()
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeUndefined()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[1][2]).toEqual(first)
  expect(mocks.quote).toHaveBeenCalledOnce()
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('提交失败保持同一请求可重试、显示不确定提示，提交中通过busy禁止关闭；取消直接退出', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  let reject!: (error: Error) => void
  mocks.submit.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(wrapper.emitted('busy')?.at(-1)).toEqual([true])
  expect(button(wrapper, '取消').attributes('disabled')).toBeDefined()
  reject(new Error('network')); await flushPromises()
  expect(wrapper.text()).toContain('提交结果未确认')
  const first = mocks.submit.mock.calls[0][2]
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[1][2]).toEqual(first)
  expect(wrapper.emitted('success')).toHaveLength(1)
  await button(wrapper, '取消').trigger('click')
  expect(wrapper.emitted('cancel')).toHaveLength(1)
})

it('补款使用公共销售支付方式；0金额不要求资金方式，损坏金额或错手机结果不放行', async () => {
  mocks.quote.mockImplementation(async (_o, _s, input) => ({ success: true, data: { ...quote(input), points_recovery_amount: 110, refund_amount: 0, collection_amount: 10 } }))
  const wrapper = await render(); await calculate(wrapper)
  expect(wrapper.findComponent(PaymentMethodSelect).props('variant')).toBe('sale')
  expect(wrapper.text()).toContain('确认已收取客户需补差价')
  const input = mocks.quote.mock.calls[0][2], valid = quote(input)
  expect(isPhoneReturnQuote(valid, checklist(), input)).toBe(true)
  for (const invalid of [{ ...valid, phone_id: 31 }, { ...valid, refund_amount: 99 }, { ...valid, gift_charge_amount: NaN },
    { ...valid, accessories: [valid.accessories[0], valid.accessories[0]] }]) {
    expect(isPhoneReturnQuote(invalid, checklist(), input)).toBe(false)
  }
  mocks.quote.mockImplementationOnce(async (_o, _s, payload) => ({ success: true, data: { ...quote(payload), points_recovery_amount: 100, refund_amount: 0, collection_amount: 0 } }))
  mocks.submit.mockImplementationOnce(async (_o, _s, payload) => ({ success: true, data: { ...quote(payload), points_recovery_amount: 100, refund_amount: 0, collection_amount: 0, aftersale_id: 101 } }))
  const zero = await render(); await calculate(zero)
  expect(zero.findComponent(PaymentMethodSelect).exists()).toBe(false)
  expect(button(zero, '确认退货').attributes('disabled')).toBeUndefined()
  await button(zero, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls.at(-1)![2].settlement).toEqual({ refund_amount: 0, collection_amount: 0, method: null, channel: null, confirmed: true })
  expect(zero.emitted('success')).toHaveLength(1)
})

it('手机退货先断网再收到报价变化时，仍冻结原内容并允许原请求重试', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  mocks.submit.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce({ response: { status: 409, data: { success: false, code: 'CHECKOUT_RETURN_QUOTE_CHANGED' } } })
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
  expect(button(wrapper, '核对退款').attributes('disabled')).toBeDefined()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[1][2]).toEqual(mocks.submit.mock.calls[0][2])
  expect(mocks.submit.mock.calls[2][2]).toEqual(mocks.submit.mock.calls[0][2])
  expect(wrapper.emitted('success')).toHaveLength(1)
})
