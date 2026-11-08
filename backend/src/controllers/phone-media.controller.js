'use strict'

const ApiResponse = require('../utils/response')
const ShopService = require('../services/shop.service')
const log = require('../utils/log')
const { archivePhoneMediaUpload } = require('../utils/phone-media-storage')
const database = require('../config/database')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')

const shopService = new ShopService()

const getPhoneId = req => req.params.phoneId || req.params.id

async function list(req, res) {
  try {
    const images = await shopService.getPhoneImages(getPhoneId(req))
    return ApiResponse.success(res, images, '获取图片成功')
  } catch (error) {
    log.error('获取商品图片失败:', error)
    return ApiResponse.error(res, error.message || '获取图片失败', 500)
  }
}

async function setPrimary(req, res) {
  try {
    await shopService.setPrimaryImage(req.params.imageId || req.params.id)
    return ApiResponse.success(res, null, '设置主图成功')
  } catch (error) {
    log.error('设置商品主图失败:', error)
    return ApiResponse.error(res, error.message || '设置主图失败', 500)
  }
}

async function remove(req, res) {
  try {
    await shopService.deleteImage(req.params.imageId || req.params.id)
    return ApiResponse.success(res, null, '删除图片成功')
  } catch (error) {
    log.error('删除商品图片失败:', error)
    return ApiResponse.error(res, error.message || '删除图片失败', 500)
  }
}

async function reorder(req, res) {
  try {
    const imageIds = req.body.imageIds ?? req.body.image_ids
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return ApiResponse.error(res, '图片ID列表不能为空', 400)
    }

    await shopService.reorderPhoneImages(getPhoneId(req), imageIds)
    return ApiResponse.success(res, null, '图片排序更新成功')
  } catch (error) {
    log.error('商品图片排序失败:', error)
    return ApiResponse.error(res, error.message || '排序失败', 500)
  }
}

async function saveUploadedMedia({ phoneId, file, mediaType, uploadedBy }) {
  const fileUrl = await archivePhoneMediaUpload({
    phoneId,
    file,
    mediaRoot: mediaType === 'video' ? 'videos' : 'phones',
    database: database.getDatabase()
  })
  const id = await shopService.addPhoneImage(phoneId, fileUrl, mediaType, uploadedBy)
  return { id, url: fileUrl }
}

function createUploadHandler({
  mediaType,
  mediaLabel,
  validateSignature = validateUploadedFileSignature,
  removeFiles = removeUploadedFiles,
  saveMedia = saveUploadedMedia,
  logger = log
}) {
  return async function upload(req, res) {
    try {
      if (!req.file) {
        return ApiResponse.error(res, '没有上传文件', 400)
      }

      if (!(await validateSignature(req.file, [mediaType]))) {
        await removeFiles([req.file])
        return ApiResponse.error(res, `文件内容与${mediaLabel}格式不匹配`, 400)
      }

      const media = await saveMedia({
        phoneId: req.params.id,
        file: req.file,
        mediaType: mediaType === 'video' ? 'video' : 'inventory',
        uploadedBy: req.user ? req.user.id : 0
      })

      return ApiResponse.success(res, {
        ...media,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }, `${mediaLabel}上传成功`)
    } catch (error) {
      await removeFiles(req.file ? [req.file] : []).catch(() => {})
      logger.error(`上传${mediaLabel}失败:`, error)
      return ApiResponse.error(res, error.message || '上传失败', 500)
    }
  }
}

const uploadImage = createUploadHandler({ mediaType: 'image', mediaLabel: '图片' })
const uploadVideo = createUploadHandler({ mediaType: 'video', mediaLabel: '视频' })

module.exports = {
  list,
  setPrimary,
  remove,
  reorder,
  saveUploadedMedia,
  uploadImage,
  uploadVideo,
  createUploadHandler
}
