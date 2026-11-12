'use strict'

const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const auditUnpaginatedPersonnelSearch = require('../middleware/unpaginated-personnel-search')
const ReminderController = require('../controllers/reminder.controller')

const router = express.Router()
const reminderController = new ReminderController()

router.use(unifiedAuth)

router.get('/my/active', reminderController.requireVisibleField('execution_info.recipient_status'), reminderController.active.bind(reminderController))
router.get('/my/pending', reminderController.requireVisibleField('execution_info.recipient_status'), reminderController.pending.bind(reminderController))
router.get('/completed/pending', requirePermission('reminders:manage'), reminderController.pendingCompletions.bind(reminderController))
router.post('/completed/:occurrenceId/acknowledge', requirePermission('reminders:manage'), reminderController.acknowledgeCompletion.bind(reminderController))
router.post('/occurrences/:occurrenceId/:action', reminderController.requireVisibleField('execution_info.recipient_status'), reminderController.updateRecipient.bind(reminderController))
router.get('/types', requireAnyPermission(['reminders:view', 'reminders:create', 'reminders:manage']), reminderController.getTypes.bind(reminderController))
router.post('/types', requirePermission('reminders:manage'), reminderController.rejectHiddenWrites(ReminderController.TYPE_WRITE_IDS), reminderController.createType.bind(reminderController))
router.put('/types/:id', requirePermission('reminders:manage'), reminderController.rejectHiddenWrites(ReminderController.TYPE_WRITE_IDS), reminderController.updateType.bind(reminderController))
router.patch('/types/:id/toggle', requirePermission('reminders:manage'), reminderController.rejectHiddenWrites(ReminderController.TYPE_WRITE_IDS), reminderController.toggleType.bind(reminderController))
router.delete('/types/:id', requirePermission('reminders:manage'), reminderController.deleteType.bind(reminderController))
router.get('/users', requireAnyPermission(['reminders:create', 'reminders:manage']), reminderController.requireVisibleField('target_info.target_users'), auditUnpaginatedPersonnelSearch('reminders-users'), reminderController.getUsers.bind(reminderController))
router.get('/', requireAnyPermission(['reminders:view', 'reminders:manage']), reminderController.list.bind(reminderController))
router.get('/:id', requireAnyPermission(['reminders:view', 'reminders:manage']), reminderController.getById.bind(reminderController))
router.post('/', requirePermission('reminders:create'), reminderController.rejectHiddenWrites(ReminderController.FIELD_WRITE_IDS), reminderController.create.bind(reminderController))
router.put('/:id', requirePermission('reminders:edit'), reminderController.rejectHiddenWrites(ReminderController.FIELD_WRITE_IDS), reminderController.update.bind(reminderController))
router.delete('/:id', requirePermission('reminders:delete'), reminderController.archive.bind(reminderController))

module.exports = router
