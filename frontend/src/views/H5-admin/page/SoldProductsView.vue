<template>
  <PermissionGate
    :can-view="canView"
    module-key="h5-sold-products"
    module-name="已售商品"
    permission-code="h5-sold-products:view"
  >
    <div class="sold-products-view">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索 IMEI、品牌、型号"
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
        <el-button
          type="primary"
          :loading="loading"
          class="btn-sm"
          @click="loadSoldProducts"
        >
          <i class="fas fa-sync-alt mr-1" />刷新
        </el-button>
      </div>

      <!-- 加载状态 -->
      <TableLoadingRow
        v-if="loading && products.length === 0"
        mode="block"
        text="正在读取已售商品..."
      />

      <!-- 空状态 -->
      <DataEmptyState
        v-else-if="filteredProducts.length === 0"
        description="暂无已售商品"
      />

      <!-- 商品列表 -->
      <div
        v-else
        v-tf-loading="{ active: loading, text: '正在刷新已售商品...' }"
        class="products-list"
      >
        <div
          v-for="product in paginatedProducts"
          :key="product.id"
          class="product-card"
        >
          <!-- 商品信息 -->
          <div class="product-info">
            <div class="product-main">
              <h3 v-if="canViewField('product.brand_model')">
                {{ product.brand }} {{ product.model }}
              </h3>
              <div
                v-if="canViewField('product.color') || canViewField('product.memory')"
                class="product-details"
              >
                <span
                  v-if="canViewField('product.color')"
                  class="detail-item"
                >
                  <i class="fas fa-palette" />
                  {{ product.color }}
                </span>
                <span
                  v-if="canViewField('product.memory')"
                  class="detail-item"
                >
                  <i class="fas fa-memory" />
                  {{ product.memory }}
                </span>
              </div>
              <div
                v-if="canViewField('product.imei') || canViewField('product.sale_time')"
                class="product-meta"
              >
                <span
                  v-if="canViewField('product.imei')"
                  class="meta-item"
                >
                  <i class="fas fa-barcode" />
                  IMEI: {{ product.imei }}
                </span>
                <span
                  v-if="canViewField('product.sale_time')"
                  class="meta-item"
                >
                  <i class="fas fa-calendar" />
                  售出: {{ formatDate(product.sale_time) }}
                </span>
              </div>
            </div>

            <!-- 图片数量 -->
            <div
              v-if="canViewField('product.image_count')"
              class="image-count"
            >
              <i class="fas fa-images" />
              <span>{{ product.image_count }} 个</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div
            v-if="showActionColumn"
            class="product-actions"
          >
            <el-button
              v-if="canViewField('images.image_url') || canDelete"
              plain
              type="primary"
              size="small"
              class="btn-sm"
              @click="viewImages(product)"
            >
              <i class="fas fa-eye mr-1" />查看图片
            </el-button>
            <el-button
              v-if="canDelete"
              plain
              type="danger"
              size="small"
              class="btn-sm"
              @click="deleteProductImages(product)"
            >
              <i class="fas fa-trash mr-1" />删除素材
            </el-button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div
        v-if="filteredProducts.length > pagination.page_size"
        class="pagination"
      >
        <el-button
          :disabled="pagination.page === 1"
          size="small"
          @click="pagination.page--"
        >
          上一页
        </el-button>
        <span class="page-info">
          第 {{ pagination.page }} / {{ total_pages }} 页
        </span>
        <el-button
          :disabled="pagination.page === total_pages"
          size="small"
          @click="pagination.page++"
        >
          下一页
        </el-button>
      </div>

      <!-- 媒体管理模态框 -->
      <MobileDialog
        v-model="showImageModal"
        :show-default-footer="false"
        title="图片管理"
        width="90%"
        :close-on-click-modal="true"
        dialog-class="image-manage-dialog"
        @closed="showImageViewer = false"
      >
        <div class="image-preview-modal">
          <div class="modal-header">
            <h3 v-if="canViewField('product.brand_model')">
              {{ selectedProduct?.brand }} {{ selectedProduct?.model }}
            </h3>
            <p>
              <template v-if="canViewField('product.color')">
                {{ selectedProduct?.color }}
              </template>
              <template v-if="canViewField('product.color') && canViewField('product.memory')">
                |
              </template>
              <template v-if="canViewField('product.memory')">
                {{ selectedProduct?.memory }}
              </template>
              <template v-if="(canViewField('product.color') || canViewField('product.memory')) && canViewField('product.imei')">
                |
              </template>
              <template v-if="canViewField('product.imei')">
                IMEI: {{ selectedProduct?.imei }}
              </template>
            </p>
          </div>

          <SectionLoading
            v-if="loadingImages"
            text="加载素材中..."
            size="compact"
          />

          <div
            v-else-if="productImages.length === 0"
            class="no-images"
          >
            <i class="fas fa-photo-video" />
            <p>暂无图片或视频</p>
          </div>

          <div
            v-else
            class="images-grid"
          >
            <div
              v-for="(image, index) in productImages"
              :key="image.id"
              class="image-item"
            >
              <video
                v-if="(canViewField('images.image_url') || canDelete) && isVideoMedia(image)"
                :src="getImageUrl(image.image_url)"
                class="media-thumbnail"
                muted
                playsinline
                preload="metadata"
                @click="previewImage(image)"
              />
              <Image
                v-else-if="canViewField('images.image_url') || canDelete"
                :src="image.image_url"
                :alt="`图片 ${index + 1}`"
                mode="eager"
                :product-info="{
                  brand: selectedProduct?.brand || '',
                  model: selectedProduct?.model || '',
                  color: selectedProduct?.color || '',
                  memory: selectedProduct?.memory || ''
                }"
                @click="previewImage(image)"
              />
              <div
                v-if="isVideoMedia(image)"
                class="media-type-badge"
              >
                <i class="fas fa-play" />
                视频
              </div>
              <div
                v-if="image.is_primary && canViewField('images.is_primary')"
                class="primary-badge"
              >
                <i class="fas fa-star" />
                主图
              </div>
              <!-- 右上角删除按钮 -->
              <el-button
                v-if="canDelete"
                plain
                type="danger"
                size="small"
                circle
                class="image-delete-btn btn-sm"
                @click.stop="deleteSingleImage(image)"
              >
                <i class="fas fa-trash" />
              </el-button>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="tf-dialog-actions image-modal-footer">
            <el-button @click="showImageModal = false">
              关闭
            </el-button>
            <el-button
              v-if="canDelete"
              plain
              type="danger"
              :disabled="loadingImages"
              class="btn-sm"
              @click="deleteAllImages"
            >
              <i class="fas fa-trash mr-1" />删除全部
            </el-button>
          </div>
        </template>
      </MobileDialog>

      <MediaPreviewViewer
        v-model="showImageViewer"
        :items="previewMediaItems"
        :initial-index="previewMediaIndex"
        :deletable="canDelete"
        @delete="deleteCurrentMedia"
      />
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, reactive, computed, onMounted, onUnmounted, onActivated, inject, watch } from 'vue'

import { Refresh } from '@element-plus/icons-vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { formatDate, formatImageUrl } from '@/utils/format'
import { useLoadingState } from '@/composables'
import SectionLoading from '@/components/SectionLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import { PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { logger } from '@/utils/logger'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'
import type { HeaderAction } from '@/types'
import type { SoldProduct, SoldProductImage } from '@/types/h5'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(_actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')
const soldProductsPermissions = usePagePermissions('h5-sold-products')
const { handleNoPermission } = soldProductsPermissions
const canView = computed(() => soldProductsPermissions.canView.value)
const canDelete = computed(() => soldProductsPermissions.canDelete.value)
const SOLD_PRODUCTS_MODULE_KEY = 'h5_admin_soldproductsview'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(SOLD_PRODUCTS_MODULE_KEY, fieldKey)
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canDelete.value]
))

const { loading } = useLoadingState(true)
const hasInitializedPageData = ref(false)
const loadingImages = ref(false)
const products = ref<SoldProduct[]>([])
const searchKeyword = ref('')
const pagination = reactive({
  page: 1,
  page_size: 10
})

const showImageModal = ref(false)
const selectedProduct = ref<SoldProduct | null>(null)
const productImages = ref<SoldProductImage[]>([])

const showImageViewer = ref(false)
const previewMediaIndex = ref(0)
const previewMediaItems = computed<MediaPreviewItem[]>(() => productImages.value.map(media => ({
  id: media.id,
  url: media.image_url,
  type: media.image_type,
  label: isVideoMedia(media) ? '商品视频' : '商品图片'
})))

// 过滤后的商品列表
const filteredProducts = computed(() => {
  if (!searchKeyword.value) return products.value

  const keyword = searchKeyword.value.toLowerCase()
  return products.value.filter(p =>
    String(p.imei || '').toLowerCase().includes(keyword) ||
    String(p.brand || '').toLowerCase().includes(keyword) ||
    String(p.model || '').toLowerCase().includes(keyword)
  )
})

// 分页后的商品列表
const paginatedProducts = computed(() => {
  const start = (pagination.page - 1) * pagination.page_size
  const end = start + pagination.page_size
  return filteredProducts.value.slice(start, end)
})

// 总页数
const total_pages = computed(() => {
  return Math.max(1, Math.ceil(filteredProducts.value.length / pagination.page_size))
})

// 加载已售商品列表
const loadSoldProducts = async () => {
  if (!canView.value) {
    products.value = []
    loading.value = false
    return
  }

  try {
    loading.value = true
    const response = await api.get<SoldProduct[]>('/shop/sold-products')
    if (!Array.isArray(response.data)) {
      throw new Error('已售商品响应格式错误')
    }
    products.value = response.data
  } catch (error) {
    logger.error('加载已售商品失败:', error)
    globalNotifications.error('加载已售商品失败')
  } finally {
    loading.value = false
  }
}

const ensureDeletePermission = () => {
  if (canDelete.value) {
    return true
  }

  handleNoPermission('delete')
  return false
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
}

// 查看图片
const viewImages = async (product: SoldProduct) => {
  if (!canView.value) {
    handleNoPermission('view')
    return
  }

  selectedProduct.value = product
  showImageModal.value = true
  loadingImages.value = true

  try {
    const response = await api.get<SoldProductImage[]>(`/phones/${product.id}/images`)
    if (!Array.isArray(response.data)) {
      throw new Error('商品图片响应格式错误')
    }
    productImages.value = response.data
  } catch (error) {
    logger.error('加载图片失败:', error)
    globalNotifications.error('加载图片失败')
  } finally {
    loadingImages.value = false
  }
}

// 删除商品所有图片
const deleteProductImages = async (product: SoldProduct) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await confirmAction(
      `确定要删除 ${product.brand} ${product.model} 的所有图片吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/shop/products/${product.id}/images`)
    globalNotifications.success('删除成功')
    await loadSoldProducts()
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      globalNotifications.error('删除图片失败')
    }
  }
}

// 删除单张图片
const deleteSingleImage = async (image: SoldProductImage) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await confirmAction(
      '确定要删除这张图片吗？',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/phones/${image.phone_id}/images/${image.id}`)
    globalNotifications.success('删除成功')

    // 重新加载图片列表
    if (selectedProduct.value) {
      await viewImages(selectedProduct.value)
      await loadSoldProducts()
    }
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      globalNotifications.error('删除图片失败')
    }
  }
}

// 预览大图
const previewImage = (image: SoldProductImage) => {
  const index = productImages.value.findIndex(media => media.id === image.id)
  previewMediaIndex.value = index >= 0 ? index : 0
  showImageViewer.value = true
}

// 删除当前预览的媒体
const deleteCurrentMedia = async (mediaItem: MediaPreviewItem) => {
  if (!ensureDeletePermission()) {
    return
  }

  const image = productImages.value.find(img => img.id === Number(mediaItem.id))
  if (!image) return

  try {
    await confirmAction(`确定要删除这个${isVideoMedia(image) ? '视频' : '图片'}吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await api.delete(`/phones/${image.phone_id}/images/${image.id}`)
    globalNotifications.success('删除成功')

    // 关闭预览
    showImageViewer.value = false

    // 重新加载图片列表
    if (selectedProduct.value) {
      await viewImages(selectedProduct.value)
      await loadSoldProducts()
    }
  } catch (error: unknown) {
    if (error !== 'cancel') {
      globalNotifications.error('删除图片失败')
    }
  }
}

// 删除全部图片
const deleteAllImages = async () => {
  if (!ensureDeletePermission()) {
    return
  }

  if (!selectedProduct.value) return

  try {
    await confirmAction(
      `确定要删除 ${selectedProduct.value.brand} ${selectedProduct.value.model} 的所有图片吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/shop/products/${selectedProduct.value.id}/images`)
    globalNotifications.success('删除成功')

    // 关闭预览和模态框
    showImageViewer.value = false
    showImageModal.value = false

    // 重新加载数据
    await loadSoldProducts()
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      globalNotifications.error('删除图片失败')
    }
  }
}

// 获取图片完整URL - 使用统一的图片URL处理函数
const getImageUrl = (url: string) => {
  return formatImageUrl(url)
}

const initializePageData = async () => {
  if (!canView.value) {
    products.value = []
    loading.value = false
    return
  }

  if (hasInitializedPageData.value) {
    return
  }

  hasInitializedPageData.value = true
  await loadSoldProducts()
}

const registerPageHeaderActions = () => {
  if (registerHeaderActions) {
    registerHeaderActions([
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: () => loadSoldProducts()
      }
    ])
  }
}

watch(canView, (allowed) => {
  if (allowed) {
    void initializePageData()
  }
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

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss" src="./styles/sold-products-view/desktop.scss"></style>
<style scoped lang="scss" src="./styles/sold-products-view/responsive.scss"></style>
