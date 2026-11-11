import type { PriceBatchChanges, PriceListRow, WholesaleRuleMode } from '@/types/price-list'

export type PriceBatchField = keyof PriceBatchChanges

export interface PriceBatchForm {
  fields: PriceBatchField[]
  source_config_id: number | null
  is_collect: 0 | 1
  status: 0 | 1
  show_price: 0 | 1
  rule_mode: WholesaleRuleMode
  adjustment: number | undefined
}

export const createPriceBatchForm = (): PriceBatchForm => ({
  fields: [], source_config_id: null, is_collect: 1, status: 1, show_price: 1,
  rule_mode: 'inherit', adjustment: 0
})

export function buildPriceBatchChanges(form: PriceBatchForm): PriceBatchChanges {
  if (!form.fields.length) throw new Error('请至少选择一项需要修改的内容')
  const changes: PriceBatchChanges = {}
  for (const field of form.fields) {
    if (field === 'wholesale_rule') {
      if (['adjustment', 'extra'].includes(form.rule_mode) && (typeof form.adjustment !== 'number' || !Number.isFinite(form.adjustment) || Math.abs(form.adjustment) > 999999)) {
        throw new Error('请输入有效加减金额，正数加价，负数减价')
      }
      changes.wholesale_rule = { mode: form.rule_mode, adjustment: ['adjustment', 'extra'].includes(form.rule_mode) ? form.adjustment : 0 }
    } else if (field === 'source_config_id') {
      changes.source_config_id = form.source_config_id
    } else {
      changes[field] = form[field]
    }
  }
  return changes
}

export function formatWholesaleRule(row: PriceListRow): string {
  if (row.wholesale_rule_mode === 'original') return '不加价'
  if (row.wholesale_rule_mode === 'adjustment' || row.wholesale_rule_mode === 'extra') {
    const amount = Number(row.wholesale_rule_adjustment ?? 0)
    return `${row.wholesale_rule_mode === 'extra' ? '规则价' : '采集价'}${amount >= 0 ? '+' : ''}${amount}元`
  }
  return '跟随规则'
}
