<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="price-list"
    module-name="同步日志"
    permission-code="price-list:view"
  />

  <div v-else class="sync-log-view admin-page admin-page-content">
    <PageHeader title="同步日志">
      <template #actions>
        <el-button v-if="canDelete" type="danger" @click="handleClearLogs" :loading="clearLoading">
          <i class="fas fa-trash"></i>
          清空日志
        </el-button>
        <el-button type="primary" @click="fetchLogs">
          <i class="fas fa-refresh"></i>
          刷新
        </el-button>
        <el-button @click="router.back()">
          <i class="fas fa-arrow-left"></i>
          返回
        </el-button>
      </template>
    </PageHeader>

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewSyncLogField('stats_success_count')" class="stat-card">
        <div class="stat-icon success">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.successCount }}</div>
          <div class="stat-label">成功次数</div>
        </div>
      </div>
      <div v-if="canViewSyncLogField('stats_fail_count')" class="stat-card">
        <div class="stat-icon error">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.failCount }}</div>
          <div class="stat-label">失败次数</div>
        </div>
      </div>
      <div v-if="canViewSyncLogField('stats_total_records')" class="stat-card">
        <div class="stat-icon info">
          <i class="fas fa-database"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalRecords }}</div>
          <div class="stat-label">同步总记录</div>
        </div>
      </div>
      <div v-if="canViewSyncLogField('stats_avg_duration')" class="stat-card">
        <div class="stat-icon warning">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.avgDuration }}s</div>
          <div class="stat-label">平均耗时</div>
        </div>
      </div>
    </div>

    <!-- 日志列表 -->
    <el-card class="table-card admin-panel admin-table-panel">
      <div v-if="isMobile" class="table-responsive">
        <div v-if="loading" class="table-loading">
          <el-skeleton :rows="5" animated />
        </div>

        <table v-else class="data-table sync-log-mobile-table">
          <thead>
            <tr>
              <th>开始时间</th>
              <th>状态</th>
              <th>成功</th>
              <th>失败</th>
              <th>耗时</th>
              <th>配置</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!logList.length">
              <td colspan="6" class="text-center py-8">
                <div class="empty-state mobile-empty-state">
                  <i class="fas fa-history"></i>
                  <p>暂无同步日志</p>
                </div>
              </td>
            </tr>
            <template v-for="row in logList" :key="row.id">
              <tr
                class="data-row"
                @click="handleMobileRowTap(row.id)"
                @dblclick="toggleMobileActions(row.id)"
              >
                <td>{{ formatDateTime(row.start_time) }}</td>
                <td>
                  <el-tag v-if="row.status === 'success'" type="success" size="small">成功</el-tag>
                  <el-tag v-else-if="row.status === 'failed'" type="danger" size="small">失败</el-tag>
                  <el-tag v-else-if="row.status === 'running'" type="warning" size="small">进行中</el-tag>
                  <el-tag v-else type="info" size="small">{{ row.status }}</el-tag>
                </td>
                <td>{{ row.success_count ?? '-' }}</td>
                <td>{{ row.failed_count ?? '-' }}</td>
                <td>{{ row.duration ? `${row.duration}秒` : '-' }}</td>
                <td>{{ row.config_name || '-' }}</td>
              </tr>
              <tr
                v-if="mobileActionRowId === row.id"
                class="mobile-action-row"
              >
                <td colspan="6">
                  <div class="mobile-row-actions">
                    <el-button
                      type="primary"
                      size="small"
                      @click.stop="handleViewDetail(row)"
                    >
                      详情
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click.stop="handleDeleteLog(row)"
                    >
                      删除
                    </el-button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <el-table
        v-else
        v-loading="loading"
        :data="logList"
        stripe
        border
        style="width: 100%"
        @row-dblclick="handleViewDetail"
      >
        <el-table-column type="index" label="序号" width="80" align="center" />
        <el-table-column prop="start_time" label="开始时间" min-width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.start_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="end_time" label="结束时间" min-width="160">
          <template #default="{ row }">
            {{ row.end_time ? formatDateTime(row.end_time) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时" min-width="80" align="center">
          <template #default="{ row }">
            <span v-if="row.duration">{{ row.duration }}秒</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'success'" type="success" size="small">成功</el-tag>
            <el-tag v-else-if="row.status === 'failed'" type="danger" size="small">失败</el-tag>
            <el-tag v-else-if="row.status === 'running'" type="warning" size="small">进行中</el-tag>
            <el-tag v-else type="info" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_count" label="总数" min-width="70" align="center">
          <template #default="{ row }">
            {{ row.total_count || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="success_count" label="成功" min-width="70" align="center">
          <template #default="{ row }">
            <span v-if="row.success_count !== null" class="text-success">{{ row.success_count }}</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="failed_count" label="失败" min-width="70" align="center">
          <template #default="{ row }">
            <span v-if="row.failed_count !== null && row.failed_count > 0" class="text-error text-bold">{{ row.failed_count }}</span>
            <span v-else-if="row.failed_count !== null" class="text-success">0</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span
              v-if="getLogErrorSummary(row)"
              :class="row.failed_count > 0 || row.status === 'failed' ? 'text-error' : 'text-gray'"
            >
              {{ getLogErrorSummary(row) }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="config_name" label="配置" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.config_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click="handleViewDetail(row)"
            >
              详情
            </el-button>
            <el-button
              v-if="canDelete"
              link
              type="danger"
              size="small"
              @click="handleDeleteLog(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          :show-range="true"
          @change="handlePaginationChange"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <MobileDialog
      v-model="showDetailDialog"
      title="同步详情"
      width="800px"
      dialog-class="price-sync-log-detail-dialog"
      :show-default-footer="false"
    >
      <div v-if="currentLog" class="log-detail">
        <!-- 状态横幅 -->
        <div class="detail-banner" :class="`banner-${currentLog.status}`">
          <i v-if="currentLog.status === 'success'" class="fas fa-check-circle"></i>
          <i v-else-if="currentLog.status === 'failed'" class="fas fa-times-circle"></i>
          <i v-else class="fas fa-spinner fa-spin"></i>
          <span class="banner-text">
            {{ currentLog.status === 'success' ? '同步成功' : currentLog.status === 'failed' ? '同步失败' : '同步中...' }}
          </span>
        </div>

        <el-descriptions :column="2" border class="detail-descriptions">
          <el-descriptions-item label="开始时间">
            {{ formatDateTime(currentLog.start_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="结束时间">
            {{ currentLog.end_time ? formatDateTime(currentLog.end_time) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="执行时长">
            <span v-if="currentLog.duration">{{ currentLog.duration }}秒</span>
            <span v-else class="text-gray">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="配置名称">
            {{ currentLog.config_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="处理总数">
            <span class="stat-number">{{ currentLog.total_count || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="成功数量">
            <span class="stat-number success">{{ currentLog.success_count || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="失败数量">
            <span class="stat-number" :class="currentLog.failed_count > 0 ? 'error' : 'success'">{{ currentLog.failed_count || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="成功率">
            <span class="stat-number" :class="getSuccessRateClass(currentLog)">
              {{ getSuccessRate(currentLog) }}%
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="错误信息" :span="2" v-if="currentLog.error_message">
            <div class="error-message-box">
              <i class="fas fa-exclamation-triangle"></i>
              {{ currentLog.error_message }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="提示说明" :span="2" v-else>
            <div class="info-message-box">
              <i class="fas fa-info-circle"></i>
              <span v-if="currentLog.status === 'success'">同步完成，所有数据已成功更新</span>
              <span v-else-if="currentLog.status === 'failed'">同步失败，请检查错误信息或联系管理员</span>
              <span v-else>同步正在执行中，请稍候...</span>
            </div>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 详情数据 -->
        <div v-if="currentLog.sync_details" class="detail-section">
          <div class="detail-section-title">
            <i class="fas fa-code"></i>
            同步详情数据
          </div>
          <pre class="json-detail">{{ formatJson(currentLog.sync_details) }}</pre>
        </div>

        <!-- 成功列表 -->
        <div v-if="parsedSyncDetails?.items?.success?.length > 0" class="detail-section">
          <div class="detail-section-title success">
            <i class="fas fa-check-circle"></i>
            成功列表 ({{ parsedSyncDetails.items.success.length }})
          </div>
          <el-table :data="parsedSyncDetails.items.success" stripe border size="small" max-height="300">
            <el-table-column prop="brand" label="品牌" width="80" />
            <el-table-column prop="model" label="型号" width="120" />
            <el-table-column prop="color" label="颜色" width="80" />
            <el-table-column prop="memory" label="内存" width="80" />
            <el-table-column prop="price" label="价格" width="80">
              <template #default="{ row }">
                ¥{{ row.price }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 失败列表 -->
        <div v-if="parsedSyncDetails?.items?.failed?.length > 0" class="detail-section">
          <div class="detail-section-title failed">
            <i class="fas fa-times-circle"></i>
            失败列表 ({{ parsedSyncDetails.items.failed.length }})
          </div>
          <el-table :data="parsedSyncDetails.items.failed" stripe border size="small" max-height="300">
            <el-table-column prop="brand" label="品牌" width="80" />
            <el-table-column prop="model" label="型号" width="120" />
            <el-table-column prop="color" label="颜色" width="80" />
            <el-table-column prop="memory" label="内存" width="80" />
            <el-table-column prop="error" label="错误原因" min-width="150" show-overflow-tooltip />
          </el-table>
        </div>
      </div>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSyncLogs, deleteSyncLog, clearSyncLogs } from '@/api/price-list'
import { usePagination } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { PageHeader, PermissionDenied } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import { logger } from '@/utils/logger'
const router = useRouter()
const { canView, canDelete, handleNoPermission } = usePagePermissions('price-list')

const syncLogFieldMap: Record<string, string> = {
  stats_success_count: 'stats.success_count',
  stats_fail_count: 'stats.fail_count',
  stats_total_records: 'stats.total_records',
  stats_avg_duration: 'stats.avg_duration',
  actions: 'system_info.operations'
}

const getSyncLogFieldKey = (fieldName: string) => syncLogFieldMap[fieldName] || fieldName
const canViewSyncLogField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('price_list_synclogview', getSyncLogFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewSyncLogField('stats_success_count') ||
  canViewSyncLogField('stats_fail_count') ||
  canViewSyncLogField('stats_total_records') ||
  canViewSyncLogField('stats_avg_duration')
))

// 使用统一分页 composable
const {
  page,
  limit,
  total,
  setTotal,
  setPage,
  setLimit
} = usePagination({
  page: 1,
  limit: 20,
  onChange: () => {
    fetchLogs()
  }
})

// 创建 reactive 分页对象供模板使用（自动解包 ref）
const pagination = reactive({ page, limit, total, setTotal, setPage, setLimit })

// 数据状态
const { loading } = useLoadingState()
const clearLoading = ref(false)
const deleteLoading = ref(false)
const logList = ref<any[]>([])
const allLogs = ref<any[]>([]) // 存储所有日志用于统计计算

// 统计数据
const stats = ref({
  successCount: 0,
  failCount: 0,
  totalRecords: 0,
  avgDuration: 0
})
const isMobile = ref(false)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

// 详情对话框
const showDetailDialog = ref(false)
const currentLog = ref<any>(null)

// 解析同步详情
const parsedSyncDetails = computed(() => {
  if (!currentLog.value?.sync_details) return null
  try {
    return typeof currentLog.value.sync_details === 'string'
      ? JSON.parse(currentLog.value.sync_details)
      : currentLog.value.sync_details
  } catch {
    return null
  }
})

const parseSyncDetails = (syncDetails: any) => {
  if (!syncDetails) return null
  try {
    return typeof syncDetails === 'string' ? JSON.parse(syncDetails) : syncDetails
  } catch {
    return null
  }
}

const getFailedItemReason = (item: any) => {
  if (!item) return ''
  return item.error || item.reason || item.message || item.remark || ''
}

const getLogErrorSummary = (log: any) => {
  if (!log) return ''

  if (log.error_message) {
    return log.error_message
  }

  const syncDetails = parseSyncDetails(log.sync_details)
  const failedItems = syncDetails?.items?.failed

  if (Array.isArray(failedItems) && failedItems.length > 0) {
    const firstReason = getFailedItemReason(failedItems[0])
    if (firstReason) {
      return failedItems.length > 1
        ? `${firstReason} 等${failedItems.length}项`
        : firstReason
    }
  }

  if (Number(log.failed_count || 0) > 0) {
    return '存在未匹配或保存失败记录'
  }

  return ''
}

// 获取日志列表
const fetchLogs = async () => {
  if (!canView.value) {
    logList.value = []
    setTotal(0)
    return
  }

  loading.value = true
  try {
    const res = await getSyncLogs({
      page: pagination.page,
      limit: pagination.limit
    })

    if (res.success && res.data) {
      logList.value = res.data.list || []
      setTotal(res.data.total || 0)
    }
  } catch (error) {
    logger.error('获取日志失败:', error)
    ElMessage.error('获取日志失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  setPage(page)
}

const handlePageSizeChange = (limit: number) => {
  setLimit(limit)
}

const handlePaginationChange = (page: number, limit: number) => {
  if (limit !== pagination.limit) {
    handlePageSizeChange(limit)
    return
  }

  handlePageChange(page)
}

// 获取所有日志用于统计计算
const fetchAllLogsForStats = async () => {
  if (!canView.value) {
    allLogs.value = []
    calculateStats()
    return
  }

  try {
    // 获取所有日志（设置大的limit）
    const res = await getSyncLogs({
      page: 1,
      limit: 10000 // 获取所有日志用于统计
    })

    if (res.success && res.data) {
      allLogs.value = res.data.list || []
      calculateStats()
    }
  } catch (error) {
    logger.error('获取统计数据失败:', error)
  }
}

// 计算统计数据（基于所有日志）
const calculateStats = () => {
  const logs = allLogs.value
  stats.value = {
    successCount: logs.filter((log: any) => log.status === 'success').length,
    failCount: logs.filter((log: any) => log.status === 'failed').length,
    totalRecords: logs.reduce((sum: number, log: any) => sum + (log.total_count || 0), 0),
    avgDuration: 0
  }

  const completedLogs = logs.filter((log: any) => log.duration)
  stats.value.avgDuration = completedLogs.length > 0
    ? Math.round(completedLogs.reduce((sum: number, log: any) => sum + log.duration, 0) / completedLogs.length)
    : 0
}

// 查看详情
const handleViewDetail = (row: any) => {
  if (!canView.value) {
    handleNoPermission('view')
    return
  }

  currentLog.value = row
  showDetailDialog.value = true
}

// 删除单条日志
const handleDeleteLog = async (row: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这条同步日志吗？\n开始时间：${formatDateTime(row.start_time)}`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    deleteLoading.value = true
    const res = await deleteSyncLog(row.id)

    if (res.success !== false) {
      ElMessage.success('删除成功')
      fetchLogs()
      fetchAllLogsForStats() // 重新获取统计数据
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除日志失败:', error)
      ElMessage.error('删除失败')
    }
  } finally {
    deleteLoading.value = false
  }
}

// 清空所有日志
const handleClearLogs = async () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要清空所有同步日志吗？此操作不可恢复！',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )

    clearLoading.value = true
    const res = await clearSyncLogs()

    if (res.success !== false) {
      ElMessage.success('清空成功')
      fetchLogs()
      fetchAllLogsForStats() // 重新获取统计数据
    } else {
      ElMessage.error(res.message || '清空失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('清空日志失败:', error)
      ElMessage.error('清空失败')
    }
  } finally {
    clearLoading.value = false
  }
}

// 格式化时间
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'

  const date = new Date(dateStr)

  // 检查是否是有效日期
  if (isNaN(date.getTime())) return '-'

  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000))

  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 格式化JSON
const formatJson = (jsonStr: string) => {
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    return JSON.stringify(obj, null, 2)
  } catch {
    return jsonStr
  }
}

// 计算成功率
const getSuccessRate = (log: any) => {
  if (!log.total_count || log.total_count === 0) return 0
  return Math.round(((log.success_count || 0) / log.total_count) * 100)
}

// 获取成功率样式类
const getSuccessRateClass = (log: any) => {
  const rate = getSuccessRate(log)
  if (rate === 100) return 'success'
  if (rate >= 50) return 'warning'
  return 'error'
}

const updateMobileState = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    mobileActionRowId.value = null
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
  }
}

const toggleMobileActions = (id: number | null) => {
  if (!isMobile.value || !id) return
  mobileActionRowId.value = mobileActionRowId.value === id ? null : id
}

const handleMobileRowTap = (id: number | null) => {
  if (!isMobile.value || !id) return

  const now = Date.now()
  if (lastTappedRowId.value === id && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = id
  lastTapTimestamp.value = now
}

onMounted(async () => {
  updateMobileState()
  window.addEventListener('resize', updateMobileState)

  if (!canView.value) {
    return
  }

  await fieldPermissions.init()
  fetchLogs()
  fetchAllLogsForStats()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateMobileState)
  }
})
</script>

<style scoped lang="scss">
.sync-log-view {
  padding: 20px;
}

// 统计卡片
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    .stat-icon {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;

      &.success {
        background: #f0f9ff;
        color: #67c23a;
      }

      &.error {
        background: #fef0f0;
        color: #f56c6c;
      }

      &.info {
        background: #f4f4f5;
        color: #909399;
      }

      &.warning {
        background: #fdf6ec;
        color: #e6a23c;
      }
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #303133;
        line-height: 1;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

.table-card {
  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}

.sync-log-mobile-table {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #dbe2ea;
  border-radius: 0;
  background: #ffffff;

  th,
  td {
    padding: 12px 6px;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
    border: 1px solid #dbe2ea;
  }

  th {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    background: #f5f7fa;
  }

  td {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    background: #ffffff;
  }
}

.mobile-empty-state {
  padding: 28px 16px;
  text-align: center;
}

.text-gray {
  color: #909399;
}

.text-success {
  color: #67c23a;
}

.text-error {
  color: #f56c6c;
}

// 日志详情
.log-detail {
  .detail-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 16px;
    font-weight: 600;

    &.banner-success {
      background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
      color: #155724;
    }

    &.banner-failed {
      background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
      color: #721c24;
    }

    &.banner-running {
      background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
      color: #856404;
    }

    i {
      font-size: 24px;
    }
  }

  .detail-descriptions {
    .stat-number {
      font-size: 20px;
      font-weight: 600;

      &.success {
        color: #67c23a;
      }

      &.error {
        color: #f56c6c;
      }

      &.warning {
        color: #e6a23c;
      }
    }

    .error-message-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fef0f0;
      border-radius: 4px;
      color: #f56c6c;

      i {
        font-size: 16px;
      }
    }

    .info-message-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f4f4f5;
      border-radius: 4px;
      color: #606266;

      i {
        font-size: 16px;
      }
    }
  }

  .detail-section {
    margin-top: 20px;

    .detail-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #f5f7fa;
      border-radius: 4px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 12px;
    }
  }
}

.text-bold {
  font-weight: 600;
}

@media (max-width: 768px) {
  .sync-log-view {
    padding: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;

    .stat-card {
      padding: 14px 12px;
      gap: 10px;

      .stat-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }

      .stat-content {
        .stat-value {
          font-size: 18px;
        }

        .stat-label {
          font-size: 11px;
        }
      }
    }
  }

  .table-card {
    border-radius: 16px;

    .pagination-container {
      justify-content: center;
      margin-top: 14px;
    }
  }

  .log-detail {
    .detail-banner {
      padding: 12px;
      margin-bottom: 14px;
      font-size: 14px;

      i {
        font-size: 20px;
      }
    }

    .detail-section {
      margin-top: 14px;

      .detail-section-title {
        padding: 10px 12px;
        font-size: 13px;
      }
    }
  }

  .detail-descriptions :deep(.el-descriptions__table) {
    display: block;
    overflow-x: auto;
  }
}

@media (max-width: 480px) {
  .sync-log-mobile-table {
    th,
    td {
      padding: 10px 4px;
      font-size: 12px;
    }

    th {
      font-size: 10px;
    }
  }

  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
