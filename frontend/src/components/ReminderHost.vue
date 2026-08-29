<template>
  <el-dialog
    v-model="visible"
    title="待办提醒"
    width="520px"
    class="reminder-host-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @closed="handleClosed"
  >
    <div
      v-if="currentReminder && canUsePendingReminder"
      class="reminder-alert"
      :class="`priority-${currentReminder.priority}`"
    >
      <div class="reminder-alert__heading">
        <span
          v-if="canViewReminderField('type_name')"
          class="reminder-alert__type"
          :style="typeStyle(currentReminder)"
        ><i class="fas fa-bell" />{{ currentReminder.type_name || '待办事项' }}</span>
        <span class="reminder-alert__sequence">{{ queueIndex + 1 }} / {{ queue.length }}</span>
      </div>
      <h3 v-if="canViewReminderField('title')">
        {{ currentReminder.title }}
      </h3>
      <p
        v-if="canViewReminderField('content') && currentReminder.content"
        class="reminder-alert__content"
      >
        {{ currentReminder.content }}
      </p>
      <div class="reminder-alert__meta">
        <span v-if="canViewReminderField('scheduled_at')"><i class="fas fa-calendar-check" />执行：{{ formatDate(currentReminder.scheduled_at) }}</span>
        <span v-if="canViewReminderField('remind_at')"><i class="fas fa-calendar-days" />提醒：{{ formatDate(currentReminder.remind_at) }}</span>
      </div>
    </div>
    <template #footer>
      <div
        v-if="canViewReminderField('recipient_status')"
        class="tf-dialog-actions reminder-alert__actions"
      >
        <el-button @click="handleIgnore">
          <i class="fas fa-eye-slash" />忽略本次
        </el-button>
        <el-button @click="handleSnooze">
          <i class="fas fa-clock" />稍后提醒
        </el-button>
        <el-button
          type="primary"
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
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewReminderField } from '@/views/reminders/reminder-field-permissions'

interface ReminderAlert { occurrence_id:number; reminder_id:number; title:string; content?:string; priority:string; type_name?:string; type_color?:string; scheduled_at:string; remind_at:string }
const authStore=useAuthStore(); const { isAuthenticated }=storeToRefs(authStore)
const queue=ref<ReminderAlert[]>([]); const visible=ref(false); const seen=new Set<number>(); let timer:ReturnType<typeof setInterval>|null=null
const currentReminder=computed(()=>queue.value[0]); const queueIndex=computed(()=>0)
const canUsePendingReminder=computed(()=>canViewReminderField('recipient_status')&&['title','content','type_name','scheduled_at','remind_at'].some(field=>canViewReminderField(field as Parameters<typeof canViewReminderField>[0])))
const pad=(value:number)=>String(value).padStart(2,'0'); const parseDate=(value:any)=>value?new Date(String(value).replace(' ','T')):null
const formatDate=(value:any)=>{const date=parseDate(value);return date&&!Number.isNaN(date.getTime())?`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`:'-'}
const typeStyle=(row:ReminderAlert)=>{const color=canViewReminderField('type_color')?(row.type_color||'#2563eb'):'#2563eb';return { color,backgroundColor:`${color}14`,borderColor:`${color}55` }}

const loadPending=async()=>{if(!isAuthenticated.value||!canUsePendingReminder.value)return;try{const response:any=await api.get('/reminders/my/pending');if(!response.success)return;const next=(Array.isArray(response.data)?response.data:[]).filter((item:ReminderAlert)=>!seen.has(item.occurrence_id));if(next.length){queue.value=[...queue.value,...next.filter(item=>!queue.value.some(existing=>existing.occurrence_id===item.occurrence_id))];if(!visible.value)visible.value=true}}catch(error){logger.debug('加载待办提醒失败',error)}}
const finishCurrent=async(action:string,body:any={})=>{const item=currentReminder.value;if(!item)return;try{await api.post(`/reminders/occurrences/${item.occurrence_id}/${action}`,body);seen.add(item.occurrence_id);queue.value.shift();if(!queue.value.length)visible.value=false;else visible.value=true}catch(error){ElMessage.error('更新待办状态失败');logger.error('更新待办状态失败',error)}}
const handleIgnore=()=>finishCurrent('ignore'); const handleComplete=()=>finishCurrent('complete'); const handleSnooze=()=>finishCurrent('snooze',{ snoozed_until:new Date(Date.now()+86400000).toISOString() })
const handleClosed=()=>{if(queue.value.length&&!currentReminder.value)return;visible.value=false}
watch(isAuthenticated,(value)=>{if(value)loadPending();else{queue.value=[];visible.value=false;seen.clear()}},{ immediate:true })
onMounted(async()=>{await fieldPermissions.init();await loadPending();timer=setInterval(loadPending,60000);window.addEventListener('focus',loadPending);document.addEventListener('visibilitychange',loadPending)})
onUnmounted(()=>{if(timer)clearInterval(timer);window.removeEventListener('focus',loadPending);document.removeEventListener('visibilitychange',loadPending)})
</script>

<style scoped lang="scss">
.reminder-alert{padding:18px;border:1px solid var(--tf-color-border-blue-muted);border-radius:12px;background:var(--tf-color-slate-50)}.reminder-alert.priority-urgent{border-color:var(--tf-color-red-300);background:var(--tf-color-rose-50)}.reminder-alert.priority-high{border-color:var(--tf-color-orange-tailwind-200);background:var(--tf-color-orange-50)}.reminder-alert__heading{display:flex;justify-content:space-between;align-items:center}.reminder-alert__type{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid;border-radius:999px;font-size:12px;font-weight:700}.reminder-alert__sequence{color:var(--tf-color-slate-400);font-size:12px}.reminder-alert h3{margin:14px 0 8px;color:var(--tf-color-slate-800);font-size:20px}.reminder-alert__content{margin:0;white-space:pre-wrap;line-height:1.7;color:var(--tf-color-slate-600)}.reminder-alert__meta{display:flex;flex-direction:column;gap:6px;margin-top:16px;color:var(--tf-color-slate-500);font-size:13px}.reminder-alert__meta span{display:flex;align-items:center;gap:7px}.reminder-alert__actions{display:flex;justify-content:flex-end;gap:8px}.reminder-alert__actions :deep(.el-button){margin:0}.reminder-host-dialog :deep(.el-dialog__header){border-bottom:1px solid var(--tf-color-neutral-200)}.reminder-host-dialog :deep(.el-dialog__footer){padding-top:12px}@media(max-width:560px){.reminder-host-dialog :deep(.el-dialog){width:calc(100vw - 20px)!important;margin:10px auto}.reminder-alert__actions{flex-wrap:wrap}.reminder-alert__actions .el-button{flex:1 1 30%;min-width:0}}
</style>
