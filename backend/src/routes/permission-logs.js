'use strict'

const express = require('express')
const PermissionLogsController = require('../controllers/permission-logs.controller')
const PermissionLogsService = require('../services/permission-logs.service')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const router = express.Router()
const permissionLogsService = new PermissionLogsService()
const permissionLogsController = new PermissionLogsController(permissionLogsService)

router.get('/logs', unifiedAuth, requirePermission('permissions:admin'), permissionLogsController.list.bind(permissionLogsController))
router.get('/stats', unifiedAuth, requirePermission('permissions:admin'), permissionLogsController.stats.bind(permissionLogsController))
router.post('/log', unifiedAuth, requirePermission('permissions:admin'), permissionLogsController.create.bind(permissionLogsController))
router.delete('/logs', unifiedAuth, requirePermission('permissions:delete'), permissionLogsController.clear.bind(permissionLogsController))
router.delete('/logs/:id', unifiedAuth, requirePermission('permissions:admin'), permissionLogsController.delete.bind(permissionLogsController))

module.exports = {
  router,
  logPermissionOperation: (...args) => permissionLogsService.logPermissionOperation(...args),
  logRoleOperation: (...args) => permissionLogsService.logRoleOperation(...args),
  logUserRoleOperation: (...args) => permissionLogsService.logUserRoleOperation(...args),
  logPermissionModification: (...args) => permissionLogsService.logPermissionModification(...args)
}
