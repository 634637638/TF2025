'use strict'

const express = require('express')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const SupplierController = require('../controllers/supplier.controller')

const router = express.Router()
const supplierController = new SupplierController()

router.use(unifiedAuth)
router.get('/', requirePermission('suppliers:view'), supplierController.list.bind(supplierController))
router.get('/stats', requirePermission('suppliers:view'), supplierController.stats.bind(supplierController))
router.get('/export', requirePermission('suppliers:export'), supplierController.export.bind(supplierController))
router.put('/batch/reorder', requirePermission('suppliers:edit'), supplierController.reorder.bind(supplierController))
router.post('/', requirePermission('suppliers:create'), supplierController.create.bind(supplierController))
router.put('/:id', requirePermission('suppliers:edit'), supplierController.update.bind(supplierController))
router.delete('/:id', requirePermission('suppliers:delete'), supplierController.remove.bind(supplierController))
router.get('/:id', requirePermission('suppliers:view'), supplierController.detail.bind(supplierController))

module.exports = router
