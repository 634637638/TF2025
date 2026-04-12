const DEFAULT_PERMISSION_TYPES = ['view', 'create', 'edit', 'delete'];

const ACTION_ORDER = [
  'view',
  'create',
  'return-to-stock',
  'wholesale',
  'proxy-transfer',
  'edit',
  'delete',
  'approve',
  'manage',
  'export',
  'import',
  'sell',
  'sync'
];

const MODULE_PERMISSION_TYPES = {
  dashboard_dashboardview: ['view'],
  preorders_preordersview: ['view', 'create', 'edit', 'delete', 'match', 'deliver', 'cancel'],
  suppliers_suppliersview: ['view', 'create', 'edit', 'delete', 'export'],
  payments_supplierphonepaymentsview: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  system_systemview: ['view', 'edit', 'delete'],
  system_returngoods: ['view', 'edit', 'delete'],
  system_gitmanagement: ['view'],
  data_optimization_dataoptimizationview: ['view', 'create', 'edit', 'delete'],
  menu_menumanagementview: ['view', 'create', 'edit', 'delete', 'export', 'import'],
  sales_salesview: ['view', 'create', 'wholesale', 'proxy-transfer', 'edit', 'delete', 'export'],
  models_modelsview: ['view', 'create', 'edit', 'delete'],
  colors_colorsview: ['view', 'create', 'edit', 'delete'],
  memories_memoriesview: ['view', 'create', 'edit', 'delete'],
  brands_brandsview: ['view', 'create', 'edit', 'delete'],
  stores_storesview: ['view', 'create', 'edit', 'delete', 'export'],
  employees_employeesview: ['view', 'create', 'edit', 'delete', 'export'],
  customers_customersview: ['view', 'create', 'edit', 'delete', 'export', 'manage'],
  accessories_accessoriesview: ['view', 'create', 'edit', 'delete'],
  inventory_inventoryview: ['view', 'create', 'edit', 'delete', 'export'],
  query_queryview: ['view', 'create', 'return-to-stock', 'edit', 'delete', 'export'],
  permissions_permissionsview: ['view', 'create', 'edit', 'delete'],
  permissions_modulemanagementview: ['view', 'create', 'edit', 'delete'],
  analytics_analyticsview: ['view', 'export'],
  attendance_attendanceview: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
  attendance_myattendanceview: ['view', 'create'],
  salary_salaryview: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
  salary_mysalaryview: ['view'],
  salary_salaryrecordsview: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
  salary_salarytemplatesview: ['view', 'create', 'edit', 'delete', 'manage'],
  subsidy_subsidyview: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  rentals_rentalsview: ['view', 'create', 'edit'],
  repairs_repairsview: ['view', 'create', 'edit'],
  price_list_pricelistview: ['view', 'create', 'edit', 'delete', 'export', 'import', 'sync'],
  price_list_synclogview: ['view', 'delete'],
  h5_admin_h5_adminview: ['view', 'create', 'edit', 'delete'],
  h5_admin_templatesview: ['view', 'create', 'edit', 'delete'],
  h5_admin_configview: ['view', 'edit'],
  h5_admin_homesectionsview: ['view', 'create', 'edit', 'delete'],
  h5_admin_bannersview: ['view', 'create', 'edit', 'delete'],
  h5_admin_ordersview: ['view', 'edit']
};

const MODULE_PERMISSION_METADATA = {
  dashboard_dashboardview: {
    name: '仪表盘',
    description: '查看系统首页统计和关键经营指标',
    category: 'system',
    icon: 'fas fa-tachometer-alt'
  },
  preorders_preordersview: {
    name: '新品预定',
    description: '管理预定单、匹配库存、交付和取消操作',
    category: 'business',
    icon: 'fas fa-clipboard-check'
  },
  suppliers_suppliersview: {
    name: '供应商管理',
    description: '维护供应商档案、排序和导出数据',
    category: 'business',
    icon: 'fas fa-truck-loading'
  },
  payments_supplierphonepaymentsview: {
    name: '供应商打款',
    description: '创建、审核和导出供应商打款记录',
    category: 'business',
    icon: 'fas fa-file-invoice-dollar'
  },
  system_systemview: {
    name: '系统设置',
    description: '维护系统参数、业务配置和基础设置',
    category: 'system',
    icon: 'fas fa-cogs'
  },
  system_returngoods: {
    name: '退库管理',
    description: '查看、编辑和删除退库记录',
    category: 'system',
    icon: 'fas fa-undo-alt'
  },
  system_gitmanagement: {
    name: 'Git管理',
    description: '查看仓库状态和执行代码备份操作',
    category: 'system',
    icon: 'fas fa-code-branch'
  },
  data_optimization_dataoptimizationview: {
    name: '数据优化',
    description: '执行数据检查、清理和修复处理',
    category: 'system',
    icon: 'fas fa-tools'
  },
  menu_menumanagementview: {
    name: '菜单管理',
    description: '维护菜单结构并支持导入导出',
    category: 'system',
    icon: 'fas fa-bars'
  },
  sales_salesview: {
    name: '销售管理',
    description: '处理销售开单、记录维护、删除及导出操作',
    category: 'business',
    icon: 'fas fa-shopping-cart'
  },
  models_modelsview: {
    name: '型号管理',
    description: '维护型号信息和排序配置',
    category: 'business',
    icon: 'fas fa-mobile-alt'
  },
  colors_colorsview: {
    name: '颜色管理',
    description: '维护颜色字典和排序配置',
    category: 'business',
    icon: 'fas fa-palette'
  },
  memories_memoriesview: {
    name: '内存管理',
    description: '维护内存规格和排序配置',
    category: 'business',
    icon: 'fas fa-memory'
  },
  brands_brandsview: {
    name: '品牌管理',
    description: '维护品牌信息和排序配置',
    category: 'business',
    icon: 'fas fa-tags'
  },
  stores_storesview: {
    name: '门店管理',
    description: '维护门店资料、排序配置并支持导出',
    category: 'business',
    icon: 'fas fa-store'
  },
  employees_employeesview: {
    name: '员工管理',
    description: '维护员工档案、状态并支持导出',
    category: 'business',
    icon: 'fas fa-user-tie'
  },
  customers_customersview: {
    name: '客户管理',
    description: '维护客户资料、导出名单和管理会员等级',
    category: 'business',
    icon: 'fas fa-users'
  },
  accessories_accessoriesview: {
    name: '配件管理',
    description: '维护配件库存和上下架记录',
    category: 'business',
    icon: 'fas fa-headphones'
  },
  inventory_inventoryview: {
    name: '库存管理',
    description: '维护库存状态并支持导出列表',
    category: 'business',
    icon: 'fas fa-warehouse'
  },
  query_queryview: {
    name: '综合查询',
    description: '执行综合检索、批量处理和导出数据',
    category: 'business',
    icon: 'fas fa-search'
  },
  permissions_permissionsview: {
    name: '权限管理',
    description: '维护角色、用户和页面权限配置',
    category: 'system',
    icon: 'fas fa-shield-alt'
  },
  permissions_modulemanagementview: {
    name: '模块管理',
    description: '维护系统模块注册、状态和关联关系',
    category: 'system',
    icon: 'fas fa-layer-group'
  },
  analytics_analyticsview: {
    name: '数据分析',
    description: '查看经营分析报表并导出统计数据',
    category: 'business',
    icon: 'fas fa-chart-line'
  },
  attendance_attendanceview: {
    name: '考勤管理',
    description: '查看、审批和维护全员考勤记录',
    category: 'business',
    icon: 'fas fa-calendar-check'
  },
  attendance_myattendanceview: {
    name: '我的考勤',
    description: '查看个人考勤，并提交自己的请假或加班申请',
    category: 'business',
    icon: 'fas fa-user-clock'
  },
  salary_salaryview: {
    name: '工资管理',
    description: '查看、计算、审批和发放员工工资',
    category: 'business',
    icon: 'fas fa-money-bill-wave'
  },
  salary_mysalaryview: {
    name: '我的工资',
    description: '仅查看个人已发放工资记录',
    category: 'business',
    icon: 'fas fa-wallet'
  },
  salary_salaryrecordsview: {
    name: '工资记录',
    description: '维护工资记录和发放结果',
    category: 'business',
    icon: 'fas fa-receipt'
  },
  salary_salarytemplatesview: {
    name: '工资模板',
    description: '维护工资模板、提成和考勤费率',
    category: 'business',
    icon: 'fas fa-file-invoice-dollar'
  },
  subsidy_subsidyview: {
    name: '国补管理',
    description: '创建、审批和维护国补申请记录',
    category: 'business',
    icon: 'fas fa-hand-holding-usd'
  },
  rentals_rentalsview: {
    name: '租赁管理',
    description: '维护租赁订单和归还状态',
    category: 'business',
    icon: 'fas fa-key'
  },
  repairs_repairsview: {
    name: '维修管理',
    description: '维护维修工单和状态流转',
    category: 'business',
    icon: 'fas fa-screwdriver-wrench'
  },
  price_list_pricelistview: {
    name: '价目表',
    description: '维护报价配置、同步任务和历史记录',
    category: 'business',
    icon: 'fas fa-list-ol'
  },
  price_list_synclogview: {
    name: '同步日志',
    description: '查看和清理价目表采集同步日志',
    category: 'business',
    icon: 'fas fa-clock-rotate-left'
  },
  h5_admin_h5_adminview: {
    name: 'H5商城管理',
    description: '维护 H5 商城模板、配置和运营内容',
    category: 'business',
    icon: 'fas fa-mobile-screen-button'
  },
  h5_admin_templatesview: {
    name: '商城模板',
    description: '维护 H5 商城母模板、子模板、媒体和排序',
    category: 'business',
    icon: 'fas fa-box-open'
  },
  h5_admin_configview: {
    name: '商城配置',
    description: '维护店铺基础信息、收款码、地图和功能开关',
    category: 'business',
    icon: 'fas fa-sliders-h'
  },
  h5_admin_homesectionsview: {
    name: '首页推荐',
    description: '维护首页推荐区域、推荐商品和排序配置',
    category: 'business',
    icon: 'fas fa-house'
  },
  h5_admin_bannersview: {
    name: '轮播图管理',
    description: '维护轮播图素材、排序、状态和跳转配置',
    category: 'business',
    icon: 'fas fa-images'
  },
  h5_admin_ordersview: {
    name: '商城订单',
    description: '查看 H5 商城订单并处理审核、发货、完成等操作',
    category: 'business',
    icon: 'fas fa-bag-shopping'
  }
};

function sortPermissionTypes(permissionTypes = []) {
  return [...new Set(permissionTypes)].sort((a, b) => {
    const indexA = ACTION_ORDER.indexOf(a);
    const indexB = ACTION_ORDER.indexOf(b);

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, 'zh-CN');
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

function getModulePermissionTypes(moduleKey, extraTypes = []) {
  const baseTypes = MODULE_PERMISSION_TYPES[moduleKey] || DEFAULT_PERMISSION_TYPES;
  return sortPermissionTypes([...baseTypes, ...extraTypes.filter(type => type && type !== 'menu_view')]);
}

function getModulePermissionMetadata(moduleKey) {
  return MODULE_PERMISSION_METADATA[moduleKey] || null;
}

module.exports = {
  ACTION_ORDER,
  DEFAULT_PERMISSION_TYPES,
  MODULE_PERMISSION_METADATA,
  MODULE_PERMISSION_TYPES,
  getModulePermissionMetadata,
  getModulePermissionTypes,
  sortPermissionTypes
};
