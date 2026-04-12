<template>
  <div class="backup-management admin-page">
    <!-- 权限检查 -->
    <PermissionDenied
      v-if="!permissionLoading && !canView"
      :can-view="canView"
      module-key="backup"
      module-name="备份管理"
      permission-code="backup:view"
    />

    <!-- 主内容 -->
    <template v-if="!permissionLoading && canView">
      <PageHeader icon="fas fa-database" title="备份管理">
        <template #actions>
          <el-button type="primary" @click="createBackup" :loading="isCreating" v-if="canCreate">
            <i :class="isCreating ? 'fas fa-spinner fa-spin' : 'fas fa-plus'"></i>
            <span>{{ isCreating ? '备份中...' : '创建备份' }}</span>
          </el-button>
          <el-button type="info" plain @click="loadBackupList">
            <i class="fas fa-sync-alt"></i>
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="backup-container admin-page-content">
        <!-- 存储信息卡片 -->
        <div class="storage-info-card">
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-hdd"></i>
            </div>
            <div class="info-content">
              <span class="info-label">备份总数</span>
              <span class="info-value">{{ storageInfo.total_count || 0 }} 份</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-icon">
              <i class="fas fa-weight"></i>
            </div>
            <div class="info-content">
              <span class="info-label">占用空间</span>
              <span class="info-value">{{ storageInfo.total_size || '0 KB' }}</span>
            </div>
          </div>
          <div class="info-actions">
            <el-button
              type="warning"
              size="small"
              plain
              @click="showCleanupDialog"
              :disabled="!canDelete || backupList.length < 5"
            >
              <i class="fas fa-broom"></i>
              清理旧备份
            </el-button>
          </div>
        </div>

        <!-- 备份列表 -->
        <div class="backup-list-card">
          <div class="card-header">
            <h3>
              <i class="fas fa-list"></i>
              备份列表
            </h3>
          </div>

          <el-table
            :data="backupList"
            v-loading="isLoading"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column prop="filename" label="文件名" min-width="280">
              <template #default="{ row }">
                <div class="filename-cell">
                  <i class="fas fa-file-archive"></i>
                  <span>{{ row.filename }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="size" label="大小" width="120" align="center">
              <template #default="{ row }">
                <el-tag type="info" size="small">{{ row.size }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" align="center">
              <template #default="{ row }">
                {{ formatDateTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    type="primary"
                    size="small"
                    link
                    :loading="downloadingFilename === row.filename"
                    :disabled="downloadingFilename !== null && downloadingFilename !== row.filename"
                    @click="downloadBackup(row.filename)"
                  >
                    <i :class="downloadingFilename === row.filename ? 'fas fa-spinner fa-spin' : 'fas fa-download'"></i>
                    {{ downloadingFilename === row.filename ? '下载中' : '下载' }}
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    link
                    @click="confirmDelete(row.filename)"
                  >
                    <i class="fas fa-trash"></i>
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 空状态 -->
          <div v-if="!isLoading && backupList.length === 0" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>暂无备份记录</p>
            <el-button v-if="canCreate" type="primary" @click="createBackup">
              <i class="fas fa-plus"></i>
              创建第一个备份
            </el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 清理对话框 -->
    <el-dialog
      v-model="cleanupDialogVisible"
      title="清理旧备份"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px">
        <el-form-item label="保留数量">
          <el-input-number v-model="keepCount" :min="1" :max="20" />
          <span class="form-tip">保留最近的 {{ keepCount }} 份备份</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cleanupDialogVisible = false">取消</el-button>
        <el-button type="warning" @click="cleanupBackups" :loading="isCleaningUp">
          确认清理
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { PermissionDenied, PageHeader } from '@/components/base'

const { success, error, loading } = useNotification()

// 权限
const permissionLoading = ref(false)
const { canView, canCreate, canDelete, requirePermission } = usePagePermissions('backup')

// 状态
const isLoading = ref(false)
const isCreating = ref(false)
const isCleaningUp = ref(false)
const downloadingFilename = ref<string | null>(null)
const backupList = ref<any[]>([])
const storageInfo = ref({
  total_count: 0,
  total_size: '0 KB',
  total_size_bytes: 0
})

// 清理对话框
const cleanupDialogVisible = ref(false)
const keepCount = ref(5)

// 加载备份列表
const loadBackupList = async () => {
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
      success(`备份创建成功：${response.data.filename}`)
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
    const response = await unifiedApi.post('/backup/cleanup', { keepCount: keepCount.value })
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
  if (!canView.value) {
    return
  }

  await loadBackupList()
})
</script>

<style scoped>
.backup-management {
  padding: 24px;
  background: var(--bg-primary, #f5f7fa);
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
  background: linear-gradient(135deg, #667eea, #764ba2);
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

.storage-info-card .info-label {
  font-size: 13px;
  color: var(--text-secondary, #6c757d);
}

.storage-info-card .info-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
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
  border-bottom: 2px solid var(--bg-tertiary, #f8f9fa);
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header h3 i {
  color: var(--primary-color, #667eea);
}

/* 文件名单元格 */
.filename-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filename-cell i {
  color: var(--primary-color, #667eea);
  font-size: 16px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted, #999);
}

.empty-state i {
  font-size: 64px;
  margin-bottom: 16px;
  color: #d8dee9;
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 20px;
}

/* 表单提示 */
.form-tip {
  margin-left: 12px;
  font-size: 13px;
  color: var(--text-secondary, #6c757d);
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
