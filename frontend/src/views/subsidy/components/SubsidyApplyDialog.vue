<template>
  <MobileDialog
    :model-value="modelValue"
    title="新建国补申请"
    :force-fullscreen="isMobile"
    dialog-class="subsidy-dialog"
    :show-default-footer="false"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="handleDialogChange"
  >
    <div
      v-if="modelValue"
      class="modal-body"
    >
      <div class="apply-form">
        <div
          v-if="applyStep === 1"
          class="search-step"
        >
          <div class="search-step-intro">
            <h3>步骤1：搜索设备</h3>
            <p class="step-hint">
              输入IMEI或序列号，在搜索结果中选择正确的设备
            </p>
          </div>

          <div class="search-box-input-only">
            <el-input
              v-model="searchIdentifier"
              type="text"
              class="search-input-lg"
              placeholder="输入IMEI或序列号..."
              @keyup.enter="searchPhones"
            />
          </div>

          <div
            v-if="deviceList.length > 0"
            class="device-list"
          >
            <div class="device-list-header">
              <h4>找到 {{ deviceList.length }} 个匹配设备</h4>
            </div>
            <div class="device-list-container">
              <div
                v-for="device in deviceList"
                :key="device.phone_id"
                :class="['device-item', { selected: selectedDevice?.phone_id === device.phone_id }]"
                @click="selectDevice(device)"
              >
                <div class="device-main">
                  <div
                    v-if="canViewField('brand') || canViewField('model')"
                    class="device-model"
                  >
                    <strong>
                      <span v-if="canViewField('brand')">{{ device.brand }}</span>
                      <span v-if="canViewField('model')">{{ device.model }}</span>
                    </strong>
                  </div>
                  <div
                    v-if="canViewField('color') || canViewField('memory')"
                    class="device-specs"
                  >
                    <span v-if="canViewField('color')">{{ device.color }}</span>
                    <span v-if="canViewField('memory')">{{ device.memory }}</span>
                  </div>
                  <div
                    v-if="canViewField('imei1') || canViewField('serial_number')"
                    class="device-identifiers"
                  >
                    <span v-if="canViewField('imei1')"><i class="fas fa-barcode" /> {{ device.imei }}</span>
                    <span v-if="canViewField('serial_number')"><i class="fas fa-hashtag" /> {{ device.serial_number }}</span>
                  </div>
                  <div
                    v-if="(canViewField('customer_name') && device.customer_name) || (canViewField('customer_phone') && device.customer_phone)"
                    class="device-customer"
                  >
                    <span v-if="canViewField('customer_name')"><i class="fas fa-user" /> {{ device.customer_name || '未知客户' }}</span>
                    <span v-if="canViewField('customer_phone')"><i class="fas fa-phone" /> {{ device.customer_phone || '-' }}</span>
                  </div>
                </div>
                <div class="device-meta">
                  <div
                    v-if="canViewField('sale_price')"
                    class="device-price"
                  >
                    ¥{{ formatAmount(device.sale_price) }}
                  </div>
                  <div class="device-status">
                    <span :class="['status-tag', device.can_apply_subsidy ? 'eligible' : 'not-eligible']">
                      {{ device.reason }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DataEmptyState
            v-else-if="searchCompleted && deviceList.length === 0"
            state="filtered"
            description="未找到匹配的设备"
            size="compact"
          />
        </div>

        <div
          v-if="applyStep === 2 && phoneDetail"
          class="confirm-step"
        >
          <h3>步骤2：确认申请信息</h3>

          <div class="confirm-info">
            <div
              v-if="canViewField('customer_name') || canViewField('customer_phone') || canViewField('customer_idcard')"
              class="info-group"
            >
              <h4>客户信息</h4>
              <div class="info-row-inline">
                <div
                  v-if="canViewField('customer_name')"
                  class="inline-item"
                >
                  <span class="info-label">姓名:</span>
                  <span class="info-value">{{ phoneDetail.customer_name }}</span>
                </div>
                <div
                  v-if="canViewField('customer_phone')"
                  class="inline-item"
                >
                  <span class="info-label">电话:</span>
                  <span class="info-value">{{ phoneDetail.customer_phone }}</span>
                </div>
              </div>
              <div
                v-if="canViewField('customer_idcard')"
                class="info-row-inline"
              >
                <div class="inline-item">
                  <span class="info-label">身份证:</span>
                  <div class="info-value">
                    <el-input
                      v-model="applyForm.customer_idcard"
                      type="text"
                      class="form-input-inline"
                      placeholder="请输入身份证号"
                      @update:model-value="applyForm.customer_idcard = normalizeIdCard($event)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="canViewField('has_different_handler')"
              class="info-group handler-info-section"
            >
              <div class="handler-info-header">
                <h4>非本人办理</h4>
                <label class="checkbox-inline">
                  <input
                    v-model="applyForm.has_different_handler"
                    type="checkbox"
                  >
                  <span>填写其他办理人信息</span>
                </label>
              </div>

              <div
                v-if="applyForm.has_different_handler"
                class="handler-info-content"
              >
                <div
                  v-if="canViewField('handler_name')"
                  class="info-row"
                >
                  <span class="info-label required">姓名:</span>
                  <div class="info-value">
                    <el-input
                      v-model="applyForm.handler_name"
                      type="text"
                      class="form-input-inline"
                      placeholder="实际办理人姓名"
                      @update:model-value="applyForm.handler_name = normalizePersonName($event, 20)"
                    />
                  </div>
                </div>
                <div
                  v-if="canViewField('handler_phone')"
                  class="info-row"
                >
                  <span class="info-label required">电话:</span>
                  <div class="info-value">
                    <el-input
                      v-model="applyForm.handler_phone"
                      type="text"
                      class="form-input-inline"
                      placeholder="实际办理人电话"
                      @update:model-value="applyForm.handler_phone = normalizePhoneDigits($event)"
                    />
                  </div>
                </div>
                <div
                  v-if="canViewField('handler_idcard')"
                  class="info-row"
                >
                  <span class="info-label required">身份证:</span>
                  <div class="info-value">
                    <el-input
                      v-model="applyForm.handler_idcard"
                      type="text"
                      class="form-input-inline"
                      placeholder="实际办理人身份证"
                      @update:model-value="applyForm.handler_idcard = normalizeIdCard($event)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="showDeviceInfo"
              class="info-group"
            >
              <h4>设备信息</h4>
              <div class="info-row-inline">
                <div
                  v-if="canViewField('brand')"
                  class="inline-item"
                >
                  <span class="info-label">品牌:</span>
                  <span class="info-value">{{ phoneDetail.phone_brand }}</span>
                </div>
                <div
                  v-if="canViewField('model')"
                  class="inline-item"
                >
                  <span class="info-label">型号:</span>
                  <span class="info-value">{{ phoneDetail.phone_model }}</span>
                </div>
                <div
                  v-if="canViewField('color')"
                  class="inline-item"
                >
                  <span class="info-label">颜色:</span>
                  <span class="info-value">{{ phoneDetail.phone_color }}</span>
                </div>
                <div
                  v-if="canViewField('memory')"
                  class="inline-item"
                >
                  <span class="info-label">内存:</span>
                  <span class="info-value">{{ phoneDetail.phone_memory }}</span>
                </div>
              </div>
              <div
                v-if="canViewField('imei1')"
                class="info-row-inline"
              >
                <div class="inline-item">
                  <span class="info-label">IMEI1:</span>
                  <span class="info-value">{{ phoneDetail.imei1 }}</span>
                </div>
              </div>
              <div
                v-if="canViewField('imei2')"
                class="info-row-inline"
              >
                <div class="inline-item">
                  <span class="info-label">IMEI2:</span>
                  <div class="info-value">
                    <el-input
                      v-model="applyForm.imei2"
                      type="text"
                      class="form-input-inline"
                      placeholder="请输入IMEI2"
                    />
                  </div>
                </div>
              </div>
              <div
                v-if="canViewField('serial_number')"
                class="info-row-inline"
              >
                <div class="inline-item">
                  <span class="info-label">序列号:</span>
                  <span class="info-value">{{ phoneDetail.serial_number }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="canViewField('sale_price') || canViewField('store_name') || canViewField('sale_time')"
              class="info-group"
            >
              <h4>销售信息</h4>
              <div class="info-row-inline">
                <div
                  v-if="canViewField('sale_price')"
                  class="inline-item"
                >
                  <span class="info-label">销售价格:</span>
                  <span class="info-value">¥{{ formatAmount(phoneDetail.sale_price) }}</span>
                </div>
                <div
                  v-if="canViewField('store_name')"
                  class="inline-item"
                >
                  <span class="info-label">店铺:</span>
                  <span class="info-value">{{ phoneDetail.store_name }}</span>
                </div>
                <div
                  v-if="canViewField('sale_time')"
                  class="inline-item"
                >
                  <span class="info-label">销售时间:</span>
                  <span class="info-value">{{ formatDate(phoneDetail.sale_time) }}</span>
                </div>
              </div>
            </div>

            <div class="info-group highlight">
              <h4>补贴信息</h4>
              <div class="info-row-inline">
                <div
                  v-if="canViewField('sale_price')"
                  class="inline-item"
                >
                  <span class="info-label">销售价格:</span>
                  <span class="info-value">¥{{ formatAmount(phoneDetail.sale_price) }}</span>
                </div>
                <div
                  v-if="canViewField('subsidy_amount')"
                  class="inline-item"
                >
                  <span class="info-label">补贴金额:</span>
                  <span class="info-value discount-amount">-¥{{ formatAmount(calculatedSubsidyAmount) }}</span>
                </div>
                <div
                  v-if="canViewField('sale_price') && canViewField('subsidy_amount')"
                  class="inline-item"
                >
                  <span class="info-label">到手价格:</span>
                  <span class="info-value final-price">¥{{ formatAmount(phoneDetail.sale_price - calculatedSubsidyAmount) }}</span>
                </div>
              </div>
              <div
                v-if="canViewField('subsidy_calc_price') || canViewField('subsidy_photos') || canUpload"
                class="info-row subsidy-photo-row"
              >
                <span class="info-label">
                  {{ canViewField('subsidy_calc_price') ? '国补计算价:' : '国补照片:' }}
                </span>
                <div class="info-value subsidy-photo-content">
                  <div class="subsidy-photo-inline-row">
                    <div
                      v-if="canViewField('subsidy_calc_price')"
                      class="subsidy-calc-input-wrap"
                    >
                      <AmountInput
                        v-model="applyForm.subsidy_calc_price"
                        :step="100"
                        :min="0"
                        :max="phoneDetail.sale_price"
                        placeholder="国补计算价格"
                        style="width: 150px"
                      />
                    </div>
                    <el-upload
                      v-if="canUpload"
                      class="subsidy-photo-upload"
                      :show-file-list="false"
                      :http-request="customUploadRequest"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,application/pdf"
                      multiple
                    >
                      <el-button
                        type="primary"
                        size="small"
                        class="photo-upload-btn"
                      >
                        <i class="fas fa-camera" />
                        <span>国补照片上传</span>
                      </el-button>
                    </el-upload>
                  </div>
                  <div
                    v-if="canViewField('subsidy_calc_price') && canViewField('sale_price') && applyForm.subsidy_calc_price && applyForm.subsidy_calc_price !== phoneDetail.sale_price"
                    class="price-diff-hint"
                  >
                    (差价: ¥{{ formatAmount(phoneDetail.sale_price - applyForm.subsidy_calc_price) }})
                  </div>
                  <div
                    v-if="(canViewField('subsidy_photos') || canUpload) && applyForm.subsidy_photos.length > 0"
                    class="uploaded-photos-preview"
                  >
                    <div
                      v-for="(photo, index) in applyForm.subsidy_photos"
                      :key="photo"
                      class="photo-thumbnail"
                      @click="openPhotoViewer(index)"
                    >
                      <AsyncImage
                        :src="photo"
                        alt="国补照片"
                        mode="eager"
                        class="photo-thumbnail"
                      />
                      <div class="photo-preview-mask">
                        <i class="fas fa-search-plus" />
                        <span>预览</span>
                      </div>
                      <i
                        v-if="canUpload"
                        class="fas fa-times remove-photo"
                        @click.stop="removePhoto(index)"
                      />
                    </div>
                  </div>
                  <div
                    v-if="(canViewField('subsidy_photos') || canUpload) && applyForm.subsidy_photos.length > 0"
                    class="photo-action-hint"
                  >
                    点击图片可预览，发现问题可删除后重新上传
                  </div>
                </div>
              </div>
              <div
                v-if="!isEligibleForSubsidy"
                class="subsidy-warning"
              >
                <i class="fas fa-exclamation-triangle" />
                国补计算价格超过6000元，无法享受国补补贴
              </div>
              <div
                v-if="canViewField('status') && phoneDetail.existing_subsidy"
                class="existing-subsidy-warning"
              >
                <i class="fas fa-exclamation-triangle" />
                该设备已存在国补申请 (状态: {{ getStatusText(phoneDetail.existing_subsidy.apply_status) }})
              </div>
            </div>

            <div
              v-if="canViewField('remarks')"
              class="form-group"
            >
              <label>备注</label>
              <el-input
                v-model="applyForm.remarks"
                class="tf-textarea"
                type="textarea"
                :rows="3"
                placeholder="请输入备注信息（可选）"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div
        v-if="modelValue"
        class="tf-dialog-actions apply-dialog-footer"
      >
        <template v-if="applyStep === 1">
          <el-button
            type="default"
            @click="closeDialog"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="!searchIdentifier || searching"
            @click="searchPhones"
          >
            <InlineLoading
              v-if="searching"
              text="搜索中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-search" />
              <span>搜索</span>
            </template>
          </el-button>
          <el-button
            v-if="selectedDevice"
            type="success"
            :disabled="loadingDetail || selectedDevice.has_subsidy"
            @click="loadPhoneDetail"
          >
            <InlineLoading
              v-if="loadingDetail"
              text="正在读取申请设备详情..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-arrow-right" />
              <span>{{ selectedDevice.has_subsidy ? '该设备已记录国补' : '下一步' }}</span>
            </template>
          </el-button>
        </template>

        <template v-if="applyStep === 2 && phoneDetail">
          <el-button
            type="default"
            @click="closeDialog"
          >
            取消
          </el-button>
          <el-button
            type="info"
            @click="applyStep = 1"
          >
            上一步
          </el-button>
          <el-button
            v-if="!phoneDetail.existing_subsidy"
            type="success"
            :disabled="submitting"
            @click="submitApply"
          >
            <InlineLoading
              v-if="submitting"
              text="提交中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-check" />
              <span>提交资料</span>
            </template>
          </el-button>
        </template>
      </div>
    </template>
  </MobileDialog>

  <MediaPreviewViewer
    v-model="showPhotoViewer"
    :items="previewMediaItems"
    :initial-index="currentPhotoIndex"
    :deletable="canUpload"
    @delete="removeCurrentPreviewPhoto"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, reactive, ref, watch } from 'vue'

import type { UploadRequestOptions } from 'element-plus'
import { isAxiosError } from 'axios'
import MobileDialog from '@/components/MobileDialog.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { unifiedApi } from '@/utils/unified-api'
import { storage } from '@/composables/core/useLocalStorage'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { buildSubsidyRemarks, calculateSubsidyAmount } from '../subsidy-calculations'
import { logger } from '@/utils/logger'
import { formatAmount, formatDate } from '@/utils/format'
import type { MediaPreviewItem } from '@/utils/media'
import { convertPdfToImage, isPdfFile } from '@/utils/upload-media'
import type {
  NationalSubsidyApplyPayload,
  NationalSubsidyDevice,
  NationalSubsidyHandlerInfo,
  NationalSubsidyPhoneDetail,
  NationalSubsidyUploadResponse
} from '@/types'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


const AsyncImage = defineAsyncComponent(() => import('@/components/Image.vue'))

const props = defineProps<{
  modelValue: boolean
  isMobile: boolean
  canUpload: boolean
  canViewField: (_field: string) => boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submitted: []
}>()

const applyStep = ref(1)
const searchIdentifier = ref('')
const searching = ref(false)
const searchCompleted = ref(false)
const loadingDetail = ref(false)
const deviceList = ref<NationalSubsidyDevice[]>([])
const selectedDevice = ref<NationalSubsidyDevice | null>(null)
const phoneDetail = ref<NationalSubsidyPhoneDetail | null>(null)
const submitting = ref(false)
const applyFormTempPhotos = ref<string[]>([])
const showPhotoViewer = ref(false)
const currentPhotoIndex = ref(0)
const canUpload = computed(() => props.canUpload)
const canViewField = (field: string) => props.canViewField(field)
const showDeviceInfo = computed(() => [
  'brand', 'model', 'color', 'memory', 'imei1', 'imei2', 'serial_number'
].some(canViewField))
const searchCache = new Map<string, NationalSubsidyDevice[]>()

let searchAbortController: AbortController | null = null
let searchRequestSeq = 0

const applyForm = reactive({
  imei2: '',
  customer_idcard: '',
  remarks: '',
  subsidy_calc_price: null as number | null,
  subsidy_photos: [] as string[],
  has_different_handler: false,
  handler_name: '',
  handler_phone: '',
  handler_idcard: ''
})

const uploadHeaders = computed(() => {
  const token = storage.getToken()
  return {
    Authorization: token ? `Bearer ${token}` : ''
  }
})

const normalizeHandlerInfo = (handler_info?: NationalSubsidyHandlerInfo | null): NationalSubsidyHandlerInfo | null => {
  if (!handler_info || typeof handler_info !== 'object') return null
  return {
    ...handler_info,
    handler_name: normalizePersonName(handler_info.handler_name || '', 20),
    handler_phone: normalizePhoneDigits(handler_info.handler_phone || ''),
    handler_idcard: normalizeIdCard(handler_info.handler_idcard || '')
  }
}

const normalizeSubsidyRecord = <T extends NationalSubsidyDevice | NationalSubsidyPhoneDetail>(item?: T | null): T | null => {
  if (!item || typeof item !== 'object') return item ?? null
  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard('customer_idcard' in item ? item.customer_idcard || '' : ''),
    handler_info: normalizeHandlerInfo('handler_info' in item ? item.handler_info : null)
  } as T
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

type UploadError = Parameters<UploadRequestOptions['onError']>[0]

const toUploadError = (error: unknown, fallback: string): UploadError => {
  const message = error instanceof Error ? error.message : fallback
  return Object.assign(new Error(message), {
    name: 'UploadError',
    status: 0,
    method: 'POST',
    url: '/subsidy/upload/photo'
  }) as UploadError
}

const calculatedSubsidyAmount = computed(() => calculateSubsidyAmount(
  applyForm.subsidy_calc_price ?? 0,
  phoneDetail.value?.subsidy_rate ?? 15
))

const isEligibleForSubsidy = computed(() => {
  if (!applyForm.subsidy_calc_price) return false
  return applyForm.subsidy_calc_price <= 6000
})

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '待提交',
    completed: '已审批',
    approved: '已到账'
  }
  return statusMap[status] || status
}

const resetDeviceSearch = () => {
  searchIdentifier.value = ''
  deviceList.value = []
  selectedDevice.value = null
  searchCompleted.value = false
}

const resetApplyForm = () => {
  applyStep.value = 1
  resetDeviceSearch()
  phoneDetail.value = null
  applyForm.imei2 = ''
  applyForm.customer_idcard = ''
  applyForm.remarks = ''
  applyForm.subsidy_calc_price = null
  applyForm.subsidy_photos = []
  applyFormTempPhotos.value = []
  applyForm.has_different_handler = false
  applyForm.handler_name = ''
  applyForm.handler_phone = ''
  applyForm.handler_idcard = ''
  showPhotoViewer.value = false
  currentPhotoIndex.value = 0
}

const cleanupTempFiles = async () => {
  if (applyFormTempPhotos.value.length === 0) return
  try {
    await deleteTempFiles(applyFormTempPhotos.value)
  } catch (error) {
    logger.error('清理申请表单临时照片失败:', error)
  }
}

const closeDialog = async () => {
  await cleanupTempFiles()
  searchAbortController?.abort()
  searchAbortController = null
  resetApplyForm()
  emit('update:modelValue', false)
}

const handleDialogChange = async (visible: boolean) => {
  if (!visible) {
    await closeDialog()
    return
  }

  emit('update:modelValue', true)
}

const searchPhones = async () => {
  const normalizedIdentifier = searchIdentifier.value.trim()
  if (!normalizedIdentifier) {
    globalNotifications.warning('请输入IMEI或序列号')
    return
  }

  const requestSeq = ++searchRequestSeq
  searchAbortController?.abort()
  searchAbortController = null

  try {
    searching.value = true
    searchCompleted.value = false
    selectedDevice.value = null
    await nextTick()

    const cachedResults = searchCache.get(normalizedIdentifier)
    if (cachedResults) {
      if (requestSeq !== searchRequestSeq) return
      deviceList.value = cachedResults
      return
    }

    searchAbortController = new AbortController()
    const currentController = searchAbortController

    const response = await unifiedApi.get<NationalSubsidyDevice[]>(`/subsidy/search-phones/${encodeURIComponent(normalizedIdentifier)}`, {
      signal: currentController.signal
    })

    if (requestSeq !== searchRequestSeq || currentController.signal.aborted) {
      return
    }

    if (response.success) {
      const normalizedResults = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item)).filter((item): item is NationalSubsidyDevice => item !== null)
        : []
      deviceList.value = normalizedResults
      searchCache.set(normalizedIdentifier, normalizedResults)
    } else {
      deviceList.value = []
      globalNotifications.error(response.message || '未找到设备')
    }
  } catch (error: unknown) {
    if (isAxiosError(error) && error.code === 'ERR_CANCELED'
      || error instanceof Error && (error.message === 'canceled' || error.name === 'CanceledError' || error.name === 'AbortError')) {
      return
    }
    deviceList.value = []
    logger.error('搜索设备失败:', error)
    globalNotifications.error(getErrorMessage(error, '搜索失败'))
  } finally {
    if (requestSeq === searchRequestSeq) {
      searching.value = false
      searchCompleted.value = true
      searchAbortController = null
    }
  }
}

const selectDevice = (device: NationalSubsidyDevice) => {
  selectedDevice.value = device
}

const loadPhoneDetail = async () => {
  if (!selectedDevice.value) return

  try {
    loadingDetail.value = true
    const response = await unifiedApi.get<NationalSubsidyPhoneDetail>(`/subsidy/phone-detail/${selectedDevice.value.phone_id}`)

    if (response.success) {
      const normalizedPhoneDetail = normalizeSubsidyRecord(response.data)
      if (!normalizedPhoneDetail) {
        throw new Error('获取详情响应为空')
      }
      phoneDetail.value = normalizedPhoneDetail
      applyForm.customer_idcard = normalizedPhoneDetail.customer_idcard || ''
      applyForm.subsidy_calc_price = normalizedPhoneDetail.sale_price

      applyForm.remarks = buildSubsidyRemarks({
        ...normalizedPhoneDetail,
        subsidy_amount: calculatedSubsidyAmount.value
      })

      applyStep.value = 2
    } else {
      globalNotifications.error(response.message || '获取详情失败')
    }
  } catch (error: unknown) {
    logger.error('获取详情失败:', error)
    globalNotifications.error(getErrorMessage(error, '获取详情失败'))
  } finally {
    loadingDetail.value = false
  }
}

const customUploadRequest = async (options: UploadRequestOptions) => {
  if (!canUpload.value) {
    globalNotifications.warning('您没有图片上传权限')
    options.onError?.(toUploadError(new Error('没有图片上传权限'), '没有图片上传权限'))
    return
  }

  const { file, onSuccess, onError } = options
  const isPdf = isPdfFile(file)
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isLt10M) {
    globalNotifications.error('文件大小不能超过10MB')
    onError?.(toUploadError(new Error('文件大小超过10MB'), '文件大小超过10MB'))
    return
  }

  let uploadFile: File = file
  if (isPdf) {
    try {
      globalNotifications.info('正在将PDF转换为图片...')
      uploadFile = await convertPdfToImage(file)
      globalNotifications.success('PDF转换成功，正在上传...')
    } catch (error) {
      globalNotifications.error('PDF转换图片失败')
      onError?.(toUploadError(error, 'PDF转换图片失败'))
      return
    }
  }

  const formData = new FormData()
  formData.append('file', uploadFile)
  formData.append('serial_number', phoneDetail.value?.serial_number || 'unknown')
  formData.append('sale_time', phoneDetail.value?.sale_time || '')
  formData.append('customer_name', phoneDetail.value?.customer_name || '')
  formData.append('has_different_handler', applyForm.has_different_handler ? '1' : '0')
  formData.append('handler_name', applyForm.handler_name || '')
  formData.append('is_new', phoneDetail.value?.is_new === undefined ? '' : String(phoneDetail.value.is_new))
  formData.append('inventory_time', phoneDetail.value?.inventory_time || '')

  try {
    const result = await unifiedApi.upload<NationalSubsidyUploadResponse>('/subsidy/upload/photo', formData, {
      headers: uploadHeaders.value
    })

    if (result?.success && result.data?.url) {
      applyForm.subsidy_photos.push(result.data.url)
      applyFormTempPhotos.value.push(result.data.url)
      globalNotifications.success('照片上传成功')
      onSuccess?.(result)
      return
    }

    const errorMessage = result?.message || '照片上传失败'
    globalNotifications.error(errorMessage)
    onError?.(toUploadError(new Error(errorMessage), errorMessage))
  } catch (error) {
    logger.error('上传请求失败:', error)
    globalNotifications.error('照片上传失败，请重试')
    onError?.(toUploadError(error, '照片上传失败'))
  }
}

const removePhoto = async (index: number) => {
  const removedPhoto = applyForm.subsidy_photos[index]
  if (!removedPhoto) return

  applyForm.subsidy_photos.splice(index, 1)

  const tempIndex = applyFormTempPhotos.value.indexOf(removedPhoto)
  if (tempIndex > -1) {
    applyFormTempPhotos.value.splice(tempIndex, 1)
  }

  const deleted = await deleteTempFiles([removedPhoto])
  if (!deleted) {
    logger.error('删除未保存照片失败:', removedPhoto)
  }
}

const previewMediaItems = computed<MediaPreviewItem[]>(() => applyForm.subsidy_photos.map((photo, index) => ({
  id: photo,
  url: photo,
  type: 'image',
  label: `国补照片 ${index + 1}`
})))

const removeCurrentPreviewPhoto = async (_item: MediaPreviewItem, index: number) => {
  if (applyForm.subsidy_photos.length === 0) {
    showPhotoViewer.value = false
    return
  }

  if (!canUpload.value) return
  await removePhoto(index)

  if (applyForm.subsidy_photos.length === 0) {
    showPhotoViewer.value = false
    currentPhotoIndex.value = 0
  }
}

const submitApply = async () => {
  if (submitting.value) return

  if (!phoneDetail.value) return

  applyForm.customer_idcard = normalizeIdCard(applyForm.customer_idcard || '')
  applyForm.handler_name = normalizePersonName(applyForm.handler_name || '', 20)
  applyForm.handler_phone = normalizePhoneDigits(applyForm.handler_phone || '')
  applyForm.handler_idcard = normalizeIdCard(applyForm.handler_idcard || '')

  if (!applyForm.imei2 || applyForm.imei2.trim() === '') {
    globalNotifications.warning('请输入IMEI2')
    return
  }

  if (applyForm.has_different_handler) {
    const missingHandlerField =
      (canViewField('handler_name') && !applyForm.handler_name.trim()) ||
      (canViewField('handler_phone') && !applyForm.handler_phone.trim()) ||
      (canViewField('handler_idcard') && !applyForm.handler_idcard.trim())
    if (missingHandlerField) {
      globalNotifications.warning('请完整填写实际办理人信息')
      return
    }
  }

  try {
    submitting.value = true
    const data: NationalSubsidyApplyPayload = {
      ...phoneDetail.value,
      imei2: applyForm.imei2.trim(),
      customer_idcard: applyForm.customer_idcard,
      remarks: applyForm.remarks,
      subsidy_photos: applyForm.subsidy_photos,
      subsidy_calc_price: applyForm.subsidy_calc_price || phoneDetail.value.sale_price,
      subsidy_amount: calculatedSubsidyAmount.value,
      has_different_handler: applyForm.has_different_handler,
      handler_info: applyForm.has_different_handler ? normalizeHandlerInfo({
        handler_name: applyForm.handler_name.trim(),
        handler_phone: applyForm.handler_phone.trim(),
        handler_idcard: applyForm.handler_idcard.trim()
      }) : null
    }

    const response = await unifiedApi.post('/subsidy/apply', data)
    if (response.success) {
      globalNotifications.success('国补资料记录成功')
      applyFormTempPhotos.value = []
      emit('submitted')
      resetApplyForm()
      emit('update:modelValue', false)
    } else {
      globalNotifications.error(response.message || '记录失败')
    }
  } catch (error: unknown) {
    logger.error('提交申请失败:', error)
    globalNotifications.error(getErrorMessage(error, '记录失败'))
  } finally {
    submitting.value = false
  }
}

const openPhotoViewer = (index: number) => {
  currentPhotoIndex.value = index
  showPhotoViewer.value = true
}

watch(
  () => props.modelValue,
  async (visible, prevVisible) => {
    if (!visible && prevVisible) {
      await cleanupTempFiles()
      resetApplyForm()
    }
  }
)
</script>

<style scoped lang="scss" src="./styles/subsidy-apply-dialog/form.scss"></style>
<style scoped lang="scss" src="./styles/subsidy-apply-dialog/details.scss"></style>
