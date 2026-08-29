import { fieldPermissions } from '@/composables/useFieldPermissions'

export const REMINDER_FIELD_MODULE_KEY = 'reminders_reminderview'

export const REMINDER_FIELD_IDS = {
  stats_total: 'stats.total', stats_active_count: 'stats.active_count', stats_completed_count: 'stats.completed_count', stats_ignored_count: 'stats.ignored_count',
  sequence: 'basic_info.sequence', title: 'basic_info.title', content: 'basic_info.content', priority: 'basic_info.priority',
  type_name: 'type_info.type_name', type_default_remind_days: 'type_info.default_remind_days', type_color: 'type_info.type_color', type_icon: 'type_info.type_icon', type_sort_order: 'type_info.sort_order', type_is_active: 'type_info.is_active', type_operations: 'type_info.operations',
  target_mode: 'target_info.target_mode', target_users: 'target_info.target_users', target_count: 'target_info.target_count',
  repeat_type: 'repeat_info.repeat_type', interval_value: 'repeat_info.interval_value', weekdays: 'repeat_info.weekdays', end_type: 'repeat_info.end_type', end_at: 'repeat_info.end_at', occurrence_limit: 'repeat_info.occurrence_limit',
  start_at: 'schedule_info.start_at', next_occurrence_at: 'schedule_info.next_occurrence_at', remind_before_days: 'schedule_info.remind_before_days', remind_at: 'schedule_info.remind_at',
  completed_count: 'execution_info.completed_count', ignored_count: 'execution_info.ignored_count', scheduled_at: 'execution_info.scheduled_at', recipient_user: 'execution_info.recipient_user', recipient_status: 'execution_info.recipient_status', action_at: 'execution_info.action_at',
  status: 'status_info.status', creator_name: 'operator_info.creator_name', created_at: 'time_info.created_at', updated_at: 'time_info.updated_at', operations: 'system_info.operations'
} as const

export type ReminderFieldName = keyof typeof REMINDER_FIELD_IDS

export const canViewReminderField = (field: ReminderFieldName) => fieldPermissions.isFieldVisible(
  REMINDER_FIELD_MODULE_KEY,
  REMINDER_FIELD_IDS[field]
)

export const pickVisibleReminderFields = <T extends object>(
  source: T,
  fieldMap: Partial<Record<keyof T, ReminderFieldName>>
) => Object.fromEntries(
  Object.entries(source as Record<string, unknown>).filter(([key]) => {
    const field = fieldMap[key as keyof T]
    return field ? canViewReminderField(field) : false
  })
) as Partial<T>
