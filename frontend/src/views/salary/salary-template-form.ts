import type { SalaryGoodsCommissionRule, SalaryTemplate, SalaryTemplateForm } from '@/types/salary'
import { isMoneyInput } from '@/utils/security'

export const isSalaryGoodsCommissionRule = (value: unknown): value is SalaryGoodsCommissionRule => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).length === 4 && 'enabled' in value && typeof value.enabled === 'boolean' &&
    'type' in value && (value.type === 'fixed' || value.type === 'percentage') &&
    'fixed_amount' in value && typeof value.fixed_amount === 'number' && isMoneyInput(value.fixed_amount) &&
    value.fixed_amount >= 0 && value.fixed_amount <= 99999999.99 &&
    'percentage' in value && typeof value.percentage === 'number' && isMoneyInput(value.percentage) &&
    value.percentage >= 0 && value.percentage <= 100
}

export function createSalaryTemplateForm(row?: SalaryTemplate): SalaryTemplateForm {
  const raw = row?.goods_commission_rule
  if (raw !== null && raw !== undefined && !isSalaryGoodsCommissionRule(raw)) throw new Error('商品提成规则异常，请重新读取模板后核对')
  let raise: unknown = row?.auto_raise_rule
  if (typeof raise === 'string') {
    try { raise = JSON.parse(raise) } catch { throw new Error('自动涨薪规则异常，请核对工资模板') }
  }
  const rule = raise && typeof raise === 'object' ? raise : {}
  return {
    id: row?.id, name: row?.name ?? '', description: row?.description ?? '',
    base_salary: row ? row.base_salary ?? 0 : 2500,
    commission_type: row?.commission_type ?? 'fixed',
    commission_fixed: row?.commission_fixed ?? 20,
    commission_new_fixed: row?.commission_new_fixed ?? row?.commission_fixed ?? 20,
    commission_used_fixed: row?.commission_used_fixed ?? 0,
    commission_percentage: row?.commission_percentage ?? 10,
    goods_commission_rule: raw ? { ...raw } : { enabled: false, type: 'fixed', fixed_amount: 0, percentage: 0 },
    overtime_hourly_rate: row?.overtime_hourly_rate ?? 10, rest_days: row?.rest_days ?? 2,
    auto_raise_enabled: 'enabled' in rule && rule.enabled === true,
    auto_raise_months: 'months' in rule && typeof rule.months === 'number' ? rule.months : 6,
    auto_raise_amount: 'amount' in rule && typeof rule.amount === 'number' ? rule.amount : 100,
    auto_raise_max_salary: 'max_salary' in rule && typeof rule.max_salary === 'number' ? rule.max_salary : 3000
  }
}

/** 整组受一个字段权限约束；不可编辑时省略，不用默认值覆盖服务端规则。 */
export function salaryGoodsRulePayload(form: SalaryTemplateForm, canEdit: boolean): Pick<SalaryTemplate, 'goods_commission_rule'> {
  if (!canEdit) return {}
  if (!isSalaryGoodsCommissionRule(form.goods_commission_rule)) throw new Error('商品提成规则须为非负金额及0至100的比例，最多两位小数')
  return { goods_commission_rule: { ...form.goods_commission_rule } }
}
