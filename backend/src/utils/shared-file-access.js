'use strict'

const { createHmacSignature, verifyHmacSignature } = require('./security-keyring')

const DEFAULT_TTL_SECONDS = 5 * 60
const MAX_TTL_SECONDS = 10 * 60
const SHARED_FILE_PATTERN = /^\/uploads\/shared\/([a-zA-Z0-9._-]+)$/

function signaturePayload(filename, userId, expires) {
  return `shared-file:${filename}:${userId}:${expires}`
}

function createSignature(filename, userId, expires, sourceKey) {
  return createHmacSignature(
    'FILE_ACCESS',
    signaturePayload(filename, userId, expires),
    'hex',
    sourceKey
  )
}

function normalizeFilename(filename) {
  const value = String(filename || '')
  return /^[a-zA-Z0-9._-]+$/.test(value) ? value : ''
}

function createSharedFileUrl(storageUrl, userId, options = {}) {
  const match = String(storageUrl || '').match(SHARED_FILE_PATTERN)
  const normalizedUserId = Number(userId)
  if (!match || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return String(storageUrl || '')

  const nowSeconds = Number.isInteger(options.nowSeconds)
    ? options.nowSeconds
    : Math.floor(Date.now() / 1000)
  const ttlSeconds = Math.min(MAX_TTL_SECONDS, Math.max(1, Number(options.ttlSeconds) || DEFAULT_TTL_SECONDS))
  const expires = nowSeconds + ttlSeconds
  const filename = match[1]
  const signature = createSignature(filename, normalizedUserId, expires, options.sourceKey)
  return `/api/shared/files/${encodeURIComponent(filename)}?user=${normalizedUserId}&expires=${expires}&signature=${signature}`
}

function verifySharedFileAccess({ filename, userId, expires, signature }, options = {}) {
  const normalizedFilename = normalizeFilename(filename)
  const normalizedUserId = Number(userId)
  const normalizedExpires = Number(expires)
  const normalizedSignature = String(signature || '')
  const nowSeconds = Number.isInteger(options.nowSeconds)
    ? options.nowSeconds
    : Math.floor(Date.now() / 1000)

  if (!normalizedFilename || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return false
  if (!Number.isInteger(normalizedExpires) || normalizedExpires < nowSeconds || normalizedExpires > nowSeconds + MAX_TTL_SECONDS) return false
  if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) return false

  return verifyHmacSignature(
    'FILE_ACCESS',
    signaturePayload(normalizedFilename, normalizedUserId, normalizedExpires),
    normalizedSignature,
    'hex',
    {
      current: options.sourceKey,
      previous: options.previousSourceKey
    }
  )
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
