<template>
  <PageHeader
    icon="fas fa-store"
    title="销售管理"
  >
    <template #actions>
      <el-button
        :type="batchMode ? 'success' : 'primary'"
        :plain="!batchMode"
        :disabled="!canSell"
        @click="emit('toggle-batch-mode')"
      >
        <i :class="batchMode ? 'fas fa-check-square' : 'fas fa-mobile-alt'" />
        <span>{{ batchMode ? '批量模式' : '单台模式' }}</span>
      </el-button>
      <el-tag
        v-if="batchMode && selectedCount > 0"
        type="success"
        effect="dark"
        class="ml-3"
      >
        已选择: {{ selectedCount }} 台
      </el-tag>
      <ImportExportActions
        :can-export="canExport"
        :export-loading="exportLoading"
        export-label="导出"
        export-loading-label="导出中..."
        export-icon-class="fas fa-file-excel"
        export-type="success"
        @export="emit('export')"
      />
      <el-button
        type="info"
        :disabled="refreshing"
        @click="emit('refresh')"
      >
        <InlineLoading
          v-if="refreshing"
          text="刷新中..."
          size="small"
          variant="inherit"
        />
        <template v-else>
          <i class="fas fa-sync-alt" />
          <span>刷新</span>
        </template>
      </el-button>
    </template>
  </PageHeader>
</template>

<script setup lang="ts">
import InlineLoading from '@/components/InlineLoading.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { PageHeader } from '@/components/base'

defineProps<{
  batchMode: boolean
  selectedCount: number
  canSell: boolean
  canExport: boolean
  exportLoading: boolean
  refreshing: boolean
}>()

const emit = defineEmits<{
  'toggle-batch-mode': []
  export: []
  refresh: []
}>()
</script>
