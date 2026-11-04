'use strict'

const { createHmacSignature, verifyHmacSignature } = require('./security-keyring')

const TOKEN_TTL_SECONDS = 10 * 60
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/avif'])

function guideFilePayload(fileId, expiresAt) {
  return `${fileId}:${expiresAt}`
}

function signGuideFile(fileId, expiresAt, sourceKey) {
  return createHmacSignature('FILE_ACCESS', guideFilePayload(fileId, expiresAt), 'hex', sourceKey)
}

function createGuideFileAccess(fileId, options = {}) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const signature = signGuideFile(fileId, expiresAt, options.sourceKey)
  return { url: `/api/public/guide/files/${Number(fileId)}`, expires_at: expiresAt, signature }
}

function verifyGuideFileToken(fileId, expiresAtValue, signature, options = {}) {
  if (!Number.isSafeInteger(Number(fileId)) || Number(fileId) <= 0) return false
  const expiresAt = Number(expiresAtValue)
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false
  if (expiresAt > Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS + 30) return false
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false

  return verifyHmacSignature(
    'FILE_ACCESS',
    guideFilePayload(fileId, expiresAt),
    signature,
    'hex',
    {
      current: options.sourceKey,
      previous: options.previousSourceKey
    }
  )
}

function getGuideFileDisposition(mimeType) {
  return IMAGE_MIME_TYPES.has(String(mimeType || '').toLowerCase()) ? 'inline' : 'attachment'
}

function encodeGuideFileName(fileName) {
  const safeName = String(fileName || 'download')
    .replace(/[\r\n\\/\0-\x1f\x7f]/g, '_')
    .trim() || 'download'
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  return `filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
}

module.exports = { createGuideFileAccess, verifyGuideFileToken, getGuideFileDisposition, encodeGuideFileName, TOKEN_TTL_SECONDS }
