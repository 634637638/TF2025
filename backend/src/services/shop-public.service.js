/**
 * H5商城公开服务 - 用户端（无需认证）
 * 功能：商品展示、购物车、下单
 */

const db = require('../config/database');
const log = require('../utils/log');

class ShopPublicService {
  // ============================================================================
  // 商城配置（公开）
  // ============================================================================

  /**
   * 获取公开配置（用户端需要的信息）
   */
  async getPublicConfig() {
    const query = `
      SELECT config_key, config_value, config_type
      FROM H5_config
      WHERE category IN ('general', 'contact', 'payment', 'cart', 'banner')
      ORDER BY config_key
    `;
    const [configs] = await db.getDatabase().query(query);

    // 转换为键值对对象
    const result = {};
    configs.forEach(config => {
      result[config.config_key] = this.parseConfigValue(config.config_value, config.config_type);
    });

    // 确保地图坐标字段存在（如果数据库中没有，使用默认值）
    if (!result.map_latitude) result.map_latitude = '';
    if (!result.map_longitude) result.map_longitude = '';

    return result;
  }

  /**
   * 获取启用的轮播图
   */
  async getActiveBanners() {
    const query = `
      SELECT
        id, title, image_url, link_url, link_type, sort_order, status,
        start_time, end_time, \`interval\`,
        images
      FROM H5_banners
      WHERE status = 'active'
        AND (start_time IS NULL OR start_time <= NOW())
        AND (end_time IS NULL OR end_time >= NOW())
      ORDER BY sort_order ASC
    `;
    const [banners] = await db.getDatabase().query(query);

    // 解析 images JSON 字段
    return banners.map(banner => ({
      ...banner,
      interval: banner.interval,
      images: banner.images ? (typeof banner.images === 'string' ? JSON.parse(banner.images) : banner.images) : null
    }));
  }

  // ============================================================================
  // 商品展示
  // ============================================================================

  /**
   * 获取商品列表
   */
  async getProducts({ page, limit, brand_id, model_id, color_id, memory_id, is_new, search, sort, order }) {
    const offset = (page - 1) * limit;

    log.debug('[getProducts] 输入参数:', { page, limit, brand_id, model_id, color_id, memory_id, is_new, search, sort, order });
    log.debug('[getProducts] is_new 值和类型:', is_new, typeof is_new);
    log.debug('[getProducts] is_new === true:', is_new === true);

    // 如果查询全新机，先查询模板，如果没有模板数据则查询 phones 表
    if (is_new === true) {
      log.debug('[getProducts] 调用 getNewProductsFromTemplates');
      const templateResult = await this.getNewProductsFromTemplates({ page, limit, brand_id, model_id, color_id, search, sort, order });

      // 如果模板查询返回空数据，尝试从 phones 表查询全新机
      if (!templateResult.data || templateResult.data.length === 0) {
        log.debug('[getProducts] 模板无数据，从 phones 表查询全新机');
        // 继续 phones 表查询
      } else {
        return templateResult;
      }
    }

    // 二手机直接查询
    // 构建查询条件
    let whereClause = 'WHERE p.status = "in_stock"';
    const params = [];

    // 🔧 修复：明确添加 is_new = 0 的条件
    if (is_new === false) {
      whereClause += ' AND p.is_new = 0';
      // 二手机：过滤已下架商品（只显示上架或没有H5记录的）
      whereClause += ' AND (h5.is_published = 1 OR h5.is_published IS NULL)';
      log.debug('[getProducts] 添加二手机筛选条件: p.is_new = 0, is_published过滤');
    } else if (is_new === true) {
      whereClause += ' AND p.is_new = 1';
      // 全新机：同样过滤已下架商品
      whereClause += ' AND (h5.is_published = 1 OR h5.is_published IS NULL)';
      log.debug('[getProducts] 添加全新机筛选条件: p.is_new = 1, is_published过滤');
    }
    // is_new === null 时不添加条件，查询所有商品

    if (brand_id) {
      whereClause += ' AND p.brand_id = ?';
      params.push(brand_id);
    }

    if (model_id) {
      whereClause += ' AND p.model_id = ?';
      params.push(model_id);
    }

    if (color_id) {
      whereClause += ' AND p.color_id = ?';
      params.push(color_id);
    }

    if (memory_id) {
      whereClause += ' AND p.memory_id = ?';
      params.push(memory_id);
    }

    // is_new 条件已在上面处理

    if (search) {
      whereClause += ' AND (b.name LIKE ? OR m.name LIKE ? OR c.name LIKE ? OR mem.size LIKE ? OR p.imei LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 排序映射 - 只读取 H5_product.sale_price
    const sortMap = {
      'created_at': 'p.Inventorytime',
      'price': 'h5.sale_price',
      'price_asc': 'h5.sale_price',
      'price_desc': 'h5.sale_price'
    };

    const sortField = sortMap[sort] || 'p.Inventorytime';
    const sortDirection = sort === 'price_asc' ? 'ASC' : (sort === 'price_desc' ? 'DESC' : order);

    // 查询总数
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      ${whereClause}
    `;
    log.debug('[getProducts] 二手机查询SQL:', countQuery);
    log.debug('[getProducts] 二手机查询参数:', params);
    const [countResult] = await db.getDatabase().query(countQuery, params);
    const total = countResult[0].total;
    log.debug('[getProducts] 二手机总数:', total);

    // 查询商品数据
    const query = `
      SELECT
        p.id,
        p.imei,
        p.is_new,
        h5.sale_price,
        p.quality_grade,
        p.Inventorytime as created_at,
        h5.condition_grade,
        b.id as brand_id,
        b.name as brand_name,
        m.id as model_id,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name,
        s.name as store_name,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url
            FROM H5_images
            WHERE phone_id = p.id
            ORDER BY is_primary DESC, sort_order ASC, id ASC
            LIMIT 1
          )
        END as main_image
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN price_list pl ON pl.brand_id = p.brand_id
        AND pl.model_id = p.model_id
        AND pl.color_id = c.id
        AND pl.memory_id = mem.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const [products] = await db.getDatabase().query(query, [...params, limit, offset]);

    // 为每个商品获取所有图片
    for (const product of products) {
      let images;
      if (product.is_new === 1) {
        // 全新机：从模板获取图片
        const [templates] = await db.getDatabase().query(
          'SELECT id FROM H5_newtemplates WHERE brand_id = ? AND model_id = ? AND color_id = ?',
          [product.brand_id, product.model_id, product.color_id]
        );
        if (templates.length > 0) {
          const templateId = templates[0].id;
          [images] = await db.getDatabase().query(
            'SELECT image_url FROM H5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
            [templateId]
          );
        } else {
          images = [];
        }
      } else {
        // 二手机：从 H5_images 表获取图片
        [images] = await db.getDatabase().query(
          'SELECT image_url, image_type FROM H5_images WHERE phone_id = ? ORDER BY is_primary DESC, sort_order',
          [product.id]
        );
      }

      // 统一图片格式
      product.images = images.map(img => img.image_url);

      // 如果没有主图但有图片，使用第一张图片作为主图
      if (!product.main_image && images.length > 0) {
        product.main_image = images[0].image_url;
      }
    }

    return {
      data: products,
      page,
      limit,
      total
    };
  }

  /**
   * 从模板获取全新机商品列表（聚合显示）
   */
  async getNewProductsFromTemplates({ page, limit, brand_id, model_id, color_id, search, sort, order }) {
    log.debug('[getNewProductsFromTemplates] 调用参数:', { page, limit, brand_id, model_id, color_id, search, sort, order });
    const offset = (page - 1) * limit;

    // 构建查询条件 - 显示已上架到H5的模板（无论有无库存）
    let whereClause = 'WHERE t.is_active = TRUE AND t.is_published = 1';
    // 不再强制要求有库存，模板上架即可显示
    const params = [];

    if (brand_id) {
      whereClause += ' AND t.brand_id = ?';
      params.push(brand_id);
    }

    if (model_id) {
      whereClause += ' AND t.model_id = ?';
      params.push(model_id);
    }

    if (color_id) {
      whereClause += ' AND t.color_id = ?';
      params.push(color_id);
    }

    if (search) {
      whereClause += ' AND (b.name LIKE ? OR m.name LIKE ? OR c.name LIKE ? OR t.template_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 排序映射（对于模板，使用sort_order）
    const sortField = sort === 'price' || sort === 'price_asc' || sort === 'price_desc'
      ? '(SELECT MIN(p.sale_price) FROM phones p LEFT JOIN H5_product h5 ON p.id = h5.phone_id WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id AND p.is_new = 1 AND p.status = "in_stock" AND (h5.is_published = 1 OR h5.is_published IS NULL))'
      : 't.sort_order';
    const sortDirection = sort === 'price_asc' ? 'ASC' : (sort === 'price_desc' ? 'DESC' : 'ASC');

    // 查询总数
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      ${whereClause}
    `;
    const [countResult] = await db.getDatabase().query(countQuery, params);
    const total = countResult[0].total;

    // 查询模板数据
    const query = `
      SELECT
        t.id,
        t.template_name,
        t.description,
        t.brand_id,
        t.model_id,
        t.color_id,
        t.memory_ids,
        t.sale_price,
        t.price_markup,
        t.price_markup_type,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1) as main_image,
        (SELECT MIN(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND (t.memory_ids IS NULL OR JSON_CONTAINS(t.memory_ids, CAST(pl.memory_id AS JSON)))
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as min_retail_price,
        (SELECT COUNT(*) FROM phones p LEFT JOIN H5_product h5 ON p.id = h5.phone_id WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id AND p.is_new = 1 AND p.status = "in_stock" AND (h5.is_published = 1 OR h5.is_published IS NULL)) as stock_count,
        t.sort_order
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const [products] = await db.getDatabase().query(query, [...params, limit, offset]);

    // 为每个模板获取所有图片和价格选项
    for (const product of products) {
      const [images] = await db.getDatabase().query(
        'SELECT image_url FROM H5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
        [product.id]
      );
      product.images = images.map(img => img.image_url);

      // 如果没有主图但有图片，使用第一张图片作为主图
      if (!product.main_image && images.length > 0) {
        product.main_image = images[0].image_url;
      }

      // H5销售价：直接使用 price_list.retail_price（已经是最终销售价：采集价+加价）
      if (product.min_retail_price) {
        product.sale_price = parseFloat(product.min_retail_price);
        log.debug('[H5价格] 模板ID:', product.id, '销售价:', product.sale_price);
      } else {
        // 没有采集价格，显示"电询"
        product.sale_price = 0;
        log.debug('[H5价格] 模板ID:', product.id, '无采集价格 - 显示电询');
      }

      // 获取该模板所有内存规格的价格详情（用于详情页展示）
      let memoryList = null;
      if (product.memory_ids) {
        try {
          // 处理 memory_ids 可能是 JSON 字符串或已经是数组的情况
          if (typeof product.memory_ids === 'string') {
            memoryList = JSON.parse(product.memory_ids);
          } else if (Array.isArray(product.memory_ids)) {
            memoryList = product.memory_ids;
          }
        } catch (error) {
          log.error('[H5价格] 解析 memory_ids 失败:', product.memory_ids, error);
          memoryList = null;
        }
      }

      let whereClause = 'AND pl.brand_id = ? AND pl.model_id = ? AND pl.color_id = ?';
      const queryParams = [product.brand_id, product.model_id, product.color_id];

      if (memoryList && memoryList.length > 0) {
        // 使用 FIND_IN_SET 或者构建 IN 条件
        whereClause += ` AND pl.memory_id IN (${memoryList.map(() => '?').join(',')})`;
        queryParams.push(...memoryList);
      }

      const [memoryPrices] = await db.getDatabase().query(`
        SELECT pl.memory_id, mem.size as memory_name,
               pl.retail_price as sale_price, pl.wholesale_price as base_price
        FROM price_list pl
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        WHERE 1=1 ${whereClause}
          AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ORDER BY pl.memory_id
      `, queryParams);

      // 构建价格选项
      product.price_options = memoryPrices.map(mp => ({
        memory_id: mp.memory_id,
        memory_name: mp.memory_name,
        base_price: parseFloat(mp.base_price),
        sale_price: parseFloat(mp.sale_price)
      }));

      // 删除临时字段
      delete product.min_retail_price;
      delete product.price_markup;
      delete product.price_markup_type;
      delete product.memory_ids;

      product.is_new = 1; // 标记为全新机
    }

    return {
      data: products,
      page,
      limit,
      total
    };
  }

  /**
   * 获取商品详情
   */
  async getProductDetail(productId) {
    log.debug('[getProductDetail] 查询商品详情，ID:', productId);

    // 首先检查是否为模板ID（H5_newtemplates表）
    const templateQuery = `
      SELECT
        t.id,
        t.template_name,
        t.description,
        t.brand_id,
        t.model_id,
        t.color_id,
        t.memory_ids,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        (SELECT image_url FROM H5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1) as main_image,
        (SELECT MIN(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND (t.memory_ids IS NULL OR JSON_CONTAINS(t.memory_ids, CAST(pl.memory_id AS JSON)))
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as min_retail_price,
        (SELECT COUNT(*) FROM phones p LEFT JOIN H5_product h5 ON p.id = h5.phone_id WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id AND p.is_new = 1 AND p.status = "in_stock" AND (h5.is_published = 1 OR h5.is_published IS NULL)) as stock_count
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      WHERE t.id = ? AND t.is_active = TRUE
    `;

    const [templates] = await db.getDatabase().query(templateQuery, [productId]);

    if (templates.length > 0) {
      log.debug('[getProductDetail] 找到模板商品:', templates[0].template_name);
      const template = templates[0];

      // 获取模板的所有图片
      const [images] = await db.getDatabase().query(
        'SELECT image_url FROM H5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
        [productId]
      );

      // 获取价格选项
      let priceOptions = [];
      try {
        // 获取所有内存列表（用于显示所有可用的内存规格）
        const [allMemories] = await db.getDatabase().query('SELECT id, size FROM memories ORDER BY sort_order ASC, id ASC');

        // 确定要查询的内存列表
        let memoryList = [];
        if (template.memory_ids) {
          memoryList = typeof template.memory_ids === 'string' ? JSON.parse(template.memory_ids) : template.memory_ids;
        }

        // 如果模板没有指定内存，或者指定为空，则使用所有内存
        if (!memoryList || memoryList.length === 0) {
          memoryList = allMemories.map(m => m.id);
        }

        if (memoryList && memoryList.length > 0) {
          const placeholders = memoryList.map(() => '?').join(',');
          const priceQuery = `
            SELECT pl.memory_id, mem.size as memory_name,
                   pl.retail_price as display_price
            FROM price_list pl
            LEFT JOIN memories mem ON pl.memory_id = mem.id
            WHERE pl.brand_id = ? AND pl.model_id = ? AND pl.color_id = ?
              AND pl.memory_id IN (${placeholders})
              AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
            ORDER BY pl.memory_id
          `;
          const [prices] = await db.getDatabase().query(priceQuery, [template.brand_id, template.model_id, template.color_id, ...memoryList]);
          priceOptions = prices;

          log.debug('[getProductDetail] 模板ID:', productId, '获取到', priceOptions.length, '个价格选项:', priceOptions);
        }
      } catch (error) {
        log.error('[getProductDetail] 获取价格选项失败:', error);
      }

      return {
        ...template,
        images: images.map((img, index) => ({
          id: index,
          image_url: img.image_url,
          image_type: 'other',
          is_primary: index === 0
        })),
        price_options: priceOptions,
        is_new: 1,
        sale_price: template.min_retail_price || 0
      };
    }

    // 如果不是模板ID，查询普通商品（phones表）
    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.quality_grade,
        h5.sale_price as actual_sale_price,
        p.purchase_cost,
        p.Inventorytime as created_at,
        p.remarks,
        b.id as brand_id,
        b.name as brand_name,
        m.id as model_id,
        m.name as model_name,
        c.id as color_id,
        c.name as color_name,
        mem.id as memory_id,
        mem.size as memory_name,
        s.id as store_id,
        s.name as store_name,
        s.location as store_address,
        s.phone as store_phone,
        pl.retail_price as display_price,
        pl.wholesale_price
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN price_list pl ON pl.brand_id = p.brand_id
        AND pl.model_id = p.model_id
        AND pl.color_id = c.id
        AND pl.memory_id = mem.id
      WHERE p.id = ? AND p.status = 'in_stock'
        AND (h5.is_published = 1 OR h5.is_published IS NULL)
    `;

    const [products] = await db.getDatabase().query(query, [productId]);

    if (products.length === 0) {
      log.debug('[getProductDetail] 商品不存在');
      return null;
    }

    const product = products[0];
    log.debug('[getProductDetail] 商品基本信息:', { id: product.id, is_new: product.is_new, brand_id: product.brand_id, model_id: product.model_id, color_id: product.color_id });

    // 🔥 价格显示逻辑：全新机和二手机使用不同来源
    // 全新机：使用 price_list.retail_price（根据价目表）
    // 二手机：使用 H5_product.sale_price（上架时手动设置）
    if (product.is_new === 1) {
      // 全新机：使用 price_list.retail_price
      if (product.display_price && product.display_price > 0) {
        product.sale_price = product.display_price;
        log.debug('[getProductDetail] 全新机，使用 price_list 零售价:', product.sale_price);
      } else {
        // 全新机没有价格，显示"电询"
        product.sale_price = 0;
        product.show_contact = true;
        log.debug('[getProductDetail] 全新机没有零售价，显示电询');
      }
    } else {
      // 二手机：稍后从 H5_product 获取价格
      log.debug('[getProductDetail] 二手机，等待从 H5_product 获取价格');
      product.sale_price = 0;
      product.show_contact = true;
    }

    // 获取商品图片
    let images;
    if (product.is_new === 1) {
      log.debug('[getProductDetail] 全新机商品，查询模板图片');
      // 全新机：查询模板图片
      // 首先获取对应的模板
      const [templates] = await db.getDatabase().query(
        'SELECT id FROM H5_newtemplates WHERE brand_id = ? AND model_id = ? AND color_id = ?',
        [product.brand_id, product.model_id, product.color_id]
      );
      log.debug('[getProductDetail] 查询到的模板:', templates);

      if (templates.length > 0) {
        const templateId = templates[0].id;
        log.debug('[getProductDetail] 使用模板ID:', templateId, '查询图片');
        const [imageRows] = await db.getDatabase().query(
          'SELECT image_url, "other" as image_type FROM H5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
          [templateId]
        );
        images = imageRows;
        log.debug('[getProductDetail] 查询到的图片数量:', images.length);
        log.debug('[getProductDetail] 图片列表:', images);
      } else {
        log.debug('[getProductDetail] 未找到对应的模板');
        images = [];
      }
    } else {
      // 二手机：查询 H5_images 表
      const [imageRows] = await db.getDatabase().query(
        'SELECT * FROM H5_images WHERE phone_id = ? ORDER BY sort_order ASC, is_primary DESC',
        [productId]
      );
      images = imageRows;
    }
    product.images = images;

    // 获取商品验机信息
    const [inspections] = await db.getDatabase().query(
      'SELECT * FROM H5_product WHERE phone_id = ?',
      [productId]
    );

    if (inspections.length > 0) {
      const inspection = inspections[0];

      // 屏幕状况枚举值转中文
      const screenConditionMap = {
        'original': '全原',
        'replaced_original': '换原屏',
        'domestic': '国产屏幕',
        'replaced_glass': '原换盖板'
      };

      // 将成色添加到商品对象
      product.condition_grade = inspection.condition_grade;

      // 🔥 二手机：使用 H5_product.sale_price（上架时设置的价格）
      if (inspection.sale_price !== null && inspection.sale_price !== undefined && inspection.sale_price > 0) {
        product.sale_price = inspection.sale_price;
        log.debug('[getProductDetail] 二手机，使用 H5_product 零售价:', product.sale_price);
      } else {
        // 二手机没有设置价格，显示"电询"
        product.sale_price = 0;
        product.show_contact = true; // 前端用于显示"电询"
        log.debug('[getProductDetail] 二手机没有设置价格，显示电询');
      }

      product.inspection = {
        condition_grade: inspection.condition_grade,
        battery_status: inspection.battery_status,
        screen_condition: inspection.screen_condition,
        screen_condition_text: screenConditionMap[inspection.screen_condition] || inspection.screen_condition,
        system_version: inspection.system_version,
        model_version: inspection.model_version,
        warranty_date: inspection.warranty_date,
        is_warranty_expired: inspection.is_warranty_expired,
        sale_price: inspection.sale_price
      };
    }

    return product;
  }

  /**
   * 获取商品图片
   */
  async getProductImages(productId) {
    const query = `
      SELECT * FROM H5_images
      WHERE phone_id = ?
      ORDER BY is_primary DESC, sort_order ASC
    `;
    const [images] = await db.getDatabase().query(query, [productId]);
    return images;
  }

  /**
   * 获取模板下的商品列表（按内存分组）
   */
  async getTemplatePhones(templateId) {
    // 首先获取模板信息
    const [templates] = await db.getDatabase().query(
      'SELECT * FROM H5_newtemplates WHERE id = ? AND is_active = TRUE',
      [templateId]
    );

    if (templates.length === 0) {
      return null;
    }

    const template = templates[0];

    // 获取匹配该模板的所有商品（全新机，在库）
    const query = `
      SELECT
        p.id,
        p.imei,
        p.is_new,
        p.sale_price,
        p.quality_grade,
        p.status,
        mem.id as memory_id,
        mem.size as memory_name,
        s.id as store_id,
        s.name as store_name,
        (SELECT image_url FROM H5_newimages WHERE template_id = ? AND is_primary = 1 LIMIT 1) as main_image
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.brand_id = ? AND p.model_id = ? AND p.color_id = ?
        AND p.is_new = 1 AND p.status = 'in_stock' AND (h5.is_published = 1 OR h5.is_published IS NULL)
      ORDER BY p.sale_price ASC
    `;

    const [phones] = await db.getDatabase().query(query, [
      templateId,
      template.brand_id,
      template.model_id,
      template.color_id
    ]);

    return {
      template,
      phones
    };
  }

  /**
   * 搜索商品
   */
  async searchProducts(keyword, { page, limit }) {
    return this.getProducts({
      page,
      limit,
      search: keyword,
      sort: 'created_at',
      order: 'DESC'
    });
  }

  // ============================================================================
  // 分类数据
  // ============================================================================

  async getBrands(includeEmpty = false) {
    let query = `
      SELECT b.id, b.name,
             COUNT(DISTINCT p.id) as product_count
      FROM brands b
      LEFT JOIN phones p ON b.id = p.brand_id AND p.status = 'in_stock'
      GROUP BY b.id
    `;

    // 只在有商品时过滤
    if (!includeEmpty) {
      query += ` HAVING product_count > 0`;
    }

    query += `
      ORDER BY b.sort_order ASC, b.name ASC
    `;
    const [brands] = await db.getDatabase().query(query);
    return brands;
  }

  async getModels(brandId = null, includeEmpty = false) {
    let query = `
      SELECT m.id, m.name, m.brand_id,
             COUNT(DISTINCT p.id) as product_count
      FROM models m
      LEFT JOIN phones p ON m.id = p.model_id AND p.status = 'in_stock'
    `;

    const params = [];

    if (brandId) {
      query += ' WHERE m.brand_id = ?';
      params.push(brandId);
    }

    query += `
      GROUP BY m.id
    `;

    // 只在有商品时过滤
    if (!includeEmpty) {
      query += ` HAVING product_count > 0`;
    }

    query += `
      ORDER BY m.name ASC
    `;

    const [models] = await db.getDatabase().query(query, params);
    return models;
  }

  async getColors(includeEmpty = false) {
    let query = `
      SELECT c.id, c.name,
             COUNT(DISTINCT p.id) as product_count
      FROM colors c
      LEFT JOIN phones p ON c.id = p.color_id AND p.status = 'in_stock'
      GROUP BY c.id
    `;

    // 只在有商品时过滤
    if (!includeEmpty) {
      query += ` HAVING product_count > 0`;
    }

    query += `
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    const [colors] = await db.getDatabase().query(query);
    return colors;
  }

  async getMemories() {
    const query = `
      SELECT m.id, m.size as name
      FROM memories m
      ORDER BY m.sort_order ASC, m.size ASC
    `;
    const [memories] = await db.getDatabase().query(query);
    return memories;
  }

  // ============================================================================
  // 购物车
  // ============================================================================

  /**
   * 获取购物车
   */
  async getCart(cartId) {
    const query = `
      SELECT
        c.id as cart_id,
        c.quantity,
        p.id,
        CASE
          WHEN p.is_new = 1 THEN COALESCE(pl.retail_price, 0)
          ELSE COALESCE(h5.sale_price, 0)
        END as sale_price,
        p.is_new,
        b.name as brand_name,
        m.name as model_name,
        col.name as color_name,
        mem.size as memory_name,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url
            FROM H5_images
            WHERE phone_id = p.id
            ORDER BY is_primary DESC, sort_order ASC, id ASC
            LIMIT 1
          )
        END as image
      FROM H5_cart c
      INNER JOIN phones p ON c.phone_id = p.id AND p.status = 'in_stock'
      LEFT JOIN H5_product h5 ON h5.phone_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors col ON p.color_id = col.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN price_list pl ON pl.brand_id = p.brand_id
        AND pl.model_id = p.model_id
        AND pl.color_id = p.color_id
        AND pl.memory_id = p.memory_id
      WHERE c.cart_id = ?
      ORDER BY c.created_at DESC
    `;

    const [items] = await db.getDatabase().query(query, [cartId]);

    // 计算总价
    const total = items.reduce((sum, item) => sum + ((parseFloat(item.sale_price) || 0) * item.quantity), 0);

    return {
      items,
      total,
      count: items.length
    };
  }

  /**
   * 添加到购物车
   */
  async addToCart(cartId, phoneId, quantity) {
    // 检查商品是否存在且在库
    const [products] = await db.getDatabase().query('SELECT id FROM phones WHERE id = ? AND status = "in_stock"', [phoneId]);
    if (products.length === 0) {
      throw new Error('商品不存在或已下架');
    }

    // 检查是否已在购物车中
    const [existing] = await db.getDatabase().query(
      'SELECT id, quantity FROM H5_cart WHERE cart_id = ? AND phone_id = ?',
      [cartId, phoneId]
    );

    if (existing.length > 0) {
      // 更新数量
      await db.getDatabase().query(
        'UPDATE H5_cart SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?',
        [quantity, existing[0].id]
      );
    } else {
      // 新增
      await db.getDatabase().query(
        'INSERT INTO H5_cart (cart_id, phone_id, quantity) VALUES (?, ?, ?)',
        [cartId, phoneId, quantity]
      );
    }
  }

  /**
   * 更新购物车商品数量
   */
  async updateCartItem(cartItemId, quantity) {
    await db.getDatabase().query(
      'UPDATE H5_cart SET quantity = ?, updated_at = NOW() WHERE id = ?',
      [quantity, cartItemId]
    );
  }

  /**
   * 从购物车删除
   */
  async removeFromCart(cartItemId) {
    await db.getDatabase().query('DELETE FROM H5_cart WHERE id = ?', [cartItemId]);
  }

  /**
   * 清空购物车
   */
  async clearCart(cartId) {
    await db.getDatabase().query('DELETE FROM H5_cart WHERE cart_id = ?', [cartId]);
  }

  // ============================================================================
  // 订单
  // ============================================================================

  /**
   * 创建订单
   */
  async createOrder(orderData) {
    const { customerName, customerPhone, customerAddress, items, paymentMethod, remarks } = orderData;

    const connection = await db.getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      // 计算订单金额
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        // 获取商品信息
        const [products] = await connection.query(
          `SELECT p.id,
                  CASE
                    WHEN p.is_new = 1 THEN COALESCE(pl.retail_price, 0)
                    ELSE COALESCE(h5.sale_price, 0)
                  END as sale_price,
                  b.name as brand_name, m.name as model_name,
                  c.name as color_name, mem.size as memory_name
           FROM phones p
           LEFT JOIN H5_product h5 ON h5.phone_id = p.id
           LEFT JOIN brands b ON p.brand_id = b.id
           LEFT JOIN models m ON p.model_id = m.id
           LEFT JOIN colors c ON p.color_id = c.id
           LEFT JOIN memories mem ON p.memory_id = mem.id
           LEFT JOIN price_list pl ON pl.brand_id = p.brand_id
             AND pl.model_id = p.model_id
             AND pl.color_id = p.color_id
             AND pl.memory_id = p.memory_id
           WHERE p.id = ?`,
          [item.phoneId]
        );

        if (products.length === 0) {
          throw new Error(`商品ID ${item.phoneId} 不存在或已下架`);
        }

        const product = products[0];

        // 验证价格
        const salePrice = parseFloat(product.sale_price) || 0;
        if (salePrice <= 0) {
          throw new Error(`商品ID ${item.phoneId} 价格无效，无法下单`);
        }

        const subtotal = salePrice * item.quantity;
        totalAmount += subtotal;

        orderItems.push({
          phoneId: product.id,
          phoneInfo: {
            brand: product.brand_name,
            model: product.model_name,
            color: product.color_name,
            memory: product.memory_name
          },
          salePrice,
          quantity: item.quantity,
          subtotal
        });
      }

      // 生成订单号
      const orderNumber = await this.generateOrderNumber(connection);

      // 创建订单（24小时后过期）
      const [orderResult] = await connection.query(
        `INSERT INTO H5_orders (order_number, customer_name, customer_phone, customer_address, total_amount, payment_method, remarks, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [orderNumber, customerName, customerPhone, customerAddress, totalAmount, paymentMethod || 'other', remarks || null]
      );

      const orderId = orderResult.insertId;

      // 创建订单商品明细
      for (const item of orderItems) {
        await connection.query(
          `INSERT INTO H5_order_items (order_id, phone_id, phone_info, sale_price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.phoneId, JSON.stringify(item.phoneInfo), item.salePrice, item.quantity, item.subtotal]
        );
      }

      // 如果是从购物车下单，清空购物车
      if (orderData.cartId) {
        await connection.query('DELETE FROM H5_cart WHERE cart_id = ?', [orderData.cartId]);
      }

      await connection.commit();

      return {
        orderId,
        orderNumber,
        totalAmount,
        status: 'pending'
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 根据订单号查询订单
   */
  async getOrderByNumber(orderNumber) {
    const [orders] = await db.getDatabase().query('SELECT * FROM H5_orders WHERE order_number = ?', [orderNumber]);

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];

    // 获取订单商品，包含图片信息
    const [items] = await db.getDatabase().query(`
      SELECT
        oi.*,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url FROM H5_images WHERE phone_id = oi.phone_id AND is_primary = TRUE LIMIT 1
          )
        END as image_url
      FROM H5_order_items oi
      LEFT JOIN phones p ON oi.phone_id = p.id
      WHERE oi.order_id = ?
    `, [order.id]);

    // 解析 phone_info JSON 并添加到每个商品项
    const processedItems = items.map(item => {
      let phoneInfo = {};
      try {
        phoneInfo = typeof item.phone_info === 'string' ? JSON.parse(item.phone_info) : item.phone_info;
      } catch (e) {
        log.error('解析 phone_info 失败:', e);
      }

      // 生成商品名称
      const productName = `${phoneInfo.brand || ''} ${phoneInfo.model || ''} ${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim();

      return {
        ...item,
        phone_info: phoneInfo,
        product_name: productName,
        specs: `${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim()
      };
    });

    return {
      ...order,
      items: processedItems
    };
  }

  /**
   * 根据手机号查询订单列表
   */
  async getOrdersByPhone(phone, { page, limit }) {
    const offset = (page - 1) * limit;

    // 查询总数
    const [countResult] = await db.getDatabase().query(
      'SELECT COUNT(*) as total FROM H5_orders WHERE customer_phone = ?',
      [phone]
    );
    const total = countResult[0].total;

    // 查询数据
    const [orders] = await db.getDatabase().query(
      `SELECT * FROM H5_orders
       WHERE customer_phone = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [phone, limit, offset]
    );

    // 如果没有订单，直接返回
    if (orders.length === 0) {
      return { data: [], page, limit, total };
    }

    // 提取所有订单ID
    const orderIds = orders.map(o => o.id);

    // 批量获取所有订单的商品信息（一次查询，避免 N+1）
    const [allItems] = await db.getDatabase().query(`
      SELECT
        oi.*,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url FROM H5_images WHERE phone_id = oi.phone_id AND is_primary = TRUE LIMIT 1
          )
        END as image_url
      FROM H5_order_items oi
      LEFT JOIN phones p ON oi.phone_id = p.id
      WHERE oi.order_id IN (?)
    `, [orderIds]);

    // 在内存中按订单ID分组商品
    const itemsByOrder = {};
    allItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push(item);
    });

    // 组装订单和商品信息
    const ordersWithItems = orders.map(order => {
      const items = itemsByOrder[order.id] || [];

      // 解析 phone_info JSON 并添加到每个商品项
      const processedItems = items.map(item => {
        let phoneInfo = {};
        try {
          phoneInfo = typeof item.phone_info === 'string' ? JSON.parse(item.phone_info) : item.phone_info;
        } catch (e) {
          log.error('解析 phone_info 失败:', e);
        }

        // 生成商品名称
        const productName = `${phoneInfo.brand || ''} ${phoneInfo.model || ''} ${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim();

        return {
          ...item,
          phone_info: phoneInfo,
          product_name: productName,
          specs: `${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim()
        };
      });

      return {
        ...order,
        items: processedItems
      };
    });

    return {
      data: ordersWithItems,
      page,
      limit,
      total
    };
  }

  /**
   * 修改订单状态
   */
  async updateOrderStatus(orderId, status) {
    const [orders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return null;
    }

    await db.getDatabase().query(
      'UPDATE H5_orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, orderId]
    );

    // 返回更新后的订单
    const [updatedOrders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ?',
      [orderId]
    );

    return updatedOrders[0];
  }

  /**
   * 用户确认支付（用户端）
   * 将订单状态从 pending 改为 paid（待审核），不锁定库存
   * 库存将在后台审核通过后才锁定
   */
  async confirmUserPayment(orderNumber) {
    const connection = await db.getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      // 查询订单信息
      const [orders] = await connection.query(
        'SELECT * FROM H5_orders WHERE order_number = ? AND status = "pending"',
        [orderNumber]
      );

      if (orders.length === 0) {
        await connection.rollback();
        return null;
      }

      const order = orders[0];

      // 检查订单是否过期
      if (order.expires_at && new Date(order.expires_at) < new Date()) {
        await connection.rollback();
        throw new Error('订单已过期，无法确认支付');
      }

      // 更新订单状态为已付款（待审核），不锁定库存
      await connection.query(
        'UPDATE H5_orders SET status = "paid", updated_at = NOW() WHERE id = ?',
        [order.id]
      );

      await connection.commit();

      // 返回更新后的订单
      const [updatedOrders] = await db.getDatabase().query(
        'SELECT * FROM H5_orders WHERE id = ?',
        [order.id]
      );

      return updatedOrders[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 生成订单号
   */
  async generateOrderNumber(connection) {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
                   (date.getMonth() + 1).toString().padStart(2, '0') +
                   date.getDate().toString().padStart(2, '0');

    // 查询今天已有订单数
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as count FROM H5_orders WHERE order_number LIKE ?',
      [`H5${dateStr}%`]
    );

    const count = countResult[0].count + 1;
    const sequence = count.toString().padStart(4, '0');

    return `H5${dateStr}${sequence}`;
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 解析配置值
   */
  /**
   * 获取聚合产品（按品牌+型号+颜色聚合）
   * 正确逻辑：先查询在库商品，然后匹配模板
   */
  async getAggregatedProducts(params = {}) {
    const {
      brand_id,
      model_id,
      is_new,
      color_id,
      search,
      page = 1,
      limit = 20,
      sort = 'created_at'
    } = params;

    log.debug('[聚合商品] 查询参数:', { is_new, brand_id, model_id, color_id, search, page, limit, sort });
    const startTime = Date.now();

    // 诊断：检查数据库中全新机的情况
    if (is_new === true || is_new === undefined) {
      const diagnosticQuery = `
        SELECT
          COUNT(*) as total_new,
          COUNT(CASE WHEN p.model_id IS NULL THEN 1 END) as without_model,
          COUNT(CASE WHEN p.model_id IS NOT NULL THEN 1 END) as with_model,
          COUNT(CASE WHEN p.color_id IS NULL THEN 1 END) as without_color,
          COUNT(DISTINCT p.brand_id) as brands_count,
          COUNT(DISTINCT CONCAT(p.brand_id, '-', p.model_id)) as brand_model_count,
          GROUP_CONCAT(DISTINCT CONCAT(b.name, '-', COALESCE(m.name, 'NULL')) ORDER BY b.name, m.name SEPARATOR ', ') as models_list
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        WHERE p.status = 'in_stock' AND p.is_new = 1
        LIMIT 1000
      `;
      const [diag] = await db.getDatabase().query(diagnosticQuery);
      log.debug('[聚合商品] 全新机诊断信息:', diag[0]);

      // 检查具体的 iPhone 17/16 数据
      const iphoneQuery = `
        SELECT
          p.id,
          p.brand_id,
          b.name as brand_name,
          p.model_id,
          m.name as model_name,
          p.color_id,
          c.name as color_name,
          p.is_new,
          p.status
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        WHERE p.status = 'in_stock'
          AND p.is_new = 1
          AND (b.name LIKE '%iPhone%' OR m.name LIKE '%16%' OR m.name LIKE '%17%' OR m.name LIKE '%17%')
        ORDER BY b.name, m.name, c.name
        LIMIT 20
      `;
      const [iphones] = await db.getDatabase().query(iphoneQuery);
      log.debug('[聚合商品] iPhone 16/17 全新机样例 (前20条):', iphones.map(p => ({
        id: p.id,
        brand: p.brand_name,
        model: p.model_name || '(model_id:' + p.model_id + ')',
        model_id: p.model_id,
        color: p.color_name,
        status: p.status
      })));
    }

    // 构建查询参数数组
    let queryParams = [];
    let query;

    // 排序映射
    const sortMap = {
      'created_at': 'CASE WHEN b.name = \'苹果\' THEN 0 ELSE 1 END, b.name, m.name, COALESCE(c.name, \'默认颜色\')',  // 苹果排最前，然后按品牌、型号排序
      'price_asc': 'MIN(COALESCE(h5.sale_price, p.sale_price)) ASC',     // 价格从低到高
      'price_desc': 'MIN(COALESCE(h5.sale_price, p.sale_price)) DESC'     // 价格从高到低
    };

    const orderClause = sortMap[sort] || sortMap['created_at'];
    log.debug('[聚合商品] 排序方式:', sort, '->', orderClause);

    if (is_new === true) {
      // 全新机：从 H5_newtemplates 表查询（无论有无库存）
      query = `
        SELECT
          t.id as template_id,
          CONCAT(t.brand_id, '-', t.model_id, '-', t.color_id, '-1') as product_key,
          t.brand_id,
          b.name as brand_name,
          t.model_id,
          m.name as model_name,
          t.color_id,
          c.name as color_name,
          1 as is_new,
          t.is_published,
          (SELECT COUNT(*) FROM phones p
           LEFT JOIN H5_product hp ON p.id = hp.phone_id
           WHERE p.brand_id = t.brand_id
             AND p.model_id = t.model_id
             AND p.color_id = t.color_id
             AND p.is_new = 1
             AND p.status = 'in_stock'
             AND (hp.is_published = 1 OR hp.is_published IS NULL)
          ) as total_stock,
          (SELECT MIN(pl.retail_price)
           FROM price_list pl
           WHERE pl.brand_id = t.brand_id
             AND pl.model_id = t.model_id
             AND pl.color_id = t.color_id
             AND pl.retail_price IS NOT NULL
             AND pl.retail_price > 0
          ) as min_price,
          (SELECT MAX(pl.retail_price)
           FROM price_list pl
           WHERE pl.brand_id = t.brand_id
             AND pl.model_id = t.model_id
             AND pl.color_id = t.color_id
             AND pl.retail_price IS NOT NULL
             AND pl.retail_price > 0
          ) as max_price,
          (SELECT p.id FROM phones p
           LEFT JOIN H5_product hp ON p.id = hp.phone_id
           WHERE p.brand_id = t.brand_id
             AND p.model_id = t.model_id
             AND p.color_id = t.color_id
             AND p.is_new = 1
             AND p.status = 'in_stock'
             AND (hp.is_published = 1 OR hp.is_published IS NULL)
           ORDER BY p.id ASC LIMIT 1
          ) as first_phone_id,
          t.memory_ids
        FROM H5_newtemplates t
        LEFT JOIN brands b ON t.brand_id = b.id
        LEFT JOIN models m ON t.model_id = m.id
        LEFT JOIN colors c ON t.color_id = c.id
        WHERE t.is_active = TRUE AND t.is_published = 1
      `;

      // 添加全新机的筛选条件
      if (brand_id) {
        query += ' AND t.brand_id = ?';
        queryParams.push(brand_id);
      }
      if (model_id) {
        query += ' AND t.model_id = ?';
        queryParams.push(model_id);
      }
      if (color_id) {
        query += ' AND t.color_id = ?';
        queryParams.push(color_id);
      }
      if (search) {
        query += ' AND (b.name LIKE ? OR m.name LIKE ? OR c.name LIKE ? OR t.template_name LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ` ORDER BY ${orderClause} LIMIT 500`;

    } else if (is_new === false) {
      // 二手机：每台手机独立显示，不分组
      const conditions = [];
      conditions.push('p.status = "in_stock"');
      conditions.push('p.is_new = 0');
      conditions.push('(h5.is_published = 1 OR h5.is_published IS NULL)');

      if (brand_id) {
        conditions.push('p.brand_id = ?');
        queryParams.push(brand_id);
      }
      if (model_id) {
        conditions.push('p.model_id = ?');
        queryParams.push(model_id);
      }
      if (color_id) {
        conditions.push('p.color_id = ?');
        queryParams.push(color_id);
      }
      if (search) {
        conditions.push('(b.name LIKE ? OR m.name LIKE ? OR c.name LIKE ? OR mem.size LIKE ? OR p.imei LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query = `
        SELECT
          p.id as phone_id,
          CONCAT(p.brand_id, '-', COALESCE(p.model_id, 0), '-', COALESCE(p.color_id, 0), '-', p.id) as product_key,
          p.brand_id,
          b.name as brand_name,
          p.model_id,
          m.name as model_name,
          p.color_id,
          c.name as color_name,
          p.memory_id,
          0 as is_new,
          1 as total_stock,
          COALESCE(h5.sale_price, p.sale_price) as min_price,
          COALESCE(h5.sale_price, p.sale_price) as max_price,
          p.id as first_phone_id,
          NULL as imei,
          NULL as quality_grade,
          NULL as condition_grade,
          NULL as main_image
        FROM phones p
        LEFT JOIN H5_product h5 ON p.id = h5.phone_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderClause}
        LIMIT 500
      `;

    } else {
      // 混合查询（is_new === null）：全新机模板 + 在库二手机
      // 使用 UNION 合并两个查询，列必须完全一致
      let newPhonesQuery = `
        SELECT
          NULL as phone_id,
          t.id as template_id,
          CONCAT(t.brand_id, '-', t.model_id, '-', t.color_id, '-1') as product_key,
          t.brand_id,
          b.name as brand_name,
          t.model_id,
          m.name as model_name,
          t.color_id,
          c.name as color_name,
          NULL as memory_id,
          NULL as memory_name,
          1 as is_new,
          t.is_published,
          (SELECT COUNT(*) FROM phones p
           LEFT JOIN H5_product hp ON p.id = hp.phone_id
           WHERE p.brand_id = t.brand_id
             AND p.model_id = t.model_id
             AND p.color_id = t.color_id
             AND p.is_new = 1
             AND p.status = 'in_stock'
             AND (hp.is_published = 1 OR hp.is_published IS NULL)
          ) as total_stock,
          (SELECT MIN(pl.retail_price)
           FROM price_list pl
           WHERE pl.brand_id = t.brand_id
             AND pl.model_id = t.model_id
             AND pl.color_id = t.color_id
             AND pl.retail_price IS NOT NULL
             AND pl.retail_price > 0
          ) as min_price,
          (SELECT MAX(pl.retail_price)
           FROM price_list pl
           WHERE pl.brand_id = t.brand_id
             AND pl.model_id = t.model_id
             AND pl.color_id = t.color_id
             AND pl.retail_price IS NOT NULL
             AND pl.retail_price > 0
          ) as max_price,
          (SELECT p.id FROM phones p
           LEFT JOIN H5_product hp ON p.id = hp.phone_id
           WHERE p.brand_id = t.brand_id
             AND p.model_id = t.model_id
             AND p.color_id = t.color_id
             AND p.is_new = 1
             AND p.status = 'in_stock'
             AND (hp.is_published = 1 OR hp.is_published IS NULL)
           ORDER BY p.id ASC LIMIT 1
          ) as first_phone_id,
          NULL as imei,
          NULL as quality_grade,
          NULL as condition_grade,
          NULL as main_image,
          t.memory_ids
        FROM H5_newtemplates t
        LEFT JOIN brands b ON t.brand_id = b.id
        LEFT JOIN models m ON t.model_id = m.id
        LEFT JOIN colors c ON t.color_id = c.id
        WHERE t.is_active = TRUE AND t.is_published = 1
      `;

      // 添加全新机的筛选条件
      if (brand_id) newPhonesQuery += ` AND t.brand_id = ${brand_id}`;
      if (model_id) newPhonesQuery += ` AND t.model_id = ${model_id}`;
      if (color_id) newPhonesQuery += ` AND t.color_id = ${color_id}`;
      if (search) {
        const escapedSearch = db.getDatabase().escape(`%${search}%`);
        newPhonesQuery += ` AND (b.name LIKE ${escapedSearch} OR m.name LIKE ${escapedSearch} OR c.name LIKE ${escapedSearch} OR t.template_name LIKE ${escapedSearch})`;
      }

      // 二手机查询（只在库，每台独立显示）
      let usedPhonesQuery = `
        SELECT
          p.id as phone_id,
          NULL as template_id,
          CONCAT(p.brand_id, '-', COALESCE(p.model_id, 0), '-', COALESCE(p.color_id, 0), '-', p.id) as product_key,
          p.brand_id,
          b.name as brand_name,
          p.model_id,
          m.name as model_name,
          p.color_id,
          c.name as color_name,
          p.memory_id,
          NULL as memory_name,
          0 as is_new,
          NULL as is_published,
          1 as total_stock,
          COALESCE(h5.sale_price, p.sale_price) as min_price,
          COALESCE(h5.sale_price, p.sale_price) as max_price,
          p.id as first_phone_id,
          NULL as imei,
          NULL as quality_grade,
          NULL as condition_grade,
          NULL as main_image,
          NULL as memory_ids
        FROM phones p
        LEFT JOIN H5_product h5 ON p.id = h5.phone_id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.status = 'in_stock' AND p.is_new = 0 AND (h5.is_published = 1 OR h5.is_published IS NULL)
      `;

      // 添加二手机的筛选条件
      if (brand_id) usedPhonesQuery += ` AND p.brand_id = ${brand_id}`;
      if (model_id) usedPhonesQuery += ` AND p.model_id = ${model_id}`;
      if (color_id) usedPhonesQuery += ` AND p.color_id = ${color_id}`;
      if (search) {
        const escapedSearch = db.getDatabase().escape(`%${search}%`);
        usedPhonesQuery += ` AND (b.name LIKE ${escapedSearch} OR m.name LIKE ${escapedSearch} OR c.name LIKE ${escapedSearch} OR mem.size LIKE ${escapedSearch} OR p.imei LIKE ${escapedSearch})`;
      }

      // 组合查询
      query = `
        ${newPhonesQuery}
        UNION ALL
        ${usedPhonesQuery}
        ORDER BY
          CASE WHEN brand_name = '苹果' THEN 0 ELSE 1 END,
          brand_name, model_name, COALESCE(color_name, '默认颜色')
        LIMIT 500
      `;
    }

    const queryStartTime = Date.now();
    const [products] = await db.getDatabase().query(query, queryParams);
    log.debug('[聚合商品] 查询到', products.length, '个商品, 耗时:', Date.now() - queryStartTime, 'ms');

    // 输出前几个商品的详细信息用于调试
    if (products.length > 0) {
      log.debug('[聚合商品] 前5个商品分组示例:', products.slice(0, 5).map(p => ({
        brand: p.brand_name,
        model: p.model_name,
        color: p.color_name,
        is_new: p.is_new,
        stock: p.total_stock,
        min_price: p.min_price
      })));
    }

    if (products.length === 0) {
      log.debug('[聚合商品] 没有查询到任何商品，请检查数据库中是否有符合条件的全新机');
      return { data: [], page: 1, limit: parseInt(limit), total: 0 };
    }

    // 处理全新机：查询模板图片
    const newProducts = products.filter(p => p.is_new === 1 || p.is_new === '1');
    log.debug('[聚合商品] 全新机数量:', newProducts.length);

    if (newProducts.length > 0) {
      // 全新机已经有 template_id，只需要查询图片
      const templateIds = newProducts.map(p => p.template_id).filter(id => id);

      if (templateIds.length > 0) {
        const [images] = await db.getDatabase().query(`
          SELECT image_url, template_id
          FROM H5_newimages
          WHERE template_id IN (${templateIds.map(() => '?').join(',')})
            AND is_primary = 1
        `, templateIds);
        log.debug('[聚合商品] 查询模板图片, 找到', images.length, '张图片');

        const imageMap = new Map();
        images.forEach(img => {
          imageMap.set(img.template_id, img.image_url);
        });

        // 为全新机添加主图
        newProducts.forEach(product => {
          product.main_image = imageMap.get(product.template_id) || null;
        });
      }

      // 查询 price_list 价格（如果当前没有价格）
      const needPriceProducts = newProducts.filter(p => !p.min_price || p.min_price === 'null');
      if (needPriceProducts.length > 0) {
        const brandIds = [...new Set(needPriceProducts.map(p => p.brand_id))];
        const modelIds = [...new Set(needPriceProducts.map(p => p.model_id))];
        const colorIds = [...new Set(needPriceProducts.map(p => p.color_id))];

        if (brandIds.length > 0) {
          const [prices] = await db.getDatabase().query(`
            SELECT
              pl.brand_id,
              pl.model_id,
              pl.color_id,
              MIN(pl.retail_price) as min_price,
              MAX(pl.retail_price) as max_price
            FROM price_list pl
            WHERE pl.brand_id IN (${brandIds.map(() => '?').join(',')})
              AND pl.model_id IN (${modelIds.map(() => '?').join(',')})
              AND pl.color_id IN (${colorIds.map(() => '?').join(',')})
              AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
            GROUP BY pl.brand_id, pl.model_id, pl.color_id
          `, [...brandIds, ...modelIds, ...colorIds]);

          const priceMap = new Map();
          prices.forEach(p => {
            const key = `${p.brand_id}-${p.model_id}-${p.color_id}`;
            priceMap.set(key, p);
          });

          needPriceProducts.forEach(product => {
            const key = `${product.brand_id}-${product.model_id}-${product.color_id}`;
            const price = priceMap.get(key);
            if (price) {
              product.min_price = price.min_price;
              product.max_price = price.max_price;
            }
          });
        }
      }
    }

    // 为二手机批量查询图片
    const usedProducts = products.filter(p => p.is_new === 0 || p.is_new === '0');
    log.debug('[聚合商品] 二手机数量:', usedProducts.length);

    if (usedProducts.length > 0) {
      const usedImageStartTime = Date.now();

      // 获取所有二手机的 first_phone_id
      const phoneIds = usedProducts.map(p => p.first_phone_id).filter(id => id);

      if (phoneIds.length > 0) {
        // 批量查询二手机的主图
        const [usedImages] = await db.getDatabase().query(`
          SELECT image_url, phone_id
          FROM h5_images
          WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
            AND is_primary = 1
        `, phoneIds);

        log.debug('[聚合商品] 查询二手机图片耗时:', Date.now() - usedImageStartTime, 'ms, 找到', usedImages.length, '张主图');

        // 创建图片映射
        const usedImageMap = new Map();
        usedImages.forEach(img => {
          usedImageMap.set(img.phone_id, img.image_url);
        });

        // 为二手机添加主图
        usedProducts.forEach(product => {
          if (product.first_phone_id && usedImageMap.has(product.first_phone_id)) {
            product.main_image = usedImageMap.get(product.first_phone_id);
          }
        });
      }

      // 批量查询内存名称
      const memoryIds = usedProducts.map(p => p.memory_id).filter(id => id);
      if (memoryIds.length > 0) {
        const [memories] = await db.getDatabase().query(`
          SELECT id, size as name
          FROM memories
          WHERE id IN (${memoryIds.map(() => '?').join(',')})
        `, memoryIds);

        const memoryMap = new Map();
        memories.forEach(mem => {
          memoryMap.set(mem.id, mem.name);
        });

        // 为二手机添加内存名称
        usedProducts.forEach(product => {
          if (product.memory_id && memoryMap.has(product.memory_id)) {
            product.memory_name = memoryMap.get(product.memory_id);
          }
        });
      }
    }

    // 分页处理
    const total = products.length;
    const offset = (page - 1) * limit;
    const paginatedProducts = products.slice(offset, offset + parseInt(limit));

    log.debug('[聚合商品] 返回结果:', {
      total,
      page,
      limit,
      count: paginatedProducts.length,
      hasMore: (offset + parseInt(limit)) < total,
      totalTime: Date.now() - startTime
    });

    return {
      data: paginatedProducts,
      page: parseInt(page),
      limit: parseInt(limit),
      total
    };
  }

  /**
   * 获取二手机产品（不聚合，每个商品独立显示）
   */
  async getUsedProducts({ brand_id, model_id, color_id, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = ['p.status = "in_stock"', 'p.is_new = 0'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      ${whereClause}
    `;
    const [countResult] = await db.getDatabase().query(countQuery, queryParams);
    const total = countResult[0].total;

    // 查询商品数据
    const query = `
      SELECT
        p.id,
        p.imei,
        p.brand_id,
        b.name as brand_name,
        p.model_id,
        m.name as model_name,
        p.color_id,
        c.name as color_name,
        p.memory_id,
        mem.size as memory_name,
        p.is_new,
        COALESCE(h5.sale_price, p.sale_price) as sale_price,
        p.quality_grade,
        p.status,
        (SELECT image_url FROM H5_images hi
         WHERE hi.phone_id = p.id
         ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
         LIMIT 1) as main_image
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      ${whereClause}
      ORDER BY p.Inventorytime DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));
    const [products] = await db.getDatabase().query(query, queryParams);

    return {
      data: products,
      page: parseInt(page),
      limit: parseInt(limit),
      total
    };
  }

  /**
   * 获取二手机总数
   */
  async getUsedProductsCount({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 0'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT COUNT(*) as total
      FROM phones p
      ${whereClause}
    `;

    const [result] = await db.getDatabase().query(query, queryParams);
    return result[0].total;
  }

  /**
   * 获取聚合的二手机产品（已废弃，二手机不再聚合）
   */
  async getAggregatedUsedProducts({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 0'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT
        CONCAT(p.brand_id, '-', COALESCE(p.model_id, 0), '-', COALESCE(p.color_id, 0), '-', p.is_new) as product_key,
        p.brand_id,
        COALESCE(b.name, '未知品牌') as brand_name,
        '' as brand_icon,
        p.model_id,
        COALESCE(m.name, '未知型号') as model_name,
        p.color_id,
        COALESCE(c.name, '默认颜色') as color_name,
        p.is_new,
        MIN(COALESCE(h5.sale_price, p.sale_price)) as min_price,
        MAX(COALESCE(h5.sale_price, p.sale_price)) as max_price,
        COUNT(*) as total_stock,
        (SELECT image_url FROM H5_images hi
         INNER JOIN phones p2 ON hi.phone_id = p2.id
         WHERE p2.brand_id = p.brand_id AND COALESCE(p2.model_id, 0) = COALESCE(p.model_id, 0) AND COALESCE(p2.color_id, 0) = COALESCE(p.color_id, 0)
         ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
         LIMIT 1) as main_image
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      ${whereClause}
      GROUP BY p.brand_id, COALESCE(p.model_id, 0), COALESCE(p.color_id, 0), p.is_new, COALESCE(b.name, '未知品牌'), COALESCE(m.name, '未知型号'), COALESCE(c.name, '默认颜色')
      ORDER BY COALESCE(b.name, '未知品牌'), COALESCE(m.name, '未知型号'), COALESCE(c.name, '默认颜色')
    `;

    const [products] = await db.getDatabase().query(query, queryParams);

    // 为每个聚合产品查询可用的内存选项
    const result = await Promise.all(products.map(async (product) => {
      const memoryQuery = `
        SELECT
          p.memory_id,
          COALESCE(mem.size, '标准版') as memory_name,
          COUNT(*) as stock_count,
          MIN(COALESCE(h5.sale_price, p.sale_price)) as price
        FROM phones p
        LEFT JOIN H5_product h5 ON p.id = h5.phone_id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.brand_id = ? AND COALESCE(p.model_id, 0) = COALESCE(?, 0) AND COALESCE(p.color_id, 0) = COALESCE(?, 0)
          AND p.is_new = 0 AND p.status = 'in_stock'
          AND (h5.is_published = 1 OR h5.is_published IS NULL)
        GROUP BY p.memory_id, COALESCE(mem.size, '标准版')
        ORDER BY COALESCE(mem.sort_order, 999) ASC, COALESCE(mem.size, '标准版') ASC
      `;

      const [memories] = await db.getDatabase().query(memoryQuery, [
        product.brand_id,
        product.model_id,
        product.color_id
      ]);

      return {
        ...product,
        memories: memories.map(m => ({
          id: m.memory_id,
          name: m.memory_name,
          stock: m.stock_count,
          price: m.price
        }))
      };
    }));

    return result;
  }

  /**
   * 获取聚合的全新机产品（从phones表查询，然后匹配H5_newtemplates表获取图文和价格）
   * 优化版本：使用批量查询减少数据库查询次数
   */
  async getAggregatedNewProducts({ brand_id, model_id, color_id }) {
    log.debug('[getAggregatedNewProducts] 查询参数:', { brand_id, model_id, color_id });

    // 第一步：从phones表查询所有在库的全新机（按品牌+型号+颜色分组）
    const conditions = ['p.status = "in_stock"', 'p.is_new = 1'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 查询在库全新机的分组数据（按品牌+型号+颜色聚合）
    const query = `
      SELECT
        CONCAT(p.brand_id, '-', p.model_id, '-', COALESCE(p.color_id, 0), '-1') as product_key,
        p.brand_id,
        b.name as brand_name,
        '' as brand_icon,
        p.model_id,
        m.name as model_name,
        p.color_id,
        COALESCE(c.name, '默认颜色') as color_name,
        1 as is_new,
        COUNT(*) as total_stock,
        MIN(p.id) as first_phone_id
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      ${whereClause}
      GROUP BY p.brand_id, p.model_id, p.color_id, b.name, m.name, c.name
      ORDER BY b.name, m.name, COALESCE(c.name, '默认颜色')
      LIMIT 1000
    `;

    const [products] = await db.getDatabase().query(query, queryParams);
    log.debug('[getAggregatedNewProducts] 从phones表查询到', products.length, '个商品组合');

    if (products.length === 0) {
      return [];
    }

    // 批量查询模板
    const brandIds = [...new Set(products.map(p => p.brand_id))];
    const modelIds = [...new Set(products.map(p => p.model_id))];
    const colorIds = [...new Set(products.map(p => p.color_id))];

    // 批量查询所有匹配的模板
    const templatePlaceholders = products.map(() => '(?, ?, ?)').join(',');
    const templateParams = products.flatMap(p => [p.brand_id, p.model_id, p.color_id]);

    const [templates] = await db.getDatabase().query(`
      SELECT id, brand_id, model_id, color_id, memory_ids
      FROM H5_newtemplates
      WHERE is_active = TRUE
        AND (brand_id, model_id, color_id) IN (
          SELECT brand_id, model_id, color_id
          FROM (SELECT ${products.map(() => '(? AS brand_id, ? AS model_id, ? AS color_id)').join(' UNION ALL ')}) AS temp
        )
    `, templateParams);

    // 创建模板查找映射
    const templateMap = new Map();
    templates.forEach(t => {
      const key = `${t.brand_id}-${t.model_id}-${t.color_id}`;
      templateMap.set(key, t);
    });

    // 批量查询价格
    const [prices] = await db.getDatabase().query(`
      SELECT
        pl.brand_id,
        pl.model_id,
        pl.color_id,
        MIN(pl.retail_price) as min_price,
        MAX(pl.retail_price) as max_price
      FROM price_list pl
      WHERE pl.brand_id IN (${brandIds.map(() => '?').join(',')})
        AND pl.model_id IN (${modelIds.map(() => '?').join(',')})
        AND pl.color_id IN (${colorIds.map(() => '?').join(',')})
        AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
      GROUP BY pl.brand_id, pl.model_id, pl.color_id
    `, [...brandIds, ...modelIds, ...colorIds]);

    // 创建价格查找映射
    const priceMap = new Map();
    prices.forEach(p => {
      const key = `${p.brand_id}-${p.model_id}-${p.color_id}`;
      priceMap.set(key, p);
    });

    // 批量查询图片（从模板）
    const templateIds = templates.map(t => t.id);
    const imageMap = new Map();

    if (templateIds.length > 0) {
      const [images] = await db.getDatabase().query(`
        SELECT image_url, template_id
        FROM H5_newimages
        WHERE template_id IN (${templateIds.map(() => '?').join(',')})
          AND is_primary = 1
      `, templateIds);

      images.forEach(img => {
        imageMap.set(img.template_id, img.image_url);
      });
    }

    // 处理每个产品
    const result = products.map(product => {
      const key = `${product.brand_id}-${product.model_id}-${product.color_id}`;
      const template = templateMap.get(key);
      const price = priceMap.get(key);

      product.template_id = template ? template.id : null;
      product.memory_ids = template ? template.memory_ids : null;
      product.min_price = price ? (price.min_price || 0) : 0;
      product.max_price = price ? (price.max_price || 0) : 0;

      // 查询主图
      if (template && imageMap.has(template.id)) {
        product.main_image = imageMap.get(template.id);
      } else if (product.first_phone_id) {
        // 使用占位符，稍后批量查询
        product.main_image = null;
      }

      // 清理临时字段
      delete product.first_phone_id;

      return product;
    });

    // 批量查询没有模板的商品的图片（从H5_images）
    const productsWithoutTemplate = result.filter(p => !p.template_id && !p.main_image);
    if (productsWithoutTemplate.length > 0) {
      // 重新查询这些商品的phone_ids
      const phoneIdPlaceholders = productsWithoutTemplate.map(() => '?').join(',');
      const [phoneImages] = await db.getDatabase().query(`
        SELECT hi.image_url, hi.phone_id,
          p.brand_id, p.model_id, p.color_id
        FROM H5_images hi
        INNER JOIN phones p ON hi.phone_id = p.id
        WHERE hi.phone_id IN (
          SELECT MIN(p.id) as phone_id
          FROM phones p
          WHERE (${productsWithoutTemplate.map(() => 'p.brand_id = ? AND p.model_id = ? AND p.color_id = ?').join(') OR (')})
          GROUP BY p.brand_id, p.model_id, p.color_id
        )
        AND hi.is_primary = 1
      `, productsWithoutTemplate.flatMap(p => [p.brand_id, p.model_id, p.color_id]));

      phoneImages.forEach(img => {
        const key = `${img.brand_id}-${img.model_id}-${img.color_id}`;
        const product = result.find(p =>
          p.brand_id === img.brand_id &&
          p.model_id === img.model_id &&
          p.color_id === img.color_id
        );
        if (product) {
          product.main_image = img.image_url;
        }
      });
    }

    log.debug('[getAggregatedNewProducts] 处理完成，返回', result.length, '个商品');
    return result;
  }

  /**
   * 从H5_newtemplates表获取全新机（用于聚合查询）
   */
  async getNewTemplatesForAggregation({ brand_id, model_id, color_id }) {
    const conditions = ['t.is_active = TRUE'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('t.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('t.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('t.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    log.debug('[getNewTemplatesForAggregation] SQL条件:', whereClause);
    log.debug('[getNewTemplatesForAggregation] 查询参数:', queryParams);

    const query = `
      SELECT
        CONCAT(t.brand_id, '-', t.model_id, '-', COALESCE(t.color_id, 0), '-1') as product_key,
        t.brand_id,
        b.name as brand_name,
        '' as brand_icon,
        t.model_id,
        m.name as model_name,
        t.color_id,
        COALESCE(c.name, '默认颜色') as color_name,
        1 as is_new,
        (SELECT MIN(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND (t.memory_ids IS NULL OR JSON_CONTAINS(t.memory_ids, CAST(pl.memory_id AS JSON)))
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as min_price,
        (SELECT MAX(pl.retail_price)
         FROM price_list pl
         WHERE pl.brand_id = t.brand_id AND pl.model_id = t.model_id AND pl.color_id = t.color_id
           AND (t.memory_ids IS NULL OR JSON_CONTAINS(t.memory_ids, CAST(pl.memory_id AS JSON)))
           AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ) as max_price,
        (SELECT COUNT(*) FROM phones p LEFT JOIN H5_product h5 ON p.id = h5.phone_id
         WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id
           AND p.is_new = 1 AND p.status = 'in_stock' AND (h5.is_published = 1 OR h5.is_published IS NULL)) as total_stock,
        (SELECT image_url FROM H5_newimages ni
         WHERE ni.template_id = t.id AND ni.is_primary = 1
         LIMIT 1) as main_image,
        t.id as template_id,
        t.memory_ids
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      ${whereClause}
      ORDER BY t.sort_order ASC, m.name, COALESCE(c.name, '默认颜色')
    `;

    const [products] = await db.getDatabase().query(query, queryParams);

    log.debug('[getNewTemplatesForAggregation] 查询结果数量:', products.length);
    if (products.length > 0) {
      log.debug('[getNewTemplatesForAggregation] 样本数据:', products.slice(0, 3).map(p => ({
        brand: p.brand_name,
        model: p.model_name,
        color: p.color_name
      })));
    }

    // 为每个模板获取内存选项和图片
    const result = await Promise.all(products.map(async (product) => {
      let memoryList = null;
      if (product.memory_ids) {
        try {
          memoryList = typeof product.memory_ids === 'string' ? JSON.parse(product.memory_ids) : product.memory_ids;
        } catch (error) {
          log.error('[聚合全新机] 解析 memory_ids 失败:', product.memory_ids, error);
        }
      }

      // 获取该模板的所有图片
      const [images] = await db.getDatabase().query(
        'SELECT image_url FROM H5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
        [product.template_id]
      );
      const imageList = images.map(img => img.image_url);

      let whereClause = 'AND pl.brand_id = ? AND pl.model_id = ? AND pl.color_id = ?';
      const queryParams = [product.brand_id, product.model_id, product.color_id];

      if (memoryList && memoryList.length > 0) {
        whereClause += ` AND pl.memory_id IN (${memoryList.map(() => '?').join(',')})`;
        queryParams.push(...memoryList);
      }

      const memoryQuery = `
        SELECT pl.memory_id, mem.size as memory_name,
               pl.retail_price as price,
               (SELECT COUNT(*) FROM phones p LEFT JOIN H5_product h5 ON p.id = h5.phone_id
                WHERE p.brand_id = ? AND p.model_id = ? AND p.color_id = ? AND p.memory_id = pl.memory_id
                  AND p.is_new = 1 AND p.status = 'in_stock' AND (h5.is_published = 1 OR h5.is_published IS NULL)) as stock_count
        FROM price_list pl
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        WHERE 1=1 ${whereClause}
          AND pl.retail_price IS NOT NULL AND pl.retail_price > 0
        ORDER BY pl.memory_id
      `;

      const [memories] = await db.getDatabase().query(memoryQuery, [
        product.brand_id, product.model_id, product.color_id, ...queryParams
      ]);

      return {
        ...product,
        images: imageList,
        memories: memories.map(m => ({
          id: m.memory_id,
          name: m.memory_name,
          stock: m.stock_count,
          price: m.price
        })),
        min_price: product.min_price || 0,
        max_price: product.max_price || 0
      };
    }));

    return result;
  }

  /**
   * 获取二手机聚合总数
   */
  async getAggregatedUsedCount({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 0'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT COUNT(DISTINCT CONCAT(p.brand_id, '-', p.model_id, '-', COALESCE(p.color_id, 0))) as total
      FROM phones p
      ${whereClause}
    `;

    const [result] = await db.getDatabase().query(query, queryParams);
    return result[0].total;
  }

  /**
   * 获取全新机聚合总数（从phones表查询在库全新机的分组数量）
   */
  async getAggregatedNewCount({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 1'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 查询按品牌+型号+颜色分组的数量
    const query = `
      SELECT COUNT(DISTINCT CONCAT(p.brand_id, '-', p.model_id, '-', COALESCE(p.color_id, 0))) as total
      FROM phones p
      ${whereClause}
    `;

    const [result] = await db.getDatabase().query(query, queryParams);
    return result[0].total;
  }

  /**
   * 获取模板全新机数量
   */
  async getNewTemplateCount({ brand_id, model_id, color_id }) {
    const conditions = ['t.is_active = TRUE'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('t.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('t.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('t.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT COUNT(*) as total
      FROM H5_newtemplates t
      ${whereClause}
    `;

    const [result] = await db.getDatabase().query(query, queryParams);
    return result[0].total;
  }

  /**
   * 获取phones表全新机数量
   */
  async getNewPhoneCount({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 1'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT COUNT(DISTINCT CONCAT(p.brand_id, '-', COALESCE(p.model_id, 0), '-', COALESCE(p.color_id, 0))) as total
      FROM phones p
      ${whereClause}
    `;

    const [result] = await db.getDatabase().query(query, queryParams);
    return result[0].total;
  }

  /**
   * 从phones表获取全新机聚合数据
   */
  async getNewProductsFromPhones({ brand_id, model_id, color_id }) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = 1'];
    const queryParams = [];

    if (brand_id) {
      conditions.push('p.brand_id = ?');
      queryParams.push(brand_id);
    }
    if (model_id) {
      conditions.push('p.model_id = ?');
      queryParams.push(model_id);
    }
    if (color_id) {
      conditions.push('p.color_id = ?');
      queryParams.push(color_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    log.debug('[getNewProductsFromPhones] SQL条件:', whereClause);

    const query = `
      SELECT
        CONCAT(p.brand_id, '-', COALESCE(p.model_id, 0), '-', COALESCE(p.color_id, 0), '-1') as product_key,
        p.brand_id,
        COALESCE(b.name, '未知品牌') as brand_name,
        '' as brand_icon,
        COALESCE(p.model_id, 0) as model_id,
        COALESCE(m.name, '未知型号') as model_name,
        COALESCE(p.color_id, 0) as color_id,
        COALESCE(c.name, '默认颜色') as color_name,
        p.is_new,
        MIN(COALESCE(h5.sale_price, p.sale_price)) as min_price,
        MAX(COALESCE(h5.sale_price, p.sale_price)) as max_price,
        COUNT(*) as total_stock,
        (SELECT image_url FROM H5_images hi
         INNER JOIN phones p2 ON hi.phone_id = p2.id
         WHERE p2.brand_id = p.brand_id AND COALESCE(p2.model_id, 0) = COALESCE(p.model_id, 0) AND COALESCE(p2.color_id, 0) = COALESCE(p.color_id, 0)
         ORDER BY hi.is_primary DESC
         LIMIT 1) as main_image
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      ${whereClause}
      GROUP BY p.brand_id, COALESCE(p.model_id, 0), COALESCE(p.color_id, 0), p.is_new, COALESCE(b.name, '未知品牌'), COALESCE(m.name, '未知型号'), COALESCE(c.name, '默认颜色')
      ORDER BY COALESCE(b.name, '未知品牌'), COALESCE(m.name, '未知型号'), COALESCE(c.name, '默认颜色')
    `;

    const [products] = await db.getDatabase().query(query, queryParams);

    // 为每个聚合产品查询可用的内存选项
    const result = await Promise.all(products.map(async (product) => {
      const memoryQuery = `
        SELECT
          p.memory_id,
          COALESCE(mem.size, '标准版') as memory_name,
          COUNT(*) as stock_count,
          MIN(COALESCE(h5.sale_price, p.sale_price)) as price
        FROM phones p
        LEFT JOIN H5_product h5 ON p.id = h5.phone_id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        WHERE p.brand_id = ? AND COALESCE(p.model_id, 0) = COALESCE(?, 0) AND COALESCE(p.color_id, 0) = COALESCE(?, 0)
          AND p.is_new = 1 AND p.status = 'in_stock' AND (h5.is_published = 1 OR h5.is_published IS NULL)
        GROUP BY p.memory_id, COALESCE(mem.size, '标准版')
        ORDER BY COALESCE(mem.sort_order, 999) ASC, COALESCE(mem.size, '标准版') ASC
      `;

      const [memories] = await db.getDatabase().query(memoryQuery, [
        product.brand_id,
        product.model_id,
        product.color_id
      ]);

      return {
        ...product,
        memories: memories.map(m => ({
          id: m.memory_id,
          name: m.memory_name,
          stock: m.stock_count,
          price: m.price
        }))
      };
    }));

    return result;
  }

  /**
   * 获取聚合产品的详细库存分布（指定内存）
   * 用于用户选择内存后查看具体店铺库存
   */
  async getProductStockDistribution(brand_id, model_id, color_id, memory_id, is_new) {
    const query = `
      SELECT
        p.id as phone_id,
        p.imei,
        p.store_id,
        s.name as store_name,
        s.location as store_address,
        s.phone as store_phone,
        p.quality_grade,
        COALESCE(h5.sale_price, p.sale_price) as sale_price,
        h5.condition_grade,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url FROM H5_images WHERE phone_id = p.id AND is_primary = 1 LIMIT 1
          )
        END as image_url
      FROM phones p
      LEFT JOIN H5_product h5 ON p.id = h5.phone_id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN price_list pl ON pl.brand_id = p.brand_id
        AND pl.model_id = p.model_id
        AND pl.color_id = p.color_id
        AND pl.memory_id = p.memory_id
      WHERE p.brand_id = ?
        AND p.model_id = ?
        AND p.color_id = ?
        AND p.memory_id = ?
        AND p.is_new = ?
        AND p.status = 'in_stock'
      ORDER BY s.name, p.quality_grade DESC
    `;

    const [stocks] = await db.getDatabase().query(query, [brand_id, model_id, color_id, memory_id, is_new ? 1 : 0]);

    // 按店铺分组库存
    const storeGroups = {};
    stocks.forEach(stock => {
      if (!storeGroups[stock.store_id]) {
        storeGroups[stock.store_id] = {
          store_id: stock.store_id,
          store_name: stock.store_name,
          store_address: stock.store_address,
          store_phone: stock.store_phone,
          stock_count: 0,
          items: []
        };
      }
      storeGroups[stock.store_id].stock_count++;
      storeGroups[stock.store_id].items.push({
        phone_id: stock.phone_id,
        imei: stock.imei,
        quality_grade: stock.quality_grade,
        condition_grade: stock.condition_grade,
        sale_price: stock.sale_price,
        image_url: stock.image_url
      });
    });

    return {
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      total_stock: stocks.length,
      stores: Object.values(storeGroups)
    };
  }

  parseConfigValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value) || 0;
      case 'boolean':
        return value === 'true' || value === true;
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      default:
        return value;
    }
  }

  // ============================================================================
  // 销售管理 - H5订单管理
  // ============================================================================

  /**
   * 获取H5订单列表（带筛选和分页）
   */
  async getH5OrdersList({
    page = 1,
    limit = 20,
    status,
    customer_name,
    customer_phone,
    order_number,
    start_date,
    end_date,
    sort = 'created_at',
    order = 'desc'
  }) {
    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (customer_name) {
      conditions.push('o.customer_name LIKE ?');
      params.push(`%${customer_name}%`);
    }

    if (customer_phone) {
      conditions.push('o.customer_phone LIKE ?');
      params.push(`%${customer_phone}%`);
    }

    if (order_number) {
      conditions.push('o.order_number LIKE ?');
      params.push(`%${order_number}%`);
    }

    if (start_date) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 验证排序字段
    const validSortFields = ['created_at', 'updated_at', 'total_amount', 'customer_name'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortDirection = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM H5_orders o
      ${whereClause}
    `;
    const [countResult] = await db.getDatabase().query(countQuery, params);
    const total = countResult[0].total;

    // 查询订单列表
    const query = `
      SELECT
        o.*,
        COUNT(oi.id) as item_count
      FROM H5_orders o
      LEFT JOIN H5_order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const [orders] = await db.getDatabase().query(query, [...params, limit, offset]);

    return {
      data: orders,
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total)
    };
  }

  /**
   * 获取H5订单详情
   */
  async getH5OrderDetail(orderId) {
    const [orders] = await db.getDatabase().query(
      `SELECT * FROM H5_orders WHERE id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];

    // 获取订单商品
    const [items] = await db.getDatabase().query(
      `SELECT * FROM H5_order_items WHERE order_id = ?`,
      [orderId]
    );

    // 解析商品信息JSON
    order.items = items.map(item => ({
      ...item,
      phone_info: typeof item.phone_info === 'string' ? JSON.parse(item.phone_info) : item.phone_info
    }));

    return order;
  }

  /**
   * 审核通过订单（支付确认）
   * 将订单状态从 paid 改为 confirmed，并锁定库存
   */
  async confirmH5Order(orderId, adminId, remarks) {
    const connection = await db.getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      // 查询订单信息
      const [orders] = await connection.query(
        'SELECT * FROM H5_orders WHERE id = ? AND status = "paid"',
        [orderId]
      );

      if (orders.length === 0) {
        await connection.rollback();
        throw new Error('订单不存在或状态不正确');
      }

      const order = orders[0];

      // 更新订单状态为已确认
      await connection.query(
        'UPDATE H5_orders SET status = "confirmed", confirmed_by = ?, updated_at = NOW() WHERE id = ?',
        [adminId, orderId]
      );

      // 锁定库存：将订单中的商品状态改为 sold
      await connection.query(
        `UPDATE phones p
         INNER JOIN H5_order_items oi ON p.id = oi.phone_id
         SET p.status = 'sold'
         WHERE oi.order_id = ?`,
        [orderId]
      );

      await connection.commit();

      // 返回更新后的订单
      const [updatedOrders] = await db.getDatabase().query(
        'SELECT * FROM H5_orders WHERE id = ?',
        [orderId]
      );

      return updatedOrders[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 拒绝订单（支付审核不通过）
   * 将订单状态从 paid 改回 pending
   */
  async rejectH5Order(orderId, adminId, reason) {
    const connection = await db.getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      // 查询订单信息
      const [orders] = await connection.query(
        'SELECT * FROM H5_orders WHERE id = ? AND status = "paid"',
        [orderId]
      );

      if (orders.length === 0) {
        await connection.rollback();
        throw new Error('订单不存在或状态不正确');
      }

      // 更新订单状态为待支付（可以重新支付）
      await connection.query(
        'UPDATE H5_orders SET status = "pending", remarks = ?, updated_at = NOW() WHERE id = ?',
        [reason || '支付审核未通过', orderId]
      );

      await connection.commit();

      // 返回更新后的订单
      const [updatedOrders] = await db.getDatabase().query(
        'SELECT * FROM H5_orders WHERE id = ?',
        [orderId]
      );

      return updatedOrders[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 订单发货
   */
  async shipH5Order(orderId, { tracking_number, shipping_company, remarks, shipped_by }) {
    const [orders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ? AND status = "confirmed"',
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error('订单不存在或状态不正确');
    }

    await db.getDatabase().query(
      'UPDATE H5_orders SET status = "shipped", remarks = ?, updated_at = NOW() WHERE id = ?',
      [remarks, orderId]
    );

    const [updatedOrders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ?',
      [orderId]
    );

    return updatedOrders[0];
  }

  /**
   * 订单完成
   */
  async completeH5Order(orderId, adminId, remarks) {
    const [orders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ? AND status = "shipped"',
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error('订单不存在或状态不正确');
    }

    await db.getDatabase().query(
      'UPDATE H5_orders SET status = "completed", remarks = ?, updated_at = NOW() WHERE id = ?',
      [remarks, orderId]
    );

    const [updatedOrders] = await db.getDatabase().query(
      'SELECT * FROM H5_orders WHERE id = ?',
      [orderId]
    );

    return updatedOrders[0];
  }

  /**
   * 取消订单
   */
  async cancelH5Order(orderId, adminId, reason) {
    const connection = await db.getDatabase().getConnection();

    try {
      await connection.beginTransaction();

      // 查询订单信息
      const [orders] = await connection.query(
        'SELECT * FROM H5_orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        await connection.rollback();
        throw new Error('订单不存在');
      }

      const order = orders[0];

      // 只有待支付、已支付（未审核）状态的订单可以取消
      if (!['pending', 'paid'].includes(order.status)) {
        await connection.rollback();
        throw new Error('订单状态不允许取消');
      }

      // 更新订单状态
      await connection.query(
        'UPDATE H5_orders SET status = "cancelled", remarks = ?, updated_at = NOW() WHERE id = ?',
        [reason, orderId]
      );

      // 如果订单已支付（paid状态），释放库存
      if (order.status === 'paid') {
        await connection.query(
          `UPDATE phones p
           INNER JOIN H5_order_items oi ON p.id = oi.phone_id
           SET p.status = 'in_stock'
           WHERE oi.order_id = ?`,
          [orderId]
        );
      }

      await connection.commit();

      // 返回更新后的订单
      const [updatedOrders] = await db.getDatabase().query(
        'SELECT * FROM H5_orders WHERE id = ?',
        [orderId]
      );

      return updatedOrders[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取订单统计数据
   */
  async getH5OrderStatistics({ start_date, end_date }) {
    const conditions = [];
    const params = [];

    if (start_date) {
      conditions.push('DATE(created_at) >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('DATE(created_at) <= ?');
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询各状态订单数量
    const [statusStats] = await db.getDatabase().query(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_amount
      FROM H5_orders
      ${whereClause}
      GROUP BY status
    `, params);

    // 查询总订单数和总金额
    const [totalStats] = await db.getDatabase().query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_amount
      FROM H5_orders
      ${whereClause}
    `, params);

    return {
      by_status: statusStats,
      total: totalStats[0]
    };
  }
}

module.exports = ShopPublicService;
