/**
 * 系统配置 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

export interface SystemSetting {
  key: string
  value: any
  type?: 'string' | 'number' | 'boolean' | 'json'
  description?: string
  category?: string
}

export const systemSettingsApi = {
  /**
   * 获取所有配置
   */
  getAllSettings: () => {
    return unifiedApi.get('/system-settings')
  },

  /**
   * 根据分类获取配置
   */
  getSettingsByCategory: (category: string) => {
    return unifiedApi.get(`/system-settings/category/${category}`)
  },

  /**
   * 获取单个配置
   */
  getSettingByKey: (key: string) => {
    return unifiedApi.get(`/system-settings/${key}`)
  },

  /**
   * 更新配置
   */
  updateSetting: (key: string, value: any, type?: string) => {
    return unifiedApi.put(`/system-settings/${key}`, { value, type })
  },

  /**
   * 批量更新配置
   */
  batchUpdateSettings: (settings: SystemSetting[]) => {
    return unifiedApi.post('/system-settings/batch', { settings })
  },

  /**
   * 删除配置
   */
  deleteSetting: (key: string) => {
    return unifiedApi.delete(`/system-settings/${key}`)
  },

  /**
   * 获取考勤相关配置
   */
  getAttendanceSettings: () => {
    return unifiedApi.get('/system-settings/attendance/config')
  }
}
