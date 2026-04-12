const log = require('../utils/log');
const AuthService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const { hasGlobalAdminRole } = require('../services/accessControl.service');

/**
 * 认证控制器类
 * 处理认证相关的HTTP请求
 */
class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  isAdminUser(user) {
    if (!user) {
      return false;
    }

    return hasGlobalAdminRole([
      user.role,
      ...(Array.isArray(user.roles) ? user.roles : []),
      ...(Array.isArray(user.role_codes) ? user.role_codes.map((code) => ({ roleCode: code })) : [])
    ]);
  }

  /**
   * 用户登录
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // 获取客户端信息
      const clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      };

      const result = await this.authService.login(username, password, clientInfo);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 401);
      }

      // 设置HTTP Only Cookie来存储刷新令牌（增强安全性）
      if (result.data.refreshToken) {
        res.cookie('refreshToken', result.data.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });
      }

      // 返回访问令牌和用户信息
      const response = {
        user: result.data.user,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken, // 修复：同时返回refreshToken用于前端存储
        expiresIn: result.data.expiresIn
      };

      ApiResponse.success(res, result.message, response, 200);
    } catch (error) {
      log.error('登录控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 用户注册
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async register(req, res) {
    try {
      const userData = req.body;
      const result = await this.authService.register(userData);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data, 201);
    } catch (error) {
      log.error('注册控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 刷新令牌
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async refreshToken(req, res) {
    try {
      // 从请求体或Cookie中获取刷新令牌
      const { refreshToken } = req.body;
      const tokenFromCookie = req.cookies.refreshToken;

      const token = refreshToken || tokenFromCookie;

      if (!token) {
        return ApiResponse.error(res, '刷新令牌不能为空', 400);
      }

      const result = await this.authService.refreshToken(token);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 401);
      }

      // 设置新的刷新令牌到Cookie
      if (result.data.refreshToken) {
        res.cookie('refreshToken', result.data.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });
      }

      const response = {
        accessToken: result.data.accessToken,
        expiresIn: result.data.expiresIn
      };

      ApiResponse.success(res, result.message, response, 200);
    } catch (error) {
      log.error('刷新令牌控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 用户登出
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokenFromCookie = req.cookies.refreshToken;
      const token = refreshToken || tokenFromCookie;

      // 清除Cookie中的刷新令牌
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      const result = await this.authService.logout(
        req.headers.authorization?.replace('Bearer ', ''),
        token,
        req.user
      );

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, null, 200);
    } catch (error) {
      log.error('登出控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 获取当前用户信息
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getCurrentUser(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.authService.getUserInfo(userId);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 404);
      }

      ApiResponse.success(res, result.message, result.data, 200);
    } catch (error) {
      log.error('获取用户信息控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 更新用户信息
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // 不允许更新密码、角色等敏感字段
      const allowedFields = ['username', 'email', 'phone'];
      const filteredData = {};

      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      const result = await this.authService.updateUserInfo(userId, filteredData);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data, 200);
    } catch (error) {
      log.error('更新用户信息控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 修改密码
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      const result = await this.authService.changePassword(userId, oldPassword, newPassword);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, null, 200);
    } catch (error) {
      log.error('修改密码控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 检查用户名可用性
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async checkUsername(req, res) {
    try {
      const { username } = req.params;
      const { excludeUserId } = req.query;

      const result = await this.authService.checkUsernameAvailability(
        username,
        excludeUserId ? parseInt(excludeUserId, 10) : null
      );

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data, 200);
    } catch (error) {
      log.error('检查用户名控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 验证令牌有效性
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async verifyToken(req, res) {
    try {
      // 如果能到达这里，说明令牌已经通过中间件验证
      const user = req.user;

      ApiResponse.success(res, '令牌有效', {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          store_id: user.store_id
        },
        tokenValid: true
      }, 200);
    } catch (error) {
      log.error('验证令牌控制器错误:', error);
      ApiResponse.error(res, '令牌验证失败', 401);
    }
  }

  /**
   * 获取用户统计信息（管理员功能）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getUserStats(req, res) {
    try {
      // 检查管理员权限
      if (!this.isAdminUser(req.user)) {
        return ApiResponse.error(res, '权限不足', 403);
      }

      const { store_id } = req.query;
      const filters = {};

      if (store_id) {
        filters.store_id = parseInt(store_id, 10);
      }

      const result = await this.authService.getUserStats(filters);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 500);
      }

      ApiResponse.success(res, result.message, result.data, 200);
    } catch (error) {
      log.error('获取用户统计控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 踢出用户（管理员功能）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async kickUser(req, res) {
    try {
      // 检查管理员权限
      if (!this.isAdminUser(req.user)) {
        return ApiResponse.error(res, '权限不足', 403);
      }

      const { userId } = req.params;

      if (!userId || parseInt(userId, 10) === req.user.id) {
        return ApiResponse.error(res, '无效的用户ID或不能踢出自己', 400);
      }

      // 这里可以实现将用户的令牌加入黑名单的逻辑
      // 可以使用 Redis 或数据库来存储被踢出的用户列表

      ApiResponse.success(res, '用户已被踢出', { userId }, 200);
    } catch (error) {
      log.error('踢出用户控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }

  /**
   * 禁用/启用用户（管理员功能）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async toggleUserStatus(req, res) {
    try {
      // 检查管理员权限
      if (!this.isAdminUser(req.user)) {
        return ApiResponse.error(res, '权限不足', 403);
      }

      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return ApiResponse.error(res, '无效的状态值', 400);
      }

      const result = await this.authService.updateUserInfo(parseInt(userId, 10), { status });

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, `用户已${status === 'active' ? '启用' : '禁用'}`, result.data, 200);
    } catch (error) {
      log.error('切换用户状态控制器错误:', error);
      ApiResponse.error(res, '服务器内部错误', 500);
    }
  }
}

module.exports = AuthController;
