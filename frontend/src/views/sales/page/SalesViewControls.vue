<template>
  <div class="view-controls">
    <div
      v-if="canWholesalePermission || canProxyTransferPermission"
      class="wholesale-actions"
    >
      <el-button
        v-if="canWholesalePermission"
        :type="operationMode === 'wholesale' ? 'success' : 'default'"
        :class="{ active: operationMode === 'wholesale' }"
        size="small"
        :disabled="!canWholesalePermission"
        @click="emit('wholesale')"
      >
        <i class="fas fa-boxes" />
        <span>调货</span>
        <span
          v-if="selectedCount > 0"
          class="badge"
        >({{ selectedCount }})</span>
      </el-button>
      <el-button
        v-if="canProxyTransferPermission"
        :type="operationMode === 'proxy' ? 'warning' : 'default'"
        :class="{ active: operationMode === 'proxy' }"
        size="small"
        :disabled="!canProxyTransferPermission"
        @click="emit('proxy')"
      >
        <i class="fas fa-exchange-alt" />
        <span>划拨</span>
        <span
          v-if="selectedCount > 0"
          class="badge"
        >({{ selectedCount }})</span>
      </el-button>
      <el-divider
        v-if="canWholesalePermission || canProxyTransferPermission"
        direction="vertical"
      />
    </div>

    <div class="view-toggle-group">
      <div class="view-toggle">
        <el-button
          v-if="viewMode === 'summary'"
          class="summary-action-button"
          type="primary"
          size="small"
          title="保存为图片"
          :loading="savingInventorySummary"
          :disabled="inventorySummaryLoading || summaryCount === 0"
          @click="emit('save-summary')"
        >
          <i class="fas fa-camera" />
          <span class="view-toggle-text">保存图片</span>
        </el-button>
        <el-button
          :type="viewMode === 'summary' ? 'primary' : 'default'"
          title="对存表"
          @click="emit('set-view-mode', 'summary')"
        >
          <i class="fas fa-table" />
          <span class="view-toggle-text">对库</span>
        </el-button>
        <el-button
          :type="viewMode === 'grid' ? 'primary' : 'default'"
          title="图文模式"
          @click="emit('set-view-mode', 'grid')"
        >
          <i class="fas fa-th" />
          <span class="view-toggle-text">图文</span>
        </el-button>
        <el-button
          :type="viewMode === 'table' ? 'primary' : 'default'"
          title="表格模式"
          @click="emit('set-view-mode', 'table')"
        >
          <i class="fas fa-list" />
          <span class="view-toggle-text">表格</span>
        </el-button>
      </div>
    </div>
  </div>

  <div
    v-if="operationMode && canOperationAvailable(operationMode)"
    class="operation-tip"
  >
    <div
      class="operation-bar"
      :class="operationMode === 'wholesale' ? 'wholesale-mode' : 'proxy-mode'"
    >
      <div class="operation-info">
        <i
          class="fas"
          :class="operationMode === 'wholesale' ? 'fa-boxes' : 'fa-exchange-alt'"
        />
        <span v-if="selectedCount === 0">请勾选需要{{ operationMode === 'wholesale' ? '调货' : '划拨' }}的手机</span>
        <span v-else>{{ operationMode === 'wholesale' ? '调货' : '划拨' }}数量 {{ selectedCount }} 台</span>
      </div>
      <el-button
        v-if="selectedCount > 0"
        :type="operationMode === 'wholesale' ? 'success' : 'warning'"
        :disabled="operationMode === 'wholesale' ? !canWholesale : !canProxy"
        size="default"
        @click="emit('open-wholesale')"
      >
        确认{{ operationMode === 'wholesale' ? '调货' : '划拨' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
type ViewMode = 'grid' | 'table' | 'summary'
type OperationMode = 'wholesale' | 'proxy' | null

const props = defineProps<{
  viewMode: ViewMode
  operationMode: OperationMode
  selectedCount: number
  summaryCount: number
  savingInventorySummary: boolean
  inventorySummaryLoading: boolean
  canWholesalePermission: boolean
  canProxyTransferPermission: boolean
  canWholesale: boolean
  canProxy: boolean
}>()

const emit = defineEmits<{
  wholesale: []
  proxy: []
  'save-summary': []
  'set-view-mode': [mode: ViewMode]
  'open-wholesale': []
}>()

const canOperationAvailable = (mode: Exclude<OperationMode, null>) => {
  return mode === 'wholesale' ? props.canWholesalePermission : props.canProxyTransferPermission
}
</script>

<style scoped lang="scss">
.view-controls {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.view-toggle-group {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.wholesale-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--tf-button-neutral-hover-bg);
  border-radius: var(--admin-panel-radius);
  border: 1px solid var(--tf-button-neutral-border);
}

.wholesale-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  height: 32px;
  padding: 0 12px;
  position: relative;
  transition: all 0.3s ease;
}

.wholesale-actions :deep(.el-button.active) {
  transform: translateY(-1px);
  box-shadow: var(--tf-button-shadow-hover);
}

.wholesale-actions :deep(.el-button i) {
  font-size: 14px;
}

.wholesale-actions :deep(.el-button span) {
  font-size: 13px;
}

.wholesale-actions :deep(.badge) {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.85;
}

.wholesale-actions :deep(.el-button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.wholesale-actions :deep(.el-button:disabled .badge) {
  display: none;
}

.view-toggle {
  display: flex;
  gap: 4px;
}

.view-toggle :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.summary-action-button {
  min-width: 74px;
  justify-content: center;
  padding: 0 12px;
}

.view-toggle-text {
  font-size: 13px;
}

.operation-tip {
  margin: 16px 0;
  animation: slideDown 0.3s ease;
}

.operation-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.operation-bar.wholesale-mode {
  background: var(--tf-button-success-soft-bg);
  border: 1px solid var(--tf-button-success-soft-border);
  color: var(--tf-button-success-soft-color);
}

.operation-bar.proxy-mode {
  background: var(--tf-button-warning-soft-bg);
  border: 1px solid var(--tf-button-warning-soft-border);
  color: var(--tf-button-warning-soft-color);
}

.operation-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.operation-info i {
  font-size: 18px;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .view-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .wholesale-actions {
    display: flex;
    gap: 4px;
    padding: 6px;
    flex-wrap: nowrap;
  }

  .wholesale-actions :deep(.el-divider) {
    display: none;
  }

  .wholesale-actions :deep(.el-button) {
    flex: 1;
    min-width: 0;
    margin: 0;
    justify-content: center;
    padding: 0 6px;
    height: 30px;
    min-height: 30px;
    font-size: 11px;
  }

  .wholesale-actions :deep(.el-button i),
  .wholesale-actions :deep(.el-button span) {
    font-size: 11px;
  }

  .view-toggle-group {
    width: 100%;
    margin-left: 0;
  }

  .view-toggle {
    flex: 1;
    min-width: 0;
    gap: 4px;
    flex-wrap: nowrap;
  }

  .view-toggle :deep(.el-button) {
    flex: 1;
    min-width: 0;
    margin: 0;
    justify-content: center;
    padding: 0 6px;
    height: 30px;
    min-height: 30px;
  }

  .view-toggle-text {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .view-controls { gap: 4px; }
  .wholesale-actions { gap: 3px; }
  .wholesale-actions :deep(.el-button) {
    height: 28px;
    min-height: 28px;
    padding: 0 4px;
    font-size: 10px;
  }
  .wholesale-actions :deep(.el-button i),
  .wholesale-actions :deep(.el-button span) { font-size: 10px; }
  .view-toggle { gap: 3px; }
  .view-toggle :deep(.el-button) {
    height: 28px;
    min-height: 28px;
    padding: 0 4px;
  }
  .view-toggle :deep(.el-button i) { font-size: 10px; }
}
</style>
