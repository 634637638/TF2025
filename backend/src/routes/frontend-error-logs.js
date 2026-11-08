'use strict'

const express = require('express')
const FrontendErrorLogController = require('../controllers/frontend-error-log.controller')
const { unifiedAuth } = require('../middleware/unified-auth')
const { frontendErrorLogRateLimit } = require('../middleware/rate-limit')

const router = express.Router()
const frontendErrorLogController = new FrontendErrorLogController()

router.post('/errors', unifiedAuth, frontendErrorLogRateLimit, frontendErrorLogController.report.bind(frontendErrorLogController))

module.exports = router
