const { getDatabase } = require('../config/database');
const { ensureReminderSchema } = require('../utils/reminder-schema');

const MAX_GENERATION_DAYS = 120;
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const REPEAT_TYPES = new Set(['once', 'daily', 'weekly', 'monthly', 'yearly']);
const PENDING_MATERIALIZE_INTERVAL_MS = 5 * 60 * 1000;
let pendingMaterializedAt = 0;
let pendingMaterializePromise = null;

const asInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function asDate(value) {
  if (!value) return null;
  const rawValue = String(value).trim();
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? `${rawValue}T00:00:00` : rawValue.replace(' ', 'T');
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = value => String(value).padStart(2, '0');
const sqlDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const addDays = (date, days) => { const result = new Date(date); result.setDate(result.getDate() + days); return result; };
const monthLastDay = (year, month) => new Date(year, month + 1, 0).getDate();

function normalizeWeekdays(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(item => asInt(item)).filter(item => item >= 1 && item <= 7))].sort((a, b) => a - b)
    : [];
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(item => asInt(item)).filter(item => item > 0))]
    : [];
}

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || ''); } catch (_) { return fallback; }
}

class ReminderService {
  async ensure() { await ensureReminderSchema(); }

  async activeUserIds(connection) {
    const [rows] = await connection.query("SELECT id FROM users WHERE status IN (1,'1','active') ORDER BY id");
    return rows.map(row => row.id);
  }

  async validateTargets(connection, mode, ids) {
    const targetIds = mode === 'all' ? await this.activeUserIds(connection) : normalizeIds(ids);
    if (targetIds.length === 0) throw new Error('请至少选择一名接收人');
    const placeholders = targetIds.map(() => '?').join(',');
    const [rows] = await connection.query(`SELECT id FROM users WHERE id IN (${placeholders}) AND status IN (1,'1','active')`, targetIds);
    if (rows.length !== targetIds.length) throw new Error('接收人中包含无效或已离职员工');
    return targetIds;
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
    };
    if (!REPEAT_TYPES.has(repeatRule.type)) throw new Error('重复方式无效');
    if (!['specific', 'all'].includes(payload.target_mode || existing?.target_mode || 'specific')) throw new Error('接收范围无效');
    if (!['last-day', 'skip'].includes(repeatRule.missing_day_policy)) throw new Error('缺少日期处理方式无效');
    if (!['never', 'date', 'count'].includes(repeatRule.end_type)) throw new Error('结束方式无效');
    const startAt = asDate(payload.start_at || existing?.start_at);
    if (!startAt) throw new Error('请选择执行时间');
    if (['monthly', 'yearly'].includes(repeatRule.type)) {
      repeatRule.month_day = startAt.getDate();
      repeatRule.missing_day_policy = 'last-day';
    }
    if (repeatRule.type === 'yearly') repeatRule.year_month = startAt.getMonth() + 1;
    if (repeatRule.type === 'weekly' && repeatRule.weekdays.length === 0) throw new Error('每周提醒至少选择一天');
    if (['monthly', 'yearly'].includes(repeatRule.type) && (repeatRule.month_day < 1 || repeatRule.month_day > 31)) throw new Error('执行日期必须在1到31之间');
    if (repeatRule.type === 'yearly' && (repeatRule.year_month < 1 || repeatRule.year_month > 12)) throw new Error('执行月份必须在1到12之间');
    if (repeatRule.end_type === 'date') {
      const endAt = asDate(payload.end_at || existing?.repeat_rule?.end_at);
      if (!endAt || endAt < startAt) throw new Error('结束日期必须晚于开始日期');
      repeatRule.end_at = sqlDate(endAt);
    }
    if (repeatRule.end_type === 'count') repeatRule.count = Math.max(1, Math.min(10000, asInt(payload.occurrence_limit ?? existing?.repeat_rule?.count, 1)));
    if (repeatRule.type === 'once') repeatRule.end_type = 'never';
    const title = String(payload.title ?? existing?.title ?? '').trim();
    if (!title) throw new Error('请输入待办标题');
    if (title.length > 200) throw new Error('待办标题不能超过200个字符');
    const priority = payload.priority || existing?.priority || 'normal';
    if (!PRIORITIES.has(priority)) throw new Error('优先级无效');
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
    };
  }

  occurrenceDates(reminder, now = new Date()) {
    const rule = parseJson(reminder.repeat_rule, {});
    const start = asDate(reminder.start_at);
    if (!start) return [];
    const endDate = rule.end_type === 'date' ? asDate(rule.end_at) : null;
    const interval = Math.max(1, asInt(rule.interval, 1));
    const remindBeforeDays = Math.max(0, asInt(reminder.remind_before_days, 7));
    const generationDays = rule.type === 'yearly'
      ? Math.max(MAX_GENERATION_DAYS, interval * 366 + 31, remindBeforeDays + 31)
      : Math.max(MAX_GENERATION_DAYS, remindBeforeDays + 31);
    const horizon = addDays(now, generationDays);
    const end = endDate && endDate < horizon ? endDate : horizon;
    const maxCount = rule.end_type === 'count' ? asInt(rule.count, 1) : 5000;
    const result = [];
    const add = date => { if (date >= start && date <= end && result.length < maxCount) result.push(new Date(date)); };
    if (rule.type === 'once') return [start];
    if (rule.type === 'daily') { for (let i = 0; i < maxCount; i += 1) { const date = addDays(start, i * interval); if (date > end) break; add(date); } return result; }
    if (rule.type === 'weekly') {
      const weekdays = normalizeWeekdays(rule.weekdays);
      for (let date = new Date(start); date <= end && result.length < maxCount; date = addDays(date, 1)) {
        const day = date.getDay() === 0 ? 7 : date.getDay();
        const weekIndex = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) / 604800000);
        if (weekIndex % interval === 0 && weekdays.includes(day)) add(date);
      }
      return result;
    }
    if (rule.type === 'yearly') {
      for (let occurrenceIndex = 0; occurrenceIndex <= maxCount && result.length < maxCount; occurrenceIndex += 1) {
        const year = start.getFullYear() + occurrenceIndex * interval;
        const month = asInt(rule.year_month, 1) - 1;
        const monthStart = new Date(year, month, 1, start.getHours(), start.getMinutes(), start.getSeconds());
        if (monthStart > end) break;
        const lastDay = monthLastDay(year, month);
        if (asInt(rule.month_day, 1) > lastDay && rule.missing_day_policy === 'skip') continue;
        const date = new Date(year, month, Math.min(asInt(rule.month_day, 1), lastDay), start.getHours(), start.getMinutes(), start.getSeconds());
        if (date > end) break;
        add(date);
      }
      return result;
    }
    for (let month = 0; month < 120 && result.length < maxCount; month += interval) {
      const date = new Date(start.getFullYear(), start.getMonth() + month, 1, start.getHours(), start.getMinutes(), start.getSeconds());
      const lastDay = monthLastDay(date.getFullYear(), date.getMonth());
      if (asInt(rule.month_day, 1) > lastDay && rule.missing_day_policy === 'skip') continue;
      date.setDate(Math.min(asInt(rule.month_day, 1), lastDay));
      add(date);
    }
    return result;
  }

  async materialize(connection, reminderId) {
    const [rows] = await connection.query("SELECT * FROM reminders WHERE id=? AND status='active'", [reminderId]);
    const reminder = rows[0];
    if (!reminder) return;
    const users = normalizeIds(parseJson(reminder.target_user_ids, []));
    const dates = this.occurrenceDates(reminder);
    for (const scheduledAt of dates) {
      const remindAt = addDays(scheduledAt, -Math.max(0, asInt(reminder.remind_before_days, 7)));
      for (const userId of users) {
        await connection.query(`INSERT IGNORE INTO reminder_records (reminder_id,user_id,scheduled_at,remind_at) VALUES (?,?,?,?)`, [reminder.id, userId, sqlDate(scheduledAt), sqlDate(remindAt)]);
      }
    }
  }

  async refreshPendingOccurrences(db) {
    if (Date.now() - pendingMaterializedAt < PENDING_MATERIALIZE_INTERVAL_MS) return;
    if (!pendingMaterializePromise) {
      pendingMaterializePromise = (async () => {
        const [active] = await db.query("SELECT id FROM reminders WHERE status='active'");
        for (const item of active) await this.materialize(db, item.id);
        pendingMaterializedAt = Date.now();
      })().finally(() => { pendingMaterializePromise = null; });
    }
    await pendingMaterializePromise;
  }

  async create(userId, payload) {
    await this.ensure();
    const db = getDatabase(); const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const normalized = this.normalizePayload(payload);
      if (normalized.type_id) {
        const [typeRows] = await connection.query('SELECT id FROM reminder_types WHERE id=? AND is_active=1', [normalized.type_id]);
        if (!typeRows[0]) throw new Error('事项类型不存在或已停用');
      }
      const targetIds = await this.validateTargets(connection, normalized.target_mode, normalized.target_user_ids);
      const [result] = await connection.query(`INSERT INTO reminders (type_id,title,content,priority,target_mode,target_user_ids,repeat_rule,start_at,remind_before_days,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`, [normalized.type_id, normalized.title, normalized.content, normalized.priority, normalized.target_mode, JSON.stringify(targetIds), JSON.stringify(normalized.repeat_rule), normalized.start_at, normalized.remind_before_days, userId]);
      await this.materialize(connection, result.insertId);
      await connection.commit();
      return this.getById(result.insertId);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async update(id, userId, payload) {
    await this.ensure();
    const db = getDatabase(); const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query("SELECT * FROM reminders WHERE id=? AND status!='archived' FOR UPDATE", [id]);
      const existing = rows[0]; if (!existing) throw new Error('待办不存在');
      const existingRule = parseJson(existing.repeat_rule, {}); const existingTargets = normalizeIds(parseJson(existing.target_user_ids, []));
      const normalized = this.normalizePayload(payload, { ...existing, repeat_rule: existingRule, target_user_ids: existingTargets });
      if (normalized.type_id) {
        const [typeRows] = await connection.query('SELECT id FROM reminder_types WHERE id=? AND is_active=1', [normalized.type_id]);
        if (!typeRows[0]) throw new Error('事项类型不存在或已停用');
      }
      const targetMode = payload.target_mode || existing.target_mode;
      const targetIds = (payload.target_mode === undefined && payload.target_user_ids === undefined) ? existingTargets : await this.validateTargets(connection, targetMode, normalized.target_user_ids);
      await connection.query(`UPDATE reminders SET type_id=?,title=?,content=?,priority=?,target_mode=?,target_user_ids=?,repeat_rule=?,start_at=?,remind_before_days=?,updated_at=NOW() WHERE id=?`, [normalized.type_id, normalized.title, normalized.content, normalized.priority, targetMode, JSON.stringify(targetIds), JSON.stringify(normalized.repeat_rule), normalized.start_at, normalized.remind_before_days, id]);
      await connection.query('DELETE FROM reminder_records WHERE reminder_id=? AND scheduled_at>=NOW()', [id]);
      await this.materialize(connection, id);
      await connection.commit();
      return this.getById(id);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async archive(id) { await this.ensure(); await getDatabase().query("UPDATE reminders SET status='archived', updated_at=NOW() WHERE id=? AND status!='archived'", [id]); }

  async getTypes() { await this.ensure(); const [rows] = await getDatabase().query('SELECT * FROM reminder_types ORDER BY sort_order,id'); return rows; }
  async createType(payload) { await this.ensure(); const name=String(payload.name||'').trim(); if(!name)throw new Error('请输入类型名称'); const color=/^#[0-9a-f]{6}$/i.test(String(payload.color||''))?String(payload.color):'#409EFF'; const [result]=await getDatabase().query('INSERT INTO reminder_types (name,default_remind_days,color,sort_order) VALUES (?,?,?,?)',[name,Math.max(0,asInt(payload.default_remind_days,7)),color,asInt(payload.sort_order)]); const [rows]=await getDatabase().query('SELECT * FROM reminder_types WHERE id=?',[result.insertId]); return rows[0]; }
  async updateType(id,payload) { await this.ensure(); const name=String(payload.name||'').trim(); if(!name)throw new Error('请输入类型名称'); const color=/^#[0-9a-f]{6}$/i.test(String(payload.color||''))?String(payload.color):'#409EFF'; await getDatabase().query('UPDATE reminder_types SET name=?,default_remind_days=?,color=?,sort_order=? WHERE id=?',[name,Math.max(0,asInt(payload.default_remind_days,7)),color,asInt(payload.sort_order),id]); const [rows]=await getDatabase().query('SELECT * FROM reminder_types WHERE id=?',[id]); if(!rows[0])throw new Error('事项类型不存在'); return rows[0]; }
  async toggleType(id,active) { await this.ensure(); await getDatabase().query('UPDATE reminder_types SET is_active=? WHERE id=?',[active?1:0,id]); }
  async deleteType(id) {
    await this.ensure();
    const db = getDatabase();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [typeRows] = await connection.query('SELECT id,name FROM reminder_types WHERE id=? FOR UPDATE', [id]);
      if (!typeRows[0]) throw new Error('事项类型不存在');
      const [usageRows] = await connection.query('SELECT COUNT(*) total FROM reminders WHERE type_id=?', [id]);
      if (Number(usageRows[0]?.total || 0) > 0) throw new Error('该事项类型已被待办使用，请停用而不是删除');
      await connection.query('DELETE FROM reminder_types WHERE id=?', [id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async getUsers() { await this.ensure(); const [rows]=await getDatabase().query("SELECT id,username,name,phone,email,status FROM users WHERE status IN (1,'1','active') ORDER BY name,username"); return rows; }

  serialize(row) {
    const rule=parseJson(row.repeat_rule,{}); const ids=normalizeIds(parseJson(row.target_user_ids,[]));
    return { ...row, ...rule, repeat_type:rule.type||'once', interval_value:rule.interval||1, weekdays_json:JSON.stringify(rule.weekdays||[]), year_month:rule.year_month, month_day:rule.month_day, end_type:rule.end_type||'never', end_at:rule.end_at, occurrence_limit:rule.count, target_count:ids.length };
  }

  async list({page=1,limit=20,keyword='',status='',typeId='',userId=null,canManage=false}={}) {
    await this.ensure(); const db=getDatabase(); const pageInt=Math.max(1,asInt(page,1)); const limitInt=Math.min(100,Math.max(1,asInt(limit,20))); const conditions=["r.status!='archived'"]; const params=[];
    if(!canManage){conditions.push('EXISTS (SELECT 1 FROM reminder_records own_rr WHERE own_rr.reminder_id=r.id AND own_rr.user_id=? AND own_rr.remind_at<=NOW())');params.push(asInt(userId))} if(keyword){conditions.push('(r.title LIKE ? OR r.content LIKE ?)');params.push(`%${keyword}%`,`%${keyword}%`)} if(status){conditions.push('r.status=?');params.push(status)} if(typeId){conditions.push('r.type_id=?');params.push(asInt(typeId))}
    const where=conditions.join(' AND '); const recordJoin=canManage?'LEFT JOIN reminder_records rr ON rr.reminder_id=r.id':'LEFT JOIN reminder_records rr ON rr.reminder_id=r.id AND rr.user_id=?'; const rowParams=canManage?params:[asInt(userId),...params]; const [count]=await db.query(`SELECT COUNT(*) total FROM reminders r WHERE ${where}`,params); const [rows]=await db.query(`SELECT r.*,rt.name type_name,rt.color type_color,creator.name creator_name,COUNT(CASE WHEN rr.status='completed' THEN 1 END) completed_count,COUNT(CASE WHEN rr.status='ignored' THEN 1 END) ignored_count,MIN(CASE WHEN rr.scheduled_at>=NOW() THEN rr.scheduled_at END) next_occurrence_at FROM reminders r LEFT JOIN reminder_types rt ON rt.id=r.type_id LEFT JOIN users creator ON creator.id=r.created_by ${recordJoin} WHERE ${where} GROUP BY r.id ORDER BY r.status='active' DESC,r.created_at DESC LIMIT ${limitInt} OFFSET ${(pageInt-1)*limitInt}`,rowParams);
    return {rows:rows.map(row=>{const serialized=this.serialize(row);return canManage?serialized:{...serialized,target_mode:'specific',target_count:1}}),pagination:{page:pageInt,limit:limitInt,total:Number(count[0]?.total||0),totalPages:Math.ceil(Number(count[0]?.total||0)/limitInt)}};
  }

  async getById(id, { userId = null, canManage = true } = {}) {
    await this.ensure();
    const db = getDatabase();
    const accessCondition = canManage ? '' : 'AND EXISTS (SELECT 1 FROM reminder_records own_rr WHERE own_rr.reminder_id=r.id AND own_rr.user_id=? AND own_rr.remind_at<=NOW())';
    const accessParams = canManage ? [id] : [id, asInt(userId)];
    const [rows] = await db.query(`SELECT r.*,rt.name type_name,rt.color type_color,creator.name creator_name FROM reminders r LEFT JOIN reminder_types rt ON rt.id=r.type_id LEFT JOIN users creator ON creator.id=r.created_by WHERE r.id=? AND r.status!='archived' ${accessCondition}`, accessParams);
    if (!rows[0]) return null;
    const row = this.serialize(rows[0]);
    const ids = canManage ? normalizeIds(parseJson(rows[0].target_user_ids, [])) : [asInt(userId)];
    let targets = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [targetRows] = await db.query(`SELECT id,username,name,phone,email FROM users WHERE id IN (${placeholders}) ORDER BY name,username`, ids);
      targets = targetRows;
    }
    const recordCondition = canManage ? '' : 'AND rr.user_id=?';
    const recordParams = canManage ? [id] : [id, asInt(userId)];
    const [records] = await db.query(`SELECT rr.id occurrence_id,rr.scheduled_at,rr.remind_at,rr.user_id,rr.status recipient_status,rr.action_at,rr.snoozed_until,u.name user_name,u.username FROM reminder_records rr LEFT JOIN users u ON u.id=rr.user_id WHERE rr.reminder_id=? ${recordCondition} AND rr.remind_at<=NOW() ORDER BY rr.scheduled_at DESC,rr.user_id LIMIT 500`, recordParams);
    return {...row,target_mode:canManage?row.target_mode:'specific',target_count:canManage?row.target_count:1,record_scope:canManage?'all':'self',targets,occurrences:records.map(item=>({...item,completed_at:item.recipient_status==='completed'?item.action_at:null,ignored_at:item.recipient_status==='ignored'?item.action_at:null,read_at:item.recipient_status==='read'?item.action_at:null}))};
  }

  async pending(userId) {
    await this.ensure(); const db=getDatabase(); await this.refreshPendingOccurrences(db); const [rows]=await db.query(`SELECT rr.id occurrence_id,rr.scheduled_at,rr.remind_at,r.id reminder_id,r.title,r.content,r.priority,r.repeat_rule,rt.name type_name,rt.color type_color,rr.status recipient_status,rr.action_at,rr.snoozed_until FROM reminder_records rr JOIN reminders r ON r.id=rr.reminder_id LEFT JOIN reminder_types rt ON rt.id=r.type_id WHERE rr.user_id=? AND r.status='active' AND rr.remind_at<=NOW() AND rr.status!='completed' ORDER BY r.priority='urgent' DESC,r.priority='high' DESC,rr.remind_at LIMIT 100`,[userId]); return rows.map(row=>({...row,...parseJson(row.repeat_rule,{})}));
  }

  async updateRecipient(userId,recordId,action,snoozedUntil) { await this.ensure(); const db=getDatabase(); const [rows]=await db.query('SELECT id,status FROM reminder_records WHERE id=? AND user_id=?',[recordId,userId]); if(!rows[0])throw new Error('该待办未分配给当前员工');if(rows[0].status==='completed'){if(action==='complete')return;throw new Error('该周期已完成，不能再修改状态')} if(action==='snooze'){const until=asDate(snoozedUntil)||addDays(new Date(),1);await db.query("UPDATE reminder_records SET status='snoozed',snoozed_until=?,action_at=NOW(),updated_at=NOW() WHERE id=? AND user_id=?",[sqlDate(until),recordId,userId]);return} const map={read:'read',ignore:'ignored',complete:'completed'};if(!map[action])throw new Error('状态操作无效');await db.query('UPDATE reminder_records SET status=?,action_at=NOW(),snoozed_until=NULL,updated_at=NOW() WHERE id=? AND user_id=?',[map[action],recordId,userId]); }
}

module.exports = new ReminderService();
