/**
 * Logo URL 工具函数
 * 统一处理 Logo URL 的构建逻辑，确保所有组件使用相同的规则
 */

import { formatImageUrl } from './format'
import { logger } from '@/utils/logger'

/**
 * 构建 Logo 的完整 URL
 * @param rawUrl 原始 URL（相对路径或完整 URL）
 * @returns 完整的可访问 URL
 */
export function buildLogoUrl(rawUrl: string): string {
  if (!rawUrl) return ''

  // 使用统一的图片URL处理函数
  return formatImageUrl(rawUrl)
}

/**
 * 测试 Logo 文件是否可访问
 * @param url Logo URL
 * @returns Promise<boolean> 是否可访问
 */
export async function testLogoAccess(url: string): Promise<boolean> {
  if (!url) return false

  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    logger.warn('Logo 访问测试失败:', error)
    return false
  }
}

/**
 * 获取 Logo 文件大小（通过 HEAD 请求）
 * @param url Logo URL
 * @returns Promise<number> 文件大小（字节），无法获取则返回 0
 */
export async function getLogoFileSize(url: string): Promise<number> {
  if (!url) return 0

  try {
    const response = await fetch(url, { method: 'HEAD' })
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : 0
  } catch (error) {
    logger.warn('获取 Logo 文件大小失败:', error)
    return 0
  }
}

/**
 * 格式化文件大小显示
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '未知'

  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`
  }

  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}