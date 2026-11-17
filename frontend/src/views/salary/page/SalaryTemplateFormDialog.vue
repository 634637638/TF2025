<template>
  <MobileDialog
    :model-value="modelValue"
    :title="form.id ? '编辑工资模板' : '新增工资模板'"
    dialog-class="salary-dialog crud-dialog-lg"
    :show-default-footer="false"
    :close-on-click-modal="false"
    :before-close="beforeClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form
      id="template-form"
      ref="formRef"
      :model="form"
      :rules="rules"
      :disabled="saving"
      class="tf-form-layout tf-dialog-form tf-dialog-form--stacked"
      label-position="top"
      @submit.prevent="submit"
    >
      <el-form-item
        v-if="view('template_name')"
        label="模板名称"
        prop="name"
      >
        <el-input
          v-model="name"
          placeholder="请输入模板名称"
          :disabled="!edit('template_name')"
        />
      </el-form-item>
      <el-form-item
        v-if="view('template_description')"
        class="tf-form-field--wide"
        label="说明"
        prop="description"
      >
        <el-input
          v-model="description"
          class="tf-textarea"
          type="textarea"
          :rows="2"
          :disabled="!edit('template_description')"
        />
      </el-form-item>
      <div class="tf-form-row tf-form-row--three">
        <el-form-item
          v-if="view('template_base_salary')"
          label="底薪（元）"
          prop="base_salary"
        >
          <AmountInput
            v-model="baseSalary"
            :min="0"
            :disabled="!edit('template_base_salary')"
          />
        </el-form-item>
        <el-form-item
          v-if="view('template_overtime_hourly_rate')"
          label="加班费（元/小时）"
          prop="overtime_hourly_rate"
        >
          <AmountInput
            v-model="overtimeHourlyRate"
            :min="0"
            :disabled="!edit('template_overtime_hourly_rate')"
          />
        </el-form-item>
        <el-form-item
          v-if="view('template_rest_days')"
          label="月休天数"
          prop="rest_days"
        >
          <el-input-number
            v-model="restDays"
            :min="0"
            :max="31"
            :precision="0"
            :controls="false"
            :disabled="!edit('template_rest_days')"
          />
        </el-form-item>
      </div>
      <el-divider
        v-if="showPhoneSection"
        content-position="left"
      >
        手机提成
      </el-divider>
      <div class="tf-form-row tf-form-row--mobile-single">
        <el-form-item
          v-if="view('template_commission_type')"
          label="手机提成方式"
          prop="commission_type"
        >
          <el-radio-group
            v-model="commissionType"
            class="tf-state-selector"
            :disabled="!edit('template_commission_type')"
          >
            <el-radio value="fixed">
              固定金额
            </el-radio>
            <el-radio value="percentage">
              利润百分比
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
      <div class="tf-form-row">
        <template v-if="form.commission_type === 'fixed'">
          <el-form-item
            v-if="view('template_commission_new_fixed')"
            label="全新机提成（元/台）"
            prop="commission_new_fixed"
          >
            <AmountInput
              v-model="commissionNewFixed"
              :min="0"
              :disabled="!edit('template_commission_new_fixed')"
            />
          </el-form-item>
          <el-form-item
            v-if="view('template_commission_used_fixed')"
            label="二手机提成（元/台）"
            prop="commission_used_fixed"
          >
            <AmountInput
              v-model="commissionUsedFixed"
              :min="0"
              :disabled="!edit('template_commission_used_fixed')"
            />
          </el-form-item>
        </template>
        <el-form-item
          v-else-if="view('template_commission_percentage')"
          label="手机利润提成（%）"
          prop="commission_percentage"
        >
          <el-input-number
            v-model="commissionPercentage"
            :step="0.01"
            :min="0"
            :max="100"
            :precision="2"
            :controls="false"
            :disabled="!edit('template_commission_percentage')"
          />
        </el-form-item>
      </div>
      <template v-if="view('template_goods_commission_rule')">
        <el-divider content-position="left">
          商品提成
        </el-divider>
        <el-form-item
          label="启用商品提成"
          prop="goods_commission_rule"
        >
          <el-switch
            v-model="goodsEnabled"
            aria-label="启用商品提成"
            :disabled="!edit('template_goods_commission_rule')"
          />
        </el-form-item>
        <template v-if="form.goods_commission_rule.enabled">
          <div class="tf-form-row tf-form-row--mobile-single">
            <el-form-item label="商品提成方式">
              <el-radio-group
                v-model="goodsType"
                class="tf-state-selector"
                :disabled="!edit('template_goods_commission_rule')"
              >
                <el-radio value="fixed">
                  按件固定金额
                </el-radio>
                <el-radio value="percentage">
                  按利润比例
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <div class="tf-form-row">
            <el-form-item
              v-if="form.goods_commission_rule.type === 'fixed'"
              label="商品提成（元/件）"
            >
              <AmountInput
                v-model="goodsFixed"
                :min="0"
                :disabled="!edit('template_goods_commission_rule')"
              />
            </el-form-item>
            <el-form-item
              v-else
              label="商品利润提成（%）"
            >
              <el-input-number
                v-model="goodsPercentage"
                :step="0.01"
                :min="0"
                :max="100"
                :precision="2"
                :controls="false"
                :disabled="!edit('template_goods_commission_rule')"
              />
            </el-form-item>
          </div>
        </template>
        <el-text type="info">
          仅正毛利商品计提；赠品、积分抵扣商品及成本未知商品不计提。调整规则不追改历史成交。
        </el-text>
      </template>
      <el-divider
        v-if="showAutoRaiseSection"
        content-position="left"
      >
        自动涨薪规则
      </el-divider>
      <div class="tf-form-row">
        <el-form-item
          v-if="view('template_auto_raise_enabled')"
          label="自动涨薪"
        >
          <el-switch
            v-model="autoRaiseEnabled"
            aria-label="自动涨薪"
            :disabled="!edit('template_auto_raise_enabled')"
          />
        </el-form-item>
        <template v-if="form.auto_raise_enabled && view('template_auto_raise_enabled')">
          <el-form-item
            v-if="view('template_auto_raise_months')"
            label="涨薪周期（月）"
          >
            <el-input-number
              v-model="autoRaiseMonths"
              :min="1"
              :max="60"
              :precision="0"
              :controls="false"
              :disabled="!edit('template_auto_raise_months')"
            />
          </el-form-item>
          <el-form-item
            v-if="view('template_auto_raise_amount')"
            label="涨薪金额（元）"
          >
            <AmountInput
              v-model="autoRaiseAmount"
              :min="0"
              :disabled="!edit('template_auto_raise_amount')"
            />
          </el-form-item>
          <el-form-item
            v-if="view('template_auto_raise_max_salary')"
            label="最高底薪（元）"
          >
            <AmountInput
              v-model="autoRaiseMaxSalary"
              :min="0"
              :disabled="!edit('template_auto_raise_max_salary')"
            />
          </el-form-item>
        </template>
      </div>
    </el-form>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          type="info"
          :disabled="saving"
          @click="close"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          form="template-form"
          :disabled="saving"
          :loading="saving"
        >
          {{ saving ? '保存中...' : '保存' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { SalaryGoodsCommissionRule, SalaryTemplateForm } from '@/types/salary'
import { isSalaryGoodsCommissionRule } from '../salary-template-form'

export type { SalaryTemplateForm } from '@/types/salary'
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
const formRef = ref<FormInstance>()
const view = (field: string) => props.canViewField('salary_salarytemplatesview', field)
const raiseFields = ['template_auto_raise_enabled', 'template_auto_raise_months', 'template_auto_raise_amount', 'template_auto_raise_max_salary']
const edit = (field: string): boolean => !props.saving && view(field) && props.canEditField('salary_salarytemplatesview', field) &&
  (!raiseFields.includes(field) || raiseFields.every(key => view(key) && props.canEditField('salary_salarytemplatesview', key)))
const createFieldModel = <K extends keyof SalaryTemplateForm>(key: K) => computed({
  get: () => props.form[key],
  set: (value: SalaryTemplateForm[K]) => emit('update:form', { ...props.form, [key]: value })
})
const createGoodsModel = <K extends keyof SalaryGoodsCommissionRule>(key: K) => computed({
  get: () => props.form.goods_commission_rule[key],
  set: (value: SalaryGoodsCommissionRule[K]) => emit('update:form', {
    ...props.form, goods_commission_rule: { ...props.form.goods_commission_rule, [key]: value }
  })
})
const name = createFieldModel('name'), description = createFieldModel('description'), baseSalary = createFieldModel('base_salary')
const commissionType = createFieldModel('commission_type'), commissionNewFixed = createFieldModel('commission_new_fixed')
const commissionUsedFixed = createFieldModel('commission_used_fixed'), commissionPercentage = createFieldModel('commission_percentage')
const overtimeHourlyRate = createFieldModel('overtime_hourly_rate'), restDays = createFieldModel('rest_days')
const autoRaiseEnabled = createFieldModel('auto_raise_enabled'), autoRaiseMonths = createFieldModel('auto_raise_months')
const autoRaiseAmount = createFieldModel('auto_raise_amount'), autoRaiseMaxSalary = createFieldModel('auto_raise_max_salary')
const goodsEnabled = createGoodsModel('enabled'), goodsType = createGoodsModel('type')
const goodsFixed = createGoodsModel('fixed_amount'), goodsPercentage = createGoodsModel('percentage')
const showPhoneSection = computed(() => ['template_commission_type', 'template_commission_new_fixed',
  'template_commission_used_fixed', 'template_commission_percentage'].some(view))
const showAutoRaiseSection = computed(() => ['template_auto_raise_enabled', 'template_auto_raise_months',
  'template_auto_raise_amount', 'template_auto_raise_max_salary'].some(view))
const rules: FormRules<SalaryTemplateForm> = {
  name: [{ required: true, whitespace: true, message: '请输入模板名称', trigger: 'blur' }],
  goods_commission_rule: [{ validator: (_rule, value: unknown, callback) => callback(isSalaryGoodsCommissionRule(value)
    ? undefined : new Error('商品提成规则须为非负金额及0至100的比例，最多两位小数')) }]
}
const submit = async () => {
  if (props.saving || !formRef.value) return
  try { await formRef.value.validate() } catch { return }
  emit('submit')
}
const close = () => { if (!props.saving) emit('update:modelValue', false) }
const beforeClose = (done: () => void) => { if (!props.saving) done() }
</script>
