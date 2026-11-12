import { afterEach, describe, expect, it, vi } from 'vitest'
import { iconService } from '@/services/icons'
import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse } from '@/types'
import type { IconRecord } from '@/types/icon'

vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => vi.resetAllMocks())

describe('公共图标服务', () => {
  it('在线搜索和批量预览通过统一站内 GET 并传递取消信号', async () => {
    vi.mocked(unifiedApi.get).mockResolvedValue({ success: true, message: '', data: [] })
    const controller = new AbortController()
    await iconService.searchOnline('phone', controller.signal)
    await iconService.preview(['lucide:phone', 'mdi:phone'], controller.signal)
    expect(unifiedApi.get).toHaveBeenNthCalledWith(1, '/icons/search/online', expect.objectContaining({ signal: controller.signal, params: { query: 'phone', limit: 100 } }))
    expect(unifiedApi.get).toHaveBeenNthCalledWith(2, '/icons/preview', expect.objectContaining({ signal: controller.signal, params: { names: 'lucide:phone,mdi:phone' }, showLoading: false, useCache: false }))
  })
  it('同一图标并发读取只请求一次，失败后可以重新读取', async () => {
    let reject: (reason: Error) => void = () => { throw new Error('未请求') }
    vi.mocked(unifiedApi.get).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    const first = iconService.byClass(' iconify lucide:home ')
    const second = iconService.byClass('iconify lucide:home')
    expect(first).toBe(second)
    const failed = expect(first).rejects.toThrow('offline')
    reject(new Error('offline'))
    await failed
    vi.mocked(unifiedApi.get).mockResolvedValueOnce({ success: true, message: '', data: null })
    expect(await iconService.byClass('iconify lucide:home')).toBeNull()
    expect(unifiedApi.get).toHaveBeenCalledTimes(2)
    expect(unifiedApi.get).toHaveBeenCalledWith('/icons/by-class', expect.objectContaining({ params: { class: 'iconify lucide:home', optional: '1' }, useCache: false }))
  })

  it('只有保存成功、class 匹配且 SVG 有效时才返回选中数据', async () => {
    const icon: IconRecord = { class: 'iconify lucide:home', name: '首页', category: 'menu', svg: '<svg></svg>', is_valid: 1 }
    for (const response of [
      { success: false, data: icon },
      { success: true, data: { ...icon, svg: null } },
      { success: true, data: { ...icon, is_valid: 0 } },
      { success: true, data: { ...icon, class: 'iconify lucide:wrong' } }
    ]) {
      vi.mocked(unifiedApi.post).mockResolvedValueOnce({ message: '', ...response })
      await expect(iconService.cache(icon)).rejects.toThrow('未成功保存')
    }
    const response: ApiResponse<IconRecord> = { success: true, message: '', data: icon }
    vi.mocked(unifiedApi.post).mockResolvedValueOnce(response)
    expect(await iconService.cache(icon)).toEqual(icon)
  })
})
