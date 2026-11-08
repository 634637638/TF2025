const express = require('express')
const router = express.Router()
const BrandController = require('../controllers/brand.controller')
const { cacheMiddleware, clearCache } = require('../middleware/cache')
const { validateBody, validateQuery } = require('../middleware/validation')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { CACHE_TTL, PAGINATION } = require('../config/constants')
const brandController = new BrandController({ clearCache: () => clearCache('/api/brands') })

// 返回全量基础统计，不能使用当前分页结果推算。
router.get('/stats/overview', unifiedAuth, requirePermission('brands:view'), brandController.getStats.bind(brandController))

// 获取品牌列表 - 增强搜索功能
router.get('/', unifiedAuth, requireAnyPermission(['brands:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view']), validateQuery({
  name: { type: 'string', required: false, maxLength: 100 },
  status: { type: 'number', required: false, integer: true },
  page: { type: 'number', required: false, min: 1, integer: true },
  page_size: { type: 'number', required: false, min: 1, max: PAGINATION.MAX_LIMIT, integer: true },
  suggest: { type: ['true', 'false'], required: false },
  all: { type: ['true', 'false'], required: false }
}), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), brandController.list.bind(brandController))

// 创建品牌
router.post('/', unifiedAuth, requirePermission('brands:create'), validateBody({
  name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  status: { type: 'number', required: false, integer: true, min: 0, max: 1 },
  sort_order: { type: 'number', required: false, integer: true, min: 0 }
}), brandController.create.bind(brandController))

// 更新品牌
router.put('/:id', unifiedAuth, requirePermission('brands:edit'), brandController.update.bind(brandController))

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('brands:edit'), brandController.reorder.bind(brandController))

// 删除品牌
router.delete('/:id', unifiedAuth, requirePermission('brands:delete'), brandController.remove.bind(brandController))

// 获取品牌搜索建议
router.get('/suggest', unifiedAuth, requirePermission('brands:view'), brandController.suggest.bind(brandController))

module.exports = router
