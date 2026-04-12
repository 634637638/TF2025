<template>
  <div class="transfer-analytics">
    <!-- 划拨批发概览卡片 -->
    <el-row v-if="showTransferOverviewCards" :gutter="16" class="overview-cards">
      <!-- 批发数量 -->
      <el-col v-if="canViewTransferField('wholesale_count')" :xs="12" :sm="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon wholesale">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="card-info">
              <div class="card-title">批发数量</div>
              <div class="card-value">{{ allocationData.wholesaleCount || 0 }}</div>
              <div class="card-compare">
                <span class="compare-label">上月: {{ lastMonthData.wholesaleCount || 0 }}</span>
                <span :class="getChangeClass(allocationData.wholesaleCount, lastMonthData.wholesaleCount)">
                  <i :class="getTrendIcon(allocationData.wholesaleCount, lastMonthData.wholesaleCount)"></i>
                  {{ calculateChange(allocationData.wholesaleCount, lastMonthData.wholesaleCount) }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 批发利润 -->
      <el-col v-if="canViewTransferField('wholesale_profit')" :xs="12" :sm="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon wholesale-profit">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="card-info">
              <div class="card-title">批发利润</div>
              <div class="card-value">{{ formatAmount(allocationData.wholesaleProfit || 0) }}</div>
              <div class="card-compare">
                <span class="compare-label">上月: {{ formatAmount(lastMonthData.wholesaleProfit || 0) }}</span>
                <span :class="getChangeClass(allocationData.wholesaleProfit, lastMonthData.wholesaleProfit)">
                  <i :class="getTrendIcon(allocationData.wholesaleProfit, lastMonthData.wholesaleProfit)"></i>
                  {{ calculateChange(allocationData.wholesaleProfit, lastMonthData.wholesaleProfit) }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 划拨数量 -->
      <el-col v-if="canViewTransferField('allocation_count')" :xs="12" :sm="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon allocation">
              <i class="fas fa-share-alt"></i>
            </div>
            <div class="card-info">
              <div class="card-title">划拨数量</div>
              <div class="card-value">{{ allocationData.allocationCount || 0 }}</div>
              <div class="card-compare">
                <span class="compare-label">上月: {{ lastMonthData.allocationCount || 0 }}</span>
                <span :class="getChangeClass(allocationData.allocationCount, lastMonthData.allocationCount)">
                  <i :class="getTrendIcon(allocationData.allocationCount, lastMonthData.allocationCount)"></i>
                  {{ calculateChange(allocationData.allocationCount, lastMonthData.allocationCount) }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 划拨金额 -->
      <el-col v-if="canViewTransferField('allocation_amount')" :xs="12" :sm="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon allocation-amount">
              <i class="fas fa-coins"></i>
            </div>
            <div class="card-info">
              <div class="card-title">划拨金额</div>
              <div class="card-value">{{ formatAmount(allocationData.allocationAmount || 0) }}</div>
              <div class="card-compare">
                <span class="compare-label">上月: {{ formatAmount(lastMonthData.allocationAmount || 0) }}</span>
                <span :class="getChangeClass(allocationData.allocationAmount, lastMonthData.allocationAmount)">
                  <i :class="getTrendIcon(allocationData.allocationAmount, lastMonthData.allocationAmount)"></i>
                  {{ calculateChange(allocationData.allocationAmount, lastMonthData.allocationAmount) }}%
                </span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row v-if="canViewTransferField('trend_chart')" :gutter="16" class="charts-section">
      <!-- 调货趋势 - 本月数据 -->
      <el-col :span="24">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <div style="display: flex; align-items: center; gap: 12px;">
                <h3>调货趋势分析</h3>
                <el-date-picker
                  v-model="selectedMonth"
                  type="month"
                  placeholder="选择月份"
                  format="YYYY年MM月"
                  value-format="YYYY-MM"
                  @change="handleMonthChange"
                  class="w-32"
                />
              </div>
              <el-tag type="info" size="small">{{ monthRangeText }}</el-tag>
            </div>
          </template>
          <div class="chart-container large">
            <div ref="trendChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showTransferRankingCharts" :gutter="16" class="charts-section">
      <!-- 批发产品排行 TOP10 -->
      <el-col v-if="canViewTransferField('wholesale_rank_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>批发机型排行 TOP10</h3>
              <el-tag type="primary" size="small">{{ displayMonthText }}</el-tag>
            </div>
          </template>
          <div class="chart-container">
            <div ref="wholesaleProductRankRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 划拨产品排行 TOP10 -->
      <el-col v-if="canViewTransferField('allocation_rank_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>划拨机型排行 TOP10</h3>
              <el-tag type="success" size="small">{{ displayMonthText }}</el-tag>
            </div>
          </template>
          <div class="chart-container">
            <div ref="allocationProductRankRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="canViewTransferField('store_distribution_chart')" :gutter="16" class="charts-section">
      <!-- 店铺分布 -->
      <el-col :span="24">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>店铺划拨批发分布</h3>
            </div>
          </template>
          <div class="chart-container">
            <div ref="storeDistributionRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格区域 -->
    <el-row v-if="canViewTransferField('operation_records_table')" :gutter="16" class="table-section admin-panel admin-table-panel">
      <el-col :span="24">
        <el-card class="table-card admin-panel admin-table-panel">
          <template #header>
            <div class="card-header">
              <h3>最近操作记录</h3>
              <el-space>
                <el-select v-model="typeFilter" placeholder="筛选类型" size="small" clearable class="w-28">
                  <el-option label="全部类型" value="" />
                  <el-option label="批发" value="wholesale" />
                  <el-option label="划拨" value="allocation" />
                </el-select>
                <el-button type="success" size="small" @click="exportData">
                  导出
                </el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="displayRecords" stripe class="w-full" max-height="400" v-loading="loading">
            <el-table-column prop="order_no" label="单号" width="120" />
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="getTypeTagType(row.type)" size="small">
                  {{ getTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="supplier_name" label="供应商" width="120" />
            <el-table-column prop="from_store_name" label="店铺" width="100" />
            <el-table-column prop="brand_name" label="品牌" width="100" />
            <el-table-column prop="model_name" label="型号" width="150" />
            <el-table-column prop="to_store_name" label="客户" width="120" />
            <el-table-column prop="amount" label="金额" width="100" align="right">
              <template #default="{ row }">
                {{ row.amount ? `¥${row.amount.toLocaleString()}` : '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="profit" label="利润" width="100" align="right">
              <template #default="{ row }">
                <span :class="getProfitClass(row.profit)">
                  {{ row.profit !== null && row.profit !== undefined ? `¥${row.profit.toLocaleString()}` : '-' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="140" />
            <el-table-column prop="operator_name" label="操作人" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Minus } from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { unifiedApi } from '@/utils/unified-api'
import echarts, { ECharts } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import type { TransferAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<TransferAnalyticsProps>(), {
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
const { canViewField: canViewTransferField, canViewAnyField: canViewAnyTransferField } = useAnalyticsFieldVisibility('transfer')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const transferData = ref({
  transferCount: 0,
  inboundCount: 0,
  outboundCount: 0,
  pendingCount: 0,
  transferGrowth: 0
})

const allocationData = ref({
  allocationCount: 0,
  wholesaleCount: 0,
  allocationAmount: 0,
  wholesaleAmount: 0,
  wholesaleProfit: 0,
  allocationGrowth: 0,
  wholesaleGrowth: 0
})

// 上月数据
const lastMonthData = ref({
  allocationCount: 0,
  wholesaleCount: 0,
  allocationAmount: 0,
  wholesaleAmount: 0,
  wholesaleProfit: 0
})

const { loading } = useLoadingState()
const typeFilter = ref('')
const monthRange = ref({ start: '', end: '' })

// 月份选择
// 默认使用当前月份
const now = TimeUtil.now()
const currentMonth = `${now.year()}-${String(now.month() + 1).padStart(2, '0')}`
const selectedMonth = ref(currentMonth)

// 图表引用
const trendChartRef = ref<HTMLElement>()
const wholesaleProductRankRef = ref<HTMLElement>()
const allocationProductRankRef = ref<HTMLElement>()
const storeDistributionRef = ref<HTMLElement>()

// 图表实例
let trendChart: ECharts | null = null
let wholesaleProductRankChart: ECharts | null = null
let allocationProductRankChart: ECharts | null = null
let storeDistributionChart: ECharts | null = null

// 图表是否已初始化
let chartsInitialized = false

// 原始数据
const rawData = ref({
  trends: [],
  wholesaleProductRanks: [],
  allocationProductRanks: [],
  storeDistribution: [],
  records: []
})

// 计算属性
const totalAmount = computed(() => {
  return (allocationData.value.allocationAmount || 0) + (allocationData.value.wholesaleAmount || 0)
})

const monthRangeText = computed(() => {
  if (monthRange.value.start && monthRange.value.end) {
    return `${monthRange.value.start} ~ ${monthRange.value.end}`
  }
  return ''
})

// 显示的月份文本
const displayMonthText = computed(() => {
  if (selectedMonth.value) {
    const [year, month] = selectedMonth.value.split('-')
    return `${year}年${month}月`
  }
  return '当前月'
})

const showTransferOverviewCards = computed(() => canViewAnyTransferField([
  'wholesale_count',
  'wholesale_profit',
  'allocation_count',
  'allocation_amount'
]))

const showTransferRankingCharts = computed(() => canViewAnyTransferField(['wholesale_rank_chart', 'allocation_rank_chart']))

// 计算环比变化
const calculateChange = (current: number, last: number): string => {
  if (!last || last === 0) return '0'
  const change = ((current - last) / last) * 100
  return change.toFixed(1)
}

// 获取变化样式类
const getChangeClass = (current: number, last: number): string => {
  if (!last || last === 0) return 'neutral'
  const change = current - last
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'neutral'
}

// 获取趋势图标
const getTrendIcon = (current: number, last: number): string => {
  if (!last || last === 0) return 'fas fa-minus'
  const change = current - last
  if (change > 0) return 'fas fa-arrow-up'
  if (change < 0) return 'fas fa-arrow-down'
  return 'fas fa-minus'
}

const displayRecords = computed(() => {
  let result = rawData.value.records || []
  if (typeFilter.value) {
    result = result.filter(item => item.type === typeFilter.value)
  }
  return result
})

// 格式化金额
const formatAmount = (amount: number) => {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toLocaleString()
}

// 加载数据
const loadData = async () => {
  try {
    loading.value = true
    emit('loading-change', true)

    // 计算本月和上月的日期范围
    const getCurrentMonthRange = () => {
      let year: number, month: number
      if (selectedMonth.value) {
        const parts = selectedMonth.value.split('-').map(Number)
        year = parts[0]
        month = parts[1]
      } else {
        const now = TimeUtil.now()
        year = now.year()
        month = now.month() + 1
      }
      const firstDay = TimeUtil.format(`${year}-${month}-01`, TIME_FORMATS.DATE)
      const lastDay = TimeUtil.endOf(`${year}-${month}-01`, 'month').format(TIME_FORMATS.DATE)
      return { start: firstDay, end: lastDay }
    }

    const getLastMonthRange = () => {
      let year: number, month: number
      if (selectedMonth.value) {
        const parts = selectedMonth.value.split('-').map(Number)
        year = parts[0]
        month = parts[1]
      } else {
        const now = TimeUtil.now()
        year = now.year()
        month = now.month() + 1
      }
      // 上月
      const lastMonth = TimeUtil.subtract(`${year}-${month}-01`, 1, 'month')
      const firstDay = TimeUtil.format(lastMonth, TIME_FORMATS.DATE)
      const lastDay = TimeUtil.endOf(lastMonth, 'month').format(TIME_FORMATS.DATE)
      return { start: firstDay, end: lastDay }
    }

    const currentRange = getCurrentMonthRange()
    const lastRange = getLastMonthRange()

    // 构建本月查询参数
    const currentParams: any = {
      startDate: currentRange.start,
      endDate: currentRange.end
    }

    // 使用父组件传递的检索参数（覆盖默认的月份范围）
    if (props.startDate) {
      currentParams.startDate = props.startDate
    }
    if (props.endDate) {
      currentParams.endDate = props.endDate
    }
    if (props.storeId) {
      currentParams.storeId = props.storeId
    }

    // 构建上月查询参数
    const lastParams: any = {
      startDate: lastRange.start,
      endDate: lastRange.end
    }

    // 并行获取本月和上月数据
    const [currentResponse, lastResponse] = await Promise.all([
      unifiedApi.get('/analytics/transfers-and-allocations', { params: currentParams }),
      unifiedApi.get('/analytics/transfers-and-allocations', { params: lastParams })
    ])

    // 处理本月数据
    if (currentResponse.success && currentResponse.data) {
      const data = currentResponse.data

      transferData.value = data.transfer || {
        transferCount: 0,
        inboundCount: 0,
        outboundCount: 0,
        pendingCount: 0,
        transferGrowth: 0
      }

      allocationData.value = data.allocation || {
        allocationCount: 0,
        wholesaleCount: 0,
        allocationAmount: 0,
        wholesaleAmount: 0,
        wholesaleProfit: 0,
        allocationGrowth: 0,
        wholesaleGrowth: 0
      }

      // 保存原始数据
      rawData.value = {
        trends: data.trends || [],
        wholesaleProductRanks: data.wholesaleProductRanks || [],
        allocationProductRanks: data.allocationProductRanks || [],
        storeDistribution: data.storeDistribution || [],
        records: data.records || []
      }

      // 更新月度范围
      if (data.monthRange) {
        monthRange.value = data.monthRange
      }
    }

    // 处理上月数据
    if (lastResponse.success && lastResponse.data && lastResponse.data.allocation) {
      lastMonthData.value = {
        allocationCount: lastResponse.data.allocation.allocationCount || 0,
        wholesaleCount: lastResponse.data.allocation.wholesaleCount || 0,
        allocationAmount: lastResponse.data.allocation.allocationAmount || 0,
        wholesaleAmount: lastResponse.data.allocation.wholesaleAmount || 0,
        wholesaleProfit: lastResponse.data.allocation.wholesaleProfit || 0
      }
    }

    // 更新图表
    updateCharts()
  } catch (err: any) {
    logger.error('❌ [TransferAnalytics] 获取数据失败:', err)
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

// 月份变化处理
const handleMonthChange = (value: string) => {
  loadData()
}

const initCharts = () => {
  // 销毁旧实例
  if (trendChart) {
    trendChart.dispose()
    trendChart = null
  }
  if (wholesaleProductRankChart) {
    wholesaleProductRankChart.dispose()
    wholesaleProductRankChart = null
  }
  if (allocationProductRankChart) {
    allocationProductRankChart.dispose()
    allocationProductRankChart = null
  }
  if (storeDistributionChart) {
    storeDistributionChart.dispose()
    storeDistributionChart = null
  }

  // 延迟初始化，确保 DOM 有正确的尺寸
  nextTick(() => {
    setTimeout(() => {
      if (trendChartRef.value) {
        trendChart = echarts.init(trendChartRef.value)
      }
      if (wholesaleProductRankRef.value) {
        wholesaleProductRankChart = echarts.init(wholesaleProductRankRef.value)
      }
      if (allocationProductRankRef.value) {
        allocationProductRankChart = echarts.init(allocationProductRankRef.value)
      }
      if (storeDistributionRef.value) {
        storeDistributionChart = echarts.init(storeDistributionRef.value)
      }
      chartsInitialized = true
      // 图表初始化完成后更新数据
      updateCharts()
    }, 200)
  })
}

const updateTrendChart = () => {
  if (!trendChart) return

  const trends = rawData.value.trends || []
  const dates = trends.map((t: any) => {
    const date = TimeUtil.toBeijing(t.date)
    return `${date.month() + 1}/${date.date()}`
  })
  const wholesaleData = trends.map((t: any) => t.wholesale || 0)
  const allocationData = trends.map((t: any) => t.allocation || 0)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['批发', '划拨']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '数量（台）'
    },
    series: [
      {
        name: '批发',
        type: 'line',
        data: wholesaleData,
        smooth: true,
        itemStyle: { color: '#E6A23C' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(230, 162, 60, 0.3)' },
            { offset: 1, color: 'rgba(230, 162, 60, 0.05)' }
          ])
        }
      },
      {
        name: '划拨',
        type: 'line',
        data: allocationData,
        smooth: true,
        itemStyle: { color: '#67C23A' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        }
      }
    ]
  }

  trendChart.setOption(option, true)
}

const updateWholesaleProductRank = () => {
  if (!wholesaleProductRankChart) return

  const products = rawData.value.wholesaleProductRanks || []

  if (products.length === 0) {
    wholesaleProductRankChart.clear()
    return
  }

  const names = products.map((p: any) => p.name)
  const counts = products.map((p: any) => p.count)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const p = products[idx]
        return `
          <div class="p-2">
            <div class="font-bold mb-2">${p.name}</div>
            <div>数量: ${p.count} 台</div>
            <div>金额: ¥${p.amount.toLocaleString()}</div>
          </div>
        `
      }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '数量（台）'
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      axisLabel: {
        width: 150,
        overflow: 'truncate'
      }
    },
    series: [{
      type: 'bar',
      data: counts,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#f472b6' },
          { offset: 1, color: '#ec4899' }
        ])
      }
    }]
  }

  wholesaleProductRankChart.setOption(option, true)
}

const updateAllocationProductRank = () => {
  if (!allocationProductRankChart) return

  const products = rawData.value.allocationProductRanks || []

  if (products.length === 0) {
    allocationProductRankChart.clear()
    return
  }

  const names = products.map((p: any) => p.name)
  const counts = products.map((p: any) => p.count)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const p = products[idx]
        return `
          <div class="p-2">
            <div class="font-bold mb-2">${p.name}</div>
            <div>数量: ${p.count} 台</div>
            <div>金额: ¥${p.amount.toLocaleString()}</div>
          </div>
        `
      }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '数量（台）'
    },
    yAxis: {
      type: 'category',
      data: names,
      inverse: true,
      axisLabel: {
        width: 150,
        overflow: 'truncate'
      }
    },
    series: [{
      type: 'bar',
      data: counts,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ])
      }
    }]
  }

  allocationProductRankChart.setOption(option, true)
}

const updateStoreDistribution = () => {
  if (!storeDistributionChart) return

  const stores = rawData.value.storeDistribution || []

  if (stores.length === 0) {
    storeDistributionChart.clear()
    return
  }

  const storeNames = stores.map((s: any) => s.store_name)
  const wholesaleData = stores.map((s: any) => s.wholesale_count || 0)
  const allocationData = stores.map((s: any) => s.allocation_count || 0)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const s = stores[idx]
        return `
          <div class="p-2">
            <div class="font-bold mb-2">${s.store_name}</div>
            <div>批发: ${s.wholesale_count} 台</div>
            <div>划拨: ${s.allocation_count} 台</div>
            <div>金额: ¥${s.amount.toLocaleString()}</div>
          </div>
        `
      }
    },
    legend: {
      data: ['批发', '划拨']
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
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '数量（台）'
    },
    series: [
      {
        name: '批发',
        type: 'bar',
        data: wholesaleData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f472b6' },
            { offset: 1, color: '#ec4899' }
          ])
        }
      },
      {
        name: '划拨',
        type: 'bar',
        data: allocationData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 1, color: '#188df0' }
          ])
        }
      }
    ]
  }

  storeDistributionChart.setOption(option, true)
}

const updateCharts = () => {
  nextTick(() => {
    // 延时确保 DOM 已渲染完成
    setTimeout(() => {
      updateTrendChart()
      updateWholesaleProductRank()
      updateAllocationProductRank()
      updateStoreDistribution()

      // 强制 resize 所有图表
      if (trendChart) trendChart.resize()
      if (wholesaleProductRankChart) wholesaleProductRankChart.resize()
      if (allocationProductRankChart) allocationProductRankChart.resize()
      if (storeDistributionChart) storeDistributionChart.resize()
    }, 300)
  })
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'wholesale': '批发',
    'allocation': '划拨'
  }
  return labels[type] || type
}

const getTypeTagType = (type: string): 'primary' | 'success' | 'info' => {
  const types: Record<string, 'primary' | 'success' | 'info'> = {
    'wholesale': 'primary',
    'allocation': 'success'
  }
  return types[type] || 'info'
}

const getStatusTagType = (status: string): 'warning' | 'success' | 'danger' | 'info' => {
  const types: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
    'pending': 'warning',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'pending': '待处理',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return labels[status] || status
}

const getProfitClass = (profit: number | null | undefined) => {
  if (profit === null || profit === undefined) return ''
  return profit >= 0 ? 'profit-positive' : 'profit-negative'
}

const exportData = () => {
  try {
    if (!displayRecords.value.length) {
      warning('当前没有可导出的划拨批发记录')
      return
    }

    const csvContent = buildCsvContent(
      ['单号', '类型', '供应商', '店铺', '品牌', '型号', '客户', '金额', '利润', '状态', '时间', '操作人'],
      displayRecords.value.map((row: any) => ([
        row.order_no || '',
        getTypeLabel(row.type),
        row.supplier_name || '',
        row.from_store_name || '',
        row.brand_name || '',
        row.model_name || '',
        row.to_store_name || '',
        row.amount ?? '',
        row.profit ?? '',
        getStatusLabel(row.status),
        row.created_at || '',
        row.operator_name || ''
      ]))
    )

    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('划拨批发记录', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '划拨批发数据导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

// 监听器
// 监听 isActive 变化，当切换到此 TAB 时初始化图表
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        loadData()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    loadData()
  }
})

// 生命周期
onMounted(() => {
  // 如果 TAB 已经激活，初始化图表
  if (props.isActive) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        loadData()
      }, 100)
    })
  }
})

onBeforeUnmount(() => {
  if (trendChart) trendChart.dispose()
  if (wholesaleProductRankChart) wholesaleProductRankChart.dispose()
  if (allocationProductRankChart) allocationProductRankChart.dispose()
  if (storeDistributionChart) storeDistributionChart.dispose()
})
</script>

<style lang="scss" scoped>
.transfer-analytics {
  .filter-section {
    margin-bottom: 16px;

    .filter-card {
      .filter-content {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .filter-item {
          display: flex;
          align-items: center;
          gap: 12px;

          .filter-label {
            font-size: 14px;
            color: #606266;
            font-weight: 500;
          }
        }
      }
    }
  }

  .overview-cards {
    margin-bottom: 24px;
  }

  .overview-card {
    height: 130px;

    .card-content {
      display: flex;
      align-items: center;
      height: 100%;
      gap: 16px;
    }

    .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: white;

      &.transfer {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.inbound {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      }

      &.outbound {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      &.pending {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      }

      &.allocation {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }

      &.allocation-amount {
        background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
      }

      &.wholesale {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }

      &.wholesale-profit {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }
    }

    .card-info {
      flex: 1;

      .card-title {
        font-size: 13px;
        color: var(--el-text-color-secondary);
        margin-bottom: 4px;
      }

      .card-value {
        font-size: 22px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .card-subtitle {
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        font-weight: 400;
      }

      .card-compare {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        margin-top: 4px;

        .compare-label {
          color: var(--el-text-color-secondary);
        }

        &.up {
          color: var(--el-color-success);
        }

        &.down {
          color: var(--el-color-danger);
        }

        &.neutral {
          color: var(--el-color-info);
        }
      }

      .card-change {
        display: flex;
        align-items: center;
        font-size: 12px;
        font-weight: 500;
        gap: 4px;

        &.positive { color: var(--el-color-success); }
        &.negative { color: var(--el-color-danger); }
        &.neutral { color: var(--el-color-info); }
      }
    }
  }

  .charts-section {
    margin-bottom: 24px;
  }

  .table-section {
    margin-bottom: 24px;
  }

  .chart-card,
  .table-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .chart-container {
    height: 300px;

    &.large {
      height: 350px;
    }

    .chart {
      width: 100%;
      height: 100%;
    }
  }

  .product-name {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .profit-positive {
    color: var(--el-color-success);
    font-weight: 500;
  }

  .profit-negative {
    color: var(--el-color-danger);
    font-weight: 500;
  }

  // 响应式设计 - 手机端
  @media (max-width: 768px) {
    .overview-card {
      height: auto;
      min-height: 110px;

      :deep(.el-card__body) {
        padding: 12px;
      }

      .card-content {
        gap: 10px;
      }

      .card-icon {
        width: 44px;
        height: 44px;
        font-size: 18px;
        flex-shrink: 0;
      }

      .card-info {
        min-width: 0;
        flex: 1;

        .card-title {
          font-size: 12px;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-value {
          font-size: 18px;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-compare {
          font-size: 10px;
          margin-top: 3px;
          flex-wrap: wrap;
          gap: 4px;

          .compare-label {
            font-size: 10px;
          }
        }
      }
    }

    .chart-container {
      height: 250px;

      &.large {
        height: 280px;
      }
    }

    .chart-card,
    .table-card {
      .card-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;

        h3 {
          font-size: 14px;
        }
      }
    }
  }
}
</style>
