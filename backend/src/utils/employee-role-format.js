'use strict'

function normalizeRoleIds(value) {
  if (!Array.isArray(value)) return null
  const roleIds = value.map(item => Number(item))
  if (roleIds.some(item => !Number.isSafeInteger(item) || item <= 0)) return null
  return [...new Set(roleIds)]
}

function formatEmployeeRoles(employee) {
  return {
    ...employee,
    role_ids: employee.role_ids
      ? String(employee.role_ids).split(',').map(id => Number(id)).filter(Number.isSafeInteger)
      : []
  }
}

module.exports = { formatEmployeeRoles, normalizeRoleIds }
