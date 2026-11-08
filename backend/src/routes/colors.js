'use strict'

const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const ColorController = require('../controllers/color.controller')

const router = express.Router()
const colorController = new ColorController()

router.get('/', unifiedAuth, requireAnyPermission(['colors:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view']), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), colorController.list.bind(colorController))
router.get('/:id(\\d+)', unifiedAuth, requirePermission('colors:view'), colorController.get.bind(colorController))
router.post('/', unifiedAuth, requirePermission('colors:create'), colorController.create.bind(colorController))
router.put('/:id', unifiedAuth, requirePermission('colors:edit'), colorController.update.bind(colorController))
router.delete('/:id', unifiedAuth, requirePermission('colors:delete'), colorController.delete.bind(colorController))
router.get('/stats/overview', unifiedAuth, requirePermission('colors:view'), colorController.stats.bind(colorController))
router.patch('/:id/toggle', unifiedAuth, requirePermission('colors:edit'), colorController.toggle.bind(colorController))
router.put('/batch/reorder', unifiedAuth, requirePermission('colors:edit'), colorController.reorder.bind(colorController))

module.exports = router
