<template>
  <MobileDialog
    :model-value="modelValue"
    :title="title"
    width="680px"
    dialog-class="salary-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form
      id="attendance-form"
      @submit.prevent="emit('submit')"
    >
      <div
        v-if="canViewField(moduleKey, 'attendance_record_type')"
        class="form-group"
      >
        <label>记录类型</label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              v-model="recordType"
              type="radio"
              value="monthly_leave"
              :disabled="!canEditField(moduleKey, 'attendance_record_type')"
              @change="emit('type-change')"
            >
            <span><i class="fas fa-umbrella-beach text-success mr-1" />休假</span>
          </label>
          <label class="radio-label">
            <input
              v-model="recordType"
              type="radio"
              value="leave"
              :disabled="!canEditField(moduleKey, 'attendance_record_type')"
              @change="emit('type-change')"
            >
            <span><i class="fas fa-user-clock text-warning mr-1" />请假</span>
          </label>
          <label class="radio-label">
            <input
              v-model="recordType"
              type="radio"
              value="overtime"
              :disabled="!canEditField(moduleKey, 'attendance_record_type')"
              @change="emit('type-change')"
            >
            <span><i class="fas fa-business-time text-blue mr-1" />加班</span>
          </label>
        </div>
      </div>

      <div
        v-if="canViewField(moduleKey, 'attendance_record_date')"
        class="form-group"
      >
        <label>{{ recordType === 'overtime' ? '加班日期' : '记录日期' }} <span class="required">*</span></label>
        <input
          v-model="recordDate"
          type="date"
          class="form-control"
          :disabled="!canEditField(moduleKey, 'attendance_record_date')"
          required
        >
      </div>

      <template v-if="recordType === 'monthly_leave'">
        <div
          v-if="canViewField(moduleKey, 'monthly_leave_days')"
          class="form-group"
        >
          <label>休假天数（天） <span class="required">*</span></label>
          <input
            v-model.number="monthlyLeaveDays"
            type="number"
            class="form-control"
            min="0.5"
            max="31"
            step="0.5"
            :disabled="!canEditField(moduleKey, 'monthly_leave_days')"
            required
          >
        </div>
      </template>

      <template v-if="recordType === 'leave'">
        <div
          v-if="canViewField(moduleKey, 'attendance_leave_type')"
          class="form-group"
        >
          <label>请假类型 <span class="required">*</span></label>
          <select
            v-model="leaveType"
            class="form-control"
            :disabled="!canEditField(moduleKey, 'attendance_leave_type')"
            required
          >
            <option value="">
              请选择请假类型
            </option>
            <option value="事假">
              事假
            </option>
            <option value="病假">
              病假
            </option>
            <option value="年假">
              年假
            </option>
            <option value="调休">
              调休
            </option>
          </select>
        </div>
        <div
          v-if="canViewField(moduleKey, 'leave_days')"
          class="form-group"
        >
          <label>请假天数（天） <span class="required">*</span></label>
          <input
            v-model.number="leaveDays"
            type="number"
            class="form-control"
            min="0.1"
            max="31"
            step="0.5"
            :disabled="!canEditField(moduleKey, 'leave_days')"
            required
          >
          <span class="form-tip">无薪，扣工资</span>
        </div>
      </template>

      <template v-if="recordType === 'overtime'">
        <div
          v-if="canViewField(moduleKey, 'overtime_hours')"
          class="form-group"
        >
          <label>加班时长（小时） <span class="required">*</span></label>
          <input
            v-model.number="overtimeHours"
            type="number"
            class="form-control"
            min="0.5"
            max="24"
            step="0.5"
            :disabled="!canEditField(moduleKey, 'overtime_hours')"
            required
          >
          <span class="form-tip tag-success">有加班费</span>
        </div>
      </template>

      <div
        v-if="canViewField(moduleKey, 'attendance_reason')"
        class="form-group"
      >
        <label>备注</label>
        <textarea
          v-model="reason"
          class="form-control"
          rows="2"
          placeholder="请输入备注（可选）"
          :disabled="!canEditField(moduleKey, 'attendance_reason')"
        />
      </div>

      <div
        v-if="canViewField(moduleKey, 'attendance_status')"
        class="form-group"
      >
        <label>状态</label>
        <div class="radio-group status-group">
          <label class="radio-label">
            <input
              v-model="status"
              type="radio"
              value="approved"
              :disabled="!canEditField(moduleKey, 'attendance_status')"
            >
            <span><i class="fas fa-check-circle text-success mr-1" />已通过（直接生效）</span>
          </label>
          <label class="radio-label">
            <input
              v-model="status"
              type="radio"
              value="pending"
              :disabled="!canEditField(moduleKey, 'attendance_status')"
            >
            <span><i class="fas fa-clock text-secondary mr-1" />待审批（需审批后生效）</span>
          </label>
        </div>
      </div>
    </form>

    <template #footer>
      <el-button
        type="info"
        @click="emit('update:modelValue', false)"
      >
        <i class="fas fa-times" />
        取消
      </el-button>
      <el-button
        type="primary"
        native-type="submit"
        form="attendance-form"
        :disabled="saving"
      >
        <InlineLoading
          v-if="saving"
          text="保存中..."
          size="small"
          variant="inherit"
        />
        <template v-else>
          <i class="fas fa-save" />
          保存
        </template>
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AttendanceRecord } from '@/api/attendance'
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'

export type AttendanceForm = AttendanceRecord & { reason: string }

const moduleKey = 'salary_salaryrecordsview'
const props = defineProps<{
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  form: AttendanceForm
  modelValue: boolean
  saving: boolean
  title: string
}>()

const emit = defineEmits<{
  submit: []
  'type-change': []
  'update:form': [value: AttendanceForm]
  'update:modelValue': [value: boolean]
}>()

const createFieldModel = <K extends keyof AttendanceForm>(key: K) => computed({
  get: () => props.form[key],
  set: (value: AttendanceForm[K]) => emit('update:form', { ...props.form, [key]: value })
})

const recordType = createFieldModel('record_type')
const recordDate = createFieldModel('record_date')
const monthlyLeaveDays = createFieldModel('monthly_leave_days')
const leaveType = createFieldModel('leave_type')
const leaveDays = createFieldModel('leave_days')
const overtimeHours = createFieldModel('overtime_hours')
const reason = createFieldModel('reason')
const status = createFieldModel('status')
</script>

<style lang="scss" scoped>
.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  > label {
    display: block;
    margin-bottom: 8px;
    color: var(--tf-color-gray-ant-600);
    font-size: 14px;
    font-weight: 500;
  }
}

.required {
  color: var(--tf-color-red-ant);
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--tf-color-gray-ant-400);
  border-radius: 6px;
  background: var(--tf-color-white);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: var(--tf-color-blue-ant-light);
    box-shadow: 0 0 0 2px rgb(24 144 255 / 20%);
  }
}

textarea.form-control {
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
}

.radio-group {
  display: flex;
  gap: 24px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tf-color-gray-ant-600);
  font-size: 14px;
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--tf-color-blue-ant);
  }
}

.status-group {
  flex-wrap: wrap;
}

.form-tip {
  display: block;
  margin-top: 6px;
  color: var(--tf-color-gray-ant-500);
  font-size: 12px;
  line-height: 1.5;
}

.tag-success {
  color: var(--color-success);
}

@media (max-width: 767px) {
  .form-group {
    margin-bottom: 16px;

    > label {
      font-size: 13px;
    }
  }

  .form-control {
    padding: 8px 10px;
    font-size: 13px;
  }

  .radio-group {
    flex-direction: column;
    gap: 12px;
  }

  .radio-label {
    font-size: 13px;
  }
}
</style>
