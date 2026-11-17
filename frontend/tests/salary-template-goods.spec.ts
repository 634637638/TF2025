import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import FormDialog from '@/views/salary/page/SalaryTemplateFormDialog.vue'
import { createSalaryTemplateForm, isSalaryGoodsCommissionRule, salaryGoodsRulePayload } from '@/views/salary/salary-template-form'
import type { SalaryGoodsCommissionRule, SalaryTemplate, SalaryTemplateForm } from '@/types/salary'
import { useFieldPermissions } from '@/composables/useFieldPermissions'

const fieldApi = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: fieldApi }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  token: 'isolated-field-session', isAuthenticated: true, user: { id: 7 }
}) }))

const rule = (patch: Partial<SalaryGoodsCommissionRule> = {}): SalaryGoodsCommissionRule => ({
  enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 10, ...patch
})
const template = (patch: Partial<SalaryTemplate> = {}): SalaryTemplate => ({ id: 4, name: '工资模板甲', base_salary: 2500,
  commission_type: 'fixed', commission_new_fixed: 20, commission_used_fixed: 0, overtime_hourly_rate: 10, rest_days: 2,
  goods_commission_rule: rule(), ...patch })
const Dialog = { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' }
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('工资字段沿用公共可编辑判定，默认、只读、隐藏及显式可编辑范围与后端一致', async () => {
  let fields: ReturnType<typeof useFieldPermissions> | undefined
  const Harness = defineComponent({ setup() { fields = useFieldPermissions(); return () => h('div') } })
  wrappers.push(mount(Harness))
  if (!fields) throw new Error('字段权限未初始化')
  const module = 'salary_salarytemplatesview'
  const permissions = fields
  const writable = (field: string) => permissions.isFieldEditable(module, `template.${field}`, { allowUnconfigured: true })
  expect(writable('base_salary')).toBe(true)
  expect(fields.isFieldEditable(module, 'template.base_salary')).toBe(false)
  fieldApi.get.mockResolvedValue({ success: true, data: { field_permissions: { [module]: {
    hidden_fields: ['template.description'], readonly_fields: ['template.base_salary'],
    editable_fields: ['template.base_salary', 'template.goods_commission_rule'], has_editable_scope: true
  } } } })
  await fields.init()
  expect(writable('base_salary')).toBe(false)
  expect(writable('description')).toBe(false)
  expect(writable('name')).toBe(false)
  expect(writable('goods_commission_rule')).toBe(true)
  expect(salaryGoodsRulePayload(createSalaryTemplateForm(template()), writable('goods_commission_rule')))
    .toEqual({ goods_commission_rule: rule() })
  fieldApi.get.mockResolvedValue({ success: true, data: { field_permissions: { [module]: {
    hidden_fields: [], readonly_fields: ['template.goods_commission_rule'], editable_fields: []
  } } } })
  await fields.init(true)
  expect(writable('name')).toBe(true)
  expect(salaryGoodsRulePayload(createSalaryTemplateForm(template()), writable('goods_commission_rule'))).toEqual({})
})

const render = async (row: SalaryTemplate = template()) => {
  const form = ref(createSalaryTemplateForm(row)), open = ref(true), saving = ref(false)
  const hidden = ref(false), editable = ref(true), readonlyFields = ref<string[]>([]), submissions: SalaryTemplateForm[] = []
  const Harness = defineComponent({ setup: () => () => h(FormDialog, {
    form: form.value, modelValue: open.value, saving: saving.value,
    canViewField: (_module, field) => !hidden.value || field !== 'template_goods_commission_rule',
    canEditField: (_module, field) => !readonlyFields.value.includes(field) && (editable.value || field !== 'template_goods_commission_rule'),
    'onUpdate:form': value => { form.value = value }, 'onUpdate:modelValue': value => { open.value = value },
    onSubmit: () => { submissions.push({ ...form.value, goods_commission_rule: { ...form.value.goods_commission_rule } }) }
  }) })
  const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog } } })
  wrappers.push(wrapper); await flushPromises()
  const field = (label: string) => wrapper.findAll('.el-form-item').find(item => item.find('.el-form-item__label').text() === label)!
  const click = async (text: string) => { await wrapper.findAll('button').find(button => button.text() === text)!.trigger('click'); await flushPromises() }
  return { wrapper, form, open, saving, hidden, editable, readonlyFields, submissions, field, click }
}

it('新增默认关闭且零规则独立，编辑保留原零值和关闭状态，不改手机提成', () => {
  const empty = createSalaryTemplateForm()
  expect(empty.goods_commission_rule).toEqual(rule({ enabled: false, fixed_amount: 0, percentage: 0 }))
  const row = template({ base_salary: 0, commission_new_fixed: 0, rest_days: 0, overtime_hourly_rate: 0,
    goods_commission_rule: rule({ enabled: false, fixed_amount: 0, percentage: 0 }) })
  const form = createSalaryTemplateForm(row)
  for (const field of ['base_salary', 'commission_new_fixed', 'rest_days', 'overtime_hourly_rate'] as const) expect(form[field]).toBe(0)
  expect(form.goods_commission_rule).toEqual(row.goods_commission_rule)
  form.goods_commission_rule.fixed_amount = 10
  expect(row.goods_commission_rule?.fixed_amount).toBe(0)
  expect(form.commission_new_fixed).toBe(0)
  expect(createSalaryTemplateForm(template({ goods_commission_rule: null })).goods_commission_rule.enabled).toBe(false)
})

it('完整规则校验拒绝多余字段、损坏、字符串金额和超范围；隐藏组不随默认值提交', () => {
  for (const value of [null, false, {}, [], { ...rule(), extra: 1 }, { ...rule(), fixed_amount: '2.5' },
    rule({ fixed_amount: 1.001 }), rule({ fixed_amount: -1 }), rule({ fixed_amount: Infinity }),
    rule({ fixed_amount: 100000000 }), rule({ percentage: 100.01 }), rule({ percentage: -1 }), rule({ percentage: 1.001 })]) {
    expect(isSalaryGoodsCommissionRule(value)).toBe(false)
  }
  expect(isSalaryGoodsCommissionRule(rule({ fixed_amount: 0, percentage: 100 }))).toBe(true)
  const form = createSalaryTemplateForm(template())
  expect(salaryGoodsRulePayload(form, false)).toEqual({})
  expect(salaryGoodsRulePayload(form, true)).toEqual({ goods_commission_rule: rule() })
  form.goods_commission_rule.percentage = 100.01
  expect(() => salaryGoodsRulePayload(form, true)).toThrow('商品提成规则')
  expect(salaryGoodsRulePayload(form, false)).toEqual({})
  expect(() => createSalaryTemplateForm(template({ goods_commission_rule: rule({ percentage: 101 }) }))).toThrow('商品提成规则异常')
})

it('编辑按件金额后提交完整商品规则，切换利润规则不串改手机配置', async () => {
  const { wrapper, form, submissions, field, click } = await render()
  expect(wrapper.text()).toContain('手机提成'); expect(wrapper.text()).toContain('商品提成')
  await field('商品提成（元/件）').find('input').setValue('3.25')
  await field('商品提成（元/件）').find('input').trigger('blur'); await flushPromises()
  expect(form.value.goods_commission_rule.fixed_amount).toBe(3.25)
  await wrapper.findAll('.el-radio').find(radio => radio.text() === '按利润比例')!.find('input').setValue(true); await flushPromises()
  expect(form.value.goods_commission_rule.type).toBe('percentage')
  await field('商品利润提成（%）').find('input').setValue('12.5')
  await field('商品利润提成（%）').find('input').trigger('blur'); await flushPromises()
  expect(wrapper.find('form').element.checkValidity()).toBe(true)
  await click('保存')
  expect(submissions).toHaveLength(1)
  expect(submissions[0].goods_commission_rule).toEqual(rule({ type: 'percentage', fixed_amount: 3.25, percentage: 12.5 }))
  expect(submissions[0].commission_new_fixed).toBe(20)
})

it('商品提成开关独立控制规则展示，关闭可保存，取消直接关闭不提交', async () => {
  const { form, wrapper, field, click, submissions, open } = await render(template({ goods_commission_rule: null }))
  expect(wrapper.text()).not.toContain('商品提成（元/件）')
  await field('启用商品提成').find('[role="switch"]').trigger('click'); await flushPromises()
  expect(form.value.goods_commission_rule.enabled).toBe(true)
  expect(wrapper.text()).toContain('商品提成（元/件）')
  await field('启用商品提成').find('[role="switch"]').trigger('click'); await flushPromises()
  await click('保存')
  expect(submissions[0].goods_commission_rule).toEqual(rule({ enabled: false, fixed_amount: 0, percentage: 0 }))
  await click('取消')
  expect(open.value).toBe(false); expect(submissions).toHaveLength(1)
})

it('字段隐藏整个规则组不可见，禁编只读；保存期间禁用字段和关闭及重复提交', async () => {
  const { wrapper, form, hidden, editable, saving, open, field, click, submissions } = await render()
  editable.value = false; await flushPromises()
  expect(field('启用商品提成').find('[role="switch"]').attributes('aria-disabled')).toBe('true')
  expect(field('商品提成（元/件）').find('input').attributes('disabled')).toBeDefined()
  hidden.value = true; await flushPromises()
  expect(wrapper.text()).not.toContain('商品提成')
  expect(salaryGoodsRulePayload(form.value, false)).toEqual({})
  hidden.value = false; editable.value = true; saving.value = true; await flushPromises()
  expect(field('商品提成（元/件）').find('input').attributes('disabled')).toBeDefined()
  await click('取消'); expect(open.value).toBe(true)
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(submissions).toHaveLength(0)
})

it('非法提成及空名称阻止表单提交，修正后可正常提交', async () => {
  const { form, wrapper, submissions } = await render()
  form.value.goods_commission_rule.percentage = 1.001
  await flushPromises()
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(submissions).toHaveLength(0)
  await vi.waitFor(() => expect(wrapper.text()).toContain('商品提成规则须为非负金额'))
  form.value.goods_commission_rule.percentage = 1
  form.value.name = '   '
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(submissions).toHaveLength(0)
  form.value.name = '已修正'
  await wrapper.find('form').trigger('submit'); await flushPromises()
  expect(submissions).toHaveLength(1)
})

it('整组保存的涨薪规则任一字段只读时，整组控件禁编，避免默认值覆盖', async () => {
  const { form, readonlyFields, field } = await render()
  form.value.auto_raise_enabled = true
  readonlyFields.value = ['template_auto_raise_amount']
  await flushPromises()
  expect(field('自动涨薪').find('[role="switch"]').attributes('aria-disabled')).toBe('true')
  for (const label of ['涨薪周期（月）', '涨薪金额（元）', '最高底薪（元）']) {
    expect(field(label).find('input').attributes('disabled')).toBeDefined()
  }
})
