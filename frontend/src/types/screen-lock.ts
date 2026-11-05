export type ScreenLockBackgroundType = 'default' | 'image' | 'video'

export interface ScreenLockSettings {
  backgroundType: ScreenLockBackgroundType
  imageUrl: string
  videoUrl: string
  title: string
  message: string
}
