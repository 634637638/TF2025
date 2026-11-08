'use strict'

const express = require('express')
const BackupController = require('../controllers/backup.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const router = express.Router()
const backupController = new BackupController()
const authenticateBackupDownload = backupController.authenticateDownload.bind(backupController)

router.post('/create', unifiedAuth, requirePermission('backup:create'), backupController.create.bind(backupController))
router.get('/list', unifiedAuth, requirePermission('backup:view'), backupController.list.bind(backupController))
router.delete('/:filename', unifiedAuth, requirePermission('backup:delete'), backupController.remove.bind(backupController))
router.post('/cleanup', unifiedAuth, requirePermission('backup:delete'), backupController.cleanup.bind(backupController))
router.get('/storage', unifiedAuth, requirePermission('backup:view'), backupController.storage.bind(backupController))
router.get('/download-link/:filename', unifiedAuth, requirePermission('backup:view'), backupController.downloadLink.bind(backupController))
router.get('/download/:filename', authenticateBackupDownload, backupController.download.bind(backupController))

module.exports = router
