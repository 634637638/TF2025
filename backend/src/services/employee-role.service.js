'use strict'

const EmployeeRoleRepository = require('../repositories/employee-role.repository')
const { formatEmployeeRoles, normalizeRoleIds } = require('../utils/employee-role-format')
const PermissionLogsService = require('./permission-logs.service')
const { hasUnifiedPermission, invalidateAuthProfiles } = require('../middleware/unified-auth')
const BaseService = require('../core/base/base.service')

class EmployeeRoleService extends BaseService {
  constructor({ repository = new EmployeeRoleRepository(), audit = new PermissionLogsService(), permissionCheck = hasUnifiedPermission } = {}) {
    super()
    this.repository = repository
    this.audit = audit
    this.permissionCheck = permissionCheck
  }

  async systemRoles() {
    
    const roles = await this.repository.getActiveSystemRoles()
    return { data: { roles }, message: '获取系统角色列表成功' }
  }

  async list(actor) {
    
    const rows = await this.repository.getRolesWithUserCount()
    const roles = await this.permissionCheck(actor, 'permissions:admin') ? rows : rows.map(({ id, name, description }) => ({ id, name, description }))
    return { data: { roles } }
  }

  async create(body, requestContext) {
    const { name, description } = body
    if (!name || name.trim() === '') throw this.createError('角色名称不能为空', 400)

    
    const result = await this.repository.createRole({ name: name.trim(), description: description || '' })
    if (result.duplicate) throw this.createError('角色名称已存在', 400)
    await this.audit.logRoleOperation(requestContext, 'create', result.role.id, result.role.name)
    return { data: result.role, message: '角色创建成功' }
  }

  async update(params, body, requestContext) {
    const { id } = params
    const { name, description } = body
    
    const result = await this.repository.updateRole({ id, name, description })
    if (result.notFound) throw this.createError('角色不存在', 404)
    if (result.duplicate) throw this.createError('角色名称已存在', 400)
    invalidateAuthProfiles()
    await this.audit.logRoleOperation(requestContext, 'edit', result.role.id, result.role.name)
    return { data: result.role, message: '角色更新成功' }
  }

  async delete(params, requestContext) {
    const { id } = params
    
    const result = await this.repository.deleteRole(id)
    if (result.notFound) throw this.createError('角色不存在', 404)
    if (result.inUse) throw this.createError('此角色仍有用户使用，无法删除', 400)
    await this.audit.logRoleOperation(requestContext, 'delete', id, String(id))
    return { data: { id: result.deletedId }, message: '角色删除成功' }
  }

  async assign(params, body, requestContext) {
    const employeeId = Number(params.id)
    const roleIds = normalizeRoleIds(body.role_ids)
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) throw this.createError('员工ID无效', 400)
    if (!roleIds) throw this.createError('请选择有效的角色', 400)

    
    const result = await this.repository.assignRoles(employeeId, roleIds)
    invalidateAuthProfiles([employeeId])
    if (result.notFound) throw this.createError('员工不存在', 404)
    if (result.invalidRoles) throw this.createError('部分角色不存在', 400)
    await this.audit.logPermissionOperation(requestContext, 'assign', 'user', employeeId, result.employee.username, '设置员工角色', { role_ids: roleIds })
    return { data: formatEmployeeRoles(result.employee), message: '角色分配成功' }
  }

  async remove(params, requestContext) {
    const { employeeId, roleId } = params
    
    const result = await this.repository.removeRole(employeeId, roleId)
    invalidateAuthProfiles([employeeId])
    if (result.notFound) throw this.createError('员工不存在', 404)
    if (result.notAssigned) throw this.createError('该员工未分配此角色', 400)
    await this.audit.logPermissionOperation(requestContext, 'remove', 'user', Number(employeeId), String(employeeId), '移除员工角色', { role_id: Number(roleId) })
    return { data: null, message: '角色移除成功' }
  }
}

module.exports = EmployeeRoleService
