/**
 * 页面权限管理组合式函数
 * 统一管理页面权限检查逻辑
 * 权限命名规则：canonical 模块名:操作
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { PermissionMapper } from '@/utils/permissionMapper'

const MODULE_ALIASES: Record<string, string> = {
  employees: 'employee',
  menu: 'menus',
  settings: 'system',
  returngoods: 'return-goods',
  'sales-phone': 'sales',
  'data-optimization': 'data-check',
  'module-management': 'permissions',
  'h5-admin-templates': 'h5-templates',
  'h5-admin-config': 'h5-config',
  'h5-admin-home-sections': 'home-sections',
  'h5-admin-banners': 'h5-banners',
  'h5-admin-orders': 'h5-orders'
}

const SPECIAL_PERMISSION_MAP: Record<string, string> = {
  'module-management': 'permissions:admin'
}

export const usePagePermissions = (module: string) => {
  const authStore = useAuthStore()
  const router = useRouter()

  const getCanonicalModuleName = (moduleName: string): string => {
    return MODULE_ALIASES[moduleName] || PermissionMapper.normalizeModuleKey(moduleName)
  }

  // 获取统一权限名称
  const getPermissionName = (moduleName: string, action: string): string => {
    if (SPECIAL_PERMISSION_MAP[moduleName]) {
      return SPECIAL_PERMISSION_MAP[moduleName]
    }

    const canonicalModule = getCanonicalModuleName(moduleName)
    return `${canonicalModule}:${action}`
  }

  // 检查指定权限（统一使用 canonical 权限）
  const hasPermission = (action: string): boolean => {
    const permission = getPermissionName(module, action)
    return authStore.hasPermission(permission)
  }

  // 支持直接检查完整权限名
  const hasFullPermission = (permission: string): boolean => {
    return authStore.hasPermission(permission)
  }

  // 统一的无查看权限处理
  const handleNoViewPermission = () => {
    ElMessage.warning({
      message: '您没有访问此页面的权限，请联系有权限的角色维护人员开通相应权限',
      duration: 3000,
      showClose: true
    })

    // 可以选择返回上一页或跳转到首页
    setTimeout(() => {
      if (window.history.length > 1) {
        router.back()
      } else {
        router.push('/dashboard')
      }
    }, 1500)
  }

  // 统一的无操作权限处理
  const handleNoPermission = (action: string) => {
    const actionNames = {
      create: '创建',
      'return-to-stock': '退库',
      wholesale: '调货',
      'proxy-transfer': '划拨',
      edit: '编辑',
      delete: '删除',
      export: '导出',
      import: '导入',
      approve: '审批',
      manage: '管理'
    }

    const actionName = actionNames[action] || action

    ElMessage.warning({
      message: `您没有${actionName}权限，请联系有权限的角色维护人员开通相应权限`,
      duration: 2000,
      showClose: true
    })
  }

  // 常用权限检查方法
  const canView = computed(() => hasPermission('view'))
  const canCreate = computed(() => hasPermission('create'))
  const canEdit = computed(() => hasPermission('edit'))
  const canUpdate = computed(() => hasPermission('update')) // edit的别名
  const canDelete = computed(() => hasPermission('delete'))
  const canExport = computed(() => hasPermission('export'))
  const canImport = computed(() => hasPermission('import'))
  const canApprove = computed(() => hasPermission('approve'))
  const canManage = computed(() => hasPermission('manage'))

  // 检查多个权限中是否有任意一个
  const hasAnyPermission = (actions: string[]): boolean => {
    return actions.some(action => hasPermission(action))
  }

  // 检查是否拥有所有指定权限
  const hasAllPermissions = (actions: string[]): boolean => {
    return actions.every(action => hasPermission(action))
  }

  // 权限检查包装器（带无权限提示）
  const requirePermission = (action: string, callback?: () => void) => {
    if (hasPermission(action)) {
      if (callback) callback()
      return true
    } else {
      handleNoPermission(action)
      return false
    }
  }

  // 查看权限检查包装器（带无权限跳转）
  const requireViewPermission = () => {
    if (!canView.value) {
      handleNoViewPermission()
      return false
    }
    return true
  }

  // 获取模块的统一权限前缀
  const getPermissionModulePrefix = (): string => {
    if (SPECIAL_PERMISSION_MAP[module]) {
      return SPECIAL_PERMISSION_MAP[module]
    }

    return getCanonicalModuleName(module)
  }

  // 获取用户在当前模块的所有权限
  const getModulePermissions = (): string[] => {
    const permissionModule = getPermissionModulePrefix()
    const userPerms = authStore.userPermissions
    return userPerms
      .map((perm: string) => PermissionMapper.normalizePermission(perm))
      .filter((perm: string) => (
        permissionModule.includes(':')
          ? perm === permissionModule
          : perm.startsWith(`${permissionModule}:`)
      ))
  }

  return {
    // 权限检查方法
    hasPermission,
    hasFullPermission,
    hasAnyPermission,
    hasAllPermissions,

    // 权限包装器
    requirePermission,
    requireViewPermission,

    // 工具方法
    getPermissionName,
    getCanonicalModuleName,
    getPermissionModulePrefix,
    getModulePermissions,
    handleNoPermission,
    handleNoViewPermission,

    // 权限状态（计算属性）
    canView,
    canCreate,
    canEdit,
    canUpdate,
    canDelete,
    canExport,
    canImport,
    canApprove,
    canManage
  }
}

// 权限类型定义
export interface PermissionConfig {
  module: string
  permissions: {
    view?: boolean
    create?: boolean
    edit?: boolean
    update?: boolean
    delete?: boolean
    export?: boolean
    import?: boolean
    approve?: boolean
    manage?: boolean
  }
}

// 批量权限检查
export const useBatchPermissions = (configs: PermissionConfig[]) => {
  const authStore = useAuthStore()

  const results = configs.map(config => {
    const modulePermissions = usePagePermissions(config.module)

    return {
      module: config.module,
      permissions: {
        view: config.permissions.view ? modulePermissions.canView.value : true,
        create: config.permissions.create ? modulePermissions.canCreate.value : true,
        edit: config.permissions.edit ? modulePermissions.canEdit.value : true,
        update: config.permissions.update ? modulePermissions.canUpdate.value : true,
        delete: config.permissions.delete ? modulePermissions.canDelete.value : true,
        export: config.permissions.export ? modulePermissions.canExport.value : true,
        import: config.permissions.import ? modulePermissions.canImport.value : true,
        approve: config.permissions.approve ? modulePermissions.canApprove.value : true,
        manage: config.permissions.manage ? modulePermissions.canManage.value : true
      }
    }
  })

  return {
    results,
    hasAnyModuleAccess: results.some(result =>
      Object.values(result.permissions).some(permission => permission)
    )
  }
}
