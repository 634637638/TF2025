<template>
  <el-card
    v-if="canView && (visibleItems.length || failed || store.loading)"
    class="dashboard-card dashboard-shortcuts"
    shadow="never"
    header="快捷方式"
    aria-label="快捷方式"
  >
    <SectionLoading
      v-if="store.loading && !visibleItems.length"
      text="正在读取快捷方式..."
    />
    <el-space
      v-else-if="failed"
      wrap
    >
      <el-text type="info">
        快捷方式暂时无法加载
      </el-text>
      <el-button
        class="tf-button--compact"
        :loading="store.loading"
        @click="load"
      >
        重试
      </el-button>
    </el-space>
    <div
      v-else
      class="dashboard-shortcuts__list"
    >
      <div
        v-for="(page, pageIndex) in shortcutPages"
        :key="pageIndex"
        class="dashboard-shortcuts__page"
        :style="{ '--shortcut-page-rows': page.rows }"
      >
        <el-button
          v-for="item in page.items"
          :key="item.id"
          v-permission="'dashboard:view'"
          class="tf-button--compact tf-button--soft-primary"
          native-type="button"
          :title="item.label"
          @click="open(item)"
        >
          <IconRenderer
            :icon="item.icon"
            aria-hidden="true"
          />
          <span class="dashboard-shortcut-label">{{ item.label }}</span>
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useAuthStore } from '@/stores/auth'
import { useDashboardShortcutsStore } from '@/stores/dashboard-shortcuts'
import { canUseShortcut, getShortcutDestination } from '@/utils/dashboard-shortcuts'
import { useNotification } from '@/composables/useNotification'
import { logger } from '@/utils/logger'
import type { DashboardShortcut } from '@/types/dashboard-shortcut'

const router = useRouter()
const authStore = useAuthStore()
const store = useDashboardShortcutsStore()
const { canView } = usePagePermissions('dashboard')
const { warning, error } = useNotification()
const failed = ref(false)
const visibleItems = computed(() => store.items.filter(item => canUseShortcut(item, router, authStore)))
const shortcutPages = computed(() => {
  const pages: Array<{ items: DashboardShortcut[]; rows: number }> = []
  for (let index = 0; index < visibleItems.value.length; index += 9) {
    const items = visibleItems.value.slice(index, index + 9)
    pages.push({ items, rows: Math.ceil(items.length / 3) })
  }
  return pages
})
const load = async () => {
  if (!canView.value || store.loading) return
  try { await store.load(); failed.value = false } catch (err) {
    failed.value = true
    logger.warn('读取首页快捷方式失败:', err)
  }
}
const open = async (item: DashboardShortcut) => {
  if (!canView.value || !canUseShortcut(item, router, authStore)) {
    warning('该快捷方式已停用或您没有使用权限')
    return
  }
  const target = getShortcutDestination(item, router)
  if (!target) return
  try { await router.push(target) } catch (err) {
    logger.warn('打开首页快捷方式失败:', err)
    error('打开快捷方式失败，请重试')
  }
}
onMounted(load)
onActivated(load)
defineExpose({ load })
</script>

<style scoped>
.dashboard-shortcuts { min-width: 0; }
.dashboard-shortcuts__page { display: contents; }
.dashboard-shortcuts__list {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--tf-space-2);
  width: 100%;
  min-width: 0;
}
.dashboard-shortcuts__list :deep(.el-button) {
  max-width: 100%;
  min-width: 0;
  margin: 0;
}
.dashboard-shortcuts :deep(.el-button > span) { min-width: 0; }
.dashboard-shortcut-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 767px) {
  .dashboard-shortcuts :deep(.el-card__header) { display: none; }
  .dashboard-shortcuts__list {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 0;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    scroll-snap-type: inline proximity;
    scrollbar-width: none;
  }
  .dashboard-shortcuts__page {
    display: grid;
    flex: 0 0 100%;
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(var(--shortcut-page-rows), minmax(0, auto));
    align-items: stretch;
    gap: var(--tf-space-2);
  }
  .dashboard-shortcuts__list::-webkit-scrollbar { display: none; }
  .dashboard-shortcuts__list :deep(.el-button) {
    width: 100%;
    scroll-snap-align: start;
  }
}
</style>
