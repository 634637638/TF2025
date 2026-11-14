import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OrderDialog from '@/components/query/CheckoutOrderDialog.vue'
import QueryDetailDialog from '@/components/query/QueryDetailDialog.vue'
import type { CheckoutOrderDetail, CheckoutOrderItem } from '@/types/sales-checkout'
import type { QueryItem } from '@/types'
import { isCheckoutOrderDetail } from '@/utils/query-goods'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
const queryView = ref(true), goodsView = ref(true)
const hidden = reactive({ query: [] as string[], goods: [] as string[] })
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'query' ? queryView.value : goodsView.value), hasPermission: () => false }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (module: string, field: string) => !(module === 'query_queryview' ? hidden.query : hidden.goods).includes(field),
  getHiddenFields: (module: string) => module === 'query_queryview' ? hidden.query : hidden.goods
} }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(true), isTablet: ref(false) }) }))
const Dialog = { props: ['modelValue', 'title'], emits: ['update:modelValue'], template: '<div v-if="modelValue" class="dialog"><h2>{{ title }}</h2><button @click="$emit(\'update:modelValue\', false)">关闭</button><slot /></div>' }
const Empty = { props: ['description', 'title', 'actionText'], emits: ['action'], template: '<div>{{title}}{{description}}<button @click="$emit(\'action\')">{{actionText}}</button></div>' }
const line = (extra: Partial<CheckoutOrderItem> = {}): CheckoutOrderItem => ({ id: 201, item_type: 'accessory', sale_no: 'GOODS-A', linked_phone_sale_no: 'PHONE-A', sale_type: 'sale',
  name: '原充电器', brand_name: '配件品牌', product_model: 'MWVW3CH', color_name: '白', memory: null, imei: null, serial_numbers: ['000SN1', '000SN2'], unit: '个', quantity: 2,
  unit_price: 10, gross_amount: 20, total_amount: 15, points_used: 500, deduction_amount: 5, points_awarded: 0, ...extra })
const order = (): CheckoutOrderDetail => ({ id: 10, order_no: 'SO-ORIGINAL', customer_name: '原客户', customer_phone: '13900000001', store_name: '一店', operator_name: '原销售员', sale_time: '2026-11-14 10:00:00', remarks: '整批公共备注',
  total_amount: 120, final_amount: 115, paid_amount: 115, deduction_amount: 5, points_used: 500, points_awarded: 10,
  items: [line({ id: 101, item_type: 'phone', sale_no: 'PHONE-A', linked_phone_sale_no: null, name: '原手机型号', product_model: null, serial_numbers: ['000PHONE'], quantity: 1,
    unit_price: 100, gross_amount: 100, total_amount: 100, points_used: 0, deduction_amount: 0, points_awarded: 10 }), line(),
  line({ id: 202, name: '原赠膜', sale_type: 'gift', serial_numbers: [], quantity: 1, unit_price: 0, gross_amount: 0, total_amount: 0, points_used: 0, deduction_amount: 0 })] })
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(OrderDialog, { props: { modelValue: true, saleId: 51, source: 'goods' }, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, SectionLoading: true, DataEmptyState: Empty } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
beforeEach(() => { queryView.value = goodsView.value = true; hidden.query = []; hidden.goods = []; mocks.get.mockResolvedValue({ success: true, data: order() }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('整单显示原手机、购买及赠品、SN和积分；请求复用统一接口且关闭缓存及全局Loading', async () => {
  const wrapper = await render()
  for (const value of ['原手机型号', '原充电器', '原赠膜', '赠送', '000SN1、000SN2', '整批公共备注', '本单现金入账', '¥115', '500']) expect(wrapper.text()).toContain(value)
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
  data.paid_amount = 5; expect(isCheckoutOrderDetail(data)).toBe(true)
  data.items[2].unit_price = 2; expect(isCheckoutOrderDetail(data)).toBe(false)
  const duplicated = order(); duplicated.items.push(duplicated.items[0]); expect(isCheckoutOrderDetail(duplicated)).toBe(false)
  const hiddenTotal = order(); hiddenTotal.final_amount = null; expect(isCheckoutOrderDetail(hiddenTotal)).toBe(false)
})

it('手机实际详情按钮传递原销售ID，关闭父详情或切换销售会清理子窗口', async () => {
  const detailItem: QueryItem = { 基本信息: { phone_id: 11 }, 客户信息: {}, 供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {}, 销售信息: { sale_id: 81 } }
  const Order = { name: 'CheckoutOrderDialog', props: ['modelValue', 'saleId', 'source'], template: '<div class="order-child" />' }
  const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem, canEdit: false, canDelete: false, canReturnToStock: false },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, CheckoutOrderDialog: Order }, directives: { permission: {} } } })
  wrappers.push(wrapper)
  await wrapper.findAll('button').find(button => button.text() === '整单明细')!.trigger('click'); await flushPromises()
  expect(wrapper.findComponent(Order).props()).toMatchObject({ modelValue: true, saleId: 81, source: 'phone' })
  await wrapper.setProps({ detailItem: { ...detailItem, 销售信息: { sale_id: 82 } } }); await flushPromises()
  expect(wrapper.find('.order-child').exists()).toBe(false)
})
