/**
 * Pinia 状态管理中心
 * 统一导出所有 stores
 */

import { useAuthStore } from './auth'
import { useAppStore } from './app'
import { useLoadingStore } from './loading'
import { useMessageStore } from './message'

// 导出所有 stores
export {
  useAuthStore,
  useAppStore,
  useLoadingStore,
  useMessageStore
}

// Store 类型导出
export type { User, Permission, Role, AppLanguage, DeviceInfo, SystemInfo } from '@/types'

// Store 组合
export const useStores = () => ({
  auth: useAuthStore(),
  app: useAppStore(),
  loading: useLoadingStore(),
  message: useMessageStore()
})

// 默认导出
export default {
  useAuthStore,
  useAppStore,
  useLoadingStore,
  useMessageStore,
  useStores
}