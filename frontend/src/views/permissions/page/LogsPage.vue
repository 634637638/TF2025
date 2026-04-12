<template>
  <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          操作日志
          <span class="record-count">共 {{ ctx.filteredLogs.length }} 条记录</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th width="80">ID</th>
                <th width="120">操作类型</th>
                <th width="150">操作用户</th>
                <th width="300">操作描述</th>
                <th width="120">IP地址</th>
                <th width="160">操作时间</th>
                <th width="100">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="ctx.logsLoading" class="loading-row">
                <td colspan="7" class="text-center">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>加载中...</span>
                </td>
              </tr>
              <tr v-else-if="ctx.filteredLogs.length === 0" class="empty-row">
                <td colspan="7" class="text-center">
                  <i class="fas fa-inbox"></i>
                  <span>暂无日志数据</span>
                </td>
              </tr>
              <tr v-else v-for="(log, index) in ctx.paginatedLogs" :key="log.id" class="log-row">
                <td class="log-id">
                  <span class="id-badge">{{ Number(ctx.logsPagination.total) - (Number(ctx.logsPagination.page) - 1) * Number(ctx.logsPagination.size) - Number(index) }}</span>
                </td>
                <td>
                  <span :class="['action-tag', ctx.getActionTypeClass(log.action)]">
                    <i :class="ctx.getActionIcon(log.action)"></i>
                    {{ ctx.getActionName(log.action) }}
                  </span>
                </td>
                <td>
                  <div class="user-info">
                    <div class="user-username">
                      <i class="fas fa-user-circle"></i>
                      {{ log.username }}
                    </div>
                  </div>
                </td>
                <td>
                  <div class="log-description">
                    {{ log.description }}
                  </div>
                </td>
                <td>
                  <div class="ip-address">
                    {{ log.ip_address }}
                  </div>
                </td>
                <td>
                  <div class="create-time">
                    {{ ctx.formatDate(log.created_at) }}
                  </div>
                </td>
                <td>
                  <span :class="['status-badge', log.status === 'success' ? 'success' : 'error']">
                    <i :class="log.status === 'success' ? 'fas fa-check' : 'fas fa-times'"></i>
                    {{ log.status === 'success' ? '成功' : '失败' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
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
  </div>
</template>

<script setup lang="ts">
import Pagination from '@/components/Pagination.vue'
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
