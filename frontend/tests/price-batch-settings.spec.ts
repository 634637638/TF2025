import { describe, expect, it } from 'vitest'
import { buildPriceBatchChanges, createPriceBatchForm, formatWholesaleRule } from '@/views/price-list/price-batch-settings'
import type { PriceListRow } from '@/types/price-list'
import { normalizePriceListRow } from '@/views/price-list/price-list-row'

describe('报价批量设置', () => {
  it('打开时不默认修改任何字段，避免批量覆盖原值', () => {
    expect(() => buildPriceBatchChanges(createPriceBatchForm())).toThrow('请至少选择一项')
  })
  it('只提交勾选的状态，显式关闭值不会丢失', () => {
    const form = createPriceBatchForm()
    form.fields = ['is_collect', 'show_price']
    form.is_collect = 0
    form.show_price = 0
    expect(buildPriceBatchChanges(form)).toEqual({ is_collect: 0, show_price: 0 })
  })
  it('恢复默认来源提交 null，未选采集源时不提交来源', () => {
    const form = createPriceBatchForm()
    form.fields = ['source_config_id']
    expect(buildPriceBatchChanges(form)).toEqual({ source_config_id: null })
    form.source_config_id = 2
    expect(buildPriceBatchChanges(form)).toEqual({ source_config_id: 2 })
  })
  it.each(['inherit', 'original'] as const)('%s 清除原金额', mode => {
    const form = { ...createPriceBatchForm(), fields: ['wholesale_rule'] as const, rule_mode: mode, adjustment: 50 }
    expect(buildPriceBatchChanges({ ...form, fields: [...form.fields] })).toEqual({ wholesale_rule: { mode, adjustment: 0 } })
  })
  it.each(['adjustment', 'extra'] as const)('%s 保留正负加减金额，重新保存替换而非累加', mode => {
    const form = createPriceBatchForm()
    Object.assign(form, { fields: ['wholesale_rule'], rule_mode: mode, adjustment: -20 })
    const first = buildPriceBatchChanges(form)
    expect(first).toEqual({ wholesale_rule: { mode, adjustment: -20 } })
    expect(buildPriceBatchChanges(form)).toEqual(first)
  })
  it.each([undefined, NaN, Infinity, 1000000])('拒绝无效加减金额 %s', adjustment => {
    const form = createPriceBatchForm()
    Object.assign(form, { fields: ['wholesale_rule'], rule_mode: 'extra', adjustment })
    expect(() => buildPriceBatchChanges(form)).toThrow('请输入有效加减金额')
    form.fields = ['status']
    expect(buildPriceBatchChanges(form)).toEqual({ status: 1 })
  })
  it('保留后端独立规则和金额，标签明确区分计算基准', () => {
    const row: PriceListRow = { id: 3, brand_name: '品牌', model_number: '型号', color_name: '白色', memory: '256GB', stock_quantity: 0, is_collect: 1, status: 1, show_price: 1 }
    expect(formatWholesaleRule(normalizePriceListRow(row))).toBe('跟随规则')
    expect(formatWholesaleRule(normalizePriceListRow({ ...row, wholesale_rule_mode: 'original' }))).toBe('不加价')
    expect(formatWholesaleRule(normalizePriceListRow({ ...row, wholesale_rule_mode: 'adjustment', wholesale_rule_adjustment: '-20' }))).toBe('采集价-20元')
    expect(formatWholesaleRule(normalizePriceListRow({ ...row, wholesale_rule_mode: 'extra', wholesale_rule_adjustment: '20' }))).toBe('规则价+20元')
  })
})
