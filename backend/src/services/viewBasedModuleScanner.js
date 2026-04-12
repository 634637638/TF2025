/**
 * 基于 views 目录扫描的模块生成器
 * 扫描前端 views 目录下的所有 .vue 文件，自动生成模块配置
 */
const fs = require('fs');
const path = require('path');
const log = require('../utils/log');

class ViewBasedModuleScanner {
  constructor() {
    this.viewsPath = path.join(__dirname, '../../../frontend/src/views');
    this.routerPath = path.join(__dirname, '../../../frontend/src/router/index.ts');
    this.excludePatterns = [
      'demo',           // 演示文件
      'components',     // 组件目录
      'system/404.vue', // 404页面
      'auth/index.vue'  // 认证主页
    ];

    // 模块名称映射
    this.moduleNameMap = {
      // 客户管理
      'customers/CustomersView': '客户管理',
      'rentals/RentalsView': '租赁管理',
      'repairs/RepairsView': '维修管理',

      // 产品管理
      'phones/PhonesView': '手机管理',
      'accessories/AccessoriesView': '配件管理',
      'memories/MemoriesView': '内存管理',
      'brands/BrandsView': '品牌管理',
      'models/ModelsView': '型号管理',
      'colors/ColorsView': '颜色管理',

      // 库存管理
      'inventory/InventoryView': '库存查看',
      'inventory/StockInPage': '采购入库',

      // 销售管理
      'sales/SalesView': '销售管理',
      'sales/PhoneSaleView': '手机销售',
      'sales/EditPhoneView': '编辑销售',

      // 供应商管理
      'suppliers/SuppliersView': '供应商管理',
      'suppliers/SupplierManagementView': '供应商管理',

      // 门店管理
      'stores/StoresView': '店铺管理',

      // 员工管理
      'employees/EmployeesView': '员工管理',
      'users/UsersView': '用户管理',

      // 权限管理
      'permissions/PermissionsView': '权限管理',
      'permissions/ModuleManagementView': '模块管理',
      'permissions/FieldScannerView': '字段扫描',

      // 菜单管理
      'menu/MenuManagementView': '菜单管理',

      // 查询分析
      'analytics/AnalyticsView': '数据分析',
      'query/QueryView': '综合查询',

      // 系统管理
      'system/SystemView': '系统管理',
      'system/AdminView': '管理员页面',
      'system/SimpleAdminView': '管理后台',

      // 认证
      'auth/LoginViewSimple': '登录页面'
    };

    // 图标映射
    this.moduleIconMap = {
      '客户管理': 'fas fa-users',
      '租赁管理': 'fas fa-handshake',
      '维修管理': 'fas fa-tools',
      '手机管理': 'fas fa-mobile-alt',
      '配件管理': 'fas fa-puzzle-piece',
      '内存管理': 'fas fa-memory',
      '品牌管理': 'fas fa-trademark',
      '型号管理': 'fas fa-cube',
      '颜色管理': 'fas fa-palette',
      '库存查看': 'fas fa-warehouse',
      '采购入库': 'fas fa-boxes',
      '销售管理': 'fas fa-shopping-cart',
      '手机销售': 'fas fa-dollar-sign',
      '编辑销售': 'fas fa-edit',
      '供应商管理': 'fas fa-truck',
      '店铺管理': 'fas fa-store',
      '员工管理': 'fas fa-user-tie',
      '用户管理': 'fas fa-users-cog',
      '权限管理': 'fas fa-shield-alt',
      '模块管理': 'fas fa-cubes',
      '字段扫描': 'fas fa-database',
      '菜单管理': 'fas fa-bars',
      '数据分析': 'fas fa-chart-bar',
      '综合查询': 'fas fa-search',
      '系统管理': 'fas fa-cog',
      '管理员页面': 'fas fa-user-shield',
      '管理后台': 'fas fa-tachometer-alt',
      '登录页面': 'fas fa-sign-in-alt'
    };

    // 分类映射
    this.moduleCategoryMap = {
      '客户管理': '客户管理',
      '租赁管理': '客户管理',
      '维修管理': '客户管理',
      '手机管理': '产品管理',
      '配件管理': '产品管理',
      '内存管理': '产品管理',
      '品牌管理': '产品管理',
      '型号管理': '产品管理',
      '颜色管理': '产品管理',
      '库存查看': '库存管理',
      '采购入库': '库存管理',
      '销售管理': '销售管理',
      '手机销售': '销售管理',
      '编辑销售': '销售管理',
      '供应商管理': '供应链',
      '店铺管理': '基础设置',
      '员工管理': '人事管理',
      '用户管理': '人事管理',
      '权限管理': '系统管理',
      '模块管理': '系统管理',
      '字段扫描': '系统管理',
      '菜单管理': '系统管理',
      '数据分析': '报表分析',
      '综合查询': '报表分析',
      '系统管理': '系统管理',
      '管理员页面': '系统管理',
      '管理后台': '系统管理',
      '登录页面': '认证授权'
    };
  }

  /**
   * 扫描 views 目录，生成模块配置
   */
  scanViews() {
    log.debug('🔍 开始扫描 views 目录...\n');

    const modules = {};
    const scanQueue = [this.viewsPath];

    while (scanQueue.length > 0) {
      const currentPath = scanQueue.pop();
      const relativePath = path.relative(this.viewsPath, currentPath);

      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            // 如果是目录，加入扫描队列
            scanQueue.push(itemPath);
          } else if (item.endsWith('.vue')) {
            // 如果是 Vue 文件，处理模块
            const moduleInfo = this.processVueFile(itemPath, relativePath);
            if (moduleInfo) {
              modules[moduleInfo.moduleKey] = moduleInfo;
            }
          }
        }
      } catch (error) {
        log.warn(`⚠️ 无法读取目录 ${currentPath}:`, error.message);
      }
    }

    log.debug(`✅ 扫描完成，找到 ${Object.keys(modules).length} 个页面模块\n`);

    return modules;
  }

  /**
   * 处理单个 Vue 文件
   */
  processVueFile(filePath, relativePath) {
    // 构建相对路径（从 views 目录开始）
    const viewRelativePath = this.normalizeModulePath(path.relative(this.viewsPath, filePath));
    const moduleKey = this.generateModuleKey(viewRelativePath);

    // 检查是否应该排除
    if (this.shouldExclude(viewRelativePath)) {
      log.debug(`⏭️ 跳过系统页面: ${viewRelativePath}`);
      return null;
    }

    // 提取文件名（不含扩展名）
    const fileName = path.basename(filePath, '.vue');

    // 生成模块信息
    const moduleInfo = {
      moduleKey: moduleKey,
      filePath: viewRelativePath,
      fileName: fileName,
      moduleName: this.getModuleName(viewRelativePath),
      moduleIcon: this.getModuleIcon(viewRelativePath),
      moduleCategory: this.getModuleCategory(viewRelativePath)
    };

    log.debug(`✓ 发现模块: ${moduleInfo.moduleKey} (${moduleInfo.moduleName})`);

    return moduleInfo;
  }

  /**
   * 生成模块 key
   */
  generateModuleKey(viewRelativePath) {
    // 移除 .vue 扩展名
    const withoutExt = viewRelativePath.replace('.vue', '');

    // 将路径转换为模块 key
    // 例如: inventory/InventoryView.vue -> inventory
    // 例如: inventory/StockInPage.vue -> inventory_stockinpage
    const parts = withoutExt.split('/').filter(Boolean);

    if (parts.length === 1) {
      // 根目录文件
      return parts[0].toLowerCase();
    } else {
      // 子目录文件
      const dir = parts[0];
      const file = parts[1];

      // 如果文件名包含目录名（如 InventoryView），只使用目录名
      if (file.toLowerCase().includes(dir.toLowerCase())) {
        return dir.toLowerCase();
      } else {
        // 否则组合目录名和文件名
        return `${dir}_${file.toLowerCase()}`;
      }
    }
  }

  /**
   * 获取模块名称
   */
  getModuleName(viewRelativePath) {
    const withoutExt = viewRelativePath.replace('.vue', '');

    // 优先使用映射表中的名称
    if (this.moduleNameMap[withoutExt]) {
      return this.moduleNameMap[withoutExt];
    }

    // 否则根据文件名生成
    const parts = withoutExt.split('/');
    const fileName = parts[parts.length - 1];

    // 移除常见的后缀
    const cleanName = fileName.replace(/(View|Page|Component)$/g, '');

    // 简单的翻译映射
    const translations = {
      'Inventory': '库存',
      'StockIn': '入库',
      'Sales': '销售',
      'Purchase': '采购',
      'Brand': '品牌',
      'Model': '型号',
      'Color': '颜色',
      'Memory': '内存',
      'Phone': '手机',
      'Accessory': '配件',
      'Customer': '客户',
      'Supplier': '供应商',
      'Store': '店铺',
      'Employee': '员工',
      'User': '用户',
      'Permission': '权限',
      'Module': '模块',
      'Menu': '菜单',
      'System': '系统',
      'Admin': '管理',
      'Auth': '认证',
      'Login': '登录',
      'Dashboard': '仪表盘',
      'Report': '报表',
      'Analytics': '分析',
      'Query': '查询'
    };

    // 分割驼峰命名
    const words = cleanName.split(/(?=[A-Z])/);

    // 翻译每个单词
    const translatedWords = words.map(word => {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      return translations[capitalized] || translations[word] || word;
    });

    return translatedWords.join('');
  }

  /**
   * 获取模块图标
   */
  getModuleIcon(viewRelativePath) {
    const moduleName = this.getModuleName(viewRelativePath);
    return this.moduleIconMap[moduleName] || 'fas fa-file';
  }

  /**
   * 获取模块分类
   */
  getModuleCategory(viewRelativePath) {
    const moduleName = this.getModuleName(viewRelativePath);
    return this.moduleCategoryMap[moduleName] || '其他';
  }

  /**
   * 检查是否应该排除该文件
   */
  shouldExclude(viewRelativePath) {
    if (!this.shouldTreatAsModule(viewRelativePath)) {
      return true;
    }

    // 检查排除模式
    for (const pattern of this.excludePatterns) {
      if (viewRelativePath.includes(pattern)) {
        return true;
      }
    }

    // 排除以 _ 开头的文件和目录（通常是私有文件）
    const parts = viewRelativePath.split('/');
    for (const part of parts) {
      if (part.startsWith('_')) {
        return true;
      }
    }

    return false;
  }

  normalizeModulePath(viewRelativePath) {
    const normalizedPath = String(viewRelativePath || '').replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);

    if (parts.length >= 3 && parts[1] === 'page') {
      return [parts[0], parts[parts.length - 1]].join('/');
    }

    return normalizedPath;
  }

  getRouteComponentPaths() {
    try {
      const content = fs.readFileSync(this.routerPath, 'utf8');
      const matches = content.matchAll(/import\(['"]@\/views\/(.+?\.vue)['"]\)/g);
      return new Set(Array.from(matches, (match) => match[1].replace(/\\/g, '/')));
    } catch (error) {
      log.warn('⚠️ 读取路由定义失败，使用基础页面扫描模式:', error.message);
      return new Set();
    }
  }

  shouldTreatAsModule(viewRelativePath) {
    const normalizedPath = String(viewRelativePath || '').replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    const fileName = parts[parts.length - 1] || '';
    const category = parts[0] || '';

    if (parts.length === 2) {
      return true;
    }

    if (parts.length !== 3 || parts[1] !== 'page') {
      return false;
    }

    if (category === 'H5-mobile' || fileName === '404.vue') {
      return false;
    }

    const routeComponentPaths = this._routeComponentPaths || (this._routeComponentPaths = this.getRouteComponentPaths());
    if (!routeComponentPaths.has(normalizedPath)) {
      return false;
    }

    if (category === 'H5-admin' || fileName === 'GitManagement.vue') {
      return true;
    }

    return /(View|Page)\.vue$/i.test(fileName);
  }

  /**
   * 生成模块配置文件内容
   */
  generateModuleConfig(modules) {
    const config = {};

    // 按分类组织
    const categories = {};
    Object.values(modules).forEach(module => {
      if (!categories[module.moduleCategory]) {
        categories[module.moduleCategory] = [];
      }
      categories[module.moduleCategory].push(module);
    });

    // 生成配置
    Object.entries(categories).forEach(([category, moduleList]) => {
      log.debug(`\n【${category}】`);
      moduleList.forEach(module => {
        log.debug(`  - ${module.moduleKey}: ${module.moduleName}`);
      });
    });

    // 返回模块映射
    const moduleMappings = {};
    Object.values(modules).forEach(module => {
      moduleMappings[module.moduleKey] = {
        name: module.moduleName,
        icon: module.moduleIcon,
        category: module.moduleCategory,
        path: module.filePath,
        description: `${module.moduleName}页面`
      };
    });

    return moduleMappings;
  }

  /**
   * 保存模块配置到数据库
   */
  async saveToDatabase(modules, db) {
    log.debug('\n💾 开始保存模块到数据库...');

    for (const module of Object.values(modules)) {
      try {
        // 检查模块是否已存在
        const [existing] = await db.execute(`
          SELECT id FROM modules
          WHERE \`key\` = ?
        `, [module.moduleKey]);

        if (existing.length === 0) {
          // 插入新模块
          await db.execute(`
            INSERT INTO modules (
              \`key\`, name, description, category, icon,
              is_active, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, 0, NOW(), NOW())
          `, [
            module.moduleKey,
            module.moduleName,
            `${module.moduleName}页面`,
            module.moduleCategory,
            module.moduleIcon
          ]);

          log.debug(`✓ 创建模块: ${module.moduleKey}`);
        } else {
          // 更新现有模块
          await db.execute(`
            UPDATE modules SET
              name = ?,
              description = ?,
              category = ?,
              icon = ?,
              updated_at = NOW()
            WHERE \`key\` = ?
          `, [
            module.moduleName,
            `${module.moduleName}页面`,
            module.moduleCategory,
            module.moduleIcon,
            module.moduleKey
          ]);

          log.debug(`✓ 更新模块: ${module.moduleKey}`);
        }
      } catch (error) {
        log.error(`❌ 保存模块失败 ${module.moduleKey}:`, error.message);
      }
    }

    log.debug('\n✅ 模块保存完成！');
  }
}

module.exports = ViewBasedModuleScanner;
