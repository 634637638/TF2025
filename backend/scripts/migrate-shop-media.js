#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')
const { getUploadSubdir, getRelativeUploadPathFromUrl, getUploadUrl } = require('../src/utils/upload-paths')
const { buildShopTemplateDirectoryName } = require('../src/utils/shop-media-storage')

const applyChanges = process.argv.includes('--apply')

function normalizeShopPath(fileUrl) {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl).replace(/\\/g, '/')
  if (!relativePath.startsWith('shop/')) return ''
  const normalized = path.posix.normalize(relativePath)
  if (normalized !== relativePath || normalized.includes('/../')) return ''
  return normalized
}

function parseUrlList(value) {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item.trim())
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string' && item.trim()) : []
  } catch {
    return []
  }
}

function createPlanner() {
  const shopRoot = getUploadSubdir('shop')
  const operations = new Map()
  const issues = []

  const planUrl = (fileUrl, targetSegments, reference) => {
    const relativePath = normalizeShopPath(fileUrl)
    if (!relativePath) {
      issues.push({ ...reference, fileUrl, reason: '不是有效的商城上传路径' })
      return fileUrl
    }

    const filename = path.basename(relativePath)
    const sourcePath = path.resolve(getUploadSubdir(), ...relativePath.split('/'))
    const targetPath = path.resolve(shopRoot, ...targetSegments, filename)
    const targetUrl = getUploadUrl('shop', ...targetSegments, filename)
    if (sourcePath === targetPath) return targetUrl
    if (!fs.existsSync(sourcePath)) {
      issues.push({ ...reference, sourcePath, reason: '数据库引用的源文件不存在' })
      return fileUrl
    }
    if (fs.existsSync(targetPath)) {
      issues.push({ ...reference, sourcePath, targetPath, reason: '目标文件已存在' })
      return fileUrl
    }

    const existing = operations.get(sourcePath)
    if (existing && existing.targetPath !== targetPath) {
      issues.push({ ...reference, sourcePath, targetPath, reason: '同一源文件被不同模块引用' })
      return fileUrl
    }
    operations.set(sourcePath, { sourcePath, targetPath })
    return targetUrl
  }

  return { shopRoot, operations, issues, planUrl }
}

function buildPlan({ templateRows, bannerRows, configRows }) {
  const planner = createPlanner()
  const templateUpdates = []
  const bannerUpdates = []
  const configUpdates = []

  for (const row of templateRows) {
    const directoryName = buildShopTemplateDirectoryName({
      brandName: row.brand_name,
      modelName: row.model_name,
      colorName: row.color_name
    })
    const targetUrl = planner.planUrl(
      row.image_url,
      ['h5_newimages', directoryName],
      { module: 'h5_newimages', id: row.id }
    )
    if (targetUrl !== row.image_url) templateUpdates.push({ id: row.id, targetUrl })
  }

  for (const row of bannerRows) {
    const originalImages = parseUrlList(row.images)
    const imageUrl = row.image_url
      ? planner.planUrl(row.image_url, ['h5_banners'], { module: 'h5_banners', id: row.id })
      : row.image_url
    const images = originalImages.map(fileUrl => planner.planUrl(
      fileUrl,
      ['h5_banners'],
      { module: 'h5_banners', id: row.id }
    ))
    if (imageUrl !== row.image_url || JSON.stringify(images) !== JSON.stringify(originalImages)) {
      bannerUpdates.push({ id: row.id, imageUrl, images })
    }
  }

  for (const row of configRows) {
    const targetUrl = planner.planUrl(
      row.config_value,
      ['h5_config'],
      { module: 'h5_config', key: row.config_key }
    )
    if (targetUrl !== row.config_value) configUpdates.push({ key: row.config_key, targetUrl })
  }

  const referencedRootFiles = new Set(
    [...planner.operations.values()]
      .map(operation => operation.sourcePath)
      .filter(sourcePath => path.dirname(sourcePath) === planner.shopRoot)
  )
  for (const entry of fs.readdirSync(planner.shopRoot, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === '.DS_Store') continue
    const filePath = path.resolve(planner.shopRoot, entry.name)
    if (!referencedRootFiles.has(filePath)) {
      planner.issues.push({ sourcePath: filePath, reason: '根目录存在未被数据库引用的文件，未自动移动' })
    }
  }

  return {
    operations: [...planner.operations.values()],
    templateUpdates,
    bannerUpdates,
    configUpdates,
    issues: planner.issues
  }
}

function summarize(plan) {
  return {
    mode: applyChanges ? 'apply' : 'dry-run',
    files: plan.operations.length,
    templateRecords: plan.templateUpdates.length,
    bannerRecords: plan.bannerUpdates.length,
    configRecords: plan.configUpdates.length,
    directories: new Set(plan.operations.map(operation => path.dirname(operation.targetPath))).size,
    issueCount: plan.issues.length,
    sample: plan.operations.slice(0, 20).map(operation => ({
      source: path.relative(process.cwd(), operation.sourcePath),
      target: path.relative(process.cwd(), operation.targetPath)
    })),
    issues: plan.issues.map(issue => ({
      ...issue,
      sourcePath: issue.sourcePath ? path.relative(process.cwd(), issue.sourcePath) : undefined,
      targetPath: issue.targetPath ? path.relative(process.cwd(), issue.targetPath) : undefined
    }))
  }
}

async function executePlan(plan, pool) {
  const connection = await pool.getConnection()
  const completed = []
  try {
    for (const operation of plan.operations) {
      fs.mkdirSync(path.dirname(operation.targetPath), { recursive: true })
      fs.renameSync(operation.sourcePath, operation.targetPath)
      completed.push(operation)
    }

    await connection.beginTransaction()
    for (const update of plan.templateUpdates) {
      await connection.query('UPDATE h5_newimages SET image_url = ? WHERE id = ?', [update.targetUrl, update.id])
    }
    for (const update of plan.bannerUpdates) {
      await connection.query(
        'UPDATE h5_banners SET image_url = ?, images = ? WHERE id = ?',
        [update.imageUrl || null, JSON.stringify(update.images), update.id]
      )
    }
    for (const update of plan.configUpdates) {
      await connection.query(
        'UPDATE h5_config SET config_value = ? WHERE config_key = ?',
        [update.targetUrl, update.key]
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback().catch(() => {})
    for (const operation of completed.reverse()) {
      try {
        if (fs.existsSync(operation.targetPath) && !fs.existsSync(operation.sourcePath)) {
          fs.renameSync(operation.targetPath, operation.sourcePath)
        }
      } catch (rollbackError) {
        error.message += `；商城媒体回滚失败: ${rollbackError.message}`
      }
    }
    throw error
  } finally {
    connection.release()
  }
}

async function main() {
  if (!await connectToDatabase(1, 1000)) throw new Error('数据库连接失败')
  try {
    const pool = getDatabase()
    const [templateRows] = await pool.query(`
      SELECT i.id, i.image_url, b.name brand_name, m.name model_name, c.name color_name
      FROM h5_newimages i
      INNER JOIN H5_newtemplates t ON t.id = i.template_id
      LEFT JOIN brands b ON b.id = t.brand_id
      LEFT JOIN models m ON m.id = t.model_id
      LEFT JOIN colors c ON c.id = t.color_id
      WHERE i.image_url LIKE '%/uploads/shop/%'
    `)
    const [bannerRows] = await pool.query(`
      SELECT id, image_url, images
      FROM h5_banners
      WHERE image_url LIKE '%/uploads/shop/%' OR CAST(images AS CHAR) LIKE '%/uploads/shop/%'
    `)
    const [configRows] = await pool.query(`
      SELECT config_key, config_value
      FROM h5_config
      WHERE config_value LIKE '%/uploads/shop/%'
    `)
    const plan = buildPlan({ templateRows, bannerRows, configRows })
    if (applyChanges && plan.operations.length > 0) await executePlan(plan, pool)
    console.log(JSON.stringify(summarize(plan), null, 2))
  } finally {
    await closeDatabase()
  }
}

main().catch(error => {
  console.error(`商城媒体迁移失败: ${error.message}`)
  process.exitCode = 1
})
