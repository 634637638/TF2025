import { PermissionUtils } from '@/utils/permissionMapper'
import { describe, expect, it } from 'vitest'
import {
  canAccessRoutePath,
  getRoutePermissions,
  normalizeRoutePath
} from '@/constants/routePermissions'

const deniedWithCache = (userPermissions: string[]) => ({ hasPermission: () => false, userPermissions })

describe('路由权限映射', () => {
  it('会移除查询参数和哈希并使用最长前缀匹配', () => {
    expect(normalizeRoutePath('/price-list/sync-logs?tab=failed#top')).toBe('/price-list/sync-logs')
    expect(getRoutePermissions('/price-list/sync-logs/detail')).toEqual(['price-list-sync-logs:view'])
  })

  it('任一满足的权限即可访问，多余或错误权限不能绕过', () => {
    expect(canAccessRoutePath('/attendance', {
      hasPermission: permission => PermissionUtils.hasPermission(['attendance:view:own'], permission)
    })).toBe(true)

    expect(canAccessRoutePath('/permissions', deniedWithCache(['sales:view']))).toBe(false)
  })

  it('通配权限允许访问受保护页面', () => {
    expect(canAccessRoutePath('/system', {
      hasPermission: permission => PermissionUtils.hasPermission(['*'], permission)
    })).toBe(true)
  })

  it('商品资料路由使用独立模块查看权限，不继承配件库存权限', () => {
    expect(getRoutePermissions('/accessories/catalog')).toEqual(['accessories-catalog:view'])
    expect(canAccessRoutePath('/accessories/catalog', deniedWithCache(['accessories:view']))).toBe(false)
    expect(canAccessRoutePath('/accessories/catalog', {
      hasPermission: permission => PermissionUtils.hasPermission(['accessories_accessorycatalogview:view'], permission)
    })).toBe(true)
  })

  it('型号页接受数据库模块权限，并拒绝其他基础资料权限替代', () => {
    expect(getRoutePermissions('/models')).toEqual(['models:view'])
    expect(canAccessRoutePath('/models', {
      hasPermission: permission => PermissionUtils.hasPermission(['models_modelsview:view'], permission)
    })).toBe(true)
    expect(canAccessRoutePath('/models', {
      hasPermission: permission => PermissionUtils.hasPermission(['brands_brandsview:view'], permission)
    })).toBe(false)
  })
})

it('统一认证拒绝后，原始权限数组和通配缓存不能绕过路由', () => {
  for (const userPermissions of [['*'], ['all:*'], ['sales_salesview:view']]) {
    expect(canAccessRoutePath('/sales', deniedWithCache(userPermissions))).toBe(false)
  }
})
