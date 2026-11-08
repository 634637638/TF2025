'use strict'

const path = require('node:path')
const fs = require('node:fs')
const convert = require('heic-convert')
const ApiResponse = require('../utils/response')
const sharedService = require('../services/shared.service')
const dataMaskingService = require('../services/data-masking.service')
const log = require('../utils/log')
const { getUploadUrl } = require('../utils/upload-paths')
const { createSharedFileUrl, verifySharedFileAccess } = require('../utils/shared-file-access')

const SHARED_FIELD_MODULE_KEY = 'shared_sharedview'
const SHARED_WRITE_FIELD_IDS = {
  title: 'post_info.title', content: 'post_info.content', category: 'post_info.category',
  visibility: 'post_info.visibility', attachments: 'post_info.attachments'
}
const SHARED_CATEGORY_WRITE_FIELD_IDS = { name: 'category_info.name' }
const SHARED_RESPONSE_KEYS = {
  'post_info.title': ['title'], 'post_info.content': ['content'], 'post_info.category': ['category'],
  'post_info.visibility': ['visibility'], 'post_info.attachments': ['attachments'], 'post_info.is_pinned': ['is_pinned'],
  'author_info.author': ['author', 'author_id'], 'time_info.created_at': ['created_at'], 'time_info.updated_at': ['updated_at'],
  'category_info.name': ['name'], 'category_info.total': ['total'], 'category_info.sort_order': ['sort_order']
}
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.bmp', '.avif',
  '.heic', '.heif', '.tif', '.tiff'
])

class SharedController {
  constructor({
    service = sharedService,
    masking = dataMaskingService,
    logger = log,
    uploadDir,
    filesystem = fs,
    paths = path,
    converter = convert,
    uploadUrl = getUploadUrl,
    fileUrlFactory = createSharedFileUrl,
    fileAccessVerifier = verifySharedFileAccess
  } = {}) {
    this.service = service
    this.masking = masking
    this.logger = logger
    this.uploadDir = uploadDir
    this.fs = filesystem
    this.path = paths
    this.convert = converter
    this.uploadUrl = uploadUrl
    this.createFileUrl = fileUrlFactory
    this.verifyFileAccess = fileAccessVerifier
  }

  async getFieldPermissions(req) {
    return this.masking.getUserFieldPermissions(req.user.id, SHARED_FIELD_MODULE_KEY)
  }

  maskPayloadWithPermissions(value, permissions) {
    if (Array.isArray(value)) return value.map(item => this.maskPayloadWithPermissions(item, permissions))
    if (!value || typeof value !== 'object') return value
    const masked = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, this.maskPayloadWithPermissions(child, permissions)]))
    for (const fieldId of permissions.hiddenFields || []) {
      for (const responseKey of SHARED_RESPONSE_KEYS[fieldId] || []) {
        if (Object.prototype.hasOwnProperty.call(masked, responseKey)) masked[responseKey] = null
      }
    }
    if ((permissions.hiddenFields || []).includes('author_info.author') && masked.author) masked.author = null
    return this.masking.filterSensitiveFields([masked], permissions)[0]
  }

  async maskPayload(value, req) {
    return this.maskPayloadWithPermissions(value, await this.getFieldPermissions(req))
  }

  rejectHiddenWrites(fieldMap) {
    return async (req, res, next) => {
      try {
        const permissions = await this.getFieldPermissions(req)
        const hiddenFields = new Set(permissions.hiddenFields || [])
        const denied = Object.entries(fieldMap).find(([bodyField, fieldId]) => req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId))
        if (!denied) return next()
        return res.status(403).json({ success: false, message: '不能修改已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
      } catch (error) { return next(error) }
    }
  }

  requireVisibleField(fieldId) {
    return async (req, res, next) => {
      try {
        const permissions = await this.getFieldPermissions(req)
        if (!(permissions.hiddenFields || []).includes(fieldId)) return next()
        return res.status(403).json({ success: false, message: '无权访问已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: fieldId })
      } catch (error) { return next(error) }
    }
  }

  canManage(req) {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
    return permissions.includes('shared:manage') || permissions.includes('shared_sharedview:manage')
  }

  handleError(res, error, fallback = '操作失败') {
    const message = error?.message || fallback
    const status = /请输入|不能为空|不能超过|只能|不存在|仅支持|已存在|不能修改|不能删除/.test(message) ? 400 : 500
    return ApiResponse.error(res, message, status)
  }

  signPayload(value, userId) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const signContent = content => String(content || '').replace(
      /\/uploads\/shared\/[a-zA-Z0-9._-]+/g,
      storageUrl => this.createFileUrl(storageUrl, userId, { nowSeconds })
    )
    const transform = item => {
      if (Array.isArray(item)) return item.map(transform)
      if (!item || typeof item !== 'object') return item
      const signed = { ...item }
      if (typeof signed.content === 'string') signed.content = signContent(signed.content)
      if (Array.isArray(signed.attachments)) {
        signed.attachments = signed.attachments.map(attachment => {
          const storageUrl = String(attachment?.storage_url || attachment?.url || '')
          return {
            ...attachment,
            storage_url: storageUrl,
            url: this.createFileUrl(storageUrl, userId, { nowSeconds })
          }
        })
      }
      return signed
    }
    return transform(value)
  }

  verifySharedFileAccess(req, res, next) {
    try {
      const filename = String(req.params.filename || '')
      const userId = Number(req.query.user)
      const validSignature = this.verifyFileAccess({
        filename,
        userId,
        expires: req.query.expires,
        signature: req.query.signature
      })
      if (!validSignature || this.path.basename(filename) !== filename) {
        return ApiResponse.error(res, '附件链接无效或已过期', 403)
      }
      req.sharedAttachment = { filename, userId }
      return next()
    } catch (error) {
      return this.handleError(res, error, '读取附件失败')
    }
  }

  async canAccessAttachment(req, res, next) {
    try {
      const { filename, userId } = req.sharedAttachment
      const rawUrl = this.uploadUrl('shared', filename)
      const access = await this.service.canAccessAttachment(rawUrl, userId)
      const belongsToUploader = filename.startsWith(`${userId}_`)
      if (!access.referenced && !belongsToUploader) return ApiResponse.error(res, '附件不存在', 404)
      if (access.referenced && !access.allowed) return ApiResponse.error(res, '无权访问该附件', 403)
      return next()
    } catch (error) {
      return this.handleError(res, error, '读取附件失败')
    }
  }

  readAttachment(req, res) {
    try {
      const { filename } = req.sharedAttachment
      const absolutePath = this.path.join(this.uploadDir, filename)
      if (!absolutePath.startsWith(`${this.path.normalize(this.uploadDir)}${this.path.sep}`) || !this.fs.existsSync(absolutePath)) {
        return ApiResponse.error(res, '附件不存在', 404)
      }
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      return res.sendFile(absolutePath)
    } catch (error) {
      return this.handleError(res, error, '读取附件失败')
    }
  }

  async list(req, res) {
    try {
      const permissions = await this.getFieldPermissions(req)
      const hiddenFields = new Set(permissions.hiddenFields || [])
      const filterFields = { category: 'post_info.category', visibility: 'post_info.visibility' }
      const denied = Object.entries(filterFields).find(([queryField, fieldId]) => req.query[queryField] !== undefined && hiddenFields.has(fieldId))
      if (denied) return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
      const search_fields = [['post_info.title', 'title'], ['post_info.content', 'content']]
        .filter(([fieldId]) => !hiddenFields.has(fieldId))
        .map(([, field]) => field)
      if (req.query.keyword && !search_fields.length) return res.status(403).json({ success: false, message: '没有可用的分享搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      const result = await this.service.list(req.user.id, { ...req.query, page_size: req.query.page_size, search_fields })
      const masked = this.maskPayloadWithPermissions(result.rows, permissions)
      return ApiResponse.success(res, this.signPayload(masked, req.user.id), '获取经验分享成功', 200, { pagination: result.pagination })
    } catch (error) { return this.handleError(res, error, '获取经验分享失败') }
  }

  async listCategories(req, res) {
    try { return ApiResponse.success(res, await this.maskPayload(await this.service.listCategories(req.user.id), req), '获取分享分类成功') }
    catch (error) { return this.handleError(res, error, '获取分享分类失败') }
  }

  async createCategory(req, res) {
    try { return ApiResponse.created(res, '分类新增成功', await this.maskPayload(await this.service.createCategory(req.body), req)) }
    catch (error) { return this.handleError(res, error, '新增分类失败') }
  }

  async updateCategory(req, res) {
    try { return ApiResponse.success(res, await this.maskPayload(await this.service.updateCategory(Number(req.params.id), req.body), req), '分类更新成功') }
    catch (error) { return this.handleError(res, error, '更新分类失败') }
  }

  async removeCategory(req, res) {
    try {
      await this.service.removeCategory(Number(req.params.id))
      return ApiResponse.success(res, null, '分类删除成功')
    } catch (error) { return this.handleError(res, error, '删除分类失败') }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getById(Number(req.params.id), req.user.id)
      if (!result) return ApiResponse.error(res, '分享不存在', 404)
      return ApiResponse.success(res, this.signPayload(result, req.user.id), '获取分享详情成功')
    } catch (error) { return this.handleError(res, error, '获取分享详情失败') }
  }

  isHeicUpload(file) {
    const ext = this.path.extname(file.originalname || file.filename || '').toLowerCase()
    const mime = String(file.mimetype || '').toLowerCase()
    return ext === '.heic' || ext === '.heif' || mime.includes('heic') || mime.includes('heif')
  }

  async convertHeicUploads(files) {
    for (const file of files || []) {
      if (!this.isHeicUpload(file)) continue
      const ext = this.path.extname(file.filename).toLowerCase()
      const jpgFilename = file.filename.replace(new RegExp(`${ext}$`, 'i'), '.jpg')
      const jpgPath = this.path.join(this.uploadDir, jpgFilename)
      try {
        const inputBuffer = this.fs.readFileSync(file.path)
        const outputBuffer = await this.convert({ buffer: inputBuffer, format: 'JPEG', quality: 0.92 })
        this.fs.writeFileSync(jpgPath, outputBuffer)
        this.fs.unlinkSync(file.path)
        file.filename = jpgFilename
        file.path = jpgPath
        file.originalname = String(file.originalname || 'image.heic').replace(/\.(heic|heif)$/i, '.jpg')
        file.mimetype = 'image/jpeg'
        file.size = this.fs.statSync(jpgPath).size
      } catch (error) {
        try { if (this.fs.existsSync(file.path)) this.fs.unlinkSync(file.path) } catch (cleanupError) {
          this.logger.warn('清理共享 HEIC 源文件失败:', cleanupError)
        }
        try { if (this.fs.existsSync(jpgPath)) this.fs.unlinkSync(jpgPath) } catch (cleanupError) {
          this.logger.warn('清理共享 HEIC 转换文件失败:', cleanupError)
        }
        const uploadError = new Error('HEIC图片转换失败，请换一张图片或先转成JPG后上传')
        uploadError.cause = error
        throw uploadError
      }
    }
  }

  async upload(req, res) {
    try {
      await this.convertHeicUploads(req.files)
      const files = (req.files || []).map(file => {
        const storageUrl = this.uploadUrl('shared', file.filename)
        return {
          url: this.createFileUrl(storageUrl, req.user.id),
          storage_url: storageUrl,
          name: file.originalname,
          type: file.mimetype,
          size: file.size
        }
      })
      return ApiResponse.success(res, files, '附件上传成功')
    } catch (error) {
      for (const file of req.files || []) {
        try { if (this.fs.existsSync(file.path)) this.fs.unlinkSync(file.path) }
        catch (cleanupError) { this.logger.warn('清理共享上传文件失败:', cleanupError) }
      }
      return this.handleError(res, error, '附件上传失败')
    }
  }

  async cleanupUploads(req, res) {
    try {
      const urls = Array.isArray(req.body?.urls) ? req.body.urls : []
      await this.service.cleanupUploads(urls, req.user.id)
      return ApiResponse.success(res, null, '未使用附件已清理')
    } catch (error) { return this.handleError(res, error, '附件清理失败') }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.user.id, this.canManage(req), req.body)
      const masked = await this.maskPayload(result, req)
      return ApiResponse.created(res, '经验分享发布成功', this.signPayload(masked, req.user.id))
    } catch (error) { return this.handleError(res, error, '经验分享发布失败') }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(Number(req.params.id), req.user.id, this.canManage(req), req.body)
      const masked = await this.maskPayload(result, req)
      return ApiResponse.success(res, this.signPayload(masked, req.user.id), '经验分享更新成功')
    } catch (error) { return this.handleError(res, error, '经验分享更新失败') }
  }

  async remove(req, res) {
    try {
      await this.service.remove(Number(req.params.id), req.user.id, this.canManage(req))
      return ApiResponse.success(res, null, '经验分享已删除')
    } catch (error) { return this.handleError(res, error, '经验分享删除失败') }
  }

  async pin(req, res) {
    try {
      await this.service.pin(Number(req.params.id), Boolean(req.body?.pinned), req.user.id)
      return ApiResponse.success(res, null, '置顶状态已更新')
    } catch (error) { return this.handleError(res, error, '置顶操作失败') }
  }
}

SharedController.FIELD_WRITE_IDS = SHARED_WRITE_FIELD_IDS
SharedController.CATEGORY_WRITE_IDS = SHARED_CATEGORY_WRITE_FIELD_IDS
SharedController.IMAGE_EXTENSIONS = IMAGE_EXTENSIONS

module.exports = SharedController
