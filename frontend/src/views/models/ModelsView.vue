<template>
  <div class="models-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="models_modelsview"
      module-name="型号管理"
      permission-code="models:view"
    >
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
            <i class="fas fa-plus" />
            <span>新增</span>
          </el-button>
          <el-button
            class="tf-button--refresh"
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
            v-if="canViewField('stats_total_models')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-mobile-alt" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ modelStats.total }}
              </div>
              <div class="stat-label">
                型号总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_active_models')"
            class="stat-card stat-card--success"
          >
            <div class="stat-icon">
              <i class="fas fa-check-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ modelStats.active }}
              </div>
              <div class="stat-label">
                启用型号
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_inactive_models')"
            class="stat-card stat-card--danger"
          >
            <div class="stat-icon">
              <i class="fas fa-pause-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ modelStats.inactive }}
              </div>
              <div class="stat-label">
                禁用型号
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_related_brands')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-cog" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ modelStats.related_brands }}
              </div>
              <div class="stat-label">
                关联品牌
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="tableLoading"
          @search="searchModels"
          @reset="resetSearch"
        >
          <template #primary>
            <el-input
              v-if="canViewField('name')"
              v-model="searchForm.name"
              placeholder="搜索关键词"
              clearable
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            v-if="canViewField('brand_name')"
            class="form-group filter-item"
            data-field="brand_id"
          >
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

          <div
            v-if="canViewField('status')"
            class="form-group filter-item"
            data-field="status"
          >
            <el-select
              v-model="searchForm.status"
              placeholder="状态"
              clearable
              @change="searchModels"
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
            型号列表
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>

          <div class="table-responsive">
            <el-table
              ref="modelsTableRef"
              v-tf-loading="{ active: tableLoading || refreshing, text: '正在刷新型号列表...' }"
              v-table-double-tap="mobileDetailTapOptions"
              class="data-table devices-table base-data-table models-data-table"
              :data="models"
              border
              stripe
              table-layout="fixed"
              :fit="true"
              :row-key="getModelRowKey"
              @row-dblclick="handleMobileDetailDoubleClick"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="tableLoading"
                  mode="block"
                  text="加载型号列表..."
                />
                <DataEmptyState
                  v-else
                  description="暂无型号数据"
                >
                  <el-button
                    type="info"
                    @click="loadModels()"
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
                v-if="showModelIndexField"
                label="序号"
                :width="$getNumberColumnWidth((models || []).map((_row, $index) => (pagination.page - 1) * pagination.page_size + $index + 1), 70)"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="table-number-badge">{{ (pagination.page - 1) * pagination.page_size + $index + 1 }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showBrandField"
                label="品牌"
                min-width="110"
                align="center"
              >
                <template #default="{ row }">
                  {{ getBrandName(row) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('name')"
                prop="name"
                label="型号"
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
                      v-permission="'models:edit'"
                      type="primary"
                      @click.stop="editModel(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'models:delete'"
                      type="danger"
                      @click.stop="deleteModel(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <RecordDetailDialog
              v-model="mobileDetailVisible"
              title="型号详情"
              :fields="mobileDetailFields"
              :record="mobileDetailRow"
              :has-actions="canEdit || canDelete"
            >
              <template #actions="{ row }">
                <el-button
                  v-if="canEdit"
                  v-permission="'models:edit'"
                  type="primary"
                  @click.stop="runMobileDetailAction(() => editModel(row))"
                >
                  <i class="fas fa-edit" /><span>编辑</span>
                </el-button><el-button
                  v-if="canDelete"
                  v-permission="'models:delete'"
                  type="danger"
                  @click.stop="runMobileDetailAction(() => deleteModel(row))"
                >
                  <i class="fas fa-trash" /><span>删除</span>
                </el-button>
              </template>
            </RecordDetailDialog>
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
          :title="isEditMode ? '编辑型号' : '新增型号'"
          width="500px"
          dialog-class="models-form-dialog crud-dialog-sm"
          :close-on-click-modal="false"
          :show-default-footer="false"
        >
          <el-form
            :model="formData"
            label-width="80px"
            class="models-dialog-form tf-form-layout tf-form-grid"
          >
            <el-form-item
              v-if="canViewField('brand_name')"
              label="品牌"
              required
            >
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
            <el-form-item
              v-if="canViewField('name')"
              label="型号"
              required
            >
              <el-input
                v-model="formData.name"
                placeholder="请输入型号"
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
                class="tf-state-selector"
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
                @click="closeModal"
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
import { usePageShortcuts } from '@/composables/useRouteDialog'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import unifiedApi from '@/utils/unified-api'
import { getCachedBrands } from '@/services/reference-options'
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import Pagination from '../../components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionGate, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { logger } from '@/utils/logger'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { formatDateTime as formatDate } from '@/utils/format'
import { getRequestErrorMessage, getRequestErrorStatus } from '@/utils/api-response'
import type { QueryParams } from '@/types/shared'
import { useElementTableSortable } from '@/composables/useElementTableSortable'
import { useReferenceOrdering } from '@/composables/useReferenceOrdering'
import type { Brand, Model } from '@/types'

const _router = useRouter()
// 使用统一的 composable
const { success, error, info: _info, handleApiError: _handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('models')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refreshData } = useRefreshData()
const { isMobile } = useMobile()
const { init: initFieldPermissions } = fieldPermissions
const modelListRequest = useLatestRequest()
const modelStatsRequest = useLatestRequest()

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

  return (canCreate.value || canEdit.value) && fieldPermissions.isFieldEditable('models_modelsview', getFieldKey(fieldName), { allowUnconfigured: true })
}

const hasBrandFilter = computed(() => searchForm.value.brand_id !== null)
const showSortField = computed(() => canViewField('sort_order') && !isMobile.value && hasBrandFilter.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value && hasBrandFilter.value)
const showModelIndexField = computed(() => canViewField('id') && !isMobile.value)
const showActionField = computed(() => (
  shouldShowActionColumn(canViewField('actions'), [canEdit.value, canDelete.value]) && !isMobile.value
))
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showUpdatedAtField = computed(() => canViewField('updated_at') && !isMobile.value)
const showBrandField = computed(() => canViewField('brand_name'))
const showStatsCards = computed(() => (
  canViewField('stats_total_models') ||
  canViewField('stats_active_models') ||
  canViewField('stats_inactive_models') ||
  canViewField('stats_related_brands')
))
// 响应式数据
const modelsTableRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)



// 搜索相关状态
const searchExpanded = ref(false)
const tableLoading = ref(true)
const submitting = ref(false)
const models = ref<Model[]>([])
const modelStats = ref({ total: 0, active: 0, inactive: 0, related_brands: 0 })
const getModelRowKey = (model: Model) => String(model.id)
const brands = ref<Brand[]>([])
let lastLoadedQueryKey = ''
const showCreateModal = ref(false)
const showEditModal = ref(false)
const currentEditingId = ref<number | null>(null)

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
  page_size: 20,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})

const loadModelStats = async () => {
  const request = modelStatsRequest.nextRequest()
  try {
    const params: Record<string, string | number> = {}
    const name = searchForm.value.name.trim()
    if (name) params.name = name
    if (searchForm.value.brand_id !== null) params.brand_id = searchForm.value.brand_id
    if (searchForm.value.status !== '') params.status = searchForm.value.status
    // 统计卡片属于辅助信息，不阻塞型号列表的首屏展示。
    const response = await unifiedApi.get('/models/stats/overview', {
      params,
      signal: request.signal,
      showLoading: false
    })
    if (!request.isLatest()) return
    if (response.success) {
      const data = response.data || {}
      modelStats.value = {
        total: Number(data.total) || 0,
        active: Number(data.active) || 0,
        inactive: Number(data.inactive) || 0,
        related_brands: Number(data.related_brands) || 0
      }
    }
  } catch (err) {
    if (modelStatsRequest.isCanceledError(err)) return
    if (!request.isLatest()) return
    logger.error('获取型号统计失败:', err)
    modelStats.value = { total: 0, active: 0, inactive: 0, related_brands: 0 }
  }
}

// 模态框显示状态
const dialogVisible = computed({
  get: () => showCreateModal.value || showEditModal.value,
  set: (value) => {
    if (!value) {
      closeModal()
    }
  }
})

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 方法
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
    const response = await getCachedBrands()

    if (response.success) {
      // 使用统一的数据提取方法
      brands.value = extractResponseData<Brand[]>(response.data)
    } else {
      logger.error('获取品牌列表失败:', response.message)
      brands.value = []
    }
  } catch (error) {
    logger.error('获取品牌列表异常:', error)
    brands.value = []
  }
}

const loadModels = async (_bustCache = false, silentError = false, _showLoadingState = true) => {
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('型号管理', 'models:view')
    }
    models.value = []
    tableLoading.value = false
    return false
  }

  const params: QueryParams = {
    page: pagination.value.page,
    page_size: pagination.value.page_size,
    // 全部型号按品牌分组，选择品牌后按该品牌的顺序展示。
    sort_by: searchForm.value.brand_id === null ? 'brand_id' : 'sort_order',
    sort_order: 'asc'
  }
  const normalizedName = searchForm.value.name.trim()
  if (normalizedName) params.name = normalizedName
  if (searchForm.value.brand_id !== null) params.brand_id = searchForm.value.brand_id
  if (searchForm.value.status !== '') params.status = searchForm.value.status

  const queryKey = JSON.stringify(params)
  if (!_bustCache && queryKey === lastLoadedQueryKey && !tableLoading.value && !refreshing.value) {
    return true
  }

  const request = modelListRequest.nextRequest()
  tableLoading.value = _showLoadingState
  try {
    const responsePromise = unifiedApi.get('/models', {
      params,
      useCache: !_bustCache,
      showLoading: false,
      showError: false,
      signal: request.signal
    })
    void loadModelStats()
    const response = await responsePromise

    if (!request.isLatest()) {
      return false
    }

    if (response.success) {
      models.value = sortOptionsByOrder(response.data.models || [])
      lastLoadedQueryKey = queryKey
      // 确保 total 是数字类型
      const paginationData = response.data.pagination || {
        page: 1,
        page_size: 10,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      }
      pagination.value = {
        page: Number(paginationData.page) || 1,
        page_size: Number(paginationData.page_size) || pagination.value.page_size,
        total: Number(paginationData.total) || 0,
        total_pages: Number(paginationData.total_pages) || 0,
        has_next: Boolean(paginationData.has_next),
        has_prev: Boolean(paginationData.has_prev)
      }
      return true
    } else {
      logger.error('API返回失败:', response.message)
      if (!silentError) {
        error(response.message || '获取型号列表失败')
      }
      return false
    }
  } catch (err: unknown) {
    if (!request.isLatest() || modelListRequest.isCanceledError(err)) {
      return false
    }

    logger.error('获取型号列表失败:', err)
    // 静默模式不显示错误提示
    if (silentError) {
      return false
    }

    // 处理权限错误
    if (getRequestErrorStatus(err) === 403) {
      showViewDenied('型号管理', 'models:view')
    } else if (getRequestErrorStatus(err) === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
      // 可以在这里触发登出逻辑
    } else {
      // 简化错误处理
      const message = getRequestErrorMessage(err, '')
      if (message) {
        error(`获取型号列表失败：${message}`)
      } else {
        error('获取型号列表失败：请检查网络连接或联系管理员')
      }
    }
    return false
  } finally {
    if (request.isLatest()) {
      tableLoading.value = false
    }
  }
}

const searchModels = () => {
  pagination.value.page = 1
  void loadModels()
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    brand_id: null,
    status: ''
  }
  pagination.value.page = 1
  void loadModels()
}

const _changePage = (page: number) => {
  pagination.value.page = page
  loadModels()
}

const handlePaginationChange = (page: number, pageSize: number): void => {
  const oldPageSize = pagination.value.page_size
  pagination.value.page_size = pageSize
  pagination.value.page = pageSize !== oldPageSize ? 1 : page
  loadModels()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  pagination.value.page = 1
  await refreshData(async () => {
    if (!await loadModels(true, true, false)) throw new Error('获取型号列表失败')
  }, { successMessage: '数据刷新成功', errorMessage: '刷新失败，请重试' })
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
    brand_id: model.brand_id ?? null,
    name: model.name,
    status: model.status ?? 1,
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
    if (!await confirm(
      `确定要删除型号"${model.name}"吗？此操作不可撤销。`,
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
    const response = await unifiedApi.delete(`/models/${model.id}`, { showError: false })

    if (response.success) {
      success(`操作成功：${response.message || '型号删除成功'}`)
      await loadModels(true, false, false)
    } else {
      error(`删除型号失败：${response.message || '未知错误'}`)
    }
  } catch (err: unknown) {
    logger.error('删除型号失败:', err)

    // 处理权限错误
    if (getRequestErrorStatus(err) === 403) {
      showDeleteDenied('型号管理', 'models:delete')
    } else if (getRequestErrorStatus(err) === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (getRequestErrorStatus(err) === 404) {
      error('删除失败：型号不存在或已被删除')
    } else {
      // 避免重复显示错误信息
      const errorMessage = getRequestErrorMessage(err, '未知错误')
      if (!errorMessage.includes('Network Error') || !getRequestErrorStatus(err)) {
        error(`删除型号失败：${errorMessage}`)
      }
    }
  }
}

const submitForm = async () => {
  if (submitting.value) return
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
        await loadModels(true, false, false)
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
        await loadModels(true, false, false)
      } else {
        error(`更新型号失败：${response.message || '未知错误'}`)
      }
    }
  } catch (err: unknown) {
    logger.error('提交表单失败:', err)

    // 处理权限错误
    if (getRequestErrorStatus(err) === 403) {
      if (showCreateModal.value) {
        showCreateDenied('型号管理', 'models:create')
      } else {
        showEditDenied('型号管理', 'models:edit')
      }
    } else if (getRequestErrorStatus(err) === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (getRequestErrorStatus(err) === 422) {
      // 表单验证错误
      const errorPayload = err !== null && typeof err === 'object' ? err as Record<string, unknown> : {}
      const response = errorPayload.response !== null && typeof errorPayload.response === 'object' ? errorPayload.response as Record<string, unknown> : {}
      const responseData = response.data !== null && typeof response.data === 'object' ? response.data as Record<string, unknown> : {}
      const errors = responseData.errors && typeof responseData.errors === 'object' ? responseData.errors as Record<string, unknown> : {}
      const errorMessages = Object.values(errors).flatMap(value => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string').join('；')
      error(`表单验证失败：${errorMessages || '请检查输入数据是否正确'}`)
    } else {
      // 避免重复显示错误信息
      const errorMessage = getRequestErrorMessage(err, '未知错误')
      if (!errorMessage.includes('Network Error') || !getRequestErrorStatus(err)) {
        error(`操作失败：${errorMessage}`)
      }
    }
  } finally {
    submitting.value = false
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

// 处理新增型号
const handleCreateModel = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令和 v-if，但双保险）
  if (!canCreate.value) {
    showCreateDenied('型号管理', 'models:create')
    return
  }

  showCreateModal.value = true
}

// 共用排序写入：单条编辑不改变其他记录，拖拽保留已有排序值范围。
const { savingOrder, handleSortOrderChange, handleRowMove: handleModelRowMove } = useReferenceOrdering({
  rows: models,
  endpoint: '/models',
  moduleName: '型号管理',
  canEdit,
  scopeKey: model => model.brand_id,
  reload: async () => { await loadModels(true, false, false) }
})

useElementTableSortable({
  tableRef: modelsTableRef,
  enabled: computed(() => canEdit.value && !savingOrder.value && !tableLoading.value && !isMobile.value && showSortField.value),
  orderKey: () => models.value.map(model => model.id).join('|'),
  onMove: handleModelRowMove
})

// 生命周期
const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions,
  handleRowDoubleClick: handleMobileDetailDoubleClick, runDetailAction: runMobileDetailAction } = useMobileTableDetail<Model>({
    enabled: computed(() => isMobile.value && canView.value), rows: models, getKey: row => row.id
  })
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'name', label: '型号名称', value: row.name, visible: canViewField('name') },
    { key: 'brand_name', label: '所属品牌', value: row.brand_name, visible: canViewField('brand_name') },
    { key: 'status', label: '状态', value: row.status === 1 ? '启用' : '禁用', visible: canViewField('status') },
    { key: 'sort_order', label: '排序', value: row.sort_order, visible: canViewField('sort_order') },
    { key: 'created_at', label: '创建时间', value: formatDate(row.created_at || ''), visible: canViewField('created_at'), wide: true }
  ]
})


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

usePageShortcuts('/models', {
  'model-create': { open: handleCreateModel }
})
</script>

<style scoped>
.models-view {
  padding: 24px;
  background: var(--tf-color-surface);
  min-height: 100vh;
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
  font-size: var(--tf-type-scale-14);
}

.brand-name {
  font-size: var(--tf-type-scale-14);
  color: var(--text-primary);
  background: var(--tf-color-surface-muted);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.warning-badge {
  background: var(--warning-color);
  color: var(--tf-color-gray-bootstrap-900);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: var(--tf-type-scale-10);
  font-weight: 500;
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
  .models-view {
    padding: 8px;
  }

  .action-buttons {
    display: flex;
    flex-direction: row;
    width: auto;
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
    font-size: var(--tf-type-scale-13);
    line-height: 1.4;
    padding-bottom: 4px;
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
    border: 1px solid var(--tf-color-border-blue);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }
}

@media (max-width: 479px) {
  .models-view .model-name {
    font-size: var(--tf-type-scale-14);
    font-weight: 700;
  }

}
</style>
