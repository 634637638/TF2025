<template>
  <div class="error-dashboard">
    <!-- 错误统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-value error-total">{{ statistics.total }}</div>
            <div class="stat-label">总错误数</div>
          </div>
          <el-icon class="stat-icon" :size="32" color="#f56c6c">
            <WarningFilled />
          </el-icon>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-value error-unresolved">{{ statistics.unresolved }}</div>
            <div class="stat-label">未解决</div>
          </div>
          <el-icon class="stat-icon" :size="32" color="#e6a23c">
            <Clock />
          </el-icon>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-value error-rate">{{ statistics.errorRate.toFixed(2) }}%</div>
            <div class="stat-label">错误率</div>
          </div>
          <el-icon class="stat-icon" :size="32" color="#409eff">
            <TrendCharts />
          </el-icon>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-value error-reported">{{ statistics.reported }}</div>
            <div class="stat-label">已上报</div>
          </div>
          <el-icon class="stat-icon" :size="32" color="#67c23a">
            <Upload />
          </el-icon>
        </el-card>
      </el-col>
    </el-row>

    <!-- 错误分布统计 -->
    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>错误级别分布</span>
          </template>
          <div class="error-distribution">
            <div v-for="(count, level) in statistics.byLevel" :key="level" class="dist-item">
              <span class="dist-label">{{ getLevelText(level) }}</span>
              <el-progress
                :percentage="getPercentage(count, statistics.total)"
                :color="getLevelColor(level)"
                :show-text="true"
              >
                {{ count }}
              </el-progress>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>错误类型分布</span>
          </template>
          <div class="error-distribution">
            <div v-for="(count, type) in statistics.byType" :key="type" class="dist-item" v-if="count > 0">
              <span class="dist-label">{{ getTypeText(type) }}</span>
              <el-progress
                :percentage="getPercentage(count, statistics.total)"
                :color="getTypeColor(type)"
                :show-text="true"
              >
                {{ count }}
              </el-progress>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最常见错误 -->
    <el-card class="common-errors-card" v-if="statistics.mostCommonErrors.length > 0">
      <template #header>
        <span>最常见错误</span>
      </template>
      <el-table :data="statistics.mostCommonErrors.slice(0, 5)" stripe>
        <el-table-column prop="message" label="错误信息" min-width="300" />
        <el-table-column prop="count" label="次数" width="100" align="center" />
        <el-table-column label="最后发生" width="180">
          <template #default="{ row }">
            {{ formatTime(row.lastOccurred) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 错误列表 -->
    <el-card class="error-list-card">
      <template #header>
        <div class="list-header">
          <span>错误日志</span>
          <div class="list-actions">
            <el-select
              v-model="filters.level"
              placeholder="错误级别"
              clearable
              @change="applyFilters"
              style="width: 120px; margin-right: 10px"
            >
              <el-option label="全部" value="" />
              <el-option label="严重" value="critical" />
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>

            <el-select
              v-model="filters.type"
              placeholder="错误类型"
              clearable
              @change="applyFilters"
              style="width: 120px; margin-right: 10px"
            >
              <el-option label="全部" value="" />
              <el-option label="Vue" value="vue" />
              <el-option label="JavaScript" value="javascript" />
              <el-option label="网络" value="network" />
              <el-option label="异步" value="async" />
              <el-option label="权限" value="permission" />
              <el-option label="验证" value="validation" />
            </el-select>

            <el-select
              v-model="filters.resolved"
              placeholder="解决状态"
              clearable
              @change="applyFilters"
              style="width: 120px; margin-right: 10px"
            >
              <el-option label="全部" value="" />
              <el-option label="未解决" :value="false" />
              <el-option label="已解决" :value="true" />
            </el-select>

            <el-button type="primary" @click="refreshLogs">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>

            <el-button @click="exportLogs">
              <el-icon><Download /></el-icon>
              导出
            </el-button>

            <el-button type="danger" @click="clearLogs">
              <el-icon><Delete /></el-icon>
              清空
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="paginatedLogs"
        v-loading="loading"
        row-key="id"
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="formattedTime" label="时间" width="180" />

        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getLevelTagType(row.level)"
              size="small"
            >
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">
              {{ getTypeText(row.type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="message" label="错误信息" min-width="300">
          <template #default="{ row }">
            <div class="error-message">
              <span>{{ row.message }}</span>
              <el-tag
                v-if="row.component"
                size="small"
                type="info"
                style="margin-left: 8px"
              >
                {{ row.component }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="次数" width="80" align="center">
          <template #default="{ row }">
            <el-badge :value="row.count" type="danger" v-if="row.count > 1">
              <span>{{ row.count }}</span>
            </el-badge>
            <span v-else>{{ row.count }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.resolved ? 'success' : 'warning'" size="small">
              {{ row.resolved ? '已解决' : '未解决' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="上报" width="80" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.reported" color="#67c23a">
              <Check />
            </el-icon>
            <el-icon v-else color="#909399">
              <Close />
            </el-icon>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              @click="showErrorDetail(row)"
            >
              详情
            </el-button>
            <el-button
              v-if="!row.resolved"
              size="small"
              type="success"
              @click="resolveError(row.id)"
            >
              标记解决
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteError(row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <Pagination
        v-model:current="pagination.page"
        v-model:page-size="pagination.size"
        :total="filteredLogs.length"
        :page-sizes="[10, 20, 50, 100]"
        :show-range="true"
        @change="handlePaginationChange"
      />
    </el-card>

    <!-- 错误详情对话框 -->
    <MobileDialog
      v-model="detailVisible"
      title="错误详情"
      width="80%"
      dialog-class="error-detail-dialog"
      :show-default-footer="false"
    >
      <div v-if="selectedError" class="error-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="错误ID">{{ selectedError.id }}</el-descriptions-item>
          <el-descriptions-item label="发生时间">{{ selectedError.formattedTime }}</el-descriptions-item>
          <el-descriptions-item label="错误级别">
            <el-tag :type="getLevelTagType(selectedError.level)">
              {{ getLevelText(selectedError.level) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="错误类型">
            <el-tag type="info">{{ getTypeText(selectedError.type) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="组件" v-if="selectedError.component">
            {{ selectedError.component }}
          </el-descriptions-item>
          <el-descriptions-item label="操作" v-if="selectedError.action">
            {{ selectedError.action }}
          </el-descriptions-item>
          <el-descriptions-item label="发生次数">{{ selectedError.count }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedError.resolved ? 'success' : 'warning'">
              {{ selectedError.resolved ? '已解决' : '未解决' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="URL" span="2">
            <el-link :href="selectedError.url" target="_blank" type="primary">
              {{ selectedError.url }}
            </el-link>
          </el-descriptions-item>
          <el-descriptions-item label="用户代理" span="2">
            {{ selectedError.userAgent }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="error-section" v-if="selectedError.message">
          <h4>错误信息</h4>
          <pre class="error-content">{{ selectedError.message }}</pre>
        </div>

        <div class="error-section" v-if="selectedError.stack">
          <h4>错误堆栈</h4>
          <pre class="error-stack">{{ selectedError.stack }}</pre>
        </div>

        <div class="error-section" v-if="selectedError.context">
          <h4>上下文信息</h4>
          <pre class="error-context">{{ JSON.stringify(selectedError.context, null, 2) }}</pre>
        </div>

        <div class="error-section" v-if="selectedError.tags?.length">
          <h4>标签</h4>
          <el-space wrap>
            <el-tag v-for="tag in selectedError.tags" :key="tag" size="small">
              {{ tag }}
            </el-tag>
          </el-space>
        </div>
      </div>

      <template #footer>
        <el-button type="default" @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="selectedError && !selectedError.resolved"
          type="success"
          @click="resolveError(selectedError.id); detailVisible = false"
        >
          标记为已解决
        </el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  WarningFilled,
  Clock,
  TrendCharts,
  Upload,
  Refresh,
  Download,
  Delete,
  Check,
  Close
} from '@element-plus/icons-vue'
import { useErrorLogger, ErrorLevel, ErrorType } from '@/utils/error-logger'
import { TimeUtil } from '@/utils/time'
import Pagination from '@/components/Pagination.vue'
import { useImportExport } from '@/composables/useImportExport'

// 错误日志
const {
  logs,
  statistics,
  resolveError: resolveErrorLog,
  getLogs,
  exportLogs: exportErrorLogs,
  clearLogs: clearErrorLogs
} = useErrorLogger()
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const loading = ref(false)
const detailVisible = ref(false)
const selectedError = ref(null)

// 过滤器
const filters = ref({
  level: '',
  type: '',
  resolved: undefined as boolean | undefined
})

// 分页
const pagination = ref({
  page: 1,
  size: 20
})

// 计算属性
const filteredLogs = computed(() => {
  return getLogs({
    level: filters.value.level as ErrorLevel,
    type: filters.value.type as ErrorType,
    resolved: filters.value.resolved
  })
})

const paginatedLogs = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.size
  const end = start + pagination.value.size
  return filteredLogs.value.slice(start, end)
})

// 方法
const formatTime = (timestamp: number) => {
  return TimeUtil.format(timestamp, 'YYYY-MM-DD HH:mm:ss')
}

const getPercentage = (value: number, total: number) => {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

const getLevelText = (level: ErrorLevel) => {
  const textMap = {
    [ErrorLevel.CRITICAL]: '严重',
    [ErrorLevel.HIGH]: '高',
    [ErrorLevel.MEDIUM]: '中',
    [ErrorLevel.LOW]: '低'
  }
  return textMap[level] || level
}

const getLevelColor = (level: ErrorLevel) => {
  const colorMap = {
    [ErrorLevel.CRITICAL]: '#f56c6c',
    [ErrorLevel.HIGH]: '#e6a23c',
    [ErrorLevel.MEDIUM]: '#409eff',
    [ErrorLevel.LOW]: '#67c23a'
  }
  return colorMap[level] || '#909399'
}

const getLevelTagType = (level: ErrorLevel) => {
  const typeMap = {
    [ErrorLevel.CRITICAL]: 'danger',
    [ErrorLevel.HIGH]: 'warning',
    [ErrorLevel.MEDIUM]: 'info',
    [ErrorLevel.LOW]: 'success'
  }
  return typeMap[level] || 'info'
}

const getTypeText = (type: ErrorType) => {
  const textMap = {
    [ErrorType.VUE]: 'Vue',
    [ErrorType.JAVASCRIPT]: 'JavaScript',
    [ErrorType.NETWORK]: '网络',
    [ErrorType.ASYNC]: '异步',
    [ErrorType.PERMISSION]: '权限',
    [ErrorType.VALIDATION]: '验证',
    [ErrorType.PERFORMANCE]: '性能',
    [ErrorType.BUSINESS]: '业务'
  }
  return textMap[type] || type
}

const getTypeColor = (type: ErrorType) => {
  const colorMap = {
    [ErrorType.VUE]: '#67c23a',
    [ErrorType.JAVASCRIPT]: '#e6a23c',
    [ErrorType.NETWORK]: '#f56c6c',
    [ErrorType.ASYNC]: '#909399',
    [ErrorType.PERMISSION]: '#ff4757',
    [ErrorType.VALIDATION]: '#ffa502',
    [ErrorType.PERFORMANCE]: '#3742fa',
    [ErrorType.BUSINESS]: '#2ed573'
  }
  return colorMap[type] || '#909399'
}

const getRowClassName = ({ row }: { row: any }) => {
  if (row.level === ErrorLevel.CRITICAL) return 'error-row-critical'
  if (row.level === ErrorLevel.HIGH) return 'error-row-high'
  if (!row.resolved) return 'error-row-unresolved'
  return ''
}

const applyFilters = () => {
  pagination.value.page = 1
}

const handleSizeChange = (size: number) => {
  pagination.value.size = size
  pagination.value.page = 1
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
}

const handlePaginationChange = (page: number, size: number) => {
  if (size !== pagination.value.size) {
    handleSizeChange(size)
    return
  }

  handlePageChange(page)
}

const refreshLogs = async () => {
  loading.value = true
  try {
    await nextTick()
    // 触发响应式更新
    logs.value = getLogs()
    ElMessage.success('刷新成功')
  } catch (error) {
    ElMessage.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const showErrorDetail = (error: any) => {
  selectedError.value = error
  detailVisible.value = true
}

const resolveError = async (errorId: string) => {
  try {
    resolveErrorLog(errorId)
    ElMessage.success('已标记为已解决')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const deleteError = async (errorId: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这条错误记录吗？', '确认删除', {
      type: 'warning'
    })
    // TODO: 实现删除功能
    ElMessage.success('删除成功')
  } catch (error) {
    // 用户取消
  }
}

const exportLogs = async () => {
  try {
    await exportTextFile({
      content: exportErrorLogs(),
      filename: buildDateFilename('error-logs', 'json', 'YYYYMMDD_HHmmss'),
      mimeType: 'application/json;charset=utf-8;',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const clearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有错误日志吗？此操作不可恢复！', '确认清空', {
      type: 'warning',
      confirmButtonText: '确定清空',
      confirmButtonClass: 'el-button--danger'
    })
    clearErrorLogs()
    ElMessage.success('清空成功')
  } catch (error) {
    // 用户取消
  }
}

// 生命周期
onMounted(() => {
})
</script>

<style lang="scss" scoped>
.error-dashboard {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;

  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    height: 120px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-5px);
    }

    :deep(.el-card__body) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
    }
  }

  .stat-content {
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
    }
  }

  .charts-row {
    margin-bottom: 20px;
  }

  .error-distribution {
    padding: 10px 0;

    .dist-item {
      display: flex;
      align-items: center;
      margin-bottom: 15px;

      .dist-label {
        width: 80px;
        font-size: 14px;
        color: #606266;
      }

      :deep(.el-progress) {
        flex: 1;
        margin-left: 10px;
      }
    }
  }

  .common-errors-card {
    margin-bottom: 20px;
  }

  .error-list-card {
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .list-actions {
      display: flex;
      gap: 10px;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    word-break: break-all;
  }

  :deep(.error-row-critical) {
    background-color: #fef0f0;
  }

  :deep(.error-row-high) {
    background-color: #fdf6ec;
  }

  :deep(.error-row-unresolved) {
    background-color: #f0f9ff;
  }

  .error-detail {
    .error-section {
      margin-top: 20px;

      h4 {
        margin-bottom: 10px;
        color: #303133;
      }
    }

    .error-content,
    .error-stack,
    .error-context {
      background: #f5f7fa;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.6;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .error-stack {
      color: #f56c6c;
    }
  }
}
</style>
