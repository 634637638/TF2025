export const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  '/dashboard': ['dashboard:view'],
  '/suppliers': ['suppliers:view'],
  '/payments': ['supplier-payments:view'],
  '/system': ['system:view'],
  '/git-management': ['git-management:view', 'system:view', 'permissions:view'],
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
  '/permissions/module-management': ['permissions:admin'],
  '/analytics': ['analytics:view'],
  '/attendance': ['attendance:view', 'attendance:view:own'],
  '/salary': ['salary-templates:view', 'salary-records:view', 'salary-records:view:own', 'salary:view'],
  '/subsidy': ['subsidy:view'],
  '/rentals': ['rentals:view'],
  '/repairs': ['repairs:view'],
  '/price-list': ['price-list:view'],
  '/price-list/sync-logs': ['price-list-sync-logs:view', 'price-list:view'],
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
  '/H5-admin/page/config': ['h5-config:view', 'h5-admin:view'],
  '/H5-admin/page/home-sections': ['home-sections:view', 'h5-admin:view'],
  '/H5-admin/page/banners': ['h5-banners:view', 'h5-admin:view'],
  '/H5-admin/page/orders': ['h5-orders:view', 'h5-admin:view', 'sales:view']
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
  if (!path) {
    return null
  }

  const exactOrPrefixMatch = findBestMatch(path, ROUTE_PERMISSION_MAP)
  if (exactOrPrefixMatch) {
    return exactOrPrefixMatch
  }

  const h5Match = findBestMatch(path, H5_ROUTE_PERMISSION_MAP)
  if (h5Match) {
    return h5Match
  }

  if (path.startsWith('/H5-admin')) {
    return ['h5-admin:view']
  }

  return null
}
