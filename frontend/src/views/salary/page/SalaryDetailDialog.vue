<template>
  <MobileDialog
    :model-value="modelValue"
    title="工资详情"
    width="720px"
    dialog-class="salary-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="record"
      class="detail-view"
    >
      <div class="detail-section detail-section-grid">
        <h4>基本信息</h4>
        <div class="detail-grid">
          <div
            v-if="canViewField('salary_mysalaryview', 'employee_name')"
            class="detail-row"
          >
            <span class="label">员工</span>
            <span class="value">{{ record.employee_name || getEmployeeName(record.employee_id) }}</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'period_start')"
            class="detail-row"
          >
            <span class="label">月份</span>
            <span class="value">{{ formatMonth(record.period_start) }}</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'actual_work_days')"
            class="detail-row"
          >
            <span class="label">工作天数</span>
            <span class="value">{{ formatWorkDays(record.actual_work_days) }}</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'salary_status')"
            class="detail-row"
          >
            <span class="label">状态</span>
            <span class="value">
              <span
                v-if="record.status === 'approved'"
                class="tag tag-primary"
              >待发放</span>
              <span
                v-else-if="record.status === 'paid'"
                class="tag tag-success"
              >已发放</span>
            </span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>工资明细</h4>
        <div
          v-if="canViewField('salary_mysalaryview', 'base_salary')"
          class="detail-row"
        >
          <span class="label">底薪：</span>
          <span class="value">¥{{ record.base_salary }}</span>
        </div>
        <div
          v-if="canViewField('salary_mysalaryview', 'commission_amount')"
          class="detail-row"
        >
          <span class="label">销售提成：</span>
          <span class="value">数量：{{ record.sales_count }} 台，金额：¥{{ record.commission_amount }}</span>
        </div>
        <div
          v-if="canViewField('salary_mysalaryview', 'overtime_pay')"
          class="detail-row"
        >
          <span class="label">加班费：</span>
          <span class="value">时长：{{ record.overtime_hours }} 小时，金额：¥{{ record.overtime_pay }}</span>
        </div>
        <div
          v-if="canViewField('salary_mysalaryview', 'leave_deduction')"
          class="detail-row"
        >
          <span class="label">请假扣除：</span>
          <span class="value">天数：{{ formatLeaveDays(record.leave_days) }} 天，金额：¥{{ record.leave_deduction }}</span>
        </div>
        <div
          v-if="canViewField('salary_mysalaryview', 'net_salary')"
          class="detail-row highlight"
        >
          <span class="label">应发工资：</span>
          <span class="value net-salary-large">¥{{ record.net_salary }}</span>
        </div>
      </div>

      <div
        v-if="record.calculation_note"
        class="detail-section"
      >
        <h4>计算说明</h4>
        <div class="detail-row full">
          <span class="value">{{ record.calculation_note }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button
        type="info"
        @click="emit('update:modelValue', false)"
      >
        <i class="fas fa-times" />关闭
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'

type SalaryValue = number | string | null | undefined

export interface SalaryDetailRecord {
  actual_work_days?: SalaryValue
  base_salary?: SalaryValue
  calculation_note?: string | null
  commission_amount?: SalaryValue
  employee_id: number
  employee_name?: string | null
  leave_days?: SalaryValue
  leave_deduction?: SalaryValue
  net_salary?: SalaryValue
  overtime_hours?: SalaryValue
  overtime_pay?: SalaryValue
  period_start?: string
  sales_count?: SalaryValue
  status?: string | null
}

defineProps<{
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  formatLeaveDays: (_days: unknown) => string | number
  formatMonth: (_periodStart: string) => string
  formatWorkDays: (_days: unknown) => string | number
  getEmployeeName: (_employeeId: number) => string
  modelValue: boolean
  record: SalaryDetailRecord | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style lang="scss" scoped>
.detail-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  padding: 20px;
  background: linear-gradient(135deg, var(--tf-color-surface-cool-page) 0%, var(--tf-color-surface-cool) 100%);
  border: 1px solid var(--tf-color-border-cool-alt);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 4%);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
    transform: translateY(-2px);
  }

  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--tf-color-border-cool-alt);
    color: var(--tf-color-heading);
    font-size: 15px;
    font-weight: 600;

    &::before {
      width: 4px;
      height: 16px;
      background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
      border-radius: 2px;
      content: '';
    }
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-section-grid .detail-row {
  margin-bottom: 0;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 10px 12px;
  background: var(--tf-color-white);
  border: 1px solid var(--tf-color-surface-ant);
  border-radius: 10px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--tf-color-surface-indigo-soft);
    border-color: var(--tf-color-slate-200);
  }

  &:last-child {
    margin-bottom: 0;
  }

  &.full {
    flex-direction: column;
    align-items: flex-start;
  }

  &.highlight {
    margin-top: 12px;
    padding: 16px;
    background: linear-gradient(135deg, var(--tf-color-orange-surface) 0%, var(--tf-color-orange-pale) 100%);
    border: 1px solid var(--tf-color-orange-tailwind-200);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgb(255 153 51 / 15%);

    .label {
      color: var(--tf-color-amber-600);
      font-weight: 600;
    }

    .net-salary-large {
      background: linear-gradient(135deg, var(--tf-color-orange-coral) 0%, var(--tf-color-orange-ant) 100%);
      background-clip: text;
      color: transparent;
      font-size: 28px;
      font-weight: 700;
    }
  }

  .label {
    min-width: 100px;
    color: var(--tf-color-slate-500);
    font-size: 14px;
    font-weight: 500;
  }

  .value {
    color: var(--tf-color-neutral-ant);
    text-align: right;
  }
}

.net-salary-large {
  color: var(--tf-color-red-ant);
  font-size: 24px;
  font-weight: 600;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border: none;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
  color: var(--tf-color-white);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.tag-primary {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
}

.tag-success {
  background: linear-gradient(135deg, var(--tf-color-salary-chart-green) 0%, var(--tf-color-salary-chart-lime) 100%);
}

@media (max-width: 767px) {
  .detail-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 12px;

    .label,
    .value {
      width: 100%;
      min-width: 0;
      text-align: left;
    }

    &.highlight {
      padding: 14px 12px;

      .net-salary-large {
        font-size: 22px;
      }
    }
  }
}

@media (max-width: 480px) {
  .detail-row.highlight .net-salary-large {
    font-size: 20px;
  }
}
</style>
