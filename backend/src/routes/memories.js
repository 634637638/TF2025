'use strict'

const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const MemoryController = require('../controllers/memory.controller')

const router = express.Router()
const memoryController = new MemoryController()

router.get('/', unifiedAuth, requireAnyPermission(['memories:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view']), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), memoryController.list.bind(memoryController))
router.get('/:id(\\d+)', unifiedAuth, requirePermission('memories:view'), memoryController.getById.bind(memoryController))
router.post('/', unifiedAuth, requirePermission('memories:create'), memoryController.create.bind(memoryController))
router.put('/:id', unifiedAuth, requirePermission('memories:edit'), memoryController.update.bind(memoryController))
router.delete('/:id', unifiedAuth, requirePermission('memories:delete'), memoryController.remove.bind(memoryController))
router.get('/stats/overview', unifiedAuth, requirePermission('memories:view'), memoryController.getStats.bind(memoryController))
router.patch('/:id/toggle', unifiedAuth, requirePermission('memories:edit'), memoryController.toggle.bind(memoryController))
router.put('/batch/reorder', unifiedAuth, requirePermission('memories:edit'), memoryController.reorder.bind(memoryController))

module.exports = router
