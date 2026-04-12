/**
 * 订单过期自动取消定时任务
 * 每5分钟检查一次过期订单并自动取消
 */

const { getDatabase } = require('../config/database');
const log = require('../utils/log');

let checkInterval = null;
let isShuttingDown = false;

function isIgnorableShutdownError(error) {
  const message = error?.message || '';
  return /server shutdown in progress|connection is closed|pool is closed|cannot enqueue|connection lost/i.test(message);
}

/**
 * 检查并取消过期订单
 */
async function checkExpiredOrders() {
  const db = getDatabase();

  try {
    // 查找过期且未支付的订单
    const [expiredOrders] = await db.query(
      `SELECT id, order_number, customer_name, customer_phone
       FROM H5_orders
       WHERE status = 'pending'
       AND expires_at < NOW()
       AND expires_at IS NOT NULL`
    );

    if (expiredOrders.length === 0) {
      return;
    }

    log.info(`发现 ${expiredOrders.length} 个过期订单，开始自动取消...`);

    // 批量更新订单状态
    for (const order of expiredOrders) {
      await db.query(
        `UPDATE H5_orders
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancel_reason = '超时未支付自动取消',
             updated_at = NOW()
         WHERE id = ?`,
        [order.id]
      );
      log.success(`订单 ${order.order_number} 已自动取消（超时未支付）`);
    }

    log.done(`成功取消 ${expiredOrders.length} 个过期订单`);

  } catch (error) {
    if (isShuttingDown && isIgnorableShutdownError(error)) {
      log.info(`停服阶段跳过过期订单检查: ${error.message}`);
      return;
    }

    log.error('检查过期订单失败:', error);
  }
}

/**
 * 初始化订单过期检查定时任务
 */
async function init() {
  try {
    log.start('订单过期检查定时任务初始化...');

    // 立即执行一次检查
    await checkExpiredOrders();

    // 每5分钟检查一次
    checkInterval = setInterval(async () => {
      await checkExpiredOrders();
    }, 5 * 60 * 1000); // 5分钟

    log.success('订单过期检查定时任务已启动（每5分钟检查一次）');

  } catch (error) {
    log.fail('订单过期检查定时任务初始化失败:', error);
    throw error;
  }
}

/**
 * 清理资源
 */
function cleanup() {
  isShuttingDown = true;
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    log.success('订单过期检查定时任务已停止');
  }
}

module.exports = {
  init,
  cleanup,
  checkExpiredOrders
};
