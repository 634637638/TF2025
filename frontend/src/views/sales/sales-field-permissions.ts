const salesFieldMap: Record<string, string> = {
  stats_available_inventory: 'stats.available_inventory',
  stats_today_sales: 'stats.today_sales',
  stats_inventory_value: 'stats.inventory_value',
  stats_avg_profit_margin: 'stats.avg_profit_margin',
  supplier_id: 'sale.supplier_id',
  supplier_name: 'sale.supplier_id',
  store_id: 'sale.store_id',
  store_name: 'sale.store_id',
  brand: 'sale.brand',
  model: 'sale.model',
  color: 'sale.color',
  memory: 'sale.memory',
  serial_number: 'sale.serial_number',
  imei: 'sale.imei',
  purchase_cost: 'sale.purchase_cost',
  sale_price: 'sale.sale_price',
  sale_time: 'sale.sale_time',
  payment_method: 'sale.payment_method',
  transaction_no: 'sale.transaction_no',
  operator_id: 'sale.operator_id',
  inventory_operator_name: 'sale.operator_id',
  is_new: 'sale.condition',
  condition: 'sale.condition',
  status: 'sale.condition',
  inventory_time: 'sale.inventory_time',
  remarks: 'sale.remarks',
  customer_name: 'sale.customer_name',
  customer_phone: 'sale.customer_phone',
  customer_apple_id: 'sale.customer_apple_id',
  apple_id: 'sale.customer_apple_id',
  actions: 'system_info.operations'
}

export const getSalesFieldKey = (fieldName: string): string => {
  return salesFieldMap[fieldName] || fieldName
}
