<template>
  <div class="unified-search-panel" @click.capture="handlePanelClick">
    <div class="unified-search-panel__form" :class="{ 'is-expanded': expanded }" @click.stop>
      <div class="unified-search-panel__primary">
        <slot name="primary" />
      </div>

      <div class="unified-search-panel__actions" @click.stop>
        <slot name="actions">
          <el-button type="primary" size="small" @click="$emit('search')" :disabled="loading">
            <i class="fas fa-search"></i>
            搜索
          </el-button>
          <el-button type="default" size="small" @click="$emit('reset')">
            <i class="fas fa-redo"></i>
            重置
          </el-button>
        </slot>
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

const openPanel = () => {
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
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #d1d9e6;
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
  height: 34px;
}

.unified-search-panel__form :deep(.el-input),
.unified-search-panel__form :deep(.el-select),
.unified-search-panel__form :deep(.el-date-picker) {
  width: 100%;
}

.unified-search-panel__form :deep(.el-input__wrapper),
.unified-search-panel__form :deep(.el-select .el-input__wrapper),
.unified-search-panel__form :deep(.el-date-editor .el-input__wrapper) {
  min-height: 34px;
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

  .unified-search-panel__primary {
    flex: 1 1 calc(100% - 126px);
    max-width: calc(100% - 126px);
    min-width: 0;
    order: 1;
    display: flex;
  }

  .unified-search-panel__actions {
    order: 2;
    flex: 0 0 118px;
    width: 118px;
    max-width: 118px;
    gap: 4px;
    display: flex;
    align-items: center;
    align-self: center;
    flex-wrap: nowrap;
    min-width: 0;
    height: 30px;
    min-height: 30px;
    box-sizing: border-box;
  }

  .unified-search-panel__primary :deep(.el-input) {
    height: 34px;
  }

  .unified-search-panel__primary :deep(.el-input__wrapper),
  .unified-search-panel__actions :deep(.el-button) {
    box-sizing: border-box;
  }

  .unified-search-panel__actions :deep(.el-button) {
    height: 30px !important;
    min-height: 30px !important;
    box-sizing: border-box;
    font-size: 11px;
    flex: 0 1 auto;
    min-width: 0;
  }

  .unified-search-panel__primary :deep(.el-input__wrapper) {
    padding-top: 0;
    padding-bottom: 0;
  }

  .unified-search-panel__actions :deep(.el-button) {
    min-width: 0;
    width: calc(50% - 2px);
    padding: 0 7px !important;
    margin: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
  }

  .unified-search-panel__actions :deep(.el-button i),
  .unified-search-panel__actions :deep(.el-button .el-icon) {
    font-size: 11px;
  }

  .unified-search-panel__actions :deep(.el-button span) {
    font-size: 11px;
    line-height: 1;
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

  .unified-search-panel__primary {
    flex-basis: calc(100% - 112px);
    max-width: calc(100% - 112px);
  }

  .unified-search-panel__primary :deep(.el-input) {
    height: 32px;
  }

  .unified-search-panel__form :deep(.el-input__wrapper),
  .unified-search-panel__form :deep(.el-select .el-input__wrapper),
  .unified-search-panel__form :deep(.el-date-editor .el-input__wrapper) {
    min-height: 32px;
    height: 32px;
    box-sizing: border-box;
  }

  .unified-search-panel__actions :deep(.el-button) {
    height: 28px !important;
    min-height: 28px !important;
    min-width: 0;
    padding: 0 6px !important;
    font-size: 10px;
  }

  .unified-search-panel__actions :deep(.el-button i),
  .unified-search-panel__actions :deep(.el-button .el-icon),
  .unified-search-panel__actions :deep(.el-button span) {
    font-size: 10px;
    line-height: 1;
  }

  .unified-search-panel__actions {
    flex-basis: 106px;
    width: 106px;
    max-width: 106px;
    height: 28px;
    min-height: 28px;
  }
}

@media (max-width: 390px) {
  .unified-search-panel__form {
    gap: 4px;
  }

  .unified-search-panel__primary {
    flex-basis: calc(100% - 100px);
    max-width: calc(100% - 100px);
  }

  .unified-search-panel__actions {
    flex-basis: 96px;
    width: 96px;
    max-width: 96px;
    gap: 3px;
  }

  .unified-search-panel__actions :deep(.el-button) {
    min-width: 0;
    padding: 0 5px !important;
    font-size: 10px;
  }
}
</style>
