<template>
  <!-- 权限检查 - 页面级访问控制 -->
  <PermissionDenied
    v-if="!canAccessPage"
    :can-view="canAccessPage"
    module-key="attendance"
    module-name="考勤管理"
    permission-code="attendance:view / attendance:view:own"
  />

  <el-config-provider v-else :locale="locale">
    <div class="page-container attendance-page admin-page">
      <PageHeader title="考勤管理">
        <template #actions>
          <div class="action-buttons">
            <el-button v-if="canCreateRequest" type="primary" @click="showCreateDialog" :disabled="loading">
              <i class="fas fa-plus"></i>
              <span>新增</span>
            </el-button>
            <el-button type="info" @click="refreshData" :disabled="loading">
              <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
              <span>刷新</span>
            </el-button>
          </div>
        </template>
      </PageHeader>

      <!-- 页面主体 -->
      <div class="page-body admin-page-content">
        <!-- 统计卡片 -->
        <div v-if="showAttendanceStatsCards" class="stats-cards">
          <!-- 上月统计 -->
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_last_month_leave')" class="stat-card">
            <div class="stat-icon blue">
              <i class="fas fa-calendar-minus"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ lastMonthStats.leaveDays || 0 }}天</div>
              <div class="stat-label">上月休假</div>
            </div>
          </div>
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_last_month_overtime')" class="stat-card">
            <div class="stat-icon purple">
              <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ lastMonthStats.overtimeHours || 0 }}小时</div>
              <div class="stat-label">上月加班</div>
            </div>
          </div>

          <!-- 本月统计 -->
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_leave')" class="stat-card">
            <div class="stat-icon success">
              <i class="fas fa-calendar-check"></i>
            </div>
            <div class="stat-content">
              <!-- 智能显示：还有可用天数显示"剩余X天假"，已休完显示"已休完X天" -->
              <div class="stat-value" v-if="!currentMonthStats.isExhausted">
                剩余 {{ currentMonthStats.availableLeaveDays || 0 }}天假
              </div>
              <div class="stat-value" v-else>
                已休完{{ currentMonthStats.usedDays || 0 }}天
              </div>
              <div class="stat-label">本月休假</div>
            </div>
          </div>
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_unpaid_leave')" class="stat-card">
            <div class="stat-icon warning">
              <i class="fas fa-calendar-times"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ currentMonthStats.leaveDays || 0 }}天</div>
              <div class="stat-label">本月请假（无薪）</div>
            </div>
          </div>
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_overtime')" class="stat-card">
            <div class="stat-icon info">
              <i class="fas fa-hourglass-half"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ currentMonthStats.overtimeHours || 0 }}小时</div>
              <div class="stat-label">本月加班</div>
            </div>
          </div>
          <div v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_pending_settlement')" class="stat-card">
            <div class="stat-icon orange">
              <i class="fas fa-hourglass-end"></i>
            </div>
            <div class="stat-content">
              <!-- 显示费用信息 -->
              <div class="stat-value">
                <template v-if="stats.pendingOvertimePay > 0 || stats.pendingLeaveDeduction > 0">
                  <span v-if="stats.pendingOvertimePay > 0" class="text-success">+¥{{ stats.pendingOvertimePay.toFixed(0) }}</span>
                  <span v-if="stats.pendingLeaveDeduction > 0" class="text-danger">-¥{{ stats.pendingLeaveDeduction.toFixed(0) }}</span>
                </template>
                <template v-else>
                  {{ stats.pending || 0 }}
                </template>
              </div>
              <div class="stat-label">待结算</div>
            </div>
          </div>
        </div>

        <!-- TAB 切换 -->
        <el-tabs v-model="activeTab" class="attendance-tabs" @tab-change="handleTabChange">
          <!-- 所有考勤（管理员） -->
          <el-tab-pane label="所有考勤" name="all" v-if="canViewAllAttendance">
            <UnifiedSearchPanel
              v-model:expanded="searchExpanded"
              :loading="loading"
              @search="loadData"
              @reset="resetFilters"
            >
              <template #primary>
                <el-input
                  placeholder="考勤记录"
                  disabled
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-calendar-check"></i>
                  </template>
                </el-input>
              </template>

              <!-- 员工筛选 -->
              <div v-if="canViewAttendanceField('attendance_attendanceview', 'employee_name')" class="form-group filter-item" data-field="employee">
                  <el-select v-model="filters.employee_id" placeholder="员工" clearable filterable>
                    <el-option
                      v-for="emp in employees"
                      :key="emp.id"
                      :label="emp.name || emp.username"
                      :value="emp.id"
                    />
                  </el-select>
              </div>

              <!-- 类型筛选 -->
              <div v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')" class="form-group filter-item" data-field="type">
                  <el-select v-model="filters.record_type" placeholder="类型" clearable>
                    <el-option label="休假" value="monthly_leave" />
                    <el-option label="请假" value="leave" />
                    <el-option label="加班" value="overtime" />
                    <el-option label="旷工" value="absent" />
                  </el-select>
              </div>

              <!-- 状态筛选 -->
              <div v-if="canViewAttendanceField('attendance_attendanceview', 'status')" class="form-group filter-item" data-field="status">
                  <el-select v-model="filters.status" placeholder="状态" clearable>
                    <el-option label="待审批" value="pending" />
                    <el-option label="已通过" value="approved" />
                    <el-option label="已拒绝" value="rejected" />
                  </el-select>
              </div>

              <!-- 日期范围筛选 -->
              <div v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')" class="form-group filter-item" data-field="date">
                  <el-date-picker
                    v-model="dateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    value-format="YYYY-MM-DD"
                    @change="handleDateRangeChange"
                  />
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive">
                <el-table ref="attendanceTableRef" :data="tableData" v-loading="loading" border stripe class="data-table" row-key="id" @row-click="handleMobileRowTap($event, 'all')">
                  <el-table-column v-if="isMobile" type="expand" width="1" class-name="mobile-expand-column">
                    <template #default="{ row }">
                      <div class="mobile-inline-actions">
                        <el-button size="small" plain type="primary" class="mobile-action-btn mobile-action-btn-view btn-sm">
                          <i class="fas fa-eye mr-1"></i><span>查看</span>
                        </el-button>
                        <el-button
                          v-if="canEdit"
                          size="small"
                          plain
                          type="primary"
                          class="mobile-action-btn mobile-action-btn-edit btn-sm"
                          @click="handleEdit(row)"
                        >
                          <i class="fas fa-edit mr-1"></i><span>{{ row.status === 'pending' ? '编辑' : '修改' }}</span>
                        </el-button>
                        <el-button
                          v-if="canApprove && row.status === 'pending'"
                          size="small"
                          plain
                          type="success"
                          class="mobile-action-btn mobile-action-btn-approve btn-sm"
                          @click="handleApprove(row)"
                        >
                          <i class="fas fa-check mr-1"></i><span>审批</span>
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          size="small"
                          type="danger"
                          @click="handleDelete(row)"
                          class="btn-sm btn-danger"
                        >
                          <i class="fas fa-trash mr-1"></i><span>删除</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showAttendanceIdColumn" prop="id" label="ID" width="80" align="center" />
                  <el-table-column v-if="showAttendanceEmployeeColumn" prop="employee_name" label="员工" :width="isMobile ? 96 : 130" align="center" />
                  <el-table-column v-if="showAttendanceTypeColumn" label="类型" :width="isMobile ? 82 : 130" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.record_type === 'monthly_leave'" type="success">
                        <i class="fas fa-umbrella-beach"></i>
                        休假
                      </el-tag>
                      <el-tag v-else-if="row.record_type === 'leave'" type="warning">
                        <i class="fas fa-user-clock"></i>
                        请假
                      </el-tag>
                      <el-tag v-else-if="row.record_type === 'overtime'" type="primary">
                        <i class="fas fa-business-time"></i>
                        加班
                      </el-tag>
                      <el-tag v-else type="danger">
                        <i class="fas fa-user-slash"></i>
                        旷工
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="showAttendanceDetailColumn"
                    label="详情"
                    :width="isMobile ? 88 : 180"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span v-if="row.record_type === 'monthly_leave'" class="detail-item">
                        <i class="fas fa-calendar-alt detail-icon"></i>
                        {{ row.monthly_leave_days }}天
                      </span>
                      <span v-else-if="row.record_type === 'leave'" class="detail-item">
                        <i class="fas fa-info-circle detail-icon"></i>
                        {{ row.leave_type || '-' }} {{ row.leave_days }}天
                      </span>
                      <span v-else-if="row.record_type === 'overtime'" class="detail-item">
                        <i class="fas fa-hourglass-half detail-icon"></i>
                        {{ row.overtime_hours }}小时
                      </span>
                      <span v-else class="detail-item">
                        <i class="fas fa-exclamation-triangle detail-icon"></i>
                        {{ row.absent_days }}天
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showAttendanceDateColumn" prop="record_date" label="日期" :width="isMobile ? 96 : 130" align="center" />
                  <el-table-column v-if="showAttendanceReasonColumn" label="原因" min-width="150" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span>{{ getReasonText(row) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showAttendanceStatusColumn" prop="status" label="状态" width="90" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.status === 'pending'" type="info">
                        <i class="fas fa-clock"></i>
                        待审批
                      </el-tag>
                      <el-tag v-else-if="row.status === 'approved'" type="success">
                        <i class="fas fa-check-circle"></i>
                        已通过
                      </el-tag>
                      <el-tag v-else type="danger">
                        <i class="fas fa-times-circle"></i>
                        已拒绝
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showAttendanceApprovalColumn" prop="approval_note" label="审批备注" min-width="120" show-overflow-tooltip />
                  <el-table-column v-if="showAttendanceActionField" label="操作" width="320" fixed="right" align="center">
                    <template #default="{ row }">
                      <el-button size="small" plain type="primary" @click="handleView(row)" class="btn-sm">
                        <i class="fas fa-eye mr-1"></i>查看
                      </el-button>
                      <el-button
                        size="small"
                        plain
                        type="primary"
                        @click="handleEdit(row)"
                        v-if="canEdit"
                        class="btn-sm"
                      >
                        <i class="fas fa-edit mr-1"></i>{{ row.status === 'pending' ? '编辑' : '修改' }}
                      </el-button>
                      <el-button
                        size="small"
                        plain
                        type="success"
                        @click="handleApprove(row)"
                        v-if="canApprove && row.status === 'pending'"
                        class="btn-sm"
                      >
                        <i class="fas fa-check mr-1"></i>审批
                      </el-button>
                      <el-button
                        size="small"
                        type="danger"
                        @click="handleDelete(row)"
                        v-if="canDelete"
                        class="btn-sm btn-danger"
                      >
                        <i class="fas fa-trash mr-1"></i>删除
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!loading && tableData.length === 0" class="empty-state">
                  <i class="fas fa-inbox"></i>
                  <p>暂无考勤记录</p>
                </div>
              </div>

              <!-- 分页 -->
              <Pagination
                v-if="pagination.total > 0"
                v-model:current="pagination.page"
                v-model:page-size="pagination.size"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100]"
                :show-total="true"
                :show-range="true"
                :show-page-sizes="true"
                :show-quick-jumper="true"
                :disabled="loading"
                @change="handlePaginationChange"
              />
            </div>
          </el-tab-pane>

          <!-- 我的考勤（所有用户） -->
          <el-tab-pane label="我的考勤" name="my" v-if="canViewOwnAttendance">
            <UnifiedSearchPanel
              v-model:expanded="mySearchExpanded"
              :loading="myLoading"
              @search="loadMyData"
              @reset="resetMyFilters"
            >
              <template #primary>
                <el-input
                  placeholder="我的考勤记录"
                  disabled
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-user-clock"></i>
                  </template>
                </el-input>
              </template>

              <!-- 类型筛选 -->
              <div v-if="canViewAttendanceField('attendance_myattendanceview', 'record_type')" class="form-group filter-item" data-field="type">
                  <el-select v-model="myFilters.record_type" placeholder="类型" clearable>
                    <el-option label="休假" value="monthly_leave" />
                    <el-option label="请假" value="leave" />
                    <el-option label="加班" value="overtime" />
                    <el-option label="旷工" value="absent" />
                  </el-select>
              </div>

              <!-- 状态筛选 -->
              <div v-if="canViewAttendanceField('attendance_myattendanceview', 'status')" class="form-group filter-item" data-field="status">
                  <el-select v-model="myFilters.status" placeholder="状态" clearable>
                    <el-option label="待审批" value="pending" />
                    <el-option label="已通过" value="approved" />
                    <el-option label="已拒绝" value="rejected" />
                  </el-select>
              </div>

              <!-- 日期范围筛选 -->
              <div v-if="canViewAttendanceField('attendance_myattendanceview', 'record_date')" class="form-group filter-item" data-field="date">
                  <el-date-picker
                    v-model="myDateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    value-format="YYYY-MM-DD"
                    @change="handleMyDateRangeChange"
                  />
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive">
                <el-table ref="myAttendanceTableRef" :data="myTableData" v-loading="myLoading" border stripe class="data-table" row-key="id" @row-click="handleMobileRowTap($event, 'my')">
                  <el-table-column v-if="isMobile" type="expand" width="1" class-name="mobile-expand-column">
                    <template #default="{ row }">
                      <div class="mobile-inline-actions">
                        <el-button size="small" plain type="primary" class="mobile-action-btn mobile-action-btn-view btn-sm">
                          <i class="fas fa-eye mr-1"></i><span>查看</span>
                        </el-button>
                        <el-button
                          v-if="row.status === 'pending'"
                          size="small"
                          type="danger"
                          @click="handleCancel(row)"
                          class="btn-sm btn-danger"
                        >
                          <i class="fas fa-times mr-1"></i><span>撤销</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showMyAttendanceIdColumn" prop="id" label="ID" width="80" align="center" />
                  <el-table-column v-if="showMyAttendanceTypeColumn" label="类型" :width="isMobile ? 88 : 130" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.record_type === 'monthly_leave'" type="success">
                        <i class="fas fa-umbrella-beach"></i>
                        休假
                      </el-tag>
                      <el-tag v-else-if="row.record_type === 'leave'" type="warning">
                        <i class="fas fa-user-clock"></i>
                        请假
                      </el-tag>
                      <el-tag v-else-if="row.record_type === 'overtime'" type="primary">
                        <i class="fas fa-business-time"></i>
                        加班
                      </el-tag>
                      <el-tag v-else type="danger">
                        <i class="fas fa-user-slash"></i>
                        旷工
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="showMyAttendanceDetailColumn"
                    label="详情"
                    :width="isMobile ? 92 : 180"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span v-if="row.record_type === 'monthly_leave'" class="detail-item">
                        <i class="fas fa-calendar-alt detail-icon"></i>
                        {{ row.monthly_leave_days }}天
                      </span>
                      <span v-else-if="row.record_type === 'leave'" class="detail-item">
                        <i class="fas fa-info-circle detail-icon"></i>
                        {{ row.leave_type || '-' }} {{ row.leave_days }}天
                      </span>
                      <span v-else-if="row.record_type === 'overtime'" class="detail-item">
                        <i class="fas fa-hourglass-half detail-icon"></i>
                        {{ row.overtime_hours }}小时
                      </span>
                      <span v-else class="detail-item">
                        <i class="fas fa-exclamation-triangle detail-icon"></i>
                        {{ row.absent_days }}天
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showMyAttendanceDateColumn" prop="record_date" label="日期" :width="isMobile ? 104 : 130" align="center" />
                  <el-table-column v-if="showMyAttendanceReasonColumn" label="原因" min-width="150" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span>{{ getReasonText(row) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showMyAttendanceStatusColumn" prop="status" label="状态" width="90" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.status === 'pending'" type="info">
                        <i class="fas fa-clock"></i>
                        待审批
                      </el-tag>
                      <el-tag v-else-if="row.status === 'approved'" type="success">
                        <i class="fas fa-check-circle"></i>
                        已通过
                      </el-tag>
                      <el-tag v-else type="danger">
                        <i class="fas fa-times-circle"></i>
                        已拒绝
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="showMyAttendanceApprovalColumn" prop="approval_note" label="审批备注" min-width="140" show-overflow-tooltip />
                  <el-table-column v-if="showMyAttendanceActionField" label="操作" width="160" fixed="right" align="center">
                    <template #default="{ row }">
                      <el-button size="small" plain type="primary" @click="handleView(row)" class="btn-sm">
                        <i class="fas fa-eye mr-1"></i>查看
                      </el-button>
                      <el-button
                        size="small"
                        type="danger"
                        @click="handleCancel(row)"
                        v-if="row.status === 'pending'"
                        class="btn-sm btn-danger"
                      >
                        <i class="fas fa-times mr-1"></i>撤销
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!myLoading && myTableData.length === 0" class="empty-state">
                  <i class="fas fa-inbox"></i>
                  <p>暂无考勤记录</p>
                  <el-button v-if="canCreateRequest" plain type="primary" @click="showCreateDialog" class="btn-sm">
                    <i class="fas fa-plus mr-1"></i>新增申请
                  </el-button>
                </div>
              </div>

              <!-- 分页 -->
              <Pagination
                v-if="myPagination.total > 0"
                v-model:current="myPagination.page"
                v-model:page-size="myPagination.size"
                :total="myPagination.total"
                :page-sizes="[10, 20, 50, 100]"
                :show-total="true"
                :show-range="true"
                :show-page-sizes="true"
                :show-quick-jumper="true"
                :disabled="myLoading"
                @change="handleMyPaginationChange"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 新增/编辑对话框 -->
      <MobileDialog
        v-model="dialogVisible"
        :title="dialogTitle"
        width="800px"
        dialog-class="attendance-form-dialog"
        :close-on-click-modal="false"
        @close="dialogVisible = false"
        :show-default-footer="false"
      >
        <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px" class="attendance-dialog-form">
          <!-- 可管理记录时允许为指定员工建单 -->
          <el-form-item v-if="canManageAttendanceRecords && canViewAttendanceField('attendance_attendanceview', 'employee_id')" label="选择员工" prop="employee_id">
            <el-select
              v-model="formData.employee_id"
              placeholder="请选择员工"
              filterable
              class="w-full"
              :disabled="!!formData.id"
            >
              <el-option
                v-for="emp in employees"
                :key="emp.id"
                :label="emp.name || emp.username"
                :value="emp.id"
              >
                <span>{{ emp.name || emp.username }}</span>
                <span class="text-secondary text-xs ml-2">
                  {{ emp.username }}
                </span>
              </el-option>
            </el-select>
            <span v-if="formData.id" class="text-secondary text-xs ml-2">
              编辑时不可更改员工
            </span>
          </el-form-item>

          <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')" label="记录类型" prop="record_type">
            <el-radio-group v-model="formData.record_type" @change="handleRecordTypeChange" :disabled="!canEditAttendanceField('attendance_attendanceview', 'record_type')">
              <el-radio value="monthly_leave">
                <i class="fas fa-umbrella-beach"></i>
                休假
              </el-radio>
              <el-radio value="leave">
                <i class="fas fa-user-clock"></i>
                请假
              </el-radio>
              <el-radio value="overtime">
                <i class="fas fa-business-time"></i>
                加班
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 休假表单 -->
          <template v-if="formData.record_type === 'monthly_leave'">
            <el-form-item label="休假说明">
              <el-alert
                :title="`您的月休假有${leaveBalance?.monthlyLimit || 2}天${canViewAllAttendance ? '（所有额度）' : ''}`"
                :type="leaveBalance?.lastMonthRemaining && leaveBalance.lastMonthRemaining > 0 ? 'success' : 'info'"
                :closable="false"
              />
              <div class="mt-2 text-sm text-regular">
                <div>上月休假：{{ leaveBalance?.monthlyHistory?.[0]?.used || 0 }} 天，请假：{{ leaveBalance?.monthlyHistory?.[0]?.regularLeaveDays || 0 }} 天</div>
                <div>本月休假：{{ leaveBalance?.used || 0 }} 天，剩余休假：{{ leaveBalance?.available || 0 }} 天</div>
                <div class="text-secondary">超过可用天数的部分将自动转为请假（无薪，扣工资）。</div>
              </div>
            </el-form-item>
            <div v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')" class="attendance-date-range-grid">
              <el-form-item label="开始日期" prop="record_date">
                <el-date-picker
                  v-model="leaveStartDate"
                  type="date"
                  placement="top-start"
                  placeholder="开始日期"
                  value-format="YYYY-MM-DD"
                  teleported
                  popper-class="attendance-dialog-popper"
                  class="w-full"
                  @change="handleLeaveBoundaryChange('start', $event)"
                />
              </el-form-item>
              <el-form-item label="结束日期">
                <el-date-picker
                  v-model="leaveEndDate"
                  type="date"
                  placement="top-start"
                  placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  teleported
                  popper-class="attendance-dialog-popper"
                  class="w-full"
                  @change="handleLeaveBoundaryChange('end', $event)"
                />
              </el-form-item>
            </div>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'monthly_leave_days')" label="休假天数">
              <span class="days-display">{{ formData.monthly_leave_days }} 天</span>
              <span class="date-range" v-if="leaveDateRange && leaveDateRange.length === 2">
                ({{ leaveDateRange[0] }} 至 {{ leaveDateRange[1] }})
              </span>
              <el-tag
                v-if="formData.monthly_leave_days > (leaveBalance?.available || 0)"
                type="warning"
                class="ml-2"
              >
                超过可用天数 {{ formData.monthly_leave_days - (leaveBalance?.available || 0) }} 天
              </el-tag>
            </el-form-item>
          </template>

          <!-- 请假表单 -->
          <template v-if="formData.record_type === 'leave'">
            <el-form-item label="请假说明">
              <el-alert
                title="扣除当天平均日薪 × 请假天数，请假期间无提成"
                type="warning"
                :closable="false"
              />
            </el-form-item>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'leave_type')" label="请假类型" prop="leave_type">
              <el-select v-model="formData.leave_type" placeholder="请选择" class="w-full" :disabled="!canEditAttendanceField('attendance_attendanceview', 'leave_type')">
                <el-option label="事假" value="事假" />
                <el-option label="病假" value="病假" />
                <el-option label="年假" value="年假" />
                <el-option label="调休" value="调休" />
              </el-select>
            </el-form-item>
            <div v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')" class="attendance-date-range-grid">
              <el-form-item label="开始日期" prop="record_date">
                <el-date-picker
                  v-model="leaveStartDate"
                  type="date"
                  placement="top-start"
                  placeholder="开始日期"
                  value-format="YYYY-MM-DD"
                  teleported
                  popper-class="attendance-dialog-popper"
                  class="w-full"
                  @change="handleLeaveBoundaryChange('start', $event)"
                />
              </el-form-item>
              <el-form-item label="结束日期">
                <el-date-picker
                  v-model="leaveEndDate"
                  type="date"
                  placement="top-start"
                  placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  teleported
                  popper-class="attendance-dialog-popper"
                  class="w-full"
                  @change="handleLeaveBoundaryChange('end', $event)"
                />
              </el-form-item>
            </div>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'leave_days')" label="请假天数">
              <span class="days-display">{{ formData.leave_days }} 天</span>
              <span class="date-range" v-if="leaveDateRange && leaveDateRange.length === 2">
                ({{ leaveDateRange[0] }} 至 {{ leaveDateRange[1] }})
              </span>
              <el-tag type="danger" class="ml-2">无薪,扣工资</el-tag>
            </el-form-item>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'reason')" label="请假原因" prop="leave_reason">
              <el-input v-model="formData.leave_reason" type="textarea" :rows="3" placeholder="请说明请假原因" :disabled="!canEditAttendanceField('attendance_attendanceview', 'reason')" />
            </el-form-item>
          </template>

          <!-- 加班表单 -->
          <template v-if="formData.record_type === 'overtime'">
            <el-form-item label="加班说明">
              <el-alert
                title="加班按（模版设置的加班费）× 加班时间，计入当月工资"
                type="success"
                :closable="false"
              />
            </el-form-item>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')" label="加班日期" prop="record_date">
              <el-date-picker
                v-model="formData.record_date"
                type="date"
                placement="top-start"
                placeholder="选择加班日期"
                value-format="YYYY-MM-DD"
                teleported
                popper-class="attendance-dialog-popper"
                class="w-full"
              />
            </el-form-item>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'overtime_hours')" label="加班时长" prop="overtime_hours">
              <el-input-number v-model="formData.overtime_hours" :min="0.5" :max="24" :step="0.5" :precision="1" class="w-full" :disabled="!canEditAttendanceField('attendance_attendanceview', 'overtime_hours')" />
              <span class="ml-2 text-secondary">小时</span>
              <el-tag type="success" class="ml-2">有加班费</el-tag>
            </el-form-item>
            <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'reason')" label="加班原因" prop="overtime_reason">
              <el-input v-model="formData.overtime_reason" type="textarea" :rows="3" placeholder="请说明加班原因" :disabled="!canEditAttendanceField('attendance_attendanceview', 'reason')" />
            </el-form-item>
          </template>
        </el-form>

        <template #footer>
          <el-button plain type="default" @click="dialogVisible = false" class="btn-sm">
            <i class="fas fa-times mr-1"></i>取消
          </el-button>
          <el-button plain type="primary" @click="handleSubmit" :disabled="submitting" :loading="submitting" class="btn-sm">
            <i v-if="submitting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-paper-plane mr-1"></i>提交申请
          </el-button>
        </template>
      </MobileDialog>

      <!-- 详情对话框 -->
      <MobileDialog
        v-model="detailDialogVisible"
        title="考勤详情"
        width="700px"
        dialog-class="attendance-detail-dialog"
        :close-on-click-modal="false"
        @close="detailDialogVisible = false"
        :show-default-footer="false"
      >
        <el-descriptions :column="isMobile ? 1 : 2" border v-if="currentRecord" class="attendance-detail-descriptions">
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')" label="类型">
            <el-tag v-if="currentRecord.record_type === 'monthly_leave'" type="success">休假</el-tag>
            <el-tag v-else-if="currentRecord.record_type === 'leave'" type="warning">请假</el-tag>
            <el-tag v-else-if="currentRecord.record_type === 'overtime'" type="primary">加班</el-tag>
            <el-tag v-else type="danger">旷工</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')" label="日期">{{ currentRecord.record_date }}</el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'leave_type') && currentRecord.leave_type" label="请假类型">
            {{ currentRecord.leave_type }}
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'leave_days') && currentRecord.leave_days" label="请假天数">
            {{ currentRecord.leave_days }} 天
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'overtime_hours') && currentRecord.overtime_hours" label="加班时长">
            {{ currentRecord.overtime_hours }} 小时
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'absent_days') && currentRecord.absent_days" label="旷工天数">
            {{ currentRecord.absent_days }} 天
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'reason')" label="原因" :span="2">
            {{ getReasonText(currentRecord) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'status')" label="状态">
            <el-tag v-if="currentRecord.status === 'pending'" type="info">待审批</el-tag>
            <el-tag v-else-if="currentRecord.status === 'approved'" type="success">已通过</el-tag>
            <el-tag v-else type="danger">已拒绝</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="canViewAttendanceField('attendance_attendanceview', 'approval_note') && currentRecord.approval_note" label="审批备注" :span="2">
            {{ currentRecord.approval_note }}
          </el-descriptions-item>
        </el-descriptions>

        <template #footer>
          <el-button plain type="default" @click="detailDialogVisible = false" class="btn-sm">
            <i class="fas fa-times mr-1"></i>关闭
          </el-button>
        </template>
      </MobileDialog>

      <!-- 审批对话框 -->
      <MobileDialog
        v-model="approveDialogVisible"
        title="审批考勤记录"
        width="600px"
        dialog-class="attendance-approve-dialog"
        :close-on-click-modal="false"
        @close="approveDialogVisible = false"
        :show-default-footer="false"
      >
        <el-form :model="approveForm" label-width="100px">
          <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'status')" label="审批结果">
            <el-radio-group v-model="approveForm.status" :disabled="!canEditAttendanceField('attendance_attendanceview', 'status')">
              <el-radio value="approved">
                <i class="fas fa-check-circle text-success mr-1"></i>
                通过
              </el-radio>
              <el-radio value="rejected">
                <i class="fas fa-times-circle text-danger mr-1"></i>
                拒绝
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="canViewAttendanceField('attendance_attendanceview', 'approval_note')" label="审批备注">
            <el-input
              v-model="approveForm.note"
              type="textarea"
              :rows="3"
              placeholder="请输入审批备注(可选)"
              :disabled="!canEditAttendanceField('attendance_attendanceview', 'approval_note')"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button plain type="default" @click="approveDialogVisible = false" class="btn-sm">
            <i class="fas fa-times mr-1"></i>取消
          </el-button>
          <el-button plain type="success" @click="handleApproveSubmit" :disabled="approving" :loading="approving" class="btn-sm">
            <i v-if="approving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-check mr-1"></i>确认
          </el-button>
        </template>
      </MobileDialog>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, ElConfigProvider, type FormRules } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { attendanceApi } from '@/api/attendance'
import type { AttendanceRecord } from '@/api/attendance'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/useMobile'
import { useLoadingState } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { formatDate } from '@/utils/format'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionDenied } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import dayjs from 'dayjs'

interface AttendanceTableRow extends Omit<
  AttendanceRecord,
  'leave_days' | 'overtime_hours' | 'absent_days' | 'monthly_leave_days'
> {
  employee_name?: string
  leave_days?: number | string
  overtime_hours?: number | string
  absent_days?: number | string
  monthly_leave_days?: number | string
}

interface SalaryTemplateSummary {
  base_salary?: number | string
  overtime_hourly_rate?: number | string
}

interface EmployeeOption {
  id: number
  name?: string
  username?: string
  salary_template?: SalaryTemplateSummary
  salary_template_id?: number
}

interface LeaveHistoryItem {
  hasRegularLeave?: boolean
  used?: number
  regularLeaveDays?: number
}

interface LeaveBalanceInfo {
  available?: number
  used?: number
  monthlyLimit?: number
  lastMonthRemaining?: number
  monthlyHistory?: LeaveHistoryItem[]
}

// 配置中文语言环境
const locale = zhCn
// 权限检查
const {
  canView,
  canCreate: canCreatePermission,
  canEdit,
  canDelete,
  canApprove: canApprovePermission,
  canManage: canManagePermission,
  handleNoPermission: handleAttendanceNoPermission
} = usePagePermissions('attendance')
const myAttendancePermissions = usePagePermissions('my-attendance')
const salaryTemplatePermissions = usePagePermissions('salary-templates')
const { init: initFieldPermissions } = fieldPermissions

const authStore = useAuthStore()
const canViewAllAttendance = computed(() => canView.value)
const canViewOwnAttendance = computed(() => myAttendancePermissions.canView.value)
const canCreateOwnAttendance = computed(() => myAttendancePermissions.canCreate.value)
const canAccessPage = computed(() => canViewAllAttendance.value || canViewOwnAttendance.value)
const canCreateRequest = computed(() => canCreatePermission.value || canCreateOwnAttendance.value)
const canReadSalaryTemplateDetails = computed(() => salaryTemplatePermissions.canView.value)
const { success, error, warning } = useNotification()
const { isMobile } = useMobile()
const { loading } = useLoadingState()
const myLoading = ref(false)
const submitting = ref(false)
const approving = ref(false)
const tableData = ref<AttendanceTableRow[]>([])
const myTableData = ref<AttendanceTableRow[]>([])
const employees = ref<EmployeeOption[]>([])
const dateRange = ref<[string, string] | null>(null)
const myDateRange = ref<[string, string] | null>(null)
const leaveDateRange = ref<[string, string] | null>(null)
const leaveStartDate = ref('')
const leaveEndDate = ref('')
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const approveDialogVisible = ref(false)
const dialogTitle = ref('')
const attendanceTableRef = ref()
const myAttendanceTableRef = ref()
const mobileExpandedAttendanceId = ref<number | null>(null)
const mobileExpandedMyAttendanceId = ref<number | null>(null)
const lastTappedAttendanceId = ref<number | null>(null)
const lastTappedAttendanceScope = ref<'all' | 'my' | null>(null)
const lastTapTimestamp = ref(0)
const formRef = ref()
const activeTab = ref('my')

// 搜索相关状态
const searchExpanded = ref(false)
const mySearchExpanded = ref(false)
const currentRecord = ref<AttendanceTableRow | null>(null)
const leaveBalance = ref<LeaveBalanceInfo | null>(null)
const monthlyLeaveDays = ref(2) // 每月休假天数配置（默认2天）

// 统计数据
const stats = ref({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  // 待审批费用统计
  pendingOvertimePay: 0,    // 待审批加班费
  pendingLeaveDeduction: 0   // 待审批请假扣款
})

// 上月统计数据
const lastMonthStats = ref({
  leaveDays: 0,
  overtimeHours: 0
})

// 本月统计数据
const currentMonthStats = ref({
  availableLeaveDays: 0,  // 可用休假天数
  totalLeaveDays: 0,       // 总休假天数
  leaveDays: 0,            // 无薪请假天数
  overtimeHours: 0,        // 加班小时数
  usedDays: 0,             // 已休天数
  isExhausted: false       // 是否已休完
})

// 审批表单
const approveForm = reactive({
  status: 'approved' as 'approved' | 'rejected',
  note: ''
})

// 具备页面查看能力且拥有任一管理动作时，可管理全员考勤记录。
const canManageAttendanceRecords = computed(() => canViewAllAttendance.value)

const canViewTeamAttendance = computed(() => canViewAllAttendance.value)
const canApprove = computed(() => canApprovePermission.value || canManagePermission.value)

const attendanceFieldMap: Record<string, string> = {
  stats_last_month_leave: 'stats.last_month_leave',
  stats_last_month_overtime: 'stats.last_month_overtime',
  stats_current_month_leave: 'stats.current_month_leave',
  stats_current_month_unpaid_leave: 'stats.current_month_unpaid_leave',
  stats_current_month_overtime: 'stats.current_month_overtime',
  stats_pending_settlement: 'stats.pending_settlement',
  id: 'attendance.id',
  employee_id: 'attendance.employee_id',
  employee_name: 'attendance.employee_name',
  record_date: 'attendance.record_date',
  record_type: 'attendance.record_type',
  leave_type: 'attendance.leave_type',
  leave_days: 'attendance.leave_days',
  monthly_leave_days: 'attendance.monthly_leave_days',
  overtime_hours: 'attendance.overtime_hours',
  absent_days: 'attendance.absent_days',
  reason: 'attendance.reason',
  status: 'attendance.status',
  approval_note: 'attendance.approval_note',
  actions: 'system_info.operations'
}

const getAttendanceFieldKey = (fieldName: string) => attendanceFieldMap[fieldName] || fieldName
const canViewAttendanceField = (moduleKey: string, fieldName: string) => {
  return fieldPermissions.isFieldVisible(moduleKey, getAttendanceFieldKey(fieldName))
}
const canEditAttendanceField = (moduleKey: string, fieldName: string) => {
  if (!canViewAttendanceField(moduleKey, fieldName)) {
    return false
  }

  if (canCreatePermission.value || canEdit.value || canApprove.value) {
    return true
  }

  return fieldPermissions.isFieldEditable(moduleKey, getAttendanceFieldKey(fieldName))
}
const attendanceStatsModuleKey = computed(() => (
  canViewTeamAttendance.value ? 'attendance_attendanceview' : 'attendance_myattendanceview'
))
const showAttendanceStatsCards = computed(() => (
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_last_month_leave') ||
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_last_month_overtime') ||
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_current_month_leave') ||
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_current_month_unpaid_leave') ||
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_current_month_overtime') ||
  canViewAttendanceField(attendanceStatsModuleKey.value, 'stats_pending_settlement')
))
const showAttendanceIdColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'id') && !isMobile.value)
const showAttendanceEmployeeColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'employee_name'))
const showAttendanceTypeColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'record_type'))
const showAttendanceDateColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'record_date'))
const showAttendanceDetailColumn = computed(() => (
  canViewAttendanceField('attendance_attendanceview', 'monthly_leave_days') ||
  canViewAttendanceField('attendance_attendanceview', 'leave_type') ||
  canViewAttendanceField('attendance_attendanceview', 'leave_days') ||
  canViewAttendanceField('attendance_attendanceview', 'overtime_hours') ||
  canViewAttendanceField('attendance_attendanceview', 'absent_days')
))
const showAttendanceReasonColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'reason') && !isMobile.value)
const showAttendanceStatusColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'status') && !isMobile.value)
const showAttendanceApprovalColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'approval_note') && !isMobile.value)
const showAttendanceActionField = computed(() => canViewAttendanceField('attendance_attendanceview', 'actions') && !isMobile.value)

const showMyAttendanceIdColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'id') && !isMobile.value)
const showMyAttendanceTypeColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'record_type'))
const showMyAttendanceDateColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'record_date'))
const showMyAttendanceDetailColumn = computed(() => (
  canViewAttendanceField('attendance_myattendanceview', 'monthly_leave_days') ||
  canViewAttendanceField('attendance_myattendanceview', 'leave_type') ||
  canViewAttendanceField('attendance_myattendanceview', 'leave_days') ||
  canViewAttendanceField('attendance_myattendanceview', 'overtime_hours') ||
  canViewAttendanceField('attendance_myattendanceview', 'absent_days')
))
const showMyAttendanceReasonColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'reason') && !isMobile.value)
const showMyAttendanceStatusColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'status') && !isMobile.value)
const showMyAttendanceApprovalColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'approval_note') && !isMobile.value)
const showMyAttendanceActionField = computed(() => canViewAttendanceField('attendance_myattendanceview', 'actions') && !isMobile.value)
const attendanceVisibleColumnCount = computed(() => {
  return [
    showAttendanceIdColumn.value,
    showAttendanceEmployeeColumn.value,
    showAttendanceTypeColumn.value,
    showAttendanceDateColumn.value,
    showAttendanceDetailColumn.value,
    showAttendanceReasonColumn.value,
    showAttendanceStatusColumn.value,
    showAttendanceApprovalColumn.value,
    showAttendanceActionField.value
  ].filter(Boolean).length || 1
})
const myAttendanceVisibleColumnCount = computed(() => {
  return [
    showMyAttendanceIdColumn.value,
    showMyAttendanceTypeColumn.value,
    showMyAttendanceDateColumn.value,
    showMyAttendanceDetailColumn.value,
    showMyAttendanceReasonColumn.value,
    showMyAttendanceStatusColumn.value,
    showMyAttendanceApprovalColumn.value,
    showMyAttendanceActionField.value
  ].filter(Boolean).length || 1
})

const filters = reactive({
  employee_id: undefined,
  record_type: undefined,
  status: undefined,
  start_date: undefined,
  end_date: undefined
})

const myFilters = reactive({
  record_type: undefined,
  status: undefined,
  start_date: undefined,
  end_date: undefined
})

const hasFilterValue = (value: unknown) => value !== undefined && value !== null && value !== ''

const buildAttendanceQueryParams = (
  moduleKey: 'attendance_attendanceview' | 'attendance_myattendanceview',
  sourceFilters: typeof filters | typeof myFilters,
  pager: { page: number; size: number },
  range: [string, string] | null
) => {
  const filterState = sourceFilters as typeof filters
  const params: Record<string, string | number> = {
    page: pager.page,
    limit: pager.size
  }

  if (moduleKey === 'attendance_attendanceview' && canViewAttendanceField(moduleKey, 'employee_name') && hasFilterValue(filterState.employee_id)) {
    params.employee_id = filterState.employee_id
  }

  if (canViewAttendanceField(moduleKey, 'record_type') && hasFilterValue(sourceFilters.record_type)) {
    params.record_type = sourceFilters.record_type
  }

  if (canViewAttendanceField(moduleKey, 'status') && hasFilterValue(sourceFilters.status)) {
    params.status = sourceFilters.status
  }

  if (canViewAttendanceField(moduleKey, 'record_date') && range?.length === 2) {
    params.start_date = range[0]
    params.end_date = range[1]
  }

  return params
}

const syncVisibleAttendanceFilters = () => {
  if (!canViewAttendanceField('attendance_attendanceview', 'employee_name')) {
    filters.employee_id = undefined
  }
  if (!canViewAttendanceField('attendance_attendanceview', 'record_type')) {
    filters.record_type = undefined
  }
  if (!canViewAttendanceField('attendance_attendanceview', 'status')) {
    filters.status = undefined
  }
  if (!canViewAttendanceField('attendance_attendanceview', 'record_date')) {
    filters.start_date = undefined
    filters.end_date = undefined
    dateRange.value = null
  }

  if (!canViewAttendanceField('attendance_myattendanceview', 'record_type')) {
    myFilters.record_type = undefined
  }
  if (!canViewAttendanceField('attendance_myattendanceview', 'status')) {
    myFilters.status = undefined
  }
  if (!canViewAttendanceField('attendance_myattendanceview', 'record_date')) {
    myFilters.start_date = undefined
    myFilters.end_date = undefined
    myDateRange.value = null
  }
}

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const myPagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const formData = reactive<AttendanceRecord>({
  id: undefined,
  employee_id: undefined,
  record_type: 'monthly_leave',
  record_date: '',
  leave_type: '',
  leave_days: 1,
  leave_reason: '',
  overtime_hours: 2,
  overtime_reason: '',
  absent_days: 1,
  absent_reason: '',
  monthly_leave_days: 1,
  status: 'pending'
})

const formRules = computed(() => {
  const rules: FormRules = {
    record_type: [{ required: true, message: '请选择记录类型', trigger: 'change' }],
    leave_type: [{ required: true, message: '请选择请假类型', trigger: 'change' }],
    leave_days: [{ required: true, message: '请输入请假天数', trigger: 'change' }],
    leave_reason: [{ required: true, message: '请输入请假原因', trigger: 'blur' }],
    record_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
    overtime_hours: [{ required: true, message: '请输入加班时长', trigger: 'change' }],
    overtime_reason: [{ required: true, message: '请输入加班原因', trigger: 'blur' }]
  }

  // 管理记录时，员工选择必填
  if (canManageAttendanceRecords.value) {
    rules.employee_id = [{ required: true, message: '请选择员工', trigger: 'change' }]
  }

  return rules
})

// 日期范围变化处理（重置分页并加载数据）
const handleDateRangeChange = () => {
  pagination.page = 1
  loadData()
}

const handleMyDateRangeChange = () => {
  myPagination.page = 1
  loadMyData()
}

const loadData = async () => {
  if (!canViewAllAttendance.value) {
    tableData.value = []
    pagination.total = 0
    return
  }

  loading.value = true
  try {
    const params = buildAttendanceQueryParams('attendance_attendanceview', filters, pagination, dateRange.value)
    const response = await attendanceApi.getAttendanceRecords(params)

    if (response.data) {
      tableData.value = Array.isArray(response.data.records) ? response.data.records as AttendanceTableRow[] : []
      pagination.total = parseInt(response.data.pagination?.total) || 0

      // 更新统计
      updateStats(tableData.value)
      // 加载待结算费用统计
      loadPendingStats()
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const loadMyData = async () => {
  if (!canViewOwnAttendance.value) {
    myTableData.value = []
    myPagination.total = 0
    return
  }

  myLoading.value = true
  try {
    const params = buildAttendanceQueryParams('attendance_myattendanceview', myFilters, myPagination, myDateRange.value)
    // 使用 getMyAttendanceRecords 获取个人考勤记录
    const response = await attendanceApi.getMyAttendanceRecords(params)

    if (response.data) {
      myTableData.value = Array.isArray(response.data.records) ? response.data.records as AttendanceTableRow[] : []
      myPagination.total = parseInt(response.data.pagination?.total) || 0

      await loadLeaveBalance()

      // 更新统计（基于我的考勤数据）
      updateStats(myTableData.value)
      // 加载待结算费用统计
      loadPendingStats()
    }
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    myLoading.value = false
  }
}

// 团队考勤分页处理
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.size = pageSize
  loadData()
}

// 我的考勤分页处理
const handleMyPaginationChange = (page: number, pageSize: number) => {
  myPagination.page = page
  myPagination.size = pageSize
  loadMyData()
}

const updateStats = (data: AttendanceTableRow[]) => {
  // 基础统计
  const pendingRecords = data.filter((r) => r.status === 'pending')

  stats.value = {
    total: data.length,
    pending: pendingRecords.length,
    approved: data.filter((r) => r.status === 'approved').length,
    rejected: data.filter((r) => r.status === 'rejected').length,
    pendingOvertimePay: stats.value.pendingOvertimePay,  // 保持已有值
    pendingLeaveDeduction: stats.value.pendingLeaveDeduction  // 保持已有值
  }

  // 计算上月和本月统计
  const now = TimeUtil.now()
  const currentMonth = now.month()
  const currentYear = now.year()

  // 上月
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

  // 计算上月统计
  const lastMonthData = data.filter((r) => {
    if (!r.record_date) return false
    const recordDate = TimeUtil.parse(r.record_date)
    return recordDate.month() === lastMonth && recordDate.year() === lastMonthYear
  })

  lastMonthStats.value = {
    leaveDays: lastMonthData
      .filter((r) => r.record_type === 'monthly_leave')  // 只统计带薪休假
      .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0),
    overtimeHours: lastMonthData
      .filter((r) => r.record_type === 'overtime')
      .reduce((sum: number, r) => sum + toAttendanceNumber(r.overtime_hours, 0), 0)
  }

  // 计算本月统计
  const currentMonthData = data.filter((r) => {
    if (!r.record_date) return false
    const recordDate = new Date(r.record_date)
    if (isNaN(recordDate.getTime())) {
      return false
    }
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
  })

  // 优先使用后端按工资模板和累计规则算出的额度
  const monthlyLimit = Number(leaveBalance.value?.monthlyLimit || monthlyLeaveDays.value || 0)

  // 上月已使用的休假天数（只统计 monthly_leave 类型）
  const lastMonthUsedLeaveDays = lastMonthData
    .filter((r) => r.record_type === 'monthly_leave')
    .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0)

  const lastMonthHasRegularLeave = Boolean(leaveBalance.value?.monthlyHistory?.[0]?.hasRegularLeave)
  const lastMonthUnusedDays = typeof leaveBalance.value?.lastMonthRemaining === 'number'
    ? Number(leaveBalance.value.lastMonthRemaining || 0)
    : (lastMonthHasRegularLeave
      ? 0
      : Math.min(monthlyLimit, Math.max(0, monthlyLimit - lastMonthUsedLeaveDays)))

  // 本月总可用天数 = 本月额度 + 上月可累计额度，最多累计 2 个月
  const totalAvailableThisMonth = Math.min(monthlyLimit * 2, monthlyLimit + lastMonthUnusedDays)

  // 本月已使用的休假天数（只统计 monthly_leave 类型，带薪休假）
  const usedMonthlyLeaveDays = currentMonthData
    .filter((r) => r.record_type === 'monthly_leave')
    .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0)

  // 本月剩余可用天数
  const availableLeaveDays = Math.max(0, totalAvailableThisMonth - usedMonthlyLeaveDays)

  // 本月加班小时数
  const overtimeHours = currentMonthData
    .filter((r) => r.record_type === 'overtime')
    .reduce((sum: number, r) => sum + toAttendanceNumber(r.overtime_hours, 0), 0)

  // 计算无薪请假天数：超过总额度的部分才算无薪请假
  const unpaidLeaveDays = Math.max(0, usedMonthlyLeaveDays - totalAvailableThisMonth)

  // 如果数据库中还有直接的 leave 类型记录，也要计入无薪请假
  const directUnpaidLeaveDays = currentMonthData
    .filter((r) => r.record_type === 'leave')
    .reduce((sum: number, r) => {
      const days = Math.round(toAttendanceNumber(r.leave_days, 0))
      return sum + days
    }, 0)

  // 总无薪请假 = 超过额度的部分 + 直接标记为无薪请假的记录
  const totalUnpaidLeaveDays = unpaidLeaveDays + directUnpaidLeaveDays

  currentMonthStats.value = {
    availableLeaveDays: availableLeaveDays,
    totalLeaveDays: totalAvailableThisMonth,  // 总可用天数（含累积）
    leaveDays: totalUnpaidLeaveDays,
    overtimeHours: overtimeHours,
    usedDays: usedMonthlyLeaveDays,  // 已休天数
    isExhausted: availableLeaveDays === 0  // 是否已休完
  }
}

// 加载待结算统计（本月已审批通过的费用计算）
const loadPendingStats = async () => {
  try {
    // 获取本月已审批通过的记录（不分页，设置大的limit）
    const params: Record<string, string | number> = {
      status: 'approved',  // 已审批通过
      page: 1,
      limit: 1000
    }

    // 添加本月日期范围
    const now = TimeUtil.now()
    const firstDay = TimeUtil.startOf(now, 'month')
    const lastDay = TimeUtil.endOf(now, 'month')

    params.start_date = TimeUtil.format(firstDay, TIME_FORMATS.DATE)
    params.end_date = TimeUtil.format(lastDay, TIME_FORMATS.DATE)

    // 计算当月天数
    const daysInMonth = lastDay.date()

    // 根据用户权限决定获取哪些数据
    const canViewTeamRecords = canViewTeamAttendance.value

    const response = canViewTeamRecords
      ? await attendanceApi.getAttendanceRecords(params)
      : await attendanceApi.getMyAttendanceRecords(params)

    if (response.data && response.data.records) {
      const approvedRecords = response.data.records

      // 获取当前用户的工资模板信息
      let baseSalary = 3000  // 默认值
      let overtimeHourlyRate = 0
      try {
        // 从 operators 列表中获取当前用户的工资模板信息
        const operatorsResponse = await unifiedApi.get('/users/operators')
        if (operatorsResponse.data) {
          const operators = Array.isArray(operatorsResponse.data?.employees)
            ? operatorsResponse.data.employees as EmployeeOption[]
            : Array.isArray(operatorsResponse.data)
              ? operatorsResponse.data as EmployeeOption[]
              : []
          const currentUser = operators.find((u) => u.id === authStore.user?.id)

          if (currentUser) {
            // 尝试从 salary_template 对象获取 base_salary（如果后端返回了完整的模板信息）
            if (currentUser.salary_template && typeof currentUser.salary_template === 'object') {
              if (currentUser.salary_template.base_salary) {
                baseSalary = parseFloat(currentUser.salary_template.base_salary)
              }
              if (currentUser.salary_template.overtime_hourly_rate) {
                overtimeHourlyRate = parseFloat(currentUser.salary_template.overtime_hourly_rate)
              }
            }
            // 或者如果有 salary_template_id，尝试获取模板详情
            else if (currentUser.salary_template_id && canReadSalaryTemplateDetails.value) {
              try {
                const templateResponse = await unifiedApi.get(`/salary-templates/${currentUser.salary_template_id}`)
                if (templateResponse.data) {
                  if (templateResponse.data.base_salary) {
                    baseSalary = parseFloat(templateResponse.data.base_salary)
                  }
                  if (templateResponse.data.overtime_hourly_rate) {
                    overtimeHourlyRate = parseFloat(templateResponse.data.overtime_hourly_rate)
                  }
                }
              } catch (templateError) {
                // 使用默认底薪
              }
            }
          }
        }
      } catch (error) {
        logger.error('❌ 获取工资信息失败，使用默认底薪:', error)
      }

      // 计算日薪 = 底薪 ÷ 当月天数
      const dailySalary = baseSalary / daysInMonth
      if (!overtimeHourlyRate) {
        overtimeHourlyRate = baseSalary / 21.75 / 8
      }

      let pendingOvertimePay = 0
      let pendingLeaveDeduction = 0

      ;(approvedRecords as AttendanceTableRow[]).forEach((record) => {
        if (record.record_type === 'overtime') {
          const hours = toAttendanceNumber(record.overtime_hours, 0)
          pendingOvertimePay += hours * overtimeHourlyRate
        } else if (record.record_type === 'leave') {
          const days = toAttendanceNumber(record.leave_days, 0)
          pendingLeaveDeduction += days * dailySalary
        } else if (record.record_type === 'monthly_leave') {
          const days = toAttendanceNumber(record.monthly_leave_days, 0)
          // 如果超过额度，超出部分算请假扣款
          if (days > monthlyLeaveDays.value) {
            const excessDays = days - monthlyLeaveDays.value
            pendingLeaveDeduction += excessDays * dailySalary
          }
        }
      })

      // 更新统计数据
      stats.value.pendingOvertimePay = pendingOvertimePay
      stats.value.pendingLeaveDeduction = pendingLeaveDeduction
    } else {
      // 没有记录时，清零费用
      stats.value.pendingOvertimePay = 0
      stats.value.pendingLeaveDeduction = 0
    }
  } catch (error) {
    logger.error('加载待结算统计失败:', error)
    // 出错时也清零
    stats.value.pendingOvertimePay = 0
    stats.value.pendingLeaveDeduction = 0
  }
}

const showCreateDialog = async () => {
  if (!canCreateRequest.value) {
    if (canViewAllAttendance.value) {
      handleAttendanceNoPermission('create')
    } else {
      myAttendancePermissions.handleNoPermission('create')
    }
    return
  }

  dialogTitle.value = canManageAttendanceRecords.value ? '新增考勤记录' : '申请考勤'
  Object.assign(formData, {
    id: undefined,
    employee_id: undefined,
    record_type: 'monthly_leave',
    record_date: '',
    leave_type: '',
    leave_days: 1,
    leave_reason: '',
    overtime_hours: 2,
    overtime_reason: '',
    absent_days: 1,
    absent_reason: '',
    monthly_leave_days: 1,
    status: 'pending'
  })
  leaveDateRange.value = null
  leaveStartDate.value = ''
  leaveEndDate.value = ''
  leaveBalance.value = null

  // 加载员工列表和休假余额
  if (canManageAttendanceRecords.value) {
    await loadEmployees()
  }
  // 所有用户都需要加载自己的休假余额
  await loadLeaveBalance()
  dialogVisible.value = true
}

const loadLeaveBalance = async (employeeId?: number | string) => {
  try {
    const normalizedEmployeeId = employeeId === '' || employeeId === null || employeeId === undefined
      ? undefined
      : Number(employeeId)
    const response = await attendanceApi.getLeaveBalance(
      Number.isFinite(normalizedEmployeeId) ? normalizedEmployeeId : undefined
    )
    // unifiedApi 返回的是 response.data
    if (response.data) {
      leaveBalance.value = response.data as LeaveBalanceInfo
    }
  } catch (error) {
    logger.error('加载休假余额失败:', error)
  }
}

const toAttendanceNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const loadLeaveConfig = async () => {
  try {
    const response = await attendanceApi.getLeaveConfig()
    if (response.data && response.data.monthlyLeaveDays) {
      monthlyLeaveDays.value = response.data.monthlyLeaveDays
    }
  } catch (error) {
    logger.error('加载休假配置失败:', error)
    // 保持默认值 2 天
  }
}

const handleEdit = (row: AttendanceTableRow) => {
  if (!canEdit.value) {
    handleAttendanceNoPermission('edit')
    return
  }

  dialogTitle.value = '编辑考勤记录'
  Object.assign(formData, {
    id: row.id,
    employee_id: row.employee_id,
    record_type: row.record_type,
    record_date: row.record_date,
    leave_type: row.leave_type || '',
    leave_days: toAttendanceNumber(row.leave_days, 1),
    leave_reason: row.leave_reason || '',
    overtime_hours: toAttendanceNumber(row.overtime_hours, 2),
    overtime_reason: row.overtime_reason || '',
    absent_days: toAttendanceNumber(row.absent_days, 1),
    absent_reason: row.absent_reason || '',
    monthly_leave_days: toAttendanceNumber(row.monthly_leave_days, 1),
    status: row.status
  })
  if (row.record_type === 'monthly_leave') {
    const rangeDays = Math.max(toAttendanceNumber(row.monthly_leave_days, 1), 1)
    leaveStartDate.value = row.record_date || ''
    leaveEndDate.value = buildAttendanceEndDate(row.record_date, rangeDays)
  } else if (row.record_type === 'leave') {
    const rangeDays = Math.max(toAttendanceNumber(row.leave_days, 1), 1)
    leaveStartDate.value = row.record_date || ''
    leaveEndDate.value = buildAttendanceEndDate(row.record_date, rangeDays)
  } else {
    leaveStartDate.value = ''
    leaveEndDate.value = ''
    leaveDateRange.value = null
  }
  syncLeaveDateRange()
  loadLeaveBalance(row.employee_id)
  dialogVisible.value = true
}

// 根据记录类型过滤提交数据
const filterSubmitData = (data: AttendanceRecord): AttendanceRecord => {
  const baseData = {
    employee_id: data.employee_id || authStore.user?.id,
    record_type: data.record_type,
    record_date: data.record_date,
    status: data.status || 'pending'
  }

  switch (data.record_type) {
    case 'monthly_leave':
      return {
        ...baseData,
        monthly_leave_days: data.monthly_leave_days
      }
    case 'leave':
      return {
        ...baseData,
        leave_type: data.leave_type,
        leave_days: data.leave_days,
        leave_reason: data.leave_reason
      }
    case 'overtime':
      return {
        ...baseData,
        overtime_hours: data.overtime_hours,
        overtime_reason: data.overtime_reason
      }
    case 'absent':
      return {
        ...baseData,
        absent_days: data.absent_days,
        absent_reason: data.absent_reason
      }
    default:
      return baseData
  }
}

const handleSubmit = async () => {
  if (formData.id && !canEdit.value) {
    handleAttendanceNoPermission('edit')
    return
  }

  if (!formData.id && !canCreateRequest.value) {
    if (canManageAttendanceRecords.value) {
      handleAttendanceNoPermission('create')
    } else {
      myAttendancePermissions.handleNoPermission('create')
    }
    return
  }

  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      if (!formData.employee_id) {
        formData.employee_id = authStore.user?.id
      }

      if ((formData.record_type === 'monthly_leave' || formData.record_type === 'leave') && (!leaveStartDate.value || !leaveEndDate.value)) {
        ElMessage.warning('请选择开始日期和结束日期')
        submitting.value = false
        return
      }

      // 过滤提交数据，只包含相关字段
      const submitData = filterSubmitData(formData)

      if (formData.record_type === 'monthly_leave' && !formData.id) {
        const requestedDays = formData.monthly_leave_days || 0
        const availableDays = leaveBalance.value?.available || 0

        // 如果申请天数超过本月可用天数，超过的部分转为请假
        if (requestedDays > availableDays) {
          const monthlyLeaveDays = availableDays
          const regularLeaveDays = requestedDays - availableDays

          // 生成详细的日期分配说明
          let dateDetail = ''
          if (leaveDateRange.value && leaveDateRange.value.length === 2) {
            const startDate = new Date(leaveDateRange.value[0])
            const dates: string[] = []
            for (let i = 0; i < requestedDays; i++) {
              const d = new Date(startDate)
              d.setDate(d.getDate() + i)
              const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`
              if (i < monthlyLeaveDays) {
                dates.push(`${dateStr}:休假`)
              } else {
                dates.push(`${dateStr}:请假`)
              }
            }
            dateDetail = '\n\n具体日期分配：\n' + dates.join('\n')
          }

          const confirmMessage = `本月可用休假天数：${availableDays}天
申请天数：${requestedDays}天
将自动创建：
- 休假 ${monthlyLeaveDays} 天（带薪，不扣工资）
- 请假 ${regularLeaveDays} 天（无薪，扣工资）${dateDetail}

是否继续？`

          await ElMessageBox.confirm(
            confirmMessage,
            '休假天数提示',
            {
              confirmButtonText: '继续',
              cancelButtonText: '取消',
              type: 'warning'
            }
          )

          // 按日期分别创建记录
          if (leaveDateRange.value && leaveDateRange.value.length === 2) {
            // 有日期范围，按日期分别创建
            const startDate = new Date(leaveDateRange.value[0])

            // 创建休假记录（前N天）
            for (let i = 0; i < monthlyLeaveDays; i++) {
              const d = new Date(startDate)
              d.setDate(d.getDate() + i)
              const dateStr = formatDate(d)
              await attendanceApi.createAttendanceRecord({
                employee_id: submitData.employee_id,
                record_type: 'monthly_leave',
                record_date: dateStr,
                monthly_leave_days: 1,
                status: 'pending'
              })
            }

            // 创建请假记录（后N天）
            for (let i = monthlyLeaveDays; i < requestedDays; i++) {
              const d = new Date(startDate)
              d.setDate(d.getDate() + i)
              const dateStr = formatDate(d)
              await attendanceApi.createAttendanceRecord({
                employee_id: submitData.employee_id,
                record_type: 'leave',
                record_date: dateStr,
                leave_type: '事假',
                leave_days: 1,
                leave_reason: `休假申请（超过休假天数，自动转为请假）`,
                status: 'pending'
              })
            }
          } else {
            // 没有日期范围，按原来方式创建
            if (monthlyLeaveDays > 0) {
              await attendanceApi.createAttendanceRecord({
                ...submitData,
                monthly_leave_days: monthlyLeaveDays
              })
            }

            if (regularLeaveDays > 0) {
              await attendanceApi.createAttendanceRecord({
                employee_id: submitData.employee_id,
                record_type: 'leave',
                record_date: submitData.record_date,
                leave_type: '事假',
                leave_days: regularLeaveDays,
                leave_reason: `休假申请（超过休假天数${regularLeaveDays}天，自动转为请假）`
              })
            }
          }

          if (monthlyLeaveDays > 0 && regularLeaveDays > 0) {
            ElMessage.success(`提交成功：休假${monthlyLeaveDays}天，请假${regularLeaveDays}天`)
          } else if (monthlyLeaveDays > 0) {
            ElMessage.success(`提交成功：休假${monthlyLeaveDays}天`)
          } else {
            ElMessage.success(`提交成功：请假${regularLeaveDays}天`)
          }
        } else {
          await attendanceApi.createAttendanceRecord(submitData)
          ElMessage.success('提交成功')
        }
      } else if (formData.id) {
        await attendanceApi.updateAttendanceRecord(formData.id, submitData)
        ElMessage.success('更新成功')
      } else {
        await attendanceApi.createAttendanceRecord(submitData)
        ElMessage.success('提交成功')
      }

      dialogVisible.value = false
      if (activeTab.value === 'all') {
        loadData()
      } else {
        loadMyData()
      }
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(formData.id ? '更新失败' : '提交失败')
      }
    } finally {
      submitting.value = false
    }
  })
}

const handleApprove = async (row) => {
  if (!canApprove.value) {
    handleAttendanceNoPermission('approve')
    return
  }

  currentRecord.value = row
  approveForm.status = 'approved'
  approveForm.note = ''
  approveDialogVisible.value = true
}

const handleApproveSubmit = async () => {
  if (!canApprove.value) {
    handleAttendanceNoPermission('approve')
    return
  }

  if (!currentRecord.value) return

  approving.value = true
  try {
    await attendanceApi.approveAttendanceRecord(
      currentRecord.value.id,
      approveForm.status,
      approveForm.note
    )
    ElMessage.success(approveForm.status === 'approved' ? '审批通过' : '已拒绝')
    approveDialogVisible.value = false
    loadData()
  } catch (error) {
    logger.error('❌ 审批失败:', error)
    ElMessage.error('审批失败')
  } finally {
    approving.value = false
  }
}

const handleRecordTypeChange = () => {
  formData.record_date = ''
  leaveDateRange.value = null
  leaveStartDate.value = ''
  leaveEndDate.value = ''
}

watch(
  () => formData.employee_id,
  async (employeeId) => {
    if (!dialogVisible.value) return
    if (!canManageAttendanceRecords.value) return

    if (!employeeId) {
      leaveBalance.value = null
      return
    }

    await loadLeaveBalance(employeeId)
  }
)

const handleLeaveDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    const startDate = new Date(value[0])
    const endDate = new Date(value[1])
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (formData.record_type === 'monthly_leave') {
      formData.monthly_leave_days = diffDays
    } else if (formData.record_type === 'leave') {
      formData.leave_days = diffDays
    }

    formData.record_date = value[0]
  } else {
    if (formData.record_type === 'monthly_leave') {
      formData.monthly_leave_days = 1
    } else if (formData.record_type === 'leave') {
      formData.leave_days = 1
    }
    formData.record_date = ''
  }
}

const buildAttendanceEndDate = (startDate: string, days: number) => {
  if (!startDate) return ''
  const safeDays = Math.max(Number(days) || 1, 1)
  const date = new Date(startDate)
  date.setDate(date.getDate() + safeDays - 1)
  return formatDate(date)
}

const syncLeaveDateRange = () => {
  if (!leaveStartDate.value && !leaveEndDate.value) {
    leaveDateRange.value = null
    handleLeaveDateChange(null)
    return
  }

  if (!leaveStartDate.value || !leaveEndDate.value) {
    leaveDateRange.value = null
    formData.record_date = leaveStartDate.value || leaveEndDate.value || ''

    if (formData.record_type === 'monthly_leave') {
      formData.monthly_leave_days = 1
    } else if (formData.record_type === 'leave') {
      formData.leave_days = 1
    }
    return
  }

  if (leaveStartDate.value <= leaveEndDate.value) {
    leaveDateRange.value = [leaveStartDate.value, leaveEndDate.value]
  } else {
    leaveDateRange.value = [leaveEndDate.value, leaveStartDate.value]
    leaveStartDate.value = leaveDateRange.value[0]
    leaveEndDate.value = leaveDateRange.value[1]
  }

  handleLeaveDateChange(leaveDateRange.value)
}

const handleLeaveBoundaryChange = (boundary: 'start' | 'end', value: string | null) => {
  if (boundary === 'start') {
    leaveStartDate.value = value || ''
  } else {
    leaveEndDate.value = value || ''
  }
  syncLeaveDateRange()
}

const handleDelete = async (row) => {
  if (!canDelete.value) {
    handleAttendanceNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确认删除该考勤记录？', '删除确认')
    await attendanceApi.deleteAttendanceRecord(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('❌ 删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const handleCancel = async (row) => {
  if (!canCreateOwnAttendance.value) {
    myAttendancePermissions.handleNoPermission('create')
    return
  }

  try {
    await ElMessageBox.confirm('确定要撤销此申请吗？', '提示', { type: 'warning' })
    await attendanceApi.cancelAttendanceRequest(row.id)
    ElMessage.success('已撤销')
    loadMyData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('撤销失败')
    }
  }
}

// 获取原因文本 - 根据记录类型返回对应的 reason 字段
const getReasonText = (row: AttendanceTableRow) => {
  if (row.record_type === 'monthly_leave') {
    return `月度带薪休假 ${row.monthly_leave_days || 0} 天`
  } else if (row.record_type === 'leave') {
    return row.leave_reason || '-'
  } else if (row.record_type === 'overtime') {
    return row.overtime_reason || '-'
  } else if (row.record_type === 'absent') {
    return row.absent_reason || '-'
  }
  return '-'
}

const handleView = (row) => {
  if (activeTab.value === 'all' && !canViewAllAttendance.value) {
    handleAttendanceNoPermission('view')
    return
  }

  if (activeTab.value === 'my' && !canViewOwnAttendance.value) {
    myAttendancePermissions.handleNoPermission('view')
    return
  }

  currentRecord.value = row
  detailDialogVisible.value = true
}

const handleMobileRowDblClick = (row: AttendanceTableRow, scope: 'all' | 'my') => {
  if (!isMobile.value) return

  if (scope === 'all') {
    const shouldExpand = mobileExpandedAttendanceId.value !== row.id
    if (mobileExpandedAttendanceId.value && mobileExpandedAttendanceId.value !== row.id) {
      const previous = tableData.value.find(item => item.id === mobileExpandedAttendanceId.value)
      if (previous) {
        attendanceTableRef.value?.toggleRowExpansion(previous, false)
      }
    }
    attendanceTableRef.value?.toggleRowExpansion(row, shouldExpand)
    mobileExpandedAttendanceId.value = shouldExpand ? row.id : null
    return
  }

  const shouldExpand = mobileExpandedMyAttendanceId.value !== row.id
  if (mobileExpandedMyAttendanceId.value && mobileExpandedMyAttendanceId.value !== row.id) {
    const previous = myTableData.value.find(item => item.id === mobileExpandedMyAttendanceId.value)
    if (previous) {
      myAttendanceTableRef.value?.toggleRowExpansion(previous, false)
    }
  }
  myAttendanceTableRef.value?.toggleRowExpansion(row, shouldExpand)
  mobileExpandedMyAttendanceId.value = shouldExpand ? row.id : null
}

const handleMobileRowTap = (row: AttendanceTableRow, scope: 'all' | 'my') => {
  if (!isMobile.value) return

  const now = Date.now()
  if (
    lastTappedAttendanceId.value === row.id &&
    lastTappedAttendanceScope.value === scope &&
    now - lastTapTimestamp.value <= 320
  ) {
    handleMobileRowDblClick(row, scope)
    lastTappedAttendanceId.value = null
    lastTappedAttendanceScope.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedAttendanceId.value = row.id
  lastTappedAttendanceScope.value = scope
  lastTapTimestamp.value = now
}

const clearMobileActions = () => {
  if (mobileExpandedAttendanceId.value) {
    const current = tableData.value.find(item => item.id === mobileExpandedAttendanceId.value)
    if (current) {
      attendanceTableRef.value?.toggleRowExpansion(current, false)
    }
  }
  if (mobileExpandedMyAttendanceId.value) {
    const current = myTableData.value.find(item => item.id === mobileExpandedMyAttendanceId.value)
    if (current) {
      myAttendanceTableRef.value?.toggleRowExpansion(current, false)
    }
  }
  mobileExpandedAttendanceId.value = null
  mobileExpandedMyAttendanceId.value = null
  lastTappedAttendanceId.value = null
  lastTappedAttendanceScope.value = null
  lastTapTimestamp.value = 0
}

const handleTabChange = (tabName: string) => {
  clearMobileActions()
  if (tabName === 'all') {
    if (!canViewAllAttendance.value) return
    loadData()
  } else if (tabName === 'my') {
    if (!canViewOwnAttendance.value) return
    loadMyData()
  }
}

const refreshData = async () => {
  if (!canAccessPage.value) {
    return
  }

  loading.value = true
  try {
    if (activeTab.value === 'all') {
      await loadData()
    } else if (activeTab.value === 'my') {
      await loadMyData()
    }
    success('数据刷新成功', { duration: 2000 })
  } catch (err) {
    error('刷新失败：请稍后重试')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  if (!canViewAllAttendance.value) {
    return
  }

  Object.assign(filters, {
    employee_id: undefined,
    record_type: undefined,
    status: undefined,
    start_date: undefined,
    end_date: undefined
  })
  dateRange.value = null
  pagination.page = 1
  loadData()
}

const resetMyFilters = () => {
  if (!canViewOwnAttendance.value) {
    return
  }

  Object.assign(myFilters, {
    record_type: undefined,
    status: undefined,
    start_date: undefined,
    end_date: undefined
  })
  myDateRange.value = null
  myPagination.page = 1
  loadMyData()
}

const loadEmployees = async () => {
  if (!canViewAllAttendance.value) {
    employees.value = []
    return
  }

  try {
    // 使用新的员工列表接口，根据权限返回不同的数据
    const response = await unifiedApi.get('/users/employees')
    if (response.data) {
      employees.value = response.data.employees || []
      // 兼容后端附带的扩展状态字段
      if (response.data.isAdmin !== undefined) {
        // 可以根据需要使用这个标识
      }
    }
  } catch (error) {
    logger.error('加载员工列表失败:', error)
  }
}

onMounted(async () => {
  if (!canAccessPage.value) {
    return
  }

  await initFieldPermissions()
  syncVisibleAttendanceFilters()
  await loadLeaveConfig()
  // 加载休假余额（所有用户都需要）
  await loadLeaveBalance()

  if (canViewAllAttendance.value) {
    activeTab.value = 'all'
    await loadData()
  } else if (canViewOwnAttendance.value) {
    activeTab.value = 'my'
    await loadMyData()
  }
  if (canViewAllAttendance.value) {
    await loadEmployees()
  }
})
</script>

<style scoped>
/* 页面容器 */
.page-container {
  padding: 20px;
}

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid #e8ecef;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 24px;
  color: white;
}

.stat-icon.blue {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
}

.stat-icon.purple {
  background: linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
}

.stat-icon.success {
  background: linear-gradient(135deg, #67c23a 0%, #95d475 100%);
}

.stat-icon.info {
  background: linear-gradient(135deg, #909399 0%, #b1b3b8 100%);
}

.stat-icon.orange {
  background: linear-gradient(135deg, #ff6b00 0%, #ff9e40 100%);
}

.stat-icon.danger {
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.stat-detail {
  margin-top: 4px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value .text-success {
  color: #67c23a;
  margin-right: 8px;
}

.stat-value .text-danger {
  color: #f56c6c;
}

/* TAB 样式 */
.attendance-tabs {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-form {
  width: 100%;
}

.filter-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.filter-item .el-select,
.filter-item .el-date-picker {
  min-width: 160px;
}

.filter-item.actions {
  margin-left: auto;
}

/* 表格区域 */
.table-section {
  margin-top: 20px;
}

.table-responsive {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.data-table {
  width: 100%;
}

/* 表格头部样式 */
.data-table :deep(.el-table__header-wrapper) {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%) !important;
}

.data-table :deep(.el-table__header th) {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%) !important;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  padding: 16px 0;
  border-bottom: 2px solid #2f343a;
}

.data-table :deep(.el-table__header tr) {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%) !important;
}

.data-table :deep(.el-table__header th .cell) {
  padding: 0 12px;
  color: #ffffff;
}

/* 表格行样式 */
.data-table :deep(.el-table__body tr) {
  transition: all 0.3s;
}

.data-table :deep(.el-table__body tr:hover > td) {
  background: #f5f7fa !important;
}

.data-table :deep(.el-table__body td) {
  padding: 14px 0;
  border-bottom: 1px solid #f0f2f5;
}

.data-table :deep(.el-table__body td .cell) {
  padding: 0 12px;
}

/* 斑马纹 */
.data-table :deep(.el-table__body tr.el-table__row--striped > td) {
  background: #fafbfc;
}

/* 表格标签样式 */
.data-table :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: none;
}

.data-table :deep(.el-tag.el-tag--success) {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: white;
}

.data-table :deep(.el-tag.el-tag--warning) {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
  color: white;
}

.data-table :deep(.el-tag.el-tag--primary) {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: white;
}

.data-table :deep(.el-tag.el-tag--danger) {
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
  color: white;
}

.data-table :deep(.el-tag.el-tag--info) {
  background: linear-gradient(135deg, #909399 0%, #b1b3b8 100%);
  color: white;
}

/* 表格详情列样式 */
.data-table :deep(.el-table__body td .cell) {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.data-table :deep(.el-table__body tr:hover > td .cell) {
  color: #303133;
}

/* 详情项样式 */
.detail-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}

.detail-icon {
  font-size: 12px;
  color: #909399;
}

.data-table :deep(.el-table__body tr:hover .detail-icon) {
  color: #409eff;
}

/* 日期列样式 */
.data-table :deep(.el-table__body td .cell) {
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: #606266;
}

/* ==================== 优化后的按钮样式 ==================== */

/* 全局按钮样式优化 */
.attendance-page :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  min-width: auto;
  height: 32px;
  line-height: 1;
}

/* 头部操作按钮 - 稍大一点 */
.header-actions :deep(.el-button) {
  padding: 8px 16px;
  height: 36px;
  font-size: 14px;
  gap: 6px;
}

/* 表格内操作按钮 - 紧凑型 */
.data-table :deep(.el-button) {
  padding: 4px 10px;
  font-size: 12px;
  height: 28px;
  gap: 3px;
  margin: 0 2px;
}

.data-table :deep(.el-button .el-icon) {
  font-size: 13px;
}

/* 筛选区域按钮 */
.filter-item.actions :deep(.el-button) {
  padding: 7px 14px;
  height: 32px;
  font-size: 13px;
}

/* ==================== 按钮类型样式 ==================== */

/* 主要按钮 - 蓝色渐变 */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border: none;
  color: white;
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.25);
}

:deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #66b1ff 0%, #409eff 100%);
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.35);
  transform: translateY(-1px);
}

:deep(.el-button--primary:active) {
  transform: translateY(0);
}

/* 成功按钮 - 绿色渐变 */
:deep(.el-button--success) {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  border: none;
  color: white;
  box-shadow: 0 2px 6px rgba(103, 194, 58, 0.25);
}

:deep(.el-button--success:hover) {
  background: linear-gradient(135deg, #85ce61 0%, #67c23a 100%);
  box-shadow: 0 4px 10px rgba(103, 194, 58, 0.35);
  transform: translateY(-1px);
}

/* 危险按钮 - 红色渐变 */
:deep(.el-button--danger) {
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
  border: none;
  color: white;
  box-shadow: 0 2px 6px rgba(245, 108, 108, 0.25);
}

:deep(.el-button--danger:hover) {
  background: linear-gradient(135deg, #fab6b6 0%, #f56c6c 100%);
  box-shadow: 0 4px 10px rgba(245, 108, 108, 0.35);
  transform: translateY(-1px);
}

/* 信息按钮 - 青色渐变 */
:deep(.el-button--info) {
  background: linear-gradient(135deg, #909399 0%, #b1b3b8 100%);
  border: none;
  color: white;
  box-shadow: 0 2px 6px rgba(144, 147, 153, 0.25);
}

:deep(.el-button--info:hover) {
  background: linear-gradient(135deg, #b1b3b8 0%, #909399 100%);
  box-shadow: 0 4px 10px rgba(144, 147, 153, 0.35);
  transform: translateY(-1px);
}

/* 默认按钮 */
:deep(.el-button--default) {
  background: #f5f7fa;
  border-color: #dcdfe6;
  color: #606266;
}

:deep(.el-button--default:hover) {
  background: #ecf5ff;
  border-color: #409eff;
  color: #409eff;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.15);
}

/* 文字按钮 */
:deep(.el-button.is-link) {
  border: none;
  background: transparent;
  color: #409eff;
  padding: 4px 8px;
}

:deep(.el-button.is-link:hover) {
  color: #66b1ff;
  background: rgba(64, 158, 255, 0.1);
}

/* ==================== 按钮尺寸变体 ==================== */

/* 超小按钮 */
:deep(.el-button--small) {
  padding: 4px 10px;
  font-size: 12px;
  height: 28px;
}

/* 大按钮 */
:deep(.el-button--large) {
  padding: 10px 18px;
  font-size: 15px;
  height: 40px;
}

/* ==================== 按钮状态 ==================== */

/* 禁用状态 */
:deep(.el-button.is-disabled) {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* 加载状态 */
:deep(.el-button.is-loading) {
  position: relative;
  pointer-events: none;
}

:deep(.el-button.is-loading::before) {
  pointer-events: none;
  content: '';
  position: absolute;
  left: -1px;
  top: -1px;
  right: -1px;
  bottom: -1px;
  border-radius: inherit;
}

/* 圆形按钮 */
:deep(.el-button.is-circle) {
  padding: 8px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
}

/* ==================== 按钮组样式 ==================== */
:deep(.el-button-group) {
  display: inline-flex;
  gap: 0;
}

:deep(.el-button-group .el-button) {
  border-radius: 0;
  margin: 0;
}

:deep(.el-button-group .el-button:first-child) {
  border-radius: 6px 0 0 6px;
}

:deep(.el-button-group .el-button:last-child) {
  border-radius: 0 6px 6px 0;
}

:deep(.el-button-group .el-button:only-child) {
  border-radius: 6px;
}

/* 表格加载状态 */
.data-table :deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
}

/* 边框样式 */
.data-table.el-table--border {
  border: 1px solid #ebeef5;
}

.data-table.el-table--border::after,
.data-table.el-table--border::before {
  display: none;
}

.data-table.el-table--border :deep(.el-table__body td),
.data-table.el-table--border :deep(.el-table__header th) {
  border-right: 1px solid #f0f2f5;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  border-radius: 12px;
  color: #909399;
  margin-top: 20px;
}

.empty-state i {
  font-size: 72px;
  margin-bottom: 20px;
  opacity: 0.15;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-state p {
  font-size: 16px;
  margin: 0 0 24px 0;
  color: #606266;
  font-weight: 500;
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* 统计结果 */
.stats-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.stat-result-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.stat-result-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 20px;
  color: white;
}

.stat-result-icon.warning {
  background: #e6a23c;
}

.stat-result-icon.primary {
  background: #409eff;
}

.stat-result-icon.danger {
  background: #f56c6c;
}

.stat-result-icon.info {
  background: #909399;
}

.stat-result-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.stat-result-label {
  font-size: 13px;
  color: #909399;
}

/* 对话框样式 */
.days-display {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.date-range {
  margin-left: 10px;
  font-size: 13px;
  color: #909399;
}

.attendance-date-range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.attendance-date-range-grid :deep(.el-form-item) {
  margin-bottom: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .page-container {
    padding: 12px;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-card {
    padding: 12px 10px;
    gap: 10px;
    border-radius: 16px;
    align-items: center;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  .stat-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 16px;
    flex-shrink: 0;
  }

  .stat-content {
    min-width: 0;
  }

  .stat-value {
    font-size: 16px;
    line-height: 1.2;
    margin-bottom: 2px;
    word-break: break-word;
  }

  .stat-label {
    font-size: 11px;
    line-height: 1.35;
  }

  .stat-detail,
  .stat-desc {
    margin-top: 4px;
    font-size: 10px;
    line-height: 1.35;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .filter-row {
    flex-direction: column;
  }

  .filter-item {
    width: 100%;
  }

  .filter-item .el-select,
  .filter-item .el-date-picker {
    width: 100% !important;
  }

  .filter-item.actions {
    margin-left: 0;
  }

  .table-section {
    margin-top: 16px;
  }

  .table-responsive {
    overflow-x: hidden;
    border-radius: 12px;
  }

  .data-table {
    width: 100% !important;
  }

  .data-table :deep(.el-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  .data-table :deep(.el-table__header th) {
    font-size: 11px;
    padding: 10px 0;
  }

  .data-table :deep(.el-table__header th .cell),
  .data-table :deep(.el-table__body td .cell) {
    padding: 0 6px;
  }

  .data-table :deep(.el-table__body td) {
    padding: 10px 0;
  }

  .data-table :deep(.el-table__body td .cell) {
    font-size: 11px;
    line-height: 1.35;
    word-break: break-word;
  }

  .data-table :deep(.el-tag) {
    padding: 3px 8px;
    font-size: 10px;
    gap: 3px;
    white-space: nowrap;
  }

  .data-table :deep(.el-tag i) {
    font-size: 10px;
  }

  .data-table :deep(.mobile-expand-column) {
    width: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
  }

  .data-table :deep(.mobile-expand-column .cell) {
    display: none !important;
  }

  .data-table :deep(.el-table__expand-column) {
    width: 0 !important;
    min-width: 0 !important;
  }

  .data-table :deep(.el-table__expand-icon) {
    display: none !important;
  }

  .data-table :deep(.el-table__expanded-cell) {
    padding: 6px 4px 10px !important;
    background: linear-gradient(180deg, #f8fbff 0%, #f4f7ff 100%) !important;
  }

  .attendance-dialog-form :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .attendance-dialog-form :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .attendance-dialog-form :deep(.el-input),
  .attendance-dialog-form :deep(.el-input-number),
  .attendance-dialog-form :deep(.el-select),
  .attendance-dialog-form :deep(.el-date-editor),
  .attendance-dialog-form :deep(.el-radio-group),
  .attendance-dialog-form :deep(.el-textarea) {
    width: 100%;
  }

  .attendance-dialog-form :deep(.el-input__wrapper),
  .attendance-dialog-form :deep(.el-input-number .el-input__wrapper),
  .attendance-dialog-form :deep(.el-date-editor .el-input__wrapper),
  .attendance-dialog-form :deep(.el-textarea__inner) {
    border-radius: 12px;
  }

  .attendance-dialog-form :deep(.el-input__wrapper),
  .attendance-dialog-form :deep(.el-input-number .el-input__wrapper),
  .attendance-dialog-form :deep(.el-date-editor .el-input__wrapper) {
    min-height: 42px;
    padding: 1px 12px;
  }

  .attendance-dialog-form :deep(.el-input__inner),
  .attendance-dialog-form :deep(.el-input-number__input),
  .attendance-dialog-form :deep(.el-textarea__inner),
  .attendance-dialog-form :deep(.el-select__selected-item),
  .attendance-dialog-form :deep(.el-date-editor input),
  .attendance-dialog-form :deep(.el-range-input) {
    font-size: 16px !important;
  }

  .attendance-dialog-form :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .attendance-dialog-form :deep(.el-radio) {
    margin-right: 0;
    min-height: 40px;
    padding: 0 10px;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .attendance-detail-descriptions :deep(.el-descriptions__label) {
    width: 88px;
    font-size: 12px;
  }

  .attendance-detail-descriptions :deep(.el-descriptions__content) {
    font-size: 13px;
    line-height: 1.45;
    word-break: break-word;
  }

  .attendance-date-range-grid {
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .page-container {
    padding: 10px;
  }

  .stats-cards {
    gap: 8px;
    margin-bottom: 14px;
  }

  .stat-card {
    padding: 10px 8px;
    gap: 8px;
    border-radius: 14px;
  }

  .stat-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    font-size: 14px;
  }

  .stat-value {
    font-size: 14px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-detail,
  .stat-desc {
    font-size: 9px;
  }

  .table-responsive {
    border-radius: 10px;
  }

  .data-table :deep(.el-table__header th) {
    font-size: 10px;
    padding: 8px 0;
  }

  .data-table :deep(.el-table__header th .cell),
  .data-table :deep(.el-table__body td .cell) {
    padding: 0 4px;
  }

  .data-table :deep(.el-table__body td) {
    padding: 8px 0;
  }

  .data-table :deep(.el-table__body td .cell) {
    font-size: 10px;
  }

  .data-table :deep(.el-tag) {
    padding: 2px 6px;
    font-size: 9px;
  }

  .attendance-dialog-form :deep(.el-form-item) {
    margin-bottom: 10px;
  }

  .attendance-dialog-form :deep(.el-radio-group) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .attendance-dialog-form :deep(.el-radio) {
    min-height: 36px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 12px;
  }

  .attendance-dialog-form :deep(.el-radio__label) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding-left: 0;
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
  }

  .attendance-dialog-form :deep(.el-radio__input) {
    display: none;
  }

  .attendance-dialog-form :deep(.el-radio i) {
    font-size: 11px;
  }

  .attendance-date-range-grid {
    gap: 8px;
  }

  .attendance-detail-descriptions :deep(.el-descriptions__label),
  .attendance-detail-descriptions :deep(.el-descriptions__content) {
    font-size: 12px;
  }
}
</style>

<style>
.attendance-form-dialog,
.attendance-detail-dialog {
  --dialog-max-width: 800px;
}

.attendance-dialog-popper {
  z-index: 4005 !important;
}

.attendance-dialog-popper.el-popper[data-popper-placement^='top'] {
  margin-bottom: 8px !important;
}

.attendance-dialog-popper.el-popper[data-popper-placement^='bottom'] {
  margin-top: 8px !important;
}

@media (max-width: 767px) {
  .attendance-form-dialog,
  .attendance-detail-dialog {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 10px 8px 8px;
    --mobile-dialog-footer-padding: 0 8px 8px;
  }

  .mobile-dialog-sheet-overlay.attendance-form-dialog,
  .mobile-dialog-sheet-overlay.attendance-detail-dialog {
    padding: 12px 6px !important;
  }

  .attendance-dialog-popper.el-popper,
  .attendance-dialog-popper .el-picker-panel {
    max-width: calc(100vw - 12px) !important;
  }

}

@media (max-width: 480px) {
  .attendance-form-dialog,
  .attendance-detail-dialog {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 8px 6px 6px;
    --mobile-dialog-footer-padding: 0 6px 6px;
  }

  .mobile-dialog-sheet-overlay.attendance-form-dialog,
  .mobile-dialog-sheet-overlay.attendance-detail-dialog {
    padding: 12px 4px !important;
  }
}
</style>
