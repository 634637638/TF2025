<template>
  <div class="git-management-view">
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="git-management"
      module-name="Git管理"
      permission-code="git-management:view"
    />

    <template v-else>
      <PageHeader title="Git 仓库管理">
        <template #actions>
          <div class="action-buttons">
            <button
              @click="handleCreateArchiveBackup"
              class="btn btn-success"
              :disabled="loading || backingUpArchive"
            >
              <i :class="backingUpArchive ? 'fas fa-spinner fa-spin' : 'fas fa-file-archive'"></i>
              <span>{{ backingUpArchive ? '备份中...' : '压缩包备份' }}</span>
            </button>
            <button
              v-if="shouldShowRestoreMain"
              @click="handleRestoreMain"
              class="btn btn-primary"
              :disabled="loading || restoringMain"
            >
              <i :class="restoringMain ? 'fas fa-spinner fa-spin' : 'fas fa-house'"></i>
              <span>{{ restoringMain ? '恢复中...' : '恢复到 main' }}</span>
            </button>
            <button
              @click="fetchGitStatus"
              class="btn btn-outline-secondary"
              :disabled="loading"
            >
              <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
              <span>刷新状态</span>
            </button>
          </div>
        </template>
      </PageHeader>

      <div class="content">
        <div v-if="showStatsCards" class="stats-cards">
          <div v-if="canViewGitField('stats_current_branch')" class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-code-branch"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ gitStatus?.branchDisplay || gitStatus?.branch || '-' }}</div>
              <div class="stat-label">当前分支</div>
            </div>
          </div>
          <div v-if="canViewGitField('stats_changed_files')" class="stat-card">
            <div class="stat-icon" :class="{ active: gitStatus?.hasChanges }">
              <i class="fas fa-file-code"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ gitStatus?.changes?.length || 0 }}</div>
              <div class="stat-label">更改文件</div>
            </div>
          </div>
          <div v-if="canViewGitField('stats_workspace_status')" class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ gitStatus?.hasChanges ? '有更改' : '干净' }}</div>
              <div class="stat-label">工作区状态</div>
            </div>
          </div>
          <div v-if="canViewGitField('stats_commit_count')" class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-history"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ commitHistory.length }}</div>
              <div class="stat-label">提交记录</div>
            </div>
          </div>
        </div>

        <div class="main-grid">
          <div class="left-section">
            <el-alert
              v-if="shouldShowRestoreMain"
              class="detached-alert"
              type="warning"
              :closable="false"
              :title="gitStatus?.detached ? '当前仓库处于分离 HEAD 状态' : `当前不在 main，而是在 ${gitStatus?.branchDisplay || gitStatus?.branch}`"
              :description="gitStatus?.detached
                ? `当前不能直接提交到主线。点击“恢复到 main”后，系统会先保留当前代码，再尝试带回 main。旧的 main 不会直接覆盖你现在的代码。当前提交点：${gitStatus?.headCommit || '-'}`
                : `你当前已经在备份分支上。点击“恢复到 main”后，系统会以当前分支代码为准带回 main，不会直接用旧 main 覆盖当前代码。`"
            />

            <div class="card changes-card">
              <div class="card-header">
                <h3>
                  <i class="fas fa-file-alt"></i>
                  更改的文件
                </h3>
                <el-tag v-if="gitStatus?.hasChanges" type="warning" size="small">
                  {{ gitStatus.changes.length }} 个文件
                </el-tag>
                <el-tag v-else type="success" size="small">工作区干净</el-tag>
              </div>
              <div class="card-body">
                <div v-if="gitStatus?.hasChanges" class="changes-list">
                  <div
                    v-for="(change, index) in gitStatus.changes"
                    :key="index"
                    class="change-item"
                  >
                    <div class="change-status">
                      <el-tag :type="getStatusType(change.status)" size="small">
                        {{ getStatusText(change.status) }}
                      </el-tag>
                    </div>
                    <div class="change-file">{{ change.file }}</div>
                  </div>
                </div>
                <div v-else class="empty-state">
                  <i class="fas fa-check-circle"></i>
                  <p>工作区干净，没有未提交的更改</p>
                </div>
              </div>
            </div>

            <div class="card history-card">
              <div class="card-header">
                <h3>
                  <i class="fas fa-history"></i>
                  提交历史
                </h3>
                <button class="btn-icon" @click="fetchCommitHistory" :disabled="loadingHistory">
                  <i :class="loadingHistory ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
                </button>
              </div>
              <div class="card-body">
                <div v-if="commitHistory.length > 0" class="commit-list">
                  <div
                    v-for="(commit, index) in commitHistory"
                    :key="index"
                    class="commit-item"
                  >
                    <div class="commit-icon">
                      <i class="fas fa-code-commit"></i>
                    </div>
                    <div class="commit-content">
                      <div class="commit-message">{{ getCommitTitle(commit.message) }}</div>
                      <div v-if="hasCommitDetails(commit.message)" class="commit-details">
                        <div v-if="getCommitDetails(commit.message)" class="detail-section">
                          <span class="detail-label">修改内容:</span>
                          <span class="detail-content">{{ getCommitDetails(commit.message) }}</span>
                        </div>
                        <div v-if="getCommitOptimizations(commit.message)" class="detail-section optimizations">
                          <span class="detail-label">优化内容:</span>
                          <span class="detail-content">{{ getCommitOptimizations(commit.message) }}</span>
                        </div>
                      </div>
                      <div class="commit-meta">
                        <span class="commit-hash">
                          <i class="fas fa-fingerprint"></i>
                          {{ commit.hash.substring(0, 8) }}
                        </span>
                        <span class="commit-author">
                          <i class="fas fa-user"></i>
                          {{ commit.author }}
                        </span>
                        <span class="commit-date">
                          <i class="fas fa-clock"></i>
                          {{ commit.date }}
                        </span>
                      </div>
                      <div class="commit-actions">
                        <el-button
                          type="primary"
                          size="small"
                          @click="handleCheckoutCommit(commit.hash, 'view')"
                        >
                          <i class="fas fa-eye"></i>
                          查看
                        </el-button>
                        <el-button
                          type="warning"
                          size="small"
                          @click="handleCheckoutCommit(commit.hash, 'reset')"
                        >
                          <i class="fas fa-undo"></i>
                          重置
                        </el-button>
                        <el-button
                          v-if="canDeleteCommit(commit)"
                          type="danger"
                          size="small"
                          @click="handleDeleteCommit(commit.hash, commit.message)"
                        >
                          <i class="fas fa-trash"></i>
                          隐藏
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-state">
                  <i class="fas fa-history"></i>
                  <p>暂无提交记录</p>
                </div>
              </div>
            </div>
          </div>

          <div class="right-section">
            <div class="card commit-card">
              <div class="card-header">
                <h3>
                  <i class="fas fa-upload"></i>
                  一键提交
                </h3>
              </div>
              <div class="card-body">
                <form @submit.prevent="handleCommit" class="commit-form">
                  <div class="form-group">
                    <label>
                      <i class="fas fa-comment-alt"></i>
                      提交信息
                    </label>
                    <textarea
                      v-model="commitForm.message"
                      class="form-textarea"
                      rows="2"
                      placeholder="简要描述本次更改..."
                    ></textarea>
                  </div>
                  <div class="form-group">
                    <label>
                      <i class="fas fa-edit"></i>
                      详细说明（修改了什么）
                    </label>
                    <textarea
                      v-model="commitForm.details"
                      class="form-textarea"
                      rows="2"
                      placeholder="详细描述本次修改的内容..."
                    ></textarea>
                  </div>
                  <div class="form-group">
                    <label>
                      <i class="fas fa-rocket"></i>
                      优化内容（优化了什么）
                    </label>
                    <div class="optimization-tags">
                      <el-tag
                        v-for="opt in commonOptimizations"
                        :key="opt.key"
                        @click="toggleOptimization(opt.label)"
                        :type="isOptimizationSelected(opt.label) ? 'primary' : 'info'"
                        class="optimization-tag"
                        clickable
                      >
                        {{ opt.label }}
                      </el-tag>
                    </div>
                    <textarea
                      v-model="commitForm.optimizations"
                      class="form-textarea"
                      rows="2"
                      placeholder="描述本次优化的内容，或点击上方标签快速添加..."
                    ></textarea>
                  </div>
                  <div class="form-group checkbox-group">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="commitForm.autoPush" />
                      <span>自动推送到远程仓库</span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    class="btn btn-primary btn-block"
                    :disabled="committing || shouldShowRestoreMain || (!gitStatus?.hasChanges && !canPushExistingCommits)"
                  >
                    <i :class="committing ? 'fas fa-spinner fa-spin' : 'fas fa-upload'"></i>
                    <span>{{ commitButtonText }}</span>
                  </button>
                </form>
              </div>
            </div>

            <div class="card actions-card">
              <div class="card-header">
                <h3>
                  <i class="fas fa-bolt"></i>
                  快速操作
                </h3>
              </div>
              <div class="card-body">
                <div class="action-buttons">
                  <button
                    @click="handlePull"
                    class="btn btn-success btn-block"
                    :disabled="pulling || shouldShowRestoreMain"
                  >
                    <i :class="pulling ? 'fas fa-spinner fa-spin' : 'fas fa-download'"></i>
                    <span>拉取远程更新</span>
                  </button>
                  <button
                    @click="handlePush"
                    class="btn btn-warning btn-block"
                    :disabled="pushing || shouldShowRestoreMain"
                  >
                    <i :class="pushing ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>
                    <span>推送到远程</span>
                  </button>
                  <button
                    @click="handleDiscard"
                    class="btn btn-danger btn-block"
                    :disabled="discarding || !gitStatus?.hasChanges"
                  >
                    <i :class="discarding ? 'fas fa-spinner fa-spin' : 'fas fa-trash-alt'"></i>
                    <span>丢弃更改</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="card recent-commits-card">
              <div class="card-header">
                <h3>
                  <i class="fas fa-clock"></i>
                  最近提交
                </h3>
              </div>
              <div class="card-body">
                <div v-if="gitStatus?.recentCommits" class="recent-list">
                  <div
                    v-for="(commit, index) in gitStatus.recentCommits.slice(0, 5)"
                    :key="index"
                    class="recent-item"
                  >
                    <div class="recent-message">{{ commit.split(' ')[0] }}</div>
                    <div class="recent-time">{{ commit.split(' ').slice(1).join(' ') }}</div>
                  </div>
                </div>
                <div v-else class="empty-state">
                  <i class="fas fa-clock"></i>
                  <p>暂无最近提交</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { unifiedApi } from '@/utils/unified-api';
import PermissionDenied from '@/components/base/PermissionDenied.vue';
import PageHeader from '@/components/base/PageHeader.vue';
import { usePagePermissions } from '@/composables/usePagePermissions';
import { fieldPermissions } from '@/composables/useFieldPermissions';
import { useLoadingState } from '@/composables'
import logger from '@/utils/logger';

const {
  canView: gitPermissionCanView,
  handleNoPermission,
  hasFullPermission
} = usePagePermissions('git-management');

const canView = computed(() => (
  gitPermissionCanView.value ||
  hasFullPermission('system:view') ||
  hasFullPermission('permissions:view')
));

const gitFieldMap = {
  stats_current_branch: 'stats.current_branch',
  stats_changed_files: 'stats.changed_files',
  stats_workspace_status: 'stats.workspace_status',
  stats_commit_count: 'stats.commit_count',
  actions: 'system_info.operations'
};

const getGitFieldKey = (fieldName) => gitFieldMap[fieldName] || fieldName;
const canViewGitField = (fieldName) => {
  return fieldPermissions.isFieldVisible('system_gitmanagement', getGitFieldKey(fieldName));
};

const showStatsCards = computed(() => (
  canViewGitField('stats_current_branch') ||
  canViewGitField('stats_changed_files') ||
  canViewGitField('stats_workspace_status') ||
  canViewGitField('stats_commit_count')
));

const ensureGitViewPermission = () => {
  if (canView.value) {
    return true;
  }
  handleNoPermission('view');
  return false;
};

const { loading } = useLoadingState()
const loadingHistory = ref(false);
const backingUpArchive = ref(false);
const restoringMain = ref(false);
const committing = ref(false);
const pushing = ref(false);
const pulling = ref(false);
const discarding = ref(false);
const checkingOut = ref(false);

const gitStatus = ref(null);
const commitHistory = ref([]);

const commitForm = reactive({
  message: '更新代码',
  details: '',
  optimizations: '',
  autoPush: true
});

const commonOptimizations = [
  { key: 'performance', label: '优化性能' },
  { key: 'ui', label: '改进用户界面' },
  { key: 'ux', label: '提升用户体验' },
  { key: 'code', label: '代码重构' },
  { key: 'security', label: '增强安全性' },
  { key: 'speed', label: '提升加载速度' },
  { key: 'responsive', label: '优化移动端适配' },
  { key: 'database', label: '优化数据库查询' },
  { key: 'api', label: '优化 API 接口' },
  { key: 'error', label: '修复错误和 Bug' }
];

const shouldShowRestoreMain = computed(() => {
  const status = gitStatus.value;
  if (!status) {
    return false;
  }
  if (status.detached) {
    return true;
  }
  const currentBranch = status.branch || '';
  return !!currentBranch && currentBranch !== 'main';
});

const canPushExistingCommits = computed(() => {
  return !gitStatus.value?.hasChanges && Number(gitStatus.value?.aheadCount || 0) > 0;
});

const commitButtonText = computed(() => {
  if (committing.value) {
    return canPushExistingCommits.value ? '推送中...' : '提交中...';
  }

  if (canPushExistingCommits.value) {
    return '仅推送未同步提交';
  }

  return '提交' + (commitForm.autoPush ? '并推送' : '');
});

const getStatusType = (status) => {
  const statusMap = {
    M: 'warning',
    A: 'success',
    D: 'danger',
    R: 'info',
    '??': 'info'
  };
  return statusMap[status] || 'info';
};

const getStatusText = (status) => {
  const statusMap = {
    M: '修改',
    A: '新增',
    D: '删除',
    R: '重命名',
    '??': '未跟踪'
  };
  return statusMap[status] || status;
};

const toggleOptimization = (label) => {
  const currentOpts = commitForm.optimizations;
  const optsArray = currentOpts ? currentOpts.split('、') : [];

  if (optsArray.includes(label)) {
    commitForm.optimizations = optsArray.filter((opt) => opt !== label).join('、');
    return;
  }

  commitForm.optimizations = [...optsArray, label].filter(Boolean).join('、');
};

const isOptimizationSelected = (label) => {
  if (!commitForm.optimizations) return false;
  return commitForm.optimizations.includes(label);
};

const canDeleteCommit = (commit) => {
  if (commitHistory.value.length > 0 && commit.hash === commitHistory.value[0].hash) {
    return false;
  }
  return true;
};

const getCommitTitle = (message) => {
  if (!message) return '';
  return message.split('\n')[0].trim();
};

const hasCommitDetails = (message) => {
  if (!message) return false;
  return message.includes('修改内容:') || message.includes('优化内容:');
};

const getCommitDetails = (message) => {
  if (!message) return '';
  const detailsMatch = message.match(/修改内容:\n([\s\S]*?)(?=\n\n优化内容:|$)/);
  return detailsMatch?.[1]?.trim() || '';
};

const getCommitOptimizations = (message) => {
  if (!message) return '';
  const optsMatch = message.match(/优化内容:\n([\s\S]*?)(?=\n\n🤖|$)/);
  return optsMatch?.[1]?.trim() || '';
};

const formatSyncStatusText = (syncStatus) => {
  if (!syncStatus) {
    return '';
  }

  if (syncStatus.hasUpstream === false) {
    return '当前分支还没有关联远端分支';
  }

  const ahead = Number(syncStatus.ahead ?? syncStatus.aheadCount ?? 0);
  const behind = Number(syncStatus.behind ?? syncStatus.behindCount ?? 0);

  if (ahead === 0 && behind === 0) {
    return '当前本地与远端已同步';
  }

  const parts = [];
  if (ahead > 0) {
    parts.push(`本地领先远端 ${ahead} 个提交`);
  }
  if (behind > 0) {
    parts.push(`远端领先本地 ${behind} 个提交`);
  }

  return parts.join('，');
};

const getApiErrorMessage = (error, fallback) => {
  const responseData = error?.response?.data;
  const syncStatusText = formatSyncStatusText(
    responseData?.details?.syncStatus || responseData?.data?.syncStatus
  );

  if (responseData?.hint) {
    return [responseData.error || fallback, syncStatusText, responseData.hint].filter(Boolean).join('\n');
  }
  if (responseData?.error) {
    return [responseData.error, syncStatusText].filter(Boolean).join('\n');
  }
  return [fallback, syncStatusText].filter(Boolean).join('\n');
};

const fetchGitStatus = async () => {
  if (!canView.value) {
    gitStatus.value = null;
    return;
  }

  loading.value = true;
  try {
    const response = await unifiedApi.get('/git/status');
    if (response.success) {
      gitStatus.value = response.data;
    } else {
      ElMessage.error(response.error || '获取 Git 状态失败');
    }
  } catch (error) {
    logger.error('获取 Git 状态失败:', error);
    ElMessage.error(getApiErrorMessage(error, '获取 Git 状态失败'));
  } finally {
    loading.value = false;
  }
};

const fetchCommitHistory = async () => {
  if (!canView.value) {
    commitHistory.value = [];
    return;
  }

  loadingHistory.value = true;
  try {
    const response = await unifiedApi.get('/git/log?limit=20');
    if (response.success) {
      commitHistory.value = response.data.commits;
    } else {
      ElMessage.error(response.error || '获取提交历史失败');
    }
  } catch (error) {
    logger.error('获取提交历史失败:', error);
    ElMessage.error(getApiErrorMessage(error, '获取提交历史失败'));
  } finally {
    loadingHistory.value = false;
  }
};

const handleCommit = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  if (!gitStatus.value?.hasChanges && canPushExistingCommits.value) {
    await handlePush();
    return;
  }

  if (!commitForm.message.trim()) {
    ElMessage.warning('请输入提交信息');
    return;
  }

  committing.value = true;
  try {
    let fullMessage = commitForm.message.trim();
    if (commitForm.details.trim()) {
      fullMessage += '\n\n修改内容:\n' + commitForm.details.trim();
    }
    if (commitForm.optimizations.trim()) {
      fullMessage += '\n\n优化内容:\n' + commitForm.optimizations.trim();
    }

    const response = await unifiedApi.post('/git/commit', {
      message: fullMessage,
      autoPush: commitForm.autoPush
    });

    if (response.success) {
      const syncStatusText = formatSyncStatusText(response.data?.syncStatus);
      const pushHint = response.data?.hint || '';
      if (commitForm.autoPush && response.data?.pushed === false) {
        ElMessage.warning(
          [response.data.message || response.data.error || '提交成功，但推送失败', syncStatusText, pushHint]
            .filter(Boolean)
            .join('；')
        );
      } else {
        ElMessage.success(
          [response.data.message || '提交成功', commitForm.autoPush ? syncStatusText : '']
            .filter(Boolean)
            .join('；')
        );
      }
      commitForm.message = '更新代码';
      commitForm.details = '';
      commitForm.optimizations = '';
      await fetchGitStatus();
      await fetchCommitHistory();
    } else {
      ElMessage.error(response.error || '提交失败');
    }
  } catch (error) {
    logger.error('提交失败:', error);
    ElMessage.error(getApiErrorMessage(error, '提交失败'));
  } finally {
    committing.value = false;
  }
};

const handlePush = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  pushing.value = true;
  try {
    const response = await unifiedApi.post('/git/push');
    if (response.success) {
      const syncStatusText = formatSyncStatusText(response.data?.syncStatus);
      ElMessage.success(
        [response.data?.message || '推送成功', syncStatusText]
          .filter(Boolean)
          .join('；')
      );
      await fetchGitStatus();
      await fetchCommitHistory();
    } else {
      ElMessage.error(response.error || '推送失败');
    }
  } catch (error) {
    logger.error('推送失败:', error);
    ElMessage.error(getApiErrorMessage(error, '推送失败'));
  } finally {
    pushing.value = false;
  }
};

const handlePull = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  pulling.value = true;
  try {
    const response = await unifiedApi.post('/git/pull');
    if (response.success) {
      ElMessage.success('拉取成功');
      await fetchGitStatus();
    } else {
      ElMessage.error(response.error || '拉取失败');
    }
  } catch (error) {
    logger.error('拉取失败:', error);
    ElMessage.error(getApiErrorMessage(error, '拉取失败'));
  } finally {
    pulling.value = false;
  }
};

const handleDiscard = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      '此操作将丢弃所有未提交的更改，包括添加、修改和删除的文件，是否继续？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    discarding.value = true;
    const response = await unifiedApi.post('/git/discard');
    if (response.success) {
      ElMessage.success('已丢弃所有未提交的更改');
      await fetchGitStatus();
    } else {
      ElMessage.error(response.error || '丢弃更改失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('丢弃更改失败:', error);
      ElMessage.error(getApiErrorMessage(error, '丢弃更改失败'));
    }
  } finally {
    discarding.value = false;
  }
};

const handleCheckoutCommit = async (commitHash, mode) => {
  if (!ensureGitViewPermission()) {
    return;
  }

  try {
    const warningText = mode === 'reset'
      ? '重置操作将永久丢弃所有未提交的更改，此操作不可逆！是否继续？'
      : '将创建临时分支查看此版本，您可以随时切换回来。是否继续？';

    await ElMessageBox.confirm(
      `${warningText}\n\n版本: ${commitHash.substring(0, 8)}`,
      mode === 'reset' ? '危险操作警告' : '确认切换',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: mode === 'reset' ? 'error' : 'warning'
      }
    );

    checkingOut.value = true;
    const response = await unifiedApi.post('/git/checkout', { commit: commitHash, mode });
    if (response.success) {
      ElMessage.success(response.data.message || '切换成功');
      await fetchGitStatus();
      await fetchCommitHistory();
    } else {
      ElMessage.error(response.error || '切换版本失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('切换版本失败:', error);
      ElMessage.error(getApiErrorMessage(error, '切换版本失败'));
    }
  } finally {
    checkingOut.value = false;
  }
};

const handleDeleteCommit = async (commitHash, commitMessage) => {
  if (!ensureGitViewPermission()) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要从历史列表隐藏这条记录吗？\n\n版本: ${commitHash.substring(0, 8)}\n${getCommitTitle(commitMessage)}\n\n此操作不会删除当前实际文件，也不会修改工作区代码。`,
      '隐藏历史记录',
      {
        confirmButtonText: '仅隐藏记录',
        cancelButtonText: '取消',
        type: 'warning',
        center: true
      }
    );

    const response = await unifiedApi.post('/git/delete-commit', { hash: commitHash });
    if (response.success) {
      ElMessage.success(response.data.message || '历史记录已隐藏');
      await fetchCommitHistory();
      await fetchGitStatus();
    } else {
      ElMessage.error(response.error || '隐藏历史记录失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('隐藏历史记录失败:', error);
      ElMessage.error(getApiErrorMessage(error, '隐藏历史记录失败'));
    }
  }
};

const handleCreateArchiveBackup = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      '系统会把当前项目的核心文件打成一个本地压缩包，保存在项目根目录下的“本地备份”文件夹内。默认包含前端、后端和必要根文件，不会把非必要文件一起打包。是否继续？',
      '创建本地压缩包备份',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'info',
        center: true
      }
    );

    backingUpArchive.value = true;
    const response = await unifiedApi.post('/git/backup/archive', {});

    if (response.success) {
      const backup = response.data?.backup;
      ElMessageBox.alert(
        [
          response.data?.message || '本地压缩包备份创建成功',
          backup?.fileName ? `文件名：${backup.fileName}` : '',
          backup?.filePath ? `保存位置：${backup.filePath}` : '',
          backup?.fileSize ? `文件大小：${backup.fileSize}` : '',
          Array.isArray(backup?.includedItems) ? `打包内容：${backup.includedItems.join('、')}` : '',
          typeof backup?.hasChanges === 'boolean' ? `包含当前未提交改动：${backup.hasChanges ? '是' : '否'}` : ''
        ].filter(Boolean).join('\n'),
        '备份完成',
        {
          confirmButtonText: '知道了'
        }
      );
      await fetchGitStatus();
      await fetchCommitHistory();
    } else {
      ElMessage.error(response.error || '创建本地压缩包备份失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('创建本地压缩包备份失败:', error);
      ElMessage.error(getApiErrorMessage(error, '创建本地压缩包备份失败'));
    }
  } finally {
    backingUpArchive.value = false;
  }
};

const handleRestoreMain = async () => {
  if (!ensureGitViewPermission()) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      '系统会先保留你当前这份代码，再尝试恢复到 main。若可以自动合并，就会把当前分支的最新代码带回主线，不会直接被旧的 main 覆盖。是否继续？',
      '恢复到 main',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning',
        center: true
      }
    );

    restoringMain.value = true;
    const response = await unifiedApi.post('/git/restore-main');
    if (response.success) {
      ElMessage.success(response.data.message || '已恢复到 main');
      await fetchGitStatus();
      await fetchCommitHistory();
    } else {
      ElMessage.error(response.error || '恢复到 main 失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('恢复到 main 失败:', error);
      ElMessage.error(getApiErrorMessage(error, '恢复到 main 失败'));
    }
  } finally {
    restoringMain.value = false;
  }
};

onMounted(async () => {
  if (canView.value) {
    await fieldPermissions.init();
    await fetchGitStatus();
    await fetchCommitHistory();
  }
});
</script>

<style lang="scss" scoped>
.git-management-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 32px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
}

.left-section,
.right-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detached-alert {
  white-space: pre-line;
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.card-header h3 i {
  color: #409eff;
}

.card-body {
  padding: 20px;
}

.changes-list .change-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.changes-list .change-item:last-child {
  border-bottom: none;
}

.change-file {
  flex: 1;
  font-size: 14px;
  color: #606266;
  font-family: 'Courier New', monospace;
  word-break: break-all;
}

.commit-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.commit-item:last-child {
  border-bottom: none;
}

.commit-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  flex-shrink: 0;
}

.commit-content {
  flex: 1;
}

.commit-message {
  font-size: 14px;
  color: #303133;
  margin-bottom: 6px;
  font-weight: 500;
}

.commit-details {
  margin: 8px 0;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 12px;
}

.detail-section {
  margin-bottom: 6px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 600;
  color: #409eff;
  margin-right: 4px;
}

.detail-section.optimizations .detail-label {
  color: #67c23a;
}

.detail-content {
  color: #606266;
}

.commit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.commit-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.commit-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.optimization-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.optimization-tag {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-item {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-message {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
  font-weight: 500;
}

.recent-time {
  font-size: 12px;
  color: #909399;
}

.commit-form .form-group {
  margin-bottom: 16px;
}

.commit-form label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
  justify-content: center;
  text-decoration: none;
  box-sizing: border-box;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-outline-secondary {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-block {
  width: 100%;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: #f5f7fa;
  color: #409eff;
  border-radius: 8px;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr;
  }

  .page-header .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .content {
    padding: 20px 16px;
  }
}
</style>
