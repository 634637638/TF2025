<template>
  <MobileDialog
    :model-value="modelValue"
    title="新建国补申请"
    width="900px"
    :force-fullscreen="isMobile"
    dialog-class="subsidy-dialog subsidy-dialog-wide"
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
          <h3>步骤1：搜索设备</h3>
          <p class="step-hint">
            输入IMEI或序列号，在搜索结果中选择正确的设备
          </p>

          <div class="search-box-input-only">
            <input
              v-model="searchIdentifier"
              type="text"
              class="search-input-lg"
              placeholder="输入IMEI或序列号..."
              @keyup.enter="searchPhones"
            >
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
                    ¥{{ device.sale_price?.toFixed(2) }}
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

          <div
            v-else-if="searchCompleted && deviceList.length === 0"
            class="empty-devices"
          >
            <i class="fas fa-search" />
            <p>未找到匹配的设备</p>
            <el-button
              type="info"
              @click="resetDeviceSearch"
            >
              重新搜索
            </el-button>
          </div>
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
                    <input
                      v-model="applyForm.customer_idcard"
                      type="text"
                      class="form-input-inline"
                      :class="{ 'has-value': applyForm.customer_idcard }"
                      placeholder="请输入身份证号"
                      @input="applyForm.customer_idcard = normalizeIdCard(applyForm.customer_idcard)"
                    >
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
                    <input
                      v-model="applyForm.handler_name"
                      type="text"
                      class="form-input-inline"
                      :class="{ 'has-value': applyForm.handler_name }"
                      placeholder="实际办理人姓名"
                      @input="applyForm.handler_name = normalizePersonName(applyForm.handler_name, 20)"
                    >
                  </div>
                </div>
                <div
                  v-if="canViewField('handler_phone')"
                  class="info-row"
                >
                  <span class="info-label required">电话:</span>
                  <div class="info-value">
                    <input
                      v-model="applyForm.handler_phone"
                      type="text"
                      class="form-input-inline"
                      :class="{ 'has-value': applyForm.handler_phone }"
                      placeholder="实际办理人电话"
                      @input="applyForm.handler_phone = normalizePhoneDigits(applyForm.handler_phone)"
                    >
                  </div>
                </div>
                <div
                  v-if="canViewField('handler_idcard')"
                  class="info-row"
                >
                  <span class="info-label required">身份证:</span>
                  <div class="info-value">
                    <input
                      v-model="applyForm.handler_idcard"
                      type="text"
                      class="form-input-inline"
                      :class="{ 'has-value': applyForm.handler_idcard }"
                      placeholder="实际办理人身份证"
                      @input="applyForm.handler_idcard = normalizeIdCard(applyForm.handler_idcard)"
                    >
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
                    <input
                      v-model="applyForm.imei2"
                      type="text"
                      class="form-input-inline"
                      :class="{ 'has-value': applyForm.imei2 }"
                      placeholder="请输入IMEI2"
                    >
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
                  <span class="info-value">¥{{ phoneDetail.sale_price?.toFixed(2) }}</span>
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
                  <span class="info-value">¥{{ Math.round(phoneDetail.sale_price) }}</span>
                </div>
                <div
                  v-if="canViewField('subsidy_amount')"
                  class="inline-item"
                >
                  <span class="info-label">补贴金额:</span>
                  <span class="info-value discount-amount">-¥{{ Math.round(calculatedSubsidyAmount) }}</span>
                </div>
                <div
                  v-if="canViewField('sale_price') && canViewField('subsidy_amount')"
                  class="inline-item"
                >
                  <span class="info-label">到手价格:</span>
                  <span class="info-value final-price">¥{{ Math.round(phoneDetail.sale_price - calculatedSubsidyAmount) }}</span>
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
                      <el-input-number
                        v-model="applyForm.subsidy_calc_price"
                        :precision="2"
                        :step="100"
                        :min="0"
                        :max="phoneDetail.sale_price"
                        :controls="true"
                        placeholder="国补计算价格"
                        style="width: 150px"
                      />
                    </div>
                    <el-upload
                      v-if="canUpload"
                      class="subsidy-photo-upload"
                      :show-file-list="false"
                      :http-request="customUploadRequest"
                      accept="image/*,.heic,.heif,.pdf,application/pdf"
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
                    (差价: ¥{{ (phoneDetail.sale_price - applyForm.subsidy_calc_price).toFixed(2) }})
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
              <textarea
                v-model="applyForm.remarks"
                class="form-textarea"
                rows="3"
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
        class="apply-dialog-footer"
      >
        <template v-if="applyStep === 1">
          <el-button
            type="default"
            @click="closeDialog"
          >
            取消
          </el-button>
          <el-button
            v-if="deviceList.length > 0"
            type="info"
            @click="resetDeviceSearch"
          >
            重新搜索
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
              text="加载中..."
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

  <el-dialog
    v-model="showPhotoViewer"
    :title="`照片预览 (${currentPhotoIndex + 1}/${applyForm.subsidy_photos.length})`"
    width="90%"
    append-to-body
    :z-index="4000"
    class="photo-viewer-dialog"
    destroy-on-close
  >
    <div class="photo-viewer-content">
      <div class="photo-viewer-main">
        <el-button
          class="photo-nav-btn prev"
          circle
          :disabled="currentPhotoIndex === 0"
          @click="prevPhoto"
        >
          <i class="fas fa-chevron-left" />
        </el-button>
        <div class="photo-viewer-image">
          <AsyncImage
            :src="applyForm.subsidy_photos[currentPhotoIndex]"
            alt="国补照片"
            mode="eager"
          />
        </div>
        <el-button
          class="photo-nav-btn next"
          circle
          :disabled="currentPhotoIndex === applyForm.subsidy_photos.length - 1"
          @click="nextPhoto"
        >
          <i class="fas fa-chevron-right" />
        </el-button>
      </div>
    </div>
    <template #footer>
      <div class="tf-dialog-actions photo-viewer-footer">
        <el-button
          v-if="canUpload"
          type="danger"
          plain
          @click="removeCurrentPreviewPhoto"
        >
          <i class="fas fa-trash-alt" />
          <span>删除当前图片</span>
        </el-button>
        <el-button
          type="primary"
          @click="showPhotoViewer = false"
        >
          <span>关闭预览</span>
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { unifiedApi } from '@/utils/unified-api'
import { storage } from '@/composables/core/useLocalStorage'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

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
const deviceList = ref<any[]>([])
const selectedDevice = ref<any>(null)
const phoneDetail = ref<any>(null)
const submitting = ref(false)
const applyFormTempPhotos = ref<string[]>([])
const showPhotoViewer = ref(false)
const currentPhotoIndex = ref(0)
const canUpload = computed(() => props.canUpload)
const canViewField = (field: string) => props.canViewField(field)
const showDeviceInfo = computed(() => [
  'brand', 'model', 'color', 'memory', 'imei1', 'imei2', 'serial_number'
].some(canViewField))
const searchCache = new Map<string, any[]>()

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

const calculatedSubsidyAmount = computed(() => {
  if (!phoneDetail.value || !applyForm.subsidy_calc_price) return 0
  const calcPrice = applyForm.subsidy_calc_price
  const subsidyRate = phoneDetail.value.subsidy_rate || 15
  if (calcPrice > 6000) return 0
  return Math.min(calcPrice * (subsidyRate / 100), 500)
})

const isEligibleForSubsidy = computed(() => {
  if (!applyForm.subsidy_calc_price) return false
  return applyForm.subsidy_calc_price <= 6000
})

const formatDate = (date: string) => date ? TimeUtil.format(date, TIME_FORMATS.DATE) : '-'

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
    ElMessage.warning('请输入IMEI或序列号')
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

    const response = await unifiedApi.get(`/subsidy/search-phones/${encodeURIComponent(normalizedIdentifier)}`, {
      signal: currentController.signal
    })

    if (requestSeq !== searchRequestSeq || currentController.signal.aborted) {
      return
    }

    if (response.success) {
      const normalizedResults = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item))
        : []
      deviceList.value = normalizedResults
      searchCache.set(normalizedIdentifier, normalizedResults)
    } else {
      deviceList.value = []
      ElMessage.error(response.message || '未找到设备')
    }
  } catch (error: any) {
    if (
      error?.code === 'ERR_CANCELED' ||
      error?.message === 'canceled' ||
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError'
    ) {
      return
    }
    deviceList.value = []
    logger.error('搜索设备失败:', error)
    ElMessage.error(error.response?.data?.message || '搜索失败')
  } finally {
    if (requestSeq === searchRequestSeq) {
      searching.value = false
      searchCompleted.value = true
      searchAbortController = null
    }
  }
}

const selectDevice = (device: any) => {
  selectedDevice.value = device
}

const loadPhoneDetail = async () => {
  if (!selectedDevice.value) return

  try {
    loadingDetail.value = true
    const response = await unifiedApi.get(`/subsidy/phone-detail/${selectedDevice.value.phone_id}`)

    if (response.success) {
      const normalizedPhoneDetail = normalizeSubsidyRecord(response.data)
      phoneDetail.value = normalizedPhoneDetail
      applyForm.customer_idcard = normalizedPhoneDetail.customer_idcard || ''
      applyForm.subsidy_calc_price = normalizedPhoneDetail.sale_price

      const salePrice = normalizedPhoneDetail.sale_price || 0
      nextTick(() => {
        if (salePrice > 6000) {
          applyForm.remarks = `商品销售价${salePrice}元（超过6000元，无法享受国补优惠）`
          return
        }

        const subsidyAmount = Math.min(salePrice * 0.15, 500)
        const cardPayment = (salePrice - subsidyAmount).toFixed(2)
        const sn = normalizedPhoneDetail.serial_number || ''
        const st = normalizedPhoneDetail.sale_time ? TimeUtil.format(normalizedPhoneDetail.sale_time, TIME_FORMATS.DATE) : ''
        applyForm.remarks = `序列号：${sn}\n购买时间：${st}\n商品售价：${salePrice}元 国补优惠${subsidyAmount}元 实际刷卡支付${cardPayment}元`
      })

      applyStep.value = 2
    } else {
      ElMessage.error(response.message || '获取详情失败')
    }
  } catch (error: any) {
    logger.error('获取详情失败:', error)
    ElMessage.error(error.response?.data?.message || '获取详情失败')
  } finally {
    loadingDetail.value = false
  }
}

const convertPDFToImage = async (pdfFile: File): Promise<File> => {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js'

  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 3.0 })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: context,
    viewport,
    canvas
  }).promise

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob!), 'image/jpeg', 1.0)
  })

  return new File([blob], pdfFile.name.replace('.pdf', '.jpg'), { type: 'image/jpeg' })
}

const customUploadRequest = async (options: any) => {
  if (!canUpload.value) {
    ElMessage.warning('您没有图片上传权限')
    options.onError?.(new Error('没有图片上传权限'))
    return
  }

  const { file, onSuccess, onError } = options
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB')
    onError?.(new Error('文件大小超过10MB'))
    return
  }

  let uploadFile = file
  if (isPdf) {
    try {
      ElMessage.info('正在将PDF转换为图片...')
      uploadFile = await convertPDFToImage(file)
      ElMessage.success('PDF转换成功，正在上传...')
    } catch (error) {
      ElMessage.error('PDF转换图片失败')
      onError?.(error)
      return
    }
  }

  const formData = new FormData()
  formData.append('file', uploadFile)
  formData.append('serial_number', phoneDetail.value?.serial_number || 'unknown')
  formData.append('sale_time', phoneDetail.value?.sale_time || '')

  try {
    const result = await unifiedApi.upload('/subsidy/upload/photo', formData, {
      headers: uploadHeaders.value
    })

    if (result?.success && result.data?.url) {
      applyForm.subsidy_photos.push(result.data.url)
      applyFormTempPhotos.value.push(result.data.url)
      ElMessage.success('照片上传成功')
      onSuccess?.(result)
      return
    }

    const errorMessage = result?.message || '照片上传失败'
    ElMessage.error(errorMessage)
    onError?.(new Error(errorMessage))
  } catch (error) {
    logger.error('上传请求失败:', error)
    ElMessage.error('照片上传失败，请重试')
    onError?.(error)
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

const removeCurrentPreviewPhoto = async () => {
  if (applyForm.subsidy_photos.length === 0) {
    showPhotoViewer.value = false
    return
  }

  await removePhoto(currentPhotoIndex.value)

  if (applyForm.subsidy_photos.length === 0) {
    showPhotoViewer.value = false
    currentPhotoIndex.value = 0
    return
  }

  if (currentPhotoIndex.value >= applyForm.subsidy_photos.length) {
    currentPhotoIndex.value = applyForm.subsidy_photos.length - 1
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
    ElMessage.warning('请输入IMEI2')
    return
  }

  if (applyForm.has_different_handler) {
    const missingHandlerField =
      (canViewField('handler_name') && !applyForm.handler_name.trim()) ||
      (canViewField('handler_phone') && !applyForm.handler_phone.trim()) ||
      (canViewField('handler_idcard') && !applyForm.handler_idcard.trim())
    if (missingHandlerField) {
      ElMessage.warning('请完整填写实际办理人信息')
      return
    }
  }

  try {
    submitting.value = true
    const data = {
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
      ElMessage.success('国补资料记录成功')
      applyFormTempPhotos.value = []
      emit('submitted')
      resetApplyForm()
      emit('update:modelValue', false)
    } else {
      ElMessage.error(response.message || '记录失败')
    }
  } catch (error: any) {
    logger.error('提交申请失败:', error)
    ElMessage.error(error.response?.data?.message || '记录失败')
  } finally {
    submitting.value = false
  }
}

const openPhotoViewer = (index: number) => {
  currentPhotoIndex.value = index
  showPhotoViewer.value = true
}

const prevPhoto = () => {
  if (currentPhotoIndex.value > 0) currentPhotoIndex.value--
}

const nextPhoto = () => {
  if (currentPhotoIndex.value < applyForm.subsidy_photos.length - 1) currentPhotoIndex.value++
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

<style scoped lang="scss">
.modal-body {
  padding: 0;
}

.apply-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.apply-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box-input-only {
  margin-bottom: 20px;
}

.search-input-lg,
.form-input-inline,
.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--tf-color-neutral-300);
  border-radius: 8px;
  outline: none;

  &:focus {
    border-color: var(--tf-color-indigo-brand);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
  }
}

.device-list,
.info-group {
  background: var(--tf-color-surface-muted);
  border: 1px solid var(--tf-color-border-muted);
  border-radius: 12px;
  padding: 16px;
}

.device-list-header {
  margin-bottom: 12px;
}

.device-list-container {
  max-height: 400px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 10px;
  background: white;
  border: 1px solid var(--tf-color-neutral-200);
  cursor: pointer;

  &.selected {
    border-color: var(--tf-color-indigo-brand);
    background: var(--tf-color-indigo-50);
  }
}

.device-main {
  flex: 1;
  min-width: 0;
}

.device-model {
  font-size: 1rem;
  font-weight: 600;
  color: var(--tf-color-heading);
  margin-bottom: 6px;
}

.device-specs {
  font-size: 0.875rem;
  color: var(--tf-color-muted);
  margin-bottom: 8px;
}

.device-identifiers {
  font-size: 0.75rem;
  color: var(--tf-color-gray-bootstrap-500);

  span {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    word-break: break-all;

    i {
      font-size: 0.875rem;
    }
  }
}

.device-customer {
  font-size: 0.8125rem;
  color: var(--tf-color-indigo-brand);
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--tf-color-border-muted);

  span {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    word-break: break-all;

    i {
      font-size: 0.875rem;
    }
  }
}

.device-meta {
  text-align: right;
}

.device-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--tf-color-heading);
  margin-bottom: 8px;
}

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  &.eligible {
    background: var(--tf-status-success-bg);
    color: var(--tf-status-success-color);
    border: 1px solid var(--tf-status-success-border);
  }

  &.not-eligible {
    background: var(--tf-status-danger-bg);
    color: var(--tf-status-danger-color);
    border: 1px solid var(--tf-status-danger-border);
  }
}

.device-identifiers,
.device-customer,
.info-row-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.confirm-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirm-step h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--tf-color-heading);
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--tf-color-border-muted);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  width: 100px;
  flex-shrink: 0;
  color: var(--tf-color-muted);
  font-size: 14px;
  font-weight: 500;
}

.info-value {
  flex: 1;
  min-width: 0;
  color: var(--tf-color-heading);
  font-size: 14px;
  font-weight: 500;
  word-break: break-word;
}

.info-value .form-input-inline {
  width: 100%;
  max-width: 300px;
  padding: 6px 12px;
  border: 1px solid var(--tf-color-border-subtle);
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;

  &.has-value {
    background: var(--tf-color-green-50);
    border-color: var(--tf-color-green-300);
  }

  &:focus {
    outline: none;
    border-color: var(--tf-color-indigo-brand);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
}

.handler-info-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.checkbox-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
  padding: 8px 12px;
  background: var(--color-bg-white);
  border-radius: 6px;
  transition: background 0.2s;
}

.checkbox-inline:hover {
  background: var(--tf-color-amber-100);
}

.checkbox-inline input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--tf-color-amber-500);
}

.checkbox-inline span {
  flex: 1;
}

.info-row-inline {
  padding: 10px 0;
  border-bottom: 1px solid var(--tf-color-border-muted);
  gap: 24px;
}

.info-row-inline:last-child {
  border-bottom: none;
}

.inline-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-item .info-label {
  width: auto;
  white-space: nowrap;
}

.inline-item .info-value {
  color: var(--tf-color-heading);
  font-size: 14px;
  font-weight: 500;
}

.inline-item .info-value .form-input-inline {
  min-width: 200px;
  max-width: none;
}

.info-group.highlight {
  background: linear-gradient(135deg, var(--tf-color-emerald-100), var(--tf-color-emerald-200));
  border-color: var(--tf-color-emerald-300);
}

.info-group.handler-info-section {
  background: var(--tf-color-amber-50);
  border-color: var(--tf-color-amber-200);
}

.handler-info-header h4 {
  margin-bottom: 0;
}

.handler-info-content {
  animation: slideDown 0.3s ease-out;
}

.subsidy-photo-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subsidy-photo-inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  width: 100%;
}

.subsidy-calc-input-wrap {
  flex: 0 0 auto;
}

.subsidy-photo-upload {
  flex-shrink: 0;
}

.uploaded-photos-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.photo-thumbnail {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid var(--tf-color-gray-material-300);

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.photo-preview-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(15, 23, 42, 0.34);
  color: var(--color-bg-white);
  font-size: 10px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.photo-thumbnail:hover .photo-preview-mask {
  opacity: 1;
}

.remove-photo {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(220, 53, 69, 0.9);
  color: var(--color-bg-white);
  font-size: 10px;
}

.photo-action-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--tf-color-slate-500);
}

.discount-amount {
  color: var(--tf-color-orange-tailwind-500);
  font-weight: 600;
}

.final-price {
  color: var(--tf-color-red-500);
  font-weight: 700;
  font-size: 1.2rem;
}

.subsidy-warning,
.existing-subsidy-warning {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.subsidy-warning {
  margin-top: 12px;
  padding: 12px;
  background: var(--tf-color-red-100);
  color: var(--tf-color-red-500);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.existing-subsidy-warning {
  margin-top: 12px;
  padding: 12px;
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-amber-500);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.price-diff-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--tf-color-amber-500);
  font-weight: 500;
  word-break: break-word;
}

.photo-viewer-main {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: var(--tf-color-surface-soft);
  border-radius: 8px;
  padding: 20px;
}

.photo-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);

  &.prev {
    left: 16px;
  }

  &.next {
    right: 16px;
  }
}

.photo-viewer-image {
  max-width: calc(100% - 100px);

  :deep(img) {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }
}

.photo-viewer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.photo-viewer-dialog) {
  z-index: 4000 !important;
}

:deep(.photo-viewer-dialog .el-overlay) {
  z-index: 4000 !important;
}

:deep(.photo-viewer-dialog .el-dialog) {
  z-index: 4001 !important;
}

@media (max-width: 768px) {
  .device-item,
  .handler-info-header,
  .info-row {
    flex-direction: column;
  }

  .info-label {
    width: auto;
  }

  .info-row-inline {
    flex-wrap: wrap;
    gap: 12px;
  }

  .inline-item {
    width: 100%;
  }

  .inline-item .info-value {
    flex: 1;
  }

  .inline-item .info-value .form-input-inline,
  .info-value .form-input-inline {
    width: 100%;
    min-width: 0;
    max-width: none;
  }

  .price-diff-hint {
    margin-top: 4px;
    font-size: 11px;
    text-align: left;
    white-space: nowrap;
  }

  .subsidy-photo-inline-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }

  .subsidy-calc-input-wrap {
    width: 100%;
    min-width: 0;
  }

  :deep(.el-input-number) {
    width: 100% !important;
    min-width: 0;
  }

  .subsidy-photo-upload {
    width: 100%;
    flex-shrink: 0;
  }

  .subsidy-photo-upload :deep(.el-upload) {
    width: 100%;
  }

  .photo-upload-btn {
    width: 100%;
    padding-inline: 10px;
    justify-content: center;
  }

  .photo-upload-btn span {
    white-space: nowrap;
  }

  .photo-viewer-main {
    min-height: 280px;
  }

  .photo-preview-mask {
    opacity: 1;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.04) 0%, rgba(15, 23, 42, 0.42) 100%);
    align-items: flex-start;
    justify-content: flex-end;
    padding: 6px;
    font-size: 9px;
  }

  .photo-viewer-footer {
    justify-content: stretch;

    :deep(.el-button) {
      flex: 1;
    }
  }
}
</style>
