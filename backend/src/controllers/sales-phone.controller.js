'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const SalesPhoneService = require('../services/sales-phone.service')
const FilmService = require('../services/film-service.service')
const AccessoryService = require('../services/accessory.service')

class SalesPhoneController {
  constructor({ service = new SalesPhoneService({ autoFilm: true, films: new FilmService(), accessories: new AccessoryService() }), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async sell(req, res) {
    try {
      const result = await this.service.sell({ body: req.body || {}, userId: req.user.id, actor: req.user })
      if (result.apiError) return ApiResponse.badRequest(res, result.body.message)
      return res.status(result.status).json(result.body)
    } catch (error) {
      if (error.statusCode >= 400 && error.statusCode < 500) return ApiResponse.error(res, error.message, error.statusCode)
      this.logger.error('手机销售失败:', { requestId: req.requestId, error })
      return res.status(500).json({
        success: false,
        message: '服务器内部错误，请稍后重试',
        code: 'INTERNAL_ERROR',
        request_id: req.requestId || null
      })
    }
  }
}

module.exports = SalesPhoneController
