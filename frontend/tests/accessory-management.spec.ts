import { computed, defineComponent, h, inject, provide, ref, type PropType, type Ref, type SetupContext } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import ElementPlus, { ElOption, ElSelect, ElTooltip } from 'element-plus'
import AccessoriesView from '@/views/accessories/AccessoriesView.vue'
import AccessoryDetailsModal from '@/components/AccessoryDetailsModal.vue'
import type { AccessoryRecord } from '@/types/accessory'
import type { AccessoryEntryOptions } from '@/services/reference-options'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), options: vi.fn(), delete: vi.fn(), confirm: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(),
  view: true, create: true, stockIn: true, edit: true, remove: true, transfer: false, touch: false, hidden: new Set<string>(),
  route: { path: '/accessories', fullPath: '/accessories', query: {} as Record<string, string>, hash: '' }
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/services/reference-options', () => ({ getAccessoryEntryOptions: mocks.options }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => mocks.view), canCreate: computed(() => mocks.create),
  canEdit: computed(() => mocks.edit), canDelete: computed(() => mocks.remove), handleNoPermission: vi.fn(), hasPermission: (action: string) => action === 'stock-in' ? mocks.stockIn : action === 'transfer' && mocks.transfer, requirePermission: (action: string) => action === 'stock-in' ? mocks.stockIn : action === 'transfer' && mocks.transfer
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: async () => {}, isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) },
  shouldShowActionColumn: () => true
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => false), isTouchDevice: computed(() => mocks.touch) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: ref(false),
  refreshData: async (callback: () => Promise<unknown>, options: { successMessage: string; errorMessage: string }) => {
    try { await callback(); mocks.success(options.successMessage) } catch { mocks.error(options.errorMessage) }
  }
}) }))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: vi.fn().mockImplementation(async (target: { query: Record<string, string> }) => { mocks.route.query = target.query }) }) }))

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
  props: { modelValue: Boolean, accessory: { type: Object as PropType<AccessoryRecord>, default: undefined }, archiveOnly: Boolean, stockInOnly: Boolean, stockEditOnly: Boolean, profileEditOnly: Boolean },
  emits: ['success'],
  template: '<div class="template-editor"><button @click="$emit(\'success\')">模拟保存成功</button></div>'
}
const Details = { name: 'AccessoryDetailsModal', props: ['accessory'], emits: ['success', 'close'], template: '<accessory-details-modal-stub />' }
const Pagination = { name: 'AccessoryPaginationStub', props: { total: { type: Number, default: 0 } }, emits: ['change'], template: '<div />' }
const Search = { emits: ['search', 'reset'], template: '<div><slot name="primary" /><slot /><button class="search" @click="$emit(\'search\')">查询</button><button class="reset" @click="$emit(\'reset\')">重置</button></div>' }
const wrappers: ReturnType<typeof shallowMount>[] = []
const rows: AccessoryRecord[] = [
  { id: 1, name: '未入库模板', status: 1, sale_price: 20, total_stock: 0 },
  { id: 2, name: '停用模板', status: 0, sale_price: 30, total_stock: 0 }
]
const response = (data = rows, total = data.length) => ({ success: true, data: { data, pagination: { total } } })
const referenceOptions = (): AccessoryEntryOptions => ({
  categories: [{ id: 12, name: '充电头', sort_order: 2 }, { id: 11, name: '数据线', sort_order: 1 }],
  brands: [{ id: 21, name: '沃品', sort_order: 1 }], colors: [{ id: 3, name: '白色', sort_order: 1 }],
  models: [], model_brands: [], suppliers: [], stores: [], units: []
})
const render = async () => {
  const wrapper = mount(AccessoriesView, {
    global: {
      plugins: [ElementPlus], mocks: { $getActionColumnWidth: () => 200, $getNumberColumnWidth: () => 64 },
      directives: { 'tf-loading': {}, permission: {}, 'table-double-tap': {} },
      stubs: { PermissionGate: Slot, PageHeader: Slot, ElTable: Table, ElTableColumn: Column,
        ElButton: { template: '<button><slot /></button>' }, ElInput: false, ElSelect: false, ElOption: false,
        AccessoryTransferModal: { name: 'AccessoryTransferModal', props: ['accessory', 'modelValue'], emits: ['success'], template: '<accessory-transfer-modal-stub />' }, AccessoryStockInModal: TemplateEditor, AccessoryDetailsModal: Details, DataEmptyState: true, UnifiedSearchPanel: Search, Pagination }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!

beforeEach(() => {
  mocks.route.query = {}
  mocks.view = mocks.create = mocks.stockIn = mocks.edit = mocks.remove = true
  mocks.transfer = false
  mocks.touch = false
  mocks.hidden.clear()
  mocks.get.mockResolvedValue(response())
  mocks.options.mockResolvedValue({ success: true, data: referenceOptions() })
  mocks.delete.mockResolvedValue({ success: true })
  mocks.confirm.mockResolvedValue(true)
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

describe('配件库存与商品模板管理', () => {
  it.each([false, true])('库存与模板适配型号展示品牌摘要，完整型号保留在悬停或触摸提示（触摸：%s）', async touch => {
    mocks.touch = touch
    mocks.get.mockResolvedValue(response([
      { id: 1, name: '通用模板' },
      { id: 2, name: '跨品牌模板', compatible_brand_names: '苹果 / 华为', compatible_model_names: '苹果 iPhone 17, 苹果 iPhone 16, 华为 Mate 80' },
      { id: 3, name: '旧单型号', model_brand_name: '苹果', model_name: 'iPhone 15' }
    ]))
    const wrapper = await render()
    for (const title of ['商品库存', '商品模板']) {
      await button(wrapper, title).trigger('click'); await flushPromises()
      const column = wrapper.get('[data-column="适配型号"]')
      expect(column.text()).toBe('通用苹果 / 华为苹果')
      const tips = column.findAllComponents(ElTooltip)
      expect(tips.map(tip => tip.props('content'))).toEqual(['苹果 iPhone 17, 苹果 iPhone 16, 华为 Mate 80', '苹果 iPhone 15'])
      expect(tips.every(tip => JSON.stringify(tip.props('trigger')) === JSON.stringify(touch ? 'click' : ['hover', 'focus']))).toBe(true)
      expect(column.findAll('[tabindex="0"]')).toHaveLength(2)
    }
  })

  it('隐藏适配型号时品牌摘要与完整型号提示一起隐藏', async () => {
    mocks.hidden.add('basic_info.model_name')
    mocks.get.mockResolvedValue(response([{ id: 1, compatible_brand_names: '苹果 / 华为', compatible_model_names: '苹果 iPhone 17, 华为 Mate 80' }]))
    const wrapper = await render()
    for (const title of ['商品库存', '商品模板']) {
      await button(wrapper, title).trigger('click'); await flushPromises()
      expect(wrapper.find('[data-column="适配型号"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('苹果 / 华为')
      expect(wrapper.findAllComponents(ElTooltip).some(tip => String(tip.props('content')).includes('iPhone 17'))).toBe(false)
    }
  })

  it('首页商品入库快捷参数打开原入库弹窗且被消费，无入库权限时不打开', async () => {
    mocks.route.query = { openStockIn: 'true' }
    const wrapper = await render()
    expect(wrapper.findComponent(TemplateEditor).exists()).toBe(true)
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toBeUndefined()
    expect(mocks.route.query.openStockIn).toBeUndefined()
    wrapper.unmount()
    mocks.stockIn = false
    mocks.route.query = { openStockIn: 'true' }
    const denied = await render()
    expect(denied.findComponent(TemplateEditor).exists()).toBe(false)
    expect(mocks.route.query.openStockIn).toBeUndefined()
  })
  const filterSelect = (wrapper: Awaited<ReturnType<typeof render>>, label: string) => {
    const result = wrapper.findAllComponents(ElSelect).find(item => item.props('placeholder') === label)
    if (!result) throw new Error(`未找到筛选字段：${label}`)
    return result
  }

  it.each(['stock', 'templates'])('%s支持五项组合筛选，选择/清除及重置均回第一页，刷新保留条件', async mode => {
    mocks.get.mockResolvedValue(response(rows, 120))
    const wrapper = await render()
    if (mode === 'templates') { await button(wrapper, '商品模板').trigger('click'); await flushPromises() }
    expect(wrapper.find('input[aria-label="商品名称"]').exists()).toBe(true)
    expect(wrapper.find('input[aria-label="适配型号"]').exists()).toBe(true)
    expect(filterSelect(wrapper, '商品类型').findAllComponents(ElOption).map(item => item.props('label'))).toEqual(['数据线', '充电头'])
    wrapper.findComponent(Pagination).vm.$emit('change', 3, 20); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params.page).toBe(3)
    await wrapper.get('input[aria-label="商品名称"]').setValue('  充电头  ')
    await wrapper.get('input[aria-label="适配型号"]').setValue('  iphone-17  ')
    for (const [label, value] of [['商品类型', '充电头'], ['品牌', 21], ['颜色', 3]] as const) {
      filterSelect(wrapper, label).vm.$emit('update:modelValue', value)
      filterSelect(wrapper, label).vm.$emit('change', value)
      await flushPromises()
      expect(mocks.get.mock.calls.at(-1)?.[1].params.page).toBe(1)
    }
    const expected = { mode: mode === 'stock' ? 'inventory' : 'templates', page: 1,
      search: '充电头', category: '充电头', brand_id: 21, model_name: 'iphone-17', color_id: 3 }
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject(expected)
    await button(wrapper, '刷新').trigger('click'); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject(expected)
    filterSelect(wrapper, '颜色').vm.$emit('update:modelValue', undefined)
    filterSelect(wrapper, '颜色').vm.$emit('change', undefined); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params.color_id).toBeUndefined()
    await button(wrapper, '重置').trigger('click'); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ page: 1, search: undefined,
      category: undefined, brand_id: undefined, model_name: undefined, color_id: undefined })
  })

  it('筛选参考资料保留全部选项并使用公共排序，不把首批列表当作候选范围', async () => {
    const options = referenceOptions()
    options.brands = Array.from({ length: 121 }, (_, index) => ({ id: index + 1, name: `品牌${index + 1}`, sort_order: 121 - index }))
    mocks.options.mockResolvedValue({ success: true, data: options })
    const wrapper = await render()
    const brands = filterSelect(wrapper, '品牌').findAllComponents(ElOption)
    expect(brands).toHaveLength(121)
    expect(brands[0].props('label')).toBe('品牌121')
    expect(brands.at(-1)?.props('label')).toBe('品牌1')
  })

  it.each(['stock', 'templates'])('%s状态独立位于检索区颜色后，可查看停用及全部状态，重置恢复默认', async mode => {
    const wrapper = await render()
    if (mode === 'templates') { await button(wrapper, '商品模板').trigger('click'); await flushPromises() }
    expect(wrapper.findComponent(Search).find('input[aria-label="状态"]').exists()).toBe(true)
    expect(wrapper.findAll('.filter-item').map(item => item.attributes('data-field'))).toEqual(['category', 'brand_id', 'model_name', 'color_id', 'status'])
    const status = filterSelect(wrapper, '状态')
    expect(status.props('modelValue')).toBe(mode === 'stock' ? 1 : 'all')
    for (const value of [0, 'all', 1] as const) {
      status.vm.$emit('update:modelValue', value); status.vm.$emit('change', value)
      await flushPromises()
      expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ page: 1, status: value })
    }
    await button(wrapper, '重置').trigger('click'); await flushPromises()
    expect(status.props('modelValue')).toBe(mode === 'stock' ? 1 : 'all')
  })

  it('隐藏字段不展示独立筛选，不回传条件；无查看权限不读取选项', async () => {
    for (const field of ['basic_info.name', 'basic_info.category', 'basic_info.brand_name', 'basic_info.model_name', 'basic_info.color_name', 'status_info.status']) mocks.hidden.add(field)
    const wrapper = await render()
    for (const label of ['商品名称', '商品类型', '品牌', '适配型号', '颜色', '状态']) expect(wrapper.find(`input[aria-label="${label}"]`).exists()).toBe(false)
    await button(wrapper, '查询').trigger('click'); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ category: undefined, brand_id: undefined, model_name: undefined, color_id: undefined })
    mocks.view = false; mocks.options.mockClear(); mocks.get.mockClear()
    await render()
    expect(mocks.options).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('筛选选项失败可显式重试，切换TAB清空此前条件', async () => {
    mocks.options.mockRejectedValueOnce(new Error('离线'))
    const wrapper = await render()
    expect(wrapper.findComponent({ name: 'ElAlert' }).props('title')).toBe('离线')
    await button(wrapper, '重新加载筛选项').trigger('click'); await flushPromises()
    expect(filterSelect(wrapper, '品牌').findAllComponents(ElOption)).toHaveLength(1)
    await wrapper.get('input[aria-label="适配型号"]').setValue('iPhone17')
    filterSelect(wrapper, '品牌').vm.$emit('update:modelValue', 21)
    await button(wrapper, '商品模板').trigger('click'); await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ mode: 'templates', page: 1, brand_id: undefined, model_name: undefined })
  })

  it.each(['stock', 'templates'])('%s保存成功后刷新503保留原列表并明确已保存，不误导重复入库', async mode => {
    const wrapper = await render()
    if (mode === 'templates') {
      await button(wrapper, '商品模板').trigger('click')
      await flushPromises()
    }
    await button(wrapper, '入库').trigger('click')
    await flushPromises()
    const before = wrapper.get('.test-table').text()
    const reads = mocks.get.mock.calls.length
    mocks.get.mockRejectedValueOnce({ response: { status: 503, data: { code: 'DB_CONNECTION_ERROR' } } })
    wrapper.findComponent(TemplateEditor).vm.$emit('success')
    await flushPromises()
    expect(wrapper.get('.test-table').text()).toBe(before)
    expect(mocks.get).toHaveBeenCalledTimes(reads + 1)
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories', expect.objectContaining({ showError: false, useCache: false }))
    expect(mocks.warning).toHaveBeenCalledExactlyOnceWith('保存已成功，列表刷新失败，请点击刷新；请勿重复提交或入库。')
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('商品刷新失败只提示失败且保留列表，恢复后只提示一次成功', async () => {
    const wrapper = await render()
    const before = wrapper.get('.test-table').text()
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } })
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(wrapper.get('.test-table').text()).toBe(before)
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith('刷新失败，请重试')
    expect(mocks.success).not.toHaveBeenCalled()
    mocks.error.mockClear()
    await button(wrapper, '刷新').trigger('click')
    await flushPromises()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('数据刷新成功')
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('模板删除成功后刷新失败仍保留已有行，明确删除已成功且只发一次删除', async () => {
    const wrapper = await render()
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    const before = wrapper.get('.test-table').text()
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } })
    await button(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.test-table').text()).toBe(before)
    expect(mocks.warning).toHaveBeenCalledExactlyOnceWith('商品模板已删除（停用），列表刷新失败，请点击刷新；请勿重复操作。')
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('盘点成功刷新主列表和当前详情，保持详情打开并禁用缓存', async () => {
    const wrapper = await render()
    await wrapper.find('[data-column="剩余"] button').trigger('click')
    await flushPromises()
    const detail = wrapper.findComponent(Details)
    mocks.get.mockResolvedValueOnce(response([{ ...rows[0], total_stock: 6 }]))
    detail.vm.$emit('success')
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories', expect.objectContaining({ useCache: false }))
    expect(wrapper.findComponent(Details).props('accessory')).toMatchObject({ id: 1, total_stock: 6 })
    expect(wrapper.find('[data-column="总库存"]').text()).toContain('6')
  })

  it('详情收到盘点成功后刷新店铺库存并向主列表通知', async () => {
    const wrapper = shallowMount(AccessoryDetailsModal, { props: { accessory: rows[0] },
      global: { stubs: { MobileDialog: { template: '<div><slot /><slot name="footer" /></div>' }, DataEmptyState: true } } })
    wrappers.push(wrapper)
    const locations = wrapper.findComponent({ name: 'AccessoryStockLocations' })
    expect(locations.props('refreshKey')).toBe(0)
    wrapper.findComponent({ name: 'AccessoryBatchStock' }).vm.$emit('success')
    await flushPromises()
    expect(locations.props('refreshKey')).toBe(1)
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('多颜色模板列表显示颜色与对应条码，详情选择颜色后才查询该色库存', async () => {
    const template: AccessoryRecord = { id: 100, name: '多色充电器', status: 1, color_template_id: 100,
      color_variants: [{ accessory_id: 101, color_id: 3, color_name: '白色', barcode: 'WHITE-1' },
        { accessory_id: 102, color_id: 4, color_name: '黑色', barcode: 'BLACK-1' }] }
    mocks.get.mockResolvedValue(response([template]))
    const page = await render()
    await page.findAll('button').find(button => button.text() === '商品模板')!.trigger('click'); await flushPromises()
    expect(page.get('[data-column="颜色"]').text()).toContain('白色、黑色')
    expect(page.get('[data-column="条形码"]').text()).toContain('黑色：BLACK-1')
    const detail = shallowMount(AccessoryDetailsModal, { props: { accessory: template },
      global: { plugins: [ElementPlus], stubs: { MobileDialog: { template: '<div><slot /></div>' }, DataEmptyState: true } } })
    wrappers.push(detail)
    expect(detail.findComponent({ name: 'AccessoryBatchStock' }).exists()).toBe(false)
    expect(detail.text()).not.toContain('当前库存：')
    detail.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 102)
    await flushPromises()
    expect(detail.findComponent({ name: 'AccessoryBatchStock' }).props('accessoryId')).toBe(102)
    expect(detail.findComponent({ name: 'AccessoryStockLocations' }).props('accessoryId')).toBe(102)
    expect(detail.findComponent({ name: 'AccessorySerialPanel' }).props('accessoryId')).toBe(102)
  })

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
    mocks.get.mockResolvedValueOnce({ success: true, data: { ...rows[0], category_id: 12, unit_id: 2 } })
    await wrapper.findAll('[data-column="操作"] button').find(item => item.text() === '入库')!.trigger('click')
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
    expect(wrapper.findComponent(Details).props('accessory')).toMatchObject({ id: 1 })
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
    expect(mocks.delete).toHaveBeenCalledWith('/accessories/1', { showError: false })
    expect(mocks.get.mock.calls.length).toBe(calls + 1)
    const edits = wrapper.findAll('[data-column="操作"] button').filter(item => item.text() === '编辑')
    await edits[1].trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 2, status: 0 })
  })

  it('停用的零库存品牌商品仍可请求删除并由后端复核关联历史', async () => {
    mocks.get.mockResolvedValue(response([{ id: 56, template_id: 55, name: '空品牌行', status: 0, total_stock: 0, total_out: 0 }]))
    const wrapper = await render()
    await button(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('/accessories/56/unused-variant', { showError: false })
  })

  it('商品库存编辑实际入库资料，模板编辑仍定位根模板；入库保留实际商品身份', async () => {
    const variant = { id: 56, template_id: 55, brand_id: 3, name: '通用充电宝', status: 1 }
    mocks.get.mockImplementation(async (url: string) => url.startsWith('/accessories/stock-in/templates/')
      ? { success: true, data: variant } : response([variant]))
    const wrapper = await render()
    await wrapper.findAll('[data-column="操作"] button').find(item => item.text() === '入库')!.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 56, template_id: 55, brand_id: 3 })
    const calls = mocks.get.mock.calls.length
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(calls)
    expect(wrapper.findComponent(TemplateEditor).props('stockEditOnly')).toBe(true)
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 56, template_id: 55 })
    await button(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('/accessories/56/unused-variant', { showError: false })
    await button(wrapper, '商品模板').trigger('click'); await flushPromises()
    mocks.get.mockResolvedValueOnce({ data: { id: 55, template_id: null, product_model: 'MWVW3CH', name: '通用充电宝' } })
    await button(wrapper, '编辑').trigger('click'); await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/55', expect.objectContaining({ useCache: false }))
    expect(wrapper.findComponent(TemplateEditor).props('stockEditOnly')).toBe(false)
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 55, template_id: null })
  })

  it('库存商品可分别打开原入库更正和历史档案编辑，档案编辑保留品牌编辑模式', async () => {
    mocks.get.mockResolvedValue(response([{ id: 56, template_id: 55, brand_id: 3, brand_name: '沃品', name: '充电头', status: 1 }]))
    const wrapper = await render()
    await button(wrapper, '编辑档案').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('profileEditOnly')).toBe(true)
    expect(wrapper.findComponent(TemplateEditor).props('stockEditOnly')).toBe(false)
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('profileEditOnly')).toBe(false)
    expect(wrapper.findComponent(TemplateEditor).props('stockEditOnly')).toBe(true)
  })

  it('库存档案保存后模板读取新资料，模板保存后库存立即读取新资料且两端均禁用缓存', async () => {
    let name = '原名称'
    mocks.get.mockImplementation(async (url: string, options?: { params?: { mode?: string } }) => url === '/accessories'
      ? response([{ id: options?.params?.mode === 'templates' ? 55 : 56,
        template_id: options?.params?.mode === 'templates' ? null : 55, name, status: 1 }])
      : { success: true, data: { id: 55, name, status: 1 } })
    const wrapper = await render()
    await button(wrapper, '编辑档案').trigger('click')
    name = '库存更正名称'
    wrapper.findComponent(TemplateEditor).vm.$emit('success')
    await flushPromises()
    expect(wrapper.get('[data-column="商品名称"]').text()).toContain(name)
    await button(wrapper, '商品模板').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-column="商品名称"]').text()).toContain(name)
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(TemplateEditor).props('accessory')).toMatchObject({ id: 55, name })
    name = '模板更正名称'
    wrapper.findComponent(TemplateEditor).vm.$emit('success')
    await flushPromises()
    expect(wrapper.get('[data-column="商品名称"]').text()).toContain(name)
    await button(wrapper, '商品库存').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-column="商品名称"]').text()).toContain(name)
    for (const [url, options] of mocks.get.mock.calls) if (url === '/accessories') expect(options.useCache).toBe(false)
  })

  it('按服务端总数翻页，搜索回到第一页且禁用缓存', async () => {
    mocks.get.mockResolvedValue(response([rows[0]], 101))
    const wrapper = await render()
    expect(wrapper.findComponent(Pagination).props('total')).toBe(101)
    wrapper.findComponent(Pagination).vm.$emit('change', 2, 16)
    await flushPromises()
    expect(mocks.get.mock.lastCall?.[1].params.page).toBe(2)
    await wrapper.get('input[aria-label="商品名称"]').setValue('钢化膜')
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
    await button(wrapper, '商品库存').trigger('click')
    await flushPromises()
    finish?.(response([{ id: 4, name: '过期模板数据', status: 1 }]))
    await flushPromises()
    expect(wrapper.text()).toContain('当前库存商品')
    expect(wrapper.text()).not.toContain('过期模板数据')
  })

  it('只读角色没有新增、编辑、删除按钮；隐藏状态不发送状态筛选', async () => {
    mocks.create = mocks.stockIn = mocks.edit = mocks.remove = false
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
