<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="dashboard"
    module-name="仪表盘"
    permission-code="dashboard:view"
  >
    <div class="dashboard admin-page safe-area-top safe-area-bottom">
      <div class="dashboard-content admin-page-content">
        <PageHeader title="仪表盘">
          <template #actions>
            <el-button
              v-if="shouldShowActionColumn(canViewField('system_info.operations'), [])"
              type="info"
              :loading="isRefreshing"
              :disabled="isRefreshing"
              @click="refreshData"
            >
              <i class="fas fa-sync-alt" />
              刷新数据
            </el-button>
          </template>
        </PageHeader>

        <SectionLoading
          v-if="isLoading"
          text="加载中..."
          size="large"
        />

        <div
          v-else
          class="dashboard-grid"
        >
          <!-- 统计卡片 -->
          <div class="stats-grid stats-cards">
            <div
              v-if="canViewField('stats.today_sales')"
              class="stat-card stat-card--income"
              @click="showDetails('sales')"
            >
              <div class="stat-icon">
                <i class="fas fa-shopping-cart" />
              </div>
              <div class="stat-content">
                <h3>今日销售</h3>
                <p class="stat-number stat-value--income">
                  ¥{{ todaySales }}
                </p>
              </div>
            </div>

            <div
              v-if="canViewField('stats.total_customers')"
              class="stat-card stat-card--info"
              @click="showDetails('customers')"
            >
              <div class="stat-icon">
                <i class="fas fa-users" />
              </div>
              <div class="stat-content">
                <h3>客户总数</h3>
                <p class="stat-number">
                  {{ totalCustomers }}
                </p>
              </div>
            </div>

            <div
              v-if="canViewField('stats.total_products')"
              class="stat-card stat-card--primary"
              @click="showDetails('inventory')"
            >
              <div class="stat-icon">
                <i class="fas fa-boxes" />
              </div>
              <div class="stat-content">
                <h3>库存商品</h3>
                <p class="stat-number">
                  {{ totalProducts }}
                </p>
                <div
                  v-if="inventoryAlert && canViewField('stats.inventory_alert')"
                  class="inventory-warning"
                >
                  <i class="fas fa-exclamation-triangle" />
                  库存预警
                </div>
              </div>
            </div>

            <div
              v-if="canViewField('stats.pending_repairs')"
              class="stat-card stat-card--warning"
              @click="showDetails('repairs')"
            >
              <div class="stat-icon">
                <i class="fas fa-tools" />
              </div>
              <div class="stat-content">
                <h3>待维修</h3>
                <p class="stat-number">
                  {{ pendingRepairs }}
                </p>
                <div
                  v-if="urgentRepairs > 0 && canViewField('stats.urgent_repairs')"
                  class="urgent-repairs"
                >
                  <i class="fas fa-bolt" />
                  {{ urgentRepairs }} 项紧急
                </div>
              </div>
            </div>
          </div>

          <!-- 综合预警 -->
          <ComprehensiveWarnings v-if="canViewField('warnings.comprehensive')" />

          <!-- 待审批提醒 -->
          <PendingApprovals
            v-if="canViewField('warnings.pending_approvals')"
            ref="pendingApprovementsRef"
          />

          <!-- 快速操作 -->
          <div
            v-if="canViewField('actions.quick_actions')"
            class="quick-actions dashboard-card"
          >
            <h2>快速操作</h2>
            <div class="actions-grid">
              <el-button
                type="default"
                class="action-btn"
                @click="goToSales"
              >
                <i class="fas fa-plus" />
                新建销售
              </el-button>
              <el-button
                type="default"
                class="action-btn"
                @click="addCustomer"
              >
                <i class="fas fa-user-plus" />
                添加客户
              </el-button>
              <el-button
                type="default"
                class="action-btn"
                @click="goToInventory"
              >
                <i class="fas fa-box" />
                库存管理
              </el-button>
              <el-button
                type="default"
                class="action-btn"
                @click="goToRepairs"
              >
                <i class="fas fa-wrench" />
                维修管理
              </el-button>
            </div>
          </div>

          <!-- 最近活动 -->
          <div
            v-if="canViewField('activities.recent')"
            class="recent-activity dashboard-card"
          >
            <div class="activity-header">
              <h2>最近活动</h2>
            </div>
            <div class="activity-list">
              <div
                v-for="activity in recentActivities"
                :key="activity.id"
                class="activity-item"
              >
                <div
                  class="activity-icon"
                  :class="activity.type"
                >
                  <i :class="activity.icon" />
                </div>
                <div class="activity-content">
                  <p>{{ activity.description }}</p>
                  <span class="activity-time">{{ activity.time }}</span>
                </div>
              </div>
              <DataEmptyState
                v-if="recentActivities.length === 0"
                description="暂无近期活动"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'

import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { PageHeader, PermissionGate } from '@/components/base'
import SectionLoading from '@/components/SectionLoading.vue'
import ComprehensiveWarnings from '@/components/ComprehensiveWarnings.vue'
import PendingApprovals from '@/components/PendingApprovals.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
const globalNotifications = useNotification()


// 使用通知服务
const {
  success,
  error,
  warning,
  info,
  confirm,
  handleApiError,
  handleApiSuccess: _handleApiSuccess
} = useNotification()

const router = useRouter()
const authStore = useAuthStore()
const { canView } = usePagePermissions('dashboard')
const DASHBOARD_MODULE_KEY = 'dashboard'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(DASHBOARD_MODULE_KEY, fieldKey)

// 待审批提醒组件引用
const pendingApprovementsRef = ref<InstanceType<typeof PendingApprovals> | null>(null)

// 使用站点设置store
const siteSettingsStore = useSiteSettingsStore()

// 响应式数据
const todaySales = ref('0')
const totalCustomers = ref('0')
const totalProducts = ref('0')
const pendingRepairs = ref('0')
const urgentRepairs = ref(0)
const { loading: isLoading } = useLoadingState()
const { loading: isRefreshing } = useLoadingState()
const lastUpdateTime = ref('')
const inventoryAlert = ref(false)
let dashboardRefreshTimer: ReturnType<typeof setInterval> | null = null

// 缓存键
const CACHE_KEYS = {
  dashboard: '/dashboard',
  recentActivities: '/dashboard/activities'
}

type DashboardActivityType = 'sales' | 'customer' | 'inventory' | 'repair'

interface DashboardActivity {
  id: string
  type: DashboardActivityType
  icon: string
  description: string
  time: string
}

interface DashboardActivityApiRecord {
  id?: string | number
  type?: string
  icon?: string
  description?: string
  occurred_at?: string
}

const recentActivities = ref<DashboardActivity[]>([])

const normalizeRecentActivities = (payload: unknown): DashboardActivity[] => {
  if (!Array.isArray(payload)) return []

  return payload
    .filter((activity): activity is DashboardActivityApiRecord => (
      activity !== null && typeof activity === 'object'
    ))
    .filter(activity => {
      if (!activity.occurred_at) return false
      return Boolean(TimeUtil.parse(String(activity.occurred_at))?.isValid())
    })
    .sort((a, b) => (
      (TimeUtil.parse(String(b.occurred_at))?.valueOf() || 0) - (TimeUtil.parse(String(a.occurred_at))?.valueOf() || 0)
    ))
    .slice(0, 8)
    .map((activity, index) => {
      const activityType = ['sales', 'customer', 'inventory', 'repair'].includes(activity.type || '')
        ? activity.type as DashboardActivityType
        : 'inventory'

      return {
        id: String(activity.id || `activity-${index}`),
        type: activityType,
        icon: activity.icon || 'fas fa-clock',
        description: activity.description || '发生一项业务活动',
        time: TimeUtil.fromNow(String(activity.occurred_at))
      }
    })
}

// 计算属性
const _hasWarning = computed(() => {
  return inventoryAlert.value || urgentRepairs.value > 0
})

const guardedPush = (target: string) => {
  if (!canAccessRoutePath(target, authStore)) {
    globalNotifications.warning('您没有访问此页面的权限')
    return false
  }

  router.push(target)
  return true
}

// 方法
const goToSales = async () => {
  if (await confirm('确定要创建新的销售订单吗？')) {
    if (guardedPush('/sales')) {
      success('已跳转到销售页面')
    }
  }
}

const addCustomer = async () => {
  const result = await confirm(
    '快速添加客户需要填写基本信息，确定继续吗？',
    '添加客户',
    { type: 'info' }
  )

  if (result) {
    guardedPush('/customers?action=add')
  }
}

const goToInventory = () => {
  if (inventoryAlert.value) {
    warning('检测到库存预警，请及时处理')
  }
  guardedPush('/inventory')
}

const goToRepairs = () => {
  if (urgentRepairs.value > 0) {
    warning(`您有 ${urgentRepairs.value} 项紧急维修待处理`)
  }
  guardedPush('/repairs')
}

// 刷新数据
const refreshData = async () => {
  if (!canView.value) {
    return
  }

  isRefreshing.value = true

  try {
    unifiedApi.clearCache('/dashboard')
    await loadDashboardData(false)
    // 刷新待审批提醒
    if (pendingApprovementsRef.value?.refresh) {
      await pendingApprovementsRef.value.refresh()
    }
    success('数据刷新成功')
    updateLastUpdateTime()
  } catch (err) {
    handleApiError(err, '数据刷新失败')
  } finally {
    isRefreshing.value = false
  }
}

// 显示详情
const showDetails = (type: string) => {
  switch (type) {
  case 'sales':
    info(`今日销售额 ${todaySales.value}`)
    break
  case 'customers':
    info(`客户总数 ${totalCustomers.value}`)
    break
  case 'inventory':
    if (inventoryAlert.value) {
      warning('检测到库存预警，请及时处理')
    } else {
      info(`库存商品 ${totalProducts.value} 件，正常水平`)
    }
    break
  case 'repairs':
    if (urgentRepairs.value > 0) {
      error(`有 ${urgentRepairs.value} 项紧急维修需要立即处理`)
    } else {
      info('暂无紧急维修事项')
    }
    break
  }
}

const updateLastUpdateTime = () => {
  lastUpdateTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
}

// 加载仪表盘数据
const loadDashboardData = async (showLoadingState = true) => {
  if (!canView.value) {
    return
  }

  if (showLoadingState) {
    isLoading.value = true
  }

  try {
    const activityRequest = useCachedRequest(
      CACHE_KEYS.recentActivities,
      () => unifiedApi.get('/dashboard/activities', { params: { limit: 8 } }),
      DEFAULT_CACHE_TTL.STATIC
    ).catch((error): null => {
      handleApiError(error, '加载最近活动失败')
      return null
    })

    const [response, activityResponse] = await Promise.all([
      useCachedRequest(CACHE_KEYS.dashboard, () =>
        unifiedApi.get('/dashboard'), DEFAULT_CACHE_TTL.STATIC),
      activityRequest
    ])

    if (response.success && response.data) {
      const stats = response.data.stats

      // 更新今日销售金额（格式化为货币）
      todaySales.value = formatCurrency(stats.todaySalesAmount || 0)

      // 更新客户总数
      totalCustomers.value = formatNumber(stats.customers || 0)

      // 更新库存商品（只统计手机）
      const phoneStock = stats.phones?.in_stock || 0
      totalProducts.value = formatNumber(phoneStock)

      // 库存预警
      if (response.data.stockWarnings && response.data.stockWarnings.length > 0) {
        inventoryAlert.value = true
      }
    }

    recentActivities.value = activityResponse?.success
      ? normalizeRecentActivities(activityResponse.data)
      : []

  } catch (error) {
    handleApiError(error, '加载仪表盘数据失败')
    throw error
  } finally {
    if (showLoadingState) {
      isLoading.value = false
    }
  }
}

// 格式化金额（不添加货币符号，因为模板中已有）
const formatCurrency = (amount: number): string => {
  const numericAmount = Number(amount) || 0
  return numericAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

// 格式化数字
const formatNumber = (num: number): string => {
  return (num || 0).toLocaleString('zh-CN')
}

// 生命周期
onMounted(() => {
  void fieldPermissions.init()
  if (!canView.value) {
    return
  }

  // 加载仪表盘数据
  loadDashboardData()
  updateLastUpdateTime()

  // 显示欢迎消息
  setTimeout(() => {
    success(`欢迎使用${siteSettingsStore.displayName}`, {
      title: '登录成功',
      duration: 5000
    })
  }, 500)

  // 定期刷新数据
  dashboardRefreshTimer = setInterval(() => {
    if (!isRefreshing.value) {
      loadDashboardData()
      updateLastUpdateTime()
    }
  }, 5 * 60 * 1000) // 5分钟刷新一次
})

onUnmounted(() => {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer)
    dashboardRefreshTimer = null
  }
})
</script>

<style scoped src="./styles/dashboard-view/desktop.css"></style>
<style scoped src="./styles/dashboard-view/responsive.css"></style>
