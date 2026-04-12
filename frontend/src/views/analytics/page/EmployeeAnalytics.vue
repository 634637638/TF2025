<template>
  <div class="employee-analytics">
    <!-- 员工概览卡片 -->
    <div v-if="canViewEmployeeField('overview_stats')" class="overview-grid">
      <el-card class="overview-card">
        <div class="card-content">
          <div class="card-icon total">
            <i class="fas fa-users"></i>
          </div>
          <div class="card-info">
            <div class="card-title">员工总数</div>
            <div class="card-value">{{ employeeData.totalCount || 0 }}</div>
            <div class="card-change" :class="getChangeClass(employeeData.totalTrend)">
              <el-icon><component :is="getTrendIcon(employeeData.totalTrend)" /></el-icon>
              {{ formatPercent(employeeData.totalChange) }}
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="overview-card">
        <div class="card-content">
          <div class="card-icon active">
            <i class="fas fa-user-check"></i>
          </div>
          <div class="card-info">
            <div class="card-title">在职员工</div>
            <div class="card-value">{{ employeeData.activeCount || 0 }}</div>
            <div class="card-change neutral">
              <el-icon><Minus /></el-icon>
              稳定
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="overview-card overview-card-salary">
        <div class="card-content">
          <div class="card-icon salary">
            <i class="fas fa-money-bill-wave"></i>
          </div>
          <div class="card-info">
            <div class="card-title">本月应发工资</div>
            <div class="card-value">¥{{ formatNumber(employeeData.totalSalary || 0) }}</div>
            <div class="card-change" :class="getChangeClass(employeeData.salaryTrend)">
              <el-icon><component :is="getTrendIcon(employeeData.salaryTrend)" /></el-icon>
              {{ formatPercent(employeeData.salaryChange) }}
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="overview-card">
        <div class="card-content">
          <div class="card-icon new-sales">
            <i class="fas fa-mobile-alt"></i>
          </div>
          <div class="card-info">
            <div class="card-title">全新机销量</div>
            <div class="card-value">{{ salesData.newCount || 0 }}</div>
            <div class="card-change" :class="getChangeClass(salesData.newTrend)">
              <el-icon><component :is="getTrendIcon(salesData.newTrend)" /></el-icon>
              {{ formatPercent(salesData.newChange) }}
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="overview-card">
        <div class="card-content">
          <div class="card-icon used-sales">
            <i class="fas fa-recycle"></i>
          </div>
          <div class="card-info">
            <div class="card-title">二手机销量</div>
            <div class="card-value">{{ salesData.usedCount || 0 }}</div>
            <div class="card-change" :class="getChangeClass(salesData.usedTrend)">
              <el-icon><component :is="getTrendIcon(salesData.usedTrend)" /></el-icon>
              {{ formatPercent(salesData.usedChange) }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 图表区域 -->
    <el-row v-if="showEmployeePrimaryCharts" :gutter="16" class="charts-section">
      <!-- 员工角色分布 -->
      <el-col v-if="canViewEmployeeField('role_distribution_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card role-chart-card">
          <template #header>
            <div class="card-header">
              <div class="card-header-main">
                <h3>员工角色分布</h3>
                <span class="card-header-subtitle">查看团队岗位结构与占比</span>
              </div>
              <div class="card-header-actions">
                <span class="header-chip">组织结构</span>
                <el-button size="small" @click="toggleRoleChartType">
                  {{ roleChartType === 'pie' ? '柱状图' : '饼图' }}
                </el-button>
              </div>
            </div>
          </template>
          <div class="chart-container">
            <div ref="roleChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 销售对比 -->
      <el-col v-if="canViewEmployeeField('sales_compare_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card sales-chart-card">
          <template #header>
            <div class="card-header">
              <div class="card-header-main">
                <h3>销售对比</h3>
                <span class="card-header-subtitle">全新机与二手机销量趋势</span>
              </div>
              <div class="card-header-actions">
                <span class="header-chip highlight">销售趋势</span>
                <el-select v-model="salesComparePeriod" size="small" @change="updateSalesCompareChart">
                  <el-option label="本月" value="month" />
                  <el-option label="本季度" value="quarter" />
                  <el-option label="本年" value="year" />
                </el-select>
              </div>
            </div>
          </template>
          <div class="chart-container">
            <div ref="salesCompareRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showEmployeeSecondaryCharts" :gutter="16" class="charts-section">
      <!-- 工资趋势分析 -->
      <el-col v-if="canViewEmployeeField('salary_trend_chart')" :xs="24" :sm="24" :md="16" :lg="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>工资趋势分析</h3>
              <el-radio-group v-model="salaryTrendPeriod" size="small">
                <el-radio-button value="6">近半年</el-radio-button>
                <el-radio-button value="12">近一年</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container">
            <div ref="salaryTrendRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 出勤统计 -->
      <el-col v-if="canViewEmployeeField('attendance_chart')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <h3>本月出勤统计</h3>
            </div>
          </template>
          <div class="chart-container">
            <div ref="attendanceChartRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格区域 -->
    <el-row v-if="showEmployeeTableSection" :gutter="16" class="table-section admin-panel admin-table-panel">
      <!-- 员工销售业绩排行 -->
      <el-col v-if="canViewEmployeeField('performance_table')" :xs="24" :sm="24" :md="16" :lg="16">
        <el-card class="table-card admin-panel admin-table-panel">
          <template #header>
            <div class="card-header">
              <div class="card-header-main">
                <h3>员工销售业绩排行</h3>
                <span class="card-header-subtitle">零售、批发、划拨与在途工资联动展示</span>
              </div>
              <div class="card-header-actions">
                <span class="header-chip highlight">业务看板</span>
                <el-select v-model="performanceMetric" size="small" @change="loadEmployeePerformance">
                  <el-option label="总销售额" value="totalSales" />
                  <el-option label="全新机销量" value="newSales" />
                  <el-option label="二手机销量" value="usedSales" />
                  <el-option label="批发量" value="wholesale" />
                  <el-option label="划拨量" value="allocation" />
                </el-select>
                <el-button type="success" size="small" @click="exportPerformance">
                  导出
                </el-button>
              </div>
            </div>
          </template>
          <div class="performance-summary-strip">
            <div class="performance-summary-item">
              <span class="summary-label">排行人数</span>
              <span class="summary-value">{{ performanceSummary.employeeCount }}</span>
            </div>
            <div class="performance-summary-item">
              <span class="summary-label">总销售额</span>
              <span class="summary-value">¥{{ formatNumber(performanceSummary.totalSales) }}</span>
            </div>
            <div class="performance-summary-item">
              <span class="summary-label">批发 / 划拨</span>
              <span class="summary-value">{{ performanceSummary.wholesaleCount }} / {{ performanceSummary.allocationCount }}</span>
            </div>
          </div>
          <el-table :data="employeePerformance" stripe style="width: 100%" max-height="450" :table-layout="'auto'">
            <el-table-column type="index" label="排名" width="60" align="center" />
            <el-table-column prop="name" label="姓名" min-width="96" />
            <el-table-column prop="store_name" label="绑定店铺" min-width="110">
              <template #default="{ row }">
                <el-tag v-if="row.store_name" size="small" type="primary">{{ row.store_name }}</el-tag>
                <el-tag v-else size="small" type="info">未绑定</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="new_sales" label="全新销量" min-width="92" align="right">
              <template #default="{ row }">
                <span class="new-sales">{{ row.new_sales || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="used_sales" label="二手销量" min-width="92" align="right">
              <template #default="{ row }">
                <span class="used-sales">{{ row.used_sales || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="total_sales" label="总销售额" min-width="126" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.total_sales || 0) }}
              </template>
            </el-table-column>
            <el-table-column prop="wholesale_count" label="批发" min-width="78" align="right">
              <template #default="{ row }">
                <span class="wholesale-count">{{ row.wholesale_count || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="allocation_count" label="划拨" min-width="78" align="right">
              <template #default="{ row }">
                <span class="allocation-count">{{ row.allocation_count || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="attendance_rate" label="出勤率" min-width="90" align="center">
              <template #default="{ row }">
                <span :class="getAttendanceClass(row.attendance_rate || 0)">
                  {{ (row.attendance_rate || 0).toFixed(1) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="salary" label="在途工资" min-width="120" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.salary || 0) }}
              </template>
            </el-table-column>
            <el-table-column label="趋势" min-width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.trend === 'up' ? 'success' : row.trend === 'down' ? 'danger' : 'info'" size="small">
                  {{ row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 考勤详情 -->
      <el-col v-if="canViewEmployeeField('attendance_records_table')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="table-card admin-panel admin-table-panel">
          <template #header>
            <div class="card-header">
              <h3>考勤记录</h3>
              <el-badge :value="attendanceSummary.pendingCount" :hidden="attendanceSummary.pendingCount === 0" type="danger">
                <el-button type="success" size="small" @click="exportAttendance">导出</el-button>
              </el-badge>
            </div>
          </template>
          <div v-if="attendanceSummary.totalRecords > 0" class="attendance-summary-grid">
            <div class="attendance-summary-item">
              <div class="summary-label">近30天记录</div>
              <div class="summary-value">{{ attendanceSummary.totalRecords }}</div>
            </div>
            <div class="attendance-summary-item warning">
              <div class="summary-label">异常记录</div>
              <div class="summary-value">{{ attendanceSummary.abnormalCount }}</div>
            </div>
            <div class="attendance-summary-item primary">
              <div class="summary-label">请假/休假</div>
              <div class="summary-value">{{ attendanceSummary.leaveCount }}</div>
            </div>
            <div class="attendance-summary-item success">
              <div class="summary-label">加班记录</div>
              <div class="summary-value">{{ attendanceSummary.overtimeCount }}</div>
            </div>
          </div>
          <el-table :data="attendanceRecords" stripe style="width: 100%" max-height="450" empty-text="暂无考勤记录" :table-layout="'auto'">
            <el-table-column prop="date" label="日期" min-width="110" />
            <el-table-column prop="employee_name" label="员工" width="80" />
            <el-table-column prop="store_name" label="店铺" width="80">
              <template #default="{ row }">
                {{ row.store_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="96">
              <template #default="{ row }">
                <el-tag :type="getAttendanceTagType(row.type)" size="small">
                  {{ row.type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="detail" label="明细" min-width="90">
              <template #default="{ row }">
                {{ row.detail || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="76">
              <template #default="{ row }">
                <el-tag :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'info'" size="small">
                  {{ row.status === 'pending' ? '待处理' : row.status === 'approved' ? '已通过' : '已处理' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="approved_at" label="处理时间" min-width="140">
              <template #default="{ row }">
                {{ row.approved_at || '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useImportExport } from '@/composables/useImportExport'
import { analyticsService } from '@/api/analytics'
import echarts, { ECharts } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import type { EmployeeAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import dayjs from 'dayjs'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<EmployeeAnalyticsProps>(), {
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
const { canViewField: canViewEmployeeField, canViewAnyField: canViewAnyEmployeeField } = useAnalyticsFieldVisibility('employee')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const employeeData = ref({
  totalCount: 0,
  activeCount: 0,
  totalSalary: 0,
  baseSalaryTotal: 0,
  commissionTotal: 0,
  overtimePayTotal: 0,
  deductionTotal: 0,
  avgAttendance: 95,
  storeCount: 0,
  totalTrend: 'up',
  totalChange: 5.2,
  salaryTrend: 'up',
  salaryChange: 3.8
})

const salesData = ref({
  newCount: 0,
  usedCount: 0,
  avgSales: 0,
  newTrend: 'up',
  newChange: 12.5,
  usedTrend: 'up',
  usedChange: 8.3
})

const { loading } = useLoadingState()
const roleChartType = ref<'pie' | 'bar'>('pie')
const salesComparePeriod = ref('month')
const salaryTrendPeriod = ref('6')
const performanceMetric = ref('totalSales')

const employeePerformance = ref([])
const performanceSummary = computed(() => {
  return employeePerformance.value.reduce((summary: any, item: any) => {
    summary.employeeCount += 1
    summary.totalSales += Number(item.total_sales || 0)
    summary.wholesaleCount += Number(item.wholesale_count || 0)
    summary.allocationCount += Number(item.allocation_count || 0)
    return summary
  }, {
    employeeCount: 0,
    totalSales: 0,
    wholesaleCount: 0,
    allocationCount: 0
  })
})
const attendanceRecords = ref<any[]>([])
const attendanceSummary = ref({
  totalRecords: 0,
  employeeCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  abnormalCount: 0,
  leaveCount: 0,
  overtimeCount: 0
})

const showEmployeePrimaryCharts = computed(() => canViewAnyEmployeeField(['role_distribution_chart', 'sales_compare_chart']))
const showEmployeeSecondaryCharts = computed(() => canViewAnyEmployeeField(['salary_trend_chart', 'attendance_chart']))
const showEmployeeTableSection = computed(() => canViewAnyEmployeeField(['performance_table', 'attendance_records_table']))

// 图表引用
const roleChartRef = ref<HTMLElement>()
const salesCompareRef = ref<HTMLElement>()
const salaryTrendRef = ref<HTMLElement>()
const attendanceChartRef = ref<HTMLElement>()

// 图表实例
let roleChart: ECharts | null = null
let salesCompareChart: ECharts | null = null
let salaryTrendChart: ECharts | null = null
let attendanceChart: ECharts | null = null

// 图表初始化标记
let chartsInitialized = false

// 格式化金额
const formatAmount = (amount: number) => {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(1) + '万'
  }
  return amount.toLocaleString()
}

const formatNumber = (num: number) => {
  return num.toLocaleString('zh-CN')
}

const formatPercent = (percent: number) => {
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
}

const getChangeClass = (trend: string) => {
  return {
    'positive': trend === 'up',
    'negative': trend === 'down',
    'neutral': trend === 'stable'
  }
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up': return ArrowUp
    case 'down': return ArrowDown
    default: return Minus
  }
}

const getAttendanceClass = (rate: number) => {
  if (rate >= 95) return 'excellent'
  if (rate >= 85) return 'good'
  return 'warning'
}

const getAttendanceTagType = (type: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    '迟到': 'warning',
    '早退': 'warning',
    '缺勤': 'danger',
    '请假': 'info',
    '请假·事假': 'info',
    '请假·病假': 'warning',
    '月休': 'success',
    '加班': 'primary'
  }
  return typeMap[type] || 'info'
}

// 方法

// 缓存键
const CACHE_KEYS = {
  employeeAnalytics: (params: any) => `/analytics/employees/detail:${JSON.stringify(params)}`,
  attendanceSummary: (params: any) => `/analytics/attendance/summary:${JSON.stringify(params)}`,
  employeePerformance: (metric: string) => `/analytics/employees/performance:${metric}`,
  employeeRoles: '/analytics/employees/roles',
  salaryTrend: (months: number) => `/analytics/employees/salary-trend:${months}`,
  employeeAttendance: '/analytics/employees/attendance'
}

const loadEmployeeData = async () => {
  try {
    loading.value = true
    emit('loading-change', true)

    // 构建查询参数
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

    const cacheKeyEmployee = CACHE_KEYS.employeeAnalytics(params)
    const cacheKeyAttendance = CACHE_KEYS.attendanceSummary(params)

    // 使用 analyticsService 获取员工统计数据（使用缓存）
    const [employeeRes, attendanceRes] = await Promise.all([
      useCachedRequest(cacheKeyEmployee, () => analyticsService.getEmployeeAnalytics(params), DEFAULT_CACHE_TTL.STATIC),
      useCachedRequest(cacheKeyAttendance, () => analyticsService.getAttendanceSummary(params), DEFAULT_CACHE_TTL.STATIC)
    ])

    if (employeeRes.success) {
      employeeData.value = {
        totalCount: employeeRes.data.totalCount || 0,
        activeCount: employeeRes.data.activeCount || 0,
        totalSalary: employeeRes.data.totalSalary || 0,
        baseSalaryTotal: employeeRes.data.baseSalaryTotal || 0,
        commissionTotal: employeeRes.data.commissionTotal || 0,
        overtimePayTotal: employeeRes.data.overtimePayTotal || 0,
        deductionTotal: employeeRes.data.deductionTotal || 0,
        avgAttendance: employeeRes.data.avgAttendance || 0,
        storeCount: employeeRes.data.storeCount || 0,
        totalTrend: employeeRes.data.totalTrend || 'stable',
        totalChange: employeeRes.data.totalChange || 0,
        salaryTrend: employeeRes.data.salaryTrend || 'stable',
        salaryChange: employeeRes.data.salaryChange || 0
      }

      salesData.value = {
        newCount: employeeRes.data.newCount || 0,
        usedCount: employeeRes.data.usedCount || 0,
        avgSales: employeeRes.data.avgSales || 0,
        newTrend: 'up',
        newChange: 0,
        usedTrend: 'up',
        usedChange: 0
      }
    }

    if (attendanceRes.success && attendanceRes.data) {
      attendanceSummary.value = {
        totalRecords: attendanceRes.data.summary?.totalRecords || 0,
        employeeCount: attendanceRes.data.summary?.employeeCount || 0,
        pendingCount: attendanceRes.data.summary?.pendingCount || 0,
        approvedCount: attendanceRes.data.summary?.approvedCount || 0,
        abnormalCount: attendanceRes.data.summary?.abnormalCount || 0,
        leaveCount: attendanceRes.data.summary?.leaveCount || 0,
        overtimeCount: attendanceRes.data.summary?.overtimeCount || 0
      }
      attendanceRecords.value = Array.isArray(attendanceRes.data.records) ? attendanceRes.data.records : []
    } else {
      attendanceRecords.value = []
      attendanceSummary.value = {
        totalRecords: 0,
        employeeCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        abnormalCount: 0,
        leaveCount: 0,
        overtimeCount: 0
      }
    }

    await loadEmployeePerformance()
    updateCharts()
  } catch (err) {
    logger.error('获取员工数据失败:', err)
    error('获取员工数据失败，请稍后重试')
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

const loadEmployeePerformance = async () => {
  try {
    // 使用 analyticsService 获取员工业绩数据（使用缓存）
    const cacheKey = CACHE_KEYS.employeePerformance(performanceMetric.value)
    const response = await useCachedRequest(cacheKey, () =>
      analyticsService.getEmployeePerformance({
        metric: performanceMetric.value,
        limit: 20
      }), DEFAULT_CACHE_TTL.DYNAMIC)

    if (response.success) {
      employeePerformance.value = response.data
    } else {
      employeePerformance.value = []
    }
  } catch (err) {
    logger.error('获取员工业绩失败:', err)
    employeePerformance.value = []
  }
}

const initCharts = () => {
  // 先销毁已存在的图表实例
  if (roleChart) {
    roleChart.dispose()
    roleChart = null
  }
  if (salesCompareChart) {
    salesCompareChart.dispose()
    salesCompareChart = null
  }
  if (salaryTrendChart) {
    salaryTrendChart.dispose()
    salaryTrendChart = null
  }
  if (attendanceChart) {
    attendanceChart.dispose()
    attendanceChart = null
  }

  // 初始化新实例
  if (roleChartRef.value) roleChart = echarts.init(roleChartRef.value)
  if (salesCompareRef.value) salesCompareChart = echarts.init(salesCompareRef.value)
  if (salaryTrendRef.value) salaryTrendChart = echarts.init(salaryTrendRef.value)
  if (attendanceChartRef.value) attendanceChart = echarts.init(attendanceChartRef.value)

  // 所有图表初始化完成
  chartsInitialized = true
  updateCharts()
}

const updateRoleChart = async () => {
  if (!roleChart) return

  try {
    // 从API获取真实数据（使用缓存）
    const response = await useCachedRequest(CACHE_KEYS.employeeRoles, () =>
      analyticsService.getEmployeeRoles(), DEFAULT_CACHE_TTL.STATIC)
    const data = response.success ? response.data : [
      { value: 5, name: '管理员' },
      { value: 8, name: '销售主管' },
      { value: 10, name: '销售员' },
      { value: 2, name: '店长' }
    ]

    const option: any = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      }
    }

    if (roleChartType.value === 'pie') {
      option.series = [{
        name: '员工角色',
        type: 'pie',
        radius: ['40%', '70%'],
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
      option.xAxis = { type: 'category', data: data.map(item => item.name) }
      option.yAxis = { type: 'value' }
      option.series = [{
        type: 'bar',
        data: data.map(item => item.value),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 1, color: '#188df0' }
          ])
        }
      }]
    }

    roleChart.setOption(option)
  } catch (err) {
    logger.error('更新角色图表失败:', err)
  }
}

const updateSalesCompareChart = () => {
  if (!salesCompareChart) return

  const months = salesComparePeriod.value === 'month' ? ['第1周', '第2周', '第3周', '第4周'] :
                  salesComparePeriod.value === 'quarter' ? ['1月', '2月', '3月'] : ['Q1', 'Q2', 'Q3', 'Q4']

  const newData = months.map(() => Math.floor(Math.random() * 50 + 30))
  const usedData = months.map(() => Math.floor(Math.random() * 30 + 15))

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['全新机', '二手机']
    },
    xAxis: {
      type: 'category',
      data: months
    },
    yAxis: {
      type: 'value',
      name: '销量'
    },
    series: [
      {
        name: '全新机',
        type: 'bar',
        data: newData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 1, color: '#188df0' }
          ])
        }
      },
      {
        name: '二手机',
        type: 'bar',
        data: usedData,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f472b6' },
            { offset: 1, color: '#ec4899' }
          ])
        }
      }
    ]
  }

  salesCompareChart.setOption(option)
}

const updateSalaryTrendChart = async () => {
  if (!salaryTrendChart) return

  try {
    // 从API获取真实数据（使用缓存）
    const cacheKey = CACHE_KEYS.salaryTrend(parseInt(salaryTrendPeriod.value))
    const response = await useCachedRequest(cacheKey, () =>
      analyticsService.getEmployeeSalaryTrend({
        months: parseInt(salaryTrendPeriod.value)
      }), DEFAULT_CACHE_TTL.STATIC)

    let months = []
    let salaries = []

    if (response.success && response.data) {
      months = response.data.months || []
      salaries = response.data.salaries || []
    } else {
      // 生成默认数据
      const now = dayjs()
      const count = salaryTrendPeriod.value === '6' ? 6 : 12

      for (let i = count - 1; i >= 0; i--) {
        const date = now.subtract(i, 'month')
        months.push(`${date.month() + 1}月`)
        salaries.push(Math.floor(150000 + Math.random() * 50000))
      }
    }

    const option = {
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: months
      },
      yAxis: {
        type: 'value',
        name: '工资总额(元)',
        axisLabel: {
          formatter: (value: number) => {
            return (value / 10000).toFixed(0) + '万'
          }
        }
      },
      series: [{
        name: '工资总额',
        type: 'line',
        data: salaries,
        smooth: true,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        },
        itemStyle: { color: '#1890ff' }
      }]
    }

    salaryTrendChart.setOption(option)
  } catch (err) {
    logger.error('更新工资趋势图表失败:', err)
  }
}

const updateAttendanceChart = async () => {
  if (!attendanceChart) return

  try {
    // 从API获取真实数据（使用缓存）
    const response = await useCachedRequest(CACHE_KEYS.employeeAttendance, () =>
      analyticsService.getEmployeeAttendance(), DEFAULT_CACHE_TTL.STATIC)
    const data = response.success ? response.data : [
      { value: 85, name: '正常', color: '#52c41a' },
      { value: 8, name: '迟到', color: '#faad14' },
      { value: 4, name: '早退', color: '#fa8c16' },
      { value: 3, name: '缺勤', color: '#ff4d4f' }
    ]

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}%'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data,
        label: {
          formatter: '{b}\n{c}%'
        }
      }]
    }

    attendanceChart.setOption(option)
  } catch (err) {
    logger.error('更新出勤图表失败:', err)
  }
}

const updateCharts = () => {
  nextTick(() => {
    setTimeout(async () => {
      await updateRoleChart()
      await updateSalesCompareChart()
      await updateSalaryTrendChart()
      await updateAttendanceChart()

      if (roleChart) roleChart.resize()
      if (salesCompareChart) salesCompareChart.resize()
      if (salaryTrendChart) salaryTrendChart.resize()
      if (attendanceChart) attendanceChart.resize()
    }, 100)
  })
}

const toggleRoleChartType = () => {
  roleChartType.value = roleChartType.value === 'pie' ? 'bar' : 'pie'
  updateRoleChart()
}

const exportPerformance = () => {
  try {
    if (!employeePerformance.value.length) {
      warning('当前没有可导出的员工业绩数据')
      return
    }

    const csvContent = generatePerformanceCSV()
    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('员工业绩排行', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

const exportAttendance = () => {
  try {
    if (!attendanceRecords.value.length) {
      warning('当前没有可导出的考勤记录')
      return
    }

    const csvContent = generateAttendanceCSV()
    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('员工考勤记录', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

const generatePerformanceCSV = () => {
  const headers = ['排名', '姓名', '绑定店铺', '全新销量', '二手销量', '总销售额', '批发', '划拨', '出勤率', '在途工资', '趋势']
  const rows = employeePerformance.value.map((item: any, index: number) => [
    index + 1,
    item.name,
    item.store_name || '未绑定',
    item.new_sales || 0,
    item.used_sales || 0,
    item.total_sales || 0,
    item.wholesale_count || 0,
    item.allocation_count || 0,
    `${(item.attendance_rate || 0).toFixed(1)}%`,
    item.salary || 0,
    item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'
  ])

  return buildCsvContent(headers, rows)
}

const generateAttendanceCSV = () => {
  const headers = ['日期', '员工', '店铺', '类型', '明细', '状态', '处理时间']
  const rows = attendanceRecords.value.map((item: any) => [
    item.date,
    item.employee_name,
    item.store_name || '-',
    item.type,
    item.detail || '-',
    item.status === 'pending' ? '待处理' : item.status === 'approved' ? '已通过' : '已处理',
    item.approved_at || '-'
  ])

  return buildCsvContent(headers, rows)
}

// 监听器
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(async () => {
        initCharts()
        await loadEmployeeData()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    loadEmployeeData()
  }
})

watch(salaryTrendPeriod, () => {
  if (chartsInitialized) {
    updateSalaryTrendChart()
  }
})

watch(salesComparePeriod, () => {
  if (chartsInitialized) {
    updateSalesCompareChart()
  }
})

// 生命周期
onMounted(() => {
  // 只在 TAB 激活时才初始化图表
  if (props.isActive) {
    nextTick(() => {
      // 延迟初始化图表，确保 DOM 元素有正确的尺寸
      setTimeout(async () => {
        initCharts()
        await loadEmployeeData()
      }, 100)
    })
  }
})

onBeforeUnmount(() => {
  if (roleChart) {
    roleChart.dispose()
    roleChart = null
  }
  if (salesCompareChart) {
    salesCompareChart.dispose()
    salesCompareChart = null
  }
  if (salaryTrendChart) {
    salaryTrendChart.dispose()
    salaryTrendChart = null
  }
  if (attendanceChart) {
    attendanceChart.dispose()
    attendanceChart = null
  }
})
</script>

<style lang="scss" scoped>
.employee-analytics {
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .overview-card {
    height: 152px;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);

    :deep(.el-card__body) {
      height: 100%;
      padding: 18px 18px 16px;
    }

    .card-content {
      display: flex;
      align-items: flex-start;
      height: 100%;
      gap: 16px;
    }

    .card-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;

      &.total {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.active {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      &.salary {
        background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
      }

      &.new-sales {
        background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%);
      }

      &.used-sales {
        background: linear-gradient(135deg, #db2777 0%, #f472b6 100%);
      }
    }

    .card-info {
      flex: 1;
      min-width: 0;

      .card-title {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }

      .card-value {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--el-text-color-primary);
        margin-bottom: 8px;
        line-height: 1.1;
      }

      .card-desc {
        font-size: 12px;
        line-height: 1.5;
        color: var(--el-text-color-regular);
        margin-bottom: 10px;
        word-break: break-word;
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

  .overview-card-salary {
    background:
      radial-gradient(circle at top right, rgba(20, 184, 166, 0.18), transparent 42%),
      linear-gradient(180deg, rgba(240, 253, 250, 0.96), rgba(255, 255, 255, 1));

    .card-icon.salary {
      box-shadow: 0 12px 24px rgba(20, 184, 166, 0.25);
    }
  }

  .charts-section {
    margin-bottom: 24px;

    :deep(.el-col) {
      display: flex;
      margin-bottom: 0;
    }
  }

  .table-section {
    margin-bottom: 24px;
  }

  .chart-card,
  .table-card {
    width: 100%;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);

    :deep(.el-card__header) {
      padding: 16px 18px 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.98));
    }

    :deep(.el-card__body) {
      padding: 18px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .card-header-main {
        min-width: 0;
      }

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
      }

      .card-header-subtitle {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: #64748b;
      }

      .card-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .header-chip {
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.08);
        color: #0f766e;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;

        &.highlight {
          background: rgba(37, 99, 235, 0.08);
          color: #2563eb;
        }
      }
    }
  }

  .chart-card {
    height: 100%;
    overflow: hidden;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      min-height: 360px;
    }
  }

  .role-chart-card {
    background:
      radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  }

  .sales-chart-card {
    background:
      radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  }

  .chart-container {
    flex: 1;
    min-height: 320px;

    .chart {
      width: 100%;
      height: 100%;
    }
  }

  .attendance-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .performance-summary-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .performance-summary-item {
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));

    .summary-label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: #64748b;
    }

    .summary-value {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
  }

  .attendance-summary-item {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));

    &.warning {
      background: linear-gradient(180deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.98));
    }

    &.primary {
      background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
    }

    &.success {
      background: linear-gradient(180deg, rgba(240, 253, 244, 0.96), rgba(255, 255, 255, 0.98));
    }

    .summary-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
    }

    .summary-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.1;
    }
  }

  .new-sales {
    color: #1890ff;
    font-weight: 600;
  }

  .used-sales {
    color: #ec4899;
    font-weight: 600;
  }

  .wholesale-count {
    color: #2563eb;
    font-weight: 700;
  }

  .allocation-count {
    color: #0f766e;
    font-weight: 700;
  }

  .excellent {
    color: var(--el-color-success);
    font-weight: 600;
  }

  .good {
    color: var(--el-color-warning);
    font-weight: 600;
  }

  .warning {
    color: var(--el-color-danger);
    font-weight: 600;
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

  // 响应式设计支持
  @media (max-width: 1200px) {
    .overview-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .overview-card {
      height: 136px;

      .card-icon {
        width: 50px;
        height: 50px;
        font-size: 20px;
      }

      .card-info {
        .card-value {
          font-size: 24px;
        }
      }
    }

    .chart-container {
      height: 250px;
      min-height: 250px;
    }
  }

  @media (max-width: 768px) {
    .attendance-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .performance-summary-strip {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .overview-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .overview-card {
      height: 124px;

      .card-icon {
        width: 40px;
        height: 40px;
        font-size: 16px;
      }

      .card-info {
        .card-title {
          font-size: 12px;
        }

        .card-value {
          font-size: 18px;
        }

        .card-desc {
          font-size: 11px;
        }

        .card-change {
          font-size: 10px;
        }
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

        .card-header-actions {
          width: 100%;
          justify-content: space-between;
        }
      }
    }

    .chart-container {
      height: 200px;
      min-height: 200px;
    }

    .el-table {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .overview-grid {
      grid-template-columns: 1fr;
    }

    .attendance-summary-grid {
      grid-template-columns: 1fr;
    }

    .charts-section,
    .table-section {
      :deep(.el-col) {
        width: 100%;
        max-width: 100%;
        flex: 0 0 100%;
        margin-bottom: 16px;
      }
    }
  }
}
</style>
