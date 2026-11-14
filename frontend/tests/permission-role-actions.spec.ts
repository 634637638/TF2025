import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { ElButton, ElTable, ElTableColumn } from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import RolesPage from '@/views/permissions/page/RolesPage.vue'
import { permissionsPageContextKey } from '@/views/permissions/page/context'
import type { PermissionRole } from '@/views/permissions/types'

async function mountRoles(roles: PermissionRole[], canEdit = true) {
  const context = reactive({
    canEdit,
    canDelete: false,
    canViewPermissionsField: () => true,
    showPermissionsActionField: false,
    rolesLoading: false,
    rolesPagination: { total: roles.length, page: 1, page_size: 10 },
    paginatedRoles: roles,
    formatDate: () => '-',
    toggleRoleStatus: vi.fn(),
    handleRolesPaginationChange: vi.fn()
  })
  const wrapper = mount(RolesPage, { global: {
    components: { ElButton, ElTable, ElTableColumn },
    provide: { [permissionsPageContextKey]: context },
    directives: { 'tf-loading': {} },
    stubs: { Pagination: true, DataEmptyState: true },
    mocks: { $getNumberColumnWidth: () => 64 }
  } })
  await flushPromises()
  return { wrapper, context }
}

describe('角色启停按钮公共表格入口', () => {
  it.each([true, false, '1', '0'])('状态 %s 使用对应的公共紧凑操作语义', async isActive => {
    const role = { id: 2, name: '普通角色', is_active: isActive }
    const { wrapper, context } = await mountRoles([role])
    try {
      const button = wrapper.find('button.table-action')
      const active = isActive === true || isActive === '1'
      expect(button.text()).toBe(active ? '停用' : '启用')
      expect(button.classes()).toContain(active ? 'table-action--warning' : 'table-action--success')
      expect(button.attributes('disabled')).toBeUndefined()
      await button.trigger('click')
      expect(context.toggleRoleStatus).toHaveBeenCalledExactlyOnceWith(role)
    } finally {
      wrapper.unmount()
    }
  })

  it('系统角色继续禁用启停操作', async () => {
    const { wrapper, context } = await mountRoles([1, 9].map(id => ({ id, name: '系统角色', is_active: true })))
    try {
      const buttons = wrapper.findAll('button.table-action')
      expect(buttons).toHaveLength(2)
      for (const button of buttons) {
        expect(button.attributes('disabled')).toBeDefined()
        await button.trigger('click')
      }
      expect(context.toggleRoleStatus).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('没有编辑权限时隐藏启停入口', async () => {
    const { wrapper } = await mountRoles([{ id: 2, name: '普通角色', is_active: true }], false)
    try {
      expect(wrapper.find('button').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
