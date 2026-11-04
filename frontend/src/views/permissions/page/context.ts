import { inject } from 'vue'
import type { PermissionLog } from '@/types/system'
import type {
  Module,
  PermissionRole as Role,
  PermissionUser as User,
  StatsPayload,
  StoreBindingUser,
  StoreOption
} from '../types'

export const permissionsPageContextKey = Symbol('permissions-page-context')

interface PaginationState {
  page: number
  page_size: number
  total: number
}

export interface PermissionsPageContext {
  activeTab: string
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canViewPermissionsField: (fieldKey: string) => boolean
  showPermissionsActionField: boolean
  stats: StatsPayload
  rolesLoading: boolean
  rolesData: Role[]
  roleOptions: Role[]
  rolesPagination: PaginationState
  roleSearchForm: { name: string }
  roleSearchExpanded: boolean
  filteredRoles: Role[]
  paginatedRoles: Role[]
  toggleRoleSearch: () => void
  searchRoles: () => void
  resetRoleSearch: () => void
  handleCreateRole: () => void
  handleEditRole: (role: Role) => void
  handleAssignPermissions: (role: Role) => void
  handleRoleFieldPermissions: (role: Role) => void
  handleDeleteRole: (role: Role) => void | Promise<void>
  toggleRoleStatus: (role: Role) => void | Promise<void>
  handleRolesPaginationChange: (page: number, pageSize: number) => void | Promise<void>
  usersLoading: boolean
  usersData: User[]
  usersPagination: PaginationState
  userSearchForm: { username: string; role_id: string | number }
  userSearchExpanded: boolean
  filteredUsers: User[]
  paginatedUsers: User[]
  toggleUserSearch: () => void
  searchUsers: () => void
  resetUserSearch: () => void
  handleEditUserRoles: (user: User) => void
  handleDeleteUser: (user: User) => void | Promise<void>
  handleUsersPaginationChange: (page: number, pageSize: number) => void | Promise<void>
  storeBindingsLoading: boolean
  storeBindingsPagination: PaginationState
  storeBindingSearchForm: { user_name: string; store_id: string | number; has_store: string }
  storeBindingSearchExpanded: boolean
  filteredStoreBindings: StoreBindingUser[]
  paginatedStoreBindings: StoreBindingUser[]
  storeList: StoreOption[]
  toggleStoreBindingSearch: () => void
  searchStoreBindings: () => void
  resetStoreBindingSearch: () => void
  openStoreBindingDialog: (user: StoreBindingUser) => void
  unbindStore: (user: StoreBindingUser) => void | Promise<void>
  handleStoreBindingsPaginationChange: (page: number, pageSize: number) => void | Promise<void>
  logsLoading: boolean
  logsPagination: PaginationState
  logSearchForm: { action: string; username: string; dateRange: [string, string] | [] }
  logSearchExpanded: boolean
  filteredLogs: PermissionLog[]
  paginatedLogs: PermissionLog[]
  refreshLogs: () => void | Promise<void>
  exportLogs: () => void | Promise<void>
  toggleLogSearch: () => void
  searchLogs: () => void
  resetLogSearch: () => void
  handleLogsPaginationChange: (page: number, pageSize: number) => void | Promise<void>
  selectedRoleForPermission: Role | null
  permissionDialogMatrix: Module[]
  savingDialogPermissions: boolean
  dialogBulkPermissionType: string
  dialogActionPermissionTypes: string[]
  toggleDialogActionAcrossModules: (permissionType: string, enabled: boolean) => void | Promise<void>
  loadingPermissionDialog: boolean
  loadPermissionDialog: () => void | Promise<void>
  closePermissionDialog: (nextTab?: string) => void | Promise<unknown>
  selectAllDialogPermissions: (select?: boolean) => void | Promise<void>
  toggleAllDialogMenuPermissions: (show?: boolean) => void | Promise<void>
  handleDialogPermissionChange: (moduleKey: string, permissionType: string, checked: boolean) => void | Promise<void>
  handleDialogMenuPermissionChange: (moduleKey: string, checked: boolean) => void | Promise<void>
  isDialogPermissionSelected: (moduleKey: string, permissionType: string) => boolean
  isDialogMenuPermissionSelected: (moduleKey: string) => boolean
  getPermissionIcon: (permissionType: string) => string
  getPermissionNameEnhanced: (permissionType: string) => string
  formatDate: (value: string | null | undefined) => string
  getUserRoleNames: (roles: string | Role[] | null | undefined) => string[]
  getRoleTagClass: (roleName: string) => string
  getActionTypeClass: (action: string) => string
  getActionIcon: (action: string) => string
  getActionName: (action: string) => string
}

export function usePermissionsPageContext(): PermissionsPageContext {
  const context = inject<PermissionsPageContext>(permissionsPageContextKey)

  if (!context) {
    throw new Error('权限页面上下文未提供')
  }

  return context
}
