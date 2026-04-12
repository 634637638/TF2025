/**
 * 剪贴板 Composable
 * 提供统一的复制到剪贴板功能
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'

/**
 * 剪贴板选项
 */
export interface UseClipboardOptions {
  /**
   * 复制成功后的持续时间（毫秒）
   */
  copiedDuration?: number
  /**
   * 是否使用 legacy fallback
   */
  legacy?: boolean
  /**
   * 错误回调
   */
  onError?: (error: Error) => void
  /**
   * 成功回调
   */
  onSuccess?: (text: string) => void
}

/**
 * 剪贴板返回值
 */
export interface UseClipboardReturn {
  /**
   * 是否支持剪贴板API
   */
  isSupported: Ref<boolean>
  /**
   * 复制的内容
   */
  text: Ref<string>
  /**
   * 是否已复制
   */
  copied: Ref<boolean>
  /**
   * 是否正在复制
   */
  copying: Ref<boolean>
  /**
   * 复制到剪贴板
   */
  copy: (text: string) => Promise<void>
  /**
   * 从剪贴板读取
   */
  read: () => Promise<string>
  /**
   * 清空剪贴板
   */
  clear: () => Promise<void>
  /**
   * 获取权限
   */
  requestPermission: () => Promise<boolean>
}

/**
 * 使用剪贴板
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const {
    copiedDuration = 2000,
    legacy = true,
    onError,
    onSuccess
  } = options

  const isSupported = ref(false)
  const text = ref('')
  const copied = ref(false)
  const copying = ref(false)

  let copiedTimer: number | null = null

  // 检查剪贴板API支持
  const checkSupport = () => {
    isSupported.value = !!(navigator.clipboard &&
      (typeof ClipboardItem !== 'undefined' || legacy))
  }

  // 复制成功处理
  const handleSuccess = (content: string) => {
    copied.value = true
    text.value = content
    copying.value = false

    // 重置复制状态
    if (copiedTimer) {
      clearTimeout(copiedTimer)
    }
    copiedTimer = window.setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, copiedDuration)

    onSuccess?.(content)
  }

  // 复制失败处理
  const handleError = (error: Error) => {
    copying.value = false
    onError?.(error)
    logger.error('❌ 复制失败:', error)
  }

  // 使用现代API复制
  const copyWithClipboard = async (content: string): Promise<void> => {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported')
    }

    try {
      await navigator.clipboard.writeText(content)
      handleSuccess(content)
    } catch (error) {
      throw error
    }
  }

  // 使用传统方法复制
  const copyWithLegacy = async (content: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = content
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)

        textarea.select()
        textarea.setSelectionRange(0, content.length)

        const success = document.execCommand('copy')
        document.body.removeChild(textarea)

        if (success) {
          handleSuccess(content)
          resolve()
        } else {
          throw new Error('execCommand copy failed')
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 复制到剪贴板
  const copy = async (content: string): Promise<void> => {
    if (!content) {
      logger.warn('复制内容为空')
      return
    }

    copying.value = true

    try {
      if (isSupported.value && navigator.clipboard) {
        await copyWithClipboard(content)
      } else if (legacy) {
        await copyWithLegacy(content)
      } else {
        throw new Error('剪贴板API不可用且未启用legacy模式')
      }
    } catch (error) {
      handleError(error as Error)
      throw error
    }
  }

  // 从剪贴板读取
  const read = async (): Promise<string> => {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported')
    }

    try {
      const content = await navigator.clipboard.readText()
      text.value = content
      return content
    } catch (error) {
      logger.error('读取剪贴板失败:', error)
      throw error
    }
  }

  // 清空剪贴板
  const clear = async (): Promise<void> => {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported')
    }

    try {
      await navigator.clipboard.writeText('')
      text.value = ''
    } catch (error) {
      logger.error('清空剪贴板失败:', error)
      throw error
    }
  }

  // 请求权限
  const requestPermission = async (): Promise<boolean> => {
    if (!navigator.clipboard || !navigator.permissions) {
      return true // 如果不支持权限API，假设有权限
    }

    try {
      const permission = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })
      return permission.state === 'granted' || permission.state === 'prompt'
    } catch (error) {
      logger.warn('获取剪贴板权限失败:', error)
      return true // 假设有权限
    }
  }

  // 初始化
  checkSupport()

  return {
    isSupported,
    text,
    copied,
    copying,
    copy,
    read,
    clear,
    requestPermission
  }
}

/**
 * 剪贴板工具类
 */
export class ClipboardUtil {
  /**
   * 复制文本
   */
  static async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      logger.error('复制失败:', error)
      return false
    }
  }

  /**
   * 复制HTML内容
   */
  static async copyHtml(html: string): Promise<boolean> {
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html.replace(/<[^>]*>/g, '')], { type: 'text/plain' })
        })
        await navigator.clipboard.write([item])
        return true
      } else {
        throw new Error('ClipboardItem not supported')
      }
    } catch (error) {
      logger.error('复制HTML失败:', error)
      return false
    }
  }

  /**
   * 复制图片
   */
  static async copyImage(imageUrl: string): Promise<boolean> {
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const item = new ClipboardItem({
          [blob.type]: blob
        })
        await navigator.clipboard.write([item])
        return true
      } else {
        throw new Error('ClipboardItem not supported')
      }
    } catch (error) {
      logger.error('复制图片失败:', error)
      return false
    }
  }

  /**
   * 读取文本
   */
  static async read(): Promise<string> {
    try {
      return await navigator.clipboard.readText()
    } catch (error) {
      logger.error('读取剪贴板失败:', error)
      return ''
    }
  }

  /**
   * 检查支持
   */
  static isSupported(): boolean {
    return !!(navigator.clipboard && typeof ClipboardItem !== 'undefined')
  }
}