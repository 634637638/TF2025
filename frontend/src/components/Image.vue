<!--
  Image - 全局统一图片组件
  合并了 AppImage、SmartImage、LazyImage 的功能

  功能：
  - 自动处理后端图片URL，拼接完整的后端域名
  - 支持相对路径和完整URL
  - 支持懒加载（IntersectionObserver）
  - 支持URL降级策略（HTTP/HTTPS兼容）
  - 支持默认图片和错误处理

  使用示例：
  <Image src="product.image" alt="产品图片" />
  <Image src="/uploads/shop/xxx.jpg" width="200" height="200" />
  <Image src="xxx.jpg" mode="smart" />  <!-- 启用智能降级 -->
-->
<template>
  <div
    v-if="mode === 'lazy'"
    ref="container"
    class="tf-image lazy-container"
    :style="containerStyle"
  >
    <img
      v-if="loaded && !hasError"
      :src="currentSrc"
      :alt="alt"
      :style="imageStyle"
      class="tf-image-img"
      :class="{ 'fade-in': fadeIn }"
      @load="handleLoad"
      @error.stop="handleImageError"
    />
    <div v-else-if="hasError" class="tf-image-error">
      <slot name="error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>图片加载失败</span>
      </slot>
    </div>
    <div v-else class="tf-image-placeholder">
      <slot name="placeholder">
        <i class="fas fa-image fa-spin"></i>
      </slot>
    </div>
  </div>

  <img
    v-else
    :src="currentSrc"
    :alt="alt"
    :style="imageStyle"
    class="tf-image"
    :class="[
      `tf-image--${mode}`,
      { 'tf-image--error': hasError, 'fade-in': fadeIn && !hasError }
    ]"
    @error.stop="handleImageError"
    @load="handleLoad"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { formatImageUrl, generateProductPlaceholder, getBackendOrigin, type ProductPlaceholderOptions } from '@/utils/format'

interface Props {
  src?: string
  alt?: string
  width?: string | number
  height?: string | number
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  mode?: 'eager' | 'lazy' | 'smart'
  defaultImage?: string
  fallback?: string
  fadeIn?: boolean
  threshold?: number
  // 商品信息，用于生成占位图
  productInfo?: {
    brand?: string
    model?: string
    color?: string
    memory?: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  alt: '',
  mode: 'lazy',
  fit: 'cover',
  fadeIn: true,
  threshold: 0.1,
  defaultImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3E%E6%97%A0%E5%9B%BE%E7%89%87%3C/text%3E%3C/svg%3E'
})

interface Emits {
  error: [event: Event]
  load: [event: Event]
  retry: [url: string]
}

const emit = defineEmits<Emits>()

// 状态
const hasError = ref(false)
const loaded = ref(props.mode !== 'lazy')
const container = ref<HTMLElement | null>(null)
const hasFallbackApplied = ref(false)

// URL降级相关
const urlCandidates = ref<string[]>([])
const currentIndex = ref(0)
const currentSrc = ref('')

let observer: IntersectionObserver | null = null

// 获取回退图片（优先使用商品信息生成的占位图）
const getFallbackSrc = (): string => {
  // 如果有商品信息，生成基于商品信息的占位图
  if (props.productInfo) {
    return generateProductPlaceholder(props.productInfo as ProductPlaceholderOptions)
  }
  return props.defaultImage || props.fallback || ''
}

// 样式
const imageStyle = computed(() => {
  const style: Record<string, any> = { objectFit: props.fit }

  if (props.width) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  if (props.height) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  return style
})

const containerStyle = computed(() => ({
  width: props.width ? (typeof props.width === 'number' ? `${props.width}px` : props.width) : '100%',
  height: props.height ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : '100%',
  position: 'relative',
  overflow: 'hidden',
  background: '#f5f5f5'
}))

// 智能URL生成（用于smart模式）
const generateSmartUrl = (src: string): string[] => {
  if (!src) return []

  const normalizedSource = formatImageUrl(src)
  if (!normalizedSource) {
    return []
  }

  if (
    normalizedSource.startsWith('data:') ||
    normalizedSource.startsWith('blob:') ||
    normalizedSource.startsWith('http://') ||
    normalizedSource.startsWith('https://')
  ) {
    return [normalizedSource]
  }

  const candidates: string[] = []
  const normalizedPath = normalizedSource.startsWith('/') ? normalizedSource : `/${normalizedSource}`

  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const backendOrigin = getBackendOrigin()

  if (isHttpsPage) {
    // HTTPS 页面优先尝试后端公网域名，其次走当前站点代理
    if (backendOrigin) {
      candidates.push(`${backendOrigin}${normalizedPath}`)
    }
    candidates.push(normalizedPath)
  } else {
    if (backendOrigin) {
      candidates.push(`${backendOrigin}${normalizedPath}`)
    } else {
      candidates.push(normalizedPath)
    }
  }

  return candidates
}

// 初始化URL
const initializeUrl = () => {
  if (!props.src) {
    currentSrc.value = getFallbackSrc()
    return
  }

  if (props.mode === 'smart') {
    urlCandidates.value = generateSmartUrl(props.src)
    currentIndex.value = 0
    currentSrc.value = urlCandidates.value[0] || ''
  } else {
    currentSrc.value = formatImageUrl(props.src)
  }
}

// 处理图片加载错误
const handleImageError = () => {
  if (props.mode === 'smart' && currentIndex.value < urlCandidates.value.length - 1) {
    // 尝试降级到下一个URL
    currentIndex.value++
    currentSrc.value = urlCandidates.value[currentIndex.value]
    emit('retry', currentSrc.value)
  } else if (!hasFallbackApplied.value && getFallbackSrc()) {
    hasFallbackApplied.value = true
    hasError.value = false
    currentSrc.value = getFallbackSrc()
    loaded.value = true
  } else {
    hasError.value = true
    emit('error', new Event('error'))
  }
}

// 处理图片加载成功
const handleLoad = () => {
  hasError.value = false
  loaded.value = true
  emit('load', new Event('load'))
}

// 懒加载观察器
const setupLazyObserver = () => {
  if (props.mode !== 'lazy' || !container.value) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loaded.value = true
          observer?.disconnect()
        }
      })
    },
    { threshold: props.threshold }
  )

  observer.observe(container.value)
}

// 监听src变化
watch(() => props.src, () => {
  hasError.value = false
  hasFallbackApplied.value = false
  loaded.value = props.mode !== 'lazy'
  currentIndex.value = 0
  observer?.disconnect()
  initializeUrl()

  if (props.mode === 'lazy') {
    nextTick(() => {
      setupLazyObserver()
    })
  }
})

// 组件挂载时初始化
onMounted(() => {
  initializeUrl()
  setupLazyObserver()
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<style scoped>
.tf-image {
  display: block;
  max-width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
}

.tf-image--lazy {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
}

.tf-image--smart {
  width: 100%;
  height: 100%;
}

.tf-image--error {
  opacity: 0.5;
}

.tf-image[src=""] {
  opacity: 0;
}

.tf-image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fade-in {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.tf-image-placeholder,
.tf-image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  color: #999;
  font-size: 14px;
}

.tf-image-placeholder i {
  font-size: 24px;
  color: #ddd;
}

.tf-image-error {
  color: #f56c6c;
}

.tf-image-error i {
  font-size: 24px;
}
</style>
