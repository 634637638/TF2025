import { h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElTable } from 'element-plus'
import { afterEach, expect, it, vi } from 'vitest'
import PaginatedTable from '@/components/PaginatedTable.vue'
import MobileTable from '@/components/MobileTable.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import { vTableDoubleTap } from '@/directives/table-double-tap'

const wrappers: VueWrapper[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.unstubAllGlobals() })
const dialog = { props: ['modelValue'], template: '<section v-if="modelValue" class="detail"><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></section>' }
const options = () => ({
  plugins: [ElementPlus], components: { RecordDetailDialog },
  stubs: { MobileDialog: dialog, Pagination: true, DataEmptyState: true, TableLoadingRow: true },
  directives: { 'table-double-tap': vTableDoubleTap, 'tf-loading': {} },
  mocks: { $getActionColumnWidth: () => 100, $getNumberColumnWidth: () => 80 }
})

it('分页公共表使用实际本地排序记录，底部保留原列插槽且先关闭再执行动作', async () => {
  vi.stubGlobal('innerWidth', 375)
  const rows = [{ id: 1, name: '乙', amount: 20 }, { id: 2, name: '甲', amount: 10 }]
  const action = vi.fn((row: unknown) => {
    expect(wrapper.findComponent(RecordDetailDialog).emitted('beforeAction')).toHaveLength(1)
    expect(row).toEqual(rows[1])
  })
  const wrapper = mount(PaginatedTable, {
    props: { data: rows, columns: [{ key: 'name', prop: 'name', label: '名称' }, { key: 'amount', prop: 'amount', label: '金额', sortable: true }], defaultSort: { prop: 'amount', order: 'ascending' } },
    slots: { 'column-name': ({ row }) => h('strong', String(row.name)), actions: ({ row }) => h('button', { onClick: () => action(row) }, '编辑') },
    global: options()
  }); wrappers.push(wrapper)
  const table = wrapper.findComponent(ElTable)
  expect(table.props('data')).toEqual([rows[1], rows[0]])
  expect(wrapper.findAll('button').some(node => node.text() === '编辑')).toBe(false)
  const first = wrapper.find('.el-table__body tr.el-table__row')
  await first.trigger('dblclick'); await nextTick()
  const detail = wrapper.findComponent(RecordDetailDialog)
  expect(detail.props('record')).toEqual(rows[1])
  expect(wrapper.find('.detail strong').text()).toBe('甲')
  await wrapper.find('.detail footer button').trigger('click'); await nextTick()
  expect(action).toHaveBeenCalledOnce()
  expect(detail.props('modelValue')).toBe(false)
  table.vm.$emit('sort-change', { prop: 'amount', order: 'descending' }); await nextTick()
  expect(table.props('data')).toEqual(rows)
  table.vm.$emit('sort-change', { prop: 'amount', order: null }); await nextTick()
  expect(table.props('data')).toEqual(rows)
})

it('服务端自定义排序不二次重排，无动作详情无底部', async () => {
  vi.stubGlobal('innerWidth', 375)
  const rows = [{ id: 2, amount: 20 }, { id: 1, amount: 10 }]
  const wrapper = mount(PaginatedTable, { props: { data: rows, columns: [{ key: 'amount', prop: 'amount', label: '金额', sortable: 'custom' }] }, global: options() }); wrappers.push(wrapper)
  wrapper.findComponent(ElTable).vm.$emit('sort-change', { prop: 'amount', order: 'ascending' }); await nextTick()
  expect(wrapper.findComponent(ElTable).props('data')).toEqual(rows)
  await wrapper.find('.el-table__body tr.el-table__row').trigger('dblclick')
  expect(wrapper.find('.detail footer').exists()).toBe(false)
})

it('手机卡片双击后底部保留全部动作，禁用动作不运行，刷新删除关闭详情', async () => {
  vi.stubGlobal('innerWidth', 375)
  const rows = [{ id: 5, name: '记录甲', remarks: '长备注' }]
  const wrapper = mount(MobileTable, { props: { data: rows, rowKey: 'id', columns: [{ prop: 'name', label: '名称' }, { prop: 'remarks', label: '备注', detailWide: true }],
    actions: Array.from({ length: 5 }, (_, i) => ({ key: String(i), label: `动作${i}`, disabled: () => i === 0 })) }, global: options() }); wrappers.push(wrapper)
  expect(wrapper.find('.mobile-table__card button').exists()).toBe(false)
  await wrapper.find('.mobile-table__card').trigger('dblclick'); await nextTick()
  expect(wrapper.findAll('.detail footer button')).toHaveLength(5)
  await wrapper.findAll('.detail footer button')[0].trigger('click')
  expect(wrapper.emitted('action')).toBeUndefined()
  expect(wrapper.findComponent(RecordDetailDialog).props('modelValue')).toBe(true)
  await wrapper.findAll('.detail footer button')[4].trigger('click')
  expect(wrapper.emitted('action')?.[0]).toEqual([expect.objectContaining({ key: '4' }), rows[0], 0])
  await wrapper.find('.mobile-table__card').trigger('dblclick'); await nextTick()
  await wrapper.setProps({ data: [] }); await nextTick()
  expect(wrapper.findComponent(RecordDetailDialog).props('modelValue')).toBe(false)
})

it('混合长短字段按可见顺序补齐，长字段后的两项短字段保持同一行', () => {
  const wrapper = mount(RecordDetailDialog, { props: { modelValue: true, title: '详情', hasActions: false, record: { id: 1 }, fields: [
    { key: 'before', label: '前项', value: '甲', visible: true },
    { key: 'long', label: '备注', value: '长内容', visible: true, wide: true },
    { key: 'hidden', label: '隐藏', value: '不可见', visible: false },
    { key: 'one', label: '名称', value: '乙', visible: true },
    { key: 'two', label: '数量', value: 2, visible: true }
  ] }, global: { stubs: { MobileDialog: dialog } } }); wrappers.push(wrapper)
  const fields = wrapper.findAll('.tf-record-details__field')
  expect(fields.map(field => field.classes().includes('tf-record-details__field--wide'))).toEqual([true, true, false, false])
  expect(wrapper.text()).not.toContain('不可见')
})

it('记录详情支持仅桌面使用的四列布局配置', async () => {
  const wrapper = mount(RecordDetailDialog, { props: { modelValue: true, title: '详情', hasActions: false, record: { id: 1 }, desktopColumns: 4, tabletColumns: 3, fields: [
    { key: 'first', label: '名称', value: '甲', visible: true },
    { key: 'second', label: '类型', value: '配件', visible: true },
    { key: 'third', label: '数量', value: 1, visible: true },
    { key: 'fourth', label: '门店', value: '一店', visible: true },
    { key: 'remark', label: '备注', value: '说明', visible: true, wide: true }
  ] }, global: { stubs: { MobileDialog: dialog } } }); wrappers.push(wrapper)
  expect(wrapper.find('.tf-record-details').classes()).toContain('tf-record-details--columns-4')
  expect(wrapper.find('.tf-record-details').classes()).toContain('tf-record-details--tablet-columns-3')
  expect(wrapper.findAll('.tf-record-details__field--wide')).toHaveLength(1)
  await wrapper.setProps({ desktopColumns: 2 })
  expect(wrapper.find('.tf-record-details').classes()).not.toContain('tf-record-details--columns-4')
  await wrapper.setProps({ tabletColumns: 2 })
  expect(wrapper.find('.tf-record-details').classes()).not.toContain('tf-record-details--tablet-columns-3')
})
