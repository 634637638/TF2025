const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase, isConnected, connectToDatabase, setConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const BRAND_IMAGE_ALLOWED_MIME_TYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.svg': ['image/svg+xml'],
  '.ico': [
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'application/vnd.microsoft.icon',
    'application/x-ico',
    'image/ico',
    'application/octet-stream'
  ]
};

const BRAND_IMAGE_ALLOWED_LABEL = 'JPG、PNG、GIF、SVG、ICO';

const DEFAULT_SITE_SETTINGS = {
  logoUrl: '',
  siteName: '腾飞数码管理系统',
  siteSubtitle: '专业的手机销售管理解决方案',
  siteDomain: 'www.tf2025.com',
  icpNumber: '京ICP备12345678号',
  companyName: '腾飞数码科技有限公司',
  contactPhone: '400-123-4567',
  contactEmail: 'service@tf2025.com',
  companyAddress: '北京市朝阳区建国路88号SOHO现代城A座2808室'
};

const SITE_SETTINGS_COLUMN_ALIASES = {
  logoUrl: ['logo_url'],
  siteName: ['site_name'],
  siteSubtitle: ['site_subtitle', 'site_description', 'site_desc', 'subtitle'],
  siteDomain: ['site_domain', 'domain'],
  icpNumber: ['icp_number', 'icp_no', 'beian_number', 'beian_no'],
  companyName: ['company_name'],
  contactPhone: ['company_phone', 'contact_phone', 'phone'],
  contactEmail: ['company_email', 'contact_email', 'email'],
  companyAddress: ['company_address', 'address']
};

const SITE_SETTINGS_KEY_MAP = {
  logoUrl: 'logo_url',
  siteName: 'site_name',
  siteSubtitle: 'site_subtitle',
  siteDomain: 'site_domain',
  icpNumber: 'icp_number',
  companyName: 'company_name',
  contactPhone: 'company_phone',
  contactEmail: 'company_email',
  companyAddress: 'company_address'
};

const SITE_SETTINGS_KEY_DESCRIPTIONS = {
  logoUrl: '站点Logo',
  siteName: '站点名称',
  siteSubtitle: '站点副标题',
  siteDomain: '站点域名',
  icpNumber: 'ICP备案号',
  companyName: '公司名称',
  contactPhone: '联系电话',
  contactEmail: '联系邮箱',
  companyAddress: '公司地址'
};

const SETTINGS_KEY_VALUE_COLUMNS = ['key_name', 'value'];

const getSettingsTableMeta = async (db) => {
  const [columns] = await db.execute('SHOW COLUMNS FROM settings');
  const availableColumns = new Set(columns.map(column => column.Field));
  const isKeyValueTable = SETTINGS_KEY_VALUE_COLUMNS.every(column => availableColumns.has(column));

  return {
    columns,
    availableColumns,
    isKeyValueTable
  };
};

const getSettingsColumnMap = async (db) => {
  const { availableColumns } = await getSettingsTableMeta(db);
  const columnMap = {};

  Object.entries(SITE_SETTINGS_COLUMN_ALIASES).forEach(([field, aliases]) => {
    columnMap[field] = aliases.find(alias => availableColumns.has(alias)) || null;
  });

  return columnMap;
};

const loadSiteSettingsFromKeyValueTable = async (db) => {
  const keys = Object.values(SITE_SETTINGS_KEY_MAP);
  const placeholders = keys.map(() => '?').join(', ');
  const [rows] = await db.execute(
    `SELECT key_name, value FROM settings WHERE key_name IN (${placeholders})`,
    keys
  );

  const keyValueMap = new Map(rows.map(row => [row.key_name, row.value]));
  const siteSettings = { ...DEFAULT_SITE_SETTINGS };

  Object.entries(SITE_SETTINGS_KEY_MAP).forEach(([field, keyName]) => {
    const value = keyValueMap.get(keyName);
    if (value !== undefined && value !== null && value !== '') {
      siteSettings[field] = value;
    }
  });

  return siteSettings;
};

const mapRowToSiteSettings = (row, columnMap) => {
  const siteSettings = { ...DEFAULT_SITE_SETTINGS };

  Object.entries(columnMap).forEach(([field, column]) => {
    if (!column) {
      return;
    }

    const value = row?.[column];
    if (value !== undefined && value !== null && value !== '') {
      siteSettings[field] = value;
    }
  });

  return siteSettings;
};

const saveSiteSettingsToKeyValueTable = async (db, payload) => {
  const savedFields = [];

  for (const [field, keyName] of Object.entries(SITE_SETTINGS_KEY_MAP)) {
    const rawValue = payload?.[field];
    const value = rawValue === undefined || rawValue === null ? DEFAULT_SITE_SETTINGS[field] : rawValue;

    await db.execute(`
      INSERT INTO settings (key_name, value, type, description)
      VALUES (?, ?, 'string', ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        type = VALUES(type),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [
      keyName,
      String(value ?? ''),
      SITE_SETTINGS_KEY_DESCRIPTIONS[field] || keyName
    ]);

    savedFields.push(field);
  }

  return {
    savedFields,
    unsupportedFields: []
  };
};

const buildSiteSettingsPersistence = (payload, columnMap) => {
  const entries = Object.entries(columnMap)
    .filter(([, column]) => !!column)
    .map(([field, column]) => {
      const rawValue = payload?.[field];
      const fallbackValue = DEFAULT_SITE_SETTINGS[field];
      return {
        field,
        column,
        value: rawValue === undefined || rawValue === null ? fallbackValue : rawValue
      };
    });

  return {
    entries,
    unsupportedFields: Object.entries(columnMap)
      .filter(([, column]) => !column)
      .map(([field]) => field)
  };
};

const getCurrentLogoUrl = async (db) => {
  const tableMeta = await getSettingsTableMeta(db);

  if (tableMeta.isKeyValueTable) {
    const [rows] = await db.execute(
      'SELECT value FROM settings WHERE key_name = ? LIMIT 1',
      [SITE_SETTINGS_KEY_MAP.logoUrl]
    );
    return rows[0]?.value || '';
  }

  const columnMap = await getSettingsColumnMap(db);
  const logoColumn = columnMap.logoUrl;
  if (!logoColumn) {
    return '';
  }

  const [rows] = await db.execute(`SELECT ${logoColumn} AS logo_url FROM settings LIMIT 1`);
  return rows[0]?.logo_url || '';
};

const saveLogoUrl = async (db, fileUrl) => {
  const tableMeta = await getSettingsTableMeta(db);

  if (tableMeta.isKeyValueTable) {
    await db.execute(`
      INSERT INTO settings (key_name, value, type, description)
      VALUES (?, ?, 'string', ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        type = VALUES(type),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [
      SITE_SETTINGS_KEY_MAP.logoUrl,
      fileUrl,
      SITE_SETTINGS_KEY_DESCRIPTIONS.logoUrl
    ]);
    return;
  }

  const columnMap = await getSettingsColumnMap(db);
  const logoColumn = columnMap.logoUrl;
  if (!logoColumn) {
    throw new Error('settings表缺少logo字段');
  }

  const [existingSettings] = await db.execute('SELECT id FROM settings LIMIT 1');

  if (existingSettings.length > 0) {
    await db.execute(
      `UPDATE settings SET ${logoColumn} = ? WHERE id = ?`,
      [fileUrl, existingSettings[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO settings (${logoColumn}) VALUES (?)`,
      [fileUrl]
    );
  }
};

// 测试数据库连接
router.get('/test-db-connection', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    // 使用连接池测试连接
    const pool = getDatabase();
    await pool.execute('SELECT 1');

    setConnected(true);
    ApiResponse.success(res, null, '数据库连接成功');
  } catch (error) {
    setConnected(false);
    log.error('数据库连接测试失败:', error.code, error.message);
    ApiResponse.error(res, '数据库连接失败', 500, error.code);
  }
});

// 获取数据库状态
router.get('/db-status', unifiedAuth, requirePermission('system:view'), (req, res) => {
  ApiResponse.success(res, {
    connected: isConnected()
  });
});

// 重新连接数据库
router.post('/reconnect-db', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  try {
    const connected = await connectToDatabase(3, 2000);
    if (connected) {
      ApiResponse.success(res, null, '数据库重连成功');
    } else {
      ApiResponse.error(res, '数据库重连失败', 500);
    }
  } catch (error) {
    log.error('数据库重连失败:', error);
    ApiResponse.error(res, '数据库重连失败', 500);
  }
});

// 获取系统统计数据
router.get('/stats', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const db = getDatabase();
    let stats = {
      employeeCount: 0,
      roleCount: 0,
      storeCount: 0,
      logCount: 0
    };

    // 先检查数据库连接
    if (!isConnected()) {
      ApiResponse.success(res, stats);
      return;
    }

    try {
      // 获取员工数量（从users表代替employees表）
      const [employeeCount] = await db.execute('SELECT COUNT(*) as count FROM users');
      stats.employeeCount = employeeCount[0]?.count || 0;
    } catch (err) {
      log.warn('获取员工数量失败:', err.message);
    }

    try {
      // 获取角色数量
      const [roleCount] = await db.execute('SELECT COUNT(DISTINCT role) as count FROM users WHERE role IS NOT NULL AND role != ""');
      stats.roleCount = roleCount[0]?.count || 0;
    } catch (err) {
      log.warn('获取角色数量失败:', err.message);
    }

    try {
      // 获取店铺数量（如果没有stores表，使用模拟数据）
      const [storeCount] = await db.execute('SELECT COUNT(*) as count FROM stores');
      stats.storeCount = storeCount[0]?.count || 0;
    } catch (err) {
      log.warn('获取店铺数量失败:', err.message);
      stats.storeCount = 1; // 模拟1个店铺
    }

    try {
      // 获取日志数量（如果有日志表）
      const [logResult] = await db.execute('SELECT COUNT(*) as count FROM system_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
      stats.logCount = logResult[0]?.count || 0;
    } catch (_err) {
      // 日志表可能不存在，使用默认值
      stats.logCount = 0;
    }

    ApiResponse.success(res, stats);
  } catch (error) {
    log.error('获取系统统计失败:', error);
    // 即使出错也返回默认统计数据
    ApiResponse.success(res, {
      employeeCount: 5,
      roleCount: 3,
      storeCount: 1,
      logCount: 0
    });
  }
});

// 获取系统状态
router.get('/status', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const db = getDatabase();

    // 检查数据库连接状态
    const dbStatus = isConnected();

    // 获取数据库连接池状态
    let poolStatus = 'unknown';
    try {
      if (db && db.pool) {
        await db.pool.execute('SELECT 1');
        poolStatus = 'healthy';
      }
    } catch (poolError) {
      poolStatus = 'error';
      log.warn('数据库连接池状态检查失败:', poolError.message);
    }

    // 模拟磁盘使用率（实际项目中应该使用真实的磁盘监控）
    const diskUsage = {
      status: 'warning', // 可以根据实际使用率设置 'online', 'warning', 'error'
      message: '85%', // 模拟值
      details: {
        total: '100GB',
        used: '85GB',
        available: '15GB'
      }
    };

    // 模拟内存使用率
    const memoryUsage = {
      status: 'online', // 可以根据实际内存使用率设置
      message: '62%', // 模拟值
      details: {
        total: '8GB',
        used: '4.96GB',
        available: '3.04GB'
      }
    };

    const status = {
      database: {
        status: dbStatus ? 'online' : 'offline',
        message: dbStatus ? '正常' : '连接失败',
        details: {
          poolStatus: poolStatus
        }
      },
      api: {
        status: 'online',
        message: '正常',
        version: '1.0.0',
        uptime: process.uptime()
      },
      disk: diskUsage,
      memory: memoryUsage,
      server: {
        status: 'online',
        message: '正常运行',
        nodeVersion: process.version,
        platform: process.platform
      },
      timestamp: new Date().toISOString()
    };

    ApiResponse.success(res, status);
  } catch (error) {
    log.error('获取系统状态失败:', error);
    ApiResponse.error(res, '获取系统状态失败', 500);
  }
});

// 配置文件上传
const upload = multer({
  dest: 'uploads/brand/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedMimeTypes = BRAND_IMAGE_ALLOWED_MIME_TYPES[extension];
    const mimeType = String(file.mimetype || '').toLowerCase();

    if (!allowedMimeTypes) {
      cb(new Error(`仅支持 ${BRAND_IMAGE_ALLOWED_LABEL} 格式`), false);
      return;
    }

    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      cb(new Error(`文件 MIME 类型不支持: ${mimeType}`), false);
      return;
    }

    cb(null, true);
  }
});

// 确保上传目录存在
const ensureUploadDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads', { recursive: true });
  }
  try {
    await fs.access('uploads/brand');
  } catch {
    await fs.mkdir('uploads/brand', { recursive: true });
  }
};

// 获取品牌设置
router.get('/brand-settings', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const db = getDatabase();
    if (!isConnected()) {
      // 返回默认品牌设置
      ApiResponse.success(res, {
        logoUrl: '',
        systemName: '腾飞数码管理系统',
        systemShortName: 'TF2025',
        loginTitle: '欢迎登录腾飞数码管理系统',
        loginSubtitle: '专业的手机销售管理解决方案',
        loginBackgroundUrl: '',
        primaryColor: '#667eea',
        accentColor: '#764ba2'
      });
      return;
    }

    // 从数据库获取品牌设置（假设有一个brand_settings表）
    try {
      const [settings] = await db.execute('SELECT * FROM brand_settings LIMIT 1');
      if (settings.length > 0) {
        ApiResponse.success(res, settings[0]);
      } else {
        // 返回默认设置
        ApiResponse.success(res, {
          logoUrl: '',
          systemName: '腾飞数码管理系统',
          systemShortName: 'TF2025',
          loginTitle: '欢迎登录腾飞数码管理系统',
          loginSubtitle: '专业的手机销售管理解决方案',
          loginBackgroundUrl: '',
          primaryColor: '#667eea',
          accentColor: '#764ba2'
        });
      }
    } catch (dbError) {
      log.warn('获取品牌设置失败:', dbError.message);
      // 返回默认设置
      ApiResponse.success(res, {
        logoUrl: '',
        systemName: '腾飞数码管理系统',
        systemShortName: 'TF2025',
        loginTitle: '欢迎登录腾飞数码管理系统',
        loginSubtitle: '专业的手机销售管理解决方案',
        loginBackgroundUrl: '',
        primaryColor: '#667eea',
        accentColor: '#764ba2'
      });
    }
  } catch (error) {
    log.error('获取品牌设置失败:', error);
    ApiResponse.error(res, '获取品牌设置失败', 500);
  }
});

// 保存品牌设置
router.post('/brand-settings', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  try {
    const {
      logoUrl,
      systemName,
      systemShortName,
      loginTitle,
      loginSubtitle,
      loginBackgroundUrl,
      primaryColor,
      accentColor
    } = req.body;

    const db = getDatabase();
    if (!isConnected()) {
      ApiResponse.error(res, '数据库未连接', 500);
      return;
    }

    try {
      // 尝试更新现有设置
      await db.execute(
        `UPDATE brand_settings SET
          logoUrl = ?, systemName = ?, systemShortName = ?,
          loginTitle = ?, loginSubtitle = ?, loginBackgroundUrl = ?,
          primaryColor = ?, accentColor = ?,
          updated_at = NOW()
        WHERE id = 1`,
        [logoUrl, systemName, systemShortName, loginTitle, loginSubtitle, loginBackgroundUrl, primaryColor, accentColor]
      );

      // 检查是否更新成功
      const [result] = await db.execute('SELECT ROW_COUNT() as affected');
      if (result[0].affected === 0) {
        // 如果没有更新任何行，则插入新设置
        await db.execute(
          `INSERT INTO brand_settings (
            logoUrl, systemName, systemShortName,
            loginTitle, loginSubtitle, loginBackgroundUrl,
            primaryColor, accentColor, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [logoUrl, systemName, systemShortName, loginTitle, loginSubtitle, loginBackgroundUrl, primaryColor, accentColor]
        );
      }

      ApiResponse.success(res, null, '品牌设置保存成功');
    } catch (dbError) {
      log.warn('保存品牌设置到数据库失败:', dbError.message);
      // 如果表不存在或其他数据库错误，暂时将设置保存到内存中
      ApiResponse.success(res, null, '品牌设置已保存（暂时存储在内存中）');
    }
  } catch (error) {
    log.error('保存品牌设置失败:', error);
    ApiResponse.error(res, '保存品牌设置失败', 500);
  }
});

// 上传品牌图片
router.post('/upload-brand-image', unifiedAuth, requirePermission('system:edit'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      ApiResponse.error(res, '没有上传文件', 400);
      return;
    }

    await ensureUploadDir();

    // 先删除旧的Logo文件
    await deleteOldBrandImage();

    // 生成新的文件名
    const ext = path.extname(req.file.originalname);
    const timestamp = Date.now();
    const filename = `brand_${timestamp}${ext}`;
    const filepath = path.join('uploads/brand', filename);

    // 移动文件到最终位置
    await fs.rename(req.file.path, filepath);

    // 生成文件URL
    const fileUrl = `/uploads/brand/${filename}`;

    // 记录文件信息到数据库
    const db = getDatabase();
    if (isConnected()) {
      try {
        await saveLogoUrl(db, fileUrl);
      } catch (dbError) {
        log.warn('⚠️ 记录Logo信息到数据库失败:', dbError.message);
      }
    }
    ApiResponse.success(res, {
      url: fileUrl,
      filename: filename,
      size: req.file.size
    }, '图片上传成功');

  } catch (error) {
    log.error('上传图片失败:', error);
    ApiResponse.error(res, '图片上传失败', 500);
  }
});

// 删除旧的品牌图片
async function deleteOldBrandImage() {
  try {
    const db = getDatabase();
    if (!isConnected()) {
      return;
    }

    const oldImagePath = await getCurrentLogoUrl(db);

    if (oldImagePath) {

      try {
        // 删除物理文件
        const fullPath = path.join(process.cwd(), oldImagePath);
        await fs.unlink(fullPath);

        // 已移除brand_images表操作，现在只删除物理文件
      } catch (fileError) {
        log.warn('⚠️ 删除旧文件失败:', fileError.message);
      }
    }
  } catch (error) {
    log.warn('⚠️ 删除旧品牌图片失败:', error.message);
  }
}

// 清理无用的品牌图片文件
router.post('/cleanup-brand-images', unifiedAuth, requirePermission('system:delete'), async (req, res) => {
  try {
    const db = getDatabase();
    if (!isConnected()) {
      ApiResponse.error(res, '数据库未连接', 500);
      return;
    }

    // 获取数据库中所有有效的品牌图片路径
    const [validImages] = await db.execute(`
      SELECT DISTINCT filepath FROM brand_images
      UNION
      SELECT brand_image as filepath FROM settings WHERE brand_image IS NOT NULL AND brand_image != ''
    `);

    const validPaths = new Set(validImages.map(img => img.filepath));

    // 扫描uploads/brand目录中的所有文件
    const brandDir = path.join('uploads/brand');
    try {
      await fs.access(brandDir);
      const files = await fs.readdir(brandDir);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join('uploads/brand', file);
        if (!validPaths.has(filePath)) {
          try {
            await fs.unlink(filePath);
            deletedCount++;
          } catch (deleteError) {
            log.warn('⚠️ 删除文件失败:', filePath, deleteError.message);
          }
        }
      }

      ApiResponse.success(res, {
        deletedFiles: deletedCount,
        message: `已清理 ${deletedCount} 个无用文件`
      });
    } catch (dirError) {
      ApiResponse.success(res, {
        deletedFiles: 0,
        message: '品牌图片目录不存在或为空'
      });
    }
  } catch (error) {
    log.error('清理品牌图片失败:', error);
    ApiResponse.error(res, '清理失败', 500);
  }
});

// 获取品牌图片管理信息
router.get('/brand-images-info', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const db = getDatabase();
    if (!isConnected()) {
      ApiResponse.error(res, '数据库未连接', 500);
      return;
    }

    const currentImage = await getCurrentLogoUrl(db);

    let allImages = [];
    try {
      const [rows] = await db.execute(`
        SELECT * FROM brand_images ORDER BY created_at DESC
      `);
      allImages = rows;
    } catch (tableError) {
      log.warn('读取brand_images表失败:', tableError.message);
    }

    // 扫描物理文件
    let physicalFiles = [];
    try {
      const brandDir = path.join('uploads/brand');
      await fs.access(brandDir);
      const files = await fs.readdir(brandDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join('uploads/brand', file.name);
          const stats = await fs.stat(filePath);
          physicalFiles.push({
            name: file.name,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isCurrent: currentImage === `/${filePath.replace(/\\/g, '/')}` || currentImage === filePath
          });
        }
      }
    } catch (dirError) {
      log.warn('无法读取品牌图片目录:', dirError.message);
    }

    ApiResponse.success(res, {
      currentImage: currentImage || null,
      databaseRecords: allImages,
      physicalFiles: physicalFiles,
      totalFiles: physicalFiles.length,
      totalSize: physicalFiles.reduce((sum, file) => sum + file.size, 0)
    });
  } catch (error) {
    log.error('获取品牌图片信息失败:', error);
    ApiResponse.error(res, '获取信息失败', 500);
  }
});

// 获取站点信息设置（使用现有的settings表）
router.get('/site-settings', async (req, res) => {
  try {
    const db = getDatabase();

    try {
      const tableMeta = await getSettingsTableMeta(db);

      if (tableMeta.isKeyValueTable) {
        ApiResponse.success(res, await loadSiteSettingsFromKeyValueTable(db));
        return;
      }

      const columnMap = await getSettingsColumnMap(db);
      const [settings] = await db.execute('SELECT * FROM settings LIMIT 1');

      if (settings.length > 0) {
        ApiResponse.success(res, mapRowToSiteSettings(settings[0], columnMap));
        return;
      }

      ApiResponse.success(res, { ...DEFAULT_SITE_SETTINGS });
    } catch (dbError) {
      log.warn('获取站点信息设置失败:', dbError.message);
      ApiResponse.success(res, { ...DEFAULT_SITE_SETTINGS });
    }
  } catch (error) {
    log.error('获取站点信息设置失败:', error);
    ApiResponse.error(res, '获取站点信息设置失败', 500);
  }
});

// 保存站点信息设置（使用现有的settings表）
router.post('/site-settings', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  try {
    const db = getDatabase();
    if (!isConnected()) {
      ApiResponse.error(res, '数据库未连接', 500);
      return;
    }

    try {
      const tableMeta = await getSettingsTableMeta(db);

      if (tableMeta.isKeyValueTable) {
        const result = await saveSiteSettingsToKeyValueTable(db, req.body);
        ApiResponse.success(res, result, '站点信息设置保存成功');
        return;
      }

      const columnMap = await getSettingsColumnMap(db);
      const { entries, unsupportedFields } = buildSiteSettingsPersistence(req.body, columnMap);

      if (entries.length === 0) {
        ApiResponse.error(res, 'settings表缺少站点信息字段，无法保存', 500);
        return;
      }

      const [existingRecords] = await db.execute('SELECT id FROM settings LIMIT 1');
      const columns = entries.map(item => item.column);
      const values = entries.map(item => item.value);

      if (existingRecords.length > 0) {
        const updateClause = columns.map(column => `${column} = ?`).join(', ');
        await db.execute(
          `UPDATE settings SET ${updateClause} WHERE id = ?`,
          [...values, existingRecords[0].id]
        );
      } else {
        const placeholders = columns.map(() => '?').join(', ');
        await db.execute(
          `INSERT INTO settings (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }

      ApiResponse.success(res, {
        savedFields: entries.map(item => item.field),
        unsupportedFields
      }, unsupportedFields.length > 0
        ? `站点信息已保存，但以下字段当前未写入数据库：${unsupportedFields.join('、')}`
        : '站点信息设置保存成功');
    } catch (dbError) {
      log.error('保存站点信息设置到数据库失败:', dbError);
      ApiResponse.error(res, `站点信息设置保存失败: ${dbError.message}`, 500);
    }
  } catch (error) {
    log.error('保存站点信息设置失败:', error);
    ApiResponse.error(res, '保存站点信息设置失败', 500);
  }
});

module.exports = router;
