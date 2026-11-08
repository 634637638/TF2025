'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const ReminderController = require('../src/controllers/reminder.controller')
const SharedController = require('../src/controllers/shared.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

for (const [Controller, moduleKey, hidden, bodyKey] of [
  [ReminderController, 'reminders_reminderview', 'basic_info.title', 'title'],
  [SharedController, 'shared_sharedview', 'post_info.title', 'title']
]) {
  test(`${moduleKey} 递归脱敏数组和嵌套对象，保留可见值且不修改原对象`, async () => {
    const controller = new Controller({
      masking: {
        async getUserFieldPermissions(userId, key) {
          assert.equal(userId, 7)
          assert.equal(key, moduleKey)
          return { hiddenFields: [hidden] }
        },
        filterSensitiveFields(rows) { return rows.map(row => ({ ...row, filtered: true })) }
      }
    })
    const input = { rows: [{ title: '隐藏', nested: { title: '隐藏', content: '可见' } }], count: 1, empty: null }
    const output = await controller.maskPayload(input, { user: { id: 7 } })
    assert.equal(output.rows[0].title, null)
    assert.equal(output.rows[0].nested.title, null)
    assert.equal(output.rows[0].nested.content, '可见')
    assert.equal(output.rows[0].nested.filtered, true)
    assert.equal(output.count, 1)
    assert.equal(output.empty, null)
    assert.equal(input.rows[0].title, '隐藏')
  })

  test(`${moduleKey} 显式空值也拒写，未提交隐藏字段放行；字段读取拒绝`, async () => {
    const controller = new Controller({ masking: {
      async getUserFieldPermissions() { return { hiddenFields: [hidden] } }
    } })
    for (const value of ['', null, false, 0]) {
      const res = response()
      await controller.rejectHiddenWrites({ [bodyKey]: hidden })(
        { user: { id: 7 }, body: { [bodyKey]: value } }, res,
        () => assert.fail('隐藏字段不应放行')
      )
      assert.equal(res.statusCode, 403)
      assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
      assert.equal(res.body.field, hidden)
    }
    let nextCalls = 0
    await controller.rejectHiddenWrites({ [bodyKey]: hidden })(
      { user: { id: 7 }, body: { content: '可见' } }, response(), () => { nextCalls += 1 }
    )
    await controller.requireVisibleField('visible')(
      { user: { id: 7 } }, response(), () => { nextCalls += 1 }
    )
    assert.equal(nextCalls, 2)
    const denied = response()
    await controller.requireVisibleField(hidden)(
      { user: { id: 7 } }, denied, () => assert.fail('隐藏字段不可读')
    )
    assert.equal(denied.statusCode, 403)
  })

  test(`${moduleKey} 权限服务异常交给统一错误处理，不放行业务`, async () => {
    const error = new Error('权限获取失败')
    const controller = new Controller({ masking: {
      async getUserFieldPermissions() { throw error }
    } })
    for (const handler of [controller.rejectHiddenWrites({ title: hidden }), controller.requireVisibleField(hidden)]) {
      let received
      await handler({ user: { id: 7 }, body: { title: 'x' } }, response(), err => { received = err })
      assert.equal(received, error)
    }
  })
}

test('提醒类型 name 特例与分享 author 别名保持隔离', () => {
  const masking = { filterSensitiveFields: rows => rows }
  const reminder = new ReminderController({ masking })
  const shared = new SharedController({ masking })
  assert.deepEqual(reminder.maskPayloadWithPermissions(
    [{ name: '提醒类型', default_remind_days: 2 }, { name: '其他名字' }],
    { hiddenFields: ['type_info.type_name'] }
  ), [{ name: null, default_remind_days: 2 }, { name: '其他名字' }])
  assert.deepEqual(shared.maskPayloadWithPermissions(
    { author: { name: '作者' }, author_id: 7, title: '可见' },
    { hiddenFields: ['author_info.author'] }
  ), { author: null, author_id: null, title: '可见' })
  assert.equal(shared.maskPayloadWithPermissions({ title: '可见' }, { hiddenFields: ['basic_info.title'] }).title, '可见')
})
