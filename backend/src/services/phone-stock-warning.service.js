/**
 * 手机库存预警配置业务逻辑层
 */
const PhoneStockWarningRepository = require('../repositories/phone-stock-warning.repository');
const log = require('../utils/log');

class PhoneStockWarningService {
  constructor() {
    this.repository = new PhoneStockWarningRepository();
  }

  normalizeConditionValue(value) {
    if (value === '' || value === undefined || value === null) {
      return null;
    }

    const normalizedValue = Number(value);
    if (normalizedValue === 0 || normalizedValue === 1) {
      return normalizedValue;
    }

    return Number.NaN;
  }

  normalizeConditionArray(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    const result = [];
    for (const value of values) {
      const normalizedValue = this.normalizeConditionValue(value);
      if (Number.isNaN(normalizedValue)) {
        return null;
      }
      if (normalizedValue === 0 || normalizedValue === 1) {
        result.push(normalizedValue);
      }
    }

    return [...new Set(result)];
  }

  normalizeIdArray(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return [...new Set(
      values
        .map(value => parseInt(value, 10))
        .filter(value => !isNaN(value) && value > 0)
    )];
  }

  buildBatchCombos(colorIds, memoryIds, conditionValues, fallbackColorId = null, fallbackMemoryId = null, fallbackCondition = null) {
    const colorOptions = colorIds.length > 0 ? colorIds : [fallbackColorId];
    const memoryOptions = memoryIds.length > 0 ? memoryIds : [fallbackMemoryId];
    const conditionOptions = conditionValues.length > 0 ? conditionValues : [fallbackCondition];
    const combos = [];

    for (const colorId of colorOptions) {
      for (const memoryId of memoryOptions) {
        for (const isNew of conditionOptions) {
          combos.push({
            color_id: colorId ?? null,
            memory_id: memoryId ?? null,
            is_new: isNew ?? null
          });
        }
      }
    }

    return combos;
  }

  /**
   * 创建成功的响应格式
   */
  createSuccessResponse(message, data = null) {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建错误的响应格式
   */
  createErrorResponse(message, statusCode = 500) {
    return {
      success: false,
      message,
      statusCode
    };
  }

  /**
   * 获取所有预警配置
   */
  async getAllConfigs() {
    try {
      const configs = await this.repository.getAllConfigsWithDetails();
      return this.createSuccessResponse('获取预警配置成功', configs);
    } catch (error) {
      log.error('获取预警配置失败:', error);
      return this.createErrorResponse('获取预警配置失败', 500);
    }
  }

  /**
   * 根据品牌和型号获取预警阈值
   */
  async getWarningThreshold(brandId, modelId) {
    try {
      const threshold = await this.repository.getWarningConfig(brandId, modelId);
      return this.createSuccessResponse('获取预警阈值成功', { threshold });
    } catch (error) {
      log.error('获取预警阈值失败:', error);
      return this.createErrorResponse('获取预警阈值失败', 500);
    }
  }

  /**
   * 创建预警配置
   */
  async createConfig(userId, configData) {
    try {
      const conditionValues = this.normalizeConditionArray(configData.condition_values);
      if (conditionValues === null) {
        return this.createErrorResponse('库存类型只能是全新或二手', 400);
      }

      const normalizedIsNew = this.normalizeConditionValue(configData.is_new);
      if (Number.isNaN(normalizedIsNew)) {
        return this.createErrorResponse('库存类型只能是全新或二手', 400);
      }
      configData.is_new = normalizedIsNew;

      // 验证必填字段
      if (!configData.brand_id || !configData.model_id) {
        return this.createErrorResponse('必须选择品牌和型号', 400);
      }

      // 验证阈值范围
      if (configData.min_stock !== undefined) {
        const minStock = parseInt(configData.min_stock);
        if (isNaN(minStock) || minStock < 0 || minStock > 100) {
          return this.createErrorResponse('预警阈值必须在0-100之间', 400);
        }
      }

      const colorIds = this.normalizeIdArray(configData.color_ids);
      const memoryIds = this.normalizeIdArray(configData.memory_ids);
      const targetCombos = this.buildBatchCombos(
        colorIds,
        memoryIds,
        conditionValues || [],
        configData.color_id || null,
        configData.memory_id || null,
        configData.is_new
      );

      let createdCount = 0;
      let skippedCount = 0;
      const createdIds = [];

      for (const combo of targetCombos) {
        const exists = await this.repository.checkConfigExists(
          configData.brand_id,
          configData.model_id,
          combo.color_id,
          combo.memory_id,
          combo.is_new
        );

        if (exists) {
          skippedCount += 1;
          continue;
        }

        const configId = await this.repository.createConfig({
          ...configData,
          color_id: combo.color_id,
          memory_id: combo.memory_id,
          is_new: combo.is_new
        });

        createdIds.push(configId);
        createdCount += 1;
      }

      if (createdCount === 0) {
        return this.createErrorResponse('所选颜色和内存组合已存在', 400);
      }

      const message = skippedCount > 0
        ? `成功新增 ${createdCount} 条配置，跳过 ${skippedCount} 条已存在组合`
        : `成功新增 ${createdCount} 条配置`;

      return this.createSuccessResponse(message, {
        ids: createdIds,
        created_count: createdCount,
        skipped_count: skippedCount,
        ...configData
      });
    } catch (error) {
      log.error('创建预警配置失败:', error);
      return this.createErrorResponse('创建预警配置失败', 500);
    }
  }

  /**
   * 更新预警配置
   */
  async updateConfig(userId, configId, configData) {
    try {
      log.debug('📝 更新预警配置 - 开始', { configId, configData });

      const conditionValues = this.normalizeConditionArray(configData.condition_values);
      if (conditionValues === null) {
        return this.createErrorResponse('库存类型只能是全新或二手', 400);
      }

      if (configData.is_new !== undefined) {
        const normalizedIsNew = this.normalizeConditionValue(configData.is_new);
        if (Number.isNaN(normalizedIsNew)) {
          return this.createErrorResponse('库存类型只能是全新或二手', 400);
        }
        configData.is_new = normalizedIsNew;
      }

      // 验证配置是否存在
      const configs = await this.repository.executeQuery(
        'SELECT * FROM phone_stock_warnings WHERE id = ?',
        [configId]
      );

      if (!configs || configs.length === 0) {
        log.debug('❌ 配置不存在');
        return this.createErrorResponse('配置不存在', 404);
      }

      const existingConfig = configs[0];
      log.debug('✅ 找到现有配置:', existingConfig);

      // 确定新的值
      const newBrandId = configData.brand_id !== undefined ? configData.brand_id : existingConfig.brand_id;
      const newModelId = configData.model_id !== undefined ? configData.model_id : existingConfig.model_id;
      const newColorId = configData.color_id !== undefined ? configData.color_id : existingConfig.color_id;
      const newMemoryId = configData.memory_id !== undefined ? configData.memory_id : existingConfig.memory_id;
      const newIsNew = configData.is_new !== undefined ? configData.is_new : existingConfig.is_new;
      const colorIds = this.normalizeIdArray(configData.color_ids);
      const memoryIds = this.normalizeIdArray(configData.memory_ids);

      log.debug('🔄 新的配置:', { newBrandId, newModelId, newColorId, newMemoryId, newIsNew });

      const targetCombos = this.buildBatchCombos(
        colorIds,
        memoryIds,
        conditionValues || [],
        newColorId,
        newMemoryId,
        newIsNew
      );

      const currentComboKey = `${existingConfig.color_id ?? 'null'}_${existingConfig.memory_id ?? 'null'}_${existingConfig.is_new ?? 'null'}`;
      const currentComboIndex = targetCombos.findIndex(
        combo => `${combo.color_id ?? 'null'}_${combo.memory_id ?? 'null'}_${combo.is_new ?? 'null'}` === currentComboKey
      );

      if (currentComboIndex > 0) {
        const [currentCombo] = targetCombos.splice(currentComboIndex, 1);
        targetCombos.unshift(currentCombo);
      }

      const seenComboKeys = new Set();
      for (const combo of targetCombos) {
        const comboKey = `${combo.color_id ?? 'null'}_${combo.memory_id ?? 'null'}_${combo.is_new ?? 'null'}`;
        if (seenComboKeys.has(comboKey)) {
          return this.createErrorResponse('颜色、内存、库存类型组合存在重复选择', 400);
        }
        seenComboKeys.add(comboKey);
      }

      // 验证阈值范围
      if (configData.min_stock !== undefined) {
        const minStock = parseInt(configData.min_stock);
        if (isNaN(minStock) || minStock < 0 || minStock > 100) {
          log.debug('❌ 阈值范围错误:', minStock);
          return this.createErrorResponse('预警阈值必须在0-100之间', 400);
        }
      }

      const sharedData = {
        brand_id: newBrandId,
        model_id: newModelId,
        is_new: newIsNew,
        min_stock: configData.min_stock !== undefined ? configData.min_stock : existingConfig.min_stock,
        warning_enabled: configData.warning_enabled !== undefined ? configData.warning_enabled : existingConfig.warning_enabled,
        config_name: configData.config_name !== undefined ? configData.config_name : existingConfig.config_name,
        remarks: configData.remarks !== undefined ? configData.remarks : existingConfig.remarks,
        status: configData.status !== undefined ? configData.status : existingConfig.status
      };

      log.debug('💾 准备批量更新数据库...');

      let updatedCount = 0;
      let createdCount = 0;
      const affectedIds = [];

      for (let index = 0; index < targetCombos.length; index += 1) {
        const combo = targetCombos[index];
        const payload = {
          ...sharedData,
          color_id: combo.color_id,
          memory_id: combo.memory_id,
          is_new: combo.is_new
        };

        if (index === 0) {
          const conflictConfig = await this.repository.findConfigByExactMatch(
            newBrandId,
            newModelId,
            combo.color_id,
            combo.memory_id,
            combo.is_new,
            configId
          );

          if (conflictConfig) {
            await this.repository.updateConfig(conflictConfig.id, payload);
            affectedIds.push(conflictConfig.id);
            updatedCount += 1;
          } else {
            await this.repository.updateConfig(configId, payload);
            affectedIds.push(configId);
            updatedCount += 1;
          }
          continue;
        }

        const matchedConfig = await this.repository.findConfigByExactMatch(
          newBrandId,
          newModelId,
          combo.color_id,
          combo.memory_id,
          combo.is_new,
          configId
        );

        if (matchedConfig) {
          await this.repository.updateConfig(matchedConfig.id, payload);
          affectedIds.push(matchedConfig.id);
          updatedCount += 1;
        } else {
          const newId = await this.repository.createConfig(payload);
          affectedIds.push(newId);
          createdCount += 1;
        }
      }

      log.debug('✅ 数据库批量更新成功');

      const message = targetCombos.length > 1
        ? `批量保存成功，更新 ${updatedCount} 条，新增 ${createdCount} 条`
        : '更新预警配置成功';

      return this.createSuccessResponse(message, {
        ids: affectedIds,
        updated_count: updatedCount,
        created_count: createdCount,
        ...sharedData
      });
    } catch (error) {
      log.error('❌ 更新预警配置失败:', error);
      return this.createErrorResponse('更新预警配置失败: ' + error.message, 500);
    }
  }

  /**
   * 删除预警配置
   */
  async deleteConfig(userId, configId) {
    try {
      await this.repository.deleteConfig(configId);
      return this.createSuccessResponse('删除预警配置成功', { id: configId });
    } catch (error) {
      if (error.message === '不允许删除默认全局配置') {
        return this.createErrorResponse(error.message, 400);
      }
      log.error('删除预警配置失败:', error);
      return this.createErrorResponse('删除预警配置失败', 500);
    }
  }

  /**
   * 切换预警开关
   */
  async toggleWarning(userId, configId, enabled) {
    try {
      await this.repository.toggleWarningEnabled(configId, enabled);
      return this.createSuccessResponse(
        enabled ? '启用预警成功' : '禁用预警成功',
        { id: configId, enabled }
      );
    } catch (error) {
      log.error('切换预警状态失败:', error);
      return this.createErrorResponse('切换预警状态失败', 500);
    }
  }

  /**
   * 获取品牌列表
   */
  async getBrands() {
    try {
      const brands = await this.repository.getActiveBrands();
      return this.createSuccessResponse('获取品牌列表成功', brands);
    } catch (error) {
      log.error('获取品牌列表失败:', error);
      return this.createErrorResponse('获取品牌列表失败', 500);
    }
  }

  /**
   * 根据品牌获取型号列表
   */
  async getModelsByBrand(brandId) {
    try {
      if (!brandId) {
        return this.createErrorResponse('品牌ID不能为空', 400);
      }

      const models = await this.repository.getActiveModelsByBrand(brandId);
      return this.createSuccessResponse('获取型号列表成功', models);
    } catch (error) {
      log.error('获取型号列表失败:', error);
      return this.createErrorResponse('获取型号列表失败', 500);
    }
  }

  /**
   * 获取颜色列表
   */
  async getColors() {
    try {
      const colors = await this.repository.getActiveColors();
      return this.createSuccessResponse('获取颜色列表成功', colors);
    } catch (error) {
      log.error('获取颜色列表失败:', error);
      return this.createErrorResponse('获取颜色列表失败', 500);
    }
  }

  /**
   * 获取内存列表
   */
  async getMemories() {
    try {
      const memories = await this.repository.getActiveMemories();
      return this.createSuccessResponse('获取内存列表成功', memories);
    } catch (error) {
      log.error('获取内存列表失败:', error);
      return this.createErrorResponse('获取内存列表失败', 500);
    }
  }
}

module.exports = PhoneStockWarningService;
