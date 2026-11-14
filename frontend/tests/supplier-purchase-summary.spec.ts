import { computed, h, inject, provide, ref, type PropType, type Ref, type SetupContext } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SuppliersView from '@/views/suppliers/SuppliersView.vue'
import type { Supplier, SupplierDetail } from '@/types/system'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), success: vi.fn(), error: vi.fn(), handleApiError: vi.fn(),
  view: { value: true } as Ref<boolean>, mobile: false
}))
vi.mock('@/utils/unified-api', () => ({ default: mocks, unifiedApi: mocks }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => mocks.view.value), canCreate: ref(true), canEdit: ref(true), canDelete: ref(true), canExport: ref(true)
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  init: vi.fn().mockResolvedValue(undefined), isFieldVisible: () => true, isFieldEditable: () => true
}, shouldShowActionColumn: () => true }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7 }, permissions: ['suppliers:view'] }) }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => mocks.mobile) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: ref(false), refresh: vi.fn() }) }))
vi.mock('@/composables/useElementTableSortable', () => ({ useElementTableSortable: vi.fn() }))
vi.mock('@/composables/useImportExport', () => ({ useImportExport: () => ({ exportFile: vi.fn(), buildDateFilename: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({}) }))

const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Table = {
  props: { data: { type: Array as PropType<Supplier[]>, required: true } },
  setup(props: { data: Supplier[] }, { slots }: SetupContext) { provide('rows', computed(() => props.data)); return () => h('div', slots.default?.()) }
}
const Column = {
  setup(_props: unknown, { slots }: SetupContext) {
    const rows = inject<Ref<Supplier[]>>('rows')!
    return () => h('div', rows.value.map((row, $index) => slots.default?.({ row, $index })))
  }
}
const Dialog = { props: ['modelValue', 'title'], emits: ['update:modelValue', 'close'],
  template: '<section v-if="modelValue" class="dialog"><h3>{{ title }}</h3><button class="close" @click="$emit(\'update:modelValue\', false); $emit(\'close\')">关闭</button><slot /><slot name="footer" /></section>' }
const wrappers: ReturnType<typeof shallowMount>[] = []
const stats: SupplierDetail['stats'] = { accessories_count: 30, accessories_total_cost: 600, phones_count: 2, phones_total_cost: 1000 }
const detail = (id: number, values = stats): SupplierDetail => ({ id, name: `供应商${id}`, status: 1, stats: { ...values } })

async function render() {
  const wrapper = shallowMount(SuppliersView, { attachTo: document.body, global: {
    directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} },
    mocks: { $getNumberColumnWidth: () => 70, $getActionColumnWidth: () => 130 },
    stubs: { PermissionGate: Slot, PageHeader: Slot, UnifiedSearchPanel: Slot,
      ElTable: Table, ElTableColumn: Column, ElButton: { template: '<button><slot /></button>' },
      MobileDialog: Dialog, SectionLoading: { props: ['text'], template: '<div class="loading">{{ text }}</div>' },
      ElForm: Slot, ElFormItem: Slot, ElInput: true, ElSelect: true, ElOption: true, ElSwitch: true,
      ElInputNumber: true, Pagination: true, ImportExportActions: true,
      ElIcon: true, DataEmptyState: true, ElRadio: true, ElRadioGroup: true }
  } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const open = async (wrapper: ReturnType<typeof shallowMount>, index = 0) => {
  await wrapper.findAll('button').filter(button => button.text() === '查看')[index]!.trigger('click')
  await flushPromises()
}
const deferred = () => {
  let resolve!: (value: { success: boolean; data: SupplierDetail }) => void
  const promise = new Promise<{ success: boolean; data: SupplierDetail }>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.view = ref(true)
  mocks.mobile = false
  mocks.get.mockImplementation(async (url: string) => {
    if (url === '/suppliers/stats') return { success: true, data: {} }
    if (url === '/suppliers') return { success: true, data: [detail(8), detail(9)] }
    return { success: true, data: detail(Number(url.split('/').at(-1))) }
  })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('真实供应商页面展示原采购数量总额，与手机数量成本独立且按分合计', async () => {
  const wrapper = await render()
  await open(wrapper)
  const cards = wrapper.find('.dialog .stats-grid')
  expect(cards.text()).toContain('配件采购数量')
  expect(cards.text()).toContain('采购总额 ¥600')
  expect(cards.findAll('.stat-number').map(value => value.text())).toEqual(['30', '2', '32'])
  expect(cards.findAll('.stat-amount').map(value => value.text())).toEqual(['采购总额 ¥600', '¥1000', '¥1600'])
  expect(mocks.get).toHaveBeenLastCalledWith('/suppliers/8', expect.objectContaining({ useCache: false, showLoading: false, signal: expect.any(AbortSignal) }))
})

it('零值真实显示，隐藏或未知成本不当作零相加', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ success: true, data: detail(8, { ...stats, accessories_total_cost: 0, phones_total_cost: null }) })
  await open(wrapper)
  const cards = wrapper.find('.dialog .stats-grid')
  expect(cards.findAll('.stat-amount').map(value => value.text())).toEqual(['采购总额 ¥0'])
  expect(cards.findAll('.stat-number').map(value => value.text())).toEqual(['30', '2', '32'])
})

it('全部统计隐藏不渲染卡片，部分隐藏不产生完整合计', async () => {
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce({ success: true, data: detail(8, {
    accessories_count: null, accessories_total_cost: null, phones_count: null, phones_total_cost: null
  }) })
  await open(wrapper)
  expect(wrapper.find('.dialog .stats-grid').exists()).toBe(false)
  mocks.get.mockResolvedValueOnce({ success: true, data: detail(9, { ...stats, accessories_count: null, accessories_total_cost: null }) })
  await open(wrapper, 1)
  expect(wrapper.find('.dialog .stats-grid').text()).not.toContain('数量合计')
  expect(wrapper.findAll('.dialog .stat-item')).toHaveLength(1)
})

it('切换供应商废弃旧响应及旧Loading，始终展示最后选择的供应商', async () => {
  const wrapper = await render()
  const old = deferred(), current = deferred()
  mocks.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
  await open(wrapper)
  const oldConfig = mocks.get.mock.calls.at(-1)![1] as { signal: AbortSignal }
  await open(wrapper, 1)
  expect(oldConfig.signal.aborted).toBe(true)
  old.resolve({ success: true, data: detail(8) })
  await flushPromises()
  expect(wrapper.find('.dialog .loading').exists()).toBe(true)
  expect(wrapper.find('.dialog').text()).not.toContain('供应商8')
  current.resolve({ success: true, data: detail(9) })
  await flushPromises()
  expect(wrapper.find('.dialog .loading').exists()).toBe(false)
  expect(wrapper.find('.dialog').text()).toContain('供应商9')
})

it.each(['关闭', '撤权', '卸载'])('%s清理在途详情，迟到响应不恢复内容', async action => {
  const wrapper = await render()
  const pending = deferred()
  mocks.get.mockReturnValueOnce(pending.promise)
  await open(wrapper)
  const config = mocks.get.mock.calls.at(-1)![1] as { signal: AbortSignal }
  if (action === '关闭') await wrapper.find('.dialog .close').trigger('click')
  else if (action === '撤权') {
    mocks.view.value = false
    window.dispatchEvent(new Event('tf2025:permissions:updated'))
    await flushPromises()
  } else { wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1) }
  expect(config.signal.aborted).toBe(true)
  pending.resolve({ success: true, data: detail(8) })
  await flushPromises()
  expect(document.querySelector('.dialog')).toBeNull()
  expect(mocks.handleApiError).not.toHaveBeenCalled()
})

it('读取失败关闭Loading并提示，重试可正常显示', async () => {
  const wrapper = await render()
  mocks.get.mockRejectedValueOnce(new Error('读取失败'))
  await open(wrapper)
  expect(wrapper.find('.dialog').exists()).toBe(false)
  expect(mocks.handleApiError).toHaveBeenCalledOnce()
  await open(wrapper)
  expect(wrapper.find('.dialog .stats-grid').exists()).toBe(true)
})
