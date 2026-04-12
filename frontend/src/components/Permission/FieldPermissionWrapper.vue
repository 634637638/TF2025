<template>
  <div v-if="hasPermission">
    <slot />
  </div>
  <div v-else-if="showPlaceholder" class="field-placeholder">
    <slot name="placeholder">
      <span class="permission-hint">🔒 无权限查看</span>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'

interface Props {
  moduleKey: string
  fieldName: string
  action?: 'view' | 'edit' | 'export'
  roleId?: number
  showPlaceholder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  action: 'view',
  showPlaceholder: true
})

interface FieldPermission {
  can_view: boolean
  can_edit: boolean
  can_search: boolean
  can_export: boolean
  is_hidden: boolean
  permission_level: string
}

const authStore = useAuthStore()
const hasPermission = ref(false)
const permission = ref<FieldPermission | null>(null)

const checkPermission = async () => {
  const currentRoleId = props.roleId ?? authStore.user?.role_id

  if (!currentRoleId || !props.moduleKey || !props.fieldName) {
    hasPermission.value = false
    return
  }

  try {
    const response = await unifiedApi.get(`/field-permissions/${currentRoleId}`)

    if (response.success) {
      const modulePermissions = response.data
      // 从 field_config 中获取字段权限
      const fieldConfig = modulePermissions.field_config || {}
      const fieldPermission = Object.values(fieldConfig).find((f: any) =>
        f.field === props.fieldName || f.id === props.fieldName || f.id?.includes(props.fieldName)
      ) as FieldPermission | undefined

      permission.value = fieldPermission || null

      if (!permission.value) {
        hasPermission.value = false
        return
      }

      switch (props.action) {
        case 'view':
          hasPermission.value = permission.value.can_view && !permission.value.is_hidden
          break
        case 'edit':
          hasPermission.value = permission.value.can_edit
          break
        case 'export':
          hasPermission.value = permission.value.can_export
          break
        default:
          hasPermission.value = permission.value.can_view && !permission.value.is_hidden
      }
    }
  } catch (error) {
    logger.error('获取字段权限失败:', error)
    hasPermission.value = false
  }
}

watch(() => [
  props.moduleKey,
  props.fieldName,
  props.action,
  props.roleId,
  authStore.user?.role_id,
  authStore.user?.role_ids
], checkPermission)

onMounted(checkPermission)

// 暴露权限信息
defineExpose({
  hasPermission: computed(() => hasPermission.value),
  permission: computed(() => permission.value),
  checkPermission
})
</script>

<style scoped>
.field-placeholder {
  display: inline-block;
  padding: 4px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  color: #999;
  font-size: 12px;
}

.permission-hint {
  cursor: not-allowed;
}
</style>
