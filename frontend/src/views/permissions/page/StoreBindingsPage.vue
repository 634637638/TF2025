<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          员工门店绑定列表
          <span class="record-count">共 {{ ctx.filteredStoreBindings.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <el-table :data="ctx.storeBindingsLoading ? [] : ctx.paginatedStoreBindings" border stripe class="data-table devices-table compact-fit-table permissions-data-table" table-layout="fixed" :fit="true" row-key="id">
            <el-table-column label="序号" width="64" align="center"><template #default="{ $index }">{{ (Number(ctx.storeBindingsPagination.page) - 1) * Number(ctx.storeBindingsPagination.size) + Number($index) + 1 }}</template></el-table-column>
            <el-table-column prop="username" label="用户名" :min-width="getStoreColumnWidth('用户名', ctx.paginatedStoreBindings.map(row => row.username), 96, 168)" align="center" class-name="complete-text-column" />
            <el-table-column label="真实姓名" :min-width="getStoreColumnWidth('真实姓名', ctx.paginatedStoreBindings.map(row => row.name || '-'), 96, 156)" align="center" class-name="complete-text-column"><template #default="{ row }">{{ row.name || '-' }}</template></el-table-column>
            <el-table-column label="角色" :min-width="getStoreColumnWidth('角色', ctx.paginatedStoreBindings.map(row => ctx.getUserRoleNames(row.roles).join(' ')), 112, 188, 36)" align="center" class-name="complete-text-column wrapped-text-column"><template #default="{ row }"><div class="user-roles"><span v-for="(roleName, index) in ctx.getUserRoleNames(row.roles)" :key="index" :class="['role-tag', ctx.getRoleTagClass(roleName)]">{{ roleName }}</span><span v-if="!row.roles || row.roles === ''" class="no-roles">无角色</span></div></template></el-table-column>
            <el-table-column label="当前门店" :min-width="getStoreColumnWidth('当前门店', ctx.paginatedStoreBindings.map(getStoreNames), 112, 196, 36)" align="center" class-name="complete-text-column wrapped-text-column"><template #default="{ row }"><span v-if="row.stores && row.stores.length > 0" class="stores-cell"><span v-for="store in row.stores" :key="store.store_id" class="store-badge-small">{{ store.store_name }}{{ store.is_primary ? ' (主)' : '' }}</span></span><span v-else class="text-muted">未绑定</span></template></el-table-column>
            <el-table-column label="绑定状态" :min-width="getStoreColumnWidth('绑定状态', ctx.paginatedStoreBindings.map(row => row.stores?.length ? `已绑定 ${row.stores.length} 个门店` : '未绑定'), 112, 144, 36)" align="center"><template #default="{ row }"><span v-if="row.stores && row.stores.length > 0" class="store-status-badge store-status-bound"><i class="fas fa-store"></i>已绑定 {{ row.stores.length }} 个门店</span><span v-else class="store-status-badge store-status-unbound"><i class="fas fa-store-slash"></i>未绑定</span></template></el-table-column>
            <el-table-column label="操作" :width="storeBindingActionColumnWidth" align="center" class-name="actions-column"><template #default="{ row }"><div class="action-buttons"><el-button type="primary" size="small" title="管理门店" @click.stop="ctx.openStoreBindingDialog(row)"><i class="fas fa-link"></i><span>{{ row.stores && row.stores.length > 0 ? '管理门店' : '绑定门店' }}</span></el-button><el-button v-if="row.stores && row.stores.length > 0" type="danger" size="small" title="解绑所有门店" @click.stop="ctx.unbindStore(row)"><i class="fas fa-unlink"></i><span>解绑</span></el-button></div></template></el-table-column>
            <template #empty><TableLoadingRow v-if="ctx.storeBindingsLoading" mode="block" text="加载门店绑定列表..." /><div v-else class="empty-state"><i class="fas fa-inbox"></i><span>暂无数据</span></div></template>
          </el-table>
        </div>

        <Pagination
          v-if="ctx.storeBindingsPagination.total > 0"
          v-model:current="ctx.storeBindingsPagination.page"
          v-model:page-size="ctx.storeBindingsPagination.size"
          :total="ctx.storeBindingsPagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="ctx.storeBindingsLoading"
          @change="ctx.handleStoreBindingsPaginationChange"
        />
  </div>
</template>

<script setup lang="ts">
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { usePermissionsPageContext } from './context'
import { computed } from 'vue'
import { getAdaptiveActionColumnWidth, getTextColumnMinWidth } from '@/utils/table-layout'

const ctx = usePermissionsPageContext()
const getStoreNames = (row: (typeof ctx.paginatedStoreBindings)[number]) => (
  row.stores?.length
    ? row.stores.map(store => `${store.store_name}${store.is_primary ? ' (主)' : ''}`).join(' ')
    : '未绑定'
)
const getStoreColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number,
  maxWidth: number,
  horizontalPadding = 24
) => getTextColumnMinWidth([label, ...values], { minWidth, maxWidth, horizontalPadding })
const storeBindingActionColumnWidth = computed(() => (
  getAdaptiveActionColumnWidth(ctx.paginatedStoreBindings, [
    {
      label: row => row.stores?.length ? '管理门店' : '绑定门店',
      visible: true
    },
    {
      label: '解绑',
      visible: row => Boolean(row.stores?.length)
    }
  ])
))
</script>
