import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardShortcutsApi } from '@/api/dashboard-shortcuts'
import type { DashboardShortcut, DashboardShortcutInput } from '@/types/dashboard-shortcut'

export const useDashboardShortcutsStore = defineStore('dashboard-shortcuts', () => {
  const items = ref<DashboardShortcut[]>([])
  const managedItems = ref<DashboardShortcut[]>([])
  const loading = ref(false)
  const loadingAdmin = ref(false)
  const saving = ref(false)
  let readVersion = 0
  let adminReadVersion = 0

  const load = async (admin = false) => {
    const version = admin ? ++adminReadVersion : ++readVersion
    const busy = admin ? loadingAdmin : loading
    busy.value = true
    try {
      const response = await dashboardShortcutsApi.list(admin)
      if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || '快捷方式响应无效')
      if (version !== (admin ? adminReadVersion : readVersion)) return
      if (admin) managedItems.value = response.data
      else items.value = response.data
    } finally {
      if (version === (admin ? adminReadVersion : readVersion)) busy.value = false
    }
  }

  const save = async (id: string | null, input: DashboardShortcutInput | null) => {
    if (saving.value) return false
    saving.value = true
    // 管理写入开始即使旧读取失效，避免写入成功后旧列表回填。
    ++readVersion
    ++adminReadVersion
    loading.value = false
    loadingAdmin.value = false
    try {
      const response = input === null
        ? await dashboardShortcutsApi.remove(id || '')
        : id ? await dashboardShortcutsApi.update(id, input) : await dashboardShortcutsApi.create(input)
      if (!response.success || !Array.isArray(response.data)) throw new Error(response.message || '快捷方式保存失败')
      ++readVersion
      ++adminReadVersion
      loading.value = false
      loadingAdmin.value = false
      managedItems.value = response.data
      items.value = response.data.filter(item => item.enabled)
      return true
    } finally {
      saving.value = false
    }
  }

  return { items, managedItems, loading, loadingAdmin, saving, load, save }
})
