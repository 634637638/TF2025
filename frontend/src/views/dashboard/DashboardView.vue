<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="dashboard"
    module-name="仪表盘"
    permission-code="dashboard:view"
  />

  <div v-else class="dashboard">

    <PageHeader title="仪表盘">
      <template #actions>
        <el-button type="info" @click="refreshData" :disabled="isRefreshing">
          <i :class="isRefreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          刷新数据
        </el-button>
      </template>
    </PageHeader>

    <div class="dashboard-grid" v-loading="isLoading">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card" @click="showDetails('sales')">
          <div class="stat-icon sales">
            <i class="fas fa-shopping-cart"></i>
          </div>
          <div class="stat-content">
            <h3>今日销售</h3>
            <p class="stat-number">¥{{ todaySales }}</p>
            <span class="stat-change positive">
              <i class="fas fa-arrow-up"></i>
              +12.5%
            </span>
          </div>
        </div>

        <div class="stat-card" @click="showDetails('customers')">
          <div class="stat-icon customers">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-content">
            <h3>客户总数</h3>
            <p class="stat-number">{{ totalCustomers }}</p>
            <span class="stat-change positive">
              <i class="fas fa-arrow-up"></i>
              +5.2%
            </span>
          </div>
        </div>

        <div class="stat-card" @click="showDetails('inventory')">
          <div class="stat-icon inventory">
            <i class="fas fa-boxes"></i>
          </div>
          <div class="stat-content">
            <h3>库存商品</h3>
            <p class="stat-number">{{ totalProducts }}</p>
            <span class="stat-change negative">
              <i class="fas fa-arrow-down"></i>
              -2.1%
            </span>
            <div class="inventory-warning" v-if="inventoryAlert">
              <i class="fas fa-exclamation-triangle"></i>
              库存预警
            </div>
          </div>
        </div>

        <div class="stat-card" @click="showDetails('repairs')">
          <div class="stat-icon repairs">
            <i class="fas fa-tools"></i>
          </div>
          <div class="stat-content">
            <h3>待维修</h3>
            <p class="stat-number">{{ pendingRepairs }}</p>
            <span class="stat-change neutral">
              <i class="fas fa-minus"></i>
              0%
            </span>
            <div class="urgent-repairs" v-if="urgentRepairs > 0">
              <i class="fas fa-bolt"></i>
              {{ urgentRepairs }} 项紧急
            </div>
          </div>
        </div>
      </div>

      <!-- 综合预警 -->
      <ComprehensiveWarnings />

      <!-- 待审批提醒 -->
      <PendingApprovals ref="pendingApprovementsRef" />

      <!-- 快速操作 -->
      <div class="quick-actions">
        <h2>快速操作</h2>
        <div class="actions-grid">
          <button class="action-btn" @click="goToSales">
            <i class="fas fa-plus"></i>
            新建销售
          </button>
          <button class="action-btn" @click="addCustomer">
            <i class="fas fa-user-plus"></i>
            添加客户
          </button>
          <button class="action-btn" @click="goToInventory">
            <i class="fas fa-box"></i>
            库存管理
          </button>
          <button class="action-btn" @click="goToRepairs">
            <i class="fas fa-wrench"></i>
            维修管理
          </button>
          <button class="action-btn" @click="generateReport">
            <i class="fas fa-chart-bar"></i>
            生成报表
          </button>
          <button class="action-btn" @click="showSystemInfo">
            <i class="fas fa-info-circle"></i>
            系统信息
          </button>
        </div>
      </div>

      <!-- 最近活动 -->
      <div class="recent-activity">
        <div class="activity-header">
          <h2>最近活动</h2>
          <button class="view-all-btn" @click="viewAllActivities">查看全部</button>
        </div>
        <div class="activity-list">
          <div class="activity-item" v-for="activity in recentActivities" :key="activity.id">
            <div class="activity-icon" :class="activity.type">
              <i :class="activity.icon"></i>
            </div>
            <div class="activity-content">
              <p>{{ activity.description }}</p>
              <span class="activity-time">{{ activity.time }}</span>
            </div>
            <button class="activity-action" @click="handleActivity(activity)">
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { unifiedApi } from '@/utils/unified-api'
import { PageHeader, PermissionDenied } from '@/components/base'
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
  prompt,
  loading,
  handleApiError,
  handleApiSuccess
} = useNotification()

const router = useRouter()
const { canView } = usePagePermissions('dashboard')

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

const recentActivities = ref([
  {
    id: 1,
    type: 'sales',
    icon: 'fas fa-shopping-cart',
    description: '完成了一笔销售订单 #1234',
    time: '5分钟前',
    details: 'iPhone 13 Pro - 128GB - 深空黑色'
  },
  {
    id: 2,
    type: 'customer',
    icon: 'fas fa-user',
    description: '新增客户：张三',
    time: '15分钟前',
    details: '手机：13812345678，地址：北京市朝阳区'
  },
  {
    id: 3,
    type: 'inventory',
    icon: 'fas fa-box',
    description: '库存更新：iPhone 13 Pro',
    time: '1小时前',
    details: '入库50台，当前库存：125台'
  },
  {
    id: 4,
    type: 'repair',
    icon: 'fas fa-tools',
    description: '维修完成：屏幕更换',
    time: '2小时前',
    details: '客户：李四，费用：280元'
  }
])

// 计算属性
const hasWarning = computed(() => {
  return inventoryAlert.value || urgentRepairs.value > 0
})

// 方法
const goToSales = async () => {
  if (await confirm('确定要创建新的销售订单吗？')) {
    router.push('/sales')
    success('已跳转到销售页面')
  }
}

const addCustomer = async () => {
  const result = await confirm(
    '快速添加客户需要填写基本信息，确定继续吗？',
    '添加客户',
    { type: 'info' }
  )

  if (result) {
    router.push('/customers?action=add')
  }
}

const goToInventory = () => {
  if (inventoryAlert.value) {
    warning('检测到库存预警，请及时处理')
  }
  router.push('/inventory')
}

const goToRepairs = () => {
  if (urgentRepairs.value > 0) {
    warning(`您有 ${urgentRepairs.value} 项紧急维修待处理`)
  }
  router.push('/repairs')
}

// 刷新数据
const refreshData = async () => {
  if (!canView.value) {
    return
  }

  isRefreshing.value = true
  const closeLoading = loading('正在刷新仪表盘数据...')

  try {
    await loadDashboardData()
    // 刷新待审批提醒
    if (pendingApprovementsRef.value?.refresh) {
      await pendingApprovementsRef.value.refresh()
    }
    success('数据刷新成功')
    updateLastUpdateTime()
  } catch (err) {
    handleApiError(err, '数据刷新失败')
  } finally {
    closeLoading()
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

// 处理活动
const handleActivity = async (activity: any) => {
  const action = await prompt(
    '请选择操作：',
    '活动操作',
    {
      inputPlaceholder: '输入操作（如：查看详情、导出等）'
    }
  )

  if (action && action.value) {
    success(`已执行：${action.value}`)
    // 这里可以添加实际的处理逻辑
  }
}

// 查看所有活动
const viewAllActivities = () => {
  info('正在开发活动详情页面...')
}

// 生成报表
const generateReport = async () => {
  const reportType = await prompt(
    '请选择报表类型：\n1. 销售报表\n2. 库存报表\n3. 客户报表\n4. 维修报表',
    '选择报表类型'
  )

  if (reportType && reportType.value) {
    info(`正在生成${getReportName(reportType.value)}...`)

    setTimeout(() => {
      success(`${getReportName(reportType.value)}已生成`, {
        title: '报表生成完成'
      })
    }, 2000)
  }
}

// 显示系统信息
const showSystemInfo = async () => {
  await alert(
    `系统版本：TF2025 v1.0.0\n最后更新：${TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)}\n\n数据库连接：正常\nAPI服务：正常\n备份状态：需要更新\n存储空间：充足`,
    '系统信息',
    'info'
  )
}

// 辅助函数
const getReportName = (type: string): string => {
  const typeMap: Record<string, string> = {
    '1': '销售报表',
    '2': '库存报表',
    '3': '客户报表',
    '4': '维修报表',
    '销售报表': '销售报表',
    '库存报表': '库存报表',
    '客户报表': '客户报表',
    '维修报表': '维修报表'
  }
  return typeMap[type] || '报表'
}

const updateLastUpdateTime = () => {
  lastUpdateTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
}

// 加载仪表盘数据
const loadDashboardData = async () => {
  if (!canView.value) {
    return
  }

  isLoading.value = true

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
    isLoading.value = false
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
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
  background: rgba(255, 255, 255, 0.3);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-icon.customers {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-icon.inventory {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-icon.repairs {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
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
  color: #27ae60;
}

.stat-change.negative {
  color: #e74c3c;
}

.stat-change.neutral {
  color: #95a5a6;
}

.inventory-warning,
.urgent-repairs {
  background: #fff3cd;
  color: #856404;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.urgent-repairs {
  background: #f8d7da;
  color: #721c24;
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
  color: #2c3e50;
  margin-bottom: 20px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.action-btn {
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  padding: 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #495057;
}

.action-btn:hover {
  background: #3498db;
  border-color: #3498db;
  color: white;
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
  color: #2c3e50;
  margin: 0;
}

.view-all-btn {
  background: none;
  border: 1px solid #3498db;
  color: #3498db;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.view-all-btn:hover {
  background: #3498db;
  color: white;
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
  border-bottom: 1px solid #f1f3f4;
  transition: background 0.3s ease;
}

.activity-item:hover {
  background: #f8f9fa;
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
  background: #e3f2fd;
  color: #2196f3;
}

.activity-icon.customer {
  background: #f3e5f5;
  color: #9c27b0;
}

.activity-icon.inventory {
  background: #e8f5e8;
  color: #4caf50;
}

.activity-icon.repair {
  background: #fff3e0;
  color: #ff9800;
}

.activity-content {
  flex: 1;
}

.activity-content p {
  margin-bottom: 4px;
  color: #2c3e50;
  font-size: 14px;
}

.activity-time {
  color: #7f8c8d;
  font-size: 12px;
}

.activity-action {
  background: none;
  border: none;
  color: #95a5a6;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.activity-action:hover {
  background: #ecf0f1;
  color: #2c3e50;
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
    padding: 8px;
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
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
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
    padding: 16px 12px;
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
    padding: 16px 12px;
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
    padding: 6px;
  }

  .welcome-banner {
    padding: 14px 10px;
  }

  .welcome-content h2 {
    font-size: 16px;
  }

  .stats-grid {
    gap: 10px;
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
