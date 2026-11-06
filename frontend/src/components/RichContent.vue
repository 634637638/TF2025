<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    class="tf-rich-content"
    v-html="safeHtml"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'

const props = defineProps<{ content: string }>()
const safeHtml = computed(() => DOMPurify.sanitize(props.content || '', {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['style', 'controls', 'poster', 'colspan', 'rowspan', 'target', 'rel']
}))
</script>

<style scoped>
.tf-rich-content { min-width: 0; overflow-wrap: anywhere; line-height: 1.7; white-space: pre-wrap; }
.tf-rich-content :deep(p) { margin-block: 0; }
.tf-rich-content :deep(img), .tf-rich-content :deep(video), .tf-rich-content :deep(audio) { max-width: 100%; }
.tf-rich-content :deep(img), .tf-rich-content :deep(video) { height: auto; }
.tf-rich-content :deep(table) { max-width: 100%; border-collapse: collapse; }
.tf-rich-content :deep(th), .tf-rich-content :deep(td) { padding: var(--tf-space-2); border: 1px solid var(--tf-color-border-muted); overflow-wrap: anywhere; }
.tf-rich-content :deep(a) { overflow-wrap: anywhere; }
</style>
