const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class OperatorAssignmentService {
  constructor() {
    this.pool = getDatabase();
  }

  /**
   * 获取所有角色分组（从operators表获取）
   */
  async getOperatorGroups() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT DISTINCT
          id,
          group_name,
          description as group_description
        FROM operators
        WHERE status = ? AND group_name IS NOT NULL AND group_name != ''
        ORDER BY group_name
      `, ['active']);

      return rows;
    } catch (error) {
      log.error('获取角色分组失败:', error);
      throw error;
    }
  }

  /**
   * 创建新的角色分组（通过创建operators记录）
   */
  async createOperatorGroup(groupData) {
    try {
      const { group_name, description } = groupData;

      const [result] = await this.pool.execute(
        'INSERT INTO operators (name, real_name, group_name, role, description, status) VALUES (?, ?, ?, ?, ?, ?)',
        [group_name, group_name, group_name, 'group_role', description || '', 'active']
      );

      return { id: result.insertId, group_name, description };
    } catch (error) {
      log.error('创建角色分组失败:', error);
      throw error;
    }
  }

  /**
   * 更新角色分组（更新operators表中的记录）
   */
  async updateOperatorGroup(id, groupData) {
    try {
      const { group_name, description } = groupData;

      await this.pool.execute(
        'UPDATE operators SET name = ?, real_name = ?, group_name = ?, description = ? WHERE id = ?',
        [group_name, group_name, group_name, description || '', id]
      );

      return { id, group_name, description };
    } catch (error) {
      log.error('更新角色分组失败:', error);
      throw error;
    }
  }

  /**
   * 删除角色分组（删除operators表中的角色记录）
   */
  async deleteOperatorGroup(id) {
    try {
      await this.pool.execute('DELETE FROM operators WHERE id = ?', [id]);
      return true;
    } catch (error) {
      log.error('删除角色分组失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户分配的操作员角色
   */
  async getUserOperatorAssignments() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          uoa.id,
          uoa.user_id,
          uoa.operator_id,
          uoa.group_name,
          uoa.assigned_at,
          uoa.status,
          u.username as user_username,
          u.name as user_name,
          u.role as user_role,
          o.name as operator_name,
          o.real_name as operator_real_name,
          o.description as operator_description
        FROM user_operator_assignments uoa
        LEFT JOIN users u ON uoa.user_id = u.id
        LEFT JOIN operators o ON uoa.operator_id = o.id
        WHERE uoa.status = 'active'
        ORDER BY uoa.assigned_at DESC
      `);

      return rows;
    } catch (error) {
      log.error('获取用户操作员分配失败:', error);
      throw error;
    }
  }

  /**
   * 分配用户到操作员角色
   */
  async assignUserToOperator(assignmentData) {
    const { user_id, operator_id, group_name, assigned_by } = assignmentData;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 检查用户是否存在
      const [userCheck] = await connection.execute(
        'SELECT id, username, name FROM users WHERE id = ?',
        [user_id]
      );

      if (userCheck.length === 0) {
        throw new Error('用户不存在');
      }

      // 检查是否已经分配过
      const [existingAssignment] = await connection.execute(
        'SELECT id FROM user_operator_assignments WHERE user_id = ? AND operator_id = ? AND status = "active"',
        [user_id, operator_id]
      );

      if (existingAssignment.length > 0) {
        throw new Error('用户已分配到该操作员角色');
      }

      // 创建新的分配记录
      const [result] = await connection.execute(`
        INSERT INTO user_operator_assignments (user_id, operator_id, group_name, assigned_by, status)
        VALUES (?, ?, ?, ?, 'active')
      `, [user_id, operator_id, group_name, assigned_by]);

      await connection.commit();

      return {
        id: result.insertId,
        user_id,
        operator_id,
        group_name,
        assigned_by,
        status: 'active'
      };

    } catch (error) {
      await connection.rollback();
      log.error('分配用户操作员失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 取消用户操作员分配
   */
  async removeUserOperatorAssignment(assignmentId) {
    try {
      const connection = await this.pool.getConnection();

      try {
        await connection.beginTransaction();

        // 获取分配信息用于验证
        const [assignment] = await connection.execute(
          'SELECT id FROM user_operator_assignments WHERE id = ?',
          [assignmentId]
        );

        if (assignment.length === 0) {
          throw new Error('分配记录不存在');
        }

        // 更新分配状态
        await connection.execute(
          'UPDATE user_operator_assignments SET status = "inactive" WHERE id = ?',
          [assignmentId]
        );

        await connection.commit();
        return true;

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      log.error('移除用户操作员分配失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的操作员信息
   */
  async getUserOperatorInfo(userId) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          o.*,
          uoa.group_name as assigned_group,
          uoa.assigned_at
        FROM user_operator_assignments uoa
        LEFT JOIN operators o ON uoa.operator_id = o.id
        WHERE uoa.user_id = ? AND uoa.status = 'active'
        ORDER BY uoa.assigned_at DESC
        LIMIT 1
      `, [userId]);

      return rows[0] || null;
    } catch (error) {
      log.error('获取用户操作员信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取可分配的用户列表
   */
  async getAvailableUsers() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          u.id,
          u.username,
          u.name,
          u.role as user_role,
          u.status,
          uoa.id as assignment_id,
          uoa.group_name as current_group
        FROM users u
        LEFT JOIN user_operator_assignments uoa ON u.id = uoa.user_id AND uoa.status = 'active'
        WHERE u.status = 1
        ORDER BY u.username
      `);

      return rows;
    } catch (error) {
      log.error('获取可分配用户失败:', error);
      throw error;
    }
  }

  /**
   * 获取可分配的操作员角色
   */
  async getAvailableOperators() {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          o.*,
          (SELECT COUNT(*) FROM user_operator_assignments uoa WHERE uoa.operator_id = o.id AND uoa.status = 'active') as assigned_count
        FROM operators o
        WHERE o.status = 'active'
        ORDER BY o.name
      `);

      return rows;
    } catch (error) {
      log.error('获取可分配操作员失败:', error);
      throw error;
    }
  }

  /**
   * 通过角色分组查询用户
   */
  async getUsersByGroup(groupName) {
    try {
      const [rows] = await this.pool.execute(`
        SELECT
          u.id,
          u.username,
          u.name,
          u.role as user_role,
          u.email,
          u.phone,
          uoa.assigned_at,
          uoa.status as assignment_status,
          o.name as operator_name,
          o.description as operator_description
        FROM users u
        INNER JOIN user_operator_assignments uoa ON u.id = uoa.user_id
        INNER JOIN operators o ON uoa.operator_id = o.id
        WHERE uoa.group_name = ? AND uoa.status = 'active' AND u.status = 1
        ORDER BY u.username
      `, [groupName]);

      return rows;
    } catch (error) {
      log.error('获取角色分组用户失败:', error);
      throw error;
    }
  }

  /**
   * 修改用户角色分配
   */
  async updateUserRoleAssignment(assignmentId, updateData) {
    const { new_group_name, new_operator_id, assigned_by } = updateData;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // 验证分配记录是否存在
      const [existingAssignment] = await connection.execute(
        'SELECT id FROM user_operator_assignments WHERE id = ? AND status = "active"',
        [assignmentId]
      );

      if (existingAssignment.length === 0) {
        throw new Error('分配记录不存在或已失效');
      }

      // 获取当前分配信息
      const [currentAssignment] = await connection.execute(
        'SELECT user_id, operator_id, group_name FROM user_operator_assignments WHERE id = ?',
        [assignmentId]
      );

      const { user_id, operator_id, group_name } = currentAssignment[0];

      // 如果角色没有变化，直接返回
      if (group_name === new_group_name && operator_id === new_operator_id) {
        await connection.rollback();
        return currentAssignment[0];
      }

      // 更新分配记录
      await connection.execute(
        'UPDATE user_operator_assignments SET operator_id = ?, group_name = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?',
        [new_operator_id, new_group_name, assigned_by, assignmentId]
      );

      await connection.commit();

      return {
        id: assignmentId,
        user_id,
        operator_id: new_operator_id,
        group_name: new_group_name,
        assigned_by,
        assigned_at: new Date()
      };

    } catch (error) {
      await connection.rollback();
      log.error('修改用户角色分配失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = OperatorAssignmentService;
