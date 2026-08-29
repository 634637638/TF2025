import { fieldPermissions } from '@/composables/useFieldPermissions'

export const RENTAL_FIELD_MODULE_KEY = 'rentals_rentalsview'

export const RENTAL_FIELD_IDS = {
  stats_active_count: 'stats.active_count',
  stats_device_count: 'stats.device_count',
  stats_receivable_amount: 'stats.receivable_amount',
  stats_deposit_amount: 'stats.deposit_amount',
  contract_number: 'contract_info.contract_number',
  billing_mode: 'contract_info.billing_mode',
  contract_files: 'contract_info.contract_files',
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  customer_id_card: 'customer_info.customer_id_card',
  brand: 'device_info.brand',
  model: 'device_info.model',
  color: 'device_info.color',
  memory: 'device_info.memory',
  imei: 'device_info.imei',
  serial_number: 'device_info.serial_number',
  sale_price: 'price_info.sale_price',
  purchase_cost: 'price_info.purchase_cost',
  unit_price: 'price_info.unit_price',
  down_payment: 'price_info.down_payment',
  principal_amount: 'price_info.principal_amount',
  monthly_principal: 'price_info.monthly_principal',
  monthly_rent: 'price_info.monthly_rent',
  installment_amount: 'price_info.installment_amount',
  deposit: 'price_info.deposit',
  paid_rent: 'price_info.paid_rent',
  payable_rent: 'price_info.payable_rent',
  term_months: 'schedule_info.term_months',
  rented_days: 'schedule_info.rented_days',
  remaining_periods: 'schedule_info.remaining_periods',
  next_due_date: 'schedule_info.next_due_date',
  status: 'status_info.status',
  monitoring_lock: 'status_info.monitoring_lock',
  start_date: 'time_info.start_date',
  end_date: 'time_info.end_date',
  returned_at: 'time_info.returned_at',
  sale_invoice_number: 'sales_info.sale_invoice_number',
  sale_store_name: 'sales_info.sale_store_name',
  sale_operator_name: 'sales_info.sale_operator_name',
  sale_payment_method: 'sales_info.sale_payment_method',
  sale_payment_channel: 'sales_info.sale_payment_channel',
  sale_remarks: 'sales_info.sale_remarks',
  operator_name: 'operator_info.operator_name',
  remarks: 'other_info.remarks',
  operations: 'system_info.operations'
} as const

export type RentalFieldName = keyof typeof RENTAL_FIELD_IDS

export const canViewRentalField = (fieldName: RentalFieldName) => fieldPermissions.isFieldVisible(
  RENTAL_FIELD_MODULE_KEY,
  RENTAL_FIELD_IDS[fieldName]
)

export const pickVisibleRentalFields = <T extends object>(
  source: T,
  fieldMap: Partial<Record<keyof T, RentalFieldName>>
) => Object.fromEntries(
  Object.entries(source as Record<string, unknown>).filter(([key]) => {
    const fieldName = fieldMap[key as keyof T]
    return fieldName ? canViewRentalField(fieldName) : false
  })
) as Partial<T>
