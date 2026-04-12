const log = require('../utils/log');
const PermissionService = require('../services/permission.service');

class PermissionController {
  constructor() {
    this.permissionService = new PermissionService();
  }

  /**
   * 获取所有角色
   */
  async getRoles(req, res) {
    try {
      const roles = await this.permissionService.getAllRoles();

      res.json({
        success: true,
        message: '获取角色列表成功',
        data: roles
      });
    } catch (error) {
      log.error('获取角色列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色列表失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 创建角色
   */
  async createRole(req, res) {
    try {
      const roleData = req.body;

      if (!roleData.name) {
        return res.status(400).json({
          success: false,
          message: '角色名称不能为空'
        });
      }

      const role = await this.permissionService.createRole(roleData);

      res.json({
        success: true,
        message: '角色创建成功',
        data: role
      });
    } catch (error) {
      log.error('创建角色失败:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '角色名称已存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '创建角色失败: ' + error.message
      });
    }
  }

  /**
   * 更新角色
   */
  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const roleData = req.body;

      if (!roleData.name) {
        return res.status(400).json({
          success: false,
          message: '角色名称不能为空'
        });
      }

      const role = await this.permissionService.updateRole(id, roleData);

      res.json({
        success: true,
        message: '角色更新成功',
        data: role
      });
    } catch (error) {
      log.error('更新角色失败:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '角色名称已存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '更新角色失败: ' + error.message
      });
    }
  }

  /**
   * 删除角色
   */
  async deleteRole(req, res) {
    try {
      const { id } = req.params;

      await this.permissionService.deleteRole(id);

      res.json({
        success: true,
        message: '角色删除成功'
      });
    } catch (error) {
      log.error('删除角色失败:', error);
      res.status(500).json({
        success: false,
        message: '删除角色失败: ' + error.message
      });
    }
  }

  /**
   * 获取所有模块
   */
  async getModules(req, res) {
    try {
      const modules = await this.permissionService.getAllModules();

      res.json({
        success: true,
        message: '获取模块列表成功',
        data: modules
      });
    } catch (error) {
      log.error('获取模块列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取模块列表失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(req, res) {
    try {
      const { roleId } = req.params;

      const permissionMatrix = await this.permissionService.getRolePermissionMatrix(roleId);

      res.json({
        success: true,
        message: '获取角色权限成功',
        data: permissionMatrix
      });
    } catch (error) {
      log.error('获取角色权限失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色权限失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 设置角色权限
   */
  async setRolePermissions(req, res) {
    try {
      const { roleId } = req.params;
      const { permissions } = req.body;

      await this.permissionService.setRolePermissions(roleId, permissions);

      res.json({
        success: true,
        message: '角色权限设置成功'
      });
    } catch (error) {
      log.error('设置角色权限失败:', error);
      res.status(500).json({
        success: false,
        message: '设置角色权限失败: ' + error.message
      });
    }
  }

  /**
   * 为角色选择所有权限
   */
  async selectAllPermissions(req, res) {
    try {
      const { roleId } = req.params;

      await this.permissionService.selectAllPermissions(roleId);

      res.json({
        success: true,
        message: '已为角色分配所有权限'
      });
    } catch (error) {
      log.error('选择所有权限失败:', error);
      res.status(500).json({
        success: false,
        message: '选择所有权限失败: ' + error.message
      });
    }
  }

  /**
   * 清空角色所有权限
   */
  async clearAllPermissions(req, res) {
    try {
      const { roleId } = req.params;

      await this.permissionService.clearAllPermissions(roleId);

      res.json({
        success: true,
        message: '已清除角色的所有权限'
      });
    } catch (error) {
      log.error('清空所有权限失败:', error);
      res.status(500).json({
        success: false,
        message: '清空所有权限失败: ' + error.message
      });
    }
  }

  /**
   * 获取角色菜单权限
   */
  async getRoleMenus(req, res) {
    try {
      const { roleId } = req.params;

      const menus = await this.permissionService.getRoleMenus(roleId);

      res.json({
        success: true,
        message: '获取角色菜单权限成功',
        data: menus
      });
    } catch (error) {
      log.error('获取角色菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色菜单权限失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 设置角色菜单权限
   */
  async setRoleMenus(req, res) {
    try {
      const { roleId } = req.params;
      const { menuIds } = req.body;

      await this.permissionService.setRoleMenus(roleId, menuIds);

      res.json({
        success: true,
        message: '角色菜单权限设置成功'
      });
    } catch (error) {
      log.error('设置角色菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '设置角色菜单权限失败: ' + error.message
      });
    }
  }

  /**
   * 获取用户角色
   */
  async getUserRoles(req, res) {
    try {
      const { userId } = req.params;

      const roles = await this.permissionService.getUserRoles(userId);

      res.json({
        success: true,
        message: '获取用户角色成功',
        data: roles
      });
    } catch (error) {
      log.error('获取用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户角色失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 设置用户角色
   */
  async setUserRoles(req, res) {
    try {
      const { userId } = req.params;
      const { roleIds } = req.body;

      log.start(`收到设置用户角色请求: userId=${userId}, roleIds=${JSON.stringify(roleIds)}`);

      await this.permissionService.setUserRoles(userId, roleIds);

      log.success(`用户角色设置成功: userId=${userId}`);

      res.json({
        success: true,
        message: '用户角色设置成功'
      });
    } catch (error) {
      log.error('❌ 设置用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '设置用户角色失败: ' + error.message
      });
    }
  }

  /**
   * 检查用户权限
   */
  async checkUserPermission(req, res) {
    try {
      const { userId, moduleKey, permissionType } = req.query;

      if (!userId || !moduleKey || !permissionType) {
        return res.status(400).json({
          success: false,
          message: '参数不完整'
        });
      }

      const hasPermission = await this.permissionService.checkUserPermission(
        userId,
        moduleKey,
        permissionType
      );

      res.json({
        success: true,
        message: '权限检查完成',
        data: {
          hasPermission,
          userId,
          moduleKey,
          permissionType
        }
      });
    } catch (error) {
      log.error('检查用户权限失败:', error);
      res.status(500).json({
        success: false,
        message: '检查用户权限失败: ' + error.message,
        data: { hasPermission: false }
      });
    }
  }

  /**
   * 获取所有权限列表
   */
  async getAllPermissions(req, res) {
    try {
      // 获取所有模块
      const modules = await this.permissionService.getAllModules();

      // 获取所有权限类型的组合
      const allPermissions = [];
      const permissionTypes = ['view', 'create', 'edit', 'delete', 'export', 'import', 'sell'];

      modules.forEach(module => {
        permissionTypes.forEach(type => {
          allPermissions.push({
            id: `${module.key}_${type}`,
            module_key: module.key,
            module_name: module.name,
            permission_type: type,
            description: `${module.name} - ${type}权限`,
            category: module.category
          });
        });
      });

      res.json({
        success: true,
        message: '获取权限列表成功',
        data: allPermissions
      });
    } catch (error) {
      log.error('获取权限列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取权限列表失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 获取权限统计信息
   */
  async getPermissionStats(req, res) {
    try {
      const stats = await this.permissionService.getPermissionStats();

      res.json({
        success: true,
        message: '获取权限统计成功',
        data: stats
      });
    } catch (error) {
      log.error('获取权限统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取权限统计失败: ' + error.message,
        data: {}
      });
    }
  }
}

module.exports = PermissionController;