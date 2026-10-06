<template>
  <div class="subsidy-view admin-page safe-area-top">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="subsidy"
      module-name="国补管理"
      permission-code="subsidy:view"
    >
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader
        icon="fas fa-hand-holding-usd"
        title="国补管理"
      >
        <template #actions>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="exportingSubsidy"
            export-label="导出"
            export-loading-label="导出中..."
            export-icon-class="fas fa-file-excel"
            export-type="success"
            @export="handleExportSubsidy"
          />
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openApplyDialog"
          >
            <i class="fas fa-plus" />
            <span>新增</span>
          </el-button>
          <el-button
            type="info"
            :loading="refreshing"
            :disabled="refreshing"
            title="刷新数据"
            @click="handleRefresh"
          >
            <i class="fas fa-sync-alt" />
            <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
        <!-- 统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewField('stats_total_and_handler')"
            class="stat-card stat-card--warning"
          >
            <div class="stat-card__glow" />
            <div class="stat-card__head stat-card__head--with-progress">
              <div class="stat-card__icon">
                <i class="fas fa-layer-group" />
              </div>
              <div class="stat-card__head-copy">
                <div class="stat-card__eyebrow">
                  办理
                </div>
                <div class="stat-card__title">
                  总单数
                </div>
              </div>
              <div
                class="stat-card__head-progress"
                aria-hidden="true"
              >
                <div
                  class="stat-card__head-progress-fill"
                  :style="{ width: `${handlerRate}%` }"
                />
              </div>
              <div class="stat-card__badge">
                代办 {{ stats.handler_count || 0 }}
              </div>
            </div>
            <div class="stat-card__body-row">
              <div class="stat-card__value-row">
                <div class="stat-card__value">
                  {{ stats.total_count || 0 }}
                </div>
                <div class="stat-card__value-unit">
                  单
                </div>
              </div>
              <div class="stat-progress stat-progress--mobile-only">
                <div class="stat-progress__track">
                  <div
                    class="stat-progress__fill"
                    :style="{ width: `${handlerRate}%` }"
                  />
                </div>
                <div class="stat-progress__meta">
                  <span>代办 {{ handlerRate }}%</span>
                  <span>共 {{ stats.total_count || 0 }} 单</span>
                </div>
              </div>
              <div class="stat-card__facts">
                <div class="stat-fact">
                  <span>待审</span><strong>{{ stats.pending_count || 0 }}</strong>
                </div>
                <div class="stat-fact">
                  <span>代办</span><strong>{{ stats.handler_count || 0 }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_approval_progress')"
            class="stat-card stat-card--info"
          >
            <div class="stat-card__glow" />
            <div class="stat-card__head stat-card__head--with-progress">
              <div class="stat-card__icon">
                <i class="fas fa-stamp" />
              </div>
              <div class="stat-card__head-copy">
                <div class="stat-card__eyebrow">
                  审批
                </div>
                <div class="stat-card__title">
                  已审批
                </div>
              </div>
              <div
                class="stat-card__head-progress"
                aria-hidden="true"
              >
                <div
                  class="stat-card__head-progress-fill"
                  :style="{ width: `${approvalRate}%` }"
                />
              </div>
              <div class="stat-card__badge">
                {{ approvalRate }}%
              </div>
            </div>
            <div class="stat-card__body-row">
              <div class="stat-card__value-row">
                <div class="stat-card__value">
                  {{ stats.completed_count || 0 }}
                </div>
                <div class="stat-card__value-unit">
                  单
                </div>
              </div>
              <div class="stat-progress stat-progress--mobile-only">
                <div class="stat-progress__track">
                  <div
                    class="stat-progress__fill"
                    :style="{ width: `${approvalRate}%` }"
                  />
                </div>
                <div class="stat-progress__meta">
                  <span>完成 {{ approvalRate }}%</span>
                  <span>待 {{ stats.pending_count || 0 }}</span>
                </div>
              </div>
              <div class="stat-card__facts">
                <div class="stat-fact">
                  <span>已审</span><strong>{{ stats.completed_count || 0 }}</strong>
                </div>
                <div class="stat-fact">
                  <span>待审</span><strong>{{ stats.pending_count || 0 }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_amount_progress')"
            class="stat-card stat-card--income"
          >
            <div class="stat-card__glow" />
            <div class="stat-card__head stat-card__head--with-progress">
              <div class="stat-card__icon">
                <i class="fas fa-wallet" />
              </div>
              <div class="stat-card__head-copy">
                <div class="stat-card__eyebrow">
                  到账
                </div>
                <div class="stat-card__title">
                  已到账
                </div>
              </div>
              <div
                class="stat-card__head-progress"
                aria-hidden="true"
              >
                <div
                  class="stat-card__head-progress-fill"
                  :style="{ width: `${arrivalRate}%` }"
                />
              </div>
              <div class="stat-card__badge">
                {{ arrivalRate }}%
              </div>
            </div>
            <div class="stat-card__body-row">
              <div class="stat-card__value-row stat-card__value-row--money">
                <div class="stat-card__value">
                  ¥{{ formatAmount(stats.total_arrived_amount || 0) }}
                </div>
              </div>
              <div class="stat-progress stat-progress--mobile-only">
                <div class="stat-progress__track">
                  <div
                    class="stat-progress__fill"
                    :style="{ width: `${arrivalRate}%` }"
                  />
                </div>
                <div class="stat-progress__meta">
                  <span>到账 {{ arrivalRate }}%</span>
                  <span>待 ¥{{ formatAmount(pendingArrivalAmount) }}</span>
                </div>
              </div>
              <div class="stat-card__facts stat-card__facts--money">
                <div class="stat-fact">
                  <span>应到</span><strong>¥{{ formatAmount(stats.total_subsidy_amount || 0) }}</strong>
                </div>
                <div class="stat-fact">
                  <span>待到</span><strong>¥{{ formatAmount(pendingArrivalAmount) }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_store_overview')"
            class="stat-card stat-card--accent"
          >
            <div class="stat-card__glow" />
            <div class="stat-card__head stat-card__head--with-progress">
              <div class="stat-card__icon">
                <i class="fas fa-store" />
              </div>
              <div class="stat-card__head-copy">
                <div class="stat-card__eyebrow">
                  店铺
                </div>
                <div class="stat-card__title">
                  参与店铺
                </div>
              </div>
              <div
                class="stat-card__head-progress"
                aria-hidden="true"
              >
                <div
                  class="stat-card__head-progress-fill"
                  :style="{ width: `${topStoreRate}%` }"
                />
              </div>
              <div class="stat-card__badge">
                TOP
              </div>
            </div>
            <div class="stat-card__body-row">
              <div class="stat-card__value-row">
                <div class="stat-card__value">
                  {{ stats.store_stats?.length || 0 }}
                </div>
                <div class="stat-card__value-unit">
                  家
                </div>
              </div>
              <div class="stat-progress stat-progress--mobile-only">
                <div class="stat-progress__track">
                  <div
                    class="stat-progress__fill"
                    :style="{ width: `${topStoreRate}%` }"
                  />
                </div>
                <div class="stat-progress__meta">
                  <span>TOP店铺 {{ topStoreRate }}%</span>
                  <span>共 {{ stats.store_stats?.length || 0 }} 家</span>
                </div>
              </div>
              <div class="store-pill-list store-pill-list--compact">
                <template v-if="stats.store_stats && stats.store_stats.length > 0">
                  <div
                    v-for="store in topStores.slice(0, 2)"
                    :key="store.store_id"
                    class="store-pill"
                  >
                    <span class="store-pill__name">{{ store.store_name || '未知店铺' }}</span>
                    <strong class="store-pill__value">{{ store.total_count || 0 }}单</strong>
                  </div>
                </template>
                <div
                  v-else
                  class="store-pill store-pill--empty"
                >
                  <span class="store-pill__name">暂无店铺数据</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="loading"
          :auto-reset-pagination="false"
          @search="handleSearch"
          @reset="resetFilters"
        >
          <template #primary>
            <el-input
              v-if="searchableFieldLabels.length > 0"
              v-model="filters.search"
              :placeholder="searchPlaceholder"
              clearable
              @input="debounceSearch"
              @keyup.enter="handleSearch"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            v-if="canViewField('status')"
            class="form-group filter-item"
            data-field="approval_status"
          >
            <el-select
              v-model="filters.approval_status"
              placeholder="审批状态"
              clearable
              @change="handleSearch"
            >
              <el-option
                label="未审批"
                value="pending"
              />
              <el-option
                label="已审批"
                value="approved"
              />
            </el-select>
          </div>

          <div
            v-if="canViewField('status')"
            class="form-group filter-item"
            data-field="arrival_status"
          >
            <el-select
              v-model="filters.arrival_status"
              placeholder="到账状态"
              clearable
              @change="handleSearch"
            >
              <el-option
                label="未到账"
                value="unarrived"
              />
              <el-option
                label="已到账"
                value="arrived"
              />
            </el-select>
          </div>

          <div
            v-if="canViewField('store_name')"
            class="form-group filter-item"
            data-field="store_name"
          >
            <el-select
              v-model="filters.store_id"
              placeholder="店铺"
              clearable
              filterable
              @change="handleSearch"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </div>

          <div
            v-if="canViewField('sale_time')"
            class="form-group filter-item filter-item--date-range"
            data-field="sale_time"
          >
            <DateRangePicker
              v-model="saleDateRange"
              start-placeholder="销售开始"
              end-placeholder="销售结束"
              :format="TIME_FORMATS.DATE"
              :value-format="TIME_FORMATS.DATE"
              clearable
              @change="handleSaleDateChange"
            />
          </div>

          <div
            v-if="canViewField('apply_time')"
            class="form-group filter-item filter-item--date-range"
            data-field="apply_time"
          >
            <DateRangePicker
              v-model="submitDateRange"
              start-placeholder="提交开始"
              end-placeholder="提交结束"
              :format="TIME_FORMATS.DATE"
              :value-format="TIME_FORMATS.DATE"
              clearable
              @change="handleSubmitDateChange"
            />
          </div>

          <!-- 到账时间 -->
          <div
            v-if="canViewField('arrival_time')"
            class="form-group filter-item filter-item--date-range"
            data-field="arrival_time"
          >
            <DateRangePicker
              v-model="arriveDateRange"
              start-placeholder="到账开始"
              end-placeholder="到账结束"
              :format="TIME_FORMATS.DATE"
              :value-format="TIME_FORMATS.DATE"
              clearable
              @change="handleArriveDateChange"
            />
          </div>
        </UnifiedSearchPanel>

        <SubsidyListSection
          :loading="loading"
          :subsidy-list="subsidyList"
          :display-list="displayList"
          :table-columns="tableColumns"
          :field-visibility="fieldVisibility"
          :is-mobile="isMobile"
          :selected-items="selectedItems"
          :pinned-items="pinnedItems"
          :subsidy-pagination="subsidyPagination"
          :can-approve="canApprove"
          :can-arrival="canArrival"
          :can-upload="canUpload"
          :can-edit="canEdit"
          :can-delete="canDelete"
          :can-show-actions="canShowActions"
          :can-view-customer-idcard="canViewCustomerIdcard"
          :select-all="selectAll"
          :is-indeterminate="isIndeterminate"
          @select-all="handleSelectAll"
          @select-item="({ id, checked }) => handleSelectItem(id, checked)"
          @row-double-click="handleRowDoubleClick"
          @pin-selected-items="pinSelectedItems"
          @clear-pinned-items="clearPinnedItems"
          @open-batch-dialog="openBatchDialog"
          @clear-selection="clearSelection"
          @open-photo-manage="openPhotoManageDialog"
          @audit="handleAudit"
          @confirm-arrival="handleConfirmArrival"
          @edit="handleEdit"
          @delete="handleDelete"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>

      <!-- 批量修改时间对话框 -->
      <MobileDialog
        v-model="showBatchDialog"
        title="批量修改时间"
        width="560px"
        dialog-class="subsidy-dialog subsidy-batch-dialog"
        :show-default-footer="false"
        destroy-on-close
      >
        <div
          v-if="showBatchDialog"
          class="modal-body"
        >
          <div class="batch-info-summary">
            <i class="fas fa-thumbtack" />
            <span>将对 <strong>{{ selectedItems.length }}</strong> 条选中记录进行修改</span>
          </div>

          <el-form class="batch-form">
            <div class="batch-form-grid">
              <div
                v-if="canApprove"
                class="batch-form-inline-item"
              >
                <span class="batch-form-label">审批时间</span>
                <el-date-picker
                  v-model="batchForm.apply_time"
                  type="date"
                  placeholder="请选择"
                  :format="TIME_FORMATS.DATE"
                  :value-format="TIME_FORMATS.DATE"
                  clearable
                  class="batch-date-picker"
                />
              </div>

              <div
                v-if="canArrival"
                class="batch-form-inline-item"
              >
                <span class="batch-form-label">到账时间</span>
                <el-date-picker
                  v-model="batchForm.arrival_time"
                  type="date"
                  placeholder="请选择"
                  :format="TIME_FORMATS.DATE"
                  :value-format="TIME_FORMATS.DATE"
                  clearable
                  class="batch-date-picker"
                />
              </div>
            </div>
          </el-form>

          <div
            v-if="selectedItems.length > 0"
            class="pinned-items-preview"
          >
            <div class="preview-header">
              <i class="fas fa-list" />
              <span>将修改的记录预览</span>
            </div>
            <div class="preview-list">
              <div
                v-for="item in selectedPreviewItems"
                :key="item.id"
                class="preview-item"
              >
                <span
                  v-if="fieldVisibility.customer_name"
                  class="item-name"
                >{{ item.customer_name }}</span>
                <span
                  v-if="fieldVisibility.customer_phone"
                  class="item-phone"
                >{{ item.customer_phone }}</span>
                <span
                  v-if="fieldVisibility.model"
                  class="item-model"
                >{{ item.phone_model }}</span>
              </div>
              <div
                v-if="selectedItems.length > 5"
                class="preview-more"
              >
                还有 {{ selectedItems.length - 5 }} 条记录...
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div
            v-if="showBatchDialog"
            class="tf-dialog-actions modal-footer"
          >
            <el-button
              type="default"
              @click="closeBatchDialog"
            >
              <i class="fas fa-times" />
              取消
            </el-button>
            <el-button
              type="primary"
              :disabled="batchUpdating || (!batchForm.apply_time && !batchForm.arrival_time)"
              @click="submitBatchUpdate"
            >
              <InlineLoading
                v-if="batchUpdating"
                text="修改中..."
                size="small"
                variant="inherit"
              />
              <template v-else>
                <i class="fas fa-save" />
                <span>确认修改 ({{ selectedItems.length }}条)</span>
              </template>
            </el-button>
          </div>
        </template>
      </MobileDialog>

      <SubsidyApplyDialog
        v-if="showApplyDialog"
        v-model="showApplyDialog"
        :is-mobile="isMobile"
        :can-upload="canUpload"
        :can-view-field="canViewField"
        @submitted="handleApplySubmitted"
      />

      <SubsidyEditDialog
        v-if="showEditDialog && currentEditItem"
        v-model="showEditDialog"
        :item="currentEditItem"
        :stores="stores"
        :can-view-field="canViewField"
        :can-edit-field="canEditField"
        :can-approve="canApprove"
        :can-arrival="canArrival"
        @updated="handleEditSubmitted"
      />

      <SubsidyDetailDialog
        v-if="showDetailDialog && currentDetailItem"
        v-model="showDetailDialog"
        :item="currentDetailItem"
        :field-visibility="fieldVisibility"
      />

      <SubsidyPhotoManageDialog
        v-if="showPhotoPreviewDialog && currentManagingItem"
        v-model="showPhotoPreviewDialog"
        :item="currentManagingItem"
        :can-upload="canUpload"
        @saved="handlePhotoSaved"
      />
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, reactive, computed, onMounted, onUnmounted, defineAsyncComponent, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { getCachedStores } from '@/services/reference-options'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { isCurrentMobileViewport } from '@/utils/device-detection'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
import { formatAmount } from '@/utils/format'
const SubsidyApplyDialog = defineAsyncComponent(() => import('./components/SubsidyApplyDialog.vue'))
const SubsidyEditDialog = defineAsyncComponent(() => import('./components/SubsidyEditDialog.vue'))
const SubsidyDetailDialog = defineAsyncComponent(() => import('./components/SubsidyDetailDialog.vue'))
const SubsidyPhotoManageDialog = defineAsyncComponent(() => import('./components/SubsidyPhotoManageDialog.vue'))
const SubsidyListSection = defineAsyncComponent(() => import('./components/SubsidyListSection.vue'))

// 权限检查
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canApprove,
  canArrival,
  canUpload,
  canExport,
  handleNoPermission
} = usePagePermissions('subsidy')
const { refreshing, refreshData } = useRefreshData()

// 字段权限（使用全局composable）
const { isFieldVisible, isFieldEditable, init: initFieldPermissions } = fieldPermissions
const SUBSIDY_FIELD_MODULE_KEY = 'subsidy_subsidyview'

// 字段ID映射表 - 映射简单字段名到完整字段ID
const fieldIdMap: Record<string, string> = {
  'stats_total_and_handler': 'stats.total_and_handler',
  'stats_approval_progress': 'stats.approval_progress',
  'stats_amount_progress': 'stats.amount_progress',
  'stats_store_overview': 'stats.store_overview',
  // 客户信息
  'customer_name': 'customer_info.customer_name',
  'customer_phone': 'customer_info.customer_phone',
  'customer_idcard': 'customer_info.customer_idcard',
  // 设备信息
  'imei1': 'device_info.imei1',
  'imei2': 'device_info.imei2',
  'brand': 'device_info.brand',
  'model': 'device_info.model',
  'color': 'device_info.color',
  'memory': 'device_info.memory',
  // 价格信息
  'sale_price': 'price_info.sale_price',
  'subsidy_amount': 'price_info.subsidy_amount',
  'subsidy_rate': 'price_info.subsidy_rate',
  'subsidy_calc_price': 'price_info.subsidy_calc_price',
  // 时间信息
  'apply_time': 'time_info.apply_time',
  'arrival_time': 'time_info.arrival_time',
  // 状态信息
  'status': 'status_info.status',
  // 其他信息
  'remarks': 'other_info.remarks',
  // 店铺和时间（使用通用格式）
  'store_name': 'store_info.store_name',
  'salesman_name': 'sales_info.salesman_name',
  'sale_time': 'time_info.sale_time',
  'serial_number': 'device_info.serial_number',
  'actions': 'system_info.operations',
  'subsidy_photos': 'subsidy_info.subsidy_photos',
  'has_different_handler': 'handler_info.has_different_handler',
  'handler_name': 'handler_info.handler_name',
  'handler_phone': 'handler_info.handler_phone',
  'handler_idcard': 'handler_info.handler_idcard'
}

// 检查字段是否可见
const canViewField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName
  return isFieldVisible(SUBSIDY_FIELD_MODULE_KEY, fullFieldId)
}

// 检查字段是否可编辑
const canEditField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName

  if (canCreate.value || canEdit.value) {
    return canViewField(fieldName)
  }

  return isFieldEditable(SUBSIDY_FIELD_MODULE_KEY, fullFieldId)
}

const showStatsCards = computed(() => {
  return [
    'stats_total_and_handler',
    'stats_approval_progress',
    'stats_amount_progress',
    'stats_store_overview'
  ].some(field => canViewField(field))
})

const fieldVisibility = computed(() => ({
  store_name: canViewField('store_name'),
  salesman_name: canViewField('salesman_name'),
  sale_time: canViewField('sale_time'),
  customer_name: canViewField('customer_name'),
  customer_phone: canViewField('customer_phone'),
  customer_idcard: canViewField('customer_idcard'),
  brand: canViewField('brand'),
  model: canViewField('model'),
  color: canViewField('color'),
  memory: canViewField('memory'),
  serial_number: canViewField('serial_number'),
  imei1: canViewField('imei1'),
  imei2: canViewField('imei2'),
  sale_price: canViewField('sale_price'),
  subsidy_amount: canViewField('subsidy_amount'),
  subsidy_rate: canViewField('subsidy_rate'),
  subsidy_calc_price: canViewField('subsidy_calc_price'),
  remarks: canViewField('remarks'),
  apply_time: canViewField('apply_time'),
  arrival_time: canViewField('arrival_time'),
  subsidy_photos: canViewField('subsidy_photos'),
  has_different_handler: canViewField('has_different_handler'),
  handler_name: canViewField('handler_name'),
  handler_phone: canViewField('handler_phone'),
  handler_idcard: canViewField('handler_idcard')
}))

const canShowActions = computed(() => shouldShowActionColumn(
  canViewField('actions'),
  [canEdit.value, canDelete.value]
))
const canViewCustomerIdcard = computed(() => fieldVisibility.value.customer_idcard)
const searchableFields = [
  { request_key: 'customer_name', field_key: 'customer_name', label: '姓名' },
  { request_key: 'customer_phone', field_key: 'customer_phone', label: '手机' },
  { request_key: 'customer_idcard', field_key: 'customer_idcard', label: '身份证' },
  { request_key: 'brand', field_key: 'brand', label: '品牌' },
  { request_key: 'model', field_key: 'model', label: '型号' },
  { request_key: 'color', field_key: 'color', label: '颜色' },
  { request_key: 'memory', field_key: 'memory', label: '内存' },
  { request_key: 'imei1', field_key: 'imei1', label: 'IMEI1' },
  { request_key: 'imei2', field_key: 'imei2', label: 'IMEI2' },
  { request_key: 'serial_number', field_key: 'serial_number', label: '序列号' }
]
const searchableFieldLabels = computed(() => (
  searchableFields.filter(field => canViewField(field.field_key)).map(field => field.label)
))
const searchPlaceholder = computed(() => searchableFieldLabels.value.join('/'))

// 表格列配置（参考综合查询页面实现）
const tableColumns = computed(() => {
  return [
    { key: 'store_name', label: '店铺', visible: fieldVisibility.value.store_name },
    { key: 'sale_time', label: '销售日期', visible: fieldVisibility.value.sale_time },
    { key: 'customer_name', label: '姓名', visible: fieldVisibility.value.customer_name },
    { key: 'customer_phone', label: '手机', visible: fieldVisibility.value.customer_phone },
    { key: 'customer_idcard', label: '身份证', visible: fieldVisibility.value.customer_idcard },
    { key: 'brand', label: '品牌', visible: fieldVisibility.value.brand },
    { key: 'model', label: '型号', visible: fieldVisibility.value.model },
    { key: 'color', label: '颜色', visible: fieldVisibility.value.color },
    { key: 'memory', label: '内存', visible: fieldVisibility.value.memory },
    { key: 'serial_number', label: '序列号', visible: fieldVisibility.value.serial_number },
    { key: 'imei1', label: 'IMEI1', visible: fieldVisibility.value.imei1 },
    { key: 'imei2', label: 'IMEI2', visible: fieldVisibility.value.imei2 },
    { key: 'sale_price', label: '销售价', visible: fieldVisibility.value.sale_price },
    { key: 'subsidy_amount', label: '国补后价', visible: fieldVisibility.value.subsidy_amount },
    { key: 'remarks', label: '备注', visible: fieldVisibility.value.remarks },
    { key: 'subsidy_photos', label: '国补照片', visible: fieldVisibility.value.subsidy_photos || canUpload.value },
    {
      key: 'apply_time',
      label: '国补提交',
      visible: fieldVisibility.value.apply_time
    },
    {
      key: 'arrival_time',
      label: '国补到账',
      visible: fieldVisibility.value.arrival_time
    },
    { key: 'actions', label: '操作', visible: canShowActions.value }
  ].filter(col => col.visible)
})

// 响应式数据
const { loading } = useLoadingState()
const { exportFile, buildDateFilename } = useImportExport()
const subsidyList = ref<any[]>([])
const exportingSubsidy = ref(false)
const pinnedItems = ref<any[]>([]) // 固定在顶部的选中项
const selectedItems = ref<number[]>([]) // 批量选中的ID列表
const showBatchDialog = ref(false) // 批量操作对话框
const batchForm = reactive({
  apply_time: '',
  arrival_time: ''
}) // 批量修改表单

const showPhotoPreviewDialog = ref(false)
const currentManagingItem = shallowRef<any>(null) // 当前正在管理照片的记录

const selectedItemIdSet = computed(() => new Set(selectedItems.value))
const pinnedItemIdSet = computed(() => new Set(pinnedItems.value.map(item => item.id)))

const _isSelectedItem = (id: number) => selectedItemIdSet.value.has(id)
const _isPinnedItem = (id: number) => pinnedItemIdSet.value.has(id)

// 计算属性：合并后的显示列表（固定项 + 普通列表）
const displayList = computed(() => {
  // 去重：从普通列表中移除已固定的项
  const remainingItems = subsidyList.value.filter(item => !pinnedItemIdSet.value.has(item.id))
  return [...pinnedItems.value, ...remainingItems]
})

// 批量修改预览（选中项，含置顶项）
const selectedPreviewItems = computed(() => {
  if (selectedItems.value.length === 0) return []
  return displayList.value.filter(item => selectedItemIdSet.value.has(item.id)).slice(0, 5)
})
const stats = ref({
  total_count: 0,
  pending_count: 0,
  completed_count: 0,
  approved_count: 0,
  total_arrived_amount: 0,
  total_subsidy_amount: 0,
  handler_count: 0,
  store_stats: [] as Array<{
    store_id: number;
    store_name: string;
    count: number;
    total_count: number;
  }>
})

const approvalRate = computed(() => {
  const total = Number(stats.value.total_count || 0)
  if (total <= 0) return 0
  return Math.round((Number(stats.value.completed_count || 0) / total) * 100)
})

const handlerRate = computed(() => {
  const total = Number(stats.value.total_count || 0)
  if (total <= 0) return 0
  return Math.min(100, Math.round((Number(stats.value.handler_count || 0) / total) * 100))
})

const pendingArrivalAmount = computed(() => {
  return Math.max(
    Number(stats.value.total_subsidy_amount || 0) - Number(stats.value.total_arrived_amount || 0),
    0
  )
})

const arrivalRate = computed(() => {
  const total = Number(stats.value.total_subsidy_amount || 0)
  if (total <= 0) return 0
  return Math.round((Number(stats.value.total_arrived_amount || 0) / total) * 100)
})

const topStores = computed(() => {
  return [...(stats.value.store_stats || [])]
    .sort((a, b) => Number(b.total_count || 0) - Number(a.total_count || 0))
    .slice(0, 2)
})

const topStoreRate = computed(() => {
  const storeTotal = (stats.value.store_stats || []).reduce(
    (sum, store) => sum + Number(store.total_count || 0),
    0
  )
  if (storeTotal <= 0) return 0
  return Math.min(100, Math.round((Number(topStores.value[0]?.total_count || 0) / storeTotal) * 100))
})

const filters = reactive({
  search: '',
  approval_status: '',
  arrival_status: '',
  store_id: '',
  sale_date_start: '',
  sale_date_end: '',
  submit_date_start: '',
  submit_date_end: '',
  arrive_date_start: '',
  arrive_date_end: ''
})

// 店铺列表
const stores = ref<any[]>([])

// 日期范围变量
const saleDateRange = ref<[string, string] | null>(null)
const submitDateRange = ref<[string, string] | null>(null)
const arriveDateRange = ref<[string, string] | null>(null)

// 判断是否为移动端
const isMobile = computed(() => {
  return isCurrentMobileViewport()
})

// 搜索展开状态 - 统一管理
const searchExpanded = ref(false)

// 防抖搜索 - 输入框输入时延迟搜索
let debounceSearchTimeoutId: ReturnType<typeof setTimeout> | null = null
let subsidyRequestSeq = 0
let listAbortController: AbortController | null = null
let statsAbortController: AbortController | null = null
let statsRefreshTimer: ReturnType<typeof setTimeout> | null = null

interface FetchRequestOptions {
  signal?: AbortSignal
  requestSeq?: number
  setLoading?: boolean
}

const isCanceledRequest = (error: any) => {
  return error?.code === 'ERR_CANCELED' ||
    error?.message === 'canceled' ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError'
}

const isStaleRequest = (requestSeq?: number) => {
  return requestSeq !== undefined && requestSeq !== subsidyRequestSeq
}

const abortListRequest = () => {
  listAbortController?.abort()
  listAbortController = null
}

const abortStatsRequest = () => {
  statsAbortController?.abort()
  statsAbortController = null
}

const clearStatsRefreshTimer = () => {
  if (statsRefreshTimer) {
    clearTimeout(statsRefreshTimer)
    statsRefreshTimer = null
  }
}

const debounceSearch = () => {
  // 取消之前的搜索
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
  }
  // 设置延迟搜索
  debounceSearchTimeoutId = setTimeout(() => {
    handleSearch()
  }, 300) // 300ms 防抖
}

// 处理行双击事件
const handleRowDoubleClick = (item: any) => {
  // 移动端和PC端都打开详情模态框
  handleViewDetail(item)
}

interface SubsidyPagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

const subsidyPagination: SubsidyPagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0
})

// 对话框状态
const showApplyDialog = ref(false)
const showDetailDialog = ref(false)
const showEditDialog = ref(false)
const currentDetailItem = shallowRef<any>(null)
const currentEditItem = shallowRef<any>(null)

// 批量操作相关
const batchUpdating = ref(false)

const currentDisplayIds = computed(() => displayList.value.map(item => item.id))

// 表头选择状态只反映当前展示记录，已选择的其他页面记录继续保留。
const selectAll = computed(() => {
  return currentDisplayIds.value.length > 0
    && currentDisplayIds.value.every(id => selectedItemIdSet.value.has(id))
})

// 计算属性：半选状态
const isIndeterminate = computed(() => {
  const selectedCount = currentDisplayIds.value.filter(id => selectedItemIdSet.value.has(id)).length
  return selectedCount > 0 && selectedCount < currentDisplayIds.value.length
})

const normalizeHandlerInfo = (handler_info?: Record<string, any> | null) => {
  if (!handler_info || typeof handler_info !== 'object') {
    return null
  }

  return {
    ...handler_info,
    handler_name: normalizePersonName(handler_info.handler_name || '', 20),
    handler_phone: normalizePhoneDigits(handler_info.handler_phone || ''),
    handler_idcard: normalizeIdCard(handler_info.handler_idcard || '')
  }
}

const normalizeSubsidyRecord = (item?: Record<string, any> | null) => {
  if (!item || typeof item !== 'object') {
    return item
  }

  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    handler_info: normalizeHandlerInfo(item.handler_info)
  }
}

const buildQueryParams = (includePagination: boolean) => {
  const params: any = {}

  if (includePagination) {
    params.page = subsidyPagination.page
    params.page_size = subsidyPagination.page_size
    params.sort_by = 'sale_time'
    params.sort_order = 'desc'
  }

  if (filters.approval_status) params.approval_status = filters.approval_status
  if (filters.arrival_status) params.arrival_status = filters.arrival_status

  if (filters.search) {
    searchableFields.forEach((field) => {
      if (canViewField(field.field_key)) {
        params[field.request_key] = filters.search
      }
    })
  }

  if (filters.store_id) params.store_id = filters.store_id

  // 销售时间筛选
  if (filters.sale_date_start) params.start_date = filters.sale_date_start
  if (filters.sale_date_end) params.end_date = filters.sale_date_end

  // 提交时间筛选
  if (filters.submit_date_start) params.apply_start_date = filters.submit_date_start
  if (filters.submit_date_end) params.apply_end_date = filters.submit_date_end

  // 到账时间筛选
  if (filters.arrive_date_start) params.arrival_start_date = filters.arrive_date_start
  if (filters.arrive_date_end) params.arrival_end_date = filters.arrive_date_end

  return params
}

const handleExportSubsidy = async () => {
  await exportFile({
    url: '/subsidy/export/excel',
    filename: buildDateFilename('国补管理', 'xlsx'),
    params: buildQueryParams(false),
    allowed: canExport,
    loading: exportingSubsidy,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '国补数据导出成功'
  })
}

// 获取国补列表
const fetchSubsidyList = async (options: FetchRequestOptions = {}) => {
  const shouldSetLoading = options.setLoading !== false
  try {
    if (shouldSetLoading) {
      loading.value = true
    }

    const params = buildQueryParams(true)

    const response = await unifiedApi.get('/subsidy', {
      params,
      signal: options.signal
    })

    if (isStaleRequest(options.requestSeq)) {
      return
    }

    if (response.success) {
      subsidyList.value = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item))
        : []
      subsidyPagination.page = Number(response.pagination?.page) || 1
      subsidyPagination.page_size = Number(response.pagination?.page_size) || 20
      subsidyPagination.total = Number(response.pagination?.total) || 0
      subsidyPagination.total_pages = Number(response.pagination?.total_pages) || 0
    } else {
      ElMessage.error(response.message || '获取国补列表失败')
    }
  } catch (error: any) {
    if (isCanceledRequest(error)) {
      return
    }
    logger.error('获取国补列表失败:', error)
    ElMessage.error('获取国补列表失败')
  } finally {
    if (shouldSetLoading && !isStaleRequest(options.requestSeq)) {
      loading.value = false
    }
  }
}

// 获取统计数据
const fetchStats = async (options: FetchRequestOptions = {}) => {
  try {
    if (!showStatsCards.value) {
      return
    }

    const params = {
      ...buildQueryParams(false),
      include_store_stats: canViewField('stats_store_overview') ? '1' : '0'
    }
    const response = await unifiedApi.get('/subsidy/stats/summary', {
      params,
      signal: options.signal
    })

    if (isStaleRequest(options.requestSeq)) {
      return
    }

    if (response.success) {
      stats.value = response.data
    }
  } catch (error: any) {
    if (isCanceledRequest(error)) {
      return
    }
    logger.error('获取统计数据失败:', error)
  }
}

const fetchLatestSubsidyList = async () => {
  const requestSeq = ++subsidyRequestSeq
  abortListRequest()
  listAbortController = new AbortController()
  const currentListController = listAbortController

  await fetchSubsidyList({
    signal: currentListController.signal,
    requestSeq
  })

  if (requestSeq === subsidyRequestSeq && listAbortController === currentListController) {
    listAbortController = null
  }
}

const scheduleStatsFetch = (requestSeq: number) => {
  clearStatsRefreshTimer()
  abortStatsRequest()

  if (!showStatsCards.value || requestSeq !== subsidyRequestSeq) {
    return
  }

  statsRefreshTimer = setTimeout(() => {
    statsRefreshTimer = null

    if (!showStatsCards.value || requestSeq !== subsidyRequestSeq) {
      return
    }

    statsAbortController = new AbortController()
    const currentStatsController = statsAbortController

    fetchStats({
      signal: currentStatsController.signal,
      requestSeq
    }).finally(() => {
      if (requestSeq === subsidyRequestSeq && statsAbortController === currentStatsController) {
        statsAbortController = null
      }
    })
  }, 120)
}

const fetchLatestSubsidyData = async (resetPage = false, setLoading = true) => {
  const requestSeq = ++subsidyRequestSeq

  if (resetPage) {
    subsidyPagination.page = 1
  }

  abortListRequest()
  abortStatsRequest()
  clearStatsRefreshTimer()
  listAbortController = new AbortController()
  const currentListController = listAbortController
  await fetchSubsidyList({
    signal: currentListController.signal,
    requestSeq,
    setLoading
  })

  if (requestSeq === subsidyRequestSeq) {
    if (listAbortController === currentListController) {
      listAbortController = null
    }
    scheduleStatsFetch(requestSeq)
  }
}

// 打开申请对话框
const openApplyDialog = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  showApplyDialog.value = true
}
const handleApplySubmitted = async () => {
  await fetchLatestSubsidyData()
}

const handleViewDetail = (item: any) => {
  currentDetailItem.value = item
  showDetailDialog.value = true
}

const handleEdit = (item: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  currentEditItem.value = item
  showEditDialog.value = true
}

const handleEditSubmitted = async () => {
  await fetchLatestSubsidyData()
}

const openPhotoManageDialog = async (item: any) => {
  if (!fieldVisibility.value.subsidy_photos && !canUpload.value) {
    return
  }

  if (canUpload.value) {
    try {
      const response = await unifiedApi.get(`/subsidy/${item.id}/photos`)
      if (!response.success) {
        ElMessage.error(response.message || '读取国补照片失败')
        return
      }
      currentManagingItem.value = {
        ...item,
        subsidy_photos: Array.isArray(response.data?.subsidy_photos)
          ? response.data.subsidy_photos
          : []
      }
    } catch (error) {
      logger.error('读取国补照片失败:', error)
      ElMessage.error('读取国补照片失败')
      return
    }
  } else {
    currentManagingItem.value = item
  }
  showPhotoPreviewDialog.value = true
}

const handlePhotoSaved = async () => {
  await fetchLatestSubsidyList()
}

// 删除国补记录
const handleDelete = async (item: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await confirmAction(
      `确定要删除这条国补记录吗？客户：${item.customer_name}，金额：¥${formatAmount(item.subsidy_amount)}`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await unifiedApi.delete(`/subsidy/${item.id}`)

    if (response.success) {
      ElMessage.success('删除成功')
      await fetchLatestSubsidyData()
    } else {
      ElMessage.error(response.message || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const getTodayDateStr = () => TimeUtil.nowFormatted(TIME_FORMATS.DATE)
const getActionRecordDescription = (item: any) => {
  const parts: string[] = []
  if (fieldVisibility.value.customer_name && item?.customer_name) {
    parts.push(`客户：${item.customer_name}`)
  }
  if (fieldVisibility.value.subsidy_amount && item?.subsidy_amount !== null && item?.subsidy_amount !== undefined) {
    parts.push(`补贴金额：¥${formatAmount(item.subsidy_amount)}`)
  }
  return parts.length > 0 ? `（${parts.join('，')}）` : ''
}

// 审批国补申请（记录审批时间）
const handleAudit = async (item: any) => {
  if (!canApprove.value) {
    handleNoPermission('approve')
    return
  }

  try {
    await confirmAction(
      `确定审批该国补申请吗？${getActionRecordDescription(item)}`,
      '审批确认',
      {
        confirmButtonText: '确定审批',
        cancelButtonText: '取消',
        type: 'info'
      }
    )

    const response = await unifiedApi.put(`/subsidy/${item.id}/audit`)

    if (response.success) {
      item.apply_time = getTodayDateStr()
      ElMessage.success('审批成功')
      await fetchLatestSubsidyData()
    } else {
      ElMessage.error(response.message || '审批失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('审批失败:', error)
      ElMessage.error('审批失败')
    }
  }
}

// 批量选择相关函数
const handleSelectItem = (id: number, checked: boolean) => {
  if (checked) {
    if (!selectedItems.value.includes(id)) {
      selectedItems.value = [...selectedItems.value, id]
    }
    return
  }
  selectedItems.value = selectedItems.value.filter(itemId => itemId !== id)
}

const handleSelectAll = (value: boolean) => {
  const currentIds = new Set(currentDisplayIds.value)

  if (value) {
    selectedItems.value = [...new Set([...selectedItems.value, ...currentDisplayIds.value])]
    return
  }

  selectedItems.value = selectedItems.value.filter(id => !currentIds.has(id))
}

const clearSelection = () => {
  selectedItems.value = []
}

// 固定选中项到顶部
const pinSelectedItems = () => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要固定的记录')
    return
  }

  // 从 subsidyList 中找到选中的项
  const itemsToPin = subsidyList.value.filter(item =>
    selectedItems.value.includes(item.id)
  )

  // 检查是否已经固定过（避免重复）
  const pinnedIds = new Set(pinnedItems.value.map(p => p.id))
  const newItems = itemsToPin.filter(item => !pinnedIds.has(item.id))

  if (newItems.length === 0) {
    ElMessage.info('这些记录已经固定了')
    return
  }

  // 添加到固定列表
  pinnedItems.value.push(...newItems)

  ElMessage.success(`已固定 ${newItems.length} 条记录到顶部`)

  // 清空当前选择
  selectedItems.value = []
}

// 清除固定项
const clearPinnedItems = async () => {
  try {
    await confirmAction(
      `确定要清除所有固定的 ${pinnedItems.value.length} 条记录吗？`,
      '清除固定项确认',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    pinnedItems.value = []
    ElMessage.success('已清除所有固定项')
  } catch {
    // 用户取消
  }
}

// 批量修改对话框
const openBatchDialog = () => {
  if (!canApprove.value && !canArrival.value) {
    handleNoPermission('approve')
    return
  }
  batchForm.apply_time = ''
  batchForm.arrival_time = ''
  showBatchDialog.value = true
}

const closeBatchDialog = () => {
  batchForm.apply_time = ''
  batchForm.arrival_time = ''
  showBatchDialog.value = false
}

// 提交批量修改
const submitBatchUpdate = async () => {
  if (batchForm.apply_time && !canApprove.value) {
    handleNoPermission('approve')
    return
  }
  if (batchForm.arrival_time && !canArrival.value) {
    handleNoPermission('arrival')
    return
  }
  if (!batchForm.apply_time && !batchForm.arrival_time) {
    ElMessage.warning('请至少选择一个字段进行修改')
    return
  }

  if (selectedItems.value.length === 0) {
    ElMessage.warning('没有选中项可修改')
    return
  }

  try {
    await confirmAction(
      `确定要批量修改 ${selectedItems.value.length} 条选中记录的时间信息吗？只更新有选择日期的字段。`,
      '批量修改确认',
      {
        confirmButtonText: '确定修改',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    batchUpdating.value = true

    const updateData: any = {}
    if (batchForm.apply_time) {
      updateData.apply_time = batchForm.apply_time
    }
    if (batchForm.arrival_time) {
      updateData.arrival_time = batchForm.arrival_time
    }

    // 并发更新所有固定的记录
    const updatePromises = selectedItems.value.map(id =>
      unifiedApi.put(`/subsidy/${id}`, updateData)
    )

    const results = await Promise.allSettled(updatePromises)
    const successIds: number[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && (result.value as any).success) {
        successIds.push(selectedItems.value[index])
      }
    })
    const successCount = successIds.length
    const failCount = results.length - successCount

    if (successCount > 0) {
      const updateLocalList = (list: any[]) => {
        const idSet = new Set(successIds)
        list.forEach(item => {
          if (!idSet.has(item.id)) return
          if (batchForm.apply_time) item.apply_time = batchForm.apply_time
          if (batchForm.arrival_time) item.arrival_time = batchForm.arrival_time
        })
      }
      updateLocalList(subsidyList.value)
      updateLocalList(pinnedItems.value)
      ElMessage.success(`成功修改 ${successCount} 条记录${failCount > 0 ? `，失败 ${failCount} 条` : ''}`)
      await fetchLatestSubsidyData()
      closeBatchDialog()
      selectedItems.value = []
    } else {
      ElMessage.error('批量修改失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('批量修改失败:', error)
      ElMessage.error('批量修改失败')
    }
  } finally {
    batchUpdating.value = false
  }
}

// 确认到账
const handleConfirmArrival = async (item: any) => {
  if (!canArrival.value) {
    handleNoPermission('arrival')
    return
  }

  try {
    await confirmAction(
      `确定该国补款项已到账吗？${getActionRecordDescription(item)}`,
      '确认到账',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await unifiedApi.put(`/subsidy/${item.id}/confirm-arrival`)

    if (response.success) {
      item.arrival_time = getTodayDateStr()
      ElMessage.success('确认到账成功')
      await fetchLatestSubsidyData()
    } else {
      ElMessage.error(response.message || '确认失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('确认到账失败:', error)
      ElMessage.error('确认到账失败')
    }
  }
}

// 搜索
const handleSearch = () => {
  fetchLatestSubsidyData(true)
}

// 销售日期范围变化
const handleSaleDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.sale_date_start = value[0]
    filters.sale_date_end = value[1]
  } else {
    filters.sale_date_start = ''
    filters.sale_date_end = ''
  }
  handleSearch()
}

// 提交日期范围变化
const handleSubmitDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.submit_date_start = value[0]
    filters.submit_date_end = value[1]
  } else {
    filters.submit_date_start = ''
    filters.submit_date_end = ''
  }
  handleSearch()
}

// 到账日期范围变化
const handleArriveDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.arrive_date_start = value[0]
    filters.arrive_date_end = value[1]
  } else {
    filters.arrive_date_start = ''
    filters.arrive_date_end = ''
  }
  handleSearch()
}

// 重置筛选
const resetFilters = () => {
  filters.search = ''
  filters.approval_status = ''
  filters.arrival_status = ''
  filters.store_id = ''
  filters.sale_date_start = ''
  filters.sale_date_end = ''
  filters.submit_date_start = ''
  filters.submit_date_end = ''
  filters.arrive_date_start = ''
  filters.arrive_date_end = ''
  // 重置日期范围选择器
  saleDateRange.value = null
  submitDateRange.value = null
  arriveDateRange.value = null
  handleSearch()
}

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = () => {
  refreshData(
    async () => {
      await fetchLatestSubsidyData(false, false)
    },
    {
      successMessage: '数据刷新成功',
      errorMessage: '刷新失败，请重试'
    }
  )
}

// 翻页
const handlePageChange = (page: number) => {
  subsidyPagination.page = page
  fetchLatestSubsidyList()
}

// 每页数量变化
const handlePageSizeChange = (page_size: number) => {
  subsidyPagination.page_size = page_size
  subsidyPagination.page = 1 // 重置到第一页
  fetchLatestSubsidyList()
}

// 加载店铺列表
const fetchStores = async () => {
  try {
    const response = await getCachedStores()
    if (response.success && response.data) {
      // 当 all=true 时，API 直接返回数组
      const storeOptions = Array.isArray(response.data) ? response.data : []
      stores.value = sortOptionsByOrder(storeOptions)
    } else {
      stores.value = []
    }
  } catch (error) {
    logger.error('获取店铺列表失败:', error)
    stores.value = []
  }
}

const initPageData = async () => {
  // 字段权限必须先于业务数据，避免受限字段在首屏短暂出现。
  await initFieldPermissions()
  await Promise.allSettled([
    fetchStores(),
    fetchLatestSubsidyList()
  ])

  scheduleStatsFetch(subsidyRequestSeq)
}

watch(showDetailDialog, (visible) => {
  if (!visible) {
    currentDetailItem.value = null
  }
})

watch(showEditDialog, (visible) => {
  if (!visible) {
    currentEditItem.value = null
  }
})

watch(showPhotoPreviewDialog, (visible) => {
  if (!visible) {
    currentManagingItem.value = null
  }
})

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return
  }

  await initPageData()
})

onUnmounted(() => {
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
  }

  abortListRequest()
  abortStatsRequest()
  clearStatsRefreshTimer()
})
</script>

<style lang="scss" scoped src="./styles/SubsidyView.scss"></style>

<style lang="scss">
@media (max-width: 767px) {
  .subsidy-dialog,
  .subsidy-detail-dialog {
    --dialog-side-gap: 2px;
    --dialog-vertical-gap: 24px;
    --dialog-max-width: calc(100vw - 4px);
    --mobile-dialog-body-padding: 8px 2px 8px;
    --mobile-dialog-footer-padding: 0 2px 2px;
  }

  .subsidy-dialog-wide {
    --dialog-side-gap: 0px;
    --dialog-vertical-gap: 24px;
    --dialog-max-width: calc(100vw - 2px);
    --mobile-dialog-body-padding: 6px 0 6px;
    --mobile-dialog-footer-padding: 0 0 2px;
  }

  .mobile-dialog-sheet-overlay.subsidy-dialog,
  .mobile-dialog-sheet-overlay.subsidy-detail-dialog {
    padding: 8px 2px !important;
  }

  .mobile-dialog-sheet-overlay.subsidy-dialog-wide {
    padding: 8px 1px !important;
  }

  .mobile-dialog-sheet-panel.subsidy-dialog,
  .mobile-dialog-sheet-panel.subsidy-detail-dialog {
    width: calc(100vw - 4px) !important;
    max-width: calc(100vw - 4px) !important;
    max-height: calc(100dvh - 24px) !important;
    border-radius: 24px !important;
  }

  .mobile-dialog-sheet-panel.subsidy-dialog-wide {
    width: calc(100vw - 2px) !important;
    max-width: calc(100vw - 2px) !important;
    max-height: calc(100dvh - 24px) !important;
    border-radius: 24px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-header,
  .subsidy-detail-dialog .mobile-dialog-sheet-header {
    min-height: calc(66px + env(safe-area-inset-top)) !important;
    padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-title,
  .subsidy-detail-dialog .mobile-dialog-sheet-title {
    font-size: var(--tf-type-scale-16) !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-close,
  .subsidy-detail-dialog .mobile-dialog-sheet-close {
    top: calc(10px + env(safe-area-inset-top)) !important;
    right: 14px !important;
    transform: none !important;
  }

}

@media (max-width: 479px) {
  .subsidy-dialog .mobile-dialog-sheet-header,
  .subsidy-detail-dialog .mobile-dialog-sheet-header {
    min-height: calc(62px + env(safe-area-inset-top)) !important;
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-close,
  .subsidy-detail-dialog .mobile-dialog-sheet-close {
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: 14px !important;
  }
}
</style>

<style lang="scss" scoped>
.modal-body {
  padding: 0;
  overflow: visible;
  background: transparent;
}

// 批量操作样式
.batch-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  animation: slideDown 0.3s ease-out;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: var(--tf-type-scale-14);

    i {
      font-size: var(--tf-type-scale-16);
    }

    strong {
      font-size: var(--tf-type-scale-16);
      font-weight: 600;
    }
  }

  .batch-actions-buttons {
    display: flex;
    gap: 8px;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.batch-info-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--tf-color-blue-50);
  border: 1px solid var(--tf-color-blue-ant-100);
  border-radius: 8px;
  color: var(--tf-color-sky-700);
  font-size: var(--tf-type-scale-14);
  margin-bottom: 12px;

  i {
    font-size: var(--tf-type-scale-16);
  }

  strong {
    color: var(--tf-color-cyan-legacy-text);
    font-weight: 600;
  }
}

.batch-form {
  .batch-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .batch-form-inline-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .batch-form-label {
    flex: 0 0 64px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 32px;
  }

  :deep(.batch-date-picker) {
    flex: 1;
    min-width: 0;
  }

  :deep(.batch-date-picker .el-input__wrapper) {
    width: 100%;
  }

  @media (max-width: 767px) {
    .batch-form-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
}

.pinned-items-preview {
  margin-top: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;

  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--el-bg-color-page);
    border-bottom: 1px solid var(--el-border-color);
    font-size: var(--tf-type-scale-14);
    font-weight: 500;
    color: var(--el-text-color-primary);

    i {
      font-size: var(--tf-type-scale-14);
    }
  }

  .preview-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    font-size: var(--tf-type-scale-13);

    &:last-child {
      border-bottom: none;
    }

    .item-name {
      font-weight: 500;
      color: var(--el-text-color-primary);
      min-width: 80px;
    }

    .item-phone {
      color: var(--el-text-color-regular);
      min-width: 100px;
    }

    .item-model {
      color: var(--el-text-color-secondary);
      flex: 1;
    }
  }

  .preview-more {
    padding: 8px 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: var(--tf-type-scale-12);
    background: var(--el-bg-color-page);
  }
}

.checkbox-col {
  text-align: center;

  .el-checkbox {
    margin: 0;
  }
}

.selected-row {
  background-color: var(--el-color-primary-light-9) !important;
}

.pinned-row {
  background-color: var(--tf-color-amber-50) !important;
  border-left: 3px solid var(--tf-color-amber-500);

  &:hover {
    background-color: var(--tf-color-amber-100) !important;
  }
}

.pinned-card {
  background-color: var(--tf-color-amber-50);
  border-left: 3px solid var(--tf-color-amber-500);
}
</style>
