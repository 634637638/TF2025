const fs = require('fs')
const _path = require('path')
const cheerio = require('cheerio')
const { getDatabase } = require('../config/database')
const { ensureSharedSchema } = require('../utils/shared-schema')
const { getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('../utils/upload-paths')

const parseAttachments = value => {
  if (Array.isArray(value)) return value
  try { return JSON.parse(value || '[]') } catch (_) { return [] }
}
const isSharedAttachmentUrl = value => typeof value === 'string' && /^\/uploads\/shared\/[a-zA-Z0-9._-]+$/.test(value)
const cleanAttachments = value => parseAttachments(value).filter(item => item && isSharedAttachmentUrl(item.url)).map(item => ({
  url: item.url.trim(),
  name: String(item.name || '附件').slice(0, 200),
  type: String(item.type || 'application/octet-stream').slice(0, 120),
  size: Math.max(0, Number(item.size || 0))
}))
const deleteUnreferencedAttachmentFiles = async (db, attachments) => {
  for (const attachment of cleanAttachments(attachments)) {
    try {
      const [usageRows] = await db.query("SELECT COUNT(*) total FROM shared_posts WHERE JSON_SEARCH(attachments, 'one', ?) IS NOT NULL", [attachment.url])
      if (Number(usageRows[0]?.total || 0) > 0) continue
      const filePath = getUploadPathFromUrl(attachment.url)
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (_) { /* ignore invalid or already removed files */ }
  }
}
const validateAttachments = value => {
  const attachments = cleanAttachments(value)
  if (attachments.length > 10) throw new Error('附件最多上传10个')
  return attachments
}
const validateAttachmentOwnership = (attachments, userId, existingAttachments = []) => {
  const retainedUrls = new Set(cleanAttachments(existingAttachments).map(item => item.url))
  const ownedPrefix = `/uploads/shared/${Number(userId)}_`
  if (attachments.some(item => !retainedUrls.has(item.url) && !item.url.startsWith(ownedPrefix))) {
    throw new Error('附件不属于当前用户')
  }
}
const normalizeCategory = value => {
  const category = String(value || '').trim().replace(/\s+/g, ' ')
  if (!category) return '未分类'
  if (category.length > 60) throw new Error('分类不能超过60个字符')
  return category
}
const normalizeVisibility = value => value === 'private' ? 'private' : 'public'
const allowedRichTextTags = new Set([
  'p', 'div', 'span', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li',
  'blockquote', 'a', 'pre', 'code', 'img', 'video', 'audio', 'source',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'
])
const safeMediaUrl = value => /^https?:\/\//i.test(value) || isSharedAttachmentUrl(value)
const sanitizeRichStyle = value => String(value || '').split(';').map(rule => rule.trim()).filter(Boolean).filter(rule => {
  const [property, ...parts] = rule.split(':')
  const name = String(property || '').trim().toLowerCase()
  const content = parts.join(':').trim()
  if (['text-align'].includes(name)) return /^(left|center|right|justify)$/.test(content)
  if (name === 'line-height') return /^\d+(\.\d+)?$/.test(content)
  if (name === 'padding-left') return /^\d+(\.\d+)?em$/.test(content)
  if (name === 'font-size') return /^\d+(\.\d+)?(px|em|rem|%)$/.test(content)
  if (name === 'font-family') return /^[\w\s,'"\-\u4e00-\u9fa5]+$/.test(content)
  if (['color', 'background-color'].includes(name)) return /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(content)
  if (['width', 'height'].includes(name)) return /^(auto|\d+(\.\d+)?(px|%))$/.test(content)
  return false
}).join('; ')
const sanitizeRichText = value => {
  const source = String(value || '').trim()
  if (source.length > 100000) throw new Error('内容不能超过100000个字符')
  const $ = cheerio.load(source, null, false)
  $('*').each((_index, element) => {
    const node = $(element)
    const tag = String(element.tagName || '').toLowerCase()
    if (!allowedRichTextTags.has(tag)) {
      node.replaceWith(node.contents())
      return
    }
    const attributes = { ...(element.attribs || {}) }
    const href = tag === 'a' ? String(attributes.href || '').trim() : ''
    const src = ['img', 'video', 'audio', 'source'].includes(tag) ? String(attributes.src || '').trim() : ''
    const poster = tag === 'video' ? String(attributes.poster || '').trim() : ''
    const style = sanitizeRichStyle(attributes.style)
    for (const attribute of Object.keys(element.attribs || {})) node.removeAttr(attribute)
    if (tag === 'a' && safeMediaUrl(href)) node.attr({ href, target: '_blank', rel: 'noopener noreferrer' })
    if (style) node.attr('style', style)
    if (tag === 'img' && safeMediaUrl(src)) node.attr({ src, alt: String(attributes.alt || '').slice(0, 200) })
    if (tag === 'video') node.attr('controls', 'controls')
    if (tag === 'video' && safeMediaUrl(src)) node.attr('src', src)
    if (tag === 'audio') node.attr('controls', 'controls')
    if (tag === 'audio' && safeMediaUrl(src)) node.attr('src', src)
    if (tag === 'video' && safeMediaUrl(poster)) node.attr('poster', poster)
    if (tag === 'source' && safeMediaUrl(src)) node.attr({ src, type: String(attributes.type || '').slice(0, 100) })
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

class SharedService {
  async ensure() { await ensureSharedSchema() }

  serialize(row) {
    return {
      ...row,
      is_pinned: Boolean(row.is_pinned),
      category: row.category,
      visibility: normalizeVisibility(row.visibility),
      attachments: cleanAttachments(row.attachments),
      author: { id: row.author_id, name: row.author_name, username: row.author_username }
    }
  }

  async list(userId, { page = 1, page_size = 12, keyword = '', search_fields = ['title', 'content'], category = '', visibility = '' } = {}) {
    await this.ensure()
    const db = getDatabase()
    const pageInt = Math.max(1, Number.parseInt(page, 10) || 1)
    const page_size_int = Math.min(50, Math.max(1, Number.parseInt(page_size, 10) || 12))
    const conditions = ["(p.visibility='public' OR p.author_id=?)"]
    const params = [userId]
    if (String(keyword || '').trim()) {
      const allowedSearchFields = search_fields.filter(field => field === 'title' || field === 'content')
      if (allowedSearchFields.length) {
        conditions.push(`(${allowedSearchFields.map(field => `p.${field} LIKE ?`).join(' OR ')})`)
        params.push(...allowedSearchFields.map(() => `%${String(keyword).trim()}%`))
      }
    }
    const normalizedCategory = String(category || '').trim()
    if (normalizedCategory) {
      conditions.push('p.category=?')
      params.push(normalizedCategory)
    }
    if (visibility === 'public') conditions.push("p.visibility='public'")
    if (visibility === 'private') {
      conditions.push("p.visibility='private'")
      conditions.push('p.author_id=?')
      params.push(userId)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const [countRows] = await db.query(`SELECT COUNT(*) total FROM shared_posts p ${where}`, params)
    const [rows] = await db.query(`
      SELECT p.id, p.title, p.content, p.attachments, p.category, p.visibility, p.is_pinned, p.author_id, p.created_at, p.updated_at,
             u.name author_name, u.username author_username
      FROM shared_posts p LEFT JOIN users u ON u.id=p.author_id
      ${where}
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT ${page_size_int} OFFSET ${(pageInt - 1) * page_size_int}
    `, params)
    const total = Number(countRows[0]?.total || 0)
    const total_pages = Math.ceil(total / page_size_int)
    return { rows: rows.map(row => this.serialize(row)), pagination: { page: pageInt, page_size: page_size_int, total, total_pages, has_next: pageInt < total_pages, has_prev: pageInt > 1 } }
  }

  async getById(id, viewerId = null) {
    await this.ensure()
    const params = [id]
    const visibilityWhere = viewerId === null ? '' : " AND (p.visibility='public' OR p.author_id=?)"
    if (viewerId !== null) params.push(viewerId)
    const [rows] = await getDatabase().query(`SELECT p.id, p.title, p.content, p.attachments, p.category, p.visibility, p.is_pinned, p.author_id, p.created_at, p.updated_at,
      u.name author_name, u.username author_username FROM shared_posts p LEFT JOIN users u ON u.id=p.author_id WHERE p.id=?${visibilityWhere}`, params)
    return rows[0] ? this.serialize(rows[0]) : null
  }

  async listCategories(userId) {
    await this.ensure()
    const [rows] = await getDatabase().query(`
      SELECT c.id, c.name, c.sort_order, COUNT(p.id) total
      FROM shared_categories c
      LEFT JOIN shared_posts p
        ON p.category=c.name
       AND (p.visibility='public' OR p.author_id=?)
      GROUP BY c.id, c.name, c.sort_order
      ORDER BY c.sort_order ASC, c.id ASC
    `, [userId])
    return rows.map(row => ({
      id: Number(row.id),
      name: row.name,
      sort_order: Number(row.sort_order || 0),
      total: Number(row.total || 0)
    }))
  }

  async canAccessAttachment(url, userId) {
    await this.ensure()
    if (!isSharedAttachmentUrl(url)) return { referenced: false, allowed: false }
    const [rows] = await getDatabase().query(`
      SELECT
        COUNT(*) referenced_count,
        SUM(CASE WHEN visibility='public' OR author_id=? THEN 1 ELSE 0 END) allowed_count
      FROM shared_posts
      WHERE JSON_SEARCH(attachments, 'one', ?) IS NOT NULL
    `, [userId, url])
    return {
      referenced: Number(rows[0]?.referenced_count || 0) > 0,
      allowed: Number(rows[0]?.allowed_count || 0) > 0
    }
  }

  async validateCategory(category) {
    const [rows] = await getDatabase().query('SELECT id FROM shared_categories WHERE name=? LIMIT 1', [category])
    if (!rows.length) throw new Error('所选分类不存在，请重新选择')
  }

  async createCategory(payload) {
    await this.ensure()
    const name = normalizeCategory(payload?.name)
    try {
      const [result] = await getDatabase().query(
        'INSERT INTO shared_categories (name, sort_order) VALUES (?, (SELECT next_sort FROM (SELECT COALESCE(MAX(sort_order), 0) + 10 next_sort FROM shared_categories) s))',
        [name]
      )
      return { id: Number(result.insertId), name }
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('分类名称已存在')
      throw error
    }
  }

  async updateCategory(id, payload) {
    await this.ensure()
    const name = normalizeCategory(payload?.name)
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT name FROM shared_categories WHERE id=? FOR UPDATE', [id])
      if (!rows.length) throw new Error('分类不存在')
      const previousName = rows[0].name
      if (previousName === '未分类') throw new Error('默认分类不能修改')
      await connection.query('UPDATE shared_categories SET name=? WHERE id=?', [name, id])
      await connection.query('UPDATE shared_posts SET category=? WHERE category=?', [name, previousName])
      await connection.commit()
      return { id: Number(id), name }
    } catch (error) {
      await connection.rollback()
      if (error?.code === 'ER_DUP_ENTRY') throw new Error('分类名称已存在')
      throw error
    } finally {
      connection.release()
    }
  }

  async removeCategory(id) {
    await this.ensure()
    const db = getDatabase()
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query('SELECT name FROM shared_categories WHERE id=? FOR UPDATE', [id])
      if (!rows.length) throw new Error('分类不存在')
      const name = rows[0].name
      if (name === '未分类') throw new Error('默认分类不能删除')
      await connection.query("UPDATE shared_posts SET category='未分类' WHERE category=?", [name])
      await connection.query('DELETE FROM shared_categories WHERE id=?', [id])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async create(userId, canManage, payload) {
    await this.ensure()
    const title = String(payload.title || '').trim()
    const content = sanitizeRichText(payload.content)
    if (!title) throw new Error('请输入经验标题')
    if (title.length > 200) throw new Error('标题不能超过200个字符')
    const category = normalizeCategory(payload.category)
    await this.validateCategory(category)
    const visibility = canManage ? normalizeVisibility(payload.visibility) : 'public'
    const attachments = validateAttachments(payload.attachments)
    validateAttachmentOwnership(attachments, userId)
    const [result] = await getDatabase().query('INSERT INTO shared_posts (title,content,attachments,category,visibility,author_id) VALUES (?,?,?,?,?,?)', [title, content, JSON.stringify(attachments), category, visibility, userId])
    return this.getById(result.insertId, userId)
  }

  async update(id, userId, canManage, payload) {
    await this.ensure()
    const existing = await this.getById(id, userId)
    if (!existing) throw new Error('分享不存在')
    if (!canManage && Number(existing.author_id) !== Number(userId)) throw new Error('只能编辑自己发布的分享')
    const title = String(payload.title || '').trim()
    const content = sanitizeRichText(payload.content)
    if (!title) throw new Error('标题和内容不能为空')
    if (title.length > 200) throw new Error('标题不能超过200个字符')
    const category = normalizeCategory(payload.category)
    await this.validateCategory(category)
    const canSetVisibility = canManage && Number(existing.author_id) === Number(userId)
    const visibility = canSetVisibility ? normalizeVisibility(payload.visibility) : existing.visibility
    const attachments = validateAttachments(payload.attachments)
    const previous = cleanAttachments(existing.attachments)
    validateAttachmentOwnership(attachments, userId, previous)
    const retained = new Set(attachments.map(item => item.url))
    const db = getDatabase()
    await db.query('UPDATE shared_posts SET title=?,content=?,attachments=?,category=?,visibility=?,updated_at=NOW() WHERE id=?', [title, content, JSON.stringify(attachments), category, visibility, id])
    await deleteUnreferencedAttachmentFiles(db, previous.filter(item => !retained.has(item.url)))
    return this.getById(id, userId)
  }

  async remove(id, userId, canManage) {
    await this.ensure()
    const existing = await this.getById(id, userId)
    if (!existing) throw new Error('分享不存在')
    if (!canManage && Number(existing.author_id) !== Number(userId)) throw new Error('只能删除自己发布的分享')
    const db = getDatabase()
    await db.query('DELETE FROM shared_posts WHERE id=?', [id])
    await deleteUnreferencedAttachmentFiles(db, existing.attachments)
  }

  async pin(id, pinned, _userId) {
    await this.ensure()
    const [result] = await getDatabase().query("UPDATE shared_posts SET is_pinned=? WHERE id=? AND visibility='public'", [pinned ? 1 : 0, id])
    if (!result.affectedRows) throw new Error('分享不存在')
  }

  async cleanupUploads(urls, userId) {
    await this.ensure()
    const ownedPrefix = `shared/${Number(userId)}_`
    const ownedUrls = urls
      .map(url => {
        const relativePath = getRelativeUploadPathFromUrl(
          typeof url === 'string' && url.startsWith('shared/') ? `/uploads/${url}` : url
        )
        return relativePath && relativePath.startsWith(ownedPrefix)
          ? `/uploads/${relativePath}`
          : ''
      })
      .filter(Boolean)
    await deleteUnreferencedAttachmentFiles(getDatabase(), ownedUrls.map(url => ({ url })))
  }
}

module.exports = new SharedService()
