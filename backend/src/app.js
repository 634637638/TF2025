const express = require('express');
const path = require('path');
const config = require('./config');
const { connectToDatabase, getDatabase } = require('./config/database');
const errorHandler = require('./middleware/error-handler');
const log = require('./utils/log');

// 导入路由
const routes = require('./routes');

// 导入中间件配置
const { setupSecurityMiddleware, setupBasicMiddleware, setupRoutes } = require('./middleware');

const app = express();
const PORT = config.server.port;
const HOST = process.env.HOST || '127.0.0.1';
const APP_ENV = config.server.env || process.env.NODE_ENV || 'development';
const IS_PRODUCTION = APP_ENV === 'production';

const formatBeijingTime = () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

const requestLogger = (req, res, next) => {
  if (!IS_PRODUCTION) {
    log.debug(`🌐 [${formatBeijingTime()}] ${req.method} ${req.originalUrl}`);
  }
  next();
};

const uploadStaticMiddleware = (req, res, next) => {
  try {
    req.url = decodeURIComponent(req.url);
  } catch (error) {
    log.error('URL 解码失败:', error);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  next();
};

/**
 * 应用程序初始化
 */
async function initializeApp() {
  try {
    // 连接数据库（允许失败，服务器仍然可以启动）
    try {
      await connectToDatabase();
      log.success('数据库连接成功');
    } catch (dbError) {
      log.warn('数据库连接失败，服务器将以降级模式启动');
      log.warn('某些功能可能无法正常使用');
      log.warn('错误:', dbError.message);
      // 不要退出，继续启动服务器
    }

    // 设置安全中间件
    setupSecurityMiddleware(app);
    log.success('安全中间件配置完成');

    // 设置基础中间件
    setupBasicMiddleware(app);
    log.success('基础中间件配置完成');

    // 添加全局请求日志中间件
    app.use(requestLogger);

    // 设置静态文件服务
    // __dirname 是 backend/src，需要向上两级到项目根，然后进入 backend/uploads
    // 或者直接使用 process.cwd() 指向后端根目录
    const uploadsPath = process.env.NODE_ENV === 'production'
      ? process.env.UPLOAD_PATH || '/www/wwwroot/v6.cn9527.cn/backend/uploads'
      : path.join(process.cwd(), 'uploads');

    // 添加 URL 解码中间件和 CORS 头，处理中文文件名和跨域访问
    app.use('/uploads', uploadStaticMiddleware);

    app.use('/uploads', express.static(uploadsPath));
    log.success('静态文件服务配置完成:', uploadsPath);

    // 将数据库连接池添加到 app 实例
    try {
      const db = getDatabase();
      app.set('db', db);
      log.success('数据库连接池已添加到 app 实例');
    } catch (error) {
      log.warn('无法添加数据库连接池到 app 实例:', error.message);
    }

    // 设置路由
    setupRoutes(app, routes);
    log.success('路由配置完成');

    // 错误处理中间件（必须最后设置）
    app.use(errorHandler);
    log.success('错误处理中间件配置完成');

    // 初始化字段权限表（如果不存在）
    // await initFieldTables(); // 暂时注释掉，避免启动错误

    return app;
  } catch (error) {
    log.error('应用程序初始化失败:', error);
    process.exit(1);
  }
}

/**
 * 启动服务器
 */
async function startServer() {
  try {
    log.start('服务器启动中...');
    log.info('启动时间:', formatBeijingTime());

    const app = await initializeApp();

    const server = app.listen(PORT, HOST, () => {
      log.success('服务器启动成功');
      log.info('端口:', PORT);
      log.info('绑定地址:', HOST);
      log.info('环境:', APP_ENV);
      log.info('启动时间:', formatBeijingTime());
      log.success('服务运行正常，等待请求...');
    });

    // 设置服务器超时，避免长时间挂起的请求
    // 备份操作可能需要较长时间（特别是上传文件较大时），设置为10分钟
    server.setTimeout(600000); // 10分钟
    server.keepAliveTimeout = 65000; // 65秒
    server.headersTimeout = 66000; // 略长于 keepAliveTimeout

    // 启动价格自动同步调度器
    let priceScheduler = null;
    try {
      priceScheduler = require('./scripts/price-sync-scheduler');
      // 初始化调度器并启动定时任务
      priceScheduler.init().catch(err => {
        log.warn('价格同步调度器初始化失败:', err.message);
      });
    } catch (error) {
      log.warn('价格同步调度器启动失败:', error.message);
    }

    // 启动订单过期检查定时任务
    let orderExpireChecker = null;
    try {
      orderExpireChecker = require('./scripts/order-expire-checker');
      // 初始化并启动定时任务
      orderExpireChecker.init().catch(err => {
        log.warn('订单过期检查定时任务初始化失败:', err.message);
      });
    } catch (error) {
      log.warn('订单过期检查定时任务启动失败:', error.message);
    }

    // 优雅关闭处理（传入调度器实例和服务器实例）
    setupGracefulShutdown(server, priceScheduler, orderExpireChecker);

  } catch (error) {
    log.error('服务器启动失败:', error);
    log.error('错误堆栈:', error.stack);
    // 延迟退出，给 PM2 时间记录日志
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

/**
 * 设置优雅关闭
 */
function setupGracefulShutdown(server, priceScheduler, orderExpireChecker) {
  const gracefulShutdown = (signal) => {
    log.info(`接收到 ${signal} 信号，开始优雅关闭...`);

    // 停止接受新连接
    server.close(async () => {
      log.success('HTTP 服务器已关闭');

      // 停止价格同步调度器
      if (priceScheduler && typeof priceScheduler.cleanup === 'function') {
        try {
          await priceScheduler.cleanup();
          log.success('价格同步调度器已停止');
        } catch (error) {
          log.error('停止价格同步调度器失败:', error.message);
        }
      }

      // 停止订单过期检查定时任务
      if (orderExpireChecker && typeof orderExpireChecker.cleanup === 'function') {
        try {
          await orderExpireChecker.cleanup();
          log.success('订单过期检查定时任务已停止');
        } catch (error) {
          log.error('停止订单过期检查定时任务失败:', error.message);
        }
      }

      // 关闭数据库连接
      try {
        const { closeDatabase } = require('./config/database');
        await closeDatabase();
        log.success('数据库连接已关闭');
      } catch (error) {
        log.error('关闭数据库连接失败:', error.message);
      }

      log.success('服务器已优雅关闭');
      process.exit(0);
    });

    // 如果10秒后还没关闭，强制退出
    setTimeout(() => {
      log.error('强制关闭服务器（超时）');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常:', error);
  log.error('异常堆栈:', error.stack);
  // 记录错误但不立即退出，给 PM2 时间来处理
  // 如果是生产环境，让 PM2 决定是否重启
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('未处理的Promise拒绝:', reason);
  log.error('Promise:', promise);
  // 记录错误但不立即退出，避免频繁重启
  // 只在严重错误时退出
  if (reason instanceof Error && reason.code === 'ECONNREFUSED') {
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

// 初始化字段权限表（已禁用，文件不存在）
// async function initFieldTables() {
//   try {
//     console.log('🔍 检查字段权限表...');
//     const { createFieldTables } = require('./services/createFieldTables');
//     await createFieldTables();
//   } catch (error) {
//     console.warn('⚠️ 初始化字段表失败（可能已存在）:', error.message);
//   }
// }

// 启动服务器
if (require.main === module) {
  startServer();
}

module.exports = { initializeApp, startServer };
