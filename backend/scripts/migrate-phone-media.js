#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')
const { getUploadSubdir, getRelativeUploadPathFromUrl, getUploadUrl } = require('../src/utils/upload-paths')
const { buildPhoneMediaDirectoryName } = require('../src/utils/phone-media-storage')

const args = new Set(process.argv.slice(2))
const applyChanges = args.has('--apply')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const recordLimit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : 0

function normalizePhoneMediaPath(fileUrl) {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl).replace(/\\/g, '/')
  const mediaRoot = relativePath.split('/')[0]
  if (!['phones', 'videos'].includes(mediaRoot)) return ''

  const normalized = path.posix.normalize(relativePath)
  if (
    normalized !== relativePath ||
    normalized === mediaRoot ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return ''
  }

  return normalized
}

function buildPlan(rows) {
  const mediaRoots = ['phones', 'videos'].map(mediaRoot => getUploadSubdir(mediaRoot))
  const operations = []
  const issues = []
  const referencedRootFiles = new Set()
  const plannedSources = new Set()
  const plannedTargets = new Set()

  for (const row of rows) {
    const relativePath = normalizePhoneMediaPath(row.image_url)
    if (!relativePath) {
      issues.push({ id: row.id, phoneId: row.phone_id, url: row.image_url, reason: '不是有效的手机图片路径' })
      continue
    }

    const pathParts = relativePath.split('/')
    const mediaRoot = pathParts[0]
    const mediaDirectory = getUploadSubdir(mediaRoot)
    const filename = pathParts[pathParts.length - 1]
    const sourcePath = path.resolve(mediaDirectory, ...pathParts.slice(1))
    if (pathParts.length === 2) referencedRootFiles.add(sourcePath)

    if (!fs.existsSync(sourcePath)) {
      issues.push({ id: row.id, phoneId: row.phone_id, source: sourcePath, reason: '数据库引用的源文件不存在' })
      continue
    }

    if (row.is_new === null || row.is_new === undefined) {
      issues.push({ id: row.id, phoneId: row.phone_id, source: sourcePath, reason: '图片关联的手机记录不存在' })
      continue
    }

    if (Number(row.is_new) !== 0) {
      continue
    }

    if (!String(row.serial_number || '').trim() || !String(row.inventory_time || '').trim()) {
      issues.push({ id: row.id, phoneId: row.phone_id, source: sourcePath, reason: '二手机缺少序列号或入库时间' })
      continue
    }

    const directoryName = buildPhoneMediaDirectoryName({
      serialNumber: row.serial_number,
      inventoryTime: row.inventory_time
    })
    const targetPath = path.resolve(mediaDirectory, directoryName, filename)
    const targetUrl = getUploadUrl(mediaRoot, directoryName, filename)

    if (sourcePath === targetPath) {
      continue
    }

    if (plannedSources.has(sourcePath)) {
      issues.push({ id: row.id, phoneId: row.phone_id, source: sourcePath, reason: '同一源文件被多条数据库记录引用' })
      continue
    }
    if (plannedTargets.has(targetPath) || fs.existsSync(targetPath)) {
      issues.push({ id: row.id, phoneId: row.phone_id, source: sourcePath, target: targetPath, reason: '目标文件已存在' })
      continue
    }

    plannedSources.add(sourcePath)
    plannedTargets.add(targetPath)
    operations.push({
      id: row.id,
      phoneId: row.phone_id,
      sourcePath,
      targetPath,
      targetUrl,
      mediaRoot
    })
  }

  for (const mediaDirectory of mediaRoots) {
    if (!fs.existsSync(mediaDirectory)) continue
    for (const entry of fs.readdirSync(mediaDirectory, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const filePath = path.resolve(mediaDirectory, entry.name)
      if (!referencedRootFiles.has(filePath)) {
        issues.push({ source: filePath, reason: '根目录存在未被数据库引用的文件，未自动移动' })
      }
    }
  }

  return {
    operations,
    issues,
    stats: {
      records: operations.length,
      files: operations.length,
      directories: new Set(operations.map(operation => path.dirname(operation.targetPath))).size,
      issueCount: issues.length
    }
  }
}

function summarize(plan) {
  return {
    mode: applyChanges ? 'apply' : 'dry-run',
    ...plan.stats,
    issueSummary: plan.issues.reduce((summary, issue) => {
      summary[issue.reason] = (summary[issue.reason] || 0) + 1
      return summary
    }, {}),
    sample: plan.operations.slice(0, 20).map(operation => ({
      id: operation.id,
      phoneId: operation.phoneId,
      source: path.relative(process.cwd(), operation.sourcePath),
      target: path.relative(process.cwd(), operation.targetPath)
    })),
    issues: plan.issues.slice(0, 100).map(issue => ({
      ...issue,
      source: issue.source ? path.relative(process.cwd(), issue.source) : undefined,
      target: issue.target ? path.relative(process.cwd(), issue.target) : undefined
    }))
  }
}

async function executePlan(plan, pool) {
  const connection = await pool.getConnection()
  const completedOperations = []

  try {
    for (const operation of plan.operations) {
      fs.mkdirSync(path.dirname(operation.targetPath), { recursive: true })
      fs.renameSync(operation.sourcePath, operation.targetPath)
      completedOperations.push(operation)
    }

    await connection.beginTransaction()
    for (const operation of plan.operations) {
      await connection.execute(
        'UPDATE H5_images SET image_url = ? WHERE id = ?',
        [operation.targetUrl, operation.id]
      )
    }
    await connection.commit()

    const mediaRoots = new Set(['phones', 'videos'].map(mediaRoot => path.resolve(getUploadSubdir(mediaRoot))))
    const sourceDirectories = new Set(
      completedOperations.map(operation => path.dirname(operation.sourcePath))
    )
    for (const sourceDirectory of sourceDirectories) {
      if (mediaRoots.has(sourceDirectory)) continue
      const entries = fs.readdirSync(sourceDirectory, { withFileTypes: true })
      if (entries.length === 0) fs.rmdirSync(sourceDirectory)
    }
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // Preserve the original migration error.
    }

    for (const operation of completedOperations.reverse()) {
      try {
        if (fs.existsSync(operation.targetPath) && !fs.existsSync(operation.sourcePath)) {
          fs.renameSync(operation.targetPath, operation.sourcePath)
        }
      } catch (rollbackError) {
        error.message += `；文件回滚失败: ${rollbackError.message}`
      }
    }
    throw error
  } finally {
    connection.release()
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
        i.id,
        i.phone_id,
        i.image_url,
        i.image_type,
        p.serial_number,
        p.inventory_time,
        p.is_new
      FROM H5_images i
      LEFT JOIN phones p ON p.id = i.phone_id
      WHERE i.image_url LIKE '%/uploads/phones/%'
         OR i.image_url LIKE '%/uploads/videos/%'
      ORDER BY i.id${limitSql}
    `)
    const plan = buildPlan(rows)

    if (applyChanges && plan.operations.length > 0) {
      await executePlan(plan, pool)
    }

    console.log(JSON.stringify(summarize(plan), null, 2))
  } finally {
    await closeDatabase()
  }
}

main().catch(error => {
  console.error(`手机图片迁移失败: ${error.message}`)
  process.exitCode = 1
})
