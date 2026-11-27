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
  props: {
    label: { type: String, default: '' },
    width: { type: [Number, String], default: undefined },
    minWidth: { type: [Number, String], default: undefined },
    className: { type: String, default: '' }
  },
  setup(props: { label: string, width?: number | string, minWidth?: number | string, className: string }, { slots }: SetupContext) {
    const rows = inject<NationalSubsidyRecord[]>('subsidyRows', [])
    return () => h('div', {
      class: ['column', props.className],
      'data-label': props.label,
      'data-width': props.width,
      'data-min-width': props.minWidth
    }, rows.map(row => slots.default?.({ row })))
  }
}

describe.each([false, true])('国补操作权限，移动端=%s', isMobile => {
  it.each([false, true])('照片上传权限=%s，手机照片只读并由双击详情承接操作', async canUpload => {
    const row: NationalSubsidyRecord = { id: 28, subsidy_photos: [] }
    const wrapper = shallowMount(SubsidyListSection, {
      props: {
        loading: false, subsidyList: [row], displayList: [row],
        tableColumns: [{ key: 'subsidy_photos', label: '国补照片' }],
        fieldVisibility: { subsidy_photos: true }, isMobile, isTablet: false, selectedItems: [], pinnedItems: [],
        subsidyPagination: { page: 1, page_size: 20, total: 1 },
        canApprove: false, canArrival: false, canUpload, canEdit: false, canDelete: false,
        canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
      },
      global: {
        directives: { 'tf-loading': {}, 'table-double-tap': {} },
        stubs: { ElTable: TableStub, ElTableColumn: ColumnStub, ElCheckbox: true }
      }
    })
    const photoAction = wrapper.find('.photo-icon-wrapper')
    expect(photoAction.exists()).toBe(!isMobile)
    if (isMobile) {
      expect(wrapper.text()).not.toContain('0 张')
      wrapper.findComponent(TableStub).vm.$emit('row-dblclick', row, null, new MouseEvent('dblclick'))
      expect(wrapper.emitted('row-double-click')).toEqual([[row]])
      expect(wrapper.emitted('open-photo-manage')).toBeUndefined()
    } else {
      await photoAction.trigger('click')
      expect(wrapper.emitted('open-photo-manage')).toEqual([[row]])
    }
    wrapper.unmount()
  })

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
        fieldVisibility: {}, isMobile, isTablet: false, selectedItems: [], pinnedItems: [],
        subsidyPagination: { page: 1, page_size: 20, total: 1 },
        canApprove, canArrival, canUpload: false, canEdit: false, canDelete: false,
        canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
      },
      global: {
        directives: { 'tf-loading': {}, 'table-double-tap': {} },
        stubs: {
          DataEmptyState: true,
          ElTable: TableStub, ElTableColumn: ColumnStub, ElCheckbox: true,
          ElButton: { template: '<button><slot /></button>' }
        }
      }
    })
    const audit = wrapper.find('[title="审批"]')
    const arrival = wrapper.find('[title="到账"]')
    expect(audit.exists()).toBe(!isMobile && canApprove)
    expect(arrival.exists()).toBe(!isMobile && canArrival)
    if (!isMobile && canApprove) {
      await audit.trigger('click')
      expect(wrapper.emitted('audit')).toEqual([[row]])
    }
    if (!isMobile && canArrival) {
      await arrival.trigger('click')
      expect(wrapper.emitted('confirm-arrival')).toEqual([[row]])
    }
    if (isMobile) {
      const table = wrapper.findComponent(TableStub)
      table.vm.$emit('row-dblclick', row, null, new MouseEvent('dblclick'))
      expect(wrapper.emitted('row-double-click')).toEqual([[row]])
    }
    wrapper.unmount()
  })
})

describe('国补列表按设备断点收敛展示列', () => {
  const columns = [
    'store_name', 'sale_time', 'customer_name', 'customer_phone', 'customer_idcard',
    'brand', 'model', 'color', 'memory', 'serial_number', 'imei1', 'imei2',
    'sale_price', 'subsidy_amount', 'remarks', 'subsidy_photos', 'apply_time', 'arrival_time', 'actions'
  ].map(key => ({ key, label: key }))

  const renderColumns = (isMobile: boolean, isTablet: boolean) => shallowMount(SubsidyListSection, {
    props: {
      loading: false, subsidyList: [], displayList: [], tableColumns: columns,
      fieldVisibility: Object.fromEntries(columns.map(column => [column.key, true])), isMobile, isTablet, selectedItems: [], pinnedItems: [],
      subsidyPagination: { page: 1, page_size: 20, total: 0 },
      canApprove: false, canArrival: false, canUpload: false, canEdit: false, canDelete: false,
      canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
    },
    global: {
      directives: { 'tf-loading': {}, 'table-double-tap': {} },
      stubs: {
        ElTable: TableStub,
        ElTableColumn: {
          props: { label: { type: String, default: '' } },
          setup(props, { slots }) {
            const rows = inject<NationalSubsidyRecord[]>('subsidyRows', [])
            return () => h('span', { class: 'column', 'data-column': props.label }, rows.map(row => slots.default?.({ row })))
          }
        },
        ElCheckbox: true
      }
    }
  })

  it('手机只保留店铺、销售日期、姓名、型号、颜色，并继续隐藏操作列', () => {
    const wrapper = renderColumns(true, false)
    expect(wrapper.findAll('.column').map(column => column.attributes('data-column')).filter(Boolean)).toEqual([
      'store_name', 'sale_time', 'customer_name', 'model', 'color'
    ])
    wrapper.unmount()
  })

  it('iPad 平板增加品牌、内存、价格和状态列，但不把识别码放入主表', () => {
    const wrapper = renderColumns(false, true)
    expect(wrapper.findAll('.column').map(column => column.attributes('data-column')).filter(Boolean)).toEqual([
      'store_name', 'sale_time', 'customer_name', 'brand', 'model', 'color', 'memory',
      'sale_price', 'subsidy_amount', 'subsidy_photos', 'apply_time', 'arrival_time'
    ])
    wrapper.unmount()
  })

  it('桌面端保留当前用户已授权的完整列集合', () => {
    const wrapper = renderColumns(false, false)
    expect(wrapper.findAll('.column')).toHaveLength(columns.length + 1)
    wrapper.unmount()
  })
})

describe('国补型号列内容宽度', () => {
  it('按当前页最长型号精确设置列宽，保持型号单行显示', () => {
    const rows: NationalSubsidyRecord[] = [
      { id: 1, phone_model: 'iPhone 17' },
      { id: 2, phone_model: 'iPhone 18 Pro Max' }
    ]
    const wrapper = shallowMount(SubsidyListSection, {
      props: {
        loading: false, subsidyList: rows, displayList: rows,
        tableColumns: [{ key: 'model', label: '型号' }],
        fieldVisibility: {}, isMobile: true, isTablet: false, selectedItems: [], pinnedItems: [],
        subsidyPagination: { page: 1, page_size: 20, total: 1 },
        canApprove: false, canArrival: false, canUpload: false, canEdit: false, canDelete: false,
        canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
      },
      global: {
        directives: { 'tf-loading': {}, 'table-double-tap': {} },
        stubs: { ElTable: TableStub, ElTableColumn: ColumnStub, ElCheckbox: true }
      }
    })

    const modelColumn = wrapper.find('[data-label="型号"]')
    expect(modelColumn.attributes('data-width')).toBe('152')
    expect(modelColumn.attributes('data-min-width')).toBe('152')
    expect(modelColumn.classes()).toContain('complete-text-column')
    expect(modelColumn.classes()).not.toContain('wrapped-text-column')
    wrapper.unmount()
  })

  it('超过 180px 的型号仍按完整内容计算，不截断宽度或换行', () => {
    const row: NationalSubsidyRecord = { id: 1, phone_model: 'Apple iPhone 18 Pro Max 特别版 1TB 国行全新未拆封' }
    const wrapper = shallowMount(SubsidyListSection, {
      props: {
        loading: false, subsidyList: [row], displayList: [row],
        tableColumns: [{ key: 'model', label: '型号' }],
        fieldVisibility: {}, isMobile: true, isTablet: false, selectedItems: [], pinnedItems: [],
        subsidyPagination: { page: 1, page_size: 20, total: 1 },
        canApprove: false, canArrival: false, canUpload: false, canEdit: false, canDelete: false,
        canShowActions: false, canViewCustomerIdcard: false, selectAll: false, isIndeterminate: false
      },
      global: {
        directives: { 'tf-loading': {}, 'table-double-tap': {} },
        stubs: { ElTable: TableStub, ElTableColumn: ColumnStub, ElCheckbox: true }
      }
    })

    const modelColumn = wrapper.find('[data-label="型号"]')
    expect(Number(modelColumn.attributes('data-width'))).toBeGreaterThan(180)
    expect(modelColumn.attributes('data-width')).toBe(modelColumn.attributes('data-min-width'))
    expect(modelColumn.classes()).not.toContain('wrapped-text-column')
    wrapper.unmount()
  })
})
