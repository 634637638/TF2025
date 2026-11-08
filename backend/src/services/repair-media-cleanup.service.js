'use strict'

const fs = require('fs')
const path = require('path')
const { getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('../utils/upload-paths')

const MAX_TEMP_MEDIA_AGE_MS = 2 * 60 * 60 * 1000
const OWNER_REQUIRED_MESSAGE = '只能清理本人上传的维修临时媒体'

class RepairMediaCleanupService {
  constructor({ filesystem = fs, getRelativePath = getRelativeUploadPathFromUrl, resolvePath = getUploadPathFromUrl, now = Date.now } = {}) {
    this.filesystem = filesystem
    this.getRelativePath = getRelativePath
    this.resolvePath = resolvePath
    this.now = now
  }

  async cleanup(files, userId) {
    const urls = Array.isArray(files) ? files : []
    for (const url of urls) {
      const relative = this.getRelativePath(url)
      const filename = path.basename(relative)
      if (!relative.startsWith('repairs/temp/') || !filename.startsWith(`${Number(userId)}_`)) {
        throw Object.assign(new Error(OWNER_REQUIRED_MESSAGE), { statusCode: 403, code: 'REPAIR_MEDIA_OWNER_REQUIRED' })
      }
    }

    await Promise.all(urls.map(async url => {
      const filePath = this.resolvePath(url)
      try {
        const metadata = await this.filesystem.promises.stat(filePath)
        if (metadata.isFile() && this.now() - metadata.mtimeMs <= MAX_TEMP_MEDIA_AGE_MS) {
          await this.filesystem.promises.unlink(filePath)
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }))
  }
}

module.exports = RepairMediaCleanupService
