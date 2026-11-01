import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { AttendanceRecord } from '@/api/attendance'

export interface AttendanceLeaveAllocation {
  assignments: Array<{ date: string, type: 'monthly_leave' | 'leave' }>
  monthlyLeaveDaysCount: number
  regularLeaveDaysCount: number
  availableDays: number
}

export interface AttendanceLeaveAllocationGroup {
  startDate: string
  endDate: string
  month: string
  type: 'monthly_leave' | 'leave'
  days: number
}

export type AttendanceDisplayRecord = AttendanceRecord & {
  source_records?: AttendanceRecord[]
  source_record_ids?: number[]
}

export const createAttendanceBatchId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  throw new Error('当前浏览器无法安全生成考勤批次编号')
}

export const formatAttendanceTableDateRange = (
  recordDate: string,
  recordType: AttendanceRecord['record_type'],
  days?: number | string
) => {
  const start = TimeUtil.parse(recordDate)
  if (!start?.isValid()) return recordDate

  const duration = recordType === 'monthly_leave' || recordType === 'leave'
    ? Math.max(1, Math.ceil(Number(days) || 1))
    : 1
  const startLabel = TimeUtil.format(start, TIME_FORMATS.DATE)
  if (duration <= 1) return startLabel

  const end = TimeUtil.add(start, duration - 1, 'day')
  if (start.year() === end.year() && start.month() === end.month()) {
    return `${startLabel}至${end.date()}号`
  }
  return `${startLabel}至${TimeUtil.format(end, TIME_FORMATS.DATE)}`
}

export const formatAttendanceLeaveReason = (
  reason: string | undefined,
  days: number | string | undefined
) => {
  const normalizedReason = reason?.trim() || ''
  const isGeneratedReason = !normalizedReason || [
    '自动转为请假',
    '自动转为无薪请假',
    '休假超出带薪额度',
    '无薪无提成'
  ].some(phrase => normalizedReason.includes(phrase))
  if (!isGeneratedReason) return normalizedReason

  const leaveDays = Number(days) || 0
  const formattedDays = Number.isInteger(leaveDays)
    ? String(leaveDays)
    : String(Number(leaveDays.toFixed(2)))
  return `请假 ${formattedDays} 天，无薪无提成！`
}

export interface AttendanceLeaveMonthBalance {
  month: string
  monthly_limit: number
  paid_used: number
  unpaid_used: number
  available: number
}

interface BuildAttendanceLeaveAllocationOptions {
  requestedDays: number
  range: [string, string] | null
  monthlyLimit: number
  available?: number
  monthlyBalances?: AttendanceLeaveMonthBalance[]
}

export const buildAttendanceLeaveAllocation = ({
  requestedDays,
  range,
  monthlyLimit,
  available = 0,
  monthlyBalances = []
}: BuildAttendanceLeaveAllocationOptions): AttendanceLeaveAllocation => {
  const fallbackAvailable = Math.max(0, Number(available) || 0)
  const result: AttendanceLeaveAllocation = {
    assignments: [],
    monthlyLeaveDaysCount: 0,
    regularLeaveDaysCount: 0,
    availableDays: fallbackAvailable
  }
  if (!range || range.length !== 2 || requestedDays <= 0) return result

  const startDate = TimeUtil.parse(range[0])
  if (!startDate?.isValid()) return result

  const balances = new Map(monthlyBalances.map(balance => [balance.month, balance]))
  let carryOverride: number | null = null
  let activeMonth = ''
  let remaining = 0
  let activeMonthHasUnpaidLeave = false
  let activeMonthLimit = 0

  for (let index = 0; index < requestedDays; index += 1) {
    const date = TimeUtil.add(startDate, index, 'day')
    const dateKey = TimeUtil.format(date, TIME_FORMATS.DATE)
    const month = dateKey.slice(0, 7)

    if (month !== activeMonth) {
      const balance = balances.get(month)
      const monthLimit = Math.max(0, Number(balance?.monthly_limit ?? monthlyLimit) || 0)
      const paidUsed = Number(balance?.paid_used || 0)
      const carryIn = activeMonthHasUnpaidLeave ? 0 : carryOverride
      remaining = carryOverride === null
        ? Number(balance?.available ?? fallbackAvailable)
        : Math.max(0, (carryIn || 0) + monthLimit - paidUsed)
      if (activeMonth === '') result.availableDays = remaining
      activeMonth = month
      activeMonthLimit = monthLimit
      activeMonthHasUnpaidLeave = Number(balance?.unpaid_used || 0) > 0
    }

    const type = remaining > 0 ? 'monthly_leave' : 'leave'
    result.assignments.push({ date: dateKey, type })
    if (type === 'monthly_leave') {
      result.monthlyLeaveDaysCount += 1
      remaining -= 1
    } else {
      result.regularLeaveDaysCount += 1
      activeMonthHasUnpaidLeave = true
    }

    carryOverride = activeMonthHasUnpaidLeave
      ? 0
      : Math.min(activeMonthLimit, Math.max(0, remaining))
  }

  return result
}

export const groupAttendanceLeaveAssignments = (
  assignments: AttendanceLeaveAllocation['assignments']
): AttendanceLeaveAllocationGroup[] => assignments.reduce<AttendanceLeaveAllocationGroup[]>((groups, assignment) => {
  const month = assignment.date.slice(0, 7)
  const current = groups[groups.length - 1]
  if (current && current.type === assignment.type && current.month === month) {
    current.endDate = assignment.date
    current.days += 1
  } else {
    groups.push({
      startDate: assignment.date,
      endDate: assignment.date,
      month,
      type: assignment.type,
      days: 1
    })
  }
  return groups
}, [])

const getRecordDays = (record: AttendanceRecord) => {
  if (record.record_type === 'monthly_leave') return Math.max(1, Number(record.monthly_leave_days) || 1)
  if (record.record_type === 'leave') return Math.max(1, Number(record.leave_days) || 1)
  return 1
}

const getRecordEndDate = (record: AttendanceRecord) => {
  const start = TimeUtil.parse(record.record_date)
  return start?.isValid() ? TimeUtil.add(start, getRecordDays(record) - 1, 'day') : null
}

const isLegacySubmissionContinuation = (
  previous: AttendanceRecord,
  next: AttendanceRecord,
  previousEnd: ReturnType<typeof getRecordEndDate>,
  nextStart: ReturnType<typeof TimeUtil.parse>
) => {
  if (previous.attendance_batch_id || next.attendance_batch_id) return false
  if (!previous.id || !next.id || next.id !== previous.id + 1) return false
  if (
    previous.employee_id !== next.employee_id ||
    previous.created_by !== next.created_by ||
    previous.record_type !== next.record_type ||
    previous.status !== next.status ||
    previous.leave_type !== next.leave_type ||
    previous.leave_reason !== next.leave_reason ||
    previous.approval_note !== next.approval_note ||
    previous.record_date.slice(0, 7) !== next.record_date.slice(0, 7) ||
    !previousEnd?.isValid() ||
    !nextStart?.isValid() ||
    !nextStart.isSame(TimeUtil.add(previousEnd, 1, 'day'), 'day')
  ) return false

  const previousCreatedAt = TimeUtil.parse(previous.created_at || '')
  const nextCreatedAt = TimeUtil.parse(next.created_at || '')
  if (!previousCreatedAt?.isValid() || !nextCreatedAt?.isValid()) return false

  const elapsedMs = nextCreatedAt.diff(previousCreatedAt, 'millisecond')
  return elapsedMs >= 0 && elapsedMs <= 3000
}

export const groupAttendanceRecordsForDisplay = (
  records: AttendanceRecord[]
): AttendanceDisplayRecord[] => {
  const sortedRecords = records.slice().sort((left, right) => (
    left.record_date.localeCompare(right.record_date) ||
    String(left.created_at || '').localeCompare(String(right.created_at || '')) ||
    Number(left.id || 0) - Number(right.id || 0)
  ))
  const result: AttendanceDisplayRecord[] = []

  for (const record of sortedRecords) {
    const shouldAggregate = (
      record.record_type === 'monthly_leave' || record.record_type === 'leave'
    )
    if (!shouldAggregate) {
      result.push({ ...record })
      continue
    }

    const start = TimeUtil.parse(record.record_date)
    const end = getRecordEndDate(record)
    const current = result[result.length - 1]
    const currentEnd = current ? getRecordEndDate(current) : null
    const previousRecord = current?.source_records?.[current.source_records.length - 1] || current
    const nextStart = TimeUtil.parse(record.record_date)
    const sameExplicitBatch = Boolean(
      current &&
      current.attendance_batch_id &&
      current.attendance_batch_id === record.attendance_batch_id &&
      current.employee_id === record.employee_id &&
      current.created_by === record.created_by &&
      current.record_type === record.record_type &&
      current.status === record.status &&
      current.leave_type === record.leave_type &&
      current.leave_reason === record.leave_reason &&
      current.approval_note === record.approval_note &&
      current.record_date.slice(0, 7) === record.record_date.slice(0, 7) &&
      start?.isValid() &&
      end?.isValid() &&
      currentEnd?.isValid() &&
      start.isSame(TimeUtil.add(currentEnd, 1, 'day'), 'day')
    )
    const sameLegacyBatch = Boolean(
      current &&
      previousRecord &&
      current.record_type === record.record_type &&
      current.status === record.status &&
      current.leave_type === record.leave_type &&
      current.leave_reason === record.leave_reason &&
      current.approval_note === record.approval_note &&
      current.record_date.slice(0, 7) === record.record_date.slice(0, 7) &&
      currentEnd?.isValid() &&
      start?.isValid() &&
      start.isSame(TimeUtil.add(currentEnd, 1, 'day'), 'day') &&
      isLegacySubmissionContinuation(previousRecord, record, getRecordEndDate(previousRecord), nextStart)
    )
    const sameGroup = sameExplicitBatch || sameLegacyBatch

    if (!sameGroup) {
      result.push({
        ...record,
        source_records: [record],
        source_record_ids: record.id ? [record.id] : []
      })
      continue
    }

    const sourceRecords = current.source_records || [current]
    const sourceRecordIds = current.source_record_ids || []
    const totalDays = getRecordDays(current) + getRecordDays(record)
    current.source_records = [...sourceRecords, record]
    current.source_record_ids = record.id ? [...sourceRecordIds, record.id] : sourceRecordIds
    if (current.record_type === 'monthly_leave') {
      current.monthly_leave_days = totalDays
    } else {
      current.leave_days = totalDays
    }
  }

  return result.sort((left, right) => right.record_date.localeCompare(left.record_date))
}
