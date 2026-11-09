<template>
  <MobileDialog
    v-model="dialogVisible"
    title="退库操作"
    :force-fullscreen="isMobile"
    :show-default-footer="false"
    confirm-text="确认退库"
    width="680px"
    max-width="680px"
    dialog-class="query-return-stock-dialog"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #footer>
      <div class="tf-dialog-actions return-dialog-footer">
        <el-button
          :disabled="submitting"
          @click="handleCancel"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          确认退库
        </el-button>
      </div>
    </template>

    <div
      v-if="deviceInfo"
      class="device-info-card"
    >
      <div class="info-title">
        <i class="fas fa-mobile-alt" />
        设备信息
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">供应商</span>
          <span class="value">{{ deviceInfo.supplier_name || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">品牌</span>
          <span class="value">{{ deviceInfo.brand || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">型号</span>
          <span class="value">{{ deviceInfo.model || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">成色</span>
          <span :class="['condition-badge', normalizedIsNew ? 'new' : 'used']">
            {{ normalizedIsNew ? '全新' : '二手' }}
          </span>
        </div>
        <div class="info-item">
          <span class="label">颜色</span>
          <span class="value">{{ deviceInfo.color || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">内存</span>
          <span class="value">{{ deviceInfo.memory || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">序列号</span>
          <span class="value mono">{{ deviceInfo.serial_number || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="label">IMEI</span>
          <span class="value mono imei">{{ deviceInfo.imei || '-' }}</span>
        </div>
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="return-form"
    >
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-undo-alt" />
          退库信息
        </div>

        <div class="form-grid">
          <el-form-item
            label="退库原因"
            prop="return_reason"
          >
            <el-select
              v-model="formData.return_reason"
              placeholder="请选择退库原因"
              teleported
              popper-class="tf2025-form-popper"
            >
              <el-option
                v-for="option in RETURN_STOCK_OPTIONS.return_reason"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="退库时间"
            prop="reversal_date"
          >
            <el-date-picker
              v-model="formData.reversal_date"
              type="datetime"
              placeholder="请选择退库时间"
              :format="TIME_FORMATS.DATETIME_MINUTE"
              :value-format="TIME_FORMATS.DATETIME_LOCAL"
              teleported
              popper-class="tf2025-form-popper"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item
            label="退库类型"
            prop="return_type"
          >
            <el-select
              v-model="formData.return_type"
              placeholder="请选择退库类型"
              teleported
              popper-class="tf2025-form-popper"
            >
              <el-option
                v-for="option in RETURN_STOCK_OPTIONS.return_type"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="处理方式"
            prop="handle_method"
          >
            <el-select
              v-model="formData.handle_method"
              placeholder="请选择处理方式"
              teleported
              popper-class="tf2025-form-popper"
            >
              <el-option
                v-for="option in RETURN_STOCK_OPTIONS.handle_method"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="退款金额"
            prop="refund_amount"
          >
            <el-input-number
              v-model="formData.refund_amount"
              :min="0"
              :max="99999999.99"
              :precision="2"
              :step="100"
              :controls="false"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item
            label="退款方式"
            prop="refund_method"
          >
            <PaymentMethodSelect
              v-model="formData.refund_method"
              variant="refund"
              placeholder="请选择退款方式"
              clearable
              teleported
              popper-class="tf2025-form-popper"
              @update:model-value="formData.refund_channel = null"
            />
          </el-form-item>

          <el-form-item
            v-if="hasPaymentChannelOptions(formData.refund_method)"
            label="退款渠道"
            prop="refund_channel"
          >
            <PaymentChannelSelect
              v-model="formData.refund_channel"
              :payment-method="formData.refund_method"
              placeholder="请选择退款渠道"
              teleported
              popper-class="tf2025-form-popper"
            />
          </el-form-item>

          <el-form-item
            class="full-width"
            label="备注"
          >
            <el-input
              v-model="formData.remarks"
              class="tf-textarea"
              type="textarea"
              :rows="2"
              maxlength="200"
              show-word-limit
              placeholder="请输入退库备注信息"
            />
          </el-form-item>
        </div>
      </div>
    </el-form>

    <div class="return-warning">
      <i class="fas fa-exclamation-triangle" />
      <div class="warning-content">
        <strong>操作提示：</strong>
        退库商品原来有计算积分退库后会倒扣。
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { TIME_FORMATS } from '@/utils/time'
import { computed, reactive, ref, watch } from 'vue'

import type { FormInstance, FormRules } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { TimeUtil } from '@/utils/time'
import MobileDialog from '@/components/MobileDialog.vue'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import type { ReturnStockDetails } from '@/types/return-stock'
import { PaymentMethodSelect, PaymentChannelSelect } from '@/components/payment'
import { hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { ModelValueProps, ReturnDeviceInfo as DeviceInfo, SuccessEmits, UpdateModelValueEmits } from '@/types'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


interface Props extends ModelValueProps {
  deviceInfo?: DeviceInfo | null
}

const props = withDefaults(defineProps<Props>(), {
  deviceInfo: null
})

const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()
const { isMobile } = useMobile()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formRef = ref<FormInstance>()
const submitting = ref(false)

const createDefaultFormData = (): ReturnStockDetails => ({
  return_reason: '',
  return_type: '',
  handle_method: '',
  refund_amount: 0,
  refund_method: '',
  refund_channel: null,
  remarks: '',
  reversal_date: TimeUtil.nowFormatted('DATETIME_LOCAL')
})

const formData = reactive(createDefaultFormData())

const formRules: FormRules = {
  return_reason: [{ required: true, message: '请选择退库原因', trigger: 'change' }],
  return_type: [{ required: true, message: '请选择退库类型', trigger: 'change' }],
  handle_method: [{ required: true, message: '请选择处理方式', trigger: 'change' }],
  reversal_date: [{ required: true, message: '请选择退库时间', trigger: 'change' }],
  refund_method: [{ required: true, message: '请选择退款方式', trigger: 'change' }],
  refund_channel: [{ required: true, message: '请选择退款渠道', trigger: 'change' }],
  refund_amount: [{ required: true, message: '请填写退款金额，未退款时填写0', trigger: 'change' }]
}

const normalizedIsNew = computed(() => {
  return props.deviceInfo?.is_new === 1 || props.deviceInfo?.is_new === '1'
})

const resetForm = () => {
  Object.assign(formData, createDefaultFormData())
  formRef.value?.clearValidate()
}

const handleCancel = () => {
  resetForm()
  dialogVisible.value = false
}

const handleSubmit = async () => {
  if (submitting.value) return
  if (!formRef.value || !props.deviceInfo?.id) return

  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true

    const response = await unifiedApi.post(`/query/${props.deviceInfo.id}/return-to-stock`, {
      return_reason: formData.return_reason,
      return_type: formData.return_type,
      handle_method: formData.handle_method,
      refund_amount: formData.refund_amount,
      refund_method: formData.refund_method,
      refund_channel: hasPaymentChannelOptions(formData.refund_method) ? formData.refund_channel : null,
      reversal_date: formData.reversal_date,
      remarks: formData.remarks || ''
    })

    if (!response.success) {
      throw new Error(response.message || '退库失败，请重试')
    }

    globalNotifications.success('退库成功！')
    emit('success')
    handleCancel()
  } catch (error: unknown) {
    logger.error('退库失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '退库失败，请重试'))
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetForm()
    }
  }
)
</script>

<style lang="scss" scoped>
:global(.query-return-stock-dialog) {
  --dialog-side-gap: 2px;
  --dialog-vertical-gap: 4px;
  --dialog-max-width: calc(100vw - 4px);
  --mobile-dialog-body-padding: 8px 6px 8px;
  --mobile-dialog-footer-padding: 0 6px 6px;
  --tf-dialog-surface: var(--color-bg-white);
  --tf-dialog-footer-bg: var(--color-bg-white);
}

:global(.query-return-stock-dialog.mobile-dialog-sheet-overlay) {
  background: rgba(15, 23, 42, 0.42) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

:global(.query-return-stock-dialog.mobile-dialog-sheet-panel) {
  border-radius: 28px !important;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24) !important;
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-header) {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%) !important;
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-title) {
  font-size: var(--tf-type-scale-16);
  font-weight: 700;
  line-height: 1.3;
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-close) {
  right: 16px;
  transform: none;
}

.device-info-card {
  background: linear-gradient(180deg, var(--tf-color-slate-50) 0%, var(--color-bg-white) 100%);
  border: 1px solid var(--tf-color-slate-200);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
}

.info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--tf-type-scale-14);
  font-weight: 700;
  color: var(--tf-color-slate-700);
  margin-bottom: 14px;

  i {
    color: var(--tf-color-blue-600);
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  &.full-width {
    grid-column: 1 / -1;
  }
}

.label {
  flex-shrink: 0;
  min-width: 52px;
  font-size: var(--tf-type-scale-12);
  color: var(--tf-color-slate-500);
  font-weight: 600;
}

.value {
  min-width: 0;
  color: var(--tf-color-slate-900);
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  word-break: break-all;

  &.mono {
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  }

  &.imei {
    color: var(--tf-color-red-600);
    font-weight: 700;
  }
}

.condition-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--tf-type-scale-12);
  font-weight: 700;

  &.new {
    background: var(--tf-color-green-100);
    color: var(--tf-color-success-text-strong);
  }

  &.used {
    background: var(--tf-color-amber-100);
    color: var(--tf-color-amber-800);
  }
}

.return-form {
  padding: 0;
}

.form-section {
  margin-bottom: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--tf-type-scale-16);
  font-weight: 700;
  color: var(--tf-color-slate-900);
  margin-bottom: 16px;

  i {
    color: var(--tf-color-amber-500);
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.full-width {
  grid-column: 1 / -1;
}

.return-warning {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--tf-color-orange-50) 0%, var(--tf-color-rose-50) 100%);
  border: 1px solid var(--tf-color-orange-tailwind-200);
  border-radius: 12px;
  color: var(--tf-color-orange-tailwind-700);
  font-size: var(--tf-type-scale-13);
  margin-top: 8px;

  i {
    font-size: var(--tf-type-scale-16);
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.warning-content {
  flex: 1;
  line-height: 1.6;

  strong {
    margin-right: 6px;
  }
}

@media (max-width: 767px) {
  :global(.query-return-stock-dialog) {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 6px 4px 6px;
    --mobile-dialog-footer-padding: 0 4px 4px;
  }

  :global(.query-return-stock-dialog.mobile-dialog-sheet-panel) {
    border-radius: 24px !important;
  }

  .device-info-card {
    padding: 14px;
  }

  .info-grid,
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
  }

  .label {
    min-width: 48px;
  }

}

@media (max-width: 479px) {
  :global(.query-return-stock-dialog .mobile-dialog-sheet-close) {
    right: 14px;
  }

  .info-grid,
  .form-grid {
    gap: 8px;
  }

  .device-info-card {
    padding: 12px;
  }
}
</style>
