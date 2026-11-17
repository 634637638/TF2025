import { getCurrentInstance, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { DASHBOARD_SHORTCUT_ACTIONS, hasShortcutActionPermission } from '@/utils/dashboard-shortcuts'

/** 消费受控的弹窗路由参数，兼容异步子组件及 KeepAlive；打开仍由原页面权限约束。 */
export function useRouteDialog(options: {
  path: string
  flag: string
  value?: string
  allowed: () => boolean
  ready?: () => boolean
  open: () => void | Promise<void>
}) {
  const route = useRoute()
  const router = useRouter()
  let consuming = false
  let active = true
  onBeforeUnmount(() => { active = false })
  const consume = async () => {
    if (!active || consuming || route.path !== options.path || route.query[options.flag] !== (options.value ?? 'true')) return
    if (options.ready && !options.ready()) return
    consuming = true
    const allowed = options.allowed()
    const query = { ...route.query }
    delete query[options.flag]
    try {
      const failure = await router.replace({ path: route.path, query, hash: route.hash })
      if (failure) return
      if (active && allowed && route.path === options.path && options.allowed()) await options.open()
    } catch (error) {
      logger.warn('处理快捷功能入口失败:', error)
    } finally {
      consuming = false
    }
  }
  watch([() => route.fullPath, options.allowed, () => options.ready?.() ?? true], () => { void consume() }, { immediate: true, flush: 'post' })
  onActivated(() => { void consume() })
}

/** 页面显式绑定原有入口；登记表只描述导航，不允许配置执行任意函数或业务提交。 */
export function usePageShortcuts(path: string, handlers: Record<string, {
  open: () => void | Promise<void>
  allowed?: () => boolean
  ready?: () => boolean
}>) {
  // 页面也可作为无路由的独立业务片段挂载；此时不消费站内导航参数。
  if (!getCurrentInstance()?.appContext.config.globalProperties.$router) return
  const auth = useAuthStore()
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })
  for (const action of DASHBOARD_SHORTCUT_ACTIONS) {
    const handler = action.path === path ? handlers[action.id] : undefined
    if (!handler) continue
    useRouteDialog({
      path,
      flag: 'shortcut',
      value: action.id,
      allowed: () => canAccessRoutePath(path, auth) && hasShortcutActionPermission(action, auth) && (handler.allowed?.() ?? true),
      ready: () => mounted.value && !fieldPermissions.loading?.value && (handler.ready?.() ?? true),
      open: handler.open
    })
  }
}
