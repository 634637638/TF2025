<!--
  BannerManagement - H5轮播图管理页面（员工端）
  功能：轮播图列表、添加、编辑、删除、排序
-->
<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="h5-admin-banners"
    module-name="轮播图管理"
    permission-code="h5-banners:view"
  >
    <div class="banner-management-page">
      <!-- 加载状态 -->
      <SectionLoading
        v-if="loading"
        text="加载轮播图中..."
        size="large"
      />

      <!-- 轮播图列表 -->
      <div
        v-else
        class="banner-list"
      >
        <draggable
          v-model="banners"
          :animation="200"
          handle=".drag-handle"
          item-key="id"
          :disabled="!canEdit"
          @end="handleDragEnd"
        >
          <template #item="{ element: banner }">
            <div
              class="banner-item"
              :class="{ inactive: banner.status === 'inactive' }"
            >
              <div class="drag-handle">
                <i class="fas fa-grip-vertical" />
              </div>
              <div
                v-if="canViewField('banner.image')"
                class="banner-image"
              >
                <!-- 显示多张图片或单张图片 -->
                <div
                  v-if="banner.images && banner.images.length > 1"
                  class="banner-images-multi"
                >
                  <img
                    v-for="(imgUrl, idx) in banner.images.slice(0, 3)"
                    :key="idx"
                    :src="getBannerImageUrl(imgUrl)"
                    :alt="`${banner.title}-${idx}`"
                    class="multi-image"
                  >
                  <span
                    v-if="banner.images.length > 3"
                    class="more-images"
                  >
                    +{{ banner.images.length - 3 }}
                  </span>
                </div>
                <img
                  v-else
                  :src="getBannerImageUrl(banner.image_url)"
                  :alt="banner.title"
                >
              </div>
              <div class="banner-info">
                <h4
                  v-if="canViewField('banner.title')"
                  class="banner-title"
                >
                  {{ banner.title || '未命名' }}
                </h4>
                <p class="banner-meta">
                  <span
                    v-if="canViewField('banner.image') && banner.images && banner.images.length > 1"
                    class="image-count"
                  >
                    <i class="fas fa-images" />
                    {{ banner.images.length }}张图片
                  </span>
                  <span v-if="canViewField('banner.link_type') && banner.link_type !== 'none'">
                    <i class="fas fa-link" />
                    {{ getLinkTypeText(banner.link_type) }}
                  </span>
                  <span v-if="canViewField('banner.display_time') && (banner.start_time || banner.end_time)">
                    <i class="fas fa-clock" />
                    {{ formatTimeRange(banner) }}
                  </span>
                </p>
              </div>
              <div
                v-if="canViewField('banner.status')"
                class="banner-status"
              >
                <el-switch
                  v-model="banner.status"
                  active-value="active"
                  inactive-value="inactive"
                  :disabled="!canEdit"
                  @change="handleStatusChange(banner)"
                />
              </div>
              <div
                v-if="showActionColumn"
                class="banner-actions"
              >
                <el-button
                  v-if="canEdit"
                  plain
                  type="primary"
                  size="small"
                  class="btn-sm"
                  @click="handleEdit(banner)"
                >
                  <i class="fas fa-edit mr-1" />编辑
                </el-button>
                <el-button
                  v-if="canDelete"
                  plain
                  type="danger"
                  size="small"
                  class="btn-sm"
                  @click="handleDelete(banner)"
                >
                  <i class="fas fa-trash mr-1" />删除
                </el-button>
              </div>
            </div>
          </template>
        </draggable>

        <!-- 空状态 -->
        <DataEmptyState
          v-if="banners.length === 0"
          description="暂无轮播图"
        >
          <el-button
            v-if="canCreate"
            type="primary"
            @click="handleAdd"
          >
            新增
          </el-button>
        </DataEmptyState>
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
        <el-form
          ref="formRef"
          :model="form"
          :rules="formRules"
          label-width="100px"
          :disabled="!canSaveCurrentBanner"
          class="banner-form"
        >
          <el-form-item
            v-if="canViewField('banner.title')"
            label="标题"
            prop="title"
          >
            <el-input
              v-model="form.title"
              placeholder="请输入标题"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.image')"
            label="轮播图片"
            prop="image_url"
            required
          >
            <div class="banner-images-container">
              <div
                v-for="(img, index) in bannerImages"
                :key="index"
                class="banner-image-item"
              >
                <img
                  :src="getImageUrl(img)"
                  :alt="`轮播图${index + 1}`"
                >
                <div class="image-actions">
                  <span class="table-number-badge banner-number-position">{{ index + 1 }}</span>
                  <el-button
                    native-type="button"
                    class="image-delete-btn tf-button--overlay-tool tf-button--overlay-danger"
                    title="删除图片"
                    aria-label="删除图片"
                    @click="removeImage(index)"
                  >
                    <i
                      class="fas fa-times"
                    />
                  </el-button>
                </div>
              </div>
              <el-upload
                :show-file-list="false"
                :http-request="handleBannerUpload"
                :before-upload="beforeUpload"
                :multiple="true"
                :limit="10"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,application/pdf"
                :auto-upload="true"
                :disabled="!canSaveCurrentBanner"
                class="banner-upload-trigger"
              >
                <div class="upload-placeholder">
                  <i class="fas fa-plus" />
                  <span>添加图片</span>
                </div>
              </el-upload>
            </div>
            <template #tip>
              <span class="tip-text">建议尺寸：750x400px，支持JPG、PNG、PDF格式，可一次选择多张图片（最多10张）。PDF文件会自动转换为图片</span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.link_type')"
            label="跳转类型"
          >
            <el-select
              v-model="form.link_type"
              placeholder="请选择跳转类型"
            >
              <el-option
                label="不跳转"
                value="none"
              />
              <el-option
                label="商品分类"
                value="category"
              />
              <el-option
                label="外部链接"
                value="external"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.link_url') && form.link_type !== 'none'"
            label="跳转链接"
          >
            <el-input
              v-model="form.link_url"
              placeholder="请输入跳转链接"
            />
            <template #tip>
              <span class="tip-text">
                分类：/products?brand_id=1 或 /products?is_new=false<br>
                外部：完整的URL地址
              </span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.sort_order')"
            label="排序"
          >
            <el-input-number
              v-model="form.sort_order"
              :min="0"
              :controls="false"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.interval')"
            label="轮播间隔"
          >
            <el-input-number
              v-model="form.interval"
              :min="500"
              :max="10000"
              :step="500"
              :controls="false"
            />
            <template #tip>
              <span class="tip-text">每张图片显示时间（毫秒），默认3000ms（3秒）</span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.status')"
            label="状态"
          >
            <el-switch
              v-model="form.status"
              active-value="active"
              inactive-value="inactive"
              active-text="启用"
              inactive-text="停用"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('banner.display_time')"
            label="展示时间"
          >
            <DateRangePicker
              v-model="timeRange"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              picker-type="datetime"
              :value-format="TIME_FORMATS.DATETIME"
            />
            <template #tip>
              <span class="tip-text">留空表示永久展示</span>
            </template>
          </el-form-item>
        </el-form>

        <template #footer>
          <div class="tf-dialog-actions">
            <el-button
              type="default"
              @click="handleCancelDialog"
            >
              取消
            </el-button>
            <el-button
              v-if="canSaveCurrentBanner"
              type="primary"
              :loading="saving"
              @click="handleSave"
            >
              确定
            </el-button>
          </div>
        </template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { TIME_FORMATS } from '@/utils/time'
import { confirmAction } from '@/utils/message-box'
import { ref, computed, onMounted, onUnmounted, onActivated, inject, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { FormInstance, type UploadFile, type UploadFiles, type UploadRawFile, type UploadRequestOptions } from 'element-plus'
import { UploadAjaxError } from 'element-plus/es/components/upload/src/ajax'
import { ValidationRules } from '@/composables'
import { Refresh, Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import SectionLoading from '@/components/SectionLoading.vue'
import { getAllBanners, createBanner, updateBanner, deleteBanner, reorderBanners } from '@/api/shop'
import { PermissionGate } from '@/components/base/index'
import { formatImageUrl } from '@/utils/format'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import type { ShopBanner } from '@/api/shop'
import { logger } from '@/utils/logger'
import { isPdfFile, prepareMediaFile, validateMediaFile } from '@/utils/upload-media'
import { unifiedApi } from '@/utils/unified-api'
import DateRangePicker from '@/components/DateRangePicker.vue'
import type { HeaderAction } from '@/types'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

const bannerPermissions = usePagePermissions('h5-admin-banners')
const { handleNoPermission } = bannerPermissions
const canView = computed(() => bannerPermissions.canView.value)
const canCreate = computed(() => bannerPermissions.canCreate.value)
const canEdit = computed(() => bannerPermissions.canEdit.value)
const canDelete = computed(() => bannerPermissions.canDelete.value)
const BANNERS_MODULE_KEY = 'h5_admin_bannersview'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(BANNERS_MODULE_KEY, fieldKey)
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canEdit.value, canDelete.value]
))

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(_actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

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
const handleBannerUploadSuccess = (response: unknown, _file: UploadRawFile | UploadFile, _uploadFiles: UploadFiles) => {
  if (!canSaveCurrentBanner.value) {
    handleNoPermission(dialogMode.value === 'add' ? 'create' : 'edit')
    return
  }

  // el-upload 组件直接使用 axios，不会经过 unified-api 拦截器
  // 所以响应格式是完整的 ApiResponse: { success, message, data }
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {}
  const nestedData = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
  let newImages: string[] = []

  // 处理不同的响应格式
  if (payload.success && Array.isArray(nestedData.files)) {
    // ApiResponse 多文件格式: { success: true, data: { files: [{ url: ... }] } }
    const filesData = nestedData.files
    if (filesData.length > 0) {
      newImages = filesData.flatMap(file => {
        const record = file && typeof file === 'object' ? file as Record<string, unknown> : {}
        return typeof record.url === 'string' ? [record.url] : []
      })
    }
  } else if (typeof nestedData.url === 'string') {
    // ApiResponse 单文件格式: { success: true, data: { url: ... } }
    newImages.push(nestedData.url)
  } else if (typeof payload.url === 'string') {
    // 直接格式: { url: ... }
    newImages.push(payload.url)
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

    globalNotifications.success(`成功上传 ${newImages.length} 张图片`)
  } else {
    logger.error('[上传失败] 响应格式错误:', response)
    globalNotifications.error('上传失败: 响应格式错误')
  }
}

const handleBannerUpload = async (options: UploadRequestOptions) => {
  try {
    const file = await prepareMediaFile(options.file as File, {
      allowVideo: false,
      maxImageSizeMb: 10,
      maxPdfSizeMb: 10
    })
    const formData = new FormData()
    formData.append('files', file)
    formData.append('module', 'h5_banners')
    const response = await unifiedApi.upload('/shop/upload/image', formData)
    handleBannerUploadSuccess(response, options.file, [])
    options.onSuccess?.(response)
  } catch (error) {
    handleUploadError(error, options.file, [])
    const uploadError = error instanceof Error
      ? new UploadAjaxError(error.message, 500, options.method, options.action)
      : new UploadAjaxError('上传失败', 500, options.method, options.action)
    options.onError?.(uploadError)
  }
}

// 上传错误处理
const handleUploadError = (error: unknown, file: UploadRawFile | UploadFile, _uploadFiles: UploadFiles) => {
  logger.error('[上传失败] 错误信息:', error)
  logger.error('[上传失败] 文件信息:', file)

  // 尝试解析错误信息
  let errorMsg = '上传失败'
  if (error instanceof Error && error.message) {
    errorMsg += ': ' + error.message
  } else if (typeof error === 'string') {
    errorMsg += ': ' + error
  }

  globalNotifications.error(errorMsg)
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

  const validationMessage = validateMediaFile(file, {
    allowVideo: false,
    maxImageSizeMb: 10,
    maxPdfSizeMb: 10
  })
  if (validationMessage) {
    globalNotifications.error(validationMessage)
    return false
  }

  if (isPdfFile(file)) {
    try {
      globalNotifications.info('正在转换PDF...')
      return await prepareMediaFile(file, { allowVideo: false, maxImageSizeMb: 10, maxPdfSizeMb: 10 })
    } catch (error) {
      logger.error('PDF转换失败:', error)
      globalNotifications.error(error instanceof Error ? error.message : 'PDF转换失败，请重试')
      return false
    }
  }

  return true
}

const formRef = ref<FormInstance>()

// 数据
const banners = ref<ShopBanner[]>([])
const loading = ref(true)
const hasInitializedPageData = ref(false)
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
    globalNotifications.error('获取轮播图失败')
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
  if (saving.value) return

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

    const payload: Partial<ShopBanner> = { ...form.value }
    const fieldPayloadMap: Array<[keyof ShopBanner, string]> = [
      ['title', 'banner.title'],
      ['image_url', 'banner.image'],
      ['images', 'banner.image'],
      ['link_type', 'banner.link_type'],
      ['link_url', 'banner.link_url'],
      ['sort_order', 'banner.sort_order'],
      ['interval', 'banner.interval'],
      ['status', 'banner.status'],
      ['start_time', 'banner.display_time'],
      ['end_time', 'banner.display_time']
    ]
    fieldPayloadMap.forEach(([key, fieldKey]) => {
      if (!canViewField(fieldKey)) {
        delete payload[key]
      }
    })

    if (dialogMode.value === 'add') {
      if (!payload.title || !payload.image_url) {
        throw new Error('创建轮播图缺少标题或图片')
      }
      await createBanner({
        ...payload,
        title: payload.title,
        image_url: payload.image_url
      })
      globalNotifications.success('创建成功')
    } else {
      if (form.value.id === undefined || form.value.id === null) {
        globalNotifications.error('轮播图信息已失效，请重新打开')
        return
      }
      await updateBanner(form.value.id, payload)
      globalNotifications.success('更新成功')
    }

    showDialog.value = false
    await loadBanners()
    // 保存成功后清空临时图片记录
    uploadedTempImages.value = []
  } catch (error: unknown) {
    logger.error('保存失败:', error)
    if (error instanceof Error && error.message) {
      globalNotifications.error(error.message)
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

  confirmAction(
    `确定要删除轮播图"${banner.title}"吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      if (banner.id === undefined || banner.id === null) {
        globalNotifications.error('轮播图信息已失效，请刷新后重试')
        return
      }
      await deleteBanner(banner.id)
      globalNotifications.success('删除成功')
      await loadBanners()
    } catch (error: unknown) {
      logger.error('删除失败:', error)
      globalNotifications.error(error instanceof Error ? error.message : '删除失败')
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

  if (banner.id === undefined || banner.id === null) {
    banner.status = banner.status === 'active' ? 'inactive' : 'active'
    globalNotifications.error('轮播图信息已失效，请刷新后重试')
    return
  }

  try {
    await updateBanner(banner.id, banner)
    globalNotifications.success('状态更新成功')
  } catch (error: unknown) {
    // 恢复原状态
    banner.status = banner.status === 'active' ? 'inactive' : 'active'
    globalNotifications.error(error instanceof Error ? error.message : '更新失败')
  }
}

// 拖拽排序
const handleDragEnd = async () => {
  if (!ensureBannerPermission('edit')) {
    await loadBanners()
    return
  }

  try {
    const orders = banners.value
      .map((banner, index) => ({ id: banner.id, sort_order: index }))
      .filter((order): order is { id: number, sort_order: number } => typeof order.id === 'number')

    if (orders.length !== banners.value.length) {
      globalNotifications.error('存在无效轮播图，请刷新后重试')
      await loadBanners()
      return
    }

    await reorderBanners(orders)
    globalNotifications.success('排序更新成功')
  } catch (error: unknown) {
    logger.error('排序失败:', error)
    globalNotifications.error(error instanceof Error ? error.message : '排序失败')
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

const initializePageData = async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  if (hasInitializedPageData.value) {
    return
  }

  hasInitializedPageData.value = true
  await loadBanners()
}

const registerPageHeaderActions = () => {
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
}

watch(canView, (allowed) => {
  if (allowed) {
    void initializePageData()
  }
})

watch(canCreate, () => {
  registerPageHeaderActions()
})

onMounted(() => {
  void fieldPermissions.init()
  void initializePageData()
  registerPageHeaderActions()
})

// KeepAlive 切换回来时重新注册当前页面的头部操作
onActivated(() => {
  registerPageHeaderActions()
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

<style scoped lang="scss" src="./styles/banners/desktop.scss"></style>
<style scoped lang="scss" src="./styles/banners/responsive.scss"></style>
