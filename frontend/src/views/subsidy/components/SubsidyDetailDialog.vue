<template>
  <MobileDialog
    :model-value="modelValue"
    title="国补申请详情"
    width="90%"
    dialog-class="subsidy-detail-dialog"
    :show-default-footer="false"
    :style="{ '--dialog-max-width': '700px' }"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="modelValue && currentDetail"
      class="detail-content"
    >
      <div
        v-if="showCustomerSection"
        class="detail-section customer-info-section"
        :class="{
          'showing-handler': showHandlerInfo && currentDetail.has_different_handler && currentDetail.handler_info,
          'has-handler-info': currentDetail.has_different_handler && currentDetail.handler_info
        }"
        @click="toggleCustomerInfo"
      >
        <h4>
          <span>{{ showHandlerInfo && currentDetail.has_different_handler && currentDetail.handler_info ? '实际办理人信息' : '客户信息' }}</span>
          <span
            v-if="canToggleHandler"
            class="toggle-hint"
          >
            {{ showHandlerInfo ? '点击切换到购买者信息' : '点击切换到办理人信息' }}
          </span>
        </h4>
        <div
          v-if="showHandlerInfo ? fieldVisibility.handler_name : fieldVisibility.customer_name"
          class="detail-row"
        >
          <span class="detail-label">姓名:</span>
          <span class="detail-value">
            {{ showHandlerInfo && currentDetail.has_different_handler && currentDetail.handler_info ? currentDetail.handler_info.handler_name : currentDetail.customer_name }}
          </span>
        </div>
        <div
          v-if="showHandlerInfo ? fieldVisibility.handler_phone : fieldVisibility.customer_phone"
          class="detail-row"
        >
          <span class="detail-label">电话:</span>
          <span class="detail-value">
            {{ showHandlerInfo && currentDetail.has_different_handler && currentDetail.handler_info ? currentDetail.handler_info.handler_phone : currentDetail.customer_phone }}
          </span>
        </div>
        <div
          v-if="showHandlerInfo ? fieldVisibility.handler_idcard : fieldVisibility.customer_idcard"
          class="detail-row"
        >
          <span class="detail-label">身份证:</span>
          <span class="detail-value">
            {{
              showHandlerInfo && currentDetail.has_different_handler && currentDetail.handler_info
                ? (currentDetail.handler_info.handler_idcard || '未填写')
                : (currentDetail.customer_idcard || '未填写')
            }}
          </span>
        </div>
      </div>

      <div
        v-if="showDeviceSection"
        class="detail-section"
      >
        <h4>设备信息</h4>
        <div
          v-if="fieldVisibility.brand"
          class="detail-row"
        >
          <span class="detail-label">品牌:</span>
          <span class="detail-value">{{ currentDetail.phone_brand || '-' }}</span>
        </div>
        <div
          v-if="fieldVisibility.model"
          class="detail-row"
        >
          <span class="detail-label">型号:</span>
          <span class="detail-value">{{ currentDetail.phone_model || '-' }}</span>
        </div>
        <div
          v-if="fieldVisibility.color"
          class="detail-row"
        >
          <span class="detail-label">颜色:</span>
          <span class="detail-value">{{ currentDetail.phone_color || '-' }}</span>
        </div>
        <div
          v-if="fieldVisibility.memory"
          class="detail-row"
        >
          <span class="detail-label">内存:</span>
          <span class="detail-value">{{ currentDetail.phone_memory || '-' }}</span>
        </div>
        <div
          v-if="fieldVisibility.imei1"
          class="detail-row"
        >
          <span class="detail-label">IMEI1:</span>
          <span class="detail-value">{{ currentDetail.imei1 }}</span>
        </div>
        <div
          v-if="fieldVisibility.imei2 && currentDetail.imei2"
          class="detail-row"
        >
          <span class="detail-label">IMEI2:</span>
          <span class="detail-value">{{ currentDetail.imei2 }}</span>
        </div>
        <div
          v-if="fieldVisibility.serial_number"
          class="detail-row"
        >
          <span class="detail-label">序列号:</span>
          <span class="detail-value">{{ currentDetail.serial_number }}</span>
        </div>
      </div>

      <div
        v-if="showSalesSection"
        class="detail-section highlight compact-summary-section"
      >
        <h4>销补信息</h4>
        <div class="summary-grid">
          <div
            v-if="fieldVisibility.sale_price"
            class="summary-item"
          >
            <span class="summary-label">销售价格</span>
            <span class="summary-value">¥{{ currentDetail.sale_price?.toFixed(2) }}</span>
          </div>
          <div
            v-if="fieldVisibility.store_name"
            class="summary-item"
          >
            <span class="summary-label">店铺</span>
            <span class="summary-value">{{ currentDetail.store_name || '-' }}</span>
          </div>
          <div
            v-if="fieldVisibility.salesman_name"
            class="summary-item"
          >
            <span class="summary-label">销售员</span>
            <span class="summary-value">{{ currentDetail.salesman_name || '-' }}</span>
          </div>
          <div
            v-if="fieldVisibility.sale_time"
            class="summary-item"
          >
            <span class="summary-label">销售时间</span>
            <span class="summary-value">{{ formatDate(currentDetail.sale_time) }}</span>
          </div>
          <div
            v-if="fieldVisibility.subsidy_rate"
            class="summary-item"
          >
            <span class="summary-label">补贴比例</span>
            <span class="summary-value">{{ currentDetail.subsidy_rate }}%</span>
          </div>
          <div
            v-if="fieldVisibility.subsidy_amount"
            class="summary-item"
          >
            <span class="summary-label">补贴金额</span>
            <span class="summary-value subsidy-highlight">¥{{ currentDetail.subsidy_amount?.toFixed(2) }}</span>
          </div>
        </div>

        <div
          v-if="fieldVisibility.apply_time || fieldVisibility.arrival_time"
          class="status-overview"
        >
          <div
            v-if="fieldVisibility.apply_time"
            class="status-chip submit"
          >
            <span class="chip-label">{{ currentDetail.apply_time ? '提交时间' : '审批状态' }}</span>
            <span class="chip-value">{{ currentDetail.apply_time ? formatDate(currentDetail.apply_time) : '未审批' }}</span>
          </div>
          <div
            v-if="fieldVisibility.arrival_time"
            class="status-chip arrival"
          >
            <span class="chip-label">{{ currentDetail.arrival_time ? '到账时间' : '到账状态' }}</span>
            <span class="chip-value">{{ currentDetail.arrival_time ? formatDate(currentDetail.arrival_time) : '未到账' }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="fieldVisibility.subsidy_photos && currentDetail.subsidy_photos?.length"
        class="detail-section"
      >
        <h4>国补照片</h4>
        <div class="detail-photos">
          <div
            v-for="(photo, index) in currentDetail.subsidy_photos"
            :key="`${currentDetail.id}-photo-${index}`"
            class="detail-photo-item"
          >
            <img
              :src="resolvePhotoUrl(photo)"
              alt="国补照片"
              class="detail-photo-image"
            >
          </div>
        </div>
      </div>

      <div
        v-if="fieldVisibility.remarks && currentDetail.remarks"
        class="detail-section"
      >
        <h4>备注</h4>
        <p class="detail-remarks">
          {{ currentDetail.remarks }}
        </p>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { formatImageUrl } from '@/utils/format'
import { unifiedApi } from '@/utils/unified-api'
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'

const DETAIL_CACHE_TTL_MS = 90 * 1000
const detailCache = new Map<string | number, { timestamp: number, data: any }>()

const props = defineProps<{
  modelValue: boolean
  item: any | null
  fieldVisibility: Record<string, boolean>
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const currentDetail = ref<any>(null)
const showHandlerInfo = ref(false)
let detailRequestSeq = 0

const fieldVisibility = computed(() => props.fieldVisibility)
const canToggleHandler = computed(() => Boolean(
  currentDetail.value?.has_different_handler &&
  currentDetail.value?.handler_info &&
      fieldVisibility.value.has_different_handler &&
      (fieldVisibility.value.handler_name || fieldVisibility.value.handler_phone || fieldVisibility.value.handler_idcard)
))
const showCustomerSection = computed(() => Boolean(
  fieldVisibility.value.customer_name ||
  fieldVisibility.value.customer_phone ||
  fieldVisibility.value.customer_idcard ||
  canToggleHandler.value
))
const showDeviceSection = computed(() => [
  'brand', 'model', 'color', 'memory', 'imei1', 'imei2', 'serial_number'
].some(field => fieldVisibility.value[field]))
const showSalesSection = computed(() => [
  'sale_price', 'store_name', 'salesman_name', 'sale_time', 'subsidy_rate',
  'subsidy_amount', 'apply_time', 'arrival_time'
].some(field => fieldVisibility.value[field]))

const pruneExpiredDetailCache = (now = Date.now()) => {
  for (const [key, entry] of detailCache.entries()) {
    if (now - entry.timestamp > DETAIL_CACHE_TTL_MS) {
      detailCache.delete(key)
    }
  }
}

const getCachedDetail = (id: string | number | undefined) => {
  if (id === undefined || id === null) return null

  pruneExpiredDetailCache()
  const cacheEntry = detailCache.get(id)
  return cacheEntry ? cacheEntry.data : null
}

const setCachedDetail = (id: string | number | undefined, data: any) => {
  if (id === undefined || id === null) return
  detailCache.set(id, {
    timestamp: Date.now(),
    data
  })
}

const normalizeHandlerInfo = (handler_info?: Record<string, any> | null) => {
  if (!handler_info || typeof handler_info !== 'object') return null

  return {
    ...handler_info,
    handler_name: normalizePersonName(handler_info.handler_name || '', 20),
    handler_phone: normalizePhoneDigits(handler_info.handler_phone || ''),
    handler_idcard: normalizeIdCard(handler_info.handler_idcard || '')
  }
}

const normalizeSubsidyRecord = (item?: Record<string, any> | null) => {
  if (!item || typeof item !== 'object') return item

  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    handler_info: normalizeHandlerInfo(item.handler_info)
  }
}

const toggleCustomerInfo = () => {
  if (canToggleHandler.value) {
    showHandlerInfo.value = !showHandlerInfo.value
  }
}

const resolvePhotoUrl = (photo?: string) => formatImageUrl(photo || '')

const formatDate = (date: string) => date ? TimeUtil.format(date, TIME_FORMATS.DATE) : '-'

const loadDetail = async (item: any) => {
  const requestSeq = ++detailRequestSeq
  currentDetail.value = normalizeSubsidyRecord(item)
  showHandlerInfo.value = false

  const cachedDetail = getCachedDetail(item?.id)
  if (cachedDetail) {
    currentDetail.value = normalizeSubsidyRecord(cachedDetail)
  }

  try {
    const response = await unifiedApi.get(`/subsidy/${item.id}`)
    if (requestSeq !== detailRequestSeq) return

    if (response.success) {
      const normalizedDetail = normalizeSubsidyRecord(response.data)
      setCachedDetail(item.id, normalizedDetail)
      currentDetail.value = normalizedDetail
    } else {
      ElMessage.warning('获取详细信息失败，显示基本数据')
    }
  } catch (error: any) {
    if (requestSeq !== detailRequestSeq) return
    logger.error('获取详情失败:', error)
    ElMessage.warning('获取详细信息失败，显示基本数据')
  }
}

watch(
  () => [props.modelValue, props.item],
  async ([visible, item]) => {
    if (!visible || !item) {
      if (!visible) {
        currentDetail.value = null
        showHandlerInfo.value = false
      }
      return
    }

    await loadDetail(item)
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  background: var(--tf-color-surface-muted);
  border: 1px solid var(--tf-color-border-muted);
  border-radius: 12px;
  padding: 16px;

  h4 {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--tf-color-heading);
  }

  &.highlight {
    background: linear-gradient(135deg, var(--tf-color-green-50) 0%, var(--tf-color-cyan-50) 100%);
  }
}

.compact-summary-section {
  padding: 18px;
}

.customer-info-section {
  cursor: pointer;
}

.toggle-hint {
  font-size: 12px;
  color: var(--tf-color-muted);
  font-weight: 400;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tf-color-border-muted);

  &:last-child {
    border-bottom: none;
  }
}

.detail-label {
  width: 88px;
  flex-shrink: 0;
  color: var(--tf-color-muted);
}

.detail-value {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  color: var(--tf-color-heading);
  font-weight: 500;
}

.detail-remarks {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-photo-item {
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--tf-color-border-subtle);
  background: var(--color-bg-white);
}

.detail-photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.subsidy-highlight {
  color: var(--tf-color-green-600);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.95);
  border-radius: 10px;
}

.summary-label {
  font-size: 12px;
  color: var(--tf-color-neutral-500);
}

.summary-value {
  color: var(--tf-color-neutral-800);
  font-size: 14px;
  font-weight: 600;
  word-break: break-word;
}

.status-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.status-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid transparent;

  &.submit {
    background: var(--tf-status-warning-bg);
    border-color: var(--tf-status-warning-border);
  }

  &.arrival {
    background: var(--tf-status-info-bg);
    border-color: var(--tf-status-info-border);
  }
}

.chip-label {
  font-size: 12px;
  color: var(--tf-color-neutral-500);
}

.chip-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--tf-color-neutral-900);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;

  &.status-pending {
    background: var(--tf-status-warning-bg);
    color: var(--tf-status-warning-color);
    border: 1px solid var(--tf-status-warning-border);
  }

  &.status-completed {
    background: var(--tf-status-success-bg);
    color: var(--tf-status-success-color);
    border: 1px solid var(--tf-status-success-border);
  }

  &.status-approved {
    background: var(--tf-status-success-bg);
    color: var(--tf-status-success-color);
    border: 1px solid var(--tf-status-success-border);
  }
}

@media (max-width: 768px) {
  .detail-section {
    padding: 14px;
  }

  .compact-summary-section {
    padding: 14px;
  }

  .detail-row {
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    width: auto;
  }

  .summary-grid,
  .status-overview {
    grid-template-columns: 1fr;
  }
}
</style>
