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
              v-if="canView"
              class="tf-button--refresh"
              type="info"
              :loading="isRefreshing"
              :disabled="isRefreshing"
              @click="refreshData"
            >
              <i class="fas fa-sync-alt" />
              刷新
            </el-button>
          </template>
        </PageHeader>

        <SectionLoading
          v-if="isLoading"
          text="正在读取仪表盘数据..."
          size="large"
        />

        <LoadingOverlay
          v-else
          :loading="isRefreshing"
          text="正在刷新仪表盘数据..."
          class="dashboard-grid"
        >
          <!-- 统计卡片 -->
          <div
            class="dashboard-stats stats-cards"
            role="region"
            aria-label="仪表盘统计"
            tabindex="0"
          >
            <div
              v-if="canViewField('stats.today_sales')"
              class="stat-card stat-card--income stat-card--clickable"
              :class="{ 'stat-card--with-details stat-card--with-amount-details': overview?.todayPhoneSales }"
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
              <dl
                v-if="overview?.todayPhoneSales"
                class="stat-card__details stat-card__details--amount-divider"
              >
                <div>
                  <dt>全新</dt>
                  <dd class="stat-card__detail--new">
                    <span
                      v-if="overview.todayPhoneSales.new_count != null"
                      class="stat-card__detail-quantity hidden-mobile whitespace-nowrap"
                    >{{ formatNumber(overview.todayPhoneSales.new_count) }}台</span>
                    <span class="stat-card__detail-amount">
                      <span class="stat-card__detail-amount-label desktop-only">金额</span>
                      <span class="stat-card__detail-amount-value">{{ formatCurrency(overview.todayPhoneSales.new_amount) }}</span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>二手</dt>
                  <dd class="stat-card__detail--used">
                    <span
                      v-if="overview.todayPhoneSales.used_count != null"
                      class="stat-card__detail-quantity hidden-mobile whitespace-nowrap"
                    >{{ formatNumber(overview.todayPhoneSales.used_count) }}台</span>
                    <span class="stat-card__detail-amount">
                      <span class="stat-card__detail-amount-label desktop-only">金额</span>
                      <span class="stat-card__detail-amount-value">{{ formatCurrency(overview.todayPhoneSales.used_amount) }}</span>
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="canViewField('stats.monthly_sales')"
              class="stat-card stat-card--info stat-card--with-details"
              :class="{ 'stat-card--with-detail-columns': hasMonthlySalesBreakdown }"
            >
              <div class="stat-icon">
                <i class="fas fa-chart-line" />
              </div>
              <div class="stat-content">
                <h3>本月销售</h3>
                <p
                  v-if="monthlyStats.sales"
                  class="stat-number"
                >
                  {{ formatNumber(monthlyStats.sales.phone_count) }}<span class="stat-value-unit">台</span>
                </p>
                <p
                  v-else
                  class="stat-label"
                >
                  {{ monthlyStatsFailed ? '加载失败' : '暂无数据' }}
                </p>
              </div>
              <dl
                v-if="monthlyStats.sales"
                class="stat-card__details"
              >
                <div
                  v-if="monthlyStats.sales.new_count != null"
                  class="hidden-mobile"
                >
                  <dt>全新</dt>
                  <dd class="stat-card__detail--new">
                    {{ formatNumber(monthlyStats.sales.new_count) }}台
                  </dd>
                </div>
                <div
                  v-if="monthlyStats.sales.used_count != null"
                  class="hidden-mobile"
                >
                  <dt>二手</dt>
                  <dd class="stat-card__detail--used">
                    {{ formatNumber(monthlyStats.sales.used_count) }}台
                  </dd>
                </div>
                <div
                  v-if="monthlyStats.sales.allocation_count != null"
                  class="hidden-mobile"
                >
                  <dt>划拨</dt>
                  <dd>{{ formatNumber(monthlyStats.sales.allocation_count) }}台</dd>
                </div>
                <div
                  v-if="monthlyStats.sales.transfer_count != null"
                  class="hidden-mobile"
                >
                  <dt>调货</dt>
                  <dd>{{ formatNumber(monthlyStats.sales.transfer_count) }}台</dd>
                </div>
                <div>
                  <dt>商品</dt>
                  <dd>{{ formatNumber(monthlyStats.sales.goods_quantity) }}件</dd>
                </div>
                <div v-if="canViewField('stats.monthly_commission')">
                  <dt>提成</dt>
                  <dd class="stat-card__detail--income">
                    {{ monthlyStats.sales.commission == null ? '待计算' : formatCurrency(monthlyStats.sales.commission) }}
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="canViewField('stats.total_products')"
              class="stat-card stat-card--primary stat-card--clickable"
              :class="{ 'stat-card--with-details': phoneStockDetails }"
              @click="showDetails('inventory')"
            >
              <div class="stat-icon">
                <i class="fas fa-boxes" />
              </div>
              <div class="stat-content">
                <h3>库存商品</h3>
                <p class="stat-number">
                  {{ totalProducts }}
                  <span class="stat-value-unit">台</span>
                </p>
                <div
                  v-if="inventoryAlert && canViewField('stats.inventory_alert')"
                  class="inventory-warning"
                >
                  <i class="fas fa-exclamation-triangle" />
                  库存预警
                </div>
              </div>
              <dl
                v-if="phoneStockDetails"
                class="stat-card__details"
              >
                <div>
                  <dt>全新</dt>
                  <dd class="stat-card__detail--new">
                    {{ formatNumber(phoneStockDetails.newCount) }}台
                  </dd>
                </div>
                <div>
                  <dt>二手</dt>
                  <dd class="stat-card__detail--used">
                    {{ formatNumber(phoneStockDetails.usedCount) }}台
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="canViewField('stats.monthly_attendance')"
              class="stat-card stat-card--accent stat-card--with-details"
              :class="{ 'stat-card--with-amount-details': showAttendanceAmounts }"
            >
              <div class="stat-icon">
                <i class="fas fa-calendar-check" />
              </div>
              <div class="stat-content">
                <h3>本月考勤</h3>
                <p
                  v-if="monthlyStats.attendance"
                  class="stat-number"
                >
                  {{ formatNumber(monthlyStats.attendance.leave_days) }}
                  <span class="stat-value-unit">天休假</span>
                </p>
                <p
                  v-else
                  class="stat-label"
                >
                  {{ monthlyStatsFailed ? '加载失败' : '暂无数据' }}
                </p>
              </div>
              <dl
                v-if="monthlyStats.attendance"
                class="stat-card__details"
                :class="{ 'stat-card__details--amount-divider': showAttendanceAmounts }"
              >
                <div>
                  <dt>请假</dt>
                  <dd>
                    <span class="stat-card__detail-quantity whitespace-nowrap">{{ formatNumber(monthlyStats.attendance.unpaid_leave_days) }}天</span>
                    <span
                      v-if="showAttendanceAmounts && monthlyStats.attendance.leave_deduction !== undefined"
                      class="stat-card__detail-amount stat-value--expense"
                    >
                      <span class="stat-card__detail-amount-label desktop-only">扣款</span>
                      <span class="stat-card__detail-amount-value">{{ monthlyStats.attendance.leave_deduction === null ? '待计算' : `${formatAmount(monthlyStats.attendance.leave_deduction)}元` }}</span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>加班</dt>
                  <dd>
                    <span class="stat-card__detail-quantity whitespace-nowrap">{{ formatNumber(monthlyStats.attendance.overtime_hours) }}小时</span>
                    <span
                      v-if="showAttendanceAmounts && monthlyStats.attendance.overtime_pay !== undefined"
                      class="stat-card__detail-amount stat-card__detail--income"
                    >
                      <span class="stat-card__detail-amount-label desktop-only">补贴</span>
                      <span class="stat-card__detail-amount-value">{{ monthlyStats.attendance.overtime_pay === null ? '待计算' : `${formatAmount(monthlyStats.attendance.overtime_pay)}元` }}</span>
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="canViewField('stats.total_customers')"
              class="stat-card stat-card--info stat-card--clickable"
              :class="{ 'stat-card--with-details': overview?.customerGrowth }"
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
              <dl
                v-if="overview?.customerGrowth"
                class="stat-card__details"
                aria-label="新增客户"
              >
                <div>
                  <dt>本月<span class="hidden-mobile">新增</span></dt>
                  <dd class="flex">
                    <span
                      class="mobile-only"
                      aria-hidden="true"
                    >+</span>{{ formatNumber(overview.customerGrowth.current_month) }}人
                  </dd>
                </div>
                <div>
                  <dt>上月<span class="hidden-mobile">新增</span></dt>
                  <dd class="flex">
                    <span
                      class="mobile-only"
                      aria-hidden="true"
                    >+</span>{{ formatNumber(overview.customerGrowth.previous_month) }}人
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="canViewField('stats.pending_repairs')"
              class="stat-card stat-card--warning stat-card--clickable"
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

          <section
            v-if="announcements.length > 0 || personalReminders.length > 0"
            class="dashboard-announcements"
          >
            <article
              v-for="item in personalReminders"
              :key="`reminder-${item.occurrence_id}`"
              class="dashboard-announcement-featured"
            >
              <div class="dashboard-announcement__meta">
                <el-tag
                  type="warning"
                  size="small"
                >
                  待办提醒
                </el-tag>
                <time v-if="canViewReminderField('scheduled_at')">执行时间：{{ TimeUtil.format(item.scheduled_at, TIME_FORMATS.DATETIME_MINUTE) }}</time>
              </div>
              <h3 v-if="canViewReminderField('title')">
                {{ item.title }}
              </h3>
              <p class="dashboard-announcement__content is-expanded">
                {{ employeeName }}，您的待办没有完成哦！本次需要完成的内容：{{ canViewReminderField('content') && item.content ? item.content : (canViewReminderField('title') ? item.title : '待办事项') }}。请及时安排好时间完成任务！感谢支持！
              </p>
            </article>
            <article
              v-if="currentAnnouncement"
              :key="currentAnnouncement.id"
              class="dashboard-announcement-featured"
            >
              <div class="dashboard-announcement__meta">
                <el-tag
                  v-if="currentAnnouncement.isPinned"
                  type="warning"
                  size="small"
                >
                  置顶公告
                </el-tag>
                <el-tag
                  v-else
                  type="success"
                  size="small"
                >
                  最新公告
                </el-tag>
                <div class="dashboard-announcement__actions">
                  <time>{{ formatAnnouncementDate(currentAnnouncement.publishedAt) }}</time>
                  <div
                    v-if="announcements.length > 1"
                    class="dashboard-announcements__navigation"
                  >
                    <el-button
                      circle
                      text
                      aria-label="上一条公告"
                      title="上一条公告"
                      @click="moveAnnouncement(-1)"
                    >
                      <i class="fas fa-chevron-left" />
                    </el-button>
                    <el-button
                      circle
                      text
                      aria-label="下一条公告"
                      title="下一条公告"
                      @click="moveAnnouncement(1)"
                    >
                      <i class="fas fa-chevron-right" />
                    </el-button>
                  </div>
                </div>
              </div>
              <h3>{{ currentAnnouncement.title }}</h3>
              <RichContent
                class="dashboard-announcement__content"
                :class="{ 'is-expanded': expandedAnnouncementId === currentAnnouncement.id }"
                :content="currentAnnouncement.content"
              />
              <el-button
                v-if="currentAnnouncement.content.length > 500"
                text
                type="primary"
                @click="toggleAnnouncement(currentAnnouncement.id)"
              >
                {{ expandedAnnouncementId === currentAnnouncement.id ? '收起' : '展开全文' }}
              </el-button>
            </article>
          </section>

          <DashboardQuickAccess ref="shortcutsRef" />

          <!-- 综合预警 -->
          <ComprehensiveWarnings v-if="canViewField('warnings.comprehensive')" />

          <!-- 待审批提醒 -->
          <PendingApprovals
            v-if="canViewField('warnings.pending_approvals')"
            ref="pendingApprovementsRef"
          />

          <!-- 最近活动 -->
          <div
            v-if="canViewField('activities.recent')"
            class="recent-activity dashboard-card"
          >
            <div class="activity-header">
              <h2>最近活动</h2>
              <el-button
                v-if="canScrollActivities && motionPreference !== 'reduce'"
                text
                :aria-label="activityAutoScroll ? '暂停活动滚动' : '继续活动滚动'"
                :title="activityAutoScroll ? '暂停活动滚动' : '继续活动滚动'"
                @click="activityAutoScroll = !activityAutoScroll"
              >
                <i :class="activityAutoScroll ? 'fas fa-pause' : 'fas fa-play'" />
              </el-button>
            </div>
            <DataEmptyState
              v-if="activityError"
              state="error"
              title="最近活动读取失败"
              :description="activityError"
              size="compact"
              action-text="重试"
              :action-loading="isActivityLoading"
              @action="loadActivities"
            />
            <ul
              v-else-if="recentActivities.length"
              ref="activityList"
              class="activity-list"
              aria-label="最近活动"
              tabindex="0"
              @pointerdown="activityPointerActive = true"
            >
              <li
                v-for="activity in recentActivities"
                :key="activity.id"
                class="activity-item"
              >
                <div
                  class="activity-icon"
                  :class="activity.type"
                >
                  <IconRenderer :icon="activity.icon" />
                </div>
                <div class="activity-content">
                  <p>{{ activity.description }}<span v-if="activity.detail"> · {{ activity.detail }}</span></p>
                  <time class="activity-time">{{ TimeUtil.getFriendlyTime(activity.occurred_at, true) }}</time>
                </div>
              </li>
            </ul>
            <SectionLoading
              v-else-if="isActivityLoading && !isRefreshing"
              text="正在读取最近活动..."
            />
            <DataEmptyState
              v-else-if="!isActivityLoading"
              description="暂无近期活动"
            />
          </div>
        </LoadingOverlay>
      </div>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { formatAmount, formatCurrency } from '@/utils/format'
import { getRequestErrorMessage } from '@/utils/api-response'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useDocumentVisibility, useElementHover, useEventListener, usePreferredReducedMotion, useResizeObserver } from '@vueuse/core'

import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useAuthStore } from '@/stores/auth'
import { useRemindersStore } from '@/stores/reminders'
import { canViewReminderField } from '@/views/reminders/reminder-field-permissions'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { PageHeader, PermissionGate } from '@/components/base'
import SectionLoading from '@/components/SectionLoading.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import ComprehensiveWarnings from '@/components/ComprehensiveWarnings.vue'
import PendingApprovals from '@/components/PendingApprovals.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { announcementsApi } from '@/api/announcements'
import type { SiteAnnouncement } from '@/types'
import type { AttendanceDashboardStats } from '@/types/attendance'
import RichContent from '@/components/RichContent.vue'
import DashboardQuickAccess from './page/DashboardQuickAccess.vue'

// 使用通知服务
const {
  success,
  error,
  warning,
  info,
  handleApiError
} = useNotification()

const { canView } = usePagePermissions('dashboard')
const authStore = useAuthStore()
const remindersStore = useRemindersStore()
const employeeName = computed(() => authStore.user?.name || authStore.user?.username || '员工')
const personalReminders = computed(() => canViewReminderField('recipient_status') &&
  (canViewReminderField('title') || canViewReminderField('content')) ? remindersStore.active : [])
const DASHBOARD_MODULE_KEY = 'dashboard'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(DASHBOARD_MODULE_KEY, fieldKey)

// 待审批提醒组件引用
const pendingApprovementsRef = ref<InstanceType<typeof PendingApprovals> | null>(null)
const shortcutsRef = ref<InstanceType<typeof DashboardQuickAccess> | null>(null)

// 使用站点设置store
const siteSettingsStore = useSiteSettingsStore()

// 响应式数据
const pendingRepairs = ref('0')
const urgentRepairs = ref(0)
const { loading: isLoading } = useLoadingState()
const { loading: isRefreshing } = useLoadingState()
const inventoryAlert = ref(false)

interface DashboardActivity {
  id: string
  type: 'sales' | 'inventory' | 'repair' | 'subsidy' | 'preorder'
  icon: string
  description: string
  detail: string
  occurred_at: string
}

interface DashboardMonthlyStats {
  sales?: {
    phone_count: number
    new_count?: number
    used_count?: number
    allocation_count?: number
    transfer_count?: number
    goods_quantity: number
    commission: number | null
  } | null
  attendance?: (AttendanceDashboardStats['current_month'] & {
    leave_deduction?: number | null
    overtime_pay?: number | null
  }) | null
}

interface DashboardOverview {
  stats?: {
    todaySalesAmount?: number
    todayPhoneSales?: {
      new_amount: number
      used_amount: number
      new_count?: number
      used_count?: number
    }
    customers?: number
    customerGrowth?: { current_month: number, previous_month: number }
    phones?: { in_stock: number, new_count?: number, used_count?: number }
  }
  stockWarnings?: unknown[]
}

const overview = ref<DashboardOverview['stats']>()
const todaySales = computed(() => formatAmount(overview.value?.todaySalesAmount))
const totalCustomers = computed(() => formatNumber(overview.value?.customers ?? 0))
const totalProducts = computed(() => formatNumber(overview.value?.phones?.in_stock ?? 0))
const phoneStockDetails = computed(() => {
  const stock = overview.value?.phones
  if (stock?.new_count === undefined || stock.used_count === undefined) return null
  return { newCount: stock.new_count, usedCount: stock.used_count }
})

const monthlyStats = ref<DashboardMonthlyStats>({})
const monthlyStatsFailed = ref(false)
const showAttendanceAmounts = computed(() => {
  const attendance = monthlyStats.value.attendance
  return canViewField('stats.monthly_attendance_amounts') &&
    (attendance?.leave_deduction !== undefined || attendance?.overtime_pay !== undefined)
})
const hasMonthlySalesBreakdown = computed(() => {
  const sales = monthlyStats.value.sales
  return typeof sales?.new_count === 'number' && typeof sales.used_count === 'number' &&
    typeof sales.allocation_count === 'number' && typeof sales.transfer_count === 'number'
})
const recentActivities = ref<DashboardActivity[]>([])
const activityError = ref('')
const { loading: isActivityLoading } = useLoadingState()
const activityList = ref<HTMLUListElement | null>(null)
const activityAutoScroll = ref(true)
const activityPointerActive = ref(false)
const canScrollActivities = ref(false)
const activityHovered = useElementHover(activityList)
const motionPreference = usePreferredReducedMotion()
const documentVisibility = useDocumentVisibility()

const releaseActivityPointer = () => { activityPointerActive.value = false }
useEventListener('pointerup', releaseActivityPointer)
useEventListener('pointercancel', releaseActivityPointer)
useEventListener('blur', releaseActivityPointer)

const updateActivityOverflow = () => {
  const list = activityList.value
  canScrollActivities.value = Boolean(list && list.scrollHeight > list.clientHeight)
}
useResizeObserver(activityList, updateActivityOverflow)
watch(recentActivities, updateActivityOverflow, { flush: 'post' })

const scrollActivities = () => {
  const list = activityList.value
  if (!list || !canScrollActivities.value || !activityAutoScroll.value || activityHovered.value ||
      activityPointerActive.value || motionPreference.value === 'reduce' ||
      documentVisibility.value === 'hidden' || list.contains(document.activeElement)) return

  if (Math.ceil(list.scrollTop + list.clientHeight) >= list.scrollHeight) {
    list.scrollTop = 0
    return
  }
  const nextItem = Array.from(list.children).find(item => item instanceof HTMLElement && item.offsetTop > list.scrollTop + 1)
  if (nextItem instanceof HTMLElement) {
    list.scrollTo({ top: nextItem.offsetTop, behavior: 'smooth' })
  }
}

let dashboardRefreshTimer: ReturnType<typeof setInterval> | undefined
let activityScrollTimer: ReturnType<typeof setInterval> | undefined
let welcomeTimer: ReturnType<typeof setTimeout> | undefined
const announcements = ref<SiteAnnouncement[]>([])
const announcementIndex = ref(0)
const expandedAnnouncementId = ref<number | null>(null)
const currentAnnouncement = computed(() => announcements.value[announcementIndex.value] || null)

const formatAnnouncementDate = (value: string | null) => (
  value ? TimeUtil.format(value, TIME_FORMATS.DATETIME_MINUTE) : ''
)

const toggleAnnouncement = (id: number) => {
  expandedAnnouncementId.value = expandedAnnouncementId.value === id ? null : id
}

const moveAnnouncement = (offset: number) => {
  if (!announcements.value.length) return
  announcementIndex.value = (announcementIndex.value + offset + announcements.value.length) % announcements.value.length
  expandedAnnouncementId.value = null
}

// 刷新数据
const refreshData = async () => {
  if (!canView.value || isRefreshing.value || dashboardRequestPending) {
    return
  }

  isRefreshing.value = true

  try {
    unifiedApi.clearCache('/system/announcements')
    await loadDashboardData('manual')
    await shortcutsRef.value?.load()
    // 刷新待审批提醒
    if (pendingApprovementsRef.value?.refresh) {
      await pendingApprovementsRef.value.refresh()
    }
    if (!activityError.value) success('数据刷新成功')
  } catch (err) {
    handleApiError(err, '数据刷新失败')
  } finally {
    isRefreshing.value = false
  }
}

// 显示详情
const showDetails = (type: string) => {
  if (!canViewField('system_info.operations')) return

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

// 加载仪表盘数据
let dashboardRequestPending = false
const loadActivities = async () => {
  if (isActivityLoading.value) return
  if (!canViewField('activities.recent')) {
    recentActivities.value = []
    activityError.value = ''
    return
  }

  isActivityLoading.value = true
  try {
    const result = await unifiedApi.get<DashboardActivity[]>('/dashboard/activities', {
      useCache: false, showLoading: false, showError: false
    })
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || '请稍后重试')
    }
    recentActivities.value = result.data
    activityError.value = ''
  } catch (error) {
    activityError.value = getRequestErrorMessage(error, '请稍后重试')
  } finally {
    isActivityLoading.value = false
  }
}

const loadDashboardData = async (mode: 'initial' | 'manual' | 'background' = 'initial') => {
  if (!canView.value || dashboardRequestPending) {
    return
  }

  dashboardRequestPending = true
  if (mode === 'initial') {
    isLoading.value = true
  }

  try {
    const requestOptions = { useCache: false, showLoading: false, showError: false }
    const activityRequest = loadActivities()
    const monthlyRequest = canViewField('stats.monthly_sales') || canViewField('stats.monthly_attendance')
      ? unifiedApi.get<DashboardMonthlyStats>('/dashboard/my-monthly-stats', requestOptions)
      : null
    const announcementRequest = useCachedRequest(
      '/system/announcements',
      () => announcementsApi.listPublished(),
      DEFAULT_CACHE_TTL.STATIC
    ).catch((error): null => {
      handleApiError(error, '加载站内公告失败')
      return null
    })

    const [dashboard, monthly, announcement] = await Promise.allSettled([
      unifiedApi.get<DashboardOverview>('/dashboard', requestOptions),
      monthlyRequest,
      announcementRequest
    ])

    if (dashboard.status === 'fulfilled' && dashboard.value.success) {
      overview.value = dashboard.value.data?.stats
      inventoryAlert.value = Boolean(dashboard.value.data?.stockWarnings?.length)
    }

    monthlyStatsFailed.value = monthly.status === 'rejected' || (
      monthly.status === 'fulfilled' && monthly.value !== null && !monthly.value.success
    )
    monthlyStats.value = monthly.status === 'fulfilled' && monthly.value?.success
      ? monthly.value.data ?? {}
      : {}
    const announcementResponse = announcement.status === 'fulfilled' ? announcement.value : null
    announcements.value = announcementResponse?.success && Array.isArray(announcementResponse.data)
      ? announcementResponse.data.slice(0, 5)
      : []
    announcementIndex.value = 0
    if (!announcements.value.some(item => item.id === expandedAnnouncementId.value)) {
      expandedAnnouncementId.value = null
    }

    const failed = [dashboard, monthly].find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    if (mode === 'manual') await activityRequest
  } catch (error) {
    if (mode === 'manual') throw error
    logger.error('加载仪表盘数据失败:', error)
    if (mode === 'initial') handleApiError(error, '加载仪表盘数据失败')
  } finally {
    dashboardRequestPending = false
    isLoading.value = false
  }
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
  void loadDashboardData()

  // 显示欢迎消息
  welcomeTimer = setTimeout(() => {
    success(`欢迎使用${siteSettingsStore.displayName}`, {
      title: '登录成功',
      duration: 5000
    })
  }, 500)

  // 定期刷新数据
  dashboardRefreshTimer = setInterval(() => {
    if (!isRefreshing.value) {
      void loadDashboardData('background')
    }
  }, 5 * 60 * 1000) // 5分钟刷新一次
  activityScrollTimer = setInterval(scrollActivities, 3600)
})

onUnmounted(() => {
  clearInterval(dashboardRefreshTimer)
  clearInterval(activityScrollTimer)
  clearTimeout(welcomeTimer)
})
</script>

<style scoped src="./styles/dashboard-view/desktop.css"></style>
<style scoped src="./styles/dashboard-view/responsive.css"></style>
