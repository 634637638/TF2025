<template>
  <MobileDialog
    :model-value="modelValue"
    :title="`角色分配 - ${user?.username || ''}`"
    width="1180px"
    dialog-class="permissions-dialog user-role-modal"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="modal-body">
      <div
        v-if="user"
        class="user-role-form role-assignment-shell"
      >
        <UserRoleAssignmentSummary
          :selected-count="selectedRoleIds.length"
          :total-count="roles.length"
          :user="user"
          :visible-count="filteredRoleCount"
        />
        <UserRoleAssignmentBody
          :get-role-card-badge-class="getRoleCardBadgeClass"
          :roles="roles"
          :search-query="searchQuery"
          :selected-role-ids="selectedRoleIds"
          @update:search-query="emit('update:searchQuery', $event)"
          @update:selected-role-ids="emit('update:selectedRoleIds', $event)"
        />
      </div>
    </div>

    <template #footer>
      <div class="modal-footer user-role-footer">
        <div class="user-role-footer-info">
          <i class="fas fa-shield-alt" />
          <span>本次将为 {{ user?.username || '该用户' }} 更新 {{ selectedRoleIds.length }} 个角色</span>
        </div>
        <div class="tf-dialog-actions user-role-footer-actions">
          <el-button
            type="info"
            @click="emit('close')"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="saving"
            @click="emit('save')"
          >
            <InlineLoading
              v-if="saving"
              text="保存中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              保存角色分配
            </template>
          </el-button>
        </div>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import type { Role, User } from '../types'
import UserRoleAssignmentBody from './UserRoleAssignmentBody.vue'
import UserRoleAssignmentSummary from './UserRoleAssignmentSummary.vue'

const props = defineProps<{
  getRoleCardBadgeClass: (_roleName: string) => string
  modelValue: boolean
  roles: Role[]
  saving: boolean
  searchQuery: string
  selectedRoleIds: number[]
  user: User | null
}>()

const emit = defineEmits<{
  close: []
  save: []
  'update:modelValue': [value: boolean]
  'update:searchQuery': [value: string]
  'update:selectedRoleIds': [value: number[]]
}>()

const filteredRoleCount = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  if (!query) return props.roles.length
  return props.roles.filter(role => (
    role.name.toLowerCase().includes(query) ||
    Boolean(role.description?.toLowerCase().includes(query))
  )).length
})
</script>
