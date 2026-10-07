<template>
  <div
    v-tf-loading="loading"
    class="sales-grid-view"
  >
    <TableLoadingRow
      v-if="loading"
      mode="block"
      text="加载中..."
    />
    <DataEmptyState
      v-else-if="phones.length === 0"
      :state="hasActiveFilters ? 'filtered' : 'empty'"
      :title="hasActiveFilters ? '未找到匹配的设备' : '暂无设备数据'"
      :description="hasActiveFilters ? '尝试调整筛选条件或清空部分筛选条件' : '调整筛选条件或添加新的库存设备'"
    >
      <el-button
        v-if="hasActiveFilters"
        type="primary"
        plain
        @click="emit('reset-filters')"
      >
        清空筛选条件
      </el-button>
    </DataEmptyState>
    <div
      v-else
      class="grid-container"
    >
      <div
        v-for="phone in phones"
        :key="phone.id"
        class="device-card"
      >
        <div
          :class="['card-image', { 'media-preview-trigger': isUsedPhone(phone) }]"
          :role="isUsedPhone(phone) ? 'button' : undefined"
          :tabindex="isUsedPhone(phone) ? 0 : undefined"
          :aria-label="isUsedPhone(phone) ? `预览${phone.model || '设备'}图片` : undefined"
          @click.stop="openPhoneMediaPreview(phone)"
          @keydown.enter.stop="openPhoneMediaPreview(phone)"
          @keydown.space.prevent.stop="openPhoneMediaPreview(phone)"
        >
          <Image
            :src="getPhoneImageSrc(phone)"
            :alt="phone.model"
            mode="eager"
            :product-info="{
              brand: phone.brand || '',
              model: phone.model || '',
              color: phone.color || '',
              memory: phone.memory || ''
            }"
          />
          <div class="card-badges">
            <span
              v-if="phone.is_new"
              class="badge badge-new"
            >全新</span>
            <span
              v-else
              class="badge badge-used"
            >二手</span>
            <span
              v-if="canViewField('brand')"
              class="badge badge-brand"
            >{{ phone.brand }}</span>
          </div>
        </div>
        <div class="card-content">
          <div class="device-title-row">
            <h4 class="device-title">
              {{ canViewField('model') ? phone.model : '设备信息' }}
            </h4>
            <div class="device-title-meta">
              <span
                v-if="canViewField('memory')"
                class="title-memory"
              >{{ phone.memory || '-' }}</span>
              <span class="title-price">{{ canViewPrice ? `¥${formatNumber(phone.purchase_cost || 0)}` : '***' }}</span>
            </div>
          </div>
          <div class="device-specs">
            <div
              v-if="canViewField('supplier_name') || canViewField('store_name')"
              class="spec-row spec-row-supplier-store"
            >
              <div
                v-if="canViewField('supplier_name')"
                class="spec-item supplier-spec-item"
              >
                <span class="spec-label">供应商:</span>
                <span class="spec-value">{{ phone.supplier_name || '-' }}</span>
              </div>
              <div
                v-if="canViewField('store_name')"
                class="spec-item store-spec-item"
              >
                <span class="spec-label">店铺:</span>
                <span class="spec-value">{{ phone.store_name || '-' }}</span>
              </div>
            </div>
            <div
              v-if="canViewField('color')"
              class="spec-row"
            >
              <div class="spec-item">
                <span class="spec-label">颜色:</span>
                <span class="spec-value">{{ phone.color || '-' }}</span>
              </div>
            </div>
            <div
              v-if="canViewField('imei') || canViewField('inventory_time')"
              class="spec-row spec-row-imei-time"
            >
              <div
                v-if="canViewField('imei')"
                class="spec-item"
              >
                <span class="spec-label">IMEI:</span>
                <span class="spec-value">{{ phone.imei || '-' }}</span>
              </div>
              <div
                v-if="canViewField('inventory_time')"
                class="spec-item"
              >
                <span class="spec-label">时间:</span>
                <span class="spec-value">{{ formatDate(phone.inventory_time) }}</span>
              </div>
            </div>
            <div
              v-if="!canViewField('color') && !canViewField('imei') && !canViewField('supplier_name') && !canViewField('store_name')"
              class="spec-row"
            >
              <div class="spec-item">
                <span class="spec-label">信息:</span>
                <span class="spec-value">已按字段权限隐藏</span>
              </div>
            </div>
          </div>
          <div
            v-if="shouldShowActionColumn(canViewField('actions'), [canSell, canEdit, canDelete])"
            class="card-actions"
          >
            <el-button
              v-if="canSell"
              type="success"
              :disabled="!isPhoneSaleActionAvailable(phone)"
              :title="isPhoneSaleActionAvailable(phone) ? '销售出库' : '当前状态不可销售出库'"
              size="small"
              @click.stop="isPhoneSaleActionAvailable(phone) && emit('sale', phone)"
            >
              <i class="fas fa-shopping-cart" />
              出库
            </el-button>
            <el-button
              v-if="canEdit"
              type="primary"
              title="编辑设备信息"
              size="small"
              @click.stop="emit('edit', phone)"
            >
              <i class="fas fa-edit" />
              编辑
            </el-button>
            <el-button
              v-if="canDelete"
              type="danger"
              title="删除设备"
              size="small"
              @click.stop="emit('delete', phone)"
            >
              <i class="fas fa-trash" />
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <MediaPreviewViewer
    v-model="showMediaPreview"
    :items="previewMediaItems"
    :initial-index="previewMediaIndex"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Image from '@/components/Image.vue'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import type { MediaPreviewItem } from '@/utils/media'
import type { Phone } from '@/types'
import { isPhoneSaleActionAvailable } from '../sales-phone-helpers'

const props = defineProps<{
  phones: Phone[]
  loading: boolean
  hasActiveFilters: boolean
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
  canSell: boolean
  canEdit: boolean
  canDelete: boolean
  getPhoneImageSrc: (_phone: Phone) => string
  formatNumber: (_value: number) => string
  formatDate: (_value?: string) => string
}>()

const showMediaPreview = ref(false)
const previewMediaItems = ref<MediaPreviewItem[]>([])
const previewMediaIndex = ref(0)
let mediaRequestVersion = 0

const isUsedPhone = (phone: Phone): boolean => {
  const newValue: unknown = phone.is_new
  const isNew = newValue === true || newValue === 1 || newValue === '1'
  return !isNew
}

const getFallbackMediaItem = (phone: Phone): MediaPreviewItem => ({
  id: `phone-${phone.id}`,
  url: props.getPhoneImageSrc(phone),
  label: `${phone.brand || ''} ${phone.model || ''}`.trim() || '设备图片'
})

const openPhoneMediaPreview = async (phone: Phone) => {
  if (!isUsedPhone(phone)) return

  const requestVersion = ++mediaRequestVersion
  const fallbackItem = getFallbackMediaItem(phone)
  previewMediaItems.value = [fallbackItem]
  previewMediaIndex.value = 0
  showMediaPreview.value = true

  try {
    const response = await unifiedApi.get(`/phones/${phone.id}/images`, {
      useCache: false,
      showError: false
    })
    if (requestVersion !== mediaRequestVersion) return

    const media = extractResponseData<Array<Record<string, unknown>>>(response)
    const items = (Array.isArray(media) ? media : [])
      .map<MediaPreviewItem | null>((item) => {
        const url = typeof item.image_url === 'string' ? item.image_url.trim() : ''
        if (!url) return null

        return {
          id: typeof item.id === 'number' || typeof item.id === 'string' ? item.id : url,
          url,
          type: typeof item.image_type === 'string' ? item.image_type : undefined,
          label: item.image_type === 'video' ? '设备视频' : '设备图片'
        }
      })
      .filter((item): item is MediaPreviewItem => Boolean(item))

    previewMediaItems.value = items.length > 0 ? items : [fallbackItem]
  } catch (error) {
    if (requestVersion === mediaRequestVersion) {
      logger.warn('销售图文模式加载设备媒体失败，使用主图预览:', error)
    }
  }
}

const emit = defineEmits<{
  sale: [phone: Phone]
  edit: [phone: Phone]
  delete: [phone: Phone]
  'reset-filters': []
}>()
</script>

<style scoped lang="scss" src="../styles/sales-grid-view.scss"></style>
