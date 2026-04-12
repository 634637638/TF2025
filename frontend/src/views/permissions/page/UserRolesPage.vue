<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          用户列表
          <span class="record-count">共 {{ ctx.filteredUsers.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th width="80">ID</th>
                <th width="150">用户名</th>
                <th width="200">姓名</th>
                <th width="300">角色</th>
                <th width="100">状态</th>
                <th width="160">最后登录</th>
                <th width="200">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="ctx.usersLoading" class="loading-row">
                <td colspan="7" class="text-center">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>加载中...</span>
                </td>
              </tr>
              <tr v-else-if="ctx.filteredUsers.length === 0" class="empty-row">
                <td colspan="7" class="text-center">
                  <i class="fas fa-inbox"></i>
                  <span>暂无用户数据 (总数: {{ ctx.usersData.length }}, 筛选后: {{ ctx.filteredUsers.length }})</span>
                </td>
              </tr>
              <tr v-else v-for="(user, index) in ctx.paginatedUsers" :key="user.id" class="user-row">
                <td class="user-id">
                  <span class="id-badge">{{ Number(ctx.usersPagination.total) - (Number(ctx.usersPagination.page) - 1) * Number(ctx.usersPagination.size) - Number(index) }}</span>
                </td>
                <td>
                  <div class="user-info">
                    <div class="user-username">
                      <i class="fas fa-user-circle"></i>
                      {{ user.username }}
                    </div>
                  </div>
                </td>
                <td>
                  <div class="user-name">{{ user.full_name || user.username || '-' }}</div>
                </td>
                <td>
                  <div class="user-roles">
                    <span
                      v-for="(roleName, index) in ctx.getUserRoleNames(user.roles)"
                      :key="index"
                      :class="['role-tag', ctx.getRoleTagClass(roleName)]"
                    >
                      {{ roleName }}
                    </span>
                    <span v-if="!user.roles || user.roles.length === 0" class="no-roles">
                      暂无角色
                    </span>
                  </div>
                </td>
                <td>
                  <span :class="['status-badge', user.status == 1 ? 'active' : 'inactive']">
                    <i :class="user.status == 1 ? 'fas fa-check' : 'fas fa-times'"></i>
                    {{ user.status == 1 ? '启用' : '禁用' }}
                  </span>
                </td>
                <td>
                  <div class="last-login">
                    <span v-if="user.last_login" :title="user.last_login">
                      {{ ctx.formatDate(user.last_login) }}
                    </span>
                    <span v-else class="never-login" :title="'last_login: ' + user.last_login">从未登录</span>
                  </div>
                </td>
                <td>
                  <div class="action-buttons">
                    <el-button type="primary" size="small" @click="ctx.handleEditUserRoles(user)" title="分配角色">
                      <i class="fas fa-user-tag"></i>
                      <span>分配角色</span>
                    </el-button>
                    <el-button type="danger" size="small" @click="ctx.handleDeleteUser(user)" title="删除用户">
                      <i class="fas fa-trash"></i>
                      <span>删除</span>
                    </el-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
