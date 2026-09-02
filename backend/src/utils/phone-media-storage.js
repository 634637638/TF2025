const fs = require('fs').promises
const path = require('path')
const { getUploadsRoot, getUploadSubdir, getUploadUrl } = require('./upload-paths')

function sanitizePhoneMediaPart(value, fallback = '') {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')

  return sanitized || fallback
}

function buildPhoneMediaDirectoryName({ serialNumber, inventoryTime } = {}) {
  const safeSerialNumber = sanitizePhoneMediaPart(serialNumber)
  const dateMatch = String(inventoryTime || '').match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/)

  if (!safeSerialNumber) {
    throw new Error('二手机缺少序列号，无法创建图片目录')
  }
  if (!dateMatch) {
    throw new Error('二手机缺少有效入库日期，无法创建图片目录')
  }

  const safeInventoryDate = `${dateMatch[1]}${dateMatch[2].padStart(2, '0')}${dateMatch[3].padStart(2, '0')}`
  return `${safeSerialNumber}-${safeInventoryDate}`
}

async function archivePhoneMediaUpload({ phoneId, file, mediaRoot = 'phones', database } = {}) {
  if (!file?.path || !file?.filename) {
    throw new Error('缺少待归档的手机媒体文件')
  }
  if (!database || typeof database.query !== 'function') {
    throw new Error('缺少数据库连接')
  }
  if (!['phones', 'videos'].includes(mediaRoot)) {
    throw new Error('不支持的手机媒体目录')
  }

  const [phones] = await database.query(
    'SELECT serial_number, inventory_time, is_new FROM phones WHERE id = ?',
    [phoneId]
  )
  if (phones.length === 0) {
    throw new Error('手机记录不存在')
  }

  const folderName = Number(phones[0].is_new) === 0
    ? buildPhoneMediaDirectoryName({
      serialNumber: phones[0].serial_number,
      inventoryTime: phones[0].inventory_time
    })
    : ''
  const targetDirectory = folderName
    ? getUploadSubdir(mediaRoot, folderName)
    : getUploadSubdir(mediaRoot)
  const filename = path.basename(file.filename)
  const sourcePath = path.resolve(file.path)
  const targetPath = path.resolve(targetDirectory, filename)
  const uploadsRoot = path.resolve(getUploadsRoot())

  if (
    !sourcePath.startsWith(`${uploadsRoot}${path.sep}`) ||
    !targetPath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    throw new Error('手机媒体路径超出上传目录')
  }

  if (sourcePath !== targetPath) {
    await fs.mkdir(targetDirectory, { recursive: true })
    const targetExists = await fs.access(targetPath).then(() => true).catch(() => false)
    if (targetExists) {
      throw new Error(`手机媒体目标文件已存在: ${targetPath}`)
    }
    await fs.rename(sourcePath, targetPath)
  }

  file.path = targetPath
  file.destination = targetDirectory
  return folderName
    ? getUploadUrl(mediaRoot, folderName, filename)
    : getUploadUrl(mediaRoot, filename)
}

module.exports = {
  sanitizePhoneMediaPart,
  buildPhoneMediaDirectoryName,
  archivePhoneMediaUpload
}
