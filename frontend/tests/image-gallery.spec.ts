import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useImageGallery } from '@/composables/useImageGallery'
import { isIOSDevice } from '@/utils/device-detection'
import { createShareImageFile } from '@/utils/share-image'

const notifications = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notifications }))
vi.mock('@/utils/device-detection', () => ({ isIOSDevice: vi.fn() }))
vi.mock('@/utils/share-image', () => ({ createShareImageFile: vi.fn() }))

let host: VueWrapper
let gallery: ReturnType<typeof useImageGallery>
const createUrl = vi.fn()
const revokeUrl = vi.fn()
const share = vi.fn()
const canShare = vi.fn()

const canvasWithBlob = (blob: Blob | null = new Blob(['image'], { type: 'image/png' })) => {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'toBlob').mockImplementation(callback => callback(blob))
  return canvas
}

beforeEach(() => {
  vi.clearAllMocks()
  createUrl.mockReturnValue('blob:preview')
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createUrl
    static revokeObjectURL = revokeUrl
  })
  vi.stubGlobal('navigator', { userAgent: 'iPhone OS 17_0', share, canShare })
  vi.mocked(isIOSDevice).mockReturnValue(false)
  vi.mocked(createShareImageFile).mockResolvedValue(new File(['jpeg'], '报价.jpg', { type: 'image/jpeg' }))
  share.mockResolvedValue(undefined)
  canShare.mockReturnValue(true)
  host = mount(defineComponent({
    setup() {
      gallery = useImageGallery(() => '报价_20261108.png')
      return () => null
    }
  }))
})

afterEach(() => {
  host.unmount()
  vi.unstubAllGlobals()
})

describe('报价图片统一保存与分享', () => {
  it('Android/PC 使用原文件名下载 PNG 并释放临时 URL', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('报价_20261108.png')
      expect(this.href).toBe('blob:preview')
      expect(this.isConnected).toBe(true)
    })
    await gallery.saveImageToGallery(canvasWithBlob())
    expect(click).toHaveBeenCalledOnce()
    expect(revokeUrl).toHaveBeenCalledWith('blob:preview')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(gallery.showIOSImageModal.value).toBe(false)
    expect(createShareImageFile).not.toHaveBeenCalled()
  })

  it('空画布产物拒绝下载，保留失败供调用页统一提示', async () => {
    await expect(gallery.saveImageToGallery(canvasWithBlob(null))).rejects.toThrow('生成图片失败')
    expect(createUrl).not.toHaveBeenCalled()
    expect(notifications.success).not.toHaveBeenCalled()
  })

  it('旧 iOS 默认 data URL，可切换 blob 模式，关闭和重新生成释放旧 URL', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    vi.stubGlobal('navigator', { userAgent: 'iPhone OS 14_8', share, canShare })
    await gallery.saveImageToGallery(canvasWithBlob())
    expect(gallery.showIOSImageModal.value).toBe(true)
    expect(gallery.iosUseDataImage.value).toBe(true)
    expect(gallery.iosImageUrl.value).toMatch(/^data:image\/png;base64,/)
    gallery.toggleIOSImageMode()
    expect(gallery.iosImageUrl.value).toBe('blob:preview')
    await gallery.saveImageToGallery(canvasWithBlob())
    expect(revokeUrl).toHaveBeenCalledTimes(1)
    gallery.closeIOSImageModal()
    expect(gallery.showIOSImageModal.value).toBe(false)
    expect(gallery.iosImageUrl.value).toMatch(/^data:image\/gif;/)
    expect(revokeUrl).toHaveBeenCalledTimes(2)
  })

  it('新 iOS 使用 blob 预览，分享受限 JPEG；同一分享未完成时防重复', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    const canvas = canvasWithBlob()
    await gallery.saveImageToGallery(canvas)
    expect(createShareImageFile).toHaveBeenCalledWith(canvas, '报价_20261108.png')
    expect(gallery.iosUseDataImage.value).toBe(false)
    let finish!: () => void
    share.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const pending = gallery.shareIOSImage()
    await gallery.shareIOSImage()
    expect(share).toHaveBeenCalledOnce()
    expect(share.mock.calls[0][0].files[0].type).toBe('image/jpeg')
    expect(gallery.isSharingImage.value).toBe(true)
    finish()
    await pending
    expect(gallery.isSharingImage.value).toBe(false)
  })

  it('不支持文件分享时提示长按；取消不误报，真实失败提示并恢复按钮', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    await gallery.saveImageToGallery(canvasWithBlob())
    canShare.mockReturnValue(false)
    await gallery.shareIOSImage()
    expect(share).not.toHaveBeenCalled()
    expect(notifications.warning).toHaveBeenCalledWith('当前浏览器不支持系统分享，请长按图片保存')
    notifications.warning.mockClear()
    canShare.mockReturnValue(true)
    share.mockRejectedValue(new DOMException('用户取消', 'AbortError'))
    await gallery.shareIOSImage()
    expect(notifications.warning).not.toHaveBeenCalled()
    share.mockRejectedValue(new Error('分享失败'))
    await gallery.shareIOSImage()
    expect(notifications.warning).toHaveBeenCalledWith('系统分享未成功，请长按图片保存')
    expect(gallery.isSharingImage.value).toBe(false)
  })

  it('读取预览失败时不分配 URL、不打开弹窗', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'))
    })
    await expect(gallery.saveImageToGallery(canvasWithBlob())).rejects.toThrow('图片读取失败')
    expect(createUrl).not.toHaveBeenCalled()
    expect(gallery.showIOSImageModal.value).toBe(false)
  })

  it('卸载时释放已有预览，忽略随后触发的保存', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    await gallery.saveImageToGallery(canvasWithBlob())
    host.unmount()
    expect(revokeUrl).toHaveBeenCalledOnce()
    await gallery.saveImageToGallery(canvasWithBlob())
    expect(createUrl).toHaveBeenCalledOnce()
    expect(gallery.showIOSImageModal.value).toBe(false)
  })

  it('弹窗 v-model 关闭也释放预览，不依赖页脚关闭按钮', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    await gallery.saveImageToGallery(canvasWithBlob())
    gallery.showIOSImageModal.value = false
    expect(revokeUrl).toHaveBeenCalledOnce()
    expect(gallery.iosImageUrl.value).toMatch(/^data:image\/gif;/)
  })

  it('关闭后丢弃尚未完成的图片转换，不重新打开预览或泄漏 URL', async () => {
    vi.mocked(isIOSDevice).mockReturnValue(true)
    let finish!: (_file: File) => void
    vi.mocked(createShareImageFile).mockImplementation(() => new Promise<File>(resolve => { finish = resolve }))
    const pending = gallery.saveImageToGallery(canvasWithBlob())
    await Promise.resolve()
    gallery.closeIOSImageModal()
    finish(new File(['jpeg'], '报价.jpg'))
    await pending
    expect(gallery.showIOSImageModal.value).toBe(false)
    expect(createUrl).not.toHaveBeenCalled()
  })
})
