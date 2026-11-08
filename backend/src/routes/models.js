'use strict'

const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const ModelController = require('../controllers/model.controller')

const router = express.Router()
const modelController = new ModelController()

router.get('/', unifiedAuth, requireAnyPermission(['models:view', 'brands:view', 'inventory:view', 'query:view', 'h5-templates:view', 'h5-admin:view']), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), modelController.list.bind(modelController))
router.get('/brand/:brandId', unifiedAuth, requirePermission('models:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), modelController.listByBrand.bind(modelController))
router.get('/stats/overview', unifiedAuth, requirePermission('models:view'), modelController.stats.bind(modelController))
router.get('/:id', unifiedAuth, requirePermission('models:view'), modelController.get.bind(modelController))
router.post('/', unifiedAuth, requirePermission('models:create'), modelController.create.bind(modelController))
router.put('/:id', unifiedAuth, requirePermission('models:edit'), modelController.update.bind(modelController))
router.delete('/:id', unifiedAuth, requirePermission('models:delete'), modelController.remove.bind(modelController))
router.patch('/:id/toggle', unifiedAuth, requirePermission('models:edit'), modelController.toggle.bind(modelController))
router.put('/batch/reorder', unifiedAuth, requirePermission('models:edit'), modelController.reorder.bind(modelController))

module.exports = router
