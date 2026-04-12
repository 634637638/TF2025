import { inject } from 'vue'

export const permissionsPageContextKey = Symbol('permissions-page-context')

export type PermissionsPageContext = Record<string, any>

export function usePermissionsPageContext(): PermissionsPageContext {
  const context = inject<PermissionsPageContext>(permissionsPageContextKey)

  if (!context) {
    throw new Error('权限页面上下文未提供')
  }

  return context
}
