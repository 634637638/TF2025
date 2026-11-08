'use strict'

const fs = require('node:fs')
const path = require('node:path')
const log = require('../utils/log')
const { clearCache } = require('../middleware/cache')
const { getUploadsRoot, getUploadSubdir } = require('../utils/upload-paths')
const { getSubsidyPhotoNaming, encodeSubsidyPhotoUrl } = require('../utils/subsidy-photo-storage')
const { normalizeSubsidyPhotoPath } = require('../utils/subsidy-protected-photo-url')
const SubsidyUpdateRepository = require('../repositories/subsidy-update.repository')

const SUBSIDY_UPLOAD_PREFIX = 'subsidy/'

class SubsidyUpdateService {
  constructor({
    repository = new SubsidyUpdateRepository(),
    fileSystem = fs,
    pathModule = path,
    uploadsRoot = getUploadsRoot,
    uploadSubdir = getUploadSubdir,
    getPhotoNaming = getSubsidyPhotoNaming,
    encodePhotoUrl = encodeSubsidyPhotoUrl,
    invalidateCache = clearCache,
    logger = log
  } = {}) {
    this.repository = repository
    this.fileSystem = fileSystem
    this.path = pathModule
    this.uploadsRoot = uploadsRoot
    this.uploadSubdir = uploadSubdir
    this.getPhotoNaming = getPhotoNaming
    this.encodePhotoUrl = encodePhotoUrl
    this.invalidateCache = invalidateCache
    this.logger = logger
  }

  async update(id, input) {
    const existing = await this.repository.findExisting(id)
    if (!existing) return { status: 404, body: { success: false, message: '国补记录不存在' } }

    if (input.customer_idcard !== undefined) {
      await this.repository.updateCustomerIdCard(
        existing.customer_id,
        input.customer_idcard ? input.customer_idcard.trim() : null
      )
    }

    if (input.customer_name || input.customer_phone) {
      const customerFields = []
      const customerValues = []
      if (input.customer_name) {
        customerFields.push('name = ?')
        customerValues.push(input.customer_name)
      }
      if (input.customer_phone) {
        customerFields.push('phone = ?')
        customerValues.push(input.customer_phone)
      }
      if (customerFields.length) {
        await this.repository.updateCustomer(existing.customer_id, customerFields, customerValues)
      }
    }

    const updateFields = []
    const updateValues = []
    this.appendDirectFields(input, updateFields, updateValues)

    if (input.sale_price !== undefined) {
      if (input.sale_price === '' || input.sale_price === null) {
        return { status: 400, body: { success: false, message: '销售价格不能为空' } }
      }
      const normalizedSalePrice = Number(input.sale_price)
      if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) {
        return { status: 400, body: { success: false, message: '销售价格必须是大于等于0的数字' } }
      }
      updateFields.push('sale_price = ?')
      updateValues.push(normalizedSalePrice.toFixed(2))
    }

    if (input.store_id !== undefined) {
      if (input.store_id === null || input.store_id === '') {
        updateFields.push('store_id = NULL', 'store_name = NULL')
      } else {
        const storeName = await this.repository.getStoreName(input.store_id)
        if (!storeName) {
          return { status: 400, body: { success: false, message: '选择的店铺不存在' } }
        }
        updateFields.push('store_id = ?', 'store_name = ?')
        updateValues.push(input.store_id, storeName)
      }
    }

    if (input.remarks !== undefined) {
      updateFields.push('remarks = COALESCE(?, remarks)')
      updateValues.push(input.remarks || null)
    }
    this.appendAuditAndArrivalFields(input, updateFields, updateValues)

    if (input.remarks !== undefined) {
      updateFields.push('remarks = ?')
      updateValues.push(input.remarks || '')
    }
    this.appendHandlerFields(input, updateFields, updateValues)

    await this.repository.updateSubsidy(id, updateFields, updateValues)

    const namingInput = await this.repository.getPhotoDirectoryNamingInput(id)
    if (namingInput) await this.syncPhotoDirectory(id, existing.subsidy_photos, namingInput)

    if (input.sale_time !== undefined) {
      const phoneId = await this.repository.getPhoneId(id)
      if (phoneId) {
        let saleTime = null
        if (input.sale_time === '') saleTime = null
        else if (input.sale_time) saleTime = `${input.sale_time} 00:00:00`
        await this.repository.updatePhoneSaleTime(phoneId, saleTime)
      }
    }

    this.invalidateCache('/subsidy')
    return { status: 200, body: { success: true, message: '更新成功' } }
  }

  appendDirectFields(input, fields, values) {
    const mappings = [
      ['customer_name', 'customer_name', value => value || null, 'COALESCE'],
      ['customer_phone', 'customer_phone', value => value || null, 'COALESCE']
    ]
    for (const [inputField, column, normalize, operator] of mappings) {
      if (input[inputField] !== undefined) {
        fields.push(`${column} = ${operator}(?, ${column})`)
        values.push(normalize(input[inputField]))
      }
    }
    if (input.sale_time !== undefined) {
      fields.push(input.sale_time === '' ? 'sale_time = NULL' : 'sale_time = ?')
      if (input.sale_time !== '') values.push(input.sale_time)
    }
    if (input.customer_idcard !== undefined) {
      fields.push('customer_idcard = ?')
      values.push(input.customer_idcard || null)
    }
    if (input.imei2 !== undefined) {
      fields.push('imei2 = COALESCE(?, imei2)')
      values.push(input.imei2 || null)
    }
    for (const [field, limit] of [['serial_number', null], ['imei1', null], ['phone_brand', 50], ['phone_model', 100], ['phone_color', 50], ['phone_memory', 50]]) {
      if (input[field] === undefined) continue
      const value = input[field] ? String(input[field]).trim() : ''
      fields.push(`${field} = ?`)
      values.push(limit ? value.slice(0, limit) || null : value)
    }
  }

  appendAuditAndArrivalFields(input, fields, values) {
    for (const [field, flag, column] of [
      ['apply_time', 'has_audit', 'apply_time'],
      ['arrival_time', 'has_arrival', 'arrival_time']
    ]) {
      if (input[field] !== undefined) {
        if (input[field] === '' || input[field] === null || typeof input[field] !== 'string') {
          fields.push(`${column} = NULL`)
        } else {
          fields.push(`${column} = ?`)
          values.push(`${input[field].split('T')[0]} 00:00:00`)
        }
      } else if (input[flag] !== undefined) {
        fields.push(`${column} = DATE_FORMAT(NOW(), "%Y-%m-%d 00:00:00")`)
      }
    }
  }

  appendHandlerFields(input, fields, values) {
    if (input.has_different_handler === undefined) return
    fields.push('has_different_handler = ?')
    values.push(input.has_different_handler ? 1 : 0)
    if (input.has_different_handler) {
      for (const field of ['handler_name', 'handler_phone', 'handler_idcard']) {
        fields.push(`${field} = ?`)
        values.push(input[field] || null)
      }
      return
    }
    fields.push('handler_name = NULL', 'handler_phone = NULL', 'handler_idcard = NULL')
  }

  parsePhotos(value) {
    if (Array.isArray(value)) return value.filter(photo => typeof photo === 'string' && photo.trim())
    if (typeof value !== 'string' || !value.trim()) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter(photo => typeof photo === 'string' && photo.trim()) : []
    } catch {
      return []
    }
  }

  safePhotoPath(photoUrl) {
    const relativePath = normalizeSubsidyPhotoPath(photoUrl)
    if (!relativePath) return null
    const root = this.path.resolve(this.uploadsRoot())
    const absolutePath = this.path.resolve(root, relativePath)
    if (absolutePath === root || !absolutePath.startsWith(`${root}${this.path.sep}`)) return null
    return { relativePath, absolutePath }
  }

  removeEmptyPhotoDirectories(relativePhotoPath) {
    const relativePath = normalizeSubsidyPhotoPath(
      String(relativePhotoPath || '').startsWith(SUBSIDY_UPLOAD_PREFIX)
        ? `/uploads/${relativePhotoPath}`
        : relativePhotoPath
    )
    if (!relativePath) return
    const subsidyRoot = this.path.resolve(this.uploadSubdir('subsidy'))
    let currentDirectory = this.path.dirname(this.path.resolve(this.uploadsRoot(), relativePath))
    while (currentDirectory !== subsidyRoot && currentDirectory.startsWith(`${subsidyRoot}${this.path.sep}`)) {
      if (!this.fileSystem.existsSync(currentDirectory) || this.fileSystem.readdirSync(currentDirectory).length > 0) break
      this.fileSystem.rmdirSync(currentDirectory)
      currentDirectory = this.path.dirname(currentDirectory)
    }
  }

  async syncPhotoDirectory(id, storedPhotos, namingInput) {
    const photos = this.parsePhotos(storedPhotos)
    if (!photos.length) return
    const naming = this.getPhotoNaming(namingInput)
    const targetDirectory = this.uploadSubdir('subsidy', naming.directoryName)
    const movedFiles = []
    const updatedPhotos = [...photos]
    try {
      for (let index = 0; index < photos.length; index += 1) {
        const source = this.safePhotoPath(photos[index])
        if (!source) continue
        const filename = this.path.basename(source.relativePath)
        const targetRelativePath = this.path.posix.join('subsidy', naming.directoryName, filename)
        const targetPath = this.path.resolve(this.uploadsRoot(), targetRelativePath)
        updatedPhotos[index] = this.encodePhotoUrl(targetRelativePath)
        if (source.absolutePath === targetPath) continue
        if (!this.fileSystem.existsSync(source.absolutePath)) {
          this.logger.warn('国补照片文件不存在，跳过目录同步:', photos[index])
          continue
        }
        if (this.fileSystem.existsSync(targetPath)) throw new Error(`国补照片目标文件已存在: ${targetPath}`)
        this.fileSystem.mkdirSync(targetDirectory, { recursive: true })
        this.fileSystem.renameSync(source.absolutePath, targetPath)
        movedFiles.push({ sourcePath: source.absolutePath, targetPath, sourceRelativePath: source.relativePath })
      }
      if (JSON.stringify(updatedPhotos) !== JSON.stringify(photos)) {
        await this.repository.updatePhotos(id, updatedPhotos)
      }
    } catch (error) {
      for (const moved of movedFiles.reverse()) {
        try {
          if (this.fileSystem.existsSync(moved.targetPath) && !this.fileSystem.existsSync(moved.sourcePath)) {
            this.fileSystem.mkdirSync(this.path.dirname(moved.sourcePath), { recursive: true })
            this.fileSystem.renameSync(moved.targetPath, moved.sourcePath)
          }
        } catch (rollbackError) {
          error.message += `；国补照片回滚失败: ${rollbackError.message}`
        }
      }
      throw error
    }
    for (const moved of movedFiles) {
      try {
        this.removeEmptyPhotoDirectories(moved.sourceRelativePath)
      } catch (error) {
        this.logger.warn('清理国补照片旧目录失败:', error.message)
      }
    }
  }
}

module.exports = SubsidyUpdateService
