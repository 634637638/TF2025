'use strict'

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { getDatabase } = require('../config/database')
const { createGuideFileAccess } = require('../utils/guide-file-access')
const { getRelativeUploadPathFromUrl, getUploadUrl } = require('../utils/upload-paths')

const ACCESS_POLICIES = new Set(['once', 'day', 'days', 'month', 'quarter', 'year', 'permanent'])

const toNullableText = value => {
  const text = value === undefined || value === null ? '' : String(value).trim()
  return text || null
}

const toBooleanInt = value => (value === true || value === 1 || value === '1' ? 1 : 0)

const normalizeUrl = value => {
  const url = toNullableText(value)
  if (!url) return null
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) throw new Error('链接必须使用 http、https、mailto 或 tel 协议')
  if (url.length > 500) throw new Error('链接不能超过500个字符')
  return url
}

const normalizeName = (value, label) => {
  const name = String(value || '').trim()
  if (!name) throw new Error(`${label}不能为空`)
  if (name.length > 120) throw new Error(`${label}不能超过120个字符`)
  return name
}

function normalizeCategoryAccess(payload, existing = {}) {
  const accessMode = payload.access_mode === 'password' ? 'password' : 'public'
  if (accessMode === 'public') {
    return { accessMode, passwordHash: null, passwordPolicy: null, passwordExpiresDays: null }
  }

  const password = String(payload.password || '').trim()
  if (password && Buffer.byteLength(password, 'utf8') > 72) throw new Error('访问密码不能超过72字节')
  const passwordHash = password ? bcrypt.hashSync(password, 12) : existing.password_hash
  if (!passwordHash) throw new Error('密码分类必须设置访问密码')

  const passwordPolicy = ACCESS_POLICIES.has(payload.password_policy)
    ? payload.password_policy
    : (existing.password_policy || 'permanent')
  const passwordExpiresDays = passwordPolicy === 'days'
    ? Math.max(1, Math.min(3650, Number(payload.password_expires_days || existing.password_expires_days || 1)))
    : null

  return { accessMode, passwordHash, passwordPolicy, passwordExpiresDays }
}

function publicLink(row) {
  const hasFile = row.link_type === 'file' && Boolean(row.file_url)
  const requiresToken = row.category_access_mode === 'password' || row.parent_access_mode === 'password'
  const fileAccess = hasFile && requiresToken ? createGuideFileAccess(row.id) : null
  return {
    id: Number(row.id), category_id: Number(row.category_id), title: row.title, description: row.description || '', url: row.url,
    link_type: row.link_type, icon: row.icon,
    file_url: hasFile ? `/api/public/guide/files/${Number(row.id)}` : null,
    file_expires_at: fileAccess?.expires_at || null,
    file_signature: fileAccess?.signature || null,
    file_name: row.file_name || null, file_mime: row.file_mime || null,
    sort_order: Number(row.sort_order || 0), is_enabled: Boolean(row.is_enabled)
  }
}

function normalizeGuideFileUrl(value, existingUrl = null) {
  const fileUrl = toNullableText(value)
  if (!fileUrl) return null
  if (fileUrl.startsWith('/api/public/guide/files/')) return existingUrl
  const relativePath = getRelativeUploadPathFromUrl(fileUrl)
  if (!relativePath || !relativePath.startsWith('guide/')) throw new Error('文件地址无效')
  const segments = relativePath.split('/')
  if (segments.length !== 2 || !/^[\w.-]+$/.test(segments[1]) || segments[1].startsWith('.')) throw new Error('文件地址无效')
  return getUploadUrl('guide', segments[1])
}

async function getFileAccessRecord(id) {
  const db = getDatabase()
  const [rows] = await db.query(
    'SELECT l.id, l.category_id, l.link_type, l.file_url, l.file_name, l.file_mime, l.is_enabled, ' +
    'c.is_enabled AS category_enabled, c.access_mode AS category_access_mode, ' +
    'p.is_enabled AS parent_enabled, p.access_mode AS parent_access_mode ' +
    'FROM guide_links l JOIN guide_categories c ON c.id=l.category_id ' +
    'LEFT JOIN guide_categories p ON p.id=c.parent_id WHERE l.id=? LIMIT 1',
    [id]
  )
  const row = rows[0]
  if (!row || row.link_type !== 'file' || !row.file_url || Number(row.is_enabled) !== 1 || Number(row.category_enabled) !== 1 || (row.parent_enabled !== null && Number(row.parent_enabled) !== 1)) return null
  row.requires_token = row.category_access_mode === 'password' || row.parent_access_mode === 'password'
  return row
}

function publicCategory(row, links, children = [], unlocked = false) {
  return {
    id: Number(row.id), parent_id: row.parent_id === null ? null : Number(row.parent_id), name: row.name, description: row.description || '', icon: row.icon || '',
    sort_order: Number(row.sort_order || 0), is_enabled: Boolean(row.is_enabled),
    access_mode: row.access_mode, locked: !unlocked && row.access_mode === 'password', links, children
  }
}

async function listAnnouncements(publicOnly = false) {
  const db = getDatabase()
  const where = publicOnly
    ? 'WHERE is_enabled = 1 AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())'
    : ''
  const [rows] = await db.query(`SELECT * FROM guide_announcements ${where} ORDER BY is_pinned DESC, sort_order ASC, id DESC`)
  return rows.map(row => ({ ...row, id: Number(row.id), is_enabled: Boolean(row.is_enabled), is_pinned: Boolean(row.is_pinned), sort_order: Number(row.sort_order || 0) }))
}

async function listCategories({ publicOnly = false, includeLinks = false } = {}) {
  const db = getDatabase()
  const where = publicOnly ? 'WHERE is_enabled = 1' : ''
  const [rows] = await db.query(`SELECT id, parent_id, name, description, icon, sort_order, is_enabled, access_mode, password_policy, password_expires_days, created_at, updated_at FROM guide_categories ${where} ORDER BY sort_order ASC, id ASC`)
  if (rows.length === 0) return []

  const ids = rows.map(row => row.id)
  const [links] = includeLinks
    ? await db.query(`SELECT l.*, c.access_mode AS category_access_mode, p.access_mode AS parent_access_mode FROM guide_links l JOIN guide_categories c ON c.id=l.category_id LEFT JOIN guide_categories p ON p.id=c.parent_id WHERE l.category_id IN (${ids.map(() => '?').join(',')}) ${publicOnly ? 'AND l.is_enabled = 1' : ''} ORDER BY l.sort_order ASC, l.id ASC`, ids)
    : [[]]
  const byCategory = new Map()
  links.forEach(link => {
    const key = Number(link.category_id)
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key).push(publicLink(link))
  })
  const byId = new Map(rows.map(row => [Number(row.id), { ...row, id: Number(row.id), parent_id: row.parent_id === null ? null : Number(row.parent_id), is_enabled: Boolean(row.is_enabled), sort_order: Number(row.sort_order || 0), locked: row.access_mode === 'password', links: byCategory.get(Number(row.id)) || [], children: [] }]))
  const roots = []
  byId.forEach(category => {
    const parent = category.parent_id ? byId.get(category.parent_id) : null
    if (parent) parent.children.push(category)
    else if (!category.parent_id) roots.push(category)
  })
  return roots
}

async function listPublicGuide() {
  const announcements = await listAnnouncements(true)
  const categories = await listCategories({ publicOnly: true, includeLinks: true })
  return {
    announcements,
    categories: categories.map(category => publicCategory(
      category,
      category.access_mode === 'public' ? category.links : [],
      category.access_mode === 'public'
        ? category.children.map(child => publicCategory(child, child.access_mode === 'public' ? child.links : []))
        : []
    ))
  }
}

async function getCategory(id, { publicOnly = true, unlocked = false } = {}) {
  const db = getDatabase()
  const [rows] = await db.query('SELECT * FROM guide_categories WHERE id = ? LIMIT 1', [id])
  if (!rows.length || (publicOnly && !rows[0].is_enabled)) return null
  const [links] = await db.query('SELECT l.*, c.access_mode AS category_access_mode, p.access_mode AS parent_access_mode FROM guide_links l JOIN guide_categories c ON c.id=l.category_id LEFT JOIN guide_categories p ON p.id=c.parent_id WHERE l.category_id = ? AND l.is_enabled = 1 ORDER BY l.sort_order ASC, l.id ASC', [id])
  const [children] = await db.query('SELECT * FROM guide_categories WHERE parent_id = ? AND is_enabled = 1 ORDER BY sort_order ASC, id ASC', [id])
  const childIds = children.map(child => child.id)
  const [childLinks] = childIds.length
    ? await db.query(`SELECT l.*, c.access_mode AS category_access_mode, p.access_mode AS parent_access_mode FROM guide_links l JOIN guide_categories c ON c.id=l.category_id LEFT JOIN guide_categories p ON p.id=c.parent_id WHERE l.category_id IN (${childIds.map(() => '?').join(',')}) AND l.is_enabled = 1 ORDER BY l.sort_order ASC, l.id ASC`, childIds)
    : [[]]
  const linksByCategory = new Map()
  childLinks.forEach(link => {
    const key = Number(link.category_id)
    if (!linksByCategory.has(key)) linksByCategory.set(key, [])
    linksByCategory.get(key).push(publicLink(link))
  })
  return publicCategory(rows[0], links.map(publicLink), children.map(child => publicCategory(
    child,
    child.access_mode === 'public' ? linksByCategory.get(Number(child.id)) || [] : []
  )), unlocked)
}

async function createAccessToken(categoryId, policy, expiresDays, database = getDatabase()) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  let expiresAt = null
  let remainingUses = null
  if (policy === 'once') {
    expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    remainingUses = 1
  } else if (policy !== 'permanent') {
    const days = policy === 'day' ? 1 : policy === 'month' ? 30 : policy === 'quarter' ? 90 : policy === 'year' ? 365 : expiresDays
    expiresAt = new Date(Date.now() + Number(days || 1) * 24 * 60 * 60 * 1000)
  }
  await database.query('INSERT INTO guide_access_tokens (token_hash, category_id, expires_at, remaining_uses) VALUES (?, ?, ?, ?)', [tokenHash, categoryId, expiresAt, remainingUses])
  return token
}

async function unlockCategory(id, password) {
  const db = getDatabase()
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query('SELECT * FROM guide_categories WHERE id = ? AND is_enabled = 1 LIMIT 1 FOR UPDATE', [id])
    if (!rows.length) throw new Error('分类不存在')
    const category = rows[0]
    if (category.access_mode !== 'password') {
      await connection.commit()
      return { category: await getCategory(id), access_token: null }
    }
    if (!password || !(await bcrypt.compare(String(password), category.password_hash || ''))) throw new Error('密码错误')
    if (category.password_policy === 'once' && category.password_used_at) throw new Error('一次性访问密码已使用')
    if (category.password_policy === 'once') {
      await connection.query('UPDATE guide_categories SET password_used_at = NOW() WHERE id = ?', [id])
    }
    const accessToken = await createAccessToken(id, category.password_policy || 'permanent', category.password_expires_days, connection)
    await connection.commit()
    return { access_token: accessToken }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function getProtectedCategory(id, token) {
  const db = getDatabase()
  const [categoryRows] = await db.query('SELECT id, access_mode, is_enabled FROM guide_categories WHERE id = ? LIMIT 1', [id])
  if (!categoryRows.length || !categoryRows[0].is_enabled) return null
  if (categoryRows[0].access_mode === 'public') return getCategory(id)
  if (!token) throw new Error('请输入分类访问密码')
  const hash = crypto.createHash('sha256').update(String(token)).digest('hex')
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query('SELECT * FROM guide_access_tokens WHERE token_hash = ? AND category_id = ? AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE', [hash, id])
    if (!rows.length) throw new Error('分类访问权限已失效，请重新输入密码')
    const session = rows[0]
    if (session.remaining_uses !== null && Number(session.remaining_uses) <= 0) throw new Error('分类访问权限已使用')
    if (session.remaining_uses !== null) {
      await connection.query('UPDATE guide_access_tokens SET remaining_uses = remaining_uses - 1 WHERE id = ?', [session.id])
    }
    await connection.commit()
    return getCategory(id, { unlocked: true })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function createAnnouncement(userId, payload) {
  const db = getDatabase()
  const title = normalizeName(payload.title, '公告标题')
  const content = toNullableText(payload.content)
  const linkUrl = normalizeUrl(payload.link_url)
  const isPinned = toBooleanInt(payload.is_pinned)
  if (isPinned) await db.query('UPDATE guide_announcements SET is_pinned=0')
  const [result] = await db.query('INSERT INTO guide_announcements (title, content, link_url, is_pinned, is_enabled, sort_order, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [title, content, linkUrl, isPinned, toBooleanInt(payload.is_enabled ?? 1), Number(payload.sort_order || 0), toNullableText(payload.starts_at), toNullableText(payload.ends_at), userId])
  return getAnnouncement(result.insertId)
}

async function getAnnouncement(id) {
  const db = getDatabase()
  const [rows] = await db.query('SELECT * FROM guide_announcements WHERE id = ?', [id])
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), is_enabled: Boolean(rows[0].is_enabled), is_pinned: Boolean(rows[0].is_pinned), sort_order: Number(rows[0].sort_order || 0) } : null
}

async function updateAnnouncement(id, payload) {
  const current = await getAnnouncement(id)
  if (!current) throw new Error('公告不存在')
  const db = getDatabase()
  const isPinned = toBooleanInt(payload.is_pinned ?? current.is_pinned)
  if (isPinned) await db.query('UPDATE guide_announcements SET is_pinned=0 WHERE id<>?', [id])
  await db.query('UPDATE guide_announcements SET title=?, content=?, link_url=?, is_pinned=?, is_enabled=?, sort_order=?, starts_at=?, ends_at=? WHERE id=?', [normalizeName(payload.title ?? current.title, '公告标题'), toNullableText(payload.content), normalizeUrl(payload.link_url), isPinned, toBooleanInt(payload.is_enabled), Number(payload.sort_order || 0), toNullableText(payload.starts_at), toNullableText(payload.ends_at), id])
  return getAnnouncement(id)
}

async function createCategory(userId, payload) {
  const db = getDatabase()
  const parentId = await normalizeCategoryParent(db, payload.parent_id)
  const access = normalizeCategoryAccess(payload)
  const [result] = await db.query('INSERT INTO guide_categories (parent_id, name, description, icon, sort_order, is_enabled, access_mode, password_hash, password_policy, password_expires_days, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [parentId, normalizeName(payload.name, '分类名称'), toNullableText(payload.description), toNullableText(payload.icon), Number(payload.sort_order || 0), toBooleanInt(payload.is_enabled ?? 1), access.accessMode, access.passwordHash, access.passwordPolicy, access.passwordExpiresDays, userId])
  return getAdminCategory(result.insertId)
}

async function updateCategory(id, payload) {
  const current = await getAdminCategory(id)
  if (!current) throw new Error('分类不存在')
  const db = getDatabase()
  const parentId = await normalizeCategoryParent(db, payload.parent_id === undefined ? current.parent_id : payload.parent_id, id)
  const [childRows] = await db.query('SELECT id FROM guide_categories WHERE parent_id=? LIMIT 1', [id])
  if (parentId && childRows.length) throw new Error('含有二级分类的一级分类不能移动到二级分类下')
  const [secretRows] = await db.query('SELECT password_hash, password_policy, password_expires_days FROM guide_categories WHERE id=?', [id])
  const access = normalizeCategoryAccess(payload, { ...current, ...(secretRows[0] || {}) })
  const resetSingleUsePassword = Boolean(String(payload.password || '').trim()) || payload.password_policy !== current.password_policy
  await db.query('UPDATE guide_categories SET parent_id=?, name=?, description=?, icon=?, sort_order=?, is_enabled=?, access_mode=?, password_hash=?, password_policy=?, password_expires_days=?, password_used_at=IF(?, NULL, password_used_at) WHERE id=?', [parentId, normalizeName(payload.name ?? current.name, '分类名称'), toNullableText(payload.description), toNullableText(payload.icon), Number(payload.sort_order || 0), toBooleanInt(payload.is_enabled), access.accessMode, access.passwordHash, access.passwordPolicy, access.passwordExpiresDays, resetSingleUsePassword ? 1 : 0, id])
  await db.query('DELETE FROM guide_access_tokens WHERE category_id = ?', [id])
  return getAdminCategory(id)
}

async function getAdminCategory(id) {
  const db = getDatabase()
  const [rows] = await db.query('SELECT id, parent_id, name, description, icon, sort_order, is_enabled, access_mode, password_policy, password_expires_days, created_at, updated_at FROM guide_categories WHERE id=?', [id])
  if (!rows.length) return null
  const [links] = await db.query('SELECT * FROM guide_links WHERE category_id=? ORDER BY sort_order ASC, id ASC', [id])
  const [children] = await db.query('SELECT id, parent_id, name, description, icon, sort_order, is_enabled, access_mode, password_policy, password_expires_days, created_at, updated_at FROM guide_categories WHERE parent_id=? ORDER BY sort_order ASC, id ASC', [id])
  const childIds = children.map(child => child.id)
  const [childLinks] = childIds.length
    ? await db.query(`SELECT * FROM guide_links WHERE category_id IN (${childIds.map(() => '?').join(',')}) ORDER BY sort_order ASC, id ASC`, childIds)
    : [[]]
  const linksByCategory = new Map()
  childLinks.forEach(link => {
    const key = Number(link.category_id)
    if (!linksByCategory.has(key)) linksByCategory.set(key, [])
    linksByCategory.get(key).push(publicLink(link))
  })
  return { ...rows[0], id: Number(rows[0].id), parent_id: rows[0].parent_id === null ? null : Number(rows[0].parent_id), is_enabled: Boolean(rows[0].is_enabled), sort_order: Number(rows[0].sort_order || 0), locked: rows[0].access_mode === 'password', links: links.map(publicLink), children: children.map(child => ({ ...child, id: Number(child.id), parent_id: Number(child.parent_id), is_enabled: Boolean(child.is_enabled), sort_order: Number(child.sort_order || 0), locked: child.access_mode === 'password', links: linksByCategory.get(Number(child.id)) || [] })) }
}

async function normalizeCategoryParent(db, parentId, categoryId = null) {
  if (parentId === undefined || parentId === null || parentId === '') return null
  const normalizedParentId = Number(parentId)
  if (!Number.isInteger(normalizedParentId) || normalizedParentId <= 0) throw new Error('上级分类无效')
  if (categoryId && normalizedParentId === Number(categoryId)) throw new Error('分类不能选择自己作为上级')
  const [rows] = await db.query('SELECT id, parent_id FROM guide_categories WHERE id=? LIMIT 1', [normalizedParentId])
  if (!rows.length) throw new Error('上级分类不存在')
  if (rows[0].parent_id !== null) throw new Error('二级分类不能再创建下级分类')
  return normalizedParentId
}

async function normalizeLinkCategory(db, categoryId) {
  const normalizedCategoryId = Number(categoryId)
  if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) throw new Error('所属分类无效')
  const [rows] = await db.query('SELECT id FROM guide_categories WHERE id=? LIMIT 1', [normalizedCategoryId])
  if (!rows.length) throw new Error('所属分类不存在')
  return normalizedCategoryId
}

async function createLink(userId, categoryId, payload) {
  const db = getDatabase()
  const [categories] = await db.query('SELECT id FROM guide_categories WHERE id=?', [categoryId])
  if (!categories.length) throw new Error('分类不存在')
  const linkType = payload.link_type === 'file' ? 'file' : 'url'
  const targetCategoryId = await normalizeLinkCategory(db, payload.category_id ?? categoryId)
  const url = linkType === 'url' ? normalizeUrl(payload.url) : null
  const fileUrl = linkType === 'file' ? normalizeGuideFileUrl(payload.file_url) : null
  const fileName = linkType === 'file' ? normalizeName(payload.file_name || '下载文件', '文件名称') : null
  const fileMime = linkType === 'file' ? toNullableText(payload.file_mime) : null
  if (linkType === 'url' && !url) throw new Error('网址导航必须填写链接')
  if (linkType === 'file' && !fileUrl) throw new Error('文件类型导航必须上传文件')
  const [result] = await db.query('INSERT INTO guide_links (category_id, title, description, url, link_type, icon, file_url, file_name, file_mime, is_enabled, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [targetCategoryId, normalizeName(payload.title, '导航名称'), toNullableText(payload.description), url, linkType, toNullableText(payload.icon), fileUrl, fileName, fileMime, toBooleanInt(payload.is_enabled ?? 1), Number(payload.sort_order || 0), userId])
  return getLink(result.insertId)
}

async function getLink(id) {
  const db = getDatabase()
  const [rows] = await db.query('SELECT * FROM guide_links WHERE id=?', [id])
  return rows[0] ? publicLink(rows[0]) : null
}

async function getLinkStorage(id) {
  const db = getDatabase()
  const [rows] = await db.query('SELECT * FROM guide_links WHERE id=?', [id])
  return rows[0] || null
}

async function getCategoryLinksStorage(id) {
  const db = getDatabase()
  const [rows] = await db.query(
    'SELECT l.* FROM guide_links l JOIN guide_categories c ON c.id=l.category_id ' +
    'WHERE c.id=? OR c.parent_id=?',
    [id, id]
  )
  return rows
}

async function updateLink(id, payload) {
  const current = await getLinkStorage(id)
  if (!current) throw new Error('导航不存在')
  const linkType = payload.link_type === 'file' ? 'file' : 'url'
  const db = getDatabase()
  const targetCategoryId = await normalizeLinkCategory(db, payload.category_id === undefined ? current.category_id : payload.category_id)
  const url = linkType === 'url' ? normalizeUrl(payload.url) : null
  const fileUrl = linkType === 'file' ? normalizeGuideFileUrl(payload.file_url ?? current.file_url, current.file_url) : null
  const fileName = linkType === 'file' ? normalizeName(payload.file_name || current.file_name || '下载文件', '文件名称') : null
  const fileMime = linkType === 'file' ? toNullableText(payload.file_mime || current.file_mime) : null
  if (linkType === 'url' && !url) throw new Error('网址导航必须填写链接')
  if (linkType === 'file' && !fileUrl) throw new Error('文件类型导航必须上传文件')
  await db.query('UPDATE guide_links SET category_id=?, title=?, description=?, url=?, link_type=?, icon=?, file_url=?, file_name=?, file_mime=?, is_enabled=?, sort_order=? WHERE id=?', [targetCategoryId, normalizeName(payload.title ?? current.title, '导航名称'), toNullableText(payload.description), url, linkType, toNullableText(payload.icon), fileUrl, fileName, fileMime, toBooleanInt(payload.is_enabled), Number(payload.sort_order || 0), id])
  return getLink(id)
}

async function deleteCategory(id) { await getDatabase().query('DELETE FROM guide_categories WHERE id=?', [id]) }
async function deleteAnnouncement(id) { await getDatabase().query('DELETE FROM guide_announcements WHERE id=?', [id]) }
async function deleteLink(id) { await getDatabase().query('DELETE FROM guide_links WHERE id=?', [id]) }

module.exports = { listAnnouncements, listCategories, listPublicGuide, unlockCategory, getProtectedCategory, createAnnouncement, updateAnnouncement, deleteAnnouncement, createCategory, updateCategory, deleteCategory, createLink, updateLink, deleteLink, getLink, getLinkStorage, getCategoryLinksStorage, getFileAccessRecord, getAdminCategory }
