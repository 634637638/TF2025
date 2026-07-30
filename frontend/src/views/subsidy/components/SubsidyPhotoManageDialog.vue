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
          <div class="photo-upload-actions">
            <el-upload
              class="toolbar-upload"
              :show-file-list="false"
              :http-request="customUploadRequest"
              accept="image/*,.heic,.heif,.pdf,application/pdf"
              multiple
            >
              <el-button type="primary" size="default" class="toolbar-action-btn">
                <i class="fas fa-image"></i> 上传图片
              </el-button>
            </el-upload>
            <el-button
              class="toolbar-action-btn"
              type="success"
              size="default"
              :disabled="previewPhotos.length === 0"
              @click="downloadToolbarPhotos"
            >
              <i class="fas fa-download"></i> {{ selectedPhotos.length > 0 ? '下载选中' : '下载全部' }}
            </el-button>
            <el-button
              class="toolbar-action-btn"
              type="danger"
              size="default"
              :disabled="previewPhotos.length === 0"
              @click="deleteToolbarPhotos"
            >
              <i class="fas fa-trash"></i> {{ selectedPhotos.length > 0 ? '删除选中' : '删除全部' }}
            </el-button>
          </div>
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
        <div class="tf-dialog-actions photo-preview-footer">
          <el-button @click="closeDialog">取消</el-button>
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
              <InlineLoading text="图片加载中..." />
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
import InlineLoading from '@/components/InlineLoading.vue'
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

  const browserWindow = typeof globalThis.window !== 'undefined' ? globalThis.window : null

  if (browserWindow && 'requestIdleCallback' in browserWindow) {
    browserWindow.requestIdleCallback(warmup, { timeout: 1500 })
    return
  }

  if (browserWindow) {
    browserWindow.setTimeout(warmup, 240)
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

watch(currentPhotoIndex, (index) => {
  if (!showPhotoViewer.value) return
  syncViewerLoading(index)
  preloadNearbyPhotos(index)
})

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
  const customerName = sanitizeDownloadNamePart(props.item?.customer_name, '未知客户')
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

const handlePhotoSelectAll = (checked: boolean) => {
  selectedPhotos.value = checked ? previewPhotos.value.map((_, index) => index) : []
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
  } else if (currentPhotoIndex.value >= previewPhotos.value.length) {
    currentPhotoIndex.value = previewPhotos.value.length - 1
  }

  ElMessage.success(successMessage)
}

const deleteSelectedPhotos = () => {
  if (selectedPhotos.value.length === 0) return

  ElMessageBox.confirm(`确定要删除选中的 ${selectedPhotos.value.length} 张照片吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    applyPhotoDeletion(selectedPhotos.value, `已删除 ${selectedPhotos.value.length} 张照片`)
  }).catch(() => {})
}

const deleteAllPhotos = () => {
  if (previewPhotos.value.length === 0) return

  ElMessageBox.confirm(`确定要删除全部 ${previewPhotos.value.length} 张照片吗？`, '提示', {
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
    await downloadPhotoBlob(
      photoUrl,
      getPhotoDownloadFilename(currentPhotoIndex.value, photoUrl)
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

.photo-upload-actions,
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.photo-upload-actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 12px;
  flex-wrap: nowrap;

  :deep(.toolbar-upload) {
    display: block;
    width: 100%;
    min-width: 0;
  }

  :deep(.toolbar-upload .el-upload) {
    display: block;
    width: 100%;
  }

  :deep(.toolbar-action-btn) {
    width: 100%;
    min-width: 0;
    height: 40px;
    margin-left: 0 !important;
  }

  :deep(.toolbar-action-btn > span) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    gap: 6px;
    white-space: nowrap;
  }
}

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
  box-shadow: var(--tf-button-shadow);

  :deep(span) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
}

.view-btn {
  background: var(--tf-button-primary-bg) !important;
  color: var(--tf-button-on-color) !important;
}

.delete-btn {
  background: var(--tf-button-danger-bg) !important;
  color: var(--tf-button-on-color) !important;
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
  width: 100%;
  height: clamp(360px, 62vh, 640px);
  min-height: 0;
  padding: 20px;
  overflow: hidden;
  background: #f5f5f5;
  border-radius: 8px;
  box-sizing: border-box;
}

.photo-nav-btn {
  position: absolute;
  top: calc(50% - 22px);
  z-index: 2;
  width: 44px !important;
  min-width: 44px !important;
  max-width: 44px;
  height: 44px !important;
  min-height: 44px !important;
  max-height: 44px;
  margin: 0 !important;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  border-radius: 50% !important;
  box-sizing: border-box;
  transform: none !important;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease !important;
  background: var(--tf-button-overlay-bg);
  box-shadow: var(--tf-button-shadow);

  :deep(span) {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  i {
    width: 1em;
    line-height: 1;
    text-align: center;
  }

  &.prev {
    left: 16px;
  }

  &.next {
    right: 16px;
  }
}

.photo-viewer-content .photo-viewer-main .photo-nav-btn.el-button,
.photo-viewer-content .photo-viewer-main .photo-nav-btn.el-button:hover,
.photo-viewer-content .photo-viewer-main .photo-nav-btn.el-button:focus,
.photo-viewer-content .photo-viewer-main .photo-nav-btn.el-button:active {
  transform: none !important;
}

.photo-viewer-image {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: calc(100% - 120px);
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(img) {
    max-width: 100%;
    max-height: 100%;
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
  :deep(.photo-preview-dialog .el-dialog) {
    width: calc(100vw - 16px) !important;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 24px);
    margin: 12px auto !important;
    display: flex;
    flex-direction: column;
  }

  :deep(.photo-preview-dialog .el-dialog__body) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 12px;
  }

  :deep(.photo-preview-dialog .el-dialog__footer) {
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
    background: #fff;
  }

  .photo-viewer-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;

    :deep(.el-button) {
      width: 100%;
      min-width: 0;
      margin-left: 0 !important;
    }
  }

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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
    gap: 6px;

    :deep(.toolbar-action-btn) {
      width: 100%;
      min-width: 0;
      padding: 8px 6px !important;
      height: 36px;
      font-size: 12px !important;
    }

    :deep(.toolbar-action-btn [class*="fa-"]) {
      font-size: 11px;
      margin-right: 4px;
    }

    :deep(.toolbar-action-btn > span) {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .photo-upload-actions :deep(.el-button),
  .toolbar-left :deep(.el-button) {
    margin-left: 0 !important;
  }

  .photo-preview-footer {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: stretch;
    gap: 8px;

    :deep(.el-button > span) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
    }
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .photo-viewer-main {
    height: clamp(280px, 52vh, 480px);
    min-height: 0;
    padding: 12px;
  }

  .photo-nav-btn {
    width: 44px !important;
    min-width: 44px !important;
    max-width: 44px;
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px;
    flex-basis: 44px;

    &.prev {
      left: 10px;
    }

    &.next {
      right: 10px;
    }
  }

  .photo-viewer-image {
    max-width: calc(100% - 104px);
  }
}
</style>
