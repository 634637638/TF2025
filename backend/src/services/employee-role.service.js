'use strict'

const EmployeeRoleRepository = require('../repositories/employee-role.repository')
const { formatEmployeeRoles, normalizeRoleIds } = require('../utils/employee-role-format')
const BaseService = require('../core/base/base.service')

class EmployeeRoleService extends BaseService {
  constructor({ repository = new EmployeeRoleRepository() } = {}) {
    super()
    this.repository = repository
  }

  async systemRoles() {
    
    const roles = await this.repository.getActiveSystemRoles()
    return { data: { roles }, message: '获取系统角色列表成功' }
  }

  async list() {
    
    const roles = await this.repository.getRolesWithUserCount()
    return { data: { roles } }
  }

  async create(body) {
    const { name, description } = body
    if (!name || name.trim() === '') throw this.createError('角色名称不能为空', 400)

    
    const result = await this.repository.createRole({ name: name.trim(), description: description || '' })
    if (result.duplicate) throw this.createError('角色名称已存在', 400)
    return { data: result.role, message: '角色创建成功' }
  }

  async update(params, body) {
    const { id } = params
    const { name, description } = body
    
    const result = await this.repository.updateRole({ id, name, description })
    if (result.notFound) throw this.createError('角色不存在', 404)
    if (result.duplicate) throw this.createError('角色名称已存在', 400)
    return { data: result.role, message: '角色更新成功' }
  }

  async delete(params) {
    const { id } = params
    
    const result = await this.repository.deleteRole(id)
    if (result.notFound) throw this.createError('角色不存在', 404)
    if (result.inUse) throw this.createError('此角色仍有用户使用，无法删除', 400)
    return { data: { id: result.deletedId }, message: '角色删除成功' }
  }

  async assign(params, body) {
    const employeeId = Number(params.id)
    const roleIds = normalizeRoleIds(body.role_ids)
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) throw this.createError('员工ID无效', 400)
    if (!roleIds) throw this.createError('请选择有效的角色', 400)

    
    const result = await this.repository.assignRoles(employeeId, roleIds)
    if (result.notFound) throw this.createError('员工不存在', 404)
    if (result.invalidRoles) throw this.createError('部分角色不存在', 400)
    return { data: formatEmployeeRoles(result.employee), message: '角色分配成功' }
  }

  async remove(params) {
    const { employeeId, roleId } = params
    
    const result = await this.repository.removeRole(employeeId, roleId)
    if (result.notFound) throw this.createError('员工不存在', 404)
    if (result.notAssigned) throw this.createError('该员工未分配此角色', 400)
    return { data: null, message: '角色移除成功' }
  }
}

module.exports = EmployeeRoleService
