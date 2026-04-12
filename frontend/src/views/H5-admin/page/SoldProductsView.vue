<template>
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
          <i class="fas fa-search"></i>
        </template>
      </el-input>
      <el-button @click="loadSoldProducts" type="primary" :loading="loading" class="btn-sm">
        <i class="fas fa-sync-alt mr-1"></i>刷新
      </el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>加载中...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="filteredProducts.length === 0" class="empty-state">
      <i class="fas fa-inbox"></i>
      <p>暂无已售商品</p>
    </div>

    <!-- 商品列表 -->
    <div v-else class="products-list">
      <div
        v-for="product in paginatedProducts"
        :key="product.id"
        class="product-card"
      >
        <!-- 商品信息 -->
        <div class="product-info">
          <div class="product-main">
            <h3>{{ product.brand }} {{ product.model }}</h3>
            <div class="product-details">
              <span class="detail-item">
                <i class="fas fa-palette"></i>
                {{ product.color }}
              </span>
              <span class="detail-item">
                <i class="fas fa-memory"></i>
                {{ product.memory }}
              </span>
            </div>
            <div class="product-meta">
              <span class="meta-item">
                <i class="fas fa-barcode"></i>
                IMEI: {{ product.imei }}
              </span>
              <span class="meta-item">
                <i class="fas fa-calendar"></i>
                售出: {{ formatDate(product.sale_date) }}
              </span>
            </div>
          </div>

          <!-- 图片数量 -->
          <div class="image-count">
            <i class="fas fa-images"></i>
            <span>{{ product.image_count }} 张</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="product-actions">
          <el-button
            plain
            type="primary"
            size="small"
            @click="viewImages(product)"
            class="btn-sm"
          >
            <i class="fas fa-eye mr-1"></i>查看图片
          </el-button>
          <el-button
            plain
            type="danger"
            size="small"
            @click="deleteProductImages(product)"
            class="btn-sm"
          >
            <i class="fas fa-trash mr-1"></i>删除图片
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="filteredProducts.length > pageSize" class="pagination">
      <el-button
        @click="currentPage--"
        :disabled="currentPage === 1"
        size="small"
      >
        上一页
      </el-button>
      <span class="page-info">
        第 {{ currentPage }} / {{ totalPages }} 页
      </span>
      <el-button
        @click="currentPage++"
        :disabled="currentPage === totalPages"
        size="small"
      >
        下一页
      </el-button>
    </div>

    <!-- 图片管理模态框 -->
    <el-dialog
      v-model="showImageModal"
      title="图片管理"
      width="90%"
      :close-on-click-modal="true"
      class="image-manage-dialog"
    >
      <div class="image-preview-modal">
        <div class="modal-header">
          <h3>{{ selectedProduct?.brand }} {{ selectedProduct?.model }}</h3>
          <p>{{ selectedProduct?.color }} | {{ selectedProduct?.memory }} | IMEI: {{ selectedProduct?.imei }}</p>
        </div>

        <div v-if="loadingImages" class="loading-images">
          <i class="fas fa-spinner fa-spin"></i>
          <p>加载图片中...</p>
        </div>

        <div v-else-if="productImages.length === 0" class="no-images">
          <i class="fas fa-image"></i>
          <p>暂无图片</p>
        </div>

        <div v-else class="images-grid">
          <div
            v-for="(image, index) in productImages"
            :key="image.id"
            class="image-item"
          >
            <Image
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
            <div v-if="image.is_primary" class="primary-badge">
              <i class="fas fa-star"></i>
              主图
            </div>
            <!-- 右上角删除按钮 -->
            <el-button
              plain
              type="danger"
              size="small"
              circle
              class="image-delete-btn btn-sm"
              @click.stop="deleteSingleImage(image)"
            >
              <i class="fas fa-trash"></i>
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="image-modal-footer">
          <el-button @click="showImageModal = false">关闭</el-button>
          <el-button
            plain
            type="danger"
            @click="deleteAllImages"
            :disabled="loadingImages"
            class="btn-sm"
          >
            <i class="fas fa-trash mr-1"></i>删除全部
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 大图预览 -->
    <teleport to="body">
      <div v-if="showImageViewer" class="image-viewer-mask" @click.self="showImageViewer = false">
        <div class="preview-wrapper" @click.self="showImageViewer = false">
          <el-image-viewer
            :url-list="[currentPreviewImage]"
            :hide-on-click-modal="true"
            @close="showImageViewer = false"
          />
          <!-- 右上角删除按钮 -->
          <button
            class="preview-delete-btn"
            @click.stop="deleteCurrentImage"
            title="删除此图片"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { ElMessage, ElMessageBox, ElImageViewer } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { formatImageUrl } from '@/utils/format'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'
import type { HeaderAction } from '@/types'
// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

interface SoldProduct {
  id: number
  imei: string
  brand: string
  model: string
  color: string
  memory: string
  sale_date: string
  image_count: number
}

interface ProductImage {
  id: number
  phone_id: number
  image_url: string
  image_type: string
  is_primary: boolean
  sort_order: number
}

const { loading } = useLoadingState()
const loadingImages = ref(false)
const products = ref<SoldProduct[]>([])
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const showImageModal = ref(false)
const selectedProduct = ref<SoldProduct | null>(null)
const productImages = ref<ProductImage[]>([])

const showImageViewer = ref(false)
const currentPreviewImage = ref('')
const currentPreviewImageId = ref<number | null>(null)

// 监听 ESC 键关闭预览
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showImageViewer.value) {
    showImageViewer.value = false
  }
}

// 监听预览状态变化来添加/移除键盘事件
watch(showImageViewer, (val) => {
  if (val) {
    document.addEventListener('keydown', handleKeyDown)
  } else {
    document.removeEventListener('keydown', handleKeyDown)
  }
})

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
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredProducts.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredProducts.value.length / pageSize.value)
})

// 加载已售商品列表
const loadSoldProducts = async () => {
  try {
    loading.value = true
    const response = await api.get('/shop/sold-products')
    // unifiedApi 已经在拦截器中返回 response.data
    products.value = Array.isArray(response) ? response : (response?.data || [])
  } catch (error) {
    logger.error('加载已售商品失败:', error)
    ElMessage.error('加载已售商品失败')
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1
}

// 查看图片
const viewImages = async (product: SoldProduct) => {
  selectedProduct.value = product
  showImageModal.value = true
  loadingImages.value = true

  try {
    const response = await api.get(`/shop/products/${product.id}/images`)
    productImages.value = response.data || []
  } catch (error) {
    logger.error('加载图片失败:', error)
    ElMessage.error('加载图片失败')
  } finally {
    loadingImages.value = false
  }
}

// 删除商品所有图片
const deleteProductImages = async (product: SoldProduct) => {
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
const deleteSingleImage = async (image: ProductImage) => {
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
const previewImage = (image: ProductImage) => {
  currentPreviewImage.value = getImageUrl(image.image_url)
  currentPreviewImageId.value = image.id
  showImageViewer.value = true
}

// 删除当前预览的图片
const deleteCurrentImage = async () => {
  if (!currentPreviewImageId.value) return

  const image = productImages.value.find(img => img.id === currentPreviewImageId.value)
  if (!image) return

  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '删除确认', {
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
const formatDate = (date: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadSoldProducts()
  // 注册头部操作按钮
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
})

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
  document.removeEventListener('keydown', handleKeyDown)
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
  color: #999;

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
  background: #fff;
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

  h3 {
    font-size: 18px;
    color: #333;
    margin-bottom: 8px;
  }

  .product-details {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;

    .detail-item {
      font-size: 14px;
      color: #666;

      i {
        margin-right: 4px;
        color: #ff6b00;
      }
    }
  }

  .product-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .meta-item {
      font-size: 12px;
      color: #999;

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
  background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%);
  color: #fff;
  border-radius: 8px;

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
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;

  .page-info {
    font-size: 14px;
    color: #666;
  }
}

.image-preview-modal {
  .modal-header {
    margin-bottom: 20px;
    text-align: center;

    h3 {
      font-size: 18px;
      color: #333;
      margin-bottom: 4px;
    }

    p {
      font-size: 14px;
      color: #999;
    }
  }

  .loading-images,
  .no-images {
    text-align: center;
    padding: 40px;
    color: #999;

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
    background: #f5f5f5;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .primary-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: #ff6b00;
      color: #fff;
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
      background: rgba(245, 108, 108, 0.9) !important;
      border: none !important;
      opacity: 0;
      transition: opacity 0.3s;

      i {
        font-size: 12px;
      }

      &:hover {
        background: rgba(245, 108, 108, 1) !important;
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
    flex-direction: column;
    gap: 12px;
  }

  .image-count {
    align-self: flex-start;
  }

  .product-actions {
    flex-direction: column;

    .el-button {
      width: 100%;
    }
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
}

// 图片预览容器
.preview-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  // 确保 el-image-viewer 内部按钮可见
  :deep(.el-image-viewer__btn) {
    opacity: 1 !important;
  }

  :deep(.el-image-viewer__canvas) {
    align-items: center;
    justify-content: center;
  }

  // 限制预览图片的默认大小
  :deep(img.el-image-viewer__img) {
    max-width: 80vw !important;
    max-height: 80vh !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }

  :deep(.el-image-viewer__canvas) > div {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :deep(.el-image-viewer__canvas) img {
    max-width: 80vw !important;
    max-height: 80vh !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
}

// 右上角删除按钮
.preview-delete-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10010;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(245, 108, 108, 0.9);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: background 0.2s;

  i {
    font-size: 18px;
  }

  &:hover {
    background: rgba(245, 108, 108, 1);
  }
}
</style>

<!-- 全局样式 -->
<style lang="scss">
/* 图片预览遮罩层 - z-index 需要高于 el-dialog (默认2000) */
.image-viewer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);

  :deep(.el-image-viewer__wrapper) {
    z-index: 10000;
  }

  /* 限制预览图片的默认大小 */
  :deep(img.el-image-viewer__img) {
    max-width: 80vw !important;
    max-height: 80vh !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }

  :deep(.el-image-viewer__canvas) > div {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  :deep(.el-image-viewer__canvas) img {
    max-width: 80vw !important;
    max-height: 80vh !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
}

/* 全局样式：限制 el-image-viewer 图片默认大小 */
:global(.el-image-viewer__img) {
  max-width: 80vw !important;
  max-height: 80vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

:global(.el-image-viewer__canvas img) {
  max-width: 80vw !important;
  max-height: 80vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

/* 强制覆盖内联样式 - 只限制最大尺寸，不干扰 transform */
:global(.el-image-viewer__wrapper .el-image-viewer__img[style]) {
  max-width: 80vw !important;
  max-height: 80vh !important;
}
</style>
