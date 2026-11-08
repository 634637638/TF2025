'use strict'

const PREORDER_CORE_FIELDS = [
  'id', 'customer_id', 'store_id', 'brand_id', 'model_id', 'color_id', 'memory_id',
  'is_new', 'expected_arrival', 'total_price', 'actual_price',
  'deposit_amount', 'deposit_paid', 'status', 'remarks', 'created_by',
  'matched_phone_id', 'imei', 'matched_time', 'created_at', 'updated_at'
]

const PREORDER_RESPONSE_FIELDS = [
  ...PREORDER_CORE_FIELDS,
  'preorder_number', 'operator_id', 'actual_model', 'arrival_date',
  'cancelled_at', 'cancel_reason', 'delivered_time', 'sale_id'
]

const PREORDER_STATUS_LABELS = {
  pending: '待匹配',
  arrived: '已匹配',
  completed: '已交付',
  cancelled: '已取消'
}

const PREORDER_STATUS = {
  PENDING: 'pending',
  MATCHED: 'arrived',
  DELIVERED: 'completed',
  CANCELLED: 'cancelled'
}

module.exports = { PREORDER_CORE_FIELDS, PREORDER_RESPONSE_FIELDS, PREORDER_STATUS, PREORDER_STATUS_LABELS }
