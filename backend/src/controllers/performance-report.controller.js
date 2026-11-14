'use strict'

const PerformanceReportService = require('../services/performance-report.service')
const ApiResponse = require('../utils/response')
const service = new PerformanceReportService()

class PerformanceReportController {
  constructor({ reports = service } = {}) { this.reports = reports }

  accept(req, res, next) {
    try { return ApiResponse.success(res, this.reports.accept(req.body)) }
    catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      return next(error)
    }
  }
}

module.exports = PerformanceReportController
