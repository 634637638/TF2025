'use strict'

const express = require('express')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')
const SalesManagementController = require('../controllers/sales-management.controller')

const router = express.Router()
const salesManagementController = new SalesManagementController()

const H5_ORDER_VIEW_PERMISSIONS = ['h5-orders:view', 'h5-admin:view', 'sales:view']
const H5_ORDER_EDIT_PERMISSIONS = ['h5-orders:edit', 'h5-admin:edit', 'sales:edit']

router.use(unifiedAuth)

router.get('/h5-orders/statistics', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), salesManagementController.statistics.bind(salesManagementController))
router.get('/h5-orders', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), salesManagementController.list.bind(salesManagementController))
router.get('/h5-orders/:id', requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS), salesManagementController.detail.bind(salesManagementController))
router.put('/h5-orders/:id/confirm', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), salesManagementController.confirm.bind(salesManagementController))
router.put('/h5-orders/:id/reject', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), salesManagementController.reject.bind(salesManagementController))
router.put('/h5-orders/:id/ship', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), salesManagementController.ship.bind(salesManagementController))
router.put('/h5-orders/:id/complete', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), salesManagementController.complete.bind(salesManagementController))
router.put('/h5-orders/:id/cancel', requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS), salesManagementController.cancel.bind(salesManagementController))

module.exports = router
