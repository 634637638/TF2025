/**
 * 搜索结果高亮功能
 * 使用 DOMPurify 防止 XSS 攻击
 */

import DOMPurify from 'dompurify'

export const useSearchHighlight = () => {
  /**
   * 转义 HTML 特殊字符，防止 XSS
   * @param text 原始文本
   * @returns 转义后的文本
   */
  const escapeHtml = (text: string): string => {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 高亮文本中的搜索关键词
   * @param text 原始文本
   * @param keyword 搜索关键词
   * @param className 高亮样式类名
   * @returns 带高亮标记的HTML（已净化）
   */
  const highlightText = (
    text: string,
    keyword: string,
    className: string = 'highlight'
  ): string => {
    if (!keyword || !text) return escapeHtml(text || '')

    // 先转义原始文本，防止 XSS
    const escapedText = escapeHtml(text)
    const escapedKeyword = escapeHtml(keyword)

    // 转义正则特殊字符
    const escapeRegExp = (str: string) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // 创建正则表达式
    const pattern = new RegExp(
      `(${escapeRegExp(escapedKeyword)})`,
      'gi'
    )

    // 替换为高亮标记
    const highlighted = escapedText.replace(pattern, `<span class="${className}">$1</span>`)

    // 使用 DOMPurify 净化 HTML，只允许 span 标签和 class 属性
    return DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class']
    })
  }

  /**
   * 检查文本是否包含搜索关键词
   * @param text 文本
   * @param keyword 关键词
   * @returns 是否匹配
   */
  const isMatch = (text: string, keyword: string): boolean => {
    if (!keyword || !text) return false
    return text.toLowerCase().includes(keyword.toLowerCase())
  }

  /**
   * 获取匹配的文本片段（用于搜索结果摘要）
   * @param text 完整文本
   * @param keyword 关键词
   * @param maxLength 最大长度
   * @param beforeLength 关键词前保留的字符数
   * @returns 文本片段（已净化）
   */
  const getMatchSnippet = (
    text: string,
    keyword: string,
    maxLength: number = 100,
    beforeLength: number = 30
  ): string => {
    if (!text) return ''

    const escapedText = escapeHtml(text)
    const escapedKeyword = escapeHtml(keyword)

    if (!escapedKeyword) return escapedText.substring(0, maxLength)

    const lowerText = escapedText.toLowerCase()
    const lowerKeyword = escapedKeyword.toLowerCase()
    const index = lowerText.indexOf(lowerKeyword)

    if (index === -1) return escapedText.substring(0, maxLength)

    // 计算开始位置
    let start = Math.max(0, index - beforeLength)
    const end = Math.min(escapedText.length, start + maxLength)

    // 调整开始位置以确保在单词边界
    if (start > 0) {
      const prevSpace = escapedText.lastIndexOf(' ', start - 10)
      if (prevSpace > start - beforeLength - 10) {
        start = prevSpace + 1
      }
    }

    let snippet = escapedText.substring(start, end)

    // 如果不是从开头开始，添加省略号
    if (start > 0) {
      snippet = '...' + snippet
    }

    // 如果不是到结尾结束，添加省略号
    if (end < escapedText.length) {
      snippet = snippet + '...'
    }

    // 高亮关键词
    const escapeRegExp = (str: string) => {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    const pattern = new RegExp(`(${escapeRegExp(escapedKeyword)})`, 'gi')
    const highlighted = snippet.replace(pattern, `<span class="highlight">$1</span>`)

    // 使用 DOMPurify 净化
    return DOMPurify.sanitize(highlighted, {
      ALLOWED_TAGS: ['span'],
      ALLOWED_ATTR: ['class']
    })
  }

  return {
    highlightText,
    isMatch,
    getMatchSnippet
  }
}