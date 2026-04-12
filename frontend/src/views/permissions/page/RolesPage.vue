<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          角色列表
          <span class="record-count">共 {{ ctx.filteredRoles.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th width="80">ID</th>
                <th width="220">角色名称</th>
                <th width="180">角色编码</th>
                <th width="260">角色描述</th>
                <th width="100">当前状态</th>
                <th width="120">角色开关</th>
                <th width="120">用户数量</th>
                <th width="160">创建时间</th>
                <th width="80">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="ctx.rolesLoading" class="loading-row">
                <td colspan="9" class="text-center">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>加载中...</span>
                </td>
              </tr>
              <tr v-else-if="ctx.filteredRoles.length === 0" class="empty-row">
                <td colspan="9" class="text-center">
                  <i class="fas fa-inbox"></i>
                  <span>暂无角色数据</span>
                </td>
              </tr>
              <tr v-else v-for="(role, index) in ctx.paginatedRoles" :key="role.id" class="role-row">
                <td class="role-id">
                  <span class="id-badge">{{ Number(ctx.rolesPagination.total) - (Number(ctx.rolesPagination.page) - 1) * Number(ctx.rolesPagination.size) - Number(index) }}</span>
                </td>
                <td>
                  <div class="role-info">
                    <div class="role-name">
                      <i class="fas fa-user-tag"></i>
                      {{ role.name }}
                    </div>
                  </div>
                </td>
                <td>
                  <div class="role-code">
                    <code>{{ role.code || `role_${role.id}` }}</code>
                  </div>
                </td>
                <td>
                  <div class="role-description">
                    {{ role.description || '暂无描述' }}
                  </div>
                </td>
                <td>
                  <span :class="['status-badge', 'status-display', role.is_active == '1' || role.is_active === true ? 'active' : 'inactive']">
                    <i :class="role.is_active == '1' || role.is_active === true ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
                    <strong>{{ role.is_active == '1' || role.is_active === true ? '已启用' : '已禁用' }}</strong>
                  </span>
                </td>
                <td>
                  <button
                    :class="['status-badge', 'status-button', role.is_active == '1' || role.is_active === true ? 'active' : 'inactive']"
                    @click="ctx.toggleRoleStatus(role)"
                    :disabled="role.id === 1 || role.id === 9"
                    :title="role.id === 1 || role.id === 9 ? '系统角色不能停用' : (role.is_active == '1' || role.is_active === true ? '点击停用角色' : '点击启用角色')"
                  >
                    <i :class="role.is_active == '1' || role.is_active === true ? 'fas fa-pause' : 'fas fa-play'"></i>
                    {{ role.is_active == '1' || role.is_active === true ? '停用' : '启用' }}
                  </button>
                </td>
                <td>
                  <div class="user-count">
                    <i class="fas fa-users"></i>
                    {{ role.user_count || 0 }}
                  </div>
                </td>
                <td>
                  <div class="create-time">
                    {{ ctx.formatDate(role.created_at) }}
                  </div>
                </td>
                <td>
                  <div class="action-buttons">
                    <el-button
                      v-if="ctx.canEdit"
                      type="primary"
                      size="small"
                      @click="ctx.handleEditRole(role)"
                      title="编辑"
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-else
                      type="primary"
                      size="small"
                      title="您没有编辑角色的权限"
                      disabled
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button type="info" size="small" @click="ctx.handleAssignPermissions(role)" title="页面权限">
                      <i class="fas fa-lock"></i>
                      <span>页面权限</span>
                    </el-button>
                    <el-button type="warning" size="small" @click="ctx.handleRoleFieldPermissions(role)" title="字段权限">
                      <i class="fas fa-columns"></i>
                      <span>字段权限</span>
                    </el-button>
                    <el-button
                      v-if="ctx.canDelete"
                      type="danger"
                      size="small"
                      @click="ctx.handleDeleteRole(role)"
                      title="删除"
                      :disabled="role.user_count > 0"
                    >
                      <i class="fas fa-trash"></i>
                      <span>删除</span>
                    </el-button>
                    <el-button
                      v-else
                      type="danger"
                      size="small"
                      title="您没有删除角色的权限"
                      :disabled="true"
                    >
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
          v-if="ctx.rolesPagination.total > 0"
          v-model:current="ctx.rolesPagination.page"
          v-model:page-size="ctx.rolesPagination.size"
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
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
