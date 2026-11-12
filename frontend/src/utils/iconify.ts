/** 图标名称解析与静态 Font Awesome 样式的唯一入口。动态 SVG 由 IconRenderer 管理。 */
const FONT_AWESOME_CSS = 'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css'

/** 登录页不加载业务静态图标字体；不注入 Iconify 扫描脚本。 */
export function ensureIconAssets(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (!document.head.querySelector(`link[href="${FONT_AWESOME_CSS}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_AWESOME_CSS
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
  return Promise.resolve()
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
