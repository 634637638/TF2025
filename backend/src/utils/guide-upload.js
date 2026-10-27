'use strict'

const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const { getUploadSubdir, getUploadUrl, getUploadPathFromUrl, getRelativeUploadPathFromUrl } = require('./upload-paths')

const GUIDE_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000
const GUIDE_DRAFT_FILENAME = /^draft_[0-9]+_[a-f0-9]{20}\.[a-z0-9]{1,10}$/i

const createGuideDraftFilename = extension => `draft_${Date.now()}_${crypto.randomBytes(10).toString('hex')}${extension}`

const getGuideDraftPath = fileUrl => {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl)
  const segments = relativePath.split('/')
  if (segments.length !== 2 || segments[0] !== 'guide' || !GUIDE_DRAFT_FILENAME.test(segments[1])) return null
  const filePath = getUploadPathFromUrl(fileUrl)
  const guideRoot = path.resolve(getUploadSubdir('guide'))
  return filePath.startsWith(`${guideRoot}${path.sep}`) ? filePath : null
}

const isGuideDraftUrl = fileUrl => Boolean(getGuideDraftPath(fileUrl))

async function promoteGuideDraft(fileUrl) {
  const draftPath = getGuideDraftPath(fileUrl)
  if (!draftPath) return { fileUrl, promoted: false, filePath: null }
  const extension = path.extname(draftPath).toLowerCase()
  const finalFilename = `${Date.now()}_${crypto.randomBytes(10).toString('hex')}${extension}`
  const finalPath = path.join(getUploadSubdir('guide'), finalFilename)
  await fs.rename(draftPath, finalPath)
  return { fileUrl: getUploadUrl('guide', finalFilename), promoted: true, filePath: finalPath }
}

async function removeGuideDraft(fileUrl) {
  const filePath = getGuideDraftPath(fileUrl)
  if (!filePath) return false
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function cleanupExpiredGuideDrafts() {
  const guideDir = getUploadSubdir('guide')
  let entries = []
  try {
    entries = await fs.readdir(guideDir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }

  const cutoff = Date.now() - GUIDE_DRAFT_MAX_AGE_MS
  let deleted = 0
  for (const entry of entries) {
    if (!entry.isFile() || !GUIDE_DRAFT_FILENAME.test(entry.name)) continue
    const filePath = path.join(guideDir, entry.name)
    const stats = await fs.stat(filePath).catch(() => null)
    if (!stats || stats.mtimeMs > cutoff) continue
    await fs.unlink(filePath).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
    deleted += 1
  }
  return deleted
}

module.exports = {
  GUIDE_DRAFT_MAX_AGE_MS,
  createGuideDraftFilename,
  isGuideDraftUrl,
  promoteGuideDraft,
  removeGuideDraft,
  cleanupExpiredGuideDrafts
}
