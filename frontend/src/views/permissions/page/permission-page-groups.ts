export interface PermissionPageGroupConfig {
  parentKey: string
  title: string
  description: string
  childKeys: readonly string[]
  prefix: string
}

/** 页面权限和字段权限共用母子页面归属，不改变模块各自的授权与字段配置。 */
export const PERMISSION_PAGE_GROUPS: readonly PermissionPageGroupConfig[] = [
  {
    parentKey: 'accessories_accessoriesview',
    title: '配件管理',
    description: '配件主页面下面统一管理商品类型、计量单位及总仓等配件设置子页面权限。',
    childKeys: ['accessories_accessorycatalogview'],
    prefix: 'accessories_'
  },
  {
    parentKey: 'system_systemview',
    title: '系统设置',
    description: '系统主页面下面统一管理 Git 管理、数据优化等子页面权限。',
    childKeys: ['system_gitmanagement', 'data_optimization_dataoptimizationview'],
    prefix: 'system_'
  },
  {
    parentKey: 'data_optimization_dataoptimizationview',
    title: '数据优化',
    description: '页面查看不授予数据导入的上传、执行或删除权限。',
    childKeys: ['data_optimization_dataimporttab'],
    prefix: 'data_optimization_'
  },
  {
    parentKey: 'permissions_permissionsview',
    title: '权限管理',
    description: '权限主页面下面统一管理模块管理等子页面权限。',
    childKeys: ['permissions_modulemanagementview'],
    prefix: 'permissions_'
  },
  {
    parentKey: 'salary_salaryview',
    title: '工资管理',
    description: '工资主页面下面统一管理“我的工资”“工资模板”“工资计算”等子页面权限。',
    childKeys: ['salary_mysalaryview', 'salary_salarytemplatesview', 'salary_salaryrecordsview'],
    prefix: 'salary_'
  },
  {
    parentKey: 'attendance_attendanceview',
    title: '考勤管理',
    description: '考勤主页面下面统一管理“我的考勤”等子页面权限。',
    childKeys: ['attendance_myattendanceview'],
    prefix: 'attendance_'
  },
  {
    parentKey: 'price_list_pricelistview',
    title: '价目表',
    description: '价目表主页面下面统一管理同步日志等子页面权限。',
    childKeys: ['price_list_synclogview'],
    prefix: 'price_list_'
  },
  {
    parentKey: 'h5_admin_h5_adminview',
    title: 'H5商城管理',
    description: 'H5 商城主页面下面统一管理模板、配置、轮播图、首页推荐、商城订单和已售商品等子页面权限。',
    childKeys: [
      'h5_admin_templatesview',
      'h5_admin_configview',
      'h5_admin_homesectionsview',
      'h5_admin_bannersview',
      'h5_admin_ordersview',
      'h5_admin_soldproductsview'
    ],
    prefix: 'h5_admin_'
  }
]
