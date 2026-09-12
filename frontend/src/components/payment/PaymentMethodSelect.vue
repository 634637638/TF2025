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
import {
  BATCH_SALE_PAYMENT_METHODS,
  REFUND_PAYMENT_METHODS,
  RENTAL_PAYMENT_METHODS,
  SALE_PAYMENT_METHODS,
  SETTLEMENT_PAYMENT_METHODS,
  type PaymentMethodValue
} from '@/constants/paymentMethods'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | null
  variant?: 'sale' | 'batch-sale' | 'rental' | 'settlement' | 'refund'
}>(), {
  modelValue: '',
  variant: 'sale'
})

const emit = defineEmits<{
  'update:modelValue': [value: PaymentMethodValue | string]
}>()

const options = computed(() => {
  if (props.variant === 'settlement') return SETTLEMENT_PAYMENT_METHODS
  if (props.variant === 'refund') return REFUND_PAYMENT_METHODS
  if (props.variant === 'batch-sale') return BATCH_SALE_PAYMENT_METHODS
  if (props.variant === 'rental') return RENTAL_PAYMENT_METHODS
  return SALE_PAYMENT_METHODS
})
</script>
