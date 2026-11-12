<template>
  <i
    v-if="safeSvg"
    v-bind="$attrs"
    class="icon-renderer icon-renderer--svg"
    :class="className"
    v-html="safeSvg"
  />
  <i
    v-else
    v-bind="$attrs"
    class="icon-renderer"
    :class="[icon || fallback, className]"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { extractIconifyName } from '@/utils/iconify'
import { iconService } from '@/services/icons'
import { sanitizeIconSvg } from '@/utils/icon-svg'
import fallbackSvg from '@/assets/icons/fallback.svg?raw'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(defineProps<{
  icon?: string | null
  svg?: string | null
  className?: string
  fallback?: string
  /** 选择器候选由批量预览接口提供 SVG，禁止逐个查询本地库。 */
  onlinePreview?: boolean
}>(), {
  icon: '',
  svg: '',
  className: '',
  fallback: 'fas fa-circle',
  onlinePreview: false
})

const localSvg = ref('')
const suppliedSvg = computed(() => sanitizeIconSvg(props.svg))
const safeSvg = computed(() => suppliedSvg.value || localSvg.value
  || (iconifyName.value ? sanitizeIconSvg(fallbackSvg) : ''))

const iconifyName = computed(() => extractIconifyName(String(props.icon || '').trim()) || '')

watch([() => props.icon, suppliedSvg, () => props.onlinePreview], async ([icon, svg, online], _previous, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  localSvg.value = ''
  if (svg || online || !extractIconifyName(String(icon || '').trim())) return
  try {
    const record = await iconService.byClass(String(icon))
    if (active) localSvg.value = sanitizeIconSvg(record?.svg)
  } catch {
    // 本地图标不存在或接口暂不可用时保留本地占位，不回退外站请求。
  }
}, { immediate: true })

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
}

.icon-renderer--svg {
  fill: currentColor;
}
</style>
