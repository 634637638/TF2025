const TempFileCleanupService = require('../services/temp-file-cleanup.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class TempFileCleanupController {
  constructor(service = new TempFileCleanupService()) {
    this.service = service
  }

  async deleteTempFiles(req, res) {
    try {
      const { files } = req.body
      if (!Array.isArray(files) || files.length === 0) {
        return ApiResponse.success(res, '没有需要删除的文件')
      }

      const result = await this.service.deleteTempFiles(files)
      return ApiResponse.success(res, `已清理 ${result.deletedFiles.length} 个临时文件`, {
        deleted: result.deletedFiles.length,
        failed: result.failedFiles.length,
        deletedFiles: result.deletedFiles,
        failedFiles: result.failedFiles
      })
    } catch (error) {
      log.error('删除临时文件失败:', error)
      return ApiResponse.error(res, error.message || '删除临时文件失败', 500)
    }
  }
}

module.exports = TempFileCleanupController
