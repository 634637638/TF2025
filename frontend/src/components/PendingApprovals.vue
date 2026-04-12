<template>
  <div class="pending-approvals">
    <!-- 预警概览卡片 -->
    <div class="approvals-overview">
      <div class="overview-card" @click="goToAttendance('pending')" :class="{ 'has-pending': attendanceCount > 0 }">
        <div class="card-icon attendance">
          <i class="fas fa-calendar-check"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ attendanceCount }}</div>
          <div class="card-label">待审批考勤</div>
        </div>
        <div v-if="attendanceCount > 0" class="card-badge">
          <i class="fas fa-bell"></i>
        </div>
      </div>

      <div class="overview-card" @click="goToAttendance('leave')" :class="{ 'has-pending': leaveCount > 0 }">
        <div class="card-icon leave">
          <i class="fas fa-umbrella-beach"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ leaveCount }}</div>
          <div class="card-label">待审批休假</div>
        </div>
        <div v-if="leaveCount > 0" class="card-badge">
          <i class="fas fa-bell"></i>
        </div>
      </div>

      <div class="overview-card" @click="goToAttendance('overtime')" :class="{ 'has-pending': overtimeCount > 0 }">
        <div class="card-icon overtime">
          <i class="fas fa-business-time"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ overtimeCount }}</div>
          <div class="card-label">待审批加班</div>
        </div>
        <div v-if="overtimeCount > 0" class="card-badge">
          <i class="fas fa-bell"></i>
        </div>
      </div>
    </div>

    <!-- 详细列表 -->
    <div v-if="totalPending > 0" class="approvals-detail">
      <div class="detail-header">
        <h4>
          <i class="fas fa-clock"></i>
          待审批详情
        </h4>
        <el-tag type="warning" size="small">
          共 {{ totalPending }} 条待处理
        </el-tag>
      </div>

      <div class="approval-list">
        <!-- 考勤申请 -->
        <div v-for="item in attendanceList" :key="`attendance-${item.id}`" class="approval-item" @click="viewDetail(item)">
          <div class="item-icon">
            <i :class="getTypeIcon(item.record_type)"></i>
          </div>
          <div class="item-content">
            <div class="item-title">{{ getRecordTypeName(item.record_type) }}</div>
            <div class="item-info">
              <span class="employee-name">{{ item.employee_name || item.employee_username }}</span>
              <span class="record-date" :class="{ 'invalid-date': isInvalidDate(item.record_date) }">
                {{ formatDate(item.record_date) }}
              </span>
              <span v-if="item.record_type === 'monthly_leave'" class="record-days">
                休假 {{ item.monthly_leave_days || item.leave_days || 0 }} 天
              </span>
              <span v-else-if="item.record_type === 'overtime'" class="record-hours">
                加班 {{ item.overtime_hours || 0 }} 小时
              </span>
              <span v-else class="record-days">
                请假 {{ item.leave_days || 0 }} 天
              </span>
            </div>
          </div>
          <div class="item-time">
            <el-tag type="warning" size="small">待审批</el-tag>
            <span class="time-text">{{ formatTime(item.created_at) }}</span>
          </div>
        </div>

        <el-empty v-if="attendanceList.length === 0" description="暂无待审批记录" :image-size="60" />
      </div>

      <div class="detail-actions">
        <el-button type="primary" size="small" @click="goToAttendance()">
          查看全部
          <i class="fas fa-arrow-right"></i>
        </el-button>
      </div>
    </div>

    <!-- 无待审批状态 -->
    <div v-else class="no-approvals">
      <el-empty description="暂无待审批申请" :image-size="80">
        <template #description>
          <p class="no-approvals-text">所有考勤申请已处理完成</p>
        </template>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { unifiedApi } from '@/utils/unified-api'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { storage } from '@/services/storage'
import { SESSION_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

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
const { warning } = useNotification()

// 响应式数据
const loading = ref(false)
const attendanceList = ref<PendingApprovalItem[]>([])
const attendanceCount = ref(0)
const leaveCount = ref(0)
const overtimeCount = ref(0)

// 计算属性
const totalPending = computed(() => {
  return attendanceCount.value + leaveCount.value + overtimeCount.value
})

// 获取待审批数据
const fetchPendingApprovals = async () => {
  if (loading.value) return

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
    messages.push(`${leaveCount.value}条休假申请`)
  }
  if (attendanceCount.value > 0 && attendanceCount.value !== leaveCount.value) {
    messages.push(`${attendanceCount.value - leaveCount.value}条考勤申请`)
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
      return date.toLocaleDateString('zh-CN')
    }
  }
}

// 轮询定时器
let pollTimer: ReturnType<typeof setInterval> | null = null

// 生命周期
onMounted(() => {
  fetchPendingApprovals()

  // 每5分钟自动刷新
  pollTimer = setInterval(() => {
    fetchPendingApprovals()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

// 暴露刷新方法供父组件调用
defineExpose({
  refresh: fetchPendingApprovals
})
</script>

<style lang="scss" scoped>
.pending-approvals {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

  .approvals-overview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    padding: 20px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);

    .overview-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 15px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 2px solid transparent;
      position: relative;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
      }

      &.has-pending {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
        }
        50% {
          box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
        }
      }

      .card-icon {
        width: 45px;
        height: 45px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: white;

        &.attendance {
          background: linear-gradient(135deg, #667eea, #764ba2);
        }

        &.leave {
          background: linear-gradient(135deg, #f093fb, #f5576c);
        }

        &.overtime {
          background: linear-gradient(135deg, #4facfe, #00f2fe);
        }
      }

      .card-content {
        flex: 1;

        .card-value {
          font-size: 24px;
          font-weight: 700;
          color: white;
          line-height: 1.2;
        }

        .card-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
        }
      }

      .card-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 24px;
        height: 24px;
        background: #ff6b6b;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        animation: bell-ring 1s ease-in-out infinite;

        @keyframes bell-ring {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(15deg);
          }
          75% {
            transform: rotate(-15deg);
          }
        }
      }
    }
  }

  .approvals-detail {
    padding: 20px;

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;

      h4 {
        margin: 0;
        font-size: 16px;
        color: #2c3e50;
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          color: #f39c12;
        }
      }
    }

    .approval-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 15px;
      max-height: 300px;
      overflow-y: auto;

      .approval-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #fff;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: #f39c12;
          box-shadow: 0 2px 8px rgba(243, 156, 18, 0.2);
          transform: translateX(2px);
        }

        .item-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .item-content {
          flex: 1;
          min-width: 0;

          .item-title {
            font-size: 14px;
            font-weight: 500;
            color: #2c3e50;
            margin-bottom: 4px;
          }

          .item-info {
            font-size: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;

            .employee-name {
              font-weight: 500;
              color: #34495e;
            }

            .record-date {
              color: #7f8c8d;

              &.invalid-date {
                color: #e74c3c;
                font-style: italic;
              }
            }

            .record-days,
            .record-hours {
              color: #e67e22;
              font-weight: 500;
            }
          }
        }

        .item-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;

          .time-text {
            font-size: 11px;
            color: #95a5a6;
          }
        }
      }
    }

    .detail-actions {
      display: flex;
      justify-content: center;
      padding-top: 10px;
      border-top: 1px solid #f0f0f0;

      .el-button {
        i {
          margin-left: 4px;
        }
      }
    }
  }

  .no-approvals {
    padding: 40px 20px;

    .no-approvals-text {
      color: #27ae60;
      font-size: 14px;
      margin-top: 10px;
    }
  }
}

// 响应式设计
@media (max-width: 767px) {
  .pending-approvals {
    .approvals-overview {
      grid-template-columns: repeat(3, 1fr);
      padding: 15px;
      gap: 10px;

      .overview-card {
        padding: 12px;

        .card-icon {
          width: 38px;
          height: 38px;
          font-size: 18px;
        }

        .card-content {
          .card-value {
            font-size: 20px;
          }

          .card-label {
            font-size: 11px;
          }
        }

        .card-badge {
          width: 20px;
          height: 20px;
          font-size: 10px;
        }
      }
    }

    .approvals-detail {
      padding: 15px;

      .approval-list {
        max-height: 250px;

        .approval-item {
          padding: 10px;

          .item-icon {
            width: 36px;
            height: 36px;
            font-size: 14px;
          }

          .item-content {
            .item-title {
              font-size: 13px;
            }

            .item-info {
              font-size: 11px;
              display: flex;
              flex-wrap: wrap;
              gap: 6px;

              .employee-name {
                font-weight: 500;
                color: #2c3e50;
              }

              .record-date {
                color: #7f8c8d;

                &.invalid-date {
                  color: #e74c3c;
                  font-style: italic;
                }
              }

              .record-days,
              .record-hours {
                color: #e67e22;
                font-weight: 500;
              }
            }
          }

          .item-time {
            .el-tag {
              display: none;
            }

            .time-text {
              font-size: 10px;
            }
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .pending-approvals {
    .approvals-overview {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
}
</style>
