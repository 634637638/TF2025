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
              text="处理中..."
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
              <i :class="strategy.icon" />
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
      :close-on-click-modal="false"
      dialog-class="data-import-history-dialog"
      :show-default-footer="false"
    >
      <div class="history-content">
        <div
          v-if="importHistory.length === 0"
          class="empty-history"
        >
          <i class="fas fa-inbox" />
          <p>暂无导入历史</p>
        </div>
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
        <el-button
          type="default"
          @click="showHistoryDialog = false"
        >
          关闭
        </el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { dataImportApi } from '@/api/data-optimization'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import InlineLoading from '@/components/InlineLoading.vue'
import { logger } from '@/utils/logger'

let importProgressTimer: ReturnType<typeof setInterval> | null = null

const clearImportProgressTimer = () => {
  if (importProgressTimer) {
    clearInterval(importProgressTimer)
    importProgressTimer = null
  }
}

interface ImportHistoryRecord {
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
      ElMessage.error('请上传 Excel 文件')
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
    ElMessage.success('数据分析完成！')
  } catch (error: any) {
    logger.error('❌ 分析失败:', error)
    const errorMsg = error.response?.data?.message || error.message || '未知错误'
    logger.error('错误详情:', errorMsg)
    ElMessage.error('分析失败: ' + errorMsg)
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
      await ElMessageBox.confirm(
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
    } catch (action: any) {
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

          ElMessage.success('数据导入成功！')
        } else if (progress.status === 'failed') {
          clearImportProgressTimer()
          importStatus.value = 'exception'
          importMessage.value = '导入失败: ' + (progress.message || '未知错误')
          ElMessage.error(importMessage.value)
        }
      } catch (error: any) {
        // 检查是否是 404 错误（任务不存在）
        if (error.response?.status === 404) {
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
                ElMessage.success('数据导入成功！')
                return
              }
            }
            // 没有找到历史记录，可能真的失败了
            importStatus.value = 'exception'
            importMessage.value = '导入任务不存在，请重新导入'
            ElMessage.warning('导入任务不存在或已过期，请重新导入')
          } catch (historyError) {
            importStatus.value = 'exception'
            importMessage.value = '无法获取导入状态'
            ElMessage.error('无法确认导入状态，请检查导入历史')
          }
        } else {
          clearImportProgressTimer()
          importStatus.value = 'exception'
          importMessage.value = '获取进度失败'
        }
      }
    }, 1000)
  } catch (error: any) {
    clearImportProgressTimer()
    logger.error('❌ 导入过程出错:', error)
    logger.error('错误详情:', error.response?.data)
    importStatus.value = 'exception'
    importMessage.value = '导入失败: ' + (error.message || '未知错误')
    ElMessage.error(importMessage.value)
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
  } catch (error: any) {
    ElMessage.error('获取历史失败: ' + (error.message || '未知错误'))
  }
}

const formatDateTime = (timestamp: string) => {
  if (!timestamp) return '-'

  try {
    const date = new Date(timestamp)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      logger.warn('无效的日期格式:', timestamp)
      return '-'
    }

    // 只显示年月日（北京时间）
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai'
    }

    return date.toLocaleString('zh-CN', options)
  } catch (error) {
    logger.error('日期格式化失败', { error, timestamp })
    return '-'
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
const handleDeleteHistory = async (row: any) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这条导入历史记录吗？\n\n文件名: ${row.file_name}\n导入时间: ${formatDateTime(row.start_time)}`,
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

    ElMessage.success('删除成功')

    // 从列表中移除该记录
    const index = importHistory.value.findIndex((item: any) => item.id === row.id)
    if (index > -1) {
      importHistory.value.splice(index, 1)
    }
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  }
}
</script>

<style lang="scss" scoped>
.data-import-tab {
  .action-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }

  .import-wizard {
    .wizard-step {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

      .step-header {
        text-align: center;
        margin-bottom: 30px;

        h2 {
          font-size: 20px;
          font-weight: 600;
          color: var(--color-text-primary);
          margin: 0 0 8px 0;
        }

        p {
          font-size: 14px;
          color: var(--color-info);
          margin: 0;
        }
      }

      .step-actions {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 30px;
      }
    }

    .upload-step {
      .upload-area {
        border: 2px dashed var(--color-border);
        border-radius: 8px;
        padding: 60px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: var(--color-primary);
          background: var(--tf-color-surface);
        }

        .upload-content {
          i {
            font-size: 64px;
            color: var(--color-primary);
            margin-bottom: 16px;
          }

          .upload-text {
            font-size: 16px;
            color: var(--color-text-primary);
            margin-bottom: 8px;
          }

          .upload-hint {
            font-size: 14px;
            color: var(--color-info);
            margin: 0;
          }
        }
      }

      .file-info {
        margin-top: 20px;

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--tf-color-surface);
          border-radius: 4px;

          i {
            font-size: 24px;
            color: var(--color-success);
          }

          .file-details {
            flex: 1;
            display: flex;
            flex-direction: column;

            .file-name {
              font-weight: 600;
              color: var(--color-text-primary);
            }

            .file-size {
              font-size: 12px;
              color: var(--color-info);
            }
          }
        }
      }

      // 上传进度条样式
      .upload-progress {
        margin: 20px 0;
        padding: 20px;
        background: var(--tf-color-blue-50);
        border-radius: 8px;
        border: 1px solid var(--tf-color-blue-tailwind-200);

        .progress-text {
          text-align: center;
          margin-top: 12px;
          font-size: 14px;
          color: var(--tf-color-blue-material-700);
          font-weight: 500;
        }
      }

      // 分析进度条样式
      .analysis-progress {
        margin: 20px 0;
        padding: 20px;
        background: var(--tf-color-green-50);
        border-radius: 8px;
        border: 1px solid var(--tf-color-green-200);

        .progress-text {
          text-align: center;
          margin-top: 12px;
          font-size: 14px;
          color: var(--tf-color-green-700);
          font-weight: 500;
        }
      }
    }

    .strategy-step {
      .analysis-result {
        background: var(--tf-color-surface);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;

        .result-summary {
          display: flex;
          justify-content: space-around;
          margin-bottom: 20px;

          .summary-item {
            text-align: center;

            .label {
              display: block;
              font-size: 14px;
              color: var(--color-info);
              margin-bottom: 8px;
            }

            .value {
              display: block;
              font-size: 24px;
              font-weight: 600;
              color: var(--color-text-primary);
            }

            &.success .value {
              color: var(--color-success);
            }

            &.warning .value {
              color: var(--color-warning);
            }
          }
        }

        // 数据统计详情样式
        .data-summary {
          margin-bottom: 24px;

          h3 {
            font-size: 16px;
            font-weight: 600;
            color: var(--color-text-primary);
            margin: 0 0 16px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 16px;

            .summary-stat {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 16px;
              background: white;
              border-radius: 8px;
              border: 1px solid var(--tf-color-border-element);

              i {
                font-size: 24px;
                color: var(--color-primary);
                width: 32px;
                text-align: center;
              }

              .stat-content {
                display: flex;
                flex-direction: column;

                .stat-value {
                  font-size: 20px;
                  font-weight: 600;
                  color: var(--color-text-primary);
                  line-height: 1.2;
                }

                .stat-label {
                  font-size: 12px;
                  color: var(--color-info);
                  margin-top: 4px;
                }
              }
            }
          }
        }

        .duplicates-preview {
          h3 {
            font-size: 16px;
            font-weight: 600;
            color: var(--color-warning);
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          p {
            font-size: 14px;
            color: var(--color-text-regular);
            margin: 0 0 12px 0;
          }

          // 智能提示
          .smart-tip {
            background: linear-gradient(135deg, var(--tf-color-surface-green) 0%, var(--tf-color-orange-material-50) 100%);
            border-left: 4px solid var(--tf-color-purple-material);
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: flex-start;
            gap: 10px;

            i {
              color: var(--tf-color-purple-material);
              font-size: 16px;
              margin-top: 2px;
            }

            span {
              font-weight: 600;
              color: var(--tf-color-purple-material);
            }

            ul {
              margin: 4px 0 0 0;
              padding-left: 20px;
              list-style: none;

              li {
                font-size: 13px;
                color: var(--color-text-regular);
                margin-bottom: 4px;
                line-height: 1.6;
              }
            }
          }

          .duplicates-list {
            background: white;
            border-radius: 8px;
            padding: 16px;
            max-height: 500px;
            overflow-y: auto;
            border: 1px solid var(--tf-color-red-50);

            &.scrollable {
              overflow-y: auto;

              &::-webkit-scrollbar {
                width: 8px;
              }

              &::-webkit-scrollbar-track {
                background: var(--tf-color-gray-100);
                border-radius: 4px;
              }

              &::-webkit-scrollbar-thumb {
                background: var(--tf-color-gray-300);
                border-radius: 4px;

                &:hover {
                  background: var(--tf-color-gray-400);
                }
              }
            }

            .duplicate-item {
              padding: 12px;
              margin-bottom: 12px;
              border-radius: 6px;
              background: var(--tf-color-orange-surface);
              border: 1px solid var(--tf-color-orange-material-100);
              transition: all 0.2s;

              // 云端已售状态
              &.dup-sold {
                background: var(--tf-color-surface-green);
                border-color: var(--tf-color-green-material-200);

                .dup-imei {
                  color: var(--tf-color-green-material-800) !important;
                }

                .duplicate-header {
                  border-bottom-color: var(--tf-color-green-material-200) !important;
                }
              }

              // 云端库存状态
              &.dup-stock {
                background: var(--tf-color-orange-surface);
                border-color: var(--tf-color-orange-material-100);
              }

              &:last-child {
                margin-bottom: 0;
              }

              &:hover {
                background: var(--tf-color-orange-material-50);
                border-color: var(--tf-color-amber-pastel-dark);
              }

              &.expanded {
                .duplicate-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 12px;
                  padding-bottom: 8px;
                  border-bottom: 1px solid var(--tf-color-orange-material-100);

                  .dup-imei {
                    font-weight: 600;
                    color: var(--tf-color-orange-material-900);
                    font-size: 15px;
                    font-family: 'Courier New', monospace;
                  }

                  .dup-row {
                    font-size: 12px;
                    color: var(--tf-color-orange-material-500);
                    background: var(--tf-color-orange-material-50);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: 500;
                  }

                  .dup-cloud-status {
                    font-size: 11px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: 600;

                    &.status-sold {
                      background: var(--tf-status-neutral-bg);
                      color: var(--tf-status-neutral-color);
                      border: 1px solid var(--tf-status-neutral-border);
                    }

                    &.status-stock {
                      background: var(--tf-status-success-bg);
                      color: var(--tf-status-success-color);
                      border: 1px solid var(--tf-status-success-border);
                    }
                  }
                }

                .duplicate-details {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 8px 16px;

                  .detail-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    .detail-label {
                      font-size: 12px;
                      color: var(--color-info);
                      font-weight: 500;
                      min-width: 60px;
                    }

                    .detail-value {
                      font-size: 13px;
                      color: var(--color-text-primary);
                      font-weight: 500;
                      word-break: break-all;
                    }
                  }

                  // 差异显示样式
                  &.diff-details {
                    grid-template-columns: 1fr;
                    gap: 8px;

                    .diff-row {
                      background: var(--tf-color-warning-pale);
                      padding: 8px 12px;
                      border-radius: 4px;
                      border-left: 3px solid var(--warning-color);

                      .detail-label {
                        font-weight: 600;
                        color: var(--tf-color-orange-material-700);
                        min-width: 70px;
                      }

                      .diff-value {
                        display: flex;
                        align-items: center;
                        gap: 12px;

                        .cloud-value {
                          color: var(--tf-color-gray-material-500);
                          text-decoration: line-through;
                          font-size: 12px;
                        }

                        .diff-arrow {
                          color: var(--warning-color);
                          font-size: 12px;
                        }

                        .excel-value {
                          color: var(--tf-color-green-material-800);
                          font-weight: 600;
                          font-size: 13px;
                        }
                      }
                    }
                  }
                }
              }

              .dup-imei {
                font-weight: 600;
                color: var(--color-text-primary);
              }

              .dup-info {
                font-size: 12px;
                color: var(--color-info);
              }
            }

            .more-duplicates {
              text-align: center;
              padding: 8px;
              color: var(--color-info);
              font-size: 14px;
            }
          }
        }
      }

      .strategy-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
        margin-bottom: 24px;

        .strategy-card {
          border: 2px solid var(--color-border-light);
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s;

          &:hover {
            border-color: var(--color-primary);
            transform: translateY(-2px);
          }

          &.selected {
            border-color: var(--color-primary);
            background: var(--tf-color-primary-surface-element);
          }

          // 智能导入策略的特殊样式
          &.strategy-smart {
            border-color: var(--tf-color-purple-material);
            background: linear-gradient(135deg, var(--tf-color-purple-50) 0%, var(--tf-color-amber-material-50) 100%);
            position: relative;
            overflow: hidden;

            &::before {
              content: '🌟 推荐';
              position: absolute;
              top: 8px;
              right: 8px;
              background: linear-gradient(135deg, var(--tf-color-purple-material) 0%, var(--tf-color-orange-material-500) 100%);
              color: white;
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 10px;
              font-weight: 600;
            }

            &:hover {
              border-color: var(--tf-color-purple-material-300);
              box-shadow: 0 4px 20px rgba(156, 39, 176, 0.3);
            }

            &.selected {
              border-color: var(--tf-color-purple-material);
              background: linear-gradient(135deg, var(--tf-color-violet-border-soft) 0%, var(--tf-color-amber-200) 100%);
              box-shadow: 0 4px 20px rgba(156, 39, 176, 0.4);
            }

            .strategy-icon {
              background: linear-gradient(135deg, var(--tf-color-purple-material) 0%, var(--tf-color-orange-material-500) 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
          }

          // 完全替换策略的特殊样式
          &.strategy-replace_all {
            border-color: var(--color-danger);

            &:hover {
              border-color: var(--tf-color-red-element-light);
            }

            &.selected {
              border-color: var(--color-danger);
              background: var(--tf-color-danger-surface-element);
            }

            .strategy-icon {
              color: var(--color-danger);
            }
          }

          // 覆盖重复策略的特殊样式
          &.strategy-overwrite {
            &:hover {
              border-color: var(--color-warning);
            }

            &.selected {
              border-color: var(--color-warning);
              background: var(--tf-color-warning-surface-element);
            }

            .strategy-icon {
              color: var(--color-warning);
            }
          }

          // 合并重复策略的特殊样式
          &.strategy-merge {
            &:hover {
              border-color: var(--color-success);
            }

            &.selected {
              border-color: var(--color-success);
              background: var(--tf-color-blue-50);
            }

            .strategy-icon {
              color: var(--color-success);
            }
          }

          .strategy-icon {
            font-size: 32px;
            color: var(--color-primary);
            margin-bottom: 12px;
          }

          .strategy-content {
            h3 {
              font-size: 18px;
              font-weight: 600;
              color: var(--color-text-primary);
              margin: 0 0 8px 0;
            }

            p {
              font-size: 14px;
              color: var(--color-text-regular);
              margin: 0 0 12px 0;
            }

            .strategy-effects {
              list-style: none;
              padding: 0;
              margin: 0;

              li {
                font-size: 12px;
                color: var(--color-info);
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;

                i {
                  color: var(--color-success);
                }
              }
            }
          }
        }
      }
    }

    .progress-step {
      .import-progress {
        text-align: center;

        .progress-message {
          font-size: 16px;
          color: var(--color-text-regular);
          margin: 20px 0;
        }

        .import-result {
          background: var(--tf-color-surface);
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;

          .result-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;

            .stat-item {
              text-align: center;

              .label {
                display: block;
                font-size: 14px;
                color: var(--color-info);
                margin-bottom: 8px;
              }

              .value {
                display: block;
                font-size: 24px;
                font-weight: 600;
              }

              &.success .value {
                color: var(--color-success);
              }

              &.primary .value {
                color: var(--color-primary);
              }

              &.info .value {
                color: var(--color-info);
              }

              &.warning .value {
                color: var(--color-warning);
              }

              &.danger .value {
                color: var(--color-danger);
              }
            }
          }
        }
      }
    }
  }
}

// 导入历史对话框样式
.history-content {
  .empty-history {
    text-align: center;
    padding: 60px 20px;
    color: var(--color-info);

    i {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    p {
      font-size: 16px;
      margin: 0;
    }
  }

  .history-table {
    .timestamp-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      i {
        color: var(--color-info);
      }
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      i {
        color: var(--color-primary);
      }
    }

    .stats-cell {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 4px 0;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 12px;

        .stat-label {
          color: var(--color-info);
        }

        .stat-value {
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;

          &.stat-total {
            background: var(--tf-color-surface-ant);
            color: var(--color-text-regular);
          }

          &.stat-imported {
            background: var(--tf-color-blue-50);
            color: var(--color-primary);
          }

          &.stat-updated {
            background: var(--tf-color-orange-ant-surface);
            color: var(--color-warning);
          }

          &.stat-skipped {
            background: var(--tf-color-zinc-100);
            color: var(--color-info);
          }

          &.stat-errors {
            background: var(--tf-color-danger-surface-element);
            color: var(--color-danger);
          }
        }
      }
    }
  }
}
</style>
