'use strict'

const log = require('../utils/log')
const ApiResponse = require('../utils/response')
const SubsidyPhotosService = require('../services/subsidy-photos.service')
const SubsidyPhotoUploadService = require('../services/subsidy-photo-upload.service')

class SubsidyPhotosController {
  constructor({ service = new SubsidyPhotosService(), uploadService = new SubsidyPhotoUploadService(), logger = log } = {}) {
    this.service = service
    this.uploadService = uploadService
    this.logger = logger
  }

  async getPhotos(req, res) {
    try {
      const photos = await this.service.getPhotos(req.params.id, req.user.id)
      if (photos === null) return res.status(404).json({ success: false, message: '国补记录不存在' })
      return res.json({ success: true, data: { subsidy_photos: photos } })
    } catch (error) {
      this.logger.error('读取国补照片失败:', error)
      return res.status(500).json({ success: false, message: '读取国补照片失败', error: error.message })
    }
  }

  async uploadPhoto(req, res) {
    try {
      const result = await this.uploadService.upload(req.file, req.body || {}, req.user.id)
      if (result.status !== 200) return ApiResponse.error(res, result.message, result.status)
      return ApiResponse.success(res, '照片上传成功', result.data)
    } catch (error) {
      this.logger.error('上传国补照片失败:', error)
      return ApiResponse.error(res, error.message || '照片上传失败', 500)
    }
  }

  async updatePhotos(req, res) {
    try {
      const result = await this.service.updatePhotos(
        req.params.id,
        req.body?.subsidy_photos,
        req.body?.deleted_photos,
        req.user.id
      )
      if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message })
      return res.json({ success: true, message: '照片保存成功' })
    } catch (error) {
      this.logger.error('保存国补照片失败:', error)
      const statusCode = error.statusCode || 500
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 400 ? error.message : '照片保存失败'
      })
    }
  }

  async deleteTemporaryPhotos(req, res) {
    try {
      const result = await this.service.deleteTemporaryPhotos(req.body?.photos, req.user.id)
      if (result.empty) return ApiResponse.success(res, '没有需要删除的照片')
      return ApiResponse.success(res, `已清理 ${result.deleted.length} 个临时文件`, {
        deleted: result.deleted.length,
        failed: result.failed.length
      })
    } catch (error) {
      this.logger.error('删除临时照片失败:', error)
      return ApiResponse.error(res, error.message || '删除临时照片失败', 500)
    }
  }

  async deleteRecord(req, res) {
    try {
      const deleted = await this.service.deleteRecord(req.params.id)
      if (!deleted) return res.status(404).json({ success: false, message: '国补记录不存在' })
      return res.json({ success: true, message: '删除成功' })
    } catch (error) {
      this.logger.error('❌ 删除国补记录失败:', error)
      return res.status(500).json({ success: false, message: '删除失败', error: error.message })
    }
  }
}

module.exports = SubsidyPhotosController
