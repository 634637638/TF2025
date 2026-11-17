import { computed, defineComponent, h, inject, provide, reactive, ref, type PropType, type SetupContext } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InventoryTable from '@/views/inventory/page/InventoryTable.vue'
import InventoryDetailModal from '@/components/InventoryDetailModal.vue'
import type { InventoryItem } from '@/types'

const inventoryMocks = vi.hoisted(() => ({
  edit: true, create: true, version: 0, hidden: new Set<string>(), readonly: new Set<string>(),
  get: vi.fn(), put: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn()
}))
const access = reactive(inventoryMocks)
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  init: async () => {}, get permissions() { return computed(() => access.version) },
  isFieldVisible: (_module: string, field: string) => !access.hidden.has(field),
  isFieldEditable: (_module: string, field: string) => !access.readonly.has(field) && !access.hidden.has(field)
}, shouldShowActionColumn: (field: boolean, actions: boolean[]) => field || actions.some(Boolean) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {} }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7 }, userPermissions: ['inventory:view', 'inventory:edit'], hasPermission: () => true }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => true), canEdit: computed(() => access.edit), canCreate: computed(() => access.create),
  canSell: computed(() => false), canDelete: computed(() => false), canExport: computed(() => false), handleNoPermission: vi.fn()
}) }))
vi.mock('@/composables/mobile', () => ({ useMobileDetection: () => ({ isMobile: false, deviceState: { screenWidth: 1440 } }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ ...inventoryMocks, confirm: vi.fn() }) }))
vi.mock('@/composables/useImportExport', () => ({ useImportExport: () => ({ exportFile: vi.fn(), buildDateFilename: vi.fn() }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: ref(false), refresh: vi.fn() }) }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: inventoryMocks.get, put: inventoryMocks.put } }))
vi.mock('@/views/inventory/useInventoryData', () => ({ useInventoryData: () => ({
  debounceLoadInventory: vi.fn(), loadInventory: vi.fn(), loadInventoryData: async () => {}, tableLoading: ref(false)
}) }))
vi.mock('@/views/inventory/useInventoryBaseOptions', () => ({ useInventoryBaseOptions: () => ({
  fetchBasicData: async () => {}, handleBrandChange: vi.fn(), searchOperatorsRemote: vi.fn()
}) }))
const row: InventoryItem = { id: 12, model: '测试设备', status: 'in_stock' }
const TableStub = defineComponent({
  props: { data: { type: Array as PropType<InventoryItem[]>, required: true } },
  setup(props, { slots }) {
    provide('inventoryRows', props.data)
    return () => h('div', slots.default?.())
  }
})
const ColumnStub = {
  setup(_: unknown, { slots }: SetupContext) {
    const rows = inject<InventoryItem[]>('inventoryRows', [])
    return () => h('div', rows.map(row => slots.default?.({ row })))
  }
}
const globals = {
  directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} },
  stubs: {
    ElTable: TableStub, ElTableColumn: ColumnStub,
    ElButton: { template: '<button><slot /></button>' },
    MobileDialog: { template: '<div><slot /><slot name="footer" /></div>' }
  }
}

describe('库存商城入口', () => {
  it.each([false, true])('电脑端按编辑权限展示商城并传递当前行，canEdit=%s', async canEdit => {
    const wrapper = shallowMount(InventoryTable, {
      props: {
        canEdit, canDelete: false, canSell: false, columns: [{ key: 'mall', label: '商城' }],
        enableRowDoubleTap: true, inventory: [row], loading: false, pagination: { page: 1, size: 20, total: 1 },
        formatDate: () => '', formatNumber: String, getColumnClass: () => '',
        getColumnMinWidth: () => 100, getColumnWidth: () => undefined,
        getConditionClass: () => '', getConditionText: () => '', getSaleStatusClass: () => '', getSaleStatusLabel: () => ''
      },
      global: globals
    })
    const configure = wrapper.find('button')
    expect(configure.exists()).toBe(canEdit)
    if (canEdit) {
      await configure.trigger('click')
      expect(wrapper.emitted('open-config')).toEqual([[row]])
      expect(wrapper.emitted('view')).toBeUndefined()
    }
    wrapper.findComponent(TableStub).vm.$emit('row-dblclick', row)
    expect(wrapper.emitted('view')).toEqual([[row]])
    wrapper.unmount()
  })

  it.each([false, true])('设备详情按授权提供同一商城入口，canConfigure=%s', async canConfigure => {
    const wrapper = shallowMount(InventoryDetailModal, {
      props: { modelValue: true, item: row, canConfigure }, global: globals
    })
    const configure = wrapper.findAll('button').find(button => button.text().includes('商城'))
    expect(Boolean(configure)).toBe(canConfigure)
    if (configure) {
      await configure.trigger('click')
      expect(wrapper.emitted('open-config')).toEqual([[]])
    }
    wrapper.unmount()
  })
})


describe('库存编辑字段权限标杆', () => {
  beforeEach(() => {
    access.edit = true; access.create = true; access.hidden.clear(); access.readonly.clear()
    inventoryMocks.get.mockReset(); inventoryMocks.put.mockReset(); inventoryMocks.warning.mockReset()
    inventoryMocks.get.mockResolvedValue({ success: true, data: {} })
    inventoryMocks.put.mockResolvedValue({ success: true, data: { id: 12 } })
  })
  const fullRow: InventoryItem = { id: 12, brand: '测试品牌', brand_id: 1, model: '测试型号', model_id: 2,
    color: '黑色', color_id: 3, memory: '256G', memory_id: 4, serial_number: 'TESTSERIAL', imei: '123456789012345',
    purchase_cost: 100, is_new: 1, store_id: 5, supplier_id: 6, inventory_time: '2026-11-17', status: 'in_stock', remarks: '原备注' }
  const open = async () => {
    const { default: View } = await import('@/views/inventory/InventoryView.vue')
    const wrapper = shallowMount(View, { global: {
      directives: globals.directives,
      stubs: { PermissionGate: { template: '<div><slot /></div>' } }
    } })
    await flushPromises()
    inventoryMocks.get.mockResolvedValueOnce({ success: true, data: fullRow })
    wrapper.findComponent(InventoryTable).vm.$emit('edit', fullRow); await flushPromises()
    return wrapper
  }
  it('有新增和编辑动作仍不能修改只读字段，隐藏字段及销售默认值不进入库存载荷', async () => {
    access.readonly.add('price_info.purchase_cost'); access.hidden.add('basic.imei')
    const wrapper = await open()
    try {
      const dialog = wrapper.findComponent({ name: 'InventoryEditDialog' })
      expect(dialog.props('canEditField')('purchase_cost')).toBe(false)
      expect(dialog.props('canViewField')('purchase_cost')).toBe(true)
      expect(dialog.props('canEditField')('imei')).toBe(false)
      // 即使表单内存被篡改，提交仍按最新字段权限筛除。
      Object.assign(dialog.props('editForm'), { purchase_cost: 0, imei: 'TAMPERED', remarks: '新备注' })
      dialog.vm.$emit('submit'); await flushPromises()
      expect(inventoryMocks.put).toHaveBeenCalledTimes(1)
      const [url, payload, options] = inventoryMocks.put.mock.calls[0]
      expect(url).toBe('/phones/12')
      expect(payload).toEqual(expect.objectContaining({ remarks: '新备注' }))
      for (const field of ['purchase_cost', 'imei', 'sale_price', 'sale_time']) expect(payload).not.toHaveProperty(field)
      expect(options.params).toEqual({ field_module: 'inventory_inventoryview' })
    } finally { wrapper.unmount() }
  })
  it('型号只读时品牌联动禁改，IMEI切换不能修改只读值，撤权关闭编辑', async () => {
    access.readonly.add('basic.model'); access.readonly.add('basic.imei')
    const wrapper = await open()
    try {
      const dialog = wrapper.findComponent({ name: 'InventoryEditDialog' })
      expect(dialog.props('canEditField')('brand')).toBe(false)
      const form = dialog.props('editForm'), imei = form.imei
      dialog.vm.$emit('brand-change'); dialog.vm.$emit('toggle-no-imei'); await flushPromises()
      expect(form.model).toBe('测试型号'); expect(form.imei).toBe(imei)
      access.edit = false; await flushPromises()
      expect(dialog.props('modelValue')).toBe(false)
      dialog.vm.$emit('submit'); await flushPromises()
      expect(inventoryMocks.put).not.toHaveBeenCalled()
    } finally { wrapper.unmount() }
  })

  it('库存状态字段使用规范 basic.status 映射，可在字段权限中切换编辑', async () => {
    const wrapper = await open()
    try {
      const dialog = wrapper.findComponent({ name: 'InventoryEditDialog' })
      expect(dialog.props('canViewField')('status')).toBe(true)
      expect(dialog.props('canEditField')('status')).toBe(true)
      access.readonly.add('basic.status')
      expect(dialog.props('canEditField')('status')).toBe(false)
    } finally { wrapper.unmount() }
  })
  it('隐藏规格不触发规格补查，仍允许独立修改备注；字段变化清理编辑内容', async () => {
    for (const field of ['brand', 'model', 'color', 'memory']) access.hidden.add(`basic.${field}`)
    const wrapper = await open()
    try {
      const dialog = wrapper.findComponent({ name: 'InventoryEditDialog' })
      dialog.props('editForm').remarks = '仅改备注'
      dialog.vm.$emit('submit'); await flushPromises()
      expect(inventoryMocks.put).toHaveBeenCalledTimes(1)
      const payload = inventoryMocks.put.mock.calls[0][1]
      for (const field of ['brand_id', 'model_id', 'color_id', 'memory_id']) expect(payload).not.toHaveProperty(field)
      wrapper.findComponent(InventoryTable).vm.$emit('edit', fullRow); await flushPromises()
      access.version++; await flushPromises()
      expect(dialog.props('modelValue')).toBe(false)
      expect(dialog.props('editForm').remarks).toBe('')
    } finally { wrapper.unmount() }
  })
})
