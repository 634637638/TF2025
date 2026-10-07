const fs = require('fs')
const path = require('path')
const { getDatabase } = require('../config/database')
const MenuModuleLinker = require('./menuModuleLinker')
const { getModulePermissionMetadata, getModulePermissionTypes } = require('../config/module-permission-actions')
const permissionCapabilityRegistry = require('../config/capability-registry')
const { hasColumn } = require('./schemaInspector.service')
const log = require('../utils/log')

class ModuleScanner {
  constructor() {
    this.viewsPath = path.join(__dirname, '../../../frontend/src/views')
    this.routerPath = path.join(__dirname, '../../../frontend/src/router/index.ts')
    // shared 是经验分享业务页面，必须参与权限模块扫描。
    this.excludeDirs = ['components', 'layouts', 'common', 'admin', 'auth']
    this.excludeFiles = ['index.vue', 'Home.vue', 'Login.vue']
    this.publicPages = new Set(permissionCapabilityRegistry.publicPages || [])
    this.scanExcludedPages = new Set(permissionCapabilityRegistry.scanExcludedPages || [])
    this.scanAliases = permissionCapabilityRegistry.scanAliases || {}
    this.standardPermissions = ['view', 'create', 'edit', 'delete', 'export', 'import', 'sell']
    this.menuLinker = new MenuModuleLinker()
  }

  /**
   * 扫描views目录，检测所有项目模块
   */
  async scanViewsDirectory() {
    try {
      const modules = []
      const routeComponentPaths = this.getRouteComponentPaths()
      const files = this.collectVueFiles(this.viewsPath, routeComponentPaths)

      for (const relativePath of files) {
        const moduleInfo = this.analyzeVueFile(relativePath)
        if (moduleInfo) {
          modules.push(moduleInfo)
        }
      }

      return modules
    } catch (error) {
      log.error('扫描views目录失败:', error)
      throw error
    }
  }

  /**
   * 将共享能力清单中的嵌入式业务模块合并到扫描结果。
   * 这些模块可能由主页面 Tab 承载，没有独立路由文件，但仍必须可单独授权。
   */
  mergeCapabilityModules(scannedModules = []) {
    const modulesByKey = new Map(scannedModules.map(module => [module.key, module]))

    for (const moduleKey of Object.keys(permissionCapabilityRegistry.modules || {})) {
      if (modulesByKey.has(moduleKey)) {
        continue
      }

      const metadata = getModulePermissionMetadata(moduleKey) || {}
      modulesByKey.set(moduleKey, {
        key: moduleKey,
        name: metadata.name || moduleKey,
        description: metadata.description || `${metadata.name || moduleKey}权限模块`,
        category: metadata.category || 'custom',
        icon: metadata.icon || 'fas fa-cube',
        path: null,
        route_path: null,
        filename: '',
        folder: metadata.category || 'custom',
        permissions: getModulePermissionTypes(moduleKey),
        last_modified: new Date().toISOString()
      })
    }

    return Array.from(modulesByKey.values())
  }

  /**
   * 分析Vue文件，提取模块信息
   */
  analyzeVueFile(relativePath) {
    try {
      const normalizedPath = this.normalizePath(relativePath)
      const category = this.extractCategory(normalizedPath)
      const moduleName = this.getModuleNameFromPath(category, normalizedPath)
      const generatedModuleKey = this.generateModuleKey(category, moduleName)
      const moduleKey = this.scanAliases[generatedModuleKey] || generatedModuleKey

      const moduleInfo = {
        key: moduleKey,
        name: this.generateModuleName(moduleName),
        category: this.determineCategory(category),
        description: `${this.generateModuleName(moduleName)}管理模块`,
        path: `/${category}/${moduleName}`,
        route_path: `/${category}/${moduleName}`,
        filename: path.basename(normalizedPath),
        folder: category,
        icon: 'fas fa-cube',
        permissions: getModulePermissionTypes(moduleKey),
        last_modified: new Date().toISOString()
      }

      return {
        ...moduleInfo,
        ...(getModulePermissionMetadata(moduleKey) || {})
      }
    } catch (error) {
      log.error(`分析文件失败 ${category}/${filename}:`, error)
      return null
    }
  }

  normalizePath(filePath) {
    return String(filePath || '').replace(/\\/g, '/')
  }

  extractCategory(relativePath) {
    return this.normalizePath(relativePath).split('/')[0] || ''
  }

  getModuleNameFromPath(category, relativePath) {
    const baseName = path.basename(relativePath, '.vue')

    if (category === 'H5-admin' && !/view$/i.test(baseName)) {
      return `${baseName}View`
    }

    return baseName
  }

  getRouteComponentPaths() {
    try {
      const content = fs.readFileSync(this.routerPath, 'utf8')
      const matches = content.matchAll(/import\(['"]@\/views\/(.+?\.vue)['"]\)/g)
      return new Set(Array.from(matches, (match) => this.normalizePath(match[1])))
    } catch (error) {
      log.warn('读取路由定义失败，回退到顶层扫描模式:', error.message)
      return new Set()
    }
  }

  collectVueFiles(currentPath, routeComponentPaths, results = []) {
    const items = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const item of items) {
      const absolutePath = path.join(currentPath, item.name)
      const relativePath = this.normalizePath(path.relative(this.viewsPath, absolutePath))

      if (item.isDirectory()) {
        if (this.shouldSkipDirectory(relativePath)) {
          continue
        }

        this.collectVueFiles(absolutePath, routeComponentPaths, results)
        continue
      }

      if (!item.name.endsWith('.vue') || this.excludeFiles.includes(item.name)) {
        continue
      }

      if (this.shouldIncludeVueFile(relativePath, routeComponentPaths)) {
        results.push(relativePath)
      }
    }

    return results
  }

  shouldSkipDirectory(relativePath) {
    const parts = this.normalizePath(relativePath).split('/').filter(Boolean)
    return parts.some(part => this.excludeDirs.includes(part))
  }

  shouldIncludeVueFile(relativePath, routeComponentPaths) {
    const normalizedPath = this.normalizePath(relativePath)
    const parts = normalizedPath.split('/')
    const fileName = parts[parts.length - 1]
    const category = parts[0]

    if (parts.some(part => this.excludeDirs.includes(part))) {
      return false
    }

    if (fileName === '404.vue') {
      return false
    }

    if (this.publicPages.has(normalizedPath) || this.scanExcludedPages.has(normalizedPath)) {
      return false
    }

    if (routeComponentPaths.has(normalizedPath) && this.isNestedRouteModule(category, parts, fileName)) {
      return true
    }

    if (category === 'system' && parts.length === 3 && parts[1] === 'page' && fileName === 'Returngoods.vue') {
      return true
    }

    return parts.length === 2 && routeComponentPaths.has(normalizedPath)
  }

  isNestedRouteModule(category, parts, fileName) {
    if (parts.length !== 3 || parts[1] !== 'page') {
      return false
    }

    if (category === 'H5-mobile') {
      return false
    }

    if (category === 'H5-admin') {
      return true
    }

    if (fileName === 'GitManagement.vue') {
      return true
    }

    return /(View|Page)\.vue$/i.test(fileName)
  }

  /**
   * 生成模块唯一标识
   */
  generateModuleKey(category, moduleName) {
    const key = `${category}_${moduleName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    return key.replace(/_+/g, '_').replace(/^_|_$/g, '')
  }

  /**
   * 生成模块显示名称（使用中文映射）
   */
  generateModuleName(moduleName) {
    // 中文模块名称映射
    const chineseNames = {
      // 用户管理相关
      'UsersView': '用户管理',
      'PermissionsView': '权限管理',
      'EmployeesView': '员工管理',
      'LoginView': '登录页面',
      'RegisterView': '注册页面',

      // 业务相关
      'SalesView': '销售管理',
      'PhoneSaleView': '手机销售',
      'EditPhoneView': '手机编辑',
      'InventoryView': '库存管理',
      'StockInPage': '入库管理',
      'AccessoriesView': '配件管理',
      'CustomersView': '客户管理',
      'SuppliersView': '供应商列表',
      'SupplierManagementView': '供应商管理',
      'RepairsView': '维修管理',
      'RentalsView': '租赁管理',
      'PhonesView': '手机管理',
      'SubsidyView': '国补管理',

      // 商品相关
      'BrandsView': '品牌管理',
      'ModelsView': '型号管理',
      'ColorsView': '颜色管理',
      'MemoriesView': '内存管理',
      'ProductsView': '商品管理',
      'QueryView': '查询管理',
      'ReminderView': '待办提醒',
      'SharedView': '经验分享',

      // 系统相关
      'DashboardView': '仪表盘',
      'SystemView': '系统管理',
      'MenuManagementView': '菜单管理',
      'StoresView': '门店管理',
      'AnalyticsView': '数据分析',
      'GitManagement': 'Git管理',
      'Returngoods': '退库管理',
      'SyncLogView': '同步日志',
      'IconDemo': '图标演示',

      // H5 相关
      'H5-adminView': 'H5商城管理',
      'H5-mobileView': 'H5移动端商城',
      'templatesView': 'H5模板管理',
      'configView': 'H5商城配置',
      'home-sectionsView': 'H5首页推荐',
      'bannersView': 'H5轮播图管理',
      'ordersView': 'H5订单管理'
    }

    // 首先尝试中文映射
    if (chineseNames[moduleName]) {
      return chineseNames[moduleName]
    }

    // 如果没有映射，使用英文格式化
    return moduleName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  /**
   * 确定模块分类
   */
  determineCategory(folder) {
    const categoryMap = {
      'sales': 'business',
      'inventory': 'business',
      'procurement': 'business',
      'reports': 'business',
      'customers': 'business',
      'dashboard': 'business',
      'system': 'system',
      'settings': 'system',
      'admin': 'system'
    }
    return categoryMap[folder] || 'custom'
  }

  /**
   * 同步所有模块
   */
  async syncAllModules() {
    try {
      log.debug('🔍 开始扫描views目录...')
      const scannedModules = await this.scanViewsDirectory()
      const modulesToSync = this.mergeCapabilityModules(scannedModules)
      log.debug(`📋 发现 ${scannedModules.length} 个页面模块，共享清单合并后 ${modulesToSync.length} 个模块`)

      // 共享清单是模块存在性的最终依据，嵌入式业务 Tab 不得被误停用。
      const registeredModuleKeys = new Set(modulesToSync.map(module => module.key))

      const results = []
      let successCount = 0
      let errorCount = 0
      let deletedCount = 0

      // 注册或更新页面模块及共享清单中的嵌入式业务模块
      for (const module of modulesToSync) {
        try {
          const result = await this.registerModule(module)
          results.push(result)

          if (result.success) {
            successCount++
            log.debug(`✅ 模块注册成功: ${result.module_key}`)
          } else {
            errorCount++
            log.error(`❌ 模块注册失败: ${module.key} - ${result.message}`)
          }
        } catch (error) {
          errorCount++
          log.error(`❌ 模块注册异常: ${module.key} - ${error.message}`)
          results.push({
            success: false,
            message: error.message,
            module_key: module.key
          })
        }
      }

      // 删除数据库中不存在于文件系统的模块
      try {
        log.debug('🗑️ 开始清理不存在的模块...')
        const deletedModules = await this.deleteNonExistentModules(registeredModuleKeys)
        deletedCount = deletedModules.length

        if (deletedCount > 0) {
          log.debug(`🗑️ 删除了 ${deletedCount} 个不存在的模块:`, deletedModules)
          deletedModules.forEach(module_key => {
            results.push({
              success: true,
              message: '删除不存在的模块',
              module_key,
              action: 'deleted'
            })
          })
        }
      } catch (error) {
        log.error('清理不存在的模块失败:', error)
        errorCount++
      }

      log.debug('📊 同步完成:', {
        总数: modulesToSync.length,
        注册成功: successCount,
        注册失败: errorCount,
        删除模块: deletedCount
      })

      // 自动修复所有菜单与模块的关联
      log.debug('🔧 开始自动修复菜单关联...')
      await this.autoFixAllMenuLinks()
      log.debug('✅ 菜单关联修复完成')

      return {
        total: modulesToSync.length,
        success: successCount,
        errors: errorCount,
        deleted: deletedCount,
        results: results
      }
    } catch (error) {
      log.error('同步模块失败:', error)
      throw error
    }
  }

  /**
   * 删除数据库中不存在于文件系统的模块
   */
  async deleteNonExistentModules(registeredModuleKeys) {
    const pool = getDatabase()
    const connection = await pool.getConnection()

    try {
      // 查询数据库中所有的模块
      const [existingModules] = await connection.execute(
        'SELECT `key` FROM modules'
      )

      const modulesToDelete = []

      // 找出需要删除的模块（在数据库中但不在扫描结果中）
      for (const module of existingModules) {
        if (!registeredModuleKeys.has(module.key)) {
          modulesToDelete.push(module.key)
        }
      }

      // 对不存在于文件系统的模块做停用处理，而不是硬删除。
      // 这样可以保留历史角色权限、菜单可见性和审计痕迹，避免重命名页面时权限丢失。
      if (modulesToDelete.length > 0) {
        const placeholders = modulesToDelete.map(() => '?').join(',')
        await connection.execute(
          `UPDATE modules
           SET is_active = 0, updated_at = NOW()
           WHERE \`key\` IN (${placeholders})`,
          modulesToDelete
        )
      }

      return modulesToDelete
    } finally {
      connection.release()
    }
  }

  /**
   * 获取未注册的模块列表
   */
  async getUnregisteredModules() {
    try {
      // 页面扫描结果与共享清单共同构成所有可注册模块。
      const scannedModules = await this.scanViewsDirectory()
      const availableModules = this.mergeCapabilityModules(scannedModules)

      // 获取已注册的模块
      const pool = getDatabase()
      const [registeredModules] = await pool.execute(
        'SELECT `key` FROM modules WHERE is_active = 1'
      )

      const registeredKeys = registeredModules.map(m => m.key)

      // 筛选出未注册的模块
      const unregisteredModules = availableModules.filter(module =>
        !registeredKeys.includes(module.key)
      )

      return {
        success: true,
        message: '获取未注册模块成功',
        data: {
          total: unregisteredModules.length,
          modules: unregisteredModules
        }
      }
    } catch (error) {
      log.error('获取未注册模块失败:', error)
      return {
        success: false,
        message: '获取未注册模块失败: ' + error.message,
        data: {
          total: 0,
          modules: []
        }
      }
    }
  }

  /**
   * 注册新模块到数据库（支持名称保护）
   */
  async registerModule(moduleInfo) {
    try {
      const pool = getDatabase()
      const supportsRoutePath = await hasColumn('modules', 'route_path', pool)
      const supportsIsActive = await hasColumn('modules', 'is_active', pool)
      const supportsCustomName = await hasColumn('modules', 'is_custom_name', pool)
      const supportsMenuId = await hasColumn('modules', 'menu_id', pool)

      // 检查模块是否已存在
      const [existingModule] = await pool.execute(
        'SELECT * FROM modules WHERE `key` = ?',
        [moduleInfo.key]
      )

      if (existingModule.length > 0) {
        const module = existingModule[0]
        const boundMenu = await this.findBoundMenu(module, pool)
        const boundMenuName = String(boundMenu?.name || '').trim()
        const menuOverridesScannedName = Boolean(boundMenuName && boundMenuName !== moduleInfo.name)

        // 如果是自定义名称，保护不被覆盖
        if (Number(module.is_custom_name) === 1 || menuOverridesScannedName) {
          const protectedName = boundMenuName || module.name
          log.debug(`🔒 模块 ${moduleInfo.key} 名称受保护: "${protectedName}" (${boundMenuName ? '菜单绑定' : '自定义名称'})`)

          // 只更新非名称字段
          const protectedUpdateFields = []
          const protectedUpdateValues = []
          if (protectedName && protectedName !== module.name) {
            protectedUpdateFields.push('name = ?')
            protectedUpdateValues.push(protectedName)
          }
          if (supportsCustomName && menuOverridesScannedName) {
            protectedUpdateFields.push('is_custom_name = 1')
          }
          if (supportsMenuId && boundMenu?.id && !module.menu_id) {
            protectedUpdateFields.push('menu_id = ?')
            protectedUpdateValues.push(boundMenu.id)
          }
          protectedUpdateFields.push('description = ?', 'category = ?', 'icon = ?')
          protectedUpdateValues.push(moduleInfo.description, moduleInfo.category, moduleInfo.icon)
          if (supportsRoutePath) {
            protectedUpdateFields.push('route_path = ?')
            protectedUpdateValues.push(moduleInfo.route_path || moduleInfo.path || null)
          }

          if (supportsIsActive) protectedUpdateFields.push('is_active = 1')
          protectedUpdateFields.push('updated_at = NOW()')
          protectedUpdateValues.push(moduleInfo.key)
          await pool.execute(
            `UPDATE modules SET ${protectedUpdateFields.join(', ')} WHERE \`key\` = ?`,
            protectedUpdateValues
          )

          await this.createModulePermissions(moduleInfo.key)
          return {
            success: true,
            message: `模块 ${moduleInfo.name} 信息已更新 (名称受保护)`,
            module_key: moduleInfo.key,
            is_new_module: false,
            is_custom_name: true,
            protected_name: protectedName
          }
        } else {
          // 自动生成的名称，可以更新
          log.debug(`🤖 更新模块 ${moduleInfo.key} 名称: "${module.name}" -> "${moduleInfo.name}"`)

          if (supportsRoutePath) {
            await pool.execute(
              `UPDATE modules SET name = ?, description = ?, category = ?, icon = ?, original_name = ?, route_path = ?${supportsIsActive ? ', is_active = 1' : ''}, updated_at = NOW() WHERE \`key\` = ?`,
              [moduleInfo.name, moduleInfo.description, moduleInfo.category, moduleInfo.icon, moduleInfo.name, moduleInfo.route_path || moduleInfo.path || null, moduleInfo.key]
            )
          } else {
            await pool.execute(
              `UPDATE modules SET name = ?, description = ?, category = ?, icon = ?, original_name = ?${supportsIsActive ? ', is_active = 1' : ''}, updated_at = NOW() WHERE \`key\` = ?`,
              [moduleInfo.name, moduleInfo.description, moduleInfo.category, moduleInfo.icon, moduleInfo.name, moduleInfo.key]
            )
          }

          await this.createModulePermissions(moduleInfo.key)
          return {
            success: true,
            message: `模块 ${moduleInfo.name} 更新成功`,
            module_key: moduleInfo.key,
            is_new_module: false,
            is_custom_name: false
          }
        }
      } else {
        // 新模块，直接插入
        const [result] = supportsRoutePath
          ? await pool.execute(
            'INSERT INTO modules (`key`, name, route_path, description, category, sort_order, icon, is_active, is_custom_name, original_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, NOW())',
            [moduleInfo.key, moduleInfo.name, moduleInfo.route_path || moduleInfo.path || null, moduleInfo.description, moduleInfo.category, 0, moduleInfo.icon, moduleInfo.name]
          )
          : await pool.execute(
            'INSERT INTO modules (`key`, name, description, category, sort_order, icon, is_active, is_custom_name, original_name, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, NOW())',
            [moduleInfo.key, moduleInfo.name, moduleInfo.description, moduleInfo.category, 0, moduleInfo.icon, moduleInfo.name]
          )

        if (result.insertId > 0) {
          // 自动关联对应的菜单
          await this.autoLinkMenusToModule(moduleInfo.key)
        }

        await this.createModulePermissions(moduleInfo.key)

        return {
          success: true,
          message: `模块 ${moduleInfo.name} 注册成功`,
          module_key: moduleInfo.key,
          is_new_module: true,
          is_custom_name: false
        }
      }
    } catch (error) {
      log.error('注册模块失败:', error)
      return {
        success: false,
        message: `模块 ${moduleInfo.name} 注册失败: ${error.message}`,
        error: error
      }
    }
  }

  /**
   * 找到模块绑定的主菜单。菜单名称属于用户可见配置，优先于扫描出的默认名称。
   */
  async findBoundMenu(module, pool) {
    if (module?.menu_id) {
      const [menusById] = await pool.execute(
        'SELECT id, name FROM menus WHERE id = ? LIMIT 1',
        [module.menu_id]
      )
      if (menusById.length > 0) return menusById[0]
    }

    const [menusByModule] = await pool.execute(
      'SELECT id, name FROM menus WHERE module_id = ? ORDER BY id ASC LIMIT 1',
      [module.id]
    )
    if (menusByModule.length > 0) return menusByModule[0]

    if (module?.key) {
      const [menusByKey] = await pool.execute(
        'SELECT id, name FROM menus WHERE module_key = ? ORDER BY id ASC LIMIT 1',
        [module.key]
      )
      if (menusByKey.length > 0) return menusByKey[0]
    }

    return null
  }

  /**
   * 自动关联菜单到模块
   */
  async autoLinkMenusToModule(moduleKey) {
    try {
      const pool = getDatabase()

      const [modules] = await pool.execute(
        'SELECT id, `key`, name FROM modules WHERE is_active = 1'
      )
      const [menus] = await pool.execute(
        'SELECT id, name, url FROM menus WHERE (module_id IS NULL OR module_id = 0) AND is_active = 1'
      )

      // 与全量同步共用匹配规则，子模块不能因显示名称相同抢占主菜单。
      for (const menu of menus) {
        const matchedModule = this.menuLinker.findModuleForMenu(menu, modules)
        if (matchedModule?.key !== moduleKey) continue

        await pool.execute(
          'UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW() WHERE id = ? AND (module_id IS NULL OR module_id = 0)',
          [matchedModule.id, moduleKey, menu.id]
        )
        log.debug(`🔗 自动关联菜单 "${menu.name}" -> 模块 "${moduleKey}"`)
      }
    } catch (error) {
      log.error('自动关联菜单失败:', error)
    }
  }

  /**
   * 为模块创建基础权限 (智能增量更新版本)
   */
  async createModulePermissions(moduleKey) {
    try {
      const pool = getDatabase()

      // 获取所有角色
      const [roles] = await pool.execute(
        'SELECT id, name, code, role_type FROM roles WHERE is_active = 1'
      )

      // 获取该模块现有的权限
      const [existingPermissions] = await pool.execute(
        'SELECT role_id, permission_type FROM role_permissions WHERE module_key = ?',
        [moduleKey]
      )
      const existingPermissionKeys = new Set(
        existingPermissions.map(permission => `${permission.role_id}:${permission.permission_type}`)
      )

      const basePermissions = [
        'menu_view',
        ...getModulePermissionTypes(moduleKey)
      ].map(type => ({ type }))

      let totalCreated = 0

      // 管理员自动获得真实能力；普通角色必须在权限管理中明确授权。
      for (const role of roles) {
        const isAdministrator = role.role_type === 'admin' || ['super_admin', 'webadmin', 'admin'].includes(role.code)
        const rolePermissions = isAdministrator
          ? basePermissions.map(permission => permission.type)
          : []

        for (const permissionType of rolePermissions) {
          const permissionKey = `${role.id}:${permissionType}`
          if (!existingPermissionKeys.has(permissionKey)) {
            await pool.execute(
              'INSERT IGNORE INTO role_permissions (role_id, module_key, permission_type, created_at) VALUES (?, ?, ?, NOW())',
              [role.id, moduleKey, permissionType]
            )
            existingPermissionKeys.add(permissionKey)
            totalCreated++
          }
        }
      }

      log.debug(`✅ 模块 ${moduleKey} 权限创建成功，新增 ${totalCreated} 个权限分配 (涉及 ${roles.length} 个角色)`)
    } catch (error) {
      log.error('❌ 创建模块权限失败:', error)
    }
  }

  /**
   * 自动修复所有菜单与模块的关联
   * 在扫描模块后自动调用，确保菜单正确关联到最新的模块
   */
  async autoFixAllMenuLinks() {
    try {
      const result = await this.menuLinker.syncAllMenusToModules()
      return {
        success: result.success,
        updatedCount: result.linked + result.corrected,
        addedPermissionCount: 0
      }

    } catch (error) {
      log.error('❌ 自动修复菜单关联失败:', error)
      throw error
    }
  }
}

module.exports = ModuleScanner
