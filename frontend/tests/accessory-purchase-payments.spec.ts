import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInput, ElSelect } from 'element-plus'
import PurchasePayments from '@/views/payments/page/AccessoryPurchasePayments.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import type { AccessoryPurchaseRecord } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), success: vi.fn(), hidden: new Set<string>(), view: true, create: true, edit: true }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => mocks.view), canCreate: computed(() => mocks.create), canEdit: computed(() => mocks.edit) }) }))
vi.mock('@/composables/useFieldPermissions', async importOriginal => ({
  ...await importOriginal<typeof import('@/composables/useFieldPermissions')>(),
  fieldPermissions: { permissions: ref({}), isFieldVisible: (_module: string, key: string) => !mocks.hidden.has(key) }
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(false) }) }))
const Dialog = { props: { modelValue: Boolean }, template: '<div v-if="modelValue" class="dialog"><slot /><slot name="footer" /></div>' }
const Pagination = { props: { current: Number, total: Number }, emits: ['change'], template: '<div class="pagination"><slot /></div>' }
const row = (extra: Partial<AccessoryPurchaseRecord> = {}): AccessoryPurchaseRecord => ({ id: 8, has_snapshot: false, name: '通用充电宝', batch_no: 'AI20261113', supplier_name: '采购商', store_name: '一店', quantity: 50, total_amount: '625.00', purchase_cost: '12.50', payment_status: 'unpaid', latest_event_id: 0, ...extra })
const response = (rows = [row()]) => ({ success: true, data: rows, pagination: { total: rows.length }, summary: { total: rows.length, total_quantity: 50, total_amount: 625, paid_amount: 0, unpaid_amount: 625 } })
const wrappers: ReturnType<typeof mount>[] = []
async function render() {
  const wrapper = mount(PurchasePayments, { global: {
    plugins: [ElementPlus], components: { RecordDetailDialog, RecordDescriptions },
    stubs: { MobileDialog: Dialog, Pagination, SectionLoading: true, DataEmptyState: true },
    mocks: { $getNumberColumnWidth: () => 80 }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} }
  } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, label: string) => wrapper.findAll('button').find(item => item.text() === label)!
beforeEach(() => { mocks.view = mocks.create = mocks.edit = true; mocks.hidden.clear(); mocks.get.mockResolvedValue(response()); mocks.post.mockResolvedValue({ success: true }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('采购显示整批原始数量与金额、独立状态，不出现销售状态过滤', async () => {
  const wrapper = await render()
  expect(wrapper.text()).toContain('通用充电宝')
  expect(wrapper.text()).toContain('625')
  expect(wrapper.find('.accessory-purchase-stats-cards').exists()).toBe(true)
  expect(wrapper.findAll('.accessory-purchase-stats-cards .stat-card')).toHaveLength(4)
  expect(wrapper.text()).toContain('待打款商品货款')
  expect(wrapper.text()).toContain('已登记商品货款')
  expect(wrapper.text()).toContain('采购总额')
  expect(wrapper.text()).toContain('采购数量')
  expect(wrapper.text()).not.toContain('共 1 张采购单')
  expect(wrapper.findAllComponents(ElSelect)).toHaveLength(5)
  expect(mocks.get).toHaveBeenCalledWith('/supplier-payments/accessory-purchases', expect.objectContaining({ params: { page: 1, page_size: 20, payment_status: 'all' }, useCache: false }))
})

it('采购表格不显示资料来源提示，登记弹窗仍区分原采购商品名称', async () => {
  mocks.get.mockResolvedValue(response([row({ has_snapshot: true })]))
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('入库时资料')
  expect(wrapper.text()).not.toContain('当前档案（旧单无快照）')
  await button(wrapper, '登记打款').trigger('click')
  expect(wrapper.text()).toContain('商品名称（入库时）')
})

it('供应商、品牌、商品名称和店铺支持输入筛选并统一传参', async () => {
  const wrapper = await render()
  const selects = wrapper.findAllComponents(ElSelect)
  selects[0].vm.$emit('update:modelValue', '供应商甲')
  selects[1].vm.$emit('update:modelValue', '品牌甲')
  selects[2].vm.$emit('update:modelValue', '商品甲')
  selects[3].vm.$emit('update:modelValue', '一店')
  await button(wrapper, '搜索').trigger('click')
  await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/supplier-payments/accessory-purchases', expect.objectContaining({
    params: expect.objectContaining({ supplier_name: '供应商甲', brand_name: '品牌甲', product_name: '商品甲', store_name: '一店' }),
    useCache: false
  }))
})
it('打开筛选下拉时读取全量采购选项，包含配件业务范围主档', async () => {
  mocks.get.mockImplementation(async (url: string) => url.endsWith('/options')
    ? { success: true, data: { suppliers: ['供应商甲', '供应商乙'], brands: ['品牌甲', '品牌乙'], products: ['商品甲'], stores: ['一店'] } }
    : response())
  const wrapper = await render()
  wrapper.findAllComponents(ElSelect)[0].vm.$emit('focus')
  await flushPromises()
  expect(mocks.get).toHaveBeenCalledWith('/supplier-payments/accessory-purchases/options', { showLoading: false, useCache: false })
})

it('旧采购表格不显示来源文字，缺少资料来源字段的响应仍拒绝展示', async () => {
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('入库时资料')
  expect(wrapper.text()).not.toContain('当前档案（旧单无快照）')
  wrapper.unmount()
  const malformed = { ...row(), has_snapshot: undefined }
  mocks.get.mockResolvedValue({ ...response(), data: [malformed] })
  const invalid = await render()
  expect(invalid.text()).toContain('商品货款读取失败')
  expect(invalid.text()).not.toContain('通用充电宝')
})
it('登记只发送原单版本、支付方式和北京时间，不发送金额/客户/操作员，成功刷新', async () => {
  const wrapper = await render()
  await button(wrapper, '登记打款').trigger('click')
  await button(wrapper, '确认登记').trigger('click')
  await flushPromises()
  const input = mocks.post.mock.calls[0][1]
  expect(mocks.post.mock.calls[0][0]).toBe('/supplier-payments/accessory-purchases/8/payment')
  expect(input).toEqual({ expected_event_id: 0, request_key: expect.stringMatching(/^[a-f0-9]{32}$/), payment_method: 'bank_transfer', payment_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/), remarks: '' })
  expect(wrapper.find('.dialog').exists()).toBe(false)
  expect(mocks.get).toHaveBeenCalledTimes(2)
})
it('网络失败保留草稿和相同请求标识，提交中双击只请求一次', async () => {
  const wrapper = await render()
  await button(wrapper, '登记打款').trigger('click')
  mocks.post.mockRejectedValueOnce(new Error('network'))
  await button(wrapper, '确认登记').trigger('click'); await flushPromises()
  const input = mocks.post.mock.calls[0][1]
  expect(wrapper.find('.dialog').exists()).toBe(true)
  let resolve: ((value: { success: boolean }) => void) | undefined
  mocks.post.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await button(wrapper, '确认登记').trigger('click'); await button(wrapper, '确认登记').trigger('click')
  expect(mocks.post).toHaveBeenCalledTimes(2)
  expect(mocks.post.mock.calls[1][1]).toEqual(input)
  expect(button(wrapper, '取消').attributes('disabled')).toBeDefined()
  resolve?.({ success: true }); await flushPromises()
})
it('已付采购撤销必须输入原因，携带原单版本且不重写金额', async () => {
  mocks.get.mockResolvedValue(response([row({ payment_status: 'paid', latest_event_id: 11 })]))
  const wrapper = await render()
  expect(button(wrapper, '登记打款')).toBeUndefined()
  await button(wrapper, '撤销登记').trigger('click')
  expect(button(wrapper, '确认撤销').attributes('disabled')).toBeDefined()
  wrapper.find('.dialog').findComponent(ElInput).vm.$emit('update:modelValue', '原记录错误')
  await flushPromises()
  await button(wrapper, '确认撤销').trigger('click'); await flushPromises()
  expect(mocks.post).toHaveBeenCalledWith('/supplier-payments/accessory-purchases/8/cancel-payment', { expected_event_id: 11, request_key: expect.any(String), remarks: '原记录错误' }, { showLoading: false })
})
it.each(['payment.purchase_cost', 'payment.supplier_name', 'system_info.operations'])('隐藏%s不能登记，汇总不泄漏成本', async key => {
  mocks.hidden.add(key)
  const wrapper = await render()
  expect(button(wrapper, '登记打款')).toBeUndefined()
  if (key === 'payment.purchase_cost') expect(wrapper.text()).not.toContain('625')
  expect(mocks.post).not.toHaveBeenCalled()
})
it('没有创建/编辑权限不出现财务操作，无查看权限不读API', async () => {
  mocks.create = mocks.edit = false
  const wrapper = await render()
  expect(button(wrapper, '登记打款')).toBeUndefined()
  mocks.get.mockClear(); mocks.view = false
  await render()
  expect(mocks.get).not.toHaveBeenCalled()
})
it('筛选旧响应不能覆盖新响应，失败时展示重试并清空旧汇总', async () => {
  const wrapper = await render()
  let old: ((value: ReturnType<typeof response>) => void) | undefined
  mocks.get.mockImplementationOnce(() => new Promise(done => { old = done }))
  const filter = wrapper.findAllComponents(ElSelect)[4]
  filter.vm.$emit('update:modelValue', 'paid'); filter.vm.$emit('change', 'paid'); await flushPromises()
  mocks.get.mockResolvedValueOnce(response([row({ name: '新筛选结果', payment_status: 'unpaid' })]))
  filter.vm.$emit('update:modelValue', 'unpaid'); filter.vm.$emit('change', 'unpaid'); await flushPromises()
  old?.(response([row({ name: '过期结果' })])); await flushPromises()
  expect(wrapper.text()).toContain('新筛选结果'); expect(wrapper.text()).not.toContain('过期结果')
  mocks.get.mockRejectedValueOnce(new Error('network'))
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(wrapper.text()).toContain('商品货款读取失败')
  expect(wrapper.text()).not.toContain('625')
})
it('历史按原采购ID分页，关闭后丢弃旧响应，隐藏状态不能打开历史', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: [{ id: 11, stock_in_id: 8, action: 'cancel', amount: 625, reference_event_id: 10, remarks: '核对错误' }], pagination: { total: 21 } })
  await button(wrapper, '记录').trigger('click'); await flushPromises()
  expect(wrapper.find('.dialog').text()).toContain('撤销登记')
  expect(wrapper.find('.dialog').text()).toContain('核对错误')
  mocks.get.mockResolvedValueOnce({ data: [], pagination: { total: 21 } })
  wrapper.findAllComponents(Pagination)[1].vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/supplier-payments/accessory-purchases/8/payments', expect.objectContaining({ params: { page: 2, page_size: 20 }, useCache: false }))
  mocks.hidden.add('payment.payment_status')
  const hidden = await render()
  expect(button(hidden, '记录')).toBeUndefined()
})

it('采购操作提供原单退供核对入口，读取指定采购ID且不发送退供或资金写请求', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ success: false })
  await button(wrapper, '退供核对').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/supplier-payments/accessory-purchases/8/return-context', expect.objectContaining({
    params: { page: 1, page_size: 20, serial_page: 1, serial_search: '' }, useCache: false, showLoading: false
  }))
  expect(wrapper.findComponent({ name: 'DataEmptyState' }).attributes('title')).toBe('退供核对失败')
  expect(mocks.post).not.toHaveBeenCalled()
})
