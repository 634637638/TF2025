<template>
  <div class="query-view admin-page safe-area-top safe-area-bottom">
    <!-- 无权限提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      :can-create="canCreate"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-export="canExport"
      module-key="query_queryview"
      module-name="综合查询"
      permission-code="query:view"
    />

    <!-- 有权限时显示内容 -->
    <div v-else class="view-content admin-page-content">
      <!-- 页面头部 - 使用公共组件 + 滚动动画 -->
      <div data-aos="fade-down" data-aos-duration="600">
        <PageHeader
          icon="fas fa-search"
          title="综合查询"
        >
          <template #actions>
            <el-button
              @click="openQuickSaleModal"
              type="warning"
              title="快速出库"
              v-if="canCreate"
            >
              <i class="fas fa-bolt"></i>
              <span class="btn-text-desktop">快速出库</span>
              <span class="btn-text-mobile">出库</span>
            </el-button>
            <ImportExportActions
              :can-export="canExport"
              :export-loading="exporting"
              :export-disabled="loading || exporting"
              :export-plain="true"
              export-label="导出Excel"
              export-title="导出 Excel"
              @export="exportToExcel"
            />
            <el-button
              @click="goToStockIn"
              type="primary"
              title="快捷入库"
            >
              <i class="fas fa-plus-circle"></i>
              <span class="btn-text-desktop">采购入库</span>
              <span class="btn-text-mobile">入库</span>
            </el-button>
            <el-button
              @click="goToSales"
              type="success"
              title="快捷销售"
            >
              <i class="fas fa-shopping-cart"></i>
              <span class="btn-text-desktop">销售出库</span>
              <span class="btn-text-mobile">库存</span>
            </el-button>
            <el-button
              @click="handleRefresh"
              type="info"
              :disabled="refreshing"
            >
              <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
              <span>刷新</span>
            </el-button>
          </template>
        </PageHeader>
      </div>

      <div class="content admin-page-content">
        <!-- 统计卡片 + 滚动动画 -->
      <div v-show="showStatsCards" class="stats-cards">
        <div
          v-for="(stat, index) in visibleStatsConfig"
          :key="index"
          :data-aos="'fade-up'"
          :data-aos-delay="index * 100"
          class="stat-card"
          :class="{ 'hide-on-mobile': stat.key === 'in_stock_count' }"
        >
          <div class="stat-icon" :class="stat.iconClass">
            <i :class="stat.icon"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ statistics[stat.key] || 0 }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <UnifiedSearchPanel
        data-aos="fade-up"
        data-aos-delay="400"
        v-model:expanded="searchExpanded"
        :loading="loading"
        @search="triggerLoadQueryData"
        @reset="resetFilters"
      >
        <template #primary>
          <el-input
            v-model="filters.search_term"
            placeholder="搜索关键词"
            clearable
            @input="debounceLoadQueryData"
            @keyup.enter="triggerLoadQueryData"
            @click.stop
          >
            <template #prefix>
              <i class="fas fa-search"></i>
            </template>
          </el-input>
        </template>

        <!-- 供应商 -->
        <div class="form-group filter-item" data-field="supplier">
            <el-select
              v-model="filters.supplier_id"
              placeholder="供应商"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="supplier in options.suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
        </div>

        <!-- 店铺 -->
        <div class="form-group filter-item" data-field="store">
            <el-select
              v-model="filters.store_id"
              placeholder="店铺"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="store in options.stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
        </div>

        <!-- 品牌 -->
        <div class="form-group filter-item" data-field="brand">
            <el-select
              v-model="filters.brand"
              placeholder="品牌"
              @change="handleFilterBrandChange"
              filterable
              clearable
            >
              <el-option
                v-for="brand in options.brands"
                :key="brand"
                :label="brand"
                :value="brand"
              />
            </el-select>
        </div>

        <!-- 型号 -->
        <div class="form-group filter-item" data-field="model">
            <el-select
              v-model="filters.model"
              placeholder="型号"
              @change="triggerLoadQueryData"
              filterable
              clearable
              :disabled="!filters.brand && options.models.length === 0"
            >
              <el-option
                v-for="model in options.models"
                :key="model.id"
                :label="model.name"
                :value="model.name"
              />
            </el-select>
        </div>

        <!-- 颜色 -->
        <div class="form-group filter-item" data-field="color">
            <el-select
              v-model="filters.color"
              placeholder="颜色"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="color in options.colors"
                :key="color"
                :label="color"
                :value="color"
              />
            </el-select>
        </div>

        <!-- 内存 -->
        <div class="form-group filter-item" data-field="memory">
            <el-select
              v-model="filters.memory"
              placeholder="内存"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="memory in options.memories"
                :key="memory"
                :label="memory"
                :value="memory"
              />
            </el-select>
        </div>

        <!-- 状态 -->
        <div class="form-group filter-item" data-field="status">
            <el-select
              v-model="filters.status"
              placeholder="状态"
              @change="triggerLoadQueryData"
              clearable
            >
              <el-option
                v-for="status in options.statuses"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
        </div>

        <!-- 机况 -->
        <div class="form-group filter-item" data-field="condition">
            <el-select
              v-model="filters.is_new"
              placeholder="机况"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="condition in options.conditions"
                :key="condition.value"
                :label="condition.label"
                :value="condition.value"
              />
            </el-select>
        </div>

        <!-- 销售员 -->
        <div class="form-group filter-item" data-field="operator">
            <el-select
              v-model="filters.sale_operator_id"
              placeholder="销售员"
              @change="triggerLoadQueryData"
              filterable
              clearable
            >
              <el-option
                v-for="user in options.users"
                :key="user.id"
                :label="user.name"
                :value="user.id"
              />
            </el-select>
        </div>

        <!-- 开始日期 -->
        <div class="form-group filter-item" data-field="start_date">
            <el-date-picker
              v-model="filters.start_date"
              type="date"
              placeholder="开始日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="triggerLoadQueryData"
              clearable
              style="width: 140px"
            />
        </div>

        <!-- 结束日期 -->
        <div class="form-group filter-item" data-field="end_date">
            <el-date-picker
              v-model="filters.end_date"
              type="date"
              placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="triggerLoadQueryData"
              clearable
              style="width: 140px"
            />
        </div>
      </UnifiedSearchPanel>

      <!-- 数据表格区域 -->
    <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          综合销售列表
          <span class="record-count">共 {{ pagination.total }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="devices-table">
            <thead>
              <tr>
                <!-- 动态生成表头 -->
                <th
                  v-for="column in tableColumns"
                  :key="column.key"
                >
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td :colspan="tableColumns.length" class="loading-cell">
                  <GlobalLoading size="medium" />
                  <span>加载中...</span>
                </td>
              </tr>
              <tr v-else-if="queryData.length === 0">
                <td :colspan="tableColumns.length" class="empty-cell">
                  <i class="fas fa-inbox"></i>
                  <span>暂无数据</span>
                </td>
              </tr>
              <tr
                v-for="(item, index) in queryData"
                :key="index"
                v-else
                @touchstart="handleRowTouch(item, $event)"
                :data-index="index"
                class="data-row"
              >
                <!-- 动态生成数据单元格，与表头保持一致 -->
                <template v-for="column in tableColumns" :key="column.key">
                  <!-- 序列号列 - 与IMEI样式一致 -->
                  <td v-if="column.key === 'basic_info.serial_number'" class="serial-imei-cell">
                    {{ getCellValue(item, column) }}
                  </td>

                  <!-- IMEI 列 - 与序列号样式一致 -->
                  <td v-else-if="column.key === 'basic_info.imei'" class="serial-imei-cell">
                    {{ getCellValue(item, column) }}
                  </td>

                  <!-- 全新/二手 列 - 双击管理图片（二手机） -->
                  <td v-else-if="column.key === 'basic_info.is_new'" @dblclick.stop="handleConditionDoubleClick(item)" :class="{ 'clickable-cell': Number(item.基本信息?.is_new) === 0 }">
                    <span :class="['condition-badge', Number(item.基本信息?.is_new) === 1 ? 'new' : 'used']">
                      {{ getCellValue(item, column) }}
                    </span>
                    <i v-if="Number(item.基本信息?.is_new) === 0 && item.基本信息?.has_images" class="fas fa-images image-hint"></i>
                  </td>

                  <!-- 状态列 - 双击打开销售单（PC端） -->
                  <td v-else-if="column.key === 'basic_info.status'" @dblclick.stop="handleCellDoubleClick(item, column)" class="status-cell clickable-cell">
                    <span :class="['status-badge', getStatusBadgeClass(item.基本信息?.status_code)]">
                      {{ getCellValue(item, column) }}
                    </span>
                  </td>

                  <!-- 操作列 - 特殊渲染 -->
                  <td v-else-if="column.key === 'system_info.operations'" class="actions-cell">
                    <div class="action-buttons">
                      <el-button
                        v-if="canEdit"
                        @click="openEditModal(item)"
                        type="primary"
                        size="small"
                        title="编辑"
                      >
                        <i class="fas fa-edit"></i>
                        编辑
                      </el-button>
                      <el-button
                        v-if="canDelete"
                        @click="deleteItem(item)"
                        type="danger"
                        size="small"
                        title="删除"
                      >
                        <i class="fas fa-trash"></i>
                        删除
                      </el-button>
                      <el-button
                        v-if="canReturnToStock"
                        @click="confirmReturnToStock(item)"
                        type="warning"
                        size="small"
                        title="退库"
                      >
                        <i class="fas fa-undo-alt"></i>
                        退库
                      </el-button>
                    </div>
                  </td>

                  <!-- 价格列 - 不可点击 -->
                  <td v-else-if="column.key === 'basic_info.purchase_price' || column.key === 'basic_info.sale_price'" class="price-cell">
                    {{ getCellValue(item, column) }}
                  </td>

                  <!-- 普通列 - 不可点击 -->
                  <td v-else>
                    {{ getCellValue(item, column) }}
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页组件 -->
        <Pagination
          v-if="pagination.total > 0"
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[20, 50, 100, 200]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="loading"
          @change="handlePaginationChange"
        />
      </div>
    </div>

    <!-- 权限不足提示 -->
    <div v-if="!canView" class="permission-denied-container">
      <div class="permission-denied-content">
        <div class="permission-icon">
          <i class="fas fa-lock"></i>
        </div>
        <h3 class="permission-title">访问受限</h3>
        <p class="permission-message">抱歉，您没有权限访问综合查询页面</p>
        <div class="permission-suggestions">
          <h4>可能的解决方案：</h4>
          <ul>
            <li>联系管理员分配相应的查询权限</li>
            <li>确认您的账户具有适当的角色</li>
            <li>如需帮助，请联系技术支持</li>
          </ul>
        </div>
        <el-button @click="router.back()" type="default">
          <i class="fas fa-arrow-left"></i>
          返回上一页
        </el-button>
      </div>
    </div>
    </div>

    <!-- 快速出库模态框 -->
    <QuickSaleModal
      v-model="showQuickSaleModal"
      :options="editModalOptions"
      @success="handleQuickSaleSuccess"
    />

    <ReturnStockModal
      v-model="showReturnModal"
      :device-info="selectedReturnDevice"
      @success="handleReturnStockSuccess"
    />

    <QueryEditModal
      v-model="showEditModal"
      :phone-id="selectedEditPhoneId"
      @success="handleEditSuccess"
    />
    </div>

    <QueryDetailDialog
      v-model="showDetailModal"
      :detail-item="detailItem"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-return-to-stock="canReturnToStock"
      @edit="openEditModal(detailItem); closeDetailModal()"
      @delete="deleteItem(detailItem); closeDetailModal()"
      @return="confirmReturnToStock(detailItem); closeDetailModal()"
    />

    <!-- 销售单组件 -->
    <SalesReceipt
      :visible="showReceipt"
      :items="receiptItems"
      :status="receiptStatus"
      :customer-name="receiptCustomerName"
      :customer-phone="receiptCustomerPhone"
      :supplier-name="receiptSupplierName"
      :store-name="receiptStoreName"
      :sales-operator="receiptSalesOperator"
      :receipt-number="receiptNumber"
      :sale-date="receiptSaleDate"
      :purchase-date="receiptPurchaseDate"
      @close="showReceipt = false"
      @add-item="handleAddItemToReceipt"
    />

    <!-- 图片管理模态框 -->
    <el-dialog
      v-model="showImageModal"
      title="图片管理"
      width="90%"
      :close-on-click-modal="true"
      :z-index="2000"
      class="image-manage-dialog"
    >
      <div class="image-preview-modal">
        <div class="modal-header">
          <h3>{{ selectedPhoneInfo?.brand }} {{ selectedPhoneInfo?.model }}</h3>
          <p>{{ selectedPhoneInfo?.color }} | {{ selectedPhoneInfo?.memory }} | IMEI: {{ selectedPhoneInfo?.imei }}</p>
        </div>

        <div v-if="loadingImages" class="loading-images">
          <i class="fas fa-spinner fa-spin"></i>
          <p>加载图片中...</p>
        </div>

        <div v-else-if="productImages.length === 0" class="no-images">
          <i class="fas fa-image"></i>
          <p>暂无图片，点击下方"上传图片"按钮添加</p>
        </div>

        <div v-else>
          <draggable
            v-model="productImages"
            :animation="200"
            handle=".drag-handle"
            item-key="id"
            @end="handleImageDragEnd"
            class="images-grid"
          >
            <template #item="{ element: image, index }">
              <div class="image-item" @click="previewImage(image)">
                <Image
                  :src="image.image_url"
                  :alt="`图片 ${index + 1}`"
                  mode="eager"
                  :product-info="{
                    brand: selectedPhoneInfo?.brand || '',
                    model: selectedPhoneInfo?.model || '',
                    color: selectedPhoneInfo?.color || '',
                    memory: selectedPhoneInfo?.memory || ''
                  }"
                />
                <!-- 拖拽手柄 -->
                <div class="drag-handle">
                  <i class="fas fa-grip-vertical"></i>
                </div>
                <!-- 主图标记 -->
                <div v-if="image.is_primary" class="primary-badge">
                  <i class="fas fa-star"></i>
                  主图
                </div>
                <!-- 右上角删除按钮 -->
                <el-button
                  type="danger"
                  size="small"
                  circle
                  class="image-delete-btn"
                  @click.stop="deleteSingleImage(image)"
                >
                  <i class="fas fa-trash"></i>
                </el-button>
                <!-- 设置主图按钮 -->
                <div v-if="!image.is_primary" class="set-primary-btn" @click="setPrimaryImage(image)">
                  <i class="fas fa-star"></i>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>

      <template #footer>
        <div class="image-modal-footer">
          <input
            ref="imageUploadInput"
            type="file"
            accept="image/*"
            multiple
            style="display: none"
            @change="handleUploadImage"
          />
          <el-button @click="handleCloseImageModal">关闭</el-button>
          <el-button
            v-if="productImages.length > 0"
            type="danger"
            plain
            @click="deleteAllImages"
            :disabled="loadingImages || uploadingImage"
          >
            <i class="fas fa-trash-alt"></i>
            删除全部
          </el-button>
          <el-button
            type="primary"
            @click="($refs.imageUploadInput as HTMLInputElement).click()"
            :loading="uploadingImage"
            :disabled="loadingImages"
          >
            <i class="fas fa-upload"></i>
            上传图片
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 大图预览 - 用 teleport 移到 body -->
    <teleport to="body">
      <div v-if="showImageViewer" class="image-viewer-mask" @click.self="closeImageViewer">
        <div @click.stop>
          <el-image-viewer
            :url-list="imageViewerUrls"
            :initial-index="imageViewerIndex"
            :hide-on-click-modal="true"
            @close="closeImageViewer"
          />
        </div>
      </div>
    </teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox, ElImageViewer } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { useMobileDetection } from '@/composables/mobile'
import { usePagination } from '@/composables/index'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { formatImageUrl } from '@/utils/format'
import { createTempFileTracker, type TempFileTracker } from '@/utils/temp-file-cleaner'
import draggable from 'vuedraggable'
import Pagination from '../../components/Pagination.vue'
import GlobalLoading from '../../components/GlobalLoading.vue'
import { PageHeader, PermissionDenied } from '@/components/base'
import Image from '@/components/Image.vue'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'
import QueryDetailDialog from '@/components/query/QueryDetailDialog.vue'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'
import SalesReceipt from '@/components/query/SalesReceipt.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { refreshScrollAnimations } from '@/utils/scrollAnimation'
import { PHONE_STATUS_OPTIONS, getPhoneStatusClass, getPhoneStatusLabel } from '@/constants/phoneStatuses'
import { normalizeAppleId, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'

// 定义消息提示函数
const message = ElMessage

// 字段权限相关
import { fieldPermissions } from '../../composables/useFieldPermissions'
// 时间处理工具
import { TimeUtil, TIME_FORMATS } from '../../utils/time'
import type { QueryItem, ReturnDeviceInfo, QueryStatistics as Statistics, QueryOptions as Options } from '@/types'

// 使用 stores 和 composables
const router = useRouter()
const authStore = useAuthStore()
const { success, handleApiError } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport, hasPermission: hasQueryPagePermission, handleNoPermission } = usePagePermissions('query')
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobileDetection()
const canReturnToStock = computed(() => hasQueryPagePermission('return-to-stock'))
const { exportFile, buildDateFilename, sanitizeParams } = useImportExport()

// 响应式数据
const { loading } = useLoadingState()
const exporting = ref(false)
const showEditModal = ref(false)
const selectedEditPhoneId = ref<number | null>(null)
const showQuickSaleModal = ref(false)
// 搜索相关状态
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）

// 多选相关状态
const selectedItems = ref<QueryItem[]>([])
const selectAll = ref(false)
const isIndeterminate = ref(false)

// 销售单相关状态
const showReceipt = ref(false)
const receiptItems = ref<any[]>([])
const receiptStatus = ref('sold')
const receiptCustomerName = ref('')
const receiptCustomerPhone = ref('')
const receiptSupplierName = ref('')
const receiptStoreName = ref('')
const receiptSalesOperator = ref('')
const receiptNumber = ref('')
const receiptSaleDate = ref('')
const receiptPurchaseDate = ref('')

// 图片预览相关状态
const showImageModal = ref(false)
const { loading: loadingImages } = useLoadingState()
const productImages = ref<any[]>([])
const selectedPhoneId = ref<number | null>(null)
const selectedPhoneInfo = ref<{ brand: string; model: string; color: string; memory: string; imei: string } | null>(null)
const showImageViewer = ref(false)
const imageViewerUrls = ref<string[]>([])
const imageViewerIndex = ref(0)
const { loading: uploadingImage } = useLoadingState()

// 临时文件跟踪器
let tempFileTracker: TempFileTracker | null = null

// 计算选中项的汇总
const selectedTotalAmount = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    const price = item.价格信息?.sale_price || 0
    return sum + (Number(price) || 0)
  }, 0)
})

const selectedTotalProfit = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    const purchasePrice = Number(item.价格信息?.purchase_price) || 0
    const salePrice = Number(item.价格信息?.sale_price) || 0
    return sum + (salePrice - purchasePrice)
  }, 0)
})

// 格式化选中统计价格
const formatSelectedPrice = (price: number) => {
  if (!price || isNaN(price)) return '0.00'
  return price.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// 退库功能相关状态
const showReturnModal = ref(false)
const selectedReturnDevice = ref<ReturnDeviceInfo | null>(null)

// 字段权限相关状态
const fieldPermissionsLoading = ref(false)

// 响应式表格相关状态
const windowWidth = ref(window.innerWidth)
const showDetailModal = ref(false)
const detailItem = ref<QueryItem | null>(null)

// 触摸事件相关状态（用于移动端双击检测）
const touchTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())
const lastTapTime = ref<Map<string, number>>(new Map())

// 监听窗口大小变化
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

// 移动端触摸事件处理（模拟双击）
const handleRowTouch = (item: QueryItem, event: TouchEvent) => {
  const rowKey = (event.currentTarget as HTMLElement).dataset.index || JSON.stringify(item)
  const now = Date.now()
  const lastTime = lastTapTime.value.get(rowKey) || 0
  const timeDiff = now - lastTime

  // 清除之前的定时器
  const existingTimer = touchTimers.value.get(rowKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
    touchTimers.value.delete(rowKey)
  }

  // 如果两次点击间隔小于 300ms，视为双击
  if (timeDiff < 300 && timeDiff > 0) {
    // 双击触发
    handleRowDoubleClick(item)
    lastTapTime.value.delete(rowKey)
  } else {
    // 单击：等待可能的双击
    const timer = setTimeout(() => {
      // 超时后视为单击，可以做单击处理（如果需要）
      lastTapTime.value.delete(rowKey)
      touchTimers.value.delete(rowKey)
    }, 300)
    touchTimers.value.set(rowKey, timer)
  }

  lastTapTime.value.set(rowKey, now)
}

// 添加窗口大小监听
watch(() => windowWidth.value, (newWidth) => {
  // 可以在这里添加额外的响应式逻辑
})

watch(showReturnModal, (visible) => {
  if (!visible) {
    selectedReturnDevice.value = null
  }
})

watch(showEditModal, (visible) => {
  if (!visible) {
    selectedEditPhoneId.value = null
  }
})

// 数据列表
const queryData = ref<QueryItem[]>([])

// 统计卡片配置
const statsConfig = [
  { key: 'total_phones', label: '总设备数', icon: 'fas fa-boxes', iconClass: '', fieldId: 'stats.total_phones' },
  { key: 'in_stock_count', label: '在库数量', icon: 'fas fa-warehouse', iconClass: 'in-stock', fieldId: 'stats.in_stock_count' },
  { key: 'sold_count', label: '已售数量', icon: 'fas fa-shopping-cart', iconClass: 'sold', fieldId: 'stats.sold_count' },
  { key: 'new_count', label: '全新设备', icon: 'fas fa-gem', iconClass: 'new', fieldId: 'stats.new_count' },
  { key: 'used_count', label: '二手设备', icon: 'fas fa-history', iconClass: 'used', fieldId: 'stats.used_count' }
]

const statistics = ref<Statistics>({
  total_phones: 0,
  in_stock_count: 0,
  sold_count: 0,
  new_count: 0,
  used_count: 0,
  total_purchase_cost: 0,
  total_sales_revenue: 0,
  total_profit: 0,
  avg_profit: 0,
  profit_margin: '0%'
})
const QUERY_CACHE_TTL = 5 * 60 * 1000

type QueryDataCacheEntry = {
  data: QueryItem[]
  total: number
  timestamp: number
}

type QueryStatsCacheEntry = {
  data: Statistics
  timestamp: number
}

const options = ref<Options>({
  suppliers: [],
  stores: [],
  brands: [],
  models: [],
  colors: [],
  memories: [],
  users: [],
  statuses: [],
  conditions: []
})

// 保存完整的型号列表，用于品牌筛选
const allModelsList = ref<Array<any>>([])
const queryDataCache = new Map<string, QueryDataCacheEntry>()
const queryStatsCache = new Map<string, QueryStatsCacheEntry>()
let latestQueryRequestId = 0

// 编辑模态框选项数据
const editModalOptions = reactive({
  suppliers: [] as any[],
  stores: [] as any[],
  brands: [] as string[],
  models: [] as string[],
  colors: [] as string[],
  memories: [] as string[],
  users: [] as any[]
})
const editModalOptionsLoaded = ref(false)
const editModalOptionsLoading = ref(false)
let editModalWarmupTimer: ReturnType<typeof setTimeout> | null = null
const employeesPromise = ref<Promise<any[]> | null>(null)

// 筛选条件
const filters = reactive({
  page: 1,
  limit: 100,
  supplier_id: '',
  store_id: '',
  brand: '',
  model: '',
  color: '',
  memory: '',
  is_new: '',
  sale_operator_id: '', // 销售员ID筛选
  status: '', // 默认显示所有状态数据
  start_date: '',
  end_date: '',
  search_term: ''
})

// 分页信息
const paginationData = usePagination({
  limit: 100
})

const pagination = computed(() => ({
  page: paginationData.page.value,
  limit: paginationData.limit.value,
  total: paginationData.total.value,
  totalPages: paginationData.totalPages.value
}))

// 解构出需要的属性和方法
const { setTotal, goToPage } = paginationData

// ==================== 数据排序辅助函数 ====================

// 品牌排序权重（苹果优先）
const getBrandOrderWeight = (brand: string): number => {
  if (!brand) return 999
  // 移除 emoji 和特殊字符，只保留字母和中文
  const brandClean = brand.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').toLowerCase().trim()

  // 苹果品牌优先（包含中文"苹果"或英文 Apple、iPhone、iPad、AirPods 等关键词）
  if (brandClean.includes('苹果') || brandClean.includes('apple') || brandClean.includes('iphone') || brandClean.includes('ipad') || brandClean.includes('airpods')) {
    return 0
  }

  // 其他品牌返回一个大数字，确保在苹果之后
  return 1000
}

// 从型号名称中提取系列号（如 iPhone 14 Pro -> 14）
const extractSeriesNumber = (model: string): number => {
  if (!model) return 0
  const match = model.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

// 内存排序权重（转换为统一的数字进行比较）
const getMemoryOrderWeight = (memory: string): number => {
  if (!memory) return 999
  const size = memory.toUpperCase().replace(/[^0-9A-Z]/g, '')

  if (size.includes('TB')) {
    const tb = parseInt(size) || 0
    return tb * 1000
  } else if (size.includes('GB') || size.includes('G')) {
    const gb = parseInt(size) || 0
    return gb
  }

  const num = parseInt(size) || 0
  return num
}

// 对查询数据进行排序（接收映射后的数据）
const sortQueryData = (data: any[]): any[] => {
  if (!data || data.length === 0) return []
  return [...data]
}

const isGroupedQueryItem = (item: any): item is QueryItem => {
  return Boolean(
    item &&
    typeof item === 'object' &&
    item.基本信息 &&
    item.价格信息 &&
    item.时间信息
  )
}

const normalizeCustomerInfo = (customerInfo?: Partial<QueryItem['客户信息']> | null): QueryItem['客户信息'] => ({
  customer_id: customerInfo?.customer_id ?? null,
  customer_name: normalizePersonName(customerInfo?.customer_name || '', 20),
  customer_phone: normalizePhoneDigits(customerInfo?.customer_phone || ''),
  apple_id: normalizeAppleId(customerInfo?.apple_id || '')
})

const normalizeQueryItem = (item: any): QueryItem => {
  if (isGroupedQueryItem(item)) {
    const purchasePrice = Number(item.价格信息?.purchase_price || 0)
    const salePrice = Number(item.价格信息?.sale_price || 0)
    const isNew = item.基本信息?.is_new

    return {
      ...item,
      基本信息: {
        ...item.基本信息,
        condition_type: item.基本信息?.condition_type || (isNew === 1 ? '全新' : '二手')
      },
      供应商信息: {
        ...(item.供应商信息 || {}),
        supplier_id: item.供应商信息?.supplier_id ?? null
      },
      店铺信息: {
        ...(item.店铺信息 || {}),
        store_id: item.店铺信息?.store_id ?? null,
        // 确保 store_name 不为 null 或空字符串
        store_name: item.店铺信息?.store_name || null
      },
      价格信息: {
        ...(item.价格信息 || {}),
        purchase_price: purchasePrice,
        sale_price: salePrice,
        profit: item.价格信息?.profit ?? (salePrice - purchasePrice)
      },
      时间信息: {
        ...(item.时间信息 || {}),
        // 确保 salestime 不为空字符串
        salestime: item.时间信息?.salestime || null
      },
      客户信息: normalizeCustomerInfo(item.客户信息),
      操作员信息: {
        ...(item.操作员信息 || {}),
        operator_id: item.操作员信息?.operator_id ?? item.操作员信息?.sale_operator_id ?? null,
        sale_operator_id: item.操作员信息?.sale_operator_id ?? item.操作员信息?.operator_id ?? null,
        inventory_operator_id: item.操作员信息?.inventory_operator_id ?? null
      }
    }
  }

  const purchasePrice = Number(item.purchase_price || 0)
  const salePrice = Number(item.sale_price || 0)
  const rawStatusCode = item.status_code || item.status || ''

  return {
    基本信息: {
      phone_id: item.phone_id,
      imei: item.imei,
      serial_number: item.serial_number,
      brand: item.brand,
      model: item.model,
      color: item.color,
      memory: item.memory,
      condition_type: item.is_new === 1 ? '全新' : '二手',
      status: item.status,
      status_code: rawStatusCode,
      quality_grade: item.quality_grade,
      is_new: item.is_new,
      remarks: item.remarks
    },
    销售信息: {
      sale_id: item.sale_id,
      sale_type: item.sale_type || '',
      payment_method: item.payment_method || '',
      payment_channel: item.payment_channel || '',
      invoice_number: item.invoice_number || '',
      sale_remarks: item.sale_remarks || '',
      sale_date: item.sale_date || item.sales_sale_date || ''
    },
    供应商信息: {
      supplier_id: item.supplier_id ?? null,
      supplier_name: item.supplier_name,
      supplier_contact: item.supplier_contact,
      supplier_phone: item.supplier_phone
    },
    店铺信息: {
      store_id: item.store_id ?? null,
      store_name: item.store_name,
      store_address: item.store_address
    },
    价格信息: {
      purchase_price: purchasePrice,
      sale_price: salePrice,
      profit: salePrice - purchasePrice
    },
    时间信息: {
      Inventorytime: item.Inventorytime || item.inventorytime || item.created_at,
      salestime: item.phones_salestime || item.salestime || item.sales_sale_date,
      created_at: item.created_at
    },
    客户信息: normalizeCustomerInfo({
      customer_id: item.customer_id ?? null,
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      apple_id: item.apple_id || item.customer_apple_id
    }),
    操作员信息: {
      operator_id: item.sale_operator_id ?? item.operator_id ?? null,
      sale_operator_id: item.sale_operator_id ?? item.operator_id ?? null,
      inventory_operator_id: item.inventory_operator_id ?? null,
      inventory_operator_name: item.inventory_operator_name,
      sale_operator_name: item.salesperson_name || item.sale_operator_name
    }
  }
}

const buildQueryParams = () => {
  const params: Record<string, any> = { ...filters }

  Object.keys(params).forEach(key => {
    if (params[key] === '' || params[key] === null || params[key] === undefined) {
      delete params[key]
    }
  })

  return params
}

const getQueryCacheKey = (params: Record<string, any>) => {
  return JSON.stringify(
    Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key]
        return acc
      }, {} as Record<string, any>)
  )
}

const isCacheValid = (timestamp: number) => {
  return Date.now() - timestamp < QUERY_CACHE_TTL
}

const applyQueryDataResult = (data: QueryItem[], total: number) => {
  queryData.value = data
  setTotal(Number(total) || data.length || 0)
}

const applyStatisticsResult = (data?: Partial<Statistics>) => {
  if (!data) return

  statistics.value = {
    total_phones: 0,
    in_stock_count: 0,
    sold_count: 0,
    new_count: 0,
    used_count: 0,
    total_purchase_cost: 0,
    total_sales_revenue: 0,
    total_profit: 0,
    avg_profit: 0,
    profit_margin: '0%',
    ...data
  }
}

const invalidateQueryCaches = () => {
  queryDataCache.clear()
  queryStatsCache.clear()
}

const removeQueryItemLocally = (phoneId: number) => {
  const nextQueryData = queryData.value.filter(item => item.基本信息?.phone_id !== phoneId)

  if (nextQueryData.length === queryData.value.length) {
    return false
  }

  queryData.value = nextQueryData
  selectedItems.value = selectedItems.value.filter(item => item.基本信息?.phone_id !== phoneId)

  if (detailItem.value?.基本信息?.phone_id === phoneId) {
    closeDetailModal()
  }

  updateSelectAllState()

  const nextTotal = Math.max((paginationData.total.value || 0) - 1, 0)
  setTotal(nextTotal)

  const currentCacheKey = getQueryCacheKey(buildQueryParams())
  queryDataCache.set(currentCacheKey, {
    data: nextQueryData,
    total: nextTotal,
    timestamp: Date.now()
  })

  return true
}

const refreshQueryAfterDelete = () => {
  if (queryData.value.length === 0 && filters.page > 1) {
    const previousPage = filters.page - 1
    filters.page = previousPage
    goToPage(previousPage)
  }

  window.setTimeout(() => {
    invalidateQueryCaches()
    loadQueryData(true).catch(error => {
      logger.error('删除后刷新综合查询失败:', error)
    })
  }, 0)
}

// 防抖函数
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debounceLoadQueryData = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    loadQueryData()
  }, 500)
}

const triggerLoadQueryData = () => {
  void loadQueryData()
}

// 获取状态标签
const getStatusLabel = (status: string) => {
  return getPhoneStatusLabel(status)
}

// 加载查询数据
const loadQueryStatistics = async (
  params: Record<string, any>,
  options: {
    force?: boolean
    cacheKey?: string
    requestId?: number
  } = {}
) => {
  const {
    force = false,
    cacheKey = getQueryCacheKey(params),
    requestId = latestQueryRequestId
  } = options

  if (!force) {
    const cachedStats = queryStatsCache.get(cacheKey)
    if (cachedStats && isCacheValid(cachedStats.timestamp)) {
      if (requestId === latestQueryRequestId) {
        applyStatisticsResult(cachedStats.data)
      }
      return cachedStats.data
    }
  }

  try {
    const statsResponse = await unifiedApi.get('/query/statistics', { params })
    if (statsResponse.success && statsResponse.data) {
      const statsData = statsResponse.data as Statistics
      queryStatsCache.set(cacheKey, {
        data: statsData,
        timestamp: Date.now()
      })

      if (requestId === latestQueryRequestId) {
        applyStatisticsResult(statsData)
      }

      return statsData
    }
  } catch (err: any) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
      return
    }
    logger.warn('加载综合查询统计失败:', err)
  }
}

const loadQueryData = async (force = false) => {
  const params = buildQueryParams()
  const cacheKey = getQueryCacheKey(params)
  const requestId = ++latestQueryRequestId

  if (!force) {
    const cachedStats = queryStatsCache.get(cacheKey)
    if (cachedStats && isCacheValid(cachedStats.timestamp)) {
      applyStatisticsResult(cachedStats.data)
    }

    const cachedData = queryDataCache.get(cacheKey)
    if (cachedData && isCacheValid(cachedData.timestamp)) {
      applyQueryDataResult(cachedData.data, cachedData.total)
      void loadQueryStatistics(params, { cacheKey, requestId })
      return
    }
  }

  loading.value = true
  const statisticsPromise = loadQueryStatistics(params, { force, cacheKey, requestId })

  try {
    const queryResponse = await unifiedApi.get('/query/comprehensive', { params })
    if (requestId !== latestQueryRequestId) {
      return
    }

    if (queryResponse.success) {
      const rawData = extractResponseData<any[]>(queryResponse)
      const normalizedData = sortQueryData(rawData.map((item: any) => normalizeQueryItem(item)))

      // 修复分页数据获取：分页信息在 queryResponse.pagination 中
      const paginationData = (queryResponse as any).pagination || { total: 0 }
      // 确保total是数字类型
      const total = Number(paginationData.total) || 0
      applyQueryDataResult(normalizedData, total)
      queryDataCache.set(cacheKey, {
        data: normalizedData,
        total,
        timestamp: Date.now()
      })

    } else {
      ElMessage.error(queryResponse.message || '加载数据失败')
      queryData.value = []
      setTotal(0)
    }
    void statisticsPromise

  } catch (err: any) {
    // 如果是请求被取消的错误，不显示错误提示
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      return
    }

    if (requestId !== latestQueryRequestId) {
      return
    }

    ElMessage.error('加载数据失败')
    queryData.value = []
    setTotal(0)
  } finally {
    if (requestId === latestQueryRequestId) {
      loading.value = false
    }
  }
}

// 加载查询选项
const loadQueryOptions = async () => {
  try {
    // 从后端API获取查询选项（包含完整的状态列表）
    const response = await unifiedApi.get('/query/options')

    const data = response.success && response.data ? response.data : {}

    // 供应商 - 按 sort_order 排序，相同时按 id 排序确保一致性
    const suppliersRaw = Array.isArray(data.suppliers) ? data.suppliers : []
    const suppliers = suppliersRaw
      .filter((item: any) => item.status === 1 || item.status === undefined)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        sort_order: item.sort_order || 0
      }))
      .sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order
        }
        return a.id - b.id
      })

    // 店铺（根据用户门店权限过滤）- 按 sort_order 排序，相同时按 id 排序确保一致性
    const storesRaw = Array.isArray(data.stores) ? data.stores : []
    const userStoreIds = authStore.user?.store_ids || []
    const userStoreId = authStore.user?.store_id
    let filteredStores = storesRaw
    if (userStoreIds.length > 0) {
      filteredStores = storesRaw.filter((store: any) => userStoreIds.includes(store.id))
    } else if (userStoreId) {
      filteredStores = storesRaw.filter((store: any) => store.id === userStoreId)
    }
    const stores = filteredStores
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        sort_order: item.sort_order || 0
      }))
      .sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order
        }
        return a.id - b.id
      })

    // 品牌 - 按 sort_order 排序，相同时按 id 排序确保一致性
    const brandsRaw = Array.isArray(data.brands) ? data.brands : []
    const brands = brandsRaw
      .map((brand: any) => (typeof brand === 'string' ? { name: brand, sort_order: 0, id: 0 } : { name: brand.name, sort_order: brand.sort_order || 0, id: brand.id || 0 }))
      .sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order
        }
        return a.id - b.id
      })
      .map((item: any) => item.name)
      .filter(Boolean)

    // 型号 - 保留完整信息包括 brand_name 用于联动筛选，按 sort_order 排序，相同时按 id 排序确保一致性
    const modelsRaw = Array.isArray(data.models) ? data.models : []
    const models = modelsRaw
      .map((model: any) => {
        if (typeof model === 'string') return { id: 0, name: model, brand_name: '', sort_order: 0 }
        const name = model?.name || model?.model || model?.model_name
        return name ? {
          id: model.id || 0,
          name,
          brand_id: model.brand_id,
          brand_name: model.brand_name || model.brand || '',
          sort_order: model.sort_order || 0
        } : null
      })
      .filter(Boolean) as Array<any>
    // 按 sort_order 排序型号，相同时按 id 排序确保一致性
    models.sort((a: any, b: any) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order
      }
      return a.id - b.id
    })

    // 保存完整型号列表用于筛选
    allModelsList.value = models

    // 颜色 - 按 sort_order 排序，相同时按 id 排序确保一致性
    const colorsRaw = Array.isArray(data.colors) ? data.colors : []
    const colors = colorsRaw
      .map((color: any) => (typeof color === 'string' ? { name: color, sort_order: 0, id: 0 } : { name: color.name, sort_order: color.sort_order || 0, id: color.id || 0 }))
      .sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order
        }
        return a.id - b.id
      })
      .map((item: any) => item.name)
      .filter(Boolean)

    // 内存 - 按 sort_order 排序，相同时按 id 排序确保一致性
    const memoriesRaw = Array.isArray(data.memories) ? data.memories : []
    const memories = memoriesRaw
      .map((memory: any) => (typeof memory === 'string' ? { name: memory, sort_order: 0, id: 0 } : { name: memory.name, sort_order: memory.sort_order || 0, id: memory.id || 0 }))
      .sort((a: any, b: any) => {
        // 先按 sort_order 排序，相同时按 id 排序确保一致性
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order
        }
        return a.id - b.id
      })
      .map((item: any) => item.name)
      .filter(Boolean)

    // 使用后端返回的状态选项，如果为空则使用默认值
    const apiStatuses = Array.isArray(data.statuses) ? data.statuses : []
    const statuses = apiStatuses.length > 0 ? apiStatuses : PHONE_STATUS_OPTIONS
    const apiConditions = Array.isArray(data.conditions) ? data.conditions : []
    const conditions = apiConditions.length > 0 ? apiConditions : [
      { value: 'true', label: '全新' },
      { value: 'false', label: '二手' }
    ]

    options.value = {
      suppliers,
      stores,
      brands,
      models: [],  // 初始化为空，只有选择品牌后才显示对应型号
      colors,
      memories,
      users: options.value.users || [],
      statuses,
      conditions
    }

    if (options.value.users.length === 0) {
      loadSalesUsers()
    }

  } catch (error) {
    // 如果是请求被取消的错误，不显示错误提示
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return
    }

    logger.error('加载查询选项失败:', error)
    handleApiError(error, '加载查询选项失败')

    // 设置默认选项，确保页面可以正常显示
    options.value = {
      suppliers: [],
      stores: [],
      brands: ['Apple', '华为', '小米', 'OPPO', 'vivo', '三星', '荣耀'],
      models: [],
      colors: ['黑色', '白色', '红色', '蓝色'],
      memories: ['64GB', '128GB', '256GB', '512GB'],
      users: [], // 销售员选项
      statuses: PHONE_STATUS_OPTIONS,
      conditions: [
        { value: 'true', label: '全新' },
        { value: 'false', label: '二手' }
      ]
    }
  }
}

// 加载销售员选项（不阻塞首屏）
const loadSalesUsers = async () => {
  if (options.value.users.length > 0 || editModalOptions.users.length > 0) {
    options.value.users = options.value.users.length > 0 ? options.value.users : editModalOptions.users
    return
  }

  if (employeesPromise.value) {
    options.value.users = await employeesPromise.value
    return
  }

  try {
    employeesPromise.value = (async () => {
      const usersRes = await unifiedApi.get('/users/employees?limit=10000')
      return usersRes.success && usersRes.data?.employees ? usersRes.data.employees : []
    })()

    options.value.users = await employeesPromise.value
  } catch (error) {
    options.value.users = []
  } finally {
    employeesPromise.value = null
  }
}

// 加载编辑模态框选项数据
const loadEditModalOptions = async () => {
  if (editModalOptionsLoading.value) return
  if (editModalOptionsLoaded.value) return
  editModalOptionsLoading.value = true
  try {
    // 并行调用API，传递大的 limit 参数获取所有数据
    const [
      suppliersRes,
      storesRes,
      brandsRes,
      modelsRes,
      colorsRes,
      memoriesRes,
      usersRes
    ] = await Promise.all([
      unifiedApi.get('/suppliers?limit=10000'),
      unifiedApi.get('/stores?all=true&limit=10000'),
      unifiedApi.get('/brands?status=1&limit=10000'),
      unifiedApi.get('/models?limit=10000'),
      unifiedApi.get('/colors?limit=10000'),
      unifiedApi.get('/memories?limit=10000'),
      unifiedApi.get('/users/employees?limit=10000')
    ])

    // 更新编辑模态框选项 - 按 sort_order 排序，相同时按 id 排序确保一致性
    // 供应商按 sort_order 排序，相同时按 id 排序
    editModalOptions.suppliers = suppliersRes.success && suppliersRes.data
      ? (suppliersRes.data || []).sort((a: any, b: any) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderA !== orderB ? orderA - orderB : (a.id || 0) - (b.id || 0);
        })
      : []

    // 店铺数据
    editModalOptions.stores = storesRes.success ? extractResponseData<any[]>(storesRes) : []

    // 品牌按 sort_order 排序，相同时按 id 排序
    if (brandsRes.success) {
      editModalOptions.brands = extractResponseData<any[]>(brandsRes)
        .sort((a: any, b: any) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderA !== orderB ? orderA - orderB : (a.id || 0) - (b.id || 0);
        })
        .map((brand: any) => brand.name)
    } else {
      editModalOptions.brands = []
    }

    // 型号按 sort_order 排序，相同时按 id 排序
    if (modelsRes.success) {
      editModalOptions.models = extractResponseData<any[]>(modelsRes)
        .sort((a: any, b: any) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderA !== orderB ? orderA - orderB : (a.id || 0) - (b.id || 0);
        })
        .map((model: any) => model.name)
    } else {
      editModalOptions.models = []
    }

    // 颜色按 sort_order 排序，相同时按 id 排序
    if (colorsRes.success) {
      editModalOptions.colors = extractResponseData<any[]>(colorsRes)
        .sort((a: any, b: any) => {
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          return orderA !== orderB ? orderA - orderB : (a.id || 0) - (b.id || 0);
        })
        .map((color: any) => color.name)
    } else {
      editModalOptions.colors = []
    }

    // 内存按 sort_order 排序，相同时按 id 排序确保一致性
    if (memoriesRes.success) {
      editModalOptions.memories = extractResponseData<any[]>(memoriesRes)
        .sort((a: any, b: any) => {
          // 先按 sort_order 排序，相同时按 id 排序确保一致性
          const orderA = a.sort_order || 0;
          const orderB = b.sort_order || 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return (a.id || 0) - (b.id || 0);
        })
        .map((memory: any) => memory.size || memory.capacity || memory.name)
    } else {
      editModalOptions.memories = []
    }

    // users接口返回 { employees, total, isAdmin } 结构，需要提取 employees 数组
    editModalOptions.users = usersRes.success && usersRes.data?.employees ? usersRes.data.employees : []
    editModalOptionsLoaded.value = true
    if (options.value.users.length === 0) {
      options.value.users = editModalOptions.users
    }
  } catch (error) {
    // 设置默认选项以防加载失败
    editModalOptions.suppliers = []
    editModalOptions.stores = []
    editModalOptions.brands = ['Apple', '华为', '小米', 'OPPO', 'vivo', '三星', 'OnePlus']
    editModalOptions.models = []
    editModalOptions.colors = ['黑色', '白色', '红色', '蓝色', '金色', '银色', '绿色', '紫色']
    editModalOptions.memories = ['64GB', '128GB', '256GB', '512GB', '1TB']
    editModalOptions.users = []
  } finally {
    editModalOptionsLoading.value = false
  }
}

const ensureEditModalOptionsLoaded = async () => {
  if (editModalOptionsLoaded.value) return
  await loadEditModalOptions()
}

const warmupEditModalOptions = () => {
  ensureEditModalOptionsLoaded().catch(error => {
    logger.error('❌ 编辑弹窗选项预热失败:', error)
  })
}

// 导出Excel
const exportToExcel = async () => {
  await exportFile({
    url: '/query/export/excel',
    filename: buildDateFilename('综合查询', 'xlsx'),
    params: sanitizeParams({ ...filters }),
    allowed: canExport,
    loading: exporting,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: 'Excel导出成功',
    errorMessage: '导出失败',
    onError: (error) => {
      logger.error('导出Excel失败:', error)
      message.error('导出失败')
    }
  })
}

// 快捷跳转到采购入库页面
const goToStockIn = () => {
  try {
    // 跳转到库存页面，并通过 URL 参数触发打开入库模态框
    router.push('/inventory?openStockIn=true')
  } catch (error) {
    logger.error('跳转到采购入库页面失败:', error)
    message.error('跳转失败，请手动访问采购入库页面')
  }
}

// 快捷跳转到销售出库页面
const goToSales = () => {
  try {
    // 在当前标签页跳转
    router.push('/sales')
  } catch (error) {
    logger.error('跳转到销售页面失败:', error)
    message.error('跳转失败，请手动访问销售页面')
  }
}

// 退库功能相关函数
const handleReturnStockSuccess = async () => {
  success('退库操作成功，设备已恢复到未销售状态')
  invalidateQueryCaches()
  await loadQueryData(true)
}

const handleEditSuccess = async () => {
  invalidateQueryCaches()
  await loadQueryData(true)
}

// 新的统一分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  goToPage(page)
  filters.page = page
  filters.limit = pageSize
  loadQueryData()
}

// 品牌筛选变化处理 - 从本地数据筛选对应的型号列表
const handleFilterBrandChange = () => {
  // 清空型号选择
  filters.model = ''

  if (filters.brand) {
    // 从完整的型号列表中筛选该品牌的型号
    const filteredModels = allModelsList.value.filter((model: any) => {
      const modelBrandName = model.brand_name || ''
      return modelBrandName === filters.brand
    })

    // 更新显示的型号列表
    options.value.models = filteredModels
  } else {
    // 没有选择品牌，清空型号列表
    options.value.models = []
  }

  // 重新加载数据
  loadQueryData()
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filters, {
    page: 1,
    limit: 100,
    supplier_id: '',
    store_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    is_new: '',
    sale_operator_id: '', // 重置销售员筛选
    status: '',
    start_date: '',
    end_date: '',
    search_term: ''
  })
  loadQueryData()
}

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    invalidateQueryCaches()
    await Promise.all([
      loadQueryData(true),
      loadQueryOptions()
    ])
  })
  success('数据刷新成功')
}

// 格式化日期 - 使用项目标准时间工具
const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  return TimeUtil.format(dateString, TIME_FORMATS.DATE)
}

// 格式化价格 - 始终显示价格，包括 0
const formatPrice = (price?: number) => {
  if (price === null || price === undefined) return '-'
  return `¥${Math.floor(price)}`
}

// 图片预览相关函数
const previewImage = (image: any) => {
  const urls = productImages.value.map(img => getImageUrl(img.image_url))
  const index = productImages.value.findIndex(img => img.id === image.id)
  imageViewerUrls.value = urls
  imageViewerIndex.value = index >= 0 ? index : 0
  showImageViewer.value = true

  // 添加 ESC 键监听
  document.addEventListener('keydown', handleEscKey)
}

const handleEscKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showImageViewer.value) {
    closeImageViewer()
  }
}

// 关闭图片预览
const closeImageViewer = () => {
  showImageViewer.value = false
  document.removeEventListener('keydown', handleEscKey)
}

const getImageUrl = (url: string) => {
  return formatImageUrl(url)
}

// 上传图片

// 关闭图片管理模态框（取消时清理临时文件）
const handleCloseImageModal = async () => {
  // 取消时清理所有新上传的临时文件
  if (tempFileTracker) {
    try {
      await tempFileTracker.cleanup()
    } catch (error) {
      logger.error('清理临时文件失败:', error)
    }
    tempFileTracker = null
  }

  showImageModal.value = false
}

const handleUploadImage = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  if (!selectedPhoneId.value) {
    ElMessage.error('无法获取手机ID')
    return
  }

  try {
    uploadingImage.value = true

    for (const file of Array.from(files)) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        ElMessage.warning(`${file.name} 不是图片文件`)
        continue
      }

      // 验证文件大小（最大5MB）
      if (file.size > 5 * 1024 * 1024) {
        ElMessage.warning(`${file.name} 文件过大，最大支持5MB`)
        continue
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('phone_id', selectedPhoneId.value.toString())

      const response = await unifiedApi.post('/shop/upload-phone-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // 跟踪新上传的文件（用于取消时清理）
      if (response.data?.image_url) {
        tempFileTracker?.addUploadedFile(response.data.image_url)
      }
    }

    ElMessage.success('图片上传成功')

    // 重新加载图片列表
    const response = await unifiedApi.get(`/shop/products/${selectedPhoneId.value}/images`)
    productImages.value = response.data || []

    // 刷新查询数据以更新图标显示
    await triggerLoadQueryData()
  } catch (error) {
    logger.error('上传图片失败:', error)
    ElMessage.error('上传图片失败')
  } finally {
    uploadingImage.value = false
    // 清空input，允许重复上传同一文件
    input.value = ''
  }
}

// 删除单张图片
const deleteSingleImage = async (image: any) => {
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

    await unifiedApi.delete(`/shop/images/${image.id}`)
    ElMessage.success('删除成功')

    // 重新加载图片列表
    if (selectedPhoneId.value) {
      const response = await unifiedApi.get(`/shop/products/${selectedPhoneId.value}/images`)
      productImages.value = response.data || []

      // 刷新查询数据以更新图标显示
      await triggerLoadQueryData()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      ElMessage.error('删除图片失败')
    }
  }
}

// 设置主图
const setPrimaryImage = async (image: any) => {
  if (!selectedPhoneId.value) return

  try {
    await unifiedApi.put(`/shop/images/${image.id}/primary`)
    ElMessage.success('设置主图成功')

    // 重新加载图片列表
    const response = await unifiedApi.get(`/shop/products/${selectedPhoneId.value}/images`)
    productImages.value = response.data || []
  } catch (error) {
    logger.error('设置主图失败:', error)
    ElMessage.error('设置主图失败')
  }
}

// 拖拽排序完成
const handleImageDragEnd = async () => {
  if (!selectedPhoneId.value || productImages.value.length === 0) return

  try {
    const imageIds = productImages.value.map(img => img.id)
    await unifiedApi.put(`/shop/products/${selectedPhoneId.value}/images/reorder`, { imageIds })
  } catch (error) {
    logger.error('保存图片排序失败:', error)
    ElMessage.error('保存排序失败')
    // 重新加载以恢复正确顺序
    const response = await unifiedApi.get(`/shop/products/${selectedPhoneId.value}/images`)
    productImages.value = response.data || []
  }
}

// 删除所有图片
const deleteAllImages = async () => {
  if (!selectedPhoneId.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除 ${selectedPhoneInfo.value?.brand} ${selectedPhoneInfo.value?.model} 的所有图片吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await unifiedApi.delete(`/shop/products/${selectedPhoneId.value}/images`)
    ElMessage.success('删除成功')

    // 清空图片列表
    productImages.value = []

    // 刷新查询数据以更新图标显示
    await triggerLoadQueryData()
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除图片失败:', error)
      ElMessage.error('删除图片失败')
    }
  }
}

// 状态文本转换函数
const getStatusText = (status: string) => {
  return getPhoneStatusLabel(status)
}

// 状态徽章样式类名转换函数
const getStatusBadgeClass = (status: string) => {
  return getPhoneStatusClass(status)
}

// 获取单元格内容
const getCellValue = (item: QueryItem, column: any) => {
  const { key } = column

  switch (key) {
    case 'supplier_info.supplier_name':
      return item.供应商信息?.supplier_name || '-'
    case 'store_info.store_name':
      return item.店铺信息?.store_name || '-'
    case 'time_info.Inventorytime':
      return formatDate(item.时间信息?.Inventorytime)
    case 'time_info.salestime':
      return formatDate(item.时间信息?.salestime)
    case 'basic_info.brand':
      return item.基本信息?.brand || '-'
    case 'basic_info.model':
      return item.基本信息?.model || '-'
    case 'basic_info.color':
      return item.基本信息?.color || '-'
    case 'basic_info.memory':
      return item.基本信息?.memory || '-'
    case 'basic_info.purchase_price':
      return formatPrice(item.价格信息?.purchase_price)
    case 'basic_info.sale_price':
      return formatPrice(item.价格信息?.sale_price)
    case 'customer_info.customer_name':
      return item.客户信息?.customer_name || '-'
    case 'customer_info.customer_phone':
      return item.客户信息?.customer_phone || '-'
    case 'basic_info.serial_number':
      return item.基本信息?.serial_number || '-'
    case 'basic_info.imei':
      return item.基本信息?.imei || '-'
    case 'other_info.remarks':
      // 优先显示手机备注，如果没有则显示销售备注
      return item.基本信息?.remarks || (item as any).销售信息?.sale_remarks || '-'
    case 'customer_info.apple_id':
      return item.客户信息?.apple_id || '-'
    case 'operator_info.inventory_operator':
      return item.操作员信息?.inventory_operator_name || '-'
    case 'operator_info.sale_operator':
      return item.操作员信息?.sale_operator_name || '-'
    case 'basic_info.is_new':
      return Number(item.基本信息?.is_new) === 1 ? '全新' : '二手'
    case 'basic_info.status':
      return getStatusText(item.基本信息?.status)
    default:
      return '-'
  }
}

const confirmReturnToStock = (item: QueryItem) => {
  if (!canReturnToStock.value) {
    handleNoPermission('return-to-stock')
    return
  }

  const basicInfo = item.基本信息 || {} as any
  const supplierInfo = item.供应商信息 || {} as any
  selectedReturnDevice.value = {
    id: Number(basicInfo.phone_id || 0),
    supplier_name: supplierInfo.supplier_name || '',
    brand: basicInfo.brand || '',
    model: basicInfo.model || '',
    imei: basicInfo.imei || '',
    serial_number: basicInfo.serial_number || '',
    color: basicInfo.color || '',
    memory: basicInfo.memory || '',
    is_new: basicInfo.is_new
  }
  showReturnModal.value = true
}



// 打开编辑弹窗
const openEditModal = (item: QueryItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  const phoneId = Number(item.基本信息?.phone_id || 0)
  if (!phoneId) {
    message.error('无效的手机ID')
    return
  }

  selectedEditPhoneId.value = phoneId
  showEditModal.value = true
}

// ===== 快速出库功能相关函数 =====

// 打开快速出库模态框
const openQuickSaleModal = () => {
  // 权限检查 - 快速出库需要库存创建权限
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  ensureEditModalOptionsLoaded().finally(() => {
    showQuickSaleModal.value = true
  })
}

// 快速出库成功处理
const handleQuickSaleSuccess = async () => {
  invalidateQueryCaches()
  await loadQueryData(true)
}

// ============ 多选相关方法 ============

// 检查项目是否被选中
const isItemSelected = (item: QueryItem) => {
  return selectedItems.value.some(selected => selected.基本信息?.phone_id === item.基本信息?.phone_id)
}

// 处理单个项目选择
const handleItemSelect = (item: QueryItem, checked: boolean) => {
  if (checked) {
    if (!isItemSelected(item)) {
      selectedItems.value.push(item)
    }
  } else {
    const index = selectedItems.value.findIndex(selected => selected.基本信息?.phone_id === item.基本信息?.phone_id)
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    }
  }
  updateSelectAllState()
}

// 处理全选
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedItems.value = [...queryData.value]
  } else {
    selectedItems.value = []
  }
  updateSelectAllState()
}

// 更新全选状态
const updateSelectAllState = () => {
  if (selectedItems.value.length === 0) {
    selectAll.value = false
    isIndeterminate.value = false
  } else if (selectedItems.value.length === queryData.value.length) {
    selectAll.value = true
    isIndeterminate.value = false
  } else {
    selectAll.value = false
    isIndeterminate.value = true
  }
}

// 清除选择
const clearSelection = () => {
  selectedItems.value = []
  selectAll.value = false
  isIndeterminate.value = false
}

// ============ 销售单相关方法 ============

// 打开详情模态框
const openDetailModal = (item: QueryItem) => {
  detailItem.value = item
  showDetailModal.value = true
}

// 关闭详情模态框
const closeDetailModal = () => {
  showDetailModal.value = false
  detailItem.value = null
}

// 双击单元格打开销售单（PC端）
const handleCellDoubleClick = (item: QueryItem, column: any) => {
  // 只在PC端（>1024px）响应双击
  if (windowWidth.value > 1024) {
    openReceiptForItem(item)
  }
}

// 双击行打开详情模态框（仅移动端）
const handleRowDoubleClick = (item: QueryItem) => {
  // 仅移动端（<=1024px）打开详情模态框
  if (windowWidth.value <= 1024) {
    openDetailModal(item)
  }
}

// 双击机况管理图片（二手机）
const handleConditionDoubleClick = async (item: QueryItem) => {
  const basicInfo = item.基本信息 || {} as QueryItem['基本信息']

  // 只有二手机才能管理图片
  if (Number(basicInfo.is_new) !== 0) {
    ElMessage.info('全新机不支持图片管理')
    return
  }

  const phoneId = basicInfo.phone_id
  if (!phoneId) {
    ElMessage.error('无法获取手机ID')
    return
  }

  try {
    showImageModal.value = true
    loadingImages.value = true
    selectedPhoneId.value = phoneId
    selectedPhoneInfo.value = {
      brand: basicInfo.brand || '',
      model: basicInfo.model || '',
      color: basicInfo.color || '',
      memory: basicInfo.memory || '',
      imei: basicInfo.imei || ''
    }

    // 初始化临时文件跟踪器
    tempFileTracker = createTempFileTracker()

    const response = await unifiedApi.get(`/shop/products/${phoneId}/images`)
    productImages.value = response.data || []
  } catch (error) {
    logger.error('加载图片失败:', error)
    ElMessage.error('加载图片失败')
  } finally {
    loadingImages.value = false
  }
}

// 为单个项目打开销售单
const openReceiptForItem = (item: QueryItem) => {
  const basicInfo = item.基本信息 || {} as QueryItem['基本信息']
  const priceInfo = item.价格信息 || {} as QueryItem['价格信息']
  const customerInfo = item.客户信息 || {} as QueryItem['客户信息']
  const supplierInfo = item.供应商信息 || {} as QueryItem['供应商信息']
  const storeInfo = item.店铺信息 || {} as QueryItem['店铺信息']
  const operatorInfo = item.操作员信息 || {} as QueryItem['操作员信息']
  const saleInfo = item.销售信息 || {} as QueryItem['销售信息']
  const timeInfo = item.时间信息 || {} as QueryItem['时间信息']

  // 确定单据类型
  let status = 'sold' // 默认为销售
  if (basicInfo.status_code === 'peer_transfer') {
    status = 'peer_transfer'
  } else if (basicInfo.status_code === 'supplier_proxy') {
    status = 'supplier_proxy'
  }

  receiptStatus.value = status
  receiptItems.value = [{
    phone_id: basicInfo.phone_id,
    brand: basicInfo.brand || '',
    model: basicInfo.model || '',
    color: basicInfo.color || '',
    memory: basicInfo.memory || '',
    imei: basicInfo.imei || '',
    serialNumber: basicInfo.serial_number || '',
    purchasePrice: priceInfo.purchase_price || 0,
    salePrice: priceInfo.sale_price || 0,
    // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
    isNew: basicInfo.is_new !== undefined ? basicInfo.is_new : 1,
    purchaseDate: timeInfo.Inventorytime || '',
    // 销售日期用于多商品时单独显示 - 确保不为空字符串
    saleDate: timeInfo.salestime && timeInfo.salestime.trim() !== '' ? timeInfo.salestime : undefined,
    // 店铺名称 - 单个商品也需要显示 - 确保不为空字符串或'-'
    storeName: storeInfo.store_name && storeInfo.store_name.trim() !== '' && storeInfo.store_name !== '-' ? storeInfo.store_name : undefined
  }]
  receiptCustomerName.value = normalizePersonName(customerInfo.customer_name || '', 20)
  receiptCustomerPhone.value = normalizePhoneDigits(customerInfo.customer_phone || '')
  receiptSupplierName.value = supplierInfo.supplier_name || ''
  receiptStoreName.value = storeInfo.store_name || ''
  receiptSalesOperator.value = operatorInfo.sale_operator_name || operatorInfo.inventory_operator_name || ''
  receiptNumber.value = saleInfo.invoice_number || ''

  // 销售时间从"时间信息"对象中获取
  receiptSaleDate.value = timeInfo.salestime || ''
  receiptPurchaseDate.value = timeInfo.Inventorytime || ''

  showReceipt.value = true
}

// 为选中项打开销售单
const openSelectedReceipt = () => {
  if (selectedItems.value.length === 0) return

  // 获取第一个选中项的状态作为单据类型
  const firstItem = selectedItems.value[0]
  const basicInfo = firstItem.基本信息 || {} as QueryItem['基本信息']

  let status = 'sold'
  if (basicInfo.status_code === 'peer_transfer') {
    status = 'peer_transfer'
  } else if (basicInfo.status_code === 'supplier_proxy') {
    status = 'supplier_proxy'
  }

  receiptStatus.value = status

  // 获取客户和供应商信息（从第一个选中项）
  const customerInfo = firstItem.客户信息 || {} as QueryItem['客户信息']
  const supplierInfo = firstItem.供应商信息 || {} as QueryItem['供应商信息']
  const storeInfo = firstItem.店铺信息 || {} as QueryItem['店铺信息']
  const operatorInfo = firstItem.操作员信息 || {} as QueryItem['操作员信息']
  const saleInfo = firstItem.销售信息 || {} as QueryItem['销售信息']

  receiptCustomerName.value = normalizePersonName(customerInfo.customer_name || '', 20)
  receiptCustomerPhone.value = normalizePhoneDigits(customerInfo.customer_phone || '')
  receiptSupplierName.value = supplierInfo.supplier_name || ''
  receiptStoreName.value = storeInfo.store_name || ''
  receiptSalesOperator.value = operatorInfo.sale_operator_name || operatorInfo.inventory_operator_name || ''

  // 处理单据编号：多选时收集所有不同的单据编号
  const invoiceNumbers = new Set<string>()
  selectedItems.value.forEach(item => {
    const saleInfo = item.销售信息 || {} as QueryItem['销售信息']
    if (saleInfo.invoice_number) {
      invoiceNumbers.add(saleInfo.invoice_number)
    }
  })

  if (invoiceNumbers.size === 0) {
    // 没有任何单据编号，显示合并/汇总
    receiptNumber.value = `合并-${selectedItems.value.length}项`
  } else if (invoiceNumbers.size === 1) {
    // 只有一个单据编号，直接显示
    receiptNumber.value = Array.from(invoiceNumbers)[0]
  } else {
    // 多个不同单据编号，显示为合并单据
    const sortedNumbers = Array.from(invoiceNumbers).sort()
    receiptNumber.value = `合并(${sortedNumbers.length}单)`
  }

  // 销售时间从"时间信息"对象中获取（使用第一个选中项的时间信息）
  const timeInfo = firstItem.时间信息 || {} as QueryItem['时间信息']
  receiptSaleDate.value = timeInfo.salestime || ''
  receiptPurchaseDate.value = timeInfo.Inventorytime || ''

  // 构建商品列表
  receiptItems.value = selectedItems.value.map(item => {
    const basic = item.基本信息 || {} as QueryItem['基本信息']
    const price = item.价格信息 || {} as QueryItem['价格信息']
    const timeInfo = item.时间信息 || {} as QueryItem['时间信息']
    const storeInfo = item.店铺信息 || {} as QueryItem['店铺信息']
    const saleInfo = item.销售信息 || {} as QueryItem['销售信息']

    return {
      phone_id: basic.phone_id,
      brand: basic.brand || '',
      model: basic.model || '',
      color: basic.color || '',
      memory: basic.memory || '',
      imei: basic.imei || '',
      serialNumber: basic.serial_number || '',
      purchasePrice: price.purchase_price || 0,
      salePrice: price.sale_price || 0,
      // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
      isNew: basic.is_new !== undefined ? basic.is_new : 1,
      // 入库日期：从时间信息对象的 Inventorytime 字段获取
      purchaseDate: timeInfo.Inventorytime || '',
      // 销售日期：多商品时每个商品单独显示 - 确保不为空字符串
      saleDate: timeInfo.salestime && timeInfo.salestime.trim() !== '' ? timeInfo.salestime : undefined,
      // 店铺名称 - 多商品时每个商品单独显示 - 确保不为空字符串或'-'
      storeName: storeInfo.store_name && storeInfo.store_name.trim() !== '' && storeInfo.store_name !== '-' ? storeInfo.store_name : undefined
    }
  })

  showReceipt.value = true
}

// 删除设备
const deleteItem = async (item: QueryItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除设备 "${item.基本信息?.brand} ${item.基本信息?.model}" (IMEI: ${item.基本信息?.imei}) 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
    await performDelete(item)
  } catch {
    // 用户取消操作
  }
}

const performDelete = async (item: QueryItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const phoneId = Number(item.基本信息?.phone_id || 0)
    const response = await unifiedApi.delete(`/query/${phoneId}`)
    if (response.success) {
      success('删除成功')
      removeQueryItemLocally(phoneId)
      refreshQueryAfterDelete()
    } else {
      message.error(response.message || '删除失败')
    }
  } catch (err) {
    logger.error('删除失败:', err)
    message.error('删除失败')
  }
}

// 添加商品到销售单
const handleAddItemToReceipt = (item: any) => {
  // 转换 API 返回的数据为 ReceiptItem 格式
  const receiptItem = {
    phone_id: item.id || item.phone_id,
    brand: item.brand || item.brand_name || '',
    model: item.model || item.model_name || '',
    color: item.color || item.color_name || '',
    memory: item.memory || item.memory_size || '',
    imei: item.imei || '',
    serialNumber: item.serial_number || '',
    purchasePrice: Number(item.purchase_price || item.purchase_cost || 0),
    salePrice: Number(item.sale_price || item.price || 0),
    // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
    isNew: item.is_new !== undefined ? item.is_new : 1,
    purchaseDate: item.inventory_time || item.Inventorytime || '',
    // 添加销售时间和店铺信息 - 确保不为空字符串
    saleDate: item.salestime && item.salestime.trim() !== '' ? item.salestime : undefined,
    storeName: item.store_name && item.store_name.trim() !== '' && item.store_name !== '-' ? item.store_name : undefined
  }

  // 检查是否已存在
  const exists = receiptItems.value.some(i => i.phone_id === receiptItem.phone_id)
  if (exists) {
    message.warning('该商品已在单据中')
    return
  }

  receiptItems.value.push(receiptItem)
  message.success('商品已添加到单据')
}

// 页面挂载
// 字段权限相关函数
const loadFieldPermissions = async () => {
  try {
    fieldPermissionsLoading.value = true

    // 使用 composable 加载字段权限
    await fieldPermissions.init()
  } catch (error) {
    logger.error('加载字段权限配置失败:', error)
  } finally {
    fieldPermissionsLoading.value = false
    void refreshQueryAnimations()
  }
}

// 检查字段是否应该显示
const shouldShowField = (fieldId: string) => {
  return fieldPermissions.isFieldVisible('query_queryview', fieldId)
}

const visibleStatsConfig = computed(() => {
  return statsConfig.filter(stat => shouldShowField(stat.fieldId))
})

const showStatsCards = computed(() => visibleStatsConfig.value.length > 0)

const refreshQueryAnimations = async () => {
  await nextTick()
  refreshScrollAnimations()
}

// 根据字段权限生成动态列
const tableColumns = computed(() => {
  const width = windowWidth.value

  // 定义所有列
  const allColumns = [
    { key: 'supplier_info.supplier_name', label: '供应商', field: '供应商信息', prop: 'supplier_name' },
    { key: 'store_info.store_name', label: '店铺', field: '店铺信息', prop: 'store_name' },
    { key: 'time_info.Inventorytime', label: '入库时间', field: '时间信息', prop: 'Inventorytime' },
    { key: 'time_info.salestime', label: '销售时间', field: '时间信息', prop: 'salestime' },
    { key: 'basic_info.brand', label: '品牌', field: '基本信息', prop: 'brand' },
    { key: 'basic_info.model', label: '型号', field: '基本信息', prop: 'model' },
    { key: 'basic_info.color', label: '颜色', field: '基本信息', prop: 'color' },
    { key: 'basic_info.memory', label: '内存', field: '基本信息', prop: 'memory' },
    { key: 'basic_info.purchase_price', label: '入库价格', field: '基本信息', prop: 'purchase_price' },
    { key: 'basic_info.sale_price', label: '销售价格', field: '基本信息', prop: 'sale_price' },
    { key: 'customer_info.customer_name', label: '客户姓名', field: '客户信息', prop: 'customer_name' },
    { key: 'customer_info.customer_phone', label: '手机号', field: '客户信息', prop: 'customer_phone' },
    { key: 'basic_info.serial_number', label: '序列号', field: '基本信息', prop: 'serial_number' },
    { key: 'basic_info.imei', label: 'IMEI', field: '基本信息', prop: 'imei' },
    { key: 'other_info.remarks', label: '备注', field: '其他信息', prop: 'remarks' },
    { 'key': 'customer_info.apple_id', label: 'Apple ID', field: '客户信息', prop: 'apple_id' },
    { key: 'operator_info.inventory_operator', label: '入库员', field: '操作员信息', prop: 'inventory_operator_name' },
    { key: 'operator_info.sale_operator', label: '销售员', field: '操作员信息', prop: 'sale_operator_name' },
    { key: 'basic_info.is_new', label: '机况', field: '基本信息', prop: 'is_new' },
    { key: 'basic_info.status', label: '状态', field: '基本信息', prop: 'status' },
    { key: 'system_info.operations', label: '操作', field: '系统信息', prop: 'operations' }
  ]

  // 根据屏幕宽度过滤字段
  let mobileColumns: string[] = []

  if (width <= 480) {
    // 小屏手机：只显示 型号、颜色、内存、客户姓名
    mobileColumns = [
      'basic_info.model',
      'basic_info.color',
      'basic_info.memory',
      'customer_info.customer_name'
    ]
  } else if (width <= 768) {
    // 大屏手机：显示 品牌、型号、颜色、内存、客户姓名、手机号、状态
    mobileColumns = [
      'basic_info.brand',
      'basic_info.model',
      'basic_info.color',
      'basic_info.memory',
      'customer_info.customer_name',
      'customer_info.customer_phone',
      'basic_info.status'
    ]
  } else if (width <= 1024) {
    // 平板：显示更多字段
    mobileColumns = [
      'basic_info.brand',
      'basic_info.model',
      'basic_info.color',
      'basic_info.memory',
      'basic_info.is_new',
      'basic_info.purchase_price',
      'basic_info.sale_price',
      'customer_info.customer_name',
      'basic_info.status'
    ]
  }

  // 如果是移动端，只返回指定的列
  if (width <= 1024) {
    const filteredMobileColumns = allColumns.filter(column =>
      mobileColumns.includes(column.key) && shouldShowField(column.key)
    )
    return filteredMobileColumns
  }

  // PC端返回所有有权限的列
  const filteredColumns = allColumns.filter(column => shouldShowField(column.key))
  return filteredColumns
})

onMounted(async () => {
  // 字段权限改为后台加载，不阻塞首屏数据
  loadFieldPermissions().catch(error => {
    logger.error('❌ 字段权限加载失败:', error)
  })

  // 优先加载查询数据，让用户先看到列表和统计
  const initialQueryPromise = loadQueryData()

  // 查询筛选选项后台加载，不阻塞首屏
  loadQueryOptions().catch(error => {
    logger.error('❌ 查询选项加载失败:', error)
  })

  // 编辑弹窗选项延后预热，避免首屏和综合查询抢占连接
  initialQueryPromise.finally(() => {
    void refreshQueryAnimations()
    editModalWarmupTimer = setTimeout(() => {
      warmupEditModalOptions()
    }, 1200)
  })

  // 添加窗口大小监听
  window.addEventListener('resize', updateWindowWidth)
  await refreshQueryAnimations()
})

watch(
  () => visibleStatsConfig.value.length,
  () => {
    void refreshQueryAnimations()
  }
)

// 路由守卫：页面离开时清理临时文件
onBeforeRouteLeave(async () => {
  if (tempFileTracker) {
    await tempFileTracker.cleanup()
    tempFileTracker = null
  }
  return true
})

// 清理监听器
onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  if (editModalWarmupTimer) {
    clearTimeout(editModalWarmupTimer)
  }

  // 清理所有触摸定时器
  touchTimers.value.forEach(timer => clearTimeout(timer))
  touchTimers.value.clear()
  lastTapTime.value.clear()
})
</script>

<style scoped>
/* 导入字段权限相关样式 */
@import '@/assets/css/field-permissions.css';

/* 本地样式 */
.query-view {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 按钮文字显示控制 - 默认显示桌面版文字 */
:deep(.btn-text-mobile) {
  display: none;
}

:deep(.btn-text-desktop) {
  display: inline;
}

/* 区域标题样式 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 12px;
  /* 移除下边框横线 */
  /* border-bottom: 2px solid #f8f9fa; */
}

.section-title i {
  color: #667eea;
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: #6c757d;
  font-weight: 400;
}

/* 表格区域样式 */
.table-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid #e8ecef;
}

/* 选中统计栏样式 */
.selected-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 16px;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.summary-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.summary-info i {
  font-size: 16px;
}

.summary-info strong {
  font-size: 18px;
  font-weight: 700;
}

.summary-divider {
  opacity: 0.5;
  margin: 0 8px;
}

.summary-info .amount {
  color: #ffd700;
}

.summary-info .profit {
  color: #67c23a;
}

.summary-actions {
  display: flex;
  gap: 8px;
}

/* 复选框列样式 */
.checkbox-column {
  width: 50px;
  text-align: center !important;
}

.checkbox-column :deep(.el-checkbox) {
  margin: 0;
}

/* 选中行样式 */
.devices-table tbody tr.selected-row {
  background: #e8f4fd !important;
}

.devices-table tbody tr.selected-row td {
  background: transparent !important;
}

/* 编辑模态框的表单组样式 */
.edit-form .form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-bottom: 2px;
}

.form-actions .btn {
  margin: 0;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px; /* 调整为与输入框一致的高度 */
  border: none;
  border-radius: 8px;
  font-size: 14px; /* 与输入框字体一致 */
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
  text-decoration: none;
}

.btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn:hover::before {
  width: 300px;
  height: 300px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-outline-secondary {
  /* 紫色渐变背景 - 与高级搜索按钮保持一致 */
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover:not(:disabled) {
  /* 悬停时增强效果 */
  background: linear-gradient(135deg, #7c8ef0, #8a5bb8);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transform: translateY(-1px);
}

.btn-outline-secondary:active:not(:disabled) {
  /* 点击时的按压效果 */
  background: linear-gradient(135deg, #5a6fd8, #6a4190);
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.btn-outline-primary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #667eea;
  color: white;
}

.btn-warning {
  background: linear-gradient(135deg, #ffc107, #fd7e14);
  color: #212529;
}

.btn-danger {
  background: linear-gradient(135deg, #dc3545, #e74c3c);
  color: white;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  min-width: 70px;
}

/* 操作按钮容器样式 */
.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-buttons .btn {
  white-space: nowrap;
}

/* 统计卡片样式 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  border: 1px solid #e8ecef;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);
}

/* PC端确保在库数量卡片正常显示 */
.stat-card.hide-on-mobile {
  display: flex;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.stat-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.stat-icon.in-stock {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.sold {
  background: linear-gradient(135deg, #ffc107, #fd7e14);
}

.stat-icon.new {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.used {
  background: linear-gradient(135deg, #fd7e14, #dc3545);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
}

/* 表格样式 - 使用与销售页面一致的devices-table样式 */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
}

.devices-table {
  width: 100%;
  min-width: 1200px;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.devices-table th {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-right: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  position: relative;
  white-space: nowrap;
}

.devices-table th:last-child {
  border-right: none;
}

.devices-table th::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.devices-table td {
  padding: 10px 8px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  font-size: 13px;
  color: #2c3e50;
  font-weight: 500;
  text-align: center;
  position: relative;
  white-space: nowrap;
}

.devices-table td:last-child {
  border-right: none;
}

.devices-table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.devices-table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.devices-table tbody tr:hover {
  background: #e3f2fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.devices-table tbody tr:hover td {
  border-bottom-color: #dee2e6;
}

/* 特殊列样式 */
.devices-table td:nth-child(1), /* 供应商列 */
.devices-table td:nth-child(2), /* 店铺列 */
.devices-table td:nth-child(6) { /* 品牌列 */
  font-weight: 600;
  color: #2c3e50;
  background: rgba(102, 126, 234, 0.03);
}

.devices-table td:nth-child(7), /* 型号列 */
.devices-table td:nth-child(8), /* 颜色列 */
.devices-table td:nth-child(9) { /* 内存列 */
  font-weight: 600;
  color: #495057;
}

.devices-table td:nth-child(10), /* IMEI列 */
.devices-table td:nth-child(11) { /* 序列号列 */
  font-weight: 500;
  color: #6c757d;
  font-style: italic;
}

.devices-table td:nth-child(12), /* 入库价格列 */
.devices-table td:nth-child(13) { /* 销售价格列 */
  font-weight: 600;
}

/* 状态列可点击样式 */
.status-cell-clickable {
  cursor: pointer;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.status-cell-clickable:active {
  transform: scale(0.98);
}

.status-cell-clickable:hover {
  background: rgba(102, 126, 234, 0.15) !important;
}

.status-cell-clickable:hover .status-badge {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.condition-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.condition-badge.new {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.condition-badge.used {
  background: rgba(253, 126, 20, 0.1);
  color: #fd7e14;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px;
  color: #ffffff !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* 在库 - 绿色 */
.status-badge.in-stock {
  background: #6c757d !important;
  color: #ffffff !important;
}

/* 已售 - 绿色 */
.status-badge.sold {
  background: #28a745 !important;
  color: #ffffff !important;
}

/* 批发 - 紫蓝色 */
.status-badge.peer-transfer {
  background: #667eea !important;
  color: #ffffff !important;
}

/* 划拨 - 紫色 */
.status-badge.supplier-proxy {
  background: #764ba2 !important;
  color: #ffffff !important;
}

/* 预定 - 青色 */
.status-badge.reserved {
  background: #17a2b8 !important;
  color: #ffffff !important;
}

/* 维修 - 黄色 */
.status-badge.repair {
  background: #f59e0b !important;
  color: #ffffff !important;
}

/* 丢失 - 红色 */
.status-badge.lost {
  background: #dc3545 !important;
  color: #ffffff !important;
}

.status-badge.returned {
  background: rgba(108, 117, 125, 0.1);
  color: #6c757d;
}

.status-badge.damaged {
  background: rgba(220, 53, 69, 0.15);
  color: #dc3545;
}

.price-cell {
  font-weight: 600;
  color: #e74c3c;
}

/* 序列号和IMEI列统一样式 - 灰色、斜体 */
.serial-imei-cell {
  font-weight: 500;
  color: #6c757d;
  font-style: italic;
}

.positive {
  color: #28a745;
}

.negative {
  color: #dc3545;
}

.zero {
  color: #6c757d;
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.loading-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e8ecef;
}

.pagination-info {
  color: #6c757d;
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

/* 退库表单样式 */
.return-form .form-label,
.form-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.return-form .form-label.required,
.form-label.required {
  position: relative;
}

.return-form .form-label.required::after,
.form-label.required::after {
  content: " *";
  color: #f56565;
}

.return-form .form-control,
.form-control {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.return-form .form-control:focus,
.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.return-form select.form-control,
select.form-control {
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 10px center;
  background-repeat: no-repeat;
  background-size: 16px;
  padding-right: 40px;
  background-color: white;
}

.return-form .form-row,
.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.return-form .form-group.full-width,
.form-group.full-width {
  grid-column: 1 / -1;
}

.return-form textarea.form-control,
textarea.form-control {
  resize: vertical;
  min-height: 100px;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: #718096;
  font-size: 14px;
  z-index: 2;
  pointer-events: none;
}

/* 设备信息区域样式 - 表格设计 */
.device-info-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.device-info-section .section-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.device-info-section .section-title i {
  color: #6366f1;
  font-size: 16px;
}

/* 设备信息表格样式 */
.device-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.device-info-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.15s ease;
}

.device-info-table tbody tr:last-child {
  border-bottom: none;
}

.device-info-table tbody tr:hover {
  background-color: #f9fafb;
}

.device-info-table tbody tr.highlight-row {
  background-color: #f8fafc;
  font-weight: 500;
}

.device-info-table tbody tr.highlight-row:hover {
  background-color: #f1f5f9;
}

.device-info-table .label-cell {
  padding: 12px 16px;
  color: #6b7280;
  font-weight: 500;
  width: 15%;
  white-space: nowrap;
}

.device-info-table .value-cell {
  padding: 12px 16px;
  color: #111827;
  font-weight: 600;
  width: 35%;
}

.device-info-table .imei-code {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'SF Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
  display: inline-block;
}

/* 机况标签样式 */
.badge-new,
.badge-used {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.badge-new {
  background: #d1fae5;
  color: #065f46;
}

.badge-used {
  background: #fef3c7;
  color: #92400e;
}

/* 退库信息区域样式 */
.return-info-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
}

.return-info-section .section-title {
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f093fb;
}

/* 表单按钮组样式 */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
  margin-top: 20px;
}

.form-actions .btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: center;
}

.form-actions .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions .btn-secondary,
.form-actions .btn-outline {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.form-actions .btn-secondary:hover:not(:disabled),
.form-actions .btn-outline:hover:not(:disabled) {
  background: #e2e8f0;
  color: #334155;
}

.form-actions .btn-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.form-actions .btn-warning:hover:not(:disabled) {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
  transform: translateY(-1px);
}

.form-actions .btn i {
  font-size: 14px;
}

.form-actions .btn .fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 设备信息表格样式 */
.device-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.device-info-table tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.15s ease;
}

.device-info-table tbody tr:last-child {
  border-bottom: none;
}

.device-info-table tbody tr:hover {
  background-color: #f9fafb;
}

.device-info-table tbody tr.highlight-row {
  background-color: #f8fafc;
  font-weight: 500;
}

.device-info-table tbody tr.highlight-row:hover {
  background-color: #f1f5f9;
}

.device-info-table .label-cell {
  padding: 12px 16px;
  color: #6b7280;
  font-weight: 500;
  width: 15%;
  white-space: nowrap;
}

.device-info-table .value-cell {
  padding: 12px 16px;
  color: #111827;
  font-weight: 600;
  width: 35%;
}

.device-info-table .imei-code {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'SF Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
  display: inline-block;
}

/* 机况标签样式 */
.badge-new,
.badge-used {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.badge-new {
  background: #d1fae5;
  color: #065f46;
}

.badge-used {
  background: #fef3c7;
  color: #92400e;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .device-info-section {
    padding: 16px;
  }

  .device-info-table {
    font-size: 13px;
  }

  .device-info-table tbody tr {
    display: block;
    border-bottom: 1px solid #e5e7eb;
    padding: 12px 0;
  }

  .device-info-table .label-cell,
  .device-info-table .value-cell {
    display: block;
    width: 100%;
    padding: 6px 0;
  }

  .device-info-table .label-cell {
    color: #9ca3af;
    font-size: 12px;
  }

  .device-info-table .value-cell {
    color: #111827;
    font-weight: 600;
  }

  .device-info-table tbody tr.highlight-row {
    background-color: transparent;
  }
}

/* 平板适配 */
@media (min-width: 768px) and (max-width: 1024px) {
  .device-info-table .label-cell,
  .device-info-table .value-cell {
    padding: 10px 12px;
    font-size: 13px;
  }
}


.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}

.modal-footer .warning-text {
  color: #718096;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-footer .warning-text i {
  color: #f59e0b;
}


.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* 编辑模态框表单布局 */
.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.form-grid-4 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16px;
}

.form-grid-5 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

/* 编辑表单的控件样式 */
.edit-form .form-control,
.edit-form select.form-control {
  width: 100%;
}

.edit-form input.form-control,
.edit-form select.form-control,
.edit-form textarea.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

.edit-form input.form-control:focus,
.edit-form select.form-control:focus,
.edit-form textarea.form-control:focus {
  border-color: #409eff;
  outline: none;
}

/* 全宽字段 */
.full-width {
  grid-column: 1 / -1;
}

/* 响应式设计 */

/* 平板端优化 (768px - 1024px) */
@media (min-width: 768px) and (max-width: 1024px) {
  .table-section {
    padding: 20px;
  }

  .stats-cards {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
}

/* 手机端优化 (≤768px) */
@media (max-width: 768px) {
  .query-view {
    padding: 4px 0;
  }

  .table-section {
    padding: 10px 4px;
    border-radius: 8px;
  }

  .section-title {
    font-size: 15px;
    margin-bottom: 16px;
    padding-bottom: 8px;
  }


  /* 统计卡片优化 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-label {
    font-size: 12px;
  }

  /* 平板及手机端隐藏在库数量卡片 */
  .stat-card.hide-on-mobile {
    display: none;
  }

  /* 表格区域优化 */
  .table-section {
    padding: 8px 2px;
  }

  .table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    /* 手机端优化：移除滚动条，让表格自适应 */
    overflow-x: visible;
  }

  .table-responsive::-webkit-scrollbar {
    display: none;
  }

  .devices-table {
    font-size: 13px;
    min-width: 100%; /* 移除固定最小宽度 */
    /* 手机端表格自适应布局 */
    table-layout: fixed;
    width: 100%;
  }

  .devices-table th,
  .devices-table td {
    padding: 8px 6px;
    /* 允许内容换行 */
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    font-size: 13px;
    line-height: 1.4;
  }

  /* 手机端关键列自适应宽度（7列时：品牌、型号、颜色、内存、客户姓名、手机号、状态） */
  .devices-table th:nth-child(1), /* 品牌列 */
  .devices-table td:nth-child(1) {
    width: 14%;
    min-width: 50px;
  }

  .devices-table th:nth-child(2), /* 型号列 */
  .devices-table td:nth-child(2) {
    width: 18%;
    min-width: 60px;
  }

  .devices-table th:nth-child(3), /* 颜色列 */
  .devices-table td:nth-child(3) {
    width: 12%;
    min-width: 45px;
  }

  .devices-table th:nth-child(4), /* 内存列 */
  .devices-table td:nth-child(4) {
    width: 11%;
    min-width: 50px;
  }

  .devices-table th:nth-child(5), /* 客户姓名列 */
  .devices-table td:nth-child(5) {
    width: 16%;
    min-width: 55px;
  }

  .devices-table th:nth-child(6), /* 手机号列 */
  .devices-table td:nth-child(6) {
    width: 17%;
    min-width: 60px;
    font-size: 12px;
  }

  .devices-table th:nth-child(7), /* 状态列 */
  .devices-table td:nth-child(7) {
    width: 12%;
    min-width: 50px;
  }

  /* 手机端文本溢出优化 - 对于特别长的型号或客户名 */
  .devices-table td:nth-child(2), /* 型号 */
  .devices-table td:nth-child(5) { /* 客户姓名 */
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    box-orient: vertical;
  }

  /* 操作按钮优化 */
  .action-buttons {
    flex-direction: column;
    gap: 6px;
  }

  .action-buttons .btn {
    width: 100%;
    font-size: 12px;
    padding: 6px 10px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-grid-4,
  .form-grid-5 {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-grid-3 {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  /* 编辑表单优化 */
  .edit-form .form-group {
    margin-bottom: 12px;
  }

  .edit-form .form-label {
    font-size: 13px;
  }

  .edit-form .form-control {
    font-size: 14px;
    padding: 10px 12px;
  }
}

/* 小屏手机优化 (≤480px) */
@media (max-width: 480px) {
  .query-view {
    padding: 4px 0;
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }

  body,
  html {
    overflow-x: hidden;
    width: 100%;
  }

  .table-section {
    padding: 10px 4px;
    margin-bottom: 10px;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .table-section {
    padding: 8px 2px;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }

  .table-responsive {
    overflow-x: hidden;
    margin: 0;
    border-radius: 8px;
    width: 100%;
    max-width: 100%;
  }

  /* 表格边框优化 */
  .devices-table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
  }

  /* 统计卡片 - 小屏幕2列布局 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .stat-card {
    padding: 6px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-height: 55px;
    width: 100%;
    box-sizing: border-box;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
    flex-shrink: 0;
  }

  .stat-content {
    flex: 1;
    text-align: right;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 11px;
    line-height: 1.2;
  }

  /* 手机端隐藏在库数量卡片 */
  .stat-card.hide-on-mobile {
    display: none;
  }

  .action-buttons .btn {
    padding: 8px 12px;
    font-size: 11px;
  }

  /* 表格 */
  .devices-table {
    font-size: 13px;
    table-layout: fixed;
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .devices-table th,
  .devices-table td {
    padding: 10px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    line-height: 1.45;
    font-size: 13px;
  }

  .devices-table th:nth-child(1),
  .devices-table td:nth-child(1) {
    width: 35%;
    min-width: 80px;
    font-size: 13px;
    font-weight: 600;
  }

  .devices-table th:nth-child(2),
  .devices-table td:nth-child(2) {
    width: 20%;
    min-width: 55px;
    font-size: 13px;
  }

  .devices-table th:nth-child(3),
  .devices-table td:nth-child(3) {
    width: 18%;
    min-width: 55px;
    font-size: 13px;
  }

  .devices-table th:nth-child(4),
  .devices-table td:nth-child(4) {
    width: 27%;
    min-width: 75px;
    font-size: 13px;
    font-weight: 500;
  }

  .devices-table th,
  .devices-table td {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 分页 */
  .pagination {
    flex-wrap: wrap;
    justify-content: center;
  }

  .pagination button,
  .pagination select {
    font-size: 12px;
    padding: 6px 10px;
  }
}

/* 权限提示样式 */
.permission-denied-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
}

.permission-denied-content {
  background: white;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  max-width: 500px;
  width: 100%;
}

.permission-icon {
  font-size: 4rem;
  color: var(--danger-color);
  margin-bottom: 1.5rem;
  opacity: 0.8;
}

.permission-title {
  font-size: 1.5rem;
  color: var(--dark-color);
  margin-bottom: 1rem;
  font-weight: 600;
}

.permission-message {
  color: var(--secondary-color);
  font-size: 1.1rem;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.permission-suggestions {
  text-align: left;
  background: var(--light-bg);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border-left: 4px solid var(--primary-color);
}

.permission-suggestions h4 {
  color: var(--dark-color);
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.permission-suggestions ul {
  margin: 0;
  padding-left: 1.5rem;
}

.permission-suggestions li {
  color: var(--secondary-color);
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.permission-suggestions li:last-child {
  margin-bottom: 0;
}

.permission-denied-content .btn {
  min-width: 140px;
}

@media (max-width: 768px) {
  .permission-denied-container {
    padding: 1rem;
    min-height: 50vh;
  }

  .permission-denied-content {
    padding: 2rem 1.5rem;
  }

  .permission-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .permission-title {
    font-size: 1.3rem;
  }

  .permission-message {
    font-size: 1rem;
  }
}

/* 分页样式 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 6px 0;
  background: transparent;
  margin-top: 8px;
  width: 100%;
}

/* 快速出库模态框样式 */
.quick-sale-info {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #856404;
  font-size: 14px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title i {
  color: #1976d2;
}

/* 表格行样式 */
.data-row {
  transition: background-color 0.2s;
}

/* 移动端整行可点击 */
@media (max-width: 1024px) {
  .data-row {
    cursor: pointer;
  }

  .data-row:hover {
    background-color: #f5f7fa;
  }
}

/* PC端单元格可点击 */
@media (min-width: 1025px) {
  .clickable-cell {
    cursor: pointer;
  }

  .clickable-cell:hover {
    background-color: #f0f9ff;
  }

  /* 确保状态徽章不会阻止事件 */
  .clickable-cell .status-badge,
  .clickable-cell .condition-badge {
    pointer-events: none;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

</style>

<style>
/* 全局样式：禁止手机端页面左右滚动 */
@media (max-width: 480px) {
  * {
    -webkit-overflow-scrolling: touch !important;
  }

  body {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: fixed !important;
    touch-action: pan-y pinch-zoom !important;
  }

  html {
    overflow-x: hidden !important;
    width: 100% !important;
    position: fixed !important;
  }

  #app {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    height: 100vh !important;
    position: relative !important;
  }

  .query-view {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: relative !important;
  }

  /* 按钮文字显示控制 */
  .btn-text-desktop {
    display: none !important;
  }

  .btn-text-mobile {
    display: inline !important;
  }
}

/* 超小屏幕优化（375px及以下 - iPhone SE） */
@media (max-width: 375px) {
  .query-view {
    padding: 4px 0;
  }

  /* 统计卡片优化 */
  .stats-cards {
    gap: 4px;
  }

  .stat-card {
    padding: 10px;
    min-height: 60px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-label {
    font-size: 10px;
  }

  .form-group {
    min-width: calc(50% - 4px);
  }

  .form-group input,
  .form-group select {
    font-size: 13px;
    padding: 6px 8px;
  }

  /* 表格优化 */
  .table-container {
    border-radius: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    font-size: 11px;
  }

  th, td {
    padding: 6px 4px;
  }

  /* 分页组件优化 */
  .pagination {
    padding: 10px;
  }
}

/* 图片预览相关样式 */
.image-hint {
  margin-left: 4px;
  font-size: 12px;
  color: #409eff;
  opacity: 0.7;
}

.clickable-cell {
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f7fa;
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

  /* 图片网格 - 水平铺满 */
  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    width: 100%;
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.05);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .primary-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 100%);
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;

      i {
        margin-right: 4px;
      }
    }

    /* 拖拽手柄 */
    .drag-handle {
      position: absolute;
      top: 4px;
      left: 4px;
      width: 24px;
      height: 24px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 5;

      i {
        font-size: 12px;
        color: white;
      }
    }

    &:hover .drag-handle {
      opacity: 1;
    }

    /* 设置主图按钮 */
    .set-primary-btn {
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s;
      z-index: 5;

      i {
        font-size: 14px;
        color: #f56c6c;
      }

      &:hover {
        background: rgb(255, 255, 255);
        transform: scale(1.1);
      }
    }

    &:hover .set-primary-btn {
      opacity: 1;
    }

    /* 右上角删除按钮 */
    .image-delete-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 28px !important;
      height: 28px !important;
      min-width: 28px !important;
      padding: 0 !important;
      background: rgba(245, 108, 108, 0.9) !important;
      border: none !important;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 6;

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

  /* 模态框底部按钮 */
  .image-modal-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
  }
}

@media (max-width: 768px) {
  .image-preview-modal {
    .images-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
    }
  }
}

/* 图片预览容器 - 确保在所有内容之上，居中显示 */
.image-viewer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);

  :deep(.el-image-viewer__wrapper) {
    z-index: 2001;
  }

  /* 限制预览图片的默认大小 - 使用多个选择器确保生效 */
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
.el-image-viewer__img {
  max-width: 80vw !important;
  max-height: 80vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

.el-image-viewer__canvas img {
  max-width: 80vw !important;
  max-height: 80vh !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

/* 强制覆盖内联样式 - 只限制最大尺寸，不干扰 transform */
.el-image-viewer__wrapper .el-image-viewer__img[style] {
  max-width: 80vw !important;
  max-height: 80vh !important;
}
</style>
