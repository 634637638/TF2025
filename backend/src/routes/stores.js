'use strict'

const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const StoreController = require('../controllers/store.controller')

const router = express.Router()
const storeController = new StoreController()

router.get('/', unifiedAuth, requireAnyPermission(['stores:view', 'inventory:view', 'sales:view', 'query:view']), cacheMiddleware({ ttl: CACHE_TTL.MEDIUM }), storeController.list.bind(storeController))
router.get('/export', unifiedAuth, requirePermission('stores:export'), storeController.export.bind(storeController))
router.post('/', unifiedAuth, requirePermission('stores:create'), storeController.create.bind(storeController))
router.put('/:id(\\d+)', unifiedAuth, requirePermission('stores:edit'), storeController.update.bind(storeController))
router.delete('/:id', unifiedAuth, requirePermission('stores:delete'), storeController.remove.bind(storeController))
router.get('/managers', unifiedAuth, requirePermission('stores:view'), storeController.managers.bind(storeController))
router.get('/stats', unifiedAuth, requirePermission('stores:view'), storeController.stats.bind(storeController))
router.put('/batch/reorder', unifiedAuth, requirePermission('stores:edit'), storeController.reorder.bind(storeController))
router.get('/:id', unifiedAuth, requirePermission('stores:view'), storeController.get.bind(storeController))

module.exports = router
