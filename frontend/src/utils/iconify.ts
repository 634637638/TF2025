/**
 * Iconify 图标库工具
 * 用于确保 Iconify JS 已加载并可用
 */

interface IconifyApi {
  scan?: () => unknown
  loadIcon?: (name: string | null) => unknown
}

const FONT_AWESOME_CSS = 'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css'
const ICONIFY_SCRIPT = 'https://code.iconify.design/3/3.1.0/iconify.min.js'

let iconAssetsPromise: Promise<void> | null = null

/**
 * Load external icon assets only after entering a page that renders them.
 * Login does not use these assets, so it should not pay the CDN request cost.
 */
export function ensureIconAssets(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (iconAssetsPromise) return iconAssetsPromise

  iconAssetsPromise = new Promise((resolve) => {
    const head = document.head
    const fontAwesome = head.querySelector<HTMLLinkElement>(`link[href="${FONT_AWESOME_CSS}"]`)
    if (!fontAwesome) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_AWESOME_CSS
      link.crossOrigin = 'anonymous'
      head.appendChild(link)
    }

    if (getIconify()) {
      resolve()
      return
    }

    const existingScript = head.querySelector<HTMLScriptElement>(`script[src="${ICONIFY_SCRIPT}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => resolve(), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = ICONIFY_SCRIPT
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => resolve()
    head.appendChild(script)
  })

  return iconAssetsPromise
}

const getIconify = (): IconifyApi | undefined => {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { Iconify?: IconifyApi }).Iconify
}

/**
 * 等待 Iconify 加载完成
 * @param timeout 超时时间（毫秒），默认 5000ms
 * @returns Promise<boolean> 返回是否加载成功
 */
export function waitForIconify(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    // 检查是否已经加载
    if (getIconify()) {
      resolve(true)
      return
    }

    const startTime = Date.now()
    const checkInterval = 100 // 每 100ms 检查一次

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime

      // 检查是否超时
      if (elapsed >= timeout) {
        clearInterval(timer)
        resolve(false)
        return
      }

      // 检查是否已加载
      if (getIconify()) {
        clearInterval(timer)
        resolve(true)
      }
    }, checkInterval)
  })
}

/**
 * 检查 Iconify 是否可用
 */
export function isIconifyReady(): boolean {
  return Boolean(getIconify())
}

/**
 * 刷新 Iconify 图标
 * 当动态添加图标时调用
 */
export function refreshIconifyIcons() {
  if (isIconifyReady()) {
    const Iconify = getIconify()
    if (!Iconify) return 0

    // 扫描并渲染所有图标
    const scanned = Iconify.scan()

    // 额外：手动查找并刷新每个图标
    const elements = document.querySelectorAll<HTMLElement>('.iconify[data-icon]')

    elements.forEach((el) => {
      const dataIcon = el.getAttribute('data-icon')

      // 尝试手动加载图标
      try {
        if (Iconify.loadIcon) {
          Iconify.loadIcon(dataIcon)
        }
      } catch (error) {
        // 静默处理
      }
    })

    return scanned
  } else {
    return 0
  }
}

/**
 * 预加载图标集合
 * @param iconNames 图标名称数组，如 ['material-symbols:home', 'fa:user']
 */
export function preloadIcons(iconNames: string[]) {
  if (isIconifyReady()) {
    iconNames.forEach((iconName) => {
      try {
        getIconify()?.loadIcon?.(iconName)
      } catch (error) {
        // 静默处理
      }
    })
  }
}

/**
 * 从图标类名中提取 Iconify 图标名称
 * @param iconClass 图标类名，如 "iconify material-symbols:home" 或 "fas fa-home"
 * @returns Iconify 图标名称或 null
 */
export function extractIconifyName(iconClass: string): string | null {
  if (!iconClass) return null

  // 检查是否是 Iconify 格式
  if (iconClass.startsWith('iconify ')) {
    return iconClass.replace('iconify ', '').trim()
  }

  return null
}

/**
 * 判断图标是否是 Iconify 格式
 * @param iconClass 图标类名
 * @returns 是否是 Iconify 格式
 */
export function isIconifyIcon(iconClass: string): boolean {
  if (!iconClass) return false
  return iconClass.startsWith('iconify ')
}
