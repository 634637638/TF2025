'use strict'

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const guideService = require('../services/guide.service')
const { getUploadSubdir, getUploadUrl, getUploadPathFromUrl } = require('../utils/upload-paths')
const { getGuideFileDisposition, encodeGuideFileName } = require('../utils/guide-file-access')
const { createGuideDraftFilename, isGuideDraftUrl, promoteGuideDraft, removeGuideDraft } = require('../utils/guide-upload')

const adminRouter = express.Router()
const uploadDir = getUploadSubdir('guide')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const allowedFileTypes = new Map([
  ['.jpg', new Set(['image/jpeg'])], ['.jpeg', new Set(['image/jpeg'])], ['.png', new Set(['image/png'])],
  ['.gif', new Set(['image/gif'])], ['.webp', new Set(['image/webp'])], ['.bmp', new Set(['image/bmp', 'image/x-ms-bmp'])],
  ['.avif', new Set(['image/avif'])], ['.pdf', new Set(['application/pdf'])], ['.doc', new Set(['application/msword', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'])],
  ['.xls', new Set(['application/vnd.ms-excel', 'application/octet-stream'])],
  ['.xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'])],
  ['.ppt', new Set(['application/vnd.ms-powerpoint', 'application/octet-stream'])],
  ['.pptx', new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'])],
  ['.mobileconfig', new Set(['application/x-apple-aspen-config', 'application/xml', 'text/xml', 'application/octet-stream'])],
  ['.apk', new Set(['application/vnd.android.package-archive', 'application/octet-stream'])],
  ['.ipa', new Set(['application/octet-stream', 'application/zip'])],
  ['.mp3', new Set(['audio/mpeg', 'audio/mp3', 'application/octet-stream'])],
  ['.m4a', new Set(['audio/mp4', 'audio/x-m4a', 'application/octet-stream'])],
  ['.wav', new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'])],
  ['.flac', new Set(['audio/flac', 'audio/x-flac', 'application/octet-stream'])],
  ['.ogg', new Set(['audio/ogg', 'application/ogg', 'application/octet-stream'])],
  ['.mp4', new Set(['video/mp4', 'application/octet-stream'])],
  ['.mov', new Set(['video/quicktime', 'application/octet-stream'])],
  ['.avi', new Set(['video/x-msvideo', 'video/avi', 'application/octet-stream'])],
  ['.mkv', new Set(['video/x-matroska', 'application/octet-stream'])],
  ['.webm', new Set(['video/webm', 'application/octet-stream'])],
  ['.3gp', new Set(['video/3gpp', 'application/octet-stream'])],
  ['.txt', new Set(['text/plain', 'application/octet-stream'])], ['.csv', new Set(['text/csv', 'application/csv', 'application/octet-stream'])],
  ['.zip', new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])],
  ['.rar', new Set(['application/vnd.rar', 'application/x-rar-compressed', 'application/octet-stream'])],
  ['.7z', new Set(['application/x-7z-compressed', 'application/octet-stream'])]
])
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, createGuideDraftFilename(path.extname(file.originalname).toLowerCase()))
})
const guideFileUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase()
    const allowedMimeTypes = allowedFileTypes.get(extension)
    if (allowedMimeTypes?.has(String(file.mimetype || '').toLowerCase())) return callback(null, true)
    const error = new Error('文件格式不支持，请上传图片、音频、视频、APK、Office 文档、文本或压缩文件')
    error.status = 400
    callback(error)
  }
})

const handleError = (res, error, fallback) => {
  const message = error?.message || fallback
  const status = error?.status || (/不能为空|必须|不能超过|必须使用|密码错误|不存在|已失效|已使用|上级分类|所属分类|分类不能|二级分类|导航不能/.test(message) ? 400 : 500)
  return ApiResponse.error(res, message, status)
}

const removeLocalUpload = fileUrl => {
  if (!fileUrl) return
  try {
    const absolutePath = getUploadPathFromUrl(fileUrl)
    if (absolutePath.startsWith(`${path.normalize(uploadDir)}${path.sep}`) && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath)
  } catch (_) {
    // 数据记录已经删除时，孤立文件清理失败不影响主业务响应。
  }
}

const removeUploadAfterChange = (previousUrl, nextUrl) => {
  if (previousUrl && previousUrl !== nextUrl) removeLocalUpload(previousUrl)
}

const prepareGuideLinkPayload = async payload => {
  const preparedPayload = { ...(payload || {}) }
  if (preparedPayload.link_type !== 'file' || !isGuideDraftUrl(preparedPayload.file_url)) {
    return { payload: preparedPayload, promoted: null }
  }

  const promoted = await promoteGuideDraft(preparedPayload.file_url)
  preparedPayload.file_url = promoted.fileUrl
  return { payload: preparedPayload, promoted: promoted.promoted ? { fileUrl: promoted.fileUrl } : null }
}

const discardUnusedGuideDraft = async payload => {
  if (payload?.link_type !== 'file' && isGuideDraftUrl(payload?.file_url)) {
    await removeGuideDraft(payload.file_url).catch(() => {})
  }
}

adminRouter.use(unifiedAuth)

adminRouter.get('/', requirePermission('guide:view'), async (_req, res) => {
  try {
    return ApiResponse.success(res, { settings: await guideService.getGuideSettings(), announcements: await guideService.listAnnouncements(), categories: await guideService.listCategories({ includeLinks: true }) }, '获取导航管理数据成功')
  } catch (error) { return handleError(res, error, '获取导航管理数据失败') }
})

adminRouter.put('/settings', requirePermission('guide:edit'), async (req, res) => {
  try {
    const result = await guideService.updateGuideSettings(req.user.id, req.body)
    return ApiResponse.success(res, result, '导航设置已保存')
  } catch (error) {
    return handleError(res, error, '导航设置保存失败')
  }
})

adminRouter.post('/announcements', requirePermission('guide:create'), async (req, res) => {
  try { return ApiResponse.created(res, '公告新增成功', await guideService.createAnnouncement(req.user.id, req.body)) } catch (error) { return handleError(res, error, '公告新增失败') }
})
adminRouter.put('/announcements/:id', requirePermission('guide:edit'), async (req, res) => {
  try { return ApiResponse.success(res, await guideService.updateAnnouncement(Number(req.params.id), req.body), '公告更新成功') } catch (error) { return handleError(res, error, '公告更新失败') }
})
adminRouter.delete('/announcements/:id', requirePermission('guide:delete'), async (req, res) => {
  try { await guideService.deleteAnnouncement(Number(req.params.id)); return ApiResponse.success(res, null, '公告删除成功') } catch (error) { return handleError(res, error, '公告删除失败') }
})

adminRouter.post('/categories', requirePermission('guide:create'), async (req, res) => {
  try { return ApiResponse.created(res, '分类新增成功', await guideService.createCategory(req.user.id, req.body)) } catch (error) { return handleError(res, error, '分类新增失败') }
})
adminRouter.put('/categories/:id', requirePermission('guide:edit'), async (req, res) => {
  try { return ApiResponse.success(res, await guideService.updateCategory(Number(req.params.id), req.body), '分类更新成功') } catch (error) { return handleError(res, error, '分类更新失败') }
})
adminRouter.delete('/categories/:id', requirePermission('guide:delete'), async (req, res) => {
  try {
    const storedLinks = await guideService.getCategoryLinksStorage(Number(req.params.id))
    await guideService.deleteCategory(Number(req.params.id))
    for (const link of storedLinks) removeLocalUpload(link.file_url)
    return ApiResponse.success(res, null, '分类删除成功')
  } catch (error) { return handleError(res, error, '分类删除失败') }
})

adminRouter.post('/categories/:id/links', requirePermission('guide:create'), async (req, res) => {
  let promoted = null
  try {
    const prepared = await prepareGuideLinkPayload(req.body)
    promoted = prepared.promoted
    const result = await guideService.createLink(req.user.id, Number(req.params.id), prepared.payload)
    await discardUnusedGuideDraft(req.body)
    return ApiResponse.created(res, '导航新增成功', result)
  } catch (error) {
    if (promoted?.fileUrl) removeLocalUpload(promoted.fileUrl)
    return handleError(res, error, '导航新增失败')
  }
})
adminRouter.put('/links/:id', requirePermission('guide:edit'), async (req, res) => {
  let promoted = null
  try {
    const previous = await guideService.getLinkStorage(Number(req.params.id))
    const prepared = await prepareGuideLinkPayload(req.body)
    promoted = prepared.promoted
    const result = await guideService.updateLink(Number(req.params.id), prepared.payload)
    const nextStored = await guideService.getLinkStorage(Number(req.params.id))
    removeUploadAfterChange(previous?.file_url, nextStored?.file_url)
    await discardUnusedGuideDraft(req.body)
    return ApiResponse.success(res, result, '导航更新成功')
  } catch (error) {
    if (promoted?.fileUrl) removeLocalUpload(promoted.fileUrl)
    return handleError(res, error, '导航更新失败')
  }
})
adminRouter.delete('/links/:id', requirePermission('guide:delete'), async (req, res) => {
  try {
    const link = await guideService.getLinkStorage(Number(req.params.id))
    await guideService.deleteLink(Number(req.params.id))
    removeLocalUpload(link?.file_url)
    return ApiResponse.success(res, null, '导航删除成功')
  } catch (error) { return handleError(res, error, '导航删除失败') }
})

const sendStoredGuideFile = async (req, res, inlineOnly = false, allowDisabled = false) => {
  const record = await guideService.getLinkStorage(Number(req.params.id))
  if (!record || record.link_type !== 'file' || !record.file_url || (!allowDisabled && Number(record.is_enabled) !== 1)) return res.status(404).end()
  const filePath = getUploadPathFromUrl(record.file_url)
  const guideRoot = path.resolve(uploadDir)
  if (!filePath.startsWith(`${guideRoot}${path.sep}`) || !fs.existsSync(filePath)) return res.status(404).end()
  if (inlineOnly && !String(record.file_mime || '').startsWith('image/')) return res.status(415).end()
  const disposition = inlineOnly ? 'inline' : getGuideFileDisposition(record.file_mime)
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': record.file_mime || 'application/octet-stream', 'Content-Disposition': `${disposition}; ${encodeGuideFileName(record.file_name || `guide-${record.id}`)}` })
  return res.sendFile(filePath)
}

adminRouter.get('/links/:id/preview', requirePermission('guide:view'), async (req, res) => {
  try { return await sendStoredGuideFile(req, res, true, true) } catch (error) { return handleError(res, error, '文件预览失败') }
})

adminRouter.get('/links/:id/download', requirePermission('guide:view'), async (req, res) => {
  try { return await sendStoredGuideFile(req, res, false, true) } catch (error) { return handleError(res, error, '文件下载失败') }
})

adminRouter.post('/upload/file', requirePermission('guide:upload'), (req, res) => {
  guideFileUpload.single('file')(req, res, error => {
    if (error) {
      if (req.file?.path) fs.unlink(req.file.path, () => {})
      return handleError(res, error, '文件上传失败')
    }
    if (!req.file) return ApiResponse.error(res, '请选择文件', 400)
    const extension = path.extname(req.file.originalname).toLowerCase()
    const canonicalMime = [...(allowedFileTypes.get(extension) || [])].find(mime => mime !== 'application/octet-stream') || 'application/octet-stream'
    return ApiResponse.success(res, {
      url: getUploadUrl('guide', req.file.filename),
      preview_url: `/api/guide/upload/preview/${encodeURIComponent(req.file.filename)}`,
      name: path.basename(req.file.originalname),
      mime: canonicalMime
    }, '文件上传成功')
  })
})

adminRouter.get('/upload/preview/:filename', requirePermission('guide:view'), (req, res) => {
  const filename = String(req.params.filename || '')
  if (!/^(?:draft_)?[0-9]+_[a-f0-9]{20}\.[a-z0-9]{1,10}$/i.test(filename)) return res.status(404).end()
  const filePath = path.resolve(uploadDir, filename)
  if (!filePath.startsWith(`${path.resolve(uploadDir)}${path.sep}`) || !fs.existsSync(filePath)) return res.status(404).end()
  const extension = path.extname(filename).toLowerCase()
  const mime = [...(allowedFileTypes.get(extension) || [])].find(value => value !== 'application/octet-stream') || 'application/octet-stream'
  if (!mime.startsWith('image/')) return res.status(415).end()
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': mime,
    'Content-Disposition': `${getGuideFileDisposition(mime)}; ${encodeGuideFileName(filename)}`
  })
  return res.sendFile(filePath)
})

module.exports = { adminRouter }
