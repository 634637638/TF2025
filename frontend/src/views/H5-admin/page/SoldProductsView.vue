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
        v-if="loading"
        mode="block"
        text="加载中..."
      />

      <!-- 空状态 -->
      <DataEmptyState
        v-else-if="filteredProducts.length === 0"
        description="暂无已售商品"
      />

      <!-- 商品列表 -->
      <div
        v-else
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
              <i class="fas fa-eye mr-1" />查看素材
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
      <el-dialog
        v-model="showImageModal"
        title="素材管理"
        width="90%"
        :close-on-click-modal="true"
        class="image-manage-dialog"
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

          <div
            v-if="loadingImages"
            class="loading-images"
          >
            <InlineLoading text="加载素材中..." />
          </div>

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
              <div v-if="isVideoMedia(image)" class="media-type-badge">
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
          <div class="image-modal-footer">
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
      </el-dialog>

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
import { ref, reactive, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { formatImageUrl } from '@/utils/format'
import { useLoadingState } from '@/composables'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import { PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { logger } from '@/utils/logger'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'
import type { HeaderAction } from '@/types'
import type { SoldProduct, SoldProductImage } from '@/types/h5'
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
    p.imei?.toLowerCase().includes(keyword) ||
    p.brand?.toLowerCase().includes(keyword) ||
    p.model?.toLowerCase().includes(keyword)
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
    ElMessage.error('加载已售商品失败')
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
    const response = await api.get<SoldProductImage[]>(`/shop/products/${product.id}/images`)
    if (!Array.isArray(response.data)) {
      throw new Error('商品图片响应格式错误')
    }
    productImages.value = response.data
  } catch (error) {
    logger.error('加载图片失败:', error)
    ElMessage.error('加载图片失败')
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
    await ElMessageBox.confirm(
      `确定要删除 ${product.brand} ${product.model} 的所有图片吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/shop/products/${product.id}/images`)
    ElMessage.success('删除成功')
    await loadSoldProducts()
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      ElMessage.error('删除图片失败')
    }
  }
}

// 删除单张图片
const deleteSingleImage = async (image: SoldProductImage) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要删除这张图片吗？',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/shop/images/${image.id}`)
    ElMessage.success('删除成功')

    // 重新加载图片列表
    if (selectedProduct.value) {
      await viewImages(selectedProduct.value)
      await loadSoldProducts()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      ElMessage.error('删除图片失败')
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
    await ElMessageBox.confirm(`确定要删除这个${isVideoMedia(image) ? '视频' : '图片'}吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await api.delete(`/shop/images/${image.id}`)
    ElMessage.success('删除成功')

    // 关闭预览
    showImageViewer.value = false

    // 重新加载图片列表
    if (selectedProduct.value) {
      await viewImages(selectedProduct.value)
      await loadSoldProducts()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除图片失败')
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
    await ElMessageBox.confirm(
      `确定要删除 ${selectedProduct.value.brand} ${selectedProduct.value.model} 的所有图片吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.delete(`/shop/products/${selectedProduct.value.id}/images`)
    ElMessage.success('删除成功')

    // 关闭预览和模态框
    showImageViewer.value = false
    showImageModal.value = false

    // 重新加载数据
    await loadSoldProducts()
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      ElMessage.error('删除图片失败')
    }
  }
}

// 获取图片完整URL - 使用统一的图片URL处理函数
const getImageUrl = (url: string) => {
  return formatImageUrl(url)
}

// 格式化日期
const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
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

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
.sold-products-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  .el-input {
    flex: 1;
  }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);

  i {
    font-size: 48px;
    margin-bottom: 16px;
    display: block;
  }

  p {
    font-size: 16px;
  }
}

.products-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-card {
  background: var(--color-bg-white);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.product-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.product-main {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 18px;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .product-details {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;

    .detail-item {
      font-size: 14px;
      color: var(--text-secondary);

      i {
        margin-right: 4px;
        color: var(--tf-color-accent-orange);
      }
    }
  }

  .product-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .meta-item {
      font-size: 12px;
      color: var(--text-muted);

      i {
        margin-right: 4px;
      }
    }
  }
}

.image-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--tf-color-accent-orange) 0%, var(--tf-color-orange-dark) 100%);
  color: var(--color-bg-white);
  border-radius: 8px;
  flex-shrink: 0;

  i {
    font-size: 24px;
    margin-bottom: 4px;
  }

  span {
    font-size: 14px;
    font-weight: 500;
  }
}

.product-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: nowrap;

  .el-button {
    margin-left: 0;
    white-space: nowrap;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;

  .page-info {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.image-preview-modal {
  .modal-header {
    margin-bottom: 20px;
    text-align: center;

    h3 {
      font-size: 18px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      color: var(--text-muted);
    }
  }

  .loading-images,
  .no-images {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);

    i {
      font-size: 36px;
      margin-bottom: 12px;
      display: block;
    }
  }

  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: var(--tf-color-surface-soft);
    cursor: pointer;

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .media-type-badge {
      position: absolute;
      left: 8px;
      bottom: 8px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 7px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.78);
      color: var(--color-bg-white);
      font-size: 12px;
      pointer-events: none;
    }

    .primary-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--tf-color-accent-orange);
      color: var(--color-bg-white);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;

      i {
        margin-right: 4px;
      }
    }

    // 右上角删除按钮
    .image-delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      padding: 0 !important;
      background: var(--tf-button-danger-bg) !important;
      border: none !important;
      opacity: 0;
      transition: opacity 0.3s;

      i {
        font-size: 12px;
      }

      &:hover {
        background: var(--tf-button-danger-hover-bg) !important;
      }
    }

    &:hover .image-delete-btn {
      opacity: 1;
    }
  }
}

@media (max-width: 768px) {
  .sold-products-view {
    padding: 16px;
  }

  .product-card {
    padding: 12px;
  }

  .product-info {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px;
  }

  .product-main {
    min-width: 0;

    h3 {
      margin-bottom: 6px;
      font-size: 15px;
      line-height: 1.3;
      word-break: break-word;
    }

    .product-details {
      gap: 8px;
      margin-bottom: 6px;
      flex-wrap: wrap;

      .detail-item {
        font-size: 12px;
      }
    }

    .product-meta {
      gap: 3px;

      .meta-item {
        font-size: 11px;
        line-height: 1.35;
        word-break: break-all;
      }
    }
  }

  .image-count {
    align-self: flex-start;
    min-width: 52px;
    padding: 6px 8px;
    border-radius: 10px;

    i {
      margin-bottom: 2px;
      font-size: 16px;
    }

    span {
      font-size: 11px;
      line-height: 1.2;
      white-space: nowrap;
    }
  }

  .product-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;

    .el-button {
      width: 100%;
      min-width: 0;
      margin: 0;
      padding: 8px 6px;
      justify-content: center;
      font-size: 12px;
    }
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
}

</style>
