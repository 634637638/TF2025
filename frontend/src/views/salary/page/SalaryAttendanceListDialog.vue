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
      <el-button
        v-if="canCreate"
        v-permission="'salary-records:create'"
        type="primary"
        @click="emit('add')"
      >
        <i class="fas fa-plus" />
        新增考勤
      </el-button>
      <el-button
        v-if="canCreate"
        v-permission="'salary-records:create'"
        type="success"
        @click="emit('quickAdd', 'overtime')"
      >
        <i class="fas fa-business-time" />
        新增加班
      </el-button>
      <el-button
        v-if="canCreate"
        v-permission="'salary-records:create'"
        type="success"
        @click="emit('quickAdd', 'monthly_leave')"
      >
        <i class="fas fa-umbrella-beach" />
        新增休假
      </el-button>
      <el-button
        v-if="canCreate"
        v-permission="'salary-records:create'"
        type="warning"
        @click="emit('quickAdd', 'leave')"
      >
        <i class="fas fa-user-clock" />
        新增请假
      </el-button>
    </div>

    <el-table
      :data="loading ? [] : records"
      border
      stripe
      class="data-table"
    >
      <template #empty>
        <TableLoadingRow
          v-if="loading"
          mode="block"
          text="加载中..."
        />
        <DataEmptyState
          v-else
          description="暂无考勤记录"
        />
      </template>

      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_record_date')"
        prop="record_date"
        label="日期"
        width="120"
        align="center"
      />
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_record_type')"
        label="类型"
        width="100"
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
        width="150"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="row.record_type === 'monthly_leave'">{{ row.monthly_leave_days }}天</span>
          <span v-else-if="row.record_type === 'leave'">{{ row.leave_type }} {{ row.leave_days }}天</span>
          <span v-else-if="row.record_type === 'overtime'">{{ row.overtime_hours }}小时</span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_reason')"
        prop="reason"
        label="原因"
        min-width="150"
        class-name="complete-text-column wrapped-text-column"
      />
      <el-table-column
        v-if="canViewField(moduleKey, 'attendance_status')"
        prop="status"
        label="状态"
        width="90"
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
        :width="getActionColumnMinWidth(Number(canEdit) + Number(canDelete))"
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

    <DataEmptyState
      v-if="!loading && records.length === 0"
      size="compact"
      description="暂无考勤记录"
    />

    <template #footer>
      <el-button
        type="info"
        @click="emit('update:modelValue', false)"
      >
        <i class="fas fa-times" />
        关闭
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import type { AttendanceRecord } from '@/api/attendance'
import MobileDialog from '@/components/MobileDialog.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { getActionColumnMinWidth } from '@/utils/table-layout'

type AttendanceListRecord = AttendanceRecord & { reason?: string }
type AttendanceType = AttendanceRecord['record_type']

interface EmployeeSummary {
  name?: string | null
  username?: string | null
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
  quickAdd: [type: AttendanceType]
  'update:modelValue': [value: boolean]
}>()

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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-info);

  i {
    margin-bottom: 16px;
    font-size: 48px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
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
