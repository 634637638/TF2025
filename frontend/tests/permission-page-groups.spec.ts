import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { ElButton } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import RolePermissionsPage from '@/views/permissions/page/RolePermissionsPage.vue'
import { permissionsPageContextKey } from '@/views/permissions/page/context'
import { getPermissionMeta } from '@/views/permissions/page/permissionMeta'
import { MODULE_CONFIGS } from '@/config/modules'
import type { Module } from '@/views/permissions/types'

const moduleRecord = (key: string, name: string, actions: string[]): Module => ({
  key, module_key: key, name, icon: 'fas fa-cube',
  permissions: actions.filter(type => type !== 'menu_view').map(type => ({ type, granted: false }))
})

function renderGroups(includeParent = true) {
  const parent = MODULE_CONFIGS.ACCESSORIES
  const child = MODULE_CONFIGS.ACCESSORY_CATALOG
  const context = reactive({
    selectedRoleForPermission: { id: 2, name: '业务角色' },
    loadingPermissionDialog: false,
    savingDialogPermissions: false,
    dialogBulkPermissionType: '',
    dialogActionPermissionTypes: [],
    permissionDialogMatrix: [
      ...(includeParent ? [moduleRecord(parent.key, parent.name, parent.permissions)] : []),
      moduleRecord(child.key, child.name, child.permissions),
      moduleRecord('query_queryview', '综合查询', ['view', 'film'])
    ],
    isDialogPermissionSelected: (key: string, type: string) => key === parent.key && type === 'view',
    isDialogMenuPermissionSelected: (_key: string) => false,
    getPermissionIcon: (type: string) => getPermissionMeta(type).icon,
    getPermissionNameEnhanced: (type: string) => getPermissionMeta(type).name,
    handleDialogPermissionChange: vi.fn(),
    handleDialogMenuPermissionChange: vi.fn()
  })
  const wrapper = mount(RolePermissionsPage, { global: {
    components: { ElButton },
    stubs: { IconRenderer: true, ElSelect: true, ElOption: true },
    provide: { [permissionsPageContextKey]: context }
  } })
  return { wrapper, context }
}

describe('页面权限母子分组', () => {
  it('配件设置只显示在配件管理子页面中，其他独立页面保留', () => {
    const { wrapper } = renderGroups()
    try {
      const groups = wrapper.findAll('.permission-group')
      expect(groups).toHaveLength(2)
      const accessories = groups.find(group => group.find('h3').text() === '配件管理')!
      expect(accessories.find('.group-tag').text()).toBe('母子页面')
      expect(accessories.find('.permission-module-card--parent .permission-module-card__title').text()).toBe('配件管理')
      expect(accessories.findAll('.permission-module-card--child')).toHaveLength(1)
      expect(accessories.find('.permission-module-card--child .permission-module-card__title').text()).toBe('配件设置')
      expect(wrapper.findAll('.permission-module-card')).toHaveLength(3)
      const query = groups.find(group => group.find('h3').text() === '综合查询')!
      expect(query.find('.group-tag').text()).toBe('独立页面')
      expect(query.findAll('.permission-switch__label').map(label => label.text())).toContain('贴膜')
    } finally {
      wrapper.unmount()
    }
  })

  it('子页面开关仍按原模块保存，母页面查看不授予子页面查看', async () => {
    const { wrapper, context } = renderGroups()
    try {
      const child = wrapper.find('.permission-module-card--child')
      const buttons = child.findAll('button')
      const view = buttons.find(button => button.text() === '查看')!
      expect(view.attributes('aria-pressed')).toBe('false')
      await view.trigger('click')
      expect(context.handleDialogPermissionChange).toHaveBeenCalledExactlyOnceWith('accessories_accessorycatalogview', 'view', true)
      await buttons.find(button => button.text() === '菜单查看')!.trigger('click')
      expect(context.handleDialogMenuPermissionChange).toHaveBeenCalledExactlyOnceWith('accessories_accessorycatalogview', true)
      expect(wrapper.find('.permission-module-card--parent button[aria-pressed="true"]').text()).toBe('查看')
    } finally {
      wrapper.unmount()
    }
  })

  it('母页面未在矩阵中时仍保留子页面权限入口', () => {
    const { wrapper } = renderGroups(false)
    try {
      expect(wrapper.findAll('.permission-group')).toHaveLength(2)
      expect(wrapper.findAll('.permission-module-card__title').map(title => title.text())).toContain('配件设置')
    } finally {
      wrapper.unmount()
    }
  })

  it('紧凑按钮移除滑块，菜单及动作的亮灰状态随原模块授权切换', async () => {
    const { wrapper, context } = renderGroups()
    const childKey = MODULE_CONFIGS.ACCESSORY_CATALOG.key
    const actions = reactive(new Set<string>())
    const menus = reactive(new Set<string>())
    context.isDialogPermissionSelected = (key: string, type: string) => actions.has(`${key}:${type}`)
    context.isDialogMenuPermissionSelected = (key: string) => menus.has(key)
    context.handleDialogPermissionChange.mockImplementation((key: string, type: string, enabled: boolean) => {
      if (enabled) actions.add(`${key}:${type}`)
      else actions.delete(`${key}:${type}`)
    })
    context.handleDialogMenuPermissionChange.mockImplementation((key: string, enabled: boolean) => {
      if (enabled) menus.add(key)
      else menus.delete(key)
    })
    try {
      await wrapper.vm.$nextTick()
      const buttons = wrapper.find('.permission-module-card--child').findAll('.permission-switch')
      const menu = buttons.find(button => button.text() === '菜单查看')!
      const view = buttons.find(button => button.text() === '查看')!
      expect(wrapper.find('.permission-switch__control').exists()).toBe(false)
      for (const button of wrapper.findAll('.permission-switch')) {
        expect(button.classes()).not.toContain('el-button--small')
        expect(button.classes()).not.toContain('el-button--large')
        expect(button.classes()).toContain('tf-button--neutral')
        expect(button.attributes('aria-pressed')).toBe('false')
        expect(button.find('.permission-switch__icon').attributes('aria-hidden')).toBe('true')
      }
      await view.trigger('click')
      expect(context.handleDialogPermissionChange).toHaveBeenLastCalledWith(childKey, 'view', true)
      expect(view.attributes('aria-pressed')).toBe('true')
      expect(view.classes()).toContain('tf-button--permission')
      expect(view.attributes('title')).toContain('已开启')
      expect(menu.attributes('aria-pressed')).toBe('false')
      await view.trigger('click')
      expect(context.handleDialogPermissionChange).toHaveBeenLastCalledWith(childKey, 'view', false)
      expect(view.classes()).toContain('tf-button--neutral')
      expect(view.attributes('title')).toContain('已关闭')
      await menu.trigger('click')
      expect(context.handleDialogMenuPermissionChange).toHaveBeenLastCalledWith(childKey, true)
      expect(menu.attributes('aria-pressed')).toBe('true')
      expect(menu.classes()).toContain('tf-button--permission')
      await menu.trigger('click')
      expect(context.handleDialogMenuPermissionChange).toHaveBeenLastCalledWith(childKey, false)
      expect(menu.classes()).toContain('tf-button--neutral')
      expect(wrapper.findAll('.permission-module-card--parent .permission-switch[aria-pressed="true"]')).toHaveLength(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('保存中所有菜单与动作按钮禁用，不能重复提交', async () => {
    const { wrapper, context } = renderGroups()
    try {
      context.savingDialogPermissions = true
      await wrapper.vm.$nextTick()
      for (const button of wrapper.findAll('.permission-switch')) {
        expect(button.attributes('disabled')).toBeDefined()
        await button.trigger('click')
      }
      expect(context.handleDialogPermissionChange).not.toHaveBeenCalled()
      expect(context.handleDialogMenuPermissionChange).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('母页面跟随接口的菜单顺序，固定分组不再抢到仪表盘和销售之前', async () => {
    const { wrapper, context } = renderGroups()
    try {
      const rows = [moduleRecord('dashboard_dashboardview', '仪表盘', ['view']),
        moduleRecord('sales_salesview', '销售管理', ['view']),
        moduleRecord('accessories_accessoriesview', '配件管理', ['view', 'create']),
        moduleRecord('accessories_accessorycatalogview', '配件设置', ['view', 'edit']),
        moduleRecord('salary_salaryview', '工资管理', ['view']),
        moduleRecord('salary_salaryrecordsview', '工资记录', ['view']),
        moduleRecord('salary_salarytemplatesview', '工资模板', ['view']),
        moduleRecord('unbound', '未配置菜单的页面', ['view'])]
      context.permissionDialogMatrix = rows
      await wrapper.vm.$nextTick()
      const titles = () => wrapper.findAll('.permission-group h3').map(title => title.text())
      expect(titles()).toEqual(['仪表盘', '销售管理', '配件管理', '工资管理', '未配置菜单的页面'])
      const salary = wrapper.findAll('.permission-group').find(group => group.find('h3').text() === '工资管理')!
      expect(salary.findAll('.permission-module-card--child .permission-module-card__title').map(title => title.text())).toEqual(['工资记录', '工资模板'])
      expect(wrapper.findAll('.permission-module-card')).toHaveLength(rows.length)
      // 菜单调序后不依赖重建分组；切换目标角色菜单可见性不改变全部页面的顺序。
      context.permissionDialogMatrix = [rows[4], rows[6], rows[5], ...rows.slice(0, 4), rows[7]]
      context.isDialogMenuPermissionSelected = () => true
      await wrapper.vm.$nextTick()
      expect(titles()).toEqual(['工资管理', '仪表盘', '销售管理', '配件管理', '未配置菜单的页面'])
      const reordered = wrapper.findAll('.permission-group').find(group => group.find('h3').text() === '工资管理')!
      expect(reordered.findAll('.permission-module-card--child .permission-module-card__title').map(title => title.text())).toEqual(['工资模板', '工资记录'])
      expect(context.handleDialogPermissionChange).not.toHaveBeenCalled()
      expect(context.handleDialogMenuPermissionChange).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
})
