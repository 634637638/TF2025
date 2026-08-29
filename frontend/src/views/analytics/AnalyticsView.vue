<template>
  <div class="analytics-view admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="analytics"
      module-name="数据分析"
      permission-code="analytics:view"
    >
      <!-- 权限验证通过后的内容 -->
      <div class="admin-page-content">
        <!-- 页面头部 -->
        <PageHeader
          icon="fas fa-chart-line"
          title="数据分析"
        >
          <template #actions>
            <el-button
              v-if="canViewAnalyticsField('system_info.operations')"
              type="info"
              :icon="Refresh"
              :loading="refreshing"
              :disabled="refreshing"
              @click="refreshData"
            >
              刷新
            </el-button>
            <el-button
              v-if="canExport && canViewAnalyticsField('system_info.operations')"
              type="success"
              :icon="Download"
              @click="exportAnalyticsData"
            >
              导出报告
            </el-button>
          </template>
        </PageHeader>

        <!-- 公共检索区域 -->
        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="loading"
        >
          <template #primary>
            <el-input
              :model-value="getSearchSummary()"
              disabled
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-filter" />
              </template>
            </el-input>
          </template>

          <template #actions>
            <el-button
              type="primary"
              :loading="loading"
              @click="handleSearch"
            >
              查询
            </el-button>
            <el-button
              type="default"
              @click="handleReset"
            >
              重置
            </el-button>
          </template>

          <!-- 日期范围 -->
          <div class="form-group filter-item">
            <el-date-picker
              v-model="filterStartDate"
              type="date"
              placeholder="开始日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :clearable="true"
            />
          </div>
          <div class="form-group filter-item">
            <el-date-picker
              v-model="filterEndDate"
              type="date"
              placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :clearable="true"
            />
          </div>
          <!-- 快捷选择 -->
          <div class="form-group filter-item">
            <el-select
              v-model="filterQuickSelect"
              placeholder="快捷选择"
              clearable
              @change="handleQuickSelect"
            >
              <el-option
                label="今天"
                value="today"
              />
              <el-option
                label="昨天"
                value="yesterday"
              />
              <el-option
                label="本周"
                value="thisWeek"
              />
              <el-option
                label="上周"
                value="lastWeek"
              />
              <el-option
                label="本月"
                value="thisMonth"
              />
              <el-option
                label="上月"
                value="lastMonth"
              />
              <el-option
                label="本年"
                value="thisYear"
              />
              <el-option
                label="去年"
                value="lastYear"
              />
              <el-option
                label="最近7天"
                value="last7Days"
              />
              <el-option
                label="最近30天"
                value="last30Days"
              />
              <el-option
                label="最近90天"
                value="last90Days"
              />
            </el-select>
          </div>
          <!-- 店铺选择 -->
          <div class="form-group filter-item">
            <el-select
              v-model="filterStoreId"
              placeholder="全部店铺"
              clearable
            >
              <el-option
                label="全部店铺"
                value=""
              />
              <el-option
                v-for="store in storeList"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </div>
          <!-- 供应商选择 -->
          <div class="form-group filter-item">
            <el-select
              v-model="filterSupplierId"
              placeholder="全部供应商"
              clearable
              filterable
            >
              <el-option
                label="全部供应商"
                value=""
              />
              <el-option
                v-for="supplier in supplierList"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <!-- 核心分析标签页 -->
        <div class="analytics-tabs admin-page-content">
          <!-- TAB导航 -->
          <div
            v-if="visibleAnalyticsTabs.length"
            class="tab-navigation tf-page-tabs"
          >
            <el-button
              v-for="tab in visibleAnalyticsTabs"
              :key="tab.key"
              :type="activeTab === tab.key ? 'primary' : 'default'"
              @click="activeTab = tab.key"
            >
              <i :class="tab.icon" />
              {{ tab.label }}
            </el-button>
          </div>

          <!-- TAB内容 -->
          <div
            v-if="visibleAnalyticsTabs.length"
            class="tab-content tf-tab-content"
          >
            <template
              v-for="tab in visibleAnalyticsTabs"
              :key="tab.key"
            >
              <div
                v-if="activeTab === tab.key"
                class="tab-panel tf-tab-panel"
              >
                <KeepAlive>
                  <component
                    :is="tab.component"
                    ref="activeAnalyticsRef"
                    :loading="loading"
                    :is-active="activeTab === tab.key"
                    :start-date="searchParams.start_date"
                    :end-date="searchParams.end_date"
                    :store-id="searchParams.store_id"
                    :supplier-id="searchParams.supplier_id"
                    :search-trigger="searchTrigger"
                    @loading-change="handleTabLoading"
                  />
                </KeepAlive>
              </div>
            </template>
          </div>
          <DataEmptyState
            v-else
            state="permission"
            size="page"
            description="当前角色未开启任何分析分组字段，请在字段权限中开启对应子页面"
          />
        </div>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, onMounted } from 'vue'
import {
  Refresh,
  Download
} from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { PermissionGate, PageHeader } from '@/components/base'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { extractResponseData } from '@/utils/api-response'

const SalesAnalytics = defineAsyncComponent(() => import('./page/SalesAnalytics.vue'))
const InventoryAnalytics = defineAsyncComponent(() => import('./page/InventoryAnalytics.vue'))
const CustomerAnalytics = defineAsyncComponent(() => import('./page/CustomerAnalytics.vue'))
const EmployeeAnalytics = defineAsyncComponent(() => import('./page/EmployeeAnalytics.vue'))
const TransferAnalytics = defineAsyncComponent(() => import('./page/TransferAnalytics.vue'))
const ProfitAnalytics = defineAsyncComponent(() => import('./page/ProfitAnalytics.vue'))

const { success, error } = useNotification()
const { exportTextFile, buildDateFilename } = useImportExport()

const { canView, canExport, handleNoPermission } = usePagePermissions('analytics')
const ANALYTICS_MODULE_KEY = 'analytics_analyticsview'

// 公共检索参数
const searchExpanded = ref(false)
const filterStartDate = ref('')
const filterEndDate = ref('')
const filterQuickSelect = ref('')
const filterStoreId = ref('')
const filterSupplierId = ref('')
const storeList = ref<any[]>([])
const supplierList = ref<any[]>([])
const searchTrigger = ref(0)

interface AnalyticsSearchParams {
  start_date: string
  end_date: string
  store_id: string
  supplier_id: string
}

// 页面筛选统一使用 API 契约中的 snake_case；子页面的 prop 名称仅是 Vue 展示层边界。
const searchParams = computed<AnalyticsSearchParams>(() => ({
  start_date: filterStartDate.value,
  end_date: filterEndDate.value,
  store_id: filterStoreId.value,
  supplier_id: filterSupplierId.value
}))

// 响应式数据
const activeTab = ref('sales')
const { loading } = useLoadingState()
const { loading: refreshing } = useLoadingState()
const activeAnalyticsRef = ref<any>(null)

const analyticsTabs = [
  {
    key: 'sales',
    groupKey: 'sales',
    label: '销售分析',
    icon: 'fas fa-shopping-cart',
    component: SalesAnalytics,
    accessField: 'sales.tab_access',
    contentFields: [
      'sales.total_sales',
      'sales.total_orders',
      'sales.new_sales_count',
      'sales.used_sales_count',
      'sales.average_order_value',
      'sales.conversion_rate',
      'sales.sales_trend_chart',
      'sales.product_distribution_chart',
      'sales.top_products_table',
      'sales.store_comparison_chart',
      'sales.sales_forecast_chart'
    ]
  },
  {
    key: 'inventory',
    groupKey: 'inventory',
    label: '库存分析',
    icon: 'fas fa-boxes',
    component: InventoryAnalytics,
    accessField: 'inventory.tab_access',
    contentFields: [
      'inventory.total_products',
      'inventory.total_value',
      'inventory.warning_summary',
      'inventory.supplier_count',
      'inventory.low_stock_dialog',
      'inventory.recent_sales_table',
      'inventory.category_distribution_chart',
      'inventory.turnover_trend_chart',
      'inventory.low_stock_table'
    ]
  },
  {
    key: 'customers',
    groupKey: 'customer',
    label: '客户分析',
    icon: 'fas fa-users',
    component: CustomerAnalytics,
    accessField: 'customer.tab_access',
    contentFields: [
      'customer.overview_stats',
      'customer.growth_chart',
      'customer.segment_chart',
      'customer.retention_chart',
      'customer.activity_chart',
      'customer.customer_list',
      'customer.customer_detail',
      'customer.behavior_insights'
    ]
  },
  {
    key: 'employee',
    groupKey: 'employee',
    label: '员工分析',
    icon: 'fas fa-user-tie',
    component: EmployeeAnalytics,
    accessField: 'employee.tab_access',
    contentFields: [
      'employee.overview_stats',
      'employee.role_distribution_chart',
      'employee.sales_compare_chart',
      'employee.salary_trend_chart',
      'employee.attendance_chart',
      'employee.performance_table',
      'employee.attendance_records_table'
    ]
  },
  {
    key: 'transfer',
    groupKey: 'transfer',
    label: '划拨批发',
    icon: 'fas fa-exchange-alt',
    component: TransferAnalytics,
    accessField: 'transfer.tab_access',
    contentFields: [
      'transfer.wholesale_count',
      'transfer.wholesale_profit',
      'transfer.allocation_count',
      'transfer.allocation_amount',
      'transfer.trend_chart',
      'transfer.wholesale_rank_chart',
      'transfer.allocation_rank_chart',
      'transfer.store_distribution_chart',
      'transfer.operation_records_table'
    ]
  },
  {
    key: 'profit',
    groupKey: 'profit',
    label: '盈利分析',
    icon: 'fas fa-chart-line',
    component: ProfitAnalytics,
    accessField: 'profit.tab_access',
    contentFields: [
      'profit.date_range',
      'profit.quick_select',
      'profit.store_filter',
      'profit.total_revenue',
      'profit.total_cost',
      'profit.gross_profit',
      'profit.total_sales_count',
      'profit.new_sales_stats',
      'profit.used_sales_stats',
      'profit.brand_ranking',
      'profit.model_ranking',
      'profit.store_profit_ranking',
      'profit.employee_performance_table',
      'profit.metrics_cards',
      'profit.profit_trend_chart',
      'profit.forecast_chart',
      'profit.product_profit_chart',
      'profit.store_comparison_chart',
      'profit.cost_analysis_table'
    ]
  }
] as const

const canViewAnalyticsField = (fieldKey: string) => {
  return fieldPermissions.isFieldVisible(ANALYTICS_MODULE_KEY, fieldKey)
}

const canViewAnyAnalyticsField = (fieldKeys: readonly string[]) => {
  return fieldKeys.some(fieldKey => canViewAnalyticsField(fieldKey))
}

const visibleAnalyticsTabs = computed(() => {
  return analyticsTabs.filter(tab => (
    canViewAnalyticsField(tab.accessField) &&
    canViewAnyAnalyticsField(tab.contentFields)
  ))
})

watch(visibleAnalyticsTabs, (tabs) => {
  if (!tabs.length) {
    activeTab.value = ''
    return
  }

  if (!tabs.some(tab => tab.key === activeTab.value)) {
    activeTab.value = tabs[0].key
  }
}, { immediate: true })

// 快捷日期选择
const handleQuickSelect = (value: string) => {
  const today = TimeUtil.now()
  const year = today.year()
  const month = today.month()
  const _day = today.date()

  switch (value) {
  case 'today':
    filterStartDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'yesterday':
    const yesterday = TimeUtil.subtract(today, 1, 'day')
    filterStartDate.value = TimeUtil.format(yesterday, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(yesterday, TIME_FORMATS.DATE)
    break
  case 'thisWeek':
    const weekStart = TimeUtil.startOf(today, 'week').add(1, 'day') // 周一
    filterStartDate.value = TimeUtil.format(weekStart, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'lastWeek':
    const lastWeekStart = TimeUtil.startOf(today, 'week').subtract(6, 'day')
    const lastWeekEnd = lastWeekStart.add(6, 'day')
    filterStartDate.value = TimeUtil.format(lastWeekStart, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(lastWeekEnd, TIME_FORMATS.DATE)
    break
  case 'thisMonth':
    filterStartDate.value = `${year}-${String(month + 1).padStart(2, '0')}-01`
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'lastMonth':
    filterStartDate.value = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDayOfLastMonth = TimeUtil.endOf(today.subtract(1, 'month'), 'month').date()
    filterEndDate.value = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfLastMonth).padStart(2, '0')}`
    break
  case 'thisYear':
    filterStartDate.value = `${year}-01-01`
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'lastYear':
    filterStartDate.value = `${year - 1}-01-01`
    filterEndDate.value = `${year - 1}-12-31`
    break
  case 'last7Days':
    const d7 = TimeUtil.subtract(today, 7, 'day')
    filterStartDate.value = TimeUtil.format(d7, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'last30Days':
    const d30 = TimeUtil.subtract(today, 30, 'day')
    filterStartDate.value = TimeUtil.format(d30, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  case 'last90Days':
    const d90 = TimeUtil.subtract(today, 90, 'day')
    filterStartDate.value = TimeUtil.format(d90, TIME_FORMATS.DATE)
    filterEndDate.value = TimeUtil.format(today, TIME_FORMATS.DATE)
    break
  default:
    return
  }
  handleSearch()
}

// 执行搜索
const handleSearch = () => {
  searchTrigger.value++
}

// 重置搜索条件
const handleReset = () => {
  filterStartDate.value = ''
  filterEndDate.value = ''
  filterQuickSelect.value = ''
  filterStoreId.value = ''
  filterSupplierId.value = ''
  searchTrigger.value++
}

// 获取搜索摘要
const getSearchSummary = () => {
  const parts: string[] = []

  if (filterStartDate.value || filterEndDate.value) {
    if (filterStartDate.value && filterEndDate.value) {
      parts.push(`${filterStartDate.value} 至 ${filterEndDate.value}`)
    } else if (filterStartDate.value) {
      parts.push(`从 ${filterStartDate.value}`)
    } else if (filterEndDate.value) {
      parts.push(`至 ${filterEndDate.value}`)
    }
  }

  const selectedStore = storeList.value.find(s => String(s.id) === String(filterStoreId.value))
  if (selectedStore) {
    parts.push(selectedStore.name)
  }

  const selectedSupplier = supplierList.value.find(s => String(s.id) === String(filterSupplierId.value))
  if (selectedSupplier) {
    parts.push(selectedSupplier.name)
  }

  return parts.length > 0 ? parts.join(' | ') : '数据分析筛选'
}

// 加载店铺列表
const loadStoreList = async () => {
  try {
    const { unifiedApi } = await import('@/utils/unified-api')
    const response = await unifiedApi.get('/stores', { params: { all: true } })
    if (response.success) {
      const stores = extractResponseData<any[]>(response)
      storeList.value = Array.isArray(stores) ? sortOptionsByOrder(stores) : []
    } else {
      storeList.value = []
    }
  } catch (err) {
    storeList.value = []
    logger.error('加载店铺列表失败:', err)
  }
}

// 加载供应商列表
const loadSupplierList = async () => {
  try {
    const { unifiedApi } = await import('@/utils/unified-api')
    const response = await unifiedApi.get('/suppliers', { params: { page: 1, page_size: 10000 } })
    if (response.success) {
      const suppliers = extractResponseData<any[]>(response)
      supplierList.value = Array.isArray(suppliers) ? sortOptionsByOrder(suppliers) : []
    } else {
      supplierList.value = []
    }
  } catch (err) {
    supplierList.value = []
    logger.error('加载供应商列表失败:', err)
  }
}

const handleTabLoading = (tabLoadingState: boolean) => {
  if (refreshing.value) {
    return
  }
  loading.value = tabLoadingState
}

const refreshData = async () => {
  if (!canView.value) {
    return
  }

  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    if (activeAnalyticsRef.value?.refreshSilently) {
      await activeAnalyticsRef.value.refreshSilently()
    }
    success('数据刷新成功')
  } catch (err) {
    error('数据刷新失败')
  } finally {
    refreshing.value = false
  }
}

// 导出分析数据
const exportAnalyticsData = () => {
  if (!canExport.value) {
    handleNoPermission('export')
    return
  }

  try {
    // 准备导出数据
    const exportData = {
      activeTab: activeTab.value,
      exportTime: TimeUtil.now().toISOString()
    }

    void exportTextFile({
      content: JSON.stringify(exportData, null, 2),
      filename: buildDateFilename('analytics-report', 'json'),
      mimeType: 'application/json;charset=utf-8;',
      successMessage: '分析报告导出成功',
      errorMessage: '分析报告导出失败'
    })
  } catch (err) {
    error('分析报告导出失败')
  }
}

// 生命周期
onMounted(() => {
  if (!canView.value) {
    return
  }

  void fieldPermissions.init()
  loadStoreList()  // 加载店铺列表
  loadSupplierList()  // 加载供应商列表
})

</script>

<style lang="scss" scoped>
.analytics-view {
  padding: 24px;
  background: var(--el-bg-color-page);
  min-height: 100vh;
}

.analytics-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  border: 1px solid var(--tf-color-border-cool);
  color: var(--color-text-regular);
  text-align: center;
}

// 响应式
@media (max-width: 768px) {
  .analytics-view {
    padding-inline: var(--admin-page-gap-x);
    padding-top: 10px;
  }

}
</style>
