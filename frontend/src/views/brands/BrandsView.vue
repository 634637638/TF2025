<template>
  <div class="brands-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="brands"
      module-name="品牌管理"
      permission-code="brands:view"
    >
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader
        icon="fas fa-tags"
        title="品牌管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="handleCreateBrand"
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
            v-if="canViewField('stats_total_brands')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-tags" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total }}
              </div>
              <div class="stat-label">
                品牌总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_active_brands')"
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
                启用品牌
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_inactive_brands')"
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
                禁用品牌
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
                {{ stats.relatedPhones }}
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
          @search="searchBrands"
          @reset="resetSearch"
        >
          <template #primary>
            <el-input
              v-if="canViewField('name')"
              v-model="searchForm.name"
              placeholder="搜索品牌名称"
              clearable
              @keyup.enter="searchBrands"
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
              @change="searchBrands"
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
            品牌列表
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>

          <div class="table-responsive">
            <el-table
              ref="brandsTableRef"
              v-tf-loading="tableLoading"
              :data="brands"
              border
              stripe
              class="data-table devices-table base-data-table brands-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getBrandRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="(row) => handleMobileRowTap(row.id)"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="tableLoading"
                  mode="block"
                  text="加载品牌列表..."
                />
                <DataEmptyState
                  v-else
                  description="暂无品牌数据"
                >
                  <el-button
                    size="small"
                    type="info"
                    @click="loadBrands()"
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
                :width="$getNumberColumnWidth((brands || []).map((_row, $index) => (pagination.page - 1) * pagination.page_size + $index + 1), 70)"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="table-number-badge">{{ (pagination.page - 1) * pagination.page_size + $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('name')"
                prop="name"
                label="品牌名称"
                min-width="130"
                align="center"
              />
              <el-table-column
                v-if="canViewField('status')"
                label="状态"
                min-width="84"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', row.status ? 'status-active' : 'status-inactive']"><i :class="row.status ? 'fas fa-check' : 'fas fa-times'" />{{ row.status ? '启用' : '禁用' }}</span>
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
                v-if="showUpdatedAtField"
                label="更新时间"
                min-width="156"
                align="center"
              >
                <template #default="{ row }">
                  <div class="time-info">
                    <i class="fas fa-clock" />{{ formatDate(row.updated_at) }}
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
                      v-permission="'brands:edit'"
                      type="primary"
                      size="small"
                      @click.stop="editBrand(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'brands:delete'"
                      type="danger"
                      size="small"
                      @click.stop="deleteBrand(row)"
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
                      v-permission="'brands:edit'"
                      type="primary"
                      size="small"
                      @click.stop="editBrand(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'brands:delete'"
                      type="danger"
                      size="small"
                      @click.stop="deleteBrand(row)"
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
          :title="isEditMode ? '编辑品牌' : '新增品牌'"
          width="500px"
          dialog-class="brands-form-dialog crud-dialog-sm"
          :close-on-click-modal="false"
          :show-default-footer="false"
        >
          <el-form
            :model="formData"
            label-width="80px"
            class="brands-dialog-form"
          >
            <el-form-item
              v-if="canViewField('name')"
              label="品牌名称"
              required
            >
              <el-input
                v-model="formData.name"
                placeholder="请输入品牌名称"
                clearable
                maxlength="50"
                show-word-limit
                :disabled="!canEditField('name')"
              />
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
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { normalizePermissionList } from '@/utils/permissionList'
import Pagination from '../../components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionGate, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { useMobile } from '@/composables/mobile'
import { useMobileRowDoubleTap } from '@/composables/useMobileRowDoubleTap'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { formatDateTime as formatDate } from '@/utils/format'
import { useElementTableSortable } from '@/composables/useElementTableSortable'
import { useReferenceOrdering } from '@/composables/useReferenceOrdering'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { logger } from '@/utils/logger'
import type { Brand } from '@/types'
import type { QueryParams } from '@/types/shared'

// 使用统一的 composable
const { success, error, warning, info: _info, handleApiError, confirm, loading: showLoading } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('brands')
const { showViewDenied: _showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refreshData: refresh } = useRefreshData()
const authStore = useAuthStore()
const { isMobile } = useMobile()
const { init: initFieldPermissions } = fieldPermissions
const brandListRequest = useLatestRequest()

// 获取用户权限列表用于显示
const _currentUserPermissions = computed(() => {
  return normalizePermissionList(authStore.permissions)
})

const brandFieldMap: Record<string, string> = {
  stats_total_brands: 'stats.total_brands',
  stats_active_brands: 'stats.active_brands',
  stats_inactive_brands: 'stats.inactive_brands',
  stats_related_phones: 'stats.related_phones',
  id: 'brand.id',
  name: 'brand.name',
  status: 'brand.status',
  sort_order: 'brand.sort_order',
  created_at: 'brand.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => brandFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('brands_brandsview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('brands_brandsview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showActionField = computed(() => (
  shouldShowActionColumn(canViewField('actions'), [canEdit.value, canDelete.value]) && !isMobile.value
))
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showUpdatedAtField = computed(() => canViewField('updated_at') && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_brands') ||
  canViewField('stats_active_brands') ||
  canViewField('stats_inactive_brands') ||
  canViewField('stats_related_phones')
))
// 模态框显示状态
const dialogVisible = computed({
  get: () => showCreateModal.value || showEditModal.value,
  set: (value) => {
    if (!value) {
      attemptCloseModal()
    }
  }
})

const brandsTableRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
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

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 响应式数据
// 搜索相关状态
const searchExpanded = ref(false)
const tableLoading = ref(true)
const submitting = ref(false)
const brands = ref<Brand[]>([])
const stats = ref({ total: 0, active: 0, inactive: 0, relatedPhones: 0 })
const getBrandRowKey = (brand: Brand) => String(brand.id)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentEditingId = ref<number | null>(null)

// 搜索表单
const searchForm = ref({
  name: '',
  status: ''
})

// 表单数据
const formData = ref({
  name: '',
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

// 方法
const loadBrands = async (bustCache = false, silentError = false, _showLoadingState = true) => {
  // 检查查看权限
  if (!canView.value) {
    if (!silentError) {
      error('您没有查看品牌列表的权限', {
        title: '权限不足'
      })
    }
    tableLoading.value = false
    return
  }

  if (_showLoadingState) {
    tableLoading.value = true
  }

  try {
    const params: QueryParams = {
      page: pagination.value.page,
      page_size: pagination.value.page_size
    }

    // 添加搜索参数
    if (searchForm.value.name) params.name = searchForm.value.name
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    // 添加缓存破坏参数
    if (bustCache) {
      params._t = Date.now()
    }

    const request = brandListRequest.nextRequest()
    const response = await unifiedApi.get('/brands', {
      params,
      useCache: !bustCache,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      // 使用 extractResponseData 统一提取数据
      const responseData = extractResponseData<Brand[]>(response)
      const brandData = Array.isArray(responseData) ? responseData : []
      brands.value = sortOptionsByOrder(brandData)
      // 确保 total 是数字类型
      // 统一 API 返回的是后端响应体，分页信息位于 data.pagination。
      // 读取真实总数，不能用当前页品牌数量代替。
      const apiPagination = response.data?.pagination || {
        page: 1,
        page_size: 10,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
      pagination.value = {
        page: Number(apiPagination.page) || 1,
        page_size: Number(apiPagination.page_size) || pagination.value.page_size,
        total: Number(apiPagination.total) || 0,
        total_pages: Number(apiPagination.total_pages) || 0,
        has_next: Boolean(apiPagination.has_next),
        has_prev: Boolean(apiPagination.has_prev)
      }
    } else {
      brands.value = []
      pagination.value = { page: 1, page_size: 10, total: 0, total_pages: 0, has_next: false, has_prev: false }
      if (!silentError) {
        error(`获取品牌列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (err: unknown) {
    if (brandListRequest.isCanceledError(err)) {
      return
    }

    logger.error('获取品牌列表失败:', err)
    brands.value = []
    pagination.value = { page: 1, page_size: 10, total: 0, total_pages: 0, has_next: false, has_prev: false }

    // 使用统一的错误处理
    if (!silentError) {
      handleApiError(err, '获取品牌列表失败')
    }
  } finally {
    if (_showLoadingState) {
      tableLoading.value = false
    }
  }
}

const searchBrands = () => {
  if (tableLoading.value) return
  pagination.value.page = 1
  void Promise.all([loadBrands(true), loadStats()]) // 搜索时同步刷新筛选统计
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    status: ''
  }
  pagination.value.page = 1
  void Promise.all([loadBrands(true), loadStats()]) // 重置时同步刷新统计
}

const _changePage = (page: number) => {
  pagination.value.page = page
  loadBrands()
}

// 新的分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  const oldPageSize = pagination.value.page_size
  pagination.value.page_size = pageSize
  pagination.value.page = pageSize !== oldPageSize ? 1 : page
  loadBrands()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadBrands(true, false, false)
  })
  success('数据刷新成功', { duration: 2000 })
}

const editBrand = (brand: Brand) => {
  // 先检查编辑权限
  if (!canEdit.value) {
    showEditDenied('品牌管理', 'brands:edit')
    return
  }

  currentEditingId.value = brand.id

  formData.value = {
    name: brand.name,
    status: brand.status ?? 1,
    sort_order: brand.sort_order || 0
  }

  showEditModal.value = true
}

const deleteBrand = async (brand: Brand) => {
  // 先检查删除权限
  if (!canDelete.value) {
    showDeleteDenied('品牌管理', 'brands:delete')
    return
  }

  // 使用统一的确认对话框
  try {
    if (!await confirm(
      `确定要删除品牌"${brand.name}"吗？删除后将无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )) return
  } catch {
    return
  }

  // 显示加载状态
  const closeLoading = showLoading(`正在删除品牌"${brand.name}"...`)

  try {
    const response = await unifiedApi.delete(`/brands/${brand.id}`, { showError: false })

    if (response.success) {
      success(response.message || '品牌删除成功', {
        title: '操作成功',
        duration: 3000
      })
      await loadBrands(true, false, false)
    } else {
      error(`删除品牌失败: ${response.message || '未知错误'}`)
    }
  } catch (error: unknown) {
    logger.error('删除品牌失败:', error)

    // 使用统一的错误处理
    handleApiError(error, '删除品牌失败')
  } finally {
    closeLoading()
  }
}

// 表单验证函数
const validateBrandForm = () => {
  const errors = []

  // 品牌名称验证
  if (!formData.value.name || formData.value.name.trim() === '') {
    errors.push('品牌名称不能为空')
  } else if (formData.value.name.trim().length < 1) {
    errors.push('品牌名称至少需要1个字符')
  } else if (formData.value.name.trim().length > 50) {
    errors.push('品牌名称不能超过50个字符')
  } else {
    // 检查品牌名称格式
    const namePattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_&.]+$/
    if (!namePattern.test(formData.value.name.trim())) {
      errors.push('品牌名称只能包含中文、英文、数字、空格、连字符、下划线、&和点')
    }
  }

  // 排序顺序验证
  if (formData.value.sort_order < 0) {
    errors.push('排序顺序不能为负数')
  } else if (formData.value.sort_order > 9999) {
    errors.push('排序顺序不能超过9999')
  }

  // 状态验证
  if (formData.value.status !== 0 && formData.value.status !== 1) {
    errors.push('状态值不正确，只能是0或1')
  }

  return errors
}

const submitForm = async () => {
  if (submitting.value) return
  // 权限检查
  if (showCreateModal.value && !canCreate.value) {
    showCreateDenied('品牌管理', 'brands:create')
    return
  }

  if (showEditModal.value && !canEdit.value) {
    showEditDenied('品牌管理', 'brands:edit')
    return
  }

  // 前端表单验证
  const validationErrors = validateBrandForm()
  if (validationErrors.length > 0) {
    warning(`表单验证失败: ${validationErrors.join('；')}`)
    return
  }

  // 显示加载状态
  const closeLoading = showLoading(showCreateModal.value ? '正在创建品牌...' : '正在更新品牌...')
  submitting.value = true

  try {
    let response

    if (showCreateModal.value) {
      // 准备提交数据，去除空格
      const submitData = {
        name: formData.value.name.trim(),
        status: formData.value.status,
        sort_order: parseInt(String(formData.value.sort_order)) || 0
      }

      response = await unifiedApi.post('/brands', submitData, { showError: false })
      if (response.success) {
        success(response.message || '品牌创建成功', {
          title: '操作成功',
          duration: 3000
        })
        closeModal()
        await loadBrands(true, false, false)
      } else {
        error(`创建品牌失败: ${response.message || '未知错误'}`)
      }
    } else {
      if (!currentEditingId.value) {
        error('无法获取品牌ID', {
          title: '操作失败'
        })
        submitting.value = false
        return
      }
      // 准备提交数据，去除空格
      const submitData = {
        name: formData.value.name.trim(),
        status: formData.value.status,
        sort_order: parseInt(String(formData.value.sort_order)) || 0
      }

      response = await unifiedApi.put(`/brands/${currentEditingId.value}`, submitData, { showError: false })
      if (response.success) {
        success(response.message || '品牌更新成功', {
          title: '操作成功',
          duration: 3000
        })
        closeModal()
        await loadBrands(true, false, false)
      } else {
        error(`更新品牌失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (error: unknown) {
    logger.error('提交表单失败:', error)

    // 使用统一的错误处理
    handleApiError(error, showCreateModal.value ? '创建品牌失败' : '更新品牌失败')
  } finally {
    submitting.value = false
    closeLoading()
  }
}

// 新增取消直接重置；仅编辑已有记录时检查未保存的更改。
const hasUnsavedChanges = (): boolean => {
  if (!showEditModal.value || currentEditingId.value === null) return false
  const originalBrand = brands.value.find(item => item.id === currentEditingId.value)
  if (!originalBrand) return false
  return (
    formData.value.name !== originalBrand.name ||
    formData.value.status !== originalBrand.status ||
    formData.value.sort_order !== originalBrand.sort_order
  )
}

// 新增直接关闭，编辑有更改时保留确认。
const attemptCloseModal = async () => {
  if (hasUnsavedChanges()) {
    const confirmed = await confirm(
      '您有未保存的更改，确定要关闭吗？',
      '确认关闭',
      {
        confirmButtonText: '确定关闭',
        cancelButtonText: '继续编辑',
        type: 'warning'
      }
    )
    if (confirmed) {
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
    name: '',
    status: 1,
    sort_order: 0
  }
}

const loadStats = async () => {
  try {
    const params: Record<string, string> = {}
    if (searchForm.value.name) params.name = searchForm.value.name.trim()
    if (searchForm.value.status !== '') params.status = searchForm.value.status
    const response = await unifiedApi.get('/brands/stats/overview', { params })
    if (response.success) {
      const data = response.data || {}
      stats.value = {
        total: Number(data.total) || 0,
        active: Number(data.active) || 0,
        inactive: Number(data.inactive) || 0,
        relatedPhones: Number(data.related_phones) || 0
      }
    }
  } catch (error) {
    logger.error('获取品牌统计失败:', error)
    stats.value = { total: 0, active: 0, inactive: 0, relatedPhones: 0 }
  }
}

// 共用排序写入：单条编辑不改变其他记录，拖拽保留已有排序值范围。
const { savingOrder, handleSortOrderChange, handleRowMove: handleBrandRowMove } = useReferenceOrdering({
  rows: brands,
  endpoint: '/brands',
  moduleName: '品牌管理',
  canEdit,
  reload: () => loadBrands(true, false, false)
})

useElementTableSortable({
  tableRef: brandsTableRef,
  enabled: computed(() => canEdit.value && !savingOrder.value && !tableLoading.value && !isMobile.value && showSortField.value),
  orderKey: () => brands.value.map(brand => brand.id).join('|'),
  onMove: handleBrandRowMove
})

// 处理新增品牌
const handleCreateBrand = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令和 v-if，但双保险）
  if (!canCreate.value) {
    showCreateDenied('品牌管理', 'brands:create')
    return
  }

  showCreateModal.value = true
}

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return
  }

  await initFieldPermissions()
  await Promise.all([loadBrands(), loadStats()])
})
</script>

<style scoped src="./styles/brands-view/base.css"></style>
<style scoped src="./styles/brands-view/responsive.css"></style>
<style scoped src="./styles/brands-view/accessibility.css"></style>
