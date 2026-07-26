const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const reminderService = require('../services/reminder.service');
const log = require('../utils/log');

router.use(unifiedAuth);

function handleError(res, error, fallback = '操作失败') {
  const message = error?.message || fallback;
  const status = /不存在|无效|请输入|请选择|必须|不能超过|至少选择|包含无效|已被.*使用|请停用|已完成/.test(message) ? 400 : 500;
  return ApiResponse.error(res, message, status);
}

const canManageReminders = req => Array.isArray(req.user?.permissions) && req.user.permissions.includes('reminders_reminderview:manage');

router.get('/my/pending', async (req, res) => {
  try { return ApiResponse.success(res, await reminderService.pending(req.user.id), '获取待办提醒成功'); }
  catch (error) { log.error('获取待办提醒失败:', error); return handleError(res, error, '获取待办提醒失败'); }
});

router.post('/occurrences/:occurrenceId/:action', async (req, res) => {
  try {
    await reminderService.updateRecipient(req.user.id, Number(req.params.occurrenceId), req.params.action, req.body?.snoozed_until);
    return ApiResponse.success(res, null, '待办状态更新成功');
  } catch (error) { log.error('更新待办状态失败:', error); return handleError(res, error, '更新待办状态失败'); }
});

router.get('/types', requireAnyPermission(['reminders:view', 'reminders:create', 'reminders:manage']), async (req, res) => {
  try { return ApiResponse.success(res, await reminderService.getTypes(), '获取事项类型成功'); }
  catch (error) { return handleError(res, error, '获取事项类型失败'); }
});

router.post('/types', requirePermission('reminders:manage'), async (req, res) => {
  try { return ApiResponse.created(res, '事项类型创建成功', await reminderService.createType(req.body)); }
  catch (error) { return handleError(res, error, '事项类型创建失败'); }
});

router.put('/types/:id', requirePermission('reminders:manage'), async (req, res) => {
  try { return ApiResponse.success(res, '事项类型更新成功', await reminderService.updateType(Number(req.params.id), req.body)); }
  catch (error) { return handleError(res, error, '事项类型更新失败'); }
});

router.patch('/types/:id/toggle', requirePermission('reminders:manage'), async (req, res) => {
  try { await reminderService.toggleType(Number(req.params.id), Boolean(req.body?.is_active)); return ApiResponse.success(res, null, '事项类型状态已更新'); }
  catch (error) { return handleError(res, error, '事项类型状态更新失败'); }
});

router.delete('/types/:id', requirePermission('reminders:manage'), async (req, res) => {
  try { await reminderService.deleteType(Number(req.params.id)); return ApiResponse.success(res, null, '事项类型已删除'); }
  catch (error) { return handleError(res, error, '事项类型删除失败'); }
});

router.get('/users', requireAnyPermission(['reminders:create', 'reminders:manage']), async (req, res) => {
  try { return ApiResponse.success(res, await reminderService.getUsers(), '获取提醒人员成功'); }
  catch (error) { return handleError(res, error, '获取提醒人员失败'); }
});

router.get('/', requireAnyPermission(['reminders:view', 'reminders:manage']), async (req, res) => {
  try {
    const result = await reminderService.list({ page: req.query.page, limit: req.query.limit, keyword: req.query.keyword, status: req.query.status, typeId: req.query.type_id, userId: req.user.id, canManage: canManageReminders(req) });
    return ApiResponse.success(res, result.rows, '获取待办列表成功', 200, { pagination: result.pagination });
  } catch (error) { log.error('获取待办列表失败:', error); return handleError(res, error, '获取待办列表失败'); }
});

router.get('/:id', requireAnyPermission(['reminders:view', 'reminders:manage']), async (req, res) => {
  try {
    const result = await reminderService.getById(Number(req.params.id), { userId: req.user.id, canManage: canManageReminders(req) });
    if (!result) return ApiResponse.error(res, '待办不存在', 404);
    return ApiResponse.success(res, result, '获取待办详情成功');
  } catch (error) { return handleError(res, error, '获取待办详情失败'); }
});

router.post('/', requirePermission('reminders:create'), async (req, res) => {
  try { return ApiResponse.created(res, '待办创建成功', await reminderService.create(req.user.id, req.body)); }
  catch (error) { log.error('创建待办失败:', error); return handleError(res, error, '待办创建失败'); }
});

router.put('/:id', requirePermission('reminders:edit'), async (req, res) => {
  try { return ApiResponse.success(res, '待办更新成功', await reminderService.update(Number(req.params.id), req.user.id, req.body)); }
  catch (error) { log.error('更新待办失败:', error); return handleError(res, error, '待办更新失败'); }
});

router.delete('/:id', requirePermission('reminders:delete'), async (req, res) => {
  try { await reminderService.archive(Number(req.params.id)); return ApiResponse.success(res, null, '待办已删除'); }
  catch (error) { return handleError(res, error, '待办删除失败'); }
});

module.exports = router;
