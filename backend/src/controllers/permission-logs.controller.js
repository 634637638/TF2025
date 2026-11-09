'use strict'

const log = require('../utils/log')

class PermissionLogsController {
  constructor(service) {
    this.service = service
  }

  async list(req, res) {
    try {
      const {
        page = 1,
        page_size,
        action = '',
        username = '',
        start_date,
        end_date
      } = req.query
      const pageNum = parseInt(page) || 1
      const sizeNum = Math.min(100, Math.max(1, parseInt(page_size, 10) || 10))
      const { logs, total } = await this.service.listLogs({
        action,
        username,
        startDate: start_date || '',
        endDate: end_date || '',
        pageSize: sizeNum,
        offset: (pageNum - 1) * sizeNum
      })

      return res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            page_size: sizeNum,
            total,
            total_pages: Math.ceil(total / sizeNum),
            has_next: pageNum * sizeNum < total,
            has_prev: pageNum > 1
          }
        }
      })
    } catch (error) {
      log.error('获取权限操作日志失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取权限操作日志失败',
        error: error.message
      })
    }
  }

  async stats(_req, res) {
    try {
      const stats = await this.service.getStats()
      return res.json({ success: true, data: stats })
    } catch (error) {
      log.error('获取日志统计失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取日志统计失败',
        error: error.message
      })
    }
  }

  async create(req, res) {
    try {
      const {
        action,
        target_type,
        target_id,
        target_name,
        description,
        details,
        status = 'success'
      } = req.body
      if (!action || !target_type || !description) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: action, target_type, description'
        })
      }

      await this.service.logPermissionOperation(
        req,
        action,
        target_type,
        target_id,
        target_name,
        description,
        details,
        status
      )
      return res.json({ success: true, message: '日志记录成功' })
    } catch (error) {
      log.error('记录日志失败:', error)
      return res.status(500).json({
        success: false,
        message: '记录日志失败',
        error: error.message
      })
    }
  }

  async clear(req, res) {
    try {
      const deletedCount = await this.service.clearLogs(req.user)
      return res.json({
        success: true,
        message: '权限日志已清空',
        data: { deleted_count: deletedCount }
      })
    } catch (error) {
      if (error.code === 'INVALID_ACTOR') {
        return res.status(401).json({ success: false, message: '认证用户信息无效', code: error.code })
      }
      log.error('清空权限日志失败:', error)
      return res.status(500).json({ success: false, message: '清空权限日志失败，请稍后重试' })
    }
  }

  async delete(req, res) {
    try {
      await this.service.deleteLog(req.params.id)
      return res.json({ success: true, message: '日志删除成功' })
    } catch (error) {
      log.error('删除日志失败:', error)
      return res.status(500).json({
        success: false,
        message: '删除日志失败',
        error: error.message
      })
    }
  }
}

module.exports = PermissionLogsController
