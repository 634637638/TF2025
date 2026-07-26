<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          用户列表
          <span class="record-count">共 {{ ctx.filteredUsers.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <el-table :data="ctx.usersLoading ? [] : ctx.paginatedUsers" border stripe class="data-table devices-table permissions-data-table" table-layout="fixed" :fit="true" row-key="id">
            <el-table-column label="ID" width="80" align="center"><template #default="{ $index }"><span class="id-badge">{{ Number(ctx.usersPagination.total) - (Number(ctx.usersPagination.page) - 1) * Number(ctx.usersPagination.size) - Number($index) }}</span></template></el-table-column>
            <el-table-column label="用户名" min-width="140" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="user-username"><i class="fas fa-user-circle"></i>{{ row.username }}</div></template></el-table-column>
            <el-table-column label="姓名" min-width="140" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="user-name">{{ row.full_name || row.username || '-' }}</div></template></el-table-column>
            <el-table-column label="角色" min-width="240" align="center"><template #default="{ row }"><div class="user-roles"><span v-for="(roleName, index) in ctx.getUserRoleNames(row.roles)" :key="index" :class="['role-tag', ctx.getRoleTagClass(roleName)]">{{ roleName }}</span><span v-if="!row.roles || row.roles.length === 0" class="no-roles">暂无角色</span></div></template></el-table-column>
            <el-table-column label="状态" min-width="90" align="center"><template #default="{ row }"><span :class="['status-badge', row.status == 1 ? 'active' : 'inactive']"><i :class="row.status == 1 ? 'fas fa-check' : 'fas fa-times'"></i>{{ row.status == 1 ? '启用' : '禁用' }}</span></template></el-table-column>
            <el-table-column label="最后登录" min-width="156" align="center" class-name="complete-text-column"><template #default="{ row }"><div class="last-login"><span v-if="row.last_login" :title="row.last_login">{{ ctx.formatDate(row.last_login) }}</span><span v-else class="never-login">从未登录</span></div></template></el-table-column>
            <el-table-column label="操作" min-width="190" align="center" class-name="actions-column"><template #default="{ row }"><div class="action-buttons"><el-button type="primary" size="small" title="分配角色" @click.stop="ctx.handleEditUserRoles(row)"><i class="fas fa-user-tag"></i><span>分配角色</span></el-button><el-button type="danger" size="small" title="删除用户" @click.stop="ctx.handleDeleteUser(row)"><i class="fas fa-trash"></i><span>删除</span></el-button></div></template></el-table-column>
            <template #empty><TableLoadingRow v-if="ctx.usersLoading" mode="block" text="加载用户列表..." /><div v-else class="empty-state"><i class="fas fa-inbox"></i><span>暂无用户数据</span></div></template>
          </el-table>
        </div>

        <Pagination
          v-if="ctx.usersPagination.total > 0"
          v-model:current="ctx.usersPagination.page"
          v-model:page-size="ctx.usersPagination.size"
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
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
