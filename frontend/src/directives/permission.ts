/**
 * 权限控制指令
 * 提供 v-permission 和 v-permission-not 指令
 */

import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { PermissionUtils } from '@/utils/permissionMapper'
import type { Directive, DirectiveBinding } from 'vue'

// 权限检查接口
interface PermissionBinding {
  permission: string | string[]
  mode?: 'any' | 'all'
}

/**
 * v-permission 指令
 * 根据用户权限显示/隐藏元素
 */
export const vPermission: Directive<HTMLElement, PermissionBinding | string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionBinding | string>) {
    applyPermissionVisibility(el, binding)
  },

  updated(el: HTMLElement, binding: DirectiveBinding<PermissionBinding | string>) {
    // 权限更新时重新检查
    if (binding.oldValue !== binding.value) {
      applyPermissionVisibility(el, binding)
    }
  }
}

const applyPermissionVisibility = (el: HTMLElement, binding: DirectiveBinding<PermissionBinding | string>) => {
  const authStore = useAuthStore()

  const getPermissions = (): string | string[] => {
    if (typeof binding.value === 'string') {
      return binding.value
    }
    return binding.value?.permission || ''
  }

  const checkPermission = () => {
    const permissions = getPermissions()

    if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
      return true
    }

    const userPermissions = authStore.userPermissions || []

    if (userPermissions.includes('*') || userPermissions.includes('all:*')) {
      return true
    }

    const permArray = Array.isArray(permissions) ? permissions : [permissions]
    for (const perm of permArray) {
      const [module] = perm.split(':')
      if (module && userPermissions.includes(`${module}:*`)) {
        return true
      }
    }

    return PermissionUtils.hasPermission(userPermissions, permissions as string)
  }

  if (!checkPermission()) {
    el.style.display = 'none'
    el.setAttribute('data-permission-hidden', 'true')
  } else {
    el.style.display = ''
    el.removeAttribute('data-permission-hidden')
  }

  authStore.$subscribe(() => {
    if (!checkPermission()) {
      el.style.display = 'none'
      el.setAttribute('data-permission-hidden', 'true')
    } else {
      el.style.display = ''
      el.removeAttribute('data-permission-hidden')
    }
  })
}

/**
 * v-permission-not 指令
 * 当用户没有指定权限时显示元素
 */
export const vPermissionNot: Directive<HTMLElement, PermissionBinding | string> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionBinding | string>) {
    const authStore = useAuthStore()

    const getPermissions = (): string | string[] => {
      if (typeof binding.value === 'string') {
        return binding.value
      }
      return binding.value?.permission || ''
    }

    const checkNoPermission = () => {
      const permissions = getPermissions()

      if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
        return false
      }

      const userPermissions = authStore.userPermissions || []
      return !PermissionUtils.hasPermission(userPermissions, permissions as string)
    }

    if (!checkNoPermission()) {
      el.style.display = 'none'
    }

    authStore.$subscribe(() => {
      if (!checkNoPermission()) {
        el.style.display = 'none'
      } else {
        el.style.display = ''
      }
    })
  }
}

// 字段权限绑定接口
interface FieldPermissionBinding {
  moduleKey: string
  fieldName: string
  action?: 'view' | 'edit' | 'export'
  roleId?: number
}

// 字段权限接口
interface FieldPermission {
  can_view: boolean
  can_edit: boolean
  can_search: boolean
  can_export: boolean
  is_hidden: boolean
  permission_level: string
}

// 权限指令权限缓存
const permissionCache = new Map<string, FieldPermission | null>()

export const fieldPermissionDirective: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<FieldPermissionBinding>) {
    checkPermission(el, binding)
  },
  updated(el: HTMLElement, binding: DirectiveBinding<FieldPermissionBinding>) {
    checkPermission(el, binding)
  }
}

async function checkPermission(el: HTMLElement, binding: DirectiveBinding<FieldPermissionBinding>) {
  const { moduleKey, fieldName, action = 'view', roleId } = binding.value || {}

  if (!moduleKey || !fieldName) {
    return
  }

  const authStore = useAuthStore()
  const currentRoleId = roleId || authStore.user?.role_id

  if (!currentRoleId) {
    return
  }

  // 生成缓存键
  const cacheKey = `${moduleKey}_${fieldName}_${currentRoleId}`

  let permission: FieldPermission | null = null

  // 从缓存获取或请求权限
  if (permissionCache.has(cacheKey)) {
    permission = permissionCache.get(cacheKey)
  } else {
    try {
      const response = await unifiedApi.get(`/fields/permissions/${moduleKey}`)

      if (response.success) {
        const modulePermissions = response.data
        // 查找字段的权限配置
        const fieldPermission = modulePermissions.fields.find((f: any) =>
          f.field === fieldName || f.id === fieldName || f.id.includes(fieldName)
        )

        permission = fieldPermission || null
        permissionCache.set(cacheKey, permission)
      }
    } catch (error) {
      // 获取字段权限失败，忽略
    }
  }

  // 根据权限和操作类型控制元素显示
  if (!permission) {
    // 没有找到权限配置，默认隐藏（安全第一）
    hideElement(el, binding)
    return
  }

  let hasPermission = false

  switch (action) {
    case 'view':
      hasPermission = permission.can_view && !permission.is_hidden
      break
    case 'edit':
      hasPermission = permission.can_edit
      break
    case 'export':
      hasPermission = permission.can_export
      break
    default:
      hasPermission = permission.can_view && !permission.is_hidden
  }

  if (!hasPermission) {
    hideElement(el, binding)
  } else {
    showElement(el, binding)
  }
}

function hideElement(el: HTMLElement, binding: DirectiveBinding) {
  // 根据配置决定是隐藏还是禁用
  if (binding.modifiers.disabled) {
    el.setAttribute('disabled', 'disabled')
    el.classList.add('is-disabled')
  } else {
    el.style.display = 'none'
  }
}

function showElement(el: HTMLElement, binding: DirectiveBinding) {
  if (binding.modifiers.disabled) {
    el.removeAttribute('disabled')
    el.classList.remove('is-disabled')
  } else {
    el.style.display = ''
  }
}

// 清除权限缓存
export function clearFieldPermissionCache() {
  permissionCache.clear()
}

// 预加载模块权限
export async function preloadModulePermissions(moduleKey: string, roleId?: number) {
  const authStore = useAuthStore()
  const currentRoleId = roleId || authStore.user?.role_id

  if (!currentRoleId) return

  try {
    const response = await unifiedApi.get(`/fields/permissions/${moduleKey}`)

    if (response.success) {
      const modulePermissions = response.data

      // 缓存所有字段的权限
      modulePermissions.fields.forEach((field: any) => {
        const cacheKey = `${moduleKey}_${field.field}_${currentRoleId}`
        permissionCache.set(cacheKey, {
          can_view: field.visible,
          can_edit: field.editable,
          can_search: field.searchable,
          can_export: field.exportable,
          is_hidden: !field.visible,
          permission_level: field.permissionLevel
        })
      })
    }
  } catch (error) {
    // 预加载模块权限失败，忽略
  }
}

// 安装所有权限指令
export function installPermissionDirective(app: any) {
  // 安装基础权限指令 v-permission 和 v-permission-not
  app.directive('permission', vPermission)
  app.directive('permission-not', vPermissionNot)

  // 安装字段权限指令 v-field-permission
  app.directive('field-permission', fieldPermissionDirective)
}
