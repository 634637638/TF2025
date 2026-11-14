import { afterEach, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import AmountInput from '@/components/AmountInput.vue'
import EditDialog from '@/views/salary/page/SalaryEditPayoutDialog.vue'
import SettleDialog from '@/views/salary/page/SalarySettleDialog.vue'
import DetailDialog from '@/views/salary/page/SalaryDetailDialog.vue'
import GoodsSummary from '@/views/salary/page/SalaryGoodsSummary.vue'
import { salaryCalculationInput, salaryPhoneCommission } from '@/views/salary/salary-record-state'
import type { SalaryCalculation, SalaryGoodsCommission } from '@/types/salary'

const goods: SalaryGoodsCommission = { earned_amount: 10, reversal_amount: 3.34, net_amount: 6.66,
  entries: [{ kind: 'return', order_id: 81, order_item_id: 82, aftersale_id: 91, aftersale_item_id: 92,
    original_salary_record_id: 71, quantity: 1, business_time: '2026-11-12 10:00:00', recorded_at: '2026-11-12 10:01:00', amount: -3.34 }] }
const calculation: SalaryCalculation = { employee_id: 7, period_start: '2026-11-01', period_end: '2026-11-30',
  base_salary: 2000, base_salary_adjustment: 0, commission_amount: 106.66, goods_commission: goods,
  overtime_hours: 0, overtime_pay: 0, performance_bonus: 0, other_bonus: 0, leave_days: 0,
  leave_deduction: 0, other_deduction: 0, net_salary: 2106.66, status: 'approved', calculation_version: 'a'.repeat(64) }
const Dialog = { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' }
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
const global = { plugins: [ElementPlus], components: { RecordDescriptions, AmountInput }, stubs: { MobileDialog: Dialog } }

it('自动保存只回传身份和核对版本，手工提成从总提成中去除商品净额且保留分币', () => {
  expect(salaryCalculationInput(calculation)).toEqual({ employee_id: 7, period_start: '2026-11-01', period_end: '2026-11-30', expected_calculation_version: 'a'.repeat(64) })
  expect(salaryPhoneCommission(calculation)).toBe(100)
  expect(salaryPhoneCommission({ commission_amount: 0, goods_commission: null })).toBe(0)
  expect(salaryPhoneCommission({ commission_amount: -3.34, goods_commission: { ...goods, net_amount: -3.34 } })).toBe(0)
})

it('商品提成显示正提成和退货扣回，展开保留原订单及原工资关联', async () => {
  const wrapper = mount(GoodsSummary, { props: { summary: goods }, global }); wrappers.push(wrapper)
  expect(wrapper.text()).toContain('商品退货扣回'); expect(wrapper.text()).toContain('6.66')
  expect(wrapper.text()).not.toContain('明细 82')
  await wrapper.find('.el-collapse-item__header').trigger('click'); await flushPromises()
  for (const value of ['退货扣回', '81 / 明细 82', '原工资', '71', '-3.34', '2026-11-12 10:00:00']) expect(wrapper.text()).toContain(value)
  await wrapper.setProps({ summary: null }); expect(wrapper.text()).toBe('')
})

it('工资编辑仅改手机或手工提成，商品摘要只读；不能直接设置已结算或手工发放时间', async () => {
  const wrapper = mount(EditDialog, { props: { modelValue: true, saving: false, employeeName: '工资员工',
    form: { id: 16, employee_id: 7, salary_template_id: 4, base_salary: 2000, commission_amount: 100,
      overtime_pay: 0, leave_deduction: 0, status: 'approved' },
    netSalary: '2106.66', goodsCommission: goods, canEditField: () => true, canViewField: () => true }, global })
  wrappers.push(wrapper); await flushPromises()
  expect(wrapper.text()).toContain('手机 / 手工提成'); expect(wrapper.text()).toContain('商品提成净额')
  expect(wrapper.text()).not.toContain('已结算'); expect(wrapper.find('.el-date-editor').exists()).toBe(false)
  const commission = wrapper.findAll('.form-group').find(item => item.find('label').text() === '手机 / 手工提成')!
  await commission.find('input').setValue('50'); await commission.find('input').trigger('blur'); await flushPromises()
  expect(wrapper.emitted('update:form')?.at(-1)?.[0]).toMatchObject({ commission_amount: 50 })
  await wrapper.setProps({ saving: true })
  expect(commission.find('input').attributes('disabled')).toBeDefined()
  expect(wrapper.findAll('button').find(button => button.text() === '取消')?.attributes('disabled')).toBeDefined()
  await wrapper.setProps({ canViewField: (_module, field) => field !== 'commission_amount' })
  expect(wrapper.text()).not.toContain('商品提成净额')
})

it('结算和个人工资详情复用同一商品摘要，隐藏提成时两处都不展示', async () => {
  const settle = mount(SettleDialog, { props: { modelValue: true, saving: false, canEditField: () => true,
    canViewField: () => true, goodsCommission: goods, form: { recordId: 16, employeeId: 7,
      employeeName: '工资员工', netSalary: 2106.66, payment_method: 'cash' } }, global })
  const detail = mount(DetailDialog, { props: { modelValue: true, record: calculation, canViewField: () => true,
    formatLeaveDays: () => '0', formatMonth: value => value, formatWorkDays: () => '30', getEmployeeName: () => '工资员工' }, global })
  wrappers.push(settle, detail); await flushPromises()
  for (const wrapper of [settle, detail]) {
    expect(wrapper.text()).toContain('商品退货扣回'); expect(wrapper.text()).toContain('2106.66')
    await wrapper.setProps({ canViewField: (_module: string, field: string) => field !== 'commission_amount' })
    expect(wrapper.text()).not.toContain('商品退货扣回')
  }
})
