import type { PriceListRow } from '@/types/price-list'

/** 管理端列表保留后端渠道计算结果，仅归一化显示字段，不在前端重复加价。 */
export const normalizePriceListRow = (item: PriceListRow): PriceListRow => ({
  brand_id: item.brand_id ?? null,
  model_id: item.model_id ?? null,
  color_id: item.color_id ?? null,
  memory_id: item.memory_id ?? null,
  brand_name: item.brand_name || '',
  model_number: item.model_number || '',
  external_model: item.external_model || '',
  color_name: item.color_name || '',
  memory: item.memory || '',
  wholesale_price: item.wholesale_price !== null && item.wholesale_price !== undefined ? Number(item.wholesale_price) : null,
  retail_price: item.retail_price !== null && item.retail_price !== undefined ? Number(item.retail_price) : null,
  sales_display_price: item.sales_display_price !== null && item.sales_display_price !== undefined ? Number(item.sales_display_price) : null,
  wholesale_display_price: item.wholesale_display_price !== null && item.wholesale_display_price !== undefined ? Number(item.wholesale_display_price) : null,
  stock_quantity: Number(item.stock_quantity) || 0,
  last_sync_time: item.last_sync_time || null,
  is_collect: item.is_collect !== undefined ? Number(item.is_collect) : 1,
  status: item.status !== undefined ? Number(item.status) : 1,
  show_price: item.show_price !== null && item.show_price !== undefined ? Number(item.show_price) : 0,
  source_config_id: item.source_config_id !== null && item.source_config_id !== undefined ? Number(item.source_config_id) : null,
  source_name: item.source_name || '默认来源',
  source_type: item.source_type === 'public' ? 'public' : 'account',
  source_login_username: item.source_login_username || '',
  id: item.price_list_id || item.id || null,
  price_list_id: item.price_list_id || item.id || null
})
