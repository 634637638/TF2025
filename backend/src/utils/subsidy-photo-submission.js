'use strict'

const { verifyPrivateFileAccess } = require('./private-file-access')
const { normalizeSubsidyPhotoPath } = require('./subsidy-protected-photo-url')
const { encodeSubsidyPhotoUrl } = require('./subsidy-photo-storage')

const normalizeSubsidyPhotoStorageUrls = (photos = []) => {
  if (!Array.isArray(photos)) {
    const error = new Error('国补照片格式不正确')
    error.statusCode = 400
    throw error
  }
  return photos.map(photo => {
    const relativePath = normalizeSubsidyPhotoPath(photo)
    if (!relativePath) {
      const error = new Error('国补照片地址无效')
      error.statusCode = 400
      throw error
    }
    return encodeSubsidyPhotoUrl(relativePath)
  })
}

const validateSubmittedSubsidyPhotos = async ({
  submittedPhotos,
  storedPhotos,
  userId,
  hasReference,
  database,
  recordId = null,
  existingPaths = new Set()
}) => {
  for (let index = 0; index < storedPhotos.length; index += 1) {
    const relativePath = normalizeSubsidyPhotoPath(storedPhotos[index])
    if (!relativePath || existingPaths.has(relativePath)) continue

    const parsedUrl = new URL(String(submittedPhotos[index]), 'http://localhost')
    const validSignature = verifyPrivateFileAccess({
      namespace: 'subsidy-file',
      relativePath,
      userId,
      expires: parsedUrl.searchParams.get('expires'),
      signature: parsedUrl.searchParams.get('signature')
    })
    if (!validSignature || Number(parsedUrl.searchParams.get('user')) !== Number(userId)) {
      const error = new Error('国补照片链接无效、已过期或不属于当前用户')
      error.statusCode = 400
      throw error
    }
    const referenced = hasReference
      ? await hasReference(relativePath)
      : await (async () => {
        const sql = recordId
          ? 'SELECT id FROM national_subsidies WHERE id <> ? AND subsidy_photos LIKE ? LIMIT 1'
          : 'SELECT id FROM national_subsidies WHERE subsidy_photos LIKE ? LIMIT 1'
        const params = recordId ? [recordId, `%${relativePath}%`] : [`%${relativePath}%`]
        const [references] = await database.execute(sql, params)
        return references.length > 0
      })()
    if (referenced) {
      const error = new Error('国补照片已被其他记录使用')
      error.statusCode = 400
      throw error
    }
  }
}

module.exports = { normalizeSubsidyPhotoStorageUrls, validateSubmittedSubsidyPhotos }
