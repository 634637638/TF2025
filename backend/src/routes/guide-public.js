'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const ApiResponse = require('../utils/response')
const guideService = require('../services/guide.service')
const { getUploadPathFromUrl, getUploadSubdir } = require('../utils/upload-paths')
const { verifyGuideFileToken, getGuideFileDisposition, encodeGuideFileName } = require('../utils/guide-file-access')

const router = express.Router()
const handleError = (res, error, fallback) => {
  const message = error?.message || fallback
  const status = error?.status || (/不能为空|必须|不能超过|必须使用|密码错误|不存在|已失效|已使用/.test(message) ? 400 : 500)
  return ApiResponse.error(res, message, status)
}

router.get('/', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    return ApiResponse.success(res, await guideService.listPublicGuide(), '获取导航数据成功')
  } catch (error) { return handleError(res, error, '获取导航数据失败') }
})

router.post('/categories/:id/unlock', async (req, res) => {
  try {
    const result = await guideService.unlockCategory(Number(req.params.id), req.body?.password)
    res.set('Cache-Control', 'no-store')
    return ApiResponse.success(res, result, '分类解锁成功')
  } catch (error) { return handleError(res, error, '分类解锁失败') }
})

router.get('/categories/:id', async (req, res) => {
  try {
    // 访问令牌只允许放在请求头，避免出现在浏览器历史、代理和访问日志的 URL 查询参数中。
    const token = req.get('X-Guide-Token')
    const category = await guideService.getProtectedCategory(Number(req.params.id), token)
    if (!category) return ApiResponse.error(res, '分类不存在', 404)
    res.set('Cache-Control', 'no-store')
    return ApiResponse.success(res, category, '获取分类导航成功')
  } catch (error) { return handleError(res, error, '获取分类导航失败') }
})

router.get('/files/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const expires = req.get('X-Guide-File-Expires')
    const signature = req.get('X-Guide-File-Signature')
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(404).json({ success: false, message: '资源不存在' })
    }
    const record = await guideService.getFileAccessRecord(id)
    if (!record) return res.status(404).json({ success: false, message: '资源不存在' })
    if (record.requires_token && !verifyGuideFileToken(id, expires, signature)) {
      return res.status(404).json({ success: false, message: '资源不存在' })
    }
    const filePath = getUploadPathFromUrl(record.file_url)
    const guideRoot = path.resolve(getUploadSubdir('guide'))
    if (!filePath.startsWith(`${guideRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '资源不存在' })
    }
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Type': record.file_mime || 'application/octet-stream',
      'Content-Disposition': `${getGuideFileDisposition(record.file_mime)}; ${encodeGuideFileName(record.file_name || `guide-${id}`)}`
    })
    return res.sendFile(filePath)
  } catch (error) {
    return handleError(res, error, '文件访问失败')
  }
})

module.exports = router
