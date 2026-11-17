'use strict'

const SalaryTemplateService = require('./salary-template.service')
const UserRoleAssignmentService = require('./user-role-assignment.service')
const bcrypt = require('bcryptjs')
const { hasUnifiedPermission, invalidateAuthProfiles } = require('../middleware/unified-auth')
const EmployeeMutationRepository = require('../repositories/employee-mutation.repository')
const { normalizeRoleIds } = require('../utils/employee-role-format')
const { parseInput } = require('../middleware/validation')

const { parseAccountInput } = require('../utils/account-input')

const validateEmployeeId = id => parseInput({ id }, { id: { type: 'id', required: true, label: '员工ID' } }).id

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
  constructor({ repository = new EmployeeMutationRepository(), hashPassword = bcrypt.hash, permissionCheck = hasUnifiedPermission, roleAssignment } = {}) {
    this.permissionCheck = permissionCheck
    this.roleAssignment = roleAssignment || new UserRoleAssignmentService({ permissionCheck })
    this.repository = repository
    this.hashPassword = hashPassword
  }

  async assignRoles(userId, roleIds, actor, requestContext) {
    const result = await this.roleAssignment.assign({ userId, roleIds, requestContext: requestContext || { user: actor, connection: {} } })
    if (result.status !== 'updated') throw createError('员工或角色已变化，请刷新后重试', 409, 'ROLE_ASSIGNMENT_CONFLICT')
  }

  async assertAccountAccess(id, actor) {
    return this.roleAssignment.assertAccountAccess(id, actor)
  }

  async assertRoleAssignment(data, actor) {
    if (data.role_ids !== undefined) await this.roleAssignment.assertCanAssign(actor)
  }

  async createEmployee(data = {}, actor, requestContext) {
    if (!data?.username || !data?.name || !data?.password) {
      throw createError('缺少必需字段：用户名、姓名、密码', 400, 'VALIDATION')
    }
    data = parseAccountInput(data, { required: true })
    const { username, name, password, phone, email, salary_template_id, hire_date, role_ids } = data

    const roleIds = role_ids === undefined ? [] : normalizeRoleIds(role_ids)
    if (!roleIds || (role_ids !== undefined && roleIds.length === 0)) {
      throw createError('请至少选择一个有效角色', 400, 'VALIDATION')
    }
    await SalaryTemplateService.assertEmployeeTemplateWrite(data, actor, this.permissionCheck)
    await this.assertRoleAssignment(data, actor)
    if (roleIds.length) await assertValidRoles(this.repository, roleIds)
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
    if (roleIds.length) await this.assignRoles(employee.id, roleIds, actor, requestContext)
    return employee
  }

  async updateEmployee(id, data = {}, actor, requestContext) {
    validateEmployeeId(id)
    data = parseAccountInput(data)
    const { role_ids: roleIdsInput } = data
    const roleIds = roleIdsInput === undefined ? undefined : normalizeRoleIds(roleIdsInput)
    if (roleIdsInput !== undefined && !roleIds) {
      throw createError('请选择有效的角色', 400, 'VALIDATION')
    }
    await SalaryTemplateService.assertEmployeeTemplateWrite(data, actor, this.permissionCheck)
    await this.assertRoleAssignment(data, actor)
    if (roleIds?.length) await assertValidRoles(this.repository, roleIds)

    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    await this.assertAccountAccess(id, actor)
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
    invalidateAuthProfiles([id])
    if (roleIdsInput !== undefined) {
      await this.assignRoles(id, roleIds, actor, requestContext)
      invalidateAuthProfiles([id])
    }
    return {
      employee: await this.repository.findUpdatedEmployee(id),
      passwordUpdated
    }
  }

  async deleteEmployee(id, currentUserId, actor) {
    validateEmployeeId(id)
    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    if (parseInt(id) === currentUserId) {
      throw createError('不能删除自己的账户', 400, 'VALIDATION')
    }
    await this.assertAccountAccess(id, actor)
    await this.repository.deleteEmployee(id)
    invalidateAuthProfiles([id])
    return { id: parseInt(id) }
  }

  async updateEmployeeStatus(id, status, currentUserId, actor) {
    validateEmployeeId(id)
    if (status === undefined) {
      throw createError('缺少status参数', 400, 'VALIDATION')
    }
    status = parseInput({ status }, { status: { type: 'number', required: true, integer: true, min: 0, max: 1, label: '状态' } }).status
    if (!await this.repository.findId(id)) {
      throw createError('员工不存在', 404, 'NOT_FOUND')
    }
    if (parseInt(id) === currentUserId && status === 0) {
      throw createError('不能禁用自己的账户', 400, 'VALIDATION')
    }
    await this.assertAccountAccess(id, actor)
    await this.repository.updateStatus(id, status)
    invalidateAuthProfiles([id])
    return {
      id: parseInt(id),
      status,
      statusText: status === 1 ? '启用' : '禁用'
    }
  }
}

module.exports = EmployeeMutationService
