<template>
  <el-button
    v-if="showImport && canImport"
    :type="importType"
    :plain="importPlain"
    :disabled="importDisabled"
    :loading="importLoading"
    :size="size"
    :title="importTitle"
    @click="emit('import')"
  >
    <i :class="importIconClass"></i>
    <span>{{ importLoading ? importLoadingLabel : importLabel }}</span>
  </el-button>

  <el-button
    v-if="showExport && canExport"
    :type="exportType"
    :plain="exportPlain"
    :disabled="exportDisabled"
    :loading="exportLoading"
    :size="size"
    :title="exportTitle"
    @click="emit('export')"
  >
    <i :class="exportIconClass"></i>
    <span>{{ exportLoading ? exportLoadingLabel : exportLabel }}</span>
  </el-button>
</template>

<script setup lang="ts">
interface Props {
  showImport?: boolean
  showExport?: boolean
  canImport?: boolean
  canExport?: boolean
  importLoading?: boolean
  exportLoading?: boolean
  importDisabled?: boolean
  exportDisabled?: boolean
  importLabel?: string
  importLoadingLabel?: string
  exportLabel?: string
  exportLoadingLabel?: string
  importIconClass?: string
  exportIconClass?: string
  importType?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
  exportType?: 'primary' | 'success' | 'warning' | 'info' | 'danger'
  importPlain?: boolean
  exportPlain?: boolean
  importTitle?: string
  exportTitle?: string
  size?: 'large' | 'default' | 'small'
}

interface Emits {
  (event: 'import'): void
  (event: 'export'): void
}

withDefaults(defineProps<Props>(), {
  showImport: false,
  showExport: true,
  canImport: false,
  canExport: false,
  importLoading: false,
  exportLoading: false,
  importDisabled: false,
  exportDisabled: false,
  importLabel: '导入',
  importLoadingLabel: '导入中...',
  exportLabel: '导出',
  exportLoadingLabel: '导出中...',
  importIconClass: 'fas fa-file-import',
  exportIconClass: 'fas fa-file-export',
  importType: 'warning',
  exportType: 'success',
  importPlain: false,
  exportPlain: false,
  importTitle: '导入数据',
  exportTitle: '导出数据',
  size: 'default'
})

const emit = defineEmits<Emits>()
</script>
