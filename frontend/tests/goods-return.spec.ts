import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElCheckbox, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect } from 'element-plus'
import Dialog from '@/views/query/page/GoodsReturnDialog.vue'
import SalesGoodsLine from '@/views/sales/page/SalesGoodsLine.vue'
import { isGoodsExchangeContext, isGoodsExchangeQuote, isGoodsExchangeResult } from '@/utils/sales-checkout'
import { PaymentMethodSelect, PaymentChannelSelect } from '@/components/payment'
import type { AccessorySaleRecord } from '@/types/accessory'
import type { GoodsReturnContext, GoodsReturnQuote, GoodsExchangeContext, GoodsExchangeInput, GoodsExchangeQuote, CheckoutGoodsDraft } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ context: vi.fn(), quote: vi.fn(), submit: vi.fn(), exchangeContext: vi.fn(), exchangeQuote: vi.fn(), exchangeSubmit: vi.fn(),
  options: vi.fn(), operators: vi.fn(), stores: vi.fn(), warning: vi.fn(), success: vi.fn(), hidden: new Set<string>() }))
const permission = ref(true), exchangePermission = ref(true), goodsWrite = ref(true), giftPermission = ref(true)
vi.mock('@/api/sales-checkout', () => ({ getGoodsReturnContext: mocks.context, quoteGoodsReturn: mocks.quote, submitGoodsReturn: mocks.submit,
  getGoodsExchangeContext: mocks.exchangeContext, quoteGoodsExchange: mocks.exchangeQuote, submitGoodsExchange: mocks.exchangeSubmit, getCheckoutGoods: mocks.options }))
vi.mock('@/services/reference-options', () => ({ getStores: mocks.stores, searchOperators: mocks.operators }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => permission.value), canCreate: computed(() => goodsWrite.value),
  hasPermission: (action: string) => permission.value && (module === 'query' && ['goods-sell', 'goods-gift'].includes(action) ? false : module === 'query' && action === 'exchange' ? exchangePermission.value : module === 'accessories' && action === 'gift' ? giftPermission.value : module === 'accessories' && action === 'sell' ? goodsWrite.value : true) }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(false) }) }))

const sale: AccessorySaleRecord = { id: 51, accessory_id: 5, order_id: 10, order_item_id: 50, sale_no: 'AS001', order_no: 'SO001',
  linked_phone_invoice: null, sale_type: 'sale', store_id: 1, store_name: '一店', name: '原商品', barcode: null, category: null,
  brand_name: null, product_model: null, color_name: null, unit: '个', customer_name: null, customer_phone: null, quantity: 3,
  unit_price: 20, total_price: 60, purchase_cost: null, profit: null, points_awarded: 6, operator_name: null, sale_time: null, remarks: null, has_snapshot: 1 }
const context = (extra: Partial<GoodsReturnContext> = {}): GoodsReturnContext => ({ order_id: 10, item_id: 50, name: '原商品', sale_type: 'sale',
  quantity: 3, returned_quantity: 0, remaining_quantity: 3, serial_tracking: false, serial_numbers: [], ...extra })
const exchangeContext = (extra: Partial<GoodsExchangeContext> = {}): GoodsExchangeContext => ({ ...context(), replacement_sale_type: 'sale', gift_charge_settled: false, ...extra })
const quote = (extra: Partial<GoodsReturnQuote> = {}): GoodsReturnQuote => ({ order_id: 10, item_id: 50, store_id: 1, quantity: 1, serial_numbers: [],
  remaining_quantity: 2, base_refund_amount: 20, points_recovery_amount: 0, points_compensation_amount: 0, refund_amount: 20, collection_amount: 0,
  points_delta: -2, points_award_returned: 2, points_redemption_returned: 0, ...extra })
const Shell = { props: { modelValue: Boolean, beforeClose: Function }, emits: ['update:modelValue'],
  template: '<div v-if="modelValue"><button class="top-close" @click="beforeClose(() => $emit(\'update:modelValue\', false))">顶部关闭</button><slot /><slot name="footer" /></div>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async (mode: 'return' | 'exchange' = 'return') => {
  const wrapper = mount(Dialog, { props: { modelValue: true, sale, mode }, global: { plugins: [ElementPlus],
    components: { PaymentMethodSelect, PaymentChannelSelect }, stubs: { MobileDialog: Shell, SectionLoading: true }, directives: { permission: {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
type Wrapper = Awaited<ReturnType<typeof render>>
const button = (wrapper: Wrapper, label: string) => wrapper.findAll('button').find(item => item.text() === label)!
const complete = async (wrapper: Wrapper) => {
  wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', '客户退货')
  wrapper.findAllComponents(ElCheckbox)[0].vm.$emit('update:modelValue', true)
  await flushPromises()
}
const calculate = async (wrapper: Wrapper) => { await complete(wrapper); await button(wrapper, '核对退款').trigger('click'); await flushPromises() }
const pay = async (wrapper: Wrapper, method = 'cash') => {
  wrapper.findComponent(PaymentMethodSelect).vm.$emit('update:modelValue', method)
  wrapper.findAllComponents(ElCheckbox)[1].vm.$emit('update:modelValue', true)
  await flushPromises()
}
beforeEach(() => {
  permission.value = exchangePermission.value = goodsWrite.value = giftPermission.value = true; mocks.hidden.clear()
  mocks.context.mockResolvedValue({ success: true, data: context() })
  mocks.stores.mockResolvedValue({ data: [{ id: 1, name: '一店' }, { id: 2, name: '二店' }] })
  mocks.quote.mockResolvedValue({ success: true, data: quote() })
  mocks.submit.mockResolvedValue({ success: true, data: { ...quote(), aftersale_id: 1 } })
  mocks.exchangeContext.mockResolvedValue({ success: true, data: exchangeContext() })
  mocks.exchangeQuote.mockResolvedValue({ success: true, data: exchangeQuote() })
  mocks.exchangeSubmit.mockResolvedValue({ success: true, data: { ...exchangeQuote(), aftersale_id: 1, replacement_order_id: 11,
    replacement_item_id: 51, root_order_id: 10, root_item_id: 50, exchange_credit_amount: 20 } })
  mocks.options.mockResolvedValue({ success: true, data: { data: [replacementOption], pagination: { total: 1 } } })
  mocks.operators.mockResolvedValue({ success: true, data: [{ id: 8, name: '新销售员' }] })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('按原明细读取可退量，核验实物后试算；原净额、积分追回/补退和补款清楚展示', async () => {
  const wrapper = await render()
  expect(mocks.context).toHaveBeenCalledWith(10, 50, expect.any(AbortSignal))
  expect(mocks.stores).toHaveBeenCalledWith({ strictScope: true })
  expect(wrapper.text()).toContain('剩余可退')
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  expect(mocks.quote).not.toHaveBeenCalled(); expect(mocks.warning).toHaveBeenCalledOnce()
  await calculate(wrapper)
  expect(mocks.quote).toHaveBeenCalledWith(10, 50, expect.objectContaining({ quantity: 1, store_id: 1, restock_confirmed: true,
    return_reason: '客户退货', request_key: expect.stringMatching(/^[a-f0-9]{32}$/) }), expect.any(AbortSignal))
  expect(wrapper.text()).toContain('原实付应退'); expect(wrapper.text()).toContain('客户需补差价')
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
})

it('确认退款及支付渠道后才提交，数量/资金来自原试算，不传客户端售价或成本', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper, 'mobile')
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  wrapper.findComponent(PaymentChannelSelect).vm.$emit('update:modelValue', 'wechat'); await flushPromises()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  const payload = mocks.submit.mock.calls[0]?.[2]
  expect(payload.settlement).toEqual({ refund_amount: 20, collection_amount: 0, method: 'mobile', channel: 'wechat', confirmed: true })
  expect(payload.unit_price).toBeUndefined(); expect(payload.purchase_cost).toBeUndefined()
  expect(wrapper.emitted('success')).toHaveLength(1); expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
})

it('SN按实际选择计件；补款不能选原路退回，零金额不产生支付方式', async () => {
  mocks.context.mockResolvedValue({ success: true, data: context({ serial_tracking: true, serial_numbers: ['SN1', 'SN3'], returned_quantity: 1, remaining_quantity: 2 }) })
  mocks.quote.mockResolvedValue({ success: true, data: quote({ serial_numbers: ['SN3'], remaining_quantity: 1, refund_amount: 0, collection_amount: 5, points_recovery_amount: 25 }) })
  mocks.submit.mockResolvedValue({ success: true, data: { ...quote({ serial_numbers: ['SN3'], remaining_quantity: 1,
    refund_amount: 0, collection_amount: 5, points_recovery_amount: 25 }), aftersale_id: 1 } })
  const wrapper = await render()
  expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false)
  wrapper.findAllComponents(ElSelect)[2].vm.$emit('update:modelValue', ['SN3']); await calculate(wrapper)
  expect(mocks.quote.mock.calls[0]?.[2].serial_numbers).toEqual(['SN3'])
  expect(mocks.quote.mock.calls[0]?.[2].quantity).toBe(1)
  expect(wrapper.findComponent(PaymentMethodSelect).props('variant')).toBe('sale')
  expect(wrapper.text()).toContain('确认已收取客户需补差价')
  await pay(wrapper); await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[0]?.[2].settlement.collection_amount).toBe(5)
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('赠品零资金退回不填支付，不重复发积分；修改数量废弃旧试算与支付确认', async () => {
  mocks.quote.mockImplementation(async (_order, _item, input) => ({ success: true, data: quote({ quantity: input.quantity,
    remaining_quantity: 3 - input.quantity, refund_amount: 0, base_refund_amount: 0, points_delta: 0 }) }))
  mocks.submit.mockResolvedValue({ success: true, data: { ...quote({ quantity: 2, remaining_quantity: 1,
    refund_amount: 0, base_refund_amount: 0, points_delta: 0 }), aftersale_id: 1 } })
  const wrapper = await render(); await calculate(wrapper)
  expect(wrapper.findComponent(PaymentMethodSelect).exists()).toBe(false)
  wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 2); await flushPromises()
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[0]?.[2].settlement).toEqual({ refund_amount: 0, collection_amount: 0, method: null, channel: null, confirmed: true })
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('提交失败保留原请求键及内容，重试不换键；提交中阻止顶部和取消关闭', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  let reject: ((reason: Error) => void) | undefined
  mocks.submit.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  await button(wrapper, '顶部关闭').trigger('click')
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  reject?.(new Error('network')); await flushPromises()
  expect(wrapper.text()).toContain('提交结果未确认')
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(mocks.submit.mock.calls[1]?.[2]).toEqual(mocks.submit.mock.calls[0]?.[2])
})

it('取消直接关闭不提交，旧试算晚到不能回填；重开清空草稿并换新请求键', async () => {
  const wrapper = await render(); await complete(wrapper)
  let resolve: ((value: unknown) => void) | undefined
  mocks.quote.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await button(wrapper, '核对退款').trigger('click')
  const signal = mocks.quote.mock.calls[0]?.[3] as AbortSignal
  await button(wrapper, '取消').trigger('click')
  expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  await wrapper.setProps({ modelValue: false }); await flushPromises()
  expect(signal.aborted).toBe(true)
  resolve?.({ success: true, data: quote() }); await flushPromises()
  await wrapper.setProps({ modelValue: true }); await flushPromises()
  expect(wrapper.findComponent(ElInputNumber).props('modelValue')).toBe(1)
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
})

it('无权限或隐藏价格不发请求；读取失败、已全退都不能确认退货', async () => {
  permission.value = false
  const denied = await render(); expect(mocks.context).not.toHaveBeenCalled()
  expect(denied.text()).toContain('缺少退货必要权限')
  permission.value = true; mocks.hidden.add('price_info.total_price'); await flushPromises()
  const hidden = await render(); expect(mocks.context).not.toHaveBeenCalled()
  expect(button(hidden, '核对退款').attributes('disabled')).toBeDefined()
  mocks.hidden.clear(); mocks.context.mockRejectedValueOnce(new Error('migration not ready'))
  const failed = await render(); expect(failed.text()).toContain('退货资料读取失败')
  mocks.context.mockResolvedValueOnce({ success: true, data: context({ remaining_quantity: 0, returned_quantity: 3 }) })
  const all = await render(); expect(all.text()).toContain('原单商品已全部退回')
  expect(button(all, '确认退货').attributes('disabled')).toBeDefined()
})

it('修改内容使前次试算失效，备注保留文本域公共行为，日期及数量完整提交', async () => {
  const wrapper = await render(); await calculate(wrapper); await pay(wrapper)
  wrapper.findAllComponents(ElInput).find(item => item.props('type') === 'textarea')?.vm.$emit('update:modelValue', '独立退货备注')
  await flushPromises()
  expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  await button(wrapper, '核对退款').trigger('click'); await flushPromises()
  expect(mocks.quote.mock.calls.at(-1)?.[2].remarks).toBe('独立退货备注')
  expect(mocks.quote.mock.calls.at(-1)?.[2].reversal_date).toMatch(/^\d{4}-\d{2}-\d{2} /)
})

it('拒绝错单、缺字段、损坏数量及不守恒金额，损坏提交回执不能显示退货成功', async () => {
  mocks.context.mockResolvedValueOnce({ success: true, data: context({ returned_quantity: 2 }) })
  const invalidContext = await render()
  expect(invalidContext.text()).toContain('退货资料读取失败')
  const wrapper = await render()
  for (const invalid of [{}, quote({ order_id: 99 }), quote({ quantity: 2 }), quote({ refund_amount: 21 }),
    quote({ refund_amount: -1 }), quote({ collection_amount: 20 }), { ...quote(), base_refund_amount: null }]) {
    mocks.quote.mockResolvedValueOnce({ success: true, data: invalid })
    await calculate(wrapper)
    expect(button(wrapper, '确认退货').attributes('disabled')).toBeDefined()
  }
  expect(mocks.warning).toHaveBeenCalledTimes(7)
  mocks.quote.mockResolvedValueOnce({ success: true, data: quote() })
  await calculate(wrapper); await pay(wrapper)
  mocks.submit.mockResolvedValueOnce({ success: true, data: { ...quote(), aftersale_id: null } })
  await button(wrapper, '确认退货').trigger('click'); await flushPromises()
  expect(wrapper.emitted('success')).toBeUndefined()
  expect(wrapper.text()).toContain('提交结果未确认')
})

const replacementOption = { id: 6, name: '新充电器', brand_name: '新品牌', product_model: 'C50', barcode: null, sale_price: 50, quantity: 10, serial_quantity: 0 }
const replacementDraft = (): CheckoutGoodsDraft => ({ key: 'replacement', option: replacementOption, quantity: 1, unit_price: 50, sale_type: 'sale',
  linked_phone_id: null, serial_mode: false, serial_numbers: [], gift_return_unit_price: null, redeem_points: 0 })
const exchangeQuote = (extra: Partial<GoodsExchangeQuote> = {}): GoodsExchangeQuote => ({ ...quote({ refund_amount: 0, collection_amount: 30 }),
  operator_id: 8, replacement_accessory_id: 6, replacement_serial_numbers: [], replacement_amount: 50, replacement_paid_amount: 30,
  original_collection_amount: 0, points_used: 0, points_earned: 0, deduction_amount: 0, ...extra })
const fillExchange = async (wrapper: Wrapper, draft = replacementDraft()) => {
  await complete(wrapper)
  wrapper.findAllComponents(ElFormItem).find(item => item.props('label') === '新商品销售员')!.findComponent(ElSelect).vm.$emit('update:modelValue', 8)
  wrapper.findComponent(SalesGoodsLine).vm.$emit('update:modelValue', draft)
  await flushPromises()
}

it('换货使用独立context/quote/submit，确认20换50只收30补款，新销售员独立记录', async () => {
  const wrapper = await render('exchange')
  expect(mocks.exchangeContext).toHaveBeenCalledWith(10, 50, expect.any(AbortSignal))
  expect(mocks.context).not.toHaveBeenCalled()
  expect(mocks.operators).toHaveBeenCalledWith({ keyword: undefined, page: 1, page_size: 20 })
  await fillExchange(wrapper)
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises()
  expect(mocks.exchangeQuote).toHaveBeenCalledWith(10, 50, expect.objectContaining({ quantity: 1, operator_id: 8, replacement: { accessory_id: 6, unit_price: 50 } }), expect.any(AbortSignal))
  for (const text of ['新件净应付', '原件抵付新件', '新商品销售员', '¥30', '¥50']) expect(wrapper.text()).toContain(text)
  expect(button(wrapper, '确认换货').attributes('disabled')).toBeDefined()
  await pay(wrapper); await button(wrapper, '确认换货').trigger('click'); await flushPromises()
  expect(mocks.exchangeSubmit.mock.calls[0][2].settlement).toEqual({ refund_amount: 0, collection_amount: 30, method: 'cash', channel: null, confirmed: true })
  expect(mocks.submit).not.toHaveBeenCalled(); expect(wrapper.emitted('success')).toHaveLength(1)
})

it('换入选择复用库存检索，数量跟随退回数量且用途锁定，变更商品或门店清除旧试算', async () => {
  const wrapper = await render('exchange'); await complete(wrapper)
  const line = wrapper.findComponent(SalesGoodsLine), selector = line.findAllComponents(ElSelect)[0]
  selector.vm.$emit('visible-change', true); await flushPromises()
  selector.vm.$emit('update:modelValue', 6); await flushPromises()
  expect(line.props('modelValue')).toMatchObject({ option: { id: 6 }, quantity: 1, unit_price: 50 })
  expect(line.findAllComponents(ElSelect)[1].props('disabled')).toBe(true)
  expect(line.text()).not.toContain('移除此商品')
  const originalQuantity = wrapper.findAllComponents(ElInputNumber)[0]
  originalQuantity.vm.$emit('update:modelValue', 2); await flushPromises()
  expect(line.props('exchangeQuantity')).toBe(2); expect(line.props('modelValue').quantity).toBe(2)
  await fillExchange(wrapper, replacementDraft())
  originalQuantity.vm.$emit('update:modelValue', 1); await flushPromises()
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises(); await pay(wrapper)
  wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2); await flushPromises()
  expect(line.props('modelValue').option).toBeNull()
  expect(button(wrapper, '确认换货').attributes('disabled')).toBeDefined()
})

it('换入SN数须与原件退回数一致，赠品用途和销售/赠送权限不能在页面转换', async () => {
  const wrapper = await render('exchange')
  await fillExchange(wrapper, { ...replacementDraft(), serial_mode: true, serial_numbers: ['NEW01', 'NEW02'] })
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises()
  expect(mocks.exchangeQuote).not.toHaveBeenCalled()
  expect(mocks.warning).toHaveBeenLastCalledWith(expect.stringContaining('换入件数'))
  await fillExchange(wrapper, { ...replacementDraft(), sale_type: 'gift', unit_price: 0 })
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises()
  expect(mocks.exchangeQuote).not.toHaveBeenCalled()
  goodsWrite.value = false; await flushPromises()
  expect(wrapper.findComponent(SalesGoodsLine).exists()).toBe(false)
})

it('换货提交断网冻结草稿，以同键同内容重试；坏回执不提示成功', async () => {
  const wrapper = await render('exchange'); await fillExchange(wrapper)
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises(); await pay(wrapper)
  mocks.exchangeSubmit.mockRejectedValueOnce(new Error('offline'))
  await button(wrapper, '确认换货').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
  expect(button(wrapper, '核对换货差价').attributes('disabled')).toBeDefined()
  mocks.exchangeSubmit.mockResolvedValueOnce({ success: true, data: { ...exchangeQuote(), aftersale_id: 1 } })
  await button(wrapper, '确认换货').trigger('click'); await flushPromises()
  expect(mocks.exchangeSubmit.mock.calls[1][2]).toEqual(mocks.exchangeSubmit.mock.calls[0][2])
  expect(wrapper.emitted('success')).toBeUndefined()
  expect(wrapper.text()).toContain('提交结果未确认')
})

it('撤销换货或销售员字段权限不读取，切模式取消旧请求且不回填', async () => {
  exchangePermission.value = false
  const denied = await render('exchange'); expect(mocks.exchangeContext).not.toHaveBeenCalled()
  denied.unmount(); exchangePermission.value = true; mocks.hidden.add('operator_info.operator_name')
  const hidden = await render('exchange'); expect(mocks.exchangeContext).not.toHaveBeenCalled()
  hidden.unmount(); mocks.hidden.clear()
  let resolve!: (value: unknown) => void
  mocks.exchangeContext.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const wrapper = await render('exchange'), signal: AbortSignal = mocks.exchangeContext.mock.calls[0][2]
  await wrapper.setProps({ mode: 'return' }); await flushPromises()
  expect(signal.aborted).toBe(true)
  resolve({ success: true, data: context({ name: '旧换货迟到' }) }); await flushPromises()
  expect(wrapper.text()).not.toContain('旧换货迟到'); expect(wrapper.findComponent(SalesGoodsLine).exists()).toBe(false)
})

it('换货资金守卫校验新旧SN/销售员、积分净价、实收分配及已确认的现金，不接受全价再收', () => {
  const payload: GoodsExchangeInput = { request_key: 'a'.repeat(32), store_id: 1, operator_id: 8, quantity: 1, serial_numbers: [],
    return_reason: '客户退货', reversal_date: '2026-11-13 10:00:00', remarks: '', restock_confirmed: true,
    replacement: { accessory_id: 6, unit_price: 50 } }
  expect(isGoodsExchangeQuote(exchangeQuote(), exchangeContext(), payload)).toBe(true)
  for (const invalid of [exchangeQuote({ operator_id: 7 }), exchangeQuote({ collection_amount: 50 }), exchangeQuote({ replacement_paid_amount: 50 }),
    exchangeQuote({ original_collection_amount: 1 }), exchangeQuote({ replacement_serial_numbers: ['OTHER'] }), exchangeQuote({ deduction_amount: 1 }),
    exchangeQuote({ points_used: 10 }), exchangeQuote({ replacement_accessory_id: 7 })]) expect(isGoodsExchangeQuote(invalid, exchangeContext(), payload)).toBe(false)
  expect(isGoodsExchangeQuote(exchangeQuote(), exchangeContext(), { ...payload, settlement: { refund_amount: 0, collection_amount: 31, confirmed: true, method: 'cash', channel: null } })).toBe(false)
  const discounted = exchangeQuote({ replacement_amount: 49, collection_amount: 29, replacement_paid_amount: 29, points_used: 10, deduction_amount: 1 })
  expect(isGoodsExchangeQuote(discounted, exchangeContext(), { ...payload, replacement: { ...payload.replacement, redeem_points: 10 } })).toBe(true)
  const result = { ...exchangeQuote(), aftersale_id: 1, replacement_order_id: 11, replacement_item_id: 51, root_order_id: 10, root_item_id: 50, exchange_credit_amount: 20 }
  expect(isGoodsExchangeResult(result, exchangeContext(), payload)).toBe(true)
  expect(isGoodsExchangeResult({ ...result, exchange_credit_amount: 20.001 }, exchangeContext(), payload)).toBe(false)
})

it('已扣款赠品按原实际12元抵付50元收费新件，展示38元补款并保留原赠品类型', async () => {
  giftPermission.value = false
  mocks.exchangeContext.mockResolvedValue({ success: true, data: exchangeContext({ sale_type: 'gift', gift_charge_settled: true }) })
  const facts = exchangeQuote({ base_refund_amount: 12, collection_amount: 38, replacement_paid_amount: 38,
    points_delta: 50, points_award_returned: 0, points_earned: 50 })
  mocks.exchangeQuote.mockResolvedValue({ success: true, data: facts })
  mocks.exchangeSubmit.mockResolvedValue({ success: true, data: { ...facts, aftersale_id: 2, replacement_order_id: 11,
    replacement_item_id: 51, root_order_id: 10, root_item_id: 50, exchange_credit_amount: 12 } })
  const wrapper = await render('exchange')
  expect(wrapper.text()).toContain('按原实际扣款抵付')
  expect(wrapper.findComponent(SalesGoodsLine).props('modelValue').sale_type).toBe('sale')
  await fillExchange(wrapper); await button(wrapper, '核对换货差价').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('¥38'); expect(wrapper.text()).toContain('¥12')
  await pay(wrapper); await button(wrapper, '确认换货').trigger('click'); await flushPromises()
  expect(mocks.exchangeSubmit.mock.calls[0][2].settlement.collection_amount).toBe(38)
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('换入用途按服务端核对结果授权，原赠品权限不能代替已扣款后的商品销售权限', async () => {
  goodsWrite.value = false
  mocks.exchangeContext.mockResolvedValue({ success: true, data: exchangeContext({ sale_type: 'gift', gift_charge_settled: true }) })
  const wrapper = await render('exchange')
  expect(wrapper.text()).toContain('缺少换货必要权限')
  expect(wrapper.findComponent(SalesGoodsLine).exists()).toBe(false)
  expect(button(wrapper, '核对换货差价').attributes('disabled')).toBeDefined()
  expect(mocks.exchangeQuote).not.toHaveBeenCalled()
})

it('缺失或互相矛盾的换货用途上下文拒绝办理，普通未扣款赠品保持赠送用途', async () => {
  for (const invalid of [context(), exchangeContext({ sale_type: 'sale', gift_charge_settled: true }),
    exchangeContext({ sale_type: 'gift' }), exchangeContext({ sale_type: 'gift', replacement_sale_type: 'gift', gift_charge_settled: true })]) {
    expect(isGoodsExchangeContext(invalid, 10, 50)).toBe(false)
  }
  mocks.exchangeContext.mockResolvedValueOnce({ success: true, data: context() })
  const invalid = await render('exchange')
  expect(invalid.text()).toContain('换货资料读取失败')
  const gift = exchangeContext({ sale_type: 'gift', replacement_sale_type: 'gift' })
  expect(isGoodsExchangeContext(gift, 10, 50)).toBe(true)
  goodsWrite.value = false
  mocks.exchangeContext.mockResolvedValueOnce({ success: true, data: gift })
  const wrapper = await render('exchange')
  expect(wrapper.findComponent(SalesGoodsLine).props('modelValue')).toMatchObject({ sale_type: 'gift', unit_price: 0 })
  expect(wrapper.text()).not.toContain('按原实际扣款抵付')
})

it('换入商品动作撤权立即废弃报价，不能沿用原确认金额提交', async () => {
  const wrapper = await render('exchange'); await fillExchange(wrapper)
  await button(wrapper, '核对换货差价').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('新件净应付')
  goodsWrite.value = false; await flushPromises()
  expect(button(wrapper, '确认换货').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('缺少换货必要权限')
  goodsWrite.value = true; await flushPromises()
  expect(wrapper.text()).not.toContain('新件净应付')
  expect(mocks.exchangeSubmit).not.toHaveBeenCalled()
})

it.each(['return', 'exchange'] as const)('%s报价明确变化后必须重新核对，保留录入及原请求键', async mode => {
  const wrapper = await render(mode)
  const submitLabel = mode === 'exchange' ? '确认换货' : '确认退货'
  const quoteLabel = mode === 'exchange' ? '核对换货差价' : '核对退款'
  const submitMock = mode === 'exchange' ? mocks.exchangeSubmit : mocks.submit
  if (mode === 'exchange') { await fillExchange(wrapper); await button(wrapper, quoteLabel).trigger('click'); await flushPromises() }
  else await calculate(wrapper)
  await pay(wrapper)
  submitMock.mockRejectedValueOnce({ response: { status: 409, data: { success: false, code: 'CHECKOUT_RETURN_QUOTE_CHANGED' } } })
  await button(wrapper, submitLabel).trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
  expect(button(wrapper, submitLabel).attributes('disabled')).toBeDefined()
  expect(wrapper.text()).not.toContain('提交结果未确认')
  expect(wrapper.emitted('success')).toBeUndefined()
  await button(wrapper, quoteLabel).trigger('click'); await flushPromises()
  expect(button(wrapper, submitLabel).attributes('disabled')).toBeDefined()
  await pay(wrapper); await button(wrapper, submitLabel).trigger('click'); await flushPromises()
  expect(submitMock.mock.calls[1][2]).toEqual(submitMock.mock.calls[0][2])
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it.each(['return', 'exchange'] as const)('%s先断网再收到报价变化，不能解除原请求冻结', async mode => {
  const wrapper = await render(mode)
  const submitLabel = mode === 'exchange' ? '确认换货' : '确认退货'
  const submitMock = mode === 'exchange' ? mocks.exchangeSubmit : mocks.submit
  if (mode === 'exchange') { await fillExchange(wrapper); await button(wrapper, '核对换货差价').trigger('click'); await flushPromises() }
  else await calculate(wrapper)
  await pay(wrapper)
  submitMock.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce({ response: { status: 409, data: { success: false, code: 'CHECKOUT_RETURN_QUOTE_CHANGED' } } })
  await button(wrapper, submitLabel).trigger('click'); await flushPromises()
  await button(wrapper, submitLabel).trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
  await button(wrapper, submitLabel).trigger('click'); await flushPromises()
  expect(submitMock.mock.calls[1][2]).toEqual(submitMock.mock.calls[0][2])
  expect(submitMock.mock.calls[2][2]).toEqual(submitMock.mock.calls[0][2])
  expect(wrapper.emitted('success')).toHaveLength(1)
})
