import { afterEach, expect, it } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElTable } from 'element-plus'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import PayoutTab from '@/views/salary/page/SalaryPayoutTab.vue'
import { isPaidSalaryRecord } from '@/views/salary/salary-record-state'
import { useSalaryPayoutTable } from '@/views/salary/useSalaryPayoutTable'
import { buildEmptyEmployeeSalesStats } from '@/views/salary/salary-employee-data'
import type { SalaryPayoutRecord, SalaryPayoutRow } from '@/types/salary'

const record = (extra: Partial<SalaryPayoutRecord> = {}): SalaryPayoutRecord => ({ id: 15, employee_id: 7,
  status: 'paid', paid_at: '2026-11-01 09:00:00', base_salary: '2345.67', commission_amount: 0,
  net_salary: '2401.23', sales_count: 0, actual_work_days: 25, leave_days: 0, leave_deduction: 0,
  overtime_hours: 0, overtime_pay: 0, payment_method: 'cash', ...extra })
const employee: SalaryPayoutRow = { id: 7, name: '工资员工', username: 'staff-unit', payoutRecord: null }
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
const render = async (value: SalaryPayoutRecord | null, mobile = false, granted = true) => {
  const wrapper = mount(PayoutTab, { props: {
    actionColumnWidth: 250,
    calculateLeave: () => 333.33, calculateOvertime: () => 444.44, calculateWorkDays: () => 31,
    canCreate: granted, canPay: granted, canApprove: granted, canEdit: granted, canDelete: granted, canViewField: () => true,
    formatPayoutTime: time => time, getAttendanceStats: () => ({ leave_days: 10, overtime_hours: 20,
      monthly_leave_days_used: 5, monthly_leave_days_available: 6, latest_leave_activity_at: null, latest_leave_record_date: null }),
    getBaseSalary: () => 9876.54, getIndex: index => index + 1, getPaymentMethodName: () => '现金',
    getRecalculationNotice: () => ({ message: '迟来的考勤需要重算' }), getSalesStats: () => ({ ...buildEmptyEmployeeSalesStats([employee]).get(7)!, sales_count: 8 }),
    isMobile: mobile, loading: false, month: '2026-10', page: 1, pageSize: 20,
    rows: [{ ...employee, payoutRecord: value }], searchExpanded: false, searchText: '', total: 1
  }, global: { plugins: [ElementPlus], components: { RecordDetailDialog }, stubs: { ElTabPane: { template: '<section><slot /></section>' },
    UnifiedSearchPanel: true, Pagination: true, TableLoadingRow: true, DataEmptyState: true, MobileDialog: { template: '<section><slot /><slot name="footer" /></section>' } },
  mocks: { $getNumberColumnWidth: () => 70 }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const actions = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').map(button => button.text())

it('已发工资展示原金额与零值，当前提成和考勤变化不能覆盖快照', async () => {
  const wrapper = await render(record())
  expect(wrapper.text()).toContain('2345.67'); expect(wrapper.text()).toContain('2401.23')
  for (const dynamic of ['9876.54', '888.88', '9999.99', '333.33', '444.44', '31天', '20小时', '需重算']) expect(wrapper.text()).not.toContain(dynamic)
  expect(wrapper.text()).toContain('0台'); expect(wrapper.text()).toContain('已发放')
  expect(actions(wrapper)).not.toEqual(expect.arrayContaining(['重算', '编辑', '删除']))
})

it('已发手机端双击详情同样没有重算、编辑、删除，保留原工资及零提成', async () => {
  const wrapper = await render(record(), true)
  const table = wrapper.findComponent(ElTable)
  table.vm.$emit('row-dblclick', wrapper.props('rows')[0], null, new MouseEvent('dblclick')); await flushPromises()
  expect(wrapper.findComponent(RecordDetailDialog).props('modelValue')).toBe(true)
  expect(wrapper.findComponent(RecordDetailDialog).props('hasActions')).toBe(false)
  for (const action of ['重算', '编辑', '删除']) expect(actions(wrapper)).not.toContain(action)
  expect(wrapper.text()).toContain('2401.23'); expect(wrapper.text()).not.toContain('9999.99')
})

it('未发也保留服务器金额与重算编辑删除；有paid_at的异常状态也受保护', async () => {
  const wrapper = await render(record({ status: 'approved', paid_at: null }))
  expect(wrapper.text()).toContain('2345.67'); expect(wrapper.text()).toContain('2401.23')
  expect(wrapper.text()).not.toContain('888.88'); expect(wrapper.text()).not.toContain('9999.99')
  expect(wrapper.text()).toContain('待发放'); expect(actions(wrapper)).toEqual(expect.arrayContaining(['重算', '编辑', '删除']))
  await wrapper.findAll('button').find(button => button.text() === '重算')!.trigger('click')
  expect(wrapper.emitted('recalculate')).toHaveLength(1)
  await wrapper.setProps({ rows: [{ ...employee, payoutRecord: record({ status: 'approved' }) }] })
  expect(wrapper.text()).toContain('2345.67')
  for (const action of ['重算', '编辑', '删除']) expect(actions(wrapper)).not.toContain(action)
})

it('无记录的结算及未发操作服从各自动作权限', async () => {
  const wrapper = await render(null)
  await wrapper.findAll('button').find(button => button.text() === '结算')!.trigger('click')
  expect(wrapper.emitted('settle')).toHaveLength(1)
  await wrapper.setProps({ canCreate: false, canEdit: false, canDelete: false,
    rows: [{ ...employee, payoutRecord: record({ status: 'approved', paid_at: null }) }] })
  for (const action of ['结算', '重算', '编辑', '删除']) expect(actions(wrapper)).not.toContain(action)
})

it('工资筛选与动作保护按同一发放事实判断，包括零金额已发工资', () => {
  expect(isPaidSalaryRecord(record({ net_salary: 0 }))).toBe(true)
  expect(isPaidSalaryRecord(record({ status: 'approved' }))).toBe(true)
  expect(isPaidSalaryRecord(record({ status: 'approved', paid_at: null }))).toBe(false)
  const list = ref([record({ status: 'approved' })])
  const table = useSalaryPayoutTable({ getEmployees: () => [employee], initialMonth: '2026-10', payoutList: list })
  table.payoutFilters.status = 'paid'; expect(table.salaryPayoutData.value).toHaveLength(1)
  table.payoutFilters.status = 'unpaid'; expect(table.salaryPayoutData.value).toHaveLength(0)
})

it('审批和发放分别授权，不由工资编辑权限替代', async () => {
  const wrapper = await render(record({ status: 'pending', paid_at: null }), false, false)
  await wrapper.setProps({ canEdit: true })
  expect(actions(wrapper)).not.toContain('审批')
  expect(actions(wrapper)).not.toContain('发放')
  await wrapper.setProps({ canApprove: true })
  expect(actions(wrapper)).toContain('审批')
  await wrapper.findAll('button').find(button => button.text() === '审批')!.trigger('click')
  expect(wrapper.emitted('approve')).toHaveLength(1)
  await wrapper.setProps({ canApprove: false, canEdit: false, canPay: true,
    rows: [{ ...employee, payoutRecord: record({ status: 'approved', paid_at: null }) }] })
  expect(actions(wrapper)).not.toContain('审批')
  expect(actions(wrapper)).not.toContain('编辑')
  expect(actions(wrapper)).toContain('发放')
})
