/**
 * API 权限错误处理工具
 * 统一处理API请求中的权限错误，显示友好的提示
 */

import { AxiosError } from 'axios'
import { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } from './permissionToastSimple'
import logger from './logger'

/**
 * API 错误响应类型
 */
interface ApiErrorResponse {
  response?: {
    status?: number
    data?: {
      code?: string
      message?: string
    }
  }
  config?: {
    method?: string
    url?: string
  }
}

/**
 * 操作类型推断
 */
function inferOperationFromUrl(url: string): 'view' | 'create' | 'edit' | 'delete' {
  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('delete') || lowerUrl.includes('/remove')) {
    return 'delete'
  }
  if (lowerUrl.includes('edit') || lowerUrl.includes('update') || lowerUrl.includes('modify')) {
    return 'edit'
  }
  if (lowerUrl.includes('create') || lowerUrl.includes('add') || lowerUrl.includes('save')) {
    return 'create'
  }

  return 'view'
}

/**
 * 从 URL 推断模块名称
 */
function inferModuleNameFromUrl(url: string): string {
  // 提取路径中的模块部分
  const matches = url.match(/\/api\/(\w+)/)
  if (matches && matches[1]) {
    const moduleMap: Record<string, string> = {
      'stores': '店铺管理',
      'users': '用户管理',
      'products': '商品管理',
      'orders': '订单管理',
      'customers': '客户管理',
      'suppliers': '供应商管理',
      'inventory': '库存管理',
      'sales': '销售管理',
      'brands': '品牌管理',
      'models': '型号管理',
      'colors': '颜色管理',
      'employees': '员工管理',
      'attendance': '考勤管理',
      'salary': '工资管理',
      'permissions': '权限管理',
      'menu': '菜单管理',
      'price-list': '价目表管理',
      'subsidy': '国补管理',
      'analytics': '数据分析'
    }
    return moduleMap[matches[1]] || '此功能'
  }

  return '此功能'
}

/**
 * 处理 API 权限错误
 * @param error 错误对象
 * @param moduleName 模块名称（可选，如果不提供会从 URL 推断）
 * @param operation 操作类型（可选，如果不提供会从 URL 推断）
 */
export function handlePermissionError(
  error: ApiErrorResponse | AxiosError,
  moduleName?: string,
  operation?: 'view' | 'create' | 'edit' | 'delete'
): boolean {
  // 检查是否是权限错误（403状态码）
  const status = error.response?.status
  if (status !== 403) {
    return false // 不是权限错误
  }

  // 推断操作类型和模块名称
  const inferredOperation = operation || inferOperationFromUrl(error.config?.url || '')
  const inferredModuleName = moduleName || inferModuleNameFromUrl(error.config?.url || '')

  // 根据操作类型显示相应的提示
  switch (inferredOperation) {
    case 'create':
      showCreateDenied(inferredModuleName)
      break
    case 'edit':
      showEditDenied(inferredModuleName)
      break
    case 'delete':
      showDeleteDenied(inferredModuleName)
      break
    default:
      showViewDenied(inferredModuleName)
  }

  return true // 已处理权限错误
}

/**
 * 增强的 API 错误处理
 * 自动检测权限错误并显示友好提示
 * @param error 错误对象
 * @param defaultMessage 默认错误消息（非权限错误时使用）
 * @param moduleName 模块名称（可选）
 * @param operation 操作类型（可选）
 */
export function handleApiErrorWithPermission(
  error: any,
  defaultMessage: string = '操作失败',
  moduleName?: string,
  operation?: 'view' | 'create' | 'edit' | 'delete'
): void {
  // 首先尝试处理为权限错误
  const isPermissionError = handlePermissionError(error, moduleName, operation)

  // 如果不是权限错误，显示默认错误消息
  if (!isPermissionError) {
    const message = error.response?.data?.message || error.message || defaultMessage
    logger.error('API 错误', message)
    // 这里可以调用其他错误显示方法
    // showError(message)
  }
}

/**
 * 检查响应是否是权限错误
 */
export function isPermissionError(error: any): boolean {
  return error.response?.status === 403 ||
         error.response?.data?.code === 'INSUFFICIENT_PERMISSIONS' ||
         error.response?.data?.code === 'AUTH_ERROR'
}

export default {
  handlePermissionError,
  handleApiErrorWithPermission,
  isPermissionError
}
