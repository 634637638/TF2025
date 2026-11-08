'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const EmployeeRoleRepository = require('../repositories/employee-role.repository')
const { formatEmployeeRoles, normalizeRoleIds } = require('../utils/employee-role-format')

class EmployeeRoleController {
  constructor({ repository = new EmployeeRoleRepository() } = {}) {
    this.repository = repository
  }

  async systemRoles(_req, res) {
    try {
      const roles = await this.repository.getActiveSystemRoles()
      return ApiResponse.success(res, '获取系统角色列表成功', { roles })
    } catch (error) {
      log.error('获取系统角色列表失败:', error)
      return ApiResponse.serverError(res, '获取系统角色列表失败', error)
    }
  }

  async list(_req, res) {
    try {
      const roles = await this.repository.getRolesWithUserCount()
      return ApiResponse.success(res, { roles })
    } catch (error) {
      log.error('获取角色列表失败:', error)
      return ApiResponse.serverError(res, '获取角色列表失败', error)
    }
  }

  async create(req, res) {
    const { name, description } = req.body
    if (!name || name.trim() === '') return ApiResponse.badRequest(res, '角色名称不能为空')

    try {
      const result = await this.repository.createRole({ name: name.trim(), description: description || '' })
      if (result.duplicate) return ApiResponse.badRequest(res, '角色名称已存在')
      return ApiResponse.created(res, '角色创建成功', result.role)
    } catch (error) {
      log.error('创建角色失败:', error)
      return ApiResponse.serverError(res, '创建角色失败', error)
    }
  }

  async update(req, res) {
    const { id } = req.params
    const { name, description } = req.body
    try {
      const result = await this.repository.updateRole({ id, name, description })
      if (result.notFound) return ApiResponse.notFound(res, '角色不存在')
      if (result.duplicate) return ApiResponse.badRequest(res, '角色名称已存在')
      return ApiResponse.success(res, result.role, '角色更新成功')
    } catch (error) {
      log.error('更新角色失败:', error)
      return ApiResponse.serverError(res, '更新角色失败', error)
    }
  }

  async delete(req, res) {
    const { id } = req.params
    try {
      const result = await this.repository.deleteRole(id)
      if (result.notFound) return ApiResponse.notFound(res, '角色不存在')
      if (result.inUse) return ApiResponse.badRequest(res, '此角色仍有用户使用，无法删除')
      return ApiResponse.success(res, { id: result.deletedId }, '角色删除成功')
    } catch (error) {
      log.error('删除角色失败:', error)
      return ApiResponse.serverError(res, '删除角色失败', error)
    }
  }

  async assign(req, res) {
    const employeeId = Number(req.params.id)
    const roleIds = normalizeRoleIds(req.body.role_ids)
    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return ApiResponse.badRequest(res, '员工ID无效')
    if (!roleIds) return ApiResponse.badRequest(res, '请选择有效的角色')

    try {
      const result = await this.repository.assignRoles(employeeId, roleIds)
      if (result.notFound) return ApiResponse.notFound(res, '员工不存在')
      if (result.invalidRoles) return ApiResponse.badRequest(res, '部分角色不存在')
      return ApiResponse.success(res, formatEmployeeRoles(result.employee), '角色分配成功')
    } catch (error) {
      log.error('分配角色失败:', error)
      return ApiResponse.serverError(res, '分配角色失败', error)
    }
  }

  async remove(req, res) {
    const { employeeId, roleId } = req.params
    try {
      const result = await this.repository.removeRole(employeeId, roleId)
      if (result.notFound) return ApiResponse.notFound(res, '员工不存在')
      if (result.notAssigned) return ApiResponse.badRequest(res, '该员工未分配此角色')
      return ApiResponse.success(res, null, '角色移除成功')
    } catch (error) {
      log.error('移除角色失败:', error)
      return ApiResponse.serverError(res, '移除角色失败', error)
    }
  }
}

module.exports = EmployeeRoleController
