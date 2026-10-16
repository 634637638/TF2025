import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/types'
import type { GuideAnnouncement, GuideCategory, GuideLink, GuideUnlockResponse, PublicGuideResponse } from '@/types/guide'

export interface GuideAdminResponse {
  announcements: GuideAnnouncement[]
  categories: GuideCategory[]
}

export const guideApi = {
  public: () => unifiedApi.get<PublicGuideResponse>('/public/guide', { useCache: false }),
  unlock: (categoryId: number, password: string) => unifiedApi.post<GuideUnlockResponse>(`/public/guide/categories/${categoryId}/unlock`, { password }, { showLoading: false, useCache: false }),
  category: (categoryId: number, token: string) => unifiedApi.get<GuideCategory>(`/public/guide/categories/${categoryId}`, { headers: { 'X-Guide-Token': token }, showLoading: false, useCache: false }),
  admin: () => unifiedApi.get<GuideAdminResponse>('/guide', { useCache: false }),
  createAnnouncement: (data: Partial<GuideAnnouncement>) => unifiedApi.post<GuideAnnouncement>('/guide/announcements', data),
  updateAnnouncement: (id: number, data: Partial<GuideAnnouncement>) => unifiedApi.put<GuideAnnouncement>(`/guide/announcements/${id}`, data),
  deleteAnnouncement: (id: number) => unifiedApi.delete(`/guide/announcements/${id}`),
  createCategory: (data: Record<string, unknown>) => unifiedApi.post<GuideCategory>('/guide/categories', data),
  updateCategory: (id: number, data: Record<string, unknown>) => unifiedApi.put<GuideCategory>(`/guide/categories/${id}`, data),
  deleteCategory: (id: number) => unifiedApi.delete(`/guide/categories/${id}`),
  createLink: (categoryId: number, data: Record<string, unknown>) => unifiedApi.post<GuideLink>(`/guide/categories/${categoryId}/links`, data),
  updateLink: (id: number, data: Record<string, unknown>) => unifiedApi.put<GuideLink>(`/guide/links/${id}`, data),
  deleteLink: (id: number) => unifiedApi.delete(`/guide/links/${id}`),
  uploadFile: (formData: FormData) => unifiedApi.upload<{ url: string; preview_url: string; name: string; mime: string }>('/guide/upload/file', formData, { showLoading: false })
}

export type GuideApiResponse<T> = ApiResponse<T>
