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
            :loading="refreshing"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <i class="fas fa-sync-alt" />
            <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
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
              v-tf-loading="tableLoading"
              :data="memories"
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
                <template #default="{ row }">
                  <el-input-number
                    :key="`${row.id}:${savingOrder}`"
                    :model-value="row.sort_order"
                    class="sort-order-control"
                    :disabled="!canEdit || savingOrder || tableLoading"
                    :min="0"
                    :max="9999"
                    :controls="false"
                    @change="handleSortOrderChange(row.id, $event)"
                  />
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('id')"
                label="序号"
                :width="$getNumberColumnWidth((memories || []).map((_row, $index) => (pagination.page - 1) * pagination.page_size + $index + 1), isMobile ? 54 : 70)"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="table-number-badge">{{ (pagination.page - 1) * pagination.page_size + $index + 1 }}</span>
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
                    <i class="fas fa-clock" />{{ formatDateTime(row.created_at) }}
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
                :controls="false"
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
            <div class="tf-dialog-actions">
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
            </div>
          </template>
        </MobileDialog>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import Pagination from '../../components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { useMobile } from '@/composables/mobile'
import { useMobileRowDoubleTap } from '@/composables/useMobileRowDoubleTap'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { logger } from '@/utils/logger'
import { useElementTableSortable } from '@/composables/useElementTableSortable'
import { useReferenceOrdering } from '@/composables/useReferenceOrdering'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { getTextColumnMinWidth } from '@/utils/table-layout'
import { formatDateTime } from '@/utils/format'
import { getRequestErrorMessage, getRequestErrorStatus } from '@/utils/api-response'
import type { QueryParams } from '@/types/shared'

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

const memoriesTableRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
const mobileActionRowId = ref<string | null>(null)
const { isDoubleTap } = useMobileRowDoubleTap()

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  const rowKey = String(id)
  mobileActionRowId.value = mobileActionRowId.value === rowKey ? null : rowKey
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return
  if (isDoubleTap(String(id))) toggleMobileActions(id)
}

// 响应式数据
// 搜索相关状态
const searchExpanded = ref(false)
const tableLoading = ref(true)
const submitting = ref(false)
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
    const params: QueryParams = {
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
      useCache: !bustCache,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      memories.value = sortOptionsByOrder(response.data.memories || [])
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

    } else {
      memories.value = []
      pagination.value = { page: 1, page_size: 100, total: 0, total_pages: 0, has_next: false, has_prev: false }
      if (!silentError) {
        error(`获取内存规格列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (err: unknown) {
    if (memoryListRequest.isCanceledError(err)) {
      return
    }

    logger.error('获取内存规格列表失败:', err)
    memories.value = []
    pagination.value = { page: 1, page_size: 100, total: 0, total_pages: 0, has_next: false, has_prev: false }

    if (!silentError) {
      // 处理权限错误
      if (getRequestErrorStatus(err) === 403) {
        error('权限不足：您没有权限查看内存规格列表，请联系管理员分配相应权限')
      } else if (getRequestErrorStatus(err) === 401) {
        error('认证失败：您的登录状态已过期，请重新登录')
        // 可以在这里触发登出逻辑
      } else {
        error(`获取内存规格列表失败：${getRequestErrorMessage(err, '未知错误')}`)
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

const handlePaginationChange = (page: number, pageSize: number): void => {
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
    if (!await confirm(
      `确定要删除内存规格"${memory.size}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )) return
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
  } catch (err: unknown) {
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
        success(response.message || '内存规格创建成功', { title: '操作成功' })
        closeModal()
        await loadMemories(true, false, false)
      } else {
        error(response.message || '未知错误', { title: '创建内存规格失败' })
      }
    } else {
      if (!currentEditingId.value) {
        error('操作失败：无法获取内存规格ID')
        submitting.value = false
        return
      }
      response = await unifiedApi.put(`/memories/${currentEditingId.value}`, formData.value, { showError: false })
      if (response.success) {
        success(response.message || '内存规格更新成功', { title: '操作成功' })
        closeModal()
        await loadMemories(true, false, false)
      } else {
        error(response.message || '未知错误', { title: '更新内存规格失败' })
      }
    }
  } catch (err: unknown) {
    logger.error('提交表单失败:', err)
    // 这里 handleApiError 会显示统一的错误消息
    handleApiError(err, showCreateModal.value ? '创建内存规格失败' : '更新内存规格失败')
  } finally {
    submitting.value = false
  }
}

// 新增取消直接重置；仅编辑已有记录时检查未保存的更改。
const hasUnsavedChanges = (): boolean => {
  if (!showEditModal.value || currentEditingId.value === null) return false
  const originalMemory = memories.value.find(item => item.id === currentEditingId.value)
  if (!originalMemory) return false
  return (
    formData.value.size !== originalMemory.size ||
    formData.value.status !== originalMemory.status ||
    formData.value.sort_order !== originalMemory.sort_order
  )
}

// 新增直接关闭，编辑有更改时保留确认。
const attemptCloseModal = async () => {
  if (hasUnsavedChanges()) {
    if (await confirm('您有未保存的更改，确定要关闭吗？')) {
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

// 共用排序写入：单条编辑不改变其他记录，拖拽保留已有排序值范围。
const { savingOrder, handleSortOrderChange, handleRowMove: handleMemoryRowMove } = useReferenceOrdering({
  rows: memories,
  endpoint: '/memories',
  moduleName: '内存管理',
  canEdit,
  reload: () => loadMemories(true, false, false)
})

useElementTableSortable({
  tableRef: memoriesTableRef,
  enabled: computed(() => canEdit.value && !savingOrder.value && !tableLoading.value && !isMobile.value && showSortField.value),
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
  font-size: var(--tf-type-scale-16);
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
  font-size: var(--tf-type-scale-14);
  color: var(--tf-color-muted);
  font-weight: 400;
}

.form-help {
  margin-top: 4px;
}

.form-help small {
  color: var(--tf-color-muted);
  font-size: var(--tf-type-scale-12);
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

/* 表格内容样式 */
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
  font-size: var(--tf-type-scale-14);
}

.warning-badge {
  background: var(--warning-color);
  color: var(--tf-color-gray-bootstrap-900);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: var(--tf-type-scale-10);
  font-weight: 500;
}

.storage-type {
  display: flex;
  align-items: center;
}

.type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: var(--tf-type-scale-12);
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
  font-size: var(--tf-type-scale-12);
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
  font-size: var(--tf-type-scale-16);
  font-weight: 600;
  color: var(--tf-color-heading);
}

.storage-unit {
  font-size: var(--tf-type-scale-14);
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
  font-size: var(--tf-type-scale-13);
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
    font-size: var(--tf-type-scale-13);
    line-height: 1.4;
    padding-bottom: 4px;
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
