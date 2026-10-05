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
            <span
              v-if="items.length > 1"
              class="media-preview-count"
            >
              {{ currentIndex + 1 }} / {{ items.length }}
            </span>
          </div>
          <div class="media-preview-actions">
            <div
              v-if="!currentIsVideo"
              class="media-preview-zoom-actions"
              aria-label="图片缩放"
            >
              <el-button
                native-type="button"
                class="media-preview-tool"
                title="缩小图片"
                aria-label="缩小图片"
                :disabled="zoomScale <= MIN_ZOOM"
                @click.stop="changeZoom(-ZOOM_STEP)"
              >
                <i class="fas fa-search-minus" />
              </el-button>
              <el-button
                native-type="button"
                class="media-preview-tool media-preview-zoom-reset"
                title="恢复原始大小"
                aria-label="恢复原始大小"
                @click.stop="resetZoom"
              >
                {{ Math.round(zoomScale * 100) }}%
              </el-button>
              <el-button
                native-type="button"
                class="media-preview-tool"
                title="放大图片"
                aria-label="放大图片"
                :disabled="zoomScale >= MAX_ZOOM"
                @click.stop="changeZoom(ZOOM_STEP)"
              >
                <i class="fas fa-search-plus" />
              </el-button>
            </div>
            <el-button
              v-if="deletable"
              native-type="button"
              type="danger"
              class="media-preview-tool media-preview-delete"
              title="删除当前素材"
              aria-label="删除当前素材"
              @click.stop="emitDelete"
            >
              <i class="fas fa-trash" />
            </el-button>
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

        <div
          ref="stageElement"
          class="media-preview-stage"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @touchcancel="handleTouchCancel"
          @wheel="handleWheel"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
          @dblclick="toggleZoom"
          @click.stop
        >
          <video
            v-if="currentIsVideo && !loadFailed"
            ref="videoElement"
            :key="`video-${currentItem.url}`"
            :src="currentUrl"
            class="media-preview-content"
            controls
            controlslist="nodownload"
            :autoplay="autoPlayVideos"
            muted
            playsinline
            preload="metadata"
            @error="loadFailed = true"
            @loadeddata="handleVideoReady"
          >
            当前浏览器无法播放此视频。
          </video>
          <img
            v-else-if="!currentIsVideo && !loadFailed"
            :key="`image-${currentItem.url}`"
            :src="currentUrl"
            :alt="currentItem.label || '图片预览'"
            class="media-preview-content"
            :style="contentTransformStyle"
            @error="loadFailed = true"
          >
          <div
            v-else
            :key="`error-${currentItem.url}`"
            class="media-preview-error"
          >
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
import type { CSSProperties } from 'vue'
import { formatImageUrl } from '@/utils/format'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'

interface Props {
  modelValue: boolean
  items: MediaPreviewItem[]
  initialIndex?: number
  deletable?: boolean
  autoPlayVideos?: boolean
}

interface Emits {
  'update:modelValue': [value: boolean]
  change: [item: MediaPreviewItem, index: number]
  delete: [item: MediaPreviewItem, index: number]
}

const props = withDefaults(defineProps<Props>(), {
  initialIndex: 0,
  deletable: false,
  autoPlayVideos: true
})
const emit = defineEmits<Emits>()

const currentIndex = ref(0)
const videoElement = ref<HTMLVideoElement | null>(null)
const stageElement = ref<HTMLElement | null>(null)
const loadFailed = ref(false)
const touchStart = ref<{ x: number; y: number } | null>(null)
const pinchStart = ref<{ distance: number; scale: number } | null>(null)
const mouseDragStart = ref<{ x: number; y: number; panX: number; panY: number } | null>(null)
const zoomScale = ref(1)
const panX = ref(0)
const panY = ref(0)
let previousBodyOverflow = ''

const SWIPE_THRESHOLD = 40
const SWIPE_DIRECTION_RATIO = 1.2
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

const clampZoom = (value: number) => Math.min(Math.max(value, MIN_ZOOM), MAX_ZOOM)

const clampPan = (x: number, y: number) => {
  const stage = stageElement.value
  if (!stage || zoomScale.value <= MIN_ZOOM) return { x: 0, y: 0 }

  const maxX = stage.clientWidth * (zoomScale.value - 1) / 2
  const maxY = stage.clientHeight * (zoomScale.value - 1) / 2
  return {
    x: Math.min(Math.max(x, -maxX), maxX),
    y: Math.min(Math.max(y, -maxY), maxY)
  }
}

const applyZoom = (value: number) => {
  zoomScale.value = clampZoom(value)
  const nextPan = clampPan(panX.value, panY.value)
  panX.value = nextPan.x
  panY.value = nextPan.y
}

const changeZoom = (delta: number) => {
  if (currentIsVideo.value) return
  applyZoom(zoomScale.value + delta)
}

const resetZoom = () => {
  zoomScale.value = MIN_ZOOM
  panX.value = 0
  panY.value = 0
}

const toggleZoom = () => {
  if (currentIsVideo.value) return
  if (zoomScale.value > MIN_ZOOM) {
    resetZoom()
  } else {
    applyZoom(2)
  }
}

const contentTransformStyle = computed<CSSProperties>(() => ({
  transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${zoomScale.value})`,
  transformOrigin: 'center center',
  cursor: zoomScale.value > MIN_ZOOM ? 'grab' : 'zoom-in'
}))

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

const playCurrentVideo = async () => {
  if (!props.autoPlayVideos || !currentIsVideo.value || !videoElement.value) return

  // 静音自动播放符合浏览器策略，用户仍可通过原生控件开启声音。
  videoElement.value.muted = true
  try {
    await videoElement.value.play()
  } catch {
    // 浏览器策略或媒体格式不支持时保留原生控件，不打断预览流程。
  }
}

const handleVideoReady = () => {
  void playCurrentVideo()
}

const selectIndex = async (index: number) => {
  pauseVideo()
  resetZoom()
  currentIndex.value = clampIndex(index)
  loadFailed.value = false
  await nextTick()
  await playCurrentVideo()

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

const handleTouchStart = (event: TouchEvent) => {
  if (currentIsVideo.value) return

  if (event.touches.length >= 2) {
    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]
    pinchStart.value = {
      distance: Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY),
      scale: zoomScale.value
    }
    touchStart.value = null
    return
  }

  if (event.touches.length !== 1) {
    touchStart.value = null
    return
  }

  const touch = event.touches[0]
  touchStart.value = { x: touch.clientX, y: touch.clientY }
}

const handleTouchMove = (event: TouchEvent) => {
  if (currentIsVideo.value) return

  if (event.touches.length >= 2 && pinchStart.value) {
    const firstTouch = event.touches[0]
    const secondTouch = event.touches[1]
    const distance = Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY)
    if (pinchStart.value.distance > 0) {
      applyZoom(pinchStart.value.scale * distance / pinchStart.value.distance)
      event.preventDefault()
    }
    return
  }

  if (event.touches.length === 1 && touchStart.value && zoomScale.value > MIN_ZOOM) {
    const touch = event.touches[0]
    const nextPan = clampPan(touch.clientX - touchStart.value.x, touch.clientY - touchStart.value.y)
    panX.value = nextPan.x
    panY.value = nextPan.y
    event.preventDefault()
  }
}

const handleTouchEnd = (event: TouchEvent) => {
  if (pinchStart.value) {
    pinchStart.value = null
    touchStart.value = null
    return
  }

  const start = touchStart.value
  touchStart.value = null
  if (!start || props.items.length <= 1 || currentIsVideo.value || zoomScale.value > MIN_ZOOM) return

  const touch = event.changedTouches[0]
  if (!touch) return

  const deltaX = touch.clientX - start.x
  const deltaY = touch.clientY - start.y
  const horizontalDistance = Math.abs(deltaX)
  const verticalDistance = Math.abs(deltaY)

  if (
    horizontalDistance < SWIPE_THRESHOLD ||
    horizontalDistance < verticalDistance * SWIPE_DIRECTION_RATIO
  ) {
    return
  }

  if (deltaX < 0) {
    showNext()
  } else {
    showPrevious()
  }
}

const handleTouchCancel = () => {
  touchStart.value = null
  pinchStart.value = null
}

const handleWheel = (event: WheelEvent) => {
  if (currentIsVideo.value) return
  event.preventDefault()
  changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
}

const handleMouseDown = (event: MouseEvent) => {
  if (currentIsVideo.value || zoomScale.value <= MIN_ZOOM || event.button !== 0) return
  mouseDragStart.value = {
    x: event.clientX,
    y: event.clientY,
    panX: panX.value,
    panY: panY.value
  }
  event.preventDefault()
}

const handleMouseMove = (event: MouseEvent) => {
  if (!mouseDragStart.value) return
  const nextPan = clampPan(
    mouseDragStart.value.panX + event.clientX - mouseDragStart.value.x,
    mouseDragStart.value.panY + event.clientY - mouseDragStart.value.y
  )
  panX.value = nextPan.x
  panY.value = nextPan.y
}

const handleMouseUp = () => {
  mouseDragStart.value = null
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
      resetZoom()
      void selectIndex(props.initialIndex)
      document.addEventListener('keydown', handleKeydown)
      return
    }

    pauseVideo()
    resetZoom()
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
  resetZoom()
  handleMouseUp()
  document.removeEventListener('keydown', handleKeydown)
  if (props.modelValue) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.media-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tf-z-viewer);
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

.media-preview-zoom-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--tf-space-1);
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

.media-preview-tool:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.media-preview-zoom-reset {
  width: 56px;
  border-radius: var(--tf-radius-full);
  font-size: var(--tf-font-table-compact);
  font-variant-numeric: tabular-nums;
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
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
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

@media (max-width: 767px) {
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

  .media-preview-zoom-actions {
    gap: var(--tf-space-1);
  }

  .media-preview-zoom-actions .media-preview-tool {
    width: 32px;
    height: 32px;
  }

  .media-preview-zoom-actions .media-preview-zoom-reset {
    width: 44px;
  }

  .media-preview-meta {
    gap: 7px;
    font-size: 13px;
  }
}
</style>
