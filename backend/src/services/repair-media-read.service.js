'use strict'

const fs = require('fs')
const path = require('path')
const { getUploadSubdir, getUploadPathFromUrl } = require('../utils/upload-paths')
const { verifyPrivateFileAccess } = require('../utils/private-file-access')

const serviceError = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code })

class RepairMediaReadService {
  constructor({ verifyAccess = verifyPrivateFileAccess, resolveUploadPath = getUploadPathFromUrl, getRepairDirectory = () => getUploadSubdir('repairs'), exists = fs.existsSync } = {}) {
    this.verifyAccess = verifyAccess
    this.resolveUploadPath = resolveUploadPath
    this.getRepairDirectory = getRepairDirectory
    this.exists = exists
  }

  resolve(requestedPath, query = {}) {
    const safeRequestedPath = typeof requestedPath === 'string' ? requestedPath : ''
    const validSignature = this.verifyAccess({
      namespace: 'repair-media',
      relativePath: safeRequestedPath,
      userId: query.user,
      expires: query.expires,
      signature: query.signature
    })
    if (!validSignature) throw serviceError('维修媒体链接无效或已过期', 403, 'INVALID_REPAIR_MEDIA_SIGNATURE')

    const relative = `repairs/${safeRequestedPath}`.replace(/\\/g, '/')
    if (!/^repairs\/(?:temp\/)?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?$/.test(relative)) {
      throw serviceError('无效的维修媒体路径', 400, 'INVALID_REPAIR_MEDIA_PATH')
    }

    const absolutePath = this.resolveUploadPath(`/uploads/${relative}`)
    const root = path.resolve(this.getRepairDirectory())
    if (!absolutePath.startsWith(`${root}${path.sep}`) || !this.exists(absolutePath)) {
      throw serviceError('维修媒体不存在', 404, 'REPAIR_MEDIA_NOT_FOUND')
    }
    return absolutePath
  }
}

module.exports = RepairMediaReadService
