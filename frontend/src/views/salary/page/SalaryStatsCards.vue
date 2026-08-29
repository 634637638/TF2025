<template>
  <div class="stats-cards">
    <div
      v-if="canViewField(moduleKey, 'stats_pending_salary')"
      class="stat-card"
    >
      <div class="stat-icon success">
        <i class="fas fa-coins" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          ¥{{ canViewTeamRecords ? stats.pendingSalary || 0 : stats.myPendingSalary || 0 }}
        </div>
        <div class="stat-label">
          待发工资
        </div>
        <div
          v-if="canViewTeamRecords"
          class="stat-desc"
        >
          {{ stats.pendingCount || 0 }} 人待发放
        </div>
      </div>
    </div>

    <div
      v-if="canViewField(moduleKey, 'stats_rest_summary')"
      class="stat-card"
    >
      <div class="stat-icon warning">
        <i class="fas fa-umbrella-beach" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          <template v-if="canViewTeamRecords">
            {{ stats.pendingCount || 0 }} 人 / {{ stats.totalRestDays || 0 }} 天
          </template>
          <template v-else>
            {{ stats.myRestQuota || 0 }} / {{ stats.myRestDays || 0 }}
          </template>
        </div>
        <div class="stat-label">
          本月休假
        </div>
        <div
          v-if="canViewTeamRecords && stats.restEmployees.length"
          class="stat-desc"
        >
          {{ stats.restEmployees.join('、') }}
        </div>
      </div>
    </div>

    <div
      v-if="canViewField(moduleKey, 'stats_leave_summary')"
      class="stat-card"
    >
      <div class="stat-icon danger">
        <i class="fas fa-user-clock" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          <template v-if="canViewTeamRecords">
            {{ stats.pendingCount || 0 }} 人 / {{ stats.totalLeaveDays || 0 }} 天
          </template>
          <template v-else>
            {{ stats.myLeaveDays || 0 }} 天 / ¥{{ stats.myLeaveDeduction || 0 }}
          </template>
        </div>
        <div class="stat-label">
          本月请假
        </div>
        <div
          v-if="canViewTeamRecords && stats.leaveEmployees.length"
          class="stat-desc"
        >
          {{ stats.leaveEmployees.join('、') }}
        </div>
      </div>
    </div>

    <div
      v-if="canViewField(moduleKey, 'stats_overtime_summary')"
      class="stat-card"
    >
      <div class="stat-icon info">
        <i class="fas fa-clock" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          <template v-if="canViewTeamRecords">
            {{ stats.pendingCount || 0 }} 人 / {{ stats.totalOvertimeHours || 0 }} 小时
          </template>
          <template v-else>
            {{ stats.myOvertimeHours || 0 }} 小时 / ¥{{ stats.myOvertimePay || 0 }}
          </template>
        </div>
        <div class="stat-label">
          本月加班
        </div>
        <div
          v-if="canViewTeamRecords && stats.overtimeEmployees.length"
          class="stat-desc"
        >
          {{ stats.overtimeEmployees.join('、') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SalaryStats {
  pendingSalary: number
  myPendingSalary: number
  pendingCount: number
  totalRestDays: number
  myRestQuota: number
  myRestDays: number
  restEmployees: string[]
  totalLeaveDays: number
  myLeaveDays: number
  myLeaveDeduction: number
  leaveEmployees: string[]
  totalOvertimeHours: number
  myOvertimeHours: number
  myOvertimePay: number
  overtimeEmployees: string[]
}

defineProps<{
  stats: SalaryStats
  moduleKey: string
  canViewTeamRecords: boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
}>()
</script>

<style scoped lang="scss">
.stat-icon.success {
  background: linear-gradient(135deg, var(--color-success) 0%, var(--tf-color-green-element-light) 100%);
}

.stat-icon.warning {
  background: linear-gradient(135deg, var(--color-warning) 0%, var(--tf-color-amber-light) 100%);
}

.stat-icon.danger {
  background: linear-gradient(135deg, var(--color-danger) 0%, var(--tf-color-red-element-pale) 100%);
}

.stat-desc {
  color: var(--color-text-placeholder);
  margin-top: 2px;
}
</style>
