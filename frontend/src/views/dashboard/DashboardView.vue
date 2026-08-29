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
              v-if="canViewField('system_info.operations')"
              type="info"
              :disabled="isRefreshing"
              @click="refreshData"
            >
              <InlineLoading
                v-if="isRefreshing"
                text="刷新中..."
                size="small"
                variant="inherit"
              />
              <template v-else>
                <i class="fas fa-sync-alt" />
                刷新数据
              </template>
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
              class="stat-card"
              @click="showDetails('sales')"
            >
              <div class="stat-icon sales">
                <i class="fas fa-shopping-cart" />
              </div>
              <div class="stat-content">
                <h3>今日销售</h3>
                <p class="stat-number">
                  ¥{{ todaySales }}
                </p>
              </div>
            </div>

            <div
              v-if="canViewField('stats.total_customers')"
              class="stat-card"
              @click="showDetails('customers')"
            >
              <div class="stat-icon customers">
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
              class="stat-card"
              @click="showDetails('inventory')"
            >
              <div class="stat-icon inventory">
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
              class="stat-card"
              @click="showDetails('repairs')"
            >
              <div class="stat-icon repairs">
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
              <button
                class="action-btn"
                @click="goToSales"
              >
                <i class="fas fa-plus" />
                新建销售
              </button>
              <button
                class="action-btn"
                @click="addCustomer"
              >
                <i class="fas fa-user-plus" />
                添加客户
              </button>
              <button
                class="action-btn"
                @click="goToInventory"
              >
                <i class="fas fa-box" />
                库存管理
              </button>
              <button
                class="action-btn"
                @click="goToRepairs"
              >
                <i class="fas fa-wrench" />
                维修管理
              </button>
              <button
                class="action-btn"
                @click="showSystemInfo"
              >
                <i class="fas fa-info-circle" />
                系统信息
              </button>
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
import { ElMessage } from 'element-plus'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { PageHeader, PermissionGate } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import ComprehensiveWarnings from '@/components/ComprehensiveWarnings.vue'
import PendingApprovals from '@/components/PendingApprovals.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

// 使用通知服务
const {
  success,
  error,
  warning,
  info,
  confirm,
  alert,
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
const todaySales = ref('0.00')
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

// 活动数据必须由后端提供；当前没有活动接口时保持为空，不展示虚构记录。
const recentActivities = ref<any[]>([])

// 计算属性
const _hasWarning = computed(() => {
  return inventoryAlert.value || urgentRepairs.value > 0
})

const guardedPush = (target: string) => {
  if (!canAccessRoutePath(target, authStore)) {
    ElMessage.warning('您没有访问此页面的权限')
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

// 显示系统信息
const showSystemInfo = async () => {
  await alert(
    `系统版本：TF2025 v1.0.0\n当前时间：${TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)}\n\n系统状态详情请前往系统管理页面查看。`,
    '系统信息',
    'info'
  )
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
    // 使用缓存的API调用
    const response = await useCachedRequest(CACHE_KEYS.dashboard, () =>
      unifiedApi.get('/dashboard'), DEFAULT_CACHE_TTL.STATIC)

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
  return (amount || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
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

<style scoped>
.dashboard {
  padding: 0;
}

/* 欢迎横幅 */
.welcome-banner {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: white;
  padding: 20px 40px;
  border-radius: 16px;
  margin-bottom: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
}

.welcome-content h2 {
  font-size: 28px;
  margin-bottom: 0;
}

.refresh-btn {
  background: var(--tf-button-overlay-bg);
  border: 2px solid var(--tf-button-neutral-border);
  color: var(--tf-button-on-color);
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--tf-button-overlay-hover-bg);
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 仪表盘网格 */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-icon.sales {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: white;
}

.stat-icon.customers {
  background: linear-gradient(135deg, var(--tf-color-pink-gradient) 0%, var(--tf-color-coral-gradient) 100%);
  color: white;
}

.stat-icon.inventory {
  background: linear-gradient(135deg, var(--tf-color-sky-gradient) 0%, var(--tf-color-cyan-gradient) 100%);
  color: white;
}

.stat-icon.repairs {
  background: linear-gradient(135deg, var(--tf-color-green-gradient) 0%, var(--tf-color-teal-gradient) 100%);
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  font-size: 14px;
  color: var(--tf-color-gray-cool-500);
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--tf-color-heading);
  margin-bottom: 4px;
}

.stat-change {
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stat-change.positive {
  color: var(--tf-color-green-legacy);
}

.stat-change.negative {
  color: var(--tf-color-red-legacy);
}

.stat-change.neutral {
  color: var(--tf-color-gray-legacy-500);
}

.inventory-warning,
.urgent-repairs {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.urgent-repairs {
  background: var(--tf-color-danger-legacy);
  color: var(--tf-color-danger-text-legacy);
}

/* 快速操作 */
.quick-actions {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.quick-actions h2 {
  font-size: 18px;
  color: var(--tf-color-heading);
  margin-bottom: 20px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.action-btn {
  background: var(--tf-button-neutral-bg);
  border: 2px solid var(--tf-button-neutral-border);
  padding: 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--tf-button-tool-color);
}

.action-btn:hover {
  background: var(--tf-button-primary-hover-bg);
  border-color: var(--tf-button-primary-soft-hover-border);
  color: var(--tf-button-on-color);
  transform: translateY(-2px);
}

.action-btn i {
  font-size: 24px;
}

/* 最近活动 */
.recent-activity {
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.activity-header h2 {
  font-size: 18px;
  color: var(--tf-color-heading);
  margin: 0;
}

.view-all-btn {
  background: none;
  border: 1px solid var(--tf-button-neutral-border);
  color: var(--tf-button-primary-soft-color);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.view-all-btn:hover {
  background: var(--tf-button-primary-hover-bg);
  color: var(--tf-button-on-color);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--tf-color-surface-google);
  transition: background 0.3s ease;
}

.activity-item:hover {
  background: var(--tf-color-surface-muted);
  margin: 0 -15px;
  padding: 15px;
  border-radius: 6px;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 16px;
  flex-shrink: 0;
}

.activity-icon.sales {
  background: var(--tf-color-blue-100);
  color: var(--tf-color-blue-material-500);
}

.activity-icon.customer {
  background: var(--tf-color-purple-50);
  color: var(--tf-color-purple-material);
}

.activity-icon.inventory {
  background: var(--tf-color-surface-green-alt);
  color: var(--tf-color-green-material);
}

.activity-icon.repair {
  background: var(--tf-color-orange-material-50);
  color: var(--tf-color-orange-material-500);
}

.activity-content {
  flex: 1;
}

.activity-content p {
  margin-bottom: 4px;
  color: var(--tf-color-heading);
  font-size: 14px;
}

.activity-time {
  color: var(--tf-color-gray-cool-500);
  font-size: 12px;
}

.activity-action {
  background: none;
  border: none;
  color: var(--tf-color-gray-legacy-500);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.activity-action:hover {
  background: var(--tf-color-gray-flat-200);
  color: var(--tf-color-heading);
}

/* ===== 响应式设计 ===== */

/* 平板优化 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 手机端优化 */
@media (max-width: 767px) {
  .dashboard {
    padding: 0;
  }

  .dashboard-grid {
    gap: var(--admin-panel-gap);
  }

  /* 欢迎横幅 */
  .welcome-banner {
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 12px;
    justify-content: center;
  }

  .welcome-content {
    flex: 1;
    min-width: 150px;
    text-align: center;
  }

  .welcome-content h2 {
    font-size: 18px;
    margin-bottom: 0;
  }

  .welcome-actions {
    flex: 0 0 auto;
  }

  .refresh-btn {
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  /* 统计卡片 - 2列网格 */
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 0;
    padding: 0;
  }

  .stat-card {
    padding: 14px 12px;
    flex-direction: row;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
    margin-right: 12px;
  }

  .stat-number {
    font-size: 18px;
  }

  .stat-content h3 {
    font-size: 12px;
  }

  .stat-change {
    font-size: 10px;
  }

  .inventory-warning,
  .urgent-repairs {
    font-size: 9px;
    padding: 2px 6px;
  }

  /* 快速操作 - 2列网格 */
  .quick-actions {
    width: 100%;
    padding: var(--admin-panel-padding);
    border-radius: var(--mobile-card-radius);
  }

  .quick-actions h2 {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .action-btn {
    padding: 14px 12px;
    font-size: 12px;
    gap: 8px;
  }

  .action-btn i {
    font-size: 18px;
  }

  /* 最近活动 */
  .recent-activity {
    width: 100%;
    padding: var(--admin-panel-padding);
    border-radius: var(--mobile-card-radius);
  }

  .activity-header h2 {
    font-size: 16px;
  }

  .view-all-btn {
    padding: 6px 10px;
    font-size: 11px;
  }

  .activity-item {
    padding: 12px 0;
  }

  .activity-icon {
    width: 36px;
    height: 36px;
    font-size: 14px;
    margin-right: 12px;
  }

  .activity-content p {
    font-size: 13px;
  }

  .activity-time {
    font-size: 11px;
  }

  .activity-action {
    padding: 6px;
  }
}

/* 小屏手机 */
@media (max-width: 480px) {
  .dashboard {
    padding: 0;
  }

  .welcome-banner {
    padding: 14px 10px;
  }

  .welcome-content h2 {
    font-size: 16px;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-card {
    padding: 12px 10px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .stat-number {
    font-size: 16px;
  }

  .action-btn {
    padding: 12px 10px;
    font-size: 11px;
  }

  .action-btn i {
    font-size: 16px;
  }
}

/* 超小屏幕 */
@media (max-width: 375px) {
  .stats-grid,
  .actions-grid {
    gap: 8px;
  }

  .stat-card,
  .action-btn {
    padding: 10px 8px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}

/* 横屏优化 */
@media (max-width: 767px) and (orientation: landscape) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
