<template>
  <div class="role-assignment-hero">
    <div class="role-assignment-user-card">
      <div class="user-avatar">
        <i class="fas fa-user-circle" />
      </div>
      <div class="user-details">
        <span class="role-assignment-caption">当前操作用户</span>
        <h4>{{ user.username }}</h4>
        <p>{{ user.full_name || user.name || '未设置姓名' }}</p>
        <div class="user-status">
          <span :class="['status-badge', user.status === 1 ? 'active' : 'inactive']">
            {{ user.status === 1 ? '活跃' : '禁用' }}
          </span>
        </div>
      </div>
    </div>

    <div class="role-assignment-summary">
      <div class="summary-metric">
        <span class="summary-metric-label">已选角色</span>
        <strong>{{ selectedCount }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">当前可见</span>
        <strong>{{ visibleCount }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">角色总数</span>
        <strong>{{ totalCount }}</strong>
      </div>
      <div class="summary-metric hint">
        <span class="summary-metric-label">分配模式</span>
        <strong>支持多选</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface UserSummary {
  full_name?: string | null
  name?: string | null
  status: number
  username: string
}

defineProps<{
  selectedCount: number
  totalCount: number
  user: UserSummary
  visibleCount: number
}>()
</script>
