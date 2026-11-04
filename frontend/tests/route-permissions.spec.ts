import { describe, expect, it } from 'vitest'
import {
  canAccessRoutePath,
  getRoutePermissions,
  normalizeRoutePath
} from '@/constants/routePermissions'

describe('路由权限映射', () => {
  it('会移除查询参数和哈希并使用最长前缀匹配', () => {
    expect(normalizeRoutePath('/price-list/sync-logs?tab=failed#top')).toBe('/price-list/sync-logs')
    expect(getRoutePermissions('/price-list/sync-logs/detail')).toEqual(['price-list-sync-logs:view'])
  })

  it('任一满足的权限即可访问，多余或错误权限不能绕过', () => {
    expect(canAccessRoutePath('/attendance', {
      hasPermission: () => false,
      userPermissions: ['attendance:view:own']
    })).toBe(true)

    expect(canAccessRoutePath('/permissions', {
      hasPermission: () => false,
      userPermissions: ['sales:view']
    })).toBe(false)
  })

  it('通配权限允许访问受保护页面', () => {
    expect(canAccessRoutePath('/system', {
      hasPermission: () => false,
      userPermissions: ['*']
    })).toBe(true)
  })
})
