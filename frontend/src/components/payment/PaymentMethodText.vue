<template>
  <span v-bind="$attrs">{{ getPaymentMethodLabel(value, fallback) }}<template v-if="channel"> / {{ getPaymentMethodLabel(channel) }}</template></span>
</template>

<script setup lang="ts">
import { getPaymentMethodLabel } from '@/constants/paymentMethods'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  value: unknown
  channel?: string | null
  fallback?: string
}>(), {
  channel: null,
  fallback: '-'
})
</script>
