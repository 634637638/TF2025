<template>
  <span
    v-if="safeSvg"
    class="icon-renderer icon-renderer--svg"
    :class="className"
    v-html="safeSvg"
  ></span>
  <span
    v-else-if="iconifyName"
    class="icon-renderer icon-renderer--iconify-mask"
    :class="className"
    :style="iconifyMaskStyle"
  ></span>
  <i
    v-else
    class="icon-renderer"
    :class="[icon || fallback, className]"
  ></i>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { extractIconifyName } from '@/utils/iconify'

const props = withDefaults(defineProps<{
  icon?: string | null
  svg?: string | null
  className?: string
  fallback?: string
}>(), {
  icon: '',
  svg: '',
  className: '',
  fallback: 'fas fa-circle'
})

const safeSvg = computed(() => {
  const svg = String(props.svg || '').trim()
  if (!svg || !/^<svg[\s>]/i.test(svg)) {
    return ''
  }

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'style']
  })
})

const iconifyName = computed(() => extractIconifyName(String(props.icon || '').trim()) || '')

const iconifyMaskStyle = computed(() => {
  if (!iconifyName.value) {
    return {}
  }

  const separatorIndex = iconifyName.value.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === iconifyName.value.length - 1) {
    return {}
  }

  const prefix = encodeURIComponent(iconifyName.value.slice(0, separatorIndex))
  const name = iconifyName.value
    .slice(separatorIndex + 1)
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const url = `https://api.iconify.design/${prefix}/${name}.svg`

  return {
    '--iconify-mask-url': `url("${url}")`
  }
})
</script>

<style scoped>
.icon-renderer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  line-height: 1;
}

.icon-renderer--svg :deep(svg) {
  width: 1em;
  height: 1em;
  display: block;
  fill: currentColor;
}

.icon-renderer--iconify-mask {
  background-color: currentColor;
  mask: var(--iconify-mask-url) center / contain no-repeat;
  -webkit-mask: var(--iconify-mask-url) center / contain no-repeat;
}
</style>
