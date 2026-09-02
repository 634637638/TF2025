const fs = require('fs').promises
const path = require('path')
const {
  getUploadsRoot,
  getUploadSubdir,
  getUploadUrl,
  getRelativeUploadPathFromUrl
} = require('./upload-paths')

const SHOP_ASSET_MODULES = new Set(['h5_banners', 'h5_config'])

function sanitizeShopMediaPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')
}

function buildShopTemplateDirectoryName({ brandName, modelName, colorName } = {}) {
  const parts = [brandName, modelName, colorName].map(sanitizeShopMediaPart)
  if (parts.some(part => !part)) {
    throw new Error('商品模板缺少品牌、型号或颜色，无法创建媒体目录')
  }
  return parts.join('-')
}

async function moveUploadedShopFile(file, targetSegments) {
  if (!file?.path || !file?.filename) {
    throw new Error('缺少待归档的商城媒体文件')
  }

  const uploadsRoot = path.resolve(getUploadsRoot())
  const sourcePath = path.resolve(file.path)
  const targetDirectory = getUploadSubdir('shop', ...targetSegments)
  const targetPath = path.resolve(targetDirectory, path.basename(file.filename))
  if (
    !sourcePath.startsWith(`${uploadsRoot}${path.sep}`) ||
    !targetPath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    throw new Error('商城媒体路径超出上传目录')
  }

  if (sourcePath !== targetPath) {
    await fs.mkdir(targetDirectory, { recursive: true })
    const targetExists = await fs.access(targetPath).then(() => true).catch(() => false)
    if (targetExists) {
      throw new Error(`商城媒体目标文件已存在: ${targetPath}`)
    }
    await fs.rename(sourcePath, targetPath)
  }

  file.path = targetPath
  file.destination = targetDirectory
  return getUploadUrl('shop', ...targetSegments, path.basename(file.filename))
}

async function archiveShopAssetUpload({ file, moduleName } = {}) {
  if (!SHOP_ASSET_MODULES.has(moduleName)) {
    throw new Error('商城图片缺少有效的业务模块')
  }
  return moveUploadedShopFile(file, [moduleName])
}

async function getShopTemplateDirectoryName(database, templateId) {
  const [templates] = await database.query(
    `SELECT b.name AS brand_name, m.name AS model_name, c.name AS color_name
     FROM H5_newtemplates t
     LEFT JOIN brands b ON b.id = t.brand_id
     LEFT JOIN models m ON m.id = t.model_id
     LEFT JOIN colors c ON c.id = t.color_id
     WHERE t.id = ?`,
    [templateId]
  )
  if (templates.length === 0) {
    throw new Error('商品模板不存在')
  }

  return buildShopTemplateDirectoryName({
    brandName: templates[0].brand_name,
    modelName: templates[0].model_name,
    colorName: templates[0].color_name
  })
}

async function archiveShopTemplateUpload({ file, templateId, database } = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new Error('缺少数据库连接')
  }
  const directoryName = await getShopTemplateDirectoryName(database, templateId)
  return moveUploadedShopFile(file, ['h5_newimages', directoryName])
}

async function relocateShopTemplateMedia({ templateId, database } = {}) {
  if (!database || typeof database.query !== 'function') {
    throw new Error('缺少数据库连接')
  }

  const directoryName = await getShopTemplateDirectoryName(database, templateId)
  const targetDirectory = getUploadSubdir('shop', 'h5_newimages', directoryName)
  const uploadsRoot = path.resolve(getUploadsRoot())
  const [images] = await database.query(
    "SELECT id, image_url FROM h5_newimages WHERE template_id = ? AND image_url LIKE '%/uploads/shop/%'",
    [templateId]
  )
  const movedFiles = []

  const rollback = async () => {
    for (const moved of [...movedFiles].reverse()) {
      const targetExists = await fs.access(moved.targetPath).then(() => true).catch(() => false)
      const sourceExists = await fs.access(moved.sourcePath).then(() => true).catch(() => false)
      if (targetExists && !sourceExists) {
        await fs.mkdir(path.dirname(moved.sourcePath), { recursive: true })
        await fs.rename(moved.targetPath, moved.sourcePath)
      }
    }
  }

  try {
    for (const image of images) {
      const relativePath = getRelativeUploadPathFromUrl(image.image_url).replace(/\\/g, '/')
      if (!relativePath.startsWith('shop/')) continue

      const filename = path.basename(relativePath)
      const sourcePath = path.resolve(uploadsRoot, ...relativePath.split('/'))
      const targetPath = path.resolve(targetDirectory, filename)
      if (sourcePath === targetPath) continue

      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false)
      if (!sourceExists) {
        throw new Error(`商品模板媒体文件不存在: ${sourcePath}`)
      }
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false)
      if (targetExists) {
        throw new Error(`商品模板媒体目标文件已存在: ${targetPath}`)
      }

      await fs.mkdir(targetDirectory, { recursive: true })
      await fs.rename(sourcePath, targetPath)
      movedFiles.push({ sourcePath, targetPath })
      await database.query(
        'UPDATE h5_newimages SET image_url = ? WHERE id = ? AND template_id = ?',
        [getUploadUrl('shop', 'h5_newimages', directoryName, filename), image.id, templateId]
      )
    }
  } catch (error) {
    await rollback().catch(rollbackError => {
      error.message += `；商品模板媒体回滚失败: ${rollbackError.message}`
    })
    throw error
  }

  return {
    rollback,
    cleanup: async () => {
      const protectedDirectories = new Set([
        path.resolve(getUploadSubdir('shop')),
        path.resolve(getUploadSubdir('shop', 'h5_newimages')),
        path.resolve(targetDirectory)
      ])
      const oldDirectories = new Set(movedFiles.map(file => path.dirname(file.sourcePath)))
      for (const oldDirectory of oldDirectories) {
        if (protectedDirectories.has(path.resolve(oldDirectory))) continue
        const entries = await fs.readdir(oldDirectory).catch(() => [])
        if (entries.length === 0) await fs.rmdir(oldDirectory).catch(() => {})
      }
    }
  }
}

module.exports = {
  SHOP_ASSET_MODULES,
  sanitizeShopMediaPart,
  buildShopTemplateDirectoryName,
  archiveShopAssetUpload,
  archiveShopTemplateUpload,
  getShopTemplateDirectoryName,
  relocateShopTemplateMedia
}
