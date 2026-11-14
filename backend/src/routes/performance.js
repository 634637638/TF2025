'use strict'

const express = require('express')
const router = express.Router()
const { unifiedAuth } = require('../middleware/unified-auth')
const { performanceReportRateLimit } = require('../middleware/rate-limit')
const PerformanceReportController = require('../controllers/performance-report.controller')
const controller = new PerformanceReportController()

router.post('/report', unifiedAuth, performanceReportRateLimit, express.json({ limit: '2kb' }), controller.accept.bind(controller))
module.exports = router
