import type { UploadRawFile } from 'element-plus'

export const MEDIA_UPLOAD_ACCEPT = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.mp4', '.webm', '.ogg', '.mov',
  '.pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'application/pdf'
].join(',')

export interface MediaFileValidationOptions {
  allowVideo?: boolean
  maxImageSizeMb?: number
  maxVideoSizeMb?: number
  maxPdfSizeMb?: number
}

const DEFAULT_OPTIONS: Required<MediaFileValidationOptions> = {
  allowVideo: true,
  maxImageSizeMb: 30,
  maxVideoSizeMb: 500,
  maxPdfSizeMb: 10
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'])

export const isPdfFile = (file: File | UploadRawFile) => {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export const isVideoFile = (file: File | UploadRawFile) => {
  return file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(file.name)
}

export const isHeicFile = (file: File | UploadRawFile) => {
  return /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)
}

export const validateMediaFile = (
  file: File | UploadRawFile,
  options: MediaFileValidationOptions = {}
): string | null => {
  const resolved = { ...DEFAULT_OPTIONS, ...options }
  const sizeMb = file.size / 1024 / 1024

  if (isPdfFile(file)) {
    if (sizeMb > resolved.maxPdfSizeMb) {
      return `PDF文件大小不能超过${resolved.maxPdfSizeMb}MB`
    }
    return null
  }

  if (isVideoFile(file)) {
    if (!resolved.allowVideo) {
      return '当前入口只支持图片或PDF文件'
    }
    if (sizeMb > resolved.maxVideoSizeMb) {
      return `视频文件大小不能超过${resolved.maxVideoSizeMb}MB`
    }
    return null
  }

  if (!IMAGE_MIME_TYPES.has(file.type.toLowerCase()) && !IMAGE_EXTENSIONS.test(file.name)) {
    return '只能上传图片、视频或PDF文件'
  }

  if (sizeMb > resolved.maxImageSizeMb) {
    return `图片文件大小不能超过${resolved.maxImageSizeMb}MB`
  }

  return null
}

/** 将 PDF 第一页渲染为 JPEG，PDF 原文件不进入图片业务表。 */
export const convertPdfToImage = async (pdfFile: File): Promise<File> => {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js'

  const pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 3 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建PDF渲染画布')

    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, canvasContext: context, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob)
        else reject(new Error('PDF转图片失败'))
      }, 'image/jpeg', 0.92)
    })

    const name = pdfFile.name.replace(/\.pdf$/i, '.jpg') || 'document.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: pdfFile.lastModified })
  } finally {
    await pdf.destroy()
  }
}

const convertHeicToImage = async (file: File): Promise<File> => {
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  const blob = Array.isArray(converted) ? converted[0] : converted
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'image.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
}

export const prepareMediaFile = async (
  file: File | UploadRawFile,
  options: MediaFileValidationOptions = {}
): Promise<File> => {
  const validationMessage = validateMediaFile(file, options)
  if (validationMessage) throw new Error(validationMessage)
  if (isPdfFile(file)) return convertPdfToImage(file)
  if (isHeicFile(file)) return convertHeicToImage(file)
  return file
}
