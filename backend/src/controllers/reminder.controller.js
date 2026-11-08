'use strict'

const ApiResponse = require('../utils/response')
const reminderService = require('../services/reminder.service')
const dataMaskingService = require('../services/data-masking.service')
const FieldAccessService = require('../services/field-access.service')
const createFieldAccessMiddleware = require('../middleware/field-access')
const log = require('../utils/log')

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
  'execution_info.action_at': ['action_at', 'completed_at'], 'status_info.status': ['status'],
  'operator_info.creator_name': ['created_by', 'creator_name'], 'time_info.created_at': ['created_at'],
  'time_info.updated_at': ['updated_at']
}

class ReminderController {
  constructor({ service = reminderService, masking = dataMaskingService, logger = log } = {}) {
    this.service = service
    this.fieldAccess = new FieldAccessService({
      masking, moduleKey: REMINDER_FIELD_MODULE_KEY, responseKeys: REMINDER_RESPONSE_KEYS,
      transform(masked, permissions) {
        if ((permissions.hiddenFields || []).includes('type_info.type_name') && Object.prototype.hasOwnProperty.call(masked, 'default_remind_days')) {
          masked.name = null
        }
      }
    })
    this.fieldMiddleware = createFieldAccessMiddleware(this.fieldAccess)
    this.logger = logger
  }

  getFieldPermissions(req) {
    return this.fieldAccess.getPermissions(req.user.id)
  }

  maskPayloadWithPermissions(value, permissions) {
    return this.fieldAccess.maskPayload(value, permissions)
  }

  async maskPayload(value, req) {
    return this.maskPayloadWithPermissions(value, await this.getFieldPermissions(req))
  }

  rejectHiddenWrites(fieldMap) {
    return this.fieldMiddleware.rejectHiddenWrites(fieldMap)
  }

  requireVisibleField(fieldId) {
    return this.fieldMiddleware.requireVisibleField(fieldId)
  }

  handleError(res, error, fallback = '操作失败') {
    const message = error?.message || fallback
    if (/无权/.test(message)) return ApiResponse.error(res, message, 403)
    const status = /不存在|无效|请输入|请选择|必须|不能超过|至少选择|包含无效|已被.*使用|请停用|已完成/.test(message) ? 400 : 500
    return ApiResponse.error(res, message, status)
  }

  canManage(req) {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
    return permissions.includes('reminders:manage') || permissions.includes('reminders_reminderview:manage')
  }

  async pending(req, res) {
    try { return ApiResponse.success(res, await this.maskPayload(await this.service.pending(req.user.id), req), '获取待办提醒成功') }
    catch (error) { this.logger.error('获取待办提醒失败:', error); return this.handleError(res, error, '获取待办提醒失败') }
  }

  async pendingCompletions(req, res) {
    try { return ApiResponse.success(res, await this.maskPayload(await this.service.pendingCompletions(req.user.id), req), '获取完成提醒成功') }
    catch (error) { this.logger.error('获取完成提醒失败:', error); return this.handleError(res, error, '获取完成提醒失败') }
  }

  async acknowledgeCompletion(req, res) {
    try {
      await this.service.acknowledgeCompletion(req.user.id, Number(req.params.occurrenceId))
      return ApiResponse.success(res, null, '完成提醒已确认')
    } catch (error) { this.logger.error('确认完成提醒失败:', error); return this.handleError(res, error, '确认完成提醒失败') }
  }

  async updateRecipient(req, res) {
    try {
      await this.service.updateRecipient(req.user.id, Number(req.params.occurrenceId), req.params.action, req.body?.snoozed_until)
      return ApiResponse.success(res, null, '待办状态更新成功')
    } catch (error) { this.logger.error('更新待办状态失败:', error); return this.handleError(res, error, '更新待办状态失败') }
  }

  async getTypes(req, res) {
    try { return ApiResponse.success(res, await this.maskPayload(await this.service.getTypes(), req), '获取事项类型成功') }
    catch (error) { return this.handleError(res, error, '获取事项类型失败') }
  }

  async createType(req, res) {
    try { return ApiResponse.created(res, '事项类型创建成功', await this.maskPayload(await this.service.createType(req.body), req)) }
    catch (error) { return this.handleError(res, error, '事项类型创建失败') }
  }

  async updateType(req, res) {
    try { return ApiResponse.success(res, '事项类型更新成功', await this.maskPayload(await this.service.updateType(Number(req.params.id), req.body), req)) }
    catch (error) { return this.handleError(res, error, '事项类型更新失败') }
  }

  async toggleType(req, res) {
    try {
      await this.service.toggleType(Number(req.params.id), Boolean(req.body?.is_active))
      return ApiResponse.success(res, null, '事项类型状态已更新')
    } catch (error) { return this.handleError(res, error, '事项类型状态更新失败') }
  }

  async deleteType(req, res) {
    try { await this.service.deleteType(Number(req.params.id)); return ApiResponse.success(res, null, '事项类型已删除') }
    catch (error) { return this.handleError(res, error, '事项类型删除失败') }
  }

  async getUsers(req, res) {
    try {
      const result = await this.service.getUsers(req.query)
      return ApiResponse.success(res, result.users, '获取提醒人员成功', 200, result.pagination ? { pagination: result.pagination } : {})
    } catch (error) { return this.handleError(res, error, '获取提醒人员失败') }
  }

  async list(req, res) {
    try {
      const permissions = await this.getFieldPermissions(req)
      const hiddenFields = new Set(permissions.hiddenFields || [])
      const guardedFilters = { status: 'status_info.status', type_id: 'type_info.type_name' }
      const denied = Object.entries(guardedFilters).find(([queryField, fieldId]) => req.query[queryField] !== undefined && hiddenFields.has(fieldId))
      if (denied) return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
      const search_fields = [['basic_info.title', 'title'], ['basic_info.content', 'content']].filter(([fieldId]) => !hiddenFields.has(fieldId)).map(([, field]) => field)
      if (req.query.keyword && !search_fields.length) return res.status(403).json({ success: false, message: '没有可用的待办搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      const result = await this.service.list({
        page: req.query.page,
        page_size: req.query.page_size,
        keyword: req.query.keyword,
        search_fields,
        status: req.query.status,
        type_id: req.query.type_id,
        user_id: req.user.id,
        can_manage: this.canManage(req)
      })
      return ApiResponse.success(res, this.maskPayloadWithPermissions(result.rows, permissions), '获取待办列表成功', 200, {
        pagination: result.pagination,
        summary: result.summary
      })
    } catch (error) { this.logger.error('获取待办列表失败:', error); return this.handleError(res, error, '获取待办列表失败') }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getById(Number(req.params.id), { user_id: req.user.id, can_manage: this.canManage(req) })
      if (!result) return ApiResponse.error(res, '待办不存在', 404)
      return ApiResponse.success(res, await this.maskPayload(result, req), '获取待办详情成功')
    } catch (error) { return this.handleError(res, error, '获取待办详情失败') }
  }

  async create(req, res) {
    try { return ApiResponse.created(res, '待办创建成功', await this.maskPayload(await this.service.create(req.user.id, req.body), req)) }
    catch (error) { this.logger.error('创建待办失败:', error); return this.handleError(res, error, '待办创建失败') }
  }

  async update(req, res) {
    try {
      const result = await this.service.update(Number(req.params.id), req.user.id, req.body, this.canManage(req))
      return ApiResponse.success(res, '待办更新成功', await this.maskPayload(result, req))
    } catch (error) { this.logger.error('更新待办失败:', error); return this.handleError(res, error, '待办更新失败') }
  }

  async archive(req, res) {
    try {
      await this.service.archive(Number(req.params.id), req.user.id, this.canManage(req))
      return ApiResponse.success(res, null, '待办已删除')
    } catch (error) { return this.handleError(res, error, '待办删除失败') }
  }
}

ReminderController.FIELD_WRITE_IDS = REMINDER_WRITE_FIELD_IDS
ReminderController.TYPE_WRITE_IDS = REMINDER_TYPE_WRITE_FIELD_IDS

module.exports = ReminderController
