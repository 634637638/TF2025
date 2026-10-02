'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const projectRoot = path.resolve(root, '..')
const readBackend = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const readFrontend = relativePath => fs.readFileSync(path.join(projectRoot, 'frontend/src', relativePath), 'utf8')

test('无分页人员请求有审计标记，分页或关键词查询不告警', () => {
  const log = require(path.join(root, 'src/utils/log'))
  const originalWarn = log.warn
  const warnings = []
  log.warn = (...args) => warnings.push(args)
  try {
    const audit = require(path.join(root, 'src/middleware/unpaginated-personnel-search'))
    const makeResponse = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value } })
    const paginatedResponse = makeResponse()
    let nextCalls = 0
    audit('test')({ query: { page: '1', page_size: '20' }, user: { id: 3 } }, paginatedResponse, () => { nextCalls += 1 })
    assert.equal(paginatedResponse.headers['X-Reference-Search'], undefined)
    assert.equal(warnings.length, 0)

    const legacyResponse = makeResponse()
    audit('test')({ query: {}, originalUrl: '/api/users/operators', user: { id: 4 } }, legacyResponse, () => { nextCalls += 1 })
    assert.equal(legacyResponse.headers['X-Reference-Search'], 'legacy-unpaginated')
    assert.equal(warnings.length, 1)
    assert.equal(nextCalls, 2)
  } finally {
    log.warn = originalWarn
  }
})

test('提醒接收人保留用途授权并支持关键词分页', () => {
  const route = readBackend('src/routes/reminders.js')
  const service = readBackend('src/services/reminder.service.js')
  const page = readFrontend('views/reminders/ReminderView.vue')

  assert.match(route, /router\.get\('\/users',[\s\S]{0,500}requireAnyPermission\(\['reminders:create', 'reminders:manage'\]\)[\s\S]{0,220}getUsers\(req\.query\)/)
  assert.match(route, /result\.pagination \? \{ pagination: result\.pagination \} : \{\}/)
  assert.match(service, /\(name LIKE \? OR username LIKE \? OR phone LIKE \?\)/)
  assert.match(service, /LIMIT \? OFFSET \?/)
  assert.match(service, /total_pages:[\s\S]{0,100}has_next:[\s\S]{0,100}has_prev:/)
  assert.match(page, /remote[\s\S]{0,100}reserve-keyword[\s\S]{0,100}remote-method="searchReminderUsers"/)
  assert.match(page, /page: 1, page_size: 20/)
  assert.match(page, /selected\.filter\(user => !results\.some/)
})

test('租赁销售员远程查询复用公共操作员服务并保持租赁字段权限', () => {
  const route = readBackend('src/routes/rentals.js')
  const page = readFrontend('views/rentals/RentalsView.vue')
  const employeeRoute = readBackend('src/routes/users.js')
  const reminderRoute = readBackend('src/routes/reminders.js')

  assert.match(route, /requireAnyPermission\(\['rentals:view', 'rentals:create'\]\)[\s\S]{0,180}getRentalHiddenFields\(req\)/)
  assert.match(route, /require\('\.\.\/services\/operator-search\.service'\)/)
  assert.match(route, /searchOperators\(\{[\s\S]{0,240}keyword: req\.query\.keyword[\s\S]{0,160}page_size: req\.query\.page_size/)
  assert.match(route, /operatorResult\.pagination \? \{ pagination: operatorResult\.pagination \} : \{\}/)
  assert.match(page, /remote[\s\S]{0,100}reserve-keyword[\s\S]{0,100}remote-method="searchSalesOperators"/)
  assert.match(page, /page:1,page_size:20/)
  assert.match(page, /selectedSalesOperator\.value\s*=\s*row\.sale_operator_id/)
  assert.match(employeeRoute, /auditUnpaginatedPersonnelSearch\('users-employees'\)/)
  assert.match(employeeRoute, /auditUnpaginatedPersonnelSearch\('users-operators'\)/)
  assert.match(reminderRoute, /auditUnpaginatedPersonnelSearch\('reminders-users'\)/)
  assert.match(route, /auditUnpaginatedPersonnelSearch\('rentals-sales-options'\)/)
})
