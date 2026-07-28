<template>
  <div class="table-section admin-panel admin-table-panel">
    <div class="section-title">
      <i class="fas fa-list"></i>
      操作日志
      <span class="record-count">共 {{ ctx.logsPagination.total }} 条记录</span>
    </div>

    <div class="table-responsive">
      <el-table :data="ctx.logsLoading ? [] : ctx.paginatedLogs" border stripe class="data-table devices-table compact-fit-table permissions-data-table" table-layout="fixed" :fit="true" row-key="id">
        <el-table-column label="ID" width="64" align="center"><template #default="{ $index }"><span class="id-badge">{{ Number(ctx.logsPagination.total) - (Number(ctx.logsPagination.page) - 1) * Number(ctx.logsPagination.size) - Number($index) }}</span></template></el-table-column>
        <el-table-column label="操作类型" :min-width="getLogColumnWidth('操作类型', ctx.paginatedLogs.map(row => ctx.getActionName(row.action)), 104, 152, 36)" align="center"><template #default="{ row }"><span :class="['action-tag', ctx.getActionTypeClass(row.action)]"><i :class="ctx.getActionIcon(row.action)"></i>{{ ctx.getActionName(row.action) }}</span></template></el-table-column>
        <el-table-column label="操作用户" :min-width="getLogColumnWidth('操作用户', ctx.paginatedLogs.map(row => row.username), 104, 168, 36)" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="user-username"><i class="fas fa-user-circle"></i>{{ row.username }}</div></template></el-table-column>
        <el-table-column label="操作描述" :min-width="getLogColumnWidth('操作描述', ctx.paginatedLogs.map(row => row.description), 188, 280, 104)" align="center" class-name="complete-text-column wrapped-text-column">
          <template #default="{ row }">
            <div class="log-description-cell">
              <span class="log-description">{{ row.description }}</span>
              <el-button
                class="table-action table-action--view"
                @click.stop="openLogDetails(row)"
              >
                查看详情
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="IP地址" :min-width="getLogColumnWidth('IP地址', ctx.paginatedLogs.map(row => row.ip_address), 104, 148)" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="ip-address">{{ row.ip_address }}</div></template></el-table-column>
        <el-table-column label="操作时间" :min-width="getLogColumnWidth('操作时间', ctx.paginatedLogs.map(row => ctx.formatDate(row.created_at)), 108, 184)" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="create-time">{{ ctx.formatDate(row.created_at) }}</div></template></el-table-column>
        <el-table-column label="状态" width="82" align="center"><template #default="{ row }"><span :class="['status-badge', row.status === 'success' ? 'success' : 'error']"><i :class="row.status === 'success' ? 'fas fa-check' : 'fas fa-times'"></i>{{ row.status === 'success' ? '成功' : '失败' }}</span></template></el-table-column>
        <template #empty><TableLoadingRow v-if="ctx.logsLoading" mode="block" text="加载权限日志..." /><div v-else class="empty-state"><i class="fas fa-inbox"></i><span>暂无日志数据</span></div></template>
      </el-table>
    </div>

    <Pagination
      v-if="ctx.logsPagination.total > 0"
      v-model:current="ctx.logsPagination.page"
      v-model:page-size="ctx.logsPagination.size"
      :total="ctx.logsPagination.total"
      :page-sizes="[10, 20, 50, 100]"
      :show-total="true"
      :show-range="true"
      :show-page-sizes="true"
      :show-quick-jumper="true"
      :disabled="ctx.logsLoading"
      @change="ctx.handleLogsPaginationChange"
    />

    <MobileDialog
      v-model="detailVisible"
      title="权限操作详细记录"
      width="860px"
      dialog-class="permissions-log-detail-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="selectedLog" class="permission-log-detail">
        <div class="permission-log-summary">
          <div><span>操作用户</span><strong>{{ selectedLog.username }}</strong></div>
          <div><span>操作时间</span><strong>{{ ctx.formatDate(selectedLog.created_at) }}</strong></div>
          <div><span>操作对象</span><strong>{{ selectedLog.target_name || selectedLog.target_type || '未标明' }}</strong></div>
          <div><span>IP 地址</span><strong>{{ selectedLog.ip_address || '未记录' }}</strong></div>
        </div>

        <section class="permission-log-section">
          <h4>操作说明</h4>
          <p class="permission-log-description">{{ selectedLog.description }}</p>
        </section>

        <section v-if="moduleChanges.length" class="permission-log-section">
          <div class="permission-log-section-heading">
            <h4>模块权限变更</h4>
            <span>共 {{ moduleChanges.length }} 个模块</span>
          </div>
          <div class="permission-module-change-list">
            <div v-for="module in moduleChanges" :key="module.module_key" class="permission-module-change">
              <div class="permission-module-name">
                <strong>{{ module.module_name || module.module_key }}</strong>
              </div>
              <div class="permission-change-actions">
                <span
                  v-for="permission in module.added_permissions"
                  :key="`added-${permission}`"
                  class="is-added"
                >{{ formatPermissionChange(permission, 'added') }}</span>
                <span
                  v-for="permission in module.removed_permissions"
                  :key="`removed-${permission}`"
                  class="is-removed"
                >{{ formatPermissionChange(permission, 'removed') }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="legacyPermissionGroups.length" class="permission-log-section">
          <div class="permission-log-section-heading">
            <h4>保存后的权限</h4>
            <span>历史日志未保存前后差异</span>
          </div>
          <div class="permission-module-change-list">
            <div v-for="module in legacyPermissionGroups" :key="module.module_key" class="permission-module-change">
              <div class="permission-module-name">
                <strong>{{ module.module_name || module.module_key }}</strong>
              </div>
              <div class="permission-change-actions">
                <span v-for="permission in module.permissions" :key="permission" class="is-current">已有{{ permissionLabel(permission) }}权限</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="roleChanges.length" class="permission-log-section">
          <h4>角色分配变更</h4>
          <div class="permission-change-groups">
            <div v-for="group in roleChanges" :key="group.label" :class="['permission-change-group', group.tone]">
              <span>{{ group.label }}</span>
              <div><strong v-for="item in group.items" :key="String(item.id)">{{ item.name }}</strong></div>
            </div>
          </div>
        </section>

        <section v-if="storeChanges.length" class="permission-log-section">
          <h4>门店绑定变更</h4>
          <div class="permission-change-groups">
            <div v-for="group in storeChanges" :key="group.label" :class="['permission-change-group', group.tone]">
              <span>{{ group.label }}</span>
              <div><strong v-for="item in group.items" :key="String(item.store_id)">{{ item.store_name }}</strong></div>
            </div>
          </div>
        </section>

        <section v-if="moduleOperationRows.length" class="permission-log-section">
          <h4>模块操作结果</h4>
          <div class="permission-module-operation-list">
            <div v-for="(item, index) in moduleOperationRows" :key="`${item.module_key}-${index}`">
              <code>{{ item.module_key || '未知模块' }}</code>
              <span>{{ moduleActionLabel(item.action) }}</span>
              <strong :class="item.success === false ? 'is-error' : 'is-success'">{{ item.success === false ? '失败' : '成功' }}</strong>
            </div>
          </div>
        </section>

        <section v-if="genericDetailItems.length" class="permission-log-section">
          <h4>记录信息</h4>
          <dl class="permission-log-fields">
            <template v-for="item in genericDetailItems" :key="item.key">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </template>
          </dl>
        </section>
      </div>

      <template #footer>
        <div class="tf-dialog-actions">
          <el-button type="primary" @click="detailVisible = false">关闭</el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import type { PermissionLog } from '@/types/system'
import { usePermissionsPageContext } from './context'
import { getTextColumnMinWidth } from '@/utils/table-layout'

type DetailRecord = Record<string, any>

const ctx = usePermissionsPageContext()
const getLogColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number,
  maxWidth: number,
  horizontalPadding = 24
) => getTextColumnMinWidth([label, ...values], { minWidth, maxWidth, horizontalPadding })
const detailVisible = ref(false)
const selectedLog = ref<PermissionLog | null>(null)

const parseDetails = (details: PermissionLog['details']): DetailRecord => {
  if (!details) return {}
  if (typeof details === 'object') return details as DetailRecord
  try {
    const parsed = JSON.parse(details)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return { raw_details: details }
  }
}

const currentDetails = computed(() => parseDetails(selectedLog.value?.details))
const isMenuAudit = computed(() => currentDetails.value.audit_type === 'role_menu_permissions')
const isFieldAudit = computed(() => currentDetails.value.audit_type === 'role_field_permissions')
const isPermissionChangeAudit = computed(() => [
  'role_action_permissions',
  'role_menu_permissions',
  'role_field_permissions'
].includes(currentDetails.value.audit_type))

const openLogDetails = (row: PermissionLog) => {
  selectedLog.value = row
  detailVisible.value = true
}

const moduleChanges = computed(() => {
  const changes = currentDetails.value.module_changes
  if (!Array.isArray(changes)) return []
  return changes.map((item) => ({
    module_key: item.module_key || 'unknown',
    module_name: item.module_name || item.module_key || '未知模块',
    added_permissions: Array.isArray(item.added_permissions) ? item.added_permissions : [],
    removed_permissions: Array.isArray(item.removed_permissions) ? item.removed_permissions : []
  }))
})

const legacyPermissionGroups = computed(() => {
  if (moduleChanges.value.length) return []
  const permissions = currentDetails.value.permissions
  if (!Array.isArray(permissions)) return []
  const groups = new Map<string, { module_key: string; module_name: string; permissions: string[] }>()
  permissions.forEach((permission) => {
    const moduleKey = permission.module_key || permission.moduleKey
    const permissionType = permission.permission_type || permission.permissionType
    if (!moduleKey || !permissionType) return
    if (!groups.has(moduleKey)) {
      groups.set(moduleKey, {
        module_key: moduleKey,
        module_name: permission.module_name || moduleKey,
        permissions: []
      })
    }
    groups.get(moduleKey)?.permissions.push(permissionType)
  })
  return Array.from(groups.values())
})

const roleChanges = computed(() => {
  const groups = []
  if (Array.isArray(currentDetails.value.added_roles) && currentDetails.value.added_roles.length) {
    groups.push({ label: '新增角色', tone: 'is-added', items: currentDetails.value.added_roles })
  }
  if (Array.isArray(currentDetails.value.removed_roles) && currentDetails.value.removed_roles.length) {
    groups.push({ label: '移除角色', tone: 'is-removed', items: currentDetails.value.removed_roles })
  }
  return groups
})

const storeChanges = computed(() => {
  const groups = []
  if (Array.isArray(currentDetails.value.added_stores) && currentDetails.value.added_stores.length) {
    groups.push({ label: '新增门店', tone: 'is-added', items: currentDetails.value.added_stores })
  }
  if (Array.isArray(currentDetails.value.removed_stores) && currentDetails.value.removed_stores.length) {
    groups.push({ label: '移除门店', tone: 'is-removed', items: currentDetails.value.removed_stores })
  }
  if (
    currentDetails.value.primary_store &&
    currentDetails.value.previous_primary_store?.store_id !== currentDetails.value.primary_store.store_id
  ) {
    groups.push({ label: '设置主门店', tone: 'is-added', items: [currentDetails.value.primary_store] })
  }
  return groups
})

const moduleOperationRows = computed(() => (
  Array.isArray(currentDetails.value.modules) ? currentDetails.value.modules : []
))

const detailLabelMap: Record<string, string> = {
  audit_type: '记录类型',
  module_key: '模块 KEY',
  module_name: '模块名称',
  previous_name: '原名称',
  name: '新名称',
  category: '模块分类',
  status_action: '状态操作',
  previous_is_active: '原状态',
  is_active: '当前状态',
  affected_users: '影响用户数',
  permissions_count: '当前权限数',
  previous_permissions_count: '原权限数',
  added_count: '新增数量',
  removed_count: '移除数量',
  affected_modules_count: '涉及模块数',
  batch_action: '批量操作',
  total: '扫描总数',
  success_count: '成功数量',
  error_count: '失败数量',
  deleted_count: '清理数量',
  primary_store_id: '主门店 ID',
  raw_details: '原始详情'
}

const hiddenGenericKeys = new Set([
  'audit_type', 'permissions_count', 'previous_permissions_count', 'added_count', 'removed_count',
  'affected_modules_count',
  'permissions', 'previous_permissions', 'added_permissions', 'removed_permissions', 'module_changes',
  'role_ids', 'role_names', 'previous_role_ids', 'previous_role_names', 'added_roles', 'removed_roles',
  'stores', 'previous_stores', 'added_stores', 'removed_stores', 'previous_primary_store', 'primary_store',
  'modules', 'previous', 'current'
])

const formatDetailValue = (key: string, value: unknown) => {
  if (key.endsWith('is_active')) return Number(value) === 1 ? '已启用' : '已禁用'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (value === null || value === undefined || value === '') return '无'
  return String(value)
}

const genericDetailItems = computed(() => {
  if (isPermissionChangeAudit.value) return []
  return Object.entries(currentDetails.value)
    .filter(([key, value]) => !hiddenGenericKeys.has(key) && !Array.isArray(value) && typeof value !== 'object')
    .map(([key, value]) => ({
      key,
      label: detailLabelMap[key] || key,
      value: formatDetailValue(key, value)
    }))
})

const permissionLabel = (permission: string) => (
  permission === 'menu_view' ? '菜单显示' : ctx.getPermissionNameEnhanced(permission)
)

const formatPermissionChange = (permission: string, change: 'added' | 'removed') => {
  if (isFieldAudit.value) {
    return `${change === 'added' ? '隐藏字段' : '恢复显示字段'} ${permissionLabel(permission)}`
  }
  if (isMenuAudit.value) {
    return change === 'added' ? '开启菜单显示' : '关闭菜单显示'
  }
  return `${change === 'added' ? '开启' : '关闭'}${permissionLabel(permission)}权限`
}

const moduleActionLabel = (action: string) => ({
  registered_or_updated: '注册或更新',
  deleted: '清理',
  failed: '同步失败'
}[action] || action || '处理')
</script>

<style>
.log-description-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.log-description-cell .log-description {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}

.permission-log-detail {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-width: 0;
}

.permission-log-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid #dbe3ee;
  border-radius: 6px;
  background: #dbe3ee;
}

.permission-log-summary > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  background: #f8fafc;
}

.permission-log-summary span,
.permission-log-section-heading span {
  color: #64748b;
  font-size: 12px;
}

.permission-log-summary strong {
  color: #172033;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.permission-log-section {
  min-width: 0;
}

.permission-log-section h4 {
  margin: 0 0 12px;
  color: #172033;
  font-size: 15px;
}

.permission-log-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.permission-log-section-heading h4 {
  margin: 0;
}

.permission-log-description {
  margin: 0;
  padding: 12px 14px;
  color: #334155;
  line-height: 1.7;
  overflow-wrap: anywhere;
  border-left: 3px solid #2563eb;
  background: #f8fafc;
}

.permission-module-change-list {
  border-top: 1px solid #dbe3ee;
}

.permission-module-change {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 11px 4px;
  border-bottom: 1px solid #dbe3ee;
}

.permission-module-name {
  min-width: 0;
}

.permission-module-name strong {
  color: #172033;
  overflow-wrap: anywhere;
}

.permission-module-operation-list code {
  color: #64748b;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.permission-change-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.permission-change-actions span,
.permission-change-group strong {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.permission-change-actions .is-added,
.permission-change-group.is-added strong {
  color: #166534;
  background: #dcfce7;
}

.permission-change-actions .is-removed,
.permission-change-group.is-removed strong {
  color: #b42318;
  background: #fee4e2;
}

.permission-change-actions .is-current {
  color: #1d4ed8;
  background: #dbeafe;
}

.permission-change-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.permission-change-group {
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe3ee;
  border-radius: 6px;
}

.permission-change-group > span {
  display: block;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.permission-change-group > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.permission-module-operation-list {
  border-top: 1px solid #e2e8f0;
}

.permission-module-operation-list > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 48px;
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 9px 0;
  border-bottom: 1px solid #e2e8f0;
}

.permission-module-operation-list .is-success {
  color: #15803d;
}

.permission-module-operation-list .is-error {
  color: #b42318;
}

.permission-log-fields {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  margin: 0;
  border-top: 1px solid #e2e8f0;
}

.permission-log-fields dt,
.permission-log-fields dd {
  min-width: 0;
  margin: 0;
  padding: 9px 10px;
  border-bottom: 1px solid #e2e8f0;
  overflow-wrap: anywhere;
}

.permission-log-fields dt {
  color: #64748b;
  background: #f8fafc;
}

.permission-log-fields dd {
  color: #172033;
}

@media (max-width: 768px) {
  .log-description-cell {
    align-items: flex-start;
  }

  .permission-log-summary,
  .permission-change-groups {
    grid-template-columns: 1fr;
  }

  .permission-log-summary {
    gap: 0;
    background: #f8fafc;
  }

  .permission-log-summary > div + div {
    border-top: 1px solid #dbe3ee;
  }

  .permission-log-section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .permission-log-fields {
    grid-template-columns: 96px minmax(0, 1fr);
    font-size: 12px;
  }

  .permission-module-change {
    grid-template-columns: minmax(86px, 112px) minmax(0, 1fr);
    gap: 8px;
  }

  .permission-change-actions span {
    min-height: 24px;
    padding: 2px 6px;
    font-size: 11px;
  }
}
</style>
