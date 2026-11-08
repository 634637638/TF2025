'use strict'

const ModuleManagementRepository = require('../repositories/module-management.repository')
const ModuleScanner = require('./module-scanner.service')

const PROTECTED_MODULE_KEYS = new Set([
  'permissions_permissionsview',
  'permissions_modulemanagementview'
])

class ModuleManagementService {
  constructor({ repository = new ModuleManagementRepository(), moduleScanner = new ModuleScanner() } = {}) {
    this.repository = repository
    this.moduleScanner = moduleScanner
  }

  async updateModule(moduleKey, data) {
    const existingModule = await this.repository.getModuleByKey(moduleKey)
    const affectedRows = await this.repository.updateModule(moduleKey, data)
    return { existingModule, affectedRows }
  }

  async toggleModule(moduleKey, isActive) {
    const module = await this.repository.getModuleStatusByKey(moduleKey)
    if (!module) return null

    const affectedRows = await this.repository.setModuleStatusByKey(moduleKey, isActive)
    return { module, affectedRows }
  }

  getOverviewStats() {
    return this.repository.getOverviewStats()
  }

  async registerModule(moduleKey) {
    const modules = await this.moduleScanner.scanViewsDirectory()
    const targetModule = modules.find(module => module.key === moduleKey)
    if (!targetModule) return { error: 'module_missing' }

    return { targetModule, result: await this.moduleScanner.registerModule(targetModule) }
  }

  async registerModules(moduleKeys) {
    const allModules = await this.moduleScanner.scanViewsDirectory()
    const targetModules = allModules.filter(module => moduleKeys.includes(module.key))
    if (targetModules.length !== moduleKeys.length) return { error: 'module_missing' }

    return { targetModules, result: await this.moduleScanner.registerModules(targetModules) }
  }

  async createManualModule(input) {
    const { key, name, description, category, icon, is_active: requestedStatus } = input
    if (!key || !name || !category) return { error: 'required_fields' }
    if (!/^[a-z0-9_]+$/.test(key)) return { error: 'invalid_key' }

    const module = {
      key,
      name,
      description: description || `${name}管理模块`,
      category,
      icon: icon || 'fas fa-cube',
      isActive: requestedStatus !== undefined ? (requestedStatus ? 1 : 0) : 1
    }
    return this.repository.withConnection(async connection => {
      try {
        await connection.beginTransaction()
        const existingModule = await this.repository.getModuleByKey(key, connection)
        if (existingModule) {
          await connection.rollback()
          return { error: 'module_exists' }
        }

        const [result] = await this.repository.createManualModule(connection, module)
        await connection.commit()
        return { module, moduleId: result.insertId }
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async deleteModule(moduleKey) {
    return this.repository.withConnection(async connection => {
      try {
        await connection.beginTransaction()
        await this.repository.deleteModulePermissions(connection, moduleKey)
        await this.repository.softDeleteModule(connection, moduleKey)
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async setModuleName(moduleKey, name, isCustom) {
    if (!name || name.trim().length === 0) {
      return { error: 'invalid_name' }
    }

    const module = await this.repository.getModuleByKey(moduleKey)
    if (!module) return { error: 'module_missing' }

    const normalizedName = name.trim()
    await this.repository.updateModuleName(moduleKey, normalizedName, isCustom)
    return { module, name: normalizedName, isCustom }
  }

  async restoreModuleName(moduleKey) {
    const module = await this.repository.getModuleByKey(moduleKey)
    if (!module) return { error: 'module_missing' }
    if (!module.original_name) return { error: 'original_name_missing', module }

    await this.repository.restoreModuleName(moduleKey, module.original_name)
    return { module }
  }

  async setModuleStatusById(id, isActive) {
    if (!Number.isInteger(isActive) || ![0, 1].includes(isActive)) {
      return { error: 'invalid_status' }
    }

    const module = await this.repository.getModuleById(id)
    if (!module) return { error: 'module_missing' }
    if (isActive === 0 && PROTECTED_MODULE_KEYS.has(module.key)) {
      return { error: 'protected_module', module }
    }

    await this.repository.setModuleStatusById(id, isActive)
    return { module }
  }
}

module.exports = ModuleManagementService
