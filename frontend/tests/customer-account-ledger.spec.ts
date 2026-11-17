import { computed, defineComponent, h, inject, provide, reactive, ref, type PropType, type Ref, type SetupContext } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import CustomersView from '@/views/customers/CustomersView.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn(), handleApiError: vi.fn(), success: vi.fn(), error: vi.fn() }))
const permissions = reactive({ view: true, manage: true, hidden: [] as string[] })
const viewport = reactive({ mobile: false, tablet: true })
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('vue-router', () => ({ useRouter: () => ({}) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => permissions.view), canCreate: ref(false), canEdit: ref(false), canDelete: ref(false), canExport: ref(false),
  hasPermission: (action: string) => action === 'manage' && permissions.manage,
  requirePermission: vi.fn(), handleNoPermission: vi.fn()
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn().mockResolvedValue(undefined), isFieldVisible: (_module: string, field: string) => !permissions.hidden.includes(field) },
  shouldShowActionColumn: () => false
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => viewport.mobile), isTablet: computed(() => viewport.tablet) }) }))
vi.mock('@/composables', () => ({
  useLoadingState: () => ({ loading: ref(false) }), useDebounce: (fn: () => unknown) => ({ debouncedFn: fn })
}))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: ref(false), refresh: vi.fn() }) }))

type TestRow = Record<string, unknown>
const Table = defineComponent({
  props: { data: { type: Array as PropType<TestRow[]>, default: () => [] } },
  emits: ['row-dblclick'],
  setup(props, { slots }) {
    provide('rows', computed(() => props.data))
    return () => h('div', slots.default?.())
  }
})
const Column = {
  props: { prop: { type: String, default: '' } },
  setup(props: { prop: string }, { slots }: SetupContext) {
    const rows = inject<Ref<TestRow[]>>('rows', ref([]))
    return () => h('div', rows.value.map((row, $index) => slots.default?.({ row, $index }) ?? String(row[props.prop] ?? '')))
  }
}
const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Dialog = { props: ['modelValue', 'title'], emits: ['update:modelValue'],
  template: '<section v-if="modelValue" class="dialog" :data-title="title"><slot /><slot name="footer" /></section>' }
const Detail = { name: 'RecordDetailDialog', props: ['modelValue', 'record', 'fields', 'hasActions'], template: '<div />' }
const customers = [{ id: 101, name: '客户甲', points: 12, balance: 0 }, { id: 102, name: '客户乙', points: 24, balance: 0 }]
const ledgerRow = { id: 301, kind: 'points', delta: 12, source_type: 'phone_sale', note: '原手机销售积分',
  operator_name: '经办员工', created_at: '2026-11-15T01:02:03.000Z' }
const ledgerResponse = () => ({ success: true, data: { records: [{ ...ledgerRow }] } })
const wrappers: ReturnType<typeof shallowMount>[] = []
const render = async () => {
  const wrapper = shallowMount(CustomersView, { global: {
    plugins: [ElementPlus],
    components: { RecordDetailDialog: Detail },
    directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} },
    mocks: { $getNumberColumnWidth: () => 70, $getActionColumnWidth: () => 120 },
    stubs: { PermissionGate: Slot, PageHeader: Slot, ElTable: Table, ElTableColumn: Column, MobileDialog: Dialog,
      RecordDetailDialog: Detail, ElButton: { template: '<button><slot /></button>' }, UnifiedSearchPanel: true,
      IconRenderer: true, DataEmptyState: true }
  } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
type Wrapper = Awaited<ReturnType<typeof render>>
const open = async (wrapper: Wrapper, customerIndex = 0) => {
  const account = wrapper.findAll('.account-info')[customerIndex]
  const points = account.findAll('.table-info-line').find(item => item.text().includes('积分'))!
  await points.trigger('dblclick')
  await flushPromises()
}
const ledgerDialog = (wrapper: Wrapper) => wrapper.findAllComponents(Dialog).find(item => item.props('title') === '积分明细')!
const ledgerTable = (wrapper: Wrapper) => wrapper.findAllComponents(Table).find(item => item.classes().includes('admin-data-table'))!
const ledgerCalls = () => mocks.get.mock.calls.filter(([url]) => String(url).endsWith('/account-ledger'))

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(permissions, { view: true, manage: true, hidden: [] })
  Object.assign(viewport, { mobile: false, tablet: true })
  mocks.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/account-ledger')) return ledgerResponse()
    if (url === '/customers') return { success: true, data: { customers, pagination: { total: 2 } } }
    return { success: true, data: {} }
  })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('账户流水实时读取，平板双击进入公共只读详情，关闭父窗口同时移除详情', async () => {
  const wrapper = await render()
  await open(wrapper)
  expect(mocks.get).toHaveBeenCalledWith('/customers/101/account-ledger', expect.objectContaining({
    params: { kind: 'points' }, signal: expect.any(AbortSignal), useCache: false, showLoading: false
  }))
  expect(ledgerTable(wrapper).text()).toContain('手机销售')
  expect(ledgerTable(wrapper).text()).toContain('2026-11-15 09:02:03')
  const row = ledgerTable(wrapper).props('data')[0]
  ledgerTable(wrapper).vm.$emit('row-dblclick', row)
  await flushPromises()
  const detail = wrapper.findComponent(Detail)
  expect(detail.props('modelValue')).toBe(true)
  expect(detail.props('record')).toMatchObject({ id: 301, note: '原手机销售积分' })
  expect(detail.props('hasActions')).toBe(false)
  ledgerDialog(wrapper).vm.$emit('update:modelValue', false)
  await flushPromises()
  expect(wrapper.findComponent(Detail).exists()).toBe(false)
  expect(wrapper.find('.admin-data-table').exists()).toBe(false)
})

it('切换客户取消旧请求，旧响应不覆盖当前客户；关闭后晚返回也不恢复明细', async () => {
  let resolveOld!: (value: ReturnType<typeof ledgerResponse>) => void
  const wrapper = await render()
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await open(wrapper)
  const firstSignal = ledgerCalls()[0][1].signal as AbortSignal
  await open(wrapper, 1)
  expect(firstSignal.aborted).toBe(true)
  resolveOld({ success: true, data: { records: [{ ...ledgerRow, note: '不应显示的旧客户数据' }] } })
  await flushPromises()
  expect(ledgerTable(wrapper).text()).not.toContain('不应显示的旧客户数据')
  expect(ledgerTable(wrapper).text()).toContain('原手机销售积分')
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await open(wrapper)
  const pendingSignal = ledgerCalls().at(-1)![1].signal as AbortSignal
  ledgerDialog(wrapper).vm.$emit('update:modelValue', false)
  await flushPromises()
  expect(pendingSignal.aborted).toBe(true)
  resolveOld(ledgerResponse())
  await flushPromises()
  expect(wrapper.findComponent(Detail).exists()).toBe(false)
  expect(wrapper.find('.admin-data-table').exists()).toBe(false)
})

it('字段撤权关闭流水并取消请求，无管理权限仍可只读且不展示账户调整', async () => {
  const wrapper = await render()
  permissions.manage = false
  await open(wrapper)
  expect(ledgerDialog(wrapper).text()).not.toContain('账户调整')
  let resolveOld!: (value: ReturnType<typeof ledgerResponse>) => void
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  await open(wrapper)
  const signal = ledgerCalls().at(-1)![1].signal as AbortSignal
  permissions.hidden.push('customer.points')
  await flushPromises()
  expect(signal.aborted).toBe(true)
  resolveOld(ledgerResponse())
  await flushPromises()
  expect(wrapper.find('.admin-data-table').exists()).toBe(false)
  expect(wrapper.findComponent(Detail).exists()).toBe(false)
  expect(mocks.handleApiError).not.toHaveBeenCalled()
})
