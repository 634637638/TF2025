'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { getUploadsRoot } = require('../utils/upload-paths')
const { normalizeSubsidyPhotoPath } = require('../utils/subsidy-protected-photo-url')

const SubsidyPhotosRepository = require('../repositories/subsidy-photos.repository')
const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const dataMaskingService = require('./data-masking.service')

class SubsidyFileService {
  constructor({ fileSystem = fs, uploadsRoot = getUploadsRoot, repository = new SubsidyPhotosRepository(),
    checkPermission = hasUnifiedPermission, masking = dataMaskingService } = {}) {
    this.fileSystem = fileSystem
    this.uploadsRoot = uploadsRoot
    this.repository = repository
    this.checkPermission = checkPermission
    this.masking = masking
  }

  async getAuthorizedFilePath(requestedPath, actor) {
    const absolutePath = this.getFilePath(requestedPath)
    const relativePath = normalizeSubsidyPhotoPath(`/uploads/${requestedPath}`)
    const scope = resolveStoreScope(actor)
    const canUpload = await this.checkPermission(actor, 'subsidy:upload')
    const canView = await this.checkPermission(actor, 'subsidy:view')
    if (!canUpload && !canView) throw Object.assign(new Error('缺少国补照片权限'), { statusCode: 403 })
    const candidates = await this.repository.findPhotoReferences(relativePath)
    const records = candidates.filter(record => {
      const photos = typeof record.subsidy_photos === 'string' ? JSON.parse(record.subsidy_photos) : record.subsidy_photos
      return Array.isArray(photos) && photos.some(photo => normalizeSubsidyPhotoPath(photo) === relativePath)
    })
    if (records.length) {
      // 同一照片若意外被多店引用，须同时具备所有关联门店范围。
      for (const record of records) assertStoreInScope(scope, record.store_id)
      const fields = await this.masking.getUserFieldPermissions(actor.id, 'subsidy_subsidyview')
      if (!canUpload && fields.hiddenFields.includes('subsidy_info.subsidy_photos')) {
        throw Object.assign(new Error('无权查看国补照片字段'), { statusCode: 403 })
      }
    } else if (!canUpload || (!scope.allStores && !scope.storeIds.length)) {
      throw Object.assign(new Error('无权查看未保存的国补照片'), { statusCode: 403 })
    }
    return absolutePath
  }

  getFilePath(requestedPath) {
    const relativePath = normalizeSubsidyPhotoPath(`/uploads/${requestedPath}`)
    if (!relativePath) {
      throw Object.assign(new Error('无效的文件路径'), { statusCode: 400 })
    }

    const uploadsRoot = path.resolve(this.uploadsRoot())
    const absolutePath = path.resolve(uploadsRoot, relativePath)
    const pathFromRoot = path.relative(uploadsRoot, absolutePath)
    if (!pathFromRoot || pathFromRoot.startsWith('..') || path.isAbsolute(pathFromRoot)) {
      throw Object.assign(new Error('禁止访问该文件'), { statusCode: 403 })
    }

    if (!this.fileSystem.existsSync(absolutePath)) {
      throw Object.assign(new Error('文件不存在'), { statusCode: 404 })
    }

    return absolutePath
  }
}

module.exports = SubsidyFileService
