import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInput, ElSelect, ElTable } from 'element-plus'
import Panel from '@/views/query/page/QueryGoodsPanel.vue'
import type { AccessorySaleRecord } from '@/types/accessory'
import { vTableDoubleTap } from '@/directives/table-double-tap'

const mocks = vi.hoisted(() => ({ get: vi.fn(), stores: vi.fn(), hidden: new Set<string>(), returnPermission: false, exchangePermission: false }))
const queryView = ref(true), goodsView = ref(true)
const isMobile = ref(false), isTablet = ref(false)
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/services/reference-options', () => ({ getCachedStores: mocks.stores }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'query' ? queryView.value : goodsView.value), hasPermission: (action: string) => action === 'exchange' ? mocks.exchangePermission : mocks.returnPermission }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile, isTablet }) }))

const row = (extra: Partial<AccessorySaleRecord> = {}): AccessorySaleRecord => ({ id: 51, accessory_id: 5, sale_no: 'AS001', order_no: 'SO001', linked_phone_invoice: 'PHONE001',
  sale_type: 'gift', store_id: 1, store_name: '一店', name: '原单充电器', barcode: '690001', category: '充电头', brand_name: '苹果', product_model: 'MWVW3CH',
  color_name: '白色', unit: '个', customer_name: '测试顾客', customer_phone: '13900000001', quantity: 2, unit_price: '0.00', total_price: '0.00',
  purchase_cost: null, profit: null, points_awarded: 0, operator_name: '销售员甲', sale_time: '2026-11-13 10:00:00', remarks: '整批公共备注', has_snapshot: 1, ...extra })
const result = (rows = [row()], total = 125) => ({ data: { data: rows, pagination: { total } } })
const Dialog = { props: { modelValue: Boolean }, emits: ['update:modelValue'], template: '<div v-if="modelValue" class="dialog"><button @click="$emit(\'update:modelValue\', false)">关闭</button><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></div>' }
const Pagination = { props: ['current', 'total', 'pageSize'], emits: ['change'], template: '<button @click="$emit(\'change\', 2)">第二页</button>' }
const Search = { emits: ['search', 'reset'], template: '<div class="search"><slot name="primary" /><slot /><button @click="$emit(\'search\')">搜索</button><button @click="$emit(\'reset\')">重置</button></div>' }
const ReturnDialog = { props: ['modelValue', 'sale', 'mode'], emits: ['success', 'update:modelValue'], template: '<button v-if="modelValue" class="return-dialog" @click="$emit(\'success\'); $emit(\'update:modelValue\', false)">完成退货</button>' }
const History = { props: ['saleId'], template: '<section class="aftersales">原单售后历史</section>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(Panel, { global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, CheckoutOrderDialog: { name: 'CheckoutOrderDialog', props: ['modelValue', 'saleId', 'source'], template: '<div class="order-child" />' }, GoodsReturnDialog: ReturnDialog, GoodsAftersaleHistory: History, Pagination, UnifiedSearchPanel: Search, DateRangePicker: true, SectionLoading: true, TableLoadingRow: true, DataEmptyState: true },
    mocks: { $getNumberColumnWidth: () => 80 }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': vTableDoubleTap } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!
beforeEach(() => {
  queryView.value = goodsView.value = true
  isMobile.value = isTablet.value = false
  mocks.hidden.clear()
  mocks.returnPermission = false
  mocks.exchangePermission = false
  mocks.get.mockResolvedValue(result())
  mocks.stores.mockResolvedValue({ data: [{ id: 1, name: '一店' }] })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks(); vi.unstubAllGlobals() })

it('展示商品销售/赠送原单和客户，未知成本保持空值，严格门店选项及实际分页总数', async () => {
  const wrapper = await render()
  expect(wrapper.text()).toContain('原单充电器')
  expect(wrapper.text()).toContain('赠送')
  expect(wrapper.text()).toContain('13900000001')
  expect(wrapper.text()).not.toContain('¥NaN')
  expect(wrapper.findComponent(Pagination).props('total')).toBe(125)
  expect(mocks.stores).toHaveBeenCalledWith(true)
  expect(mocks.get).toHaveBeenCalledWith('/query/goods', expect.objectContaining({ params: expect.objectContaining({ page: 1, page_size: 20 }), useCache: false, showLoading: false }))
  await button(wrapper, '第二页').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }))
})

it('商品退货只针对有权限的共同原单，成功后立即重读数量，不改写原销售事实', async () => {
  mocks.returnPermission = true
  mocks.get.mockResolvedValueOnce(result([row({ order_id: 10, order_item_id: 50, returned_quantity: 1, remaining_quantity: 1 })]))
  const wrapper = await render()
  expect(wrapper.text()).toContain('已退数量'); expect(wrapper.text()).toContain('原成交净额')
  await button(wrapper, '退货').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ReturnDialog).props('sale').order_item_id).toBe(50)
  const calls = mocks.get.mock.calls.length
  await button(wrapper, '完成退货').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenCalledTimes(calls + 1)
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ useCache: false }))
  expect(wrapper.find('.return-dialog').exists()).toBe(false)
  mocks.get.mockResolvedValueOnce(result([row({ order_id: 10, order_item_id: 50, remaining_quantity: 0 })]))
  await button(wrapper, '搜索').trigger('click'); await flushPromises()
  expect(wrapper.findAll('button').some(item => item.text() === '退货')).toBe(false)
})

it('关键词和销售/赠送筛选重置页码，重置清空全部条件', async () => {
  const wrapper = await render()
  await button(wrapper, '第二页').trigger('click'); await flushPromises()
  wrapper.findComponent(ElInput).vm.$emit('update:modelValue', ' SN001 ')
  const select = wrapper.findAllComponents(ElSelect)[0]
  select.vm.$emit('update:modelValue', 'gift'); select.vm.$emit('change')
  await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ params: expect.objectContaining({ page: 1, keyword: 'SN001', sale_type: 'gift' }) }))
  await button(wrapper, '重置').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElInput).props('modelValue')).toBe('')
  expect(mocks.get.mock.calls.at(-1)?.[1].params.sale_type).toBeUndefined()
  expect(mocks.get.mock.calls.at(-1)?.[1].params.store_id).toBeUndefined()
})

it('查看成交资料、SN和原采购批次，关闭详情后不保留旧内容', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row(), serial_numbers: ['SN001', 'SN002'], batches: [{ id: 9, batch_no: 'IN001', supplier_name: '原采购商', quantity: 2, purchase_cost: '12.50' }] } })
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods/51', expect.objectContaining({ useCache: false }))
  expect(wrapper.find('.dialog').text()).toContain('销售时资料')
  expect(wrapper.find('.dialog').text()).toContain('SN001、SN002')
  expect(wrapper.find('.dialog').text()).toContain('原采购商')
  expect(wrapper.find('.dialog').text()).toContain('¥12.5')
  expect(wrapper.find('.dialog').text()).toContain('整批公共备注')
  await button(wrapper, '关闭').trigger('click'); await flushPromises()
  expect(wrapper.find('.dialog').exists()).toBe(false)
})

it('旧单明确显示当前档案，不把现行名称冒充销售快照', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row({ has_snapshot: 0 }), serial_numbers: [], batches: [] } })
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  expect(wrapper.find('.dialog').text()).toContain('当前档案（原单无资料快照）')
  expect(wrapper.findComponent(History).exists()).toBe(false)
})

it('手机商品详情的长名称和客户手机号独占整行，短字段保持两列', async () => {
  isMobile.value = true
  vi.stubGlobal('innerWidth', 390)
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row(), serial_numbers: [], batches: [] } })
  wrapper.findComponent(ElTable).vm.$emit('row-dblclick', row()); await flushPromises()
  const labels = wrapper.find('.dialog').findAll('.el-descriptions__label')
  for (const label of ['商品名称', '客户手机号']) {
    expect(labels.find(cell => cell.text() === label)?.attributes('colspan')).toBe('2')
  }
  expect(labels.find(cell => cell.text() === '商品类型')?.attributes('colspan')).toBe('1')
})

it('商品换货入口独立于退货权限，传入原单和换货模式，成功后无缓存刷新', async () => {
  mocks.exchangePermission = true
  mocks.get.mockResolvedValueOnce(result([row({ order_id: 10, order_item_id: 50, remaining_quantity: 1 })]))
  const wrapper = await render()
  expect(wrapper.findAll('button').some(item => item.text() === '退货')).toBe(false)
  await button(wrapper, '换货').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ReturnDialog).props('mode')).toBe('exchange')
  expect(wrapper.findComponent(ReturnDialog).props('sale')).toMatchObject({ order_id: 10, order_item_id: 50 })
  await wrapper.find('.return-dialog').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ useCache: false }))
})

it('共同原单详情内接入该商品销售的售后历史，关闭详情同步卸载历史', async () => {
  const wrapper = await render()
  expect(wrapper.findComponent(History).exists()).toBe(false)
  mocks.get.mockResolvedValueOnce({ data: { ...row({ order_id: 10, order_item_id: 50 }), serial_numbers: [], batches: [] } })
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  expect(wrapper.find('.dialog .aftersales').exists()).toBe(true)
  expect(wrapper.findComponent(History).props('saleId')).toBe(51)
  await button(wrapper, '关闭').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(History).exists()).toBe(false)
})

it.each(['phone', 'tablet'])('%s 同行双击打开当前商品详情，滑动浏览不误开详情', async device => {
  isMobile.value = device === 'phone'
  isTablet.value = device === 'tablet'
  const wrapper = await render()
  const cell = wrapper.find('.el-table__body tr.el-table__row td').element
  const touch = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    const point = { identifier: 1, clientX: x, clientY: 20 }
    Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } })
    cell.dispatchEvent(event)
  }
  mocks.get.mockClear()
  touch('touchstart', 20); touch('touchmove', 60); touch('touchend', 60)
  await flushPromises()
  expect(mocks.get).not.toHaveBeenCalled()
  mocks.get.mockResolvedValueOnce({ data: { ...row(), serial_numbers: [], batches: [] } })
  for (let tap = 0; tap < 2; tap++) { touch('touchstart', 20); touch('touchend', 20) }
  await flushPromises()
  expect(mocks.get).toHaveBeenCalledOnce()
  expect(mocks.get).toHaveBeenCalledWith('/query/goods/51', expect.objectContaining({ useCache: false }))
  expect(wrapper.find('.dialog').text()).toContain('原单充电器')
})

it('更晚的搜索覆盖早先请求，旧响应和旧详情不能恢复内容', async () => {
  const wrapper = await render()
  let resolveOld: ((value: unknown) => void) | undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await button(wrapper, '搜索').trigger('click')
  const signal = mocks.get.mock.calls.at(-1)?.[1].signal as AbortSignal
  mocks.get.mockResolvedValueOnce(result([row({ name: '新结果' })]))
  await button(wrapper, '搜索').trigger('click'); await flushPromises()
  expect(signal.aborted).toBe(true)
  resolveOld?.(result([row({ name: '旧结果' })])); await flushPromises()
  expect(wrapper.text()).toContain('新结果')
  expect(wrapper.text()).not.toContain('旧结果')
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await button(wrapper, '详情').trigger('click')
  const detailSignal = mocks.get.mock.calls.at(-1)?.[1].signal as AbortSignal
  await button(wrapper, '关闭').trigger('click'); await flushPromises()
  expect(detailSignal.aborted).toBe(true)
  resolveOld?.({ data: { ...row(), serial_numbers: [], batches: [] } }); await flushPromises()
  expect(wrapper.find('.dialog').exists()).toBe(false)
})

it('刷新失败保留旧列表并展示错误，公开load向公共刷新入口抛出失败', async () => {
  const wrapper = await render()
  mocks.get.mockRejectedValueOnce(new Error('network'))
  await button(wrapper, '搜索').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('商品销售记录读取失败')
  expect(wrapper.findComponent(ElTable).props('data')).toHaveLength(1)
  mocks.get.mockRejectedValueOnce(new Error('network'))
  await expect(wrapper.vm.load()).rejects.toThrow('network')
})

it('没有任一查看权限不读接口；权限撤销取消请求并清空结果', async () => {
  const wrapper = await render()
  goodsView.value = false
  await flushPromises()
  expect(wrapper.findComponent(ElTable).props('data')).toEqual([])
  mocks.get.mockClear(); mocks.stores.mockClear()
  queryView.value = false
  await render()
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.stores).not.toHaveBeenCalled()
})

it('隐藏客户、价格和门店字段不展示，也不读取门店选项或提交门店筛选', async () => {
  for (const field of ['customer_info.customer_phone', 'price_info.purchase_cost', 'stock_info.distribution']) mocks.hidden.add(field)
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('13900000001')
  expect(wrapper.text()).not.toContain('原单总成本')
  expect(wrapper.text()).not.toContain('销售门店')
  expect(mocks.stores).not.toHaveBeenCalled()
  expect(mocks.get.mock.calls[0][1].params.store_id).toBeUndefined()
})


it.each(['phone', 'tablet'])('%s 操作只在详情底部可达，换货先关闭详情再携带原单进入', async device => {
  isMobile.value = device === 'phone'; isTablet.value = device === 'tablet'
  mocks.exchangePermission = true
  const original = row({ order_id: 10, order_item_id: 50, remaining_quantity: 1 })
  mocks.get.mockResolvedValueOnce(result([original]))
  const wrapper = await render()
  expect(wrapper.findAll('.el-table__header th').some(node => node.text() === '操作')).toBe(false)
  expect(wrapper.findAll('button').some(node => node.text() === '换货')).toBe(false)
  mocks.get.mockResolvedValueOnce({ data: { ...original, serial_numbers: [], batches: [] } })
  wrapper.findComponent(ElTable).vm.$emit('row-dblclick', original, null, new MouseEvent('dblclick'))
  await flushPromises()
  const action = wrapper.findAll('.dialog footer button').find(node => node.text() === '换货')
  expect(action).toBeDefined()
  await action!.trigger('click'); await flushPromises()
  expect(wrapper.find('.dialog').exists()).toBe(false)
  expect(wrapper.findComponent(ReturnDialog).props()).toMatchObject({ modelValue: true, mode: 'exchange', sale: { order_id: 10, order_item_id: 50 } })
})


it('已全退商品仍可从详情打开整单原记录，按真实销售ID传递且不要求售后权限', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row({ order_id: 10, order_item_id: 50, returned_quantity: 2, remaining_quantity: 0 }), serial_numbers: [], batches: [] } })
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  await button(wrapper, '整单明细').trigger('click'); await flushPromises()
  expect(wrapper.findComponent({ name: 'CheckoutOrderDialog' }).props()).toMatchObject({ saleId: 51, source: 'goods', modelValue: true })
  expect(wrapper.find('.dialog').exists()).toBe(false)
})
