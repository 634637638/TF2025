export type RentalBillingMode = 'daily' | 'buyout'

export interface RentalFormState {
  customer_id: number | null
  phone_id: number | null
  billing_mode: RentalBillingMode
  unit_price: number | null
  term_months: number
  sale_price: number | null
  down_payment: number | null
  monthly_rent: number | null
  sale_store_id: number | null
  sale_operator_id: number | null
  sale_payment_method: string
  sale_payment_channel: string
  sale_remarks: string
  monitoring_lock: boolean
  start_date: string
  deposit: number | null
  remarks: string
  purchase_cost?: number | null
}

export interface RentalPayload {
  customer_id: number
  phone_id: number
  billing_mode: RentalBillingMode
  unit_price: number
  term_months: number | null
  sale_price: number
  down_payment: number
  monthly_rent: number
  sale_store_id: number | null
  sale_operator_id: number | null
  sale_payment_method: string
  sale_payment_channel: string | null
  sale_remarks: string | null
  monitoring_lock: boolean
  start_date: string
  deposit: number
  remarks: string | null
  purchase_cost?: number | null
}

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const nullableNumber = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const buildRentalPayload = (
  form: RentalFormState,
  phoneId: number,
  salePrice: number
): RentalPayload => {
  const isBuyout = form.billing_mode === 'buyout'
  const payload: RentalPayload = {
    customer_id: Number(form.customer_id),
    phone_id: phoneId,
    billing_mode: form.billing_mode,
    unit_price: isBuyout ? 0 : numberOrZero(form.unit_price),
    term_months: isBuyout ? numberOrZero(form.term_months) : null,
    sale_price: numberOrZero(salePrice),
    down_payment: isBuyout ? numberOrZero(form.down_payment) : 0,
    monthly_rent: isBuyout ? numberOrZero(form.monthly_rent) : 0,
    sale_store_id: isBuyout ? nullableNumber(form.sale_store_id) : null,
    sale_operator_id: isBuyout ? nullableNumber(form.sale_operator_id) : null,
    sale_payment_method: isBuyout ? form.sale_payment_method : 'cash',
    sale_payment_channel: isBuyout ? (form.sale_payment_channel || null) : null,
    sale_remarks: isBuyout ? (form.sale_remarks || null) : null,
    monitoring_lock: isBuyout ? true : Boolean(form.monitoring_lock),
    start_date: form.start_date,
    deposit: isBuyout ? 0 : numberOrZero(form.deposit),
    remarks: form.remarks?.trim() || null
  }

  if (form.purchase_cost !== undefined) {
    payload.purchase_cost = nullableNumber(form.purchase_cost)
  }

  return payload
}
