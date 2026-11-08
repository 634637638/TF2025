'use strict'

const IconService = require('../services/icon.service')
const log = require('../utils/log')

class IconController {
  constructor({ service, logger = log, ...options } = {}) {
    this.service = service || new IconService({ ...options, logger })
    this.logger = logger
  }

  async searchOnline(req, res) {
    try {
      return res.json(await this.service.searchOnline(req.query))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('❌ 在线搜索失败:', error)
      return res.status(500).json({
        success: false,
        message: '在线搜索失败',
        error: error.message,
        source: 'online'
      })
    }
  }

  async collections(req, res) {
    try {
      return res.json(await this.service.collections())
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('❌ 获取集合列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取集合列表失败',
        error: error.message
      })
    }
  }

  async collection(req, res) {
    try {
      return res.json(await this.service.collection(req.params, req.query))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('❌ 获取集合图标失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取集合图标失败',
        error: error.message
      })
    }
  }

  async list(req, res) {
    try {
      return res.json(await this.service.list(req.query))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('获取图标数据失败:', error)
      return res.status(500).json({ success: false, message: '获取图标数据失败', error: error.message })
    }
  }

  async byClass(req, res) {
    try {
      return res.json(await this.service.byClass(req.query))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('按 class 获取图标失败:', error)
      return res.status(500).json({ success: false, message: '图标获取失败', error: error.message })
    }
  }

  async categories(req, res) {
    try {
      return res.json(await this.service.categories())
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('获取分类数据失败:', error)
      return res.status(500).json({ success: false, message: '获取分类数据失败', error: error.message })
    }
  }

  async cache(req, res) {
    try {
      return res.json(await this.service.cache(req.body))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('缓存图标到本地数据库失败:', error)
      res.status(500).json({
        success: false,
        message: '缓存图标失败',
        error: error.message
      })
    }
  }

  async cleanup(req, res) {
    try {
      return res.json(await this.service.cleanup())
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('清理无效图标失败:', error)
      res.status(500).json({
        success: false,
        message: '清理无效图标失败',
        error: error.message
      })
    }
  }

  async remove(req, res) {
    try {
      return res.json(await this.service.remove(req.params))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('删除图标失败:', error)
      res.status(500).json({
        success: false,
        message: '删除图标失败',
        error: error.message
      })
    }
  }

  async getById(req, res) {
    try {
      return res.json(await this.service.getById(req.params))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('获取图标失败:', error)
      return res.status(500).json({ success: false, message: '获取图标失败', error: error.message })
    }
  }
}

module.exports = IconController
