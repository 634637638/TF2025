import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInput, ElSelect, ElTable } from 'element-plus'
import Panel from '@/views/query/page/QueryGoodsPanel.vue'
import type { AccessorySaleRecord } from '@/types/accessory'
import { vTableDoubleTap } from '@/directives/table-double-tap'

const mocks = vi.hoisted(() => ({ get: vi.fn(), stores: vi.fn(), operators: vi.fn(), filterOptions: vi.fn(), productNames: vi.fn(), hidden: new Set<string>(), returnPermission: false, exchangePermission: false }))
const queryView = ref(true), goodsView = ref(true)
const goodsCreate = ref(false), goodsGift = ref(false)
const isMobile = ref(false), isTablet = ref(false)
const hiddenFields = ref(mocks.hidden)
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/services/reference-options', () => ({ getStores: mocks.stores, searchOperators: mocks.operators, getGoodsFilterOptions: mocks.filterOptions, getGoodsProductNameOptions: mocks.productNames }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({
  canView: computed(() => module === 'query' ? queryView.value : goodsView.value),
  canCreate: computed(() => false),
  hasPermission: (action: string) => module === 'query' && (action === 'goods-view' ? goodsView.value : action === 'goods-sell' ? goodsCreate.value : action === 'goods-gift' ? goodsGift.value : action === 'exchange' ? mocks.exchangePermission : mocks.returnPermission)
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !hiddenFields.value.has(field) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile, isTablet }) }))

const row = (extra: Partial<AccessorySaleRecord> = {}): AccessorySaleRecord => ({ id: 51, accessory_id: 5, sale_no: 'AS001', order_no: 'SO001', linked_phone_invoice: 'PHONE001',
  sale_type: 'gift', store_id: 1, store_name: '一店', name: '原单充电器', barcode: '690001', category: '充电头', brand_name: '苹果', product_model: 'MWVW3CH',
  color_name: '白色', unit: '个', customer_name: '测试顾客', customer_phone: '13900000001', quantity: 2, unit_price: '0.00', total_price: '0.00',
  purchase_cost: null, profit: null, points_awarded: 0, operator_name: '销售员甲', sale_time: '2026-11-13 10:00:00', remarks: '整批公共备注', has_snapshot: 1, ...extra })
const result = (rows = [row()], total = 125) => ({ data: { data: rows, pagination: { total } } })
const Dialog = { props: { modelValue: Boolean }, emits: ['update:modelValue'], template: '<div v-if="modelValue" class="dialog"><button @click="$emit(\'update:modelValue\', false)">关闭</button><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></div>' }
const Pagination = { props: ['current', 'total', 'pageSize', 'pageSizes', 'showPageSizes'], emits: ['change'], template: '<div><button @click="$emit(\'change\', 2, pageSize)">第二页</button><button v-for="size in pageSizes" :key="size" @click="$emit(\'change\', current, size)">每页{{ size }}条</button></div>' }
const Search = { emits: ['search', 'reset'], template: '<div class="search"><slot name="primary" /><slot /><button @click="$emit(\'search\')">搜索</button><button @click="$emit(\'reset\')">重置</button></div>' }
const ReturnDialog = { props: ['modelValue', 'sale', 'mode'], emits: ['success', 'update:modelValue'], template: '<button v-if="modelValue" class="return-dialog" @click="$emit(\'success\'); $emit(\'update:modelValue\', false)">完成退货</button>' }
const History = { props: ['saleId'], template: '<section class="aftersales">原单售后历史</section>' }
const Checkout = { props: ['modelValue'], emits: ['success', 'update:modelValue'], template: '<div v-if="modelValue" class="goods-checkout"><button @click="$emit(\'success\'); $emit(\'update:modelValue\', false)">完成商品销售</button></div>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(Panel, { global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, CheckoutOrderDialog: { name: 'CheckoutOrderDialog', props: ['modelValue', 'saleId', 'source'], template: '<div class="order-child" />' }, GoodsReturnDialog: ReturnDialog, GoodsAftersaleHistory: History, SalesGoodsCheckoutDialog: Checkout, Pagination, UnifiedSearchPanel: Search, DateRangePicker: true, SectionLoading: true, TableLoadingRow: true, DataEmptyState: true },
    mocks: { $getNumberColumnWidth: () => 80 }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': vTableDoubleTap } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!
beforeEach(() => {
  queryView.value = goodsView.value = true
  goodsCreate.value = goodsGift.value = false
  isMobile.value = isTablet.value = false
  mocks.hidden.clear()
  mocks.returnPermission = false
  mocks.exchangePermission = false
  mocks.get.mockResolvedValue(result())
  mocks.stores.mockResolvedValue({ data: [{ id: 1, name: '一店' }] })
  mocks.operators.mockResolvedValue({ data: [{ id: 8, name: '销售员甲' }] })
  mocks.filterOptions.mockResolvedValue({ data: { brands: [{ id: 2, name: '苹果' }], categories: [{ id: 3, name: '充电头' }] } })
  mocks.productNames.mockResolvedValue({ data: ['充电头', '充电线'] })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.useRealTimers(); vi.resetAllMocks(); vi.unstubAllGlobals() })

it('展示商品销售类型、数量、原单和客户，未知成本保持空值，严格门店选项及实际分页总数', async () => {
  const wrapper = await render()
  expect(wrapper.text()).toContain('原单充电器')
  expect(wrapper.text()).toContain('赠送')
  expect(wrapper.text()).toContain('2026-11-13 10:00:00')
  expect(wrapper.text()).toContain('数量')
  expect(wrapper.text()).toContain('获得积分')
  expect(wrapper.text()).not.toContain('累计积分')
  expect(wrapper.find('.status-badge.status-warning').text()).toBe('赠送')
  const columnLabels = wrapper.findAll('th .cell').map(cell => cell.text())
  expect(columnLabels.slice(1, 9)).toEqual(['销售店铺', '销售时间', '品牌', '商品名称', '商品类型', '销售', '客户姓名', '手机号'])
  expect(columnLabels.slice(9, -1)).toEqual(['数量', '已退数量', '销售价', '实收', '成本', '抵扣金额', '获得积分', '销售员'])
  expect(columnLabels).not.toContain('商品单号')
  expect(columnLabels).not.toContain('未退数量')
  expect(columnLabels).not.toContain('配件型号')
  expect(columnLabels).not.toContain('利润')
  expect(columnLabels).not.toContain('抵扣积分')
  expect(wrapper.text()).toContain('13900000001')
  expect(wrapper.text()).not.toContain('¥NaN')
  expect(wrapper.findComponent(Pagination).props('total')).toBe(125)
  expect(wrapper.findComponent(Pagination).props('pageSizes')).toEqual([20, 50, 100])
  expect(wrapper.findComponent(Pagination).props('showPageSizes')).toBe(true)
  expect(mocks.stores).toHaveBeenCalledWith({ strictScope: true })
  expect(mocks.get).toHaveBeenCalledWith('/query/goods', expect.objectContaining({ params: expect.objectContaining({ page: 1, page_size: 20 }), useCache: false, showLoading: false }))
  await button(wrapper, '第二页').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }))
})

it('切换商品模式每页条数后回到第一页并提交新的页大小', async () => {
  const wrapper = await render()
  await button(wrapper, '第二页').trigger('click'); await flushPromises()
  await button(wrapper, '每页50条').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({
    params: expect.objectContaining({ page: 1, page_size: 50 })
  }))
  expect(wrapper.findComponent(Pagination).props()).toMatchObject({ current: 1, pageSize: 50 })
})

it('商品退货只针对有权限的共同原单，成功后立即重读数量，不改写原销售事实', async () => {
  mocks.returnPermission = true
  mocks.get.mockResolvedValueOnce(result([row({ order_id: 10, order_item_id: 50, returned_quantity: 1, remaining_quantity: 1 })]))
  const wrapper = await render()
  expect(wrapper.text()).toContain('已退数量'); expect(wrapper.text()).toContain('实收')
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

it('按销售员、品牌、商品名称和商品类型筛选，使用字段权限对应的控件', async () => {
  const wrapper = await render()
  expect(mocks.filterOptions).toHaveBeenCalledOnce()
  const selects = wrapper.findAllComponents(ElSelect)
  selects[2].vm.$emit('update:modelValue', 8); selects[2].vm.$emit('change', 8)
  selects[3].vm.$emit('update:modelValue', 2); selects[3].vm.$emit('change', 2)
  selects[4].vm.$emit('update:modelValue', '充电头'); selects[4].vm.$emit('change', '充电头')
  selects[5].vm.$emit('update:modelValue', 3); selects[5].vm.$emit('change', 3)
  await flushPromises()
  expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ sale_operator_id: 8, brand_id: 2, product_name: '充电头', category_id: 3 })
  await button(wrapper, '重置').trigger('click'); await flushPromises()
  expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ sale_operator_id: undefined, brand_id: undefined, product_name: undefined, category_id: undefined })
})

it('商品名称远程下拉支持自由输入筛选并取消过期建议请求', async () => {
  const wrapper = await render()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  let resolveOld!: (value: { data: string[] }) => void
  let resolveNew!: (value: { data: string[] }) => void
  mocks.productNames.mockReset()
  mocks.productNames.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
  mocks.productNames.mockReturnValueOnce(new Promise(resolve => { resolveNew = resolve }))
  const productSelect = wrapper.findAllComponents(ElSelect)[4]
  const searchNames = productSelect.props('remoteMethod') as (value: string) => void
  searchNames('旧商品')
  await vi.advanceTimersByTimeAsync(200)
  searchNames('新商品')
  expect(mocks.productNames.mock.calls[0][1].aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(200)
  resolveNew({ data: ['新商品名称'] })
  await flushPromises()
  resolveOld({ data: ['旧商品名称'] })
  await flushPromises()
  const setupState = (wrapper.findComponent(Panel).vm as unknown as { $: { setupState: Record<string, unknown> } }).$?.setupState
  expect(setupState?.productNames).toEqual(['新商品名称'])
  productSelect.vm.$emit('update:modelValue', '自定义商品名称')
  productSelect.vm.$emit('change', '自定义商品名称')
  await flushPromises()
  expect(mocks.get.mock.calls.at(-1)?.[1].params.product_name).toBe('自定义商品名称')
})

it('聚焦商品名称时加载最近成交名称供下拉选择', async () => {
  const wrapper = await render()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  mocks.productNames.mockClear()
  mocks.productNames.mockResolvedValue({ data: ['最近成交商品'] })
  await wrapper.findAllComponents(ElSelect)[4].find('input').trigger('focus')
  await vi.advanceTimersByTimeAsync(200)
  await flushPromises()
  expect(mocks.productNames).toHaveBeenCalledWith({ keyword: '', store_id: undefined }, expect.any(AbortSignal))
  const setupState = (wrapper.findComponent(Panel).vm as unknown as { $: { setupState: Record<string, unknown> } }).$?.setupState
  expect(setupState?.productNames).toEqual(['最近成交商品'])
})

it('销售员远程搜索取消旧请求，迟到结果不能覆盖新关键词', async () => {
  const wrapper = await render()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  let resolveOld!: (value: { data: Array<{ id: number; name: string }> }) => void
  let resolveNew!: (value: { data: Array<{ id: number; name: string }> }) => void
  mocks.operators.mockReset()
  mocks.operators.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
  mocks.operators.mockReturnValueOnce(new Promise(resolve => { resolveNew = resolve }))
  const searchOperators = wrapper.findAllComponents(ElSelect)[2].props('remoteMethod') as (value: string) => void
  searchOperators('旧关键词')
  await vi.advanceTimersByTimeAsync(200)
  searchOperators('新关键词')
  expect(mocks.operators.mock.calls[0][1].signal.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(200)
  resolveNew({ data: [{ id: 9, name: '新销售员' }] })
  await flushPromises()
  resolveOld({ data: [{ id: 8, name: '旧销售员' }] })
  await flushPromises()
  const setupState = (wrapper.findComponent(Panel).vm as unknown as { $: { setupState: Record<string, unknown> } }).$?.setupState
  expect(setupState?.operators).toEqual([{ id: 9, name: '新销售员' }])
})

it('查看成交资料、SN和原采购批次，关闭详情后不保留旧内容', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row({ remaining_quantity: 1, profit: '15.00' }), serial_numbers: ['SN001', 'SN002'], batches: [{ id: 9, batch_no: 'IN001', supplier_name: '原采购商', quantity: 2, purchase_cost: '12.50' }] } })
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods/51', expect.objectContaining({ useCache: false }))
  expect(wrapper.find('.dialog').text()).not.toContain('销售时资料')
  expect(wrapper.find('.dialog .goods-detail__overview').exists()).toBe(true)
  expect(wrapper.find('.dialog .goods-detail__metrics').exists()).toBe(true)
  expect(wrapper.find('.dialog').text()).toContain('销售与客户')
  expect(wrapper.find('.dialog').text()).toContain('商品与规格')
  expect(wrapper.find('.dialog').text()).toContain('关联单据')
  expect(wrapper.find('.dialog .goods-detail__compact-grid--documents').text()).toContain('商品单号')
  expect(wrapper.find('.dialog .goods-detail__compact-grid--documents').text()).toContain('共同单号')
  expect(wrapper.find('.dialog .goods-detail__compact-grid--documents').text()).toContain('关联手机单号')
  const documentFields = wrapper.find('.dialog .goods-detail__compact-grid--documents').findAll('.goods-detail__compact-field')
  expect(documentFields.map(field => field.text())).toEqual([
    '商品单号AS001', '共同单号SO001', '备注整批公共备注', '关联手机单号PHONE001', 'SNSN001、SN002', '销售时间2026-11-13 10:00:00'
  ])
  expect(wrapper.find('.dialog').text()).toContain('商品单号')
  expect(wrapper.find('.dialog').text()).toContain('未退数量')
  expect(wrapper.find('.dialog').text()).toContain('配件型号')
  expect(wrapper.find('.dialog').text()).toContain('利润')
  expect(wrapper.find('.dialog').text()).toContain('¥15')
  expect(wrapper.find('.dialog').text()).toContain('抵扣积分')
  expect(wrapper.find('.dialog').text()).toContain('抵扣金额')
  expect(wrapper.find('.dialog .goods-detail__compact-grid--documents').exists()).toBe(true)
  expect(wrapper.find('.dialog .goods-detail__compact-grid--documents').text()).toContain('共同单号')
  expect(wrapper.find('.dialog').text()).toContain('SN001、SN002')
  expect(wrapper.find('.dialog').text()).toContain('原采购商')
  expect(wrapper.find('.dialog').text()).toContain('入库批次')
  expect(wrapper.find('.dialog').text()).toContain('IN001')
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

it('手机商品详情使用紧凑信息面板，保留销售和客户字段', async () => {
  isMobile.value = true
  vi.stubGlobal('innerWidth', 390)
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ data: { ...row(), serial_numbers: [], batches: [] } })
  wrapper.findComponent(ElTable).vm.$emit('row-dblclick', row()); await flushPromises()
  expect(wrapper.findAll('.dialog .goods-detail__compact-grid')).toHaveLength(4)
  expect(wrapper.find('.dialog .goods-detail__compact-grid--customer').text()).toContain('客户手机号')
  expect(wrapper.find('.dialog .goods-detail__compact-grid--customer').text()).toContain('13900000001')
  const productFields = wrapper.find('.dialog .goods-detail__compact-grid--product').findAll('.goods-detail__compact-field')
  expect(productFields.map(field => field.text())).toEqual([
    '商品名称原单充电器', '商品类型充电头', '品牌苹果', '配件型号MWVW3CH', '条形码690001', '颜色白色'
  ])
  expect(wrapper.find('.dialog .goods-detail__compact-grid').text()).toContain('销售门店')
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
  expect(wrapper.text()).not.toContain('成本')
  expect(wrapper.text()).not.toContain('销售门店')
  expect(mocks.stores).not.toHaveBeenCalled()
  expect(mocks.get.mock.calls[0][1].params.store_id).toBeUndefined()
})

it('运行中撤销商品字段清理详情并重读，迟到响应不能恢复已隐藏资料', async () => {
  const wrapper = await render()
  let finishOld!: (value: object) => void
  const old = new Promise<object>(resolve => { finishOld = resolve })
  mocks.get.mockReturnValueOnce(old)
  await button(wrapper, '详情').trigger('click'); await flushPromises()
  const oldSignal = mocks.get.mock.lastCall?.[1].signal
  mocks.get.mockImplementation(async (url: string) => url === '/query/goods'
    ? result([row({ customer_phone: null })])
    : { data: { ...row({ customer_phone: null }), serial_numbers: [], batches: [] } })
  hiddenFields.value.add('customer_info.customer_phone'); await flushPromises()
  expect(oldSignal.aborted).toBe(true)
  expect(wrapper.find('.dialog').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('13900000001')
  finishOld({ data: { ...row(), serial_numbers: [], batches: [] } }); await flushPromises()
  expect(wrapper.text()).not.toContain('13900000001')
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods/51', expect.objectContaining({ useCache: false }))
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


it('商品模式开单逐次核验查看及销售/赠送权限，成功回首页重读，取消不刷新', async () => {
  const wrapper = await render()
  wrapper.vm.openSale(); await flushPromises()
  expect(wrapper.find('.goods-checkout').exists()).toBe(false)
  goodsCreate.value = true; await flushPromises()
  wrapper.vm.openSale(); await flushPromises()
  expect(wrapper.find('.goods-checkout').exists()).toBe(true)
  const calls = mocks.get.mock.calls.length
  wrapper.findComponent(Checkout).vm.$emit('update:modelValue', false); await flushPromises()
  expect(mocks.get).toHaveBeenCalledTimes(calls)
  await button(wrapper, '第二页').trigger('click'); await flushPromises()
  goodsCreate.value = false; goodsGift.value = true; await flushPromises()
  wrapper.vm.openSale(); await flushPromises()
  expect(wrapper.find('.goods-checkout').exists()).toBe(true)
  await button(wrapper, '完成商品销售').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods', expect.objectContaining({ useCache: false, params: expect.objectContaining({ page: 1 }) }))
  expect(wrapper.find('.goods-checkout').exists()).toBe(false)
  for (const permission of [goodsGift, goodsView, queryView]) {
    goodsGift.value = goodsView.value = queryView.value = true; await flushPromises()
    wrapper.vm.openSale(); await flushPromises()
    expect(wrapper.find('.goods-checkout').exists()).toBe(true)
    permission.value = false; await flushPromises()
    expect(wrapper.find('.goods-checkout').exists()).toBe(false)
    wrapper.vm.openSale(); await flushPromises()
    expect(wrapper.find('.goods-checkout').exists()).toBe(false)
  }
})
