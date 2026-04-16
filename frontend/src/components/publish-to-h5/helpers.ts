import type {
  PendingUploadFile,
  PublishFormState,
  PublishInspectionResponse,
  UploadedMediaItem
} from './types'

export const createDefaultPublishForm = (): PublishFormState => ({
  sale_price: null,
  condition_grade: '',
  battery_status: null,
  screen_condition: 'original',
  system_version: '',
  model_version: '',
  warranty_date: '',
  is_warranty_expired: false
})

export const normalizePublishSalePrice = (value: string): number | null => {
  const sanitized = String(value || '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .replace(/^(\d+)\.(\d{0,2}).*$/, '$1.$2')

  if (!sanitized) {
    return null
  }

  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : null
}

export const revokePendingFileUrls = (files: PendingUploadFile[]) => {
  files.forEach((file) => {
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url)
    }
  })
}

export const findUploadedVideoUrl = (mediaItems: UploadedMediaItem[]) =>
  mediaItems.find((img) => img.image_type === 'video')?.image_url || ''

export const resolvePublishIsNewPhone = (
  phoneValue: unknown,
  propIsNew?: boolean
) => propIsNew === true || phoneValue === 1 || phoneValue === '1' || phoneValue === true

export const buildPublishInspectionForm = (
  inspectionData: PublishInspectionResponse | null | undefined
): {
  formData: PublishFormState
  batteryDisplayValue: string
} => {
  const batteryValue = inspectionData?.battery_status ?? null

  return {
    formData: {
      sale_price: inspectionData?.sale_price ? Number(inspectionData.sale_price) || null : null,
      condition_grade: inspectionData?.condition_grade || '',
      battery_status: batteryValue,
      screen_condition: inspectionData?.screen_condition || 'original',
      system_version: inspectionData?.system_version || '',
      model_version: inspectionData?.model_version || '',
      warranty_date: inspectionData?.warranty_date || '',
      is_warranty_expired: Boolean(inspectionData?.is_warranty_expired)
    },
    batteryDisplayValue: batteryValue !== null && batteryValue !== undefined ? String(batteryValue) : ''
  }
}

export const isHeicFormat = (file: File) => {
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')
}

export const getPublishUploadFieldName = (file: File) =>
  file.type.startsWith('video/') ? 'video' : 'image'

export const getPublishUploadEndpoint = (phoneId: number | null, file: File) =>
  `/phones/${phoneId}/${file.type.startsWith('video/') ? 'upload-video' : 'upload-image'}`

export const validatePublishMediaFile = (file: File): string | null => {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    return '只能上传图片或视频文件！'
  }

  if (isImage && file.size / 1024 / 1024 > 5) {
    return `图片 "${file.name}" 大小不能超过 5MB！`
  }

  if (isVideo && file.size / 1024 / 1024 > 50) {
    return `视频 "${file.name}" 大小不能超过 50MB！`
  }

  return null
}

export const filterValidPublishFiles = (fileList: PendingUploadFile[]) =>
  fileList.filter((file) => {
    if (file.raw) {
      const isImage = file.raw.type?.startsWith('image/')
      const isVideo = file.raw.type?.startsWith('video/')
      return isImage || isVideo
    }

    return file.status === 'ready'
  })

export const getNewPublishFiles = (
  fileList: PendingUploadFile[],
  processedUids: Set<string>
) => fileList.filter((file) => file.raw && !processedUids.has(file.uid))

export const getRemovedPublishFiles = (
  currentFiles: PendingUploadFile[],
  nextFiles: PendingUploadFile[]
) => currentFiles.filter((file) => !nextFiles.some((nextFile) => nextFile.uid === file.uid))

export const ensurePublishPendingFileUrl = (file: PendingUploadFile) => {
  if (file.url) {
    return file.url
  }

  if (!file.raw) {
    return ''
  }

  file.url = URL.createObjectURL(file.raw)
  return file.url
}

export const buildConvertedPublishFile = (
  sourceFile: PendingUploadFile,
  convertedFile: File
): PendingUploadFile => ({
  uid: sourceFile.uid,
  name: convertedFile.name,
  raw: convertedFile,
  status: 'ready',
  url: URL.createObjectURL(convertedFile)
})

export const applyPublishConversionResults = (
  placeholderFiles: PendingUploadFile[],
  convertedFiles: Array<PendingUploadFile | null>
) => {
  const mergedFiles = [...placeholderFiles]
  let convertedIndex = 0

  for (let index = 0; index < mergedFiles.length; index += 1) {
    if (mergedFiles[index].status !== 'converting') {
      continue
    }

    const convertedFile = convertedFiles[convertedIndex]
    convertedIndex += 1

    if (convertedFile) {
      mergedFiles[index] = convertedFile
      continue
    }

    mergedFiles.splice(index, 1)
    index -= 1
  }

  return mergedFiles
}

export const buildPublishPreviewStateFromPending = (
  files: PendingUploadFile[],
  clickedIndex: number
) => {
  const previewableFiles = files
    .filter((file) => !file.raw?.type?.startsWith('video/'))
    .map((file) => ensurePublishPendingFileUrl(file))
    .filter(Boolean)

  const clickedFile = files[clickedIndex]
  const clickedUrl = clickedFile ? ensurePublishPendingFileUrl(clickedFile) : ''

  return {
    urls: previewableFiles,
    initialIndex: Math.max(previewableFiles.findIndex((url) => url === clickedUrl), 0)
  }
}

export const buildPublishPreviewStateFromUploaded = (
  images: UploadedMediaItem[],
  clickedImage: UploadedMediaItem,
  formatUrl: (url: string) => string
) => {
  const previewableImages = images
    .filter((image) => image.image_type !== 'video')
    .map((image) => formatUrl(image.image_url))
    .filter(Boolean)

  const clickedUrl = formatUrl(clickedImage.image_url)

  return {
    urls: previewableImages,
    initialIndex: Math.max(previewableImages.findIndex((url) => url === clickedUrl), 0)
  }
}

export const hasPublishMediaFiles = (
  uploadedFiles: UploadedMediaItem[],
  pendingFiles: PendingUploadFile[]
) => uploadedFiles.length > 0 || pendingFiles.length > 0
