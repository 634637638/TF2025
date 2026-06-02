/**
 * 简化的权限提示服务
 * 提供友好的权限不足提示
 */

import { showElementWarning } from '@/utils/element-feedback'

/**
 * 权限提示类型
 */
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import'

/**
 * 权限提示配置
 */
export interface PermissionToastOptions {
  /** 模块名称 */
  moduleName: string
  /** 操作类型 */
  action?: PermissionAction
  /** 权限代码 */
  permissionCode?: string
  /** 是否显示详细信息 */
  showDetails?: boolean
  /** 自定义消息 */
  message?: string
}

/**
 * 操作类型名称映射
 */
const ACTION_NAMES: Record<PermissionAction, string> = {
  view: '查看',
  create: '创建',
  edit: '编辑',
  delete: '删除',
  export: '导出',
  import: '导入'
}

/**
 * 显示权限不足提示
 */
export function showPermissionDenied(options: PermissionToastOptions) {
  const {
    action = 'view',
    message
  } = options

  const actionName = ACTION_NAMES[action] || '操作'
  const defaultMessage = action === 'view'
    ? '您没有访问此页面的权限'
    : `您没有${actionName}权限`

  // 使用友好的消息提示
  showElementWarning({
    message: message || defaultMessage,
    duration: 3000,
    showClose: true
  })
}

/**
 * 快捷方法：显示查看权限不足
 */
export function showViewDenied(moduleName: string, permissionCode?: string) {
  showPermissionDenied({ moduleName, action: 'view', permissionCode })
}

/**
 * 快捷方法：显示编辑权限不足
 */
export function showEditDenied(moduleName: string, permissionCode?: string) {
  showPermissionDenied({ moduleName, action: 'edit', permissionCode })
}

/**
 * 快捷方法：显示删除权限不足
 */
export function showDeleteDenied(moduleName: string, permissionCode?: string) {
  showPermissionDenied({ moduleName, action: 'delete', permissionCode })
}

/**
 * 快捷方法：显示创建权限不足
 */
export function showCreateDenied(moduleName: string, permissionCode?: string) {
  showPermissionDenied({ moduleName, action: 'create', permissionCode })
}

/**
 * 权限提示 Composable
 */
export function usePermissionToast() {
  return {
    showViewDenied,
    showEditDenied,
    showDeleteDenied,
    showCreateDenied,
    showPermissionDenied
  }
}

export default {
  showPermissionDenied,
  showViewDenied,
  showEditDenied,
  showDeleteDenied,
  showCreateDenied,
  usePermissionToast
}
