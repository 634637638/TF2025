'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ReminderController = require('../src/controllers/reminder.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('提醒 routes 保留权限和字段中间件并委托全部业务 handler', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/reminders.js'), 'utf8')

  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /requirePermission\('reminders:manage'\), reminderController\.acknowledgeCompletion\.bind/)
  assert.match(route, /requireAnyPermission\(\['reminders:create', 'reminders:manage'\]\), reminderController\.requireVisibleField\('target_info\.target_users'\)/)
  assert.match(route, /auditUnpaginatedPersonnelSearch\('reminders-users'\)/)
  assert.match(route, /requirePermission\('reminders:create'\), reminderController\.rejectHiddenWrites\(ReminderController\.FIELD_WRITE_IDS\)/)
  assert.equal((route.match(/reminderController\.[A-Za-z]+\.bind\(reminderController\)/g) || []).length, 15)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('提醒列表根据字段权限限制筛选和搜索并遮蔽响应', async () => {
  let listArgs
  const controller = new ReminderController({
    service: {
      async list(args) {
        listArgs = args
        return { rows: [{ id: 4, title: '不可见', content: '可见' }], pagination: { page: 1 }, summary: { total: 1 } }
      }
    },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['basic_info.title'] } },
      filterSensitiveFields(rows) { return rows }
    },
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.list({
    user: { id: 7, permissions: ['reminders:manage'] },
    query: { page: '1', page_size: '20', keyword: 'visible' }
  }, response)

  assert.deepEqual(listArgs.search_fields, ['content'])
  assert.equal(listArgs.can_manage, true)
  assert.equal(response.body.data[0].title, null)
  assert.deepEqual(response.body.pagination, { page: 1 })
})

test('提醒列表拒绝使用隐藏状态筛选字段', async () => {
  const controller = new ReminderController({
    service: { async list() { assert.fail('隐藏筛选不应查询服务') } },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['status_info.status'] } },
      filterSensitiveFields(rows) { return rows }
    }
  })
  const response = createResponse()

  await controller.list({ user: { id: 7 }, query: { status: 'active' } }, response)

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, {
    success: false,
    message: '不能使用已隐藏的筛选字段',
    code: 'FIELD_PERMISSION_DENIED',
    field: 'status_info.status'
  })
})

test('提醒写入字段权限中间件阻止修改隐藏字段', async () => {
  const controller = new ReminderController({
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['basic_info.title'] } },
      filterSensitiveFields(rows) { return rows }
    }
  })
  const response = createResponse()
  let nextCalls = 0

  await controller.rejectHiddenWrites(ReminderController.FIELD_WRITE_IDS)(
    { user: { id: 7 }, body: { title: '被隐藏字段' } },
    response,
    () => { nextCalls += 1 }
  )

  assert.equal(response.statusCode, 403)
  assert.equal(response.body.field, 'basic_info.title')
  assert.equal(nextCalls, 0)
})
