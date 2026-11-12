'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const database = require('../src/config/database')

const scheduled = '2026-11-11 21:00:00'
const now = new Date('2026-11-11T10:00:00+08:00')
const defaultTemplate = () => ({
  id: 8, title: '合成待办', content: null, priority: 'normal', type_id: null,
  target_mode: 'specific', target_user_ids: [7, 9], repeat_rule: { type: 'once', interval: 1, end_type: 'never' },
  start_at: '2026-11-11 00:00:00', remind_before_days: 0, created_by: 3, status: 'active'
})
const record = (id, userId, status = 'pending', date = '2026-11-11 00:00:00') => ({
  id, user_id: userId, scheduled_at: date, remind_at: date, status,
  snoozed_until: null, action_at: status === 'completed' ? '2026-11-10 15:00:00' : null,
  last_prompted_at: '2026-11-11 08:00:00'
})

function fixture(t, initialRecords, overrides = {}) {
  const previousTimezone = process.env.TZ
  process.env.TZ = 'Asia/Shanghai'
  t.after(() => {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  })
  t.mock.timers.enable({ apis: ['Date'], now })
  const state = { template: { ...defaultTemplate(), ...overrides }, records: structuredClone(initialRecords), events: [] }
  let snapshot
  const connection = {
    async beginTransaction() { state.events.push('begin'); snapshot = structuredClone({ template: state.template, records: state.records }) },
    async commit() { state.events.push('commit') },
    async rollback() { state.events.push('rollback'); Object.assign(state, snapshot) },
    release() { state.events.push('release') },
    async query(sql, values = []) {
      if (sql.startsWith('SELECT') && sql.includes('FROM reminders WHERE id=')) return [[structuredClone(state.template)]]
      if (sql.startsWith('SELECT') && sql.includes('FROM reminder_records WHERE reminder_id=')) return [structuredClone(state.records)]
      if (sql.startsWith('SELECT id,status,scheduled_at FROM reminder_records')) {
        return [state.records.filter(row => row.id === values[0] && row.user_id === values[1]).map(row => structuredClone(row))]
      }
      if (sql.startsWith('SELECT id FROM users')) return [values.map(id => ({ id }))]
      if (sql.startsWith('UPDATE reminders')) {
        const [type_id, title, content, priority, target_mode, targets, rule, start_at, remind_before_days, id] = values
        assert.equal(id, state.template.id)
        Object.assign(state.template, { type_id, title, content, priority, target_mode, target_user_ids: JSON.parse(targets), repeat_rule: JSON.parse(rule), start_at, remind_before_days })
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('DELETE FROM reminder_records')) {
        state.records = state.records.filter(row => sql.includes('scheduled_at>=NOW()')
          ? row.scheduled_at < '2026-11-11 10:00:00'
          : row.id !== values[0] || ['completed', 'ignored'].includes(row.status))
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('UPDATE reminder_records SET scheduled_at=')) {
        const row = state.records.find(row => row.id === values[4])
        assert.ok(row)
        Object.assign(row, { scheduled_at: values[0], remind_at: values[1] })
        if (row.status === 'snoozed' && row.snoozed_until) {
          const deadline = new Date(values[0].replace(' ', 'T'))
          deadline.setHours(deadline.getHours() - 3)
          const deadlineText = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')} ${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}:${String(deadline.getSeconds()).padStart(2, '0')}`
          if (row.snoozed_until > deadlineText) row.snoozed_until = deadlineText
        }
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith("UPDATE reminder_records SET status='snoozed'")) {
        const row = state.records.find(row => row.id === values[1] && row.user_id === values[2])
        if (sql.includes("AND status!='completed'") && row.status === 'completed') return [{ affectedRows: 0 }]
        Object.assign(row, { status: 'snoozed', snoozed_until: values[0], action_at: '2026-11-11 10:00:00', last_prompted_at: null })
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('UPDATE reminder_records SET status=?')) {
        const row = state.records.find(row => row.id === values[1] && row.user_id === values[2])
        if (sql.includes("AND status!='completed'") && row.status === 'completed') return [{ affectedRows: 0 }]
        Object.assign(row, { status: values[0], snoozed_until: null, action_at: '2026-11-11 10:00:00', last_prompted_at: null })
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith('INSERT IGNORE INTO reminder_records')) {
        const [, user_id, scheduled_at, remind_at] = values
        if (!state.records.some(row => row.user_id === user_id && row.scheduled_at === scheduled_at)) {
          state.records.push({ ...record(1000 + state.records.length, user_id, 'pending', scheduled_at), remind_at, last_prompted_at: null })
        }
        return [{ affectedRows: 1 }]
      }
      throw new Error(`未预期的测试 SQL: ${sql}`)
    }
  }
  const pool = { async getConnection() { return connection }, async query(...args) { return connection.query(...args) } }
  t.mock.method(database, 'getDatabase', () => pool)
  const modulePath = require.resolve('../src/services/reminder.service')
  const cached = require.cache[modulePath]
  delete require.cache[modulePath]
  const service = require(modulePath)
  t.after(() => { if (cached) require.cache[modulePath] = cached; else delete require.cache[modulePath] })
  t.mock.method(service, 'ensure', async () => {})
  t.mock.method(service, 'getById', async () => structuredClone(state))
  return { service, state, connection }
}

test('00:00 改成 21:00 沿用同一任务和执行记录，完成、操作时间及节流不丢失', async t => {
  const original = record(11, 7, 'completed')
  const { service, state } = fixture(t, [original, record(12, 9)])
  await service.update(8, 3, { start_at: scheduled })
  assert.equal(state.template.id, 8)
  assert.equal(state.records.length, 2)
  assert.deepEqual(state.records[0], { ...original, scheduled_at: scheduled, remind_at: scheduled })
  assert.equal(state.records[1].id, 12)
  assert.equal(state.records[1].status, 'pending')
  assert.deepEqual(state.events, ['begin', 'commit', 'release'])
})

test('未来已完成记录在只改标题、提前提醒和再次保存后不会重置或改变 ID', async t => {
  const original = record(11, 7, 'completed', scheduled)
  const { service, state } = fixture(t, [original], { start_at: scheduled, target_user_ids: [7] })
  await service.update(8, 3, { title: '修改标题', remind_before_days: 2 })
  await service.update(8, 3, { title: '再次修改标题' })
  assert.equal(state.records.length, 1)
  assert.deepEqual(state.records[0], { ...original, remind_at: '2026-11-09 21:00:00' })
})

test('一次性任务改到其他日期仍保留员工完成状态，未完成员工同步到新日期', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'completed'), record(12, 9)])
  await service.update(8, 3, { start_at: '2026-11-20 21:00:00' })
  assert.deepEqual(state.records.map(row => [row.id, row.status, row.scheduled_at]), [
    [11, 'completed', '2026-11-20 21:00:00'], [12, 'pending', '2026-11-20 21:00:00']
  ])
})

test('每日任务调整时分保留本轮完成，下一周期独立待处理', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'completed'), record(12, 7, 'snoozed', '2026-11-12 00:00:00')], {
    target_user_ids: [7], repeat_rule: { type: 'daily', interval: 1, end_type: 'count', count: 2 }
  })
  await service.update(8, 3, { start_at: scheduled })
  assert.deepEqual(state.records.map(row => [row.id, row.status, row.scheduled_at]), [
    [11, 'completed', scheduled], [12, 'snoozed', '2026-11-12 21:00:00']
  ])
})

for (const repeatType of ['monthly', 'yearly']) {
  test(`${repeatType} 同周期改期保留完成记录，下一周期仍独立生成`, async t => {
    const { service, state } = fixture(t, [record(11, 7, 'completed')], {
      target_user_ids: [7], repeat_rule: { type: repeatType, interval: 1, end_type: 'count', count: 2, year_month: 11, month_day: 11 }
    })
    await service.update(8, 3, { start_at: '2026-11-20 21:00:00' })
    assert.equal(state.records[0].id, 11)
    assert.equal(state.records[0].status, 'completed')
    assert.equal(state.records[0].scheduled_at, '2026-11-20 21:00:00')
    assert.equal(state.records[1].status, 'pending')
  })
}

test('改期会删除已过旧执行时间的待处理记录，防止新提醒期前仍弹旧记录', async t => {
  const { service, state } = fixture(t, [record(11, 7), record(12, 7, 'completed', '2026-11-09 00:00:00')], {
    target_user_ids: [7], repeat_rule: { type: 'daily', interval: 1, end_type: 'count', count: 1 }
  })
  await service.update(8, 3, { start_at: '2026-11-20 21:00:00' })
  assert.equal(state.records.some(row => row.id === 11), false)
  assert.equal(state.records.find(row => row.id === 12).status, 'completed')
  assert.equal(state.records.find(row => row.status === 'pending').remind_at, '2026-11-20 21:00:00')
})

test('执行时间提前时收紧稍后提醒上限，保留原记录和操作时间', async t => {
  const snoozed = { ...record(11, 7, 'snoozed', '2026-11-20 21:00:00'), snoozed_until: '2026-11-19 20:00:00' }
  const { service, state } = fixture(t, [snoozed], { target_user_ids: [7], start_at: '2026-11-20 21:00:00' })
  await service.update(8, 3, { start_at: '2026-11-15 21:00:00' })
  assert.equal(state.records[0].id, 11)
  assert.equal(state.records[0].status, 'snoozed')
  assert.equal(state.records[0].snoozed_until, '2026-11-15 18:00:00')
  assert.equal(state.records[0].action_at, snoozed.action_at)
})

test('稍后提醒到完成始终更新同一条记录，重复完成幂等且完成后不能再延后', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'pending', '2026-11-15 21:00:00')], {
    target_user_ids: [7], start_at: '2026-11-15 21:00:00', remind_before_days: 7
  })
  await service.updateRecipient(7, 11, 'snooze', '2026-11-12 12:00:00')
  assert.equal(state.records.length, 1)
  assert.equal(state.records[0].status, 'snoozed')
  await service.updateRecipient(7, 11, 'complete')
  const completed = structuredClone(state.records[0])
  await service.updateRecipient(7, 11, 'complete')
  await assert.rejects(service.updateRecipient(7, 11, 'snooze', '2026-11-13 12:00:00'), /已完成/)
  assert.deepEqual(state.records, [completed])
  assert.equal(completed.id, 11)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.snoozed_until, null)
})

test('提醒期内提前完成，编辑后到执行时刻再次生成仍只有同一条完成记录', async t => {
  const execution = '2026-11-12 21:00:00'
  const { service, state, connection } = fixture(t, [record(11, 7, 'pending', execution)], {
    target_user_ids: [7], start_at: execution, remind_before_days: 2
  })
  await service.updateRecipient(7, 11, 'complete')
  const actionAt = state.records[0].action_at
  await service.update(8, 3, { start_at: '2026-11-12 22:00:00', title: '提前完成后改期' })
  t.mock.timers.setTime(new Date('2026-11-12T22:01:00+08:00').getTime())
  await service.materialize(connection, 8)
  assert.equal(state.records.length, 1)
  assert.equal(state.records[0].id, 11)
  assert.equal(state.records[0].status, 'completed')
  assert.equal(state.records[0].action_at, actionAt)
})

for (const action of ['snooze', 'read', 'ignore', 'complete']) {
  test(`并发完成后旧 ${action} 请求不能覆盖完成状态或完成时间`, async t => {
    const { service, state, connection } = fixture(t, [record(11, 7, 'pending', '2026-11-15 21:00:00')])
    const query = connection.query.bind(connection)
    t.mock.method(connection, 'query', async (sql, values) => {
      const result = await query(sql, values)
      if (sql.startsWith('SELECT id,status,scheduled_at')) {
        state.records[0].status = 'completed'
        state.records[0].action_at = '2026-11-11 10:01:00'
      }
      return result
    })
    const operation = service.updateRecipient(7, 11, action, '2026-11-12 12:00:00')
    if (action === 'complete') await operation
    else await assert.rejects(operation, /已完成/)
    assert.equal(state.records[0].status, 'completed')
    assert.equal(state.records[0].action_at, '2026-11-11 10:01:00')
  })
}

test('同周期旧完成记录和错误重建的待处理记录合并为原完成记录', async t => {
  const original = record(11, 7, 'completed')
  const { service, state } = fixture(t, [original, record(12, 7, 'pending', scheduled)], {
    target_user_ids: [7], start_at: scheduled,
    repeat_rule: { type: 'monthly', interval: 1, end_type: 'count', count: 1, month_day: 11 }
  })
  await service.update(8, 3, { title: '保留完成状态' })
  assert.deepEqual(state.records, [{ ...original, scheduled_at: scheduled, remind_at: scheduled }])
})

test('移除接收人时清除其未完成记录并保留历史完成记录', async t => {
  const { service, state } = fixture(t, [record(11, 7), record(12, 9), record(13, 9, 'completed', '2026-11-10 00:00:00')])
  await service.update(8, 3, { target_user_ids: [7] })
  assert.deepEqual(state.records.map(row => row.id), [11, 13])
})

test('修改全体员工任务时沿用人员快照，不把编辑当作重新分配', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'completed')], { target_mode: 'all', target_user_ids: [7] })
  t.mock.method(service, 'validateTargets', () => { throw new Error('不应重新展开全体员工') })
  await service.update(8, 3, { title: '修改标题', target_mode: 'all', target_user_ids: [] })
  assert.deepEqual(state.template.target_user_ids, [7])
  assert.equal(state.records[0].status, 'completed')
})

test('编辑失败整体回滚，未经授权不能改任务或执行记录', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'completed')])
  const before = structuredClone(state.records)
  await assert.rejects(service.update(8, 99, { start_at: scheduled }), /无权修改/)
  assert.deepEqual(state.records, before)
  assert.equal(state.template.start_at, '2026-11-11 00:00:00')
  assert.deepEqual(state.events, ['begin', 'rollback', 'release'])
})

test('重新校验队列只豁免提示节流，保留本人、到期和状态过滤且不重写提示时间', async t => {
  const { service, connection } = fixture(t, [])
  t.mock.method(service, 'refreshPendingOccurrences', async () => {})
  const writes = []
  t.mock.method(connection, 'query', async (sql, values) => {
    if (sql.startsWith('SELECT')) {
      assert.match(sql, /rr\.user_id=\?/)
      assert.match(sql, /rr\.remind_at<=NOW\(\)/)
      assert.match(sql, /rr\.status='pending'/)
      assert.match(sql, /rr\.snoozed_until<=NOW\(\)/)
      assert.match(sql, /rr\.last_prompted_at IS NULL OR rr\.id IN \(\?\)/)
      assert.deepEqual(values, [7, 11])
      return [[{ occurrence_id: 11, title: '已排队' }, { occurrence_id: 12, title: '首次提醒' }]]
    }
    writes.push(values)
    return [{ affectedRows: 1 }]
  })
  const rows = await service.pending(7, [11, 11, '无效'])
  assert.equal(rows.length, 2)
  assert.deepEqual(writes, [[12]])
})

for (const action of ['snooze', 'read', 'ignore']) {
  test(`最后3小时禁止 ${action} 绕过，完成仍更新同一条记录`, async t => {
    const { service, state } = fixture(t, [record(11, 7, 'pending', '2026-11-11 13:00:00')])
    await assert.rejects(service.updateRecipient(7, 11, action, '2026-11-11 10:30:00'), /最后3小时/)
    assert.equal(state.records[0].status, 'pending')
    await service.updateRecipient(7, 11, 'complete')
    assert.equal(state.records.length, 1)
    assert.equal(state.records[0].id, 11)
    assert.equal(state.records[0].status, 'completed')
  })
}

test('最后3小时之前允许稍后，但不能推迟到强制窗口内', async t => {
  const { service, state } = fixture(t, [record(11, 7, 'pending', '2026-11-11 21:00:00')])
  await assert.rejects(service.updateRecipient(7, 11, 'snooze', '2026-11-11 18:01:00'), /至少3小时/)
  await service.updateRecipient(7, 11, 'snooze', '2026-11-11 18:00:00')
  assert.equal(state.records[0].id, 11)
  assert.equal(state.records[0].status, 'snoozed')
})

test('个人未完成公告使用本人身份且不受稍后时间、节流或后续周期覆盖', async t => {
  const { service, connection } = fixture(t, [])
  t.mock.method(service, 'refreshPendingOccurrences', async () => {})
  t.mock.method(connection, 'query', async (sql, values) => {
    assert.deepEqual(values, [7])
    assert.match(sql, /rr.user_id=\?/)
    assert.match(sql, /rr.remind_at<=NOW\(\)/)
    assert.match(sql, /rr.status!='completed'/)
    assert.doesNotMatch(sql, /last_prompted_at|snoozed_until<=|NOT EXISTS|UPDATE/)
    return [[{ occurrence_id: 11, recipient_status: 'snoozed' }]]
  })
  assert.deepEqual(await service.active(7), [{ occurrence_id: 11, recipient_status: 'snoozed' }])
})
