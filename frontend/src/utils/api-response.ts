/**
 * 统一API响应处理工具
 * 解决 .data.data 分散处理问题
 */

import type { ApiResponse } from '@/types'

/**
 * 从API响应中提取数据
 * 兼容多种响应格式：
 * 1. { success, message, data: [...] } - 标准格式
 * 2. { data: { success, data: [...] } } - 双层嵌套格式
 * 3. { data: [...] } - 直接格式
 * 4. { data: { colors: [...] } } 或 { data: { memories: [...] } } - 对象包装数组格式
 * 5. [...] - 数组直接返回
 * @param response API响应
 * @returns 响应数据
 */
export function extractResponseData<T = any>(response: any): T {
  // 空响应
  if (!response) {
    return [] as T
  }

  // 数组直接返回
  if (Array.isArray(response)) {
    return response as T
  }

  // 标准格式 { success, message, data }
  if ('data' in response) {
    const innerData = response.data

    // 双层嵌套: { data: { success, data: [...] } }
    if (innerData && typeof innerData === 'object' && !Array.isArray(innerData) && 'data' in innerData) {
      return innerData.data as T
    }

    // 对象包装数组格式: { data: { colors: [...] } } 或 { data: { memories: [...] } }
    if (innerData && typeof innerData === 'object' && !Array.isArray(innerData)) {
      // 常见的包装字段名
      const arrayKeys = ['colors', 'memories', 'brands', 'models', 'stores', 'phones', 'data']
      for (const key of arrayKeys) {
        if (Array.isArray(innerData[key])) {
          return innerData[key] as T
        }
      }
    }

    // 单层: { data: [...] }
    return innerData as T
  }

  // 直接数据
  return response as T
}

/**
 * 检查响应是否成功
 */
export function isResponseSuccess(response: any): boolean {
  if (!response) return false
  return response.success === true || response.success === undefined
}

/**
 * 获取响应消息
 */
export function getResponseMessage(response: any, defaultMessage = ''): string {
  if (!response) return defaultMessage
  return response.message || defaultMessage
}

/**
 * 创建响应提取函数
 * 用于在API调用后统一处理响应
 * @param fallback 空数据时的默认值
 */
export function createResponseExtractor<T>(fallback: T) {
  return (response: any): T => {
    const data = extractResponseData<T>(response)
    if (data === undefined || data === null) {
      return fallback
    }
    return data
  }
}

/**
 * 统一的数据提取器集合
 */
export const responseExtractors = {
  // 提取数组数据（默认空数组）
  list: <T>() => createResponseExtractor<T[]>([]),

  // 提取单个对象（默认null）
  item: <T>() => createResponseExtractor<T | null>(null),

  // 提取分页数据
  paginated: <T>() => createResponseExtractor<ApiResponse<T>>({
    success: false,
    message: '',
    data: undefined,
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
  }),

  // 提取统计/总数数据
  stats: <T>() => createResponseExtractor<T>({} as T)
}
