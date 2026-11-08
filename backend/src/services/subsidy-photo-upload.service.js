'use strict'

const fs = require('node:fs')
const path = require('node:path')
const convertHeic = require('heic-convert')
const { getUploadSubdir } = require('../utils/upload-paths')
const { getSubsidyPhotoNaming } = require('../utils/subsidy-photo-storage')
const { buildProtectedSubsidyPhotoUrl } = require('../utils/subsidy-protected-photo-url')

class SubsidyPhotoUploadService {
  constructor({
    fileSystem = fs,
    pathModule = path,
    convert = convertHeic,
    uploadSubdir = getUploadSubdir,
    getNaming = getSubsidyPhotoNaming,
    createProtectedUrl = buildProtectedSubsidyPhotoUrl,
    removeEmptyDirectories = () => {},
    now = Date.now,
    logger = require('../utils/log')
  } = {}) {
    this.fileSystem = fileSystem
    this.path = pathModule
    this.convert = convert
    this.uploadSubdir = uploadSubdir
    this.getNaming = getNaming
    this.createProtectedUrl = createProtectedUrl
    this.removeEmptyDirectories = removeEmptyDirectories
    this.now = now
    this.logger = logger
  }

  async upload(file, body, userId) {
    if (!file) return { status: 400, message: '没有上传文件' }
    const temporaryFilePath = file.path
    let photoDirectoryPath = ''
    try {
      const naming = this.getNaming(body)
      const timestamp = this.now()
      const safeDisplayName = naming.displayName
      const safeName = naming.isSecondHand ? naming.displayName : naming.directoryName.slice(safeDisplayName.length)
      const safeSaleTime = String(body.sale_time || '').replace(/[^0-9\-]/g, '')
      const photoDirectoryName = naming.directoryName
      const photoDirectory = this.uploadSubdir('subsidy', photoDirectoryName)
      photoDirectoryPath = photoDirectory
      this.fileSystem.mkdirSync(photoDirectory, { recursive: true })

      const extension = this.path.extname(file.originalname).toLowerCase()
      const filename = `${safeDisplayName}-${safeName}-${safeSaleTime}-${timestamp}${extension}`
      const newPath = this.path.join(photoDirectory, filename)
      let finalFilename = filename

      if (extension === '.heic' || extension === '.heif') {
        try {
          const jpegFilename = `${safeDisplayName}-${safeName}-${safeSaleTime}-${timestamp}.jpg`
          const jpegPath = this.path.join(photoDirectory, jpegFilename)
          const outputBuffer = await this.convert({
            buffer: this.fileSystem.readFileSync(temporaryFilePath),
            format: 'JPEG',
            quality: 0.9
          })
          this.fileSystem.writeFileSync(jpegPath, outputBuffer)
          this.fileSystem.unlinkSync(temporaryFilePath)
          finalFilename = jpegFilename
        } catch (error) {
          this.logger.error('国补 HEIC 转换失败:', error)
          if (this.fileSystem.existsSync(temporaryFilePath)) this.fileSystem.unlinkSync(temporaryFilePath)
          this.removeEmptyDirectories(this.path.posix.join('subsidy', photoDirectoryName, filename))
          return { status: 500, message: 'HEIC格式转换失败' }
        }
      } else {
        this.fileSystem.renameSync(temporaryFilePath, newPath)
      }

      const relativeFilename = this.path.posix.join('subsidy', photoDirectoryName, finalFilename)
      return {
        status: 200,
        data: {
          url: this.createProtectedUrl(`/uploads/${relativeFilename}`, userId),
          filename: relativeFilename,
          size: file.size
        }
      }
    } catch (error) {
      if (temporaryFilePath && this.fileSystem.existsSync(temporaryFilePath)) {
        this.fileSystem.unlinkSync(temporaryFilePath)
      }
      if (photoDirectoryPath && this.fileSystem.existsSync(photoDirectoryPath)) {
        this.removeEmptyDirectories(this.path.posix.join('subsidy', this.path.basename(photoDirectoryPath)))
      }
      throw error
    }
  }
}

module.exports = SubsidyPhotoUploadService
