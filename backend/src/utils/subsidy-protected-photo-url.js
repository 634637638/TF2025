'use strict'

const path = require('path')
const { getRelativeUploadPathFromUrl } = require('./upload-paths')
const { createPrivateFileUrl } = require('./private-file-access')

const SUBSIDY_UPLOAD_PREFIX = 'subsidy/'

const normalizeSubsidyPhotoPath = (photoUrl) => {
  const relativePath = getRelativeUploadPathFromUrl(photoUrl)
  if (!relativePath || !relativePath.startsWith(SUBSIDY_UPLOAD_PREFIX)) return ''

  const normalizedPath = path.posix.normalize(relativePath)
  if (normalizedPath.startsWith('../') || normalizedPath.includes('/../') || normalizedPath === '..') return ''
  return normalizedPath
}

const buildProtectedSubsidyPhotoUrl = (photoUrl, userId) => {
  const relativePath = normalizeSubsidyPhotoPath(photoUrl)
  if (!relativePath) return photoUrl

  return createPrivateFileUrl({
    routePrefix: '/api/subsidy/files',
    relativePath,
    userId,
    namespace: 'subsidy-file',
    ttlSeconds: 10 * 60
  }) || photoUrl
}

const mapSubsidyPhotoUrls = (photos = [], userId) => (
  Array.isArray(photos) ? photos.map(photo => buildProtectedSubsidyPhotoUrl(photo, userId)) : []
)

module.exports = { normalizeSubsidyPhotoPath, buildProtectedSubsidyPhotoUrl, mapSubsidyPhotoUrls }
