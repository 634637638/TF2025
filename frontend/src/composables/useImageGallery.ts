import { computed, onBeforeUnmount, ref } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { isIOSDevice } from '@/utils/device-detection'
import { createShareImageFile } from '@/utils/share-image'

const EMPTY_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
  reader.readAsDataURL(blob)
})

/** 统一画布保存与 iOS 分享；页面提供文件名及预览弹窗，图片内容由调用方生成。 */
export function useImageGallery(getFileName: () => string) {
  const notifications = useNotification()
  const previewVisible = ref(false)
  const showIOSImageModal = computed({
    get: () => previewVisible.value,
    set: (visible: boolean) => {
      if (visible) previewVisible.value = true
      else closeIOSImageModal()
    }
  })
  const iosImageUrl = ref(EMPTY_IMAGE_SRC)
  const iosImageFile = ref<File | null>(null)
  const iosBlobImageUrl = ref('')
  const iosDataImageUrl = ref('')
  const iosUseDataImage = ref(false)
  const isSharingImage = ref(false)
  let generation = 0
  let disposed = false

  const resetPreview = () => {
    previewVisible.value = false
    if (iosBlobImageUrl.value) URL.revokeObjectURL(iosBlobImageUrl.value)
    iosImageUrl.value = EMPTY_IMAGE_SRC
    iosBlobImageUrl.value = ''
    iosDataImageUrl.value = ''
    iosImageFile.value = null
  }

  const closeIOSImageModal = () => {
    generation += 1
    resetPreview()
  }

  const syncIOSImageUrl = () => {
    iosImageUrl.value = iosUseDataImage.value ? iosDataImageUrl.value : iosBlobImageUrl.value
  }

  const toggleIOSImageMode = () => {
    iosUseDataImage.value = !iosUseDataImage.value
    syncIOSImageUrl()
    notifications.info(iosUseDataImage.value ? '已切换为兼容模式，请长按图片保存' : '已切换为新系统模式，请长按图片保存')
  }

  const shareIOSImage = async () => {
    if (isSharingImage.value) return
    const file = iosImageFile.value
    if (!file || !navigator.share) {
      notifications.warning('当前浏览器不支持系统分享，请长按图片保存')
      return
    }
    isSharingImage.value = true
    try {
      const shareData = { files: [file] }
      if (navigator.canShare && !navigator.canShare(shareData)) {
        notifications.warning('当前浏览器不支持系统分享，请长按图片保存')
        return
      }
      await navigator.share(shareData)
    } catch (error) {
      if (!(error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError')) {
        notifications.warning('系统分享未成功，请长按图片保存')
      }
    } finally {
      isSharingImage.value = false
    }
  }

  const saveImageToGallery = async (canvas: HTMLCanvasElement) => {
    if (disposed) return
    const currentGeneration = ++generation
    const fileName = getFileName()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('生成图片失败')), 'image/png', 0.95)
    })
    if (currentGeneration !== generation) return

    if (isIOSDevice()) {
      // 所有异步转换成功后才分配 URL；关闭、卸载或新生成会取消过期结果。
      const file = await createShareImageFile(canvas, fileName)
      const dataUrl = await blobToDataUrl(blob)
      if (currentGeneration !== generation) return
      resetPreview()
      iosImageFile.value = file
      iosDataImageUrl.value = dataUrl
      iosBlobImageUrl.value = URL.createObjectURL(blob)
      const major = navigator.userAgent.match(/(?:iPhone OS|CPU OS|CPU iPhone OS)\s(\d+)[_\d]*/i)
      iosUseDataImage.value = major !== null && Number(major[1]) < 15
      syncIOSImageUrl()
      previewVisible.value = true
      notifications.success({ message: '图片已生成，请长按保存到相册', duration: 3000 })
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    try {
      link.download = fileName
      link.href = url
      document.body.appendChild(link)
      link.click()
      notifications.success({ message: '图片已下载', duration: 2000 })
    } finally {
      link.remove()
      URL.revokeObjectURL(url)
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    closeIOSImageModal()
  })

  return {
    showIOSImageModal, iosImageUrl, iosUseDataImage, isSharingImage,
    closeIOSImageModal, toggleIOSImageMode, shareIOSImage, saveImageToGallery
  }
}
