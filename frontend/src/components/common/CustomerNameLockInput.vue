<template>
  <div
    class="customer-name-lock-input"
    :class="{
      'is-selected': selected,
      'is-editing': editing,
      'is-hard-locked': locked
    }"
  >
    <el-input
      ref="inputRef"
      v-bind="$attrs"
      :model-value="modelValue"
      :placeholder="placeholder"
      :readonly="isReadonly"
      @update:model-value="handleUpdate"
      @dblclick="handleUnlock"
      @touchend="emit('touchend', $event)"
      @blur="emit('blur')"
      @keyup.enter="handleEnter"
    >
      <template
        v-if="$slots.prefix"
        #prefix
      >
        <slot name="prefix" />
      </template>
      <template
        v-if="$slots.suffix"
        #suffix
      >
        <slot name="suffix" />
      </template>
    </el-input>

    <div
      v-if="selected || editing"
      class="customer-name-lock-input__controls"
    >
      <el-button
        v-if="editing && !locked"
        native-type="button"
        class="customer-name-lock-input__status customer-name-lock-input__status--editing"
        title="保存姓名并重新锁定"
        aria-label="保存姓名并重新锁定"
        @mousedown.prevent
        @click="emit('save')"
      >
        <i
          class="fas fa-lock-open"
          aria-hidden="true"
        />
      </el-button>
      <span
        v-else-if="selected"
        class="customer-name-lock-input__status"
        title="已锁定，双击姓名输入框可编辑"
        role="img"
        aria-label="已锁定，双击姓名输入框可编辑"
      >
        <i
          class="fas fa-lock"
          aria-hidden="true"
        />
      </span>

      <el-button
        v-if="selected && clearable && !locked && !editing"
        native-type="button"
        class="customer-name-lock-input__change"
        title="更换客户"
        aria-label="更换客户"
        @mousedown.prevent
        @click="emit('clear')"
      >
        <i class="fas fa-exchange-alt" />
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  selected?: boolean
  editing?: boolean
  creating?: boolean
  locked?: boolean
  allowUnselectedEdit?: boolean
  clearable?: boolean
  placeholder?: string
}>(), {
  modelValue: '',
  selected: false,
  editing: false,
  creating: false,
  locked: false,
  allowUnselectedEdit: false,
  clearable: true,
  placeholder: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [value: string]
  unlock: [event: MouseEvent]
  touchend: [event: TouchEvent]
  blur: []
  save: []
  clear: []
}>()

const inputRef = ref<any>(null)
const input = computed<HTMLInputElement | null>(() => inputRef.value?.input || null)

const isReadonly = computed(() => {
  if (props.locked) return true
  if (props.selected) return !props.editing
  return !(props.creating || props.allowUnselectedEdit)
})

const handleUpdate = (value: string) => {
  emit('update:modelValue', value)
  emit('input', value)
}

const handleUnlock = (event: MouseEvent) => {
  if (!props.selected || props.locked || props.editing) return
  emit('unlock', event)
}

const handleEnter = () => {
  if (props.editing) emit('save')
}

defineExpose({ input, focus: () => input.value?.focus() })
</script>

<style scoped lang="scss">
.customer-name-lock-input {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.customer-name-lock-input :deep(.el-input) {
  flex: 1 1 auto;
  width: 0;
  min-width: 0;
}

.customer-name-lock-input__controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  height: 32px;
}

.customer-name-lock-input__status,
.customer-name-lock-input__change {
  box-sizing: border-box;
  height: var(--tf-button-height-small);
  max-height: var(--tf-button-height-small);
  border: 1px solid var(--tf-color-border-input);
  border-radius: var(--tf-radius-control);
  font-family: inherit;
  font-size: var(--tf-type-scale-11);
  line-height: 1;
  white-space: nowrap;
}

.customer-name-lock-input__status {
  display: inline-flex;
  width: var(--tf-button-height-small);
  min-width: var(--tf-button-height-small);
  align-items: center;
  justify-content: center;
  padding: 0;
  background: var(--tf-color-surface-muted);
  color: var(--tf-color-text-secondary);
}

.el-button.customer-name-lock-input__status,
.customer-name-lock-input__change {
  height: var(--tf-button-height-small);
  min-height: var(--tf-button-height-small);
  max-height: var(--tf-button-height-small);
  padding: 0;
  cursor: pointer;
}

.customer-name-lock-input__status--editing {
  border-color: var(--tf-button-success-border);
  background: var(--tf-button-success-soft-bg);
  color: var(--tf-button-success-soft-color);
}

.customer-name-lock-input__change {
  display: inline-flex;
  width: var(--tf-button-height-small);
  min-width: var(--tf-button-height-small);
  max-width: var(--tf-button-height-small);
  align-items: center;
  justify-content: center;
  background: var(--tf-button-neutral-bg);
  color: var(--tf-button-neutral-color);
}

.customer-name-lock-input__status--editing:hover,
.customer-name-lock-input__status--editing:focus-visible,
.customer-name-lock-input__change:hover,
.customer-name-lock-input__change:focus-visible {
  outline: 0;
  border-color: var(--tf-button-neutral-hover-border);
  filter: brightness(0.98);
}

.customer-name-lock-input.is-hard-locked .customer-name-lock-input__status {
  opacity: 0.78;
}

@media (max-width: 479px) {
  .customer-name-lock-input {
    gap: 4px;
  }

  .customer-name-lock-input__controls {
    gap: 3px;
  }

  .customer-name-lock-input__status,
  .customer-name-lock-input__change {
    width: var(--tf-button-height-small);
    min-width: var(--tf-button-height-small);
    max-width: var(--tf-button-height-small);
  }
}
</style>
