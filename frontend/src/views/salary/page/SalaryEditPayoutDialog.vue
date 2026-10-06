<template>
  <MobileDialog
    :model-value="modelValue"
    title="编辑工资记录"
    width="960px"
    dialog-class="salary-dialog salary-dialog-large salary-edit-payout-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form
      id="edit-payout-form"
      @submit.prevent="emit('submit')"
    >
      <div class="form-section">
        <h4>员工信息</h4>
        <div class="form-row">
          <div
            v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
            class="form-group"
          >
            <label>员工</label>
            <el-input
              :model-value="employeeName"
              class="readonly-display-input"
              disabled
            />
          </div>
          <div
            v-if="canViewField('salary_salaryrecordsview', 'base_salary')"
            class="form-group"
          >
            <label>底薪</label>
            <el-input-number
              v-model.number="baseSalary"
              class="form-control"
              :min="0"
              :step="0.01"
              :controls="false"
              :disabled="!canEditField('salary_salaryrecordsview', 'base_salary')"
            />
          </div>
          <div
            v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
            class="form-group"
          >
            <label>销售提成</label>
            <el-input-number
              v-model.number="commissionAmount"
              class="form-control"
              :min="0"
              :step="0.01"
              :controls="false"
              :disabled="!canEditField('salary_salaryrecordsview', 'commission_amount')"
            />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4>调整项</h4>
        <div class="form-row">
          <div
            v-if="canViewField('salary_salaryrecordsview', 'overtime_pay')"
            class="form-group"
          >
            <label>加班费</label>
            <el-input-number
              v-model.number="overtimePay"
              class="form-control"
              :min="0"
              :step="0.01"
              :controls="false"
              :disabled="!canEditField('salary_salaryrecordsview', 'overtime_pay')"
            />
          </div>
          <div
            v-if="canViewField('salary_salaryrecordsview', 'leave_deduction')"
            class="form-group"
          >
            <label>请假扣除</label>
            <el-input-number
              v-model.number="leaveDeduction"
              class="form-control"
              :min="0"
              :step="0.01"
              :controls="false"
              :disabled="!canEditField('salary_salaryrecordsview', 'leave_deduction')"
            />
          </div>
          <div
            v-if="canViewField('salary_salaryrecordsview', 'net_salary')"
            class="form-group"
          >
            <label>应发工资</label>
            <el-input
              :model-value="`¥${netSalary}`"
              class="readonly-display-input net-salary-input"
              readonly
            />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4>结算信息</h4>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'salary_status')"
          class="form-group"
        >
          <label>结算状态</label>
          <el-select
            v-model="status"
            class="form-control"
            placeholder="请选择结算状态"
            :disabled="!canEditField('salary_salaryrecordsview', 'salary_status')"
          >
            <el-option
              label="未结算"
              value="approved"
            />
            <el-option
              label="已结算"
              value="paid"
            />
          </el-select>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'paid_at') && form.status === 'paid'"
          class="form-group"
        >
          <label>结算时间</label>
          <el-date-picker
            v-model="paidAt"
            type="date"
            class="form-control"
            :format="TIME_FORMATS.DATE"
            :value-format="TIME_FORMATS.DATE"
            clearable
            :disabled="!canEditField('salary_salaryrecordsview', 'paid_at')"
          />
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'payment_method') && form.status === 'paid'"
          class="form-group"
        >
          <label>支付方式</label>
          <PaymentMethodSelect
            v-model="paymentMethod"
            variant="settlement"
            class="form-control"
            :disabled="!canEditField('salary_salaryrecordsview', 'payment_method')"
            placeholder="请选择支付方式"
          />
        </div>
      </div>
    </form>

    <template #footer>
      <el-button
        type="info"
        @click="emit('update:modelValue', false)"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        native-type="submit"
        form="edit-payout-form"
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
import { TIME_FORMATS } from '@/utils/time'
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { PaymentMethodSelect } from '@/components/payment'

export interface SalaryEditPayoutForm {
  id: number | null
  employee_id: number
  salary_template_id: number | null
  base_salary: number
  commission_amount: number
  overtime_pay: number
  leave_deduction: number
  status: string
  paid_at: string | null
  payment_method: string | null
}

const props = defineProps<{
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  employeeName: string
  form: SalaryEditPayoutForm
  modelValue: boolean
  netSalary: string
  saving: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:form': [value: SalaryEditPayoutForm]
  'update:modelValue': [value: boolean]
}>()

const createFieldModel = <K extends keyof SalaryEditPayoutForm>(key: K) => computed({
  get: () => props.form[key],
  set: (value: SalaryEditPayoutForm[K]) => {
    emit('update:form', { ...props.form, [key]: value })
  }
})

const baseSalary = createFieldModel('base_salary')
const commissionAmount = createFieldModel('commission_amount')
const overtimePay = createFieldModel('overtime_pay')
const leaveDeduction = createFieldModel('leave_deduction')
const status = createFieldModel('status')
const paidAt = createFieldModel('paid_at')
const paymentMethod = createFieldModel('payment_method')
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--tf-color-border-element);
    color: var(--color-text-primary);
    font-size: var(--tf-type-scale-15);
    font-weight: 600;
  }
}

.form-row {
  display: flex;
  gap: 16px;

  .form-group {
    flex: 1;
    margin-bottom: 0;
  }
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 8px;
    color: var(--tf-color-gray-ant-600);
    font-size: var(--tf-type-scale-14);
    font-weight: 500;
  }
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--tf-color-gray-ant-400);
  border-radius: 6px;
  background: var(--tf-color-white);
  font-size: var(--tf-type-scale-14);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: var(--tf-color-blue-ant-light);
    box-shadow: 0 0 0 2px rgb(24 144 255 / 20%);
  }
}

.net-salary-input {
  color: var(--color-primary);
  font-weight: 600;

  :deep(.el-input__inner) {
    color: inherit;
    font-weight: inherit;
  }
}

@media (max-width: 767px) {
  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    margin-bottom: 16px;

    label {
      font-size: var(--tf-type-scale-13);
    }
  }

  .form-control {
    padding: 8px 10px;
    font-size: var(--tf-type-scale-13);
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .form-row {
    gap: 12px;
  }

  .form-control {
    padding: 9px 11px;
  }
}
</style>
