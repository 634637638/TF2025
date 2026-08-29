<template>
  <MobileDialog
    :model-value="modelValue"
    title="绑定门店（支持多选）"
    width="600px"
    dialog-class="permissions-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="modal-body">
      <div class="user-info-summary">
        <p><strong>用户：</strong>{{ user?.username }} ({{ user?.name || '-' }})</p>
        <p>
          <strong>已绑定门店：</strong>
          <span v-if="user?.stores?.length">
            <span
              v-for="store in user.stores"
              :key="store.store_id"
              class="store-badge-small"
            >
              {{ store.store_name }}{{ store.is_primary ? ' (主)' : '' }}
            </span>
          </span>
          <span
            v-else
            class="text-muted"
          >未绑定</span>
        </p>
      </div>
      <form @submit.prevent="emit('save')">
        <div class="form-group">
          <label>选择门店（可多选）<span class="required">*</span></label>
          <div class="store-selection">
            <div
              v-for="store in stores"
              :key="store.id"
              class="store-checkbox"
            >
              <label>
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="store.id"
                >
                <span>{{ store.name }}</span>
                <span
                  v-if="isPrimaryStore(store.id)"
                  class="primary-badge"
                >主</span>
              </label>
            </div>
          </div>
          <p class="help-text">
            提示：选中的第一个门店将自动设置为主门店
          </p>
        </div>
      </form>
    </div>

    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          type="info"
          @click="emit('close')"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="saving || selected.length === 0"
          @click="emit('save')"
        >
          <InlineLoading
            v-if="saving"
            text="保存中..."
            size="small"
            variant="inherit"
          />
          <template v-else>
            保存绑定
          </template>
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import type { StoreBindingUser, StoreOption } from '../types'

const props = defineProps<{
  modelValue: boolean
  saving: boolean
  selectedStoreIds: number[]
  stores: StoreOption[]
  user: StoreBindingUser | null
}>()

const emit = defineEmits<{
  close: []
  save: []
  'update:modelValue': [value: boolean]
  'update:selectedStoreIds': [value: number[]]
}>()

const selected = computed({
  get: () => props.selectedStoreIds,
  set: value => emit('update:selectedStoreIds', value)
})

const isPrimaryStore = (storeId: number) => {
  return props.user?.stores?.some(store => store.store_id === storeId && Boolean(store.is_primary))
}
</script>
