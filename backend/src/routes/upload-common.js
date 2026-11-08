const express = require('express')
const router = express.Router()
const TempFileCleanupController = require('../controllers/temp-file-cleanup.controller')
const { unifiedAuth } = require('../middleware/unified-auth')
const createTempFilePermissionGuard = require('../middleware/temp-file-permissions')

const tempFileCleanupController = new TempFileCleanupController()
const requireTempFilePermissions = createTempFilePermissionGuard()

router.post(
  '/delete-temp-files',
  unifiedAuth,
  requireTempFilePermissions,
  tempFileCleanupController.deleteTempFiles.bind(tempFileCleanupController)
)

module.exports = router
