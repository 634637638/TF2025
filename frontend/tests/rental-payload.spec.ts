import { describe, expect, it } from 'vitest'
import { buildRentalPayload, type RentalFormState } from '@/views/rentals/rental-payload'

const baseForm = (): RentalFormState => ({
  customer_id: 10,
  phone_id: 20,
  billing_mode: 'buyout',
  unit_price: 0,
  term_months: 12,
  sale_price: 5200,
  down_payment: 1200,
  monthly_rent: 350,
  sale_store_id: 2,
  sale_operator_id: 3,
  sale_payment_method: 'wechat',
  sale_payment_channel: '扫码',
  sale_remarks: '已核对',
  monitoring_lock: false,
  start_date: '2026-11-04',
  deposit: 500,
  remarks: '  正常办理  ',
  purchase_cost: 4000
})

describe('租赁提交数据归一化', () => {
  it.each([NaN, Infinity, -1, 1.001])('非法金额不转为零或舍入后提交：%s', value => {
    const form = baseForm()
    form.down_payment = value
    expect(() => buildRentalPayload(form, 20, 5200)).toThrow()
    expect(() => buildRentalPayload(baseForm(), 20, value)).toThrow()
  })
  it('空成本不覆盖原值，零成本完整保留，非法期数和ID不能被强转', () => {
    const form = baseForm()
    form.purchase_cost = null
    expect(buildRentalPayload(form, 20, 5200)).not.toHaveProperty('purchase_cost')
    form.purchase_cost = 0
    expect(buildRentalPayload(form, 20, 5200).purchase_cost).toBe(0)
    form.term_months = 1.1
    expect(() => buildRentalPayload(form, 20, 5200)).toThrow()
    form.term_months = 1
    form.sale_store_id = NaN
    expect(() => buildRentalPayload(form, 20, 5200)).toThrow()
  })
  it('买断模式保留销售字段并清零租赁专属金额', () => {
    const payload = buildRentalPayload(baseForm(), 20, 5200)

    expect(payload).toMatchObject({
      billing_mode: 'buyout',
      unit_price: 0,
      sale_price: 5200,
      down_payment: 1200,
      monthly_rent: 350,
      sale_store_id: 2,
      sale_operator_id: 3,
      remarks: '正常办理',
      purchase_cost: 4000
    })
  })

  it('日租模式不会携带买断支付信息', () => {
    const form = baseForm()
    form.billing_mode = 'daily'
    form.unit_price = 80

    const payload = buildRentalPayload(form, 20, 0)
    expect(payload).toMatchObject({
      billing_mode: 'daily',
      unit_price: 80,
      term_months: null,
      down_payment: 0,
      monthly_rent: 0,
      sale_store_id: null,
      sale_operator_id: null,
      sale_payment_method: 'cash'
    })
  })
})
