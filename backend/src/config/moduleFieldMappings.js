/**
 * 模块字段映射配置
 * 定义每个模块（页面）实际需要的字段
 */

const moduleFieldMappings = {
  // 采购入库页面 - inventory_stockinpage
  'inventory_stockinpage': {
    // 供应商信息
    'suppliers': ['id', 'name', 'contact', 'phone'],
    // 店铺信息
    'stores': ['id', 'name', 'location'],
    // 品牌信息
    'brands': ['id', 'name'],
    // 型号信息
    'models': ['id', 'name'],
    // 颜色信息
    'colors': ['id', 'name'],
    // 内存信息
    'memories': ['id', 'size'],
    // 手机主表 - 采购入库需要的字段
    'phones': ['id', 'imei', 'serial_number', 'brand_id', 'model_id', 'color_id',
              'memory_id', 'purchase_cost', 'store_id', 'supplier_id',
              'quality_grade', 'inventory_operator_id', 'Inventorytime'],
    // 用户表 - 用于获取入库员信息
    'users': ['id', 'name', 'username']
  },

  // 销售页面 - sales_phonesaleview
  'sales_phonesaleview': {
    'phones': ['id', 'imei', 'serial_number', 'brand_id', 'model_id', 'color_id',
              'memory_id', 'sale_price', 'customer_name', 'sale_operator_id',
              'salestime', 'status'],
    'customers': ['id', 'name', 'phone'],
    'users': ['id', 'name', 'username'],
    'brands': ['id', 'name'],
    'models': ['id', 'name'],
    'colors': ['id', 'name'],
    'memories': ['id', 'size']
  },

  // 供应商管理页面 - suppliers_suppliersview
  'suppliers_suppliersview': {
    'suppliers': ['id', 'name', 'contact', 'phone', 'email', 'address',
                 'status', 'created_at', 'updated_at']
  },

  // 品牌管理页面 - brands_brandsview
  'brands_brandsview': {
    'brands': ['id', 'name', 'description', 'status', 'sort_order',
              'created_at', 'updated_at']
  },

  // 型号管理页面 - models_modelsview
  'models_modelsview': {
    'models': ['id', 'name', 'brand_id', 'status', 'created_at', 'updated_at'],
    'brands': ['id', 'name']
  },

  // 颜色管理页面 - colors_colorsview
  'colors_colorsview': {
    'colors': ['id', 'name', 'hex_code', 'status', 'sort_order',
              'created_at', 'updated_at']
  },

  // 内存管理页面 - memories_memoriesview
  'memories_memoriesview': {
    'memories': ['id', 'size', 'status', 'sort_order',
               'created_at', 'updated_at']
  },

  // 客户管理页面 - customers_customersview
  'customers_customersview': {
    'customers': ['id', 'name', 'phone', 'email', 'address', 'status',
                 'created_at', 'updated_at']
  },

  // 员工管理页面 - employees_employeesview
  'employees_employeesview': {
    'users': ['id', 'username', 'name', 'email', 'phone', 'role', 'status',
             'created_at', 'updated_at'],
    'stores': ['id', 'name']
  },

  // 维修管理页面 - repairs_repairsview
  'repairs_repairsview': {
    'repairs': ['id', 'phone_id', 'customer_id', 'problem_description',
                'repair_cost', 'status', 'created_at', 'updated_at'],
    'phones': ['id', 'imei', 'serial_number', 'brand_id', 'model_id'],
    'customers': ['id', 'name', 'phone'],
    'brands': ['id', 'name'],
    'models': ['id', 'name']
  },

  // 租赁管理页面 - rentals_rentalsview
  'rentals_rentalsview': {
    'rentals': ['id', 'phone_id', 'customer_id', 'rental_start_date',
                'rental_end_date', 'rental_price', 'status', 'created_at'],
    'phones': ['id', 'imei', 'serial_number', 'brand_id', 'model_id'],
    'customers': ['id', 'name', 'phone'],
    'brands': ['id', 'name'],
    'models': ['id', 'name']
  },

  // 店铺管理页面 - stores_storesview
  'stores_storesview': {
    'stores': ['id', 'name', 'location', 'manager_id', 'phone', 'status',
              'created_at', 'updated_at'],
    'users': ['id', 'name', 'username']
  },

  // 系统设置页面 - system_systemview
  'system_systemview': {
    'settings': ['id', 'key', 'value', 'type', 'description'],
    'roles': ['id', 'name', 'description', 'is_active']
  },

  // 退库管理子模块 - system_returngoods
  'system_returngoods': {
    'sale_reversal_logs': [
      'id',
      'phone_id',
      'original_sale_id',
      'original_sale_type',
      'original_customer_id',
      'original_sale_operator_id',
      'original_sale_operator_name',
      'operator_id',
      'reversal_date',
      'remarks',
      'created_at',
      'updated_at'
    ],
    'users': ['id', 'name', 'username']
  }
};

/**
 * 获取模块需要的字段列表
 * @param {string} moduleKey 模块标识
 * @param {string} tableName 表名
 * @returns {Array} 字段名数组
 */
function getModuleFields(moduleKey, tableName) {
  const moduleConfig = moduleFieldMappings[moduleKey];
  if (!moduleConfig || !moduleConfig[tableName]) {
    // 如果没有配置，返回空数组（不显示任何字段）
    return [];
  }
  return moduleConfig[tableName];
}

/**
 * 获取模块的所有表和字段配置
 * @param {string} moduleKey 模块标识
 * @returns {Object} 表名到字段数组的映射
 */
function getModuleAllFields(moduleKey) {
  return moduleFieldMappings[moduleKey] || {};
}

/**
 * 检查字段是否在模块中需要
 * @param {string} moduleKey 模块标识
 * @param {string} tableName 表名
 * @param {string} fieldName 字段名
 * @returns {boolean} 是否需要
 */
function isFieldNeeded(moduleKey, tableName, fieldName) {
  const fields = getModuleFields(moduleKey, tableName);
  return fields.includes(fieldName);
}

/**
 * 过滤字段列表，只保留模块需要的字段
 * @param {string} moduleKey 模块标识
 * @param {string} tableName 表名
 * @param {Array} allFields 所有字段列表
 * @returns {Array} 过滤后的字段列表
 */
function filterFieldsForModule(moduleKey, tableName, allFields) {
  const neededFields = getModuleFields(moduleKey, tableName);
  if (neededFields.length === 0) {
    // 如果没有配置需要的字段，返回空数组
    return [];
  }

  return allFields.filter(field => neededFields.includes(field.name || field.field_name));
}

// 导出配置（使用 scanner 需要的函数名）
module.exports = {
  // 获取所有模块的字段配置（用于扫描器）- 包含系统模块
  getModuleAllFields: function() {
    return moduleFieldMappings;
  },

  // 获取业务模块的字段配置（不包含系统模块）
  getBusinessModuleAllFields: function() {
    const { filterModuleConfigs } = require('./excludeSystemModules');
    return filterModuleConfigs(moduleFieldMappings);
  },

  // 保留原始配置对象
  moduleFieldMappings,
  // 保留原始函数
  getModuleFields,
  isFieldNeeded,
  filterFieldsForModule
};
