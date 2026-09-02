import { PHONE_STATUS_OPTIONS } from '@/constants/phoneStatuses'

// 字段类型定义
export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  PHONE: 'phone',
  EMAIL: 'email',
  CURRENCY: 'currency',
  PERCENTAGE: 'percentage',
  URL: 'url',
  JSON: 'json'
}

// 字段敏感级别定义
export const SENSITIVITY_LEVELS = {
  PUBLIC: 'public',        // 公开信息，所有用户可见
  INTERNAL: 'internal',    // 内部信息，员工可见
  SENSITIVE: 'sensitive',  // 敏感信息，特定角色可见
  CONFIDENTIAL: 'confidential'  // 机密信息，管理员可见
}

// 模块字段配置
export const MODULE_FIELDS = {
  // 综合查询模块字段
  query: {
    name: '综合查询',
    icon: 'fas fa-search',
    category: '查询模块',
    fields: [
      {
        id: 'stats.total_phones',
        name: '总设备数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部总设备数统计卡片'
      },
      {
        id: 'stats.in_stock_count',
        name: '在库数量概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部在库数量统计卡片'
      },
      {
        id: 'stats.sold_count',
        name: '已售数量概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已售数量统计卡片'
      },
      {
        id: 'stats.new_count',
        name: '全新设备概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部全新设备统计卡片'
      },
      {
        id: 'stats.used_count',
        name: '二手设备概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部二手设备统计卡片'
      },
      // 供应商信息字段
      {
        id: 'supplier_info.supplier_name',
        name: '供应商',
        group: '供应商信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '供应商名称',
        filterable: true
      },

      // 店铺信息字段
      {
        id: 'store_info.store_name',
        name: '店铺',
        group: '店铺信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺名称',
        filterable: true
      },

      // 时间信息字段
      {
        id: 'time_info.inventory_time',
        name: '入库时间',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机入库时间',
        filterable: true
      },
      {
        id: 'time_info.sale_time',
        name: '销售时间',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机销售时间',
        filterable: true
      },

      // 基本信息字段
      {
        id: 'basic_info.imei',
        name: 'IMEI',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机IMEI码',
        searchable: true
      },
      {
        id: 'basic_info.serial_number',
        name: '序列号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机序列号'
      },
      {
        id: 'basic_info.brand',
        name: '品牌',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机品牌',
        filterable: true
      },
      {
        id: 'basic_info.model',
        name: '型号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机型号',
        filterable: true
      },
      {
        id: 'basic_info.color',
        name: '颜色',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机颜色',
        filterable: true
      },
      {
        id: 'basic_info.memory',
        name: '内存',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机内存容量',
        filterable: true
      },
      {
        id: 'basic_info.is_new',
        name: '全新/二手',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '是否为全新手机',
        filterable: true
      },
      {
        id: 'basic_info.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机状态（可售/预定/租赁/维修/已售等）',
        filterable: true,
        options: PHONE_STATUS_OPTIONS
      },

      // 基本信息字段（价格字段放在设备信息内）
      {
        id: 'basic_info.purchase_cost',
        name: '入库价格',
        group: '基本信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '手机入库价格',
        currency: 'CNY'
      },
      {
        id: 'basic_info.sale_price',
        name: '销售价格',
        group: '基本信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机销售价格',
        currency: 'CNY'
      },

      // 客户信息字段
      {
        id: 'customer_info.customer_name',
        name: '客户姓名',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户姓名'
      },
      {
        id: 'customer_info.customer_phone',
        name: '手机号码',
        group: '客户信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户手机号码'
      },
      {
        id: 'customer_info.apple_id',
        name: 'Apple ID',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户Apple ID'
      },

      // 其他信息字段
      {
        id: 'other_info.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '备注信息'
      },

      // 员工信息字段
      {
        id: 'operator_info.inventory_operator',
        name: '入库员',
        group: '员工信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '入库操作员'
      },
      {
        id: 'operator_info.sale_operator',
        name: '销售员',
        group: '员工信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售操作员'
      },

      // 操作字段
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 库存管理模块字段
  inventory: {
    name: '库存管理',
    icon: 'fas fa-warehouse',
    category: '业务模块',
    fields: [
      {
        id: 'stats.total_phones',
        name: '手机总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部手机总数统计卡片'
      },
      {
        id: 'stats.new_phones',
        name: '全新机数量概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部全新机数量统计卡片'
      },
      {
        id: 'stats.used_phones',
        name: '二手机数量概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部二手机数量统计卡片'
      },
      {
        id: 'stats.inventory_value',
        name: '库存总值概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部库存总值统计卡片'
      },
      {
        id: 'basic.phone_id',
        name: '手机ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机唯一标识',
        required: true
      },
      {
        id: 'basic.imei',
        name: 'IMEI码',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机唯一识别码',
        required: true,
        searchable: true
      },
      {
        id: 'basic.serial_number',
        name: '序列号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机序列号'
      },
      {
        id: 'basic.brand',
        name: '品牌',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机品牌',
        required: true,
        filterable: true
      },
      {
        id: 'basic.model',
        name: '型号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机型号',
        required: true,
        filterable: true
      },
      {
        id: 'basic.color',
        name: '颜色',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机颜色',
        filterable: true
      },
      {
        id: 'basic.memory',
        name: '内存',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机内存容量',
        filterable: true
      },
      {
        id: 'basic.is_new',
        name: '机况',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '全新或二手',
        filterable: true
      },
      {
        id: 'basic.status',
        name: '库存状态',
        group: '基本信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '商品当前库存状态',
        filterable: true,
        options: PHONE_STATUS_OPTIONS
      },
      {
        id: 'supplier_info.supplier_name',
        name: '供应商',
        group: '关联信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商名称',
        filterable: true
      },
      {
        id: 'store_info.store_name',
        name: '店铺',
        group: '关联信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '入库店铺名称',
        filterable: true
      },
      {
        id: 'operator_info.inventory_operator_name',
        name: '入库员',
        group: '关联信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '入库操作员'
      },
      {
        id: 'purchase_info.purchase_number',
        name: '采购单号',
        group: '关联信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '采购或入库单号'
      },
      {
        id: 'time_info.inventory_time',
        name: '入库时间',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '商品入库日期',
        filterable: true
      },
      {
        id: 'price_info.purchase_cost',
        name: '入库价格',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '商品入库价格',
        currency: 'CNY'
      },
      {
        id: 'other_info.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '商品备注信息'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 销售管理模块字段
  sales: {
    name: '销售管理',
    icon: 'fas fa-shopping-cart',
    category: '业务模块',
    fields: [
      {
        id: 'stats.available_inventory',
        name: '可销售库存概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部可销售库存统计卡片'
      },
      {
        id: 'stats.today_sales',
        name: '今日出库概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部今日出库统计卡片'
      },
      {
        id: 'stats.inventory_value',
        name: '库存价值概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部库存价值统计卡片'
      },
      {
        id: 'stats.avg_profit_margin',
        name: '平均利润率概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部平均利润率统计卡片'
      },
      {
        id: 'sale.id',
        name: '销售单号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售订单编号',
        required: true
      },
      {
        id: 'sale.customer_name',
        name: '客户姓名',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '购买客户姓名'
      },
      {
        id: 'sale.customer_phone',
        name: '客户电话',
        group: '基本信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户联系电话'
      },
      {
        id: 'sale.brand',
        name: '品牌',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售商品品牌',
        searchable: true
      },
      {
        id: 'sale.model',
        name: '型号',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售商品型号',
        searchable: true
      },
      {
        id: 'sale.color',
        name: '颜色',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售商品颜色'
      },
      {
        id: 'sale.memory',
        name: '内存',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售商品内存规格'
      },
      {
        id: 'sale.serial_number',
        name: '序列号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备序列号'
      },
      {
        id: 'sale.imei',
        name: 'IMEI',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备 IMEI'
      },
      {
        id: 'sale.purchase_cost',
        name: '成本价',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '销售商品成本价'
      },
      {
        id: 'sale.sale_price',
        name: '销售价',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备销售价格'
      },
      {
        id: 'sale.sale_time',
        name: '销售时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售时间'
      },
      {
        id: 'sale.payment_method',
        name: '支付方式',
        group: '交易信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '支付方式'
      },
      {
        id: 'sale.transaction_no',
        name: '流水号',
        group: '交易信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '支付流水号'
      },
      {
        id: 'sale.store_id',
        name: '销售门店',
        group: '业务信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售所属门店'
      },
      {
        id: 'sale.operator_id',
        name: '销售员',
        group: '业务信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售员'
      },
      {
        id: 'sale.supplier_id',
        name: '供应商',
        group: '业务信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备供应商'
      },
      {
        id: 'sale.inventory_time',
        name: '入库日期',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备入库日期'
      },
      {
        id: 'sale.condition',
        name: '机况',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备机况'
      },
      {
        id: 'sale.remarks',
        name: '备注',
        group: '补充信息',
        type: FIELD_TYPES.TEXTAREA,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售备注'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  // 品牌管理模块字段
  brands: {
    name: '品牌管理',
    icon: 'fas fa-tags',
    category: '基础数据',
    fields: [
      {
        id: 'stats.total_brands',
        name: '品牌总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部品牌总数统计卡片'
      },
      {
        id: 'stats.active_brands',
        name: '启用品牌概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部启用品牌统计卡片'
      },
      {
        id: 'stats.inactive_brands',
        name: '禁用品牌概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用品牌统计卡片'
      },
      {
        id: 'stats.related_phones',
        name: '相关手机概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部相关手机统计卡片'
      },
      {
        id: 'brand.id',
        name: '品牌ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '品牌唯一标识',
        required: true
      },
      {
        id: 'brand.name',
        name: '品牌名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '品牌名称',
        required: true,
        searchable: true
      },
      {
        id: 'brand.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '品牌状态（启用/禁用）',
        filterable: true
      },
      {
        id: 'brand.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'brand.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '品牌创建时间'
      },
      {
        id: 'brand.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '品牌更新时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 型号管理模块字段
  models: {
    name: '型号管理',
    icon: 'fas fa-mobile-alt',
    category: '基础数据',
    fields: [
      {
        id: 'stats.total_models',
        name: '型号总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部型号总数统计卡片'
      },
      {
        id: 'stats.active_models',
        name: '启用型号概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部启用型号统计卡片'
      },
      {
        id: 'stats.inactive_models',
        name: '禁用型号概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用型号统计卡片'
      },
      {
        id: 'stats.related_brands',
        name: '关联品牌概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部关联品牌统计卡片'
      },
      {
        id: 'model.id',
        name: '型号ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '型号唯一标识',
        required: true
      },
      {
        id: 'model.name',
        name: '型号名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机型号名称',
        required: true,
        searchable: true
      },
      {
        id: 'model.brand_id',
        name: '所属品牌',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '关联的品牌ID',
        filterable: true
      },
      {
        id: 'model.brand_name',
        name: '品牌名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '品牌名称',
        filterable: true
      },
      {
        id: 'model.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '型号状态（启用/禁用）',
        filterable: true
      },
      {
        id: 'model.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'model.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '型号创建时间'
      },
      {
        id: 'model.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '型号更新时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 颜色管理模块字段
  colors: {
    name: '颜色管理',
    icon: 'fas fa-palette',
    category: '基础数据',
    fields: [
      {
        id: 'stats.total_colors',
        name: '颜色总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部颜色总数统计卡片'
      },
      {
        id: 'stats.active_colors',
        name: '启用颜色概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部启用颜色统计卡片'
      },
      {
        id: 'stats.inactive_colors',
        name: '禁用颜色概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用颜色统计卡片'
      },
      {
        id: 'stats.related_phones',
        name: '相关手机概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部相关手机统计卡片'
      },
      {
        id: 'color.id',
        name: '颜色ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '颜色唯一标识',
        required: true
      },
      {
        id: 'color.name',
        name: '颜色名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '颜色名称（如：深空灰、银色）',
        required: true,
        searchable: true
      },
      {
        id: 'color.code',
        name: '颜色代码',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '颜色代码（如：#000000）',
        required: true
      },
      {
        id: 'color.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '颜色状态（启用/禁用）',
        filterable: true
      },
      {
        id: 'color.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'color.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '颜色创建时间'
      },
      {
        id: 'color.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '颜色更新时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 内存管理模块字段
  memories: {
    name: '内存管理',
    icon: 'fas fa-memory',
    category: '基础数据',
    fields: [
      {
        id: 'stats.total_memories',
        name: '内存规格总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部内存规格总数统计卡片'
      },
      {
        id: 'stats.active_memories',
        name: '启用规格概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部启用内存规格统计卡片'
      },
      {
        id: 'stats.inactive_memories',
        name: '禁用规格概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用内存规格统计卡片'
      },
      {
        id: 'stats.related_phones',
        name: '相关手机概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部相关手机统计卡片'
      },
      {
        id: 'memory.id',
        name: '内存ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '内存唯一标识',
        required: true
      },
      {
        id: 'memory.capacity',
        name: '内存规格',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '内存规格（如：64GB、8+256GB）',
        required: true,
        searchable: true
      },
      {
        id: 'memory.type',
        name: '存储单位',
        group: '基本信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '存储单位（GB/TB）',
        filterable: true
      },
      {
        id: 'memory.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '内存状态（启用/禁用）',
        filterable: true
      },
      {
        id: 'memory.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'memory.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '内存创建时间'
      },
      {
        id: 'memory.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '内存更新时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 员工管理模块字段
  employees: {
    name: '员工管理',
    icon: 'fas fa-user-tie',
    category: '人力资源',
    fields: [
      {
        id: 'stats.total_employees',
        name: '员工总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部员工总数统计卡片'
      },
      {
        id: 'stats.active_employees',
        name: '在职员工概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部在职员工统计卡片'
      },
      {
        id: 'stats.inactive_employees',
        name: '离职员工概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部离职员工统计卡片'
      },
      {
        id: 'stats.phone_completion',
        name: '电话留存概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已留电话员工统计卡片'
      },
      {
        id: 'employee.id',
        name: '员工ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工唯一标识',
        required: true
      },
      {
        id: 'employee.name',
        name: '员工姓名',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工真实姓名',
        required: true,
        searchable: true
      },
      {
        id: 'employee.phone',
        name: '手机号码',
        group: '联系方式',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工手机号码'
      },
      {
        id: 'employee.email',
        name: '邮箱',
        group: '联系方式',
        type: FIELD_TYPES.EMAIL,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工邮箱地址'
      },
      {
        id: 'employee.username',
        name: '用户名',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工登录用户名',
        required: true,
        searchable: true
      },
      {
        id: 'employee.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工状态（在职/离职）',
        filterable: true
      },
      {
        id: 'employee.role',
        name: '角色',
        group: '权限信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工角色名称'
      },
      {
        id: 'employee.role_ids',
        name: '角色分配',
        group: '权限信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工角色 ID 列表'
      },
      {
        id: 'employee.hire_date',
        name: '入职日期',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工入职日期'
      },
      {
        id: 'employee.last_login',
        name: '最后登录',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工最后登录时间'
      },
      {
        id: 'employee.salary_template_name',
        name: '工资模板',
        group: '薪资信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工关联工资模板名称'
      },
      {
        id: 'employee.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工记录创建时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  // 供应商管理模块字段
  suppliers: {
    name: '供应商管理',
    icon: 'fas fa-truck',
    category: '采购管理',
    fields: [
      {
        id: 'stats.total_suppliers',
        name: '供应商总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部供应商总数统计卡片'
      },
      {
        id: 'stats.active_suppliers',
        name: '正常供应商概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部正常供应商统计卡片'
      },
      {
        id: 'stats.inactive_suppliers',
        name: '禁用供应商概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用供应商统计卡片'
      },
      {
        id: 'stats.phone_completion',
        name: '电话留存概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已留电话供应商统计卡片'
      },
      {
        id: 'supplier.id',
        name: '供应商ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商唯一标识',
        required: true
      },
      {
        id: 'supplier.name',
        name: '供应商名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商公司名称',
        required: true,
        searchable: true
      },
      {
        id: 'supplier.contact_person',
        name: '联系人',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '主要联系人姓名'
      },
      {
        id: 'supplier.phone',
        name: '联系电话',
        group: '联系信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '供应商联系电话'
      },
      {
        id: 'supplier.address',
        name: '地址',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商地址'
      },
      {
        id: 'supplier.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商状态（合作中/停止合作）',
        filterable: true
      },
      {
        id: 'supplier.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'supplier.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商记录创建时间'
      },
      {
        id: 'supplier.bank_info',
        name: '银行信息',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '供应商银行账户信息'
      },
      {
        id: 'supplier.tax_number',
        name: '税号',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '供应商税号'
      },
      {
        id: 'supplier.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商备注信息'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 店铺管理模块字段
  stores: {
    name: '店铺管理',
    icon: 'fas fa-store',
    category: '业务管理',
    fields: [
      {
        id: 'stats.total_stores',
        name: '门店总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部门店总数统计卡片'
      },
      {
        id: 'stats.active_stores',
        name: '正常营业概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部正常营业门店统计卡片'
      },
      {
        id: 'stats.inactive_stores',
        name: '停用门店概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已禁用门店统计卡片'
      },
      {
        id: 'stats.phone_completion',
        name: '电话留存概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已留电话门店统计卡片'
      },
      {
        id: 'store.id',
        name: '店铺ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺唯一标识',
        required: true
      },
      {
        id: 'store.name',
        name: '店铺名称',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '店铺名称',
        required: true,
        searchable: true
      },
      {
        id: 'store.code',
        name: '店铺编码',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺内部编码'
      },
      {
        id: 'store.address',
        name: '店铺地址',
        group: '位置信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺详细地址'
      },
      {
        id: 'store.phone',
        name: '联系电话',
        group: '联系信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '店铺联系电话'
      },
      {
        id: 'store.manager',
        name: '店长',
        group: '人员信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺负责人'
      },
      {
        id: 'store.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺状态（营业中/停业）',
        filterable: true
      },
      {
        id: 'store.sort_order',
        name: '排序',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '显示排序'
      },
      {
        id: 'store.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺记录创建时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '可执行的操作',
        filterable: false
      }
    ]
  },

  // 客户管理模块字段
  customers: {
    name: '客户管理',
    icon: 'fas fa-users',
    category: '销售管理',
    fields: [
      {
        id: 'stats.total_customers',
        name: '总客户数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部总客户数统计卡片'
      },
      {
        id: 'stats.active_customers',
        name: '活跃客户概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部活跃客户统计卡片'
      },
      {
        id: 'stats.new_customers',
        name: '本月新增概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月新增统计卡片'
      },
      {
        id: 'stats.premium_customers',
        name: 'VIP客户概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部VIP客户统计卡片'
      },
      {
        id: 'customer.id',
        name: '客户ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户唯一标识',
        required: true
      },
      {
        id: 'customer.name',
        name: '客户姓名',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户真实姓名',
        required: true
      },
      {
        id: 'customer.phone',
        name: '手机号码',
        group: '联系方式',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户手机号码',
        required: true
      },
      {
        id: 'customer.id_card',
        name: '身份证号',
        group: '身份信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '客户身份证号码'
      },
      {
        id: 'customer.email',
        name: '邮箱',
        group: '联系方式',
        type: FIELD_TYPES.EMAIL,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户邮箱地址'
      },
      {
        id: 'customer.wechat',
        name: '微信',
        group: '联系方式',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户微信号'
      },
      {
        id: 'customer.qq',
        name: 'QQ',
        group: '联系方式',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户 QQ 号'
      },
      {
        id: 'customer.apple_id',
        name: 'Apple ID',
        group: '账户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户Apple ID账号'
      },
      {
        id: 'customer.address',
        name: '地址',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户地址'
      },
      {
        id: 'customer.customer_type',
        name: '客户类型',
        group: '基本信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户类型',
        filterable: true
      },
      {
        id: 'customer.vip_level',
        name: 'VIP等级',
        group: '会员信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户 VIP 等级',
        filterable: true
      },
      {
        id: 'customer.gender',
        name: '性别',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户性别'
      },
      {
        id: 'customer.birthday',
        name: '生日',
        group: '基本信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户生日'
      },
      {
        id: 'customer.balance',
        name: '余额',
        group: '账户信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户余额'
      },
      {
        id: 'customer.points',
        name: '积分',
        group: '账户信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户积分'
      },
      {
        id: 'customer.blacklist',
        name: '黑名单',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '是否为黑名单客户',
        filterable: true
      },
      {
        id: 'customer.city',
        name: '城市',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户所在城市'
      },
      {
        id: 'customer.province',
        name: '省份',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户所在省份'
      },
      {
        id: 'customer.remarks',
        name: '备注',
        group: '补充信息',
        type: FIELD_TYPES.TEXTAREA,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户备注信息'
      },
      {
        id: 'customer.purchase_count',
        name: '累计购买次数',
        group: '购买统计',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户历史购买次数'
      },
      {
        id: 'customer.total_spent',
        name: '累计消费金额',
        group: '购买统计',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户累计消费金额'
      },
      {
        id: 'customer.last_purchase_date',
        name: '最后购买日期',
        group: '购买统计',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户最后购买时间'
      },
      {
        id: 'customer.created_at',
        name: '注册时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户注册时间'
      },
      {
        id: 'customer.member_number',
        name: '会员号',
        group: '会员信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户会员编号',
        searchable: true
      },
      {
        id: 'customer.status',
        name: '状态',
        group: '基本信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户状态',
        filterable: true
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  payments: {
    name: '供应商打款',
    icon: 'fas fa-money-bill-wave',
    category: '财务管理',
    fields: [
      {
        id: 'stats.unpaid_count',
        name: '待打款手机概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部待打款手机统计卡片'
      },
      {
        id: 'stats.paid_count',
        name: '已打款手机概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已打款手机统计卡片'
      },
      {
        id: 'stats.total_count',
        name: '手机总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部手机总数统计卡片'
      },
      {
        id: 'payment.supplier_name',
        name: '供应商',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商名称',
        searchable: true
      },
      {
        id: 'payment.store_name',
        name: '店铺',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺名称'
      },
      {
        id: 'payment.brand_name',
        name: '品牌',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机品牌'
      },
      {
        id: 'payment.model_name',
        name: '型号',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机型号'
      },
      {
        id: 'payment.color_name',
        name: '颜色',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机颜色'
      },
      {
        id: 'payment.memory_name',
        name: '内存',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机内存规格'
      },
      {
        id: 'payment.serial_number',
        name: '序列号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备序列号'
      },
      {
        id: 'payment.imei',
        name: 'IMEI',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备 IMEI'
      },
      {
        id: 'payment.purchase_cost',
        name: '入库价格',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备入库成本'
      },
      {
        id: 'payment.sale_price',
        name: '销售价格',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备销售价格'
      },
      {
        id: 'payment.profit',
        name: '利润',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '销售利润'
      },
      {
        id: 'payment.sale_time',
        name: '销售时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售时间'
      },
      {
        id: 'payment.payment_status',
        name: '打款状态',
        group: '支付信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商打款状态',
        filterable: true
      },
      {
        id: 'payment.payment_time',
        name: '打款时间',
        group: '支付信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '打款时间'
      },
      {
        id: 'payment.payment_method',
        name: '打款方式',
        group: '支付信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '打款方式'
      },
      {
        id: 'payment.payment_operator',
        name: '打款人',
        group: '支付信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '打款操作人'
      },
      {
        id: 'payment.remarks',
        name: '打款备注',
        group: '支付信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商打款备注'
      },
      {
        id: 'payment.sale_status',
        name: '销售状态',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售状态筛选字段',
        filterable: true
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  permissions: {
    name: '权限管理',
    icon: 'fas fa-user-shield',
    category: '系统管理',
    fields: [
      {
        id: 'stats.total_roles',
        name: '角色总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部角色总数统计卡片'
      },
      {
        id: 'stats.total_users',
        name: '用户总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部用户总数统计卡片'
      },
      {
        id: 'stats.system_roles',
        name: '系统角色概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部系统角色统计卡片'
      },
      {
        id: 'stats.business_roles',
        name: '业务角色概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部业务角色统计卡片'
      },
      {
        id: 'stats.total_modules',
        name: '权限模块概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部权限模块统计卡片'
      },
      {
        id: 'stats.unregistered_modules',
        name: '待注册模块概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部待注册模块统计卡片'
      },
      {
        id: 'roles.id',
        name: '角色序号',
        group: '角色列表',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色列表序号'
      },
      {
        id: 'roles.name',
        name: '角色名称',
        group: '角色列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色名称'
      },
      {
        id: 'roles.code',
        name: '角色编码',
        group: '角色列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色编码'
      },
      {
        id: 'roles.description',
        name: '角色描述',
        group: '角色列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色描述'
      },
      {
        id: 'roles.status',
        name: '角色状态',
        group: '角色列表',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色启用状态'
      },
      {
        id: 'roles.user_count',
        name: '用户数量',
        group: '角色列表',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色关联用户数量'
      },
      {
        id: 'roles.created_at',
        name: '角色创建时间',
        group: '角色列表',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '角色创建时间'
      },
      {
        id: 'users.id',
        name: '用户序号',
        group: '用户列表',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户列表序号'
      },
      {
        id: 'users.username',
        name: '用户名',
        group: '用户列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '用户登录名'
      },
      {
        id: 'users.full_name',
        name: '用户姓名',
        group: '用户列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '用户真实姓名'
      },
      {
        id: 'users.roles',
        name: '用户角色',
        group: '用户列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户关联角色'
      },
      {
        id: 'users.status',
        name: '用户状态',
        group: '用户列表',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户启用状态'
      },
      {
        id: 'users.last_login',
        name: '最后登录时间',
        group: '用户列表',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户最后登录时间'
      },
      {
        id: 'store_bindings.id',
        name: '绑定序号',
        group: '门店绑定列表',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '门店绑定列表序号'
      },
      {
        id: 'store_bindings.username',
        name: '绑定用户名',
        group: '门店绑定列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '门店绑定用户登录名'
      },
      {
        id: 'store_bindings.name',
        name: '绑定用户姓名',
        group: '门店绑定列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '门店绑定用户姓名'
      },
      {
        id: 'store_bindings.roles',
        name: '绑定用户角色',
        group: '门店绑定列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '门店绑定用户角色'
      },
      {
        id: 'store_bindings.stores',
        name: '当前门店',
        group: '门店绑定列表',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户当前绑定门店'
      },
      {
        id: 'store_bindings.status',
        name: '绑定状态',
        group: '门店绑定列表',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '用户门店绑定状态'
      },
      {
        id: 'logs.id',
        name: '日志序号',
        group: '权限日志',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '权限日志序号'
      },
      {
        id: 'logs.action',
        name: '操作类型',
        group: '权限日志',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '权限日志操作类型'
      },
      {
        id: 'logs.username',
        name: '操作用户',
        group: '权限日志',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '权限日志操作用户'
      },
      {
        id: 'logs.description',
        name: '操作描述',
        group: '权限日志',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '权限日志操作描述'
      },
      {
        id: 'logs.ip_address',
        name: 'IP地址',
        group: '权限日志',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '权限日志来源 IP 地址'
      },
      {
        id: 'logs.created_at',
        name: '操作时间',
        group: '权限日志',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '权限日志操作时间'
      },
      {
        id: 'logs.status',
        name: '日志状态',
        group: '权限日志',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '权限日志执行状态'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  preorders: {
    name: '预定管理',
    icon: 'fas fa-clipboard-list',
    category: '销售管理',
    fields: [
      {
        id: 'stats.pending_count',
        name: '待匹配概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部待匹配统计卡片'
      },
      {
        id: 'stats.matched_count',
        name: '已匹配概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已匹配统计卡片'
      },
      {
        id: 'stats.delivered_count',
        name: '已交付概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已交付统计卡片'
      },
      {
        id: 'stats.cancelled_count',
        name: '已取消概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已取消统计卡片'
      },
      {
        id: 'basic_info.preorder_number',
        name: '预定单号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定业务单号',
        searchable: true
      },
      {
        id: 'supplier_info.supplier_name',
        name: '供应商',
        group: '供应商信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '匹配设备的供应商名称'
      },
      {
        id: 'store_info.store_name',
        name: '店铺',
        group: '店铺信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定所属店铺',
        filterable: true
      },
      {
        id: 'customer_info.customer_name',
        name: '客户姓名',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '预定客户姓名',
        searchable: true
      },
      {
        id: 'customer_info.customer_phone',
        name: '客户电话',
        group: '客户信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '预定客户联系电话',
        searchable: true
      },
      {
        id: 'product_info.brand_name',
        name: '品牌',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '预定商品品牌'
      },
      {
        id: 'product_info.model_name',
        name: '型号',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '预定商品型号'
      },
      {
        id: 'product_info.color_name',
        name: '颜色',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '预定商品颜色'
      },
      {
        id: 'product_info.memory_size',
        name: '内存',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '预定商品内存规格'
      },
      {
        id: 'product_info.is_new',
        name: '机况',
        group: '商品信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '全新或二手机况'
      },
      {
        id: 'product_info.imei',
        name: 'IMEI',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '已匹配设备 IMEI'
      },
      {
        id: 'product_info.serial_number',
        name: '设备序列号',
        group: '商品信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '匹配候选设备序列号'
      },
      {
        id: 'price_info.deposit_amount',
        name: '定金',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '客户已付定金'
      },
      {
        id: 'price_info.total_price',
        name: '约定销售价格',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '预定时约定的销售价格'
      },
      {
        id: 'price_info.matchable_sale_price',
        name: '匹配设备销售价',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '匹配候选设备的库存销售价'
      },
      {
        id: 'price_info.actual_price',
        name: '实际销售价格',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '交付时的实际销售价格'
      },
      {
        id: 'price_info.remaining_amount',
        name: '尾款',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '实际价格扣除定金后的尾款'
      },
      {
        id: 'status_info.status',
        name: '预定状态',
        group: '状态信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定单当前状态；取消与恢复动作归属此列',
        filterable: true
      },
      {
        id: 'time_info.expected_arrival',
        name: '预计到货日期',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预计到货日期'
      },
      {
        id: 'time_info.created_at',
        name: '预定时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定单创建时间'
      },
      {
        id: 'time_info.matched_time',
        name: '匹配时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备匹配时间；匹配动作归属此列'
      },
      {
        id: 'time_info.delivered_time',
        name: '交付时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定交付时间；交付动作归属此列'
      },
      {
        id: 'operator_info.operator_name',
        name: '操作员',
        group: '操作员信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定业务操作员'
      },
      {
        id: 'other_info.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '预定备注与取消原因'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '编辑和删除操作的列容器；匹配、交付、取消和恢复归属对应业务字段'
      }
    ]
  },

  shared: {
    name: '经验分享',
    icon: 'fas fa-lightbulb',
    category: '系统工具',
    fields: [
      { id: 'post_info.title', name: '标题', group: '分享内容', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '经验分享标题', searchable: true },
      { id: 'post_info.content', name: '内容', group: '分享内容', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '经验分享富文本内容', searchable: true },
      { id: 'post_info.category', name: '分类', group: '分享内容', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分享所属分类', filterable: true },
      { id: 'post_info.visibility', name: '可见范围', group: '分享内容', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '公开或仅自己可见', filterable: true },
      { id: 'post_info.attachments', name: '附件', group: '分享内容', type: FIELD_TYPES.JSON, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '正文图片、视频、音频和文件；上传与下载归属此字段' },
      { id: 'post_info.is_pinned', name: '置顶状态', group: '分享内容', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分享是否置顶；置顶动作归属此字段' },
      { id: 'author_info.author', name: '发布人', group: '发布信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分享发布人' },
      { id: 'time_info.created_at', name: '发布时间', group: '发布信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分享发布时间' },
      { id: 'time_info.updated_at', name: '更新时间', group: '发布信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分享最后更新时间' },
      { id: 'category_info.name', name: '分类名称', group: '分类管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分类管理中的分类名称' },
      { id: 'category_info.total', name: '分类内容数', group: '分类管理', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分类下当前可见分享数' },
      { id: 'category_info.sort_order', name: '分类排序', group: '分类管理', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分类排序值' },
      { id: 'category_info.operations', name: '分类操作', group: '分类管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '分类编辑和删除操作' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '查看、编辑和删除操作；置顶归属置顶字段' }
    ]
  },

  reminders: {
    name: '待办提醒',
    icon: 'fas fa-bell',
    category: '系统工具',
    fields: [
      { id: 'stats.total', name: '待办总数概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办记录总数' },
      { id: 'stats.active_count', name: '启用中概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前页启用中待办数' },
      { id: 'stats.completed_count', name: '完成数概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前页累计完成数' },
      { id: 'stats.ignored_count', name: '忽略数概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前页累计忽略数' },
      { id: 'basic_info.sequence', name: '序号', group: '基本信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前分页显示序号' },
      { id: 'basic_info.title', name: '事项标题', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办标题', searchable: true },
      { id: 'basic_info.content', name: '详细内容', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办执行要求', searchable: true },
      { id: 'basic_info.priority', name: '优先级', group: '基本信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办优先级' },
      { id: 'type_info.type_name', name: '事项类型', group: '类型信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办事项类型', filterable: true },
      { id: 'type_info.default_remind_days', name: '类型默认提前天数', group: '类型信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '事项类型的默认提前提醒天数' },
      { id: 'type_info.type_color', name: '类型颜色', group: '类型信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '事项类型识别颜色' },
      { id: 'type_info.type_icon', name: '类型图标', group: '类型信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '事项类型图标' },
      { id: 'type_info.sort_order', name: '类型排序', group: '类型信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '事项类型排序值' },
      { id: 'type_info.is_active', name: '类型状态', group: '类型信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '事项类型是否启用' },
      { id: 'type_info.operations', name: '类型操作', group: '类型信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '类型编辑和删除操作列' },
      { id: 'target_info.target_mode', name: '接收范围', group: '接收人信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '全体员工或指定员工' },
      { id: 'target_info.target_users', name: '指定员工', group: '接收人信息', type: FIELD_TYPES.JSON, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '待办接收人及联系信息' },
      { id: 'target_info.target_count', name: '接收人数', group: '接收人信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办接收人数量' },
      { id: 'repeat_info.repeat_type', name: '重复方式', group: '重复规则', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '不重复、每天、每周、每月或每年' },
      { id: 'repeat_info.interval_value', name: '间隔周期', group: '重复规则', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '重复执行间隔' },
      { id: 'repeat_info.weekdays', name: '每周执行日', group: '重复规则', type: FIELD_TYPES.JSON, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '每周执行的星期列表' },
      { id: 'repeat_info.end_type', name: '结束方式', group: '重复规则', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '永不结束、指定日期或执行次数' },
      { id: 'repeat_info.end_at', name: '结束日期', group: '重复规则', type: FIELD_TYPES.DATE, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '重复待办结束日期' },
      { id: 'repeat_info.occurrence_limit', name: '执行次数', group: '重复规则', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '重复待办最大执行次数' },
      { id: 'schedule_info.start_at', name: '提醒时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办开始执行时间' },
      { id: 'schedule_info.next_occurrence_at', name: '下次执行', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '下一次计划执行时间' },
      { id: 'schedule_info.remind_before_days', name: '提前提醒', group: '时间信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '提前多少天发出提醒' },
      { id: 'schedule_info.remind_at', name: '发出提醒时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '实际进入提醒队列的时间' },
      { id: 'execution_info.completed_count', name: '完成数', group: '执行信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '已完成执行数' },
      { id: 'execution_info.ignored_count', name: '忽略数', group: '执行信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '已忽略执行数' },
      { id: 'execution_info.scheduled_at', name: '执行日期', group: '执行信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '单次执行计划时间' },
      { id: 'execution_info.recipient_user', name: '执行员工', group: '执行信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '单次执行所属员工' },
      { id: 'execution_info.recipient_status', name: '执行状态', group: '执行信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待处理、已读、稍后提醒、忽略或完成；提醒处理动作归属此字段' },
      { id: 'execution_info.action_at', name: '操作日期', group: '执行信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '执行人最后处理时间' },
      { id: 'status_info.status', name: '待办状态', group: '状态信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办是否启用', filterable: true },
      { id: 'operator_info.creator_name', name: '创建人', group: '操作员信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办创建人' },
      { id: 'time_info.created_at', name: '创建时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办创建时间' },
      { id: 'time_info.updated_at', name: '更新时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待办更新时间' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '查看、编辑和删除操作列' }
    ]
  },

  accessories: {
    name: '配件管理',
    icon: 'fas fa-box',
    category: '库存管理',
    fields: [
      { id: 'basic_info.sequence', name: '序号', group: '基本信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前分页中的显示序号' },
      { id: 'basic_info.name', name: '配件名称', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件名称', searchable: true },
      { id: 'basic_info.barcode', name: '条形码', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件条形码', searchable: true },
      { id: 'basic_info.batch_no', name: '入库批次号', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件入库批次号' },
      { id: 'basic_info.category', name: '分类', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件分类', filterable: true },
      { id: 'basic_info.brand_name', name: '品牌', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '适用品牌' },
      { id: 'basic_info.model_name', name: '型号', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '适用型号' },
      { id: 'basic_info.color_name', name: '颜色', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '配件颜色' },
      { id: 'basic_info.supplier_name', name: '供应商', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件供应商' },
      { id: 'basic_info.unit', name: '单位', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '库存计量单位' },
      { id: 'basic_info.specifications', name: '规格', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '配件规格' },
      { id: 'basic_info.image_url', name: '配件图片', group: '基本信息', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件图片' },
      { id: 'price_info.purchase_cost', name: '进价', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '采购成本' },
      { id: 'price_info.sale_price', name: '售价', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '销售价格' },
      { id: 'price_info.profit', name: '毛利', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '售价减进价的派生毛利' },
      { id: 'price_info.unit_price', name: '销售单价', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '配件销售时的单价' },
      { id: 'price_info.total_amount', name: '入库总额', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '本次配件入库总额' },
      { id: 'price_info.total_price', name: '销售总额', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '本次配件销售总额' },
      { id: 'stock_info.total_stock', name: '总库存', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '各门店库存合计' },
      { id: 'stock_info.total_in', name: '累计入库', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '累计入库数量' },
      { id: 'stock_info.total_out', name: '累计已售', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '累计出库数量' },
      { id: 'stock_info.remaining_stock', name: '剩余库存', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '累计入库减累计出库的剩余数量' },
      { id: 'stock_info.min_stock', name: '预警值', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '低库存预警阈值' },
      { id: 'stock_info.total_quantity', name: '入库总数', group: '库存信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '本次入库总数量' },
      { id: 'stock_info.distribution', name: '门店分配', group: '库存信息', type: FIELD_TYPES.JSON, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '本次入库门店分配' },
      { id: 'stock_info.stock_status', name: '库存状态', group: '库存信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前库存是否低于预警值' },
      { id: 'customer_info.customer_name', name: '客户姓名', group: '客户信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '配件销售客户姓名' },
      { id: 'customer_info.customer_phone', name: '客户电话', group: '客户信息', type: FIELD_TYPES.PHONE, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '配件销售客户电话' },
      { id: 'status_info.status', name: '状态', group: '状态信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件启用状态', filterable: true },
      { id: 'other_info.description', name: '描述', group: '其他信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件描述' },
      { id: 'other_info.remarks', name: '备注', group: '其他信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件及入库备注' },
      { id: 'time_info.created_at', name: '创建时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件创建时间' },
      { id: 'time_info.updated_at', name: '更新时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件更新时间' },
      { id: 'time_info.inventory_time', name: '入库时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件完成入库的时间', filterable: true },
      { id: 'operator_info.operator_name', name: '经办人', group: '操作员信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配件入库或销售经办人' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '详情、编辑和删除操作列' }
    ]
  },
  rentals: {
    name: '租赁管理',
    icon: 'fas fa-file-contract',
    category: '销售管理',
    fields: [
      { id: 'stats.active_count', name: '进行中合同概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '进行中的租赁合同数量' },
      { id: 'stats.device_count', name: '租赁设备概览', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '当前租赁设备数量' },
      { id: 'stats.receivable_amount', name: '待付租金概览', group: '统计概览', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '当前待付租金合计' },
      { id: 'stats.deposit_amount', name: '在租押金概览', group: '统计概览', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '当前在租押金合计' },
      { id: 'contract_info.contract_number', name: '合同编号', group: '合同信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '租赁合同编号', searchable: true },
      { id: 'contract_info.billing_mode', name: '合同类型', group: '合同信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '按天租赁或到期买断', filterable: true },
      { id: 'contract_info.contract_files', name: '签字合同', group: '合同信息', type: FIELD_TYPES.JSON, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '签字合同附件' },
      { id: 'customer_info.customer_name', name: '客户姓名', group: '客户信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '承租客户姓名', searchable: true },
      { id: 'customer_info.customer_phone', name: '客户电话', group: '客户信息', type: FIELD_TYPES.PHONE, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '承租客户手机号', searchable: true },
      { id: 'customer_info.customer_id_card', name: '客户身份证', group: '客户信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '承租客户身份证号' },
      { id: 'device_info.brand', name: '设备品牌', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '租赁设备品牌' },
      { id: 'device_info.model', name: '设备型号', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '租赁设备型号' },
      { id: 'device_info.color', name: '设备颜色', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '租赁设备颜色' },
      { id: 'device_info.memory', name: '设备内存', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '租赁设备内存规格' },
      { id: 'device_info.imei', name: 'IMEI', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '租赁设备 IMEI', searchable: true },
      { id: 'device_info.serial_number', name: '序列号', group: '设备信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '租赁设备序列号', searchable: true },
      { id: 'price_info.sale_price', name: '销售价格', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '设备销售价格' },
      { id: 'price_info.purchase_cost', name: '入库价格', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断销售使用的设备入库价格' },
      { id: 'price_info.unit_price', name: '每日租金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '按天租赁单价' },
      { id: 'price_info.down_payment', name: '首付', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断合同首付' },
      { id: 'price_info.principal_amount', name: '剩余本金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断合同剩余本金' },
      { id: 'price_info.monthly_principal', name: '每期本金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断合同每期本金' },
      { id: 'price_info.monthly_rent', name: '每月租金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断合同每月租金' },
      { id: 'price_info.installment_amount', name: '每期应收', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '买断合同每期应收金额' },
      { id: 'price_info.deposit', name: '押金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '租赁押金' },
      { id: 'price_info.paid_rent', name: '已付租金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '已登记租金合计' },
      { id: 'price_info.payable_rent', name: '待付租金', group: '价格信息', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '当前待付租金；还款动作归属此列' },
      { id: 'schedule_info.term_months', name: '分期期数', group: '还款信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断合同分期期数' },
      { id: 'schedule_info.rented_days', name: '已租天数', group: '还款信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '按天租赁已租天数' },
      { id: 'schedule_info.remaining_periods', name: '剩余期数', group: '还款信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断合同剩余期数' },
      { id: 'schedule_info.next_due_date', name: '下次还款日', group: '还款信息', type: FIELD_TYPES.DATE, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '下一期应还日期' },
      { id: 'status_info.status', name: '合同状态', group: '状态信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '租赁合同状态；归还动作归属此列', filterable: true },
      { id: 'status_info.monitoring_lock', name: '监管锁', group: '状态信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '是否安装监管锁' },
      { id: 'time_info.start_date', name: '开始日期', group: '时间信息', type: FIELD_TYPES.DATE, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '租赁或销售开始日期' },
      { id: 'time_info.end_date', name: '结束日期', group: '时间信息', type: FIELD_TYPES.DATE, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '约定结束日期' },
      { id: 'time_info.returned_at', name: '归还时间', group: '时间信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '设备实际归还时间' },
      { id: 'sales_info.sale_invoice_number', name: '销售订单', group: '销售信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断关联销售订单' },
      { id: 'sales_info.sale_store_name', name: '销售店铺', group: '销售信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断销售店铺' },
      { id: 'sales_info.sale_operator_name', name: '销售员', group: '销售信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断销售员' },
      { id: 'sales_info.sale_payment_method', name: '支付方式', group: '销售信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '买断销售支付方式' },
      { id: 'sales_info.sale_payment_channel', name: '支付渠道', group: '销售信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '买断销售支付渠道' },
      { id: 'sales_info.sale_remarks', name: '销售备注', group: '销售信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '买断销售备注' },
      { id: 'operator_info.operator_name', name: '经办人', group: '操作员信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '租赁合同经办人' },
      { id: 'other_info.remarks', name: '合同备注', group: '其他信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '租赁合同备注' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '查看和编辑操作的列容器；还款与归还归属业务字段' }
    ]
  },

  repairs: {
    name: '维修管理',
    icon: 'fas fa-tools',
    category: '售后管理',
    fields: [
      {
        id: 'stats.pending',
        name: '待维修概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部待维修统计卡片'
      },
      {
        id: 'stats.processing',
        name: '维修中概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部维修中统计卡片'
      },
      {
        id: 'stats.completed',
        name: '已完成概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已完成统计卡片'
      },
      {
        id: 'stats.monthly_revenue',
        name: '本月收入概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部本月收入统计卡片'
      },
      {
        id: 'basic_info.order_no',
        name: '维修单号',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修业务单号',
        searchable: true
      },
      {
        id: 'customer_info.customer_name',
        name: '客户姓名',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '送修客户姓名',
        searchable: true
      },
      {
        id: 'customer_info.customer_phone',
        name: '客户电话',
        group: '客户信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '送修客户联系电话',
        searchable: true
      },
      {
        id: 'device_info.brand_name',
        name: '手机品牌',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '送修设备品牌'
      },
      {
        id: 'device_info.phone_model',
        name: '手机型号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '送修设备型号',
        searchable: true
      },
      {
        id: 'device_info.imei',
        name: 'IMEI/序列号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '送修设备识别码',
        searchable: true
      },
      {
        id: 'repair_info.problem_description',
        name: '故障描述',
        group: '维修信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户描述的设备故障'
      },
      {
        id: 'repair_info.technician_name',
        name: '维修员',
        group: '维修信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '负责维修的员工'
      },
      {
        id: 'price_info.estimated_cost',
        name: '预计费用',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '维修预计收费金额'
      },
      {
        id: 'price_info.actual_cost',
        name: '实际费用',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '维修实际收费金额'
      },
      {
        id: 'status_info.status',
        name: '维修状态',
        group: '状态信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修进度；状态更新动作归属此列',
        filterable: true
      },
      {
        id: 'other_info.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修备注'
      },
      {
        id: 'time_info.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修单创建时间'
      },
      {
        id: 'time_info.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修单最后更新时间'
      },
      {
        id: 'time_info.completed_at',
        name: '完成时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '维修完成时间'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '详情和编辑操作的列容器；状态更新归属维修状态字段'
      }
    ]
  },

  menu: {
    name: '菜单管理',
    icon: 'fas fa-bars',
    category: '系统管理',
    fields: [
      {
        id: 'stats.total_menus',
        name: '菜单总数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部菜单总数统计卡片'
      },
      {
        id: 'stats.active_menus',
        name: '启用菜单概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部启用菜单统计卡片'
      },
      {
        id: 'stats.inactive_menus',
        name: '禁用菜单概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部禁用菜单统计卡片'
      },
      {
        id: 'stats.root_menus',
        name: '根菜单概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部根菜单统计卡片'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  price_list: {
    name: '价目表日志',
    icon: 'fas fa-history',
    category: '价格管理',
    fields: [
      {
        id: 'stats.success_count',
        name: '成功次数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部成功次数统计卡片'
      },
      {
        id: 'stats.fail_count',
        name: '失败次数概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部失败次数统计卡片'
      },
      {
        id: 'stats.total_records',
        name: '同步总记录概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部同步总记录统计卡片'
      },
      {
        id: 'stats.avg_duration',
        name: '平均耗时概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部平均耗时统计卡片'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  marketing: {
    name: '营销管理',
    icon: 'fas fa-bullhorn',
    category: '营销管理',
    fields: [
      { id: 'filters.mode', name: '文案模式', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '营业或销售文案模式' },
      { id: 'filters.condition', name: '机况筛选', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '全新或二手机况' },
      { id: 'filters.brand', name: '品牌筛选', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '文案商品品牌' },
      { id: 'filters.model', name: '型号筛选', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '文案商品型号' },
      { id: 'filters.color', name: '颜色筛选', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '文案商品颜色' },
      { id: 'filters.memory', name: '内存筛选', group: '文案筛选', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '文案商品内存规格' },
      { id: 'context.auto_context', name: '自动应景信息', group: '应景信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '定位、天气、节日和时间段信息' },
      { id: 'context.subsidy', name: '国补开关', group: '应景信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '是否在文案中使用国补词库' },
      { id: 'context.color', name: '颜色开关', group: '应景信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '是否在文案中使用颜色词库' },
      { id: 'context.weather', name: '天气开关', group: '应景信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '是否在文案中使用天气词库' },
      { id: 'context.solar_term', name: '节气开关', group: '应景信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '是否在文案中使用节气词库' },
      { id: 'context.preview', name: '文案预览', group: '应景信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '营销文案预览卡片' },
      { id: 'lexicon.type', name: '类型词库', group: '词库管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '营销类型语录' },
      { id: 'lexicon.mode', name: '模式词库', group: '词库管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '营业和销售模式语录' },
      { id: 'lexicon.context', name: '应景词库', group: '词库管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '天气、节气、节日等应景词库' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '打开公开页、定位和词库保存操作' }
    ]
  },

  system: {
    name: '系统管理',
    icon: 'fas fa-cogs',
    category: '系统管理',
    fields: [
      { id: 'settings.site_info', name: '站点信息', group: '站点设置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '站点名称、描述和基础信息' },
      { id: 'settings.logo', name: '站点Logo', group: '站点设置', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '站点 Logo 上传和预览' },
      { id: 'settings.price_watermark', name: '报价水印', group: '报价设置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '报价页面水印配置' },
      { id: 'settings.passwords', name: '库存密码', group: '安全设置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '库存密码管理' },
      { id: 'screen_lock.config', name: '锁屏配置', group: '锁屏设置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '锁屏背景、标题和提示配置' },
      { id: 'warning.config', name: '库存预警配置', group: '预警设置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '库存预警配置子页面' },
      { id: 'returngoods.records', name: '退库记录', group: '退库管理', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库记录子页面' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '系统刷新、保存和页签操作' }
    ]
  },

  backup: {
    name: '数据备份',
    icon: 'fas fa-database',
    category: '系统工具',
    fields: [
      { id: 'backup.name', name: '备份名称', group: '备份记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '备份记录名称' },
      { id: 'backup.created_at', name: '备份时间', group: '备份记录', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '备份创建时间' },
      { id: 'backup.size', name: '备份大小', group: '备份记录', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '备份文件大小' },
      { id: 'backup.keep_count', name: '保留数量', group: '清理设置', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '临时备份清理保留数量' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '备份、下载、恢复和清理操作' }
    ]
  },

  returngoods: {
    name: '退库管理',
    icon: 'fas fa-undo',
    category: '系统业务',
    fields: [
      { id: 'filters.keyword', name: '关键词筛选', group: '筛选区', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库记录关键词筛选', filterable: true },
      { id: 'filters.date_range', name: '日期筛选', group: '筛选区', type: FIELD_TYPES.DATE, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库日期范围筛选', filterable: true },
      { id: 'stats.summary', name: '退库统计', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库记录统计' },
      { id: 'record.product_info', name: '商品信息', group: '退库记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '设备和 IMEI 信息' },
      { id: 'record.customer', name: '客户', group: '退库记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '原销售客户信息' },
      { id: 'record.operator', name: '操作员', group: '退库记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库操作员信息' },
      { id: 'record.sale_info', name: '原销售信息', group: '退库记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '原销售 ID、类型和销售员' },
      { id: 'record.reversal_date', name: '退库时间', group: '退库记录', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库时间' },
      { id: 'record.remarks', name: '备注', group: '退库记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库备注' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '退库记录编辑、删除和刷新操作' }
    ]
  },

  phone_warning_config: {
    name: '库存预警配置',
    icon: 'fas fa-bell',
    category: '系统设置',
    fields: [
      { id: 'filters.search', name: '模板搜索', group: '筛选区', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '品牌、型号和模板搜索', filterable: true },
      { id: 'config.template_info', name: '预警模板信息', group: '预警配置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '型号母模板信息' },
      { id: 'config.color', name: '颜色规则', group: '预警配置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '颜色维度预警规则' },
      { id: 'config.memory', name: '内存规则', group: '预警配置', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '内存维度预警规则' },
      { id: 'config.condition', name: '库存类型规则', group: '预警配置', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '全新和二手库存规则' },
      { id: 'config.threshold', name: '预警台数', group: '预警配置', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '库存预警阈值' },
      { id: 'config.is_enabled', name: '启用状态', group: '预警配置', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '预警规则启用状态' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '预警配置编辑、删除和保存操作' }
    ]
  },

  system_gitmanagement: {
    name: 'Git管理',
    icon: 'fas fa-code-branch',
    category: '系统管理',
    fields: [
      {
        id: 'stats.current_branch',
        name: '当前分支概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部当前分支统计卡片'
      },
      {
        id: 'stats.changed_files',
        name: '更改文件概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部更改文件统计卡片'
      },
      {
        id: 'stats.workspace_status',
        name: '工作区状态概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部工作区状态统计卡片'
      },
      {
        id: 'stats.commit_count',
        name: '提交记录概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部提交记录统计卡片'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  analytics: {
    name: '数据分析',
    icon: 'fas fa-chart-line',
    category: '分析中心',
    fields: [
      {
        id: 'sales.tab_access',
        name: '销售分析页签',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售分析子页面入口与页签显示控制'
      },
      {
        id: 'sales.total_sales',
        name: '总销售额',
        group: '销售分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '销售分析顶部概览中的总销售额'
      },
      {
        id: 'sales.total_orders',
        name: '总订单数',
        group: '销售分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售分析顶部概览中的总订单数'
      },
      {
        id: 'sales.new_sales_count',
        name: '全新机销售',
        group: '销售分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '全新机销量及销售额概览'
      },
      {
        id: 'sales.used_sales_count',
        name: '二手机销售',
        group: '销售分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '二手机销量及销售额概览'
      },
      {
        id: 'sales.average_order_value',
        name: '平均客单价',
        group: '销售分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售分析中的平均客单价'
      },
      {
        id: 'sales.conversion_rate',
        name: '转化率',
        group: '销售分析',
        type: FIELD_TYPES.PERCENTAGE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售分析中的销售转化率'
      },
      {
        id: 'sales.sales_trend_chart',
        name: '销售趋势图',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售趋势图表区域'
      },
      {
        id: 'sales.product_distribution_chart',
        name: '产品销售分布',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '产品销售分布图表区域'
      },
      {
        id: 'sales.top_products_table',
        name: '热销产品排行',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '热销产品排行表格'
      },
      {
        id: 'sales.store_comparison_chart',
        name: '店铺销售对比',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺销售对比图表'
      },
      {
        id: 'sales.sales_forecast_chart',
        name: '销售预测',
        group: '销售分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售预测图表区域'
      },

      {
        id: 'inventory.total_products',
        name: '在库总数',
        group: '库存分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存分析中的在库总数概览'
      },
      {
        id: 'inventory.tab_access',
        name: '库存分析页签',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存分析子页面入口与页签显示控制'
      },
      {
        id: 'inventory.total_value',
        name: '在库价值',
        group: '库存分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '库存分析中的总库存价值'
      },
      {
        id: 'inventory.warning_summary',
        name: '库存预警概览',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存预警概览卡片及预警汇总'
      },
      {
        id: 'inventory.supplier_count',
        name: '有货供应商',
        group: '库存分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存分析中的供应商概览'
      },
      {
        id: 'inventory.low_stock_dialog',
        name: '库存不足详情',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存不足详情弹窗表格'
      },
      {
        id: 'inventory.recent_sales_table',
        name: '最近销售型号',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '最近销售的10个型号表格'
      },
      {
        id: 'inventory.category_distribution_chart',
        name: '分类库存分析',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '分类库存分析图表'
      },
      {
        id: 'inventory.turnover_trend_chart',
        name: '库存周转趋势',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存周转趋势图表'
      },
      {
        id: 'inventory.low_stock_table',
        name: '库存预警表格',
        group: '库存分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '库存预警明细表格'
      },

      {
        id: 'customer.overview_stats',
        name: '客户概览',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户总量、增长、活跃等顶部统计'
      },
      {
        id: 'customer.tab_access',
        name: '客户分析页签',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户分析子页面入口与页签显示控制'
      },
      {
        id: 'customer.growth_chart',
        name: '客户增长趋势',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户增长趋势图表'
      },
      {
        id: 'customer.segment_chart',
        name: '客户细分分布',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户细分分布图表'
      },
      {
        id: 'customer.retention_chart',
        name: '客户留存分析',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户留存率图表'
      },
      {
        id: 'customer.activity_chart',
        name: '客户活跃度',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户活跃度图表'
      },
      {
        id: 'customer.customer_list',
        name: '客户列表',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户明细列表及相关字段'
      },
      {
        id: 'customer.customer_detail',
        name: '客户详情分析',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户趋势和偏好详情图表'
      },
      {
        id: 'customer.behavior_insights',
        name: '客户行为洞察',
        group: '客户分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户洞察卡片和建议列表'
      },

      {
        id: 'employee.overview_stats',
        name: '员工概览',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工分析顶部统计卡片'
      },
      {
        id: 'employee.tab_access',
        name: '员工分析页签',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工分析子页面入口与页签显示控制'
      },
      {
        id: 'employee.role_distribution_chart',
        name: '角色分布',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工角色分布图表'
      },
      {
        id: 'employee.sales_compare_chart',
        name: '销售对比',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工销售对比图表'
      },
      {
        id: 'employee.salary_trend_chart',
        name: '工资趋势',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工工资趋势图表'
      },
      {
        id: 'employee.attendance_chart',
        name: '出勤分析',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工出勤分析图表'
      },
      {
        id: 'employee.performance_table',
        name: '员工绩效表',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工绩效排行表格'
      },
      {
        id: 'employee.attendance_records_table',
        name: '考勤记录表',
        group: '员工分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工考勤记录表格'
      },

      {
        id: 'transfer.wholesale_count',
        name: '批发数量',
        group: '划拨批发',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '划拨批发顶部概览中的批发数量'
      },
      {
        id: 'transfer.tab_access',
        name: '划拨批发页签',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '划拨批发子页面入口与页签显示控制'
      },
      {
        id: 'transfer.wholesale_profit',
        name: '批发利润',
        group: '划拨批发',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '划拨批发顶部概览中的批发利润'
      },
      {
        id: 'transfer.allocation_count',
        name: '划拨数量',
        group: '划拨批发',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '划拨批发顶部概览中的划拨数量'
      },
      {
        id: 'transfer.allocation_amount',
        name: '划拨金额',
        group: '划拨批发',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '划拨批发顶部概览中的划拨金额'
      },
      {
        id: 'transfer.trend_chart',
        name: '调货趋势分析',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '调货趋势分析图表'
      },
      {
        id: 'transfer.wholesale_rank_chart',
        name: '批发机型排行',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '批发机型排行图表'
      },
      {
        id: 'transfer.allocation_rank_chart',
        name: '划拨机型排行',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '划拨机型排行图表'
      },
      {
        id: 'transfer.store_distribution_chart',
        name: '店铺分布',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '店铺划拨批发分布图表'
      },
      {
        id: 'transfer.operation_records_table',
        name: '最近操作记录',
        group: '划拨批发',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '划拨批发最近操作记录表格'
      },

      {
        id: 'profit.date_range',
        name: '日期筛选',
        group: '盈利分析',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '盈利分析中的开始和结束日期筛选',
        filterable: true
      },
      {
        id: 'profit.tab_access',
        name: '盈利分析页签',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '盈利分析子页面入口与页签显示控制'
      },
      {
        id: 'profit.quick_select',
        name: '快捷筛选',
        group: '盈利分析',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '盈利分析中的快捷时间筛选',
        filterable: true
      },
      {
        id: 'profit.store_filter',
        name: '店铺筛选',
        group: '盈利分析',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '盈利分析中的店铺筛选',
        filterable: true
      },
      {
        id: 'profit.total_revenue',
        name: '总销售额',
        group: '盈利分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '盈利分析顶部概览中的总销售额'
      },
      {
        id: 'profit.total_cost',
        name: '总成本',
        group: '盈利分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '盈利分析顶部概览中的总成本'
      },
      {
        id: 'profit.gross_profit',
        name: '销售利润',
        group: '盈利分析',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '盈利分析顶部概览中的销售利润'
      },
      {
        id: 'profit.total_sales_count',
        name: '总销售量',
        group: '盈利分析',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '盈利分析顶部概览中的总销售量'
      },
      {
        id: 'profit.new_sales_stats',
        name: '全新销售数据',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '全新销售数据统计卡片'
      },
      {
        id: 'profit.used_sales_stats',
        name: '二手销售数据',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '二手销售数据统计卡片'
      },
      {
        id: 'profit.brand_ranking',
        name: '品牌销量排行',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '品牌销量排行 TOP10'
      },
      {
        id: 'profit.model_ranking',
        name: '型号销量排行',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '型号销量排行 TOP10'
      },
      {
        id: 'profit.store_profit_ranking',
        name: '门店盈利排行',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '门店盈利排行及对比分析'
      },
      {
        id: 'profit.employee_performance_table',
        name: '员工业绩统计',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '盈利分析中的员工业绩统计表格'
      },
      {
        id: 'profit.metrics_cards',
        name: '利润指标卡片',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '净利润率、门店利润、人均产值等指标卡片'
      },
      {
        id: 'profit.profit_trend_chart',
        name: '盈利趋势图',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '销售额、成本和利润趋势图表'
      },
      {
        id: 'profit.forecast_chart',
        name: '盈利预测',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '盈利预测分析图表'
      },
      {
        id: 'profit.product_profit_chart',
        name: '产品利润贡献',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '产品利润贡献 TOP10 图表'
      },
      {
        id: 'profit.store_comparison_chart',
        name: '店铺利润对比',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '店铺利润对比图表'
      },
      {
        id: 'profit.cost_analysis_table',
        name: '成本构成分析',
        group: '盈利分析',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '成本构成分析表格'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '导出、切换、刷新等页面操作控制'
      }
    ]
  },

  dashboard: {
    name: '仪表盘',
    icon: 'fas fa-tachometer-alt',
    category: '系统首页',
    fields: [
      { id: 'stats.today_sales', name: '今日销售', group: '统计概览', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '今日销售金额统计卡片' },
      { id: 'stats.total_customers', name: '客户总数', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '客户总数统计卡片' },
      { id: 'stats.total_products', name: '库存商品', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '在库手机数量统计卡片' },
      { id: 'stats.pending_repairs', name: '待维修', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '待维修数量统计卡片' },
      { id: 'stats.inventory_alert', name: '库存预警', group: '统计概览', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '库存预警提示' },
      { id: 'stats.urgent_repairs', name: '紧急维修', group: '统计概览', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '紧急维修数量提示' },
      { id: 'warnings.comprehensive', name: '综合预警', group: '业务提醒', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '综合库存预警区域' },
      { id: 'warnings.pending_approvals', name: '待审批提醒', group: '业务提醒', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '待审批提醒区域' },
      { id: 'actions.quick_actions', name: '快速操作', group: '快捷入口', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '仪表盘快捷操作区域' },
      { id: 'activities.recent', name: '最近活动', group: '活动记录', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '最近活动列表' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '刷新、跳转和详情操作' }
    ]
  },

  data_optimization: {
    name: '数据优化',
    icon: 'fas fa-tools',
    category: '系统工具',
    fields: [
      {
        id: 'check.tab_access',
        name: '数据检查页签',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '数据检查子页面入口与页签显示控制'
      },
      {
        id: 'check.action_check_all',
        name: '综合检查操作',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '综合检查按钮与入口'
      },
      {
        id: 'check.action_statistics',
        name: '数据统计操作',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '数据统计按钮与入口'
      },
      {
        id: 'check.check_cards',
        name: '检查卡片区',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '快捷检查卡片列表'
      },
      {
        id: 'check.all_data_table',
        name: '全部数据表格',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '所有数据列表与分页区域'
      },
      {
        id: 'check.duplicates_list',
        name: '重复数据处理区',
        group: '数据检查',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '重复数据列表与处理按钮'
      },
      {
        id: 'import.tab_access',
        name: '数据导入页签',
        group: '数据导入',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '数据导入子页面入口与页签显示控制'
      },
      {
        id: 'import.import_history',
        name: '导入历史',
        group: '数据导入',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '导入历史按钮与历史记录入口'
      },
      {
        id: 'import.upload_panel',
        name: '上传面板',
        group: '数据导入',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: 'Excel 上传与分析入口'
      },
      {
        id: 'import.analysis_summary',
        name: '分析结果概览',
        group: '数据导入',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '分析结果摘要与差异预览'
      },
      {
        id: 'import.strategy_selection',
        name: '导入策略选择',
        group: '数据导入',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '导入策略卡片与确认区域'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页签切换、导入、同步等页面操作控制'
      }
    ]
  },

  h5_admin_ordersview: {
    name: '商城订单',
    icon: 'fas fa-shopping-cart',
    category: 'H5管理',
    fields: [
      {
        id: 'stats.total_orders',
        name: '全部订单概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '全部订单统计卡片'
      },
      {
        id: 'stats.pending_orders',
        name: '待支付概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '待支付订单统计卡片'
      },
      {
        id: 'stats.paid_orders',
        name: '待审核概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '待审核订单统计卡片'
      },
      {
        id: 'stats.confirmed_orders',
        name: '待发货概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '待发货订单统计卡片'
      },
      {
        id: 'stats.shipped_orders',
        name: '已发货概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '已发货订单统计卡片'
      },
      {
        id: 'stats.completed_orders',
        name: '已完成概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '已完成订单统计卡片'
      },
      {
        id: 'filters.status',
        name: '订单状态筛选',
        group: '筛选区',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '订单状态筛选条件',
        filterable: true
      },
      {
        id: 'filters.customer_name',
        name: '客户姓名筛选',
        group: '筛选区',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户姓名筛选条件',
        filterable: true
      },
      {
        id: 'filters.customer_phone',
        name: '客户电话筛选',
        group: '筛选区',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户电话筛选条件',
        filterable: true
      },
      {
        id: 'filters.order_number',
        name: '订单号筛选',
        group: '筛选区',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '订单号筛选条件',
        filterable: true
      },
      {
        id: 'filters.date_range',
        name: '下单时间筛选',
        group: '筛选区',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '下单时间范围筛选',
        filterable: true
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '刷新、模板管理、订单操作等页面行为控制'
      }
    ]
  },

  h5_admin_soldproductsview: {
    name: '已售商品',
    icon: 'fas fa-images',
    category: 'H5管理',
    fields: [
      { id: 'product.brand_model', name: '品牌与型号', group: '商品信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '已售商品品牌和型号' },
      { id: 'product.color', name: '颜色', group: '商品信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '已售商品颜色' },
      { id: 'product.memory', name: '内存', group: '商品信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '已售商品内存' },
      { id: 'product.imei', name: 'IMEI', group: '商品信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '已售商品 IMEI' },
      { id: 'product.sale_time', name: '销售时间', group: '商品信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '已售商品销售时间' },
      { id: 'product.image_count', name: '图片数量', group: '商品信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '商品图片数量' },
      { id: 'images.image_url', name: '图片', group: '图片信息', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '商品图片地址' },
      { id: 'images.is_primary', name: '主图标记', group: '图片信息', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '图片是否为主图' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '查看和删除图片操作' }
    ]
  },

  h5_admin_bannersview: {
    name: '轮播图管理',
    icon: 'fas fa-images',
    category: 'H5管理',
    fields: [
      { id: 'banner.title', name: '标题', group: '轮播图信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '轮播图标题' },
      { id: 'banner.image', name: '轮播图片', group: '轮播图信息', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图片和上传区域' },
      { id: 'banner.link_type', name: '跳转类型', group: '轮播图信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图跳转类型' },
      { id: 'banner.link_url', name: '跳转链接', group: '轮播图信息', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图跳转链接' },
      { id: 'banner.sort_order', name: '排序', group: '轮播图信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图排序' },
      { id: 'banner.interval', name: '轮播间隔', group: '轮播图信息', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图切换间隔' },
      { id: 'banner.status', name: '状态', group: '轮播图信息', type: FIELD_TYPES.SELECT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图启用状态' },
      { id: 'banner.display_time', name: '展示时间', group: '轮播图信息', type: FIELD_TYPES.DATETIME, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图展示时间范围' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '轮播图编辑、删除和排序操作' }
    ]
  },

  h5_admin_configview: {
    name: '商城配置',
    icon: 'fas fa-cog',
    category: 'H5管理',
    fields: [
      { id: 'shop.shop_name', name: '店铺名称', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '商城店铺名称' },
      { id: 'shop.shop_subtitle', name: '店铺副标题', group: '基本信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '商城店铺副标题' },
      { id: 'shop.shop_logo', name: '店铺Logo', group: '基本信息', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '商城店铺 Logo 图片' },
      { id: 'contact.shop_phone', name: '联系电话', group: '联系方式', type: FIELD_TYPES.PHONE, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '商城联系电话' },
      { id: 'contact.wechat_id', name: '微信号', group: '联系方式', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '商城微信号' },
      { id: 'contact.shop_address', name: '店铺地址', group: '联系方式', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '商城店铺地址' },
      { id: 'contact.map_location', name: '地图位置', group: '联系方式', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '商城地图经纬度和选择器' },
      { id: 'contact.shop_hours', name: '营业时间', group: '联系方式', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '商城营业时间' },
      { id: 'payment.wechat_qrcode', name: '微信收款码', group: '支付方式', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '微信收款码图片' },
      { id: 'payment.alipay_qrcode', name: '支付宝收款码', group: '支付方式', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '支付宝收款码图片' },
      { id: 'payment.bank_info', name: '银行转账信息', group: '支付方式', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL, description: '银行转账信息' },
      { id: 'features.banner_enabled', name: '轮播图开关', group: '功能设置', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '商城轮播图开关' },
      { id: 'features.cart_enabled', name: '购物车开关', group: '功能设置', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '商城购物车开关' },
      { id: 'features.direct_buy_enabled', name: '直接购买开关', group: '功能设置', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '商城直接购买开关' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '配置保存、地图选择和图片操作' }
    ]
  },

  h5_admin_home_sectionsview: {
    name: '首页推荐',
    icon: 'fas fa-home',
    category: 'H5管理',
    fields: [
      { id: 'section.section_key', name: '区域标识', group: '推荐区域', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '首页推荐区域唯一标识' },
      { id: 'section.section_name', name: '区域名称', group: '推荐区域', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '首页推荐区域名称' },
      { id: 'section.icon', name: '区域图标', group: '推荐区域', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '首页推荐区域图标' },
      { id: 'section.product_limit', name: '显示数量', group: '推荐区域', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '首页推荐商品显示数量' },
      { id: 'section.sort_order', name: '排序', group: '推荐区域', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '首页推荐区域排序' },
      { id: 'section.is_enabled', name: '状态', group: '推荐区域', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '首页推荐区域启用状态' },
      { id: 'products.product_info', name: '推荐商品', group: '推荐商品', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '推荐商品图片、名称和价格' },
      { id: 'products.product_search', name: '商品搜索', group: '推荐商品', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '推荐商品搜索和类型筛选' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '推荐区域和商品管理操作' }
    ]
  },

  h5_admin_templatesview: {
    name: '商城模板',
    icon: 'fas fa-layer-group',
    category: 'H5管理',
    fields: [
      { id: 'template.product_info', name: '商品信息', group: '模板列表', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板商品图片、品牌、型号和颜色' },
      { id: 'template.color_count', name: '颜色数', group: '模板列表', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '模板颜色数量' },
      { id: 'template.active_count', name: '启用数量', group: '模板列表', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '模板启用数量' },
      { id: 'template.stock_count', name: '在库数量', group: '模板列表', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '模板在库数量' },
      { id: 'template.sort_order', name: '排序', group: '模板列表', type: FIELD_TYPES.NUMBER, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '模板排序' },
      { id: 'template.brand_model', name: '品牌和型号', group: '模板表单', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板品牌和型号选择' },
      { id: 'template.color', name: '颜色', group: '模板表单', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板颜色选择' },
      { id: 'template.memory', name: '支持内存', group: '模板表单', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板支持内存选择' },
      { id: 'template.description', name: '商品描述', group: '模板表单', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板商品描述' },
      { id: 'template.price_markup', name: '加价设置', group: '模板表单', type: FIELD_TYPES.CURRENCY, sensitivity: SENSITIVITY_LEVELS.SENSITIVE, description: '模板加价金额或比例' },
      { id: 'template.is_active', name: '启用状态', group: '模板表单', type: FIELD_TYPES.BOOLEAN, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '模板启用状态' },
      { id: 'template.images', name: '图片和视频', group: '模板媒体', type: FIELD_TYPES.URL, sensitivity: SENSITIVITY_LEVELS.PUBLIC, description: '模板图片视频管理' },
      { id: 'system_info.operations', name: '操作', group: '系统信息', type: FIELD_TYPES.TEXT, sensitivity: SENSITIVITY_LEVELS.INTERNAL, description: '模板编辑、删除、排序和媒体操作' }
    ]
  },

  salary: {
    name: '工资管理',
    icon: 'fas fa-money-bill-wave',
    category: '人力资源',
    fields: [
      {
        id: 'stats.pending_salary',
        name: '待发工资概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部待发工资统计卡片'
      },
      {
        id: 'stats.rest_summary',
        name: '休假概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月休假统计卡片'
      },
      {
        id: 'stats.leave_summary',
        name: '请假概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月请假统计卡片'
      },
      {
        id: 'stats.overtime_summary',
        name: '加班概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月加班统计卡片'
      },
      {
        id: 'template.is_default',
        name: '默认模板',
        group: '模板信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资模板是否为默认模板'
      },
      {
        id: 'template.name',
        name: '模板名称',
        group: '模板信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资模板名称',
        searchable: true
      },
      {
        id: 'template.description',
        name: '模板说明',
        group: '模板信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资模板说明'
      },
      {
        id: 'template.base_salary',
        name: '底薪',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '工资模板底薪'
      },
      {
        id: 'template.commission_type',
        name: '提成方式',
        group: '模板信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资模板提成方式'
      },
      {
        id: 'template.commission_new_fixed',
        name: '全新机提成',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '全新机固定提成'
      },
      {
        id: 'template.commission_used_fixed',
        name: '二手机提成',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '二手机固定提成'
      },
      {
        id: 'template.commission_percentage',
        name: '利润提成比例',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '利润提成百分比'
      },
      {
        id: 'template.overtime_hourly_rate',
        name: '加班费率',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '加班费率'
      },
      {
        id: 'template.rest_days',
        name: '月休天数',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '每月休息天数'
      },
      {
        id: 'template.auto_raise_enabled',
        name: '启用自动涨薪',
        group: '模板信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '是否启用自动涨薪'
      },
      {
        id: 'template.auto_raise_months',
        name: '涨薪周期',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '自动涨薪周期（月）'
      },
      {
        id: 'template.auto_raise_amount',
        name: '涨薪金额',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '自动涨薪金额'
      },
      {
        id: 'template.auto_raise_max_salary',
        name: '最高底薪',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '自动涨薪最高底薪'
      },
      {
        id: 'template.is_active',
        name: '模板状态',
        group: '模板信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资模板是否启用',
        filterable: true
      },
      {
        id: 'template.employee_count',
        name: '使用人数',
        group: '模板信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '使用该模板的员工数'
      },
      {
        id: 'salary.employee_username',
        name: '员工工号',
        group: '员工工资',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工工号'
      },
      {
        id: 'salary.employee_name',
        name: '员工姓名',
        group: '员工工资',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工姓名',
        searchable: true
      },
      {
        id: 'salary.employee_phone',
        name: '联系电话',
        group: '员工工资',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工联系电话'
      },
      {
        id: 'salary.salary_template_name',
        name: '工资模板',
        group: '员工工资',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工关联工资模板'
      },
      {
        id: 'salary.period_start',
        name: '工资月份',
        group: '工资记录',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资所属月份',
        filterable: true
      },
      {
        id: 'salary.actual_work_days',
        name: '工作天数',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '实际工作天数'
      },
      {
        id: 'salary.base_salary',
        name: '底薪',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '工资记录底薪'
      },
      {
        id: 'salary.sales_count',
        name: '销售数量',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售数量'
      },
      {
        id: 'salary.commission_amount',
        name: '销售提成',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '销售提成金额'
      },
      {
        id: 'salary.monthly_leave_days',
        name: '休假天数',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '月休已用或额度'
      },
      {
        id: 'salary.leave_days',
        name: '请假天数',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假天数'
      },
      {
        id: 'salary.leave_deduction',
        name: '请假扣款',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '请假扣款金额'
      },
      {
        id: 'salary.overtime_hours',
        name: '加班时长',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '加班时长'
      },
      {
        id: 'salary.overtime_pay',
        name: '加班费',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '加班费金额'
      },
      {
        id: 'salary.net_salary',
        name: '实发工资',
        group: '工资记录',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '实发工资'
      },
      {
        id: 'salary.status',
        name: '状态',
        group: '工资记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资发放状态',
        filterable: true
      },
      {
        id: 'salary.paid_at',
        name: '发放时间',
        group: '工资记录',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资发放时间'
      },
      {
        id: 'salary.payment_method',
        name: '支付方式',
        group: '工资记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '工资支付方式'
      },
      {
        id: 'attendance.record_date',
        name: '考勤日期',
        group: '考勤记录',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤记录日期'
      },
      {
        id: 'attendance.record_type',
        name: '考勤类型',
        group: '考勤记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤记录类型'
      },
      {
        id: 'attendance.leave_type',
        name: '请假类型',
        group: '考勤记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假类型'
      },
      {
        id: 'attendance.reason',
        name: '考勤原因',
        group: '考勤记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤原因或备注'
      },
      {
        id: 'attendance.status',
        name: '考勤状态',
        group: '考勤记录',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤状态'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  attendance: {
    name: '考勤管理',
    icon: 'fas fa-calendar-check',
    category: '人力资源',
    fields: [
      {
        id: 'stats.last_month_leave',
        name: '上月休假概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部上月休假统计卡片'
      },
      {
        id: 'stats.last_month_overtime',
        name: '上月加班概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部上月加班统计卡片'
      },
      {
        id: 'stats.current_month_leave',
        name: '本月休假概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月休假统计卡片'
      },
      {
        id: 'stats.current_month_unpaid_leave',
        name: '本月请假概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月请假统计卡片'
      },
      {
        id: 'stats.current_month_overtime',
        name: '本月加班概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部本月加班统计卡片'
      },
      {
        id: 'stats.pending_settlement',
        name: '待结算概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部待结算统计卡片'
      },
      {
        id: 'attendance.id',
        name: '记录ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤记录唯一标识'
      },
      {
        id: 'attendance.employee_id',
        name: '员工',
        group: '基本信息',
        type: FIELD_TYPES.SELECT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '所属员工'
      },
      {
        id: 'attendance.employee_name',
        name: '员工姓名',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工姓名'
      },
      {
        id: 'attendance.record_date',
        name: '日期',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '记录日期'
      },
      {
        id: 'attendance.record_type',
        name: '类型',
        group: '基本信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '考勤记录类型',
        filterable: true
      },
      {
        id: 'attendance.leave_type',
        name: '请假类型',
        group: '请假信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假类型'
      },
      {
        id: 'attendance.leave_days',
        name: '请假天数',
        group: '请假信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假天数'
      },
      {
        id: 'attendance.monthly_leave_days',
        name: '休假天数',
        group: '休假信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '月休假天数'
      },
      {
        id: 'attendance.overtime_hours',
        name: '加班时长',
        group: '加班信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '加班时长'
      },
      {
        id: 'attendance.reason',
        name: '原因',
        group: '补充信息',
        type: FIELD_TYPES.TEXTAREA,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假或加班原因'
      },
      {
        id: 'attendance.status',
        name: '状态',
        group: '审批信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '审批状态',
        filterable: true
      },
      {
        id: 'attendance.approval_note',
        name: '审批备注',
        group: '审批信息',
        type: FIELD_TYPES.TEXTAREA,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '审批备注'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
    ]
  },

  // 国补管理模块字段
  subsidy: {
    name: '国补管理',
    icon: 'fas fa-hand-holding-usd',
    category: '业务模块',
    fields: [
      {
        id: 'stats.total_and_handler',
        name: '总办理与代办理概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部总办理与代办理统计卡片'
      },
      {
        id: 'stats.approval_progress',
        name: '审批进度概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部已审批与未审批统计卡片'
      },
      {
        id: 'stats.amount_progress',
        name: '到账进度概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '顶部已到账与未到账金额统计卡片'
      },
      {
        id: 'stats.store_overview',
        name: '店铺概览',
        group: '统计概览',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '顶部店铺数量统计卡片'
      },
      {
        id: 'basic_info.id',
        name: '记录ID',
        group: '基本信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '国补记录唯一标识',
        required: true
      },
      {
        id: 'store_info.store_name',
        name: '店铺',
        group: '店铺信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售店铺名称',
        filterable: true
      },
      {
        id: 'sales_info.salesman_name',
        name: '销售员',
        group: '销售员信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '关联销售员姓名',
        filterable: true
      },
      {
        id: 'customer_info.customer_name',
        name: '客户姓名',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '客户姓名',
        required: true,
        searchable: true
      },
      {
        id: 'customer_info.customer_phone',
        name: '客户电话',
        group: '客户信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户联系电话'
      },
      {
        id: 'customer_info.customer_idcard',
        name: '客户身份证号',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '客户身份证号码'
      },
      {
        id: 'device_info.imei1',
        name: 'IMEI1',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '主IMEI号',
        required: true,
        searchable: true
      },
      {
        id: 'device_info.imei2',
        name: 'IMEI2',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '辅助IMEI号',
        required: true
      },
      {
        id: 'device_info.serial_number',
        name: '序列号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备序列号',
        searchable: true
      },
      {
        id: 'device_info.brand',
        name: '品牌',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机品牌',
        filterable: true
      },
      {
        id: 'device_info.model',
        name: '型号',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机型号',
        filterable: true
      },
      {
        id: 'device_info.color',
        name: '颜色',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '手机颜色',
        filterable: true
      },
      {
        id: 'device_info.memory',
        name: '内存',
        group: '设备信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.PUBLIC,
        description: '内存容量',
        filterable: true
      },
      {
        id: 'price_info.sale_price',
        name: '销售价格',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机销售价格',
        currency: 'CNY'
      },
      {
        id: 'price_info.subsidy_amount',
        name: '补贴金额',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '国补补贴金额',
        currency: 'CNY'
      },
      {
        id: 'price_info.subsidy_rate',
        name: '补贴比例',
        group: '价格信息',
        type: FIELD_TYPES.PERCENTAGE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '国补补贴比例'
      },
      {
        id: 'price_info.subsidy_calc_price',
        name: '国补计算价',
        group: '价格信息',
        type: FIELD_TYPES.CURRENCY,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '申请时用于计算补贴金额的价格',
        currency: 'CNY'
      },
      {
        id: 'subsidy_info.subsidy_photos',
        name: '国补照片',
        group: '国补信息',
        type: FIELD_TYPES.JSON,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '国补申请凭证照片'
      },
      {
        id: 'handler_info.has_different_handler',
        name: '他人代办标记',
        group: '办理人信息',
        type: FIELD_TYPES.BOOLEAN,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '是否由他人代办'
      },
      {
        id: 'handler_info.handler_name',
        name: '代办人姓名',
        group: '办理人信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '实际办理人姓名'
      },
      {
        id: 'handler_info.handler_phone',
        name: '代办人电话',
        group: '办理人信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '实际办理人联系电话'
      },
      {
        id: 'handler_info.handler_idcard',
        name: '代办人身份证号',
        group: '办理人信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '实际办理人身份证号码'
      },
      {
        id: 'time_info.sale_time',
        name: '销售时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '设备销售时间'
      },
      {
        id: 'time_info.apply_time',
        name: '提交时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '国补申请提交时间'
      },
      {
        id: 'time_info.arrival_time',
        name: '到账时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '国补款项到账时间'
      },
      {
        id: 'status_info.status',
        name: '状态',
        group: '状态信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '申请状态（待提交/已审核/已到账）',
        filterable: true
      },
      {
        id: 'other_info.remarks',
        name: '备注',
        group: '其他信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '备注信息'
      },
      {
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '国补编辑和删除操作的列容器；审批与到账分别归属提交时间、到账时间字段'
      }
    ]
  }
}

// 获取指定模块的字段配置
function resolveModuleConfig(moduleId) {
  if (!moduleId) {
    return null
  }

  if (MODULE_FIELDS[moduleId]) {
    return MODULE_FIELDS[moduleId]
  }

  const parts = String(moduleId).split('_').filter(Boolean)
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const candidate = parts.slice(0, index).join('_')
    if (MODULE_FIELDS[candidate]) {
      return MODULE_FIELDS[candidate]
    }
  }

  return null
}

export function getModuleFields(moduleId) {
  return resolveModuleConfig(moduleId)?.fields || []
}

// 获取字段分组信息
export function getModuleFieldGroups(moduleId) {
  const fields = getModuleFields(moduleId)
  const groups = {}

  fields.forEach(field => {
    const groupName = field.group || '其他'
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        sensitivity: field.sensitivity,
        fields: []
      }
    }
    groups[groupName].fields.push(field)

    // 更新分组的敏感级别（以最高级别为准）
    const currentLevel = {
      'public': 0,
      'internal': 1,
      'sensitive': 2,
      'confidential': 3
    }
    const fieldLevel = currentLevel[field.sensitivity] || 0
    const groupLevel = currentLevel[groups[groupName].sensitivity] || 0

    if (fieldLevel > groupLevel) {
      groups[groupName].sensitivity = field.sensitivity
    }
  })

  return Object.values(groups)
}

export default {
  FIELD_TYPES,
  SENSITIVITY_LEVELS,
  MODULE_FIELDS,
  getModuleFields,
  getModuleFieldGroups
}
