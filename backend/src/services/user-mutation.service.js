'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const UserMutationRepository = require('../repositories/user-mutation.repository')

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

class UserMutationService {
  constructor({
    database = getDatabase,
    passwordHasher = (password, rounds) => require('bcryptjs').hash(password, rounds),
    repository = new UserMutationRepository()
  } = {}) {
    this.database = database
    this.passwordHasher = passwordHasher
    this.repository = repository
  }

  async resolveRequestedRoleIds(connection, body) {
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
      const [roles] = await this.repository.findRoleByName(connection, role)
      if (roles.length === 0) throw invalidRoleRequest('用户角色不存在')
      roleIds = [roles[0].id]
    }

    const normalizedRoleIds = [...new Set(roleIds.map(roleId => Number(roleId)))]
    if (normalizedRoleIds.some(roleId => !Number.isSafeInteger(roleId) || roleId <= 0)) {
      throw invalidRoleRequest('角色ID列表包含无效值')
    }

    if (normalizedRoleIds.length > 0) {
      const [roles] = await this.repository.findRolesByIds(connection, normalizedRoleIds)
      if (roles.length !== normalizedRoleIds.length) throw invalidRoleRequest('部分角色不存在')
    }

    return normalizedRoleIds
  }

  selectPublicUser(connection, filters) {
    return this.repository.selectPublicUser(connection, filters)
  }

  async create(body) {
    if (!body.username || !body.password) throw invalidRoleRequest('用户名和密码不能为空')
    const pool = this.database()
    const userId = await withConnection(pool, async connection => {
      try {
        const {
          username,
          password,
          name,
          email,
          phone,
          status = 1,
          store_id,
          salary_template_id
        } = body

        await connection.beginTransaction()

        const [existingUsers] = await this.repository.findByUsername(connection, username)
        if (existingUsers.length > 0) {
          throw invalidRoleRequest('用户名已存在')
        }

        const roleIds = await this.resolveRequestedRoleIds(connection, body)
        const hashedPassword = await this.passwordHasher(password, 10)
        const [result] = await this.repository.create(connection, [
          username,
          hashedPassword,
          name || username,
          email || null,
          phone || null,
          normalizeUserStatus(status),
          store_id || null,
          salary_template_id || null
        ])

        await this.repository.replaceUserRoles(connection, result.insertId, roleIds)
        await connection.commit()
        return result.insertId

      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
    return { user: await this.repository.selectPublicUser(pool, { id: userId }) }
  }

  async update(id, body) {
    const pool = this.database()
    const result = await withConnection(pool, async connection => {
      try {
        await connection.beginTransaction()

        const userId = Number.parseInt(id, 10)
        const [existingUsers] = await this.repository.findById(connection, userId)
        if (existingUsers.length === 0) {
          await connection.rollback()
          return { notFound: true }
        }

        const {
          username,
          name,
          email,
          phone,
          status,
          store_id,
          salary_template_id,
          password
        } = body
        const updateFields = []
        const updateValues = []

        if (username !== undefined) {
          const [duplicateCheck] = await this.repository.findDuplicateUsername(connection, username, userId)
          if (duplicateCheck.length > 0) {
            throw invalidRoleRequest('用户名已存在')
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
          updateFields.push('password = ?')
          updateValues.push(await this.passwordHasher(password, 10))
        }

        const roleIds = await this.resolveRequestedRoleIds(connection, body)
        if (updateFields.length === 0 && roleIds === null) {
          throw invalidRoleRequest('没有提供要更新的字段')
        }

        if (updateFields.length > 0) {
          updateFields.push('updated_at = CURRENT_TIMESTAMP')
          updateValues.push(userId)
          await this.repository.update(connection, updateFields, updateValues)
        }

        await this.repository.replaceUserRoles(connection, userId, roleIds)
        await connection.commit()
        return { id: userId }

      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
    if (result.notFound) return result
    return { user: await this.repository.selectPublicUser(pool, { id: result.id }) }
  }
}
module.exports = UserMutationService
