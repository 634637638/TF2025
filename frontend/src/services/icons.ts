import { unifiedApi } from '@/utils/unified-api'
import type { CacheIconPayload, IconPreview, IconRecord } from '@/types/icon'

// 只合并正在进行的精确读取，不持久缓存旧 SVG；删除、更换图标后下次读取仍以数据库为准。
const pending = new Map<string, Promise<IconRecord | null>>()

export const iconService = {
  list(params: { limit?: number; page?: number; category?: string; search?: string } = {}, signal?: AbortSignal) {
    return unifiedApi.get<IconRecord[]>('/icons', { params, signal, showError: false, showLoading: false })
  },

  categories() {
    return unifiedApi.get<string[]>('/icons/categories', { showError: false })
  },

  searchOnline(query: string, signal?: AbortSignal) {
    return unifiedApi.get<IconRecord[]>('/icons/search/online', { params: { query, limit: 100 }, signal, showError: false, showLoading: false })
  },

  preview(names: string[], signal?: AbortSignal) {
    return unifiedApi.get<IconPreview[]>('/icons/preview', {
      params: { names: names.join(',') }, signal, timeout: 65000, useCache: false, showError: false, showLoading: false
    })
  },

  remove(id: number | string) {
    return unifiedApi.delete<IconRecord>(`/icons/${encodeURIComponent(id)}`)
  },

  byClass(iconClass: string): Promise<IconRecord | null> {
    const normalized = iconClass.trim()
    if (!normalized) return Promise.resolve(null)
    const current = pending.get(normalized)
    if (current) return current
    const request = unifiedApi.get<IconRecord>('/icons/by-class', {
      params: { class: normalized, optional: '1' }, showError: false, showLoading: false, useCache: false
    }).then(response => response.success ? response.data || null : null)
      .finally(() => pending.delete(normalized))
    pending.set(normalized, request)
    return request
  },

  async cache(payload: CacheIconPayload): Promise<IconRecord> {
    const response = await unifiedApi.post<IconRecord>('/icons/cache', payload, {
      showError: false, loadingText: '正在保存图标...'
    })
    const icon = response.data
    if (!response.success || !icon || icon.class !== payload.class
      || icon.is_valid === 0 || !/^<svg[\s>]/i.test(String(icon.svg || '').trim())) {
      throw new Error('图标未成功保存，请重试')
    }
    return icon
  }
}
