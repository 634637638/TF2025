export type MediaPreviewItemId = number | string

export interface MediaPreviewItem {
  id?: MediaPreviewItemId
  url: string
  type?: string
  name?: string
  label?: string
}

interface MediaLike {
  url?: unknown
  src?: unknown
  image_url?: unknown
  type?: unknown
  image_type?: unknown
  mime_type?: unknown
  name?: unknown
}

const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|ogg|ogv|mov|m4v)(?:$|[?#])/i

const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export const isVideoMedia = (media?: string | MediaLike | null): boolean => {
  if (!media) return false

  if (typeof media === 'string') {
    return VIDEO_EXTENSION_PATTERN.test(media)
  }

  const declaredTypes = [media.image_type, media.mime_type, media.type]
    .map(value => stringValue(value).toLowerCase())
    .filter(Boolean)

  if (declaredTypes.some(type => type === 'video' || type.startsWith('video/'))) {
    return true
  }

  const source = [media.image_url, media.url, media.src, media.name]
    .map(stringValue)
    .find(Boolean)

  return source ? VIDEO_EXTENSION_PATTERN.test(source) : false
}

