<template>
  <div class="brands-view admin-page">
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
          <i class="fas fa-plus"></i>
          <span>新增</span>
        </el-button>
        <el-button type="info" @click="handleRefresh" :disabled="refreshing">
          <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="brands"
      module-name="品牌管理"
      permission-code="brands:view"
    />

    <!-- 权限验证通过后的内容 -->
    <div v-else class="content admin-page-content">

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_brands')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-tags"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">品牌总数</div>
        </div>
      </div>
      <div v-if="canViewField('stats_active_brands')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ brands.filter(b => b.status === 1).length }}</div>
          <div class="stat-label">启用品牌</div>
        </div>
      </div>
      <div v-if="canViewField('stats_inactive_brands')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ brands.filter(b => b.status === 0).length }}</div>
          <div class="stat-label">禁用品牌</div>
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
      :loading="loading"
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
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div v-if="canViewField('status')" class="form-group filter-item" data-field="status">
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
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
        品牌列表
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>
      
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th v-if="showSortField" width="40"></th>
              <th v-if="showSortOrderField" width="60">排序</th>
              <th v-if="canViewField('id')" width="80">序号</th>
              <th v-if="canViewField('name')" width="160">品牌名称</th>
              <th v-if="canViewField('status')" width="200">状态</th>
              <th v-if="showCreatedAtField" width="200">创建时间</th>
              <th v-if="showActionField" width="220">操作</th>
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
            <tr v-else-if="brands.length === 0" class="empty-row">
              <td :colspan="visibleColumnCount">
                <div class="empty-content">
                  <i class="fas fa-inbox"></i>
                  <div class="empty-text">
                    <h4>暂无品牌数据</h4>
                    <p>点击上方"新增品牌"按钮添加第一个品牌</p>
                    <el-button class="mt-2" size="small" type="info" @click="loadBrands()" :disabled="loading">
                      <i class="fas fa-sync-alt"></i>
                      {{ loading ? '加载中...' : '重新加载' }}
                    </el-button>
                  </div>
                </div>
              </td>
            </tr>
            <template v-else v-for="(brand, index) in brands" :key="brand.id">
            <tr
              class="data-row"
              :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
              :draggable="canEdit"
              @click="handleMobileRowTap(brand.id)"
              @dblclick="toggleMobileActions(brand.id)"
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
                  v-model.number="brand.sort_order"
                  type="number"
                  class="sort-order-input"
                  :disabled="!canEdit"
                  min="0"
                  max="9999"
                  @change="canEdit ? handleSortOrderChange(index, brand.sort_order) : null"
                />
              </td>
              <td v-if="canViewField('id')">
                <span class="id-badge">{{ index + 1 }}</span>
              </td>
              <td v-if="canViewField('name')">
                <div class="brand-info">
                  <div class="brand-name">
                    <strong>{{ brand.name || '未命名品牌' }}</strong>
                    <span v-if="!brand.name" class="warning-badge">未命名</span>
                  </div>
                </div>
              </td>
              <td v-if="canViewField('status')">
                <span :class="['status-badge', brand.status ? 'status-active' : 'status-inactive']">
                  <i :class="brand.status ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ brand.status ? '启用' : '禁用' }}
                </span>
              </td>
              <td v-if="showCreatedAtField">
                <div class="time-info">
                  <i class="fas fa-clock"></i>
                  {{ formatDate(brand.created_at) }}
                </div>
              </td>
              <td v-if="showActionField" class="actions">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    v-permission="'brands:edit'"
                    type="primary"
                    size="small"
                    @click="editBrand(brand)"
                    title="编辑"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'brands:delete'"
                    type="danger"
                    size="small"
                    @click="deleteBrand(brand)"
                    title="删除"
                  >
                    <i class="fas fa-trash"></i>
                    <span>删除</span>
                  </el-button>
                </div>
                <!-- 如果没有任何操作权限，显示提示 -->
                <span v-if="!canEdit && !canDelete" class="no-permission-text">
                  无操作权限
                </span>
              </td>
            </tr>
            <tr
              v-if="isMobile && mobileActionRowId === brand.id && (canEdit || canDelete)"
              class="mobile-action-row"
            >
              <td :colspan="visibleColumnCount">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canEdit"
                    v-permission="'brands:edit'"
                    type="primary"
                    size="small"
                    @click.stop="editBrand(brand)"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'brands:delete'"
                    type="danger"
                    size="small"
                    @click.stop="deleteBrand(brand)"
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
      :title="isEditMode ? '编辑品牌' : '新增品牌'"
      width="500px"
      dialog-class="brands-form-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      @close="attemptCloseModal"
      :show-default-footer="false"
    >
      <el-form :model="formData" label-width="80px" class="brands-dialog-form">
        <el-form-item v-if="canViewField('name')" label="品牌名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入品牌名称"
            clearable
            maxlength="50"
            show-word-limit
            :disabled="!canEditField('name')"
          />
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
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { normalizePermissionList } from '@/utils/permissionList'
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionDenied, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/useMobile'
import { logger } from '@/utils/logger'
import type { Brand } from '@/types'

// 获取路由实例和store
const router = useRouter()

// 使用统一的 composable
const { success, error, warning, info, handleApiError, confirm, loading: showLoading } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('brands')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refreshData: refresh } = useRefreshData()
const authStore = useAuthStore()
const { isMobile } = useMobile()
const { init: initFieldPermissions } = fieldPermissions

// 获取用户权限列表用于显示
const currentUserPermissions = computed(() => {
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
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_brands') ||
  canViewField('stats_active_brands') ||
  canViewField('stats_inactive_brands') ||
  canViewField('stats_related_phones')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('name'),
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
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

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 响应式数据
const { loading } = useLoadingState()

// 搜索相关状态
const searchExpanded = ref(false)
const submitting = ref(false)
const savingOrder = ref(false)
const brands = ref<Brand[]>([])
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentEditingId = ref<number | null>(null)

// 拖拽排序状态
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

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
  limit: 100,
  total: 0,
  pages: 0
})

// 方法
const loadBrands = async (bustCache = false, silentError = false, showLoadingState = true) => {
  // 检查查看权限
  if (!canView.value) {
    if (!silentError) {
      error('您没有查看品牌列表的权限', {
        title: '权限不足'
      })
    }
    return
  }

  // 根据 showLoadingState 参数决定是否显示加载状态
  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }

    // 添加搜索参数
    if (searchForm.value.name) params.name = searchForm.value.name
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    // 添加缓存破坏参数
    if (bustCache) {
      params._t = Date.now()
    }

    const response = await unifiedApi.get('/brands', { params })

    if (response.success) {
      // 使用 extractResponseData 统一提取数据
      const responseData = extractResponseData<any[]>(response)
      const brandData = Array.isArray(responseData) ? responseData : []
      // 按 sort_order 排序，确保序号和排序值一致
      const sortedData = brandData.sort((a: Brand, b: Brand) => (a.sort_order || 0) - (b.sort_order || 0))
      brands.value = sortedData
      // 确保 total 是数字类型
      const apiPagination = response.pagination || { page: 1, limit: 10, total: 0, pages: 0 }
      pagination.value = {
        ...apiPagination,
        total: Number(apiPagination.total) || 0,
        pages: Number(apiPagination.pages) || 0
      }
    } else {
      brands.value = []
      pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }
      if (!silentError) {
        error(`获取品牌列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (error: any) {
    logger.error('获取品牌列表失败:', error)
    brands.value = []
    pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }

    // 使用统一的错误处理
    if (!silentError) {
      handleApiError(error, '获取品牌列表失败')
    }
  } finally {
    // 只有在显示加载状态时才重置
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const searchBrands = () => {
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

const changePage = (page: number) => {
  pagination.value.page = page
  loadBrands()
}

// 新的分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.value.page = page
  pagination.value.limit = pageSize
  // 重置到第一页（当页面大小改变时）
  if (pageSize !== pagination.value.limit) {
    pagination.value.page = 1
  }
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
        customClass: 'message-box-purple'
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
      // 延迟一下刷新，确保后端操作完成
      setTimeout(() => {
        loadBrands(true)
      }, 300)
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
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadBrands(true)
        }, 300)
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
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadBrands(true)
        }, 300)
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
  const initialForm = {
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

const getPhoneCount = () => {
  // 简单估算相关手机数量，实际项目中应该从API获取
  return Math.floor(Math.random() * 100) + 20
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
  const newBrands = [...brands.value]
  const [movedItem] = newBrands.splice(dragIndex, 1)
  newBrands.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newBrands.forEach((item, index) => {
    item.sort_order = index
  })

  brands.value = newBrands

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadBrands(true, false, false)

  handleDragEnd()
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
  loadBrands()
})
</script>

<style scoped>
.brands-view {
  padding: 24px;
  background: #f5f7fa;
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

.action-buttons {
  display: flex;
  gap: 12px;
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
  gap: 12px;
}

/* 区域标题样式 */
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

/* 警告徽章样式 */
.warning-badge {
  background: #fff3cd;
  color: #856404;
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
  border: 1px solid #e8ecef;
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
  color: #495057;
}

.input-group {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 14px;
  z-index: 1;
}

.form-control {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: #f8f9fa;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  font-size: 14px;
  color: #2c3e50;
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
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
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

.time-info {
  font-size: 13px;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.required {
  color: #dc3545;
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

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e8ecef;
}

.pagination-info {
  color: #6c757d;
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
  display: flex;
  gap: 8px;
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

.no-permission-text {
  color: #999;
  font-size: 12px;
  font-style: italic;
  padding: 6px 10px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 1px dashed #ddd;
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
  color: #6c757d;
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
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #666;
}

.btn-page:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
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

  /* 统计卡片优化 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .stat-card {
    padding: 14px 12px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-label {
    font-size: 12px;
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
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
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
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 80px;
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

  .btn-action {
    width: 100%;
    min-height: 32px;
    font-size: 11px;
    padding: 4px 8px;
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
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }

  .brands-form-dialog :deep(.mobile-dialog-footer) {
    width: 100%;
  }

  .brands-form-dialog :deep(.mobile-dialog-footer .el-button) {
    flex: 1;
    min-height: 42px;
    margin: 0;
  }

}

/* 小屏手机调整 - 保持2个一行，参考销售页面 */
@media (max-width: 480px) {
  .stats-cards {
    gap: 12px;
    margin: 0 0 12px 0;
    grid-template-columns: repeat(2, 1fr); /* 强制2列，确保2个一行 */
  }

  .page-title {
    font-size: 22px;
  }

  .page-description {
    font-size: 14px;
  }

  .table th,
  .table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .table th:nth-child(1),
  .table td:nth-child(1) {
    width: 18%;
  }

  .table th:nth-child(2),
  .table td:nth-child(2) {
    width: 48%;
  }

  .table th:nth-child(3),
  .table td:nth-child(3) {
    width: 34%;
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

/* 超小屏幕优化 - 保持2个一行 */
@media (max-width: 375px) {
  .stats-cards {
    gap: 8px;
    margin: 0 0 8px 0;
    grid-template-columns: repeat(2, 1fr); /* 强制2列，确保2个一行 */
  }
}

/* 横屏优化 */
@media (max-width: 767px) and (orientation: landscape) {
  .stats-cards {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

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
    background-color: #000;
    color: #fff;
  }

  .table tr:nth-child(even) {
    background-color: #f0f0f0;
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
