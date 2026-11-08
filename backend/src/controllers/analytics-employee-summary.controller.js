'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const AnalyticsEmployeeSummaryService = require('../services/analytics-employee-summary.service')
const { parseOptionalInt } = require('../utils/analytics-query')

class AnalyticsEmployeeSummaryController {
  constructor({ service = new AnalyticsEmployeeSummaryService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async salaryTrend(req, res) {
    try {
      const monthParam = req.query.months === undefined ? 6 : req.query.months
      const monthCount = Math.min(24, Math.max(1, parseInt(String(monthParam), 10) || 6))
      const data = await this.service.getSalaryTrend(monthCount, parseOptionalInt(req.query.store_id))
      return this.response.success(res, data, '获取工资趋势成功')
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, '数据库连接失败')
      this.logger.error('获取工资趋势失败:', error)
      return this.response.serverError(res, '获取工资趋势失败', error)
    }
  }

  async attendance(req, res) {
    try {
      const data = await this.service.getAttendanceDistribution(parseOptionalInt(req.query.store_id))
      return this.response.success(res, data, '获取出勤统计成功')
    } catch (error) {
      if (error.message === '数据库连接失败') return this.response.serverError(res, '数据库连接失败')
      this.logger.error('获取出勤统计失败:', error)
      return this.response.serverError(res, '获取出勤统计失败', error)
    }
  }

  async attendanceSummary(req, res) {
    try {
      const data = await this.service.getAttendanceSummary({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取考勤记录成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.message === '数据库连接失败') return this.response.serverError(res, '数据库连接失败')
      this.logger.error('获取考勤记录失败:', error)
      return this.response.serverError(res, '获取考勤记录失败', error)
    }
  }

  async employeePerformance(req, res) {
    try {
      const metric = req.query.metric || 'totalSales'
      const requestedPageSize = Number.parseInt(String(req.query.page_size ?? 20), 10) || 20
      const pageSize = Math.min(100, Math.max(1, requestedPageSize))
      const data = await this.service.getEmployeePerformance({
        metric,
        pageSize,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取员工业绩排行成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.message === '数据库连接失败') return this.response.serverError(res, '数据库连接失败')
      this.logger.error('[员工业绩] 错误:', error)
      return this.response.serverError(res, '获取员工业绩排行失败', error)
    }
  }

  async employeeOverview(req, res) {
    try {
      const data = await this.service.getEmployeeOverview({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        storeId: parseOptionalInt(req.query.store_id)
      })
      return this.response.success(res, data, '获取员工分析数据成功')
    } catch (error) {
      if (error.statusCode === 400) return this.response.badRequest(res, error.message)
      if (error.message === '数据库连接失败') return this.response.serverError(res, '数据库连接失败')
      this.logger.error('获取员工分析数据失败:', error)
      return this.response.serverError(res, '获取员工分析数据失败', error)
    }
  }
}

module.exports = AnalyticsEmployeeSummaryController
