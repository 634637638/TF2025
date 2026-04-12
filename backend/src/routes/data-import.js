/**
 * 数据导入路由
 * 支持从Excel导入数据，提供跳过、覆盖、合并等选项
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const DataImportService = require('../services/data-import.service');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

// 实例化服务
const dataImportService = new DataImportService();

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/import');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ext === '.xls' || ext === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error('只支持上传 .xls 或 .xlsx 格式的Excel文件'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// 应用认证中间件
router.use(unifiedAuth);

/**
 * 上传并解析Excel文件
 */
router.post('/upload', requirePermission('data-import:upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      });
    }

    // 读取Excel文件
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // 获取字段列表
    const headers = data.length > 0 ? Object.keys(data[0]) : [];

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        totalRows: data.length,
        headers: headers,
        previewData: data.slice(0, 10),
        sheets: workbook.SheetNames
      }
    });
  } catch (error) {
    log.error('上传文件失败:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: '上传文件失败: ' + error.message
    });
  }
});

/**
 * 分析Excel数据并检查重复
 */
router.post('/analyze', requirePermission('data-import:upload'), async (req, res) => {
  try {
    const { filePath, options = {} } = req.body;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: '文件不存在'
      });
    }

    const result = await dataImportService.analyzeData(filePath, options);

    res.json({
      success: true,
      message: '数据分析完成',
      data: result
    });
  } catch (error) {
    log.error('分析数据失败:', error);
    res.status(500).json({
      success: false,
      message: '分析数据失败: ' + error.message
    });
  }
});

/**
 * 执行数据导入
 * 选项：
 * - skipDuplicates: 跳过重复数据
 * - overwrite: 覆盖重复数据
 * - merge: 合并重复数据
 * - createMissing: 创建缺失的基础数据
 */
router.post('/import', requirePermission('data-import:execute'), async (req, res) => {
  try {
    log.debug('='.repeat(50));
    log.debug('📥 收到的请求体:', JSON.stringify(req.body, null, 2));
    const { filePath, options = {} } = req.body;

    log.debug('🔍 解构后 - filePath:', filePath);
    log.debug('🔍 解构后 - options:', JSON.stringify(options, null, 2));
    log.debug('🔍 options.strategy:', options.strategy, typeof options.strategy);
    log.debug('='.repeat(50));

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 验证选项
    const validStrategies = ['smart', 'skip', 'overwrite', 'merge', 'replace_all'];
    const strategy = options?.strategy || 'smart';

    log.debug('🔍 最终 strategy:', strategy, '类型:', typeof strategy);
    log.debug('🔍 有效策略列表:', validStrategies);

    if (!validStrategies.includes(strategy)) {
      log.error('❌ 无效的策略:', strategy, '有效策略:', validStrategies);
      return res.status(400).json({
        success: false,
        message: '无效的导入策略: ' + strategy
      });
    }

    // 使用前端传来的importId，如果没有则生成新的
    const importId = options.importId || Date.now();
    options.importId = importId; // 确保importId被传递到service

    log.debug('📋 导入任务创建 - importId:', importId, 'options:', options);

    // 立即初始化进度，避免前端查询时找不到
    dataImportService.updateProgress(importId, 0, '导入任务已创建，正在初始化...');
    log.debug('✓ 进度已初始化:', dataImportService.getImportProgress(importId));

    // 异步执行导入
    dataImportService.importData(filePath, options, req.user)
      .then(result => {
        log.debug(`✓ 导入 ${importId} 完成`);
      })
      .catch(error => {
        log.error(`✗ 导入 ${importId} 失败:`, error);
      });

    res.json({
      success: true,
      message: '导入任务已启动',
      data: {
        importId: importId,
        strategy: strategy
      }
    });
  } catch (error) {
    log.error('启动导入失败:', error);
    res.status(500).json({
      success: false,
      message: '启动导入失败: ' + error.message
    });
  }
});

/**
 * 获取导入进度
 */
router.get('/progress/:importId', requirePermission('data-import:view'), async (req, res) => {
  try {
    const { importId } = req.params;
    const progress = dataImportService.getImportProgress(importId);

    log.debug('📊 查询进度 - importId:', importId, 'progress:', progress);

    if (!progress) {
      // 检查导入历史，看是否已经完成
      const history = dataImportService.getImportHistory();
      const completedTask = history.find(h => h.importId == importId);

      if (completedTask) {
        // 任务已完成但进度数据已清理
        return res.json({
          success: true,
          message: '导入已完成',
          data: {
            status: 'completed',
            progress: 100,
            message: '导入已完成',
            importId: importId,
            ...completedTask
          }
        });
      }

      // 返回处理中状态而不是 404，避免前端中断轮询
      // 可能任务正在初始化中
      return res.json({
        success: true,
        message: '导入任务正在初始化',
        data: {
          status: 'processing',
          progress: 0,
          message: '导入任务正在初始化，请稍后...',
          importId: importId
        }
      });
    }

    res.json({
      success: true,
      message: '获取导入进度成功',
      data: progress
    });
  } catch (error) {
    log.error('获取导入进度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取导入进度失败: ' + error.message
    });
  }
});

/**
 * 获取导入历史（从数据库）
 * 支持分页、筛选、排序
 */
router.get('/history', requirePermission('data-import:view'), async (req, res) => {
  const connection = req.app.get('db');

  if (!connection) {
    return res.status(500).json({
      success: false,
      message: '数据库连接不可用'
    });
  }

  try {
    // 获取查询参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const status = req.query.status || null;
    const strategy = req.query.strategy || null;
    const userId = req.query.userId || null;
    const offset = (page - 1) * pageSize;

    // 构建 WHERE 条件
    const conditions = [];
    const queryParams = [];

    if (status) {
      conditions.push('status = ?');
      queryParams.push(status);
    }

    if (strategy) {
      conditions.push('strategy = ?');
      queryParams.push(strategy);
    }

    if (userId) {
      conditions.push('user_id = ?');
      queryParams.push(userId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 查询总数
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM import_history ${whereClause}`,
      queryParams
    );

    const total = countResult[0].total;

    // 查询历史记录 - 确保 LIMIT 和 OFFSET 是整数
    const [history] = await connection.execute(
      `SELECT
        id,
        import_id,
        user_id,
        user_name,
        strategy,
        file_name,
        total_records,
        imported,
        updated,
        skipped,
        error_count,
        status,
        error_message,
        start_time,
        end_time,
        duration_ms,
        created_at,
        updated_at
      FROM import_history
      ${whereClause}
      ORDER BY start_time DESC
      LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`,
      queryParams
    );

    res.json({
      success: true,
      message: '获取导入历史成功',
      data: history,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    log.error('获取导入历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取导入历史失败: ' + error.message
    });
  }
});

/**
 * 获取活跃的导入任务（调试用）
 */
router.get('/active-tasks', requirePermission('permissions:admin'), async (_req, res) => {
  try {
    const activeTasks = dataImportService.getActiveTasks();

    res.json({
      success: true,
      message: '获取活跃任务成功',
      data: {
        count: activeTasks.length,
        tasks: activeTasks
      }
    });
  } catch (error) {
    log.error('获取活跃任务失败:', error);
    res.status(500).json({
      success: false,
      message: '获取活跃任务失败: ' + error.message
    });
  }
});

/**
 * 删除导入历史记录
 */
router.delete('/history/:id', requirePermission('data-import:delete'), async (req, res) => {
  const connection = req.app.get('db');

  if (!connection) {
    return res.status(500).json({
      success: false,
      message: '数据库连接不可用'
    });
  }

  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的记录ID'
      });
    }

    // 检查记录是否存在
    const [records] = await connection.execute(
      'SELECT * FROM import_history WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    // 删除记录
    await connection.execute(
      'DELETE FROM import_history WHERE id = ?',
      [id]
    );

    log.debug(`✅ 导入历史记录已删除: id=${id}`);

    res.json({
      success: true,
      message: '删除成功',
      data: { id }
    });
  } catch (error) {
    log.error('删除导入历史失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败: ' + error.message
    });
  }
});

/**
 * 获取活跃的导入任务（调试用）
 */
router.delete('/progress/:importId', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { importId } = req.params;

    dataImportService.clearProgress(importId);

    res.json({
      success: true,
      message: '清理导入进度成功',
      data: { importId }
    });
  } catch (error) {
    log.error('清理导入进度失败:', error);
    res.status(500).json({
      success: false,
      message: '清理导入进度失败: ' + error.message
    });
  }
});

module.exports = router;
