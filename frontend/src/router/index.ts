import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setupRouterGuards } from './guards'
import { storage } from '@/services/storage'

// 滚动位置存储键前缀
const SCROLL_POSITION_PREFIX = 'scroll-pos_'

// 全部改为懒加载，减少首屏加载体积
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginViewSimple.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/system/page/404.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'SimpleAdminView',
    component: () => import('@/views/system/page/SimpleAdminView.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'DefaultRedirect',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: {
          title: '仪表盘',
          icon: 'fas fa-tachometer-alt'
        }
      },
      {
        path: 'suppliers',
        name: 'Suppliers',
        component: () => import('@/views/suppliers/SuppliersView.vue'),
        meta: {
          title: '供应商管理',
          icon: 'fas fa-truck'
        }
      },
      {
        path: 'payments',
        name: 'Payments',
        component: () => import('@/views/payments/SupplierPhonePaymentsView.vue'),
        meta: {
          title: '供应商打款',
          icon: 'fas fa-money-bill-wave'
        }
      },
      {
        path: 'system',
        name: 'System',
        component: () => import('@/views/system/SystemView.vue'),
        meta: {
          title: '系统管理',
          icon: 'fas fa-cog'
        }
      },
      {
        path: 'git-management',
        name: 'GitManagement',
        component: () => import('@/views/system/page/GitManagement.vue'),
        meta: {
          title: 'Git 管理',
          icon: 'fas fa-code-branch'
        }
      },
      {
        path: 'backup',
        name: 'Backup',
        component: () => import('@/views/backup/BackupView.vue'),
        meta: {
          title: '备份管理',
          icon: 'fas fa-cloud-download-alt'
        }
      },
      {
        path: 'data-optimization',
        name: 'DataOptimization',
        component: () => import('@/views/data-optimization/DataOptimizationView.vue'),
        meta: {
          title: '优化数据',
          icon: 'fas fa-tools'
        }
      },
      {
        path: 'menu',
        name: 'MenuManagement',
        component: () => import('@/views/menu/MenuManagementView.vue'),
        meta: {
          title: '菜单管理',
          icon: 'fas fa-grin-beam'
        }
      },
      {
        path: 'sales',
        name: 'Sales',
        component: () => import('@/views/sales/SalesView.vue'),
        meta: {
          title: '销售管理',
          icon: 'fas fa-store'
        }
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/models/ModelsView.vue'),
        meta: {
          title: '品牌型号',
          icon: 'fas fa-band-aid'
        }
      },
      {
        path: 'colors',
        name: 'Colors',
        component: () => import('@/views/colors/ColorsView.vue'),
        meta: {
          title: '颜色管理',
          icon: 'fas fa-palette'
        }
      },
      {
        path: 'memories',
        name: 'Memories',
        component: () => import('@/views/memories/MemoriesView.vue'),
        meta: {
          title: '内存管理',
          icon: 'fas fa-memory'
        }
      },
      {
        path: 'brands',
        name: 'Brands',
        component: () => import('@/views/brands/BrandsView.vue'),
        meta: {
          title: '品牌管理',
          icon: 'fas fa-trademark'
        }
      },
      {
        path: 'stores',
        name: 'Stores',
        component: () => import('@/views/stores/StoresView.vue'),
        meta: {
          title: '店铺管理',
          icon: 'fas fa-school'
        }
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('@/views/employees/EmployeesView.vue'),
        meta: {
          title: '员工管理',
          icon: 'fas fa-user-tie'
        }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/customers/CustomersView.vue'),
        meta: {
          title: '客户管理',
          icon: 'fas fa-users'
        }
      },
      {
        path: 'accessories',
        name: 'Accessories',
        component: () => import('@/views/accessories/AccessoriesView.vue'),
        meta: {
          title: '配件管理',
          icon: 'fas fa-tools'
        }
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/inventory/InventoryView.vue'),
        meta: {
          title: '库存管理',
          icon: 'fas fa-warehouse'
        }
      },
      {
        path: 'preorders',
        name: 'Preorders',
        component: () => import('@/views/preorders/PreordersView.vue'),
        meta: {
          title: '预定管理',
          icon: 'fas fa-calendar-check'
        }
      },
      {
        path: 'error-management',
        name: 'ErrorManagement',
        component: () => import('@/components/ErrorManagement/ErrorDashboardSimple.vue'),
        meta: {
          title: '错误管理',
          icon: 'fas fa-bug'
        }
      },
      {
        path: 'query',
        name: 'Query',
        component: () => import('@/views/query/QueryView.vue'),
        meta: {
          title: '综合查询',
          icon: 'fas fa-search'
        }
      },
      {
        path: 'permissions',
        name: 'Permissions',
        component: () => import('@/views/permissions/PermissionsView.vue'),
        meta: {
          title: '权限管理',
          icon: 'fas fa-shield-alt'
        }
      },
      {
        path: 'permissions/module-management',
        name: 'ModuleManagement',
        component: () => import('@/views/permissions/page/ModuleManagementView.vue'),
        meta: {
          title: '模块管理',
          icon: 'fas fa-cubes'
        }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('@/views/analytics/AnalyticsView.vue'),
        meta: {
          title: '数据分析',
          icon: 'fas fa-chart-bar'
        }
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('@/views/attendance/AttendanceView.vue'),
        meta: {
          title: '考勤管理',
          icon: 'fas fa-calendar-check'
        }
      },
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/salary/SalaryView.vue'),
        meta: {
          title: '工资管理',
          icon: 'fas fa-money-bill-wave'
        }
      },
      {
        path: 'subsidy',
        name: 'Subsidy',
        component: () => import('@/views/subsidy/SubsidyView.vue'),
        meta: {
          title: '国补管理',
          icon: 'fas fa-hand-holding-usd'
        }
      },
      {
        path: 'rentals',
        name: 'Rentals',
        component: () => import('@/views/rentals/RentalsView.vue'),
        meta: {
          title: '租赁管理',
          icon: 'fas fa-handshake'
        }
      },
      {
        path: 'repairs',
        name: 'Repairs',
        component: () => import('@/views/repairs/RepairsView.vue'),
        meta: {
          title: '维修管理',
          icon: 'fas fa-tools'
        }
      },
      {
        path: 'price-list',
        name: 'PriceList',
        component: () => import('@/views/price-list/PriceListView.vue'),
        meta: {
          title: '价目表管理',
          icon: 'fas fa-tags'
        }
      },
      {
        path: 'price-list/sync-logs',
        name: 'SyncLogs',
        component: () => import('@/views/price-list/page/SyncLogView.vue'),
        meta: {
          title: '同步日志',
          icon: 'fas fa-history'
        }
      },
      // H5商城管理路由（使用统一布局）
      {
        path: 'H5-admin',
        component: () => import('@/views/H5-admin/H5-adminView.vue'),
        redirect: '/H5-admin/page/config',
        children: [
          {
            path: 'page/templates',
            name: 'H5AdminTemplates',
            component: () => import('@/views/H5-admin/page/templates.vue'),
            meta: {
              title: 'H5商城管理 - 模板管理',
              icon: 'fas fa-store'
            }
          },
          {
            path: 'page/config',
            name: 'H5AdminConfig',
            component: () => import('@/views/H5-admin/page/config.vue'),
            meta: {
              title: 'H5商城管理 - 配置',
              icon: 'fas fa-cog'
            }
          },
          {
            path: 'page/home-sections',
            name: 'H5AdminHomeSections',
            component: () => import('@/views/H5-admin/page/home-sections.vue'),
            meta: {
              title: 'H5商城管理 - 首页推荐',
              icon: 'fas fa-home'
            }
          },
          {
            path: 'page/banners',
            name: 'H5AdminBanners',
            component: () => import('@/views/H5-admin/page/banners.vue'),
            meta: {
              title: 'H5商城管理 - 轮播图',
              icon: 'fas fa-images'
            }
          },
          {
            path: 'page/orders',
            name: 'H5AdminOrders',
            component: () => import('@/views/H5-admin/page/orders.vue'),
            meta: {
              title: 'H5商城管理 - 订单管理',
              icon: 'fas fa-receipt'
            }
          },
          {
            path: 'page/sold-products',
            name: 'H5AdminSoldProducts',
            component: () => import('@/views/H5-admin/page/SoldProductsView.vue'),
            meta: {
              title: 'H5商城管理 - 已售商品',
              icon: 'fas fa-check-circle'
            }
          }
        ]
      }
    ]
  },
  // 公开价格查询页面（无需登录）
  {
    path: '/price-query',
    name: 'PublicPriceQuery',
    component: () => import('@/views/price-list/page/PublicPriceQuery.vue'),
    meta: { requiresAuth: false }
  },
  // 销售报价页面（无需登录）
  {
    path: '/sales-price-display',
    name: 'SalesPriceDisplay',
    component: () => import('@/views/price-list/page/SalesPriceDisplay.vue'),
    meta: { requiresAuth: false }
  },
  // H5移动端路由（无需登录）
  {
    path: '/m',
    name: 'MobileLayout',
    component: () => import('@/views/H5-mobile/H5-mobileView.vue'),
    meta: { requiresAuth: false },
    children: [
      {
        path: '',
        name: 'MobileHome',
        component: () => import('@/views/H5-mobile/page/MobileHome.vue')
      },
      {
        path: 'products',
        name: 'MobileProducts',
        component: () => import('@/views/H5-mobile/page/ProductList.vue')
      },
      {
        path: 'product/new/:id',
        name: 'MobileAggregatedProduct',
        component: () => import('@/views/H5-mobile/page/AggregatedProductDetail.vue')
      },
      {
        path: 'product/:id',
        name: 'MobileProductDetail',
        component: () => import('@/views/H5-mobile/page/SmartProductDetail.vue')
      },
      {
        path: 'product',
        name: 'MobileAggregatedProductQuery',
        component: () => import('@/views/H5-mobile/page/AggregatedProductDetail.vue')
      },
      {
        path: 'cart',
        name: 'MobileCart',
        component: () => import('@/views/H5-mobile/page/Cart.vue')
      },
      {
        path: 'checkout',
        name: 'MobileCheckout',
        component: () => import('@/views/H5-mobile/page/Checkout.vue')
      },
      {
        path: 'order/success',
        name: 'MobileOrderSuccess',
        component: () => import('@/views/H5-mobile/page/OrderSuccess.vue')
      },
      {
        path: 'order/detail',
        name: 'MobileOrderDetailLegacy',
        component: () => import('@/views/H5-mobile/page/OrderDetail.vue')
      },
      {
        path: 'my-orders',
        name: 'MobileMyOrders',
        component: () => import('@/views/H5-mobile/page/MyOrders.vue')
      },
      {
        path: 'order-detail/:orderNumber',
        name: 'MobileOrderDetail',
        component: () => import('@/views/H5-mobile/page/OrderDetail.vue')
      },
      {
        path: 'order-query',
        name: 'MobileOrderQuery',
        component: () => import('@/views/H5-mobile/page/OrderQuery.vue')
      },
      {
        path: 'login',
        name: 'MobileLogin',
        component: () => import('@/views/H5-mobile/page/LoginView.vue')
      },
      {
        path: 'register',
        name: 'MobileRegister',
        component: () => import('@/views/H5-mobile/page/RegisterView.vue')
      },
      {
        path: 'my',
        name: 'MobileMy',
        component: () => import('@/views/H5-mobile/page/MyCenter.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => '/404'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // 移动端页面之间的导航，优先使用手动保存的滚动位置
        if (to.path.startsWith('/m')) {
          const scrollKey = `${SCROLL_POSITION_PREFIX}${to.path}`
          const savedScrollY = storage.get<string>(scrollKey, 'session')

          if (savedScrollY !== null) {
            const scrollY = parseInt(savedScrollY, 10)
            // 延迟执行滚动，确保组件已完全挂载
            setTimeout(() => {
              window.scrollTo({ top: scrollY, behavior: 'auto' })
            }, 50)
            // 不立即删除，让组件自己决定何时删除
            resolve(false) // 阻止默认滚动
            return
          }
        }

        // 如果没有手动保存的位置，使用浏览器保存的位置或默认行为
        if (savedPosition) {
          resolve(savedPosition)
        } else if (to.hash) {
          resolve({ el: to.hash, behavior: 'smooth' })
        } else if (to.path.startsWith('/m')) {
          resolve(false) // 移动端保持当前位置
        } else {
          resolve({ top: 0 })
        }
      }, 100) // 延迟执行，确保 DOM 已更新
    })
  }
})

// 监听路由变化，在离开移动端页面前保存滚动位置到 sessionStorage
router.beforeEach((_to, from, next) => {
  // 保存滚动位置到 sessionStorage（包括 0）
  if (from.path.startsWith('/m')) {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
    const scrollKey = `${SCROLL_POSITION_PREFIX}${from.path}`
    storage.set(scrollKey, scrollY.toString(), 'session')
  }
  next()
})

// 启用路由守卫
const guardManager = setupRouterGuards(router)

// 导出路由守卫管理器实例
export { guardManager }

export default router
