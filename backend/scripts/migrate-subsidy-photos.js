#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')
const { getUploadSubdir, getRelativeUploadPathFromUrl } = require('../src/utils/upload-paths')
const {
  getSubsidyPhotoNaming,
  encodeSubsidyPhotoUrl
} = require('../src/utils/subsidy-photo-storage')

const args = new Set(process.argv.slice(2))
const applyChanges = args.has('--apply')
const outputJson = args.has('--json')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const recordLimit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0

function parsePhotoList(value) {
  if (Array.isArray(value)) {
    return value.filter(photo => typeof photo === 'string' && photo.trim())
  }

  if (typeof value !== 'string' || !value.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter(photo => typeof photo === 'string' && photo.trim())
      : []
  } catch {
    return []
  }
}

function normalizeSubsidyRelativePath(photoUrl) {
  const relativePath = getRelativeUploadPathFromUrl(photoUrl)
    .replace(/\\/g, '/')
  if (!relativePath.startsWith('subsidy/')) {
    return ''
  }

  const normalized = path.posix.normalize(relativePath)
  if (
    normalized !== relativePath ||
    normalized === 'subsidy' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return ''
  }

  return normalized
}

function isProtectedSubsidyUrl(photoUrl) {
  try {
    const pathname = new URL(photoUrl, 'http://localhost').pathname
    return pathname.startsWith('/api/subsidy/files/')
  } catch {
    return false
  }
}

function buildPlan(rows) {
  const subsidyRoot = getUploadSubdir('subsidy')
  const sourceGroups = new Map()
  const records = []
  const issues = []

  for (const row of rows) {
    const originalPhotos = parsePhotoList(row.subsidy_photos)
    const migratedPhotos = [...originalPhotos]
    const recordPlan = {
      id: row.id,
      originalPhotos,
      migratedPhotos,
      changes: []
    }
    const naming = getSubsidyPhotoNaming({
      customerName: row.customer_name,
      handlerName: row.handler_name,
      hasDifferentHandler: row.has_different_handler,
      serialNumber: row.serial_number,
      isNew: row.is_new,
      inventoryTime: row.inventory_time
    })

    originalPhotos.forEach((photoUrl, photoIndex) => {
      const relativePath = normalizeSubsidyRelativePath(photoUrl)
      if (!relativePath) {
        issues.push({ id: row.id, photoUrl, reason: '不是有效的国补上传路径' })
        return
      }

      const pathParts = relativePath.split('/')
      if (pathParts.length > 2) {
        return
      }

      const filename = pathParts[1]
      const sourcePath = path.resolve(subsidyRoot, filename)
      const targetRelativePath = path.posix.join('subsidy', naming.directoryName, filename)
      const targetPath = path.resolve(subsidyRoot, naming.directoryName, filename)
      const sourceRelative = path.relative(subsidyRoot, sourcePath)

      if (!sourceRelative || sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative)) {
        issues.push({ id: row.id, photoUrl, reason: '源文件路径不在国补目录内' })
        return
      }

      const targetUrl = encodeSubsidyPhotoUrl(
        targetRelativePath,
        isProtectedSubsidyUrl(photoUrl)
      )
      migratedPhotos[photoIndex] = targetUrl
      recordPlan.changes.push({
        photoIndex,
        photoUrl,
        filename,
        sourcePath,
        targetPath,
        targetRelativePath,
        targetUrl
      })

      if (!sourceGroups.has(sourcePath)) {
        sourceGroups.set(sourcePath, {
          sourcePath,
          operations: new Map()
        })
      }
      sourceGroups.get(sourcePath).operations.set(targetPath, {
        id: row.id,
        targetPath,
        targetRelativePath,
        filename
      })
    })

    if (recordPlan.changes.length > 0) {
      records.push(recordPlan)
    }
  }

  const operations = []
  for (const group of sourceGroups.values()) {
    const targets = [...group.operations.values()]
    if (!fs.existsSync(group.sourcePath)) {
      for (const target of targets) {
        issues.push({
          id: target.id,
          source: group.sourcePath,
          reason: '源文件不存在'
        })
      }
      continue
    }

    for (const target of targets) {
      if (fs.existsSync(target.targetPath)) {
        issues.push({
          id: target.id,
          source: group.sourcePath,
          target: target.targetPath,
          reason: '目标文件已存在'
        })
      }
    }

    if (targets.every(target => !fs.existsSync(target.targetPath))) {
      operations.push({
        sourcePath: group.sourcePath,
        targets,
        mode: targets.length === 1 ? 'rename' : 'copy'
      })
    }
  }

  const referencedRootFiles = new Set(sourceGroups.keys())
  if (fs.existsSync(subsidyRoot)) {
    for (const entry of fs.readdirSync(subsidyRoot, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const filePath = path.resolve(subsidyRoot, entry.name)
      if (!referencedRootFiles.has(filePath)) {
        issues.push({
          source: filePath,
          reason: '根目录存在未被数据库引用的文件，未自动移动'
        })
      }
    }
  }

  const blockedSources = new Set(
    issues
      .filter(issue => issue.source)
      .map(issue => issue.source)
  )
  const executableRecords = records
    .map(record => {
      const executableChanges = record.changes.filter(change => !blockedSources.has(change.sourcePath))
      const executableIndexes = new Set(executableChanges.map(change => change.photoIndex))
      return {
        ...record,
        migratedPhotos: record.migratedPhotos.map((photo, photoIndex) => (
          executableIndexes.has(photoIndex) ? photo : record.originalPhotos[photoIndex]
        )),
        changes: executableChanges
      }
    })
    .filter(record => record.changes.length > 0)

  return {
    records: executableRecords,
    operations,
    issues,
    stats: {
      records: executableRecords.length,
      photos: executableRecords.reduce((count, record) => count + record.changes.length, 0),
      sources: operations.length,
      issues: issues.length
    }
  }
}

function summarize(plan) {
  const sample = plan.records.slice(0, 20).flatMap(record => (
    record.changes.map(change => ({
      id: record.id,
      source: path.relative(process.cwd(), change.sourcePath),
      target: path.relative(process.cwd(), change.targetPath)
    }))
  ))

  return {
    mode: applyChanges ? 'apply' : 'dry-run',
    ...plan.stats,
    issueCount: plan.issues.length,
    sample,
    issues: plan.issues.slice(0, 50)
  }
}

async function executePlan(plan, connection) {
  const completedOperations = []

  try {
    for (const operation of plan.operations) {
      fs.mkdirSync(path.dirname(operation.targets[0].targetPath), { recursive: true })

      if (operation.mode === 'rename') {
        fs.renameSync(operation.sourcePath, operation.targets[0].targetPath)
      } else {
        for (const target of operation.targets) {
          fs.mkdirSync(path.dirname(target.targetPath), { recursive: true })
          fs.copyFileSync(operation.sourcePath, target.targetPath)
        }
        fs.unlinkSync(operation.sourcePath)
      }
      completedOperations.push(operation)
    }

    await connection.beginTransaction()
    for (const record of plan.records) {
      await connection.execute(
        'UPDATE national_subsidies SET subsidy_photos = ? WHERE id = ?',
        [JSON.stringify(record.migratedPhotos), record.id]
      )
    }
    await connection.commit()
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // The original error is more useful to the operator.
    }

    for (const operation of completedOperations.reverse()) {
      try {
        if (operation.mode === 'rename') {
          fs.renameSync(operation.targets[0].targetPath, operation.sourcePath)
        } else {
          const rollbackSource = operation.targets.find(target => fs.existsSync(target.targetPath))
          if (rollbackSource && !fs.existsSync(operation.sourcePath)) {
            fs.copyFileSync(rollbackSource.targetPath, operation.sourcePath)
          }
          for (const target of operation.targets) {
            if (fs.existsSync(target.targetPath)) fs.unlinkSync(target.targetPath)
          }
        }
      } catch (rollbackError) {
        error.message += `；文件回滚失败: ${rollbackError.message}`
      }
    }
    throw error
  }
}

async function main() {
  if (recordLimit && (!Number.isInteger(recordLimit) || recordLimit < 1)) {
    throw new Error('--limit 必须是正整数')
  }

  if (!await connectToDatabase(1, 1000)) {
    throw new Error('数据库连接失败')
  }

  try {
    const pool = getDatabase()
    const limitSql = recordLimit ? ` LIMIT ${recordLimit}` : ''
    const [rows] = await pool.query(`
      SELECT
        ns.id,
        ns.customer_name,
        ns.has_different_handler,
        ns.handler_name,
        ns.serial_number,
        ns.sale_time,
        ns.subsidy_photos,
        p.is_new,
        p.inventory_time
      FROM national_subsidies ns
      LEFT JOIN phones p ON p.id = ns.phone_id
      WHERE ns.subsidy_photos IS NOT NULL
        AND ns.subsidy_photos <> ''
        AND ns.subsidy_photos <> '[]'
      ORDER BY ns.id${limitSql}
    `)
    const plan = buildPlan(rows)

    if (!applyChanges) {
      console.log(outputJson ? JSON.stringify(summarize(plan), null, 2) : JSON.stringify(summarize(plan), null, 2))
      return
    }

    if (plan.operations.length === 0) {
      console.log(JSON.stringify(summarize(plan), null, 2))
      return
    }

    const connection = await pool.getConnection()
    try {
      await executePlan(plan, connection)
    } finally {
      connection.release()
    }
    console.log(JSON.stringify(summarize(plan), null, 2))
  } finally {
    await closeDatabase()
  }
}

main().catch(error => {
  console.error(`国补照片迁移失败: ${error.message}`)
  process.exitCode = 1
})
