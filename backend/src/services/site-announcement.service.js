'use strict'

const { sanitizeRichContent } = require('../utils/sanitize-rich-content')

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

module.exports = { AnnouncementValidationError, normalizeAnnouncementInput }
