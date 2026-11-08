'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const response = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('employee salary routes preserve unified authentication and salary-records:view', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/employees.js'), 'utf8')
  assert.match(route, /router\.get\('\/salary-list', unifiedAuth, requirePermission\('salary-records:view'\), employeeSalaryController\.list\.bind\(employeeSalaryController\)\)/)
  assert.match(route, /router\.get\('\/current-salary', unifiedAuth, requirePermission\('salary-records:view'\), employeeSalaryController\.current\.bind\(employeeSalaryController\)\)/)
})

test('employee salary controller preserves list and current salary response payloads', async () => {
  const EmployeeSalaryController = require('../src/controllers/employee-salary.controller')
  const calls = []
  const controller = new EmployeeSalaryController({ service: {
    async getSalaryList(userId) { calls.push(['list', userId]); return { employees: [{ id: 7 }], total: 1 } },
    async getCurrentSalaries(userId, date) { calls.push(['current', userId, date]); return [{ id: 7, current_salary: 1200 }] }
  } })
  const list = response()
  await controller.list({ user: { userId: 7 } }, list)
  assert.deepEqual(list.body.data, { employees: [{ id: 7 }], total: 1 })

  const current = response()
  await controller.current({ user: { id: 7 }, query: { date: '2024-04' } }, current)
  assert.deepEqual(current.body.data, { employees: [{ id: 7, current_salary: 1200 }] })
  assert.deepEqual(calls, [['list', 7], ['current', 7, '2024-04']])
})

test('employee salary service scopes rows and maps effective salary fields', async () => {
  const EmployeeSalaryService = require('../src/services/employee-salary.service')
  const calls = []
  const service = new EmployeeSalaryService({
    repository: {
      async getSalaryList(input) { calls.push(['list', input]); return [{ id: 7 }, { id: 8 }] },
      async getCurrentSalaryRows(input) {
        calls.push(['current', input])
        return [{
          id: 7, username: 'lin', name: '林', hire_date: '2020-05-15', salary_template_id: 3,
          base_salary: '1000', auto_raise_rule: { enabled: true, months: 12, amount: 150, max_salary: 1200 },
          commission_type: null, commission_fixed: '20', commission_new_fixed: null,
          commission_used_fixed: '15', commission_percentage: '0.1', overtime_hourly_rate: '30', rest_days: '4'
        }]
      }
    },
    async getSalaryAccessScope(userId) {
      calls.push(['scope', userId])
      return { isAdmin: false }
    },
    now: () => new Date('2024-06-01T00:00:00.000Z')
  })

  assert.deepEqual(await service.getSalaryList(7), { employees: [{ id: 7 }, { id: 8 }], total: 2 })
  assert.deepEqual(await service.getCurrentSalaries(7, '2022-06'), [{
    id: 7,
    username: 'lin',
    name: '林',
    salary_template_id: 3,
    base_salary: 1000,
    current_salary: 1200,
    salary_adjustment: 200,
    salary_note: '工龄涨薪：每12个月涨150元，已达到上限',
    commission_type: 'fixed',
    commission_fixed: 20,
    commission_new_fixed: 20,
    commission_used_fixed: 15,
    commission_percentage: 0.1,
    overtime_hourly_rate: 30,
    rest_days: 4
  }])
  assert.deepEqual(calls, [
    ['scope', 7], ['list', { isAdmin: false, userId: 7 }],
    ['scope', 7], ['current', { isAdmin: false, userId: 7 }]
  ])
})

test('employee salary repository uses all-user or user-bound active-only queries', async () => {
  const EmployeeSalaryRepository = require('../src/repositories/employee-salary.repository')
  const calls = []
  const results = [[[{ id: 1 }]], [[{ id: 7 }]], [[{ id: 7, base_salary: 1000 }]], [[{ id: 8, base_salary: 900 }]]]
  const repository = new EmployeeSalaryRepository({
    database: () => ({ async execute(query, params) {
      calls.push({ query, params })
      return results.shift()
    } })
  })
  assert.deepEqual(await repository.getSalaryList({ isAdmin: true, userId: 7 }), [{ id: 1 }])
  assert.deepEqual(await repository.getSalaryList({ isAdmin: false, userId: 7 }), [{ id: 7 }])
  assert.deepEqual(await repository.getCurrentSalaryRows({ isAdmin: true, userId: 7 }), [{ id: 7, base_salary: 1000 }])
  assert.deepEqual(await repository.getCurrentSalaryRows({ isAdmin: false, userId: 8 }), [{ id: 8, base_salary: 900 }])
  assert.deepEqual(calls.map(call => call.params), [[], [7], [], [8]])
  assert.match(calls[0].query, /WHERE status = 1/)
  assert.match(calls[1].query, /WHERE id = \? AND status = 1/)
  assert.match(calls[2].query, /LEFT JOIN salary_templates/)
  assert.match(calls[3].query, /WHERE u\.id = \? AND u\.status = 1/)
})
