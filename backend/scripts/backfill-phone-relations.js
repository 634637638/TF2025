#!/usr/bin/env node

'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const SOLD_STATUSES = ['sold', 'peer_transfer', 'supplier_proxy']
const applyChanges = process.argv.includes('--apply')

function placeholders(values) {
  return values.map(() => '?').join(', ')
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 30000
  })
}

async function loadSummary(connection) {
  const statusSql = placeholders(SOLD_STATUSES)
  const [rows] = await connection.execute(`
    SELECT
      COUNT(*) AS sold_total,
      SUM(p.brand_id IS NULL OR p.brand_id = 0) AS missing_brand,
      SUM(p.model_id IS NULL OR p.model_id = 0) AS missing_model,
      SUM(
        (p.brand_id IS NULL OR p.brand_id = 0)
        AND (p.model_id IS NULL OR p.model_id = 0)
      ) AS missing_both,
      SUM(
        (p.brand_id IS NULL OR p.brand_id = 0)
        AND (
          target_brand.id IS NOT NULL
          OR (m.id IS NULL AND consensus_brand.id IS NOT NULL)
        )
      ) AS safe_brand_updates
    FROM phones p
    LEFT JOIN models m ON m.id = p.model_id
    LEFT JOIN brands target_brand ON target_brand.id = m.brand_id
    LEFT JOIN (
      SELECT model_id, MIN(brand_id) AS brand_id
      FROM phones
      WHERE model_id IS NOT NULL
        AND brand_id IS NOT NULL
        AND brand_id <> 0
      GROUP BY model_id
      HAVING COUNT(DISTINCT brand_id) = 1
    ) model_consensus ON model_consensus.model_id = p.model_id
    LEFT JOIN brands consensus_brand ON consensus_brand.id = model_consensus.brand_id
    WHERE p.status IN (${statusSql})
  `, SOLD_STATUSES)

  return rows[0]
}

async function loadBrandBreakdown(connection) {
  const statusSql = placeholders(SOLD_STATUSES)
  const [rows] = await connection.execute(`
    SELECT
      target_brand.id AS brand_id,
      target_brand.name AS brand_name,
      COUNT(*) AS phone_count,
      COUNT(DISTINCT p.model_id) AS model_count,
      'model_relation' AS source
    FROM phones p
    JOIN models m ON m.id = p.model_id
    JOIN brands target_brand ON target_brand.id = m.brand_id
    WHERE p.status IN (${statusSql})
      AND (p.brand_id IS NULL OR p.brand_id = 0)
    GROUP BY target_brand.id, target_brand.name
    
    UNION ALL

    SELECT
      consensus_brand.id AS brand_id,
      consensus_brand.name AS brand_name,
      COUNT(*) AS phone_count,
      COUNT(DISTINCT p.model_id) AS model_count,
      'orphan_model_consensus' AS source
    FROM phones p
    JOIN (
      SELECT model_id, MIN(brand_id) AS brand_id
      FROM phones
      WHERE model_id IS NOT NULL
        AND brand_id IS NOT NULL
        AND brand_id <> 0
      GROUP BY model_id
      HAVING COUNT(DISTINCT brand_id) = 1
    ) model_consensus ON model_consensus.model_id = p.model_id
    JOIN brands consensus_brand ON consensus_brand.id = model_consensus.brand_id
    LEFT JOIN models m ON m.id = p.model_id
    WHERE p.status IN (${statusSql})
      AND m.id IS NULL
      AND (p.brand_id IS NULL OR p.brand_id = 0)
    GROUP BY consensus_brand.id, consensus_brand.name
    
    ORDER BY phone_count DESC, brand_id
  `, [...SOLD_STATUSES, ...SOLD_STATUSES])

  return rows
}

async function loadSamples(connection) {
  const statusSql = placeholders(SOLD_STATUSES)
  const [rows] = await connection.execute(`
    SELECT *
    FROM (
      SELECT
      p.id AS phone_id,
      p.model_id,
      m.name AS model_name,
      target_brand.id AS target_brand_id,
      target_brand.name AS target_brand_name,
      p.status,
      'model_relation' AS source
      FROM phones p
      JOIN models m ON m.id = p.model_id
      JOIN brands target_brand ON target_brand.id = m.brand_id
      WHERE p.status IN (${statusSql})
        AND (p.brand_id IS NULL OR p.brand_id = 0)

      UNION ALL

      SELECT
        p.id AS phone_id,
        p.model_id,
        NULL AS model_name,
        consensus_brand.id AS target_brand_id,
        consensus_brand.name AS target_brand_name,
        p.status,
        'orphan_model_consensus' AS source
      FROM phones p
      JOIN (
        SELECT model_id, MIN(brand_id) AS brand_id
        FROM phones
        WHERE model_id IS NOT NULL
          AND brand_id IS NOT NULL
          AND brand_id <> 0
        GROUP BY model_id
        HAVING COUNT(DISTINCT brand_id) = 1
      ) model_consensus ON model_consensus.model_id = p.model_id
      JOIN brands consensus_brand ON consensus_brand.id = model_consensus.brand_id
      LEFT JOIN models m ON m.id = p.model_id
      WHERE p.status IN (${statusSql})
        AND m.id IS NULL
        AND (p.brand_id IS NULL OR p.brand_id = 0)
    ) candidates
    ORDER BY phone_id
    LIMIT 20
  `, [...SOLD_STATUSES, ...SOLD_STATUSES])

  return rows
}

async function applyModelRelationUpdates(connection) {
  const statusSql = placeholders(SOLD_STATUSES)
  const [result] = await connection.execute(`
    UPDATE phones p
    JOIN models m ON m.id = p.model_id
    JOIN brands target_brand ON target_brand.id = m.brand_id
    SET p.brand_id = target_brand.id
    WHERE p.status IN (${statusSql})
      AND (p.brand_id IS NULL OR p.brand_id = 0)
  `, SOLD_STATUSES)

  return result.affectedRows
}

async function loadOrphanConsensus(connection) {
  const [rows] = await connection.execute(`
    SELECT
      model_consensus.model_id,
      model_consensus.brand_id,
      consensus_brand.name AS brand_name
    FROM (
      SELECT model_id, MIN(brand_id) AS brand_id
      FROM phones
      WHERE model_id IS NOT NULL
        AND brand_id IS NOT NULL
        AND brand_id <> 0
      GROUP BY model_id
      HAVING COUNT(DISTINCT brand_id) = 1
    ) model_consensus
    JOIN brands consensus_brand ON consensus_brand.id = model_consensus.brand_id
    LEFT JOIN models m ON m.id = model_consensus.model_id
    WHERE m.id IS NULL
    ORDER BY model_consensus.model_id
  `)

  return rows
}

async function applyOrphanConsensusUpdates(connection, orphanConsensus) {
  let updated = 0

  for (const consensus of orphanConsensus) {
    const [result] = await connection.execute(`
      UPDATE phones
      SET brand_id = ?
      WHERE status IN (${placeholders(SOLD_STATUSES)})
        AND model_id = ?
        AND (brand_id IS NULL OR brand_id = 0)
    `, [consensus.brand_id, ...SOLD_STATUSES, consensus.model_id])
    updated += result.affectedRows
  }

  return updated
}

async function verify(connection) {
  const summary = await loadSummary(connection)
  const remainingCandidates = await loadCandidateCount(connection)

  return {
    summary,
    safe_candidates_remaining: remainingCandidates
  }
}

async function loadCandidateCount(connection) {
  const statusSql = placeholders(SOLD_STATUSES)
  const [rows] = await connection.execute(`
    SELECT COUNT(*) AS count
    FROM phones p
    LEFT JOIN models m ON m.id = p.model_id
    LEFT JOIN brands target_brand ON target_brand.id = m.brand_id
    LEFT JOIN (
      SELECT model_id, MIN(brand_id) AS brand_id
      FROM phones
      WHERE model_id IS NOT NULL
        AND brand_id IS NOT NULL
        AND brand_id <> 0
      GROUP BY model_id
      HAVING COUNT(DISTINCT brand_id) = 1
    ) model_consensus ON model_consensus.model_id = p.model_id
    LEFT JOIN brands consensus_brand ON consensus_brand.id = model_consensus.brand_id
    WHERE p.status IN (${statusSql})
      AND (p.brand_id IS NULL OR p.brand_id = 0)
      AND (
        target_brand.id IS NOT NULL
        OR (m.id IS NULL AND consensus_brand.id IS NOT NULL)
      )
  `, SOLD_STATUSES)

  return Number(rows[0].count) || 0
}

async function main() {
  const connection = await createConnection()

  try {
    const before = await loadSummary(connection)
    const brandBreakdown = await loadBrandBreakdown(connection)
    const samples = await loadSamples(connection)
    const orphanConsensus = await loadOrphanConsensus(connection)

    if (!applyChanges) {
      console.log(JSON.stringify({
        status: 'dry_run',
        database: process.env.DB_NAME,
        scope: '已销售、调货、划拨的 phones 记录',
        safe_rule: '仅补齐已有有效型号关系，或同一孤立 model_id 下存在唯一且无冲突历史品牌共识的记录',
        before,
        brand_breakdown: brandBreakdown,
        sample: samples
      }, null, 2))
      return
    }

    await connection.beginTransaction()
    let modelRelationUpdated = 0
    let orphanConsensusUpdated = 0

    try {
      modelRelationUpdated = await applyModelRelationUpdates(connection)
      orphanConsensusUpdated = await applyOrphanConsensusUpdates(connection, orphanConsensus)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const after = await verify(connection)

    if (after.safe_candidates_remaining !== 0) {
      throw new Error(`批量补全后仍有 ${after.safe_candidates_remaining} 条可安全补全的记录`)
    }

    console.log(JSON.stringify({
      status: 'completed',
      database: process.env.DB_NAME,
      scope: '已销售、调货、划拨的 phones 记录',
      updated: modelRelationUpdated + orphanConsensusUpdated,
      updated_by_source: {
        model_relation: modelRelationUpdated,
        orphan_model_consensus: orphanConsensusUpdated
      },
      before,
      after: after.summary,
      unresolved: {
        missing_both: Number(after.summary.missing_both) || 0,
        brand_still_missing: Number(after.summary.missing_brand) || 0
      },
      note: '未根据 IMEI、备注或模糊型号名称猜测品牌和型号；孤立 model_id 只使用同一型号 ID 下唯一且无冲突的历史品牌共识'
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'PHONE_RELATION_BACKFILL_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
