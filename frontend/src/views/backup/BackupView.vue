<template>
  <div class="backup-management admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="backup"
      module-name="备份管理"
      permission-code="backup:view"
    >
      <!-- 主内容 -->
      <PageHeader
        icon="fas fa-database"
        title="备份管理"
      >
        <template #actions>
          <el-button
            v-permission="'backup:view'"
            class="tf-button--manage"
            @click="cloudManagementVisible = true"
          >
            云盘管理
          </el-button>
          <el-button
            v-permission="'backup:create'"
            class="tf-button--manage"
            @click="cloudSettingsVisible = true"
          >
            云盘设置
          </el-button>
          <el-button
            v-if="canCreate"
            type="primary"
            :loading="isCreating"
            @click="createDialogVisible = true"
          >
            <span v-if="isCreating">备份中...</span>
            <template v-else>
              <i class="fas fa-plus" />
              <span>创建备份</span>
            </template>
          </el-button>
          <el-button
            v-if="showActionColumn"
            type="info"
            plain
            @click="loadBackupList"
          >
            <i class="fas fa-sync-alt" />
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="backup-container admin-page-content">
        <!-- 存储信息卡片 -->
        <div class="storage-info-card">
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-hdd" />
            </div>
            <div class="info-content">
              <span class="info-label">备份总数</span>
              <span class="info-value">{{ storageInfo.total_count || 0 }} 份</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-weight" />
            </div>
            <div class="info-content">
              <span class="info-label">占用空间</span>
              <span class="info-value">{{ storageInfo.total_size || '0 KB' }}</span>
            </div>
          </div>
          <div class="info-item info-item-path">
            <div class="info-icon">
              <i class="fas fa-folder-open" />
            </div>
            <div class="info-content">
              <span class="info-label">服务器备份目录</span>
              <span class="info-value info-path">{{ storageInfo.backup_dir || '-' }}</span>
            </div>
          </div>
          <div class="info-actions">
            <el-button
              v-if="showActionColumn && canDelete"
              v-permission="'backup:delete'"
              native-type="button"
              type="warning"
              size="small"
              plain
              :disabled="isLoading || isCleaningUp || backupList.length === 0"
              :title="backupList.length === 0 ? '暂无本地备份可清理' : '按保留数量清理服务器本地旧备份'"
              @click="showCleanupDialog"
            >
              <i class="fas fa-broom" />
              清理旧备份
            </el-button>
          </div>
        </div>

        <el-alert
          v-if="cloudError"
          :title="cloudError"
          type="warning"
          :closable="false"
          show-icon
        />

        <!-- 备份列表 -->
        <div class="backup-list-card">
          <div class="card-header">
            <h3>
              <i class="fas fa-list" />
              备份列表
            </h3>
          </div>

          <el-table
            v-tf-loading="{ active: isLoading, text: '正在刷新备份列表...' }"
            class="data-table"
            :data="backupList"
            border
            stripe
            style="width: 100%"
          >
            <template #empty>
              <TableLoadingRow
                v-if="isLoading"
                mode="block"
                text="正在读取备份列表..."
              />
              <DataEmptyState
                v-else
                description="暂无备份记录"
              >
                <el-button
                  v-if="canCreate"
                  type="primary"
                  @click="createDialogVisible = true"
                >
                  <i class="fas fa-plus" />
                  创建第一个备份
                </el-button>
              </DataEmptyState>
            </template>

            <el-table-column
              v-if="canViewField('backup.name')"
              prop="filename"
              label="文件名"
              min-width="280"
            >
              <template #default="{ row }">
                <div class="filename-cell">
                  <i class="fas fa-file-archive" />
                  <span>{{ row.filename }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="备份类型"
              width="130"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.type === 'database' ? 'success' : 'primary'"
                  size="small"
                >
                  {{ row.type === 'database' ? '仅数据库' : '完整备份' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('backup.size')"
              prop="size"
              label="大小"
              width="120"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="backupSizeType(row.size_bytes)"
                  size="small"
                >
                  {{ row.size }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('backup.created_at')"
              prop="created_at"
              label="创建时间"
              width="180"
              align="center"
            >
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column
              label="云盘备份"
              min-width="180"
              class-name="complete-text-column"
            >
              <template #default="{ row }">
                <el-tag :type="cloudStatusType(cloudTask(row.filename)?.status)">
                  {{ cloudStatusText(cloudTask(row.filename)) }}
                </el-tag>
                <div
                  v-if="cloudTask(row.filename)?.error"
                  class="cloud-error"
                  :class="{ 'cloud-error--invalid': cloudTask(row.filename)?.status === 'invalid' }"
                >
                  {{ cloudTask(row.filename)?.error }}
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="showActionColumn"
              label="操作"
              :width="$getActionColumnWidth(['下载中', ...(canCreate ? ['上传云盘'] : []), ...(canDelete ? ['删除'] : [])])"
              align="center"
              class-name="actions-column"
            >
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    v-if="canCreate"
                    v-permission="'backup:create'"
                    class="table-action table-action--manage"
                    :disabled="cloudActive(row.filename) || cloudTask(row.filename)?.status === 'success'"
                    :loading="cloudEnqueueing === row.filename"
                    @click.stop="uploadToCloud(row.filename)"
                  >
                    上传云盘
                  </el-button>
                  <el-button
                    type="primary"
                    size="small"
                    link
                    :loading="downloadingFilename === row.filename"
                    :disabled="downloadingFilename !== null && downloadingFilename !== row.filename"
                    @click.stop="downloadBackup(row.filename)"
                  >
                    <span v-if="downloadingFilename === row.filename">下载中</span>
                    <template v-else>
                      <i class="fas fa-download" />
                      下载
                    </template>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    link
                    :disabled="cloudActive(row.filename)"
                    @click.stop="confirmDelete(row.filename)"
                  >
                    <i class="fas fa-trash" />
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 空状态由表格 empty 插槽统一处理 -->
        </div>
      </div>
    </PermissionGate>

    <CloudBackupSettingsDialog
      v-model="cloudSettingsVisible"
      @saved="loadCloudTasks"
    />
    <CloudBackupSettingsDialog
      v-model="cloudManagementVisible"
      manage-only
      @saved="loadCloudTasks"
    />

    <MobileDialog
      v-model="createDialogVisible"
      :show-default-footer="false"
      title="创建备份"
      width="520px"
      dialog-class="backup-create-dialog"
      :close-on-click-modal="false"
    >
      <el-radio-group
        v-model="backupType"
        class="backup-type-options"
      >
        <el-radio
          value="database"
          border
          class="backup-type-option"
        >
          <span class="backup-type-title">仅备份数据库</span>
          <span class="backup-type-description">导出当前配置连接的 MySQL 数据库，生成 SQL 文件。</span>
        </el-radio>
        <el-radio
          value="full"
          border
          class="backup-type-option"
        >
          <span class="backup-type-title">完整备份</span>
          <span class="backup-type-description">包含数据库、后端代码和上传文件，生成 ZIP 压缩包。</span>
        </el-radio>
      </el-radio-group>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            :disabled="isCreating"
            @click="createDialogVisible = false"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="isCreating"
            @click="createBackup"
          >
            {{ backupType === 'database' ? '创建数据库备份' : '创建完整备份' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 清理对话框 -->
    <MobileDialog
      v-model="cleanupDialogVisible"
      :show-default-footer="false"
      title="清理旧备份"
      width="400px"
      dialog-class="backup-cleanup-dialog"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-alert
          title="仅清理服务器本地备份，云盘文件不受影响。保留数量不少于现有份数时，不会删除文件。"
          type="info"
          :closable="false"
          show-icon
        />
        <el-form-item
          v-if="canViewField('backup.keep_count')"
          label="保留数量"
        >
          <el-input-number
            v-model="keepCount"
            :min="1"
            :max="20"
            :controls="false"
          />
          <span class="form-tip">保留最近的 {{ keepCount }} 份备份</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button @click="cleanupDialogVisible = false">
            取消
          </el-button>
          <el-button
            type="warning"
            :loading="isCleaningUp"
            @click="cleanupBackups"
          >
            确认清理
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { PermissionGate, PageHeader } from '@/components/base'
import { formatDateTime as formatGlobalDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { getRequestErrorMessage } from '@/utils/api-response'
import { backupCloudApi } from '@/api/backup'
import type { BackupFile, CloudBackupStatus, CloudBackupTask } from '@/types/backup'
import CloudBackupSettingsDialog from './CloudBackupSettingsDialog.vue'

const { success, error, loading } = useNotification()

// 权限
const { canView, canCreate, canDelete, requirePermission } = usePagePermissions('backup')
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible('backup_backupview', fieldKey)
const showActionColumn = computed(() => shouldShowActionColumn(
  fieldPermissions.isFieldVisible('backup_backupview', 'system_info.operations'),
  [canCreate.value, canDelete.value]
))

// 状态
const isLoading = ref(false)
const isCreating = ref(false)
const isCleaningUp = ref(false)
const downloadingFilename = ref<string | null>(null)
const cloudSettingsVisible = ref(false)
const cloudManagementVisible = ref(false)
const cloudTasks = ref<CloudBackupTask[]>([])
const cloudError = ref('')
const cloudEnqueueing = ref<string | null>(null)
let cloudTimer: ReturnType<typeof setTimeout> | undefined
const cloudRequest = useLatestRequest()
let pageDisposed = false
const cloudTask = (filename: string) => cloudTasks.value.find(task => task.filename === filename)
const cloudActive = (filename: string) => ['queued', 'uploading', 'retrying'].includes(cloudTask(filename)?.status || '')
const cloudStatusText = (task?: CloudBackupTask) => {
  if (!task) return '未上传'
  const labels: Record<CloudBackupStatus, string> = {
    queued: '等待上传', uploading: `上传中 ${task.progress}%`, retrying: '等待重试', success: '已上传', failed: '上传失败', invalid: '文件失效'
  }
  return labels[task.status]
}
const cloudStatusType = (status?: CloudBackupStatus): 'success' | 'danger' | 'warning' | 'info' =>
  status === 'success' ? 'success' : status === 'failed' ? 'danger' : status === 'retrying' || status === 'invalid' ? 'warning' : 'info'

const loadCloudTasks = async () => {
  clearTimeout(cloudTimer)
  if (!canView.value || pageDisposed) return
  const request = cloudRequest.nextRequest()
  try {
    const response = await backupCloudApi.tasks(request.signal)
    if (!request.isLatest() || pageDisposed) return
    if (!response.success || !response.data) throw new Error(response.message || '读取上传状态失败')
    cloudTasks.value = response.data
    cloudError.value = response.message || ''
  } catch (cause) {
    if (request.isLatest() && !pageDisposed && !cloudRequest.isCanceledError(cause)) {
      cloudError.value = getRequestErrorMessage(cause, '读取云盘任务失败，请刷新重试')
    }
  } finally {
    if (!pageDisposed && request.isLatest() && canView.value) {
      cloudTimer = setTimeout(() => { void loadCloudTasks() }, 5000)
    }
  }
}

const uploadToCloud = async (filename: string) => {
  if (!requirePermission('create')) return
  cloudEnqueueing.value = filename
  try {
    const response = await backupCloudApi.upload(filename)
    if (!response.success) throw new Error(response.message || '创建云盘任务失败')
    success('已加入后台上传队列，关闭页面后仍会继续上传')
    await loadCloudTasks()
  } catch (cause) { error(getRequestErrorMessage(cause, '提交上传任务失败')) }
  finally { cloudEnqueueing.value = null }
}
const backupSizeType = (bytes?: number): 'success' | 'primary' | 'warning' | 'info' => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'info'
  if (bytes >= 1024 ** 3) return 'warning'
  return bytes >= 1024 ** 2 ? 'primary' : 'success'
}

interface BackupStorageInfo {
  backup_dir: string
  backend_root: string
  total_count: number
  total_size: string
  total_size_bytes: number
}

const backupList = ref<BackupFile[]>([])
const hasInitializedPageData = ref(false)
const createDialogVisible = ref(false)
const backupType = ref<'database' | 'full'>('database')
const storageInfo = ref<BackupStorageInfo>({
  backup_dir: '',
  backend_root: '',
  total_count: 0,
  total_size: '0 KB',
  total_size_bytes: 0
})

// 清理对话框
const cleanupDialogVisible = ref(false)
const keepCount = ref(5)

// 加载备份列表
const loadBackupList = async () => {
  if (!canView.value) {
    backupList.value = []
    storageInfo.value = {
      backup_dir: '',
      backend_root: '',
      total_count: 0,
      total_size: '0 KB',
      total_size_bytes: 0
    }
    return
  }

  isLoading.value = true
  try {
    const [listRes, storageRes] = await Promise.all([
      unifiedApi.get<BackupFile[]>('/backup/list'),
      unifiedApi.get('/backup/storage')
    ])

    if (listRes.success) {
      backupList.value = Array.isArray(listRes.data) ? listRes.data : []
    }
    if (storageRes.success) {
      if (storageRes.data && typeof storageRes.data === 'object') {
        storageInfo.value = storageRes.data as BackupStorageInfo
      }
    }
  } catch (err: unknown) {
    error('加载备份列表失败: ' + getRequestErrorMessage(err, '未知错误'))
  } finally {
    isLoading.value = false
  }
}

const initializePageData = async () => {
  if (!canView.value || hasInitializedPageData.value) {
    return
  }

  hasInitializedPageData.value = true
  await loadBackupList()
  await loadCloudTasks()
}

// 创建备份
const createBackup = async () => {
  if (!requirePermission('create')) {
    return
  }

  try {
    await confirmAction(
      backupType.value === 'database'
        ? '将导出当前配置连接的数据库，过程可能需要几分钟。'
        : '将备份数据库、后端代码和上传文件，过程可能需要几分钟。',
      '创建备份',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
  } catch {
    return
  }

  isCreating.value = true
  const closeLoading = loading(`正在创建${backupType.value === 'database' ? '数据库备份' : '完整备份'}，请稍候...（可能需要几分钟）`)

  try {
    // 备份可能需要较长时间（特别是上传文件较大时），设置10分钟超时
    const response = await unifiedApi.post('/backup/create', { type: backupType.value }, {
      timeout: 10 * 60 * 1000  // 10分钟超时
    })
    if (response.success) {
      const backupPath = response.data?.path ? `\n路径：${response.data.path}` : ''
      success(`${backupType.value === 'database' ? '数据库备份' : '完整备份'}创建成功：${response.data.filename}${backupPath}`)
      createDialogVisible.value = false
      await loadBackupList()
    } else {
      throw new Error(response.message || '备份失败')
    }
  } catch (err: unknown) {
    error('创建备份失败: ' + getRequestErrorMessage(err, '未知错误'))
  } finally {
    isCreating.value = false
    closeLoading()
  }
}

// 下载备份
const downloadBackup = async (filename: string) => {
  try {
    downloadingFilename.value = filename

    const response = await unifiedApi.get<{ url?: string }>(`/backup/download-link/${encodeURIComponent(filename)}`)
    if (!response.success || !response.data?.url) {
      throw new Error(response.message || '获取下载链接失败')
    }

    const link = document.createElement('a')
    link.href = response.data.url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err: unknown) {
    error('下载备份失败: ' + getRequestErrorMessage(err, '未知错误'))
  } finally {
    downloadingFilename.value = null
  }
}

// 确认删除
const confirmDelete = async (filename: string) => {
  try {
    await confirmAction(
      `确定要删除备份 "${filename}" 吗？此操作不可恢复。`,
      '删除备份',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await deleteBackup(filename)
  } catch {
    // 用户取消
  }
}

// 删除备份
const deleteBackup = async (filename: string) => {
  if (!requirePermission('delete')) {
    return
  }

  try {
    const response = await unifiedApi.delete(`/backup/${filename}`)
    if (response.success) {
      success('备份删除成功')
      await loadBackupList()
    } else {
      throw new Error(response.message || '删除失败')
    }
  } catch (err: unknown) {
    error('删除备份失败: ' + getRequestErrorMessage(err, '未知错误'))
  }
}

// 显示清理对话框
const showCleanupDialog = () => {
  if (!requirePermission('delete')) {
    return
  }

  if (isLoading.value || isCleaningUp.value || backupList.value.length === 0) return
  keepCount.value = Math.max(1, Math.min(keepCount.value, backupList.value.length - 1))
  cleanupDialogVisible.value = true
}

// 清理旧备份
const cleanupBackups = async () => {
  if (isCleaningUp.value) return
  if (!requirePermission('delete')) {
    return
  }

  isCleaningUp.value = true
  try {
    const response = await unifiedApi.post('/backup/cleanup', { keep_count: keepCount.value }, { showError: false })
    if (response.success) {
      success(response.message || '清理完成')
      cleanupDialogVisible.value = false
      await loadBackupList()
    } else {
      throw new Error(response.message || '清理失败')
    }
  } catch (err: unknown) {
    error('清理失败: ' + getRequestErrorMessage(err, '未知错误'))
  } finally {
    isCleaningUp.value = false
  }
}

// 格式化时间
const formatDateTime = (dateStr?: string | null) => formatGlobalDateTime(dateStr, TIME_FORMATS.DATETIME_MINUTE)

// 初始化
onMounted(async () => {
  await initializePageData()
})

onBeforeUnmount(() => {
  pageDisposed = true
  clearTimeout(cloudTimer)
  cloudRequest.cancelLatest()
})

watch(canView, async (value) => {
  if (value) {
    await initializePageData()
  } else {
    clearTimeout(cloudTimer)
    cloudRequest.cancelLatest()
    cloudTasks.value = []
    hasInitializedPageData.value = false
    backupList.value = []
    storageInfo.value = {
      backup_dir: '',
      backend_root: '',
      total_count: 0,
      total_size: '0 KB',
      total_size_bytes: 0
    }
  }
}, { immediate: true })
</script>

<style scoped>
.cloud-error {
  overflow-wrap: anywhere;
  color: var(--tf-color-danger);
  margin-top: var(--tf-space-1);
}
.cloud-error--invalid {
  color: var(--el-color-warning);
}

.backup-management {
  padding: 24px;
  background: var(--bg-primary, var(--tf-color-surface));
  min-height: 100vh;
}

.backup-container {
  background: transparent;
}

/* 存储信息卡片 */
.storage-info-card {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.storage-info-card .info-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.storage-info-card .info-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
  display: flex;
  align-items: center;
  justify-content: center;
}

.storage-info-card .info-icon i {
  font-size: var(--tf-type-scale-20);
  color: white;
}

.storage-info-card .info-content {
  display: flex;
  flex-direction: column;
}

.storage-info-card .info-item-path {
  min-width: 320px;
  flex: 1;
}

.storage-info-card .info-label {
  font-size: var(--tf-type-scale-13);
  color: var(--text-secondary, var(--tf-color-muted));
}

.storage-info-card .info-value {
  font-size: var(--tf-type-scale-20);
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
}

.storage-info-card .info-path {
  font-size: var(--tf-type-scale-13);
  font-weight: 500;
  word-break: break-all;
  line-height: 1.5;
}

.storage-info-card .info-actions {
  margin-left: auto;
}

/* 备份列表卡片 */
.backup-list-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
}

.card-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--bg-tertiary, var(--tf-color-surface-muted));
}

.card-header h3 {
  margin: 0;
  font-size: var(--tf-type-scale-16);
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header h3 i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

/* 文件名单元格 */
.filename-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filename-cell i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
  font-size: var(--tf-type-scale-16);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 表单提示 */
.form-tip {
  margin-left: 12px;
  font-size: var(--tf-type-scale-13);
  color: var(--text-secondary, var(--tf-color-muted));
}

.backup-type-options {
  display: grid;
  width: 100%;
  gap: var(--tf-space-3);
}

.backup-type-option {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 76px;
  margin-right: 0;
  padding: var(--tf-space-4);
  white-space: normal;
}

.backup-type-title,
.backup-type-description {
  display: block;
}

.backup-type-title {
  margin-bottom: var(--tf-space-1);
  color: var(--text-primary, var(--tf-color-heading));
  font-weight: 600;
}

.backup-type-description {
  color: var(--text-secondary, var(--tf-color-muted));
  font-size: var(--tf-type-scale-13);
  line-height: 1.5;
}

/* 响应式 */
@media (max-width: 767px) {
  .backup-management {
    padding: 16px;
  }

  .storage-info-card {
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
  }

  .storage-info-card .info-actions {
    width: 100%;
    margin-left: 0;
    margin-top: 8px;
  }

  .backup-list-card {
    padding: 16px;
  }
}
</style>
