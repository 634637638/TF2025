'use strict'

const {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  createPrivateFileUrl,
  verifyPrivateFileAccess
} = require('./private-file-access')
const SHARED_FILE_PATTERN = /^\/uploads\/shared\/([a-zA-Z0-9._-]+)$/

function normalizeFilename(filename) {
  const value = String(filename || '')
  return /^[a-zA-Z0-9._-]+$/.test(value) ? value : ''
}

function createSharedFileUrl(storageUrl, userId, options = {}) {
  const match = String(storageUrl || '').match(SHARED_FILE_PATTERN)
  const normalizedUserId = Number(userId)
  if (!match || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return String(storageUrl || '')

  const filename = match[1]
  return createPrivateFileUrl({
    routePrefix: '/api/shared/files',
    relativePath: filename,
    userId: normalizedUserId,
    namespace: 'shared-file',
    ...options
  })
}

function verifySharedFileAccess({ filename, userId, expires, signature }, options = {}) {
  const normalizedFilename = normalizeFilename(filename)
  const normalizedUserId = Number(userId)
  if (!normalizedFilename || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return false
  return verifyPrivateFileAccess({
    namespace: 'shared-file',
    relativePath: normalizedFilename,
    userId: normalizedUserId,
    expires,
    signature
  }, options)
}

function storageUrlFromSharedFileUrl(value) {
  const raw = String(value || '')
  if (SHARED_FILE_PATTERN.test(raw)) return raw
  const match = raw.match(/^\/api\/shared\/files\/([^?#/]+)(?:[?#].*)?$/)
  if (!match) return ''
  try {
    const filename = decodeURIComponent(match[1])
    return normalizeFilename(filename) ? `/uploads/shared/${filename}` : ''
  } catch (_) {
    return ''
  }
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  createSharedFileUrl,
  storageUrlFromSharedFileUrl,
  verifySharedFileAccess
}
