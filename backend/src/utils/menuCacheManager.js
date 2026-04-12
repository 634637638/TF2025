/**
 * 菜单缓存管理
 * 用于在菜单更新时清除相关缓存
 */
const log = require('./log');

const permissionCache = new Map();

/**
 * 清除用户权限缓存
 * @param {number|string} userId - 用户ID
 */
function clearUserPermissionCache(userId) {
  const keysToDelete = [];
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`user_${userId}_`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => permissionCache.delete(key));
  log.debug(`🗑️ 已清除用户${userId}的权限缓存`);
}

/**
 * 清除所有用户的菜单缓存
 */
function clearAllMenuCache() {
  const keysToDelete = [];
  for (const key of permissionCache.keys()) {
    if (key.includes('_menu_')) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => permissionCache.delete(key));
  log.debug(`🗑️ 已清除所有菜单缓存，共清除${keysToDelete.length}个缓存项`);
}

module.exports = {
  clearUserPermissionCache,
  clearAllMenuCache,
  permissionCache
};