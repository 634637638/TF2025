/**
 * 模块配置映射
 * 用于解耦前端权限指令与数据库模块名称的依赖
 */

import { logger } from '@/utils/logger'

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
    name: '仪表板',
    permissions: ['view', 'menu_view']
  },

  // 库存管理模块
  INVENTORY: {
    id: 'inventory',
    key: 'inventory_inventoryview', // 使用数据库中的实际module_key
    name: '库存管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 销售管理模块
  SALES: {
    id: 'sales',
    key: 'sales_salesview', // 使用数据库中的实际module_key
    name: '销售管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 客户管理模块
  CUSTOMERS: {
    id: 'customers',
    key: 'customers_customersview', // 使用数据库中的实际module_key
    name: '客户管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 采购入库模块
  STOCK_IN: {
    id: 'stock_in',
    key: 'inventory_stockinpage', // 使用数据库中的实际module_key
    name: '采购入库',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 品牌管理模块
  BRANDS: {
    id: 'brands',
    key: 'brands_brandsview', // 使用数据库中的实际module_key
    name: '品牌管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  MODELS: {
    id: 'models',
    key: 'models_modelsview', // 使用数据库中的实际module_key
    name: '型号管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  COLORS: {
    id: 'colors',
    key: 'colors_colorsview', // 使用数据库中的实际module_key
    name: '颜色管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  MEMORIES: {
    id: 'memories',
    key: 'memories_memoriesview', // 使用数据库中的实际module_key
    name: '内存管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 员工管理模块
  EMPLOYEES: {
    id: 'employees',
    key: 'employees_employeesview', // 使用数据库中的实际module_key
    name: '员工管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 店铺管理模块
  STORES: {
    id: 'stores',
    key: 'stores_storesview', // 使用数据库中的实际module_key
    name: '店铺管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 供应商管理模块
  SUPPLIERS: {
    id: 'suppliers',
    key: 'suppliers_suppliersview', // 使用数据库中的实际module_key
    name: '供应商管理',
    permissions: ['view', 'create', 'edit', 'delete', 'export', 'menu_view']
  },

  // 供应商付款模块
  SUPPLIER_PAYMENTS: {
    id: 'supplier_payments',
    key: 'payments_supplierphonepaymentsview', // 使用数据库中的实际module_key
    name: '供应商付款',
    permissions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'menu_view']
  },

  // 配件管理模块
  ACCESSORIES: {
    id: 'accessories',
    key: 'accessories_accessoriesview', // 使用数据库中的实际module_key
    name: '配件管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 权限管理模块
  PERMISSIONS: {
    id: 'permissions',
    key: 'permissions_permissionsview', // 使用数据库中的实际module_key
    name: '权限管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 模块管理模块
  MODULE_MANAGEMENT: {
    id: 'module_management',
    key: 'permissions_modulemanagementview', // 使用数据库中的实际module_key
    name: '模块管理',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 菜单管理模块
  MENU: {
    id: 'menu',
    key: 'menu_menumanagementview', // 使用数据库中的实际module_key
    name: '菜单管理',
    permissions: ['view', 'create', 'edit', 'delete', 'import', 'export', 'menu_view']
  },

  // 综合查询模块
  QUERY: {
    id: 'query',
    key: 'query_queryview', // 使用数据库中的实际module_key
    name: '综合查询',
    permissions: ['view', 'edit', 'delete', 'export', 'menu_view']
  },

  // 系统设置模块
  SYSTEM: {
    id: 'system',
    key: 'system_systemview', // 使用数据库中的实际module_key
    name: '系统设置',
    permissions: ['view', 'edit', 'menu_view']
  },

  // 数据分析模块
  ANALYTICS: {
    id: 'analytics',
    key: 'analytics_analyticsview', // 使用数据库中的实际module_key
    name: '数据分析',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 考勤管理模块
  ATTENDANCE: {
    id: 'attendance',
    key: 'attendance_attendanceview',
    name: '考勤管理',
    permissions: ['view', 'create', 'edit', 'delete', 'approve', 'manage', 'menu_view']
  },

  MY_ATTENDANCE: {
    id: 'my_attendance',
    key: 'attendance_myattendanceview',
    name: '我的考勤',
    permissions: ['view', 'create', 'menu_view']
  },

  // 工资管理模块
  SALARY: {
    id: 'salary',
    key: 'salary_salaryview',
    name: '工资管理',
    permissions: ['view', 'create', 'edit', 'delete', 'approve', 'manage', 'menu_view']
  },

  MY_SALARY: {
    id: 'my_salary',
    key: 'salary_mysalaryview',
    name: '我的工资',
    permissions: ['view', 'menu_view']
  },

  SALARY_RECORDS: {
    id: 'salary_records',
    key: 'salary_salaryrecordsview',
    name: '工资记录',
    permissions: ['view', 'create', 'edit', 'delete', 'approve', 'manage', 'menu_view']
  },

  SALARY_TEMPLATES: {
    id: 'salary_templates',
    key: 'salary_salarytemplatesview',
    name: '工资模板',
    permissions: ['view', 'create', 'edit', 'delete', 'manage', 'menu_view']
  },

  // 手机销售模块
  PHONE_SALE: {
    id: 'phone_sale',
    key: 'sales_phonesaleview', // 使用数据库中的实际module_key
    name: '手机销售',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 手机编辑模块
  PHONE_EDIT: {
    id: 'phone_edit',
    key: 'sales_editphoneview', // 使用数据库中的实际module_key
    name: '手机编辑',
    permissions: ['view', 'create', 'edit', 'delete', 'menu_view']
  },

  // 数据优化模块
  DATA_OPTIMIZATION: {
    id: 'data_optimization',
    key: 'data_optimization_dataoptimizationview', // 使用数据库中的实际module_key
    name: '数据优化',
    permissions: ['view', 'check', 'import', 'sync', 'menu_view']
  },

  // 预定管理模块
  PREORDERS: {
    id: 'preorders',
    key: 'preorders_preordersview',
    name: '预定管理',
    permissions: ['view', 'create', 'edit', 'delete', 'match', 'complete', 'cancel', 'export', 'menu_view']
  },

  // 价目表管理模块
  PRICE_LIST: {
    id: 'price_list',
    key: 'price_list_pricelistview',
    name: '价目表管理',
    permissions: ['view', 'create', 'edit', 'delete', 'import', 'export', 'sync', 'menu_view']
  },

  // 国补管理模块
  SUBSIDY: {
    id: 'subsidy',
    key: 'subsidy_subsidyview',
    name: '国补管理',
    permissions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'menu_view']
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
