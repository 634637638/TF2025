/**
 * 组件权限预加载Hook
 * 让使用权限指令的组件能够预加载权限数据
 */

import { onMounted, ref } from 'vue'
import { useDynamicPermissions } from '@/services/permissions'

export function usePermissionPreload() {
  const isPreloaded = ref(false)
  const { refreshPermissions, isLoading } = useDynamicPermissions()

  const preloadPermissions = async (): Promise<void> => {
    if (isPreloaded.value) return

    try {
      await refreshPermissions()
      isPreloaded.value = true
    } catch (error) {
      // 权限预加载失败，忽略
    }
  }

  onMounted(() => {
    preloadPermissions()
  })

  return {
    isPreloaded,
    preloadPermissions,
    isLoading
  }
}