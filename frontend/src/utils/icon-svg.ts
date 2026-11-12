import DOMPurify from 'dompurify'

/** 公共图标 SVG 净化：禁止脚本、嵌入内容和外部资源，普通展示无需连接图标网站。 */
export function sanitizeIconSvg(value: string | null | undefined): string {
  const svg = String(value || '').trim()
  if (!/^<svg[\s>]/i.test(svg)) return ''
  const fragment = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'style', 'iframe', 'object', 'embed', 'image', 'feImage', 'use', 'animate', 'set', 'animateMotion', 'animateTransform'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'style', 'href', 'xlink:href', 'xml:base'],
    RETURN_DOM_FRAGMENT: true
  })
  const root = fragment.querySelector('svg')
  if (!root) return ''
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      // 只允许完整的本地片段引用；拒绝 CSS 转义和多重/外部 URL，避免绕过本地显示边界。
      if (attribute.value.includes('\\') || (/url\s*\(/i.test(attribute.value)
        && !/^url\(\s*(['"]?)#[\w:.-]+\1\s*\)$/i.test(attribute.value))) element.removeAttribute(attribute.name)
    }
  }
  return root.outerHTML
}
