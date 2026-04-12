<template>
  <div class="data-import-tab">
    <!-- 操作按钮 -->
    <div class="action-bar">
      <el-button type="info" @click="getImportHistory">
        <i class="fas fa-history"></i>
        <span>导入历史</span>
      </el-button>
    </div>

    <!-- 导入向导 -->
    <div class="import-wizard">
      <!-- 步骤1：上传文件 -->
      <div v-if="currentStep === 1" class="wizard-step upload-step">
        <div class="step-header">
          <h2>步骤 1: 上传Excel文件</h2>
          <p>请选择包含销售记录的Excel文件（.xls 或 .xlsx）</p>
        </div>

        <div class="upload-area" @click="handleUploadClick" @dragover.prevent @drop.prevent="handleFileDrop">
          <input
            ref="fileInput"
            type="file"
            accept=".xls,.xlsx"
            style="display: none"
            @change="handleFileSelect"
          />
          <div class="upload-content">
            <i class="fas fa-cloud-upload-alt"></i>
            <p class="upload-text">点击或拖拽文件到此处上传</p>
            <p class="upload-hint">支持 .xls 和 .xlsx 格式，文件大小不超过 50MB</p>
          </div>
        </div>

        <div v-if="uploadedFile" class="file-info">
          <div class="file-item">
            <i class="fas fa-file-excel"></i>
            <div class="file-details">
              <span class="file-name">{{ uploadedFile.name }}</span>
              <span class="file-size">{{ formatFileSize(uploadedFile.size) }}</span>
            </div>
            <el-button type="danger" size="small" @click="clearFile">
              <i class="fas fa-times"></i>
            </el-button>
          </div>
        </div>

        <!-- 上传进度 -->
        <div v-if="uploading" class="upload-progress">
          <el-progress :percentage="uploadProgress" :stroke-width="20" />
          <p class="progress-text">{{ uploadProgressText }}</p>
        </div>

        <!-- 分析进度 -->
        <div v-if="analyzing" class="analysis-progress">
          <el-progress :percentage="analyzeProgress" :stroke-width="20" status="success" />
          <p class="progress-text">{{ analyzeProgressText }}</p>
        </div>

        <div class="step-actions">
          <el-button
            type="primary"
            @click="analyzeFile"
            :disabled="!uploadedFile || uploading || analyzing"
          >
            <i :class="uploading || analyzing ? 'fas fa-spinner fa-spin' : 'fas fa-search'"></i>
            <span>{{ uploading || analyzing ? '处理中...' : '分析数据' }}</span>
          </el-button>
        </div>
      </div>

      <!-- 步骤2：选择导入策略 -->
      <div v-if="currentStep === 2 && analysisResult" class="wizard-step strategy-step">
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
              <span class="value">{{ analysisResult.newRecords }}</span>
            </div>
            <div class="summary-item warning">
              <span class="label">重复记录:</span>
              <span class="value">{{ analysisResult.duplicateRecords }}</span>
            </div>
          </div>

          <!-- 数据统计详情 -->
          <div v-if="analysisResult.summary && Object.keys(analysisResult.summary).length > 0" class="data-summary">
            <h3>
              <i class="fas fa-chart-bar"></i>
              数据统计
            </h3>
            <div class="summary-grid">
              <div v-if="analysisResult.summary.brands" class="summary-stat">
                <i class="fas fa-tag"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.brands }}</span>
                  <span class="stat-label">品牌</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.models" class="summary-stat">
                <i class="fas fa-mobile-alt"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.models }}</span>
                  <span class="stat-label">型号</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.colors" class="summary-stat">
                <i class="fas fa-palette"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.colors }}</span>
                  <span class="stat-label">颜色</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.memories" class="summary-stat">
                <i class="fas fa-memory"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.memories }}</span>
                  <span class="stat-label">内存</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.suppliers" class="summary-stat">
                <i class="fas fa-truck"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.suppliers }}</span>
                  <span class="stat-label">供应商</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.stores" class="summary-stat">
                <i class="fas fa-store"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.stores }}</span>
                  <span class="stat-label">店铺</span>
                </div>
              </div>
              <div v-if="analysisResult.summary.customers" class="summary-stat">
                <i class="fas fa-users"></i>
                <div class="stat-content">
                  <span class="stat-value">{{ analysisResult.summary.customers }}</span>
                  <span class="stat-label">客户</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="analysisResult.duplicates.length > 0" class="duplicates-preview">
            <h3>
              <i class="fas fa-exclamation-triangle"></i>
              差异数据预览 ({{ analysisResult.duplicates.length }} 条有变化)
            </h3>
            <p>以下数据与云端存在差异，只显示有变化的字段：</p>
            <div class="smart-tip">
              <i class="fas fa-lightbulb"></i>
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
                :class="{ 'dup-sold': dup.existingRecord?.hasSale, 'dup-stock': !dup.existingRecord?.hasSale }"
              >
                <div class="duplicate-header">
                  <span class="dup-imei">{{ dup.imei || dup.compositeKey.split('|')[2] || '未知' }}</span>
                  <span class="dup-row">Excel 第 {{ dup.rowIndex }} 行</span>
                  <span class="dup-cloud-status" :class="dup.existingRecord?.hasSale ? 'status-sold' : 'status-stock'">
                    {{ dup.existingRecord?.hasSale ? '云端: 已售' : '云端: 库存' }}
                  </span>
                </div>

                <!-- 显示有差异的字段 -->
                <div v-if="dup.differences && Object.keys(dup.differences).length > 0" class="duplicate-details diff-details">
                  <div v-for="(diff, field) in dup.differences" :key="field" class="detail-row diff-row">
                    <span class="detail-label">{{ field }}:</span>
                    <span class="detail-value diff-value">
                      <span class="cloud-value">{{ diff.cloud || '-' }}</span>
                      <i class="fas fa-arrow-right diff-arrow"></i>
                      <span class="excel-value">{{ diff.excel || '-' }}</span>
                    </span>
                  </div>
                </div>

                <!-- 如果没有差异但云端已售，显示基本信息 -->
                <div v-else class="duplicate-details">
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
              <i :class="strategy.icon"></i>
            </div>
            <div class="strategy-content">
              <h3>{{ strategy.label }}</h3>
              <p>{{ strategy.description }}</p>
              <ul v-if="strategy.effects" class="strategy-effects">
                <li v-for="(effect, index) in strategy.effects" :key="index">
                  <i class="fas fa-check"></i>
                  {{ effect }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="step-actions">
          <el-button type="info" @click="currentStep = 1">
            <i class="fas fa-arrow-left"></i>
            <span>上一步</span>
          </el-button>
          <el-button
            type="primary"
            @click="startImport"
            :disabled="!selectedStrategy || importing"
          >
            <i :class="importing ? 'fas fa-spinner fa-spin' : 'fas fa-play'"></i>
            <span>开始导入</span>
          </el-button>
        </div>
      </div>

      <!-- 步骤3：导入进度 -->
      <div v-if="currentStep === 3" class="wizard-step progress-step">
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
          <p class="progress-message">{{ importMessage }}</p>

          <div v-if="importResult" class="import-result">
            <div class="result-stats">
              <div class="stat-item">
                <span class="label">总记录数:</span>
                <span class="value">{{ importResult.total }}</span>
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
              <div class="stat-item danger" v-if="importResult.errors > 0">
                <span class="label">错误:</span>
                <span class="value">{{ importResult.errors }}</span>
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
            <i class="fas fa-check"></i>
            <span>完成</span>
          </el-button>
          <el-button
            v-if="importStatus === 'exception'"
            type="danger"
            @click="resetWizard"
          >
            <i class="fas fa-redo"></i>
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
        <div v-if="importHistory.length === 0" class="empty-history">
          <i class="fas fa-inbox"></i>
          <p>暂无导入历史</p>
        </div>
        <el-table v-else :data="importHistory" stripe class="history-table">
          <el-table-column prop="created_at" label="导入时间" width="170">
            <template #default="{ row }">
              <div class="timestamp-cell">
                <i class="far fa-clock"></i>
                {{ formatDateTime(row.start_time || row.created_at) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="user_name" label="操作人" width="100">
            <template #default="{ row }">
              <div class="user-cell">
                <i class="fas fa-user"></i>
                {{ row.user_name || row.user || '未知' }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="数据统计" width="280">
            <template #default="{ row }">
              <div class="stats-cell">
                <div class="stat-item">
                  <span class="stat-label">总:</span>
                  <span class="stat-value stat-total">{{ row.total_records || row.total }}</span>
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
                <div v-if="row.error_count > 0" class="stat-item">
                  <span class="stat-label">错:</span>
                  <span class="stat-value stat-errors">{{ row.error_count }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="strategy" label="策略" width="100">
            <template #default="{ row }">
              <el-tag :type="getStrategyTagType(row.strategy)" size="small">
                {{ getStrategyLabel(row.strategy) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">
                {{ getStatusLabel(row.status, row.error_count) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                @click="handleDeleteHistory(row)"
                link
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button type="default" @click="showHistoryDialog = false">关闭</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { dataImportApi } from '@/api/data-optimization'
import { usePagePermissions } from '@/composables/usePagePermissions'

const { canView, canCreate, canDelete, handleNoPermission } = usePagePermissions('data-optimization')

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
const analysisResult = ref<any>(null)
const importing = ref(false)
const importProgress = ref(0)
const importStatus = ref<any>('')
const importMessage = ref('')
const importResult = ref<any>(null)
const showHistoryDialog = ref(false)
const importHistory = ref<any[]>([])

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

    const filePath = uploadResponse.data.filePath

    // 短暂延迟显示上传完成
    await new Promise(resolve => setTimeout(resolve, 500))

    // 步骤2: 分析数据（带进度）
    uploading.value = false
    analyzing.value = true
    analyzeProgress.value = 0
    analyzeProgressText.value = '正在分析数据...'

    // 模拟分析进度（因为后端是阻塞的）
    const progressInterval = setInterval(() => {
      if (analyzeProgress.value < 90) {
        analyzeProgress.value += 5
        analyzeProgressText.value = `正在分析数据... ${analyzeProgress.value}%`
      }
    }, 100)

    const analyzeResponse = await dataImportApi.analyzeData(filePath)

    clearInterval(progressInterval)
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
    const filePath = uploadResponse.data.filePath

    const importOptions = {
      strategy: selectedStrategy.value,
      importId: Date.now()
    }

    // 构建完整的请求体
    const requestBody = { filePath, options: importOptions }

    const importResponse = await dataImportApi.importData(filePath, importOptions)

    const importId = importResponse.data.importId

    const checkProgress = setInterval(async () => {
      try {
        const progressResponse = await dataImportApi.getProgress(importId)
        const progress = progressResponse.data

        // 确保进度值在 0-100 范围内
        const rawProgress = progress.progress || 0
        importProgress.value = Math.max(0, Math.min(100, parseInt(rawProgress) || 0))
        importMessage.value = progress.message || '导入中...'

        if (progress.status === 'completed') {
          clearInterval(checkProgress)
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
          clearInterval(checkProgress)
          importStatus.value = 'exception'
          importMessage.value = '导入失败: ' + (progress.message || '未知错误')
          ElMessage.error(importMessage.value)
        }
      } catch (error: any) {
        // 检查是否是 404 错误（任务不存在）
        if (error.response?.status === 404) {
          clearInterval(checkProgress)

          // 尝试从导入历史中获取结果
          try {
            const history = await dataImportApi.getHistory()
            if (history.data.length > 0) {
              // 检查是否有匹配的导入任务
              const recentTask = history.data.find((h: any) => h.importId == importId)
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
          clearInterval(checkProgress)
          importStatus.value = 'exception'
          importMessage.value = '获取进度失败'
        }
      }
    }, 1000)
  } catch (error: any) {
    logger.error('❌ 导入过程出错:', error)
    logger.error('错误详情:', error.response?.data)
    importStatus.value = 'exception'
    importMessage.value = '导入失败: ' + (error.message || '未知错误')
    ElMessage.error(importMessage.value)
  } finally {
    importing.value = false
  }
}

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
    logger.error('日期格式化失败:', error, timestamp)
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
      `确定要删除这条导入历史记录吗？\n\n文件名: ${row.file_name}\n导入时间: ${formatDateTime(row.start_time || row.created_at)}`,
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
          color: #303133;
          margin: 0 0 8px 0;
        }

        p {
          font-size: 14px;
          color: #909399;
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
        border: 2px dashed #dcdfe6;
        border-radius: 8px;
        padding: 60px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          background: #f5f7fa;
        }

        .upload-content {
          i {
            font-size: 64px;
            color: #409eff;
            margin-bottom: 16px;
          }

          .upload-text {
            font-size: 16px;
            color: #303133;
            margin-bottom: 8px;
          }

          .upload-hint {
            font-size: 14px;
            color: #909399;
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
          background: #f5f7fa;
          border-radius: 4px;

          i {
            font-size: 24px;
            color: #67c23a;
          }

          .file-details {
            flex: 1;
            display: flex;
            flex-direction: column;

            .file-name {
              font-weight: 600;
              color: #303133;
            }

            .file-size {
              font-size: 12px;
              color: #909399;
            }
          }
        }
      }

      // 上传进度条样式
      .upload-progress {
        margin: 20px 0;
        padding: 20px;
        background: #f0f9ff;
        border-radius: 8px;
        border: 1px solid #bfdbfe;

        .progress-text {
          text-align: center;
          margin-top: 12px;
          font-size: 14px;
          color: #1976d2;
          font-weight: 500;
        }
      }

      // 分析进度条样式
      .analysis-progress {
        margin: 20px 0;
        padding: 20px;
        background: #f0fdf4;
        border-radius: 8px;
        border: 1px solid #bbf7d0;

        .progress-text {
          text-align: center;
          margin-top: 12px;
          font-size: 14px;
          color: #15803d;
          font-weight: 500;
        }
      }
    }

    .strategy-step {
      .analysis-result {
        background: #f5f7fa;
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
              color: #909399;
              margin-bottom: 8px;
            }

            .value {
              display: block;
              font-size: 24px;
              font-weight: 600;
              color: #303133;
            }

            &.success .value {
              color: #67c23a;
            }

            &.warning .value {
              color: #e6a23c;
            }
          }
        }

        // 数据统计详情样式
        .data-summary {
          margin-bottom: 24px;

          h3 {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
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
              border: 1px solid #e4e7ed;

              i {
                font-size: 24px;
                color: #409eff;
                width: 32px;
                text-align: center;
              }

              .stat-content {
                display: flex;
                flex-direction: column;

                .stat-value {
                  font-size: 20px;
                  font-weight: 600;
                  color: #303133;
                  line-height: 1.2;
                }

                .stat-label {
                  font-size: 12px;
                  color: #909399;
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
            color: #e6a23c;
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          p {
            font-size: 14px;
            color: #606266;
            margin: 0 0 12px 0;
          }

          // 智能提示
          .smart-tip {
            background: linear-gradient(135deg, #e8f5e9 0%, #fff3e0 100%);
            border-left: 4px solid #9c27b0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: flex-start;
            gap: 10px;

            i {
              color: #9c27b0;
              font-size: 16px;
              margin-top: 2px;
            }

            span {
              font-weight: 600;
              color: #9c27b0;
            }

            ul {
              margin: 4px 0 0 0;
              padding-left: 20px;
              list-style: none;

              li {
                font-size: 13px;
                color: #606266;
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
            border: 1px solid #ffebee;

            &.scrollable {
              overflow-y: auto;

              &::-webkit-scrollbar {
                width: 8px;
              }

              &::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
              }

              &::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;

                &:hover {
                  background: #a8a8a8;
                }
              }
            }

            .duplicate-item {
              padding: 12px;
              margin-bottom: 12px;
              border-radius: 6px;
              background: #fff8f0;
              border: 1px solid #ffe0b2;
              transition: all 0.2s;

              // 云端已售状态
              &.dup-sold {
                background: #e8f5e9;
                border-color: #a5d6a7;

                .dup-imei {
                  color: #2e7d32 !important;
                }

                .duplicate-header {
                  border-bottom-color: #a5d6a7 !important;
                }
              }

              // 云端库存状态
              &.dup-stock {
                background: #fff8f0;
                border-color: #ffe0b2;
              }

              &:last-child {
                margin-bottom: 0;
              }

              &:hover {
                background: #fff3e0;
                border-color: #ffcc80;
              }

              &.expanded {
                .duplicate-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 12px;
                  padding-bottom: 8px;
                  border-bottom: 1px solid #ffe0b2;

                  .dup-imei {
                    font-weight: 600;
                    color: #e65100;
                    font-size: 15px;
                    font-family: 'Courier New', monospace;
                  }

                  .dup-row {
                    font-size: 12px;
                    color: #ff9800;
                    background: #fff3e0;
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
                      background: #c8e6c9;
                      color: #2e7d32;
                    }

                    &.status-stock {
                      background: #ffe0b2;
                      color: #e65100;
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
                      color: #909399;
                      font-weight: 500;
                      min-width: 60px;
                    }

                    .detail-value {
                      font-size: 13px;
                      color: #303133;
                      font-weight: 500;
                      word-break: break-all;
                    }
                  }

                  // 差异显示样式
                  &.diff-details {
                    grid-template-columns: 1fr;
                    gap: 8px;

                    .diff-row {
                      background: #fff9e6;
                      padding: 8px 12px;
                      border-radius: 4px;
                      border-left: 3px solid #ffc107;

                      .detail-label {
                        font-weight: 600;
                        color: #f57c00;
                        min-width: 70px;
                      }

                      .diff-value {
                        display: flex;
                        align-items: center;
                        gap: 12px;

                        .cloud-value {
                          color: #9e9e9e;
                          text-decoration: line-through;
                          font-size: 12px;
                        }

                        .diff-arrow {
                          color: #ffc107;
                          font-size: 12px;
                        }

                        .excel-value {
                          color: #2e7d32;
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
                color: #303133;
              }

              .dup-info {
                font-size: 12px;
                color: #909399;
              }
            }

            .more-duplicates {
              text-align: center;
              padding: 8px;
              color: #909399;
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
          border: 2px solid #ebeef5;
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s;

          &:hover {
            border-color: #409eff;
            transform: translateY(-2px);
          }

          &.selected {
            border-color: #409eff;
            background: #ecf5ff;
          }

          // 智能导入策略的特殊样式
          &.strategy-smart {
            border-color: #9c27b0;
            background: linear-gradient(135deg, #f3e5f5 0%, #fff8e1 100%);
            position: relative;
            overflow: hidden;

            &::before {
              content: '🌟 推荐';
              position: absolute;
              top: 8px;
              right: 8px;
              background: linear-gradient(135deg, #9c27b0 0%, #ff9800 100%);
              color: white;
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 10px;
              font-weight: 600;
            }

            &:hover {
              border-color: #ba68c8;
              box-shadow: 0 4px 20px rgba(156, 39, 176, 0.3);
            }

            &.selected {
              border-color: #9c27b0;
              background: linear-gradient(135deg, #e1bee7 0%, #ffe082 100%);
              box-shadow: 0 4px 20px rgba(156, 39, 176, 0.4);
            }

            .strategy-icon {
              background: linear-gradient(135deg, #9c27b0 0%, #ff9800 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
          }

          // 完全替换策略的特殊样式
          &.strategy-replace_all {
            border-color: #f56c6c;

            &:hover {
              border-color: #f78989;
            }

            &.selected {
              border-color: #f56c6c;
              background: #fef0f0;
            }

            .strategy-icon {
              color: #f56c6c;
            }
          }

          // 覆盖重复策略的特殊样式
          &.strategy-overwrite {
            &:hover {
              border-color: #e6a23c;
            }

            &.selected {
              border-color: #e6a23c;
              background: #fdf6ec;
            }

            .strategy-icon {
              color: #e6a23c;
            }
          }

          // 合并重复策略的特殊样式
          &.strategy-merge {
            &:hover {
              border-color: #67c23a;
            }

            &.selected {
              border-color: #67c23a;
              background: #f0f9ff;
            }

            .strategy-icon {
              color: #67c23a;
            }
          }

          .strategy-icon {
            font-size: 32px;
            color: #409eff;
            margin-bottom: 12px;
          }

          .strategy-content {
            h3 {
              font-size: 18px;
              font-weight: 600;
              color: #303133;
              margin: 0 0 8px 0;
            }

            p {
              font-size: 14px;
              color: #606266;
              margin: 0 0 12px 0;
            }

            .strategy-effects {
              list-style: none;
              padding: 0;
              margin: 0;

              li {
                font-size: 12px;
                color: #909399;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;

                i {
                  color: #67c23a;
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
          color: #606266;
          margin: 20px 0;
        }

        .import-result {
          background: #f5f7fa;
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
                color: #909399;
                margin-bottom: 8px;
              }

              .value {
                display: block;
                font-size: 24px;
                font-weight: 600;
              }

              &.success .value {
                color: #67c23a;
              }

              &.primary .value {
                color: #409eff;
              }

              &.info .value {
                color: #909399;
              }

              &.warning .value {
                color: #e6a23c;
              }

              &.danger .value {
                color: #f56c6c;
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
    color: #909399;

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
        color: #909399;
      }
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      i {
        color: #409eff;
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
          color: #909399;
        }

        .stat-value {
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;

          &.stat-total {
            background: #f0f2f5;
            color: #606266;
          }

          &.stat-imported {
            background: #f0f9ff;
            color: #409eff;
          }

          &.stat-updated {
            background: #fff7e6;
            color: #e6a23c;
          }

          &.stat-skipped {
            background: #f4f4f5;
            color: #909399;
          }

          &.stat-errors {
            background: #fef0f0;
            color: #f56c6c;
          }
        }
      }
    }
  }
}
</style>
