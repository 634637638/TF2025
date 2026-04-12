<template>
  <div class="user-info">
    <div class="user-avatar">
      <i class="fas fa-user"></i>
    </div>
    <div class="user-details">
      <div class="user-name">{{ currentUser.name }}</div>
      <div class="user-meta">
        <span class="user-id">工号: {{ currentUser.employeeId }}</span>
        <span class="user-position">{{ currentUser.position }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 从认证store中获取真实用户信息
const authStore = useAuthStore()
const formatRoleLabel = (role: any) => {
  if (!role) return ''
  if (typeof role === 'string') return role
  return role.name || role.code || ''
}

const currentUser = computed(() => {
  const user = authStore.user
  const roleLabels = (Array.isArray(user?.roles) ? user.roles : [])
    .map(formatRoleLabel)
    .filter(Boolean)

  return {
    name: user?.username || '用户',
    employeeId: user?.employeeId || '',
    position: user?.position || roleLabels.join(' / ') || formatRoleLabel(user?.role) || '未分配角色'
  }
})
</script>

<style scoped>
/* 用户信息样式 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}

.user-id, .user-position {
  opacity: 0.9;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
