'use strict'

const ShopService = require('../services/shop.service')
const ApiResponse = require('../utils/response')

/** 素材与发布入口先校验设备门店及图片归属，再接收上传或执行写入。 */
const createPhoneResourceAccess = (service = new ShopService()) => async (req, res, next) => {
  try {
    await service.assertPhoneAccess(req.user, req.params.phoneId || req.params.id, req.params.imageId ?? null)
    next()
  } catch (error) {
    if ([400, 403, 404].includes(error.statusCode)) return ApiResponse.error(res, error.message, error.statusCode, error.code)
    next(error)
  }
}

module.exports = { createPhoneResourceAccess, requirePhoneResourceAccess: createPhoneResourceAccess() }
