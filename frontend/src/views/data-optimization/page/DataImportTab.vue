<template>
  <div class="data-import-tab">
    <!-- 操作按钮 -->
    <div class="action-bar">
      <el-button
        type="info"
        @click="getImportHistory"
      >
        <i class="fas fa-history" />
        <span>导入历史</span>
      </el-button>
    </div>

    <!-- 导入向导 -->
    <div class="import-wizard">
      <!-- 步骤1：上传文件 -->
      <div
        v-if="currentStep === 1"
        class="wizard-step upload-step"
      >
        <div class="step-header">
          <h2>步骤 1: 上传Excel文件</h2>
          <p>请选择包含销售记录的Excel文件（.xls 或 .xlsx）</p>
        </div>

        <div
          class="upload-area"
          @click="handleUploadClick"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".xls,.xlsx"
            style="display: none"
            @change="handleFileSelect"
          >
          <div class="upload-content">
            <i class="fas fa-cloud-upload-alt" />
            <p class="upload-text">
              点击或拖拽文件到此处上传
            </p>
            <p class="upload-hint">
              支持 .xls 和 .xlsx 格式，文件大小不超过 10MB
            </p>
          </div>
        </div>

        <div
          v-if="uploadedFile"
          class="file-info"
        >
          <div class="file-item">
            <i class="fas fa-file-excel" />
            <div class="file-details">
              <span class="file-name">{{ uploadedFile.name }}</span>
              <span class="file-size">{{ formatFileSize(uploadedFile.size) }}</span>
            </div>
            <el-button
              type="danger"
              size="small"
              @click="clearFile"
            >
              <i class="fas fa-times" />
            </el-button>
          </div>
        </div>

        <!-- 上传进度 -->
        <div
          v-if="uploading"
          class="upload-progress"
        >
          <el-progress
            :percentage="uploadProgress"
            :stroke-width="20"
          />
          <p class="progress-text">
            {{ uploadProgressText }}
          </p>
        </div>

        <!-- 分析进度 -->
        <div
          v-if="analyzing"
          class="analysis-progress"
        >
          <el-progress
            :percentage="analyzeProgress"
            :indeterminate="analyzing"
            :stroke-width="20"
            status="success"
          />
          <p class="progress-text">
            {{ analyzeProgressText }}
          </p>
        </div>

        <div class="step-actions">
          <el-button
            type="primary"
            :disabled="!uploadedFile || uploading || analyzing"
            @click="analyzeFile"
          >
            <InlineLoading
              v-if="uploading || analyzing"
              :text="uploading ? '正在上传导入文件...' : '正在分析导入文件...'"
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-search" />
              <span>分析数据</span>
            </template>
          </el-button>
        </div>
      </div>

      <!-- 步骤2：选择导入策略 -->
      <div
        v-if="currentStep === 2 && analysisResult"
        class="wizard-step strategy-step"
      >
        <div class="step-header">
          <h2>步骤 2: 选择导入策略</h2>
          <p>根据数据分析结果，选择合适的导入策略</p>
        </div>

        <!-- 数据分析结果 -->
        <div class="analysis-result">
          <div class="result-summary">
            <div class="summary-item">
              <span class="label">总记录数:</span>
              <span class="value">{{ analysisResult.total }}</span>
            </div>
            <div class="summary-item success">
              <span class="label">新记录:</span>
              <span class="value">{{ analysisResult.new_records }}</span>
            </div>
            <div class="summary-item warning">
              <span class="label">重复记录:</span>
              <span class="value">{{ analysisResult.duplicate_records }}</span>
            </div>
          </div>

          <!-- 数据统计详情 -->
          <div
            v-if="analysisResult.summary && Object.keys(analysisResult.summary).length > 0"
            class="data-summary"
          >
            <h3>
              <i class="fas fa-chart-bar" />
              数据统计
            </h3>
            <div class="summary-grid">
              <div
                v-if="analysisResult.summary.brands"
                class="summary-stat"
              >
                <i class="fas fa-tag" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.brands }}</span>
                  <span class="stat-label">品牌</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.models"
                class="summary-stat"
              >
                <i class="fas fa-mobile-alt" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.models }}</span>
                  <span class="stat-label">型号</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.colors"
                class="summary-stat"
              >
                <i class="fas fa-palette" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.colors }}</span>
                  <span class="stat-label">颜色</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.memories"
                class="summary-stat"
              >
                <i class="fas fa-memory" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.memories }}</span>
                  <span class="stat-label">内存</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.suppliers"
                class="summary-stat"
              >
                <i class="fas fa-truck" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.suppliers }}</span>
                  <span class="stat-label">供应商</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.stores"
                class="summary-stat"
              >
                <i class="fas fa-store" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.stores }}</span>
                  <span class="stat-label">店铺</span>
                </div>
              </div>
              <div
                v-if="analysisResult.summary.customers"
                class="summary-stat"
              >
                <i class="fas fa-users" />
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.customers }}</span>
                  <span class="stat-label">客户</span>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="analysisResult.duplicates.length > 0"
            class="duplicates-preview"
          >
            <h3>
              <i class="fas fa-exclamation-triangle" />
              差异数据预览 ({{ analysisResult.duplicates.length }} 条有变化)
            </h3>
            <p>以下数据与云端存在差异，只显示有变化的字段：</p>
            <div class="smart-tip">
              <i class="fas fa-lightbulb" />
              <span>智能导入逻辑：</span>
              <ul>
                <li>📦→✨ 库存→销售：以本地为准完整更新（包括品牌、型号、颜色等所有字段）</li>
                <li>✨→📦 已售→库存：保持已售（不降级，保护数据）</li>
                <li>✨→🔄 已售→已售：以本地为准完整更新所有销售信息</li>
                <li>📦→📦 库存→库存：保持不变</li>
              </ul>
            </div>
            <div class="duplicates-list scrollable">
              <div
                v-for="(dup, index) in analysisResult.duplicates"
                :key="index"
                class="duplicate-item expanded"
                :class="{ 'dup-sold': dup.existing_record?.has_sale, 'dup-stock': !dup.existing_record?.has_sale }"
              >
                <div class="duplicate-header">
                  <span class="dup-imei">{{ dup.imei || dup.composite_key?.split('|')[2] || '未知' }}</span>
                  <span class="dup-row">Excel 第 {{ dup.row_index }} 行</span>
                  <span
                    class="dup-cloud-status"
                    :class="dup.existing_record?.has_sale ? 'status-sold' : 'status-stock'"
                  >
                    {{ dup.existing_record?.has_sale ? '云端: 已售' : '云端: 库存' }}
                  </span>
                </div>

                <!-- 显示有差异的字段 -->
                <div
                  v-if="dup.differences && Object.keys(dup.differences).length > 0"
                  class="duplicate-details diff-details"
                >
                  <div
                    v-for="(diff, field) in dup.differences"
                    :key="field"
                    class="detail-row diff-row"
                  >
                    <span class="detail-label">{{ field }}:</span>
                    <span class="detail-value diff-value">
                      <span class="cloud-value">{{ diff.cloud || '-' }}</span>
                      <i class="fas fa-arrow-right diff-arrow" />
                      <span class="excel-value">{{ diff.excel || '-' }}</span>
                    </span>
                  </div>
                </div>

                <!-- 如果没有差异但云端已售，显示基本信息 -->
                <div
                  v-else
                  class="duplicate-details"
                >
                  <div class="detail-row">
                    <span class="detail-label">品牌:</span>
                    <span class="detail-value">{{ dup.data['品牌'] || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">型号:</span>
                    <span class="detail-value">{{ dup.data['型号'] || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">颜色:</span>
                    <span class="detail-value">{{ dup.data['颜色'] || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">内存:</span>
                    <span class="detail-value">{{ dup.data['内存'] || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">状态:</span>
                    <span class="detail-value">{{ dup.data['状态'] || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 策略选择 -->
        <div class="strategy-options">
          <div
            v-for="strategy in strategies"
            :key="strategy.key"
            class="strategy-card"
            :class="[
              { 'selected': selectedStrategy === strategy.key },
              'strategy-' + strategy.key
            ]"
            @click="selectedStrategy = strategy.key"
          >
            <div class="strategy-icon">
              <IconRenderer :icon="strategy.icon" />
            </div>
            <div class="strategy-content">
              <h3>{{ strategy.label }}</h3>
              <p>{{ strategy.description }}</p>
              <ul
                v-if="strategy.effects"
                class="strategy-effects"
              >
                <li
                  v-for="(effect, index) in strategy.effects"
                  :key="index"
                >
                  <i class="fas fa-check" />
                  {{ effect }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="step-actions">
          <el-button
            type="info"
            @click="currentStep = 1"
          >
            <i class="fas fa-arrow-left" />
            <span>上一步</span>
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedStrategy || importing"
            @click="startImport"
          >
            <InlineLoading
              v-if="importing"
              text="导入中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-play" />
              <span>开始导入</span>
            </template>
          </el-button>
        </div>
      </div>

      <!-- 步骤3：导入进度 -->
      <div
        v-if="currentStep === 3"
        class="wizard-step progress-step"
      >
        <div class="step-header">
          <h2>步骤 3: 导入中...</h2>
          <p>请稍候，正在导入数据</p>
        </div>

        <div class="import-progress">
          <el-progress
            :percentage="importProgress"
            :status="importStatus"
            :stroke-width="20"
          />
          <p class="progress-message">
            {{ importMessage }}
          </p>

          <div
            v-if="importResult"
            class="import-result"
          >
            <div class="result-stats">
              <div class="stat-item">
                <span class="label">总记录数:</span>
                <span class="value">{{ importResult.total_records }}</span>
              </div>
              <div class="stat-item success">
                <span class="label">已处理:</span>
                <span class="value">{{ importResult.processed }}</span>
              </div>
              <div class="stat-item primary">
                <span class="label">新导入:</span>
                <span class="value">{{ importResult.imported }}</span>
              </div>
              <div class="stat-item info">
                <span class="label">已更新:</span>
                <span class="value">{{ importResult.updated }}</span>
              </div>
              <div class="stat-item warning">
                <span class="label">已跳过:</span>
                <span class="value">{{ importResult.skipped }}</span>
              </div>
              <div
                v-if="importResult.error_count > 0"
                class="stat-item danger"
              >
                <span class="label">错误:</span>
                <span class="value">{{ importResult.error_count }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="step-actions">
          <el-button
            v-if="importStatus === 'success'"
            type="primary"
            @click="resetWizard"
          >
            <i class="fas fa-check" />
            <span>完成</span>
          </el-button>
          <el-button
            v-if="importStatus === 'exception'"
            type="danger"
            @click="resetWizard"
          >
            <i class="fas fa-redo" />
            <span>重新导入</span>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 导入历史对话框 -->
    <MobileDialog
      v-model="showHistoryDialog"
      title="导入历史"
      width="900px"
      dialog-class="data-import-history-dialog"
      :show-default-footer="false"
    >
      <div class="history-content">
        <DataEmptyState
          v-if="importHistory.length === 0"
          description="暂无导入历史"
          size="compact"
        />
        <el-table
          v-else
          :data="importHistory"
          stripe
          class="data-table history-table"
        >
          <el-table-column
            prop="start_time"
            label="导入时间"
            width="170"
          >
            <template #default="{ row }">
              <div class="timestamp-cell">
                <i class="far fa-clock" />
                {{ formatDateTime(row.start_time) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="user_name"
            label="操作人"
            width="100"
          >
            <template #default="{ row }">
              <div class="user-cell">
                <i class="fas fa-user" />
                {{ row.user_name || row.user || '未知' }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            label="数据统计"
            width="280"
          >
            <template #default="{ row }">
              <div class="stats-cell">
                <div class="stat-item">
                  <span class="stat-label">总:</span>
                  <span class="stat-value stat-total">{{ row.total_records }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">新:</span>
                  <span class="stat-value stat-imported">{{ row.imported }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">更:</span>
                  <span class="stat-value stat-updated">{{ row.updated }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">跳:</span>
                  <span class="stat-value stat-skipped">{{ row.skipped }}</span>
                </div>
                <div
                  v-if="row.error_count > 0"
                  class="stat-item"
                >
                  <span class="stat-label">错:</span>
                  <span class="stat-value stat-errors">{{ row.error_count }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="strategy"
            label="策略"
            width="100"
          >
            <template #default="{ row }">
              <el-tag
                :type="getStrategyTagType(row.strategy)"
                size="small"
              >
                {{ getStrategyLabel(row.strategy) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="状态"
            width="80"
          >
            <template #default="{ row }">
              <el-tag
                :type="getStatusTagType(row.status)"
                size="small"
              >
                {{ getStatusLabel(row.status, row.error_count) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showActionColumn"
            label="操作"
            :width="$getActionColumnWidth(1)"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  v-if="canDelete"
                  type="danger"
                  size="small"
                  :icon="Delete"
                  link
                  @click.stop="handleDeleteHistory(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            type="default"
            @click="showHistoryDialog = false"
          >
            关闭
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { computed, ref, onUnmounted } from 'vue'

import { Delete } from '@element-plus/icons-vue'
import { dataImportApi } from '@/api/data-optimization'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import InlineLoading from '@/components/InlineLoading.vue'
import { logger } from '@/utils/logger'
import { formatDate as formatDateTime } from '@/utils/format'
import { getRequestErrorMessage, getRequestErrorStatus } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


let importProgressTimer: ReturnType<typeof setInterval> | null = null

const clearImportProgressTimer = () => {
  if (importProgressTimer) {
    clearInterval(importProgressTimer)
    importProgressTimer = null
  }
}

interface ImportHistoryRecord {
  id: number
  import_id: string
  user_id?: number | null
  user_name?: string
  strategy?: string
  file_name?: string | null
  total_records: number
  processed?: number
  imported: number
  updated: number
  skipped: number
  error_count: number
  status: string
  error_message?: string | null
  start_time?: string | null
  end_time?: string | null
  duration_ms?: number | null
  created_at?: string | null
  updated_at?: string | null
}

interface AnalysisResult {
  total: number
  new_records: number
  duplicate_records: number
  summary: Record<string, number>
  duplicates: Array<{
    row_index: number
    imei?: string
    composite_key?: string
    data: Record<string, unknown>
    existing_record?: { has_sale?: boolean }
    differences?: Record<string, { cloud?: string; excel?: string }>
  }>
}

const { canView, canCreate, canDelete, handleNoPermission } = usePagePermissions('data-optimization')
const showActionColumn = computed(() => shouldShowActionColumn(
  fieldPermissions.isFieldVisible('data_optimization_dataimporttab', 'system_info.operations'),
  [canDelete.value]
))

const ensureViewPermission = () => {
  if (canView.value) {
    return true
  }
  handleNoPermission('view')
  return false
}

const ensureCreatePermission = () => {
  if (canCreate.value) {
    return true
  }
  handleNoPermission('create')
  return false
}

const ensureDeletePermission = () => {
  if (canDelete.value) {
    return true
  }
  handleNoPermission('delete')
  return false
}

const currentStep = ref(1)
const uploadedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const analyzing = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadProgressText = ref('')
const analyzeProgress = ref(0)
const analyzeProgressText = ref('')
const analysisResult = ref<AnalysisResult | null>(null)
const importing = ref(false)
const importProgress = ref(0)
const importStatus = ref<'' | 'success' | 'exception'>('')
const importMessage = ref('')
const importResult = ref<ImportHistoryRecord | null>(null)
const showHistoryDialog = ref(false)
const importHistory = ref<ImportHistoryRecord[]>([])

const strategies: { key: ImportStrategy; label: string; icon: string; description: string; effects?: string[]; recommended?: boolean }[] = [
  {
    key: 'smart',
    label: '智能导入',
    icon: 'fas fa-magic',
    description: 'AI智能判断最佳导入方式',
    effects: [
      '✨ 自动识别销售状态',
      '库存→销售：以本地为准完整更新',
      '已售→库存：保持已售（不降级）',
      '已售→已售：以本地为准完整更新',
      '库存→库存：保持不变',
      '🌟 推荐使用，自动创建缺失数据'
    ],
    recommended: true
  },
  {
    key: 'skip',
    label: '跳过重复',
    icon: 'fas fa-forward',
    description: '保留现有数据，只导入新数据',
    effects: [
      '新记录正常导入',
      '重复记录自动跳过',
      '不会修改现有数据'
    ]
  },
  {
    key: 'overwrite',
    icon: 'fas fa-sync-alt',
    label: '覆盖重复',
    description: '删除重复的旧记录，导入新记录',
    effects: [
      '新记录正常导入',
      '重复记录删除后重新导入',
      '可能丢失历史关联数据'
    ]
  },
  {
    key: 'merge',
    icon: 'fas fa-compress-arrows-alt',
    label: '合并重复',
    description: '保留旧记录，更新新数据',
    effects: [
      '保留现有记录',
      '更新记录信息',
      '维护数据完整性'
    ]
  },
  {
    key: 'replace_all',
    icon: 'fas fa-trash-restore',
    label: '完全替换',
    description: '删除所有旧数据，ID从1开始重新导入',
    effects: [
      '清空所有旧数据',
      '所有ID从1开始',
      '关联数据重新记录',
      '⚠️ 不可逆操作，请谨慎使用'
    ]
  }
]

// 默认选择智能策略
type ImportStrategy = 'smart' | 'skip' | 'overwrite' | 'merge' | 'replace_all'
const selectedStrategy = ref<ImportStrategy>('smart')

// 方法
const handleUploadClick = () => {
  if (!ensureCreatePermission()) {
    return
  }
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  if (!ensureCreatePermission()) {
    return
  }

  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    uploadedFile.value = target.files[0]
  }
}

const handleFileDrop = (event: DragEvent) => {
  if (!ensureCreatePermission()) {
    return
  }

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      uploadedFile.value = file
    } else {
      globalNotifications.error('请上传 Excel 文件')
    }
  }
}

const clearFile = () => {
  if (!ensureCreatePermission()) {
    return
  }

  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const analyzeFile = async () => {
  if (!ensureCreatePermission()) {
    return
  }

  if (!uploadedFile.value) return

  // 重置进度
  uploading.value = true
  uploadProgress.value = 0
  uploadProgressText.value = '准备上传...'

  try {
    // 步骤1: 上传文件

    uploadProgressText.value = '正在上传文件...'
    uploadProgress.value = 30

    const uploadResponse = await dataImportApi.uploadFile(uploadedFile.value)

    uploadProgress.value = 100
    uploadProgressText.value = '文件上传成功！'

    const fileToken = uploadResponse.data.file_token

    // 短暂延迟显示上传完成
    await new Promise(resolve => setTimeout(resolve, 500))

    // 步骤2: 分析数据（带进度）
    uploading.value = false
    analyzing.value = true
    analyzeProgress.value = 0
    analyzeProgressText.value = '正在分析数据...'

    const analyzeResponse = await dataImportApi.analyzeData(fileToken)

    analyzeProgress.value = 100
    analyzeProgressText.value = '数据分析完成！'

    analysisResult.value = analyzeResponse.data

    // 短暂延迟显示分析完成
    await new Promise(resolve => setTimeout(resolve, 500))

    currentStep.value = 2
    globalNotifications.success('数据分析完成！')
  } catch (error: unknown) {
    logger.error('❌ 分析失败:', error)
    const errorMsg = getRequestErrorMessage(error, '未知错误')
    logger.error('错误详情:', errorMsg)
    globalNotifications.error('分析失败: ' + errorMsg)
  } finally {
    uploading.value = false
    analyzing.value = false
  }
}

const startImport = async () => {
  if (!ensureCreatePermission()) {
    return
  }

  if (!uploadedFile.value || !analysisResult.value) {
    return
  }

  // 如果是完全替换策略，需要二次确认
  if (selectedStrategy.value === 'replace_all') {
    try {
      await confirmAction(
        '⚠️  警告：完全替换将删除所有现有数据！\n\n' +
        '此操作将清空以下表的所有数据：\n' +
        '• 销售记录 (sales)\n' +
        '• 手机数据 (phones)\n' +
        '• 客户信息 (customers)\n' +
        '• 店铺信息 (stores)\n' +
        '• 供应商信息 (suppliers)\n' +
        '• 品牌数据 (brands)\n' +
        '• 型号数据 (models)\n' +
        '• 颜色数据 (colors)\n' +
        '• 内存数据 (memories)\n\n' +
        '所有ID将从1开始重新分配，此操作不可撤销！\n\n' +
        '确定要继续吗？',
        '危险操作确认',
        {
          confirmButtonText: '确定继续',
          cancelButtonText: '取消',
          type: 'error',
          distinguishCancelAndClose: false
        }
      )
    } catch (action: unknown) {
      if (action === 'cancel') {
      } else if (action === 'close') {
      } else {
      }
      // 用户取消或关闭对话框
      return
    }
  }

  importing.value = true
  importProgress.value = 0
  importStatus.value = ''
  importMessage.value = '正在导入...'
  importResult.value = null

  currentStep.value = 3

  try {
    const uploadResponse = await dataImportApi.uploadFile(uploadedFile.value)
    const fileToken = uploadResponse.data.file_token

    const importOptions = {
      strategy: selectedStrategy.value
    }

    const importResponse = await dataImportApi.importData(fileToken, importOptions)

    const importId = importResponse.data.import_id

    clearImportProgressTimer()
    importProgressTimer = setInterval(async () => {
      try {
        const progressResponse = await dataImportApi.getProgress(importId)
        const progress = progressResponse.data

        // 确保进度值在 0-100 范围内
        const rawProgress = progress.progress || 0
        importProgress.value = Math.max(0, Math.min(100, parseInt(rawProgress) || 0))
        importMessage.value = progress.message || '导入中...'

        if (progress.status === 'completed') {
          clearImportProgressTimer()
          importStatus.value = 'success'
          importMessage.value = '导入完成'

          // 获取最新的导入历史作为结果
          const history = await dataImportApi.getHistory()
          if (history.data.length > 0) {
            importResult.value = history.data[0]
          }

          // 自动显示导入历史
          importHistory.value = history.data
          showHistoryDialog.value = true

          globalNotifications.success('数据导入成功！')
        } else if (progress.status === 'failed') {
          clearImportProgressTimer()
          importStatus.value = 'exception'
          importMessage.value = '导入失败: ' + (progress.message || '未知错误')
          globalNotifications.error(importMessage.value)
        }
      } catch (error: unknown) {
        // 检查是否是 404 错误（任务不存在）
        if (getRequestErrorStatus(error) === 404) {
          clearImportProgressTimer()

          // 尝试从导入历史中获取结果
          try {
            const history = await dataImportApi.getHistory()
            if (history.data.length > 0) {
              // 检查是否有匹配的导入任务
              const recentTask = history.data.find((h: ImportHistoryRecord) => String(h.import_id) === String(importId))
              if (recentTask) {
                importResult.value = recentTask
                importStatus.value = 'success'
                importMessage.value = '导入已完成'
                importProgress.value = 100
                importHistory.value = history.data
                showHistoryDialog.value = true
                globalNotifications.success('数据导入成功！')
                return
              }
            }
            // 没有找到历史记录，可能真的失败了
            importStatus.value = 'exception'
            importMessage.value = '导入任务不存在，请重新导入'
            globalNotifications.warning('导入任务不存在或已过期，请重新导入')
          } catch (historyError) {
            importStatus.value = 'exception'
            importMessage.value = '无法获取导入状态'
            globalNotifications.error('无法确认导入状态，请检查导入历史')
          }
        } else {
          clearImportProgressTimer()
          importStatus.value = 'exception'
          importMessage.value = '获取进度失败'
        }
      }
    }, 1000)
  } catch (error: unknown) {
    clearImportProgressTimer()
    logger.error('❌ 导入过程出错:', error)
    importStatus.value = 'exception'
    importMessage.value = '导入失败: ' + getRequestErrorMessage(error, '未知错误')
    globalNotifications.error(importMessage.value)
  } finally {
    importing.value = false
  }
}

onUnmounted(() => {
  clearImportProgressTimer()
})

const resetWizard = () => {
  if (!ensureCreatePermission()) {
    return
  }

  currentStep.value = 1
  uploadedFile.value = null
  analysisResult.value = null
  selectedStrategy.value = 'smart'
  importProgress.value = 0
  importStatus.value = ''
  importMessage.value = ''
  importResult.value = null
}

const getImportHistory = async () => {
  if (!ensureViewPermission()) {
    return
  }

  try {
    const response = await dataImportApi.getHistory()
    importHistory.value = response.data
    showHistoryDialog.value = true
  } catch (error: unknown) {
    globalNotifications.error('获取历史失败: ' + getRequestErrorMessage(error, '未知错误'))
  }
}

const getStrategyLabel = (strategy: string) => {
  const strategyMap: Record<string, string> = {
    'smart': '智能导入',
    'skip': '跳过重复',
    'overwrite': '覆盖重复',
    'merge': '合并重复',
    'replace_all': '全部替换'
  }
  return strategyMap[strategy] || strategy
}

type ImportTagType = 'primary' | 'info' | 'warning' | 'success' | 'danger'

const STRATEGY_TAG_TYPES = {
  smart: 'primary',
  skip: 'info',
  overwrite: 'warning',
  merge: 'success',
  replace_all: 'danger'
} as const satisfies Record<string, ImportTagType>

const STATUS_TAG_TYPES = {
  completed: 'success',
  failed: 'danger',
  processing: 'warning'
} as const satisfies Record<string, ImportTagType>

const getStrategyTagType = (strategy: string): ImportTagType => {
  return STRATEGY_TAG_TYPES[strategy as keyof typeof STRATEGY_TAG_TYPES] || 'info'
}

const getStatusLabel = (status: string, errorCount: number = 0) => {
  if (status === 'failed') return '失败'
  if (status === 'processing') return '进行中'
  if (errorCount > 0) return '有错误'
  return '成功'
}

const getStatusTagType = (status: string): ImportTagType => {
  return STATUS_TAG_TYPES[status as keyof typeof STATUS_TAG_TYPES] || 'info'
}

/**
 * 删除导入历史记录
 */
const handleDeleteHistory = async (row: ImportHistoryRecord) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await confirmAction(
      `确定要删除这条导入历史记录吗？\n\n文件名: ${row.file_name}\n导入时间: ${formatDateTime(row.start_time || '')}`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        distinguishCancelAndClose: true
      }
    )

    // 调用删除API
    await dataImportApi.deleteHistory(row.id)

    globalNotifications.success('删除成功')

    // 从列表中移除该记录
    const index = importHistory.value.findIndex(item => item.import_id === row.import_id)
    if (index > -1) {
      importHistory.value.splice(index, 1)
    }
  } catch (error: unknown) {
    if (error !== 'cancel' && error !== 'close') {
      globalNotifications.error('删除失败: ' + getRequestErrorMessage(error, '未知错误'))
    }
  }
}
</script>

<style lang="scss" scoped src="./styles/data-import/upload.scss"></style>
<style lang="scss" scoped src="./styles/data-import/analysis-summary.scss"></style>
<style lang="scss" scoped src="./styles/data-import/duplicates.scss"></style>
<style lang="scss" scoped src="./styles/data-import/strategies.scss"></style>
<style lang="scss" scoped src="./styles/data-import/progress.scss"></style>
<style lang="scss" scoped src="./styles/data-import/history.scss"></style>
