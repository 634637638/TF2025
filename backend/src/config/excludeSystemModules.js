/**
 * 配置：在扫描时排除的系统模块
 * 这些模块通常是系统内部使用的，不需要进行字段权限管理
 */
const log = require('../utils/log');

const EXCLUDE_MODULE_PATTERNS = [
  // 系统模块前缀
  'system_',
  // 系统相关的模块名
  'permissions_fieldscannerview',
  'permissions_modulemanagementview',
  'permissions_permissionsview',
  // 演示模块
  'demo_',
  // 特殊的权限视图
  'brands_brandsviewwithfieldpermission'
];

/**
 * 检查模块是否应该被排除（不扫描）
 * @param {string} moduleKey 模块key
 * @returns {boolean} 是否应该排除
 */
function shouldExcludeModule(moduleKey) {
  return EXCLUDE_MODULE_PATTERNS.some(pattern => {
    // 支持前缀匹配
    if (pattern.endsWith('_')) {
      return moduleKey.startsWith(pattern);
    }
    // 精确匹配
    return moduleKey === pattern;
  });
}

/**
 * 过滤模块配置，移除系统模块
 * @param {Object} moduleConfigs 所有模块配置
 * @returns {Object} 过滤后的模块配置
 */
function filterModuleConfigs(moduleConfigs) {
  const filtered = {};

  for (const [moduleKey, config] of Object.entries(moduleConfigs)) {
    // 跳过系统模块
    if (shouldExcludeModule(moduleKey)) {
      log.debug(`跳过系统模块: ${moduleKey}`);
      continue;
    }

    filtered[moduleKey] = config;
  }

  return filtered;
}

module.exports = {
  EXCLUDE_MODULE_PATTERNS,
  shouldExcludeModule,
  filterModuleConfigs
};