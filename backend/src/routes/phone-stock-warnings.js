'use strict'

const express = require('express')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const PhoneStockWarningController = require('../controllers/phone-stock-warning.controller')

const router = express.Router()
const phoneStockWarningController = new PhoneStockWarningController()

router.get('/configs', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getAllConfigs.bind(phoneStockWarningController))
router.get('/threshold', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getThreshold.bind(phoneStockWarningController))
router.post('/configs', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.createConfig.bind(phoneStockWarningController))
router.put('/configs/:id', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.updateConfig.bind(phoneStockWarningController))
router.delete('/configs/:id', unifiedAuth, requirePermission('system:delete'), phoneStockWarningController.removeConfig.bind(phoneStockWarningController))
router.patch('/configs/:id/toggle', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.toggle.bind(phoneStockWarningController))
router.get('/brands', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getBrands.bind(phoneStockWarningController))
router.get('/models', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getModels.bind(phoneStockWarningController))
router.get('/colors', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getColors.bind(phoneStockWarningController))
router.get('/memories', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getMemories.bind(phoneStockWarningController))

module.exports = router
