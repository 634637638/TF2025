import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '@/components/AccessoryBatchStock.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import type { AccessoryBatchStock } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/accessory-inventory', () => ({ getAccessoryBatchStock: mocks.get }))
const access = reactive({ view: true, mobile: false, hidden: new Set<string>() })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => access.view) }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !access.hidden.has(field) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => access.mobile) }) }))
const Dialog = { props: ['modelValue'], template: '<div v-if="modelValue" class="record-dialog"><slot /><slot name="footer" /></div>' }
const Pagination = { props: ['current', 'pageSize', 'total'], emits: ['change'], template: '<div class="pagination" />' }
const Empty = { props: ['title', 'description', 'actionText'], emits: ['action'], template: '<div>{{ title }}{{ description }}<button v-if="actionText" @click="$emit(\'action\')">{{ actionText }}</button></div>' }
const batch = (extra: Partial<AccessoryBatchStock> = {}): AccessoryBatchStock => ({ row_key: 'event:91', accessory_id: 31,
  store_id: 2, store_name: '当前二店', brand_name: '品牌甲', product_model: 'MODEL-A', batch_no: 'ORIGINAL-11',
  supplier_name: '原供货商', inventory_time: '2026-11-14 09:00:00', inventory_operator_name: '原入库员',
  purchase_cost: '12.50', usage_type: 'sale', serial_tracking: 0, quantity: '4', source_status: 'purchase', ...extra })
const fixture = (page = 1, total = 21, accessoryId = 31) => ({ success: true, data: {
  data: Array.from({ length: Math.max(0, Math.min(20, total - (page - 1) * 20)) }, (_, index) => batch({ row_key: `event:${page}:${index}`, accessory_id: accessoryId })),
  pagination: { page, page_size: 20, total }
} })
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(Panel, { props: { accessoryId: 31 }, global: { plugins: [ElementPlus],
    components: { RecordDetailDialog }, stubs: { MobileDialog: Dialog, Pagination, DataEmptyState: Empty },
    mocks: { $getNumberColumnWidth: () => 68 }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
beforeEach(() => {
  access.view = true; access.mobile = false; access.hidden.clear()
  mocks.get.mockImplementation(async (id: number, page: number) => fixture(page, 21, id))
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

it('显示真实原采购资料及当前店铺余额，分页沿用公共数字页码', async () => {
  const wrapper = await render()
  for (const text of ['当前二店', '品牌甲', 'MODEL-A', 'ORIGINAL-11', '原供货商', '¥12.5', '收费', '普通数量', '原入库员']) expect(wrapper.text()).toContain(text)
  expect(mocks.get).toHaveBeenCalledWith(31, 1, 20, expect.any(AbortSignal))
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(31, 2, 20, expect.any(AbortSignal))
  expect(wrapper.find('.table-number-badge').text()).toBe('21')
})

it('未接续的历史库存保留未知来源、成本与追踪方式，不显示零成本或猜测供应商', async () => {
  const result = fixture(1, 1)
  result.data.data = [batch({ source_status: 'untracked', batch_no: null, purchase_cost: null,
    supplier_name: null, inventory_time: null, inventory_operator_name: null, usage_type: 'unclassified', serial_tracking: null })]
  mocks.get.mockResolvedValue(result)
  const wrapper = await render()
  expect(wrapper.text()).toContain('未接续流水，来源待核对')
  expect(wrapper.text()).toContain('历史用途待核对')
  expect(wrapper.text()).not.toContain('¥0')
  expect(wrapper.text()).not.toContain('原供货商')
})

it('读取失败和坏响应显示错误可重试，不把失败当成无库存', async () => {
  const wrapper = await render()
  mocks.get.mockRejectedValueOnce(new Error('库存冲突'))
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(wrapper.text()).toContain('批次库存读取失败')
  expect(wrapper.text()).not.toContain('当前二店')
  expect(wrapper.text()).not.toContain('暂无剩余批次库存')
  await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('当前二店')
  for (const malformed of [{ success: true }, { success: true, data: { data: [batch({ quantity: 'bad' })], pagination: { page: 2, page_size: 20, total: 21 } } },
    { success: true, data: { data: [batch({ purchase_cost: '-1' })], pagination: { page: 2, page_size: 20, total: 21 } } }]) {
    mocks.get.mockResolvedValueOnce(malformed)
    await wrapper.findAll('button').find(button => button.text() === '刷新批次库存')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('批次库存读取失败')
  }
})

it('切商品和撤回查看权限取消旧请求，迟到结果不覆盖当前商品', async () => {
  const wrapper = await render()
  let finish: ((value: ReturnType<typeof fixture>) => void) | undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await wrapper.find('button').trigger('click'); await flushPromises()
  const oldSignal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  await wrapper.setProps({ accessoryId: 32 }); await flushPromises()
  expect(oldSignal.aborted).toBe(true)
  expect(mocks.get).toHaveBeenLastCalledWith(32, 1, 20, expect.any(AbortSignal))
  const old = fixture(1, 1); old.data.data[0].supplier_name = '旧供应商不应出现'
  finish?.(old); await flushPromises()
  expect(wrapper.text()).not.toContain('旧供应商不应出现')
  mocks.get.mockImplementationOnce(() => new Promise(() => {}))
  await wrapper.find('button').trigger('click'); await flushPromises()
  const revokedSignal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  access.view = false; await flushPromises()
  expect(revokedSignal.aborted).toBe(true)
  expect(wrapper.find('section').exists()).toBe(false)
  access.view = true; await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(32, 1, 20, expect.any(AbortSignal))
})

it('门店或数量隐藏不读取；其他字段隐藏时列表与手机详情同步隐藏', async () => {
  access.hidden.add('stock_info.total_quantity')
  const wrapper = await render()
  expect(mocks.get).not.toHaveBeenCalled()
  access.hidden.clear(); access.hidden.add('stock_info.distribution'); await flushPromises()
  expect(mocks.get).not.toHaveBeenCalled()
  access.hidden.clear(); access.mobile = true
  for (const field of ['price_info.purchase_cost', 'basic_info.supplier_name', 'basic_info.brand_name', 'basic_info.batch_no']) access.hidden.add(field)
  await flushPromises()
  for (const text of ['¥12.5', '原供货商', '品牌甲', 'ORIGINAL-11']) expect(wrapper.text()).not.toContain(text)
  await wrapper.find('.el-table__body tbody tr').trigger('dblclick'); await flushPromises()
  expect(wrapper.find('.record-dialog').exists()).toBe(true)
  expect(wrapper.find('.record-dialog').text()).toContain('当前二店')
  expect(wrapper.find('.record-dialog').text()).not.toContain('原供货商')
  access.hidden.add('stock_info.distribution'); await flushPromises()
  expect(wrapper.find('.record-dialog').exists()).toBe(false)
})

it('库存变化导致末页消失时重读有效页；真正零库存显示空态', async () => {
  const wrapper = await render()
  mocks.get.mockImplementation(async (_id: number, page: number) => fixture(page, 1))
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(31, 1, 20, expect.any(AbortSignal))
  expect(wrapper.findComponent(Pagination).props('current')).toBe(1)
  mocks.get.mockResolvedValue(fixture(1, 0))
  await wrapper.find('button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('暂无剩余批次库存')
})

it('卸载取消在途批次请求，关闭后不保留库存数据', async () => {
  mocks.get.mockImplementation(() => new Promise(() => {}))
  const wrapper = await render()
  const signal: AbortSignal = mocks.get.mock.calls[0][3]
  wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
  expect(signal.aborted).toBe(true)
})
