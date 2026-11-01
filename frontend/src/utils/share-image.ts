const MAX_SHARE_IMAGE_DIMENSION = 8192
const MAX_SHARE_IMAGE_PIXELS = 8_000_000

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('生成分享图片失败'))
  }, 'image/jpeg', 0.88)
})

const sanitizeFileName = (fileName: string) => fileName
  .replace(/[\\/:*?"<>|]/g, '_')
  .replace(/\.(?:png|jpe?g|webp)$/i, '')

/** 分享时压缩为受限尺寸的 JPEG，避免 iOS 分享扩展解码大 PNG 时退出。 */
export const createShareImageFile = async (source: HTMLCanvasElement, fileName: string) => {
  const pixelScale = Math.sqrt(MAX_SHARE_IMAGE_PIXELS / (source.width * source.height))
  const dimensionScale = MAX_SHARE_IMAGE_DIMENSION / Math.max(source.width, source.height)
  const scale = Math.min(1, pixelScale, dimensionScale)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法生成分享图片画布')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)

  const blob = await canvasToBlob(canvas)
  const safeName = sanitizeFileName(fileName)
  return new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' })
}
