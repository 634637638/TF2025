/** 客户积分规则；金额计算及余额写入以服务端为准。 */
export type CustomerPointsSource = 'new' | 'used' | 'accessory'

export interface CustomerPointsRedemption {
  enabled: boolean
  points_per_yuan: number | null
  max_percent: number | null
  sources: CustomerPointsSource[]
  all_accessory_categories: boolean
  category_ids: number[]
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
}
