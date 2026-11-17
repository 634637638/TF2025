/** 客户积分规则；金额计算及余额写入以服务端为准。 */
export type CustomerPointsSource = 'new' | 'used' | 'accessory'

export interface CustomerPointsRedemption {
  enabled: boolean
  points_per_yuan: number | null
  max_percent: number | null
  sources: CustomerPointsSource[]
  all_accessory_categories: boolean
  category_ids: number[]
  /** 未提供时兼容旧的按类型规则；新设置保存具体商品ID。 */
  accessory_ids?: number[]
}

export interface CustomerPointsConfig {
  enabled: boolean
  amount_per_point: number
  include_new: boolean
  include_used: boolean
  include_accessories: boolean
  new_points_per_100: number
  used_points_per_100: number
  accessory_points_per_100: number
  redemption: CustomerPointsRedemption
}

export interface CustomerPointsSettingsData {
  config: CustomerPointsConfig
  categories: { id: number; name: string; status: number }[]
  products?: CustomerPointsProduct[]
}

/** 积分设置使用的商品最小档案，排除采购和库存资料。 */
export interface CustomerPointsProduct {
  id: number
  name: string
  category_id: number
  product_model: string | null
  brand_name: string | null
  color_name: string | null
  status: number
}
