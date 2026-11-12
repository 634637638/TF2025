<template>
  <!-- 权限检查 - 页面级访问控制 -->
  <PermissionGate
    :can-view="canAccessPage"
    mode="denied"
    module-key="attendance"
    module-name="考勤管理"
    permission-code="attendance:view / attendance:view:own"
  >
    <el-config-provider :locale="locale">
      <div class="page-container attendance-page admin-page">
        <PageHeader title="考勤管理">
          <template #actions>
            <el-button
              v-if="canCreateRequest"
              type="primary"
              :disabled="loading"
              @click="showCreateDialog"
            >
              <i class="fas fa-plus" />
              <span>新增</span>
            </el-button>
            <el-button
              type="info"
              :loading="refreshing"
              :disabled="refreshing"
              @click="refreshData"
            >
              <i class="fas fa-sync-alt" />
              <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
            </el-button>
          </template>
        </PageHeader>

        <!-- 页面主体 -->
        <div class="page-body admin-page-content">
          <!-- 统计卡片 -->
          <div
            v-if="showAttendanceStatsCards"
            class="stats-cards"
          >
            <!-- 上月统计 -->
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_last_month_leave')"
              class="stat-card stat-card--info"
            >
              <div class="stat-icon">
                <i class="fas fa-calendar-minus" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  {{ lastMonthStats.leave_days || 0 }}天
                </div>
                <div class="stat-label">
                  上月休假
                </div>
              </div>
            </div>
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_last_month_overtime')"
              class="stat-card stat-card--accent"
            >
              <div class="stat-icon">
                <i class="fas fa-clock" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  {{ lastMonthStats.overtime_hours || 0 }}小时
                </div>
                <div class="stat-label">
                  上月加班
                </div>
              </div>
            </div>

            <!-- 本月统计 -->
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_leave')"
              class="stat-card stat-card--success"
            >
              <div class="stat-icon">
                <i class="fas fa-calendar-check" />
              </div>
              <div class="stat-content">
                <!-- 智能显示：还有可用天数显示"剩余X天假"，已休完显示"已休完X天" -->
                <div
                  v-if="!currentMonthStats.is_exhausted"
                  class="stat-value"
                >
                  剩余 {{ currentMonthStats.available_leave_days || 0 }}天假
                </div>
                <div
                  v-else
                  class="stat-value"
                >
                  已休完{{ currentMonthStats.used_days || 0 }}天
                </div>
                <div class="stat-label">
                  本月休假
                </div>
              </div>
            </div>
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_unpaid_leave')"
              class="stat-card stat-card--warning"
            >
              <div class="stat-icon">
                <i class="fas fa-calendar-times" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  {{ currentMonthStats.unpaid_leave_days || 0 }}天
                </div>
                <div class="stat-label">
                  本月请假（无薪）
                </div>
              </div>
            </div>
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_current_month_overtime')"
              class="stat-card stat-card--info"
            >
              <div class="stat-icon">
                <i class="fas fa-hourglass-half" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  {{ currentMonthStats.overtime_hours || 0 }}小时
                </div>
                <div class="stat-label">
                  本月加班
                </div>
              </div>
            </div>
            <!-- 本月费用卡片 - 显示加班费和请假扣款汇总 -->
            <div
              v-if="canViewAttendanceField(attendanceStatsModuleKey, 'stats_pending_settlement')"
              class="stat-card stat-card--warning"
            >
              <div class="stat-icon">
                <i class="fas fa-coins" />
              </div>
              <div class="stat-content">
                <div class="stat-value">
                  <span
                    v-if="stats.pending_overtime_pay > 0"
                    class="text-success"
                  >+¥{{ stats.pending_overtime_pay.toFixed(0) }}</span>
                  <span
                    v-if="stats.pending_overtime_pay > 0 && stats.pending_leave_deduction > 0"
                    class="mx-1"
                  />
                  <span
                    v-if="stats.pending_leave_deduction > 0"
                    class="text-danger"
                  >-¥{{ stats.pending_leave_deduction.toFixed(0) }}</span>
                  <span v-if="stats.pending_overtime_pay === 0 && stats.pending_leave_deduction === 0">¥0</span>
                </div>
                <div class="stat-label">
                  本月费用
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 切换 -->
          <el-tabs
            v-model="activeTab"
            class="attendance-tabs tf-page-tabs"
            @tab-change="handleTabChange"
          >
            <!-- 所有考勤 -->
            <el-tab-pane
              v-if="canViewAllAttendance"
              data-view-permission="attendance:view"
              label="所有考勤"
              name="all"
              class="tf-tab-panel"
            >
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
                      <i class="fas fa-calendar-check" />
                    </template>
                  </el-input>
                </template>

                <!-- 员工筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_attendanceview', 'employee_name')"
                  class="form-group filter-item"
                  data-field="employee"
                >
                  <el-select
                    v-model="filters.employee_id"
                    placeholder="员工"
                    clearable
                    filterable
                    remote
                    reserve-keyword
                    :remote-method="searchAttendanceEmployeesRemote"
                    @change="loadData"
                    @focus="searchAttendanceEmployeesRemote('')"
                  >
                    <el-option
                      v-for="emp in employees"
                      :key="emp.id"
                      :label="emp.name || emp.username"
                      :value="emp.id"
                    />
                  </el-select>
                </div>

                <!-- 类型筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')"
                  class="form-group filter-item"
                  data-field="type"
                >
                  <el-select
                    v-model="filters.record_type"
                    placeholder="类型"
                    clearable
                    @change="loadData"
                  >
                    <el-option
                      label="休假"
                      value="monthly_leave"
                    />
                    <el-option
                      label="请假"
                      value="leave"
                    />
                    <el-option
                      label="加班"
                      value="overtime"
                    />
                  </el-select>
                </div>

                <!-- 状态筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_attendanceview', 'status')"
                  class="form-group filter-item"
                  data-field="status"
                >
                  <el-select
                    v-model="filters.status"
                    placeholder="状态"
                    clearable
                    @change="loadData"
                  >
                    <el-option
                      label="待审批"
                      value="pending"
                    />
                    <el-option
                      label="已通过"
                      value="approved"
                    />
                    <el-option
                      label="已拒绝"
                      value="rejected"
                    />
                  </el-select>
                </div>

                <!-- 日期范围筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')"
                  class="form-group filter-item filter-item--date-range"
                  data-field="date"
                >
                  <DateRangePicker
                    v-model="dateRange"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    :value-format="TIME_FORMATS.DATE"
                    @change="handleDateRangeChange"
                  />
                </div>
              </UnifiedSearchPanel>

              <!-- 数据表格 -->
              <div class="table-section admin-panel admin-table-panel">
                <div class="table-responsive">
                  <el-table
                    ref="attendanceTableRef"
                    v-tf-loading="{ active: loading || refreshing, text: '正在刷新考勤记录...' }"
                    :data="displayAttendanceRows"
                    border
                    stripe
                    class="data-table devices-table compact-fit-table"
                    table-layout="fixed"
                    :fit="true"
                    row-key="id"
                    @row-click="handleMobileRowTap($event, 'all')"
                  >
                    <template #empty>
                      <TableLoadingRow
                        v-if="loading"
                        mode="block"
                        text="正在读取考勤记录..."
                      />
                      <DataEmptyState
                        v-else
                        description="暂无考勤记录"
                      />
                    </template>

                    <el-table-column
                      v-if="isMobile"
                      type="expand"
                      width="1"
                      class-name="mobile-expand-column"
                    >
                      <template #default="{ row }">
                        <div class="mobile-inline-actions">
                          <el-button
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--view"
                            title="查看"
                            @click.stop="handleView(row)"
                          >
                            <i class="fas fa-eye mr-1" /><span>查看</span>
                          </el-button>
                          <el-button
                            v-if="canEdit && !isAggregatedAttendanceRow(row)"
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--edit"
                            title="编辑"
                            @click.stop="handleEdit(row)"
                          >
                            <i class="fas fa-edit mr-1" /><span>{{ row.status === 'pending' ? '编辑' : '修改' }}</span>
                          </el-button>
                          <el-button
                            v-if="canDelete && !isAggregatedAttendanceRow(row)"
                            size="small"
                            type="danger"
                            class="table-action table-action--delete"
                            title="删除"
                            @click.stop="handleDelete(row)"
                          >
                            <i class="fas fa-trash mr-1" /><span>删除</span>
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceIdColumn"
                      prop="id"
                      label="ID"
                      :width="$getNumberColumnWidth((displayAttendanceRows || []).map((row) => getAttendanceRowIds(row)), 90)"
                      align="center"
                    >
                      <template #default="{ row }">
                        <span class="table-number-badge">{{ getAttendanceRowIds(row) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceEmployeeColumn"
                      prop="employee_name"
                      label="员工"
                      :min-width="attendanceEmployeeColumnWidth"
                      align="center"
                      class-name="complete-text-column"
                    />
                    <el-table-column
                      v-if="showAttendanceTypeColumn"
                      label="类型"
                      :min-width="attendanceTypeColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <el-tag
                          v-if="row.record_type === 'monthly_leave'"
                          type="success"
                        >
                          <i class="fas fa-umbrella-beach" />
                          休假
                        </el-tag>
                        <el-tag
                          v-else-if="row.record_type === 'leave'"
                          type="warning"
                        >
                          <i class="fas fa-user-clock" />
                          请假
                        </el-tag>
                        <el-tag
                          v-else-if="row.record_type === 'overtime'"
                          type="primary"
                        >
                          <i class="fas fa-business-time" />
                          加班
                        </el-tag>
                        <el-tag
                          v-else
                          type="danger"
                        >
                          <i class="fas fa-user-slash" />
                          未知
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceDetailColumn"
                      label="详情"
                      :min-width="attendanceDetailColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <span
                          v-if="row.record_type === 'monthly_leave'"
                          class="detail-item"
                        >
                          休假 {{ formatAttendanceQuantity(row.monthly_leave_days) }} 天
                        </span>
                        <span
                          v-else-if="row.record_type === 'leave'"
                          class="detail-item"
                        >
                          请假 {{ formatAttendanceQuantity(row.leave_days) }} 天
                        </span>
                        <span
                          v-else-if="row.record_type === 'overtime'"
                          class="detail-item"
                        >
                          {{ formatAttendanceQuantity(row.overtime_hours) }}小时
                        </span>
                        <span
                          v-else
                          class="detail-item"
                        >
                          -
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceDateColumn"
                      label="日期"
                      :min-width="attendanceDateColumnWidth"
                      align="center"
                      class-name="complete-text-column"
                    >
                      <template #default="{ row }">
                        {{ getAttendanceRecordDateText(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceReasonColumn"
                      label="原因"
                      :min-width="attendanceReasonColumnWidth"
                      class-name="complete-text-column wrapped-text-column"
                    >
                      <template #default="{ row }">
                        <span>{{ getReasonText(row) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceStatusColumn"
                      prop="status"
                      label="状态"
                      :min-width="attendanceStatusColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <div class="attendance-status-cell">
                          <el-tag
                            v-if="canViewAttendanceField('attendance_attendanceview', 'status') && row.status === 'pending'"
                            type="info"
                          >
                            <i class="fas fa-clock" />
                            待审批
                          </el-tag>
                          <el-tag
                            v-else-if="canViewAttendanceField('attendance_attendanceview', 'status') && row.status === 'approved'"
                            type="success"
                          >
                            <i class="fas fa-check-circle" />
                            已通过
                          </el-tag>
                          <el-tag
                            v-else-if="canViewAttendanceField('attendance_attendanceview', 'status')"
                            type="danger"
                          >
                            <i class="fas fa-times-circle" />
                            已拒绝
                          </el-tag>
                          <el-button
                            v-if="canApprove && row.status === 'pending' && !isAggregatedAttendanceRow(row)"
                            size="small"
                            plain
                            type="success"
                            class="table-action table-action--manage"
                            title="审批"
                            @click.stop="handleApprove(row)"
                          >
                            <i class="fas fa-check mr-1" />审批
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showAttendanceApprovalColumn"
                      prop="approval_note"
                      label="审批备注"
                      :min-width="attendanceApprovalColumnWidth"
                      class-name="complete-text-column wrapped-text-column"
                    />
                    <el-table-column
                      v-if="showAttendanceActionField"
                      label="操作"
                      :width="attendanceActionColumnWidth"
                      align="center"
                      header-align="center"
                      class-name="actions-column"
                    >
                      <template #default="{ row }">
                        <div class="action-buttons">
                          <el-button
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--view"
                            title="查看"
                            @click.stop="handleView(row)"
                          >
                            <i class="fas fa-eye mr-1" />查看
                          </el-button>
                          <el-button
                            v-if="canEdit && !isAggregatedAttendanceRow(row)"
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--edit"
                            title="编辑"
                            @click.stop="handleEdit(row)"
                          >
                            <i class="fas fa-edit mr-1" />{{ row.status === 'pending' ? '编辑' : '修改' }}
                          </el-button>
                          <el-button
                            v-if="canDelete && !isAggregatedAttendanceRow(row)"
                            size="small"
                            type="danger"
                            class="table-action table-action--delete"
                            title="删除"
                            @click.stop="handleDelete(row)"
                          >
                            <i class="fas fa-trash mr-1" />删除
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>

                  <!-- 空状态 -->
                  <DataEmptyState
                    v-if="!loading && tableData.length === 0"
                    description="暂无考勤记录"
                  />
                </div>

                <!-- 分页 -->
                <Pagination
                  v-if="pagination.total > 0"
                  v-model:current="pagination.page"
                  v-model:page-size="pagination.page_size"
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
            <el-tab-pane
              v-if="canViewOwnAttendance"
              data-view-permission="my-attendance:view"
              label="我的考勤"
              name="my"
              class="tf-tab-panel"
            >
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
                      <i class="fas fa-user-clock" />
                    </template>
                  </el-input>
                </template>

                <!-- 类型筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_myattendanceview', 'record_type')"
                  class="form-group filter-item"
                  data-field="type"
                >
                  <el-select
                    v-model="myFilters.record_type"
                    placeholder="类型"
                    clearable
                    @change="loadMyData"
                  >
                    <el-option
                      label="休假"
                      value="monthly_leave"
                    />
                    <el-option
                      label="请假"
                      value="leave"
                    />
                    <el-option
                      label="加班"
                      value="overtime"
                    />
                  </el-select>
                </div>

                <!-- 状态筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_myattendanceview', 'status')"
                  class="form-group filter-item"
                  data-field="status"
                >
                  <el-select
                    v-model="myFilters.status"
                    placeholder="状态"
                    clearable
                    @change="loadMyData"
                  >
                    <el-option
                      label="待审批"
                      value="pending"
                    />
                    <el-option
                      label="已通过"
                      value="approved"
                    />
                    <el-option
                      label="已拒绝"
                      value="rejected"
                    />
                  </el-select>
                </div>

                <!-- 日期范围筛选 -->
                <div
                  v-if="canViewAttendanceField('attendance_myattendanceview', 'record_date')"
                  class="form-group filter-item filter-item--date-range"
                  data-field="date"
                >
                  <DateRangePicker
                    v-model="myDateRange"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    :value-format="TIME_FORMATS.DATE"
                    @change="handleMyDateRangeChange"
                  />
                </div>
              </UnifiedSearchPanel>

              <!-- 数据表格 -->
              <div class="table-section admin-panel admin-table-panel">
                <div class="table-responsive">
                  <el-table
                    ref="myAttendanceTableRef"
                    v-tf-loading="{ active: myLoading || refreshing, text: '正在刷新我的考勤记录...' }"
                    :data="displayMyAttendanceRows"
                    border
                    stripe
                    class="data-table devices-table compact-fit-table"
                    table-layout="fixed"
                    :fit="true"
                    row-key="id"
                    @row-click="handleMobileRowTap($event, 'my')"
                  >
                    <template #empty>
                      <TableLoadingRow
                        v-if="myLoading"
                        mode="block"
                        text="正在读取我的考勤记录..."
                      />
                      <DataEmptyState
                        v-else
                        description="暂无我的考勤记录"
                      />
                    </template>

                    <el-table-column
                      v-if="isMobile"
                      type="expand"
                      width="1"
                      class-name="mobile-expand-column"
                    >
                      <template #default="{ row }">
                        <div class="mobile-inline-actions">
                          <el-button
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--view"
                            title="查看"
                            @click.stop="handleView(row)"
                          >
                            <i class="fas fa-eye mr-1" /><span>查看</span>
                          </el-button>
                          <el-button
                            v-if="row.status === 'pending' && !isAggregatedAttendanceRow(row)"
                            size="small"
                            type="danger"
                            class="table-action table-action--warning"
                            title="撤销"
                            @click.stop="handleCancel(row)"
                          >
                            <i class="fas fa-times mr-1" /><span>撤销</span>
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceIdColumn"
                      prop="id"
                      label="ID"
                      :width="$getNumberColumnWidth((myLoading ? [] : displayMyAttendanceRows || []).map((row) => getAttendanceRowIds(row)), 90)"
                      align="center"
                    >
                      <template #default="{ row }">
                        <span class="table-number-badge">{{ getAttendanceRowIds(row) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceTypeColumn"
                      label="类型"
                      :min-width="myAttendanceTypeColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <el-tag
                          v-if="row.record_type === 'monthly_leave'"
                          type="success"
                        >
                          <i class="fas fa-umbrella-beach" />
                          休假
                        </el-tag>
                        <el-tag
                          v-else-if="row.record_type === 'leave'"
                          type="warning"
                        >
                          <i class="fas fa-user-clock" />
                          请假
                        </el-tag>
                        <el-tag
                          v-else-if="row.record_type === 'overtime'"
                          type="primary"
                        >
                          <i class="fas fa-business-time" />
                          加班
                        </el-tag>
                        <el-tag
                          v-else
                          type="danger"
                        >
                          <i class="fas fa-user-slash" />
                          未知
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceDetailColumn"
                      label="详情"
                      :min-width="myAttendanceDetailColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <span
                          v-if="row.record_type === 'monthly_leave'"
                          class="detail-item"
                        >
                          休假 {{ formatAttendanceQuantity(row.monthly_leave_days) }} 天
                        </span>
                        <span
                          v-else-if="row.record_type === 'leave'"
                          class="detail-item"
                        >
                          请假 {{ formatAttendanceQuantity(row.leave_days) }} 天
                        </span>
                        <span
                          v-else-if="row.record_type === 'overtime'"
                          class="detail-item"
                        >
                          {{ formatAttendanceQuantity(row.overtime_hours) }}小时
                        </span>
                        <span
                          v-else
                          class="detail-item"
                        >
                          -
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceDateColumn"
                      label="日期"
                      :min-width="myAttendanceDateColumnWidth"
                      align="center"
                      class-name="complete-text-column"
                    >
                      <template #default="{ row }">
                        {{ getAttendanceRecordDateText(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceReasonColumn"
                      label="原因"
                      :min-width="myAttendanceReasonColumnWidth"
                      class-name="complete-text-column wrapped-text-column"
                    >
                      <template #default="{ row }">
                        <span>{{ getReasonText(row) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceStatusColumn"
                      prop="status"
                      label="状态"
                      :min-width="myAttendanceStatusColumnWidth"
                      align="center"
                    >
                      <template #default="{ row }">
                        <el-tag
                          v-if="row.status === 'pending'"
                          type="info"
                        >
                          <i class="fas fa-clock" />
                          待审批
                        </el-tag>
                        <el-tag
                          v-else-if="row.status === 'approved'"
                          type="success"
                        >
                          <i class="fas fa-check-circle" />
                          已通过
                        </el-tag>
                        <el-tag
                          v-else
                          type="danger"
                        >
                          <i class="fas fa-times-circle" />
                          已拒绝
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="showMyAttendanceApprovalColumn"
                      prop="approval_note"
                      label="审批备注"
                      :min-width="myAttendanceApprovalColumnWidth"
                      class-name="complete-text-column wrapped-text-column"
                    />
                    <el-table-column
                      v-if="showMyAttendanceActionField"
                      label="操作"
                      :width="myAttendanceActionColumnWidth"
                      align="center"
                      header-align="center"
                      class-name="actions-column"
                    >
                      <template #default="{ row }">
                        <div class="action-buttons">
                          <el-button
                            size="small"
                            plain
                            type="primary"
                            class="table-action table-action--view"
                            title="查看"
                            @click.stop="handleView(row)"
                          >
                            <i class="fas fa-eye mr-1" />查看
                          </el-button>
                          <el-button
                            v-if="row.status === 'pending' && !isAggregatedAttendanceRow(row)"
                            size="small"
                            type="danger"
                            class="table-action table-action--warning"
                            title="撤销"
                            @click.stop="handleCancel(row)"
                          >
                            <i class="fas fa-times mr-1" />撤销
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>

                  <!-- 空状态 -->
                  <DataEmptyState
                    v-if="!myLoading && myTableData.length === 0"
                    description="暂无考勤记录"
                  >
                    <el-button
                      v-if="canCreateRequest"
                      plain
                      type="primary"
                      @click="showCreateDialog"
                    >
                      新增申请
                    </el-button>
                  </DataEmptyState>
                </div>

                <!-- 分页 -->
                <Pagination
                  v-if="myPagination.total > 0"
                  v-model:current="myPagination.page"
                  v-model:page-size="myPagination.page_size"
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
          dialog-class="attendance-form-dialog crud-dialog-lg"
          :close-on-click-modal="false"
          :show-default-footer="false"
          @close="closeAttendanceDialog"
        >
          <el-form
            ref="formRef"
            :model="formData"
            :rules="formRules"
            label-width="100px"
            class="attendance-dialog-form"
          >
            <!-- 可管理记录时允许为指定员工建单 -->
            <el-form-item
              v-if="canManageAttendanceRecords && canViewAttendanceField('attendance_attendanceview', 'employee_id')"
              label="选择员工"
              prop="employee_id"
            >
              <el-select
                v-model="formData.employee_id"
                placeholder="请选择员工"
                filterable
                remote
                reserve-keyword
                :remote-method="searchAttendanceEmployeesRemote"
                class="w-full"
                :disabled="!!formData.id"
                @focus="searchAttendanceEmployeesRemote('')"
              >
                <el-option
                  v-for="emp in employees"
                  :key="emp.id"
                  :label="emp.name || emp.username"
                  :value="emp.id"
                  :disabled="emp.has_salary_template !== true"
                >
                  <span>{{ emp.name || emp.username }}</span>
                  <span class="text-secondary text-xs ml-2">
                    {{ emp.username }}
                  </span>
                  <span
                    v-if="emp.has_salary_template !== true"
                    class="text-secondary text-xs ml-2"
                  >
                    未绑定工资模板
                  </span>
                </el-option>
              </el-select>
              <span
                v-if="formData.id"
                class="text-secondary text-xs ml-2"
              >
                编辑时不可更改员工
              </span>
            </el-form-item>

            <el-form-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')"
              label="记录类型"
              prop="record_type"
            >
              <el-alert
                v-if="salaryTemplateBound === false"
                title="该员工未绑定工资模板，不能申请或登记休假、请假、加班。请先在工资管理中绑定模板。"
                type="warning"
                :closable="false"
                class="mb-4"
              />
              <el-radio-group
                v-model="formData.record_type"
                :disabled="!canEditAttendanceField('attendance_attendanceview', 'record_type') || salaryTemplateBound !== true"
                @change="handleRecordTypeChange"
              >
                <el-radio value="monthly_leave">
                  <i class="fas fa-umbrella-beach" />
                  休假
                </el-radio>
                <el-radio value="leave">
                  <i class="fas fa-user-clock" />
                  请假
                </el-radio>
                <el-radio value="overtime">
                  <i class="fas fa-business-time" />
                  加班
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 休假表单 -->
            <template v-if="formData.record_type === 'monthly_leave'">
              <el-form-item label="休假说明">
                <el-alert
                  :title="`该员工月休假额度为${leaveBalance?.monthly_limit ?? 0}天${canViewAllAttendance ? '（所有额度）' : ''}`"
                  :type="leaveBalance?.last_month_remaining && leaveBalance.last_month_remaining > 0 ? 'success' : 'info'"
                  :closable="false"
                />
                <div class="mt-2 text-sm text-regular">
                  <div>上月休假：{{ leaveBalance?.monthly_history?.[0]?.used || 0 }} 天，请假：{{ leaveBalance?.monthly_history?.[0]?.regular_leave_days || 0 }} 天</div>
                  <div>本月休假：{{ leaveBalance?.used || 0 }} 天，剩余休假：{{ leaveBalance?.available || 0 }} 天</div>
                  <div class="text-secondary">
                    超过可用天数的部分将自动转为请假（无薪，扣工资）。
                  </div>
                </div>
              </el-form-item>
              <div
                v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')"
                class="attendance-date-range-grid"
              >
                <el-form-item
                  label="开始日期"
                  prop="record_date"
                >
                  <el-date-picker
                    v-model="leaveStartDate"
                    type="date"
                    placement="top-start"
                    placeholder="开始日期"
                    :value-format="TIME_FORMATS.DATE"
                    teleported
                    popper-class="tf2025-form-popper"
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
                    :value-format="TIME_FORMATS.DATE"
                    teleported
                    popper-class="tf2025-form-popper"
                    class="w-full"
                    @change="handleLeaveBoundaryChange('end', $event)"
                  />
                </el-form-item>
              </div>
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'monthly_leave_days')"
                label="休假天数"
              >
                <span class="days-display">{{ formData.monthly_leave_days }} 天</span>
                <span
                  v-if="leaveDateRange && leaveDateRange.length === 2"
                  class="date-range"
                >
                  ({{ leaveDateRange[0] }} 至 {{ leaveDateRange[1] }})
                </span>
                <el-tag
                  v-if="leaveAllocationPreview.regularLeaveDaysCount > 0"
                  type="warning"
                  class="ml-2"
                >
                  超过可用额度 {{ leaveAllocationPreview.regularLeaveDaysCount }} 天
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
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'leave_type')"
                label="请假类型"
                prop="leave_type"
              >
                <el-select
                  v-model="formData.leave_type"
                  placeholder="请选择"
                  class="w-full"
                  :disabled="!canEditAttendanceField('attendance_attendanceview', 'leave_type')"
                >
                  <el-option
                    label="事假"
                    value="事假"
                  />
                  <el-option
                    label="病假"
                    value="病假"
                  />
                  <el-option
                    label="年假"
                    value="年假"
                  />
                  <el-option
                    label="调休"
                    value="调休"
                  />
                </el-select>
              </el-form-item>
              <div
                v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')"
                class="attendance-date-range-grid"
              >
                <el-form-item
                  label="开始日期"
                  prop="record_date"
                >
                  <el-date-picker
                    v-model="leaveStartDate"
                    type="date"
                    placement="top-start"
                    placeholder="开始日期"
                    :value-format="TIME_FORMATS.DATE"
                    teleported
                    popper-class="tf2025-form-popper"
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
                    :value-format="TIME_FORMATS.DATE"
                    teleported
                    popper-class="tf2025-form-popper"
                    class="w-full"
                    @change="handleLeaveBoundaryChange('end', $event)"
                  />
                </el-form-item>
              </div>
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'leave_days')"
                label="请假天数"
              >
                <span class="days-display">{{ formData.leave_days }} 天</span>
                <span
                  v-if="leaveDateRange && leaveDateRange.length === 2"
                  class="date-range"
                >
                  ({{ leaveDateRange[0] }} 至 {{ leaveDateRange[1] }})
                </span>
                <el-tag
                  type="danger"
                  class="ml-2"
                >
                  无薪,扣工资
                </el-tag>
              </el-form-item>
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'reason')"
                label="请假原因"
                prop="leave_reason"
              >
                <el-input
                  v-model="formData.leave_reason"
                  class="tf-textarea"
                  type="textarea"
                  :rows="3"
                  placeholder="请说明请假原因"
                  :disabled="!canEditAttendanceField('attendance_attendanceview', 'reason')"
                />
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
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')"
                label="加班日期"
                prop="record_date"
              >
                <el-date-picker
                  v-model="formData.record_date"
                  type="date"
                  placement="top-start"
                  placeholder="选择加班日期"
                  :value-format="TIME_FORMATS.DATE"
                  teleported
                  popper-class="tf2025-form-popper"
                  class="w-full"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'overtime_hours')"
                label="加班时长"
                prop="overtime_hours"
              >
                <el-input-number
                  v-model="formData.overtime_hours"
                  :min="0.5"
                  :max="24"
                  :step="0.5"
                  :precision="1"
                  :controls="false"
                  class="w-full"
                  :disabled="!canEditAttendanceField('attendance_attendanceview', 'overtime_hours')"
                />
                <span class="ml-2 text-secondary">小时</span>
                <el-tag
                  type="success"
                  class="ml-2"
                >
                  有加班费
                </el-tag>
              </el-form-item>
              <el-form-item
                v-if="canViewAttendanceField('attendance_attendanceview', 'reason')"
                label="加班原因"
                prop="overtime_reason"
              >
                <el-input
                  v-model="formData.overtime_reason"
                  class="tf-textarea"
                  type="textarea"
                  :rows="3"
                  placeholder="请说明加班原因"
                  :disabled="!canEditAttendanceField('attendance_attendanceview', 'reason')"
                />
              </el-form-item>
            </template>
          </el-form>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                plain
                type="default"
                @click="closeAttendanceDialog"
              >
                <i class="fas fa-times mr-1" />取消
              </el-button>
              <el-button
                plain
                type="primary"
                :disabled="submitting"
                :loading="submitting"
                @click="handleSubmit"
              >
                <span v-if="submitting">提交中...</span>
                <template v-else>
                  <i class="fas fa-paper-plane mr-1" />提交申请
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 详情对话框 -->
        <MobileDialog
          v-model="detailDialogVisible"
          title="考勤详情"
          dialog-class="attendance-detail-dialog crud-dialog-md-lg"
          :close-on-click-modal="false"
          :show-default-footer="false"
          @close="detailDialogVisible = false"
        >
          <el-descriptions
            v-if="currentRecord"
            :column="isMobile ? 1 : 2"
            border
            class="attendance-detail-descriptions"
          >
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'record_type')"
              label="类型"
            >
              <el-tag
                v-if="currentRecord.record_type === 'monthly_leave'"
                type="success"
              >
                休假
              </el-tag>
              <el-tag
                v-else-if="currentRecord.record_type === 'leave'"
                type="warning"
              >
                请假
              </el-tag>
              <el-tag
                v-else-if="currentRecord.record_type === 'overtime'"
                type="primary"
              >
                加班
              </el-tag>
              <el-tag
                v-else
                type="danger"
              >
                未知
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'record_date')"
              label="日期"
            >
              {{ currentRecord.record_type === 'monthly_leave'
                ? formatAttendanceTableDateRange(currentRecord.record_date, currentRecord.record_type, currentRecord.monthly_leave_days)
                : currentRecord.record_type === 'leave'
                  ? formatAttendanceTableDateRange(currentRecord.record_date, currentRecord.record_type, currentRecord.leave_days)
                  : formatAttendanceTableDateRange(currentRecord.record_date, currentRecord.record_type) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="isAggregatedAttendanceRow(currentRecord)"
              label="原记录 ID"
            >
              {{ getAttendanceRowIds(currentRecord) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'leave_type') && currentRecord.leave_type"
              label="请假类型"
            >
              {{ currentRecord.leave_type }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'leave_days') && currentRecord.leave_days"
              label="请假天数"
            >
              请假 {{ formatAttendanceQuantity(currentRecord.leave_days) }} 天
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'monthly_leave_days') && currentRecord.monthly_leave_days"
              label="休假天数"
            >
              休假 {{ formatAttendanceQuantity(currentRecord.monthly_leave_days) }} 天
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'overtime_hours') && currentRecord.overtime_hours"
              label="加班时长"
            >
              {{ formatAttendanceQuantity(currentRecord.overtime_hours) }} 小时
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'reason')"
              label="原因"
              :span="2"
            >
              {{ getReasonText(currentRecord) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'status')"
              label="状态"
            >
              <el-tag
                v-if="currentRecord.status === 'pending'"
                type="info"
              >
                待审批
              </el-tag>
              <el-tag
                v-else-if="currentRecord.status === 'approved'"
                type="success"
              >
                已通过
              </el-tag>
              <el-tag
                v-else
                type="danger"
              >
                已拒绝
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'approval_note') && currentRecord.approval_note"
              label="审批备注"
              :span="2"
            >
              {{ currentRecord.approval_note }}
            </el-descriptions-item>
          </el-descriptions>

          <el-table
            v-if="currentRecord && isAggregatedAttendanceRow(currentRecord)"
            :data="currentRecord.source_records"
            row-key="id"
            border
            stripe
            class="data-table attendance-group-details"
          >
            <el-table-column
              label="ID"
              prop="id"
              :width="$getNumberColumnWidth((currentRecord.source_records || []).map((row) => row.id), 64)"
              align="center"
            >
              <template #default="{ row }">
                <span class="table-number-badge">{{ row.id }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="日期"
              :min-width="attendanceGroupDetailDateColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ getAttendanceRecordDateText(row) }}
              </template>
            </el-table-column>
            <el-table-column
              label="详情"
              :min-width="attendanceGroupDetailDetailColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ getAttendanceDetailText(row) }}
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              :min-width="attendanceGroupDetailActionColumnWidth"
              align="center"
              class-name="actions-column"
            >
              <template #default="{ row }">
                <div class="action-buttons">
                  <template v-if="activeTab === 'all'">
                    <el-button
                      v-if="canEdit"
                      size="small"
                      type="primary"
                      @click.stop="handleEdit(row)"
                    >
                      <i class="fas fa-edit" />
                      编辑
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      size="small"
                      type="danger"
                      @click.stop="handleDelete(row)"
                    >
                      <i class="fas fa-trash" />
                      删除
                    </el-button>
                    <el-button
                      v-if="canApprove && row.status === 'pending'"
                      size="small"
                      type="success"
                      @click.stop="handleApprove(row)"
                    >
                      <i class="fas fa-check" />
                      审批
                    </el-button>
                  </template>
                  <el-button
                    v-else-if="row.status === 'pending'"
                    size="small"
                    type="danger"
                    @click.stop="handleCancel(row)"
                  >
                    <i class="fas fa-times" />
                    撤销
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                plain
                type="default"
                @click="detailDialogVisible = false"
              >
                <i class="fas fa-times mr-1" />关闭
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 审批对话框 -->
        <MobileDialog
          v-model="approveDialogVisible"
          title="审批考勤记录"
          dialog-class="attendance-approve-dialog crud-dialog-md"
          :close-on-click-modal="false"
          :show-default-footer="false"
          @close="approveDialogVisible = false"
        >
          <el-form
            :model="approveForm"
            label-width="100px"
          >
            <el-form-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'status')"
              label="审批结果"
            >
              <el-radio-group
                v-model="approveForm.status"
                :disabled="!canEditAttendanceField('attendance_attendanceview', 'status')"
              >
                <el-radio value="approved">
                  通过
                </el-radio>
                <el-radio value="rejected">
                  拒绝
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item
              v-if="canViewAttendanceField('attendance_attendanceview', 'approval_note')"
              label="审批备注"
            >
              <el-input
                v-model="approveForm.note"
                class="tf-textarea"
                type="textarea"
                :rows="3"
                placeholder="请输入审批备注(可选)"
                :disabled="!canEditAttendanceField('attendance_attendanceview', 'approval_note')"
              />
            </el-form-item>
          </el-form>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                plain
                type="default"
                @click="approveDialogVisible = false"
              >
                <i class="fas fa-times mr-1" />取消
              </el-button>
              <el-button
                plain
                type="success"
                :disabled="approving"
                :loading="approving"
                @click="handleApproveSubmit"
              >
                <span v-if="approving">处理中...</span>
                <template v-else>
                  <i class="fas fa-check mr-1" />确认
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>
      </div>
    </el-config-provider>
  </PermissionGate>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElConfigProvider, type FormInstance, type FormRules, type TabPaneName } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { attendanceApi } from '@/api/attendance'
import type { AttendanceLeaveBalance, AttendanceRecord } from '@/api/attendance'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useMobileRowDoubleTap } from '@/composables/useMobileRowDoubleTap'
import { useLoadingState } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { searchEmployees } from '@/services/reference-options'
import { logger } from '@/utils/logger'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { getActionColumnMinWidth, getAdaptiveActionColumnWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import {
  buildAttendanceLeaveAllocation,
  createAttendanceBatchId,
  formatAttendanceTableDateRange,
  formatAttendanceLeaveReason,
  groupAttendanceRecordsForDisplay,
  groupAttendanceLeaveAssignments,
  type AttendanceLeaveAllocation
} from '@/utils/attendance-leave-allocation'
const globalNotifications = useNotification()


interface AttendanceTableRow extends Omit<
  AttendanceRecord,
  'leave_days' | 'overtime_hours' | 'monthly_leave_days'
> {
  employee_name?: string
  leave_days?: number | string
  overtime_hours?: number | string
  monthly_leave_days?: number | string
  source_records?: AttendanceTableRow[]
  source_record_ids?: number[]
}

interface EmployeeOption {
  id: number
  name?: string
  username?: string
  has_salary_template?: boolean
}

interface ExpandableAttendanceTableRef {
  toggleRowExpansion: (_row: AttendanceTableRow, _expanded?: boolean) => void
}

type AttendanceTab = 'all' | 'my'

const createDefaultAttendanceForm = (): AttendanceRecord => ({
  id: undefined,
  employee_id: undefined,
  record_type: 'monthly_leave',
  record_date: '',
  leave_type: '',
  leave_days: 1,
  leave_reason: '',
  overtime_hours: 2,
  overtime_reason: '',
  monthly_leave_days: 1,
  status: 'pending'
})

// 配置中文语言环境
const locale = zhCn
// 权限检查
const {
  canView,
  canCreate: canCreatePermission,
  canEdit,
  canDelete,
  canApprove: canApprovePermission,
  handleNoPermission: handleAttendanceNoPermission
} = usePagePermissions('attendance')
const myAttendancePermissions = usePagePermissions('my-attendance')
const { init: initFieldPermissions } = fieldPermissions

const authStore = useAuthStore()
const canViewOwnAttendance = computed(() => myAttendancePermissions.canView.value)
const canViewAllAttendance = computed(() => (
  canView.value ||
  authStore.hasPermission('attendance:view:all')
))
const canCreateOwnAttendance = computed(() => myAttendancePermissions.canCreate.value)
const canAccessPage = computed(() => canViewAllAttendance.value || canViewOwnAttendance.value)
const canCreateRequest = computed(() => canCreatePermission.value || canCreateOwnAttendance.value)
const { success, error, warning: _warning } = useNotification()
const { isMobile } = useMobile()
const { loading } = useLoadingState()
loading.value = true
const refreshing = ref(false)
const myLoading = ref(true)
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
const attendanceTableRef = ref<ExpandableAttendanceTableRef | null>(null)
const myAttendanceTableRef = ref<ExpandableAttendanceTableRef | null>(null)
const mobileExpandedAttendanceId = ref<number | null>(null)
const mobileExpandedMyAttendanceId = ref<number | null>(null)
const { isDoubleTap, resetDoubleTap } = useMobileRowDoubleTap()
const formRef = ref<FormInstance>()
const activeTab = ref<AttendanceTab>('my')

// 搜索相关状态
const searchExpanded = ref(false)
const mySearchExpanded = ref(false)
const currentRecord = ref<AttendanceTableRow | null>(null)
const leaveBalance = ref<AttendanceLeaveBalance | null>(null)
const salaryTemplateBound = ref<boolean | null>(null)

// 统计数据
const stats = ref({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  // 待审批费用统计
  pending_overtime_pay: 0,
  pending_leave_deduction: 0
})

// 上月统计数据
const lastMonthStats = ref({
  leave_days: 0,
  overtime_hours: 0
})

// 本月统计数据
const currentMonthStats = ref({
  available_leave_days: 0,
  total_leave_days: 0,
  unpaid_leave_days: 0,
  overtime_hours: 0,
  used_days: 0,
  is_exhausted: false
})

// 审批表单
const approveForm = reactive({
  status: 'approved' as 'approved' | 'rejected',
  note: ''
})

// 具备页面查看能力且拥有任一管理动作时，可管理全员考勤记录。
const canManageAttendanceRecords = computed(() => canViewAllAttendance.value)

const canViewTeamAttendance = computed(() => canViewAllAttendance.value)
const canApprove = computed(() => canApprovePermission.value)

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
  canViewAttendanceField('attendance_attendanceview', 'overtime_hours')
))
const showAttendanceReasonColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'reason') && !isMobile.value)
const showAttendanceStatusColumn = computed(() => shouldShowActionColumn(
  canViewAttendanceField('attendance_attendanceview', 'status'),
  [canApprove.value]
))
const showAttendanceApprovalColumn = computed(() => canViewAttendanceField('attendance_attendanceview', 'approval_note') && !isMobile.value)
const showAttendanceActionField = computed(() => (
  shouldShowActionColumn(
    canViewAttendanceField('attendance_attendanceview', 'actions'),
    [canEdit.value, canDelete.value]
  ) && !isMobile.value
))

const showMyAttendanceIdColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'id') && !isMobile.value)
const showMyAttendanceTypeColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'record_type'))
const showMyAttendanceDateColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'record_date'))
const showMyAttendanceDetailColumn = computed(() => (
  canViewAttendanceField('attendance_myattendanceview', 'monthly_leave_days') ||
  canViewAttendanceField('attendance_myattendanceview', 'leave_type') ||
  canViewAttendanceField('attendance_myattendanceview', 'leave_days') ||
  canViewAttendanceField('attendance_myattendanceview', 'overtime_hours')
))
const showMyAttendanceReasonColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'reason') && !isMobile.value)
const showMyAttendanceStatusColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'status') && !isMobile.value)
const showMyAttendanceApprovalColumn = computed(() => canViewAttendanceField('attendance_myattendanceview', 'approval_note') && !isMobile.value)
const showMyAttendanceActionField = computed(() => (
  shouldShowActionColumn(
    canViewAttendanceField('attendance_myattendanceview', 'actions'),
    [canCreateOwnAttendance.value]
  ) && !isMobile.value
))
const displayAttendanceRows = computed(() => groupAttendanceRecordsForDisplay(
  tableData.value as AttendanceRecord[]
) as AttendanceTableRow[])
const displayMyAttendanceRows = computed(() => groupAttendanceRecordsForDisplay(
  myTableData.value as AttendanceRecord[]
) as AttendanceTableRow[])
const isAggregatedAttendanceRow = (row: AttendanceTableRow) => (
  (row.source_records?.length || 0) > 1
)
const getAttendanceRowIds = (row: AttendanceTableRow) => (
  row.source_record_ids?.length
    ? row.source_record_ids.join('、')
    : row.id || '-'
)
const getAttendanceRecordDateText = (row: AttendanceTableRow) => {
  return formatAttendanceTableDateRange(
    row.record_date,
    row.record_type,
    row.record_type === 'monthly_leave' ? row.monthly_leave_days : row.leave_days
  )
}
const getAttendanceDetailText = (row: AttendanceTableRow) => {
  if (row.record_type === 'monthly_leave') return `休假 ${formatAttendanceQuantity(row.monthly_leave_days)} 天`
  if (row.record_type === 'leave') return `请假 ${formatAttendanceQuantity(row.leave_days)} 天`
  if (row.record_type === 'overtime') return `${formatAttendanceQuantity(row.overtime_hours)}小时`
  return '-'
}
const getAttendanceStatusText = (row: AttendanceTableRow) => (
  row.status === 'pending' ? '待审批' : row.status === 'approved' ? '已通过' : '已拒绝'
)
const getAttendanceColumnWidth = (
  label: string,
  values: Array<string | number | null | undefined>,
  minWidth: number,
  maxWidth = Number.POSITIVE_INFINITY,
  horizontalPadding = 24
) => getTextColumnMinWidth([label, ...values], {
  minWidth,
  maxWidth,
  horizontalPadding,
  asciiCharacterWidth: isMobile.value ? 6.5 : 8,
  wideCharacterWidth: isMobile.value ? 11 : 13
})
const attendanceEmployeeColumnWidth = computed(() => getAttendanceColumnWidth('员工', tableData.value.map(row => row.employee_name), isMobile.value ? 76 : 82))
const attendanceTypeColumnWidth = computed(() => getAttendanceColumnWidth('类型', tableData.value.map(() => '休假'), isMobile.value ? 66 : 76, 88, 34))
const attendanceDetailColumnWidth = computed(() => getAttendanceColumnWidth('详情', tableData.value.map(getAttendanceDetailText), isMobile.value ? 120 : 156, 240, 36))
const attendanceDateColumnWidth = computed(() => getAttendanceColumnWidth('日期', displayAttendanceRows.value.map(getAttendanceRecordDateText), isMobile.value ? 82 : 102, 190))
const attendanceReasonColumnWidth = computed(() => getAttendanceColumnWidth('原因', tableData.value.map(getReasonText), 96, 168))
const attendanceStatusColumnWidth = computed(() => Math.max(
  getAttendanceColumnWidth('状态', tableData.value.map(getAttendanceStatusText), 88, 98, 34),
  canApprove.value
    ? getActionColumnMinWidth(['审批'], { minWidth: 88, horizontalPadding: 16 })
    : 0
))
const attendanceApprovalColumnWidth = computed(() => getAttendanceColumnWidth('审批备注', tableData.value.map(row => row.approval_note), 104, 168))
const myAttendanceTypeColumnWidth = computed(() => getAttendanceColumnWidth('类型', myTableData.value.map(() => '休假'), isMobile.value ? 70 : 76, 88, 34))
const myAttendanceDetailColumnWidth = computed(() => getAttendanceColumnWidth('详情', myTableData.value.map(getAttendanceDetailText), isMobile.value ? 120 : 156, 240, 36))
const myAttendanceDateColumnWidth = computed(() => getAttendanceColumnWidth('日期', displayMyAttendanceRows.value.map(getAttendanceRecordDateText), isMobile.value ? 82 : 102, 190))
const myAttendanceReasonColumnWidth = computed(() => getAttendanceColumnWidth('原因', myTableData.value.map(getReasonText), 96, 168))
const myAttendanceStatusColumnWidth = computed(() => getAttendanceColumnWidth('状态', myTableData.value.map(getAttendanceStatusText), 88, 98, 34))
const myAttendanceApprovalColumnWidth = computed(() => getAttendanceColumnWidth('审批备注', myTableData.value.map(row => row.approval_note), 104, 168))
const attendanceActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  tableData.value,
  [
    { label: '查看', visible: true },
    { label: row => row.status === 'pending' ? '编辑' : '修改', visible: canEdit.value },
    { label: '删除', visible: canDelete.value }
  ]
))
const myAttendanceActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  myTableData.value,
  [
    { label: '查看', visible: true },
    { label: '撤销', visible: row => row.status === 'pending' }
  ]
))
const attendanceGroupDetailRows = computed(() => currentRecord.value?.source_records || [])
const attendanceGroupDetailDateColumnWidth = computed(() => getAttendanceColumnWidth(
  '日期',
  attendanceGroupDetailRows.value.map(getAttendanceRecordDateText),
  isMobile.value ? 110 : 128,
  190
))
const attendanceGroupDetailDetailColumnWidth = computed(() => getAttendanceColumnWidth(
  '详情',
  attendanceGroupDetailRows.value.map(getAttendanceDetailText),
  isMobile.value ? 96 : 112,
  160
))
const attendanceGroupDetailActionColumnWidth = computed(() => {
  const actions = activeTab.value === 'all'
    ? [
      { label: '编辑', visible: canEdit.value },
      { label: '删除', visible: canDelete.value },
      { label: '审批', visible: (row: AttendanceTableRow) => canApprove.value && row.status === 'pending' }
    ]
    : [
      { label: '撤销', visible: (row: AttendanceTableRow) => row.status === 'pending' }
    ]

  return getAdaptiveActionColumnWidth(attendanceGroupDetailRows.value, actions, {
    buttonWidth: 66,
    buttonGap: 8,
    horizontalPadding: 16
  })
})
const _attendanceVisibleColumnCount = computed(() => {
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
const _myAttendanceVisibleColumnCount = computed(() => {
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

const hasFilterValue = (value: unknown): value is string | number => (
  (typeof value === 'string' && value !== '') || typeof value === 'number'
)

const buildAttendanceQueryParams = (
  moduleKey: 'attendance_attendanceview' | 'attendance_myattendanceview',
  sourceFilters: typeof filters | typeof myFilters,
  pager: { page: number; page_size: number },
  range: [string, string] | null
) => {
  const filterState = sourceFilters as typeof filters
  const params: Record<string, string | number> = {
    page: pager.page,
    page_size: pager.page_size
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
  page_size: 20,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})

const myPagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})

const formData = reactive<AttendanceRecord>(createDefaultAttendanceForm())

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

const loadData = async (showLoadingState = true) => {
  if (!canViewAllAttendance.value) {
    tableData.value = []
    pagination.total = 0
    loading.value = false
    return
  }

  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params = buildAttendanceQueryParams('attendance_attendanceview', filters, pagination, dateRange.value)
    const response = await attendanceApi.getAttendanceRecords(params)

    if (response.data) {
      tableData.value = Array.isArray(response.data.records) ? response.data.records as AttendanceTableRow[] : []
      pagination.page = Number(response.data.pagination?.page) || pagination.page
      pagination.page_size = Number(response.data.pagination?.page_size) || pagination.page_size
      pagination.total = Number(response.data.pagination?.total) || 0
      pagination.total_pages = Number(response.data.pagination?.total_pages) || 0
      pagination.has_next = Boolean(response.data.pagination?.has_next)
      pagination.has_prev = Boolean(response.data.pagination?.has_prev)

      // 基础状态统计（基于当前页数据）
      stats.value.total = response.data.pagination?.total || 0
      stats.value.pending = tableData.value.filter((r) => r.status === 'pending').length
      stats.value.approved = tableData.value.filter((r) => r.status === 'approved').length
      stats.value.rejected = tableData.value.filter((r) => r.status === 'rejected').length

      // 从后端获取仪表盘汇总统计
      await loadDashboardStats()
    }
  } catch (error) {
    globalNotifications.error('加载数据失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const loadMyData = async (showLoadingState = true) => {
  if (!canViewOwnAttendance.value) {
    myTableData.value = []
    myPagination.total = 0
    myLoading.value = false
    return
  }

  if (showLoadingState) {
    myLoading.value = true
  }
  try {
    const params = buildAttendanceQueryParams('attendance_myattendanceview', myFilters, myPagination, myDateRange.value)
    // 使用 getMyAttendanceRecords 获取个人考勤记录
    const response = await attendanceApi.getMyAttendanceRecords(params)

    if (response.data) {
      myTableData.value = Array.isArray(response.data.records) ? response.data.records as AttendanceTableRow[] : []
      myPagination.page = Number(response.data.pagination?.page) || myPagination.page
      myPagination.page_size = Number(response.data.pagination?.page_size) || myPagination.page_size
      myPagination.total = Number(response.data.pagination?.total) || 0
      myPagination.total_pages = Number(response.data.pagination?.total_pages) || 0
      myPagination.has_next = Boolean(response.data.pagination?.has_next)
      myPagination.has_prev = Boolean(response.data.pagination?.has_prev)

      await loadLeaveBalance()

      // 基础状态统计（基于当前页数据）
      stats.value.total = response.data.pagination?.total || 0
      stats.value.pending = myTableData.value.filter((r) => r.status === 'pending').length
      stats.value.approved = myTableData.value.filter((r) => r.status === 'approved').length
      stats.value.rejected = myTableData.value.filter((r) => r.status === 'rejected').length

      // 从后端获取仪表盘汇总统计
      await loadDashboardStats()
    }
  } catch (error) {
    globalNotifications.error('加载数据失败')
  } finally {
    if (showLoadingState) {
      myLoading.value = false
    }
  }
}

// 从后端获取仪表盘汇总统计
const loadDashboardStats = async () => {
  try {
    const response = await attendanceApi.getDashboardStats()
    if (response.data) {
      const dashboardData = response.data

      // 更新上月统计
      lastMonthStats.value = {
        leave_days: dashboardData.last_month?.leave_days || 0,
        overtime_hours: dashboardData.last_month?.overtime_hours || 0
      }

      // 更新本月统计
      const monthly_limit = Number(leaveBalance.value?.monthly_limit ?? 0)
      const usedDays = dashboardData.current_month?.leave_days || 0
      const totalAvailable = Number(leaveBalance.value?.available ?? monthly_limit)
      const availableLeaveDays = Math.max(0, totalAvailable - usedDays)

      currentMonthStats.value = {
        available_leave_days: availableLeaveDays,
        total_leave_days: totalAvailable,
        unpaid_leave_days: dashboardData.current_month?.unpaid_leave_days || 0,
        overtime_hours: dashboardData.current_month?.overtime_hours || 0,
        used_days: usedDays,
        is_exhausted: availableLeaveDays === 0
      }

      // 更新待审批费用统计
      stats.value.pending_overtime_pay = dashboardData.pending?.overtime_pay || 0
      stats.value.pending_leave_deduction = dashboardData.pending?.leave_deduction || 0
    }
  } catch (error) {
    logger.error('获取仪表盘统计失败:', error)
  }
}

// 团队考勤分页处理
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.page_size = pageSize
  loadData()
}

// 我的考勤分页处理
const handleMyPaginationChange = (page: number, pageSize: number) => {
  myPagination.page = page
  myPagination.page_size = pageSize
  loadMyData()
}

const resetAttendanceForm = () => {
  Object.assign(formData, createDefaultAttendanceForm())
  leaveDateRange.value = null
  leaveStartDate.value = ''
  leaveEndDate.value = ''
  leaveBalance.value = null
  formRef.value?.clearValidate()
}

const closeAttendanceDialog = () => {
  dialogVisible.value = false
  resetAttendanceForm()
}

const refreshActiveAttendanceData = async () => {
  if (activeTab.value === 'all') {
    await loadData()
    return
  }

  await loadMyData()
}

const _updateStats = (data: AttendanceTableRow[]) => {
  // 基础统计
  const pendingRecords = data.filter((r) => r.status === 'pending')

  stats.value = {
    total: data.length,
    pending: pendingRecords.length,
    approved: data.filter((r) => r.status === 'approved').length,
    rejected: data.filter((r) => r.status === 'rejected').length,
    pending_overtime_pay: stats.value.pending_overtime_pay,
    pending_leave_deduction: stats.value.pending_leave_deduction
  }

  // 计算上月和本月统计
  const now = TimeUtil.now()
  const current_month_index = now.month()
  const currentYear = now.year()

  // 上月
  const last_month_index = current_month_index === 0 ? 11 : current_month_index - 1
  const last_month_year = current_month_index === 0 ? currentYear - 1 : currentYear

  // 计算上月统计
  const lastMonthData = data.filter((r) => {
    if (!r.record_date) return false
    const recordDate = TimeUtil.parse(r.record_date)
    return Boolean(recordDate?.isValid()
      && recordDate.month() === last_month_index
      && recordDate.year() === last_month_year)
  })

  lastMonthStats.value = {
    leave_days: lastMonthData
      .filter((r) => r.record_type === 'monthly_leave')  // 只统计带薪休假
      .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0),
    overtime_hours: lastMonthData
      .filter((r) => r.record_type === 'overtime')
      .reduce((sum: number, r) => sum + toAttendanceNumber(r.overtime_hours, 0), 0)
  }

  // 计算本月统计
  const currentMonthData = data.filter((r) => {
    if (!r.record_date) return false
    const recordDate = TimeUtil.parse(r.record_date)
    if (!recordDate?.isValid()) {
      return false
    }
    return recordDate.month() === current_month_index && recordDate.year() === currentYear
  })

  // 优先使用后端按工资模板和累计规则算出的额度
  const monthly_limit = Number(leaveBalance.value?.monthly_limit ?? 0)

  // 上月已使用的休假天数（只统计 monthly_leave 类型）
  const lastMonthUsedLeaveDays = lastMonthData
    .filter((r) => r.record_type === 'monthly_leave')
    .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0)

  const lastMonthUnusedDays = typeof leaveBalance.value?.last_month_remaining === 'number'
    ? Number(leaveBalance.value.last_month_remaining || 0)
    : Math.min(monthly_limit, Math.max(0, monthly_limit - lastMonthUsedLeaveDays))

  // 本月总可用天数 = 本月额度 + 上月可累计额度，最多为模板月额度的两倍
  const totalAvailableThisMonth = Math.min(monthly_limit * 2, monthly_limit + lastMonthUnusedDays)

  // 本月已使用的休假天数（只统计 monthly_leave 类型，带薪休假）
  const usedMonthlyLeaveDays = currentMonthData
    .filter((r) => r.record_type === 'monthly_leave')
    .reduce((sum: number, r) => sum + Math.round(toAttendanceNumber(r.monthly_leave_days, 0)), 0)

  // 本月剩余可用天数
  const availableLeaveDays = Math.max(0, totalAvailableThisMonth - usedMonthlyLeaveDays)

  // 本月加班小时数
  const overtime_hours = currentMonthData
    .filter((r) => r.record_type === 'overtime')
    .reduce((sum: number, r) => sum + toAttendanceNumber(r.overtime_hours, 0), 0)

  // 计算无薪请假天数：超过总额度的部分才算无薪请假
  const unpaid_leave_days = Math.max(0, usedMonthlyLeaveDays - totalAvailableThisMonth)

  // 如果数据库中还有直接的 leave 类型记录，也要计入无薪请假
  const directUnpaidLeaveDays = currentMonthData
    .filter((r) => r.record_type === 'leave')
    .reduce((sum: number, r) => {
      const days = Math.round(toAttendanceNumber(r.leave_days, 0))
      return sum + days
    }, 0)

  // 总无薪请假 = 超过额度的部分 + 直接标记为无薪请假的记录
  const totalUnpaidLeaveDays = unpaid_leave_days + directUnpaidLeaveDays

  currentMonthStats.value = {
    available_leave_days: availableLeaveDays,
    total_leave_days: totalAvailableThisMonth,
    unpaid_leave_days: totalUnpaidLeaveDays,
    overtime_hours,
    used_days: usedMonthlyLeaveDays,
    is_exhausted: availableLeaveDays === 0
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
  resetAttendanceForm()

  // 加载员工列表和休假余额
  if (canManageAttendanceRecords.value) {
    await loadEmployees()
  }
  // 所有用户都需要加载自己的休假余额
  await loadLeaveBalance()
  dialogVisible.value = true
}

const loadLeaveBalance = async (
  employeeId?: number | string,
  range?: [string, string] | null
) => {
  salaryTemplateBound.value = null
  try {
    const normalizedEmployeeId = employeeId === '' || employeeId === null || employeeId === undefined
      ? undefined
      : Number(employeeId)
    const response = await attendanceApi.getLeaveBalance(
      Number.isFinite(normalizedEmployeeId) ? normalizedEmployeeId : undefined,
      range && range.length === 2
        ? { start_date: range[0], end_date: range[1] }
        : undefined
    )
    // unifiedApi 返回的是 response.data
    if (response.data) {
      leaveBalance.value = response.data
      salaryTemplateBound.value = response.data.template_bound === true
    }
  } catch (error) {
    leaveBalance.value = null
    logger.error('加载休假余额失败:', error)
  }
}

const toAttendanceNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatAttendanceQuantity = (value: unknown) => {
  const parsed = toAttendanceNumber(value, 0)
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(2)))
}

const isAttendanceDialogCancelled = (error: unknown) =>
  error === 'cancel' || error === 'close'

const buildLeaveAllocation = (requestedDays: number, range: [string, string] | null) =>
  buildAttendanceLeaveAllocation({
    requestedDays,
    range,
    monthlyLimit: Number(leaveBalance.value?.monthly_limit ?? 0),
    available: Number(leaveBalance.value?.available) || 0,
    monthlyBalances: leaveBalance.value?.monthly_balances || []
  })

const leaveAllocationPreview = computed(() => buildLeaveAllocation(
  Number(formData.monthly_leave_days) || 0,
  leaveDateRange.value
))

const buildAttendanceSplitDateDetail = (allocation: AttendanceLeaveAllocation) => {
  if (allocation.assignments.length === 0) return ''
  return `\n\n具体日期分配：\n${groupAttendanceLeaveAssignments(allocation.assignments).map(item => {
    const date = TimeUtil.parse(item.startDate)
    const endDate = TimeUtil.parse(item.endDate)
    const dateLabel = date?.isValid() ? TimeUtil.format(date, TIME_FORMATS.MONTH_DAY_DISPLAY) : item.startDate
    const endDateLabel = endDate?.isValid() ? TimeUtil.format(endDate, TIME_FORMATS.MONTH_DAY_DISPLAY) : item.endDate
    return `${dateLabel}${item.days > 1 ? `至${endDateLabel}` : ''}：${item.type === 'monthly_leave' ? `休假 ${item.days} 天` : `请假 ${item.days} 天，无薪无提成！`}`
  }).join('\n')}`
}

const buildAttendanceSplitConfirmMessage = (
  requestedDays: number,
  availableDays: number,
  allocation: AttendanceLeaveAllocation
) => `申请日期范围内可用休假天数：${availableDays}天
申请天数：${requestedDays}天
${allocation.monthlyLeaveDaysCount > 0 ? `休假 ${allocation.monthlyLeaveDaysCount} 天\n` : ''}${allocation.regularLeaveDaysCount > 0 ? `请假 ${allocation.regularLeaveDaysCount} 天，无薪无提成！` : ''}${buildAttendanceSplitDateDetail(allocation)}

是否继续？`

const createSplitAttendanceRecords = async (
  submitData: AttendanceRecord,
  allocation: AttendanceLeaveAllocation
) => {
  const groups = groupAttendanceLeaveAssignments(allocation.assignments)
  const batchId = createAttendanceBatchId()
  for (const group of groups) {
    if (group.type === 'monthly_leave') {
      await attendanceApi.createAttendanceRecord({
        employee_id: submitData.employee_id,
        attendance_batch_id: batchId,
        record_type: 'monthly_leave',
        record_date: group.startDate,
        monthly_leave_days: group.days,
        status: 'pending'
      })
    } else {
      await attendanceApi.createAttendanceRecord({
        employee_id: submitData.employee_id,
        attendance_batch_id: batchId,
        record_type: 'leave',
        record_date: group.startDate,
        leave_type: '事假',
        leave_days: group.days,
        leave_reason: `请假 ${group.days} 天，无薪无提成！`,
        status: 'pending'
      })
    }
  }
}

const buildAttendanceSubmitSuccessMessage = (
  monthlyLeaveDaysCount: number,
  regularLeaveDaysCount: number
) => {
  if (monthlyLeaveDaysCount > 0 && regularLeaveDaysCount > 0) {
    return `提交成功：休假${monthlyLeaveDaysCount}天，请假${regularLeaveDaysCount}天`
  }

  if (monthlyLeaveDaysCount > 0) {
    return `提交成功：休假${monthlyLeaveDaysCount}天`
  }

  return `提交成功：请假${regularLeaveDaysCount}天`
}

const handleEdit = (row: AttendanceTableRow) => {
  if (!canEdit.value) {
    handleAttendanceNoPermission('edit')
    return
  }

  detailDialogVisible.value = false
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
    monthly_leave_days: toAttendanceNumber(row.monthly_leave_days, 1),
    status: row.status
  })
  if (row.record_type === 'monthly_leave') {
    const rangeDays = Math.max(toAttendanceNumber(row.monthly_leave_days, 1), 1)
    leaveStartDate.value = row.record_date || ''
    leaveEndDate.value = buildAttendanceEndDate(row.record_date, rangeDays)
    syncLeaveDateRange()
  } else if (row.record_type === 'leave') {
    const rangeDays = Math.max(toAttendanceNumber(row.leave_days, 1), 1)
    leaveStartDate.value = row.record_date || ''
    leaveEndDate.value = buildAttendanceEndDate(row.record_date, rangeDays)
    syncLeaveDateRange()
  } else {
    // 加班记录直接使用 formData.record_date，不需要同步 leaveDateRange
    leaveStartDate.value = ''
    leaveEndDate.value = ''
    leaveDateRange.value = null
  }
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
  default:
    return baseData
  }
}

const handleSubmit = async () => {
  if (submitting.value) return

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

      if (salaryTemplateBound.value !== true) {
        globalNotifications.warning('请先为员工绑定工资模板，再申请或登记休假、请假、加班')
        return
      }

      if ((formData.record_type === 'monthly_leave' || formData.record_type === 'leave') && (!leaveStartDate.value || !leaveEndDate.value)) {
        globalNotifications.warning('请选择开始日期和结束日期')
        submitting.value = false
        return
      }

      // 过滤提交数据，只包含相关字段
      const submitData = filterSubmitData(formData)

      if (formData.record_type === 'monthly_leave' && !formData.id) {
        const requestedDays = Number(formData.monthly_leave_days) || 0
        const requestRange = leaveDateRange.value
        await loadLeaveBalance(formData.employee_id, requestRange)
        const allocation = buildLeaveAllocation(requestedDays, requestRange)
        const availableDays = allocation.assignments.filter(item => item.type === 'monthly_leave').length

        if (allocation.regularLeaveDaysCount > 0) {
          await confirmAction(
            buildAttendanceSplitConfirmMessage(
              requestedDays,
              availableDays,
              allocation
            ),
            '休假天数提示',
            {
              confirmButtonText: '继续',
              cancelButtonText: '取消',
              type: 'warning'
            }
          )

        }
        await createSplitAttendanceRecords(submitData, allocation)
        globalNotifications.success(buildAttendanceSubmitSuccessMessage(
          allocation.monthlyLeaveDaysCount,
          allocation.regularLeaveDaysCount
        ))
      } else if (formData.id) {
        await attendanceApi.updateAttendanceRecord(formData.id, submitData)
        globalNotifications.success('更新成功')
      } else {
        await attendanceApi.createAttendanceRecord(submitData)
        globalNotifications.success('提交成功')
      }

      closeAttendanceDialog()
      await refreshActiveAttendanceData()
    } catch (error) {
      if (!isAttendanceDialogCancelled(error)) {
        globalNotifications.error(formData.id ? '更新失败' : '提交失败')
      }
    } finally {
      submitting.value = false
    }
  })
}

const handleApprove = async (row: AttendanceTableRow) => {
  if (!canApprove.value) {
    handleAttendanceNoPermission('approve')
    return
  }

  detailDialogVisible.value = false
  currentRecord.value = row
  approveForm.status = 'approved'
  approveForm.note = ''
  approveDialogVisible.value = true
}

const handleApproveSubmit = async () => {
  if (approving.value) return
  if (!canApprove.value) {
    handleAttendanceNoPermission('approve')
    return
  }

  const recordId = currentRecord.value?.id
  if (!recordId) return

  approving.value = true
  try {
    await attendanceApi.approveAttendanceRecord(
      recordId,
      approveForm.status,
      approveForm.note
    )
    globalNotifications.success(approveForm.status === 'approved' ? '审批通过' : '已拒绝')
    approveDialogVisible.value = false
    loadData()
  } catch (error) {
    logger.error('❌ 审批失败:', error)
    globalNotifications.error('审批失败')
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
    const startDate = TimeUtil.parse(value[0])
    const endDate = TimeUtil.parse(value[1])
    const diffDays = startDate?.isValid() && endDate?.isValid()
      ? Math.abs(endDate.diff(startDate, 'day')) + 1
      : 1

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

const buildAttendanceEndDate = (start_date: string, days: number) => {
  if (!start_date) return ''
  const safeDays = Math.max(Number(days) || 1, 1)
  const date = TimeUtil.parse(start_date)
  return date?.isValid()
    ? TimeUtil.format(date.add(safeDays - 1, 'day'), TIME_FORMATS.DATE)
    : ''
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
  void loadLeaveBalance(formData.employee_id, leaveDateRange.value)
}

const handleLeaveBoundaryChange = (boundary: 'start' | 'end', value: string | null) => {
  if (boundary === 'start') {
    leaveStartDate.value = value || ''
  } else {
    leaveEndDate.value = value || ''
  }
  syncLeaveDateRange()
}

const handleDelete = async (row: AttendanceTableRow) => {
  if (!canDelete.value) {
    handleAttendanceNoPermission('delete')
    return
  }
  const rowId = row.id
  if (!rowId) {
    globalNotifications.warning('考勤记录缺少有效ID')
    return
  }

  try {
    await confirmAction('确认删除该考勤记录？', '删除确认')
    await attendanceApi.deleteAttendanceRecord(rowId)
    globalNotifications.success('删除成功')
    detailDialogVisible.value = false
    await loadData()
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('❌ 删除失败:', error)
      globalNotifications.error('删除失败')
    }
  }
}

const handleCancel = async (row: AttendanceTableRow) => {
  if (!canCreateOwnAttendance.value) {
    myAttendancePermissions.handleNoPermission('create')
    return
  }
  const rowId = row.id
  if (!rowId) {
    globalNotifications.warning('考勤记录缺少有效ID')
    return
  }

  try {
    await confirmAction('确定要撤销此申请吗？', '提示', { type: 'warning' })
    await attendanceApi.cancelAttendanceRequest(rowId)
    globalNotifications.success('已撤销')
    detailDialogVisible.value = false
    loadMyData()
  } catch (error) {
    if (!isAttendanceDialogCancelled(error)) {
      logger.error('撤销申请失败:', error)
      globalNotifications.error('撤销失败')
    }
  }
}

// 获取原因文本 - 根据记录类型返回对应的 reason 字段
const getReasonText = (row: AttendanceTableRow) => {
  if (row.record_type === 'monthly_leave') {
    return `休假 ${formatAttendanceQuantity(row.monthly_leave_days)} 天`
  } else if (row.record_type === 'leave') {
    return formatAttendanceLeaveReason(row.leave_reason, row.leave_days)
  } else if (row.record_type === 'overtime') {
    return row.overtime_reason || '-'
  }
  return '-'
}

const handleView = (row: AttendanceTableRow) => {
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
  const rowId = row.id
  if (!rowId) return

  if (scope === 'all') {
    const shouldExpand = mobileExpandedAttendanceId.value !== rowId
    if (mobileExpandedAttendanceId.value && mobileExpandedAttendanceId.value !== rowId) {
      const previous = displayAttendanceRows.value.find(item => item.id === mobileExpandedAttendanceId.value)
      if (previous) {
        attendanceTableRef.value?.toggleRowExpansion(previous, false)
      }
    }
    attendanceTableRef.value?.toggleRowExpansion(row, shouldExpand)
    mobileExpandedAttendanceId.value = shouldExpand ? rowId : null
    return
  }

  const shouldExpand = mobileExpandedMyAttendanceId.value !== rowId
  if (mobileExpandedMyAttendanceId.value && mobileExpandedMyAttendanceId.value !== rowId) {
    const previous = displayMyAttendanceRows.value.find(item => item.id === mobileExpandedMyAttendanceId.value)
    if (previous) {
      myAttendanceTableRef.value?.toggleRowExpansion(previous, false)
    }
  }
  myAttendanceTableRef.value?.toggleRowExpansion(row, shouldExpand)
  mobileExpandedMyAttendanceId.value = shouldExpand ? rowId : null
}

const handleMobileRowTap = (row: AttendanceTableRow, scope: 'all' | 'my') => {
  if (!isMobile.value) return
  const rowId = row.id
  if (!rowId) return

  if (isDoubleTap(`${scope}:${rowId}`)) handleMobileRowDblClick(row, scope)
}

const clearMobileActions = () => {
  if (mobileExpandedAttendanceId.value) {
    const current = displayAttendanceRows.value.find(item => item.id === mobileExpandedAttendanceId.value)
    if (current) {
      attendanceTableRef.value?.toggleRowExpansion(current, false)
    }
  }
  if (mobileExpandedMyAttendanceId.value) {
    const current = displayMyAttendanceRows.value.find(item => item.id === mobileExpandedMyAttendanceId.value)
    if (current) {
      myAttendanceTableRef.value?.toggleRowExpansion(current, false)
    }
  }
  mobileExpandedAttendanceId.value = null
  mobileExpandedMyAttendanceId.value = null
  resetDoubleTap()
}

const handleTabChange = (tabName: TabPaneName) => {
  clearMobileActions()
  const normalizedTabName = String(tabName)
  if (normalizedTabName === 'all') {
    if (!canViewAllAttendance.value) return
    loadData()
  } else if (normalizedTabName === 'my') {
    if (!canViewOwnAttendance.value) return
    loadMyData()
  }
}

const refreshData = async () => {
  if (!canAccessPage.value) {
    return
  }

  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    unifiedApi.clearCache('/attendance')
    if (activeTab.value === 'all') {
      await loadData(false)
    } else if (activeTab.value === 'my') {
      await loadMyData(false)
    }
    success('数据刷新成功', { duration: 2000 })
  } catch (err) {
    error('刷新失败：请稍后重试')
  } finally {
    refreshing.value = false
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
    const response = await searchEmployees({ page: 1, page_size: 20 })
    if (response.data) {
      employees.value = sortOptionsByOrder((response.data.employees || []).map(item => ({
        id: Number(item.id || 0),
        name: String(item.name || item.username || ''),
        username: item.username ? String(item.username) : undefined,
        has_salary_template: item.has_salary_template === true,
        sort_order: Number(item.sort_order || 0)
      })))
    }
  } catch (error) {
    logger.error('加载员工列表失败:', error)
  }
}

const searchAttendanceEmployeesRemote = async (keyword = '') => {
  const selectedIds = new Set([
    filters.employee_id,
    formData.employee_id
  ].filter((id): id is number => typeof id === 'number'))
  const selectedEmployees = employees.value.filter(employee => selectedIds.has(Number(employee.id)))

  try {
    const response = await searchEmployees({
      keyword: keyword.trim() || undefined,
      page: 1,
      page_size: 20
    })
    const loadedEmployees = response.data?.employees || []
    const nextEmployees = loadedEmployees.map(item => ({
      id: Number(item.id || 0),
      name: String(item.name || item.username || ''),
      username: item.username ? String(item.username) : undefined,
      has_salary_template: item.has_salary_template === true,
      sort_order: item.sort_order
    }))
    employees.value = sortOptionsByOrder(
      [...nextEmployees, ...selectedEmployees.filter(selected => !nextEmployees.some(item => item.id === selected.id))]
    )
  } catch (error) {
    logger.error('远程加载员工失败:', error)
  }
}

watch(
  [canViewAllAttendance, canViewOwnAttendance],
  async ([canAll, canOwn], [prevCanAll, prevCanOwn]) => {
    if (!canAll && !canOwn) {
      return
    }

    syncVisibleAttendanceFilters()

    if (canAll && !prevCanAll) {
      activeTab.value = 'all'
      await Promise.all([loadData(), loadEmployees()])
      return
    }

    if (!canAll && canOwn && !prevCanOwn) {
      activeTab.value = 'my'
      await loadMyData()
    }
  }
)

onMounted(async () => {
  if (!canAccessPage.value) {
    loading.value = false
    myLoading.value = false
    return
  }

  await initFieldPermissions()
  syncVisibleAttendanceFilters()
  // 加载休假余额（所有用户都需要）
  await loadLeaveBalance()

  if (canViewAllAttendance.value) {
    activeTab.value = 'all'
    myLoading.value = false
    await loadData()
  } else if (canViewOwnAttendance.value) {
    activeTab.value = 'my'
    loading.value = false
    await loadMyData()
  }
  if (canViewAllAttendance.value) {
    await loadEmployees()
  }
})
</script>

<style scoped src="./styles/attendance-view/desktop.css"></style>
<style scoped src="./styles/attendance-view/responsive.css"></style>
