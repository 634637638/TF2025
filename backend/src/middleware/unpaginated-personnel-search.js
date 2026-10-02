'use strict'

const log = require('../utils/log')

const hasValue = value => value !== undefined && value !== null && String(value).trim() !== ''

const auditUnpaginatedPersonnelSearch = (searchId = 'personnel-search') => (req, res, next) => {
  const hasKeyword = hasValue(req.query?.keyword)
  const hasPage = hasValue(req.query?.page) || hasValue(req.query?.page_size)
  if (hasKeyword || hasPage) return next()

  res.setHeader('X-Reference-Search', 'legacy-unpaginated')
  log.warn('人员选项接口收到无分页全量请求', {
    search_id: searchId,
    method: req.method,
    path: req.originalUrl,
    user_id: req.user?.id || null
  })
  next()
}

module.exports = auditUnpaginatedPersonnelSearch
