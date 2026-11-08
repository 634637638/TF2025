const express = require('express')
const router = express.Router()
const DatabaseStatusController = require('../controllers/database-status.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const databaseStatusController = new DatabaseStatusController()

router.get('/status', unifiedAuth, requirePermission('system:view'), databaseStatusController.getStatus.bind(databaseStatusController))

module.exports = router
