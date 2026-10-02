const express = require('express')
const log = require('../utils/log')
const { unifiedAuth, requireAnyPermission, isSuperAdmin } = require('../middleware/unified-auth')
const deprecatedRoute = require('../middleware/deprecated-route')
const { searchOperators } = require('../services/operator-search.service')

const router = express.Router()

/**
 * 历史操作员入口。
 * 查询逻辑统一复用 users/operators，保留旧响应格式和原有权限范围。
 */
router.get(
  '/',
  unifiedAuth,
  deprecatedRoute({ replacement: '/api/users/operators', migrationId: 'operators-to-users-operators' }),
  requireAnyPermission(['sales:view', 'inventory:view']),
  async (req, res) => {
    try {
      const result = await searchOperators({
        user: req.user,
        superAdmin: isSuperAdmin(req.user),
        keyword: req.query.keyword,
        page: req.query.page,
        page_size: req.query.page_size,
        store_id: req.query.store_id,
        strict_scope: req.query.strict_scope,
        includeDetails: false
      })

      const response = {
        success: true,
        message: '获取操作员列表成功',
        data: result.records.map(user => ({
          id: user.id,
          name: user.name || user.username,
          username: user.username
        }))
      }
      if (result.usePagination) response.pagination = result.pagination
      return res.json(response)
    } catch (error) {
      log.error('获取操作员列表失败:', error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : '获取操作员列表失败'
      })
    }
  }
)

module.exports = router
