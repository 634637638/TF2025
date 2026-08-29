<template>
  <div class="table-section admin-panel admin-table-panel">
    <div class="section-title">
      <i class="fas fa-list" />
      角色列表
      <span class="record-count">共 {{ ctx.filteredRoles.length }} 条记录</span>
    </div>

    <div class="table-responsive">
      <el-table
        :data="ctx.rolesLoading ? [] : ctx.paginatedRoles"
        border
        stripe
        class="data-table devices-table compact-fit-table permissions-data-table"
        table-layout="fixed"
        :fit="true"
        row-key="id"
      >
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.id')"
          label="ID"
          width="64"
          align="center"
        >
          <template #default="{ $index }">
            <span class="id-badge">{{ Number(ctx.rolesPagination.total) - (Number(ctx.rolesPagination.page) - 1) * Number(ctx.rolesPagination.page_size) - Number($index) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.name')"
          label="角色名称"
          :min-width="getRoleColumnWidth('角色名称', ctx.paginatedRoles.map(row => row.name), 104, undefined, 36)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="role-name">
              <i class="fas fa-user-tag" />{{ row.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.code')"
          label="角色编码"
          :min-width="getRoleColumnWidth('角色编码', ctx.paginatedRoles.map(row => row.code || `role_${row.id}`), 112)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="role-code">
              <code>{{ row.code || `role_${row.id}` }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.description')"
          label="角色描述"
          :min-width="getRoleColumnWidth('角色描述', ctx.paginatedRoles.map(row => row.description || '暂无描述'), 132, 196)"
          align="center"
          class-name="complete-text-column wrapped-text-column"
        >
          <template #default="{ row }">
            <div class="role-description">
              {{ row.description || '暂无描述' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.status')"
          label="当前状态"
          min-width="92"
          align="center"
        >
          <template #default="{ row }">
            <span :class="['status-badge', 'status-display', row.is_active == '1' || row.is_active === true ? 'active' : 'inactive']"><i :class="row.is_active == '1' || row.is_active === true ? 'fas fa-check-circle' : 'fas fa-times-circle'" /><strong>{{ row.is_active == '1' || row.is_active === true ? '已启用' : '已禁用' }}</strong></span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.status') || ctx.canEdit"
          label="角色开关"
          min-width="96"
          align="center"
        >
          <template #default="{ row }">
              <button
                v-if="ctx.canEdit"
                :class="['status-badge', 'status-button', row.is_active == '1' || row.is_active === true ? 'active' : 'inactive']"
              :disabled="row.id === 1 || row.id === 9"
              :title="row.id === 1 || row.id === 9 ? '系统角色不能停用' : (row.is_active == '1' || row.is_active === true ? '点击停用角色' : '点击启用角色')"
              @click.stop="ctx.toggleRoleStatus(row)"
            >
              <i :class="row.is_active == '1' || row.is_active === true ? 'fas fa-pause' : 'fas fa-play'" />{{ row.is_active == '1' || row.is_active === true ? '停用' : '启用' }}
            </button>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.user_count')"
          label="用户数量"
          min-width="88"
          align="center"
        >
          <template #default="{ row }">
            <div class="user-count">
              <i class="fas fa-users" />{{ row.user_count || 0 }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('roles.created_at')"
          label="创建时间"
          :min-width="getRoleColumnWidth('创建时间', ctx.paginatedRoles.map(row => ctx.formatDate(row.created_at)), 108)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="create-time">
              {{ ctx.formatDate(row.created_at) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.showPermissionsActionField"
          label="操作"
          :width="roleActionColumnWidth"
          align="center"
          class-name="actions-column"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="ctx.canEdit"
                type="primary"
                size="small"
                title="编辑"
                @click.stop="ctx.handleEditRole(row)"
              >
                <i class="fas fa-edit" /><span>编辑</span>
              </el-button><el-button
                v-if="ctx.canEdit"
                type="info"
                size="small"
                title="页面权限"
                @click.stop="ctx.handleAssignPermissions(row)"
              >
                <i class="fas fa-lock" /><span>页面权限</span>
              </el-button><el-button
                v-if="ctx.canEdit"
                type="warning"
                size="small"
                title="字段权限"
                @click.stop="ctx.handleRoleFieldPermissions(row)"
              >
                <i class="fas fa-columns" /><span>字段权限</span>
              </el-button><el-button
                v-if="ctx.canDelete"
                type="danger"
                size="small"
                title="删除"
                :disabled="row.user_count > 0"
                @click.stop="ctx.handleDeleteRole(row)"
              >
                <i class="fas fa-trash" /><span>删除</span>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <TableLoadingRow
            v-if="ctx.rolesLoading"
            mode="block"
            text="加载角色列表..."
          />
          <DataEmptyState
            v-else
            description="暂无角色数据"
          />
        </template>
      </el-table>
    </div>

    <Pagination
      v-if="ctx.rolesPagination.total > 0"
      v-model:current="ctx.rolesPagination.page"
      v-model:page-size="ctx.rolesPagination.page_size"
      :total="ctx.rolesPagination.total"
      :page-sizes="[10, 20, 50, 100]"
      :show-total="true"
      :show-range="true"
      :show-page-sizes="true"
      :show-quick-jumper="true"
      :disabled="ctx.rolesLoading"
      @change="ctx.handleRolesPaginationChange"
    />
  </div>
</template>

<script setup lang="ts">
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { usePermissionsPageContext } from './context'
import { computed } from 'vue'
import { getActionColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'

const ctx = usePermissionsPageContext()
const getRoleColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number,
  maxWidth: number | undefined = undefined,
  horizontalPadding = 24
) => getTextColumnMinWidth([label, ...values], {
  minWidth,
  ...(maxWidth === undefined ? {} : { maxWidth }),
  horizontalPadding
})
const roleActionColumnWidth = computed(() => getActionColumnMinWidth(
  ['编辑', '页面权限', '字段权限', '删除']
))
</script>
