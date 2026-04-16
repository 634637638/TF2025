<!--
  PublishToH5Modal - 商品配置
  功能：设置商品验机信息、上传图片
-->
<template>
  <MobileDialog
    v-model="visible"
    title="商品配置"
    width="700px"
    :close-on-click-modal="false"
    dialog-class="publish-to-h5-dialog"
    :show-default-footer="false"
    @close="handleClose"
  >
    <div v-if="loadingPhoneData" class="publish-to-h5-loading">
      <el-icon class="is-loading" :size="30"><LoadingIcon /></el-icon>
      <div class="publish-to-h5-loading-text">加载商品信息中...</div>
    </div>
    <el-form
      v-else
      :model="form"
      class="publish-to-h5-form"
      :label-width="isCompactLayout ? 'auto' : '90px'"
      :label-position="isCompactLayout ? 'top' : 'right'"
    >
      <div class="publish-to-h5-grid">
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
              <template #prefix>¥</template>
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
              popper-class="publish-to-h5-popper"
            >
              <el-option label="99新" value="99新" />
              <el-option label="98新" value="98新" />
              <el-option label="97新" value="97新" />
              <el-option label="95新" value="95新" />
              <el-option label="靓机" value="靓机" />
              <el-option label="小花" value="小花" />
              <el-option label="大花" value="大花" />
              <el-option label="外爆" value="外爆" />
              <el-option label="内爆" value="内爆" />
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
              <template v-if="isBatteryNumeric" #suffix>%</template>
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
              popper-class="publish-to-h5-popper"
            >
              <el-option label="全原" value="original" />
              <el-option label="换原屏" value="replaced_original" />
              <el-option label="国产屏幕" value="domestic" />
              <el-option label="原换盖板" value="replaced_glass" />
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
              popper-class="publish-to-h5-popper"
            >
              <el-option label="国行" value="国行" />
              <el-option label="美版" value="美版" />
              <el-option label="日版" value="日版" />
              <el-option label="港版" value="港版" />
              <el-option label="奥版" value="奥版" />
              <el-option label="加拿大" value="加拿大" />
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
                value-format="YYYY-MM-DD"
                :disabled="form.is_warranty_expired"
                teleported
                popper-class="publish-to-h5-popper"
              />
              <el-checkbox v-model="form.is_warranty_expired" @change="handleWarrantyExpiredChange">
                已过保
              </el-checkbox>
            </div>
          </el-form-item>
          </template>
        </div>
      </div>

      <!-- 商品素材（跨两列） -->
      <el-form-item label="商品素材" class="publish-to-h5-media-field">
        <div class="publish-to-h5-media">
          <!-- 统一上传按钮 -->
          <el-upload
            :headers="uploadHeaders"
            :show-file-list="false"
            :before-upload="beforeMediaUpload"
            :http-request="handleMediaUpload"
            accept="image/*,video/*"
            :disabled="uploading"
            multiple
            :auto-upload="false"
            :on-change="handleFileChange"
          >
            <el-button type="primary" :loading="uploading" :disabled="uploading">
              <i class="fas fa-upload"></i>
              <span class="ml-2">上传图片/视频</span>
            </el-button>
          </el-upload>

          <!-- 待上传文件预览 -->
          <div v-if="pendingFiles.length > 0" class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-gray-600">待上传文件 ({{ pendingFiles.length }})</span>
              <el-button type="primary" size="small" :loading="uploading" @click="uploadPendingFiles">
                开始上传
              </el-button>
            </div>
            <div class="image-grid">
              <div
                v-for="(file, index) in pendingFiles"
                :key="index"
                class="publish-to-h5-media-card is-pending"
              >
                <!-- 视频预览 -->
                <video
                  v-if="file.raw?.type?.startsWith('video/')"
                  :src="previewUrl(file)"
                  class="publish-to-h5-media-thumb"
                  muted
                ></video>
                <!-- 图片预览 -->
                <Image
                  v-else
                  :src="file.url || file.raw"
                  alt="预览"
                  mode="eager"
                  class="publish-to-h5-media-thumb is-previewable"
                />

                <!-- 文件类型标记 -->
                <div class="image-badge">
                  <i :class="file.raw?.type?.startsWith('video/') ? 'fas fa-video' : 'fas fa-image'"></i>
                  {{ file.raw?.type?.startsWith('video/') ? '视频' : '图片' }}
                </div>

                <!-- 移除按钮 -->
                <div
                  @click.stop="removePendingFile(index)"
                  class="image-delete-btn"
                  @mouseenter="$event.target.style.background = 'rgb(245, 108, 108)'"
                  @mouseleave="$event.target.style.background = 'rgba(245, 108, 108, 0.9)'"
                >
                  <i class="fas fa-times text-white text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- 已上传视频预览 -->
          <div v-if="productVideo" class="mt-3">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <video :src="formatImageUrl(productVideo)" class="video-thumbnail" controls></video>
              <div class="flex-1">
                <div class="text-xs text-gray-500">已上传视频</div>
                <el-button type="danger" size="small" @click="deleteVideo">
                  <i class="fas fa-trash"></i> 删除
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
            @end="handleImageDragEnd"
            class="image-grid mt-4"
          >
            <template #item="{ element: image }">
              <div
                class="publish-to-h5-media-card"
              >
              <!-- 视频显示 -->
              <video
                v-if="image.image_type === 'video'"
                :src="formatImageUrl(image.image_url)"
                class="publish-to-h5-media-thumb"
                muted
              ></video>
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
                <i class="fas fa-grip-vertical text-white text-xs"></i>
              </div>

              <!-- 主图标记 - 左下角 -->
              <div v-if="image.is_primary" class="image-primary-tag">
                主图
              </div>

              <!-- 删除按钮 - 始终显示在右上角 -->
              <div
                @click.stop="deleteImage(image)"
                class="image-delete-btn"
                @mouseenter="$event.target.style.background = 'rgb(245, 108, 108)'"
                @mouseleave="$event.target.style.background = 'rgba(245, 108, 108, 0.9)'"
              >
                <i class="fas fa-times text-white text-xs"></i>
              </div>

              <!-- 设置主图按钮 - 悬停时显示 -->
              <div class="image-actions">
                <div
                  v-if="!image.is_primary && image.image_type !== 'video'"
                  @click.stop="setPrimaryImage(image)"
                  class="image-set-primary-btn"
                  @mouseenter="$event.target.style.background = 'rgb(255, 255, 255)'"
                  @mouseleave="$event.target.style.background = 'rgba(255, 255, 255, 0.9)'"
                >
                  <i class="fas fa-star text-danger text-sm"></i>
                </div>
              </div>

              <!-- 视频标记 -->
              <div v-if="image.image_type === 'video'" class="image-badge">
                <i class="fas fa-video"></i>
                视频
              </div>
            </div>
          </template>
        </draggable>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="publish-to-h5-footer">
        <el-button type="default" @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </div>
    </template>
  </MobileDialog>

  <el-image-viewer
    v-if="showImagePreview"
    :url-list="previewImageUrls"
    :initial-index="previewInitialIndex"
    @close="closeImagePreview"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElImageViewer, ElMessage } from 'element-plus'
import { Loading as LoadingIcon } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi as api } from '@/utils/unified-api'
import { formatImageUrl } from '@/utils/format'
import Image from './Image.vue'
import { useMobile } from '@/composables/mobile'
import draggable from 'vuedraggable'
import { logger } from '@/utils/logger'
import type { ModelValueProps, SuccessEmits, UpdateModelValueEmits } from '@/types'
import {
  applyPublishConversionResults,
  buildPublishInspectionForm,
  buildPublishPreviewStateFromPending,
  buildPublishPreviewStateFromUploaded,
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
  resolvePublishIsNewPhone,
  revokePendingFileUrls,
  validatePublishMediaFile
} from './publish-to-h5/helpers'
import type {
  HeicConverter,
  MediaUploadOptions,
  PendingUploadFile,
  PublishFormState,
  UploadResult,
  UploadedMediaItem
} from './publish-to-h5/types'

interface Props extends ModelValueProps {
  phoneId: number | null
  isNew?: boolean // 是否全新机，true=全新机不需要验机配置
}

const props = defineProps<Props>()
const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()

const authStore = useAuthStore()
const { screenSize } = useMobile()
const isCompactLayout = computed(() => screenSize.value.width > 0 && screenSize.value.width <= 768)

// 对话框显示状态
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 监听对话框打开，自动加载数据
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && props.phoneId) {
    await loadPhoneData()
  } else if (!isOpen) {
    resetUploadState()
  }
})

// 监听 phoneId 变化，切换商品时清空待上传文件
watch(() => props.phoneId, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    resetUploadState()
    if (props.modelValue) {
      await loadPhoneData()
    }
  }
})

// 表单数据
const form = ref<PublishFormState>(createDefaultPublishForm())

// 图片相关
const images = ref<UploadedMediaItem[]>([])
const uploading = ref(false)
const saving = ref(false)
const isNewPhone = ref(false) // 是否全新机
const loadingPhoneData = ref(false) // 加载商品数据中
const showImagePreview = ref(false)
const previewImageUrls = ref<string[]>([])
const previewInitialIndex = ref(0)

// 视频相关
const productVideo = ref('')

// 待上传文件列表
const pendingFiles = ref<PendingUploadFile[]>([])
// 文件处理标志（防止重复触发）
const isProcessingFiles = ref(false)
// 跟踪已处理的文件 UID（包括已删除的）
const processedFileUids = ref<Set<string>>(new Set())
let heicConverterLoader: Promise<HeicConverter> | null = null

// 上传配置
const uploadHeaders = computed(() => ({
  'Authorization': `Bearer ${authStore.token || ''}`
}))

// 电池状况显示值
const batteryDisplayValue = ref('')
const salePriceDisplayValue = computed({
  get: () => {
    const value = form.value.sale_price
    return value === null || value === undefined || value === '' ? '' : String(value)
  },
  set: (value: string) => {
    form.value.sale_price = normalizePublishSalePrice(value)
  }
})

const isBatteryNumeric = computed(() => {
  const val = batteryDisplayValue.value
  return val !== '' && !isNaN(Number(val))
})

const resetUploadState = () => {
  isProcessingFiles.value = false
  processedFileUids.value.clear()
  revokePendingFileUrls(pendingFiles.value)
  pendingFiles.value = []
}

const resetPublishState = () => {
  resetUploadState()
  form.value = createDefaultPublishForm()
  batteryDisplayValue.value = ''
  isNewPhone.value = false
  images.value = []
  productVideo.value = ''
  closeImagePreview()
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

  resetPublishState()

  // 显示加载状态
  loadingPhoneData.value = true

  try {
    // 先获取商品基本信息（判断是否全新机）
    const phoneRes = await api.get(`/phones/${props.phoneId}`)
    if (phoneRes.success && phoneRes.data) {
      // is_new 可能是 1, "1", true 或其他值，统一转换为布尔判断
      isNewPhone.value = resolvePublishIsNewPhone(phoneRes.data.is_new, props.isNew)

      // 全新机提示
      if (isNewPhone.value) {
        ElMessage.info('全新机使用模板配置，只需设置销售价格和上传商品图片')
      }
    }

    // 加载验机信息（仅二手商品）
    if (!isNewPhone.value) {
      const inspectionRes = await api.get(`/phones/${props.phoneId}/inspection`)
      if (inspectionRes.success && inspectionRes.data) {
        const inspectionState = buildPublishInspectionForm(inspectionRes.data)
        form.value = inspectionState.formData
        batteryDisplayValue.value = inspectionState.batteryDisplayValue
      }
    } else {
      form.value = createDefaultPublishForm()
      batteryDisplayValue.value = ''
    }

    // 加载图片
    const imagesRes = await api.get(`/phones/${props.phoneId}/images`)
    if (imagesRes.success && imagesRes.data) {
      images.value = imagesRes.data as UploadedMediaItem[]
      productVideo.value = findUploadedVideoUrl(images.value)
    }
  } catch (error) {
    logger.error('加载数据失败:', error)
  } finally {
    loadingPhoneData.value = false
  }
}

// 保修过期处理
const handleWarrantyExpiredChange = (checked: boolean) => {
  if (checked) {
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
      ElMessage.info(`${total}张照片处理中...`)
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
      ElMessage.success(`${total}张照片预览完成`)
    }

    return convertedFile
  } catch (error) {
    logger.error('[HEIC 转换] 转换失败:', file.name, error)
    ElMessage.error(`${file.name} 处理失败`)
    throw error
  }
}

// 文件选择变化（添加到待上传列表）
const handleFileChange = async (_file: PendingUploadFile, fileList: PendingUploadFile[]) => {
  // 防止处理过程中重复触发
  if (uploading.value || isProcessingFiles.value) {
    return
  }

  const newFiles = getNewPublishFiles(fileList, processedFileUids.value)

  // 如果没有新文件，只是删除操作，同步 pendingFiles
  if (newFiles.length === 0) {
    revokePendingFileUrls(getRemovedPublishFiles(pendingFiles.value, fileList))
    pendingFiles.value = filterValidPublishFiles(fileList)
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
          ElMessage.error(validationMessage)
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

    // 先处理非 HEIC 文件（直接添加）
    for (const f of validFiles) {
      if (!f.raw || !isHeicFormat(f.raw)) {
        // 非 HEIC 文件，直接添加
        ensurePublishPendingFileUrl(f)
        processedFiles.push(f)
      } else {
        // HEIC 文件，创建转换任务
        const heicIndex = conversionPromises.length
        conversionPromises.push(
          convertHeicToJpeg(f.raw, heicIndex, heicFiles.length)
            .then((converted) => buildConvertedPublishFile(f, converted))
            .catch(error => {
              logger.error('[HEIC 转换] 处理失败:', f.name, error)
              // 转换失败不添加到列表，跳过该文件
              return null
            })
        )
        // 占位，保持顺序
        processedFiles.push({ uid: f.uid, status: 'converting' })
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

const openPendingImagePreview = (clickedIndex: number) => {
  const previewState = buildPublishPreviewStateFromPending(pendingFiles.value, clickedIndex)
  previewImageUrls.value = previewState.urls
  previewInitialIndex.value = previewState.initialIndex
  showImagePreview.value = previewState.urls.length > 0
}

const openUploadedImagePreview = (clickedImage: UploadedMediaItem) => {
  const previewState = buildPublishPreviewStateFromUploaded(images.value, clickedImage, formatImageUrl)
  previewImageUrls.value = previewState.urls
  previewInitialIndex.value = previewState.initialIndex
  showImagePreview.value = previewState.urls.length > 0
}

const closeImagePreview = () => {
  showImagePreview.value = false
  previewImageUrls.value = []
  previewInitialIndex.value = 0
}

// 移除待上传文件
const removePendingFile = (index: number) => {
  const [removedFile] = pendingFiles.value.splice(index, 1)
  if (removedFile?.url && removedFile.url.startsWith('blob:')) {
    URL.revokeObjectURL(removedFile.url)
  }
}

const uploadMediaFile = async (file: File) => {
  const formData = new FormData()
  formData.append(getPublishUploadFieldName(file), file)

  return api.upload<UploadResult>(
    getPublishUploadEndpoint(props.phoneId, file),
    formData
  )
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
        ElMessage.error(result.message || '上传失败')
      }
    } catch (error) {
      logger.error('上传失败:', error)
      ElMessage.error('上传失败，请重试')
    }
  }

  uploading.value = false

  // 刷新已上传文件列表
  await loadPhoneImages()

  if (pendingFiles.value.length === 0) {
    ElMessage.success('所有文件上传成功')
  }
}

// 上传前校验（统一处理图片和视频）
const beforeMediaUpload = (file: File) => {
  const validationMessage = validatePublishMediaFile(file)
  if (validationMessage) {
    ElMessage.error(validationMessage)
    return false
  }

  uploading.value = true
  return true
}

// 统一上传处理（使用自定义上传）
const handleMediaUpload = async (options: MediaUploadOptions) => {
  const { file, onError, onSuccess } = options
  const isVideo = file.type.startsWith('video/')

  try {
    const result = await uploadMediaFile(file)

    if (result.success) {
      ElMessage.success(isVideo ? '视频上传成功' : '图片上传成功')
      onSuccess(result)
      await loadPhoneImages()
    } else {
      ElMessage.error(result.message || '上传失败')
      onError(new Error(result.message || '上传失败'))
    }
  } catch (error) {
    logger.error('上传失败:', error)
    ElMessage.error('上传失败，请重试')
    onError(error instanceof Error ? error : new Error('上传失败，请重试'))
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
    ElMessage.success('已设置为主图')
  } catch (error) {
    logger.error('设置主图失败:', error)
    ElMessage.error('设置失败')
  }
}

// 删除图片
const deleteImage = async (image: UploadedMediaItem) => {
  try {
    await api.delete(`/phones/${props.phoneId}/images/${image.id}`)
    await loadPhoneImages()
    ElMessage.success('删除成功')
  } catch (error) {
    logger.error('删除图片失败:', error)
    ElMessage.error('删除失败')
  }
}

// 删除视频
const deleteVideo = async () => {
  try {
    // 找到视频的ID
    const video = images.value.find(img => img.image_type === 'video')
    if (video) {
      await api.delete(`/phones/${props.phoneId}/images/${video.id}`)
      productVideo.value = ''
      await loadPhoneImages()
      ElMessage.success('视频删除成功')
    }
  } catch (error) {
    logger.error('删除视频失败:', error)
    ElMessage.error('删除失败')
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

    ElMessage.success('图片排序已更新')
  } catch (error) {
    logger.error('更新图片排序失败:', error)
    ElMessage.error('排序更新失败')
    // 重新加载以恢复原顺序
    await loadPhoneImages()
  }
}

// 保存
const handleSave = async () => {
  if (!props.phoneId) return

  if (!hasPublishMediaFiles(images.value, pendingFiles.value)) {
    ElMessage.warning('请至少上传一张商品图片或视频')
    return
  }

  saving.value = true
  try {
    // 先上传待上传的文件
    if (pendingFiles.value.length > 0) {
      ElMessage.info('正在上传文件...')
      await uploadPendingFiles()

      // 如果上传后还有失败的文件，提示用户
      if (pendingFiles.value.length > 0) {
        ElMessage.error('部分文件上传失败，请重试')
        saving.value = false
        return
      }
    }

    // 上传完成后再保存验机信息（仅二手商品）
    if (!isNewPhone.value) {
      await api.post(`/phones/${props.phoneId}/inspection`, form.value)
    }
    ElMessage.success('保存成功')
    emit('success')
    handleClose()
  } catch (error) {
    logger.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

// 关闭对话框
const handleClose = () => {
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
  --dialog-max-width: 700px;
  --dialog-vertical-gap: 24px;
  --mobile-dialog-body-padding: 8px 4px 8px;
  --mobile-dialog-footer-padding: 0 4px 4px;
}

:global(.publish-to-h5-dialog .el-dialog__body) {
  padding: 20px 24px !important;
}

:global(.publish-to-h5-dialog .el-dialog__footer) {
  padding: 0 24px 24px !important;
}

:global(.mobile-dialog-sheet-overlay.publish-to-h5-dialog) {
  padding: 8px 4px !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-header) {
  min-height: calc(66px + env(safe-area-inset-top)) !important;
  padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-title) {
  font-size: 16px !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-close) {
  top: calc(10px + env(safe-area-inset-top)) !important;
  right: 14px !important;
  transform: none !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-body) {
  padding: 8px 4px !important;
}

:global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-footer) {
  padding: 0 4px 4px !important;
}

.publish-to-h5-loading {
  text-align: center;
  padding: 40px 16px;
}

.publish-to-h5-loading-text {
  margin-top: 12px;
  color: #909399;
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
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  cursor: move;
}

.publish-to-h5-media-card.is-pending {
  border-style: dashed;
  border-color: #409eff;
  background: #f0f9ff;
}

.publish-to-h5-media-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.publish-to-h5-media-thumb.is-previewable {
  cursor: zoom-in;
}

.publish-to-h5-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-top: 2px;
}

.publish-to-h5-footer :deep(.el-button) {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  font-size: 15px;
  margin: 0;
}

:deep(.publish-to-h5-form .el-form-item) {
  margin-bottom: 14px;
}

:deep(.publish-to-h5-form .el-form-item:last-child) {
  margin-bottom: 0;
}

:deep(.publish-to-h5-form .el-form-item__label) {
  font-weight: 600;
  color: #4b5563;
}

:deep(.publish-to-h5-form .publish-to-h5-control),
:deep(.publish-to-h5-form .publish-to-h5-control.el-input),
:deep(.publish-to-h5-form .publish-to-h5-control.el-select),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor.el-input),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor.el-input__wrapper) {
  width: 100% !important;
  --el-component-size: 40px;
  height: 40px;
}

:deep(.publish-to-h5-form .el-form-item__content) {
  width: 100%;
  min-width: 0;
}

:deep(.publish-to-h5-form .publish-to-h5-control .el-select__wrapper),
:deep(.publish-to-h5-form .publish-to-h5-control .el-input__wrapper),
:deep(.publish-to-h5-form .publish-to-h5-control.el-date-editor .el-input__wrapper),
:deep(.publish-to-h5-form .el-textarea__inner) {
  height: 40px !important;
  min-height: 40px !important;
  border-radius: 12px;
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
  font-size: 14px;
  height: 40px !important;
  line-height: 40px !important;
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

@media (max-width: 768px) {
  :global(.publish-to-h5-dialog .el-dialog__body) {
    padding: 8px 4px !important;
  }

  :global(.publish-to-h5-dialog .el-dialog__footer) {
    padding: 0 4px 4px !important;
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

  .publish-to-h5-footer {
    gap: 8px;
  }

  .publish-to-h5-footer :deep(.el-button) {
    height: 44px;
    font-size: 14px;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control),
  :deep(.publish-to-h5-form .publish-to-h5-select-control) {
    --el-component-size: 36px;
    height: 36px !important;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__wrapper),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__wrapper),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__wrapper) {
    height: 36px !important;
    min-height: 36px !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
    border-radius: 10px !important;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__inner),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__inner),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__selected-item) {
    height: 36px !important;
    line-height: 36px !important;
    font-size: 16px !important;
  }

  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__prefix),
  :deep(.publish-to-h5-form .publish-to-h5-input-control .el-input__suffix),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__prefix),
  :deep(.publish-to-h5-form .publish-to-h5-picker-control .el-input__suffix),
  :deep(.publish-to-h5-form .publish-to-h5-select-control .el-select__suffix) {
    height: 36px !important;
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

@media (max-width: 480px) {
  :global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-header) {
    min-height: calc(62px + env(safe-area-inset-top)) !important;
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px !important;
  }

  :global(.mobile-dialog-sheet-panel.publish-to-h5-dialog .mobile-dialog-sheet-close) {
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: 14px !important;
  }
}

@media (max-width: 420px) {
  .publish-to-h5-grid {
    gap: 8px;
  }
}
</style>
