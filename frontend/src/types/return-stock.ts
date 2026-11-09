/** 退库写入和回读共用的业务字段；历史记录可能尚无结构化信息。 */
export interface ReturnStockDetails {
  return_reason: string
  return_type: string
  handle_method: string
  refund_amount: number
  refund_method: string
  refund_channel: string | null
  reversal_date: string
  remarks: string
}

export interface ReturnGoodsRecord extends Partial<Omit<ReturnStockDetails, 'refund_amount'>> {
  id: number
  phone_id: number
  original_sale_id: number | null
  original_sale_type: string | null
  original_sale_operator_id: number | null
  original_sale_operator_name: string | null
  imei: string | null
  serial_number: string | null
  brand: string | null
  model: string | null
  color: string | null
  memory: string | null
  customer_name: string | null
  customer_phone: string | null
  operator_name: string | null
  reversal_date: string
  remarks: string
  refund_amount: number | string | null
  created_at: string
}
