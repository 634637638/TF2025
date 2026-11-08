'use strict'

const PermissionRoleManagementRepository = require('../repositories/permission-role-management.repository')
const PermissionLogsService = require('./permission-logs.service')
const { hasColumn } = require('./schema-inspector.service')
const log = require('../utils/log')

const ROLE_TYPES = new Set(['super_admin', 'admin', 'manager', 'employee', 'system', 'business'])

function createServiceError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

class PermissionRoleManagementService {
  constructor({ repository = new PermissionRoleManagementRepository(), inspectColumn = hasColumn, audit = new PermissionLogsService(), logger = log } = {}) {
    this.repository = repository
    this.inspectColumn = inspectColumn
    this.audit = audit
    this.logger = logger
  }

  validateNameAndDescription(name, description) {
    if (!name || !name.trim()) throw createServiceError('角色名称不能为空', 400)
    if (!description || !description.trim()) throw createServiceError('角色描述不能为空', 400)
    return { name: name.trim(), description: description.trim() }
  }

  async create(input, req) {
    const { name, description } = this.validateNameAndDescription(input.name, input.description)
    const supportsRoleCode = await this.inspectColumn('roles', 'code')
    const code = typeof input.code === 'string' && input.code.trim() ? input.code.trim() : null
    if ((await this.repository.findByName(name)).length > 0) {
      throw createServiceError('角色名称已存在', 400)
    }
    if (supportsRoleCode && code && (await this.repository.findByCode(code)).length > 0) {
      throw createServiceError('角色编码已存在', 400)
    }
    const role = await this.repository.create({ name, description, code, supportsRoleCode })
    await this.audit.logRoleOperation(req, 'create', role.id, role.name, {
      description: role.description,
      code: role.code
    })
    return role
  }

  async update(id, input, req) {
    const { name, description } = this.validateNameAndDescription(input.name, input.description)
    const [supportsRoleCode, supportsRoleType] = await Promise.all([
      this.inspectColumn('roles', 'code'),
      this.inspectColumn('roles', 'role_type')
    ])
    const role = await this.repository.findById(id, { supportsRoleType, supportsRoleCode })
    if (!role) throw createServiceError('角色不存在', 404)
    const normalizedCode = typeof input.code === 'string' && input.code.trim() ? input.code.trim() : null
    const storedCode = supportsRoleCode ? (role.code || `role_${id}`) : null
    if (supportsRoleCode && normalizedCode && normalizedCode !== storedCode) {
      throw createServiceError('角色编码创建后不可修改', 400)
    }
    if ((await this.repository.findByName(name, id)).length > 0) {
      throw createServiceError('角色名称已存在', 400)
    }
    if (input.role_type && !ROLE_TYPES.has(input.role_type)) {
      throw createServiceError('无效的角色类型', 400)
    }
    await this.repository.update({ id, name, description, roleType: input.role_type, supportsRoleType })
    await this.audit.logRoleOperation(req, 'edit', id, name, {
      description,
      code: storedCode,
      previous_name: role.name,
      previous_description: role.description,
      role_type_change: input.role_type !== role.role_type ? `${role.role_type} -> ${input.role_type}` : null
    })
    return {
      id: Number.parseInt(id, 10),
      name,
      code: storedCode,
      description,
      role_type: input.role_type || role.role_type,
      previous_role_type: role.role_type
    }
  }

  async remove(id, req) {
    const result = await this.repository.remove(id)
    if (!result.role) throw createServiceError('角色不存在', 404)
    if (result.usersCount > 0) throw createServiceError('无法删除该角色，仍有用户使用该角色', 400)
    await this.audit.logRoleOperation(req, 'delete', id, result.role.name)
  }

  async updateStatus(id, input, req) {
    const isActive = input.is_active
    if (!isActive || (isActive !== '0' && isActive !== '1')) {
      throw createServiceError('状态值必须是0或1', 400)
    }
    if (!await this.inspectColumn('roles', 'is_active')) {
      throw createServiceError('当前数据库结构不支持角色启停', 400)
    }

    const role = await this.repository.findStatusById(id)
    if (!role) throw createServiceError('角色不存在', 404)
    if ([1, 9].includes(Number(role.id)) && String(isActive) === '0') {
      throw createServiceError('系统角色不能停用', 403)
    }

    await this.repository.updateStatus(id, isActive)
    let affectedUsersCount = 0
    if (isActive === '0') {
      const userIds = await this.repository.listUserIdsByRole(id)
      affectedUsersCount = userIds.length
      if (userIds.length > 0) {
        try {
          await this.repository.deleteRefreshTokens(userIds)
        } catch (error) {
          if (error.code === 'ER_NO_SUCH_TABLE') {
            this.logger.warn('refresh_tokens表不存在，跳过token清理操作')
          } else {
            throw error
          }
        }
      }
    }

    const action = isActive === '1' ? '启用' : '停用'
    if (Number(role.is_active) !== Number(isActive)) {
      await this.audit.logRoleOperation(req, 'edit', id, role.name, {
        audit_type: 'role_status',
        previous_is_active: Number(role.is_active),
        is_active: Number(isActive),
        affected_users: affectedUsersCount,
        status_action: action
      })
    }
    return { action, affected_users: affectedUsersCount }
  }
}

module.exports = PermissionRoleManagementService
