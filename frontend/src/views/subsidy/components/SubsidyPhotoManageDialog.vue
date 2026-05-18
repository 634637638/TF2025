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
          <el-upload
            :show-file-list="false"
            :http-request="customUploadRequest"
            accept="image/*,.heic,.heif,.pdf,application/pdf"
            multiple
          >
            <el-button type="primary" size="default">
              <i class="fas fa-image"></i> 上传图片
            </el-button>
          </el-upload>
          <span class="upload-tip">支持PDF、图片批量上传</span>
        </div>

        <div v-if="previewPhotos.length > 0" class="photo-grid-area">
          <div class="photo-toolbar">
            <div class="toolbar-left">
              <el-checkbox
                v-model="photoSelectAll"
                :indeterminate="photoIsIndeterminate"
                @change="handlePhotoSelectAll"
              >
                全选
              </el-checkbox>
              <span v-if="selectedPhotos.length > 0" class="selected-count">
                已选择 {{ selectedPhotos.length }} 张
              </span>
            </div>
            <div class="toolbar-right">
              <el-button v-if="selectedPhotos.length > 0" type="primary" size="small" @click="downloadSelectedPhotos">
                <i class="fas fa-download"></i> 下载选中
              </el-button>
              <el-button v-if="selectedPhotos.length > 0" type="danger" size="small" @click="deleteSelectedPhotos">
                <i class="fas fa-trash"></i> 删除选中
              </el-button>
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
              <div class="photo-checkbox" @click.stop="togglePhotoSelection(index)">
                <el-checkbox :model-value="selectedPhotos.includes(index)" />
              </div>

              <AsyncImage :src="resolvePhotoUrl(photo)" alt="国补照片" mode="eager" class="photo-image" />

              <div class="photo-actions">
                <el-button class="action-btn view-btn" circle @click.stop="openPhotoViewer(index)">
                  <i class="fas fa-search-plus"></i>
                </el-button>
                <el-button class="action-btn delete-btn" circle @click.stop="removePhotoFromPreview(index)">
                  <i class="fas fa-trash-alt"></i>
                </el-button>
              </div>

              <div v-if="selectedPhotos.includes(index)" class="selected-overlay">
                <i class="fas fa-check-circle"></i>
              </div>
            </div>
          </div>

          <div class="photo-count-info">
            <i class="fas fa-images"></i> 共 {{ previewPhotos.length }} 张照片
          </div>
        </div>

        <div v-else class="no-photo-hint">
          <i class="fas fa-image"></i>
          <p>暂无照片，请点击上方按钮上传</p>
        </div>
      </div>

      <template #footer>
        <div class="photo-preview-footer">
          <el-button @click="closeDialog">取消</el-button>
          <el-button v-if="previewPhotos.length > 0" type="success" @click="downloadAllPhotos">
            <i class="fas fa-download"></i> 下载全部
          </el-button>
          <el-button type="primary" :loading="savingPhotos" @click="savePhotoChanges">
            <i class="fas fa-save"></i> 保存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showPhotoViewer"
      :title="`照片预览 (${currentPhotoIndex + 1}/${previewPhotos.length})`"
      width="90%"
      class="photo-viewer-dialog"
      append-to-body
      destroy-on-close
    >
      <div class="photo-viewer-content">
        <div class="photo-viewer-main">
          <el-button class="photo-nav-btn prev" circle :disabled="currentPhotoIndex === 0" @click="prevPhoto">
            <i class="fas fa-chevron-left"></i>
          </el-button>
          <div class="photo-viewer-image">
            <AsyncImage
              :key="resolvePhotoUrl(previewPhotos[currentPhotoIndex])"
              :src="resolvePhotoUrl(previewPhotos[currentPhotoIndex])"
              alt="国补照片"
              mode="eager"
              @load="handleViewerImageLoad"
              @error="handleViewerImageLoad"
            />
            <div v-if="viewerLoading" class="photo-viewer-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <span>图片加载中...</span>
            </div>
          </div>
          <el-button
            class="photo-nav-btn next"
            circle
            :disabled="currentPhotoIndex === previewPhotos.length - 1"
            @click="nextPhoto"
          >
            <i class="fas fa-chevron-right"></i>
          </el-button>
        </div>
        <div class="photo-viewer-actions">
          <el-button type="primary" @click="downloadCurrentPhoto">
            <i class="fas fa-download"></i> 下载
          </el-button>
          <el-button type="danger" @click="removePhotoFromPreview(currentPhotoIndex)">
            <i class="fas fa-trash"></i> 删除
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { storage } from '@/composables/core/useLocalStorage'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { useImportExport } from '@/composables/useImportExport'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { formatImageUrl } from '@/utils/format'

const AsyncImage = defineAsyncComponent(() => import('@/components/Image.vue'))

const props = defineProps<{
  modelValue: boolean
  item: any | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const { saveBlobFile } = useImportExport()

const previewPhotos = ref<string[]>([])
const currentPhotoIndex = ref(0)
const savingPhotos = ref(false)
const deletedPhotos = ref<string[]>([])
const uploadedPhotos = ref<string[]>([])
const selectedPhotos = ref<number[]>([])
const photoSelectAll = ref(false)
const isDragging = ref(false)
const showPhotoViewer = ref(false)
const viewerLoading = ref(false)

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
  viewerLoading.value = false
}

const cleanupUnSavedUploads = async () => {
  if (uploadedPhotos.value.length === 0) return
  try {
    await deleteTempFiles(uploadedPhotos.value)
  } catch (error) {
    logger.error('清理未保存照片失败:', error)
  }
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

watch(currentPhotoIndex, (index) => {
  if (!showPhotoViewer.value) return
  syncViewerLoading(index)
  preloadNearbyPhotos(index)
})

const handleDialogChange = (visible: boolean) => {
  emit('update:modelValue', visible)
}

const closeDialog = async () => {
  await cleanupUnSavedUploads()
  clearPhotoRuntimeCache()
  emit('update:modelValue', false)
}

const resolvePhotoUrl = (photo?: string) => formatImageUrl(photo || '')

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
        image.decode().catch(() => undefined).finally(finalize)
        return
      }

      finalize()
    }

    image.onerror = () => {
      pendingPhotoLoads.delete(resolvedUrl)
      reject(new Error(`图片预加载失败: ${resolvedUrl}`))
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

const syncViewerLoading = (index: number) => {
  const resolvedUrl = resolvePhotoUrl(previewPhotos.value[index])
  viewerLoading.value = !!resolvedUrl && !decodedPhotoCache.has(resolvedUrl)
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

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(warmup, { timeout: 1500 })
    return
  }

  window.setTimeout(warmup, 240)
}

const handleViewerImageLoad = () => {
  viewerLoading.value = false
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
  formData.append('serial_number', props.item?.serial_number || 'unknown')
  formData.append('sale_time', props.item?.sale_time || '')

  try {
    const result = await unifiedApi.upload('/subsidy/upload/photo', formData, {
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
    onError?.(new Error(errorMessage))
  } catch (error) {
    logger.error('上传请求失败:', error)
    ElMessage.error('照片上传失败，请重试')
    onError?.(error)
  }
}

const downloadPhotoBlob = async (photoUrl: string, filename: string) => {
  const { formatImageUrl } = await import('@/utils/format')
  const response = await fetch(formatImageUrl(photoUrl))
  const blob = await response.blob()

  saveBlobFile(blob, {
    filename,
    mimeType: blob.type || 'image/jpeg'
  })
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

const handlePhotoSelectAll = (checked: boolean) => {
  selectedPhotos.value = checked ? previewPhotos.value.map((_, index) => index) : []
}

const downloadSelectedPhotos = async () => {
  if (selectedPhotos.value.length === 0) return

  try {
    for (const index of selectedPhotos.value) {
      await downloadPhotoBlob(
        previewPhotos.value[index],
        `国补照片_${props.item?.serial_number || 'unknown'}_${index + 1}.jpg`
      )
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    ElMessage.success(`已下载 ${selectedPhotos.value.length} 张照片`)
  } catch (error) {
    logger.error('下载照片失败:', error)
    ElMessage.error('下载照片失败')
  }
}

const deleteSelectedPhotos = () => {
  if (selectedPhotos.value.length === 0) return

  ElMessageBox.confirm(`确定要删除选中的 ${selectedPhotos.value.length} 张照片吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const sortedIndexes = [...selectedPhotos.value].sort((a, b) => b - a)
    sortedIndexes.forEach(index => {
      deletedPhotos.value.push(previewPhotos.value[index])
      previewPhotos.value.splice(index, 1)
    })
    selectedPhotos.value = []
    photoSelectAll.value = false
    ElMessage.success(`已删除 ${sortedIndexes.length} 张照片`)
  }).catch(() => {})
}

const openPhotoViewer = (index: number) => {
  currentPhotoIndex.value = index
  syncViewerLoading(index)
  showPhotoViewer.value = true
  nextTick(() => {
    preloadNearbyPhotos(index)
  })
}

const prevPhoto = () => {
  if (currentPhotoIndex.value > 0) currentPhotoIndex.value--
}

const nextPhoto = () => {
  if (currentPhotoIndex.value < previewPhotos.value.length - 1) currentPhotoIndex.value++
}

const removePhotoFromPreview = (index: number) => {
  ElMessageBox.confirm('确定要删除这张照片吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    deletedPhotos.value.push(previewPhotos.value[index])
    previewPhotos.value.splice(index, 1)
    if (previewPhotos.value.length === 0) {
      showPhotoViewer.value = false
    } else if (currentPhotoIndex.value >= previewPhotos.value.length) {
      currentPhotoIndex.value = previewPhotos.value.length - 1
    }
    ElMessage.success('照片已删除')
  }).catch(() => {})
}

const downloadCurrentPhoto = async () => {
  const photoUrl = previewPhotos.value[currentPhotoIndex.value]
  if (!photoUrl) return

  try {
    await downloadPhotoBlob(photoUrl, `国补照片_${currentPhotoIndex.value + 1}.jpg`)
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
      await downloadPhotoBlob(photoUrl, `国补照片_${i + 1}.jpg`)
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      logger.error(`下载第${i + 1}张照片失败:`, error)
    }
  }
  ElMessage.success(`已下载${previewPhotos.value.length}张照片`)
}

const savePhotoChanges = async () => {
  if (!props.item?.id) {
    ElMessage.error('未找到要更新的记录')
    return
  }

  try {
    savingPhotos.value = true
    const response = await unifiedApi.put(`/subsidy/${props.item.id}`, {
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
  } catch (error: any) {
    logger.error('保存照片失败:', error)
    ElMessage.error(error.message || '照片保存失败')
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
  background: #f8f9fa;
}

.photo-upload-area {
  margin-bottom: 18px;
}

.upload-tip,
.selected-count {
  color: #6c757d;
  font-size: 13px;
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
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &.selected {
    border-color: #409eff;
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

.action-btn {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 !important;
  border: none !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border-radius: 50% !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);

  :deep(span) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
}

.view-btn {
  background: rgba(64, 158, 255, 0.95) !important;
  color: white !important;
}

.delete-btn {
  background: rgba(245, 108, 108, 0.95) !important;
  color: white !important;
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
    font-size: 42px;
    color: #409eff;
  }
}

.photo-count-info,
.no-photo-hint {
  text-align: center;
  color: #6c757d;
}

.no-photo-hint {
  padding: 56px 20px;
}

.photo-preview-footer,
.photo-viewer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.photo-viewer-main {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
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
  position: relative;
  max-width: calc(100% - 100px);

  :deep(img) {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  }
}

.photo-viewer-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #606266;
  background: rgba(245, 247, 250, 0.92);
  border-radius: 8px;
}

@media (max-width: 768px) {
  .photo-upload-area,
  .photo-toolbar,
  .photo-preview-footer,
  .photo-viewer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .photo-viewer-main {
    min-height: 300px;
  }
}
</style>
