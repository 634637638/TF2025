import { unifiedApi } from '@/utils/unified-api'
import { baseDataApi } from './base-data'

/**
 * 手机库存预警配置 API
 */

// 获取所有预警配置
export const getAllConfigs = () => {
  return unifiedApi.get('/phone-stock-warnings/configs')
}

// 获取预警阈值
export const getWarningThreshold = (brandId: number, modelId?: number) => {
  return unifiedApi.get('/phone-stock-warnings/threshold', {
    params: { brand_id: brandId, model_id: modelId }
  })
}

// 创建预警配置
export const createConfig = (data: any) => {
  return unifiedApi.post('/phone-stock-warnings/configs', data)
}

// 更新预警配置
export const updateConfig = (id: number, data: any) => {
  return unifiedApi.put(`/phone-stock-warnings/configs/${id}`, data)
}

// 删除预警配置
export const deleteConfig = (id: number) => {
  return unifiedApi.delete(`/phone-stock-warnings/configs/${id}`)
}

// 切换预警开关
export const toggleWarning = (id: number, enabled: boolean) => {
  return unifiedApi.patch(`/phone-stock-warnings/configs/${id}/toggle`, { enabled })
}

export default {
  getAllConfigs,
  getWarningThreshold,
  createConfig,
  updateConfig,
  deleteConfig,
  toggleWarning,
  ...baseDataApi
}
