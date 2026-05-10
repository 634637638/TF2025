/**
 * 屏幕锁定 Composable
 */
import { ref, watch } from 'vue'
import { TimeUtil } from '@/utils/time'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS, SECURITY_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

const getValidSessionToken = () => {
  const token = storage.get<string>(AUTH_STORAGE_KEYS.TOKEN, 'session')
  if (!token || token === 'null' || token === 'undefined') {
    return ''
  }
  return token?.trim() || ''
}

let sharedLockSettingsPromise: Promise<void> | null = null

export const useScreenLock = () => {
  const isLocked = ref(false)
  const lockSettings = ref({
    backgroundType: 'default',
    imageUrl: '',
    videoUrl: '',
    title: '屏幕已锁定',
    message: '请输入密码解锁'
  })

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
      const token = getValidSessionToken()
      const response = await fetch('/api/screen-lock', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // 只加载背景设置，不加载密码
          lockSettings.value = {
            backgroundType: data.data.backgroundType || 'default',
            imageUrl: data.data.imageUrl || '',
            videoUrl: data.data.videoUrl || '',
            title: data.data.title || '屏幕已锁定',
            message: data.data.message || '请输入密码解锁'
          }
        }
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
    // 加载背景设置
    await loadLockSettings()

    // 立即锁定
    isLocked.value = true
    storage.setScreenLocked(true)

    // 禁用页面滚动
    document.body.style.overflow = 'hidden'
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
      const token = getValidSessionToken()
      const response = await fetch('/api/screen-lock/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          unlockScreen()
          return true
        }
      }
      return false
    } catch (error) {
      logger.error('验证密码失败:', error)
      return false
    }
  }

  // 初始化锁定状态
  const initializeLock = async () => {
    // 加载设置
    await loadLockSettings()

    // 检查是否已锁定
    if (checkLockStatus()) {
      isLocked.value = true
      document.body.style.overflow = 'hidden'
    }
  }

  // 监听锁定状态变化
  watch(isLocked, (newValue) => {
    document.body.style.overflow = newValue ? 'hidden' : ''
  })

  // 快捷键处理
  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
      // Alt + L 快速锁定
      if (e.altKey && e.key === 'l') {
        e.preventDefault()
        lockScreen()
      }
    })
  }

  return {
    isLocked,
    lockSettings,
    lockScreen,
    unlockScreen,
    verifyPassword,
    checkLockStatus,
    initializeLock,
    setupKeyboardShortcuts
  }
}
