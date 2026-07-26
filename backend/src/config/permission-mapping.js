'use strict';

/**
 * 权限映射表 - 将标准权限字符串映射到数据库中的权限格式。
 *
 * 这里集中维护历史模块 key、视图扫描 key 与标准权限 key 的兼容关系，
 * 避免认证中间件继续膨胀成权限字典。
 */
module.exports = Object.freeze({
  // 入库权限映射
  // 兼容多种历史/来源的模块 key（views 扫描、菜单 URL 绑定、旧权限系统）
  'stock-in:view': ['inventory_stockinpage:view', 'inventory_stock-in:view', 'stockin_stockinview:view'],
  'stock-in:create': ['inventory_stockinpage:create', 'inventory_stock-in:create', 'stockin_stockinview:create'],
  'stock-in:edit': ['inventory_stockinpage:edit', 'inventory_stock-in:edit', 'stockin_stockinview:edit'],
  'stock-in:delete': ['inventory_stockinpage:delete', 'inventory_stock-in:delete', 'stockin_stockinview:delete'],

  // 库存权限映射
  'inventory:view': ['inventory_inventoryview:view'],
  'inventory:create': ['inventory_inventoryview:create'],
  'inventory:edit': ['inventory_inventoryview:edit'],
  'inventory:delete': ['inventory_inventoryview:delete'],

  // 销售权限映射
  'sales:view': ['sales_salesview:view', 'sales_phonesaleview:view'],
  'sales:create': ['sales_salesview:create', 'sales_phonesaleview:create'],
  'sales:wholesale': ['sales_salesview:wholesale'],
  'sales:proxy-transfer': ['sales_salesview:proxy-transfer'],
  'sales:edit': ['sales_salesview:edit', 'sales_phonesaleview:edit'],
  'sales:delete': ['sales_salesview:delete', 'sales_phonesaleview:delete'],
  'sales:export': ['sales_salesview:export'],
  'sales-editphoneview:view': ['sales_editphoneview:view'],
  'sales-editphoneview:edit': ['sales_editphoneview:edit'],
  'sales-editphoneview:create': ['sales_editphoneview:create'],
  'sales-editphoneview:delete': ['sales_editphoneview:delete'],

  // 菜单管理权限映射
  'menus:view': ['menu_menumanagementview:view'],
  'menus:create': ['menu_menumanagementview:create'],
  'menus:edit': ['menu_menumanagementview:edit'],
  'menus:delete': ['menu_menumanagementview:delete'],
  'menus:export': ['menu_menumanagementview:export'],
  'menus:import': ['menu_menumanagementview:import'],

  // 品牌管理权限映射
  'brands:view': ['brands_brandsview:view'],
  'brands:create': ['brands_brandsview:create'],
  'brands:edit': ['brands_brandsview:edit'],
  'brands:delete': ['brands_brandsview:delete'],

  // 型号管理权限映射
  'models:view': ['models_modelsview:view'],
  'models:create': ['models_modelsview:create'],
  'models:edit': ['models_modelsview:edit'],
  'models:delete': ['models_modelsview:delete'],

  // 颜色管理权限映射
  'colors:view': ['colors_colorsview:view'],
  'colors:create': ['colors_colorsview:create'],
  'colors:edit': ['colors_colorsview:edit'],
  'colors:delete': ['colors_colorsview:delete'],

  // 内存管理权限映射
  'memories:view': ['memories_memoriesview:view'],
  'memories:create': ['memories_memoriesview:create'],
  'memories:edit': ['memories_memoriesview:edit'],
  'memories:delete': ['memories_memoriesview:delete'],

  // 店铺管理权限映射
  'stores:view': ['stores_storesview:view', 'stores_storesview:menu_view'],
  'stores:create': ['stores_storesview:create'],
  'stores:edit': ['stores_storesview:edit'],
  'stores:delete': ['stores_storesview:delete'],
  'stores:export': ['stores_storesview:export'],

  // 用户管理权限映射（合并）
  'users:view': ['users_usersview:view', 'users_usersview:menu_view', 'employees_employeesview:view'],
  'users:create': ['users_usersview:create'],
  'users:edit': ['users_usersview:edit'],
  'users:delete': ['users_usersview:delete'],
  'users:view:own': ['users_usersview:view:own'],

  // 员工管理权限映射
  'query:view': ['query_queryview:view', 'query_queryview:menu_view', 'query:view'],
  'query:create': ['query_queryview:create', 'query:create'],
  'query:edit': ['query_queryview:edit', 'query:edit'],
  'query:export': ['query_queryview:export', 'query:export'],
  'query:return-to-stock': ['query_queryview:return-to-stock', 'query:return-to-stock'],
  'query:delete': ['query_queryview:delete', 'query:delete'],

  // 字段扫描权限映射
  'fieldscannerview:view': ['fieldscannerview:view'],
  'fieldscannerview:scan': ['fieldscannerview:scan'],
  'fieldscannerview:sync': ['fieldscannerview:sync'],
  'fieldscannerview:export': ['fieldscannerview:export'],
  'fieldscannerview:edit': ['fieldscannerview:edit'],
  'fieldscannerview:delete': ['fieldscannerview:delete'],

  // 客户管理权限映射
  'customers:view': ['customers_customersview:view', 'customers_customersview:menu_view'],
  'customers:create': ['customers_customersview:create'],
  'customers:edit': ['customers_customersview:edit'],
  'customers:delete': ['customers_customersview:delete'],
  'customers:export': ['customers_customersview:export'],
  'customers:manage': ['customers_customersview:edit', 'customers_customersview:manage'],

  // 配件管理权限映射
  'accessories:view': ['accessories_accessoriesview:view'],
  'accessories:create': ['accessories_accessoriesview:create'],
  'accessories:edit': ['accessories_accessoriesview:edit'],
  'accessories:delete': ['accessories_accessoriesview:delete'],

  // 首页推荐区域权限映射
  'home-sections:view': ['h5_admin_homesectionsview:view'],
  'home-sections:create': ['h5_admin_homesectionsview:create'],
  'home-sections:edit': ['h5_admin_homesectionsview:edit'],
  'home-sections:delete': ['h5_admin_homesectionsview:delete'],

  // H5 商城后台权限映射
  'h5-admin:view': ['h5_admin_h5_adminview:view'],
  'h5-admin:create': ['h5_admin_h5_adminview:create'],
  'h5-admin:edit': ['h5_admin_h5_adminview:edit'],
  'h5-admin:delete': ['h5_admin_h5_adminview:delete'],
  'h5-config:view': ['h5_admin_configview:view'],
  'h5-config:edit': ['h5_admin_configview:edit'],
  'h5-banners:view': ['h5_admin_bannersview:view'],
  'h5-banners:create': ['h5_admin_bannersview:create'],
  'h5-banners:edit': ['h5_admin_bannersview:edit'],
  'h5-banners:delete': ['h5_admin_bannersview:delete'],
  'h5-templates:view': ['h5_admin_templatesview:view'],
  'h5-templates:create': ['h5_admin_templatesview:create'],
  'h5-templates:edit': ['h5_admin_templatesview:edit'],
  'h5-templates:delete': ['h5_admin_templatesview:delete'],
  'h5-sold-products:view': ['h5_admin_soldproductsview:view'],
  'h5-sold-products:delete': ['h5_admin_soldproductsview:delete'],
  'h5-orders:view': ['h5_admin_ordersview:view'],
  'h5-orders:edit': ['h5_admin_ordersview:edit'],

  // 数据检查权限映射
  'data-check:view': ['data_optimization_dataoptimizationview:view'],
  'data-check:edit': ['data_optimization_dataoptimizationview:edit'],
  'data-check:delete': ['data_optimization_dataoptimizationview:delete'],
  'data-check:create': ['data_optimization_dataoptimizationview:create'],

  // 退库记录权限映射
  'return-goods:view': ['system_returngoods:view'],
  'return-goods:edit': ['system_returngoods:edit'],
  'return-goods:delete': ['system_returngoods:delete'],

  // 数据导入权限映射
  'data-import:view': ['data-import:view'],
  'data-import:upload': ['data-import:upload'],
  'data-import:execute': ['data-import:execute'],
  'data-import:edit': ['data-import:edit'],
  'data-import:delete': ['data-import:delete'],

  // 考勤权限映射
  'attendance:view:all': ['attendance_attendanceview:view'],
  'attendance:view': ['attendance_attendanceview:view', 'attendance_myattendanceview:view'],
  'attendance:view:own': ['attendance_attendanceview:view:own', 'attendance_myattendanceview:view'],
  'attendance:create': ['attendance_attendanceview:create', 'attendance_myattendanceview:create'],
  'attendance:edit': ['attendance_attendanceview:edit'],
  'attendance:delete': ['attendance_attendanceview:delete'],
  'attendance:approve': ['attendance_attendanceview:approve'],
  'attendance:manage': ['attendance_attendanceview:manage'],

  // 员工管理权限映射
  'employee:view': ['employees_employeesview:view'],
  'employee:create': ['employees_employeesview:create'],
  'employee:edit': ['employees_employeesview:edit'],
  'employee:delete': ['employees_employeesview:delete'],

  // 供应商管理权限映射
  'suppliers:view': ['suppliers_suppliersview:view'],
  'suppliers:create': ['suppliers_suppliersview:create'],
  'suppliers:edit': ['suppliers_suppliersview:edit'],
  'suppliers:delete': ['suppliers_suppliersview:delete'],
  'suppliers:export': ['suppliers_suppliersview:export'],
  'supplier:view': ['suppliers_suppliersview:view'],
  'supplier:create': ['suppliers_suppliersview:create'],
  'supplier:edit': ['suppliers_suppliersview:edit'],
  'supplier:delete': ['suppliers_suppliersview:delete'],
  'supplier:export': ['suppliers_suppliersview:export'],

  // 手机管理权限映射
  'phone:view': ['phones_phonesview:view'],
  'phone:create': ['phones_phonesview:create'],
  'phone:edit': ['phones_phonesview:edit'],
  'phone:delete': ['phones_phonesview:delete'],
  'phone:export': ['phones_phonesview:export'],
  // 复数形式（兼容前端）
  'phones:view': ['phones_phonesview:view'],
  'phones:create': ['phones_phonesview:create'],
  'phones:edit': ['phones_phonesview:edit'],
  'phones:delete': ['phones_phonesview:delete'],
  'phones:export': ['phones_phonesview:export'],

  // 权限管理权限映射
  'permissions:view': ['permissions_permissionsview:view'],
  'permissions:admin': ['permissions_permissionsview:view', 'permissions_permissionsview:create', 'permissions_permissionsview:edit', 'permissions_permissionsview:delete', 'permissions_modulemanagementview:view'],
  'permissions:edit': ['permissions_permissionsview:edit'],
  'permissions:delete': ['permissions_permissionsview:delete'],

  // 薪资管理权限映射
  'salary:view': ['salary_salaryview:view', 'salary_mysalaryview:view'],
  'salary:view:own': ['salary_salaryview:view:own', 'salary_mysalaryview:view'],
  'salary:create': ['salary_salaryview:create'],
  'salary:edit': ['salary_salaryview:edit'],
  'salary:delete': ['salary_salaryview:delete'],
  'salary:approve': ['salary_salaryview:approve'],
  'salary:manage': ['salary_salaryview:manage'],

  // 工资模板权限映射
  'salary-templates:view': ['salary_salarytemplatesview:view'],
  'salary-templates:create': ['salary_salarytemplatesview:create'],
  'salary-templates:edit': ['salary_salarytemplatesview:edit'],
  'salary-templates:delete': ['salary_salarytemplatesview:delete'],

  // 工资记录权限映射
  'salary-records:view:all': ['salary_salaryrecordsview:view'],
  'salary-records:view': ['salary_salaryrecordsview:view', 'salary_mysalaryview:view'],
  'salary-records:view:own': ['salary_mysalaryview:view'],
  'salary-records:create': ['salary_salaryrecordsview:create'],
  'salary-records:edit': ['salary_salaryrecordsview:edit'],
  'salary-records:delete': ['salary_salaryrecordsview:delete'],
  'salary-records:approve': ['salary_salaryrecordsview:approve'],

  // 国补管理权限映射
  'subsidy:view': ['subsidy_subsidyview:view', 'subsidy:view'],
  'subsidy:create': ['subsidy_subsidyview:create', 'subsidy:create'],
  'subsidy:update': ['subsidy_subsidyview:update', 'subsidy:update', 'subsidy_subsidyview:edit', 'subsidy:edit'],
  'subsidy:edit': ['subsidy_subsidyview:edit', 'subsidy:edit'],
  'subsidy:delete': ['subsidy_subsidyview:delete', 'subsidy:delete'],
  'subsidy:approve': ['subsidy_subsidyview:approve', 'subsidy:approve'],
  'subsidy:export': ['subsidy_subsidyview:export', 'subsidy:export'],

  // 供应商付款管理权限映射
  'supplier-payments:view': ['payments_supplierphonepaymentsview:view'],
  'supplier-payments:create': ['payments_supplierphonepaymentsview:create'],
  'supplier-payments:edit': ['payments_supplierphonepaymentsview:edit'],
  'supplier-payments:delete': ['payments_supplierphonepaymentsview:delete'],
  'supplier-payments:approve': ['payments_supplierphonepaymentsview:approve'],
  'supplier-payments:export': ['payments_supplierphonepaymentsview:export'],

  // 预定管理权限映射
  'preorders:view': ['preorders_preordersview:view', 'preorders_preordersview:menu_view'],
  'preorders:create': ['preorders_preordersview:create'],
  'preorders:edit': ['preorders_preordersview:edit'],
  'preorders:delete': ['preorders_preordersview:delete'],
  'preorders:match': ['preorders_preordersview:match'],
  'preorders:deliver': ['preorders_preordersview:deliver'],
  'preorders:cancel': ['preorders_preordersview:cancel'],

  // 待办提醒权限
  'reminders:view': ['reminders_reminderview:view'],
  'reminders:create': ['reminders_reminderview:create'],
  'reminders:edit': ['reminders_reminderview:edit'],
  'reminders:delete': ['reminders_reminderview:delete'],
  'reminders:manage': ['reminders_reminderview:manage'],

  // 经验分享权限映射
  'shared:view': ['shared_sharedview:view'],
  'shared:create': ['shared_sharedview:create'],
  'shared:edit': ['shared_sharedview:edit'],
  'shared:delete': ['shared_sharedview:delete'],
  'shared:manage': ['shared_sharedview:manage'],

  // 价目表管理权限映射
  'price-list:view': ['price_list_pricelistview:view', 'price_list_pricelistview:menu_view'],
  'price-list:create': ['price_list_pricelistview:create'],
  'price-list:edit': ['price_list_pricelistview:edit'],
  'price-list:delete': ['price_list_pricelistview:delete'],
  'price-list:import': ['price_list_pricelistview:import'],
  'price-list:export': ['price_list_pricelistview:export'],
  'price-list:sync': ['price_list_pricelistview:sync'],

  // Git 管理权限映射
  'git-management:view': ['system_gitmanagement:view', 'system_gitmanagement:menu_view'],
  'git-management:create': ['system_gitmanagement:create'],
  'git-management:edit': ['system_gitmanagement:edit'],
  'git-management:delete': ['system_gitmanagement:delete'],

  // 备份管理权限映射
  'backup:view': ['backup_backupview:view', 'backup_backupview:menu_view'],
  'backup:create': ['backup_backupview:create'],
  'backup:delete': ['backup_backupview:delete'],

  // 仪表盘权限映射
  'dashboard:view': ['dashboard_dashboardview:view', 'dashboard_dashboardview:menu_view'],

  // 系统管理权限映射
  'system:view': ['system_systemview:view', 'system_systemview:menu_view'],
  'system:create': ['system_systemview:create'],
  'system:edit': ['system_systemview:edit'],
  'system:delete': ['system_systemview:delete'],

  // 通用映射规则
});
