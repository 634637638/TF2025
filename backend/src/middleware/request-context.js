'use strict'

const { randomUUID } = require('node:crypto')

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

const requestContext = (req, res, next) => {
  const forwardedRequestId = String(req.get?.('x-request-id') || '').trim()
  const requestId = REQUEST_ID_PATTERN.test(forwardedRequestId) ? forwardedRequestId : randomUUID()

  req.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
}

module.exports = requestContext
module.exports.REQUEST_ID_PATTERN = REQUEST_ID_PATTERN
