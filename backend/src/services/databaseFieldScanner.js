/**
 * 数据库字段扫描器
 * 扫描所有数据库表结构，生成统一的字段定义池
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class DatabaseFieldScanner {
  constructor() {
    this.db = getDatabase();
    // 系统表排除列表
    this.excludeTables = [
      'migrations',
      'role_permissions',
      'user_roles',
      'modules',
      'roles',
      'users',
      'menus',
      'module_sync_log'
    ];
    // 字段类型映射
    this.fieldTypeMap = {
      'int': 'NUMBER',
      'tinyint': 'NUMBER',
      'smallint': 'NUMBER',
      'mediumint': 'NUMBER',
      'bigint': 'NUMBER',
      'decimal': 'DECIMAL',
      'float': 'DECIMAL',
      'double': 'DECIMAL',
      'varchar': 'TEXT',
      'char': 'TEXT',
      'text': 'TEXTAREA',
      'longtext': 'TEXTAREA',
      'mediumtext': 'TEXTAREA',
      'tinytext': 'TEXT',
      'json': 'JSON',
      'date': 'DATE',
      'datetime': 'DATETIME',
      'timestamp': 'DATETIME',
      'time': 'TIME',
      'year': 'NUMBER',
      'boolean': 'BOOLEAN',
      'tinyint(1)': 'BOOLEAN',
      'enum': 'SELECT'
    };
    // 敏感字段识别规则
    this.sensitiveFieldPatterns = {
      CONFIDENTIAL: [
        'password', 'passwd', 'pwd', 'pay_password', 'pay_pwd',
        'bank_account', 'bank_card', 'card_number', 'id_card',
        'secret', 'token', 'private_key', 'salt', 'hash'
      ],
      SENSITIVE: [
        'phone', 'mobile', 'telephone', 'email',
        'salary', 'wage', 'income', 'cost', 'price',
        'profit', 'margin', 'commission', 'bonus'
      ],
      INTERNAL: [
        'cost_price', 'purchase_price', 'wholesale_price',
        'stock', 'inventory', 'supplier_id', 'supplier_code',
        'user_id', 'created_by', 'updated_by', 'deleted_by'
      ]
    };
  }

  /**
   * 扫描所有数据库表结构
   */
  async scanAllTables() {
    try {
      log.debug('🔍 开始扫描数据库表结构...');

      // 获取所有表名
      const tables = await this.getAllTables();
      log.debug(`📋 发现 ${tables.length} 个数据表`);

      const allFields = new Map();
      const tableInfos = [];

      // 扫描每个表的结构
      for (const tableName of tables) {
        if (!this.excludeTables.includes(tableName)) {
          const tableInfo = await this.scanTableStructure(tableName);
          if (tableInfo && tableInfo.fields.length > 0) {
            tableInfos.push(tableInfo);

            // 将字段添加到全局字段池
            tableInfo.fields.forEach(field => {
              const fieldKey = `${tableName}.${field.name}`;
              allFields.set(fieldKey, {
                ...field,
                table: tableName,
                fieldKey: fieldKey
              });
            });
          }
        }
      }

      log.debug(`✅ 扫描完成，共发现 ${allFields.size} 个字段`);

      return {
        tables: tableInfos,
        allFields: Array.from(allFields.values()),
        scanTime: new Date().toISOString()
      };
    } catch (error) {
      log.error('❌ 扫描数据库表结构失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有表名
   */
  async getAllTables() {
    const [rows] = await this.db.execute('SHOW TABLES');
    return rows.map(row => Object.values(row)[0]);
  }

  /**
   * 扫描单个表的结构
   */
  async scanTableStructure(tableName) {
    try {
      // 获取表结构
      const [columns] = await this.db.execute(`DESCRIBE ${tableName}`);

      // 获取表注释
      const [tableInfo] = await this.db.execute(`
        SELECT TABLE_COMMENT
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      `, [tableName]);

      const tableComment = tableInfo[0]?.TABLE_COMMENT || tableName;

      const fields = columns.map(column => {
        const field = {
          name: column.Field,
          type: this.mapFieldType(column.Type),
          nullable: column.Null === 'YES',
          default: column.Default,
          extra: column.Extra,
          key: column.Key,
          sensitivity: this.detectFieldSensitivity(column.Field, column.Type),
          group: this.determineFieldGroup(column.Field, tableName),
          searchable: this.isSearchableField(column.Field, column.Type),
          editable: this.isEditableField(column.Field, column.Extra),
          required: column.Null === 'NO' && column.Default === null,
          description: column.Field
        };

        return field;
      });

      return {
        tableName: tableName,
        tableComment: tableComment,
        category: this.getTableCategory(tableName),
        fields: fields
      };
    } catch (error) {
      log.error(`❌ 扫描表 ${tableName} 失败:`, error);
      return null;
    }
  }

  /**
   * 映射字段类型
   */
  mapFieldType(dbType) {
    // 提取基础类型（去掉长度等附加信息）
    const baseType = dbType.toLowerCase().split('(')[0].split(' ')[0];

    // 处理带长度的类型
    const fullType = dbType.toLowerCase();

    // 特殊处理boolean类型
    if (fullType === 'tinyint(1)' || fullType.startsWith('tinyint(1) ')) {
      return 'BOOLEAN';
    }

    // 处理enum类型
    if (fullType.startsWith('enum(')) {
      return 'SELECT';
    }

    // 基础类型映射
    return this.fieldTypeMap[baseType] || 'TEXT';
  }

  /**
   * 检测字段敏感度
   */
  detectFieldSensitivity(fieldName, fieldType) {
    const field = fieldName.toLowerCase();

    // 检查机密字段
    if (this.sensitiveFieldPatterns.CONFIDENTIAL.some(pattern =>
      field.includes(pattern) || field === pattern)) {
      return 'CONFIDENTIAL';
    }

    // 检查敏感字段
    if (this.sensitiveFieldPatterns.SENSITIVE.some(pattern =>
      field.includes(pattern) || field === pattern)) {
      return 'SENSITIVE';
    }

    // 检查内部字段
    if (this.sensitiveFieldPatterns.INTERNAL.some(pattern =>
      field.includes(pattern) || field === pattern)) {
      return 'INTERNAL';
    }

    // 默认为公开
    return 'PUBLIC';
  }

  /**
   * 确定字段分组
   */
  determineFieldGroup(fieldName, tableName) {
    const field = fieldName.toLowerCase();

    // ID相关字段
    if (field.includes('id') || field.includes('_id')) {
      return '标识字段';
    }

    // 时间字段
    if (field.includes('time') || field.includes('date') ||
        ['created_at', 'updated_at', 'deleted_at'].includes(field)) {
      return '时间信息';
    }

    // 状态字段
    if (field.includes('status') || field.includes('state')) {
      return '状态字段';
    }

    // 基础信息
    if (['name', 'title', 'description', 'remark'].includes(field)) {
      return '基本信息';
    }

    // 联系信息
    if (field.includes('phone') || field.includes('email') ||
        field.includes('address') || field.includes('contact')) {
      return '联系信息';
    }

    // 财务相关
    if (field.includes('price') || field.includes('cost') ||
        field.includes('amount') || field.includes('money')) {
      return '财务信息';
    }

    // 系统字段
    if (field.includes('created_by') || field.includes('updated_by') ||
        field.includes('deleted_by') || field.includes('version')) {
      return '系统字段';
    }

    return '其他信息';
  }

  /**
   * 判断字段是否可搜索
   */
  isSearchableField(fieldName, fieldType) {
    const field = fieldName.toLowerCase();
    const type = fieldType.toLowerCase();

    // 排除不适合搜索的字段
    const excludeTypes = ['longtext', 'json', 'blob'];
    if (excludeTypes.some(t => type.includes(t))) {
      return false;
    }

    // 排除系统字段
    const excludeFields = ['password', 'token', 'salt', 'hash'];
    if (excludeFields.some(f => field.includes(f))) {
      return false;
    }

    return true;
  }

  /**
   * 判断字段是否可编辑
   */
  isEditableField(fieldName, extra) {
    const field = fieldName.toLowerCase();

    // 自动递增字段不可编辑
    if (extra.includes('auto_increment')) {
      return false;
    }

    // 时间戳字段通常不可直接编辑
    if (['created_at', 'updated_at'].includes(field)) {
      return false;
    }

    return true;
  }

  /**
   * 获取表分类
   */
  getTableCategory(tableName) {
    const categoryMap = {
      // 基础数据
      'brands': '基础数据',
      'models': '基础数据',
      'colors': '基础数据',
      'memories': '基础数据',
      'phones': '商品管理',

      // 业务数据
      'sales': '销售管理',
      'purchases': '采购管理',
      'inventory': '库存管理',
      'stock_in': '入库管理',
      'stock_out': '出库管理',

      // 客户相关
      'customers': '客户管理',
      'suppliers': '供应商管理',
      'employees': '员工管理',
      'stores': '门店管理',

      // 财务相关
      'payments': '财务管理',
      'expenses': '费用管理',
      'receipts': '收支管理',

      // 系统相关
      'system_logs': '系统日志',
      'operation_logs': '操作日志'
    };

    return categoryMap[tableName] || '其他';
  }

  /**
   * 生成字段权限配置
   */
  async generateFieldPermissionConfig() {
    const scanResult = await this.scanAllTables();
    const config = {
      scanTime: scanResult.scanTime,
      totalTables: scanResult.tables.length,
      totalFields: scanResult.allFields.length,
      fieldPools: {},
      moduleFieldMapping: {}
    };

    // 创建字段池
    scanResult.tables.forEach(table => {
      config.fieldPools[table.tableName] = {
        name: table.tableComment || table.tableName,
        category: table.category,
        fields: table.fields.map(field => ({
          id: `${table.tableName}.${field.name}`,
          name: field.description || field.name,
          table: table.tableName,
          field: field.name,
          type: field.type,
          sensitivity: field.sensitivity,
          group: field.group,
          required: field.required,
          searchable: field.searchable,
          editable: field.editable,
          defaultValue: field.default,
          roles: {
            '超级管理员': true,
            '管理员': field.sensitivity !== 'CONFIDENTIAL',
            '经理': field.sensitivity === 'PUBLIC',
            '员工': field.sensitivity === 'PUBLIC'
          }
        }))
      };
    });

    // 创建模块映射
    config.moduleFieldMapping = this.createModuleFieldMapping(scanResult.tables);

    return config;
  }

  /**
   * 创建模块字段映射
   */
  createModuleFieldMapping(tables) {
    const mapping = {};

    // 品牌管理
    if (tables.find(t => t.tableName === 'brands')) {
      mapping.brands = {
        name: '品牌管理',
        icon: 'fas fa-tags',
        tables: ['brands'],
        fields: ['brands.id', 'brands.name', 'brands.status', 'brands.sort_order', 'brands.created_at']
      };
    }

    // 型号管理
    if (tables.find(t => t.tableName === 'models')) {
      mapping.models = {
        name: '型号管理',
        icon: 'fas fa-mobile-alt',
        tables: ['models'],
        fields: ['models.id', 'models.brand_id', 'models.name', 'models.status', 'models.created_at']
      };
    }

    // 销售管理
    if (tables.find(t => t.tableName === 'sales')) {
      mapping.sales = {
        name: '销售管理',
        icon: 'fas fa-shopping-cart',
        tables: ['sales'],
        fields: [
          'sales.id', 'sales.phone_id', 'sales.customer_id', 'sales.sale_price',
          'sales.sale_date', 'sales.salesperson_id', 'sales.status', 'sales.remark'
        ]
      };
    }

    // 客户管理
    if (tables.find(t => t.tableName === 'customers')) {
      mapping.customers = {
        name: '客户管理',
        icon: 'fas fa-users',
        tables: ['customers'],
        fields: [
          'customers.id', 'customers.name', 'customers.phone', 'customers.email',
          'customers.address', 'customers.status', 'customers.created_at'
        ]
      };
    }

    return mapping;
  }

  /**
   * 导出配置到文件
   */
  async exportToFile(filePath = './database-fields-config.json') {
    const config = await this.generateFieldPermissionConfig();
    const fs = require('fs');

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
    log.debug(`✅ 字段配置已导出到: ${filePath}`);

    return config;
  }
}

module.exports = DatabaseFieldScanner;
