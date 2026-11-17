import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import History from '@/views/customers/page/CustomerGoodsHistory.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import { vTableDoubleTap } from '@/directives/table-double-tap'
import { isCustomerGoodsPage } from '@/utils/query-goods'
import type { CustomerGoodsRecord } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
const access = reactive({ customers: true, query: true, accessories: true })
const hidden = ref<string[]>([])
const isMobile = ref(true), isTablet = ref(false)
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: keyof typeof access) => ({ canView: computed(() => access[module]), hasPermission: (action: string) => action === 'goods-view' && access.accessories }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (_module: string, field: string) => !hidden.value.includes(field), getHiddenFields: () => hidden.value
} }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile, isTablet }) }))
const row = (extra: Partial<CustomerGoodsRecord> = {}): CustomerGoodsRecord => ({ id: 51, sale_no: 'AS1', order_no: 'SO1', linked_phone_invoice: 'PHONE1',
  sale_type: 'sale', store_name: '一店', name: '原充电头', category: '充电头', brand_name: '原品牌', product_model: 'MWVW3CH', color_name: '白', unit: '个',
  quantity: 2, returned_quantity: 2, remaining_quantity: 0, unit_price: '20.00', total_price: '35.00', points_awarded: 0, points_used: 500, deduction_amount: '5.00',
  operator_name: '原销售员', sale_time: '2026-11-14 10:00:00', remarks: '原备注', has_snapshot: 1, has_order: true, ...extra })
const page = (rows = [row()], current = 1, size = 10, total = rows.length) => ({ data: rows,
  pagination: { page: current, page_size: size, total, total_pages: Math.ceil(total / size), has_next: current < Math.ceil(total / size), has_prev: current > 1 } })
const Pagination = { props: ['current', 'pageSize', 'total'], emits: ['change'], template: '<div class="pagination">共{{total}}条<button @click="$emit(\'change\', 2, 10)">下一页</button></div>' }
const Order = { props: ['modelValue', 'saleId', 'source'], template: '<div v-if="modelValue" class="order">原单入口 {{saleId}} {{source}}</div>' }
const Empty = { props: ['description', 'title', 'actionText'], emits: ['action'], template: '<div class="empty">{{title}}{{description}}<button v-if="actionText" @click="$emit(\'action\')">{{actionText}}</button></div>' }
const DetailShell = { props: ['modelValue'], emits: ['update:modelValue'], template: '<section v-if="modelValue" class="record-detail-shell"><button aria-label="关闭商品记录详情" @click="$emit(\'update:modelValue\', false)">×</button><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></section>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(History, { props: { customerId: 8, active: true }, global: { plugins: [ElementPlus], components: { RecordDescriptions, RecordDetailDialog },
    stubs: { MobileDialog: DetailShell, Pagination, CheckoutOrderDialog: Order, SectionLoading: { template: '<p>正在查询客户商品记录...</p>' }, DataEmptyState: Empty },
    directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': vTableDoubleTap } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!
const openOrder = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.find('[data-mobile-record]').trigger('dblclick'); await flushPromises()
  await wrapper.find('.record-detail-shell footer button').trigger('click'); await flushPromises()
}
beforeEach(() => { Object.assign(access, { customers: true, query: true, accessories: true }); hidden.value = []; isMobile.value = true; isTablet.value = false; mocks.get.mockResolvedValue({ success: true, data: page() }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

it('按客户ID读取购买和赠品，已全退仍可进入原单，不把记录合计当客户消费统计', async () => {
  mocks.get.mockResolvedValue({ success: true, data: page([row(), row({ id: 52, name: '原赠膜', sale_type: 'gift', quantity: 1, returned_quantity: 0, remaining_quantity: 1,
    unit_price: 0, total_price: 0, points_used: 0, deduction_amount: 0 })]) })
  const wrapper = await render()
  expect(mocks.get).toHaveBeenCalledWith('/query/customers/8/goods', expect.objectContaining({ params: { page: 1, page_size: 10 }, useCache: false, showLoading: false, showError: false }))
  for (const text of ['原充电头', '原赠膜', '购买', '赠送', '原成交净额', '¥35', '已退数量', '未退数量', '原备注']) expect(wrapper.text()).toContain(text)
  await openOrder(wrapper)
  expect(wrapper.find('.order').text()).toContain('51 goods')
  expect(wrapper.text()).not.toContain('消费总额')
})

it('切换客户、关闭或撤回任一模块权限立即取消旧请求并清理历史及原单', async () => {
  const wrapper = await render(); await openOrder(wrapper)
  let resolveOld: (_value: unknown) => void = () => undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await wrapper.setProps({ customerId: 9 })
  const signal = mocks.get.mock.calls.at(-1)![1].signal as AbortSignal
  expect(wrapper.text()).not.toContain('原充电头'); expect(wrapper.find('.order').exists()).toBe(false)
  await wrapper.setProps({ customerId: 10 }); await flushPromises()
  expect(signal.aborted).toBe(true)
  resolveOld({ success: true, data: page([row({ name: '过期客户商品' })]) }); await flushPromises()
  expect(wrapper.text()).not.toContain('过期客户商品')
  for (const key of ['customers', 'query', 'accessories'] as const) {
    access[key] = false; await flushPromises()
    expect(wrapper.text()).toBe('')
    access[key] = true; await flushPromises()
  }
  const count = mocks.get.mock.calls.length
  await wrapper.setProps({ active: false }); await flushPromises(); expect(wrapper.text()).toBe(''); expect(mocks.get).toHaveBeenCalledTimes(count)
})

it('使用服务端分页读取末页，不截取首屏或重复原记录；空门店范围显示明确空态', async () => {
  mocks.get.mockResolvedValueOnce({ success: true, data: page(Array.from({ length: 10 }, (_, index) => row({ id: 51 + index })), 1, 10, 11) })
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ success: true, data: page([row({ id: 61, name: '末页商品' })], 2, 10, 11) })
  await button(wrapper, '下一页').trigger('click'); await flushPromises()
  expect(mocks.get.mock.calls.at(-1)![1].params).toEqual({ page: 2, page_size: 10 })
  expect(wrapper.text()).toContain('末页商品'); expect(wrapper.text()).not.toContain('原充电头')
  mocks.get.mockResolvedValueOnce({ success: true, data: page([row()], 1, 20) })
  wrapper.findComponent(Pagination).vm.$emit('change', 2, 20); await flushPromises()
  expect(mocks.get.mock.calls.at(-1)![1].params).toEqual({ page: 1, page_size: 20 })
  mocks.get.mockResolvedValueOnce({ success: true, data: page([], 1, 20) })
  await wrapper.setProps({ customerId: 9 }); await flushPromises()
  expect(wrapper.text()).toContain('授权门店内暂无商品购买或赠送记录')
})

it('隐藏字段变化清理原内容，合法NULL不显示为零，旧历史不提供伪造原单入口', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ success: true, data: page([row({ name: null, quantity: null, returned_quantity: null, remaining_quantity: null,
    unit_price: null, total_price: null, points_used: null, points_awarded: null, deduction_amount: null, has_order: false, has_snapshot: 0 })]) })
  hidden.value = ['basic_info.name', 'stock_info.total_quantity']; await flushPromises()
  expect(wrapper.text()).not.toContain('原充电头'); expect(wrapper.text()).not.toContain('原成交净额'); expect(wrapper.text()).not.toContain('¥0')
  expect(wrapper.text()).toContain('历史记录未保存商品快照')
  expect(wrapper.findAll('button').some(item => item.text() === '整单明细')).toBe(false)
})

it('请求失败可重试，残缺分页拒绝显示；卸载取消在途读取', async () => {
  mocks.get.mockRejectedValueOnce(new Error('隔离读取失败'))
  const wrapper = await render()
  expect(wrapper.text()).toContain('隔离读取失败')
  await button(wrapper, '重试').trigger('click'); await flushPromises(); expect(wrapper.text()).toContain('原充电头')
  mocks.get.mockResolvedValueOnce({ success: true, data: page([row()], 1, 10, 20) })
  await wrapper.setProps({ customerId: 9 }); await flushPromises()
  expect(wrapper.text()).toContain('商品记录响应不完整')
  mocks.get.mockImplementationOnce(() => new Promise(() => undefined))
  await button(wrapper, '重试').trigger('click')
  const signal = mocks.get.mock.calls.at(-1)![1].signal as AbortSignal
  wrapper.unmount(); expect(signal.aborted).toBe(true)
})

it('首次缺任一模块权限时不发请求', async () => {
  for (const key of ['customers', 'query', 'accessories'] as const) {
    access[key] = false; const wrapper = await render(); expect(wrapper.text()).toBe(''); wrapper.unmount(); access[key] = true
  }
  expect(mocks.get).not.toHaveBeenCalled()
})

it('隐藏客户关联字段清除记录和原单，且不以客户ID重读受限关联', async () => {
  const wrapper = await render()
  await openOrder(wrapper)
  const count = mocks.get.mock.calls.length
  for (const field of ['customer_info.customer_name', 'customer_info.customer_phone']) {
    hidden.value = [field]; await flushPromises()
    expect(wrapper.text()).toBe(''); expect(wrapper.find('.order').exists()).toBe(false)
  }
  expect(mocks.get).toHaveBeenCalledTimes(count)
})

it('响应校验拒绝重复行、错误退货数量和缺字段，允许空页与完整合法脱敏', () => {
  expect(isCustomerGoodsPage(page([]), 1, 10)).toBe(true)
  for (const data of [page([row(), row()]), page([row({ remaining_quantity: 2 })]), page([{ ...row(), points_used: -1 }]),
    page([{ ...row(), name: undefined }]), page([{ ...row(), quantity: true }]), page([row()], 2), page([row()], 1, 10, 20)]) expect(isCustomerGoodsPage(data, 1, 10)).toBe(false)
  expect(isCustomerGoodsPage(page([row({ quantity: null, returned_quantity: null, remaining_quantity: null, total_price: null, points_awarded: null })]), 1, 10)).toBe(true)
})

it('手机和平板记录单击不打开，双击公共详情后仅底部提供整单动作', async () => {
  for (const tablet of [false, true]) {
    isMobile.value = !tablet; isTablet.value = tablet
    const wrapper = await render()
    const record = wrapper.find('[data-mobile-record]')
    expect(record.exists()).toBe(true)
    expect(record.find('button').exists()).toBe(false)
    await record.trigger('click')
    expect(wrapper.find('.record-detail-shell').exists()).toBe(false)
    await record.trigger('dblclick'); await flushPromises()
    const detail = wrapper.find('.record-detail-shell')
    expect(detail.text()).toContain('原充电头')
    expect(detail.find('footer').text()).toBe('整单明细')
    expect(detail.findAll('.tf-record-details__field--wide').some(field => field.text().includes('原备注'))).toBe(true)
    await detail.find('footer button').trigger('click'); await flushPromises()
    expect(wrapper.find('.record-detail-shell').exists()).toBe(false)
    expect(wrapper.find('.order').text()).toContain('51 goods')
    wrapper.unmount()
  }
})

it('手机详情关闭可重开，翻页及字段撤权立即清理，旧历史只读时不保留空操作区', async () => {
  const wrapper = await render()
  await wrapper.find('[data-mobile-record]').trigger('dblclick'); await flushPromises()
  await wrapper.find('[aria-label="关闭商品记录详情"]').trigger('click'); await flushPromises()
  expect(wrapper.find('.record-detail-shell').exists()).toBe(false)
  await wrapper.find('[data-mobile-record]').trigger('dblclick'); await flushPromises()
  expect(wrapper.find('.record-detail-shell').exists()).toBe(true)
  mocks.get.mockResolvedValueOnce({ success: true, data: page([row({ id: 61, name: '末页商品', has_order: false, has_snapshot: 0 })], 2, 10, 11) })
  await button(wrapper, '下一页').trigger('click'); await flushPromises()
  expect(wrapper.find('.record-detail-shell').exists()).toBe(false)
  await wrapper.find('[data-mobile-record]').trigger('dblclick'); await flushPromises()
  expect(wrapper.find('.record-detail-shell').text()).toContain('历史记录未保存商品快照')
  expect(wrapper.find('.record-detail-shell footer').exists()).toBe(false)
  hidden.value = ['customer_info.customer_phone']; await flushPromises()
  expect(wrapper.text()).toBe('')
})

it('桌面保留原单按钮，不通过手机双击入口额外打开窗口', async () => {
  isMobile.value = false
  const wrapper = await render()
  expect(wrapper.find('[data-mobile-record] button').text()).toBe('整单明细')
  await wrapper.find('[data-mobile-record]').trigger('dblclick'); await flushPromises()
  expect(wrapper.find('.record-detail-shell').exists()).toBe(false)
  await button(wrapper, '整单明细').trigger('click'); await flushPromises()
  expect(wrapper.find('.order').text()).toContain('51 goods')
})
