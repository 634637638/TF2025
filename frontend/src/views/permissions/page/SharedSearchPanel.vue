<template>
  <div
    v-if="searchableTabs.includes(ctx.activeTab)"
    class="permissions-shared-search"
  >
    <UnifiedSearchPanel
      v-if="ctx.activeTab === 'roles'"
      v-model:expanded="ctx.roleSearchExpanded"
      @search="ctx.searchRoles"
      @reset="ctx.resetRoleSearch"
    >
      <template #primary>
        <el-input
          v-if="ctx.canViewPermissionsField('roles.name') || ctx.canViewPermissionsField('roles.code') || ctx.canViewPermissionsField('roles.description')"
          v-model="ctx.roleSearchForm.name"
          placeholder="搜索角色名称 / 编码 / 描述"
          clearable
          @keyup.enter="ctx.searchRoles"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
      </template>

      <div
        v-if="ctx.canViewPermissionsField('roles.name') || ctx.canViewPermissionsField('roles.code') || ctx.canViewPermissionsField('roles.description')"
        class="form-group filter-item"
        data-field="roleHint"
      >
        <div class="search-hint-card">
          <i class="fas fa-database" />
          <span>角色由数据库驱动，支持按名称、编码和描述搜索。</span>
        </div>
      </div>
    </UnifiedSearchPanel>

    <UnifiedSearchPanel
      v-else-if="ctx.activeTab === 'userRoles'"
      v-model:expanded="ctx.userSearchExpanded"
      @search="ctx.searchUsers"
      @reset="ctx.resetUserSearch"
    >
      <template #primary>
        <el-input
          v-if="ctx.canViewPermissionsField('users.username') || ctx.canViewPermissionsField('users.full_name')"
          v-model="ctx.userSearchForm.username"
          placeholder="搜索用户名/姓名"
          clearable
          @keyup.enter="ctx.searchUsers"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
      </template>

      <div
        v-if="ctx.canViewPermissionsField('users.roles')"
        class="form-group filter-item"
        data-field="role"
      >
        <el-select
          v-model="ctx.userSearchForm.role_id"
          placeholder="角色筛选"
          clearable
          filterable
          @change="ctx.searchUsers"
        >
          <el-option
            v-for="role in ctx.rolesData"
            :key="role.id"
            :label="role.name"
            :value="role.id"
          />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <UnifiedSearchPanel
      v-else-if="ctx.activeTab === 'storeBindings'"
      v-model:expanded="ctx.storeBindingSearchExpanded"
      @search="ctx.searchStoreBindings"
      @reset="ctx.resetStoreBindingSearch"
    >
      <template #primary>
        <el-input
          v-if="ctx.canViewPermissionsField('store_bindings.username') || ctx.canViewPermissionsField('store_bindings.name')"
          v-model="ctx.storeBindingSearchForm.user_name"
          placeholder="搜索员工姓名"
          clearable
          @keyup.enter="ctx.searchStoreBindings"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
      </template>

      <div
        v-if="ctx.canViewPermissionsField('store_bindings.stores')"
        class="form-group filter-item"
      >
        <el-select
          v-model="ctx.storeBindingSearchForm.store_id"
          placeholder="门店筛选"
          clearable
          filterable
          style="width: 100%"
          @change="ctx.searchStoreBindings"
        >
          <el-option
            label="全部门店"
            value=""
          />
          <el-option
            v-for="store in ctx.storeList"
            :key="store.id"
            :label="store.name"
            :value="store.id"
          />
        </el-select>
      </div>

      <div
        v-if="ctx.canViewPermissionsField('store_bindings.status')"
        class="form-group filter-item"
      >
        <el-select
          v-model="ctx.storeBindingSearchForm.has_store"
          placeholder="绑定状态"
          clearable
          style="width: 100%"
          @change="ctx.searchStoreBindings"
        >
          <el-option
            label="全部"
            value=""
          />
          <el-option
            label="已绑定"
            value="true"
          />
          <el-option
            label="未绑定"
            value="false"
          />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <UnifiedSearchPanel
      v-else-if="ctx.activeTab === 'logs'"
      v-model:expanded="ctx.logSearchExpanded"
      @search="ctx.searchLogs"
      @reset="ctx.resetLogSearch"
    >
      <template #primary>
        <el-input
          v-if="ctx.canViewPermissionsField('logs.username')"
          v-model="ctx.logSearchForm.username"
          placeholder="搜索操作用户"
          clearable
          @keyup.enter="ctx.searchLogs"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
      </template>

      <div
        v-if="ctx.canViewPermissionsField('logs.action')"
        class="form-group filter-item"
      >
        <el-select
          v-model="ctx.logSearchForm.action"
          placeholder="操作类型"
          clearable
          style="width: 100%"
          @change="ctx.searchLogs"
        >
          <el-option
            label="全部操作"
            value=""
          />
          <el-option
            label="创建"
            value="create"
          />
          <el-option
            label="编辑"
            value="edit"
          />
          <el-option
            label="删除"
            value="delete"
          />
          <el-option
            label="分配"
            value="assign"
          />
          <el-option
            label="权限配置"
            value="permission"
          />
          <el-option
            label="启用"
            value="enable"
          />
          <el-option
            label="禁用"
            value="disable"
          />
          <el-option
            label="同步"
            value="sync"
          />
        </el-select>
      </div>

      <div
        v-if="ctx.canViewPermissionsField('logs.created_at')"
        class="form-group filter-item"
      >
        <el-date-picker
          v-model="ctx.logSearchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 100%"
          @change="ctx.searchLogs"
        />
      </div>
    </UnifiedSearchPanel>
  </div>
</template>

<script setup lang="ts">
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()

const searchableTabs = ['roles', 'userRoles', 'storeBindings', 'logs']
</script>

<style scoped>
.search-hint-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--tf-color-slate-50);
  border: 1px dashed rgba(100, 116, 139, 0.28);
  color: var(--tf-color-slate-500);
  font-size: 12px;
  line-height: 1.5;
}
</style>
