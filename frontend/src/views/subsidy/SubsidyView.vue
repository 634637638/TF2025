<template>
  <div class="subsidy-view admin-page safe-area-top">
    <!-- 权限加载中 -->
    <div v-if="permissionLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载权限中...</p>
    </div>

    <PermissionDenied
      v-else-if="!canView"
      :can-view="canView"
      module-key="subsidy"
      module-name="国补管理"
      permission-code="subsidy:view"
    />

    <template v-else>
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
            <i class="fas fa-plus"></i>
            <span>新增</span>
          </el-button>
          <el-button
            type="info"
            @click="handleRefresh"
            :disabled="refreshing"
            title="刷新数据"
          >
            <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
      <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_and_handler')" class="stat-card total-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.total_count || 0 }} <span class="divider">/</span> {{ stats.handler_count || 0 }}</div>
          <div class="stat-label">总办理 / 代办理</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">总办理</span>
            <span class="row-value">{{ stats.total_count || 0 }}单</span>
          </div>
          <div class="stat-row">
            <span class="row-label">代办理</span>
            <span class="row-value">{{ stats.handler_count || 0 }}单</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_approval_progress')" class="stat-card approval-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.completed_count || 0 }} <span class="divider">/</span> {{ stats.pending_count || 0 }}</div>
          <div class="stat-label">已审批 / 未审批</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">已审批</span>
            <span class="row-value">{{ stats.completed_count || 0 }}单</span>
          </div>
          <div class="stat-row">
            <span class="row-label">未审批</span>
            <span class="row-value">{{ stats.pending_count || 0 }}单</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_amount_progress')" class="stat-card amount-card">
        <div class="stat-content">
          <div class="stat-value">¥{{ formatAmount(stats.total_arrived_amount || 0) }} <span class="divider">/</span> ¥{{ formatAmount((stats.total_subsidy_amount || 0) - (stats.total_arrived_amount || 0)) }}</div>
          <div class="stat-label">已到账 / 未到账</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">已到账</span>
            <span class="row-value">¥{{ formatAmount(stats.total_arrived_amount || 0) }}</span>
          </div>
          <div class="stat-row">
            <span class="row-label">未到账</span>
            <span class="row-value">¥{{ formatAmount((stats.total_subsidy_amount || 0) - (stats.total_arrived_amount || 0)) }}</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_store_overview')" class="stat-card handler-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.store_stats?.length || 0 }}</div>
          <div class="stat-label">店铺数</div>
        </div>
        <!-- 手机端店铺列表 -->
        <div class="stat-content-mobile">
          <template v-if="stats.store_stats && stats.store_stats.length > 0">
            <div class="stat-row" v-for="store in stats.store_stats.slice(0, 3)" :key="store.store_id">
              <span class="row-label">{{ store.store_name || '未知店铺' }}</span>
              <span class="row-value">{{ store.total_count || 0 }}单</span>
            </div>
            <div class="stat-row" v-if="stats.store_stats.length > 3">
              <span class="row-label">其他</span>
              <span class="row-value">+{{ stats.store_stats.length - 3 }}店</span>
            </div>
          </template>
          <div class="stat-row" v-else>
            <span class="row-label">暂无数据</span>
            <span class="row-value">-</span>
          </div>
        </div>
      </div>
    </div>

      <UnifiedSearchPanel
        v-model:expanded="searchExpanded"
        :loading="loading"
        @search="handleSearch"
        @reset="resetFilters"
      >
        <template #primary>
          <el-input
            v-model="filters.search"
            placeholder="姓名/手机/身份证/品牌/型号/颜色/内存/IMEI/序列号"
            clearable
            @input="debounceSearch"
            @keyup.enter="handleSearch"
            @click.stop
          >
            <template #prefix>
              <i class="fas fa-search"></i>
            </template>
          </el-input>
        </template>

        <div class="form-group filter-item" data-field="status">
            <el-select
              v-model="filters.status"
              placeholder="状态"
              clearable
              @change="handleSearch"
            >
              <el-option label="未审批" value="pending" />
              <el-option label="已审批" value="completed" />
              <el-option label="未到账" value="unarrived" />
              <el-option label="已到账" value="approved" />
            </el-select>
        </div>

        <div class="form-group filter-item" data-field="store">
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

        <div class="form-group filter-item" data-field="saleDate">
            <el-date-picker
              v-model="saleDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="销售开始"
              end-placeholder="销售结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleSaleDateChange"
            />
        </div>

        <div class="form-group filter-item" data-field="submitDate">
            <el-date-picker
              v-model="submitDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="提交开始"
              end-placeholder="提交结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleSubmitDateChange"
            />
          </div>

          <!-- 到账时间 -->
          <div class="form-group filter-item" data-field="arriveDate">
            <el-date-picker
              v-model="arriveDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="到账开始"
              end-placeholder="到账结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
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
      <div v-if="showBatchDialog" class="modal-body">
        <div class="batch-info-summary">
          <i class="fas fa-thumbtack"></i>
          <span>将对 <strong>{{ selectedItems.length }}</strong> 条选中记录进行修改</span>
        </div>

        <el-form class="batch-form">
          <div class="batch-form-grid">
            <div class="batch-form-inline-item">
              <span class="batch-form-label">审批时间</span>
              <el-date-picker
                v-model="batchForm.apply_time"
                type="date"
                placeholder="请选择"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                clearable
                class="batch-date-picker"
              />
            </div>

            <div class="batch-form-inline-item">
              <span class="batch-form-label">到账时间</span>
              <el-date-picker
                v-model="batchForm.arrival_time"
                type="date"
                placeholder="请选择"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                clearable
                class="batch-date-picker"
              />
            </div>
          </div>
        </el-form>

        <div v-if="selectedItems.length > 0" class="pinned-items-preview">
          <div class="preview-header">
            <i class="fas fa-list"></i>
            <span>将修改的记录预览</span>
          </div>
          <div class="preview-list">
            <div v-for="item in selectedPreviewItems" :key="item.id" class="preview-item">
              <span class="item-name">{{ item.customer_name }}</span>
              <span class="item-phone">{{ item.customer_phone }}</span>
              <span class="item-model">{{ item.phone_model }}</span>
            </div>
            <div v-if="selectedItems.length > 5" class="preview-more">
              还有 {{ selectedItems.length - 5 }} 条记录...
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div v-if="showBatchDialog" class="modal-footer">
          <el-button type="default" @click="closeBatchDialog">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button
            type="primary"
            @click="submitBatchUpdate"
            :disabled="batchUpdating || (!batchForm.apply_time && !batchForm.arrival_time)"
          >
            <i v-if="batchUpdating" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            <span>确认修改 ({{ selectedItems.length }}条)</span>
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <SubsidyApplyDialog
      v-if="showApplyDialog"
      v-model="showApplyDialog"
      :is-mobile="isMobile"
      @submitted="handleApplySubmitted"
    />

    <SubsidyEditDialog
      v-if="showEditDialog && currentEditItem"
      v-model="showEditDialog"
      :item="currentEditItem"
      :stores="stores"
      :can-view-field="canViewField"
      :can-edit-field="canEditField"
      @updated="handleEditSubmitted"
    />

    <SubsidyDetailDialog
      v-if="showDetailDialog && currentDetailItem"
      v-model="showDetailDialog"
      :item="currentDetailItem"
      :can-view-customer-idcard="canViewField('customer_idcard')"
    />

    <SubsidyPhotoManageDialog
      v-if="showPhotoPreviewDialog && currentManagingItem"
      v-model="showPhotoPreviewDialog"
      :item="currentManagingItem"
      @saved="handlePhotoSaved"
    />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, defineAsyncComponent, shallowRef, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { unifiedApi } from '@/utils/unified-api';
import { fieldPermissions } from '@/composables/useFieldPermissions';
import { usePagePermissions } from '@/composables/usePagePermissions';
import { useRefreshData } from '@/composables/useRefreshData';
import { useLoadingState } from '@/composables';
import { useImportExport } from '@/composables/useImportExport';
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache';
import { TimeUtil, TIME_FORMATS } from '@/utils/time';
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue';
import ImportExportActions from '@/components/business/ImportExportActions.vue';
import { PageHeader, PermissionDenied } from '@/components/base';
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security';
import { logger } from '@/utils/logger';
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
  canExport,
  handleNoPermission
} = usePagePermissions('subsidy');
const { refreshing, refresh } = useRefreshData();
const permissionLoading = ref(false);

// 字段权限（使用全局composable）
const { isFieldVisible, isFieldEditable, init: initFieldPermissions } = fieldPermissions;

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
  // 时间信息
  'apply_time': 'time_info.apply_time',
  'arrival_time': 'time_info.arrival_time',
  // 状态信息
  'status': 'status_info.status',
  // 其他信息
  'remarks': 'other_info.remarks',
  // 店铺和时间（使用通用格式）
  'store_name': 'store_name',
  'sale_time': 'sale_time',
  'serial_number': 'serial_number'
};

// 检查字段是否可见
const canViewField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName;
  return isFieldVisible('subsidy', fullFieldId);
};

// 检查字段是否可编辑
const canEditField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName;

  if (canCreate.value || canEdit.value) {
    return canViewField(fieldName);
  }

  return isFieldEditable('subsidy', fullFieldId);
};

const showStatsCards = computed(() => {
  return [
    'stats_total_and_handler',
    'stats_approval_progress',
    'stats_amount_progress',
    'stats_store_overview'
  ].some(field => canViewField(field));
});

const fieldVisibility = computed(() => ({
  storeName: isFieldVisible('subsidy', 'store_name'),
  saleTime: isFieldVisible('subsidy', 'sale_time'),
  customerName: isFieldVisible('subsidy', 'customer_info.customer_name'),
  customerPhone: isFieldVisible('subsidy', 'customer_info.customer_phone'),
  customerIdcard: isFieldVisible('subsidy', 'customer_info.customer_idcard'),
  brand: isFieldVisible('subsidy', 'device_info.brand'),
  model: isFieldVisible('subsidy', 'device_info.model'),
  color: isFieldVisible('subsidy', 'device_info.color'),
  memory: isFieldVisible('subsidy', 'device_info.memory'),
  serialNumber: isFieldVisible('subsidy', 'serial_number'),
  imei1: isFieldVisible('subsidy', 'device_info.imei1'),
  imei2: isFieldVisible('subsidy', 'device_info.imei2'),
  salePrice: isFieldVisible('subsidy', 'price_info.sale_price'),
  subsidyAmount: isFieldVisible('subsidy', 'price_info.subsidy_amount'),
  remarks: isFieldVisible('subsidy', 'other_info.remarks'),
  applyTime: isFieldVisible('subsidy', 'time_info.apply_time'),
  arrivalTime: isFieldVisible('subsidy', 'time_info.arrival_time')
}));

const canShowActions = computed(() => canEdit.value || canDelete.value);
const canViewCustomerIdcard = computed(() => fieldVisibility.value.customerIdcard && canViewField('customer_idcard'));

// 表格列配置（参考综合查询页面实现）
const tableColumns = computed(() => {
  return [
    { key: 'store_name', label: '店铺', visible: fieldVisibility.value.storeName },
    { key: 'sale_time', label: '销售日期', visible: fieldVisibility.value.saleTime },
    { key: 'customer_name', label: '姓名', visible: fieldVisibility.value.customerName },
    { key: 'customer_phone', label: '手机', visible: fieldVisibility.value.customerPhone },
    { key: 'customer_idcard', label: '身份证', visible: fieldVisibility.value.customerIdcard },
    { key: 'brand', label: '品牌', visible: fieldVisibility.value.brand },
    { key: 'model', label: '型号', visible: fieldVisibility.value.model },
    { key: 'color', label: '颜色', visible: fieldVisibility.value.color },
    { key: 'memory', label: '内存', visible: fieldVisibility.value.memory },
    { key: 'serial_number', label: '序列号', visible: fieldVisibility.value.serialNumber },
    { key: 'imei1', label: 'IMEI1', visible: fieldVisibility.value.imei1 },
    { key: 'imei2', label: 'IMEI2', visible: fieldVisibility.value.imei2 },
    { key: 'sale_price', label: '销售价', visible: fieldVisibility.value.salePrice },
    { key: 'subsidy_amount', label: '国补后价', visible: fieldVisibility.value.subsidyAmount },
    { key: 'remarks', label: '备注', visible: fieldVisibility.value.remarks },
    { key: 'subsidy_photos', label: '国补照片', visible: true },
    { key: 'apply_time', label: '国补提交', visible: fieldVisibility.value.applyTime },
    { key: 'arrival_time', label: '国补到账', visible: fieldVisibility.value.arrivalTime },
    { key: 'actions', label: '操作', visible: canShowActions.value }
  ].filter(col => col.visible);
});

// 响应式数据
const { loading } = useLoadingState();
const { exportFile, buildDateFilename } = useImportExport();
const subsidyList = ref<any[]>([]);
const exportingSubsidy = ref(false);
const pinnedItems = ref<any[]>([]); // 固定在顶部的选中项
const selectedItems = ref<number[]>([]); // 批量选中的ID列表
const showBatchDialog = ref(false); // 批量操作对话框
const batchForm = reactive({
  apply_time: '',
  arrival_time: ''
}); // 批量修改表单

const showPhotoPreviewDialog = ref(false);
const currentManagingItem = shallowRef<any>(null); // 当前正在管理照片的记录

const selectedItemIdSet = computed(() => new Set(selectedItems.value));
const pinnedItemIdSet = computed(() => new Set(pinnedItems.value.map(item => item.id)));

const isSelectedItem = (id: number) => selectedItemIdSet.value.has(id);
const isPinnedItem = (id: number) => pinnedItemIdSet.value.has(id);

// 计算属性：合并后的显示列表（固定项 + 普通列表）
const displayList = computed(() => {
  // 去重：从普通列表中移除已固定的项
  const remainingItems = subsidyList.value.filter(item => !pinnedItemIdSet.value.has(item.id));
  return [...pinnedItems.value, ...remainingItems];
});

// 批量修改预览（选中项，含置顶项）
const selectedPreviewItems = computed(() => {
  if (selectedItems.value.length === 0) return [];
  return displayList.value.filter(item => selectedItemIdSet.value.has(item.id)).slice(0, 5);
});
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
});

const filters = reactive({
  search: '',
  status: '',
  store_id: '',
  sale_date_start: '',
  sale_date_end: '',
  submit_date_start: '',
  submit_date_end: '',
  arrive_date_start: '',
  arrive_date_end: ''
});

// 店铺列表
const stores = ref<any[]>([]);

// 日期范围变量
const saleDateRange = ref<[string, string] | null>(null);
const submitDateRange = ref<[string, string] | null>(null);
const arriveDateRange = ref<[string, string] | null>(null);

// 判断是否为移动端
const isMobile = computed(() => {
  return window.innerWidth <= 768;
});

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
  handleViewDetail(item);
};

interface SubsidyPagination {
  current: number
  pageSize: number
  total: number
  totalPages: number
}

const subsidyPagination: SubsidyPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
});

// 对话框状态
const showApplyDialog = ref(false);
const showDetailDialog = ref(false);
const showEditDialog = ref(false);
const currentDetailItem = shallowRef<any>(null);
const currentEditItem = shallowRef<any>(null);

// 批量操作相关
const batchUpdating = ref(false);

// 计算属性：全选状态
const selectAll = computed({
  get: () => selectedItems.value.length > 0 && selectedItems.value.length === displayList.value.length,
  set: (value: boolean) => {
    if (value) {
      selectedItems.value = displayList.value.map(item => item.id);
    } else {
      selectedItems.value = [];
    }
  }
});

// 计算属性：半选状态
const isIndeterminate = computed(() => {
  const len = selectedItems.value.length;
  return len > 0 && len < displayList.value.length;
});

const normalizeHandlerInfo = (handlerInfo?: Record<string, any> | null) => {
  if (!handlerInfo || typeof handlerInfo !== 'object') {
    return null;
  }

  return {
    ...handlerInfo,
    handlerName: normalizePersonName(handlerInfo.handlerName || '', 20),
    handlerPhone: normalizePhoneDigits(handlerInfo.handlerPhone || ''),
    handlerIdcard: normalizeIdCard(handlerInfo.handlerIdcard || '')
  };
};

const normalizeSubsidyRecord = (item?: Record<string, any> | null) => {
  if (!item || typeof item !== 'object') {
    return item;
  }

  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    handlerInfo: normalizeHandlerInfo(item.handlerInfo)
  };
};

const buildQueryParams = (includePagination: boolean) => {
  const params: any = {};

  if (includePagination) {
    params.page = subsidyPagination.current;
    params.limit = subsidyPagination.pageSize;
    params.sort_by = 'sale_time';
    params.sort_order = 'desc';
  }

  if (filters.status) params.status = filters.status;

  // 搜索关键词支持多个字段
  if (filters.search) {
    // 同时搜索客户电话、客户姓名、身份证、品牌、型号、颜色、内存、序列号、IMEI1、IMEI2
    params.customer_phone = filters.search;
    params.customer_name = filters.search;
    params.customer_idcard = filters.search;  // 身份证
    params.brand = filters.search;             // 品牌
    params.model = filters.search;             // 型号
    params.color = filters.search;             // 颜色
    params.memory = filters.search;            // 内存
    params.imei1 = filters.search;             // IMEI1
    params.imei2 = filters.search;             // IMEI2
    params.serial_number = filters.search;     // 序列号
  }

  if (filters.store_id) params.store_id = filters.store_id;

  // 销售时间筛选
  if (filters.sale_date_start) params.start_date = filters.sale_date_start;
  if (filters.sale_date_end) params.end_date = filters.sale_date_end;

  // 提交时间筛选
  if (filters.submit_date_start) params.apply_start_date = filters.submit_date_start;
  if (filters.submit_date_end) params.apply_end_date = filters.submit_date_end;

  // 到账时间筛选
  if (filters.arrive_date_start) params.arrival_start_date = filters.arrive_date_start;
  if (filters.arrive_date_end) params.arrival_end_date = filters.arrive_date_end;

  return params;
};

const handleExportSubsidy = async () => {
  await exportFile({
    url: '/subsidy/export/excel',
    filename: buildDateFilename('国补管理', 'xlsx'),
    params: buildQueryParams(false),
    allowed: canExport,
    loading: exportingSubsidy,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '国补数据导出成功'
  });
};

// 获取国补列表
const fetchSubsidyList = async (options: FetchRequestOptions = {}) => {
  const shouldSetLoading = options.setLoading !== false;
  try {
    if (shouldSetLoading) {
      loading.value = true;
    }

    const params = buildQueryParams(true);

    const response = await unifiedApi.get('/subsidy', {
      params,
      signal: options.signal
    });

    if (isStaleRequest(options.requestSeq)) {
      return;
    }

    if (response.success) {
      subsidyList.value = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item))
        : [];
      // 兼容两种字段名：page/current 和 limit/pageSize
      subsidyPagination.current = Number(response.pagination?.current || response.pagination?.page) || 1;
      subsidyPagination.pageSize = Number(response.pagination?.pageSize || response.pagination?.limit) || 20;
      subsidyPagination.total = Number(response.pagination?.total) || 0;
      subsidyPagination.totalPages = Number(response.pagination?.totalPages || response.pagination?.pages) || 0;
    } else {
      ElMessage.error(response.message || '获取国补列表失败');
    }
  } catch (error: any) {
    if (isCanceledRequest(error)) {
      return;
    }
    logger.error('获取国补列表失败:', error);
    ElMessage.error('获取国补列表失败');
  } finally {
    if (shouldSetLoading && !isStaleRequest(options.requestSeq)) {
      loading.value = false;
    }
  }
};

// 获取统计数据
const fetchStats = async (options: FetchRequestOptions = {}) => {
  try {
    if (!showStatsCards.value) {
      return;
    }

    const params = {
      ...buildQueryParams(false),
      include_store_stats: canViewField('stats_store_overview') ? '1' : '0'
    };
    const response = await unifiedApi.get('/subsidy/stats/summary', {
      params,
      signal: options.signal
    });

    if (isStaleRequest(options.requestSeq)) {
      return;
    }

    if (response.success) {
      stats.value = response.data;
    }
  } catch (error: any) {
    if (isCanceledRequest(error)) {
      return;
    }
    logger.error('获取统计数据失败:', error);
  }
};

const fetchLatestSubsidyList = async () => {
  const requestSeq = ++subsidyRequestSeq;
  abortListRequest();
  listAbortController = new AbortController();
  const currentListController = listAbortController;

  await fetchSubsidyList({
    signal: currentListController.signal,
    requestSeq
  });

  if (requestSeq === subsidyRequestSeq && listAbortController === currentListController) {
    listAbortController = null;
  }
};

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

const fetchLatestSubsidyData = async (resetPage = false) => {
  const requestSeq = ++subsidyRequestSeq;

  if (resetPage) {
    subsidyPagination.current = 1;
  }

  abortListRequest();
  abortStatsRequest();
  clearStatsRefreshTimer()
  listAbortController = new AbortController();
  const currentListController = listAbortController;
  await fetchSubsidyList({
    signal: currentListController.signal,
    requestSeq
  });

  if (requestSeq === subsidyRequestSeq) {
    if (listAbortController === currentListController) {
      listAbortController = null;
    }
    scheduleStatsFetch(requestSeq)
  }
};

// 打开申请对话框
const openApplyDialog = () => {
  if (!canCreate.value) {
    handleNoPermission('create');
    return;
  }

  showApplyDialog.value = true;
};
const handleApplySubmitted = async () => {
  await fetchLatestSubsidyData()
};

const handleViewDetail = (item: any) => {
  currentDetailItem.value = item
  showDetailDialog.value = true
};

const handleEdit = (item: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit');
    return;
  }

  currentEditItem.value = item;
  showEditDialog.value = true;
};

const handleEditSubmitted = async () => {
  await fetchLatestSubsidyData()
};

const openPhotoManageDialog = (item: any) => {
  currentManagingItem.value = item;
  showPhotoPreviewDialog.value = true;
};

const handlePhotoSaved = async () => {
  await fetchLatestSubsidyList();
};

// 删除国补记录
const handleDelete = async (item: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这条国补记录吗？客户：${item.customer_name}，金额：¥${item.subsidy_amount?.toFixed(2)}`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await unifiedApi.delete(`/subsidy/${item.id}`);

    if (response.success) {
      ElMessage.success('删除成功');
      await fetchLatestSubsidyData();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

const getTodayDateStr = () => TimeUtil.nowFormatted(TIME_FORMATS.DATE);

// 审批国补申请（记录审批时间）
const handleAudit = async (item: any) => {
  if (!canApprove.value) {
    handleNoPermission('approve');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定审批该国补申请吗？客户：${item.customer_name}，金额：¥${item.subsidy_amount?.toFixed(2)}`,
      '审批确认',
      {
        confirmButtonText: '确定审批',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    const response = await unifiedApi.put(`/subsidy/${item.id}/audit`);

    if (response.success) {
      item.apply_time = getTodayDateStr();
      ElMessage.success('审批成功');
      await fetchLatestSubsidyData();
    } else {
      ElMessage.error(response.message || '审批失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('审批失败:', error);
      ElMessage.error('审批失败');
    }
  }
};

// 批量选择相关函数
const handleSelectItem = (id: number, checked: boolean) => {
  if (checked) {
    if (!selectedItems.value.includes(id)) {
      selectedItems.value = [...selectedItems.value, id];
    }
    return;
  }
  selectedItems.value = selectedItems.value.filter(itemId => itemId !== id);
};

const handleSelectAll = (value: boolean) => {
  selectAll.value = value;
};

const clearSelection = () => {
  selectedItems.value = [];
};

// 固定选中项到顶部
const pinSelectedItems = () => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要固定的记录');
    return;
  }

  // 从 subsidyList 中找到选中的项
  const itemsToPin = subsidyList.value.filter(item =>
    selectedItems.value.includes(item.id)
  );

  // 检查是否已经固定过（避免重复）
  const pinnedIds = new Set(pinnedItems.value.map(p => p.id));
  const newItems = itemsToPin.filter(item => !pinnedIds.has(item.id));

  if (newItems.length === 0) {
    ElMessage.info('这些记录已经固定了');
    return;
  }

  // 添加到固定列表
  pinnedItems.value.push(...newItems);

  ElMessage.success(`已固定 ${newItems.length} 条记录到顶部`);

  // 清空当前选择
  selectedItems.value = [];
};

// 清除固定项
const clearPinnedItems = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清除所有固定的 ${pinnedItems.value.length} 条记录吗？`,
      '清除固定项确认',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    pinnedItems.value = [];
    ElMessage.success('已清除所有固定项');
  } catch {
    // 用户取消
  }
};

// 批量修改对话框
const openBatchDialog = () => {
  batchForm.apply_time = '';
  batchForm.arrival_time = '';
  showBatchDialog.value = true;
};

const closeBatchDialog = () => {
  batchForm.apply_time = '';
  batchForm.arrival_time = '';
  showBatchDialog.value = false;
};

// 提交批量修改
const submitBatchUpdate = async () => {
  if (!batchForm.apply_time && !batchForm.arrival_time) {
    ElMessage.warning('请至少选择一个字段进行修改');
    return;
  }

  if (selectedItems.value.length === 0) {
    ElMessage.warning('没有选中项可修改');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量修改 ${selectedItems.value.length} 条选中记录的时间信息吗？只更新有选择日期的字段。`,
      '批量修改确认',
      {
        confirmButtonText: '确定修改',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    batchUpdating.value = true;

    const updateData: any = {};
    if (batchForm.apply_time) {
      updateData.apply_time = batchForm.apply_time;
    }
    if (batchForm.arrival_time) {
      updateData.arrival_time = batchForm.arrival_time;
    }

    // 并发更新所有固定的记录
    const updatePromises = selectedItems.value.map(id =>
      unifiedApi.put(`/subsidy/${id}`, updateData)
    );

    const results = await Promise.allSettled(updatePromises);
    const successIds: number[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && (result.value as any).success) {
        successIds.push(selectedItems.value[index]);
      }
    });
    const successCount = successIds.length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      const updateLocalList = (list: any[]) => {
        const idSet = new Set(successIds);
        list.forEach(item => {
          if (!idSet.has(item.id)) return;
          if (batchForm.apply_time) item.apply_time = batchForm.apply_time;
          if (batchForm.arrival_time) item.arrival_time = batchForm.arrival_time;
        });
      };
      updateLocalList(subsidyList.value);
      updateLocalList(pinnedItems.value);
      ElMessage.success(`成功修改 ${successCount} 条记录${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
      await fetchLatestSubsidyData();
      closeBatchDialog();
      selectedItems.value = [];
    } else {
      ElMessage.error('批量修改失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('批量修改失败:', error);
      ElMessage.error('批量修改失败');
    }
  } finally {
    batchUpdating.value = false;
  }
};

// 确认到账
const handleConfirmArrival = async (item: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定该国补款项已到账吗？金额: ¥${item.subsidy_amount?.toFixed(2)}`,
      '确认到账',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await unifiedApi.put(`/subsidy/${item.id}/confirm-arrival`);

    if (response.success) {
      item.arrival_time = getTodayDateStr();
      ElMessage.success('确认到账成功');
      await fetchLatestSubsidyData();
    } else {
      ElMessage.error(response.message || '确认失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('确认到账失败:', error);
      ElMessage.error('确认到账失败');
    }
  }
};

// 搜索
const handleSearch = () => {
  fetchLatestSubsidyData(true);
};

// 销售日期范围变化
const handleSaleDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.sale_date_start = value[0];
    filters.sale_date_end = value[1];
  } else {
    filters.sale_date_start = '';
    filters.sale_date_end = '';
  }
  handleSearch();
};

// 提交日期范围变化
const handleSubmitDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.submit_date_start = value[0];
    filters.submit_date_end = value[1];
  } else {
    filters.submit_date_start = '';
    filters.submit_date_end = '';
  }
  handleSearch();
};

// 到账日期范围变化
const handleArriveDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.arrive_date_start = value[0];
    filters.arrive_date_end = value[1];
  } else {
    filters.arrive_date_start = '';
    filters.arrive_date_end = '';
  }
  handleSearch();
};

// 重置筛选
const resetFilters = () => {
  filters.search = '';
  filters.status = '';
  filters.store_id = '';
  filters.sale_date_start = '';
  filters.sale_date_end = '';
  filters.submit_date_start = '';
  filters.submit_date_end = '';
  filters.arrive_date_start = '';
  filters.arrive_date_end = '';
  // 重置日期范围选择器
  saleDateRange.value = null;
  submitDateRange.value = null;
  arriveDateRange.value = null;
  handleSearch();
};

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = () => {
  refresh(async () => {
    await fetchLatestSubsidyData()
  })
};

// 翻页
const handlePageChange = (page: number) => {
  subsidyPagination.current = page;
  fetchLatestSubsidyList();
};

// 每页数量变化
const handlePageSizeChange = (pageSize: number) => {
  subsidyPagination.pageSize = pageSize;
  subsidyPagination.current = 1; // 重置到第一页
  fetchLatestSubsidyList();
};

// 格式化金额（移除不必要的.00后缀）
const formatAmount = (amount: number): string => {
  const formatted = amount.toFixed(2);
  // 如果是整数，移除.00
  if (formatted.endsWith('.00')) {
    return formatted.slice(0, -3);
  }
  // 如果小数点后最后一位是0，只保留一位小数
  if (formatted.endsWith('0')) {
    return formatted.slice(0, -1);
  }
  return formatted;
};

// 缓存键
const CACHE_KEYS = {
  stores: '/stores:all',
  subsidyStats: (params: any) => `/subsidy/stats/summary:${JSON.stringify(params)}`
}

// 加载店铺列表
const fetchStores = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.stores, () =>
      unifiedApi.get('/stores', { params: { all: true } }), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      // 当 all=true 时，API 直接返回数组
      stores.value = Array.isArray(response.data) ? response.data : (response.data.stores || response.data || []);
    } else {
      stores.value = [];
    }
  } catch (error) {
    logger.error('获取店铺列表失败:', error);
    stores.value = [];
  }
};

const initPageData = async () => {
  // 首屏优先列表，再异步补统计，减少主线程和网络抢占。
  await Promise.allSettled([
    initFieldPermissions(),
    fetchStores(),
    fetchLatestSubsidyList()
  ]);

  scheduleStatsFetch(subsidyRequestSeq)
};

watch(showDetailDialog, (visible) => {
  if (!visible) {
    currentDetailItem.value = null;
  }
});

watch(showEditDialog, (visible) => {
  if (!visible) {
    currentEditItem.value = null;
  }
});

watch(showPhotoPreviewDialog, (visible) => {
  if (!visible) {
    currentManagingItem.value = null;
  }
});

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return;
  }

  await initPageData();
});

onUnmounted(() => {
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId);
  }

  abortListRequest();
  abortStatsRequest();
  clearStatsRefreshTimer()
});
</script>

<style lang="scss" scoped>
.subsidy-view {
  min-height: 100vh;
  background: var(--bg-color, #f5f7fa);
  padding: var(--spacing-md);

  @media (max-width: 768px) {
    padding: 8px;
  }
}

.content {
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin: 0 0 24px 0;

    @media (max-width: 768px) {
      margin: 0 0 16px 0;
      gap: 12px;
      grid-template-columns: repeat(2, 1fr);
      padding: 0 4px;
    }

    @media (max-width: 480px) {
      margin: 0 0 12px 0;
      gap: 10px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      border: 1px solid #e8ecef;

      @media (max-width: 768px) {
        padding: 14px 12px;
        border-radius: 16px;
        border: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);

        @media (max-width: 768px) {
          transform: translateY(-1px);
        }
      }

      /* 总申请数卡片 */
      &.total-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        }
      }

      /* 审批状态卡片 */
      &.approval-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
      }

      /* 金额状态卡片 */
      &.amount-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }
      }

      /* 店铺统计卡片 */
      &.handler-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        }
      }

      .stat-content {
        text-align: center;

        @media (max-width: 768px) {
          display: none;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #2c3e50;
          line-height: 1.2;
          margin-bottom: 4px;

          .divider {
            color: #adb5bd;
            margin: 0 4px;
            font-weight: 400;
          }
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6c757d;
          font-weight: 500;
        }
      }

      /* 手机端双行内容 */
      .stat-content-mobile {
        display: none;
        width: 100%;
        flex-direction: column;
        gap: 6px;

        @media (max-width: 768px) {
          display: flex;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;

          .row-label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.85);
            font-weight: 500;
          }

          .row-value {
            font-size: 14px;
            font-weight: 700;
            color: white;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }
  }

  /* Element Plus 组件样式覆盖 */
  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px #dee2e6 inset;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #667eea inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #667eea inset;
    }
  }

  :deep(.el-select) {
    .el-input__wrapper {
      border-radius: 8px;
    }
  }

  :deep(.el-date-editor) {
    .el-input__wrapper {
      border-radius: 8px;
    }
  }

  .table-section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    @media (max-width: 768px) {
      padding: 16px;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      .record-count {
        margin-left: auto;
        font-size: 0.875rem;
        font-weight: 400;
        color: #6c757d;
      }
    }

    .table-container {
      .data-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 0;
        background: white;
        border-radius: 8px;
        overflow: hidden;

        thead {
          th {
            background: linear-gradient(135deg, #495057 0%, #343a40 100%);
            color: white;
            padding: 12px 10px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            border-right: 1px solid #dee2e6;
            border-bottom: 2px solid #dee2e6;
            white-space: nowrap;
            position: relative;

            &:last-child {
              border-right: none;
              border-top-right-radius: 0;
            }

            &:first-child {
              border-top-left-radius: 0;
            }

            &::after {
              display: none;
            }
          }
        }

        tbody {
          tr {
            transition: all 0.2s ease;
            position: relative;
            cursor: pointer;

            /* PC端不显示提示 */
            @media (min-width: 769px) {
              &::after {
                content: none;
              }
            }

            @media (max-width: 768px) {
              /* 移动端不显示提示 */
              &::after {
                content: none;
              }
            }

            &:nth-child(even) {
              background: #f8f9fa;
            }

            &:hover {
              background: #e3f2fd !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
              z-index: 1;
            }

            &:hover td {
              border-bottom-color: #dee2e6;
            }

            td {
              padding: 6px 6px;
              border-right: 1px solid #e9ecef;
              border-bottom: 1px solid #e9ecef;
              font-size: 14px;
              color: #2c3e50;
              font-weight: 500;
              transition: all 0.2s ease;
              text-align: center;

              &:last-child {
                border-right: none;
              }

              &:first-child {
                border-left: none;
              }
            }
          }
        }

        // 特殊列样式 - 设备详细信息列(统一绿色背景)
        td:nth-child(3),  /* 姓名 */
        td:nth-child(4),  /* 手机 */
        td:nth-child(5),  /* 身份证 */
        td:nth-child(6),  /* 品牌 */
        td:nth-child(7),  /* 型号 */
        td:nth-child(8),  /* 颜色 */
        td:nth-child(9),  /* 内存 */
        td:nth-child(10), /* 序列号 */
        td:nth-child(11), /* IMEI1 */
        td:nth-child(12)  /* IMEI2 */
        {
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #1f2937 !important;
          background: rgba(40, 167, 69, 0.05) !important;
          font-family: inherit !important;
        }

        tbody tr:hover td:nth-child(3),
        tbody tr:hover td:nth-child(4),
        tbody tr:hover td:nth-child(5),
        tbody tr:hover td:nth-child(6),
        tbody tr:hover td:nth-child(7),
        tbody tr:hover td:nth-child(8),
        tbody tr:hover td:nth-child(9),
        tbody tr:hover td:nth-child(10),
        tbody tr:hover td:nth-child(11),
        tbody tr:hover td:nth-child(12) {
          background: rgba(40, 167, 69, 0.08);
        }

        // 价格列 - 用红色区分
        td:nth-child(14), /* 销售价 */
        td:nth-child(15)  /* 国补后价 */
        {
          font-weight: 700;
          color: #dc3545;
          text-align: right;
          background: rgba(220, 53, 69, 0.03);
        }

        tbody tr:hover td:nth-child(14),
        tbody tr:hover td:nth-child(15) {
          background: rgba(220, 53, 69, 0.06);
        }

        // 状态列 - 国补提交和国补到账
        td:nth-child(17), /* 国补提交 */
        td:nth-child(18)  /* 国补到账 */
        {
          background: rgba(102, 126, 234, 0.02);
          font-weight: 500;
          color: #1f2937;
        }

        tbody tr:hover td:nth-child(16),
        tbody tr:hover td:nth-child(17) {
          background: rgba(102, 126, 234, 0.05);
        }

        // 操作列
        td.actions-col {
          background: rgba(108, 117, 125, 0.02);
          color: #1f2937;
        }

        tbody tr:hover td.actions-col {
          background: rgba(108, 117, 125, 0.05);
        }

        // 操作按钮容器布局
        .action-buttons {
          display: flex;
          flex-direction: row;
          gap: 8px;
          align-items: center;
          justify-content: center;

          .action-btn {
            flex: 1;
            min-width: 70px;
          }
        }

        // 时间徽章样式
        .time-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          border: 1px solid transparent;

          i {
            font-size: 14px;
          }

          &.approval-time {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border-color: #28a745;

            &:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            }
          }

          &.arrival-time {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-color: #667eea;

            &:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
          }
        }

        // 操作按钮组 - 统一使用 el-button 组件
        .action-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;

          .action-btn {
            flex: 1;
            min-width: 70px;
          }
        }
      }

      .loading-state,
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #6c757d;

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        i {
          font-size: 4rem;
          margin-bottom: 20px;
          color: #dee2e6;
        }

        p {
          font-size: 1rem;
          margin: 0;
        }
      }
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 20px;

      .page-info {
        font-size: 14px;
        color: #495057;
        font-weight: 500;
      }
    }
  }
}

// 申请对话框样式
.apply-form {
  min-width: 0;

  .search-step {
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
    }

    .step-hint {
      color: #6c757d;
      margin-bottom: 24px;
      font-size: 0.95rem;
    }

    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      min-width: 0;

      .search-input-lg {
        flex: 1;
        min-width: 0;
        padding: 14px 18px;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        font-size: 16px;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
      }
    }

    // 新样式：只有输入框的搜索区域
    .search-box-input-only {
      margin-bottom: 24px;

      .search-input-lg {
        width: 100%;
        padding: 14px 18px;
        border: 2px solid #dee2e6;
        border-radius: 8px;
        font-size: 16px;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        &::placeholder {
          color: #adb5bd;
        }
      }
    }

    // 设备列表
    .device-list {
      border: 1px solid #dee2e6;
      border-radius: 12px;
      overflow: hidden;

      .device-list-header {
        background: #f8f9fa;
        padding: 14px 20px;
        border-bottom: 1px solid #dee2e6;

        h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #2c3e50;
          margin: 0;
        }
      }

      .device-list-container {
        max-height: 400px;
        overflow-y: auto;

        .device-item {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background: #f8f9fa;
          }

          &.selected {
            background: #e7f3ff;
            border-left: 4px solid #667eea;
          }

          .device-main {
            flex: 1;
            min-width: 0;

            .device-model {
              font-size: 1rem;
              font-weight: 600;
              color: #2c3e50;
              margin-bottom: 6px;
            }

            .device-specs {
              font-size: 0.875rem;
              color: #6c757d;
              margin-bottom: 8px;
            }

            .device-identifiers {
              display: flex;
              gap: 16px;
              font-size: 0.75rem;
              color: #adb5bd;
              flex-wrap: wrap;

              span {
                display: flex;
                align-items: center;
                gap: 4px;
                min-width: 0;
                word-break: break-all;

                i {
                  font-size: 0.875rem;
                }
              }
            }

            .device-customer {
              display: flex;
              gap: 16px;
              font-size: 0.8125rem;
              color: #667eea;
              margin-top: 4px;
              padding-top: 8px;
              border-top: 1px solid #e9ecef;
              flex-wrap: wrap;

              span {
                display: flex;
                align-items: center;
                gap: 4px;
                min-width: 0;
                word-break: break-all;

                i {
                  font-size: 0.875rem;
                }
              }
            }
          }

          .device-meta {
            text-align: right;

            .device-price {
              font-size: 1.25rem;
              font-weight: 700;
              color: #2c3e50;
              margin-bottom: 8px;
            }

            .status-tag {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;

              &.eligible {
                background: #d1fae5;
                color: #10b981;
              }

              &.not-eligible {
                background: #fee2e2;
                color: #ef4444;
              }
            }
          }
        }
      }

      .device-selected-actions {
        padding: 16px 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f8f9fa;
      }
    }

    // 空状态
    .empty-devices {
      padding: 60px 20px;
      text-align: center;
      color: #6c757d;

      i {
        font-size: 3rem;
        margin-bottom: 16px;
        color: #dee2e6;
      }

      p {
        font-size: 1rem;
        margin-bottom: 20px;
      }
    }
  }

  .confirm-step {
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 20px;
    }

    .confirm-info {
      min-width: 0;

      .info-group {
        margin-bottom: 20px;
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e9ecef;
        min-width: 0;

        h4 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #495057;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-row {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #e9ecef;
          gap: 12px;
          min-width: 0;

          &:last-child {
            border-bottom: none;
          }

          .info-label {
            width: 100px;
            color: #6c757d;
            font-size: 14px;
            font-weight: 500;
            flex-shrink: 0;
          }

          .info-value {
            flex: 1;
            min-width: 0;
            color: #2c3e50;
            font-size: 14px;
            font-weight: 500;
            word-break: break-word;

            .form-input-inline {
              width: 100%;
              max-width: 300px;
              padding: 6px 12px;
              border: 1px solid #dee2e6;
              border-radius: 6px;
              font-size: 14px;
              transition: all 0.2s;

              &.has-value {
                background: #f0fdf4;
                border-color: #86efac;
              }

              &:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
              }
            }

            .idcard-hint {
              margin-left: 12px;
              padding: 4px 10px;
              background: #d1fae5;
              color: #065f46;
              border-radius: 4px;
              font-size: 12px;
              display: inline-flex;
              align-items: center;
              gap: 4px;

              &::before {
                content: '✓';
                font-weight: bold;
              }

              &.modified {
                background: #fef3c7;
                color: #92400e;

                &::before {
                  content: '✎';
                }
              }
            }

            &.subsidy-amount-highlight {
              color: #10b981;
              font-weight: 700;
              font-size: 1.5rem;
            }

            .discount-amount {
              color: #f97316;
              font-weight: 600;
            }

            .final-price {
              color: #ef4444;
              font-weight: 700;
              font-size: 1.2rem;
            }
          }
        }

        .info-row-inline {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #e9ecef;
          gap: 24px;

          .inline-item {
            display: flex;
            align-items: center;
            gap: 8px;

            .info-label {
              color: #6c757d;
              font-size: 14px;
              font-weight: 500;
              white-space: nowrap;
            }

            .info-value {
              color: #2c3e50;
              font-size: 14px;
              font-weight: 500;

              .form-input-inline {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.2s;
                min-width: 200px;

                &.has-value {
                  background: #f0fdf4;
                  border-color: #86efac;
                }

                &:focus {
                  outline: none;
                  border-color: #667eea;
                  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
              }
            }
          }
        }

        // 手机端响应式布局 - 字段在上，内容在下
        @media (max-width: 768px) {
          .info-row-inline {
            flex-wrap: wrap;
            gap: 12px;

            .inline-item {
              flex-direction: row; // 默认改为水平布局
              align-items: center;
              gap: 8px;
              width: 100%; // 每个项目占满宽度

              .info-label {
                font-size: 12px;
                white-space: nowrap;
                flex-shrink: 0;
              }

              .info-value {
                font-size: 14px;
                font-weight: 600;
                flex: 1;

                .form-input-inline {
                  width: 100%;
                  min-width: 0;
                }
              }
            }
          }
        }

        &.highlight {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          border-color: #6ee7b7;
        }

        .existing-subsidy-warning {
          margin-top: 12px;
          padding: 12px;
          background: #fff3cd;
          color: #f59e0b;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .subsidy-warning {
          margin-top: 12px;
          padding: 12px;
          background: #fee2e2;
          color: #ef4444;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

            .price-diff-hint {
              margin-left: 8px;
              font-size: 12px;
              color: #f59e0b;
              font-weight: 500;
              word-break: break-word;
            }

        // 实际办理人信息区块样式
        &.handler-info-section {
          background: #fffbeb;
          border-color: #fde68a;

          .handler-info-header {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 16px;

            h4 {
              margin-bottom: 0;
            }

            .checkbox-inline {
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              user-select: none;
              font-size: 14px;
              color: #495057;
              padding: 8px 12px;
              background: #ffffff;
              border-radius: 6px;
              transition: background 0.2s;

              &:hover {
                background: #fef3c7;
              }

              input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #f59e0b;
              }

              span {
                flex: 1;
              }
            }
          }

          .handler-info-content {
            animation: slideDown 0.3s ease-out;
          }

          .handler-info-placeholder {
            padding: 16px;
            background: #ffffff;
            border-radius: 8px;
            text-align: center;

            p {
              margin: 0;
              font-size: 14px;
              color: #6c757d;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;

              i {
                color: #3b82f6;
                font-size: 16px;
              }
            }
          }

          .info-label {
            &.required {
              &::after {
                content: '*';
                color: #ef4444;
                margin-left: 4px;
                font-weight: bold;
              }
            }
          }
        }
      }

      .form-group {
        margin-bottom: 20px;

        label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          margin-bottom: 8px;
        }

        .form-textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
          transition: all 0.2s;

          &:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
        }
      }
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      margin-top: 20px;
    }
  }
}

// 详情对话框
.detail-content {
  .detail-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    h4 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #495057;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9ecef;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-row {
      display: flex;
      padding: 10px 0;

      .detail-label {
        width: 120px;
        color: #6c757d;
        font-size: 14px;
        font-weight: 500;
        flex-shrink: 0;
      }

      .detail-value {
        flex: 1;
        color: #2c3e50;
        font-size: 14px;
        font-weight: 500;

        &.subsidy-highlight {
          color: #10b981;
          font-weight: 700;
          font-size: 1.25rem;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;

          &.status-pending {
            background: #fff3cd;
            color: #f59e0b;
          }

          &.status-approved {
            background: #dbeafe;
            color: #3b82f6;
          }

          &.status-rejected {
            background: #fee2e2;
            color: #ef4444;
          }

          &.status-completed {
            background: #d1fae5;
            color: #10b981;
          }
        }
      }
    }

    .detail-remarks {
      color: #495057;
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
      white-space: pre-wrap;
      background: #f8f9fa;
      padding: 14px;
      border-radius: 8px;
    }

    &.highlight {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #6ee7b7;
    }

    // 客户信息区块(支持点击切换)
    &.customer-info-section {
      cursor: default;
      transition: all 0.3s ease;
      position: relative;

      // 有办理人信息时的样式(可以点击)
      &.has-handler-info {
        cursor: pointer;
        user-select: none;

        h4 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;

          .toggle-hint {
            font-size: 12px;
            font-weight: 500;
            color: #6c757d;
            background: #f8f9fa;
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid #dee2e6;
            transition: all 0.2s;
          }
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

          .toggle-hint {
            background: #e9ecef;
            border-color: #adb5bd;
          }
        }
      }

      // 显示办理人信息时的样式(黄色背景)
      &.showing-handler {
        background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
        padding: 16px;
        border-radius: 12px;
        border: 2px solid #fbbf24;
        box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);

        h4 {
          color: #92400e !important;
          border-bottom-color: #fcd34d !important;

          .toggle-hint {
            background: #fff7ed;
            border-color: #fbbf24;
            color: #92400e;
          }
        }

        .detail-label {
          color: #78350f;
          font-weight: 600;
        }

        .detail-value {
          color: #92400e;
          font-weight: 600;
        }
      }
    }

    // 实际办理人信息高亮样式(旧版保留,未使用)
    &.handler-info-highlight {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #fbbf24;

      h4 {
        color: #92400e;
        border-bottom-color: #fcd34d;
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          color: #f59e0b;
        }
      }

      .detail-label {
        color: #78350f;
        font-weight: 600;
      }

      .detail-value {
        color: #92400e;
        font-weight: 600;
      }
    }
  }
}

// 审批对话框
.approve-content {
  p {
    font-size: 16px;
    color: #495057;
    margin-bottom: 16px;
  }

  .approve-info {
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 15px;

    strong {
      color: #10b981;
      font-size: 1.5rem;
    }
  }
}

.edit-form {
  padding: 0;

  // 表单行布局 - 两列
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    :deep(.el-form-item) {
      margin-bottom: 20px;
    }
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #303133;
    font-size: 14px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px #dcdfe6 inset;
    transition: all 0.2s;
    padding: 8px 12px;

    &:hover {
      box-shadow: 0 0 0 1px #c0c4cc inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #667eea inset;
    }
  }

  :deep(.el-input__inner) {
    font-size: 14px;
  }

  :deep(.el-textarea__inner) {
    border-radius: 8px;
    font-size: 14px;
    padding: 10px 12px;
    transition: all 0.2s;

    &:focus {
      border-color: #667eea;
    }
  }

  :deep(.el-date-editor) {
    width: 100%;

    .el-input__wrapper {
      width: 100%;
    }
  }

  // 时间输入组样式
  .time-input-group {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;

    .el-date-editor {
      flex: 1;
    }

    // 设为当前时间按钮
    .btn-time-now {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 14px;
      }
    }

    // 清除时间按钮
    .btn-time-clear {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #dc3545, #c82333);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 14px;
      }
    }
  }

  // 只读字段区域
  .readonly-fields {
    margin-top: 20px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #dee2e6;

    .readonly-title {
      font-size: 13px;
      font-weight: 600;
      color: #6c757d;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    :deep(.el-descriptions) {
      .el-descriptions__body {
        background: transparent;
      }

      .el-descriptions__table {
        border: none;

        .el-descriptions__cell {
          border: none;
          padding: 8px 0;
        }

        .el-descriptions__label {
          font-weight: 500;
          color: #495057;
        }

        .el-descriptions__content {
          color: #212529;
        }
      }
    }
  }
}

.apply-dialog-footer {
  gap: 10px;
}

// 旋转动画（用于加载图标）
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .subsidy-view {
    padding: 12px;
  }

  .apply-dialog-footer {
    gap: 8px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 移动端卡片列表 */
  .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px;
  }

  .mobile-card {
    background: white;
    border-radius: 16px;
    padding: 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);

    /* 添加顶部装饰条 */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    }

    &:active {
      transform: scale(0.98);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .card-section {
      padding: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);

      &:last-child {
        border-bottom: none;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        color: #1a1a1a;

        i {
          font-size: 14px;
          color: #667eea;
        }
      }

      .section-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 10px;

        /* 紧凑型网格 - 更小的间距和字体 */
        &.compact-grid {
          gap: 6px 8px;
        }

        .grid-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          &.full-width {
            grid-column: 1 / -1;
          }

          .item-label {
            font-size: 10px;
            color: #8e8e93;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .item-value {
            font-size: 13px;
            color: #1c1c1e;
            font-weight: 600;
            word-break: break-all;
            line-height: 1.3;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
              position: relative;

              &:active {
                opacity: 0.7;
              }
            }

            /* 客户信息切换样式 - 只用颜色区分，无图标 */
            .customer-info-toggle {
              cursor: pointer;

              /* 有办理人但显示购买者 - 蓝色 */
              &.has-handler-but-showing-purchaser {
                color: #1976d2;
                background: linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(25, 118, 210, 0.2);
              }

              /* 显示办理人 - 橙色 */
              &.showing-handler {
                color: #f57c00;
                background: linear-gradient(135deg, rgba(245, 124, 0, 0.08), rgba(245, 124, 0, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(245, 124, 0, 0.2);
              }

              &:active {
                opacity: 0.7;
              }
            }

            &.price-highlight {
              color: #ff3b30;
              font-size: 14px;
            }

            &.subsidy-amount {
              color: #34c759;
              font-size: 14px;
            }

            .time-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 10px;
              border-radius: 16px;
              font-size: 10px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

              &.approval-time {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
              }

              &.arrival-time {
                background: linear-gradient(135deg, #34c759, #30d158);
                color: white;
              }

              i {
                font-size: 9px;
              }
            }
          }
        }
      }
    }

    .device-section {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
    }

    .purchase-section {
      background: linear-gradient(135deg, rgba(52, 199, 89, 0.03) 0%, rgba(48, 209, 88, 0.03) 100%);

      /* 客户信息列表 - 2行紧凑布局 */
      .customer-info-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        /* 第一行：姓名 + 手机 */
        .info-row-first {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;
          gap: 3px;
          font-size: 10px;

          .info-label {
            color: #8e8e93;
            font-weight: 600;
            font-size: 9px;
            min-width: 24px;
            flex-shrink: 0;
          }

          .phone-label {
            margin-left: 4px;
            flex-shrink: 0;
          }

          .info-value {
            color: #1c1c1e;
            font-weight: 600;
            word-break: keep-all;
            white-space: nowrap;
            font-size: 10px;
            flex-shrink: 0;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
            }

            /* 客户信息切换样式 */
            &.customer-info-toggle {
              cursor: pointer;
              display: inline-flex;
              align-items: center;

              /* 有办理人但显示购买者 - 蓝色 */
              &.has-handler-but-showing-purchaser {
                color: #1976d2;
                background: linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(25, 118, 210, 0.2);
              }

              /* 显示办理人 - 橙色 */
              &.showing-handler {
                color: #f57c00;
                background: linear-gradient(135deg, rgba(245, 124, 0, 0.08), rgba(245, 124, 0, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(245, 124, 0, 0.2);
              }

              &:active {
                opacity: 0.7;
              }
            }
          }
        }

        /* 第二行：身份证 */
        .info-row-second {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;

          .info-label {
            color: #8e8e93;
            font-weight: 600;
            font-size: 10px;
            min-width: 32px;
            flex-shrink: 0;
          }

          .info-value {
            color: #1c1c1e;
            font-weight: 600;
            flex: 1;
            word-break: keep-all;
            font-size: 11px;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
            }
          }
        }
      }
    }

    .price-section {
      background: linear-gradient(135deg, rgba(255, 149, 0, 0.03) 0%, rgba(255, 59, 48, 0.03) 100%);
    }
  }

  .apply-form .search-step .search-box {
    flex-direction: column;
    gap: 10px;

    .search-input-lg,
    :deep(.el-button) {
      width: 100%;
    }
  }

  .apply-form {
    .search-step {
      padding: 0 10px;

      h3 {
        margin-bottom: 6px;
        font-size: 1.15rem;
      }

      .step-hint {
        margin-bottom: 12px;
        font-size: 0.9rem;
      }

      .device-list {
        .device-list-header,
        .device-list-container .device-item,
        .device-selected-actions {
          padding-left: 14px;
          padding-right: 14px;
        }

        .device-list-container {
          .device-item {
            .device-main {
              width: 100%;
            }

            .device-identifiers,
            .device-customer {
              flex-direction: column;
              gap: 6px;
              align-items: flex-start;
            }

            .device-meta {
              width: 100%;
              text-align: left;
            }
          }
        }
      }
    }

    .confirm-step {
      .confirm-info {
        .info-group {
          padding: 14px;

          .info-row {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;

            .info-label {
              width: auto;
              font-size: 13px;
            }

            .info-value {
              width: 100%;

              .form-input-inline {
                max-width: none;
              }

              .idcard-hint,
              .price-diff-hint {
                display: block;
                margin-left: 0;
                margin-top: 8px;
                width: fit-content;
              }
            }
          }
        }
      }

      :deep(.el-input-number) {
        width: 100% !important;
      }

      :deep(.el-input-number .el-input) {
        width: 100%;
      }
    }
  }

  .device-item {
    flex-direction: column !important;
    align-items: flex-start !important;

    .device-meta {
      text-align: left !important;
      width: 100%;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .confirm-actions,
  .device-selected-actions {
    flex-direction: column !important;

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
}

@media (max-width: 480px) {
  .apply-dialog-footer {
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }

  .search-row {
    flex-direction: column !important;

    .search-input-group,
    .filter-select {
      width: 100%;
    }
  }
}

// 加载动画容器
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #6c757d;

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e9ecef;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  p {
    font-size: 16px;
    margin: 0;
  }
}

// 新增样式：可点击文本和二维码提示
.clickable-text {
  cursor: pointer;
  color: #667eea !important;
  text-decoration: none;
  transition: all 0.2s;
  padding: 2px 4px;
  border-radius: 4px;
  display: inline-block;

  &:hover {
    background: #e0e7ff !important;
    color: #5a67d8 !important;
  }

  &:active {
    background: #c7d2fe !important;
  }

  // 客户信息切换样式
  &.customer-info-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-weight: 500;

    // 有实际办理人但显示原始购买者信息时的样式（默认状态）
    &.has-handler-but-showing-purchaser {
      background: linear-gradient(135deg, #dbeafe, #bfdbfe) !important;
      color: #1e40af !important;
      font-weight: 500;
      border: 1px solid #3b82f6;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);

      &:hover {
        background: linear-gradient(135deg, #bfdbfe, #93c5fd) !important;
      }
    }

    // 显示办理人信息时的样式（切换后状态）
    &.showing-handler {
      background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
      color: #92400e !important;
      font-weight: 600;
      border: 1px solid #fbbf24;
      box-shadow: 0 2px 4px rgba(251, 191, 36, 0.2);

      &:hover {
        background: linear-gradient(135deg, #fde68a, #fcd34d) !important;
      }
    }
  }
}

// 客户姓名容器
.customer-name-container {
  display: flex;
  align-items: center;
  gap: 8px;

  .handler-badge {
    display: inline-block;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    white-space: nowrap;
    background-color: #3b82f6;
    color: white;

    &.showing-handler {
      background-color: #f59e0b;
      color: white;
    }
  }
}

.text-muted {
  color: #adb5bd !important;
}

.remarks-display {
  color: #6c757d;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.remarks-tag {
  display: inline-block;
  padding: 2px 10px;
  background-color: #ffc107;
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.remarks-tag:hover {
  background-color: #ffca2c;
  transform: scale(1.05);
}

.remarks-icon {
  color: #ffc107;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  padding: 4px;
  border-radius: 4px;
}

.remarks-icon:hover {
  color: #ffca2c;
  background-color: rgba(255, 193, 7, 0.1);
  transform: scale(1.1);
}

// 国补照片上传相关样式
.subsidy-photo-row {
  flex-wrap: wrap;

  .info-value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
}

.subsidy-photo-upload {
  display: inline-flex;

  .photo-upload-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: #fff;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    i {
      margin-right: 6px;
    }
  }
}

.uploaded-photos-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  width: 100%;
}

.photo-thumbnail {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid #e0e0e0;
  transition: all 0.3s;

  &:hover {
    transform: scale(1.1);
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);

    .remove-photo {
      opacity: 1;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-photo {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    background: rgba(220, 53, 69, 0.9);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;

    &:hover {
      background: #dc3545;
    }
  }
}

// 表格中的国补照片列样式
.subsidy-photo-cell {
  .photo-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    transition: all 0.3s;

    &.clickable {
      &:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
    }

    .photo-icon {
      color: #fff;
      font-size: 16px;
    }

    .photo-icon-empty {
      color: #fff;
      font-size: 14px;
      opacity: 0.8;
    }

    .upload-hint {
      color: #fff;
      font-size: 12px;
      font-weight: 500;
    }

    .photo-count {
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 6px;
      border-radius: 10px;
    }
  }
}

// 照片预览模态框样式
.photo-preview-dialog {
  .photo-preview-content {
    .photo-upload-area {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 8px;
      margin-bottom: 20px;

      .icon-only-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: all 0.3s;

        &:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
        }
      }

      .upload-tip {
        color: #666;
        font-size: 13px;
      }
    }

    .photo-grid-area {
      .photo-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 16px;

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 16px;

          .selected-count {
            color: #409eff;
            font-size: 14px;
            font-weight: 500;
          }
        }

        .toolbar-right {
          display: flex;
          gap: 8px;
        }
      }

      .photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        padding: 16px 0;
        user-select: none; // 防止拖动时选中文本

        .photo-grid-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 3px solid transparent;
          cursor: pointer;

          &.selected {
            border-color: #409eff;
            box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
          }

          &:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

            .photo-actions {
              opacity: 1;
              transform: translateY(0);
            }
          }

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            cursor: pointer;
          }

          .photo-checkbox {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 20;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 6px;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              background: white;
              transform: scale(1.1);
            }

            .el-checkbox {
              margin: 0;
            }
          }

          .photo-actions {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%) translateY(10px);
            display: flex;
            gap: 8px;
            opacity: 0;
            transition: all 0.3s;
            z-index: 15;

            .action-btn {
              width: 40px !important;
              height: 40px !important;
              min-width: 40px !important;
              padding: 0 !important;
              border: none !important;
              border-radius: 50% !important;
              backdrop-filter: blur(10px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              transition: all 0.2s;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-shrink: 0;

              i {
                font-size: 16px;
                margin: 0 !important;
              }

              &.view-btn {
                background: rgba(64, 158, 255, 0.95) !important;
                color: white !important;

                &:hover {
                  background: #409eff !important;
                  transform: scale(1.1);
                  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
                }
              }

              &.delete-btn {
                background: rgba(245, 108, 108, 0.95) !important;
                color: white !important;

                &:hover {
                  background: #f56c6c !important;
                  transform: scale(1.1);
                  box-shadow: 0 6px 16px rgba(245, 108, 108, 0.4);
                }
              }
            }
          }

          .selected-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(64, 158, 255, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;

            i {
              color: #409eff;
              font-size: 48px;
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
            }
          }
        }
      }

      .photo-count-info {
        text-align: center;
        padding: 16px 0;
        color: #666;
        font-size: 14px;

        i {
          margin-right: 6px;
          color: #409eff;
        }
      }
    }

    .no-photo-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #999;

      i {
        font-size: 64px;
        margin-bottom: 16px;
        opacity: 0.3;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }

  .photo-preview-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 照片查看器样式
.photo-viewer-dialog {
  .photo-viewer-content {
    .photo-viewer-main {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 500px;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 20px;

      .photo-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        width: 48px;
        height: 48px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

        &:hover:not(:disabled) {
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        &.prev {
          left: 20px;
        }

        &.next {
          right: 20px;
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }

      .photo-viewer-image {
        max-width: calc(100% - 120px);
        max-height: 70vh;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
      }
    }

    .photo-viewer-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
    }
  }
}

// 手机端适配
@media (max-width: 768px) {
  .subsidy-photo-row {
    .info-label {
      width: auto;
      margin-bottom: 8px;
    }

    .info-value {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      .el-input-number {
        width: 140px !important;
        flex-shrink: 0;
      }

      .price-diff-hint {
        display: none; // 手机端隐藏差价提示，节省空间
      }

      .subsidy-photo-upload {
        flex-shrink: 0;
      }

      // 图片预览单独一行
      .uploaded-photos-preview {
        width: 100%;
        margin-top: 8px;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        overflow-x: auto;
        gap: 8px;
        padding-bottom: 8px;

        .photo-thumbnail {
          flex-shrink: 0;
          width: 70px;
          height: 70px;
        }
      }
    }
  }

  .uploaded-photos-preview {
    justify-content: flex-start;
  }

  .photo-preview-dialog {
    .el-dialog {
      width: 95% !important;
      margin: 20px auto !important;
    }

    .photo-grid-area {
      .photo-toolbar {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;

        .toolbar-left,
        .toolbar-right {
          justify-content: center;
        }

        .toolbar-right {
          .el-button {
            flex: 1;
          }
        }
      }

      .photo-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;

        .photo-grid-item {
          border-radius: 8px;

          .photo-checkbox {
            top: 6px;
            left: 6px;
            padding: 2px;
          }

          .photo-actions {
            bottom: 8px;
            gap: 6px;

            .action-btn {
              width: 36px;
              height: 36px;

              i {
                font-size: 14px;
              }
            }
          }

          .selected-overlay i {
            font-size: 36px;
          }
        }
      }
    }

    .photo-preview-footer {
      flex-wrap: wrap;

      .el-button {
        flex: 1;
        min-width: 100px;
      }
    }
  }

  .photo-viewer-dialog {
    .el-dialog {
      width: 100% !important;
      margin: 0 !important;
    }

    .photo-viewer-main {
      min-height: 300px !important;

      .photo-nav-btn {
        width: 36px;
        height: 36px;

        &.prev {
          left: 10px;
        }

        &.next {
          right: 10px;
        }
      }

      .photo-viewer-image {
        max-width: calc(100% - 80px);

        img {
          max-height: 50vh;
        }
      }
    }
  }
}

.qrcode-tooltip {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  min-width: 220px;
  animation: fadeIn 0.2s ease-in-out;
  pointer-events: auto;

  .qrcode-title {
    font-weight: 600;
    color: #495057;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .qrcode-value {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 12px;
    word-break: break-all;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  canvas {
    display: block;
    margin: 0 auto;
    border: 1px solid #dee2e6;
    border-radius: 4px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}
</style>

<style lang="scss">
@media (max-width: 768px) {
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
    font-size: 16px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-close,
  .subsidy-detail-dialog .mobile-dialog-sheet-close {
    top: calc(10px + env(safe-area-inset-top)) !important;
    right: 14px !important;
    transform: none !important;
  }

  .subsidy-dialog-wide .el-dialog__body {
    padding: 6px 0 !important;
  }
}

@media (max-width: 480px) {
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

.modal-footer {
  padding: 0;
  border-top: 1px solid #dee2e6 !important;
  display: flex !important;
  gap: 12px !important;
  justify-content: flex-end !important;
  background: transparent !important;
}

// 批量操作样式
.batch-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  animation: slideDown 0.3s ease-out;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;

    i {
      font-size: 16px;
    }

    strong {
      font-size: 16px;
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
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  color: #0369a1;
  font-size: 14px;
  margin-bottom: 12px;

  i {
    font-size: 16px;
  }

  strong {
    color: #0c4a6e;
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

  @media (max-width: 768px) {
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
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);

    i {
      font-size: 14px;
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
    font-size: 13px;

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
    font-size: 12px;
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
  background-color: #fffbeb !important;
  border-left: 3px solid #f59e0b;

  &:hover {
    background-color: #fef3c7 !important;
  }
}

.pinned-card {
  background-color: #fffbeb;
  border-left: 3px solid #f59e0b;
}
</style>
