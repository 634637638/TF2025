import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElForm, ElInput, ElSelect } from 'element-plus'
import { PaymentMethodSelect, PaymentChannelSelect } from '@/components/payment'
import SalesGoodsCheckoutDialog from '@/views/sales/page/SalesGoodsCheckoutDialog.vue'
import SalesGoodsLine from '@/views/sales/page/SalesGoodsLine.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import { buildCheckoutInput, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { buildQuickCheckoutPhone, createDefaultQuickSaleForm } from '@/components/query/quick-sale/helpers'
import type { CheckoutGoodsDraft, CheckoutCustomerForm } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ options: vi.fn(), quote: vi.fn(), checkout: vi.fn(), stores: vi.fn(), operators: vi.fn(), customers: vi.fn(), put: vi.fn(), success: vi.fn(), error: vi.fn(), confirm: vi.fn(), view: true, create: true, gift: true, sell: true, hidden: new Set<string>() }))
vi.mock('@/api/sales-checkout', () => ({ getCheckoutGoods: mocks.options, checkoutSale: mocks.checkout, quoteCheckoutSale: mocks.quote }))
vi.mock('@/services/reference-options', () => ({ getCachedStores: mocks.stores, searchOperators: mocks.operators }))
vi.mock('@/services/customer-options', () => ({ searchCustomerOptions: mocks.customers }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { put: mocks.put } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7, name: '销售员' } }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => mocks.view), canCreate: computed(() => mocks.create), canSell: computed(() => mocks.sell), hasPermission: (action: string) => action === 'view' ? mocks.view : action === 'gift' ? mocks.gift : mocks.create }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
const Dialog = { props: { modelValue: Boolean, beforeClose: Function }, emits: ['update:modelValue'],
  template: '<div v-if="modelValue" class="checkout-dialog" @keydown.esc="beforeClose(() => $emit(\'update:modelValue\', false))"><button aria-label="关闭" @click="beforeClose(() => $emit(\'update:modelValue\', false))">关闭</button><slot /><slot name="footer" /></div>' }
const option = { id: 56, name: '充电宝', brand_name: '品牌乙', product_model: 'P10', barcode: '0123', sale_price: 30, quantity: 125, serial_quantity: 2 }
const form = (): CheckoutCustomerForm => ({ customer_name: '测试客户', customer_phone: '13800138000', store_id: 1, operator_id: 7, sale_time: '2026-11-13', payment_method: 'cash', payment_channel: '', transaction_no: '', remarks: '整批一个备注' })
const draft = (): CheckoutGoodsDraft => ({ key: 'goods1', option, quantity: 2, unit_price: 30, sale_type: 'sale', linked_phone_id: null, serial_mode: false, serial_numbers: [], gift_return_unit_price: null })
const wrappers: ReturnType<typeof mount>[] = []
const handlers = new Map<HTMLElement, () => Promise<void>>()
const infiniteScroll = { mounted(el: HTMLElement, binding: { value: () => Promise<void> }) { handlers.set(el, binding.value) }, unmounted(el: HTMLElement) { handlers.delete(el) } }
const render = async (phones = [] as Array<{ phone_id: number; sale_price: number; label: string }>, props: Partial<InstanceType<typeof SalesGoodsCheckoutDialog>['$props']> = {}) => {
  const wrapper = mount(SalesGoodsCheckoutDialog, { props: { modelValue: true, defaults: form(), phones, ...props }, global: { plugins: [ElementPlus], components: { PaymentMethodSelect, PaymentChannelSelect }, stubs: { MobileDialog: Dialog, SectionLoading: true }, directives: { permission: {}, 'infinite-scroll': infiniteScroll } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find(item => item.text() === label)!
const populate = async (wrapper: Awaited<ReturnType<typeof render>>, value = draft()) => { wrapper.findComponent(SalesGoodsLine).vm.$emit('update:modelValue', value); await flushPromises() }
beforeEach(() => {
  mocks.view = mocks.create = mocks.gift = mocks.sell = true; mocks.hidden.clear()
  mocks.options.mockResolvedValue({ success: true, data: { data: [option], pagination: { total: 1 } } })
  mocks.stores.mockResolvedValue({ success: true, data: [{ id: 1, name: '一店', status: 1 }, { id: 2, name: '二店', status: 1 }] })
  mocks.operators.mockResolvedValue({ success: true, data: [{ id: 7, name: '销售员' }] })
  mocks.checkout.mockResolvedValue({ success: true, data: { order_id: 9, order_no: 'SO9', items: [], payment_ids: [], total_amount: 60, points_earned: 1, points_used: 0 } })
  mocks.quote.mockResolvedValue({ success: true, data: { available_points: 10, balance: 20, redemption_ready: true, points_per_yuan: 10, points_used: 10, points_awarded: 0, deduction_cents: 100, gross_cents: 6000, payable_cents: 5900, balance_after: 10, lines: [] } })
  mocks.customers.mockResolvedValue([]); mocks.put.mockResolvedValue({ success: true }); mocks.confirm.mockResolvedValue(false)
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })
describe('共同结算输入', () => {
  it('快速出库待建设备与已有库存互斥，金额保留，商品临时关联交给后端替换', () => {
    const phone = buildQuickCheckoutPhone({ ...createDefaultQuickSaleForm(7), brand_id: 1, model_id: 2, color_id: 3,
      memory_id: 4, supplier_id: 5, imei: 'SN0001', serial_number: 'sn0001', isNoIMEIMode: true,
      purchase_cost: 80.01, sale_price: 100.02 })
    const virtual = [{ phone_id: 1, sale_price: 100.02, label: '待建设备' }]
    const input = buildCheckoutInput(form(), virtual, [{ ...draft(), linked_phone_id: 1 }], 'a'.repeat(32), phone)
    expect(input).toMatchObject({ phones: [], quick_phone: { imei: 'SN0001', serial_number: 'SN0001', purchase_cost: 80.01 },
      payment_info: { payment_amount: 160.02 }, accessories: [{ linked_phone_id: 1 }] })
    expect(() => buildCheckoutInput(form(), [{ ...virtual[0], phone_id: 12 }], [draft()], 'a'.repeat(32), phone)).toThrow('不一致')
  })
  it('单卖与混合单按分计合计、零价赠品、原约定零元及逐台手机关联不丢失', () => {
    const phone = { phone_id: 12, sale_price: 100.01, label: '手机' }
    const gift = { ...draft(), key: 'gift', sale_type: 'gift' as const, quantity: 1, linked_phone_id: 12, gift_return_unit_price: 0 }
    const data = buildCheckoutInput(form(), [phone], [{ ...draft(), linked_phone_id: 12 }, gift], 'a'.repeat(32))
    expect(data.payment_info.payment_amount).toBe(160.01)
    expect(data.accessories[1]).toMatchObject({ unit_price: 0, quantity: 1, linked_phone_id: 12, gift_return_unit_price: 0 })
    expect(data.phones).toEqual([{ phone_id: 12, sale_price: 100.01 }])
    expect(buildCheckoutInput(form(), [], [draft()], 'a'.repeat(32)).accessories[0]).not.toHaveProperty('linked_phone_id')
  })
  it('SN自动计数、保留前导零，不允许同一单跨行或行内重复、超库及遗漏手机关联', () => {
    const serial = { ...draft(), serial_mode: true, serial_numbers: ['00aa', '00bb'], quantity: 999 }
    expect(buildCheckoutInput(form(), [], [serial], 'a'.repeat(32)).accessories[0]).toMatchObject({ quantity: 2, serial_numbers: ['00AA', '00BB'] })
    for (const rows of [[serial, { ...serial, key: 'other' }], [{ ...serial, serial_numbers: ['AA', 'aa'] }], [{ ...draft(), quantity: 126 }], [{ ...draft(), quantity: 0 }]]) expect(() => buildCheckoutInput(form(), [], rows, 'a'.repeat(32))).toThrow()
    expect(() => buildCheckoutInput(form(), [{ phone_id: 12, sale_price: 100, label: '手机' }], [draft()], 'a'.repeat(32))).toThrow('关联手机')
  })
})
describe('商品单卖与搭售结算弹窗', () => {
  it('贴膜固定当前客户、只检索膜，免费赠送和跨店办理仍使用共同结算', async () => {
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmEligibleForFree: true })
    expect(wrapper.findComponent(CustomerNameLockInput).exists()).toBe(false)
    const line = wrapper.findComponent(SalesGoodsLine)
    expect(line.props('modelValue').sale_type).toBe('gift')
    expect(line.props('filmOnly')).toBe(true)
    await line.findAllComponents(ElSelect)[0].props('remoteMethod')?.('膜'); await flushPromises()
    expect(mocks.options).toHaveBeenLastCalledWith(expect.objectContaining({ store_id: 1, film_only: true }), expect.any(AbortSignal))
    wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2); await flushPromises()
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0 })
    expect(wrapper.text()).not.toContain('赠品未退回约定单价')
    await button(wrapper, '确认办理贴膜').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9 }, phones: [], store_id: 2,
      customer_info: { name: form().customer_name, phone: form().customer_phone }, accessories: [expect.objectContaining({ sale_type: 'gift', unit_price: 0 })], payment_info: expect.objectContaining({ payment_amount: 0 }) }))
  })
  it('贴膜无有效购买资格只允许收费，保留积分试算扩展并拒绝伪造赠送', async () => {
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9 })
    expect(wrapper.findComponent(SalesGoodsLine).props('allowGift')).toBe(false)
    await populate(wrapper, { ...draft(), sale_type: 'gift' })
    await button(wrapper, '确认办理贴膜').trigger('click'); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9 }, phones: [] }), expect.any(AbortSignal))
    await button(wrapper, '确认办理贴膜').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9 }, payment_info: expect.objectContaining({ payment_amount: 59 }) }))
  })
  it('公共门店按严格范围加载，单卖提交共同结算并通知父页刷新', async () => {
    const wrapper = await render(); await populate(wrapper)
    expect(mocks.stores).toHaveBeenCalledWith(true)
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ phones: [], accessories: [expect.objectContaining({ accessory_id: 56, quantity: 2 })], remarks: '整批一个备注', payment_info: expect.objectContaining({ payment_amount: 60 }) }))
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
  it('混合单必须逐条选关联手机，赠品0售价且保存约定金额', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }, { phone_id: 13, sale_price: 200, label: '手机乙' }])
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0, gift_return_unit_price: 20 })
    await button(wrapper, '确认整单结算').trigger('click'); expect(mocks.checkout).not.toHaveBeenCalled()
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0, linked_phone_id: 13, gift_return_unit_price: 20 })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ phones: [{ phone_id: 12, sale_price: 100 }, { phone_id: 13, sale_price: 200 }], accessories: [expect.objectContaining({ sale_type: 'gift', unit_price: 0, linked_phone_id: 13, gift_return_unit_price: 20 })], payment_info: expect.objectContaining({ payment_amount: 300 }) }))
  })
  it('明确拒绝后可修正商品，重新试算并提交；不误报结果未知', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'CHECKOUT_INVALID' } } })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
    expect(wrapper.text()).not.toContain('提交结果尚未确认')
    expect(wrapper.emitted('success')).toBeUndefined()
    await populate(wrapper, { ...draft(), quantity: 1 })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout.mock.calls[1][0]).toMatchObject({ request_key: mocks.checkout.mock.calls[0][0].request_key, accessories: [{ quantity: 1 }] })
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('积分余额明确不足后废弃旧试算，重新试算后才允许提交', async () => {
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    mocks.checkout.mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'POINTS_AVAILABLE_INSUFFICIENT' } } })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledOnce()
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledTimes(2)
    expect(mocks.checkout.mock.calls[1][0]).toEqual(mocks.checkout.mock.calls[0][0])
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('网络结果未知后收到明确拒绝也不能解冻或改变原请求', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'CHECKOUT_INVALID' } } })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
    expect(mocks.checkout.mock.calls[1][0]).toEqual(mocks.checkout.mock.calls[0][0])
    expect(wrapper.emitted('success')).toBeUndefined()
  })
  it.each(['network', 'invalid'])('结果未知（%s）冻结客户及商品草稿，禁止重新试算，只能同内容重试', async failure => {
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone } })
    await populate(wrapper, { ...draft(), serial_mode: true, serial_numbers: ['00AA', '00BB'] })
    if (failure === 'network') mocks.checkout.mockRejectedValueOnce(new Error('network'))
    else mocks.checkout.mockResolvedValueOnce({ success: false })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    const first = mocks.checkout.mock.calls[0][0]
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
    expect(wrapper.findComponent(SalesGoodsLine).props('disabled')).toBe(true)
    expect(wrapper.findAll('input, textarea').filter(control => !(control.element as HTMLInputElement).disabled)
      .map(control => control.html())).toEqual([])
    expect(button(wrapper, '添加商品').attributes('disabled')).toBeDefined()
    expect(button(wrapper, '积分试算').attributes('disabled')).toBeDefined()
    const name = wrapper.findComponent(CustomerNameLockInput)
    name.vm.$emit('unlock'); await flushPromises()
    expect(name.props('editing')).toBe(false)
    expect(name.find('[aria-label="更换客户"]').exists()).toBe(false)
    expect(button(wrapper, '取消').attributes('disabled')).toBeUndefined()
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout.mock.calls[1][0]).toEqual(first)
    expect(mocks.quote).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('网络失败保留草稿及请求标识，提交期间禁止重复结算', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    const key = mocks.checkout.mock.calls[0][0].request_key
    expect(wrapper.text()).toContain('提交结果尚未确认')
    let resolve: ((value: unknown) => void) | undefined
    mocks.checkout.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await button(wrapper, '确认整单结算').trigger('click'); await button(wrapper, '确认整单结算').trigger('click')
    expect(mocks.checkout).toHaveBeenCalledTimes(2)
    expect(mocks.checkout.mock.calls[1][0].request_key).toBe(key)
    resolve?.({ success: true, data: { order_no: 'SO9', points_earned: 1 } }); await flushPromises()
  })
  it.each(['取消', '关闭', 'Escape'])('%s未提交销售直接关闭，不弹确认或提交，重开重置商品草稿', async action => {
    const wrapper = await render(); await populate(wrapper)
    if (action === 'Escape') await wrapper.find('.checkout-dialog').trigger('keydown', { key: 'Escape' })
    else await button(wrapper, action).trigger('click')
    await flushPromises()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    expect(wrapper.findComponent(SalesGoodsLine).props('modelValue')).toMatchObject({ option: null, quantity: 1, serial_numbers: [] })
  })
  it('提交结果未确认时仍可直接关闭，不在关闭时再次提交', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('提交结果尚未确认')
    await button(wrapper, '取消').trigger('click'); await flushPromises()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.checkout).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
  it('销售请求进行中不能取消或重复提交，结束后可直接关闭', async () => {
    const wrapper = await render(); await populate(wrapper)
    let reject: ((error: Error) => void) | undefined
    mocks.checkout.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    await button(wrapper, '确认整单结算').trigger('click')
    await button(wrapper, '关闭').trigger('click')
    await wrapper.find('.checkout-dialog').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(button(wrapper, '取消').attributes('disabled')).toBeDefined()
    expect(mocks.confirm).not.toHaveBeenCalled()
    reject?.(new Error('network')); await flushPromises()
    await button(wrapper, '取消').trigger('click'); await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(mocks.checkout).toHaveBeenCalledOnce()
  })
  it('无赠送权限及必要字段隐藏不提交', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.gift = false; await populate(wrapper, { ...draft(), sale_type: 'gift' })
    await button(wrapper, '确认整单结算').trigger('click'); expect(mocks.checkout).not.toHaveBeenCalled()
    mocks.hidden.add('customer_info.customer_phone')
    await wrapper.setProps({ phoneFieldsAllowed: false }); await flushPromises()
    await button(wrapper, '确认整单结算').trigger('click'); expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('商品超过100条可继续滚动，切店清除旧商品和SN', async () => {
    const wrapper = await render()
    const line = wrapper.findComponent(SalesGoodsLine)
    const select = line.findAllComponents(ElSelect)[0]
    mocks.options.mockImplementation(async (params: { page: number; page_size: number }) => ({ success: true, data: { data: Array.from({ length: params.page === 7 ? 5 : 20 }, (_, index) => ({ ...option, id: (params.page - 1) * params.page_size + index + 1 })), pagination: { total: 125 } } }))
    await select.props('remoteMethod')?.('充电'); await flushPromises()
    for (let page = 2; page <= 7; page++) { await handlers.values().next().value?.(); await flushPromises() }
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(125)
    await populate(wrapper, { ...draft(), serial_mode: true, serial_numbers: ['00AA'] })
    wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2); await flushPromises()
    expect(wrapper.findComponent(SalesGoodsLine).props('modelValue')).toMatchObject({ option: null, serial_numbers: [] })
  })
  it('新搜索取消旧请求，迟到响应不覆盖新候选且不提前结束加载', async () => {
    const wrapper = await render()
    const select = wrapper.findComponent(SalesGoodsLine).findAllComponents(ElSelect)[0]
    let resolveOld: ((value: unknown) => void) | undefined
    let resolveNew: ((value: unknown) => void) | undefined
    mocks.options.mockImplementationOnce(() => new Promise(done => { resolveOld = done }))
      .mockImplementationOnce(() => new Promise(done => { resolveNew = done }))
    const old = select.props('remoteMethod')?.('旧商品')
    const oldSignal = mocks.options.mock.calls.at(-1)![1] as AbortSignal
    const latest = select.props('remoteMethod')?.('新商品')
    expect(oldSignal.aborted).toBe(true)
    resolveOld?.({ success: true, data: { data: [{ ...option, name: '旧商品' }], pagination: { total: 1 } } })
    await old; await flushPromises()
    expect(select.props('loading')).toBe(true)
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(0)
    resolveNew?.({ success: true, data: { data: [{ ...option, name: '新商品' }], pagination: { total: 1 } } })
    await latest; await flushPromises()
    expect(select.props('loading')).toBe(false)
    expect(select.findComponent({ name: 'ElOption' }).props('label')).toContain('新商品')
    expect(mocks.error).not.toHaveBeenCalled()
  })
  it('合单隐藏的备注及交易号不展示也不提交', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }])
    await wrapper.setProps({ phoneFieldVisible: () => false, defaults: { ...form(), payment_method: 'mobile', payment_channel: 'alipay', transaction_no: '草稿流水号' } })
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    expect(wrapper.text()).not.toContain('整单备注')
    expect(wrapper.text()).not.toContain('交易流水号')
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledOnce()
    const input = mocks.checkout.mock.calls[0][0]
    expect(input).not.toHaveProperty('remarks')
    expect(input.payment_info).not.toHaveProperty('transaction_no')
  })
  it('手机搭售沿用已选客户及姓名锁，修改姓名只提交姓名并重新锁定', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }])
    await wrapper.setProps({ modelValue: false, defaults: { ...form(), apple_id: 'fixture@example.invalid' }, initialCustomer: { id: 9, name: '原客户', phone: form().customer_phone } })
    await wrapper.setProps({ modelValue: true }); await flushPromises()
    const name = wrapper.findComponent(CustomerNameLockInput)
    expect(name.props('selected')).toBe(true)
    expect(name.find('input').attributes('readonly')).toBeDefined()
    expect(wrapper.find('input[inputmode="tel"]').attributes('readonly')).toBeDefined()
    name.vm.$emit('unlock'); await flushPromises()
    await name.find('input').setValue('修改姓名')
    name.vm.$emit('save'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/customers/9', { name: '修改姓名' })
    expect(name.props('editing')).toBe(false)
    expect(name.props('modelValue')).toBe('修改姓名')
    expect(wrapper.emitted('customer-updated')).toEqual([[{ id: 9, name: '修改姓名', phone: form().customer_phone }]])
    name.vm.$emit('clear'); await flushPromises()
    expect(name.props('selected')).toBe(false)
    expect(wrapper.find<HTMLInputElement>('input[inputmode="tel"]').element.value).toBe('')
    await wrapper.find('input[inputmode="tel"]').setValue('13900000000')
    await name.find('input').setValue('新客户')
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout.mock.calls[0][0].customer_info).toEqual({ name: '新客户', phone: '13900000000' })
  })
  it('SN文本保留换行以支持逐件录入，手机客户搜索复用公共入口及姓名锁', async () => {
    const wrapper = await render(); await populate(wrapper, { ...draft(), serial_mode: true, serial_numbers: ['00AA'] })
    const textarea = wrapper.findComponent(SalesGoodsLine).findAllComponents(ElInput).find(item => item.props('type') === 'textarea')!
    textarea.vm.$emit('update:modelValue', '00AA\n'); await flushPromises()
    expect(textarea.props('modelValue')).toBe('00AA\n')
    textarea.vm.$emit('update:modelValue', '00AA\n00BB'); await flushPromises()
    expect(wrapper.findComponent(SalesGoodsLine).props('modelValue').serial_numbers).toEqual(['00AA', '00BB'])
    const phone = wrapper.find('input[inputmode="tel"]')
    expect(phone.exists()).toBe(true)
    await phone.setValue('138'); await flushPromises()
    expect(mocks.customers).toHaveBeenCalledWith('138', 'sales')
  })
})


describe('商品明细积分抵扣', () => {
  it('输入明细积分须先试算，以服务端净额提交并展示可用、抵扣和实收', async () => {
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ accessories: [expect.objectContaining({ redeem_points: 10 })] }), expect.any(AbortSignal))
    expect(wrapper.text()).toContain('可用积分 10')
    expect(wrapper.text()).toContain('整单实收：¥59')
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ accessories: [expect.objectContaining({ redeem_points: 10 })], payment_info: expect.objectContaining({ payment_amount: 59 }) }))
  })
  it('价格或客户等内容变化立即废弃试算，未重新核对不能提交抵扣', async () => {
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    await populate(wrapper, { ...draft(), redeem_points: 10, unit_price: 31 })
    expect(wrapper.text()).not.toContain('可用积分 10')
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('旧试算慢返回不能覆盖新明细，关闭后也不恢复旧试算', async () => {
    let resolve: ((value: unknown) => void) | undefined
    mocks.quote.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '积分试算').trigger('click')
    await populate(wrapper, { ...draft(), redeem_points: 9 })
    resolve?.({ success: true, data: { available_points: 999, payable_cents: 1 } }); await flushPromises()
    expect(wrapper.text()).not.toContain('999')
    expect(wrapper.text()).toContain('请先进行积分试算')
    await button(wrapper, '取消').trigger('click'); await wrapper.setProps({ modelValue: false }); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('全额积分抵扣可提交0现金，失败重试保持原净额和请求键', async () => {
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 600 })
    mocks.quote.mockResolvedValueOnce({ success: true, data: { available_points: 600, points_used: 600, points_awarded: 0, deduction_cents: 6000, payable_cents: 0, redemption_ready: true } })
    await button(wrapper, '积分试算').trigger('click'); await flushPromises()
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    await button(wrapper, '确认整单结算').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledTimes(2)
    expect(mocks.checkout.mock.calls[0][0]).toEqual(mocks.checkout.mock.calls[1][0])
    expect(mocks.checkout.mock.calls[0][0].payment_info.payment_amount).toBe(0)
  })
  it('赠送切换清除抵扣，非法积分不能提交，零值保持原载荷', async () => {
    expect(buildCheckoutInput(form(), [], [{ ...draft(), redeem_points: 0 }], 'a'.repeat(32)).accessories[0]).not.toHaveProperty('redeem_points')
    for (const redeem_points of [-1, 1.1, 2147483648, NaN]) expect(() => buildCheckoutInput(form(), [], [{ ...draft(), redeem_points }], 'a'.repeat(32))).toThrow('抵扣积分')
    expect(() => buildCheckoutInput(form(), [], [{ ...draft(), sale_type: 'gift', redeem_points: 1 }], 'a'.repeat(32))).toThrow('赠品不能')
    const wrapper = await render(); await populate(wrapper, { ...draft(), redeem_points: 10 })
    const line = wrapper.findComponent(SalesGoodsLine)
    line.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', 'gift'); await flushPromises()
    expect(line.props('modelValue').redeem_points).toBe(0)
  })
})

it.each([
  [400, 'CHECKOUT_INVALID', false, true], [400, 'CHECKOUT_RETURN_INVALID', false, true],
  [400, 'POINTS_AVAILABLE_INSUFFICIENT', false, true], [409, 'CHECKOUT_RETURN_QUOTE_CHANGED', false, true],
  [409, 'CHECKOUT_RETURN_PAYMENT_REQUIRED', false, true], [409, 'CHECKOUT_REQUEST_CONFLICT', false, false],
  [409, 'CHECKOUT_RETURN_REQUEST_CONFLICT', false, false], [409, 'CHECKOUT_PENDING', false, false],
  [409, 'CHECKOUT_RETURN_NOT_READY', false, false], [500, 'CHECKOUT_INVALID', false, false],
  [400, 'UNKNOWN_ERROR', false, false], [400, 'CHECKOUT_INVALID', true, false],
  [400, 'CHECKOUT_INVALID', undefined, false], [undefined, 'CHECKOUT_INVALID', false, false]
])('提交错误状态%s、代码%s、success=%s的明确拒绝判断为%s', (status, code, success, expected) => {
  expect(isCheckoutSubmissionRejected({ response: { status, data: { code, success } } })).toBe(expected)
})
