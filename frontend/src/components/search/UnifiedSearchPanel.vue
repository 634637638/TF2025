<template>
  <div
    class="unified-search-panel"
    @click.capture="handlePanelClick"
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
          <slot name="actions">
            <el-button
              type="primary"
              :disabled="loading"
              @click="$emit('search')"
            >
              <i class="fas fa-search" />
              搜索
            </el-button>
            <el-button
              type="default"
              @click="$emit('reset')"
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
interface Props {
  expanded?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  expanded: false,
  loading: false
})

interface Emits {
  'update:expanded': [value: boolean]
  search: []
  reset: []
}

const emit = defineEmits<Emits>()

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

<style scoped lang="scss">
.unified-search-panel {
  background: var(--admin-search-panel-bg);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--tf-color-border-input);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  user-select: none;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
}

.unified-search-panel:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.unified-search-panel__form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.unified-search-panel__main {
  display: contents;
}

.unified-search-panel__primary {
  flex: 1 1 220px;
  min-width: 200px;
}

.unified-search-panel__actions {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}

.unified-search-panel__form :deep(.form-group) {
  margin: 0;
}

.unified-search-panel__form:not(.is-expanded) :deep(.filter-item) {
  display: none;
}

.unified-search-panel__form :deep(.filter-item) {
  min-width: 0;
}

.unified-search-panel__form :deep(.el-input),
.unified-search-panel__form :deep(.el-select),
.unified-search-panel__form :deep(.el-date-picker),
.unified-search-panel__form :deep(.el-button) {
  height: var(--tf-search-control-height, 34px) !important;
  min-height: var(--tf-search-control-height, 34px) !important;
  box-sizing: border-box;
}

.unified-search-panel__form :deep(.el-input),
.unified-search-panel__form :deep(.el-select),
.unified-search-panel__form :deep(.el-date-picker) {
  width: 100%;
}

.unified-search-panel__form :deep(.el-input__wrapper),
.unified-search-panel__form :deep(.el-select .el-input__wrapper),
.unified-search-panel__form :deep(.el-select__wrapper),
.unified-search-panel__form :deep(.el-date-editor.el-input__wrapper),
.unified-search-panel__form :deep(.el-date-editor .el-input__wrapper) {
  height: var(--tf-search-control-height, 34px) !important;
  min-height: var(--tf-search-control-height, 34px) !important;
  box-sizing: border-box;
}

.unified-search-panel__form :deep(.el-input__inner),
.unified-search-panel__form :deep(.el-date-editor .el-range-input) {
  height: 100% !important;
  min-height: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  box-sizing: border-box;
}

@media (min-width: 769px) {
  .unified-search-panel__form {
    flex-wrap: nowrap;
  }

  .unified-search-panel__form.is-expanded :deep(.filter-item) {
    display: block;
    flex: 1 1 auto;
    min-width: 120px;
  }
}

@media (max-width: 768px) {
  .unified-search-panel {
    padding: 12px;
    margin-bottom: 12px;
    border-radius: 8px;
  }

  .unified-search-panel__form {
    gap: 8px;
    align-items: stretch;
  }

  .unified-search-panel__main {
    display: flex;
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    gap: 8px;
    align-items: center;
  }

  .unified-search-panel__form:not(.is-expanded) {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
  }

  .unified-search-panel__form:not(.is-expanded) .unified-search-panel__primary {
    min-width: 0;
    max-width: none;
    width: auto;
    order: 1;
    display: flex;
    flex: 1 1 0;
  }

  .unified-search-panel__form:not(.is-expanded) .unified-search-panel__actions {
    order: 2;
    gap: 4px;
    display: flex;
    align-items: center;
    align-self: center;
    flex-wrap: nowrap;
    height: var(--tf-search-control-height, 34px);
    min-height: var(--tf-search-control-height, 34px);
    box-sizing: border-box;
  }

  .unified-search-panel__form.is-expanded .unified-search-panel__primary {
    flex: 1 1 0;
    max-width: none;
    min-width: 0;
    order: 1;
    display: flex;
  }

  .unified-search-panel__form.is-expanded .unified-search-panel__actions {
    order: 2;
    flex: 0 0 auto;
    width: auto;
    max-width: none;
    gap: 4px;
    display: flex;
    align-items: center;
    align-self: center;
    flex-wrap: nowrap;
    min-width: 0;
    height: var(--tf-search-control-height, 34px);
    min-height: var(--tf-search-control-height, 34px);
    box-sizing: border-box;
  }

  .unified-search-panel__primary :deep(.el-input) {
    height: var(--tf-search-control-height, 34px) !important;
  }

  .unified-search-panel__primary :deep(.el-input__wrapper),
  .unified-search-panel__actions :deep(.el-button) {
    box-sizing: border-box;
  }

  .unified-search-panel__primary :deep(.el-input__wrapper) {
    min-height: var(--tf-search-control-height, 34px) !important;
    height: var(--tf-search-control-height, 34px) !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  .unified-search-panel__actions :deep(.el-button) {
    flex: 0 0 auto;
    width: auto;
    margin: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
  }

  .unified-search-panel__form.is-expanded :deep(.filter-item) {
    display: block;
    flex: 1 1 calc(50% - 4px);
    min-width: calc(50% - 4px);
  }
}

@media (max-width: 480px) {
  .unified-search-panel {
    padding: 10px;
  }

  .unified-search-panel__form {
    gap: 6px;
  }

  .unified-search-panel__main {
    gap: 6px;
  }

  .unified-search-panel__primary :deep(.el-input) {
    height: var(--tf-search-control-height, 30px) !important;
  }

  .unified-search-panel__form :deep(.el-input__wrapper),
  .unified-search-panel__form :deep(.el-select .el-input__wrapper),
  .unified-search-panel__form :deep(.el-select__wrapper),
  .unified-search-panel__form :deep(.el-date-editor.el-input__wrapper),
  .unified-search-panel__form :deep(.el-date-editor .el-input__wrapper) {
    min-height: var(--tf-search-control-height, 30px) !important;
    height: var(--tf-search-control-height, 30px) !important;
    box-sizing: border-box;
  }

  .unified-search-panel__actions :deep(.el-button) {
    min-width: 0;
  }

}

@media (max-width: 390px) {
  .unified-search-panel__form {
    gap: 4px;
  }

  .unified-search-panel__main {
    gap: 4px;
  }

  .unified-search-panel__form.is-expanded .unified-search-panel__actions,
  .unified-search-panel__form:not(.is-expanded) .unified-search-panel__actions {
    gap: 3px;
  }

  .unified-search-panel__actions :deep(.el-button > span) {
    gap: 4px;
  }
}
</style>
