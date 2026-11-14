<template>
  <el-input-number
    ref="inputRef"
    :step="0.01"
    v-bind="$attrs"
    class="price-input-number"
    :model-value="normalizedValue"
    :precision="inputPrecision"
    :controls="false"
    inputmode="decimal"
    @update:model-value="updateValue"
    @input="handleInput"
    @change="handleChange"
    @blur="handleBlur"
    @focus="emit('focus', $event)"
  >
    <template
      v-for="(_, name) in $slots"
      #[name]="slotData"
    >
      <slot
        :name="name"
        v-bind="slotData || {}"
      />
    </template>
  </el-input-number>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { ElInputNumber } from 'element-plus'
import { formatAmount } from '@/utils/format'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: number | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: number | null | undefined]
  input: [value: number | null | undefined]
  change: [value: number | null | undefined, previous: number | null | undefined]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()
const inputRef = ref<InstanceType<typeof ElInputNumber> | null>(null)
const inputPrecision = ref<number>()
const normalize = (value: number | null | undefined): number | null | undefined => (
  value === null || value === undefined
    ? value
    : !Number.isFinite(value) ? undefined
      : Number(formatAmount(value))
)
const normalizedValue = computed(() => normalize(props.modelValue))
const updateValue = (value: number | null | undefined) => emit('update:modelValue', normalize(value))

// 在组件库 Number() 转换前检查原文，允许负号和小数点等编辑中间态。
// 不删除非法字符、也不把错误粘贴转换成另一金额。
const editableDecimal = /^-?\d*(?:\.\d*)?$(?![\s\S])/
let composing = false
const rejectInput = (event: Event) => {
  event.preventDefault()
  event.stopImmediatePropagation()
}
const guardNativeInput = (event: Event) => {
  if (event.type === 'compositionstart') { composing = true; return }
  if (event.type === 'compositionend') composing = false
  if (composing || (event instanceof InputEvent && event.isComposing)) {
    if (event.type === 'input') event.stopImmediatePropagation()
    return
  }
  if (event.type === 'beforeinput') {
    if (event instanceof InputEvent && event.data !== null && !/^[\d.\-]*$(?![\s\S])/.test(event.data)) rejectInput(event)
    return
  }
  if (event.type === 'paste') {
    const text = (event as ClipboardEvent).clipboardData?.getData('text')
    if (text !== undefined && !editableDecimal.test(text)) rejectInput(event)
    return
  }
  if (!(event.target instanceof HTMLInputElement)) return
  const value = event.target.value
  const compositionData = event instanceof CompositionEvent ? event.data : ''
  if ((compositionData && !editableDecimal.test(compositionData)) || !editableDecimal.test(value) || (value && !['-', '.', '-.'].includes(value) && !Number.isFinite(Number(value)))) {
    rejectInput(event)
    event.target.value = String(normalizedValue.value ?? '')
  }
}

const nativeEvents = ['beforeinput', 'paste', 'input', 'compositionstart', 'compositionend']
let nativeRoot: HTMLElement | undefined
onMounted(() => {
  nativeRoot = inputRef.value?.$el
  nativeEvents.forEach(type => nativeRoot?.addEventListener(type, guardNativeInput, true))
})
onBeforeUnmount(() => {
  nativeEvents.forEach(type => nativeRoot?.removeEventListener(type, guardNativeInput, true))
})

// 编辑时保留组件库的两位小数校验；完成编辑后按数值展示，避免补 .00。
const handleInput = (value: number | null | undefined) => {
  inputPrecision.value = 2
  emit('input', normalize(value))
}
const handleChange = (value: number | null | undefined, previous: number | null | undefined) => {
  inputPrecision.value = undefined
  emit('change', normalize(value), normalize(previous))
}
const handleBlur = (event: FocusEvent) => {
  inputPrecision.value = undefined
  emit('blur', event)
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur()
})
</script>
