/** 配件商品模板与入库共享档案契约；适配手机型号通过多值关系关联。 */
export interface AccessoryRecord {
  id: number
  /** 实际品牌库存商品的所属模板；模板本身为空。 */
  template_id?: number | null
  name?: string
  barcode?: string
  category?: string
  category_id?: number | string | null
  product_model?: string | null
  serial_tracking?: number | boolean | null
  brand_id?: number | string | null
  brand_name?: string
  model_id?: number | string | null
  model_ids?: number[] | string
  compatible_model_names?: string
  model_name?: string
  model_brand_id?: number | string | null
  model_brand_name?: string
  color_id?: number | string | null
  color_name?: string
  supplier_id?: number | string | null
  supplier_name?: string
  purchase_cost?: number | string
  sale_price?: number | string
  total_stock?: number | string
  total_in?: number | string
  total_out?: number | string
  profit?: number | string
  remaining_stock?: number | string
  min_stock?: number | string
  unit?: string
  unit_id?: number | string | null
  description?: string
  remarks?: string
  image_url?: string
  status?: number | string | boolean
  created_at?: string | null
  updated_at?: string | null
}

export type AccessoryUsageType = 'sale' | 'gift'

/** 综合查询商品模式：销售事实与原单资料，金额保留数据库小数文本及字段脱敏的空值。 */
export interface AccessorySaleRecord {
  id: number
  accessory_id: number | null
  sale_no: string | null
  order_no: string | null
  order_id?: number | string | null
  order_item_id?: number | string | null
  linked_phone_invoice: string | null
  sale_type: AccessoryUsageType | null
  store_id: number | null
  store_name: string | null
  name: string | null
  barcode: string | null
  category: string | null
  brand_name: string | null
  product_model: string | null
  color_name: string | null
  unit: string | null
  customer_name: string | null
  customer_phone: string | null
  quantity: number | null
  returned_quantity?: number | string | null
  remaining_quantity?: number | string | null
  unit_price: number | string | null
  total_price: number | string | null
  purchase_cost: number | string | null
  profit: number | string | null
  points_awarded: number | null
  points_used?: number | string | null
  deduction_amount?: number | string | null
  operator_name: string | null
  sale_time: string | null
  remarks: string | null
  has_snapshot: number | boolean
}

/** 客户定向商品历史：复用销售契约，不返回客户身份、成本或内部订单ID。 */
export type CustomerGoodsRecord = Required<Pick<AccessorySaleRecord,
  'id' | 'sale_no' | 'order_no' | 'linked_phone_invoice' | 'sale_type' | 'store_name' | 'name' | 'category' |
  'brand_name' | 'product_model' | 'color_name' | 'unit' | 'quantity' | 'returned_quantity' | 'remaining_quantity' |
  'unit_price' | 'total_price' | 'points_awarded' | 'points_used' | 'deduction_amount' | 'operator_name' | 'sale_time' |
  'remarks' | 'has_snapshot'>> & { has_order: boolean }

export interface AccessorySaleBatch {
  id: number
  stock_in_id: number | null
  batch_no: string | null
  supplier_name: string | null
  inventory_time: string | null
  inventory_operator_name: string | null
  purchase_cost: number | string | null
  usage_type: AccessoryUsageType | null
  quantity: number | null
  serial_tracking: number | null
}

export interface AccessorySaleDetail extends AccessorySaleRecord {
  serial_numbers: string[] | null
  batches: AccessorySaleBatch[]
}

/** 经服务端实际换货关系核验的新件成交快照；字段隐藏时返回null。 */
export interface GoodsExchangeReplacement {
  order_no: string | null
  sale_no: string | null
  name: string | null
  /** 新商品原销售员快照，与办理人当前姓名分别展示。 */
  operator_name: string | null
  serial_numbers: string[] | null
}

/** 原商品明细的追加售后凭据；字段隐藏时返回null，金额单位为元。 */
export interface GoodsAftersaleRecord {
  id: number
  operation_type: 'goods_return' | 'phone_return' | 'goods_exchange'
  replacement: GoodsExchangeReplacement | null
  replacement_amount: number | null
  /** 原件用于抵付新件的金额，不是另一笔现金收款。 */
  exchange_credit_amount: number | null
  quantity: number | null
  /** 未退赠品扣款数量，不计入实物已退数量。 */
  gift_charge_quantity: number | null
  gift_charge_amount: number | null
  serial_numbers: string[] | null
  return_reason: string | null
  base_refund_amount: number | null
  points_recovery_amount: number | null
  points_compensation_amount: number | null
  /** 正数为本明细应退金额抵扣同单款项；负数为由同单退款抵扣。非新增资金往来。 */
  settlement_offset_amount: number | null
  refund_amount: number | null
  collection_amount: number | null
  points_delta: number | null
  points_award_returned: number | null
  points_redemption_returned: number | null
  store_id: number | null
  store_name: string | null
  operator_id: number | null
  operator_name: string | null
  settlement_method: string | null
  settlement_channel: string | null
  business_time: string | null
  created_at: string | null
  remarks: string | null
}

export interface AccessoryPayloadSource {
  usage_type?: AccessoryUsageType
  barcode?: string
  accessory_id?: number | null
  name?: string
  category?: string
  category_id?: number | null
  product_model?: string | null
  serial_tracking?: number
  serial_numbers?: AccessorySerialInput[] | string[]
  brand_id?: number | null
  model_id?: number | null
  model_ids?: number[]
  color_id?: number | null
  supplier_id?: number | null
  purchase_cost?: number | string
  sale_price?: number | string
  unit?: string
  unit_id?: number | null
  status?: number
  min_stock?: number
  total_quantity?: number
  distribution?: Array<{ store_id: number; store_name?: string; quantity: number }>
  store_id?: number | null
  remarks?: string
  description?: string
  image_url?: string
  quantity?: number
  unit_price?: number | string
  customer_id?: number | null
  customer_name?: string
  customer_phone?: string
}

export interface AccessorySerialInput {
  serial_number: string
  store_id: number
}

/** 采购请求标识是事务元数据，不受业务字段显隐过滤。 */
export interface AccessoryStockInInput extends AccessoryPayloadSource {
  request_key: string
}

/** 原采购回执，不将后来变化的模板或库存快照当作本次入库结果。 */
export interface AccessoryStockInReceipt {
  stock_in_id: number | null
  batch_no: string | null
  accessory_id: number
  quantity: number | null
  total_amount: number | null
  inventory_time: string | null
  replayed: boolean
}

export interface AccessorySerialRecord {
  id: number
  accessory_id: number
  serial_number: string
  status?: 'in_stock' | 'sold' | 'gifted' | null
  store_id?: number | string | null
  store_name?: string | null
  purchase_cost?: number | string | null
  batch_no?: string | null
  supplier_name?: string | null
  inventory_time?: string | null
  inventory_operator_name?: string | null
  sale_no?: string | null
  sale_type?: 'sale' | 'gift' | null
  customer_name?: string | null
  customer_phone?: string | null
  operator_name?: string | null
  sale_time?: string | null
  unit_price?: number | string | null
}

export type AccessoryCatalogKind = 'category' | 'unit'

export interface AccessoryCatalogItem {
  id: number
  name: string
  status: number
  sort_order: number
  description?: string | null
  film_enabled?: boolean | number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AccessoryCatalogResponse {
  categories: AccessoryCatalogItem[]
  units: AccessoryCatalogItem[]
  film_ready?: boolean
}

export interface AccessorySettings {
  warehouse_store_id: number | null
  stores: Array<{ id: number | string; name: string; status?: number }>
}

export interface AccessoryStoreStock {
  serial_quantity?: number | string | null
  plain_quantity?: number | string | null
  store_id: number | string
  store_name?: string | null
  quantity?: number | string | null
}

/** 当前批次余额，采购来源与当前所在门店分别保存；不代表原采购总量。 */
export interface AccessoryBatchStock {
  row_key: string
  accessory_id: number
  store_id: number
  store_name: string | null
  brand_name: string | null
  product_model: string | null
  batch_no: string | null
  supplier_name: string | null
  inventory_time: string | null
  inventory_operator_name: string | null
  purchase_cost: number | string | null
  usage_type: AccessoryUsageType | 'unclassified' | null
  serial_tracking: number | null
  quantity: number | string
  source_status: 'purchase' | 'legacy' | 'untracked'
}

/** 库存划拨仅改变门店归属，保留采购和销售事实。 */
export interface AccessoryTransferRecord {
  id: number
  accessory_id: number
  from_store_id: number
  to_store_id: number
  from_store_name: string
  to_store_name: string
  quantity: number
  serial_numbers: string[]
  operator_name: string
  created_at: string
  remarks?: string | null
}
export interface AccessoryTransferInput {
  accessory_id: number
  from_store_id: number
  to_store_id: number
  quantity: number
  serial_numbers?: string[]
  request_key: string
  remarks?: string
}

/** 供应商商品采购：一条记录对应真实入库整单，独立于销售/剩余库存。 */
export interface AccessoryPurchaseRecord {
  id: number
  /** true为入库时原资料，false为旧单当前档案；不公开内部快照。 */
  has_snapshot: boolean
  batch_no?: string | null
  accessory_id?: number | null
  name?: string | null
  category?: string | null
  brand_name?: string | null
  product_model?: string | null
  color_name?: string | null
  unit?: string | null
  supplier_id?: number | null
  supplier_name?: string | null
  store_id?: number | null
  store_name?: string | null
  quantity?: number | null
  purchase_cost?: number | string | null
  total_amount?: number | string | null
  inventory_time?: string | null
  inventory_operator_name?: string | null
  payment_status?: 'paid' | 'unpaid' | null
  latest_event_id?: number | null
  payment_method?: string | null
  payment_time?: string | null
  payment_operator_name?: string | null
  payment_remarks?: string | null
}
export interface AccessoryPurchaseSummary {
  total: number
  total_quantity?: number | string | null
  total_amount?: number | string | null
  paid_amount?: number | string | null
  unpaid_amount?: number | string | null
}
export interface AccessoryPurchasePaymentEvent {
  id: number
  stock_in_id: number
  action?: 'pay' | 'cancel' | null
  amount?: number | string | null
  reference_event_id?: number | null
  payment_method?: string | null
  payment_time?: string | null
  remarks?: string | null
  operator_name?: string | null
  created_at?: string | null
}
export interface AccessoryPurchasePaymentInput {
  request_key: string
  expected_event_id: number
  payment_method?: string
  payment_time?: string
  remarks?: string
}
export interface AccessoryPurchasePaymentResult {
  id: number
  action: 'pay' | 'cancel'
  amount: number
  replayed: boolean
}

/** 指定原采购单的只读退供核对，不代表已获准退供或已完成退款。 */
export interface AccessoryPurchaseReturnContext {
  purchase: Omit<AccessoryPurchaseRecord, 'payment_method' | 'payment_time' | 'payment_operator_name' | 'payment_remarks'> & {
    paid_amount: number
    unpaid_amount: number
  }
  ledger_status: 'verified' | 'untracked'
  current_quantity: number | null
  data: Pick<AccessoryBatchStock, 'row_key' | 'store_id' | 'store_name' | 'quantity' | 'purchase_cost' | 'usage_type' | 'serial_tracking'>[]
  pagination: import('@/types').PaginatedResponse<never>['pagination']
  /** 原采购、当前授权店内的在库SN；历史无法核对或SN字段无权查看时为null。 */
  serials: Pick<import('@/types').PaginatedResponse<Pick<AccessorySerialRecord, 'id' | 'serial_number' | 'store_id' | 'store_name'>>, 'data' | 'pagination'> | null
}

/** 仅试算原采购退供，不包含资金处理指令或客户端价格。 */
export interface AccessoryPurchaseReturnQuoteInput {
  batches: { row_key: string; quantity: number }[]
  serial_ids: number[]
}
export interface AccessoryPurchaseReturnQuote {
  purchase_id: number
  quantity: number
  purchase_cost: number
  total_amount: number
  payment_status: 'paid' | 'unpaid'
  latest_event_id: number
  preview_only: true
  data: (Pick<AccessoryBatchStock, 'row_key' | 'store_id' | 'store_name' | 'usage_type' | 'serial_tracking'> & {
    quantity: number
    serial_numbers: string[]
  })[]
}
