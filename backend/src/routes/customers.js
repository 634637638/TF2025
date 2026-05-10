const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission, getUserPermissions } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const bcrypt = require('bcryptjs');
const { generateMemberNumber } = require('../utils/member-number');
const log = require('../utils/log');

const LEGACY_PERMISSION_CANONICAL_MAP = {
  'customers_customersview:create': 'customers:create',
  'inventory_inventoryview:edit': 'inventory:edit',
  'query_queryview:edit': 'query:edit',
  'sales_salesview:create': 'sales:create',
  'sales_salesview:view': 'sales:view',
  'sales_salesview:edit': 'sales:edit',
  'sales_phonesaleview:create': 'sales:create',
  'sales_phonesaleview:view': 'sales:view',
  'sales_phonesaleview:edit': 'sales:edit',
  'sales_editphoneview:edit': 'sales-editphoneview:edit'
};

const CUSTOMER_CREATE_BYPASS_PERMISSIONS = new Set([
  'sales:create',
  'sales:view',
  'sales:edit',
  'sales-editphoneview:edit',
  'query:edit',
  'inventory:edit'
]);

const toCanonicalPermission = (permission = '') => LEGACY_PERMISSION_CANONICAL_MAP[permission] || permission;

const normalizePermissionEntries = (permissions = []) => permissions.map((perm) => {
  if (typeof perm === 'string') {
    return toCanonicalPermission(perm);
  }

  if (perm && perm.module_key && perm.permission_type) {
    return toCanonicalPermission(`${perm.module_key}:${perm.permission_type}`);
  }

  return '';
}).filter(Boolean);

const requireCustomerCreatePermissionForBusinessFlow = async (req, res, next) => {
  try {
    const cachedPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const dbPermissions = cachedPermissions.length > 0 ? [] : await getUserPermissions(req.user.id);
    const normalizedCachedPermissions = normalizePermissionEntries(cachedPermissions);
    const normalizedPermissions = new Set([
      ...normalizedCachedPermissions,
      ...normalizePermissionEntries(dbPermissions)
    ]);

    if (normalizedPermissions.has('customers:create')) {
      return next();
    }

    const hasBusinessBypassPermission = Array.from(normalizedPermissions)
      .some((permission) => CUSTOMER_CREATE_BYPASS_PERMISSIONS.has(permission));

    if (hasBusinessBypassPermission) {
      return next();
    }

    return requirePermission('customers:create')(req, res, next);
  } catch (error) {
    log.error('客户创建权限检查失败:', error);
    return res.status(500).json({
      success: false,
      message: '权限检查失败',
      code: 'PERMISSION_CHECK_FAILED'
    });
  }
};

// 模拟客户数据
const mockCustomers = [
  {
    id: 1,
    customer_no: 'C202400001',
    name: '张三',
    gender: 'male',
    phone: '13800138001',
    email: 'zhangsan@example.com',
    birthday: '1990-05-15',
    id_card: '11010119900515321X',
    address: '北京市朝阳区xxx街道xxx号',
    city: '北京',
    province: '北京',
    postal_code: '100000',
    customer_type: 'individual', // individual, business
    vip_level: 'normal', // normal, silver, gold, platinum
    total_spent: 8999.00,
    purchase_count: 1,
    last_purchase_date: '2024-01-15T14:30:00Z',
    register_date: '2024-01-10T10:00:00Z',
    notes: '老客户，推荐朋友来购买',
    tags: ['iPhone用户', '学生'],
    blacklist: false,
    credit_rating: 'good',
    preferred_contact: 'phone',
    created_by: 1,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z'
  },
  {
    id: 2,
    customer_no: 'C202400002',
    name: '李四',
    gender: 'female',
    phone: '13800138002',
    email: 'lisi@example.com',
    birthday: '1988-08-22',
    id_card: '310101198808224321Y',
    address: '上海市浦东新区xxx路xxx号',
    city: '上海',
    province: '上海',
    postal_code: '200000',
    customer_type: 'individual',
    vip_level: 'silver',
    total_spent: 18999.00,
    purchase_count: 3,
    last_purchase_date: '2024-01-20T16:45:00Z',
    register_date: '2023-12-05T09:30:00Z',
    notes: 'VIP客户，购买频率较高',
    tags: ['Android用户', '上班族'],
    blacklist: false,
    credit_rating: 'excellent',
    preferred_contact: 'wechat',
    created_by: 1,
    created_at: '2023-12-05T09:30:00Z',
    updated_at: '2024-01-20T16:45:00Z'
  },
  {
    id: 3,
    customer_no: 'C202400003',
    name: '王五科技有限公司',
    gender: null,
    phone: '13800138003',
    email: 'contact@wangwu-tech.com',
    birthday: null,
    id_card: null,
    address: '广州市天河区xxx大道xxx号',
    city: '广州',
    province: '广东',
    postal_code: '510000',
    customer_type: 'business',
    vip_level: 'gold',
    total_spent: 58000.00,
    purchase_count: 12,
    last_purchase_date: '2024-01-18T11:20:00Z',
    register_date: '2023-10-15T14:00:00Z',
    notes: '企业客户，批量采购',
    tags: ['企业客户', '批量采购'],
    blacklist: false,
    credit_rating: 'excellent',
    preferred_contact: 'email',
    created_by: 2,
    created_at: '2023-10-15T14:00:00Z',
    updated_at: '2024-01-18T11:20:00Z'
  },
  {
    id: 4,
    customer_no: 'C202400004',
    name: '赵六',
    gender: 'male',
    phone: '13800138004',
    email: null,
    birthday: '1995-12-03',
    id_card: '440101199512038765Z',
    address: '深圳市南山区xxx路xxx号',
    city: '深圳',
    province: '广东',
    postal_code: '518000',
    customer_type: 'individual',
    vip_level: 'normal',
    total_spent: 3299.00,
    purchase_count: 1,
    last_purchase_date: '2024-01-12T10:15:00Z',
    register_date: '2024-01-12T09:45:00Z',
    notes: '维修客户',
    tags: ['维修客户'],
    blacklist: false,
    credit_rating: 'fair',
    preferred_contact: 'phone',
    created_by: 1,
    created_at: '2024-01-12T09:45:00Z',
    updated_at: '2024-01-12T10:15:00Z'
  },
  {
    id: 5,
    customer_no: 'C202400005',
    name: '张三',
    gender: 'male',
    phone: '13800780001',
    email: 'zhangsan@example.com',
    birthday: '1990-05-15',
    id_card: '440101199005154321X',
    address: '北京市朝阳区xxx路xxx号',
    city: '北京',
    province: '北京',
    postal_code: '100000',
    customer_type: 'individual',
    vip_level: 'normal',
    total_spent: 8999.00,
    purchase_count: 2,
    last_purchase_date: '2024-01-25T14:30:00Z',
    register_date: '2023-11-10T10:00:00Z',
    notes: '普通客户',
    tags: ['iPhone用户'],
    blacklist: false,
    credit_rating: 'good',
    preferred_contact: 'phone',
    created_by: 1,
    created_at: '2023-11-10T10:00:00Z',
    updated_at: '2024-01-25T14:30:00Z'
  },
  {
    id: 6,
    customer_no: 'C202400006',
    name: '李四',
    gender: 'female',
    phone: '13912345678',
    email: 'lisi@example.com',
    birthday: '1992-08-20',
    id_card: '310101199208204321Y',
    address: '上海市浦东新区xxx路xxx号',
    city: '上海',
    province: '上海',
    postal_code: '200000',
    customer_type: 'individual',
    vip_level: 'silver',
    total_spent: 12999.00,
    purchase_count: 3,
    last_purchase_date: '2024-01-22T16:45:00Z',
    register_date: '2023-10-15T09:30:00Z',
    notes: '优质客户',
    tags: ['Android用户', '上班族'],
    blacklist: false,
    credit_rating: 'excellent',
    preferred_contact: 'wechat',
    created_by: 2,
    created_at: '2023-10-15T09:30:00Z',
    updated_at: '2024-01-22T16:45:00Z'
  },
  {
    id: 7,
    customer_no: 'C202400007',
    name: '王五',
    gender: 'male',
    phone: '18807903333',
    email: 'wangwu@example.com',
    birthday: '1985-03-10',
    id_card: '440101198503104321X',
    address: '深圳市南山区科技园xxx路xxx号',
    city: '深圳',
    province: '广东',
    postal_code: '518000',
    customer_type: 'individual',
    vip_level: 'normal',
    total_spent: 6999.00,
    purchase_count: 2,
    last_purchase_date: '2024-01-18T11:00:00Z',
    register_date: '2023-12-01T14:20:00Z',
    notes: '测试客户，用于搜索功能',
    tags: ['测试用户'],
    blacklist: false,
    credit_rating: 'good',
    preferred_contact: 'phone',
    created_by: 1,
    created_at: '2023-12-01T14:20:00Z',
    updated_at: '2024-01-18T11:00:00Z'
  }
];

// 模拟客户消费记录
const mockPurchaseHistory = [
  {
    id: 1,
    customer_id: 1,
    order_no: 'SO20240115001',
    purchase_type: 'sale',
    product_name: 'iPhone 15 Pro',
    quantity: 1,
    unit_price: 8999.00,
    total_price: 8999.00,
    purchase_date: '2024-01-15T14:30:00Z',
    store_id: 1,
    store_name: '总店',
    salesperson_id: 1,
    salesperson_name: '张销售'
  },
  {
    id: 2,
    customer_id: 2,
    order_no: 'SO20240120001',
    purchase_type: 'sale',
    product_name: 'Galaxy S24 Ultra',
    quantity: 2,
    unit_price: 9999.00,
    total_price: 19998.00,
    purchase_date: '2024-01-20T16:45:00Z',
    store_id: 2,
    store_name: '分店A',
    salesperson_id: 2,
    salesperson_name: '李销售'
  }
];

// 搜索客户（用于模糊搜索）
router.get('/search', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const CustomerRepository = require('../repositories/customer.repository');
    const customerRepo = new CustomerRepository();

    const { keyword, phone } = req.query;

    // 如果是手机号查询，使用精确匹配
    if (phone) {
      const customer = await customerRepo.findByPhone(phone);
      if (customer) {
        return ApiResponse.success(res, [customer]);
      } else {
        return ApiResponse.success(res, []);
      }
    }

    if (!keyword || keyword.trim().length < 2) {
      return ApiResponse.success(res, []);
    }

    // 使用数据库搜索
    const searchOptions = {
      search: keyword.trim(),
      limit: 10
    };

    const result = await customerRepo.searchCustomers(searchOptions);
    ApiResponse.success(res, result.records);
  } catch (error) {
    log.error('搜索客户失败:', error);
    ApiResponse.serverError(res, '搜索客户失败', error);
  }
});

// 获取客户列表
router.get('/', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    const {
      page = 1,
      limit = 10000,
      customer_type,
      vip_level,
      gender,
      city,
      province,
      blacklist,
      search,
      status
    } = req.query;

    // 构建查询条件
    const conditions = [];
    const params = [];

    if (customer_type) {
      conditions.push('customer_type = ?');
      params.push(customer_type);
    }
    if (vip_level) {
      conditions.push('vip_level = ?');
      params.push(vip_level);
    }
    if (gender) {
      conditions.push('gender = ?');
      params.push(gender);
    }
    if (city) {
      conditions.push('city LIKE ?');
      params.push(`%${city}%`);
    }
    if (province) {
      conditions.push('province LIKE ?');
      params.push(`%${province}%`);
    }
    // 处理状态筛选
    // status === '' 表示显示所有状态的客户（包括已删除的）
    // status === undefined 表示默认只显示有效客户 (status = 1)
    // status === '0' 或 '1' 表示筛选特定状态
    if (status === '') {
      // 空字符串表示显示所有状态，不添加状态条件
    } else if (status !== undefined) {
      conditions.push('status = ?');
      params.push(parseInt(status) === 0 ? 0 : 1);
    } else {
      // 没有传递status参数时，默认只显示有效客户 (status = 1)
      conditions.push('status = ?');
      params.push(1);
    }

    if (search) {
      // 获取搜索字段配置，如果没有指定则使用默认字段
      const searchFieldsParam = req.query.search_fields;
      let searchFields = ['name', 'phone', 'email', 'id_card', 'member_number', 'company_name', 'contact_person', 'address', 'remarks'];

      if (searchFieldsParam) {
        searchFields = searchFieldsParam.split(',').map(f => f.trim());
      }

      // 构建搜索条件 - 支持多字段模糊搜索
      const searchConditions = searchFields.map(field => {
        // 映射前端字段名到数据库字段名
        const dbFieldMap = {
          'name': 'c.name',
          'phone': 'c.phone',
          'email': 'c.email',
          'id_card': 'c.id_card',
          'member_number': 'c.member_number',
          'company_name': 'c.name', // 企业客户用name字段存储
          'contact_person': 'c.name', // 联系人也用name字段
          'address': 'c.address',
          'remark': 'c.remarks',
          'remarks': 'c.remarks'
        };
        return `${dbFieldMap[field] || field} LIKE ?`;
      });

      conditions.push(`(${searchConditions.join(' OR ')})`);
      // 对于所有字段都使用包含匹配
      const searchPattern = `%${search}%`;
      searchFields.forEach(() => params.push(searchPattern));
    }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const finalLimit = parseInt(limit) || 10;
  const finalOffset = parseInt(offset) || 0;

  // 查询数据 - 包含所有必需字段，并统计每个客户的消费信息
  const query = `
    SELECT c.id, c.name, c.phone, c.email, c.customer_type, c.vip_level, c.gender,
           c.city, c.province, c.balance, c.points, c.status, c.remarks, c.created_at, c.updated_at,
           c.member_number, c.apple_id, c.id_card, c.address,
           COALESCE(sales_total.total_amount, 0) as total_spent,
           COALESCE(sales_count.purchase_count, 0) as purchase_count,
           c.last_purchase_date
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, COUNT(*) as purchase_count
      FROM sales
      GROUP BY customer_id
    ) sales_count ON c.id = sales_count.customer_id
    LEFT JOIN (
      SELECT s.customer_id, SUM(p.sale_price) as total_amount
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      GROUP BY s.customer_id
    ) sales_total ON c.id = sales_total.customer_id
    ${whereClause}
    ORDER BY c.id DESC
    LIMIT ${finalLimit} OFFSET ${finalOffset}
  `;

  const [customers] = await db.query(query, params);

  // 查询总数
  const countQuery = `
    SELECT COUNT(*) as total
    FROM customers c
    ${whereClause}
  `;
  const [countResult] = await db.query(countQuery, params);
  const total = countResult[0].total;

  ApiResponse.success(res, {
    customers: customers || [],
    pagination: {
      page: parseInt(page),
      limit: finalLimit,
      total,
      pages: Math.ceil(total / finalLimit)
    }
  });
  } catch (error) {
    log.error('获取客户列表失败:', error);
    ApiResponse.serverError(res, '获取客户列表失败', error);
  }
});

// 获取客户统计信息
router.get('/stats', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    // 查询总客户数
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM customers WHERE status = 1');
    const totalCustomers = totalResult[0].total;

    // 查询活跃客户数（有消费记录的客户）
    const [activeResult] = await db.query(`
      SELECT COUNT(DISTINCT c.id) as active
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1 AND s.id IS NOT NULL
    `);
    const activeCustomers = activeResult[0].active;

    // 查询新客户数（本月新增）
    const [newResult] = await db.query(`
      SELECT COUNT(*) as new_customers
      FROM customers
      WHERE status = 1
        AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `);
    const newCustomers = newResult[0].new_customers;

    // 查询VIP客户数（非普通会员）
    const [premiumResult] = await db.query(`
      SELECT COUNT(*) as premium
      FROM customers
      WHERE status = 1 AND vip_level IN ('silver', 'gold', 'platinum')
    `);
    const premiumCustomers = premiumResult[0].premium;

    const stats = {
      totalCustomers,
      activeCustomers,
      newCustomers,
      premiumCustomers
    };

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取客户统计失败:', error);
    ApiResponse.serverError(res, '获取客户统计失败', error);
  }
});

// 获取客户统计信息（详细版本）
router.get('/stats/overview', unifiedAuth, requirePermission('customers:view'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let customersForStats = [...mockCustomers];

    // 日期筛选
    if (start_date) {
      const startDate = new Date(start_date);
      customersForStats = customersForStats.filter(customer =>
        new Date(customer.register_date) >= startDate
      );
    }

    if (end_date) {
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      customersForStats = customersForStats.filter(customer =>
        new Date(customer.register_date) <= endDate
      );
    }

    const stats = {
      total: customersForStats.length,
      individuals: customersForStats.filter(c => c.customer_type === 'individual').length,
      business: customersForStats.filter(c => c.customer_type === 'business').length,
      byVipLevel: {
        normal: customersForStats.filter(c => c.vip_level === 'normal').length,
        silver: customersForStats.filter(c => c.vip_level === 'silver').length,
        gold: customersForStats.filter(c => c.vip_level === 'gold').length,
        platinum: customersForStats.filter(c => c.vip_level === 'platinum').length
      },
      byGender: {
        male: customersForStats.filter(c => c.gender === 'male').length,
        female: customersForStats.filter(c => c.gender === 'female').length,
        unknown: customersForStats.filter(c => c.gender === null).length
      },
      blacklisted: customersForStats.filter(c => c.blacklist).length,
      totalRevenue: customersForStats.reduce((sum, c) => sum + c.total_spent, 0),
      avgRevenue: customersForStats.length > 0
        ? customersForStats.reduce((sum, c) => sum + c.total_spent, 0) / customersForStats.length
        : 0,
      newCustomers: customersForStats.filter(c => {
        const registerDate = new Date(c.register_date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return registerDate >= thirtyDaysAgo;
      }).length,
      byCity: {},
      byProvince: {}
    };

    // 按城市统计
    customersForStats.forEach(customer => {
      stats.byCity[customer.city] = (stats.byCity[customer.city] || 0) + 1;
      stats.byProvince[customer.province] = (stats.byProvince[customer.province] || 0) + 1;
    });

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取客户统计失败:', error);
    ApiResponse.serverError(res, '获取客户统计失败', error);
  }
});

// 获取单个客户详情
router.get('/:id', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const CustomerRepository = require('../repositories/customer.repository');
    const customerRepo = new CustomerRepository();

    const customer = await customerRepo.findCustomerById(parseInt(id));

    if (!customer) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    ApiResponse.success(res, customer);
  } catch (error) {
    log.error('获取客户详情失败:', error);
    ApiResponse.serverError(res, '获取客户详情失败', error);
  }
});

// 创建客户
router.post('/', unifiedAuth, requireCustomerCreatePermissionForBusinessFlow, async (req, res) => {
  try {
    const CustomerRepository = require('../repositories/customer.repository');
    const customerRepo = new CustomerRepository();

    const {
      name,
      gender,
      phone,
      email,
      birthday,
      id_card,
      address,
      city,
      province,
      customer_type,
      remarks,
      apple_id
    } = req.body;

    // 验证必需字段
    if (!name || !phone) {
      return ApiResponse.badRequest(res, '缺少必需字段：姓名、手机号');
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return ApiResponse.badRequest(res, '手机号格式不正确');
    }

    // 检查手机号是否重复（使用数据库查询）
    const existingCustomer = await customerRepo.findByPhone(phone);
    if (existingCustomer) {
      return ApiResponse.badRequest(res, '手机号已存在');
    }

    // 验证邮箱格式（如果提供）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ApiResponse.badRequest(res, '邮箱格式不正确');
      }
    }

    // 验证 Apple ID 格式（如果提供）
    if (apple_id) {
      // 检查是否包含中文字符
      if (/[\u4e00-\u9fa5]/.test(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 不能包含中文字符');
      }
      // 验证邮箱格式（更严格）
      const appleIdRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!appleIdRegex.test(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 格式不正确，请输入有效的邮箱地址（仅支持英文和数字）');
      }
    }

    // 直接使用SQL创建客户（绕过Repository的字段问题）
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    // 生成会员号
    const memberNumber = await generateMemberNumber();

    const insertQuery = `
      INSERT INTO customers (
        name, gender, phone, email, birthday, id_card,
        address, city, province, customer_type,
        remarks, apple_id, status, member_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
    `;

    const insertValues = [
      name,
      gender || null,
      phone,
      email || null,
      birthday || null,
      id_card || null,
      address || '',
      city || '',
      province || '',
      customer_type || 'individual',
      remarks || '',
      apple_id || null,
      memberNumber
    ];

    const [result] = await db.execute(insertQuery, insertValues);

    // 获取新创建的客户
    const [newCustomers] = await db.execute(
      'SELECT id, name, gender, phone, email, birthday, id_card, address, city, province, customer_type, remarks, apple_id, member_number FROM customers WHERE id = ?',
      [result.insertId]
    );

    const newCustomer = newCustomers[0];

    // 返回完整的客户对象（包含数据库自动生成的ID）
    ApiResponse.created(res, '客户创建成功', newCustomer);
  } catch (error) {
    log.error('创建客户失败:', error);
    ApiResponse.serverError(res, '创建客户失败', error);
  }
});

// 更新客户信息 - FIXED VERSION
router.put('/:id', unifiedAuth, requirePermission('customers:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = parseInt(id, 10);

    // 使用真实数据库操作
    const CustomerRepository = require('../repositories/customer.repository');
    const customerRepo = new CustomerRepository();
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    // 检查客户是否存在
    const existingCustomer = await customerRepo.findCustomerById(customerId);
    if (!existingCustomer) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    const {
      name,
      gender,
      phone,
      email,
      birthday,
      id_card,
      address,
      city,
      province,
      customer_type,
      remarks,
      tags,
      vip_level,
      blacklist,
      wechat,
      qq,
      apple_id,
      member_number,
      balance,
      points,
      password
    } = req.body;

    // 验证手机号格式（如果提供）
    if (phone && phone !== existingCustomer.phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        return ApiResponse.badRequest(res, '手机号格式不正确');
      }

      // 检查手机号是否重复
      const existingPhoneCustomer = await customerRepo.findByPhone(phone);
      if (existingPhoneCustomer && existingPhoneCustomer.id !== customerId) {
        return ApiResponse.badRequest(res, '手机号已存在');
      }
    }

    // 验证邮箱格式（如果提供）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ApiResponse.badRequest(res, '邮箱格式不正确');
      }
    }

    // 验证 Apple ID 格式（如果提供）
    if (apple_id) {
      // 检查是否包含中文字符
      if (/[\u4e00-\u9fa5]/.test(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 不能包含中文字符');
      }
      // 验证邮箱格式（更严格）
      const appleIdRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!appleIdRegex.test(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 格式不正确，请输入有效的邮箱地址（仅支持英文和数字）');
      }
    }

    // 构建更新数据，只包含提供的字段
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (birthday !== undefined) updateData.birthday = birthday;
    if (id_card !== undefined) updateData.id_card = id_card;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (province !== undefined) updateData.province = province;
    if (customer_type !== undefined) updateData.customer_type = customer_type;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.join(',') : tags;
    if (vip_level !== undefined) updateData.vip_level = vip_level;
    if (blacklist !== undefined) updateData.blacklist = Boolean(blacklist);
    if (wechat !== undefined) updateData.wechat = wechat;
    if (qq !== undefined) updateData.qq = qq;
    if (apple_id !== undefined) updateData.apple_id = apple_id;
    if (member_number !== undefined) updateData.member_number = member_number;
    if (balance !== undefined) updateData.balance = parseFloat(balance);
    if (points !== undefined) updateData.points = parseInt(points);

    // 处理密码更新（如果提供）
    if (password !== undefined && password !== null && password !== '') {
      // 验证密码长度
      if (password.length < 6) {
        return ApiResponse.badRequest(res, '密码至少需要6位');
      }
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const [columnRows] = await db.query('SHOW COLUMNS FROM customers');
    const availableColumns = new Set(
      Array.isArray(columnRows)
        ? columnRows.map((column) => column.Field).filter(Boolean)
        : []
    );

    if (availableColumns.has('updated_at')) {
      updateData.updated_at = new Date();
    }

    const sanitizedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([fieldName]) => availableColumns.has(fieldName))
    );

    if (Object.keys(sanitizedUpdateData).length === 0) {
      return ApiResponse.badRequest(res, '没有可更新的字段');
    }

    // 执行更新
    const result = await customerRepo.update(customerId, sanitizedUpdateData);

    if (!result || result.affectedRows === 0) {
      return ApiResponse.notFound(res, '客户不存在或更新失败');
    }

    // 获取更新后的客户信息
    const updatedCustomer = await customerRepo.findCustomerById(customerId);

    ApiResponse.success(res, updatedCustomer, '客户信息更新成功');
  } catch (error) {
    if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
      return ApiResponse.badRequest(res, '手机号已存在');
    }

    log.error('更新客户信息失败:', error);
    ApiResponse.serverError(res, '更新客户信息失败', error);
  }
});

// 删除客户
router.delete('/:id', unifiedAuth, requirePermission('customers:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // 使用真实数据库操作
    const CustomerRepository = require('../repositories/customer.repository');
    const customerRepo = new CustomerRepository();

    const result = await customerRepo.delete(parseInt(id));

    if (!result || result.affectedRows === 0) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    ApiResponse.success(res, { id: parseInt(id), deleted: true }, '客户删除成功');
  } catch (error) {
    log.error('删除客户失败:', error);
    ApiResponse.serverError(res, '删除客户失败', error);
  }
});

// 获取客户消费记录（手机购买记录）
router.get('/:id/purchases', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database');
    const db = getDatabase();

    const { id } = req.params;
    const { page = 1, limit = 20, start_date, end_date } = req.query;

    // 构建查询条件
    const conditions = ['s.customer_id = ?'];
    const params = [parseInt(id)];

    if (start_date) {
      conditions.push('p.salestime >= ?');
      params.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      conditions.push('p.salestime <= ?');
      params.push(`${end_date} 23:59:59`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const finalLimit = parseInt(limit) || 20;
    const finalOffset = parseInt(offset) || 0;

    // 查询客户的手机购买记录
    const query = `
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.memory_id,
        b.name as brand,
        m.name as model,
        c.name as color,
        COALESCE(mem.size, '-') as memory,
        p.purchase_cost,
        p.sale_price,
        p.salestime,
        p.is_new,
        p.status,
        s.id as sale_id,
        s.sale_type,
        s.payment_method,
        s.created_at as sale_created_at,
        u.name as salesperson_name
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN users u ON s.operator_id = u.id
      ${whereClause}
      ORDER BY p.salestime DESC
      LIMIT ${finalLimit} OFFSET ${finalOffset}
    `;

    const [purchases] = await db.query(query, params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total;

    // 格式化返回数据
    const formattedPurchases = purchases.map(p => ({
      id: p.phone_id,
      phone_id: p.phone_id,
      imei: p.imei,
      serial_number: p.serial_number,
      brand: p.brand || '-',
      model: p.model || '-',
      color: p.color || '-',
      memory: p.memory || '-',
      purchase_cost: parseFloat(p.purchase_cost) || 0,
      sale_price: parseFloat(p.sale_price) || 0,
      profit: (parseFloat(p.sale_price) || 0) - (parseFloat(p.purchase_cost) || 0),
      sale_date: p.salestime,
      is_new: p.is_new === 1 ? '全新' : '二手',
      payment_method: p.payment_method || '-',
      salesperson: p.salesperson_name || '-',
      created_at: p.sale_created_at
    }));

    ApiResponse.success(res, {
      purchases: formattedPurchases,
      pagination: {
        page: parseInt(page),
        limit: finalLimit,
        total,
        pages: Math.ceil(total / finalLimit)
      }
    });
  } catch (error) {
    log.error('获取客户消费记录失败:', error);
    ApiResponse.serverError(res, '获取客户消费记录失败', error);
  }
});

// 添加消费记录
router.post('/:id/purchases', unifiedAuth, requirePermission('customers:edit'), (req, res) => {
  try {
    const { id } = req.params;
    const {
      order_no,
      purchase_type,
      product_name,
      quantity,
      unit_price,
      store_id,
      store_name
    } = req.body;

    if (!order_no || !product_name || !quantity || !unit_price) {
      return ApiResponse.badRequest(res, '缺少必需字段');
    }

    const customerIndex = mockCustomers.findIndex(c => c.id === parseInt(id));
    if (customerIndex === -1) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    const totalPrice = parseFloat(quantity) * parseFloat(unit_price);

    // 创建消费记录
    const newPurchase = {
      id: Math.max(...mockPurchaseHistory.map(p => p.id)) + 1,
      customer_id: parseInt(id),
      order_no,
      purchase_type: purchase_type || 'sale',
      product_name,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unit_price),
      total_price: totalPrice,
      purchase_date: new Date().toISOString(),
      store_id: store_id || null,
      store_name: store_name || '',
      salesperson_id: 1, // 应该从token获取
      salesperson_name: '当前销售员'
    };

    mockPurchaseHistory.push(newPurchase);

    // 更新客户统计信息
    const customer = mockCustomers[customerIndex];
    customer.total_spent += totalPrice;
    customer.purchase_count += 1;
    customer.last_purchase_date = newPurchase.purchase_date;
    customer.updated_at = new Date().toISOString();

    // 更新VIP等级
    if (customer.total_spent >= 50000) {
      customer.vip_level = 'platinum';
    } else if (customer.total_spent >= 20000) {
      customer.vip_level = 'gold';
    } else if (customer.total_spent >= 10000) {
      customer.vip_level = 'silver';
    }

    ApiResponse.success(res, {
      purchase: newPurchase,
      customer
    }, '消费记录添加成功');
  } catch (error) {
    log.error('添加消费记录失败:', error);
    ApiResponse.serverError(res, '添加消费记录失败', error);
  }
});

// 更新VIP等级
router.patch('/:id/vip-level', unifiedAuth, requirePermission('customers:manage'), (req, res) => {
  try {
    const { id } = req.params;
    const { vip_level } = req.body;

    if (!vip_level || !['normal', 'silver', 'gold', 'platinum'].includes(vip_level)) {
      return ApiResponse.badRequest(res, '无效的VIP等级');
    }

    const customerIndex = mockCustomers.findIndex(c => c.id === parseInt(id));
    if (customerIndex === -1) {
      return ApiResponse.notFound(res, '客户不存在');
    }

    mockCustomers[customerIndex].vip_level = vip_level;
    mockCustomers[customerIndex].updated_at = new Date().toISOString();

    const levelText = {
      normal: '普通',
      silver: '银卡',
      gold: '金卡',
      platinum: '白金'
    };

    ApiResponse.success(res, mockCustomers[customerIndex], `VIP等级已更新为${levelText[vip_level]}`);
  } catch (error) {
    log.error('更新VIP等级失败:', error);
    ApiResponse.serverError(res, '更新VIP等级失败', error);
  }
});

module.exports = router;
