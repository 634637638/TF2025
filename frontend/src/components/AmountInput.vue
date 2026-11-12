<template>
  <el-input-number
    ref="inputRef"
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
import { computed, ref } from 'vue'
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
