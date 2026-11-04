interface DownloadResponseEnvelope {
  data?: unknown
  status?: number
}

const ERROR_CONTENT_TYPE_PATTERN = /(?:application\/(?:problem\+)?json|text\/(?:json|html))/i

const asEnvelope = (response: unknown): DownloadResponseEnvelope | null => (
  response !== null && typeof response === 'object'
    ? response as DownloadResponseEnvelope
    : null
)

/**
 * 校验统一下载响应，拒绝非 2xx 状态和 JSON/HTML 错误体。
 */
export function extractBlobResponse(response: unknown): Blob {
  const envelope = asEnvelope(response)
  const status = envelope?.status
  if (typeof status === 'number' && (status < 200 || status >= 300)) {
    throw new Error(`下载请求失败 (${status})`)
  }

  const payload = response instanceof Blob ? response : envelope?.data
  if (!(payload instanceof Blob)) {
    throw new Error('下载响应不是有效文件')
  }
  if (ERROR_CONTENT_TYPE_PATTERN.test(payload.type || '')) {
    throw new Error('下载接口返回了错误内容')
  }
  return payload
}
