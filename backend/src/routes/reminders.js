const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const reminderService = require('../services/reminder.service')
const log = require('../utils/log')
const dataMaskingService = require('../services/dataMaskingService')

const REMINDER_FIELD_MODULE_KEY = 'reminders_reminderview'
const REMINDER_WRITE_FIELD_IDS = {
  type_id: 'type_info.type_name', title: 'basic_info.title', content: 'basic_info.content', priority: 'basic_info.priority',
  target_mode: 'target_info.target_mode', target_user_ids: 'target_info.target_users', repeat_type: 'repeat_info.repeat_type',
  interval_value: 'repeat_info.interval_value', weekdays: 'repeat_info.weekdays', year_month: 'repeat_info.repeat_type',
  month_day: 'repeat_info.repeat_type', missing_day_policy: 'repeat_info.repeat_type', start_at: 'schedule_info.start_at',
  remind_before_days: 'schedule_info.remind_before_days', end_type: 'repeat_info.end_type', end_at: 'repeat_info.end_at',
  occurrence_limit: 'repeat_info.occurrence_limit'
}
const REMINDER_TYPE_WRITE_FIELD_IDS = {
  name: 'type_info.type_name', default_remind_days: 'type_info.default_remind_days',
  color: 'type_info.type_color', sort_order: 'type_info.sort_order', is_active: 'type_info.is_active'
}
const REMINDER_RESPONSE_KEYS = {
  'basic_info.title': ['title'], 'basic_info.content': ['content'], 'basic_info.priority': ['priority'],
  'type_info.type_name': ['type_id', 'type_name'], 'type_info.default_remind_days': ['default_remind_days'],
  'type_info.type_color': ['type_color', 'color'], 'type_info.type_icon': ['icon'], 'type_info.sort_order': ['sort_order'],
  'type_info.is_active': ['is_active'], 'target_info.target_mode': ['target_mode'],
  'target_info.target_users': ['target_user_ids', 'targets'], 'target_info.target_count': ['target_count'],
  'repeat_info.repeat_type': ['repeat_type', 'year_month', 'month_day', 'missing_day_policy'],
  'repeat_info.interval_value': ['interval_value'], 'repeat_info.weekdays': ['weekdays', 'weekdays_json'],
  'repeat_info.end_type': ['end_type'], 'repeat_info.end_at': ['end_at'], 'repeat_info.occurrence_limit': ['occurrence_limit'],
  'schedule_info.start_at': ['start_at'], 'schedule_info.next_occurrence_at': ['next_occurrence_at'],
  'schedule_info.remind_before_days': ['remind_before_days'], 'schedule_info.remind_at': ['remind_at'],
  'execution_info.completed_count': ['completed_count', 'completed_at'],
  'execution_info.ignored_count': ['ignored_count', 'ignored_at'], 'execution_info.scheduled_at': ['scheduled_at'],
  'execution_info.recipient_user': ['user_id', 'user_name', 'username'],
  'execution_info.recipient_status': ['recipient_status', 'read_at', 'snoozed_until'],
  'execution_info.action_at': ['action_at'], 'status_info.status': ['status'],
  'operator_info.creator_name': ['created_by', 'creator_name'], 'time_info.created_at': ['created_at'],
  'time_info.updated_at': ['updated_at']
}

const getReminderFieldPermissions = req => dataMaskingService.getUserFieldPermissions(req.user.id, REMINDER_FIELD_MODULE_KEY)
const maskReminderPayloadWithPermissions = (value, permissions) => {
  if (Array.isArray(value)) return value.map(item => maskReminderPayloadWithPermissions(item, permissions))
  if (!value || typeof value !== 'object') return value
  const masked = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, maskReminderPayloadWithPermissions(child, permissions)]))
  for (const fieldId of permissions.hiddenFields || []) {
    for (const responseKey of REMINDER_RESPONSE_KEYS[fieldId] || []) {
      if (Object.prototype.hasOwnProperty.call(masked, responseKey)) masked[responseKey] = null
    }
  }
  if ((permissions.hiddenFields || []).includes('type_info.type_name') && Object.prototype.hasOwnProperty.call(masked, 'default_remind_days')) {
    masked.name = null
  }
  return dataMaskingService.filterSensitiveFields([masked], permissions)[0]
}
const maskReminderPayload = async (value, req) => maskReminderPayloadWithPermissions(value, await getReminderFieldPermissions(req))
const rejectHiddenReminderWrites = fieldMap => async (req, res, next) => {
  try {
    const permissions = await getReminderFieldPermissions(req)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const denied = Object.entries(fieldMap).find(([bodyField, fieldId]) => req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId))
    if (!denied) return next()
    return res.status(403).json({ success: false, message: '不能修改已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
  } catch (error) { return next(error) }
}
const requireVisibleReminderField = fieldId => async (req, res, next) => {
  try {
    const permissions = await getReminderFieldPermissions(req)
    if (!(permissions.hiddenFields || []).includes(fieldId)) return next()
    return res.status(403).json({ success: false, message: '无权访问已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: fieldId })
  } catch (error) { return next(error) }
}

router.use(unifiedAuth)

function handleError(res, error, fallback = '操作失败') {
  const message = error?.message || fallback
  if (/无权/.test(message)) return ApiResponse.error(res, message, 403)
  const status = /不存在|无效|请输入|请选择|必须|不能超过|至少选择|包含无效|已被.*使用|请停用|已完成/.test(message) ? 400 : 500
  return ApiResponse.error(res, message, status)
}

const canManageReminders = req => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
  return permissions.includes('reminders:manage') || permissions.includes('reminders_reminderview:manage')
}

router.get('/my/pending', requireVisibleReminderField('execution_info.recipient_status'), async (req, res) => {
  try { return ApiResponse.success(res, await maskReminderPayload(await reminderService.pending(req.user.id), req), '获取待办提醒成功') }
  catch (error) { log.error('获取待办提醒失败:', error); return handleError(res, error, '获取待办提醒失败') }
})

router.post('/occurrences/:occurrenceId/:action', requireVisibleReminderField('execution_info.recipient_status'), async (req, res) => {
  try {
    await reminderService.updateRecipient(req.user.id, Number(req.params.occurrenceId), req.params.action, req.body?.snoozed_until)
    return ApiResponse.success(res, null, '待办状态更新成功')
  } catch (error) { log.error('更新待办状态失败:', error); return handleError(res, error, '更新待办状态失败') }
})

router.get('/types', requireAnyPermission(['reminders:view', 'reminders:create', 'reminders:manage']), async (req, res) => {
  try { return ApiResponse.success(res, await maskReminderPayload(await reminderService.getTypes(), req), '获取事项类型成功') }
  catch (error) { return handleError(res, error, '获取事项类型失败') }
})

router.post('/types', requirePermission('reminders:manage'), rejectHiddenReminderWrites(REMINDER_TYPE_WRITE_FIELD_IDS), async (req, res) => {
  try { return ApiResponse.created(res, '事项类型创建成功', await maskReminderPayload(await reminderService.createType(req.body), req)) }
  catch (error) { return handleError(res, error, '事项类型创建失败') }
})

router.put('/types/:id', requirePermission('reminders:manage'), rejectHiddenReminderWrites(REMINDER_TYPE_WRITE_FIELD_IDS), async (req, res) => {
  try { return ApiResponse.success(res, '事项类型更新成功', await maskReminderPayload(await reminderService.updateType(Number(req.params.id), req.body), req)) }
  catch (error) { return handleError(res, error, '事项类型更新失败') }
})

router.patch('/types/:id/toggle', requirePermission('reminders:manage'), rejectHiddenReminderWrites(REMINDER_TYPE_WRITE_FIELD_IDS), async (req, res) => {
  try { await reminderService.toggleType(Number(req.params.id), Boolean(req.body?.is_active)); return ApiResponse.success(res, null, '事项类型状态已更新') }
  catch (error) { return handleError(res, error, '事项类型状态更新失败') }
})

router.delete('/types/:id', requirePermission('reminders:manage'), async (req, res) => {
  try { await reminderService.deleteType(Number(req.params.id)); return ApiResponse.success(res, null, '事项类型已删除') }
  catch (error) { return handleError(res, error, '事项类型删除失败') }
})

router.get('/users', requireAnyPermission(['reminders:create', 'reminders:manage']), requireVisibleReminderField('target_info.target_users'), async (req, res) => {
  try { return ApiResponse.success(res, await reminderService.getUsers(), '获取提醒人员成功') }
  catch (error) { return handleError(res, error, '获取提醒人员失败') }
})

router.get('/', requireAnyPermission(['reminders:view', 'reminders:manage']), async (req, res) => {
  try {
    const permissions = await getReminderFieldPermissions(req)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const guardedFilters = { status: 'status_info.status', type_id: 'type_info.type_name' }
    const denied = Object.entries(guardedFilters).find(([queryField, fieldId]) => req.query[queryField] !== undefined && hiddenFields.has(fieldId))
    if (denied) return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
    const search_fields = [['basic_info.title', 'title'], ['basic_info.content', 'content']].filter(([fieldId]) => !hiddenFields.has(fieldId)).map(([, field]) => field)
    if (req.query.keyword && !search_fields.length) return res.status(403).json({ success: false, message: '没有可用的待办搜索字段', code: 'FIELD_PERMISSION_DENIED' })
    const result = await reminderService.list({ page: req.query.page, page_size: req.query.page_size, keyword: req.query.keyword, search_fields, status: req.query.status, type_id: req.query.type_id, user_id: req.user.id, can_manage: canManageReminders(req) })
    return ApiResponse.success(res, maskReminderPayloadWithPermissions(result.rows, permissions), '获取待办列表成功', 200, { pagination: result.pagination })
  } catch (error) { log.error('获取待办列表失败:', error); return handleError(res, error, '获取待办列表失败') }
})

router.get('/:id', requireAnyPermission(['reminders:view', 'reminders:manage']), async (req, res) => {
  try {
    const result = await reminderService.getById(Number(req.params.id), { user_id: req.user.id, can_manage: canManageReminders(req) })
    if (!result) return ApiResponse.error(res, '待办不存在', 404)
    return ApiResponse.success(res, await maskReminderPayload(result, req), '获取待办详情成功')
  } catch (error) { return handleError(res, error, '获取待办详情失败') }
})

router.post('/', requirePermission('reminders:create'), rejectHiddenReminderWrites(REMINDER_WRITE_FIELD_IDS), async (req, res) => {
  try { return ApiResponse.created(res, '待办创建成功', await maskReminderPayload(await reminderService.create(req.user.id, req.body), req)) }
  catch (error) { log.error('创建待办失败:', error); return handleError(res, error, '待办创建失败') }
})

router.put('/:id', requirePermission('reminders:edit'), rejectHiddenReminderWrites(REMINDER_WRITE_FIELD_IDS), async (req, res) => {
  try { return ApiResponse.success(res, '待办更新成功', await maskReminderPayload(await reminderService.update(Number(req.params.id), req.user.id, req.body, canManageReminders(req)), req)) }
  catch (error) { log.error('更新待办失败:', error); return handleError(res, error, '待办更新失败') }
})

router.delete('/:id', requirePermission('reminders:delete'), async (req, res) => {
  try { await reminderService.archive(Number(req.params.id), req.user.id, canManageReminders(req)); return ApiResponse.success(res, null, '待办已删除') }
  catch (error) { return handleError(res, error, '待办删除失败') }
})

module.exports = router
