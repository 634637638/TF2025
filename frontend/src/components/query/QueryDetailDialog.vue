<template>
  <Teleport to="body">
    <transition name="query-detail-sheet-fade">
      <div
        v-if="dialogVisible && isMobileSheet"
        class="query-detail-mobile-overlay"
        @click.self="handleClose"
      >
        <div class="query-detail-mobile-sheet" role="dialog" aria-modal="true">
          <div class="query-detail-mobile-header">
            <div class="query-detail-mobile-title">设备销售信息</div>
            <button type="button" class="query-detail-mobile-close" @click="handleClose" aria-label="关闭">
              <i class="el-icon">
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M764.288 214.656a42.624 42.624 0 0 1 60.224 60.288L572.16 527.104l252.352 252.224a42.624 42.624 0 1 1-60.224 60.288L512 587.392 259.648 839.616a42.624 42.624 0 1 1-60.224-60.288l252.352-252.224L199.424 274.944a42.624 42.624 0 0 1 60.224-60.288L512 466.88z" />
                </svg>
              </i>
            </button>
          </div>

          <div class="query-detail-mobile-body">
            <QueryDetailContent
              :detail-item="detailItem"
              :can-edit="canEdit"
              :can-delete="canDelete"
              :can-return-to-stock="canReturnToStock"
              @edit="emit('edit')"
              @delete="emit('delete')"
              @return="emit('return')"
            />
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <MobileDialog
    v-if="!isMobileSheet"
    v-model="dialogVisible"
    title="设备销售信息"
    :show-close="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    dialog-class="query-detail-dialog"
    :show-default-footer="false"
    destroy-on-close
    append-to-body
  >
    <template #header>
      <div class="query-detail-desktop-header">
        <span class="query-detail-desktop-title">设备销售信息</span>
      </div>
    </template>

    <QueryDetailContent
      :detail-item="detailItem"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-return-to-stock="canReturnToStock"
      @edit="emit('edit')"
      @delete="emit('delete')"
      @return="emit('return')"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import QueryDetailContent from '@/components/query/QueryDetailContent.vue'
import type { QueryItem } from '@/types'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'

interface Props extends ModelValueProps {
  detailItem: QueryItem | null
  canEdit: boolean
  canDelete: boolean
  canReturnToStock: boolean
}

interface Emits extends UpdateModelValueEmits {
  edit: []
  delete: []
  return: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const isMobileSheet = computed(() => screenWidth.value <= 1024)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const updateScreenWidth = () => {
  screenWidth.value = window.innerWidth
}

const handleClose = () => {
  dialogVisible.value = false
}

watch([dialogVisible, isMobileSheet], ([visible, mobile]) => {
  if (mobile) {
    document.body.style.overflow = visible ? 'hidden' : ''
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  window.addEventListener('resize', updateScreenWidth, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth)
  document.body.style.overflow = ''
})
</script>

<style scoped lang="scss">
.query-detail-mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.query-detail-mobile-sheet {
  width: min(100%, 560px);
  max-height: calc(100dvh - 4px);
  background: #ffffff;
  border-radius: 28px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
}

.query-detail-mobile-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(72px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 56px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.query-detail-mobile-title,
.query-detail-desktop-title {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
}

.query-detail-mobile-close {
  position: absolute;
  top: calc(18px + env(safe-area-inset-top));
  right: 16px;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.query-detail-mobile-close .el-icon {
  width: 18px;
  height: 18px;
}

.query-detail-mobile-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 6px 6px max(8px, env(safe-area-inset-bottom));
  background: #ffffff;
}

.query-detail-desktop-header {
  width: 100%;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 52px 12px 18px;
  border-radius: 18px 18px 0 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

:deep(.query-detail-dialog.el-dialog) {
  overflow: hidden;
  border-radius: 20px;
}

:deep(.query-detail-dialog .el-dialog__header) {
  padding: 0;
  background: transparent;
}

:deep(.query-detail-dialog .el-dialog__body) {
  padding: 12px;
  background: #ffffff;
}

:deep(.query-detail-dialog .el-dialog__headerbtn) {
  top: 20px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
}

:deep(.query-detail-dialog .el-dialog__close) {
  color: #ffffff;
}

.query-detail-sheet-fade-enter-active,
.query-detail-sheet-fade-leave-active {
  transition: opacity 0.24s ease;
}

.query-detail-sheet-fade-enter-active .query-detail-mobile-sheet,
.query-detail-sheet-fade-leave-active .query-detail-mobile-sheet {
  transition: transform 0.24s ease, opacity 0.24s ease;
}

.query-detail-sheet-fade-enter-from,
.query-detail-sheet-fade-leave-to {
  opacity: 0;
}

.query-detail-sheet-fade-enter-from .query-detail-mobile-sheet,
.query-detail-sheet-fade-leave-to .query-detail-mobile-sheet {
  opacity: 0;
  transform: translateY(18px) scale(0.98);
}

@media (max-width: 768px) {
  .query-detail-mobile-overlay {
    padding: 6px 4px;
  }

  .query-detail-mobile-sheet {
    width: calc(100vw - 8px);
    max-height: calc(100dvh - 24px);
    border-radius: 24px;
  }

  .query-detail-mobile-header {
    min-height: calc(66px + env(safe-area-inset-top));
    padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px;
  }

  .query-detail-mobile-title {
    font-size: 16px;
  }

  .query-detail-mobile-body {
    padding: 8px 10px max(10px, env(safe-area-inset-bottom));
  }
}

@media (max-width: 480px) {
  .query-detail-mobile-overlay {
    padding: 12px 4px;
  }

  .query-detail-mobile-sheet {
    width: calc(100vw - 8px);
    max-height: calc(100dvh - 24px);
    max-width: calc(100vw - 8px);
    border-radius: 24px;
  }

  .query-detail-mobile-body {
    padding: 6px 4px max(6px, env(safe-area-inset-bottom));
  }

  .query-detail-mobile-header {
    min-height: calc(62px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px;
  }
}
</style>
