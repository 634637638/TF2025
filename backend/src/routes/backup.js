'use strict'

const express = require('express')
const BackupController = require('../controllers/backup.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { CloudBackupService } = require('../services/cloud-backup.service')
const CloudBackupController = require('../controllers/cloud-backup.controller')

const router = express.Router()
const backupController = new BackupController()
const cloudBackupService = new CloudBackupService()
const cloudController = new CloudBackupController(cloudBackupService)
cloudBackupService.start()
const authenticateBackupDownload = backupController.authenticateDownload.bind(backupController)
const requireRetentionPermission = (req, res, next) => req.body?.retention === undefined
  ? next() : requirePermission('backup:delete')(req, res, next)

router.get('/cloud/settings', unifiedAuth, requirePermission('backup:create'), cloudController.settings.bind(cloudController))
router.put('/cloud/settings', unifiedAuth, requirePermission('backup:create'), requireRetentionPermission, cloudController.saveSettings.bind(cloudController))
router.post('/cloud/test', unifiedAuth, requirePermission('backup:create'), cloudController.testConnection.bind(cloudController))
router.post('/cloud/connect', unifiedAuth, requirePermission('backup:create'), cloudController.connect.bind(cloudController))
router.get('/cloud/accounts', unifiedAuth, requirePermission('backup:view'), cloudController.accounts.bind(cloudController))
router.post('/cloud/accounts', unifiedAuth, requirePermission('backup:create'), cloudController.saveAccount.bind(cloudController))
router.patch('/cloud/accounts/:accountId', unifiedAuth, requirePermission('backup:create'), cloudController.saveAccount.bind(cloudController))
router.get('/cloud/drives', unifiedAuth, requirePermission('backup:view'), cloudController.drives.bind(cloudController))
router.get('/cloud/files', unifiedAuth, requirePermission('backup:view'), cloudController.browse.bind(cloudController))
router.post('/cloud/folders', unifiedAuth, requirePermission('backup:create'), cloudController.createFolder.bind(cloudController))
router.patch('/cloud/files/:driveId/:fileId', unifiedAuth, requirePermission('backup:edit'), cloudController.renameFile.bind(cloudController))
router.delete('/cloud/files/:driveId/:fileId', unifiedAuth, requirePermission('backup:delete'), cloudController.trashFile.bind(cloudController))
router.post('/cloud/trash/:driveId/:fileId/restore', unifiedAuth, requirePermission('backup:edit'), cloudController.restoreFile.bind(cloudController))
router.delete('/cloud/trash/:driveId/:fileId', unifiedAuth, requirePermission('backup:delete'), cloudController.purgeFile.bind(cloudController))
router.get('/cloud/tasks', unifiedAuth, requirePermission('backup:view'), cloudController.tasks.bind(cloudController))
router.post('/cloud/upload/:filename', unifiedAuth, requirePermission('backup:create'), cloudController.upload.bind(cloudController))

router.post('/create', unifiedAuth, requirePermission('backup:create'), backupController.create.bind(backupController))
router.get('/list', unifiedAuth, requirePermission('backup:view'), backupController.list.bind(backupController))
router.delete('/:filename', unifiedAuth, requirePermission('backup:delete'), backupController.remove.bind(backupController))
router.post('/cleanup', unifiedAuth, requirePermission('backup:delete'), backupController.cleanup.bind(backupController))
router.get('/storage', unifiedAuth, requirePermission('backup:view'), backupController.storage.bind(backupController))
router.get('/download-link/:filename', unifiedAuth, requirePermission('backup:view'), backupController.downloadLink.bind(backupController))
router.get('/download/:filename', authenticateBackupDownload, backupController.download.bind(backupController))

module.exports = router
