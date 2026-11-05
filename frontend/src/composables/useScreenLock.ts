/**
 * 屏幕锁定 Composable
 */
import { ref, watch } from 'vue'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'
import { unifiedApi } from '@/utils/unified-api'
import { useKeyboardShortcut } from '@/composables/useKeyboardShortcut'
import { normalizeScreenLockSettings } from '@/utils/screen-lock-settings'
import type { ScreenLockSettings } from '@/types/screen-lock'

let sharedLockSettingsPromise: Promise<void> | null = null

export const useScreenLock = () => {
  // 在首屏渲染前同步恢复锁定状态，避免刷新时短暂暴露业务页面。
  const isLocked = ref(storage.isScreenLocked())
  const lockSettings = ref<ScreenLockSettings>(
    normalizeScreenLockSettings(storage.getScreenLockSettings<unknown>())
  )

  // 检查是否被锁定
  const checkLockStatus = () => {
    return storage.isScreenLocked()
  }

  // 获取屏幕锁定设置（仅背景设置，密码从后台获取）
  const loadLockSettings = async () => {
    if (sharedLockSettingsPromise) {
      return sharedLockSettingsPromise
    }

    sharedLockSettingsPromise = (async () => {
      try {
        const response = await unifiedApi.get('/screen-lock', {
          showLoading: false,
          showError: false,
          useCache: true,
          cacheTTL: 60000
        })
        if (response.success && response.data) {
          const settings = normalizeScreenLockSettings(response.data)
          lockSettings.value = settings
          storage.setScreenLockSettings(settings)
        }
      } catch (error) {
        logger.error('加载屏幕锁定设置失败:', error)
      }
    })().finally(() => {
      sharedLockSettingsPromise = null
    })

    return sharedLockSettingsPromise
  }

  // 锁定屏幕 - 点击按钮立即锁定
  const lockScreen = async () => {
    // 先锁定，再异步加载背景设置，避免网络请求延迟暴露页面。
    isLocked.value = true
    storage.setScreenLocked(true)

    await loadLockSettings()
  }

  // 解锁屏幕
  const unlockScreen = () => {
    isLocked.value = false
    storage.setScreenLocked(false)
    document.body.style.overflow = ''
  }

  // 验证密码 - 调用后台API验证
  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const response = await unifiedApi.post('/screen-lock/verify', { password }, {
        showLoading: false,
        showError: false,
        useCache: false
      })

      if (response.success) {
        unlockScreen()
        return true
      }
      return false
    } catch (error) {
      logger.error('验证密码失败:', error)
      return false
    }
  }

  // 初始化锁定状态
  const initializeLock = async () => {
    // 本地状态必须先于接口读取，首屏不能等待网络请求。
    isLocked.value = checkLockStatus()
    await loadLockSettings()
  }

  // 监听锁定状态变化
  watch(isLocked, (newValue) => {
    document.body.style.overflow = newValue ? 'hidden' : ''
  }, { immediate: true })

  useKeyboardShortcut({ key: 'l', alt: true }, () => {
    void lockScreen()
  })

  return {
    isLocked,
    lockSettings,
    lockScreen,
    unlockScreen,
    verifyPassword,
    checkLockStatus,
    initializeLock
  }
}
