export type GuideLinkType = 'url' | 'file'
export type GuideAccessMode = 'public' | 'password'
export type GuidePasswordPolicy = 'once' | 'day' | 'days' | 'month' | 'quarter' | 'year' | 'permanent'

export interface GuideAnnouncement {
  id: number
  title: string
  content: string
  link_url: string | null
  is_pinned: boolean
  is_enabled: boolean
  sort_order: number
  starts_at?: string | null
  ends_at?: string | null
}

export interface GuideLink {
  id: number
  category_id: number
  title: string
  description: string
  url: string | null
  link_type: GuideLinkType
  icon: string | null
  file_url: string | null
  file_expires_at: number | null
  file_signature: string | null
  file_name: string | null
  file_mime: string | null
  is_enabled: boolean
  sort_order: number
}

export interface GuideCategory {
  id: number
  parent_id: number | null
  name: string
  description: string
  icon: string
  sort_order: number
  is_enabled: boolean
  access_mode: GuideAccessMode
  locked: boolean
  password_policy?: GuidePasswordPolicy | null
  password_expires_days?: number | null
  links: GuideLink[]
  children: GuideCategory[]
}

export interface PublicGuideResponse {
  announcements: GuideAnnouncement[]
  settings: GuideSettings
  categories: GuideCategory[]
}

export interface GuideSettings {
  id?: number
  site_title: string
  site_eyebrow: string
  footer_text: string
  contact_wechat: string | null
  contact_phone: string | null
  updated_at?: string
}

export interface GuideUnlockResponse {
  category: GuideCategory
  access_token: string | null
}

