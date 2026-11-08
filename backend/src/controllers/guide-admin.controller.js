'use strict'

const fs = require('node:fs')
const path = require('node:path')
const ApiResponse = require('../utils/response')
const guideService = require('../services/guide.service')
const log = require('../utils/log')
const { getUploadUrl, getUploadPathFromUrl } = require('../utils/upload-paths')
const { getGuideFileDisposition, encodeGuideFileName } = require('../utils/guide-file-access')
const { isGuideDraftUrl, promoteGuideDraft, removeGuideDraft } = require('../utils/guide-upload')

class GuideAdminController {
  constructor({
    service = guideService,
    logger = log,
    uploadDir,
    allowedFileTypes,
    fileUpload,
    filesystem = fs,
    paths = path,
    uploadUrl = getUploadUrl,
    uploadPathFromUrl = getUploadPathFromUrl,
    fileDisposition = getGuideFileDisposition,
    encodeFileName = encodeGuideFileName,
    draftUrlCheck = isGuideDraftUrl,
    promoteDraft = promoteGuideDraft,
    removeDraft = removeGuideDraft
  } = {}) {
    this.service = service
    this.logger = logger
    this.uploadDir = uploadDir
    this.allowedFileTypes = allowedFileTypes
    this.fileUpload = fileUpload
    this.fs = filesystem
    this.path = paths
    this.uploadUrl = uploadUrl
    this.uploadPathFromUrl = uploadPathFromUrl
    this.fileDisposition = fileDisposition
    this.encodeFileName = encodeFileName
    this.draftUrlCheck = draftUrlCheck
    this.promoteDraft = promoteDraft
    this.removeDraft = removeDraft
  }

  handleError(res, error, fallback) {
    const message = error?.message || fallback
    const status = error?.status || (/不能为空|必须|不能超过|必须使用|密码错误|不存在|已失效|已使用|上级分类|所属分类|分类不能|二级分类|导航不能/.test(message) ? 400 : 500)
    return ApiResponse.error(res, message, status)
  }

  removeLocalUpload(fileUrl) {
    if (!fileUrl) return
    try {
      const absolutePath = this.uploadPathFromUrl(fileUrl)
      if (absolutePath.startsWith(`${this.path.normalize(this.uploadDir)}${this.path.sep}`) && this.fs.existsSync(absolutePath)) {
        this.fs.unlinkSync(absolutePath)
      }
    } catch (_) {
      // 删除业务记录后，孤立文件清理失败不改变主业务响应。
    }
  }

  async prepareLinkPayload(payload) {
    const preparedPayload = { ...(payload || {}) }
    if (preparedPayload.link_type !== 'file' || !this.draftUrlCheck(preparedPayload.file_url)) {
      return { payload: preparedPayload, promoted: null }
    }
    const promoted = await this.promoteDraft(preparedPayload.file_url)
    preparedPayload.file_url = promoted.fileUrl
    return { payload: preparedPayload, promoted: promoted.promoted ? { fileUrl: promoted.fileUrl } : null }
  }

  async discardUnusedDraft(payload) {
    if (payload?.link_type !== 'file' && this.draftUrlCheck(payload?.file_url)) {
      await this.removeDraft(payload.file_url).catch(() => {})
    }
  }

  async list(_req, res) {
    try {
      const data = {
        settings: await this.service.getGuideSettings(),
        announcements: await this.service.listAnnouncements(),
        categories: await this.service.listCategories({ includeLinks: true })
      }
      return ApiResponse.success(res, data, '获取导航管理数据成功')
    } catch (error) { return this.handleError(res, error, '获取导航管理数据失败') }
  }

  async updateSettings(req, res) {
    try { return ApiResponse.success(res, await this.service.updateGuideSettings(req.user.id, req.body), '导航设置已保存') }
    catch (error) { return this.handleError(res, error, '导航设置保存失败') }
  }

  async createAnnouncement(req, res) {
    try { return ApiResponse.created(res, '公告新增成功', await this.service.createAnnouncement(req.user.id, req.body)) }
    catch (error) { return this.handleError(res, error, '公告新增失败') }
  }

  async updateAnnouncement(req, res) {
    try { return ApiResponse.success(res, await this.service.updateAnnouncement(Number(req.params.id), req.body), '公告更新成功') }
    catch (error) { return this.handleError(res, error, '公告更新失败') }
  }

  async deleteAnnouncement(req, res) {
    try {
      await this.service.deleteAnnouncement(Number(req.params.id))
      return ApiResponse.success(res, null, '公告删除成功')
    } catch (error) { return this.handleError(res, error, '公告删除失败') }
  }

  async createCategory(req, res) {
    try { return ApiResponse.created(res, '分类新增成功', await this.service.createCategory(req.user.id, req.body)) }
    catch (error) { return this.handleError(res, error, '分类新增失败') }
  }

  async updateCategory(req, res) {
    try { return ApiResponse.success(res, await this.service.updateCategory(Number(req.params.id), req.body), '分类更新成功') }
    catch (error) { return this.handleError(res, error, '分类更新失败') }
  }

  async deleteCategory(req, res) {
    try {
      const storedLinks = await this.service.getCategoryLinksStorage(Number(req.params.id))
      await this.service.deleteCategory(Number(req.params.id))
      for (const link of storedLinks) this.removeLocalUpload(link.file_url)
      return ApiResponse.success(res, null, '分类删除成功')
    } catch (error) { return this.handleError(res, error, '分类删除失败') }
  }

  async createLink(req, res) {
    let promoted = null
    try {
      const prepared = await this.prepareLinkPayload(req.body)
      promoted = prepared.promoted
      const result = await this.service.createLink(req.user.id, Number(req.params.id), prepared.payload)
      await this.discardUnusedDraft(req.body)
      return ApiResponse.created(res, '导航新增成功', result)
    } catch (error) {
      if (promoted?.fileUrl) this.removeLocalUpload(promoted.fileUrl)
      return this.handleError(res, error, '导航新增失败')
    }
  }

  async updateLink(req, res) {
    let promoted = null
    try {
      const id = Number(req.params.id)
      const previous = await this.service.getLinkStorage(id)
      const prepared = await this.prepareLinkPayload(req.body)
      promoted = prepared.promoted
      const result = await this.service.updateLink(id, prepared.payload)
      const nextStored = await this.service.getLinkStorage(id)
      if (previous?.file_url && previous.file_url !== nextStored?.file_url) this.removeLocalUpload(previous.file_url)
      await this.discardUnusedDraft(req.body)
      return ApiResponse.success(res, result, '导航更新成功')
    } catch (error) {
      if (promoted?.fileUrl) this.removeLocalUpload(promoted.fileUrl)
      return this.handleError(res, error, '导航更新失败')
    }
  }

  async deleteLink(req, res) {
    try {
      const id = Number(req.params.id)
      const link = await this.service.getLinkStorage(id)
      await this.service.deleteLink(id)
      this.removeLocalUpload(link?.file_url)
      return ApiResponse.success(res, null, '导航删除成功')
    } catch (error) { return this.handleError(res, error, '导航删除失败') }
  }

  async sendStoredFile(req, res, inlineOnly = false, allowDisabled = false) {
    const record = await this.service.getLinkStorage(Number(req.params.id))
    if (!record || record.link_type !== 'file' || !record.file_url || (!allowDisabled && Number(record.is_enabled) !== 1)) return res.status(404).end()
    const filePath = this.uploadPathFromUrl(record.file_url)
    const guideRoot = this.path.resolve(this.uploadDir)
    if (!filePath.startsWith(`${guideRoot}${this.path.sep}`) || !this.fs.existsSync(filePath)) return res.status(404).end()
    if (inlineOnly && !String(record.file_mime || '').startsWith('image/')) return res.status(415).end()
    const disposition = inlineOnly ? 'inline' : this.fileDisposition(record.file_mime)
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': record.file_mime || 'application/octet-stream',
      'Content-Disposition': `${disposition}; ${this.encodeFileName(record.file_name || `guide-${record.id}`)}`
    })
    return res.sendFile(filePath)
  }

  async previewLink(req, res) {
    try { return await this.sendStoredFile(req, res, true, true) }
    catch (error) { return this.handleError(res, error, '文件预览失败') }
  }

  async downloadLink(req, res) {
    try { return await this.sendStoredFile(req, res, false, true) }
    catch (error) { return this.handleError(res, error, '文件下载失败') }
  }

  uploadFile(req, res) {
    this.fileUpload.single('file')(req, res, error => {
      if (error) {
        if (req.file?.path) this.fs.unlink(req.file.path, () => {})
        return this.handleError(res, error, '文件上传失败')
      }
      if (!req.file) return ApiResponse.error(res, '请选择文件', 400)
      const extension = this.path.extname(req.file.originalname).toLowerCase()
      const canonicalMime = [...(this.allowedFileTypes.get(extension) || [])].find(mime => mime !== 'application/octet-stream') || 'application/octet-stream'
      return ApiResponse.success(res, {
        url: this.uploadUrl('guide', req.file.filename),
        preview_url: `/api/guide/upload/preview/${encodeURIComponent(req.file.filename)}`,
        name: this.path.basename(req.file.originalname),
        mime: canonicalMime
      }, '文件上传成功')
    })
  }

  previewUploadedFile(req, res) {
    const filename = String(req.params.filename || '')
    if (!/^(?:draft_(?:[0-9]+_)?|)[0-9]+_[a-f0-9]{20}\.[a-z0-9]{1,10}$/i.test(filename)) return res.status(404).end()
    const filePath = this.path.resolve(this.uploadDir, filename)
    if (!filePath.startsWith(`${this.path.resolve(this.uploadDir)}${this.path.sep}`) || !this.fs.existsSync(filePath)) return res.status(404).end()
    const extension = this.path.extname(filename).toLowerCase()
    const mime = [...(this.allowedFileTypes.get(extension) || [])].find(value => value !== 'application/octet-stream') || 'application/octet-stream'
    if (!mime.startsWith('image/')) return res.status(415).end()
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': mime,
      'Content-Disposition': `${this.fileDisposition(mime)}; ${this.encodeFileName(filename)}`
    })
    return res.sendFile(filePath)
  }
}

module.exports = GuideAdminController
