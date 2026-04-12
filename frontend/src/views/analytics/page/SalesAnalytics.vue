<template>
  <div class="sales-analytics">
    <!-- 销售概览卡片 -->
    <el-row :gutter="12" class="overview-cards">
      <el-col v-if="canViewSalesField('total_sales')" :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon total">
              <Money />
            </div>
            <div class="card-info">
              <div class="card-title">总销售额</div>
              <div class="card-value">¥{{ formatNumber(totalSalesAmount) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewSalesField('total_orders')" :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon orders">
              <ShoppingCart />
            </div>
            <div class="card-info">
              <div class="card-title">总销售台数</div>
              <div class="card-value">{{ totalSalesCount }}台</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewSalesField('new_sales_count')" :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card new">
          <div class="card-content">
            <div class="card-icon new">
              <Star />
            </div>
            <div class="card-info">
              <div class="card-title">全新销售</div>
              <div class="card-value">{{ newUsedSales.new?.count || 0 }}台</div>
              <div class="card-subtitle">¥{{ formatNumber(newUsedSales.new?.amount || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewSalesField('used_sales_count')" :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card used">
          <div class="card-content">
            <div class="card-icon used">
              <RefreshRight />
            </div>
            <div class="card-info">
              <div class="card-title">二手销售</div>
              <div class="card-value">{{ newUsedSales.used?.count || 0 }}台</div>
              <div class="card-subtitle">¥{{ formatNumber(newUsedSales.used?.amount || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card transfer">
          <div class="card-content">
            <div class="card-icon transfer">
              <Switch />
            </div>
            <div class="card-info">
              <div class="card-title">批发</div>
              <div class="card-value">{{ transferAllocationData.transfer?.count || 0 }}台</div>
              <div class="card-subtitle">¥{{ formatNumber(transferAllocationData.transfer?.profit || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="4" :xs="12" :sm="6" :md="4">
        <el-card class="overview-card allocation">
          <div class="card-content">
            <div class="card-icon allocation">
              <Connection />
            </div>
            <div class="card-info">
              <div class="card-title">划拨</div>
              <div class="card-value">{{ transferAllocationData.allocation?.count || 0 }}台</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row v-if="showSalesChartsRow" :gutter="16" class="charts-section">
      <!-- 销售趋势图 -->
      <el-col v-if="canViewSalesField('sales_trend_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>销售趋势</h3>
              <el-radio-group v-model="trendPeriod" size="small">
                <el-radio-button value="monthly">年度对比</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container">
            <div ref="trendChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 产品销售分布 -->
      <el-col v-if="canViewSalesField('product_distribution_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>产品销售分布</h3>
              <el-button size="small" @click="toggleChartType">
                {{ chartType === 'pie' ? '柱状图' : '饼图' }}
              </el-button>
            </div>
          </template>
          <div class="chart-container">
            <div ref="distributionChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格区域 -->
    <el-row v-if="showSalesTableRow" :gutter="16" class="table-section admin-panel admin-table-panel">
      <!-- 热销产品排行 -->
      <el-col v-if="canViewSalesField('top_products_table')" :xs="24" :sm="24" :md="14" :lg="14">
        <el-card class="table-card admin-panel admin-table-panel">
          <template #header>
            <div class="card-header">
              <h3>热销产品排行</h3>
              <el-space>
                <el-select v-model="productFilter" placeholder="筛选类别" size="small" clearable>
                  <el-option label="全部" value="" />
                  <el-option label="手机" value="手机" />
                  <el-option label="配件" value="配件" />
                </el-select>
                <el-button type="success" size="small" @click="exportTopProducts">
                  导出
                </el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="filteredTopProducts" stripe style="width: 100%">
            <el-table-column type="index" label="排名" width="60" align="center" />
            <el-table-column prop="name" label="产品名称">
              <template #default="{ row }">
                <div class="product-name">
                  <span class="brand">{{ row.brand_name }}</span>
                  <span class="model">{{ row.model_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="销量" width="100" align="right" />
            <el-table-column prop="revenue" label="销售额" width="120" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.revenue) }}
              </template>
            </el-table-column>
            <el-table-column prop="profit" label="利润" width="120" align="right">
              <template #default="{ row }">
                <span :class="getProfitClass(row.profit)">
                  ¥{{ formatNumber(row.profit) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="growth" label="增长率" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getGrowthTagType(row.growth || 0)" size="small">
                  {{ (row.growth || 0) > 0 ? '+' : '' }}{{ (row.growth || 0).toFixed(1) }}%
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 店铺销售对比 -->
      <el-col v-if="canViewSalesField('store_comparison_chart')" :xs="24" :sm="24" :md="10" :lg="10">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>店铺销售对比</h3>
            </div>
          </template>
          <div class="chart-container">
            <div ref="storeComparisonRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 销售预测 -->
    <el-card v-if="canViewSalesField('sales_forecast_chart')" class="forecast-card">
      <template #header>
        <div class="card-header">
          <div>
            <h3>销售预测</h3>
            <div class="update-info">
              <el-tag size="small" type="success">实时预测</el-tag>
              <span class="update-text">每5分钟自动更新</span>
            </div>
          </div>
          <el-space>
            <el-select v-model="forecastPeriod" size="small" @change="generateForecast">
              <el-option label="未来7天" value="week" />
              <el-option label="未来30天" value="month" />
              <el-option label="未来90天" value="quarter" />
            </el-select>
            <el-button size="small" type="primary" @click="generateForecast" :loading="forecastLoading">
              {{ forecastLoading ? '生成中...' : '刷新预测' }}
            </el-button>
          </el-space>
        </div>
      </template>

      <!-- 预测图表展示 -->
      <div v-if="forecastData.combinations && forecastData.combinations.length > 0" class="forecast-content">
        <!-- 选中日期的预测卡片 -->
        <div v-if="selectedDate && isFutureDate(selectedDate)" class="forecast-cards-section">
          <div class="section-header">
            <h4>{{ selectedDate }} 预测销量</h4>
            <div class="total-prediction">
              <span class="label">总计：</span>
              <span class="value">{{ getTotalPredictionForDate(selectedDate) }}</span>
              <span class="unit">台</span>
            </div>
            <el-button size="small" text @click="selectedDate = null">
              <i class="fas fa-times"></i> 清除选择
            </el-button>
          </div>
          <div class="forecast-cards">
            <div
              v-for="(item, index) in getProductsWithPrediction(selectedDate)"
              :key="index"
              class="forecast-card-item"
              :class="{
                'high-prediction': item.prediction >= 2,
                'medium-prediction': item.prediction === 1,
                'low-prediction': item.prediction === 0
              }"
            >
              <div class="card-header-mini">
                <div class="product-info">
                  <span class="model">{{ item.model_name }}</span>
                  <span class="color">{{ item.color_name }}</span>
                  <span class="memory">{{ item.memory }}</span>
                </div>
              </div>
              <div class="card-body">
                <div class="stat-item">
                  <span class="label">预计</span>
                  <span class="value">{{ item.prediction }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">销售</span>
                  <span class="value">{{ getActualSales(item, selectedDate) }}</span>
                </div>
                <div class="stat-item confidence">
                  <el-tag :type="getConfidenceType(item.confidence)" size="small">
                    {{ getConfidenceLabel(item.confidence) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
          <div v-if="getProductsWithPrediction(selectedDate).length === 0" class="no-prediction-tip">
            <el-empty description="该日期暂无预测数据" :image-size="80" />
          </div>
        </div>

        <!-- 点击历史日期的提示 -->
        <div v-else-if="selectedDate && !isFutureDate(selectedDate)" class="history-date-tip">
          <el-alert type="info" :closable="false">
            <template #title>
              <div class="tip-content">
                <i class="fas fa-info-circle"></i>
                <span>{{ selectedDate }} 是历史日期，实际销量为 {{ getHistoricalTotal(selectedDate) }} 台。请点击未来日期查看预测销量。</span>
                <el-button size="small" text @click="selectedDate = null">
                  <i class="fas fa-times"></i>
                </el-button>
              </div>
            </template>
          </el-alert>
        </div>

        <!-- 预测图表 -->
        <div class="chart-container">
          <div ref="forecastChartRef" class="chart"></div>
        </div>

        <!-- 预测说明 -->
        <div class="forecast-note">
          <el-alert type="info" :closable="false">
            <template #title>
              <div class="note-content">
                <i class="fas fa-info-circle"></i>
                <span>
                  预测说明：基于过去90天的历史销售数据，使用移动平均法计算未来销售趋势。
                  点击图表中的日期可查看当天各产品的预测销量。默认展示未来7天的预测数据。
                </span>
              </div>
            </template>
          </el-alert>
        </div>
      </div>

      <!-- 无数据提示 -->
      <el-empty v-else description="暂无预测数据，请点击生成预测" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  Money,
  ShoppingCart,
  TrendCharts,
  DataLine,
  ArrowUp,
  ArrowDown,
  Minus,
  Star,
  RefreshRight,
  Switch,
  Connection
} from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useImportExport } from '@/composables/useImportExport'
import { analyticsService } from '@/api/analytics'
import { unifiedApi } from '@/utils/unified-api'
import type { SalesAnalytics } from '@/types/analytics'
import type { SalesAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import echarts, { ECharts } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import dayjs from 'dayjs'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<SalesAnalyticsProps>(), {
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
const { canViewField: canViewSalesField, canViewAnyField: canViewAnySalesField } = useAnalyticsFieldVisibility('sales')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const salesData = ref<SalesAnalytics>({
  totalSales: { total: 0, change: 0, changePercent: 0, trend: 'stable' },
  totalOrders: { total: 0, change: 0, changePercent: 0, trend: 'stable' },
  averageOrderValue: { total: 0, change: 0, changePercent: 0, trend: 'stable' },
  topProducts: [],
  salesByStore: [],
  salesByPeriod: [],
  revenueForecast: []
})

// 全新/二手销售数据
const newUsedSales = ref<{
  new: { count: number; amount: number; profit: number }
  used: { count: number; amount: number; profit: number }
}>({
  new: { count: 0, amount: 0, profit: 0 },
  used: { count: 0, amount: 0, profit: 0 }
})

// 调货-划拨数据
const transferAllocationData = ref<{
  transfer: { count: number; profit: number }
  allocation: { count: number; units: number }
}>({
  transfer: { count: 0, profit: 0 },
  allocation: { count: 0, units: 0 }
})

const { loading } = useLoadingState()
const trendPeriod = ref('monthly')
const chartType = ref<'pie' | 'bar'>('pie')
const comparisonType = ref<'bar' | 'radar'>('bar')
const productFilter = ref('')
const forecastPeriod = ref('week') // 默认未来7天
const { loading: forecastLoading } = useLoadingState()
const selectedProduct = ref(0)
const selectedDate = ref<string | null>(null)

// 预测数据
const forecastData = ref<{
  combinations: any[]
}>({
  combinations: []
})

// 当前选中的产品数据
const selectedProductData = computed(() => {
  if (forecastData.value.combinations.length > 0 && selectedProduct.value !== null) {
    return forecastData.value.combinations[selectedProduct.value]
  }
  return null
})

// 月度销售趋势数据（全新和二手）
const monthlyTrendData = ref<{
  new: number[]
  used: number[]
}>({
  new: Array(12).fill(0),
  used: Array(12).fill(0)
})

// 店铺销售对比数据（全新和二手）
const storeComparisonData = ref<Array<{
  storeId: number
  storeName: string
  newCount: number
  usedCount: number
}>>([])

// 计算总销售额 = 全新 + 二手 + 批发金额
const totalSalesAmount = computed(() => {
  return (newUsedSales.value.new?.amount || 0) +
         (newUsedSales.value.used?.amount || 0) +
         (transferAllocationData.value.transfer?.profit || 0)
})

// 计算总销售台数 = 全新 + 二手 + 批发 + 划拨数量
const totalSalesCount = computed(() => {
  return (newUsedSales.value.new?.count || 0) +
         (newUsedSales.value.used?.count || 0) +
         (transferAllocationData.value.transfer?.count || 0) +
         (transferAllocationData.value.allocation?.count || 0)
})

// 图表引用
const trendChartRef = ref<HTMLElement>()
const distributionChartRef = ref<HTMLElement>()
const storeComparisonRef = ref<HTMLElement>()
const forecastChartRef = ref<HTMLElement>()

// 图表实例
let trendChart: ECharts | null = null
let distributionChart: ECharts | null = null
let storeComparisonChart: ECharts | null = null
let forecastChart: ECharts | null = null

// 图表初始化标记
let chartsInitialized = false

// 计算属性
const filteredTopProducts = computed(() => {
  if (!productFilter.value) {
    return salesData.value.topProducts || []
  }
  return (salesData.value.topProducts || []).filter(product =>
    product.brand_name?.includes(productFilter.value) ||
    product.model_name?.includes(productFilter.value)
  )
})

const showSalesChartsRow = computed(() => canViewAnySalesField(['sales_trend_chart', 'product_distribution_chart']))
const showSalesTableRow = computed(() => canViewAnySalesField(['top_products_table', 'store_comparison_chart']))

// 缓存键
const CACHE_KEYS = {
  sales: (params: any) => `/analytics/sales:${JSON.stringify(params)}`,
  salesCondition: (params: any) => `/analytics/sales-by-condition:${JSON.stringify(params)}`,
  transfer: (params: any) => `/transfers/statistics:${JSON.stringify(params)}`,
  stores: '/stores:all'
}

// 方法
const loadSalesData = async () => {
  try {
    loading.value = true
    emit('loading-change', true)

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

    const cacheKeySales = CACHE_KEYS.sales(params)
    const cacheKeyCondition = CACHE_KEYS.salesCondition(params)
    const cacheKeyTransfer = CACHE_KEYS.transfer(params)

    // 并行获取销售数据、全新/二手数据和调货-划拨数据（使用缓存）
    const [salesResponse, newUsedResponse, transferResponse] = await Promise.all([
      useCachedRequest(cacheKeySales, () => analyticsService.getSalesAnalytics(params), DEFAULT_CACHE_TTL.STATIC),
      useCachedRequest(cacheKeyCondition, () => unifiedApi.get('/analytics/sales-by-condition', { params }), DEFAULT_CACHE_TTL.DYNAMIC),
      useCachedRequest(cacheKeyTransfer, () => unifiedApi.get('/transfers/statistics', { params }).catch(err => {
        logger.error('获取调货-划拨数据失败:', err)
        return { success: false, data: null }
      }), DEFAULT_CACHE_TTL.STATIC)
    ])

    // 加载月度趋势数据（使用缓存）
    loadMonthlyTrendData()

    // 加载店铺对比数据（使用缓存）
    loadStoreComparisonData()

    if (salesResponse.success) {
      salesData.value = salesResponse.data
      updateCharts()
    }

    // 处理全新/二手数据
    if (newUsedResponse.success) {
      newUsedSales.value = {
        new: {
          count: newUsedResponse.data.new?.salesCount || 0,
          amount: newUsedResponse.data.new?.salesAmount || 0,
          profit: newUsedResponse.data.new?.profit || 0
        },
        used: {
          count: newUsedResponse.data.used?.salesCount || 0,
          amount: newUsedResponse.data.used?.salesAmount || 0,
          profit: newUsedResponse.data.used?.profit || 0
        }
      }
    }

    // 处理调货-划拨数据
    if (transferResponse.success && transferResponse.data) {
      transferAllocationData.value = {
        transfer: {
          count: transferResponse.data.wholesale?.total_count || 0,
          profit: transferResponse.data.wholesale?.total_profit || 0
        },
        allocation: {
          count: transferResponse.data.supplier_proxy?.total_count || 0,
          units: transferResponse.data.supplier_proxy?.total_count || 0
        }
      }
    } else {
      logger.warn('调货-划拨数据获取失败或无数据')
    }
  } catch (err) {
    logger.error('获取销售数据失败:', err)
    error('获取销售数据失败')
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

// 加载月度销售趋势数据
const loadMonthlyTrendData = async () => {
  try {
    const currentYear = dayjs().year()
    const newCounts = Array(12).fill(0)
    const usedCounts = Array(12).fill(0)

    // 获取当前年份每个月的数据
    for (let month = 1; month <= 12; month++) {
      const startDate = `${currentYear}-${String(month).padStart(2, '0')}-01`
      const lastDay = dayjs(`${currentYear}-${month}`).daysInMonth()
      const endDate = `${currentYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const cacheKey = CACHE_KEYS.salesCondition({ startDate, endDate })
      const response = await useCachedRequest(cacheKey, () =>
        unifiedApi.get('/analytics/sales-by-condition', {
          params: { startDate, endDate }
        }), DEFAULT_CACHE_TTL.STATIC)

      if (response.success && response.data) {
        newCounts[month - 1] = response.data.new?.salesCount || 0
        usedCounts[month - 1] = response.data.used?.salesCount || 0
      }
    }

    monthlyTrendData.value = {
      new: newCounts,
      used: usedCounts
    }

    // 更新图表
    updateTrendChart()
  } catch (err) {
    logger.error('获取月度趋势数据失败:', err)
  }
}

// 加载店铺销售对比数据
const loadStoreComparisonData = async () => {
  try {
    // 获取店铺列表（使用缓存）
    const storesResponse = await useCachedRequest(CACHE_KEYS.stores, () =>
      unifiedApi.get('/stores', { params: { all: true } }), DEFAULT_CACHE_TTL.STATIC)
    if (!storesResponse.success || !storesResponse.data) return

    const stores = Array.isArray(storesResponse.data) ? storesResponse.data : (storesResponse.data.stores || [])
    const comparisonData = []

    // 获取每个店铺的全新和二手销售数据（使用缓存）
    for (const store of stores) {
      const cacheKey = CACHE_KEYS.salesCondition({ storeId: store.id })
      const response = await useCachedRequest(cacheKey, () =>
        unifiedApi.get('/analytics/sales-by-condition', {
          params: { storeId: store.id }
        }), DEFAULT_CACHE_TTL.DYNAMIC)

      if (response.success && response.data) {
        comparisonData.push({
          storeId: store.id,
          storeName: store.name,
          newCount: response.data.new?.salesCount || 0,
          usedCount: response.data.used?.salesCount || 0
        })
      }
    }

    storeComparisonData.value = comparisonData
    updateStoreComparison()
  } catch (err) {
    logger.error('获取店铺对比数据失败:', err)
  }
}

const formatNumber = (num?: number | null) => {
  if (num === undefined || num === null) return '0'
  return num.toLocaleString('zh-CN')
}

const formatPercent = (percent?: number) => {
  if (!percent) return '0%'
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
}

const getChangeClass = (trend?: string) => {
  return {
    'positive': trend === 'up',
    'negative': trend === 'down',
    'neutral': trend === 'stable'
  }
}

const getTrendIcon = (trend?: string) => {
  switch (trend) {
    case 'up': return ArrowUp
    case 'down': return ArrowDown
    default: return Minus
  }
}

const getProfitClass = (profit: number) => {
  return {
    'positive': profit > 0,
    'negative': profit < 0,
    'neutral': profit === 0
  }
}

const getGrowthTagType = (growth: number) => {
  if (growth > 10) return 'success'
  if (growth > 0) return 'info'
  return 'danger'
}

const initCharts = () => {
  // 先销毁已存在的图表实例
  if (trendChart) {
    trendChart.dispose()
    trendChart = null
  }
  if (distributionChart) {
    distributionChart.dispose()
    distributionChart = null
  }
  if (storeComparisonChart) {
    storeComparisonChart.dispose()
    storeComparisonChart = null
  }
  if (forecastChart) {
    forecastChart.dispose()
    forecastChart = null
  }

  // 初始化趋势图
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)
  }

  // 初始化分布图
  if (distributionChartRef.value) {
    distributionChart = echarts.init(distributionChartRef.value)
  }

  // 初始化店铺对比图
  if (storeComparisonRef.value) {
    storeComparisonChart = echarts.init(storeComparisonRef.value)
  }

  // 初始化预测图
  if (forecastChartRef.value) {
    forecastChart = echarts.init(forecastChartRef.value)
  }

  // 所有图表初始化完成
  chartsInitialized = true
  updateCharts()
}

const updateTrendChart = () => {
  if (!trendChart) return

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((item: any) => {
          result += `${item.marker}${item.seriesName}: ${item.value}台<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['全新销售', '二手销售'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: {
        interval: 0,
        rotate: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '销售台数',
      axisLabel: {
        formatter: '{value}台'
      }
    },
    series: [
      {
        name: '全新销售',
        type: 'bar',
        data: monthlyTrendData.value.new,
        itemStyle: {
          color: '#409EFF',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      },
      {
        name: '二手销售',
        type: 'bar',
        data: monthlyTrendData.value.used,
        itemStyle: {
          color: '#67C23A',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      }
    ]
  }

  trendChart.setOption(option)
}

const updateDistributionChart = () => {
  if (!distributionChart) return

  const products = salesData.value.topProducts || []
  const data = products.slice(0, 10).map(item => ({
    name: item.model_name,
    value: item.quantity
  }))

  const option: any = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    }
  }

  if (chartType.value === 'pie') {
    option.series = [{
      name: '销量',
      type: 'pie',
      radius: '50%',
      data: data,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  } else {
    option.series = [{
      name: '销量',
      type: 'bar',
      data: data,
      itemStyle: { color: '#E6A23C' }
    }]
    option.xAxis = { type: 'category', data: data.map(item => item.name) }
    option.yAxis = { type: 'value' }
  }

  distributionChart.setOption(option)
}

const updateStoreComparison = () => {
  if (!storeComparisonChart) return

  const storeNames = storeComparisonData.value.map(item => item.storeName)
  const newCounts = storeComparisonData.value.map(item => item.newCount)
  const usedCounts = storeComparisonData.value.map(item => item.usedCount)

  const option: any = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`
        params.forEach((item: any) => {
          result += `${item.marker}${item.seriesName}: ${item.value}台<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['全新销售', '二手销售'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: storeNames,
      axisLabel: {
        interval: 0,
        rotate: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '销售台数',
      axisLabel: {
        formatter: '{value}台'
      }
    },
    series: [
      {
        name: '全新销售',
        type: 'bar',
        data: newCounts,
        itemStyle: {
          color: '#409EFF',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      },
      {
        name: '二手销售',
        type: 'bar',
        data: usedCounts,
        itemStyle: {
          color: '#67C23A',
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40
      }
    ]
  }

  storeComparisonChart.setOption(option)
}

const updateCharts = () => {
  nextTick(() => {
    setTimeout(() => {
      updateTrendChart()
      updateDistributionChart()
      updateStoreComparison()

      if (trendChart) trendChart.resize()
      if (distributionChart) distributionChart.resize()
      if (storeComparisonChart) storeComparisonChart.resize()
    }, 100)
  })
}

const toggleChartType = () => {
  chartType.value = chartType.value === 'pie' ? 'bar' : 'pie'
  updateDistributionChart()
}

const toggleComparisonType = () => {
  comparisonType.value = comparisonType.value === 'bar' ? 'radar' : 'bar'
  updateStoreComparison()
}

const exportTopProducts = () => {
  try {
    if (!filteredTopProducts.value.length) {
      warning('当前没有可导出的热销产品数据')
      return
    }

    const csvContent = generateTopProductsCSV()
    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('热销产品排行', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

const generateTopProductsCSV = () => {
  return buildCsvContent(
    ['排名', '品牌', '型号', '销量', '销售额', '利润', '增长率'],
    filteredTopProducts.value.map((item, index) => ([
      index + 1,
      item.brand_name || '',
      item.model_name || '',
      item.quantity || 0,
      item.revenue || 0,
      item.profit || 0,
      `${(item.growth || 0) > 0 ? '+' : ''}${(item.growth || 0).toFixed(1)}%`
    ]))
  )
}

const generateForecast = async () => {
  try {
    forecastLoading.value = true

    const response = await unifiedApi.get('/analytics/sales-forecast', {
      params: {
        period: forecastPeriod.value,
        limit: 10
      }
    })

    if (response.success && response.data) {
      forecastData.value = {
        combinations: response.data.combinations || []
      }

      // 默认选中第一个产品
      if (forecastData.value.combinations.length > 0) {
        selectedProduct.value = 0
        // 延迟初始化图表，确保 DOM 已渲染
        setTimeout(() => {
          updateForecastChart()
        }, 300)
      }

      success('预测生成成功')
    } else {
      error('预测生成失败')
    }
  } catch (err) {
    logger.error('生成预测失败:', err)
    error('生成预测失败')
  } finally {
    forecastLoading.value = false
  }
}

const updateForecastChart = () => {
  if (!forecastData.value.combinations || forecastData.value.combinations.length === 0) return

  // 确保图表容器存在
  nextTick(() => {
    if (!forecastChart && forecastChartRef.value) {
      forecastChart = echarts.init(forecastChartRef.value)
    }

    if (!forecastChart) return

    // 聚合所有产品的预测数据
    const allDates = forecastData.value.combinations[0]?.time_series?.dates || []

    if (allDates.length === 0) {
      return
    }

    const aggregatedActual: (number | null)[] = []
    const aggregatedPredicted: (number | null)[] = []
    const aggregatedUpper: (number | null)[] = []
    const aggregatedLower: (number | null)[] = []

    // 对每个日期，汇总所有产品的数据
    allDates.forEach((date: string, index: number) => {
      let actualSum = 0
      let predictedSum = 0
      let upperSum = 0
      let lowerSum = 0
      let hasActual = false
      let hasPredicted = false

      forecastData.value.combinations.forEach((item: any) => {
        const ts = item.time_series
        if (ts && ts.dates[index] === date) {
          const actual = ts.actual[index]
          const predicted = ts.predicted[index]
          const upper = ts.upper_bound[index]
          const lower = ts.lower_bound[index]

          if (actual !== null && actual !== undefined) {
            actualSum += actual
            hasActual = true
          }
          if (predicted !== null && predicted !== undefined) {
            predictedSum += predicted
            hasPredicted = true
          }
          if (upper !== null && upper !== undefined) {
            upperSum += upper
          }
          if (lower !== null && lower !== undefined) {
            lowerSum += lower
          }
        }
      })

      aggregatedActual.push(hasActual ? actualSum : null)
      aggregatedPredicted.push(hasPredicted ? predictedSum : null)
      aggregatedUpper.push(hasPredicted ? upperSum : null)
      aggregatedLower.push(hasPredicted ? lowerSum : null)
    })

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`
          params.forEach((item: any) => {
            if (item.value !== null && item.value !== undefined && item.value !== 0) {
              result += `${item.marker}${item.seriesName}: ${item.value}台<br/>`
            }
          })
          return result
        }
      },
      legend: {
        data: ['实际销量', '预测销量', '上限', '下限'],
        top: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          interval: Math.floor(allDates.length / 10),
          rotate: 45,
          formatter: (value: string) => {
            return value.substring(5) // 只显示月-日
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '销量（台）',
        axisLabel: {
          formatter: '{value}台'
        }
      },
      series: [
        {
          name: '实际销量',
          type: 'line',
          data: aggregatedActual,
          itemStyle: { color: '#409EFF' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 6,
          smooth: true,
          connectNulls: false
        },
        {
          name: '预测销量',
          type: 'line',
          data: aggregatedPredicted,
          itemStyle: { color: '#67C23A' },
          lineStyle: { type: 'dashed', width: 2 },
          symbol: 'circle',
          symbolSize: 6,
          smooth: true,
          connectNulls: true
        },
        {
          name: '上限',
          type: 'line',
          data: aggregatedUpper,
          itemStyle: { color: '#F56C6C' },
          lineStyle: { opacity: 0.3, width: 1 },
          symbol: 'none',
          smooth: true,
          connectNulls: true,
          areaStyle: {
            color: 'rgba(103, 194, 58, 0.1)'
          }
        },
        {
          name: '下限',
          type: 'line',
          data: aggregatedLower,
          itemStyle: { color: '#E6A23C' },
          lineStyle: { opacity: 0.3, width: 1 },
          symbol: 'none',
          smooth: true,
          connectNulls: true
        }
      ]
    }

    forecastChart.setOption(option)

    // 添加点击事件
    forecastChart.off('click')
    forecastChart.on('click', (params: any) => {
      if (params.componentType === 'series') {
        const clickedDate = allDates[params.dataIndex]
        selectedDate.value = clickedDate
      }
    })
  })
}

const getTrendType = (trend: number): 'success' | 'info' | 'danger' | 'warning' => {
  const trendNum = Number(trend)
  if (trendNum > 10) return 'success'
  if (trendNum > 0) return 'info'
  if (trendNum < -10) return 'danger'
  return 'warning'
}

const getConfidenceType = (confidence: string): 'success' | 'warning' | 'info' => {
  if (confidence === 'high') return 'success'
  if (confidence === 'medium') return 'warning'
  return 'info'
}

const getConfidenceLabel = (confidence: string) => {
  if (confidence === 'high') return '高'
  if (confidence === 'medium') return '中'
  return '低'
}

// 获取某个日期某个产品的预测销量
const getDailyPrediction = (item: any, date: string) => {
  if (!item || !item.time_series || !date) {
    return 0
  }

  const dateIndex = item.time_series.dates.findIndex((d: string) => d === date)
  if (dateIndex === -1) {
    return 0
  }

  // 如果是预测日期，返回预测值；否则返回实际值
  const predicted = item.time_series.predicted[dateIndex]
  const actual = item.time_series.actual[dateIndex]

  return predicted !== null && predicted !== undefined ? predicted : (actual || 0)
}

// 获取某个日期某个产品的实际销量
const getActualSales = (item: any, date: string) => {
  if (!item || !item.time_series || !date) {
    return 0
  }

  const dateIndex = item.time_series.dates.findIndex((d: string) => d === date)
  if (dateIndex === -1) {
    return 0
  }

  const actual = item.time_series.actual[dateIndex]
  return actual !== null && actual !== undefined ? actual : 0
}

// 获取某个日期的总预测销量
const getTotalPredictionForDate = (dateStr: string) => {
  if (!forecastData.value.combinations || forecastData.value.combinations.length === 0) {
    return 0
  }

  let total = 0
  forecastData.value.combinations.forEach((item: any) => {
    const prediction = getDailyPrediction(item, dateStr)
    total += prediction
  })

  return total
}

// 获取某个日期有预测值的产品列表（显示所有返回的产品）
const getProductsWithPrediction = (dateStr: string) => {
  if (!forecastData.value.combinations || forecastData.value.combinations.length === 0) {
    return []
  }

  const products: any[] = []
  forecastData.value.combinations.forEach((item: any) => {
    const prediction = getDailyPrediction(item, dateStr)
    // 只显示预测值大于0的产品组合（算法预测会销售的）
    if (prediction > 0) {
      products.push({
        ...item,
        prediction
      })
    }
  })

  // 按预测销量降序排序
  return products.sort((a, b) => {
    if (b.prediction !== a.prediction) {
      return b.prediction - a.prediction
    }
    // 预测相同时，按实际销量排序
    return b.actual_sales - a.actual_sales
  })
}

// 判断是否是未来日期（包括今天）
const isFutureDate = (dateStr: string) => {
  const today = TimeUtil.startOf(TimeUtil.now(), 'day')
  const targetDate = TimeUtil.startOf(TimeUtil.parse(dateStr), 'day')
  return targetDate.valueOf() >= today.valueOf()
}

// 获取历史日期的总销量
const getHistoricalTotal = (dateStr: string) => {
  if (!forecastData.value.combinations || forecastData.value.combinations.length === 0) {
    return 0
  }

  let total = 0
  forecastData.value.combinations.forEach((item: any) => {
    if (item.time_series) {
      const dateIndex = item.time_series.dates.findIndex((d: string) => d === dateStr)
      if (dateIndex !== -1) {
        const actual = item.time_series.actual[dateIndex]
        if (actual !== null && actual !== undefined) {
          total += actual
        }
      }
    }
  })

  return total
}

// 监听器
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        loadSalesData()
        // 自动生成预测
        generateForecast()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    loadSalesData()
  }
})

watch(trendPeriod, () => {
  if (chartsInitialized) {
    updateTrendChart()
  }
})

// 定期自动刷新预测（每5分钟）
let forecastRefreshTimer: any = null

const startForecastAutoRefresh = () => {
  // 清除旧的定时器
  if (forecastRefreshTimer) {
    clearInterval(forecastRefreshTimer)
  }

  // 每5分钟自动刷新预测
  forecastRefreshTimer = setInterval(() => {
    generateForecast()
  }, 5 * 60 * 1000) // 5分钟
}

const stopForecastAutoRefresh = () => {
  if (forecastRefreshTimer) {
    clearInterval(forecastRefreshTimer)
    forecastRefreshTimer = null
  }
}

// 生命周期
onMounted(() => {
  // 只在 TAB 激活时才初始化图表
  if (props.isActive) {
    nextTick(() => {
      // 延迟初始化图表，确保 DOM 元素有正确的尺寸
      setTimeout(() => {
        initCharts()
        loadSalesData()
        // 自动生成预测
        generateForecast()
        // 启动自动刷新
        startForecastAutoRefresh()
      }, 100)
    })
  }
})

// 销毁时清理图表实例和定时器
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  // 停止自动刷新
  stopForecastAutoRefresh()

  if (trendChart) {
    trendChart.dispose()
    trendChart = null
  }
  if (distributionChart) {
    distributionChart.dispose()
    distributionChart = null
  }
  if (storeComparisonChart) {
    storeComparisonChart.dispose()
    storeComparisonChart = null
  }
  if (forecastChart) {
    forecastChart.dispose()
    forecastChart = null
  }
})
</script>

<style lang="scss" scoped>
.sales-analytics {
  .overview-cards {
    margin-bottom: 24px;
  }

  .overview-card {
    height: 130px;
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
  }

  .card-content {
    display: flex;
    align-items: center;
    height: 100%;
    gap: 12px;
    padding: 8px;
  }

  .card-icon {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: white;
    flex-shrink: 0;

    &.total {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.orders {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.new {
      background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
    }

    &.used {
      background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%);
    }

    &.average {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    &.conversion {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    &.transfer {
      background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
    }

    &.allocation {
      background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
    }
  }

  .card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .card-title {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-stats {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;

        .stat-label {
          color: var(--el-text-color-secondary);
          font-weight: 500;
        }

        .stat-value {
          color: var(--el-text-color-primary);
          font-weight: 600;
        }
      }
    }

    .card-change {
      display: flex;
      align-items: center;
      font-size: 11px;
      font-weight: 500;
      gap: 3px;

      &.positive {
        color: var(--el-color-success);
      }

      &.negative {
        color: var(--el-color-danger);
      }

      &.neutral {
        color: var(--el-color-info);
      }
    }

    .card-subtitle {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .charts-section {
    margin-bottom: 24px;
  }

  .table-section {
    margin-bottom: 24px;
  }

  .chart-card,
  .table-card,
  .forecast-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .update-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;

        .update-text {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }

  .chart-container {
    height: 300px;

    .chart {
      width: 100%;
      height: 100%;
    }
  }

  .product-name {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .brand {
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .model {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .positive {
    color: var(--el-color-success);
  }

  .negative {
    color: var(--el-color-danger);
  }

  .neutral {
    color: var(--el-text-color-regular);
  }

  .forecast-card {
    margin-top: 24px;

    .forecast-content {
      padding: 16px 0;
    }

    .forecast-cards-section {
      margin-bottom: 24px;
      padding: 20px;
      background: var(--el-fill-color-light);
      border-radius: 12px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        gap: 16px;

        h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .total-prediction {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 6px;
          color: white;
          font-weight: 600;

          .label {
            font-size: 13px;
            opacity: 0.9;
          }

          .value {
            font-size: 18px;
            font-weight: 700;
          }

          .unit {
            font-size: 12px;
            opacity: 0.9;
          }
        }
      }

      .forecast-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 10px;

        .forecast-card-item {
          background: white;
          border-radius: 6px;
          padding: 10px 12px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
          }

          .card-header-mini {
            margin-bottom: 8px;

            .product-info {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              line-height: 1.4;
              flex-wrap: wrap;

              .model {
                font-weight: 600;
                color: var(--el-text-color-primary);
              }

              .color {
                color: var(--el-color-primary);
              }

              .memory {
                color: var(--el-text-color-regular);
              }
            }
          }

          .card-body {
            display: flex;
            align-items: center;
            gap: 12px;

            .stat-item {
              display: flex;
              align-items: baseline;
              gap: 4px;

              .label {
                font-size: 12px;
                color: var(--el-text-color-secondary);
              }

              .value {
                font-size: 18px;
                font-weight: 700;
                color: var(--el-text-color-primary);
              }

              &.confidence {
                margin-left: auto;
              }
            }
          }

          // 高预测值样式
          &.high-prediction {
            border: 2px solid #67C23A;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);

            .stat-item:first-child .value {
              color: #67C23A;
              font-size: 20px;
            }
          }

          // 中等预测值样式
          &.medium-prediction {
            border: 2px solid #E6A23C;
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);

            .stat-item:first-child .value {
              color: #E6A23C;
            }
          }

          // 低预测值样式（预测为0）
          &.low-prediction {
            opacity: 0.6;
            border: 1px dashed #dcdfe6;

            .stat-item:first-child .value {
              color: #909399;
            }
          }
        }
      }
    }

    .history-date-tip {
      margin-bottom: 24px;

      .tip-content {
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          font-size: 16px;
        }

        span {
          flex: 1;
        }
      }
    }

    .no-prediction-tip {
      padding: 40px 20px;
      text-align: center;
      background: #f5f7fa;
      border-radius: 8px;
      margin-top: 16px;
    }

    .chart-container {
      height: 400px;
      margin-bottom: 16px;

      .chart {
        width: 100%;
        height: 100%;
      }
    }

    .forecast-note {
      .note-content {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        i {
          font-size: 16px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        span {
          line-height: 1.6;
        }
      }
    }
  }
}
</style>
