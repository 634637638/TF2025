export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ReminderTargetMode = 'specific' | 'all'
export type ReminderRepeatType = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ReminderMissingDayPolicy = 'last-day' | 'skip'
export type ReminderEndType = 'never' | 'date' | 'count'
export type ReminderStatus = 'active' | 'archived'
export type ReminderRecipientStatus = 'pending' | 'read' | 'snoozed' | 'ignored' | 'completed'

export interface ReminderType {
  id: number
  code?: string | null
  name?: string | null
  default_remind_days?: number | null
  color?: string | null
  icon?: string | null
  sort_order?: number | null
  is_active?: number | boolean | null
}

export interface ReminderUser {
  id: number
  username: string
  name?: string | null
  phone?: string | null
  email?: string | null
  status?: number | string | null
}

export interface ReminderOccurrence {
  occurrence_id?: number
  scheduled_at?: string | null
  remind_at?: string | null
  user_id?: number | null
  user_name?: string | null
  username?: string | null
  recipient_status?: ReminderRecipientStatus | null
  action_at?: string | null
  snoozed_until?: string | null
  completed_at?: string | null
  ignored_at?: string | null
  read_at?: string | null
}

export interface ReminderRow {
  id: number
  title?: string | null
  content?: string | null
  type_id?: number | null
  type_name?: string | null
  type_color?: string | null
  priority?: ReminderPriority | null
  target_mode?: ReminderTargetMode | null
  repeat_type?: ReminderRepeatType | null
  interval_value?: number | null
  weekdays_json?: string | null
  year_month?: number | null
  month_day?: number | null
  missing_day_policy?: ReminderMissingDayPolicy | null
  start_at?: string | null
  remind_before_days?: number | null
  end_type?: ReminderEndType | null
  end_at?: string | null
  occurrence_limit?: number | null
  target_count?: number | null
  completed_count?: number | null
  ignored_count?: number | null
  next_occurrence_at?: string | null
  status?: ReminderStatus | null
}

export interface ReminderDetail extends ReminderRow {
  targets?: ReminderUser[]
  occurrences?: ReminderOccurrence[]
}

export interface ReminderSummary {
  total: number
  active_count: number
  completed_count: number
  ignored_count: number
}

export interface ReminderFormState {
  type_id: string | number
  title: string
  content: string
  priority: ReminderPriority
  target_mode: ReminderTargetMode
  target_user_ids: number[]
  repeat_type: ReminderRepeatType
  interval_value: number
  weekdays: number[]
  year_month: number
  month_day: number
  missing_day_policy: ReminderMissingDayPolicy
  start_at: string
  remind_before_days: number
  end_type: ReminderEndType
  end_at: string
  occurrence_limit: number
}

export interface ReminderTypeFormState {
  id: number
  name: string
  default_remind_days: number
  color: string
  sort_order: number
}
