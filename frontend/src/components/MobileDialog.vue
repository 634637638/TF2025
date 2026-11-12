<template>
  <Teleport to="body">
    <transition
      name="mobile-dialog-sheet-fade"
      appear
      @after-enter="handleMobileAfterEnter"
      @after-leave="handleMobileAfterLeave"
    >
      <div
        v-if="activeUseMobileSheet && mobileSheetMounted"
        v-show="dialogVisible"
        :class="overlayClasses"
        :style="{ zIndex: `calc(var(--tf-z-dialog-sheet) + ${overlayOrder})` }"
        @pointerdown="handleOverlayPointerDown"
        @pointermove="handleOverlayPointerMove"
        @pointerup="handleOverlayPointerUp"
        @pointercancel="resetOverlayPointer"
        @click.self="handleOverlayClick"
      >
        <ElFocusTrap
          v-slot="{ handleKeydown: trapKeydown }"
          :trapped="dialogVisible"
          :focus-trap-el="sheetPanel || undefined"
          focus-start-el="container"
          loop
          @release-requested="handleKeydown"
        >
          <div
            ref="sheetPanel"
            :class="sheetDialogClasses"
            :style="dialogSizeStyle"
            role="dialog"
            aria-modal="true"
            :aria-label="title || '对话框'"
            tabindex="-1"
            @keydown="trapKeydown"
          >
            <div
              v-if="showSheetHeader"
              class="el-dialog__header mobile-dialog-sheet-header"
            >
              <div
                v-if="$slots.header"
                class="mobile-dialog-header mobile-dialog-sheet-header-content"
              >
                <slot name="header" />
              </div>
              <div
                v-else
                class="mobile-dialog-sheet-title-wrap"
              >
                <span class="el-dialog__title mobile-dialog-sheet-title">{{ title }}</span>
              </div>

              <el-button
                v-if="showClose"
                native-type="button"
                text
                circle
                class="el-dialog__headerbtn mobile-dialog-sheet-close tf-button--dialog-close"
                aria-label="关闭"
                @click="handleSheetClose"
              >
                <i class="el-dialog__close el-icon">
                  <svg
                    viewBox="0 0 1024 1024"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill="currentColor"
                      d="M764.288 214.656a42.624 42.624 0 0 1 60.224 60.288L572.16 527.104l252.352 252.224a42.624 42.624 0 1 1-60.224 60.288L512 587.392 259.648 839.616a42.624 42.624 0 1 1-60.224-60.288l252.352-252.224L199.424 274.944a42.624 42.624 0 0 1 60.224-60.288L512 466.88z"
                    />
                  </svg>
                </i>
              </el-button>
            </div>

            <div class="el-dialog__body mobile-dialog-sheet-body">
              <slot>
                <div class="dialog-content">
                  <slot name="content" />
                </div>
              </slot>
            </div>

            <div
              v-if="$slots.footer || showDefaultFooter"
              class="el-dialog__footer mobile-dialog-sheet-footer"
            >
              <template v-if="$slots.footer">
                <slot name="footer" />
              </template>
              <div
                v-else-if="showDefaultFooter"
                class="default-footer"
              >
                <el-button
                  v-if="showCancelButton"
                  size="large"
                  :disabled="loading"
                  @click="handleCancel"
                >
                  {{ cancelText }}
                </el-button>
                <el-button
                  type="primary"
                  size="large"
                  :loading="loading"
                  @click="handleConfirm"
                >
                  {{ confirmText }}
                </el-button>
              </div>
            </div>
          </div>
        </ElFocusTrap>
      </div>
    </transition>
  </Teleport>

  <el-dialog
    v-if="!activeUseMobileSheet"
    v-model="dialogVisible"
    :title="title"
    align-center
    center
    :fullscreen="isFullscreen || forceFullscreen"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :show-close="showClose"
    :draggable="draggable"
    :destroy-on-close="destroyOnClose"
    :before-close="beforeClose"
    :modal-class="computedModalClass"
    :class="[computedDialogClass, { 'is-mobile': isMobile, 'is-tablet': isTablet, 'is-auto-height': props.autoHeight }]"
    :style="dialogSizeStyle"
    v-bind="$attrs"
    @open="handleOpen"
    @opened="handleOpened"
    @close="handleClose"
    @closed="handleClosed"
  >
    <slot>
      <div class="dialog-content">
        <slot name="content" />
      </div>
    </slot>

    <template
      v-if="$slots.header"
      #header
    >
      <div class="mobile-dialog-header">
        <slot name="header" />
      </div>
    </template>

    <template
      v-if="$slots.footer || showDefaultFooter"
      #footer
    >
      <template v-if="$slots.footer">
        <slot name="footer" />
      </template>
      <div
        v-else-if="showDefaultFooter"
        class="tf-dialog-actions default-footer"
      >
        <el-button
          v-if="showCancelButton"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </el-button>
        <el-button
          type="primary"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted, useSlots, ref, onMounted } from 'vue'
import type { CancelEmits, CloseEmits, ConfirmEmits, UpdateModelValueEmits } from '@/types/component'
import { useMobile } from '@/composables/mobile'
import { useOverlayStack } from '@/composables/useOverlayStack'
import { ElFocusTrap } from 'element-plus/es/components/focus-trap/index'

defineOptions({
  inheritAttrs: false
})

interface Props {
  modelValue: boolean
  title?: string
  width?: string | number
  maxWidth?: string | number
  fullscreen?: boolean
  forceFullscreen?: boolean // 强制全屏（移动端）
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  showClose?: boolean
  draggable?: boolean
  loading?: boolean
  showDefaultFooter?: boolean
  showCancelButton?: boolean
  confirmText?: string
  cancelText?: string
  dialogClass?: string | string[]
  autoHeight?: boolean
  destroyOnClose?: boolean
  beforeClose?: (done: (cancel?: boolean) => void) => void
  // 响应式断点配置
  mobileBreakpoint?: number
  tabletBreakpoint?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: undefined,
  maxWidth: undefined,
  fullscreen: false,
  forceFullscreen: false,
  closeOnClickModal: true,
  closeOnPressEscape: true,
  showClose: true,
  draggable: true,
  loading: false,
  showDefaultFooter: true,
  showCancelButton: true,
  confirmText: '确定',
  cancelText: '取消',
  dialogClass: '',
  autoHeight: false,
  destroyOnClose: false,
  beforeClose: undefined,
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024
})

const slots = useSlots()

interface Emits extends UpdateModelValueEmits, ConfirmEmits, CancelEmits, CloseEmits {
  open: []
  opened: []
  closed: []
}

const emit = defineEmits<Emits>()

// 响应式检测
const { isMobile, isTablet, screenSize } = useMobile()
const mobileSheetMounted = ref(props.modelValue)
const sheetPanel = ref<HTMLElement | null>(null)
let sheetClosing = false
let sheetOpened = false

// screenWidth 兼容
const screenWidth = computed(() => screenSize.value.width)

// 对话框可见性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 是否全屏显示
const isFullscreen = computed(() => {
  if (props.fullscreen) return true
  if (props.forceFullscreen) return true
  // 小屏移动端自动全屏
  return isMobile.value && screenWidth.value < 480
})

const destroyOnClose = computed(() => props.destroyOnClose)

// 页面尺寸可选；全局 CSS 自动选择页面宽度、档位或默认值，并按视口限制上限。
const normalizeCssSize = (value?: string | number) => {
  if (value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value.trim() || undefined
}

const dialogSizeStyle = computed(() => {
  const width = normalizeCssSize(props.width)
  const maxWidth = normalizeCssSize(props.maxWidth)
  // 只有明确的长度可自动扩展公共上限；百分比、视口单位、表达式和
  // 内容自适应宽度继续受全局上限约束，工作台可用 maxWidth 显式声明上限。
  const widthLimit = width && /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|ex|cm|mm|q|in|pt|pc)$/i.test(width)
    ? width
    : undefined
  const limit = maxWidth || widthLimit

  return {
    ...(width ? { '--tf-dialog-explicit-width': width } : {}),
    ...(limit ? { '--tf-dialog-explicit-max-width': limit } : {})
  }
})

const useMobileSheet = computed(() => screenWidth.value <= props.tabletBreakpoint)
const lockedMobileSheet = ref(useMobileSheet.value)
const activeUseMobileSheet = computed(() => lockedMobileSheet.value)
const { isTop, order: overlayOrder } = useOverlayStack(dialogVisible, computed(() => activeUseMobileSheet.value ? 0 : 1))

// 计算 dialog class
const normalizeClassList = (value?: string | string[]) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.flatMap(item => String(item).split(/\s+/).filter(Boolean))
  }
  return String(value).split(/\s+/).filter(Boolean)
}

const computedDialogClassList = computed(() => {
  return ['mobile-dialog', ...normalizeClassList(props.dialogClass)]
})

const computedDialogClass = computed(() => computedDialogClassList.value.join(' '))

// 计算遮罩层 class
const computedModalClass = computed(() => {
  return 'mobile-dialog-overlay'
})

const overlayClasses = computed(() => [
  'mobile-dialog-overlay',
  'mobile-dialog-sheet-overlay',
  ...normalizeClassList(props.dialogClass)
])

const sheetDialogClasses = computed(() => [
  'el-dialog',
  'mobile-dialog-sheet-panel',
  ...computedDialogClassList.value,
  {
    'is-mobile': isMobile.value,
    'is-auto-height': props.autoHeight
  }
])

const showSheetHeader = computed(() => {
  return Boolean(slots.header || props.title || props.showClose)
})

// 事件处理
const handleOpen = () => {
  emit('open')
}

const handleOpened = () => {
  emit('opened')
}

const handleClose = () => {
  emit('close')
}

const handleClosed = () => {
  emit('closed')
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  dialogVisible.value = false
}

const handleSheetClose = () => {
  const done = (cancel?: boolean) => { if (!cancel) dialogVisible.value = false }
  if (props.beforeClose) props.beforeClose(done)
  else done()
}

let overlayPointer: { id: number; x: number; y: number } | null = null
let overlayClickReady = false
const resetOverlayPointer = () => {
  overlayPointer = null
  overlayClickReady = false
}

const handleOverlayPointerDown = (event: PointerEvent) => {
  resetOverlayPointer()
  if (event.target !== event.currentTarget || !event.isPrimary || event.button !== 0) return
  overlayPointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
}

const handleOverlayPointerMove = (event: PointerEvent) => {
  if (overlayPointer && (event.pointerId !== overlayPointer.id
    || Math.abs(event.clientX - overlayPointer.x) > 10
    || Math.abs(event.clientY - overlayPointer.y) > 10)) resetOverlayPointer()
}

const handleOverlayPointerUp = (event: PointerEvent) => {
  const pointer = overlayPointer
  resetOverlayPointer()
  overlayClickReady = Boolean(pointer && event.pointerId === pointer.id
    && event.target === event.currentTarget
    && Math.abs(event.clientX - pointer.x) <= 10
    && Math.abs(event.clientY - pointer.y) <= 10)
}

const handleOverlayClick = () => {
  // 只关闭从遮罩开始并在遮罩结束的完整点击，拒绝弹窗出现后的穿透点击。
  const shouldClose = overlayClickReady && props.closeOnClickModal
  resetOverlayPointer()
  if (!shouldClose) return
  handleSheetClose()
}

const handleMobileAfterLeave = () => {
  if (!sheetClosing || dialogVisible.value) return
  sheetClosing = false
  if (destroyOnClose.value) {
    mobileSheetMounted.value = false
  }
  lockedMobileSheet.value = useMobileSheet.value
  emit('closed')
}

const handleMobileAfterEnter = () => {
  if (sheetOpened || !dialogVisible.value || !activeUseMobileSheet.value) return
  sheetOpened = true
  emit('opened')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.defaultPrevented || !isTop.value || !activeUseMobileSheet.value || !dialogVisible.value || !props.closeOnPressEscape) return
  // Element Plus 的确认/输入框在 document 阶段先处理 Escape，底层 sheet 不得同时关闭。
  if ([...document.querySelectorAll('.el-message-box')].some(element => element.getClientRects().length > 0)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    handleSheetClose()
  }
}

// 监听屏幕变化，动态更新对话框
watch(dialogVisible, (visible) => {
  resetOverlayPointer()
  if (visible) lockedMobileSheet.value = useMobileSheet.value

  if (!activeUseMobileSheet.value) return

  if (visible) {
    sheetClosing = false
    sheetOpened = false
    mobileSheetMounted.value = true
    emit('open')
    return
  }

  sheetClosing = true
  sheetOpened = false
  emit('close')
})

watch(useMobileSheet, (mobileMode) => {
  if (!dialogVisible.value && !sheetClosing) {
    lockedMobileSheet.value = mobileMode
    return
  }

  if (lockedMobileSheet.value) {
    mobileSheetMounted.value = true
    return
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (dialogVisible.value && activeUseMobileSheet.value) {
    emit('open')
  }
})

// 清理函数
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="scss" scoped src="./styles/mobile-dialog/base.scss"></style>
<style lang="scss" scoped src="./styles/mobile-dialog/theme.scss"></style>
