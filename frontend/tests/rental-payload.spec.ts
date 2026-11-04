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
