/**
 * 确认对话框 Composable
 * 统一复用 notification-simple，避免多套确认框实现并存
 */

import type { ConfirmDialogConfig } from '../types'
import { simpleNotification } from '@/services/notification-simple'

/**
 * 使用确认对话框
 * @param config 默认配置
 */
export function useConfirm(config: Partial<ConfirmDialogConfig> = {}) {
  const defaultConfig: ConfirmDialogConfig = {
    message: '',
    type: 'warning',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true
  }

  const finalConfig = { ...defaultConfig, ...config }

  /**
   * 显示确认对话框
   * @param customConfig 自定义配置
   */
  const confirm = (customConfig?: Partial<ConfirmDialogConfig>): Promise<boolean> => {
    const mergedConfig = { ...finalConfig, ...customConfig }

    return simpleNotification.confirm(
      mergedConfig.message,
      mergedConfig.title || '确认',
      {
        type: mergedConfig.type,
        confirmButtonText: mergedConfig.confirmText,
        cancelButtonText: mergedConfig.cancelText
      }
    )
  }

  /**
   * 删除确认
   * @param itemName 删除项名称
   * @param title 自定义标题
   */
  const confirmDelete = (itemName: string, title?: string): Promise<boolean> => {
    return confirm({
      title: title || '删除确认',
      message: `确定要删除 "${itemName}" 吗？此操作不可恢复。`,
      type: 'warning',
      confirmText: '删除',
      cancelText: '取消'
    })
  }

  return {
    confirm,
    confirmDelete
  }
}

/**
 * 全局确认对话框实例
 */
const globalConfirm = useConfirm()

/**
 * 便捷的全局确认函数
 */
export const confirm = globalConfirm.confirm
export const confirmDelete = globalConfirm.confirmDelete
