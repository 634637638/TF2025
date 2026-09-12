<template>
  <span v-bind="$attrs">{{ getPaymentMethodLabel(value, fallback) }}</span>
</template>

<script setup lang="ts">
import { getPaymentMethodLabel } from '@/constants/paymentMethods'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  value: unknown
  fallback?: string
}>(), {
  fallback: '-'
})
</script>
