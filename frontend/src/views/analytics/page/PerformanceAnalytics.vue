<template>
  <div class="performance-analytics">
    <!-- 性能概览卡片 -->
    <el-row :gutter="24" class="overview-cards">
      <el-col :xs="12" :sm="6" v-for="card in overviewCards" :key="card.title">
        <el-card class="overview-card" :class="getStatusClass(card.status)">
          <div class="card-content">
            <div class="card-icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
            <div class="card-info">
              <div class="card-title">{{ card.title }}</div>
              <div class="card-value">{{ card.value }}</div>
              <div class="card-status">{{ card.statusText }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时性能监控 -->
    <el-row :gutter="24" class="chart-section">
      <el-col :xs="24" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>API 响应时间趋势</span>
              <div class="header-actions">
                <el-tag :type="getLatencyStatus(avgLatency).type" size="small">
                  当前: {{ avgLatency }}ms
                </el-tag>
                <el-button
                  size="small"
                  :icon="isRealTimeActive ? VideoPause : VideoPlay"
                  @click="toggleRealTime"
                  :type="isRealTimeActive ? 'warning' : 'primary'"
                >
                  {{ isRealTimeActive ? '暂停' : '开始' }}
                </el-button>
              </div>
            </div>
          </template>
          <div ref="latencyChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>系统吞吐量监控</span>
              <el-select v-model="throughputUnit" size="small" style="width: 100px">
                <el-option label="每分钟" value="minute" />
                <el-option label="每小时" value="hour" />
                <el-option label="每天" value="day" />
              </el-select>
            </div>
          </template>
          <div ref="throughputChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="chart-section">
      <!-- 错误率监控 -->
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>错误率监控</span>
              <el-tooltip content="系统请求错误率趋势">
                <el-icon><InfoFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <div ref="errorRateChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 数据库性能 -->
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>数据库性能</span>
              <el-tag :type="getDbStatus().type" size="small">
                {{ getDbStatus().text }}
              </el-tag>
            </div>
          </template>
          <div ref="dbPerformanceChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 内存使用率 -->
      <el-col :xs="24" :lg="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>内存使用率</span>
              <el-progress
                :percentage="memoryUsage"
                :status="getMemoryStatus()"
                :stroke-width="6"
                style="width: 100px"
              />
            </div>
          </template>
          <div ref="memoryChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 性能告警和优化建议 -->
    <el-row :gutter="24" class="alert-section">
      <el-col :xs="24" :lg="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>性能告警</span>
              <div class="header-actions">
                <el-select v-model="alertLevel" size="small" style="width: 120px">
                  <el-option label="全部" value="all" />
                  <el-option label="严重" value="critical" />
                  <el-option label="警告" value="warning" />
                  <el-option label="提示" value="info" />
                </el-select>
                <el-button size="small" @click="clearAlerts">
                  <el-icon><Delete /></el-icon>
                  清除
                </el-button>
              </div>
            </div>
          </template>

          <div class="alert-list">
            <div v-for="alert in filteredAlerts" :key="alert.id" class="alert-item" :class="alert.level">
              <div class="alert-header">
                <el-icon class="alert-icon">
                  <Warning v-if="alert.level === 'critical'" />
                  <InfoFilled v-else />
                </el-icon>
                <span class="alert-title">{{ alert.title }}</span>
                <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
              </div>
              <div class="alert-content">{{ alert.message }}</div>
              <div class="alert-actions">
                <el-button type="primary" size="small" link @click="handleAlert(alert)">
                  查看详情
                </el-button>
                <el-button type="danger" size="small" link @click="dismissAlert(alert.id)">
                  忽略
                </el-button>
              </div>
            </div>

            <el-empty v-if="filteredAlerts.length === 0" description="暂无性能告警" />
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>优化建议</span>
              <el-button type="info" size="small" @click="refreshOptimizations">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>

          <div class="optimization-list">
            <div v-for="opt in optimizationSuggestions" :key="opt.id" class="optimization-item">
              <div class="opt-header">
                <el-tag :type="getOptimizationTagType(opt.priority)" size="small">
                  {{ opt.priority }}
                </el-tag>
                <span class="opt-title">{{ opt.title }}</span>
              </div>
              <div class="opt-content">{{ opt.description }}</div>
              <div class="opt-footer">
                <span class="opt-impact">
                  预期提升: {{ opt.expectedImprovement }}
                </span>
                <el-button type="primary" size="small" @click="applyOptimization(opt)">
                  应用
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 详细性能指标 -->
    <el-row :gutter="24" class="metrics-section">
      <el-col :xs="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>详细性能指标</span>
              <div class="header-actions">
                <el-date-picker
                  v-model="metricsDateRange"
                  type="datetimerange"
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                  size="small"
                  @change="loadDetailedMetrics"
                />
                <el-button type="success" size="small" @click="exportMetrics">
                  <el-icon><Download /></el-icon>
                  导出报表
                </el-button>
              </div>
            </div>
          </template>

          <el-tabs v-model="activeMetricsTab">
            <el-tab-pane label="API 性能" name="api">
              <el-table :data="apiMetrics" v-loading="metricsLoading" stripe>
                <el-table-column prop="endpoint" label="API 端点" min-width="200" />
                <el-table-column prop="method" label="方法" width="80" />
                <el-table-column prop="avgResponseTime" label="平均响应时间" width="120">
                  <template #default="{ row }">
                    <span :class="getLatencyClass(row.avgResponseTime)">
                      {{ row.avgResponseTime }}ms
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="requestCount" label="请求次数" width="100" align="right" />
                <el-table-column prop="errorRate" label="错误率" width="100">
                  <template #default="{ row }">
                    <el-tag :type="getErrorRateType(row.errorRate || 0)" size="small">
                      {{ ((row.errorRate || 0) * 100).toFixed(2) }}%
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="throughput" label="吞吐量" width="100">
                  <template #default="{ row }">
                    {{ row.throughput }}/min
                  </template>
                </el-table-column>
                <el-table-column label="趋势" width="150">
                  <template #default="{ row }">
                    <div class="trend-mini-chart" :ref="el => setTrendChart(el, row.trend)"></div>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="数据库性能" name="database">
              <el-table :data="dbMetrics" v-loading="metricsLoading" stripe>
                <el-table-column prop="query" label="查询类型" min-width="200" />
                <el-table-column prop="avgExecutionTime" label="平均执行时间" width="140">
                  <template #default="{ row }">
                    <span :class="getLatencyClass(row.avgExecutionTime)">
                      {{ row.avgExecutionTime }}ms
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="executionCount" label="执行次数" width="100" align="right" />
                <el-table-column prop="slowQueries" label="慢查询" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.slowQueries > 0 ? 'warning' : 'success'" size="small">
                      {{ row.slowQueries }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="cpuUsage" label="CPU 使用率" width="120">
                  <template #default="{ row }">
                    <el-progress :percentage="row.cpuUsage" :stroke-width="4" />
                  </template>
                </el-table-column>
                <el-table-column prop="indexUsage" label="索引使用率" width="120">
                  <template #default="{ row }">
                    {{ ((row.indexUsage || 0) * 100).toFixed(1) }}%
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="系统资源" name="system">
              <el-row :gutter="24">
                <el-col :xs="24" :md="8">
                  <div class="system-metric-card">
                    <h4>CPU 使用率</h4>
                    <div ref="cpuGaugeRef" class="gauge-chart"></div>
                    <div class="metric-details">
                      <div class="detail-item">
                        <span>用户态: {{ cpuUsage.user }}%</span>
                      </div>
                      <div class="detail-item">
                        <span>系统态: {{ cpuUsage.system }}%</span>
                      </div>
                      <div class="detail-item">
                        <span>空闲: {{ cpuUsage.idle }}%</span>
                      </div>
                    </div>
                  </div>
                </el-col>
                <el-col :xs="24" :md="8">
                  <div class="system-metric-card">
                    <h4>磁盘使用率</h4>
                    <div ref="diskGaugeRef" class="gauge-chart"></div>
                    <div class="metric-details">
                      <div class="detail-item">
                        <span>已用: {{ formatBytes(diskUsage.used) }}</span>
                      </div>
                      <div class="detail-item">
                        <span>总计: {{ formatBytes(diskUsage.total) }}</span>
                      </div>
                      <div class="detail-item">
                        <span>可用: {{ formatBytes(diskUsage.available) }}</span>
                      </div>
                    </div>
                  </div>
                </el-col>
                <el-col :xs="24" :md="8">
                  <div class="system-metric-card">
                    <h4>网络流量</h4>
                    <div ref="networkGaugeRef" class="gauge-chart"></div>
                    <div class="metric-details">
                      <div class="detail-item">
                        <span>入站: {{ formatBytes(networkUsage.inbound) }}/s</span>
                      </div>
                      <div class="detail-item">
                        <span>出站: {{ formatBytes(networkUsage.outbound) }}/s</span>
                      </div>
                      <div class="detail-item">
                        <span>总计: {{ formatBytes(networkUsage.total) }}/s</span>
                      </div>
                    </div>
                  </div>
                </el-col>
              </el-row>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, markRaw, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { globalApiCache, globalDeduplicator } from '@/composables/api-cache'
const { success, error: showError, warning, info } = useNotification()
import {
  Monitor,
  Timer,
  Warning,
  TrendCharts,
  InfoFilled,
  VideoPause,
  VideoPlay,
  Delete,
  Refresh,
  Download,
  Cpu,
  Document,
  Connection
} from '@element-plus/icons-vue';
import echarts, { ECharts } from '@/utils/echarts'
import { analyticsService } from '@/api/analytics'
import { buildCsvContent } from '@/utils/csv-export'
import type { PerformanceAlert, OptimizationSuggestion, PerformanceMetric } from '@/types/analytics';
import type { PerformanceAnalyticsProps } from '@/types/component'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<PerformanceAnalyticsProps>(), {
  loading: false,
  isActive: false
})
const { exportTextFile, buildDateFilename } = useImportExport()

// 缓存配置
const CACHE_TTL = {
  performance: 30000,      // 性能概览: 30秒
  realtime: 5000,          // 实时数据: 5秒
  detailed: 60000          // 详细指标: 60秒
}

// 缓存键
const CACHE_KEYS = {
  performance: '/analytics/performance',
  realtime: '/analytics/performance/realtime',
  apiMetrics: (startDate: string, endDate: string) => `/analytics/performance/api-metrics:${startDate}:${endDate}`,
  dbMetrics: (startDate: string, endDate: string) => `/analytics/performance/database-metrics:${startDate}:${endDate}`
}

// 请求标记，防止重复请求
const pendingRequests = new Set<string>()
const isRealTimeActive = ref(true);
const throughputUnit = ref('minute');
const alertLevel = ref('all');
const activeMetricsTab = ref('api');
const metricsDateRange = ref<[Date, Date]>([TimeUtil.subtract(TimeUtil.now(), 7, 'day').toDate(), TimeUtil.now().toDate()]);

// 性能指标
const avgLatency = ref(0);
const memoryUsage = ref(0);
const cpuUsage = ref({ user: 0, system: 0, idle: 100 });
const diskUsage = ref({ used: 0, total: 0, available: 0 });
const networkUsage = ref({ inbound: 0, outbound: 0, total: 0 });

// 概览卡片
const overviewCards = ref([
  {
    title: '系统状态',
    value: '正常',
    statusText: '所有服务运行正常',
    status: 'healthy',
    icon: markRaw(Monitor)
  },
  {
    title: '平均响应时间',
    value: '0ms',
    statusText: '响应良好',
    status: 'good',
    icon: markRaw(Timer)
  },
  {
    title: '错误率',
    value: '0%',
    statusText: '无错误',
    status: 'good',
    icon: markRaw(Warning)
  },
  {
    title: '系统吞吐量',
    value: '0/min',
    statusText: '吞吐正常',
    status: 'good',
    icon: markRaw(TrendCharts)
  }
]);

// 告警和优化建议
const performanceAlerts = ref<PerformanceAlert[]>([]);
const optimizationSuggestions = ref<OptimizationSuggestion[]>([]);

// 详细指标数据
const apiMetrics = ref([]);
const dbMetrics = ref([]);

// 图表实例
const charts = ref<{
  latency?: ECharts;
  throughput?: ECharts;
  errorRate?: ECharts;
  dbPerformance?: ECharts;
  memory?: ECharts;
  cpuGauge?: ECharts;
  diskGauge?: ECharts;
  networkGauge?: ECharts;
  trendCharts: Map<any, ECharts>;
}>({ trendCharts: new Map() });

// 图表初始化标记
let chartsInitialized = false

// 保存 resize 处理函数引用，用于后续移除
const handleResize = () => {
  // 遍历图表实例（排除 trendCharts Map）
  const chartInstances = [
    charts.value.latency,
    charts.value.throughput,
    charts.value.errorRate,
    charts.value.dbPerformance,
    charts.value.memory,
    charts.value.cpuGauge,
    charts.value.diskGauge,
    charts.value.networkGauge
  ]
  chartInstances.forEach(chart => {
    if (chart && typeof chart.resize === 'function') {
      chart.resize();
    }
  });
  // 单独处理 trendCharts
  charts.value.trendCharts.forEach(chart => {
    if (chart && typeof chart.resize === 'function') {
      chart.resize();
    }
  });
};

// 图表引用
const latencyChartRef = ref<HTMLElement>();
const throughputChartRef = ref<HTMLElement>();
const errorRateChartRef = ref<HTMLElement>();
const dbPerformanceChartRef = ref<HTMLElement>();
const memoryChartRef = ref<HTMLElement>();
const cpuGaugeRef = ref<HTMLElement>();
const diskGaugeRef = ref<HTMLElement>();
const networkGaugeRef = ref<HTMLElement>();

// 实时更新定时器
let realTimeTimer: number | null = null;

// 计算属性
const filteredAlerts = computed(() => {
  if (alertLevel.value === 'all') return performanceAlerts.value;
  return performanceAlerts.value.filter(alert => alert.level === alertLevel.value);
});

// 方法
const getStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    healthy: 'success',
    warning: 'warning',
    critical: 'danger'
  };
  return classes[status] || '';
};

const getLatencyStatus = (latency: number): { type: 'success' | 'warning' | 'danger'; text: string } => {
  if (latency < 100) return { type: 'success', text: '优秀' };
  if (latency < 300) return { type: 'warning', text: '一般' };
  return { type: 'danger', text: '较差' };
};


const getLatencyClass = (latency: number): string => {
  if (latency < 100) return 'text-success';
  if (latency < 300) return 'text-warning';
  return 'text-danger';
};

const getDbStatus = (): { type: 'success'; text: string } => {
  // 这里可以根据实际数据库性能状态返回
  return { type: 'success', text: '正常' };
};


const getMemoryStatus = (): 'success' | 'warning' | 'exception' => {
  if (memoryUsage.value < 70) return 'success';
  if (memoryUsage.value < 90) return 'warning';
  return 'exception';
};

const getErrorRateType = (rate: number): 'success' | 'warning' | 'danger' => {
  if (rate === 0) return 'success';
  if (rate < 0.01) return 'warning';
  return 'danger';
};


const getOptimizationTagType = (priority: string): 'primary' | 'warning' | 'danger' | 'info' => {
  const types: Record<string, 'primary' | 'warning' | 'danger' | 'info'> = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  };
  return types[priority] || 'primary';
};


const formatTime = (timestamp: string): string => {
  return TimeUtil.format(timestamp, TIME_FORMATS.DATETIME);
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const loadPerformanceData = async () => {
  // 检查是否有重复请求
  if (pendingRequests.has('performance')) {
    return
  }

  // 尝试从缓存获取
  const cached = globalApiCache.get(CACHE_KEYS.performance)
  if (cached) {
    applyPerformanceData(cached)
    return
  }

  try {
    loading.value = true
    pendingRequests.add('performance')

    const response = await analyticsService.getPerformanceMetrics();
    const data: any = response?.data || response;

    // 存入缓存
    globalApiCache.set(CACHE_KEYS.performance, data, CACHE_TTL.performance)

    applyPerformanceData(data)
  } catch (err) {
    logger.error('加载性能数据失败:', err);
    showError('加载性能数据失败');
  } finally {
    loading.value = false
    pendingRequests.delete('performance')
  }
};

// 应用性能数据（提取公共逻辑）
const applyPerformanceData = (data: any) => {
  // 更新性能指标
  avgLatency.value = data.latency?.avg ?? 0;
  memoryUsage.value = data.memory?.usagePercent ?? 0;
  cpuUsage.value = data.cpu ?? { user: 0, system: 0, idle: 100 };
  diskUsage.value = data.disk ?? { used: 0, total: 0, available: 0 };
  networkUsage.value = data.network ?? { inbound: 0, outbound: 0, total: 0 };

  // 更新概览卡片
  overviewCards.value = [
    {
      title: '系统状态',
      value: data.overallStatus ?? 'unknown',
      statusText: data.systemHealth ?? '未知状态',
      status: data.systemHealth === 'healthy' ? 'healthy' : 'warning',
      icon: markRaw(Monitor)
    },
    {
      title: '平均响应时间',
      value: `${data.latency?.avg ?? 0}ms`,
      statusText: getLatencyStatus(data.latency?.avg ?? 0).text,
      status: (data.latency?.avg ?? 0) < 300 ? 'good' : 'warning',
      icon: markRaw(Timer)
    },
    {
      title: '错误率',
      value: `${((data.errorRate || 0) * 100).toFixed(2)}%`,
      statusText: (data.errorRate || 0) === 0 ? '无错误' : '存在错误',
      status: (data.errorRate || 0) === 0 ? 'good' : 'warning',
      icon: markRaw(Warning)
    },
    {
      title: '系统吞吐量',
      value: `${data.throughput?.current ?? 0}/min`,
      statusText: '吞吐正常',
      status: 'good',
      icon: markRaw(TrendCharts)
    }
  ];

  // 更新告警和优化建议
  performanceAlerts.value = data.alerts ?? [];
  optimizationSuggestions.value = data.optimizations ?? [];
};

const loadDetailedMetrics = async () => {
  try {
    metricsLoading.value = true;
    const [startDate, endDate] = metricsDateRange.value;
    const startStr = startDate?.toISOString() || ''
    const endStr = endDate?.toISOString() || ''

    const cacheKeyApi = CACHE_KEYS.apiMetrics(startStr, endStr)
    const cacheKeyDb = CACHE_KEYS.dbMetrics(startStr, endStr)

    // 并行获取，使用缓存或请求
    const [apiData, dbData] = await Promise.all([
      (async () => {
        const cached = globalApiCache.get(cacheKeyApi)
        if (cached) return cached

        const res = await analyticsService.getApiMetrics({
          startDate: startStr,
          endDate: endStr
        });
        globalApiCache.set(cacheKeyApi, res.data, CACHE_TTL.detailed)
        return res.data
      })(),
      (async () => {
        const cached = globalApiCache.get(cacheKeyDb)
        if (cached) return cached

        const res = await analyticsService.getDatabaseMetrics({
          startDate: startStr,
          endDate: endStr
        });
        globalApiCache.set(cacheKeyDb, res.data, CACHE_TTL.detailed)
        return res.data
      })()
    ]);

    apiMetrics.value = apiData;
    dbMetrics.value = dbData;
  } catch (err) {
    logger.error('加载详细指标失败:', err);
    showError('加载详细指标失败');
  } finally {
    metricsLoading.value = false;
  }
};

const initLatencyChart = () => {
  if (!latencyChartRef.value) return;

  // 销毁旧实例
  if (charts.value.latency) {
    charts.value.latency.dispose();
    charts.value.latency = undefined;
  }

  const chart = echarts.init(latencyChartRef.value);
  charts.value.latency = chart;

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: []
    },
    yAxis: {
      type: 'value',
      name: '响应时间(ms)'
    },
    series: [{
      data: [],
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
  setTimeout(() => chart.resize(), 100);
};

const initThroughputChart = () => {
  if (!throughputChartRef.value) return;

  // 销毁旧实例
  if (charts.value.throughput) {
    charts.value.throughput.dispose();
    charts.value.throughput = undefined;
  }

  const chart = echarts.init(throughputChartRef.value);
  charts.value.throughput = chart;

  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: []
    },
    yAxis: {
      type: 'value',
      name: '请求量'
    },
    series: [{
      data: [],
      type: 'bar',
      itemStyle: {
        color: '#67C23A'
      }
    }]
  };

  chart.setOption(option);
  setTimeout(() => chart.resize(), 100);
};

const initErrorRateChart = () => {
  if (!errorRateChartRef.value) return;

  // 销毁旧实例
  if (charts.value.errorRate) {
    charts.value.errorRate.dispose();
    charts.value.errorRate = undefined;
  }

  const chart = echarts.init(errorRateChartRef.value);
  charts.value.errorRate = chart;

  const option = {
    tooltip: {
      trigger: 'item'
    },
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 5,
      splitNumber: 5,
      axisLine: {
        lineStyle: {
          width: 6,
          color: [
            [0.2, '#67C23A'],
            [0.8, '#E6A23C'],
            [1, '#F56C6C']
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
      axisLabel: {
        color: '#464646',
        fontSize: 20,
        distance: -60,
        formatter: '{value}%'
      },
      detail: {
        fontSize: 40,
        offsetCenter: [0, '0%'],
        valueAnimation: true,
        formatter: '{value}%',
        color: 'auto'
      },
      data: [{
        value: 0,
        name: '错误率'
      }]
    }]
  };

  chart.setOption(option);
  setTimeout(() => chart.resize(), 100);
};

const initMemoryChart = () => {
  if (!memoryChartRef.value) return;

  // 销毁旧实例
  if (charts.value.memory) {
    charts.value.memory.dispose();
    charts.value.memory = undefined;
  }

  const chart = echarts.init(memoryChartRef.value);
  charts.value.memory = chart;

  const option = {
    tooltip: {
      trigger: 'item'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 0, name: '已使用', itemStyle: { color: '#F56C6C' } },
        { value: 100, name: '可用', itemStyle: { color: '#E4E7ED' } }
      ],
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
  setTimeout(() => chart.resize(), 100);
};

const toggleRealTime = () => {
  isRealTimeActive.value = !isRealTimeActive.value;
  if (isRealTimeActive.value) {
    startRealTimeUpdate();
  } else {
    stopRealTimeUpdate();
  }
};

const startRealTimeUpdate = () => {
  realTimeTimer = window.setInterval(() => {
    updateRealTimeData();
  }, 5000); // 每5秒更新一次
};

const stopRealTimeUpdate = () => {
  if (realTimeTimer) {
    clearInterval(realTimeTimer);
    realTimeTimer = null;
  }
};

const updateRealTimeData = async () => {
  // 使用去重器防止并发请求
  const cacheKey = CACHE_KEYS.realtime
  const pendingKey = globalDeduplicator.generateKey({ method: 'GET', url: cacheKey })

  if (globalDeduplicator.hasPendingRequest(pendingKey)) {
    return
  }

  // 尝试从缓存获取（5秒TTL）
  const cached = globalApiCache.get(cacheKey)
  if (cached) {
    applyRealTimeData(cached)
    return
  }

  try {
    const requestPromise = analyticsService.getRealTimePerformance()
    globalDeduplicator.addRequest(pendingKey, requestPromise as any)

    const response = await requestPromise
    const data: any = response?.data || response

    // 存入缓存
    globalApiCache.set(cacheKey, data, CACHE_TTL.realtime)
    applyRealTimeData(data)
  } catch (error) {
    logger.error('更新实时数据失败:', error);
  }
};

// 应用实时数据
const applyRealTimeData = (data: any) => {
  if (data.latency) {
    updateLatencyChart(data.latency);
  }
  if (data.throughput) {
    updateThroughputChart(data.throughput);
  }
  updateErrorRateChart(data.errorRate);
  if (data.memory !== undefined) {
    updateMemoryChart(data.memory);
  }
};

const updateLatencyChart = (data: any) => {
  const chart = charts.value.latency;
  if (!chart || !data) return;

  const currentOption = chart.getOption();
  const now = TimeUtil.format(TimeUtil.now(), TIME_FORMATS.TIME);

  const xAxisData = [...(currentOption.xAxis[0].data || []), now];
  const seriesData = [...(currentOption.series[0].data || []), data.avg ?? 0];

  // 保持最近30个数据点
  if (xAxisData.length > 30) {
    xAxisData.shift();
    seriesData.shift();
  }

  // 创建普通对象，避免响应式
  chart.setOption({
    xAxis: [{ data: xAxisData }],
    series: [{ data: seriesData }]
  });
};

const updateThroughputChart = (data: any) => {
  const chart = charts.value.throughput;
  if (!chart || !data) return;

  const currentOption = chart.getOption();
  const now = TimeUtil.format(TimeUtil.now(), TIME_FORMATS.TIME);

  const xAxisData = [...(currentOption.xAxis[0].data || []), now];
  const seriesData = [...(currentOption.series[0].data || []), data.current ?? 0];

  // 保持最近30个数据点
  if (xAxisData.length > 30) {
    xAxisData.shift();
    seriesData.shift();
  }

  // 创建普通对象，避免响应式
  chart.setOption({
    xAxis: [{ data: xAxisData }],
    series: [{ data: seriesData }]
  });
};

const updateErrorRateChart = (rate: number | undefined) => {
  const chart = charts.value.errorRate;
  if (!chart) return;

  chart.setOption({
    series: [{
      data: [{
        value: ((rate || 0) * 100).toFixed(2),
        name: '错误率'
      }]
    }]
  });
};

const updateMemoryChart = (usage: number | undefined) => {
  const chart = charts.value.memory;
  if (!chart || usage === undefined) return;

  chart.setOption({
    series: [{
      data: [
        { value: usage, name: '已使用' },
        { value: 100 - usage, name: '可用' }
      ]
    }]
  });
};

const setTrendChart = (el: any, data: number[]) => {
  if (!el || !data || data.length === 0) return;

  const chart = echarts.init(el);
  charts.value.trendCharts.set(el, chart);

  const option = {
    grid: {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    xAxis: {
      type: 'category',
      show: false,
      data: data.map((_, index) => index)
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: [{
      type: 'line',
      data: data,
      smooth: true,
      showSymbol: false,
      lineStyle: {
        width: 2,
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
};

const handleAlert = (alert: PerformanceAlert) => {
  ElMessageBox.alert(alert.message, `告警详情 - ${alert.title}`, {
    confirmButtonText: '确定',
    type: alert.level === 'critical' ? 'error' : 'warning'
  });
};

const dismissAlert = async (alertId: string) => {
  try {
    const index = performanceAlerts.value.findIndex(alert => alert.id === alertId);
    if (index > -1) {
      performanceAlerts.value.splice(index, 1);
      success('告警已忽略');
    }
  } catch (err) {
    logger.error('忽略告警失败:', err);
    showError('忽略告警失败');
  }
};

const clearAlerts = () => {
  ElMessageBox.confirm('确定要清除所有告警吗？', '确认操作', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    performanceAlerts.value = [];
    success('所有告警已清除');
  }).catch(() => {
    // 用户取消操作
  });
};

const applyOptimization = async (opt: OptimizationSuggestion) => {
  try {
    ElMessageBox.confirm(
      `确定要应用优化建议"${opt.title}"吗？\n\n${opt.description}`,
      '应用优化',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    ).then(() => {
      success(`优化建议"${opt.title}"已应用到系统`);
      // 这里可以调用实际的优化API
    }).catch(() => {
      // 用户取消操作
    });
  } catch (error) {
    // 用户取消操作
  }
};

const refreshOptimizations = async () => {
  try {
    info('正在刷新优化建议...');
    await loadPerformanceData();
    success('优化建议已刷新');
  } catch (err) {
    logger.error('刷新优化建议失败:', err);
    showError('刷新优化建议失败');
  }
};

const exportMetrics = () => {
  try {
    let filenamePrefix = '性能监控报表'
    let csvContent = ''

    if (activeMetricsTab.value === 'api') {
      if (!apiMetrics.value.length) {
        warning('当前没有可导出的 API 性能数据')
        return
      }

      filenamePrefix = 'API性能指标'
      csvContent = buildCsvContent(
        ['API 端点', '方法', '平均响应时间(ms)', '请求次数', '错误率(%)', '吞吐量(/min)'],
        apiMetrics.value.map((row: any) => ([
          row.endpoint || '',
          row.method || '',
          row.avgResponseTime ?? 0,
          row.requestCount ?? 0,
          Number(((row.errorRate || 0) * 100).toFixed(2)),
          row.throughput ?? 0
        ]))
      )
    } else if (activeMetricsTab.value === 'database') {
      if (!dbMetrics.value.length) {
        warning('当前没有可导出的数据库性能数据')
        return
      }

      filenamePrefix = '数据库性能指标'
      csvContent = buildCsvContent(
        ['查询类型', '平均执行时间(ms)', '执行次数', '慢查询数', 'CPU 使用率(%)', '索引使用率(%)'],
        dbMetrics.value.map((row: any) => ([
          row.query || '',
          row.avgExecutionTime ?? 0,
          row.executionCount ?? 0,
          row.slowQueries ?? 0,
          row.cpuUsage ?? 0,
          Number(((row.indexUsage || 0) * 100).toFixed(1))
        ]))
      )
    } else {
      filenamePrefix = '系统资源监控'
      csvContent = buildCsvContent(
        ['指标类型', '名称', '当前值', '状态', '说明'],
        [
          ['系统状态', '整体健康度', overviewCards.value[0].value, overviewCards.value[0].statusText, '-'],
          ['响应时间', '平均响应时间', `${avgLatency.value}ms`, getLatencyStatus(avgLatency.value).text, '建议保持在 300ms 以下'],
          ['错误率', '系统错误率', overviewCards.value[2].value, overviewCards.value[2].statusText, '建议降低到 1% 以下'],
          ['吞吐量', '系统吞吐量', overviewCards.value[3].value, overviewCards.value[3].statusText, `按${throughputUnit.value === 'minute' ? '分钟' : throughputUnit.value === 'hour' ? '小时' : '天'}统计`],
          ['内存', '内存使用率', `${memoryUsage.value}%`, getMemoryStatus() || 'normal', '当前系统内存占用'],
          ['CPU', 'CPU 用户态', `${cpuUsage.value.user}%`, '-', 'CPU 用户态占比'],
          ['CPU', 'CPU 系统态', `${cpuUsage.value.system}%`, '-', 'CPU 系统态占比'],
          ['CPU', 'CPU 空闲', `${cpuUsage.value.idle}%`, '-', 'CPU 空闲占比'],
          ['磁盘', '磁盘已用', formatBytes(diskUsage.value.used), '-', '磁盘已使用容量'],
          ['磁盘', '磁盘总计', formatBytes(diskUsage.value.total), '-', '磁盘总容量'],
          ['磁盘', '磁盘可用', formatBytes(diskUsage.value.available), '-', '磁盘剩余容量']
        ]
      )
    }

    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename(filenamePrefix, 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '性能报表导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    logger.error('导出失败:', err)
    showError('导出失败')
  }
}

// 清除缓存
const clearPerformanceCache = () => {
  globalApiCache.delete(CACHE_KEYS.performance)
  globalApiCache.delete(CACHE_KEYS.realtime)
  globalApiCache.clear()
  pendingRequests.clear()
  success('缓存已清除')
}

// 监听 isActive 变化
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    // 设置默认时间范围为最近24小时
    const end = TimeUtil.now().toDate();
    const start = TimeUtil.subtract(end, 24, 'hour').toDate();
    metricsDateRange.value = [start, end];

    // 使用 nextTick 确保 DOM 已完全渲染
    nextTick(() => {
      // 延迟初始化图表，确保 DOM 元素有正确的尺寸
      setTimeout(() => {
        loadPerformanceData();
        loadDetailedMetrics();
        initLatencyChart();
        initThroughputChart();
        initErrorRateChart();
        initMemoryChart();

        // 启动实时更新
        startRealTimeUpdate();

        // 监听窗口大小变化
        window.addEventListener('resize', handleResize);

        chartsInitialized = true
      }, 100)
    })
  }
}, { immediate: true })

// 生命周期
onMounted(() => {
  // 组件已挂载
});

onUnmounted(() => {
  stopRealTimeUpdate();

  // 销毁图表实例
  Object.values(charts.value).forEach(chart => {
    if (chart && 'dispose' in chart) {
      chart.dispose();
    }
  });

  // 移除 resize 事件监听器
  window.removeEventListener('resize', handleResize);
});
</script>

<style lang="scss" scoped>
.performance-analytics {
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

          .card-status {
            font-size: 12px;
            color: #67C23A;
          }
        }
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
        align-items: center;
      }
    }

    .chart-container {
      height: 320px;
    }
  }

  .alert-section {
    margin-bottom: 24px;

    .alert-list {
      max-height: 500px;
      overflow-y: auto;

      .alert-item {
        padding: 16px;
        border-left: 4px solid #E4E7ED;
        margin-bottom: 12px;
        background: #FAFAFA;
        border-radius: 4px;

        &.critical {
          border-left-color: #F56C6C;
          background: #FEF0F0;
        }

        &.warning {
          border-left-color: #E6A23C;
          background: #FDF6EC;
        }

        &.info {
          border-left-color: #409EFF;
          background: #ECF5FF;
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;

          .alert-icon {
            font-size: 18px;
          }

          .alert-title {
            font-weight: 500;
            color: #303133;
            flex: 1;
          }

          .alert-time {
            font-size: 12px;
            color: #909399;
          }
        }

        .alert-content {
          color: #606266;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .alert-actions {
          display: flex;
          gap: 12px;
        }
      }
    }

    .optimization-list {
      max-height: 500px;
      overflow-y: auto;

      .optimization-item {
        padding: 16px;
        border: 1px solid #EBEEF5;
        border-radius: 4px;
        margin-bottom: 12px;

        .opt-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;

          .opt-title {
            font-weight: 500;
            color: #303133;
          }
        }

        .opt-content {
          color: #606266;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .opt-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .opt-impact {
            font-size: 12px;
            color: #67C23A;
          }
        }
      }
    }
  }

  .metrics-section {
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .system-metric-card {
      text-align: center;
      padding: 20px;
      border: 1px solid #EBEEF5;
      border-radius: 4px;

      h4 {
        margin: 0 0 16px 0;
        color: #303133;
      }

      .gauge-chart {
        height: 200px;
        margin-bottom: 16px;
      }

      .metric-details {
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
          color: #606266;
        }
      }
    }

    .text-success {
      color: #67C23A;
    }

    .text-warning {
      color: #E6A23C;
    }

    .text-danger {
      color: #F56C6C;
    }

    .trend-mini-chart {
      height: 30px;
      width: 80px;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .performance-analytics {
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

    .header-actions {
      flex-direction: column;
      gap: 8px;
      align-items: stretch !important;

      .el-select {
        width: 100% !important;
      }
    }

    .system-metric-card {
      margin-bottom: 16px;
    }
  }
}
</style>
