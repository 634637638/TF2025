export const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  '/dashboard': ['dashboard:view'],
  '/suppliers': ['suppliers:view'],
  '/payments': ['supplier-payments:view'],
  '/system': ['system:view'],
  '/standards': ['standards:view'],
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
  '/accessories/catalog': ['accessories-catalog:view'],
  '/inventory': ['inventory:view'],
  '/preorders': ['preorders:view'],
  '/reminders': ['reminders:view'],
  '/shared': ['shared:view'],
  '/marketing': ['marketing:view'],
  '/error-management': ['system:view'],
  '/query': ['query:view'],
  '/permissions': ['permissions:view'],
  '/analytics': ['analytics:view'],
  '/attendance': ['attendance:view', 'attendance:view:own', 'attendance:view:all'],
  '/salary': ['salary:view'],
  '/subsidy': ['subsidy:view'],
  '/rentals': ['rentals:view'],
  '/repairs': ['repairs:view'],
  '/price-list': ['price-list:view'],
  '/price-list/sync-logs': ['price-list-sync-logs:view'],
  '/guide': ['guide:view']
}

export const H5_ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  '/H5-admin/page/templates': ['h5-templates:view'],
  '/H5-admin/page/sold-products': ['h5-sold-products:view'],
  '/H5-admin/page/config': ['h5-config:view'],
  '/H5-admin/page/home-sections': ['home-sections:view'],
  '/H5-admin/page/banners': ['h5-banners:view'],
  '/H5-admin/page/orders': ['h5-orders:view']
}

export function normalizeRoutePath(path: string): string {
  if (!path) {
    return ''
  }

  const [pathWithoutQuery] = path.split('?')
  const [pathWithoutHash] = pathWithoutQuery.split('#')
  return pathWithoutHash || '/'
}

const H5_SHOP_PATH = '/m'

export function isH5ShopPath(path: string): boolean {
  const normalizedPath = normalizeRoutePath(path).toLowerCase()
  return normalizedPath === H5_SHOP_PATH || normalizedPath.startsWith(`${H5_SHOP_PATH}/`)
}

const PUBLIC_STANDALONE_PATHS = new Set([
  '/login', '/404', '/forgot-password', '/register', '/price-query', '/sales-price-display', '/marketing_copy', '/dh'
])

// 浏览器尚未解析路由时供认证恢复和请求错误处理使用。
export function isPublicSitePath(path: string): boolean {
  const normalizedPath = normalizeRoutePath(path).replace(/\/+$/, '').toLowerCase()
  return PUBLIC_STANDALONE_PATHS.has(normalizedPath) || isH5ShopPath(normalizedPath)
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
}

export function canAccessRoutePath(path: string, checker: RoutePermissionChecker): boolean {
  const requiredPermissions = getRoutePermissions(path)
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true
  }

  return requiredPermissions.some(permission => checker.hasPermission(permission))
}
