'use strict'

const { hasUnifiedPermission, invalidateAuthProfiles } = require('../middleware/unified-auth')
const SalaryTemplateService = require('./salary-template.service')
const UserRoleAssignmentService = require('./user-role-assignment.service')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const UserMutationRepository = require('../repositories/user-mutation.repository')
const { parseAccountInput } = require('../utils/account-input')
const { parseInput } = require('../middleware/validation')
const { isIntegerInput } = require('../utils/input-values')
const { normalizeRoleIds } = require('../utils/employee-role-format')

function invalidRoleRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function normalizeUserStatus(status) {
  if (status === 'active') return 1
  if (status === 'inactive') return 0
  const normalizedStatus = Number(status)
  if (!isIntegerInput(status) || (normalizedStatus !== 0 && normalizedStatus !== 1)) {
    throw invalidRoleRequest('用户状态必须为 0、1、active 或 inactive')
  }
  return normalizedStatus
}

function parseUserInput(body, required = false) {
  const source = parseInput(body, {})
  if (source.status !== undefined) source.status = normalizeUserStatus(source.status)
  // 用户管理沿用 0 表示未分配的契约；仅接受明确的数值/字符串零。
  for (const field of ['store_id', 'salary_template_id']) if (source[field] === 0 || source[field] === '0') source[field] = null
  const input = parseAccountInput(source, { required, requireName: false, allowEmptyName: true, allowEmptyPassword: !required })
  for (const field of ['role_ids', 'role_id']) {
    if (input[field] === undefined) continue
    if (!normalizeRoleIds(field === 'role_ids' ? input[field] : [input[field]])) throw invalidRoleRequest('角色ID列表包含无效值')
  }
  if (input.role !== undefined) parseInput({ role: input.role }, { role: { type: 'string', maxLength: 100 } })
  return input
}

class UserMutationService {
  constructor({
    database = getDatabase,
    passwordHasher = (password, rounds) => require('bcryptjs').hash(password, rounds),
    repository = new UserMutationRepository(),
    permissionCheck = hasUnifiedPermission,
    roleAssignment
  } = {}) {
    this.database = database
    this.passwordHasher = passwordHasher
    this.repository = repository
    this.permissionCheck = permissionCheck
    this.roleAssignment = roleAssignment || new UserRoleAssignmentService({ permissionCheck })
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

    const normalizedRoleIds = normalizeRoleIds(roleIds)
    if (!normalizedRoleIds) {
      throw invalidRoleRequest('角色ID列表包含无效值')
    }

    return normalizedRoleIds
  }

  async assertRoleRequest(body, actor) {
    if (['role_ids', 'role_id', 'role'].some(field => Object.hasOwn(body, field))) {
      await this.roleAssignment.assertCanAssign(actor)
    }
  }

  async replaceRoles(connection, userId, roleIds, user) {
    const result = await this.roleAssignment.assignInTransaction(connection, { userId, roleIds, user })
    if (result.status !== 'updated') throw invalidRoleRequest(result.status === 'not_found' ? '用户不存在' : '部分角色不存在')
    return result
  }

  selectPublicUser(connection, filters) {
    return this.repository.selectPublicUser(connection, filters)
  }

  async create(body, actor, requestContext) {
    if (!body?.username || !body?.password) throw invalidRoleRequest('用户名和密码不能为空')
    body = parseUserInput(body, true)
    await SalaryTemplateService.assertEmployeeTemplateWrite(body, actor, this.permissionCheck)
    await this.assertRoleRequest(body, actor)
    const pool = this.database()
    let assignment
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

        if (roleIds !== null) assignment = await this.replaceRoles(connection, result.insertId, roleIds, { id: result.insertId, username })
        await connection.commit()
        return result.insertId

      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
    invalidateAuthProfiles([userId])
    if (assignment) await this.roleAssignment.afterCommit(userId, assignment, requestContext || { user: actor })
    return { user: await this.repository.selectPublicUser(pool, { id: userId }) }
  }

  async update(id, body, actor, requestContext) {
    const userId = parseInput({ id }, { id: { type: 'id', required: true } }).id
    body = parseUserInput(body)
    await SalaryTemplateService.assertEmployeeTemplateWrite(body, actor, this.permissionCheck)
    await this.assertRoleRequest(body, actor)
    await this.roleAssignment.assertAccountAccess(userId, actor)
    const pool = this.database()
    let assignment
    const result = await withConnection(pool, async connection => {
      try {
        await connection.beginTransaction()

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

        if (roleIds !== null) assignment = await this.replaceRoles(connection, userId, roleIds)
        await connection.commit()
        return { id: userId }

      } catch (error) {
        await connection.rollback().catch(() => {})
        throw error
      }
    })
    if (result.notFound) return result
    invalidateAuthProfiles([userId])
    if (assignment) await this.roleAssignment.afterCommit(userId, assignment, requestContext || { user: actor })
    return { user: await this.repository.selectPublicUser(pool, { id: result.id }) }
  }
}
module.exports = UserMutationService
