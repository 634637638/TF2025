'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsEmployeeSummaryController = require('../src/controllers/analytics-employee-summary.controller')
const AnalyticsEmployeeSummaryService = require('../src/services/analytics-employee-summary.service')
const AnalyticsEmployeeSummaryRepository = require('../src/repositories/analytics-employee-summary.repository')
const { parseOptionalInt, parseOptionalDate, hasValidQueryValue, getBeijingMonthRange } = require('../src/utils/analytics-query')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('analytics query parser normalizes optional integer filters consistently', () => {
  for (const value of [undefined, null, '', 'undefined', 'null', 'invalid']) {
    assert.equal(parseOptionalInt(value), null)
  }
  assert.equal(parseOptionalInt('12abc'), 12)
  assert.equal(parseOptionalInt(8), 8)
  assert.equal(parseOptionalDate('2026-02-28'), '2026-02-28')
  assert.equal(parseOptionalDate('2026-02-30'), null)
  assert.equal(hasValidQueryValue('null'), false)
  assert.deepEqual(getBeijingMonthRange(0, '2026-03-01 00:00:00'), {
    monthKey: '2026-03', startDate: '2026-03-01', endDate: '2026-03-31'
  })
  assert.deepEqual(getBeijingMonthRange(-1, '2026-01-02 09:00:00'), {
    monthKey: '2025-12', startDate: '2025-12-01', endDate: '2025-12-31'
  })
})

test('employee summary routes retain authentication and delegate both endpoints to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/employees\/detail', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.employeeOverview\.bind\(analyticsEmployeeSummaryController\)\)/)
  assert.match(route, /router\.get\('\/employees\/salary-trend', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.salaryTrend\.bind\(analyticsEmployeeSummaryController\)\)/)
  assert.match(route, /router\.get\('\/employees\/attendance', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.attendance\.bind\(analyticsEmployeeSummaryController\)\)/)
  assert.match(route, /router\.get\('\/attendance\/summary', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.attendanceSummary\.bind\(analyticsEmployeeSummaryController\)\)/)
  assert.match(route, /router\.get\('\/employees\/performance', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.employeePerformance\.bind\(analyticsEmployeeSummaryController\)\)/)
})

test('employee overview controller forwards date and store filters and maps validation failures', async () => {
  const calls = []
  const controller = new AnalyticsEmployeeSummaryController({ service: {
    async getEmployeeOverview(input) {
      calls.push(input)
      if (input.startDate === 'invalid') throw Object.assign(new Error('开始日期格式无效'), { statusCode: 400 })
      return { totalCount: 12, activeCount: 8 }
    }
  } })
  const result = response()
  await controller.employeeOverview({ query: { start_date: '2026-11-01', end_date: '2026-11-07', store_id: '5abc' } }, result)
  assert.deepEqual(calls[0], { startDate: '2026-11-01', endDate: '2026-11-07', storeId: 5 })
  assert.equal(result.body.message, '获取员工分析数据成功')
  assert.deepEqual(result.body.data, { totalCount: 12, activeCount: 8 })

  const invalid = response()
  await controller.employeeOverview({ query: { start_date: 'invalid' } }, invalid)
  assert.equal(invalid.statusCode, 400)
})

test('employee performance controller clamps page size, parses store and preserves error responses', async () => {
  const calls = []
  const controller = new AnalyticsEmployeeSummaryController({ service: {
    async getEmployeePerformance(input) {
      calls.push(input)
      if (input.metric === 'invalid') throw Object.assign(new Error('排序指标无效'), { statusCode: 400 })
      if (input.metric === 'offline') throw new Error('数据库连接失败')
      return [{ id: 8, total_sales: 300 }]
    }
  } })
  const result = response()
  await controller.employeePerformance({ query: { metric: 'newSales', page_size: '150', store_id: '5abc' } }, result)
  assert.deepEqual(calls[0], { metric: 'newSales', pageSize: 100, storeId: 5 })
  assert.equal(result.body.message, '获取员工业绩排行成功')
  assert.deepEqual(result.body.data, [{ id: 8, total_sales: 300 }])

  const invalid = response()
  await controller.employeePerformance({ query: { metric: 'invalid' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const offline = response()
  await controller.employeePerformance({ query: { metric: 'offline' } }, offline)
  assert.equal(offline.statusCode, 500)
})

test('employee summary controller retains month bounds, store parsing and response messages', async () => {
  const calls = []
  const controller = new AnalyticsEmployeeSummaryController({ service: {
    async getSalaryTrend(monthCount, storeId) {
      calls.push(['salary', monthCount, storeId])
      return { months: ['7月'], salaries: [1200] }
    },
    async getAttendanceDistribution(storeId) {
      calls.push(['attendance', storeId])
      return [{ name: '正常', value: 100, color: '#52c41a' }]
    }
  } })

  const salary = response()
  await controller.salaryTrend({ query: { months: '100', store_id: '5abc' } }, salary)
  assert.deepEqual(calls[0], ['salary', 24, 5])
  assert.equal(salary.body.message, '获取工资趋势成功')
  assert.deepEqual(salary.body.data, { months: ['7月'], salaries: [1200] })

  const attendance = response()
  await controller.attendance({ query: { store_id: 'undefined' } }, attendance)
  assert.deepEqual(calls[1], ['attendance', null])
  assert.equal(attendance.body.message, '获取出勤统计成功')
})

test('employee summary service pads salary trend months and preserves attendance aggregation', async () => {
  const now = new Date(2026, 6, 15, 12)
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)
  const secondMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7)
  const service = new AnalyticsEmployeeSummaryService({
    connected: () => true,
    now: () => now,
    repository: {
      async getSalaryTotals(monthCount, storeId) {
        assert.equal(monthCount, 2)
        assert.equal(storeId, 4)
        return [{ month: firstMonth, total: '100.6' }, { month: secondMonth, total: '200.4' }]
      },
      async getAttendanceCounts(storeId) {
        assert.equal(storeId, null)
        return [
          { record_type: 'normal', status: 'approved', count: 2 },
          { record_type: 'late', status: 'approved', count: 1 },
          { record_type: 'early_leave', status: 'approved', count: 1 },
          { record_type: 'absent', status: 'pending', count: 9 }
        ]
      }
    }
  })

  assert.deepEqual(await service.getSalaryTrend(2, 4), {
    months: [`${new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1}月`, `${now.getMonth() + 1}月`],
    salaries: [101, 200]
  })
  assert.deepEqual(await service.getAttendanceDistribution(null), [
    { value: 50, name: '正常', color: '#52c41a' },
    { value: 25, name: '迟到', color: '#faad14' },
    { value: 25, name: '早退', color: '#fa8c16' },
    { value: 0, name: '缺勤', color: '#ff4d4f' }
  ])
})

test('employee summary service rejects disconnected database before querying', async () => {
  const service = new AnalyticsEmployeeSummaryService({ connected: () => false, repository: {} })
  await assert.rejects(service.getSalaryTrend(6, null), { message: '数据库连接失败' })
  await assert.rejects(service.getAttendanceDistribution(null), { message: '数据库连接失败' })
  await assert.rejects(service.getAttendanceSummary({}), { message: '数据库连接失败' })
})

test('employee performance service combines salary, attendance and sales fields while validating metric and page size', async () => {
  const calls = []
  const service = new AnalyticsEmployeeSummaryService({
    connected: () => true,
    monthRange: offset => {
      assert.equal(offset, 0)
      return { startDate: '2026-11-01', endDate: '2026-11-30' }
    },
    salaryCalculator: {
      async batchCalculateSalary(ids, startDate, endDate, options) {
        calls.push(['salary', ids, startDate, endDate, options])
        return [
          { success: true, data: { employee_id: 7, base_salary: 1000, commission_amount: 200, overtime_pay: 50, leave_deduction: 10, other_deduction: 40 } },
          { success: false, data: { employee_id: 8 } }
        ]
      }
    },
    repository: {
      async getEmployeePerformance(input) {
        calls.push(['performance', input])
        return [
          { id: 7, total_sales: '60000.5', new_sales: '2', used_sales: '1', wholesale_count: '3', allocation_count: '4' },
          { id: 8, total_sales: '10000', new_sales: null, used_sales: '0', wholesale_count: '0', allocation_count: '0' }
        ]
      },
      async getAttendanceRates(ids) {
        calls.push(['attendance', ids])
        return [{ employee_id: 7, approved: 3, total: 4 }, { employee_id: 8, approved: 0, total: 0 }]
      }
    }
  })

  assert.deepEqual(await service.getEmployeePerformance({ metric: 'totalSales', pageSize: 20, storeId: 5 }), [
    { id: 7, total_sales: 60000.5, new_sales: 2, used_sales: 1, wholesale_count: 3, allocation_count: 4, salary: 1200, attendance_rate: 75, trend: 'up' },
    { id: 8, total_sales: 10000, new_sales: 0, used_sales: 0, wholesale_count: 0, allocation_count: 0, salary: 0, attendance_rate: 0, trend: 'down' }
  ])
  assert.deepEqual(calls[0], ['performance', { metric: 'totalSales', pageSize: 20, storeId: 5 }])
  assert.deepEqual(calls[1], ['salary', [7, 8], '2026-11-01', '2026-11-30', { logExpectedErrors: false }])
  assert.deepEqual(calls[2], ['attendance', [7, 8]])
  await assert.rejects(service.getEmployeePerformance({ metric: 'totalSales', pageSize: 101 }), { statusCode: 400 })
})

test('employee overview service defaults to Beijing month and combines payroll and analytics totals', async () => {
  const calls = []
  const service = new AnalyticsEmployeeSummaryService({
    connected: () => true,
    monthRange(offset) {
      assert.equal(offset, 0)
      return { startDate: '2026-11-01', endDate: '2026-11-30' }
    },
    salaryCalculator: {
      async batchCalculateSalary(ids, startDate, endDate, options) {
        calls.push(['salary', ids, startDate, endDate, options])
        return [
          { success: true, data: { base_salary: '1000', commission_amount: '200', overtime_pay: '50', leave_deduction: '10', other_deduction: '40' } },
          { success: false }
        ]
      }
    },
    repository: {
      async getEmployeeOverview(filters) {
        calls.push(['overview', filters])
        return {
          totalEmployees: { count: 12 }, activeEmployees: { count: 8 }, stores: { count: 3 },
          newPhoneSales: { count: 4 }, usedPhoneSales: { count: 2 }, totalSalesAmount: { total: '10001' },
          payrollEmployeeIds: [7, 8], attendance: { approved: 3, total: 4 }
        }
      }
    }
  })
  assert.deepEqual(await service.getEmployeeOverview({ storeId: 5 }), {
    totalCount: 12, activeCount: 8, totalSalary: 1200, baseSalaryTotal: 1000, commissionTotal: 200,
    overtimePayTotal: 50, deductionTotal: 50, templateEmployeeCount: 2, calculatedEmployeeCount: 1,
    failedEmployeeCount: 1, avgAttendance: 75, storeCount: 3, newCount: 4, usedCount: 2,
    avgSales: 1250, totalTrend: 'stable', totalChange: 0, salaryTrend: 'stable', salaryChange: 0
  })
  assert.deepEqual(calls, [
    ['overview', { startDate: '2026-11-01', endDate: '2026-11-30', storeId: 5 }],
    ['salary', [7, 8], '2026-11-01', '2026-11-30', { logExpectedErrors: false }]
  ])
  await assert.rejects(service.getEmployeeOverview({ startDate: '2026-02-30' }), {
    message: '开始日期格式无效', statusCode: 400
  })
})

test('employee summary repository binds optional store filters and salary range', async () => {
  const calls = []
  const repository = new AnalyticsEmployeeSummaryRepository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))

  await repository.getSalaryTotals(8, 3)
  await repository.getSalaryTotals(6, null)
  await repository.getAttendanceCounts(3)
  await repository.getAttendanceCounts(null)

  assert.deepEqual(calls.map(call => call.params), [[8, 3], [6], [3], []])
  assert.match(calls[0].query, /INTERVAL \? MONTH[\s\S]*AND u\.store_id = \?/)
  assert.doesNotMatch(calls[1].query, /AND u\.store_id = \?/)
  assert.match(calls[2].query, /ar\.status != 'cancelled'[\s\S]*AND u\.store_id = \?/)
  assert.doesNotMatch(calls[3].query, /AND u\.store_id = \?/)
})

test('employee overview repository binds store and date filters across summary queries', async () => {
  const calls = []
  const responses = [
    [[{ count: 12 }]], [[{ count: 8 }]], [[{ count: 3 }]], [[{ count: 4 }]],
    [[{ count: 2 }]], [[{ total: '10001' }]], [[{ id: 7 }]], [[{ approved: 3, total: 4 }]]
  ]
  const repository = new AnalyticsEmployeeSummaryRepository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return responses[calls.length - 1]
    }
  }))
  const result = await repository.getEmployeeOverview({ startDate: '2026-11-01', endDate: '2026-11-30', storeId: 5 })
  assert.equal(calls.length, 8)
  assert.ok(calls.every(call => call.params.includes(5)))
  assert.deepEqual(calls[3].params, ['2026-11-01', '2026-11-30', 5])
  assert.deepEqual(calls[7].params, ['2026-11-01', '2026-11-30', 5])
  assert.deepEqual(result.payrollEmployeeIds, [7])
  assert.deepEqual(result.attendance, { approved: 3, total: 4 })
})

test('attendance summary controller preserves filters, success message, validation and database errors', async () => {
  const calls = []
  const controller = new AnalyticsEmployeeSummaryController({ service: {
    async getAttendanceSummary(input) {
      calls.push(input)
      if (input.startDate === 'bad') throw Object.assign(new Error('开始日期格式无效'), { statusCode: 400 })
      if (input.startDate === 'offline') throw new Error('数据库连接失败')
      return { summary: { totalRecords: 4 }, records: [], alerts: [] }
    }
  } })

  const result = response()
  await controller.attendanceSummary({ query: { start_date: '2026-11-01', end_date: '2026-11-07', store_id: '12abc' } }, result)
  assert.deepEqual(calls[0], { startDate: '2026-11-01', endDate: '2026-11-07', storeId: 12 })
  assert.equal(result.body.message, '获取考勤记录成功')
  assert.deepEqual(result.body.data, { summary: { totalRecords: 4 }, records: [], alerts: [] })

  const invalid = response()
  await controller.attendanceSummary({ query: { start_date: 'bad' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '开始日期格式无效')

  const offline = response()
  await controller.attendanceSummary({ query: { start_date: 'offline' } }, offline)
  assert.equal(offline.statusCode, 500)
  assert.equal(offline.body.message, '服务器内部错误，请稍后重试')
})

test('attendance summary service validates dates and formats summary, records and alerts', async () => {
  const service = new AnalyticsEmployeeSummaryService({
    connected: () => true,
    repository: {
      async getAttendanceSummary(filters) {
        assert.deepEqual(filters, { startDate: '2026-11-01', endDate: '2026-11-07', storeId: 4 })
        return {
          summaryRow: { total_records: '9', employee_count: '3', pending_count: '2', approved_count: '5', abnormal_count: '1', leave_count: '2', overtime_count: null },
          records: [
            { record_date: '2026-11-07', employee_name: null, store_name: null, record_type: 'leave', leave_type: '病假', leave_days: '1.5', status: 'pending', approved_at: null, approval_note: null },
            { record_type: 'monthly_leave', leave_days: null, monthly_leave_days: '2', status: 'approved' },
            { record_type: 'overtime', overtime_hours: '3.5', status: 'approved' }
          ],
          alerts: [{ record_type: 'late', status: 'approved' }]
        }
      }
    }
  })

  const result = await service.getAttendanceSummary({ startDate: '2026-11-01', endDate: '2026-11-07', storeId: 4 })
  assert.deepEqual(result.summary, {
    totalRecords: 9, employeeCount: 3, pendingCount: 2, approvedCount: 5,
    abnormalCount: 1, leaveCount: 2, overtimeCount: 0
  })
  assert.deepEqual(result.records.map(record => [record.type, record.detail, record.status]), [
    ['请假·病假', '1.5天', 'pending'],
    ['月休', '2天', 'approved'],
    ['加班', '3.5小时', 'approved']
  ])
  assert.deepEqual(result.alerts, [{
    date: undefined, employee_name: '未知', store_name: '', type: '迟到', status: 'processed'
  }])
  await assert.rejects(service.getAttendanceSummary({ startDate: '2026-02-30' }), {
    message: '开始日期格式无效', statusCode: 400
  })
})

test('attendance summary repository binds dates and store scope across all reads', async () => {
  const calls = []
  const repository = new AnalyticsEmployeeSummaryRepository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))

  await repository.getAttendanceSummary({ startDate: '2026-11-01', endDate: '2026-11-07', storeId: 4 })
  assert.equal(calls.length, 3)
  assert.deepEqual(calls.map(call => call.params), Array(3).fill(['2026-11-01', '2026-11-07', 4]))
  assert.ok(calls.every(call => /ar\.record_date >= \?[\s\S]*ar\.record_date <= \?[\s\S]*u\.store_id = \?/ .test(call.query)))
  assert.match(calls[1].query, /LIMIT 30/)
  assert.match(calls[2].query, /LIMIT 20/)

  calls.length = 0
  await repository.getAttendanceSummary({ storeId: null })
  assert.deepEqual(calls.map(call => call.params), [[], [], []])
  assert.ok(calls.every(call => /DATE_SUB\(CURDATE\(\), INTERVAL 30 DAY\)/.test(call.query)))
})

test('employee performance repository uses allowlisted sorting and binds store, limit and employee ids', async () => {
  const calls = []
  const repository = new AnalyticsEmployeeSummaryRepository(() => ({
    async query(query, params) {
      calls.push({ query, params })
      return [[]]
    },
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))
  await repository.getEmployeePerformance({ metric: 'newSales', pageSize: 12, storeId: 5 })
  await repository.getEmployeePerformance({ metric: 'totalSales', pageSize: 8, storeId: null })
  await repository.getEmployeePerformance({ metric: 'total_sales DESC; SELECT 1', pageSize: 6, storeId: null })
  await repository.getAttendanceRates([7, 8])
  assert.deepEqual(calls.map(call => call.params), [[5, 12], [8], [6], [7, 8]])
  assert.match(calls[0].query, /ORDER BY new_sales DESC[\s\S]*LIMIT \?/)
  assert.match(calls[0].query, /AND u\.store_id = \?/)
  assert.doesNotMatch(calls[1].query, /AND u\.store_id = \?/)
  assert.match(calls[2].query, /ORDER BY total_sales DESC/)
  assert.doesNotMatch(calls[2].query, /SELECT 1/)
  assert.match(calls[3].query, /u\.id IN \(\?, \?\)/)
})
