'use strict'

class DataImportHistoryRepository {
  async list(connection, { status, strategy, userId, pageSize, offset }) {
    const conditions = []
    const queryParams = []

    if (status) {
      conditions.push('status = ?')
      queryParams.push(status)
    }
    if (strategy) {
      conditions.push('strategy = ?')
      queryParams.push(strategy)
    }
    if (userId) {
      conditions.push('user_id = ?')
      queryParams.push(userId)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM import_history ${whereClause}`,
      queryParams
    )
    const total = countResult[0].total
    const [history] = await connection.execute(`
        SELECT
          id,
          import_id,
          user_id,
          user_name,
          strategy,
          file_name,
          total_records,
          imported,
          updated,
          skipped,
          error_count,
          status,
          error_message,
          start_time,
          end_time,
          duration_ms,
          created_at,
          updated_at
        FROM import_history
        ${whereClause}
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset])

    return { total, history }
  }

  findById(connection, id) { return connection.execute('SELECT id FROM import_history WHERE id = ?', [id]) }
  remove(connection, id) { return connection.execute('DELETE FROM import_history WHERE id = ?', [id]) }
}

module.exports = DataImportHistoryRepository
