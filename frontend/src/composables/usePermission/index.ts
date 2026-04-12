/**
 * 字段权限控制组合式API
 */

import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'

interface FieldPermission {
  can_view: boolean
  can_edit: boolean
  can_search: boolean
  can_export: boolean
  is_hidden: boolean
  permission_level: string
}

interface UseFieldPermissionOptions {
  moduleKey: string
  fieldName: string
  action?: 'view' | 'edit' | 'export'
  roleId?: number
}

export function useFieldPermission(options: UseFieldPermissionOptions) {
  const authStore = useAuthStore()
  const loading = ref(false)
  const permission = ref<FieldPermission | null>(null)

  const hasPermission = computed(() => {
    if (!permission.value) return false

    const { action = 'view' } = options

    switch (action) {
      case 'view':
        return permission.value.can_view && !permission.value.is_hidden
      case 'edit':
        return permission.value.can_edit
      case 'export':
        return permission.value.can_export
      default:
        return permission.value.can_view && !permission.value.is_hidden
    }
  })

  const checkPermission = async () => {
    const currentRoleId = options.roleId || authStore.user?.role_id

    if (!currentRoleId || !options.moduleKey || !options.fieldName) {
      permission.value = null
      return
    }

    loading.value = true

    try {
      const response = await unifiedApi.get(`/fields/permissions/${options.moduleKey}`)

      if (response.success) {
        const modulePermissions = response.data
        const fieldPermission = modulePermissions.fields.find((f: any) =>
          f.field === options.fieldName || 
          f.id === options.fieldName || 
          f.id.includes(options.fieldName)
        )

        permission.value = fieldPermission || null
      }
    } catch (error) {
      logger.error('获取字段权限失败:', error)
      permission.value = null
    } finally {
      loading.value = false
    }
  }

  // 初始检查
  checkPermission()

  return {
    loading: computed(() => loading.value),
    hasPermission,
    permission: computed(() => permission.value),
    checkPermission
  }
}

/**
 * 批量检查字段权限
 */
export function useBatchFieldPermissions(moduleKey: string, fieldNames: string[]) {
  const authStore = useAuthStore()
  const loading = ref(false)
  const permissions = ref<Map<string, FieldPermission | null>>(new Map())

  const checkPermissions = async () => {
    const currentRoleId = authStore.user?.role_id

    if (!currentRoleId || !moduleKey || fieldNames.length === 0) {
      return
    }

    loading.value = true

    try {
      const response = await unifiedApi.get(`/fields/permissions/${moduleKey}`)

      if (response.success) {
        const modulePermissions = response.data

        fieldNames.forEach(fieldName => {
          const fieldPermission = modulePermissions.fields.find((f: any) =>
            f.field === fieldName || 
            f.id === fieldName || 
            f.id.includes(fieldName)
          )

          permissions.value.set(fieldName, fieldPermission || null)
        })
      }
    } catch (error) {
      logger.error('批量获取字段权限失败:', error)
    } finally {
      loading.value = false
    }
  }

  const hasFieldPermission = (fieldName: string, action: 'view' | 'edit' | 'export' = 'view') => {
    const permission = permissions.value.get(fieldName)

    if (!permission) return false

    switch (action) {
      case 'view':
        return permission.can_view && !permission.is_hidden
      case 'edit':
        return permission.can_edit
      case 'export':
        return permission.can_export
      default:
        return permission.can_view && !permission.is_hidden
    }
  }

  // 初始检查
  checkPermissions()

  return {
    loading: computed(() => loading.value),
    permissions: computed(() => permissions.value),
    hasFieldPermission,
    checkPermissions
  }
}
