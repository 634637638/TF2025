const capabilityRegistry = require('./capability-registry')

const DEFAULT_PERMISSION_TYPES = Object.freeze([...capabilityRegistry.defaultActions])
const ACTION_ORDER = Object.freeze([...capabilityRegistry.actionOrder])
const MODULE_PERMISSION_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(capabilityRegistry.modules).map(([moduleKey, actions]) => [
      moduleKey,
      Object.freeze([...actions])
    ])
  )
)

const MODULE_PERMISSION_METADATA = Object.freeze(capabilityRegistry.moduleMetadata)
const PERMISSION_TYPE_ALIASES = Object.freeze({
  ...Object.fromEntries(Object.entries(capabilityRegistry.actionLabels).map(([action, label]) => [label, action])),
  ...capabilityRegistry.actionAliases
})

function normalizePermissionType(permissionType) {
  if (!permissionType) {
    return permissionType
  }

  const normalizedType = PERMISSION_TYPE_ALIASES[permissionType] || permissionType
  if (normalizedType.endsWith('_permission')) {
    return normalizedType.replace(/_permission$/, '')
  }

  return normalizedType
}

function sortPermissionTypes(permissionTypes = []) {
  return [...new Set(permissionTypes.map(normalizePermissionType).filter(Boolean))].sort((a, b) => {
    const indexA = ACTION_ORDER.indexOf(a)
    const indexB = ACTION_ORDER.indexOf(b)

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b, 'zh-CN')
    }
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
}

function getModulePermissionTypes(moduleKey) {
  const configuredTypes = MODULE_PERMISSION_TYPES[moduleKey]
  if (configuredTypes) {
    return sortPermissionTypes(configuredTypes)
  }

  // 未登记模块采用最小权限，禁止自动生成虚假的增删改按钮。
  // 新页面必须先在共享能力清单中明确声明所需权限。
  return sortPermissionTypes(DEFAULT_PERMISSION_TYPES)
}

function getModulePermissionMetadata(moduleKey) {
  return MODULE_PERMISSION_METADATA[moduleKey] || null
}

module.exports = {
  ACTION_ORDER,
  DEFAULT_PERMISSION_TYPES,
  MODULE_PERMISSION_METADATA,
  MODULE_PERMISSION_TYPES,
  getModulePermissionMetadata,
  getModulePermissionTypes,
  normalizePermissionType,
  sortPermissionTypes
}
