<template>
  <el-button
    v-bind="$attrs"
    class="tf-button--search"
    :loading="loading"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <i
      class="fas fa-search"
      aria-hidden="true"
    />
    <slot>搜索</slot>
  </el-button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
}>(), {
  loading: false,
  disabled: false
})
</script>
