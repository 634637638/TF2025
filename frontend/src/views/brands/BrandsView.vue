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
            v-if="canViewField('stats_total_brands')"
            class="stat-card"
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
            class="stat-card"
          >
            <div class="stat-icon active">
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
            class="stat-card"
          >
            <div class="stat-icon inactive">
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
            class="stat-card"
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
              :data="tableLoading ? [] : brands"
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
                width="70"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="id-badge">{{ $index + 1 }}</span>
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
          @close="attemptCloseModal"
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
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { normalizePermissionList } from '@/utils/permissionList'
import Pagination from '../../components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionGate, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useElementTableSortable } from '@/composables/useElementTableSortable'
import { logger } from '@/utils/logger'
import type { Brand } from '@/types'

// 获取路由实例和store
const _router = useRouter()

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

const brandsTableRef = ref<any>(null)
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

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 响应式数据
// 搜索相关状态
const searchExpanded = ref(false)
const tableLoading = ref(true)
const submitting = ref(false)
const savingOrder = ref(false)
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
    const params: any = {
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
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      // 使用 extractResponseData 统一提取数据
      const responseData = extractResponseData<any[]>(response)
      const brandData = Array.isArray(responseData) ? responseData : []
      // 按 sort_order 排序，确保序号和排序值一致
      const sortedData = brandData.sort((a: Brand, b: Brand) => (a.sort_order || 0) - (b.sort_order || 0))
      brands.value = sortedData
      // 确保 total 是数字类型
      const apiPagination = response.pagination || {
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
  } catch (err: any) {
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
  loadBrands(true) // 搜索时破坏缓存
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    status: ''
  }
  pagination.value.page = 1
  loadBrands(true) // 重置时破坏缓存
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
    status: brand.status,
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
    await ElMessageBox.confirm(
      `确定要删除品牌"${brand.name}"吗？删除后将无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
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
  } catch (error: any) {
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
  } catch (error: any) {
    logger.error('提交表单失败:', error)

    // 使用统一的错误处理
    handleApiError(error, showCreateModal.value ? '创建品牌失败' : '更新品牌失败')
  } finally {
    submitting.value = false
    closeLoading()
  }
}

// 检查是否有未保存的更改
const hasUnsavedChanges = (): boolean => {
  if (!showCreateModal.value && !showEditModal.value) return false

  // 检查是否有任何非空字段的更改
  const currentForm = formData.value
  const _initialForm = {
    name: '',
    status: 1,
    sort_order: 0
  }

  // 对于编辑模式，需要比较原始数据
  if (showEditModal.value && currentEditingId.value) {
    const originalBrand = brands.value.find(b => b.id === currentEditingId.value)
    if (originalBrand) {
      return (
        currentForm.name !== originalBrand.name ||
        currentForm.status !== originalBrand.status ||
        currentForm.sort_order !== originalBrand.sort_order
      )
    }
  }

  // 对于创建模式，检查是否有任何输入
  return (
    currentForm.name !== '' ||
    currentForm.status !== 1 ||
    currentForm.sort_order !== 0
  )
}

// 关闭模态框（带确认）
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

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

const loadStats = async () => {
  try {
    const response = await unifiedApi.get('/brands/stats/overview')
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

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return

  savingOrder.value = true
  try {
    const items = brands.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/brands/batch/reorder', { items })
    if (response.success) {
      success('排序已保存', {
        duration: 2000
      })
    }
  } catch (error) {
    handleApiErrorWithPermission(error, '保存排序失败', '品牌管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  brands.value[index].sort_order = value
  // 按新的 sort_order 重新排序
  brands.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  await saveSortOrder()
}

const handleBrandRowMove = async (oldIndex: number, newIndex: number) => {
  if (!canEdit.value || oldIndex === newIndex) return false
  const reordered = [...brands.value]
  const [movedItem] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, movedItem)
  reordered.forEach((item, index) => { item.sort_order = index })
  brands.value = reordered
  await saveSortOrder()
  await loadBrands(true, false, false)
  return true
}

useElementTableSortable({
  tableRef: brandsTableRef,
  enabled: computed(() => canEdit.value && !isMobile.value && showSortField.value),
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

<style scoped>
.brands-view {
  padding: 24px;
  background: var(--tf-color-surface);
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  box-sizing: border-box;
}

.content {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: clip;
  box-sizing: border-box;
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
  border: 1px solid var(--tf-color-border-cool);
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
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, var(--success-color), var(--tf-color-teal-500));
}

.stat-icon.inactive {
  background: linear-gradient(135deg, var(--danger-color), var(--tf-color-orange-bootstrap));
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--tf-color-heading);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--tf-color-muted);
  font-weight: 500;
}

.action-buttons {
  display: flex;
}

/* 用户信息样式 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}

.user-id, .user-position {
  opacity: 0.9;
}

.action-buttons {
  display: flex;
}

/* 区域标题样式 */
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

/* 警告徽章样式 */
.warning-badge {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  margin-left: 6px;
}


/* 表格区域保持原样 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid var(--tf-color-border-cool);
}

.brands-dialog-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.brands-dialog-form :deep(.el-input),
.brands-dialog-form :deep(.el-input-number),
.brands-dialog-form :deep(.el-radio-group) {
  width: 100%;
}

.brands-dialog-form :deep(.el-input__wrapper),
.brands-dialog-form :deep(.el-input-number .el-input__wrapper) {
  border-radius: 12px;
}

/* 保留原有的表单样式（用于对话框等） */
.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--tf-color-gray-bootstrap-700);
}

.input-group {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--tf-color-muted);
  font-size: 14px;
  z-index: 1;
}

.form-control {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 2px solid var(--tf-color-border-cool);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: var(--tf-color-surface-muted);
}

.form-control:focus {
  outline: none;
  border-color: var(--tf-color-indigo-brand);
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

/* 表格区域样式 */
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
  border-right: 1px solid var(--tf-color-border-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
  vertical-align: middle;
  font-size: 14px;
  color: var(--tf-color-heading);
  font-weight: 500;
  text-align: center;
  position: relative;
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

.brand-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.brand-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
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

.time-info {
  font-size: 13px;
  color: var(--tf-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.required {
  color: var(--danger-color);
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

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--tf-color-border-cool);
}

.pagination-info {
  color: var(--tf-color-muted);
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

/* 操作按钮样式 */
.actions {
  vertical-align: middle;
  text-align: center;
}

.actions .action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.no-permission-text {
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  padding: 6px 10px;
  background: var(--tf-color-surface-soft);
  border-radius: 4px;
  border: 1px dashed var(--tf-color-gray-300-alt);
}

/* 响应式设计 */
@media (max-width: 767px) {
  .brands-view {
    padding: 16px;
  }

  
  .action-buttons {
    order: 1;
    width: 100%;
    justify-content: center;
  }

  .user-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 16px;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
  }

  .brand-info {
    max-width: 150px;
  }

  .brands-dialog-form :deep(.el-form-item) {
    margin-bottom: 14px;
  }
}

.pagination-info {
  color: var(--tf-color-muted);
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-page {
  width: 32px;
  height: 32px;
  border: 1px solid var(--tf-button-neutral-border);
  background: var(--tf-button-neutral-bg);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--tf-button-tool-color);
}

.btn-page:hover:not(:disabled) {
  background: var(--tf-button-neutral-hover-bg);
  border-color: var(--tf-button-neutral-hover-border);
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

/* 移动端响应式优化 */
@media (max-width: 767px) {
  .brands-view {
    padding: 8px;
  }

  .form-group {
    width: 100%;
  }

  .form-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* 表格区域优化 */
  .table-section {
    overflow: hidden;
    max-width: 100%;
    box-sizing: border-box;
  }

  .table-responsive {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }

  .table {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    table-layout: fixed;
    font-size: 12px;
    box-sizing: border-box;
  }

  .table th,
  .table td {
    padding: 8px 6px;
    white-space: normal;
    word-break: break-word;
    box-sizing: border-box;
  }

  .table th:first-child,
  .table td:first-child {
    padding-left: 8px;
  }

  .table th:last-child,
  .table td:last-child {
    padding-right: 8px;
  }

  /* 操作按钮优化 */
  .actions {
    vertical-align: middle;
    text-align: center;
    min-width: 80px;
  }

  .actions .action-buttons {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .brand-info {
    max-width: none;
    width: 100%;
  }

  .brand-name {
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.35;
  }

  .status-badge {
    white-space: normal;
    line-height: 1.35;
    justify-content: center;
    max-width: 82px;
    width: 100%;
    margin: 0 auto;
  }
/* 分页优化 */
  .pagination-section {
    flex-direction: column;
    gap: 12px;
    margin: 16px -12px 0 -12px;
    padding: 16px 12px;
  }

  .pagination-controls {
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-page {
    width: 36px;
    height: 36px;
    font-size: 12px;
  }

  .brands-dialog-form :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .brands-dialog-form :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .brands-dialog-form :deep(.el-input__wrapper),
  .brands-dialog-form :deep(.el-input-number .el-input__wrapper) {
    min-height: 42px;
    padding: 1px 12px;
  }

  .brands-dialog-form :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .brands-dialog-form :deep(.el-radio) {
    margin-right: 0;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--tf-color-border-blue);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }

  .brands-form-dialog :deep(.mobile-dialog-footer) {
    width: 100%;
  }

}

/* 小屏手机调整 - 保持2个一行，参考销售页面 */
@media (max-width: 480px) {
  .page-title {
    font-size: 22px;
  }

  .page-description {
    font-size: 14px;
  }

  .brand-name {
    font-size: 13px;
    line-height: 1.35;
    font-weight: 700;
  }

  .status-badge {
    font-size: 10px;
    padding: 4px 6px;
    max-width: 72px;
  }
}

/* 横屏优化 */
@media (max-width: 767px) and (orientation: landscape) {
  .form-group {
    flex: 1;
    min-width: 150px;
  }

  .form-actions {
    flex-direction: row;
    align-items: flex-end;
  }
}

/* 打印样式 */
@media print {
  .brands-view {
    background: white;
    padding: 0;
  }

  .page-header,
  .actions,
  .pagination-section {
    display: none;
  }

  .table-responsive {
    overflow: visible;
  }

  .table {
    min-width: auto;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .stat-card,
  .el-table {
    border-width: 2px;
  }

  .btn {
    border-width: 2px;
  }

  .table th {
    background-color: var(--tf-color-black);
    color: var(--color-bg-white);
  }

  .table tr:nth-child(even) {
    background-color: var(--tf-color-gray-200);
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
