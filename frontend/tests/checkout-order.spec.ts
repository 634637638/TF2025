import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OrderDialog from '@/components/query/CheckoutOrderDialog.vue'
import QueryDetailDialog from '@/components/query/QueryDetailDialog.vue'
import type { CheckoutOrderDetail, CheckoutOrderItem } from '@/types/sales-checkout'
import type { QueryItem } from '@/types'
import { isCheckoutOrderDetail } from '@/utils/query-goods'

const mocks = vi.hoisted(() => ({ get: vi.fn(), print: vi.fn(), warning: vi.fn() }))
vi.mock('@/utils/print', () => ({ printElement: mocks.print }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ warning: mocks.warning }) }))
const queryView = ref(true), goodsView = ref(true)
const hidden = reactive({ query: [] as string[], goods: [] as string[] })
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'query' ? queryView.value : goodsView.value), hasPermission: (action: string) => module === 'query' && action === 'goods-view' && goodsView.value }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (module: string, field: string) => !(module === 'query_queryview' ? hidden.query : hidden.goods).includes(field),
  getHiddenFields: (module: string) => module === 'query_queryview' ? hidden.query : hidden.goods
} }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(true), isTablet: ref(false) }) }))
const Dialog = { props: ['modelValue', 'title', 'width', 'dialogClass'], emits: ['update:modelValue'], template: '<div v-if="modelValue" class="dialog"><h2>{{ title }}</h2><button @click="$emit(\'update:modelValue\', false)">关闭</button><slot /><slot name="footer" /></div>' }
const Empty = { props: ['description', 'title', 'actionText'], emits: ['action'], template: '<div>{{title}}{{description}}<button @click="$emit(\'action\')">{{actionText}}</button></div>' }
const line = (extra: Partial<CheckoutOrderItem> = {}): CheckoutOrderItem => ({ id: 201, item_type: 'accessory', sale_no: 'GOODS-A', linked_phone_sale_no: 'PHONE-A', sale_type: 'sale',
  name: '原充电器', brand_name: '配件品牌', product_model: 'MWVW3CH', color_name: '白', memory: null, imei: null, serial_numbers: ['000SN1', '000SN2'], unit: '个', quantity: 2,
  unit_price: 10, gross_amount: 20, total_amount: 15, reference_unit_price: 11.25, reference_total_amount: 22.5, discount_amount: 2.5,
  points_used: 500, deduction_amount: 5, points_awarded: 0,
  gift_return_unit_price: null, gift_return_total: null, gift_agreement_state: extra.sale_type === 'gift' ? 'not_recorded' : null, ...extra })
const order = (): CheckoutOrderDetail => ({ id: 10, order_no: 'SO-ORIGINAL', customer_name: '原客户', customer_phone: '13900000001', store_name: '一店', operator_name: '原销售员', sale_time: '2026-11-14 10:00:00', remarks: '整批公共备注',
  total_amount: 120, final_amount: 115, paid_amount: 115, deduction_amount: 5, points_used: 500, points_awarded: 10,
  items: [line({ id: 101, item_type: 'phone', sale_no: 'PHONE-A', linked_phone_sale_no: null, name: '原手机型号', product_model: null, serial_numbers: ['000PHONE'], quantity: 1,
    unit_price: 100, gross_amount: 100, total_amount: 100, reference_unit_price: null, reference_total_amount: null, discount_amount: null,
    points_used: 0, deduction_amount: 0, points_awarded: 10 }), line(),
  line({ id: 202, name: '原赠膜', sale_type: 'gift', serial_numbers: [], quantity: 1, unit_price: 0, gross_amount: 0, total_amount: 0,
    reference_unit_price: null, reference_total_amount: null, discount_amount: null, points_used: 0, deduction_amount: 0 })] })
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(OrderDialog, { props: { modelValue: true, saleId: 51, source: 'goods' }, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, SectionLoading: true, DataEmptyState: Empty }, directives: { permission: {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
beforeEach(() => { queryView.value = goodsView.value = true; hidden.query = []; hidden.goods = []; mocks.get.mockResolvedValue({ success: true, data: order() }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('整单显示原手机、购买及赠品、SN和积分；请求复用统一接口且关闭缓存及全局Loading', async () => {
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('以下为本次结算的原成交记录')
  for (const value of ['原手机型号', '原充电器', '原赠膜', '赠送', '000SN1、000SN2', '整批公共备注', '本单现金入账', '¥115', '总优惠', '¥7.5', '500']) expect(wrapper.text()).toContain(value)
  expect(mocks.get).toHaveBeenCalledWith('/query/goods/51/order', expect.objectContaining({ signal: expect.any(AbortSignal), useCache: false, showLoading: false, showError: false }))
  expect(wrapper.findAll('.el-descriptions').every(item => item.classes().includes('tf-record-descriptions'))).toBe(true)
})

it('切换手机来源废弃旧请求，旧单晚到不覆盖新单，关闭时清除结果及取消请求', async () => {
  let finish: (value: unknown) => void = () => undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const wrapper = await render(), signal = mocks.get.mock.calls[0][1].signal
  await wrapper.setProps({ source: 'phone', saleId: 81 }); await flushPromises()
  expect(signal.aborted).toBe(true)
  expect(mocks.get).toHaveBeenLastCalledWith('/query/sales/81/order', expect.any(Object))
  const old = order(); old.customer_name = '不应出现旧客户'
  finish({ success: true, data: old }); await flushPromises()
  expect(wrapper.text()).not.toContain('不应出现旧客户')
  const latestSignal = mocks.get.mock.calls.at(-1)![1].signal
  await wrapper.setProps({ modelValue: false }); await flushPromises()
  expect(latestSignal.aborted).toBe(true)
  expect(wrapper.text()).not.toContain('原充电器')
})

it('失败显示服务端业务信息并能重试，残缺响应不能展示半张订单', async () => {
  mocks.get.mockRejectedValueOnce({ response: { data: { message: '共同原单不存在或无权查看' } } })
  const wrapper = await render()
  expect(wrapper.text()).toContain('共同原单不存在或无权查看')
  expect(wrapper.text()).not.toContain('原充电器')
  await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('原充电器')
  mocks.get.mockResolvedValueOnce({ success: true, data: { ...order(), paid_amount: 999 } })
  await wrapper.setProps({ saleId: 52 }); await flushPromises()
  expect(wrapper.text()).toContain('原单响应不完整')
  expect(wrapper.text()).not.toContain('原充电器')
})

it('撤回任一模块查看权限立即清理，字段权限变化废弃旧结果并按本模块遮蔽', async () => {
  const wrapper = await render(), oldSignal = mocks.get.mock.calls[0][1].signal
  hidden.query.push('basic_info.model', 'basic_info.sale_price', 'customer_info.customer_phone')
  await flushPromises()
  expect(oldSignal.aborted).toBe(true)
  expect(wrapper.text()).not.toContain('原手机型号')
  expect(wrapper.text()).toContain('原充电器')
  expect(wrapper.text()).not.toContain('13900000001')
  expect(wrapper.text()).not.toContain('¥115')
  goodsView.value = false; await flushPromises()
  expect(wrapper.text()).not.toContain('原充电器')
  const count = mocks.get.mock.calls.length
  await wrapper.setProps({ saleId: 99 }); await flushPromises()
  expect(mocks.get).toHaveBeenCalledTimes(count)
})

it('隐藏商品SN/数量/金额保留null，不制造零值或完整合计', async () => {
  hidden.goods = ['basic_info.serial_number', 'stock_info.total_quantity', 'price_info.total_price']
  const data = order()
  for (const key of ['total_amount', 'final_amount', 'paid_amount', 'deduction_amount', 'points_used', 'points_awarded'] as const) data[key] = null
  for (const row of data.items.filter(row => row.item_type === 'accessory')) {
    row.quantity = null; row.serial_numbers = null
    for (const key of ['unit_price', 'gross_amount', 'total_amount', 'points_used', 'deduction_amount', 'points_awarded'] as const) row[key] = null
  }
  mocks.get.mockResolvedValueOnce({ success: true, data })
  const wrapper = await render()
  expect(wrapper.text()).toContain('原充电器')
  expect(wrapper.text()).not.toContain('000SN1')
  expect(wrapper.text()).not.toContain('¥115')
})

it('校验原单资金守恒及脱敏、重复行和赠品；换货现金可小于原成交净额', () => {
  const data = order()
  expect(isCheckoutOrderDetail(data)).toBe(true)
  Object.assign(data.items[2], { reference_unit_price: 30, reference_total_amount: 30, discount_amount: null })
  expect(isCheckoutOrderDetail(data)).toBe(true)
  data.items[2].discount_amount = 1
  expect(isCheckoutOrderDetail(data)).toBe(false)
  data.items[2].discount_amount = null
  data.paid_amount = 5; expect(isCheckoutOrderDetail(data)).toBe(true)
  data.items[2].unit_price = 2; expect(isCheckoutOrderDetail(data)).toBe(false)
  const duplicated = order(); duplicated.items.push(duplicated.items[0]); expect(isCheckoutOrderDetail(duplicated)).toBe(false)
  const hiddenTotal = order(); hiddenTotal.final_amount = null; expect(isCheckoutOrderDetail(hiddenTotal)).toBe(false)
})

it('整单区分未记录、零元和正数赠品约定，不增加实收；隐藏相关字段立即移除约定', async () => {
  const wrapper = await render()
  expect(wrapper.text()).toContain('原单未记录约定金额')
  for (const [index, price] of [0, 12.34].entries()) {
    const data = order()
    Object.assign(data.items[2], { gift_return_unit_price: price, gift_return_total: price, gift_agreement_state: 'recorded' })
    mocks.get.mockResolvedValueOnce({ success: true, data })
    await wrapper.setProps({ saleId: 52 + index }); await flushPromises()
    expect(wrapper.text()).toContain(`原单约定 ¥${price}/件`)
    expect(wrapper.text()).toContain('实际扣款以售后核对为准')
    expect(wrapper.text()).toContain('¥115')
  }
  for (const field of ['basic_info.usage_type', 'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    hidden.goods = [field]
    await flushPromises()
    expect(wrapper.text()).not.toContain('赠品未退约定')
    expect(wrapper.text()).not.toContain('原单未记录约定金额')
  }
})

it('赠品约定响应必须完整且数量金额守恒，合法整体脱敏保留', () => {
  const data = order(), gift = data.items[2]
  Object.assign(gift, { quantity: 2, gift_return_unit_price: 12.34, gift_return_total: 24.68, gift_agreement_state: 'recorded' })
  expect(isCheckoutOrderDetail(data)).toBe(true)
  gift.gift_return_total = 12.34; expect(isCheckoutOrderDetail(data)).toBe(false)
  gift.gift_return_total = null; expect(isCheckoutOrderDetail(data)).toBe(false)
  Object.assign(gift, { gift_return_unit_price: null, gift_return_total: null, gift_agreement_state: null })
  expect(isCheckoutOrderDetail(data)).toBe(true)
  Object.assign(gift, { gift_return_unit_price: 0, gift_return_total: 0, gift_agreement_state: 'recorded', sale_type: 'sale' })
  expect(isCheckoutOrderDetail(data)).toBe(false)
})

it('手机实际详情按钮传递原销售ID，关闭父详情或切换销售会清理子窗口', async () => {
  const detailItem: QueryItem = { 基本信息: { phone_id: 11 }, 客户信息: {}, 供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {}, 销售信息: { sale_id: 81, has_checkout_order: true } }
  const Order = { name: 'CheckoutOrderDialog', props: ['modelValue', 'saleId', 'source'], template: '<div class="order-child" />' }
  const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem, canEdit: false, canDelete: false, canReturnToStock: false },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, CheckoutOrderDialog: Order }, directives: { permission: {} } } })
  wrappers.push(wrapper)
  await wrapper.findAll('button').find(button => button.text() === '整单明细')!.trigger('click'); await flushPromises()
  expect(wrapper.findComponent(Order).props()).toMatchObject({ modelValue: true, saleId: 81, source: 'phone' })
  await wrapper.setProps({ detailItem: { ...detailItem, 销售信息: { sale_id: 82 } } }); await flushPromises()
  expect(wrapper.find('.order-child').exists()).toBe(false)
})

it.each([false, undefined])('普通手机销售没有共同订单（%s），不显示整单入口也不请求原单', async hasCheckoutOrder => {
  const detailItem: QueryItem = { 基本信息: { phone_id: 16646 }, 客户信息: {}, 供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {},
    销售信息: { sale_id: 15865, has_checkout_order: hasCheckoutOrder } }
  const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem, canEdit: false, canDelete: false, canReturnToStock: false },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog }, directives: { permission: {} } } })
  wrappers.push(wrapper)
  await flushPromises()
  expect(wrapper.text()).toContain('设备销售信息')
  expect(wrapper.findAll('button').some(button => button.text() === '整单明细')).toBe(false)
  wrapper.findComponent({ name: 'QueryDetailContent' }).vm.$emit('order')
  await flushPromises()
  expect(wrapper.findComponent(OrderDialog).exists()).toBe(false)
  expect(mocks.get).not.toHaveBeenCalled()
})

it('共同订单标记失效时关闭已打开的明细，同一销售不会残留旧内容', async () => {
  const detailItem: QueryItem = { 基本信息: { phone_id: 11 }, 客户信息: {}, 供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {},
    销售信息: { sale_id: 81, has_checkout_order: true } }
  const Order = { name: 'CheckoutOrderDialog', props: ['modelValue', 'saleId', 'source'], template: '<div class="order-child" />' }
  const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem, canEdit: false, canDelete: false, canReturnToStock: false },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, CheckoutOrderDialog: Order }, directives: { permission: {} } } })
  wrappers.push(wrapper)
  await wrapper.findAll('button').find(button => button.text() === '整单明细')!.trigger('click'); await flushPromises()
  expect(wrapper.find('.order-child').exists()).toBe(true)
  await wrapper.setProps({ detailItem: { ...detailItem, 销售信息: { sale_id: 81, has_checkout_order: false } } })
  expect(wrapper.find('.order-child').exists()).toBe(false)
})


it('收银凭证仅打印已核对且有权查看的原成交内容，失败或撤权后禁止打印', async () => {
  const wrapper = await render()
  await wrapper.setProps({ receipt: true }); await flushPromises()
  for (const value of ['销售价格', '销售价格合计', '成交单价', '成交金额', '总优惠', '实收小计']) expect(wrapper.text()).toContain(value)
  expect(wrapper.text()).not.toContain('原出库SN')
  mocks.print.mockReturnValue(true)
  await wrapper.findAll('button').find(row => row.text() === '打印凭证')!.trigger('click')
  const printed = mocks.print.mock.calls[0][0] as HTMLElement
  expect(printed.textContent).toContain('SO-ORIGINAL')
  expect(printed.textContent).toContain('原赠膜')
  expect(printed.textContent).toContain('000SN1')
  hidden.goods.push('basic_info.serial_number'); await flushPromises()
  await wrapper.findAll('button').find(row => row.text() === '打印凭证')!.trigger('click')
  expect(mocks.print.mock.calls[1][0].textContent).not.toContain('000SN1')
  mocks.get.mockRejectedValueOnce(new Error('读取失败'))
  await wrapper.setProps({ saleId: 99 }); await flushPromises()
  expect(wrapper.findAll('button').find(row => row.text() === '打印凭证')!.attributes('disabled')).toBeDefined()
  expect(mocks.print).toHaveBeenCalledTimes(2)
  queryView.value = false; await flushPromises()
  expect(wrapper.text()).not.toContain('原充电器')
})

it('赠送凭证使用单一弹窗标题，隐藏无意义的零积分汇总', async () => {
  const giftOrder = order()
  giftOrder.items = [giftOrder.items[2]]
  giftOrder.total_amount = giftOrder.final_amount = giftOrder.paid_amount = giftOrder.deduction_amount = 0
  giftOrder.points_used = giftOrder.points_awarded = 0
  mocks.get.mockResolvedValue({ success: true, data: giftOrder })
  const wrapper = await render()
  await wrapper.setProps({ receipt: true, saleId: 52 }); await flushPromises()
  expect(wrapper.findComponent(Dialog).props('dialogClass')).toBe('record-detail-dialog crud-dialog-lg')
  expect(wrapper.find('.checkout-receipt__header h2').exists()).toBe(false)
  expect(wrapper.text()).toContain('商品单号')
  expect(wrapper.text()).not.toContain('积分抵扣')
  expect(wrapper.text()).not.toContain('消耗积分')
  expect(wrapper.text()).not.toContain('获得积分')
})
