<template>
  <div class="customer-analytics">
    <!-- 客户概览卡片 -->
    <el-row v-if="canViewCustomerField('overview_stats')" :gutter="24" class="overview-cards">
      <el-col :xs="12" :sm="6" v-for="card in overviewCards" :key="card.title">
        <el-card class="overview-card" :class="card.type">
          <div class="card-content">
            <div class="card-icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-title">{{ card.title }}</div>
              <div class="card-value">{{ card.value }}</div>
              <div class="card-trend" :class="card.trend">
                <el-icon><ArrowUp v-if="card.trend === 'up'" /><ArrowDown v-else /></el-icon>
                {{ card.change }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row v-if="showCustomerPrimaryCharts" :gutter="24" class="chart-section">
      <!-- 客户增长趋势 -->
      <el-col v-if="canViewCustomerField('growth_chart')" :xs="24" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>客户增长趋势</span>
              <el-radio-group v-model="growthPeriod" size="small">
                <el-radio-button value="7d">7天</el-radio-button>
                <el-radio-button value="30d">30天</el-radio-button>
                <el-radio-button value="90d">90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="growthChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 客户细分 -->
      <el-col v-if="canViewCustomerField('segment_chart')" :xs="24" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>客户价值细分</span>
              <el-tooltip content="基于RFM模型的客户价值分析">
                <el-icon><InfoFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <div ref="segmentChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showCustomerSecondaryCharts" :gutter="24" class="chart-section">
      <!-- 留存率分析 -->
      <el-col v-if="canViewCustomerField('retention_chart')" :xs="24" :lg="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>客户留存率分析</span>
              <el-select v-model="retentionCohort" size="small" style="width: 120px">
                <el-option label="按注册月" value="monthly" />
                <el-option label="按注册季" value="quarterly" />
                <el-option label="按注册年" value="yearly" />
              </el-select>
            </div>
          </template>
          <div ref="retentionChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 客户活跃度 -->
      <el-col v-if="canViewCustomerField('activity_chart')" :xs="24" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>客户活跃度分布</span>
            </div>
          </template>
          <div ref="activityChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 客户列表和分析 -->
    <el-row v-if="showCustomerTableSection" :gutter="24" class="table-section admin-panel admin-table-panel">
      <!-- 高价值客户 -->
      <el-col v-if="canViewCustomerField('customer_list')" :xs="24" :lg="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>高价值客户</span>
              <div class="header-actions">
                <el-input
                  v-model="customerSearch"
                  placeholder="搜索客户..."
                  prefix-icon="Search"
                  size="small"
                  clearable
                  style="width: 200px"
                />
                <el-button type="success" size="small" @click="exportCustomers">
                  <el-icon><Download /></el-icon>
                  导出
                </el-button>
              </div>
            </div>
          </template>

          <el-table
            :data="filteredCustomers"
            v-loading="customerLoading"
            stripe
            :max-height="400"
          >
            <el-table-column prop="name" label="客户姓名" min-width="100" />
            <el-table-column prop="phone" label="手机号" width="120" />
            <el-table-column prop="segment" label="客户细分" width="100">
              <template #default="{ row }">
                <el-tag :type="getSegmentTagType(row.segment)" size="small">
                  {{ getSegmentText(row.segment) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="orders_count" label="订单数" width="80" align="right" />
            <el-table-column prop="total_amount" label="消费金额" width="110" align="right">
              <template #default="{ row }">
                ¥{{ formatMoney(row.total_amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="last_order_date" label="最后消费" width="110">
              <template #default="{ row }">
                {{ formatDate(row.last_order_date) }}
              </template>
            </el-table-column>
            <el-table-column v-if="canViewCustomerField('customer_detail')" label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="viewCustomerDetail(row)"
                >
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="table-footer">
            <Pagination
              v-model:current="customerPage"
              v-model:page-size="customerPageSize"
              :page-sizes="[10, 20, 50]"
              :total="customerTotal"
              :show-range="true"
              @change="loadCustomers"
            />
          </div>
        </el-card>
      </el-col>

      <!-- 客户洞察 -->
      <el-col v-if="canViewCustomerField('behavior_insights')" :xs="24" :lg="10">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>客户行为洞察</span>
              <el-button link size="small" @click="refreshInsights">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>

          <div class="insights-list">
            <div v-for="insight in customerInsights" :key="insight.id" class="insight-item">
              <div class="insight-header">
                <el-icon class="insight-icon" :class="insight.type">
                  <component :is="insight.icon" />
                </el-icon>
                <span class="insight-title">{{ insight.title }}</span>
              </div>
              <div class="insight-content">{{ insight.content }}</div>
              <div class="insight-footer">
                <span class="insight-impact" :class="insight.impact">
                  {{ insight.impactText }}
                </span>
                <span class="insight-date">{{ formatDate(insight.date) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 客户详情对话框 -->
    <MobileDialog
      v-if="canViewCustomerField('customer_detail')"
      v-model="customerDetailVisible"
      title="客户详细分析"
      width="70%"
      :destroy-on-close="true"
      dialog-class="customer-detail-dialog"
      :show-default-footer="false"
    >
      <div v-if="selectedCustomer" class="customer-detail">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border class="customer-info">
          <el-descriptions-item label="客户姓名">{{ selectedCustomer.name }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ selectedCustomer.phone }}</el-descriptions-item>
          <el-descriptions-item label="客户细分">
            <el-tag :type="getSegmentTagType(selectedCustomer.segment)">
              {{ getSegmentText(selectedCustomer.segment) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatDate(selectedCustomer.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="总订单数">{{ selectedCustomer.orders_count }}</el-descriptions-item>
          <el-descriptions-item label="总消费金额">¥{{ formatMoney(selectedCustomer.total_amount) }}</el-descriptions-item>
          <el-descriptions-item label="平均客单价">¥{{ formatMoney(selectedCustomer.avg_order_value) }}</el-descriptions-item>
          <el-descriptions-item label="最后消费">{{ formatDate(selectedCustomer.last_order_date) }}</el-descriptions-item>
        </el-descriptions>

        <!-- 消费趋势图 -->
        <el-card class="detail-card">
          <template #header>
            <span>消费趋势分析</span>
          </template>
          <div ref="customerTrendChartRef" class="chart-container"></div>
        </el-card>

        <!-- 商品偏好 -->
        <el-card class="detail-card">
          <template #header>
            <span>商品偏好分析</span>
          </template>
          <div ref="customerPreferenceChartRef" class="chart-container"></div>
        </el-card>
      </div>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, markRaw, watch } from 'vue';
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useImportExport } from '@/composables/useImportExport'
import Pagination from '@/components/Pagination.vue'
import { buildCsvContent } from '@/utils/csv-export'
const { success, error: showError, info, warning } = useNotification()
import {
  User,
  ShoppingBag,
  TrendCharts,
  Star,
  ArrowUp,
  ArrowDown,
  InfoFilled,
  Search,
  Download,
  Refresh,
  Warning,
  CircleCheck
} from '@element-plus/icons-vue';
import echarts, { ECharts } from '@/utils/echarts'
import { analyticsService } from '@/api/analytics'
import type { CustomerAnalytics, CustomerSegment, CustomerInsight, CustomerDetail } from '@/types/analytics';
import type { CustomerAnalyticsProps } from '@/types/component'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<CustomerAnalyticsProps>(), {
  loading: false,
  isActive: false,
  startDate: '',
  endDate: '',
  storeId: '',
  supplierId: '',
  searchTrigger: 0
})

const { canViewField: canViewCustomerField, canViewAnyField: canViewAnyCustomerField } = useAnalyticsFieldVisibility('customer')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const { loading } = useLoadingState();
const { loading: customerLoading } = useLoadingState();
const growthPeriod = ref<'30d' | '7d' | '90d'>('30d');
const retentionCohort = ref<'monthly' | 'quarterly' | 'yearly'>('monthly');
const customerSearch = ref('');
const customerPage = ref(1);
const customerPageSize = ref(20);
const customerTotal = ref(0);

// 概览数据
const overviewCards = ref([
  {
    title: '总客户数',
    value: '0',
    change: '0%',
    trend: 'up',
    type: 'primary',
    icon: markRaw(User)
  },
  {
    title: '新增客户',
    value: '0',
    change: '0%',
    trend: 'up',
    type: 'success',
    icon: markRaw(User)
  },
  {
    title: '活跃客户',
    value: '0',
    change: '0%',
    trend: 'up',
    type: 'warning',
    icon: markRaw(TrendCharts)
  },
  {
    title: '高价值客户',
    value: '0',
    change: '0%',
    trend: 'up',
    type: 'danger',
    icon: markRaw(Star)
  }
]);

// 客户数据
const customers = ref<CustomerDetail[]>([]);
const customerInsights = ref<CustomerInsight[]>([]);
const customerDetailVisible = ref(false);
const selectedCustomer = ref<CustomerDetail | null>(null);

// 图表实例
const charts = ref<{
  growth?: ECharts;
  segment?: ECharts;
  retention?: ECharts;
  activity?: ECharts;
  customerTrend?: ECharts;
  customerPreference?: ECharts;
}>({});

// 图表初始化标记
let chartsInitialized = false

// 保存 resize 处理函数引用，用于后续移除
const handleResize = () => {
  Object.values(charts.value).forEach(chart => {
    chart?.resize();
  });
};

// 图表引用
const growthChartRef = ref<HTMLElement>();
const segmentChartRef = ref<HTMLElement>();
const retentionChartRef = ref<HTMLElement>();
const activityChartRef = ref<HTMLElement>();
const customerTrendChartRef = ref<HTMLElement>();
const customerPreferenceChartRef = ref<HTMLElement>();

// 图表初始化重试计数器
const chartInitRetries = ref({
  growth: 0,
  segment: 0,
  retention: 0,
  activity: 0,
  customerTrend: 0,
  customerPreference: 0
});
const MAX_RETRY = 5; // 最大重试次数（减少避免过多警告）

// 计算属性
const filteredCustomers = computed(() => {
  if (!customerSearch.value) return customers.value;

  const search = customerSearch.value.toLowerCase();
  return customers.value.filter(customer =>
    customer.name.toLowerCase().includes(search) ||
    customer.phone.includes(search)
  );
});

const showCustomerPrimaryCharts = computed(() => canViewAnyCustomerField(['growth_chart', 'segment_chart']))
const showCustomerSecondaryCharts = computed(() => canViewAnyCustomerField(['retention_chart', 'activity_chart']))
const showCustomerTableSection = computed(() => canViewAnyCustomerField(['customer_list', 'behavior_insights']))

// 方法
const formatMoney = (amount: number): string => {
  return (amount / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('zh-CN');
};

const getSegmentTagType = (segment: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const types: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'high-value': 'danger',
    'potential': 'warning',
    'at-risk': 'info',
    'lost': 'info'
  };
  return types[segment] || 'info';
};

const getSegmentText = (segment: string): string => {
  const texts: Record<string, string> = {
    'high-value': '高价值',
    'potential': '潜力客户',
    'at-risk': '流失风险',
    'lost': '已流失'
  };
  return texts[segment] || segment;
};

// 缓存键
const CACHE_KEYS = {
  customerOverview: (params: any) => `/analytics/customers:${JSON.stringify(params)}`,
  customerList: (page: number, pageSize: number, search: string) => `/analytics/customers/high-value:${page}:${pageSize}:${search}`,
  customerGrowth: (period: string) => `/analytics/customers/growth:${period}`,
  customerSegments: '/analytics/customers/segments',
  customerRetention: (cohort: string) => `/analytics/customers/retention:${cohort}`,
  customerActivity: '/analytics/customers/activity'
}

const loadOverview = async () => {
  try {
    loading.value = true;

    // 构建查询参数
    const params: any = { period: growthPeriod.value };

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

    const cacheKey = CACHE_KEYS.customerOverview(params)
    const response = await useCachedRequest(cacheKey, () => analyticsService.getCustomerAnalytics(params), DEFAULT_CACHE_TTL.STATIC);
    const data: any = response?.data || {
      totalCustomers: 0,
      customersGrowth: 0,
      newCustomers: 0,
      newCustomersGrowth: 0,
      activeCustomers: 0,
      activeCustomersGrowth: 0,
      highValueCustomers: 0,
      highValueCustomersGrowth: 0,
      insights: []
    };

    // 更新概览卡片
    overviewCards.value = [
      {
        title: '总客户数',
        value: (data.totalCustomers || 0).toLocaleString(),
        change: `${(data.customersGrowth || 0) > 0 ? '+' : ''}${data.customersGrowth || 0}%`,
        trend: (data.customersGrowth || 0) > 0 ? 'up' : 'down',
        type: 'primary',
        icon: User
      },
      {
        title: '新增客户',
        value: (data.newCustomers || 0).toLocaleString(),
        change: `${(data.newCustomersGrowth || 0) > 0 ? '+' : ''}${data.newCustomersGrowth || 0}%`,
        trend: (data.newCustomersGrowth || 0) > 0 ? 'up' : 'down',
        type: 'success',
        icon: User
      },
      {
        title: '活跃客户',
        value: (data.activeCustomers || 0).toLocaleString(),
        change: `${(data.activeCustomersGrowth || 0) > 0 ? '+' : ''}${data.activeCustomersGrowth || 0}%`,
        trend: (data.activeCustomersGrowth || 0) > 0 ? 'up' : 'down',
        type: 'warning',
        icon: TrendCharts
      },
      {
        title: '高价值客户',
        value: (data.highValueCustomers || 0).toLocaleString(),
        change: `${(data.highValueCustomersGrowth || 0) > 0 ? '+' : ''}${data.highValueCustomersGrowth || 0}%`,
        trend: (data.highValueCustomersGrowth || 0) > 0 ? 'up' : 'down',
        type: 'danger',
        icon: Star
      }
    ];

    // 更新客户洞察
    customerInsights.value = data.insights || [];

  } catch (err) {
    logger.error('加载客户概览失败:', err);
    logger.error('错误详情:', err.response?.data || err.message);
    showError('加载客户概览失败');
  } finally {
    loading.value = false;
  }
};

const loadCustomers = async () => {
  try {
    customerLoading.value = true;
    const cacheKey = CACHE_KEYS.customerList(customerPage.value, customerPageSize.value, customerSearch.value)
    const response = await useCachedRequest(cacheKey, () => analyticsService.getHighValueCustomers({
      page: customerPage.value,
      pageSize: customerPageSize.value,
      search: customerSearch.value
    }), DEFAULT_CACHE_TTL.STATIC);

    customers.value = response.data;
    customerTotal.value = Number(response.pagination.total) || 0;
  } catch (err) {
    logger.error('加载客户列表失败:', err);
    showError('加载客户列表失败');
  } finally {
    customerLoading.value = false;
  }
};

const initGrowthChart = async () => {
  if (!growthChartRef.value) return;

  // 检查 DOM 尺寸是否有效
  const rect = growthChartRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    if (chartInitRetries.value.growth < MAX_RETRY) {
      chartInitRetries.value.growth++;
      setTimeout(() => initGrowthChart(), 200);
    }
    return;
  }

  try {
    // 销毁旧实例
    if (charts.value.growth) {
      charts.value.growth.dispose();
      charts.value.growth = undefined;
    }
    const chart = echarts.init(growthChartRef.value);
    charts.value.growth = chart;

    const cacheKey = CACHE_KEYS.customerGrowth(growthPeriod.value)
    const response = await useCachedRequest(cacheKey, () => analyticsService.getCustomerGrowth({ period: growthPeriod.value }), DEFAULT_CACHE_TTL.DYNAMIC);
    const data = response?.data || { labels: [], values: [] };

    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>新增客户: ${param.value}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.labels || [],
        boundaryGap: false
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: data.values || [],
        type: 'line',
        smooth: true,
        itemStyle: {
          color: '#409EFF'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(64, 158, 255, 0.3)'
            }, {
              offset: 1, color: 'rgba(64, 158, 255, 0.05)'
            }]
          }
        }
      }]
    };

    chart.setOption(option);
    // 确保图表正确渲染
    setTimeout(() => chart.resize(), 100);
  } catch (err) {
    logger.error('加载客户增长数据失败:', err);
  }
};

const initSegmentChart = async () => {
  if (!segmentChartRef.value) return;

  // 检查 DOM 尺寸是否有效
  const rect = segmentChartRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    if (chartInitRetries.value.segment < MAX_RETRY) {
      chartInitRetries.value.segment++;
      setTimeout(() => initSegmentChart(), 200);
    }
    return;
  }

  try {
    // 销毁旧实例
    if (charts.value.segment) {
      charts.value.segment.dispose();
      charts.value.segment = undefined;
    }
    const chart = echarts.init(segmentChartRef.value);
    charts.value.segment = chart;

    const response = await useCachedRequest(CACHE_KEYS.customerSegments, () => analyticsService.getCustomerSegments(), DEFAULT_CACHE_TTL.STATIC);
    const data = response.data || response;

    if (!Array.isArray(data)) {
      return;
    }

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data.map((segment: CustomerSegment) => ({
          value: segment.count || 0,
          name: segment.segment || '未知',
          itemStyle: {
            color: getSegmentColor(segment.segment || '')
          }
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    chart.setOption(option);
  } catch (err) {
    logger.error('加载客户细分数据失败:', err);
  }
};

const initRetentionChart = async () => {
  if (!retentionChartRef.value) return;

  // 检查 DOM 尺寸是否有效
  const rect = retentionChartRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    if (chartInitRetries.value.retention < MAX_RETRY) {
      chartInitRetries.value.retention++;
      setTimeout(() => initRetentionChart(), 200);
    }
    return;
  }

  try {
    // 销毁旧实例
    if (charts.value.retention) {
      charts.value.retention.dispose();
      charts.value.retention = undefined;
    }
    const chart = echarts.init(retentionChartRef.value);
    charts.value.retention = chart;

    const cacheKey = CACHE_KEYS.customerRetention(retentionCohort.value)
    const response = await useCachedRequest(cacheKey, () => analyticsService.getCustomerRetention({ cohort: retentionCohort.value }), DEFAULT_CACHE_TTL.DYNAMIC);

    // 处理响应数据
    let data;
    if (response?.data) {
      data = response.data;
    } else if ((response as any)?.periods && (response as any)?.cohorts) {
      // 如果 response 本身就有 periods 和 cohorts 属性（某些情况下的响应格式）
      data = response as any;
    } else {
      data = response;
    }

    // 验证数据结构
    if (!data || !Array.isArray(data.periods) || !Array.isArray(data.cohorts)) {
      const mockData = generateMockRetentionData();
      setRetentionChartOption(chart, mockData);
      return;
    }

    setRetentionChartOption(chart, data);
  } catch (err) {
    logger.error('加载留存率数据失败:', err);
    // 使用模拟数据
    const mockData = generateMockRetentionData();
    if (charts.value.retention) {
      setRetentionChartOption(charts.value.retention, mockData);
    }
  }
};

const generateMockRetentionData = () => {
  const cohorts = [];
  const periods = ['第1月', '第2月', '第3月', '第4月', '第5月', '第6月'];
  const now = TimeUtil.now();

  for (let i = 5; i >= 0; i--) {
    const cohortName = `${now.subtract(i, 'month').month() + 1}月`;
    const cohortData = [100];
    for (let j = 1; j < 6; j++) {
      cohortData.push(Math.max(10, 100 - j * 15 - Math.random() * 10));
    }
    cohorts.push({
      cohort: cohortName,
      data: cohortData
    });
  }

  return { cohorts, periods };
};

const setRetentionChartOption = (chart: any, data: any) => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`;
        params.forEach((param: any) => {
          result += `${param.seriesName}: ${param.value}%<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: data.periods
    },
    xAxis: {
      type: 'category',
      data: data.cohorts?.map((c: any) => c.cohort) || []
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: data.periods.map((period: string, index: number) => ({
      name: period,
      type: 'bar',
      stack: 'retention',
      data: (data.cohorts || []).map((cohort: any) => cohort.data?.[index] ?? 0),
      itemStyle: {
        color: getRetentionColor(index)
      }
    }))
  };

  chart.setOption(option);
};

const initActivityChart = async () => {
  if (!activityChartRef.value) return;

  // 检查 DOM 尺寸是否有效
  const rect = activityChartRef.value.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    if (chartInitRetries.value.activity < MAX_RETRY) {
      chartInitRetries.value.activity++;
      setTimeout(() => initActivityChart(), 200);
    }
    return;
  }

  try {
    // 销毁旧实例
    if (charts.value.activity) {
      charts.value.activity.dispose();
      charts.value.activity = undefined;
    }
    const chart = echarts.init(activityChartRef.value);
    charts.value.activity = chart;

    const response = await useCachedRequest(CACHE_KEYS.customerActivity, () => analyticsService.getCustomerActivity(), DEFAULT_CACHE_TTL.STATIC);
    const data = response?.data || { activeRate: 0.5 };

    const option = {
      tooltip: {
        trigger: 'item'
      },
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 1,
        splitNumber: 8,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.25, '#FF6E76'],
              [0.5, '#FFBD7D'],
              [0.75, '#9FE6B8'],
              [1, '#32D3AC']
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 20,
          offsetCenter: [0, '-60%'],
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          length: 12,
          lineStyle: {
            color: 'auto',
            width: 2
          }
        },
        splitLine: {
          length: 20,
          lineStyle: {
            color: 'auto',
            width: 5
          }
        },
        axisLabel: {
          color: '#464646',
          fontSize: 20,
          distance: -60,
          formatter: function(value: number) {
            return ((value || 0) * 100).toFixed(0) + '%';
          }
        },
        title: {
          offsetCenter: [0, '-20%'],
          fontSize: 30
        },
        detail: {
          fontSize: 40,
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          formatter: function(value: number) {
            return Math.round(value * 100) + '%';
          },
          color: 'auto'
        },
        data: [{
          value: data.activeRate,
          name: '活跃率'
        }]
      }]
    };

    chart.setOption(option);
  } catch (err) {
    logger.error('加载活跃度数据失败:', err);
  }
};

const getSegmentColor = (segment: string): string => {
  const colors: Record<string, string> = {
    'high-value': '#F56C6C',
    'potential': '#E6A23C',
    'at-risk': '#909399',
    'lost': '#C0C4CC'
  };
  return colors[segment] || '#409EFF';
};

const getRetentionColor = (index: number): string => {
  const colors = ['#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE'];
  return colors[index % colors.length];
};

const viewCustomerDetail = async (customer: CustomerDetail) => {
  try {
    selectedCustomer.value = customer;
    customerDetailVisible.value = true;

    // 等待对话框打开后初始化图表，需要多次 nextTick 确保 DOM 完全渲染
    await nextTick();
    setTimeout(async () => {
      await nextTick();
      if (customerTrendChartRef.value && customerPreferenceChartRef.value) {
        initCustomerDetailCharts();
      }
    }, 100);
  } catch (err) {
    logger.error('加载客户详情失败:', err);
    showError('加载客户详情失败');
  }
};

const initCustomerDetailCharts = async () => {
  if (!selectedCustomer.value || !customerTrendChartRef.value || !customerPreferenceChartRef.value) {
    return;
  }

  // 检查 DOM 元素是否已正确渲染
  const trendRect = customerTrendChartRef.value.getBoundingClientRect();
  const preferenceRect = customerPreferenceChartRef.value.getBoundingClientRect();

  if (trendRect.width === 0 || trendRect.height === 0) {
    setTimeout(() => initCustomerDetailCharts(), 200);
    return;
  }

  // 销毁旧实例
  if (charts.value.customerTrend) {
    charts.value.customerTrend.dispose();
    charts.value.customerTrend = undefined;
  }
  if (charts.value.customerPreference) {
    charts.value.customerPreference.dispose();
    charts.value.customerPreference = undefined;
  }

  // 初始化消费趋势图
  const trendChart = echarts.init(customerTrendChartRef.value);
  charts.value.customerTrend = trendChart;

  // 模拟客户消费趋势数据
  const trendOption = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: [2000, 3500, 2800, 4200, 3800, 4500],
      type: 'line',
      smooth: true,
      itemStyle: {
        color: '#409EFF'
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0, color: 'rgba(64, 158, 255, 0.3)'
          }, {
            offset: 1, color: 'rgba(64, 158, 255, 0.05)'
          }]
        }
      }
    }]
  };
  trendChart.setOption(trendOption);

  // 初始化商品偏好图
  const preferenceChart = echarts.init(customerPreferenceChartRef.value);
  charts.value.customerPreference = preferenceChart;

  const preferenceOption = {
    tooltip: {
      trigger: 'item'
    },
    series: [{
      type: 'pie',
      radius: '60%',
      data: [
        { value: 35, name: 'iPhone' },
        { value: 25, name: 'iPad' },
        { value: 20, name: 'Mac' },
        { value: 15, name: '配件' },
        { value: 5, name: '其他' }
      ]
    }]
  };
  preferenceChart.setOption(preferenceOption);
};

const refreshInsights = async () => {
  info('正在刷新客户洞察...');
  await loadOverview();
};

const exportCustomers = () => {
  try {
    if (!filteredCustomers.value.length) {
      warning('当前没有可导出的客户数据')
      return
    }

    const csvContent = buildCsvContent(
      ['客户姓名', '手机号', '客户细分', '订单数', '消费金额', '平均客单价', '最后消费'],
      filteredCustomers.value.map((customer) => ([
        customer.name,
        customer.phone,
        getSegmentText(customer.segment),
        customer.orders_count,
        formatMoney(customer.total_amount),
        formatMoney(customer.avg_order_value),
        formatDate(customer.last_order_date)
      ]))
    )

    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('高价值客户', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '客户数据导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    logger.error('导出失败:', err)
    showError('导出失败')
  }
}

// 监听 isActive 变化
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    // 先加载数据
    loadOverview()
    loadCustomers()

    // 等待 DOM 完全渲染后再初始化图表
    nextTick(() => {
      // 延迟初始化图表，确保 DOM 元素有正确的尺寸
      setTimeout(() => {
        requestAnimationFrame(() => {
          initGrowthChart()
          initSegmentChart()
          initRetentionChart()
          initActivityChart()
          chartsInitialized = true
        })
      }, 100)
    })

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    loadOverview()
    loadCustomers()
  }
})

onUnmounted(() => {
  // 销毁图表实例
  Object.values(charts.value).forEach(chart => {
    chart?.dispose();
  });
  // 移除 resize 事件监听器
  window.removeEventListener('resize', handleResize);
});

// 监听周期变化
const handlePeriodChange = () => {
  loadOverview();
  initGrowthChart();
};

const handleCohortChange = () => {
  initRetentionChart();
};

// 监听周期和队列变化
watch(growthPeriod, () => {
  handlePeriodChange();
});

watch(retentionCohort, () => {
  handleCohortChange();
});

// 公开方法供父组件调用
defineExpose({
  loadOverview,
  loadCustomers,
  refresh: () => {
    loadOverview();
    loadCustomers();
    initGrowthChart();
    initSegmentChart();
    initRetentionChart();
    initActivityChart();
  }
});
</script>

<style lang="scss" scoped>
.customer-analytics {
  padding: 20px;

  .overview-cards {
    margin-bottom: 24px;

    .overview-card {
      .card-content {
        display: flex;
        align-items: center;
        gap: 16px;

        .card-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
        }

        .card-info {
          flex: 1;

          .card-title {
            font-size: 14px;
            color: #909399;
            margin-bottom: 4px;
          }

          .card-value {
            font-size: 24px;
            font-weight: bold;
            color: #303133;
            margin-bottom: 4px;
          }

          .card-trend {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 2px;

            &.up {
              color: #67C23A;
            }

            &.down {
              color: #F56C6C;
            }
          }
        }
      }

      &.primary .card-icon {
        background: linear-gradient(135deg, #409EFF, #66b1ff);
      }

      &.success .card-icon {
        background: linear-gradient(135deg, #67C23A, #85ce61);
      }

      &.warning .card-icon {
        background: linear-gradient(135deg, #E6A23C, #ebb563);
      }

      &.danger .card-icon {
        background: linear-gradient(135deg, #F56C6C, #f78989);
      }
    }
  }

  .chart-section {
    margin-bottom: 24px;
  }

  .chart-card {
    height: 400px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-actions {
        display: flex;
        gap: 8px;
      }
    }

    .chart-container {
      height: 320px;
    }
  }

  .table-section {
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .table-footer {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
  }

  .insights-list {
    max-height: 500px;
    overflow-y: auto;

    .insight-item {
      padding: 16px;
      border-bottom: 1px solid #EBEEF5;

      &:last-child {
        border-bottom: none;
      }

      .insight-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .insight-icon {
          font-size: 18px;

          &.success {
            color: #67C23A;
          }

          &.warning {
            color: #E6A23C;
          }

          &.danger {
            color: #F56C6C;
          }

          &.info {
            color: #409EFF;
          }
        }

        .insight-title {
          font-weight: 500;
          color: #303133;
        }
      }

      .insight-content {
        color: #606266;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 8px;
      }

      .insight-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;

        .insight-impact {
          padding: 2px 8px;
          border-radius: 12px;

          &.high {
            background: #FEF0F0;
            color: #F56C6C;
          }

          &.medium {
            background: #FDF6EC;
            color: #E6A23C;
          }

          &.low {
            background: #F0F9FF;
            color: #409EFF;
          }
        }

        .insight-date {
          color: #909399;
        }
      }
    }
  }

  .customer-detail {
    .customer-info {
      margin-bottom: 24px;
    }

    .detail-card {
      margin-bottom: 24px;

      .chart-container {
        height: 300px;
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .customer-analytics {
    padding: 12px;

    .overview-cards {
      .overview-card {
        .card-content {
          gap: 12px;

          .card-icon {
            width: 40px;
            height: 40px;
            font-size: 20px;
          }

          .card-info {
            .card-value {
              font-size: 20px;
            }
          }
        }
      }
    }

    .chart-card {
      height: 350px;

      .chart-container {
        height: 270px;
      }
    }

    .table-section {
      .header-actions {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;

        .el-input {
          width: 100% !important;
        }
      }
    }
  }
}
</style>
