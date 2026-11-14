import { computed } from 'vue'
import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import HomeSections from '@/views/H5-admin/page/home-sections.vue'
import SalesGrid from '@/views/sales/page/SalesGridView.vue'
import DataCheck from '@/views/data-optimization/page/DataCheckTab.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import { vTableDoubleTap } from '@/directives/table-double-tap'
import type { Phone } from '@/types'
import type { HomeSectionProduct, SearchProduct } from '@/api/home-sections'

const mocks = vi.hoisted(() => ({
  edit: true, mobile: true, hidden: [] as string[], confirm: vi.fn(), notice: vi.fn(),
  sections: vi.fn(), products: vi.fn(), search: vi.fn(), add: vi.fn(), remove: vi.fn(), sort: vi.fn(),
  dataCheck: { getStatistics: vi.fn(), checkAll: vi.fn(), deleteData: vi.fn(), mergeDuplicates: vi.fn() }
}))
vi.mock('@/api/home-sections', () => ({
  getAllHomeSections: mocks.sections, getSectionProducts: mocks.products, searchProducts: mocks.search,
  addProductToSection: mocks.add, removeProductFromSection: mocks.remove, updateProductSort: mocks.sort,
  createHomeSection: vi.fn(), updateHomeSection: vi.fn(), deleteHomeSection: vi.fn(), clearSectionProducts: vi.fn()
}))
vi.mock('@/api/data-optimization', () => ({ dataCheckApi: mocks.dataCheck }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => mocks.mobile) }) }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: computed({ get: () => false, set: () => {} }) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => true), canEdit: computed(() => mocks.edit), canDelete: computed(() => mocks.edit),
  canCreate: computed(() => mocks.edit), handleNoPermission: mocks.notice
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  init: async () => {}, isFieldVisible: (_module: string, field: string) => !mocks.hidden.includes(field)
}, shouldShowActionColumn: (_field: boolean, actions: boolean[]) => actions.some(Boolean) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({
  success: mocks.notice, error: mocks.notice, warning: mocks.notice, info: mocks.notice, confirm: mocks.confirm
}) }))
vi.mock('@/utils/message-box', () => ({ confirmAction: mocks.confirm }))

const wrappers: VueWrapper[] = []
const slot = { template: '<div><slot /><slot name="primary" /></div>' }
const dialog = { props: ['modelValue', 'title'], template: '<section v-if="modelValue" :data-title="title"><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></section>' }
const button = { props: { disabled: Boolean }, template: '<button :disabled="disabled"><slot /></button>' }
const draggable = { name: 'draggable', props: ['modelValue', 'disabled'], template: '<div><slot v-for="element in modelValue" name="item" :element="element" /></div>' }
const globals = () => ({ plugins: [ElementPlus], components: { RecordDetailDialog }, directives: { 'table-double-tap': vTableDoubleTap, 'tf-loading': {}, permission: {} },
  provide: { registerHeaderActions: () => {}, clearHeaderActions: () => {} },
  stubs: { RecordDetailDialog: false, MobileDialog: dialog, ElButton: button, PermissionGate: slot,
    UnifiedSearchPanel: slot, ElForm: slot, ElFormItem: slot, ElSelect: slot, ElOptionGroup: slot,
    Draggable: draggable, draggable, PageHeader: true, IconRenderer: true, Pagination: true,
    SectionLoading: true, TableLoadingRow: true, DataEmptyState: true, ElAutocomplete: true },
  mocks: { $getNumberColumnWidth: () => 70 }
})
const findButton = (wrapper: VueWrapper, label: string) => {
  const target = wrapper.findAll('button').find(node => node.text() === label)
  if (!target) throw new Error(`缺少按钮 ${label}`)
  return target
}
const product: HomeSectionProduct = { id: 7, template_id: 1, brand_id: 1, brand_name: '演示品牌', model_id: 1,
  model_name: '演示型号', color_id: 1, color_name: '黑色', sort_order: 0, min_price: 0, sale_price: 10, is_new: 1, product_type: 'new' }
const available: SearchProduct = { ...product, template_id: 2, price: 12, display_text: '候选商品' }
beforeEach(() => {
  vi.clearAllMocks(); mocks.edit = true; mocks.mobile = true; mocks.hidden = []
  mocks.sections.mockResolvedValue({ data: [{ id: 5, section_name: '区域', section_key: 'test', product_limit: 10, is_enabled: true }] })
  mocks.products.mockResolvedValue({ data: [{ ...product }] }); mocks.search.mockResolvedValue({ data: [{ ...available }] })
  mocks.confirm.mockResolvedValue(true); mocks.add.mockResolvedValue({ success: true }); mocks.remove.mockResolvedValue({ success: true })
  mocks.dataCheck.getStatistics.mockResolvedValue({ data: { brands: 2 } })
  mocks.dataCheck.checkAll.mockResolvedValue({ data: { details: { brands: { total: 2, duplicate_groups: 1,
    duplicates: [{ key: '演示品牌', primary: { id: 1, name: '演示品牌' }, duplicates: [{ id: 2, name: '演示品牌' }], count: 2 }] } } } })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

const home = async () => {
  const wrapper = shallowMount(HomeSections, { global: globals(), attachTo: document.body }); wrappers.push(wrapper)
  await flushPromises()
  await wrapper.find('.section-card').trigger('dblclick'); await flushPromises()
  await findButton(wrapper, '管理商品').trigger('click'); await flushPromises()
  return wrapper
}

it('推荐商品手机单击不提交、禁拖动；双击后从底部添加并先关闭详情', async () => {
  const wrapper = await home()
  expect(wrapper.find('.section-card button').exists()).toBe(false)
  expect(wrapper.findComponent({ name: 'draggable' }).props('disabled')).toBe(true)
  const candidate = wrapper.find('[data-available-product]')
  await candidate.trigger('click'); expect(mocks.add).not.toHaveBeenCalled()
  await candidate.trigger('dblclick'); await flushPromises()
  mocks.add.mockImplementation(async () => {
    expect(wrapper.find('[data-title="可选商品详情"]').exists()).toBe(false)
    return { success: true }
  })
  await findButton(wrapper, '添加商品').trigger('click'); await flushPromises()
  expect(mocks.add).toHaveBeenCalledExactlyOnceWith(5, { template_id: 2, phone_id: undefined, sort_order: 1 })
  expect(mocks.sort).not.toHaveBeenCalled()
})

it('推荐商品手机行内无移除；底部移除保留危险确认及记录 ID，零价不回退为原价', async () => {
  const wrapper = await home()
  const record = wrapper.find('[data-section-product]')
  expect(record.find('button').exists()).toBe(false)
  await record.trigger('dblclick'); await flushPromises()
  expect(wrapper.find('[data-title="推荐商品详情"]').text()).toContain('价格0')
  await findButton(wrapper, '移除商品').trigger('click'); await flushPromises()
  expect(mocks.confirm).toHaveBeenCalledOnce()
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(5, 7)
  expect(wrapper.find('[data-title="推荐商品详情"]').exists()).toBe(false)
})

it('销售图文手机动作只在底部，状态禁用及字段权限保持，编辑只触发原事件', async () => {
  const phone: Phone = { id: 6, status: 'sold', is_new: true, model: '演示型号', brand: '演示品牌', color: '黑色', memory: '128G', imei: '012345678901234', purchase_cost: 12 }
  const wrapper = shallowMount(SalesGrid, { props: { phones: [phone], loading: false, hasActiveFilters: false,
    canViewField: field => field !== 'imei', canViewPrice: false, canSell: true, canEdit: true, canDelete: true,
    getPhoneImageSrc: () => '', formatDate: () => '-' }, global: globals() }); wrappers.push(wrapper)
  expect(wrapper.find('.device-card button').exists()).toBe(false)
  await wrapper.find('.device-card').trigger('dblclick'); await flushPromises()
  expect(wrapper.find('[data-title="设备详情"]').text()).not.toContain(phone.imei)
  expect(wrapper.find('[data-title="设备详情"]').text()).not.toContain('入库价格')
  expect(findButton(wrapper, '出库').attributes('disabled')).toBeDefined()
  await findButton(wrapper, '出库').trigger('click'); expect(wrapper.emitted('sale')).toBeUndefined()
  await findButton(wrapper, '编辑').trigger('click'); await flushPromises()
  expect(wrapper.emitted('edit')).toEqual([[phone]])
  expect(wrapper.find('[data-title="设备详情"]').exists()).toBe(false)
})

it('重复数据分组手机行内无业务按钮；主记录不能单独删除，重复记录操作保留上下文', async () => {
  const wrapper = shallowMount(DataCheck, { global: globals() }); wrappers.push(wrapper); await flushPromises()
  await findButton(wrapper, '综合检查').trigger('click'); await flushPromises()
  expect(wrapper.find('.duplicates-list button').exists()).toBe(false)
  await wrapper.findAll('.duplicate-item')[0].trigger('dblclick'); await flushPromises()
  expect(wrapper.findAll('button').some(node => node.text() === '删除记录')).toBe(false)
  wrapper.findAllComponents(RecordDetailDialog).find(node => node.props('modelValue'))!.vm.$emit('update:modelValue', false)
  await flushPromises()
  await wrapper.findAll('.duplicate-item')[1].trigger('dblclick'); await flushPromises()
  expect(wrapper.find('[data-title="重复记录详情"]').text()).toContain('重复记录')
  await findButton(wrapper, '编辑').trigger('click'); await flushPromises()
  expect(wrapper.find('[data-title="重复记录详情"]').exists()).toBe(false)
  expect(wrapper.find('[data-title="编辑品牌"]').exists()).toBe(true)
  expect(mocks.dataCheck.deleteData).not.toHaveBeenCalled()
  expect(mocks.dataCheck.mergeDuplicates).not.toHaveBeenCalled()
})
