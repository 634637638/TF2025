/**
 * 统一权限映射系统 - TypeScript版本
 * 解决前后端权限格式不一致问题
 *
 * 功能特性：
 * - 标准化模块权限映射
 * - 前后端权限格式转换
 * - 权限继承和层级管理
 * - 模块权限自动解析
 */

/**
 * 模块权限配置接口
 */
export interface ModulePermissionConfig {
  name: string
  permissions: Record<string, string>
}

/**
 * 前端模块到后端模块的映射表
 * 解决前端简短模块名与后端完整模块名不一致的问题
 */
export const MODULE_KEY_MAP: Record<string, string> = {
  // 仪表盘映射
  'dashboard': 'dashboard_dashboardview',

  // 库存管理映射
  'inventory': 'inventory_inventoryview',
  'stock-in': 'inventory_stockinpage',

  // 销售管理映射
  'sales': 'sales_salesview',
  'sale': 'sales_salesview',
  'phone-sale': 'sales_phonesaleview',
  'phone-edit': 'sales_editphoneview',
  'sales-edit': 'sales_editphoneview',
  'sales-editphoneview': 'sales_editphoneview',

  // 供应商管理映射
  'suppliers': 'suppliers_suppliersview',
  'supplier': 'suppliers_suppliermanagementview',

  // 用户管理映射
  'users': 'users_usersview',

  // 员工管理映射
  'employee': 'employees_employeesview',
  'employees': 'employees_employeesview',

  // 品牌管理映射
  'brands': 'brands_brandsview',

  // 型号管理映射
  'models': 'models_modelsview',

  // 颜色管理映射
  'colors': 'colors_colorsview',

  // 内存管理映射
  'memories': 'memories_memoriesview',

  // 店铺管理映射
  'stores': 'stores_storesview',

  // 手机管理映射
  'phones': 'phones_phonesview',

  // 客户管理映射
  'customers': 'customers_customersview',

  // 权限管理映射
  'permissions': 'permissions_permissionsview',
  'module-management': 'permissions_modulemanagementview',

  // 菜单管理映射
  'menu': 'menu_menumanagementview',
  'menus': 'menu_menumanagementview',

  // 综合查询映射
  'query': 'query_queryview',

  // 配件管理映射
  'accessories': 'accessories_accessoriesview',

  // 考勤管理映射
  'attendance': 'attendance_attendanceview',
  'my-attendance': 'attendance_myattendanceview',

  // 国补管理映射
  'subsidy': 'subsidy_subsidyview',

  // 系统管理映射
  'system': 'system_systemview',
  'settings': 'system_systemview',
  'admin': 'system_adminview',
  '404': 'system_404',
  'git-management': 'system_gitmanagement',
  'data-optimization': 'data_optimization_dataoptimizationview',
  'data-check': 'data_optimization_dataoptimizationview',

  // 演示模块映射
  'demo': 'demo_icondemo',
  'icon-demo': 'demo_icondemo',

  // 核心搜索映射
  'search': 'core_searchview',

  // 数据分析映射
  'analytics': 'analytics_analyticsview',

  // 租赁管理映射
  'rentals': 'rentals_rentalsview',

  // 维修管理映射
  'repairs': 'repairs_repairsview',

  // 工资管理映射
  'salary': 'salary_salaryview',
  'my-salary': 'salary_mysalaryview',
  'salary-templates': 'salary_salarytemplatesview',
  'salary-records': 'salary_salaryrecordsview',

  // 预定管理映射
  'preorders': 'preorders_preordersview',
  'preorder': 'preorders_preordersview',

  // 价目表映射
  'price-list': 'price_list_pricelistview',
  'price-list-sync-logs': 'price_list_synclogview',
  'pricelist': 'price_list_pricelistview',

  // 其他业务模块
  'supplier-payments': 'payments_supplierphonepaymentsview',
  'return-goods': 'system_returngoods',
  'returngoods': 'system_returngoods',
  'h5-admin': 'h5_admin_h5_adminview',
  'h5-templates': 'h5_admin_templatesview',
  'h5-admin-templates': 'h5_admin_templatesview',
  'h5-config': 'h5_admin_configview',
  'h5-admin-config': 'h5_admin_configview',
  'home-sections': 'h5_admin_homesectionsview',
  'h5-admin-home-sections': 'h5_admin_homesectionsview',
  'h5-banners': 'h5_admin_bannersview',
  'h5-admin-banners': 'h5_admin_bannersview',
  'h5-orders': 'h5_admin_ordersview',
  'h5-admin-orders': 'h5_admin_ordersview'
}

/**
 * 后端API期望的简单模块映射表
 * 将前端复杂权限转换为后端简单格式
 */
export const BACKEND_MODULE_MAP: Record<string, string> = {
  // 反向映射 - 前端完整模块名 -> 后端简单模块名
  'dashboard_dashboardview': 'dashboard',
  'inventory_inventoryview': 'inventory',
  'inventory_stockinpage': 'stock-in',
  'inventory_stock-in': 'stock-in',
  'stockin_stockinview': 'stock-in',
  'sales_salesview': 'sales',
  'sales_phonesaleview': 'sales',
  'sales_editphoneview': 'sales-editphoneview',
  'suppliers_suppliersview': 'suppliers',
  'suppliers_suppliermanagementview': 'suppliers',
  'users_usersview': 'users',
  'employees_employeesview': 'employee',
  'brands_brandsview': 'brands',
  'models_modelsview': 'models',
  'colors_colorsview': 'colors',
  'memories_memoriesview': 'memories',
  'stores_storesview': 'stores',
  'phones_phonesview': 'phones',
  'customers_customersview': 'customers',
  'permissions_permissionsview': 'permissions',
  'permissions_modulemanagementview': 'permissions',
  'menu_menumanagementview': 'menus',
  'query_queryview': 'query',
  'accessories_accessoriesview': 'accessories',
  'attendance_attendanceview': 'attendance',
  'attendance_myattendanceview': 'my-attendance',
  'system_systemview': 'system',
  'system_gitmanagement': 'git-management',
  'system_adminview': 'system',
  'data_optimization_dataoptimizationview': 'data-check',
  'demo_icondemo': 'demo',
  'core_searchview': 'search',
  'analytics_analyticsview': 'analytics',
  'reports_reportsview': 'reports',
  'backup_backupview': 'backup',
  'rentals_rentalsview': 'rentals',
  'repairs_repairsview': 'repairs',
  'subsidy_subsidyview': 'subsidy',
  'salary_salaryview': 'salary',
  'salary_salarytemplatesview': 'salary-templates',
  'salary_salaryrecordsview': 'salary-records',
  'salary_mysalaryview': 'my-salary',
  'preorders_preordersview': 'preorders',
  'payments_supplierphonepaymentsview': 'supplier-payments',
  'price_list_pricelistview': 'price-list',
  'price_list_synclogview': 'price-list-sync-logs',
  'system_returngoods': 'return-goods',
  'h5_admin_h5_adminview': 'h5-admin',
  'h5_admin_templatesview': 'h5-templates',
  'h5_admin_configview': 'h5-config',
  'h5_admin_homesectionsview': 'home-sections',
  'h5_admin_bannersview': 'h5-banners',
  'h5_admin_ordersview': 'h5-orders'
}

const EXACT_PERMISSION_ALIAS_MAP: Record<string, string> = {
  'my-attendance:view': 'attendance:view:own',
  'my-attendance:create': 'attendance:create',
  'my-salary:view': 'salary-records:view:own'
}

/**
 * 标准模块权限定义
 * 定义系统中所有模块的权限结构
 */
export const MODULE_PERMISSIONS: Record<string, ModulePermissionConfig> = {
  // 系统管理模块
  system: {
    name: '系统管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 用户管理模块
  users: {
    name: '用户管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 角色管理模块
  roles: {
    name: '角色管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 权限管理模块
  permissions: {
    name: '权限管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 库存管理模块
  inventory: {
    name: '库存管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 采购入库模块
  'stock-in': {
    name: '采购入库',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 销售管理模块
  sales: {
    name: '销售管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'sell': '销售',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 设备管理模块
  phones: {
    name: '设备管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 品牌管理模块
  brands: {
    name: '品牌管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 供应商管理模块
  suppliers: {
    name: '供应商管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 门店管理模块
  stores: {
    name: '门店管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 员工管理模块
  employees: {
    name: '员工管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 菜单管理模块
  menus: {
    name: '菜单管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 数据统计模块
  analytics: {
    name: '数据统计',
    permissions: {
      'view': '查看',
      'export': '导出',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 国补管理模块
  subsidy: {
    name: '国补管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'approve': '审批',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 考勤管理模块
  attendance: {
    name: '考勤管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'approve': '审批',
      'manage': '管理',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 工资管理模块
  salary: {
    name: '工资管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'approve': '审批',
      'manage': '管理',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 工资模板模块
  'salary-templates': {
    name: '工资模板',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'manage': '管理',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 工资记录模块
  'salary-records': {
    name: '工资记录',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'approve': '审批',
      'manage': '管理',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 数据优化模块
  'data-optimization': {
    name: '数据优化',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'import': '导入',
      'sync': '同步',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // Git 管理模块
  'git-management': {
    name: 'Git管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 价目表模块
  'price-list': {
    name: '价目表',
    permissions: {
      'view': '查看',
      'create': '新增',
      'edit': '编辑',
      'delete': '删除',
      'import': '导入',
      'export': '导出',
      'sync': '同步',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 同步日志模块
  'price-list-sync-logs': {
    name: '同步日志',
    permissions: {
      'view': '查看',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // 供应商打款模块
  'supplier-payments': {
    name: '供应商打款',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'approve': '审批',
      'export': '导出',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  // H5 商城后台模块
  'h5-admin': {
    name: 'H5商城管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑'
    }
  },

  'h5-admin-templates': {
    name: '商城模板',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除'
    }
  },

  'h5-admin-config': {
    name: '商城配置',
    permissions: {
      'view': '查看',
      'edit': '编辑'
    }
  },

  'h5-admin-home-sections': {
    name: '首页推荐',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除'
    }
  },

  'h5-admin-banners': {
    name: '轮播图管理',
    permissions: {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除'
    }
  },

  'h5-admin-orders': {
    name: '商城订单',
    permissions: {
      'view': '查看',
      'edit': '编辑'
    }
  }
}

/**
 * 权限映射工具类
 */
export class PermissionMapper {
  static parsePermission(permission: string): { module: string, action: string } | null {
    const separatorIndex = permission.indexOf(':')
    if (separatorIndex === -1) {
      return null
    }

    return {
      module: permission.slice(0, separatorIndex),
      action: permission.slice(separatorIndex + 1)
    }
  }

  static normalizeModuleKey(moduleKey: string): string {
    if (BACKEND_MODULE_MAP[moduleKey]) {
      return BACKEND_MODULE_MAP[moduleKey]
    }

    const mappedModuleKey = MODULE_KEY_MAP[moduleKey]
    if (mappedModuleKey && BACKEND_MODULE_MAP[mappedModuleKey]) {
      return BACKEND_MODULE_MAP[mappedModuleKey]
    }

    return moduleKey
  }

  /**
   * 将前端模块名称映射到后端模块名称
   * @param frontendModule 前端模块名称 (如: 'inventory')
   * @returns 后端模块名称 (如: 'inventory_inventoryview')
   */
  static mapModuleKey(frontendModule: string): string {
    return MODULE_KEY_MAP[frontendModule] || frontendModule
  }

  /**
   * 将前端简单权限转换为模块化权限
   * @param simplePermission 简单权限名称 (如: 'view', 'edit')
   * @param moduleKey 模块标识 (如: 'inventory', 'users')
   * @returns 模块化权限 (如: 'inventory:view', 'users:edit')
   */
  static toModulePermission(simplePermission: string, moduleKey: string): string {
    const normalizedModule = this.normalizeModuleKey(moduleKey)
    return `${normalizedModule}:${simplePermission}`
  }

  /**
   * 将前端复杂权限转换为后端API期望的简单格式
   * @param frontendPermission 前端权限 (如: 'customers:edit')
   * @returns 统一权限 (如: 'customers:edit')
   */
  static toBackendPermission(frontendPermission: string): string {
    return this.normalizePermission(frontendPermission)
  }

  /**
   * 从模块化权限中提取简单权限
   * @param modulePermission 模块化权限 (如: 'inventory:view')
   * @returns 简单权限名称 (如: 'view')
   */
  static toSimplePermission(modulePermission: string): string {
    const parsedPermission = this.parsePermission(modulePermission)
    return parsedPermission ? parsedPermission.action : modulePermission
  }

  /**
   * 从模块化权限中提取模块标识
   * @param modulePermission 模块化权限 (如: 'inventory:view')
   * @returns 模块标识 (如: 'inventory')
   */
  static extractModule(modulePermission: string): string {
    const parsedPermission = this.parsePermission(modulePermission)
    return parsedPermission ? parsedPermission.module : modulePermission
  }

  /**
   * 检查权限是否为模块化权限
   * @param permission 权限字符串
   * @returns 是否为模块化权限
   */
  static isModulePermission(permission: string): boolean {
    return permission.includes(':')
  }

  /**
   * 标准化权限格式为模块化权限
   * @param permission 权限字符串 (可以是简单或模块化格式)
   * @param defaultModule 默认模块标识
   * @returns 模块化权限
   */
  static normalizePermission(permission: string, defaultModule?: string): string {
    if (!permission) {
      return permission
    }

    if (this.isModulePermission(permission)) {
      const parsedPermission = this.parsePermission(permission)
      if (!parsedPermission) {
        return permission
      }

      const normalizedModule = this.normalizeModuleKey(parsedPermission.module)
      const normalizedPermission = `${normalizedModule}:${parsedPermission.action}`
      return EXACT_PERMISSION_ALIAS_MAP[normalizedPermission] || normalizedPermission
    }

    if (defaultModule) {
      return this.toModulePermission(permission, defaultModule)
    }

    // 如果没有默认模块，返回原权限
    return permission
  }

  /**
   * 获取权限的显示名称
   * @param permission 权限字符串
   * @returns 权限显示名称
   */
  static getPermissionDisplayName(permission: string): string {
    if (this.isModulePermission(permission)) {
      const module = this.extractModule(permission)
      const simplePermission = this.toSimplePermission(permission)
      const moduleConfig = MODULE_PERMISSIONS[module]

      if (moduleConfig?.permissions[simplePermission]) {
        return moduleConfig.permissions[simplePermission]
      }
    }

    // 尝试从所有模块中查找简单权限
    for (const moduleConfig of Object.values(MODULE_PERMISSIONS)) {
      if (moduleConfig.permissions[permission]) {
        return moduleConfig.permissions[permission]
      }
    }

    // 权限名称映射
    const nameMap: Record<string, string> = {
      'view': '查看',
      'create': '创建',
      'edit': '编辑',
      'delete': '删除',
      'export': '导出',
      'import': '导入',
      'sell': '销售',
      'admin:view': '管理查看',
      'admin:edit': '管理编辑',
      'all': '所有权限'
    }

    return nameMap[permission] || permission
  }

  /**
   * 获取模块的显示名称
   * @param moduleKey 模块标识
   * @returns 模块显示名称
   */
  static getModuleDisplayName(moduleKey: string): string {
    return MODULE_PERMISSIONS[moduleKey]?.name || moduleKey
  }

  /**
   * 获取模块的所有可用权限
   * @param moduleKey 模块标识
   * @returns 权限列表
   */
  static getModulePermissions(moduleKey: string): string[] {
    return Object.keys(MODULE_PERMISSIONS[moduleKey]?.permissions || {})
  }

  /**
   * 获取所有模块的权限列表
   * @returns 所有模块权限
   */
  static getAllModulePermissions(): Record<string, string[]> {
    const result: Record<string, string[]> = {}

    for (const [moduleKey, moduleConfig] of Object.entries(MODULE_PERMISSIONS)) {
      result[moduleKey] = Object.keys(moduleConfig.permissions)
    }

    return result
  }

  /**
   * 过滤用户权限，返回指定模块的权限
   * @param userPermissions 用户权限列表
   * @param moduleKey 模块标识
   * @returns 指定模块的权限列表
   */
  static filterModulePermissions(userPermissions: string[], moduleKey: string): string[] {
    return userPermissions
      .filter(perm => {
        if (this.isModulePermission(perm)) {
          return this.extractModule(perm) === moduleKey
        }
        // 对于简单权限，需要进一步判断
        return this.getModulePermissions(moduleKey).includes(perm)
      })
      .map(perm => {
        if (this.isModulePermission(perm)) {
          return this.toSimplePermission(perm)
        }
        return perm
      })
  }

  /**
   * 将用户权限转换为模块化格式
   * @param userPermissions 用户权限列表
   * @param currentModule 当前模块上下文
   * @returns 标准化的模块化权限列表
   */
  static normalizeUserPermissions(userPermissions: string[], currentModule?: string): string[] {
    return userPermissions.map(perm => {
      if (this.isModulePermission(perm)) {
        return perm
      } else {
        // 简单权限需要模块上下文
        if (currentModule) {
          return this.toModulePermission(perm, currentModule)
        }
        return perm
      }
    })
  }

  /**
   * 权限兼容性检查
   * 检查前端权限格式与后端权限格式的兼容性
   * @param frontendPermission 前端权限格式
   * @param backendPermission 后端权限格式
   * @returns 是否兼容
   */
  static isPermissionCompatible(frontendPermission: string, backendPermission: string): boolean {
    const normalizedFrontend = this.normalizePermission(frontendPermission)
    const normalizedBackend = this.normalizePermission(backendPermission)

    if (normalizedFrontend === normalizedBackend) {
      return true
    }

    const frontendParsed = this.parsePermission(normalizedFrontend)
    const backendParsed = this.parsePermission(normalizedBackend)

    if (!frontendParsed || !backendParsed || frontendParsed.module !== backendParsed.module) {
      return false
    }

    const parseActionScope = (action: string) => {
      if (action.endsWith(':all')) {
        return { baseAction: action.slice(0, -4), level: 3 }
      }

      if (action.endsWith(':own')) {
        return { baseAction: action.slice(0, -4), level: 1 }
      }

      return { baseAction: action, level: 2 }
    }

    const frontendAction = parseActionScope(frontendParsed.action)
    const backendAction = parseActionScope(backendParsed.action)

    return frontendAction.baseAction === backendAction.baseAction && frontendAction.level >= backendAction.level
  }
}

/**
 * 权限检查工具函数
 */
export const PermissionUtils = {
  /**
   * 检查用户是否具有指定权限
   * @param userPermissions 用户权限列表或权限对象
   * @param requiredPermission 需要的权限
   * @param currentModule 当前模块上下文
   * @returns 是否具有权限
   */
  hasPermission(
    userPermissions: string[] | Record<string, any>,
    requiredPermission: string,
    currentModule?: string
  ): boolean {
    // 标准化所需权限
    const normalizedRequired = PermissionMapper.normalizePermission(requiredPermission, currentModule)

    // 如果是权限对象格式（后端返回的格式），则进行特殊处理
    if (!Array.isArray(userPermissions) && typeof userPermissions === 'object') {
      return this.hasPermissionFromObject(userPermissions, normalizedRequired, currentModule)
    }

    // 检查具体权限 (数组格式)
    return Array.isArray(userPermissions) && userPermissions.some(perm => {
      const normalizedUser = PermissionMapper.normalizePermission(perm, currentModule)
      return PermissionMapper.isPermissionCompatible(normalizedUser, normalizedRequired)
    })
  },

  /**
   * 从权限对象中检查权限 (后端返回的格式)
   * @param permissionObject 权限对象格式
   * @param normalizedRequired 标准化的所需权限
   * @param _currentModule 当前模块上下文 (未使用)
   * @returns 是否具有权限
   */
  hasPermissionFromObject(
    permissionObject: Record<string, any>,
    normalizedRequired: string,
    _currentModule?: string
  ): boolean {
    // 解析所需权限
    const [requiredModule, requiredAction] = normalizedRequired.split(':')

    // 如果没有模块上下文，遍历所有模块
    if (!requiredModule) {
      for (const [_moduleKey, moduleData] of Object.entries(permissionObject)) {
        if (moduleData?.permissions?.includes(requiredAction)) {
          return true
        }
      }
      return false
    }

    // 映射前端模块到后端模块
    const backendModule = PermissionMapper.mapModuleKey(requiredModule)

    // 检查具体模块的权限
    const moduleData = permissionObject[backendModule]
    if (moduleData?.permissions && Array.isArray(moduleData.permissions)) {
      return moduleData.permissions.includes(requiredAction)
    }

    return false
  },

  /**
   * 批量检查权限
   * @param userPermissions 用户权限列表
   * @param requiredPermissions 需要的权限列表
   * @param currentModule 当前模块上下文
   * @param requireAll 是否需要所有权限
   * @returns 权限检查结果
   */
  hasPermissions(
    userPermissions: string[],
    requiredPermissions: string[],
    currentModule?: string,
    requireAll: boolean = false
  ): Record<string, boolean> {
    const results: Record<string, boolean> = {}

    for (const permission of requiredPermissions) {
      results[permission] = this.hasPermission(userPermissions, permission, currentModule)
    }

    return results
  }
}

export default PermissionMapper
