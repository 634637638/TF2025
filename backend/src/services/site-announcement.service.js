'use strict'

const { sanitizeRichContent } = require('../utils/sanitize-rich-content')
const SiteAnnouncementRepository = require('../repositories/site-announcement.repository')

class AnnouncementValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AnnouncementValidationError'
  }
}

const normalizeAnnouncementInput = (body = {}) => {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const rawContent = typeof body.content === 'string' ? body.content : ''
  const isPinned = body.isPinned === true || body.isPinned === 1 || body.isPinned === '1'
  const isPublished = body.isPublished === true || body.isPublished === 1 || body.isPublished === '1'
  const expiresAt = body.expiresAt || null

  if (!title || title.length > 150) {
    throw new AnnouncementValidationError('公告标题不能为空且不能超过150个字符')
  }
  let content
  try {
    content = sanitizeRichContent(rawContent)
  } catch (error) {
    throw new AnnouncementValidationError(error.message)
  }
  if (expiresAt !== null) {
    const match = typeof expiresAt === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(expiresAt)
      : null
    if (!match) throw new AnnouncementValidationError('公告有效期格式无效')
    const [, year, month, day, hour, minute, second] = match.map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    if (
      date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second
    ) {
      throw new AnnouncementValidationError('公告有效期格式无效')
    }
  }

  return { title, content, isPublished, isPinned, expiresAt }
}

const toAnnouncementResponse = row => ({
  id: Number(row.id),
  title: row.title,
  content: row.content,
  isPublished: Boolean(row.is_published),
  isPinned: Boolean(row.is_pinned),
  publishedAt: row.published_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

class SiteAnnouncementService {
  constructor({ repository = new SiteAnnouncementRepository() } = {}) {
    this.repository = repository
  }

  async listPublished() {
    return (await this.repository.listPublished()).map(toAnnouncementResponse)
  }

  async listAdmin() {
    return (await this.repository.listAdmin()).map(toAnnouncementResponse)
  }

  async create(body) {
    const announcement = normalizeAnnouncementInput(body)
    const row = await this.repository.create(announcement)
    return { announcement: toAnnouncementResponse(row), isPublished: announcement.isPublished }
  }

  async update(id, body) {
    const announcement = normalizeAnnouncementInput(body)
    const row = await this.repository.update(id, announcement)
    return row ? toAnnouncementResponse(row) : null
  }

  async remove(id) {
    return this.repository.delete(id)
  }
}

module.exports = SiteAnnouncementService
module.exports.AnnouncementValidationError = AnnouncementValidationError
module.exports.normalizeAnnouncementInput = normalizeAnnouncementInput
