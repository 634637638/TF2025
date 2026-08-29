<template>
  <MobileDialog
    :model-value="modelValue"
    :title="form.id ? '编辑工资模板' : '新增工资模板'"
    width="760px"
    dialog-class="salary-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form
      id="template-form"
      @submit.prevent="emit('submit')"
    >
      <div
        v-if="canViewField(moduleKey, 'template_name')"
        class="form-group"
      >
        <label>模板名称 <span class="required">*</span></label>
        <input
          v-model="name"
          type="text"
          class="form-control"
          placeholder="请输入模板名称"
          :disabled="!canEditField(moduleKey, 'template_name')"
          required
        >
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_description')"
        class="form-group"
      >
        <label>说明</label>
        <textarea
          v-model="description"
          class="form-control"
          rows="2"
          placeholder="请输入模板说明"
          :disabled="!canEditField(moduleKey, 'template_description')"
        />
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_base_salary')"
        class="form-group"
      >
        <label>底薪（元） <span class="required">*</span></label>
        <input
          v-model.number="baseSalary"
          type="number"
          class="form-control"
          placeholder="请输入底薪"
          min="0"
          step="100"
          :disabled="!canEditField(moduleKey, 'template_base_salary')"
          required
        >
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_commission_type')"
        class="form-group"
      >
        <label>提成方式 <span class="required">*</span></label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              v-model="commissionType"
              type="radio"
              value="fixed"
              :disabled="!canEditField(moduleKey, 'template_commission_type')"
            >
            <span>固定金额</span>
          </label>
          <label class="radio-label">
            <input
              v-model="commissionType"
              type="radio"
              value="percentage"
              :disabled="!canEditField(moduleKey, 'template_commission_type')"
            >
            <span>利润百分比</span>
          </label>
        </div>
      </div>

      <div
        v-if="form.commission_type === 'fixed' && canViewField(moduleKey, 'template_commission_new_fixed')"
        class="form-group"
      >
        <label>全新机提成（元/台） <span class="required">*</span></label>
        <input
          v-model.number="commissionNewFixed"
          type="number"
          class="form-control"
          placeholder="请输入全新机提成金额"
          min="0"
          step="1"
          :disabled="!canEditField(moduleKey, 'template_commission_new_fixed')"
          required
        >
        <span class="form-tip">销售全新机的提成金额，设为0则不计算提成</span>
      </div>

      <div
        v-if="form.commission_type === 'fixed' && canViewField(moduleKey, 'template_commission_used_fixed')"
        class="form-group"
      >
        <label>二手机提成（元/台）</label>
        <input
          v-model.number="commissionUsedFixed"
          type="number"
          class="form-control"
          placeholder="请输入二手机提成金额"
          min="0"
          step="1"
          :disabled="!canEditField(moduleKey, 'template_commission_used_fixed')"
        >
        <span class="form-tip">销售二手机的提成金额，设为0则不计算提成</span>
      </div>

      <div
        v-if="form.commission_type === 'percentage' && canViewField(moduleKey, 'template_commission_percentage')"
        class="form-group"
      >
        <label>利润提成（%） <span class="required">*</span></label>
        <input
          v-model.number="commissionPercentage"
          type="number"
          class="form-control"
          placeholder="请输入利润提成比例"
          min="0"
          max="100"
          step="1"
          :disabled="!canEditField(moduleKey, 'template_commission_percentage')"
          required
        >
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_overtime_hourly_rate')"
        class="form-group"
      >
        <label>加班费率（元/小时） <span class="required">*</span></label>
        <input
          v-model.number="overtimeHourlyRate"
          type="number"
          class="form-control"
          placeholder="请输入加班费率"
          min="0"
          step="10"
          :disabled="!canEditField(moduleKey, 'template_overtime_hourly_rate')"
          required
        >
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_rest_days')"
        class="form-group"
      >
        <label>每月休息天数 <span class="required">*</span></label>
        <input
          v-model.number="restDays"
          type="number"
          class="form-control"
          placeholder="请输入每月休息天数"
          min="0"
          max="31"
          step="1"
          :disabled="!canEditField(moduleKey, 'template_rest_days')"
          required
        >
        <span class="form-tip">请假天数超过此设置的部分，按日薪扣除工资</span>
      </div>

      <div
        v-if="showAutoRaiseSection"
        class="divider"
      >
        <span><i class="fas fa-chart-line" /> 自动涨薪规则</span>
      </div>

      <div
        v-if="canViewField(moduleKey, 'template_auto_raise_enabled')"
        class="form-group"
      >
        <label class="switch-label">
          <span>启用自动涨薪</span>
          <label class="switch">
            <input
              v-model="autoRaiseEnabled"
              type="checkbox"
              :disabled="!canEditField(moduleKey, 'template_auto_raise_enabled')"
            >
            <span class="slider" />
          </label>
        </label>
      </div>

      <template v-if="form.auto_raise_enabled && canViewField(moduleKey, 'template_auto_raise_enabled')">
        <div
          v-if="canViewField(moduleKey, 'template_auto_raise_months')"
          class="form-group"
        >
          <label>涨薪周期（月） <span class="required">*</span></label>
          <input
            v-model.number="autoRaiseMonths"
            type="number"
            class="form-control"
            placeholder="请输入涨薪周期"
            min="1"
            max="60"
            step="1"
            :disabled="!canEditField(moduleKey, 'template_auto_raise_months')"
            required
          >
          <span class="form-tip">员工入职每满此月数自动涨薪</span>
        </div>

        <div
          v-if="canViewField(moduleKey, 'template_auto_raise_amount')"
          class="form-group"
        >
          <label>涨薪金额（元） <span class="required">*</span></label>
          <input
            v-model.number="autoRaiseAmount"
            type="number"
            class="form-control"
            placeholder="请输入涨薪金额"
            min="0"
            step="50"
            :disabled="!canEditField(moduleKey, 'template_auto_raise_amount')"
            required
          >
          <span class="form-tip">每次涨薪增加的金额</span>
        </div>

        <div
          v-if="canViewField(moduleKey, 'template_auto_raise_max_salary')"
          class="form-group"
        >
          <label>最高底薪（元） <span class="required">*</span></label>
          <input
            v-model.number="autoRaiseMaxSalary"
            type="number"
            class="form-control"
            placeholder="请输入最高底薪"
            min="0"
            step="100"
            :disabled="!canEditField(moduleKey, 'template_auto_raise_max_salary')"
            required
          >
          <span class="form-tip">达到此金额后不再自动涨薪</span>
        </div>
      </template>
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
        form="template-form"
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
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'

export interface SalaryTemplateForm {
  id?: number
  name: string
  description: string
  base_salary: number
  commission_type: string
  commission_fixed: number
  commission_new_fixed: number
  commission_used_fixed: number
  commission_percentage: number
  overtime_hourly_rate: number
  rest_days: number
  auto_raise_enabled: boolean
  auto_raise_months: number
  auto_raise_amount: number
  auto_raise_max_salary: number
}

const moduleKey = 'salary_salarytemplatesview'
const props = defineProps<{
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  form: SalaryTemplateForm
  modelValue: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:form': [value: SalaryTemplateForm]
  'update:modelValue': [value: boolean]
}>()

const createFieldModel = <K extends keyof SalaryTemplateForm>(key: K) => computed({
  get: () => props.form[key],
  set: (value: SalaryTemplateForm[K]) => emit('update:form', { ...props.form, [key]: value })
})

const name = createFieldModel('name')
const description = createFieldModel('description')
const baseSalary = createFieldModel('base_salary')
const commissionType = createFieldModel('commission_type')
const commissionNewFixed = createFieldModel('commission_new_fixed')
const commissionUsedFixed = createFieldModel('commission_used_fixed')
const commissionPercentage = createFieldModel('commission_percentage')
const overtimeHourlyRate = createFieldModel('overtime_hourly_rate')
const restDays = createFieldModel('rest_days')
const autoRaiseEnabled = createFieldModel('auto_raise_enabled')
const autoRaiseMonths = createFieldModel('auto_raise_months')
const autoRaiseAmount = createFieldModel('auto_raise_amount')
const autoRaiseMaxSalary = createFieldModel('auto_raise_max_salary')

const showAutoRaiseSection = computed(() => [
  'template_auto_raise_enabled',
  'template_auto_raise_months',
  'template_auto_raise_amount',
  'template_auto_raise_max_salary'
].some(field => props.canViewField(moduleKey, field)))
</script>

<style lang="scss" scoped>
.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  > label:not(.switch-label) {
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

.form-tip {
  display: block;
  margin-top: 6px;
  color: var(--tf-color-gray-ant-500);
  font-size: 12px;
  line-height: 1.5;
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

.switch-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }
}

.slider {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  background: var(--tf-color-gray-300-solid);
  cursor: pointer;
  transition: 0.3s;

  &::before {
    position: absolute;
    bottom: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--tf-color-white);
    content: '';
    transition: 0.3s;
  }
}

input:checked + .slider {
  background: var(--tf-color-blue-ant);

  &::before {
    transform: translateX(22px);
  }
}

.divider {
  margin: 24px 0;
  padding: 12px 0;
  border-top: 1px solid var(--tf-color-gray-200);

  span {
    color: var(--tf-color-gray-ant-500);
    font-size: 13px;
    font-weight: 500;
  }

  i {
    margin-right: 6px;
  }
}

@media (max-width: 767px) {
  .form-group {
    margin-bottom: 16px;

    > label:not(.switch-label) {
      font-size: 13px;
    }
  }

  .form-control {
    padding: 8px 10px;
    font-size: 13px;
  }

  .radio-group {
    gap: 16px;
  }

  .radio-label {
    font-size: 13px;
  }
}
</style>
