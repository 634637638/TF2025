/**
 * 友好版权限提示指令
 * 在权限不足时显示友好的提示消息
 */

import type { Directive, DirectiveBinding } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } from '@/utils/permissionToastSimple'
import logger from '@/utils/logger'

type PermissionTipElement = HTMLElement & {
  _permissionClickHandler?: EventListener
  _permissionTipCleanup?: () => void
}

/**
 * 权限指令配置
 */
interface PermissionTipBinding {
  /** 权限字符串 */
  permission: string
  /** 模块名称 */
  moduleName: string
  /** 操作类型 */
  action?: 'view' | 'create' | 'edit' | 'delete'
  /** 是否阻止点击事件 */
  preventClick?: boolean
}

/**
 * 简化版权限检查
 */
function hasPermission(permission: string): boolean {
  try {
    const authStore = useAuthStore()
    return authStore.hasPermission(permission)
  } catch (error) {
    logger.error('权限检查失败', error)
    return false
  }
}

function applyPermissionTipState(el: PermissionTipElement, options: PermissionTipBinding) {
  const { permission, moduleName = '此功能', action, preventClick = true } = options
  const isAllowed = hasPermission(permission)

  if (el._permissionClickHandler) {
    el.removeEventListener('click', el._permissionClickHandler)
    delete el._permissionClickHandler
  }

  if (!isAllowed) {
    el.style.opacity = '0.5'
    el.style.cursor = 'not-allowed'
    el.setAttribute('disabled', 'true')
    el.setAttribute('aria-disabled', 'true')
    el.classList.add('permission-restricted')

    if (preventClick) {
      const clickHandler = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()

        switch (action) {
          case 'create':
            showCreateDenied(moduleName, permission)
            break
          case 'edit':
            showEditDenied(moduleName, permission)
            break
          case 'delete':
            showDeleteDenied(moduleName, permission)
            break
          default:
            showViewDenied(moduleName, permission)
        }
      }

      el.addEventListener('click', clickHandler)
      el._permissionClickHandler = clickHandler
    }

    return
  }

  el.style.opacity = '1'
  el.style.cursor = ''
  el.removeAttribute('disabled')
  el.removeAttribute('aria-disabled')
  el.classList.remove('permission-restricted')
}

function bindPermissionTipEvents(el: PermissionTipElement, options: PermissionTipBinding) {
  const refresh = () => applyPermissionTipState(el, options)
  const events = [
    'tf2025:permissions:updated',
    'tf2025:auth:login',
    'tf2025:auth:refresh',
    'tf2025:auth:logout'
  ]

  el._permissionTipCleanup?.()
  events.forEach(eventName => window.addEventListener(eventName, refresh))
  el._permissionTipCleanup = () => {
    events.forEach(eventName => window.removeEventListener(eventName, refresh))
  }
}

/**
 * v-permission-tip 指令
 * 权限不足时显示友好提示并阻止操作
 */
export const vPermissionTip: Directive<HTMLElement, PermissionTipBinding | string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionTipBinding | string>) {
    const options = typeof binding.value === 'string'
      ? { permission: binding.value, moduleName: '此功能' }
      : binding.value

    const { permission, moduleName = '此功能', action, preventClick = true } = options

    if (!permission) {
      logger.warn('v-permission-tip: 需要提供 permission 参数')
      return
    }

    applyPermissionTipState(el as PermissionTipElement, { permission, moduleName, action, preventClick })
    bindPermissionTipEvents(el as PermissionTipElement, { permission, moduleName, action, preventClick })
  },

  updated(el: HTMLElement, binding: DirectiveBinding<PermissionTipBinding | string>) {
    const options = typeof binding.value === 'string'
      ? { permission: binding.value, moduleName: '此功能' }
      : binding.value

    const { permission } = options
    if (!permission) return

    applyPermissionTipState(el as PermissionTipElement, options)
    bindPermissionTipEvents(el as PermissionTipElement, options)
  },

  unmounted(el: HTMLElement) {
    // 移除事件监听器
    const permissionEl = el as PermissionTipElement
    if (permissionEl._permissionClickHandler) {
      permissionEl.removeEventListener('click', permissionEl._permissionClickHandler)
      delete permissionEl._permissionClickHandler
    }
    permissionEl._permissionTipCleanup?.()

    // 清理样式
    el.style.opacity = '1'
    el.style.cursor = ''
    el.classList.remove('permission-restricted')
  }
}

/**
 * 注册权限提示指令
 */
export function setupPermissionTipDirective(app: any) {
  app.directive('permission-tip', vPermissionTip)
}

export default vPermissionTip
