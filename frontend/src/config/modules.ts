/**
 * 模块配置映射
 * 用于解耦前端权限指令与数据库模块名称的依赖
 */

import { logger } from '@/utils/logger'
import permissionCapabilities from '../../../backend/src/config/module-permission-capabilities.json'

const getCapabilityPermissions = (moduleKey: string): string[] => {
  const actions = permissionCapabilities.modules[moduleKey as keyof typeof permissionCapabilities.modules]
  if (!actions) {
    throw new Error(`模块 ${moduleKey} 未在共享权限能力清单中登记`)
  }
  return [...actions, 'menu_view']
}

// 模块类型定义
export interface ModuleConfig {
  id: string
  key: string
  name: string
  permissions: string[]
}

// 核心模块映射 - 使用数据库中的实际module_key
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  // 仪表板模块
  DASHBOARD: {
    id: 'dashboard',
    key: 'dashboard_dashboardview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['dashboard_dashboardview'].name,
    permissions: getCapabilityPermissions('dashboard_dashboardview')
  },

  // 库存管理模块
  INVENTORY: {
    id: 'inventory',
    key: 'inventory_inventoryview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['inventory_inventoryview'].name,
    permissions: getCapabilityPermissions('inventory_inventoryview')
  },

  // 销售管理模块
  SALES: {
    id: 'sales',
    key: 'sales_salesview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['sales_salesview'].name,
    permissions: getCapabilityPermissions('sales_salesview')
  },

  // 客户管理模块
  CUSTOMERS: {
    id: 'customers',
    key: 'customers_customersview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['customers_customersview'].name,
    permissions: getCapabilityPermissions('customers_customersview')
  },

  // 品牌管理模块
  BRANDS: {
    id: 'brands',
    key: 'brands_brandsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['brands_brandsview'].name,
    permissions: getCapabilityPermissions('brands_brandsview')
  },

  MODELS: {
    id: 'models',
    key: 'models_modelsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['models_modelsview'].name,
    permissions: getCapabilityPermissions('models_modelsview')
  },

  COLORS: {
    id: 'colors',
    key: 'colors_colorsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['colors_colorsview'].name,
    permissions: getCapabilityPermissions('colors_colorsview')
  },

  MEMORIES: {
    id: 'memories',
    key: 'memories_memoriesview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['memories_memoriesview'].name,
    permissions: getCapabilityPermissions('memories_memoriesview')
  },

  // 员工管理模块
  EMPLOYEES: {
    id: 'employees',
    key: 'employees_employeesview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['employees_employeesview'].name,
    permissions: getCapabilityPermissions('employees_employeesview')
  },

  // 店铺管理模块
  STORES: {
    id: 'stores',
    key: 'stores_storesview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['stores_storesview'].name,
    permissions: getCapabilityPermissions('stores_storesview')
  },

  // 供应商管理模块
  SUPPLIERS: {
    id: 'suppliers',
    key: 'suppliers_suppliersview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['suppliers_suppliersview'].name,
    permissions: getCapabilityPermissions('suppliers_suppliersview')
  },

  // 供应商付款模块
  SUPPLIER_PAYMENTS: {
    id: 'supplier_payments',
    key: 'payments_supplierphonepaymentsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['payments_supplierphonepaymentsview'].name,
    permissions: getCapabilityPermissions('payments_supplierphonepaymentsview')
  },

  // 配件管理模块
  ACCESSORIES: {
    id: 'accessories',
    key: 'accessories_accessoriesview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['accessories_accessoriesview'].name,
    permissions: getCapabilityPermissions('accessories_accessoriesview')
  },
  ACCESSORY_CATALOG: {
    id: 'accessories-catalog',
    key: 'accessories_accessorycatalogview',
    name: permissionCapabilities.moduleMetadata['accessories_accessorycatalogview'].name,
    permissions: getCapabilityPermissions('accessories_accessorycatalogview')
  },

  // 权限管理模块
  PERMISSIONS: {
    id: 'permissions',
    key: 'permissions_permissionsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['permissions_permissionsview'].name,
    permissions: getCapabilityPermissions('permissions_permissionsview')
  },

  // 模块管理模块
  MODULE_MANAGEMENT: {
    id: 'module_management',
    key: 'permissions_modulemanagementview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['permissions_modulemanagementview'].name,
    permissions: getCapabilityPermissions('permissions_modulemanagementview')
  },

  // 菜单管理模块
  MENU: {
    id: 'menu',
    key: 'menu_menumanagementview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['menu_menumanagementview'].name,
    permissions: getCapabilityPermissions('menu_menumanagementview')
  },

  // 综合查询模块
  QUERY: {
    id: 'query',
    key: 'query_queryview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['query_queryview'].name,
    permissions: getCapabilityPermissions('query_queryview')
  },

  // 系统设置模块
  SYSTEM: {
    id: 'system',
    key: 'system_systemview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['system_systemview'].name,
    permissions: getCapabilityPermissions('system_systemview')
  },

  // 规范与审计模块
  STANDARDS_AUDIT: {
    id: 'standards',
    key: 'standards_standardsauditview',
    name: permissionCapabilities.moduleMetadata['standards_standardsauditview'].name,
    permissions: getCapabilityPermissions('standards_standardsauditview')
  },

  // 数据分析模块
  ANALYTICS: {
    id: 'analytics',
    key: 'analytics_analyticsview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['analytics_analyticsview'].name,
    permissions: getCapabilityPermissions('analytics_analyticsview')
  },

  // 考勤管理模块
  ATTENDANCE: {
    id: 'attendance',
    key: 'attendance_attendanceview',
    name: permissionCapabilities.moduleMetadata['attendance_attendanceview'].name,
    permissions: getCapabilityPermissions('attendance_attendanceview')
  },

  MY_ATTENDANCE: {
    id: 'my_attendance',
    key: 'attendance_myattendanceview',
    name: permissionCapabilities.moduleMetadata['attendance_myattendanceview'].name,
    permissions: getCapabilityPermissions('attendance_myattendanceview')
  },

  // 工资管理模块
  SALARY: {
    id: 'salary',
    key: 'salary_salaryview',
    name: permissionCapabilities.moduleMetadata['salary_salaryview'].name,
    permissions: getCapabilityPermissions('salary_salaryview')
  },

  MY_SALARY: {
    id: 'my_salary',
    key: 'salary_mysalaryview',
    name: permissionCapabilities.moduleMetadata['salary_mysalaryview'].name,
    permissions: getCapabilityPermissions('salary_mysalaryview')
  },

  SALARY_RECORDS: {
    id: 'salary_records',
    key: 'salary_salaryrecordsview',
    name: permissionCapabilities.moduleMetadata['salary_salaryrecordsview'].name,
    permissions: getCapabilityPermissions('salary_salaryrecordsview')
  },

  SALARY_TEMPLATES: {
    id: 'salary_templates',
    key: 'salary_salarytemplatesview',
    name: permissionCapabilities.moduleMetadata['salary_salarytemplatesview'].name,
    permissions: getCapabilityPermissions('salary_salarytemplatesview')
  },

  // 数据优化模块
  DATA_OPTIMIZATION: {
    id: 'data_optimization',
    key: 'data_optimization_dataoptimizationview', // 使用数据库中的实际module_key
    name: permissionCapabilities.moduleMetadata['data_optimization_dataoptimizationview'].name,
    permissions: getCapabilityPermissions('data_optimization_dataoptimizationview')
  },

  // 预定管理模块
  PREORDERS: {
    id: 'preorders',
    key: 'preorders_preordersview',
    name: permissionCapabilities.moduleMetadata['preorders_preordersview'].name,
    permissions: getCapabilityPermissions('preorders_preordersview')
  },

  // 价目表管理模块
  PRICE_LIST: {
    id: 'price_list',
    key: 'price_list_pricelistview',
    name: permissionCapabilities.moduleMetadata['price_list_pricelistview'].name,
    permissions: getCapabilityPermissions('price_list_pricelistview')
  },

  // 国补管理模块
  SUBSIDY: {
    id: 'subsidy',
    key: 'subsidy_subsidyview',
    name: permissionCapabilities.moduleMetadata['subsidy_subsidyview'].name,
    permissions: getCapabilityPermissions('subsidy_subsidyview')
  },

  // 租赁管理模块
  RENTALS: {
    id: 'rentals',
    key: 'rentals_rentalsview',
    name: permissionCapabilities.moduleMetadata['rentals_rentalsview'].name,
    permissions: getCapabilityPermissions('rentals_rentalsview')
  },

  GUIDE: {
    id: 'guide',
    key: 'guide_guidemanagementview',
    name: permissionCapabilities.moduleMetadata['guide_guidemanagementview'].name,
    permissions: getCapabilityPermissions('guide_guidemanagementview')
  }
}

/**
 * 获取模块权限字符串
 * @param moduleId 模块ID (如: 'INVENTORY', 'SALES')
 * @param action 权限动作 (如: 'view', 'create', 'edit', 'delete')
 * @returns 权限字符串 (如: 'inventory:view', 'inventory:create')
 */
export function getModulePermission(moduleId: string, action: string): string {
  const module = MODULE_CONFIGS[moduleId.toUpperCase()]
  if (!module) {
    logger.warn(`⚠️ 未找到模块配置: ${moduleId}`)
    return `${moduleId.toLowerCase()}:${action}`
  }

  return `${module.key}:${action}`
}

/**
 * 获取模块的所有权限
 * @param moduleId 模块ID
 * @returns 权限字符串数组
 */
export function getModulePermissions(moduleId: string): string[] {
  const module = MODULE_CONFIGS[moduleId.toUpperCase()]
  if (!module) {
    return []
  }

  return module.permissions.map(action => `${module.key}:${action}`)
}

/**
 * 检查权限字符串是否属于指定模块
 * @param permission 权限字符串 (如: 'inventory:view')
 * @param moduleId 模块ID
 * @returns 是否属于该模块
 */
export function isModulePermission(permission: string, moduleId: string): boolean {
  const module = MODULE_CONFIGS[moduleId.toUpperCase()]
  if (!module) {
    return false
  }

  return permission.startsWith(`${module.key}:`)
}

/**
 * 权限字符串解析
 * @param permission 权限字符串 (如: 'inventory:view')
 * @returns 解析结果 { moduleKey, action }
 */
export function parsePermission(permission: string): { moduleKey: string; action: string } | null {
  if (!permission || !permission.includes(':')) {
    return null
  }

  const [moduleKey, action] = permission.split(':')
  return { moduleKey, action }
}

/**
 * 根据数据库模块key获取模块配置
 * @param moduleKey 数据库中的模块key
 * @returns 模块配置或null
 */
export function getModuleConfigByKey(moduleKey: string): ModuleConfig | null {
  for (const config of Object.values(MODULE_CONFIGS)) {
    if (config.key === moduleKey) {
      return config
    }
  }
  return null
}

// 导出所有模块配置
export default MODULE_CONFIGS
