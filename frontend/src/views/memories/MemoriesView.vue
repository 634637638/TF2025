<template>
  <div class="memories-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      module-name="内存管理"
      permission-code="memories:view"
    >
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
            <i class="fas fa-plus" />
            <span>新增</span>
          </el-button>
          <el-button
            type="info"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <InlineLoading
              v-if="refreshing"
              text="刷新中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-sync-alt" />
              <span>刷新</span>
            </template>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
        <!-- 统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewField('stats_total_memories')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-memory" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total }}
              </div>
              <div class="stat-label">
                内存规格总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_active_memories')"
            class="stat-card stat-card--success"
          >
            <div class="stat-icon">
              <i class="fas fa-check-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.active }}
              </div>
              <div class="stat-label">
                启用规格
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_inactive_memories')"
            class="stat-card stat-card--danger"
          >
            <div class="stat-icon">
              <i class="fas fa-pause-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.inactive }}
              </div>
              <div class="stat-label">
                禁用规格
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_related_phones')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-mobile-alt" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.related_phones }}
              </div>
              <div class="stat-label">
                相关手机
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="tableLoading"
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
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            v-if="canViewField('status')"
            class="form-group filter-item"
            data-field="status"
          >
            <el-select
              v-model="searchForm.status"
              placeholder="状态"
              clearable
              @change="searchMemories"
            >
              <el-option
                label="启用"
                value="1"
              />
              <el-option
                label="禁用"
                value="0"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <!-- 数据表格区域 -->
        <div class="table-section admin-panel admin-table-panel">
          <div class="section-title">
            <i class="fas fa-list" />
            内存规格列表
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>

          <div class="table-responsive">
            <el-table
              ref="memoriesTableRef"
              :data="tableLoading ? [] : memories"
              border
              stripe
              class="data-table devices-table base-data-table memories-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getMemoryRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="(row) => handleMobileRowTap(row.id)"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="tableLoading"
                  mode="block"
                  text="加载内存规格..."
                />
                <DataEmptyState
                  v-else
                  description="暂无内存规格数据"
                >
                  <el-button
                    size="small"
                    type="info"
                    @click="loadMemories()"
                  >
                    重新加载
                  </el-button>
                </DataEmptyState>
              </template>
              <el-table-column
                v-if="showSortField"
                width="44"
                align="center"
                class-name="drag-handle-cell"
              >
                <template #default>
                  <div
                    class="drag-handle"
                    :class="{ disabled: !canEdit }"
                  >
                    <i class="fas fa-grip-vertical" />
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showSortOrderField"
                label="排序"
                width="70"
                align="center"
              >
                <template #default="{ row, $index }">
                  <input
                    v-model.number="row.sort_order"
                    type="number"
                    class="sort-order-input"
                    :disabled="!canEdit"
                    min="0"
                    max="9999"
                    @change="handleSortOrderChange($index, row.sort_order)"
                  >
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('id')"
                label="序号"
                :width="isMobile ? 54 : 70"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="id-badge">{{ $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('capacity')"
                label="内存规格"
                :min-width="memorySpecColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <div class="memory-info">
                    <strong>{{ row.size || '未命名规格' }}</strong>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showTypeField"
                label="存储大小"
                :min-width="storageColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <div class="storage-spec">
                    <span class="storage-size">{{ row.storage_size ?? 'N/A' }}</span><span
                      class="storage-unit"
                      :class="getStorageUnitClass(row.storage_unit)"
                    >{{ row.storage_unit || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('status')"
                label="状态"
                :min-width="isMobile ? 72 : 84"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', row.status === 1 ? 'status-active' : 'status-inactive']"><i :class="row.status === 1 ? 'fas fa-check' : 'fas fa-times'" />{{ row.status === 1 ? '启用' : '禁用' }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showCreatedAtField"
                label="创建时间"
                min-width="156"
                align="center"
              >
                <template #default="{ row }">
                  <div class="time-info">
                    <i class="fas fa-clock" />{{ formatDate(row.created_at) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showActionField"
                label="操作"
                :width="$getActionColumnWidth(Number(canEdit) + Number(canDelete))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      v-if="canEdit"
                      v-permission="'memories:edit'"
                      type="primary"
                      size="small"
                      @click.stop="editMemory(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'memories:delete'"
                      type="danger"
                      size="small"
                      @click.stop="deleteMemory(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile && (canEdit || canDelete)"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button
                      v-if="canEdit"
                      v-permission="'memories:edit'"
                      type="primary"
                      size="small"
                      @click.stop="editMemory(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'memories:delete'"
                      type="danger"
                      size="small"
                      @click.stop="deleteMemory(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 分页组件 -->
          <Pagination
            v-if="pagination.total > 0"
            v-model:current="pagination.page"
            v-model:page-size="pagination.page_size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            :show-total="true"
            :show-range="true"
            :show-page-sizes="true"
            :show-quick-jumper="true"
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
          :show-default-footer="false"
          @close="attemptCloseModal"
        >
          <el-form
            :model="formData"
            label-width="90px"
            class="memories-dialog-form"
          >
            <el-form-item
              v-if="canViewField('capacity')"
              label="内存规格"
              required
            >
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
            <el-form-item
              v-if="canViewField('sort_order')"
              label="排序"
            >
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
            <el-form-item
              v-if="canViewField('status')"
              label="状态"
            >
              <el-radio-group
                v-model="formData.status"
                :disabled="!canEditField('status')"
              >
                <el-radio :value="1">
                  启用
                </el-radio>
                <el-radio :value="0">
                  禁用
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button
              type="default"
              @click="attemptCloseModal"
            >
              取消
            </el-button>
            <el-button
              type="primary"
              :disabled="submitting"
              :loading="submitting"
              @click="submitForm"
            >
              <span v-if="submitting">{{ isEditMode ? '更新中...' : '创建中...' }}</span>
              <template v-else>
                {{ isEditMode ? '更新' : '创建' }}
              </template>
            </el-button>
          </template>
        </MobileDialog>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import Pagination from '../../components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { logger } from '@/utils/logger'
import { useElementTableSortable } from '@/composables/useElementTableSortable'
import { getTextColumnMinWidth } from '@/utils/table-layout'

// 获取路由实例
const _router = useRouter()
// 使用统一的 composable
const { success, error, warning: _warning, info: _info, handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('memories')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const { init: initFieldPermissions } = fieldPermissions
const memoryListRequest = useLatestRequest()

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
const showActionField = computed(() => (
  shouldShowActionColumn(canViewField('actions'), [canEdit.value, canDelete.value]) && !isMobile.value
))
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showTypeField = computed(() => canViewField('type'))
const showStatsCards = computed(() => (
  canViewField('stats_total_memories') ||
  canViewField('stats_active_memories') ||
  canViewField('stats_inactive_memories') ||
  canViewField('stats_related_phones')
))
interface Memory {
  id: number
  size: string // 原始规格值，如 "64GB" 或 "6+128GB"
  storage_size: number | null
  storage_unit: string | null
  is_combo?: boolean // 是否为组合格式
  status: number
  sort_order: number
  created_at: string | null
  updated_at: string | null
}

const memoriesTableRef = ref<any>(null)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  const rowKey = String(id)
  mobileActionRowId.value = mobileActionRowId.value === rowKey ? null : rowKey
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return
  const rowKey = String(id)

  const now = Date.now()
  if (lastTappedRowId.value === rowKey && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = rowKey
  lastTapTimestamp.value = now
}

// 响应式数据
// 搜索相关状态
const searchExpanded = ref(false)
const tableLoading = ref(true)
const submitting = ref(false)
const savingOrder = ref(false)
const memories = ref<Memory[]>([])
const stats = ref({ total: 0, active: 0, inactive: 0, related_phones: 0 })
const getMemoryRowKey = (memory: Memory) => String(memory.id)
const memorySpecColumnWidth = computed(() => getTextColumnMinWidth(
  ['内存规格', ...memories.value.map(memory => memory.size || '未命名规格')],
  {
    minWidth: isMobile.value ? 104 : 130,
    horizontalPadding: isMobile.value ? 20 : 32,
    asciiCharacterWidth: isMobile.value ? 7 : 8,
    wideCharacterWidth: isMobile.value ? 11 : 13
  }
))
const storageColumnWidth = computed(() => getTextColumnMinWidth(
  ['存储大小', ...memories.value.map(memory => `${memory.storage_size ?? 'N/A'}${memory.storage_unit || ''}`)],
  {
    minWidth: isMobile.value ? 86 : 110,
    horizontalPadding: isMobile.value ? 24 : 32,
    asciiCharacterWidth: isMobile.value ? 7 : 8,
    wideCharacterWidth: isMobile.value ? 11 : 13
  }
))
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentEditingId = ref<number | null>(null)

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
  page_size: 100,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
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

const _getStorageTypeLabel = (size: string): string => {
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

const loadMemories = async (bustCache: boolean = false, silentError: boolean = false, _showLoadingState: boolean = true) => {
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('内存管理', 'memories:view')
    }
    memories.value = []
    tableLoading.value = false
    return
  }

  if (_showLoadingState) {
    tableLoading.value = true
  }

  try {
    const params: any = {
      page: pagination.value.page,
      page_size: pagination.value.page_size,
      sort_by: 'sort_order',
      sort_order: 'asc'
    }

    // 添加搜索参数
    if (searchForm.value.size) params.size = searchForm.value.size
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    // 如果需要清除缓存
    if (bustCache) {
      params._t = Date.now()
    }

    const request = memoryListRequest.nextRequest()
    const response = await unifiedApi.get('/memories', {
      params,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      memories.value = response.data.memories || []
      // 确保 total 是数字类型
      const apiPagination = response.data.pagination || {}
      pagination.value = {
        page: Number(apiPagination.page) || 1,
        page_size: Number(apiPagination.page_size) || 100,
        total: Number(apiPagination.total) || 0,
        total_pages: Number(apiPagination.total_pages) || 0,
        has_next: apiPagination.has_next === true,
        has_prev: apiPagination.has_prev === true
      }

      // 按 sort_order 排序，确保序号和排序值一致
      memories.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      memories.value = []
      pagination.value = { page: 1, page_size: 100, total: 0, total_pages: 0, has_next: false, has_prev: false }
      if (!silentError) {
        error(`获取内存规格列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (err: any) {
    if (memoryListRequest.isCanceledError(err)) {
      return
    }

    logger.error('获取内存规格列表失败:', err)
    memories.value = []
    pagination.value = { page: 1, page_size: 100, total: 0, total_pages: 0, has_next: false, has_prev: false }

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
    if (_showLoadingState) {
      tableLoading.value = false
    }
  }
}

const searchMemories = () => {
  pagination.value.page = 1
  void Promise.all([loadMemories(true), loadStats()])
}

const resetSearch = () => {
  searchForm.value = {
    size: '',
    status: ''
  }
  pagination.value.page = 1
  void Promise.all([loadMemories(true), loadStats()])
}

const _changePage = (page: number) => {
  pagination.value.page = page
  loadMemories()
}

const handlePaginationChange = (page, pageSize) => {
  const oldPageSize = pagination.value.page_size
  pagination.value.page_size = pageSize
  pagination.value.page = pageSize !== oldPageSize ? 1 : page
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
    size: memory.size,
    status: memory.status === 1 ? 1 : 0,
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
      `确定要删除内存规格"${memory.size}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/memories/${memory.id}`)

    if (response.success) {
      success(response.message || '内存规格删除成功')
      await loadMemories(true, false, false)
    } else {
      error(`删除内存规格失败: ${response.message || '未知错误'}`)
    }
  } catch (err: any) {
    logger.error('删除内存规格失败:', err)
    handleApiError(err, '删除内存规格失败')
  }
}

const submitForm = async () => {
  if (submitting.value) return
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
        await loadMemories(true, false, false)
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
        await loadMemories(true, false, false)
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
  const _initialForm = {
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

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

const loadStats = async () => {
  try {
    const params: Record<string, string> = {}
    if (searchForm.value.size) params.size = searchForm.value.size.trim()
    if (searchForm.value.status !== '') params.status = searchForm.value.status
    const response = await unifiedApi.get('/memories/stats/overview', { params })
    if (response.success) {
      const data = response.data || {}
      stats.value = {
        total: Number(data.total) || 0,
        active: Number(data.active) || 0,
        inactive: Number(data.inactive) || 0,
        related_phones: Number(data.related_phones) || 0
      }
    }
  } catch (error) {
    logger.error('获取内存规格统计失败:', error)
    stats.value = { total: 0, active: 0, inactive: 0, related_phones: 0 }
  }
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

const handleMemoryRowMove = async (oldIndex: number, newIndex: number) => {
  if (!canEdit.value || oldIndex === newIndex) return false
  const reordered = [...memories.value]
  const [movedItem] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, movedItem)
  reordered.forEach((item, index) => { item.sort_order = index })
  memories.value = reordered
  await saveSortOrder()
  await loadMemories(true, false, false)
  return true
}

useElementTableSortable({
  tableRef: memoriesTableRef,
  enabled: computed(() => canEdit.value && !isMobile.value && showSortField.value),
  orderKey: () => memories.value.map(memory => memory.id).join('|'),
  onMove: handleMemoryRowMove
})

// 生命周期
onMounted(() => {
  if (!canView.value) {
    return
  }

  initFieldPermissions().finally(() => {
    Promise.all([loadMemories(), loadStats()])
  })
})

</script>

<style scoped>
.memories-view {
  padding: 24px;
  background: var(--tf-color-surface);
  min-height: 100vh;
}

/* 用户信息区域和操作按钮区域样式 */
.user-info-section {
  display: flex;
  align-items: center;
}

.action-buttons {
  display: flex;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--tf-color-heading);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--tf-color-surface-muted);
}

.section-title i {
  color: var(--tf-color-indigo-brand);
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: var(--tf-color-muted);
  font-weight: 400;
}

.form-help {
  margin-top: 4px;
}

.form-help small {
  color: var(--tf-color-muted);
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
}

/* 表格区域样式 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid var(--tf-color-border-cool);
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
  background: linear-gradient(135deg, var(--tf-color-gray-bootstrap-700) 0%, var(--tf-color-gray-bootstrap-800) 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  border-right: 1px solid var(--tf-color-border-subtle);
  border-bottom: 2px solid var(--tf-color-border-subtle);
  position: relative;
  white-space: nowrap;
}

.table th:last-child {
  border-right: none;
}

.table td {
  padding: 6px 6px;
  font-size: 14px;
  border-right: 1px solid var(--tf-color-border-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
  vertical-align: middle;
  text-align: center;
  color: var(--tf-color-heading);
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
  background: var(--tf-color-surface-muted);
}

.table tbody tr:hover {
  background: var(--tf-color-blue-100);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.table tbody tr:hover td {
  border-bottom-color: var(--tf-color-border-subtle);
}

.table tbody tr.is-dragging {
  opacity: 0.5;
  background: var(--tf-color-blue-tailwind-50) !important;
}

.table tbody tr.is-drag-over {
  background: var(--tf-color-blue-50) !important;
  border-top: 2px solid var(--tf-color-blue-500);
}

/* 拖拽手柄 */
.drag-handle-cell {
  padding: 8px 4px !important;
  text-align: center;
  cursor: move;
  user-select: none;
}

.drag-handle {
  color: var(--tf-color-neutral-400);
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
  color: var(--tf-color-blue-500);
  background: var(--tf-color-blue-tailwind-50);
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
  color: var(--tf-color-neutral-400);
  background: transparent;
}

/* 排序输入框 */
.sort-order-input {
  width: 50px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--tf-color-neutral-300);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: all 0.2s;
}

.sort-order-input:focus:not(:disabled) {
  border-color: var(--tf-color-blue-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.sort-order-input:hover:not(:disabled) {
  border-color: var(--tf-color-neutral-400);
}

.sort-order-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--tf-color-neutral-100);
}

/* 表格内容样式 */
.id-badge {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.memory-info {
  width: 100%;
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
  background: var(--warning-color);
  color: var(--tf-color-gray-bootstrap-900);
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
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
}

.type-badge.gb {
  background: var(--tf-color-cyan-legacy-surface);
  color: var(--tf-color-cyan-legacy-text);
}

.type-badge.mb {
  background: var(--tf-color-danger-legacy);
  color: var(--tf-color-danger-text-legacy);
}

.type-badge.unknown {
  background: var(--tf-color-border-muted);
  color: var(--tf-color-gray-bootstrap-700);
}

.memory-desc {
  font-size: 12px;
  color: var(--tf-color-muted);
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
  justify-content: center;
  gap: 4px;
  width: 100%;
}

.storage-size {
  font-size: 16px;
  font-weight: 600;
  color: var(--tf-color-heading);
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
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
}

.storage-unit.unit-gb {
  background: var(--tf-color-cyan-legacy-surface);
  color: var(--tf-color-cyan-legacy-text);
}

.storage-unit.unit-mb {
  background: var(--tf-color-danger-legacy);
  color: var(--tf-color-danger-text-legacy);
}

.storage-unit.unit-kb {
  background: var(--tf-color-gray-material-300);
  color: var(--tf-color-gray-bootstrap-800);
}

.storage-unit.unit-default {
  background: var(--tf-color-border-muted);
  color: var(--tf-color-gray-bootstrap-700);
}


.sort-order {
  display: flex;
  align-items: center;
}

.sort-badge {
  background: var(--tf-color-border-muted);
  color: var(--tf-color-gray-bootstrap-700);
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
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-inactive {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

.time-info {
  font-size: 13px;
  color: var(--tf-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.actions {
  vertical-align: middle;
  text-align: center;
}

.actions .action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  color: var(--tf-color-muted);
}

.empty-content i {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text h4 {
  margin: 0 0 8px 0;
  color: var(--tf-color-gray-bootstrap-700);
}

.empty-text p {
  margin: 0;
  font-size: 14px;
}


.required {
  color: var(--danger-color);
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

  .form-actions {
    flex-direction: column;
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
    border: 1px solid var(--tf-color-border-blue);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }
}

</style>
