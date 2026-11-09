<!--
  PublishToH5Modal - 商城
  功能：设置商品验机信息、上传图片
-->
<template>
  <MobileDialog
    v-model="visible"
    title="商城"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    dialog-class="publish-to-h5-dialog crud-dialog-md-lg"
    :show-default-footer="false"
    @close="handleClose"
  >
    <SectionLoading
      v-if="loadingPhoneData"
      text="加载商品信息中..."
    />
    <div v-else-if="loadError">
      <el-alert
        title="商品信息加载失败，请重试后再保存"
        type="error"
        :closable="false"
      />
      <div class="tf-dialog-toolbar">
        <el-button
          class="tf-button--refresh"
          @click="loadPhoneData"
        >
          重新加载
        </el-button>
      </div>
    </div>
    <el-form
      v-else
      :model="form"
      :disabled="busy || !canEdit"
      class="publish-to-h5-form"
      :label-width="isCompactLayout ? 'auto' : '90px'"
      :label-position="isCompactLayout ? 'top' : 'right'"
    >
      <template v-if="isNewPhone">
        <el-descriptions
          :column="1"
          border
        >
          <el-descriptions-item
            label="商城模板"
            label-class-name="whitespace-nowrap"
          >
            {{ templatePreview ? templatePreview.template_name || '未命名模板' : '未匹配模板' }}
          </el-descriptions-item>
          <el-descriptions-item
            label="商城状态"
            label-class-name="whitespace-nowrap"
          >
            <el-switch
              v-model="isPublished"
              :active-value="1"
              :inactive-value="0"
              active-text="已上架"
              inactive-text="已下架"
              aria-label="商城上架"
              inline-prompt
            />
          </el-descriptions-item>
          <el-descriptions-item
            v-if="templatePreview"
            label="商品介绍"
            label-class-name="whitespace-nowrap"
          >
            {{ templatePreview.description || '暂无介绍' }}
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="!templatePreview"
          title="尚未匹配启用的商城模板，请到 H5 商城模板管理中维护。"
          type="warning"
          :closable="false"
        />
        <div
          v-if="templatePreview?.images?.length"
          class="publish-to-h5-media"
        >
          <div class="image-grid">
            <div
              v-for="media in templatePreview.images"
              :key="media.id"
              class="publish-to-h5-media-card"
            >
              <video
                v-if="isVideoMedia(media)"
                class="publish-to-h5-media-thumb"
                :src="formatImageUrl(media.image_url)"
                controls
                preload="metadata"
              />
              <Image
                v-else
                class="publish-to-h5-media-thumb"
                :src="formatImageUrl(media.image_url)"
                alt="模板商品图片"
              />
            </div>
          </div>
        </div>
      </template>
      <div
        v-else
        class="publish-to-h5-grid"
      >
        <!-- 左列 -->
        <div class="publish-to-h5-column">
          <!-- 销售价格 -->
          <el-form-item label="销售价格">
            <el-input
              v-model="salePriceDisplayValue"
              class="publish-to-h5-control publish-to-h5-input-control w-full"
              placeholder="请输入销售价格"
              clearable
              inputmode="decimal"
            >
              <template #prefix>
                ¥
              </template>
            </el-input>
          </el-form-item>

          <!-- 二手商品验机信息 -->
          <template v-if="!isNewPhone">
            <!-- 商品成色 -->
            <el-form-item label="商品成色">
              <el-select
                v-model="form.condition_grade"
                class="publish-to-h5-control publish-to-h5-select-control w-full"
                placeholder="请选择商品成色"
                filterable
                allow-create
                teleported
                fit-input-width
                popper-class="tf2025-form-popper"
              >
                <el-option
                  label="靓机"
                  value="靓机"
                />
                <el-option
                  label="工作机"
                  value="工作机"
                />
                <el-option
                  label="99新"
                  value="99新"
                />
                <el-option
                  label="98新"
                  value="98新"
                />
                <el-option
                  label="97新"
                  value="97新"
                />
                <el-option
                  label="95新"
                  value="95新"
                />
                <el-option
                  label="小花"
                  value="小花"
                />
                <el-option
                  label="大花"
                  value="大花"
                />
                <el-option
                  label="外爆"
                  value="外爆"
                />
                <el-option
                  label="内爆"
                  value="内爆"
                />
              </el-select>
            </el-form-item>

            <!-- 电池状况 -->
            <el-form-item label="电池状况">
              <el-input
                v-model="batteryDisplayValue"
                class="publish-to-h5-control publish-to-h5-input-control"
                placeholder="电池情况"
                clearable
                @input="handleBatteryInput"
              >
                <template
                  v-if="isBatteryNumeric"
                  #suffix
                >
                  %
                </template>
              </el-input>
            </el-form-item>

            <!-- 系统版本 -->
            <el-form-item label="系统版本">
              <el-input
                v-model="form.system_version"
                class="publish-to-h5-control publish-to-h5-input-control"
                placeholder="如：iOS 17.2"
                clearable
              />
            </el-form-item>
          </template>
        </div>

        <!-- 右列 -->
        <div class="publish-to-h5-column">
          <template v-if="!isNewPhone">
            <!-- 屏幕状况 -->
            <el-form-item label="屏幕状况">
              <el-select
                v-model="form.screen_condition"
                class="publish-to-h5-control publish-to-h5-select-control w-full"
                placeholder="请选择屏幕状况"
                teleported
                fit-input-width
                popper-class="tf2025-form-popper"
              >
                <el-option
                  label="全原"
                  value="original"
                />
                <el-option
                  label="换原屏"
                  value="replaced_original"
                />
                <el-option
                  label="国产屏幕"
                  value="domestic"
                />
                <el-option
                  label="原换盖板"
                  value="replaced_glass"
                />
              </el-select>
            </el-form-item>

            <!-- 销售版本 -->
            <el-form-item label="销售版本">
              <el-select
                v-model="form.model_version"
                class="publish-to-h5-control publish-to-h5-select-control w-full"
                placeholder="请选择销售版本"
                filterable
                clearable
                teleported
                fit-input-width
                popper-class="tf2025-form-popper"
              >
                <el-option
                  label="国行"
                  value="国行"
                />
                <el-option
                  label="美版"
                  value="美版"
                />
                <el-option
                  label="日版"
                  value="日版"
                />
                <el-option
                  label="港版"
                  value="港版"
                />
                <el-option
                  label="奥版"
                  value="奥版"
                />
                <el-option
                  label="加拿大"
                  value="加拿大"
                />
              </el-select>
            </el-form-item>

            <!-- 保修日期 -->
            <el-form-item label="保修日期">
              <div class="publish-to-h5-warranty-row">
                <el-date-picker
                  v-model="form.warranty_date"
                  class="publish-to-h5-control publish-to-h5-picker-control flex-1"
                  type="date"
                  placeholder="选择保修日期"
                  :value-format="TIME_FORMATS.DATE"
                  :disabled="form.is_warranty_expired"
                  teleported
                  popper-class="tf2025-form-popper"
                />
                <el-checkbox
                  v-model="form.is_warranty_expired"
                  @change="handleWarrantyExpiredChange"
                >
                  已过保
                </el-checkbox>
              </div>
            </el-form-item>
          </template>
        </div>
      </div>

      <!-- 商品素材（跨两列） -->
      <el-form-item
        v-if="!isNewPhone"
        label="商品素材"
        class="publish-to-h5-media-field"
      >
        <div class="publish-to-h5-media">
          <div class="tf-dialog-toolbar">
            <el-upload
              class="flex items-center"
              :show-file-list="false"
              :before-upload="beforeMediaUpload"
              :http-request="handleMediaUpload"
              :accept="MEDIA_UPLOAD_ACCEPT"
              :disabled="uploading"
              multiple
              :auto-upload="false"
              :on-change="handleFileChange"
            >
              <el-button
                type="primary"
                :loading="uploading"
                :disabled="uploading"
              >
                <i class="fas fa-upload" />
                <span class="ml-2">上传图片</span>
              </el-button>
            </el-upload>
            <el-switch
              v-model="isPublished"
              :active-value="1"
              :inactive-value="0"
              active-text="上架"
              inactive-text="下架"
              aria-label="商城上架"
              inline-prompt
            />
          </div>

          <!-- 待上传文件预览 -->
          <div
            v-if="pendingFiles.length > 0"
            class="mt-4"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-gray-600">待上传文件 ({{ pendingFiles.length }})</span>
              <el-button
                type="primary"
                size="small"
                :loading="uploading"
                @click="uploadPendingFiles"
              >
                开始上传
              </el-button>
            </div>
            <div class="image-grid">
              <div
                v-for="(file, index) in pendingFiles"
                :key="index"
                class="publish-to-h5-media-card is-pending"
                @click="openPendingMediaPreview(index)"
              >
                <!-- 视频预览 -->
                <video
                  v-if="isVideoMedia({ type: file.raw?.type, name: file.name, url: file.url })"
                  :src="previewUrl(file)"
                  class="publish-to-h5-media-thumb is-previewable"
                  muted
                  playsinline
                  preload="metadata"
                />
                <!-- 图片预览 -->
                <Image
                  v-else
                  :src="previewUrl(file)"
                  alt="预览"
                  mode="eager"
                  class="publish-to-h5-media-thumb is-previewable"
                />

                <!-- 文件类型标记 -->
                <div class="image-badge">
                  <i :class="isVideoMedia({ type: file.raw?.type, name: file.name, url: file.url }) ? 'fas fa-video' : 'fas fa-image'" />
                  {{ isVideoMedia({ type: file.raw?.type, name: file.name, url: file.url }) ? '视频' : '图片' }}
                </div>

                <!-- 移除按钮 -->
                <div
                  class="image-delete-btn"
                  @click.stop="removePendingFile(index)"
                >
                  <i class="fas fa-times text-white text-xs" />
                </div>
              </div>
            </div>
          </div>

          <!-- 已上传视频预览 -->
          <div
            v-if="productVideo"
            class="mt-3"
          >
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <video
                :src="formatImageUrl(productVideo)"
                class="video-thumbnail"
                controls
              />
              <div class="flex-1">
                <div class="text-xs text-gray-500">
                  已上传视频
                </div>
                <el-button
                  type="danger"
                  size="small"
                  @click="deleteVideo"
                >
                  <i class="fas fa-trash" /> 删除
                </el-button>
              </div>
            </div>
          </div>

          <!-- 图片列表（支持拖拽排序） -->
          <draggable
            v-if="images.length > 0"
            v-model="images"
            :animation="200"
            handle=".drag-handle"
            item-key="id"
            class="image-grid mt-4"
            @end="handleImageDragEnd"
          >
            <template #item="{ element: image }">
              <div
                class="publish-to-h5-media-card"
                @click="openUploadedMediaPreview(image)"
              >
                <!-- 视频显示 -->
                <video
                  v-if="isVideoMedia(image)"
                  :src="formatImageUrl(image.image_url)"
                  class="publish-to-h5-media-thumb is-previewable"
                  muted
                  playsinline
                  preload="metadata"
                />
                <!-- 图片显示 -->
                <Image
                  v-else
                  :src="image.image_url"
                  alt="商品图片"
                  mode="eager"
                  class="publish-to-h5-media-thumb is-previewable"
                />

                <!-- 拖拽手柄 - 左上角 -->
                <div class="drag-handle drag-handle-absolute">
                  <i class="fas fa-grip-vertical text-white text-xs" />
                </div>

                <!-- 主图标记 - 左下角 -->
                <div
                  v-if="image.is_primary"
                  class="image-primary-tag"
                >
                  主图
                </div>

                <!-- 删除按钮 - 始终显示在右上角 -->
                <div
                  class="image-delete-btn"
                  @click.stop="deleteImage(image)"
                >
                  <i class="fas fa-times text-white text-xs" />
                </div>

                <!-- 设置主图按钮 - 悬停时显示 -->
                <div class="image-actions">
                  <div
                    v-if="!image.is_primary && !isVideoMedia(image)"
                    class="image-set-primary-btn"
                    @click.stop="setPrimaryImage(image)"
                  >
                    <i class="fas fa-star text-danger text-sm" />
                  </div>
                </div>

                <!-- 视频标记 -->
                <div
                  v-if="isVideoMedia(image)"
                  class="image-badge"
                >
                  <i class="fas fa-video" />
                  视频
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="tf-dialog-actions publish-to-h5-footer">
        <el-button
          type="default"
          :disabled="busy"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          v-permission="'inventory:edit'"
          type="primary"
          :loading="saving"
          :disabled="loadingPhoneData || loadError || uploading || isProcessingFiles || !canEdit"
          @click="handleSave"
        >
          保存
        </el-button>
      </div>
    </template>
  </MobileDialog>

  <MediaPreviewViewer
    v-model="showMediaPreview"
    :items="previewMediaItems"
    :initial-index="previewMediaIndex"
  />
</template>

<script setup lang="ts">
import { TIME_FORMATS } from '@/utils/time'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import draggable from 'vuedraggable'
import { ref, computed, watch } from 'vue'

import type { CheckboxValueType, UploadFile, UploadFiles, UploadRequestOptions } from 'element-plus'
import { unifiedApi as api } from '@/utils/unified-api'
import { formatImageUrl } from '@/utils/format'
import Image from './Image.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'
import { MEDIA_UPLOAD_ACCEPT, isPdfFile, prepareMediaFile } from '@/utils/upload-media'
import type { ModelValueProps, SuccessEmits, UpdateModelValueEmits } from '@/types'
import {
  applyPublishConversionResults,
  buildPublishInspectionForm,
  buildConvertedPublishFile,
  createDefaultPublishForm,
  ensurePublishPendingFileUrl,
  filterValidPublishFiles,
  findUploadedVideoUrl,
  getPublishUploadEndpoint,
  getPublishUploadFieldName,
  getNewPublishFiles,
  getRemovedPublishFiles,
  hasPublishMediaFiles,
  isHeicFormat,
  normalizePublishSalePrice,
  revokePendingFileUrls,
  validatePublishMediaFile
} from './publish-to-h5/helpers'
import type {
  HeicConverter,
  PendingUploadFile,
  PublishFormState,
  PublishInspectionResponse,
  PhoneH5Configuration,
  UploadResult,
  UploadedMediaItem
} from './publish-to-h5/types'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


interface Props extends ModelValueProps {
  phoneId: number | null
}

const props = defineProps<Props>()
const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()

const { canEdit, handleNoPermission } = usePagePermissions('inventory')
const { screenSize } = useMobile()
const isCompactLayout = computed(() => screenSize.value.width > 0 && screenSize.value.width <= 768)

// 对话框显示状态
const visible = computed({
  get: () => props.modelValue,
  set: (val) => {
    if (!val && busy.value) return
    emit('update:modelValue', val)
  }
})

// 表单数据
const form = ref<PublishFormState>(createDefaultPublishForm())

// 图片相关
const images = ref<UploadedMediaItem[]>([])
const uploadedMediaIds = ref<number[]>([])
const uploading = ref(false)
const saving = ref(false)
const isNewPhone = ref(false) // 是否全新机
const isPublished = ref<0 | 1>(1)
const templatePreview = ref<PhoneH5Configuration['template']>(null)
const loadError = ref(false)
const loadingPhoneData = ref(true) // 加载商品数据中
const showMediaPreview = ref(false)
const previewMediaItems = ref<MediaPreviewItem[]>([])
const previewMediaIndex = ref(0)

// 视频相关
const productVideo = ref('')

// 待上传文件列表
const pendingFiles = ref<PendingUploadFile[]>([])
// 文件处理标志（防止重复触发）
const isProcessingFiles = ref(false)
const busy = computed(() => saving.value || uploading.value || isProcessingFiles.value)
// 跟踪已处理的文件 UID（包括已删除的）
const processedFileUids = ref<Set<string>>(new Set())
let heicConverterLoader: Promise<HeicConverter> | null = null

// 电池状况显示值
const batteryDisplayValue = ref('')
const salePriceDisplayValue = computed({
  get: () => {
    const value = form.value.sale_price
    return value === null || value === undefined ? '' : String(value)
  },
  set: (value: string) => {
    form.value.sale_price = normalizePublishSalePrice(value)
  }
})

const isBatteryNumeric = computed(() => {
  const val = batteryDisplayValue.value
  return val !== '' && !isNaN(Number(val))
})

const applyInspectionData = (inspectionData: PublishInspectionResponse | null | undefined) => {
  const inspectionState = buildPublishInspectionForm(inspectionData)
  form.value = inspectionState.formData
  batteryDisplayValue.value = inspectionState.batteryDisplayValue
}

const resetUploadState = () => {
  isProcessingFiles.value = false
  processedFileUids.value.clear()
  revokePendingFileUrls(pendingFiles.value)
  pendingFiles.value = []
}

const cleanupUnsavedUploadedMedia = async () => {
  const mediaIds = [...uploadedMediaIds.value]
  uploadedMediaIds.value = []

  if (!props.phoneId || mediaIds.length === 0) {
    return
  }

  const results = await Promise.allSettled(
    mediaIds.map(mediaId => api.delete(`/phones/${props.phoneId}/images/${mediaId}`))
  )
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn('清理未保存商品素材失败:', {
        mediaId: mediaIds[index],
        error: result.reason
      })
    }
  })
}

const resetPublishState = () => {
  resetUploadState()
  form.value = createDefaultPublishForm()
  batteryDisplayValue.value = ''
  isNewPhone.value = false
  isPublished.value = 1
  templatePreview.value = null
  loadError.value = false
  images.value = []
  productVideo.value = ''
  showMediaPreview.value = false
  previewMediaItems.value = []
  previewMediaIndex.value = 0
}

// 处理电池输入
const handleBatteryInput = (value: string) => {
  batteryDisplayValue.value = value
  // 更新 form.battery_status
  if (value === '') {
    form.value.battery_status = null
  } else if (!isNaN(Number(value))) {
    // 纯数字，转换为数字存储
    form.value.battery_status = parseInt(value)
  } else {
    // 包含文字，直接存储字符串
    form.value.battery_status = value
  }
}

// 监听对话框打开
const loadPhoneData = async () => {
  if (!props.phoneId) return

  loadingPhoneData.value = true
  await cleanupUnsavedUploadedMedia()
  resetPublishState()

  try {
    const configuration = await api.get<PhoneH5Configuration>(`/phones/${props.phoneId}/h5-product`, {
      useCache: false, showLoading: false, showError: false
    })
    if (!configuration.success || !configuration.data) throw new Error('无法读取商品配置')
    const product = configuration.data
    isNewPhone.value = Number(product.is_new) === 1
    if (product.is_published !== 0 && product.is_published !== 1) throw new Error('商城上架状态无效')
    isPublished.value = product.is_published
    templatePreview.value = product.template

    if (!isNewPhone.value) {
      applyInspectionData(product)
      const imagesRes = await api.get<UploadedMediaItem[]>(`/phones/${props.phoneId}/images`, {
        useCache: false, showLoading: false, showError: false
      })
      if (!imagesRes.success || !Array.isArray(imagesRes.data)) throw new Error('无法读取商品素材')
      images.value = imagesRes.data
      productVideo.value = findUploadedVideoUrl(images.value)
    }
  } catch (error) {
    loadError.value = true
    logger.error('加载数据失败:', error)
  } finally {
    loadingPhoneData.value = false
  }
}

// 首次挂载且弹窗已打开时也要立即回填编辑数据
watch(
  () => [props.modelValue, props.phoneId] as const,
  async ([isOpen, phoneId], previousState) => {
    const [wasOpen, previousPhoneId] = previousState ?? [false, null]

    if (!isOpen) {
      await cleanupUnsavedUploadedMedia()
      resetUploadState()
      return
    }

    if (!phoneId) {
      return
    }

    const shouldLoad = !wasOpen || phoneId !== previousPhoneId
    if (shouldLoad) {
      await loadPhoneData()
    }
  },
  { immediate: true }
)

// 保修过期处理
const handleWarrantyExpiredChange = (checked: CheckboxValueType): void => {
  if (checked === true) {
    form.value.warranty_date = ''
  }
}

const loadHeicConverter = async () => {
  if (!heicConverterLoader) {
    heicConverterLoader = import('heic2any').then(module => module.default as HeicConverter)
  }

  return heicConverterLoader
}

// 转换 HEIC 为 JPEG（优化版 - 先用 heic2any 解码，再用 Canvas 压缩）
const convertHeicToJpeg = async (file: File, index: number, total: number): Promise<File> => {
  try {
    // 只在第一张时显示提示
    if (index === 0) {
      globalNotifications.info(`${total}张照片处理中...`)
    }

    // 第一步：使用 heic2any 将 HEIC 转换为 JPEG Blob
    const heic2any = await loadHeicConverter()
    const jpegBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85 // 先用较高质量转换，后续用 Canvas 压缩
    })
    const sourceBlob = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob

    // 第二步：将 Blob 加载到 Image 对象
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = URL.createObjectURL(sourceBlob)
    })

    // 第三步：使用 Canvas 调整尺寸和压缩
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持图片压缩')

    // 计算缩放比例（最大宽度 1920px）
    const maxWidth = 1920
    let width = img.width
    let height = img.height

    if (width > maxWidth) {
      height = Math.round((maxWidth / width) * height)
      width = maxWidth
    }

    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)

    // 释放临时 URL
    URL.revokeObjectURL(img.src)

    // 转换为最终的压缩 Blob
    const finalBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas 转换失败')),
        'image/jpeg',
        0.75 // 75% 质量，平衡速度和质量
      )
    })

    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    const convertedFile = new File([finalBlob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now()
    })

    // 最后一张时显示完成
    if (index === total - 1) {
      globalNotifications.success(`${total}张照片预览完成`)
    }

    return convertedFile
  } catch (error) {
    logger.error(`[HEIC 转换] 转换失败: ${file.name}`, error)
    globalNotifications.error(`${file.name} 处理失败`)
    throw error
  }
}

const toPendingUploadFile = (file: UploadFile): PendingUploadFile => ({
  uid: String(file.uid),
  name: file.name,
  raw: file.raw,
  status: file.status,
  url: file.url
})

// 文件选择变化（添加到待上传列表）
const handleFileChange = async (_file: UploadFile, fileList: UploadFiles) => {
  // 防止处理过程中重复触发
  if (uploading.value || isProcessingFiles.value) {
    return
  }

  const pendingFileList = fileList.map(toPendingUploadFile)
  const newFiles = getNewPublishFiles(pendingFileList, processedFileUids.value)

  // 如果没有新文件，只是删除操作，同步 pendingFiles
  if (newFiles.length === 0) {
    revokePendingFileUrls(getRemovedPublishFiles(pendingFiles.value, pendingFileList))
    pendingFiles.value = filterValidPublishFiles(pendingFileList)
    return
  }

  // 设置处理标志
  isProcessingFiles.value = true

  try {
    // 先过滤掉不符合要求的新文件
    const validFiles = newFiles.filter(f => {
      if (f.raw) {
        const validationMessage = validatePublishMediaFile(f.raw)
        if (validationMessage) {
          globalNotifications.error(validationMessage)
          return false
        }
      }
      return true
    })

    // 统计 HEIC 文件数量
    const heicFiles = validFiles.filter(f => f.raw && isHeicFormat(f.raw))

    // 并行处理 HEIC 文件转换（提升速度）
    const processedFiles: PendingUploadFile[] = []
    const conversionPromises: Array<Promise<PendingUploadFile | null>> = []

    // 先处理非 HEIC/PDF 文件（直接添加）
    for (const f of validFiles) {
      if (!f.raw || (!isHeicFormat(f.raw) && !isPdfFile(f.raw))) {
        // 非 HEIC 文件，直接添加
        ensurePublishPendingFileUrl(f)
        processedFiles.push(f)
      } else if (f.raw && isPdfFile(f.raw)) {
        conversionPromises.push(
          prepareMediaFile(f.raw)
            .then(converted => buildConvertedPublishFile(f, converted))
            .catch((error): null => {
              logger.error(`[PDF 转换] 处理失败: ${f.name}`, error)
              globalNotifications.error(`${f.name} PDF转换失败`)
              return null
            })
        )
        processedFiles.push({ uid: f.uid, name: f.name, status: 'converting' })
      } else {
        // HEIC 文件，创建转换任务
        const heicIndex = conversionPromises.length
        conversionPromises.push(
          convertHeicToJpeg(f.raw, heicIndex, heicFiles.length)
            .then((converted) => buildConvertedPublishFile(f, converted))
            .catch((error): null => {
              logger.error(`[HEIC 转换] 处理失败: ${f.name}`, error)
              // 转换失败不添加到列表，跳过该文件
              return null
            })
        )
        // 占位，保持顺序
        processedFiles.push({ uid: f.uid, name: f.name, status: 'converting' })
      }
    }

    // 等待所有 HEIC 文件转换完成
    if (conversionPromises.length > 0) {
      const results = await Promise.all(conversionPromises)
      processedFiles.splice(0, processedFiles.length, ...applyPublishConversionResults(processedFiles, results))
    }

    // 将新处理的文件追加到待上传列表
    pendingFiles.value = [...pendingFiles.value, ...processedFiles]
    // 标记这些文件为已处理
    processedFiles.forEach(f => {
      if (f.uid) processedFileUids.value.add(f.uid)
    })
  } finally {
    // 清除处理标志
    isProcessingFiles.value = false
  }
}

// 生成预览URL
const previewUrl = (file: PendingUploadFile) => {
  return ensurePublishPendingFileUrl(file)
}

const openPendingMediaPreview = (clickedIndex: number) => {
  const clickedFile = pendingFiles.value[clickedIndex]
  const items = pendingFiles.value
    .map<MediaPreviewItem>(file => ({
      id: file.uid,
      url: ensurePublishPendingFileUrl(file),
      type: file.raw?.type,
      name: file.name,
      label: isVideoMedia({ type: file.raw?.type, name: file.name, url: file.url }) ? '待上传视频' : '待上传图片'
    }))
    .filter(item => Boolean(item.url))

  previewMediaItems.value = items
  previewMediaIndex.value = Math.max(items.findIndex(item => item.id === clickedFile?.uid), 0)
  showMediaPreview.value = items.length > 0
}

const openUploadedMediaPreview = (clickedMedia: UploadedMediaItem) => {
  const items = images.value.map<MediaPreviewItem>(media => ({
    id: media.id,
    url: media.image_url,
    type: media.image_type,
    label: isVideoMedia(media) ? '商品视频' : '商品图片'
  }))

  previewMediaItems.value = items
  previewMediaIndex.value = Math.max(items.findIndex(item => item.id === clickedMedia.id), 0)
  showMediaPreview.value = items.length > 0
}

// 移除待上传文件
const removePendingFile = (index: number) => {
  const [removedFile] = pendingFiles.value.splice(index, 1)
  if (removedFile?.url && removedFile.url.startsWith('blob:')) {
    URL.revokeObjectURL(removedFile.url)
  }
}

const uploadMediaFile = async (file: File) => {
  const uploadFile = await prepareMediaFile(file)
  const formData = new FormData()
  formData.append(getPublishUploadFieldName(uploadFile), uploadFile)

  return api.upload<UploadResult>(
    getPublishUploadEndpoint(props.phoneId, file),
    formData
  )
}

const trackUploadedMedia = (result: { data?: UploadResult }) => {
  const mediaId = Number(result.data?.id)
  if (Number.isInteger(mediaId) && mediaId > 0 && !uploadedMediaIds.value.includes(mediaId)) {
    uploadedMediaIds.value.push(mediaId)
  }
}

// 批量上传待上传文件
const uploadPendingFiles = async () => {
  const filesToUpload = filterValidPublishFiles(pendingFiles.value)
  if (filesToUpload.length === 0) return

  uploading.value = true

  for (const file of filesToUpload) {
    try {
      if (!file.raw) {
        continue
      }

      const result = await uploadMediaFile(file.raw)

      if (result.success) {
        trackUploadedMedia(result)
        // 上传成功，从待上传列表移除
        const index = pendingFiles.value.findIndex(f => f.uid === file.uid)
        if (index > -1) {
          const currentFile = pendingFiles.value[index]
          if (currentFile?.url && currentFile.url.startsWith('blob:')) {
            URL.revokeObjectURL(currentFile.url)
          }
          pendingFiles.value.splice(index, 1)
        }
      } else {
        globalNotifications.error(result.message || '上传失败')
      }
    } catch (error) {
      logger.error('上传失败:', error)
      globalNotifications.error('上传失败，请重试')
    }
  }

  uploading.value = false

  // 刷新已上传文件列表
  await loadPhoneImages()

  if (pendingFiles.value.length === 0) {
    globalNotifications.success('所有文件上传成功')
  }
}

// 上传前校验（统一处理图片和视频）
const beforeMediaUpload = (file: File) => {
  const validationMessage = validatePublishMediaFile(file)
  if (validationMessage) {
    globalNotifications.error(validationMessage)
    return false
  }

  uploading.value = true
  return true
}

const createUploadError = (message: string) => Object.assign(new Error(message), {
  name: 'UploadAjaxError',
  status: 0,
  method: 'POST',
  url: ''
})

// 统一上传处理（使用自定义上传）
const handleMediaUpload = async (options: UploadRequestOptions): Promise<void> => {
  const { file, onError, onSuccess } = options
  const isVideo = file.type.startsWith('video/')

  try {
    const result = await uploadMediaFile(file)

    if (result.success) {
      trackUploadedMedia(result)
      globalNotifications.success(isVideo ? '视频上传成功' : '图片上传成功')
      onSuccess(result)
      await loadPhoneImages()
    } else {
      globalNotifications.error(result.message || '上传失败')
      onError(createUploadError(result.message || '上传失败'))
    }
  } catch (error) {
    logger.error('上传失败:', error)
    globalNotifications.error('上传失败，请重试')
    onError(createUploadError(error instanceof Error ? error.message : '上传失败，请重试'))
  } finally {
    uploading.value = false
  }
}

// 加载商品图片
const loadPhoneImages = async () => {
  if (!props.phoneId) return

  try {
    const response = await api.get(`/phones/${props.phoneId}/images`)
    images.value = Array.isArray(response.data) ? response.data as UploadedMediaItem[] : []
    // 同步更新视频预览
    productVideo.value = findUploadedVideoUrl(images.value)
  } catch (error) {
    logger.error('加载图片失败:', error)
  }
}

// 设置主图
const setPrimaryImage = async (image: UploadedMediaItem) => {
  try {
    await api.put(`/phones/${props.phoneId}/images/${image.id}/primary`)
    await loadPhoneImages()
    globalNotifications.success('已设置为主图')
  } catch (error) {
    logger.error('设置主图失败:', error)
    globalNotifications.error('设置失败')
  }
}

// 删除图片
const deleteImage = async (image: UploadedMediaItem) => {
  try {
    await api.delete(`/phones/${props.phoneId}/images/${image.id}`)
    uploadedMediaIds.value = uploadedMediaIds.value.filter(id => id !== image.id)
    await loadPhoneImages()
    globalNotifications.success('删除成功')
  } catch (error) {
    logger.error('删除图片失败:', error)
    globalNotifications.error('删除失败')
  }
}

// 删除视频
const deleteVideo = async () => {
  try {
    // 找到视频的ID
    const video = images.value.find(isVideoMedia)
    if (video) {
      await api.delete(`/phones/${props.phoneId}/images/${video.id}`)
      productVideo.value = ''
      await loadPhoneImages()
      globalNotifications.success('视频删除成功')
    }
  } catch (error) {
    logger.error('删除视频失败:', error)
    globalNotifications.error('删除失败')
  }
}

// 图片拖拽排序
const handleImageDragEnd = async () => {
  if (!props.phoneId || images.value.length === 0) return

  try {
    // 获取按新顺序排列的图片ID数组
    const imageIds = images.value.map(img => img.id)

    // 调用后端API更新排序
    await api.put(`/phones/${props.phoneId}/images/reorder`, { imageIds })

    globalNotifications.success('图片排序已更新')
  } catch (error) {
    logger.error('更新图片排序失败:', error)
    globalNotifications.error('排序更新失败')
    // 重新加载以恢复原顺序
    await loadPhoneImages()
  }
}

// 保存
const handleSave = async () => {
  if (busy.value || loadingPhoneData.value || loadError.value) return
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  if (!props.phoneId) return

  if (!isNewPhone.value && isPublished.value === 1 && !hasPublishMediaFiles(images.value, pendingFiles.value)) {
    globalNotifications.warning('请至少上传一张商品图片或视频')
    return
  }

  saving.value = true
  try {
    // 先上传待上传的文件
    if (pendingFiles.value.length > 0) {
      globalNotifications.info('正在上传文件...')
      await uploadPendingFiles()

      // 如果上传后还有失败的文件，提示用户
      if (pendingFiles.value.length > 0) {
        globalNotifications.error('部分文件上传失败，请重试')
        saving.value = false
        return
      }
    }

    // 上传完成后再保存验机信息（仅二手商品）
    const result = isNewPhone.value
      ? await api.put(`/phones/${props.phoneId}/h5-product`, { is_published: isPublished.value }, { showLoading: false, showError: false })
      : await api.post(`/phones/${props.phoneId}/inspection`, { ...form.value, is_published: isPublished.value }, { showLoading: false, showError: false })
    if (!result.success) throw new Error(result.message || '保存失败')
    uploadedMediaIds.value = []
    globalNotifications.success('商城配置已保存')
    emit('success')
    saving.value = false
    await handleClose()
  } catch (error) {
    logger.error('保存失败:', error)
    globalNotifications.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

// 关闭对话框
const handleClose = async () => {
  if (busy.value) return
  await cleanupUnsavedUploadedMedia()
  visible.value = false
  resetPublishState()
}

// 暴露方法供父组件调用
defineExpose({
  loadPhoneData
})
</script>

<style scoped>
:global(.publish-to-h5-dialog) {
  --tf-dialog-body-padding-inline: var(--tf-space-6);
  --tf-dialog-body-padding-block: var(--tf-space-5);
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-title) {
  font-size: var(--tf-type-scale-16) !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-close) {
  right: 14px !important;
  transform: none !important;
}

.publish-to-h5-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.publish-to-h5-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.publish-to-h5-column,
.publish-to-h5-media {
  min-width: 0;
}

.publish-to-h5-media {
  width: 100%;
  max-width: 100%;
}

.publish-to-h5-media .image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.publish-to-h5-column {
  display: flex;
  flex-direction: column;
}

.publish-to-h5-warranty-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.publish-to-h5-media-field {
  margin-bottom: 0;
}

.publish-to-h5-media-card {
  position: relative;
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--tf-color-neutral-200);
  cursor: move;
}

.publish-to-h5-media-card.is-pending {
  border-style: dashed;
  border-color: var(--color-primary);
  background: var(--tf-color-blue-50);
}

.publish-to-h5-media-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.publish-to-h5-media-thumb.is-previewable {
  cursor: zoom-in;
}

:deep(.publish-to-h5-form .el-form-item) {
  margin-bottom: 14px;
}

:deep(.publish-to-h5-form .el-form-item:last-child) {
  margin-bottom: 0;
}

:deep(.publish-to-h5-form .el-form-item__label) {
  font-weight: 600;
  color: var(--tf-color-neutral-600);
}

:deep(.publish-to-h5-form .publish-to-h5-control),
:deep(.publish-to-h5-form .publish-to-h5-control.el-input),
:deep(.publish-to-h5-form .publish-to-h5-control.el-select),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor.el-input),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor.el-input__wrapper) {
  width: 100% !important;
}

:deep(.publish-to-h5-form .el-form-item__content) {
  width: 100%;
  min-width: 0;
}

:deep(.publish-to-h5-form .publish-to-h5-control .el-select__wrapper),
:deep(.publish-to-h5-form .publish-to-h5-control .el-input__wrapper),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-input__wrapper) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 12px;
  padding-right: 12px;
}

:deep(.publish-to-h5-form .publish-to-h5-control .el-input__inner),
:deep(.publish-to-h5-form .publish-to-h5-control .el-select__selected-item),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-range-input),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-input__inner) {
  font-size: var(--tf-type-scale-14);
}

:deep(.publish-to-h5-form .publish-to-h5-control .el-input__prefix),
:deep(.publish-to-h5-form .publish-to-h5-control .el-input__suffix),
:deep(.publish-to-h5-form .publish-to-h5-control .el-select__prefix),
:deep(.publish-to-h5-form .publish-to-h5-control .el-select__suffix),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-input__prefix),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-input__suffix) {
  display: inline-flex;
  align-items: center;
  height: 100%;
}

:deep(.publish-to-h5-form .publish-to-h5-control .el-input__prefix-inner),
:deep(.publish-to-h5-form .publish-to-h5-control .el-input__suffix-inner),
:deep(.publish-to-h5-form .publish-to-h5-control .el-select__caret),
:deep(.publish-to-h5-form .publish-to-h5-control .el-icon) {
  display: inline-flex;
  align-items: center;
  height: 100%;
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: space-around;
  padding: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-actions:hover {
  opacity: 1;
}

@media (max-width: 767px) {
  :global(.publish-to-h5-dialog) {
    --tf-dialog-body-padding-inline: var(--tf-space-1);
    --tf-dialog-body-padding-block: var(--tf-space-2);
  }

  .publish-to-h5-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .publish-to-h5-form {
    gap: 8px;
  }

  .publish-to-h5-warranty-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .publish-to-h5-warranty-row :deep(.el-date-editor) {
    width: 100% !important;
    min-width: 0;
  }

  .publish-to-h5-media .image-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control),
  :deep(.publish-to-h5-form .publish-to-h5-select-control) {
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__wrapper),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__wrapper),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__wrapper) {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__inner),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__inner),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__selected-item) {
    font-size: var(--tf-type-scale-16) !important;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__prefix),
  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__suffix),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__prefix),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__suffix),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__suffix) {
    display: inline-flex;
    align-items: center;
  }

  :deep(.publish-to-h5-form .el-form-item) {
    margin-bottom: 10px;
  }

  :deep(.publish-to-h5-form .el-upload) {
    width: 100%;
  }

  :deep(.publish-to-h5-form .el-upload .el-button) {
    width: 100%;
  }
}

@media (max-width: 479px) {
  :global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-close) {
    right: 14px !important;
  }
}

@media (max-width: 420px) {
  .publish-to-h5-grid {
    gap: 8px;
  }
}
</style>
