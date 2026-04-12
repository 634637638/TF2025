/**
 * 文件上传安全中间件
 * 提供全面的文件上传安全防护
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const log = require('../utils/log');

// 导入安全工具
const {
  isValidFileExtension,
  isValidMimeType,
  generateSecureFilename,
  isValidFileSize
} = require('../utils/security-enhanced');

// ============================================================================
// 配置常量
// ============================================================================

// 文件大小限制（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 允许的文件扩展名
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 允许的 MIME 类型
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// 文件 Magic Numbers（用于验证文件内容）
const FILE_MAGIC_NUMBERS = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46]
};

// ============================================================================
// 文件验证函数
// ============================================================================

/**
 * 验证文件 Magic Number（文件内容验证）
 * @param {string} filePath - 文件路径
 * @param {string} mimeType - 声明的 MIME 类型
 * @returns {Promise<boolean>} 是否有效
 */
async function validateFileContent(filePath, mimeType) {
  return new Promise((resolve) => {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const magicNumbers = FILE_MAGIC_NUMBERS[mimeType];
    if (!magicNumbers) {
      resolve(false);
      return;
    }

    // 检查前几个字节是否匹配
    const isValid = magicNumbers.every((byte, index) => buffer[index] === byte);
    resolve(isValid);
  });
}

/**
 * 综合文件验证
 * @param {Object} file - Multer 文件对象
 * @returns {Promise<Object>} 验证结果
 */
async function validateUploadFile(file) {
  const errors = [];

  // 1. 检查文件是否存在
  if (!file) {
    return {
      valid: false,
      errors: ['文件不存在']
    };
  }

  // 2. 检查文件名
  if (!file.originalname || typeof file.originalname !== 'string') {
    errors.push('文件名无效');
  } else {
    // 检查文件扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(`不允许的文件类型: ${ext}`);
    }

    // 检查文件名是否包含危险字符
    if (/[<>:"|?*]/.test(file.originalname)) {
      errors.push('文件名包含非法字符');
    }
  }

  // 3. 检查 MIME 类型
  if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    errors.push(`不允许的 MIME 类型: ${file.mimetype || '未指定'}`);
  }

  // 4. 检查文件大小
  if (!file.size || file.size > MAX_FILE_SIZE) {
    errors.push(`文件大小超过限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }

  // 5. 验证文件内容（Magic Number）
  if (file.path) {
    try {
      const contentValid = await validateFileContent(file.path, file.mimetype);
      if (!contentValid) {
        errors.push('文件内容与声明的类型不匹配');
      }
    } catch (error) {
      log.error('文件内容验证失败', error);
      errors.push('文件内容验证失败');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// 存储配置
// ============================================================================

/**
 * 生成安全的存储目录
 * @param {string} baseDir - 基础目录
 * @returns {string} 安全的存储路径
 */
function generateSecureUploadPath(baseDir) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 按日期组织文件存储
  const uploadDir = path.join(baseDir, String(year), month, day);

  // 确保目录存在
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
  }

  return uploadDir;
}

/**
 * 配置 Multer 存储
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根据文件类型选择存储目录
    let baseDir = path.join(__dirname, '../../uploads');

    if (file.mimetype?.startsWith('image/')) {
      baseDir = path.join(baseDir, 'images');
    }

    // 生成安全的上传路径
    const uploadDir = generateSecureUploadPath(baseDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      // 生成安全的文件名
      const secureFilename = generateSecureFilename(file.originalname);
      cb(null, secureFilename);
    } catch (error) {
      cb(error, '');
    }
  }
});

// ============================================================================
// Multer 配置
// ============================================================================

/**
 * 文件过滤器
 */
const fileFilter = async (req, file, cb) => {
  try {
    // 检查文件扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`不允许的文件类型: ${ext}`), false);
    }

    // 检查 MIME 类型
    if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`不允许的 MIME 类型: ${file.mimetype}`), false);
    }

    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

/**
 * Multer 配置
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // 最多5个文件
  }
});

// ============================================================================
// 安全中间件
// ============================================================================

/**
 * 文件上传安全中间件
 * 在 Multer 处理后进行额外的安全检查
 */
const uploadSecurityMiddleware = async (req, res, next) => {
  try {
    // 检查是否有文件上传
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.file ? [req.file] : Object.values(req.files).flat();

    // 验证每个文件
    const validationResults = await Promise.all(
      files.map(file => validateUploadFile(file))
    );

    // 检查是否有验证失败的文件
    const invalidFiles = validationResults.filter(result => !result.valid);

    if (invalidFiles.length > 0) {
      // 删除已上传的文件
      files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            log.error('删除文件失败', error);
          }
        }
      });

      return res.status(400).json({
        success: false,
        message: '文件验证失败',
        code: 'FILE_VALIDATION_ERROR',
        errors: invalidFiles.flatMap(result => result.errors)
      });
    }

    // 添加文件信息到请求对象
    req.uploadedFiles = files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    next();
  } catch (error) {
    log.error('文件上传安全检查失败', error);

    // 清理已上传的文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        log.error('删除文件失败', err);
      }
    }

    return res.status(500).json({
      success: false,
      message: '文件上传处理失败',
      code: 'UPLOAD_ERROR'
    });
  }
};

/**
 * 单文件上传中间件
 */
const uploadSingle = (fieldName) => [
  upload.single(fieldName),
  uploadSecurityMiddleware
];

/**
 * 多文件上传中间件
 */
const uploadMultiple = (fieldName, maxCount = 5) => [
  upload.array(fieldName, maxCount),
  uploadSecurityMiddleware
];

/**
 * 多字段文件上传中间件
 */
const uploadFields = (fields) => [
  upload.fields(fields),
  uploadSecurityMiddleware
];

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 中间件
  upload,
  uploadSecurityMiddleware,
  uploadSingle,
  uploadMultiple,
  uploadFields,

  // 配置常量
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,

  // 验证函数
  validateUploadFile,
  validateFileContent,

  // 工具函数
  generateSecureUploadPath
};
