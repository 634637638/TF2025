<template>
  <div class="inventory-analytics">
    <el-row :gutter="16" class="overview-cards">
      <el-col v-if="canViewInventoryField('total_products')" :xs="24" :sm="12" :lg="6">
        <el-card class="insight-card insight-card--primary" shadow="hover">
          <div class="insight-card__header">
            <div class="insight-card__icon">
              <Box />
            </div>
            <el-tag round effect="dark" type="primary">
              健康 {{ inventoryData.inventoryHealth.score }}
            </el-tag>
          </div>
          <div class="insight-card__label">在库总数</div>
          <div class="insight-card__value">{{ formatNumber(inventoryData.totalProducts) }}</div>
          <div class="insight-card__meta">当前可售设备总量</div>
          <div class="insight-card__footer">
            <span>健康等级 {{ healthLevelText }}</span>
            <span>周转 {{ formatDecimal(inventoryData.stockTurnover) }}</span>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewInventoryField('total_value')" :xs="24" :sm="12" :lg="6">
        <el-card class="insight-card insight-card--success" shadow="hover">
          <div class="insight-card__header">
            <div class="insight-card__icon">
              <Money />
            </div>
            <el-tag round type="success">单台均值 ¥{{ formatNumber(averageUnitCost) }}</el-tag>
          </div>
          <div class="insight-card__label">在库价值</div>
          <div class="insight-card__value insight-card__value--currency">
            ¥{{ formatNumber(inventoryData.totalValue) }}
          </div>
          <div class="insight-card__meta">按在库成本实时汇总</div>
          <div class="insight-card__footer">
            <span>近10台成交 ¥{{ formatNumber(recentSalesSummary.totalSales) }}</span>
            <span>最近门店 {{ recentSalesSummary.latestStore }}</span>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewInventoryField('warning_summary')" :xs="24" :sm="12" :lg="6">
        <el-card class="insight-card insight-card--warning clickable" shadow="hover" @click="showLowStockDialog = true">
          <div class="insight-card__header">
            <div class="insight-card__icon">
              <Warning />
            </div>
            <el-tag
              round
              :type="warningSummary.criticalCount > 0 ? 'danger' : 'warning'"
            >
              {{ warningSummary.criticalCount > 0 ? '存在售罄' : '按预警配置' }}
            </el-tag>
          </div>
          <div class="insight-card__label">库存预警</div>
          <div class="insight-card__value">{{ formatNumber(warningSummary.total) }}</div>
          <div class="insight-card__meta">统一取自系统预警配置</div>
          <div class="insight-card__footer">
            <span>售罄 {{ formatNumber(warningSummary.criticalCount) }}</span>
            <span>缺口 {{ formatNumber(warningSummary.shortageUnits) }} 台</span>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewInventoryField('supplier_count')" :xs="24" :sm="12" :lg="6">
        <el-card class="insight-card insight-card--supplier" shadow="hover">
          <div class="insight-card__header">
            <div class="insight-card__icon">
              <ShoppingCart />
            </div>
            <el-tag round type="info">均分 {{ formatDecimal(supplierQualityAverage) }}</el-tag>
          </div>
          <div class="insight-card__label">有货供应商</div>
          <div class="insight-card__value">{{ formatNumber(supplierCount) }}</div>
          <div class="insight-card__meta">仍有现货可供补货的供应商</div>
          <div class="insight-card__footer">
            <span>TOP {{ topSupplierName }}</span>
            <span>覆盖价值 ¥{{ formatNumber(topSupplierValue) }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <MobileDialog
      v-if="canViewInventoryField('low_stock_dialog')"
      v-model="showLowStockDialog"
      title="库存不足详情（按预警配置）"
      width="80%"
      :close-on-click-modal="false"
      dialog-class="inventory-low-stock-dialog"
      :show-default-footer="false"
    >
      <el-table :data="filteredLowStockItems" stripe :table-layout="'auto'" :empty-text="loading ? '加载中...' : '暂无库存预警商品'">
        <el-table-column prop="brand" label="品牌" width="120" />
        <el-table-column prop="model" label="型号" min-width="220" />
        <el-table-column prop="color" label="颜色" width="100" />
        <el-table-column prop="currentStock" label="当前库存" width="100" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.currentStock === 0 ? 'danger' : 'warning'" size="small">
              {{ scope.row.currentStock }}台
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reorderPoint" label="预警库存" width="110" align="center" />
        <el-table-column prop="unitCost" label="成本价" width="120" align="right">
          <template #default="scope">
            ¥{{ formatNumber(scope.row.unitCost) }}
          </template>
        </el-table-column>
        <el-table-column prop="totalValue" label="库存价值" width="120" align="right">
          <template #default="scope">
            ¥{{ formatNumber(scope.row.totalValue) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastSaleDate" label="最近销售" width="140">
          <template #default="scope">
            {{ scope.row.lastSaleDate ? formatDate(scope.row.lastSaleDate) : '-' }}
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showLowStockDialog = false">关闭</el-button>
        </div>
      </template>
    </MobileDialog>

    <el-row v-if="canViewInventoryField('recent_sales_table')" :gutter="16" class="mt-16">
      <el-col :span="24">
        <el-card class="panel-card recent-sales-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">最近销售的10个型号</div>
                <div class="panel-subtitle">按最新销售时间倒序展示，便于快速判断热销流向</div>
              </div>
              <div class="panel-metrics">
                <span class="metric-chip">实时更新</span>
                <span class="metric-chip">成交 ¥{{ formatNumber(recentSalesSummary.totalSales) }}</span>
                <span class="metric-chip">{{ recentSalesSummary.latestSaleDate }}</span>
              </div>
            </div>
          </template>
          <el-table :data="recentSoldModels" stripe :table-layout="'auto'" :empty-text="loading ? '加载中...' : '暂无最近销售记录'">
            <el-table-column prop="brand" label="品牌" min-width="120" />
            <el-table-column prop="model" label="型号" min-width="180" />
            <el-table-column prop="color" label="颜色" min-width="100" />
            <el-table-column prop="salePrice" label="销售价" min-width="120" align="right">
              <template #default="scope">
                ¥{{ formatNumber(scope.row.salePrice) }}
              </template>
            </el-table-column>
            <el-table-column prop="saleDate" label="销售时间" min-width="180" />
            <el-table-column prop="store" label="销售门店" min-width="120" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showInventoryChartsRow" :gutter="16" class="charts-section">
      <el-col v-if="canViewInventoryField('category_distribution_chart')" :xs="24" :lg="12">
        <el-card class="panel-card chart-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">分类库存分析</div>
                <div class="panel-subtitle">聚焦品牌价值分布与库存沉淀情况</div>
              </div>
              <el-button size="small" @click="toggleCategoryChartType">
                切换{{ categoryChartType === 'bar' ? '饼图' : '柱状图' }}
              </el-button>
            </div>
          </template>
          <div class="chart-container">
            <div ref="categoryChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewInventoryField('turnover_trend_chart')" :xs="24" :lg="12">
        <el-card class="panel-card chart-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">库存周转趋势</div>
                <div class="panel-subtitle">对比目标周转率，观察补货与出货节奏</div>
              </div>
              <el-select v-model="turnoverPeriod" size="small" class="period-select">
                <el-option label="近30天" value="30d" />
                <el-option label="近90天" value="90d" />
                <el-option label="近180天" value="180d" />
              </el-select>
            </div>
          </template>
          <div class="chart-container">
            <div ref="turnoverChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showInventoryTableRow" :gutter="16" class="table-section admin-panel admin-table-panel">
      <el-col v-if="canViewInventoryField('low_stock_table')" :xs="24" :lg="14" class="stretch-col">
        <el-card class="panel-card table-card low-stock-card admin-panel admin-table-panel">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">库存预警</div>
                <div class="panel-subtitle">完全使用系统预警配置中的动态阈值进行判断</div>
              </div>
              <el-space wrap>
                <el-select v-model="alertLevel" placeholder="预警级别" size="small" clearable class="alert-select">
                  <el-option label="全部" value="" />
                  <el-option label="严重" value="critical" />
                  <el-option label="警告" value="warning" />
                </el-select>
                <el-button type="success" size="small" @click="exportLowStock">
                  导出
                </el-button>
              </el-space>
            </div>
          </template>

          <div class="warning-overview">
            <div class="warning-stat">
              <span class="warning-stat__label">预警总数</span>
              <strong class="warning-stat__value">{{ formatNumber(warningSummary.total) }}</strong>
            </div>
            <div class="warning-stat">
              <span class="warning-stat__label">售罄型号</span>
              <strong class="warning-stat__value">{{ formatNumber(warningSummary.criticalCount) }}</strong>
            </div>
            <div class="warning-stat">
              <span class="warning-stat__label">补货缺口</span>
              <strong class="warning-stat__value">{{ formatNumber(warningSummary.shortageUnits) }} 台</strong>
            </div>
            <div class="warning-stat">
              <span class="warning-stat__label">建议补货值</span>
              <strong class="warning-stat__value">¥{{ formatNumber(warningSummary.replenishmentValue) }}</strong>
            </div>
          </div>

          <el-table
            :data="filteredLowStockItems"
            stripe
            style="width: 100%"
            :empty-text="loading ? '加载中...' : '暂无库存预警商品'"
            :table-layout="'auto'"
          >
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="name" label="产品名称" min-width="220">
              <template #default="{ row }">
                <div class="product-name">
                  <span class="brand">{{ row.brand }}</span>
                  <span class="model">{{ row.model }}</span>
                  <span class="color">{{ row.color }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="currentStock" label="当前库存" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStockTagType(row.currentStock, row.reorderPoint)" size="small">
                  {{ row.currentStock }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reorderPoint" label="预警库存" width="100" align="center" />
            <el-table-column prop="unitCost" label="单价" width="110" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.unitCost) }}
              </template>
            </el-table-column>
            <el-table-column prop="totalValue" label="总值" width="120" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.totalValue) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStockStatusTagType(row.stockStatus)" size="small">
                  {{ getStockStatusText(row.stockStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="handleReplenish(row)">
                  补货
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col v-if="canViewInventoryField('supplier_count')" :xs="24" :lg="10" class="stretch-col">
        <el-card class="panel-card supplier-card">
          <template #header>
            <div class="panel-header">
              <div>
                <div class="panel-title">供应商分析</div>
                <div class="panel-subtitle">结合库存价值、商品数量与质量评分观察供应商稳定性</div>
              </div>
              <el-button size="small" @click="toggleSupplierChartType">
                切换{{ supplierChartType === 'bar' ? '雷达图' : '柱状图' }}
              </el-button>
            </div>
          </template>

          <div class="supplier-summary">
            <div class="supplier-summary__item">
              <span>活跃供应商</span>
              <strong>{{ formatNumber(supplierCount) }}</strong>
            </div>
            <div class="supplier-summary__item">
              <span>平均质量分</span>
              <strong>{{ formatDecimal(supplierQualityAverage) }}</strong>
            </div>
          </div>

          <div class="supplier-chart-container">
            <div ref="supplierChartRef" class="chart"></div>
          </div>

          <div class="supplier-highlights">
            <div
              v-for="supplier in supplierHighlights"
              :key="supplier.id"
              class="supplier-highlight"
            >
              <div>
                <div class="supplier-highlight__name">{{ supplier.name }}</div>
                <div class="supplier-highlight__meta">
                  {{ formatNumber(supplier.totalProducts) }} 台 · 质量 {{ formatDecimal(supplier.qualityScore) }}
                </div>
              </div>
              <div class="supplier-highlight__value">¥{{ formatNumber(supplier.totalValue) }}</div>
            </div>
            <div v-if="supplierHighlights.length === 0" class="supplier-empty">
              暂无供应商分析数据
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue'
import {
  Box,
  Money,
  Warning,
  ShoppingCart
} from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useImportExport } from '@/composables/useImportExport'
import { analyticsService } from '@/api/analytics'
import { unifiedApi } from '@/utils/unified-api'
import type { InventoryAnalytics } from '@/types/analytics'
import type { InventoryAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import echarts, { ECharts } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<InventoryAnalyticsProps>(), {
  loading: false,
  isActive: false,
  startDate: '',
  endDate: '',
  storeId: '',
  supplierId: '',
  searchTrigger: 0
})

const emit = defineEmits<LoadingChangeEmits>()

const { success, error, warning } = useNotification()
const { canViewField: canViewInventoryField, canViewAnyField: canViewAnyInventoryField } = useAnalyticsFieldVisibility('inventory')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const inventoryData = ref<InventoryAnalytics>({
  totalProducts: 0,
  totalValue: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
  overstockItems: 0,
  stockTurnover: 0,
  inventoryHealth: {
    score: 0,
    level: 'good',
    issues: [],
    recommendations: []
  },
  categoryAnalysis: [],
  supplierAnalysis: []
})

const showInventoryChartsRow = computed(() => canViewAnyInventoryField(['category_distribution_chart', 'turnover_trend_chart']))
const showInventoryTableRow = computed(() => canViewAnyInventoryField(['low_stock_table', 'supplier_count']))

const { loading } = useLoadingState()
const categoryChartType = ref<'bar' | 'pie'>('bar')
const supplierChartType = ref<'bar' | 'radar'>('bar')
const turnoverPeriod = ref('30d')
const alertLevel = ref('')

// 低库存数据
const lowStockItems = ref<any[]>([])
const turnoverTrendData = ref<any[]>([])

// 弹窗控制
const showLowStockDialog = ref(false)

// 供应商数量
const supplierCount = ref(0)

// 最近销售的型号
const recentSoldModels = ref<any[]>([])

// 图表引用
const categoryChartRef = ref<HTMLElement>()
const turnoverChartRef = ref<HTMLElement>()
const supplierChartRef = ref<HTMLElement>()

// 图表实例
let categoryChart: ECharts | null = null
let turnoverChart: ECharts | null = null
let supplierChart: ECharts | null = null

// 图表初始化标记
let chartsInitialized = false

const healthLevelText = computed(() => {
  const textMap: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    warning: '预警',
    critical: '紧急'
  }

  return textMap[inventoryData.value.inventoryHealth?.level || 'good'] || '良好'
})

const averageUnitCost = computed(() => {
  if (!inventoryData.value.totalProducts) return 0
  return inventoryData.value.totalValue / inventoryData.value.totalProducts
})

const filteredLowStockItems = computed(() => {
  if (!alertLevel.value) {
    return lowStockItems.value
  }

  if (alertLevel.value === 'critical') {
    return lowStockItems.value.filter((item) => item.stockStatus === 'out_of_stock')
  }

  if (alertLevel.value === 'warning') {
    return lowStockItems.value.filter((item) => item.stockStatus === 'low_stock')
  }

  return lowStockItems.value
})

const warningSummary = computed(() => {
  return lowStockItems.value.reduce((summary, item) => {
    const currentStock = Number(item.currentStock) || 0
    const reorderPoint = Number(item.reorderPoint) || 0
    const shortage = Math.max(reorderPoint - currentStock, 0)
    const unitCost = Number(item.unitCost) || 0

    summary.total += 1
    summary.shortageUnits += shortage
    summary.replenishmentValue += shortage * unitCost

    if (item.stockStatus === 'out_of_stock') {
      summary.criticalCount += 1
    } else if (item.stockStatus === 'low_stock') {
      summary.warningCount += 1
    }

    return summary
  }, {
    total: 0,
    criticalCount: 0,
    warningCount: 0,
    shortageUnits: 0,
    replenishmentValue: 0
  })
})

const recentSalesSummary = computed(() => {
  const totalSales = recentSoldModels.value.reduce((sum, item) => sum + (Number(item.salePrice) || 0), 0)
  const latestRecord = recentSoldModels.value[0]

  return {
    totalSales,
    latestStore: latestRecord?.store || '暂无',
    latestSaleDate: latestRecord?.saleDate || '暂无记录'
  }
})

const supplierHighlights = computed(() => {
  return [...(inventoryData.value?.supplierAnalysis || [])]
    .sort((a, b) => (Number(b.totalValue) || 0) - (Number(a.totalValue) || 0))
    .slice(0, 3)
})

const topSupplierName = computed(() => supplierHighlights.value[0]?.name || '暂无')

const topSupplierValue = computed(() => {
  return Number(supplierHighlights.value[0]?.totalValue) || 0
})

const supplierQualityAverage = computed(() => {
  const supplierList = inventoryData.value?.supplierAnalysis || []
  if (supplierList.length === 0) return 0

  const total = supplierList.reduce((sum, item) => sum + (Number(item.qualityScore) || 0), 0)
  return total / supplierList.length
})

// 方法

// 缓存键
const CACHE_KEYS = {
  inventory: (params: any) => `/analytics/inventory:${JSON.stringify(params)}`,
  lowStock: (params: any) => `/analytics/inventory/low-stock:${JSON.stringify(params)}`,
  turnover: (params: any) => `/analytics/inventory/turnover:${JSON.stringify(params)}`,
  supplierStats: '/analytics/inventory/supplier-stats',
  recentSold: '/analytics/inventory/recent-sold'
}

const loadInventoryData = async () => {
  try {
    loading.value = true
    emit('loading-change', true)

    // 获取库存数据
    const params: any = {}

    // 使用父组件传递的检索参数
    if (props.startDate) {
      params.startDate = props.startDate
    }
    if (props.endDate) {
      params.endDate = props.endDate
    }
    if (props.storeId) {
      params.storeId = props.storeId
    }
    if (props.supplierId) {
      params.supplierId = props.supplierId
    }

    const cacheKeyInventory = CACHE_KEYS.inventory(params)
    const cacheKeyLowStock = CACHE_KEYS.lowStock({ ...params, limit: 200 })
    const cacheKeyTurnover = CACHE_KEYS.turnover({ period: turnoverPeriod.value, ...params })

    // 并行获取数据（使用缓存）
    const [inventoryResponse, lowStockDetailResponse, turnoverResponse] = await Promise.all([
      useCachedRequest(cacheKeyInventory, () => analyticsService.getInventoryAnalytics(params), DEFAULT_CACHE_TTL.STATIC),
      useCachedRequest(cacheKeyLowStock, () => analyticsService.getLowStockItems({ ...params, limit: 200 }), DEFAULT_CACHE_TTL.DYNAMIC),
      useCachedRequest(cacheKeyTurnover, () => analyticsService.getInventoryTurnover({ period: turnoverPeriod.value, ...params }), DEFAULT_CACHE_TTL.DYNAMIC)
    ])

    if (inventoryResponse.success) {
      inventoryData.value = inventoryResponse.data
    }

    // 获取低库存详情
    if (lowStockDetailResponse.success) {
      lowStockItems.value = lowStockDetailResponse.data || []
    }

    // 计算供应商数量（有货的供应商）
    await calculateSupplierCount()

    // 获取最近销售的10个型号
    await loadRecentSoldModels()

    // 获取周转率数据
    if (turnoverResponse.success) {
      turnoverTrendData.value = turnoverResponse.data || []
    }

    updateCharts()
  } catch (err) {
    logger.error('获取库存数据失败:', err)
    error('获取库存数据失败')
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

// 计算有货的供应商数量
const calculateSupplierCount = async () => {
  try {
    const params: any = {}

    // 查询有库存的商品，按供应商分组统计
    const response = await useCachedRequest(CACHE_KEYS.supplierStats, () =>
      unifiedApi.get('/analytics/inventory/supplier-stats', { params }), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      supplierCount.value = response.data.supplierCount || 0
    } else {
      supplierCount.value = 0
    }
  } catch (err) {
    logger.error('获取供应商统计失败:', err)
    supplierCount.value = 0
  }
}

// 加载最近销售的型号
const loadRecentSoldModels = async () => {
  try {
    const params: any = { limit: 10 }

    const response = await useCachedRequest(CACHE_KEYS.recentSold, () =>
      unifiedApi.get('/analytics/inventory/recent-sold', { params }), DEFAULT_CACHE_TTL.DYNAMIC)
    if (response.success && response.data) {
      recentSoldModels.value = response.data || []
    }
  } catch (err) {
    logger.error('获取最近销售型号失败:', err)
  }
}

const formatNumber = (num?: number | null) => {
  if (num === undefined || num === null) return '0'
  return num.toLocaleString('zh-CN')
}

const formatDecimal = (num?: number | null) => {
  if (num === undefined || num === null || Number.isNaN(num)) return '0.0'
  return Number(num).toFixed(1)
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const getStockTagType = (stock: number, reorderPoint: number) => {
  if (stock === 0) return 'danger'
  if (stock <= reorderPoint) return 'warning'
  return 'success'
}

const getStockStatusTagType = (status?: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    in_stock: 'success',
    low_stock: 'warning',
    out_of_stock: 'danger',
    overstock: 'info'
  }
  return typeMap[status || 'in_stock'] || 'info'
}

const getStockStatusText = (status?: string) => {
  const textMap: Record<string, string> = {
    in_stock: '正常',
    low_stock: '库存不足',
    out_of_stock: '缺货',
    overstock: '积压'
  }
  return textMap[status || 'in_stock'] || '正常'
}

const handleReplenish = (row: any) => {
  // 处理补货逻辑
  success(`已为 ${row.brand} ${row.model} 创建补货提醒`)
}

const exportLowStock = () => {
  try {
    if (!filteredLowStockItems.value.length) {
      warning('当前没有可导出的库存预警数据')
      return
    }

    const csvContent = generateLowStockCSV()
    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('库存预警', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

const generateLowStockCSV = () => {
  return buildCsvContent(
    ['产品ID', '品牌', '型号', '颜色', '当前库存', '预警库存', '单价', '总值', '状态'],
    filteredLowStockItems.value.map((item) => ([
      item.id,
      item.brand,
      item.model,
      item.color,
      item.currentStock,
      item.reorderPoint,
      item.unitCost,
      item.totalValue,
      getStockStatusText(item.stockStatus)
    ]))
  )
}

const initCharts = () => {
  // 销毁旧实例
  if (categoryChart) {
    categoryChart.dispose()
    categoryChart = null
  }
  if (turnoverChart) {
    turnoverChart.dispose()
    turnoverChart = null
  }
  if (supplierChart) {
    supplierChart.dispose()
    supplierChart = null
  }

  // 初始化分类分析图
  if (categoryChartRef.value) {
    categoryChart = echarts.init(categoryChartRef.value)
  }

  // 初始化周转趋势图
  if (turnoverChartRef.value) {
    turnoverChart = echarts.init(turnoverChartRef.value)
  }

  // 初始化供应商分析图
  if (supplierChartRef.value) {
    supplierChart = echarts.init(supplierChartRef.value)
  }

  // 所有图表初始化完成
  chartsInitialized = true
  updateCharts()
}

const updateCategoryChart = () => {
  if (!categoryChart) return

  if (!inventoryData.value?.categoryAnalysis) return

  const data = (inventoryData.value.categoryAnalysis || []).map(item => ({
    name: item.category,
    value: item.totalValue || 0,
    turnoverRate: item.turnoverRate || 0
  }))

  const option: any = {
    color: ['#205781', '#4F959D', '#98D2C0', '#F6B17A', '#E07A5F', '#3D405B'],
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}<br/>库存价值: ¥${formatNumber(params.value)}<br/>周转率: ${formatDecimal(params.data.turnoverRate)}`
      }
    },
    grid: {
      left: 48,
      right: 16,
      top: 40,
      bottom: 36
    },
    legend: {
      bottom: 0,
      left: 'center'
    }
  }

  if (data.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无分类库存数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  if (categoryChartType.value === 'pie') {
    option.series = [{
      name: '库存价值',
      type: 'pie',
      radius: ['40%', '70%'],
      data: data,
      label: {
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 18,
          shadowOffsetX: 0,
          shadowColor: 'rgba(32, 87, 129, 0.28)'
        }
      }
    }]
  } else {
    option.xAxis = {
      type: 'category',
      data: data.map(item => item.name),
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572' }
    }
    option.yAxis = {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    }
    option.series = [{
      name: '库存价值',
      type: 'bar',
      data: data.map(item => item.value),
      barWidth: 22,
      itemStyle: {
        borderRadius: [10, 10, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#4F959D' },
          { offset: 1, color: '#205781' }
        ])
      }
    }]
  }

  categoryChart.setOption(option, true)
}

const updateTurnoverChart = () => {
  if (!turnoverChart) return

  // 使用实际的周转率趋势数据
  const periods = turnoverTrendData.value.map(item => item.date)
  const turnoverData = turnoverTrendData.value.map(item => item.actualTurnover)
  const targetData = turnoverTrendData.value.map(item => item.targetTurnover)

  const option: any = {
    color: ['#205781', '#F6B17A'],
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['实际周转率', '目标周转率'],
      top: 0
    },
    xAxis: {
      type: 'category',
      data: periods,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572' }
    },
    yAxis: {
      type: 'value',
      name: '周转率',
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    },
    grid: {
      left: 48,
      right: 24,
      top: 48,
      bottom: 36
    },
    series: [
      {
        name: '实际周转率',
        type: 'line',
        data: turnoverData,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        itemStyle: { color: '#205781' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(32, 87, 129, 0.22)' },
            { offset: 1, color: 'rgba(32, 87, 129, 0.02)' }
          ])
        }
      },
      {
        name: '目标周转率',
        type: 'line',
        data: targetData,
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 2, color: '#F6B17A' }
      }
    ]
  }

  if (periods.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无周转趋势数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  turnoverChart.setOption(option, true)
}

const updateSupplierChart = () => {
  if (!supplierChart) return

  // 使用实际的供应商分析数据
  const supplierData = inventoryData.value?.supplierAnalysis || []

  const option: any = {
    color: ['#4F959D', '#F6B17A', '#98D2C0', '#205781'],
    tooltip: {
      trigger: 'item'
    },
    grid: {
      left: 32,
      right: 12,
      top: 36,
      bottom: 30
    }
  }

  if (supplierData.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无供应商分析数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  if (supplierChartType.value === 'bar') {
    option.xAxis = {
      type: 'category',
      data: supplierData.map((item: any) => item.name),
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572', interval: 0, rotate: supplierData.length > 4 ? 20 : 0 }
    }
    option.yAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    }
    option.series = [{
      name: '库存价值',
      type: 'bar',
      data: supplierData.map((item: any) => ({
        value: item.totalValue,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#F6B17A' },
            { offset: 1, color: '#E07A5F' }
          ]),
          borderRadius: [10, 10, 0, 0]
        }
      }))
    }]
  } else {
    const maxValue = Math.max(...supplierData.map((item: any) => Number(item.totalValue) || 0), 1)
    const maxProducts = Math.max(...supplierData.map((item: any) => Number(item.totalProducts) || 0), 1)
    const maxQuality = Math.max(...supplierData.map((item: any) => Number(item.qualityScore) || 0), 100)

    option.radar = {
      indicator: [
        { name: '库存价值', max: maxValue },
        { name: '商品数量', max: maxProducts },
        { name: '质量评分', max: maxQuality }
      ],
      radius: 88
    }
    option.series = [{
      name: '供应商表现',
      type: 'radar',
      data: supplierData.map((item: any) => ({
        value: [
          item.totalValue,
          item.totalProducts,
          item.qualityScore
        ],
        name: item.name
      })),
      areaStyle: {
        color: 'rgba(32, 87, 129, 0.18)'
      },
      lineStyle: {
        color: '#205781'
      }
    }]
  }

  supplierChart.setOption(option, true)
}

const toggleCategoryChartType = () => {
  categoryChartType.value = categoryChartType.value === 'bar' ? 'pie' : 'bar'
  updateCategoryChart()
}

const toggleSupplierChartType = () => {
  supplierChartType.value = supplierChartType.value === 'bar' ? 'radar' : 'bar'
  updateSupplierChart()
}

const updateCharts = () => {
  nextTick(() => {
    setTimeout(() => {
      updateCategoryChart()
      updateTurnoverChart()
      updateSupplierChart()

      if (categoryChart) categoryChart.resize()
      if (turnoverChart) turnoverChart.resize()
      if (supplierChart) supplierChart.resize()
    }, 100)
  })
}

// 监听器
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        loadInventoryData()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    // 搜索触发，重新加载数据
    loadInventoryData()
  }
})

watch(turnoverPeriod, () => {
  if (chartsInitialized) {
    loadInventoryData()
  }
})

// 销毁时清理图表实例
onBeforeUnmount(() => {
  if (categoryChart) {
    categoryChart.dispose()
    categoryChart = null
  }
  if (turnoverChart) {
    turnoverChart.dispose()
    turnoverChart = null
  }
  if (supplierChart) {
    supplierChart.dispose()
    supplierChart = null
  }
})
</script>

<style lang="scss" scoped>
.inventory-analytics {
  --inventory-primary: #205781;
  --inventory-secondary: #4f959d;
  --inventory-accent: #f6b17a;
  --inventory-success: #98d2c0;
  --inventory-border: rgba(32, 87, 129, 0.1);

  .overview-cards,
  .charts-section,
  .table-section {
    margin-bottom: 24px;
  }

  .mt-16 {
    margin-top: 16px;
  }

  .dialog-footer {
    text-align: right;
  }

  .insight-card {
    position: relative;
    min-height: 204px;
    overflow: hidden;
    border: 1px solid var(--inventory-border);
    border-radius: 20px;
    background:
      radial-gradient(circle at top right, rgba(255, 255, 255, 0.42), transparent 38%),
      linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
    box-shadow: 0 14px 36px rgba(22, 34, 55, 0.08);
    transition: transform 0.25s ease, box-shadow 0.25s ease;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(32, 87, 129, 0.08), transparent 58%);
      pointer-events: none;
    }

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 18px 40px rgba(22, 34, 55, 0.12);
    }

    &.clickable {
      cursor: pointer;
    }
  }

  .insight-card--primary {
    background:
      radial-gradient(circle at top right, rgba(79, 149, 157, 0.16), transparent 38%),
      linear-gradient(180deg, #ffffff 0%, #f4f8fb 100%);
  }

  .insight-card--success {
    background:
      radial-gradient(circle at top right, rgba(152, 210, 192, 0.25), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f6fbf9 100%);
  }

  .insight-card--warning {
    background:
      radial-gradient(circle at top right, rgba(246, 177, 122, 0.22), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #fff9f4 100%);
  }

  .insight-card--supplier {
    background:
      radial-gradient(circle at top right, rgba(79, 149, 157, 0.14), transparent 42%),
      linear-gradient(180deg, #ffffff 0%, #f7fbfc 100%);
  }

  .insight-card__header,
  .insight-card__footer,
  .panel-header,
  .suggestion-title-row,
  .supplier-highlight {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .insight-card__header,
  .insight-card__label,
  .insight-card__value,
  .insight-card__meta,
  .insight-card__footer {
    position: relative;
    z-index: 1;
  }

  .insight-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    color: #fff;
    font-size: 24px;
    background: linear-gradient(135deg, var(--inventory-primary), var(--inventory-secondary));
    box-shadow: 0 12px 22px rgba(32, 87, 129, 0.2);
  }

  .insight-card--success .insight-card__icon {
    background: linear-gradient(135deg, #45a26b, #78c4a7);
  }

  .insight-card--warning .insight-card__icon {
    background: linear-gradient(135deg, #d98324, #f6b17a);
  }

  .insight-card--supplier .insight-card__icon {
    background: linear-gradient(135deg, #496989, #4f959d);
  }

  .insight-card__label {
    margin-top: 22px;
    color: #5c6773;
    font-size: 14px;
    letter-spacing: 0.02em;
  }

  .insight-card__value {
    margin-top: 12px;
    font-size: 34px;
    line-height: 1;
    font-weight: 700;
    color: #17212b;
  }

  .insight-card__value--currency {
    font-size: 30px;
  }

  .insight-card__meta {
    margin-top: 10px;
    color: #7f8a96;
    font-size: 13px;
  }

  .insight-card__footer {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(32, 87, 129, 0.08);
    font-size: 12px;
    color: #54606d;
  }

  .panel-card {
    height: 100%;
    border: 1px solid rgba(32, 87, 129, 0.08);
    border-radius: 20px;
    box-shadow: 0 12px 30px rgba(18, 38, 63, 0.06);
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  }

  .panel-title {
    font-size: 17px;
    font-weight: 700;
    color: #17212b;
  }

  .panel-subtitle {
    margin-top: 6px;
    color: #7f8a96;
    font-size: 13px;
    line-height: 1.5;
  }

  .panel-metrics {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .metric-chip {
    padding: 6px 10px;
    border-radius: 999px;
    background: #f3f7fb;
    color: #4f5f70;
    font-size: 12px;
    border: 1px solid rgba(32, 87, 129, 0.08);
  }

  .period-select,
  .alert-select {
    min-width: 122px;
  }

  .chart-card {
    height: 100%;
  }

  .chart-container,
  .supplier-chart-container {
    height: 320px;

    .chart {
      width: 100%;
      height: 100%;
    }
  }

  .warning-overview {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .warning-stat {
    padding: 14px 16px;
    border-radius: 16px;
    background: linear-gradient(180deg, #f7fafc 0%, #eef4f8 100%);
    border: 1px solid rgba(32, 87, 129, 0.08);
  }

  .warning-stat__label {
    display: block;
    margin-bottom: 6px;
    color: #7b8793;
    font-size: 12px;
  }

  .warning-stat__value {
    color: #17212b;
    font-size: 20px;
    font-weight: 700;
  }

  .stretch-col {
    display: flex;
  }

  .low-stock-card,
  .supplier-card {
    height: 100%;
    width: 100%;
  }

  .product-name {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .brand {
      color: #17212b;
      font-weight: 700;
    }

    .model {
      color: #56616d;
      font-size: 13px;
    }

    .color {
      color: #8a94a0;
      font-size: 12px;
    }
  }

  .supplier-card {
    display: flex;
    flex-direction: column;
  }

  .supplier-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .supplier-summary__item {
    padding: 12px 14px;
    border-radius: 14px;
    background: linear-gradient(180deg, #f4f8fb 0%, #eef4f8 100%);
    border: 1px solid rgba(32, 87, 129, 0.08);

    span {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: #7b8793;
    }

    strong {
      font-size: 22px;
      color: #17212b;
      font-weight: 700;
    }
  }

  .supplier-highlights {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 18px;
  }

  .supplier-highlight {
    padding: 12px 14px;
    border-radius: 14px;
    background: #f7fafc;
    border: 1px solid rgba(32, 87, 129, 0.08);
  }

  .supplier-highlight__name {
    color: #17212b;
    font-weight: 700;
  }

  .supplier-highlight__meta {
    margin-top: 6px;
    color: #7f8a96;
    font-size: 12px;
  }

  .supplier-highlight__value {
    white-space: nowrap;
    color: var(--inventory-primary);
    font-size: 15px;
    font-weight: 700;
  }

  .supplier-empty {
    padding: 20px 12px;
    text-align: center;
    color: #8a94a0;
    font-size: 13px;
  }

  :deep(.el-card__header) {
    padding: 18px 20px;
    border-bottom: 1px solid rgba(32, 87, 129, 0.08);
  }

  :deep(.el-card__body) {
    padding: 20px;
  }

  :deep(.el-table) {
    --el-table-header-bg-color: #f6f9fc;
    --el-table-row-hover-bg-color: #f8fbfd;
    border-radius: 14px;
  }

  :deep(.el-table th.el-table__cell) {
    color: #54606d;
    font-weight: 700;
  }

  :deep(.el-table td.el-table__cell) {
    color: #2c3a47;
  }
}

@media (max-width: 1200px) {
  .inventory-analytics {
    .warning-overview {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media (max-width: 768px) {
  .inventory-analytics {
    .overview-cards {
      :deep(.el-col) {
        margin-bottom: 12px;
      }
    }

    .insight-card {
      min-height: auto;
    }

    .insight-card__value,
    .insight-card__value--currency {
      font-size: 28px;
    }

    .panel-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .panel-metrics {
      justify-content: flex-start;
    }

    .warning-overview,
    .supplier-summary {
      grid-template-columns: 1fr;
    }

    .chart-container,
    .supplier-chart-container {
      height: 260px;
    }

    .supplier-highlight {
      flex-direction: column;
      align-items: flex-start;
    }

  }
}
</style>
