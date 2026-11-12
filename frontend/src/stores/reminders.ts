import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { unifiedApi } from '@/utils/unified-api'
import { TimeUtil } from '@/utils/time'
import type { ReminderAlert } from '@/types/reminder'
import policy from '../../../backend/src/config/reminder-policy.json'

export const REMINDER_MANDATORY_MS = policy.mandatory_hours * 60 * 60 * 1000

export const useRemindersStore = defineStore('reminders', () => {
  const active = ref<ReminderAlert[]>([])
  const now = ref(TimeUtil.now().valueOf())
  let revision = 0
  const mandatory = computed(() => active.value.filter(item => {
    const scheduled = TimeUtil.parse(item.scheduled_at)
    return item.is_mandatory === true || item.is_mandatory === 1 ||
      (scheduled && scheduled.isValid() && scheduled.valueOf() <= now.value + REMINDER_MANDATORY_MS)
  }))
  const tick = () => { now.value = TimeUtil.now().valueOf() }
  const refresh = async () => {
    const requestRevision = revision
    const response = await unifiedApi.get<Omit<ReminderAlert, 'kind'>[]>('/reminders/my/active', {
      showLoading: false, useCache: false
    })
    if (requestRevision !== revision || !response.success) return
    active.value = (response.data || []).map(item => ({ ...item, kind: 'reminder' }))
    tick()
  }
  const complete = (id: number) => {
    revision += 1
    active.value = active.value.filter(item => item.occurrence_id !== id)
  }
  const snooze = (id: number) => {
    revision += 1
    active.value = active.value.map(item => item.occurrence_id === id ? { ...item, recipient_status: 'snoozed' } : item)
  }
  const reset = () => { revision += 1; active.value = [] }
  return { active, mandatory, now, tick, refresh, complete, snooze, reset }
})
