<template>
  <div>
    <el-dialog
      :model-value="modelValue"
      title="国补照片管理"
      width="900px"
      class="photo-preview-dialog"
      append-to-body
      :close-on-click-modal="true"
      destroy-on-close
      @update:model-value="handleDialogChange"
      @close="closeDialog"
    >
      <div class="photo-preview-content">
        <div class="photo-upload-area">
          <div class="tf-dialog-toolbar photo-upload-actions">
            <el-upload
              v-if="canUpload"
              class="toolbar-upload"
              :show-file-list="false"
              :http-request="customUploadRequest"
              accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,application/pdf"
              multiple
            >
              <el-button
                type="primary"
              >
                <i class="fas fa-image" /> 上传图片
              </el-button>
            </el-upload>
            <el-button
              type="success"
              :disabled="previewPhotos.length === 0"
              @click="downloadToolbarPhotos"
            >
              <i class="fas fa-download" /> {{ selectedPhotos.length > 0 ? '下载选中' : '下载全部' }}
            </el-button>
            <el-button
              v-if="canUpload"
              type="danger"
              :disabled="previewPhotos.length === 0"
              @click="deleteToolbarPhotos"
            >
              <i class="fas fa-trash" /> {{ selectedPhotos.length > 0 ? '删除选中' : '删除全部' }}
            </el-button>
          </div>
        </div>

        <div
          v-if="previewPhotos.length > 0"
          class="photo-grid-area"
        >
          <div class="photo-toolbar">
            <div class="toolbar-left">
              <el-checkbox
                v-model="photoSelectAll"
                :indeterminate="photoIsIndeterminate"
                @change="handlePhotoSelectAll"
              >
                全选
              </el-checkbox>
              <span
                v-if="selectedPhotos.length > 0"
                class="selected-count"
              >
                已选择 {{ selectedPhotos.length }} 张
              </span>
            </div>
          </div>

          <div
            class="photo-grid"
            @mousedown="startDragSelect"
            @mousemove="onDragSelect"
            @mouseup="endDragSelect"
            @mouseleave="endDragSelect"
          >
            <div
              v-for="(photo, index) in previewPhotos"
              :key="photo"
              class="photo-grid-item"
              :class="{ selected: selectedPhotos.includes(index) }"
              :data-index="index"
              @click="openPhotoViewer(index)"
              @mouseenter="onPhotoHover(index)"
            >
              <div
                class="photo-checkbox"
                @click.stop="togglePhotoSelection(index)"
              >
                <el-checkbox :model-value="selectedPhotos.includes(index)" />
              </div>

              <AsyncImage
                :src="resolvePhotoUrl(photo)"
                alt="国补照片"
                mode="eager"
                class="photo-image"
              />

              <div class="photo-actions">
                <el-button
                  type="primary"
                  size="small"
                  title="查看照片"
                  aria-label="查看照片"
                  circle
                  @click.stop="openPhotoViewer(index)"
                >
                  <i class="fas fa-search-plus" />
                </el-button>
                <el-button
                  v-if="canUpload"
                  type="danger"
                  size="small"
                  title="删除照片"
                  aria-label="删除照片"
                  circle
                  @click.stop="removePhotoFromPreview(index)"
                >
                  <i class="fas fa-trash-alt" />
                </el-button>
              </div>

              <div
                v-if="selectedPhotos.includes(index)"
                class="selected-overlay"
              >
                <i class="fas fa-check-circle" />
              </div>
            </div>
          </div>

          <div class="photo-count-info">
            <i class="fas fa-images" /> 共 {{ previewPhotos.length }} 张照片
          </div>
        </div>

        <div
          v-else
          class="no-photo-hint"
        >
          <i class="fas fa-image" />
          <p>{{ canUpload ? '暂无照片，请点击上方按钮上传' : '暂无照片' }}</p>
        </div>
      </div>

      <template #footer>
        <div class="tf-dialog-actions photo-preview-footer">
          <el-button @click="closeDialog">
            关闭
          </el-button>
          <el-button
            v-if="canUpload"
            type="primary"
            :loading="savingPhotos"
            @click="savePhotoChanges"
          >
            <i class="fas fa-save" /> 保存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <MediaPreviewViewer
      v-model="showPhotoViewer"
      :items="previewMediaItems"
      :initial-index="currentPhotoIndex"
      :deletable="canUpload"
      downloadable
      @change="(_item, index) => preloadNearbyPhotos(index)"
      @delete="(_item, index) => removePhotoFromPreview(index)"
      @download="(_item, index) => downloadCurrentPhoto(index)"
    />
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { storage } from '@/composables/core/useLocalStorage'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { formatImageUrl } from '@/utils/format'
import type { MediaPreviewItem } from '@/utils/media'
import { convertPdfToImage, isPdfFile } from '@/utils/upload-media'
import type { CheckboxValueType, UploadRequestOptions } from 'element-plus'
import type { NationalSubsidyRecord, NationalSubsidyUploadResponse } from '@/types'

const AsyncImage = defineAsyncComponent(() => import('@/components/Image.vue'))

const props = defineProps<{
  modelValue: boolean
  item: NationalSubsidyRecord | null
  canUpload: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const previewPhotos = ref<string[]>([])
const currentPhotoIndex = ref(0)
const savingPhotos = ref(false)
const deletedPhotos = ref<string[]>([])
const uploadedPhotos = ref<string[]>([])
const selectedPhotos = ref<number[]>([])
const photoSelectAll = ref(false)
const isDragging = ref(false)
const showPhotoViewer = ref(false)
const canUpload = computed(() => props.canUpload)

const decodedPhotoCache = new Set<string>()
const pendingPhotoLoads = new Map<string, Promise<void>>()

const clearPhotoRuntimeCache = () => {
  decodedPhotoCache.clear()
  pendingPhotoLoads.clear()
}

const photoIsIndeterminate = computed(() => {
  return selectedPhotos.value.length > 0 && selectedPhotos.value.length < previewPhotos.value.length
})

const uploadHeaders = computed(() => {
  const token = storage.getToken()
  return {
    Authorization: token ? `Bearer ${token}` : ''
  }
})

const resetState = () => {
  clearPhotoRuntimeCache()
  previewPhotos.value = props.item?.subsidy_photos ? [...props.item.subsidy_photos] : []
  currentPhotoIndex.value = 0
  savingPhotos.value = false
  deletedPhotos.value = []
  uploadedPhotos.value = []
  selectedPhotos.value = []
  photoSelectAll.value = false
  isDragging.value = false
  showPhotoViewer.value = false
}

const cleanupUnSavedUploads = async () => {
  if (uploadedPhotos.value.length === 0) return
  try {
    await deleteTempFiles(uploadedPhotos.value)
  } catch (error) {
    logger.error('清理未保存照片失败:', error)
  }
}

const handleDialogChange = (visible: boolean) => {
  emit('update:modelValue', visible)
}

const closeDialog = async () => {
  await cleanupUnSavedUploads()
  clearPhotoRuntimeCache()
  emit('update:modelValue', false)
}

const resolvePhotoUrl = (photo?: string) => formatImageUrl(photo || '')

const previewMediaItems = computed<MediaPreviewItem[]>(() => previewPhotos.value.map((photo, index) => ({
  id: photo,
  url: resolvePhotoUrl(photo),
  type: 'image',
  label: `国补照片 ${index + 1}`
})))

const getPhotoOwnerName = () => {
  const handler_name = props.item?.handler_info?.handler_name || props.item?.handler_name || ''
  const has_handler = Boolean(props.item?.has_different_handler || handler_name)
  const owner_name = has_handler ? (handler_name || props.item?.customer_name) : props.item?.customer_name
  return sanitizeDownloadNamePart(owner_name, has_handler ? '未知代办人' : '未知客户')
}

const preloadPhoto = async (photo?: string) => {
  const resolvedUrl = resolvePhotoUrl(photo)
  if (!resolvedUrl || decodedPhotoCache.has(resolvedUrl)) {
    return
  }

  const existingPromise = pendingPhotoLoads.get(resolvedUrl)
  if (existingPromise) {
    return existingPromise
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
    const image = new window.Image()

    const finalize = () => {
      decodedPhotoCache.add(resolvedUrl)
      pendingPhotoLoads.delete(resolvedUrl)
      resolve()
    }

    image.onload = () => {
      if (typeof image.decode === 'function') {
        image.decode().catch((): undefined => undefined).finally(finalize)
        return
      }

      finalize()
    }

    image.onerror = () => {
      pendingPhotoLoads.delete(resolvedUrl)
      reject(new Error('图片预加载失败'))
    }

    image.src = resolvedUrl

    if (image.complete) {
      image.onload?.(new Event('load'))
    }
  })

  pendingPhotoLoads.set(resolvedUrl, loadPromise)
  return loadPromise
}

const preloadPhotoAt = (index: number) => {
  const photo = previewPhotos.value[index]
  if (!photo) return

  preloadPhoto(photo).catch((error) => {
    logger.warn('图片预加载失败:', error)
  })
}

const preloadNearbyPhotos = (index: number) => {
  preloadPhotoAt(index)
  preloadPhotoAt(index - 1)
  preloadPhotoAt(index + 1)
}

const queuePhotoWarmup = () => {
  const firstPhoto = previewPhotos.value[0]
  if (!firstPhoto) {
    return
  }

  const warmup = () => {
    preloadPhoto(firstPhoto).catch((error) => {
      logger.warn('图片预热失败:', error)
    })
  }

  const browserWindow = typeof globalThis.window !== 'undefined' ? globalThis.window : null

  if (browserWindow && 'requestIdleCallback' in browserWindow) {
    browserWindow.requestIdleCallback(warmup, { timeout: 1500 })
    return
  }

  if (browserWindow) {
    globalThis.setTimeout(warmup, 240)
    return
  }

  warmup()
}

watch(
  () => [props.modelValue, props.item],
  ([visible]) => {
    if (visible) {
      resetState()
      queuePhotoWarmup()
      return
    }

    clearPhotoRuntimeCache()
  },
  { immediate: true }
)

type UploadError = Parameters<UploadRequestOptions['onError']>[0]

const toUploadError = (error: unknown, fallback: string): UploadError => Object.assign(
  new Error(error instanceof Error ? error.message : fallback),
  { name: 'UploadError', status: 0, method: 'POST', url: '/subsidy/upload/photo' }
) as UploadError

const customUploadRequest = async (options: UploadRequestOptions) => {
  if (!canUpload.value) {
    ElMessage.warning('您没有图片上传权限')
    options.onError?.(toUploadError(new Error('没有图片上传权限'), '没有图片上传权限'))
    return
  }

  const { file, onSuccess, onError } = options
  const isPdf = isPdfFile(file)
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB')
    onError?.(toUploadError(new Error('文件大小超过10MB'), '文件大小超过10MB'))
    return
  }

  let uploadFile: File = file
  if (isPdf) {
    try {
      ElMessage.info('正在将PDF转换为图片...')
      uploadFile = await convertPdfToImage(file)
      ElMessage.success('PDF转换成功，正在上传...')
    } catch (error) {
      ElMessage.error('PDF转换图片失败')
      onError?.(toUploadError(error, 'PDF转换图片失败'))
      return
    }
  }

  const formData = new FormData()
  formData.append('file', uploadFile)
  formData.append('serial_number', props.item?.serial_number || 'unknown')
  formData.append('sale_time', props.item?.sale_time || '')
  formData.append('customer_name', props.item?.customer_name || '')
  formData.append('has_different_handler', props.item?.has_different_handler ? '1' : '0')
  formData.append('handler_name', props.item?.handler_info?.handler_name || props.item?.handler_name || '')
  formData.append('is_new', props.item?.is_new === undefined ? '' : String(props.item.is_new))
  formData.append('inventory_time', props.item?.inventory_time || '')

  try {
    const result = await unifiedApi.upload<NationalSubsidyUploadResponse>('/subsidy/upload/photo', formData, {
      headers: uploadHeaders.value
    })

    if (result?.success && result.data?.url) {
      previewPhotos.value.push(result.data.url)
      uploadedPhotos.value.push(result.data.url)
      ElMessage.success('照片上传成功')
      onSuccess?.(result)
      return
    }

    const errorMessage = result?.message || '照片上传失败'
    ElMessage.error(errorMessage)
    onError?.(toUploadError(new Error(errorMessage), errorMessage))
  } catch (error) {
    logger.error('上传请求失败:', error)
    ElMessage.error('照片上传失败，请重试')
    onError?.(toUploadError(error, '照片上传失败'))
  }
}

const downloadPhotoBlob = async (photoUrl: string, filename: string) => {
  await unifiedApi.download(photoUrl, filename, {
    showLoading: false,
    showError: false,
    useCache: false
  })
}

const sanitizeDownloadNamePart = (value: unknown, fallback: string) => {
  const sanitized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')

  return sanitized || fallback
}

const getPhotoExtension = (photoUrl: string) => {
  try {
    const pathname = new URL(photoUrl, window.location.origin).pathname
    const extension = pathname.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]?.toLowerCase()
    if (extension && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return extension === 'jpeg' ? 'jpg' : extension
    }
  } catch {
    // 无法解析旧照片地址时使用系统默认图片扩展名。
  }

  return 'jpg'
}

const getPhotoDownloadFilename = (index: number, photoUrl: string) => {
  const customerName = getPhotoOwnerName()
  const serialNumber = sanitizeDownloadNamePart(props.item?.serial_number, '无序列号')
  const extension = getPhotoExtension(photoUrl)
  return `${customerName}_${serialNumber}_${index + 1}.${extension}`
}

const togglePhotoSelection = (index: number) => {
  const selectedIndex = selectedPhotos.value.indexOf(index)
  if (selectedIndex > -1) {
    selectedPhotos.value.splice(selectedIndex, 1)
  } else {
    selectedPhotos.value.push(index)
  }
  photoSelectAll.value = selectedPhotos.value.length === previewPhotos.value.length && previewPhotos.value.length > 0
}

const startDragSelect = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.photo-actions') || target.closest('.photo-checkbox')) return

  isDragging.value = true
  const photoItem = target.closest('.photo-grid-item') as HTMLElement | null
  if (!photoItem) return

  const index = parseInt(photoItem.getAttribute('data-index') || '-1')
  if (index >= 0) {
    togglePhotoSelection(index)
  }
}

const onPhotoHover = (index: number) => {
  preloadPhotoAt(index)
  if (!isDragging.value || selectedPhotos.value.includes(index)) return
  selectedPhotos.value.push(index)
  photoSelectAll.value = selectedPhotos.value.length === previewPhotos.value.length && previewPhotos.value.length > 0
}

const onDragSelect = (e: MouseEvent) => {
  if (isDragging.value) e.preventDefault()
}

const endDragSelect = () => {
  isDragging.value = false
}

const handlePhotoSelectAll = (checked: CheckboxValueType) => {
  selectedPhotos.value = Boolean(checked) ? previewPhotos.value.map((_, index) => index) : []
}

const downloadToolbarPhotos = async () => {
  if (selectedPhotos.value.length > 0) {
    await downloadSelectedPhotos()
    return
  }

  await downloadAllPhotos()
}

const downloadSelectedPhotos = async () => {
  if (selectedPhotos.value.length === 0) return

  try {
    for (const index of selectedPhotos.value) {
      const photoUrl = previewPhotos.value[index]
      if (!photoUrl) continue

      await downloadPhotoBlob(
        photoUrl,
        getPhotoDownloadFilename(index, photoUrl)
      )
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    ElMessage.success(`已下载 ${selectedPhotos.value.length} 张照片`)
  } catch (error) {
    logger.error('下载照片失败:', error)
    ElMessage.error('下载照片失败')
  }
}

const applyPhotoDeletion = (indexes: number[], successMessage: string) => {
  if (!canUpload.value) {
    ElMessage.warning('您没有图片上传权限')
    return
  }

  const sortedIndexes = [...indexes].sort((a, b) => b - a)
  sortedIndexes.forEach(index => {
    deletedPhotos.value.push(previewPhotos.value[index])
    previewPhotos.value.splice(index, 1)
  })

  selectedPhotos.value = []
  photoSelectAll.value = false

  if (previewPhotos.value.length === 0) {
    showPhotoViewer.value = false
    currentPhotoIndex.value = 0
  }

  ElMessage.success(successMessage)
}

const deleteSelectedPhotos = () => {
  if (selectedPhotos.value.length === 0) return

  confirmAction(`确定要删除选中的 ${selectedPhotos.value.length} 张照片吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    applyPhotoDeletion(selectedPhotos.value, `已删除 ${selectedPhotos.value.length} 张照片`)
  }).catch(() => {})
}

const deleteAllPhotos = () => {
  if (previewPhotos.value.length === 0) return

  confirmAction(`确定要删除全部 ${previewPhotos.value.length} 张照片吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    applyPhotoDeletion(previewPhotos.value.map((_, index) => index), `已删除全部 ${previewPhotos.value.length} 张照片`)
  }).catch(() => {})
}

const deleteToolbarPhotos = () => {
  if (selectedPhotos.value.length > 0) {
    deleteSelectedPhotos()
    return
  }

  deleteAllPhotos()
}

const openPhotoViewer = (index: number) => {
  currentPhotoIndex.value = index
  showPhotoViewer.value = true
  nextTick(() => {
    preloadNearbyPhotos(index)
  })
}

const removePhotoFromPreview = (index: number) => {
  if (!canUpload.value) {
    ElMessage.warning('您没有图片上传权限')
    return
  }

  const photo = previewPhotos.value[index]
  if (!photo) return

  confirmAction('确定要删除这张照片吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const photoIndex = previewPhotos.value.indexOf(photo)
    if (photoIndex < 0) return
    deletedPhotos.value.push(photo)
    previewPhotos.value.splice(photoIndex, 1)
    if (previewPhotos.value.length === 0) {
      showPhotoViewer.value = false
    }
    ElMessage.success('照片已删除')
  }).catch(() => {})
}

const downloadCurrentPhoto = async (index: number) => {
  const photoUrl = previewPhotos.value[index]
  if (!photoUrl) return

  try {
    await downloadPhotoBlob(
      photoUrl,
      getPhotoDownloadFilename(index, photoUrl)
    )
    ElMessage.success('照片下载成功')
  } catch {
    ElMessage.error('照片下载失败')
  }
}

const downloadAllPhotos = async () => {
  for (let i = 0; i < previewPhotos.value.length; i++) {
    const photoUrl = previewPhotos.value[i]
    if (!photoUrl) continue

    try {
      await downloadPhotoBlob(photoUrl, getPhotoDownloadFilename(i, photoUrl))
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      logger.error(`下载第${i + 1}张照片失败:`, error)
    }
  }
  ElMessage.success(`已下载${previewPhotos.value.length}张照片`)
}

const savePhotoChanges = async () => {
  if (savingPhotos.value) return
  if (!canUpload.value) {
    ElMessage.warning('您没有图片上传权限')
    return
  }

  if (!props.item?.id) {
    ElMessage.error('未找到要更新的记录')
    return
  }

  try {
    savingPhotos.value = true
    const response = await unifiedApi.put(`/subsidy/${props.item.id}/photos`, {
      subsidy_photos: previewPhotos.value,
      deleted_photos: deletedPhotos.value
    })

    if (response.success) {
      ElMessage.success('照片保存成功')
      uploadedPhotos.value = []
      emit('saved')
      emit('update:modelValue', false)
    } else {
      ElMessage.error(response.message || '照片保存失败')
    }
  } catch (error: unknown) {
    logger.error('保存照片失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '照片保存失败')
  } finally {
    savingPhotos.value = false
  }
}
</script>

<style scoped lang="scss">
.photo-upload-area,
.photo-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--tf-color-surface-muted);
}

.photo-upload-area {
  margin-bottom: 18px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.photo-upload-actions {
  width: fit-content;
  max-width: 100%;

  :deep(.toolbar-upload) {
    display: inline-flex;
    width: auto;
    min-width: 0;
  }

  :deep(.toolbar-upload .el-upload) {
    display: inline-flex;
    width: auto;
  }

}

.selected-count {
  color: var(--tf-color-muted);
  font-size: var(--tf-type-scale-13);
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 16px 0;
  user-select: none;
}

.photo-grid-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12px;
  border: 3px solid transparent;
  background: var(--color-bg-white);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &.selected {
    border-color: var(--color-primary);
  }
}

.photo-image {
  width: 100%;
  height: 100%;

  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.photo-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  padding: 4px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
}

.photo-actions {
  position: absolute;
  left: 50%;
  bottom: 10px;
  display: flex;
  gap: 8px;
  transform: translateX(-50%);
}

.selected-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.15);
  pointer-events: none;

  i {
    font-size: var(--tf-type-scale-42);
    color: var(--color-primary);
  }
}

.photo-count-info,
.no-photo-hint {
  text-align: center;
  color: var(--tf-color-muted);
}

.no-photo-hint {
  padding: 56px 20px;
}

@media (max-width: 767px) {
  .photo-upload-area,
  .photo-toolbar,
  .toolbar-left {
    align-items: stretch;
  }

  .photo-upload-actions,
  .toolbar-left {
    width: 100%;
  }

  .photo-upload-actions {
    justify-content: flex-start;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

}
</style>
