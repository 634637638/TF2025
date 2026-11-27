const assert = require('node:assert/strict')
const test = require('node:test')
const { DatabaseSync } = require('node:sqlite')
const AttendanceService = require('../src/services/attendance.service')
const AttendanceRepository = require('../src/repositories/attendance.repository')

test('本月考勤费用使用同一批待审批和已审批记录，按本人模板计算', async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE attendance_records (employee_id INTEGER, record_date TEXT, record_type TEXT, status TEXT,
      leave_days NUMERIC, monthly_leave_days NUMERIC, overtime_hours NUMERIC);
    CREATE TABLE users (id INTEGER, status INTEGER, hire_date TEXT, salary_template_id INTEGER);
    CREATE TABLE salary_templates (id INTEGER, base_salary NUMERIC, overtime_hourly_rate NUMERIC, auto_raise_rule TEXT);
    INSERT INTO users VALUES (7, 1, '2025-11-01', 1), (8, 1, '2026-01-01', NULL), (9, 1, '2026-01-01', 2);
    INSERT INTO salary_templates VALUES (1, 3000, 30, '{"enabled":true,"months":12,"amount":600}'), (2, 3000, 0, NULL);
    INSERT INTO attendance_records VALUES
      (7, '2026-11-01', 'monthly_leave', 'approved', NULL, 1, NULL),
      (7, '2026-11-02', 'leave', 'pending', 0.5, NULL, NULL),
      (7, '2026-11-03', 'leave', 'approved', 1, NULL, NULL),
      (7, '2026-11-30', 'overtime', 'approved', NULL, NULL, 2.5),
      (7, '2026-11-04', 'overtime', 'pending', NULL, NULL, 1),
      (7, '2026-11-05', 'overtime', 'rejected', NULL, NULL, 10),
      (7, '2026-12-01', 'leave', 'approved', 10, NULL, NULL),
      (8, '2026-11-01', 'leave', 'approved', 1, NULL, NULL),
      (9, '2026-11-01', 'overtime', 'approved', NULL, NULL, 2);
  `)
  const service = Object.create(AttendanceService)
  service.repository = new AttendanceRepository()
  service.repository.getConnection = () => ({
    async execute(sql, params) { return [db.prepare(sql).all(...params)] }
  })
  const dates = ['2026-11-01', '2026-11-30']
  const personal = await service.getMonthlyActivityWithAmounts(7, ...dates)
  assert.deepEqual(personal, {
    activity: { leave_days: 1, unpaid_leave_days: 1.5, overtime_hours: 3.5 },
    amounts: { leave_deduction: 180, overtime_pay: 105, count: 4 }
  })
  assert.deepEqual(await service.getMonthlyActivity(7, ...dates), personal.activity)
  assert.deepEqual((await service.getMonthlyActivityWithAmounts(8, ...dates)).amounts, { leave_deduction: null, overtime_pay: 0, count: 1 })
  assert.deepEqual((await service.getMonthlyActivityWithAmounts(9, ...dates)).amounts, { leave_deduction: 0, overtime_pay: 0, count: 1 })
  assert.deepEqual((await service.getMonthlyActivityWithAmounts(10, ...dates)).amounts, { leave_deduction: 0, overtime_pay: 0, count: 0 })
  assert.deepEqual((await service.getMonthlyActivityWithAmounts(null, ...dates)).amounts, { leave_deduction: 180, overtime_pay: 105, count: 6 })
})

test('salary affecting attendance requires a bound salary template and never uses a default leave quota', async () => {
  const originalRepository = AttendanceService.repository
  let templateRows = []
  let record = {
    id: 7,
    employee_id: 12,
    record_type: 'leave',
    record_date: '2026-11-01',
    status: 'pending'
  }
  let created = 0
  let updated = 0
  let approved = 0
  const repository = {
    getConnection: () => ({
      execute: async () => [templateRows, []]
    }),
    createAttendanceRecord: async data => {
      created += 1
      return data
    },
    getAttendanceRecordById: async () => ({ ...record }),
    updateAttendanceRecord: async (_id, data) => {
      updated += 1
      record = { ...record, ...data }
      return true
    },
    approveAttendanceRecord: async (_id, _approverId, status) => {
      approved += 1
      record.status = status
      return true
    }
  }

  AttendanceService.repository = repository
  try {
    const missingTemplateError = await AttendanceService.createAttendanceRecord({
      employee_id: 12,
      record_type: 'overtime',
      record_date: '2026-11-01'
    }, 12).catch(error => error)
    assert.equal(missingTemplateError.statusCode, 422)
    assert.equal(missingTemplateError.code, 'SALARY_TEMPLATE_REQUIRED')
    assert.equal(created, 0)

    const missingBalance = await AttendanceService.getUserLeaveBalance(12)
    assert.equal(missingBalance.template_bound, false)
    assert.equal(missingBalance.monthly_limit, 0)
    assert.equal(missingBalance.available, 0)

    templateRows = [{ id: 4, rest_days: 3 }]
    assert.equal(await AttendanceService.getEmployeeMonthlyLeaveDays(12), 3)
    await AttendanceService.createAttendanceRecord({
      employee_id: 12,
      record_type: 'leave',
      record_date: '2026-11-01'
    }, 12)
    assert.equal(created, 1)

    templateRows = []
    const updateError = await AttendanceService.updateAttendanceRecord(7, { leave_reason: '变更' }).catch(error => error)
    assert.equal(updateError.code, 'SALARY_TEMPLATE_REQUIRED')
    assert.equal(updated, 0)

    const approvalError = await AttendanceService.approveAttendanceRecord(7, 2, 'approved').catch(error => error)
    assert.equal(approvalError.code, 'SALARY_TEMPLATE_REQUIRED')
    assert.equal(approved, 0)

    await AttendanceService.approveAttendanceRecord(7, 2, 'rejected')
    assert.equal(approved, 1)
  } finally {
    AttendanceService.repository = originalRepository
  }
})
