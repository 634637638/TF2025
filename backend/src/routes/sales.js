const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoice-number');
const { normalizeDateTime } = require('../utils/time');
const { hasColumn } = require('../services/schemaInspector.service');
const { generateMemberNumber } = require('../utils/member-number');
const XLSX = require('xlsx');
const log = require('../utils/log');

const buildAvailablePhonesExportFilters = async (query = {}) => {
  const db = getDatabase();
  const {
    phone_id,
    search,
    supplier_id,
    store_id,
    operator_id,
    is_new,
    status,
    brand_id,
    model_id,
    color_id,
    memory_id,
    model_exact,
    date,
    date_start,
    date_end,
    brand,
    model,
    color,
    memory,
    customer_id,
    sale_status,
    salesman_id,
    price_range
  } = query;

  const whereConditions = ['p.status = ?'];
  const queryParams = [status || 'in_stock'];

  if (phone_id) {
    whereConditions.push('p.id = ?');
    queryParams.push(parseInt(phone_id, 10));
  }

  if (search) {
    const isNumeric = /^\d+(\.\d+)?$/.test(search);

    if (isNumeric && search.includes('.')) {
      const priceValue = parseFloat(search);
      whereConditions.push('p.purchase_cost >= ? AND p.purchase_cost < ?');
      queryParams.push(priceValue - 0.01, priceValue + 0.01);
    } else if (isNumeric && search.length >= 10) {
      whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    } else if (isNumeric) {
      whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ? OR ABS(p.purchase_cost - ?) < 0.01)');
      queryParams.push(`%${search}%`, `%${search}%`, parseFloat(search));
    } else {
      whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }
  }

  if (store_id) {
    whereConditions.push('p.store_id = ?');
    queryParams.push(store_id);
  }

  if (supplier_id) {
    whereConditions.push('p.supplier_id = ?');
    queryParams.push(supplier_id);
  }

  if (operator_id) {
    whereConditions.push('p.inventory_operator_id = ?');
    queryParams.push(operator_id);
  }

  if (is_new !== undefined && is_new !== '') {
    whereConditions.push('p.is_new = ?');
    queryParams.push(is_new === '1' ? 1 : 0);
  }

  if (date) {
    whereConditions.push('DATE(p.Inventorytime) = ?');
    queryParams.push(date);
  } else if (date_start || date_end) {
    if (date_start && date_end) {
      whereConditions.push('DATE(p.Inventorytime) BETWEEN ? AND ?');
      queryParams.push(date_start, date_end);
    } else if (date_start) {
      whereConditions.push('DATE(p.Inventorytime) >= ?');
      queryParams.push(date_start);
    } else if (date_end) {
      whereConditions.push('DATE(p.Inventorytime) <= ?');
      queryParams.push(date_end);
    }
  }

  const parsedBrandId = brand_id !== undefined && brand_id !== '' ? parseInt(brand_id, 10) : null;
  const parsedModelId = model_id !== undefined && model_id !== '' ? parseInt(model_id, 10) : null;
  const parsedColorId = color_id !== undefined && color_id !== '' ? parseInt(color_id, 10) : null;
  const parsedMemoryId = memory_id !== undefined && memory_id !== '' ? parseInt(memory_id, 10) : null;

  if (parsedBrandId !== null && !Number.isNaN(parsedBrandId)) {
    whereConditions.push('p.brand_id = ?');
    queryParams.push(parsedBrandId);
  } else if (brand) {
    const [exactBrandResult] = await db.execute(
      'SELECT id, name FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
      [brand.trim()]
    );

    if (exactBrandResult.length > 0) {
      whereConditions.push('p.brand_id = ?');
      queryParams.push(exactBrandResult[0].id);
    } else {
      const [fuzzyBrandResult] = await db.execute(
        'SELECT id, name FROM brands WHERE LOWER(name) LIKE LOWER(?) ORDER BY name',
        [`%${brand.trim().toLowerCase()}%`]
      );

      if (fuzzyBrandResult.length > 0) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(fuzzyBrandResult[0].id);
      } else {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(-1);
      }
    }
  }

  if (parsedModelId !== null && !Number.isNaN(parsedModelId)) {
    whereConditions.push('p.model_id = ?');
    queryParams.push(parsedModelId);
  } else if (model) {
    const normalizedModel = model.trim();
    const exactMatch = model_exact === '1' || model_exact === 1 || model_exact === true;
    const querySql = exactMatch
      ? 'SELECT id, name FROM models WHERE LOWER(TRIM(name)) = LOWER(?) ORDER BY name'
      : 'SELECT id, name FROM models WHERE LOWER(name) LIKE LOWER(?) ORDER BY name';
    const queryValue = exactMatch ? normalizedModel : `%${normalizedModel}%`;
    const [modelResults] = await db.execute(querySql, [queryValue]);

    if (modelResults.length > 0) {
      if (exactMatch) {
        whereConditions.push('p.model_id = ?');
        queryParams.push(modelResults[0].id);
      } else {
        const modelIds = modelResults.map(item => item.id);
        whereConditions.push(`p.model_id IN (${modelIds.map(() => '?').join(',')})`);
        queryParams.push(...modelIds);
      }
    } else {
      whereConditions.push('p.model_id = ?');
      queryParams.push(-1);
    }
  }

  if (parsedColorId !== null && !Number.isNaN(parsedColorId)) {
    whereConditions.push('p.color_id = ?');
    queryParams.push(parsedColorId);
  } else if (color) {
    const [exactColorResult] = await db.execute(
      'SELECT id, name FROM colors WHERE LOWER(TRIM(name)) = LOWER(?)',
      [color.trim()]
    );

    if (exactColorResult.length > 0) {
      whereConditions.push('p.color_id = ?');
      queryParams.push(exactColorResult[0].id);
    } else {
      const [similarColors] = await db.execute(
        'SELECT id, name FROM colors WHERE LOWER(name) LIKE ? ORDER BY name',
        [`%${color.trim().toLowerCase()}%`]
      );

      if (similarColors.length > 0) {
        whereConditions.push('p.color_id = ?');
        queryParams.push(-1);
      } else {
        whereConditions.push('p.color_id = ?');
        queryParams.push(-1);
      }
    }
  }

  if (parsedMemoryId !== null && !Number.isNaN(parsedMemoryId)) {
    whereConditions.push('p.memory_id = ?');
    queryParams.push(parsedMemoryId);
  } else if (memory) {
    const [exactMemoryResult] = await db.execute(
      'SELECT id, size FROM memories WHERE TRIM(size) = ?',
      [memory.trim()]
    );

    if (exactMemoryResult.length > 0) {
      whereConditions.push('p.memory_id = ?');
      queryParams.push(exactMemoryResult[0].id);
    } else {
      const [similarMemories] = await db.execute(
        'SELECT id, size FROM memories WHERE LOWER(size) LIKE ? ORDER BY size',
        [`%${memory.trim().toLowerCase()}%`]
      );

      if (similarMemories.length > 0) {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(-1);
      } else {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(-1);
      }
    }
  }

  if (customer_id) {
    whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')');
    queryParams.push(customer_id);
  }

  if (sale_status) {
    switch (sale_status) {
      case 'available':
        whereConditions.push('p.status = \'in_stock\' AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status != \'cancelled\')');
        break;
      case 'reserved':
        whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'reserved\')');
        break;
      case 'sold':
        whereConditions.push('p.status = \'sold\'');
        break;
      case 'shipped':
        whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'shipped\')');
        break;
      case 'completed':
        whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'completed\')');
        break;
      default:
        whereConditions.push('p.status = \'in_stock\'');
    }
  }

  if (salesman_id) {
    whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.salesman_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')');
    queryParams.push(salesman_id);
  }

  if (price_range) {
    const [minPrice, maxPrice] = price_range.split('-');
    if (minPrice && maxPrice) {
      whereConditions.push('p.sale_price BETWEEN ? AND ?');
      queryParams.push(parseFloat(minPrice), parseFloat(maxPrice));
    }
  }

  return { whereConditions, queryParams };
};

const buildAvailablePhonesSelectQuery = (whereConditions, paginationClause = '') => `
  SELECT
    p.id,
    p.imei,
    p.serial_number,
    m.name as model,
    b.name as brand,
    co.name as color,
    mem.size as memory,
    COALESCE(
      (
        SELECT hi.image_url
        FROM H5_images hi
        WHERE hi.phone_id = p.id
        ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
        LIMIT 1
      ),
      (
        SELECT ni.image_url
        FROM H5_newimages ni
        INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
        WHERE nt.brand_id = p.brand_id
          AND nt.model_id = p.model_id
          AND (
            nt.color_id = p.color_id
            OR (nt.color_id IS NULL AND p.color_id IS NULL)
          )
          AND nt.is_active = 1
        ORDER BY ni.is_primary DESC, ni.sort_order ASC, ni.id ASC
        LIMIT 1
      )
    ) as image_url,
    p.store_id,
    s.name as store_name,
    p.sale_price,
    p.purchase_cost,
    p.is_new,
    p.is_preordered,
    p.quality_grade,
    p.supplier_id,
    supp.name as supplier_name,
    p.inventory_operator_id,
    u.name as inventory_operator_name,
    u.username as operator_username,
    p.purchase_number,
    p.Inventorytime,
    p.salestime,
    p.remarks,
    p.status,
    CASE
      WHEN p.is_new = 1 THEN '全新'
      ELSE '二手'
    END as \`condition\`
  FROM phones p
  LEFT JOIN brands b ON p.brand_id = b.id
  LEFT JOIN models m ON p.model_id = m.id
  LEFT JOIN colors co ON p.color_id = co.id
  LEFT JOIN memories mem ON p.memory_id = mem.id
  LEFT JOIN stores s ON p.store_id = s.id
  LEFT JOIN suppliers supp ON p.supplier_id = supp.id
  LEFT JOIN users u ON p.inventory_operator_id = u.id
  WHERE ${whereConditions.join(' AND ')}
  ORDER BY p.Inventorytime DESC
  ${paginationClause}
`;

const formatAvailablePhones = (phones = []) => phones.map(phone => ({
  ...phone,
  sale_price: parseFloat(phone.sale_price) || null,
  purchase_cost: parseFloat(phone.purchase_cost) || null,
  is_new: phone.is_new === 1
}));

const getSalesStatusLabel = (status) => {
  const mapping = {
    in_stock: '在库',
    sold: '已售',
    reserved: '预订',
    repair: '维修中',
    lost: '丢失',
    peer_transfer: '调货',
    supplier_proxy: '划拨',
    returned: '已退货',
    damaged: '损坏'
  };

  return mapping[status] || status || '';
};

const buildAvailablePhonesExportFile = (phones = []) => {
  const rows = phones.map(phone => ({
    IMEI: phone.imei || '',
    序列号: phone.serial_number || '',
    品牌: phone.brand || '',
    型号: phone.model || '',
    颜色: phone.color || '',
    内存: phone.memory || '',
    店铺: phone.store_name || '',
    供应商: phone.supplier_name || '',
    入库员: phone.inventory_operator_name || phone.operator_username || '',
    新旧: phone.is_new ? '全新' : '二手',
    机况: phone.quality_grade || '',
    状态: getSalesStatusLabel(phone.status),
    库存售价: phone.sale_price || '',
    入库成本: phone.purchase_cost || '',
    入库时间: phone.Inventorytime || '',
    销售时间: phone.salestime || '',
    备注: phone.remarks || ''
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  const beijingDate = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-');

  XLSX.utils.book_append_sheet(workbook, worksheet, '销售管理');

  return {
    filename: `销售管理_${beijingDate}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    total: rows.length
  };
};

// 获取可销售手机列表
router.get('/phones/available', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      phone_id,
      search,
      supplier_id,
      store_id,
      operator_id,
      is_new,
      status,
      brand_id,
      model_id,
      color_id,
      memory_id,
      model_exact,
      date,
      date_start,
      date_end,
      brand,
      model,
      color,
      memory,
      customer_id,
      sale_status,
      salesman_id,
      price_range
    } = req.query;

    // 构建查询条件
    let whereConditions = ['p.status = ?'];
    let queryParams = [];
    queryParams.push(status || 'in_stock');

    if (phone_id) {
      whereConditions.push('p.id = ?');
      queryParams.push(parseInt(phone_id, 10));
    }

    // 添加搜索条件 - 支持搜索 IMEI、序列号(serial_number) 和 入库价格(purchase_cost)
    if (search) {
      // 判断是否为纯数字（可能是价格或纯数字 IMEI/序列号）
      const isNumeric = /^\d+(\.\d+)?$/.test(search);

      if (isNumeric && search.includes('.')) {
        // 包含小数点，视为价格搜索 - 使用范围匹配避免精度问题
        const priceValue = parseFloat(search);
        whereConditions.push('p.purchase_cost >= ? AND p.purchase_cost < ?');
        queryParams.push(priceValue - 0.01, priceValue + 0.01);
      } else if (isNumeric && search.length >= 10) {
        // 纯数字且长度>=10，可能是 IMEI 或序列号
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      } else if (isNumeric) {
        // 短数字，同时搜索 IMEI、序列号和价格
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ? OR ABS(p.purchase_cost - ?) < 0.01)');
        queryParams.push(`%${search}%`, `%${search}%`, parseFloat(search));
      } else {
        // 非纯数字，搜索 IMEI 或序列号
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }
    }

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(store_id);
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      queryParams.push(supplier_id);
    }

    if (operator_id) {
      whereConditions.push('p.inventory_operator_id = ?');
      queryParams.push(operator_id);
    }

    if (is_new !== undefined && is_new !== '') {
      whereConditions.push('p.is_new = ?');
      const isNewValue = is_new === '1' ? 1 : 0;
      queryParams.push(isNewValue);
    }

    // 日期筛选：支持单个日期和日期范围
    if (date) {
      // 兼容旧的单个日期参数
      whereConditions.push('DATE(p.Inventorytime) = ?');
      queryParams.push(date);
    } else if (date_start || date_end) {
      // 新的日期范围筛选
      if (date_start && date_end) {
        // 同时有开始和结束日期
        whereConditions.push('DATE(p.Inventorytime) BETWEEN ? AND ?');
        queryParams.push(date_start, date_end);
      } else if (date_start) {
        // 只有开始日期
        whereConditions.push('DATE(p.Inventorytime) >= ?');
        queryParams.push(date_start);
      } else if (date_end) {
        // 只有结束日期
        whereConditions.push('DATE(p.Inventorytime) <= ?');
        queryParams.push(date_end);
      }
    }

    const parsedBrandId = brand_id !== undefined && brand_id !== '' ? parseInt(brand_id) : null;
    const parsedModelId = model_id !== undefined && model_id !== '' ? parseInt(model_id) : null;
    const parsedColorId = color_id !== undefined && color_id !== '' ? parseInt(color_id) : null;
    const parsedMemoryId = memory_id !== undefined && memory_id !== '' ? parseInt(memory_id) : null;

    // 添加品牌筛选条件
    if (parsedBrandId !== null && !Number.isNaN(parsedBrandId)) {
      whereConditions.push('p.brand_id = ?');
      queryParams.push(parsedBrandId);
    } else if (brand) {
      // 先尝试精确匹配
      const [exactBrandResult] = await getDatabase().execute(
        'SELECT id, name FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
        [brand.trim()]
      );

      if (exactBrandResult.length > 0) {
        const brandId = exactBrandResult[0].id;
        whereConditions.push('p.brand_id = ?');
        queryParams.push(brandId);
      } else {
        // 精确匹配失败，尝试模糊匹配
        const [fuzzyBrandResult] = await getDatabase().execute(
          'SELECT id, name FROM brands WHERE LOWER(name) LIKE LOWER(?) ORDER BY name',
          [`%${brand.trim().toLowerCase()}%`]
        );

        if (fuzzyBrandResult.length > 0) {
          const brandId = fuzzyBrandResult[0].id;
          whereConditions.push('p.brand_id = ?');
          queryParams.push(brandId);
        } else {
          // 如果品牌不存在，设置一个不会匹配任何结果的条件
          whereConditions.push('p.brand_id = ?');
          queryParams.push(-1);
        }
      }
    }

    // 添加型号筛选条件
    if (parsedModelId !== null && !Number.isNaN(parsedModelId)) {
      whereConditions.push('p.model_id = ?');
      queryParams.push(parsedModelId);
    } else if (model) {
      const normalizedModel = model.trim();
      const querySql = model_exact === '1' || model_exact === 1 || model_exact === true
        ? 'SELECT id, name FROM models WHERE LOWER(TRIM(name)) = LOWER(?) ORDER BY name'
        : 'SELECT id, name FROM models WHERE LOWER(name) LIKE LOWER(?) ORDER BY name';
      const queryValue = model_exact === '1' || model_exact === 1 || model_exact === true
        ? normalizedModel
        : `%${normalizedModel}%`;

      const [modelResults] = await getDatabase().execute(querySql, [queryValue]);

      if (modelResults.length > 0) {
        if (model_exact === '1' || model_exact === 1 || model_exact === true) {
          whereConditions.push('p.model_id = ?');
          queryParams.push(modelResults[0].id);
        } else {
          // 收集所有匹配的型号ID
          const modelIds = modelResults.map(m => m.id);
          whereConditions.push(`p.model_id IN (${modelIds.map(() => '?').join(',')})`);
          queryParams.push(...modelIds);
        }
      } else {
        whereConditions.push('p.model_id = ?');
        queryParams.push(-1);
      }
    }

    // 添加颜色筛选条件
    if (parsedColorId !== null && !Number.isNaN(parsedColorId)) {
      whereConditions.push('p.color_id = ?');
      queryParams.push(parsedColorId);
    } else if (color) {
      // 先尝试精确匹配
      const [exactColorResult] = await getDatabase().execute(
        'SELECT id, name FROM colors WHERE LOWER(TRIM(name)) = LOWER(?)',
        [color.trim()]
      );

      if (exactColorResult.length > 0) {
        const colorId = exactColorResult[0].id;
        whereConditions.push('p.color_id = ?');
        queryParams.push(colorId);
      } else {
        // 如果精确匹配失败，查看数据库中所有相似的颜色
        const [similarColors] = await getDatabase().execute(
          'SELECT id, name FROM colors WHERE LOWER(name) LIKE ? ORDER BY name',
          [`%${color.trim().toLowerCase()}%`]
        );

        if (similarColors.length > 0) {
          whereConditions.push('p.color_id = ?');
          queryParams.push(-1);
        } else {
          whereConditions.push('p.color_id = ?');
          queryParams.push(-1);
        }
      }
    }

    // 添加内存筛选条件
    if (parsedMemoryId !== null && !Number.isNaN(parsedMemoryId)) {
      whereConditions.push('p.memory_id = ?');
      queryParams.push(parsedMemoryId);
    } else if (memory) {
      // 先尝试精确匹配
      const [exactMemoryResult] = await getDatabase().execute(
        'SELECT id, size FROM memories WHERE TRIM(size) = ?',
        [memory.trim()]
      );

      if (exactMemoryResult.length > 0) {
        const memoryId = exactMemoryResult[0].id;
        whereConditions.push('p.memory_id = ?');
        queryParams.push(memoryId);
      } else {
        // 如果精确匹配失败，查看数据库中所有相似的内存
        const [similarMemories] = await getDatabase().execute(
          'SELECT id, size FROM memories WHERE LOWER(size) LIKE ? ORDER BY size',
          [`%${memory.trim().toLowerCase()}%`]
        );

        if (similarMemories.length > 0) {
          whereConditions.push('p.memory_id = ?');
          queryParams.push(-1);
        } else {
          whereConditions.push('p.memory_id = ?');
          queryParams.push(-1);
        }
      }
    }

    // 客户筛选条件 - 查找与该客户相关联的设备
    if (customer_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')');
      queryParams.push(customer_id);
    }

    // 销售状态筛选条件 - 查找特定销售状态的设备
    if (sale_status) {
      switch (sale_status) {
        case 'available':
          whereConditions.push('p.status = \'in_stock\' AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status != \'cancelled\')');
          break;
        case 'reserved':
          whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'reserved\')');
          break;
        case 'sold':
          whereConditions.push('p.status = \'sold\'');
          break;
        case 'shipped':
          whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'shipped\')');
          break;
        case 'completed':
          whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.phone_id = p.id AND so.status = \'completed\')');
          break;
        default:
          whereConditions.push('p.status = \'in_stock\'');
      }
    }

    // 销售员筛选条件 - 查找该销售员负责的设备
    if (salesman_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM sales_orders so WHERE so.salesman_id = ? AND so.phone_id = p.id AND so.status != \'cancelled\')');
      queryParams.push(salesman_id);
    }

    // 价格范围筛选条件
    if (price_range) {
      const [minPrice, maxPrice] = price_range.split('-');
      if (minPrice && maxPrice) {
        whereConditions.push('p.sale_price BETWEEN ? AND ?');
        queryParams.push(parseFloat(minPrice), parseFloat(maxPrice));
      }
    }

    // 构建SQL查询
    const limitNum = parseInt(limit) || 20;
    const offsetNum = (parseInt(page) - 1) * limitNum;

    // 为了避免MySQL参数化查询的LIMIT/OFFSET问题，直接内联到SQL中
    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        m.name as model,
        b.name as brand,
        co.name as color,
        mem.size as memory,
        COALESCE(
          (
            SELECT hi.image_url
            FROM H5_images hi
            WHERE hi.phone_id = p.id
            ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
            LIMIT 1
          ),
          (
            SELECT ni.image_url
            FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id
              AND nt.model_id = p.model_id
              AND (
                nt.color_id = p.color_id
                OR (nt.color_id IS NULL AND p.color_id IS NULL)
              )
              AND nt.is_active = 1
            ORDER BY ni.is_primary DESC, ni.sort_order ASC, ni.id ASC
            LIMIT 1
          )
        ) as image_url,
        p.store_id,
        s.name as store_name,
        p.sale_price,
        p.purchase_cost,
        p.is_new,
        p.is_preordered,
        p.quality_grade,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as inventory_operator_name,
        u.username as operator_username,
        p.purchase_number,
        p.Inventorytime,
        p.salestime,
        p.remarks,
        p.status,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as \`condition\`
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.Inventorytime DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    // 执行查询
    const [phones] = await getDatabase().execute(query, queryParams);
    const [countResult] = await getDatabase().execute(countQuery, queryParams);

    // 计算符合条件的所有设备的总价值（分别统计全新和二手）
    const totalValueQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.purchase_cost ELSE 0 END), 0) as new_value,
        COALESCE(SUM(CASE WHEN p.is_new = 0 THEN p.purchase_cost ELSE 0 END), 0) as used_value,
        COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE ${whereConditions.join(' AND ')}
    `;

    const [totalValueResult] = await getDatabase().execute(totalValueQuery, queryParams);

    // 格式化返回数据
    const formattedPhones = phones.map(phone => ({
      ...phone,
      sale_price: parseFloat(phone.sale_price) || null,
      purchase_cost: parseFloat(phone.purchase_cost) || null,
      is_new: phone.is_new === 1
    }));

    // 返回响应
    res.json({
      success: true,
      message: '获取可销售设备列表成功',
      data: formattedPhones,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      },
      stats: {
        total_value: parseFloat(totalValueResult[0].total_value) || 0,
        new_value: parseFloat(totalValueResult[0].new_value) || 0,
        used_value: parseFloat(totalValueResult[0].used_value) || 0
      }
    });

  } catch (error) {
    log.error('❌ 获取可销售手机列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取可销售设备列表失败',
      error: error.message
    });
  }
});

router.get('/phones/available/export', unifiedAuth, requirePermission('sales:export'), async (req, res) => {
  try {
    const { whereConditions, queryParams } = await buildAvailablePhonesExportFilters(req.query);
    const query = buildAvailablePhonesSelectQuery(whereConditions);
    const [phones] = await getDatabase().execute(query, queryParams);
    const exportFile = buildAvailablePhonesExportFile(formatAvailablePhones(phones));

    res.setHeader('Content-Type', exportFile.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`
    );
    res.setHeader('X-Export-Total', String(exportFile.total));

    return res.send(exportFile.buffer);
  } catch (error) {
    log.error('❌ 导出可销售手机列表失败:', error);
    return res.status(500).json({
      success: false,
      message: '导出可销售手机列表失败',
      error: error.message
    });
  }
});

// 手机销售出库（支持单个和批量销售）
router.post('/phone', unifiedAuth, requirePermission('sales:create'), async (req, res) => {
  try {
    const {
      phone_id,  // 单个设备ID（兼容性）
      phones,    // 批量设备数组
      customer_info,
      sale_type,
      price,     // 单个价格（兼容性）
      purchase_cost, // 单个设备的入库价格（兼容性）
      supplier_id, // 单个设备的供应商ID（兼容性）
      sale_date, // 销售日期（兼容性）
      payment_info,
      remarks,   // 销售备注
      operator_id, // 销售员ID
      preorder_id, // 预订单ID（从预定页面跳转销售时）
      advance_payment // 预定金（从预定页面跳转销售时）
    } = req.body;

    // 统一规范化销售时间（北京时间字符串）
    const saleTimeStr = normalizeDateTime(sale_date, true);

    // 判断是批量还是单个销售
    const isBatchSale = Array.isArray(phones) && phones.length > 0;
    const phonesToSell = isBatchSale ? phones : [{
      phone_id,
      price: parseFloat(price),
      purchase_cost: purchase_cost !== undefined ? parseFloat(purchase_cost) : null,
      supplier_id: supplier_id !== undefined && supplier_id !== null && supplier_id !== '' ? parseInt(supplier_id) : null
    }];

    // 基本验证
    if (!customer_info || phonesToSell.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的销售信息'
      });
    }

    // 验证每个设备的信息
    for (const phone of phonesToSell) {
      if (!phone.phone_id || !phone.price || phone.price <= 0) {
        return res.status(400).json({
          success: false,
          message: '设备信息不完整或价格无效'
        });
      }
    }

    // 验证支付信息
    if (!payment_info || !payment_info.payment_method) {
      return res.status(400).json({
        success: false,
        message: '缺少支付方式信息'
      });
    }

    // 从连接池获取连接进行事务处理
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();
      const supportsSalesPaymentChannel = await hasColumn('sales', 'payment_channel', conn);

      // 1. 创建或查找客户记录
      let customerId = null;
      if (customer_info.phone) {
        // 检查客户是否已存在
        const [existingCustomer] = await conn.execute(
          'SELECT id FROM customers WHERE phone = ?',
          [customer_info.phone]
        );

        if (existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
          // 更新客户信息
          await conn.execute(
            `UPDATE customers SET
              name = COALESCE(?, name),
              apple_id = COALESCE(?, apple_id)
            WHERE id = ?`,
            [customer_info.name, customer_info.apple_id, customerId]
          );
        } else {
          // 创建新客户
          const memberNumber = await generateMemberNumber({ connection: conn });
          const [newCustomer] = await conn.execute(
            `INSERT INTO customers (name, phone, apple_id, member_number, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [customer_info.name, customer_info.phone, customer_info.apple_id || null, memberNumber]
          );
          customerId = newCustomer.insertId;
        }
      }

      // 如果没有客户手机号，创建一个临时客户记录
      if (!customerId) {
        const name = customer_info.name || '临时客户';
        const phone = `TEMP_${Date.now()}`; // 生成临时手机号
        const memberNumber = await generateMemberNumber({ connection: conn });

        const [newCustomer] = await conn.execute(
          `INSERT INTO customers (name, phone, member_number, created_at)
           VALUES (?, ?, ?, NOW())`,
          [name, phone, memberNumber]
        );
        customerId = newCustomer.insertId;
      }

      // 2. 检查所有设备状态并获取成本信息
      const phoneIds = phonesToSell.map(p => p.phone_id);
      const [phoneChecks] = await conn.execute(
        `SELECT
          p.id,
          p.status,
          p.purchase_cost,
          p.is_preordered,
          pr.customer_id as preorder_customer_id,
          pr.customer_name as preorder_customer_name
        FROM phones p
        LEFT JOIN preorders pr ON p.id = pr.matched_phone_id AND pr.status IN ('pending', 'arrived')
        WHERE p.id IN (${phoneIds.map(() => '?').join(',')})`,
        phoneIds
      );

      if (phoneChecks.length !== phonesToSell.length) {
        await conn.rollback();
        return res.status(404).json({
          success: false,
          message: '部分或全部设备不存在'
        });
      }

      // 检查每个设备的状态
      for (const phoneCheck of phoneChecks) {
        if (phoneCheck.status !== 'in_stock') {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `设备ID ${phoneCheck.id} 不在库存中，无法销售`
          });
        }

        // 检查是否已被预订，如果已预订则只能销售给预订的客户
        if (phoneCheck.is_preordered === 1) {
          if (!phoneCheck.preorder_customer_id || phoneCheck.preorder_customer_id !== customerId) {
            await conn.rollback();
            return res.status(400).json({
              success: false,
              message: `设备ID ${phoneCheck.id} 已被客户"${phoneCheck.preorder_customer_name || '未知'}"预订，只能销售给该客户`
            });
          }
        }
      }

      // 检查是否将同一设备重复销售给同一客户
      if (customerId) {
        const [duplicateSales] = await conn.execute(
          `SELECT s.id, p.imei, s.sale_date
           FROM sales s
           JOIN phones p ON s.phone_id = p.id
           WHERE s.phone_id IN (${phoneIds.map(() => '?').join(',')})
             AND s.customer_id = ?
           ORDER BY s.sale_date DESC
           LIMIT 10`,
          [...phoneIds, customerId]
        );

        if (duplicateSales.length > 0) {
          const duplicateList = duplicateSales.map(s =>
            `IMEI: ${s.imei}, 销售日期: ${new Date(s.sale_date).toLocaleDateString()}`
          ).join('; ');

          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `检测到重复销售：以下设备已销售给该客户 - ${duplicateList}。请确认是否重复操作。`
          });
        }
      }

      const existingPhoneCostMap = new Map(
        phoneChecks.map((phone) => [phone.id, phone.purchase_cost !== null && phone.purchase_cost !== undefined
          ? parseFloat(phone.purchase_cost)
          : null])
      );

      const finalizedPhonesToSell = phonesToSell.map((phone) => {
        const resolvedPrice = parseFloat(phone.price);
        const resolvedPurchaseCost = phone.purchase_cost !== undefined && phone.purchase_cost !== null && phone.purchase_cost !== ''
          ? parseFloat(phone.purchase_cost)
          : existingPhoneCostMap.get(phone.phone_id);

        return {
          ...phone,
          price: resolvedPrice,
          resolved_purchase_cost: resolvedPurchaseCost !== undefined ? resolvedPurchaseCost : null
        };
      });

      // 3. 创建销售记录
      const totalAmount = finalizedPhonesToSell.reduce((sum, phone) => sum + (parseFloat(phone.price) || 0), 0);
      let saleId = null;

      // 单个销售时创建销售记录
      if (!isBatchSale) {
        // 生成单据编号（使用销售时间）
        const invoiceNumber = await generateInvoiceNumber(sale_type || 'retail', conn, saleTimeStr);

        const salesInsertColumns = [
          'phone_id', 'customer_id', 'sale_type', 'operator_id', 'store_id',
          'price', 'cost', 'payment_method'
        ];
        const salesInsertValues = [
          finalizedPhonesToSell[0].phone_id,
          customerId,
          sale_type || 'retail',
          operator_id || req.user.id,
          req.body.store_id || null,
          finalizedPhonesToSell[0].price,
          finalizedPhonesToSell[0].resolved_purchase_cost,
          payment_info.payment_method || 'cash'
        ];

        if (supportsSalesPaymentChannel) {
          salesInsertColumns.push('payment_channel');
          salesInsertValues.push(payment_info.payment_channel || null);
        }

        salesInsertColumns.push('invoice_number', 'remarks', 'sale_date');
        salesInsertValues.push(invoiceNumber, remarks || null, saleTimeStr);

        const [salesResult] = await conn.execute(
          `INSERT INTO sales (
            ${salesInsertColumns.join(', ')}
          ) VALUES (${salesInsertColumns.map(() => '?').join(', ')})`,
          salesInsertValues
        );
        saleId = salesResult.insertId;
      }

      // 4. 批量模式下为每个设备创建单独的销售记录
      if (isBatchSale) {
        for (const phone of finalizedPhonesToSell) {
          // 为每条记录生成单据编号（使用销售时间）
          const invoiceNumber = await generateInvoiceNumber('batch_item', conn, saleTimeStr);

          const salesInsertColumns = [
            'phone_id', 'customer_id', 'sale_type', 'operator_id', 'store_id',
            'price', 'cost', 'payment_method'
          ];
          const salesInsertValues = [
            phone.phone_id,
            customerId,
            'batch_item',
            operator_id || req.user.id,
            req.body.store_id || null,
            phone.price,
            phone.resolved_purchase_cost,
            payment_info.payment_method || 'cash'
          ];

          if (supportsSalesPaymentChannel) {
            salesInsertColumns.push('payment_channel');
            salesInsertValues.push(payment_info.payment_channel || null);
          }

          salesInsertColumns.push('invoice_number', 'remarks', 'sale_date');
          salesInsertValues.push(invoiceNumber, remarks || null, saleTimeStr);

          await conn.execute(
            `INSERT INTO sales (
              ${salesInsertColumns.join(', ')}
            ) VALUES (${salesInsertColumns.map(() => '?').join(', ')})`,
            salesInsertValues
          );
        }
      }

      // 5. 创建支付记录（临时禁用外键检查）
      await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

      // 构建交易流水备注
      const paymentRemarks = [
        payment_info.transaction_no ? `交易流水号: ${payment_info.transaction_no}` : null,
        payment_info.payment_channel ? `支付渠道: ${payment_info.payment_channel}` : null
      ].filter(Boolean).join(', ') || (isBatchSale ? '批量销售收款' : '单个销售收款');

      // 批量销售时使用第一个phone_id作为order_id，单个销售使用saleId
      const orderId = isBatchSale ? finalizedPhonesToSell[0].phone_id : saleId;

      const [paymentResult] = await conn.execute(
        `INSERT INTO payment_records (
          order_id, customer_id, payment_method, payment_channel,
          amount, payment_status, transaction_no, payment_time,
          remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, // 使用销售ID或phone_id作为order_id
          customerId,
          payment_info.payment_method,
          payment_info.payment_channel || null,
          parseFloat(payment_info.payment_amount || totalAmount),
          payment_info.payment_status || 'success',
          payment_info.transaction_no || null,
          normalizeDateTime(payment_info.payment_time || saleTimeStr, true),
          paymentRemarks
        ]
      );

      // 重新启用外键检查
      await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

      // 6. 更新所有手机状态和备注
      // 先查询所有手机的当前 supplier_id，以便在更新时保持原值
      const phoneIdsForSupplier = finalizedPhonesToSell.map(p => p.phone_id);
      const [currentPhones] = await conn.execute(
        `SELECT id, supplier_id FROM phones WHERE id IN (${phoneIdsForSupplier.map(() => '?').join(',')})`,
        phoneIdsForSupplier
      );

      // 创建 phone_id -> supplier_id 的映射
      const supplierIdMap = {};
      currentPhones.forEach(p => {
        supplierIdMap[p.id] = p.supplier_id;
      });

      const phoneUpdatePromises = finalizedPhonesToSell.map(phone => {
        // 如果前端没有提供 supplier_id，则保持数据库中的原值
        const finalSupplierId = phone.supplier_id !== undefined && phone.supplier_id !== null
          ? parseInt(phone.supplier_id)
          : supplierIdMap[phone.phone_id];

        return conn.execute(
          `UPDATE phones SET
            status = 'sold',
            sale_price = ?,
            purchase_cost = ?,
            supplier_id = ?,
            remarks = ?,
            salestime = ?,
            sale_operator_id = ?
          WHERE id = ?`,
          [
            parseFloat(phone.price),
            phone.resolved_purchase_cost, // 未显式传值时回退为设备原始入库成本，避免被写成 null
            finalSupplierId, // 供应商：使用前端提供的值，或保持数据库原值
            remarks || null,
            saleTimeStr, // 使用用户选择的时间或当前时间
            operator_id || req.user.id, // 使用传递的销售员ID，如果没有则使用当前用户ID
            phone.phone_id
          ]
        );
      });

      const updateResults = await Promise.all(phoneUpdatePromises);

      // 检查是否所有设备都更新成功
      const failedUpdates = updateResults.filter(result => result[0].affectedRows === 0);
      if (failedUpdates.length > 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: '部分设备状态更新失败'
        });
      }

      // 7. 处理预订单关联（从预定页面跳转销售时）
      if (preorder_id) {
        // 获取预订单信息
        const [preorderInfo] = await conn.execute(
          `SELECT id, customer_id, advance_payment, matched_phone_id, status FROM preorders WHERE id = ?`,
          [parseInt(preorder_id)]
        );

        if (preorderInfo.length > 0) {
          const preorder = preorderInfo[0];

          // 检查预订单状态是否为已匹配（arrived）
          if (preorder.status !== 'arrived') {
            log.warn('⚠️ 预订单状态不是已匹配，当前状态:', preorder.status);
          }

          // 计算尾款（销售价格 - 定金）
          const actualPrice = finalizedPhonesToSell[0].price;
          const depositAmount = parseFloat(advance_payment) || parseFloat(preorder.advance_payment) || 0;
          const remainingAmount = actualPrice - depositAmount;

          // 更新预订单状态为已交付
          await conn.execute(
            `UPDATE preorders SET
              status = 'completed',
              actual_price = ?,
              delivered_time = ?,
              operator_id = ?,
              remaining_amount = ?
            WHERE id = ?`,
            [
              actualPrice,
              saleTimeStr,
              operator_id || req.user.id,
              remainingAmount,
              parseInt(preorder_id)
            ]
          );

        } else {
          log.warn('⚠️ 未找到预订单，ID:', preorder_id);
        }
      }

      await conn.commit();

      res.json({
        success: true,
        message: isBatchSale ? `批量销售成功！共销售 ${phonesToSell.length} 台设备` : '销售成功',
        data: {
          sale_id: isBatchSale ? null : saleId, // 批量销售时没有总销售记录ID
          payment_id: paymentResult.insertId,
          customer_name: customer_info.name,
          customer_phone: customer_info.phone,
          phones_sold: finalizedPhonesToSell.length,
          total_amount: totalAmount,
          phone_details: finalizedPhonesToSell.map(p => ({
            phone_id: p.phone_id,
            price: parseFloat(p.price),
            cost: p.resolved_purchase_cost
          }))
        }
      });

    } catch (innerError) {
      await conn.rollback();
      throw innerError;
    } finally {
      // 确保连接被释放回连接池
      conn.release();
    }

  } catch (error) {
    log.error('❌ 手机销售失败:', error);
    res.status(500).json({
      success: false,
      message: '销售失败',
      error: error.message
    });
  }
});

// 获取销售统计
router.get('/stats', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    // 统计数据
    const [stats] = await getDatabase().execute(`
      SELECT
        COUNT(*) as total_phones,
        COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as available_phones,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_phones,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved_phones
      FROM phones
    `);

    const [monthStats] = await getDatabase().execute(`
      SELECT
        COUNT(*) as sold_this_month,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN sale_price ELSE 0 END), 0) as total_revenue
      FROM phones
      WHERE status = 'sold'
        AND YEAR(salestime) = YEAR(CURRENT_DATE)
        AND MONTH(salestime) = MONTH(CURRENT_DATE)
    `);

    res.json({
      success: true,
      message: '获取销售统计成功',
      data: {
        ...stats[0],
        sold_this_month: monthStats[0].sold_this_month,
        total_revenue: parseFloat(monthStats[0].total_revenue)
      }
    });

  } catch (error) {
    log.error('❌ 获取销售统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取销售统计失败',
      error: error.message
    });
  }
});

// 获取可销售手机统计数据（库存卡片统计）
router.get('/phones/available/stats', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const {
      search,
      supplier_id,
      store_id,
      operator_id,
      is_new,
      date,
      date_start,
      date_end,
      brand,
      model,
      color,
      memory
    } = req.query;

    // 构建查询条件（与/phones/available相同的逻辑）
    let whereConditions = ['p.status = "in_stock"'];
    let queryParams = [];

    if (search) {
      // 判断是否为纯数字（可能是价格或纯数字 IMEI/序列号）
      const isNumeric = /^\d+(\.\d+)?$/.test(search);

      if (isNumeric && search.includes('.')) {
        // 包含小数点，视为价格搜索 - 使用范围匹配避免精度问题
        const priceValue = parseFloat(search);
        whereConditions.push('p.purchase_cost >= ? AND p.purchase_cost < ?');
        queryParams.push(priceValue - 0.01, priceValue + 0.01);
      } else if (isNumeric && search.length >= 10) {
        // 纯数字且长度>=10，可能是 IMEI 或序列号
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      } else if (isNumeric) {
        // 短数字，同时搜索 IMEI、序列号和价格
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ? OR ABS(p.purchase_cost - ?) < 0.01)');
        queryParams.push(`%${search}%`, `%${search}%`, parseFloat(search));
      } else {
        // 非纯数字，搜索 IMEI 或序列号
        whereConditions.push('(p.imei LIKE ? OR p.serial_number LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }
    }

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(store_id);
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      queryParams.push(supplier_id);
    }

    if (operator_id) {
      whereConditions.push('p.inventory_operator_id = ?');
      queryParams.push(operator_id);
    }

    if (is_new !== undefined && is_new !== '') {
      whereConditions.push('p.is_new = ?');
      const isNewValue = is_new === '1' ? 1 : 0;
      queryParams.push(isNewValue);
    }

    // 日期筛选：支持单个日期和日期范围
    if (date) {
      // 兼容旧的单个日期参数
      whereConditions.push('DATE(p.Inventorytime) = ?');
      queryParams.push(date);
    } else if (date_start || date_end) {
      // 新的日期范围筛选
      if (date_start && date_end) {
        // 同时有开始和结束日期
        whereConditions.push('DATE(p.Inventorytime) BETWEEN ? AND ?');
        queryParams.push(date_start, date_end);
      } else if (date_start) {
        // 只有开始日期
        whereConditions.push('DATE(p.Inventorytime) >= ?');
        queryParams.push(date_start);
      } else if (date_end) {
        // 只有结束日期
        whereConditions.push('DATE(p.Inventorytime) <= ?');
        queryParams.push(date_end);
      }
    }

    if (brand) {
      const [brandResult] = await getDatabase().execute(
        'SELECT id FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
        [brand.trim()]
      );
      if (brandResult.length > 0) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(brandResult[0].id);
      } else {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(-1);
      }
    }

    if (model) {
      // 使用模糊匹配，与主接口保持一致
      const [modelResults] = await getDatabase().execute(
        'SELECT id FROM models WHERE LOWER(name) LIKE LOWER(?)',
        [`%${model.trim()}%`]
      );
      if (modelResults.length > 0) {
        const modelIds = modelResults.map(m => m.id);
        whereConditions.push(`p.model_id IN (${modelIds.map(() => '?').join(',')})`);
        queryParams.push(...modelIds);
      } else {
        whereConditions.push('p.model_id = ?');
        queryParams.push(-1);
      }
    }

    if (color) {
      const [colorResult] = await getDatabase().execute(
        'SELECT id FROM colors WHERE TRIM(name) = ?',
        [color.trim()]
      );
      if (colorResult.length > 0) {
        whereConditions.push('p.color_id = ?');
        queryParams.push(colorResult[0].id);
      } else {
        whereConditions.push('p.color_id = ?');
        queryParams.push(-1);
      }
    }

    if (memory) {
      const [memoryResult] = await getDatabase().execute(
        'SELECT id FROM memories WHERE TRIM(size) = ?',
        [memory.trim()]
      );
      if (memoryResult.length > 0) {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(memoryResult[0].id);
      } else {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(-1);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // 计算统计数据
    // 1. 库存总价值
    const [totalValueResult] = await getDatabase().execute(`
      SELECT COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      WHERE ${whereClause}
    `, queryParams);

    // 2. 今日出库数量（需要从销售记录表获取）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaySoldResult] = await getDatabase().execute(`
      SELECT COUNT(*) as today_sold
      FROM phones
      WHERE status = 'sold'
        AND salestime >= ?
        ${supplier_id ? 'AND supplier_id = ?' : ''}
        ${store_id ? 'AND store_id = ?' : ''}
    `, supplier_id || store_id
      ? [todayStart, ...(supplier_id ? [supplier_id] : []), ...(store_id ? [store_id] : [])]
      : [todayStart]
    );

    // 3. 平均利润率（根据销售价和成本价计算）
    const [profitMarginResult] = await getDatabase().execute(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(
          CASE
            WHEN p.sale_price > 0 AND p.purchase_cost > 0
            THEN ((p.sale_price - p.purchase_cost) / p.sale_price) * 100
            ELSE 0
          END
        ), 0) as total_profit_margin
      FROM phones p
      WHERE ${whereClause}
        AND p.sale_price > 0
        AND p.purchase_cost > 0
    `, queryParams);

    const avgProfitMargin = profitMarginResult[0].count > 0
      ? profitMarginResult[0].total_profit_margin / profitMarginResult[0].count
      : 0;

    res.json({
      success: true,
      message: '获取统计数据成功',
      data: {
        total_value: parseFloat(totalValueResult[0].total_value) || 0,
        today_sold: todaySoldResult[0].today_sold || 0,
        avg_profit_margin: avgProfitMargin
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

// 根据手机号查找客户
router.get('/customer/phone/:phone', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const { phone } = req.params;

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.json({
        success: false,
        message: '手机号格式不正确',
        data: null
      });
    }

    // 查询客户
    const [customers] = await getDatabase().execute(
      'SELECT id, name, phone, apple_id, created_at FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1',
      [phone]
    );

    if (customers.length > 0) {
      const customer = customers[0];
      res.json({
        success: true,
        message: '找到客户',
        data: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          apple_id: customer.apple_id,
          created_at: customer.created_at
        }
      });
    } else {
      res.json({
        success: true,
        message: '未找到客户',
        data: null
      });
    }
  } catch (error) {
    log.error('❌ 查找客户失败:', error);
    res.status(500).json({
      success: false,
      message: '查找客户失败',
      error: error.message
    });
  }
});

// 搜索客户（支持手机号和姓名搜索）
router.get('/customers', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const { search } = req.query;
    const pool = getDatabase();

    if (!search || search.length < 2) {
      return res.json({
        success: true,
        message: '获取客户列表成功',
        data: []
      });
    }

    // 判断是手机号还是姓名
    const isNumeric = /^\d+$/.test(search);

    let query, params;

    if (isNumeric) {
      // 手机号搜索
      query = `
        SELECT id, name, phone, apple_id, member_number, vip_level, created_at
        FROM customers
        WHERE phone LIKE ?
        ORDER BY created_at DESC
        LIMIT 10
      `;
      params = [`%${search}%`];
    } else {
      // 姓名搜索
      query = `
        SELECT id, name, phone, apple_id, member_number, vip_level, created_at
        FROM customers
        WHERE name LIKE ?
        ORDER BY created_at DESC
        LIMIT 10
      `;
      params = [`%${search}%`];
    }

    const [customers] = await pool.execute(query, params);

    res.json({
      success: true,
      message: '搜索客户成功',
      data: customers
    });
  } catch (error) {
    log.error('❌ 搜索客户失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索客户失败',
      error: error.message
    });
  }
});

// 库存统计表 - 按供应商、品牌、型号、颜色、内存、机况聚合统计
router.get('/inventory-summary', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  try {
    const {
      supplier_id,
      store_id,
      brand,
      model,
      color,
      memory,
      is_new,
      date_start,
      date_end
    } = req.query;

    // 构建查询条件
    let whereConditions = ['p.status = "in_stock"'];
    let queryParams = [];

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      queryParams.push(store_id);
    }

    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      queryParams.push(supplier_id);
    }

    if (is_new !== undefined && is_new !== '') {
      whereConditions.push('p.is_new = ?');
      const isNewValue = is_new === '1' ? 1 : 0;
      queryParams.push(isNewValue);
    }

    // 日期范围筛选
    if (date_start && date_end) {
      whereConditions.push('DATE(p.Inventorytime) BETWEEN ? AND ?');
      queryParams.push(date_start, date_end);
    } else if (date_start) {
      whereConditions.push('DATE(p.Inventorytime) >= ?');
      queryParams.push(date_start);
    } else if (date_end) {
      whereConditions.push('DATE(p.Inventorytime) <= ?');
      queryParams.push(date_end);
    }

    // 品牌筛选
    if (brand) {
      const [brandResult] = await getDatabase().execute(
        'SELECT id FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
        [brand.trim()]
      );
      if (brandResult.length > 0) {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(brandResult[0].id);
      } else {
        whereConditions.push('p.brand_id = ?');
        queryParams.push(-1);
      }
    }

    // 型号筛选
    if (model) {
      const [modelResults] = await getDatabase().execute(
        'SELECT id FROM models WHERE LOWER(name) LIKE LOWER(?)',
        [`%${model.trim()}%`]
      );
      if (modelResults.length > 0) {
        const modelIds = modelResults.map(m => m.id);
        whereConditions.push(`p.model_id IN (${modelIds.map(() => '?').join(',')})`);
        queryParams.push(...modelIds);
      } else {
        whereConditions.push('p.model_id = ?');
        queryParams.push(-1);
      }
    }

    // 颜色筛选
    if (color) {
      const [colorResult] = await getDatabase().execute(
        'SELECT id FROM colors WHERE LOWER(TRIM(name)) = LOWER(?)',
        [color.trim()]
      );
      if (colorResult.length > 0) {
        whereConditions.push('p.color_id = ?');
        queryParams.push(colorResult[0].id);
      } else {
        whereConditions.push('p.color_id = ?');
        queryParams.push(-1);
      }
    }

    // 内存筛选
    if (memory) {
      const [memoryResult] = await getDatabase().execute(
        'SELECT id FROM memories WHERE TRIM(size) = ?',
        [memory.trim()]
      );
      if (memoryResult.length > 0) {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(memoryResult[0].id);
      } else {
        whereConditions.push('p.memory_id = ?');
        queryParams.push(-1);
      }
    }

    const whereClause = whereConditions.join(' AND ');

    // 聚合查询 - 按供应商、店铺、品牌、型号、颜色、内存、机况分组统计
    const query = `
      SELECT
        supp.id as supplier_id,
        supp.name as supplier_name,
        s.id as store_id,
        s.name as store_name,
        b.name as brand,
        m.name as model,
        c.name as color,
        mem.size as memory,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as \`condition\`,
        COUNT(*) as quantity,
        MIN(DATE(p.Inventorytime)) as earliest_date,
        MAX(DATE(p.Inventorytime)) as latest_date
      FROM phones p
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE ${whereClause}
      GROUP BY
        supp.id, supp.name,
        s.id, s.name,
        b.id, b.name,
        m.id, m.name,
        c.id, c.name,
        mem.id, mem.size,
        p.is_new
      ORDER BY
        supp.name,
        s.name,
        b.name,
        -- 提取型号中的数字作为系列号进行排序（如 iPhone 15 -> 15, iPhone 16 -> 16）
        CAST(SUBSTRING(m.name, LOCATE(' ', m.name) + 1) AS UNSIGNED) ASC,
        m.name ASC,
        c.name,
        mem.size DESC,
        p.is_new DESC
    `;

    const [results] = await getDatabase().execute(query, queryParams);

    res.json({
      success: true,
      message: '获取库存统计成功',
      data: results
    });

  } catch (error) {
    log.error('❌ 获取库存统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存统计失败',
      error: error.message
    });
  }
});

/**
 * 获取库存明细（优化版 - 使用 ID 查询，避免 LIKE 模糊匹配）
 * GET /api/sales/inventory-detail
 * 查询参数: supplier_id, store_id, brand, model, color, memory, condition, limit
 */
router.get('/inventory-detail', unifiedAuth, requirePermission('sales:view'), async (req, res) => {
  const {
    supplier_id,
    store_id,
    brand,
    model,
    color,
    memory,
    condition,
    limit = 500
  } = req.query;

  try {
    // 验证必需参数（只有 brand 是必需的）
    if (!brand) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: brand'
      });
    }

    // 将 condition 转换为 is_new（如果提供）
    let is_new = null;
    if (condition && condition.trim()) {
      is_new = condition === '全新' ? 1 : 0;
    }

    // 将字符串ID转换为数字
    const numericSupplierId = supplier_id ? parseInt(supplier_id) : null;
    const numericStoreId = store_id ? parseInt(store_id) : null;

    // 通过品牌名称查找品牌ID
    const [brandResults] = await getDatabase().execute(
      'SELECT id FROM brands WHERE name = ? LIMIT 1',
      [brand]
    );

    if (brandResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: `未找到品牌: ${brand}`
      });
    }

    const brandId = brandResults[0].id;
    let modelId = null;
    let colorId = null;
    let memoryId = null;

    // 只有当 model 不为空时才查找型号ID
    if (model && model.trim()) {
      const [modelResults] = await getDatabase().execute(
        'SELECT id FROM models WHERE name = ? LIMIT 1',
        [model]
      );
      if (modelResults.length > 0) {
        modelId = modelResults[0].id;
      }
    }

    // 只有当 color 不为空时才查找颜色ID
    if (color && color.trim()) {
      const [colorResults] = await getDatabase().execute(
        'SELECT id FROM colors WHERE name = ? LIMIT 1',
        [color]
      );
      if (colorResults.length > 0) {
        colorId = colorResults[0].id;
      }
    }

    // 只有当 memory 不为空时才查找内存ID
    if (memory && memory.trim()) {
      const [memoryResults] = await getDatabase().execute(
        'SELECT id FROM memories WHERE size = ? LIMIT 1',
        [memory.trim()]
      );
      if (memoryResults.length > 0) {
        memoryId = memoryResults[0].id;
      }
    }

    // 构建动态查询条件
    const conditions = ["p.status = 'in_stock'"];
    const queryParams = [];

    // supplier_id 条件
    if (numericSupplierId !== null && !isNaN(numericSupplierId)) {
      conditions.push('p.supplier_id = ?');
      queryParams.push(numericSupplierId);
    }

    // store_id 条件
    if (numericStoreId !== null && !isNaN(numericStoreId)) {
      conditions.push('p.store_id = ?');
      queryParams.push(numericStoreId);
    }

    // brand_id 条件（必需）
    conditions.push('p.brand_id = ?');
    queryParams.push(brandId);

    // model_id 条件（可选）
    if (modelId !== null) {
      conditions.push('p.model_id = ?');
      queryParams.push(modelId);
    } else {
      conditions.push('p.model_id IS NULL');
    }

    // color_id 条件（可选）
    if (colorId !== null) {
      conditions.push('p.color_id = ?');
      queryParams.push(colorId);
    } else {
      conditions.push('p.color_id IS NULL');
    }

    // memory_id 条件（可选）
    if (memoryId !== null) {
      conditions.push('p.memory_id = ?');
      queryParams.push(memoryId);
    } else {
      conditions.push('p.memory_id IS NULL');
    }

    // is_new 条件（可选）
    if (is_new !== null) {
      conditions.push('p.is_new = ?');
      queryParams.push(is_new);
    }

    const whereClause = conditions.join(' AND ');

    // 优化查询: 使用精确ID匹配而不是字符串比较
    const query = '' +
      'SELECT ' +
      '  p.id, ' +
      '  p.imei, ' +
      '  p.serial_number, ' +
      '  p.supplier_id, ' +
      '  supp.name as supplier_name, ' +
      '  p.store_id, ' +
      '  s.name as store_name, ' +
      '  p.brand_id, ' +
      '  b.name as brand, ' +
      '  p.model_id, ' +
      '  m.name as model, ' +
      '  p.color_id, ' +
      '  c.name as color, ' +
      '  p.memory_id, ' +
      '  mem.size as memory, ' +
      '  p.is_new, ' +
      "  CASE WHEN p.is_new = 1 THEN '全新' ELSE '二手' END as `condition`, " +
      '  p.Inventorytime, ' +
      '  p.purchase_cost, ' +
      '  p.sale_price, ' +
      '  p.status, ' +
      '  DATEDIFF(CURDATE(), DATE(p.Inventorytime)) as inventory_days ' +
      'FROM phones p ' +
      'LEFT JOIN suppliers supp ON p.supplier_id = supp.id ' +
      'LEFT JOIN stores s ON p.store_id = s.id ' +
      'LEFT JOIN brands b ON p.brand_id = b.id ' +
      'LEFT JOIN models m ON p.model_id = m.id ' +
      'LEFT JOIN colors c ON p.color_id = c.id ' +
      'LEFT JOIN memories mem ON p.memory_id = mem.id ' +
      `WHERE ${whereClause} ` +
      'ORDER BY inventory_days DESC ' +
      'LIMIT ?';

    queryParams.push(parseInt(limit));

    const [results] = await getDatabase().query(query, queryParams);

    res.json({
      success: true,
      data: results,
      message: '获取库存明细成功'
    });

  } catch (error) {
    log.error('❌ 获取库存明细失败:', error);
    res.status(500).json({
      success: false,
      message: '获取库存明细失败',
      error: error.message
    });
  }
});


module.exports = router;
