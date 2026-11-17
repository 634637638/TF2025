/** 首页和站点信息管理共用的快捷方式契约。 */
export interface DashboardShortcutInput {
  label: string
  kind: 'page' | 'action'
  target: string
  icon: string
  sortOrder: number
  enabled: boolean
}

export interface DashboardShortcut extends DashboardShortcutInput {
  id: string
}
