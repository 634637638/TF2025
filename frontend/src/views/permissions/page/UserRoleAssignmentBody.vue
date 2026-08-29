<template>
  <div class="role-assignment-layout">
    <div class="role-selection-section assignment-main-panel">
      <div class="role-search-section assignment-toolbar">
        <div class="assignment-toolbar-title">
          <h4>选择角色</h4>
          <p>一行展示多个角色，点击卡片即可勾选或取消。</p>
        </div>

        <div class="search-input-wrapper assignment-search-box">
          <i class="fas fa-search search-icon" />
          <input
            v-model="search"
            type="text"
            class="form-control search-input"
            placeholder="搜索角色名称或描述..."
          >
          <button
            v-if="search"
            type="button"
            class="search-clear-btn"
            @click="search = ''"
          >
            <i class="fas fa-times" />
          </button>
        </div>

        <div class="search-results-info assignment-toolbar-meta">
          <span class="assignment-meta-pill">
            <i class="fas fa-layer-group" />
            共 {{ roles.length }} 个角色
          </span>
          <span
            v-if="search"
            class="assignment-meta-pill active"
          >
            <i class="fas fa-filter" />
            匹配 {{ filteredRoles.length }} 个
          </span>
          <span class="assignment-meta-pill">
            <i class="fas fa-check-circle" />
            已选 {{ selectedIds.length }} 个
          </span>
        </div>
      </div>

      <div
        v-if="filteredRoles.length > 0"
        class="role-group assignment-role-grid"
      >
        <label
          v-for="role in filteredRoles"
          :key="role.id"
          :class="['assignment-role-option', { selected: selectedIds.includes(role.id) }]"
        >
          <input
            v-model="selectedIds"
            type="checkbox"
            class="form-check-input assignment-role-input"
            :value="role.id"
          >
          <span class="assignment-role-check">
            <i :class="selectedIds.includes(role.id) ? 'fas fa-check' : 'fas fa-plus'" />
          </span>
          <div class="assignment-role-card">
            <div class="assignment-role-header">
              <strong>{{ role.name }}</strong>
              <span :class="['assignment-role-badge', getRoleCardBadgeClass(role.name)]">
                {{ role.code || '角色' }}
              </span>
            </div>
            <div class="assignment-role-description">
              {{ role.description || '暂无描述' }}
            </div>
            <div class="assignment-role-meta">
              <span class="user-count">
                <i class="fas fa-users" />
                {{ role.user_count || 0 }} 人使用
              </span>
              <span class="assignment-role-state">
                {{ selectedIds.includes(role.id) ? '已选择' : '点击选择' }}
              </span>
            </div>
          </div>
        </label>
      </div>

      <DataEmptyState
        v-else
        state="filtered"
        size="compact"
        title="未找到匹配角色"
        description="请调整关键词，或清空搜索后查看全部角色"
      />
    </div>

    <div class="selected-roles-preview assignment-side-panel">
      <div class="assignment-side-header">
        <div>
          <h4>已选角色</h4>
          <p>点击下方标签可快速移除。</p>
        </div>
        <span class="assignment-side-count">{{ selectedIds.length }}</span>
      </div>

      <div
        v-if="selectedIds.length > 0"
        class="selected-roles-list assignment-selected-list"
      >
        <button
          v-for="roleId in selectedIds"
          :key="roleId"
          type="button"
          class="selected-role-tag assignment-selected-tag"
          title="点击移除"
          @click="removeRole(roleId)"
        >
          <span>{{ getRoleName(roleId) }}</span>
          <i class="fas fa-times" />
        </button>
      </div>

      <div
        v-else
        class="assignment-empty-selection"
      >
        <i class="fas fa-user-tag" />
        <span>暂未选择角色，保存后可将该用户清空角色。</span>
      </div>

      <div class="assignment-side-tip">
        <i class="fas fa-info-circle" />
        <span>系统角色权限较高，请确认后再保存分配结果。</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Role } from '../types'

const props = defineProps<{
  getRoleCardBadgeClass: (_roleName: string) => string
  roles: Role[]
  searchQuery: string
  selectedRoleIds: number[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:selectedRoleIds': [value: number[]]
}>()

const search = computed({
  get: () => props.searchQuery,
  set: value => emit('update:searchQuery', value)
})
const selectedIds = computed({
  get: () => props.selectedRoleIds,
  set: value => emit('update:selectedRoleIds', value)
})

const filteredRoles = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.roles
  return props.roles.filter(role => (
    role.name.toLowerCase().includes(query) ||
    Boolean(role.description?.toLowerCase().includes(query))
  ))
})

const removeRole = (roleId: number) => {
  selectedIds.value = selectedIds.value.filter(id => id !== roleId)
}

const getRoleName = (roleId: number) => {
  return props.roles.find(role => role.id === roleId)?.name || '未知角色'
}
</script>
