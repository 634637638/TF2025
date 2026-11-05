import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lockState = vi.hoisted(() => ({ value: false }))
const storageMocks = vi.hoisted(() => ({
  isScreenLocked: vi.fn(() => lockState.value),
  setScreenLocked: vi.fn(),
  getScreenLockSettings: vi.fn(() => null),
  setScreenLockSettings: vi.fn()
}))
const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/services/storage', () => ({
  storage: storageMocks
}))

vi.mock('@/utils/unified-api', () => ({
  unifiedApi: {
    get: apiGet,
    post: vi.fn()
  }
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() }
}))

vi.mock('@/composables/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn()
}))

import { useScreenLock } from '@/composables/useScreenLock'

describe('useScreenLock', () => {
  let scope: EffectScope | undefined

  beforeEach(() => {
    lockState.value = false
    storageMocks.getScreenLockSettings.mockReturnValue(null)
    apiGet.mockResolvedValue({ success: true, data: {} })
    document.body.style.overflow = ''
  })

  afterEach(() => {
    scope?.stop()
    scope = undefined
    document.body.style.overflow = ''
  })

  it('首屏渲染前同步恢复本地锁定状态', () => {
    lockState.value = true
    scope = effectScope()

    const screenLock = scope.run(() => useScreenLock())

    expect(screenLock?.isLocked.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('初始化时先恢复锁定状态，再等待背景设置接口', async () => {
    let resolveRequest: ((value: { success: boolean; data: object }) => void) | undefined
    apiGet.mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve
    }))
    scope = effectScope()
    const screenLock = scope.run(() => useScreenLock())
    lockState.value = true

    const initialization = screenLock?.initializeLock()

    expect(screenLock?.isLocked.value).toBe(true)
    resolveRequest?.({ success: true, data: {} })
    await initialization
  })

  it('手动锁定不等待背景设置接口', async () => {
    let resolveRequest: ((value: { success: boolean; data: object }) => void) | undefined
    apiGet.mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve
    }))
    scope = effectScope()
    const screenLock = scope.run(() => useScreenLock())

    const locking = screenLock?.lockScreen()

    expect(screenLock?.isLocked.value).toBe(true)
    expect(storageMocks.setScreenLocked).toHaveBeenCalledWith(true)
    resolveRequest?.({ success: true, data: {} })
    await locking
  })

  it('接口背景设置写入缓存供刷新首帧使用', async () => {
    apiGet.mockResolvedValue({
      success: true,
      data: {
        backgroundType: 'image',
        imageUrl: '/uploads/screen-lock/background.jpg',
        videoUrl: '',
        title: '屏幕已锁定',
        message: '请输入密码解锁'
      }
    })
    scope = effectScope()
    const screenLock = scope.run(() => useScreenLock())

    await screenLock?.initializeLock()

    expect(storageMocks.setScreenLockSettings).toHaveBeenCalledWith(expect.objectContaining({
      backgroundType: 'image',
      imageUrl: '/uploads/screen-lock/background.jpg'
    }))
  })
})
