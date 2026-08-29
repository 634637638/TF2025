<template>
  <MobileDialog
    :model-value="modelValue"
    :title="isEdit ? '编辑角色' : '新增角色'"
    width="540px"
    dialog-class="permissions-dialog"
    :show-default-footer="false"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="modal-body">
      <form @submit.prevent="emit('submit')">
        <div class="form-group">
          <label>角色名称 <span class="required">*</span></label>
          <input
            v-model="name"
            type="text"
            class="form-control"
            required
            placeholder="请输入角色名称，如：门店负责人、采购专员、财务审核等"
          >
        </div>
        <div class="form-group">
          <label>角色编码</label>
          <input
            v-model="code"
            type="text"
            class="form-control"
            :readonly="isEdit"
            :aria-readonly="isEdit"
            :title="isEdit ? '角色编码创建后不可修改' : ''"
            :placeholder="isEdit ? '' : '请输入稳定编码，如：store_manager，留空则系统自动生成'"
          >
          <small class="form-help-text">
            {{ isEdit ? '角色编码是系统稳定标识，创建后不可修改。' : '建议使用字母、数字、下划线、中划线或冒号，留空则系统自动生成。' }}
          </small>
        </div>
        <div class="form-group">
          <label>角色描述 <span class="required">*</span></label>
          <textarea
            v-model="description"
            class="form-control"
            rows="3"
            required
            placeholder="请输入角色描述，详细说明该角色的职责和权限范围"
          />
        </div>
      </form>
    </div>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          type="info"
          @click="emit('update:modelValue', false)"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="saving"
          @click="emit('submit')"
        >
          <InlineLoading
            v-if="saving"
            :text="isEdit ? '更新中...' : '创建中...'"
            size="small"
            variant="inherit"
          />
          <template v-else>
            {{ isEdit ? '更新' : '创建' }}
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

const props = defineProps<{
  code: string
  description: string
  isEdit: boolean
  modelValue: boolean
  name: string
  saving: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:code': [value: string]
  'update:description': [value: string]
  'update:modelValue': [value: boolean]
  'update:name': [value: string]
}>()

const name = computed({ get: () => props.name, set: value => emit('update:name', value) })
const code = computed({ get: () => props.code, set: value => emit('update:code', value) })
const description = computed({ get: () => props.description, set: value => emit('update:description', value) })
</script>
