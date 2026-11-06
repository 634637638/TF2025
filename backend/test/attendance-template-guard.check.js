const assert = require('node:assert/strict')
const test = require('node:test')
const AttendanceService = require('../src/services/attendance.service')

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
