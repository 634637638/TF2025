'use strict'

const ApiResponse = require('../utils/response')
const ShopPublicService = require('../services/shop-public.service')

class ShopPublicMarketingController {
  constructor({ service = new ShopPublicService(), response = ApiResponse } = {}) {
    this.service = service
    this.response = response
  }

  async getLexicon(_req, res) {
    const result = await this.service.getMarketingLexicon()
    return this.response.success(res, result.data, result.message)
  }

  async generate(req, res) {
    const result = await this.service.generateMarketingCopy(req.body)
    return this.response.success(res, result.data, result.message)
  }
}

module.exports = ShopPublicMarketingController
