/** 图标目录及在线候选的唯一业务契约。 */
export interface IconRecord {
  id?: number | string
  class: string
  name: string
  category: string
  description?: string | null
  tags?: string | null
  svg?: string | null
  iconify_name?: string | null
  iconifyName?: string
  source?: 'local' | 'online' | 'iconify'
  is_valid?: number | null
}

export interface CacheIconPayload {
  class: string
  name: string
  category: string
  description?: string | null
  tags?: string | null
  iconifyName?: string
  svg?: string | null
}

export interface IconPreview {
  class: string
  svg: string | null
}
