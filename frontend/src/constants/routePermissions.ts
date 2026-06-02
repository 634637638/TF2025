import { PermissionMapper, PermissionUtils } from '@/utils/permissionMapper'

export const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  '/dashboard': ['dashboard:view'],
  '/suppliers': ['suppliers:view'],
  '/payments': ['supplier-payments:view'],
  '/system': ['system:view'],
  '/git-management': ['git-management:view'],
  '/backup': ['backup:view'],
  '/data-optimization': ['data-check:view'],
  '/menu': ['menus:view'],
  '/sales': ['sales:view'],
  '/models': ['models:view'],
  '/colors': ['colors:view'],
  '/memories': ['memories:view'],
  '/brands': ['brands:view'],
  '/stores': ['stores:view'],
  '/employees': ['employee:view'],
  '/customers': ['customers:view'],
  '/accessories': ['accessories:view'],
  '/inventory': ['inventory:view'],
  '/preorders': ['preorders:view'],
  '/error-management': ['system:view'],
  '/query': ['query:view'],
  '/permissions': ['permissions:view'],
  '/permissions/module-management': ['module-management:view'],
  '/analytics': ['analytics:view'],
  '/attendance': ['attendance:view', 'attendance:view:own', 'attendance:view:all'],
  '/salary': ['salary:view'],
  '/subsidy': ['subsidy:view'],
  '/rentals': ['rentals:view'],
  '/repairs': ['repairs:view'],
  '/price-list': ['price-list:view'],
  '/price-list/sync-logs': ['price-list:view'],
  '/sales/phone': ['sales:view'],
  '/sales/edit': ['sales-editphoneview:view'],
  '/users': ['users:view'],
  '/stock-in': ['stock-in:view'],
  '/procurement': ['stock-in:view'],
  '/supplier-payments': ['supplier-payments:view'],
  '/reports': ['reports:view'],
  '/roles': ['permissions:view']
}

export const H5_ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  '/H5-admin/page/templates': ['h5-templates:view', 'h5-admin:view'],
  '/H5-admin/page/sold-products': ['h5-sold-products:view', 'h5-admin:view'],
  '/H5-admin/page/config': ['h5-config:view', 'h5-admin:view'],
  '/H5-admin/page/home-sections': ['home-sections:view', 'h5-admin:view'],
  '/H5-admin/page/banners': ['h5-banners:view', 'h5-admin:view'],
  '/H5-admin/page/orders': ['h5-orders:view', 'h5-admin:view', 'sales:view']
}

export function normalizeRoutePath(path: string): string {
  if (!path) {
    return ''
  }

  const [pathWithoutQuery] = path.split('?')
  const [pathWithoutHash] = pathWithoutQuery.split('#')
  return pathWithoutHash || '/'
}

function findBestMatch(path: string, permissionMap: Record<string, string[]>): string[] | null {
  if (permissionMap[path]) {
    return permissionMap[path]
  }

  const matchedRoute = Object.keys(permissionMap)
    .filter(route => path.startsWith(`${route}/`) || path === route)
    .sort((a, b) => b.length - a.length)[0]

  return matchedRoute ? permissionMap[matchedRoute] : null
}

export function getRoutePermissions(path: string): string[] | null {
  const normalizedPath = normalizeRoutePath(path)
  if (!normalizedPath) {
    return null
  }

  const exactOrPrefixMatch = findBestMatch(normalizedPath, ROUTE_PERMISSION_MAP)
  if (exactOrPrefixMatch) {
    return exactOrPrefixMatch
  }

  const h5Match = findBestMatch(normalizedPath, H5_ROUTE_PERMISSION_MAP)
  if (h5Match) {
    return h5Match
  }

  if (normalizedPath.startsWith('/H5-admin')) {
    return ['h5-admin:view']
  }

  return null
}

export interface RoutePermissionChecker {
  hasPermission: (permission: string) => boolean
  userPermissions?: string[]
}

export function canAccessRoutePath(path: string, checker: RoutePermissionChecker): boolean {
  const requiredPermissions = getRoutePermissions(path)
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true
  }

  if (Array.isArray(checker.userPermissions)) {
    const normalizedUserPermissions = checker.userPermissions
      .filter(permission => typeof permission === 'string' && permission)
      .map(permission => PermissionMapper.normalizePermission(permission))
      .filter(Boolean)

    if (normalizedUserPermissions.includes('*')) {
      return true
    }

    return requiredPermissions.some(permission =>
      PermissionUtils.hasPermission(normalizedUserPermissions, permission)
    )
  }

  return requiredPermissions.some(permission => checker.hasPermission(permission))
}
