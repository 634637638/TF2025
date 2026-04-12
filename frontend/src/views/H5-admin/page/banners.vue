<!--
  BannerManagement - H5轮播图管理页面（员工端）
  功能：轮播图列表、添加、编辑、删除、排序
-->
<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="h5-admin-banners"
    module-name="轮播图管理"
    permission-code="h5-banners:view"
  />

  <div v-else class="banner-management-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 轮播图列表 -->
    <div v-else class="banner-list">
      <draggable
        v-model="banners"
        :animation="200"
        handle=".drag-handle"
        item-key="id"
        :disabled="!canEdit"
        @end="handleDragEnd"
      >
        <template #item="{ element: banner }">
          <div class="banner-item" :class="{ inactive: banner.status === 'inactive' }">
            <div class="drag-handle">
              <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="banner-image">
              <!-- 显示多张图片或单张图片 -->
              <div v-if="banner.images && banner.images.length > 1" class="banner-images-multi">
                <img
                  v-for="(imgUrl, idx) in banner.images.slice(0, 3)"
                  :key="idx"
                  :src="getBannerImageUrl(imgUrl)"
                  :alt="`${banner.title}-${idx}`"
                  class="multi-image"
                />
                <span v-if="banner.images.length > 3" class="more-images">
                  +{{ banner.images.length - 3 }}
                </span>
              </div>
              <img v-else :src="getBannerImageUrl(banner.image_url)" :alt="banner.title" />
            </div>
            <div class="banner-info">
              <h4 class="banner-title">{{ banner.title || '未命名' }}</h4>
              <p class="banner-meta">
                <span v-if="banner.images && banner.images.length > 1" class="image-count">
                  <i class="fas fa-images"></i>
                  {{ banner.images.length }}张图片
                </span>
                <span v-if="banner.link_type !== 'none'">
                  <i class="fas fa-link"></i>
                  {{ getLinkTypeText(banner.link_type) }}
                </span>
                <span v-if="banner.start_time || banner.end_time">
                  <i class="fas fa-clock"></i>
                  {{ formatTimeRange(banner) }}
                </span>
              </p>
            </div>
            <div class="banner-status">
              <el-switch
                v-model="banner.status"
                active-value="active"
                inactive-value="inactive"
                :disabled="!canEdit"
                @change="handleStatusChange(banner)"
              />
            </div>
            <div class="banner-actions">
              <el-button v-if="canEdit" plain type="primary" size="small" @click="handleEdit(banner)" class="btn-sm">
                <i class="fas fa-edit mr-1"></i>编辑
              </el-button>
              <el-button v-if="canDelete" plain type="danger" size="small" @click="handleDelete(banner)" class="btn-sm">
                <i class="fas fa-trash mr-1"></i>删除
              </el-button>
            </div>
          </div>
        </template>
      </draggable>

      <!-- 空状态 -->
      <el-empty v-if="banners.length === 0" description="暂无轮播图">
        <el-button v-if="canCreate" type="primary" @click="handleAdd">新增</el-button>
      </el-empty>
    </div>

    <!-- 编辑弹窗 -->
    <MobileDialog
      v-model="showDialog"
      :title="dialogTitle"
      width="600px"
      dialog-class="banner-dialog"
      :show-default-footer="false"
      @close="handleDialogClose"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px" :disabled="!canSaveCurrentBanner">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="轮播图片" prop="image_url" required>
          <div class="banner-images-container">
            <div
              v-for="(img, index) in bannerImages"
              :key="index"
              class="banner-image-item"
            >
              <img :src="getImageUrl(img)" :alt="`轮播图${index + 1}`" />
              <div class="image-actions">
                <span class="image-index">{{ index + 1 }}</span>
                <div
                  @click="removeImage(index)"
                  class="image-delete-btn"
                  @mouseenter="($event.currentTarget as HTMLElement).style.background = 'rgb(245, 108, 108)'"
                  @mouseleave="($event.currentTarget as HTMLElement).style.background = 'rgba(245, 108, 108, 0.9)'"
                >
                  <i class="fas fa-times" style="font-size: 12px; color: white;"></i>
                </div>
              </div>
            </div>
            <el-upload
              :action="uploadAction"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="handleBannerUploadSuccess"
              :on-error="handleUploadError"
              :before-upload="beforeUpload"
              name="files"
              :multiple="true"
              :limit="10"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,application/pdf"
              :auto-upload="true"
              :disabled="!canSaveCurrentBanner"
              class="banner-upload-trigger"
            >
              <div class="upload-placeholder">
                <i class="fas fa-plus"></i>
                <span>添加图片</span>
              </div>
            </el-upload>
          </div>
          <template #tip>
            <span class="tip-text">建议尺寸：750x400px，支持JPG、PNG、PDF格式，可一次选择多张图片（最多10张）。PDF文件会自动转换为图片</span>
          </template>
        </el-form-item>
        <el-form-item label="跳转类型">
          <el-select v-model="form.link_type" placeholder="请选择跳转类型">
            <el-option label="不跳转" value="none" />
            <el-option label="商品分类" value="category" />
            <el-option label="外部链接" value="external" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.link_type !== 'none'" label="跳转链接">
          <el-input v-model="form.link_url" placeholder="请输入跳转链接" />
          <template #tip>
            <span class="tip-text">
              分类：/products?brand_id=1 或 /products?is_new=false<br>
              外部：完整的URL地址
            </span>
          </template>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="轮播间隔">
          <el-input-number v-model="form.interval" :min="500" :max="10000" :step="500" />
          <template #tip>
            <span class="tip-text">每张图片显示时间（毫秒），默认3000ms（3秒）</span>
          </template>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="form.status"
            active-value="active"
            inactive-value="inactive"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="展示时间">
          <el-date-picker
            v-model="timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <template #tip>
            <span class="tip-text">留空表示永久展示</span>
          </template>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button type="default" @click="handleCancelDialog">取消</el-button>
        <el-button v-if="canSaveCurrentBanner" type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { Refresh, Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import { getAllBanners, createBanner, updateBanner, deleteBanner, reorderBanners } from '@/api/shop'
import { PermissionDenied } from '@/components/base/index'
import { useAuthStore } from '@/stores/auth'
import { formatImageUrl } from '@/utils/format'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import type { ShopBanner } from '@/api/shop'
import { logger } from '@/utils/logger'
import type { HeaderAction } from '@/types'
const router = useRouter()
const authStore = useAuthStore()
const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('h5-admin-banners')

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

// 上传配置
const uploadAction = computed(() => `${import.meta.env.VITE_API_BASE_URL || '/api'}/shop/upload/image`)
const uploadHeaders = computed(() => ({
  'Authorization': `Bearer ${authStore.token}`
}))

// 轮播图图片列表（支持多图）
interface BannerImage {
  url: string
}
const bannerImages = ref<BannerImage[]>([])
const originalBannerImages = ref<string[]>([]) // 记录原始图片列表
const uploadedTempImages = ref<string[]>([]) // 记录本次上传的临时图片

const isTempImage = (url: string) => uploadedTempImages.value.includes(url)

const cleanupTempImages = async (files: string[] = uploadedTempImages.value) => {
  const targets = files.filter(Boolean)
  if (targets.length === 0) {
    return true
  }

  const success = await deleteTempFiles(targets)
  if (success) {
    uploadedTempImages.value = uploadedTempImages.value.filter(url => !targets.includes(url))
  }
  return success
}

// 获取图片 URL - 使用统一的图片URL处理函数
const getImageUrl = (img: BannerImage): string => {
  return formatImageUrl(img.url)
}

// 获取轮播图列表中的图片URL - 使用统一的图片URL处理函数
const getBannerImageUrl = (url: string): string => {
  return formatImageUrl(url)
}

// 上传成功回调 - 支持多图，立即预览
const handleBannerUploadSuccess = (response: any, file: any, uploadFiles: any) => {
  if (!canSaveCurrentBanner.value) {
    handleNoPermission(dialogMode.value === 'add' ? 'create' : 'edit')
    return
  }

  // el-upload 组件直接使用 axios，不会经过 unified-api 拦截器
  // 所以响应格式是完整的 ApiResponse: { success, message, data }
  let newImages: string[] = []

  // 处理不同的响应格式
  if (response && response.success && response.data && response.data.files) {
    // ApiResponse 多文件格式: { success: true, data: { files: [{ url: ... }] } }
    const filesData = response.data.files
    if (Array.isArray(filesData) && filesData.length > 0) {
      newImages = filesData.map(f => f.url)
    }
  } else if (response && response.data && response.data.url) {
    // ApiResponse 单文件格式: { success: true, data: { url: ... } }
    newImages.push(response.data.url)
  } else if (response && response.url) {
    // 直接格式: { url: ... }
    newImages.push(response.url)
  }

  // 立即添加到当前图片列表（实现即时预览）
  if (newImages.length > 0) {
    newImages.forEach(imgUrl => {
      const exists = bannerImages.value.some(img => img.url === imgUrl)
      if (!exists) {
        bannerImages.value.push({ url: imgUrl })
        // 记录为临时上传的图片
        if (!originalBannerImages.value.includes(imgUrl)) {
          uploadedTempImages.value.push(imgUrl)
        }
      }
    })

    // 同步更新主表单的 image_url（第一张图作为主图）
    if (bannerImages.value.length > 0) {
      form.value.image_url = bannerImages.value[0].url
    }

    ElMessage.success(`成功上传 ${newImages.length} 张图片`)
  } else {
    logger.error('[上传失败] 响应格式错误:', response)
    ElMessage.error('上传失败: 响应格式错误')
  }
}

// 上传错误处理
const handleUploadError = (error: any, file: any, uploadFiles: any) => {
  logger.error('[上传失败] 错误信息:', error)
  logger.error('[上传失败] 文件信息:', file)

  // 尝试解析错误信息
  let errorMsg = '上传失败'
  if (error.message) {
    errorMsg += ': ' + error.message
  } else if (typeof error === 'string') {
    errorMsg += ': ' + error
  }

  ElMessage.error(errorMsg)
}

// 移除图片
const removeImage = async (index: number) => {
  if (!canSaveCurrentBanner.value) {
    handleNoPermission(dialogMode.value === 'add' ? 'create' : 'edit')
    return
  }

  const removedImage = bannerImages.value[index]
  if (!removedImage) {
    return
  }

  bannerImages.value.splice(index, 1)

  if (isTempImage(removedImage.url)) {
    await cleanupTempImages([removedImage.url])
  }

  // 更新主图
  if (bannerImages.value.length > 0) {
    form.value.image_url = bannerImages.value[0].url
  } else {
    form.value.image_url = ''
  }
}

// 上传前验证和PDF转换
const beforeUpload = async (file: File) => {
  if (!canSaveCurrentBanner.value) {
    handleNoPermission(dialogMode.value === 'add' ? 'create' : 'edit')
    return false
  }

  const isPDF = file.type === 'application/pdf'
  const isImage = file.type.startsWith('image/')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage && !isPDF) {
    ElMessage.error('只能上传图片或PDF文件!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB!')
    return false
  }

  // 如果是PDF，转换为图片
  if (isPDF) {
    try {
      ElMessage.info('正在转换PDF...')
      const imageFile = await convertPDFToImage(file)
      // 返回转换后的图片文件
      return imageFile
    } catch (error) {
      logger.error('PDF转换失败:', error)
      ElMessage.error('PDF转换失败，请重试')
      return false
    }
  }

  return true
}

// PDF转图片函数
const convertPDFToImage = async (pdfFile: File): Promise<File> => {
  const pdfjsLib = await import('pdfjs-dist')

  // 使用本地worker避免CDN加载问题
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  // 读取PDF文件
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // 获取第一页，使用更高的缩放比例
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 3.0 })

  // 创建canvas
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.width = viewport.width
  canvas.height = viewport.height

  // 渲染PDF到canvas
  await page.render({
    canvas,
    canvasContext: context,
    viewport: viewport
  }).promise

  // 将canvas转换为Blob，使用最高质量
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 1.0)
  })

  // 创建新的File对象
  const fileName = pdfFile.name.replace('.pdf', '.jpg')
  return new File([blob], fileName, { type: 'image/jpeg' })
}

const formRef = ref<FormInstance>()

// 数据
const banners = ref<ShopBanner[]>([])
const loading = ref(true)
const showDialog = ref(false)
const saving = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const timeRange = ref<[string, string] | null>(null)

// 表单数据
const form = ref<ShopBanner>({
  title: '',
  image_url: '',
  link_url: '',
  link_type: 'none',
  sort_order: 0,
  status: 'active',
  interval: 3000,  // 默认3秒
  start_time: undefined,
  end_time: undefined
})

// 表单验证规则
const formRules = {
  title: [
    ValidationRules.required('请输入标题')
  ],
  image_url: [
    ValidationRules.required('请上传图片')
  ]
}

// 弹窗标题
const dialogTitle = computed(() => dialogMode.value === 'add' ? '新增轮播图' : '编辑轮播图')
const canSaveCurrentBanner = computed(() => (
  dialogMode.value === 'add' ? canCreate.value : canEdit.value
))

const ensureBannerPermission = (action: 'create' | 'edit' | 'delete') => {
  const permitted = action === 'create'
    ? canCreate.value
    : action === 'delete'
      ? canDelete.value
      : canEdit.value

  if (permitted) {
    return true
  }

  handleNoPermission(action)
  return false
}

// 获取轮播图列表
const loadBanners = async () => {
  if (!canView.value) {
    banners.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    const response = await getAllBanners()
    // unifiedApi 返回 ApiResponse 格式，需要取 data
    const data = Array.isArray(response) ? response : (response?.data || [])
    banners.value = data as ShopBanner[]
  } catch (error) {
    logger.error('获取轮播图失败:', error)
    ElMessage.error('获取轮播图失败')
    banners.value = [] // 确保错误时也是数组
  } finally {
    loading.value = false
  }
}

// 新增
const handleAdd = () => {
  if (!ensureBannerPermission('create')) {
    return
  }

  dialogMode.value = 'add'
  form.value = {
    title: '',
    image_url: '',
    link_url: '',
    link_type: 'none',
    sort_order: banners.value.length,
    status: 'active',
    interval: 3000  // 默认3秒
  }
  bannerImages.value = []
  timeRange.value = null
  showDialog.value = true
}

// 编辑
const handleEdit = (banner: ShopBanner) => {
  if (!ensureBannerPermission('edit')) {
    return
  }

  dialogMode.value = 'edit'
  form.value = {
    ...banner,
    interval: banner.interval || 3000  // 确保有默认值
  }

  // 加载图片列表
  if (banner.images && Array.isArray(banner.images)) {
    bannerImages.value = banner.images.map((url: string) => ({ url }))
    originalBannerImages.value = [...banner.images]
  } else if (banner.image_url) {
    bannerImages.value = [{ url: banner.image_url }]
    originalBannerImages.value = [banner.image_url]
  } else {
    bannerImages.value = []
    originalBannerImages.value = []
  }
  uploadedTempImages.value = [] // 清空临时图片记录

  if (banner.start_time && banner.end_time) {
    timeRange.value = [banner.start_time, banner.end_time]
  } else {
    timeRange.value = null
  }

  showDialog.value = true
}

// 保存
const handleSave = async () => {
  if (!ensureBannerPermission(dialogMode.value === 'add' ? 'create' : 'edit')) {
    return
  }

  if (!formRef.value) return

  try {
    await formRef.value.validate()

    saving.value = true

    // 处理多图片数据
    form.value.images = bannerImages.value.map(img => img.url)

    // 确保主图存在
    if (bannerImages.value.length > 0) {
      form.value.image_url = bannerImages.value[0].url
    }

    // 处理时间范围
    if (timeRange.value && timeRange.value.length === 2) {
      form.value.start_time = timeRange.value[0]
      form.value.end_time = timeRange.value[1]
    } else {
      form.value.start_time = undefined
      form.value.end_time = undefined
    }

    if (dialogMode.value === 'add') {
      await createBanner(form.value)
      ElMessage.success('创建成功')
    } else {
      await updateBanner(form.value.id!, form.value)
      ElMessage.success('更新成功')
    }

    showDialog.value = false
    await loadBanners()
    // 保存成功后清空临时图片记录
    uploadedTempImages.value = []
  } catch (error: any) {
    logger.error('保存失败:', error)
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    saving.value = false
  }
}

// 删除
const handleDelete = (banner: ShopBanner) => {
  if (!ensureBannerPermission('delete')) {
    return
  }

  ElMessageBox.confirm(
    `确定要删除轮播图"${banner.title}"吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteBanner(banner.id!)
      ElMessage.success('删除成功')
      await loadBanners()
    } catch (error: any) {
      logger.error('删除失败:', error)
      ElMessage.error(error.message || '删除失败')
    }
  }).catch(() => {
    // 取消删除
  })
}

// 状态切换
const handleStatusChange = async (banner: ShopBanner) => {
  if (!ensureBannerPermission('edit')) {
    banner.status = banner.status === 'active' ? 'inactive' : 'active'
    return
  }

  try {
    await updateBanner(banner.id!, banner)
    ElMessage.success('状态更新成功')
  } catch (error: any) {
    // 恢复原状态
    banner.status = banner.status === 'active' ? 'inactive' : 'active'
    ElMessage.error(error.message || '更新失败')
  }
}

// 拖拽排序
const handleDragEnd = async () => {
  if (!ensureBannerPermission('edit')) {
    await loadBanners()
    return
  }

  try {
    const orders = banners.value.map((banner, index) => ({
      id: banner.id!,
      sort_order: index
    }))

    await reorderBanners(orders)
    ElMessage.success('排序更新成功')
  } catch (error: any) {
    logger.error('排序失败:', error)
    ElMessage.error(error.message || '排序失败')
    await loadBanners() // 重新加载恢复原序
  }
}

// 取消按钮（关闭弹窗时清理临时文件）
const handleCancelDialog = async () => {
  await handleDialogClose()
  showDialog.value = false
}

// 关闭弹窗
const handleDialogClose = async () => {
  // 如果有未保存的临时图片，删除它们
  await cleanupTempImages()

  formRef.value?.resetFields()
  bannerImages.value = []
  originalBannerImages.value = []
  uploadedTempImages.value = []
  timeRange.value = null
}

// 获取跳转类型文本
const getLinkTypeText = (type: string) => {
  const map: Record<string, string> = {
    none: '不跳转',
    product: '商品详情',
    category: '商品分类',
    external: '外部链接'
  }
  return map[type] || type
}

// 格式化时间范围
const formatTimeRange = (banner: ShopBanner) => {
  if (banner.start_time && banner.end_time) {
    return `${banner.start_time.slice(0, 10)} ~ ${banner.end_time.slice(0, 10)}`
  }
  return '永久展示'
}

onMounted(() => {
  if (canView.value) {
    loadBanners()
  }
  // 注册头部操作按钮
  if (registerHeaderActions) {
    registerHeaderActions([
      ...(canCreate.value ? [{
        label: '新增',
        type: 'primary' as const,
        icon: Plus,
        handler: () => handleAdd()
      }] : []),
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: () => loadBanners()
      }
    ])
  }
})

// 路由守卫：页面离开时清理临时文件
onBeforeRouteLeave(async () => {
  await cleanupTempImages()
  return true
})

onUnmounted(() => {
  void cleanupTempImages()
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
.banner-management-page {
  padding: 24px;
}

// 加载状态
.loading-state {
  padding: 40px;
}

// 轮播图列表
.banner-list {
  max-width: 900px;
  margin: 0 auto;

  .banner-item {
    display: flex;
    align-items: center;
    gap: 16px;
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: all 0.3s;

    &.inactive {
      opacity: 0.6;
    }

    .drag-handle {
      cursor: move;
      color: #999;
      font-size: 18px;
      padding: 8px;
    }

    .banner-image {
      width: 120px;
      height: 64px;
      border-radius: 6px;
      overflow: hidden;
      background: #f5f5f5;
      flex-shrink: 0;
      position: relative;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      // 多图显示
      .banner-images-multi {
        display: flex;
        width: 100%;
        height: 100%;
        gap: 2px;

        .multi-image {
          flex: 1;
          height: 100%;
          object-fit: cover;
          border-radius: 4px;
        }

        .more-images {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          color: #fff;
          font-size: 12px;
          font-weight: 500;
        }
      }
    }

    .banner-info {
      flex: 1;
      min-width: 0;

      .banner-title {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        margin: 0 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .banner-meta {
        font-size: 13px;
        color: #999;
        margin: 0;

        span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-right: 16px;

          i {
            font-size: 12px;
          }
        }
      }
    }

    .banner-status {
      margin-right: 16px;
    }

    .banner-actions {
      display: flex;
      gap: 8px;
    }
  }
}

// 提示文本
.tip-text {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  display: block;
  margin-top: 4px;
}

// 轮播图图片容器
.banner-images-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

// 单个图片项
.banner-image-item {
  position: relative;
  width: 120px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  background: #f5f5f5;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-actions {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.3s;

    &:hover {
      opacity: 1;
    }
  }

  .image-index {
    position: absolute;
    top: 4px;
    left: 4px;
    background: rgba(255, 107, 0, 0.9);
    color: #fff;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  &:hover .image-actions {
    opacity: 1;
  }
}

// 上传按钮样式
.banner-upload-trigger {
  :deep(.el-upload) {
    width: 120px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
    background: #fafafa;

    &:hover {
      border-color: #ff6b00;
      background: #fff5f0;
    }
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;

    i {
      font-size: 20px;
      color: #8c939d;
    }

    span {
      font-size: 12px;
      color: #999;
    }
  }
}

:deep(.banner-dialog .el-dialog__body) {
  .el-form-item__tip {
    margin-top: 4px;
  }
}
</style>
