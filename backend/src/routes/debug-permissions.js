const express = require('express')
const router = express.Router()
const DebugPermissionsController = require('../controllers/debug-permissions.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const debugPermissionsController = new DebugPermissionsController()

router.get('/current-user', unifiedAuth, requirePermission('permissions:admin'), debugPermissionsController.getCurrentUser.bind(debugPermissionsController))
router.get('/role/:roleId', unifiedAuth, requirePermission('permissions:admin'), debugPermissionsController.getRolePermissions.bind(debugPermissionsController))

module.exports = router
