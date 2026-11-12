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

test('待办队列校验只向服务传递当前认证用户和排队 ID', async () => {
  let args
  const controller = new ReminderController({
    service: { async pending(...values) { args = values; return [{ occurrence_id: 11 }] } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields(rows) { return rows } }
  })
  const response = createResponse()
  await controller.pending({ user: { id: 7 }, query: { queued_occurrence_ids: '11,12', user_id: 99 } }, response)
  assert.deepEqual(args, [7, ['11', '12']])
  assert.deepEqual(response.body.data, [{ occurrence_id: 11 }])
})

test('提醒 routes 保留权限和字段中间件并委托全部业务 handler', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/reminders.js'), 'utf8')

  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /requirePermission\('reminders:manage'\), reminderController\.acknowledgeCompletion\.bind/)
  assert.match(route, /requireAnyPermission\(\['reminders:create', 'reminders:manage'\]\), reminderController\.requireVisibleField\('target_info\.target_users'\)/)
  assert.match(route, /auditUnpaginatedPersonnelSearch\('reminders-users'\)/)
  assert.match(route, /requirePermission\('reminders:create'\), reminderController\.rejectHiddenWrites\(ReminderController\.FIELD_WRITE_IDS\)/)
  assert.equal((route.match(/reminderController\.[A-Za-z]+\.bind\(reminderController\)/g) || []).length, 16)
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


test('个人公告只查询本人，执行时间隐藏时保留强制状态但不泄露时间', async () => {
  let actor
  const controller = new ReminderController({
    service: { async active(userId) { actor = userId; return [{ occurrence_id: 11, scheduled_at: '2026-11-11 21:00:00', is_mandatory: 1 }] } },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['execution_info.scheduled_at'] } },
      filterSensitiveFields(rows) { return rows }
    }
  })
  const response = createResponse()
  await controller.active({ user: { id: 7 }, query: { user_id: 99 } }, response)
  assert.equal(actor, 7)
  assert.equal(response.body.data[0].scheduled_at, null)
  assert.equal(response.body.data[0].is_mandatory, 1)
})

test('强制窗口内延后任务返回业务校验错误', async () => {
  const controller = new ReminderController({ service: { async updateRecipient() { throw new Error('已进入执行前最后3小时，请完成任务') } } })
  const response = createResponse()
  await controller.updateRecipient({ user: { id: 7 }, params: { occurrenceId: 11, action: 'snooze' }, body: {} }, response)
  assert.equal(response.statusCode, 400)
})
