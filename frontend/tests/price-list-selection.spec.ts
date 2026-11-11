import { computed, h, inject, provide, reactive, type PropType, type Ref, type SetupContext } from 'vue'
import ElementPlus, { ElCheckbox } from 'element-plus'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PriceListView from '@/views/price-list/PriceListView.vue'
import type { PriceListRow } from '@/types/price-list'

const mocks = vi.hoisted(() => ({
  list: vi.fn(), batch: vi.fn(), get: vi.fn(), confirm: vi.fn(),
  success: vi.fn(), warning: vi.fn(), error: vi.fn(), noPermission: vi.fn(),
  doubleTap: vi.fn(), mobile: false
}))
const permissions = reactive({ view: true, edit: true })
vi.mock('@/api/price-list', async importOriginal => ({
  ...await importOriginal<typeof import('@/api/price-list')>(),
  getPriceList: mocks.list,
  batchUpdatePriceSettings: mocks.batch,
  getPriceHistoryTrends: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getAllSyncConfigs: vi.fn().mockResolvedValue({ success: true, data: [] })
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks, default: mocks }))
vi.mock('@/utils/message-box', () => ({ confirmAction: mocks.confirm }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => permissions.view), canEdit: computed(() => permissions.edit),
  canCreate: computed(() => false), canDelete: computed(() => false),
  canExport: computed(() => false), canImport: computed(() => false), canSync: computed(() => false),
  handleNoPermission: mocks.noPermission
}) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ permissions: [], isAuthenticated: true }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/utils/device-detection', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/device-detection')>(),
  isCurrentMobileViewport: () => mocks.mobile
}))
vi.mock('@/composables/useMobileRowDoubleTap', () => ({ useMobileRowDoubleTap: () => ({ isDoubleTap: mocks.doubleTap, resetDoubleTap: vi.fn() }) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { isFieldVisible: () => true }, shouldShowActionColumn: () => true
}))
vi.mock('@/services/reference-options', () => ({
  getCachedBrands: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedColors: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCachedMemories: vi.fn().mockResolvedValue({ success: true, data: [] })
}))

const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Table = {
  props: { data: { type: Array as PropType<PriceListRow[]>, required: true } },
  emits: ['row-click'],
  setup(props: { data: PriceListRow[] }, { emit, slots }: SetupContext) {
    provide('rows', computed(() => props.data))
    provide('click-row', (row: PriceListRow) => emit('row-click', row))
    return () => h('div', slots.default?.())
  }
}
const Column = {
  props: { label: { type: String, default: '选择' } },
  setup(props: { label: string }, { slots }: SetupContext) {
    const rows = inject<Ref<PriceListRow[]>>('rows')!
    const clickRow = inject<(row: PriceListRow) => void>('click-row')!
    return () => h('section', { 'data-column': props.label }, [
      h('header', slots.header?.()),
      ...rows.value.map((row, $index) => h('div', { 'data-id': row.id, onClick: () => clickRow(row) }, slots.default?.({ row, $index })))
    ])
  }
}
const Pagination = { emits: ['update:current', 'update:pageSize'], template: '<div />' }
const Dialog = {
  props: ['modelValue', 'title'], emits: ['update:modelValue'],
  template: '<div v-if="modelValue" role="dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>'
}
const Search = { emits: ['search', 'reset'], template: '<div><slot /><slot name="primary" /><slot name="secondary" /><slot name="expanded" /></div>' }
const Button = { props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot /></button>' }
const wrappers: VueWrapper[] = []
const row = (id: number): PriceListRow => ({ id, price_list_id: id, brand_name: '品牌', model_number: `型号${id}`, color_name: '白色', memory: '256GB', stock_quantity: 0, status: 1, is_collect: 1, show_price: 1 })
const response = (ids: number[]) => ({ success: true, data: { list: ids.map(row), total: 4 } })

async function render() {
  const wrapper = shallowMount(PriceListView, { global: {
    plugins: [ElementPlus],
    components: { ElCheckbox },
    stubs: {
      PermissionGate: Slot, PageHeader: Slot, ElTable: Table, ElTableColumn: Column, ElCheckbox: false,
      ElButton: Button, Pagination, MobileDialog: Dialog, UnifiedSearchPanel: Search,
      ElForm: Slot, ElFormItem: Slot, DataEmptyState: true
    },
    directives: { permission: {}, tfLoading: {} },
    mocks: { $getNumberColumnWidth: () => 60, $getActionColumnWidth: () => 160 }
  } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
async function page(wrapper: VueWrapper, value: number) {
  wrapper.findComponent(Pagination).vm.$emit('update:current', value)
  await flushPromises()
}
function button(wrapper: VueWrapper, text: string) {
  const target = wrapper.findAll('button').find(item => item.text() === text)
  if (!target) throw new Error(`未找到按钮：${text}`)
  return target
}
function selection(wrapper: VueWrapper) { return wrapper.find('[data-column="选择"]') }

beforeEach(() => {
  permissions.view = true
  permissions.edit = true
  mocks.mobile = false
  mocks.list.mockReset().mockImplementation(async (params: { page: number }) => response(params.page === 1 ? [1, 2] : [3, 4]))
  mocks.batch.mockReset().mockResolvedValue({ success: true, message: '设置成功' })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.get.mockResolvedValue({ success: true, data: [] })
  mocks.doubleTap.mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe.each([false, true])('报价跨页选择，手机端=%s', mobile => {
  it('翻页、跨页勾选、返回原页均保留选择，其他页同数量不能误判全选', async () => {
    mocks.mobile = mobile
    const wrapper = await render()
    await selection(wrapper).find('header input').setValue(true)
    expect(wrapper.text()).toContain('已选择 2 条')
    await page(wrapper, 2)
    expect((selection(wrapper).find('header input').element as HTMLInputElement).checked).toBe(false)
    await selection(wrapper).find('[data-id="3"] input').setValue(true)
    expect(wrapper.text()).toContain('已选择 3 条')
    await page(wrapper, 1)
    expect((selection(wrapper).find('[data-id="1"] input').element as HTMLInputElement).checked).toBe(true)
    expect((selection(wrapper).find('header input').element as HTMLInputElement).checked).toBe(true)
    await selection(wrapper).find('[data-id="1"] input').setValue(false)
    expect(selection(wrapper).find('header .el-checkbox__input').classes()).toContain('is-indeterminate')
    await selection(wrapper).find('header input').setValue(true)
    expect(wrapper.text()).toContain('已选择 3 条')
    expect(mocks.doubleTap).not.toHaveBeenCalled()
  })

  it('取消本页全选仅移除本页，清空选择同时清除其他页', async () => {
    mocks.mobile = mobile
    const wrapper = await render()
    await selection(wrapper).find('header input').setValue(true)
    await page(wrapper, 2)
    await selection(wrapper).find('header input').setValue(true)
    expect(wrapper.text()).toContain('已选择 4 条')
    await selection(wrapper).find('header input').setValue(false)
    expect(wrapper.text()).toContain('已选择 2 条')
    await button(wrapper, '清空选择').trigger('click')
    await page(wrapper, 1)
    expect(selection(wrapper).findAll('input').every(input => !(input.element as HTMLInputElement).checked)).toBe(true)
    expect(button(wrapper, '批量设置').attributes('disabled')).toBeDefined()
  })
})

it('批量保存包含跨页全部ID，失败保留选择，成功清空', async () => {
  const wrapper = await render()
  await selection(wrapper).find('[data-id="1"] input').setValue(true)
  await page(wrapper, 2)
  await selection(wrapper).find('[data-id="4"] input').setValue(true)
  await button(wrapper, '批量设置').trigger('click')
  await flushPromises()
  expect(wrapper.find('[role="dialog"]').text()).toContain('批量设置')
  const fields = wrapper.findComponent({ name: 'ElCheckboxGroup' })
  fields.vm.$emit('update:modelValue', ['status'])
  await flushPromises()
  mocks.batch.mockRejectedValueOnce(new Error('保存失败'))
  await button(wrapper, '保存').trigger('click')
  await flushPromises()
  expect(mocks.batch).toHaveBeenLastCalledWith({ price_list_ids: [1, 4], changes: { status: 1 } })
  expect(wrapper.text()).toContain('已选择 2 条')
  expect(mocks.error).toHaveBeenCalledWith('保存失败')
  await button(wrapper, '保存').trigger('click')
  await flushPromises()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(button(wrapper, '批量设置').attributes('disabled')).toBeDefined()
})

it('筛选与重置保留选择，修改每页数量回到第一页', async () => {
  const wrapper = await render()
  await selection(wrapper).find('[data-id="1"] input').setValue(true)
  await page(wrapper, 2)
  const beforeSearch = mocks.list.mock.calls.length
  wrapper.findComponent(Search).vm.$emit('search')
  await flushPromises()
  expect(mocks.list.mock.calls.length).toBe(beforeSearch + 1)
  expect(wrapper.text()).toContain('已选择 1 条')
  wrapper.findComponent(Search).vm.$emit('reset')
  await flushPromises()
  expect((selection(wrapper).find('[data-id="1"] input').element as HTMLInputElement).checked).toBe(true)
  await page(wrapper, 2)
  wrapper.findComponent(Pagination).vm.$emit('update:pageSize', 50)
  await flushPromises()
  expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 50 }), expect.anything())
})

it('快速翻页只应用最新结果，旧响应不能覆盖数据或提前关闭Loading', async () => {
  const wrapper = await render()
  let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined
  let resolveNew: ((value: ReturnType<typeof response>) => void) | undefined
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await page(wrapper, 2)
  const oldSignal = mocks.list.mock.calls.at(-1)?.[1].signal as AbortSignal
  mocks.list.mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve }))
  await page(wrapper, 1)
  expect(oldSignal.aborted).toBe(true)
  resolveOld?.(response([3, 4]))
  await flushPromises()
  expect(selection(wrapper).find('[data-id="3"]').exists()).toBe(false)
  expect(selection(wrapper).find('input').attributes('disabled')).toBeDefined()
  resolveNew?.(response([1, 2]))
  await flushPromises()
  expect(selection(wrapper).find('input').attributes('disabled')).toBeUndefined()
})

it('撤销编辑权限清除选择，查看权限撤销后不接受在途响应', async () => {
  const wrapper = await render()
  await selection(wrapper).find('[data-id="1"] input').setValue(true)
  permissions.edit = false
  await flushPromises()
  expect(wrapper.find('.selection-count').exists()).toBe(false)
  expect(selection(wrapper).findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
  let resolve: ((value: ReturnType<typeof response>) => void) | undefined
  mocks.list.mockImplementationOnce(() => new Promise(callback => { resolve = callback }))
  await page(wrapper, 2)
  permissions.view = false
  await flushPromises()
  resolve?.(response([3, 4]))
  await flushPromises()
  expect(selection(wrapper).find('[data-id="3"]').exists()).toBe(false)
})
