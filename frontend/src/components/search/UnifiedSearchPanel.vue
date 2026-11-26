<template>
  <div
    ref="panelRef"
    class="unified-search-panel"
    @click="handlePanelClick"
    @input.capture="handleSearchInput"
    @click.capture="handleSearchInteraction"
    @change.capture="handleSearchInteraction"
    @keyup.enter.capture="handleEnterSearch"
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
          <SearchActionButton
            type="primary"
            :loading="loading"
            :disabled="searchDisabled"
            class="unified-search-panel__search-button"
            @click="handleSearch"
          >
            {{ searchLabel }}
          </SearchActionButton>
          <el-button
            v-if="showReset"
            type="default"
            class="tf-button--reset"
            :disabled="loading"
            @click="handleReset"
          >
            <i
              class="fas fa-redo"
              aria-hidden="true"
            />
            重置
          </el-button>
        </div>
      </div>

      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { requestPaginationReset } from '@/utils/search-pagination'

interface Props {
  expanded?: boolean
  loading?: boolean
  searchDisabled?: boolean
  searchLabel?: string
  showReset?: boolean
  autoResetPagination?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
  loading: false,
  searchDisabled: false,
  searchLabel: '搜索',
  showReset: true,
  autoResetPagination: true
})

interface Emits {
  'update:expanded': [value: boolean]
  search: []
  reset: []
}

const emit = defineEmits<Emits>()
const panelRef = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const cancelPendingSearch = () => {
  if (searchTimer === null) return
  clearTimeout(searchTimer)
  searchTimer = null
}

const scheduleSearch = () => {
  cancelPendingSearch()
  searchTimer = setTimeout(() => {
    searchTimer = null
    if (!props.searchDisabled) handleSearch()
  }, 350)
}

const resetPagination = () => {
  if (!props.autoResetPagination) return
  requestPaginationReset(panelRef.value)
}

const handleSearch = () => {
  if (props.searchDisabled) return
  cancelPendingSearch()
  resetPagination()
  emit('search')
}

const handleReset = () => {
  cancelPendingSearch()
  resetPagination()
  emit('reset')
}

const handleSearchInput = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
  if (target.closest('.el-select, .el-date-editor, .el-cascader, .el-tree-select')) return
  if (target.disabled || target.readOnly || (event as InputEvent).isComposing) return

  scheduleSearch()
}

const handleSearchInteraction = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target) return

  if (target.closest('input, button, textarea, select, [role="button"], .el-select, .el-date-editor')) {
    resetPagination()
  }

  const clearButton = target.closest('.el-input__clear')
  const isTextInputClear = clearButton && !clearButton.closest('.el-select, .el-date-editor, .el-cascader, .el-tree-select')

  if (target.closest('.filter-item') && !isTextInputClear) cancelPendingSearch()

  if (
    isTextInputClear
  ) {
    cancelPendingSearch()
    searchTimer = setTimeout(() => {
      searchTimer = null
      scheduleSearch()
    }, 0)
  }

}

const handleEnterSearch = (event: KeyboardEvent) => {
  if (event.isComposing) return
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
  if (target.closest('.el-select, .el-date-editor, .el-cascader, .el-tree-select')) return
  event.stopPropagation()
  if (props.searchDisabled) return
  handleSearch()
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

onBeforeUnmount(cancelPendingSearch)
</script>

<style scoped lang="scss" src="./styles/unified-search-panel/desktop.scss"></style>
<style scoped lang="scss" src="./styles/unified-search-panel/responsive.scss"></style>
