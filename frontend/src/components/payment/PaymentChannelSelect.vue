<template>
  <el-select
    v-bind="$attrs"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </el-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPaymentChannelOptions } from '@/constants/paymentMethods'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | null
  paymentMethod?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const options = computed(() => getPaymentChannelOptions(props.paymentMethod))
</script>
