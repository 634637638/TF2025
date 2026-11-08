'use strict'

const path = require('node:path')
const fs = require('node:fs').promises
const { getUploadsRoot, getUploadSubdir, getUploadUrl, getRelativeUploadPathFromUrl } = require('../utils/upload-paths')
const { buildPhoneMediaDirectoryName } = require('../utils/phone-media-storage')
const log = require('../utils/log')

const syncPhoneMediaDirectory = async (phoneId, nextPhone, connection, repository) => {
  const folderName = buildPhoneMediaDirectoryName({
    serialNumber: nextPhone.serial_number,
    inventoryTime: nextPhone.inventory_time,
    isNew: nextPhone.is_new
  })
  const uploadsRoot = path.resolve(getUploadsRoot())
  const images = await repository.getManagedMedia(connection, phoneId)
  const movedFiles = []
  const updates = []

  try {
    for (const image of images) {
      const relativePath = getRelativeUploadPathFromUrl(image.image_url).replace(/\\/g, '/')
      const mediaRoot = relativePath.split('/')[0]
      if (!['phones', 'videos'].includes(mediaRoot)) continue

      const pathParts = relativePath.split('/')
      const filename = path.basename(pathParts[pathParts.length - 1])
      const sourcePath = path.resolve(uploadsRoot, ...pathParts)
      const targetDirectory = getUploadSubdir(mediaRoot, folderName)
      const targetPath = path.resolve(targetDirectory, filename)
      const targetUrl = getUploadUrl(mediaRoot, folderName, filename)

      if (!sourcePath.startsWith(`${uploadsRoot}${path.sep}`) || !targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
        throw new Error('手机图片路径超出上传目录')
      }
      if (sourcePath === targetPath) continue

      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false)
      if (!sourceExists) {
        log.warn('手机图片文件不存在，跳过目录同步:', image.image_url)
        continue
      }
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false)
      if (targetExists) {
        throw new Error(`手机图片目标文件已存在: ${targetPath}`)
      }

      await fs.mkdir(targetDirectory, { recursive: true })
      await fs.rename(sourcePath, targetPath)
      movedFiles.push({ sourcePath, targetPath, mediaRoot })
      updates.push({ id: image.id, targetUrl })
    }

    for (const update of updates) {
      await repository.updateMediaUrl(connection, {
        url: update.targetUrl,
        imageId: update.id,
        phoneId
      })
    }

    const oldDirectories = new Set(movedFiles.map(file => path.dirname(file.sourcePath)))
    return {
      rollback: async () => {
        for (const moved of [...movedFiles].reverse()) {
          await fs.mkdir(path.dirname(moved.sourcePath), { recursive: true })
          await fs.rename(moved.targetPath, moved.sourcePath)
        }
      },
      finalize: async () => {
        for (const oldDirectory of oldDirectories) {
          const isMediaRoot = movedFiles.some(file => oldDirectory === getUploadSubdir(file.mediaRoot))
          if (isMediaRoot) continue
          const entries = await fs.readdir(oldDirectory).catch(() => [])
          if (entries.length === 0) await fs.rmdir(oldDirectory).catch(() => {})
        }
      }
    }
  } catch (error) {
    for (const moved of movedFiles.reverse()) {
      try {
        await fs.rename(moved.targetPath, moved.sourcePath)
      } catch (rollbackError) {
        error.message += `；手机图片回滚失败: ${rollbackError.message}`
      }
    }
    throw error
  }
}

module.exports = syncPhoneMediaDirectory
