<template>
  <div
    v-tf-loading="{ active: loading, text: '正在刷新综合预警...' }"
    class="comprehensive-warnings"
  >
    <!-- 预警概览卡片 -->
    <div
      class="stats-cards"
      role="region"
      aria-label="综合预警统计"
      tabindex="0"
    >
      <div
        class="stat-card stat-card--primary"
        :class="{ active: activeTab === 'phones' }"
        @click="showWarningDetail('phones')"
      >
        <div class="stat-icon">
          <i class="fas fa-mobile-alt" />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ warningsData.phones?.count || 0 }}
          </div>
          <div class="stat-label">
            手机预警
          </div>
        </div>
      </div>

      <div
        v-if="canViewAccessoryWarnings"
        class="stat-card stat-card--warning"
        :class="{ active: activeTab === 'accessories' }"
        @click="showWarningDetail('accessories')"
      >
        <div class="stat-icon">
          <i class="fas fa-cube" />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ warningsData.accessories?.count || 0 }}
          </div>
          <div class="stat-label">
            配件预警
          </div>
        </div>
      </div>

      <div
        class="stat-card stat-card--success"
        :class="{ active: activeTab === 'sales' }"
        @click="showWarningDetail('sales')"
      >
        <div class="stat-icon">
          <i class="fas fa-chart-line" />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ salesStatus }}
          </div>
          <div class="stat-label">
            销售预警
          </div>
        </div>
      </div>

      <div
        class="stat-card stat-card--accent"
        :class="{ active: activeTab === 'purchases' }"
        @click="showWarningDetail('purchases')"
      >
        <div class="stat-icon">
          <i class="fas fa-truck" />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ warningsData.purchases?.no_recent?.length || 0 }}
          </div>
          <div class="stat-label">
            待入库
          </div>
        </div>
      </div>
    </div>

    <!-- 预警详情 -->
    <div class="warning-detail">
      <!-- 手机库存预警 -->
      <div
        v-show="activeTab === 'phones'"
        class="detail-section"
      >
        <div class="section-header">
          <h4>
            <i class="fas fa-mobile-alt" />
            手机库存预警详情
          </h4>
          <div class="header-actions">
            <el-tag
              size="small"
              type="info"
            >
              自定义阈值
            </el-tag>
            <el-button
              type="primary"
              link
              @click="goToWarningConfig"
            >
              <i class="fas fa-cog" />
              配置预警
            </el-button>
          </div>
        </div>

        <el-table
          v-table-double-tap="phoneDetailTapOptions"
          :data="phoneWarnings"
          class="data-table compact-fit-table"
          stripe
          border
          max-height="400"
          :fit="true"
          @row-dblclick="phoneDetailDoubleClick"
        >
          <el-table-column
            prop="brand_name"
            label="品牌"
            min-width="80"
          />
          <el-table-column
            prop="model_name"
            label="型号"
            min-width="120"
          />
          <el-table-column
            prop="color_name"
            label="颜色"
            min-width="80"
          />
          <el-table-column
            prop="memory_name"
            label="内存"
            min-width="80"
          />
          <el-table-column
            prop="warning_threshold"
            label="预警阈值"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span class="warning-threshold-text">{{ row.warning_threshold ?? 3 }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="stock_count"
            label="库存"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getStockDisplayText(row.stock_count) === '缺货'"
                class="out-of-stock-text"
              >
                缺货
              </span>
              <el-tag
                v-else
                :type="getStockTagType(row.stock_count, row.warning_threshold)"
                size="small"
              >
                {{ getStockDisplayText(row.stock_count) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="new_count"
            label="全新"
            min-width="60"
            align="center"
          />
          <el-table-column
            prop="used_count"
            label="二手"
            min-width="60"
            align="center"
          />
          <el-table-column
            v-if="!isMobile"
            label="操作"
            :width="$getActionColumnWidth(['查看'])"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="action-buttons table-actions">
                <el-button
                  type="primary"
                  link
                  @click.stop="viewPhoneDetail(row)"
                >
                  查看
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <DataEmptyState
          v-if="!phoneWarnings.length"
          description="暂无手机库存预警"
        />
      </div>

      <!-- 配件库存预警 -->
      <div
        v-if="canViewAccessoryWarnings"
        v-show="activeTab === 'accessories'"
        class="detail-section"
      >
        <div class="section-header">
          <h4>
            <i class="fas fa-cube" />
            配件库存预警详情
          </h4>
        </div>

        <el-table
          v-table-double-tap="accessoryDetailTapOptions"
          :data="accessoryWarnings"
          class="data-table compact-fit-table"
          stripe
          border
          max-height="400"
          :fit="true"
          @row-dblclick="accessoryDetailDoubleClick"
        >
          <el-table-column
            prop="name"
            label="配件名称"
            min-width="180"
            class-name="complete-text-column"
          />
          <el-table-column
            prop="stock"
            label="当前库存"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                :type="getStockTagType(row.stock, row.min_stock)"
                size="small"
              >
                {{ row.stock }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="min_stock"
            label="最低库存"
            width="100"
            align="center"
          />
          <el-table-column
            prop="status"
            label="状态"
            width="100"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.status === '已缺货' ? 'danger' : 'warning'"
                size="small"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile"
            label="操作"
            :width="$getActionColumnWidth(['查看'])"
            align="center"
            class-name="actions-column"
          >
            <template #default>
              <div class="action-buttons table-actions">
                <el-button
                  type="primary"
                  link
                  @click.stop="goToAccessories"
                >
                  查看
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <DataEmptyState
          v-if="!warningsData.accessories?.warnings?.length"
          description="暂无配件库存预警"
        />
      </div>

      <!-- 销售预警 -->
      <div
        v-show="activeTab === 'sales'"
        class="detail-section"
      >
        <div class="section-header">
          <h4>
            <i class="fas fa-chart-line" />
            销售预警分析
          </h4>
        </div>

        <div class="sales-summary">
          <div class="summary-item">
            <span class="label">今日销售</span>
            <span class="value">{{ warningsData.sales?.today?.sales_count || 0 }} 台</span>
          </div>
          <div class="summary-item">
            <span class="label">今日金额</span>
            <span class="value">¥{{ formatAmount(warningsData.sales?.today?.total_amount || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">今日利润</span>
            <span class="value profit">¥{{ formatAmount(warningsData.sales?.today?.total_profit || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">销售人数</span>
            <span class="value">{{ warningsData.sales?.today?.operator_count || 0 }} 人</span>
          </div>
          <div class="summary-item">
            <span class="label">日均销售</span>
            <span class="value">{{ warningsData.sales?.avg_daily_sales || 0 }} 台</span>
          </div>
          <div class="summary-item">
            <span class="label">销售趋势</span>
            <span
              class="value"
              :class="{ below: warningsData.sales?.is_below_average }"
            >
              <i :class="warningsData.sales?.is_below_average ? 'fas fa-arrow-down' : 'fas fa-arrow-up'" />
              {{ warningsData.sales?.is_below_average ? '低于平均' : '正常' }}
            </span>
          </div>
        </div>

        <!-- 销售趋势图表 -->
        <div class="sales-trend">
          <h5>近7天销售趋势</h5>
          <div class="trend-list">
            <div
              v-for="(item, index) in warningsData.sales?.trend || []"
              :key="index"
              class="trend-item"
            >
              <span class="trend-date">{{ formatDate(item.sale_time) }}</span>
              <div class="trend-bar">
                <div
                  class="bar-fill"
                  :style="{ width: getTrendWidth(item.sales_count) + '%' }"
                />
              </div>
              <span class="trend-count">{{ item.sales_count }} 台</span>
              <span class="trend-amount">¥{{ formatAmount(item.total_amount) }}</span>
            </div>
          </div>
        </div>

        <!-- 销售提示 -->
        <div
          v-if="warningsData.sales?.today?.sales_count === 0"
          class="sales-alert"
        >
          <el-alert
            title="今日暂无销售记录"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              今天还没有销售记录，加油！
            </template>
          </el-alert>
        </div>

        <div
          v-else-if="warningsData.sales?.is_below_average"
          class="sales-alert"
        >
          <el-alert
            title="销售低于平均水平"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              今日销售（{{ warningsData.sales?.today?.sales_count || 0 }} 台）低于 7 日平均水平（{{ warningsData.sales?.avg_daily_sales || 0 }} 台），建议加强推广
            </template>
          </el-alert>
        </div>

        <div
          v-else
          class="sales-alert"
        >
          <el-alert
            title="销售状况良好"
            type="success"
            :closable="false"
            show-icon
          >
            <template #default>
              今日销售（{{ warningsData.sales?.today?.sales_count || 0 }} 台）达到或超过平均水平，继续保持！
            </template>
          </el-alert>
        </div>

        <DataEmptyState
          v-if="!warningsData.sales?.trend?.length && !warningsData.sales?.today?.sales_count"
          description="暂无销售数据"
        />
      </div>

      <!-- 入库预警 -->
      <div
        v-show="activeTab === 'purchases'"
        class="detail-section"
      >
        <div class="section-header">
          <h4>
            <i class="fas fa-truck" />
            入库预警详情
          </h4>
        </div>

        <div class="purchase-alert">
          <el-alert
            title="长期未入库供应商"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              长期未入库供应商，请留意合作动向！
            </template>
          </el-alert>
        </div>

        <el-table
          v-table-double-tap="purchaseDetailTapOptions"
          :data="purchaseWarnings"
          class="data-table compact-fit-table"
          stripe
          border
          max-height="400"
          :fit="true"
          @row-dblclick="purchaseDetailDoubleClick"
        >
          <el-table-column
            prop="supplier_name"
            label="供应商名称"
            min-width="180"
            class-name="complete-text-column"
          />
          <el-table-column
            prop="last_inventory_time"
            label="最后入库日期"
            width="120"
          >
            <template #default="{ row }">
              {{ formatGlobalDate(row.last_inventory_time, '无记录') }}
            </template>
          </el-table-column>
          <el-table-column
            prop="days_since_purchase"
            label="未入库天数"
            width="110"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                :type="getDaysTagType(row.days_since_purchase)"
                size="small"
              >
                {{ row.days_since_purchase }} 天
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile"
            label="操作"
            :width="$getActionColumnWidth(['查看'])"
            align="center"
            class-name="actions-column"
          >
            <template #default>
              <div class="action-buttons table-actions">
                <el-button
                  type="primary"
                  link
                  @click.stop="goToSuppliers"
                >
                  查看
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <DataEmptyState
          v-if="!warningsData.purchases?.no_recent?.length"
          description="所有供应商入库正常"
        />
      </div>
    </div>
    <RecordDetailDialog
      v-model="phoneDetailVisible"
      title="手机库存预警"
      :fields="phoneDetailFields"
      :record="phoneDetailRow"
      :has-actions="canAccessRoutePath('/inventory', authStore)"
    >
      <template #actions>
        <el-button
          v-permission="'inventory:view'"
          type="primary"
          @click.stop="phoneRunAction(viewPhoneDetail)"
        >
          查看库存
        </el-button>
      </template>
    </RecordDetailDialog>
    <RecordDetailDialog
      v-model="accessoryDetailVisible"
      title="配件库存预警"
      :fields="accessoryDetailFields"
      :record="accessoryDetailRow"
      :has-actions="canAccessRoutePath('/accessories', authStore)"
    >
      <template #actions>
        <el-button
          v-permission="'accessories:view'"
          type="primary"
          @click.stop="accessoryRunAction(goToAccessories)"
        >
          查看配件
        </el-button>
      </template>
    </RecordDetailDialog>
    <RecordDetailDialog
      v-model="purchaseDetailVisible"
      title="供应商入库预警"
      :fields="purchaseDetailFields"
      :record="purchaseDetailRow"
      :has-actions="canAccessRoutePath('/suppliers', authStore)"
    >
      <template #actions>
        <el-button
          v-permission="'suppliers:view'"
          type="primary"
          @click.stop="purchaseRunAction(goToSuppliers)"
        >
          查看供应商
        </el-button>
      </template>
    </RecordDetailDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { formatDate as formatGlobalDate, formatAmount } from '@/utils/format'
import type { ComprehensiveWarningsData, PhoneStockWarning } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import type { RecordDetailField } from '@/types/component'
const globalNotifications = useNotification()


const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useMobile()
const accessoryPermissions = usePagePermissions('accessories')
const canViewAccessoryWarnings = computed(() => (accessoryPermissions.canView.value || authStore.hasPermission('dashboard:goods-warning')) &&
  ['basic_info.name', 'stock_info.min_stock', 'stock_info.total_quantity'].every(field =>
    fieldPermissions.isFieldVisible('accessories_accessoriesview', field)))

// 响应式数据
const loading = ref(false)
const activeTab = ref('phones')
const createEmptyWarningsData = (): ComprehensiveWarningsData => ({
  phones: { warnings: [], count: 0, threshold: 3 },
  accessories: { warnings: [], count: 0 },
  sales: {
    today: { sales_count: 0, total_amount: 0, total_profit: 0, operator_count: 0 },
    trend: [],
    avg_daily_sales: 0,
    is_below_average: false
  },
  purchases: { recent: [], no_recent: [] }
})
const warningsData = ref<ComprehensiveWarningsData>(createEmptyWarningsData())
let warningTimer: ReturnType<typeof setInterval> | null = null

// 计算属性
const salesStatus = computed(() => {
  if (warningsData.value.sales?.is_below_average) {
    return '偏低'
  }
  return '正常'
})

const phoneWarnings = computed(() => {
  const phoneList = warningsData.value?.phones?.warnings
  if (Array.isArray(phoneList) && phoneList.length > 0) {
    return phoneList
  }

  const modelList = warningsData.value?.models?.warnings
  if (Array.isArray(modelList)) {
    return modelList
  }

  return []
})

const accessoryWarnings = computed(() => warningsData.value.accessories?.warnings || [])
const purchaseWarnings = computed(() => warningsData.value.purchases?.no_recent || [])
const detailEnabled = computed(() => isMobile.value && canAccessRoutePath('/dashboard', authStore))
const { detailRow: phoneDetailRow, detailVisible: phoneDetailVisible, doubleTapOptions: phoneDetailTapOptions,
  handleRowDoubleClick: phoneDetailDoubleClick, runDetailAction: phoneRunAction } = useMobileTableDetail({
  enabled: detailEnabled, rows: phoneWarnings,
  getKey: row => JSON.stringify([row.brand_name, row.model_name, row.color_name, row.memory_name])
})
const { detailRow: accessoryDetailRow, detailVisible: accessoryDetailVisible, doubleTapOptions: accessoryDetailTapOptions,
  handleRowDoubleClick: accessoryDetailDoubleClick, runDetailAction: accessoryRunAction } = useMobileTableDetail({
  enabled: detailEnabled, rows: accessoryWarnings, getKey: row => row.name
})
const { detailRow: purchaseDetailRow, detailVisible: purchaseDetailVisible, doubleTapOptions: purchaseDetailTapOptions,
  handleRowDoubleClick: purchaseDetailDoubleClick, runDetailAction: purchaseRunAction } = useMobileTableDetail({
  enabled: detailEnabled, rows: purchaseWarnings, getKey: row => row.supplier_name
})
const phoneDetailFields = computed<RecordDetailField[]>(() => {
  const row = phoneDetailRow.value
  return row ? [
    { key: 'brand', label: '品牌', value: row.brand_name, visible: true },
    { key: 'model', label: '型号', value: row.model_name, visible: true },
    { key: 'color', label: '颜色', value: row.color_name, visible: true },
    { key: 'memory', label: '内存', value: row.memory_name, visible: true },
    { key: 'threshold', label: '预警阈值', value: row.warning_threshold ?? 3, visible: true },
    { key: 'stock', label: '库存', value: row.stock_count, visible: true },
    { key: 'new', label: '全新', value: row.new_count, visible: true },
    { key: 'used', label: '二手', value: row.used_count, visible: true }
  ] : []
})
const accessoryDetailFields = computed<RecordDetailField[]>(() => {
  const row = accessoryDetailRow.value
  return row ? [
    { key: 'name', label: '配件', value: row.name, visible: true },
    { key: 'stock', label: '库存', value: row.stock, visible: true },
    { key: 'min', label: '最低库存', value: row.min_stock, visible: true },
    { key: 'status', label: '库存状态', value: row.status || (row.stock === 0 ? '已缺货' : row.stock <= row.min_stock ? '库存不足' : '正常'), visible: true }
  ] : []
})
const purchaseDetailFields = computed<RecordDetailField[]>(() => {
  const row = purchaseDetailRow.value
  return row ? [
    { key: 'supplier', label: '供应商', value: row.supplier_name, visible: true },
    { key: 'days', label: '未入库天数', value: row.days_since_purchase, visible: true },
    { key: 'last', label: '最近入库', value: formatGlobalDate(row.last_inventory_time, '无记录'), visible: true }
  ] : []
})

const resetWarnings = () => {
  warningsData.value = createEmptyWarningsData()
}

// 获取预警数据
const fetchWarnings = async () => {
  if (!canAccessRoutePath('/dashboard', authStore)) {
    resetWarnings()
    return
  }

  loading.value = true
  try {
    const response = await unifiedApi.get<ComprehensiveWarningsData>('/dashboard/warnings/comprehensive', {
      params: { phone_threshold: 3, page_size: 20 }
    })

    if (response.success) {
      warningsData.value = {
        ...createEmptyWarningsData(),
        ...response.data
      }
    }
  } catch (error) {
    // 获取预警数据失败，忽略
  } finally {
    loading.value = false
  }
}

// 切换预警详情
const showWarningDetail = (tab: string) => {
  activeTab.value = tab
}

// 获取库存标签类型（支持自定义阈值）
const getStockTagType = (stock: number, threshold?: number) => {
  const warningThreshold = threshold ?? 3
  if (stock === 0) return 'danger'
  if (stock <= warningThreshold) return 'warning'
  return 'success'
}

const getStockDisplayText = (stock: number) => {
  if (stock === 0) return '缺货'
  return String(stock)
}

// 获取天数标签类型
const getDaysTagType = (days: number) => {
  if (days >= 30) return 'danger'
  if (days >= 14) return 'warning'
  return 'info'
}

// 获取趋势宽度百分比
const getTrendWidth = (count: number) => {
  const maxCount = Math.max(
    ...(warningsData.value.sales?.trend?.map(trend => trend.sales_count) || [1])
  )
  return maxCount > 0 ? (count / maxCount) * 100 : 0
}

// 格式化数字

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return formatGlobalDate(dateStr).slice(5).replace('-', '/')
}

const guardedPush = (target: string | { path: string; query?: Record<string, string> }) => {
  const path = typeof target === 'string' ? target : target.path

  if (!canAccessRoutePath(path, authStore)) {
    globalNotifications.warning('您没有访问此页面的权限')
    return
  }

  router.push(target)
}

// 查看手机详情
const viewPhoneDetail = (row: PhoneStockWarning) => {
  guardedPush({
    path: '/inventory',
    query: {
      brand: row.brand_name,
      model: row.model_name,
      color: row.color_name,
      memory: row.memory_name
    }
  })
}

// 跳转到配件页面
const goToAccessories = () => {
  guardedPush('/accessories')
}

// 跳转到供应商页面
const goToSuppliers = () => {
  guardedPush('/suppliers')
}

// 跳转到预警配置页面
const goToWarningConfig = () => {
  guardedPush('/system?tab=warning')
}

// 生命周期
onMounted(() => {
  fetchWarnings()

  // 每5分钟自动刷新
  warningTimer = setInterval(() => {
    fetchWarnings()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (warningTimer) {
    clearInterval(warningTimer)
    warningTimer = null
  }
})
</script>

<style lang="scss" scoped src="./styles/comprehensive-warnings/overview.scss"></style>
<style lang="scss" scoped src="./styles/comprehensive-warnings/details.scss"></style>
<style lang="scss" scoped src="./styles/comprehensive-warnings/responsive.scss"></style>
