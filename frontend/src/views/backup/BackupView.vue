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
            v-if="canCreate && canViewField('system_info.operations')"
            type="primary"
            :loading="isCreating"
            @click="createBackup"
          >
            <span v-if="isCreating">备份中...</span>
            <template v-else>
              <i class="fas fa-plus" />
              <span>创建备份</span>
            </template>
          </el-button>
          <el-button
            v-if="canViewField('system_info.operations')"
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
              v-if="canViewField('system_info.operations')"
              type="warning"
              size="small"
              plain
              :disabled="!canDelete || backupList.length < 5"
              @click="showCleanupDialog"
            >
              <i class="fas fa-broom" />
              清理旧备份
            </el-button>
          </div>
        </div>

        <!-- 备份列表 -->
        <div class="backup-list-card">
          <div class="card-header">
            <h3>
              <i class="fas fa-list" />
              备份列表
            </h3>
          </div>

          <el-table
            class="data-table"
            :data="isLoading ? [] : backupList"
            border
            stripe
            style="width: 100%"
          >
            <template #empty>
              <TableLoadingRow
                v-if="isLoading"
                mode="block"
                text="加载中..."
              />
              <DataEmptyState
                v-else
                description="暂无备份记录"
              >
                <el-button
                  v-if="canCreate && canViewField('system_info.operations')"
                  type="primary"
                  @click="createBackup"
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
              v-if="canViewField('backup.size')"
              prop="size"
              label="大小"
              width="120"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  type="info"
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
              v-if="showActionColumn"
              label="操作"
              :width="$getActionColumnWidth(['下载中', ...(canDelete ? ['删除'] : [])])"
              align="center"
              class-name="actions-column"
            >
              <template #default="{ row }">
                <div class="action-buttons">
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

    <!-- 清理对话框 -->
    <el-dialog
      v-model="cleanupDialogVisible"
      title="清理旧备份"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item
          v-if="canViewField('backup.keep_count')"
          label="保留数量"
        >
          <el-input-number
            v-model="keepCount"
            :min="1"
            :max="20"
          />
          <span class="form-tip">保留最近的 {{ keepCount }} 份备份</span>
        </el-form-item>
      </el-form>
      <template #footer>
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
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { PermissionGate, PageHeader } from '@/components/base'
import TableLoadingRow from '@/components/TableLoadingRow.vue'

const { success, error, loading } = useNotification()

// 权限
const { canView, canCreate, canDelete, requirePermission } = usePagePermissions('backup')
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible('backup_backupview', fieldKey)
const showActionColumn = computed(() => shouldShowActionColumn(
  fieldPermissions.isFieldVisible('backup_backupview', 'system_info.operations'),
  [canDelete.value]
))

// 状态
const isLoading = ref(false)
const isCreating = ref(false)
const isCleaningUp = ref(false)
const downloadingFilename = ref<string | null>(null)
const backupList = ref<any[]>([])
const hasInitializedPageData = ref(false)
const storageInfo = ref({
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
      unifiedApi.get('/backup/list'),
      unifiedApi.get('/backup/storage')
    ])

    if (listRes.success) {
      backupList.value = listRes.data || []
    }
    if (storageRes.success) {
      storageInfo.value = storageRes.data
    }
  } catch (err: any) {
    error('加载备份列表失败: ' + (err.message || '未知错误'))
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
}

// 创建备份
const createBackup = async () => {
  if (!requirePermission('create')) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要创建备份吗？备份过程可能需要几分钟时间。',
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
  const closeLoading = loading('正在创建备份，请稍候...（可能需要几分钟）')

  try {
    // 备份可能需要较长时间（特别是上传文件较大时），设置10分钟超时
    const response = await unifiedApi.post('/backup/create', {}, {
      timeout: 10 * 60 * 1000  // 10分钟超时
    })
    if (response.success) {
      const backupPath = response.data?.path ? `\n路径：${response.data.path}` : ''
      success(`备份创建成功：${response.data.filename}${backupPath}`)
      await loadBackupList()
    } else {
      throw new Error(response.message || '备份失败')
    }
  } catch (err: any) {
    error('创建备份失败: ' + (err.message || '未知错误'))
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
  } catch (err: any) {
    error('下载备份失败: ' + (err.message || '未知错误'))
  } finally {
    downloadingFilename.value = null
  }
}

// 确认删除
const confirmDelete = async (filename: string) => {
  try {
    await ElMessageBox.confirm(
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
  } catch (err: any) {
    error('删除备份失败: ' + (err.message || '未知错误'))
  }
}

// 显示清理对话框
const showCleanupDialog = () => {
  if (!requirePermission('delete')) {
    return
  }

  cleanupDialogVisible.value = true
}

// 清理旧备份
const cleanupBackups = async () => {
  if (!requirePermission('delete')) {
    return
  }

  isCleaningUp.value = true
  try {
    const response = await unifiedApi.post('/backup/cleanup', { keep_count: keepCount.value })
    if (response.success) {
      success(response.message || '清理完成')
      cleanupDialogVisible.value = false
      await loadBackupList()
    } else {
      throw new Error(response.message || '清理失败')
    }
  } catch (err: any) {
    error('清理失败: ' + (err.message || '未知错误'))
  } finally {
    isCleaningUp.value = false
  }
}

// 格式化时间
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 初始化
onMounted(async () => {
  await initializePageData()
})

watch(canView, async (value) => {
  if (value) {
    await initializePageData()
  } else {
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
  font-size: 20px;
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
  font-size: 13px;
  color: var(--text-secondary, var(--tf-color-muted));
}

.storage-info-card .info-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
}

.storage-info-card .info-path {
  font-size: 13px;
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
  font-size: 16px;
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
  font-size: 16px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted, var(--text-muted));
}

.empty-state i {
  font-size: 64px;
  margin-bottom: 16px;
  color: var(--tf-color-border-blue-light);
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 20px;
}

/* 表单提示 */
.form-tip {
  margin-left: 12px;
  font-size: 13px;
  color: var(--text-secondary, var(--tf-color-muted));
}

/* 响应式 */
@media (max-width: 768px) {
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
