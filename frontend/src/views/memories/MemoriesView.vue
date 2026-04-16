<template>
  <div class="memories-view admin-page">
    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-memory"
      title="内存管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="handleCreateMemory"
        >
          <i class="fas fa-plus"></i>
          <span>新增</span>
        </el-button>
        <el-button type="info" @click="handleRefresh" :disabled="refreshing">
          <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 权限不足提示 - 在权限加载完成后显示 -->
    <PermissionAccessNotice
      v-if="!permissionLoading"
      v-permission-not="'memories:view'"
      module-name="内存管理"
      permission-name="内存查看权限"
      permission-code="memories:view"
      :has-menu-permission-only="hasMenuPermissionOnly"
      :related-permissions="memoryPermissions"
      detail-title="内存管理相关权限"
    />

    <!-- 权限验证通过后的内容 -->
    <div class="content admin-page-content" v-permission="'memories:view'">

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_memories')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-memory"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">内存规格总数</div>
        </div>
      </div>
      <div v-if="canViewField('stats_active_memories')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ memories.filter(m => m.status === 1 || m.is_active === true).length }}</div>
          <div class="stat-label">启用规格</div>
        </div>
      </div>
      <div v-if="canViewField('stats_inactive_memories')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ memories.filter(m => m.status === 0 || m.is_active === false).length }}</div>
          <div class="stat-label">禁用规格</div>
        </div>
      </div>
      <div v-if="canViewField('stats_related_phones')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getPhoneCount() }}</div>
          <div class="stat-label">相关手机</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      @search="searchMemories"
      @reset="resetSearch"
    >
      <template #primary>
        <el-input
          v-if="canViewField('capacity')"
          v-model="searchForm.size"
          placeholder="搜索关键词"
          clearable
          @keyup.enter="searchMemories"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div v-if="canViewField('status')" class="form-group filter-item" data-field="status">
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          @change="searchMemories"
        >
          <el-option label="启用" value="1" />
          <el-option label="禁用" value="0" />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <!-- 数据表格区域 -->
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list"></i>
        内存规格列表
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>
      
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th v-if="showSortField" width="40"></th>
              <th v-if="showSortOrderField" width="60">排序</th>
              <th v-if="canViewField('id')" width="80">ID</th>
              <th v-if="canViewField('capacity')" width="160">内存规格</th>
              <th v-if="showTypeField" width="200">存储大小</th>
              <th v-if="canViewField('status')" width="200">状态</th>
              <th v-if="showCreatedAtField" width="160">创建时间</th>
              <th v-if="showActionField" width="180">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="loading-row">
              <td :colspan="visibleColumnCount">
                <div class="loading-content">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>正在加载数据...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="memories.length === 0" class="empty-row">
              <td :colspan="visibleColumnCount">
                <div class="empty-content">
                  <i class="fas fa-inbox"></i>
                  <div class="empty-text">
                    <h4>暂无内存规格数据</h4>
                    <p>点击上方"新增内存"按钮添加第一个内存规格</p>
                    <el-button size="small" type="info" class="mt-2" @click="loadMemories()" :disabled="loading">
                      <i class="fas fa-sync-alt"></i>
                      {{ loading ? '加载中...' : '重新加载' }}
                    </el-button>
                  </div>
                </div>
              </td>
            </tr>
            <template v-else v-for="(memory, index) in memories" :key="memory.id">
            <tr
              class="data-row"
              :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
              :draggable="canEdit"
              @click="handleMobileRowTap(memory.id)"
              @dblclick="toggleMobileActions(memory.id)"
              @dragstart="canEdit ? handleDragStart(index, $event) : null"
              @dragend="canEdit ? handleDragEnd : null"
              @dragover="canEdit ? handleDragOver(index, $event) : null"
              @dragenter="canEdit ? handleDragEnter(index) : null"
              @dragleave="canEdit ? handleDragLeave : null"
              @drop="canEdit ? handleDrop(index, $event) : null"
            >
              <td v-if="showSortField" class="drag-handle-cell">
                <div class="drag-handle" :class="{ 'disabled': !canEdit }">
                  <i class="fas fa-grip-vertical"></i>
                </div>
              </td>
              <td v-if="showSortOrderField">
                <input
                  v-model.number="memory.sort_order"
                  type="number"
                  class="sort-order-input"
                  :disabled="!canEdit"
                  min="0"
                  max="9999"
                  @change="canEdit ? handleSortOrderChange(index, memory.sort_order) : null"
                />
              </td>
              <td v-if="canViewField('id')">
                <span class="id-badge">{{ index + 1 }}</span>
              </td>
              <td v-if="canViewField('capacity')">
                <div class="memory-info">
                  <div class="memory-size">
                    <strong>{{ memory.display_name || memory.name || '未命名规格' }}</strong>
                    <span v-if="!memory.name && !memory.display_name" class="warning-badge">未命名</span>
                  </div>
                  <div v-if="memory.description" class="memory-desc">
                    {{ memory.description }}
                  </div>
                  <div v-if="isMobile && canViewField('type')" class="mobile-sub-meta">
                    <span class="mobile-sub-label">存储</span>
                    <span class="mobile-sub-value">
                      {{ memory.storage_size || 'N/A' }} {{ memory.storage_unit || 'GB' }}
                    </span>
                  </div>
                </div>
              </td>
              <td v-if="showTypeField">
                <div class="storage-type">
                  <div class="storage-spec">
                    <span class="storage-size">{{ memory.storage_size || 'N/A' }}</span>
                    <span class="storage-unit" :class="getStorageUnitClass(memory.storage_unit)">
                      {{ memory.storage_unit || 'GB' }}
                    </span>
                  </div>
                  </div>
              </td>
              <td v-if="canViewField('status')">
                <span :class="['status-badge', (memory.status === 1 || memory.is_active === true) ? 'status-active' : 'status-inactive']">
                  <i :class="(memory.status === 1 || memory.is_active === true) ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ (memory.status === 1 || memory.is_active === true) ? '启用' : '禁用' }}
                </span>
              </td>
              <td v-if="showCreatedAtField">
                <div class="time-info">
                  <i class="fas fa-clock"></i>
                  {{ formatDate(memory.created_at) }}
                </div>
              </td>
              <td v-if="showActionField" class="actions">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    v-permission="'memories:edit'"
                    type="primary"
                    size="small"
                    @click="editMemory(memory)"
                    title="编辑"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'memories:delete'"
                    type="danger"
                    size="small"
                    @click="deleteMemory(memory)"
                    title="删除"
                  >
                    <i class="fas fa-trash"></i>
                    <span>删除</span>
                  </el-button>
                </div>
              </td>
            </tr>
            <tr
              v-if="isMobile && mobileActionRowId === memory.id && (canEdit || canDelete)"
              class="mobile-action-row"
            >
              <td :colspan="visibleColumnCount">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canEdit"
                    v-permission="'memories:edit'"
                    type="primary"
                    size="small"
                    @click.stop="editMemory(memory)"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'memories:delete'"
                    type="danger"
                    size="small"
                    @click.stop="deleteMemory(memory)"
                  >
                    <i class="fas fa-trash"></i>
                    <span>删除</span>
                  </el-button>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- 分页组件 -->
      <Pagination
        v-if="pagination.total > 0"
        v-model:current="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @change="handlePaginationChange"
      />
    </div>

    <!-- 创建/编辑模态框 -->
    <MobileDialog
      v-model="dialogVisible"
      :title="isEditMode ? '编辑内存规格' : '新增内存规格'"
      width="500px"
      dialog-class="memories-form-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      @close="attemptCloseModal"
      :show-default-footer="false"
    >
      <el-form :model="formData" label-width="90px" class="memories-dialog-form">
        <el-form-item v-if="canViewField('capacity')" label="内存规格" required>
          <el-input
            v-model="formData.size"
            placeholder="请输入内存规格，如：64GB、8+128GB、12+256GB等"
            clearable
            maxlength="50"
            show-word-limit
            :disabled="!canEditField('capacity')"
          />
          <div class="form-help">
            <small>支持格式：64GB、128GB、256GB（苹果风格）或 6+128GB、8+256GB、12+512GB（安卓组合风格）</small>
          </div>
        </el-form-item>
        <el-form-item v-if="canViewField('sort_order')" label="排序">
          <el-input-number
            v-model="formData.sort_order"
            :min="0"
            :max="9999"
            placeholder="请输入排序值，数字越小越靠前"
            controls-position="right"
            style="width: 100%"
            :disabled="!canEditField('sort_order')"
          />
        </el-form-item>
        <el-form-item v-if="canViewField('status')" label="状态">
          <el-radio-group v-model="formData.status" :disabled="!canEditField('status')">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="attemptCloseModal">取消</el-button>
        <el-button type="primary" @click="submitForm" :disabled="submitting" :loading="submitting">
          <i v-if="submitting" class="fas fa-spinner fa-spin"></i>
          {{ isEditMode ? '更新' : '创建' }}
        </el-button>
      </template>
    </MobileDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { usePermissionModuleInfo } from '@/composables/usePermissionModuleInfo'
import { useAuthStore } from '@/stores/auth'
import { normalizePermissionList } from '@/utils/permissionList'
import PermissionAccessNotice from '@/components/base/PermissionAccessNotice.vue'
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'

// 获取路由实例
const router = useRouter()
// 使用统一的 composable
const { success, error, warning, info, handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('memories')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const authStore = useAuthStore()
const { init: initFieldPermissions } = fieldPermissions

// 权限加载状态
const permissionLoading = ref(false)

const normalizedMemoryPermissions = computed<string[]>(() => {
  return normalizePermissionList(authStore?.permissions)
})

// 用户权限列表
const userPermissions = computed(() => normalizedMemoryPermissions.value)

const { hasMenuPermissionOnly, modulePermissions: memoryPermissions } = usePermissionModuleInfo(
  normalizedMemoryPermissions,
  'memories_memoriesview'
)

const memoryFieldMap: Record<string, string> = {
  stats_total_memories: 'stats.total_memories',
  stats_active_memories: 'stats.active_memories',
  stats_inactive_memories: 'stats.inactive_memories',
  stats_related_phones: 'stats.related_phones',
  id: 'memory.id',
  capacity: 'memory.capacity',
  type: 'memory.type',
  status: 'memory.status',
  sort_order: 'memory.sort_order',
  created_at: 'memory.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => memoryFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('memories_memoriesview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('memories_memoriesview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showTypeField = computed(() => canViewField('type') && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_memories') ||
  canViewField('stats_active_memories') ||
  canViewField('stats_inactive_memories') ||
  canViewField('stats_related_phones')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('capacity'),
    showTypeField.value,
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
})

interface Memory {
  id: number
  name: string
  size: string // 原始规格值，如 "64GB" 或 "6+128GB"
  storage_size: number | null
  storage_unit: string
  display_name: string
  description?: string
  price_multiplier?: number
  is_combo?: boolean // 是否为组合格式
  status?: number
  is_active?: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === id ? null : id
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return

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

// 响应式数据
const { loading } = useLoadingState()

// 搜索相关状态
const searchExpanded = ref(false)
const submitting = ref(false)
const savingOrder = ref(false)
const memories = ref<Memory[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentEditingId = ref<number | null>(null)

// 拖拽排序状态
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// 搜索表单
const searchForm = ref({
  size: '',
  status: ''
})

// 表单数据
const formData = ref({
  size: '',
  status: 1,
  sort_order: 0
})

// 分页数据
const pagination = ref({
  page: 1,
  limit: 100,
  total: 0,
  pages: 0
})

// 模态框显示状态
const dialogVisible = computed({
  get: () => showCreateModal.value || showEditModal.value,
  set: (value) => {
    if (!value) {
      attemptCloseModal()
    }
  }
})

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 方法
const getStorageType = (size: string): string => {
  if (!size) return 'unknown'
  const sizeUpper = size.toUpperCase()
  if (sizeUpper.includes('TB')) return 'tb'
  if (sizeUpper.includes('GB')) return 'gb'
  if (sizeUpper.includes('MB')) return 'mb'
  return 'unknown'
}

const getStorageTypeLabel = (size: string): string => {
  const type = getStorageType(size)
  switch (type) {
    case 'tb': return 'TB级'
    case 'gb': return 'GB级'
    case 'mb': return 'MB级'
    default: return '未知'
  }
}

const getStorageUnitClass = (unit: string | null | undefined): string => {
  const storageUnit = (unit || '').toLowerCase()
  switch (storageUnit) {
    case 'tb': return 'unit-tb'
    case 'gb': return 'unit-gb'
    case 'mb': return 'unit-mb'
    case 'kb': return 'unit-kb'
    default: return 'unit-default'
  }
}

const loadMemories = async (bustCache: boolean = false, silentError: boolean = false, showLoadingState: boolean = true) => {
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('内存管理', 'memories:view')
    }
    memories.value = []
    return
  }

  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      sortBy: 'sort_order',
      sortOrder: 'asc'
    }

    // 添加搜索参数
    if (searchForm.value.size) params.search = searchForm.value.size
    if (searchForm.value.status !== '') params.is_active = searchForm.value.status

    // 如果需要清除缓存
    if (bustCache) {
      params._t = Date.now()
    }

    const response = await unifiedApi.get('/memories', { params })

    if (response.success) {
      memories.value = response.data.memories || []
      // 确保 total 是数字类型
      const apiPagination = response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 }
      pagination.value = {
        ...apiPagination,
        total: Number(apiPagination.total) || 0,
        pages: Number(apiPagination.pages) || 0
      }

      // 按 sort_order 排序，确保序号和排序值一致
      memories.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      memories.value = []
      pagination.value = { page: 1, limit: 50, total: 0, pages: 0 }
      if (!silentError) {
        error(`获取内存规格列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (err: any) {
    logger.error('获取内存规格列表失败:', err)
    memories.value = []
    pagination.value = { page: 1, limit: 50, total: 0, pages: 0 }

    // 静默处理页面卸载导致的取消错误
    if (err.name === 'CanceledError') {
      return
    }

    if (!silentError) {
      // 处理权限错误
      if (err.response?.status === 403) {
        error('权限不足：您没有权限查看内存规格列表，请联系管理员分配相应权限')
      } else if (err.response?.status === 401) {
        error('认证失败：您的登录状态已过期，请重新登录')
        // 可以在这里触发登出逻辑
      } else {
        error('获取内存规格列表失败', err.response?.data?.message || err.message || '未知错误')
      }
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const searchMemories = () => {
  pagination.value.page = 1
  loadMemories()
}

const resetSearch = () => {
  searchForm.value = {
    size: '',
    status: ''
  }
  pagination.value.page = 1
  loadMemories()
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadMemories()
}

const handlePaginationChange = (page, pageSize) => {
  pagination.value.page = page
  pagination.value.limit = pageSize
  if (pageSize !== pagination.value.limit) {
    pagination.value.page = 1
  }
  loadMemories()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadMemories(true, false, false)
  })
  success('数据刷新成功', { duration: 2000 })
}

const editMemory = (memory: Memory) => {
  // 先检查编辑权限
  if (!canEdit.value) {
    showEditDenied('内存管理', 'memories:edit')
    return
  }

  currentEditingId.value = memory.id

  formData.value = {
    size: memory.size || memory.name || memory.display_name || '',
    status: memory.status !== undefined ? (memory.status === 1 ? 1 : 0) : (memory.is_active ? 1 : 0),
    sort_order: memory.sort_order || 0
  }

  showEditModal.value = true
}

const deleteMemory = async (memory: Memory) => {
  // 先检查删除权限
  if (!canDelete.value) {
    showDeleteDenied('内存管理', 'memories:delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除内存规格"${memory.name || memory.display_name}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/memories/${memory.id}`)

    if (response.success) {
      success(response.message || '内存规格删除成功')
      // 延迟一下刷新，确保后端操作完成
      setTimeout(() => {
        loadMemories()
      }, 300)
    } else {
      error(`删除内存规格失败: ${response.message || '未知错误'}`)
    }
  } catch (err: any) {
    logger.error('删除内存规格失败:', err)
    handleApiError(err, '删除内存规格失败')
  }
}

const submitForm = async () => {
  // 权限检查
  if (showCreateModal.value && !canCreate.value) {
    showCreateDenied('内存管理', 'memories:create')
    return
  }

  if (showEditModal.value && !canEdit.value) {
    showEditDenied('内存管理', 'memories:edit')
    return
  }

  submitting.value = true

  try {
    let response

    if (showCreateModal.value) {
      response = await unifiedApi.post('/memories', formData.value, { showError: false })
      if (response.success) {
        success('操作成功', response.message || '内存规格创建成功')
        closeModal()
        setTimeout(() => {
          loadMemories()
        }, 300)
      } else {
        error('创建内存规格失败', response.message || '未知错误')
      }
    } else {
      if (!currentEditingId.value) {
        error('操作失败：无法获取内存规格ID')
        submitting.value = false
        return
      }
      response = await unifiedApi.put(`/memories/${currentEditingId.value}`, formData.value, { showError: false })
      if (response.success) {
        success('操作成功', response.message || '内存规格更新成功')
        closeModal()
        setTimeout(() => {
          loadMemories()
          // 二次验证：确保数据更新成功
          setTimeout(() => {
            const updatedMemory = memories.value.find(m => m.id === currentEditingId.value)
            if (updatedMemory && updatedMemory.size !== formData.value.size) {
              loadMemories()
            }
          }, 200)
        }, 300)
      } else {
        error('更新内存规格失败', response.message || '未知错误')
      }
    }
  } catch (err: any) {
    logger.error('提交表单失败:', err)
    // 这里 handleApiError 会显示统一的错误消息
    handleApiError(err, showCreateModal.value ? '创建内存规格失败' : '更新内存规格失败')
  } finally {
    submitting.value = false
  }
}

// 检查是否有未保存的更改
const hasUnsavedChanges = (): boolean => {
  if (!showCreateModal.value && !showEditModal.value) return false

  // 检查是否有任何非空字段的更改
  const currentForm = formData.value
  const initialForm = {
    size: '',
    status: 1,
    sort_order: 0
  }

  // 对于编辑模式，需要比较原始数据
  if (showEditModal.value && currentEditingId.value) {
    const originalMemory = memories.value.find(m => m.id === currentEditingId.value)
    if (originalMemory) {
      return (
        currentForm.size !== originalMemory.size ||
        currentForm.status !== originalMemory.status ||
        currentForm.sort_order !== originalMemory.sort_order
      )
    }
  }

  // 对于创建模式，检查是否有任何输入
  return (
    currentForm.size !== '' ||
    currentForm.status !== 1 ||
    currentForm.sort_order !== 0
  )
}

// 关闭模态框（带确认）
const attemptCloseModal = () => {
  if (hasUnsavedChanges()) {
    if (confirm('您有未保存的更改，确定要关闭吗？')) {
      closeModal()
    }
  } else {
    closeModal()
  }
}

// 关闭模态框
const closeModal = () => {
  showCreateModal.value = false
  showEditModal.value = false
  currentEditingId.value = null
  formData.value = {
    size: '',
    status: 1,
    sort_order: 0
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

const getPhoneCount = () => {
  // 这里应该从后端获取相关手机数量，暂时返回模拟数据
  return Math.floor(Math.random() * 40) + 8
}

// 处理新增内存规格
const handleCreateMemory = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令，但双保险）
  if (!canCreate.value) {
    error('权限不足：您没有创建内存规格的权限，如需操作请联系管理员')
    return
  }

  showCreateModal.value = true
}

// 拖拽排序方法
const handleDragStart = (index: number, event: DragEvent) => {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragEnd = () => {
  draggingIndex.value = null
  dragOverIndex.value = null
}

const handleDragOver = (index: number, event: DragEvent) => {
  event.preventDefault()
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragEnter = (index: number) => {
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragLeave = () => {
  // 不清除 dragOverIndex，避免闪烁
}

const handleDrop = async (dropIndex: number, event: DragEvent) => {
  event.preventDefault()
  const dragIndex = draggingIndex.value
  if (dragIndex === null || dragIndex === dropIndex) {
    handleDragEnd()
    return
  }

  // 重新排列数组
  const newMemories = [...memories.value]
  const [movedItem] = newMemories.splice(dragIndex, 1)
  newMemories.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newMemories.forEach((item, index) => {
    item.sort_order = index
  })

  memories.value = newMemories

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadMemories(true, false, false)

  handleDragEnd()
}

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return
  if (!canEdit.value) {
    showEditDenied('内存管理', 'memories:edit')
    return
  }

  savingOrder.value = true
  try {
    const items = memories.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/memories/batch/reorder', { items })
    if (response.success) {
      success('排序已保存')
    }
  } catch (error) {
    logger.error('保存排序失败:', error)
    // 使用统一的权限错误处理
    handleApiErrorWithPermission(error, '保存排序失败', '内存管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  memories.value[index].sort_order = value
  // 按新的 sort_order 重新排序
  memories.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  await saveSortOrder()
}

// 生命周期
onMounted(() => {
  if (!canView.value) {
    return
  }

  initFieldPermissions().finally(() => {
    loadMemories()
  })
})

</script>

<style scoped>
.memories-view {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 用户信息区域和操作按钮区域样式 */
.user-info-section {
  display: flex;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* 统计卡片样式 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  border: 1px solid #e8ecef;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.inactive {
  background: linear-gradient(135deg, #dc3545, #fd7e14);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f8f9fa;
}

.section-title i {
  color: #667eea;
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: #6c757d;
  font-weight: 400;
}

.form-help {
  margin-top: 4px;
}

.form-help small {
  color: #6c757d;
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
}

/* 按钮样式 */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline-secondary {
  background: white;
  color: #6c757d;
  border: 2px solid #e8ecef;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #6c757d;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* 表格区域样式 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid #e8ecef;
}

.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.table th {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  border-right: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  position: relative;
  white-space: nowrap;
}

.table th:last-child {
  border-right: none;
}

.table td {
  padding: 6px 6px;
  font-size: 14px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  text-align: center;
  color: #2c3e50;
  font-weight: 500;
}

.table td:last-child {
  border-right: none;
}

.table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.table tbody tr:hover {
  background: #e3f2fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.table tbody tr:hover td {
  border-bottom-color: #dee2e6;
}

.table tbody tr.is-dragging {
  opacity: 0.5;
  background: #eff6ff !important;
}

.table tbody tr.is-drag-over {
  background: #f0f9ff !important;
  border-top: 2px solid #3b82f6;
}

/* 拖拽手柄 */
.drag-handle-cell {
  padding: 8px 4px !important;
  text-align: center;
  cursor: move;
  user-select: none;
}

.drag-handle {
  color: #9ca3af;
  font-size: 16px;
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.2s;
}

.drag-handle:hover {
  color: #3b82f6;
  background: #eff6ff;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-handle.disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.drag-handle.disabled:hover {
  color: #9ca3af;
  background: transparent;
}

/* 排序输入框 */
.sort-order-input {
  width: 50px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: all 0.2s;
}

.sort-order-input:focus:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.sort-order-input:hover:not(:disabled) {
  border-color: #9ca3af;
}

.sort-order-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f3f4f6;
}

/* 表格内容样式 */
.id-badge {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.memory-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.memory-size {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.warning-badge {
  background: #ffc107;
  color: #212529;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.storage-type {
  display: flex;
  align-items: center;
}

.type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.type-badge.tb {
  background: #fff3cd;
  color: #856404;
}

.type-badge.gb {
  background: #d1ecf1;
  color: #0c5460;
}

.type-badge.mb {
  background: #f8d7da;
  color: #721c24;
}

.type-badge.unknown {
  background: #e9ecef;
  color: #495057;
}

.memory-desc {
  font-size: 12px;
  color: #6c757d;
  margin-top: 4px;
  line-height: 1.4;
}

.storage-type {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storage-spec {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.storage-size {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.storage-unit {
  font-size: 14px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

/* 存储单位颜色样式 */
.storage-unit.unit-tb {
  background: #fff3cd;
  color: #856404;
}

.storage-unit.unit-gb {
  background: #d1ecf1;
  color: #0c5460;
}

.storage-unit.unit-mb {
  background: #f8d7da;
  color: #721c24;
}

.storage-unit.unit-kb {
  background: #e2e3e5;
  color: #383d41;
}

.storage-unit.unit-default {
  background: #e9ecef;
  color: #495057;
}


.sort-order {
  display: flex;
  align-items: center;
}

.sort-badge {
  background: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.time-info {
  font-size: 13px;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-width: 60px;
  justify-content: center;
}

.btn-action i {
  font-size: 12px;
}

.btn-edit {
  background: #007bff;
  color: white;
}

.btn-edit:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
}

/* 加载和空状态样式 */
.loading-row td {
  padding: 40px 12px;
  text-align: center;
}

.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6c757d;
  font-size: 16px;
}

.empty-row td {
  padding: 60px 12px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #6c757d;
}

.empty-content i {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text h4 {
  margin: 0 0 8px 0;
  color: #495057;
}

.empty-text p {
  margin: 0;
  font-size: 14px;
}


.required {
  color: #dc3545;
}


/* 响应式设计 */
@media (max-width: 767px) {
  .memories-view {
    padding: 8px;
  }

  /* 页头内容保持水平一行显示 */
  .header-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .action-buttons {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 8px;
  }

  .action-buttons .btn {
    flex: 0 0 auto;
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .user-info-section {
    order: 2;
    width: 100%;
    justify-content: center;
  }

  .action-buttons {
    order: 1;
    width: 100%;
    justify-content: center;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 16px;
  }

  
  .memory-info {
    max-width: 150px;
  }
}

/* ===== 统一权限提示样式 ===== */
.permission-denied {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.permission-denied-wrapper {
  width: 100%;
  max-width: 1200px;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

.permission-denied-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  text-align: center;
  width: 100%;
  max-width: 600px;
  border: 1px solid #e4e7ed;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 25%, #feca57 50%, #48dbfb 75%, #0abde3 100%);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
}

.permission-icon {
  margin-bottom: 2rem;

  i {
    font-size: 5rem;
    color: #f56c6c;
  }
}

.permission-content h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #303133;
  margin-bottom: 1rem;
}

.permission-message {
  font-size: 1.1rem;
  color: #606266;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.permission-status {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;

  &.has-menu {
    background-color: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;

    i {
      color: #0284c7;
    }
  }

  &.missing-view {
    background-color: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;

    i {
      color: #dc2626;
    }
  }
}

.permission-info {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;

  label {
    font-weight: 600;
    color: #495057;
    min-width: 100px;
  }

  .permission-name {
    color: #28a745;
    font-weight: 500;
  }

  .permission-code {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    color: #495057;
  }
}

.permission-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 2rem;

  i {
    color: #0284c7;
    margin-top: 0.25rem;
  }

  p {
    margin: 0;
    color: #0c4a6e;
    font-size: 0.95rem;
    line-height: 1.5;
  }
}

.permission-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.permission-details {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e4e7ed;

  h4 {
    font-size: 1.1rem;
    color: #303133;
    margin-bottom: 1rem;
  }
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.permission-tag {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 16px;
  font-size: 0.8rem;
  color: #6c757d;
  font-family: monospace;

  &.current-module {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #1976d2;
    font-weight: 500;
  }
}

</style>
<style>
.memories-dialog-form .el-form-item:last-child {
  margin-bottom: 0;
}

.memories-dialog-form .el-input,
.memories-dialog-form .el-input-number,
.memories-dialog-form .el-select,
.memories-dialog-form .el-radio-group {
  width: 100%;
}

@media (max-width: 767px) {
  .memories-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .memories-view .stat-card {
    padding: 14px 12px;
    border-radius: 16px;
    gap: 12px;
  }

  .memories-view .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .memories-view .stat-value {
    font-size: 20px;
  }

  .memories-view .stat-label {
    font-size: 12px;
  }

  .memories-view .table-section {
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
  }

  .memories-view .table-responsive {
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }

  .memories-view .table {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
  }

  .memories-view .table th,
  .memories-view .table td {
    white-space: normal;
    word-break: break-word;
  }

  .memories-view .memory-info {
    width: 100%;
    max-width: none;
  }

  .memories-view .memory-size {
    line-height: 1.4;
    text-align: center;
  }

  .memories-view .memory-desc {
    margin-top: 4px;
    line-height: 1.4;
    text-align: center;
  }

  .memories-view .status-badge {
    width: 100%;
    max-width: 88px;
    justify-content: center;
    white-space: normal;
    line-height: 1.35;
    padding: 6px 8px;
  }

  .memories-dialog-form .el-form-item {
    margin-bottom: 12px;
  }

  .memories-dialog-form .el-form-item__label {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .memories-dialog-form .el-input__wrapper,
  .memories-dialog-form .el-input-number .el-input__wrapper,
  .memories-dialog-form .el-select__wrapper {
    min-height: 42px;
    border-radius: 12px;
  }

  .memories-dialog-form .el-radio-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .memories-dialog-form .el-radio {
    margin-right: 0;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }
}

@media (max-width: 480px) {
  .memories-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px 0;
    padding: 0;
  }

  .memories-view .stat-card {
    padding: 12px 10px;
    gap: 10px;
  }

  .memories-view .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .memories-view .stat-value {
    font-size: 18px;
  }

  .memories-view .stat-label {
    font-size: 11px;
  }

  .mobile-action-row td {
    padding: 6px 4px 10px !important;
    background: linear-gradient(180deg, #f8fbff 0%, #f4f7ff 100%);
    border-top: none !important;
  }

  .memories-view .table th,
  .memories-view .table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .memories-view .table th:nth-child(1),
  .memories-view .table td:nth-child(1) {
    width: 56px;
  }

  .memories-view .table th:nth-child(2),
  .memories-view .table td:nth-child(2) {
    width: auto;
  }

  .memories-view .table th:nth-child(3),
  .memories-view .table td:nth-child(3) {
    width: 92px;
  }

  .memories-view .memory-size {
    font-size: 14px;
    font-weight: 700;
  }

  .mobile-sub-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.35;
    color: #5f6b7a;
    text-align: center;
  }

  .mobile-sub-label {
    flex: 0 0 auto;
    padding: 2px 6px;
    border-radius: 999px;
    background: #eef4ff;
    color: #4c6ef5;
    font-weight: 600;
  }

  .mobile-sub-value {
    min-width: 0;
    font-weight: 600;
  }

}
</style>
