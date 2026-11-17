'use strict'

const { getModulePermissionMetadata, MODULE_PERMISSION_TYPES } = require('../config/module-permission-actions')
const { normalizeModuleKey } = require('./moduleKeyNormalizer')

const ENSURED_PERMISSION_MODULE_KEYS = Object.freeze(Object.keys(MODULE_PERMISSION_TYPES))

function normalizeManagedModuleKey(moduleKey) {
  return normalizeModuleKey(moduleKey)
}

function buildManagedModuleRow(moduleKey) {
  const normalizedModuleKey = normalizeManagedModuleKey(moduleKey)
  const metadata = getModulePermissionMetadata(normalizedModuleKey) || {}
  return {
    module_key: normalizedModuleKey,
    key: normalizedModuleKey,
    module_name: metadata.name || normalizedModuleKey,
    name: metadata.name || normalizedModuleKey,
    module_description: metadata.description || '',
    description: metadata.description || '',
    module_category: metadata.category || 'business',
    category: metadata.category || 'business',
    icon: metadata.icon || 'fas fa-cube',
    permission_type: 'view',
    field_count: 0
  }
}

function mergeManagedModules(rows = [], keyField = 'module_key') {
  const moduleMap = new Map()

  rows.forEach(row => {
    const rawModuleKey = row[keyField] || row.module_key || row.key
    const moduleKey = normalizeManagedModuleKey(rawModuleKey)
    if (!moduleKey) return

    const metadata = getModulePermissionMetadata(moduleKey) || {}
    moduleMap.set(moduleKey, {
      ...row,
      module_key: row.module_key || moduleKey,
      key: row.key || moduleKey,
      module_name: row.module_name || row.name || metadata.name || moduleKey,
      name: row.name || row.module_name || metadata.name || moduleKey,
      module_description: row.module_description || row.description || metadata.description || '',
      description: row.description || row.module_description || metadata.description || '',
      module_category: row.module_category || row.category || metadata.category || 'business',
      category: row.category || row.module_category || metadata.category || 'business',
      icon: row.icon || metadata.icon || 'fas fa-cube'
    })
  })

  ENSURED_PERMISSION_MODULE_KEYS.forEach(moduleKey => {
    if (!moduleMap.has(moduleKey)) moduleMap.set(moduleKey, buildManagedModuleRow(moduleKey))
  })

  return Array.from(moduleMap.values()).sort((a, b) => {
    const categoryA = a.module_category || a.category || ''
    const categoryB = b.module_category || b.category || ''
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB, 'zh-CN')
    const nameA = a.module_name || a.name || a.module_key || a.key || ''
    const nameB = b.module_name || b.name || b.module_key || b.key || ''
    return nameA.localeCompare(nameB, 'zh-CN')
  })
}

module.exports = { ENSURED_PERMISSION_MODULE_KEYS, mergeManagedModules, normalizeManagedModuleKey }
