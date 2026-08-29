<template>
  <MobileDialog
    :model-value="modelValue"
    title="设置工资模板"
    width="520px"
    dialog-class="salary-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="employee"
      class="employee-template-form"
    >
      <div
        v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
        class="form-group"
      >
        <label>员工</label>
        <input
          :value="employee.name || employee.username"
          type="text"
          class="form-control"
          disabled
        >
      </div>
      <div
        v-if="canViewField('salary_salaryrecordsview', 'salary_template_name')"
        class="form-group"
      >
        <label>选择模板</label>
        <select
          :value="selectedTemplateId ?? ''"
          class="form-control"
          :disabled="!canEditField('salary_salaryrecordsview', 'salary_template_name')"
          @change="updateSelectedTemplate"
        >
          <option value="">
            请选择工资模板
          </option>
          <option
            v-for="template in templates"
            :key="template.id"
            :value="template.id"
          >
            {{ template.name }} (底薪: ¥{{ template.base_salary }})
          </option>
        </select>
      </div>
      <div
        v-if="selectedTemplateId"
        class="template-preview-box"
      >
        <h4>模板详情</h4>
        <div
          v-if="canViewField('salary_salarytemplatesview', 'template_base_salary')"
          class="preview-row"
        >
          <span class="preview-label">底薪：</span>
          <span class="preview-value">¥{{ getTemplateById(selectedTemplateId)?.base_salary }}</span>
        </div>
        <div
          v-if="canViewField('salary_salarytemplatesview', 'template_commission_type')"
          class="preview-row"
        >
          <span class="preview-label">提成：</span>
          <span class="preview-value">
            <template v-if="getCommissionType(selectedTemplateId) === 'fixed'">
              ¥{{ getCommissionFixed(selectedTemplateId) }}/台
            </template>
            <template v-else>
              利润的{{ getCommissionPercentage(selectedTemplateId) }}%
            </template>
          </span>
        </div>
        <div
          v-if="canViewField('salary_salarytemplatesview', 'template_overtime_hourly_rate')"
          class="preview-row"
        >
          <span class="preview-label">加班费率：</span>
          <span class="preview-value">¥{{ getOvertimeRate(selectedTemplateId) }}/小时</span>
        </div>
        <div
          v-if="canViewField('salary_salarytemplatesview', 'template_rest_days')"
          class="preview-row"
        >
          <span class="preview-label">月休天数：</span>
          <span class="preview-value">{{ getTemplateById(selectedTemplateId)?.rest_days || 0 }}天</span>
        </div>
      </div>
    </div>

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
        :disabled="!canEditField('salary_salaryrecordsview', 'salary_template_name')"
        @click="emit('save')"
      >
        <i class="fas fa-save" />
        保存
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'

interface EmployeeOption {
  name?: string | null
  username?: string | null
}

interface SalaryTemplateOption {
  base_salary?: number | string | null
  id: number
  name: string
  rest_days?: number | null
  [key: string]: unknown
}

defineProps<{
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  employee: EmployeeOption | null
  getCommissionFixed: (_id: number | undefined) => number
  getCommissionPercentage: (_id: number | undefined) => number
  getCommissionType: (_id: number | undefined) => string
  getOvertimeRate: (_id: number | undefined) => number
  getTemplateById: (_id: number | undefined) => SalaryTemplateOption | undefined
  modelValue: boolean
  selectedTemplateId: number | undefined
  templates: SalaryTemplateOption[]
}>()

const emit = defineEmits<{
  save: []
  'update:modelValue': [value: boolean]
  'update:selectedTemplateId': [value: number | undefined]
}>()

const updateSelectedTemplate = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:selectedTemplateId', value ? Number(value) : undefined)
}
</script>

<style lang="scss" scoped>
.employee-template-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.template-preview-box {
  margin-top: 12px;
  padding: 16px;
  border-left: 4px solid var(--tf-color-indigo-brand);
  border-radius: 8px;
  background: linear-gradient(135deg, var(--tf-color-surface-muted) 0%, var(--tf-color-border-muted) 100%);

  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 12px;
    color: var(--tf-color-gray-bootstrap-700);
    font-size: 14px;
    font-weight: 600;

    &::before {
      color: var(--tf-color-indigo-brand);
      font-family: 'Font Awesome 6 Free';
      font-weight: 900;
      content: '\f05a';
    }
  }
}

.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed var(--tf-color-border-subtle);
  font-size: 14px;

  &:last-child {
    border-bottom: 0;
  }
}

.preview-label {
  color: var(--tf-color-muted);
  font-weight: 500;
}

.preview-value {
  color: var(--tf-color-gray-bootstrap-900);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-weight: 600;
}

@media (max-width: 767px) {
  .employee-template-form {
    gap: 12px;
  }

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

  .template-preview-box {
    padding: 12px;
  }

  .preview-row {
    padding: 6px 0;
    font-size: 13px;
  }
}
</style>
