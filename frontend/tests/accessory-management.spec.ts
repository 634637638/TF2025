import { computed, defineComponent, h, inject, provide, ref, type PropType, type Ref, type SetupContext } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AccessoriesView from '@/views/accessories/AccessoriesView.vue'
import type { AccessoryRecord } from '@/types/accessory'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), delete: vi.fn(), confirm: vi.fn(), success: vi.fn(), error: vi.fn(),
  view: true, create: true, edit: true, remove: true, transfer: false, hidden: new Set<string>()
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => mocks.view), canCreate: computed(() => mocks.create),
  canEdit: computed(() => mocks.edit), canDelete: computed(() => mocks.remove), handleNoPermission: vi.fn(), hasPermission: (action: string) => action === 'transfer' && mocks.transfer, requirePermission: (action: string) => action === 'transfer' && mocks.transfer
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: async () => {}, isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) },
  shouldShowActionColumn: () => true
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => false) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: ref(false), refresh: async (callback: () => Promise<void>) => callback() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Table = defineComponent({
  props: { data: { type: Array as PropType<AccessoryRecord[]>, required: true } },
  setup(props, { slots }) {
    provide('rows', computed(() => props.data))
    return () => h('div', { class: 'test-table' }, slots.default?.())
  }
})
const Column = {
  props: { label: { type: String, default: '' } },
  setup(props: { label: string }, { slots }: SetupContext) {
    const rows = inject<Ref<AccessoryRecord[]>>('rows')!
    return () => h('div', { 'data-column': props.label }, rows.value.map((row, $index) => slots.default?.({ row, $index })))
  }
}
const TemplateEditor = {
  name: 'AccessoryStockInModal',
  props: { modelValue: Boolean, accessory: { type: Object as PropType<AccessoryRecord>, default: undefined }, archiveOnly: Boolean, stockInOnly: Boolean },
  emits: ['success'],
  template: '<div class="template-editor"><button @click="$emit(\'success\')">模拟保存成功</button></div>'
}
const Pagination = { name: 'AccessoryPaginationStub', props: { total: { type: Number, default: 0 } }, emits: ['change'], template: '<div />' }
const Search = { emits: ['search', 'reset'], template: '<div><slot name="primary" /><button class="search" @click="$emit(\'search\')">查询</button></div>' }
const wrappers: ReturnType<typeof shallowMount>[] = []
const rows: AccessoryRecord[] = [
  { id: 1, name: '未入库模板', status: 1, sale_price: 20, total_stock: 0 },
  { id: 2, name: '停用模板', status: 0, sale_price: 30, total_stock: 0 }
]
const response = (data = rows, total = data.length) => ({ success: true, data: { data, pagination: { total } } })
const render = async () => {
  const wrapper = shallowMount(AccessoriesView, {
    global: {
      plugins: [ElementPlus], mocks: { $getActionColumnWidth: () => 200, $getNumberColumnWidth: () => 64 },
      directives: { 'tf-loading': {}, permission: {} },
      stubs: { PermissionGate: Slot, PageHeader: Slot, ElTable: Table, ElTableColumn: Column,
        ElButton: { template: '<button><slot /></button>' }, ElInput: false, ElSelect: false, ElOption: false,
        AccessoryTransferModal: { name: 'AccessoryTransferModal', props: ['accessory', 'modelValue'], emits: ['success'], template: '<accessory-transfer-modal-stub />' }, AccessoryStockInModal: TemplateEditor, AccessoryDetailsModal: true, DataEmptyState: true, UnifiedSearchPanel: Search, Pagination }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!

beforeEach(() => {
  mocks.view = mocks.create = mocks.edit = mocks.remove = true
  mocks.transfer = false
  mocks.hidden.clear()
  mocks.get.mockResolvedValue(response())
  mocks.delete.mockResolvedValue({ success: true })
  mocks.confirm.mockResolvedValue(true)
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

describe('配件库存与商品模板管理', () => {
  it.each(['price_info.purchase_cost', 'price_info.sale_price', 'price_info.profit'])('隐藏%s时不展示可反推价格的利润列', async field => {
    mocks.hidden.add(field)
    const wrapper = await render()
    expect(wrapper.find('[data-column="毛利"]').exists()).toBe(false)
    expect(wrapper.find('[data-column="总库存"]').exists()).toBe(true)
  })

  it('隐藏当前库存时同步隐藏派生剩余列，正常角色仍可查看两列', async () => {
    mocks.hidden.add('stock_info.total_stock')
    const hidden = await render()
    expect(hidden.find('[data-column="总库存"]').exists()).toBe(false)
    expect(hidden.find('[data-column="剩余"]').exists()).toBe(false)
    mocks.hidden.clear()
    const visible = await render()
    expect(visible.find('[data-column="毛利"]').exists()).toBe(true)
    expect(visible.find('[data-column="总库存"]').exists()).toBe(true)
    expect(visible.find('[data-column="剩余"]').exists()).toBe(true)
  })

  it('库存徽章按模板预警值而非固定20判断，零阈值有效，隐藏阈值或库存状态不泄露低库存标记', async () => {
    mocks.get.mockResolvedValue(response([
      { id: 1, name: '正常商品', total_stock: 2, min_stock: 1 },
      { id: 2, name: '预警商品', total_stock: 25, min_stock: 30 },
      { id: 3, name: '零阈值商品', total_stock: 1, min_stock: 0 }
    ]))
    const wrapper = await render()
    const badges = wrapper.find('[data-column="总库存"]').findAll('.status-badge')
    expect(badges.map(badge => badge.classes())).toEqual([
      expect.arrayContaining(['status-in-stock']), expect.arrayContaining(['status-low-stock']), expect.arrayContaining(['status-in-stock'])
    ])
    mocks.hidden.add('stock_info.min_stock')
    const hiddenThreshold = await render()
    expect(hiddenThreshold.findAll('.status-low-stock')).toHaveLength(0)
    mocks.hidden.add('stock_info.stock_status')
    const hiddenStatus = await render()
    expect(hiddenStatus.findAll('.status-in-stock, .status-low-stock, .status-out-of-stock')).toHaveLength(0)
  })

  it('模板页默认查询全部状态，展示未入库和停用模板，新建/编辑复用模板表单', async () => {
    const wrapper = await render()
    expect(mocks.get.mock.calls[0][1].params).toMatchObject({ mode: 'inventory', page: 1, page_size: 16, status: 1 })
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    expect(mocks.get.mock.lastCall?.[1].params).toMatchObject({ mode: 'templates', status: 'all' })
    expect(wrapper.text()).toContain('未入库模板')
    expect(wrapper.text()).toContain('停用模板')
    expect(wrapper.find('[data-column="适配型号"]').text()).toBe('通用通用')
    expect(wrapper.find('[data-column="进价"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('新增商品模板')
    await button(wrapper, '商品模版').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('archiveOnly')).toBe(true)
    await button(wrapper, '入库').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('stockInOnly')).toBe(true)
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 1 })
    await wrapper.findAll('[data-column="操作"] button').find(item => item.text() === '编辑')!.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 1 })
    expect(wrapper.findComponent(TemplateEditor).props('stockInOnly')).toBe(false)
    const calls = mocks.get.mock.calls.length
    wrapper.findComponent(TemplateEditor).vm.$emit('success')
    await flushPromises()
    expect(mocks.get.mock.calls.length).toBe(calls + 1)
  })

  it('剩余库存可点击打开对应商品详情，设置入口使用原路径', async () => {
    const wrapper = await render()
    const remaining = wrapper.find('[data-column="剩余"] button')
    expect(remaining.exists()).toBe(true)
    await remaining.trigger('click')
    await flushPromises()
    expect(wrapper.find('accessory-details-modal-stub').exists()).toBe(true)
    expect(wrapper.find('accessory-details-modal-stub').attributes('accessory')).toBeDefined()
    expect(wrapper.text()).toContain('设置')
    expect(wrapper.text()).not.toContain('商品资料')
  })

  it('删除明确保留历史，删除后重新查询；停用模板可编辑恢复', async () => {
    const wrapper = await render()
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    const deletes = wrapper.findAll('[data-column="操作"] button').filter(item => item.text() === '删除')
    expect(deletes).toHaveLength(1)
    const calls = mocks.get.mock.calls.length
    await deletes[0].trigger('click')
    await flushPromises()
    expect(mocks.confirm.mock.calls[0][0]).toContain('保留库存和历史单据')
    expect(mocks.delete).toHaveBeenCalledWith('/accessories/1')
    expect(mocks.get.mock.calls.length).toBe(calls + 1)
    const edits = wrapper.findAll('[data-column="操作"] button').filter(item => item.text() === '编辑')
    await edits[1].trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 2, status: 0 })
  })

  it('品牌库存行编辑和删除关联原模板，入库保留实际商品身份', async () => {
    mocks.get.mockResolvedValue(response([{ id: 56, template_id: 55, brand_id: 3, name: '通用充电宝', status: 1 }]))
    const wrapper = await render()
    await button(wrapper, '入库').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 56, template_id: 55, brand_id: 3 })
    mocks.get.mockResolvedValueOnce({ data: { id: 55, template_id: null, product_model: 'MWVW3CH', name: '通用充电宝' } })
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/55', expect.objectContaining({ useCache: false }))
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 55, template_id: null, product_model: 'MWVW3CH' })
    await button(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('/accessories/55')
  })

  it('按服务端总数翻页，搜索回到第一页且禁用缓存', async () => {
    mocks.get.mockResolvedValue(response([rows[0]], 101))
    const wrapper = await render()
    expect(wrapper.findComponent(Pagination).props('total')).toBe(101)
    wrapper.findComponent(Pagination).vm.$emit('change', 2, 16)
    await flushPromises()
    expect(mocks.get.mock.lastCall?.[1].params.page).toBe(2)
    await wrapper.get('input[placeholder="搜索配件名称、商品类型、品牌或型号..."]').setValue('钢化膜')
    await wrapper.get('button.search').trigger('click')
    await flushPromises()
    expect(mocks.get.mock.lastCall?.[1]).toMatchObject({ params: { page: 1, search: '钢化膜' }, useCache: false })
  })

  it('快速切换页签时，旧响应不覆盖当前数据', async () => {
    const wrapper = await render()
    let finish: ((value: ReturnType<typeof response>) => void) | undefined
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await button(wrapper, '商品模板').trigger('click')
    mocks.get.mockResolvedValue(response([{ id: 3, name: '当前库存商品', status: 1 }]))
    await button(wrapper, '库存查询').trigger('click')
    await flushPromises()
    finish?.(response([{ id: 4, name: '过期模板数据', status: 1 }]))
    await flushPromises()
    expect(wrapper.text()).toContain('当前库存商品')
    expect(wrapper.text()).not.toContain('过期模板数据')
  })

  it('只读角色没有新增、编辑、删除按钮；隐藏状态不发送状态筛选', async () => {
    mocks.create = mocks.edit = mocks.remove = false
    mocks.hidden.add('status_info.status')
    const wrapper = await render()
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    expect(button(wrapper, '商品模版')).toBeUndefined()
    expect(button(wrapper, '编辑')).toBeUndefined()
    expect(button(wrapper, '删除')).toBeUndefined()
    expect(mocks.get.mock.lastCall?.[1].params.status).toBeUndefined()
    expect(wrapper.find('input[placeholder="模板状态"]').exists()).toBe(false)
  })
  it('划拨使用独立权限和实际库存商品，成功后刷新；模板页无划拨', async () => {
    mocks.transfer = true
    mocks.get.mockResolvedValue(response([{ id: 56, template_id: 55, brand_id: 3, name: '品牌库存', status: 1, total_stock: 50 }]))
    const wrapper = await render()
    await button(wrapper, '划拨').trigger('click')
    await flushPromises()
    const modal = wrapper.find('accessory-transfer-modal-stub')
    expect(modal.exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AccessoryTransferModal' }).props('accessory')).toMatchObject({ id: 56 })
    const calls = mocks.get.mock.calls.length
    wrapper.findComponent({ name: 'AccessoryTransferModal' }).vm.$emit('success')
    await flushPromises()
    expect(mocks.get.mock.calls.length).toBe(calls + 1)
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    expect(button(wrapper, '划拨')).toBeUndefined()
  })

})
