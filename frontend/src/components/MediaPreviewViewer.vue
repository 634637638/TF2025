<template>
  <Teleport to="body">
    <Transition name="media-preview-fade">
      <div
        v-if="modelValue && currentItem"
        class="media-preview-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="currentItem.label || mediaTypeLabel"
        @click.self="close"
      >
        <div class="media-preview-toolbar">
          <div class="media-preview-meta">
            <i :class="currentIsVideo ? 'fas fa-video' : 'fas fa-image'" />
            <span>{{ currentItem.label || mediaTypeLabel }}</span>
            <span v-if="items.length > 1" class="media-preview-count">
              {{ currentIndex + 1 }} / {{ items.length }}
            </span>
          </div>
          <div class="media-preview-actions">
            <button
              v-if="deletable"
              type="button"
              class="media-preview-tool media-preview-delete"
              title="删除当前素材"
              aria-label="删除当前素材"
              @click.stop="emitDelete"
            >
              <i class="fas fa-trash" />
            </button>
            <button
              type="button"
              class="media-preview-tool"
              title="关闭预览"
              aria-label="关闭预览"
              @click="close"
            >
              <i class="fas fa-times" />
            </button>
          </div>
        </div>

        <button
          v-if="items.length > 1"
          type="button"
          class="media-preview-nav media-preview-prev"
          title="上一个"
          aria-label="上一个"
          @click.stop="showPrevious"
        >
          <i class="fas fa-chevron-left" />
        </button>

        <div class="media-preview-stage" @click.stop>
          <video
            v-if="currentIsVideo && !loadFailed"
            ref="videoElement"
            :key="currentItem.url"
            :src="currentUrl"
            class="media-preview-content"
            controls
            controlslist="nodownload"
            playsinline
            preload="metadata"
            @error="loadFailed = true"
          >
            当前浏览器无法播放此视频。
          </video>
          <img
            v-else-if="!currentIsVideo && !loadFailed"
            :key="currentItem.url"
            :src="currentUrl"
            :alt="currentItem.label || '图片预览'"
            class="media-preview-content"
            @error="loadFailed = true"
          >
          <div v-else class="media-preview-error">
            <i class="fas fa-exclamation-circle" />
            <span>{{ currentIsVideo ? '视频加载失败或格式不受支持' : '图片加载失败' }}</span>
          </div>
        </div>

        <button
          v-if="items.length > 1"
          type="button"
          class="media-preview-nav media-preview-next"
          title="下一个"
          aria-label="下一个"
          @click.stop="showNext"
        >
          <i class="fas fa-chevron-right" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { formatImageUrl } from '@/utils/format'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'

interface Props {
  modelValue: boolean
  items: MediaPreviewItem[]
  initialIndex?: number
  deletable?: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  change: [item: MediaPreviewItem, index: number]
  delete: [item: MediaPreviewItem, index: number]
}

const props = withDefaults(defineProps<Props>(), {
  initialIndex: 0,
  deletable: false
})
const emit = defineEmits<Emits>()

const currentIndex = ref(0)
const videoElement = ref<HTMLVideoElement | null>(null)
const loadFailed = ref(false)
let previousBodyOverflow = ''

const clampIndex = (index: number) => {
  if (props.items.length === 0) return 0
  return Math.min(Math.max(index, 0), props.items.length - 1)
}

const currentItem = computed(() => props.items[currentIndex.value] || null)
const currentIsVideo = computed(() => isVideoMedia(currentItem.value))
const currentUrl = computed(() => currentItem.value ? formatImageUrl(currentItem.value.url) : '')
const mediaTypeLabel = computed(() => currentIsVideo.value ? '视频预览' : '图片预览')

const pauseVideo = () => {
  videoElement.value?.pause()
}

const selectIndex = async (index: number) => {
  pauseVideo()
  currentIndex.value = clampIndex(index)
  loadFailed.value = false
  await nextTick()

  if (currentItem.value) {
    emit('change', currentItem.value, currentIndex.value)
  }
}

const showPrevious = () => {
  const nextIndex = (currentIndex.value - 1 + props.items.length) % props.items.length
  void selectIndex(nextIndex)
}

const showNext = () => {
  const nextIndex = (currentIndex.value + 1) % props.items.length
  void selectIndex(nextIndex)
}

const close = () => {
  pauseVideo()
  emit('update:modelValue', false)
}

const emitDelete = () => {
  if (currentItem.value) {
    emit('delete', currentItem.value, currentIndex.value)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.modelValue) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'ArrowLeft' && props.items.length > 1) {
    event.preventDefault()
    showPrevious()
  } else if (event.key === 'ArrowRight' && props.items.length > 1) {
    event.preventDefault()
    showNext()
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      void selectIndex(props.initialIndex)
      document.addEventListener('keydown', handleKeydown)
      return
    }

    pauseVideo()
    document.body.style.overflow = previousBodyOverflow
    document.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true }
)

watch(
  () => props.initialIndex,
  (index) => {
    if (props.modelValue) void selectIndex(index)
  }
)

watch(
  () => props.items.length,
  () => {
    currentIndex.value = clampIndex(currentIndex.value)
    loadFailed.value = false
    if (props.modelValue && props.items.length === 0) close()
  }
)

onUnmounted(() => {
  pauseVideo()
  document.removeEventListener('keydown', handleKeydown)
  if (props.modelValue) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.media-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 64px;
  grid-template-rows: 64px minmax(0, 1fr) 32px;
  align-items: center;
  background: rgba(8, 12, 18, 0.94);
}

.media-preview-toolbar {
  grid-column: 1 / -1;
  grid-row: 1;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  color: var(--color-bg-white);
}

.media-preview-meta,
.media-preview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.media-preview-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-preview-count {
  flex: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.media-preview-tool,
.media-preview-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-bg-white);
  cursor: pointer;
}

.media-preview-tool:hover,
.media-preview-nav:hover {
  background: rgba(255, 255, 255, 0.2);
}

.media-preview-delete {
  border-color: rgba(248, 113, 113, 0.6);
  background: rgba(185, 28, 28, 0.72);
}

.media-preview-stage {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.media-preview-content {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  background: var(--tf-color-neutral-900);
}

video.media-preview-content {
  width: min(100%, 1200px);
}

.media-preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.82);
}

.media-preview-error i {
  font-size: 30px;
}

.media-preview-nav {
  grid-row: 2;
  justify-self: center;
}

.media-preview-prev {
  grid-column: 1;
}

.media-preview-next {
  grid-column: 3;
}

.media-preview-fade-enter-active,
.media-preview-fade-leave-active {
  transition: opacity 0.18s ease;
}

.media-preview-fade-enter-from,
.media-preview-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .media-preview-overlay {
    grid-template-columns: 48px minmax(0, 1fr) 48px;
    grid-template-rows: calc(58px + env(safe-area-inset-top)) minmax(0, 1fr) calc(20px + env(safe-area-inset-bottom));
  }

  .media-preview-toolbar {
    padding: calc(8px + env(safe-area-inset-top)) 8px 8px;
  }

  .media-preview-tool,
  .media-preview-nav {
    width: 38px;
    height: 38px;
  }

  .media-preview-meta {
    gap: 7px;
    font-size: 13px;
  }
}
</style>
