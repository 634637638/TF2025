<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    :label-width="isMobile ? '80px' : labelWidth"
    :label-position="isMobile ? 'top' : labelPosition"
    :size="isMobile ? 'large' : size"
    class="mobile-form"
    :class="{ 'mobile-layout': isMobile }"
  >
    <div
      v-for="(field, index) in fields"
      :key="field.prop || index"
      class="form-field-wrapper"
      :class="getFieldWrapperClass(field)"
    >
      <!-- 字段标题 -->
      <div
        v-if="field.title && !isMobile"
        class="field-title"
        :class="{ 'required': field.required }"
      >
        {{ field.title }}
      </div>

      <!-- 表单项 -->
      <el-form-item
        :prop="field.prop"
        :label="field.label"
        :required="field.required"
        :error="field.error"
        class="mobile-form-item"
        :class="getFieldClass(field)"
      >
        <!-- 输入框 -->
        <el-input
          v-if="field.type === 'input' || field.type === 'text' || field.type === 'password'"
          v-model="formData[field.prop]"
          :type="field.type || 'text'"
          :placeholder="field.placeholder || `请输入${field.label}`"
          :disabled="field.disabled"
          :readonly="field.readonly"
          :clearable="field.clearable !== false"
          :maxlength="field.maxlength"
          :show-word-limit="field.showWordLimit"
          :prefix-icon="field.prefixIcon"
          :suffix-icon="field.suffixIcon"
          :rows="field.rows"
          :autosize="field.autosize"
          resize="none"
          @blur="handleFieldBlur(field)"
          @focus="handleFieldFocus(field)"
        />

        <!-- 数字输入框 -->
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="formData[field.prop]"
          :placeholder="field.placeholder || `请输入${field.label}`"
          :disabled="field.disabled"
          :min="field.min"
          :max="field.max"
          :step="field.step || 1"
          :precision="field.precision"
          :controls-position="field.controlsPosition || 'right'"
          style="width: 100%"
        />

        <!-- 选择器 -->
        <el-select
          v-else-if="field.type === 'select'"
          v-model="formData[field.prop]"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          :clearable="field.clearable !== false"
          :multiple="field.multiple"
          :filterable="field.filterable !== false"
          :remote="field.remote"
          :remote-method="field.remoteMethod"
          :loading="field.loading"
          style="width: 100%"
        >
          <el-option
            v-for="option in field.options"
            :key="option.value"
            :label="option.label"
            :value="option.value"
            :disabled="option.disabled"
          />
        </el-select>

        <!-- 日期选择器 -->
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="formData[field.prop]"
          :type="field.dateType || 'date'"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          :clearable="field.clearable !== false"
          :format="field.format"
          :value-format="field.valueFormat"
          style="width: 100%"
        />

        <!-- 日期时间选择器 -->
        <el-date-picker
          v-else-if="field.type === 'datetime'"
          v-model="formData[field.prop]"
          type="datetime"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          :clearable="field.clearable !== false"
          :format="field.format || 'YYYY-MM-DD HH:mm:ss'"
          :value-format="field.valueFormat || 'YYYY-MM-DD HH:mm:ss'"
          style="width: 100%"
        />

        <!-- 时间选择器 -->
        <el-time-picker
          v-else-if="field.type === 'time'"
          v-model="formData[field.prop]"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          :clearable="field.clearable !== false"
          :format="field.format"
          :value-format="field.valueFormat"
          style="width: 100%"
        />

        <!-- 开关 -->
        <el-switch
          v-else-if="field.type === 'switch'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :active-text="field.activeText"
          :inactive-text="field.inactiveText"
          :active-value="field.activeValue !== undefined ? field.activeValue : true"
          :inactive-value="field.inactiveValue !== undefined ? field.inactiveValue : false"
        />

        <!-- 单选框组 -->
        <el-radio-group
          v-else-if="field.type === 'radio'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :direction="isMobile ? 'vertical' : 'horizontal'"
        >
          <el-radio
            v-for="option in field.options"
            :key="option.value"
            :label="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </el-radio>
        </el-radio-group>

        <!-- 复选框组 -->
        <el-checkbox-group
          v-else-if="field.type === 'checkbox'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :direction="isMobile ? 'vertical' : 'horizontal'"
        >
          <el-checkbox
            v-for="option in field.options"
            :key="option.value"
            :label="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </el-checkbox>
        </el-checkbox-group>

        <!-- 滑块 -->
        <el-slider
          v-else-if="field.type === 'slider'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :min="field.min || 0"
          :max="field.max || 100"
          :step="field.step || 1"
          :show-input="field.showInput"
          :range="field.range"
        />

        <!-- 评分 -->
        <el-rate
          v-else-if="field.type === 'rate'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :max="field.max || 5"
          :allow-half="field.allowHalf"
          :show-text="field.showText"
          :texts="field.texts"
        />

        <!-- 颜色选择器 -->
        <el-color-picker
          v-else-if="field.type === 'color'"
          v-model="formData[field.prop]"
          :disabled="field.disabled"
          :show-alpha="field.showAlpha"
          :predefine="field.predefine"
        />

        <!-- 上传 -->
        <el-upload
          v-else-if="field.type === 'upload'"
          :action="field.action"
          :headers="field.headers"
          :data="field.data"
          :name="field.name"
          :with-credentials="field.withCredentials"
          :multiple="field.multiple"
          :accept="field.accept"
          :limit="field.limit"
          :file-list="formData[field.prop]"
          :disabled="field.disabled"
          :list-type="field.listType || 'text'"
          :auto-upload="field.autoUpload !== false"
          @success="(...args) => handleUploadSuccess(field, ...args)"
          @error="(...args) => handleUploadError(field, ...args)"
          @change="(...args) => handleUploadChange(field, ...args)"
        >
          <el-button
            v-if="field.listType !== 'picture-card'"
            type="primary"
            :icon="field.uploadIcon || 'Plus'"
          >
            {{ field.uploadText || '上传文件' }}
          </el-button>
          <div v-else class="upload-trigger">
            <el-icon><Plus /></el-icon>
          </div>
        </el-upload>

        <!-- 自定义插槽 -->
        <slot
          v-else-if="field.type === 'slot'"
          :name="field.prop"
          :field="field"
          :value="formData[field.prop]"
          :disabled="field.disabled"
          @update:value="val => formData[field.prop] = val"
        />

        <!-- 提示信息 -->
        <div
          v-if="field.tip"
          class="field-tip"
          :class="{ 'error-tip': field.error }"
        >
          {{ field.tip }}
        </div>
      </el-form-item>
    </div>

    <!-- 表单操作按钮 -->
    <div class="form-actions" :class="getActionsClass()">
      <slot name="actions">
        <el-button
          v-if="showCancel"
          :size="isMobile ? 'large' : 'default'"
          @click="handleCancel"
        >
          {{ cancelText }}
        </el-button>
        <el-button
          type="primary"
          :size="isMobile ? 'large' : 'default'"
          :loading="loading"
          @click="handleSubmit"
        >
          {{ submitText }}
        </el-button>
      </slot>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMobile } from '@/composables/mobile'
import type { FormInstance, FormRules, UploadFile, UploadFiles } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { CancelEmits } from '@/types/component'

type FormModelValue = Record<string, unknown>
type FormFieldOptionValue = string | number | boolean | null

interface FormFieldOption {
  label: string
  value: FormFieldOptionValue
  disabled?: boolean
}

interface FormFieldUploadResponse {
  [key: string]: unknown
}

// 字段配置接口
interface FormField {
  prop: string
  label: string
  type: string
  title?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  clearable?: boolean
  error?: string
  tip?: string

  // 输入框特有
  maxlength?: number
  showWordLimit?: boolean
  prefixIcon?: string
  suffixIcon?: string
  rows?: number
  autosize?: boolean

  // 数字输入框特有
  min?: number
  max?: number
  step?: number
  precision?: number
  controlsPosition?: 'left' | 'right'

  // 选择器特有
  options?: FormFieldOption[]
  multiple?: boolean
  filterable?: boolean
  remote?: boolean
  remoteMethod?: (query: string) => void
  loading?: boolean

  // 日期选择器特有
  dateType?: string
  format?: string
  valueFormat?: string

  // 开关特有
  activeText?: string
  inactiveText?: string
  activeValue?: FormFieldOptionValue
  inactiveValue?: FormFieldOptionValue

  // 滑块特有
  showInput?: boolean
  range?: boolean

  // 评分特有
  maxRating?: number
  allowHalf?: boolean
  showText?: boolean
  texts?: string[]

  // 颜色选择器特有
  showAlpha?: boolean
  predefine?: string[]

  // 上传特有
  action?: string
  headers?: Record<string, string>
  data?: Record<string, unknown>
  name?: string
  withCredentials?: boolean
  accept?: string
  limit?: number
  listType?: 'text' | 'picture' | 'picture-card'
  autoUpload?: boolean
  uploadIcon?: string
  uploadText?: string

  // 布局
  span?: number
  offset?: number
  push?: number
  pull?: number
  xs?: number | { span?: number; offset?: number }
  sm?: number | { span?: number; offset?: number }
  md?: number | { span?: number; offset?: number }
  lg?: number | { span?: number; offset?: number }
  xl?: number | { span?: number; offset?: number }
}

interface Props {
  modelValue: FormModelValue
  fields: FormField[]
  rules?: FormRules
  loading?: boolean
  labelWidth?: string
  labelPosition?: 'left' | 'right' | 'top'
  size?: 'large' | 'default' | 'small'
  showCancel?: boolean
  submitText?: string
  cancelText?: string
  validateOnRuleChange?: boolean
  scrollToError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  rules: () => ({}),
  loading: false,
  labelWidth: '120px',
  labelPosition: 'right',
  size: 'default',
  showCancel: true,
  submitText: '提交',
  cancelText: '取消',
  validateOnRuleChange: true,
  scrollToError: true
})

interface Emits extends CancelEmits {
  'update:modelValue': [value: FormModelValue]
  submit: [value: FormModelValue]
  fieldBlur: [field: FormField, value: unknown]
  fieldFocus: [field: FormField, value: unknown]
  uploadSuccess: [field: FormField, response: FormFieldUploadResponse]
  uploadError: [field: FormField, error: Error]
  uploadChange: [field: FormField, file: UploadFile, fileList: UploadFiles]
}

const emit = defineEmits<Emits>()

// 使用移动端检测
const { isMobile } = useMobile()

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 获取字段包装器类名
const getFieldWrapperClass = (field: FormField) => {
  const classes = []

  // 响应式布局
  if (field.span || field.xs || field.sm || field.md || field.lg || field.xl) {
    classes.push('responsive-field')
  }

  // 移动端全宽
  if (isMobile.value) {
    classes.push('mobile-full-width')
  }

  return classes
}

// 获取字段类名
const getFieldClass = (field: FormField) => {
  const classes = []

  if (field.type === 'upload' && field.listType === 'picture-card') {
    classes.push('upload-field')
  }

  return classes
}

// 获取操作按钮类名
const getActionsClass = () => {
  const classes = ['form-actions-container']

  if (isMobile.value) {
    classes.push('mobile-actions')
  }

  return classes
}

// 处理字段失焦
const handleFieldBlur = (field: FormField) => {
  emit('fieldBlur', field, formData.value[field.prop])
}

// 处理字段聚焦
const handleFieldFocus = (field: FormField) => {
  emit('fieldFocus', field, formData.value[field.prop])
}

// 处理上传成功
const handleUploadSuccess = (
  field: FormField,
  response: FormFieldUploadResponse,
  _uploadFile: UploadFile,
  _uploadFiles: UploadFiles
) => {
  emit('uploadSuccess', field, response)
}

// 处理上传失败
const handleUploadError = (
  field: FormField,
  error: Error,
  _uploadFile: UploadFile,
  _uploadFiles: UploadFiles
) => {
  emit('uploadError', field, error)
}

// 处理上传变化
const handleUploadChange = (field: FormField, file: UploadFile, fileList: UploadFiles) => {
  formData.value[field.prop] = fileList
  emit('uploadChange', field, file, fileList)
}

// 处理提交
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    emit('submit', formData.value)
  } catch (error) {
    if (props.scrollToError && formRef.value) {
      // 滚动到第一个错误字段
      const firstError = document.querySelector('.el-form-item__error')
      if (firstError) {
        firstError.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }
}

// 处理取消
const handleCancel = () => {
  emit('cancel')
}

// 重置表单
const resetFields = () => {
  formRef.value?.resetFields()
}

// 验证表单
const validate = () => {
  return formRef.value?.validate()
}

// 验证特定字段
const validateField = (prop: string) => {
  return formRef.value?.validateField(prop)
}

// 清除验证
const clearValidate = (props?: string | string[]) => {
  formRef.value?.clearValidate(props)
}

// 暴露方法
defineExpose({
  formRef,
  resetFields,
  validate,
  validateField,
  clearValidate
})
</script>

<style lang="scss" scoped>
.mobile-form {
  width: 100%;

  &.mobile-layout {
    .field-title {
      display: none;
    }

    .mobile-form-item {
      margin-bottom: 20px;

      :deep(.el-form-item__label) {
        font-weight: 600;
        padding-bottom: 8px;
        line-height: 1.4;
      }

      :deep(.el-form-item__content) {
        .el-input,
        .el-select,
        .el-date-picker,
        .el-time-picker {
          width: 100%;
        }

        .el-input__inner,
        .el-textarea__inner {
          min-height: 44px;
          font-size: 16px; /* 防止iOS自动缩放 */
        }

        .el-input-number {
          width: 100%;

          .el-input__inner {
            text-align: center;
          }
        }
      }
    }
  }
}

.form-field-wrapper {
  &.mobile-full-width {
    width: 100%;
  }
}

.field-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-light);

  &.required::before {
    content: '*';
    color: var(--el-color-danger);
    margin-right: 4px;
  }
}

.mobile-form-item {
  :deep(.el-form-item__label) {
    &.required::before {
      content: '*';
      color: var(--el-color-danger);
      margin-right: 4px;
    }
  }

  &.upload-field {
    :deep(.el-form-item__content) {
      line-height: 1;
    }
  }
}

.field-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);

  &.error-tip {
    color: var(--el-color-danger);
  }
}

.form-actions-container {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);

  &.mobile-actions {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 16px 0;
    margin: 20px -16px -16px;
    padding: 16px;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);

    .el-button {
      flex: 1;
      min-height: 44px;
      font-size: 16px;
    }
  }
}

.upload-trigger {
  width: 80px;
  height: 80px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  .el-icon {
    font-size: 24px;
  }
}

/* 响应式布局 */
.responsive-field {
  @media (min-width: 768px) {
    display: inline-block;
    vertical-align: top;
  }
}

/* 响应式栅格 */
@for $breakpoint in (xs, sm, md, lg, xl) {
  @media (min-width: map-get((xs: 0, sm: 576, md: 768, lg: 992, xl: 1200), $breakpoint)) {
    @for $span from 1 through 24 {
      .responsive-field[class*="#{$breakpoint}-#{$span}"] {
        flex: 0 0 percentage($span / 24);
        max-width: percentage($span / 24);
      }
    }

    @for $offset from 1 through 23 {
      .responsive-field[class*="#{$breakpoint}-offset-#{$offset}"] {
        margin-left: percentage($offset / 24);
      }
    }
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .mobile-form {
    .form-field-wrapper {
      margin-bottom: 0;
    }

    .field-tip {
      font-size: 13px;
    }

    .form-actions-container {
      margin-top: 24px;
    }
  }
}
</style>
