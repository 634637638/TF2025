import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tab {
  path: string
  title: string
  icon?: string
  fixed?: boolean // 是否固定（不可关闭）
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([
    {
      path: '/dashboard',
      title: '工作台',
      icon: 'fas fa-home',
      fixed: true
    }
  ])

  // 添加标签页
  const addTab = (tab: Tab) => {
    const exists = tabs.value.find(t => t.path === tab.path)
    if (!exists) {
      tabs.value.push(tab)
    }
  }

  // 关闭标签页
  const closeTab = (path: string) => {
    const index = tabs.value.findIndex(t => t.path === path)
    if (index !== -1 && !tabs.value[index].fixed) {
      tabs.value.splice(index, 1)
    }
  }

  // 关闭其他标签页
  const closeOtherTabs = (path: string) => {
    tabs.value = tabs.value.filter(t => t.path === path || t.fixed)
  }

  // 关闭右侧标签页
  const closeRightTabs = (path: string) => {
    const index = tabs.value.findIndex(t => t.path === path)
    if (index !== -1) {
      tabs.value = tabs.value.slice(0, index + 1).concat(
        tabs.value.slice(index + 1).filter(t => t.fixed)
      )
    }
  }

  // 关闭所有标签页（保留固定标签）
  const closeAllTabs = () => {
    tabs.value = tabs.value.filter(t => t.fixed)
  }

  // 更新标签页标题
  const updateTabTitle = (path: string, title: string) => {
    const tab = tabs.value.find(t => t.path === path)
    if (tab) {
      tab.title = title
    }
  }

  return {
    tabs,
    addTab,
    closeTab,
    closeOtherTabs,
    closeRightTabs,
    closeAllTabs,
    updateTabTitle
  }
})
