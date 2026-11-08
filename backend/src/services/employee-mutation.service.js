'use strict'

const bcrypt = require('bcryptjs')
const EmployeeMutationRepository = require('../repositories/employee-mutation.repository')
const { normalizeRoleIds } = require('../utils/employee-role-format')

const allowedFields = ['username', 'name', 'phone', 'email', 'salary_template_id', 'status', 'hire_date']

function createError(message, statusCode, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function assertValidRoles(repository, roleIds) {
  return repository.getValidRoles(roleIds).then(validRoles => {
    if (validRoles.length !== roleIds.length) {
      throw createError('部分角色不存在', 400, 'VALIDATION')
    }
  })
}

class EmployeeMutationService {
  constructor({ repository = new EmployeeMutationRepository(), hashPassword = bcrypt.hash } = {}) {
    this.repository = repository
    this.hashPassword = hashPassword
  }

  async createEmployee(data = {}) {
    const { username, name, password, phone, email, salary_template_id, hire_date, role_ids } = data
    if (!username || !name || !password) {
      throw createError('缺少必需字段：用户名、姓名、密码', 400, 'VALIDATION')
    }

    const roleIds = normalizeRoleIds(role_ids)
    if (!roleIds || roleIds.length === 0) {
      throw createError('请至少选择一个有效角色', 400, 'VALIDATION')
    }
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      throw createError('手机号格式不正确', 400, 'VALIDATION')
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError('邮箱格式不正确', 400, 'VALIDATION')
    }

    await assertValidRoles(this.repository, roleIds)
    if (await this.repository.findByUsername(username)) {
      throw createError('用户名已存在', 400, 'VALIDATION')
    }
    if (phone && await this.repository.findByPhone(phone)) {
      throw createError('手机号已存在', 400, 'VALIDATION')
    }

    const hashedPassword = await this.hashPassword(password, 12)
    await this.repository.insertEmployee({
      username,
      name,
      password: hashedPassword,
      phone: phone || null,
      email: email || null,
      salaryTemplateId: salary_template_id || null,
      hireDate: hire_date || null
    })
    const employee = await this.repository.findCreatedEmployee(username)
    for (const roleId of roleIds) await this.repository.assignRole(employee.id, roleId)
    return employee
  }

  async updateEmployee(id, data = {}) {
    const { role_ids: roleIdsInput } = data
    const roleIds = roleIdsInput === undefined ? undefined : normalizeRoleIds(roleIdsInput)
    if (roleIdsInput !== undefined && !roleIds) {
      throw createError('请选择有效的角色', 400, 'VALIDATION')
    }
    if (roleIds?.length) await assertValidRoles(this.repository, roleIds)

    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    if (data.phone && await this.repository.findByPhone(data.phone, id)) {
      throw createError('手机号已存在', 400, 'VALIDATION')
    }
    if (data.username && await this.repository.findByUsername(data.username, id)) {
      throw createError('用户名已存在', 400, 'VALIDATION')
    }

    const fields = []
    const values = []
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(field)
        values.push(data[field])
      }
    }

    const passwordUpdated = data.password !== undefined
    if (passwordUpdated) {
      fields.push('password')
      values.push(await this.hashPassword(data.password, 12))
    }
    if (fields.length === 0) {
      throw createError('没有提供有效的更新字段', 400, 'VALIDATION')
    }

    await this.repository.updateEmployee(fields, values, id)
    if (roleIdsInput !== undefined) await this.repository.replaceRoles(id, roleIds)
    return {
      employee: await this.repository.findUpdatedEmployee(id),
      passwordUpdated
    }
  }

  async deleteEmployee(id, currentUserId) {
    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    if (parseInt(id) === currentUserId) {
      throw createError('不能删除自己的账户', 400, 'VALIDATION')
    }
    await this.repository.deleteEmployee(id)
    return { id: parseInt(id) }
  }

  async updateEmployeeStatus(id, status, currentUserId) {
    if (status === undefined) {
      throw createError('缺少status参数', 400, 'VALIDATION')
    }
    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    if (parseInt(id) === currentUserId && status === 0) {
      throw createError('不能禁用自己的账户', 400, 'VALIDATION')
    }
    await this.repository.updateStatus(id, status)
    return {
      id: parseInt(id),
      status,
      statusText: status === 1 ? '启用' : '禁用'
    }
  }
}

module.exports = EmployeeMutationService
