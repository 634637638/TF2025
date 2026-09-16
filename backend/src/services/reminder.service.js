const { getDatabase } = require('../config/database')
const { ensureReminderSchema } = require('../utils/reminder-schema')

const MAX_GENERATION_DAYS = 120
const COMPLETION_NOTICE_DAYS = 30
const MAX_COMPLETION_NOTICES = 50
const MAX_PENDING_REMINDERS = 100
const NORMAL_PROMPT_INTERVAL_MINUTES = 6 * 60
const FINAL_DAY_PROMPT_INTERVAL_MINUTES = 60
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent'])
const REPEAT_TYPES = new Set(['once', 'daily', 'weekly', 'monthly', 'yearly'])
const PENDING_MATERIALIZE_INTERVAL_MS = 5 * 60 * 1000
let pendingMaterializedAt = 0
let pendingMaterializePromise = null

const REMINDER_COLUMNS = [
  'id', 'type_id', 'title', 'content', 'priority', 'target_mode',
  'target_user_ids', 'repeat_rule', 'start_at', 'remind_before_days',
  'status', 'created_by', 'created_at', 'updated_at'
]
const REMINDER_SELECT_COLUMNS = REMINDER_COLUMNS.join(', ')
const REMINDER_ALIASED_COLUMNS = REMINDER_COLUMNS.map(column => `r.${column}`).join(', ')
const REMINDER_TYPE_COLUMNS = [
  'id', 'name', 'default_remind_days', 'color', 'icon', 'sort_order',
  'is_active', 'created_at', 'updated_at'
].join(', ')

const asInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asDate(value) {
  if (!value) return null
  const rawValue = String(value).trim()
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00` : rawValue.replace(' ', 'T')
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = value => String(value).padStart(2, '0')
const sqlDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
const addDays = (date, days) => { const result = new Date(date); result.setDate(result.getDate() + days); return result }
const monthLastDay = (year, month) => new Date(year, month + 1, 0).getDate()

function normalizeWeekdays(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(item => asInt(item)).filter(item => item >= 1 && item <= 7))].sort((a, b) => a - b)
    : []
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(item => asInt(item)).filter(item => item > 0))]
    : []
}

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value || '') } catch (_) { return fallback }
}

class ReminderService {
  async ensure() { await ensureReminderSchema() }

  async activeUserIds(connection) {
    const [rows] = await connection.query("SELECT id FROM users WHERE status IN (1,'1','active') ORDER BY id")
    return rows.map(row => row.id)
  }

  async validateTargets(connection, mode, ids) {
    const targetIds = mode === 'all' ? await this.activeUserIds(connection) : normalizeIds(ids)
    if (targetIds.length === 0) throw new Error('请至少选择一名接收人')
    const placeholders = targetIds.map(() => '?').join(',')
    const [rows] = await connection.query(`SELECT id FROM users WHERE id IN (${placeholders}) AND status IN (1,'1','active')`, targetIds)
    if (rows.length !== targetIds.length) throw new Error('接收人中包含无效或已离职员工')
    return targetIds
  }

  normalizePayload(payload = {}, existing = null) {
    const repeatRule = {
      type: payload.repeat_type || existing?.repeat_rule?.type || 'once',
      interval: Math.max(1, Math.min(365, asInt(payload.interval_value ?? existing?.repeat_rule?.interval, 1))),
      weekdays: normalizeWeekdays(payload.weekdays ?? existing?.repeat_rule?.weekdays),
      year_month: asInt(payload.year_month ?? existing?.repeat_rule?.year_month, 1),
      month_day: asInt(payload.month_day ?? existing?.repeat_rule?.month_day, 1),
      missing_day_policy: payload.missing_day_policy || existing?.repeat_rule?.missing_day_policy || 'last-day',
      end_type: payload.end_type || existing?.repeat_rule?.end_type || 'never',
      end_at: null,
      count: null
    }
    if (!REPEAT_TYPES.has(repeatRule.type)) throw new Error('重复方式无效')
    if (!['specific', 'all'].includes(payload.target_mode || existing?.target_mode || 'specific')) throw new Error('接收范围无效')
    if (!['last-day', 'skip'].includes(repeatRule.missing_day_policy)) throw new Error('缺少日期处理方式无效')
    if (!['never', 'date', 'count'].includes(repeatRule.end_type)) throw new Error('结束方式无效')
    const startAt = asDate(payload.start_at || existing?.start_at)
    if (!startAt) throw new Error('请选择执行时间')
    if (['monthly', 'yearly'].includes(repeatRule.type)) {
      repeatRule.month_day = startAt.getDate()
      repeatRule.missing_day_policy = 'last-day'
    }
    if (repeatRule.type === 'yearly') repeatRule.year_month = startAt.getMonth() + 1
    if (repeatRule.type === 'weekly' && repeatRule.weekdays.length === 0) throw new Error('每周提醒至少选择一天')
    if (['monthly', 'yearly'].includes(repeatRule.type) && (repeatRule.month_day < 1 || repeatRule.month_day > 31)) throw new Error('执行日期必须在1到31之间')
    if (repeatRule.type === 'yearly' && (repeatRule.year_month < 1 || repeatRule.year_month > 12)) throw new Error('执行月份必须在1到12之间')
    if (repeatRule.end_type === 'date') {
      const endAt = asDate(payload.end_at || existing?.repeat_rule?.end_at)
      if (!endAt || endAt < startAt) throw new Error('结束日期必须晚于开始日期')
      repeatRule.end_at = sqlDate(endAt)
    }
    if (repeatRule.end_type === 'count') repeatRule.count = Math.max(1, Math.min(10000, asInt(payload.occurrence_limit ?? existing?.repeat_rule?.count, 1)))
    if (repeatRule.type === 'once') repeatRule.end_type = 'never'
    const title = String(payload.title ?? existing?.title ?? '').trim()
    if (!title) throw new Error('请输入待办标题')
    if (title.length > 200) throw new Error('待办标题不能超过200个字符')
    const priority = payload.priority || existing?.priority || 'normal'
    if (!PRIORITIES.has(priority)) throw new Error('优先级无效')
    return {
      type_id: payload.type_id === '' || payload.type_id === null || payload.type_id === undefined ? (existing?.type_id || null) : asInt(payload.type_id),
      title,
      content: String(payload.content ?? existing?.content ?? '').trim() || null,
      priority,
      target_mode: payload.target_mode || existing?.target_mode || 'specific',
      target_user_ids: normalizeIds(payload.target_user_ids ?? existing?.target_user_ids),
      repeat_rule: repeatRule,
      start_at: sqlDate(startAt),
      remind_before_days: Math.max(0, Math.min(365, asInt(payload.remind_before_days ?? existing?.remind_before_days, 7)))
    }
  }

  occurrenceDates(reminder, now = new Date()) {
    const rule = parseJson(reminder.repeat_rule, {})
    const start = asDate(reminder.start_at)
    if (!start) return []
    const endDate = rule.end_type === 'date' ? asDate(rule.end_at) : null
    const interval = Math.max(1, asInt(rule.interval, 1))
    const remindBeforeDays = Math.max(0, asInt(reminder.remind_before_days, 7))
    const generationDays = rule.type === 'yearly'
      ? Math.max(MAX_GENERATION_DAYS, interval * 366 + 31, remindBeforeDays + 31)
      : Math.max(MAX_GENERATION_DAYS, remindBeforeDays + 31)
    const horizon = addDays(now, generationDays)
    const end = endDate && endDate < horizon ? endDate : horizon
    const maxCount = rule.end_type === 'count' ? asInt(rule.count, 1) : 5000
    const result = []
    const add = date => { if (date >= start && date <= end && result.length < maxCount) result.push(new Date(date)) }
    if (rule.type === 'once') return [start]
    if (rule.type === 'daily') { for (let i = 0; i < maxCount; i += 1) { const date = addDays(start, i * interval); if (date > end) break; add(date) } return result }
    if (rule.type === 'weekly') {
      const weekdays = normalizeWeekdays(rule.weekdays)
      for (let date = new Date(start); date <= end && result.length < maxCount; date = addDays(date, 1)) {
        const day = date.getDay() === 0 ? 7 : date.getDay()
        const weekIndex = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 604800000)
        if (weekIndex % interval === 0 && weekdays.includes(day)) add(date)
      }
      return result
    }
    if (rule.type === 'yearly') {
      for (let occurrenceIndex = 0; occurrenceIndex <= maxCount && result.length < maxCount; occurrenceIndex += 1) {
        const year = start.getFullYear() + occurrenceIndex * interval
        const month = asInt(rule.year_month, 1) - 1
        const monthStart = new Date(year, month, 1, start.getHours(), start.getMinutes(), start.getSeconds())
        if (monthStart > end) break
        const lastDay = monthLastDay(year, month)
        if (asInt(rule.month_day, 1) > lastDay && rule.missing_day_policy === 'skip') continue
        const date = new Date(year, month, Math.min(asInt(rule.month_day, 1), lastDay), start.getHours(), start.getMinutes(), start.getSeconds())
        if (date > end) break
        add(date)
      }
      return result
    }
    for (let month = 0; month < 120 && result.length < maxCount; month += interval) {
      const date = new Date(start.getFullYear(), start.getMonth() + month, 1, start.getHours(), start.getMinutes(), start.getSeconds())
      const lastDay = monthLastDay(date.getFullYear(), date.getMonth())
      if (asInt(rule.month_day, 1) > lastDay && rule.missing_day_policy === 'skip') continue
      date.setDate(Math.min(asInt(rule.month_day, 1), lastDay))
      add(date)
    }
    return result
  }

  async materialize(connection, reminderId) {
    const [rows] = await connection.query(`SELECT ${REMINDER_SELECT_COLUMNS} FROM reminders WHERE id=? AND status='active'`, [reminderId])
    const reminder = rows[0]
    if (!reminder) return
    const users = normalizeIds(parseJson(reminder.target_user_ids, []))
    const dates = this.occurrenceDates(reminder)
    for (const scheduledAt of dates) {
      const remindAt = addDays(scheduledAt, -Math.max(0, asInt(reminder.remind_before_days, 7)))
      for (const userId of users) {
        await connection.query('INSERT IGNORE INTO reminder_records (reminder_id,user_id,scheduled_at,remind_at) VALUES (?,?,?,?)', [reminder.id, userId, sqlDate(scheduledAt), sqlDate(remindAt)])
      }
    }
  }

  async refreshPendingOccurrences(db) {
    if (Date.now() - pendingMaterializedAt < PENDING_MATERIALIZE_INTERVAL_MS) return
    if (!pendingMaterializePromise) {
      pendingMaterializePromise = (async () => {
        const [active] = await db.query("SELECT id FROM reminders WHERE status='active'")
        for (const item of active) await this.materialize(db, item.id)
        pendingMaterializedAt = Date.now()
      })().finally(() => { pendingMaterializePromise = null })
    }
    await pendingMaterializePromise
  }

  async create(userId, payload) {
    await this.ensure()
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const normalized = this.normalizePayload(payload)
      if (normalized.type_id) {
        const [typeRows] = await connection.query('SELECT id FROM reminder_types WHERE id=? AND is_active=1', [normalized.type_id])
        if (!typeRows[0]) throw new Error('事项类型不存在或已停用')
      }
      const targetIds = await this.validateTargets(connection, normalized.target_mode, normalized.target_user_ids)
      const [result] = await connection.query(
        `INSERT INTO reminders
          (type_id,title,content,priority,target_mode,target_user_ids,repeat_rule,start_at,remind_before_days,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          normalized.type_id,
          normalized.title,
          normalized.content,
          normalized.priority,
          normalized.target_mode,
          JSON.stringify(targetIds),
          JSON.stringify(normalized.repeat_rule),
          normalized.start_at,
          normalized.remind_before_days,
          userId
        ]
      )
      await this.materialize(connection, result.insertId)
      await connection.commit()
      return this.getById(result.insertId)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async update(id, userId, payload, canManage = false) {
    await this.ensure()
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query(`SELECT ${REMINDER_SELECT_COLUMNS} FROM reminders WHERE id=? AND status!='archived' FOR UPDATE`, [id])
      const existing = rows[0]
      if (!existing) throw new Error('待办不存在')
      if (!canManage && asInt(existing.created_by) !== asInt(userId)) throw new Error('无权修改他人创建的待办')
      const existingRule = parseJson(existing.repeat_rule, {})
      const existingTargets = normalizeIds(parseJson(existing.target_user_ids, []))
      const normalized = this.normalizePayload(payload, { ...existing, repeat_rule: existingRule, target_user_ids: existingTargets })
      if (normalized.type_id) {
        const [typeRows] = await connection.query('SELECT id FROM reminder_types WHERE id=? AND is_active=1', [normalized.type_id])
        if (!typeRows[0]) throw new Error('事项类型不存在或已停用')
      }
      const targetMode = payload.target_mode || existing.target_mode
      const targetIds = payload.target_mode === undefined && payload.target_user_ids === undefined
        ? existingTargets
        : await this.validateTargets(connection, targetMode, normalized.target_user_ids)
      await connection.query(
        `UPDATE reminders
         SET type_id=?,title=?,content=?,priority=?,target_mode=?,target_user_ids=?,repeat_rule=?,start_at=?,remind_before_days=?,updated_at=NOW()
         WHERE id=?`,
        [
          normalized.type_id,
          normalized.title,
          normalized.content,
          normalized.priority,
          targetMode,
          JSON.stringify(targetIds),
          JSON.stringify(normalized.repeat_rule),
          normalized.start_at,
          normalized.remind_before_days,
          id
        ]
      )
      await connection.query('DELETE FROM reminder_records WHERE reminder_id=? AND scheduled_at>=NOW()', [id])
      await this.materialize(connection, id)
      await connection.commit()
      return this.getById(id)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async archive(id, userId, canManage = false) {
    await this.ensure()
    const db = getDatabase()
    const [rows] = await db.query("SELECT id,created_by FROM reminders WHERE id=? AND status!='archived'", [id])
    if (!rows[0]) throw new Error('待办不存在')
    if (!canManage && asInt(rows[0].created_by) !== asInt(userId)) throw new Error('无权删除他人创建的待办')
    await db.query("UPDATE reminders SET status='archived', updated_at=NOW() WHERE id=? AND status!='archived'", [id])
  }

  async getTypes() {
    await this.ensure()
    const [rows] = await getDatabase().query(`SELECT ${REMINDER_TYPE_COLUMNS} FROM reminder_types ORDER BY sort_order,id`)
    return rows
  }

  async createType(payload) {
    await this.ensure()
    const name = String(payload.name || '').trim()
    if (!name) throw new Error('请输入类型名称')
    const color = /^#[0-9a-f]{6}$/i.test(String(payload.color || '')) ? String(payload.color) : '#409EFF'
    const [result] = await getDatabase().query(
      'INSERT INTO reminder_types (name,default_remind_days,color,sort_order) VALUES (?,?,?,?)',
      [name, Math.max(0, asInt(payload.default_remind_days, 7)), color, asInt(payload.sort_order)]
    )
    const [rows] = await getDatabase().query(`SELECT ${REMINDER_TYPE_COLUMNS} FROM reminder_types WHERE id=?`, [result.insertId])
    return rows[0]
  }

  async updateType(id, payload) {
    await this.ensure()
    const db = getDatabase()
    const [existingRows] = await db.query(`SELECT ${REMINDER_TYPE_COLUMNS} FROM reminder_types WHERE id=?`, [id])
    const existing = existingRows[0]
    if (!existing) throw new Error('事项类型不存在')
    const name = String(payload.name ?? existing.name).trim()
    if (!name) throw new Error('请输入类型名称')
    const requestedColor = String(payload.color ?? existing.color)
    if (!/^#[0-9a-f]{6}$/i.test(requestedColor)) throw new Error('识别颜色格式无效')
    await db.query(
      'UPDATE reminder_types SET name=?,default_remind_days=?,color=?,sort_order=? WHERE id=?',
      [
        name,
        payload.default_remind_days === undefined ? existing.default_remind_days : Math.max(0, asInt(payload.default_remind_days)),
        requestedColor,
        payload.sort_order === undefined ? existing.sort_order : asInt(payload.sort_order),
        id
      ]
    )
    const [rows] = await db.query(`SELECT ${REMINDER_TYPE_COLUMNS} FROM reminder_types WHERE id=?`, [id])
    return rows[0]
  }

  async toggleType(id, active) {
    await this.ensure()
    await getDatabase().query('UPDATE reminder_types SET is_active=? WHERE id=?', [active ? 1 : 0, id])
  }
  async deleteType(id) {
    await this.ensure()
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [typeRows] = await connection.query('SELECT id,name FROM reminder_types WHERE id=? FOR UPDATE', [id])
      if (!typeRows[0]) throw new Error('事项类型不存在')
      const [usageRows] = await connection.query('SELECT COUNT(*) total FROM reminders WHERE type_id=?', [id])
      if (Number(usageRows[0]?.total || 0) > 0) throw new Error('该事项类型已被待办使用，请停用而不是删除')
      await connection.query('DELETE FROM reminder_types WHERE id=?', [id])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
  async getUsers() {
    await this.ensure()
    const [rows] = await getDatabase().query(
      "SELECT id,username,name,phone,email,status FROM users WHERE status IN (1,'1','active') ORDER BY name,username"
    )
    return rows
  }

  serialize(row) {
    const rule = parseJson(row.repeat_rule, {})
    const ids = normalizeIds(parseJson(row.target_user_ids, []))
    return {
      id: row.id,
      type_id: row.type_id,
      title: row.title,
      content: row.content,
      priority: row.priority,
      target_mode: row.target_mode,
      start_at: row.start_at,
      remind_before_days: row.remind_before_days,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      type_name: row.type_name,
      type_color: row.type_color,
      creator_name: row.creator_name,
      completed_count: row.completed_count,
      ignored_count: row.ignored_count,
      next_occurrence_at: row.next_occurrence_at,
      repeat_type: rule.type || 'once',
      interval_value: rule.interval || 1,
      weekdays_json: JSON.stringify(rule.weekdays || []),
      year_month: rule.year_month,
      month_day: rule.month_day,
      missing_day_policy: rule.missing_day_policy || 'last-day',
      end_type: rule.end_type || 'never',
      end_at: rule.end_at,
      occurrence_limit: rule.count,
      target_count: ids.length
    }
  }

  async list({ page = 1, page_size = 20, keyword = '', search_fields = ['title', 'content'], status = '', type_id = '', user_id = null, can_manage = false } = {}) {
    await this.ensure()
    const db = getDatabase()
    const page_number = Math.max(1, asInt(page, 1))
    const page_size_number = Math.min(100, Math.max(1, asInt(page_size, 20)))
    const conditions = ["r.status!='archived'"]
    const params = []
    const current_user_id = asInt(user_id)

    if (!can_manage) {
      conditions.push('(r.created_by=? OR EXISTS (SELECT 1 FROM reminder_records own_rr WHERE own_rr.reminder_id=r.id AND own_rr.user_id=?))')
      params.push(current_user_id, current_user_id)
    }
    if (keyword) {
      const allowed_search_fields = search_fields.filter(field => field === 'title' || field === 'content')
      if (allowed_search_fields.length) {
        conditions.push(`(${allowed_search_fields.map(field => `r.${field} LIKE ?`).join(' OR ')})`)
        params.push(...allowed_search_fields.map(() => `%${keyword}%`))
      }
    }
    if (status) {
      conditions.push('r.status=?')
      params.push(status)
    }
    if (type_id) {
      conditions.push('r.type_id=?')
      params.push(asInt(type_id))
    }

    const where = conditions.join(' AND ')
    const record_join = can_manage
      ? 'LEFT JOIN reminder_records rr ON rr.reminder_id=r.id'
      : 'LEFT JOIN reminder_records rr ON rr.reminder_id=r.id AND rr.user_id=?'
    const row_params = can_manage ? params : [current_user_id, ...params]
    const [count] = await db.query(`SELECT COUNT(*) total FROM reminders r WHERE ${where}`, params)
    const [summaryRows] = await db.query(
      `SELECT
         COUNT(DISTINCT r.id) total,
         COUNT(DISTINCT CASE WHEN r.status='active' THEN r.id END) active_count,
         COUNT(CASE WHEN rr.status='completed' THEN 1 END) completed_count,
         COUNT(CASE WHEN rr.status='ignored' THEN 1 END) ignored_count
       FROM reminders r
       ${record_join}
       WHERE ${where}`,
      row_params
    )
    const [rows] = await db.query(
      `SELECT ${REMINDER_ALIASED_COLUMNS},rt.name type_name,rt.color type_color,creator.name creator_name,
        COUNT(CASE WHEN rr.status='completed' THEN 1 END) completed_count,
        COUNT(CASE WHEN rr.status='ignored' THEN 1 END) ignored_count,
        MIN(CASE WHEN rr.scheduled_at>=NOW() THEN rr.scheduled_at END) next_occurrence_at
       FROM reminders r
       LEFT JOIN reminder_types rt ON rt.id=r.type_id
       LEFT JOIN users creator ON creator.id=r.created_by
       ${record_join}
       WHERE ${where}
       GROUP BY r.id
       ORDER BY r.status='active' DESC,r.created_at DESC
       LIMIT ${page_size_number} OFFSET ${(page_number - 1) * page_size_number}`,
      row_params
    )
    const total = Number(count[0]?.total || 0)
    const summaryRow = summaryRows[0] || {}
    const total_pages = Math.ceil(total / page_size_number)

    return {
      rows: rows.map(row => {
        const serialized = this.serialize(row)
        const is_creator = asInt(row.created_by) === current_user_id
        return can_manage || is_creator
          ? serialized
          : { ...serialized, target_mode: 'specific', target_count: 1 }
      }),
      pagination: {
        page: page_number,
        page_size: page_size_number,
        total,
        total_pages,
        has_next: page_number < total_pages,
        has_prev: page_number > 1
      },
      summary: {
        total: Number(summaryRow.total) || 0,
        active_count: Number(summaryRow.active_count) || 0,
        completed_count: Number(summaryRow.completed_count) || 0,
        ignored_count: Number(summaryRow.ignored_count) || 0
      }
    }
  }

  async getById(id, { user_id = null, can_manage = true } = {}) {
    await this.ensure()
    const db = getDatabase()
    const access_condition = can_manage
      ? ''
      : 'AND (r.created_by=? OR EXISTS (SELECT 1 FROM reminder_records own_rr WHERE own_rr.reminder_id=r.id AND own_rr.user_id=?))'
    const access_params = can_manage ? [id] : [id, asInt(user_id), asInt(user_id)]
    const [rows] = await db.query(
      `SELECT ${REMINDER_ALIASED_COLUMNS},rt.name type_name,rt.color type_color,creator.name creator_name
       FROM reminders r
       LEFT JOIN reminder_types rt ON rt.id=r.type_id
       LEFT JOIN users creator ON creator.id=r.created_by
       WHERE r.id=? AND r.status!='archived' ${access_condition}`,
      access_params
    )
    if (!rows[0]) return null
    const row = this.serialize(rows[0])
    const is_creator = !can_manage && asInt(rows[0].created_by) === asInt(user_id)
    const can_view_recipients = can_manage || is_creator
    const ids = can_view_recipients ? normalizeIds(parseJson(rows[0].target_user_ids, [])) : [asInt(user_id)]
    let targets = []
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',')
      const [targetRows] = await db.query(`SELECT id,username,name,phone,email FROM users WHERE id IN (${placeholders}) ORDER BY name,username`, ids)
      targets = targetRows
    }
    const record_condition = can_view_recipients ? '' : 'AND rr.user_id=?'
    const record_params = can_view_recipients ? [id] : [id, asInt(user_id)]
    const [records] = await db.query(
      `SELECT rr.id occurrence_id,rr.scheduled_at,rr.remind_at,rr.user_id,
        rr.status recipient_status,rr.action_at,rr.snoozed_until,u.name user_name,u.username
       FROM reminder_records rr
       LEFT JOIN users u ON u.id=rr.user_id
       WHERE rr.reminder_id=? ${record_condition} AND rr.remind_at<=NOW()
       ORDER BY rr.scheduled_at DESC,rr.user_id LIMIT 500`,
      record_params
    )
    return {
      ...row,
      target_mode: can_view_recipients ? row.target_mode : 'specific',
      target_count: can_view_recipients ? row.target_count : 1,
      record_scope: can_view_recipients ? 'all' : 'self',
      targets,
      occurrences: records.map(item => ({
        ...item,
        completed_at: item.recipient_status === 'completed' ? item.action_at : null,
        ignored_at: item.recipient_status === 'ignored' ? item.action_at : null,
        read_at: item.recipient_status === 'read' ? item.action_at : null
      }))
    }
  }

  async pending(userId) {
    await this.ensure()
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      await this.refreshPendingOccurrences(connection)
      const [rows] = await connection.query(
        `SELECT rr.id occurrence_id,rr.scheduled_at,rr.remind_at,r.id reminder_id,
          r.title,r.content,r.priority,rt.name type_name,rt.color type_color,
          rr.status recipient_status,rr.action_at,rr.snoozed_until
         FROM reminder_records rr
         JOIN reminders r ON r.id=rr.reminder_id
         LEFT JOIN reminder_types rt ON rt.id=r.type_id
         WHERE rr.user_id=? AND r.status='active' AND rr.remind_at<=NOW()
           AND (rr.status='pending' OR (rr.status='snoozed' AND (rr.snoozed_until IS NULL OR rr.snoozed_until<=NOW())))
           AND NOT EXISTS (
             SELECT 1 FROM reminder_records newer
             WHERE newer.reminder_id=rr.reminder_id
               AND newer.user_id=rr.user_id
               AND newer.remind_at<=NOW()
               AND newer.scheduled_at>rr.scheduled_at
           )
           AND (
             rr.last_prompted_at IS NULL
             OR (
               rr.scheduled_at<=DATE_ADD(NOW(), INTERVAL 1 DAY)
               AND rr.last_prompted_at<=DATE_SUB(NOW(), INTERVAL ${FINAL_DAY_PROMPT_INTERVAL_MINUTES} MINUTE)
             )
             OR (
               rr.scheduled_at>DATE_ADD(NOW(), INTERVAL 1 DAY)
               AND rr.last_prompted_at<=DATE_SUB(NOW(), INTERVAL ${NORMAL_PROMPT_INTERVAL_MINUTES} MINUTE)
             )
           )
         ORDER BY r.priority='urgent' DESC,r.priority='high' DESC,rr.remind_at DESC
         LIMIT ${MAX_PENDING_REMINDERS}
         FOR UPDATE`,
        [userId]
      )
      if (rows.length) {
        const placeholders = rows.map(() => '?').join(',')
        await connection.query(
          `UPDATE reminder_records SET last_prompted_at=NOW()
           WHERE id IN (${placeholders})`,
          rows.map(row => row.occurrence_id)
        )
      }
      await connection.commit()
      return rows
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async pendingCompletions(adminUserId) {
    await this.ensure()
    const db = getDatabase()
    const [rows] = await db.query(
      `SELECT rr.id occurrence_id,rr.reminder_id,rr.scheduled_at,rr.remind_at,
        r.title,r.content,r.priority,rt.name type_name,rt.color type_color,
        rr.user_id,rr.action_at,
        u.name user_name,u.username
       FROM reminder_records rr
       JOIN reminders r ON r.id=rr.reminder_id
       LEFT JOIN reminder_types rt ON rt.id=r.type_id
       LEFT JOIN users u ON u.id=rr.user_id
       LEFT JOIN reminder_completion_views cv
         ON cv.occurrence_id=rr.id AND cv.admin_user_id=?
       WHERE rr.status='completed'
         AND rr.user_id<>?
         AND rr.action_at>=DATE_SUB(NOW(), INTERVAL ${COMPLETION_NOTICE_DAYS} DAY)
         AND cv.occurrence_id IS NULL
       ORDER BY rr.action_at DESC
       LIMIT ${MAX_COMPLETION_NOTICES}`,
      [adminUserId, adminUserId]
    )
    return rows
  }

  async acknowledgeCompletion(adminUserId, occurrenceId) {
    await this.ensure()
    const db = getDatabase()
    await db.query(
      `INSERT IGNORE INTO reminder_completion_views (occurrence_id,admin_user_id)
       SELECT id,? FROM reminder_records WHERE id=? AND status='completed'`,
      [adminUserId, occurrenceId]
    )
  }

  async updateRecipient(userId, recordId, action, snoozedUntil) {
    await this.ensure()
    const db = getDatabase()
    const [rows] = await db.query(
      'SELECT id,status,scheduled_at FROM reminder_records WHERE id=? AND user_id=?',
      [recordId, userId]
    )
    if (!rows[0]) throw new Error('该待办未分配给当前员工')
    if (rows[0].status === 'completed') {
      if (action === 'complete') return
      throw new Error('该周期已完成，不能再修改状态')
    }
    if (action === 'snooze') {
      const now = new Date()
      const scheduledAt = asDate(rows[0].scheduled_at)
      const until = asDate(snoozedUntil) || addDays(now, 1)
      if (until <= now) throw new Error('稍后提醒时间必须晚于当前时间')
      const snoozeDeadline = scheduledAt ? addDays(scheduledAt, -1) : null
      if (!snoozeDeadline || now >= snoozeDeadline || until > snoozeDeadline) {
        throw new Error('稍后提醒时间必须早于本轮执行时间至少1天')
      }
      await db.query(
        "UPDATE reminder_records SET status='snoozed',snoozed_until=?,last_prompted_at=NULL,action_at=NOW(),updated_at=NOW() WHERE id=? AND user_id=?",
        [sqlDate(until), recordId, userId]
      )
      return
    }
    const statusByAction = { read: 'read', ignore: 'ignored', complete: 'completed' }
    if (!statusByAction[action]) throw new Error('状态操作无效')
    await db.query(
      'UPDATE reminder_records SET status=?,action_at=NOW(),snoozed_until=NULL,last_prompted_at=NULL,updated_at=NOW() WHERE id=? AND user_id=?',
      [statusByAction[action], recordId, userId]
    )
  }
}

module.exports = new ReminderService()
