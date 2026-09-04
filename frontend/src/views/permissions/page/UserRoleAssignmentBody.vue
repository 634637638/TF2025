<template>
  <div class="role-assignment-layout">
    <div class="role-selection-section assignment-main-panel">
      <div class="role-search-section assignment-toolbar">
        <div class="assignment-toolbar-head">
          <div class="assignment-toolbar-title">
            <h4>角色库</h4>
          </div>
        </div>

        <div class="search-input-wrapper assignment-search-box">
          <i class="fas fa-search search-icon" />
          <input
            v-model="search"
            type="text"
            class="form-control search-input"
            placeholder="搜索角色名称、编码或描述"
            :disabled="isSaving"
          >
          <button
            v-if="search"
            type="button"
            class="search-clear-btn"
            :disabled="isSaving"
            title="清空搜索"
            @click="search = ''"
          >
            <i class="fas fa-times" />
          </button>
        </div>

        <div class="assignment-filter-row">
          <label class="assignment-filter-toggle">
            <input
              v-model="showSelectedOnly"
              type="checkbox"
              :disabled="isSaving || selectedIds.length === 0"
            >
            <span>只看已选</span>
          </label>

          <div class="search-results-info assignment-toolbar-meta">
            <span class="assignment-meta-pill">
              <i class="fas fa-layer-group" />
              全部 {{ roles.length }}
            </span>
            <span
              v-if="search || showSelectedOnly"
              class="assignment-meta-pill active"
            >
              <i class="fas fa-filter" />
              当前 {{ filteredRoles.length }}
            </span>
            <span class="assignment-meta-pill selected">
              <i class="fas fa-check-circle" />
              已选 {{ selectedIds.length }}
            </span>
          </div>
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
            :disabled="isSaving"
          >
          <span class="assignment-role-check">
            <i :class="selectedIds.includes(role.id) ? 'fas fa-check' : 'fas fa-plus'" />
          </span>
          <div class="assignment-role-card">
            <div class="assignment-role-header">
              <strong :title="role.name">{{ role.name }}</strong>
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
              <span
                v-if="isSensitiveRole(role)"
                class="assignment-role-risk"
              >
                <i class="fas fa-shield-alt" />
                高权限
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
        :title="showSelectedOnly ? '暂无已选角色' : '未找到匹配角色'"
        :description="showSelectedOnly ? '关闭只看已选后可继续浏览全部角色' : '请调整关键词，或清空搜索后查看全部角色'"
      />
    </div>

    <div class="selected-roles-preview assignment-side-panel">
      <div class="assignment-side-header">
        <div>
          <h4>本次分配</h4>
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
          :disabled="isSaving"
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
        <span>暂未选择角色</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Role } from '../types'

const props = defineProps<{
  getRoleCardBadgeClass: (_roleName: string) => string
  isSaving?: boolean
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
const showSelectedOnly = ref(false)

const filteredRoles = computed(() => {
  const query = search.value.trim().toLowerCase()
  const selectedRoleIdSet = new Set(selectedIds.value)

  return props.roles.filter(role => {
    if (showSelectedOnly.value && !selectedRoleIdSet.has(role.id)) return false
    if (!query) return true

    return (
      role.name.toLowerCase().includes(query) ||
      Boolean(role.code?.toLowerCase().includes(query)) ||
      Boolean(role.description?.toLowerCase().includes(query))
    )
  })
})

const removeRole = (roleId: number) => {
  selectedIds.value = selectedIds.value.filter(id => id !== roleId)
}

const getRoleName = (roleId: number) => {
  return props.roles.find(role => role.id === roleId)?.name || '未知角色'
}

const isSensitiveRole = (role: Role) => {
  const roleText = `${role.name || ''} ${role.code || ''} ${role.role_type || ''}`.toLowerCase()
  return ['admin', 'administrator', 'super', 'root', '管理', '超级', '系统'].some(keyword => roleText.includes(keyword))
}

watch(selectedIds, (ids) => {
  if (ids.length === 0) {
    showSelectedOnly.value = false
  }
})
</script>
