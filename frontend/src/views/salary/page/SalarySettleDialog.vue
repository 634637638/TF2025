<template>
  <MobileDialog
    :model-value="modelValue"
    title="结算工资"
    width="520px"
    dialog-class="salary-dialog"
    :show-default-footer="false"
    @close="emit('close')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settle-info">
      <div
        v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
        class="settle-row"
      >
        <span class="label">员工：</span>
        <span class="value">{{ form.employeeName }}</span>
      </div>
      <div
        v-if="canViewField('salary_salaryrecordsview', 'net_salary')"
        class="settle-row"
      >
        <span class="label">结算金额：</span>
        <span class="value amount">¥{{ form.netSalary }}</span>
      </div>
    </div>

    <form
      id="settle-form"
      @submit.prevent="emit('submit')"
    >
      <div
        v-if="canViewField('salary_salaryrecordsview', 'payment_method')"
        class="form-group"
      >
        <label>支付方式 <span class="required">*</span></label>
        <select
          v-model="paymentMethod"
          class="form-control"
          :disabled="!canEditField('salary_salaryrecordsview', 'payment_method')"
          required
        >
          <option value="">
            请选择支付方式
          </option>
          <option value="cash">
            现金
          </option>
          <option value="bank_transfer">
            银行转账
          </option>
          <option value="wechat">
            微信支付
          </option>
          <option value="alipay">
            支付宝
          </option>
          <option value="other">
            其他
          </option>
        </select>
      </div>
    </form>

    <template #footer>
      <el-button
        type="info"
        @click="emit('close')"
      >
        取消
      </el-button>
      <el-button
        type="success"
        native-type="submit"
        form="settle-form"
        :disabled="saving"
      >
        <InlineLoading
          v-if="saving"
          text="结算中..."
          size="small"
          variant="inherit"
        />
        <template v-else>
          <i class="fas fa-check" />
          确认结算
        </template>
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'

export interface SalarySettleForm {
  recordId: number | null
  employeeId: number
  employeeName: string
  netSalary: number | string
  payment_method: string
}

const props = defineProps<{
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  form: SalarySettleForm
  modelValue: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: []
  'update:form': [value: SalarySettleForm]
  'update:modelValue': [value: boolean]
}>()

const paymentMethod = computed({
  get: () => props.form.payment_method,
  set: (value: string) => emit('update:form', { ...props.form, payment_method: value })
})
</script>

<style lang="scss" scoped>
.settle-info {
  margin-bottom: 20px;
  padding: 16px;
  border-radius: 8px;
  background: var(--tf-color-neutral-25);
}

.settle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;

  .label {
    color: var(--tf-color-gray-ant-600);
    font-weight: 500;
  }

  .value {
    color: var(--tf-color-neutral-ant);
    font-size: 16px;
    font-weight: 500;

    &.amount {
      color: var(--tf-color-red-ant);
      font-size: 24px;
      font-weight: 600;
    }
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

@media (max-width: 767px) {
  .form-group {
    margin-bottom: 16px;

    label {
      font-size: 13px;
    }
  }

  .form-control {
    padding: 8px 10px;
    font-size: 13px;
  }
}
</style>
