'use strict'

const log = require('../utils/log')
const fs = require('node:fs')
const path = require('node:path')
const { getUploadsRoot, getUploadSubdir } = require('../utils/upload-paths')
const { getRelativeUploadPathFromUrl } = require('../utils/upload-paths')
const { verifyPrivateFileAccess } = require('../utils/private-file-access')
const { normalizeSubsidyPhotoPath, buildProtectedSubsidyPhotoUrl } = require('../utils/subsidy-protected-photo-url')
const { clearCache } = require('../middleware/cache')
const SubsidyPhotosRepository = require('../repositories/subsidy-photos.repository')
const { normalizeSubsidyPhotoStorageUrls, validateSubmittedSubsidyPhotos } = require('../utils/subsidy-photo-submission')

const SUBSIDY_UPLOAD_PREFIX = 'subsidy/'

class SubsidyPhotosService {
  constructor({
    repository = new SubsidyPhotosRepository(),
    logger = log,
    fileSystem = fs,
    uploadsRoot = getUploadsRoot,
    subsidyRoot = () => getUploadSubdir('subsidy'),
    relativePathFromUrl = getRelativeUploadPathFromUrl,
    verifyAccess = verifyPrivateFileAccess,
    now = Date.now,
    invalidateCache = clearCache
  } = {}) {
    this.repository = repository
    this.logger = logger
    this.fileSystem = fileSystem
    this.uploadsRoot = uploadsRoot
    this.subsidyRoot = subsidyRoot
    this.relativePathFromUrl = relativePathFromUrl
    this.verifyAccess = verifyAccess
    this.now = now
    this.invalidateCache = invalidateCache
  }

  async getPhotos(recordId, userId) {
    const storedPhotos = await this.repository.getPhotos(recordId)
    if (storedPhotos === null) return null

    let photos = []
    if (storedPhotos) {
      try {
        photos = typeof storedPhotos === 'string' ? JSON.parse(storedPhotos) : storedPhotos
      } catch (error) {
        this.logger.warn('国补照片数据格式异常', { id: recordId, error: error.message })
      }
    }
    return (Array.isArray(photos) ? photos : []).map(photo => buildProtectedSubsidyPhotoUrl(photo, userId))
  }

  async updatePhotos(recordId, submittedPhotos, deletedPhotos, userId) {
    if (!Array.isArray(submittedPhotos) || !submittedPhotos.every(photo => typeof photo === 'string')) {
      return { status: 400, message: '国补照片格式不正确' }
    }
    if (deletedPhotos !== undefined && (!Array.isArray(deletedPhotos) || !deletedPhotos.every(photo => typeof photo === 'string'))) {
      return { status: 400, message: '待删除照片格式不正确' }
    }

    const storedPhotos = normalizeSubsidyPhotoStorageUrls(submittedPhotos)
    let removedPaths = []
    const result = await this.repository.withConnection(async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const record = await this.repository.getPhotosForUpdate(connection, recordId)
        if (!record) {
          await connection.rollback()
          transactionStarted = false
          return { status: 404, message: '国补记录不存在' }
        }

        const previousPhotos = this.parsePhotos(record.subsidy_photos)
        const previousPaths = new Map(previousPhotos.map(photo => {
          const safePath = this.getSafePhotoPath(photo)
          return safePath ? [safePath.relativePath, safePath] : null
        }).filter(Boolean))
        const nextPaths = new Set(storedPhotos.map(photo => normalizeSubsidyPhotoPath(photo)).filter(Boolean))
        removedPaths = [...previousPaths.entries()]
          .filter(([relativePath]) => !nextPaths.has(relativePath))
          .map(([, safePath]) => safePath)

        await validateSubmittedSubsidyPhotos({
          submittedPhotos,
          storedPhotos,
          userId,
          existingPaths: new Set(previousPaths.keys()),
          hasReference: relativePath => this.repository.hasOtherPhotoReference(connection, relativePath, recordId)
        })

        if (deletedPhotos !== undefined) {
          const requestedDeletedPaths = new Set(deletedPhotos.map(photo => normalizeSubsidyPhotoPath(photo)))
          if (requestedDeletedPaths.has('') || [...requestedDeletedPaths].some(relativePath => (
            !previousPaths.has(relativePath) || nextPaths.has(relativePath)
          ))) {
            await connection.rollback()
            transactionStarted = false
            return { status: 400, message: '待删除照片不属于当前记录或仍在使用' }
          }
        }

        await this.repository.updatePhotos(connection, recordId, storedPhotos)
        await connection.commit()
        transactionStarted = false
        return { status: 200 }
      } catch (error) {
        if (transactionStarted) await connection.rollback().catch(rollbackError => {
          this.logger.error('保存国补照片事务回滚失败:', rollbackError)
        })
        throw error
      }
    })

    if (result.status !== 200) return result
    for (const photoPath of removedPaths) {
      if (this.fileSystem.existsSync(photoPath.absolutePath)) {
        try {
          this.fileSystem.unlinkSync(photoPath.absolutePath)
          this.removeEmptyPhotoDirectories(photoPath.relativePath)
        } catch (error) {
          this.logger.warn('清理已移除国补照片失败:', error)
        }
      }
    }
    this.invalidateCache('/subsidy')
    return result
  }

  parsePhotos(value) {
    if (Array.isArray(value)) return value.filter(photo => typeof photo === 'string' && photo.trim())
    if (typeof value !== 'string' || !value.trim()) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter(photo => typeof photo === 'string' && photo.trim()) : []
    } catch {
      return []
    }
  }

  getSafePhotoPath(photoUrl) {
    const relativePath = normalizeSubsidyPhotoPath(photoUrl)
    if (!relativePath) return null

    const root = path.resolve(this.uploadsRoot())
    const absolutePath = path.resolve(root, relativePath)
    if (absolutePath === root || !absolutePath.startsWith(`${root}${path.sep}`)) return null
    return { relativePath, absolutePath }
  }

  removeEmptyPhotoDirectories(relativePhotoPath) {
    const relativePath = normalizeSubsidyPhotoPath(
      String(relativePhotoPath || '').startsWith(SUBSIDY_UPLOAD_PREFIX)
        ? `/uploads/${relativePhotoPath}`
        : relativePhotoPath
    )
    if (!relativePath) return

    const root = path.resolve(this.subsidyRoot())
    let directory = path.dirname(path.resolve(this.uploadsRoot(), relativePath))
    while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
      if (!this.fileSystem.existsSync(directory) || this.fileSystem.readdirSync(directory).length > 0) break
      this.fileSystem.rmdirSync(directory)
      directory = path.dirname(directory)
    }
  }

  async deleteTemporaryPhotos(photos, userId) {
    if (!Array.isArray(photos) || photos.length === 0) {
      return { empty: true, deleted: [], failed: [] }
    }

    const deleted = []
    const failed = []
    for (const photoUrl of photos) {
      try {
        const photoPath = this.getSafePhotoPath(photoUrl)
        if (!photoPath) {
          failed.push(photoUrl)
          continue
        }

        const parsedUrl = new URL(String(photoUrl), 'http://localhost')
        const signedPath = this.relativePathFromUrl(photoUrl)
        const validSignature = this.verifyAccess({
          namespace: 'subsidy-file',
          relativePath: signedPath,
          userId,
          expires: parsedUrl.searchParams.get('expires'),
          signature: parsedUrl.searchParams.get('signature')
        })
        if (!validSignature || Number(parsedUrl.searchParams.get('user')) !== Number(userId)) {
          failed.push(photoUrl)
          continue
        }

        if (await this.repository.hasPhotoReference(photoPath.relativePath)) {
          failed.push(photoUrl)
          continue
        }

        if (this.fileSystem.existsSync(photoPath.absolutePath)) {
          const stats = this.fileSystem.statSync(photoPath.absolutePath)
          if (!stats.isFile() || this.now() - stats.mtimeMs > 2 * 60 * 60 * 1000) {
            failed.push(photoUrl)
            continue
          }
          this.fileSystem.unlinkSync(photoPath.absolutePath)
          this.removeEmptyPhotoDirectories(photoPath.relativePath)
          deleted.push(photoPath.relativePath)
        }
      } catch (error) {
        const photoPath = this.relativePathFromUrl(photoUrl)
        this.logger.error('删除临时国补照片失败', {
          path: typeof photoPath === 'string' ? photoPath : '',
          error: error.message
        })
        failed.push(photoUrl)
      }
    }
    return { empty: false, deleted, failed }
  }

  async deleteRecord(recordId) {
    const record = await this.repository.findRecordForDelete(recordId)
    if (!record) return false

    await this.repository.deleteRecord(recordId)
    if (record.subsidy_photos) {
      try {
        const photos = typeof record.subsidy_photos === 'string'
          ? JSON.parse(record.subsidy_photos)
          : record.subsidy_photos

        if (Array.isArray(photos)) {
          for (const photoUrl of photos) {
            const photoPath = this.getSafePhotoPath(photoUrl)
            if (photoPath && this.fileSystem.existsSync(photoPath.absolutePath)) {
              this.fileSystem.unlinkSync(photoPath.absolutePath)
              this.removeEmptyPhotoDirectories(photoPath.relativePath)
            }
          }
        }
      } catch (error) {
        this.logger.error('⚠️ 删除照片文件失败:', error)
      }
    }

    this.invalidateCache('/subsidy')
    return true
  }
}

module.exports = SubsidyPhotosService
