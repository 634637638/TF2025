<template>
  <el-dialog
    v-model="visible"
    title="待办提醒"
    width="520px"
    class="reminder-host-dialog"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <div
      v-if="currentItem"
      class="reminder-alert"
      :class="[
        `priority-${currentItem.priority}`,
        { 'reminder-alert--completion': currentItem.kind === 'completion' }
      ]"
    >
      <template v-if="currentItem.kind === 'completion'">
        <div class="reminder-alert__heading">
          <span class="reminder-alert__type reminder-alert__type--completion">
            <i class="fas fa-circle-check" />完成反馈
          </span>
          <span class="reminder-alert__sequence">{{ queueIndex + 1 }} / {{ queue.length }}</span>
        </div>
        <h3 v-if="canViewReminderField('title')">
          {{ currentItem.title }}
        </h3>
        <p
          v-if="canViewReminderField('recipient_user')"
          class="reminder-alert__content"
        >
          {{ currentItem.user_name || currentItem.username || '员工' }} 已完成此待办。
        </p>
        <div class="reminder-alert__meta">
          <span v-if="canViewReminderField('action_at')">
            <i class="fas fa-clock" />完成：{{ formatDateTime(currentItem.action_at) }}
          </span>
          <span v-if="canViewReminderField('scheduled_at')">
            <i class="fas fa-calendar-check" />执行：{{ formatDateTime(currentItem.scheduled_at) }}
          </span>
        </div>
      </template>

      <template v-else-if="canUsePendingReminder">
        <div class="reminder-alert__heading">
          <span
            v-if="canViewReminderField('type_name')"
            class="reminder-alert__type"
            :style="typeStyle(currentItem)"
          ><i class="fas fa-bell" />{{ currentItem.type_name || '待办事项' }}</span>
          <span class="reminder-alert__sequence">{{ queueIndex + 1 }} / {{ queue.length }}</span>
        </div>
        <h3 v-if="canViewReminderField('title')">
          {{ currentItem.title }}
        </h3>
        <p
          v-if="canViewReminderField('content') && currentItem.content"
          class="reminder-alert__content"
        >
          {{ currentItem.content }}
        </p>
        <div class="reminder-alert__meta">
          <span v-if="canViewReminderField('scheduled_at')"><i class="fas fa-calendar-check" />执行：{{ formatDateTime(currentItem.scheduled_at) }}</span>
          <span v-if="canViewReminderField('remind_at')"><i class="fas fa-calendar-days" />提醒：{{ formatDateTime(currentItem.remind_at) }}</span>
        </div>
        <p
          v-if="isFinalReminderDay"
          class="reminder-alert__deadline"
        >
          <i class="fas fa-hourglass-half" />已进入执行前最后一天，请尽快完成
        </p>
        <div
          v-if="snoozeCustomVisible"
          class="reminder-snooze-custom"
        >
          <el-date-picker
            v-model="customSnoozeUntil"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            :min-date="snoozeMinDate"
            :max-date="snoozeMaxDate"
            :disabled-date="disableSnoozeDate"
            placeholder="选择再次提醒时间"
          />
          <el-button
            type="primary"
            size="small"
            :disabled="!customSnoozeUntil || processingOccurrence !== null"
            @click="confirmCustomSnooze"
          >
            确定
          </el-button>
        </div>
      </template>
    </div>
    <template #footer>
      <div
        v-if="currentItem?.kind === 'completion'"
        class="tf-dialog-actions reminder-alert__actions"
      >
        <el-button
          type="primary"
          :disabled="processingOccurrence !== null"
          @click="handleAcknowledgeCompletion"
        >
          <i class="fas fa-check" />知道了
        </el-button>
      </div>
      <div
        v-else-if="currentItem && canViewReminderField('recipient_status')"
        class="tf-dialog-actions reminder-alert__actions"
      >
        <el-dropdown
          v-if="canChooseSnooze"
          trigger="click"
          :disabled="processingOccurrence !== null"
          @command="handleSnooze"
        >
          <el-button :disabled="processingOccurrence !== null">
            <i class="fas fa-clock" />稍后提醒<i class="fas fa-chevron-down reminder-alert__dropdown-icon" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="option in snoozeOptions"
                :key="option.command"
                :command="option.command"
              >
                {{ option.label }}
              </el-dropdown-item>
              <el-dropdown-item command="custom">
                其他时间
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          v-else
          disabled
          title="已进入执行前最后一天，不能再延后"
        >
          <i class="fas fa-clock" />稍后提醒
        </el-button>
        <el-button
          type="primary"
          :disabled="processingOccurrence !== null"
          @click="handleComplete"
        >
          <i class="fas fa-check" />已完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewReminderField } from '@/views/reminders/reminder-field-permissions'

interface ReminderAlert {
  kind: 'reminder'
  occurrence_id: number
  reminder_id: number
  title: string
  content?: string
  priority: string
  type_name?: string
  type_color?: string
  scheduled_at: string
  remind_at: string
}

interface CompletionAlert {
  kind: 'completion'
  occurrence_id: number
  reminder_id: number
  title: string
  content?: string
  priority: string
  scheduled_at: string
  remind_at: string
  action_at?: string
  user_name?: string
  username?: string
}

type ReminderQueueItem = ReminderAlert | CompletionAlert
type SnoozeCommand = '1h' | '4h' | '1d' | 'custom'

const REFRESH_GAP_MS = 5000
const SNOOZE_RESERVE_MS = 24 * 60 * 60 * 1000
const SNOOZE_MIN_LEAD_MS = 60 * 1000
const authStore = useAuthStore()
const appStore = useAppStore()
const { isAuthenticated } = storeToRefs(authStore)
const { notificationsEnabled } = storeToRefs(appStore)
const queue = ref<ReminderQueueItem[]>([])
const visible = ref(false)
const processingOccurrence = ref<number | null>(null)
const snoozeCustomVisible = ref(false)
const customSnoozeUntil = ref('')
const seen = new Set<number>()
let timer: ReturnType<typeof setInterval> | null = null
let lastLoadedAt = 0
let loadPendingPromise: Promise<void> | null = null

const currentItem = computed(() => queue.value[0])
const queueIndex = computed(() => 0)
const canManageReminders = computed(() => authStore.hasAnyPermission([
  'reminders:manage',
  'reminders_reminderview:manage'
]))
const canUsePendingReminder = computed(() => (
  canViewReminderField('recipient_status') &&
  ['title', 'content', 'type_name', 'scheduled_at', 'remind_at']
    .some(field => canViewReminderField(field as Parameters<typeof canViewReminderField>[0]))
))
const canUseCompletionNotice = computed(() => (
  canManageReminders.value &&
  canViewReminderField('title') &&
  canViewReminderField('recipient_user')
))

const pad = (value: number) => String(value).padStart(2, '0')
const parseDate = (value: unknown) => {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getTime())
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}
const formatDate = (value: unknown) => {
  const date = parseDate(value)
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '-'
}
const formatDateTime = (value: unknown) => {
  const date = parseDate(value)
  return date ? `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}` : '-'
}
const toLocalDateTime = (date: Date) => (
  `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
)
const typeStyle = (row: ReminderAlert) => {
  const color = canViewReminderField('type_color') ? (row.type_color || '#2563eb') : '#2563eb'
  return { color, backgroundColor: `${color}14`, borderColor: `${color}55` }
}

const snoozePresets: Array<{ command: Exclude<SnoozeCommand, 'custom'>; label: string; milliseconds: number }> = [
  { command: '1h', label: '1小时后', milliseconds: 60 * 60 * 1000 },
  { command: '4h', label: '4小时后', milliseconds: 4 * 60 * 60 * 1000 },
  { command: '1d', label: '1天后', milliseconds: 24 * 60 * 60 * 1000 }
]
const snoozeMaxDate = computed(() => {
  if (currentItem.value?.kind !== 'reminder') return undefined
  const scheduledAt = parseDate(currentItem.value.scheduled_at)
  if (!scheduledAt) return undefined
  return new Date(scheduledAt.getTime() - SNOOZE_RESERVE_MS)
})
const isFinalReminderDay = computed(() => {
  if (currentItem.value?.kind !== 'reminder') return false
  const scheduledAt = parseDate(currentItem.value.scheduled_at)
  return Boolean(scheduledAt && scheduledAt.getTime() <= Date.now() + SNOOZE_RESERVE_MS)
})
const canChooseSnooze = computed(() => {
  const deadline = snoozeMaxDate.value
  return Boolean(deadline && deadline.getTime() > Date.now() + SNOOZE_MIN_LEAD_MS)
})
const snoozeOptions = computed(() => {
  if (!canChooseSnooze.value || !snoozeMaxDate.value) return []
  const now = Date.now()
  return snoozePresets.filter(option => now + option.milliseconds <= snoozeMaxDate.value!.getTime())
})
const snoozeMinDate = computed(() => new Date(Date.now() + SNOOZE_MIN_LEAD_MS))
const disableSnoozeDate = (date: Date) => {
  const maxDate = snoozeMaxDate.value
  if (!maxDate) return true
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const minDay = new Date().setHours(0, 0, 0, 0)
  const maxDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime()
  return day < minDay || day > maxDay
}

const appendQueue = (items: ReminderQueueItem[]) => {
  const next = items.filter(item => (
    !seen.has(item.occurrence_id) &&
    !queue.value.some(existing => existing.occurrence_id === item.occurrence_id)
  ))
  if (!next.length) return
  queue.value = [...queue.value, ...next]
  if (!visible.value) visible.value = true
}

const loadPending = (force = false): Promise<void> => {
  if (
    !isAuthenticated.value ||
    !notificationsEnabled.value ||
    (!canUsePendingReminder.value && !canUseCompletionNotice.value)
  ) return Promise.resolve()
  if (!force && Date.now() - lastLoadedAt < REFRESH_GAP_MS) return Promise.resolve()
  if (loadPendingPromise) return loadPendingPromise

  lastLoadedAt = Date.now()
  loadPendingPromise = (async () => {
    const [pendingResponse, completionResponse] = await Promise.all([
      canUsePendingReminder.value ? api.get('/reminders/my/pending') : Promise.resolve(null),
      canUseCompletionNotice.value ? api.get('/reminders/completed/pending') : Promise.resolve(null)
    ])

    if (pendingResponse?.success) {
      const reminders = (Array.isArray(pendingResponse.data) ? pendingResponse.data : [])
        .map((item: Omit<ReminderAlert, 'kind'>): ReminderAlert => ({ ...item, kind: 'reminder' }))
      appendQueue(reminders)
    }
    if (completionResponse?.success) {
      const completions = (Array.isArray(completionResponse.data) ? completionResponse.data : [])
        .map((item: Omit<CompletionAlert, 'kind'>): CompletionAlert => ({ ...item, kind: 'completion' }))
      appendQueue(completions)
    }
  })()
    .catch(error => {
      logger.debug('加载待办提醒失败', error)
    })
    .finally(() => {
      loadPendingPromise = null
    })

  return loadPendingPromise
}

const removeCurrent = (markSeen: boolean) => {
  const item = currentItem.value
  if (!item) return
  if (markSeen) seen.add(item.occurrence_id)
  else seen.delete(item.occurrence_id)
  queue.value.shift()
  snoozeCustomVisible.value = false
  customSnoozeUntil.value = ''
  visible.value = queue.value.length > 0
}

const finishCurrent = async (action: 'complete' | 'snooze', body: Record<string, unknown> = {}) => {
  const item = currentItem.value
  if (!item || item.kind !== 'reminder' || processingOccurrence.value !== null) return

  processingOccurrence.value = item.occurrence_id
  try {
    await api.post(`/reminders/occurrences/${item.occurrence_id}/${action}`, body)
    // 完成后只结束当前 occurrence；稍后提醒到点后仍需再次进入队列。
    removeCurrent(action === 'complete')
  } catch (error) {
    ElMessage.error('更新待办状态失败')
    logger.error('更新待办状态失败', error)
  } finally {
    processingOccurrence.value = null
  }
}

const handleAcknowledgeCompletion = async () => {
  const item = currentItem.value
  if (!item || item.kind !== 'completion' || processingOccurrence.value !== null) return

  processingOccurrence.value = item.occurrence_id
  try {
    await api.post(`/reminders/completed/${item.occurrence_id}/acknowledge`)
    removeCurrent(true)
  } catch (error) {
    ElMessage.error('确认完成提醒失败')
    logger.error('确认完成提醒失败', error)
  } finally {
    processingOccurrence.value = null
  }
}

const handleComplete = () => { void finishCurrent('complete') }
const handleSnooze = (command: string | number) => {
  if (String(command) === 'custom') {
    const deadline = snoozeMaxDate.value
    if (!deadline || !canChooseSnooze.value) return
    const suggested = new Date(Math.min(Date.now() + 4 * 60 * 60 * 1000, deadline.getTime()))
    customSnoozeUntil.value = toLocalDateTime(suggested)
    snoozeCustomVisible.value = true
    return
  }

  const option = snoozePresets.find(item => item.command === String(command))
  if (!option || !snoozeMaxDate.value || Date.now() + option.milliseconds > snoozeMaxDate.value.getTime()) return
  void finishCurrent('snooze', {
    snoozed_until: toLocalDateTime(new Date(Date.now() + option.milliseconds))
  })
}
const confirmCustomSnooze = () => {
  const customDate = parseDate(customSnoozeUntil.value)
  const deadline = snoozeMaxDate.value
  if (!customDate || !deadline) return
  if (customDate.getTime() <= Date.now() + SNOOZE_MIN_LEAD_MS) {
    ElMessage.warning('再次提醒时间必须晚于当前时间')
    return
  }
  if (customDate.getTime() > deadline.getTime()) {
    ElMessage.warning('再次提醒时间必须至少早于执行时间1天')
    return
  }
  void finishCurrent('snooze', { snoozed_until: toLocalDateTime(customDate) })
}

watch(isAuthenticated, value => {
  if (value) {
    void loadPending(true)
    return
  }
  queue.value = []
  visible.value = false
  seen.clear()
  snoozeCustomVisible.value = false
})

watch(notificationsEnabled, enabled => {
  if (enabled) {
    void loadPending(true)
    return
  }
  queue.value = []
  visible.value = false
})

const handleWindowFocus = () => { void loadPending() }
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') void loadPending()
}

onMounted(async () => {
  await fieldPermissions.init()
  await loadPending(true)
  timer = setInterval(() => { void loadPending() }, 60000)
  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped lang="scss">
.reminder-alert {
  padding: 18px;
  border: 1px solid var(--tf-color-border-blue-muted);
  border-radius: 12px;
  background: var(--tf-color-slate-50);
}

.reminder-alert.priority-urgent {
  border-color: var(--tf-color-red-300);
  background: var(--tf-color-rose-50);
}

.reminder-alert.priority-high {
  border-color: var(--tf-color-orange-tailwind-200);
  background: var(--tf-color-orange-50);
}

.reminder-alert--completion {
  border-color: var(--tf-color-emerald-300);
  background: var(--tf-color-emerald-50);
}

.reminder-alert__heading,
.reminder-alert__actions {
  display: flex;
  align-items: center;
}

.reminder-alert__heading {
  justify-content: space-between;
}

.reminder-alert__type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.reminder-alert__type--completion {
  color: var(--tf-color-emerald-700);
  border-color: var(--tf-color-emerald-300);
  background: var(--tf-color-emerald-100);
}

.reminder-alert__sequence {
  color: var(--tf-color-slate-400);
  font-size: 12px;
}

.reminder-alert h3 {
  margin: 14px 0 8px;
  color: var(--tf-color-slate-800);
  font-size: 20px;
}

.reminder-alert__content {
  margin: 0;
  color: var(--tf-color-slate-600);
  line-height: 1.7;
  white-space: pre-wrap;
}

.reminder-alert__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
  color: var(--tf-color-slate-500);
  font-size: 13px;
}

.reminder-alert__meta span {
  display: flex;
  align-items: center;
  gap: 7px;
}

.reminder-alert__deadline {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 14px 0 0;
  padding: 9px 10px;
  border-left: 3px solid var(--tf-color-orange-500);
  background: var(--tf-color-orange-50);
  color: var(--tf-color-orange-700);
  font-size: 13px;
  line-height: 1.5;
}

.reminder-snooze-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--tf-color-neutral-200);
}

.reminder-snooze-custom :deep(.el-date-editor) {
  flex: 1 1 auto;
  min-width: 0;
}

.reminder-alert__actions {
  justify-content: flex-end;
  gap: 8px;
}

.reminder-alert__actions :deep(.el-button) {
  margin: 0;
}

.reminder-alert__dropdown-icon {
  margin-left: 6px;
  font-size: 11px;
}

.reminder-host-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid var(--tf-color-neutral-200);
}

.reminder-host-dialog :deep(.el-dialog__footer) {
  padding-top: 12px;
}

@media (max-width: 560px) {
  .reminder-host-dialog :deep(.el-dialog) {
    width: calc(100vw - 20px) !important;
    margin: 10px auto;
  }

  .reminder-snooze-custom {
    align-items: stretch;
    flex-direction: column;
  }

  .reminder-snooze-custom :deep(.el-date-editor),
  .reminder-snooze-custom .el-button {
    width: 100%;
  }

  .reminder-alert__actions {
    flex-wrap: wrap;
  }

  .reminder-alert__actions .el-button,
  .reminder-alert__actions .el-dropdown {
    flex: 1 1 30%;
    min-width: 0;
  }

  .reminder-alert__actions .el-dropdown .el-button {
    width: 100%;
  }
}
</style>
