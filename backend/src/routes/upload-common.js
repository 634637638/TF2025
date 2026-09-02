const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { getUploadsRoot, getUploadPathFromUrl, getRelativeUploadPathFromUrl } = require('../utils/upload-paths')

const MAX_TEMP_FILE_AGE_MS = 2 * 60 * 60 * 1000
const TEMP_DIRECTORY_PERMISSIONS = {
  subsidy: ['subsidy:create', 'subsidy:edit'],
  accessories: ['accessories:create', 'accessories:edit'],
  phones: ['inventory:edit'],
  videos: ['inventory:edit'],
  'screen-lock': ['system:edit'],
  import: ['data-import:upload'],
  shop: [
    'h5-config:edit',
    'h5-admin:edit',
    'h5-banners:create',
    'h5-banners:edit',
    'h5-templates:create',
    'h5-templates:edit'
  ]
}

const requireTempFilePermissions = (req, res, next) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : []
  const directories = new Set()

  for (const fileUrl of files) {
    const relativePath = getRelativeUploadPathFromUrl(fileUrl)
    const directory = relativePath.split('/')[0]
    if (!directory || !TEMP_DIRECTORY_PERMISSIONS[directory]) {
      return ApiResponse.error(res, '该目录不允许通过临时文件接口删除', 403)
    }
    directories.add(directory)
  }

  const pendingDirectories = [...directories]
  const verifyNextDirectory = (index) => {
    if (index >= pendingDirectories.length) {
      return next()
    }

    const permissions = TEMP_DIRECTORY_PERMISSIONS[pendingDirectories[index]]
    return requireAnyPermission(permissions)(req, res, () => verifyNextDirectory(index + 1))
  }

  return verifyNextDirectory(0)
}

/**
 * 删除临时文件（通用接口）
 * POST /api/upload/delete-temp-files
 * 权限：需要登录
 *
 * 请求体：
 * {
 *   files: string[] // 文件URL数组
 * }
 */
router.post('/delete-temp-files', unifiedAuth, requireTempFilePermissions, async (req, res) => {
  try {
    const { files } = req.body

    if (!files || !Array.isArray(files) || files.length === 0) {
      return ApiResponse.success(res, '没有需要删除的文件')
    }

    const deletedFiles = []
    const failedFiles = []

    for (const fileUrl of files) {
      try {
        // 从URL中提取文件路径
        // URL格式: http://localhost:3000/uploads/subsidy/filename.jpg
        // 或: /uploads/subsidy/filename.jpg
        const relativePath = getRelativeUploadPathFromUrl(fileUrl)

        // 构建完整文件路径
        const uploadDirPath = getUploadsRoot()
        const filePath = getUploadPathFromUrl(fileUrl)

        // 安全检查：确保文件路径在上传目录内
        const relativeToUploads = path.relative(uploadDirPath, filePath)
        if (!relativeToUploads || relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) {
          log.warn(`⚠️ 安全警告：尝试删除上传目录外的文件: ${filePath}`)
          failedFiles.push(fileUrl)
          continue
        }

        // 删除文件
      if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath)
          if (!stats.isFile() || Date.now() - stats.mtimeMs > MAX_TEMP_FILE_AGE_MS) {
            log.warn(`⚠️ 拒绝删除非近期临时文件: ${relativePath}`)
            failedFiles.push(fileUrl)
            continue
          }
          fs.unlinkSync(filePath)
          deletedFiles.push(relativePath)
          await removeEmptyTempDirectories(filePath, uploadDirPath, relativePath)
          log.debug(`✅ 已删除临时文件: ${relativePath}`)
        } else {
          log.warn(`⚠️ 文件不存在: ${filePath}`)
        }
      } catch (error) {
        log.error(`⚠️ 删除临时文件失败: ${fileUrl}`, error.message)
        failedFiles.push(fileUrl)
      }
    }

    ApiResponse.success(res, `已清理 ${deletedFiles.length} 个临时文件`, {
      deleted: deletedFiles.length,
      failed: failedFiles.length,
      deletedFiles,
      failedFiles
    })
  } catch (error) {
    log.error('删除临时文件失败:', error)
    ApiResponse.error(res, error.message || '删除临时文件失败', 500)
  }
})

async function removeEmptyTempDirectories(filePath, uploadsRoot, relativePath) {
  const topLevelDirectory = path.resolve(uploadsRoot, String(relativePath).split('/')[0])
  let currentDirectory = path.dirname(filePath)

  while (
    currentDirectory !== topLevelDirectory &&
    currentDirectory.startsWith(`${topLevelDirectory}${path.sep}`)
  ) {
    try {
      const entries = await fs.readdir(currentDirectory)
      if (entries.length > 0) {
        break
      }
      await fs.rmdir(currentDirectory)
      currentDirectory = path.dirname(currentDirectory)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log.warn(`⚠️ 清理空临时目录失败: ${currentDirectory}`, error.message)
      }
      break
    }
  }
}

module.exports = router
