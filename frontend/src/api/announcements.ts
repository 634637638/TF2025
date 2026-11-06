import { unifiedApi } from '@/utils/unified-api'
import type { SiteAnnouncement } from '@/types'

export interface SiteAnnouncementInput {
  title: string
  content: string
  isPublished: boolean
  isPinned: boolean
  expiresAt: string | null
}

export const announcementsApi = {
  listPublished: () => unifiedApi.get<SiteAnnouncement[]>('/system/announcements', { showLoading: false }),
  listForManagement: () => unifiedApi.get<SiteAnnouncement[]>('/system/announcements/admin', { showLoading: false }),
  create: (input: SiteAnnouncementInput) => unifiedApi.post<SiteAnnouncement>('/system/announcements', input, { showLoading: false }),
  update: (id: number, input: SiteAnnouncementInput) => unifiedApi.put<SiteAnnouncement>(`/system/announcements/${id}`, input, { showLoading: false }),
  uploadMedia: (form: FormData) => unifiedApi.upload<{ url: string; name: string; mime: string }>('/content-media', form, { showLoading: false, showError: false }),
  remove: (id: number) => unifiedApi.delete(`/system/announcements/${id}`, { showLoading: false })
}
