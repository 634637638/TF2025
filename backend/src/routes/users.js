const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const UserRepository = require('../repositories/user.repository')
const ApiResponse = require('../utils/response')
const { getDatabase, isConnected } = require('../config/database')
const { getAttendanceAccessScope, hasUserPermission } = require('../services/accessControl.service')
const log = require('../utils/log')

const router = express.Router()
const userRepository = new UserRepository()
const USER_PUBLIC_COLUMNS = 'u.id, u.username, u.name, u.email, u.phone, u.status, u.store_id, u.salary_template_id, u.created_at, u.updated_at'

function invalidRoleRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function normalizeUserStatus(status) {
  if (status === 'active') return 1
  if (status === 'inactive') return 0
  const normalizedStatus = Number(status)
  if (normalizedStatus !== 0 && normalizedStatus !== 1) {
    throw invalidRoleRequest('用户状态必须为 0、1、active 或 inactive')
  }
  return normalizedStatus
}

async function resolveRequestedRoleIds(connection, body) {
  const hasRoleIds = Object.hasOwn(body, 'role_ids')
  const hasRoleId = Object.hasOwn(body, 'role_id')
  const hasRoleName = typeof body.role === 'string' && body.role.trim() !== ''

  if (!hasRoleIds && !hasRoleId && !hasRoleName) return null

  let roleIds
  if (hasRoleIds) {
    if (!Array.isArray(body.role_ids)) throw invalidRoleRequest('role_ids 必须是数组')
    roleIds = body.role_ids
  } else if (hasRoleId) {
    roleIds = [body.role_id]
  } else {
    const role = body.role.trim()
    const [roles] = await connection.execute(
      'SELECT id FROM roles WHERE code = ? OR name = ? LIMIT 1',
      [role, role]
    )
    if (roles.length === 0) throw invalidRoleRequest('用户角色不存在')
    roleIds = [roles[0].id]
  }

  const normalizedRoleIds = [...new Set(roleIds.map(roleId => Number(roleId)))]
  if (normalizedRoleIds.some(roleId => !Number.isSafeInteger(roleId) || roleId <= 0)) {
    throw invalidRoleRequest('角色ID列表包含无效值')
  }

  if (normalizedRoleIds.length > 0) {
    const placeholders = normalizedRoleIds.map(() => '?').join(',')
    const [roles] = await connection.execute(
      `SELECT id FROM roles WHERE id IN (${placeholders})`,
      normalizedRoleIds
    )
    if (roles.length !== normalizedRoleIds.length) throw invalidRoleRequest('部分角色不存在')
  }

  return normalizedRoleIds
}

async function replaceUserRoles(connection, userId, roleIds) {
  if (roleIds === null) return

  await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])
  if (roleIds.length === 0) return

  const values = roleIds.map(() => '(?, ?, NOW(), NOW())').join(',')
  await connection.execute(
    `INSERT INTO user_roles (user_id, role_id, assigned_at, created_at) VALUES ${values}`,
    roleIds.flatMap(roleId => [userId, roleId])
  )
}

async function selectPublicUser(connection, { id, username } = {}) {
  const whereClause = id !== undefined ? 'u.id = ?' : 'u.username = ?'
  const value = id !== undefined ? id : username
  const [users] = await connection.execute(
    `SELECT ${USER_PUBLIC_COLUMNS},
            GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ', ') AS role,
            GROUP_CONCAT(DISTINCT r.id ORDER BY r.id SEPARATOR ',') AS role_ids
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE ${whereClause}
      GROUP BY u.id`,
    [value]
  )

  if (users.length === 0) return null
  const user = users[0]
  return {
    ...user,
    role_ids: user.role_ids ? String(user.role_ids).split(',').map(Number) : []
  }
}

/**
 * 获取员工简单列表（用于考勤、综合查询等场景）
 * GET /api/users/employees
 * 权限规则：
 * - 考勤管理用户，或有综合查询权限：可以看到所有员工
 * - 普通用户（只有个人考勤查看权限）：只能看到自己
 */
router.get('/employees', unifiedAuth, requireAnyPermission(['attendance:view', 'attendance:view:own', 'attendance:view:all', 'query:view']), async (req, res) => {
  try {
    const { status = '1' } = req.query
    const userId = req.user.id

    const db = getDatabase()
    const [attendanceScope, hasQueryPermission] = await Promise.all([
      getAttendanceAccessScope(userId),
      hasUserPermission(userId, 'query_queryview', 'view')
    ])
    const isAdmin = attendanceScope.isAdmin || hasQueryPermission

    let users
    if (isAdmin) {
      // 考勤管理用户或有综合查询权限：查看所有员工
      [users] = await db.execute(
        `SELECT id, username, name, status
         FROM users
         WHERE status = ?
         ORDER BY COALESCE(NULLIF(name, ''), username) ASC, id ASC`,
        [status]
      )
    } else {
      // 普通用户：只能看到自己
      [users] = await db.execute(
        `SELECT id, username, name, status
         FROM users
         WHERE id = ? AND status = ?`,
        [userId, status]
      )
    }

    const employees = users.map(user => ({
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      status: user.status
    }))

    return ApiResponse.success(res, {
      employees,
      total: employees.length,
      is_admin: isAdmin
    }, '获取员工列表成功')
  } catch (error) {
    log.error('获取员工列表失败:', error)
    return ApiResponse.error(res, '获取员工列表失败', 500)
  }
})

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { page = 1, page_size, role, status = '1' } = req.query

    // 验证分页参数
    const pageInt = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeInt = Math.min(1000, Math.max(1, parseInt(page_size, 10) || 1000))
    const offset = (pageInt - 1) * pageSizeInt

    // 使用UserRepository获取用户列表
    const filters = {
      role,
      status
    }

    const pagination = {
      page: pageInt,
      page_size: pageSizeInt,
      offset
    }

    const result = await userRepository.getUsers(filters, pagination)

    // 转换为前端需要的格式 (id, name)，添加store_id字段
    const formattedUsers = result.data.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username,
      role: user.role,
      status: user.status,
      store_id: user.store_id || null // 添加门店ID字段
    }))

    return ApiResponse.success(res, {
      users: formattedUsers,
      pagination: {
        page: pageInt,
        page_size: pageSizeInt,
        total: result.pagination.total,
        total_pages: result.pagination.total_pages,
        has_next: result.pagination.has_next,
        has_prev: result.pagination.has_prev
      }
    }, '获取用户列表成功')
  } catch (error) {
    log.error('获取用户列表失败:', error)
    return ApiResponse.error(res, '获取用户列表失败', 500)
  }
})

/**
 * 根据用户名获取用户档案信息
 * GET /api/users/profile?username=<username>
 */
router.get('/profile', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { username } = req.query

    if (!username) {
      return ApiResponse.error(res, '用户名不能为空', 400)
    }

    const db = getDatabase()
    const user = await selectPublicUser(db, { username })

    if (!user || Number(user.status) !== 1) {
      return ApiResponse.error(res, '用户不存在或已禁用', 404)
    }

    // 格式化返回数据
    const userProfile = {
      id: user.id,
      username: user.username,
      name: user.name, // 真实姓名
      role: user.role,
      status: user.status,
      email: user.email,
      phone: user.phone,
      store_id: user.store_id,
      salary_template_id: user.salary_template_id,
      role_ids: user.role_ids,
      created_at: user.created_at,
      updated_at: user.updated_at
    }

    return ApiResponse.success(res, userProfile, '获取用户档案成功')
  } catch (error) {
    log.error('获取用户档案失败:', error)
    return ApiResponse.error(res, '获取用户档案失败', 500)
  }
})

/**
 * 获取操作员列表 (销售员)
 * GET /api/users/operators
 * 注意：必须放在 /:id 路由之前，否则 operators 会被当作 :id 参数处理
 */
router.get('/operators', unifiedAuth, async (req, res) => {
  try {
    const db = getDatabase()

    // 查询有角色的用户作为操作员 (通过user_roles和roles表关联查询)
    // 使用 GROUP_CONCAT 合并多个角色，避免重复用户
    const [operators] = await db.execute(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.phone,
        u.status,
        u.salary_template_id,
        GROUP_CONCAT(DISTINCT r.name SEPARATOR ', ') as role_name,
        GROUP_CONCAT(DISTINCT COALESCE(r.code, CONCAT('role_', r.id)) SEPARATOR ', ') as role_codes
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE u.status = 1 AND r.is_active = 1
      GROUP BY u.id, u.username, u.name, u.phone, u.status, u.salary_template_id
      ORDER BY COALESCE(NULLIF(u.name, ''), u.username) ASC, u.id ASC
    `)

    // 转换为前端需要的格式 - 使用name字段作为显示名称
    const formattedOperators = operators.map(user => ({
      id: user.id,
      name: user.name || user.username, // 优先使用真实姓名，没有则使用用户名
      username: user.username,
      phone: user.phone,
      salary_template_id: user.salary_template_id,
      role: user.role_name,
      role_codes: user.role_codes ? user.role_codes.split(', ') : []
    }))

    return ApiResponse.success(res, formattedOperators, '获取操作员列表成功')
  } catch (error) {
    log.error('获取操作员列表失败:', error)
    return ApiResponse.error(res, '获取操作员列表失败', 500)
  }
})

/**
 * 根据ID获取用户详情
 * GET /api/users/:id
 */
router.get('/:id', unifiedAuth, requirePermission('users:view'), async (req, res) => {
  try {
    const { id } = req.params

    const user = await userRepository.findUserDetailsById(id)
    if (!user) {
      return ApiResponse.error(res, '用户不存在', 404)
    }

    return ApiResponse.success(res, user, '获取用户详情成功')
  } catch (error) {
    log.error('获取用户详情失败:', error)
    return ApiResponse.error(res, '获取用户详情失败', 500)
  }
})

/**
 * 创建用户
 * POST /api/users
 */
router.post('/', unifiedAuth, requirePermission('users:create'), async (req, res) => {
  let connection
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      username,
      password,
      name,
      email,
      phone,
      status = 1,
      store_id,
      salary_template_id
    } = req.body

    // 验证必需字段
    if (!username || !password) {
      return ApiResponse.badRequest(res, '用户名和密码不能为空')
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )
    if (existingUsers.length > 0) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '用户名已存在')
    }

    const roleIds = await resolveRequestedRoleIds(connection, req.body)
    const insertQuery = `
      INSERT INTO users (
        username, password, name, email, phone, status, store_id, salary_template_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `

    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 10)

    const insertValues = [
      username,
      hashedPassword,
      name || username,
      email || null,
      phone || null,
      normalizeUserStatus(status),
      store_id || null,
      salary_template_id || null
    ]

    const [result] = await connection.execute(insertQuery, insertValues)
    await replaceUserRoles(connection, result.insertId, roleIds)
    await connection.commit()

    const newUser = await selectPublicUser(pool, { id: result.insertId })

    ApiResponse.created(res, '用户创建成功', newUser)
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {})
    if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
    log.error('创建用户失败:', error)
    ApiResponse.serverError(res, '创建用户失败', error)
  } finally {
    connection?.release()
  }
})

/**
 * 更新用户
 * PUT /api/users/:id
 */
router.put('/:id', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  let connection
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    connection = await pool.getConnection()
    await connection.beginTransaction()

    const userId = Number.parseInt(id, 10)
    const [existingUsers] = await connection.execute('SELECT id FROM users WHERE id = ?', [userId])
    if (existingUsers.length === 0) {
      await connection.rollback()
      return ApiResponse.notFound(res, '用户不存在')
    }

    const {
      username,
      name,
      email,
      phone,
      status,
      store_id,
      salary_template_id,
      password // 可选的密码更新
    } = req.body

    // 构建更新字段
    const updateFields = []
    const updateValues = []

    if (username !== undefined) {
      // 检查用户名是否重复（排除当前用户）
      const [duplicateCheck] = await connection.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      )
      if (duplicateCheck.length > 0) {
        await connection.rollback()
        return ApiResponse.badRequest(res, '用户名已存在')
      }
      updateFields.push('username = ?')
      updateValues.push(username)
    }

    if (name !== undefined) {
      updateFields.push('name = ?')
      updateValues.push(name)
    }

    if (email !== undefined) {
      updateFields.push('email = ?')
      updateValues.push(email)
    }

    if (phone !== undefined) {
      updateFields.push('phone = ?')
      updateValues.push(phone)
    }

    if (status !== undefined) {
      updateFields.push('status = ?')
      updateValues.push(normalizeUserStatus(status))
    }

    if (store_id !== undefined) {
      updateFields.push('store_id = ?')
      updateValues.push(store_id)
    }

    if (salary_template_id !== undefined) {
      updateFields.push('salary_template_id = ?')
      updateValues.push(salary_template_id || null)
    }

    if (password !== undefined && password !== '') {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(password, 10)
      updateFields.push('password = ?')
      updateValues.push(hashedPassword)
    }

    const roleIds = await resolveRequestedRoleIds(connection, req.body)
    if (updateFields.length === 0 && roleIds === null) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '没有提供要更新的字段')
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP')
      updateValues.push(userId)
      const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`
      await connection.execute(updateQuery, updateValues)
    }

    await replaceUserRoles(connection, userId, roleIds)
    await connection.commit()
    const updatedUser = await selectPublicUser(pool, { id: userId })

    ApiResponse.success(res, updatedUser, '用户更新成功')
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {})
    if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
    log.error('更新用户失败:', error)
    ApiResponse.serverError(res, '更新用户失败', error)
  } finally {
    connection?.release()
  }
})

/**
 * 删除用户
 * DELETE /api/users/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('users:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查用户是否存在
    const existingUser = await selectPublicUser(pool, { id: Number.parseInt(id, 10) })
    if (!existingUser) {
      return ApiResponse.notFound(res, '用户不存在')
    }

    // 删除用户
    await pool.execute('DELETE FROM users WHERE id = ?', [Number.parseInt(id, 10)])

    ApiResponse.success(res, existingUser, '用户删除成功')
  } catch (error) {
    log.error('删除用户失败:', error)
    ApiResponse.serverError(res, '删除用户失败', error)
  }
})

/**
 * 切换用户状态
 * PATCH /api/users/:id/toggle
 */
router.patch('/:id/toggle', unifiedAuth, requirePermission('users:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查用户是否存在
    const existingUser = await selectPublicUser(pool, { id: Number.parseInt(id, 10) })
    if (!existingUser) {
      return ApiResponse.notFound(res, '用户不存在')
    }

    const newStatus = Number(existingUser.status) === 1 ? 0 : 1

    // 更新状态
    await pool.execute(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, Number.parseInt(id, 10)]
    )

    // 获取更新后的数据
    const updatedUser = await selectPublicUser(pool, { id: Number.parseInt(id, 10) })

    const statusText = newStatus === 1 ? '启用' : '禁用'
    ApiResponse.success(res, updatedUser, `用户${statusText}成功`)
  } catch (error) {
    log.error('切换用户状态失败:', error)
    ApiResponse.serverError(res, '切换用户状态失败', error)
  }
})

module.exports = router
