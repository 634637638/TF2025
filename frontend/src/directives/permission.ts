/**
 * 权限控制指令
 * 提供 v-permission 和 v-permission-not 指令。
 * 字段权限统一由 useFieldPermissions 读取 /permissions/user-field-permissions。
 */

import { useAuthStore } from '@/stores/auth'
import { watch, type App, type Directive, type DirectiveBinding } from 'vue'

interface PermissionBinding {
  permission: string | string[]
  mode?: 'any' | 'all'
}

type PermissionDirectiveValue = PermissionBinding | string

const permissionUnsubscribers = new WeakMap<HTMLElement, () => void>()
const permissionNotUnsubscribers = new WeakMap<HTMLElement, () => void>()
const permissionBindings = new WeakMap<HTMLElement, DirectiveBinding<PermissionDirectiveValue>>()
const permissionNotBindings = new WeakMap<HTMLElement, DirectiveBinding<PermissionDirectiveValue>>()

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
  const permissionList = Array.isArray(permissions) ? permissions : [permissions]
  const canUse = (permission: string) => authStore.hasPermission(permission)
  const mode = typeof binding.value === 'string' ? 'any' : binding.value?.mode || 'any'
  return mode === 'all' ? permissionList.every(canUse) : permissionList.some(canUse)
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
    permissionBindings.set(el, binding)
    applyPermissionVisibility(el, binding)
    const authStore = useAuthStore()
    const unsubscribe = watch(() => [
      authStore.userPermissions,
      authStore.isAuthenticated,
      authStore.isActive,
      authStore.isAuthReady
    ], () => {
      applyPermissionVisibility(el, permissionBindings.get(el) || binding)
    }, { deep: true })
    permissionUnsubscribers.set(el, unsubscribe)
  },

  updated(el, binding) {
    permissionBindings.set(el, binding)
    if (binding.oldValue !== binding.value) {
      applyPermissionVisibility(el, binding)
    }
  },

  unmounted(el) {
    permissionUnsubscribers.get(el)?.()
    permissionUnsubscribers.delete(el)
    permissionBindings.delete(el)
  }
}

export const vPermissionNot: Directive<HTMLElement, PermissionDirectiveValue> = {
  mounted(el, binding) {
    permissionNotBindings.set(el, binding)
    const applyInverseVisibility = () => {
      el.style.display = hasPermission(permissionNotBindings.get(el) || binding) ? 'none' : ''
    }

    applyInverseVisibility()
    const authStore = useAuthStore()
    const unsubscribe = watch(() => [
      authStore.userPermissions,
      authStore.isAuthenticated,
      authStore.isActive,
      authStore.isAuthReady
    ], applyInverseVisibility, { deep: true })
    permissionNotUnsubscribers.set(el, unsubscribe)
  },

  updated(el, binding) {
    permissionNotBindings.set(el, binding)
    if (binding.oldValue !== binding.value) {
      el.style.display = hasPermission(binding) ? 'none' : ''
    }
  },

  unmounted(el) {
    permissionNotUnsubscribers.get(el)?.()
    permissionNotUnsubscribers.delete(el)
    permissionNotBindings.delete(el)
  }
}

export function installPermissionDirective(app: App) {
  app.directive('permission', vPermission)
  app.directive('permission-not', vPermissionNot)
}
