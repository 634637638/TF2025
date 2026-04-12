const SaleRepository = require('../repositories/sale.repository');
const CustomerRepository = require('../repositories/customer.repository');
const log = require('../utils/log');

class SaleService {
  constructor() {
    this.saleRepository = new SaleRepository();
    this.customerRepository = new CustomerRepository();
  }

  /**
   * 手机销售出库
   * @param {Object} saleData - 销售数据
   * @returns {Object} 销售结果
   */
  async sellPhone(saleData) {
    const startTime = Date.now();
    try {
      log.debug('🛒 SaleService.sellPhone 开始执行，销售数据:', saleData);

      const {
        phone_id,
        imei,
        customer_id,
        customer_info,
        customer_name,
        customer_phone,
        customer_apple_id,
        sale_type = 'retail',
        price,
        cost,
        payment_method,
        invoice_number,
        remarks,
        operator_id,
        store_id,
        sale_date
      } = saleData;

      log.debug('📱 步骤1: 开始查找手机信息，IMEI:', imei, 'phone_id:', phone_id);
      let phone = null;

      // 优先尝试IMEI查询
      try {
        phone = await this.saleRepository.findPhoneByImei(imei);
        log.debug('📱 IMEI查询成功，找到手机信息:', phone ? phone.id : 'null');
      } catch (error) {
        log.debug('📱 IMEI查询失败，尝试使用phone_id:', error.message);
      }

      // 如果IMEI查询失败且有phone_id，使用phone_id直接查询
      if (!phone && phone_id) {
        try {
          phone = await this.saleRepository.findPhoneById(phone_id);
          log.debug('📱 phone_id查询成功，找到手机信息:', phone ? phone.id : 'null');
        } catch (error) {
          log.debug('📱 phone_id查询也失败:', error.message);
        }
      }

      if (!phone) {
        throw new Error('未找到对应的可销售手机');
      }

      // 2. 处理客户信息 - 兼容前端发送的格式
      let finalCustomerId = customer_id;
      let finalCustomerInfo = customer_info;

      // 如果没有customer_info但有独立的客户字段，则构建customer_info对象
      if (!customer_info && (customer_name || customer_phone || customer_apple_id)) {
        finalCustomerInfo = {
          name: customer_name,
          phone: customer_phone,
          apple_id: customer_apple_id
        };
      }

      if (finalCustomerInfo && !customer_id) {
        // 首先根据手机号码查找现有客户
        if (finalCustomerInfo.phone) {
          try {
            const existingCustomer = await this.customerRepository.findCustomerByPhone(finalCustomerInfo.phone);
            if (existingCustomer) {
              // 找到现有客户，使用现有客户ID
              finalCustomerId = existingCustomer.id;

              // 如果提供了新的Apple ID，更新现有客户的Apple ID
              if (finalCustomerInfo.apple_id && finalCustomerInfo.apple_id.trim() && existingCustomer.apple_id !== finalCustomerInfo.apple_id) {
                await this.customerRepository.updateCustomerAppleId(existingCustomer.id, finalCustomerInfo.apple_id);
              }
            }
          } catch (error) {
            // 客户不存在，继续创建新客户
            log.debug('客户不存在，将创建新客户');
          }
        }

        // 如果没有找到现有客户，创建新客户
        if (!finalCustomerId) {
          // 验证新客户必填字段
          if (!finalCustomerInfo.name || finalCustomerInfo.name.trim() === '') {
            throw new Error('新客户姓名为必填项');
          }

          if (!finalCustomerInfo.phone || finalCustomerInfo.phone.trim() === '') {
            throw new Error('新客户手机号码为必填项');
          }

          const customerData = {
            name: finalCustomerInfo.name,
            phone: finalCustomerInfo.phone,
            apple_id: finalCustomerInfo.apple_id || null,
            address: finalCustomerInfo.address || null,
            remarks: finalCustomerInfo.remarks || null,
            source: 'sales' // 标记为销售系统创建
          };
          finalCustomerId = await this.customerRepository.createCustomer(customerData);
        }
      }

      // 3. 获取成本信息（前端将用于计算利润显示）
      log.debug('💰 步骤3: 获取成本信息');
      const dbCost = phone.purchase_cost || 0;
      log.debug('💰 步骤3完成: 成本:', dbCost, '售价:', price, '利润将在前端实时计算');

      // 3.5. 如果没有发票号，自动生成（使用销售时间）
      let finalInvoiceNumber = invoice_number;
      if (!finalInvoiceNumber) {
        const { generateInvoiceNumber } = require('../utils/invoice-number');
        const pool = require('../config/database').getDatabase();
        const connection = await new Promise((resolve, reject) => {
          pool.getConnection((err, conn) => {
            if (err) return reject(err);
            resolve(conn);
          });
        });

        // 使用销售时间生成发票号
        const saleDateObj = sale_date ? new Date(sale_date + 'T00:00:00+08:00') : new Date();
        finalInvoiceNumber = await generateInvoiceNumber(sale_type, connection, saleDateObj);

        connection.release();
        log.debug(`✅ 自动生成发票号: ${finalInvoiceNumber}, 销售日期: ${saleDateObj.toISOString().split('T')[0]}, 类型: ${sale_type}`);
      }

      // 4. 创建销售记录
      log.debug('📝 步骤4: 开始创建销售记录');
      const saleRecordData = {
        phone_id: phone.id,
        customer_id: finalCustomerId,
        sale_type,
        price: parseFloat(price),
        cost: parseFloat(dbCost),  // 🔥 添加入库成本到销售记录
        operator_id,
        store_id: store_id,  // 直接使用前端选择的销售店铺
        payment_method: payment_method || null,
        invoice_number: finalInvoiceNumber,
        sale_date: sale_date ? new Date(sale_date + 'T00:00:00+08:00') : new Date()  // 北京时间
      };

      const saleId = await this.saleRepository.createSale(saleRecordData);
      log.debug('📝 步骤4完成: 销售记录创建成功，ID:', saleId);

      // 5. 更新手机状态为已售出 - 包含销售员信息、销售价和入库成本
      log.debug('🔄 步骤5: 开始更新手机状态为已售出');
      await this.saleRepository.updatePhoneStatusToSold(
        phone.id,
        saleId,
        finalCustomerId,
        operator_id,  // 使用operator_id作为销售员ID
        parseFloat(price),  // 🔥 传入销售价
        parseFloat(dbCost)  // 🔥 传入入库成本
      );
      log.debug('🔄 步骤5完成: 手机状态更新完成');

      // 6. 返回销售结果
      log.debug('📊 步骤6: 获取销售记录详情');
      const saleRecord = await this.saleRepository.getSaleRecordById(saleId);
      log.debug('📊 步骤6完成: 销售记录获取完成');

      const duration = Date.now() - startTime;
      log.debug('🎉 销售流程完成！总耗时:', duration, 'ms');

      return {
        success: true,
        message: '销售成功',
        data: {
          sale: saleRecord,
          phone: {
            brand: phone.brand,
            model: phone.model,
            imei: phone.imei,
            cost: dbCost,  // 成本价供前端计算利润显示
            sale_price: parseFloat(price)  // 销售价供前端计算利润显示
          }
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error('❌ 手机销售失败，已耗时:', duration, 'ms, 错误:', error);
      throw error;
    }
  }

  /**
   * 批量手机销售
   * @param {Array} sales - 批量销售数据
   * @returns {Object} 批量销售结果
   */
  async sellPhonesBatch(sales) {
    try {
      const results = [];
      const errors = [];

      for (const saleData of sales) {
        try {
          const result = await this.sellPhone(saleData);
          results.push(result.data);
        } catch (error) {
          errors.push({
            imei: saleData.imei,
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: `批量销售完成，成功 ${results.length} 台，失败 ${errors.length} 台`,
        data: {
          successful: results.length,
          failed: errors.length,
          results,
          errors
        }
      };
    } catch (error) {
      log.error('批量手机销售失败:', error);
      throw error;
    }
  }

  /**
   * 通过IMEI查找手机
   * @param {string} imei - IMEI号
   * @returns {Object|null} 手机信息
   */
  async findPhoneByImei(imei) {
    try {
      const phone = await this.saleRepository.findPhoneByImei(imei);
      if (!phone) {
        throw new Error('未找到对应的可销售手机');
      }
      return phone;
    } catch (error) {
      log.error('查找手机失败:', error);
      throw error;
    }
  }

  /**
   * 通过序列号查找手机
   * @param {string} serialNumber - 序列号
   * @returns {Object|null} 手机信息
   */
  async findPhoneBySerialNumber(serialNumber) {
    try {
      const phone = await this.saleRepository.findPhoneBySerialNumber(serialNumber);
      if (!phone) {
        throw new Error('未找到对应的可销售手机');
      }
      return phone;
    } catch (error) {
      log.error('查找手机失败:', error);
      throw error;
    }
  }

  /**
   * 获取可销售的手机列表
   * @param {Object} filters - 筛选条件
   * @returns {Object} 手机列表和分页信息
   */
  async getAvailablePhones(filters) {
    try {
      const result = await this.saleRepository.getAvailablePhones(filters);
      return {
        success: true,
        message: '获取可销售手机列表成功',
        data: result.records,
        pagination: result.pagination
      };
    } catch (error) {
      log.error('获取可销售手机列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取销售记录
   * @param {Object} filters - 筛选条件
   * @returns {Object} 销售记录和分页信息
   */
  async getSaleRecords(filters) {
    try {
      const result = await this.saleRepository.getSaleRecords(filters);
      return {
        success: true,
        message: '获取销售记录成功',
        data: result.records,
        pagination: result.pagination
      };
    } catch (error) {
      log.error('获取销售记录失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取销售记录详情
   * @param {number} id - 销售记录ID
   * @returns {Object} 销售记录详情
   */
  async getSaleRecordById(id) {
    try {
      const saleRecord = await this.saleRepository.getSaleRecordById(id);
      if (!saleRecord) {
        throw new Error('未找到对应的销售记录');
      }
      return {
        success: true,
        message: '获取销售记录详情成功',
        data: saleRecord
      };
    } catch (error) {
      log.error('获取销售记录详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取销售统计信息
   * @param {Object} filters - 筛选条件
   * @returns {Object} 统计信息
   */
  async getSaleStats(filters) {
    try {
      const stats = await this.saleRepository.getSaleStats(filters);
      return {
        success: true,
        message: '获取销售统计成功',
        data: stats
      };
    } catch (error) {
      log.error('获取销售统计失败:', error);
      throw error;
    }
  }

  /**
   * 验证销售数据
   * @param {Object} saleData - 销售数据
   * @returns {boolean} 验证结果
   */
  validateSaleData(saleData) {
    const {
      phone_id,
      imei,
      customer_id,
      customer_info,
      customer_name,
      price,
      operator_id
    } = saleData;

    const errors = [];

    // 验证手机ID或IMEI (至少需要一个)
    if (!phone_id && (!imei || imei.trim() === '')) {
      errors.push('手机ID或IMEI号不能为空');
    }

    // 验证客户信息 - 支持多种格式
    const hasValidCustomer = customer_id ||
                           (customer_name && customer_name.trim()) ||
                           (customer_info && customer_info.name);

    if (!hasValidCustomer) {
      errors.push('必须选择现有客户或提供新客户姓名');
    }

    // 验证销售价格
    if (!price || parseFloat(price) <= 0) {
      errors.push('销售价格必须大于0');
    }

    // 验证操作员
    if (!operator_id) {
      errors.push('操作员信息不能为空');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    return true;
  }

  /**
   * 根据手机号码查找客户
   * @param {string} phone - 手机号码
   * @returns {Object|null} 客户信息
   */
  async findCustomerByPhone(phone) {
    try {
      const customer = await this.customerRepository.findCustomerByPhone(phone);
      return customer;
    } catch (error) {
      log.error('查找客户失败:', error);
      throw error;
    }
  }

  /**
   * 生成销售发票号
   * @returns {string} 发票号
   */
  generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `INV${year}${month}${day}${random}`;
  }
}

module.exports = SaleService;
