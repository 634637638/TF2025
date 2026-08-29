<template>
  <PageHeader
    icon="fas fa-money-bill-wave"
    title="工资管理"
  >
    <template #actions>
      <el-button
        v-if="activeTab === 'templates' && canCreateSalaryTemplate"
        type="primary"
        @click="emit('add-template')"
      >
        <i class="fas fa-plus" />
        <span>新增</span>
      </el-button>
      <el-button
        v-if="activeTab === 'payout' && canViewSalaryRecords"
        type="warning"
        :disabled="payoutLoading"
        @click="emit('bulk-recalculate')"
      >
        <i class="fas fa-sync-alt" />
        <span>批量重算</span>
      </el-button>
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
import { PageHeader } from '@/components/base'

defineProps<{
  activeTab: string
  canCreateSalaryTemplate: boolean
  canViewSalaryRecords: boolean
  payoutLoading: boolean
  refreshing: boolean
}>()

const emit = defineEmits<{
  'add-template': []
  'bulk-recalculate': []
  refresh: []
}>()
</script>
