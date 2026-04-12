<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          员工门店绑定列表
          <span class="record-count">共 {{ ctx.filteredStoreBindings.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th width="80">序号</th>
                <th width="150">用户名</th>
                <th width="150">真实姓名</th>
                <th width="120">角色</th>
                <th width="200">当前门店</th>
                <th width="100">绑定状态</th>
                <th width="200">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="ctx.storeBindingsLoading">
                <td :colspan="7" class="text-center">
                  <GlobalLoading size="medium" />
                  <span>加载中...</span>
                </td>
              </tr>
              <tr v-else-if="ctx.filteredStoreBindings.length === 0">
                <td :colspan="7" class="text-center empty-cell">
                  <i class="fas fa-inbox"></i>
                  <span>暂无数据</span>
                </td>
              </tr>
              <tr v-else v-for="(user, index) in ctx.paginatedStoreBindings" :key="user.id">
                <td>{{ (Number(ctx.storeBindingsPagination.page) - 1) * Number(ctx.storeBindingsPagination.size) + Number(index) + 1 }}</td>
                <td>{{ user.username }}</td>
                <td>{{ user.name || '-' }}</td>
                <td>
                  <div class="user-roles">
                    <span
                      v-for="(roleName, index) in ctx.getUserRoleNames(user.roles)"
                      :key="index"
                      :class="['role-tag', ctx.getRoleTagClass(roleName)]"
                    >
                      {{ roleName }}
                    </span>
                    <span v-if="!user.roles || user.roles === ''" class="no-roles">
                      无角色
                    </span>
                  </div>
                </td>
                <td>
                  <span v-if="user.stores && user.stores.length > 0" class="stores-cell">
                    <span v-for="store in user.stores" :key="store.store_id" class="store-badge-small">
                      {{ store.store_name }}{{ store.is_primary ? ' (主)' : '' }}
                    </span>
                  </span>
                  <span v-else class="text-muted">未绑定</span>
                </td>
                <td>
                  <span v-if="user.stores && user.stores.length > 0" class="store-status-badge store-status-bound">
                    <i class="fas fa-store"></i>
                    已绑定 {{ user.stores.length }} 个门店
                  </span>
                  <span v-else class="store-status-badge store-status-unbound">
                    <i class="fas fa-store-slash"></i>
                    未绑定
                  </span>
                </td>
                <td>
                  <el-button
                    type="primary"
                    size="small"
                    @click="ctx.openStoreBindingDialog(user)"
                    title="管理门店"
                  >
                    <i class="fas fa-link"></i>
                    {{ user.stores && user.stores.length > 0 ? '管理门店' : '绑定门店' }}
                  </el-button>
                  <el-button
                    v-if="user.stores && user.stores.length > 0"
                    type="danger"
                    size="small"
                    @click="ctx.unbindStore(user)"
                    title="解绑所有门店"
                  >
                    <i class="fas fa-unlink"></i>
                    解绑
                  </el-button>
                </td>
              </tr>
            </tbody>
          </table>
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
import GlobalLoading from '@/components/GlobalLoading.vue'
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
