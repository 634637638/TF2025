<template>
  <Teleport to="body">
    <transition name="mobile-dialog-sheet-fade" @after-leave="handleMobileAfterLeave">
      <div
        v-if="activeUseMobileSheet && mobileSheetMounted"
        v-show="dialogVisible"
        :class="overlayClasses"
        @click.self="handleOverlayClick"
      >
        <div :class="sheetDialogClasses" :style="sheetDialogStyle" role="dialog" aria-modal="true">
          <div v-if="showSheetHeader" class="el-dialog__header mobile-dialog-sheet-header">
            <div v-if="$slots.header" class="mobile-dialog-header mobile-dialog-sheet-header-content">
              <slot name="header"></slot>
            </div>
            <div v-else class="mobile-dialog-sheet-title-wrap">
              <span class="el-dialog__title mobile-dialog-sheet-title">{{ title }}</span>
            </div>

            <button
              v-if="showClose"
              type="button"
              class="el-dialog__headerbtn mobile-dialog-sheet-close"
              aria-label="关闭"
              @click="handleSheetClose"
            >
              <i class="el-dialog__close el-icon">
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M764.288 214.656a42.624 42.624 0 0 1 60.224 60.288L572.16 527.104l252.352 252.224a42.624 42.624 0 1 1-60.224 60.288L512 587.392 259.648 839.616a42.624 42.624 0 1 1-60.224-60.288l252.352-252.224L199.424 274.944a42.624 42.624 0 0 1 60.224-60.288L512 466.88z" />
                </svg>
              </i>
            </button>
          </div>

          <div class="el-dialog__body mobile-dialog-sheet-body">
            <slot>
              <div class="dialog-content">
                <slot name="content"></slot>
              </div>
            </slot>
          </div>

          <div v-if="$slots.footer || showDefaultFooter" class="el-dialog__footer mobile-dialog-sheet-footer">
            <div v-if="$slots.footer" class="mobile-dialog-footer">
              <slot name="footer"></slot>
            </div>
            <div v-else-if="showDefaultFooter" class="default-footer">
              <el-button
                v-if="showCancelButton"
                @click="handleCancel"
                size="large"
                :disabled="loading"
              >
                {{ cancelText }}
              </el-button>
              <el-button
                type="primary"
                @click="handleConfirm"
                size="large"
                :loading="loading"
              >
                {{ confirmText }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <el-dialog
    v-if="!activeUseMobileSheet"
    v-model="dialogVisible"
    :title="title"
    :width="dialogWidth"
    align-center
    center
    :fullscreen="isFullscreen || forceFullscreen"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :show-close="showClose"
    :draggable="draggable"
    :destroy-on-close="destroyOnClose"
    :modal-class="computedModalClass"
    :class="[computedDialogClass, { 'is-mobile': isMobile, 'is-tablet': isTablet, 'is-auto-height': props.autoHeight }]"
    :style="desktopDialogStyle"
    @open="handleOpen"
    @opened="handleOpened"
    @close="handleClose"
    @closed="handleClosed"
    v-bind="$attrs"
  >
    <slot>
      <div class="dialog-content">
        <slot name="content"></slot>
      </div>
    </slot>

    <template #header v-if="$slots.header">
      <div class="mobile-dialog-header">
        <slot name="header"></slot>
      </div>
    </template>

    <template v-if="$slots.footer || showDefaultFooter" #footer>
      <div v-if="$slots.footer" class="mobile-dialog-footer">
        <slot name="footer"></slot>
      </div>
      <div v-else-if="showDefaultFooter" class="default-footer">
        <el-button
          v-if="showCancelButton"
          @click="handleCancel"
          :size="isMobile ? 'large' : 'default'"
          :disabled="loading"
        >
          {{ cancelText }}
        </el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :size="isMobile ? 'large' : 'default'"
          :loading="loading"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted, useAttrs, useSlots, ref, nextTick, onMounted } from 'vue'
import type { CancelEmits, CloseEmits, ConfirmEmits, UpdateModelValueEmits } from '@/types/component'
import { useMobile } from '@/composables/useMobile'

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
  // 响应式断点配置
  mobileBreakpoint?: number
  tabletBreakpoint?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '680px',
  maxWidth: '',
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
  mobileBreakpoint: 768,
  tabletBreakpoint: 1024
})

const attrs = useAttrs()
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

// screenWidth 兼容
const screenWidth = computed(() => screenSize.value.width)

// 对话框可见性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 计算对话框宽度
const dialogWidth = computed(() => {
  // 移动端
  if (isMobile.value) {
    return '95vw'
  }

  // 平板端
  if (isTablet.value) {
    return '70vw'
  }

  // 桌面端 - 限制最大宽度
  if (typeof props.width === 'number') {
    return props.width
  }

  // 如果是字符串百分比，在桌面端限制为合理宽度
  if (typeof props.width === 'string') {
    // 如果传入的是百分比且值太大，使用默认值
    if (props.width.includes('%')) {
      const percentValue = parseInt(props.width)
      if (percentValue > 70) {
        return '70vw'
      }
      return props.width
    }
    return props.width
  }

  // 桌面端默认宽度
  return '60vw'
})

// 是否全屏显示
const isFullscreen = computed(() => {
  if (props.fullscreen) return true
  if (props.forceFullscreen) return true
  // 小屏移动端自动全屏
  return isMobile.value && screenWidth.value < 480
})

const destroyOnClose = computed(() => props.destroyOnClose)

const normalizeCssSize = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return undefined
  return typeof value === 'number' ? `${value}px` : String(value)
}

const normalizedMaxWidth = computed(() => normalizeCssSize(props.maxWidth))
const normalizedWidth = computed(() => normalizeCssSize(props.width))
const effectiveDialogMaxWidth = computed(() => normalizedMaxWidth.value || normalizedWidth.value)

const desktopDialogStyle = computed(() => {
  if (!effectiveDialogMaxWidth.value && !normalizedWidth.value) return undefined

  return {
    ...(normalizedWidth.value ? { '--el-dialog-width': normalizedWidth.value } : {}),
    ...(effectiveDialogMaxWidth.value ? { '--dialog-base-max-width': effectiveDialogMaxWidth.value, maxWidth: effectiveDialogMaxWidth.value } : {})
  }
})

const sheetDialogStyle = computed(() => {
  if (!effectiveDialogMaxWidth.value) return undefined
  return {
    '--dialog-base-max-width': effectiveDialogMaxWidth.value
  }
})

const useMobileSheet = computed(() => screenWidth.value <= props.tabletBreakpoint)
const lockedMobileSheet = ref(useMobileSheet.value)
const activeUseMobileSheet = computed(() => {
  return dialogVisible.value ? lockedMobileSheet.value : useMobileSheet.value
})

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
  // 移动端禁止背景滚动
  if (isMobile.value) {
    document.body.style.overflow = 'hidden'
  }
}

const handleClose = () => {
  emit('close')
}

const handleClosed = () => {
  emit('closed')
  // 恢复背景滚动
  document.body.style.overflow = ''
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  dialogVisible.value = false
}

const handleSheetClose = () => {
  dialogVisible.value = false
}

const handleOverlayClick = () => {
  if (!props.closeOnClickModal) return
  dialogVisible.value = false
}

const handleMobileAfterLeave = () => {
  if (destroyOnClose.value) {
    mobileSheetMounted.value = false
  }
  emit('closed')
}

const syncBodyScroll = (locked: boolean) => {
  document.body.style.overflow = locked ? 'hidden' : ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!activeUseMobileSheet.value || !dialogVisible.value || !props.closeOnPressEscape) return
  if (event.key === 'Escape') {
    dialogVisible.value = false
  }
}

// 监听屏幕变化，动态更新对话框
watch(dialogVisible, async (visible) => {
  if (visible) {
    lockedMobileSheet.value = useMobileSheet.value
  } else {
    lockedMobileSheet.value = useMobileSheet.value
  }

  if (!activeUseMobileSheet.value) return

  if (visible) {
    mobileSheetMounted.value = true
    emit('open')
    syncBodyScroll(true)
    await nextTick()
    emit('opened')
    return
  }

  emit('close')
  syncBodyScroll(false)
})

watch(useMobileSheet, (mobileMode) => {
  if (!dialogVisible.value) {
    lockedMobileSheet.value = mobileMode
    if (!mobileMode) {
      syncBodyScroll(false)
    }
    return
  }

  if (lockedMobileSheet.value) {
    mobileSheetMounted.value = true
    syncBodyScroll(true)
    return
  }

  syncBodyScroll(false)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

// 清理函数
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
:global(.mobile-dialog-overlay) {
  background: rgba(15, 23, 42, 0.42) !important;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.mobile-dialog {
  // 桌面端最大宽度限制
  :deep(.el-dialog) {
    max-width: min(var(--dialog-max-width, var(--dialog-base-max-width, 880px)), calc(100vw - var(--dialog-side-gap, 32px))) !important;
    margin: auto !important;
  }

  // 平板端样式
  &.is-tablet {
    :deep(.el-dialog) {
      margin: auto !important;

      .el-dialog__header {
        padding: 18px 24px;

        .el-dialog__title {
          font-size: 20px;
        }
      }

      .el-dialog__body {
        padding: 24px;
      }

      .el-dialog__footer {
        padding: 18px 24px;
      }
    }
  }
}

.mobile-dialog-sheet-overlay {
  --mobile-dialog-effective-side-gap: var(--dialog-side-gap, 4px);
  --mobile-dialog-effective-vertical-gap: var(--dialog-vertical-gap, 24px);
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--mobile-dialog-effective-side-gap) !important;
}

.mobile-dialog-sheet-panel {
  width: min(
    calc(100vw - (var(--mobile-dialog-effective-side-gap) * 2)),
    var(--dialog-max-width, var(--dialog-base-max-width, 880px))
  );
  max-width: min(
    calc(100vw - (var(--mobile-dialog-effective-side-gap) * 2)),
    var(--dialog-max-width, var(--dialog-base-max-width, 880px))
  );
  max-height: calc(100dvh - var(--mobile-dialog-effective-vertical-gap));
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
}

.mobile-dialog-sheet-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(72px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 56px 12px 16px;
  background: var(--dialog-header-bg);
}

.mobile-dialog-sheet-header-content,
.mobile-dialog-sheet-title-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.mobile-dialog-sheet-title {
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.mobile-dialog-sheet-close {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  right: 14px;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.mobile-dialog-sheet-close .el-icon,
.mobile-dialog-sheet-close .el-dialog__close {
  width: 18px;
  height: 18px;
}

.mobile-dialog-sheet-body {
  flex: 1;
  min-height: 0;
  padding: var(--mobile-dialog-body-padding, 8px 4px 8px);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: #ffffff;
}

.mobile-dialog-sheet-footer {
  padding: var(--mobile-dialog-footer-padding, 0 4px 4px);
  background: #ffffff;
}

.mobile-dialog-sheet-footer :deep(.el-button) {
  min-height: 42px;
  font-size: 15px;
}

.mobile-dialog-sheet-footer :deep(.el-button.el-button--large) {
  min-height: 44px;
  font-size: 16px;
}

.mobile-dialog-sheet-panel :deep(.el-form-item) {
  display: block;
}

.mobile-dialog-sheet-panel :deep(.el-form-item__label) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100% !important;
  max-width: none !important;
  height: auto !important;
  line-height: 1.45;
  padding: 0 0 6px !important;
  margin: 0 !important;
  text-align: left !important;
  white-space: normal;
}

.mobile-dialog-sheet-panel :deep(.el-form-item__content) {
  display: flex;
  width: 100%;
  min-width: 0;
  margin-left: 0 !important;
}

.mobile-dialog-sheet-panel :deep(.el-input),
.mobile-dialog-sheet-panel :deep(.el-input-number),
.mobile-dialog-sheet-panel :deep(.el-select),
.mobile-dialog-sheet-panel :deep(.el-date-editor),
.mobile-dialog-sheet-panel :deep(.el-cascader) {
  width: 100%;
  max-width: 100%;
}

.mobile-dialog-sheet-panel :deep(.el-input-number .el-input__wrapper) {
  width: 100%;
}

// 移动端头部自定义样式
.mobile-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-dialog-footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

// 默认底部按钮样式
.default-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  // 移动端按钮布局
  @media (max-width: 767px) {
    flex-direction: column-reverse;

    .el-button {
      width: 100%;
      margin-left: 0;
      margin-right: 0;
    }
  }
}

// 对话框内容区域
.dialog-content {
  min-height: 100px;
}

.mobile-dialog.is-auto-height {
  :deep(.el-dialog) {
    height: auto !important;
    max-height: calc(100vh - 24px) !important;
  }

  :deep(.el-dialog__body) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  :deep(.el-dialog__footer) {
    flex-shrink: 0 !important;
  }
}

// 响应式对话框宽度调整
@media (max-width: 480px) {
  .mobile-dialog-sheet-overlay {
    --mobile-dialog-effective-side-gap: var(--dialog-side-gap, 4px);
    --mobile-dialog-effective-vertical-gap: var(--dialog-vertical-gap, 24px);
    padding: var(--mobile-dialog-effective-side-gap) !important;
  }

  .mobile-dialog-sheet-panel {
    width: min(
      calc(100vw - (var(--mobile-dialog-effective-side-gap) * 2)),
      var(--dialog-max-width, var(--dialog-base-max-width, 880px))
    );
    max-width: min(
      calc(100vw - (var(--mobile-dialog-effective-side-gap) * 2)),
      var(--dialog-max-width, var(--dialog-base-max-width, 880px))
    );
    max-height: calc(100dvh - var(--mobile-dialog-effective-vertical-gap));
    border-radius: 24px;
  }

  .mobile-dialog-sheet-header {
    min-height: calc(62px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px;
  }

  .mobile-dialog-sheet-title {
    font-size: 16px;
  }

  .mobile-dialog-sheet-panel :deep(.el-form-item__label) {
    padding-bottom: 5px !important;
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .mobile-dialog-sheet-overlay {
    --mobile-dialog-effective-side-gap: var(--dialog-side-gap, 4px);
    padding: var(--mobile-dialog-effective-side-gap) !important;
  }

  .mobile-dialog-sheet-panel {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
  }
}

@media (min-width: 1200px) {
  .mobile-dialog {
    :deep(.el-dialog) {
      max-width: min(var(--dialog-max-width, var(--dialog-base-max-width, 880px)), calc(100vw - var(--dialog-side-gap, 32px))) !important;
    }
  }
}

// 暗色主题适配
@media (prefers-color-scheme: dark) {
  .mobile-dialog {
    :deep(.el-dialog) {
      background-color: var(--el-bg-color);

      .el-dialog__header {
        border-bottom-color: var(--el-border-color);
      }

      .el-dialog__footer {
        border-top-color: var(--el-border-color);
      }
    }
  }
}

// 高对比度模式
@media (prefers-contrast: high) {
  .mobile-dialog {
    :deep(.el-dialog) {
      border: 2px solid var(--el-border-color);
    }
  }
}

// 减少动画模式
@media (prefers-reduced-motion: reduce) {
  .mobile-dialog {
    :deep(.el-dialog) {
      transition: none;

      .el-dialog__header,
      .el-dialog__body,
      .el-dialog__footer {
        transition: none;
      }
    }
  }

  .mobile-dialog-sheet-overlay,
  .mobile-dialog-sheet-panel {
    transition: none !important;
  }
}

.mobile-dialog-sheet-fade-enter-active,
.mobile-dialog-sheet-fade-leave-active {
  transition: opacity 0.24s ease;
}

.mobile-dialog-sheet-fade-enter-active .mobile-dialog-sheet-panel,
.mobile-dialog-sheet-fade-leave-active .mobile-dialog-sheet-panel {
  transition: transform 0.24s ease, opacity 0.24s ease;
}

.mobile-dialog-sheet-fade-enter-from,
.mobile-dialog-sheet-fade-leave-to {
  opacity: 0;
}

.mobile-dialog-sheet-fade-enter-from .mobile-dialog-sheet-panel,
.mobile-dialog-sheet-fade-leave-to .mobile-dialog-sheet-panel {
  opacity: 0;
  transform: translateY(18px) scale(0.985);
}
</style>
