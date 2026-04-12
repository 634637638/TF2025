const log = require('../utils/log');
/**
 * 产品名称映射管理接口
 * 支持两种模式：
 * 1. 读取静态配置文件（高性能）
 * 2. 数据库动态管理（灵活性）
 */
const fs = require('fs').promises;
const path = require('path');
const ApiResponse = require('../utils/response');

// 静态配置文件路径
const CONFIG_FILE_PATH = path.join(__dirname, '../config/product-name-mapping.js');

class ProductMappingController {
  /**
   * 获取所有映射（从静态配置读取）
   */
  async getAllMappings(req, res) {
    try {
      // 读取并解析静态配置文件
      const configContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');

      // 提取 PRODUCT_NAME_MAPPING 对象
      const mappingMatch = configContent.match(/const PRODUCT_NAME_MAPPING = \{([\s\S]*?)\};/);
      if (!mappingMatch) {
        return ApiResponse.error(res, '配置文件格式错误', 500);
      }

      // 简单解析（实际使用 eval 或更安全的解析方式）
      // 由于安全考虑，这里使用正则提取
      const mappings = [];

      // 匹配每个映射项
      const itemRegex = /'([^']+)': \{\s*brand: '([^']*)',\s*model: '([^']*)',\s*external_model: ([^,]*),\s*category: '([^']*)'\s*\}/g;
      let match;

      while ((match = itemRegex.exec(configContent)) !== null) {
        mappings.push({
          externalName: match[1],
          brand: match[2],
          model: match[3],
          externalModel: match[4] === 'null' ? null : match[4].replace(/'/g, ''),
          category: match[5]
        });
      }

      return ApiResponse.success(res, mappings, '获取成功');
    } catch (error) {
      log.error('读取映射配置失败:', error);
      return ApiResponse.error(res, '读取配置失败', 500);
    }
  }

  /**
   * 添加映射（追加到配置文件）
   */
  async addMapping(req, res) {
    try {
      const { externalName, brand, model, externalModel, category } = req.body;

      if (!externalName || !brand || !model) {
        return ApiResponse.error(res, '外部名称、品牌和型号为必填项', 400);
      }

      // 读取现有配置
      let configContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');

      // 检查是否已存在
      if (configContent.includes(`'${externalName}':`)) {
        return ApiResponse.error(res, '该映射已存在', 400);
      }

      // 构建新的映射项
      const newMapping = `  '${externalName}': {
    brand: '${brand}',
    model: '${model}',
    external_model: ${externalModel ? `'${externalModel}'` : 'null'},
    category: '${category || 'phone'}'
  }`;

      // 找到插入位置（在最后一个映射项之后，闭合大括号之前）
      const lastBracketIndex = configContent.lastIndexOf('};');
      const insertPosition = configContent.lastIndexOf('\n', lastBracketIndex);

      // 插入新映射（添加逗号到前一项）
      const beforeInsert = configContent.substring(0, insertPosition);
      const afterInsert = configContent.substring(insertPosition);

      // 检查前一项是否有逗号
      const updatedContent = beforeInsert.replace(/(\n)\s*$/, ',\n') + newMapping + '\n' + afterInsert.trim();

      // 写回文件
      await fs.writeFile(CONFIG_FILE_PATH, updatedContent, 'utf-8');

      return ApiResponse.success(res, null, '添加成功');
    } catch (error) {
      log.error('添加映射失败:', error);
      return ApiResponse.error(res, '添加映射失败', 500);
    }
  }

  /**
   * 删除映射
   */
  async deleteMapping(req, res) {
    try {
      const { externalName } = req.params;
      const decodedName = decodeURIComponent(externalName);

      // 读取现有配置
      let configContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');

      // 检查是否存在
      if (!configContent.includes(`'${decodedName}':`)) {
        return ApiResponse.error(res, '映射不存在', 404);
      }

      // 使用正则删除该映射项
      const regex = new RegExp(`\\s+'${decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': \\{[^}]*\\},?\\n`, 'g');
      const updatedContent = configContent.replace(regex, '\n');

      await fs.writeFile(CONFIG_FILE_PATH, updatedContent, 'utf-8');

      return ApiResponse.success(res, null, '删除成功');
    } catch (error) {
      log.error('删除映射失败:', error);
      return ApiResponse.error(res, '删除映射失败', 500);
    }
  }

  /**
   * 测试映射匹配（使用现有的 matchProductName 函数）
   */
  async testMapping(req, res) {
    try {
      const { name } = req.query;
      if (!name) {
        return ApiResponse.error(res, '请提供产品名称', 400);
      }

      // 使用现有的映射函数
      const { matchProductName } = require('../config/product-name-mapping');
      const result = matchProductName(name);

      if (result) {
        return ApiResponse.success(res, {
          matched: true,
          result: {
            externalName: name,
            brand: result.brand,
            model: result.model,
            externalModel: result.external_model,
            category: result.category
          }
        }, '匹配成功');
      }

      return ApiResponse.success(res, {
        matched: false,
        result: null
      }, '未匹配到映射');
    } catch (error) {
      log.error('测试映射失败:', error);
      return ApiResponse.error(res, '测试映射失败', 500);
    }
  }
}

module.exports = new ProductMappingController();
