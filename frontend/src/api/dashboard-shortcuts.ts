import { unifiedApi } from '@/utils/unified-api'
import type { DashboardShortcut, DashboardShortcutInput } from '@/types/dashboard-shortcut'

const endpoint = '/system/dashboard-shortcuts'
const config = { showLoading: false, showError: false, useCache: false }

export const dashboardShortcutsApi = {
  list: (admin = false) => unifiedApi.get<DashboardShortcut[]>(`${endpoint}${admin ? '/admin' : ''}`, config),
  create: (input: DashboardShortcutInput) => unifiedApi.post<DashboardShortcut[]>(endpoint, input, config),
  update: (id: string, input: DashboardShortcutInput) => unifiedApi.put<DashboardShortcut[]>(`${endpoint}/${encodeURIComponent(id)}`, input, config),
  remove: (id: string) => unifiedApi.delete<DashboardShortcut[]>(`${endpoint}/${encodeURIComponent(id)}`, config)
}
