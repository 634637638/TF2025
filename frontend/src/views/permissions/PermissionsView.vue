<template>
  <div class="permissions-view admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="permissions"
      module-name="权限管理"
      permission-code="permissions:view"
    >
      <!-- 主要内容 - 只有有权限时才显示 -->
      <div class="content admin-page-content">
        <!-- 页面头部 -->
        <PageHeader
          :icon="currentTabHeader.icon"
          :title="currentTabHeader.title"
          :description="currentTabHeader.description"
        >
          <template #actions>
            <template v-if="activeTab === 'roles'">
              <el-button
                v-if="canCreate"
                type="primary"
                @click="handleCreateRole"
              >
                <i class="fas fa-plus" />
                新增
              </el-button>
              <el-button
                v-else
                type="primary"
                disabled
                title="您没有新增角色的权限"
              >
                <i class="fas fa-plus" />
                新增
              </el-button>
            </template>

            <template v-else-if="activeTab === 'modules'">
              <el-button
                type="primary"
                @click="scanModules"
              >
                <i class="fas fa-search" />
                扫描模块
              </el-button>
              <el-button
                type="success"
                @click="syncAllModules"
              >
                <i class="fas fa-sync" />
                一键同步
              </el-button>
            </template>

            <template v-else-if="activeTab === 'logs'">
              <el-button
                type="success"
                plain
                :loading="exportingLogs"
                @click="exportLogs"
              >
                <i class="fas fa-download" />
                导出日志
              </el-button>
            </template>

            <template v-else-if="activeTab === 'pagePermissions'">
              <el-button
                type="info"
                plain
                :disabled="loadingPermissionDialog || savingDialogPermissions || !selectedRoleForPermission"
                @click="loadPermissionDialog"
              >
                <i class="fas fa-sync-alt" />
                刷新权限
              </el-button>
              <el-button
                type="primary"
                :disabled="!selectedRoleForPermission"
                @click="closePermissionDialog('roles')"
              >
                <i class="fas fa-arrow-left" />
                返回角色管理
              </el-button>
            </template>

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
                刷新
              </template>
            </el-button>
          </template>
        </PageHeader>

        <!-- 权限统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewPermissionsField('stats_total_roles')"
            class="stat-card"
          >
            <div class="stat-icon roles">
              <i class="fas fa-user-tag" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total_roles }}
              </div>
              <div class="stat-label">
                角色总数
              </div>
            </div>
          </div>

          <div
            v-if="canViewPermissionsField('stats_total_users')"
            class="stat-card"
          >
            <div class="stat-icon users">
              <i class="fas fa-users" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total_users }}
              </div>
              <div class="stat-label">
                用户总数
              </div>
            </div>
          </div>

          <div
            v-if="canViewPermissionsField('stats_system_roles')"
            class="stat-card"
          >
            <div class="stat-icon system-roles">
              <i class="fas fa-cog" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.system_roles }}
              </div>
              <div class="stat-label">
                系统角色
              </div>
            </div>
          </div>

          <div
            v-if="canViewPermissionsField('stats_business_roles')"
            class="stat-card"
          >
            <div class="stat-icon business-roles">
              <i class="fas fa-briefcase" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.business_roles }}
              </div>
              <div class="stat-label">
                业务角色
              </div>
            </div>
          </div>

          <div
            v-if="canViewPermissionsField('stats_total_modules')"
            class="stat-card"
            style="cursor: pointer;"
            @click="goToModuleManagement"
          >
            <div class="stat-icon modules">
              <i class="fas fa-cube" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.total_modules }}
              </div>
              <div class="stat-label">
                权限模块
              </div>
            </div>
          </div>

          <div
            v-if="canViewPermissionsField('stats_unregistered_modules')"
            class="stat-card"
            style="cursor: pointer;"
            @click="goToModuleManagement"
          >
            <div class="stat-icon unregistered">
              <i class="fas fa-exclamation-triangle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.unregistered_modules }}
              </div>
              <div class="stat-label">
                待注册模块
              </div>
            </div>
          </div>
        </div>

        <!-- TAB导航 -->
        <div class="tab-navigation tf-page-tabs">
          <el-button
            :type="activeTab === 'roles' ? 'primary' : 'default'"
            :icon="Avatar"
            @click="handleTabClick('roles')"
          >
            角色管理
          </el-button>
          <el-button
            :type="activeTab === 'userRoles' ? 'primary' : 'default'"
            :icon="User"
            @click="handleTabClick('userRoles')"
          >
            角色分配
          </el-button>
          <el-button
            :type="activeTab === 'storeBindings' ? 'primary' : 'default'"
            :icon="Shop"
            @click="handleTabClick('storeBindings')"
          >
            门店绑定
          </el-button>
          <el-button
            v-if="canViewModuleManagement"
            data-view-permission="module-management:view"
            :type="activeTab === 'modules' ? 'primary' : 'default'"
            :icon="Grid"
            @click="handleTabClick('modules')"
          >
            模块管理
          </el-button>
          <el-button
            :type="activeTab === 'logs' ? 'primary' : 'default'"
            :icon="Document"
            @click="handleTabClick('logs')"
          >
            权限日志
          </el-button>
          <el-button
            v-if="selectedRoleForPermission"
            :type="activeTab === 'pagePermissions' ? 'primary' : 'default'"
            :icon="Lock"
            @click="handleTabClick('pagePermissions')"
          >
            页面权限
          </el-button>
        </div>

        <SharedSearchPanel />

        <!-- 权限管理内容 -->
        <div class="permissions-content admin-page-content tf-tab-content">
          <RolesPage
            v-if="activeTab === 'roles'"
            class="tf-tab-panel"
          />
          <UserRolesPage
            v-else-if="activeTab === 'userRoles'"
            class="tf-tab-panel"
          />
          <StoreBindingsPage
            v-else-if="activeTab === 'storeBindings'"
            class="tf-tab-panel"
          />
          <ModulesPage
            v-else-if="activeTab === 'modules' && canViewModuleManagement"
            ref="modulesPageRef"
            class="tf-tab-panel"
          />
          <LogsPage
            v-else-if="activeTab === 'logs'"
            class="tf-tab-panel"
          />
          <RolePermissionsPage
            v-else-if="activeTab === 'pagePermissions'"
            class="tf-tab-panel"
          />
        </div>

        <RoleFormDialog
          v-model="roleDialogVisible"
          v-model:code="roleForm.code"
          v-model:description="roleForm.description"
          v-model:name="roleForm.name"
          :is-edit="isEditRole"
          :saving="savingRole"
          @submit="saveRole"
        />

        <UserRoleAssignmentDialog
          v-model="userRoleDialogVisible"
          v-model:search-query="roleSearchQuery"
          v-model:selected-role-ids="selectedUserRoleIds"
          :get-role-card-badge-class="getRoleCardBadgeClass"
          :roles="rolesData"
          :saving="savingUserRoles"
          :user="currentUser"
          @close="closeUserRoleDialog"
          @save="saveUserRoles"
        />
      </div> <!-- 结束主要内容 v-else -->

      <!-- 字段权限配置弹窗 -->
      <Teleport to="body">
        <ModuleFieldPermissionDialog
          v-model="showFieldPermissionDialog"
          v-model:selected-fields="selectedFields"
          :field-groups="fieldGroups"
          :get-field-type-label="getFieldTypeLabel"
          :get-sensitivity-label="getSensitivityLabel"
          :is-field-sensitive="isFieldSensitive"
          :module="selectedModule"
          :saving="savingFieldPermissions"
          :total-field-count="totalFieldCount"
          @close="closeFieldPermissionDialog"
          @save="saveFieldPermissions"
        />

        <RoleFieldPermissionDialog
          v-model="roleFieldPermissionDialogVisible"
          v-model:selected-field-group-name="selectedRoleFieldGroupName"
          v-model:selected-fields="selectedRoleFields"
          :field-groups="roleFieldGroups"
          :get-field-type-label="getFieldTypeLabel"
          :get-sensitivity-label="getSensitivityLabel"
          :is-field-sensitive="isFieldSensitive"
          :loading-groups="loadingRoleFieldGroups"
          :loading-modules="loadingRoleFieldModules"
          :modules="roleFieldModuleList"
          :role-name="selectedRoleForFieldPermission?.name"
          :saving="savingRoleFieldPermissions"
          :selected-module="selectedRoleModule"
          @close="closeRoleFieldPermissionDialog"
          @save="saveRoleFieldPermissions"
          @select-module="selectRoleModuleForField"
        />
      </Teleport>

      <Teleport to="body">
        <StoreBindingDialog
          v-model="storeBindingDialogVisible"
          v-model:selected-store-ids="selectedStoreIds"
          :saving="savingStoreBinding"
          :stores="storeList"
          :user="currentUserForBinding"
          @close="closeStoreBindingDialog"
          @save="saveStoreBinding"
        />
      </Teleport>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, onActivated, nextTick, provide } from 'vue'
import { User, Shop, Grid, Document, Avatar, Lock } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import { getModuleFieldGroups } from '@/config/moduleFields.js'
import { PermissionGate, PageHeader } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import { permissionsPageContextKey } from './page/context'
import { getActionMeta, getPermissionMeta, getRoleVisualMeta } from './page/permissionMeta'
import RolesPage from './page/RolesPage.vue'
import UserRolesPage from './page/UserRolesPage.vue'
import StoreBindingsPage from './page/StoreBindingsPage.vue'
import ModulesPage from './page/ModulesPage.vue'
import LogsPage from './page/LogsPage.vue'
import RolePermissionsPage from './page/RolePermissionsPage.vue'
import SharedSearchPanel from './page/SharedSearchPanel.vue'
import RoleFormDialog from './page/RoleFormDialog.vue'
import UserRoleAssignmentDialog from './page/UserRoleAssignmentDialog.vue'
import ModuleFieldPermissionDialog from './page/ModuleFieldPermissionDialog.vue'
import RoleFieldPermissionDialog from './page/RoleFieldPermissionDialog.vue'
import StoreBindingDialog from './page/StoreBindingDialog.vue'
import type { PermissionLog } from '@/types/system'
import { logger } from '@/utils/logger'
import type {
  FieldGroup,
  Role,
  RoleFieldModule,
  StoreBindingUser,
  StoreOption,
  User as PermissionUser,
  Module,
  StatsPayload
} from './types'

// 权限检查
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('permissions')
const { canView: canViewModuleManagement } = usePagePermissions('module-management')

// 状态变量
const { loading } = useLoadingState()
const { refreshing, refresh } = useRefreshData()
const { exportTextFile, buildDateFilename } = useImportExport()
const activeTab = ref('roles')
const modulesPageRef = ref<{ refreshModules: () => Promise<void> } | null>(null)
const permissionsPageContext = reactive<Record<string, any>>({})
provide(permissionsPageContextKey, permissionsPageContext)

// 使用统一通知服务
const { success, error, warning, info, handleApiError, confirm } = useNotification()

// 角色相关状态
const rolesLoading = ref(false)
const rolesData = ref<Role[]>([])
const rolesPagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const roleSearchForm = reactive({
  name: ''
})
const roleSearchExpanded = ref(false)

// 用户相关状态
const usersLoading = ref(false)
const usersData = ref<PermissionUser[]>([])
const usersPagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const userSearchForm = reactive({
  username: '',
  role_id: ''
})
const userSearchExpanded = ref(false)

// 权限相关状态
const selectedRoleId = ref('')
const permissionMatrix = ref<Module[]>([])
const selectedPermissions = ref<string[]>([])
const selectedMenuPermissions = ref<{ module_key: string; menu_visible: boolean | number }[]>([])

// 对话框状态
const roleDialogVisible = ref(false)
const isEditRole = ref(false)
const savingRole = ref(false)

const userRoleDialogVisible = ref(false)
const currentUser = ref<PermissionUser | null>(null)

const selectedUserRoleIds = ref<number[]>([])
const savingUserRoles = ref(false)

// 门店绑定相关状态
const storeBindingsLoading = ref(false)
const storeBindingsData = ref<any[]>([])
const storeList = ref<StoreOption[]>([])
const storeBindingDialogVisible = ref(false)
const currentUserForBinding = ref<StoreBindingUser | null>(null)
const selectedStoreIds = ref<number[]>([])  // 选中的门店ID数组
const savingStoreBinding = ref(false)
const storeBindingSearchForm = reactive({
  user_name: '',
  store_id: '',
  has_store: ''
})
const storeBindingSearchExpanded = ref(false)
const storeBindingsPagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

// 页面权限配置状态
const selectedRoleForPermission = ref<Role | null>(null)
const permissionDialogMatrix = ref<Module[]>([])
const selectedDialogPermissions = ref<string[]>([])
const selectedDialogMenuPermissions = ref<{ module_key: string; menu_visible: boolean | number }[]>([])
const savingDialogPermissions = ref(false)
const loadingPermissionDialog = ref(false)

// 角色字段权限弹窗状态
const roleFieldPermissionDialogVisible = ref(false)
const selectedRoleForFieldPermission = ref<Role | null>(null)
const roleFieldModuleList = ref<RoleFieldModule[]>([])
const selectedRoleModule = ref<RoleFieldModule | null>(null)
const roleFieldGroups = ref<FieldGroup[]>([])
const selectedRoleFields = ref<string[]>([])
const selectedRoleFieldGroupName = ref('')
const savingRoleFieldPermissions = ref(false)
const loadingRoleFieldModules = ref(false)
const loadingRoleFieldGroups = ref(false)

const roleFieldModuleListCache = ref<RoleFieldModule[] | null>(null)
const fieldDefinitionsCache = new Map<string, FieldGroup[]>()

// 角色搜索状态
const roleSearchQuery = ref('')

// 日志相关状态
const logsLoading = ref(false)
const exportingLogs = ref(false)
const logsData = ref<PermissionLog[]>([])
const logsPagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})
const logSearchForm = reactive({
  action: '',
  username: '',
  dateRange: [] as string[]
})
const logSearchExpanded = ref(false)

// 表单数据
const roleForm = reactive({
  id: null as number | null,
  name: '',
  code: '',
  description: ''
})

const ROLE_CODE_PATTERN = /^[A-Za-z0-9:_-]+$/

const permissionsFieldMap: Record<string, string> = {
  stats_total_roles: 'stats.total_roles',
  stats_total_users: 'stats.total_users',
  stats_system_roles: 'stats.system_roles',
  stats_business_roles: 'stats.business_roles',
  stats_total_modules: 'stats.total_modules',
  stats_unregistered_modules: 'stats.unregistered_modules',
  actions: 'system_info.operations'
}

const getPermissionsFieldKey = (fieldName: string) => permissionsFieldMap[fieldName] || fieldName
const canViewPermissionsField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('permissions_permissionsview', getPermissionsFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewPermissionsField('stats_total_roles') ||
  canViewPermissionsField('stats_total_users') ||
  canViewPermissionsField('stats_system_roles') ||
  canViewPermissionsField('stats_business_roles') ||
  canViewPermissionsField('stats_total_modules') ||
  canViewPermissionsField('stats_unregistered_modules')
))
const showPermissionsActionField = computed(() => shouldShowActionColumn(
  canViewPermissionsField('actions'),
  [canEdit.value, canDelete.value]
))




// 统计数据
const stats = reactive({
  total_roles: 0,
  total_users: 0,
  total_modules: 0,
  total_permissions: 0,
  system_roles: 0,
  business_roles: 0,
  active_users: 0,
  users_with_roles: 0,
  unregistered_modules: 0
})

const resetStatsState = () => {
  stats.total_roles = 0
  stats.total_users = 0
  stats.active_users = 0
  stats.system_roles = 0
  stats.business_roles = 0
  stats.users_with_roles = 0
  stats.total_permissions = 0
  stats.total_modules = 0
  stats.unregistered_modules = 0
}

const applyStatsState = (payload: StatsPayload = {}) => {
  stats.total_roles = parseInt(String(payload.total_roles ?? 0)) || 0
  stats.total_users = parseInt(String(payload.total_users ?? 0)) || 0
  stats.active_users = parseInt(String(payload.active_users ?? 0)) || 0
  stats.system_roles = parseInt(String(payload.system_roles ?? 0)) || 0
  stats.business_roles = parseInt(String(payload.business_roles ?? 0)) || 0
  stats.users_with_roles = parseInt(String(payload.users_with_roles ?? 0)) || 0
  stats.total_permissions = parseInt(String(payload.total_permissions ?? 0)) || 0
  stats.total_modules = parseInt(String(payload.total_modules ?? 0)) || 0
  stats.unregistered_modules = parseInt(String(payload.unregistered_modules ?? 0)) || 0
}

const buildPermissionEventDetail = (detail: Record<string, any>) => ({
  ...detail,
  timestamp: Date.now()
})

const emitPermissionUpdated = (detail: Record<string, any>) => {
  window.dispatchEvent(new CustomEvent('tf2025:permissions:updated', {
    detail: buildPermissionEventDetail(detail)
  }))
}

const syncPermissionSideEffects = async (roleId?: number | string | null) => {
  const normalizedRoleId = roleId === null || roleId === undefined ? undefined : Number(roleId)
  const menuStore = useMenuStore()
  await menuStore.refreshMenus()

  const authStore = useAuthStore()
  if (normalizedRoleId && (authStore.user as any)?.role_id === normalizedRoleId) {
    await authStore.fetchUserInfo()
  }

  emitPermissionUpdated({ role_id: normalizedRoleId })
}

const normalizeMenuPermissions = (
  items: Array<{ module_key?: string; key?: string; menu_visible?: boolean | number }>,
  visible?: boolean
) => items.map((item) => ({
  module_key: item.module_key || item.key || '',
  menu_visible: typeof visible === 'boolean'
    ? (visible ? 1 : 0)
    : (item.menu_visible === true || item.menu_visible === 1 ? 1 : 0)
}))

const normalizePermissionPayload = (permissions: string[]) => permissions.map((permission) => {
  const [module_key, permission_type] = permission.split(':')
  return { module_key, permission_type }
})

const parseRoles = (roles: string | Role[] | null) => {
  if (!roles) {
    return {
      names: [] as string[],
      ids: [] as number[]
    }
  }

  if (Array.isArray(roles)) {
    return {
      names: roles.map((role) => role.name).filter(Boolean),
      ids: roles.map((role) => role.id).filter((id) => id !== null && id !== undefined)
    }
  }

  const roleNames = roles
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)

  return {
    names: roleNames,
    ids: roleNames
      .map((roleName) => rolesData.value.find((role) => role.name === roleName)?.id ?? null)
      .filter((id): id is number => id !== null && id !== undefined)
  }
}

const updatePaginationState = (
  pagination: { page: number; page_size: number },
  page: number,
  pageSize: number,
  loader?: () => void | Promise<void>
) => {
  pagination.page = page
  pagination.page_size = pageSize
  if (loader) {
    return loader()
  }
}

// 字段权限相关状态
const showFieldPermissionDialog = ref(false)
const selectedModule = ref<any>(null)
const fieldGroups = ref<any[]>([])
const selectedFields = ref<string[]>([])
const savingFieldPermissions = ref(false)

// 字段权限计算属性
const totalFieldCount = computed(() => {
  return fieldGroups.value.reduce((total, group) => total + group.fields.length, 0)
})

const selectedDialogPermissionSet = computed(() => new Set(selectedDialogPermissions.value))
const selectedDialogMenuPermissionMap = computed(() => {
  const map = new Map<string, boolean>()
  selectedDialogMenuPermissions.value.forEach((perm) => {
    map.set(perm.module_key, perm.menu_visible === true || perm.menu_visible === 1)
  })
  return map
})
const currentTabHeader = computed(() => {
  if (activeTab.value === 'userRoles') {
    return {
      icon: 'fas fa-users',
      title: '角色分配',
      description: ''
    }
  }

  if (activeTab.value === 'storeBindings') {
    return {
      icon: 'fas fa-store',
      title: '门店绑定',
      description: ''
    }
  }

  if (activeTab.value === 'modules') {
    return {
      icon: 'fas fa-cube',
      title: '模块管理',
      description: ''
    }
  }

  if (activeTab.value === 'logs') {
    return {
      icon: 'fas fa-history',
      title: '权限日志',
      description: ''
    }
  }

  if (activeTab.value === 'pagePermissions') {
    return {
      icon: 'fas fa-lock',
      title: '页面权限',
      description: selectedRoleForPermission.value
        ? `正在配置角色“${selectedRoleForPermission.value.name}”的页面权限`
        : '请选择角色后再配置页面权限'
    }
  }

  return {
    icon: 'fas fa-user-tag',
    title: '角色管理',
    description: ''
  }
})

// 计算属性
const filteredRoles = computed(() => {
  let filtered = rolesData.value

  if (roleSearchForm.name.trim() !== '') {
    const keyword = roleSearchForm.name.trim().toLowerCase()
    filtered = filtered.filter(role =>
      role.name.toLowerCase().includes(keyword) ||
      (role.code && role.code.toLowerCase().includes(keyword)) ||
      (role.description && role.description.toLowerCase().includes(keyword))
    )
  }

  return filtered
})

const paginatedRoles = computed(() => {
  const start = (rolesPagination.page - 1) * rolesPagination.page_size
  const end = start + rolesPagination.page_size
  return filteredRoles.value.slice(start, end)
})

const filteredUsers = computed(() => {
  let filtered = usersData.value

  if (userSearchForm.username !== '') {
    filtered = filtered.filter(user =>
      user.username.toLowerCase().includes(userSearchForm.username.toLowerCase())
    )
  }

  if (userSearchForm.role_id !== '') {
    filtered = filtered.filter(user => {
      const roleIds = getUserRoleIds(user.roles)
      return roleIds.includes(parseInt(userSearchForm.role_id))
    })
  }

  return filtered
})

const paginatedUsers = computed(() => {
  const start = (usersPagination.page - 1) * usersPagination.page_size
  const end = start + usersPagination.page_size
  return filteredUsers.value.slice(start, end)
})


const filteredLogs = computed(() => {
  return logsData.value
})

const paginatedLogs = computed(() => {
  return filteredLogs.value
})

// 模块管理相关方法
const goToModuleManagement = () => {
  if (!canViewModuleManagement.value) {
    warning('您没有查看模块管理的权限')
    return
  }
  activeTab.value = 'modules'
}


const scanModules = async () => {
  try {
    info('开始扫描模块...')
    const response = await unifiedApi.get('/modules/scan')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      success(`扫描完成，发现 ${data.total || 0} 个模块`)
      await loadModuleStats()
    } else {
      error('扫描失败: ' + (response.message || '未知错误'))
    }
  } catch {
    error('扫描模块失败')
  }
}

const syncAllModules = async () => {
  try {
    info('开始同步模块...')
    const response = await unifiedApi.post('/modules/sync-all')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      success(`同步完成，成功 ${data.success || 0} 个，失败 ${data.errors || 0} 个`)
      await loadModuleStats()
      await loadRoles() // 刷新角色列表以获取最新权限
      await modulesPageRef.value?.refreshModules()
    } else {
      error('同步失败: ' + (response.message || '未知错误'))
    }
  } catch {
    error('同步模块失败')
  }
}

const loadModuleStats = async () => {
  try {
    const response = await unifiedApi.get('/modules/stats/overview')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      stats.total_modules = Number(data.total_modules) || 0
      stats.total_permissions = Number(data.total_permissions) || stats.total_permissions
      stats.total_roles = Number(data.total_roles) || stats.total_roles
      stats.active_users = Number(data.active_users) || stats.active_users
    }
  } catch {
    // 加载模块统计失败，忽略
  }
}

const loadUnregisteredModules = async () => {
  try {
    const response = await unifiedApi.get('/modules/unregistered')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      stats.unregistered_modules = Number(data.total) || 0
    } else {
      stats.unregistered_modules = 0
    }
  } catch {
    stats.unregistered_modules = 0
  }
}

// 方法
const loadStats = async () => {
  try {
    const response = await unifiedApi.get('/permissions/overview')
    if (response.success) {
      applyStatsState(response.data || response)
    } else {
      resetStatsState()
    }
  } catch {
    resetStatsState()
  }
}

const loadRoles = async (showLoading = true, showSuccess = false) => {
  try {
    if (showLoading) {
      rolesLoading.value = true
    }

    // 构建查询参数
    const params = new URLSearchParams()
    if (roleSearchForm.name) {
      params.append('search', roleSearchForm.name)
    }
    params.append('page', rolesPagination.page.toString())
    params.append('page_size', rolesPagination.page_size.toString())

    // 调用认证的API获取角色数据
    const response = await unifiedApi.get(`/permissions/roles?${params.toString()}`)

    if (response.success) {
      // 修复：response.data 包含 roles 和分页信息
      const responseData = response.data || {}
      rolesData.value = responseData.roles || []

      // 使用后端返回的分页信息
      if (responseData.total) {
        rolesPagination.total = parseInt(responseData.total)
      } else {
        // 回退到客户端分页
        rolesPagination.total = responseData.roles?.length || 0
      }

      // 静默刷新成功提示
      if (showSuccess) {
        const total = rolesData.value.length
        success('角色数据已刷新', {
          title: `加载了 ${total} 个角色`,
          duration: 2000
        })
      }
    } else {
      error(response.message || '加载角色列表失败')
      rolesData.value = []
      rolesPagination.total = 0
      rolesPagination.page = 1
    }
  } catch (err) {
    // 检查是否是认证错误
    if (err.response?.status === 401 || err.response?.status === 403) {
      error('认证失败，请重新登录')
      // 可以在这里添加跳转到登录页的逻辑
      // 例如: router.push('/login')
    } else {
      error('加载角色列表失败')
    }

    rolesData.value = []
    rolesPagination.total = 0
    rolesPagination.page = 1
  } finally {
    rolesLoading.value = false
  }
}

const loadUsers = async (showLoading = true, showSuccess = false) => {
  try {
    if (showLoading) {
      usersLoading.value = true
    }

    const response = await unifiedApi.get('/permissions/users-with-roles', {
      params: {
        page: usersPagination.page,
        page_size: usersPagination.page_size,
        search: userSearchForm.username || undefined,
        role_id: userSearchForm.role_id || undefined
      }
    })

    if (response.success) {
      // 修复：response.data 包含 users 和 pagination 信息
      const responseData = response.data || {}
      const users = responseData.users || []

      // 仅在明确要求时显示成功提示，普通加载保持静默
      if (showSuccess) {
        success(`成功加载 ${users.length} 个用户`, {
          duration: 2000
        })
      }
      const pagination = responseData.pagination || {}

      // 使用后端返回的分页信息
      usersPagination.total = pagination.total || users.length
      usersPagination.page = pagination.page || 1

      if (users.length === 0) {
        usersData.value = []
        usersPagination.total = 0
        usersPagination.page = 1
        return
      }

      // 数据已经在后端处理完成，只需要预处理显示文本
      const processedUsers = users.map((user: any) => {
        // 预处理用户角色显示文本
        // 后端返回的 roles 是字符串，需要处理
        user.rolesText = user.roles ? user.roles : '无角色'
        user.hasRoles = !!user.roles && user.roles.trim() !== ''

        return user
      })

      usersData.value = processedUsers

    } else {
      error(response.message || '获取用户列表失败')
      usersData.value = []
      usersPagination.total = 0
      usersPagination.page = 1
    }
  } catch (err: any) {
    error('获取用户列表失败: ' + (err.message || err))
    usersData.value = []
    usersPagination.total = 0
    usersPagination.page = 1
  } finally {
    usersLoading.value = false
  }
}

// 获取权限图标
const getPermissionIcon = (type: string): string => getPermissionMeta(type).icon

// 获取权限名称（增强版）
const getPermissionNameEnhanced = (type: string): string => getPermissionMeta(type).name || type

const loadPermissionMatrix = async (_showLoading = true, showSuccess = false) => {
  if (!selectedRoleId.value) return

  try {
    const [permissionResponse, menuResponse] = await Promise.all([
      unifiedApi.get(`/permissions/roles/${selectedRoleId.value}/permissions`),
      unifiedApi.get(`/permissions/menu/${selectedRoleId.value}`)
    ])

    if (permissionResponse.success) {
      const modules = permissionResponse.data || []
      const meta = (permissionResponse.data as any)?.meta || {}

      // 静默刷新时不显示提示
      if (showSuccess) {
        if (meta.from_database === false) {
          info(`加载了 ${meta.total_modules || 0} 个扫描到的模块，建议先在"模块管理"中同步模块到数据库以获得完整功能`)
        } else {
          success(`成功加载 ${meta.total_modules || 0} 个模块的权限`)
        }
      }

      permissionMatrix.value = modules.map((module: Module) => ({
        ...module,
        // 确保module_key字段存在且正确
        module_key: module.module_key || module.key,
        permissions: module.permissions || [],
        icon: getDefaultIcon(module.module_key || module.key, module.category)
      }))

      // 设置已选中的功能权限 - 检查多种可能的字段
      const selected: string[] = []
      permissionMatrix.value.forEach(module => {
        module.permissions.forEach(permission => {
          // 检查权限是否被选中（后端可能返回不同的字段名）
          if (permission.assigned === true ||
              permission.selected === true ||
              permission.has_permission === true) {
            selected.push(`${module.module_key}:${permission.permission_type}`)
          }
        })
      })
      selectedPermissions.value = selected

      // 设置菜单权限
      if (menuResponse.success) {
        const menuPerms = menuResponse.data.menu_permissions || menuResponse.data || []
        // 确保数据格式正确
        selectedMenuPermissions.value = Array.isArray(menuPerms) ? menuPerms.map(perm => ({
          module_key: perm.module_key,
          menu_visible: perm.menu_visible === true || perm.menu_visible === 1
        })) : []
      }
    } else {
      error(permissionResponse.message || '加载权限矩阵失败')
      permissionMatrix.value = []
      selectedPermissions.value = []
      selectedMenuPermissions.value = []
    }
  } catch (err: any) {
    // 忽略请求被取消的错误
    if (err.name === 'CanceledError' || err.message === 'canceled') {
      return
    }

    const errorMessage = err.response?.data?.message || err.message || '加载权限矩阵失败'
    error(errorMessage)
    permissionMatrix.value = []
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
  }
}

// 搜索区域展开/收起函数
const toggleRoleSearch = () => {
  roleSearchExpanded.value = !roleSearchExpanded.value
}

const toggleUserSearch = () => {
  userSearchExpanded.value = !userSearchExpanded.value
}

const toggleStoreBindingSearch = () => {
  storeBindingSearchExpanded.value = !storeBindingSearchExpanded.value
}

const toggleLogSearch = () => {
  logSearchExpanded.value = !logSearchExpanded.value
}

const searchRoles = () => {
  rolesPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const resetRoleSearch = () => {
  roleSearchForm.name = ''
  rolesPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const searchUsers = () => {
  usersPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const resetUserSearch = () => {
  userSearchForm.username = ''
  userSearchForm.role_id = ''
  usersPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const refreshCurrentPage = async () => {
  // 刷新当前标签页的数据

  const promises = []

  if (activeTab.value === 'roles') {
    promises.push(loadRoles(false, false))
  } else if (activeTab.value === 'userRoles') {
    promises.push(loadUsers(false, false))
  } else if (activeTab.value === 'storeBindings') {
    promises.push(loadStoreList())
    promises.push(loadStoreBindings())
  } else if (activeTab.value === 'logs') {
    promises.push(loadLogs())
  } else if (activeTab.value === 'pagePermissions' && selectedRoleForPermission.value) {
    promises.push(loadPermissionDialog())
  } else if (activeTab.value === 'modules') {
    const moduleRefresh = modulesPageRef.value?.refreshModules()
    if (moduleRefresh) promises.push(moduleRefresh)
    if (selectedRoleId.value) promises.push(loadPermissionMatrix(false, false))
  }

  // 总是刷新统计数据
  promises.push(loadStats())
  promises.push(loadUnregisteredModules())

  // 并行执行，提高刷新速度
  await Promise.all(promises)
}

// 统一的刷新处理函数
const handleRefresh = async () => {
  // 不使用 loading 状态，实现完全静默刷新
  try {
    await refresh(async () => {
      await refreshCurrentPage()
    })

    // 显示简洁的成功提示
    success('数据刷新成功', {
      duration: 1500,
      position: 'top-right'
    })
  } catch (err) {
    logger.error('刷新失败:', err)
    handleApiError(err, '刷新数据失败')
  }
}


// 🚀 优化：标签页点击处理（移除重复的数据加载）
const handleTabClick = async (tabName: string) => {
  if (tabName === 'modules' && !canViewModuleManagement.value) {
    warning('您没有查看模块管理的权限')
    return
  }

  if (activeTab.value === tabName) {
    return
  }

  if (activeTab.value === 'pagePermissions' && selectedRoleForPermission.value && tabName !== 'pagePermissions') {
    const saved = await closePermissionDialog(tabName)
    if (!saved) {
      return
    }
    return
  }

  activeTab.value = tabName
}

const handleCreateRole = () => {
  isEditRole.value = false
  roleForm.id = null
  roleForm.name = ''
  roleForm.code = ''
  roleForm.description = ''
  roleDialogVisible.value = true
}

const handleEditRole = (role: Role) => {
  isEditRole.value = true
  roleForm.id = role.id
  roleForm.name = role.name
  roleForm.code = role.code || ''
  roleForm.description = role.description || ''
  roleDialogVisible.value = true
}

const saveRole = async () => {
  if (savingRole.value) return

  // 自定义表单验证
  if (!roleForm.name.trim()) {
    error('请输入角色名称')
    return
  }

  if (!roleForm.description.trim()) {
    error('请输入角色描述')
    return
  }

  if (roleForm.code.trim() && !ROLE_CODE_PATTERN.test(roleForm.code.trim())) {
    error('角色编码只能包含字母、数字、下划线、中划线或冒号')
    return
  }

  try {
    savingRole.value = true

    // 构建角色数据
    const roleData = {
      name: roleForm.name.trim(),
      code: roleForm.code.trim() || null,
      description: roleForm.description.trim()
    }

    let response: any
    if (isEditRole.value && roleForm.id) {
      response = await unifiedApi.put(`/permissions/roles/${roleForm.id}`, roleData)
    } else {
      response = await unifiedApi.post('/permissions/roles', roleData)
    }

    if (response.success) {
      success(isEditRole.value ? '角色更新成功' : '角色创建成功')

      closeRoleDialog()
      // 重新加载角色和统计数据
      await loadRoles()
      await loadUsers() // 用户列表也需要刷新，因为可能影响用户的角色显示
      await loadStats()

      // 如果是新创建角色，显示新角色信息
      if (!isEditRole.value && response.data) {
        const newRole = response.data
        info(`新角色"${newRole.name}"(ID: ${newRole.id})已创建并保存到角色表`)
      }
    } else {
      error(response.message || (isEditRole.value ? '更新角色失败' : '创建角色失败'))
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || (isEditRole.value ? '更新角色失败' : '创建角色失败')
    error(errorMessage)
    logger.error(err)
  } finally {
    savingRole.value = false
  }
}

const closeRoleDialog = () => {
  roleDialogVisible.value = false
  // 重置表单数据
  roleForm.id = null
  roleForm.name = ''
  roleForm.code = ''
  roleForm.description = ''
}

const handleDeleteRole = async (role: Role) => {
  if (role.user_count && role.user_count > 0) {
    warning('该角色下还有用户，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除角色"${role.name}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )

    const response = await unifiedApi.delete(`/permissions/roles/${role.id}`)
    if (response.success) {
      success('角色删除成功')
      // 重新加载角色和用户列表，因为删除角色可能影响用户的角色显示
      await loadRoles()
      await loadUsers()
      await loadStats()
    } else {
      error(response.message || '删除角色失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      const errorMessage = err.response?.data?.message || err.message || '删除角色失败'
      error(errorMessage)
      logger.error(err)
    }
  }
}

const toggleRoleStatus = async (role: Role) => {
  // 系统角色不能停用
  if (role.id === 1 || role.id === 9) {
    warning('系统角色不能停用')
    return
  }

  const isActive = String(role.is_active) === '1' || role.is_active === true
  const action = isActive ? '停用' : '启用'

  // 确认对话框
  const title = isActive ? '停用角色' : '启用角色'
  const message = isActive
    ? `确定要停用"${role.name}"角色吗？停用后，该角色下的所有用户将无法登录系统，已登录的用户将被强制下线，所有相关权限将被立即撤销。请谨慎操作！`
    : `确定要启用"${role.name}"角色吗？启用后，拥有该角色的用户将可以登录系统，相关权限将立即生效。`
  const options = {
    confirmButtonText: isActive ? '确认停用' : '确认启用',
    cancelButtonText: '取消操作',
    type: isActive ? 'warning' : 'success'
  }

  const confirmed = await confirm(message, title, options)

  if (!confirmed) return

  try {
    const response = await unifiedApi.put(`/permissions/roles/${role.id}/status`, {
      is_active: isActive ? '0' : '1'
    })

    if (response.success) {
      const affectedUsers = response.data?.affected_users || 0
      if (isActive && affectedUsers > 0) {
        success(`"${role.name}"角色已成功停用，${affectedUsers}位用户的访问权限已更新`)
      } else if (isActive) {
        success(`"${role.name}"角色已成功停用`)
      } else {
        success(`"${role.name}"角色已成功启用，相关用户现在可以正常使用系统`)
      }

      // 立即重新加载所有相关数据以确保与数据库同步
      try {
        // 并行加载以提高性能
        await Promise.all([
          loadRoles(),
          loadUsers(),
          loadStats()
        ])
      } catch (loadError) {
        logger.error('数据同步失败:', loadError)
        // 即使同步失败，至少要更新角色列表
        await loadRoles()
      }
    } else {
      error(response.message || `${action}角色失败`)
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || `${action}角色失败`
    error(errorMessage)
    logger.error(err)
  }
}

const handleAssignPermissions = async (role: Role) => {
  selectedRoleForPermission.value = role
  permissionDialogMatrix.value = []
  selectedDialogPermissions.value = []
  selectedDialogMenuPermissions.value = []
  loadingPermissionDialog.value = true
  activeTab.value = 'pagePermissions'
  await nextTick()
  void loadPermissionDialog()
}

// 加载权限弹窗数据（优化版 - 移除大量 console.log）
const loadPermissionDialog = async () => {
  if (!selectedRoleForPermission.value) return

  try {
    loadingPermissionDialog.value = true
    const [permissionResponse, menuResponse] = await Promise.all([
      unifiedApi.get(`/permissions/roles/${selectedRoleForPermission.value.id}/permissions`),
      unifiedApi.get(`/permissions/menu/${selectedRoleForPermission.value.id}`)
    ])

    if (permissionResponse.success) {
      const modules = permissionResponse.data || []

      // 🚀 优化：统一处理数据结构，减少重复判断
      permissionDialogMatrix.value = modules.map((module: Module) => {
        const moduleKey = module.module_key || module.key
        return {
          ...module,
          module_key: moduleKey,
          key: moduleKey, // 统一字段名
          permissions: (module.permissions || []).map(p => ({
            ...p,
            permission_type: p.permission_type || p.type,
            type: p.permission_type || p.type // 统一字段名
          })),
          icon: getDefaultIcon(moduleKey, module.category)
        }
      })

      // 设置已选中的功能权限
      const selected: string[] = []
      permissionDialogMatrix.value.forEach(module => {
        const moduleKey = module.module_key // 使用统一字段
        module.permissions.forEach(permission => {
          if (permission.assigned === true ||
              permission.selected === true ||
              permission.has_permission === true) {
            selected.push(`${moduleKey}:${permission.permission_type}`)
          }
        })
      })
      selectedDialogPermissions.value = selected

      // 设置菜单权限
      if (menuResponse.success) {
        const menuPerms = menuResponse.data.menu_permissions || menuResponse.data || []
        selectedDialogMenuPermissions.value = Array.isArray(menuPerms) ? menuPerms.map(perm => ({
          module_key: perm.module_key,
          menu_visible: perm.menu_visible === true || perm.menu_visible === 1
        })) : []
      }
    }
  } catch (err: any) {
    logger.error('加载权限弹窗数据失败:', err)
    error('加载权限数据失败')
  } finally {
    loadingPermissionDialog.value = false
  }
}

// 页面权限页关闭时统一保存
const closePermissionDialog = async (nextTab = 'roles') => {
  loadingPermissionDialog.value = false
  selectedRoleForPermission.value = null
  permissionDialogMatrix.value = []
  selectedDialogPermissions.value = []
  selectedDialogMenuPermissions.value = []
  activeTab.value = nextTab

  return true
}

const persistDialogPermissions = async () => {
  const roleId = selectedRoleForPermission.value?.id
  if (!roleId) return

  await unifiedApi.put(`/permissions/roles/${roleId}/permissions`, {
    permissions: normalizePermissionPayload(selectedDialogPermissions.value)
  })

  await syncPermissionSideEffects(roleId)
}

const persistDialogMenuPermissions = async () => {
  const roleId = selectedRoleForPermission.value?.id
  if (!roleId) return

  await unifiedApi.put(`/permissions/menu/${roleId}`, {
    menu_permissions: normalizeMenuPermissions(selectedDialogMenuPermissions.value)
  })

  await syncPermissionSideEffects(roleId)
}

// 页面权限点击后立即生效
const handleDialogPermissionChange = async (moduleKey: string, permission_type: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const permissionKey = `${moduleKey}:${permission_type}`
  const previousPermissions = [...selectedDialogPermissions.value]

  if (target.checked) {
    if (!selectedDialogPermissions.value.includes(permissionKey)) {
      selectedDialogPermissions.value.push(permissionKey)
    }
  } else {
    const index = selectedDialogPermissions.value.indexOf(permissionKey)
    if (index > -1) {
      selectedDialogPermissions.value.splice(index, 1)
    }
  }

  try {
    savingDialogPermissions.value = true
    await persistDialogPermissions()
    success(`${getPermissionNameEnhanced(permission_type)}已${target.checked ? '开启' : '关闭'}`)
  } catch (err: any) {
    selectedDialogPermissions.value = previousPermissions
    const errorMessage = err.response?.data?.message || err.message || '更新页面动作权限失败'
    error(errorMessage)
    logger.error('更新页面动作权限失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

// 菜单显示点击后立即生效
const handleDialogMenuPermissionChange = async (moduleKey: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const previousMenuPermissions = selectedDialogMenuPermissions.value.map((perm) => ({ ...perm }))

  const existingIndex = selectedDialogMenuPermissions.value.findIndex(perm => perm.module_key === moduleKey)

  if (existingIndex > -1) {
    selectedDialogMenuPermissions.value[existingIndex].menu_visible = target.checked ? 1 : 0
  } else {
    selectedDialogMenuPermissions.value.push({
      module_key: moduleKey,
      menu_visible: target.checked ? 1 : 0
    })
  }

  try {
    savingDialogPermissions.value = true
    await persistDialogMenuPermissions()
    success(`菜单显示已${target.checked ? '开启' : '关闭'}`)
  } catch (err: any) {
    selectedDialogMenuPermissions.value = previousMenuPermissions
    const errorMessage = err.response?.data?.message || err.message || '更新菜单显示失败'
    error(errorMessage)
    logger.error('更新菜单显示失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

// 弹窗中的权限检查函数
const isDialogPermissionSelected = (moduleKey: string, permission_type: string): boolean => {
  const permissionKey = `${moduleKey}:${permission_type}`
  return selectedDialogPermissionSet.value.has(permissionKey)
}

const isDialogMenuPermissionSelected = (moduleKey: string): boolean => {
  return selectedDialogMenuPermissionMap.value.get(moduleKey) === true
}

// 角色字段权限处理函数
const handleRoleFieldPermissions = async (role: Role) => {
  selectedRoleForFieldPermission.value = role
  roleFieldPermissionDialogVisible.value = true
  roleFieldModuleList.value = []
  selectedRoleModule.value = null
  roleFieldGroups.value = []
  selectedRoleFields.value = []
  selectedRoleFieldGroupName.value = ''
  await nextTick()
  void loadRoleFieldModules()
}

// 加载角色字段权限的模块列表
const loadRoleFieldModules = async () => {
  if (!selectedRoleForFieldPermission.value) return

  try {
    loadingRoleFieldModules.value = true

    if (roleFieldModuleListCache.value) {
      roleFieldModuleList.value = roleFieldModuleListCache.value
      return
    }

    // 获取所有有字段映射的模块
    const response = await unifiedApi.get('/permissions/module-mappings')

    if (response.success) {
      const modules = response.data || []

      roleFieldModuleList.value = modules.map((module: any) => ({
        ...module,
        name: module.name,
        icon: module.icon || getDefaultIcon(module.key, module.category)
      }))
      roleFieldModuleListCache.value = roleFieldModuleList.value
    }
  } catch (err: any) {
    logger.error('加载模块列表失败:', err)
    error('加载模块列表失败')
  } finally {
    loadingRoleFieldModules.value = false
  }
}

// 选择模块查看字段权限
const selectRoleModuleForField = async (module: RoleFieldModule) => {
  selectedRoleModule.value = module
  selectedRoleFieldGroupName.value = ''

  try {
    loadingRoleFieldGroups.value = true

    // 使用与权限分配页面相同的字段定义获取方法
    roleFieldGroups.value = await getFieldDefinitionsForModule(module.module_key || module.key)
    selectedRoleFieldGroupName.value = roleFieldGroups.value[0]?.name || ''

    // 加载该角色的字段权限配置
    const moduleKey = module.module_key || module.key
    await loadRoleFieldPermissions(moduleKey)
  } catch (err: any) {
    logger.error('加载字段权限失败:', err)
    error('加载字段权限失败')
    selectedRoleFieldGroupName.value = ''
  } finally {
    loadingRoleFieldGroups.value = false
  }
}

// 加载角色的字段权限配置
const loadRoleFieldPermissions = async (moduleKey: string) => {
  if (!selectedRoleForFieldPermission.value) return

  try {
    // 重置选中字段
    selectedRoleFields.value = []

    // 获取该角色的字段权限
    const response = await unifiedApi.get(`/permissions/field-permissions/${selectedRoleForFieldPermission.value.id}`, {
      params: { module_key: moduleKey }
    })

    if (response.success && response.data) {
      // 处理可能为空的对象
      const fieldPermissions = response.data.field_permissions || {}

      if (fieldPermissions[moduleKey] && fieldPermissions[moduleKey].field_config) {
        const fieldConfig = fieldPermissions[moduleKey].field_config
        const hiddenFieldKeys = fieldConfig.hidden_fields || []
        selectedRoleFields.value = hiddenFieldKeys
      } else {
        selectedRoleFields.value = []
      }
    } else {
      selectedRoleFields.value = []
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '加载字段权限配置失败'
    selectedRoleFields.value = []

    if (err.response?.status === 404 && errorMessage.includes('角色不存在')) {
      warning('当前角色已不存在，已关闭字段权限弹窗并刷新角色列表')
      closeRoleFieldPermissionDialog()
      await loadRoles(false)
      return
    }

    error(errorMessage)
  }
}

// 保存角色字段权限
const saveRoleFieldPermissions = async () => {
  if (savingRoleFieldPermissions.value) return

  if (!selectedRoleForFieldPermission.value || !selectedRoleModule.value) return

  try {
    savingRoleFieldPermissions.value = true

    const moduleKey = selectedRoleModule.value.module_key || selectedRoleModule.value.key

    const hiddenFieldKeys = selectedRoleFields.value

    const fieldConfig = {
      hidden_fields: hiddenFieldKeys
    }

    const response = await unifiedApi.put(`/permissions/field-permissions/${selectedRoleForFieldPermission.value.id}`, {
      module_key: moduleKey,
      field_config: fieldConfig
    })

    if (response.success) {
      success('字段权限配置保存成功')
      // 刷新全局字段权限（等待完成以确保权限数据已更新）
      await fieldPermissions.fetchUserFieldPermissions()

      // 同步更新本地显示状态：重新加载当前角色的字段权限配置
      await loadRoleFieldPermissions(moduleKey)
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '保存字段权限配置失败'
    error(errorMessage)
    logger.error('保存字段权限配置失败:', err)
  } finally {
    savingRoleFieldPermissions.value = false
  }
}

// 关闭角色字段权限弹窗
const closeRoleFieldPermissionDialog = () => {
  roleFieldPermissionDialogVisible.value = false
  selectedRoleForFieldPermission.value = null
  selectedRoleModule.value = null
  roleFieldGroups.value = []
  selectedRoleFields.value = []
  selectedRoleFieldGroupName.value = ''
}

// 弹窗中的快速操作函数
const selectAllDialogPermissions = async (select = true) => {
  if (!permissionDialogMatrix.value.length || savingDialogPermissions.value) return
  const previousPermissions = [...selectedDialogPermissions.value]

  try {
    savingDialogPermissions.value = true

    if (select) {
      const permissionKeys = new Set<string>()
      permissionDialogMatrix.value.forEach(module => {
        module.permissions.forEach(permission => {
          const permission_type = permission.permission_type || permission.type
          permissionKeys.add(`${module.module_key || module.key}:${permission_type}`)
        })
      })
      selectedDialogPermissions.value = Array.from(permissionKeys)
    } else {
      selectedDialogPermissions.value = []
    }

    await persistDialogPermissions()
    success(select ? '已开启全部页面动作权限' : '已清空全部页面动作权限')
  } catch (err: any) {
    selectedDialogPermissions.value = previousPermissions
    const errorMessage = err.response?.data?.message || err.message || '批量更新页面动作权限失败'
    error(errorMessage)
    logger.error('批量更新页面动作权限失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

const toggleAllDialogMenuPermissions = async (show = true) => {
  if (!permissionDialogMatrix.value.length || savingDialogPermissions.value) return
  const previousMenuPermissions = selectedDialogMenuPermissions.value.map((perm) => ({ ...perm }))

  try {
    savingDialogPermissions.value = true
    selectedDialogMenuPermissions.value = permissionDialogMatrix.value.map(module => ({
      module_key: module.module_key || module.key,
      menu_visible: show
    }))
    await persistDialogMenuPermissions()
    success(show ? '已开启全部菜单显示' : '已隐藏全部菜单显示')
  } catch (err: any) {
    selectedDialogMenuPermissions.value = previousMenuPermissions
    const errorMessage = err.response?.data?.message || err.message || '批量更新菜单显示失败'
    error(errorMessage)
    logger.error('批量更新菜单显示失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

const getUserRoleNames = (roles: string | Role[] | null) => parseRoles(roles).names
const getUserRoleIds = (roles: string | Role[] | null) => parseRoles(roles).ids
const getRoleTagClass = (roleName: string) => getRoleVisualMeta(roleName).tagClass
const getRoleCardBadgeClass = (roleName: string) => getRoleVisualMeta(roleName).cardBadgeClass

const handleEditUserRoles = (user: PermissionUser) => {
  currentUser.value = user
  selectedUserRoleIds.value = getUserRoleIds(user.roles)
  roleSearchQuery.value = ''
  userRoleDialogVisible.value = true
}

const saveUserRoles = async () => {
  if (savingUserRoles.value) return

  if (!currentUser.value) return

  try {
    savingUserRoles.value = true

    const response = await unifiedApi.put(`/permissions/users/${currentUser.value.id}/roles`, {
      role_ids: selectedUserRoleIds.value
    })

    if (response.success) {
      success('用户角色分配成功')

      closeUserRoleDialog()
      await loadUsers()
    } else {
      error(response.message || '分配用户角色失败')
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '分配用户角色失败'
    error(errorMessage)
    logger.error(err)
  } finally {
    savingUserRoles.value = false
  }
}


const handleDeleteUser = async (user: PermissionUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.username}" 吗？此操作不可撤销。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )

    const response = await unifiedApi.delete(`/users/${user.id}`)

    if (response.success) {
      success('用户删除成功')
      await loadUsers()
      await loadStats()
    } else {
      error(response.message || '删除用户失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      const errorMessage = err.response?.data?.message || err.message || '删除用户失败'
      error(errorMessage)
      logger.error(err)
    }
  }
}


const closeUserRoleDialog = () => {
  userRoleDialogVisible.value = false
  currentUser.value = null
  selectedUserRoleIds.value = []
  roleSearchQuery.value = ''
}

const refreshLogs = async () => {
  await loadLogs()
}

const escapeCsvValue = (value: unknown) => {
  const normalized = value === null || value === undefined ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return `"${escaped}"`
}

const buildCsvContent = (headers: string[], rows: Array<Array<unknown>>) => {
  const headerLine = headers.map((item) => escapeCsvValue(item)).join(',')
  const rowLines = rows.map((row) => row.map((item) => escapeCsvValue(item)).join(','))
  return [headerLine, ...rowLines].join('\n')
}

const exportLogs = async () => {
  try {
    exportingLogs.value = true

    const exportSize = Math.max(logsPagination.total || 0, logsPagination.page_size || 10, 1000)
    const response = await unifiedApi.get('/permission-logs/logs', {
      params: {
        page: 1,
        page_size: exportSize,
        action: logSearchForm.action || undefined,
        username: logSearchForm.username || undefined,
        start_date: logSearchForm.dateRange[0] || undefined,
        end_date: logSearchForm.dateRange[1]
          ? `${logSearchForm.dateRange[1]} 23:59:59`
          : undefined
      }
    })

    if (!response.success) {
      throw new Error(response.message || '获取权限日志失败')
    }

    const exportLogsList: PermissionLog[] = response.data?.logs || []

    if (exportLogsList.length === 0) {
      warning('当前筛选条件下没有可导出的日志')
      return
    }

    const csvContent = buildCsvContent(
      ['ID', '用户名', '操作类型', '操作说明', '详细记录', 'IP地址', '状态', '创建时间'],
      exportLogsList.map((log) => ([
        log.id,
        log.username,
        getActionName(log.action),
        log.description,
        typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
        log.ip_address,
        log.status === 'success' ? '成功' : '失败',
        log.created_at
      ]))
    )

    await exportTextFile({
      content: csvContent,
      filename: buildDateFilename('权限操作日志', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      loading: exportingLogs,
      successMessage: '权限日志导出成功',
      errorMessage: '权限日志导出失败'
    })
  } catch (err) {
    handleApiError(err, '权限日志导出失败')
  } finally {
    exportingLogs.value = false
  }
}

const searchLogs = () => {
  logsPagination.page = 1
  void loadLogs()
}

// 角色分页变化处理
const handleRolesPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(rolesPagination, page, pageSize, () => loadRoles(false, false))

// 用户分页变化处理
const handleUsersPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(usersPagination, page, pageSize, () => loadUsers(false, false))

// 日志分页变化处理
const handleLogsPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(logsPagination, page, pageSize, loadLogs)

const resetLogSearch = () => {
  logSearchForm.action = ''
  logSearchForm.username = ''
  logSearchForm.dateRange = []
  logsPagination.page = 1
  void loadLogs()
}

const loadLogs = async () => {
  try {
    logsLoading.value = true

    // 从真实 API 获取日志数据
    const response = await unifiedApi.get('/permission-logs/logs', {
      params: {
        page: logsPagination.page,
        page_size: logsPagination.page_size,
        action: logSearchForm.action || undefined,
        username: logSearchForm.username || undefined,
        start_date: logSearchForm.dateRange[0] || undefined,
        end_date: logSearchForm.dateRange[1]
          ? `${logSearchForm.dateRange[1]} 23:59:59`
          : undefined
      }
    })

    if (response.success && response.data) {
      logsData.value = response.data.logs || []
      logsPagination.total = Number(response.data.pagination?.total) || 0
    } else {
      logsData.value = []
      logsPagination.total = 0
    }
  } catch (err) {
    error('加载日志数据失败')
    logger.error('加载权限日志失败:', err)
    logsData.value = []
    logsPagination.total = 0
    logsPagination.page = 1
  } finally {
    logsLoading.value = false
  }
}

const getActionTypeClass = (action: string) => getActionMeta(action).className
const getActionIcon = (action: string) => getActionMeta(action).icon
const getActionName = (action: string) => getActionMeta(action).name

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return ''

  try {
    // 创建日期对象
    const date = new Date(dateString)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期'
    }

    // 转换为中国时区时间
    const chinaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60 * 1000))

    // 格式化日期时间
    const year = chinaTime.getFullYear()
    const month = String(chinaTime.getMonth() + 1).padStart(2, '0')
    const day = String(chinaTime.getDate()).padStart(2, '0')
    const hours = String(chinaTime.getHours()).padStart(2, '0')
    const minutes = String(chinaTime.getMinutes()).padStart(2, '0')
    const seconds = String(chinaTime.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (err) {
    logger.error('日期格式化错误:', { err, dateString })
    return '格式错误'
  }
}

const getDefaultIcon = (moduleKey: string, category?: string): string => {
  // 根据模块key或类别返回默认图标
  if (moduleKey.includes('dashboard')) return 'fas fa-tachometer-alt'
  if (moduleKey.includes('inventory') || moduleKey.includes('stock')) return 'fas fa-warehouse'
  if (moduleKey.includes('sales') || moduleKey.includes('phone')) return 'fas fa-shopping-cart'
  if (moduleKey.includes('customer')) return 'fas fa-users'
  if (moduleKey.includes('supplier')) return 'fas fa-truck'
  if (moduleKey.includes('employee')) return 'fas fa-user-tie'
  if (moduleKey.includes('permission') || moduleKey.includes('role')) return 'fas fa-shield-alt'
  if (moduleKey.includes('menu')) return 'fas fa-bars'
  if (moduleKey.includes('brand') || moduleKey.includes('model')) return 'fas fa-tag'
  if (moduleKey.includes('color')) return 'fas fa-palette'
  if (moduleKey.includes('memory')) return 'fas fa-memory'
  if (moduleKey.includes('store')) return 'fas fa-store'
  if (moduleKey.includes('rental')) return 'fas fa-handshake'
  if (moduleKey.includes('repair')) return 'fas fa-tools'
  if (moduleKey.includes('analytics')) return 'fas fa-chart-bar'
  if (moduleKey.includes('query') || moduleKey.includes('search')) return 'fas fa-search'
  if (moduleKey.includes('accessories')) return 'fas fa-box-open'
  if (moduleKey.includes('demo')) return 'fas fa-flask'

  // 根据类别返回图标
  if (category === 'system') return 'fas fa-cogs'
  if (category === 'business') return 'fas fa-briefcase'
  if (category === 'custom') return 'fas fa-cube'

  // 默认图标
  return 'fas fa-cube'
}

// 字段权限相关方法
const closeFieldPermissionDialog = () => {
  showFieldPermissionDialog.value = false
  selectedModule.value = null
  fieldGroups.value = []
  selectedFields.value = []
}

const saveFieldPermissions = async () => {
  if (savingFieldPermissions.value) return

  if (!selectedModule.value || !selectedRoleId.value) {
    error('缺少必要信息')
    return
  }

  try {
    savingFieldPermissions.value = true

    // 标准化 module key - 与加载逻辑保持一致
    let normalizedModuleKey = selectedModule.value.module_key

    // 去掉视图后缀（如 subsidy_subsidyview -> subsidy）
    // 但保留 query_queryview 这种格式
    if (normalizedModuleKey.includes('_') && !normalizedModuleKey.endsWith('view')) {
      const parts = normalizedModuleKey.split('_')
      if (parts.length >= 2) {
        normalizedModuleKey = parts.slice(0, -1).join('_')
      }
    } else if (normalizedModuleKey.endsWith('_view') || normalizedModuleKey.endsWith('View')) {
      normalizedModuleKey = normalizedModuleKey.replace(/_view$/, '').replace(/View$/, '')
    }

    // 计算隐藏的字段（被选中的字段）
    const hiddenFieldKeys = selectedFields.value

    // 构建字段权限配置数据 - 直接使用完整的字段 ID（与综合查询一致）
    const fieldConfig = {
      hidden_fields: hiddenFieldKeys
    }

    // 调用真实的API，使用标准化的 module key
    const response = await unifiedApi.post(`/permissions/field-permissions/${selectedRoleId.value}`, {
      module_key: normalizedModuleKey,
      field_config: fieldConfig
    })

    if (response.success) {
      success('字段权限配置保存成功')

      // 1. 同步更新本地显示状态：重新加载当前角色的字段权限配置
      if (selectedModule.value) {
        await loadRoleFieldPermissions(normalizedModuleKey)
      }

      // 2. 清除前端 API 缓存
      if (window.__TF2025_CACHE__) {
        window.__TF2025_CACHE__.clear()
      }

      // 3. 刷新全局字段权限（等待完成以确保权限数据已更新）
      await fieldPermissions.fetchUserFieldPermissions()

      // 4. 触发自定义事件，通知其他组件刷新
      window.dispatchEvent(new CustomEvent('tf2025:permissions:updated', {
        detail: {
          module_key: normalizedModuleKey,
          role_id: selectedRoleId.value,
          field_config: fieldConfig
        }
      }))

      closeFieldPermissionDialog()

    } else {
      throw new Error(response.message || '保存失败')
    }

  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '保存字段权限配置失败'
    error(errorMessage)
    logger.error('❌ 保存字段权限配置失败:', err)
    logger.error('  错误详情:', err.response?.data)
  } finally {
    savingFieldPermissions.value = false
  }
}

// 获取模块字段定义
const getFieldDefinitionsForModule = async (moduleKey: string) => {
  try {
    // 处理模块key映射 - 移除可能的前端视图后缀
    let normalizedModuleKey = moduleKey
    if (moduleKey.includes('_')) {
      // 如果包含下划线，可能是后端模块格式，提取基础模块名
      const parts = moduleKey.split('_')
      if (parts.length >= 2) {
        normalizedModuleKey = parts.slice(0, -1).join('_')
      }
    }

    const cachedFieldDefinitions = fieldDefinitionsCache.get(normalizedModuleKey)
    if (cachedFieldDefinitions) {
      return cachedFieldDefinitions
    }

    // 从moduleFields.js中获取字段定义
    const moduleFieldGroups = getModuleFieldGroups(normalizedModuleKey)

    if (!moduleFieldGroups || moduleFieldGroups.length === 0) {
      return []
    }

    // 转换字段格式以适配前端UI
    const formattedFieldGroups = moduleFieldGroups.map(group => ({
      name: group.name,
      sensitivity: group.sensitivity || 'public',
      fields: group.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required || false,
        description: field.description || '',
        sensitivity: field.sensitivity,
        currency: field.currency || null,
        options: field.options || null
      }))
    }))
    fieldDefinitionsCache.set(normalizedModuleKey, formattedFieldGroups)
    return formattedFieldGroups
  } catch (err) {
    logger.error(`获取模块 ${moduleKey} 字段定义失败:`, err)
    return []
  }
}

// 辅助方法
const getSensitivityLabel = (sensitivity: string) => {
  const labels: Record<string, string> = {
    'public': '公开',
    'internal': '内部',
    'confidential': '机密'
  }
  return labels[sensitivity] || sensitivity
}

const getFieldTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'string': '文本',
    'number': '数字',
    'date': '日期',
    'enum': '枚举',
    'boolean': '布尔',
    'object': '对象',
    'percentage': '百分比'
  }
  return labels[type] || type
}

// 检查字段是否为敏感字段
const isFieldSensitive = (field: any) => {
  return field.sensitivity === 'sensitive' || field.sensitivity === 'confidential'
}

// 强制刷新权限矩阵
// ========== 门店绑定相关方法 ==========

// 加载门店列表
const loadStoreList = async () => {
  try {
    const response = await unifiedApi.get('/stores', { params: { all: true } })
    if (response.success) {
      storeList.value = sortOptionsByOrder(response.data || [])
    }
  } catch (err) {
    logger.error('加载门店列表失败:', err)
  }
}

// 加载员工门店绑定数据
const loadStoreBindings = async () => {
  storeBindingsLoading.value = true
  try {
    // 使用带角色信息的用户列表API（与角色分配使用相同的API）
    const response = await unifiedApi.get('/permissions/users-with-roles', {
      params: { page_size: 10000 }  // 获取所有用户
    })

    if (response.success && response.data?.users) {
      // 为每个用户获取完整的门店关联信息
      const usersWithStores = await Promise.all(
        response.data.users.map(async (user: any) => {
          try {
            // 调用 user-stores API 获取用户的所有门店
            const storesResponse = await unifiedApi.get(`/user-stores/user/${user.id}`)
            // 将 full_name 映射为 name 字段以保持一致性
            return {
              ...user,
              name: user.full_name || user.name,
              stores: storesResponse.data || []
            }
          } catch (err) {
            logger.error(`获取用户 ${user.username} 门店信息失败:`, err)
            return {
              ...user,
              name: user.full_name || user.name,
              stores: []
            }
          }
        })
      )
      storeBindingsData.value = usersWithStores
      storeBindingsPagination.total = usersWithStores.length
    } else {
      storeBindingsData.value = []
      storeBindingsPagination.total = 0
    }
  } catch (err) {
    logger.error('加载员工门店绑定数据失败:', err)
    error('加载员工门店绑定数据失败')
    storeBindingsData.value = []
    storeBindingsPagination.total = 0
  } finally {
    storeBindingsLoading.value = false
  }
}

// 过滤后的门店绑定数据
const filteredStoreBindings = computed(() => {
  let filtered = [...storeBindingsData.value]

  // 按姓名筛选
  if (storeBindingSearchForm.user_name) {
    const keyword = storeBindingSearchForm.user_name.toLowerCase()
    filtered = filtered.filter((user: any) =>
      (user.name && user.name.toLowerCase().includes(keyword)) ||
      (user.username && user.username.toLowerCase().includes(keyword))
    )
  }

  // 按门店筛选（检查用户是否关联该门店）
  if (storeBindingSearchForm.store_id) {
    const storeId = parseInt(storeBindingSearchForm.store_id)
    filtered = filtered.filter((user: any) =>
      user.stores && user.stores.some((s: any) => s.store_id === storeId)
    )
  }

  // 按绑定状态筛选
  if (storeBindingSearchForm.has_store === 'true') {
    filtered = filtered.filter((user: any) => user.stores && user.stores.length > 0)
  } else if (storeBindingSearchForm.has_store === 'false') {
    filtered = filtered.filter((user: any) => !user.stores || user.stores.length === 0)
  }

  return filtered
})

// 分页后的门店绑定数据
const paginatedStoreBindings = computed(() => {
  const start = (storeBindingsPagination.page - 1) * storeBindingsPagination.page_size
  const end = start + storeBindingsPagination.page_size
  return filteredStoreBindings.value.slice(start, end)
})

// 搜索门店绑定
const searchStoreBindings = () => {
  storeBindingsPagination.page = 1
}

// 重置门店绑定搜索
const resetStoreBindingSearch = () => {
  storeBindingSearchForm.user_name = ''
  storeBindingSearchForm.store_id = ''
  storeBindingSearchForm.has_store = ''
  storeBindingsPagination.page = 1
}

// 打开门店绑定对话框
const openStoreBindingDialog = (user: any) => {
  currentUserForBinding.value = { ...user }
  // 初始化已选中的门店ID
  selectedStoreIds.value = user.stores?.map((s: any) => s.store_id) || []
  storeBindingDialogVisible.value = true
}

// 关闭门店绑定对话框
const closeStoreBindingDialog = () => {
  storeBindingDialogVisible.value = false
  currentUserForBinding.value = null
  selectedStoreIds.value = []
}

// 保存门店绑定（支持多门店）
const saveStoreBinding = async () => {
  if (savingStoreBinding.value) return

  if (!currentUserForBinding.value || selectedStoreIds.value.length === 0) {
    error('请选择至少一个门店')
    return
  }

  savingStoreBinding.value = true
  try {
    // 由后端一次性替换门店关系，确保一次保存只生成一条完整审计日志。
    await unifiedApi.post('/user-stores/assign', {
      user_id: currentUserForBinding.value.id,
      store_ids: selectedStoreIds.value,
      is_primary: true,
      replace_existing: true
    })

    success('门店绑定成功')
    closeStoreBindingDialog()
    await loadStoreBindings()
  } catch (err) {
    logger.error('保存门店绑定失败:', err)
    handleApiError(err, '保存门店绑定失败')
  } finally {
    savingStoreBinding.value = false
  }
}

// 解绑所有门店
const unbindStore = async (user: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要解绑用户 "${user.username}" 的所有门店吗？解绑后该用户将可以查看所有门店的数据。`,
      '解绑确认',
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

  savingStoreBinding.value = true
  try {
    await unifiedApi.delete(`/user-stores/user/${user.id}/all`)

    success('门店解绑成功')
    await loadStoreBindings()
  } catch (err) {
    logger.error('解绑门店失败:', err)
    error('解绑门店失败')
  } finally {
    savingStoreBinding.value = false
  }
}

// 门店绑定分页处理
const handleStoreBindingsPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(storeBindingsPagination, page, pageSize)

Object.assign(permissionsPageContext, {
  activeTab,
  canCreate,
  canEdit,
  canDelete,
  canViewPermissionsField,
  showPermissionsActionField,
  stats,
  rolesLoading,
  rolesData,
  rolesPagination,
  roleSearchForm,
  roleSearchExpanded,
  filteredRoles,
  paginatedRoles,
  toggleRoleSearch,
  searchRoles,
  resetRoleSearch,
  handleCreateRole,
  handleEditRole,
  handleAssignPermissions,
  handleRoleFieldPermissions,
  handleDeleteRole,
  toggleRoleStatus,
  handleRolesPaginationChange,
  usersLoading,
  usersData,
  usersPagination,
  userSearchForm,
  userSearchExpanded,
  filteredUsers,
  paginatedUsers,
  toggleUserSearch,
  searchUsers,
  resetUserSearch,
  handleEditUserRoles,
  handleDeleteUser,
  handleUsersPaginationChange,
  storeBindingsLoading,
  storeBindingsPagination,
  storeBindingSearchForm,
  storeBindingSearchExpanded,
  filteredStoreBindings,
  paginatedStoreBindings,
  storeList,
  toggleStoreBindingSearch,
  searchStoreBindings,
  resetStoreBindingSearch,
  openStoreBindingDialog,
  unbindStore,
  handleStoreBindingsPaginationChange,
  logsLoading,
  logsPagination,
  logSearchForm,
  logSearchExpanded,
  filteredLogs,
  paginatedLogs,
  refreshLogs,
  exportLogs,
  toggleLogSearch,
  searchLogs,
  resetLogSearch,
  handleLogsPaginationChange,
  selectedRoleForPermission,
  permissionDialogMatrix,
  savingDialogPermissions,
  loadingPermissionDialog,
  loadPermissionDialog,
  closePermissionDialog,
  selectAllDialogPermissions,
  toggleAllDialogMenuPermissions,
  handleDialogPermissionChange,
  handleDialogMenuPermissionChange,
  isDialogPermissionSelected,
  isDialogMenuPermissionSelected,
  getPermissionIcon,
  getPermissionNameEnhanced,
  formatDate,
  getUserRoleNames,
  getRoleTagClass,
  getActionTypeClass,
  getActionIcon,
  getActionName
})

// 优化：监听标签页切换，按需加载数据
watch(activeTab, async (newTab) => {
  if (newTab === 'modules' && !canViewModuleManagement.value) {
    activeTab.value = 'roles'
    return
  }

  // 只在数据为空时加载（首次访问）
  if (newTab === 'roles' && rolesData.value.length === 0) {
    await loadRoles(false, false)
  }

  if (newTab === 'userRoles' && usersData.value.length === 0) {
    await loadUsers(false, false)
  }

  if (newTab === 'logs' && logsData.value.length === 0) {
    await loadLogs()
  }

  if (newTab === 'storeBindings' && storeList.value.length === 0) {
    await Promise.all([loadStoreList(), loadStoreBindings()])
  }

  if (newTab === 'modules' && permissionMatrix.value.length === 0 && selectedRoleId.value) {
    await loadPermissionMatrix()
  }

  if (
    newTab === 'pagePermissions' &&
    selectedRoleForPermission.value &&
    permissionDialogMatrix.value.length === 0 &&
    !loadingPermissionDialog.value
  ) {
    await loadPermissionDialog()
  }
})

// ========== 门店绑定相关方法结束 ==========

// 页面加载时获取数据（按需加载优化）
onMounted(async () => {
  await fieldPermissions.init()

  // 🚀 优化：加载基础统计数据 + 当前标签页的数据
  await Promise.all([
    loadStats(),
    loadUnregisteredModules()
  ])

  // 默认加载第一个标签页（角色管理）的数据
  await loadRoles(false, false)
})

// 监听角色选择变化
watch(selectedRoleId, async (newRoleId) => {
  if (newRoleId) {
    // 清除旧状态
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
    permissionMatrix.value = []
    // 加载新角色的权限
    await loadPermissionMatrix()
  } else {
    // 清除所有状态
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
    permissionMatrix.value = []
  }
})

// 页面激活时只在必要时重新加载数据
onActivated(() => {
  // 只在实际需要时才重新加载
  // 如果当前有选中的角色，且权限矩阵为空，才重新加载
  if (selectedRoleId.value && permissionMatrix.value.length === 0 && !loading.value) {
    loadPermissionMatrix()
  }

  if (
    activeTab.value === 'pagePermissions' &&
    selectedRoleForPermission.value &&
    permissionDialogMatrix.value.length === 0 &&
    !loadingPermissionDialog.value
  ) {
    loadPermissionDialog()
  }
})
</script>

<style src="./styles/permissions-view.css"></style>
