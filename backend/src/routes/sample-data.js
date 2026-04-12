const express = require('express');
const router = express.Router();
const { getDatabase, isConnected } = require('../config/database');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

const ensureDevelopmentEnvironment = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return ApiResponse.error(res, '示例数据接口仅允许在开发环境使用', 403);
  }

  next();
};

router.use(unifiedAuth, requirePermission('permissions:admin'), ensureDevelopmentEnvironment);

// 客户数据
const customers = [
  {
    name: '张明',
    phone: '13800138001',
    email: 'zhangming@example.com',
    address: '北京市朝阳区建国路88号',
    customer_type: 'individual',
    vip_level: 'normal',
    gender: 'male',
    city: '北京',
    province: '北京',
    status: 'active',
    blacklist: 0,
    total_spent: 1280.50,
    purchase_count: 3,
    register_date: '2024-01-15 10:30:00',
    last_purchase_date: '2024-11-20 14:25:00',
    credit_rating: 'good',
    notes: '忠实客户，购买频率较高'
  },
  {
    name: '李娜',
    phone: '13900139002',
    email: 'lina@example.com',
    address: '上海市浦东新区陆家嘴环路1000号',
    customer_type: 'individual',
    vip_level: 'gold',
    gender: 'female',
    city: '上海',
    province: '上海',
    status: 'active',
    blacklist: 0,
    total_spent: 3650.80,
    purchase_count: 8,
    register_date: '2024-02-20 09:15:00',
    last_purchase_date: '2024-11-25 16:30:00',
    credit_rating: 'excellent',
    notes: 'VIP金卡客户，消费能力强'
  },
  {
    name: '王伟',
    phone: '13700137003',
    email: 'wangwei@example.com',
    address: '广东省深圳市南山区科技园南区',
    customer_type: 'individual',
    vip_level: 'silver',
    gender: 'male',
    city: '深圳',
    province: '广东',
    status: 'active',
    blacklist: 0,
    total_spent: 2150.00,
    purchase_count: 5,
    register_date: '2024-03-10 14:20:00',
    last_purchase_date: '2024-11-15 11:45:00',
    credit_rating: 'good',
    notes: '银卡客户，满意度良好'
  },
  {
    name: '陈静',
    phone: '13600136004',
    email: 'chenjing@example.com',
    address: '四川省成都市高新区天府大道',
    customer_type: 'individual',
    vip_level: 'platinum',
    gender: 'female',
    city: '成都',
    province: '四川',
    status: 'active',
    blacklist: 0,
    total_spent: 5200.00,
    purchase_count: 12,
    register_date: '2024-01-05 16:45:00',
    last_purchase_date: '2024-11-22 13:20:00',
    credit_rating: 'excellent',
    notes: '白金VIP客户，最高价值客户'
  },
  {
    name: '刘洋',
    phone: '13500135005',
    email: 'liuyang@company.com',
    address: '浙江省杭州市西湖区文三路',
    customer_type: 'business',
    vip_level: 'normal',
    gender: 'male',
    city: '杭州',
    province: '浙江',
    status: 'active',
    blacklist: 0,
    total_spent: 4800.00,
    purchase_count: 6,
    register_date: '2024-04-12 11:30:00',
    last_purchase_date: '2024-11-18 10:15:00',
    credit_rating: 'good',
    notes: '企业客户，合作稳定'
  }
];

// 消费记录数据
const purchaseRecords = [
  { customer_id: 1, order_no: 'ORD20240115001', purchase_type: 'product', amount: 480.00, items: '手机配件', description: '购买手机壳和充电器', purchase_date: '2024-11-20 14:25:00', payment_method: 'alipay' },
  { customer_id: 1, order_no: 'ORD20240210002', purchase_type: 'service', amount: 800.50, items: '手机维修', description: '屏幕更换服务', purchase_date: '2024-10-15 09:30:00', payment_method: 'wechat' },
  { customer_id: 2, order_no: 'ORD20240220003', purchase_type: 'package', amount: 1850.80, items: '年度套餐', description: 'VIP年度服务套餐', purchase_date: '2024-11-25 16:30:00', payment_method: 'credit_card' },
  { customer_id: 2, order_no: 'ORD20240315004', purchase_type: 'product', amount: 1800.00, items: '智能设备', description: '智能手表购买', purchase_date: '2024-11-10 15:20:00', payment_method: 'alipay' },
  { customer_id: 3, order_no: 'ORD20240310005', purchase_type: 'product', amount: 1350.00, items: '电子产品', description: '蓝牙耳机和音响', purchase_date: '2024-11-15 11:45:00', payment_method: 'wechat' },
  { customer_id: 3, order_no: 'ORD20240420006', purchase_type: 'service', amount: 800.00, items: '技术支持', description: '企业技术支持服务', purchase_date: '2024-10-20 14:10:00', payment_method: 'bank_transfer' },
  { customer_id: 4, order_no: 'ORD20240105007', purchase_type: 'package', amount: 2500.00, items: '白金套餐', description: '白金VIP年度套餐', purchase_date: '2024-11-22 13:20:00', payment_method: 'credit_card' },
  { customer_id: 4, order_no: 'ORD20240510008', purchase_type: 'product', amount: 2700.00, items: '数码产品', description: '平板电脑购买', purchase_date: '2024-11-05 10:30:00', payment_method: 'alipay' },
  { customer_id: 5, order_no: 'ORD20240412009', purchase_type: 'package', amount: 3000.00, items: '企业套餐', description: '企业服务包年套餐', purchase_date: '2024-11-18 10:15:00', payment_method: 'bank_transfer' },
  { customer_id: 5, order_no: 'ORD20240615010', purchase_type: 'product', amount: 1800.00, items: '办公设备', description: '打印机和耗材', purchase_date: '2024-10-15 16:45:00', payment_method: 'wechat' }
];

// 插入示例客户数据
router.post('/customers', async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const db = getDatabase();

    // 检查是否已有数据
    const [existingCustomers] = await db.execute('SELECT COUNT(*) as count FROM customers');
    if (existingCustomers[0].count > 0) {
      return ApiResponse.error(res, '数据库中已存在客户数据，请清空后再插入示例数据', 400);
    }

    // 插入客户数据
    const customerPromises = customers.map(async (customer) => {
      const [result] = await db.execute(`
        INSERT INTO customers (
          name, phone, email, address, customer_type, vip_level, gender, city, province,
          status, blacklist, total_spent, purchase_count, register_date, last_purchase_date,
          credit_rating, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        customer.name, customer.phone, customer.email, customer.address,
        customer.customer_type, customer.vip_level, customer.gender, customer.city,
        customer.province, customer.status, customer.blacklist, customer.total_spent,
        customer.purchase_count, customer.register_date, customer.last_purchase_date,
        customer.credit_rating, customer.notes
      ]);
      return { name: customer.name, id: result.insertId };
    });

    const insertedCustomers = await Promise.all(customerPromises);

    // 插入消费记录数据（如果表存在）
    let insertedPurchases = [];
    try {
      const purchasePromises = purchaseRecords.map(async (record) => {
        const [result] = await db.execute(`
          INSERT INTO purchase_records (
            customer_id, order_no, purchase_type, amount, items, description,
            purchase_date, payment_method, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())
        `, [
          record.customer_id, record.order_no, record.purchase_type, record.amount,
          record.items, record.description, record.purchase_date, record.payment_method
        ]);
        return { order_no: record.order_no, id: result.insertId };
      });
      insertedPurchases = await Promise.all(purchasePromises);
    } catch (_err) {
    }

    ApiResponse.success(res, {
      message: '示例数据插入成功',
      data: {
        customers: insertedCustomers,
        purchaseRecords: insertedPurchases
      }
    });

  } catch (error) {
    log.error('插入示例数据失败', error);
    ApiResponse.error(res, '插入示例数据失败', 500);
  }
});

// 清空所有数据
router.delete('/clear', async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500);
    }

    const db = getDatabase();

    // 尝试清空消费记录表（如果存在）
    try {
      await db.execute('DELETE FROM purchase_records');
    } catch (_err) {
    }

    // 清空客户表
    await db.execute('DELETE FROM customers');

    ApiResponse.success(res, {
      message: '所有数据已清空'
    });
  } catch (error) {
    log.error('清空数据失败', error);
    ApiResponse.error(res, '清空数据失败', 500);
  }
});

module.exports = router;
