<template>
  <MobileDialog
    :model-value="modelValue"
    :title="`${module?.name || ''} - 字段权限配置`"
    width="900px"
    dialog-class="permissions-dialog field-permission-dialog"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="modal-body">
      <div class="field-permission-info">
        <div class="info-alert">
          <i class="fas fa-info-circle" />
          <span>配置该角色在{{ module?.name }}模块中可以查看的字段。</span>
        </div>
      </div>

      <div class="field-groups-container">
        <div
          v-for="group in fieldGroups"
          :key="group.name"
          class="field-group"
        >
          <div class="group-header">
            <h4>
              <i class="fas fa-folder" />
              {{ group.name }}
              <span class="group-count">({{ group.fields.length }}个字段)</span>
            </h4>
            <div class="group-sensitivity">
              <span :class="['sensitivity-badge', group.sensitivity]">
                {{ getSensitivityLabel(group.sensitivity) }}
              </span>
              <el-button
                size="small"
                type="primary"
                plain
                @click="toggleGroup(group)"
              >
                {{ isGroupSelected(group) ? '取消选择' : '全选' }}
              </el-button>
            </div>
          </div>

          <div class="fields-grid">
            <div
              v-for="field in group.fields"
              :key="field.id"
              :class="['field-item', { 'field-sensitive': isFieldSensitive(field) }]"
            >
              <label class="field-checkbox">
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="field.id"
                >
                <span class="checkmark" />
                <div class="field-info">
                  <div class="field-main">
                    <strong>{{ field.name }}</strong>
                    <div class="field-badges">
                      <span :class="['field-type', field.type]">
                        {{ getFieldTypeLabel(field.type) }}
                      </span>
                      <span
                        v-if="field.required"
                        class="field-required"
                      >必填</span>
                      <span :class="['field-sensitivity', field.sensitivity]">
                        {{ getSensitivityLabel(field.sensitivity) }}
                      </span>
                    </div>
                  </div>
                  <div class="field-description">
                    {{ field.description }}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="fieldGroups.length === 0"
        class="no-fields"
      >
        <i class="fas fa-exclamation-triangle" />
        <p>该模块暂未配置字段定义</p>
        <small>请联系有权限的角色维护人员为该模块添加字段定义</small>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer permission-summary-footer">
        <div class="selection-summary">
          <span>已选择 {{ selected.length }} / {{ totalFieldCount }} 个字段</span>
        </div>
        <div class="tf-dialog-actions footer-actions">
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
              保存配置
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
import type { FieldDefinition, FieldGroup } from '../types'

interface ModuleSummary {
  name?: string
}

const props = defineProps<{
  fieldGroups: FieldGroup[]
  getFieldTypeLabel: (_type: string) => string
  getSensitivityLabel: (_sensitivity: string) => string
  isFieldSensitive: (_field: FieldDefinition) => boolean
  modelValue: boolean
  module: ModuleSummary | null
  saving: boolean
  selectedFields: string[]
  totalFieldCount: number
}>()

const emit = defineEmits<{
  close: []
  save: []
  'update:modelValue': [value: boolean]
  'update:selectedFields': [value: string[]]
}>()

const selected = computed({
  get: () => props.selectedFields,
  set: value => emit('update:selectedFields', value)
})

const isGroupSelected = (group: FieldGroup) => {
  return group.fields.length > 0 && group.fields.every(field => selected.value.includes(field.id))
}

const toggleGroup = (group: FieldGroup) => {
  const groupIds = new Set(group.fields.map(field => field.id))
  selected.value = isGroupSelected(group)
    ? selected.value.filter(id => !groupIds.has(id))
    : Array.from(new Set([...selected.value, ...groupIds]))
}
</script>
