<template>
  <div class="query-view admin-page safe-area-top safe-area-bottom">
    <!-- 无权限提示 -->
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="query_queryview"
      module-name="综合查询"
      permission-code="query:view"
    >
      <!-- 有权限时显示内容 -->
      <div class="view-content admin-page-content">
        <!-- 页面头部 - 使用公共组件 + 滚动动画 -->
        <div
          data-aos="fade-down"
          data-aos-duration="600"
        >
          <PageHeader
            icon="fas fa-search"
            title="综合查询"
          >
            <template #actions>
              <el-button
                v-if="canCreate"
                type="warning"
                title="快速出库"
                @click="openQuickSaleModal"
              >
                <i class="fas fa-bolt" />
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
                type="primary"
                title="快捷入库"
                @click="goToStockIn"
              >
                <i class="fas fa-plus-circle" />
                <span class="btn-text-desktop">采购入库</span>
                <span class="btn-text-mobile">入库</span>
              </el-button>
              <el-button
                type="success"
                title="快捷销售"
                @click="goToSales"
              >
                <i class="fas fa-shopping-cart" />
                <span class="btn-text-desktop">销售出库</span>
                <span class="btn-text-mobile">库存</span>
              </el-button>
              <el-button
                type="info"
                :disabled="refreshing"
                @click="handleRefresh"
              >
                <InlineLoading
                  v-if="refreshing"
                  text="刷新中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  <i class="fas fa-sync-alt" />
                  <span>刷新</span>
                </template>
              </el-button>
            </template>
          </PageHeader>
        </div>

        <div class="content admin-page-content">
          <!-- 统计卡片 + 滚动动画 -->
          <div
            v-show="showStatsCards"
            class="stats-cards"
          >
            <div
              v-for="(stat, index) in visibleStatsConfig"
              :key="index"
              :data-aos="'fade-up'"
              :data-aos-delay="index * 100"
              :data-stat-key="stat.key"
              class="stat-card"
            >
              <div
                class="stat-icon"
                :class="stat.iconClass"
              >
                <i :class="stat.icon" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  {{ statistics[stat.key] || 0 }}
                </div>
                <div class="stat-label">
                  {{ stat.label }}
                </div>
              </div>
            </div>
          </div>

          <UnifiedSearchPanel
            v-model:expanded="searchExpanded"
            data-aos="fade-up"
            data-aos-delay="400"
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
                  <i class="fas fa-search" />
                </template>
              </el-input>
            </template>

            <!-- 供应商 -->
            <div
              class="form-group filter-item"
              data-field="supplier"
            >
              <el-select
                v-model="filters.supplier_id"
                placeholder="供应商"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="store"
            >
              <el-select
                v-model="filters.store_id"
                placeholder="店铺"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="brand"
            >
              <el-select
                v-model="filters.brand"
                placeholder="品牌"
                filterable
                clearable
                @change="handleFilterBrandChange"
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
            <div
              class="form-group filter-item"
              data-field="model"
            >
              <el-select
                v-model="filters.model"
                placeholder="型号"
                filterable
                clearable
                :disabled="!filters.brand && options.models.length === 0"
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="color"
            >
              <el-select
                v-model="filters.color"
                placeholder="颜色"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="memory"
            >
              <el-select
                v-model="filters.memory"
                placeholder="内存"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="status"
            >
              <el-select
                v-model="filters.status"
                placeholder="状态"
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="condition"
            >
              <el-select
                v-model="filters.is_new"
                placeholder="机况"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="operator"
            >
              <el-select
                v-model="filters.sale_operator_id"
                placeholder="销售员"
                filterable
                clearable
                @change="triggerLoadQueryData"
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
            <div
              class="form-group filter-item"
              data-field="start_date"
            >
              <el-date-picker
                v-model="filters.start_date"
                type="date"
                placeholder="开始日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                clearable
                style="width: 140px"
                @change="triggerLoadQueryData"
              />
            </div>

            <!-- 结束日期 -->
            <div
              class="form-group filter-item"
              data-field="end_date"
            >
              <el-date-picker
                v-model="filters.end_date"
                type="date"
                placeholder="结束日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                clearable
                style="width: 140px"
                @change="triggerLoadQueryData"
              />
            </div>
          </UnifiedSearchPanel>

          <!-- 数据表格区域 -->
          <div class="table-section admin-panel admin-table-panel">
            <div class="section-title">
              <i class="fas fa-list" />
              综合销售列表
              <span class="record-count">共 {{ pagination.total }} 条记录</span>
            </div>

            <div class="table-responsive">
              <el-table
                :data="loading ? [] : queryData"
                border
                stripe
                class="data-table devices-table"
                table-layout="fixed"
                :fit="true"
                :row-key="getQueryRowKey"
                :row-class-name="getQueryRowClassName"
                @row-click="handleRowTap"
                @row-dblclick="handleRowDoubleClick"
              >
                <el-table-column
                  v-for="column in tableColumns"
                  :key="column.key"
                  :label="column.label"
                  :min-width="getQueryColumnMinWidth(column)"
                  :width="getQueryActionColumnWidth(column)"
                  align="center"
                  :class-name="getQueryColumnClass(column)"
                >
                  <template #default="{ row }">
                    <span
                      v-if="column.key === 'basic_info.serial_number'"
                      class="serial-imei-cell"
                    >
                      {{ getCellValue(row, column) }}
                    </span>

                    <span
                      v-else-if="column.key === 'basic_info.imei'"
                      class="serial-imei-cell"
                    >
                      {{ getCellValue(row, column) }}
                    </span>

                    <span
                      v-else-if="column.key === 'basic_info.is_new'"
                      :class="{ 'clickable-cell': Number(row.基本信息?.is_new) === 0 }"
                      @dblclick.stop="handleConditionDoubleClick(row)"
                    >
                      <span :class="['condition-badge', Number(row.基本信息?.is_new) === 1 ? 'new' : 'used']">
                        {{ getCellValue(row, column) }}
                      </span>
                      <i
                        v-if="Number(row.基本信息?.is_new) === 0 && row.基本信息?.has_images"
                        class="fas fa-images image-hint"
                      />
                    </span>

                    <span
                      v-else-if="column.key === 'basic_info.status'"
                      class="status-cell clickable-cell"
                      @dblclick.stop="handleCellDoubleClick(row, column)"
                    >
                      <span :class="['status-badge', getStatusBadgeClass(row.基本信息?.status_code)]">
                        {{ getCellValue(row, column) }}
                      </span>
                    </span>

                    <div
                      v-else-if="column.key === 'system_info.operations'"
                      class="actions-cell"
                    >
                      <div class="action-buttons">
                        <el-button
                          v-if="canEdit"
                          class="table-action table-action--edit"
                          type="primary"
                          size="small"
                          title="编辑"
                          @click.stop="openEditModal(row)"
                        >
                          <i class="fas fa-edit" />
                          编辑
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          class="table-action table-action--delete"
                          type="danger"
                          size="small"
                          title="删除"
                          @click.stop="deleteItem(row)"
                        >
                          <i class="fas fa-trash" />
                          删除
                        </el-button>
                        <el-button
                          v-if="canReturnToStock"
                          class="table-action table-action--warning"
                          type="warning"
                          size="small"
                          title="退库"
                          @click.stop="confirmReturnToStock(row)"
                        >
                          <i class="fas fa-undo-alt" />
                          退库
                        </el-button>
                      </div>
                    </div>

                    <span
                      v-else-if="column.key === 'other_info.remarks'"
                      class="remark-cell"
                      @dblclick="handleRemarkDoubleClick($event, row)"
                    >
                      {{ getCellValue(row, column) }}
                    </span>

                    <span
                      v-else-if="column.key === 'basic_info.purchase_cost' || column.key === 'basic_info.sale_price'"
                      class="price-cell"
                    >
                      {{ getCellValue(row, column) }}
                    </span>

                    <span v-else>
                      {{ getCellValue(row, column) }}
                    </span>
                  </template>
                </el-table-column>

                <template #empty>
                  <TableLoadingRow
                    v-if="loading"
                    mode="block"
                    text="加载中..."
                  />
                  <div
                    v-else
                    class="empty-cell"
                  >
                    <i class="fas fa-inbox" />
                    <span>暂无数据</span>
                  </div>
                </template>
              </el-table>
            </div>

            <!-- 分页组件 -->
            <Pagination
              v-if="pagination.total > 0"
              v-model:current="pagination.page"
              :page-size="pagination.page_size"
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
      </div>
    </PermissionGate>

    <!-- 快速出库模态框 -->
    <QuickSaleModal
      v-if="showQuickSaleModal"
      v-model="showQuickSaleModal"
      :options="editModalOptions"
      @success="handleQuickSaleSuccess"
    />

    <ReturnStockModal
      v-if="showReturnModal"
      v-model="showReturnModal"
      :device-info="selectedReturnDevice"
      @success="handleReturnStockSuccess"
    />

    <QueryEditModal
      v-if="showEditModal"
      v-model="showEditModal"
      :phone-id="selectedEditPhoneId"
      @success="handleEditSuccess"
    />

    <QueryDetailDialog
      v-if="showDetailModal"
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

        <div
          v-if="loadingImages"
          class="loading-images"
        >
          <InlineLoading text="加载图片中..." />
        </div>

        <div
          v-else-if="productImages.length === 0"
          class="no-images"
        >
          <i class="fas fa-image" />
          <p>暂无图片，点击下方"上传图片"按钮添加</p>
        </div>

        <div v-else>
          <draggable
            v-model="productImages"
            :animation="200"
            handle=".drag-handle"
            item-key="id"
            class="images-grid"
            @end="handleImageDragEnd"
          >
            <template #item="{ element: image, index }">
              <div
                class="image-item"
                @click="previewImage(image)"
              >
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
                  <i class="fas fa-grip-vertical" />
                </div>
                <!-- 主图标记 -->
                <div
                  v-if="image.is_primary"
                  class="primary-badge"
                >
                  <i class="fas fa-star" />
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
                  <i class="fas fa-trash" />
                </el-button>
                <!-- 设置主图按钮 -->
                <div
                  v-if="!image.is_primary"
                  class="set-primary-btn"
                  @click="setPrimaryImage(image)"
                >
                  <i class="fas fa-star" />
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
          >
          <el-button @click="handleCloseImageModal">
            关闭
          </el-button>
          <el-button
            v-if="productImages.length > 0"
            type="danger"
            plain
            :disabled="loadingImages || uploadingImage"
            @click="deleteAllImages"
          >
            <i class="fas fa-trash-alt" />
            删除全部
          </el-button>
          <el-button
            type="primary"
            :loading="uploadingImage"
            :disabled="loadingImages"
            @click="($refs.imageUploadInput as HTMLInputElement).click()"
          >
            <i class="fas fa-upload" />
            上传图片
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 大图预览 - 用 teleport 移到 body -->
    <teleport to="body">
      <div
        v-if="showImageViewer"
        class="image-viewer-mask"
        @click.self="closeImageViewer"
      >
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox, ElImageViewer } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagination } from '@/composables/index'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useLoadingState } from '@/composables'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { formatImageUrl } from '@/utils/format'
import { sortOptionsByOrder } from '@/utils/option-sort'
import {
  getAdaptiveActionColumnWidth,
  getIdentifierColumnMinWidth,
  getTextColumnMinWidth
} from '@/utils/table-layout'
import { createTempFileTracker, type TempFileTracker } from '@/utils/temp-file-cleaner'
import { canAccessRoutePath } from '@/constants/routePermissions'
import draggable from 'vuedraggable'
import Pagination from '../../components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import Image from '@/components/Image.vue'
import SalesReceipt from '@/components/query/SalesReceipt.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { refreshScrollAnimations } from '@/utils/scrollAnimation'
import { PHONE_STATUS_OPTIONS, getPhoneStatusClass, getPhoneStatusLabel } from '@/constants/phoneStatuses'
import { normalizeAppleId, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'

// 定义消息提示函数
const message = ElMessage
const QuickSaleModal = defineAsyncComponent(() => import('@/components/query/QuickSaleModal.vue'))
const QueryEditModal = defineAsyncComponent(() => import('@/components/query/QueryEditModal.vue'))
const QueryDetailDialog = defineAsyncComponent(() => import('@/components/query/QueryDetailDialog.vue'))
const ReturnStockModal = defineAsyncComponent(() => import('@/components/query/ReturnStockModal.vue'))

// 字段权限相关
import { fieldPermissions, shouldShowActionColumn } from '../../composables/useFieldPermissions'
// 时间处理工具
import { TimeUtil, TIME_FORMATS } from '../../utils/time'
import type { Brand, Color, MemoryOption, Model, QueryItem, ReturnDeviceInfo, QueryStatistics as Statistics, QueryOptions as Options } from '@/types'

// 使用 stores 和 composables
const router = useRouter()
const authStore = useAuthStore()
const { success, handleApiError } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport, hasPermission: hasQueryPagePermission, handleNoPermission } = usePagePermissions('query')
const { refreshing, refresh } = useRefreshData()
const canReturnToStock = computed(() => hasQueryPagePermission('return-to-stock'))
const { exportFile, buildDateFilename, sanitizeParams } = useImportExport()

const guardedPush = (target: string) => {
  if (!canAccessRoutePath(target, authStore)) {
    message.warning('您没有访问此页面的权限')
    return
  }

  router.push(target)
}

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

// Element Plus 表格不会在移动端可靠触发 dblclick，使用两次 row-click 模拟双击。
const handleRowTap = (item: QueryItem, _column: unknown, event: MouseEvent) => {
  if (windowWidth.value > 1024) return

  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea, .actions-cell')) return

  const rowKey = String(item.基本信息?.phone_id ?? item.基本信息?.imei ?? JSON.stringify(item))
  const now = Date.now()
  const lastTime = lastTapTime.value.get(rowKey) || 0
  const timeDiff = now - lastTime

  // 清除之前的定时器
  const existingTimer = touchTimers.value.get(rowKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
    touchTimers.value.delete(rowKey)
  }

  // 手机端点击事件可能略有延迟，400ms 内点击同一行视为双击。
  if (timeDiff <= 400 && timeDiff > 0) {
    // 双击触发
    handleRowDoubleClick(item)
    lastTapTime.value.delete(rowKey)
  } else {
    // 单击：等待可能的双击
    const timer = setTimeout(() => {
      // 超时后视为单击，可以做单击处理（如果需要）
      lastTapTime.value.delete(rowKey)
      touchTimers.value.delete(rowKey)
    }, 400)
    touchTimers.value.set(rowKey, timer)
  }

  lastTapTime.value.set(rowKey, now)
}

// 添加窗口大小监听
watch(() => windowWidth.value, () => {
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
  brands: [] as Brand[],
  models: [] as Model[],
  colors: [] as Color[],
  memories: [] as MemoryOption[],
  users: [] as any[]
})
const editModalOptionsLoaded = ref(false)
const editModalOptionsLoading = ref(false)
let editModalWarmupTimer: ReturnType<typeof setTimeout> | null = null
const employeesPromise = ref<Promise<any[]> | null>(null)

// 筛选条件
const filters = reactive({
  page: 1,
  page_size: 100,
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
  page_size: 100
})

const pagination = computed(() => ({
  page: paginationData.page.value,
  page_size: paginationData.page_size.value,
  total: paginationData.total.value,
  total_pages: Math.ceil(paginationData.total.value / paginationData.page_size.value) || 0
}))

// 解构出需要的属性和方法
const { setTotal, goToPage } = paginationData

// ==================== 数据排序辅助函数 ====================

// 对查询数据进行排序（接收映射后的数据）
const sortQueryData = (data: any[]): any[] => {
  if (!data || data.length === 0) return []
  return [...data]
}

const isGroupedQueryItem = (item: any): item is QueryItem => {
  return Boolean(
    item &&
    typeof item === 'object' &&
    (item.基本信息 || item.basic_info) &&
    (item.价格信息 || item.price_info) &&
    (item.时间信息 || item.time_info)
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
    const rawGrouped: any = item
    const rawPriceInfo = rawGrouped.价格信息 || rawGrouped.price_info || {}
    const rawTimeInfo = rawGrouped.时间信息 || rawGrouped.time_info || {}
    const canonicalPriceInfo = rawPriceInfo
    const canonicalTimeInfo = rawTimeInfo
    const groupedItem = {
      基本信息: rawGrouped.基本信息 || rawGrouped.basic_info,
      供应商信息: rawGrouped.供应商信息 || rawGrouped.supplier_info,
      店铺信息: rawGrouped.店铺信息 || rawGrouped.store_info,
      价格信息: {
        ...canonicalPriceInfo,
        purchase_cost: rawPriceInfo.purchase_cost
      },
      时间信息: {
        ...canonicalTimeInfo,
        inventory_time: rawTimeInfo.inventory_time,
        sale_time: rawTimeInfo.sale_time
      },
      客户信息: rawGrouped.客户信息 || rawGrouped.customer_info,
      操作员信息: rawGrouped.操作员信息 || rawGrouped.operator_info,
      销售信息: rawGrouped.销售信息 || rawGrouped.sale_info
    }
    const purchasePrice = groupedItem.价格信息?.purchase_cost === null || groupedItem.价格信息?.purchase_cost === undefined
      ? null
      : Number(groupedItem.价格信息.purchase_cost)
    const salePrice = groupedItem.价格信息?.sale_price === null || groupedItem.价格信息?.sale_price === undefined
      ? null
      : Number(groupedItem.价格信息.sale_price)
    const isNew = groupedItem.基本信息?.is_new

    return {
      ...groupedItem,
      基本信息: {
        ...groupedItem.基本信息,
        condition_type: groupedItem.基本信息?.condition_type || (isNew === 1 ? '全新' : '二手')
      },
      供应商信息: {
        ...(groupedItem.供应商信息 || {}),
        supplier_id: groupedItem.供应商信息?.supplier_id ?? null
      },
      店铺信息: {
        ...(groupedItem.店铺信息 || {}),
        store_id: groupedItem.店铺信息?.store_id ?? null,
        // 确保 store_name 不为 null 或空字符串
        store_name: groupedItem.店铺信息?.store_name || null
      },
      价格信息: {
        ...(groupedItem.价格信息 || {}),
        purchase_cost: purchasePrice,
        sale_price: salePrice,
        profit: groupedItem.价格信息?.profit ?? (
          salePrice === null || purchasePrice === null ? null : salePrice - purchasePrice
        )
      },
      时间信息: {
        ...(groupedItem.时间信息 || {}),
        sale_time: groupedItem.时间信息?.sale_time || null
      },
      客户信息: normalizeCustomerInfo(groupedItem.客户信息),
      操作员信息: {
        ...(groupedItem.操作员信息 || {}),
        operator_id: groupedItem.操作员信息?.operator_id ?? groupedItem.操作员信息?.sale_operator_id ?? null,
        sale_operator_id: groupedItem.操作员信息?.sale_operator_id ?? groupedItem.操作员信息?.operator_id ?? null,
        inventory_operator_id: groupedItem.操作员信息?.inventory_operator_id ?? null
      }
    }
  }

  const purchasePrice = item.purchase_cost === null || item.purchase_cost === undefined ? null : Number(item.purchase_cost)
  const salePrice = item.sale_price === null || item.sale_price === undefined ? null : Number(item.sale_price)
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
      sale_time: item.sale_time || ''
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
      purchase_cost: purchasePrice,
      sale_price: salePrice,
      profit: salePrice === null || purchasePrice === null ? null : salePrice - purchasePrice
    },
    时间信息: {
      inventory_time: item.inventory_time || item.created_at,
      sale_time: item.sale_time,
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

const loadQueryData = async (force = false, showLoadingState = true) => {
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

  if (showLoadingState) {
    loading.value = true
  }
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
    if (showLoadingState && requestId === latestQueryRequestId) {
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

    // 数据源不可用时保持空选项，避免把固定示例数据误当成数据库数据。
    options.value = {
      suppliers: [],
      stores: [],
      brands: [],
      models: [],
      colors: [],
      memories: [],
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
      const usersRes = await unifiedApi.get('/users/employees?page_size=10000')
      return usersRes.success && usersRes.data?.employees ? sortOptionsByOrder(usersRes.data.employees) : []
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
    // 并行调用 API，使用规范 page_size 获取基础选项。
    const [
      suppliersRes,
      storesRes,
      brandsRes,
      modelsRes,
      colorsRes,
      memoriesRes,
      usersRes
    ] = await Promise.all([
      unifiedApi.get('/suppliers?page_size=10000'),
      unifiedApi.get('/stores?all=true&page_size=10000'),
      unifiedApi.get('/brands?status=1&page_size=10000'),
      unifiedApi.get('/models?page_size=10000'),
      unifiedApi.get('/colors?page_size=10000'),
      unifiedApi.get('/memories?page_size=10000'),
      unifiedApi.get('/users/employees?page_size=10000')
    ])

    // 更新编辑模态框选项 - 按 sort_order 排序，相同时按 id 排序确保一致性
    // 供应商按 sort_order 排序，相同时按 id 排序
    editModalOptions.suppliers = suppliersRes.success && suppliersRes.data
      ? sortOptionsByOrder(suppliersRes.data || [])
      : []

    // 店铺数据
    editModalOptions.stores = storesRes.success ? sortOptionsByOrder(extractResponseData<any[]>(storesRes)) : []

    // 品牌按 sort_order 排序，相同时按 id 排序
    if (brandsRes.success) {
      editModalOptions.brands = sortOptionsByOrder(extractResponseData<Brand[]>(brandsRes))
    } else {
      editModalOptions.brands = []
    }

    // 型号按 sort_order 排序，相同时按 id 排序
    if (modelsRes.success) {
      editModalOptions.models = sortOptionsByOrder(extractResponseData<Model[]>(modelsRes))
    } else {
      editModalOptions.models = []
    }

    // 颜色按 sort_order 排序，相同时按 id 排序
    if (colorsRes.success) {
      editModalOptions.colors = sortOptionsByOrder(extractResponseData<Color[]>(colorsRes))
    } else {
      editModalOptions.colors = []
    }

    // 内存按 sort_order 排序，相同时按 id 排序确保一致性
    if (memoriesRes.success) {
      editModalOptions.memories = sortOptionsByOrder(extractResponseData<MemoryOption[]>(memoriesRes), { labelKeys: ['size', 'capacity', 'name'] })
    } else {
      editModalOptions.memories = []
    }

    // users接口返回 { employees, total, isAdmin } 结构，需要提取 employees 数组
    editModalOptions.users = usersRes.success && usersRes.data?.employees ? sortOptionsByOrder(usersRes.data.employees) : []
    editModalOptionsLoaded.value = true
    if (options.value.users.length === 0) {
      options.value.users = editModalOptions.users
    }
  } catch (error) {
    editModalOptions.suppliers = []
    editModalOptions.stores = []
    editModalOptions.brands = []
    editModalOptions.models = []
    editModalOptions.colors = []
    editModalOptions.memories = []
    editModalOptions.users = []
    handleApiError(error, '加载快速出库选项失败')
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
    guardedPush('/inventory?openStockIn=true')
  } catch (error) {
    logger.error('跳转到采购入库页面失败:', error)
    message.error('跳转失败，请手动访问采购入库页面')
  }
}

// 快捷跳转到销售出库页面
const goToSales = () => {
  try {
    // 在当前标签页跳转
    guardedPush('/sales')
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
  filters.page_size = pageSize
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
    page_size: 100,
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
      loadQueryData(true, false),
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
const formatPrice = (price?: number | null) => {
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

      await unifiedApi.post('/shop/upload-phone-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // 上传接口已立即写入图片记录，不作为未保存的临时文件清理。
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
    const image_ids = productImages.value.map(img => img.id)
    await unifiedApi.put(`/shop/products/${selectedPhoneId.value}/images/reorder`, { image_ids })
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
  case 'time_info.inventory_time':
    return formatDate(item.时间信息?.inventory_time)
  case 'time_info.sale_time':
    return formatDate(item.时间信息?.sale_time)
  case 'basic_info.brand':
    return item.基本信息?.brand || '-'
  case 'basic_info.model':
    return item.基本信息?.model || '-'
  case 'basic_info.color':
    return item.基本信息?.color || '-'
  case 'basic_info.memory':
    return item.基本信息?.memory || '-'
  case 'basic_info.purchase_cost':
    return formatPrice(item.价格信息?.purchase_cost)
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

const handleRemarkDoubleClick = (event: MouseEvent, item: QueryItem) => {
  if (windowWidth.value <= 1024) return
  event.stopPropagation()

  const remarks = String(
    item.基本信息?.remarks || (item as any).销售信息?.sale_remarks || ''
  ).trim()
  if (!remarks) {
    ElMessage.info('暂无备注')
    return
  }

  void ElMessageBox.alert(remarks, '备注详情', {
    confirmButtonText: '关闭',
    closeOnClickModal: true,
    customClass: 'message-box-unified query-remark-message-box'
  }).catch(() => undefined)
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
const handleCellDoubleClick = (item: QueryItem, _column: unknown) => {
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
    purchasePrice: priceInfo.purchase_cost || 0,
    salePrice: priceInfo.sale_price || 0,
    // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
    isNew: basicInfo.is_new !== undefined ? basicInfo.is_new : 1,
    purchaseDate: timeInfo.inventory_time || '',
    // 销售日期用于多商品时单独显示 - 确保不为空字符串
    saleDate: timeInfo.sale_time && timeInfo.sale_time.trim() !== '' ? timeInfo.sale_time : undefined,
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
  receiptSaleDate.value = timeInfo.sale_time || ''
  receiptPurchaseDate.value = timeInfo.inventory_time || ''

  showReceipt.value = true
}

// 为选中项打开销售单
const _openSelectedReceipt = () => {
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
  receiptSaleDate.value = timeInfo.sale_time || ''
  receiptPurchaseDate.value = timeInfo.inventory_time || ''

  // 构建商品列表
  receiptItems.value = selectedItems.value.map(item => {
    const basic = item.基本信息 || {} as QueryItem['基本信息']
    const price = item.价格信息 || {} as QueryItem['价格信息']
    const timeInfo = item.时间信息 || {} as QueryItem['时间信息']
    const storeInfo = item.店铺信息 || {} as QueryItem['店铺信息']
    return {
      phone_id: basic.phone_id,
      brand: basic.brand || '',
      model: basic.model || '',
      color: basic.color || '',
      memory: basic.memory || '',
      imei: basic.imei || '',
      serialNumber: basic.serial_number || '',
      purchasePrice: price.purchase_cost || 0,
      salePrice: price.sale_price || 0,
      // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
      isNew: basic.is_new !== undefined ? basic.is_new : 1,
      purchaseDate: timeInfo.inventory_time || '',
      // 销售日期：多商品时每个商品单独显示 - 确保不为空字符串
      saleDate: timeInfo.sale_time && timeInfo.sale_time.trim() !== '' ? timeInfo.sale_time : undefined,
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
        customClass: 'message-box-unified'
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
    purchasePrice: Number(item.purchase_cost || 0),
    salePrice: Number(item.sale_price || item.price || 0),
    // 正确处理 is_new 字段：0=二手，1=全新，undefined 默认为全新
    isNew: item.is_new !== undefined ? item.is_new : 1,
    purchaseDate: item.inventory_time || '',
    // 添加销售时间和店铺信息 - 确保不为空字符串
    saleDate: item.sale_time ? item.sale_time.trim() || undefined : undefined,
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
  return statsConfig.filter(stat => (
    shouldShowField(stat.fieldId) &&
    (windowWidth.value > 768 || stat.key !== 'in_stock_count')
  ))
})

const showStatsCards = computed(() => visibleStatsConfig.value.length > 0)

const refreshQueryAnimations = async () => {
  await nextTick()
  refreshScrollAnimations()
}

const hasVisibleQueryActions = computed(() => (
  canEdit.value || canDelete.value || canReturnToStock.value
))

// 根据字段权限生成动态列
const tableColumns = computed(() => {
  const width = windowWidth.value

  // 定义所有列
  const allColumns = [
    { key: 'supplier_info.supplier_name', label: '供应商', field: '供应商信息', prop: 'supplier_name' },
    { key: 'store_info.store_name', label: '店铺', field: '店铺信息', prop: 'store_name' },
    { key: 'time_info.inventory_time', label: '入库时间', field: '时间信息', prop: 'inventory_time' },
    { key: 'time_info.sale_time', label: '销售时间', field: '时间信息', prop: 'sale_time' },
    { key: 'basic_info.brand', label: '品牌', field: '基本信息', prop: 'brand' },
    { key: 'basic_info.model', label: '型号', field: '基本信息', prop: 'model' },
    { key: 'basic_info.color', label: '颜色', field: '基本信息', prop: 'color' },
    { key: 'basic_info.memory', label: '内存', field: '基本信息', prop: 'memory' },
    { key: 'basic_info.purchase_cost', label: '入库价格', field: '价格信息', prop: 'purchase_cost' },
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
      'basic_info.purchase_cost',
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
  const filteredColumns = allColumns.filter(column => (
    column.key === 'system_info.operations'
      ? shouldShowActionColumn(shouldShowField(column.key), [hasVisibleQueryActions.value])
      : shouldShowField(column.key)
  ))
  return filteredColumns
})

const queryColumnWidths: Record<string, number> = {
  'supplier_info.supplier_name': 84,
  'store_info.store_name': 64,
  'time_info.inventory_time': 88,
  'time_info.sale_time': 88,
  'basic_info.brand': 48,
  'basic_info.model': 74,
  'basic_info.color': 48,
  'basic_info.memory': 64,
  'basic_info.purchase_cost': 68,
  'basic_info.sale_price': 68,
  'customer_info.customer_name': 72,
  'customer_info.customer_phone': 108,
  'basic_info.serial_number': 120,
  'basic_info.imei': 124,
  'other_info.remarks': 88,
  'customer_info.apple_id': 180,
  'operator_info.inventory_operator': 64,
  'operator_info.sale_operator': 64,
  'basic_info.is_new': 50,
  'basic_info.status': 50
}

const getQueryColumnMinWidth = (column: any) => {
  if (column.key === 'system_info.operations') {
    return undefined
  }

  const values = [column.label, ...queryData.value.map(item => getCellValue(item, column))]

  if (column.key === 'basic_info.serial_number') {
    return getIdentifierColumnMinWidth(
      values,
      { minWidth: queryColumnWidths[column.key], horizontalPadding: 24 }
    )
  }

  if (column.key === 'basic_info.imei') {
    return getIdentifierColumnMinWidth(
      values,
      { minWidth: queryColumnWidths[column.key], horizontalPadding: 24 }
    )
  }

  if (column.key === 'other_info.remarks') {
    return getTextColumnMinWidth(values, {
      minWidth: queryColumnWidths[column.key],
      maxWidth: 144,
      horizontalPadding: 20
    })
  }

  if (column.key === 'basic_info.model') {
    return getTextColumnMinWidth(values, {
      minWidth: queryColumnWidths[column.key],
      horizontalPadding: 16,
      asciiCharacterWidth: 7
    })
  }

  if (column.key === 'basic_info.is_new' || column.key === 'basic_info.status') {
    return getTextColumnMinWidth(values, {
      minWidth: queryColumnWidths[column.key],
      horizontalPadding: 44
    })
  }

  return getTextColumnMinWidth(values, {
    minWidth: queryColumnWidths[column.key] || 72,
    horizontalPadding: 20
  })
}

const queryActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  queryData.value,
  [canEdit.value, canDelete.value, canReturnToStock.value]
))

const getQueryActionColumnWidth = (column: any) => (
  column.key === 'system_info.operations' ? queryActionColumnWidth.value : undefined
)

const getQueryColumnClass = (column: any) => {
  if (column.key === 'basic_info.serial_number' || column.key === 'basic_info.imei') {
    return 'identifier-column serial-imei-column'
  }

  if (column.key === 'basic_info.purchase_cost' || column.key === 'basic_info.sale_price') {
    return 'complete-text-column price-column'
  }

  if (column.key === 'other_info.remarks') {
    return 'ellipsis-text-column remark-column'
  }

  if (column.key === 'system_info.operations') {
    return 'complete-text-column actions-column'
  }

  return 'complete-text-column'
}

const getQueryRowKey = (row: QueryItem) => String(
  row.基本信息?.phone_id ?? row.基本信息?.imei ?? JSON.stringify(row)
)

const getQueryRowClassName = ({ rowIndex }: { rowIndex: number }) => `data-row query-row-${rowIndex}`

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
  background: var(--tf-color-surface);
  min-height: 100vh;
}

/* 按钮文字显示控制 - 默认显示桌面版文字 */
:deep(.btn-text-mobile) {
  display: none;
}

:deep(.btn-text-desktop) {
  display: inline;
}

/* 选中统计栏样式 */
.selected-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
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
  color: var(--tf-color-gold);
}

.summary-info .profit {
  color: var(--color-success);
}

.summary-actions {
  display: flex;
  gap: 8px;
}

/* 复选框列样式 */
.checkbox-column {
  width: 50px;
  text-align: center;
}

.checkbox-column :deep(.el-checkbox) {
  margin: 0;
}

/* 编辑模态框的表单组样式 */
.edit-form .form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--color-text-regular);
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

.stat-card {
  background: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  border: 1px solid var(--tf-color-border-cool);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);
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
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
}

.stat-icon.in-stock {
  background: linear-gradient(135deg, var(--success-color), var(--tf-color-teal-500));
}

.stat-icon.sold {
  background: linear-gradient(135deg, var(--warning-color), var(--tf-color-orange-bootstrap));
}

.stat-icon.new {
  background: linear-gradient(135deg, var(--success-color), var(--tf-color-teal-500));
}

.stat-icon.used {
  background: linear-gradient(135deg, var(--tf-color-orange-bootstrap), var(--danger-color));
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--tf-color-heading);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--tf-color-muted);
  font-weight: 500;
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
  color: var(--success-color);
}

.condition-badge.used {
  background: rgba(253, 126, 20, 0.1);
  color: var(--tf-color-orange-bootstrap);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* 可售 - 绿色 */
.status-badge.in-stock {
  background: var(--tf-status-sale-available-bg);
  color: var(--tf-status-sale-available-color);
  border-color: var(--tf-status-sale-available-border);
}

/* 已售 - 绿色 */
.status-badge.sold {
  background: var(--tf-status-sold-bg);
  color: var(--tf-status-sold-color);
  border-color: var(--tf-status-sold-border);
}

/* 调货 - 蓝色 */
.status-badge.peer-transfer {
  background: var(--tf-status-transfer-bg);
  color: var(--tf-status-transfer-color);
  border-color: var(--tf-status-transfer-border);
}

/* 划拨 - 紫色 */
.status-badge.supplier-proxy {
  background: var(--tf-status-allocation-bg);
  color: var(--tf-status-allocation-color);
  border-color: var(--tf-status-allocation-border);
}

/* 预定 - 青色 */
.status-badge.reserved {
  background: var(--tf-status-reserved-bg);
  color: var(--tf-status-reserved-color);
  border-color: var(--tf-status-reserved-border);
}

/* 维修 - 橙色 */
.status-badge.repair {
  background: var(--tf-status-repair-bg);
  color: var(--tf-status-repair-color);
  border-color: var(--tf-status-repair-border);
}

/* 丢失 - 红色 */
.status-badge.lost {
  background: var(--tf-status-lost-bg);
  color: var(--tf-status-lost-color);
  border-color: var(--tf-status-lost-border);
}

.status-badge.returned {
  background: var(--tf-status-returned-bg);
  color: var(--tf-status-returned-color);
  border-color: var(--tf-status-returned-border);
}

.status-badge.damaged {
  background: var(--tf-status-damaged-bg);
  color: var(--tf-status-damaged-color);
  border-color: var(--tf-status-damaged-border);
}

.price-cell {
  font-weight: 600;
  color: var(--tf-color-red-legacy);
}

/* 序列号和IMEI列统一样式 - 灰色、斜体 */
.serial-imei-cell {
  font-weight: 500;
  color: var(--tf-color-muted);
  font-style: italic;
}

.positive {
  color: var(--success-color);
}

.negative {
  color: var(--danger-color);
}

.zero {
  color: var(--tf-color-muted);
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 40px;
  color: var(--tf-color-muted);
}

.loading-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--tf-color-border-cool);
}

.pagination-info {
  color: var(--tf-color-muted);
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
  color: var(--text-primary);
  font-size: 14px;
}

.return-form .form-label.required,
.form-label.required {
  position: relative;
}

.return-form .form-label.required::after,
.form-label.required::after {
  content: " *";
  color: var(--tf-color-red-chakra);
}

.return-form .form-control,
.form-control {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--tf-color-slate-200);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  box-sizing: border-box;
}

.return-form .form-control:focus,
.form-control:focus {
  outline: none;
  border-color: var(--tf-color-indigo-brand);
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
  color: var(--tf-color-gray-chakra-500);
  font-size: 14px;
  z-index: 2;
  pointer-events: none;
}

/* 设备信息区域样式 - 表格设计 */
.device-info-section {
  background: var(--color-bg-white);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid var(--tf-color-neutral-200);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.device-info-section .section-title {
  font-weight: 600;
  color: var(--tf-color-neutral-700);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.device-info-section .section-title i {
  color: var(--tf-color-indigo-500);
  font-size: 16px;
}

/* 设备信息表格样式 */
.device-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.device-info-table tbody tr {
  border-bottom: 1px solid var(--tf-color-neutral-100);
  transition: background-color 0.15s ease;
}

.device-info-table tbody tr:last-child {
  border-bottom: none;
}

.device-info-table tbody tr:hover {
  background-color: var(--tf-color-neutral-50);
}

.device-info-table tbody tr.highlight-row {
  background-color: var(--tf-color-slate-50);
  font-weight: 500;
}

.device-info-table tbody tr.highlight-row:hover {
  background-color: var(--tf-color-slate-100);
}

.device-info-table .label-cell {
  padding: 12px 16px;
  color: var(--tf-color-neutral-500);
  font-weight: 500;
  width: 15%;
  white-space: nowrap;
}

.device-info-table .value-cell {
  padding: 12px 16px;
  color: var(--tf-color-neutral-900);
  font-weight: 600;
  width: 35%;
}

.device-info-table .imei-code {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--color-bg-white);
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
  background: var(--tf-color-emerald-100);
  color: var(--tf-color-emerald-800);
}

.badge-used {
  background: var(--tf-color-amber-100);
  color: var(--tf-color-amber-800);
}

/* 退库信息区域样式 */
.return-info-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid var(--tf-color-slate-200);
}

.return-info-section .section-title {
  font-weight: 600;
  color: var(--tf-color-gray-chakra-600);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--tf-color-pink-gradient);
}

/* 表单按钮组样式 */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid var(--tf-color-slate-200);
  margin-top: 20px;
}

.form-actions .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  border-bottom: 1px solid var(--tf-color-neutral-100);
  transition: background-color 0.15s ease;
}

.device-info-table tbody tr:last-child {
  border-bottom: none;
}

.device-info-table tbody tr:hover {
  background-color: var(--tf-color-neutral-50);
}

.device-info-table tbody tr.highlight-row {
  background-color: var(--tf-color-slate-50);
  font-weight: 500;
}

.device-info-table tbody tr.highlight-row:hover {
  background-color: var(--tf-color-slate-100);
}

.device-info-table .label-cell {
  padding: 12px 16px;
  color: var(--tf-color-neutral-500);
  font-weight: 500;
  width: 15%;
  white-space: nowrap;
}

.device-info-table .value-cell {
  padding: 12px 16px;
  color: var(--tf-color-neutral-900);
  font-weight: 600;
  width: 35%;
}

.device-info-table .imei-code {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--color-bg-white);
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
  background: var(--tf-color-emerald-100);
  color: var(--tf-color-emerald-800);
}

.badge-used {
  background: var(--tf-color-amber-100);
  color: var(--tf-color-amber-800);
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
    border-bottom: 1px solid var(--tf-color-neutral-200);
    padding: 12px 0;
  }

  .device-info-table .label-cell,
  .device-info-table .value-cell {
    display: block;
    width: 100%;
    padding: 6px 0;
  }

  .device-info-table .label-cell {
    color: var(--tf-color-neutral-400);
    font-size: 12px;
  }

  .device-info-table .value-cell {
    color: var(--tf-color-neutral-900);
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
  border-top: 1px solid var(--tf-color-slate-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--tf-color-slate-50);
  border-radius: 0 0 12px 12px;
}

.modal-footer .warning-text {
  color: var(--tf-color-gray-chakra-500);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-footer .warning-text i {
  color: var(--tf-color-amber-500);
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
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
}

.edit-form input.form-control:focus,
.edit-form select.form-control:focus,
.edit-form textarea.form-control:focus {
  border-color: var(--color-primary);
  outline: none;
}

/* 全宽字段 */
.full-width {
  grid-column: 1 / -1;
}

/* 手机端优化 (≤768px) */
@media (max-width: 768px) {
  .query-view.admin-page .stats-cards .stat-card[data-stat-key='in_stock_count'] {
    display: none !important;
  }

  .table-responsive::-webkit-scrollbar {
    display: none;
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
    overflow: hidden;
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
  background: var(--tf-color-warning-legacy);
  border: 1px solid var(--warning-color);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tf-color-warning-text-legacy);
  font-size: 14px;
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
    background-color: var(--tf-color-surface);
  }
}

/* PC端单元格可点击 */
@media (min-width: 1025px) {
  .clickable-cell {
    cursor: pointer;
  }

  .clickable-cell:hover {
    background-color: var(--tf-color-blue-50);
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
  color: var(--color-primary);
  opacity: 0.7;
}

.clickable-cell {
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--tf-color-surface);
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
    background: var(--tf-color-surface-soft);
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
      background: linear-gradient(135deg, var(--tf-color-accent-orange) 0%, var(--tf-color-orange-dark) 100%);
      color: var(--color-bg-white);
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
      background: var(--tf-button-overlay-bg);
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
        color: var(--tf-button-danger-soft-color);
      }

      &:hover {
        background: var(--tf-button-overlay-hover-bg);
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
      background: var(--tf-button-danger-bg) !important;
      border: none !important;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 6;

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

.remark-cell {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.query-remark-message-box {
  width: min(520px, calc(100vw - 32px)) !important;
}

.query-remark-message-box .el-message-box__message {
  max-height: 60vh;
  overflow-y: auto;
}

.query-remark-message-box .el-message-box__message p {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
