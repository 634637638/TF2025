<template>
  <div class="colors-view admin-page">
    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-palette"
      title="颜色管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="handleCreateColor"
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
      module-key="colors_colorsview"
      module-name="颜色管理"
      permission-code="colors:view"
    />

    <!-- 权限验证通过后的内容 -->
    <div v-else class="content admin-page-content">

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_colors')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-palette"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">颜色总数</div>
        </div>
      </div>
      <div v-if="canViewField('stats_active_colors')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ colors.filter(c => c.status === 1 || c.is_active === true).length }}</div>
          <div class="stat-label">启用颜色</div>
        </div>
      </div>
      <div v-if="canViewField('stats_inactive_colors')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ colors.filter(c => c.status === 0 || c.is_active === false).length }}</div>
          <div class="stat-label">禁用颜色</div>
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
      @search="searchColors"
      @reset="resetSearch"
    >
      <template #primary>
        <el-input
          v-if="canViewField('name')"
          v-model="searchForm.name"
          placeholder="搜索关键词"
          clearable
          @keyup.enter="searchColors"
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
          @change="searchColors"
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
        颜色列表
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>
      
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th v-if="showSortField" width="40"></th>
              <th v-if="showSortOrderField" width="60">排序</th>
              <th v-if="canViewField('id')" width="80">ID</th>
              <th v-if="canViewField('name')" width="160">颜色名称</th>
              <th v-if="showCodeField" width="200">颜色预览</th>
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
            <tr v-else-if="colors.length === 0" class="empty-row">
              <td :colspan="visibleColumnCount">
                <div class="empty-content">
                  <i class="fas fa-inbox"></i>
                  <div class="empty-text">
                    <h4>暂无颜色数据</h4>
                    <p>点击上方"新增颜色"按钮添加第一个颜色</p>
                    <el-button size="small" type="info" class="mt-2" @click="loadColors()" :disabled="loading">
                      <i class="fas fa-sync-alt"></i>
                      {{ loading ? '加载中...' : '重新加载' }}
                    </el-button>
                  </div>
                </div>
              </td>
            </tr>
            <template v-else v-for="(color, index) in colors" :key="color.id">
            <tr
              class="data-row"
              :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
              :draggable="canEdit"
              @click="handleMobileRowTap(color.id)"
              @dblclick="toggleMobileActions(color.id)"
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
                  v-model.number="color.sort_order"
                  type="number"
                  class="sort-order-input"
                  :disabled="!canEdit"
                  min="0"
                  max="9999"
                  @change="canEdit ? handleSortOrderChange(index, color.sort_order) : null"
                />
              </td>
              <td v-if="canViewField('id')">
                <span class="id-badge">{{ index + 1 }}</span>
              </td>
              <td v-if="canViewField('name')">
                <div class="color-info">
                  <div class="color-name">
                    <strong>{{ color.name || '未命名颜色' }}</strong>
                    <span v-if="!color.name" class="warning-badge">未命名</span>
                  </div>
                  <div v-if="isMobile && canViewField('code')" class="mobile-color-preview">
                    <span
                      class="color-circle"
                      :style="{ backgroundColor: color.hex_code || getColorCode(color.name) }"
                      :title="color.hex_code || color.name"
                    ></span>
                    <span class="mobile-sub-value">{{ color.hex_code || getColorCode(color.name) }}</span>
                  </div>
                </div>
              </td>
              <td v-if="showCodeField">
                <div class="color-preview">
                  <div
                    class="color-circle"
                    :style="{ backgroundColor: color.hex_code || getColorCode(color.name) }"
                    :title="color.hex_code || color.name"
                  ></div>
                  <span class="color-code">{{ color.hex_code || getColorCode(color.name) }}</span>
                </div>
              </td>
              <td v-if="canViewField('status')">
                <span :class="['status-badge', (color.status === 1 || color.is_active === true) ? 'status-active' : 'status-inactive']">
                  <i :class="(color.status === 1 || color.is_active === true) ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ (color.status === 1 || color.is_active === true) ? '启用' : '禁用' }}
                </span>
              </td>
              <td v-if="showCreatedAtField">
                <div class="time-info">
                  <i class="fas fa-clock"></i>
                  {{ formatDate(color.created_at) }}
                </div>
              </td>
              <td v-if="showActionField" class="actions">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    v-permission="'colors:edit'"
                    type="primary"
                    size="small"
                    @click="editColor(color)"
                    title="编辑"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'colors:delete'"
                    type="danger"
                    size="small"
                    @click="deleteColor(color)"
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
              v-if="isMobile && mobileActionRowId === color.id && (canEdit || canDelete)"
              class="mobile-action-row"
            >
              <td :colspan="visibleColumnCount">
                <div class="mobile-row-actions">
                  <el-button
                    v-if="canEdit"
                    v-permission="'colors:edit'"
                    type="primary"
                    size="small"
                    @click.stop="editColor(color)"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'colors:delete'"
                    type="danger"
                    size="small"
                    @click.stop="deleteColor(color)"
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
      :title="isEditMode ? '编辑颜色' : '新增颜色'"
      width="500px"
      dialog-class="colors-form-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      @close="attemptCloseModal"
      :show-default-footer="false"
    >
      <el-form :model="formData" label-width="80px" class="colors-dialog-form">
        <el-form-item v-if="canViewField('name')" label="颜色名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入颜色名称，如：黑色、白色、深空灰等"
            clearable
            maxlength="50"
            show-word-limit
            @input="updateColorPreview"
            :disabled="!canEditField('name')"
          />
          <div v-if="canViewField('code') && formData.name && formData.name.trim()" class="color-preview-modal">
            <div class="preview-label">颜色预览:</div>
            <div class="preview-content">
              <div
                class="color-circle-large"
                :style="{ backgroundColor: getColorCode(formData.name.trim()) }"
              ></div>
              <span class="color-code-text">{{ getColorCode(formData.name.trim()) }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="canViewField('sort_order')" label="排序">
          <el-input-number
            v-model="formData.sort_order"
            :min="0"
            :max="999999"
            placeholder="请输入排序值，数字越小越靠前"
            controls-position="right"
            style="width: 100%"
            :disabled="!canEditField('sort_order')"
          />
          <div class="input-hint">
            <span>范围: 0-999999，数字越小越靠前</span>
          </div>
        </el-form-item>
        <el-form-item v-if="canViewField('status')" label="状态">
          <el-radio-group v-model="formData.status" :disabled="!canEditField('status')">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
          <div class="input-hint">
            <span>禁用的颜色将不会在产品选择中显示</span>
          </div>
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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionDenied, PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import type { Color } from '@/types'

// 获取路由实例
const router = useRouter()

// 使用统一的 composable
const { success, error, warning, info, handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('colors')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const authStore = useAuthStore()
const { init: initFieldPermissions } = fieldPermissions

const colorFieldMap: Record<string, string> = {
  stats_total_colors: 'stats.total_colors',
  stats_active_colors: 'stats.active_colors',
  stats_inactive_colors: 'stats.inactive_colors',
  stats_related_phones: 'stats.related_phones',
  id: 'color.id',
  name: 'color.name',
  code: 'color.code',
  status: 'color.status',
  sort_order: 'color.sort_order',
  created_at: 'color.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => colorFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('colors_colorsview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('colors_colorsview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showCodeField = computed(() => canViewField('code') && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_colors') ||
  canViewField('stats_active_colors') ||
  canViewField('stats_inactive_colors') ||
  canViewField('stats_related_phones')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('name'),
    showCodeField.value,
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
})

// 响应式数据
const { loading } = useLoadingState()
const submitting = ref(false)
const savingOrder = ref(false)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)
const colors = ref<Color[]>([])

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
const showCreateModal = ref(false)
const showEditModal = ref(false)

// 搜索相关状态
const searchExpanded = ref(false)
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

// 颜色映射
const colorMap: { [key: string]: string } = {
  '黑色': '#000000',
  '白色': '#FFFFFF',
  '红色': '#FF0000',
  '蓝色': '#0000FF',
  '绿色': '#00FF00',
  '黄色': '#FFFF00',
  '紫色': '#800080',
  '橙色': '#FFA500',
  '粉色': '#FFC0CB',
  '灰色': '#808080',
  '银色': '#C0C0C0',
  '金色': '#FFD700',
  '深空灰': '#4A4A4A',
  '深空黑': '#1C1C1E',
  '星光色': '#F2F2F7',
  '午夜色': '#1C1C1E',
  '远峰蓝': '#5AC8FA',
  '粉红色': '#FF2D92',
  '天蓝色': '#87CEEB',
  '古铜色': '#CD7F32',
  '玫瑰金': '#B76E79',
  '石墨色': '#4A4A4A',
  '雪蓝色': '#B0E0E6',
  '薄荷绿': '#98FB98'
}

// 方法
const getColorCode = (colorName: string): string => {
  if (!colorName) return '#CCCCCC'
  return colorMap[colorName] || '#CCCCCC'
}

const updateColorPreview = () => {
  // 这个方法用于在输入时更新预览，实际上通过计算属性已经处理了
}

const loadColors = async (bustCache = false, silentError = false, showLoadingState = true) => {
  // 检查查看权限
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('颜色管理', 'colors:view')
    }
    colors.value = []
    return
  }

  // 根据 showLoadingState 参数决定是否显示加载状态
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
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    const response = await unifiedApi.get('/colors', { params })

    if (response.success) {
      colors.value = response.data.colors || []
      // 确保 total 是数字类型
      const apiPagination = response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 }
      pagination.value = {
        ...apiPagination,
        total: Number(apiPagination.total) || 0,
        pages: Number(apiPagination.pages) || 0
      }

      // 按 sort_order 排序，确保序号和排序值一致
      colors.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      colors.value = []
      pagination.value = { page: 1, limit: 50, total: 0, pages: 0 }
      if (!silentError) {
        error(`获取颜色列表失败: ${response.message || '未知错误'}`)
      }
    }
  } catch (err: any) {
    logger.error('获取颜色列表失败:', err)
    colors.value = []
    pagination.value = { page: 1, limit: 50, total: 0, pages: 0 }

    // 静默模式不显示错误提示
    if (silentError) {
      return
    }

    // 使用统一的错误处理
    handleApiError(err, '获取颜色列表失败')
  } finally {
    // 只有在显示加载状态时才重置
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const searchColors = () => {
  pagination.value.page = 1
  loadColors(true) // 搜索时破坏缓存
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    status: ''
  }
  pagination.value.page = 1
  loadColors(true) // 重置时破坏缓存
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadColors()
}

const handlePaginationChange = (page, pageSize) => {
  pagination.value.page = page
  pagination.value.limit = pageSize
  if (pageSize !== pagination.value.limit) {
    pagination.value.page = 1
  }
  loadColors()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadColors(true, false, false)
  })
  success('数据刷新成功', { duration: 2000 })
}

const editColor = (color: Color) => {
  // 先检查编辑权限 - 使用友好的权限提示
  if (!canEdit.value) {
    showEditDenied('颜色管理', 'colors:edit')
    return
  }

  currentEditingId.value = color.id

  formData.value = {
    name: color.name,
    status: color.status !== undefined ? (color.status === 1 ? 1 : 0) : (color.is_active ? 1 : 0),
    sort_order: color.sort_order || 0
  }

  showEditModal.value = true
}

const deleteColor = async (color: Color) => {
  // 先检查删除权限 - 使用友好的权限提示
  if (!canDelete.value) {
    showDeleteDenied('颜色管理', 'colors:delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除颜色"${color.name}"吗？此操作不可撤销。`,
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
    const response = await unifiedApi.delete(`/colors/${color.id}`, { showError: false })

    if (response.success) {
      success(response.message || '颜色删除成功')
      // 延迟一下刷新，确保后端操作完成
      setTimeout(() => {
        loadColors()
      }, 300)
    } else {
      error(`删除颜色失败: ${response.message || '未知错误'}`)
    }
  } catch (err: any) {
    logger.error('删除颜色失败:', err)

    // 处理权限错误 - 使用友好的权限提示
    if (err.response?.status === 403) {
      showDeleteDenied('颜色管理', 'colors:delete')
    } else if (err.response?.status === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (err.response?.status === 404) {
      error('删除失败：颜色不存在或已被删除')
    } else {
      // 避免重复显示错误信息
      const errorMessage = err.response?.data?.message || err.message || '未知错误'
      if (!errorMessage.includes('Network Error') || !err.response?.status) {
        error('删除颜色失败', errorMessage)
      }
    }
  }
}

// 表单验证函数
const validateColorForm = () => {
  const errors = []

  // 验证颜色名称
  if (!formData.value.name || formData.value.name.trim() === '') {
    errors.push('颜色名称不能为空')
  } else if (formData.value.name.trim().length < 1) {
    errors.push('颜色名称至少需要1个字符')
  } else if (formData.value.name.trim().length > 50) {
    errors.push('颜色名称不能超过50个字符')
  }

  // 验证排序值
  if (formData.value.sort_order !== undefined && formData.value.sort_order !== null) {
    const sortOrder = parseInt(String(formData.value.sort_order))
    if (isNaN(sortOrder)) {
      errors.push('排序值必须是数字')
    } else if (sortOrder < 0) {
      errors.push('排序值不能小于0')
    } else if (sortOrder > 999999) {
      errors.push('排序值不能大于999999')
    }
  }

  // 验证状态值
  if (formData.value.status !== undefined && formData.value.status !== null) {
    if (![0, 1].includes(parseInt(String(formData.value.status)))) {
      errors.push('状态值必须是0或1')
    }
  }

  return errors
}

const submitForm = async () => {
  // 权限检查 - 使用友好的权限提示
  if (showCreateModal.value && !canCreate.value) {
    showCreateDenied('颜色管理', 'colors:create')
    return
  }

  if (showEditModal.value && !canEdit.value) {
    showEditDenied('颜色管理', 'colors:edit')
    return
  }

  // 先进行表单验证
  const validationErrors = validateColorForm()
  if (validationErrors.length > 0) {
    error(`表单验证失败: ${validationErrors.join('; ')}`)
    return
  }

  submitting.value = true

  try {
    let response
    const submitData = {
      name: formData.value.name.trim(),
      status: parseInt(String(formData.value.status)),
      sort_order: parseInt(String(formData.value.sort_order)) || 0
    }

    if (showCreateModal.value) {
      response = await unifiedApi.post('/colors', submitData, { showError: false })
      if (response.success) {
        success('操作成功', response.message || '颜色创建成功')
        closeModal()
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadColors()
        }, 300)
      } else {
        error('创建颜色失败', response.message || '未知错误')
      }
    } else {
      if (!currentEditingId.value) {
        error('操作失败：无法获取颜色ID')
        return
      }
      response = await unifiedApi.put(`/colors/${currentEditingId.value}`, submitData, { showError: false })
      if (response.success) {
        success('操作成功', response.message || '颜色更新成功')
        closeModal()
        // 延迟一下刷新，确保后端操作完成
        setTimeout(() => {
          loadColors()
        }, 300)
      } else {
        error('更新颜色失败', response.message || '未知错误')
      }
    }
  } catch (err: any) {
    logger.error('提交表单失败:', err)

    // 处理权限错误
    if (err.response?.status === 403) {
      if (showCreateModal.value) {
        showCreateDenied('颜色管理', 'colors:create')
      } else {
        showEditDenied('颜色管理', 'colors:edit')
      }
    } else if (err.response?.status === 401) {
      error('认证失败：您的登录状态已过期，请重新登录')
    } else if (err.response?.status === 422) {
      // 表单验证错误
      const errors = err.response.data.errors || {}
      const errorMessages = Object.values(errors).flat().join('；')
      error(`表单验证失败: ${errorMessages || '请检查输入数据是否正确'}`)
    } else {
      // 避免重复显示错误信息
      const errorMessage = err.response?.data?.message || err.message || '未知错误'
      if (!errorMessage.includes('Network Error') || !err.response?.status) {
        error('操作失败', errorMessage)
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
    name: '',
    status: 1,
    sort_order: 0
  }

  // 对于编辑模式，需要比较原始数据
  if (showEditModal.value && currentEditingId.value) {
    const originalColor = colors.value.find(c => c.id === currentEditingId.value)
    if (originalColor) {
      return (
        currentForm.name !== originalColor.name ||
        currentForm.status !== originalColor.status ||
        currentForm.sort_order !== originalColor.sort_order
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
  // 这里应该从后端获取相关手机数量，暂时返回模拟数据
  return Math.floor(Math.random() * 30) + 5
}

// 处理新增颜色
const handleCreateColor = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令和 v-if，但双保险）
  if (!canCreate.value) {
    showCreateDenied('颜色管理', 'colors:create')
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
  const newColors = [...colors.value]
  const [movedItem] = newColors.splice(dragIndex, 1)
  newColors.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newColors.forEach((item, index) => {
    item.sort_order = index
  })

  colors.value = newColors

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadColors(true, false, false)

  handleDragEnd()
}

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return
  if (!canEdit.value) {
    showEditDenied('颜色管理', 'colors:edit')
    return
  }

  savingOrder.value = true
  try {
    const items = colors.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/colors/batch/reorder', { items }, { showError: false })
    if (response.success) {
      success('排序已保存')
    }
  } catch (err) {
    logger.error('保存排序失败:', err)
    // 使用统一的权限错误处理
    handleApiErrorWithPermission(err, '保存排序失败', '颜色管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  colors.value[index].sort_order = value
  // 按新的 sort_order 重新排序
  colors.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  await saveSortOrder()
}

// 键盘快捷键处理
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  // Ctrl/Cmd + N: 新增颜色
  if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault()
    handleCreateColor()
  }

  // Ctrl/Cmd + R: 刷新数据（阻止浏览器刷新）
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault()
    if (canView.value) {
      refresh(() => loadColors(true))
    }
  }

  // Escape: 关闭模态框
  if (event.key === 'Escape' && (showCreateModal.value || showEditModal.value)) {
    attemptCloseModal()
  }

  // Enter: 在模态框中提交表单
  if (event.key === 'Enter' && (showCreateModal.value || showEditModal.value)) {
    // 检查焦点是否在表单控件上
    const activeElement = document.activeElement
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.tagName === 'TEXTAREA'
    )) {
      submitForm()
    }
  }
}

// 生命周期
onMounted(async () => {
  // 检查是否有页面访问权限
  if (!canView.value) {
    return
  }

  // 加载数据
  await initFieldPermissions()
  await loadColors()

  // 添加键盘事件监听器
  document.addEventListener('keydown', handleKeyboardShortcuts)
})

// 组件卸载时清理事件监听器
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyboardShortcuts)
})

</script>

<style scoped>
.colors-view {
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

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

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

.color-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.color-name {
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

.color-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.color-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #e8ecef;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.color-code {
  font-size: 13px;
  color: #6c757d;
  font-family: monospace;
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


/* 表单验证样式 */
.input-with-validation {
  position: relative;
}

.input-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: #6c757d;
}

.character-count {
  font-family: monospace;
  font-weight: 500;
}

.character-count {
  color: #6c757d;
}

.character-count.warning {
  color: #ffc107;
}

.character-count.danger {
  color: #dc3545;
}

.validation-message {
  margin-top: 4px;
  font-size: 12px;
  color: #dc3545;
  font-weight: 500;
}

.color-preview-modal {
  margin-top: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-circle-large {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px #e8ecef;
  transition: transform 0.2s ease;
}

.color-circle-large:hover {
  transform: scale(1.05);
}

.color-code-text {
  font-size: 14px;
  color: #495057;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-weight: 600;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e8ecef;
}

.required {
  color: #dc3545;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .header-content {
    flex-wrap: wrap;
    gap: 16px;
  }

  .stats-cards {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

}

@media (max-width: 992px) {
  .colors-view {
    padding: 20px;
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
    gap: 16px;
  }

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 20px;
  }
}

@media (max-width: 767px) {
  .colors-view {
    padding: 8px;
  }

  .action-buttons {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 8px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .stat-card {
    padding: 14px 12px;
  }

  .form-actions {
    flex-direction: column;
    gap: 12px;
  }

  .table-section {
    padding: 16px;
    margin-bottom: 20px;
  }

  .table-responsive {
    border-radius: 8px;
    overflow-x: auto;
  }

  /* 表格在移动端的优化 */
  .table {
    min-width: 600px;
  }

  .table th,
  .table td {
    padding: 12px 8px;
    font-size: 14px;
  }

  .actions {
    flex-direction: column;
    gap: 6px;
    min-width: 80px;
  }

  .btn-action {
    width: 100%;
    justify-content: center;
    padding: 8px 12px;
    font-size: 12px;
  }

  .color-info {
    max-width: 120px;
  }

  .color-preview {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
    align-items: center;
    text-align: center;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .page-numbers {
    flex-wrap: wrap;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .colors-view {
    padding: 12px;
  }

  .action-buttons {
    flex-direction: column;
    width: 100%;
    gap: 12px;
  }

  .stats-cards {
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    font-size: 24px;
  }

  .stat-value {
    font-size: 20px;
  }

  .table-section {
    padding: 16px;
  }

  .table th,
  .table td {
    padding: 8px 4px;
    font-size: 12px;
  }

  .id-badge,
  .sort-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .status-badge {
    font-size: 10px;
    padding: 4px 8px;
  }

  .color-circle {
    width: 20px;
    height: 20px;
  }

}

</style>
<style>
.colors-dialog-form .el-form-item:last-child {
  margin-bottom: 0;
}

.colors-dialog-form .el-input,
.colors-dialog-form .el-input-number,
.colors-dialog-form .el-select,
.colors-dialog-form .el-radio-group {
  width: 100%;
}

@media (max-width: 767px) {
  .colors-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .colors-view .stat-card {
    padding: 14px 12px;
    border-radius: 16px;
    gap: 12px;
  }

  .colors-view .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .colors-view .stat-value {
    font-size: 20px;
  }

  .colors-view .stat-label {
    font-size: 12px;
  }

  .colors-view .table-section {
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
  }

  .colors-view .table-responsive {
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }

  .colors-view .table {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
  }

  .colors-view .table th,
  .colors-view .table td {
    white-space: normal;
    word-break: break-word;
  }

  .colors-view .color-info {
    width: 100%;
    max-width: none;
  }

  .colors-view .color-name {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    line-height: 1.4;
    text-align: center;
  }

  .colors-view .status-badge {
    width: 100%;
    max-width: 88px;
    justify-content: center;
    white-space: normal;
    line-height: 1.35;
    padding: 6px 8px;
  }

  .colors-dialog-form .el-form-item {
    margin-bottom: 12px;
  }

  .colors-dialog-form .el-form-item__label {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .colors-dialog-form .el-input__wrapper,
  .colors-dialog-form .el-input-number .el-input__wrapper,
  .colors-dialog-form .el-select__wrapper {
    min-height: 42px;
    border-radius: 12px;
  }

  .colors-dialog-form .el-radio-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .colors-dialog-form .el-radio {
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
  .colors-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px 0;
    padding: 0;
  }

  .colors-view .stat-card {
    padding: 12px 10px;
    gap: 10px;
    flex-direction: row;
    text-align: left;
  }

  .colors-view .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .colors-view .stat-value {
    font-size: 18px;
  }

  .colors-view .stat-label {
    font-size: 11px;
  }

  .mobile-action-row td {
    padding: 6px 4px 10px !important;
    background: linear-gradient(180deg, #f8fbff 0%, #f4f7ff 100%);
    border-top: none !important;
  }

  .colors-view .table th,
  .colors-view .table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .colors-view .table th:nth-child(1),
  .colors-view .table td:nth-child(1) {
    width: 56px;
  }

  .colors-view .table th:nth-child(2),
  .colors-view .table td:nth-child(2) {
    width: auto;
  }

  .colors-view .table th:nth-child(3),
  .colors-view .table td:nth-child(3) {
    width: 92px;
  }

  .colors-view .color-name {
    font-size: 14px;
    font-weight: 700;
  }

  .mobile-color-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 11px;
    color: #5f6b7a;
  }

  .mobile-color-preview .color-circle {
    width: 12px;
    height: 12px;
    min-width: 12px;
    border-radius: 999px;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
  }

  .mobile-sub-value {
    min-width: 0;
    font-weight: 600;
    line-height: 1.35;
    text-align: center;
  }

}
</style>
