'use strict'

const { getActorId } = require('../../types/actor')

class BaseService {
  getActorId(actor) {
    const id = getActorId(actor)
    if (id === null) {
      throw Object.assign(new Error('认证用户信息无效'), { statusCode: 401, code: 'INVALID_ACTOR' })
    }
    return id
  }

  createError(message, statusCode, code) {
    return Object.assign(new Error(message), { statusCode, code })
  }
}

module.exports = BaseService
