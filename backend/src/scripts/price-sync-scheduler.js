/**
 * 价格自动同步定时任务
 * 使用 setInterval 定期执行价格同步
 */

const priceListService = require('../services/price-list.service');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class PriceSyncScheduler {
  constructor() {
    this.isRunning = false;
    this.timers = new Map();
    this.db = null;
    this.initialized = false;
    this.initPromise = null;
    this.schedulerLockConnection = null;
    this.schedulerLockName = 'price_sync_scheduler_master';
    this.isLeader = false;
    this.leadershipMonitor = null;
    this.leadershipCheckIntervalMs = 60 * 1000;
    this.isShuttingDown = false;
  }

  isIgnorableShutdownError(error) {
    const message = error?.message || '';
    return /server shutdown in progress|connection is closed|pool is closed|cannot enqueue|connection lost/i.test(message);
  }

  /**
   * 确保调度器数据库连接可用
   */
  async ensureDatabaseReady() {
    if (!this.db) {
      this.db = getDatabase();
    }

    if (!this.db) {
      throw new Error('价格同步调度器数据库连接未就绪');
    }

    priceListService.setDatabase(this.db);
  }

  /**
   * 抢占主调度器锁，保证全局只有一个进程负责挂定时任务
   */
  async ensureSchedulerLeadership() {
    await this.ensureDatabaseReady();

    if (this.isLeader && this.schedulerLockConnection) {
      return true;
    }

    const connection = await this.db.getConnection();

    try {
      const [rows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [this.schedulerLockName]);
      const acquired = Number(rows?.[0]?.acquired || 0) === 1;

      if (!acquired) {
        connection.release();
        this.isLeader = false;
        this.schedulerLockConnection = null;
        log.info(`当前进程未取得价格同步主调度锁，跳过定时任务启动 (PID: ${process.pid})`);
        return false;
      }

      this.schedulerLockConnection = connection;
      this.isLeader = true;
      log.success(`当前进程已取得价格同步主调度锁 (PID: ${process.pid})`);
      return true;
    } catch (error) {
      connection.release();
      this.isLeader = false;
      this.schedulerLockConnection = null;
      throw error;
    }
  }

  /**
   * 释放主调度器锁
   */
  async releaseSchedulerLeadership() {
    if (!this.schedulerLockConnection) {
      this.isLeader = false;
      return;
    }

    try {
      await this.schedulerLockConnection.query('SELECT RELEASE_LOCK(?)', [this.schedulerLockName]);
      log.info(`已释放价格同步主调度锁 (PID: ${process.pid})`);
    } catch (error) {
      if (this.isShuttingDown && this.isIgnorableShutdownError(error)) {
        log.info(`停服阶段跳过价格同步主调度锁释放确认: ${this.schedulerLockName} (${error.message})`);
      } else {
        log.warn(`释放价格同步主调度锁失败: ${this.schedulerLockName}`, error.message);
      }
    } finally {
      try {
        this.schedulerLockConnection.release();
      } catch (releaseError) {
        if (!(this.isShuttingDown && this.isIgnorableShutdownError(releaseError))) {
          log.warn(`释放价格同步主调度锁连接失败: ${this.schedulerLockName}`, releaseError.message);
        }
      }
      this.schedulerLockConnection = null;
      this.isLeader = false;
    }
  }

  /**
   * 定期检查主调度器锁，支持从实例自动接管
   */
  startLeadershipMonitor() {
    if (this.leadershipMonitor) {
      return;
    }

    this.leadershipMonitor = setInterval(() => {
      this.runLeadershipCheck().catch((error) => {
        log.error('价格同步主锁巡检失败:', error.message);
      });
    }, this.leadershipCheckIntervalMs);

    log.info(`已启动价格同步主锁巡检 (每${this.leadershipCheckIntervalMs / 1000}秒检查一次)`);
  }

  stopLeadershipMonitor() {
    if (!this.leadershipMonitor) {
      return;
    }

    clearInterval(this.leadershipMonitor);
    this.leadershipMonitor = null;
    log.info('已停止价格同步主锁巡检');
  }

  async isLeadershipConnectionAlive() {
    if (!this.schedulerLockConnection) {
      return false;
    }

    try {
      await this.schedulerLockConnection.query('SELECT 1');
      return true;
    } catch (error) {
      log.warn('价格同步主锁连接已失效，准备重新抢占主锁:', error.message);
      return false;
    }
  }

  async runLeadershipCheck() {
    await this.ensureDatabaseReady();

    if (this.isLeader) {
      const connectionAlive = await this.isLeadershipConnectionAlive();
      if (connectionAlive) {
        return;
      }

      this.isLeader = false;
      this.schedulerLockConnection = null;
      this.stopAllJobs();
    }

    const hasLeadership = await this.ensureSchedulerLeadership();
    if (!hasLeadership) {
      return;
    }

    if (this.timers.size === 0) {
      log.info('当前进程已接管价格同步主锁，开始恢复自动任务');
      await this.startAllJobs();
    }
  }

  /**
   * 初始化
   */
  async init() {
    if (this.initialized) {
      log.info('价格同步定时任务已初始化，跳过重复初始化');
      return;
    }

    if (this.initPromise) {
      log.info('价格同步定时任务正在初始化，复用已有初始化流程');
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.db = getDatabase();
        priceListService.setDatabase(this.db);
        log.success(`价格同步定时任务初始化成功 (PID: ${process.pid})`);
        this.startLeadershipMonitor();

        // 启动前先清理本进程已有任务，保证幂等
        this.stopAllJobs();
        await this.runLeadershipCheck();
        this.initialized = true;
      } catch (error) {
        log.error('价格同步定时任务初始化失败:', error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    try {
      await this.initPromise;
    } catch (error) {
      log.error('价格同步定时任务初始化失败:', error);
    }
  }

  /**
   * 启动所有配置的定时任务
   */
  async startAllJobs() {
    try {
      if (!(await this.ensureSchedulerLeadership())) {
        this.stopAllJobs();
        return;
      }

      // 明确只启动 is_default = 1 的配置
      const [configs] = await this.db.query(`
        SELECT * FROM price_sync_config
        WHERE is_default = 1
        AND sync_interval > 0
      `);

      log.info(`找到 ${configs.length} 个默认配置需要启动定时任务`);

      for (const config of configs) {
        log.debug(`启动配置: ID=${config.id}, 名称=${config.config_name}, 账户=${config.login_username}`);
        await this.startJob(config);
      }

      log.success(`启动了 ${this.timers.size} 个价格同步定时任务`);
    } catch (error) {
      log.error('启动定时任务失败:', error);
    }
  }

  /**
   * 重启所有定时任务（先停止所有，再启动默认的）
   */
  async restartAllJobs() {
    try {
      const hasLeadership = await this.ensureSchedulerLeadership();

      // 停止所有正在运行的任务
      this.stopAllJobs();

      if (!hasLeadership) {
        log.info('当前进程不是价格同步主调度器，跳过重启任务');
        return;
      }

      // 启动默认配置的任务
      await this.startAllJobs();

      log.success(`重启了 ${this.timers.size} 个价格同步定时任务`);
    } catch (error) {
      log.error('重启定时任务失败:', error);
    }
  }

  /**
   * 启动单个定时任务
   */
  async startJob(config) {
    try {
      // 停止已存在的任务
      this.stopJob(config.id);

      // 计算间隔（毫秒）
      const intervalMs = config.sync_interval * 60 * 1000;

      // 创建定时器
      const timer = setInterval(async () => {
        await this.executeSync(config);
      }, intervalMs);

      this.timers.set(config.id, {
        config,
        timer,
        intervalMs
      });

      log.success(`价格同步任务已启动: ${config.config_name} (每${config.sync_interval}分钟)`);
    } catch (error) {
      log.error(`启动定时任务失败 (${config.config_name}):`, error);
    }
  }

  /**
   * 停止单个定时任务
   */
  stopJob(configId) {
    if (this.timers.has(configId)) {
      const job = this.timers.get(configId);
      clearInterval(job.timer);
      this.timers.delete(configId);
      log.info(`价格同步任务已停止: configId=${configId}`);
    }
  }

  /**
   * 获取跨进程执行锁，避免多个后端实例重复执行同一配置
   */
  async acquireExecutionLock(configId) {
    const lockName = `price_sync_auto_config_${configId}`;
    const connection = await this.db.getConnection();

    try {
      const [rows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
      const acquired = Number(rows?.[0]?.acquired || 0) === 1;

      if (!acquired) {
        connection.release();
        return null;
      }

      return {
        connection,
        lockName
      };
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  /**
   * 释放跨进程执行锁
   */
  async releaseExecutionLock(lockHandle) {
    if (!lockHandle?.connection) {
      return;
    }

    try {
      await lockHandle.connection.query('SELECT RELEASE_LOCK(?)', [lockHandle.lockName]);
    } catch (error) {
      log.warn(`释放价格同步锁失败: ${lockHandle.lockName}`, error.message);
    } finally {
      lockHandle.connection.release();
    }
  }

  /**
   * 重新加载配置（当配置更新时调用）
   */
  async reloadJob(configId) {
    try {
      if (!(await this.ensureSchedulerLeadership())) {
        this.stopJob(configId);
        return;
      }

      const [configs] = await this.db.query(`
        SELECT * FROM price_sync_config WHERE id = ?
      `, [configId]);

      if (configs.length === 0) {
        this.stopJob(configId);
        return;
      }

      const config = configs[0];

      if (config.is_default && config.sync_interval > 0) {
        await this.startJob(config);
      } else {
        this.stopJob(configId);
      }
    } catch (error) {
      log.error('重新加载定时任务失败:', error);
    }
  }

  /**
   * 执行同步
   */
  async executeSync(config) {
    if (this.isRunning) {
      log.info('价格同步正在进行中，跳过本次执行');
      return;
    }

    let lockHandle = null;

    this.isRunning = true;

    try {
      lockHandle = await this.acquireExecutionLock(config.id);
      if (!lockHandle) {
        log.info(`检测到其他实例已持有同步锁，跳过本次执行: ${config.config_name} (configId=${config.id})`);
        return;
      }

      log.start(`执行价格同步: ${config.config_name}`);
      const startTime = Date.now();

      const result = await priceListService.executeSync(config.id, 'auto', null);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      log.success(`价格同步完成: ${config.config_name} (耗时: ${duration}秒)`, result);
    } catch (error) {
      log.error(`价格同步失败: ${config.config_name}`, error.message);
    } finally {
      await this.releaseExecutionLock(lockHandle);
      this.isRunning = false;
    }
  }

  /**
   * 获取所有运行中的任务状态
   */
  getJobsStatus() {
    const statuses = [];
    for (const [configId, job] of this.timers.entries()) {
      statuses.push({
        configId,
        configName: job.config.config_name,
        intervalMinutes: job.config.sync_interval,
        intervalMs: job.intervalMs,
        isLeader: this.isLeader
      });
    }
    return statuses;
  }

  /**
   * 停止所有任务
   */
  stopAllJobs() {
    for (const configId of this.timers.keys()) {
      this.stopJob(configId);
    }
    log.info('所有价格同步定时任务已停止');
  }
}

// 创建单例
const scheduler = new PriceSyncScheduler();

// 清理任务函数（供外部调用）
const cleanup = async () => {
  scheduler.isShuttingDown = true;
  scheduler.stopAllJobs();
  scheduler.stopLeadershipMonitor();
  await scheduler.releaseSchedulerLeadership();
};

// 导出调度器和清理函数
module.exports = scheduler;
module.exports.cleanup = cleanup;
