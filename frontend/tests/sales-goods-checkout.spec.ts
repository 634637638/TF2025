import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { useAdditionalGoodsCheckout } from '@/composables/useAdditionalGoodsCheckout'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElForm, ElSelect } from 'element-plus'
import { PaymentMethodSelect, PaymentChannelSelect } from '@/components/payment'
import SalesGoodsCheckoutDialog from '@/views/sales/page/SalesGoodsCheckoutDialog.vue'
import SalesGoodsLine from '@/views/sales/page/SalesGoodsLine.vue'
import SalesAdditionalGoods from '@/views/sales/page/SalesAdditionalGoods.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import { buildCheckoutInput, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { buildQuickCheckoutPhone, createDefaultQuickSaleForm } from '@/components/query/quick-sale/helpers'
import type { CheckoutAdditionalGoodsDraft, CheckoutGoodsDraft, CheckoutCustomerForm } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ options: vi.fn(), summary: vi.fn(), quote: vi.fn(), checkout: vi.fn(), stores: vi.fn(), operators: vi.fn(), customers: vi.fn(), post: vi.fn(), put: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), confirm: vi.fn(), desktop: false, view: true, create: true, gift: true, sell: true, queryView: true, queryGoods: false, film: true, customerCreate: true, customerEdit: true, hidden: new Set<string>(), queryHidden: new Set<string>() }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isDesktop: computed(() => mocks.desktop) }) }))
vi.mock('@/api/sales-checkout', () => ({ getCheckoutGoods: mocks.options, getFilmProducts: (customerId: number, params: object, signal: AbortSignal) => mocks.options({ ...params, film_customer_id: customerId }, signal), getCheckoutCustomerSummary: mocks.summary, getFilmCustomerSummary: mocks.summary, checkoutSale: mocks.checkout, quoteCheckoutSale: mocks.quote }))
vi.mock('@/services/reference-options', () => ({ getStores: mocks.stores, searchOperators: mocks.operators }))
vi.mock('@/services/customer-options', () => ({
  searchCustomerOptions: mocks.customers,
  createCustomerProfile: (payload: unknown) => mocks.post('/customers', payload)
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { post: mocks.post, put: mocks.put } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7, name: '销售员' } }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => {
  const allowed = (action: string): boolean => {
    if (module === 'customers') return action === 'create' ? mocks.customerCreate : action === 'edit' ? mocks.customerEdit : false
    return action.startsWith('goods-') ? mocks.queryGoods : action === 'film' ? mocks.film : action === 'view' ? (module === 'query' ? mocks.queryView : mocks.view) : action === 'gift' ? mocks.gift : action === 'sell' ? mocks.sell : mocks.create
  }
  return { canView: computed(() => allowed('view')), canCreate: computed(() => allowed('create')), canEdit: computed(() => allowed('edit')), canSell: computed(() => allowed('sell')), hasPermission: allowed, requirePermission: allowed }
} }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (module: string, field: string) => !(module === 'query_goods' ? mocks.queryHidden : mocks.hidden).has(field) } }))
const Dialog = { props: { modelValue: Boolean, beforeClose: Function, title: String, width: String }, emits: ['update:modelValue'],
  template: '<div v-if="modelValue" class="checkout-dialog" @keydown.esc="beforeClose(() => $emit(\'update:modelValue\', false))"><button aria-label="关闭" @click="beforeClose(() => $emit(\'update:modelValue\', false))">关闭</button><slot /><slot name="footer" /></div>' }
const option = { id: 56, name: '充电宝', brand_name: '品牌乙', product_model: 'P10', category: '充电设备', color_name: '白色', unit: '个', barcode: '0123', sale_price: 30, quantity: 125, serial_quantity: 2 }
const form = (): CheckoutCustomerForm => ({ customer_name: '测试客户', customer_phone: '13800138000', store_id: 1, operator_id: 7, sale_time: '2026-11-13', payment_method: 'cash', payment_channel: '', transaction_no: '', remarks: '整批一个备注' })
const draft = (): CheckoutGoodsDraft => ({ key: 'goods1', option, quantity: 2, unit_price: 30, sale_type: 'sale', linked_phone_id: null, serial_mode: false, serial_numbers: [], gift_return_unit_price: null })
const wrappers: ReturnType<typeof mount>[] = []
const render = async (phones = [] as Array<{ phone_id: number; sale_price: number; label: string }>, props: Partial<InstanceType<typeof SalesGoodsCheckoutDialog>['$props']> = {}, stubs: Record<string, boolean> = {}) => {
  const wrapper = mount(SalesGoodsCheckoutDialog, { attachTo: document.body, props: { modelValue: true, defaults: form(), phones, ...props }, global: { plugins: [ElementPlus], components: { PaymentMethodSelect, PaymentChannelSelect, RecordDescriptions }, stubs: { MobileDialog: Dialog, SectionLoading: true, InlineLoading: true, DataEmptyState: true, OptimizedScanner: true, ...stubs }, directives: { permission: {}, 'tf-loading': {}, 'identifier-input': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find(item => item.text() === label)!
const setStandaloneSaleType = async (editor: ReturnType<typeof mount>, type: 'sale' | 'gift', scope = '.cashier-cart-line__sale-type') => {
  const control = editor.findAll(`${scope} .el-radio-button`).find(item => item.text() === (type === 'gift' ? '赠送' : '购买'))
  if (!control) throw new Error(`未找到${type === 'gift' ? '赠送' : '购买'}切换按钮`)
  await control.trigger('click')
  await flushPromises()
}
const searchCatalog = async (wrapper: ReturnType<typeof mount>, keyword: string) => {
  const input = wrapper.find('input[aria-label="收银商品检索"]')
  await input.setValue(keyword); await input.trigger('keydown', { key: 'Enter' }); await flushPromises()
}
const submitButton = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').find(item => ['确认添加', '确认收款', '确认结算'].includes(item.text()) && item.isVisible())!
const enterPayment = async (wrapper: ReturnType<typeof mount>) => {
  const enter = wrapper.findAll('button').find(item => item.text() === '确认结算' && item.isVisible())
  if (enter) { await enter.trigger('click'); await flushPromises() }
}
const submitCheckout = async (wrapper: ReturnType<typeof mount>) => {
  await enterPayment(wrapper)
  const submit = wrapper.findAll('button').find(item => ['确认添加', '确认收款'].includes(item.text()))!
  await submit.trigger('click')
}
const redeem = async (wrapper: ReturnType<typeof mount>) => {
  await enterPayment(wrapper)
  await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
}
const confirmed = (wrapper: ReturnType<typeof mount>) => wrapper.emitted<[CheckoutAdditionalGoodsDraft]>('confirm')![0][0]
const populate = async (wrapper: Awaited<ReturnType<typeof render>>, value = draft()) => {
  const additional = wrapper.findComponent(SalesAdditionalGoods)
  if (additional.exists()) additional.vm.$emit('update:modelValue', [value])
  else wrapper.findComponent(SalesGoodsLine).vm.$emit('update:modelValue', value)
  await flushPromises()
}
beforeEach(() => {
  mocks.desktop = false; mocks.view = mocks.create = mocks.gift = mocks.sell = mocks.queryView = mocks.film = true; mocks.customerCreate = mocks.customerEdit = true; mocks.queryGoods = false; mocks.hidden.clear(); mocks.queryHidden.clear()
  mocks.options.mockResolvedValue({ success: true, data: { data: [option], pagination: { total: 1 } } })
  mocks.summary.mockResolvedValue({ success: true, data: { member_number: 'VIP001', points: 125, available_points: 100, balance: 25 } })
  mocks.stores.mockResolvedValue({ success: true, data: [{ id: 1, name: '一店', status: 1 }, { id: 2, name: '二店', status: 1 }] })
  mocks.operators.mockResolvedValue({ success: true, data: [{ id: 7, name: '销售员' }] })
  mocks.checkout.mockResolvedValue({ success: true, data: { order_id: 9, order_no: 'SO9', items: [], payment_ids: [], total_amount: 60, points_earned: 1, points_used: 0 } })
  mocks.quote.mockResolvedValue({ success: true, data: { available_points: 10, balance: 20, redemption_ready: true, points_per_yuan: 10, points_used: 10, points_awarded: 0, deduction_cents: 100, gross_cents: 6000, payable_cents: 5900, balance_after: 10, lines: [{ key: 'goods:goods1', points_used: 10 }] } })
  mocks.customers.mockResolvedValue([]); mocks.post.mockResolvedValue({ success: true, data: { id: 22, name: '新客户', phone: '13900000000', member_number: 'VIP022' } }); mocks.put.mockResolvedValue({ success: true }); mocks.confirm.mockResolvedValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => {
    const host = wrapper.element.parentElement
    wrapper.unmount()
    if (host?.parentElement === document.body) host.remove()
  })
  vi.resetAllMocks()
  vi.useRealTimers()
})

it('商品销售数量清空保持空白并阻止提交，重输后按实际数量结算', async () => {
  const wrapper = await render(); await populate(wrapper)
  const field = wrapper.find('input[aria-label="充电宝数量"]')
  await field.setValue(''); await field.trigger('change'); await flushPromises()
  expect(field.element).toHaveProperty('value', '')
  await submitCheckout(wrapper); await flushPromises()
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.error).toHaveBeenCalledWith('请填写正整数数量或录入实际SN')
  await button(wrapper, '返回选购').trigger('click'); await flushPromises()
  const corrected = wrapper.find('input[aria-label="充电宝数量"]')
  await corrected.setValue('3'); await corrected.trigger('change'); await flushPromises()
  await submitCheckout(wrapper); await flushPromises()
  expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({
    accessories: [expect.objectContaining({ quantity: 3 })], payment_info: expect.objectContaining({ payment_amount: 90 })
  }))
})

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
    const phone = { phone_id: 12, sale_price: 100.01, purchase_cost: 88.88, label: '手机' }
    const gift = { ...draft(), key: 'gift', sale_type: 'gift' as const, quantity: 1, linked_phone_id: 12, gift_return_unit_price: 0 }
    const data = buildCheckoutInput(form(), [phone], [{ ...draft(), linked_phone_id: 12 }, gift], 'a'.repeat(32))
    expect(data.payment_info.payment_amount).toBe(160.01)
    expect(data.accessories[1]).toMatchObject({ unit_price: 0, quantity: 1, linked_phone_id: 12, gift_return_unit_price: 0 })
    expect(data.phones).toEqual([{ phone_id: 12, sale_price: 100.01, purchase_cost: 88.88 }])
    expect(() => buildCheckoutInput(form(), [{ ...phone, purchase_cost: -1 }], [draft()], 'a'.repeat(32))).toThrow('价格须为非负数')
    expect(() => buildCheckoutInput(form(), [{ ...phone, purchase_cost: 88.889 }], [draft()], 'a'.repeat(32))).toThrow('价格须为非负数')
    expect(buildCheckoutInput(form(), [], [draft()], 'a'.repeat(32)).accessories[0]).not.toHaveProperty('linked_phone_id')
  })
  it('SN自动计数、保留前导零，不允许同一单跨行或行内重复、超库及遗漏手机关联', () => {
    const serial = { ...draft(), serial_mode: true, serial_numbers: ['00aa', '00bb'], quantity: 999 }
    expect(buildCheckoutInput(form(), [], [serial], 'a'.repeat(32)).accessories[0]).toMatchObject({ quantity: 2, serial_numbers: ['00AA', '00BB'] })
    for (const rows of [[serial, { ...serial, key: 'other' }], [{ ...serial, serial_numbers: ['AA', 'aa'] }], [{ ...draft(), quantity: 126 }], [{ ...draft(), quantity: 0 }]]) expect(() => buildCheckoutInput(form(), [], rows, 'a'.repeat(32))).toThrow()
    expect(() => buildCheckoutInput(form(), [{ phone_id: 12, sale_price: 100, label: '手机' }], [draft()], 'a'.repeat(32))).toThrow('关联手机')
  })
  it('同商品多件精确SN候选各自一件，可与普通实物同时结算，不能换SN或按普通数量使用', () => {
    const sn = (serial: string): CheckoutGoodsDraft => ({ ...draft(), key: serial, option: { ...option, serial_number: serial, quantity: 1, serial_quantity: 1 }, quantity: 1, serial_mode: true, serial_numbers: [serial] })
    const rows = [sn('00AA'), sn('00BB'), { ...draft(), option: { ...option, serial_quantity: 0, quantity: 3 }, quantity: 3 }]
    expect(buildCheckoutInput(form(), [], rows, 'a'.repeat(32)).accessories.map(row => row.quantity)).toEqual([1, 1, 3])
    for (const row of [{ ...sn('00AA'), serial_numbers: ['00BB'] }, { ...sn('00AA'), serial_mode: false }]) expect(() => buildCheckoutInput(form(), [], [row], 'a'.repeat(32))).toThrow('实际在库SN')
    expect(() => buildCheckoutInput(form(), [], [...rows, { ...draft(), quantity: 1, option: { ...option, quantity: 3 } }], 'a'.repeat(32))).toThrow('超过')
  })
})
describe('商品单卖与搭售结算弹窗', () => {
  it('商品销售权限不能创建客户或改名，伪造组件事件也不会写入', async () => {
    mocks.customerCreate = mocks.customerEdit = false
    const wrapper = await render([], { defaults: { ...form(), customer_phone: '', customer_name: '' } })
    await wrapper.find('input[inputmode="tel"]').setValue('13900000000')
    await flushPromises()
    const dropdown = wrapper.findComponent({ name: 'CustomerSearchDropdown' })
    expect(dropdown.find('.customer-search-dropdown__create').exists()).toBe(false)
    dropdown.vm.$emit('create')
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
    dropdown.vm.$emit('select', { id: 9, name: '已有客户', phone: '13900000000' })
    await flushPromises()
    const name = wrapper.findComponent(CustomerNameLockInput)
    name.vm.$emit('unlock')
    name.vm.$emit('save')
    await flushPromises()
    expect(name.props('editing')).toBe(false)
    expect(mocks.put).not.toHaveBeenCalled()
    expect(name.find('input').element).toHaveProperty('readOnly', true)
  })

  it('商品独立销售在完整手机号无匹配时提示创建，成功后选中客户再结算', async () => {
    const wrapper = await render([], { defaults: { ...form(), customer_phone: '', customer_name: '' } })
    await populate(wrapper)
    const phone = wrapper.find('input[inputmode="tel"]')
    await phone.setValue('13900000000')
    await flushPromises()

    const dropdown = wrapper.findComponent({ name: 'CustomerSearchDropdown' })
    expect(dropdown.props('allowCreate')).toBe(true)
    expect(dropdown.props('createMinQueryLength')).toBe(11)
    expect(dropdown.text()).toContain('暂无数据，点击创建新客户！')

    wrapper.findComponent(CustomerNameLockInput).vm.$emit('update:modelValue', '新客户')
    await flushPromises()
    dropdown.vm.$emit('create')
    await flushPromises()

    expect(mocks.post).toHaveBeenCalledWith('/customers', { name: '新客户', phone: '13900000000', apple_id: null })
    expect(wrapper.findComponent(CustomerNameLockInput).props('selected')).toBe(true)
    expect(wrapper.find('input[inputmode="tel"]').element).toHaveProperty('value', '13900000000')
    expect(mocks.success).toHaveBeenCalledWith('新客户“新客户”创建成功')
  })

  it.each(['附加商品', '贴膜商品'])('%s下拉触底加载下一页，重复滚动与末页不多读', async mode => {
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...option, id: 56 + index, name: `商品${index}` }))
    mocks.options.mockImplementation(async ({ page = 1 }: { page?: number }) => ({ success: true,
      data: { data: rows.slice((page - 1) * 20, page * 20), pagination: { total: rows.length } } }))
    const wrapper = mode === '附加商品'
      ? await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }])
      : await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13 })
    const editor = mode === '附加商品' ? wrapper.findComponent(SalesAdditionalGoods) : wrapper.findComponent(SalesGoodsLine)
    const select = editor.findAllComponents(ElSelect).find(item => item.props('remote') === true)
    if (!select) throw new Error('未找到商品检索下拉框')
    select.vm.$emit('visible-change', true)
    await flushPromises()
    const wrap = select.vm.scrollbarRef?.wrapRef
    if (!wrap) throw new Error('商品下拉滚动容器未挂载')
    Object.defineProperties(wrap, { clientHeight: { configurable: true, value: 200 }, scrollHeight: { configurable: true, value: 1000 } })
    const calls = mocks.options.mock.calls.length
    select.vm.$emit('popup-scroll', { scrollTop: 400, scrollLeft: 0 })
    await flushPromises()
    expect(mocks.options).toHaveBeenCalledTimes(calls)
    for (let count = 0; count < 3; count++) select.vm.$emit('popup-scroll', { scrollTop: 800, scrollLeft: 0 })
    await flushPromises()
    expect(mocks.options).toHaveBeenCalledTimes(calls + 1)
    expect(mocks.options).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal))
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(21)
    select.vm.$emit('popup-scroll', { scrollTop: 800, scrollLeft: 0 })
    await flushPromises()
    expect(mocks.options).toHaveBeenCalledTimes(calls + 1)
  })
  it('贴膜固定当前客户、只检索膜，免费赠送和跨店办理仍使用共同结算', async () => {
    const wrapper = await render([], { defaults: { ...form(), store_id: 2 }, initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13, filmEligibleForFree: true })
    expect(wrapper.findComponent(Dialog).props('title')).toBe('贴膜收银')
    expect(wrapper.findComponent(Dialog).props('width')).toBe('560px')
    const paymentLabels = wrapper.find('.checkout-payment').findAll('.el-form-item__label').map(label => label.text())
    expect(paymentLabels).toContain('收款方式')
    expect(paymentLabels).toContain('收款')
    expect(wrapper.text()).toContain('应收金额')
    expect(wrapper.text()).toContain('优惠')
    expect(paymentLabels).not.toContain('现金收取')
    expect(paymentLabels).not.toContain('找零')
    expect(paymentLabels).toContain('销售时间')
    expect(wrapper.findAll('input').map(input => (input.element as HTMLInputElement).value)).toContain('提交时自动记录当前时间')
    expect(wrapper.findComponent({ name: 'ElDatePicker' }).exists()).toBe(false)
    for (const label of ['销售门店', '客户手机号', '客户姓名', '销售员', '销售日期']) expect(paymentLabels).not.toContain(label)
    expect(wrapper.findComponent(CustomerNameLockInput).exists()).toBe(false)
    const line = wrapper.findComponent(SalesGoodsLine)
    expect(line.isVisible()).toBe(false)
    expect(line.props('modelValue').sale_type).toBe('sale')
    expect(line.props('filmOnly')).toBe(true)
    await line.findAllComponents(ElSelect)[0].props('remoteMethod')?.('膜'); await flushPromises()
    expect(mocks.options).toHaveBeenLastCalledWith(expect.objectContaining({ store_id: 2, film_customer_id: 9, phone_id: 11 }), expect.any(AbortSignal))
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0 })
    expect(wrapper.text()).not.toContain('赠品未退回约定单价')
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, phones: [], store_id: 2,
      customer_info: { name: form().customer_name, phone: form().customer_phone }, accessories: [expect.objectContaining({ sale_type: 'gift', unit_price: 0 })], payment_info: expect.objectContaining({ payment_amount: 0 }) }))
    expect(mocks.checkout.mock.calls[0][0].payment_info).not.toHaveProperty('transaction_no')
  })

  it('贴膜实收允许超过应收并只计算找零，订单按应收金额提交', async () => {
    const wrapper = await render([], { defaults: { ...form(), store_id: 2 }, initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13,
      initialFilmProduct: { ...option, sale_price: 30 } })
    const actual = wrapper.find('input[aria-label="收款"]')
    await actual.setValue('50'); await actual.trigger('change'); await flushPromises()
    expect(wrapper.text()).toContain('找零：¥20')
    await actual.setValue('100'); await actual.trigger('change'); await flushPromises()
    expect(wrapper.text()).toContain('找零：¥70')
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({
      accessories: [expect.objectContaining({ unit_price: 30, sale_type: 'sale' })],
      payment_info: expect.objectContaining({ payment_amount: 30 })
    }))
  })

  it('贴膜手机号字段隐藏时不渲染手机号，提交由服务端按客户ID关联', async () => {
    mocks.hidden.add('customer_info.customer_phone')
    const wrapper = await render([], { defaults: { ...form(), customer_phone: '' }, initialCustomer: { id: 9, name: form().customer_name }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13, filmEligibleForFree: true })
    expect(wrapper.find('input[aria-label="客户手机号"]').exists()).toBe(false)
    await populate(wrapper)
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ customer_info: { name: form().customer_name, phone: '' } }))
  })

  it('仅综合查询查看及贴膜授权即可选品和收费，不读取员工目录或要求商品权限', async () => {
    mocks.view = mocks.create = mocks.gift = false
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13, filmEligibleForFree: true })
    expect(wrapper.text()).not.toContain('缺少销售必要字段')
    expect(mocks.operators).not.toHaveBeenCalled()
    const line = wrapper.findComponent(SalesGoodsLine)
    expect(line.props('modelValue').sale_type).toBe('sale')
    await line.findAllComponents(ElSelect)[0].props('remoteMethod')?.('膜'); await flushPromises()
    expect(mocks.options).toHaveBeenLastCalledWith(expect.objectContaining({ film_customer_id: 9, phone_id: 11, store_id: 1 }), expect.any(AbortSignal))
    await populate(wrapper)
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, operator_id: 7 }))
  })
  it('未授免费上下文时仍可按赠送权限办理收费贴膜赠送，并支持积分抵扣', async () => {
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone }, filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13 })
    expect(wrapper.findComponent(SalesGoodsLine).props('allowGift')).toBe(true)
    await populate(wrapper, { ...draft(), sale_type: 'gift' })
    expect(wrapper.find('input[aria-label="收款"]').exists()).toBe(false)
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, accessories: [expect.objectContaining({ sale_type: 'gift', unit_price: 0 })] }))
    mocks.checkout.mockClear()
    await populate(wrapper, { ...draft(), redeem_points: 10 })
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, phones: [] }), expect.any(AbortSignal), true)
    await button(wrapper, '确认收款').trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, payment_info: expect.objectContaining({ payment_amount: 59 }) }))
  })
  it('公共门店按严格范围加载，单卖提交共同结算并通知父页刷新', async () => {
    const wrapper = await render(); await populate(wrapper)
    expect(mocks.stores).toHaveBeenCalledWith({ strictScope: true })
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ phones: [], accessories: [expect.objectContaining({ accessory_id: 56, quantity: 2 })], remarks: '整批一个备注', payment_info: expect.objectContaining({ payment_amount: 60 }) }))
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.text()).toContain('收款成功')
    expect(wrapper.text()).toContain('SO9')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await button(wrapper, '完成').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
  it('混合单必须逐条选关联手机，赠品0售价且保存约定金额', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }, { phone_id: 13, sale_price: 200, label: '手机乙' }])
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0, gift_return_unit_price: 20 })
    await submitCheckout(wrapper); expect(mocks.checkout).not.toHaveBeenCalled()
    await populate(wrapper, { ...draft(), sale_type: 'gift', unit_price: 0, linked_phone_id: 13, gift_return_unit_price: 20 })
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(confirmed(wrapper).goods).toEqual([expect.objectContaining({ sale_type: 'gift', unit_price: 0, linked_phone_id: 13, gift_return_unit_price: 20 })])
  })
  it('附加商品使用公共默认宽度，隐藏客户及销售支付控件并按原表单快照提交', async () => {
    const defaults = { ...form(), store_id: 2, operator_id: 19, sale_time: '2026-10-31', payment_method: 'mobile', payment_channel: 'alipay', transaction_no: '原手机支付流水' }
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }], { defaults, initialCustomer: { id: 9, name: '旧客户名称', phone: defaults.customer_phone } })
    expect(wrapper.findComponent(Dialog).props('title')).toBe('附加商品')
    expect(wrapper.findComponent(Dialog).props('width')).toBeUndefined()
    const controls = wrapper.findAll('.el-form-item__label, button').map(item => item.text())
    for (const label of ['客户手机号', '客户姓名', '销售门店', '销售员', '销售日期', '支付方式', '支付渠道', '交易流水号', '本条抵扣积分', '积分试算', '添加商品']) expect(controls).not.toContain(label)
    for (const value of ['会员号', 'VIP001', '姓名', '测试客户', '积分', '125']) expect(wrapper.text()).toContain(value)
    expect(wrapper.text()).not.toContain('13800138000')
    expect(wrapper.findComponent(CustomerNameLockInput).exists()).toBe(false)
    expect(mocks.stores).not.toHaveBeenCalled()
    expect(mocks.operators).not.toHaveBeenCalled()
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    expect(editor.props('storeId')).toBe(2)
    editor.findAllComponents(ElSelect)[0].vm.$emit('visible-change', true)
    await flushPromises()
    await editor.findAllComponents(ElSelect)[0].props('remoteMethod')?.('充电宝')
    await flushPromises()
    for (const search_mode of ['regular', 'serial']) {
      expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ store_id: 2, search_mode }), expect.any(AbortSignal))
    }
    expect(mocks.options.mock.calls.every(([params]) => params.store_id === 2)).toBe(true)
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    await submitCheckout(wrapper); await flushPromises()
    expect(submitButton(wrapper).text()).toBe('确认添加')
    expect(mocks.checkout).not.toHaveBeenCalled()
    const outer = useAdditionalGoodsCheckout(); outer.save(confirmed(wrapper))
    await outer.submit(defaults, [{ phone_id: 12, sale_price: 100, label: '手机甲' }])
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ store_id: 2, operator_id: 19, sale_time: '2026-10-31', customer_info: { name: defaults.customer_name, phone: defaults.customer_phone },
      payment_info: expect.objectContaining({ payment_method: 'mobile', payment_channel: 'alipay', transaction_no: '原手机支付流水', payment_amount: 160 }) }))
  })
  it.each([
    [{ customer_name: '' }, '客户姓名'],
    [{ customer_phone: '123' }, '客户手机号'],
    [{ operator_id: undefined }, '销售员'],
    [{ sale_time: undefined }, '销售日期'],
    [{ store_id: '' }, '销售门店'],
    [{ payment_method: '' }, '支付方式'],
    [{ payment_method: 'mobile', payment_channel: '' }, '支付渠道'],
    [{ payment_method: 'mobile', payment_channel: 'bank_transfer' }, '支付渠道']
  ])('手机原表单资料不完整时提示返回完善，不默认为当前人或当天：%s', async (incomplete, label) => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }], { defaults: { ...form(), ...incomplete } })
    expect(wrapper.text()).toContain('请关闭此窗口，在手机销售表单完善')
    expect(wrapper.text()).toContain(label)
    expect(wrapper.findComponent(SalesGoodsLine).exists()).toBe(false)
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('独立商品销售保留完整的销售与支付字段', async () => {
    const wrapper = await render([], { defaults: { ...form(), payment_method: 'mobile', payment_channel: 'alipay' } })
    expect(wrapper.findComponent(Dialog).props('width')).toBe('900px')
    expect(wrapper.find('.checkout-payment').findAll('.el-form-item__label').slice(0, 3).map(label => label.text())).toEqual(['手机号', '姓名', '销售日期'])
    for (const label of ['销售门店', '销售员', '销售日期', '支付方式', '支付渠道']) expect(wrapper.text()).toContain(label)
    expect(wrapper.text()).not.toContain('交易流水号')
    expect(mocks.stores).toHaveBeenCalledWith({ strictScope: true })
    expect(mocks.operators).toHaveBeenCalledOnce()
  })
  it('商品销售日期默认北京时间当天，改选历史日期后按所选日期提交', async () => {
    const defaultWrapper = await render([], { defaults: {} })
    expect(defaultWrapper.findComponent({ name: 'ElDatePicker' }).props('modelValue')).toBe(TimeUtil.nowFormatted(TIME_FORMATS.DATE))
    const wrapper = await render()
    const datePicker = wrapper.findComponent({ name: 'ElDatePicker' })
    const handledDate = TimeUtil.format(TimeUtil.add(TimeUtil.now(), -1, 'day'), TIME_FORMATS.DATE)
    datePicker.vm.$emit('update:modelValue', handledDate)
    await flushPromises()
    await populate(wrapper)
    await submitCheckout(wrapper)
    await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({
      sale_time: handledDate,
      payment_info: expect.objectContaining({ payment_time: handledDate })
    }))
  })
  it('明确拒绝后可修正商品，重新试算并提交；不误报结果未知', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'CHECKOUT_INVALID' } } })
    await submitCheckout(wrapper); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
    expect(wrapper.text()).not.toContain('提交结果尚未确认')
    expect(wrapper.emitted('success')).toBeUndefined()
    await populate(wrapper, { ...draft(), quantity: 1 })
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout.mock.calls[1][0]).toMatchObject({ request_key: mocks.checkout.mock.calls[0][0].request_key, accessories: [{ quantity: 1 }] })
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('积分余额明确不足后废弃旧试算，重新试算后才允许提交', async () => {
    const wrapper = await render(); await populate(wrapper)
    await redeem(wrapper)
    mocks.checkout.mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'POINTS_AVAILABLE_INSUFFICIENT' } } })
    await submitCheckout(wrapper); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(false)
    expect(wrapper.text()).toContain('本单实收：¥60')
    expect(button(wrapper, '取消抵扣')).toBeUndefined()
    expect(mocks.checkout).toHaveBeenCalledOnce()
    await redeem(wrapper)
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledTimes(2)
    expect(mocks.checkout.mock.calls[1][0]).toEqual(mocks.checkout.mock.calls[0][0])
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('网络结果未知后收到明确拒绝也不能解冻或改变原请求', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce({ response: { status: 400, data: { success: false, code: 'CHECKOUT_INVALID' } } })
    await submitCheckout(wrapper); await flushPromises()
    await submitCheckout(wrapper); await flushPromises()
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
    expect(mocks.checkout.mock.calls[1][0]).toEqual(mocks.checkout.mock.calls[0][0])
    expect(wrapper.emitted('success')).toBeUndefined()
  })
  it.each(['network', 'invalid'])('结果未知（%s）冻结客户及商品草稿，禁止重新试算，只能同内容重试', async failure => {
    const wrapper = await render([], { initialCustomer: { id: 9, name: form().customer_name, phone: form().customer_phone } })
    await populate(wrapper, { ...draft(), serial_mode: true, serial_numbers: ['00AA', '00BB'] })
    if (failure === 'network') mocks.checkout.mockRejectedValueOnce(new Error('network'))
    else mocks.checkout.mockResolvedValueOnce({ success: false })
    await submitCheckout(wrapper); await flushPromises()
    const first = mocks.checkout.mock.calls[0][0]
    expect(wrapper.findComponent(ElForm).props('disabled')).toBe(true)
    expect(wrapper.findComponent(SalesAdditionalGoods).props('disabled')).toBe(true)
    expect(wrapper.findAll('input, textarea').filter(control => !(control.element as HTMLInputElement).disabled)
      .map(control => control.html())).toEqual([])
    expect(button(wrapper, '返回选购').attributes('disabled')).toBeDefined()
    expect(button(wrapper, '积分试算')).toBeUndefined()
    expect(button(wrapper, '积分抵扣').attributes('disabled')).toBeDefined()
    const name = wrapper.findComponent(CustomerNameLockInput)
    name.vm.$emit('unlock'); await flushPromises()
    expect(name.props('editing')).toBe(false)
    expect(name.find('[aria-label="更换客户"]').exists()).toBe(false)
    expect(button(wrapper, '取消').attributes('disabled')).toBeUndefined()
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout.mock.calls[1][0]).toEqual(first)
    expect(mocks.quote).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('网络失败保留草稿及请求标识，提交期间禁止重复结算', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await submitCheckout(wrapper); await flushPromises()
    const key = mocks.checkout.mock.calls[0][0].request_key
    expect(wrapper.text()).toContain('提交结果尚未确认')
    let resolve: ((value: unknown) => void) | undefined
    mocks.checkout.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await submitCheckout(wrapper); await submitCheckout(wrapper)
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
    expect(wrapper.findComponent(SalesAdditionalGoods).props('modelValue')).toEqual([])
  })
  it('提交结果未确认时仍可直接关闭，不在关闭时再次提交', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await submitCheckout(wrapper); await flushPromises()
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
    await submitCheckout(wrapper)
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
    await submitCheckout(wrapper); expect(mocks.checkout).not.toHaveBeenCalled()
    mocks.hidden.add('customer_info.customer_phone')
    await wrapper.setProps({ phoneFieldsAllowed: false }); await flushPromises()
    await submitCheckout(wrapper); expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('综合查询表格隐藏客户姓名和手机号时仍可正常商品收银', async () => {
    mocks.queryGoods = true
    mocks.queryHidden.add('customer_info.customer_name')
    mocks.queryHidden.add('customer_info.customer_phone')
    mocks.queryHidden.add('stock_info.distribution')
    const wrapper = await render([], { fieldSource: 'query' })
    await populate(wrapper)
    expect(wrapper.find('input[inputmode="tel"]').exists()).toBe(true)
    await submitCheckout(wrapper)
    expect(mocks.checkout).toHaveBeenCalledOnce()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({
      customer_info: { name: form().customer_name, phone: form().customer_phone },
      store_id: form().store_id
    }), 'query')
  })
  it('商品超过100条可继续滚动，切店清除旧商品和SN', async () => {
    // 大数据回归保留真实分页、清单和门店控件，只替换与行为无关的装饰标签。
    const wrapper = await render([], {}, { ElTag: true })
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    mocks.options.mockImplementation(async (params: { page: number; page_size: number }) => ({ success: true, data: { data: Array.from({ length: params.page === 7 ? 5 : 20 }, (_, index) => ({ ...option, id: (params.page - 1) * params.page_size + index + 1 })), pagination: { total: 125 } } }))
    await searchCatalog(wrapper, '充电')
    const products = editor.find('.cashier-products')
    Object.defineProperties(products.element, { clientHeight: { configurable: true, value: 200 }, scrollHeight: { configurable: true, value: 1000 }, scrollTop: { configurable: true, value: 800 } })
    await products.trigger('scroll'); await flushPromises()
    expect(mocks.options).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal))
    for (let page = 3; page <= 7; page++) { await button(editor, '加载更多').trigger('click'); await flushPromises() }
    expect(editor.findAll('.cashier-product')).toHaveLength(125)
    await populate(wrapper, { ...draft(), serial_mode: true, serial_numbers: ['00AA'] })
    wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2); await flushPromises()
    expect(wrapper.findComponent(SalesAdditionalGoods).props('modelValue')).toEqual([])
  }, 15000)
  it('新搜索取消旧请求，迟到响应不覆盖新候选且不提前结束加载', async () => {
    const wrapper = await render()
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    const oldResolvers: Array<(value: unknown) => void> = [], newResolvers: Array<(value: unknown) => void> = []
    mocks.options.mockImplementation((params: { search: string; search_mode?: string }) => new Promise(resolve => {
      const target = params.search === '旧商品' ? oldResolvers : newResolvers
      target.push(resolve)
    }))
    await searchCatalog(wrapper, '旧商品')
    const oldSignal = mocks.options.mock.calls.at(-1)![1] as AbortSignal
    await searchCatalog(wrapper, '新商品')
    expect(oldSignal.aborted).toBe(true)
    oldResolvers.forEach(resolve => resolve({ success: true, data: { data: [{ ...option, name: '旧商品' }], pagination: { total: 1 } } }))
    await flushPromises()
    expect(editor.find('section-loading-stub').exists()).toBe(true)
    expect(editor.findAll('.cashier-product')).toHaveLength(0)
    newResolvers.forEach(resolve => resolve({ success: true, data: { data: [{ ...option, name: '新商品' }], pagination: { total: 1 } } }))
    await flushPromises()
    expect(editor.find('section-loading-stub').exists()).toBe(false)
    expect(editor.find('.cashier-product').text()).toContain('新商品')
    expect(mocks.error).not.toHaveBeenCalled()
  })
  it('合单隐藏的备注及交易号不展示也不提交', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }])
    await wrapper.setProps({ phoneFieldVisible: () => false, defaults: { ...form(), payment_method: 'mobile', payment_channel: 'alipay', transaction_no: '草稿流水号' } })
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    expect(wrapper.text()).not.toContain('整单备注')
    expect(wrapper.text()).not.toContain('交易流水号')
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    const outer = useAdditionalGoodsCheckout(); outer.save(confirmed(wrapper))
    await outer.submit(form(), [{ phone_id: 12, sale_price: 100, label: '手机甲' }], undefined, () => false)
    expect(mocks.checkout).toHaveBeenCalledOnce()
    const input = mocks.checkout.mock.calls[0][0]
    expect(input).not.toHaveProperty('remarks')
    expect(input.payment_info).not.toHaveProperty('transaction_no')
  })
  it('独立销售沿用已选客户及姓名锁，修改姓名只提交姓名并重新锁定', async () => {
    const wrapper = await render()
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
    await populate(wrapper)
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout.mock.calls[0][0].customer_info).toEqual({ name: '新客户', phone: '13900000000' })
  })
  it('独立商品通过统一候选检索选择SN，手机客户搜索复用公共入口及姓名锁', async () => {
    const wrapper = await render()
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    const serialOption = { ...option, serial_number: '00AA', quantity: 1, serial_quantity: 1 }
    mocks.options.mockResolvedValue({ success: true, data: { data: [serialOption], pagination: { total: 1 } } })
    await searchCatalog(wrapper, '00AA')
    await button(editor, '充电宝').trigger('click'); await flushPromises()
    expect(editor.props('modelValue')[0]).toMatchObject({ serial_mode: true, serial_numbers: ['00AA'], quantity: 1 })
    const phone = wrapper.find('input[inputmode="tel"]')
    expect(phone.exists()).toBe(true)
    await phone.setValue('138'); await flushPromises()
    expect(mocks.customers).toHaveBeenCalledWith('138', 'sales')
  })
})


describe('结算自动会员资料', () => {
  it('输入完整手机号即读取真实可用积分，无需先选择支付，不自动抵扣', async () => {
    const wrapper = await render([], { defaults: { ...form(), customer_phone: '', customer_name: '', payment_method: '' } })
    await populate(wrapper); await enterPayment(wrapper)
    const phone = wrapper.find('input[inputmode="tel"]')
    await phone.setValue('138'); await flushPromises()
    expect(mocks.summary).not.toHaveBeenCalled()
    await phone.setValue('13800138000'); await flushPromises()
    expect(mocks.summary).toHaveBeenCalledWith({ phone: '13800138000', store_id: 1, context: 'goods' }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('账户积分：125')
    expect(wrapper.text()).toContain('可用积分：100')
    expect(wrapper.text()).toContain('余额：¥25')
    expect(button(wrapper, '积分试算')).toBeUndefined()
    expect(button(wrapper, '积分抵扣').attributes('disabled')).toBeUndefined()
    expect(mocks.quote).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
    wrapper.findComponent(CustomerNameLockInput).vm.$emit('update:modelValue', '测试客户'); await flushPromises()
    wrapper.findComponent(PaymentMethodSelect).vm.$emit('update:modelValue', 'cash'); await flushPromises()
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledExactlyOnceWith(expect.any(Object), expect.any(AbortSignal), true)
    expect(button(wrapper, '取消抵扣')).toBeDefined()
    expect(button(wrapper, '确认收款')).toBeDefined()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it.each([0, null])('账户有积分但本次可用为%s时展示真实可用值，不开放抵扣', async available_points => {
    mocks.summary.mockResolvedValueOnce({ success: true, data: { member_number: 'VIP001', points: 125, available_points, balance: 25 } })
    const wrapper = await render(); await populate(wrapper); await enterPayment(wrapper)
    expect(wrapper.text()).toContain(`可用积分：${available_points ?? '-'}`)
    expect(button(wrapper, '积分试算')).toBeUndefined()
    expect(button(wrapper, '积分抵扣').attributes('disabled')).toBeDefined()
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.quote).not.toHaveBeenCalled()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('换客户丢弃旧响应，清空与关闭取消请求并清除会员资料', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.summary.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await render(); await populate(wrapper); await enterPayment(wrapper)
    const firstSignal = mocks.summary.mock.calls[0][1] as AbortSignal
    await wrapper.find('input[inputmode="tel"]').setValue('13900000000'); await flushPromises()
    expect(firstSignal.aborted).toBe(true)
    expect(wrapper.text()).toContain('VIP001')
    finish?.({ success: true, data: { member_number: 'OLD-MEMBER', points: 999, available_points: 999, balance: 0 } }); await flushPromises()
    expect(wrapper.text()).not.toContain('OLD-MEMBER')
    await wrapper.find('input[inputmode="tel"]').setValue(''); await flushPromises()
    expect(wrapper.text()).not.toContain('VIP001')
    await wrapper.find('input[inputmode="tel"]').setValue('13800138000'); await flushPromises()
    const lastSignal = mocks.summary.mock.calls.at(-1)![1] as AbortSignal
    await wrapper.setProps({ modelValue: false }); await flushPromises()
    expect(lastSignal.aborted).toBe(true)
  })
  it('选中客户自动读取摘要，客户姓名锁保持公共行为，隐藏积分时不提供抵扣', async () => {
    mocks.hidden.add('customer.points')
    const wrapper = await render([], { defaults: { ...form(), customer_phone: '', customer_name: '' } })
    await populate(wrapper); await enterPayment(wrapper)
    wrapper.findComponent({ name: 'CustomerSearchDropdown' }).vm.$emit('select', { id: 9, name: '选中客户', phone: '13900000000' })
    await flushPromises()
    expect(mocks.summary).toHaveBeenCalledWith({ phone: '13900000000', store_id: 1, context: 'goods' }, expect.any(AbortSignal))
    expect(wrapper.findComponent(CustomerNameLockInput).props('selected')).toBe(true)
    expect(wrapper.text()).not.toContain('账户积分：')
    expect(wrapper.text()).not.toContain('可用积分：')
    expect(button(wrapper, '积分抵扣')).toBeUndefined()
  })
  it('返回选购或必要字段撤权清除会员资料及抵扣，再次结算重读', async () => {
    const wrapper = await render(); await populate(wrapper); await redeem(wrapper)
    expect(wrapper.text()).toContain('VIP001')
    await button(wrapper, '返回选购').trigger('click'); await flushPromises()
    expect(wrapper.text()).not.toContain('VIP001')
    await enterPayment(wrapper)
    expect(mocks.summary).toHaveBeenCalledTimes(2)
    expect(button(wrapper, '取消抵扣')).toBeUndefined()
    await wrapper.setProps({ phoneFieldsAllowed: false }); await flushPromises()
    const signal = mocks.summary.mock.calls.at(-1)![1] as AbortSignal
    expect(signal.aborted).toBe(true)
    expect(wrapper.text()).not.toContain('VIP001')
  })
})

describe('商品明细积分抵扣', () => {
  it('选购不提供抵扣输入，结算按后端逐行分配，以净额提交并展示积分信息', async () => {
    const wrapper = await render(); await populate(wrapper)
    expect(wrapper.find('input[aria-label="充电宝抵扣积分"]').exists()).toBe(false)
    expect(mocks.summary).not.toHaveBeenCalled()
    await redeem(wrapper)
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ accessories: [expect.not.objectContaining({ redeem_points: expect.anything() })] }), expect.any(AbortSignal), true)
    expect(wrapper.text()).toContain('可用积分 10')
    expect(wrapper.text()).toContain('本单实收：¥59')
    expect(wrapper.text()).toContain('剩余 10 积分')
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ accessories: [expect.objectContaining({ redeem_points: 10 })], payment_info: expect.objectContaining({ payment_amount: 59 }) }))
  })
  it('价格或客户等内容变化立即废弃抵扣，按新原价展示，再次抵扣需重新核对', async () => {
    const wrapper = await render(); await populate(wrapper)
    await redeem(wrapper)
    await populate(wrapper, { ...draft(), unit_price: 31 })
    expect(wrapper.text()).not.toContain('可用积分 10')
    expect(wrapper.text()).toContain('本单实收：¥62')
    expect(button(wrapper, '取消抵扣')).toBeUndefined()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('旧试算慢返回不能覆盖新明细，关闭后也不恢复旧试算', async () => {
    let resolve: ((value: unknown) => void) | undefined
    mocks.quote.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const wrapper = await render(); await populate(wrapper)
    await enterPayment(wrapper)
    await button(wrapper, '积分抵扣').trigger('click')
    await populate(wrapper, { ...draft(), quantity: 3 })
    resolve?.({ success: true, data: { available_points: 999, payable_cents: 1 } }); await flushPromises()
    expect(wrapper.text()).not.toContain('999')
    expect(wrapper.text()).toContain('本单实收：¥90')
    await button(wrapper, '取消').trigger('click'); await wrapper.setProps({ modelValue: false }); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('全额积分抵扣可提交0现金，失败重试保持原净额和请求键', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.quote.mockResolvedValueOnce({ success: true, data: { available_points: 600, balance: 600, points_used: 600, points_awarded: 0, deduction_cents: 6000, gross_cents: 6000, payable_cents: 0, redemption_ready: true, lines: [{ key: 'goods:goods1', points_used: 600 }] } })
    await redeem(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('network'))
    await submitCheckout(wrapper); await flushPromises()
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledTimes(2)
    expect(mocks.checkout.mock.calls[0][0]).toEqual(mocks.checkout.mock.calls[1][0])
    expect(mocks.checkout.mock.calls[0][0].payment_info.payment_amount).toBe(0)
  })
  it('赠送切换清除抵扣，非法积分不能提交，零值保持原载荷', async () => {
    expect(buildCheckoutInput(form(), [], [{ ...draft(), redeem_points: 0 }], 'a'.repeat(32)).accessories[0]).not.toHaveProperty('redeem_points')
    for (const redeem_points of [-1, 1.1, 2147483648, NaN]) expect(() => buildCheckoutInput(form(), [], [{ ...draft(), redeem_points }], 'a'.repeat(32))).toThrow('抵扣积分')
    expect(() => buildCheckoutInput(form(), [], [{ ...draft(), sale_type: 'gift', redeem_points: 1 }], 'a'.repeat(32))).toThrow('赠品不能')
    const wrapper = await render()
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    await searchCatalog(wrapper, '充电宝')
    await editor.find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    await setStandaloneSaleType(editor, 'gift')
    expect(editor.props('modelValue')[0]).toMatchObject({ sale_type: 'gift', unit_price: 0 })
    expect(editor.props('modelValue')[0]).not.toHaveProperty('redeem_points')
    await enterPayment(wrapper)
    const paymentLabels = wrapper.find('.checkout-payment').findAll('.el-form-item__label').map(label => label.text())
    expect(paymentLabels).toContain('支付方式')
    expect(paymentLabels).not.toContain('支付渠道')
    expect(paymentLabels).not.toContain('交易流水号')
    expect(wrapper.find('input[aria-label="现金收取"]').exists()).toBe(false)
    expect(wrapper.findComponent(PaymentMethodSelect).findComponent(ElSelect).props('disabled')).toBe(true)
  })
})

it.each([
  [400, 'CHECKOUT_INVALID', false, true], [400, 'CHECKOUT_RETURN_INVALID', false, true],
  [400, 'POINTS_AVAILABLE_INSUFFICIENT', false, true], [409, 'CHECKOUT_RETURN_QUOTE_CHANGED', false, true],
  [409, 'CHECKOUT_RETURN_PAYMENT_REQUIRED', false, true], [409, 'GIFT_STOCK_REASON_REQUIRED', false, false],
  [409, 'GIFT_STOCK_INSUFFICIENT', false, false], [409, 'CHECKOUT_REQUEST_CONFLICT', false, false],
  [409, 'CHECKOUT_RETURN_REQUEST_CONFLICT', false, false], [409, 'CHECKOUT_PENDING', false, false],
  [409, 'CHECKOUT_RETURN_NOT_READY', false, false], [500, 'CHECKOUT_INVALID', false, false],
  [400, 'UNKNOWN_ERROR', false, false], [400, 'CHECKOUT_INVALID', true, false],
  [400, 'CHECKOUT_INVALID', undefined, false], [undefined, 'CHECKOUT_INVALID', false, false]
])('提交错误状态%s、代码%s、success=%s的明确拒绝判断为%s', (status, code, success, expected) => {
  expect(isCheckoutSubmissionRejected({ response: { status, data: { code, success } } })).toBe(expected)
})


describe('附加商品清单与一键抵扣', () => {
  const phone = [{ phone_id: 12, sale_price: 100, label: '手机甲' }]
  const pick = async (wrapper: Awaited<ReturnType<typeof render>>, key = 'goods:56', type = 'sale') => {
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    const selects = editor.findAllComponents(ElSelect)
    await selects[0].props('remoteMethod')?.(key.startsWith('sn:') ? '00AA' : '充电宝')
    await flushPromises()
    selects[0].vm.$emit('update:modelValue', key)
    selects[1].vm.$emit('update:modelValue', type)
    await flushPromises()
    await button(editor, '确认').trigger('click'); await flushPromises()
    return editor
  }
  it('同一入口确认普通商品，数量价格在公共控件修改，价格后减号移除，确认仅保存草稿', async () => {
    const wrapper = await render(phone), editor = await pick(wrapper)
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 1, unit_price: 30, serial_mode: false })
    const labels = editor.findAll('.el-form-item__label').map(item => item.text())
    expect(labels).toEqual(['商品检索', '扫码', '出库方式', '操作'])
    const quantity = editor.find('input[aria-label="充电宝数量"]')
    const price = editor.find('input[aria-label="充电宝价格"]')
    expect(quantity.exists()).toBe(true); expect(price.exists()).toBe(true)
    await quantity.setValue(''); await quantity.trigger('change'); await flushPromises()
    expect(quantity.element).toHaveProperty('value', '')
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    await quantity.setValue('3'); await quantity.trigger('change'); await flushPromises()
    await price.setValue('25.5'); await price.trigger('change'); await flushPromises()
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 3, unit_price: 25.5 })
    const remove = editor.find('button[aria-label="删除充电宝"]')
    expect(remove.text()).toBe('')
    expect(editor.findAll('th').at(-2)?.text()).toBe('价格')
    await remove.trigger('click'); await flushPromises()
    expect(editor.props('modelValue')).toHaveLength(0)
    await pick(wrapper)
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(confirmed(wrapper).goods).toHaveLength(1)
  })
  it('同一商品同一出库方式再次添加只增加数量，购买与赠送分别保留计价行', async () => {
    const wrapper = await render(phone), editor = await pick(wrapper)
    await pick(wrapper)
    expect(editor.props('modelValue')).toHaveLength(1)
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 2, sale_type: 'sale' })
    await pick(wrapper, 'goods:56', 'gift')
    await pick(wrapper, 'goods:56', 'gift')
    expect(editor.props('modelValue')).toHaveLength(2)
    expect(editor.props('modelValue').find(row => row.sale_type === 'gift')).toMatchObject({ quantity: 2 })
    expect(editor.text()).toContain('购买')
    expect(editor.text()).toContain('赠送')
  })
  it('赠品自动冻结本次零售价，界面不再提供约定单价，缺价拒绝加入', async () => {
    const wrapper = await render(phone), editor = await pick(wrapper, 'goods:56', 'gift')
    expect(editor.props('modelValue')[0]).toMatchObject({ sale_type: 'gift', unit_price: 0, gift_return_unit_price: 30 })
    expect(wrapper.text()).not.toContain('赠品未退回约定单价')
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(confirmed(wrapper).goods).toEqual([expect.objectContaining({ unit_price: 0, gift_return_unit_price: 30 })])
    mocks.options.mockResolvedValue({ success: true, data: { data: [{ ...option, sale_price: null }], pagination: { total: 1 } } })
    const invalid = await render(phone), invalidEditor = await pick(invalid, 'goods:56', 'gift')
    expect(invalidEditor.props('modelValue')).toEqual([])
    expect(mocks.error).toHaveBeenCalledWith('无法读取赠品零售价，请联系管理员')
  })
  it('独立商品赠送时销售价与现金收取均只读', async () => {
    const wrapper = await render()
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    expect(editor.find('.cashier-selection').exists()).toBe(false)
    expect(editor.text()).not.toContain('加入清单')
    await wrapper.find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    await setStandaloneSaleType(editor, 'gift')
    expect(editor.props('modelValue')[0]).toMatchObject({ sale_type: 'gift', unit_price: 0, gift_return_unit_price: 30 })
    await setStandaloneSaleType(editor, 'sale')
    expect(editor.props('modelValue')[0]).toMatchObject({ sale_type: 'sale', unit_price: 30, gift_return_unit_price: null })
    await setStandaloneSaleType(editor, 'gift')
    expect(editor.find('input[aria-label="充电宝价格"]').attributes('disabled')).toBeDefined()
    await enterPayment(wrapper)
    expect(wrapper.find('input[aria-label="现金收取"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('本单实收：¥0')
  })
  it('SN检索显示完整前导零，固定一件，重复确认不能再次加入', async () => {
    mocks.options.mockImplementation(async params => ({ success: true, data: { data: params.search_mode === 'serial' ? [{ ...option, serial_number: '00AA', quantity: 1, serial_quantity: 1 }] : [], pagination: { total: params.search_mode === 'serial' ? 1 : 0 } } }))
    const wrapper = await render(phone), editor = await pick(wrapper, 'sn:00AA')
    expect(editor.props('modelValue')[0]).toMatchObject({ serial_numbers: ['00AA'], quantity: 1, serial_mode: true })
    expect(editor.text()).toContain('00AA')
    expect(editor.find('input[aria-label="充电宝数量"]').attributes('disabled')).toBeDefined()
    await pick(wrapper, 'sn:00AA')
    expect(editor.props('modelValue')).toHaveLength(1)
    expect(button(editor, '确认').attributes('disabled')).toBeDefined()
    expect(mocks.error).not.toHaveBeenCalled()
  })
  it('一键使用后端分配积分，取消恢复原价，修改商品清除旧抵扣并以净实收提交', async () => {
    const wrapper = await render(phone)
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    mocks.quote.mockResolvedValue({ success: true, data: { available_points: 125, balance: 125, redemption_ready: true,
      points_per_yuan: 10, points_used: 10, points_awarded: 1, deduction_cents: 100, gross_cents: 16000, payable_cents: 15900, balance_after: 116,
      lines: [{ key: 'goods:goods1', points_used: 10 }] } })
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.quote).toHaveBeenCalledWith(expect.not.objectContaining({ auto_redeem: expect.anything() }), expect.any(AbortSignal), true)
    expect(wrapper.text()).toContain('本单实收：¥159')
    await button(wrapper, '取消抵扣').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('本单实收：¥160')
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    expect(button(wrapper, '积分抵扣')).toBeDefined()
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(confirmed(wrapper)).toMatchObject({ goods: [expect.objectContaining({ redeem_points: 10 })], points_quote: expect.objectContaining({ payable_cents: 15900 }) })
  })
  it.each([
    { balance: 100, available_points: 0, redemption_ready: true, message: '账户积分 100，本次可抵扣积分为 0；未核对来源的余额暂不能抵扣，请联系管理员核对历史积分' },
    { balance: 100, available_points: 100, redemption_ready: false, message: '当前积分抵扣未启用或来源账尚未就绪，请联系管理员核对积分设置' },
    { balance: 0, available_points: 0, redemption_ready: true, message: '账户暂无可抵扣积分，本次销售新增积分须结算后才可用于后续订单' },
    { balance: 100, available_points: 100, redemption_ready: true, message: '已有可用积分，但当前商品不符合抵扣范围或未达到最低抵扣金额，请核对商品类型及抵扣规则' }
  ])('零抵扣说明服务端实际原因，不把总余额误作可用积分：$message', async ({ message, ...status }) => {
    mocks.quote.mockResolvedValueOnce({ success: true, data: { ...status, points_per_yuan: 10,
      points_used: 0, points_awarded: 1, deduction_cents: 0, gross_cents: 16000, payable_cents: 16000, balance_after: status.balance + 1, lines: [] } })
    const wrapper = await render(phone); await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.info).toHaveBeenCalledExactlyOnceWith(message)
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.quote.mock.calls[0][2]).toBe(true)
    expect(wrapper.text()).toContain('本单实收：¥160')
    expect(button(wrapper, '取消抵扣')).toBeUndefined()
    expect(mocks.checkout).not.toHaveBeenCalled()
    await submitCheckout(wrapper); await flushPromises()
    expect(confirmed(wrapper)).toMatchObject({ goods: [expect.objectContaining({ redeem_points: 0 })], points_quote: null })
  })
  it.each([
    {}, { points_used: null }, { points_used: '0' }, { points_used: -1 },
    { points_used: 0, balance: 100, available_points: 101, redemption_ready: true },
    { points_used: 0, balance: 100, available_points: 0, redemption_ready: 'true' }
  ])('损坏的零抵扣响应显示核对错误，不冒充历史余额问题：%j', async data => {
    mocks.quote.mockResolvedValueOnce({ success: true, data })
    const wrapper = await render(phone); await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.error).toHaveBeenCalledWith('积分试算资料不完整，请重新抵扣')
    expect(mocks.info).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('本单实收：¥160')
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('不完整积分分配拒绝使用，余额为零或会员摘要失败时不开放抵扣', async () => {
    const wrapper = await render(phone); await populate(wrapper, { ...draft(), linked_phone_id: 12 })
    await button(wrapper, '积分抵扣').trigger('click'); await flushPromises()
    expect(mocks.error).toHaveBeenCalledWith('积分试算资料不完整，请重新抵扣')
    expect(wrapper.text()).toContain('本单实收：¥160')
    mocks.summary.mockRejectedValueOnce(new Error('network'))
    const failed = await render(phone)
    expect(button(failed, '积分抵扣').attributes('disabled')).toBeDefined()
    mocks.summary.mockResolvedValueOnce({ success: true, data: { member_number: 'VIP001', points: 0 } })
    await button(failed, '重试').trigger('click'); await flushPromises()
    expect(button(failed, '积分抵扣').attributes('disabled')).toBeDefined()
  })
})

describe('商品收银台检索与连续扫码', () => {
  it('商品目录停止输入后自动检索，回车立即检索并取消待执行请求', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    mocks.options.mockClear()
    const input = editor.find('input[aria-label="收银商品检索"]')
    await input.setValue('充电宝')
    await vi.advanceTimersByTimeAsync(349)
    expect(mocks.options).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '充电宝', search_mode: 'regular' }), expect.any(AbortSignal))

    mocks.options.mockClear()
    await input.setValue('新商品')
    await vi.advanceTimersByTimeAsync(100)
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '新商品', search_mode: 'regular' }), expect.any(AbortSignal))
    const callsAfterEnter = mocks.options.mock.calls.length
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.options).toHaveBeenCalledTimes(callsAfterEnter)
  })

  it('可售随购买、赠送、数量修改实时扣减，售罄禁用加购，删除及清空恢复且不提前写库', async () => {
    const stocked = { ...option, quantity: 3 }
    mocks.options.mockResolvedValue({ success: true, data: { data: [stocked], pagination: { total: 1 } } })
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    const card = () => editor.find('.cashier-product')
    const add = () => card().find('button[aria-label="加入充电宝"]')
    expect(card().text()).toContain('可售 3')
    await button(card(), '充电宝').trigger('click'); await flushPromises()
    expect(card().text()).toContain('可售 2')
    await setStandaloneSaleType(editor, 'gift')
    await add().trigger('click'); await flushPromises()
    expect(card().text()).toContain('可售 1')
    const quantity = editor.find('input[aria-label="充电宝数量"]')
    await quantity.setValue('2'); await quantity.trigger('change'); await flushPromises()
    expect(card().text()).toContain('可售 0')
    expect(add().attributes('disabled')).toBeDefined()
    expect(editor.find('.cashier-selection').exists()).toBe(false)
    await editor.findAll('.cashier-cart-line')[1].find('button[aria-label="删除充电宝"]').trigger('click'); await flushPromises()
    expect(card().text()).toContain('可售 1')
    expect(add().attributes('disabled')).toBeUndefined()
    await button(editor, '清空').trigger('click'); await flushPromises()
    expect(card().text()).toContain('可售 3')
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(stocked.quantity).toBe(3)
  })
  it('清空按钮使用紧凑规格，新加入的商品始终排在清单顶部', async () => {
    const newest = { ...option, id: 57, name: '数据线', barcode: '0456' }
    mocks.options.mockResolvedValue({ success: true, data: { data: [option, newest], pagination: { total: 2 } } })
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await searchCatalog(wrapper, '商品')
    await button(editor, '充电宝').trigger('click'); await flushPromises()
    await button(editor, '数据线').trigger('click'); await flushPromises()
    const names = editor.findAll('.cashier-cart-line__identity > strong').map(item => item.text())
    expect(names).toEqual(['数据线', '充电宝'])
    expect(button(editor, '清空').classes()).toContain('tf-button--compact')
  })
  it('SN加入后仅该件不可再售，普通库存和其他SN不混扣，删除后恢复', async () => {
    mocks.options.mockImplementation(async params => ({ success: true, data: {
      data: params.search_mode === 'serial'
        ? ['00AA', '00BB'].map(serial_number => ({ ...option, serial_number, quantity: 1 })) : [{ ...option, quantity: 3 }],
      pagination: { total: params.search_mode === 'serial' ? 2 : 1 }
    } }))
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await searchCatalog(wrapper, '充电宝')
    const cards = editor.findAll('.cashier-product')
    await cards[0].find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    expect(cards[0].text()).toContain('可售 2')
    expect(cards[1].text()).toContain('可售 1')
    await cards[1].find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    expect(cards[0].text()).toContain('可售 2')
    expect(cards[1].text()).toContain('可售 0')
    expect(cards[1].find('button[aria-label="加入充电宝"]').attributes('disabled')).toBeDefined()
    expect(cards[2].text()).toContain('可售 1')
    expect(cards[2].find('button[aria-label="加入充电宝"]').attributes('disabled')).toBeUndefined()
    await editor.findAll('.cashier-cart-line')[0].find('button[aria-label="删除充电宝"]').trigger('click'); await flushPromises()
    expect(cards[1].text()).toContain('可售 1')
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  const scan = async (wrapper: Awaited<ReturnType<typeof render>>, code: string) => {
    const editor = wrapper.findComponent(SalesAdditionalGoods)
    await button(editor, '扫码').trigger('click'); await flushPromises()
    editor.findComponent('optimized-scanner-stub').vm.$emit('success', code)
    await flushPromises(); await flushPromises()
  }
  const exactOptions = () => mocks.options.mockImplementation(async params => ({ success: true, data: {
    data: params.match_mode === 'exact' && params.search_mode === 'serial' ? [] : [option],
    pagination: { total: params.match_mode === 'exact' && params.search_mode === 'serial' ? 0 : 1 }
  } }))
  it('按类型检索，点击商品直接加入清单且不展开额外资料面板', async () => {
    mocks.options.mockResolvedValue({ success: true, data: { data: [{ ...option, category: '充电设备' }], pagination: { total: 1 } } })
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await searchCatalog(wrapper, '充电设备')
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '充电设备', search_mode: 'regular', store_id: 1 }), expect.any(AbortSignal))
    await button(editor, '充电宝').trigger('click'); await flushPromises()
    expect(editor.find('.cashier-selection').exists()).toBe(false)
    expect(editor.props('modelValue')).toEqual([expect.objectContaining({ option: expect.objectContaining({ id: 56 }), quantity: 1, linked_phone_id: null })])
  })
  it('清单按数量及销售价展示合计，积分试算后保留原合计并单独展示实收', async () => {
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await populate(wrapper, { ...draft(), quantity: 2, unit_price: 25.5 })
    expect(editor.find('.cashier-cart-line__subtotal').text()).toContain('51 元')
    mocks.quote.mockResolvedValueOnce({ success: true, data: { available_points: 10, balance: 10, points_used: 10, points_awarded: 0, deduction_cents: 100, gross_cents: 5100, payable_cents: 5000, redemption_ready: true, lines: [{ key: 'goods:goods1', points_used: 10 }] } })
    await redeem(wrapper)
    expect(wrapper.text()).toContain('本单实收：¥50')
    expect(editor.find('.cashier-cart-line__subtotal').text()).toContain('51 元')
  })
  it('连续扫相同条码保持前导零并累加普通数量，最终按数量收款', async () => {
    exactOptions()
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await scan(wrapper, '0123'); await scan(wrapper, '0123')
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '0123', match_mode: 'exact', search_mode: 'regular' }), expect.any(AbortSignal))
    expect(editor.props('modelValue')).toHaveLength(1)
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 2, serial_mode: false })
    expect(wrapper.find('input[aria-label="商品扫码输入"]').exists()).toBe(false)
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ accessories: [expect.objectContaining({ quantity: 2 })], payment_info: expect.objectContaining({ payment_amount: 60 }) }))
  })
  it('快扫在途不丢件，识别期间禁止结算，后续队列按扫码时的方式加入', async () => {
    exactOptions()
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }]), editor = wrapper.findComponent(SalesAdditionalGoods)
    let resolveFirst!: (value: unknown) => void
    mocks.options.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
    await scan(wrapper, '0123')
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
    await scan(wrapper, '0123')
    const saleTypeSelect = editor.findAllComponents(ElSelect).find(select => select.props('modelValue') === 'sale')
    if (!saleTypeSelect) throw new Error('未找到出库方式下拉框')
    saleTypeSelect.vm.$emit('update:modelValue', 'gift'); await flushPromises()
    resolveFirst({ success: true, data: { data: [option], pagination: { total: 1 } } }); await flushPromises(); await flushPromises()
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 2, sale_type: 'sale' })
    await scan(wrapper, '0123')
    expect(editor.props('modelValue')[1]).toMatchObject({ quantity: 1, sale_type: 'gift', unit_price: 0, gift_return_unit_price: 30 })
    expect(submitButton(wrapper).attributes('disabled')).toBeUndefined()
  })
  it('扫码SN逐件管理，重复SN及超过库存均不重复加入', async () => {
    mocks.options.mockImplementation(async params => ({ success: true, data: {
      data: params.search_mode === 'serial' ? [{ ...option, serial_number: '00AA', quantity: 1, serial_quantity: 1 }] : [],
      pagination: { total: params.search_mode === 'serial' ? 1 : 0 }
    } }))
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await scan(wrapper, '00aa'); await scan(wrapper, '00AA')
    expect(editor.props('modelValue')).toEqual([expect.objectContaining({ serial_mode: true, serial_numbers: ['00AA'], quantity: 1 })])
    expect(mocks.error).toHaveBeenCalledWith('该SN已加入清单')
    mocks.options.mockImplementation(async params => ({ success: true, data: { data: params.search_mode === 'regular' ? [{ ...option, quantity: 1 }] : [], pagination: { total: params.search_mode === 'regular' ? 1 : 0 } } }))
    await scan(wrapper, '0123'); await scan(wrapper, '0123')
    expect(editor.props('modelValue')).toHaveLength(2)
    expect(mocks.error).toHaveBeenCalledWith('商品数量超过当前门店可售库存')
  })
  it('相同条码多品牌不自动取第一条，展示候选供人工核对', async () => {
    mocks.options.mockImplementation(async params => ({ success: true, data: {
      data: params.search_mode === 'regular' ? [option, { ...option, id: 57, brand_name: '品牌丙' }] : [],
      pagination: { total: params.search_mode === 'regular' ? 2 : 0 }
    } }))
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await scan(wrapper, '0123')
    expect(editor.props('modelValue')).toHaveLength(0)
    expect(editor.findAll('.cashier-product')).toHaveLength(2)
    expect(mocks.info).toHaveBeenCalledWith('该编码对应多个商品，请在检索结果中选择实际品牌或SN')
  })
  it('换店取消识别，迟到响应不进入新门店清单', async () => {
    exactOptions()
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    let finish!: (value: unknown) => void
    mocks.options.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await scan(wrapper, '0123')
    const signal = mocks.options.mock.calls.find(([params]) => params.match_mode === 'exact')![1] as AbortSignal
    wrapper.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 2); await flushPromises()
    expect(signal.aborted).toBe(true)
    finish({ success: true, data: { data: [option], pagination: { total: 1 } } }); await flushPromises()
    expect(editor.props('modelValue')).toHaveLength(0)
    expect(submitButton(wrapper).attributes('disabled')).toBeDefined()
  })
  it('未找到、无条码权限及识别失败均不误加商品，结束识别后可重试', async () => {
    mocks.hidden.add('basic_info.barcode')
    mocks.options.mockResolvedValue({ success: true, data: { data: [], pagination: { total: 0 } } })
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    await scan(wrapper, '9999')
    expect(mocks.options.mock.calls.filter(([params]) => params.match_mode === 'exact').map(([params]) => params.search_mode)).toEqual(['serial'])
    expect(editor.props('modelValue')).toHaveLength(0)
    expect(mocks.error).toHaveBeenCalledWith('未找到本店可售商品，请核对条形码或改扫商品SN')
    mocks.options.mockRejectedValueOnce(new Error('network'))
    await scan(wrapper, '9999')
    expect(mocks.error).toHaveBeenCalledWith('商品识别失败，请核对网络后重新扫码')
    expect(editor.emitted('busy')?.at(-1)).toEqual([false])
  })
  it('编码字段撤权取消在途识别，即使另一编码字段仍可见也不能使用旧响应', async () => {
    mocks.hidden = reactive(new Set<string>())
    exactOptions()
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    let finish!: (value: unknown) => void
    mocks.options.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await scan(wrapper, '0123')
    const signal = mocks.options.mock.calls.find(([params]) => params.match_mode === 'exact')![1] as AbortSignal
    mocks.hidden.add('basic_info.barcode'); await flushPromises()
    expect(signal.aborted).toBe(true)
    finish({ success: true, data: { data: [option], pagination: { total: 1 } } }); await flushPromises()
    expect(editor.props('modelValue')).toHaveLength(0)
    expect(editor.emitted('busy')?.at(-1)).toEqual([false])
  })
  it('手工商品条码保留原大小写和Code128符号，SN查询独立归一化', async () => {
    exactOptions()
    const wrapper = await render()
    await scan(wrapper, '00ab:+12')
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ match_mode: 'exact', search_mode: 'regular', search: '00ab:+12' }), expect.any(AbortSignal))
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ match_mode: 'exact', search_mode: 'serial', search: '00AB:+12' }), expect.any(AbortSignal))
  })
  it('统一商品检索支持名称、条码和SN，手机摄像头复用公共扫描器', async () => {
    const wrapper = await render([{ phone_id: 12, sale_price: 100, label: '手机甲' }]), editor = wrapper.findComponent(SalesAdditionalGoods)
    const select = editor.findAllComponents(ElSelect).find(item => item.props('remote') === true)
    if (!select) throw new Error('未找到商品检索下拉框')
    await select.props('remoteMethod')?.('充电宝'); await flushPromises()
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '充电宝', search_mode: 'regular' }), expect.any(AbortSignal))
    await select.props('remoteMethod')?.('0123'); await flushPromises()
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '0123', search_mode: 'regular' }), expect.any(AbortSignal))
    await select.props('remoteMethod')?.('00AA'); await flushPromises()
    expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ search: '00AA', search_mode: 'serial' }), expect.any(AbortSignal))
    await button(editor, '扫码').trigger('click'); await flushPromises()
    expect(editor.find('optimized-scanner-stub').exists()).toBe(true)
    expect(editor.find('optimized-scanner-stub').attributes('serial-profile')).toBe('product')
  })
  it('PC端只保留检索右侧扫码入口，识别后加入原队列，手动输入返回商品检索', async () => {
    mocks.desktop = true
    exactOptions()
    const wrapper = await render(), editor = wrapper.findComponent(SalesAdditionalGoods)
    expect(editor.find('input[aria-label="商品扫码输入"]').exists()).toBe(false)
    expect(editor.find('.cashier-search').text()).toContain('扫码')
    await button(editor, '扫码').trigger('click'); await flushPromises()
    const scanner = editor.findComponent('optimized-scanner-stub')
    scanner.vm.$emit('success', '0123'); await flushPromises(); await flushPromises()
    expect(editor.props('modelValue')[0]).toMatchObject({ quantity: 1, sale_type: 'sale' })
    scanner.vm.$emit('manual'); await flushPromises()
    expect(document.activeElement).toBe(editor.find('input[aria-label="收银商品检索"]').element)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})


describe('商品收银分步操作', () => {
  it('首页门店后选择销售员，结算不重复显示，返回保留选择并提交同一销售员', async () => {
    mocks.operators.mockResolvedValue({ success: true, data: [{ id: 7, name: '销售员' }, { id: 8, name: '销售员乙' }] })
    const wrapper = await render()
    const fields = wrapper.find('.cashier-search').findAll('.el-form-item')
    expect(fields.map(field => field.find('.el-form-item__label').text())).toEqual(['销售门店', '销售员', '商品检索'])
    await populate(wrapper)
    fields[1].findComponent(ElSelect).vm.$emit('update:modelValue', ''); await flushPromises()
    await enterPayment(wrapper)
    expect(wrapper.find('.checkout-payment').isVisible()).toBe(false)
    expect(mocks.error).toHaveBeenCalledWith('请选择销售员')
    fields[1].findComponent(ElSelect).vm.$emit('update:modelValue', 8); await flushPromises()
    await enterPayment(wrapper)
    expect(wrapper.find('.checkout-payment').findAll('.el-form-item__label').map(label => label.text())).not.toContain('销售员')
    await button(wrapper, '返回选购').trigger('click'); await flushPromises()
    expect(fields[1].findComponent(ElSelect).props('modelValue')).toBe(8)
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ operator_id: 8 }))
  })
  it('选购时隐藏付款资料，进入结算不扣库存，返回后保留商品并可继续检索', async () => {
    const wrapper = await render()
    expect(wrapper.find('.checkout-payment').isVisible()).toBe(false)
    await wrapper.find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(SalesAdditionalGoods).props('modelValue')).toHaveLength(1)
    expect(button(wrapper, '确认结算').isVisible()).toBe(true)
    expect(button(wrapper, '确认结算').attributes('disabled')).toBeUndefined()
    await enterPayment(wrapper)
    expect(wrapper.findComponent(Dialog).props('title')).toBe('订单结算')
    expect(wrapper.find('.checkout-payment').isVisible()).toBe(true)
    expect(wrapper.find('.checkout-additional-goods').isVisible()).toBe(false)
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('1 件商品')
    await button(wrapper, '返回选购').trigger('click'); await flushPromises()
    expect(wrapper.find('.cashier-cart').text()).toContain('充电宝')
    expect(wrapper.findAll('.cashier-product')).toHaveLength(1)
    await wrapper.find('button[aria-label="加入充电宝"]').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(SalesAdditionalGoods).props('modelValue')[0].quantity).toBe(2)
    await button(wrapper, '清空').trigger('click'); await flushPromises()
    expect(wrapper.findComponent(SalesAdditionalGoods).props('modelValue')).toEqual([])
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
  it('现金不足不能成交，多收现金只按应收入账并显示找零，成交后不能再次提交', async () => {
    const wrapper = await render(); await populate(wrapper); await enterPayment(wrapper)
    const cash = wrapper.find('input[aria-label="现金收取"]')
    await cash.setValue('50'); await cash.trigger('change'); await flushPromises()
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('现金收取不足，请核对应收金额')
    expect(wrapper.text()).toContain('还差 ¥10')
    await cash.setValue('100'); await cash.trigger('change'); await flushPromises()
    expect(wrapper.text()).toContain('退还 ¥40')
    await submitCheckout(wrapper); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ payment_info: expect.objectContaining({ payment_amount: 60 }) }))
    expect(wrapper.text()).toContain('收款成功')
    expect(wrapper.findComponent(Dialog).props('title')).toBe('收款成功')
    expect(wrapper.findComponent(Dialog).props('width')).toBe('480px')
    expect(wrapper.find('.checkout-success__icon').exists()).toBe(true)
    expect(wrapper.find('.checkout-success__receipt').text()).toContain('实际收款')
    expect(wrapper.find('.el-result').exists()).toBe(false)
    expect(wrapper.find('.checkout-payment').exists()).toBe(false)
    expect(button(wrapper, '确认收款')).toBeUndefined()
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it('隐藏成交总额时不通过现金找零辅助信息反推金额', async () => {
    mocks.hidden = reactive(new Set(['price_info.total_price']))
    const wrapper = await render(); await populate(wrapper); await enterPayment(wrapper)
    expect(wrapper.find('input[aria-label="现金收取"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('找零')
    expect(wrapper.find('.checkout-payable').exists()).toBe(false)
  })
  it('凭证只使用服务端真实商品销售ID，缺少ID时不伪造凭证入口', async () => {
    const wrapper = await render(); await populate(wrapper)
    mocks.checkout.mockResolvedValueOnce({ success: true, data: { order_id: 9, order_no: 'SO-TRUE', items: [{ type: 'accessory', id: 22, accessory_sale_id: 81 }], total_amount: 60, paid_amount: 59, points_used: 10, points_earned: 0, payment_ids: [] } })
    await submitCheckout(wrapper); await flushPromises()
    expect(wrapper.text()).toContain('SO-TRUE')
    expect(wrapper.text()).toContain('¥59')
    expect(button(wrapper, '查看 / 打印凭证')).toBeDefined()
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    await populate(wrapper); await submitCheckout(wrapper); await flushPromises()
    expect(button(wrapper, '查看 / 打印凭证')).toBeUndefined()
  })
})


it.each([false, true])('商品字段和候选来源保持一致，查询授权可支持手机搭售：有商品管理=%s', async hasAccessoryPage => {
  mocks.view = hasAccessoryPage
  mocks.queryGoods = true
  const wrapper = await render([{ phone_id: 11, sale_price: 100, label: '手机甲' }], hasAccessoryPage ? { fieldSource: 'query' } : {})
  expect(wrapper.findComponent(SalesAdditionalGoods).props('fieldSource')).toBe('query')
  await wrapper.findComponent(SalesAdditionalGoods).findAllComponents(ElSelect)[0].props('remoteMethod')?.('充电宝')
  await flushPromises()
  expect(mocks.options).toHaveBeenCalledWith(expect.objectContaining({ source: 'query', search: '充电宝' }), expect.any(AbortSignal))
})
