'use strict'

const { getErrorAlertService } = require('../services/error-alert.service')
const log = require('../utils/log')

// 在响应结束后观测，包含控制器自行返回的 5xx；不阻塞、不修改业务响应。
const createErrorAlertMiddleware = (alerts = getErrorAlertService()) => {
  const routeIds = new WeakMap()
  let nextRouteId = 0
  return (req, res, next) => {
    if (alerts.enabled) {
      res.once('finish', () => {
        try {
          // next(error) 离开 Router 后 baseUrl 会恢复；用注册对象区分同名末级路由。
          const route = req.route
          if (route && typeof route === 'object' && !routeIds.has(route)) routeIds.set(route, ++nextRouteId)
          alerts.recordHttpFailure({
            status: res.statusCode,
            method: req.method,
            route: route?.path,
            scope: String(routeIds.get(route) || 0),
            requestId: req.requestId
          })
        } catch {
          log.warn('响应已结束，故障告警收集失败')
        }
      })
    }
    next()
  }
}

module.exports = { createErrorAlertMiddleware }
