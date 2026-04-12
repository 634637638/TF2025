import { computed, unref, type Ref } from 'vue'
import { normalizePermissionList } from '@/utils/permissionList'

export const usePermissionModuleInfo = (
  rawPermissions: unknown | Ref<unknown>,
  modulePrefix: string
) => {
  const normalizedPermissions = computed(() => normalizePermissionList(unref(rawPermissions)))

  const hasMenuPermissionOnly = computed(() => {
    const permissions = normalizedPermissions.value
    return permissions.includes(`${modulePrefix}:menu_view`) && !permissions.includes(`${modulePrefix}:view`)
  })

  const modulePermissions = computed(() => {
    return normalizedPermissions.value
      .filter(permission => permission.startsWith(`${modulePrefix}:`))
      .sort()
  })

  return {
    normalizedPermissions,
    hasMenuPermissionOnly,
    modulePermissions
  }
}

export default usePermissionModuleInfo
