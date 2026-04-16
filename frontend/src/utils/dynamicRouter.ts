import type { Router, RouteRecordRaw } from 'vue-router'
import { menuApi } from '@/api/menu'
import type { MenuItem } from '@/types/menu'
import { storage } from '@/services/storage'
import { PermissionUtils } from '@/utils/permissionMapper'
import { logger } from '@/utils/logger'

type RouteComponentLoader = () => Promise<unknown>

type DynamicMenuItem = Omit<MenuItem, 'children' | 'menu_type'> & {
  permission?: string
  redirect?: string
  status?: number
  menuType?: string
  parent?: DynamicMenuItem | null
  children?: DynamicMenuItem[]
  menu_type?: string
}

const ROUTE_NAME_MAP: Record<string, string> = {
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

const DEFAULT_LAYOUT_COMPONENT = () => import('@/views/system/page/SimpleAdminView.vue')

const COMPONENT_MAP: Record<string, RouteComponentLoader> = {
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
  '/1/': () => import('@/views/brands/BrandsView.vue')
}

class DynamicRouter {
  private routes: RouteRecordRaw[] = []
  private menuMap = new Map<string, DynamicMenuItem>()

  async loadMenus(): Promise<DynamicMenuItem[]> {
    try {
      const token = storage.getToken()

      if (!token || token === 'dev-signature') {
        return []
      }

      const response = await menuApi.getUserMenus()
      let menus: DynamicMenuItem[] = []

      if (Array.isArray(response.data)) {
        menus = response.data as DynamicMenuItem[]
      } else if (response.success && Array.isArray(response.data)) {
        menus = response.data as DynamicMenuItem[]
      }

      this.menuMap.clear()
      this.flattenMenus(menus)
      return menus
    } catch (error) {
      logger.error('加载菜单失败:', error)
      return []
    }
  }

  flattenMenus(menus: DynamicMenuItem[], parent: DynamicMenuItem | null = null): void {
    menus.forEach((menu) => {
      const menuData: DynamicMenuItem = {
        ...menu,
        title: menu.name || menu.title,
        path: menu.url || menu.path,
        menu_type: menu.children && menu.children.length > 0 ? 'directory' : 'menu',
        parent
      }

      if (menuData.path) {
        this.menuMap.set(menuData.path, menuData)
      }

      if (menuData.children && menuData.children.length > 0) {
        this.flattenMenus(menuData.children, menuData)
      }
    })
  }

  generateRoutes(menus: DynamicMenuItem[]): RouteRecordRaw[] {
    const routes: RouteRecordRaw[] = []

    menus.forEach((menu) => {
      if (!menu.path) {
        return
      }

      if (menu.menu_type === 'menu') {
        const route = {
          path: menu.path,
          name: this.generateRouteName(menu.title || menu.name || menu.path),
          component: this.getComponentForPath(menu.path),
          ...(menu.redirect ? { redirect: menu.redirect } : {}),
          ...(menu.children && menu.children.length > 0
            ? { children: this.generateRoutes(menu.children) }
            : {}),
          meta: {
            title: menu.title || menu.name,
            icon: menu.icon || 'fas fa-circle',
            hidden: menu.status === 0,
            requiresAuth: true
          }
        } as RouteRecordRaw

        routes.push(route)
        return
      }

      if (menu.menu_type === 'directory' && menu.children && menu.children.length > 0) {
        routes.push({
          path: menu.path,
          name: this.generateRouteName(menu.title || menu.name || menu.path),
          component: DEFAULT_LAYOUT_COMPONENT,
          meta: {
            title: menu.title || menu.name,
            icon: menu.icon || 'fas fa-folder',
            hidden: menu.status === 0,
            requiresAuth: true
          },
          children: this.generateRoutes(menu.children)
        })
        return
      }

      if (menu.menu_type === 'directory') {
        routes.push({
          path: menu.path,
          name: this.generateRouteName(menu.title || menu.name || menu.path),
          component: this.getComponentForPath(menu.path),
          meta: {
            title: menu.title || menu.name,
            icon: menu.icon || 'fas fa-folder',
            hidden: menu.status === 0,
            requiresAuth: true
          }
        })
      }
    })

    this.routes = routes
    return routes
  }

  generateRouteName(title: string): string {
    return ROUTE_NAME_MAP[title] || title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
  }

  getComponentForPath(path: string): RouteComponentLoader {
    if (COMPONENT_MAP[path]) {
      return COMPONENT_MAP[path]
    }

    const cleanPath = path.replace(/\/$/, '')
    if (COMPONENT_MAP[`${cleanPath}/`]) {
      return COMPONENT_MAP[`${cleanPath}/`]
    }

    if (/^\/\d+\/?$/.test(path)) {
      if (path === '/1/') {
        return () => import('@/views/brands/BrandsView.vue')
      }
      return DEFAULT_LAYOUT_COMPONENT
    }

    logger.warn(`未找到路径对应的组件: ${path}，使用默认组件`)
    return DEFAULT_LAYOUT_COMPONENT
  }

  getComponent(componentPath?: string): RouteComponentLoader {
    if (!componentPath) {
      return DEFAULT_LAYOUT_COMPONENT
    }

    let importPath = componentPath

    if (!componentPath.startsWith('@/') && !componentPath.startsWith('/')) {
      importPath = `@/views/${componentPath}.vue`
    } else if (componentPath.startsWith('/')) {
      importPath = `@/views${componentPath}.vue`
    }

    try {
      return () => import(/* @vite-ignore */ importPath)
    } catch (error) {
      logger.warn(`组件加载失败: ${importPath}`, error)
      return DEFAULT_LAYOUT_COMPONENT
    }
  }

  async addDynamicRoutes(router: Router): Promise<RouteRecordRaw[] | void> {
    try {
      const menus = await this.loadMenus()

      if (menus.length === 0) {
        return
      }

      const dynamicRoutes = this.generateRoutes(menus)

      dynamicRoutes.forEach((route) => {
        const routeName = typeof route.name === 'string' ? route.name : ''
        const routePath = typeof route.path === 'string' ? route.path : ''
        const cleanPath = routePath.startsWith('/') ? routePath.substring(1) : routePath

        if (!routeName || router.hasRoute(routeName)) {
          return
        }

        if (router.hasRoute('SimpleAdminView')) {
          router.addRoute('SimpleAdminView', {
            ...route,
            path: cleanPath
          })
        }
      })

      return dynamicRoutes
    } catch (error) {
      logger.error('添加动态路由失败:', error)
      return
    }
  }

  hasRoutePermission(path: string, userPermissions: string[] = []): boolean {
    const menu = this.menuMap.get(path)

    if (!menu) {
      return false
    }

    if (!menu.permission) {
      return true
    }

    return PermissionUtils.hasPermission(userPermissions, menu.permission)
  }

  getBreadcrumb(path: string): Array<{ title: string; path?: string }> {
    const breadcrumb: Array<{ title: string; path?: string }> = []
    let currentMenu = this.menuMap.get(path)

    while (currentMenu) {
      breadcrumb.unshift({
        title: currentMenu.title || currentMenu.name || '',
        path: currentMenu.path
      })
      currentMenu = currentMenu.parent ?? undefined
    }

    return breadcrumb
  }

  clearCache(): void {
    this.routes = []
    this.menuMap.clear()
  }

  getAllPaths(): string[] {
    return Array.from(this.menuMap.keys())
  }

  filterMenusByPermission(menus: DynamicMenuItem[], userPermissions: string[] = []): DynamicMenuItem[] {
    return menus
      .filter((menu) => {
        if (menu.permission && !PermissionUtils.hasPermission(userPermissions, menu.permission)) {
          return false
        }
        return true
      })
      .map((menu) => {
        const nextMenu: DynamicMenuItem = { ...menu }

        if (nextMenu.children && nextMenu.children.length > 0) {
          nextMenu.children = this.filterMenusByPermission(nextMenu.children, userPermissions)
          if (nextMenu.menuType !== 'directory' && nextMenu.children.length === 0) {
            return { ...nextMenu, __hidden: true } as DynamicMenuItem & { __hidden: true }
          }
        }

        return nextMenu
      })
      .filter((menu) => !(menu as DynamicMenuItem & { __hidden?: boolean }).__hidden)
  }
}

export const dynamicRouter = new DynamicRouter()

export async function initDynamicRoutes(router: Router): Promise<void> {
  try {
    await dynamicRouter.addDynamicRoutes(router)
  } catch (error) {
    logger.error('初始化动态路由失败:', error)
  }
}

export default dynamicRouter
