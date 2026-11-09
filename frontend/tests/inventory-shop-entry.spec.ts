import { defineComponent, h, inject, provide, type PropType, type SetupContext } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InventoryTable from '@/views/inventory/page/InventoryTable.vue'
import InventoryDetailModal from '@/components/InventoryDetailModal.vue'
import type { InventoryItem } from '@/types'

vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: () => true } }))
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
