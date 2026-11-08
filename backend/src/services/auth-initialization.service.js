'use strict'

const { withConnection } = require('../core/db/connection')

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const config = require('../config')
const { getDatabase } = require('../config/database')
const { hasColumn } = require('./schema-inspector.service')
const { isValidFieldName, validatePassword } = require('../utils/security-enhanced')

const rawSql = value => ({ __raw: value })

function buildInsertStatement(tableName, valueMap) {
  const columns = []
  const placeholders = []
  const values = []

  Object.entries(valueMap).forEach(([column, value]) => {
    if (value === undefined) return
    if (!isValidFieldName(column)) throw new Error(`检测到非法字段名: ${column}`)

    columns.push(`\`${column}\``)
    if (value && typeof value === 'object' && value.__raw) {
      placeholders.push(value.__raw)
      return
    }
    placeholders.push('?')
    values.push(value)
  })

  return {
    sql: `INSERT INTO \`${tableName}\` (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values
  }
}

class AuthInitializationService {
  constructor({
    database = getDatabase,
    inspectColumn = hasColumn,
    hashPassword = bcrypt.hash,
    passwordValidator = validatePassword,
    getConfiguredPassword = () => config.security.initAdminPassword?.trim(),
    randomBytes = crypto.randomBytes
  } = {}) {
    this.database = database
    this.inspectColumn = inspectColumn
    this.hashPassword = hashPassword
    this.passwordValidator = passwordValidator
    this.getConfiguredPassword = getConfiguredPassword
    this.randomBytes = randomBytes
  }

  resolvePassword() {
    const configuredPassword = this.getConfiguredPassword()
    const password = configuredPassword || this.randomBytes(12).toString('base64url')
    const validation = this.passwordValidator(password)
    if (!validation.valid) {
      throw new Error(`INIT_ADMIN_PASSWORD 不符合安全要求: ${validation.errors.join('；')}`)
    }
    return { password, source: configuredPassword ? 'env' : 'generated' }
  }

  async ensureAdminRole(connection) {
    const supportsRoleCode = await this.inspectColumn('roles', 'code', connection)
    const query = supportsRoleCode
      ? 'SELECT id FROM roles WHERE code = ? OR name IN (?, ?) LIMIT 1'
      : 'SELECT id FROM roles WHERE name IN (?, ?) LIMIT 1'
    const params = supportsRoleCode
      ? ['admin', '管理员', '系统管理员']
      : ['管理员', '系统管理员']
    const [existingRoles] = await connection.execute(query, params)
    if (existingRoles.length > 0) return existingRoles[0].id

    const roleData = {
      name: '管理员',
      description: '开发环境初始化管理员角色',
      code: supportsRoleCode ? 'admin' : undefined,
      role_type: await this.inspectColumn('roles', 'role_type', connection) ? 'system' : undefined,
      group_name: await this.inspectColumn('roles', 'group_name', connection) ? 'system' : undefined,
      hierarchy_level: await this.inspectColumn('roles', 'hierarchy_level', connection) ? 100 : undefined,
      status: await this.inspectColumn('roles', 'status', connection) ? 'active' : undefined,
      is_active: await this.inspectColumn('roles', 'is_active', connection) ? 1 : undefined,
      created_at: await this.inspectColumn('roles', 'created_at', connection) ? rawSql('NOW()') : undefined,
      updated_at: await this.inspectColumn('roles', 'updated_at', connection) ? rawSql('NOW()') : undefined
    }
    const { sql, values } = buildInsertStatement('roles', roleData)
    const [result] = await connection.execute(sql, values)
    return result.insertId
  }

  async ensureUserRoleBinding(connection, userId, roleId) {
    const [existingBindings] = await connection.execute(
      'SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ? LIMIT 1',
      [userId, roleId]
    )
    if (existingBindings.length > 0) return

    const bindingData = {
      user_id: userId,
      role_id: roleId,
      status: await this.inspectColumn('user_roles', 'status', connection) ? 'active' : undefined,
      assigned_by: await this.inspectColumn('user_roles', 'assigned_by', connection) ? userId : undefined,
      assigned_at: await this.inspectColumn('user_roles', 'assigned_at', connection) ? rawSql('NOW()') : undefined,
      created_at: await this.inspectColumn('user_roles', 'created_at', connection) ? rawSql('NOW()') : undefined,
      updated_at: await this.inspectColumn('user_roles', 'updated_at', connection) ? rawSql('NOW()') : undefined
    }
    const { sql, values } = buildInsertStatement('user_roles', bindingData)
    await connection.execute(sql, values)
  }

  async initializeAdmin() {
    return withConnection(this.database(), async connection => {
      try {
        await connection.beginTransaction()
        const [existingAdmins] = await connection.execute(
          'SELECT id FROM users WHERE username = ? LIMIT 1',
          ['admin']
        )
        if (existingAdmins.length > 0) {
          await connection.rollback()
          return { exists: true }
        }

        const adminRoleId = await this.ensureAdminRole(connection)
        const { password, source: passwordSource } = this.resolvePassword()
        const hashedPassword = await this.hashPassword(password, 12)
        const supportsUserRole = await this.inspectColumn('users', 'role', connection)
        const supportsUserRoleId = await this.inspectColumn('users', 'role_id', connection)
        const userData = {
          username: 'admin',
          password: hashedPassword,
          name: '管理员',
          role: supportsUserRole ? 'admin' : undefined,
          role_id: supportsUserRoleId ? adminRoleId : undefined,
          status: 1,
          created_at: await this.inspectColumn('users', 'created_at', connection) ? rawSql('NOW()') : undefined,
          updated_at: await this.inspectColumn('users', 'updated_at', connection) ? rawSql('NOW()') : undefined
        }
        const { sql, values } = buildInsertStatement('users', userData)
        const [result] = await connection.execute(sql, values)
        await this.ensureUserRoleBinding(connection, result.insertId, adminRoleId)
        await connection.commit()

        return {
          id: result.insertId,
          password,
          passwordSource,
          roleId: adminRoleId
        }
      } catch (error) {
        await connection.rollback()
        throw error
      }

    })
  }
}

module.exports = AuthInitializationService
