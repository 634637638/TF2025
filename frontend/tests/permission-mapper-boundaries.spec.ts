import { describe, expect, it } from 'vitest'
import { PermissionMapper, PermissionUtils } from '@/utils/permissionMapper'
import capabilities from '../../backend/src/config/module-permission-capabilities.json'
import { MODULE_PERMISSIONS } from '@/utils/permissionMapper'
import { getPermissionMeta } from '@/views/permissions/page/permissionMeta'

describe('菜单、母子模块和范围权限独立', () => {
  it('所有已登记权限开关及映射名称均来自同一份权威配置', () => {
    for (const actions of Object.values(capabilities.modules)) {
      for (const action of actions) {
        const expected = capabilities.actionLabels[action as keyof typeof capabilities.actionLabels]
        expect(expected).toMatch(/[\u4e00-\u9fff]/)
        expect(getPermissionMeta(action).name).toBe(expected)
      }
    }
    for (const module of Object.values(MODULE_PERMISSIONS)) {
      for (const [action, label] of Object.entries(module.permissions)) expect(label).toBe(getPermissionMeta(action).name)
    }
    expect(MODULE_PERMISSIONS['salary-records'].name).toBe('工资计算')
    expect(getPermissionMeta('menu_view').name).toBe(capabilities.actionLabels.menu_view)
  })
  it.each(['query', 'customers', 'sales', 'salary', 'attendance', 'permissions', 'data-import'])('%s 菜单显示不能充当业务查看', module => {
    expect(PermissionUtils.hasPermission([`${module}:menu_view`], `${module}:view`)).toBe(false)
    expect(PermissionUtils.hasPermission([`${module}:view`], `${module}:menu_view`)).toBe(false)
    expect(PermissionUtils.hasPermission([`${module}:menu_view`], `${module}:menu_view`)).toBe(true)
  })

  it('完整模块键的菜单权限也不能变成查看，管理动作不能变成审批', () => {
    expect(PermissionUtils.hasPermission(['query_queryview:menu_view'], 'query:view')).toBe(false)
    expect(PermissionMapper.isPermissionCompatible('salary:edit', 'salary-records:edit')).toBe(false)
    expect(PermissionUtils.hasPermission(['salary-records:edit'], 'salary-records:approve')).toBe(false)
    expect(PermissionUtils.hasPermission(['attendance:view', 'my-attendance:create'], 'attendance:create')).toBe(false)
  })

  it('本人查看不能成为团队查看，显式团队查看仍能查看本人', () => {
    expect(PermissionUtils.hasPermission(['attendance:view:own'], 'attendance:view:all')).toBe(false)
    expect(PermissionUtils.hasPermission(['attendance:view:all'], 'attendance:view:own')).toBe(true)
  })
})
