<template>
  <div class="reminder-view admin-page">
    <PermissionGate
      :can-view="canView || canManage"
      mode="denied"
      module-key="reminders"
      module-name="待办提醒"
      permission-code="reminders:view"
    >
      <PageHeader icon="fas fa-bell" title="待办提醒">
        <template #actions>
          <el-button v-if="canManage" type="warning" plain @click="openTypeManager">
            <i class="fas fa-tags"></i><span>事项类型</span>
          </el-button>
          <el-button v-if="canCreate" type="primary" @click="openCreateDialog">
            <i class="fas fa-plus"></i><span>新建待办</span>
          </el-button>
          <el-button type="info" plain :disabled="loading" @click="loadReminders">
            <i class="fas fa-sync-alt"></i><span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="admin-page-content">
        <div class="stats-cards reminder-stats">
          <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-list-check"></i></div>
            <div class="stat-content"><div class="stat-value">{{ pagination.total }}</div><div class="stat-label">待办总数</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon active"><i class="fas fa-bell"></i></div>
            <div class="stat-content"><div class="stat-value">{{ activeCount }}</div><div class="stat-label">启用中</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon completed"><i class="fas fa-circle-check"></i></div>
            <div class="stat-content"><div class="stat-value">{{ completedCount }}</div><div class="stat-label">累计完成</div></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon ignored"><i class="fas fa-eye-slash"></i></div>
            <div class="stat-content"><div class="stat-value">{{ ignoredCount }}</div><div class="stat-label">累计忽略</div></div>
          </div>
        </div>

        <UnifiedSearchPanel v-model:expanded="searchExpanded" :loading="loading" @search="handleSearch" @reset="resetSearch">
          <template #primary>
            <el-input v-model="filters.keyword" clearable placeholder="搜索标题或内容" @keyup.enter="handleSearch">
              <template #prefix><i class="fas fa-search"></i></template>
            </el-input>
          </template>
          <div class="form-group filter-item">
            <el-select v-model="filters.type_id" clearable placeholder="事项类型">
              <el-option v-for="item in activeTypes" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div class="form-group filter-item">
            <el-select v-model="filters.status" clearable placeholder="状态">
              <el-option label="启用中" value="active" />
              <el-option label="已暂停" value="paused" />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <div class="table-section admin-panel admin-table-panel">
          <div class="section-title">
            <i class="fas fa-list"></i>
            待办列表
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="table-responsive">
            <el-table
              :data="loading ? [] : reminders"
              border
              stripe
              class="data-table devices-table reminder-table"
              table-layout="fixed"
              :fit="true"
              row-key="id"
            >
              <template #empty>
                <TableLoadingRow v-if="loading" mode="block" text="加载待办中..." />
                <el-empty v-else description="暂无待办事项" />
              </template>
              <el-table-column label="序号" width="64" align="center">
                <template #default="{ $index }"><span class="index-badge">{{ (pagination.page - 1) * pagination.limit + $index + 1 }}</span></template>
              </el-table-column>
              <el-table-column label="事项" min-width="210" class-name="complete-text-column">
                <template #default="{ row }">
                  <button class="reminder-title" type="button" @click="openDetail(row)">{{ row.title }}</button>
                </template>
              </el-table-column>
              <el-table-column label="类型" min-width="110" align="center">
                <template #default="{ row }"><span class="type-badge" :style="typeBadgeStyle(row)">{{ row.type_name || '未分类' }}</span></template>
              </el-table-column>
              <el-table-column label="重复规则" min-width="150" align="center" class-name="complete-text-column">
                <template #default="{ row }">{{ repeatLabel(row) }}</template>
              </el-table-column>
              <el-table-column label="下次执行" min-width="170" align="center">
                <template #default="{ row }">{{ formatDate(row.next_occurrence_at || row.start_at) }}</template>
              </el-table-column>
              <el-table-column label="提前提醒" min-width="100" align="center">
                <template #default="{ row }">{{ row.remind_before_days }} 天</template>
              </el-table-column>
              <el-table-column label="接收人" min-width="100" align="center">
                <template #default="{ row }">{{ row.target_mode === 'all' ? '全体员工' : `${row.target_count || 0} 人` }}</template>
              </el-table-column>
              <el-table-column label="执行情况" min-width="140" align="center">
                <template #default="{ row }"><span class="execution-summary">完成 {{ row.completed_count || 0 }} / 忽略 {{ row.ignored_count || 0 }}</span></template>
              </el-table-column>
              <el-table-column label="状态" min-width="86" align="center">
                <template #default="{ row }"><span :class="['status-badge', row.status === 'active' ? 'status-enabled' : 'status-disabled']">{{ row.status === 'active' ? '启用' : '暂停' }}</span></template>
              </el-table-column>
          <el-table-column label="操作" :width="reminderActionColumnWidth" align="center" class-name="actions-column">
                <template #default="{ row }">
                  <div class="action-buttons reminder-list-actions">
                    <el-button type="primary" size="small" title="查看" @click.stop="openDetail(row)"><i class="fas fa-eye"></i><span>查看</span></el-button>
                    <el-button v-if="canEdit" type="success" size="small" title="编辑" @click.stop="openEditDialog(row)"><i class="fas fa-edit"></i><span>编辑</span></el-button>
                    <el-button v-if="canDelete" type="danger" size="small" title="删除" @click.stop="deleteReminder(row)"><i class="fas fa-trash"></i><span>删除</span></el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <Pagination
            v-model:current="pagination.page"
            v-model:page-size="pagination.limit"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            :disabled="loading"
            @change="handlePageChange"
          />
        </div>
      </div>
    </PermissionGate>

    <el-dialog v-model="formVisible" :title="editingId ? '编辑待办' : '新建待办'" width="760px" class="reminder-form-dialog" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="96px">
        <div class="reminder-form-grid">
          <el-form-item label="事项类型" prop="type_id">
            <el-select v-model="form.type_id" placeholder="请选择类型" @change="handleTypeChange">
              <el-option v-for="item in activeTypes" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="form.priority">
              <el-option label="普通" value="normal" /><el-option label="低" value="low" /><el-option label="高" value="high" /><el-option label="紧急" value="urgent" />
            </el-select>
          </el-form-item>
          <el-form-item label="事项标题" prop="title" class="span-2"><el-input v-model="form.title" maxlength="200" show-word-limit placeholder="例如：清洗玻璃门" /></el-form-item>
          <el-form-item label="详细内容" class="span-2"><el-input v-model="form.content" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="可自由输入执行要求和注意事项" /></el-form-item>
          <el-form-item label="接收范围" prop="target_mode">
            <el-segmented v-model="form.target_mode" :options="targetModeOptions" />
          </el-form-item>
          <el-form-item v-if="form.target_mode === 'specific'" label="指定员工" prop="target_user_ids">
            <el-select v-model="form.target_user_ids" multiple filterable collapse-tags collapse-tags-tooltip placeholder="选择员工">
            <el-option v-for="user in activeUsers" :key="user.id" :label="user.name || user.username" :value="user.id"><span>{{ user.name || user.username }}</span><small class="user-option-meta">{{ user.phone || '' }}</small></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="重复方式" prop="repeat_type">
            <el-select v-model="form.repeat_type" @change="normalizeRepeatFields">
              <el-option label="不重复" value="once" /><el-option label="每天" value="daily" /><el-option label="每周" value="weekly" /><el-option label="每月" value="monthly" /><el-option label="每年" value="yearly" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="['once', 'monthly', 'yearly'].includes(form.repeat_type)" label="提醒时间" prop="start_at"><el-date-picker v-model="form.start_at" type="date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="选择日期" @change="syncRepeatRuleFromStart" /></el-form-item>
          <el-form-item v-if="form.repeat_type !== 'once'" label="间隔周期"><el-input-number v-model="form.interval_value" :min="1" :max="365" /><span class="input-suffix">{{ intervalUnit }}</span></el-form-item>
          <el-form-item label="提前提醒"><el-input-number v-model="form.remind_before_days" :min="0" :max="365" /><span class="input-suffix">天</span></el-form-item>
          <el-form-item v-if="form.repeat_type === 'weekly'" label="每周执行" prop="weekdays" class="span-2">
            <el-checkbox-group v-model="form.weekdays" class="weekday-options"><el-checkbox-button v-for="day in weekdayOptions" :key="day.value" :value="day.value">{{ day.label }}</el-checkbox-button></el-checkbox-group>
          </el-form-item>
          <el-form-item v-if="form.repeat_type !== 'once'" label="结束方式"><el-select v-model="form.end_type"><el-option label="永不结束" value="never" /><el-option label="指定日期" value="date" /><el-option label="执行次数" value="count" /></el-select></el-form-item>
          <el-form-item v-if="form.end_type === 'date' && form.repeat_type !== 'once'" label="结束日期"><el-date-picker v-model="form.end_at" type="date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" /></el-form-item>
          <el-form-item v-if="form.end_type === 'count' && form.repeat_type !== 'once'" label="执行次数"><el-input-number v-model="form.occurrence_limit" :min="1" :max="10000" /><span class="input-suffix">次</span></el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button @click="formVisible=false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveReminder">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="待办执行记录" width="900px" class="reminder-detail-dialog">
      <div v-if="detail" class="reminder-detail">
        <div class="detail-summary"><div><span>事项</span><strong>{{ detail.title }}</strong></div><div><span>类型</span><strong>{{ detail.type_name || '未分类' }}</strong></div><div><span>接收人</span><strong>{{ detail.target_mode === 'all' ? '全体员工' : detail.targets?.map((item:any) => item.name || item.username).join('、') }}</strong></div><div><span>规则</span><strong>{{ repeatLabel(detail) }}</strong></div></div>
        <p v-if="detail.content" class="detail-content">{{ detail.content }}</p>
        <div class="table-responsive detail-record-table">
          <el-table :data="detailOccurrences" border stripe class="data-table devices-table compact-fit-table" table-layout="fixed" :fit="true">
            <el-table-column prop="scheduled_at" label="执行日期" :min-width="detailScheduledAtColumnWidth" align="center" class-name="complete-text-column">
              <template #default="{ row }">{{ formatDate(row.scheduled_at) }}</template>
            </el-table-column>
            <el-table-column prop="user_name" label="员工" :min-width="detailUserColumnWidth" align="center" class-name="complete-text-column">
              <template #default="{ row }">{{ row.user_name || row.username || '-' }}</template>
            </el-table-column>
            <el-table-column label="状态" :min-width="detailStatusColumnWidth" align="center" class-name="complete-text-column">
              <template #default="{ row }"><span :class="['recipient-status', `is-${row.recipient_status}`]">{{ recipientStatusLabel(row.recipient_status) }}</span></template>
            </el-table-column>
            <el-table-column label="操作日期" :min-width="detailActionAtColumnWidth" align="center" class-name="complete-text-column">
              <template #default="{ row }">{{ recipientActionDate(row) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="typeManagerVisible" title="事项类型管理" width="720px" class="reminder-type-dialog">
      <div class="type-toolbar"><span>类型名称可随时修改；已使用类型建议停用而不是删除。</span><el-button type="primary" @click="openTypeForm()"><i class="fas fa-plus"></i>新增类型</el-button></div>
      <div class="table-responsive reminder-type-table-wrap">
        <el-table
          :data="types"
          border
          stripe
          class="data-table devices-table compact-fit-table reminder-type-table"
          table-layout="fixed"
          :fit="true"
          row-key="id"
        >
          <el-table-column label="类型" :min-width="typeNameColumnWidth" align="center" class-name="complete-text-column">
            <template #default="{ row }">
              <span class="type-badge" :style="typeBadgeStyle(row)"><i :class="row.icon"></i>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="默认提前" :min-width="typeRemindDaysColumnWidth" align="center" class-name="complete-text-column">
            <template #default="{ row }">{{ row.default_remind_days }} 天</template>
          </el-table-column>
          <el-table-column prop="sort_order" label="排序" :min-width="typeSortColumnWidth" align="center" class-name="complete-text-column" />
          <el-table-column label="状态" min-width="72" align="center">
            <template #default="{ row }"><el-switch :model-value="Boolean(row.is_active)" @change="toggleType(row, $event)" /></template>
          </el-table-column>
              <el-table-column label="操作" align="center" class-name="compact-action-column">
            <template #default="{ row }">
              <div class="action-buttons type-action-buttons">
                <el-button type="primary" size="small" title="编辑" @click.stop="openTypeForm(row)"><i class="fas fa-edit"></i></el-button>
                <el-button type="danger" size="small" title="删除" @click.stop="deleteType(row)"><i class="fas fa-trash"></i></el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <el-dialog v-model="typeFormVisible" :title="typeForm.id ? '编辑事项类型' : '新增事项类型'" width="460px" append-to-body class="reminder-type-form-dialog">
      <el-form :model="typeForm" label-width="100px">
        <el-form-item label="类型名称"><el-input v-model="typeForm.name" maxlength="100" /></el-form-item>
        <el-form-item label="默认提前"><el-input-number v-model="typeForm.default_remind_days" :min="0" :max="365" /><span class="input-suffix">天</span></el-form-item>
        <el-form-item label="识别颜色">
          <div class="type-color-control">
            <el-color-picker v-model="typeForm.color" popper-class="reminder-color-picker-popper" teleported append-to="body" @active-change="handleTypeColorPreview" />
            <span class="type-badge type-color-preview" :style="typeFormBadgeStyle">{{ typeForm.name || '类型预览' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="typeForm.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button @click="typeFormVisible=false">取消</el-button>
          <el-button type="primary" :loading="typeSaving" @click="saveType">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { PageHeader, PermissionGate } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { getActionColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'

interface ReminderType { id:number; code:string; name:string; default_remind_days:number; color:string; icon:string; sort_order:number; is_active:number|boolean }
interface ReminderUser { id:number; username:string; name?:string; phone?:string; email?:string; status?:number|string }
interface ReminderRow { id:number; title:string; content?:string; type_id?:number; type_name?:string; type_color?:string; priority:string; target_mode:string; repeat_type:string; interval_value:number; weekdays_json?:string; year_month?:number; month_day?:number; missing_day_policy?:string; start_at:string; remind_before_days:number; end_type:string; end_at?:string; occurrence_limit?:number; target_count?:number; completed_count?:number; ignored_count?:number; next_occurrence_at?:string; status:string }

const { canView, canCreate, canEdit, canDelete, canManage, hasPermission } = usePagePermissions('reminders')
const loading = ref(false), saving = ref(false), typeSaving = ref(false), searchExpanded = ref(false)
const reminders = ref<ReminderRow[]>([]), types = ref<ReminderType[]>([]), users = ref<ReminderUser[]>([])
const formVisible = ref(false), detailVisible = ref(false), typeManagerVisible = ref(false), typeFormVisible = ref(false)
const editingId = ref<number|null>(null), detail = ref<any>(null), formRef = ref<FormInstance>()
const filters = reactive({ keyword:'', type_id:'' as string|number, status:'' })
const pagination = reactive({ page:1, limit:20, total:0 })
const weekdayOptions = [{value:1,label:'周一'},{value:2,label:'周二'},{value:3,label:'周三'},{value:4,label:'周四'},{value:5,label:'周五'},{value:6,label:'周六'},{value:7,label:'周日'}]
const targetModeOptions = [{label:'指定员工',value:'specific'},{label:'全体员工',value:'all'}]
const defaultForm = () => ({ type_id:'' as string|number, title:'', content:'', priority:'normal', target_mode:'specific', target_user_ids:[] as number[], repeat_type:'once', interval_value:1, weekdays:[1] as number[], year_month:new Date().getMonth()+1, month_day:new Date().getDate(), missing_day_policy:'last-day', start_at:'', remind_before_days:7, end_type:'never', end_at:'', occurrence_limit:10 })
const form = reactive(defaultForm())
const typeForm = reactive({ id:0, name:'', default_remind_days:7, color:'#409EFF', sort_order:0 })
const formRules: FormRules = { title:[{required:true,message:'请输入事项标题',trigger:'blur'}], type_id:[{required:true,message:'请选择事项类型',trigger:'change'}], start_at:[{required:true,message:'请选择执行日期',trigger:'change'}], target_user_ids:[{validator:(_r,_v,callback)=> form.target_mode==='specific' && form.target_user_ids.length===0 ? callback(new Error('请选择接收员工')) : callback(),trigger:'change'}], weekdays:[{validator:(_r,_v,callback)=> form.repeat_type==='weekly' && form.weekdays.length===0 ? callback(new Error('请选择每周执行日期')) : callback(),trigger:'change'}] }

const activeTypes = computed(() => types.value.filter(item => Boolean(item.is_active)))
const activeUsers = computed(() => users.value.filter(user => user.status === undefined || user.status === 1 || user.status === '1' || user.status === 'active'))
const activeCount = computed(() => reminders.value.filter(item => item.status==='active').length)
const completedCount = computed(() => reminders.value.reduce((sum,item)=>sum+Number(item.completed_count||0),0))
const ignoredCount = computed(() => reminders.value.reduce((sum,item)=>sum+Number(item.ignored_count||0),0))
const intervalUnit = computed(() => ({daily:'天',weekly:'周',monthly:'月',yearly:'年'} as Record<string,string>)[form.repeat_type] || '')
const reminderActionColumnWidth = computed(() => {
  const buttonCount = 1 + (canEdit.value ? 1 : 0) + (canDelete.value ? 1 : 0)
  return getActionColumnMinWidth(buttonCount)
})
const typeNameColumnWidth = computed(() => getTextColumnMinWidth(
  ['类型', ...types.value.map(item => item.name)],
  { minWidth: 150, horizontalPadding: 58 }
))
const typeRemindDaysColumnWidth = computed(() => getTextColumnMinWidth(
  ['默认提前', ...types.value.map(item => `${item.default_remind_days} 天`)],
  { minWidth: 100, horizontalPadding: 28 }
))
const typeSortColumnWidth = computed(() => getTextColumnMinWidth(
  ['排序', ...types.value.map(item => item.sort_order)],
  { minWidth: 72, horizontalPadding: 28 }
))

const pad = (value:number) => String(value).padStart(2,'0')
const localDate = (date:Date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
const parseDate = (value:any) => {if(!value)return null;const raw=String(value).trim();return new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T00:00:00`:raw.replace(' ','T'))}
const formatDate = (value:any) => { const date=parseDate(value); return date && !Number.isNaN(date.getTime()) ? localDate(date) : '-' }

const repeatLabel = (row:any) => { if(row.repeat_type==='once') return '不重复'; if(row.repeat_type==='daily') return `每 ${row.interval_value||1} 天`; if(row.repeat_type==='monthly') return `每 ${row.interval_value||1} 月第 ${row.month_day} 日`; if(row.repeat_type==='yearly')return `${Number(row.interval_value||1)===1?'每年':`每 ${row.interval_value} 年`} ${row.year_month||1} 月 ${row.month_day||1} 日`; let days:number[]=[]; try{days=JSON.parse(row.weekdays_json||'[]')}catch{} return `每 ${row.interval_value||1} 周 ${days.map(day=>weekdayOptions.find(item=>item.value===day)?.label).filter(Boolean).join('、')}` }
const typeBadgeStyle = (row:any) => ({ color:row.type_color||row.color||'#409EFF', borderColor:`${row.type_color||row.color||'#409EFF'}66`, backgroundColor:`${row.type_color||row.color||'#409EFF'}14` })
const typeFormBadgeStyle = computed(() => typeBadgeStyle({ color:typeForm.color }))
const recipientStatusLabel = (status:string) => ({pending:'待处理',read:'已读',snoozed:'稍后提醒',ignored:'已忽略',completed:'已完成'} as Record<string,string>)[status]||status||'-'
const recipientActionDate = (row:any) => formatDate(row.action_at)
const detailOccurrences = computed<any[]>(() => Array.isArray(detail.value?.occurrences) ? detail.value.occurrences : [])
const detailScheduledAtColumnWidth = computed(() => getTextColumnMinWidth(
  ['执行日期', ...detailOccurrences.value.map(item => formatDate(item.scheduled_at))],
  { minWidth: 92, horizontalPadding: 16 }
))
const detailUserColumnWidth = computed(() => getTextColumnMinWidth(
  ['员工', ...detailOccurrences.value.map(item => item.user_name || item.username || '-')],
  { minWidth: 70, horizontalPadding: 18 }
))
const detailStatusColumnWidth = computed(() => getTextColumnMinWidth(
  ['状态', ...detailOccurrences.value.map(item => recipientStatusLabel(item.recipient_status))],
  { minWidth: 68, horizontalPadding: 22 }
))
const detailActionAtColumnWidth = computed(() => getTextColumnMinWidth(
  ['操作日期', ...detailOccurrences.value.map(item => recipientActionDate(item))],
  { minWidth: 92, horizontalPadding: 16 }
))

const loadTypes = async () => { const response:any=await api.get('/reminders/types'); if(response.success) types.value=Array.isArray(response.data)?response.data:[] }
const loadUsers = async () => { if(!canCreate.value && !canManage.value) return; const response:any=await api.get('/reminders/users'); if(response.success) users.value=Array.isArray(response.data)?response.data:[] }
const loadReminders = async () => { loading.value=true; try{ const response:any=await api.get('/reminders',{params:{page:pagination.page,limit:pagination.limit,keyword:filters.keyword||undefined,type_id:filters.type_id||undefined,status:filters.status||undefined}}); if(response.success){reminders.value=Array.isArray(response.data)?response.data:[];pagination.total=Number(response.pagination?.total||0)} }catch(error){logger.error('加载待办失败',error);ElMessage.error('加载待办失败')}finally{loading.value=false} }
const handleSearch=()=>{pagination.page=1;loadReminders()}; const resetSearch=()=>{filters.keyword='';filters.type_id='';filters.status='';handleSearch()}; const handlePageChange=(page:number,size:number)=>{pagination.page=page;pagination.limit=size;loadReminders()}
const resetForm=()=>Object.assign(form,defaultForm())
const openCreateDialog=()=>{editingId.value=null;resetForm();form.start_at=localDate(new Date());formVisible.value=true}
const openEditDialog=async(row:ReminderRow)=>{const response:any=await api.get(`/reminders/${row.id}`);if(!response.success)return;const data=response.data;editingId.value=row.id;Object.assign(form,{type_id:data.type_id||'',title:data.title||'',content:data.content||'',priority:data.priority||'normal',target_mode:data.target_mode||'specific',target_user_ids:(data.targets||[]).map((item:any)=>item.id),repeat_type:data.repeat_type||'once',interval_value:Number(data.interval_value||1),weekdays:(()=>{try{return JSON.parse(data.weekdays_json||'[]')}catch{return[1]}})(),year_month:Number(data.year_month||1),month_day:Number(data.month_day||1),missing_day_policy:data.missing_day_policy||'last-day',start_at:formatDate(data.start_at),remind_before_days:Number(data.remind_before_days||0),end_type:data.end_type||'never',end_at:data.end_at?formatDate(data.end_at):'',occurrence_limit:Number(data.occurrence_limit||10)});formVisible.value=true}
const handleTypeChange=(id:any)=>{if(editingId.value)return;const type=types.value.find(item=>item.id===id);if(type)form.remind_before_days=Number(type.default_remind_days||0)}
const syncRepeatRuleFromStart=()=>{if(!['monthly','yearly'].includes(form.repeat_type))return;const start=parseDate(form.start_at);if(!start)return;form.month_day=start.getDate();form.missing_day_policy='last-day';if(form.repeat_type==='yearly')form.year_month=start.getMonth()+1}
const normalizeRepeatFields=()=>{if(form.repeat_type==='once')form.end_type='never';if(['daily','weekly'].includes(form.repeat_type))form.start_at=localDate(new Date());if(form.repeat_type==='weekly'&&!form.weekdays.length)form.weekdays=[1];syncRepeatRuleFromStart()}
const saveReminder=async()=>{if(!formRef.value)return;syncRepeatRuleFromStart();await formRef.value.validate();saving.value=true;try{const payload={...form,target_user_ids:form.target_mode==='all'?[]:form.target_user_ids,end_at:form.end_type==='date'?form.end_at:null,occurrence_limit:form.end_type==='count'?form.occurrence_limit:null};const response:any=editingId.value?await api.put(`/reminders/${editingId.value}`,payload):await api.post('/reminders',payload);if(response.success){ElMessage.success(editingId.value?'待办已更新':'待办已创建');formVisible.value=false;pagination.page=1;await loadReminders()}}catch(error:any){logger.error('保存待办失败',error);ElMessage.error(error?.response?.data?.message||'保存待办失败')}finally{saving.value=false}}
const deleteReminder=async(row:ReminderRow)=>{try{await ElMessageBox.confirm(`确定删除待办“${row.title}”吗？历史执行记录将保留。`,'删除确认',{type:'warning'});const response:any=await api.delete(`/reminders/${row.id}`);if(response.success){ElMessage.success('待办已删除');loadReminders()}}catch(error){if(error!=='cancel')logger.error('删除待办失败',error)}}
const openDetail=async(row:ReminderRow)=>{const response:any=await api.get(`/reminders/${row.id}`);if(response.success){detail.value=response.data;detailVisible.value=true}}
const openTypeManager=async()=>{await loadTypes();typeManagerVisible.value=true}
const handleTypeColorPreview=(color:string|null)=>{if(color&&/^#[0-9a-f]{6}$/i.test(color))typeForm.color=color}
const openTypeForm=(row?:ReminderType)=>{Object.assign(typeForm,row?{id:row.id,name:row.name,default_remind_days:row.default_remind_days,color:row.color||'#409EFF',sort_order:row.sort_order}:{id:0,name:'',default_remind_days:7,color:'#409EFF',sort_order:0});typeFormVisible.value=true}
const saveType=async()=>{if(!typeForm.name.trim()){ElMessage.warning('请输入类型名称');return}typeSaving.value=true;try{const response:any=typeForm.id?await api.put(`/reminders/types/${typeForm.id}`,typeForm):await api.post('/reminders/types',typeForm);if(response.success){ElMessage.success('事项类型已保存');typeFormVisible.value=false;loadTypes()}}catch(error:any){ElMessage.error(error?.response?.data?.message||'事项类型保存失败')}finally{typeSaving.value=false}}
const toggleType=async(row:ReminderType,value:any)=>{try{const response:any=await api.patch(`/reminders/types/${row.id}/toggle`,{is_active:Boolean(value)});if(response.success){row.is_active=Boolean(value);ElMessage.success('类型状态已更新')}}catch{ElMessage.error('类型状态更新失败')}}
const deleteType=async(row:ReminderType)=>{try{await ElMessageBox.confirm(`确定删除事项类型“${row.name}”吗？`,'删除确认',{type:'warning'});const response:any=await api.delete(`/reminders/types/${row.id}`);if(response.success){ElMessage.success('事项类型已删除');await loadTypes()}}catch(error:any){if(error==='cancel'||error==='close')return;ElMessage.error(error?.response?.data?.message||'事项类型删除失败')}}

onMounted(async()=>{await Promise.all([loadTypes(),loadUsers()]);await loadReminders()})
</script>

<style scoped lang="scss">
.reminder-view { min-height:100%; }
.reminder-stats .stat-icon.active { background:#ecfdf5;color:#059669; }.reminder-stats .stat-icon.completed { background:#eff6ff;color:#2563eb; }.reminder-stats .stat-icon.ignored { background:#fff7ed;color:#ea580c; }
.reminder-title { border:0;background:none;color:#1f2937;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap; }.reminder-title:hover{color:#2563eb;}
.type-badge { display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid;border-radius:999px;font-weight:700;white-space:nowrap; }
.execution-summary{font-variant-numeric:tabular-nums;color:#475569;}.user-option-meta{float:right;margin-left:16px;color:#94a3b8;}.input-suffix{margin-left:8px;color:#64748b;}
.reminder-form-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 18px}.reminder-form-grid .span-2{grid-column:1/-1}.reminder-form-grid :deep(.el-select),.reminder-form-grid :deep(.el-date-editor){width:100%}.weekday-options{display:flex;flex-wrap:wrap}
.detail-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.detail-summary>div{display:flex;flex-direction:column;padding:10px 12px;background:#f8fafc;border-left:3px solid #667eea}.detail-summary span{font-size:12px;color:#64748b}.detail-summary strong{margin-top:3px;color:#1e293b}.detail-content{margin:14px 0;padding:12px;background:#f8fafc;white-space:pre-wrap;color:#334155}.detail-record-table{width:100%}.recipient-status{display:inline-flex;padding:3px 8px;border-radius:999px;font-weight:700}.recipient-status.is-completed{color:#047857;background:#d1fae5}.recipient-status.is-ignored{color:#c2410c;background:#ffedd5}.recipient-status.is-pending{color:#1d4ed8;background:#dbeafe}.recipient-status.is-read,.recipient-status.is-snoozed{color:#6d28d9;background:#ede9fe}
.type-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#64748b;font-size:13px}
.type-color-control{display:flex;align-items:center;gap:14px;min-width:0}.type-color-preview{max-width:240px;overflow:hidden;text-overflow:ellipsis}
/* Element Plus teleports the color picker footer outside the dialog. Keep both
   footer buttons content-sized so they always fit on one horizontal row. */
/* The picker is teleported to body. Raise it above the nested mobile dialog
   and constrain the panel so it cannot be clipped by a narrow viewport. */
:global(.reminder-color-picker-popper.el-popper) {
  z-index: 10050 !important;
  max-width: calc(100vw - 16px) !important;
  box-sizing: border-box !important;
}

:global(.reminder-color-picker-popper .el-color-picker-panel) {
  width: min(300px, calc(100vw - 24px)) !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.reminder-type-table-wrap,.reminder-type-table{width:100%}
@media(max-width:768px){.reminder-form-grid{grid-template-columns:1fr}.reminder-form-grid .span-2{grid-column:auto}.detail-summary{grid-template-columns:1fr}.type-toolbar{align-items:flex-start;flex-direction:column}.reminder-form-dialog :deep(.el-dialog),.reminder-detail-dialog :deep(.el-dialog),.reminder-type-dialog :deep(.el-dialog){width:calc(100vw - 16px)!important;margin:8px auto}.weekday-options :deep(.el-checkbox-button__inner){padding:8px 10px}}
</style>
