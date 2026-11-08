'use strict'

const { getDatabase } = require('../config/database')

class SubsidyStatsRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async getSummary({ whereConditions, queryParams, includeStoreStats }) {
    const database = this.getDb()
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN has_different_handler = 1 THEN 1 ELSE 0 END) as handler_count,
        COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
        COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
      FROM national_subsidies
      ${whereClause}
    `
    const storeStatsQuery = `
      SELECT
        store_id,
        store_name,
        COUNT(*) as total_count,
        SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
        COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
        COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
      FROM national_subsidies
      ${whereClause} AND store_id IS NOT NULL
      GROUP BY store_id, store_name
      ORDER BY total_count DESC
    `

    const statsPromise = (async () => {
      const startedAt = process.hrtime.bigint()
      const result = await database.execute(statsQuery, queryParams)
      return { rows: result[0], elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6 }
    })()
    const storeStatsPromise = includeStoreStats
      ? (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await database.execute(storeStatsQuery, queryParams)
        return { rows: result[0], elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6 }
      })()
      : Promise.resolve({ rows: [], elapsedMs: 0 })
    const [statsResult, storeStatsResult] = await Promise.all([statsPromise, storeStatsPromise])

    return {
      stats: statsResult.rows[0],
      storeStats: storeStatsResult.rows,
      statsQueryMs: statsResult.elapsedMs,
      storeStatsQueryMs: storeStatsResult.elapsedMs
    }
  }
}

module.exports = SubsidyStatsRepository
