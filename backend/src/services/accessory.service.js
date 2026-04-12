/**
 * 配件业务逻辑层
 * 处理所有配件相关的业务逻辑和数据验证
 */
const AccessoryRepository = require('../repositories/accessory.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class AccessoryService {
  constructor() {
    this.accessoryRepository = new AccessoryRepository();
  }

  /**
   * 生成批次号
   */
  generateBatchNo() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RK${year}${month}${day}${random}`;
  }

  /**
   * 生成销售单号
   */
  generateSaleNo() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PS${year}${month}${day}${random}`;
  }

  /**
   * 创建成功响应
   */
  success(message, data = null) {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建错误响应
   */
  error(message, code = null) {
    return {
      success: false,
      message,
      code
    };
  }

  /**
   * 获取配件列表
   */
  async getAccessories(params) {
    try {
      const result = await this.accessoryRepository.getAccessories(params);
      return this.success('获取配件列表成功', result);
    } catch (error) {
      log.error('获取配件列表失败:', error);
      return this.error('获取配件列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取配件详情
   */
  async getAccessoryDetail(id) {
    try {
      const accessory = await this.accessoryRepository.getAccessoryById(id);
      if (!accessory) {
        return this.error('配件不存在', 'NOT_FOUND');
      }

      // 获取库存信息
      const stock = await this.accessoryRepository.getAccessoryStock(id);

      return this.success('获取配件详情成功', {
        ...accessory,
        stock
      });
    } catch (error) {
      log.error('获取配件详情失败:', error);
      return this.error('获取配件详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据条形码获取配件
   */
  async getAccessoryByBarcode(barcode) {
    try {
      const accessory = await this.accessoryRepository.getAccessoryByBarcode(barcode);
      if (!accessory) {
        return this.error('未找到该条形码的配件', 'NOT_FOUND');
      }

      // 获取库存信息
      const stock = await this.accessoryRepository.getAccessoryStock(accessory.id);

      return this.success('获取配件成功', {
        ...accessory,
        stock
      });
    } catch (error) {
      log.error('根据条形码获取配件失败:', error);
      return this.error('根据条形码获取配件失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 创建配件
   */
  async createAccessory(data) {
    try {
      // 验证必填字段
      if (!data.name) {
        return this.error('配件名称不能为空', 'VALIDATION_ERROR');
      }

      // 检查条形码是否已存在
      if (data.barcode) {
        const existing = await this.accessoryRepository.getAccessoryByBarcode(data.barcode);
        if (existing) {
          return this.error('该条形码已存在', 'DUPLICATE_BARCODE');
        }
      }

      const id = await this.accessoryRepository.createAccessory(data);
      const accessory = await this.accessoryRepository.getAccessoryById(id);

      return this.success('创建配件成功', accessory);
    } catch (error) {
      log.error('创建配件失败:', error);
      return this.error('创建配件失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新配件
   */
  async updateAccessory(id, data) {
    try {
      const existing = await this.accessoryRepository.getAccessoryById(id);
      if (!existing) {
        return this.error('配件不存在', 'NOT_FOUND');
      }

      // 如果要修改条形码，检查是否重复
      if (data.barcode && data.barcode !== existing.barcode) {
        const duplicate = await this.accessoryRepository.getAccessoryByBarcode(data.barcode);
        if (duplicate && duplicate.id !== id) {
          return this.error('该条形码已存在', 'DUPLICATE_BARCODE');
        }
      }

      const updated = await this.accessoryRepository.updateAccessory(id, data);
      if (!updated) {
        return this.error('更新配件失败', 'UPDATE_FAILED');
      }

      const accessory = await this.accessoryRepository.getAccessoryById(id);
      return this.success('更新配件成功', accessory);
    } catch (error) {
      log.error('更新配件失败:', error);
      return this.error('更新配件失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除配件
   */
  async deleteAccessory(id) {
    try {
      const existing = await this.accessoryRepository.getAccessoryById(id);
      if (!existing) {
        return this.error('配件不存在', 'NOT_FOUND');
      }

      const deleted = await this.accessoryRepository.deleteAccessory(id);
      if (!deleted) {
        return this.error('删除配件失败', 'DELETE_FAILED');
      }

      return this.success('删除配件成功');
    } catch (error) {
      log.error('删除配件失败:', error);
      return this.error('删除配件失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 配件入库
   */
  async stockIn(data) {
    try {
      const {
        barcode,
        accessory_id,
        name,
        category,
        brand_id,
        model_id,
        color_id,
        supplier_id,
        purchase_price,
        selling_price,
        unit,
        status,
        min_stock,
        total_quantity,
        distribution,
        store_id,
        operator_id,
        operator_name,
        remarks
      } = data;

      // 验证必填字段
      if (!supplier_id) {
        return this.error('请选择供应商', 'VALIDATION_ERROR');
      }
      if (!total_quantity || total_quantity <= 0) {
        return this.error('入库数量必须大于0', 'VALIDATION_ERROR');
      }
      if (!store_id) {
        return this.error('缺少操作门店信息', 'VALIDATION_ERROR');
      }

      // 处理门店分配：如果未分配或分配不足，将剩余数量分配到当前门店
      let finalDistribution = distribution || [];
      const distributedTotal = finalDistribution.reduce((sum, d) => sum + (d.quantity || 0), 0);
      const remainingQuantity = parseInt(total_quantity) - distributedTotal;

      // 如果有剩余数量，分配到当前门店
      if (remainingQuantity > 0) {
        const existingStoreIndex = finalDistribution.findIndex(d => d.store_id === store_id);
        if (existingStoreIndex >= 0) {
          finalDistribution[existingStoreIndex].quantity += remainingQuantity;
        } else {
          finalDistribution.push({
            store_id: store_id,
            store_name: null, // 后续会补充
            quantity: remainingQuantity
          });
        }
      }

      let finalAccessoryId = accessory_id;

      // 1. 检查或创建配件
      if (finalAccessoryId) {
        const existing = await this.accessoryRepository.getAccessoryById(finalAccessoryId);
        if (!existing) {
          return this.error('配件不存在', 'NOT_FOUND');
        }
      } else if (barcode) {
        // 尝试通过条形码查找
        const existing = await this.accessoryRepository.getAccessoryByBarcode(barcode);
        if (existing) {
          finalAccessoryId = existing.id;
        }
      }

      // 如果配件不存在，创建新配件
      if (!finalAccessoryId) {
        if (!name) {
          return this.error('请填写配件名称', 'VALIDATION_ERROR');
        }
        finalAccessoryId = await this.accessoryRepository.createAccessory({
          name,
          barcode,
          category,
          brand_id,
          model_id,
          color_id,
          supplier_id,
          purchase_price,
          selling_price,
          unit,
          status: status !== undefined ? status : 1,
          image_url: data.image_url || null
        });
      }

      // 2. 创建入库记录
      const batchNo = this.generateBatchNo();
      const totalAmount = purchase_price * total_quantity;

      await this.accessoryRepository.createStockInRecord({
        batch_no: batchNo,
        accessory_id: finalAccessoryId,
        supplier_id,
        store_id,
        quantity: total_quantity,
        purchase_price,
        total_amount: totalAmount,
        barcode_scanned: barcode,
        distribution: JSON.stringify(finalDistribution),
        remarks,
        operator_id,
        operator_name,
        stock_in_date: new Date(),
        status: 'completed'
      });

      // 3. 更新各门店库存
      for (const item of finalDistribution) {
        if (item.quantity > 0) {
          await this.accessoryRepository.updateAccessoryStock(
            finalAccessoryId,
            item.store_id,
            item.quantity,
            'add',
            min_stock || 5
          );
        }
      }

      // 4. 返回结果
      const accessory = await this.accessoryRepository.getAccessoryById(finalAccessoryId);
      const stock = await this.accessoryRepository.getAccessoryStock(finalAccessoryId);

      return this.success('入库成功', {
        batch_no: batchNo,
        accessory,
        stock,
        total_amount
      });
    } catch (error) {
      log.error('配件入库失败:', error);
      return this.error('配件入库失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取配件库存列表
   */
  async getStockList(params) {
    try {
      const result = await this.accessoryRepository.getAllAccessoryStock(params);
      return this.success('获取库存列表成功', result);
    } catch (error) {
      log.error('获取库存列表失败:', error);
      return this.error('获取库存列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取入库记录列表
   */
  async getStockInRecords(params) {
    try {
      const result = await this.accessoryRepository.getStockInRecords(params);
      return this.success('获取入库记录成功', result);
    } catch (error) {
      log.error('获取入库记录失败:', error);
      return this.error('获取入库记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取分类统计
   */
  async getCategoryStats() {
    try {
      const stats = await this.accessoryRepository.getCategoryStats();
      return this.success('获取分类统计成功', stats);
    } catch (error) {
      log.error('获取分类统计失败:', error);
      return this.error('获取分类统计失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取库存预警
   */
  async getLowStockWarnings(threshold = 5) {
    try {
      const accessories = await this.accessoryRepository.getLowStockAccessories(threshold);
      return this.success('获取库存预警成功', {
        threshold,
        count: accessories.length,
        warnings: accessories
      });
    } catch (error) {
      log.error('获取库存预警失败:', error);
      return this.error('获取库存预警失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 配件销售
   */
  async sell(data) {
    try {
      const {
        accessory_id,
        store_id,
        customer_id,
        customer_name,
        customer_phone,
        quantity,
        unit_price,
        operator_id,
        operator_name,
        remarks
      } = data;

      // 验证必填字段
      if (!accessory_id) {
        return this.error('请选择配件', 'VALIDATION_ERROR');
      }
      if (!store_id) {
        return this.error('请选择门店', 'VALIDATION_ERROR');
      }
      if (!quantity || quantity <= 0) {
        return this.error('销售数量必须大于0', 'VALIDATION_ERROR');
      }
      if (!unit_price || unit_price < 0) {
        return this.error('请填写正确的单价', 'VALIDATION_ERROR');
      }

      // 获取配件信息
      const accessory = await this.accessoryRepository.getAccessoryById(accessory_id);
      if (!accessory) {
        return this.error('配件不存在', 'NOT_FOUND');
      }

      // 检查门店库存
      const stockData = await this.accessoryRepository.getAccessoryStock(accessory_id);
      const storeStock = stockData.stores.find(s => s.store_id === parseInt(store_id));

      if (!storeStock || storeStock.quantity < quantity) {
        return this.error(`库存不足，当前库存: ${storeStock ? storeStock.quantity : 0}`, 'INSUFFICIENT_STOCK');
      }

      // 计算金额
      const totalPrice = unit_price * quantity;
      const purchaseCost = accessory.purchase_price * quantity;
      const profit = totalPrice - purchaseCost;

      // 创建销售记录
      const saleNo = this.generateSaleNo();
      await this.accessoryRepository.createSalesRecord({
        sale_no: saleNo,
        accessory_id,
        store_id,
        customer_id,
        customer_name,
        customer_phone,
        quantity,
        unit_price,
        total_price: totalPrice,
        purchase_cost: purchaseCost,
        profit,
        remarks,
        operator_id,
        operator_name,
        sale_time: new Date()
      });

      // 更新库存
      await this.accessoryRepository.updateAccessoryStock(
        accessory_id,
        store_id,
        quantity,
        'subtract'
      );

      return this.success('销售成功', {
        sale_no: saleNo,
        total_price: totalPrice,
        profit
      });
    } catch (error) {
      log.error('配件销售失败:', error);
      return this.error('配件销售失败', 'DATABASE_ERROR');
    }
  }
}

module.exports = AccessoryService;
