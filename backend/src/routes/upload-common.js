const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { unifiedAuth } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');
const { getUploadsRoot, getUploadPathFromUrl, getRelativeUploadPathFromUrl } = require('../utils/upload-paths');

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
router.post('/delete-temp-files', unifiedAuth, async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return ApiResponse.success(res, '没有需要删除的文件');
    }

    const deletedFiles = [];
    const failedFiles = [];

    for (const fileUrl of files) {
      try {
        // 从URL中提取文件路径
        // URL格式: http://localhost:3000/uploads/subsidy/filename.jpg
        // 或: /uploads/subsidy/filename.jpg
        const relativePath = getRelativeUploadPathFromUrl(fileUrl);

        // 构建完整文件路径
        const uploadDirPath = getUploadsRoot();
        const filePath = getUploadPathFromUrl(fileUrl);

        // 安全检查：确保文件路径在上传目录内
        const normalizedFilePath = path.normalize(filePath);
        const normalizedUploadDir = path.normalize(uploadDirPath);

        if (!normalizedFilePath.startsWith(normalizedUploadDir)) {
          log.warn(`⚠️ 安全警告：尝试删除上传目录外的文件: ${filePath}`);
          failedFiles.push(fileUrl);
          continue;
        }

        // 删除文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(relativePath);
          log.debug(`✅ 已删除临时文件: ${relativePath}`);
        } else {
          log.warn(`⚠️ 文件不存在: ${filePath}`);
        }
      } catch (error) {
        log.error(`⚠️ 删除临时文件失败: ${fileUrl}`, error.message);
        failedFiles.push(fileUrl);
      }
    }

    ApiResponse.success(res, `已清理 ${deletedFiles.length} 个临时文件`, {
      deleted: deletedFiles.length,
      failed: failedFiles.length,
      deletedFiles,
      failedFiles
    });
  } catch (error) {
    log.error('删除临时文件失败:', error);
    ApiResponse.error(res, error.message || '删除临时文件失败', 500);
  }
});

module.exports = router;
