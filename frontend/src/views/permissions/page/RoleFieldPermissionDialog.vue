<template>
  <MobileDialog
    :model-value="modelValue"
    :title="`${roleName || ''} - 字段权限配置`"
    width="1200px"
    dialog-class="permissions-dialog role-field-permission-dialog tf-dialog-body-flush"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-body">
      <div class="module-selection-area">
        <div class="section-title">
          <i class="fas fa-cube" />
          页面模块
          <span class="module-count">共 {{ modules.length }} 个模块</span>
        </div>
        <div class="module-grid">
          <SectionLoading
            v-if="loadingModules"
            text="加载中..."
            size="compact"
          />

          <template v-else>
            <div
              v-for="module in modules"
              :key="module.module_key || module.key"
              :class="['module-item-grid', { active: selectedModuleKey === getModuleKey(module) }]"
              :title="module.name"
              @click="emit('selectModule', module)"
            >
              <div class="module-icon">
                <i :class="module.icon" />
              </div>
              <div class="module-name">
                {{ module.name }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <div
        v-if="selectedModule"
        class="field-layout-area"
      >
        <div class="field-group-nav">
          <div class="section-title section-title--compact">
            <i class="fas fa-sitemap" />
            子页面 / 分组
          </div>
          <SectionLoading
            v-if="loadingGroups"
            text="加载中..."
            size="compact"
          />
          <div
            v-else-if="fieldGroups.length > 0"
            class="group-nav-list"
          >
            <button
              v-for="group in fieldGroups"
              :key="group.name"
              type="button"
              :class="['group-nav-item', { active: activeGroupName === group.name }]"
              @click="activeGroupName = group.name"
            >
              <div class="group-nav-main">
                <span class="group-nav-name">{{ group.name }}</span>
                <span class="group-nav-count">{{ group.fields.length }}项</span>
              </div>
              <div class="group-nav-meta">
                <span :class="['sensitivity-badge', group.sensitivity]">
                  {{ getSensitivityLabel(group.sensitivity) }}
                </span>
                <span class="group-nav-hidden">已隐藏 {{ getHiddenCount(group) }}</span>
              </div>
            </button>
          </div>
          <div
            v-else
            class="no-fields no-fields--inline"
          >
            <i class="fas fa-exclamation-triangle" />
            <p>该模块暂未配置字段定义</p>
          </div>
        </div>

        <div class="field-config-area">
          <div class="field-config-toolbar">
            <div class="field-config-heading">
              <div class="field-config-heading__main">
                <h3 class="field-config-title">
                  {{ selectedModule.name }}
                </h3>
              </div>
            </div>

            <div class="field-actions">
              <el-button
                v-if="fieldGroups.length > 0"
                size="small"
                type="warning"
                plain
                @click="toggleModuleFields"
              >
                <i class="fas fa-eye-slash" />
                {{ isModuleHidden ? '显示全部' : '隐藏全部' }}
              </el-button>
              <el-button
                v-if="currentGroup"
                size="small"
                type="primary"
                plain
                @click="toggleGroupFields(currentGroup)"
              >
                <i class="fas fa-sliders-h" />
                {{ isGroupHidden(currentGroup) ? '显示分组' : '隐藏分组' }}
              </el-button>
            </div>
          </div>

          <div
            v-if="loadingGroups"
            class="field-config-panel role-field-loading-panel"
          >
            <SectionLoading text="加载中..." />
          </div>
          <div
            v-else-if="currentGroup"
            class="field-config-panel"
          >
            <div class="field-panel-summary">
              <div class="field-panel-summary__title">
                {{ currentGroup.name }}
                <span class="group-count">({{ currentGroup.fields.length }}个字段)</span>
              </div>
            </div>

            <div class="field-switch-list">
              <div
                v-for="field in currentGroup.fields"
                :key="field.id"
                :class="[
                  'field-switch-item',
                  {
                    'field-sensitive': isFieldSensitive(field),
                    'field-hidden': selectedFieldSet.has(field.id)
                  }
                ]"
              >
                <div class="field-switch-content">
                  <div class="field-switch-header">
                    <div class="field-switch-title">
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
                    <div class="field-switch-action">
                      <span :class="['field-visibility-text', isFieldVisible(field.id) ? 'visible' : 'hidden']">
                        {{ isFieldVisible(field.id) ? '已显示' : '已隐藏' }}
                      </span>
                      <el-switch
                        :model-value="isFieldVisible(field.id)"
                        inline-prompt
                        active-text="开"
                        inactive-text="关"
                        @change="setFieldVisibility(field.id, $event)"
                      />
                    </div>
                  </div>
                  <div class="field-description">
                    {{ field.description || '未配置字段说明' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="no-module-selected"
          >
            <i class="fas fa-hand-pointer" />
            <p>请选择左侧子页面后再配置字段权限</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="no-module-selected"
      >
        <i class="fas fa-hand-pointer" />
        <p>请选择左侧母页面后再配置字段权限</p>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer permission-summary-footer">
        <div
          v-if="selectedModule"
          class="selection-summary"
        >
          <span>已选择 {{ selectedFields.length }} 个字段隐藏</span>
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
            :disabled="saving || !selectedModule"
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
import SectionLoading from '@/components/SectionLoading.vue'
import type { FieldDefinition, FieldGroup, RoleFieldModule } from '../types'

const props = defineProps<{
  fieldGroups: FieldGroup[]
  getFieldTypeLabel: (_type: string) => string
  getSensitivityLabel: (_sensitivity: string) => string
  isFieldSensitive: (_field: FieldDefinition) => boolean
  loadingGroups: boolean
  loadingModules: boolean
  modelValue: boolean
  modules: RoleFieldModule[]
  roleName?: string
  saving: boolean
  selectedFieldGroupName: string
  selectedFields: string[]
  selectedModule: RoleFieldModule | null
}>()

const emit = defineEmits<{
  close: []
  save: []
  selectModule: [module: RoleFieldModule]
  'update:modelValue': [value: boolean]
  'update:selectedFieldGroupName': [value: string]
  'update:selectedFields': [value: string[]]
}>()

const activeGroupName = computed({
  get: () => props.selectedFieldGroupName,
  set: value => emit('update:selectedFieldGroupName', value)
})

const selected = computed({
  get: () => props.selectedFields,
  set: value => emit('update:selectedFields', value)
})

const selectedFieldSet = computed(() => new Set(props.selectedFields))
const selectedModuleKey = computed(() => props.selectedModule ? getModuleKey(props.selectedModule) : '')
const currentGroup = computed(() => {
  return props.fieldGroups.find(group => group.name === activeGroupName.value) || props.fieldGroups[0] || null
})

const getModuleKey = (module: RoleFieldModule) => module.module_key || module.key || ''
const getHiddenCount = (group: FieldGroup) => group.fields.filter(field => selectedFieldSet.value.has(field.id)).length
const isFieldVisible = (fieldId: string) => !selectedFieldSet.value.has(fieldId)
const isGroupHidden = (group: FieldGroup) => {
  return group.fields.length > 0 && group.fields.every(field => selectedFieldSet.value.has(field.id))
}

const isModuleHidden = computed(() => {
  const fieldIds = props.fieldGroups.flatMap(group => group.fields.map(field => field.id))
  return fieldIds.length > 0 && fieldIds.every(id => selectedFieldSet.value.has(id))
})

const setFieldVisibility = (fieldId: string, visible: boolean | string | number) => {
  selected.value = visible === true
    ? selected.value.filter(id => id !== fieldId)
    : Array.from(new Set([...selected.value, fieldId]))
}

const toggleGroupFields = (group: FieldGroup) => {
  const groupIds = new Set(group.fields.map(field => field.id))
  selected.value = isGroupHidden(group)
    ? selected.value.filter(id => !groupIds.has(id))
    : Array.from(new Set([...selected.value, ...groupIds]))
}

const toggleModuleFields = () => {
  const moduleIds = new Set(props.fieldGroups.flatMap(group => group.fields.map(field => field.id)))
  selected.value = isModuleHidden.value
    ? selected.value.filter(id => !moduleIds.has(id))
    : Array.from(new Set([...selected.value, ...moduleIds]))
}
</script>

<style scoped>
.role-field-loading-panel {
  min-height: 240px;
}
</style>
