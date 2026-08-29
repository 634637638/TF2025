<template>
  <div class="stores-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="stores"
      module-name="门店管理"
      permission-code="stores:view"
    >
      <div class="content admin-page-content">
        <!-- 页面头部 - 使用公共组件 -->
        <PageHeader
          icon="fas fa-store"
          title="门店管理"
        >
          <template #actions>
            <el-button
              v-if="canCreate"
              type="primary"
              @click="openAddModal"
            >
              <i class="fas fa-plus" />
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

        <!-- 权限验证通过后的内容 -->
        <!-- 统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewField('stats_total_stores')"
            class="stat-card"
          >
            <div class="stat-icon">
              <i class="fas fa-store" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total }}
              </div>
              <div class="stat-label">
                店铺总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_active_stores')"
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
                正常营业
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_inactive_stores')"
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
                已禁用
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_phone_completion')"
            class="stat-card"
          >
            <div class="stat-icon">
              <i class="fas fa-phone" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.withPhone }}
              </div>
              <div class="stat-label">
                已留电话
              </div>
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
              @change="loadStores"
            >
              <el-option
                label="正常"
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
            店铺列表
            <span class="record-count">共 {{ pagination.total }} 条记录</span>
          </div>

          <div class="table-responsive">
            <el-table
              ref="storesTableRef"
              :data="isLoading ? [] : stores"
              border
              stripe
              class="data-table devices-table base-data-table compact-fit-table stores-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getStoreRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="(row) => handleMobileRowTap(row.id)"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="isLoading"
                  mode="block"
                  text="加载店铺列表..."
                />
                <DataEmptyState
                  v-else
                  description="暂无店铺数据"
                >
                  <el-button
                    size="small"
                    type="info"
                    @click="loadStores()"
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
                    @change="handleSortOrderChange($index, row.sort_order || 0)"
                  >
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('id')"
                label="ID"
                :width="isMobile ? 54 : 70"
                align="center"
              >
                <template #default="{ $index }">
                  <span class="id-badge">{{ (pagination.page - 1) * pagination.page_size + (stores.length - $index) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('name')"
                prop="name"
                label="店铺名称"
                :min-width="isMobile ? 126 : 160"
                align="center"
              >
                <template #default="{ row }">
                  <strong>{{ row.name || '未命名店铺' }}</strong>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showAddressField"
                label="地址"
                min-width="220"
                align="center"
                class-name="complete-text-column wrapped-text-column"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.address || row.location"
                    class="address-text"
                  ><i class="fas fa-map-marker-alt" />{{ row.address || row.location }}</span><span
                    v-else
                    class="no-data"
                  >-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showManagerField"
                label="联系人"
                :min-width="isMobile ? 92 : 120"
                align="center"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.manager"
                    class="contact-name"
                  ><i class="fas fa-user" />{{ row.manager }}</span><span
                    v-else
                    class="no-data"
                  >-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showPhoneField"
                label="电话"
                min-width="132"
                align="center"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.phone"
                    class="phone-number"
                  ><i class="fas fa-phone" />{{ row.phone }}</span><span
                    v-else
                    class="no-data"
                  >-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('status')"
                label="状态"
                :min-width="isMobile ? 72 : 84"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', isStoreActive(row.status) ? 'status-active' : 'status-inactive']"><i :class="isStoreActive(row.status) ? 'fas fa-check' : 'fas fa-times'" />{{ isStoreActive(row.status) ? '正常' : '禁用' }}</span>
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
                :width="$getActionColumnWidth(1 + Number(canEdit) + Number(canDelete))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      type="success"
                      size="small"
                      @click.stop="viewStore(row)"
                    >
                      <i class="fas fa-eye" /><span>查看</span>
                    </el-button><el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click.stop="editStore(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click.stop="deleteStore(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button
                      type="success"
                      size="small"
                      @click.stop="viewStore(row)"
                    >
                      <i class="fas fa-eye" /><span>查看</span>
                    </el-button><el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click.stop="editStore(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click.stop="deleteStore(row)"
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
        :show-default-footer="false"
        @close="attemptCloseModal"
      >
        <el-form
          :model="storeForm"
          label-width="100px"
        >
          <el-form-item
            v-if="canViewField('name')"
            label="门店名称"
            required
          >
            <el-input
              v-model="storeForm.name"
              placeholder="请输入门店名称"
              :class="{ 'is-invalid': formErrors.name }"
              :disabled="!canEditField('name')"
            />
            <div
              v-if="formErrors.name"
              class="invalid-feedback"
            >
              {{ formErrors.name }}
            </div>
          </el-form-item>

          <el-form-item
            v-if="canViewField('sort_order')"
            label="排序"
          >
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

          <el-form-item
            v-if="canViewField('address')"
            label="地址"
          >
            <el-input
              v-model="storeForm.address"
              type="textarea"
              placeholder="请输入门店地址"
              :rows="3"
              :class="{ 'is-invalid': formErrors.address }"
              :disabled="!canEditField('address')"
            />
            <div
              v-if="formErrors.address"
              class="invalid-feedback"
            >
              {{ formErrors.address }}
            </div>
          </el-form-item>

          <el-form-item
            v-if="canViewField('manager')"
            label="门店负责人"
          >
            <el-select
              v-model="storeForm.manager_id"
              placeholder="请选择门店负责人"
              style="width: 100%"
              :class="{ 'is-invalid': formErrors.manager_id }"
              :disabled="!canEditField('manager')"
              :loading="managerOptionsLoading"
              filterable
              clearable
              @change="handleManagerChange"
            >
              <el-option
                v-for="user in users"
                :key="user.id"
                :value="user.id"
                :label="formatManagerOptionLabel(user)"
              />
            </el-select>
            <div
              v-if="formErrors.manager_id"
              class="invalid-feedback"
            >
              {{ formErrors.manager_id }}
            </div>
          </el-form-item>

          <el-form-item
            v-if="canViewField('phone')"
            label="电话"
          >
            <el-input
              v-model="storeForm.phone"
              :placeholder="storeForm.manager_id ? '取自负责人联系方式' : '请输入联系电话'"
              :class="{ 'is-invalid': formErrors.phone }"
              :disabled="!canEditField('phone') || Boolean(storeForm.manager_id)"
            />
            <div
              v-if="formErrors.phone"
              class="invalid-feedback"
            >
              {{ formErrors.phone }}
            </div>
          </el-form-item>

          <el-form-item
            v-if="canViewField('status')"
            label="状态"
          >
            <el-radio-group
              v-model="storeForm.status"
              :disabled="!canEditField('status')"
            >
              <el-radio :value="1">
                正常营业
              </el-radio>
              <el-radio :value="0">
                已禁用
              </el-radio>
            </el-radio-group>
            <div
              v-if="formErrors.status"
              class="invalid-feedback"
            >
              {{ formErrors.status }}
            </div>
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
            :loading="saving"
            @click="saveStore"
          >
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
        <div
          v-if="selectedStore"
          class="store-detail-view"
        >
          <!-- 基本信息 -->
          <div
            v-if="hasBasicDetailFields"
            class="detail-section"
          >
            <h4>基本信息</h4>
            <div
              v-if="canViewField('name')"
              class="detail-row"
            >
              <span class="label">门店名称：</span>
              <span class="value">{{ selectedStore.name || '-' }}</span>
            </div>
            <div
              v-if="canViewField('address')"
              class="detail-row"
            >
              <span class="label">门店地址：</span>
              <span class="value">{{ selectedStore.location || selectedStore.address || '-' }}</span>
            </div>
            <div
              v-if="canViewField('phone')"
              class="detail-row"
            >
              <span class="label">联系电话：</span>
              <span class="value">{{ selectedStore.phone || '-' }}</span>
            </div>
            <div
              v-if="canViewField('status')"
              class="detail-row"
            >
              <span class="label">状态：</span>
              <span class="value">
                <span
                  class="status-badge"
                  :class="isStoreActive(selectedStore.status) ? 'active' : 'inactive'"
                >
                  <i :class="isStoreActive(selectedStore.status) ? 'fas fa-check' : 'fas fa-times'" />
                  {{ isStoreActive(selectedStore.status) ? '正常营业' : '已禁用' }}
                </span>
              </span>
            </div>
          </div>

          <!-- 负责人信息 -->
          <div
            v-if="canViewField('manager')"
            class="detail-section"
          >
            <h4>负责人信息</h4>
            <div class="detail-row">
              <span class="label">门店负责人：</span>
              <span class="value">{{ selectedStore.manager || getManagerName(selectedStore.manager_id) }}</span>
            </div>
          </div>

          <!-- 时间信息 -->
          <div
            v-if="canViewField('created_at')"
            class="detail-section"
          >
            <h4>时间信息</h4>
            <div class="detail-row">
              <span class="label">创建时间：</span>
              <span class="value">{{ formatDate(selectedStore.created_at) }}</span>
            </div>
            <div
              v-if="selectedStore.updated_at"
              class="detail-row"
            >
              <span class="label">更新时间：</span>
              <span class="value">{{ formatDate(selectedStore.updated_at) }}</span>
            </div>
          </div>
        </div>

        <template #footer>
          <el-button
            type="default"
            @click="attemptCloseModal"
          >
            关闭
          </el-button>
        </template>
      </MobileDialog>

      <!-- Toast 通知组件 -->
      <Toast />
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import Toast from '../../components/Toast.vue'
import Pagination from '../../components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { useImportExport } from '@/composables/useImportExport'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { usePageState } from '@/composables/usePageState'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { useMobile } from '@/composables/mobile'
import { useLatestRequest } from '@/composables/useLatestRequest'
import type { Store, StoreFormData } from '@/types/system'
import type { User } from '@/types'
import { TimeUtil } from '@/utils/time'
import { logger } from '@/utils/logger'
import { useElementTableSortable } from '@/composables/useElementTableSortable'

// 类型别名 - 兼容原有代码

interface SearchForm {
  name: string
  status: string
}

// 使用统一的 composable
const { success: showSuccess, error: showError, warning: _showWarning, info: _showInfo, handleApiError } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport, handleNoPermission } = usePagePermissions('stores')
const { showViewDenied: _showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { exportFile, buildDateFilename } = useImportExport()
const authStore = useAuthStore()
const {
  isLoading,
  isSubmitting,
  setDataLoading,
  setSubmitLoading,
  hasError: _hasError,
  errorMessage: _errorMessage,
  setError: _setError,
  clearError: _clearError
} = usePageState({ initialPageSize: 24 })
setDataLoading(true)
const { init: initFieldPermissions } = fieldPermissions
const { isMobile } = useMobile()
const exportingStores = ref(false)
const storeListRequest = useLatestRequest()

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
const showManagerField = computed(() => canViewField('manager'))
const showPhoneField = computed(() => canViewField('phone') && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showActionField = computed(() => (
  shouldShowActionColumn(canViewField('actions'), [canEdit.value, canDelete.value]) && !isMobile.value
))
const showStatsCards = computed(() => (
  canViewField('stats_total_stores') ||
  canViewField('stats_active_stores') ||
  canViewField('stats_inactive_stores') ||
  canViewField('stats_phone_completion')
))
const hasBasicDetailFields = computed(() => {
  return ['name', 'address', 'phone', 'status'].some(fieldName => canViewField(fieldName))
})

// 响应式数据
const stores = ref<Store[]>([])
const users = ref<User[]>([])
const managerOptionsLoading = ref(false)
const saving = ref(false)
const savingOrder = ref(false)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showViewModal = ref(false)
const currentEditingId = ref<number | null>(null)
const selectedStore = ref<Store | null>(null)
const storesTableRef = ref<any>(null)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)
const getStoreRowKey = (store: Store) => String(store.id)

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

const formatManagerOptionLabel = (user: User) => {
  const account = user.username ? ` (${user.username})` : ''
  const role = formatUserRoleSuffix(user.role)
  const phone = user.phone ? ` - ${user.phone}` : ''
  return `${user.name}${account}${role}${phone}`
}

const handlePermissionsUpdated = async () => {
  try {
    if (!authStore.user) {
      await authStore.fetchUserInfo()
    }
    await authStore.forceRefreshPermissions()
  } catch (error) {
    logger.error('门店页面权限刷新失败:', error)
  }

  if (canView.value) {
    await Promise.all([
      loadStores(),
      loadUsers()
    ])
  } else {
    stores.value = []
    pagination.total = 0
    pagination.total_pages = 1
  }
}

// 分页数据
const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 1
})

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  inactive: 0,
  withPhone: 0,
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
    pagination.total_pages = 1
    setDataLoading(false)
    return
  }

  setDataLoading(true)
  const request = storeListRequest.nextRequest()

  try {
    const params: any = {}
    if (searchForm.name) params.name = searchForm.name
    if (searchForm.status !== '') params.status = searchForm.status
    params.page = pagination.page
    params.page_size = pagination.page_size

    const response = await unifiedApi.get('/stores', {
      params,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      // unifiedApi 已解包一层，直接使用 extractResponseData
      const responseData = extractResponseData<any>(response)
      const storesData = Array.isArray(responseData) ? responseData : (responseData.data || [])
      stores.value = storesData
      pagination.total = Number(responseData?.pagination?.total) || storesData.length
      pagination.total_pages = Number(responseData?.pagination?.total_pages) || 1
      updateStats()
    } else {
      stores.value = []
      pagination.total = 0
      pagination.total_pages = 1
      showError(response.message || '加载门店数据失败')
    }
  } catch (err: any) {
    if (storeListRequest.isCanceledError(err)) {
      return
    }

    logger.error('加载门店数据失败:', err)
    handleApiError(err, '加载门店数据失败')
    stores.value = []
    pagination.total = 0
    pagination.total_pages = 1
  } finally {
    if (request.isLatest()) {
      setDataLoading(false)
    }
  }
}

const fetchManagerOptions = async (notifyOnError: boolean) => {
  managerOptionsLoading.value = true
  try {
    const response = await unifiedApi.get('/stores/managers', { showError: false })
    if (!response.success) {
      throw new Error(response.message || '获取员工列表失败')
    }

    const employees = extractResponseData<any[]>(response)
    users.value = (Array.isArray(employees) ? employees : []).map(employee => ({
      id: Number(employee.id),
      username: String(employee.username || ''),
      name: String(employee.name || employee.username || ''),
      phone: String(employee.phone || ''),
      role: String(employee.role || employee.roles || ''),
      status: 'active' as const
    }))
  } catch (error) {
    logger.error('获取门店负责人选项失败:', error)
    users.value = []
    if (notifyOnError) {
      showError('获取员工列表失败，请稍后重试')
    }
  } finally {
    managerOptionsLoading.value = false
  }
}

const loadUsers = () => fetchManagerOptions(true)

// 静默加载门店数据
const loadStoresSilent = async () => {
  if (!canView.value) {
    stores.value = []
    pagination.total = 0
    pagination.total_pages = 1
    return
  }

  const request = storeListRequest.nextRequest()

  try {
    const params: any = {}
    if (searchForm.name) params.name = searchForm.name
    if (searchForm.status !== '') params.status = searchForm.status
    params.page = pagination.page
    params.page_size = pagination.page_size

    const response = await unifiedApi.get('/stores', {
      params,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    if (response.success) {
      const responseData = extractResponseData<any>(response)
      const storesData = Array.isArray(responseData) ? responseData : (responseData.data || [])
      stores.value = storesData
      pagination.total = Number(responseData?.pagination?.total) || storesData.length
      pagination.total_pages = Number(responseData?.pagination?.total_pages) || 1
      updateStats()
    }
  } catch (error) {
    if (storeListRequest.isCanceledError(error)) {
      return
    }

    // 静默处理错误，不显示提示
    logger.error('静默加载门店数据失败:', error)
  } finally {
    if (request.isLatest()) {
      setDataLoading(false)
    }
  }
}

// 静默加载用户数据
const loadUsersSilent = () => fetchManagerOptions(false)

const handleManagerChange = (managerId: string | number | null | undefined) => {
  if (!managerId) {
    storeForm.phone = ''
    return
  }

  const manager = users.value.find(user => user.id === Number(managerId))
  if (manager) {
    storeForm.phone = manager.phone || ''
    delete formErrors.value.manager_id
    delete formErrors.value.phone
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
  handleManagerChange(store.manager_id)

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
        customClass: 'message-box-unified'
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
  if (isSubmitting.value) return

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
  if (!storeForm.manager_id && storeForm.phone && !/^1[3-9]\d{9}$/.test(storeForm.phone)) {
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
        manager_id: storeForm.manager_id || null,
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
        manager_id: storeForm.manager_id || null,
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

const attemptCloseModal = () => {
  closeModal()
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
    setDataLoading(false)
    return
  }

  if (refreshing.value || isLoading.value) return
  await refresh(async () => {
    await Promise.all([
      loadStoresSilent(),
      loadUsersSilent()
    ])
  })
  showSuccess('数据刷新成功')
}

const updateStats = () => {
  // 确保 stores.value 是数组
  const storesArray = Array.isArray(stores.value) ? stores.value : []

  stats.total = storesArray.length
  stats.active = storesArray.filter(store => isStoreActive(store.status)).length
  stats.inactive = storesArray.filter(store => !isStoreActive(store.status)).length
  stats.withPhone = storesArray.filter(store => Boolean(store.phone?.trim())).length

  // 最近创建的门店（7天内）
  const sevenDaysAgo = TimeUtil.subtract(TimeUtil.now(), 7, 'day')
  stats.recent = storesArray.filter(store =>
    store.created_at && TimeUtil.parse(store.created_at).isAfter(sevenDaysAgo)
  ).length
}

const isStoreActive = (status: Store['status']) => status === 1 || status === 'active'

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

const _changePage = (page: number) => {
  if (page < 1 || page > pagination.total_pages) return
  pagination.page = page
  loadStores()
}

// 新的分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  const oldPageSize = pagination.page_size
  pagination.page_size = pageSize
  pagination.page = pageSize !== oldPageSize ? 1 : page
  loadStores()
}

const viewStore = (store: Store) => {
  selectedStore.value = store
  showViewModal.value = true
}

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

const handleStoreRowMove = async (oldIndex: number, newIndex: number) => {
  if (!canEdit.value || oldIndex === newIndex) return false
  const reordered = [...stores.value]
  const [movedItem] = reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, movedItem)
  reordered.forEach((item, index) => { item.sort_order = index })
  stores.value = reordered
  await saveSortOrder()
  await loadStoresSilent()
  return true
}

useElementTableSortable({
  tableRef: storesTableRef,
  enabled: computed(() => canEdit.value && !isMobile.value && showSortField.value),
  orderKey: () => stores.value.map(store => store.id).join('|'),
  onMove: handleStoreRowMove
})

// 生命周期
onMounted(async () => {
  window.addEventListener('tf2025:permissions:updated', handlePermissionsUpdated)

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
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
    debounceSearchTimeoutId = null
  }
})
</script>

<style scoped>
.stores-view {
  padding: 24px;
  background: var(--tf-color-slate-50);
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

/* 表格区域样式 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid var(--tf-color-border-cool);
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

.form-actions {
  display: flex;
  gap: 12px;
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
  color: var(--tf-color-slate-800);
  font-size: 14px;
}

.store-address {
  color: var(--tf-color-slate-500);
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
  color: var(--tf-color-neutral-700);
  font-size: 14px;
}

.contact-item i {
  color: var(--tf-color-indigo-brand);
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
  color: var(--color-danger);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1;
}

.is-invalid {
  border-color: var(--color-danger) !important;
}

.input-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
  color: var(--tf-color-muted);
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
    color: var(--tf-color-neutral-700);
    border-bottom: 1px solid var(--tf-color-neutral-200);
    padding-bottom: 8px;
  }
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--tf-color-neutral-100);

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 500;
    color: var(--tf-color-neutral-500);
    min-width: 100px;
    margin-right: 16px;
    font-size: 14px;
  }

  .value {
    flex: 1;
    color: var(--tf-color-neutral-800);
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
  color: var(--tf-color-neutral-700);
}

.contact-name,
.phone-number {
  font-size: 13px;
  color: var(--tf-color-neutral-700);
  font-weight: 500;
}

.no-data {
  color: var(--tf-color-neutral-400);
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
  color: var(--tf-color-neutral-700);
  border-bottom: 1px solid var(--tf-color-neutral-200);
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
  color: var(--tf-color-neutral-500);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.detail-item span {
  font-size: 14px;
  font-weight: 500;
  color: var(--tf-color-neutral-800);
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
  background-color: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-badge.inactive {
  background-color: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

.status-badge.status-active {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border-color: var(--tf-status-success-border);
}

.status-badge.status-inactive {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border-color: var(--tf-status-danger-border);
}

/* ===== 移动端响应式适配 ===== */
@media (max-width: 768px) {
  .stores-view {
    padding: 16px;
  }

  .form-actions {
    flex-direction: column;
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

}
</style>
