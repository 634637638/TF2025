import { inject } from 'vue'

export const permissionsPageContextKey = Symbol('permissions-page-context')

// 子页面共享的上下文由父页面集中提供，属性集合随权限页面 TAB 扩展；此处是 Vue provide/inject 的动态边界。
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- context contract is assembled by the parent view
export type PermissionsPageContext = Record<string, any>

export function usePermissionsPageContext(): PermissionsPageContext {
  const context = inject<PermissionsPageContext>(permissionsPageContextKey)

  if (!context) {
    throw new Error('权限页面上下文未提供')
  }

  return context
}
