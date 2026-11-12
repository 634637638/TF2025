<template>
  <div
    v-if="canViewPendingApprovals"
    v-tf-loading="{ active: loading, text: '正在刷新待审批事项...' }"
    class="pending-approvals"
  >
    <!-- 预警概览卡片 -->
    <div class="approvals-overview">
      <div
        class="overview-card"
        :class="{ 'has-pending': attendanceCount > 0 }"
        @click="goToAttendance('pending')"
      >
        <div class="card-icon attendance">
          <i class="fas fa-calendar-check" />
        </div>
        <div class="card-content">
          <div class="card-value">
            {{ attendanceCount }}
          </div>
          <div class="card-label">
            待审批考勤
          </div>
        </div>
        <div
          v-if="attendanceCount > 0"
          class="card-badge"
        >
          <i class="fas fa-bell" />
        </div>
      </div>

      <div
        class="overview-card"
        :class="{ 'has-pending': leaveCount > 0 }"
        @click="goToAttendance('leave')"
      >
        <div class="card-icon leave">
          <i class="fas fa-umbrella-beach" />
        </div>
        <div class="card-content">
          <div class="card-value">
            {{ leaveCount }}
          </div>
          <div class="card-label">
            待审批休假
          </div>
        </div>
        <div
          v-if="leaveCount > 0"
          class="card-badge"
        >
          <i class="fas fa-bell" />
        </div>
      </div>

      <div
        class="overview-card"
        :class="{ 'has-pending': overtimeCount > 0 }"
        @click="goToAttendance('overtime')"
      >
        <div class="card-icon overtime">
          <i class="fas fa-business-time" />
        </div>
        <div class="card-content">
          <div class="card-value">
            {{ overtimeCount }}
          </div>
          <div class="card-label">
            待审批加班
          </div>
        </div>
        <div
          v-if="overtimeCount > 0"
          class="card-badge"
        >
          <i class="fas fa-bell" />
        </div>
      </div>
    </div>

    <!-- 详细列表 -->
    <div
      v-if="totalPending > 0"
      class="approvals-detail"
    >
      <div class="detail-header">
        <h4>
          <i class="fas fa-clock" />
          待审批详情
        </h4>
        <el-tag
          type="warning"
          size="small"
        >
          共 {{ totalPending }} 条待处理
        </el-tag>
      </div>

      <div class="approval-list">
        <!-- 考勤申请 -->
        <div
          v-for="item in attendanceList"
          :key="`attendance-${item.id}`"
          class="approval-item"
          @click="viewDetail(item)"
        >
          <div class="item-icon">
            <i :class="getTypeIcon(item.record_type)" />
          </div>
          <div class="item-content">
            <div class="item-title">
              {{ getRecordTypeName(item.record_type) }}
            </div>
            <div class="item-info">
              <span class="employee-name">{{ item.employee_name || item.employee_username }}</span>
              <span
                class="record-date"
                :class="{ 'invalid-date': isInvalidDate(item.record_date) }"
              >
                {{ formatDate(item.record_date) }}
              </span>
              <span
                v-if="item.record_type === 'monthly_leave'"
                class="record-days"
              >
                休假 {{ item.monthly_leave_days || item.leave_days || 0 }} 天
              </span>
              <span
                v-else-if="item.record_type === 'overtime'"
                class="record-hours"
              >
                加班 {{ item.overtime_hours || 0 }} 小时
              </span>
              <span
                v-else
                class="record-days"
              >
                请假 {{ item.leave_days || 0 }} 天
              </span>
            </div>
          </div>
          <div class="item-time">
            <el-tag
              type="warning"
              size="small"
            >
              待审批
            </el-tag>
            <span class="time-text">{{ formatTime(item.created_at) }}</span>
          </div>
        </div>

        <DataEmptyState
          v-if="attendanceList.length === 0"
          description="暂无待审批记录"
          :image-size="60"
        />
      </div>

      <div class="detail-actions">
        <el-button
          type="primary"
          size="small"
          @click="goToAttendance()"
        >
          查看全部
          <i class="fas fa-arrow-right" />
        </el-button>
      </div>
    </div>

    <!-- 无待审批状态 -->
    <div
      v-else
      class="no-approvals"
    >
      <DataEmptyState
        description="暂无待审批申请"
        :image-size="80"
      >
        <template #description>
          <p class="no-approvals-text">
            所有考勤申请已处理完成
          </p>
        </template>
      </DataEmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useNotification } from '@/composables/useNotification'
import { unifiedApi } from '@/utils/unified-api'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { storage } from '@/services/storage'
import { SESSION_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { PermissionMapper } from '@/utils/permissionMapper'
const globalNotifications = useNotification()


interface PendingApprovalStats {
  total?: number
  leave?: number
  overtime?: number
}

interface PendingApprovalItem {
  id: number
  record_type: string
  employee_name?: string
  employee_username?: string
  record_date: string
  monthly_leave_days?: number | string
  leave_days?: number | string
  overtime_hours?: number | string
  created_at: string
}

interface AttendanceListResponse {
  records?: PendingApprovalItem[]
}

interface ApprovalError {
  message?: string
  code?: string
  response?: {
    data?: unknown
  }
}

const router = useRouter()
const authStore = useAuthStore()
const { warning } = useNotification()

// 响应式数据
const loading = ref(false)
const attendanceList = ref<PendingApprovalItem[]>([])
const attendanceCount = ref(0)
const leaveCount = ref(0)
const overtimeCount = ref(0)

// 计算属性
const canAccessAttendance = computed(() => canAccessRoutePath('/attendance', authStore))
const canViewPendingApprovals = computed(() => {
  const approvalPermissions = [
    'attendance:view',
    'attendance:view:all'
  ].map(permission => PermissionMapper.normalizePermission(permission))

  const normalizedUserPermissions = authStore.userPermissions
    .filter(permission => typeof permission === 'string' && permission)
    .map(permission => PermissionMapper.normalizePermission(permission))

  return normalizedUserPermissions.includes('*') ||
    approvalPermissions.some(permission => normalizedUserPermissions.includes(permission))
})

const totalPending = computed(() => {
  // 后端 total 已包含休假、请假、加班和其他考勤申请，不能再叠加分类数量。
  return attendanceCount.value
})

const resetPendingApprovals = () => {
  attendanceList.value = []
  attendanceCount.value = 0
  leaveCount.value = 0
  overtimeCount.value = 0
}

// 获取待审批数据
const fetchPendingApprovals = async () => {
  if (loading.value) return
  if (!canViewPendingApprovals.value) {
    resetPendingApprovals()
    return
  }

  loading.value = true
  try {
    // 获取待审批统计
    const statsResponse = await unifiedApi.get('/attendance/pending-stats')

    if (statsResponse.success) {
      const stats = (statsResponse.data || {}) as PendingApprovalStats
      attendanceCount.value = stats.total || 0
      leaveCount.value = stats.leave || 0
      overtimeCount.value = stats.overtime || 0
    }

    // 获取待审批列表（限制数量）
    const listResponse = await unifiedApi.get('/attendance', {
      params: {
        status: 'pending',
        limit: 5,
        sort: 'created_at',
        order: 'DESC'
      }
    })

    if (listResponse.success) {
      const listData = (listResponse.data || {}) as AttendanceListResponse
      attendanceList.value = Array.isArray(listData.records) ? listData.records : []
    }

    // 显示提醒通知（只在首次加载且有待审批时显示）
    if (totalPending.value > 0 && !storage.has(SESSION_STORAGE_KEYS.PENDING_APPROVAL_NOTIFIED, 'session')) {
      showPendingNotification()
      storage.set(SESSION_STORAGE_KEYS.PENDING_APPROVAL_NOTIFIED, 'true', 'session')
    }
  } catch (err: unknown) {
    const errorInfo = err as ApprovalError
    logger.error('❌ 获取待审批数据失败:', err)
    logger.error('错误详情:', {
      message: errorInfo.message,
      code: errorInfo.code,
      response: errorInfo.response?.data
    })
  } finally {
    loading.value = false
  }
}

// 显示待审批通知
const showPendingNotification = () => {
  const messages = []

  if (leaveCount.value > 0) {
    messages.push(`${leaveCount.value}条请假/休假申请`)
  }
  const otherAttendanceCount = Math.max(
    attendanceCount.value - leaveCount.value - overtimeCount.value,
    0
  )
  if (otherAttendanceCount > 0) {
    messages.push(`${otherAttendanceCount}条考勤申请`)
  }
  if (overtimeCount.value > 0) {
    messages.push(`${overtimeCount.value}条加班申请`)
  }

  warning(`您有 ${totalPending.value} 条待审批申请：${messages.join('、')}`, {
    title: '待审批提醒',
    duration: 8000
  })
}

// 跳转到考勤页面
const goToAttendance = (type?: string) => {
  if (!canAccessAttendance.value) {
    globalNotifications.warning('您没有访问此页面的权限')
    return
  }

  const query: Record<string, string> = {}

  if (type === 'pending') {
    query.status = 'pending'
  } else if (type === 'leave') {
    query.record_type = 'monthly_leave'
    query.status = 'pending'
  } else if (type === 'overtime') {
    query.record_type = 'overtime'
    query.status = 'pending'
  } else {
    query.status = 'pending'
  }

  router.push({
    path: '/attendance',
    query
  })
}

// 查看详情
const viewDetail = (item: PendingApprovalItem) => {
  if (!canAccessAttendance.value) {
    globalNotifications.warning('您没有访问此页面的权限')
    return
  }

  router.push({
    path: '/attendance',
    query: {
      id: item.id,
      status: 'pending'
    }
  })
}

// 获取记录类型图标
const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    monthly_leave: 'fas fa-umbrella-beach',
    leave: 'fas fa-user-clock',
    overtime: 'fas fa-business-time'
  }
  return icons[type] || 'fas fa-calendar-check'
}

// 获取记录类型名称
const getRecordTypeName = (type: string) => {
  const names: Record<string, string> = {
    monthly_leave: '带薪休假',
    leave: '请假申请',
    overtime: '加班申请'
  }
  return names[type] || '考勤申请'
}

// 格式化日期（处理无效日期）
const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === '0000-00-00') {
    return '日期未设置'
  }
  return dateStr
}

// 检查是否为无效日期
const isInvalidDate = (dateStr: string) => {
  return !dateStr || dateStr === '0000-00-00' || dateStr === ''
}

// 格式化时间
const formatTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = TimeUtil.parse(dateStr)
  if (!date) return dateStr
  const now = TimeUtil.now()
  const hours = TimeUtil.diff(date, now, 'hour')

  if (hours < 1) {
    return '刚刚'
  } else if (hours < 24) {
    return `${Math.floor(hours)}小时前`
  } else {
    const days = Math.floor(hours / 24)
    if (days <= 7) {
      return `${days}天前`
    } else {
      return date?.isValid() ? TimeUtil.format(date, TIME_FORMATS.DATE) : ''
    }
  }
}

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const startPolling = () => {
  if (!canViewPendingApprovals.value) {
    resetPendingApprovals()
    return
  }

  fetchPendingApprovals()

  // 每5分钟自动刷新
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      fetchPendingApprovals()
    }, 5 * 60 * 1000)
  }
}

watch(canViewPendingApprovals, (allowed) => {
  if (allowed) {
    startPolling()
    return
  }

  stopPolling()
  resetPendingApprovals()
})

// 生命周期
onMounted(() => {
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

// 暴露刷新方法供父组件调用
defineExpose({
  refresh: fetchPendingApprovals
})
</script>

<style lang="scss" scoped src="./styles/pending-approvals/desktop.scss"></style>
<style lang="scss" scoped src="./styles/pending-approvals/responsive.scss"></style>
