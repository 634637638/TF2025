const log = require('../utils/log');
const OperatorAssignmentService = require('../services/operator-assignment.service');

class OperatorAssignmentController {
  constructor() {
    this.operatorService = new OperatorAssignmentService();
  }

  /**
   * 获取所有角色分组
   */
  async getGroups(req, res) {
    try {
      const groups = await this.operatorService.getOperatorGroups();

      res.json({
        success: true,
        message: '获取角色分组成功',
        data: groups
      });
    } catch (error) {
      log.error('获取角色分组失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色分组失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 创建角色分组
   */
  async createGroup(req, res) {
    try {
      const groupData = req.body;

      // 验证必填字段
      if (!groupData.group_name) {
        return res.status(400).json({
          success: false,
          message: '角色分组名称不能为空'
        });
      }

      const group = await this.operatorService.createOperatorGroup(groupData);

      res.json({
        success: true,
        message: '角色分组创建成功',
        data: group
      });
    } catch (error) {
      log.error('创建角色分组失败:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '角色分组名称已存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '创建角色分组失败: ' + error.message
      });
    }
  }

  /**
   * 更新角色分组
   */
  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const groupData = req.body;

      // 验证必填字段
      if (!groupData.group_name) {
        return res.status(400).json({
          success: false,
          message: '角色分组名称不能为空'
        });
      }

      const group = await this.operatorService.updateOperatorGroup(id, groupData);

      res.json({
        success: true,
        message: '角色分组更新成功',
        data: group
      });
    } catch (error) {
      log.error('更新角色分组失败:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '角色分组名称已存在'
        });
      }

      res.status(500).json({
        success: false,
        message: '更新角色分组失败: ' + error.message
      });
    }
  }

  /**
   * 删除角色分组
   */
  async deleteGroup(req, res) {
    try {
      const { id } = req.params;

      // 检查是否有用户分配到该分组
      const assignments = await this.operatorService.getUserOperatorAssignments();
      const hasAssignments = assignments.some(assignment =>
        assignment.group_name === id && assignment.status === 'active'
      );

      if (hasAssignments) {
        return res.status(400).json({
          success: false,
          message: '该角色分组下还有用户分配，无法删除'
        });
      }

      await this.operatorService.deleteOperatorGroup(id);

      res.json({
        success: true,
        message: '角色分组删除成功'
      });
    } catch (error) {
      log.error('删除角色分组失败:', error);
      res.status(500).json({
        success: false,
        message: '删除角色分组失败: ' + error.message
      });
    }
  }

  /**
   * 获取用户操作员分配列表
   */
  async getAssignments(req, res) {
    try {
      const assignments = await this.operatorService.getUserOperatorAssignments();

      res.json({
        success: true,
        message: '获取用户操作员分配成功',
        data: assignments
      });
    } catch (error) {
      log.error('获取用户操作员分配失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户操作员分配失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 分配用户到操作员角色
   */
  async assignUserToOperator(req, res) {
    try {
      const assignmentData = req.body;

      // 验证必填字段
      if (!assignmentData.user_id || !assignmentData.operator_id || !assignmentData.group_name) {
        return res.status(400).json({
          success: false,
          message: '用户ID、操作员ID和角色分组不能为空'
        });
      }

      // 添加分配人信息
      assignmentData.assigned_by = req.user?.id || null;

      const assignment = await this.operatorService.assignUserToOperator(assignmentData);

      res.json({
        success: true,
        message: '用户角色分配成功',
        data: assignment
      });
    } catch (error) {
      log.error('分配用户操作员失败:', error);
      res.status(500).json({
        success: false,
        message: '分配用户操作员失败: ' + error.message
      });
    }
  }

  /**
   * 移除用户操作员分配
   */
  async removeUserOperatorAssignment(req, res) {
    try {
      const { id } = req.params;

      await this.operatorService.removeUserOperatorAssignment(id);

      res.json({
        success: true,
        message: '用户角色分配移除成功'
      });
    } catch (error) {
      log.error('移除用户操作员分配失败:', error);
      res.status(500).json({
        success: false,
        message: '移除用户操作员分配失败: ' + error.message
      });
    }
  }

  /**
   * 获取用户的操作员信息
   */
  async getUserOperatorInfo(req, res) {
    try {
      const { userId } = req.params;

      const operatorInfo = await this.operatorService.getUserOperatorInfo(userId);

      if (!operatorInfo) {
        return res.json({
          success: true,
          message: '用户未分配操作员角色',
          data: null
        });
      }

      res.json({
        success: true,
        message: '获取用户操作员信息成功',
        data: operatorInfo
      });
    } catch (error) {
      log.error('获取用户操作员信息失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户操作员信息失败: ' + error.message,
        data: null
      });
    }
  }

  /**
   * 获取可分配的用户列表
   */
  async getAvailableUsers(req, res) {
    try {
      const users = await this.operatorService.getAvailableUsers();

      res.json({
        success: true,
        message: '获取可分配用户成功',
        data: users
      });
    } catch (error) {
      log.error('获取可分配用户失败:', error);
      res.status(500).json({
        success: false,
        message: '获取可分配用户失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 获取可分配的操作员角色
   */
  async getAvailableOperators(req, res) {
    try {
      const operators = await this.operatorService.getAvailableOperators();

      res.json({
        success: true,
        message: '获取可分配操作员成功',
        data: operators
      });
    } catch (error) {
      log.error('获取可分配操作员失败:', error);
      res.status(500).json({
        success: false,
        message: '获取可分配操作员失败: ' + error.message,
        data: []
      });
    }
  }

  /**
   * 批量分配用户到操作员角色
   */
  async batchAssignUsers(req, res) {
    try {
      const { userIds, operator_id, group_name } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '用户ID列表不能为空'
        });
      }

      if (!operator_id || !group_name) {
        return res.status(400).json({
          success: false,
          message: '操作员ID和角色分组不能为空'
        });
      }

      const assigned_by = req.user?.id || null;
      const results = [];

      for (const user_id of userIds) {
        try {
          const assignment = await this.operatorService.assignUserToOperator({
            user_id,
            operator_id,
            group_name,
            assigned_by
          });
          results.push({ user_id, success: true, assignment });
        } catch (error) {
          results.push({ user_id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        message: `批量分配完成，成功分配 ${successCount}/${userIds.length} 个用户`,
        data: {
          total: userIds.length,
          success: successCount,
          failed: userIds.length - successCount,
          results
        }
      });
    } catch (error) {
      log.error('批量分配用户操作员失败:', error);
      res.status(500).json({
        success: false,
        message: '批量分配用户操作员失败: ' + error.message
      });
    }
  }

  /**
   * 简化的用户角色分配 - 直接通过用户ID和角色分组名称分配
   */
  async assignUserRole(req, res) {
    try {
      const { user_id, group_name } = req.body;
      const assigned_by = req.user.id;

      // 验证输入
      if (!user_id || !group_name) {
        return res.status(400).json({
          success: false,
          message: '用户ID和角色分组名称是必填的'
        });
      }

      // 根据角色分组名称找到对应的操作员
      const operators = await this.operatorService.getAvailableOperators();
      const operator = operators.find(op => op.group_name === group_name);

      if (!operator) {
        return res.status(404).json({
          success: false,
          message: `找不到角色分组 "${group_name}"`
        });
      }

      // 分配用户到操作员
      const assignment = await this.operatorService.assignUserToOperator({
        user_id,
        operator_id: operator.id,
        group_name,
        assigned_by
      });

      res.json({
        success: true,
        message: '用户角色分配成功',
        data: assignment
      });
    } catch (error) {
      log.error('分配用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '分配用户角色失败: ' + error.message
      });
    }
  }

  /**
   * 通过角色分组查询用户
   */
  async getUsersByGroup(req, res) {
    try {
      const { groupName } = req.params;

      const users = await this.operatorService.getUsersByGroup(groupName);

      res.json({
        success: true,
        message: `获取角色分组 "${groupName}" 的用户成功`,
        data: users
      });
    } catch (error) {
      log.error('获取角色分组用户失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色分组用户失败: ' + error.message
      });
    }
  }

  /**
   * 修改用户角色分配
   */
  async updateUserRoleAssignment(req, res) {
    try {
      const { id } = req.params;
      const { new_group_name } = req.body;
      const assigned_by = req.user.id;

      // 验证输入
      if (!new_group_name) {
        return res.status(400).json({
          success: false,
          message: '新的角色分组名称是必填的'
        });
      }

      // 根据角色分组名称找到对应的操作员
      const operators = await this.operatorService.getAvailableOperators();
      const newOperator = operators.find(op => op.group_name === new_group_name);

      if (!newOperator) {
        return res.status(404).json({
          success: false,
          message: `找不到角色分组 "${new_group_name}"`
        });
      }

      // 修改用户角色分配
      const updatedAssignment = await this.operatorService.updateUserRoleAssignment(id, {
        new_group_name,
        new_operator_id: newOperator.id,
        assigned_by
      });

      res.json({
        success: true,
        message: '用户角色修改成功',
        data: updatedAssignment
      });
    } catch (error) {
      log.error('修改用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '修改用户角色失败: ' + error.message
      });
    }
  }
}

module.exports = OperatorAssignmentController;