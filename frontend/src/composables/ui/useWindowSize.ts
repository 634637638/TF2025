/**
 * 窗口尺寸 Composable
 * 提供响应式的窗口尺寸和滚动信息
 */

import { ref, onMounted, onUnmounted, computed, type Ref } from 'vue'

/**
 * 窗口尺寸信息
 */
export interface WindowSize {
  width: number
  height: number
  innerWidth: number
  innerHeight: number
  outerWidth: number
  outerHeight: number
  devicePixelRatio: number
}

/**
 * 滚动位置信息
 */
export interface ScrollPosition {
  x: number
  y: number
  directionX: 'left' | 'right' | null
  directionY: 'up' | 'down' | null
  scrollWidth: number
  scrollHeight: number
}

/**
 * 窗口尺寸选项
 */
export interface UseWindowSizeOptions {
  /**
   * 是否立即初始化
   */
  immediate?: boolean
  /**
   * 防抖延迟（毫秒）
   */
  debounce?: number
  /**
   * 是否监听滚动事件
   */
  includeScroll?: boolean
}

/**
 * 默认窗口尺寸
 */
const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 0,
  height: 0,
  innerWidth: 0,
  innerHeight: 0,
  outerWidth: 0,
  outerHeight: 0,
  devicePixelRatio: 1
}

/**
 * 默认滚动位置
 */
const DEFAULT_SCROLL_POSITION: ScrollPosition = {
  x: 0,
  y: 0,
  directionX: null,
  directionY: null,
  scrollWidth: 0,
  scrollHeight: 0
}

/**
 * 使用窗口尺寸
 */
export function useWindowSize(options: UseWindowSizeOptions = {}) {
  const { immediate = true, debounce = 100, includeScroll = false } = options

  const size = ref<WindowSize>({ ...DEFAULT_WINDOW_SIZE })
  const scroll = ref<ScrollPosition>({ ...DEFAULT_SCROLL_POSITION })

  let lastScrollY = 0
  let lastScrollX = 0
  let debounceTimer: number | null = null

  const updateSize = () => {
    if (typeof window === 'undefined') return

    size.value = {
      width: window.screen.width,
      height: window.screen.height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    }
  }

  const updateScroll = () => {
    if (typeof window === 'undefined') return

    const scrollY = window.scrollY || window.pageYOffset || 0
    const scrollX = window.scrollX || window.pageXOffset || 0

    scroll.value = {
      x: scrollX,
      y: scrollY,
      directionX: scrollX > lastScrollX ? 'right' : scrollX < lastScrollX ? 'left' : null,
      directionY: scrollY > lastScrollY ? 'down' : scrollY < lastScrollY ? 'up' : null,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight
    }

    lastScrollX = scrollX
    lastScrollY = scrollY
  }

  const handleResize = () => {
    if (debounce > 0) {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = window.setTimeout(() => {
        updateSize()
        if (includeScroll) {
          updateScroll()
        }
      }, debounce)
    } else {
      updateSize()
      if (includeScroll) {
        updateScroll()
      }
    }
  }

  const handleScroll = () => {
    if (includeScroll) {
      if (debounce > 0) {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        debounceTimer = window.setTimeout(updateScroll, debounce)
      } else {
        updateScroll()
      }
    }
  }

  const init = () => {
    updateSize()
    if (includeScroll) {
      updateScroll()
      window.addEventListener('scroll', handleScroll, { passive: true })
    }
    window.addEventListener('resize', handleResize, { passive: true })
  }

  const cleanup = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (includeScroll) {
      window.removeEventListener('scroll', handleScroll)
    }
    window.removeEventListener('resize', handleResize)
  }

  if (immediate) {
    onMounted(init)
    onUnmounted(cleanup)
  }

  // 计算属性
  const isMobile = computed(() => size.value.innerWidth < 768)
  const isTablet = computed(() => size.value.innerWidth >= 768 && size.value.innerWidth < 1024)
  const isDesktop = computed(() => size.value.innerWidth >= 1024)

  const isLandscape = computed(() => size.value.innerWidth > size.value.innerHeight)
  const isPortrait = computed(() => size.value.innerHeight > size.value.innerWidth)

  const isScrollableX = computed(() => scroll.value.scrollWidth > size.value.innerWidth)
  const isScrollableY = computed(() => scroll.value.scrollHeight > size.value.innerHeight)

  const scrollProgress = computed(() => {
    const maxScroll = scroll.value.scrollHeight - size.value.innerHeight
    return maxScroll > 0 ? (scroll.value.y / maxScroll) * 100 : 0
  })

  const isAtTop = computed(() => scroll.value.y <= 0)
  const isAtBottom = computed(() => {
    const maxScroll = scroll.value.scrollHeight - size.value.innerHeight
    return scroll.value.y >= maxScroll
  })

  const scrollDistance = computed(() => {
    return Math.sqrt(Math.pow(scroll.value.x, 2) + Math.pow(scroll.value.y, 2))
  })

  return {
    size,
    scroll: includeScroll ? scroll : null,
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isPortrait,
    isScrollableX,
    isScrollableY,
    scrollProgress,
    isAtTop,
    isAtBottom,
    scrollDistance,
    updateSize,
    updateScroll
  }
}

/**
 * 使用滚动位置
 */
export function useScroll(options: { debounce?: number } = {}) {
  const { debounce = 16 } = options

  const scrollY = ref(0)
  const scrollX = ref(0)
  const direction = ref<'up' | 'down' | null>(null)
  const isScrolling = ref(false)

  let lastScrollY = 0
  let scrollTimer: number | null = null
  let debounceTimer: number | null = null

  const updateScroll = () => {
    if (typeof window === 'undefined') return

    const currentScrollY = window.scrollY || window.pageYOffset || 0
    const currentScrollX = window.scrollX || window.pageXOffset || 0

    scrollY.value = currentScrollY
    scrollX.value = currentScrollX
    direction.value = currentScrollY > lastScrollY ? 'down' : currentScrollY < lastScrollY ? 'up' : null

    lastScrollY = currentScrollY
    isScrolling.value = true

    // 重置滚动状态
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }
    scrollTimer = window.setTimeout(() => {
      isScrolling.value = false
    }, 100)
  }

  const handleScroll = () => {
    if (debounce > 0) {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      debounceTimer = window.setTimeout(updateScroll, debounce)
    } else {
      updateScroll()
    }
  }

  const scrollTo = (x: number, y: number, smooth = false) => {
    if (typeof window === 'undefined') return
    window.scrollTo({
      left: x,
      top: y,
      behavior: smooth ? 'smooth' : 'auto'
    })
  }

  const scrollToTop = (smooth = false) => {
    scrollTo(0, 0, smooth)
  }

  const scrollToBottom = (smooth = false) => {
    if (typeof window === 'undefined') return
    scrollTo(0, document.documentElement.scrollHeight, smooth)
  }

  const scrollToElement = (element: string | Element, offset = 0, smooth = false) => {
    if (typeof window === 'undefined') return

    const el = typeof element === 'string'
      ? document.querySelector(element as string)
      : element
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - offset
      scrollTo(0, y, smooth)
    }
  }

  onMounted(() => {
    updateScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
  })

  onUnmounted(() => {
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    window.removeEventListener('scroll', handleScroll)
  })

  return {
    scrollY,
    scrollX,
    direction,
    isScrolling,
    scrollTo,
    scrollToTop,
    scrollToBottom,
    scrollToElement,
    updateScroll
  }
}

/**
 * 使用视口尺寸
 */
export function useViewport() {
  const width = ref(0)
  const height = ref(0)
  const scale = ref(1)

  const updateViewport = () => {
    if (typeof window === 'undefined') return

    // 获取视口尺寸
    width.value = window.visualViewport?.width || window.innerWidth
    height.value = window.visualViewport?.height || window.innerHeight
    scale.value = window.visualViewport?.scale || 1
  }

  onMounted(() => {
    updateViewport()

    // 监听视口变化
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport)
    } else {
      window.addEventListener('resize', updateViewport)
    }
  })

  onUnmounted(() => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', updateViewport)
    } else {
      window.removeEventListener('resize', updateViewport)
    }
  })

  const aspectRatio = computed(() => width.value / height.value)

  return {
    width,
    height,
    scale,
    aspectRatio,
    updateViewport
  }
}