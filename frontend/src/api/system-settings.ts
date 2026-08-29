/**
 * 系统配置 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

export interface SystemSetting {
  key: string
  value: unknown
  type?: 'string' | 'number' | 'boolean' | 'json'
  description?: string
  category?: string
}

export interface MarketingGenerationConfig {
  enabled: boolean
  provider: 'ollama' | 'localai' | 'openai_compatible' | 'custom'
  endpoint: string
  model: string
  apiKey?: string
  hasApiKey?: boolean
  timeoutMs: number
  temperature: number
  maxTokens: number
  systemPrompt: string
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
  updateSetting: (key: string, value: unknown, type?: string) => {
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
  },

  /**
   * 获取营销词库配置（后台）
   */
  getMarketingLexicon: () => {
    return unifiedApi.get('/system-settings/marketing_lexicon')
  },

  /**
   * 保存营销词库配置（后台）
   */
  saveMarketingLexicon: (value: {
    subsidyEnabled?: boolean
    colorEnabled?: boolean
    weatherEnabled?: boolean
    solarTermEnabled?: boolean
    modeLexicon?: Record<string, {
      lines: string[]
      nightLines?: string[]
      salesTalks?: string[]
    }>
    typeLexicon?: Record<string, { lines: string[] }>
    contextLexicon?: {
      holiday?: string[] | Record<string, string[]>
      solarTerm?: string[] | Record<string, string[]>
      weather?: string[] | Record<string, string[]>
      timeSegment?: Record<string, string[]>
      color?: string[] | Record<string, string[]>
      subsidy?: string[] | Record<string, string[]>
    }
    eventLexicon?: {
      solarTerms?: Record<string, string[]>
      traditionalHolidays?: Record<string, string[]>
      historicalDays?: Record<string, string[]>
    }
    updatedAt?: string
  }) => {
    return unifiedApi.put('/system-settings/marketing_lexicon', {
      value,
      type: 'json'
    })
  },

  /**
   * 获取在线生成接口配置（后台）
   */
  getMarketingGenerationConfig: () => {
    return unifiedApi.get('/system-settings/marketing_generation_config')
  },

  /**
   * 保存在线生成接口配置（后台）
   */
  saveMarketingGenerationConfig: (value: MarketingGenerationConfig) => {
    return unifiedApi.put('/system-settings/marketing_generation_config', {
      value,
      type: 'json'
    })
  }
}
