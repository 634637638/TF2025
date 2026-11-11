<template>
  <div class="sales-mode-tabs">
    <div
      v-if="canWholesalePermission || canProxyTransferPermission"
      class="sales-mode-tab-group operation-tabs"
    >
      <el-button
        v-if="canWholesalePermission"
        :type="operationMode === 'wholesale' ? 'success' : 'default'"
        class="sales-mode-tab"
        size="small"
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
        class="sales-mode-tab"
        size="small"
        @click="emit('proxy')"
      >
        <i class="fas fa-exchange-alt" />
        <span>划拨</span>
        <span
          v-if="selectedCount > 0"
          class="badge"
        >({{ selectedCount }})</span>
      </el-button>
    </div>

    <div class="sales-mode-tab-group view-tabs">
      <el-button
        :type="viewMode === 'summary' ? 'primary' : 'default'"
        class="sales-mode-tab"
        title="对库"
        size="small"
        @click="emit('set-view-mode', 'summary')"
      >
        <i class="fas fa-table" />
        <span>对库</span>
      </el-button>
      <el-button
        :type="viewMode === 'grid' ? 'primary' : 'default'"
        class="sales-mode-tab"
        title="图文模式"
        size="small"
        @click="emit('set-view-mode', 'grid')"
      >
        <i class="fas fa-th" />
        <span>图文</span>
      </el-button>
      <el-button
        :type="viewMode === 'table' ? 'primary' : 'default'"
        class="sales-mode-tab"
        title="表格模式"
        size="small"
        @click="emit('set-view-mode', 'table')"
      >
        <i class="fas fa-list" />
        <span>表格</span>
      </el-button>
      <el-button
        v-if="viewMode === 'summary'"
        class="sales-mode-tab"
        type="primary"
        title="保存为图片"
        size="small"
        :loading="savingInventorySummary"
        :disabled="inventorySummaryLoading || summaryCount === 0"
        @click="emit('save-summary')"
      >
        <i class="fas fa-camera" />
        <span>保存图片</span>
      </el-button>
    </div>

    <div
      v-if="batchMode && selectedCount > 0"
      class="sales-mode-tab-group batch-tabs"
    >
      <span class="selection-count"><i class="fas fa-check-square" /> 已选 {{ selectedCount }} 台</span>
      <el-button
        type="primary"
        class="sales-mode-tab"
        :disabled="!canSell"
        size="small"
        @click="emit('batch-sale')"
      >
        <i class="fas fa-edit" />
        <span>批量销售</span>
      </el-button>
      <el-button
        type="info"
        plain
        class="sales-mode-tab"
        size="small"
        @click="emit('clear-selection')"
      >
        <i class="fas fa-times" />
        <span>清空</span>
      </el-button>
    </div>

    <div
      v-if="operationMode && canOperationAvailable(operationMode)"
      class="operation-inline"
    >
      <span
        class="operation-info"
        :class="operationMode === 'wholesale' ? 'wholesale-mode' : 'proxy-mode'"
      >
        <i
          class="fas"
          :class="operationMode === 'wholesale' ? 'fa-boxes' : 'fa-exchange-alt'"
        />
        <span v-if="selectedCount === 0">请勾选需要{{ operationMode === 'wholesale' ? '调货' : '划拨' }}的设备</span>
        <span v-else>{{ operationMode === 'wholesale' ? '调货' : '划拨' }} {{ selectedCount }} 台</span>
      </span>
      <el-button
        v-if="selectedCount > 0"
        :type="operationMode === 'wholesale' ? 'success' : 'warning'"
        :disabled="operationMode === 'wholesale' ? !canWholesale : !canProxy"
        size="small"
        @click="emit('open-wholesale')"
      >
        确认
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
  batchMode: boolean
  canSell: boolean
}>()

const emit = defineEmits<{
  wholesale: []
  proxy: []
  'save-summary': []
  'set-view-mode': [mode: ViewMode]
  'open-wholesale': []
  'batch-sale': []
  'clear-selection': []
}>()

const canOperationAvailable = (mode: Exclude<OperationMode, null>) => {
  return mode === 'wholesale' ? props.canWholesalePermission : props.canProxyTransferPermission
}
</script>

<style scoped lang="scss">
.sales-mode-tabs {
  display: flex;
  align-items: center;
  gap: var(--tf-space-2);
  min-width: 0;
  max-width: 100%;
  margin-bottom: var(--tf-space-3);
  padding: var(--tf-space-1) var(--tf-space-2);
  overflow-x: auto;
  background: var(--tf-button-neutral-hover-bg);
  border: 1px solid var(--tf-button-neutral-border);
  border-radius: var(--admin-panel-radius);
  scrollbar-width: thin;
}

.sales-mode-tab-group {
  display: flex;
  align-items: center;
  gap: var(--tf-space-1);
  flex: 0 0 auto;
}

.operation-tabs,
.view-tabs {
  padding-right: var(--tf-space-2);
  border-right: 1px solid var(--tf-button-neutral-border);
}

.batch-tabs {
  margin-left: auto;
}

.sales-mode-tab {
  margin: 0;
}

.sales-mode-tab .badge {
  opacity: 0.85;
}

.selection-count,
.operation-info {
  display: inline-flex;
  align-items: center;
  gap: var(--tf-space-1);
  white-space: nowrap;
  font-size: var(--tf-button-font-size-small);
}

.selection-count {
  color: var(--tf-text-secondary);
}

.operation-inline {
  display: flex;
  align-items: center;
  gap: var(--tf-space-1);
  flex: 0 0 auto;
}

.operation-info {
  padding: 0 var(--tf-space-1);
  font-weight: 500;
}

.operation-info.wholesale-mode {
  color: var(--tf-button-success-soft-color);
}

.operation-info.proxy-mode {
  color: var(--tf-button-warning-soft-color);
}

@media (max-width: 767px) {
  .sales-mode-tabs {
    gap: var(--tf-space-1);
    margin-bottom: var(--tf-space-2);
    padding: var(--tf-space-1);
  }

  .sales-mode-tab .badge {
    display: none;
  }

  .batch-tabs {
    margin-left: 0;
  }
}

</style>
