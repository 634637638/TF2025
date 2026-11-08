'use strict'

const { getDatabase } = require('../config/database')

class FrontendErrorLogRepository {
  constructor(database = null) {
    this.database = database
  }

  async insertBatch({ userId, sessionId, environment, sessionData, errors }) {
    const database = this.database || getDatabase()
    const rowSql = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const values = errors.flatMap(error => [
      error.errorKey,
      userId,
      sessionId,
      error.level,
      error.errorType,
      error.message,
      error.stack,
      error.context,
      error.component,
      error.action,
      error.tags,
      error.occurredAt,
      error.count,
      error.pageUrl,
      error.userAgent,
      environment,
      sessionData
    ])

    await database.execute(`
      INSERT INTO frontend_error_logs (
        error_key, user_id, session_id, level, error_type, message, stack,
        context, component, action_name, tags, occurred_at, occurrence_count,
        page_url, user_agent, environment, session_data
      ) VALUES ${errors.map(() => rowSql).join(', ')}
      ON DUPLICATE KEY UPDATE
        occurrence_count = GREATEST(occurrence_count, VALUES(occurrence_count)),
        updated_at = CURRENT_TIMESTAMP
    `, values)
  }
}

module.exports = FrontendErrorLogRepository
