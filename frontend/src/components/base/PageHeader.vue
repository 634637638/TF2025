<template>
  <div class="page-header" :style="rootStyle">
    <div class="header-content" :style="contentStyle">
      <div class="header-left" :style="leftStyle">
        <h1 class="page-title" :style="titleStyle">
          <span
            v-if="resolvedIcon && isIconifyIcon"
            class="iconify page-title-icon"
            :data-icon="resolvedIcon.replace('iconify ', '')"
            :style="iconStyle"
          ></span>
          <i v-else-if="resolvedIcon" :class="[resolvedIcon, 'page-title-icon']" :style="iconStyle"></i>
          <span>{{ title }}</span>
        </h1>
        <p v-if="description" class="page-description" :style="descriptionStyle">{{ description }}</p>
      </div>
      <div
        v-if="$slots.actions || $slots.default"
        ref="actionsRef"
        class="header-actions"
        :style="actionsStyle"
      >
        <slot name="actions">
          <slot></slot>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuStore, type MenuItem } from '@/stores/menu'
/**
 * PageHeader - 统一页面头部组件
 *
 * 用于替代各页面中重复的页面头部结构
 *
 * @example
 * ```vue
 * <PageHeader
 *   icon="fas fa-users"
 *   title="用户管理"
 *   description="管理系统用户信息和权限"
 * >
 *   <template #actions>
 *     <el-button type="primary" @click="handleAdd">
 *       <i class="fas fa-plus"></i>
 *       新增用户
 *     </el-button>
 *   </template>
 * </PageHeader>
 * ```
 */

interface Props {
  /** 标题 */
  title: string
  /** 图标类名（如 'fas fa-users'） */
  icon?: string
  /** 描述文字 */
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: '',
  description: ''
})

const route = useRoute()
const slots = useSlots()
const menuStore = useMenuStore()
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const actionsRef = ref<HTMLElement | null>(null)
const actionCount = ref(0)
let actionsObserver: MutationObserver | null = null

const handleResize = () => {
  viewportWidth.value = window.innerWidth
}

const updateActionCount = () => {
  if (!actionsRef.value) {
    actionCount.value = 0
    return
  }

  const actionSelectors = [
    '.el-button',
    '.btn',
    '.el-dropdown',
    '.el-dropdown-link',
    'button'
  ]

  const uniqueActions = new Set<HTMLElement>()

  actionSelectors.forEach((selector) => {
    actionsRef.value?.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      const parentButtonLike = element.closest('.el-button, .btn, .el-dropdown, .el-dropdown-link, button')
      if (parentButtonLike && actionsRef.value?.contains(parentButtonLike)) {
        uniqueActions.add(parentButtonLike as HTMLElement)
      }
    })
  })

  actionCount.value = uniqueActions.size
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize, { passive: true })
  nextTick(() => {
    updateActionCount()
    if (actionsRef.value && typeof MutationObserver !== 'undefined') {
      actionsObserver = new MutationObserver(() => updateActionCount())
      actionsObserver.observe(actionsRef.value, {
        childList: true,
        subtree: true,
        attributes: true
      })
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  actionsObserver?.disconnect()
  actionsObserver = null
})

watch(
  () => [slots.actions?.(), slots.default?.()],
  async () => {
    await nextTick()
    updateActionCount()
  },
  { deep: true }
)

const normalizePath = (path?: string | null) => {
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

const findMenuIconByPath = (menus: MenuItem[], targetPath: string): string => {
  for (const menu of menus) {
    const menuPath = normalizePath(menu.url)
    if (menuPath && menuPath === targetPath && menu.icon) {
      return menu.icon
    }

    if (menu.children?.length) {
      const childIcon = findMenuIconByPath(menu.children, targetPath)
      if (childIcon) {
        return childIcon
      }
    }
  }

  return ''
}

const menuIcon = computed(() => findMenuIconByPath(menuStore.menuItems, normalizePath(route.path)))
const routeMetaIcon = computed(() => String(route.meta?.icon || ''))
const resolvedIcon = computed(() => menuIcon.value || routeMetaIcon.value || props.icon || '')
const isIconifyIcon = computed(() => resolvedIcon.value.startsWith('iconify '))
const isMobile = computed(() => viewportWidth.value <= 768)
const isSmallMobile = computed(() => viewportWidth.value <= 480)
const isTinyMobile = computed(() => viewportWidth.value <= 375)
const shouldWrapActions = computed(() => isTinyMobile.value || actionCount.value > 4)

const rootStyle = computed(() => {
  if (isTinyMobile.value) {
    return {
      padding: '0.5rem 0.75rem',
      borderRadius: '12px',
      marginBottom: '0.5rem'
    }
  }

  if (isMobile.value) {
    return {
      padding: '1rem',
      borderRadius: '12px',
      marginBottom: '1rem'
    }
  }

  return {
    padding: '32px',
    borderRadius: '16px',
    marginBottom: '24px'
  }
})

const contentStyle = computed(() => ({
  flexDirection: 'row',
  flexWrap: isTinyMobile.value ? 'wrap' : 'nowrap',
  alignItems: isMobile.value ? 'flex-start' : 'center',
  justifyContent: 'space-between',
  gap: isTinyMobile.value ? '8px' : isMobile.value ? '10px' : '12px'
}))

const leftStyle = computed(() => ({
  flex: '0 1 auto',
  minWidth: '0',
  maxWidth: isTinyMobile.value ? '100%' : isMobile.value ? '30%' : '50%'
}))

const titleStyle = computed(() => ({
  margin: '0',
  fontSize: isTinyMobile.value ? '0.95rem' : isSmallMobile.value ? '20px' : isMobile.value ? '22px' : '32px',
  fontWeight: '700',
  display: 'flex',
  alignItems: 'center',
  gap: isMobile.value ? '8px' : '12px',
  flexWrap: 'wrap',
  color: '#fff'
}))

const iconStyle = computed(() => ({
  fontSize: '0.9em',
  width: '0.9em',
  height: '0.9em',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: '1',
  color: '#fff'
}))

const descriptionStyle = computed(() => ({
  margin: '0',
  paddingTop: '8px',
  fontSize: isTinyMobile.value ? '0.7rem' : isMobile.value ? '14px' : '16px',
  lineHeight: '1.5',
  color: 'rgba(232, 226, 226, 0.8)'
}))

const actionsStyle = computed(() => ({
  display: 'flex',
  gap: isTinyMobile.value ? '0.1rem' : isSmallMobile.value ? '0.18rem' : '12px',
  alignItems: 'center',
  flexWrap: shouldWrapActions.value ? 'wrap' : 'nowrap',
  justifyContent: 'flex-end',
  flex: '1 1 auto',
  maxWidth: isTinyMobile.value ? '100%' : isMobile.value ? '70%' : '65%',
  width: shouldWrapActions.value ? '100%' : 'auto',
  marginLeft: 'auto'
}))
</script>

<style scoped lang="scss">
.page-header {
  background: linear-gradient(135deg, #e58714 0%, #3acac1 100%);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
  border: none;

  @media (max-width: 768px) {
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
  }
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;

  @media (max-width: 768px) {
    align-items: flex-start;
    gap: 10px;
  }

  @media (max-width: 375px) {
    flex-wrap: wrap;
    gap: 8px;
  }
}

.header-left {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 50%;

  @media (max-width: 768px) {
    max-width: 30%;
  }

  @media (max-width: 375px) {
    max-width: 100%;
  }
}

.page-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  .page-title-icon {
    font-size: 0.9em;
    color: #fff;
    width: 0.9em;
    height: 0.9em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  span {
    word-break: break-word;
  }

  @media (max-width: 768px) {
    font-size: 24px;

    .page-title-icon {
      font-size: 0.9em;
      width: 0.9em;
      height: 0.9em;
    }
  }
}

.page-description {
  margin: 0;
  padding-top: 8px;
  font-size: 16px;
  color: rgba(232, 226, 226, 0.8);
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 14px;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1 1 auto;
  max-width: min(100%, 65%);
  margin-left: auto;

  @media (max-width: 768px) {
    max-width: 70%;
    margin-left: auto;
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 3px;

    :deep(.el-button) {
      flex: 0 0 auto;
      width: auto;
      min-width: 0;
      max-width: 100%;
      height: 30px !important;
      min-height: 30px !important;
      padding: 0 5px !important;
      font-size: 9px;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
      gap: 2px;

      i {
        font-size: 9px;
        margin-right: 0;
      }

      span {
        font-size: 9px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

// 移动端按钮文字简化
@media (max-width: 480px) {
  .header-actions {
    gap: 0.12rem;
    flex-wrap: nowrap;
    max-width: 72%;

    :deep(.el-button) {
      flex: 0 0 auto;
      width: auto;
      min-width: 0;
      max-width: 100%;
      height: 28px !important;
      min-height: 28px !important;
      padding: 0 4px !important;
      font-size: 8px;
      overflow: hidden;
      line-height: 1;
      gap: 1px;

      i {
        font-size: 8px;
        margin-right: 0;
      }

      span {
        font-size: 8px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

// 超小屏幕优化（375px及以下）
@media (max-width: 375px) {
  .page-header {
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    margin-bottom: 0.5rem;
  }

  .page-title {
    font-size: 1rem;

    .page-title-icon {
      font-size: 0.9em;
      width: 0.9em;
      height: 0.9em;
    }
  }

  .page-description {
    font-size: 0.7rem;
  }

  .header-actions {
    gap: 0.15rem;
    flex-wrap: wrap;
    max-width: 100%;
    width: 100%;

    :deep(.el-button) {
      flex: 0 0 auto;
      width: auto;
      min-width: 0;
      max-width: 100%;
      height: 28px !important;
      min-height: 28px !important;
      padding: 0 6px !important;
      font-size: 9px;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;

      i {
        font-size: 9px;
        margin-right: 1px;
        flex-shrink: 0;
      }

      span {
        font-size: 9px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        flex-shrink: 0;
      }
    }
  }
}

// 按钮样式增强
:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;

  i {
    font-size: 0.9em;
  }
}

// 按钮组样式
:deep(.action-buttons) {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 100%;
  margin-left: auto;
}

@media (max-width: 768px) {
  :deep(.action-buttons) {
    gap: 0.5rem;
    justify-content: flex-end;
  }

  :deep(.action-buttons > *) {
    flex: 0 0 auto;
    max-width: 100%;
  }
}

// 减少动画模式支持
@media (prefers-reduced-motion: reduce) {
  .page-header {
    transition: none;
  }

  :deep(.el-button) {
    transition: none;
  }
}
</style>
