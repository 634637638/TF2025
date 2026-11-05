'use strict'

const { createHmacSignature, verifyHmacSignature } = require('./security-keyring')

const DEFAULT_TTL_SECONDS = 5 * 60
const MAX_TTL_SECONDS = 10 * 60

const normalizePrivatePath = value => {
  const normalized = String(value || '')
    .normalize('NFC')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!normalized || normalized.length > 512) return ''
  const segments = normalized.split('/')
  return segments.every(segment => /^[\p{L}\p{N}\p{M}._-]+$/u.test(segment) && segment !== '.' && segment !== '..')
    ? segments.join('/')
    : ''
}

const signaturePayload = (namespace, relativePath, userId, expires) => (
  `${namespace}:${relativePath}:${userId}:${expires}`
)

const createPrivateFileUrl = ({
  routePrefix,
  relativePath,
  userId,
  namespace,
  nowSeconds,
  ttlSeconds,
  sourceKey
}) => {
  const safePath = normalizePrivatePath(relativePath)
  const normalizedUserId = Number(userId)
  if (!safePath || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return ''

  const now = Number.isInteger(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000)
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(1, Number(ttlSeconds) || DEFAULT_TTL_SECONDS))
  const expires = now + ttl
  const signature = createHmacSignature(
    'FILE_ACCESS',
    signaturePayload(namespace, safePath, normalizedUserId, expires),
    'hex',
    sourceKey
  )
  const encodedPath = safePath.split('/').map(encodeURIComponent).join('/')
  return `${String(routePrefix).replace(/\/$/, '')}/${encodedPath}?user=${normalizedUserId}&expires=${expires}&signature=${signature}`
}

const verifyPrivateFileAccess = ({ namespace, relativePath, userId, expires, signature }, options = {}) => {
  const safePath = normalizePrivatePath(relativePath)
  const normalizedUserId = Number(userId)
  const normalizedExpires = Number(expires)
  const normalizedSignature = String(signature || '')
  const now = Number.isInteger(options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000)

  if (!safePath || !Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return false
  if (!Number.isInteger(normalizedExpires) || normalizedExpires < now || normalizedExpires > now + MAX_TTL_SECONDS) return false
  if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) return false

  return verifyHmacSignature(
    'FILE_ACCESS',
    signaturePayload(namespace, safePath, normalizedUserId, normalizedExpires),
    normalizedSignature,
    'hex',
    {
      current: options.sourceKey,
      previous: options.previousSourceKey
    }
  )
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  createPrivateFileUrl,
  normalizePrivatePath,
  verifyPrivateFileAccess
}
