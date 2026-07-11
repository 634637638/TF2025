'use strict';

const { FEATURE_FLAGS } = require('../config/constants');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

const requireMockRoutesEnabled = (routeName = '模拟接口') => (req, res, next) => {
  if (FEATURE_FLAGS.MOCK_ROUTES_ENABLED) {
    return next();
  }

  log.warn(`生产环境已拦截 ${routeName}: ${req.method} ${req.originalUrl}`);
  return ApiResponse.error(
    res,
    `${routeName}仅用于开发/演示环境，生产环境已禁用。如确需启用，请显式配置 ENABLE_MOCK_ROUTES=true。`,
    404
  );
};

module.exports = {
  requireMockRoutesEnabled
};
