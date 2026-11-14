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
    :close-on-click-modal="false"
    :before-close="beforeClose"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #footer>
      <div
        v-if="!checkoutChecklist"
        class="tf-dialog-actions return-dialog-footer"
      >
        <el-button
          :disabled="submitting"
          @click="handleCancel"
        >
          取消
        </el-button>
        <el-button
          v-if="allowed"
          v-permission="'query:return-to-stock'"
          type="primary"
          :loading="submitting"
          :disabled="!canSubmitReturn"
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
      <div class="info-grid tf-detail-grid">
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

    <SectionLoading
      v-if="checklistLoading"
      text="正在核对手机原单及关联配件..."
      size="compact"
    />
    <DataEmptyState
      v-else-if="checklistFailed"
      state="error"
      title="原单核对失败"
      :description="checklistError"
      size="compact"
      action-text="重试"
      @action="loadChecklist"
    />
    <section
      v-else-if="allowed && checkoutChecklist && (canViewGoods || !checkoutChecklist.accessories.length)"
      class="checkout-return-checklist"
    >
      <h3>共同结算原单配件核对</h3>
      <p>订单 {{ checkoutChecklist.order_no }}；数量已扣除此前办理的商品售后。</p>
      <div class="table-wrapper">
        <el-table
          :data="checkoutChecklist.accessories"
          class="data-table"
          row-key="item_id"
        >
          <el-table-column
            v-if="canViewAccessoryField('name')"
            prop="name"
            label="商品"
            min-width="140"
          />
          <el-table-column
            v-if="canViewAccessoryField('usage_type')"
            label="类型"
            min-width="90"
          >
            <template #default="{ row }">
              {{ row.sale_type === 'gift' ? '赠品' : '收费商品' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewAccessoryField('total_quantity')"
            prop="quantity"
            label="原数量"
            min-width="84"
          />
          <el-table-column
            v-if="canViewAccessoryField('total_quantity')"
            prop="returned_quantity"
            label="已退"
            min-width="76"
          />
          <el-table-column
            v-if="canViewAccessoryField('total_quantity')"
            prop="remaining_quantity"
            label="剩余"
            min-width="76"
          />
          <el-table-column
            v-if="canViewAccessoryField('serial_number')"
            label="未退 SN"
            min-width="150"
          >
            <template #default="{ row }">
              {{ row.available_serial_numbers?.join('、') || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showGiftAgreement"
            label="剩余赠品约定金额"
            min-width="150"
          >
            <template #default="{ row }">
              {{ row.sale_type === 'gift' ? (row.remaining_gift_return_total === null ? '未约定' : formatCurrency(row.remaining_gift_return_total)) : '-' }}
            </template>
          </el-table-column>
          <template #empty>
            <DataEmptyState
              description="该手机没有关联配件或赠品"
              size="compact"
            />
          </template>
        </el-table>
      </div>
      <PhoneReturnForm
        :checklist="checkoutChecklist"
        @cancel="handleCancel"
        @busy="submitting = $event"
        @success="checkoutReturned"
      />
    </section>

    <el-form
      v-if="allowed && standaloneSale"
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="return-form tf-form-layout tf-form-grid"
    >
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-undo-alt" />
          退库信息
        </div>

        <div class="tf-form-row">
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
            <AmountInput
              v-model="formData.refund_amount"
              :min="0"
              :max="99999999.99"
              :step="100"
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
            class="full-width tf-form-field--wide"
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

    <div
      v-if="standaloneSale"
      class="return-warning"
    >
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
import { formatCurrency } from '@/utils/format'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { getPhoneReturnChecklist } from '@/api/sales-checkout'
import { isPhoneReturnSource } from '@/utils/sales-checkout'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'
import { usePagePermissions } from '@/composables/usePagePermissions'
import type { PhoneReturnChecklist } from '@/types/sales-checkout'
import PhoneReturnForm from './PhoneReturnForm.vue'
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
  set: (val) => { if (!submitting.value) emit('update:modelValue', val) }
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const requests = useLatestRequest()
const checklistLoading = ref(false)
const checklistFailed = ref(false)
const checklistError = ref('')
const checkoutChecklist = ref<PhoneReturnChecklist | null>(null)
const standaloneSale = ref(false)
const { canView, hasPermission } = usePagePermissions('query')
const allowed = computed(() => canView.value && hasPermission('return-to-stock'))
const { canView: canViewGoods } = usePagePermissions('accessories')
const canSubmitReturn = computed(() => allowed.value && standaloneSale.value && !checklistLoading.value && !checklistFailed.value && !submitting.value)
const showGiftAgreement = computed(() => canViewAccessoryField('usage_type') && canViewAccessoryField('total_quantity') && canViewAccessoryField('unit_price') && canViewAccessoryField('total_price'))
const beforeClose = (done: (cancel?: boolean) => void) => { if (!submitting.value) done() }
const checkoutReturned = () => { submitting.value = false; emit('success'); handleCancel() }

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

const loadChecklist = async () => {
  const phoneId = Number(props.deviceInfo?.id)
  requests.cancelLatest()
  checkoutChecklist.value = null
  standaloneSale.value = false
  checklistFailed.value = false
  checklistLoading.value = false
  if (!props.modelValue || !allowed.value || !Number.isSafeInteger(phoneId) || phoneId < 1) return
  const request = requests.nextRequest()
  checklistLoading.value = true
  try {
    const response = await getPhoneReturnChecklist(phoneId, request.signal)
    if (!request.isLatest()) return
    if (!response.success || !isPhoneReturnSource(response.data, phoneId)) throw new Error('原单核对响应无效，请刷新后重试')
    if (response.data.mode === 'checkout') {
      if (response.data.accessories.length && !canViewGoods.value) throw new Error('无权查看关联配件，无法完成原单核对')
      checkoutChecklist.value = response.data
    }
    else standaloneSale.value = true
  } catch (error: unknown) {
    if (requests.isCanceledError(error) || !request.isLatest()) return
    checklistFailed.value = true
    checklistError.value = getRequestErrorMessage(error, '无法确认手机销售来源')
  } finally {
    if (request.isLatest()) checklistLoading.value = false
  }
}

const handleCancel = () => {
  requests.cancelLatest()
  standaloneSale.value = false
  checkoutChecklist.value = null
  checklistLoading.value = false
  resetForm()
  dialogVisible.value = false
}

const handleSubmit = async () => {
  if (submitting.value || !canSubmitReturn.value) return
  if (!formRef.value || !props.deviceInfo?.id) return
  const phoneId = props.deviceInfo.id

  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid || !canSubmitReturn.value || !props.modelValue || props.deviceInfo?.id !== phoneId) return

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
  () => [props.modelValue, props.deviceInfo?.id, allowed.value, canViewGoods.value] as const,
  ([visible]) => {
    if (visible) {
      resetForm()
      void loadChecklist()
    } else {
      requests.cancelLatest()
      checklistLoading.value = false
      checkoutChecklist.value = null
      checklistFailed.value = false
      standaloneSale.value = false
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
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
  .info-grid,
  .form-grid {
    gap: 8px;
  }

  .device-info-card {
    padding: 12px;
  }
}
</style>
