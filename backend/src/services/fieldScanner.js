/**
 * 自动字段扫描器
 * 通过分析Vue组件文件自动提取字段信息
 */
const fs = require('fs');
const path = require('path');
const log = require('../utils/log');

class FieldScanner {
  constructor() {
    this.viewsPath = path.join(__dirname, '../../../frontend/src/views');
    // 常见字段类型映射
    this.fieldTypeMap = {
      'text': 'TEXT',
      'number': 'NUMBER',
      'date': 'DATE',
      'datetime': 'DATETIME',
      'select': 'SELECT',
      'textarea': 'TEXTAREA',
      'checkbox': 'BOOLEAN',
      'radio': 'RADIO',
      'email': 'EMAIL',
      'phone': 'PHONE',
      'url': 'URL'
    };
    // 敏感度关键词映射
    this.sensitivityKeywords = {
      // 敏感字段
      sensitive: ['密码', 'password', '手机', '电话', '身份证', '银行卡', '薪资', '工资', '成本', '进价', '利润'],
      // 机密字段
      confidential: ['密码', 'password', '支付密码', 'pay_password', '银行卡号', 'bank_account', '身份证号', 'id_card'],
      // 内部字段
      internal: ['成本', '进价', '采购价', 'profit', 'margin', '库存', 'stock', '供应商', 'supplier']
    };
  }

  /**
   * 扫描单个Vue组件文件，提取字段信息
   */
  async scanComponentFields(category, filename) {
    try {
      const filePath = path.join(this.viewsPath, category, filename);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const moduleName = filename.replace('.vue', '');

      // 提取字段信息
      const fields = this.extractFieldsFromContent(content, moduleName);

      return {
        moduleKey: `${category}_${moduleName}`.toLowerCase(),
        moduleName: moduleName,
        category: category,
        fields: fields,
        scanTime: new Date().toISOString()
      };
    } catch (error) {
      log.error(`扫描组件字段失败 ${category}/${filename}:`, error);
      return null;
    }
  }

  /**
   * 从Vue文件内容中提取字段信息
   */
  extractFieldsFromContent(content, moduleName) {
    const fields = [];

    // 1. 提取表格列信息
    const tableFields = this.extractTableFields(content);
    fields.push(...tableFields);

    // 2. 提取表单字段信息
    const formFields = this.extractFormFields(content);
    fields.push(...formFields);

    // 3. 提取搜索字段信息
    const searchFields = this.extractSearchFields(content);
    fields.push(...searchFields);

    // 4. 去重并合并字段信息
    const mergedFields = this.mergeFields(fields);

    return mergedFields;
  }

  /**
   * 提取表格列信息
   */
  extractTableFields(content) {
    const fields = [];

    // 匹配表格头部
    const tableHeaderRegex = /<thead>\s*<tr>(.*?)<\/tr>\s*<\/thead>/gs;
    const tableHeaders = content.match(tableHeaderRegex);

    if (tableHeaders) {
      tableHeaders.forEach(header => {
        const thRegex = /<th[^>]*>(.*?)<\/th>/g;
        let match;
        while ((match = thRegex.exec(header)) !== null) {
          const thContent = match[1].trim();
          if (thContent && !thContent.includes('操作')) {
            const fieldName = this.extractFieldName(thContent);
            if (fieldName) {
              fields.push({
                id: fieldName,
                name: thContent,
                type: 'TEXT',
                group: '基本信息',
                searchable: true,
                fromTable: true
              });
            }
          }
        }
      });
    }

    return fields;
  }

  /**
   * 提取表单字段信息
   */
  extractFormFields(content) {
    const fields = [];

    // 匹配表单标签
    const labelRegex = /<label[^>]*class="[^"]*form-label[^"]*"[^>]*>(.*?)<\/label>/g;
    let match;
    while ((match = labelRegex.exec(content)) !== null) {
      const labelText = match[1].trim();
      if (labelText) {
        const fieldName = this.extractFieldName(labelText);
        if (fieldName) {
          // 检查对应的输入框类型
          const inputType = this.detectInputType(content, labelText);
          fields.push({
            id: fieldName,
            name: labelText,
            type: inputType,
            group: '基本信息',
            required: this.checkRequired(content, labelText),
            fromForm: true
          });
        }
      }
    }

    return fields;
  }

  /**
   * 提取搜索字段信息
   */
  extractSearchFields(content) {
    const fields = [];

    // 查找搜索表单中的标签
    const searchFormRegex = /<div[^>]*class="[^"]*search-form[^"]*"[^>]*>(.*?)<\/div>/gs;
    const searchForms = content.match(searchFormRegex);

    if (searchForms) {
      searchForms.forEach(form => {
        const labelRegex = /<label[^>]*>(.*?)<\/label>/g;
        let match;
        while ((match = labelRegex.exec(form)) !== null) {
          const labelText = match[1].trim();
          if (labelText && labelText !== '筛选条件') {
            const fieldName = this.extractFieldName(labelText);
            if (fieldName) {
              fields.push({
                id: fieldName,
                name: labelText,
                type: 'TEXT',
                group: '搜索条件',
                searchable: true,
                fromSearch: true
              });
            }
          }
        }
      });
    }

    return fields;
  }

  /**
   * 从中文标签提取字段名
   */
  extractFieldName(labelText) {
    // 移除特殊字符和空格，转换为英文
    let fieldName = labelText
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .toLowerCase();

    // 中文到英文的映射
    const nameMap = {
      '品牌名称': 'brand.name',
      '状态': 'status',
      '排序': 'sort_order',
      '创建时间': 'created_at',
      '更新时间': 'updated_at',
      '型号名称': 'model.name',
      '颜色': 'color',
      '内存': 'memory',
      '员工姓名': 'employee.name',
      '手机号': 'phone',
      '供应商名称': 'supplier.name',
      '店铺名称': 'store.name',
      '客户姓名': 'customer.name',
      '价格': 'price',
      '数量': 'quantity',
      '备注': 'remark',
      '描述': 'description'
    };

    // 尝试精确匹配
    if (nameMap[labelText]) {
      return nameMap[labelText];
    }

    // 模糊匹配
    for (const [chinese, english] of Object.entries(nameMap)) {
      if (labelText.includes(chinese) || chinese.includes(labelText)) {
        return english;
      }
    }

    // 生成默认字段名
    return fieldName || 'field_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 检测输入框类型
   */
  detectInputType(content, labelText) {
    // 查找该标签对应的输入框
    const labelIndex = content.indexOf(labelText);
    if (labelIndex === -1) return 'TEXT';

    // 向后搜索一定范围内的输入框
    const searchRange = content.substr(labelIndex, 500);

    if (searchRange.includes('type="number"')) return 'NUMBER';
    if (searchRange.includes('type="date"')) return 'DATE';
    if (searchRange.includes('type="datetime"')) return 'DATETIME';
    if (searchRange.includes('type="email"')) return 'EMAIL';
    if (searchRange.includes('type="tel"') || searchRange.includes('手机号')) return 'PHONE';
    if (searchRange.includes('<textarea')) return 'TEXTAREA';
    if (searchRange.includes('<select')) return 'SELECT';
    if (searchRange.includes('type="checkbox"')) return 'BOOLEAN';
    if (searchRange.includes('type="radio"')) return 'RADIO';

    return 'TEXT';
  }

  /**
   * 检查字段是否必填
   */
  checkRequired(content, labelText) {
    const labelIndex = content.indexOf(labelText);
    if (labelIndex === -1) return false;

    const searchRange = content.substr(labelIndex, 200);
    return searchRange.includes('required') ||
           searchRange.includes('必填') ||
           searchRange.includes('*');
  }

  /**
   * 合并重复字段
   */
  mergeFields(fields) {
    const fieldMap = new Map();

    fields.forEach(field => {
      const existing = fieldMap.get(field.id);
      if (existing) {
        // 合并字段属性
        existing.type = existing.type || field.type;
        existing.searchable = existing.searchable || field.searchable;
        existing.required = existing.required || field.required;
        existing.fromTable = existing.fromTable || field.fromTable;
        existing.fromForm = existing.fromForm || field.fromForm;
        existing.fromSearch = existing.fromSearch || field.fromSearch;
      } else {
        // 设置敏感度
        field.sensitivity = this.detectSensitivity(field.name);
        fieldMap.set(field.id, {
          ...field,
          description: field.name,
          sensitivity: field.sensitivity,
          visibility: {
            超级管理员: true,
            管理员: true,
            经理: true
          }
        });
      }
    });

    return Array.from(fieldMap.values());
  }

  /**
   * 根据字段名称检测敏感度
   */
  detectSensitivity(fieldName) {
    const name = fieldName.toLowerCase();

    // 检查机密关键词
    if (this.sensitivityKeywords.confidential.some(keyword =>
      name.includes(keyword.toLowerCase()) || fieldName.includes(keyword))) {
      return 'CONFIDENTIAL';
    }

    // 检查敏感关键词
    if (this.sensitivityKeywords.sensitive.some(keyword =>
      name.includes(keyword.toLowerCase()) || fieldName.includes(keyword))) {
      return 'SENSITIVE';
    }

    // 检查内部关键词
    if (this.sensitivityKeywords.internal.some(keyword =>
      name.includes(keyword.toLowerCase()) || fieldName.includes(keyword))) {
      return 'INTERNAL';
    }

    // 默认为公开
    return 'PUBLIC';
  }

  /**
   * 生成字段定义配置
   */
  generateFieldConfig(scanResult) {
    if (!scanResult || !scanResult.fields) return null;

    const config = {
      name: scanResult.moduleName,
      category: this.getCategoryName(scanResult.category),
      fields: scanResult.fields.map(field => ({
        id: field.id,
        name: field.name,
        group: field.group,
        type: field.type,
        sensitivity: field.sensitivity,
        description: field.description,
        required: field.required || false,
        searchable: field.searchable || false,
        visibility: field.visibility || {
          超级管理员: true,
          管理员: true,
          经理: true
        }
      }))
    };

    return config;
  }

  /**
   * 获取分类中文名称
   */
  getCategoryName(category) {
    const categoryMap = {
      'brands': '基础数据',
      'models': '基础数据',
      'colors': '基础数据',
      'memories': '基础数据',
      'employees': '人事管理',
      'suppliers': '供应链',
      'stores': '门店管理',
      'customers': '客户管理',
      'sales': '业务管理',
      'inventory': '库存管理',
      'query': '查询统计'
    };

    return categoryMap[category] || '其他';
  }

  /**
   * 批量扫描多个组件
   */
  async scanMultipleComponents(components) {
    const results = [];

    for (const component of components) {
      const result = await this.scanComponentFields(component.category, component.filename);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }
}

module.exports = FieldScanner;
