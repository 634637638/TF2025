<template>
  <div class="role-assignment-hero">
    <div class="role-assignment-user-card">
      <div class="user-avatar">
        <i class="fas fa-user-circle" />
      </div>
      <div class="user-details user-identity-copy">
        <span class="role-assignment-caption">当前操作用户</span>
        <h4>{{ user.username }}</h4>
        <p>{{ user.full_name || user.name || '未设置姓名' }}</p>
      </div>
      <div class="user-status user-identity-status">
        <span :class="['status-badge', user.status === 1 ? 'active' : 'inactive']">
          <i :class="user.status === 1 ? 'fas fa-check' : 'fas fa-pause'" />
          {{ user.status === 1 ? '活跃' : '禁用' }}
        </span>
      </div>
    </div>

    <div class="role-assignment-summary">
      <div class="summary-metric">
        <span class="summary-metric-label">已选角色</span>
        <strong>{{ selectedCount }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">搜索匹配</span>
        <strong>{{ visibleCount }}</strong>
      </div>
      <div class="summary-metric">
        <span class="summary-metric-label">角色总数</span>
        <strong>{{ totalCount }}</strong>
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
