/**
 * 菜单管理 Store
 * 用于全局管理菜单状态，实现菜单数据的响应式更新
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import unifiedApi from '@/utils/unified-api'
import { useAuthStore } from './auth'
import type { MenuItem } from '@/types/menu'

export const useMenuStore = defineStore('menu', () => {
  // 菜单列表
  const menuItems = ref<MenuItem[]>([])

  // 加载状态
  const loading = ref(false)

  // 最后加载时间
  const lastLoadTime = ref(0)
  let loadPromise: Promise<void> | null = null

  /**
   * 加载用户菜单
   */
  const loadMenus = async () => {
    if (loadPromise) return loadPromise
    if (loading.value) return

    // 检查用户是否已认证
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      return
    }

    loadPromise = (async () => {
      loading.value = true
      try {
      const response = await unifiedApi.get('/permissions/user-menu', {
        params: { _t: Date.now() }
      })

      if (response?.success && response?.data?.menuPermissions) {
        menuItems.value = response.data.menuPermissions
        lastLoadTime.value = Date.now()
      } else {
        menuItems.value = []
      }
      } catch (error) {
        menuItems.value = []
      } finally {
        loading.value = false
      }
    })().finally(() => {
      loadPromise = null
    })

    return loadPromise
  }

  /**
   * 刷新菜单（强制重新加载）
   */
  const refreshMenus = async () => {
    lastLoadTime.value = 0 // 重置加载时间，强制重新加载
    await loadMenus()
  }

  /**
   * 清空菜单
   */
  const clearMenus = () => {
    menuItems.value = []
    lastLoadTime.value = 0
  }

  return {
    menuItems,
    loading,
    lastLoadTime,
    loadMenus,
    refreshMenus,
    clearMenus
  }
})
