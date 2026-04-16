<template>
  <div class="models-view admin-page">
    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-mobile-alt"
      title="型号管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="handleCreateModel"
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
      module-key="models_modelsview"
      module-name="型号管理"
      permission-code="models:view"
    />

    <!-- 权限验证通过后的内容 -->
    <div v-else class="content admin-page-content">

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_models')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">型号总数</div>
        </div>
      </div>
      <div v-if="canViewField('stats_active_models')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ models.filter(m => m.status === 1 || m.is_active === true).length }}</div>
          <div class="stat-label">启用型号</div>
        </div>
      </div>
      <div v-if="canViewField('stats_inactive_models')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ models.filter(m => m.status === 0 || m.is_active === false).length }}</div>
          <div class="stat-label">禁用型号</div>
        </div>
      </div>
      <div v-if="canViewField('stats_related_brands')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-cog"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ brands.length }}</div>
          <div class="stat-label">关联品牌</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      @search="searchModels"
      @reset="resetSearch"
    >
      <template #primary>
        <el-input
          v-if="canViewField('name')"
          v-model="searchForm.name"
          placeholder="搜索关键词"
          clearable
          @keyup.enter="searchModels"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div v-if="canViewField('brand_name')" class="form-group filter-item" data-field="brand_id">
        <el-select
          v-model="searchForm.brand_id"
          placeholder="品牌"
          filterable
          clearable
          @change="searchModels"
        >
          <el-option
            v-for="brand in brands"
            :key="brand.id"
            :label="brand.name"
            :value="brand.id"
          />
        </el-select>
      </div>

      <div v-if="canViewField('status')" class="form-group filter-item" data-field="status">
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          @change="searchModels"
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
        型号列表
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th v-if="showSortField" width="40"></th>
              <th v-if="showSortOrderField" width="60">排序</th>
              <th v-if="canViewField('id')" width="80">序号</th>
              <th v-if="showBrandField" width="140">品牌</th>
              <th v-if="canViewField('name')" width="160">型号</th>
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
            <tr v-else-if="models.length === 0" class="empty-row">
              <td :colspan="visibleColumnCount">
                <div class="empty-content">
                  <i class="fas fa-inbox"></i>
                  <div class="empty-text">
                    <h4>暂无型号数据</h4>
                    <p>点击上方"新增型号"按钮添加第一个型号</p>
                    <el-button class="mt-2" size="small" type="info" @click="loadModels()" :disabled="loading">
                      <i class="fas fa-sync-alt"></i>
                      {{ loading ? '加载中...' : '重新加载' }}
                    </el-button>
                  </div>
                </div>
              </td>
            </tr>
            <template v-else v-for="(model, index) in models" :key="model.id">
            <tr
              class="data-row"
              :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
              :draggable="canEdit"
              @click="handleMobileRowTap(model.id)"
              @dblclick="toggleMobileActions(model.id)"
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
                  v-model.number="model.sort_order"
                  type="number"
                  class="sort-order-input"
                  :disabled="!canEdit"
                  min="0"
                  max="9999"
                  @change="canEdit ? handleSortOrderChange(index, model.sort_order) : null"
                />
              </td>
              <td v-if="canViewField('id')">
                <span class="id-badge">{{ getModelIndexInBrand(model) }}</span>
              </td>
              <td v-if="showBrandField">
                <div class="brand-name">
                  {{ getBrandName(model) }}
                </div>
              </td>
              <td v-if="canViewField('name')">
                <div class="model-info">
                  <div class="model-name">
                    <strong>{{ model.name || '未命名型号' }}</strong>
                    <span v-if="!model.name" class="warning-badge">未命名</span>
                  </div>
                </div>
              </td>
              <td v-if="canViewField('status')">
                <span :class="['status-badge', (model.status === 1 || model.is_active === true) ? 'status-active' : 'status-inactive']">
                  <i :class="(model.status === 1 || model.is_active === true) ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ (model.status === 1 || model.is_active === true) ? '启用' : '禁用' }}
                </span>
              </td>
              <td v-if="showCreatedAtField">
                <div class="time-info">
                  <i class="fas fa-clock"></i>
                  {{ formatDate(model.created_at) }}
                </div>
              </td>
              <td v-if="showActionField" class="actions">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    v-permission="'models:edit'"
                    type="primary"
                    size="small"
                    @click="editModel(model)"
                    title="编辑"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'models:delete'"
                    type="danger"
                    size="small"
                    @click="deleteModel(model)"
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
              v-if="isMobile && mobileActionRowId === model.id && (canEdit || canDelete)"
              class="mobile-action-row"
            >
              <td :colspan="visibleColumnCount">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canEdit"
                    v-permission="'models:edit'"
                    type="primary"
                    size="small"
                    @click.stop="editModel(model)"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'models:delete'"
                    type="danger"
                    size="small"
                    @click.stop="deleteModel(model)"
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
      :title="isEditMode ? '编辑型号' : '新增型号'"
      width="500px"
      dialog-class="models-form-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      @close="attemptCloseModal"
      :show-default-footer="false"
    >
      <el-form :model="formData" label-width="80px" class="models-dialog-form">
        <el-form-item v-if="canViewField('brand_name')" label="品牌" required>
          <el-select
            v-model="formData.brand_id"
            placeholder="请选择品牌"
            clearable
            filterable
            style="width: 100%"
            :disabled="!canEditField('brand_name')"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.id"
              :label="brand.name"
              :value="brand.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canViewField('name')" label="型号名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入型号名称"
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
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionDenied, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { logger } from '@/utils/logger'
import { useMobile } from '@/composables/mobile'
import type { Brand, Model } from '@/types'

const router = useRouter()
// 使用统一的 composable
const { success, error, warning, info, handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('models')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const { init: initFieldPermissions } = fieldPermissions

const modelFieldMap: Record<string, string> = {
  stats_total_models: 'stats.total_models',
  stats_active_models: 'stats.active_models',
  stats_inactive_models: 'stats.inactive_models',
  stats_related_brands: 'stats.related_brands',
  id: 'model.id',
  name: 'model.name',
  brand_id: 'model.brand_id',
  brand_name: 'model.brand_name',
  status: 'model.status',
  sort_order: 'model.sort_order',
  created_at: 'model.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => modelFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('models_modelsview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('models_modelsview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showBrandField = computed(() => canViewField('brand_name'))
const showStatsCards = computed(() => (
  canViewField('stats_total_models') ||
  canViewField('stats_active_models') ||
  canViewField('stats_inactive_models') ||
  canViewField('stats_related_brands')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('name'),
    showBrandField.value,
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
})

// 响应式数据
const { loading } = useLoadingState()
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

// 搜索相关状态
const searchExpanded = ref(false)
const submitting = ref(false)
const savingOrder = ref(false)
const models = ref<Model[]>([])
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
  brand_id: null as number | null,
  status: ''
})

// 表单数据
const formData = ref({
  brand_id: null as number | null,
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
// 计算型号在品牌内的序号（从1开始）
const getModelIndexInBrand = (model: Model): number => {
  // 获取当前品牌下的所有型号
  const brandModels = models.value.filter(m => m.brand_id === model.brand_id)
  // 按 sort_order 排序
  const sortedBrandModels = brandModels.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  // 找到当前型号在排序后的位置
  return sortedBrandModels.findIndex(m => m.id === model.id) + 1
}

const getBrandName = (model: Model): string => {
  // 优先使用后端JOIN返回的brand_name
  if (model.brand_name) {
    return model.brand_name
  }

  // 如果后端没有返回，从本地brands列表中查找
  if (!model.brand_id) return '未设置品牌'

  const brand = brands.value.find(b => b.id === model.brand_id)
  if (brand) {
    return brand.name
  }

  // 调试信息
  return '未知品牌'
}

const loadBrands = async () => {
  try {
    // 传递limit=100获取所有品牌（后端最大限制）
    const response = await unifiedApi.get('/brands?limit=100')

    if (response.success) {
      // 使用统一的数据提取方法
      brands.value = extractResponseData<any[]>(response.data)
    } else {
      logger.error('获取品牌列表失败:', response.message)
      brands.value = []
    }
  } catch (error) {
    logger.error('获取品牌列表异常:', error)
    brands.value = []
  }
}

const loadModels = async (bustCache = false, silentError = false, showLoadingState = true) => {
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('型号管理', 'models:view')
    }
    models.value = []
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
    if (searchForm.value.name) params.name = searchForm.value.name
    if (searchForm.value.brand_id !== null && searchForm.value.brand_id !== undefined) {
      params.brand_id = searchForm.value.brand_id
    }
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    const response = await unifiedApi.get('/models', { params })


    if (response.success) {
      models.value = response.data.models || []
      // 确保 total 是数字类型
      const paginationData = response.data.pagination || { page: 1, limit: 10, total: 0, pages: 0 }
      pagination.value = {
        ...paginationData,
        total: Number(paginationData.total) || 0
      }

      // 按 sort_order 排序，确保序号和排序值一致
      models.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      logger.error('API返回失败:', response.message)
      models.value = []
      pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }
      if (!silentError) {
        error(response.message || '获取型号列表失败')
      }
    }
  } catch (err: any) {
    logger.error('获取型号列表失败:', err)
    models.value = []
    pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }

    // 静默模式不显示错误提示
    if (silentError) {
      return
    }

    // 处理权限错误
    if (err.response?.status === 403) {
      showViewDenied('型号管理', 'models:view')
    } else if (err.response?.status === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
      // 可以在这里触发登出逻辑
    } else {
      // 简化错误处理
      if (err.response?.data?.message) {
        error(`获取型号列表失败：${err.response.data.message}`)
      } else {
        error('获取型号列表失败：请检查网络连接或联系管理员')
      }
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const searchModels = () => {
  pagination.value.page = 1
  loadModels()
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    brand_id: null,
    status: ''
  }
  pagination.value.page = 1
  loadModels()
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadModels()
}

const handlePaginationChange = (page, pageSize) => {
  pagination.value.page = page
  pagination.value.limit = pageSize
  if (pageSize !== pagination.value.limit) {
    pagination.value.page = 1
  }
  loadModels()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  pagination.value.page = 1
  await refresh(async () => {
    await loadModels(false, false, false)
  })
  success('数据刷新成功')
}

const editModel = async (model: Model) => {
  // 先检查编辑权限
  if (!canEdit.value) {
    showEditDenied('型号管理', 'models:edit')
    return
  }

  // 重新加载品牌列表以确保数据最新
  await loadBrands()

  currentEditingId.value = model.id

  formData.value = {
    brand_id: model.brand_id,
    name: model.name,
    status: model.status,
    sort_order: model.sort_order || 0
  }

  showEditModal.value = true
}

const deleteModel = async (model: Model) => {
  // 先检查删除权限
  if (!canDelete.value) {
    showDeleteDenied('型号管理', 'models:delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除型号"${model.name}"吗？此操作不可撤销。`,
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
    const response = await unifiedApi.delete(`/models/${model.id}`, { showError: false })

    if (response.success) {
      success(`操作成功：${response.message || '型号删除成功'}`)
      // 延迟一下刷新，确保后端操作完成
      setTimeout(() => {
        loadModels()
      }, 300)
    } else {
      error(`删除型号失败：${response.message || '未知错误'}`)
    }
  } catch (err: any) {
    logger.error('删除型号失败:', err)

    // 处理权限错误
    if (err.response?.status === 403) {
      showDeleteDenied('型号管理', 'models:delete')
    } else if (err.response?.status === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (err.response?.status === 404) {
      error('删除失败：型号不存在或已被删除')
    } else {
      // 避免重复显示错误信息
      const errorMessage = err.response?.data?.message || err.message || '未知错误'
      if (!errorMessage.includes('Network Error') || !err.response?.status) {
        error(`删除型号失败：${errorMessage}`)
      }
    }
  }
}

const submitForm = async () => {
  // 权限检查
  if (showCreateModal.value && !canCreate.value) {
    showCreateDenied('型号管理', 'models:create')
    return
  }

  if (showEditModal.value && !canEdit.value) {
    showEditDenied('型号管理', 'models:edit')
    return
  }

  submitting.value = true

  try {
    // 数据验证和类型转换
    const submissionData = {
      brand_id: formData.value.brand_id as number,
      name: formData.value.name?.trim(),
      status: parseInt(String(formData.value.status)),
      sort_order: parseInt(String(formData.value.sort_order)) || 0
    }

    // 验证必需字段
    if (!submissionData.brand_id || isNaN(submissionData.brand_id)) {
      error('表单验证失败：请选择品牌')
      submitting.value = false
      return
    }

    if (!submissionData.name) {
      error('表单验证失败：请输入型号名称')
      submitting.value = false
      return
    }

    if (submissionData.name.trim().length < 1) {
      error('表单验证失败：型号名称至少需要1个字符')
      submitting.value = false
      return
    }

    if (submissionData.name.trim().length > 50) {
      error('表单验证失败：型号名称不能超过50个字符')
      submitting.value = false
      return
    }


    let response

    if (showCreateModal.value) {
      response = await unifiedApi.post('/models', submissionData, { showError: false })
      if (response.success) {
        success(`操作成功：${response.message || '型号创建成功'}`)
        closeModal()
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadModels()
        }, 300)
      } else {
        error(`创建型号失败：${response.message || '未知错误'}`)
      }
    } else {
      if (!currentEditingId.value) {
        error('操作失败：无法获取型号ID')
        submitting.value = false
        return
      }

      // 数据验证和类型转换（编辑模式）
      const editSubmissionData = {
        brand_id: formData.value.brand_id as number,
        name: formData.value.name?.trim(),
        status: parseInt(String(formData.value.status)),
        sort_order: parseInt(String(formData.value.sort_order)) || 0
      }

      // 验证必需字段（编辑模式）
      if (!editSubmissionData.brand_id || isNaN(editSubmissionData.brand_id)) {
        error('表单验证失败：请选择品牌')
        submitting.value = false
        return
      }

      if (!editSubmissionData.name) {
        error('表单验证失败：请输入型号名称')
        submitting.value = false
        return
      }


      response = await unifiedApi.put(`/models/${currentEditingId.value}`, editSubmissionData, { showError: false })
      if (response.success) {
        success(`操作成功：${response.message || '型号更新成功'}`)
        closeModal()
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadModels()
        }, 300)
      } else {
        error(`更新型号失败：${response.message || '未知错误'}`)
      }
    }
  } catch (err: any) {
    logger.error('提交表单失败:', err)

    // 处理权限错误
    if (err.response?.status === 403) {
      if (showCreateModal.value) {
        showCreateDenied('型号管理', 'models:create')
      } else {
        showEditDenied('型号管理', 'models:edit')
      }
    } else if (err.response?.status === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (err.response?.status === 422) {
      // 表单验证错误
      const errors = err.response.data.errors || {}
      const errorMessages = Object.values(errors).flat().join('；')
      error(`表单验证失败：${errorMessages || '请检查输入数据是否正确'}`)
    } else {
      // 避免重复显示错误信息
      const errorMessage = err.response?.data?.message || err.message || '未知错误'
      if (!errorMessage.includes('Network Error') || !err.response?.status) {
        error(`操作失败：${errorMessage}`)
      }
    }
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
    brand_id: null as number | null,
    name: '',
    status: 1,
    sort_order: 0
  }

  // 对于编辑模式，需要比较原始数据
  if (showEditModal.value && currentEditingId.value) {
    const originalModel = models.value.find(m => m.id === currentEditingId.value)
    if (originalModel) {
      return (
        currentForm.brand_id !== originalModel.brand_id ||
        currentForm.name !== originalModel.name ||
        currentForm.status !== originalModel.status ||
        currentForm.sort_order !== originalModel.sort_order
      )
    }
  }

  // 对于创建模式，检查是否有任何输入
  return (
    currentForm.brand_id !== null ||
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
        cancelButtonText: '取消',
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
    brand_id: null,
    name: '',
    status: 1,
    sort_order: 0
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 处理新增型号
const handleCreateModel = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令和 v-if，但双保险）
  if (!canCreate.value) {
    showCreateDenied('型号管理', 'models:create')
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

  const draggedModel = models.value[dragIndex]
  const targetModel = models.value[dropIndex]

  // 只允许在同一品牌内拖拽排序
  if (draggedModel.brand_id !== targetModel.brand_id) {
    warning('只能在同一品牌内进行拖拽排序')
    handleDragEnd()
    return
  }

  // 重新排列数组
  const newModels = [...models.value]
  const [movedItem] = newModels.splice(dragIndex, 1)
  newModels.splice(dropIndex, 0, movedItem)

  // 按品牌分组更新 sort_order 值
  updateSortOrdersByBrand(newModels)

  models.value = newModels

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadModels(true, false, false)

  handleDragEnd()
}

// 按品牌分组更新排序值
const updateSortOrdersByBrand = (modelsList: Model[]) => {
  // 按品牌分组
  const brandGroups: { [key: number]: Model[] } = {}
  modelsList.forEach(model => {
    if (!brandGroups[model.brand_id]) {
      brandGroups[model.brand_id] = []
    }
    brandGroups[model.brand_id].push(model)
  })

  // 为每个品牌内的型号重新分配 sort_order
  Object.keys(brandGroups).forEach(brandId => {
    const brandModels = brandGroups[Number(brandId)]
    brandModels.forEach((model, index) => {
      // 在原数组中找到对应的模型并更新 sort_order
      const originalModel = modelsList.find(m => m.id === model.id)
      if (originalModel) {
        originalModel.sort_order = index
      }
    })
  })
}

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return
  if (!canEdit.value) {
    showEditDenied('型号管理', 'models:edit')
    return
  }

  savingOrder.value = true
  try {
    const items = models.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/models/batch/reorder', { items })
    if (response.success) {
      success('排序已保存')
    }
  } catch (error) {
    handleApiErrorWithPermission(error, '保存排序失败', '型号管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  const model = models.value[index]
  const oldSortOrder = model.sort_order
  const newSortOrder = value

  // 更新该型号的排序值
  model.sort_order = newSortOrder

  // 重新排序该品牌下的所有型号
  const brandModels = models.value.filter(m => m.brand_id === model.brand_id)
  brandModels.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  // 更新该品牌下所有型号的 sort_order，使其连续
  brandModels.forEach((m, idx) => {
    const targetModel = models.value.find(item => item.id === m.id)
    if (targetModel) {
      targetModel.sort_order = idx
    }
  })

  // 按品牌和 sort_order 重新排序整个列表
  models.value.sort((a, b) => {
    if (a.brand_id !== b.brand_id) {
      return a.brand_id - b.brand_id
    }
    return (a.sort_order || 0) - (b.sort_order || 0)
  })

  await saveSortOrder()
}

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return
  }

  // 并行加载数据
  await Promise.all([
    initFieldPermissions(),
    loadBrands(),
    loadModels()
  ])
})
</script>

<style scoped>
.models-view {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
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

.model-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.model-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.brand-name {
  font-size: 14px;
  color: #333;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.warning-badge {
  background: #ffc107;
  color: #212529;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
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
  .models-view {
    padding: 8px;
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

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 16px;
  }

  
  .model-info {
    max-width: 150px;
  }
}

</style>
<style>
.models-dialog-form .el-form-item:last-child {
  margin-bottom: 0;
}

.models-dialog-form .el-input,
.models-dialog-form .el-input-number,
.models-dialog-form .el-select,
.models-dialog-form .el-radio-group {
  width: 100%;
}

@media (max-width: 767px) {
  .models-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .models-view .stat-card {
    padding: 14px 12px;
    border-radius: 16px;
    gap: 12px;
  }

  .models-view .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .models-view .stat-value {
    font-size: 20px;
  }

  .models-view .stat-label {
    font-size: 12px;
  }

  .models-view .table-section {
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
  }

  .models-view .table-responsive {
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }

  .models-view .table {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
  }

  .models-view .table th,
  .models-view .table td {
    white-space: normal;
    word-break: break-word;
  }

  .models-view .actions {
    min-width: 74px;
  }

  .models-view .model-info {
    width: 100%;
    max-width: none;
  }

  .models-view .model-name,
  .models-view .brand-name {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.4;
    text-align: center;
  }

  .models-view .status-badge {
    width: 100%;
    max-width: 88px;
    justify-content: center;
    white-space: normal;
    line-height: 1.35;
    padding: 6px 8px;
  }

  .models-dialog-form .el-form-item {
    margin-bottom: 12px;
  }

  .models-dialog-form .el-form-item__label {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .models-dialog-form .el-input__wrapper,
  .models-dialog-form .el-input-number .el-input__wrapper,
  .models-dialog-form .el-select__wrapper {
    min-height: 42px;
    border-radius: 12px;
  }

  .models-dialog-form .el-radio-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .models-dialog-form .el-radio {
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
  .models-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px 0;
    padding: 0;
  }

  .models-view .stat-card {
    padding: 12px 10px;
    gap: 10px;
  }

  .models-view .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .models-view .stat-value {
    font-size: 18px;
  }

  .models-view .stat-label {
    font-size: 11px;
  }

  .mobile-action-row td {
    padding: 6px 4px 10px !important;
    background: linear-gradient(180deg, #f8fbff 0%, #f4f7ff 100%);
    border-top: none !important;
  }

  .models-view .table th,
  .models-view .table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .models-view .table th:nth-child(1),
  .models-view .table td:nth-child(1) {
    width: 48px;
  }

  .models-view .table th:nth-child(2),
  .models-view .table td:nth-child(2) {
    width: 84px;
  }

  .models-view .table th:nth-child(3),
  .models-view .table td:nth-child(3) {
    width: auto;
  }

  .models-view .table th:nth-child(4),
  .models-view .table td:nth-child(4) {
    width: 84px;
  }

  .models-view .model-name {
    font-size: 14px;
    font-weight: 700;
  }

}
</style>
