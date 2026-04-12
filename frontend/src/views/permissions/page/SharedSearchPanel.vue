<template>
  <div v-if="searchableTabs.includes(ctx.activeTab)" class="permissions-shared-search">
    <UnifiedSearchPanel
      v-if="ctx.activeTab === 'roles'"
      v-model:expanded="ctx.roleSearchExpanded"
      @search="ctx.searchRoles"
      @reset="ctx.resetRoleSearch"
    >
      <template #primary>
        <el-input
          v-model="ctx.roleSearchForm.name"
          placeholder="搜索角色名称 / 编码 / 描述"
          clearable
          @keyup.enter="ctx.searchRoles"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="form-group filter-item" data-field="roleHint">
        <div class="search-hint-card">
          <i class="fas fa-database"></i>
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
          v-model="ctx.userSearchForm.username"
          placeholder="搜索用户名/姓名"
          clearable
          @keyup.enter="ctx.searchUsers"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="form-group filter-item" data-field="role">
        <el-select
          v-model="ctx.userSearchForm.roleId"
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
          v-model="ctx.storeBindingSearchForm.userName"
          placeholder="搜索员工姓名"
          clearable
          @keyup.enter="ctx.searchStoreBindings"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="form-group filter-item">
        <el-select
          v-model="ctx.storeBindingSearchForm.storeId"
          placeholder="门店筛选"
          clearable
          filterable
          style="width: 100%"
          @change="ctx.searchStoreBindings"
        >
          <el-option label="全部门店" value="" />
          <el-option
            v-for="store in ctx.storeList"
            :key="store.id"
            :label="store.name"
            :value="store.id"
          />
        </el-select>
      </div>

      <div class="form-group filter-item">
        <el-select
          v-model="ctx.storeBindingSearchForm.hasStore"
          placeholder="绑定状态"
          clearable
          style="width: 100%"
          @change="ctx.searchStoreBindings"
        >
          <el-option label="全部" value="" />
          <el-option label="已绑定" value="true" />
          <el-option label="未绑定" value="false" />
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
          v-model="ctx.logSearchForm.username"
          placeholder="搜索操作用户"
          clearable
          @keyup.enter="ctx.searchLogs"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="form-group filter-item">
        <el-select
          v-model="ctx.logSearchForm.action"
          placeholder="操作类型"
          clearable
          style="width: 100%"
          @change="ctx.searchLogs"
        >
          <el-option label="全部操作" value="" />
          <el-option label="创建角色" value="create" />
          <el-option label="编辑角色" value="edit" />
          <el-option label="删除角色" value="delete" />
          <el-option label="分配角色" value="assign" />
          <el-option label="权限配置" value="permission" />
        </el-select>
      </div>

      <div class="form-group filter-item">
        <el-date-picker
          v-model="ctx.logSearchForm.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          clearable
          @change="ctx.searchLogs"
          style="width: 100%"
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
  background: #f8fafc;
  border: 1px dashed rgba(100, 116, 139, 0.28);
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
</style>
