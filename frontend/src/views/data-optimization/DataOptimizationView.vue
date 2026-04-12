<template>
  <div class="data-optimization-view admin-page">
    <!-- 页面头部 - 使用全局组件 -->
    <PageHeader
      class="data-optimization-header"
      icon="fas fa-tools"
      title="优化数据"
    />

    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="data_optimization"
      module-name="数据优化"
      permission-code="data-check:view"
    />

    <!-- TAB 标签页 -->
    <div v-else class="optimization-tabs-wrapper admin-page-content">
      <el-tabs v-if="visibleOptimizationTabs.length" v-model="activeTab" class="optimization-tabs">
        <el-tab-pane
          v-for="tab in visibleOptimizationTabs"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        >
          <template #label>
            <span class="tab-label">
              <i :class="tab.icon"></i>
              <span>{{ tab.label }}</span>
            </span>
          </template>
          <component :is="tab.component" />
        </el-tab-pane>
      </el-tabs>
      <div v-else class="optimization-empty-state">
        当前角色未开启任何数据优化子页面字段，请在字段权限中开启对应页签。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { PageHeader, PermissionDenied } from '@/components/base'
import DataCheckTab from './page/DataCheckTab.vue'
import DataImportTab from './page/DataImportTab.vue'
import DatabaseSyncTab from './page/DatabaseSyncTab.vue'

const DATA_OPTIMIZATION_MODULE_KEY = 'data_optimization_dataoptimizationview'
const activeTab = ref('check')

// 权限检查 - 使用 usePagePermissions
const { canView } = usePagePermissions('data-optimization')

const optimizationTabs = [
  {
    key: 'check',
    label: '数据检查',
    icon: 'fas fa-database',
    component: DataCheckTab,
    accessField: 'check.tab_access',
    contentFields: [
      'check.action_check_all',
      'check.action_statistics',
      'check.check_cards',
      'check.all_data_table',
      'check.duplicates_list'
    ]
  },
  {
    key: 'import',
    label: '数据导入',
    icon: 'fas fa-file-import',
    component: DataImportTab,
    accessField: 'import.tab_access',
    contentFields: [
      'import.import_history',
      'import.upload_panel',
      'import.analysis_summary',
      'import.strategy_selection'
    ]
  },
  {
    key: 'database-sync',
    label: '远程数据同步',
    icon: 'fas fa-sync',
    component: DatabaseSyncTab,
    accessField: 'database_sync.tab_access',
    contentFields: [
      'database_sync.smart_sync_banner',
      'database_sync.step_navigation',
      'database_sync.connection_config',
      'database_sync.table_selection',
      'database_sync.field_mapping',
      'database_sync.sync_result'
    ]
  }
] as const

const canViewOptimizationField = (fieldKey: string) => {
  return fieldPermissions.isFieldVisible(DATA_OPTIMIZATION_MODULE_KEY, fieldKey)
}

const canViewAnyOptimizationField = (fieldKeys: readonly string[]) => {
  return fieldKeys.some(fieldKey => canViewOptimizationField(fieldKey))
}

const visibleOptimizationTabs = computed(() => {
  return optimizationTabs.filter(tab => (
    canViewOptimizationField(tab.accessField) &&
    canViewAnyOptimizationField(tab.contentFields)
  ))
})

watch(visibleOptimizationTabs, (tabs) => {
  if (!tabs.length) {
    activeTab.value = ''
    return
  }

  if (!tabs.some(tab => tab.key === activeTab.value)) {
    activeTab.value = tabs[0].key
  }
}, { immediate: true })

onMounted(async () => {
  if (!canView.value) {
    return
  }

  await fieldPermissions.init()
})
</script>

<style lang="scss" scoped>
.data-optimization-view {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}

/* 数据优化页面专用 - 深色渐变页头 */
.data-optimization-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  padding: 32px 2rem !important;
}

.optimization-tabs {
  :deep(.el-tabs__header) {
    background: white;
    border-radius: 8px 8px 0 0;
    padding: 0 20px;
    margin: 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    height: 60px;
    line-height: 60px;
    font-size: 16px;
    color: #606266;

    &.is-active {
      color: #409eff;
      font-weight: 600;
    }
  }

  :deep(.el-tabs__active-bar) {
    height: 3px;
    background: #409eff;
  }

  :deep(.el-tabs__content) {
    background: white;
    border-radius: 0 0 8px 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .tab-label {
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      font-size: 18px;
    }
  }
}

.optimization-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  color: #606266;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
</style>
