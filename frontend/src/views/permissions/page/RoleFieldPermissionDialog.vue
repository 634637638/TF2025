<template>
  <MobileDialog
    :model-value="modelValue"
    :title="`${roleName || ''} - 字段权限配置`"
    dialog-class="permissions-dialog role-field-permission-dialog tf-dialog-workspace tf-dialog-body-flush"
    :show-default-footer="false"
    :close-on-click-modal="false"
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
            text="正在读取页面模块..."
            size="compact"
          />

          <template v-else>
            <section
              v-for="group in fieldModuleGroups"
              :key="group.key"
              class="field-module-group"
            >
              <div
                v-if="!group.standalone"
                class="field-module-group__heading"
              >
                <IconRenderer :icon="group.parent?.icon || 'fas fa-cube'" />
                <span>{{ group.parent?.name || group.title }}</span>
                <span class="field-module-group__badge">母模块</span>
              </div>
              <div :class="['field-module-group__items', { 'has-children': !group.standalone }]">
                <el-button
                  v-for="module in group.modules"
                  :key="getModuleKey(module)"
                  native-type="button"
                  :class="[
                    'tf-button--content module-item-grid',
                    { 'module-item-grid--child': !group.standalone && getModuleKey(module) !== getModuleKey(group.parent!) }
                  ]"
                  :aria-pressed="selectedModuleKey === getModuleKey(module)"
                  :title="module.name"
                  :disabled="saving"
                  @click="emit('selectModule', module)"
                >
                  <div class="module-icon">
                    <IconRenderer :icon="module.icon" />
                  </div>
                  <div class="module-name">
                    {{ module.name }}
                  </div>
                  <span
                    v-if="!group.standalone && getModuleKey(module) !== getModuleKey(group.parent!)"
                    class="field-module-group__badge field-module-group__badge--child"
                  >子模块</span>
                </el-button>
              </div>
            </section>
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
            字段分组
          </div>
          <SectionLoading
            v-if="loadingGroups"
            text="正在读取字段分组..."
            size="compact"
          />
          <div
            v-else-if="fieldGroups.length > 0"
            class="group-nav-list"
          >
            <el-button
              v-for="group in fieldGroups"
              :key="group.name"
              native-type="button"
              :aria-pressed="activeGroupName === group.name"
              :class="['tf-button--content group-nav-item', { active: activeGroupName === group.name }]"
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
            </el-button>
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
            <el-radio-group
              v-if="getModuleKey(selectedModule) === 'query_queryview'"
              :model-value="selectedModule.field_scope || 'phone'"
              class="tf-state-selector"
              :aria-label="`${selectedModule.name}字段模式`"
              :disabled="saving"
              @change="emit('selectModule', { ...selectedModule, field_scope: $event === 'goods' ? 'goods' : undefined })"
            >
              <el-radio-button
                v-for="scope in queryScopes"
                :key="scope.name"
                :value="scope.scope || 'phone'"
              >
                {{ scope.name }}
              </el-radio-button>
            </el-radio-group>
            <div class="field-config-heading">
              <div class="field-config-heading__main">
                <h3 class="field-config-title">
                  {{ selectedModule.name }}{{ getModuleKey(selectedModule) === 'query_queryview' ? ` / ${selectedModule.field_scope === 'goods' ? '商品模式' : '手机模式'}` : '' }}
                </h3>
                <div class="selection-summary">
                  隐藏 {{ selectedFields.length }} 项，
                  只读 {{ readonlyFieldCount }} 项，
                  可编辑 {{ editableFieldCount }} 项
                </div>
              </div>
            </div>

            <div class="field-actions">
              <el-button
                v-if="fieldGroups.length > 0"
                type="warning"
                plain
                :disabled="saving || !configReady"
                @click="toggleModuleFields"
              >
                <i class="fas fa-eye-slash" />
                {{ isModuleHidden ? '显示全部' : '隐藏全部' }}
              </el-button>
              <el-button
                v-if="currentGroup"
                type="primary"
                plain
                :disabled="saving || !configReady"
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
            <SectionLoading text="正在读取角色字段权限..." />
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
                    'field-hidden': selectedFieldSet.has(field.id),
                    'field-switch-item--tri-state': true
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
                      <el-radio-group
                        :model-value="getFieldState(field)"
                        class="tf-state-selector"
                        :aria-label="`${field.name}字段权限`"
                        :disabled="saving || !configReady"
                        @change="setFieldState(field.id, $event)"
                      >
                        <el-radio-button value="hidden">
                          隐藏
                        </el-radio-button>
                        <el-radio-button value="readonly">
                          只读
                        </el-radio-button>
                        <el-radio-button
                          value="editable"
                          :disabled="!field.editable"
                        >
                          编辑
                        </el-radio-button>
                      </el-radio-group>
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
            <p>请选择左侧字段分组后再配置字段权限</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="no-module-selected"
      >
        <i class="fas fa-hand-pointer" />
        <p>请选择页面模块后再配置字段权限</p>
      </div>
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
          :disabled="saving || loadingGroups || !selectedModule || !configReady"
          :loading="saving"
          @click="emit('save')"
        >
          <template v-if="saving">
            保存中...
          </template>
          <template v-else>
            保存配置
          </template>
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { PERMISSION_PAGE_GROUPS } from './permission-page-groups'
import type { FieldDefinition, FieldGroup, RoleFieldModule } from '../types'

type FieldModuleGroup = {
  key: string
  title: string
  parent: RoleFieldModule | null
  modules: RoleFieldModule[]
  standalone: boolean
}

const props = defineProps<{
  configReady?: boolean
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
  readonlyFields?: string[]
  editableFields?: string[]
  selectedModule: RoleFieldModule | null
}>()

const emit = defineEmits<{
  close: []
  save: []
  selectModule: [module: RoleFieldModule]
  'update:modelValue': [value: boolean]
  'update:selectedFieldGroupName': [value: string]
  'update:selectedFields': [value: string[]]
  'update:readonlyFields': [value: string[]]
  'update:editableFields': [value: string[]]
}>()

const queryScopes: { name: string; scope: RoleFieldModule['field_scope'] }[] = [
  { name: '手机模式', scope: undefined }, { name: '商品模式', scope: 'goods' }
]

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
const fieldModuleGroups = computed<FieldModuleGroup[]>(() => {
  const modules = props.modules
  const moduleMap = new Map(modules.map(module => [getModuleKey(module), module]))
  const modulePositions = new Map(modules.map((module, index) => [getModuleKey(module), index]))
  const consumed = new Set<string>()
  const groups: FieldModuleGroup[] = []

  PERMISSION_PAGE_GROUPS.forEach(config => {
    const parent = moduleMap.get(config.parentKey)
    if (!parent) return

    consumed.add(config.parentKey)
    const childKeys = new Set(config.childKeys)
    const children = config.childKeys
      .map(key => moduleMap.get(key))
      .filter((module): module is RoleFieldModule => Boolean(module))
    children.forEach(child => consumed.add(getModuleKey(child)))

    modules.forEach(module => {
      const key = getModuleKey(module)
      if (!consumed.has(key) && key.startsWith(config.prefix) && key !== config.parentKey && !childKeys.has(key)) {
        children.push(module)
        consumed.add(key)
      }
    })

    groups.push({
      key: config.parentKey,
      title: config.title,
      parent,
      modules: [parent, ...children.sort((left, right) =>
        (modulePositions.get(getModuleKey(left)) ?? modules.length) -
        (modulePositions.get(getModuleKey(right)) ?? modules.length))],
      standalone: false
    })
  })

  modules.forEach(module => {
    const key = getModuleKey(module)
    if (consumed.has(key)) return
    groups.push({ key, title: module.name, parent: null, modules: [module], standalone: true })
  })

  return groups.sort((left, right) =>
    (modulePositions.get(getModuleKey(left.modules[0])) ?? modules.length) -
    (modulePositions.get(getModuleKey(right.modules[0])) ?? modules.length))
})
const getFieldState = (field: FieldDefinition) => {
  if (selectedFieldSet.value.has(field.id)) return 'hidden'
  if (!field.editable || props.readonlyFields?.includes(field.id) ||
    (props.editableFields !== undefined && !props.editableFields.includes(field.id))) return 'readonly'
  return 'editable'
}
const allFields = computed(() => props.fieldGroups.flatMap(group => group.fields))
const editableFieldCount = computed(() => allFields.value.filter(field => getFieldState(field) === 'editable').length)
const readonlyFieldCount = computed(() => allFields.value.filter(field => getFieldState(field) === 'readonly').length)
const setFieldState = (fieldId: string, state: string | number | boolean | undefined) => {
  const nextState = state === 'hidden' || state === 'readonly' || state === 'editable' ? state : 'readonly'
  setFieldVisibility(fieldId, nextState !== 'hidden')
  if (nextState === 'hidden') return

  const readonly = new Set(props.readonlyFields || [])
  const editable = new Set(props.editableFields ?? props.fieldGroups
    .flatMap(group => group.fields)
    .filter(field => field.editable)
    .map(field => field.id))
  if (nextState === 'readonly') {
    readonly.add(fieldId)
    editable.delete(fieldId)
  } else {
    readonly.delete(fieldId)
    editable.add(fieldId)
  }
  emit('update:readonlyFields', [...readonly])
  emit('update:editableFields', [...editable])
}
const currentGroup = computed(() => {
  return props.fieldGroups.find(group => group.name === activeGroupName.value) || props.fieldGroups[0] || null
})

const getModuleKey = (module: RoleFieldModule) => module.module_key || module.key || ''
const getHiddenCount = (group: FieldGroup) => group.fields.filter(field => selectedFieldSet.value.has(field.id)).length
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
