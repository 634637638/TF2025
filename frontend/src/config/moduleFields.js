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
};

// 字段敏感级别定义
export const SENSITIVITY_LEVELS = {
  PUBLIC: 'public',        // 公开信息，所有用户可见
  INTERNAL: 'internal',    // 内部信息，员工可见
  SENSITIVE: 'sensitive',  // 敏感信息，特定角色可见
  CONFIDENTIAL: 'confidential'  // 机密信息，管理员可见
};

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
        id: 'time_info.Inventorytime',
        name: '入库时间',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '手机入库时间',
        filterable: true
      },
      {
        id: 'time_info.salestime',
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
        description: '手机状态（在库/已售/批发/划拨等）',
        filterable: true,
        options: [
          { label: '在库', value: 'in_stock' },
          { label: '已售', value: 'sold' },
          { label: '批发', value: 'peer_transfer' },
          { label: '划拨', value: 'supplier_proxy' },
          { label: '预定', value: 'reserved' },
          { label: '维修', value: 'repair' },
          { label: '丢失', value: 'lost' }
        ]
      },

      // 基本信息字段（价格字段放在设备信息内）
      {
        id: 'basic_info.purchase_price',
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
        description: '客户姓名',
      },
      {
        id: 'customer_info.customer_phone',
        name: '手机号码',
        group: '客户信息',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户手机号码',
      },
      {
        id: 'customer_info.apple_id',
        name: 'Apple ID',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户Apple ID',
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
        options: [
          { label: '在库', value: 'in_stock' },
          { label: '已售', value: 'sold' },
          { label: '预留', value: 'reserved' },
          { label: '维修', value: 'repair' },
          { label: '调货', value: 'peer_transfer' },
          { label: '划拨', value: 'supplier_proxy' }
        ]
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
        id: 'time_info.Inventorytime',
        name: '入库时间',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '商品入库日期',
        filterable: true
      },
      {
        id: 'price_info.purchase_price',
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
        description: '客户联系电话',
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
        id: 'sale.purchase_price',
        name: '入库价',
        group: '金额信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '设备入库价格'
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
        id: 'sale.sale_date',
        name: '销售日期',
        group: '时间信息',
        type: FIELD_TYPES.DATE,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '销售日期'
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
        description: '员工手机号码',
      },
      {
        id: 'employee.email',
        name: '邮箱',
        group: '联系方式',
        type: FIELD_TYPES.EMAIL,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '员工邮箱地址',
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
        id: 'employee.position',
        name: '职位',
        group: '工作信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '员工职位',
        filterable: true
      },
      {
        id: 'employee.department',
        name: '部门',
        group: '工作信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '所属部门',
        filterable: true
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
        description: '供应商联系电话',
      },
      {
        id: 'supplier.email',
        name: '邮箱',
        group: '联系信息',
        type: FIELD_TYPES.EMAIL,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '供应商邮箱'
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
        description: '店铺联系电话',
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
        required: true,
      },
      {
        id: 'customer.phone',
        name: '手机号码',
        group: '联系方式',
        type: FIELD_TYPES.PHONE,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户手机号码',
        required: true,
      },
      {
        id: 'customer.id_card',
        name: '身份证号',
        group: '身份信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '客户身份证号码',
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
        description: '客户Apple ID账号',
      },
      {
        id: 'customer.address',
        name: '地址',
        group: '联系信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '客户地址',
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
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
      }
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
        id: 'system_info.operations',
        name: '操作',
        group: '系统信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '页面操作按钮控制'
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
        id: 'database_sync.tab_access',
        name: '远程数据同步页签',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '远程数据同步子页面入口与页签显示控制'
      },
      {
        id: 'database_sync.smart_sync_banner',
        name: '智能同步入口',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '一键本地到云端智能同步入口'
      },
      {
        id: 'database_sync.step_navigation',
        name: '同步步骤导航',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '同步步骤导航与流程提示'
      },
      {
        id: 'database_sync.connection_config',
        name: '连接配置',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.SENSITIVE,
        description: '数据库连接列表与新建连接表单'
      },
      {
        id: 'database_sync.table_selection',
        name: '表选择',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '源表与目标表选择区域'
      },
      {
        id: 'database_sync.field_mapping',
        name: '字段映射',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '字段映射配置与同步预检区域'
      },
      {
        id: 'database_sync.sync_result',
        name: '同步结果',
        group: '远程数据同步',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '同步执行结果与日志区域'
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
        id: 'attendance.absent_days',
        name: '旷工天数',
        group: '旷工信息',
        type: FIELD_TYPES.NUMBER,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '旷工天数'
      },
      {
        id: 'attendance.reason',
        name: '原因',
        group: '补充信息',
        type: FIELD_TYPES.TEXTAREA,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '请假/加班/旷工原因'
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
        description: '客户联系电话',
      },
      {
        id: 'customer_info.customer_idcard',
        name: '客户身份证号',
        group: '客户信息',
        type: FIELD_TYPES.TEXT,
        sensitivity: SENSITIVITY_LEVELS.CONFIDENTIAL,
        description: '客户身份证号码',
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
        description: '国补款项到账时间',
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
        id: 'time_info.created_at',
        name: '创建时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '记录创建时间'
      },
      {
        id: 'time_info.updated_at',
        name: '更新时间',
        group: '时间信息',
        type: FIELD_TYPES.DATETIME,
        sensitivity: SENSITIVITY_LEVELS.INTERNAL,
        description: '记录更新时间'
      }
    ]
  }
};

// 获取指定模块的字段配置
function resolveModuleConfig(moduleId) {
  if (!moduleId) {
    return null;
  }

  if (MODULE_FIELDS[moduleId]) {
    return MODULE_FIELDS[moduleId];
  }

  const parts = String(moduleId).split('_').filter(Boolean);
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const candidate = parts.slice(0, index).join('_');
    if (MODULE_FIELDS[candidate]) {
      return MODULE_FIELDS[candidate];
    }
  }

  return null;
}

export function getModuleFields(moduleId) {
  return resolveModuleConfig(moduleId)?.fields || [];
}

// 获取字段分组信息
export function getModuleFieldGroups(moduleId) {
  const fields = getModuleFields(moduleId);
  const groups = {};

  fields.forEach(field => {
    const groupName = field.group || '其他';
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        sensitivity: field.sensitivity,
        fields: []
      };
    }
    groups[groupName].fields.push(field);

    // 更新分组的敏感级别（以最高级别为准）
    const currentLevel = {
      'public': 0,
      'internal': 1,
      'sensitive': 2,
      'confidential': 3
    };
    const fieldLevel = currentLevel[field.sensitivity] || 0;
    const groupLevel = currentLevel[groups[groupName].sensitivity] || 0;

    if (fieldLevel > groupLevel) {
      groups[groupName].sensitivity = field.sensitivity;
    }
  });

  return Object.values(groups);
}

export default {
  FIELD_TYPES,
  SENSITIVITY_LEVELS,
  MODULE_FIELDS,
  getModuleFields,
  getModuleFieldGroups
};
