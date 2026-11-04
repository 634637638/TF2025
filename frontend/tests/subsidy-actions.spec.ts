import { defineComponent, h, inject, provide, type PropType, type SetupContext } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SubsidyListSection from '@/views/subsidy/components/SubsidyListSection.vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import type { NationalSubsidyRecord } from '@/types'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: false, user: null }) }))

// 渲染真实列插槽，避免普通 shallow stub 把桌面端按钮一起隐藏。
const TableStub = defineComponent({
  props: { data: { type: Array as PropType<NationalSubsidyRecord[]>, required: true } },
  setup(props, { slots }) {
    provide('subsidyRows', props.data)
    return () => h('div', slots.default?.())
  }
})
const ColumnStub = {
  setup(_: unknown, { slots }: SetupContext) {
    const rows = inject<NationalSubsidyRecord[]>('subsidyRows', [])
    return () => h('div', rows.map(row => slots.default?.({ row })))
  }
}

describe.each([false, true])('国补操作权限，移动端=%s', isMobile => {
  it.each([
    [false, false], [true, false], [false, true], [true, true]
  ])('字段隐藏时审批=%s、到账=%s，只显示已授权操作并发出正确记录', async (canApprove, canArrival) => {
    const row: NationalSubsidyRecord = { id: 28, apply_time: null, arrival_time: null }
    const tableColumns = [
      { key: 'apply_time', label: '国补提交', visible: shouldShowActionColumn(false, [canApprove]) },
      { key: 'arrival_time', label: '国补到账', visible: shouldShowActionColumn(false, [canArrival]) }
    ].filter(column => column.visible)
    const wrapper = shallowMount(SubsidyListSection, {
      props: {
        loading: false, subsidyList: [row], displayList: [row], tableColumns,
        fieldVisibility: {}, isMobile, selectedItems: [], pinnedItems: [],
        subsidyPagination: { page: 1, page_size: 20, total: 1 },
        canApprove, canArrival, canUpload: false, canEdit: false, canDelete: false,
        canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
      },
      global: {
        directives: { 'tf-loading': {} },
        stubs: {
          DataEmptyState: true,
          ElTable: TableStub, ElTableColumn: ColumnStub, ElCheckbox: true,
          ElButton: { template: '<button><slot /></button>' }
        }
      }
    })
    const audit = wrapper.find('[title="审批"]')
    const arrival = wrapper.find('[title="到账"]')
    expect(audit.exists()).toBe(canApprove)
    expect(arrival.exists()).toBe(canArrival)
    if (canApprove) {
      await audit.trigger('click')
      expect(wrapper.emitted('audit')).toEqual([[row]])
    }
    if (canArrival) {
      await arrival.trigger('click')
      expect(wrapper.emitted('confirm-arrival')).toEqual([[row]])
    }
    wrapper.unmount()
  })
})
