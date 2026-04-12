const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const convert = require('heic-convert');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { cacheMiddleware, clearCache } = require('../middleware/cache');
const ApiResponse = require('../utils/response');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');
const XLSX = require('xlsx');

// ============================
// 图片上传配置
// ============================

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads', 'subsidy');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 临时文件名：使用时间戳，后续会在处理时重命名
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const filename = `temp_${timestamp}_${randomSuffix}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const isImage = /jpeg|jpg|png|gif|webp|heic|heif/.test(file.mimetype) ||
                   file.mimetype === 'image/heic' ||
                   file.mimetype === 'image/heif';
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';

  if ((isImage || isPdf) && extname) {
    return cb(null, true);
  }
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP, HEIC）或PDF文件'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 初始化国补管理表
async function initSubsidyTable() {
  try {
    await getDatabase().execute(`
      CREATE TABLE IF NOT EXISTS national_subsidies (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sale_id INT NULL COMMENT '关联销售ID',
        phone_id INT NOT NULL COMMENT '手机ID',
        customer_id INT NOT NULL COMMENT '客户ID',
        customer_name VARCHAR(100) NOT NULL COMMENT '客户姓名',
        customer_phone VARCHAR(20) NOT NULL COMMENT '客户电话',
        customer_idcard VARCHAR(50) NULL COMMENT '客户身份证',
        phone_brand VARCHAR(50) NULL COMMENT '手机品牌',
        phone_model VARCHAR(100) NULL COMMENT '手机型号',
        phone_color VARCHAR(50) NULL COMMENT '手机颜色',
        phone_memory VARCHAR(50) NULL COMMENT '手机内存',
        serial_number VARCHAR(100) NULL COMMENT '序列号',
        imei1 VARCHAR(50) NULL COMMENT 'IMEI1',
        imei2 VARCHAR(50) NULL COMMENT 'IMEI2',
        sale_price DECIMAL(10, 2) NOT NULL COMMENT '销售价格',
        sale_time DATETIME NOT NULL COMMENT '销售时间',
        store_id INT NULL COMMENT '店铺ID',
        store_name VARCHAR(100) NULL COMMENT '店铺名称',
        salesman_id INT NULL COMMENT '销售员ID',
        salesman_name VARCHAR(100) NULL COMMENT '销售员姓名',
        subsidy_amount DECIMAL(10, 2) NOT NULL COMMENT '补贴金额',
        subsidy_rate DECIMAL(5, 2) DEFAULT 15.00 COMMENT '补贴比例(%)',
        apply_time DATETIME NULL COMMENT '提交时间',
        apply_status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending' COMMENT '申请状态',
        arrival_time DATETIME NULL COMMENT '到账时间',
        remarks TEXT NULL COMMENT '备注',
        -- 实际办理人信息字段
        has_different_handler BOOLEAN DEFAULT FALSE COMMENT '是否有不同办理人',
        handler_name VARCHAR(100) NULL COMMENT '实际办理人姓名',
        handler_phone VARCHAR(20) NULL COMMENT '实际办理人电话',
        handler_idcard VARCHAR(50) NULL COMMENT '实际办理人身份证',
        INDEX idx_phone_id (phone_id),
        INDEX idx_customer_id (customer_id),
        INDEX idx_imei (imei1),
        INDEX idx_serial (serial_number),
        INDEX idx_apply_status (apply_status),
        INDEX idx_sale_time (sale_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='国补管理表';
    `);

    // 检查并添加新字段(如果表已存在)
    try {
      await getDatabase().execute(`
        ALTER TABLE national_subsidies
        ADD COLUMN IF NOT EXISTS has_different_handler BOOLEAN DEFAULT FALSE COMMENT '是否有不同办理人'
      `);
    } catch (e) {
      // 字段可能已存在,忽略错误
    }

    try {
      await getDatabase().execute(`
        ALTER TABLE national_subsidies
        ADD COLUMN IF NOT EXISTS handler_name VARCHAR(100) NULL COMMENT '实际办理人姓名'
      `);
    } catch (e) {
      // 字段可能已存在,忽略错误
    }

    try {
      await getDatabase().execute(`
        ALTER TABLE national_subsidies
        ADD COLUMN IF NOT EXISTS handler_phone VARCHAR(20) NULL COMMENT '实际办理人电话'
      `);
    } catch (e) {
      // 字段可能已存在,忽略错误
    }

    try {
      await getDatabase().execute(`
        ALTER TABLE national_subsidies
        ADD COLUMN IF NOT EXISTS handler_idcard VARCHAR(50) NULL COMMENT '实际办理人身份证'
      `);
    } catch (e) {
      // 字段可能已存在,忽略错误
    }

    // 添加国补照片字段
    try {
      await getDatabase().execute(`
        ALTER TABLE national_subsidies
        ADD COLUMN IF NOT EXISTS subsidy_photos JSON NULL COMMENT '国补照片URL数组'
      `);
    } catch (e) {
      // 字段可能已存在,忽略错误
    }

  } catch (error) {
    log.error('❌ 国补管理表初始化失败:', error);
  }
}

// 启动时初始化表（已禁用 - 会导致服务器启动时数据库连接阻塞）
// initSubsidyTable();

const buildSubsidyFilters = (query) => {
  const {
    status,
    customer_phone,
    customer_name,
    customer_idcard,
    imei1,
    imei2,
    serial_number,
    start_date,
    end_date,
    store_id,
    brand,
    model,
    color,
    memory,
    min_price,
    max_price,
    min_subsidy,
    max_subsidy,
    has_handler,
    apply_start_date,
    apply_end_date,
    arrival_start_date,
    arrival_end_date
  } = query;

  const whereConditions = ['1=1'];
  const queryParams = [];

  // 状态筛选
  if (status) {
    if (status === 'completed') {
      // 已审批（前端现有语义更接近“已提交申请”）
      whereConditions.push('apply_time IS NOT NULL');
    } else if (status === 'approved') {
      // 已到账
      whereConditions.push('arrival_time IS NOT NULL');
    } else if (status === 'unarrived') {
      // 未到账：已经提交申请，但补贴尚未到账
      whereConditions.push('apply_time IS NOT NULL');
      whereConditions.push('arrival_time IS NULL');
    } else if (status === 'pending') {
      // 未审批（当前业务实际期望：尚未提交申请）
      whereConditions.push('apply_time IS NULL');
    } else {
      whereConditions.push('apply_status = ?');
      queryParams.push(status);
    }
  }

  // 搜索关键词处理 - 使用 OR 连接所有搜索字段
  const searchFields = [];
  const searchParams = [];

  // 判断是否是搜索框搜索（如果有多个搜索参数同时存在，说明是来自搜索框）
  const hasKeywordFields = !!(customer_phone || customer_name || customer_idcard || imei1 || imei2 || serial_number);
  const hasFilterFields = !!(brand || model || color || memory);
  const isSearchBoxSearch = hasKeywordFields && hasFilterFields;

  if (customer_phone) {
    searchFields.push('customer_phone LIKE ?');
    searchParams.push(`%${customer_phone}%`);
  }
  if (customer_name) {
    searchFields.push('customer_name LIKE ?');
    searchParams.push(`%${customer_name}%`);
  }
  if (customer_idcard) {
    searchFields.push('customer_idcard LIKE ?');
    searchParams.push(`%${customer_idcard}%`);
  }
  if (imei1) {
    searchFields.push('imei1 LIKE ?');
    searchParams.push(`%${imei1}%`);
  }
  if (imei2) {
    searchFields.push('imei2 LIKE ?');
    searchParams.push(`%${imei2}%`);
  }
  if (serial_number) {
    searchFields.push('serial_number LIKE ?');
    searchParams.push(`%${serial_number}%`);
  }

  // 如果是搜索框搜索，brand/model/color/memory 也加入 OR 搜索
  if (isSearchBoxSearch) {
    if (brand) {
      searchFields.push('phone_brand LIKE ?');
      searchParams.push(`%${brand}%`);
    }
    if (model) {
      searchFields.push('phone_model LIKE ?');
      searchParams.push(`%${model}%`);
    }
    if (color) {
      searchFields.push('phone_color LIKE ?');
      searchParams.push(`%${color}%`);
    }
    if (memory) {
      searchFields.push('phone_memory LIKE ?');
      searchParams.push(`%${memory}%`);
    }
  }

  // 如果有搜索字段，用 OR 连接
  if (searchFields.length > 0) {
    whereConditions.push(`(${searchFields.join(' OR ')})`);
    queryParams.push(...searchParams);
  }

  // 单独的筛选条件（这些用 AND）- 仅当不是搜索框搜索时才使用
  if (!isSearchBoxSearch) {
    // 品牌、型号、颜色、内存保持精确筛选（下拉框使用）
    if (brand) {
      whereConditions.push('phone_brand LIKE ?');
      queryParams.push(`%${brand}%`);
    }

    if (model) {
      whereConditions.push('phone_model LIKE ?');
      queryParams.push(`%${model}%`);
    }

    if (color) {
      whereConditions.push('phone_color LIKE ?');
      queryParams.push(`%${color}%`);
    }

    if (memory) {
      whereConditions.push('phone_memory LIKE ?');
      queryParams.push(`%${memory}%`);
    }
  }

  // 销售日期范围筛选
  if (start_date) {
    whereConditions.push('DATE(sale_time) >= ?');
    queryParams.push(start_date);
  }

  if (end_date) {
    whereConditions.push('DATE(sale_time) <= ?');
    queryParams.push(end_date);
  }

  // 店铺筛选
  if (store_id) {
    whereConditions.push('store_id = ?');
    queryParams.push(store_id);
  }

  // 销售价格范围筛选
  if (min_price) {
    whereConditions.push('sale_price >= ?');
    queryParams.push(parseFloat(min_price));
  }

  if (max_price) {
    whereConditions.push('sale_price <= ?');
    queryParams.push(parseFloat(max_price));
  }

  // 补贴金额范围筛选
  if (min_subsidy) {
    whereConditions.push('subsidy_amount >= ?');
    queryParams.push(parseFloat(min_subsidy));
  }

  if (max_subsidy) {
    whereConditions.push('subsidy_amount <= ?');
    queryParams.push(parseFloat(max_subsidy));
  }

  // 是否有实际办理人筛选
  if (has_handler === '1') {
    whereConditions.push('has_different_handler = 1');
  } else if (has_handler === '0') {
    whereConditions.push('has_different_handler = 0');
  }

  // 提交时间范围筛选
  if (apply_start_date) {
    whereConditions.push('DATE(apply_time) >= ?');
    queryParams.push(apply_start_date);
  }

  if (apply_end_date) {
    whereConditions.push('DATE(apply_time) <= ?');
    queryParams.push(apply_end_date);
  }

  // 到账时间范围筛选
  if (arrival_start_date) {
    whereConditions.push('DATE(arrival_time) >= ?');
    queryParams.push(arrival_start_date);
  }

  if (arrival_end_date) {
    whereConditions.push('DATE(arrival_time) <= ?');
    queryParams.push(arrival_end_date);
  }

  return { whereConditions, queryParams };
};

const getSubsidyStatusLabel = (item) => {
  if (item.arrival_time) {
    return '已到账';
  }

  if (item.apply_time) {
    return '已提交';
  }

  return '未提交';
};

const buildSubsidyExportFile = (items = []) => {
  const rows = items.map(item => {
    let subsidyPhotos = [];

    if (item.subsidy_photos) {
      try {
        subsidyPhotos = typeof item.subsidy_photos === 'string'
          ? JSON.parse(item.subsidy_photos)
          : item.subsidy_photos;
      } catch (error) {
        subsidyPhotos = [];
      }
    }

    return {
      客户姓名: item.customer_name || '',
      客户电话: item.customer_phone || '',
      客户身份证: item.customer_idcard || '',
      品牌: item.phone_brand || '',
      型号: item.phone_model || '',
      颜色: item.phone_color || '',
      内存: item.phone_memory || '',
      序列号: item.serial_number || '',
      IMEI1: item.imei1 || '',
      IMEI2: item.imei2 || '',
      销售价: parseFloat(item.sale_price) || 0,
      销售时间: item.sale_time || '',
      店铺: item.store_name || '',
      销售员: item.salesman_name || '',
      补贴金额: parseFloat(item.subsidy_amount) || 0,
      补贴比例: item.subsidy_rate !== null && item.subsidy_rate !== undefined ? `${parseFloat(item.subsidy_rate) || 0}%` : '',
      当前状态: getSubsidyStatusLabel(item),
      申请状态: item.apply_status || '',
      提交时间: item.apply_time || '',
      到账时间: item.arrival_time || '',
      代办理: item.has_different_handler ? '是' : '否',
      办理人姓名: item.handler_name || '',
      办理人电话: item.handler_phone || '',
      办理人身份证: item.handler_idcard || '',
      照片数量: Array.isArray(subsidyPhotos) ? subsidyPhotos.length : 0,
      备注: item.remarks || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  const beijingDate = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-');

  XLSX.utils.book_append_sheet(workbook, worksheet, '国补管理');

  return {
    filename: `国补管理_${beijingDate}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    total: rows.length
  };
};

// 第一步：通过IMEI或序列号搜索设备列表
router.get('/search-phones/:identifier', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 10000 }), async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier || identifier.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '请输入IMEI或序列号'
      });
    }

    const trimmedIdentifier = identifier.trim();
    const searchPattern = `%${trimmedIdentifier}%`;

    // 搜索phones表中的设备（支持模糊搜索IMEI1和序列号），同时获取客户信息
    const [phones] = await getDatabase().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.status,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        p.sale_price,
        p.salestime as sale_time,
        st.name as store_name,
        c.name as customer_name,
        c.phone as customer_phone
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN sales s ON p.id = s.phone_id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE (p.imei LIKE ? OR p.serial_number LIKE ?)
      ORDER BY p.salestime DESC
      LIMIT 50
    `, [searchPattern, searchPattern]);

    if (phones.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到匹配的设备'
      });
    }

    // 获取每个设备的国补申请状态
    const phoneIds = phones.map(p => p.phone_id);
    const [subsidyRecords] = phoneIds.length > 0 ? await getDatabase().execute(`
      SELECT phone_id, apply_status, subsidy_amount
      FROM national_subsidies
      WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
    `, phoneIds) : [];

    // 创建国补记录映射
    const subsidyMap = new Map();
    subsidyRecords.forEach(s => {
      subsidyMap.set(s.phone_id, {
        has_subsidy: true,
        status: s.apply_status,
        amount: s.subsidy_amount
      });
    });

    // 格式化返回结果
    const deviceList = phones.map(p => {
      const subsidyInfo = subsidyMap.get(p.phone_id);
      return {
        phone_id: p.phone_id,
        imei: p.imei,
        serial_number: p.serial_number,
        is_new: p.is_new,
        status: p.status,
        brand: p.brand || '',
        model: p.model || '',
        color: p.color || '',
        memory: p.memory || '',
        sale_price: parseFloat(p.sale_price) || 0,
        sale_time: p.sale_time,
        store_name: p.store_name || '',
        customer_name: p.customer_name || '',
        customer_phone: p.customer_phone || '',
        // 国补记录状态
        has_subsidy: !!subsidyInfo,
        subsidy_status: subsidyInfo?.status || null,
        subsidy_amount: subsidyInfo?.amount || 0,
        // 判断是否符合国补条件
        can_apply_subsidy: p.status === 'sold' && p.is_new === 1 && p.sale_price <= 6000 && !subsidyInfo,
        reason: subsidyInfo ? `已记录国补资料 (¥${subsidyInfo.amount})` :
                p.status !== 'sold' ? '设备未销售' :
                p.is_new !== 1 ? '仅全新机可申请' :
                p.sale_price > 6000 ? '售价超过6000元' : '符合条件'
      };
    });

    res.json({
      success: true,
      message: `找到 ${deviceList.length} 个匹配设备`,
      data: deviceList
    });

  } catch (error) {
    log.error('❌ 搜索设备失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    });
  }
});

// 第二步：获取选定设备的完整销售信息（包括客户信息）
router.get('/phone-detail/:phoneId', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 10000 }), async (req, res) => {
  try {
    const { phoneId } = req.params;
    if (!phoneId || isNaN(phoneId)) {
      return res.status(400).json({
        success: false,
        message: '设备ID无效'
      });
    }

    // 获取设备详细信息
    // 🔥 使用 DATE_FORMAT 直接返回格式化的日期字符串，避免时区转换问题
    // 🔥 优先从 phones 表的 salestime 获取销售时间，然后格式化
    const [phones] = await getDatabase().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.sale_price,
        DATE_FORMAT(COALESCE(p.salestime, latest_sale.sale_date), '%Y-%m-%d') as sale_time,
        p.sale_operator_id,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        latest_sale.store_id as store_id,
        sale_st.name as store_name,
        u.name as salesman_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN users u ON p.sale_operator_id = u.id
      LEFT JOIN (
        SELECT
          s.*,
          ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
        FROM sales s
      ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
      LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id
      WHERE p.id = ?
      LIMIT 1
    `, [phoneId]);

    if (phones.length === 0) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    const phone = phones[0];

    // 查找客户信息（从sales表中查找）
    const [sales] = await getDatabase().execute(`
      SELECT
        s.id as sale_id,
        s.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.id_card as customer_idcard
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.phone_id = ?
      LIMIT 1
    `, [phoneId]);

    // 如果没有销售记录，返回提示信息
    if (sales.length === 0) {
      return res.json({
        success: true,
        message: '设备未销售，无法申请国补',
        data: {
          phone_id: phone.phone_id,
          phone_brand: phone.brand,
          phone_model: phone.model,
          phone_color: phone.color,
          phone_memory: phone.memory,
          serial_number: phone.serial_number,
          imei1: phone.imei,
          imei2: null,
          sale_price: parseFloat(phone.sale_price) || 0,
          eligible: false,
          eligible_reason: '该设备未找到销售记录，请先完成销售后再申请国补',
          requires_sale: true
        }
      });
    }

    const sale = sales[0];

    // 检查是否已经存在国补记录
    const [existingSubsidies] = await getDatabase().execute(`
      SELECT id, apply_status, subsidy_amount
      FROM national_subsidies
      WHERE phone_id = ?
    `, [phoneId]);

    // 计算国补金额（售价6000以内可参加，优惠15%，最高500）
    let subsidyAmount = 0;
    let subsidyRate = 15;
    const maxSubsidy = 500;
    let eligible = false;
    let eligible_reason = '';

    if (phone.sale_price && phone.sale_price <= 6000) {
      const calculated = parseFloat(phone.sale_price) * (subsidyRate / 100);
      subsidyAmount = Math.min(calculated, maxSubsidy);
      eligible = true;

      if (calculated > maxSubsidy) {
        eligible_reason = `补贴金额 ¥${calculated.toFixed(2)} 已达上限 ¥${maxSubsidy}`;
      } else {
        eligible_reason = `符合国补条件（售价 ${parseFloat(phone.sale_price).toFixed(2)} × 15% = ¥${subsidyAmount.toFixed(2)}）`;
      }
    } else {
      eligible = false;
      eligible_reason = `销售价格 ¥${parseFloat(phone.sale_price || 0).toFixed(2)} 超过6000元，不符合国补条件`;
    }

    res.json({
      success: true,
      message: '获取详情成功',
      data: {
        phone_id: phone.phone_id,
        sale_id: sale.sale_id,
        customer_id: sale.customer_id,
        customer_name: sale.customer_name || '',
        customer_phone: sale.customer_phone || '',
        customer_idcard: sale.customer_idcard || '',
        phone_brand: phone.brand,
        phone_model: phone.model,
        phone_color: phone.color,
        phone_memory: phone.memory,
        serial_number: phone.serial_number,
        imei1: phone.imei,
        imei2: null,
        sale_price: parseFloat(phone.sale_price) || 0,
        sale_time: phone.sale_time,
        store_id: phone.store_id,
        store_name: phone.store_name,
        salesman_id: phone.sale_operator_id,
        salesman_name: phone.salesman_name,
        subsidy_amount: subsidyAmount,
        subsidy_rate: subsidyRate,
        eligible: subsidyAmount > 0,
        eligible_reason: subsidyAmount > 0 ? eligible_reason : eligible_reason,
        existing_subsidy: existingSubsidies.length > 0 ? existingSubsidies[0] : null
      }
    });

  } catch (error) {
    log.error('❌ 获取设备详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取详情失败',
      error: error.message
    });
  }
});

// 创建国补申请
router.post('/apply', unifiedAuth, requirePermission('subsidy:create'), async (req, res) => {
  try {
    const {
      phone_id,
      sale_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_idcard,
      phone_brand,
      phone_model,
      phone_color,
      phone_memory,
      serial_number,
      imei1,
      imei2,
      sale_price,
      sale_time,
      store_id,
      store_name,
      salesman_id,
      salesman_name,
      subsidy_amount,
      subsidy_rate,
      remarks,
      subsidy_photos,
      hasDifferentHandler,
      handlerInfo
    } = req.body;

    // 验证必填字段（IMEI2改为必填）
    if (!phone_id || !customer_id || !imei1 || !imei2 || !sale_price) {
      return res.status(400).json({
        success: false,
        message: 'IMEI2为必填项，请完整填写'
      });
    }

    // 检查是否已存在国补记录
    const [existing] = await getDatabase().execute(
      'SELECT id, apply_status FROM national_subsidies WHERE phone_id = ?',
      [phone_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该设备已存在国补申请记录',
        data: {
          existing_id: existing[0].id,
          apply_status: existing[0].apply_status
        }
      });
    }

    // 允许所有设备创建记录，但超过6000元的补贴金额为0
    const finalSubsidyAmount = subsidy_amount || 0;

    // 如果提供了新的身份证号，更新到 customers 表（完善客户信息）
    if (customer_idcard && customer_idcard.trim() !== '') {
      await getDatabase().execute(`
        UPDATE customers
        SET id_card = ?
        WHERE id = ?
      `, [customer_idcard.trim(), customer_id]);
    }

    // 处理 sale_time：直接提取日期部分，避免时区转换问题
    let processedSaleTime = null;
    if (sale_time) {
      // 数据库返回的格式通常是 "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DDTHH:mm:ss.xxxZ"
      // 我们只需要日期部分，直接提取即可，不使用 new Date() 避免时区问题
      const dateMatch = String(sale_time).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        processedSaleTime = `${year}-${month}-${day} 00:00:00`;
      } else {
        // 如果无法直接提取，保留原值（一般不会走到这里）
        log.warn('⚠️ 无法直接提取日期，保留原值:', sale_time);
        processedSaleTime = sale_time;
      }
    }

    // 创建国补记录（同时存储 customer_idcard 和实际办理人信息到 national_subsidies 表）
    const [result] = await getDatabase().execute(`
      INSERT INTO national_subsidies (
        sale_id,
        phone_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        sale_time,
        store_id,
        store_name,
        salesman_id,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        apply_time,
        apply_status,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?, ?, ?)
    `, [
      sale_id,
      phone_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_idcard || null,
      phone_brand,
      phone_model,
      phone_color,
      phone_memory,
      serial_number,
      imei1,
      imei2 || null,
      sale_price,
      processedSaleTime,
      store_id || null,
      store_name || null,
      salesman_id || null,
      salesman_name || null,
      finalSubsidyAmount,
      subsidy_rate || 15,
      remarks || null,
      JSON.stringify(subsidy_photos || []),
      hasDifferentHandler || false,
      (hasDifferentHandler && handlerInfo) ? handlerInfo.handlerName : null,
      (hasDifferentHandler && handlerInfo) ? handlerInfo.handlerPhone : null,
      (hasDifferentHandler && handlerInfo) ? handlerInfo.handlerIdcard : null
    ]);

    clearCache('/subsidy');
    res.json({
      success: true,
      message: '国补记录创建成功',
      data: {
        id: result.insertId,
        apply_time: new Date(),
        apply_status: 'completed'
      }
    });

  } catch (error) {
    log.error('❌ 创建国补申请失败:', error);
    res.status(500).json({
      success: false,
      message: '创建国补申请失败',
      error: error.message
    });
  }
});

// 获取国补列表（带缓存，仅缓存第一页）
router.get('/', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 60000 }), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort_by = 'sale_time',
      sort_order = 'desc'
    } = req.query;

    const { whereConditions, queryParams } = buildSubsidyFilters(req.query);

    // 验证并构建排序字段
    const validSortFields = ['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'sale_time';

    // 验证排序方向（只能是 asc 或 desc）
    const sortDirection = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const orderClause = `ORDER BY ${sortField} ${sortDirection}`;

    const limitNum = Math.min(parseInt(limit) || 20, 500); // 最大500条
    const offsetNum = (parseInt(page) - 1) * limitNum;

    // 查询列表
    const query = `
      SELECT
        id,
        sale_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id,
        store_name,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
      ${orderClause}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
    `;

    const [subsidies] = await getDatabase().execute(query, queryParams);
    const [countResult] = await getDatabase().execute(countQuery, queryParams);

    // 格式化数据
    const formattedSubsidies = subsidies.map(sub => {
      // 处理 BOOLEAN 字段（MySQL 返回的是数字 0/1）
      const hasHandler = sub.has_different_handler === 1 || sub.has_different_handler === true;

      // 解析 JSON 字段
      let subsidyPhotos = [];
      if (sub.subsidy_photos) {
        try {
          subsidyPhotos = typeof sub.subsidy_photos === 'string'
            ? JSON.parse(sub.subsidy_photos)
            : sub.subsidy_photos;
        } catch (e) {
          log.error('解析 subsidy_photos 失败:', e);
          subsidyPhotos = [];
        }
      }

      return {
        ...sub,
        sale_price: parseFloat(sub.sale_price),
        subsidy_amount: parseFloat(sub.subsidy_amount),
        subsidy_rate: parseFloat(sub.subsidy_rate),
        subsidy_photos: subsidyPhotos,
        // 添加实际办理人信息对象
        hasDifferentHandler: hasHandler,
        handlerInfo: hasHandler ? {
          handlerName: sub.handler_name,
          handlerPhone: sub.handler_phone,
          handlerIdcard: sub.handler_idcard
        } : null
      };
    });

    res.json({
      success: true,
      message: '获取国补列表成功',
      data: formattedSubsidies,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });

  } catch (error) {
    log.error('❌ 获取国补列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取国补列表失败',
      error: error.message
    });
  }
});

// 获取筛选选项（品牌、型号、颜色、内存、店铺）
// 注意：此路由必须在 /:id 之前，否则 filter-options 会被当作 id 参数处理
router.get('/filter-options', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 300000 }), async (req, res) => {
  try {
    // 获取品牌列表
    const [brands] = await getDatabase().execute(`
      SELECT DISTINCT phone_brand
      FROM national_subsidies
      WHERE phone_brand IS NOT NULL
      ORDER BY phone_brand
    `);

    // 获取型号列表
    const [models] = await getDatabase().execute(`
      SELECT DISTINCT phone_model
      FROM national_subsidies
      WHERE phone_model IS NOT NULL
      ORDER BY phone_model
    `);

    // 获取颜色列表
    const [colors] = await getDatabase().execute(`
      SELECT DISTINCT phone_color
      FROM national_subsidies
      WHERE phone_color IS NOT NULL
      ORDER BY phone_color
    `);

    // 获取内存列表
    const [memories] = await getDatabase().execute(`
      SELECT DISTINCT phone_memory
      FROM national_subsidies
      WHERE phone_memory IS NOT NULL
      ORDER BY phone_memory
    `);

    // 获取店铺列表
    const [stores] = await getDatabase().execute(`
      SELECT DISTINCT store_id, store_name
      FROM national_subsidies
      WHERE store_id IS NOT NULL AND store_name IS NOT NULL
      ORDER BY store_name
    `);

    res.json({
      success: true,
      message: '获取筛选选项成功',
      data: {
        brands: brands.map(b => b.phone_brand),
        models: models.map(m => m.phone_model),
        colors: colors.map(c => c.phone_color),
        memories: memories.map(m => m.phone_memory),
        stores: stores.map(s => ({ id: s.store_id, name: s.store_name }))
      }
    });

  } catch (error) {
    log.error('❌ 获取筛选选项失败:', error);
    res.status(500).json({
      success: false,
      message: '获取筛选选项失败',
      error: error.message
    });
  }
});

router.get('/export/excel', unifiedAuth, requirePermission('subsidy:export'), async (req, res) => {
  try {
    const {
      sort_by = 'sale_time',
      sort_order = 'desc'
    } = req.query;

    const { whereConditions, queryParams } = buildSubsidyFilters(req.query);
    const validSortFields = ['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'sale_time';
    const sortDirection = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${sortField} ${sortDirection}`;

    const query = `
      SELECT
        id,
        sale_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id,
        store_name,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
      ${orderClause}
    `;

    const [subsidies] = await getDatabase().execute(query, queryParams);
    const exportFile = buildSubsidyExportFile(subsidies.map(item => ({
      ...item,
      has_different_handler: item.has_different_handler === 1 || item.has_different_handler === true
    })));

    res.setHeader('Content-Type', exportFile.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`
    );
    res.setHeader('X-Export-Total', String(exportFile.total));

    return res.send(exportFile.buffer);
  } catch (error) {
    log.error('❌ 导出国补数据失败:', error);
    res.status(500).json({
      success: false,
      message: '导出国补数据失败',
      error: error.message
    });
  }
});

// 获取国补详情
router.get('/:id', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 10000 }), async (req, res) => {
  try {
    const { id } = req.params;

    // 🔥 使用 DATE_FORMAT 直接返回格式化的日期字符串，避免时区转换问题
    const [subsidies] = await getDatabase().execute(`
      SELECT
        id,
        customer_id,
        phone_id,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        imei1,
        imei2,
        serial_number,
        sale_price,
        subsidy_amount,
        subsidy_rate,
        store_id,
        store_name,
        apply_time,
        arrival_time,
        remarks,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time_formatted
      FROM national_subsidies
      WHERE id = ?
    `, [id]);

    if (subsidies.length === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    const subsidy = subsidies[0];
    subsidy.sale_price = parseFloat(subsidy.sale_price);
    subsidy.subsidy_amount = parseFloat(subsidy.subsidy_amount);
    subsidy.subsidy_rate = parseFloat(subsidy.subsidy_rate);
    // 使用格式化后的时间作为 sale_time
    subsidy.sale_time = subsidy.sale_time_formatted;
    delete subsidy.sale_time_formatted;

    res.json({
      success: true,
      message: '获取国补详情成功',
      data: subsidy
    });

  } catch (error) {
    log.error('❌ 获取国补详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取国补详情失败',
      error: error.message
    });
  }
});

// 更新国补信息
router.put('/:id', unifiedAuth, requirePermission('subsidy:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      customer_phone,
      sale_time,
      customer_idcard,
      serial_number,
      imei1,
      imei2,
      store_id,
      remarks,
      has_audit,
      has_arrival,
      apply_time,
      arrival_time,
      hasDifferentHandler,
      handlerName,
      handlerPhone,
      handlerIdcard
    } = req.body;

    // 获取当前记录信息
    const [existing] = await getDatabase().execute(
      'SELECT customer_id, imei2 FROM national_subsidies WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    // 如果更新了身份证号，同时更新 customers 表（包括清空的情况）
    if (customer_idcard !== undefined) {
      await getDatabase().execute(`
        UPDATE customers
        SET id_card = ?
        WHERE id = ?
      `, [customer_idcard ? customer_idcard.trim() : null, existing[0].customer_id]);
    }

    // 如果更新了姓名或手机号，同时更新 customers 表
    if (customer_name || customer_phone) {
      const customerUpdates = [];
      const customerParams = [];

      if (customer_name) {
        customerUpdates.push('name = ?');
        customerParams.push(customer_name);
      }

      if (customer_phone) {
        customerUpdates.push('phone = ?');
        customerParams.push(customer_phone);
      }

      if (customerUpdates.length > 0) {
        customerParams.push(existing[0].customer_id);
        await getDatabase().execute(`
          UPDATE customers
          SET ${customerUpdates.join(', ')}
          WHERE id = ?
        `, customerParams);
      }
    }

    // 构建更新SQL
    let updateFields = [];
    let updateValues = [];

    if (customer_name !== undefined) {
      updateFields.push('customer_name = COALESCE(?, customer_name)');
      updateValues.push(customer_name || null);
    }

    if (customer_phone !== undefined) {
      updateFields.push('customer_phone = COALESCE(?, customer_phone)');
      updateValues.push(customer_phone || null);
    }

    if (sale_time !== undefined) {
      if (sale_time === '') {
        updateFields.push('sale_time = NULL');
      } else {
        // 🔥 直接使用前10个字符（日期部分），不拼接时间，避免时区问题
        // sale_time格式为 YYYY-MM-DD，直接存储日期部分
        // MySQL会自动补充为 YYYY-MM-DD 00:00:00
        updateFields.push('sale_time = ?');
        updateValues.push(sale_time);
      }
    }

    if (customer_idcard !== undefined) {
      updateFields.push('customer_idcard = ?');
      updateValues.push(customer_idcard || null);
    }

    if (imei2 !== undefined) {
      updateFields.push('imei2 = COALESCE(?, imei2)');
      updateValues.push(imei2 || null);
    }

    if (serial_number !== undefined) {
      updateFields.push('serial_number = ?');
      updateValues.push(serial_number || '');
    }

    if (imei1 !== undefined) {
      updateFields.push('imei1 = ?');
      updateValues.push(imei1 || '');
    }

    // 处理店铺更新
    if (store_id !== undefined) {
      if (store_id === null || store_id === '') {
        // 如果清空店铺
        updateFields.push('store_id = NULL');
        updateFields.push('store_name = NULL');
      } else {
        // 根据store_id查询店铺名称
        const [stores] = await getDatabase().execute(
          'SELECT id, name FROM stores WHERE id = ?',
          [store_id]
        );

        if (stores.length > 0) {
          updateFields.push('store_id = ?');
          updateValues.push(store_id);
          updateFields.push('store_name = ?');
          updateValues.push(stores[0].name);
        } else {
          return res.status(400).json({
            success: false,
            message: '选择的店铺不存在'
          });
        }
      }
    }

    if (remarks !== undefined) {
      updateFields.push('remarks = COALESCE(?, remarks)');
      updateValues.push(remarks || null);
    }

    // 处理审批时间 - 只存储年月日
    if (apply_time !== undefined) {
      if (apply_time === '' || apply_time === null || typeof apply_time !== 'string') {
        // 空字符串表示清空时间
        updateFields.push('apply_time = NULL');
      } else {
        // apply_time格式为 YYYY-MM-DDTHH:mm，需要转换为 YYYY-MM-DD 00:00:00
        const datePart = apply_time.split('T')[0]; // 获取 YYYY-MM-DD 部分
        updateFields.push('apply_time = ?');
        updateValues.push(datePart + ' 00:00:00');
      }
    } else if (has_audit !== undefined) {
      // 使用NOW()时，转换为当天北京时间的日期
      updateFields.push('apply_time = DATE_FORMAT(NOW(), "%Y-%m-%d 00:00:00")');
    }

    // 处理到账时间 - 只存储年月日
    if (arrival_time !== undefined) {
      if (arrival_time === '' || arrival_time === null || typeof arrival_time !== 'string') {
        // 空字符串表示清空时间
        updateFields.push('arrival_time = NULL');
      } else {
        // arrival_time格式为 YYYY-MM-DDTHH:mm，需要转换为 YYYY-MM-DD 00:00:00
        const datePart = arrival_time.split('T')[0]; // 获取 YYYY-MM-DD 部分
        updateFields.push('arrival_time = ?');
        updateValues.push(datePart + ' 00:00:00');
      }
    } else if (has_arrival !== undefined) {
      // 使用NOW()时，转换为当天北京时间的日期
      updateFields.push('arrival_time = DATE_FORMAT(NOW(), "%Y-%m-%d 00:00:00")');
    }

    // 处理备注
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(remarks || '');
    }

    // 处理国补照片
    if (req.body.subsidy_photos !== undefined) {
      updateFields.push('subsidy_photos = ?');
      // 将数组转换为 JSON 字符串存储
      updateValues.push(JSON.stringify(req.body.subsidy_photos || []));
    }

    // 处理删除的照片文件
    if (req.body.deleted_photos && Array.isArray(req.body.deleted_photos) && req.body.deleted_photos.length > 0) {
      const fs = require('fs').promises;
      const path = require('path');

      for (const photoUrl of req.body.deleted_photos) {
        try {
          // 从URL中提取文件名
          const urlParts = photoUrl.split('/');
          const filename = urlParts[urlParts.length - 1];

          // 构建文件路径
          const uploadDir = process.env.NODE_ENV === 'production'
            ? process.env.UPLOAD_PATH || '/www/wwwroot/v6.cn9527.cn/backend/uploads'
            : path.join(process.cwd(), 'uploads');
          const filePath = path.join(uploadDir, 'subsidy', filename);

          // 删除文件
          await fs.unlink(filePath);
        } catch (error) {
          log.error(`⚠️ 删除文件失败: ${photoUrl}`, error.message);
          // 继续处理其他文件，不中断流程
        }
      }
    }

    // 处理实际办理人信息
    if (hasDifferentHandler !== undefined) {
      updateFields.push('has_different_handler = ?');
      updateValues.push(hasDifferentHandler ? 1 : 0);

      // 如果有实际办理人，更新办理人信息
      if (hasDifferentHandler) {
        updateFields.push('handler_name = ?');
        updateValues.push(handlerName || null);

        updateFields.push('handler_phone = ?');
        updateValues.push(handlerPhone || null);

        updateFields.push('handler_idcard = ?');
        updateValues.push(handlerIdcard || null);
      } else {
        // 如果没有实际办理人，清空办理人信息
        updateFields.push('handler_name = NULL');
        updateFields.push('handler_phone = NULL');
        updateFields.push('handler_idcard = NULL');
      }
    }

    updateValues.push(id);

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // 🔥 同步更新 phones 表的 salestime 字段
    if (sale_time !== undefined) {
      // 查询该补贴记录对应的手机ID
      const [phoneInfo] = await getDatabase().execute(
        'SELECT phone_id FROM national_subsidies WHERE id = ?',
        [id]
      );

      if (phoneInfo.length > 0 && phoneInfo[0].phone_id) {
        const phoneId = phoneInfo[0].phone_id;
        let salestimeValue = null;

        if (sale_time === '') {
          salestimeValue = null;
        } else if (sale_time) {
          // 将日期字符串转换为 DATETIME 格式 (YYYY-MM-DD 00:00:00)
          salestimeValue = sale_time + ' 00:00:00';
        }

        // 更新 phones 表的 salestime 字段
        await getDatabase().execute(
          'UPDATE phones SET salestime = ? WHERE id = ?',
          [salestimeValue, phoneId]
        );
      }
    }

    clearCache('/subsidy');
    res.json({
      success: true,
      message: '更新成功'
    });

  } catch (error) {
    log.error('❌ 更新国补信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新失败',
      error: error.message
    });
  }
});

// 审批国补申请（记录审批时间）
router.put('/:id/audit', unifiedAuth, requirePermission('subsidy:edit'), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET apply_time = NOW()
      WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    clearCache('/subsidy');
    res.json({
      success: true,
      message: '审批成功'
    });

  } catch (error) {
    log.error('❌ 审批失败:', error);
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    });
  }
});

// 删除国补记录
router.delete('/:id', unifiedAuth, requirePermission('subsidy:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // 先查询记录，获取照片信息
    const [records] = await getDatabase().execute(
      'SELECT subsidy_photos FROM national_subsidies WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    // 删除数据库记录
    const [result] = await getDatabase().execute(
      'DELETE FROM national_subsidies WHERE id = ?',
      [id]
    );

    // 删除关联的照片文件
    if (records[0].subsidy_photos) {
      try {
        const photos = typeof records[0].subsidy_photos === 'string'
          ? JSON.parse(records[0].subsidy_photos)
          : records[0].subsidy_photos;

        if (Array.isArray(photos) && photos.length > 0) {
          for (const photoUrl of photos) {
            // 从 URL 中提取文件名
            const filename = photoUrl.split('/').pop();
            const filePath = path.join(uploadDir, filename);

            // 检查文件是否存在并删除
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (error) {
        log.error('⚠️ 删除照片文件失败:', error);
        // 不影响主流程，继续执行
      }
    }

    clearCache('/subsidy');
    res.json({
      success: true,
      message: '删除成功'
    });

  } catch (error) {
    log.error('❌ 删除国补记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  }
});

// 审批国补申请
router.put('/:id/approve', unifiedAuth, requirePermission('subsidy:approve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '请提供审批结果'
      });
    }

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET apply_status = ?
      WHERE id = ?
    `, [
      approved ? 'approved' : 'rejected',
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    clearCache('/subsidy');
    res.json({
      success: true,
      message: approved ? '审批通过' : '审批拒绝'
    });

  } catch (error) {
    log.error('❌ 审批失败:', error);
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    });
  }
});

// 确认国补到账（记录到账时间）
router.put('/:id/confirm-arrival', unifiedAuth, requirePermission('subsidy:edit'), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET arrival_time = NOW()
      WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: '国补记录不存在'
      });
    }

    clearCache('/subsidy');
    res.json({
      success: true,
      message: '确认到账成功'
    });

  } catch (error) {
    log.error('❌ 确认到账失败:', error);
    res.status(500).json({
      success: false,
      message: '确认到账失败',
      error: error.message
    });
  }
});

// 获取国补统计
router.get('/stats/summary', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: 10000 }), async (req, res) => {
  try {
    const { whereConditions, queryParams } = buildSubsidyFilters(req.query);
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 总体统计
    const [stats] = await getDatabase().execute(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN has_different_handler = 1 THEN 1 ELSE 0 END) as handler_count,
        COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
        COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
      FROM national_subsidies
      ${whereClause}
    `, queryParams);

    // 按店铺分组统计
    const [storeStats] = await getDatabase().execute(`
      SELECT
        store_id,
        store_name,
        COUNT(*) as total_count,
        SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
        COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
        COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
      FROM national_subsidies
      ${whereClause} AND store_id IS NOT NULL
      GROUP BY store_id, store_name
      ORDER BY total_count DESC
    `, queryParams);

    // 格式化店铺统计数据
    const formattedStoreStats = storeStats.map(store => ({
      ...store,
      total_count: parseInt(store.total_count),
      pending_count: parseInt(store.pending_count),
      completed_count: parseInt(store.completed_count),
      approved_count: parseInt(store.approved_count),
      total_arrived_amount: parseFloat(store.total_arrived_amount),
      total_subsidy_amount: parseFloat(store.total_subsidy_amount)
    }));

    res.json({
      success: true,
      message: '获取统计数据成功',
      data: {
        ...stats[0],
        total_arrived_amount: parseFloat(stats[0].total_arrived_amount),
        total_subsidy_amount: parseFloat(stats[0].total_subsidy_amount),
        store_stats: formattedStoreStats
      }
    });

  } catch (error) {
    log.error('❌ 获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// ============================
// 图片上传接口
// ============================

/**
 * 上传国补照片
 * POST /api/subsidy/upload/photo
 * 权限：需要登录
 */
router.post('/upload/photo', unifiedAuth, (req, res, next) => {
  // 使用 multer 处理上传，字段名为 'file'
  const uploadHandler = upload.single('file');

  uploadHandler(req, res, (err) => {
    if (err) {
      log.error('文件上传错误:', err);
      return ApiResponse.error(res, err.message || '文件上传失败', 500);
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, '没有上传文件', 400);
    }

    // 获取序列号和销售时间，用于重命名文件
    const serialNumber = req.body.serial_number || 'unknown';
    const saleTime = req.body.sale_time || '';
    const timestamp = Date.now();

    // 清理文件名中的特殊字符
    const safeName = serialNumber.replace(/[^a-zA-Z0-9\-]/g, '');
    const safeSaleTime = String(saleTime).replace(/[^0-9\-]/g, '');

    // 获取文件扩展名
    let ext = path.extname(req.file.originalname).toLowerCase();

    // 构建新文件名：序列号-销售时间-时间戳.扩展名
    const newFilename = `${safeName}-${safeSaleTime}-${timestamp}${ext}`;
    const oldPath = req.file.path;
    const newPath = path.join(uploadDir, newFilename);

    let finalFilename = newFilename;

    // 检查是否是HEIC/HEIF格式，如果是则转换为JPEG
    if (ext === '.heic' || ext === '.heif') {
      try {
        // 生成JPEG文件名
        const jpegFilename = `${safeName}-${safeSaleTime}-${timestamp}.jpg`;
        const jpegPath = path.join(uploadDir, jpegFilename);

        // 读取HEIC文件
        const inputBuffer = fs.readFileSync(oldPath);

        // 使用heic-convert转换HEIC到JPEG
        const outputBuffer = await convert({
          buffer: inputBuffer,
          format: 'JPEG',
          quality: 0.9
        });

        // 写入JPEG文件
        fs.writeFileSync(jpegPath, outputBuffer);

        // 删除原始HEIC文件
        fs.unlinkSync(oldPath);

        finalFilename = jpegFilename;
      } catch (convertError) {
        log.error('❌ HEIC转换失败:', convertError);
        // 如果转换失败，删除上传的文件
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
        return ApiResponse.error(res, 'HEIC格式转换失败', 500);
      }
    } else {
      // 非HEIC格式，直接重命名文件
      fs.renameSync(oldPath, newPath);
    }

    // 构建文件访问URL - 统一返回相对路径，由前端 formatImageUrl 函数处理
    // 这样可以和 H5 上传保持一致，开发环境走 Vite 代理，生产环境走 Nginx 代理
    const fileUrl = `/uploads/subsidy/${finalFilename}`;

    // 注意：ApiResponse.success 参数顺序是 (res, message, data, statusCode, meta)
    ApiResponse.success(res, '照片上传成功', {
      url: fileUrl,
      filename: finalFilename,
      size: req.file.size
    });
  } catch (error) {
    log.error('上传国补照片失败:', error);
    ApiResponse.error(res, error.message || '照片上传失败', 500);
  }
});

/**
 * 删除临时照片（未保存的上传照片）
 * POST /api/subsidy/delete-temp-photos
 * 权限：需要登录
 */
router.post('/delete-temp-photos', unifiedAuth, async (req, res) => {
  try {
    const { photos } = req.body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return ApiResponse.success(res, '没有需要删除的照片');
    }

    const deletedFiles = [];
    const failedFiles = [];

    for (const photoUrl of photos) {
      try {
        // 从URL中提取文件名
        const urlParts = photoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        // 构建文件路径
        const uploadDirPath = process.env.NODE_ENV === 'production'
          ? process.env.UPLOAD_PATH || '/www/wwwroot/v6.cn9527.cn/backend/uploads'
          : path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDirPath, 'subsidy', filename);

        // 删除文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(filename);
        }
      } catch (error) {
        log.error(`⚠️ 删除临时照片失败: ${photoUrl}`, error.message);
        failedFiles.push(photoUrl);
      }
    }

    ApiResponse.success(res, `已清理 ${deletedFiles.length} 个临时文件`, {
      deleted: deletedFiles.length,
      failed: failedFiles.length
    });
  } catch (error) {
    log.error('删除临时照片失败:', error);
    ApiResponse.error(res, error.message || '删除临时照片失败', 500);
  }
});

module.exports = router;
