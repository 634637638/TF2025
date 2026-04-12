/**
 * 备份管理路由
 * 权限要求：管理员
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const backupService = require('../services/backup.service');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

const DOWNLOAD_TOKEN_TTL_MS = 60 * 1000;
const backupDownloadTokens = new Map();

const validateFilename = (filename) => {
  if (!backupService.isValidBackupFilename(filename)) {
    const error = new Error('无效的文件名');
    error.statusCode = 400;
    throw error;
  }

  return filename;
};

const createBackupDownloadToken = ({ filename, userId }) => {
  const token = crypto.randomBytes(24).toString('hex');
  backupDownloadTokens.set(token, {
    filename,
    userId,
    expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS
  });
  return token;
};

const validateBackupDownloadToken = (token, filename) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const entry = backupDownloadTokens.get(token);
  if (!entry) {
    return false;
  }

  if (entry.expiresAt < Date.now()) {
    backupDownloadTokens.delete(token);
    return false;
  }

  return entry.filename === filename;
};

const authenticateBackupDownload = (req, res, next) => {
  const filename = req.params.filename;
  const queryToken = typeof req.query.download_token === 'string' ? req.query.download_token.trim() : '';

  if (queryToken) {
    if (!validateBackupDownloadToken(queryToken, filename)) {
      return res.status(401).json({
        success: false,
        message: '下载链接已失效，请在 1 分钟内重新获取下载链接'
      });
    }

    return next();
  }

  return unifiedAuth(req, res, () => {
    const permissionMiddleware = requirePermission('permissions:admin');
    return permissionMiddleware(req, res, next);
  });
};

// ============ 需要认证的路由 ============

// 创建备份、列表、删除、清理 - 使用标准认证
router.post('/create', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const result = await backupService.createBackup();

    res.json({
      success: true,
      message: '备份创建成功',
      data: result
    });
  } catch (error) {
    log.error('[Backup] 创建备份失败:', error);
    res.status(500).json({
      success: false,
      message: '备份创建失败: ' + error.message
    });
  }
});

router.get('/list', unifiedAuth, requirePermission('permissions:admin'), (req, res) => {
  try {
    const backups = backupService.getBackupList();

    res.json({
      success: true,
      data: backups,
      total: backups.length
    });
  } catch (error) {
    log.error('[Backup] 获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份列表失败: ' + error.message
    });
  }
});

router.delete('/:filename', unifiedAuth, requirePermission('permissions:admin'), (req, res) => {
  try {
    const filename = validateFilename(req.params.filename);

    backupService.deleteBackup(filename);

    res.json({
      success: true,
      message: '备份删除成功'
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    log.error('[Backup] 删除备份失败:', error);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : '删除备份失败: ' + error.message
    });
  }
});

router.post('/cleanup', unifiedAuth, requirePermission('permissions:admin'), (req, res) => {
  try {
    const { keepCount = 5 } = req.body;

    const result = backupService.cleanOldBackups(keepCount);

    res.json({
      success: true,
      message: result.message,
      data: { deleted: result.deleted }
    });
  } catch (error) {
    log.error('[Backup] 清理备份失败:', error);
    res.status(500).json({
      success: false,
      message: '清理备份失败: ' + error.message
    });
  }
});

router.get('/storage', unifiedAuth, requirePermission('permissions:admin'), (req, res) => {
  try {
    const backups = backupService.getBackupList();
    const totalSize = backups.reduce((sum, b) => sum + b.size_bytes, 0);
    const totalSizeFormatted = backupService.formatFileSize(totalSize);

    res.json({
      success: true,
      data: {
        total_count: backups.length,
        total_size: totalSizeFormatted,
        total_size_bytes: totalSize
      }
    });
  } catch (error) {
    log.error('[Backup] 获取存储信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储信息失败: ' + error.message
    });
  }
});

router.get('/download-link/:filename', unifiedAuth, requirePermission('permissions:admin'), (req, res) => {
  try {
    const filename = validateFilename(req.params.filename);
    const filePath = backupService.getBackupPath(filename);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: '备份文件不存在'
      });
    }

    const token = createBackupDownloadToken({
      filename,
      userId: req.user?.id || null
    });

    res.json({
      success: true,
      data: {
        url: `/api/backup/download/${encodeURIComponent(filename)}?download_token=${token}`
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    log.error('[Backup] 获取下载链接失败:', error);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : '获取下载链接失败: ' + error.message
    });
  }
});

// ============ 下载路由 ============

/**
 * 下载备份
 * GET /api/backup/download/:filename
 */
router.get('/download/:filename', authenticateBackupDownload, (req, res) => {
  try {
    const filename = validateFilename(req.params.filename);
    const filePath = backupService.getBackupPath(filename);

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: '备份文件不存在'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        log.error('[Backup] 下载失败:', err);
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    log.error('[Backup] 下载备份失败:', error);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : '下载备份失败: ' + error.message
    });
  }
});

module.exports = router;
