<template>
  <MobileDialog
    :model-value="modelValue"
    :title="`${employee?.name || employee?.username || ''} - 考勤记录`"
    width="1100px"
    dialog-class="salary-dialog salary-dialog-large"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="attendance-actions">
      <el-alert
        v-if="!employee?.salary_template_id"
        title="该员工未绑定工资模板，不能登记休假、请假或加班。"
        type="warning"
        :closable="false"
      />
      <el-button
        v-if="canCreate"
        v-permission="'salary-records:create'"
        type="primary"
        :disabled="!employee?.salary_template_id"
        @click="emit('add')"
      >
        <i class="fas fa-plus" />
        新增考勤
      </el-button>
    </div>

    <el-table
      v-tf-loading="{ active: loading, text: '正在刷新员工考勤记录...' }"
      :data="records"
      border
      stripe
      class="data-table"
    >
      <template #empty>
        <TableLoadingRow
          v-if="loading"
          mode="block"
          text="正在读取员工考勤记录..."
        />
        <DataEmptyState
          v-else
          description="暂无考勤记录"
        />
      </template>

      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_record_date')"
        label="日期"
        :min-width="dateColumnMinWidth"
        align="center"
      >
        <template #default="{ row }">
          {{ formatAttendanceTableDateRange(
            row.record_date,
            row.record_type,
            row.record_type === 'monthly_leave' ? row.monthly_leave_days : row.leave_days
          ) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_record_type')"
        label="类型"
        :min-width="typeColumnMinWidth"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            :type="getAttendanceTypeTag(row.record_type)"
            size="small"
          >
            {{ getAttendanceTypeText(row.record_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        v-if="showDetailColumn"
        label="详情"
        :min-width="detailColumnMinWidth"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="row.record_type === 'monthly_leave'">休假 {{ formatDays(row.monthly_leave_days) }} 天</span>
          <span v-else-if="row.record_type === 'leave'">请假 {{ formatDays(row.leave_days) }} 天</span>
          <span v-else-if="row.record_type === 'overtime'">{{ formatDays(row.overtime_hours) }}小时</span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_reason')"
        label="原因"
        :min-width="reasonColumnMinWidth"
        class-name="complete-text-column wrapped-text-column"
      >
        <template #default="{ row }">
          {{ getReasonText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_status')"
        prop="status"
        label="状态"
        :min-width="statusColumnMinWidth"
        align="center"
      >
        <template #default="{ row }">
          <el-tag
            v-if="row.status === 'pending'"
            type="info"
            size="small"
          >
            待审批
          </el-tag>
          <el-tag
            v-else-if="row.status === 'approved'"
            type="success"
            size="small"
          >
            已通过
          </el-tag>
          <el-tag
            v-else
            type="danger"
            size="small"
          >
            已拒绝
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        v-if="shouldShowActionColumn(canViewField(moduleKey, 'actions'), [canEdit, canDelete])"
        label="操作"
        :min-width="attendanceRecordActionColumnWidth"
        align="center"
        class-name="actions-column"
      >
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button
              v-if="canEdit"
              v-permission="'salary-records:edit'"
              size="small"
              type="primary"
              @click.stop="emit('edit', row)"
            >
              <i class="fas fa-edit" />
              编辑
            </el-button>
            <el-button
              v-if="canDelete"
              v-permission="'salary-records:delete'"
              size="small"
              type="danger"
              @click.stop="row.id && emit('delete', row.id)"
            >
              <i class="fas fa-trash" />
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          type="info"
          @click="emit('update:modelValue', false)"
        >
          <i class="fas fa-times" />
          关闭
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import type { AttendanceRecord } from '@/api/attendance'
import MobileDialog from '@/components/MobileDialog.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import {
  getAdaptiveActionColumnWidth,
  getTextColumnMinWidth
} from '@/utils/table-layout'
import {
  formatAttendanceLeaveReason,
  formatAttendanceTableDateRange
} from '@/utils/attendance-leave-allocation'

type AttendanceListRecord = AttendanceRecord & { reason?: string }

interface EmployeeSummary {
  name?: string | null
  username?: string | null
  salary_template_id?: number | null
}

const moduleKey = 'salary_salaryrecordsview'
const props = defineProps<{
  canCreate: boolean
  canDelete: boolean
  canEdit: boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  employee: EmployeeSummary | null
  getAttendanceTypeTag: (_type: string) => 'primary' | 'success' | 'warning' | 'danger' | 'info'
  getAttendanceTypeText: (_type: string) => string
  loading: boolean
  modelValue: boolean
  records: AttendanceListRecord[]
}>()

const emit = defineEmits<{
  add: []
  delete: [id: number]
  edit: [record: AttendanceListRecord]
  'update:modelValue': [value: boolean]
}>()

const formatDays = (value: number | undefined) => {
  const days = Number(value) || 0
  return Number.isInteger(days) ? String(days) : String(Number(days.toFixed(2)))
}

const getReasonText = (row: AttendanceListRecord) => {
  if (row.record_type === 'monthly_leave') {
    return `休假 ${formatDays(row.monthly_leave_days)} 天`
  }
  if (row.record_type === 'leave') return getLeaveReasonText(row)
  if (row.record_type === 'overtime') return row.overtime_reason || '-'
  return '-'
}

const getLeaveReasonText = (row: AttendanceListRecord) => {
  return formatAttendanceLeaveReason(row.leave_reason, row.leave_days)
}

const dateColumnMinWidth = computed(() => getTextColumnMinWidth([
  '日期',
  ...props.records.map(row => formatAttendanceTableDateRange(
    row.record_date,
    row.record_type,
    row.record_type === 'monthly_leave' ? row.monthly_leave_days : row.leave_days
  ))
], { minWidth: 112, maxWidth: 190 }))
const typeColumnMinWidth = computed(() => getTextColumnMinWidth([
  '类型',
  ...props.records.map(row => props.getAttendanceTypeText(row.record_type))
], { minWidth: 76, maxWidth: 128 }))
const detailColumnMinWidth = computed(() => getTextColumnMinWidth([
  '详情',
  ...props.records.map(row => {
    if (row.record_type === 'monthly_leave') return `休假 ${formatDays(row.monthly_leave_days)} 天`
    if (row.record_type === 'leave') return `请假 ${formatDays(row.leave_days)} 天`
    if (row.record_type === 'overtime') return `${formatDays(row.overtime_hours)}小时`
    return '-'
  })
], { minWidth: 100, maxWidth: 190 }))
const reasonColumnMinWidth = computed(() => getTextColumnMinWidth([
  '原因',
  ...props.records.map(getReasonText)
], { minWidth: 120, maxWidth: 280 }))
const statusColumnMinWidth = computed(() => getTextColumnMinWidth([
  '状态',
  ...props.records.map(row => row.status === 'pending' ? '待审批' : row.status === 'approved' ? '已通过' : '已拒绝')
], { minWidth: 76, maxWidth: 112 }))
const attendanceRecordActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(props.records, [
  { label: '编辑', visible: props.canEdit },
  { label: '删除', visible: props.canDelete }
]))

const showDetailColumn = computed(() => [
  'attendance_record_type',
  'monthly_leave_days',
  'leave_days',
  'overtime_hours'
].some(field => props.canViewField(moduleKey, field)))
</script>

<style lang="scss" scoped>
.attendance-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 767px) {
  .attendance-actions {
    flex-direction: column;
    gap: 8px;

    :deep(.el-button) {
      width: 100%;
      margin: 0;
    }
  }
}
</style>
