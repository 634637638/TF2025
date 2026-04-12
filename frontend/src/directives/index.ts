/**
 * 全局指令系统
 * 提供移动端优化和常用功能指令
 */

import type { App, Directive, DirectiveBinding } from 'vue'
import { installPermissionDirective } from './permission'

// 加载指令
export const vTFLoading: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<boolean>) {
    if (binding.value) {
      showLoading(el)
    }
  },
  updated(el: HTMLElement, binding: DirectiveBinding<boolean>) {
    if (binding.value) {
      showLoading(el)
    } else {
      hideLoading(el)
    }
  },
  unmounted(el: HTMLElement) {
    hideLoading(el)
  }
}

// 复制指令
export const vCopy: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string>) {
    el.style.cursor = 'pointer'
    el.title = '点击复制'

    const clickHandler = async () => {
      try {
        await navigator.clipboard.writeText(binding.value)

        // 显示复制成功提示
        showCopySuccess(el)
      } catch (error) {
        showCopyError(el)
      }
    }

    el.addEventListener('click', clickHandler)
    ;(el as any)._copyHandler = clickHandler
  },
  updated(el: HTMLElement, binding: DirectiveBinding<string>) {
    el.title = `点击复制: ${binding.value}`
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any)._copyHandler
    if (handler) {
      el.removeEventListener('click', handler)
    }
  }
}

// 防抖指令
export const vDebounce: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<{
    fn: Function
    delay?: number
    immediate?: boolean
  }>) {
    let timeout: ReturnType<typeof setTimeout>

    const handler = (event: Event) => {
      const { fn, delay = 300, immediate = false } = binding.value

      if (timeout) {
        clearTimeout(timeout)
      }

      if (immediate) {
        const callNow = !timeout
        timeout = setTimeout(() => {
          timeout = null
        }, delay)

        if (callNow) {
          fn(event)
        }
      } else {
        timeout = setTimeout(() => {
          fn(event)
        }, delay)
      }
    }

    el.addEventListener('click', handler)
    ;(el as any)._debounceHandler = handler
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any)._debounceHandler
    if (handler) {
      el.removeEventListener('click', handler)
    }
  }
}

// 节流指令
export const vThrottle: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<{
    fn: Function
    delay?: number
  }>) {
    let lastCall = 0

    const handler = (event: Event) => {
      const { fn, delay = 300 } = binding.value
      const now = Date.now()

      if (now - lastCall >= delay) {
        lastCall = now
        fn(event)
      }
    }

    el.addEventListener('click', handler)
    ;(el as any)._throttleHandler = handler
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any)._throttleHandler
    if (handler) {
      el.removeEventListener('click', handler)
    }
  }
}

// 长按指令
export const vLongPress: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<{
    fn: Function
    delay?: number
  }>) {
    let timeout: ReturnType<typeof setTimeout>

    const start = () => {
      const { fn, delay = 500 } = binding.value

      timeout = setTimeout(() => {
        fn()
      }, delay)
    }

    const cancel = () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }

    // 移动端触摸事件
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchend', cancel, { passive: true })
    el.addEventListener('touchmove', cancel, { passive: true })

    // 桌面端鼠标事件
    el.addEventListener('mousedown', start)
    el.addEventListener('mouseup', cancel)
    el.addEventListener('mouseleave', cancel)

    ;(el as any)._longPressCleanup = () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchend', cancel)
      el.removeEventListener('touchmove', cancel)
      el.removeEventListener('mousedown', start)
      el.removeEventListener('mouseup', cancel)
      el.removeEventListener('mouseleave', cancel)
    }
  },
  unmounted(el: HTMLElement) {
    const cleanup = (el as any)._longPressCleanup
    if (cleanup) {
      cleanup()
    }
  }
}

// 无限滚动指令
export const vInfiniteScroll: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<{
    fn: Function
    distance?: number
    disabled?: boolean
  }>) {
    const { fn, distance = 100, disabled = false } = binding.value

    if (disabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            fn()
          }
        })
      },
      {
        rootMargin: `${distance}px`
      }
    )

    observer.observe(el)
    ;(el as any)._infiniteScrollObserver = observer
  },
  updated(el: HTMLElement, binding: DirectiveBinding<{
    fn: Function
    distance?: number
    disabled?: boolean
  }>) {
    const { disabled } = binding.value
    const observer = (el as any)._infiniteScrollObserver

    if (observer) {
      if (disabled) {
        observer.disconnect()
      } else {
        observer.observe(el)
      }
    }
  },
  unmounted(el: HTMLElement) {
    const observer = (el as any)._infiniteScrollObserver
    if (observer) {
      observer.disconnect()
    }
  }
}

// 懒加载指令
export const vLazy: Directive = {
  mounted(el: HTMLImageElement, binding: DirectiveBinding<string>) {
    const src = binding.value

    // 创建占位图
    const placeholder = document.createElement('div')
    placeholder.style.width = el.offsetWidth + 'px'
    placeholder.style.height = el.offsetHeight + 'px'
    placeholder.style.backgroundColor = '#f0f0f0'
    placeholder.style.display = 'flex'
    placeholder.style.alignItems = 'center'
    placeholder.style.justifyContent = 'center'
    placeholder.innerHTML = '<span style="color: #999;">加载中...</span>'

    el.parentNode?.insertBefore(placeholder, el)
    el.style.display = 'none'

    // 创建图片对象
    const img = new Image()
    img.onload = () => {
      el.src = src
      el.style.display = ''
      placeholder.remove()
    }

    img.onerror = () => {
      placeholder.innerHTML = '<span style="color: #ff4444;">加载失败</span>'
    }

    img.src = src
    ;(el as any)._lazyPlaceholder = placeholder
  },
  unmounted(el: HTMLImageElement) {
    const placeholder = (el as any)._lazyPlaceholder
    if (placeholder && placeholder.parentNode) {
      placeholder.remove()
    }
  }
}

// 自动聚焦指令
export const vFocus: Directive = {
  mounted(el: HTMLElement) {
    el.focus()
  }
}

// 自动选择指令
export const vSelect: Directive = {
  mounted(el: HTMLInputElement) {
    el.select()
  }
}

// 数字输入指令
export const vNumber: Directive = {
  mounted(el: HTMLInputElement) {
    el.type = 'text'

    const handler = (e: KeyboardEvent) => {
      // 允许数字、小数点、退格键、删除键
      const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'Backspace', 'Delete', 'Tab', 'Enter']
      const ctrlKey = e.ctrlKey || e.metaKey

      if (!ctrlKey && !allowedKeys.includes(e.key) && !e.key.startsWith('Arrow')) {
        e.preventDefault()
      }
    }

    el.addEventListener('keydown', handler)
    ;(el as any)._numberHandler = handler
  },
  unmounted(el: HTMLInputElement) {
    const handler = (el as any)._numberHandler
    if (handler) {
      el.removeEventListener('keydown', handler)
    }
  }
}

// 移动端优化指令
export const vMobileOptimize: Directive = {
  mounted(el: HTMLElement) {
    // 添加触摸反馈
    const addTouchFeedback = () => {
      el.style.transition = 'all 0.1s ease'
      el.addEventListener('touchstart', () => {
        el.style.transform = 'scale(0.98)'
        el.style.opacity = '0.8'
      }, { passive: true })

      el.addEventListener('touchend', () => {
        el.style.transform = 'scale(1)'
        el.style.opacity = '1'
      }, { passive: true })
    }

    // 添加点击波纹效果
    const addRippleEffect = (e: MouseEvent) => {
      const ripple = document.createElement('span')
      ripple.style.position = 'absolute'
      ripple.style.borderRadius = '50%'
      ripple.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'
      ripple.style.width = '20px'
      ripple.style.height = '20px'
      ripple.style.pointerEvents = 'none'
      ripple.style.transform = 'translate(-50%, -50%) scale(0)'
      ripple.style.animation = 'ripple 0.6s ease-out'

      const rect = el.getBoundingClientRect()
      ripple.style.left = (e.clientX - rect.left) + 'px'
      ripple.style.top = (e.clientY - rect.top) + 'px'

      el.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600)
    }

    addTouchFeedback()

    if (isMobileDevice()) {
      el.addEventListener('click', addRippleEffect)
      ;(el as any)._rippleHandler = addRippleEffect
    }
  },
  unmounted(el: HTMLElement) {
    const handler = (el as any)._rippleHandler
    if (handler) {
      el.removeEventListener('click', handler)
    }
  }
}

// 工具函数
function showLoading(el: HTMLElement) {
  el.classList.add('tf2025-loading')

  // 创建加载动画元素
  const loading = document.createElement('div')
  loading.className = 'tf2025-loading-spinner'
  loading.innerHTML = `
    <div class="spinner"></div>
    <span>加载中...</span>
  `

  // 添加样式
  const style = document.createElement('style')
  style.textContent = `
    .tf2025-loading {
      position: relative;
      pointer-events: none;
      opacity: 0.6;
    }
    .tf2025-loading-spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #409eff;
      font-size: 14px;
    }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #409eff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `

  if (!document.getElementById('tf2025-loading-styles')) {
    style.id = 'tf2025-loading-styles'
    document.head.appendChild(style)
  }

  el.appendChild(loading)
}

function hideLoading(el: HTMLElement) {
  el.classList.remove('tf2025-loading')
  const spinner = el.querySelector('.tf2025-loading-spinner')
  if (spinner) {
    spinner.remove()
  }
}

function showCopySuccess(el: HTMLElement) {
  showToast(el, '复制成功！', 'success')
}

function showCopyError(el: HTMLElement) {
  showToast(el, '复制失败，请手动复制', 'error')
}

function showToast(el: HTMLElement, message: string, type: 'success' | 'error') {
  const toast = document.createElement('div')
  toast.className = `tf2025-toast tf2025-toast-${type}`
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 9999;
    animation: toast-fade-in 0.3s ease;
    ${type === 'success' ? 'background-color: #67c23a;' : 'background-color: #f56c6c;'}
  `

  // 添加动画样式
  if (!document.getElementById('tf2025-toast-styles')) {
    const style = document.createElement('style')
    style.id = 'tf2025-toast-styles'
    style.textContent = `
      @keyframes toast-fade-in {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes toast-fade-out {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, -20px); }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'toast-fade-out 0.3s ease'
    setTimeout(() => {
      toast.remove()
    }, 300)
  }, 2000)
}

function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768
}

// 安装所有指令
export function installDirectives(app: App) {
  // 安装权限指令
  installPermissionDirective(app)

  // 注册其他指令
  app.directive('tf-loading', vTFLoading)
  app.directive('copy', vCopy)
  app.directive('debounce', vDebounce)
  app.directive('throttle', vThrottle)
  app.directive('long-press', vLongPress)
  app.directive('infinite-scroll', vInfiniteScroll)
  app.directive('lazy', vLazy)
  app.directive('focus', vFocus)
  app.directive('select', vSelect)
  app.directive('number', vNumber)
  app.directive('mobile-optimize', vMobileOptimize)
}

// 指令已在定义时通过 export const 导出，无需重复导出

export default {
  install: installDirectives
}