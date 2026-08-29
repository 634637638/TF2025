/**
 * 权限控制指令
 * 提供 v-permission 和 v-permission-not 指令。
 * 字段权限统一由 useFieldPermissions 读取 /permissions/user-field-permissions。
 */

import { useAuthStore } from '@/stores/auth'
import { PermissionUtils } from '@/utils/permissionMapper'
import type { App, Directive, DirectiveBinding } from 'vue'

interface PermissionBinding {
  permission: string | string[]
  mode?: 'any' | 'all'
}

type PermissionDirectiveValue = PermissionBinding | string

const permissionUnsubscribers = new WeakMap<HTMLElement, () => void>()
const permissionNotUnsubscribers = new WeakMap<HTMLElement, () => void>()

const getBindingPermissions = (
  binding: DirectiveBinding<PermissionDirectiveValue>
): string | string[] => {
  if (typeof binding.value === 'string') {
    return binding.value
  }
  return binding.value?.permission || ''
}

const hasPermission = (binding: DirectiveBinding<PermissionDirectiveValue>): boolean => {
  const permissions = getBindingPermissions(binding)
  if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
    return true
  }

  const authStore = useAuthStore()
  const userPermissions = authStore.userPermissions || []
  if (userPermissions.includes('*') || userPermissions.includes('all:*')) {
    return true
  }

  const permissionList = Array.isArray(permissions) ? permissions : [permissions]
  const hasModuleWildcard = permissionList.some((permission) => {
    const [module] = permission.split(':')
    return Boolean(module && userPermissions.includes(`${module}:*`))
  })

  return hasModuleWildcard || PermissionUtils.hasPermission(userPermissions, permissions as string)
}

const applyPermissionVisibility = (
  el: HTMLElement,
  binding: DirectiveBinding<PermissionDirectiveValue>
) => {
  if (hasPermission(binding)) {
    el.style.display = ''
    el.removeAttribute('data-permission-hidden')
    return
  }

  el.style.display = 'none'
  el.setAttribute('data-permission-hidden', 'true')
}

export const vPermission: Directive<HTMLElement, PermissionDirectiveValue> = {
  mounted(el, binding) {
    applyPermissionVisibility(el, binding)
    const unsubscribe = useAuthStore().$subscribe(() => {
      applyPermissionVisibility(el, binding)
    })
    permissionUnsubscribers.set(el, unsubscribe)
  },

  updated(el, binding) {
    if (binding.oldValue !== binding.value) {
      applyPermissionVisibility(el, binding)
    }
  },

  unmounted(el) {
    permissionUnsubscribers.get(el)?.()
    permissionUnsubscribers.delete(el)
  }
}

export const vPermissionNot: Directive<HTMLElement, PermissionDirectiveValue> = {
  mounted(el, binding) {
    const applyInverseVisibility = () => {
      el.style.display = hasPermission(binding) ? 'none' : ''
    }

    applyInverseVisibility()
    const unsubscribe = useAuthStore().$subscribe(applyInverseVisibility)
    permissionNotUnsubscribers.set(el, unsubscribe)
  },

  updated(el, binding) {
    if (binding.oldValue !== binding.value) {
      el.style.display = hasPermission(binding) ? 'none' : ''
    }
  },

  unmounted(el) {
    permissionNotUnsubscribers.get(el)?.()
    permissionNotUnsubscribers.delete(el)
  }
}

export function installPermissionDirective(app: App) {
  app.directive('permission', vPermission)
  app.directive('permission-not', vPermissionNot)
}
