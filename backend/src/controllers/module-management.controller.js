'use strict'

const log = require('../utils/log')
const ModuleScanner = require('../services/module-scanner.service')
const ModuleManagementService = require('../services/module-management.service')

class ModuleManagementController {
  constructor({
    moduleScanner = new ModuleScanner(),
    service = null,
    logPermissionOperation = async () => {}
  } = {}) {
    this.moduleScanner = moduleScanner
    this.service = service || new ModuleManagementService({ moduleScanner })
    this.logPermissionOperation = logPermissionOperation
  }

  async register(req, res) {
    try {
      const { module_key: moduleKey } = req.body
      if (!moduleKey) {
        return res.status(400).json({ success: false, message: '模块标识不能为空' })
      }

      const registration = await this.service.registerModule(moduleKey)
      if (registration.error === 'module_missing') {
        return res.status(404).json({ success: false, message: '未找到指定的模块' })
      }

      const { targetModule, result } = registration
      if (result?.success !== false) {
        await this.logPermissionOperation(
          req,
          'create',
          'module',
          result?.module_id || null,
          targetModule.name || moduleKey,
          `注册模块：${targetModule.name || moduleKey}`,
          {
            audit_type: 'module_register',
            module_key: moduleKey,
            module_name: targetModule.name || moduleKey
          }
        )
      }

      return res.json(result)
    } catch (error) {
      log.error('注册模块失败:', error)
      return res.status(500).json({ success: false, message: '注册模块失败: ' + error.message })
    }
  }

  async registerBatch(req, res) {
    try {
      const { module_keys: moduleKeys } = req.body
      if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) {
        return res.status(400).json({ success: false, message: '模块标识列表不能为空' })
      }

      const registration = await this.service.registerModules(moduleKeys)
      if (registration.error === 'module_missing') {
        return res.status(404).json({ success: false, message: '部分模块未找到' })
      }

      const { targetModules, result } = registration
      await this.logPermissionOperation(
        req,
        'create',
        'module_batch',
        null,
        '批量注册模块',
        `批量注册 ${targetModules.length} 个模块`,
        {
          audit_type: 'module_register_batch',
          modules: targetModules.map(module => ({
            module_key: module.key,
            module_name: module.name || module.key
          }))
        }
      )

      return res.json({ success: true, message: '批量注册完成', data: result })
    } catch (error) {
      log.error('批量注册模块失败:', error)
      return res.status(500).json({ success: false, message: '批量注册模块失败: ' + error.message })
    }
  }

  async manualCreate(req, res) {
    try {
      const result = await this.service.createManualModule(req.body)
      if (result.error === 'required_fields') {
        return res.status(400).json({ success: false, message: '模块标识、名称和分类为必填项' })
      }
      if (result.error === 'invalid_key') {
        return res.status(400).json({ success: false, message: '模块标识只能包含小写字母、数字和下划线' })
      }
      if (result.error === 'module_exists') {
        return res.status(400).json({
          success: false,
          message: `模块标识 "${req.body.key}" 已存在，请使用其他标识`
        })
      }

      const { module, moduleId } = result
      log.debug(`✅ 手动创建模块成功: ${module.key} (${module.name})`)
      await this.logPermissionOperation(
        req,
        'create',
        'module',
        moduleId,
        module.name,
        `创建模块：${module.name}`,
        {
          audit_type: 'module_create',
          module_key: module.key,
          module_name: module.name,
          description: module.description,
          category: module.category,
          icon: module.icon,
          is_active: module.isActive
        }
      )

      try {
        await this.moduleScanner.autoFixAllMenuLinks()
      } catch (error) {
        log.error('自动修复菜单关联失败:', error)
      }

      return res.json({
        success: true,
        message: `模块 "${module.name}" 创建成功`,
        data: {
          id: moduleId,
          key: module.key,
          name: module.name,
          category: module.category,
          is_active: module.isActive
        }
      })
    } catch (error) {
      log.error('手动创建模块失败:', error)
      return res.status(500).json({ success: false, message: '创建模块失败: ' + error.message })
    }
  }

  async update(req, res) {
    try {
      const { module_key: moduleKey } = req.params
      const { name, description, category, icon, sort_order: sortOrder } = req.body
      const { existingModule, affectedRows } = await this.service.updateModule(moduleKey, {
        name, description, category, icon, sort_order: sortOrder
      })

      if (affectedRows === 0) {
        return res.status(404).json({ success: false, message: '模块不存在或未更新' })
      }

      await this.logPermissionOperation(
        req,
        'edit',
        'module',
        existingModule?.id || null,
        name || existingModule?.name || moduleKey,
        `编辑模块：${name || existingModule?.name || moduleKey}`,
        {
          audit_type: 'module_edit',
          module_key: moduleKey,
          previous: existingModule || null,
          current: { name, description, category, icon, sort_order: sortOrder }
        }
      )

      return res.json({ success: true, message: '模块更新成功' })
    } catch (error) {
      log.error('更新模块失败:', error)
      return res.status(500).json({ success: false, message: '更新模块失败: ' + error.message })
    }
  }

  async toggle(req, res) {
    try {
      const { module_key: moduleKey } = req.params
      const { is_active: isActive } = req.body
      const result = await this.service.toggleModule(moduleKey, isActive)
      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }

      await this.logPermissionOperation(
        req,
        isActive ? 'enable' : 'disable',
        'module',
        result.module.id || null,
        result.module.name || moduleKey,
        `${isActive ? '启用' : '禁用'}模块：${result.module.name || moduleKey}`,
        {
          audit_type: 'module_status',
          module_key: moduleKey,
          previous_is_active: Number(result.module.is_active),
          is_active: isActive ? 1 : 0
        }
      )

      return res.json({
        success: true,
        message: `模块${isActive ? '启用' : '禁用'}成功`
      })
    } catch (error) {
      log.error('切换模块状态失败:', error)
      return res.status(500).json({ success: false, message: '切换模块状态失败: ' + error.message })
    }
  }

  async overviewStats(_req, res) {
    try {
      const data = await this.service.getOverviewStats()
      return res.json({ success: true, message: '获取统计信息成功', data })
    } catch (error) {
      log.error('获取统计信息失败:', error)
      return res.status(500).json({ success: false, message: '获取统计信息失败: ' + error.message })
    }
  }

  async delete(req, res) {
    try {
      const { module_key: moduleKey } = req.params
      await this.service.deleteModule(moduleKey)
      await this.logPermissionOperation(
        req,
        'delete',
        'module',
        null,
        moduleKey,
        `删除模块：${moduleKey}`,
        { audit_type: 'module_delete', module_key: moduleKey }
      )
      return res.json({ success: true, message: '模块删除成功' })
    } catch (error) {
      log.error('删除模块失败:', error)
      return res.status(500).json({ success: false, message: '删除模块失败: ' + error.message })
    }
  }

  async rename(req, res) {
    try {
      const { module_key: moduleKey } = req.params
      const { name, is_custom: isCustom = true } = req.body
      const result = await this.service.setModuleName(moduleKey, name, isCustom)

      if (result.error === 'invalid_name') {
        return res.status(400).json({ success: false, message: '模块名称不能为空' })
      }
      if (result.error === 'module_missing') {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }

      const { module } = result
      if (module.is_custom_name === 1 && isCustom === true) {
        log.debug(`🔓 更改自定义名称: "${module.name}" -> "${result.name}" (模块: ${moduleKey})`)
      } else if (module.is_custom_name === 0 && isCustom === true) {
        log.debug(`🔒 设为自定义名称: "${module.name}" -> "${result.name}" (模块: ${moduleKey})`)
      }

      await this.logPermissionOperation(
        req,
        'edit',
        'module',
        module.id,
        result.name,
        `修改模块名称：${module.name} -> ${result.name}`,
        {
          audit_type: 'module_rename',
          module_key: moduleKey,
          previous_name: module.name,
          name: result.name,
          is_custom_name: isCustom
        }
      )
      return res.json({
        success: true,
        message: '模块名称修改成功',
        data: {
          module_key: moduleKey,
          old_name: module.name,
          new_name: result.name,
          is_custom_name: isCustom,
          original_name: module.original_name
        }
      })
    } catch (error) {
      log.error('修改模块名称失败:', error)
      return res.status(500).json({ success: false, message: '修改模块名称失败: ' + error.message })
    }
  }

  async restoreName(req, res) {
    try {
      const { module_key: moduleKey } = req.params
      const result = await this.service.restoreModuleName(moduleKey)
      if (result.error === 'module_missing') {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }
      if (result.error === 'original_name_missing') {
        return res.status(400).json({ success: false, message: '该模块没有原始名称记录' })
      }

      const { module } = result
      log.debug(`🔄 恢复原始名称: "${module.name}" -> "${module.original_name}" (模块: ${moduleKey})`)
      await this.logPermissionOperation(
        req,
        'edit',
        'module',
        module.id,
        module.original_name,
        `恢复模块名称：${module.name} -> ${module.original_name}`,
        {
          audit_type: 'module_restore_name',
          module_key: moduleKey,
          previous_name: module.name,
          name: module.original_name
        }
      )
      return res.json({
        success: true,
        message: '模块名称已恢复为原始名称',
        data: {
          module_key: moduleKey,
          old_name: module.name,
          new_name: module.original_name,
          is_custom_name: false
        }
      })
    } catch (error) {
      log.error('恢复模块名称失败:', error)
      return res.status(500).json({ success: false, message: '恢复模块名称失败: ' + error.message })
    }
  }

  async setStatusById(req, res) {
    try {
      const { id } = req.params
      const { is_active: isActive } = req.body
      const result = await this.service.setModuleStatusById(id, isActive)

      if (result.error === 'invalid_status') {
        return res.status(400).json({ success: false, message: '状态值必须是数字 (0 或 1)' })
      }
      if (result.error === 'module_missing') {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }
      if (result.error === 'protected_module') {
        return res.status(400).json({
          success: false,
          message: '权限管理核心模块不能禁用，否则会导致管理入口无法访问'
        })
      }

      const { module } = result
      await this.logPermissionOperation(
        req,
        isActive === 1 ? 'enable' : 'disable',
        'module',
        module.id,
        module.name || module.key,
        `${isActive === 1 ? '启用' : '禁用'}模块：${module.name || module.key}`,
        {
          audit_type: 'module_status',
          module_key: module.key,
          previous_is_active: Number(module.is_active),
          is_active: isActive
        }
      )
      return res.json({
        success: true,
        message: `模块已${isActive === 1 ? '启用' : '禁用'}`,
        data: { id, is_active: isActive }
      })
    } catch (error) {
      log.error('切换模块状态失败:', error)
      return res.status(500).json({ success: false, message: '操作失败: ' + error.message })
    }
  }

  async list(_req, res) {
    try {
      const modules = await this.moduleScanner.getActiveModules()
      return res.json({
        success: true,
        message: '获取模块列表成功',
        data: modules
      })
    } catch (error) {
      log.error('获取模块列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取模块列表失败',
        data: []
      })
    }
  }

  async registered(_req, res) {
    try {
      const modules = await this.moduleScanner.getRegisteredModules()
      return res.json({
        success: true,
        message: '获取已注册模块成功',
        data: { total: modules.length, modules }
      })
    } catch (error) {
      log.error('获取已注册模块失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取已注册模块失败: ' + error.message,
        data: []
      })
    }
  }

  async nameStatus(req, res) {
    try {
      const status = await this.moduleScanner.getModuleNameStatus(req.params.module_key)
      if (!status) {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }
      return res.json({ success: true, message: '获取模块名称状态成功', data: status })
    } catch (error) {
      log.error('获取模块名称状态失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取模块名称状态失败: ' + error.message
      })
    }
  }

  async detail(req, res) {
    try {
      const details = await this.moduleScanner.getModuleDetails(req.params.module_key)
      if (!details) {
        return res.status(404).json({ success: false, message: '模块不存在' })
      }
      return res.json({ success: true, message: '获取模块详情成功', data: details })
    } catch (error) {
      log.error('获取模块详情失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取模块详情失败: ' + error.message
      })
    }
  }

  async syncAll(req, res) {
    try {
      const result = await this.moduleScanner.syncAllModules()
      await this.logPermissionOperation(
        req,
        'sync',
        'module_batch',
        null,
        '同步全部模块',
        `同步模块：成功 ${result.success || 0} 个，失败 ${result.errors || 0} 个，清理 ${result.deleted || 0} 个`,
        {
          audit_type: 'module_sync',
          total: result.total || 0,
          success_count: result.success || 0,
          error_count: result.errors || 0,
          deleted_count: result.deleted || 0,
          modules: Array.isArray(result.results)
            ? result.results.map((item) => ({
              module_key: item.module_key,
              action: item.action || (item.success ? 'registered_or_updated' : 'failed'),
              success: item.success !== false,
              message: item.message || ''
            }))
            : []
        }
      )

      return res.json({
        success: true,
        message: '同步所有模块完成',
        data: result
      })
    } catch (error) {
      log.error('同步所有模块失败:', error)
      return res.status(500).json({
        success: false,
        message: '同步所有模块失败: ' + error.message
      })
    }
  }

  async scan(_req, res) {
    try {
      const modules = await this.moduleScanner.scanViewsDirectory()
      log.debug(`🔍 模块扫描结果: 总共${modules.length}个模块`)
      return res.json({
        success: true,
        message: '扫描成功',
        data: { total: modules.length, modules }
      })
    } catch (error) {
      log.error('扫描模块失败:', error)
      return res.status(500).json({
        success: false,
        message: '扫描模块失败: ' + error.message,
        data: []
      })
    }
  }

  async unregistered(_req, res) {
    try {
      const result = await this.moduleScanner.getUnregisteredModules()
      const modules = Array.isArray(result?.data?.modules) ? result.data.modules : []
      return res.json({
        success: true,
        message: '获取未注册模块成功',
        data: { total: modules.length, modules }
      })
    } catch (error) {
      log.error('获取未注册模块失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取未注册模块失败: ' + error.message,
        data: []
      })
    }
  }

  async fixMenuLinks(_req, res) {
    try {
      log.debug('🔧 手动触发菜单关联修复...')
      const result = await this.moduleScanner.autoFixAllMenuLinks()
      return res.json({
        success: true,
        message: `菜单关联修复完成，更新了 ${result.updatedCount} 个菜单关联`,
        data: result
      })
    } catch (error) {
      log.error('菜单关联修复失败:', error)
      return res.status(500).json({
        success: false,
        message: '修复失败: ' + error.message
      })
    }
  }
}

module.exports = ModuleManagementController
