<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="price-list"
    module-name="同步日志"
    permission-code="price-list:view"
  >
    <div class="sync-log-view admin-page admin-page-content">
      <PageHeader title="同步日志">
        <template #actions>
          <el-button
            v-if="canDelete"
            type="danger"
            :loading="clearLoading"
            @click="handleClearLogs"
          >
            <i class="fas fa-trash" />
            清空日志
          </el-button>
          <el-button
            type="primary"
            @click="fetchLogs"
          >
            <i class="fas fa-refresh" />
            刷新
          </el-button>
          <el-button @click="router.back()">
            <i class="fas fa-arrow-left" />
            返回
          </el-button>
        </template>
      </PageHeader>

      <!-- 统计卡片 -->
      <div
        v-if="showStatsCards"
        class="stats-cards"
      >
        <div
          v-if="canViewSyncLogField('stats_success_count')"
          class="stat-card stat-card--success"
        >
          <div class="stat-icon">
            <i class="fas fa-check-circle" />
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ stats.successCount }}
            </div>
            <div class="stat-label">
              成功次数
            </div>
          </div>
        </div>
        <div
          v-if="canViewSyncLogField('stats_fail_count')"
          class="stat-card stat-card--danger"
        >
          <div class="stat-icon">
            <i class="fas fa-times-circle" />
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ stats.failCount }}
            </div>
            <div class="stat-label">
              失败次数
            </div>
          </div>
        </div>
        <div
          v-if="canViewSyncLogField('stats_total_records')"
          class="stat-card stat-card--info"
        >
          <div class="stat-icon">
            <i class="fas fa-database" />
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ stats.totalRecords }}
            </div>
            <div class="stat-label">
              同步总记录
            </div>
          </div>
        </div>
        <div
          v-if="canViewSyncLogField('stats_avg_duration')"
          class="stat-card stat-card--warning"
        >
          <div class="stat-icon">
            <i class="fas fa-clock" />
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ stats.avgDuration }}s
            </div>
            <div class="stat-label">
              平均耗时
            </div>
          </div>
        </div>
      </div>

      <!-- 日志列表 -->
      <el-card class="table-card admin-panel admin-table-panel">
        <div
          v-if="isMobile"
          class="table-responsive"
        >
          <div
            v-if="loading"
            class="table-loading"
          >
            <SectionLoading
              text="加载同步日志中..."
              size="large"
            />
          </div>

          <div
            v-else
            class="sync-log-mobile-list"
          >
            <DataEmptyState
              v-if="!logList.length"
              size="compact"
              description="暂无同步日志"
            />
            <article
              v-for="row in logList"
              :key="row.id"
              class="sync-log-mobile-item"
            >
              <button
                type="button"
                class="sync-log-mobile-summary"
                @click="handleMobileRowTap(row.id)"
              >
                <span class="sync-log-mobile-time">{{ formatDateTime(row.start_time) }}</span>
                <el-tag
                  v-if="row.status === 'success'"
                  type="success"
                  size="small"
                >
                  成功
                </el-tag>
                <el-tag
                  v-else-if="row.status === 'failed'"
                  type="danger"
                  size="small"
                >
                  失败
                </el-tag>
                <el-tag
                  v-else-if="row.status === 'running'"
                  type="warning"
                  size="small"
                >
                  进行中
                </el-tag>
                <el-tag
                  v-else
                  type="info"
                  size="small"
                >
                  {{ row.status }}
                </el-tag>
                <span class="sync-log-mobile-config">{{ row.config_name || '-' }}</span>
                <i
                  class="fas"
                  :class="mobileActionRowId === row.id ? 'fa-chevron-up' : 'fa-chevron-down'"
                />
              </button>
              <div class="sync-log-mobile-meta">
                <span>成功 {{ row.success_count ?? '-' }}</span>
                <span>失败 {{ row.failed_count ?? '-' }}</span>
                <span>耗时 {{ row.duration ? `${row.duration}秒` : '-' }}</span>
              </div>
              <div
                v-if="mobileActionRowId === row.id"
                class="mobile-row-actions"
              >
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
            </article>
          </div>
        </div>

        <el-table
          v-else
          class="data-table"
          :data="loading ? [] : logList"
          stripe
          border
          style="width: 100%"
          @row-dblclick="handleViewDetail"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="加载中..."
            />
            <DataEmptyState
              v-else
              description="暂无同步日志"
            />
          </template>

          <el-table-column
            type="index"
            label="序号"
            width="80"
            align="center"
          />
          <el-table-column
            prop="start_time"
            label="开始时间"
            min-width="160"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.start_time) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="end_time"
            label="结束时间"
            min-width="160"
          >
            <template #default="{ row }">
              {{ row.end_time ? formatDateTime(row.end_time) : '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="duration"
            label="耗时"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span v-if="row.duration">{{ row.duration }}秒</span>
              <span
                v-else
                class="text-gray"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="status"
            label="状态"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.status === 'success'"
                type="success"
                size="small"
              >
                成功
              </el-tag>
              <el-tag
                v-else-if="row.status === 'failed'"
                type="danger"
                size="small"
              >
                失败
              </el-tag>
              <el-tag
                v-else-if="row.status === 'running'"
                type="warning"
                size="small"
              >
                进行中
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="small"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="total_count"
            label="总数"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              {{ row.total_count || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="success_count"
            label="成功"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.success_count !== null"
                class="text-success"
              >{{ row.success_count }}</span>
              <span
                v-else
                class="text-gray"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="failed_count"
            label="失败"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.failed_count !== null && row.failed_count > 0"
                class="text-error text-bold"
              >{{ row.failed_count }}</span>
              <span
                v-else-if="row.failed_count !== null"
                class="text-success"
              >0</span>
              <span
                v-else
                class="text-gray"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="error_message"
            label="错误信息"
            min-width="200"
            class-name="complete-text-column wrapped-text-column"
          >
            <template #default="{ row }">
              <span
                v-if="getLogErrorSummary(row)"
                :class="row.failed_count > 0 || row.status === 'failed' ? 'text-error' : 'text-gray'"
              >
                {{ getLogErrorSummary(row) }}
              </span>
              <span
                v-else
                class="text-gray"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="config_name"
            label="配置"
            min-width="120"
            class-name="complete-text-column"
          >
            <template #default="{ row }">
              {{ row.config_name || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="showSyncLogActionField"
            label="操作"
            :width="$getActionColumnWidth(1 + Number(canDelete))"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click.stop="handleViewDetail(row)"
                >
                  详情
                </el-button>
                <el-button
                  v-if="canDelete"
                  link
                  type="danger"
                  size="small"
                  @click.stop="handleDeleteLog(row)"
                >
                  删除
                </el-button>
              </div>
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
        <div
          v-if="currentLog"
          class="log-detail"
        >
          <!-- 状态横幅 -->
          <div
            class="detail-banner"
            :class="`banner-${currentLog.status}`"
          >
            <i
              v-if="currentLog.status === 'success'"
              class="fas fa-check-circle"
            />
            <i
              v-else-if="currentLog.status === 'failed'"
              class="fas fa-times-circle"
            />
            <InlineLoading
              v-else
              size="small"
              variant="inherit"
            />
            <span class="banner-text">
              {{ currentLog.status === 'success' ? '同步成功' : currentLog.status === 'failed' ? '同步失败' : '同步中...' }}
            </span>
          </div>

          <el-descriptions
            :column="2"
            border
            class="detail-descriptions"
          >
            <el-descriptions-item label="开始时间">
              {{ formatDateTime(currentLog.start_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="结束时间">
              {{ currentLog.end_time ? formatDateTime(currentLog.end_time) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="执行时长">
              <span v-if="currentLog.duration">{{ currentLog.duration }}秒</span>
              <span
                v-else
                class="text-gray"
              >-</span>
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
              <span
                class="stat-number"
                :class="currentLog.failed_count > 0 ? 'error' : 'success'"
              >{{ currentLog.failed_count || 0 }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="成功率">
              <span
                class="stat-number"
                :class="getSuccessRateClass(currentLog)"
              >
                {{ getSuccessRate(currentLog) }}%
              </span>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="currentLog.error_message"
              label="错误信息"
              :span="2"
            >
              <div class="error-message-box">
                <i class="fas fa-exclamation-triangle" />
                {{ currentLog.error_message }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              v-else
              label="提示说明"
              :span="2"
            >
              <div class="info-message-box">
                <i class="fas fa-info-circle" />
                <span v-if="currentLog.status === 'success'">同步完成，所有数据已成功更新</span>
                <span v-else-if="currentLog.status === 'failed'">同步失败，请检查错误信息或联系管理员</span>
                <span v-else>同步正在执行中，请稍候...</span>
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 详情数据 -->
          <div
            v-if="currentLog.sync_details"
            class="detail-section"
          >
            <div class="detail-section-title">
              <i class="fas fa-code" />
              同步详情数据
            </div>
            <pre class="json-detail">{{ formatJson(currentLog.sync_details) }}</pre>
          </div>

          <!-- 成功列表 -->
          <div
            v-if="parsedSyncDetails?.items?.success?.length > 0"
            class="detail-section"
          >
            <div class="detail-section-title success">
              <i class="fas fa-check-circle" />
              成功列表 ({{ parsedSyncDetails.items.success.length }})
            </div>
            <el-table
              class="data-table"
              :data="parsedSyncDetails.items.success"
              stripe
              border
              size="small"
              max-height="300"
            >
              <el-table-column
                prop="brand"
                label="品牌"
                width="80"
              />
              <el-table-column
                prop="model"
                label="型号"
                width="120"
              />
              <el-table-column
                prop="color"
                label="颜色"
                width="80"
              />
              <el-table-column
                prop="memory"
                label="内存"
                width="80"
              />
              <el-table-column
                prop="price"
                label="价格"
                width="80"
              >
                <template #default="{ row }">
                  ¥{{ row.price }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 失败列表 -->
          <div
            v-if="parsedSyncDetails?.items?.failed?.length > 0"
            class="detail-section"
          >
            <div class="detail-section-title failed">
              <i class="fas fa-times-circle" />
              失败列表 ({{ parsedSyncDetails.items.failed.length }})
            </div>
            <el-table
              class="data-table"
              :data="parsedSyncDetails.items.failed"
              stripe
              border
              size="small"
              max-height="300"
            >
              <el-table-column
                prop="brand"
                label="品牌"
                width="80"
              />
              <el-table-column
                prop="model"
                label="型号"
                width="120"
              />
              <el-table-column
                prop="color"
                label="颜色"
                width="80"
              />
              <el-table-column
                prop="memory"
                label="内存"
                width="80"
              />
              <el-table-column
                prop="error"
                label="错误原因"
                min-width="150"
                class-name="complete-text-column wrapped-text-column"
              />
            </el-table>
          </div>
        </div>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSyncLogs, getSyncLogStatistics, deleteSyncLog, clearSyncLogs } from '@/api/price-list'
import { usePagination } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { PageHeader, PermissionGate } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { logger } from '@/utils/logger'
import { isCurrentMobileViewport } from '@/utils/device-detection'
const router = useRouter()
const { canView, canDelete, handleNoPermission } = usePagePermissions('price-list-sync-logs')

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
const showSyncLogActionField = computed(() => shouldShowActionColumn(
  canViewSyncLogField('actions'),
  [canDelete.value]
))

// 使用统一分页 composable
const {
  page,
  limit,
  total,
  setTotal,
  goToPage,
  setLimit
} = usePagination({
  page: 1,
  limit: 20,
  onChange: () => {
    fetchLogs()
  }
})

// 创建 reactive 分页对象供模板使用（自动解包 ref）
const pagination = reactive({ page, limit, total, setTotal, goToPage, setLimit })

// 数据状态
const { loading } = useLoadingState()
loading.value = true
const clearLoading = ref(false)
const deleteLoading = ref(false)
const logList = ref<any[]>([])

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
    loading.value = false
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
  goToPage(page)
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

// 获取后端汇总统计，不把全部日志下载到浏览器再计算。
const fetchLogStats = async () => {
  if (!canView.value) {
    stats.value = { successCount: 0, failCount: 0, totalRecords: 0, avgDuration: 0 }
    return
  }

  try {
    const res = await getSyncLogStatistics()

    if (res.success && res.data) {
      stats.value = {
        successCount: Number(res.data.success_count) || 0,
        failCount: Number(res.data.fail_count) || 0,
        totalRecords: Number(res.data.total_records) || 0,
        avgDuration: Number(res.data.avg_duration) || 0
      }
    }
  } catch (error) {
    logger.error('获取统计数据失败:', error)
  }
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
      fetchLogStats() // 重新获取统计数据
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
      fetchLogStats() // 重新获取统计数据
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
  isMobile.value = isCurrentMobileViewport()
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
    loading.value = false
    return
  }

  await fieldPermissions.init()
  fetchLogs()
  fetchLogStats()
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
  border: 1px solid var(--tf-color-border-slate);
  border-radius: 0;
  background: var(--color-bg-white);

  th,
  td {
    padding: 12px 6px;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
    border: 1px solid var(--tf-color-border-slate);
  }

  th {
    font-size: 11px;
    font-weight: 700;
    color: var(--tf-color-slate-600);
    background: var(--tf-color-surface);
  }

  td {
    font-size: 13px;
    font-weight: 600;
    color: var(--tf-color-slate-700);
    background: var(--color-bg-white);
  }
}

.mobile-empty-state {
  padding: 28px 16px;
  text-align: center;
}

.text-gray {
  color: var(--color-info);
}

.text-success {
  color: var(--color-success);
}

.text-error {
  color: var(--color-danger);
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
      background: linear-gradient(135deg, var(--tf-color-success-legacy) 0%, var(--tf-color-success-border-legacy) 100%);
      color: var(--tf-color-success-text-legacy);
    }

    &.banner-failed {
      background: linear-gradient(135deg, var(--tf-color-danger-legacy) 0%, var(--tf-color-danger-border-legacy) 100%);
      color: var(--tf-color-danger-text-legacy);
    }

    &.banner-running {
      background: linear-gradient(135deg, var(--tf-color-warning-legacy) 0%, var(--tf-color-yellow-bootstrap-light) 100%);
      color: var(--tf-color-warning-text-legacy);
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
        color: var(--color-success);
      }

      &.error {
        color: var(--color-danger);
      }

      &.warning {
        color: var(--color-warning);
      }
    }

    .error-message-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--tf-color-danger-surface-element);
      border-radius: 4px;
      color: var(--color-danger);

      i {
        font-size: 16px;
      }
    }

    .info-message-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--tf-color-zinc-100);
      border-radius: 4px;
      color: var(--color-text-regular);

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
      background: var(--tf-color-surface);
      border-radius: 4px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 12px;
    }
  }
}

.text-bold {
  font-weight: 600;
}

.sync-log-mobile-list {
  display: grid;
  gap: 8px;
}

.sync-log-mobile-item {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.sync-log-mobile-summary {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) auto minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}

.sync-log-mobile-time,
.sync-log-mobile-config {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-log-mobile-config {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.sync-log-mobile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 0 12px 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.sync-log-mobile-item .mobile-row-actions {
  display: flex;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 768px) {
  .sync-log-view {
    padding: 12px;
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
  .sync-log-mobile-summary {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .sync-log-mobile-config {
    grid-column: 1 / -1;
    grid-row: 2;
  }

}
</style>
