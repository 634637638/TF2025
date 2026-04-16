<template>
  <MobileDialog
    v-model="dialogVisible"
    title="退库操作"
    :force-fullscreen="isMobile"
    :show-default-footer="false"
    :loading="submitting"
    confirm-text="确认退库"
    width="680px"
    max-width="680px"
    dialog-class="query-return-stock-dialog"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #footer>
      <div class="return-dialog-footer">
        <el-button @click="handleCancel" :disabled="submitting">
          取消
        </el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确认退库
        </el-button>
      </div>
    </template>

    <div v-if="deviceInfo" class="device-info-card">
      <div class="info-title">
        <i class="fas fa-mobile-alt"></i>
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
          <span class="label">机况</span>
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
        <div class="info-item full-width">
          <span class="label">序列号</span>
          <span class="value mono">{{ deviceInfo.serial_number || '-' }}</span>
        </div>
        <div class="info-item full-width">
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
          <i class="fas fa-undo-alt"></i>
          退库信息
        </div>

        <div class="form-grid">
          <el-form-item label="退库原因" prop="return_reason">
            <el-select
              v-model="formData.return_reason"
              placeholder="请选择退库原因"
              teleported
              popper-class="query-return-stock-dialog-popper"
            >
              <el-option label="客户退货" value="客户退货" />
              <el-option label="质量问题" value="质量问题" />
              <el-option label="性能不达标" value="性能不达标" />
              <el-option label="外观瑕疵" value="外观瑕疵" />
              <el-option label="功能故障" value="功能故障" />
              <el-option label="配件缺失" value="配件缺失" />
              <el-option label="其他原因" value="其他原因" />
            </el-select>
          </el-form-item>

          <el-form-item label="退库时间" prop="return_date">
            <el-date-picker
              v-model="formData.return_date"
              type="datetime"
              placeholder="请选择退库时间"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DDTHH:mm"
              teleported
              popper-class="query-return-stock-dialog-popper"
              style="width: 180px"
            />
          </el-form-item>

          <el-form-item label="退库类型" prop="return_type">
            <el-select
              v-model="formData.return_type"
              placeholder="请选择退库类型"
              teleported
              popper-class="query-return-stock-dialog-popper"
            >
              <el-option label="整单退库" value="整单退库" />
              <el-option label="部分退库" value="部分退库" />
              <el-option label="换货" value="换货" />
            </el-select>
          </el-form-item>

          <el-form-item label="处理方式" prop="handle_method">
            <el-select
              v-model="formData.handle_method"
              placeholder="请选择处理方式"
              teleported
              popper-class="query-return-stock-dialog-popper"
            >
              <el-option label="重新入库" value="重新入库" />
              <el-option label="返厂维修" value="返厂维修" />
              <el-option label="供应商退换" value="供应商退换" />
              <el-option label="报废处理" value="报废处理" />
            </el-select>
          </el-form-item>

          <el-form-item label="退款金额">
            <el-input-number
              v-model="formData.refund_amount"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="退款方式">
            <el-select
              v-model="formData.refund_method"
              placeholder="请选择退款方式"
              clearable
              teleported
              popper-class="query-return-stock-dialog-popper"
            >
              <el-option label="现金退款" value="现金退款" />
              <el-option label="原路退回" value="原路退回" />
              <el-option label="银行转账" value="银行转账" />
              <el-option label="支付宝" value="支付宝" />
              <el-option label="微信支付" value="微信支付" />
            </el-select>
          </el-form-item>

          <el-form-item class="full-width" label="备注">
            <el-input
              v-model="formData.remarks"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="请输入退库备注信息"
            />
          </el-form-item>
        </div>
      </div>
    </el-form>

    <div class="return-warning">
      <i class="fas fa-exclamation-triangle"></i>
      <div class="warning-content">
        <strong>操作提示：</strong>
        退库后将删除对应销售记录，设备状态恢复为“在库”。
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { TimeUtil } from '@/utils/time'
import MobileDialog from '@/components/MobileDialog.vue'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import type { ModelValueProps, ReturnDeviceInfo as DeviceInfo, SuccessEmits, UpdateModelValueEmits } from '@/types'

interface Props extends ModelValueProps {
  deviceInfo: DeviceInfo | null
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

const createDefaultFormData = () => ({
  return_reason: '',
  return_type: '',
  handle_method: '',
  refund_amount: 0,
  refund_method: '',
  remarks: '',
  return_date: TimeUtil.now().format('YYYY-MM-DDTHH:mm')
})

const formData = reactive(createDefaultFormData())

const formRules = {
  return_reason: [ValidationRules.required('请选择退库原因')],
  return_type: [ValidationRules.required('请选择退库类型')],
  handle_method: [ValidationRules.required('请选择处理方式')],
  return_date: [ValidationRules.required('请选择退库时间')]
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
  if (!formRef.value || !props.deviceInfo?.id) return

  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    submitting.value = true

    const response = await unifiedApi.post(`/query/${props.deviceInfo.id}/return-to-stock`, {
      return_reason: formData.return_reason,
      return_type: formData.return_type,
      handle_method: formData.handle_method,
      refund_amount: formData.refund_amount || null,
      refund_method: formData.refund_method || null,
      return_date: formData.return_date,
      remarks: formData.remarks || ''
    })

    if (!response.success) {
      throw new Error(response.message || '退库失败，请重试')
    }

    ElMessage.success('退库成功！')
    emit('success')
    handleCancel()
  } catch (error: any) {
    logger.error('退库失败:', error)
    ElMessage.error(error?.response?.data?.message || error?.message || '退库失败，请重试')
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
  min-height: calc(72px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 56px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-title) {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-close) {
  top: calc(12px + env(safe-area-inset-top));
  right: 16px;
  transform: none;
  background: rgba(255, 255, 255, 0.16);
}

:global(.query-return-stock-dialog .mobile-dialog-sheet-body),
:global(.query-return-stock-dialog .mobile-dialog-sheet-footer) {
  background: #ffffff;
}

:global(.query-return-stock-dialog-popper) {
  z-index: 3200 !important;
}

:global(.query-return-stock-dialog-popper.el-popper),
:global(.query-return-stock-dialog-popper.el-select__popper),
:global(.query-return-stock-dialog-popper.el-picker__popper) {
  border-radius: 14px !important;
}

.device-info-card {
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
}

.info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 14px;

  i {
    color: #2563eb;
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
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.value {
  min-width: 0;
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;

  &.mono {
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  }

  &.imei {
    color: #2563eb;
  }
}

.condition-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;

  &.new {
    background: #dcfce7;
    color: #166534;
  }

  &.used {
    background: #fef3c7;
    color: #92400e;
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
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;

  i {
    color: #f59e0b;
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
  background: linear-gradient(135deg, #fff7ed 0%, #fff1f2 100%);
  border: 1px solid #fed7aa;
  border-radius: 12px;
  color: #c2410c;
  font-size: 13px;
  margin-top: 8px;

  i {
    font-size: 16px;
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

.return-dialog-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.return-dialog-footer :deep(.el-button) {
  width: 100%;
  margin: 0;
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

  .return-dialog-footer {
    gap: 8px;
  }

  :global(.query-return-stock-dialog-popper.el-popper),
  :global(.query-return-stock-dialog-popper.el-select__popper),
  :global(.query-return-stock-dialog-popper.el-picker__popper) {
    width: min(360px, calc(100vw - 12px)) !important;
    max-width: calc(100vw - 12px) !important;
  }

  :global(.query-return-stock-dialog-popper .el-picker-panel) {
    width: 100% !important;
    max-width: 100% !important;
  }

  :global(.query-return-stock-dialog-popper.el-picker__popper) {
    left: 6px !important;
    right: 6px !important;
  }
}

@media (max-width: 480px) {
  :global(.query-return-stock-dialog .mobile-dialog-sheet-header) {
    min-height: calc(62px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px;
  }

  :global(.query-return-stock-dialog .mobile-dialog-sheet-close) {
    top: calc(8px + env(safe-area-inset-top));
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
