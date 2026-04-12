const appendPermission = (target: Set<string>, moduleKey: string, permission: unknown) => {
  const normalizedPermission = String(permission || '').trim()
  if (!normalizedPermission) {
    return
  }

  if (normalizedPermission.includes(':') || !moduleKey) {
    target.add(normalizedPermission)
    return
  }

  target.add(`${moduleKey}:${normalizedPermission}`)
}

export const normalizePermissionList = (rawPermissions: unknown): string[] => {
  if (!rawPermissions) {
    return []
  }

  if (Array.isArray(rawPermissions)) {
    return rawPermissions
      .map(permission => String(permission || '').trim())
      .filter(Boolean)
  }

  if (typeof rawPermissions !== 'object') {
    return []
  }

  const permissionObject = rawPermissions as Record<string, unknown>

  if (Array.isArray(permissionObject.userPermissions)) {
    return normalizePermissionList(permissionObject.userPermissions)
  }

  const normalizedPermissions = new Set<string>()

  if (permissionObject.summary && typeof permissionObject.summary === 'object') {
    Object.entries(permissionObject.summary as Record<string, unknown>).forEach(([moduleKey, modulePermissions]) => {
      if (!Array.isArray(modulePermissions)) {
        return
      }

      modulePermissions.forEach(permission => appendPermission(normalizedPermissions, moduleKey, permission))
    })
  }

  Object.entries(permissionObject).forEach(([moduleKey, moduleValue]) => {
    if (moduleKey === 'summary' || moduleKey === 'userPermissions' || moduleKey === 'permissionVisibility') {
      return
    }

    if (Array.isArray(moduleValue)) {
      moduleValue.forEach(permission => appendPermission(normalizedPermissions, moduleKey, permission))
      return
    }

    if (moduleValue && typeof moduleValue === 'object') {
      const nestedPermissions = (moduleValue as Record<string, unknown>).permissions
      if (Array.isArray(nestedPermissions)) {
        nestedPermissions.forEach(permission => appendPermission(normalizedPermissions, moduleKey, permission))
        return
      }
    }

    if (moduleValue === true && moduleKey.includes(':')) {
      normalizedPermissions.add(moduleKey)
    }
  })

  return Array.from(normalizedPermissions)
}
