import type { ScreenLockBackgroundType, ScreenLockSettings } from '@/types/screen-lock'

export const DEFAULT_SCREEN_LOCK_SETTINGS: Readonly<ScreenLockSettings> = {
  backgroundType: 'default',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁'
}

const isBackgroundType = (value: unknown): value is ScreenLockBackgroundType => {
  return value === 'default' || value === 'image' || value === 'video'
}

export const normalizeScreenLockSettings = (value: unknown): ScreenLockSettings => {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
  const readText = (key: keyof ScreenLockSettings, fallback: string, allowEmpty = false) => {
    const rawValue = source[key]
    if (typeof rawValue !== 'string') return fallback
    const normalizedValue = rawValue.trim()
    return normalizedValue || (allowEmpty ? '' : fallback)
  }

  return {
    backgroundType: isBackgroundType(source.backgroundType)
      ? source.backgroundType
      : DEFAULT_SCREEN_LOCK_SETTINGS.backgroundType,
    imageUrl: readText('imageUrl', '', true),
    videoUrl: readText('videoUrl', '', true),
    title: readText('title', DEFAULT_SCREEN_LOCK_SETTINGS.title),
    message: readText('message', DEFAULT_SCREEN_LOCK_SETTINGS.message)
  }
}
