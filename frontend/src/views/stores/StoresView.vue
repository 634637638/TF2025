<template>
  <div class="stores-view admin-page">
    <!-- 权限加载中 -->
    <div v-if="permissionLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载权限中...</p>
    </div>

    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      v-else
      icon="fas fa-store"
      title="门店管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="openAddModal"
        >
          <i class="fas fa-plus"></i>
          <span>新增</span>
        </el-button>
        <ImportExportActions
          :can-export="canExport"
          :export-loading="exportingStores"
          export-label="导出"
          export-loading-label="导出中..."
          export-icon-class="fas fa-file-excel"
          export-type="success"
          @export="handleExport"
        />
        <el-button type="info" @click="handleRefresh">
          <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 权限不足提示 - 在权限加载完成后显示 -->
    <PermissionAccessNotice
      v-if="!permissionLoading"
      v-permission-not="'stores:view'"
      module-name="门店管理"
      permission-name="门店查看权限"
      permission-code="stores:view"
      :has-menu-permission-only="hasMenuPermissionOnly"
      :related-permissions="storePermissions"
      detail-title="门店管理相关权限"
      suggestion="请联系有权限的角色维护人员为您分配门店查看权限，或使用已有权限访问其他功能模块"
    />

    <!-- 权限验证通过后的内容 -->
    <div class="content admin-page-content" v-permission="'stores:view'">
      <!-- 统计卡片 -->
      <div v-if="showStatsCards" class="stats-cards">
        <div v-if="canViewField('stats_total_stores')" class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-store"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">店铺总数</div>
          </div>
        </div>
        <div v-if="canViewField('stats_active_stores')" class="stat-card">
          <div class="stat-icon active">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.active }}</div>
            <div class="stat-label">正常营业</div>
          </div>
        </div>
        <div v-if="canViewField('stats_inactive_stores')" class="stat-card">
          <div class="stat-icon inactive">
            <i class="fas fa-pause-circle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.inactive }}</div>
            <div class="stat-label">已禁用</div>
          </div>
        </div>
        <div v-if="canViewField('stats_phone_completion')" class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-phone"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.withManager }}</div>
            <div class="stat-label">已留电话</div>
          </div>
        </div>
      </div>

      <UnifiedSearchPanel
        v-model:expanded="searchExpanded"
        :loading="isLoading"
        @search="loadStores"
        @reset="resetSearch"
      >
        <template #primary>
          <el-input
            v-if="canViewField('name')"
            v-model="searchForm.name"
            placeholder="搜索店铺名称"
            clearable
            @input="debounceSearch"
            @keyup.enter="loadStores"
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
            @change="loadStores"
          >
            <el-option label="正常" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
        </div>
      </UnifiedSearchPanel>

      <!-- 数据表格区域 -->
      <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          店铺列表
          <span class="record-count">共 {{ pagination.total }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th v-if="showSortField" width="40"></th>
                <th v-if="showSortOrderField" width="60">排序</th>
                <th v-if="canViewField('id')" width="80">ID</th>
                <th v-if="canViewField('name')" width="160">店铺名称</th>
                <th v-if="showAddressField" width="200">地址</th>
                <th v-if="showManagerField" width="160">联系人</th>
                <th v-if="showPhoneField" width="200">电话</th>
                <th v-if="canViewField('status')" width="180">状态</th>
                <th v-if="showCreatedAtField" width="160">创建时间</th>
                <th v-if="showActionField" width="180">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading" class="loading-row">
                <td :colspan="visibleColumnCount">
                  <div class="loading-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>正在加载数据...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="stores.length === 0" class="empty-row">
                <td :colspan="visibleColumnCount">
                  <div class="empty-content">
                    <i class="fas fa-inbox"></i>
                    <div class="empty-text">
                      <h4>暂无店铺数据</h4>
                      <p v-if="canCreate">点击上方"新增门店"按钮添加第一个店铺</p>
                      <p v-else>暂无数据，请联系有权限的角色维护人员添加门店</p>
                      <el-button size="small" class="mt-2" @click="loadStores()" :disabled="isLoading">
                        <i class="fas fa-sync-alt"></i>
                        {{ isLoading ? '加载中...' : '重新加载' }}
                      </el-button>
                    </div>
                  </div>
                </td>
              </tr>
              <template v-else v-for="(store, index) in stores" :key="store.id">
              <tr
                class="data-row"
                :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
                :draggable="canEdit"
                @click="handleMobileRowTap(store.id)"
                @dblclick="toggleMobileActions(store.id)"
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
                    v-model.number="store.sort_order"
                    type="number"
                    class="sort-order-input"
                    :disabled="!canEdit"
                    min="0"
                    max="9999"
                    @change="canEdit ? handleSortOrderChange(index, store.sort_order) : null"
                  />
                </td>
                <td v-if="canViewField('id')">
                  <span class="id-badge">{{ (pagination.page - 1) * pagination.limit + (stores.length - index) }}</span>
                </td>
                <td v-if="canViewField('name')">
                  <div class="store-info">
                    <div class="store-name">
                      <strong>{{ store.name || '未命名店铺' }}</strong>
                      <span v-if="!store.name" class="warning-badge">未命名</span>
                    </div>
                    <div v-if="isMobile && canViewField('address') && (store.address || store.location)" class="mobile-store-meta">
                      <i class="fas fa-map-marker-alt"></i>
                      <span>{{ store.location || store.address }}</span>
                    </div>
                    <div v-if="isMobile && canViewField('manager') && store.manager" class="mobile-store-meta">
                      <i class="fas fa-user"></i>
                      <span>{{ store.manager }}</span>
                    </div>
                    <div v-if="isMobile && canViewField('phone') && store.phone" class="mobile-store-meta">
                      <i class="fas fa-phone"></i>
                      <span>{{ store.phone }}</span>
                    </div>
                  </div>
                </td>
                <td v-if="showAddressField">
                  <div class="address-info">
                    <span v-if="store.address" class="address-text" :title="store.address">
                      <i class="fas fa-map-marker-alt"></i>
                      {{ store.address.length > 30 ? store.address.substring(0, 30) + '...' : store.address }}
                    </span>
                    <span v-else class="no-data">-</span>
                  </div>
                </td>
                <td v-if="showManagerField">
                  <div class="contact-info">
                    <span v-if="store.manager" class="contact-name">
                      <i class="fas fa-user"></i>
                      {{ store.manager }}
                    </span>
                    <span v-else class="no-data">-</span>
                  </div>
                </td>
                <td v-if="showPhoneField">
                  <div class="phone-info">
                    <span v-if="store.phone" class="phone-number">
                      <i class="fas fa-phone"></i>
                      {{ store.phone }}
                    </span>
                    <span v-else class="no-data">-</span>
                  </div>
                </td>
                <td v-if="canViewField('status')">
                  <span :class="['status-badge', store.status ? 'status-active' : 'status-inactive']">
                    <i :class="store.status ? 'fas fa-check' : 'fas fa-times'"></i>
                    {{ store.status ? '正常' : '禁用' }}
                  </span>
                </td>
                <td v-if="showCreatedAtField">
                  <div class="time-info">
                    <i class="fas fa-clock"></i>
                    {{ formatDate(store.created_at) }}
                  </div>
                </td>
                <td v-if="showActionField" class="actions">
                  <el-button type="success" size="small" @click="viewStore(store)" title="查看详情">
                    <i class="fas fa-eye"></i>
                    <span>查看</span>
                  </el-button>
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    @click="editStore(store)"
                    title="编辑"
                  >
                    <i class="fas fa-edit"></i>
                    <span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click="deleteStore(store)"
                    title="删除"
                  >
                    <i class="fas fa-trash"></i>
                    <span>删除</span>
                  </el-button>
                </td>
              </tr>
              <tr
                v-if="isMobile && mobileActionRowId === store.id"
                class="mobile-action-row"
              >
                <td :colspan="visibleColumnCount">
                  <div class="mobile-row-actions">
                    <el-button
                      type="success"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-view"
                      @click.stop="viewStore(store)"
                    >
                      <i class="fas fa-eye"></i>
                      <span>查看</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-edit"
                      @click.stop="editStore(store)"
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-delete"
                      @click.stop="deleteStore(store)"
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
          :disabled="isLoading"
          @change="handlePaginationChange"
        />
      </div>
    </div>

    <!-- 创建/编辑模态框 -->
    <MobileDialog
      v-model="formDialogVisible"
      :title="isEditMode ? '编辑门店' : '新增门店'"
      width="500px"
      dialog-class="stores-form-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      @close="attemptCloseModal"
      :show-default-footer="false"
    >
      <el-form :model="storeForm" label-width="100px">
        <el-form-item v-if="canViewField('name')" label="门店名称" required>
          <el-input
            v-model="storeForm.name"
            placeholder="请输入门店名称"
            :class="{ 'is-invalid': formErrors.name }"
            :disabled="!canEditField('name')"
          />
          <div v-if="formErrors.name" class="invalid-feedback">{{ formErrors.name }}</div>
        </el-form-item>

        <el-form-item v-if="canViewField('sort_order')" label="排序">
          <el-input-number
            v-model="storeForm.sort_order"
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

        <el-form-item v-if="canViewField('address')" label="地址">
          <el-input
            v-model="storeForm.address"
            type="textarea"
            placeholder="请输入门店地址"
            :rows="3"
            :class="{ 'is-invalid': formErrors.address }"
            :disabled="!canEditField('address')"
          />
          <div v-if="formErrors.address" class="invalid-feedback">{{ formErrors.address }}</div>
        </el-form-item>

        <el-form-item v-if="canViewField('manager')" label="门店负责人">
          <el-select
            v-model="storeForm.manager_id"
            placeholder="请选择门店负责人"
            style="width: 100%"
            :class="{ 'is-invalid': formErrors.manager_id }"
            :disabled="!canEditField('manager')"
          >
            <el-option value="" label="请选择门店负责人" />
            <el-option
              v-for="user in users"
              :key="user.id"
              :value="user.id"
              :label="`${user.name} (${user.username})${formatUserRoleSuffix(user.role)}`"
            />
          </el-select>
          <div v-if="formErrors.manager_id" class="invalid-feedback">{{ formErrors.manager_id }}</div>
        </el-form-item>

        <el-form-item v-if="canViewField('phone')" label="电话">
          <el-input
            v-model="storeForm.phone"
            placeholder="请输入联系电话"
            :class="{ 'is-invalid': formErrors.phone }"
            :disabled="!canEditField('phone')"
          />
          <div v-if="formErrors.phone" class="invalid-feedback">{{ formErrors.phone }}</div>
        </el-form-item>

        <el-form-item v-if="canViewField('status')" label="状态">
          <el-radio-group v-model="storeForm.status" :disabled="!canEditField('status')">
            <el-radio :value="1">正常营业</el-radio>
            <el-radio :value="0">已禁用</el-radio>
          </el-radio-group>
          <div v-if="formErrors.status" class="invalid-feedback">{{ formErrors.status }}</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button type="default" @click="attemptCloseModal">取消</el-button>
        <el-button type="primary" @click="saveStore" :loading="saving">
          {{ isEditMode ? '更新' : '创建' }}
        </el-button>
      </template>
    </MobileDialog>

    <!-- 查看详情模态框 -->
    <MobileDialog
      v-model="showViewModal"
      title="门店详情"
      width="500px"
      dialog-class="stores-detail-dialog crud-dialog-sm"
      :close-on-click-modal="false"
      :show-default-footer="false"
    >
      <div v-if="selectedStore" class="store-detail-view">
        <!-- 基本信息 -->
        <div v-if="hasBasicDetailFields" class="detail-section">
          <h4>基本信息</h4>
          <div v-if="canViewField('name')" class="detail-row">
            <span class="label">门店名称：</span>
            <span class="value">{{ selectedStore.name || '-' }}</span>
          </div>
          <div v-if="canViewField('address')" class="detail-row">
            <span class="label">门店地址：</span>
            <span class="value">{{ selectedStore.location || selectedStore.address || '-' }}</span>
          </div>
          <div v-if="canViewField('phone')" class="detail-row">
            <span class="label">联系电话：</span>
            <span class="value">{{ selectedStore.phone || '-' }}</span>
          </div>
          <div v-if="canViewField('status')" class="detail-row">
            <span class="label">状态：</span>
            <span class="value">
              <span class="status-badge" :class="selectedStore.status === 1 ? 'active' : 'inactive'">
                <i :class="selectedStore.status === 1 ? 'fas fa-check' : 'fas fa-times'"></i>
                {{ selectedStore.status === 1 ? '正常营业' : '已禁用' }}
              </span>
            </span>
          </div>
        </div>

        <!-- 负责人信息 -->
        <div v-if="canViewField('manager')" class="detail-section">
          <h4>负责人信息</h4>
          <div class="detail-row">
            <span class="label">门店负责人：</span>
            <span class="value">{{ getManagerName(selectedStore.manager_id) }}</span>
          </div>
        </div>

        <!-- 时间信息 -->
        <div v-if="canViewField('created_at')" class="detail-section">
          <h4>时间信息</h4>
          <div class="detail-row">
            <span class="label">创建时间：</span>
            <span class="value">{{ formatDate(selectedStore.created_at) }}</span>
          </div>
          <div class="detail-row" v-if="selectedStore.updated_at">
            <span class="label">更新时间：</span>
            <span class="value">{{ formatDate(selectedStore.updated_at) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button type="default" @click="attemptCloseModal">关闭</el-button>
      </template>
    </MobileDialog>

    <!-- Toast 通知组件 -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import Toast from '../../components/Toast.vue'
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { useImportExport } from '@/composables/useImportExport'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { usePageState } from '@/composables/usePageState'
import { usePermissionModuleInfo } from '@/composables/usePermissionModuleInfo'
import PermissionAccessNotice from '@/components/base/PermissionAccessNotice.vue'
import { normalizePermissionList } from '@/utils/permissionList'
import { PageHeader } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import type { Store, StoreFormData } from '@/types/system'
import type { User } from '@/types'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

// 类型别名 - 兼容原有代码

interface SearchForm {
  name: string
  status: string
}

// 使用统一的 composable
const { success: showSuccess, error: showError, warning: showWarning, info: showInfo, confirm, handleApiError } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport, handleNoPermission } = usePagePermissions('stores')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { exportFile, buildDateFilename } = useImportExport()
const authStore = useAuthStore()
const {
  isLoading,
  isSubmitting,
  setDataLoading,
  setSubmitLoading,
  hasError,
  errorMessage,
  setError,
  clearError
} = usePageState(24)
const router = useRouter()
const { init: initFieldPermissions } = fieldPermissions
const { isMobile } = useMobile()
const exportingStores = ref(false)

// 权限加载状态
const permissionLoading = ref(false)
const normalizedStorePermissions = computed(() => normalizePermissionList(authStore.permissions))
const { hasMenuPermissionOnly, modulePermissions: storePermissions } = usePermissionModuleInfo(
  normalizedStorePermissions,
  'stores_storesview'
)

const storeFieldMap: Record<string, string> = {
  stats_total_stores: 'stats.total_stores',
  stats_active_stores: 'stats.active_stores',
  stats_inactive_stores: 'stats.inactive_stores',
  stats_phone_completion: 'stats.phone_completion',
  id: 'store.id',
  name: 'store.name',
  address: 'store.address',
  phone: 'store.phone',
  manager: 'store.manager',
  status: 'store.status',
  sort_order: 'store.sort_order',
  created_at: 'store.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => storeFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('stores_storesview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('stores_storesview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showAddressField = computed(() => canViewField('address') && !isMobile.value)
const showManagerField = computed(() => canViewField('manager') && !isMobile.value)
const showPhoneField = computed(() => canViewField('phone') && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_stores') ||
  canViewField('stats_active_stores') ||
  canViewField('stats_inactive_stores') ||
  canViewField('stats_phone_completion')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('name'),
    showAddressField.value,
    showManagerField.value,
    showPhoneField.value,
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
})

const hasBasicDetailFields = computed(() => {
  return ['name', 'address', 'phone', 'status'].some(fieldName => canViewField(fieldName))
})

// 确保权限数据已加载
const ensurePermissionsLoaded = async (): Promise<void> => {
  // 如果已有权限数据，直接返回
  if (authStore.user && normalizedStorePermissions.value.length > 0) {
    return
  }

  // 确保用户信息已加载
  if (!authStore.user) {
    try {
      await authStore.fetchUserInfo()
    } catch (error) {
      // 静默处理
    }
  }

  // 如果权限数据仍然为空，尝试强制刷新（但不阻塞页面）
  if (normalizedStorePermissions.value.length === 0) {
    try {
      await authStore.forceRefreshPermissions()
    } catch (error) {
      // 静默处理
    }
  }
}

// 响应式数据
const stores = ref<Store[]>([])
const users = ref<User[]>([])
const saving = ref(false)
const savingOrder = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const currentEditingId = ref<number | null>(null)
const selectedStore = ref<Store | null>(null)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

// 拖拽排序状态
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// 表单验证
const formErrors = ref<Record<string, string>>({})
const resetValidationForm = () => {
  formErrors.value = {}
}

const formatRoleLabel = (role: unknown) => {
  if (!role) return ''
  if (typeof role === 'string') return role
  if (typeof role === 'object') {
    const roleRecord = role as Record<string, any>
    return roleRecord.name || roleRecord.code || ''
  }
  return ''
}

const formatUserRoleSuffix = (role: unknown) => {
  const roleLabel = formatRoleLabel(role)
  return roleLabel ? ` - ${roleLabel}` : ''
}

const handlePermissionsUpdated = async () => {
  permissionLoading.value = true
  try {
    await ensurePermissionsLoaded()
  } catch (error) {
    logger.error('门店页面权限刷新失败:', error)
  } finally {
    permissionLoading.value = false
  }

  if (!canView.value) {
    stores.value = []
    pagination.total = 0
    pagination.pages = 1
    return
  }

  await Promise.all([
    loadStores(),
    loadUsers()
  ])
}

// 分页数据
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0,
  pages: 1
})

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  withManager: 0,
  recent: 0
})

// 模态框显示状态
const formDialogVisible = computed({
  get: () => showAddModal.value || showEditModal.value,
  set: (value) => {
    if (!value) {
      attemptCloseModal()
    }
  }
})

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 搜索相关状态
const searchExpanded = ref(false)

// 防抖搜索 - 输入框输入时延迟搜索
let debounceSearchTimeoutId: NodeJS.Timeout | null = null

const debounceSearch = () => {
  // 取消之前的搜索
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
  }
  // 设置延迟搜索
  debounceSearchTimeoutId = setTimeout(() => {
    pagination.page = 1
    loadStores()
  }, 500) // 500ms 防抖
}

const searchForm = reactive<SearchForm>({
  name: '',
  status: ''
})

const storeForm = reactive<StoreFormData>({
  name: '',
  address: '',
  manager_id: '',
  phone: '',
  status: 1,
  sort_order: 0
})

const loadStores = async () => {
  if (!canView.value) {
    stores.value = []
    pagination.total = 0
    pagination.pages = 1
    return
  }

  setDataLoading(true)
  permissionLoading.value = true

  // 确保权限数据已加载
  try {
    await ensurePermissionsLoaded()
  } catch (error) {
    logger.error('权限加载失败:', error)
  }

  try {
    const params: any = {}
    if (searchForm.name) params.name = searchForm.name
    if (searchForm.status !== '') params.status = searchForm.status
    params.page = pagination.page
    params.limit = pagination.limit

    const response = await unifiedApi.get('/stores', { params })

    if (response.success) {
      // unifiedApi 已解包一层，直接使用 extractResponseData
      const responseData = extractResponseData<any>(response)
      const storesData = Array.isArray(responseData) ? responseData : (responseData.data || [])
      stores.value = storesData
      pagination.total = Number(responseData?.pagination?.total) || storesData.length
      pagination.pages = Number(responseData?.pagination?.pages) || 1
      updateStats()
    } else {
      stores.value = []
      pagination.total = 0
      pagination.pages = 1
      showError(response.message || '加载门店数据失败')
    }
  } catch (err: any) {
    logger.error('加载门店数据失败:', err)
    handleApiError(err, '加载门店数据失败')
    stores.value = []
    pagination.total = 0
    pagination.pages = 1
  } finally {
    setDataLoading(false)
    permissionLoading.value = false
  }
}

const loadUsers = async () => {
  // 避免重复加载用户数据
  if (users.value.length > 0) {
    return
  }

  try {
    // 获取当前用户信息作为负责人选项（避免调用需要 users:view 权限的 API）
    const currentUser = authStore.user
    if (currentUser) {
      users.value = [{
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
        role: authStore.userRole,
        status: 'active' as const
      }]
    } else {
      users.value = []
    }
  } catch (err: any) {
    logger.error('创建用户选项失败:', err)
    users.value = []
  }
}

// 静默加载门店数据
const loadStoresSilent = async () => {
  if (!canView.value) {
    stores.value = []
    pagination.total = 0
    pagination.pages = 1
    return
  }

  try {
    const params: any = {}
    if (searchForm.name) params.name = searchForm.name
    if (searchForm.status !== '') params.status = searchForm.status
    params.page = pagination.page
    params.limit = pagination.limit

    const response = await unifiedApi.get('/stores', { params })

    if (response.success) {
      const responseData = extractResponseData<any>(response)
      const storesData = Array.isArray(responseData) ? responseData : (responseData.data || [])
      stores.value = storesData
      pagination.total = Number(responseData?.pagination?.total) || storesData.length
      pagination.pages = Number(responseData?.pagination?.pages) || 1
      updateStats()
    }
  } catch (error) {
    // 静默处理错误，不显示提示
    logger.error('静默加载门店数据失败:', error)
  }
}

// 静默加载用户数据
const loadUsersSilent = async () => {
  try {
    const currentUser = authStore.user
    if (currentUser) {
      users.value = [{
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name || currentUser.username,
        role: authStore.userRole,
        status: 'active' as const
      }]
    } else {
      users.value = []
    }
  } catch (error) {
    // 静默处理错误
    logger.error('静默加载用户数据失败:', error)
  }
}

const openAddModal = () => {
  // 再次检查权限（虽然按钮已有 v-permission 指令，但双保险）
  if (!canCreate.value) {
    showCreateDenied('店铺管理', 'stores:create')
    return
  }

  currentEditingId.value = null
  resetValidationForm()
  Object.assign(storeForm, {
    name: '',
    address: '',
    manager_id: '',
    phone: '',
    status: 1,
    sort_order: 0
  })
  showAddModal.value = true
}

const editStore = (store: Store) => {
  // 双重权限检查 - 使用友好的权限提示
  if (!canEdit.value) {
    showEditDenied('店铺管理', 'stores:edit')
    return
  }

  currentEditingId.value = store.id
  Object.assign(storeForm, {
    name: store.name,
    address: store.location || store.address || '', // 使用 location 字段
    manager_id: store.manager_id || '',
    phone: store.phone || '',
    status: store.status,
    sort_order: store.sort_order || 0
  })

  // 确保先关闭其他模态框
  showAddModal.value = false
  showViewModal.value = false

  // 立即显示模态框
  showEditModal.value = true
}

const deleteStore = async (store: Store) => {
  // 双重权限检查 - 使用友好的权限提示
  if (!canDelete.value) {
    showDeleteDenied('店铺管理', 'stores:delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除门店"${store.name}"吗？删除后不可恢复！`,
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
    const result = await unifiedApi.delete(`/stores/${store.id}`, { showError: false })

    if (result.success) {
      await loadStores()
      showSuccess(result.message || '门店删除成功')
    } else {
      showError(result.message || '门店删除失败')
    }
  } catch (err: any) {
    logger.error('删除门店失败:', err)
    // 使用统一的权限错误处理
    handleApiErrorWithPermission(err, '删除门店失败', '店铺管理', 'delete')
  }
}

const saveStore = async () => {
  // 表单验证
  if (!storeForm.name || storeForm.name.trim() === '') {
    showError('门店名称不能为空')
    return
  }

  if (storeForm.name.length > 100) {
    showError('门店名称不能超过100个字符')
    return
  }

  if (storeForm.address && storeForm.address.trim() === '') {
    showError('门店地址不能为空格')
    return
  }

  // 手机号码可以为空，如果填写了应该是有效的格式
  if (storeForm.phone && !/^1[3-9]\d{9}$/.test(storeForm.phone)) {
    // 如果不是手机号格式，检查是否是其他有效的电话格式
    if (!/^\d{7,15}$/.test(storeForm.phone)) {
      showError('请输入有效的电话号码（7-15位数字）')
      return
    }
  }

  // 双重权限验证
  if (showEditModal.value && !canEdit.value) {
    showEditDenied('店铺管理', 'stores:edit')
    return
  }

  if (showAddModal.value && !canCreate.value) {
    showCreateDenied('店铺管理', 'stores:create')
    return
  }

  setSubmitLoading(true)
  try {
    let result
    if (showEditModal.value) {
      if (!currentEditingId.value) {
        showError('无法获取门店ID')
        setSubmitLoading(false)
        return
      }

      // 转换数据格式以匹配后端期望的字段名
      const updateData = {
        name: storeForm.name,
        address: storeForm.address,
        phone: storeForm.phone,
        manager: storeForm.manager_id || null,  // 后端期望 manager 字段，前端是 manager_id
        status: storeForm.status,
        sort_order: storeForm.sort_order
      }

      result = await unifiedApi.put(`/stores/${currentEditingId.value}`, updateData, { showError: false })

      if (result.success) {
        showSuccess(result.message || '门店修改成功')
        closeModal()
        await loadStores()
      } else {
        showError(result.message || '门店更新失败')
      }
    } else {
      // 转换数据格式以匹配后端期望的字段名
      const createData = {
        name: storeForm.name,
        address: storeForm.address,
        phone: storeForm.phone,
        manager: storeForm.manager_id || null,  // 后端期望 manager 字段，前端是 manager_id
        status: storeForm.status,
        sort_order: storeForm.sort_order
      }

      result = await unifiedApi.post('/stores', createData, { showError: false })
      if (result.success) {
        showSuccess(result.message || '门店创建成功')
        closeModal()
        await loadStores()
      } else {
        showError(result.message || '门店创建失败')
      }
    }
  } catch (err: any) {
    // 使用统一的权限错误处理
    const operation = (showEditModal.value && currentEditingId.value) ? 'edit' : 'create'
    handleApiErrorWithPermission(err, '保存门店失败', '店铺管理', operation)
  } finally {
    setSubmitLoading(false)
  }
}

const hasUnsavedChanges = (): boolean => {
  if (!showAddModal.value && !showEditModal.value && !showViewModal.value) return false

  // View modal doesn't have editable fields, so no unsaved changes
  if (showViewModal.value) return false

  const currentForm = storeForm

  if (showEditModal.value && currentEditingId.value) {
    const originalStore = stores.value.find(s => s.id === currentEditingId.value)
    if (originalStore) {
      return (
        currentForm.name !== (originalStore.name || '') ||
        currentForm.address !== (originalStore.address || '') ||
        currentForm.manager_id !== originalStore.manager_id ||
        currentForm.phone !== (originalStore.phone || '') ||
        currentForm.status !== originalStore.status ||
        currentForm.sort_order !== (originalStore.sort_order || 0)
      )
    }
  }

  // For add modal, check if any field has been filled
  return (
    currentForm.name !== '' ||
    currentForm.address !== '' ||
    currentForm.manager_id !== '' ||
    currentForm.phone !== '' ||
    currentForm.status !== 1 ||
    currentForm.sort_order !== 0
  )
}

const attemptCloseModal = () => {
  if (hasUnsavedChanges()) {
    if (confirm('您有未保存的更改，确定要关闭吗？')) {
      closeModal()
    }
  } else {
    closeModal()
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  showViewModal.value = false
  currentEditingId.value = null
  selectedStore.value = null
  resetValidationForm()
  Object.assign(storeForm, {
    name: '',
    address: '',
    manager_id: '',
    phone: '',
    status: 1,
    sort_order: 0
  })
}

const resetSearch = () => {
  Object.assign(searchForm, {
    name: '',
    status: ''
  })
  pagination.page = 1
  loadStores()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  if (!canView.value) {
    return
  }

  if (refreshing.value || isLoading.value) return
  await refresh(async () => {
    await Promise.all([
      loadStoresSilent(),
      loadUsersSilent()
    ])
  })
  showSuccess('数据已刷新')
}

const updateStats = () => {
  // 确保 stores.value 是数组
  const storesArray = Array.isArray(stores.value) ? stores.value : []

  stats.total = storesArray.length
  stats.active = storesArray.filter(store => store.status === 1).length
  stats.inactive = storesArray.filter(store => store.status === 0).length
  stats.withManager = storesArray.filter(store => store.manager_id !== null).length

  // 最近创建的门店（7天内）
  const sevenDaysAgo = TimeUtil.subtract(TimeUtil.now(), 7, 'day')
  stats.recent = storesArray.filter(store =>
    store.created_at && TimeUtil.parse(store.created_at).isAfter(sevenDaysAgo)
  ).length
}

const getManagerName = (managerId: string | number | null) => {
  if (!managerId) return '-'
  // 确保 users.value 是数组
  if (!Array.isArray(users.value)) {
    return '-'
  }
  // 转换为数字类型进行比较
  const id = typeof managerId === 'string' ? parseInt(managerId) : managerId
  const user = users.value.find(u => u.id === id)
  return user ? user.name : '-'
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.pages) return
  pagination.page = page
  loadStores()
}

// 新的分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.limit = pageSize
  // 重置到第一页（当页面大小改变时）
  if (pageSize !== pagination.limit) {
    pagination.page = 1
  }
  loadStores()
}

const viewStore = (store: Store) => {
  selectedStore.value = store
  showViewModal.value = true
}

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

const handleExport = async () => {
  await exportFile({
    url: '/stores/export',
    filename: buildDateFilename('门店管理', 'xlsx'),
    params: {
      name: searchForm.name,
      status: searchForm.status
    },
    allowed: canExport,
    loading: exportingStores,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '门店列表导出成功',
    errorMessage: '门店列表导出失败'
  })
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
  const newStores = [...stores.value]
  const [movedItem] = newStores.splice(dragIndex, 1)
  newStores.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newStores.forEach((item, index) => {
    item.sort_order = index
  })

  stores.value = newStores

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadStoresSilent()

  handleDragEnd()
}

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return
  if (!canEdit.value) {
    showEditDenied('店铺管理', 'stores:edit')
    return
  }

  savingOrder.value = true
  try {
    const items = stores.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/stores/batch/reorder', { items }, { showError: false })
    if (response.success) {
      showSuccess('排序已保存')
    }
  } catch (err: any) {
    // 使用统一的权限错误处理
    handleApiErrorWithPermission(err, '保存排序失败', '店铺管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  stores.value[index].sort_order = value
  // 按新的 sort_order 重新排序
  stores.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  await saveSortOrder()
}

// 生命周期
onMounted(async () => {
  window.addEventListener('tf2025:permissions:updated', handlePermissionsUpdated)

  // 首先确保权限数据已加载
  permissionLoading.value = true
  try {
    await ensurePermissionsLoaded()
  } catch (error) {
    logger.error('初始化权限加载失败:', error)
  } finally {
    permissionLoading.value = false
  }

  // 检查是否有页面访问权限
  if (!canView.value) {
    return
  }

  // 然后并行加载数据
  await Promise.all([
    initFieldPermissions(),
    loadStores(),
    loadUsers()
  ])
})

onUnmounted(() => {
  window.removeEventListener('tf2025:permissions:updated', handlePermissionsUpdated)
})
</script>

<style scoped>
.stores-view {
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
}

/* 权限加载样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  gap: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 权限拒绝页面样式 - 统一背景可见样式 */
.permission-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: #f8f9fa;
  border-radius: 12px;
  margin: 20px 0;
}

.permission-denied-wrapper {
  width: 100%;
  max-width: 600px;
}

.permission-denied-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
  max-height: 90vh;
  overflow-y: auto;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.permission-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px;
  text-align: center;
  color: white;
}

.permission-icon i {
  font-size: 48px;
  opacity: 0.9;
}

.permission-content {
  padding: 40px;
  text-align: center;
}

.permission-content h2 {
  font-size: 28px;
  color: #1f2937;
  margin-bottom: 16px;
  font-weight: 700;
}

.permission-message {
  font-size: 16px;
  color: #6b7280;
  margin-bottom: 30px;
  line-height: 1.6;
}

.permission-status {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 500;
}

.status-item.has-menu {
  background: #dcfce7;
  color: #166534;
}

.status-item.has-menu i {
  color: #22c55e;
}

.status-item.missing-view {
  background: #fee2e2;
  color: #991b1b;
}

.status-item.missing-view i {
  color: #ef4444;
}

.permission-info {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.permission-name {
  color: #059669;
  font-weight: 500;
}

.permission-code {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.permission-suggestion {
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.permission-suggestion i {
  color: #3b82f6;
  margin-top: 2px;
}

.permission-suggestion p {
  margin: 0;
  color: #1e40af;
  font-size: 14px;
  line-height: 1.5;
}

.permission-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.permission-details {
  text-align: left;
  border-top: 1px solid #e5e7eb;
  padding-top: 24px;
}

.permission-details h4 {
  font-size: 16px;
  color: #374151;
  margin-bottom: 16px;
  font-weight: 600;
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.permission-tag {
  display: inline-block;
  padding: 6px 12px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 16px;
  font-size: 12px;
  font-family: 'Monaco', 'Consolas', monospace;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.permission-tag.current-module {
  background: #ede9fe;
  color: #7c3aed;
  border-color: #c4b5fd;
  font-weight: 500;
}

.permission-info strong {
  color: #111827;
}

.permission-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
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

/* 表格区域样式 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid #e8ecef;
  overflow: hidden; /* 防止内容溢出 */

  /* 移动端去除左右内边距，让内容占据全屏宽度 */
  @media (max-width: 768px) {
    padding: 16px 0;
    margin: 0 0 0 0; /* 移除所有间距 */
  }

  @media (max-width: 375px) {
    padding: 12px 0;
    margin: 0 0 0 0; /* 移除所有间距 */
  }
}

/* ===== 其他通用样式 ===== */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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

.form-actions {
  display: flex;
  gap: 12px;
}

/* 表格样式 */
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

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

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

.btn-view {
  background: #28a745;
  color: white;
}

.btn-view:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.btn-view span {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
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

.btn-edit span {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
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

.btn-delete span {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
}

/* 新增的样式类 */
.id-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  min-width: 80px;
  height: 32px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.store-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  align-items: center;
  margin: 0 auto;
}

.store-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.store-address {
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 14px;
}

.contact-item i {
  color: #667eea;
  width: 16px;
  text-align: center;
}

.text-center {
  text-align: center;
}


/* ===== 详情视图样式 ===== */
.store-detail-view {
  padding: 0;
}

/* Element Plus 表单错误提示样式 */
.invalid-feedback {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
  line-height: 1;
}

.is-invalid {
  border-color: #f56c6c !important;
}

.input-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: #6c757d;
}

/* Element Plus 按钮图标样式 */
.el-button i {
  margin-right: 4px;
}

.el-button span {
  display: inline-flex;
  align-items: center;
}

/* 辅助样式类 */
.mt-2 {
  margin-top: 8px;
}

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 16px 0;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
  }
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 500;
    color: #6b7280;
    min-width: 100px;
    margin-right: 16px;
    font-size: 14px;
  }

  .value {
    flex: 1;
    color: #1f2937;
    font-weight: 500;
    font-size: 14px;
    word-break: break-word;
  }
}

/* 地址信息样式优化 */
.address-info {
  max-width: 200px;
}

.address-text {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #374151;
}

.contact-name,
.phone-number {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.no-data {
  color: #9ca3af;
  font-style: italic;
  font-size: 13px;
}

/* 查看详情模态框样式 */
.store-details {
  padding: 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  margin: 0 0 16px 0;
  padding: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.detail-item span {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  word-break: break-word;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-badge.active {
  background-color: #10b981;
  color: white;
}

.status-badge.inactive {
  background-color: #ef4444;
  color: white;
}

.status-badge.status-active {
  background: #d4edda;
  color: #155724;
}

.status-badge.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

/* ===== 移动端响应式适配 ===== */
@media (max-width: 768px) {
  .stores-view {
    padding: 16px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .stat-card {
    padding: 14px 12px;
    border-radius: 16px;
    gap: 12px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-label {
    font-size: 12px;
  }

  .form-actions {
    flex-direction: column;
  }

  .form-actions .btn {
    width: 100%;
  }

  .table-section {
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
    overflow: hidden;
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
  }

  .table th,
  .table td {
    white-space: normal;
    word-break: break-word;
    box-sizing: border-box;
  }

  .store-info {
    width: 100%;
    max-width: none;
  }

  .store-name {
    font-size: 14px;
    line-height: 1.4;
    font-weight: 700;
    text-align: center;
  }

  .mobile-store-meta {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: #5f6b7a;
    text-align: center;
  }

  .mobile-store-meta i {
    margin-top: 2px;
    color: #64748b;
  }

  .status-badge.status-active,
  .status-badge.status-inactive {
    width: 100%;
    max-width: 76px;
    margin: 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: normal;
    line-height: 1.35;
  }

  .permission-actions {
    flex-direction: column;
    align-items: stretch;
  }

  /* 详情视图移动端适配 */
  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    .label {
      min-width: auto;
      margin-right: 0;
      margin-bottom: 8px;
    }

    .value {
      width: 100%;
    }
  }
}

@media (max-width: 480px) {
  .stores-view {
    padding: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .table-section {
    margin: 0;
    padding: 12px 8px;
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
    width: 50%;
  }

  .table th:nth-child(3),
  .table td:nth-child(3) {
    width: 32%;
  }

  .stat-card {
    padding: 12px 10px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .stat-value {
    font-size: 18px;
  }

  .store-name {
    font-size: 13px;
  }

  .mobile-store-meta {
    font-size: 10px;
  }

  .id-badge {
    min-width: 44px;
    height: 28px;
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 14px;
  }

  .actions .el-button span {
    display: none;
  }
}
</style>
