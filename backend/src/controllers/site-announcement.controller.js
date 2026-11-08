'use strict'

const SiteAnnouncementService = require('../services/site-announcement.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class SiteAnnouncementController {
  constructor({ service = new SiteAnnouncementService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async listPublished(_req, res) {
    try {
      const announcements = await this.service.listPublished()
      return this.response.success(res, announcements)
    } catch (error) {
      this.logger.warn('获取站内公告失败:', error.message)
      return this.response.error(res, '获取站内公告失败', 500)
    }
  }

  async listAdmin(_req, res) {
    try {
      const announcements = await this.service.listAdmin()
      return this.response.success(res, announcements)
    } catch (error) {
      this.logger.warn('读取公告管理列表失败:', error.message)
      return this.response.error(res, '读取公告管理列表失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.create(req.body)
      return this.response.created(
        res,
        result.isPublished ? '公告发布成功' : '公告草稿保存成功',
        result.announcement
      )
    } catch (error) {
      if (error instanceof SiteAnnouncementService.AnnouncementValidationError) {
        return this.response.error(res, error.message, 400)
      }
      this.logger.error('创建站内公告失败:', error)
      return this.response.error(res, '创建站内公告失败', 500)
    }
  }

  async update(req, res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isSafeInteger(id) || id <= 0) return this.response.error(res, '公告编号无效', 400)
      const announcement = await this.service.update(id, req.body)
      if (!announcement) return this.response.error(res, '公告不存在', 404)
      return this.response.success(res, announcement, '公告更新成功')
    } catch (error) {
      if (error instanceof SiteAnnouncementService.AnnouncementValidationError) {
        return this.response.error(res, error.message, 400)
      }
      this.logger.error('更新站内公告失败:', error)
      return this.response.error(res, '更新站内公告失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isSafeInteger(id) || id <= 0) return this.response.error(res, '公告编号无效', 400)
      const deleted = await this.service.remove(id)
      if (!deleted) return this.response.error(res, '公告不存在', 404)
      return this.response.success(res, null, '公告删除成功')
    } catch (error) {
      this.logger.error('删除站内公告失败:', error)
      return this.response.error(res, '删除站内公告失败', 500)
    }
  }
}

module.exports = SiteAnnouncementController
