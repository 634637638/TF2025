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
    <div v-if="modelValue && currentDetail" class="detail-content">
      <div
        class="detail-section customer-info-section"
        :class="{
          'showing-handler': showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo,
          'has-handler-info': currentDetail.hasDifferentHandler && currentDetail.handlerInfo
        }"
        @click="toggleCustomerInfo"
      >
        <h4>
          <span>{{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo ? '实际办理人信息' : '客户信息' }}</span>
          <span v-if="currentDetail.hasDifferentHandler && currentDetail.handlerInfo" class="toggle-hint">
            {{ showHandlerInfo ? '点击切换到购买者信息' : '点击切换到办理人信息' }}
          </span>
        </h4>
        <div class="detail-row">
          <span class="detail-label">姓名:</span>
          <span class="detail-value">
            {{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo ? currentDetail.handlerInfo.handlerName : currentDetail.customer_name }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">电话:</span>
          <span class="detail-value">
            {{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo ? currentDetail.handlerInfo.handlerPhone : currentDetail.customer_phone }}
          </span>
        </div>
        <div v-if="canViewCustomerIdcard" class="detail-row">
          <span class="detail-label">身份证:</span>
          <span class="detail-value">
            {{
              showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo
                ? (currentDetail.handlerInfo.handlerIdcard || '未填写')
                : (currentDetail.customer_idcard || '未填写')
            }}
          </span>
        </div>
      </div>

      <div class="detail-section">
        <h4>设备信息</h4>
        <div class="detail-row">
          <span class="detail-label">型号:</span>
          <span class="detail-value">{{ currentDetail.phone_brand }} {{ currentDetail.phone_model }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">规格:</span>
          <span class="detail-value">{{ currentDetail.phone_color }} / {{ currentDetail.phone_memory }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">IMEI1:</span>
          <span class="detail-value">{{ currentDetail.imei1 }}</span>
        </div>
        <div v-if="currentDetail.imei2" class="detail-row">
          <span class="detail-label">IMEI2:</span>
          <span class="detail-value">{{ currentDetail.imei2 }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">序列号:</span>
          <span class="detail-value">{{ currentDetail.serial_number }}</span>
        </div>
      </div>

      <div class="detail-section highlight compact-summary-section">
        <h4>销补信息</h4>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">销售价格</span>
            <span class="summary-value">¥{{ currentDetail.sale_price?.toFixed(2) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">店铺</span>
            <span class="summary-value">{{ currentDetail.store_name || '-' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">销售员</span>
            <span class="summary-value">{{ currentDetail.salesman_name || '-' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">销售时间</span>
            <span class="summary-value">{{ formatDate(currentDetail.sale_time) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">补贴比例</span>
            <span class="summary-value">{{ currentDetail.subsidy_rate }}%</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">补贴金额</span>
            <span class="summary-value subsidy-highlight">¥{{ currentDetail.subsidy_amount?.toFixed(2) }}</span>
          </div>
        </div>

        <div class="status-overview">
          <div class="status-chip submit">
            <span class="chip-label">{{ currentDetail.apply_time ? '提交时间' : '审批状态' }}</span>
            <span class="chip-value">{{ currentDetail.apply_time ? formatDate(currentDetail.apply_time) : '未审批' }}</span>
          </div>
          <div class="status-chip arrival">
            <span class="chip-label">{{ currentDetail.arrival_time ? '到账时间' : '到账状态' }}</span>
            <span class="chip-value">{{ currentDetail.arrival_time ? formatDate(currentDetail.arrival_time) : '未到账' }}</span>
          </div>
        </div>
      </div>

      <div v-if="currentDetail.subsidy_photos?.length" class="detail-section">
        <h4>国补照片</h4>
        <div class="detail-photos">
          <div
            v-for="(photo, index) in currentDetail.subsidy_photos"
            :key="`${currentDetail.id}-photo-${index}`"
            class="detail-photo-item"
          >
            <img :src="resolvePhotoUrl(photo)" alt="国补照片" class="detail-photo-image" />
          </div>
        </div>
      </div>

      <div v-if="currentDetail.remarks" class="detail-section">
        <h4>备注</h4>
        <p class="detail-remarks">{{ currentDetail.remarks }}</p>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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
  canViewCustomerIdcard: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const currentDetail = ref<any>(null)
const showHandlerInfo = ref(false)
let detailRequestSeq = 0

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

const normalizeHandlerInfo = (handlerInfo?: Record<string, any> | null) => {
  if (!handlerInfo || typeof handlerInfo !== 'object') return null

  return {
    ...handlerInfo,
    handlerName: normalizePersonName(handlerInfo.handlerName || '', 20),
    handlerPhone: normalizePhoneDigits(handlerInfo.handlerPhone || ''),
    handlerIdcard: normalizeIdCard(handlerInfo.handlerIdcard || '')
  }
}

const normalizeSubsidyRecord = (item?: Record<string, any> | null) => {
  if (!item || typeof item !== 'object') return item

  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    handlerInfo: normalizeHandlerInfo(item.handlerInfo)
  }
}

const toggleCustomerInfo = () => {
  if (currentDetail.value?.hasDifferentHandler && currentDetail.value?.handlerInfo) {
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
    return
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
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;

  h4 {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 12px;
    font-size: 15px;
    color: #2c3e50;
  }

  &.highlight {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
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
  color: #6c757d;
  font-weight: 400;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;

  &:last-child {
    border-bottom: none;
  }
}

.detail-label {
  width: 88px;
  flex-shrink: 0;
  color: #6c757d;
}

.detail-value {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  color: #2c3e50;
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
  border: 1px solid #dee2e6;
  background: #fff;
}

.detail-photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.subsidy-highlight {
  color: #16a34a;
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
  color: #6b7280;
}

.summary-value {
  color: #1f2937;
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
    background: #fffbeb;
    border-color: #fde68a;
  }

  &.arrival {
    background: #eff6ff;
    border-color: #bfdbfe;
  }
}

.chip-label {
  font-size: 12px;
  color: #6b7280;
}

.chip-value {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;

  &.status-pending {
    background: #fef3c7;
    color: #92400e;
  }

  &.status-completed {
    background: #dcfce7;
    color: #166534;
  }

  &.status-approved {
    background: #dbeafe;
    color: #1d4ed8;
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
