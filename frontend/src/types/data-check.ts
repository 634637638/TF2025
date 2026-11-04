export type DataCheckKey = 'brands' | 'models' | 'colors' | 'memories' | 'suppliers' | 'stores' | 'customers' | 'users'

export interface DataCheckItem {
  key: DataCheckKey
  label: string
  icon: string
  total: number
  duplicate_count: number
}

export interface DataCheckRecord {
  id: number
  name?: string | null
  username?: string | null
  phone?: string | null
  size?: string | null
  capacity?: string | null
  brand_name?: string | null
  customer_type?: string | null
  vip_level?: string | number | null
  status?: number | string | null
  is_duplicate?: boolean
  duplicate_count?: number
  [key: string]: unknown
}

export interface DataDuplicateGroup {
  key: string
  field?: string
  primary: DataCheckRecord
  duplicates: DataCheckRecord[]
  count: number
  is_duplicate_rows?: boolean
}

export interface DataCheckResult {
  total: number
  duplicate_groups: number
  duplicates: DataDuplicateGroup[]
  [key: string]: unknown
}

export interface DataCheckAllResponse {
  is_empty?: boolean
  total: number
  duplicate_count: number
  data: DataCheckRecord[]
}

export interface DataCheckStatistics {
  [key: string]: number | string | undefined
}

export interface DataCleanupResult {
  success?: boolean
  cleaned?: number
  remainingGroups?: number
  message?: string
}
