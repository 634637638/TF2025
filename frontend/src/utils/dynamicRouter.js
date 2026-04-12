import { menuApi } from '@/api/menu'
import { storage } from '@/composables/core/useLocalStorage'
import { PermissionUtils } from '@/utils/permissionMapper'
import { logger } from '@/utils/logger'

/**
 * 动态路由管理工具
 * 用于从数据库加载菜单配置并动态生成路由
 */

class DynamicRouter {
  constructor() {
    this.routes = []
    this.menuMap = new Map()
  }

  /**
   * 从后端加载菜单数据
   */
  async loadMenus() {
    try {
      // 使用统一存储服务获取 token
      const token = storage.getToken()

      if (!token || token === 'dev-signature') {
        return []
      }

      const response = await menuApi.getUserMenus()

      // 适配后端数据结构
      let menus = []
      if (response.data && Array.isArray(response.data)) {
        menus = response.data
      } else if (response.success && response.data) {
        menus = response.data
      }

      this.menuMap.clear()

      // 将菜单数据存储到Map中，方便查找
      this.flattenMenus(menus)

      return menus
    } catch (error) {
      logger.error('加载菜单失败:', error)
      return []
    }
  }

  /**
   * 将嵌套的菜单结构扁平化
   */
  flattenMenus(menus, parent = null) {
    menus.forEach(menu => {
      // 适配后端字段名到前端期望的字段名
      const menuData = {
        ...menu,
        title: menu.name || menu.title, // 后端使用 name，前端期望 title
        path: menu.url || menu.path,   // 后端使用 url，前端期望 path
        menu_type: menu.children && menu.children.length > 0 ? 'directory' : 'menu',
        parent
      }

      this.menuMap.set(menuData.path, menuData)

      if (menuData.children && menuData.children.length > 0) {
        this.flattenMenus(menuData.children, menuData)
      }
    })
  }

  /**
   * 将菜单数据转换为路由配置
   */
  generateRoutes(menus) {
    const routes = []

    menus.forEach(menu => {
      // 处理菜单项类型：处理有实际页面的菜单项，以及有路径的目录类型菜单
      if (menu.menu_type === 'menu' && menu.path) {
        const route = {
          path: menu.path,
          name: this.generateRouteName(menu.title),
          component: this.getComponentForPath(menu.path),
          meta: {
            title: menu.title,
            icon: menu.icon || 'fas fa-circle',
            hidden: menu.status === 0, // 状态为0表示隐藏
            requiresAuth: true
          }
        }

        // 如果有重定向
        if (menu.redirect) {
          route.redirect = menu.redirect
        }

        // 递归处理子菜单
        if (menu.children && menu.children.length > 0) {
          route.children = this.generateRoutes(menu.children)
        }

        routes.push(route)
      } else if (menu.menu_type === 'directory' && menu.path && (!menu.children || menu.children.length === 0)) {
        // 处理没有子菜单但有路径的目录类型菜单（如权限管理）
        const route = {
          path: menu.path,
          name: this.generateRouteName(menu.title),
          component: this.getComponentForPath(menu.path),
          meta: {
            title: menu.title,
            icon: menu.icon || 'fas fa-folder',
            hidden: menu.status === 0,
            requiresAuth: true
          }
        }
        routes.push(route)
      } else if (menu.menu_type === 'directory' && menu.children && menu.children.length > 0) {
        // 目录类型，处理子菜单
        const parentRoute = {
          path: menu.path,
          name: this.generateRouteName(menu.title),
          component: () => import('@/views/AdminView.vue'), // 目录使用默认布局
          meta: {
            title: menu.title,
            icon: menu.icon || 'fas fa-folder',
            hidden: menu.status === 0,
            requiresAuth: true
          },
          children: this.generateRoutes(menu.children)
        }

        routes.push(parentRoute)
      }
    })

    return routes
  }

  /**
   * 生成路由名称
   */
  generateRouteName(title) {
    // 将中文标题转换为英文路由名称
    const nameMap = {
      '仪表盘': 'Dashboard',
      '销售管理': 'Sales',
      '采购入库': 'Purchases',
      '供应商管理': 'Suppliers',
      '员工管理': 'Employees',
      '系统管理': 'System',
      '菜单管理': 'Menu',
      '品牌管理': 'Brands',
      '型号管理': 'Models',
      '颜色管理': 'Colors',
      '内存管理': 'Memories',
      '店铺管理': 'Stores',
      '综合查询': 'Search',
      '配件管理': 'Accessories',
      '租赁管理': 'Rentals',
      '数据分析': 'Analytics',
      '权限管理': 'Permissions'
    }

    return nameMap[title] || title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
  }

  /**
   * 根据路径获取对应的组件
   */
  getComponentForPath(path) {
    // 路径到组件的映射
    const componentMap = {
      '/dashboard/': () => import('@/views/dashboard/DashboardView.vue'),
      '/sales/': () => import('@/views/sales/SalesView.vue'),
      '/suppliers/': () => import('@/views/suppliers/SuppliersView.vue'),
      '/employees': () => import('@/views/employees/EmployeesView.vue'),
      '/system/': () => import('@/views/system/SystemView.vue'),
      '/menu/': () => import('@/views/menu/MenuManagementView.vue'),
      '/brands': () => import('@/views/brands/BrandsView.vue'),
      '/models': () => import('@/views/models/ModelsView.vue'),
      '/colors': () => import('@/views/colors/ColorsView.vue'),
      '/memories': () => import('@/views/memories/MemoriesView.vue'),
      '/stores/': () => import('@/views/stores/StoresView.vue'),
      '/query': () => import('@/views/query/QueryView.vue'),
      '/inventory': () => import('@/views/inventory/InventoryView.vue'),
      '/customers': () => import('@/views/customers/CustomersView.vue'),
      '/permissions': () => import('@/views/permissions/PermissionsView.vue'),
      '/permissions/module-management': () => import('@/views/permissions/page/ModuleManagementView.vue'),
      // 添加可能来自数据库的数字路径映射
      '/1/': () => import('@/views/brands/BrandsView.vue') // 品牌型号 - 默认显示品牌页面
    }

    // 精确匹配或模糊匹配
    if (componentMap[path]) {
      return componentMap[path]
    }

    // 尝试移除末尾斜杠进行匹配
    const cleanPath = path.replace(/\/$/, '')
    if (componentMap[cleanPath + '/']) {
      return componentMap[cleanPath + '/']
    }

    // 特殊处理数字路径，需要检查是否是特定的业务路径
    if (/^\/\d+\/?$/.test(path)) {
      // 检查是否是品牌型号相关的路径
      if (path === '/1/') {
        // 品牌型号目录，应该导航到具体的子页面
        return () => import('@/views/brands/BrandsView.vue')
      }
      return () => import('@/views/AdminView.vue')
    }

    logger.warn(`未找到路径对应的组件: ${path}，使用默认组件`)
    return () => import('@/views/AdminView.vue')
  }

  /**
   * 动态加载组件
   */
  getComponent(componentPath) {
    if (!componentPath) {
      return () => import('@/views/AdminView.vue')
    }

    // 处理组件路径
    let importPath = componentPath

    // 如果不是完整路径，添加默认的views目录
    if (!componentPath.startsWith('@/') && !componentPath.startsWith('/')) {
      importPath = `@/views/${componentPath}.vue`
    } else if (componentPath.startsWith('/')) {
      importPath = `@/views${componentPath}.vue`
    }

    // 返回动态导入的组件
    try {
      return () => import(/* @vite-ignore */ importPath)
    } catch (error) {
      logger.warn(`组件加载失败: ${importPath}`, error)
      return () => import('@/views/AdminView.vue')
    }
  }

  /**
   * 动态添加路由
   */
  async addDynamicRoutes(router) {
    try {
      // 加载菜单数据
      const menus = await this.loadMenus()

      if (!menus || menus.length === 0) {
        return
      }

      // 生成路由配置
      const dynamicRoutes = this.generateRoutes(menus)

      // 添加路由到 SimpleAdminView 父路由下
      dynamicRoutes.forEach(route => {
        // 清理路径，移除开头的斜杠以便作为子路由
        const cleanPath = route.path.startsWith('/') ? route.path.substring(1) : route.path

        if (router.hasRoute(route.name)) {
          return
        }

        // 检查父路由是否存在
        if (router.hasRoute('SimpleAdminView')) {
          const childRoute = {
            ...route,
            path: cleanPath
          }
          router.addRoute('SimpleAdminView', childRoute)
        }
      })

      return dynamicRoutes
    } catch (error) {
      // 添加动态路由失败，静默处理
    }
  }

  /**
   * 检查用户是否有权限访问路由
   */
  hasRoutePermission(path, userPermissions = []) {
    const menu = this.menuMap.get(path)

    if (!menu) {
      return false
    }

    // 如果没有设置权限标识，默认允许访问
    if (!menu.permission) {
      return true
    }

    // 检查用户是否有对应权限
    return PermissionUtils.hasPermission(userPermissions, menu.permission)
  }

  /**
   * 获取面包屑导航
   */
  getBreadcrumb(path) {
    const breadcrumb = []
    let currentMenu = this.menuMap.get(path)

    while (currentMenu) {
      breadcrumb.unshift({
        title: currentMenu.title,
        path: currentMenu.path
      })
      currentMenu = currentMenu.parent
    }

    return breadcrumb
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.routes = []
    this.menuMap.clear()
  }

  /**
   * 获取所有菜单路径
   */
  getAllPaths() {
    return Array.from(this.menuMap.keys())
  }

  /**
   * 根据权限过滤菜单
   */
  filterMenusByPermission(menus, userPermissions = []) {
    return menus.filter(menu => {
      // 检查当前菜单权限
      if (menu.permission && !PermissionUtils.hasPermission(userPermissions, menu.permission)) {
        return false
      }

      // 递归检查子菜单权限
      if (menu.children && menu.children.length > 0) {
        menu.children = this.filterMenusByPermission(menu.children, userPermissions)
        // 如果子菜单被全部过滤掉了，当前菜单也不显示（除非是目录类型）
        if (menu.menuType !== 'directory' && menu.children.length === 0) {
          return false
        }
      }

      return true
    })
  }
}

// 创建单例
export const dynamicRouter = new DynamicRouter()

/**
 * 初始化动态路由
 */
export async function initDynamicRoutes(router) {
  try {
    await dynamicRouter.addDynamicRoutes(router)
  } catch (error) {
    logger.error('初始化动态路由失败:', error)
  }
}

export default dynamicRouter
