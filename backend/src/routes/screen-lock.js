/**
 * 屏幕保护设置 API 路由
 * 处理屏幕锁定功能的配置管理
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const { getDatabase, isConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

// 存储配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads/screen-lock');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    const fileType = isImage ? 'image' : 'video';
    cb(null, `screen-lock-${fileType}-${uniqueSuffix}${ext}`);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 图片文件检查
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  // 视频文件检查
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPEG、PNG、GIF、WebP 格式的图片和 MP4、WebM、OGG 格式的视频'), false);
  }
};

// 上传配置
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  }
});

// 系统设置文件路径
const SETTINGS_FILE = path.join(__dirname, '../lock/screen-lock-settings.json');

// 默认系统设置（背景相关设置）
const DEFAULT_SYSTEM_SETTINGS = {
  backgroundType: 'default',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁',
  // 在库查询密码设置
  inventoryQueryPassword: null // 默认为空，表示使用登录密码验证
};

// 确保数据目录存在
async function ensureDataDir() {
  const dataDir = path.dirname(SETTINGS_FILE);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    log.error('创建数据目录失败:', error);
  }
}

// 读取系统设置
async function loadSystemSettings() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在，返回默认设置
      await saveSystemSettings(DEFAULT_SYSTEM_SETTINGS);
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }
    log.error('读取屏幕锁定设置失败:', error);
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}

// 保存系统设置
async function saveSystemSettings(settings) {
  try {
    await ensureDataDir();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    log.error('保存屏幕锁定设置失败:', error);
    return false;
  }
}


// 获取屏幕锁定设置（仅背景设置）
router.get('/', unifiedAuth, async (req, res) => {
  try {
    const settings = await loadSystemSettings();

    res.json({
      success: true,
      data: settings,
      message: '获取屏幕锁定设置成功'
    });
  } catch (error) {
    log.error('获取屏幕锁定设置失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取设置失败'
      }
    });
  }
});

// 更新系统背景设置
router.post('/', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  try {
    const {
      backgroundType,
      imageUrl,
      videoUrl,
      title,
      message,
      inventoryQueryPassword
    } = req.body;

    // 验证背景类型
    const validBackgroundTypes = ['default', 'image', 'video'];
    if (backgroundType && !validBackgroundTypes.includes(backgroundType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '无效的背景类型'
        }
      });
    }

    // 准备设置数据
    const settings = {
      backgroundType: backgroundType || 'default',
      imageUrl: imageUrl || '',
      videoUrl: videoUrl || '',
      title: title || '屏幕已锁定',
      message: message || '请输入密码解锁',
      inventoryQueryPassword: inventoryQueryPassword || null
    };

    // 保存设置
    const saved = await saveSystemSettings(settings);

    if (saved) {
      res.json({
        success: true,
        data: settings,
        message: '屏幕锁定设置保存成功'
      });
    } else {
      throw new Error('保存设置失败');
    }
  } catch (error) {
    log.error('保存屏幕锁定设置失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '保存设置失败'
      }
    });
  }
});

// 统一文件上传路由 (兼容 /api/v1/upload/screen-lock)
router.post('/upload/screen-lock',
  unifiedAuth,
  requirePermission('system:edit'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: '未上传文件'
          }
        });
      }

      // 根据文件类型判断是图片还是视频
      const isImage = req.file.mimetype.startsWith('image/');
      const isVideo = req.file.mimetype.startsWith('video/');

      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: '只支持图片或视频文件'
          }
        });
      }

      // 构建文件访问URL
      const fileUrl = `/uploads/screen-lock/${req.file.filename}`;
      const fileType = isImage ? '图片' : '视频';

      res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: fileUrl,
          type: isImage ? 'image' : 'video'
        },
        message: `${fileType}上传成功`
      });
    } catch (error) {
      log.error('上传文件失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: '上传失败'
        }
      });
    }
  }
);


// 验证解锁密码（使用登录密码）
router.post('/verify', unifiedAuth, async (req, res) => {
  try {
    log.debug('🔐 开始验证屏幕锁定密码');
    const { password } = req.body;
    const userId = req.user.sub || req.user.id || req.user.userId;
    log.debug('🔑 用户ID提取:', {
      sub: req.user.sub,
      id: req.user.id,
      userId: req.user.userId,
      finalUserId: userId
    });

    log.debug('📝 验证信息:', {
      hasPassword: !!password,
      passwordLength: password?.length,
      userId,
      user: req.user
    });

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PASSWORD',
          message: '请输入密码'
        }
      });
    }

    // 验证密码是否与登录密码一致
    const db = getDatabase();
    if (!isConnected()) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: '数据库未连接'
        }
      });
    }

    // 查询用户的密码
    const [users] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    // 验证密码
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(password, users[0].password);

    if (isValid) {
      res.json({
        success: true,
        message: '密码验证成功'
      });
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '密码错误'
        }
      });
    }
  } catch (error) {
    log.error('验证屏幕锁定密码失败:', error);
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '验证失败'
      }
    });
  }
});

// 获取在库查询用户列表（系统设置编辑权限）
router.get('/query-users', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  let connection;
  try {
    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    const [rows] = await connection.execute(`
      SELECT id, name, password, is_active, created_at, updated_at, remarks
      FROM query_users
      ORDER BY created_at DESC
    `);

    // 不返回密码明文，只返回掩码
    const maskedRows = rows.map(row => ({
      ...row,
      password: '******' // 密码掩码
    }));

    ApiResponse.success(res, '获取密码列表成功', {
      total: maskedRows.length,
      data: maskedRows
    });
  } catch (error) {
    log.error('获取在库查询密码列表失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '获取密码列表失败', error);
  } finally {
    if (connection) connection.release();
  }
});

// 添加在库查询用户（系统设置编辑权限）
router.post('/query-users', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  let connection;
  try {
    const { name, password, remarks } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: '用户名和密码不能为空'
        }
      });
    }

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 使用 bcrypt 加密密码
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    log.debug('🔐 密码加密完成，原始密码长度:', password.length, '加密后长度:', hashedPassword.length);

    const [result] = await connection.execute(`
      INSERT INTO query_users (name, password, remarks, created_by)
      VALUES (?, ?, ?, ?)
    `, [name, hashedPassword, remarks || '', req.user.id]);

    ApiResponse.success(res, '添加用户成功', {
      id: result.insertId,
      name,
      remarks
    });
  } catch (error) {
    log.error('添加在库查询用户失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '添加用户失败', error);
  } finally {
    if (connection) connection.release();
  }
});

// 更新在库查询用户（系统设置编辑权限）
router.put('/query-users/:id', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { name, password, is_active, remarks } = req.body;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (password !== undefined && password !== '') {
      // 使用 bcrypt 加密新密码
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      log.debug('🔐 更新密码加密完成，原始密码长度:', password.length, '加密后长度:', hashedPassword.length);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    } else {
      log.debug('⚠️ 密码字段为空，跳过密码更新');
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(remarks);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FIELDS',
          message: '没有要更新的字段'
        }
      });
    }

    updateValues.push(id);

    await connection.execute(`
      UPDATE query_users
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    ApiResponse.success(res, '更新用户成功');
  } catch (error) {
    log.error('更新在库查询用户失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '更新用户失败', error);
  } finally {
    if (connection) connection.release();
  }
});

// 删除在库查询用户（系统设置删除权限）
router.delete('/query-users/:id', unifiedAuth, requirePermission('system:delete'), async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    await connection.execute(`
      DELETE FROM query_users
      WHERE id = ?
    `, [id]);

    ApiResponse.success(res, '删除用户成功');
  } catch (error) {
    log.error('删除在库查询用户失败:', error);
    if (connection) connection.release();
    ApiResponse.serverError(res, '删除用户失败', error);
  } finally {
    if (connection) connection.release();
  }
});

// 验证在库查询密码（无需登录，使用多密码验证）
router.post('/verify-inventory-query', async (req, res) => {
  let connection;
  try {
    log.debug('📦 开始验证在库查询密码（无需登录）');
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PASSWORD',
          message: '请输入密码'
        }
      });
    }

    const pool = require('../config/database').getDatabase();
    connection = await pool.getConnection();

    // 查询数据库中所有启用的用户
    const [rows] = await connection.execute(`
      SELECT id, name, password
      FROM query_users
      WHERE is_active = 1
    `);

    let matchedUser = null;
    const bcrypt = require('bcryptjs');

    // 在数据库中查找匹配的密码
    for (const row of rows) {
      const isMatch = await bcrypt.compare(password, row.password);
      if (isMatch) {
        matchedUser = {
          id: row.id,
          name: row.name
        };
        break;
      }
    }

    if (matchedUser) {
      log.debug('✅ 密码验证成功，用户:', matchedUser.name);
      res.json({
        success: true,
        message: '密码验证成功',
        data: {
          userName: matchedUser.name
        }
      });
    } else {
      log.debug('❌ 密码验证失败');
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '密码错误'
        }
      });
    }
  } catch (error) {
    log.error('验证在库查询密码失败:', error);
    if (connection) connection.release();
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '验证失败'
      }
    });
  } finally {
    if (connection) connection.release();
  }
});

// 删除上传的文件
router.delete('/upload/screen-lock/:filename',
  unifiedAuth,
  requirePermission('system:delete'),
  async (req, res) => {
    try {
      const { filename } = req.params;

      // 安全检查：防止路径遍历攻击
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILENAME',
            message: '无效的文件名'
          }
        });
      }

      const filePath = path.join(process.cwd(), 'uploads/screen-lock', filename);

      try {
        await fs.unlink(filePath);
        res.json({
          success: true,
          message: '文件删除成功'
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          res.status(404).json({
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: '文件不存在'
            }
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      log.error('删除文件失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除文件失败'
        }
      });
    }
  }
);

module.exports = router;
