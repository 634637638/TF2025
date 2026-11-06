'use strict'

const cheerio = require('cheerio')

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'strong', 'b', 'em', 'i', 'u', 's',
  'sub', 'sup', 'ul', 'ol', 'li', 'blockquote', 'a', 'pre', 'code', 'img', 'video', 'audio', 'source',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'
])

const sanitizeStyle = value => String(value || '').split(';').map(rule => rule.trim()).filter(Boolean).filter(rule => {
  const [property, ...parts] = rule.split(':')
  const name = String(property || '').trim().toLowerCase()
  const content = parts.join(':').trim()
  if (name === 'text-align') return /^(left|center|right|justify)$/.test(content)
  if (name === 'line-height') return /^\d+(\.\d+)?$/.test(content)
  if (name === 'padding-left') return /^\d+(\.\d+)?em$/.test(content)
  if (name === 'font-size') return /^\d+(\.\d+)?(px|em|rem|%)$/.test(content)
  if (name === 'font-family') return /^[\w\s,'"\-\u4e00-\u9fa5]+$/.test(content)
  if (['color', 'background-color'].includes(name)) return /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(content)
  if (['width', 'height'].includes(name)) return /^(auto|\d+(\.\d+)?(px|%))$/.test(content)
  return false
}).join('; ')

const isSafeUrl = value => /^(https?:\/\/|mailto:|tel:)/i.test(value) || /^\/uploads\/(shared|content-media)\/[a-zA-Z0-9._-]+$/.test(value)

function sanitizeRichContent(value, { maxLength = 100000 } = {}) {
  const source = String(value || '').trim()
  if (source.length > maxLength) throw new Error(`内容不能超过${maxLength}个字符`)
  const $ = cheerio.load(source, null, false)
  $('*').each((_index, element) => {
    const node = $(element)
    const tag = String(element.tagName || '').toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(node.contents())
      return
    }
    const attributes = { ...(element.attribs || {}) }
    const href = tag === 'a' ? String(attributes.href || '').trim() : ''
    const src = ['img', 'video', 'audio', 'source'].includes(tag) ? String(attributes.src || '').trim() : ''
    const poster = tag === 'video' ? String(attributes.poster || '').trim() : ''
    const style = sanitizeStyle(attributes.style)
    for (const attribute of Object.keys(element.attribs || {})) node.removeAttr(attribute)
    if (tag === 'a' && isSafeUrl(href)) node.attr({ href, target: '_blank', rel: 'noopener noreferrer' })
    if (style) node.attr('style', style)
    if (tag === 'img' && isSafeUrl(src)) node.attr({ src, alt: String(attributes.alt || '').slice(0, 200) })
    if (tag === 'video') node.attr('controls', 'controls')
    if (tag === 'video' && isSafeUrl(src)) node.attr('src', src)
    if (tag === 'audio') node.attr('controls', 'controls')
    if (tag === 'audio' && isSafeUrl(src)) node.attr('src', src)
    if (tag === 'video' && isSafeUrl(poster)) node.attr('poster', poster)
    if (tag === 'source' && isSafeUrl(src)) node.attr({ src, type: String(attributes.type || '').slice(0, 100) })
    if (['td', 'th'].includes(tag)) {
      if (/^\d{1,2}$/.test(attributes.rowspan || '')) node.attr('rowspan', attributes.rowspan)
      if (/^\d{1,2}$/.test(attributes.colspan || '')) node.attr('colspan', attributes.colspan)
    }
    if (tag === 'input' && attributes.type === 'checkbox') node.attr({ type: 'checkbox', disabled: 'disabled', ...(attributes.checked !== undefined ? { checked: 'checked' } : {}) })
    if (tag === 'code' && /^language-[a-z0-9_-]+$/i.test(attributes.class || '')) node.attr('class', attributes.class)
    if (['div', 'span'].includes(tag) && /^\w[\w-]{0,40}$/.test(attributes['data-w-e-type'] || '')) node.attr('data-w-e-type', attributes['data-w-e-type'])
    if (tag === 'div' && attributes['data-w-e-is-void'] !== undefined) node.attr('data-w-e-is-void', 'true')
  })
  const html = $.html().trim()
  if (!$.root().text().replace(/\u00a0/g, ' ').trim() && !$('img,video,audio,table').length) throw new Error('请输入内容')
  return html
}

module.exports = { sanitizeRichContent }
