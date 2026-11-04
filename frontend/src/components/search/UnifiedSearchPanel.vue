<template>
  <div
    ref="panelRef"
    class="unified-search-panel"
    @click="handlePanelClick"
    @click.capture="handleSearchInteraction"
    @input.capture="handleSearchInteraction"
    @change.capture="handleSearchInteraction"
    @keydown.enter.capture="handleSearchInteraction"
  >
    <div
      class="unified-search-panel__form"
      :class="{ 'is-expanded': expanded }"
      @click.stop
    >
      <div class="unified-search-panel__main">
        <div class="unified-search-panel__primary">
          <slot name="primary" />
        </div>

        <div
          class="unified-search-panel__actions"
          @click.stop
        >
          <slot
            name="actions"
            :loading="loading"
            :searching="loading"
          >
            <el-button
              type="primary"
              class="unified-search-panel__search-button"
              :loading="loading"
              :aria-busy="loading"
              @click="handleSearch"
            >
              <i class="fas fa-search" />
              搜索
            </el-button>
            <el-button
              type="default"
              :disabled="loading"
              @click="handleReset"
            >
              <i class="fas fa-redo" />
              重置
            </el-button>
          </slot>
        </div>
      </div>

      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { requestPaginationReset } from '@/utils/search-pagination'

interface Props {
  expanded?: boolean
  loading?: boolean
  autoResetPagination?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
  loading: false,
  autoResetPagination: true
})

interface Emits {
  'update:expanded': [value: boolean]
  search: []
  reset: []
}

const emit = defineEmits<Emits>()
const panelRef = ref<HTMLElement | null>(null)

const resetPagination = () => {
  if (!props.autoResetPagination) return
  requestPaginationReset(panelRef.value)
}

const handleSearch = () => {
  resetPagination()
  emit('search')
}

const handleReset = () => {
  resetPagination()
  emit('reset')
}

const handleSearchInteraction = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target) return

  if (target.closest('input, button, textarea, select, [role="button"], .el-select, .el-date-editor')) {
    resetPagination()
  }
}

const _openPanel = () => {
  if (!props.expanded) {
    emit('update:expanded', true)
  }
}

const toggleExpanded = () => {
  emit('update:expanded', !props.expanded)
}

const handlePanelClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (
    target?.closest('.unified-search-panel__primary') ||
    target?.closest('.unified-search-panel__actions') ||
    target?.closest('.filter-item')
  ) {
    return
  }
  toggleExpanded()
}
</script>

<style scoped lang="scss" src="./styles/unified-search-panel/desktop.scss"></style>
<style scoped lang="scss" src="./styles/unified-search-panel/responsive.scss"></style>
