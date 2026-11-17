import type { Router, RouteLocationRaw } from 'vue-router'
import config from '../../../backend/src/config/dashboard-shortcuts.json'
import { canAccessRoutePath, getRoutePermissions, type RoutePermissionChecker } from '@/constants/routePermissions'
import type { DashboardShortcut } from '@/types/dashboard-shortcut'

export const DASHBOARD_SHORTCUT_ACTIONS = config.actions
export const DASHBOARD_SHORTCUT_ICONS = config.icons

export function hasShortcutActionPermission(action: (typeof config.actions)[number], checker: RoutePermissionChecker): boolean {
  return action.allPermissions.every(permission => checker.hasPermission(permission)) &&
    (!action.anyPermissions.length || action.anyPermissions.some(permission => checker.hasPermission(permission)))
}

/** 全部已注册的后台业务页，以及路由明确开放的独立公开业务页；排除登录、错误及依赖记录参数的页面。 */
export function getShortcutPages(router: Router) {
  return router.getRoutes().filter(route => {
    if (route.redirect || !route.components || typeof route.meta.title !== 'string' ||
      !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(route.path)) return false
    const protectedPage = router.resolve(route.path).meta.requiresAuth === true && getRoutePermissions(route.path) !== null
    const publicPage = route.meta.requiresAuth === false && route.meta.dashboardShortcut === true
    return protectedPage || publicPage
  }).map(route => ({ value: route.path, label: String(route.meta.title) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

/** 候选按页面归组，保存和首页均排除已失效的目标。 */
export function getShortcutActionGroups(router: Router) {
  return getShortcutPages(router).map(page => ({
    label: page.label,
    options: config.actions.filter(action => action.path === page.value)
      .map(action => ({ value: action.id, label: action.label, searchLabel: `${page.label} · ${action.label}` }))
  })).filter(group => group.options.length)
}

export function getShortcutDestination(shortcut: DashboardShortcut, router: Router): RouteLocationRaw | null {
  const action = shortcut.kind === 'action' ? config.actions.find(item => item.id === shortcut.target) : null
  const path = shortcut.kind === 'page' ? shortcut.target : action?.path
  if (!path || !getShortcutPages(router).some(page => page.value === path)) return null
  return action ? { path, query: action.query } : { path }
}

export function canUseShortcut(shortcut: DashboardShortcut, router: Router, checker: RoutePermissionChecker): boolean {
  if (!shortcut.enabled || !getShortcutDestination(shortcut, router)) return false
  const action = shortcut.kind === 'action' ? config.actions.find(item => item.id === shortcut.target) : null
  if (!canAccessRoutePath(action?.path || shortcut.target, checker)) return false
  return !action || hasShortcutActionPermission(action, checker)
}
