<template>
  <div class="table-section admin-panel admin-table-panel">
    <div class="section-title">
      <i class="fas fa-list" />
      用户列表
      <span class="record-count">共 {{ ctx.usersPagination.total }} 条</span>
    </div>

    <div class="table-responsive">
      <el-table
        v-table-double-tap="mobileDetailTapOptions"
        v-tf-loading="{ active: ctx.usersLoading, text: '正在刷新用户角色列表...' }"
        :data="ctx.paginatedUsers"
        border
        stripe
        class="data-table devices-table compact-fit-table permissions-data-table"
        table-layout="fixed"
        :fit="true"
        row-key="id"
        @row-dblclick="mobileDetailDoubleClick"
      >
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.id')"
          label="序号"
          :width="$getNumberColumnWidth((ctx.paginatedUsers || []).map((_row, $index) => Number(ctx.usersPagination.total) - (Number(ctx.usersPagination.page) - 1) * Number(ctx.usersPagination.page_size) - Number($index)), 64)"
          align="center"
        >
          <template #default="{ $index }">
            <span class="table-number-badge">{{ Number(ctx.usersPagination.total) - (Number(ctx.usersPagination.page) - 1) * Number(ctx.usersPagination.page_size) - Number($index) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.username')"
          label="用户名"
          :min-width="getUserColumnWidth('用户名', ctx.paginatedUsers.map(row => row.username), 96, 168, 36)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="user-username">
              <i class="fas fa-user-circle" />{{ row.username }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.full_name')"
          label="姓名"
          :min-width="getUserColumnWidth('姓名', ctx.paginatedUsers.map(row => row.full_name || row.username || '-'), 88, 156)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="user-name">
              {{ row.full_name || row.username || '-' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.roles')"
          label="角色"
          :min-width="getUserColumnWidth('角色', ctx.paginatedUsers.map(row => ctx.getUserRoleNames(row.roles).join(' ')), 112, 208, 36)"
          align="center"
          class-name="complete-text-column wrapped-text-column"
        >
          <template #default="{ row }">
            <div class="user-roles">
              <span
                v-for="(roleName, index) in ctx.getUserRoleNames(row.roles)"
                :key="index"
                :class="['role-tag', ctx.getRoleTagClass(roleName)]"
              >{{ roleName }}</span><span
                v-if="!row.roles || row.roles.length === 0"
                class="no-roles"
              >暂无角色</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.status')"
          label="状态"
          min-width="82"
          align="center"
        >
          <template #default="{ row }">
            <span :class="['status-badge', row.status == 1 ? 'active' : 'inactive']"><i :class="row.status == 1 ? 'fas fa-check' : 'fas fa-times'" />{{ row.status == 1 ? '启用' : '禁用' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="ctx.canViewPermissionsField('users.last_login')"
          label="最后登录"
          :min-width="getUserColumnWidth('最后登录', ctx.paginatedUsers.map(row => row.last_login ? ctx.formatDate(row.last_login) : '从未登录'), 108, 184)"
          align="center"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <div class="last-login">
              <span
                v-if="row.last_login"
                :title="row.last_login"
              >{{ ctx.formatDate(row.last_login) }}</span><span
                v-else
                class="never-login"
              >从未登录</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="!isMobile && (ctx.showPermissionsActionField)"
          label="操作"
          :width="$getActionColumnWidth(['分配角色', '删除'])"
          align="center"
          class-name="actions-column"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="ctx.canEdit"
                type="primary"
                title="分配角色"
                @click.stop="ctx.handleEditUserRoles(row)"
              >
                <i class="fas fa-user-tag" /><span>分配角色</span>
              </el-button><el-button
                v-if="ctx.canDelete"
                type="danger"
                title="删除用户"
                @click.stop="ctx.handleDeleteUser(row)"
              >
                <i class="fas fa-trash" /><span>删除</span>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <TableLoadingRow
            v-if="ctx.usersLoading"
            mode="block"
            text="加载用户列表..."
          />
          <DataEmptyState
            v-else
            description="暂无用户数据"
          />
        </template>
      </el-table>
      <RecordDetailDialog
        v-model="mobileDetailVisible"
        title="用户角色详情"
        :record="mobileDetailRow"
        :fields="mobileDetailFields"
        :has-actions="ctx.canEdit || ctx.canDelete"
      >
        <template #actions="{ row }">
          <el-button
            v-if="ctx.canEdit"
            type="primary"
            title="分配角色"
            @click.stop="mobileDetailRunAction(() => ctx.handleEditUserRoles(row))"
          >
            <i class="fas fa-user-tag" /><span>分配角色</span>
          </el-button><el-button
            v-if="ctx.canDelete"
            type="danger"
            title="删除用户"
            @click.stop="mobileDetailRunAction(() => ctx.handleDeleteUser(row))"
          >
            <i class="fas fa-trash" /><span>删除</span>
          </el-button>
        </template>
      </RecordDetailDialog>
    </div>

    <Pagination
      v-if="ctx.usersPagination.total > 0"
      v-model:current="ctx.usersPagination.page"
      v-model:page-size="ctx.usersPagination.page_size"
      :total="ctx.usersPagination.total"
      :page-sizes="[10, 20, 50, 100]"
      :show-total="true"
      :show-range="true"
      :show-page-sizes="true"
      :show-quick-jumper="true"
      :disabled="ctx.usersLoading"
      @change="ctx.handleUsersPaginationChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import type { PermissionUser } from '../types'
import { usePermissionsPageContext } from './context'
import { getTextColumnMinWidth } from '@/utils/table-layout'

const ctx = usePermissionsPageContext()
const getUserColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number,
  maxWidth: number,
  horizontalPadding = 24
) => getTextColumnMinWidth([label, ...values], { minWidth, maxWidth, horizontalPadding })

const { isMobile } = useMobile()
const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions, handleRowDoubleClick: mobileDetailDoubleClick, runDetailAction: mobileDetailRunAction } = useMobileTableDetail<PermissionUser>({
  enabled: () => isMobile.value, rows: () => ctx.paginatedUsers, getKey: row => row.id
})
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'username', label: '用户名', value: row.username, visible: ctx.canViewPermissionsField('users.username') },
    { key: 'full_name', label: '姓名', value: row.full_name || row.username, visible: ctx.canViewPermissionsField('users.full_name') },
    { key: 'roles', label: '角色', value: ctx.getUserRoleNames(row.roles).join('、'), visible: ctx.canViewPermissionsField('users.roles'), wide: true },
    { key: 'status', label: '状态', value: row.status === 1 ? '启用' : '禁用', visible: ctx.canViewPermissionsField('users.status') },
    { key: 'last_login', label: '最后登录', value: ctx.formatDate(row.last_login), visible: ctx.canViewPermissionsField('users.last_login'), wide: true }
  ]
})

</script>
