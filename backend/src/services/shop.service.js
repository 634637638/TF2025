/**
 * H5商城服务 - 员工端
 * 功能：配置管理、轮播图管理、商品图片管理、订单管理
 */

const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const log = require('../utils/log');
const { getUploadsRoot } = require('../utils/upload-paths');

class ShopService {
  async ensurePrimaryPhoneImage(phoneId, connection = db.getDatabase()) {
    const [primaryImages] = await connection.query(
      `SELECT id
       FROM H5_images
       WHERE phone_id = ? AND is_primary = TRUE
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [phoneId]
    );

    if (primaryImages.length > 0) {
      return primaryImages[0].id;
    }

    const [candidateImages] = await connection.query(
      `SELECT id
       FROM H5_images
       WHERE phone_id = ?
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [phoneId]
    );

    if (candidateImages.length === 0) {
      return null;
    }

    const primaryId = candidateImages[0].id;
    await connection.query(
      'UPDATE H5_images SET is_primary = CASE WHEN id = ? THEN TRUE ELSE FALSE END WHERE phone_id = ?',
      [primaryId, phoneId]
    );

    return primaryId;
  }

  async ensurePrimaryTemplateImage(templateId, connection = db.getDatabase()) {
    const [primaryImages] = await connection.query(
      `SELECT id
       FROM h5_newimages
       WHERE template_id = ? AND image_type <> ? AND is_primary = TRUE
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [templateId, 'video']
    );

    if (primaryImages.length > 0) {
      return primaryImages[0].id;
    }

    const [candidateImages] = await connection.query(
      `SELECT id
       FROM h5_newimages
       WHERE template_id = ? AND image_type <> ?
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [templateId, 'video']
    );

    if (candidateImages.length === 0) {
      return null;
    }

    const primaryId = candidateImages[0].id;
    await connection.query(
      `UPDATE h5_newimages
       SET is_primary = CASE
         WHEN image_type <> ? AND id = ? THEN TRUE
         ELSE FALSE
       END
       WHERE template_id = ?`,
      ['video', primaryId, templateId]
    );

    return primaryId;
  }

  // ============================================================================
  // 商城配置管理
  // ============================================================================

  /**
   * 获取所有配置
   */
  async getAllConfigs() {
    const query = `
      SELECT * FROM H5_config
      ORDER BY category, config_key
    `;
    const [configs] = await db.getDatabase().query(query);

    // 按分类组织
    const result = {};
    configs.forEach(config => {
      if (!result[config.category]) {
        result[config.category] = [];
      }
      result[config.category].push({
        key: config.config_key,
        value: this.parseConfigValue(config.config_value, config.config_type),
        type: config.config_type,
        description: config.description
      });
    });

    return result;
  }

  /**
   * 获取指定分类的配置
   */
  async getConfigsByCategory(category) {
    const query = `
      SELECT * FROM H5_config
      WHERE category = ?
      ORDER BY config_key
    `;
    const [configs] = await db.getDatabase().query(query, [category]);

    return configs.map(config => ({
      key: config.config_key,
      value: this.parseConfigValue(config.config_value, config.config_type),
      type: config.config_type,
      description: config.description
    }));
  }

  /**
   * 更新单个配置
   */
  async updateConfig(key, value) {
    const query = `
      UPDATE H5_config
      SET config_value = ?, updated_at = NOW()
      WHERE config_key = ?
    `;
    await db.getDatabase().query(query, [value, key]);
  }

  /**
   * 批量更新配置（支持自动插入不存在的配置项）
   */
  async batchUpdateConfigs(configs) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 首先获取所有已存在的配置项及其分类
      const [existingConfigs] = await connection.query(
        `SELECT config_key, category FROM H5_config WHERE config_key IN (?)`,
        [configs.map(c => c.key)]
      );

      const existingMap = {};
      existingConfigs.forEach(c => {
        existingMap[c.config_key] = c.category;
      });

      // 根据配置键推断分类
      const getCategoryByKey = (key) => {
        if (existingMap[key]) return existingMap[key];
        if (key.startsWith('shop_') && key !== 'shop_name' && key !== 'shop_logo' && key !== 'shop_subtitle') return 'contact';
        if (key.startsWith('map_')) return 'contact';
        if (key.includes('qrcode') || key.includes('payment') || key.includes('bank')) return 'payment';
        if (key.includes('banner')) return 'banner';
        if (key.includes('cart')) return 'cart';
        return 'general';
      };

      for (const config of configs) {
        const category = getCategoryByKey(config.key);

        // 使用 INSERT ... ON DUPLICATE KEY UPDATE
        // 如果记录不存在则插入，存在则更新
        await connection.query(
          `INSERT INTO H5_config (config_key, config_value, config_type, category, updated_at)
           VALUES (?, ?, 'string', ?, NOW())
           ON DUPLICATE KEY UPDATE
           config_value = VALUES(config_value),
           updated_at = NOW()`,
          [config.key, config.value, category]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // 轮播图管理
  // ============================================================================

  /**
   * 获取所有轮播图
   */
  async getAllBanners() {
    const query = `
      SELECT
        id, title, image_url, link_url, link_type, sort_order, status,
        start_time, end_time, \`interval\`,
        images,
        created_at, updated_at
      FROM H5_banners
      ORDER BY sort_order ASC, created_at DESC
    `;
    const [banners] = await db.getDatabase().query(query);

    // 解析 images JSON 字段
    return banners.map(banner => ({
      ...banner,
      interval: banner.interval,
      images: banner.images ? (typeof banner.images === 'string' ? JSON.parse(banner.images) : banner.images) : null
    }));
  }

  /**
   * 创建轮播图
   */
  async createBanner(bannerData) {
    const query = `
      INSERT INTO H5_banners (title, image_url, images, link_url, link_type, sort_order, status, start_time, end_time, \`interval\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.getDatabase().query(query, [
      bannerData.title,
      bannerData.image_url,
      bannerData.images && bannerData.images.length > 0 ? JSON.stringify(bannerData.images) : null,
      bannerData.link_url || null,
      bannerData.link_type || 'none',
      bannerData.sort_order || 0,
      bannerData.status || 'active',
      bannerData.start_time || null,
      bannerData.end_time || null,
      bannerData.interval || 3000
    ]);

    return { id: result.insertId, ...bannerData };
  }

  /**
   * 更新轮播图
   */
  async updateBanner(id, bannerData) {
    // 如果更新了图片，先删除旧图片文件
    if (bannerData.images !== undefined || bannerData.image_url !== undefined) {
      // 查询旧图片信息
      const [banners] = await db.getDatabase().query('SELECT image_url, images FROM H5_banners WHERE id = ?', [id]);

      if (banners.length > 0) {
        const oldBanner = banners[0];
        const newImages = bannerData.images || [];

        // 解析旧图片数组
        const oldImages = oldBanner.images
          ? (typeof oldBanner.images === 'string' ? JSON.parse(oldBanner.images) : oldBanner.images)
          : [];

        // 找出被删除的图片（旧图片中有，新图片中没有的）
        const deletedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg));

        // 删除不再使用的图片文件
        for (const imgUrl of deletedImages) {
          try {
            // 如果新 image_url 不是这张图，才删除
            if (bannerData.image_url !== imgUrl) {
              const relativePath = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
              const filePath = path.join(__dirname, '../../', relativePath);
              await fs.unlink(filePath);
            }
          } catch (error) {
            log.warn('删除旧轮播图文件失败:', error.message);
          }
        }
      }
    }

    // 动态构建 UPDATE 语句，只更新提供的字段
    const updates = [];
    const params = [];

    if (bannerData.title !== undefined) {
      updates.push('title = ?');
      params.push(bannerData.title);
    }
    if (bannerData.image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(bannerData.image_url);
    }
    if (bannerData.images !== undefined) {
      updates.push('images = ?');
      params.push(bannerData.images && bannerData.images.length > 0 ? JSON.stringify(bannerData.images) : null);
    }
    if (bannerData.link_url !== undefined) {
      updates.push('link_url = ?');
      params.push(bannerData.link_url);
    }
    if (bannerData.link_type !== undefined) {
      updates.push('link_type = ?');
      params.push(bannerData.link_type);
    }
    if (bannerData.sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(bannerData.sort_order);
    }
    if (bannerData.status !== undefined) {
      updates.push('status = ?');
      params.push(bannerData.status);
    }
    if (bannerData.start_time !== undefined) {
      updates.push('start_time = ?');
      params.push(bannerData.start_time);
    }
    if (bannerData.end_time !== undefined) {
      updates.push('end_time = ?');
      params.push(bannerData.end_time);
    }
    if (bannerData.interval !== undefined) {
      updates.push('`interval` = ?');
      params.push(bannerData.interval);
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const query = `
      UPDATE H5_banners
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    await db.getDatabase().query(query, params);
  }

  /**
   * 删除轮播图
   */
  async deleteBanner(id) {
    // 先查询轮播图信息，获取图片路径
    const [banners] = await db.getDatabase().query('SELECT image_url, images FROM H5_banners WHERE id = ?', [id]);

    if (banners.length > 0) {
      const banner = banners[0];

      // 删除主图文件
      if (banner.image_url) {
        try {
          const relativePath = banner.image_url.startsWith('/') ? banner.image_url.substring(1) : banner.image_url;
          const filePath = path.join(__dirname, '../../', relativePath);
          await fs.unlink(filePath);
          log.debug('✅ 已删除轮播图主图文件:', filePath);
        } catch (error) {
          log.warn('⚠️ 删除轮播图主图文件失败:', error.message);
        }
      }

      // 删除多图文件
      if (banner.images) {
        const images = typeof banner.images === 'string' ? JSON.parse(banner.images) : banner.images;
        if (Array.isArray(images)) {
          for (const imgUrl of images) {
            try {
              const relativePath = imgUrl.startsWith('/') ? imgUrl.substring(1) : imgUrl;
              const filePath = path.join(__dirname, '../../', relativePath);
              await fs.unlink(filePath);
              log.debug('✅ 已删除轮播图文件:', filePath);
            } catch (error) {
              log.warn('⚠️ 删除轮播图文件失败:', error.message);
            }
          }
        }
      }
    }

    // 删除数据库记录
    await db.getDatabase().query('DELETE FROM H5_banners WHERE id = ?', [id]);
  }

  /**
   * 批量更新轮播图排序
   */
  async reorderBanners(orders) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of orders) {
        await connection.query(
          `UPDATE H5_banners SET sort_order = ? WHERE id = ?`,
          [item.sort_order, item.id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // 商品图片管理
  // ============================================================================

  /**
   * 获取商品图片列表
   */
  async getPhoneImages(phoneId) {
    const query = `
      SELECT * FROM H5_images
      WHERE phone_id = ?
      ORDER BY is_primary DESC, sort_order ASC, created_at ASC
    `;
    const [images] = await db.getDatabase().query(query, [phoneId]);
    return images;
  }

  /**
   * 保存商品图片（入库时调用）
   */
  async savePhoneImages(phoneId, images, uploadedBy) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 查询该商品的旧图片
      const [oldImages] = await connection.query('SELECT image_url FROM H5_images WHERE phone_id = ?', [phoneId]);

      // 删除旧图片的物理文件
      for (const oldImage of oldImages) {
        if (oldImage.image_url) {
          try {
            const filePath = path.join(__dirname, '../../..', oldImage.image_url);
            await fs.unlink(filePath);
            log.debug('✅ 已删除旧图片文件:', filePath);
          } catch (error) {
            log.warn('⚠️ 删除旧图片文件失败:', error.message);
          }
        }
      }

      // 删除该商品的旧图片数据库记录
      await connection.query('DELETE FROM H5_images WHERE phone_id = ?', [phoneId]);

      // 插入新图片
      for (let i = 0; i < images.length; i++) {
        await connection.query(
          `INSERT INTO H5_images (phone_id, image_url, image_type, is_primary, sort_order, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            phoneId,
            images[i].url,
            images[i].type || 'other',
            i === 0, // 第一张设为主图
            i,
            uploadedBy
          ]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 设置主图
   */
  async setPrimaryImage(imageId) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 获取图片信息
      const [images] = await connection.query('SELECT phone_id FROM H5_images WHERE id = ?', [imageId]);
      if (images.length === 0) {
        throw new Error('图片不存在');
      }

      const phoneId = images[0].phone_id;

      // 取消该商品的所有主图
      await connection.query('UPDATE H5_images SET is_primary = FALSE WHERE phone_id = ?', [phoneId]);

      // 设置新的主图
      await connection.query('UPDATE H5_images SET is_primary = TRUE WHERE id = ?', [imageId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 添加单张商品图片（不删除旧图片）
   */
  async addPhoneImage(phoneId, imageUrl, imageType, uploadedBy) {
    // 查询该商品是否已有图片
    const [existingImages] = await db.getDatabase().query(
      'SELECT COUNT(*) as count FROM H5_images WHERE phone_id = ?',
      [phoneId]
    );

    const isFirstImage = existingImages[0].count === 0;

    // 视频排在最前面（sort_order = 0），其他图片按顺序排列
    let sortOrder = existingImages[0].count;
    if (imageType === 'video') {
      sortOrder = 0;
      // 如果添加视频，将所有其他图片的sort_order加1
      await db.getDatabase().query(`
        UPDATE H5_images SET sort_order = sort_order + 1 WHERE phone_id = ?
      `, [phoneId]);
    }

    // 插入新图片
    await db.getDatabase().query(`
      INSERT INTO H5_images (phone_id, image_url, image_type, is_primary, sort_order, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [phoneId, imageUrl, imageType || 'other', isFirstImage, sortOrder, uploadedBy]);

    await this.ensurePrimaryPhoneImage(phoneId);
  }

  /**
   * 删除商品图片（同时删除物理文件）
   */
  async deleteImage(imageId) {
    // 先查询图片信息，获取文件路径
    const [images] = await db.getDatabase().query(
      'SELECT phone_id, image_url, is_primary FROM H5_images WHERE id = ?',
      [imageId]
    );

    if (images.length > 0) {
      const phoneId = images[0].phone_id;
      const imageUrl = images[0].image_url;
      const wasPrimary = Boolean(images[0].is_primary);

      // 删除数据库记录
      await db.getDatabase().query('DELETE FROM H5_images WHERE id = ?', [imageId]);

      if (wasPrimary) {
        await this.ensurePrimaryPhoneImage(phoneId);
      }

      // 删除物理文件
      if (imageUrl) {
        await this.deletePhysicalFile(imageUrl);
      }
    }
  }

  /**
   * 删除物理文件
   * @param {string} imageUrl - 图片URL路径
   */
  async deletePhysicalFile(imageUrl) {
    if (!imageUrl) return;

    try {
      // 确定上传目录路径
      const uploadDir = getUploadsRoot();

      // 图片 URL 格式：/uploads/phones/phone-xxx.jpg
      // 去掉开头的 /uploads/ 然后构建完整路径
      const relativePath = imageUrl.startsWith('/uploads/')
        ? imageUrl.substring('/uploads/'.length)
        : (imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl);

      const filePath = path.join(uploadDir, relativePath);

      // 安全检查：确保文件路径在上传目录内
      const normalizedFilePath = path.normalize(filePath);
      const normalizedUploadDir = path.normalize(uploadDir);

      if (!normalizedFilePath.startsWith(normalizedUploadDir)) {
        log.warn(`⚠️ 安全警告：尝试删除上传目录外的文件: ${filePath}`);
        return;
      }

      // 检查文件是否存在并删除
      await fs.unlink(filePath);
      log.debug('✅ 已删除图片文件:', filePath);
    } catch (error) {
      // 文件不存在或删除失败，不影响数据库记录的删除
      log.warn('⚠️ 删除图片文件失败:', error.message);
    }
  }

  /**
   * 重新排序商品图片
   * @param {number} phoneId - 商品ID
   * @param {Array<number>} imageIds - 按新顺序排列的图片ID数组
   */
  async reorderPhoneImages(phoneId, imageIds) {
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      throw new Error('图片ID列表不能为空');
    }

    // 验证所有图片都属于该商品
    const [images] = await db.getDatabase().query(`
      SELECT id FROM H5_images WHERE phone_id = ?
    `, [phoneId]);

    const validImageIds = new Set(images.map(img => img.id));

    // 检查是否有无效的图片ID
    for (const imageId of imageIds) {
      if (!validImageIds.has(imageId)) {
        throw new Error(`图片ID ${imageId} 不属于该商品`);
      }
    }

    // 更新每张图片的排序值
    for (let i = 0; i < imageIds.length; i++) {
      await db.getDatabase().query(`
        UPDATE H5_images SET sort_order = ? WHERE id = ?
      `, [i, imageIds[i]]);
    }

    log.debug(`[reorderPhoneImages] 商品 ${phoneId} 图片排序已更新:`, imageIds);
  }

  // ============================================================================
  // H5商品验机信息管理
  // ============================================================================

  /**
   * 获取商品的H5上架信息
   * @param {number} phoneId - 商品ID
   * @returns {Object|null} H5_product记录或null
   */
  async getPhoneH5Product(phoneId) {
    const [products] = await db.getDatabase().query(
      'SELECT * FROM H5_product WHERE phone_id = ?',
      [phoneId]
    );

    if (products.length === 0) {
      return null;
    }

    return products[0];
  }

  /**
   * 更新商品的H5上架信息
   * @param {number} phoneId - 商品ID
   * @param {Object} updateData - 更新数据
   */
  async updatePhoneH5Product(phoneId, updateData) {
    // 检查是否存在记录
    const [existing] = await db.getDatabase().query(
      'SELECT id FROM H5_product WHERE phone_id = ?',
      [phoneId]
    );

    if (existing.length > 0) {
      // 更新现有记录
      const updateFields = [];
      const updateValues = [];

      if (updateData.is_published !== undefined) {
        updateFields.push('is_published = ?');
        updateValues.push(updateData.is_published);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(phoneId);

        await db.getDatabase().query(
          `UPDATE H5_product SET ${updateFields.join(', ')} WHERE phone_id = ?`,
          updateValues
        );

        log.debug(`[updatePhoneH5Product] 更新商品 ${phoneId} H5信息:`, updateData);
      }
    } else {
      // 创建新记录
      await db.getDatabase().query(
        `INSERT INTO H5_product (phone_id, is_published, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`,
        [phoneId, updateData.is_published ?? 1]
      );

      log.debug(`[updatePhoneH5Product] 创建商品 ${phoneId} H5信息:`, updateData);
    }
  }

  /**
   * 保存商品验机信息
   */
  async saveProductInspection(phoneId, inspectionData) {
    const {
      condition_grade,
      battery_status,
      screen_condition,
      system_version,
      model_version,
      warranty_date,
      is_warranty_expired,
      sale_price,
      is_published
    } = inspectionData;

    // 检查是否已存在验机信息
    const [existing] = await db.getDatabase().query(
      'SELECT id FROM H5_product WHERE phone_id = ?',
      [phoneId]
    );

    if (existing.length > 0) {
      // 更新
      await db.getDatabase().query(`
        UPDATE H5_product
        SET condition_grade = ?,
            battery_status = ?,
            screen_condition = ?,
            system_version = ?,
            model_version = ?,
            warranty_date = ?,
            is_warranty_expired = ?,
            sale_price = ?,
            is_published = ?,
            updated_at = NOW()
        WHERE phone_id = ?
      `, [condition_grade, battery_status, screen_condition, system_version, model_version, warranty_date, is_warranty_expired, sale_price, is_published ?? 1, phoneId]);
    } else {
      // 插入
      await db.getDatabase().query(`
        INSERT INTO H5_product
        (phone_id, condition_grade, battery_status, screen_condition, system_version, model_version, warranty_date, is_warranty_expired, sale_price, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [phoneId, condition_grade, battery_status, screen_condition, system_version, model_version, warranty_date, is_warranty_expired, sale_price, is_published ?? 1]);
    }
  }

  /**
   * 获取商品验机信息
   */
  async getProductInspection(phoneId) {
    const [inspections] = await db.getDatabase().query(
      'SELECT * FROM H5_product WHERE phone_id = ?',
      [phoneId]
    );

    if (inspections.length === 0) {
      return null;
    }

    const inspection = inspections[0];

    // 屏幕状况枚举值转中文
    const screenConditionMap = {
      'original': '全原',
      'replaced_original': '换原屏',
      'domestic': '国产屏幕',
      'replaced_glass': '原换盖板'
    };

    return {
      ...inspection,
      screen_condition_text: screenConditionMap[inspection.screen_condition] || inspection.screen_condition
    };
  }

  // ============================================================================
  // 订单管理
  // ============================================================================

  /**
   * 获取订单列表
   */
  async getOrders({ page, limit, status, startDate, endDate, search }) {
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (startDate) {
      whereClause += ' AND o.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND o.created_at <= ?';
      params.push(endDate);
    }

    if (search) {
      whereClause += ' AND (o.order_number LIKE ? OR o.customer_phone LIKE ? OR o.customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM H5_orders o ${whereClause}`;
    const [countResult] = await db.getDatabase().query(countQuery, params);
    const total = countResult[0].total;

    // 查询数据
    const query = `
      SELECT o.*, COUNT(oi.id) as item_count
      FROM H5_orders o
      LEFT JOIN H5_order_items oi ON o.id = oi.order_id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [orders] = await db.getDatabase().query(query, [...params, limit, offset]);

    return {
      data: orders,
      page,
      limit,
      total
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(orderId) {
    // 获取订单基本信息
    const [orders] = await db.getDatabase().query('SELECT * FROM H5_orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      throw new Error('订单不存在');
    }

    const order = orders[0];

    // 获取订单商品
    const [items] = await db.getDatabase().query(
      'SELECT * FROM H5_order_items WHERE order_id = ?',
      [orderId]
    );

    return {
      ...order,
      items
    };
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(orderId, status, userId) {
    const query = `
      UPDATE H5_orders
      SET status = ?, confirmed_by = ?, confirmed_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `;
    await db.getDatabase().query(query, [status, userId, orderId]);
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  /**
   * 执行成色字段迁移
   */
  async migrateConditionGrade() {
    try {
      // 添加condition_grade字段
      await db.getDatabase().query(`
        ALTER TABLE H5_product
        ADD COLUMN IF NOT EXISTS condition_grade VARCHAR(50)
        COMMENT '商品成色：99新、98新、97新、95新、靓机、小花、大花、外爆、内爆等'
      `);

      // 添加索引
      await db.getDatabase().query(`
        ALTER TABLE H5_product
        ADD INDEX IF NOT EXISTS idx_condition_grade (condition_grade)
      `);

      log.debug('✅ 成色字段迁移成功');
    } catch (error) {
      log.error('❌ 成色字段迁移失败:', error);
      throw error;
    }
  }

  async migrateSalePrice() {
    try {
      // 检查字段是否已存在
      const [columns] = await db.getDatabase().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'H5_product' AND COLUMN_NAME = 'sale_price'
      `);

      if (columns.length > 0) {
        log.debug('ℹ️ sale_price 字段已存在，跳过添加');
      } else {
        // 添加sale_price字段
        await db.getDatabase().query(`
          ALTER TABLE H5_product
          ADD COLUMN sale_price DECIMAL(10, 2) DEFAULT NULL
          COMMENT 'H5商城销售价格（用于前端展示，单位：元）'
        `);
        log.debug('✅ sale_price字段添加成功');
      }

      // 检查索引是否已存在
      const [indexes] = await db.getDatabase().query(`
        SHOW INDEX FROM H5_product WHERE Key_name = 'idx_sale_price'
      `);

      if (indexes.length > 0) {
        log.debug('ℹ️ idx_sale_price 索引已存在，跳过添加');
      } else {
        // 添加索引
        await db.getDatabase().query(`
          ALTER TABLE H5_product
          ADD INDEX idx_sale_price (sale_price)
        `);
        log.debug('✅ idx_sale_price索引添加成功');
      }

      log.debug('✅ 销售价格字段迁移成功');
    } catch (error) {
      log.error('❌ 销售价格字段迁移失败:', error);
      throw error;
    }
  }

  /**
   * 解析配置值（根据类型转换）
   */
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
  // 全新机商品模板管理
  // ============================================================================

  /**
   * 获取商品模板列表
   */
  async getTemplates() {
    const query = `
      SELECT
        t.*,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        (SELECT COUNT(*) FROM phones p WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id AND p.is_new = 1 AND p.status = 'in_stock') as stock_count,
        (SELECT image_url FROM h5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1) as main_image
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      ORDER BY t.sort_order ASC, t.id DESC
    `;
    const [templates] = await db.getDatabase().query(query);

    // 为每个模板获取所有图片
    for (const template of templates) {
      const [images] = await db.getDatabase().query(
        'SELECT * FROM h5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
        [template.id]
      );
      template.images = images;

      // 如果没有主图但有图片，使用第一张图片作为主图
      if (!template.main_image && images.length > 0) {
        template.main_image = images[0].image_url;
      }
    }

    return templates;
  }

  /**
   * 获取商品模板详情
   */
  async getTemplateById(templateId) {
    log.debug('[getTemplateById] 查询模板详情，ID:', templateId);

    const [templates] = await db.getDatabase().query(`
      SELECT
        t.*,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        (SELECT COUNT(*) FROM phones p WHERE p.brand_id = t.brand_id AND p.model_id = t.model_id AND p.color_id = t.color_id AND p.is_new = 1 AND p.status = 'in_stock') as stock_count,
        (SELECT image_url FROM h5_newimages WHERE template_id = t.id AND is_primary = 1 LIMIT 1) as main_image
      FROM H5_newtemplates t
      LEFT JOIN brands b ON t.brand_id = b.id
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN colors c ON t.color_id = c.id
      WHERE t.id = ?
    `, [templateId]);

    if (templates.length === 0) {
      log.debug('[getTemplateById] 模板不存在');
      return null;
    }

    const template = templates[0];
    log.debug('[getTemplateById] 模板基本信息:', template);

    // 解析 memory_ids JSON 字段为数组
    if (template.memory_ids) {
      try {
        // 如果已经是数组（比如从查询返回），直接使用
        if (Array.isArray(template.memory_ids)) {
          log.debug('[getTemplateById] memory_ids 已经是数组:', template.memory_ids);
        } else {
          // 如果是字符串，尝试解析
          template.memory_ids = JSON.parse(template.memory_ids);
          log.debug('[getTemplateById] 解析 memory_ids 字符串:', template.memory_ids);
        }
      } catch (error) {
        log.error('[getTemplateById] 解析 memory_ids 失败:', error);
        template.memory_ids = [];
      }
    } else {
      template.memory_ids = [];
    }

    // 获取图片
    const [images] = await db.getDatabase().query(
      'SELECT * FROM h5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC',
      [templateId]
    );
    log.debug('[getTemplateById] 查询到的图片数量:', images.length);
    log.debug('[getTemplateById] 图片列表:', images);
    template.images = images;

    // 获取关联的库存商品（按内存分组）
    const [phones] = await db.getDatabase().query(`
      SELECT
        p.id,
        p.sale_price,
        mem.size as memory_name,
        mem.id as memory_id
      FROM phones p
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.brand_id = ? AND p.model_id = ? AND p.color_id = ?
        AND p.is_new = 1 AND p.status = 'in_stock'
      ORDER BY mem.size
    `, [template.brand_id, template.model_id, template.color_id]);

    template.phones = phones;

    return template;
  }

  /**
   * 创建商品模板
   */
  async createTemplate(templateData) {
    const { brand_id, model_id, color_id, memory_ids, template_name, description, price_markup, price_markup_type, sort_order } = templateData;

    // 保存模板
    const [result] = await db.getDatabase().query(`
      INSERT INTO H5_newtemplates (brand_id, model_id, color_id, memory_ids, template_name, description, price_markup, price_markup_type, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [brand_id, model_id, color_id, memory_ids ? JSON.stringify(memory_ids) : null, template_name, description, price_markup || 0, price_markup_type || 'fixed', sort_order || 0]);

    const templateId = result.insertId;

    // 注意：不再手动更新 price_list 的 retail_price
    // retail_price 会在采集价更新时自动计算（参考 price-list.service.js）

    return { id: templateId, ...templateData };
  }

  /**
   * 更新商品模板
   */
  async updateTemplate(templateId, templateData) {
    const { brand_id, model_id, color_id, memory_ids, template_name, description, price_markup, price_markup_type, is_active, sort_order } = templateData;

    // 获取模板信息（用于更新 price_list）
    const [templateInfo] = await db.getDatabase().query(
      'SELECT brand_id, model_id, color_id, memory_ids FROM H5_newtemplates WHERE id = ?',
      [templateId]
    );

    const updates = [];
    const values = [];

    if (brand_id !== undefined) {
      updates.push('brand_id = ?');
      values.push(brand_id);
    }
    if (model_id !== undefined) {
      updates.push('model_id = ?');
      values.push(model_id);
    }
    if (color_id !== undefined) {
      updates.push('color_id = ?');
      values.push(color_id);
    }
    if (memory_ids !== undefined) {
      updates.push('memory_ids = ?');
      values.push(memory_ids ? JSON.stringify(memory_ids) : null);
    }
    if (template_name !== undefined) {
      updates.push('template_name = ?');
      values.push(template_name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (price_markup !== undefined) {
      updates.push('price_markup = ?');
      values.push(price_markup);
    }
    if (price_markup_type !== undefined) {
      updates.push('price_markup_type = ?');
      values.push(price_markup_type);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      // 确保 BOOLEAN 值正确转换为 MySQL 的 TINYINT(1)
      const activeValue = is_active === true ? 1 : (is_active === false ? 0 : is_active);
      values.push(activeValue);
      log.debug(`[updateTemplate] 更新模板 ${templateId} 的 is_active: ${is_active} -> ${activeValue}`);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      throw new Error('没有要更新的字段');
    }

    values.push(templateId);

    log.debug(`[updateTemplate] 执行SQL: UPDATE H5_newtemplates SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ${templateId}`);
    log.debug('[updateTemplate] 参数值:', values);

    await db.getDatabase().query(`
      UPDATE H5_newtemplates
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, values);

    // 验证更新结果
    const [verifyResult] = await db.getDatabase().query(
      'SELECT id, is_active FROM H5_newtemplates WHERE id = ?',
      [templateId]
    );
    if (verifyResult.length > 0) {
      log.debug(`[updateTemplate] 验证更新结果: 模板 ${templateId} 的 is_active = ${verifyResult[0].is_active}`);
    }

    return await this.getTemplateById(templateId);
  }

  /**
   * 删除商品模板
   */
  async deleteTemplate(templateId) {
    await db.getDatabase().query('DELETE FROM H5_newtemplates WHERE id = ?', [templateId]);
  }

  /**
   * 上传模板图片
   */
  async uploadTemplateImage(templateId, file, userId) {
    if (!file) {
      throw new Error('请选择要上传的文件');
    }

    log.debug('[uploadTemplateImage] 上传媒体到模板:', templateId, '文件:', file.filename);

    const isVideo = file.mimetype?.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'other';
    const imageUrl = '/uploads/shop/' + file.filename;

    // 仅当当前模板还没有图片类媒体时，首张图片自动设为主图；视频不允许成为主图。
    const [existingImages] = await db.getDatabase().query(
      'SELECT COUNT(*) as count FROM h5_newimages WHERE template_id = ? AND image_type <> ?',
      [templateId, 'video']
    );
    const [existingMedia] = await db.getDatabase().query(
      'SELECT COUNT(*) as count FROM h5_newimages WHERE template_id = ?',
      [templateId]
    );

    const isPrimary = !isVideo && existingImages[0].count === 0;
    const sortOrder = Number(existingMedia[0]?.count || 0);
    log.debug('[uploadTemplateImage] 是否设为主图:', isPrimary);

    const [result] = await db.getDatabase().query(`
      INSERT INTO h5_newimages (template_id, image_url, image_type, is_primary, sort_order, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [templateId, imageUrl, mediaType, isPrimary, sortOrder, userId]);

    await this.ensurePrimaryTemplateImage(templateId);

    log.debug('[uploadTemplateImage] 媒体已保存到数据库，ID:', result.insertId);

    // 返回完整的图片信息
    const [newImage] = await db.getDatabase().query(
      'SELECT * FROM h5_newimages WHERE id = ?',
      [result.insertId]
    );

    return newImage[0];
  }

  /**
   * 删除模板图片
   */
  async deleteTemplateImage(templateId, imageId) {
    // 先查询图片信息，获取文件路径
    const [images] = await db.getDatabase().query(
      'SELECT image_url, is_primary FROM h5_newimages WHERE id = ? AND template_id = ?',
      [imageId, templateId]
    );

    if (images.length > 0) {
      const imageUrl = images[0].image_url;
      const wasPrimary = Boolean(images[0].is_primary);

      // 删除数据库记录
      await db.getDatabase().query('DELETE FROM h5_newimages WHERE id = ? AND template_id = ?', [imageId, templateId]);

      if (wasPrimary) {
        await this.ensurePrimaryTemplateImage(templateId);
      }

      // 删除物理文件
      if (imageUrl) {
        await this.deletePhysicalFile(imageUrl);
      }
    }
  }

  /**
   * 设置模板主图
   */
  async setPrimaryTemplateImage(templateId, imageId) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 验证图片是否属于该模板
      const [images] = await connection.query(
        'SELECT id, image_type FROM h5_newimages WHERE id = ? AND template_id = ?',
        [imageId, templateId]
      );

      if (images.length === 0) {
        throw new Error('图片不存在');
      }

      if (images[0].image_type === 'video') {
        throw new Error('视频不能设置为主图');
      }

      // 取消该模板的所有主图
      await connection.query(
        'UPDATE h5_newimages SET is_primary = 0 WHERE template_id = ?',
        [templateId]
      );

      // 设置新的主图
      await connection.query(
        'UPDATE h5_newimages SET is_primary = 1 WHERE id = ? AND template_id = ?',
        [imageId, templateId]
      );

      await connection.commit();
      log.debug(`[setPrimaryTemplateImage] 已设置模板 ${templateId} 的主图为图片 ${imageId}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 批量更新模板排序
   * @param {Array} orders - [{ id: number, sort_order: number }, ...]
   */
  async reorderTemplates(orders) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of orders) {
        if (!item.id || item.sort_order === undefined) {
          log.warn('[reorderTemplates] 跳过无效项:', item);
          continue;
        }

        await connection.query(
          'UPDATE H5_newtemplates SET sort_order = ?, updated_at = NOW() WHERE id = ?',
          [item.sort_order, item.id]
        );
      }

      await connection.commit();
      log.debug('[reorderTemplates] 批量更新排序成功，共', orders.length, '项');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 批量更新模板图片排序
   * @param {number} templateId - 模板ID
   * @param {Array} orders - [{ id: number, sort_order: number }, ...]
   */
  async reorderTemplateImages(templateId, orders) {
    const pool = db.getDatabase();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of orders) {
        if (!item.id || item.sort_order === undefined) {
          log.warn('[reorderTemplateImages] 跳过无效项:', item);
          continue;
        }

        await connection.query(
          'UPDATE h5_newimages SET sort_order = ? WHERE id = ? AND template_id = ?',
          [item.sort_order, item.id, templateId]
        );
      }

      await connection.commit();
      log.debug('[reorderTemplateImages] 批量更新图片排序成功，模板ID:', templateId, '共', orders.length, '项');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // 已废弃：自动更新 price_list 的 retail_price
  // ============================================================================

  /**
   * @deprecated 此方法已废弃，零售价现在由 price-list.service.js 在采集价更新时自动计算
   * 之前的逻辑：编辑模板时手动更新零售价
   * 新的逻辑：采集价更新时自动查询模板并计算零售价
   *
   * 保留此方法仅作参考，实际已不再使用
   */
  async updatePriceListRetailPrice_deprecated() {
    log.warn('[updatePriceListRetailPrice_deprecated] 此方法已废弃，不应再调用');
    // 方法体保留但不再执行任何操作
  }
}

module.exports = ShopService;
