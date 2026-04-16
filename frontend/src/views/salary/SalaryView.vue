<template>
  <PermissionDenied
    v-if="!canAccessSalaryPage"
    :can-view="canAccessSalaryPage"
    module-key="salary"
    module-name="工资管理"
    permission-code="salary-templates:view / salary-records:view / salary-records:view:own"
  />

  <ElConfigProvider v-else :locale="locale">
    <div class="page-container salary-page admin-page">
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader icon="fas fa-money-bill-wave" title="工资管理">
        <template #actions>
          <el-button
            v-if="activeTab === 'templates' && canCreateSalaryTemplate"
            type="primary"
            @click="handleAddTemplate"
          >
            <i class="fas fa-plus"></i>
            <span>新增</span>
          </el-button>
          <el-button
            v-if="activeTab === 'payout' && canViewSalaryRecords"
            type="warning"
            @click="handleBulkRecalculatePayout"
            :disabled="payoutLoading"
          >
            <i class="fas fa-sync-alt"></i>
            <span>批量重算</span>
          </el-button>
          <el-button type="info" @click="handleRefresh" :disabled="refreshing">
            <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <!-- 页面主体 -->
      <div class="page-body admin-page-content">
        <!-- 统计卡片 -->
        <div v-if="showSalaryStatsCards" class="stats-cards">
          <div v-if="canViewSalaryField(salaryStatsModuleKey, 'stats_pending_salary')" class="stat-card">
            <div class="stat-icon success">
              <i class="fas fa-coins"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                <template v-if="canViewTeamSalaryRecords">¥{{ stats.pendingSalary || 0 }}</template>
                <template v-else>¥{{ stats.myPendingSalary || 0 }}</template>
              </div>
              <div class="stat-label">待发工资</div>
              <div class="stat-desc" v-if="canViewTeamSalaryRecords">{{ stats.pendingCount || 0 }} 人待发放</div>
            </div>
          </div>
          <div v-if="canViewSalaryField(salaryStatsModuleKey, 'stats_rest_summary')" class="stat-card">
            <div class="stat-icon warning">
              <i class="fas fa-umbrella-beach"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                <template v-if="canViewTeamSalaryRecords">{{ stats.pendingCount || 0 }} 人 / {{ stats.totalRestDays || 0 }} 天</template>
                <template v-else>{{ stats.myRestQuota || 0 }} / {{ stats.myRestDays || 0 }}</template>
              </div>
              <div class="stat-label">本月休假</div>
              <div class="stat-desc" v-if="canViewTeamSalaryRecords && stats.restEmployees.length">{{ stats.restEmployees.join('、') }}</div>
            </div>
          </div>
          <div v-if="canViewSalaryField(salaryStatsModuleKey, 'stats_leave_summary')" class="stat-card">
            <div class="stat-icon danger">
              <i class="fas fa-user-clock"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                <template v-if="canViewTeamSalaryRecords">{{ stats.pendingCount || 0 }} 人 / {{ stats.totalLeaveDays || 0 }} 天</template>
                <template v-else>{{ stats.myLeaveDays || 0 }} 天 / ¥{{ stats.myLeaveDeduction || 0 }}</template>
              </div>
              <div class="stat-label">本月请假</div>
              <div class="stat-desc" v-if="canViewTeamSalaryRecords && stats.leaveEmployees.length">{{ stats.leaveEmployees.join('、') }}</div>
            </div>
          </div>
          <div v-if="canViewSalaryField(salaryStatsModuleKey, 'stats_overtime_summary')" class="stat-card">
            <div class="stat-icon info">
              <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">
                <template v-if="canViewTeamSalaryRecords">{{ stats.pendingCount || 0 }} 人 / {{ stats.totalOvertimeHours || 0 }} 小时</template>
                <template v-else>{{ stats.myOvertimeHours || 0 }} 小时 / ¥{{ stats.myOvertimePay || 0 }}</template>
              </div>
              <div class="stat-label">本月加班</div>
              <div class="stat-desc" v-if="canViewTeamSalaryRecords && stats.overtimeEmployees.length">{{ stats.overtimeEmployees.join('、') }}</div>
            </div>
          </div>
        </div>

        <!-- TAB 切换 -->
        <el-tabs v-model="activeTab" class="salary-tabs" @tab-change="handleTabChange">
          <!-- 工资模板 -->
          <el-tab-pane label="工资模板" name="templates" v-if="canViewSalaryTemplates">
            <UnifiedSearchPanel
              v-model:expanded="templateSearchExpanded"
              :loading="templatesLoading"
              @search="loadTemplates"
              @reset="resetTemplateFilters"
            >
              <template #primary>
                <el-input
                  v-model="templateSearch"
                  placeholder="搜索模板名称"
                  clearable
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-file-invoice"></i>
                  </template>
                </el-input>
              </template>
              <template #actions>
                <el-button type="primary" size="small" @click="loadTemplates" :disabled="templatesLoading">
                  <i class="fas fa-search"></i>
                  搜索
                </el-button>
                <el-button type="default" size="small" @click="resetTemplateFilters">
                  <i class="fas fa-redo"></i>
                  重置
                </el-button>
              </template>

              <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_is_active')" class="form-group filter-item" data-field="is_active">
                <el-select v-model="templateFilters.is_active" placeholder="状态" clearable @change="loadTemplates">
                  <el-option label="已启用" :value="true" />
                  <el-option label="已禁用" :value="false" />
                </el-select>
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive">
                <el-table
                  ref="templateTableRef"
                  :data="filteredTemplates"
                  v-loading="templatesLoading"
                  border
                  stripe
                  row-key="id"
                  class="data-table salary-template-table"
                  @row-click="handleTemplateRowTap"
                >
                  <el-table-column v-if="isMobile" type="expand" width="1" class-name="mobile-expand-column">
                    <template #default="{ row }">
                      <div class="mobile-inline-actions">
                        <el-button
                          v-if="!row.is_default && canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          type="warning"
                          class="mobile-action-btn mobile-action-btn-default"
                          @click="handleSetDefault(row)"
                        >
                          <i class="fas fa-star"></i>
                          <span>默认</span>
                        </el-button>
                        <el-button
                          v-if="canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          :type="row.is_active ? 'warning' : 'success'"
                          class="mobile-action-btn mobile-action-btn-status"
                          @click="handleToggleTemplateStatus(row)"
                        >
                          <i :class="row.is_active ? 'fas fa-pause' : 'fas fa-play'"></i>
                          <span>{{ row.is_active ? '禁用' : '启用' }}</span>
                        </el-button>
                        <el-button
                          v-if="canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          type="primary"
                          class="mobile-action-btn mobile-action-btn-edit"
                          @click="handleEditTemplate(row)"
                        >
                          <i class="fas fa-edit"></i>
                          <span>编辑</span>
                        </el-button>
                        <el-button
                          v-if="canDeleteSalaryTemplate"
                          v-permission="'salary-templates:delete'"
                          size="small"
                          type="danger"
                          class="mobile-action-btn mobile-action-btn-delete"
                          @click="handleDeleteTemplate(row)"
                        >
                          <i class="fas fa-trash"></i>
                          <span>删除</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <!-- 序号列 -->
                  <el-table-column type="index" label="序号" width="70" align="center" class-name="index-col" />

                  <!-- 模板名称 -->
                  <el-table-column v-if="showTemplateNameColumn" prop="name" label="模板名称" min-width="140" align="left" class-name="name-col">
                    <template #default="{ row }">
                      <div class="template-name-cell whitespace-nowrap">
                        <span class="name-text">{{ row.name }}</span>
                        <el-tag v-if="canViewSalaryField('salary_salarytemplatesview', 'template_is_active') && !row.is_active" type="info" size="small" class="status-badge ml-2">已禁用</el-tag>
                      </div>
                    </template>
                  </el-table-column>

                  <!-- 说明 -->
                  <el-table-column v-if="showTemplateDescriptionColumn" prop="description" label="说明" min-width="200" align="left" show-overflow-tooltip class-name="hide-on-tablet" />

                  <!-- 底薪 -->
                  <el-table-column v-if="showTemplateBaseSalaryColumn" label="底薪" min-width="120" align="center" class-name="salary-col">
                    <template #default="{ row }">
                      <span class="whitespace-nowrap">¥{{ formatNumber(row.base_salary) }}</span>
                    </template>
                  </el-table-column>

                  <!-- 提成设置 -->
                  <el-table-column
                    v-if="showTemplateCommissionColumn"
                    label="提成设置"
                    min-width="280"
                    align="left"
                  >
                    <template #default="{ row }">
                      <div class="whitespace-nowrap flex items-center">
                        <el-tag :type="row.commission_type === 'fixed' ? 'success' : 'primary'" size="small" effect="plain">
                          {{ row.commission_type === 'fixed' ? '固定' : '利润' }}
                        </el-tag>
                        <template v-if="row.commission_type === 'fixed'">
                          <span class="ml-2">新机¥{{ formatNumber(row.commission_new_fixed || row.commission_fixed || 0) }}</span>
                          <span class="ml-2">二手¥{{ formatNumber(row.commission_used_fixed || 0) }}</span>
                        </template>
                        <template v-else>
                          <span class="ml-2">{{ row.commission_percentage }}%</span>
                        </template>
                      </div>
                    </template>
                  </el-table-column>

                  <!-- 考勤费率 -->
                  <el-table-column
                    v-if="showTemplateRateColumn"
                    label="考勤费率"
                    min-width="180"
                    align="center"
                    class-name="hide-on-mobile"
                  >
                    <template #default="{ row }">
                      <div class="whitespace-nowrap">
                        <span>加班¥{{ formatNumber(row.overtime_hourly_rate) }}/h</span>
                        <span class="ml-3">月休{{ row.rest_days || 0 }}天</span>
                      </div>
                    </template>
                  </el-table-column>

                  <!-- 使用人数 -->
                  <el-table-column v-if="showTemplateEmployeeCountColumn" label="使用人数" min-width="100" align="center">
                    <template #default="{ row }">
                      <span class="whitespace-nowrap">{{ getEmployeeCountByTemplate(row.id) }}人</span>
                    </template>
                  </el-table-column>

                  <!-- 操作 -->
                  <el-table-column v-if="showTemplateActionColumn" label="操作" width="280" align="center">
                    <template #default="{ row }">
                      <div class="template-action-buttons">
                        <!-- 设为默认按钮 -->
                        <el-button
                          v-if="!row.is_default && canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          type="warning"
                          plain
                          @click="handleSetDefault(row)"
                        >
                          <i class="fas fa-star"></i>
                          <span class="btn-text">默认</span>
                        </el-button>

                        <!-- 启用/禁用按钮 -->
                        <el-button
                          v-if="canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          :type="row.is_active ? 'warning' : 'success'"
                          plain
                          @click="handleToggleTemplateStatus(row)"
                        >
                          <i :class="row.is_active ? 'fas fa-pause' : 'fas fa-play'"></i>
                          <span class="btn-text">{{ row.is_active ? '禁用' : '启用' }}</span>
                        </el-button>

                        <!-- 编辑按钮 -->
                        <el-button
                          v-if="canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          type="primary"
                          plain
                          @click="handleEditTemplate(row)"
                        >
                          <i class="fas fa-edit"></i>
                          <span class="btn-text">编辑</span>
                        </el-button>

                        <!-- 删除按钮 -->
                        <el-button
                          v-if="canDeleteSalaryTemplate"
                          v-permission="'salary-templates:delete'"
                          size="small"
                          type="danger"
                          plain
                          @click="handleDeleteTemplate(row)"
                        >
                          <i class="fas fa-trash"></i>
                          <span class="btn-text">删除</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!templatesLoading && filteredTemplates.length === 0" class="empty-state">
                  <i class="fas fa-file-invoice"></i>
                  <p>暂无工资模板</p>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 员工工资 -->
          <el-tab-pane label="员工工资" name="employees" v-if="canViewSalaryRecords">
            <UnifiedSearchPanel
              v-model:expanded="employeeSearchExpanded"
              :loading="employeesLoading"
              @search="handleRefreshEmployeeData"
              @reset="resetEmployeeFilters"
            >
              <template #primary>
                <el-input
                  v-model="employeeSearch"
                  placeholder="搜索员工姓名或工号"
                  clearable
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-user"></i>
                  </template>
                </el-input>
              </template>
              <template #actions>
                <el-button type="primary" size="small" @click="handleRefreshEmployeeData" :disabled="employeesLoading">
                  <i class="fas fa-sync-alt"></i>
                  刷新
                </el-button>
                <el-button type="default" size="small" @click="resetEmployeeFilters">
                  <i class="fas fa-redo"></i>
                  重置
                </el-button>
              </template>

              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'period_start')" class="form-group filter-item" data-field="month">
                <el-date-picker
                  v-model="employeeSalaryMonth"
                  type="month"
                  placeholder="选择月份"
                  value-format="YYYY-MM"
                  @change="handleEmployeeMonthChange"
                />
              </div>

              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_template_name')" class="form-group filter-item" data-field="template">
                <el-select v-model="employeeTemplateFilter" placeholder="工资模板" clearable>
                  <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name" :value="tpl.id" />
                </el-select>
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive">
                <el-table
                  v-if="isMobile"
                  ref="employeeTableRef"
                  :data="filteredEmployees"
                  v-loading="employeesLoading"
                  border
                  stripe
                  row-key="id"
                  class="data-table salary-employee-table"
                  @row-click="handleEmployeeRowTap"
                >
                  <el-table-column type="expand" width="1" class-name="mobile-expand-column">
                    <template #default="{ row }">
                      <div class="mobile-inline-actions">
                        <el-button
                          v-if="canEditSalaryTemplate"
                          v-permission="'salary-templates:edit'"
                          size="small"
                          type="primary"
                          class="mobile-action-btn mobile-action-btn-edit"
                          @click="handleEditEmployeeTemplate(row)"
                        >
                          <i class="fas fa-file-invoice-dollar"></i>
                          <span>模板</span>
                        </el-button>
                        <el-button
                          v-if="canViewSalaryRecords"
                          v-permission="'salary-records:view'"
                          size="small"
                          type="success"
                          class="mobile-action-btn mobile-action-btn-status"
                          @click="handleViewAttendance(row)"
                        >
                          <i class="fas fa-calendar-check"></i>
                          <span>考勤</span>
                        </el-button>
                        <el-button
                          size="small"
                          type="warning"
                          class="mobile-action-btn mobile-action-btn-default"
                          @click="handleViewEmployeeSalesDetail(row)"
                        >
                          <i class="fas fa-chart-line"></i>
                          <span>销售</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')"
                    label="姓名"
                    min-width="92"
                    align="left"
                    class-name="employee-name-col"
                  >
                    <template #default="{ row }">
                      <span class="employee-name-text">{{ row.name || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')"
                    label="提成"
                    min-width="74"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-commission">{{ formatNumber(calculateSalesCommission(row.id)) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay')"
                    label="加班"
                    min-width="70"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-overtime">{{ formatNumber(calculateOvertimePay(row.id, getEmployeeAttendanceStats(row.id).overtime_hours)) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_deduction')"
                    label="请假扣款"
                    min-width="82"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-deduction">
                        {{ formatNumber(calculateLeaveDeduction(row.id, getEmployeeAttendanceStats(row.id).leave_days)) }}
                      </span>
                    </template>
                  </el-table-column>
                </el-table>

                <el-table v-else :data="filteredEmployees" v-loading="employeesLoading" border stripe class="data-table">
                  <el-table-column label="序号" min-width="60" align="center">
                    <template #default="{ $index }">
                      {{ $index + 1 }}
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_username')" label="员工工号" min-width="100" align="center">
                    <template #default="{ row }">
                      <span>{{ row.username }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" label="员工姓名" min-width="100" align="center">
                    <template #default="{ row }">
                      <span>{{ row.name }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_phone')" prop="phone" label="联系电话" min-width="115" align="center" />
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_template_name')" label="工资模板" min-width="160" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.salary_template_id" type="success" size="large">
                        <i class="fas fa-file-invoice-dollar"></i>
                        {{ getTemplateName(row.salary_template_id) }}
                      </el-tag>
                      <el-tag v-else type="info" size="large">
                        <i class="fas fa-exclamation-circle"></i>
                        未设置
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'base_salary')" label="底薪" min-width="90" align="center">
                    <template #default="{ row }">
                      <span class="amount-text">¥{{ getEmployeeBaseSalary(row.id) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_template_name') || canViewSalaryField('salary_salaryrecordsview', 'commission_amount')"
                    label="提成方式"
                    min-width="160"
                    align="center"
                  >
                    <template #default="{ row }">
                      <div v-if="row.salary_template_id" class="commission-info">
                        <div v-if="getTemplateCommissionType(row.salary_template_id) === 'fixed'">
                          <div class="commission-row">
                            <span class="commission-label">新机:</span>
                            <span class="commission-value">¥{{ getTemplateCommissionNewFixed(row.salary_template_id) }}/台</span>
                          </div>
                          <div class="commission-row">
                            <span class="commission-label">二手:</span>
                            <span class="commission-value">¥{{ getTemplateCommissionUsedFixed(row.salary_template_id) }}/台</span>
                          </div>
                        </div>
                        <div v-else>
                          <span class="commission-label">利润:</span>
                          <span class="commission-value">{{ getTemplateCommissionPercentage(row.salary_template_id) }}%</span>
                        </div>
                      </div>
                      <span v-else class="text-muted">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" label="销售数量" min-width="90" align="center">
                    <template #default="{ row }">
                      <span
                        v-if="getEmployeeCommissionCount(row.id) > 0"
                        class="text-blue font-semibold cursor-pointer"
                        @dblclick="handleViewEmployeeSalesDetail(row)"
                      >
                        {{ getEmployeeCommissionCount(row.id) }}台
                      </span>
                      <span v-else class="text-secondary">0台</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" label="销售提成" min-width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeSalesStats(row.id).sales_count > 0" class="text-danger font-semibold">
                        ¥{{ calculateSalesCommission(row.id) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay') || canViewSalaryField('salary_salaryrecordsview', 'leave_deduction')"
                    label="费率"
                    min-width="140"
                    align="center"
                  >
                    <template #default="{ row }">
                      <div v-if="row.salary_template_id" class="rate-info">
                        <div><span class="rate-label">加班:</span> ¥{{ getTemplateOvertimeRate(row.salary_template_id) }}/h</div>
                        <div><span class="rate-label">请假:</span> 扣平均工资/天</div>
                      </div>
                      <span v-else class="text-muted">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'monthly_leave_days')" label="休假(天)" min-width="105" align="center">
                    <template #default="{ row }">
                      <div v-if="getEmployeeAttendanceStats(row.id).monthly_leave_days_available > 0" class="attendance-cell">
                        <span class="leave-days-display">
                          <span class="used-days text-danger font-semibold">{{ getEmployeeAttendanceStats(row.id).monthly_leave_days_used || 0 }}</span>
                          <span class="text-secondary">/</span>
                          <span class="total-days text-success font-semibold">{{ getEmployeeAttendanceStats(row.id).monthly_leave_days_available }}</span>
                        </span>
                      </div>
                      <span v-else class="text-secondary">0/0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_days')" label="请假(天)" min-width="90" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="getEmployeeAttendanceStats(row.id).leave_days > 0" type="warning" size="small">
                        {{ getEmployeeAttendanceStats(row.id).leave_days }}天
                      </el-tag>
                      <el-tag v-else type="info" size="small">0</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_deduction')" label="请假扣款" min-width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).leave_days > 0" class="text-danger font-semibold">
                        -¥{{ calculateLeaveDeduction(row.id, getEmployeeAttendanceStats(row.id).leave_days) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_hours')" label="加班时间" min-width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).overtime_hours > 0" class="text-blue font-semibold">
                        {{ Math.round(getEmployeeAttendanceStats(row.id).overtime_hours) }}小时
                      </span>
                      <span v-else class="text-secondary">0小时</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay')" label="加班费" min-width="90" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).overtime_hours > 0" class="text-danger font-semibold">
                        ¥{{ calculateOvertimePay(row.id, getEmployeeAttendanceStats(row.id).overtime_hours) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')" label="预计工资" min-width="110" align="center">
                    <template #default="{ row }">
                      <span class="estimated-salary">¥{{ calculateEstimatedSalary(row.id) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'actions')" label="操作" width="228" fixed="right" align="center" class-name="employee-action-column">
                    <template #default="{ row }">
                      <div class="employee-action-buttons">
                        <!-- 设置模板按钮 -->
                        <span v-if="canEditSalaryTemplate" class="employee-action-item">
                          <el-button
                            v-permission="'salary-templates:edit'"
                            size="small"
                            type="primary"
                            plain
                            @click="handleEditEmployeeTemplate(row)"
                          >
                            <i class="fas fa-file-invoice-dollar"></i>
                            <span class="btn-text">模板</span>
                          </el-button>
                        </span>

                        <!-- 考勤记录按钮 -->
                        <span v-if="canViewSalaryRecords" class="employee-action-item">
                          <el-button
                            v-permission="'salary-records:view'"
                            size="small"
                            type="success"
                            plain
                            @click="handleViewAttendance(row)"
                          >
                            <i class="fas fa-calendar-check"></i>
                            <span class="btn-text">考勤</span>
                          </el-button>
                        </span>

                        <!-- 销售明细按钮 -->
                        <span class="employee-action-item">
                          <el-button
                            size="small"
                            type="warning"
                            plain
                            @click="handleViewEmployeeSalesDetail(row)"
                          >
                            <i class="fas fa-chart-line"></i>
                            <span class="btn-text">销售</span>
                          </el-button>
                        </span>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!employeesLoading && filteredEmployees.length === 0" class="empty-state">
                  <i class="fas fa-users"></i>
                  <p>暂无员工数据</p>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 工资计算 -->
          <el-tab-pane label="工资计算" name="payout" v-if="canViewSalaryRecords">
            <UnifiedSearchPanel
              v-model:expanded="payoutSearchExpanded"
              :loading="payoutLoading"
              @search="loadPayoutList"
              @reset="resetPayoutFilters"
            >
              <template #primary>
                <el-input
                  v-model="payoutSearch"
                  placeholder="搜索员工姓名或工号"
                  clearable
                  @click.stop
                >
                  <template #prefix>
                    <i class="fas fa-user"></i>
                  </template>
                </el-input>
              </template>
              <template #actions>
                <el-button type="primary" size="small" @click="loadPayoutList" :disabled="payoutLoading">
                  <i class="fas fa-search"></i>
                  搜索
                </el-button>
                <el-button type="default" size="small" @click="resetPayoutFilters">
                  <i class="fas fa-redo"></i>
                  重置
                </el-button>
              </template>

              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'period_start')" class="form-group filter-item" data-field="month">
                <el-date-picker
                  v-model="payoutMonth"
                  type="month"
                  placeholder="选择月份"
                  value-format="YYYY-MM"
                  @change="handleMonthChange"
                />
              </div>

              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_status')" class="form-group filter-item" data-field="status">
                <el-select v-model="payoutFilters.status" placeholder="状态" clearable @change="handleFilterChange">
                  <el-option label="未结算" value="unpaid" />
                  <el-option label="已结算" value="paid" />
                </el-select>
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive">
                <el-table
                  v-if="isMobile"
                  ref="payoutTableRef"
                  :data="salaryPayoutData"
                  v-loading="payoutLoading"
                  border
                  stripe
                  row-key="id"
                  class="data-table salary-payout-table"
                  @row-click="handlePayoutRowTap"
                >
                  <el-table-column type="expand" width="1" class-name="mobile-expand-column">
                    <template #default="{ row }">
                      <div class="mobile-inline-actions">
                        <el-button
                          v-if="canCreateSalaryRecord"
                          v-permission="'salary-records:create'"
                          size="small"
                          :type="row.payoutRecord ? 'warning' : 'primary'"
                          class="mobile-action-btn mobile-action-btn-default"
                          @click="!row.payoutRecord ? handlePayoutByEmployee(row) : handleRecalculatePayout(row)"
                        >
                          <span>{{ row.payoutRecord ? '重算' : '结算' }}</span>
                        </el-button>
                        <el-button
                          v-if="row.payoutRecord && canEditSalaryRecord"
                          v-permission="'salary-records:edit'"
                          size="small"
                          type="success"
                          class="mobile-action-btn mobile-action-btn-status"
                          @click="handleEditPayoutByEmployee(row)"
                        >
                          <span>编辑</span>
                        </el-button>
                        <el-button
                          v-if="row.payoutRecord && canDeleteSalaryRecord"
                          v-permission="'salary-records:delete'"
                          size="small"
                          type="danger"
                          class="mobile-action-btn mobile-action-btn-delete"
                          @click="handleDeletePayout(row)"
                        >
                          <span>删除</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')"
                    label="姓名"
                    min-width="92"
                    align="left"
                    class-name="employee-name-col"
                  >
                    <template #default="{ row }">
                      <span class="employee-name-text">{{ row.name || '-' }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')"
                    label="提成"
                    min-width="74"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-commission">{{ formatNumber(calculateSalesCommission(row.id)) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay')"
                    label="加班"
                    min-width="70"
                    align="center"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-overtime">{{ formatNumber(calculateOvertimePay(row.id, getEmployeeAttendanceStats(row.id).overtime_hours)) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')"
                    label="预计工资"
                    min-width="82"
                    align="right"
                  >
                    <template #default="{ row }">
                      <span class="mobile-salary-value is-estimated">{{ formatNumber(calculateEstimatedSalary(row.id)) }}</span>
                    </template>
                  </el-table-column>
                </el-table>

                <el-table
                  v-else
                  :data="salaryPayoutData"
                  v-loading="payoutLoading"
                  border
                  stripe
                  class="data-table"
                >
                  <el-table-column label="序号" min-width="50" align="center">
                    <template #default="{ $index }">
                      {{ $index + 1 }}
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_username')" label="员工工号" min-width="90" align="center">
                    <template #default="{ row }">
                      <span>{{ row.username }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" label="员工姓名" min-width="90" align="center">
                    <template #default="{ row }">
                      <span>{{ row.name }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'base_salary')" label="底薪" min-width="80" align="center">
                    <template #default="{ row }">
                      <span class="amount-text">¥{{ getEmployeeBaseSalary(row.id) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" label="数量" min-width="70" align="center">
                    <template #default="{ row }">
                      <span class="text-regular font-semibold">{{ getEmployeeSalesStats(row.id).sales_count }}台</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" label="提成" min-width="90" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeSalesStats(row.id).sales_count > 0" class="text-danger font-semibold">
                        ¥{{ calculateSalesCommission(row.id) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'actual_work_days')" label="工作天数" min-width="85" align="center">
                    <template #default="{ row }">
                      <span class="text-success font-semibold">{{ calculateWorkDays(row.id) }}天</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'monthly_leave_days')" label="休假" min-width="80" align="center">
                    <template #default="{ row }">
                      <span class="text-success">
                        {{ getEmployeeAttendanceStats(row.id).monthly_leave_days_used || 0 }}/{{ getEmployeeAttendanceStats(row.id).monthly_leave_days_available || 0 }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_days')" label="请假" min-width="70" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).leave_days > 0" class="text-danger font-semibold">
                        {{ getEmployeeAttendanceStats(row.id).leave_days }}天
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_deduction')" label="请假扣款" min-width="90" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).leave_days > 0" class="text-danger font-semibold">
                        -¥{{ calculateLeaveDeduction(row.id, getEmployeeAttendanceStats(row.id).leave_days) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_hours')" label="加班" min-width="80" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).overtime_hours > 0" class="text-blue font-semibold">
                        {{ Math.round(getEmployeeAttendanceStats(row.id).overtime_hours) }}小时
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay')" label="加班费" min-width="90" align="center">
                    <template #default="{ row }">
                      <span v-if="getEmployeeAttendanceStats(row.id).overtime_hours > 0" class="text-blue font-semibold">
                        ¥{{ calculateOvertimePay(row.id, getEmployeeAttendanceStats(row.id).overtime_hours) }}
                      </span>
                      <span v-else class="text-secondary">0</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')" label="应发工资" min-width="100" align="center">
                    <template #default="{ row }">
                      <span class="net-salary-large text-base font-semibold text-blue">
                        ¥{{ calculateEstimatedSalary(row.id) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')" label="已发工资" min-width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="row.payoutRecord" class="net-salary-large text-base font-semibold text-success">
                        ¥{{ Number(row.payoutRecord.net_salary || 0).toFixed(2) }}
                      </span>
                      <span v-else class="text-secondary">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_status')" label="状态" min-width="85" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.payoutRecord" type="success" size="small">已结算</el-tag>
                      <el-tag v-else type="info" size="small">未结算</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'paid_at')" label="结算时间" min-width="95" align="center">
                    <template #default="{ row }">
                      <span v-if="row.payoutRecord?.status === 'paid' && row.payoutRecord?.paid_at" class="text-regular">
                        {{ formatPayoutTime(row.payoutRecord.paid_at) }}
                      </span>
                      <span v-else class="text-secondary">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'payment_method')" label="支付方式" min-width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="row.payoutRecord?.payment_method" class="text-regular">
                        {{ getPaymentMethodName(row.payoutRecord.payment_method) }}
                      </span>
                      <span v-else class="text-secondary">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'actions')" label="操作" width="220" fixed="right" align="center">
                    <template #default="{ row }">
                      <div class="payout-action-buttons">
                        <!-- 结算/重新计算按钮 -->
                        <el-button
                          v-if="canCreateSalaryRecord"
                          v-permission="'salary-records:create'"
                          size="small"
                          :type="row.payoutRecord ? 'warning' : 'primary'"
                          plain
                          @click="!row.payoutRecord ? handlePayoutByEmployee(row) : handleRecalculatePayout(row)"
                        >
                          {{ row.payoutRecord ? '重算' : '结算' }}
                        </el-button>

                        <!-- 编辑按钮 -->
                        <el-button
                          v-if="row.payoutRecord && canEditSalaryRecord"
                          v-permission="'salary-records:edit'"
                          size="small"
                          type="success"
                          plain
                          @click="handleEditPayoutByEmployee(row)"
                        >
                          编辑
                        </el-button>

                        <!-- 删除按钮 -->
                        <el-button
                          v-if="row.payoutRecord && canDeleteSalaryRecord"
                          v-permission="'salary-records:delete'"
                          size="small"
                          type="danger"
                          plain
                          @click="handleDeletePayout(row)"
                        >
                          删除
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!payoutLoading && salaryPayoutData.length === 0" class="empty-state">
                  <i class="fas fa-money-bill-wave"></i>
                  <p>暂无工资数据</p>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 工资发放 -->
          <el-tab-pane label="工资发放" name="my" v-if="canViewPayoutRecords">
            <UnifiedSearchPanel
              v-model:expanded="recordsSearchExpanded"
              :loading="myLoading"
              @search="loadMyRecords"
              @reset="resetMyFilters"
            >
              <template #primary>
                <el-input
                  :placeholder="canViewTeamSalaryRecords && selectedViewEmployeeId ? `${getSelectedEmployeeName()}的工资发放记录` : '工资发放记录'"
                  disabled
                  class="cursor-default"
                >
                  <template #prefix>
                    <i class="fas fa-money-bill-wave"></i>
                  </template>
                </el-input>
              </template>

              <div class="form-group filter-item" v-if="canViewTeamSalaryRecords && canViewSalaryField('salary_mysalaryview', 'employee_name')">
                <el-select
                  v-model="selectedViewEmployeeId"
                  placeholder="选择员工查看工资"
                  filterable
                  clearable
                  @change="handleViewEmployeeChange"
                >
                  <el-option
                    v-for="emp in employees"
                    :key="emp.id"
                    :label="emp.name || emp.username"
                    :value="emp.id"
                  >
                    <span class="float-left">{{ emp.name || emp.username }}</span>
                    <span class="float-right text-secondary text-xs">{{ emp.username }}</span>
                  </el-option>
                </el-select>
              </div>

              <div v-if="canViewSalaryField('salary_mysalaryview', 'period_start')" class="form-group filter-item" data-field="period">
                <el-date-picker
                  v-model="myPeriodRange"
                  type="monthrange"
                  range-separator="至"
                  start-placeholder="开始月份"
                  end-placeholder="结束月份"
                  value-format="YYYY-MM"
                  @change="handleMyPeriodChange"
                />
              </div>
            </UnifiedSearchPanel>

            <!-- 数据表格 -->
            <div class="table-section admin-panel admin-table-panel">
              <div class="table-responsive my-salary-table">
                <el-table :data="myRecords" v-loading="myLoading" border stripe class="data-table">
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'paid_at')" label="发放时间" min-width="100" align="center">
                    <template #default="{ row }">
                      <span class="period-text">{{ formatPayoutTime(row.paid_at) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewTeamSalaryRecords && canViewSalaryField('salary_mysalaryview', 'employee_name')" label="员工姓名" min-width="100" align="center">
                    <template #default="{ row }">
                      <span class="text-regular font-medium">
                        {{ row.employee_name || getEmployeeName(row.employee_id) || '-' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'period_start')" label="月份工资" min-width="95" align="center">
                    <template #default="{ row }">
                      <span class="period-text">{{ formatSalaryMonth(row.period_start) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'payment_method')" label="支付方式" min-width="95" align="center">
                    <template #default="{ row }">
                      <span v-if="row.payment_method" class="text-regular">
                        {{ getPaymentMethodName(row.payment_method) }}
                      </span>
                      <span v-else class="text-secondary">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'actual_work_days')" label="工作天数" min-width="85" align="center">
                    <template #default="{ row }">
                      <span class="work-days">
                        {{ formatWorkDays(row.actual_work_days) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'base_salary')" label="底薪" min-width="85" align="center">
                    <template #default="{ row }">
                      <span class="amount-text">¥{{ row.base_salary }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" label="销售数量" min-width="85" align="center">
                    <template #default="{ row }">
                      <span class="text-regular font-semibold">{{ getSalesCount(row) }}台</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" label="销售明细" min-width="90" align="center">
                    <template #default="{ row }">
                      <el-button
                        v-if="getSalesCount(row) > 0"
                        size="small"
                        type="primary"
                        plain
                        @click="handleViewSalesDetail(row)"
                      >
                        <i class="fas fa-list"></i>
                        <span class="btn-text">明细</span>
                      </el-button>
                      <span v-else class="text-secondary">-</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" label="提成金额" min-width="95" align="center">
                    <template #default="{ row }">
                      <span class="text-danger font-semibold">¥{{ formatAmount(row.commission_amount) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'overtime_hours')" label="加班时间" min-width="90" align="center">
                    <template #default="{ row }">
                      <span class="text-secondary">{{ formatOvertimeHours(row.overtime_hours) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'overtime_pay')" label="加班费" min-width="85" align="center">
                    <template #default="{ row }">
                      <span class="text-blue font-semibold">¥{{ formatAmount(row.overtime_pay) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'leave_days')" label="请假天数" min-width="90" align="center">
                    <template #default="{ row }">
                      <span class="text-warning font-semibold">{{ formatLeaveDays(row.leave_days) }}天</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'leave_deduction')" label="请假扣除" min-width="95" align="center">
                    <template #default="{ row }">
                      <span class="text-danger">-¥{{ formatAmount(row.leave_deduction) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'net_salary')" label="实发工资" min-width="110" align="center">
                    <template #default="{ row }">
                      <span class="net-salary">¥{{ formatAmount(row.net_salary) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column v-if="canViewSalaryField('salary_mysalaryview', 'actions')" label="操作" min-width="110" align="center">
                    <template #default="{ row }">
                      <div class="my-salary-action-buttons">
                        <el-button
                          size="small"
                          type="primary"
                          plain
                          @click="handleViewMyRecord(row)"
                        >
                          <i class="fas fa-eye"></i>
                          <span class="btn-text">详情</span>
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <!-- 空状态 -->
                <div v-if="!myLoading && myRecords.length === 0" class="empty-state">
                  <i class="fas fa-file-invoice-dollar"></i>
                  <p>暂无工资记录</p>
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

      <!-- 工资详情对话框 -->
      <MobileDialog
        v-model="detailDialogVisible"
        title="工资详情"
        width="720px"
        dialog-class="salary-dialog"
        :show-default-footer="false"
      >
        <div v-if="currentRecord" class="detail-view">
          <div class="detail-section detail-section-grid">
            <h4>基本信息</h4>
            <div class="detail-grid">
              <div v-if="canViewSalaryField('salary_mysalaryview', 'employee_name')" class="detail-row">
                <span class="label">员工</span>
                <span class="value">{{ currentRecord.employee_name || getEmployeeName(currentRecord.employee_id) }}</span>
              </div>
              <div v-if="canViewSalaryField('salary_mysalaryview', 'period_start')" class="detail-row">
                <span class="label">月份</span>
                <span class="value">{{ formatSalaryMonth(currentRecord.period_start) }}</span>
              </div>
              <div v-if="canViewSalaryField('salary_mysalaryview', 'actual_work_days')" class="detail-row">
                <span class="label">工作天数</span>
                <span class="value">{{ formatWorkDays(currentRecord.actual_work_days) }}</span>
              </div>
              <div v-if="canViewSalaryField('salary_mysalaryview', 'salary_status')" class="detail-row">
                <span class="label">状态</span>
                <span class="value">
                  <span v-if="currentRecord.status === 'approved'" class="tag tag-primary">待发放</span>
                  <span v-else-if="currentRecord.status === 'paid'" class="tag tag-success">已发放</span>
                </span>
              </div>
            </div>
          </div>
          <div class="detail-section">
            <h4>工资明细</h4>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'base_salary')" class="detail-row">
              <span class="label">底薪：</span>
              <span class="value">¥{{ currentRecord.base_salary }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" class="detail-row">
              <span class="label">销售提成：</span>
              <span class="value">数量：{{ currentRecord.sales_count }} 台，金额：¥{{ currentRecord.commission_amount }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'overtime_pay')" class="detail-row">
              <span class="label">加班费：</span>
              <span class="value">时长：{{ currentRecord.overtime_hours }} 小时，金额：¥{{ currentRecord.overtime_pay }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'leave_deduction')" class="detail-row">
              <span class="label">请假扣除：</span>
              <span class="value">天数：{{ formatLeaveDays(currentRecord.leave_days) }} 天，金额：¥{{ currentRecord.leave_deduction }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'net_salary')" class="detail-row highlight">
              <span class="label">应发工资：</span>
              <span class="value net-salary-large">¥{{ currentRecord.net_salary }}</span>
            </div>
          </div>
          <div v-if="currentRecord.calculation_note" class="detail-section">
            <h4>计算说明</h4>
            <div class="detail-row full">
              <span class="value">{{ currentRecord.calculation_note }}</span>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button type="info" @click="detailDialogVisible = false">
            <i class="fas fa-times"></i>
            关闭
          </el-button>
        </template>
      </MobileDialog>

      <!-- 销售明细对话框 -->
      <MobileDialog
        v-model="salesDetailDialogVisible"
        title="销售明细"
        width="900px"
        dialog-class="salary-dialog salary-dialog-large"
        :show-default-footer="false"
      >
        <div v-if="currentSalesRecord" class="sales-details" v-loading="salesDetailLoading">
          <!-- 汇总信息 -->
          <div class="details-info">
            <div v-if="canViewSalaryField('salary_mysalaryview', 'paid_at')" class="info-row">
              <label>发放时间:</label>
              <span>{{ formatPayoutTime(currentSalesRecord.paid_at) }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" class="info-row">
              <label>销售数量:</label>
              <span class="highlight">{{ getSalesCount(currentSalesRecord) }} 台</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" class="info-row">
              <label>提成金额:</label>
              <span class="amount">¥{{ currentSalesRecord.commission_amount }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" class="info-row">
              <label>销售额:</label>
              <span class="amount">¥{{ formatAmount(salesSummary.total_price) }}</span>
            </div>
          </div>

          <!-- 销售明细表格 -->
          <div class="sales-details-table">
            <h4 class="section-title">销售明细列表</h4>
            <div v-if="salesDetailList.length > 0" class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th width="60">序号</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" width="120">型号</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" width="100">颜色</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')" width="200">IMEI</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'employee_name')" width="150">客户</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" width="120">销售价格</th>
                    <th v-if="canViewSalaryField('salary_mysalaryview', 'paid_at')">销售时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in salesDetailList" :key="index">
                    <td>
                      <span class="index-badge">{{ index + 1 }}</span>
                    </td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')">{{ item.model_name || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')">{{ item.color_name || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'sales_count')">
                      <span class="imei">{{ item.imei }}</span>
                    </td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'employee_name')">{{ item.customer_name || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'commission_amount')" class="price">¥{{ item.sale_price }}</td>
                    <td v-if="canViewSalaryField('salary_mysalaryview', 'paid_at')" class="time-cell">{{ formatSaleTime(item.sale_time) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">
              <i class="fas fa-box-open"></i>
              <p>暂无销售明细数据</p>
            </div>
          </div>
        </div>

        <template #footer>
          <el-button type="default" @click="salesDetailDialogVisible = false">关闭</el-button>
        </template>
      </MobileDialog>

      <!-- 员工销售明细对话框 -->
      <MobileDialog
        v-model="employeeSalesDetailDialogVisible"
        title="员工销售明细"
        width="1100px"
        dialog-class="salary-dialog salary-dialog-large"
        :show-default-footer="false"
      >
        <div v-if="currentEmployeeSales" class="sales-details">
          <!-- 汇总信息 -->
          <div class="details-info">
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" class="info-row">
              <label>员工姓名:</label>
              <span>{{ currentEmployeeSales.name }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'period_start')" class="info-row">
              <label>月份:</label>
              <span>{{ employeeSalaryMonth }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" class="info-row">
              <label>销售数量:</label>
              <span class="highlight">{{ employeeSalesSummary.total_count }} 台</span>
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" class="info-row">
              <label>销售额:</label>
              <span class="amount">¥{{ formatAmount(employeeSalesSummary.total_sales) }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" class="info-row">
              <label>总利润:</label>
              <span class="profit">¥{{ formatAmount(employeeSalesSummary.total_profit) }}</span>
            </div>
          </div>

          <!-- 销售明细表格 -->
          <div v-loading="employeeSalesDetailLoading" class="sales-details-table">
            <h4 class="section-title">销售明细列表</h4>
            <div v-if="employeeSalesDetailList.length > 0" class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th width="60">序号</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" width="80">机型</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" width="120">型号</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" width="100">颜色</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')" width="200">IMEI</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" width="150">客户</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" width="120">销售价</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" width="120">利润</th>
                    <th v-if="canViewSalaryField('salary_salaryrecordsview', 'paid_at')">销售时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, index) in employeeSalesDetailList" :key="index">
                    <td>
                      <span class="index-badge">{{ index + 1 }}</span>
                    </td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')">
                      <el-tag :type="item.is_new ? 'success' : 'warning'" size="small">
                        {{ item.is_new ? '全新' : '二手' }}
                      </el-tag>
                    </td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')">{{ item.model || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')">{{ item.color || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'sales_count')">
                      <span class="imei">{{ item.imei }}</span>
                    </td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')">{{ item.customer_name || '-' }}</td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" class="text-danger">¥{{ formatAmount(item.sale_price) }}</td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" :style="item.profit >= 0 ? 'color: #67c23a' : 'color: #f56c6c'">
                      ¥{{ formatAmount(item.profit) }}
                    </td>
                    <td v-if="canViewSalaryField('salary_salaryrecordsview', 'paid_at')" class="time-cell">{{ formatSaleTime(item.salestime) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="empty-state">
              <i class="fas fa-box-open"></i>
              <p>暂无销售明细数据</p>
            </div>
          </div>
        </div>

        <template #footer>
          <el-button type="default" @click="employeeSalesDetailDialogVisible = false">关闭</el-button>
        </template>
      </MobileDialog>

      <!-- 编辑工资记录对话框 -->
      <MobileDialog
        v-model="editPayoutDialogVisible"
        title="编辑工资记录"
        width="960px"
        dialog-class="salary-dialog salary-dialog-large"
        :show-default-footer="false"
      >
        <form id="edit-payout-form" @submit.prevent="handleSaveEditPayout">
          <div class="form-section">
            <h4>员工信息</h4>
            <div class="form-row">
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" class="form-group">
                <label>员工</label>
                <input
                  :value="getEmployeeName(editPayoutForm.employee_id)"
                  type="text"
                  class="form-control"
                  disabled
                />
              </div>
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'base_salary')" class="form-group">
                <label>底薪</label>
                <input
                  v-model.number="editPayoutForm.base_salary"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'base_salary')"
                />
              </div>
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'commission_amount')" class="form-group">
                <label>销售提成</label>
                <input
                  v-model.number="editPayoutForm.commission_amount"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'commission_amount')"
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>调整项</h4>
            <div class="form-row">
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_pay')" class="form-group">
                <label>加班费</label>
                <input
                  v-model.number="editPayoutForm.overtime_pay"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'overtime_pay')"
                />
              </div>
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_deduction')" class="form-group">
                <label>请假扣除</label>
                <input
                  v-model.number="editPayoutForm.leave_deduction"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'leave_deduction')"
                />
              </div>
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')" class="form-group">
                <label>应发工资</label>
                <input
                  :value="`¥${calculateEditNetSalary()}`"
                  type="text"
                  class="form-control text-blue font-semibold"
                />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h4>结算信息</h4>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_status')" class="form-group">
              <label>结算状态</label>
              <select v-model="editPayoutForm.status" class="form-control" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'salary_status')">
                <option value="approved">未结算</option>
                <option value="paid">已结算</option>
              </select>
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'paid_at') && editPayoutForm.status === 'paid'" class="form-group">
              <label>结算时间</label>
              <input
                v-model="editPayoutForm.paid_at"
                type="date"
                class="form-control"
                :disabled="!canEditSalaryField('salary_salaryrecordsview', 'paid_at')"
              />
            </div>
            <div v-if="canViewSalaryField('salary_salaryrecordsview', 'payment_method') && editPayoutForm.status === 'paid'" class="form-group">
              <label>支付方式</label>
              <select v-model="editPayoutForm.payment_method" class="form-control" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'payment_method')">
                <option value="">请选择支付方式</option>
                <option value="cash">现金</option>
                <option value="bank_transfer">银行转账</option>
                <option value="wechat">微信支付</option>
                <option value="alipay">支付宝</option>
                <option value="other">其他</option>
              </select>
            </div>
          </div>
        </form>
        <template #footer>
          <el-button type="info" @click="editPayoutDialogVisible = false">
            取消
          </el-button>
          <el-button type="primary" native-type="submit" form="edit-payout-form" :disabled="editPayoutSaving">
            <i v-if="editPayoutSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 结算工资对话框 -->
      <MobileDialog
        v-model="settleDialogVisible"
        title="结算工资"
        width="520px"
        dialog-class="salary-dialog"
        :show-default-footer="false"
        @close="closeSettleDialog"
      >
        <div class="settle-info">
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" class="settle-row">
            <span class="label">员工：</span>
            <span class="value">{{ settleForm.employeeName }}</span>
          </div>
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'net_salary')" class="settle-row">
            <span class="label">结算金额：</span>
            <span class="value amount">¥{{ settleForm.netSalary }}</span>
          </div>
        </div>
        <form id="settle-form" @submit.prevent="confirmSettle">
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'payment_method')" class="form-group">
            <label>支付方式 <span class="required">*</span></label>
            <select v-model="settleForm.payment_method" class="form-control" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'payment_method')" required>
              <option value="">请选择支付方式</option>
              <option value="cash">现金</option>
              <option value="bank_transfer">银行转账</option>
              <option value="wechat">微信支付</option>
              <option value="alipay">支付宝</option>
              <option value="other">其他</option>
            </select>
          </div>
        </form>
        <template #footer>
          <el-button type="info" @click="closeSettleDialog">
            取消
          </el-button>
          <el-button type="success" native-type="submit" form="settle-form" :disabled="settleSaving">
            <i v-if="settleSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-check"></i>
            确认结算
          </el-button>
        </template>
      </MobileDialog>

      <!-- 工资模板编辑对话框 -->
      <MobileDialog
        v-model="templateFormDialogVisible"
        :title="templateForm.id ? '编辑工资模板' : '新增工资模板'"
        width="760px"
        dialog-class="salary-dialog"
        :show-default-footer="false"
      >
        <form id="template-form" @submit.prevent="handleSaveTemplate">
          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_name')" class="form-group">
            <label>模板名称 <span class="required">*</span></label>
            <input
              v-model="templateForm.name"
              type="text"
              class="form-control"
              placeholder="请输入模板名称"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_name')"
              required
            />
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_description')" class="form-group">
            <label>说明</label>
            <textarea
              v-model="templateForm.description"
              class="form-control"
              rows="2"
              placeholder="请输入模板说明"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_description')"
            ></textarea>
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_base_salary')" class="form-group">
            <label>底薪（元） <span class="required">*</span></label>
            <input
              v-model.number="templateForm.base_salary"
              type="number"
              class="form-control"
              placeholder="请输入底薪"
              min="0"
              step="100"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_base_salary')"
              required
            />
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_commission_type')" class="form-group">
            <label>提成方式 <span class="required">*</span></label>
            <div class="radio-group">
              <label class="radio-label">
                <input
                  v-model="templateForm.commission_type"
                  type="radio"
                  value="fixed"
                  :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_commission_type')"
                />
                <span>固定金额</span>
              </label>
              <label class="radio-label">
                <input
                  v-model="templateForm.commission_type"
                  type="radio"
                  value="percentage"
                  :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_commission_type')"
                />
                <span>利润百分比</span>
              </label>
            </div>
          </div>

          <div v-if="templateForm.commission_type === 'fixed' && canViewSalaryField('salary_salarytemplatesview', 'template_commission_new_fixed')" class="form-group">
            <label>全新机提成（元/台） <span class="required">*</span></label>
            <input
              v-model.number="templateForm.commission_new_fixed"
              type="number"
              class="form-control"
              placeholder="请输入全新机提成金额"
              min="0"
              step="1"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_commission_new_fixed')"
              required
            />
            <span class="form-tip">销售全新机的提成金额，设为0则不计算提成</span>
          </div>

          <div v-if="templateForm.commission_type === 'fixed' && canViewSalaryField('salary_salarytemplatesview', 'template_commission_used_fixed')" class="form-group">
            <label>二手机提成（元/台）</label>
            <input
              v-model.number="templateForm.commission_used_fixed"
              type="number"
              class="form-control"
              placeholder="请输入二手机提成金额"
              min="0"
              step="1"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_commission_used_fixed')"
            />
            <span class="form-tip">销售二手机的提成金额，设为0则不计算提成</span>
          </div>

          <div v-if="templateForm.commission_type === 'percentage' && canViewSalaryField('salary_salarytemplatesview', 'template_commission_percentage')" class="form-group">
            <label>利润提成（%） <span class="required">*</span></label>
            <input
              v-model.number="templateForm.commission_percentage"
              type="number"
              class="form-control"
              placeholder="请输入利润提成比例"
              min="0"
              max="100"
              step="1"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_commission_percentage')"
              required
            />
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate')" class="form-group">
            <label>加班费率（元/小时） <span class="required">*</span></label>
            <input
              v-model.number="templateForm.overtime_hourly_rate"
              type="number"
              class="form-control"
              placeholder="请输入加班费率"
              min="0"
              step="10"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate')"
              required
            />
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_rest_days')" class="form-group">
            <label>每月休息天数 <span class="required">*</span></label>
            <input
              v-model.number="templateForm.rest_days"
              type="number"
              class="form-control"
              placeholder="请输入每月休息天数"
              min="0"
              max="31"
              step="1"
              :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_rest_days')"
              required
            />
            <span class="form-tip">请假天数超过此设置的部分，按日薪扣除工资</span>
          </div>

          <div
            v-if="canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled') || canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_months') || canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_amount') || canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_max_salary')"
            class="divider"
          >
            <span><i class="fas fa-chart-line"></i> 自动涨薪规则</span>
          </div>

          <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled')" class="form-group">
            <label class="switch-label">
              <span>启用自动涨薪</span>
              <label class="switch">
                <input
                  v-model="templateForm.auto_raise_enabled"
                  type="checkbox"
                  :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled')"
                />
                <span class="slider"></span>
              </label>
            </label>
          </div>

          <template v-if="templateForm.auto_raise_enabled && canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled')">
            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_months')" class="form-group">
              <label>涨薪周期（月） <span class="required">*</span></label>
              <input
                v-model.number="templateForm.auto_raise_months"
                type="number"
                class="form-control"
                placeholder="请输入涨薪周期"
                min="1"
                max="60"
                step="1"
                :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_auto_raise_months')"
                required
              />
              <span class="form-tip">员工入职每满此月数自动涨薪</span>
            </div>

            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_amount')" class="form-group">
              <label>涨薪金额（元） <span class="required">*</span></label>
              <input
                v-model.number="templateForm.auto_raise_amount"
                type="number"
                class="form-control"
                placeholder="请输入涨薪金额"
                min="0"
                step="50"
                :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_auto_raise_amount')"
                required
              />
              <span class="form-tip">每次涨薪增加的金额</span>
            </div>

            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_auto_raise_max_salary')" class="form-group">
              <label>最高底薪（元） <span class="required">*</span></label>
              <input
                v-model.number="templateForm.auto_raise_max_salary"
                type="number"
                class="form-control"
                placeholder="请输入最高底薪"
                min="0"
                step="100"
                :disabled="!canEditSalaryField('salary_salarytemplatesview', 'template_auto_raise_max_salary')"
                required
              />
              <span class="form-tip">达到此金额后不再自动涨薪</span>
            </div>
          </template>
        </form>
        <template #footer>
          <el-button type="info" @click="templateFormDialogVisible = false">
            取消
          </el-button>
          <el-button type="primary" native-type="submit" form="template-form" :disabled="templateSaving">
            <i v-if="templateSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 员工工资模板设置对话框 -->
      <MobileDialog
        v-model="templateDialogVisible"
        title="设置工资模板"
        width="520px"
        dialog-class="salary-dialog"
        :show-default-footer="false"
      >
        <div v-if="currentEmployee" class="employee-template-form">
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'employee_name')" class="form-group">
            <label>员工</label>
            <input
              :value="currentEmployee.name || currentEmployee.username"
              type="text"
              class="form-control"
              disabled
            />
          </div>
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'salary_template_name')" class="form-group">
            <label>选择模板</label>
            <select v-model="selectedTemplateId" class="form-control" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'salary_template_name')">
              <option value="">请选择工资模板</option>
              <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
                {{ tpl.name }} (底薪: ¥{{ tpl.base_salary }})
              </option>
            </select>
          </div>
          <div v-if="selectedTemplateId" class="template-preview-box">
            <h4>模板详情</h4>
            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_base_salary')" class="preview-row">
              <span class="preview-label">底薪：</span>
              <span class="preview-value">¥{{ getTemplateById(selectedTemplateId)?.base_salary }}</span>
            </div>
            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_commission_type')" class="preview-row">
              <span class="preview-label">提成：</span>
              <span class="preview-value">
                <template v-if="getTemplateCommissionType(selectedTemplateId) === 'fixed'">
                  ¥{{ getTemplateCommissionFixed(selectedTemplateId) }}/台
                </template>
                <template v-else>
                  利润的{{ getTemplateCommissionPercentage(selectedTemplateId) }}%
                </template>
              </span>
            </div>
            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate')" class="preview-row">
              <span class="preview-label">加班费率：</span>
              <span class="preview-value">¥{{ getTemplateOvertimeRate(selectedTemplateId) }}/小时</span>
            </div>
            <div v-if="canViewSalaryField('salary_salarytemplatesview', 'template_rest_days')" class="preview-row">
              <span class="preview-label">月休天数：</span>
              <span class="preview-value">{{ getTemplateById(selectedTemplateId)?.rest_days || 0 }}天</span>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button type="info" @click="templateDialogVisible = false">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button type="primary" @click="handleSaveEmployeeTemplate" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'salary_template_name')">
            <i class="fas fa-save"></i>
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 考勤记录对话框 -->
      <MobileDialog
        v-model="attendanceDialogVisible"
        :title="`${currentAttendanceEmployee?.name || currentAttendanceEmployee?.username || ''} - 考勤记录`"
        width="1100px"
        dialog-class="salary-dialog salary-dialog-large"
        :show-default-footer="false"
      >
        <div class="attendance-actions">
          <el-button
            v-if="canCreateSalaryRecord"
            v-permission="'salary-records:create'"
            type="primary"
            @click="handleAddAttendance"
          >
            <i class="fas fa-plus"></i>
            新增考勤
          </el-button>
          <el-button
            v-if="canCreateSalaryRecord"
            v-permission="'salary-records:create'"
            type="success"
            @click="handleQuickAdd('overtime')"
          >
            <i class="fas fa-business-time"></i>
            新增加班
          </el-button>
          <el-button
            v-if="canCreateSalaryRecord"
            v-permission="'salary-records:create'"
            type="success"
            @click="handleQuickAdd('monthly_leave')"
          >
            <i class="fas fa-umbrella-beach"></i>
            新增休假
          </el-button>
          <el-button
            v-if="canCreateSalaryRecord"
            v-permission="'salary-records:create'"
            type="warning"
            @click="handleQuickAdd('leave')"
          >
            <i class="fas fa-user-clock"></i>
            新增请假
          </el-button>
        </div>

        <el-table :data="attendanceRecords" v-loading="attendanceLoading" border stripe class="data-table">
          <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_date')" prop="record_date" label="日期" width="120" align="center" />
          <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_type')" label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getAttendanceTypeTag(row.record_type)" size="small">
                {{ getAttendanceTypeText(row.record_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_type') || canViewSalaryField('salary_salaryrecordsview', 'monthly_leave_days') || canViewSalaryField('salary_salaryrecordsview', 'leave_days') || canViewSalaryField('salary_salaryrecordsview', 'overtime_hours')"
            label="详情"
            width="150"
            align="center"
          >
            <template #default="{ row }">
              <span v-if="row.record_type === 'monthly_leave'">{{ row.monthly_leave_days }}天</span>
              <span v-else-if="row.record_type === 'leave'">{{ row.leave_type }} {{ row.leave_days }}天</span>
              <span v-else-if="row.record_type === 'overtime'">{{ row.overtime_hours }}小时</span>
            </template>
          </el-table-column>
          <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_reason')" prop="reason" label="原因" min-width="150" show-overflow-tooltip />
          <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_status')" prop="status" label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'pending'" type="info" size="small">待审批</el-tag>
              <el-tag v-else-if="row.status === 'approved'" type="success" size="small">已通过</el-tag>
              <el-tag v-else type="danger" size="small">已拒绝</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="canViewSalaryField('salary_salaryrecordsview', 'actions')" label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button
                v-if="canEditSalaryRecord"
                v-permission="'salary-records:edit'"
                size="small"
                type="primary"
                @click="handleEditAttendance(row)"
              >
                <i class="fas fa-edit"></i>
                编辑
              </el-button>
              <el-button
                v-if="canDeleteSalaryRecord"
                v-permission="'salary-records:delete'"
                size="small"
                type="danger"
                @click="handleDeleteAttendance(row.id)"
              >
                <i class="fas fa-trash"></i>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="!attendanceLoading && attendanceRecords.length === 0" class="empty-state">
          <i class="fas fa-calendar-check"></i>
          <p>暂无考勤记录</p>
        </div>
        <template #footer>
          <el-button type="info" @click="attendanceDialogVisible = false">
            <i class="fas fa-times"></i>
            关闭
          </el-button>
        </template>
      </MobileDialog>

      <!-- 新增/编辑考勤记录对话框 -->
      <MobileDialog
        v-model="attendanceFormVisible"
        :title="attendanceDialogTitle"
        width="680px"
        dialog-class="salary-dialog"
        :show-default-footer="false"
      >
        <form id="attendance-form" @submit.prevent="handleSaveAttendance">
          <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_type')" class="form-group">
            <label>记录类型</label>
            <div class="radio-group">
              <label class="radio-label">
                <input
                  v-model="attendanceForm.record_type"
                  type="radio"
                  value="monthly_leave"
                  @change="handleAttendanceTypeChange"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_type')"
                />
                <span>
                  <i class="fas fa-umbrella-beach text-success mr-1"></i>
                  休假
                </span>
              </label>
              <label class="radio-label">
                <input
                  v-model="attendanceForm.record_type"
                  type="radio"
                  value="leave"
                  @change="handleAttendanceTypeChange"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_type')"
                />
                <span>
                  <i class="fas fa-user-clock text-warning mr-1"></i>
                  请假
                </span>
              </label>
              <label class="radio-label">
                <input
                  v-model="attendanceForm.record_type"
                  type="radio"
                  value="overtime"
                  @change="handleAttendanceTypeChange"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_type')"
                />
                <span>
                      <i class="fas fa-business-time text-blue mr-1"></i>
                      加班
                    </span>
                  </label>
                </div>
              </div>

              <!-- 休假表单 -->
              <template v-if="attendanceForm.record_type === 'monthly_leave'">
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_date')" class="form-group">
                  <label>记录日期 <span class="required">*</span></label>
                  <input
                    v-model="attendanceForm.record_date"
                    type="date"
                    class="form-control"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_date')"
                    required
                  />
                </div>
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'monthly_leave_days')" class="form-group">
                  <label>休假天数（天） <span class="required">*</span></label>
                  <input
                    v-model.number="attendanceForm.monthly_leave_days"
                    type="number"
                    class="form-control"
                    min="0.5"
                    max="31"
                    step="0.5"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'monthly_leave_days')"
                    required
                  />
                </div>
              </template>

              <!-- 请假表单 -->
              <template v-if="attendanceForm.record_type === 'leave'">
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_date')" class="form-group">
                  <label>记录日期 <span class="required">*</span></label>
                  <input
                    v-model="attendanceForm.record_date"
                    type="date"
                    class="form-control"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_date')"
                    required
                  />
                </div>
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_leave_type')" class="form-group">
                  <label>请假类型 <span class="required">*</span></label>
                  <select v-model="attendanceForm.leave_type" class="form-control" :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_leave_type')" required>
                    <option value="">请选择请假类型</option>
                    <option value="事假">事假</option>
                    <option value="病假">病假</option>
                    <option value="年假">年假</option>
                    <option value="调休">调休</option>
                  </select>
                </div>
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'leave_days')" class="form-group">
                  <label>请假天数（天） <span class="required">*</span></label>
                  <input
                    v-model.number="attendanceForm.leave_days"
                    type="number"
                    class="form-control"
                    min="0.1"
                    max="31"
                    step="0.5"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'leave_days')"
                    required
                  />
                  <span class="form-tip">无薪，扣工资</span>
                </div>
              </template>

              <!-- 加班表单 -->
              <template v-if="attendanceForm.record_type === 'overtime'">
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_record_date')" class="form-group">
                  <label>加班日期 <span class="required">*</span></label>
                  <input
                    v-model="attendanceForm.record_date"
                    type="date"
                    class="form-control"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_record_date')"
                    required
                  />
                </div>
                <div v-if="canViewSalaryField('salary_salaryrecordsview', 'overtime_hours')" class="form-group">
                  <label>加班时长（小时） <span class="required">*</span></label>
                  <input
                    v-model.number="attendanceForm.overtime_hours"
                    type="number"
                    class="form-control"
                    min="0.5"
                    max="24"
                    step="0.5"
                    :disabled="!canEditSalaryField('salary_salaryrecordsview', 'overtime_hours')"
                    required
                  />
                  <span class="form-tip tag-success">有加班费</span>
                </div>
              </template>

              <!-- 备注 -->
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_reason')" class="form-group">
                <label>备注</label>
                <textarea
                  v-model="attendanceForm.reason"
                  class="form-control"
                  rows="2"
                  placeholder="请输入备注（可选）"
                  :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_reason')"
                ></textarea>
              </div>

              <!-- 状态 -->
              <div v-if="canViewSalaryField('salary_salaryrecordsview', 'attendance_status')" class="form-group">
                <label>状态</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input
                      v-model="attendanceForm.status"
                      type="radio"
                      value="approved"
                      :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_status')"
                    />
                    <span>
                      <i class="fas fa-check-circle text-success mr-1"></i>
                      已通过（直接生效）
                    </span>
                  </label>
                  <label class="radio-label">
                    <input
                      v-model="attendanceForm.status"
                      type="radio"
                      value="pending"
                      :disabled="!canEditSalaryField('salary_salaryrecordsview', 'attendance_status')"
                    />
                    <span>
                      <i class="fas fa-clock text-secondary mr-1"></i>
                      待审批（需审批后生效）
                    </span>
                  </label>
                </div>
              </div>
        </form>
        <template #footer>
          <el-button type="info" @click="attendanceFormVisible = false">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button type="primary" native-type="submit" form="attendance-form" :disabled="attendanceSaving">
            <i v-if="attendanceSaving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            保存
          </el-button>
        </template>
      </MobileDialog>
    </div>
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, ElConfigProvider } from 'element-plus'
import { SuccessFilled, Clock } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { salaryTemplateApi } from '@/api/salary-template'
import { salaryApi } from '@/api/salary'
import { userApi } from '@/api/user'
import { attendanceApi, type AttendanceRecord } from '@/api/attendance'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useLoadingState, ValidationRules } from '@/composables'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionDenied } from '@/components/base'
import dayjs from 'dayjs'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

// 配置中文语言环境
const locale = zhCn

// 使用统一的 composable
const authStore = useAuthStore()
const { success, error, warning } = useNotification()
const salaryTemplatePermissions = usePagePermissions('salary-templates')
const salaryRecordPermissions = usePagePermissions('salary-records')
const mySalaryPermissions = usePagePermissions('my-salary')
const canViewSalaryTemplates = computed(() => salaryTemplatePermissions.canView.value)
const canCreateSalaryTemplate = computed(() => salaryTemplatePermissions.canCreate.value)
const canEditSalaryTemplate = computed(() => salaryTemplatePermissions.canEdit.value)
const canDeleteSalaryTemplate = computed(() => salaryTemplatePermissions.canDelete.value)
const canViewSalaryRecords = computed(() => salaryRecordPermissions.canView.value)
const canCreateSalaryRecord = computed(() => salaryRecordPermissions.canCreate.value)
const canEditSalaryRecord = computed(() => salaryRecordPermissions.canEdit.value)
const canDeleteSalaryRecord = computed(() => salaryRecordPermissions.canDelete.value)
const canApproveSalaryRecord = computed(() => salaryRecordPermissions.canApprove.value)
const canManageSalaryRecord = computed(() => salaryRecordPermissions.canManage.value)
const canViewOwnSalary = computed(() => mySalaryPermissions.canView.value)
const canViewPayoutRecords = computed(() => canViewSalaryRecords.value || canViewOwnSalary.value)
const canAccessSalaryPage = computed(() => (
  canViewSalaryTemplates.value ||
  canViewSalaryRecords.value ||
  canViewOwnSalary.value
))
const { init: initFieldPermissions } = fieldPermissions
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const { loading } = useLoadingState()

const hasSalaryManagePermission = computed(() => (
  canCreateSalaryRecord.value ||
  canEditSalaryRecord.value ||
  canDeleteSalaryRecord.value ||
  canApproveSalaryRecord.value ||
  canManageSalaryRecord.value
))
const canViewTeamSalaryRecords = computed(() => canViewSalaryRecords.value)

const requireSalaryTemplatePermission = (action: 'view' | 'create' | 'edit' | 'delete') => {
  const allowed = action === 'view'
    ? canViewSalaryTemplates.value
    : action === 'create'
      ? canCreateSalaryTemplate.value
      : action === 'edit'
        ? canEditSalaryTemplate.value
        : canDeleteSalaryTemplate.value

  if (!allowed) {
    salaryTemplatePermissions.handleNoPermission(action)
  }

  return allowed
}

const requireSalaryRecordPermission = (action: 'view' | 'create' | 'edit' | 'delete' | 'approve') => {
  const allowed = action === 'view'
    ? canViewSalaryRecords.value || canManageSalaryRecord.value
    : action === 'create'
      ? canCreateSalaryRecord.value || canManageSalaryRecord.value
      : action === 'edit'
        ? canEditSalaryRecord.value || canManageSalaryRecord.value
        : action === 'delete'
          ? canDeleteSalaryRecord.value || canManageSalaryRecord.value
          : canApproveSalaryRecord.value || canManageSalaryRecord.value

  if (!allowed) {
    salaryRecordPermissions.handleNoPermission(action)
  }

  return allowed
}

const canViewOwnSalarySalesDetail = (row: any) => (
  canViewOwnSalary.value &&
  Number(row?.employee_id) === Number(authStore.user?.id)
)

const canUseSalaryField = (moduleKey: string, fieldName: string) => {
  return canViewSalaryField(moduleKey, fieldName) && canEditSalaryField(moduleKey, fieldName)
}

const salaryFieldMap: Record<string, string> = {
  stats_pending_salary: 'stats.pending_salary',
  stats_rest_summary: 'stats.rest_summary',
  stats_leave_summary: 'stats.leave_summary',
  stats_overtime_summary: 'stats.overtime_summary',
  template_is_default: 'template.is_default',
  template_name: 'template.name',
  template_description: 'template.description',
  template_base_salary: 'template.base_salary',
  template_commission_type: 'template.commission_type',
  template_commission_new_fixed: 'template.commission_new_fixed',
  template_commission_used_fixed: 'template.commission_used_fixed',
  template_commission_percentage: 'template.commission_percentage',
  template_overtime_hourly_rate: 'template.overtime_hourly_rate',
  template_rest_days: 'template.rest_days',
  template_auto_raise_enabled: 'template.auto_raise_enabled',
  template_auto_raise_months: 'template.auto_raise_months',
  template_auto_raise_amount: 'template.auto_raise_amount',
  template_auto_raise_max_salary: 'template.auto_raise_max_salary',
  template_is_active: 'template.is_active',
  template_employee_count: 'template.employee_count',
  employee_username: 'salary.employee_username',
  employee_name: 'salary.employee_name',
  employee_phone: 'salary.employee_phone',
  salary_template_name: 'salary.salary_template_name',
  period_start: 'salary.period_start',
  actual_work_days: 'salary.actual_work_days',
  base_salary: 'salary.base_salary',
  sales_count: 'salary.sales_count',
  commission_amount: 'salary.commission_amount',
  monthly_leave_days: 'salary.monthly_leave_days',
  leave_days: 'salary.leave_days',
  leave_deduction: 'salary.leave_deduction',
  overtime_hours: 'salary.overtime_hours',
  overtime_pay: 'salary.overtime_pay',
  net_salary: 'salary.net_salary',
  salary_status: 'salary.status',
  paid_at: 'salary.paid_at',
  payment_method: 'salary.payment_method',
  attendance_record_date: 'attendance.record_date',
  attendance_record_type: 'attendance.record_type',
  attendance_leave_type: 'attendance.leave_type',
  attendance_reason: 'attendance.reason',
  attendance_status: 'attendance.status',
  actions: 'system_info.operations'
}

const getSalaryFieldKey = (fieldName: string) => salaryFieldMap[fieldName] || fieldName
const canViewSalaryField = (moduleKey: string, fieldName: string) => {
  return fieldPermissions.isFieldVisible(moduleKey, getSalaryFieldKey(fieldName))
}
const canEditSalaryField = (moduleKey: string, fieldName: string) => {
  if (!canViewSalaryField(moduleKey, fieldName)) {
    return false
  }

  if (
    canCreateSalaryTemplate.value ||
    canEditSalaryTemplate.value ||
    canCreateSalaryRecord.value ||
    canEditSalaryRecord.value ||
    canManageSalaryRecord.value
  ) {
    return true
  }

  return fieldPermissions.isFieldEditable(moduleKey, getSalaryFieldKey(fieldName))
}

const salaryStatsModuleKey = computed(() => (
  canViewTeamSalaryRecords.value ? 'salary_salaryrecordsview' : 'salary_mysalaryview'
))

const showSalaryStatsCards = computed(() => (
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_pending_salary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_rest_summary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_leave_summary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_overtime_summary')
))

const showTemplateDefaultColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'template_is_default') && !isMobile.value)
const showTemplateNameColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'template_name'))
const showTemplateDescriptionColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'template_description') && !isMobile.value)
const showTemplateBaseSalaryColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'template_base_salary'))
const showTemplateCommissionColumn = computed(() => !isMobile.value && (
  canViewSalaryField('salary_salarytemplatesview', 'template_commission_type') ||
  canViewSalaryField('salary_salarytemplatesview', 'template_commission_new_fixed') ||
  canViewSalaryField('salary_salarytemplatesview', 'template_commission_used_fixed') ||
  canViewSalaryField('salary_salarytemplatesview', 'template_commission_percentage')
))
const showTemplateRateColumn = computed(() => !isMobile.value && (
  canViewSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate') ||
  canViewSalaryField('salary_salarytemplatesview', 'template_rest_days')
))
const showTemplateEmployeeCountColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'template_employee_count'))
const showTemplateActionColumn = computed(() => canViewSalaryField('salary_salarytemplatesview', 'actions') && !isMobile.value)

// TAB 切换
const activeTab = ref('my')

// 搜索相关状态
const templateSearchExpanded = ref(false)
const recordsSearchExpanded = ref(false)
const payoutSearchExpanded = ref(false)
const employeeSearchExpanded = ref(false)

// 统计数据
const stats = ref({
  pendingSalary: 0,
  pendingCount: 0,
  myPendingSalary: 0,
  restEmployees: [] as string[],
  leaveEmployees: [] as string[],
  overtimeEmployees: [] as string[],
  totalRestDays: 0,
  totalLeaveDays: 0,
  totalOvertimeHours: 0,
  myRestQuota: 0,
  myRestDays: 0,
  myRestRemaining: 0,
  myLeaveDays: 0,
  myLeaveDeduction: 0,
  myOvertimeHours: 0,
  myOvertimePay: 0
})

const resetMyStats = () => {
  stats.value.myPendingSalary = 0
  stats.value.myRestQuota = 0
  stats.value.myRestDays = 0
  stats.value.myRestRemaining = 0
  stats.value.myLeaveDays = 0
  stats.value.myLeaveDeduction = 0
  stats.value.myOvertimeHours = 0
  stats.value.myOvertimePay = 0
}

const getMonthDateRange = (date?: any) => {
  const d = date ? dayjs(date) : TimeUtil.now()
  const year = d.year()
  const month = d.month() + 1
  const lastDay = TimeUtil.endOf(d, 'month').date()

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
}

// 模板数据
const templates = ref<any[]>([])
const templatesLoading = ref(false)
const templateSearch = ref('')
const templateFilters = reactive({
  is_active: undefined
})

const syncVisibleSalaryFilters = () => {
  if (!canViewSalaryField('salary_salarytemplatesview', 'template_is_active')) {
    templateFilters.is_active = undefined
  }
  if (!canViewSalaryField('salary_salaryrecordsview', 'salary_template_name')) {
    employeeTemplateFilter.value = undefined
  }
  if (!canViewSalaryField('salary_salaryrecordsview', 'salary_status')) {
    payoutFilters.status = undefined
  }
  if (!canViewSalaryField('salary_mysalaryview', 'period_start')) {
    myPeriodRange.value = null
  }
  if (!canViewSalaryField('salary_mysalaryview', 'employee_name')) {
    selectedViewEmployeeId.value = undefined
  }
}

// 过滤后的模板列表（仅前端搜索过滤，状态筛选由后端处理）
const filteredTemplates = computed(() => {
  let result = [...templates.value]

  // 搜索过滤
  if (templateSearch.value) {
    const search = templateSearch.value.toLowerCase()
    result = result.filter((tpl: any) =>
      (tpl.name && tpl.name.toLowerCase().includes(search)) ||
      (tpl.description && tpl.description.toLowerCase().includes(search))
    )
  }

  return result
})

const templateTableRef = ref()
const mobileExpandedTemplateId = ref<number | null>(null)
const lastTappedTemplateId = ref<number | null>(null)
const lastTemplateTapTimestamp = ref(0)

const handleTemplateRowDblClick = (row: any) => {
  if (!isMobile.value) return

  const shouldExpand = mobileExpandedTemplateId.value !== row.id
  if (mobileExpandedTemplateId.value && mobileExpandedTemplateId.value !== row.id) {
    const previous = filteredTemplates.value.find((item: any) => item.id === mobileExpandedTemplateId.value)
    if (previous) {
      templateTableRef.value?.toggleRowExpansion(previous, false)
    }
  }

  templateTableRef.value?.toggleRowExpansion(row, shouldExpand)
  mobileExpandedTemplateId.value = shouldExpand ? row.id : null
}

const handleTemplateRowTap = (row: any) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedTemplateId.value === row.id && now - lastTemplateTapTimestamp.value <= 320) {
    handleTemplateRowDblClick(row)
    lastTappedTemplateId.value = null
    lastTemplateTapTimestamp.value = 0
    return
  }

  lastTappedTemplateId.value = row.id
  lastTemplateTapTimestamp.value = now
}

// 监听筛选条件变化，自动重新加载数据
watch(() => templateFilters.is_active, () => {
  loadTemplates()
})

// 我的工资数据
const myRecords = ref<any[]>([])
const myLoading = ref(false)
const myPeriodRange = ref<[string, string] | null>(null)
const myPagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 团队工资视角：选择要查看的员工
const selectedViewEmployeeId = ref<number | undefined>(undefined)

// 获取选中员工的名称
const getSelectedEmployeeName = () => {
  if (!selectedViewEmployeeId.value) return ''
  const emp = employees.value.find((e: any) => e.id === selectedViewEmployeeId.value)
  return emp?.name || emp?.username || ''
}

// 处理查看员工变化
const handleViewEmployeeChange = () => {
  // 重置分页并重新加载
  myPagination.page = 1
  loadMyRecords()
}

// 工资发放数据
const payoutList = ref<any[]>([])
const payoutLoading = ref(false)
// 设置默认月份为当前月份
const getCurrentMonth = () => {
  return TimeUtil.nowFormatted(TIME_FORMATS.YEAR_MONTH)
}
const payoutMonth = ref<string>(getCurrentMonth())
const payoutSearch = ref('')
const payoutFilters = reactive({
  status: undefined
})

// 编辑工资相关
const editPayoutDialogVisible = ref(false)
const editPayoutSaving = ref(false)
const editPayoutForm = ref<any>({
  id: 0,
  employee_id: 0,
  salary_template_id: null,
  base_salary: 0,
  commission_amount: 0,
  overtime_pay: 0,
  leave_deduction: 0,
  status: 'approved',
  paid_at: null,
  payment_method: null
})

// 结算工资相关
const settleDialogVisible = ref(false)
const settleSaving = ref(false)
const settleForm = ref<any>({
  recordId: 0,
  employeeId: 0,
  employeeName: '',
  netSalary: 0,
  payment_method: ''
})

// 计算编辑后的应发工资
const calculateEditNetSalary = () => {
  const base = parseFloat(editPayoutForm.value.base_salary) || 0
  const commission = parseFloat(editPayoutForm.value.commission_amount) || 0
  const overtime = parseFloat(editPayoutForm.value.overtime_pay) || 0
  const leave = parseFloat(editPayoutForm.value.leave_deduction) || 0
  return (base + commission + overtime - leave).toFixed(2)
}

// 工资发放数据 - 合并员工和工资记录
const salaryPayoutData = computed(() => {
  // 创建工资记录映射
  const payoutMap = new Map()
  payoutList.value.forEach((record: any) => {
    payoutMap.set(record.employee_id, record)
  })

  // 合并员工和工资记录
  let result = employees.value.map((employee: any) => {
    const payoutRecord = payoutMap.get(employee.id)
    return {
      ...employee,
      payoutRecord: payoutRecord || null
    }
  })

  // 搜索过滤
  if (payoutSearch.value) {
    const search = payoutSearch.value.toLowerCase()
    result = result.filter((item: any) =>
      (item.name && item.name.toLowerCase().includes(search)) ||
      (item.username && item.username.toLowerCase().includes(search))
    )
  }

  // 根据状态筛选
  if (payoutFilters.status) {
    result = result.filter((item: any) => {
      if (payoutFilters.status === 'paid') {
        // 已结算：必须有工资记录且状态为paid
        return item.payoutRecord && item.payoutRecord.status === 'paid'
      } else if (payoutFilters.status === 'unpaid') {
        // 未结算：没有工资记录 或者 状态不是paid
        return !item.payoutRecord || item.payoutRecord.status !== 'paid'
      }
      return true
    })
  }

  return result
})

const payoutTableRef = ref()
const mobileExpandedPayoutId = ref<number | null>(null)
const lastTappedPayoutId = ref<number | null>(null)
const lastPayoutTapTimestamp = ref(0)

const handlePayoutRowDblClick = (row: any) => {
  if (!isMobile.value) return

  const shouldExpand = mobileExpandedPayoutId.value !== row.id
  if (mobileExpandedPayoutId.value && mobileExpandedPayoutId.value !== row.id) {
    const previous = salaryPayoutData.value.find((item: any) => item.id === mobileExpandedPayoutId.value)
    if (previous) {
      payoutTableRef.value?.toggleRowExpansion(previous, false)
    }
  }

  payoutTableRef.value?.toggleRowExpansion(row, shouldExpand)
  mobileExpandedPayoutId.value = shouldExpand ? row.id : null
}

const handlePayoutRowTap = (row: any) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedPayoutId.value === row.id && now - lastPayoutTapTimestamp.value <= 320) {
    handlePayoutRowDblClick(row)
    lastTappedPayoutId.value = null
    lastPayoutTapTimestamp.value = 0
    return
  }

  lastTappedPayoutId.value = row.id
  lastPayoutTapTimestamp.value = now
}

// 员工列表
const employees = ref<any[]>([])
const employeesLoading = ref(false)
const employeeSearch = ref('')
const employeeTemplateFilter = ref<number | undefined>(undefined)
// 员工薪资页面选择的月份（默认当前月份）
const employeeSalaryMonth = ref(getCurrentMonth())
const employeeAttendanceData = ref<Map<number, any>>(new Map())
const employeeSalesData = ref<Map<number, any>>(new Map()) // 员工销售数据

// 过滤后的员工列表
const filteredEmployees = computed(() => {
  let result = [...employees.value]

  // 搜索过滤
  if (employeeSearch.value) {
    const search = employeeSearch.value.toLowerCase()
    result = result.filter((emp: any) =>
      (emp.name && emp.name.toLowerCase().includes(search)) ||
      (emp.username && emp.username.toLowerCase().includes(search))
    )
  }

  // 模板过滤
  if (employeeTemplateFilter.value !== undefined && employeeTemplateFilter.value !== null) {
    result = result.filter((emp: any) => emp.salary_template_id === employeeTemplateFilter.value)
  }

  return result
})

const employeeTableRef = ref()
const mobileExpandedEmployeeId = ref<number | null>(null)
const lastTappedEmployeeId = ref<number | null>(null)
const lastEmployeeTapTimestamp = ref(0)

const handleEmployeeRowDblClick = (row: any) => {
  if (!isMobile.value) return

  const shouldExpand = mobileExpandedEmployeeId.value !== row.id
  if (mobileExpandedEmployeeId.value && mobileExpandedEmployeeId.value !== row.id) {
    const previous = filteredEmployees.value.find((item: any) => item.id === mobileExpandedEmployeeId.value)
    if (previous) {
      employeeTableRef.value?.toggleRowExpansion(previous, false)
    }
  }

  employeeTableRef.value?.toggleRowExpansion(row, shouldExpand)
  mobileExpandedEmployeeId.value = shouldExpand ? row.id : null
}

const handleEmployeeRowTap = (row: any) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedEmployeeId.value === row.id && now - lastEmployeeTapTimestamp.value <= 320) {
    handleEmployeeRowDblClick(row)
    lastTappedEmployeeId.value = null
    lastEmployeeTapTimestamp.value = 0
    return
  }

  lastTappedEmployeeId.value = row.id
  lastEmployeeTapTimestamp.value = now
}

// 详情对话框
const detailDialogVisible = ref(false)
const currentRecord = ref<any>(null)

// 销售明细对话框
const salesDetailDialogVisible = ref(false)
const currentSalesRecord = ref<any>(null)
const salesDetailList = ref<any[]>([])
const salesDetailLoading = ref(false)

// 销售汇总数据
const salesSummary = computed(() => {
  const list = salesDetailList.value
  return {
    total_price: list.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0).toFixed(2)
  }
})

// 查看销售明细
const handleViewSalesDetail = async (row: any) => {
  if (!canViewOwnSalarySalesDetail(row) && !requireSalaryRecordPermission('view')) {
    return
  }

  currentSalesRecord.value = row
  salesDetailDialogVisible.value = true
  salesDetailList.value = []
  salesDetailLoading.value = true

  try {
    // 尝试从 commission_detail 解析
    if (row.commission_detail) {
      try {
        let details = JSON.parse(row.commission_detail)
        if (Array.isArray(details) && details.length > 0) {
          // 获取员工工资模板，确定哪些机型需要显示
          const template = getTemplateById(row.salary_template_id)
          const newRate = template?.commission_new_fixed || template?.commission_fixed || 0
          const usedRate = template?.commission_used_fixed || 0

          // 只保留有提成的机型
          details = details.filter((item: any) => {
            // 如果数据中有 is_new 字段
            if (item.is_new !== undefined) {
              const isNew = item.is_new === 1 || item.is_new === '1' || item.is_new === true
              if (isNew && newRate > 0) return true  // 全新机有提成
              if (!isNew && usedRate > 0) return true  // 二手机有提成
              return false
            }
            // 如果没有 is_new 字段，默认是全新机，根据全新机提成判断
            return newRate > 0
          })

          if (details.length > 0) {
            salesDetailList.value = details
            return
          }
        }
      } catch (e) {
        logger.error('解析 commission_detail 失败:', e)
      }
    }

    // 如果 commission_detail 为空或解析后没有数据，调用API获取
    if (row.employee_id && row.period_start && row.period_end) {
      const response = await salaryApi.records.getEmployeeSalesDetails(
        row.employee_id,
        row.period_start,
        row.period_end
      )
      if (response.data && Array.isArray(response.data)) {
        salesDetailList.value = response.data
      }
    }
  } catch (error) {
    logger.error('加载销售明细失败:', error)
    ElMessage.error('加载销售明细失败')
  } finally {
    salesDetailLoading.value = false
  }
}

// 格式化销售时间
const formatSaleTime = (time: string) => {
  if (!time) return '-'
  try {
    const date = new Date(time)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch (e) {
    return time
  }
}

// 员工销售明细对话框
const employeeSalesDetailDialogVisible = ref(false)
const currentEmployeeSales = ref<any>(null)
const employeeSalesDetailList = ref<any[]>([])
const employeeSalesDetailLoading = ref(false)

// 员工销售汇总数据
const employeeSalesSummary = computed(() => {
  const list = employeeSalesDetailList.value
  return {
    total_count: list.length,
    total_sales: list.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0).toFixed(2),
    total_profit: list.reduce((sum, item) => sum + (Number(item.profit) || 0), 0).toFixed(2)
  }
})

// 查看员工销售明细（双击销售数量列触发）
const handleViewEmployeeSalesDetail = async (row: any) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  const stats = getEmployeeSalesStats(row.id)
  if (stats.sales_count === 0) {
    ElMessage.info('该员工暂无销售记录')
    return
  }

  currentEmployeeSales.value = row
  employeeSalesDetailDialogVisible.value = true
  employeeSalesDetailLoading.value = true

  try {
    // 根据当前选择的月份计算时间范围
    const monthStr = employeeSalaryMonth.value
    if (!monthStr) {
      ElMessage.warning('请先选择月份')
      employeeSalesDetailLoading.value = false
      return
    }

    const [year, month] = monthStr.split('-')
    const startDate = `${year}-${month}-01`
    // 计算该月的最后一天
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 使用专门的员工销售明细API获取该员工的销售明细
    const response = await salaryApi.records.getEmployeeSalesDetails(row.id, startDate, endDate)

    if (response.data) {
      // 员工销售明细API返回的是扁平化的数组
      const detailData = Array.isArray(response.data) ? response.data : []

      // 获取员工工资模板，确定哪些机型需要显示
      const template = getTemplateById(getEmployeeTemplateId(row.id))
      const newRate = template?.commission_new_fixed || template?.commission_fixed || 0
      const usedRate = template?.commission_used_fixed || 0

      // 前端过滤：只显示有提成的机型
      const filteredData = detailData.filter((item: any) => {
        // 只显示有提成的机型
        const isNew = item.is_new === true || item.is_new === 1
        if (isNew && newRate > 0) return true  // 全新机有提成
        if (!isNew && usedRate > 0) return true  // 二手机有提成
        return false  // 没有提成的机型不显示
      })

      employeeSalesDetailList.value = filteredData.map((item: any) => {
        // 新API返回的是扁平化结构，直接使用item的字段
        const purchaseCost = parseFloat(item.purchase_cost || 0)
        const salePrice = parseFloat(item.sale_price || 0)
        const isNew = item.is_new === true || item.is_new === 1

        return {
          phone_id: item.phone_id,
          imei: item.imei || '-',
          serial_number: item.serial_number || '-',
          brand: item.brand || '-',
          model: item.model || '-',
          color: item.color || '-',
          memory: item.memory || '-',
          is_new: isNew,
          condition_type: isNew ? '全新' : '二手',
          purchase_cost: purchaseCost,
          sale_price: salePrice,
          profit: item.profit || (salePrice - purchaseCost),
          salestime: item.salestime,
          customer_name: item.customer_name || '-',
          customer_phone: item.customer_phone || '-'
        }
      })
    }
  } catch (error) {
    logger.error('加载员工销售明细失败:', error)
    ElMessage.error('加载员工销售明细失败')
    employeeSalesDetailList.value = []
  } finally {
    employeeSalesDetailLoading.value = false
  }
}

// 员工模板编辑对话框
const templateDialogVisible = ref(false)
const currentEmployee = ref<any>(null)
const selectedTemplateId = ref<number | undefined>(undefined)

// 工资模板表单
const templateFormDialogVisible = ref(false)
const templateSaving = ref(false)
const templateForm = ref<any>({
  id: undefined,
  name: '',
  description: '',
  base_salary: 2500,
  commission_type: 'fixed',
  commission_fixed: 20,
  commission_new_fixed: 20,  // 全新机提成（元/台）
  commission_used_fixed: 0,  // 二手机提成（元/台）
  commission_percentage: 10,
  overtime_hourly_rate: 10,
  rest_days: 2,
  // 自动涨薪规则
  auto_raise_enabled: false,
  auto_raise_months: 6,
  auto_raise_amount: 100,
  auto_raise_max_salary: 3000
})

const templateFormRules = {
  name: [ValidationRules.required('请输入模板名称')],
  base_salary: [ValidationRules.required('请输入底薪')],
  commission_type: [ValidationRules.required('请选择提成方式')],
  overtime_hourly_rate: [ValidationRules.required('请输入加班费率')]
}

// 加载模板列表
const loadTemplates = async () => {
  if (!canViewSalaryTemplates.value && !canViewSalaryRecords.value) {
    templates.value = []
    return
  }

  templatesLoading.value = true
  try {
    const templateQuery = canViewSalaryField('salary_salarytemplatesview', 'template_is_active')
      ? templateFilters
      : {}
    const response = canViewSalaryTemplates.value
      ? await salaryTemplateApi.getTemplates(templateQuery)
      : await salaryTemplateApi.getActiveTemplates()

    if (response.data) {
      templates.value = Array.isArray(response.data)
        ? response.data
        : (response.data.records || [])
    }
  } catch (error: any) {
    templates.value = []
    if (error?.response?.status === 403) {
      ElMessage.warning('当前账号没有工资模板查看权限')
      return
    }
    ElMessage.error('加载模板失败')
  } finally {
    templatesLoading.value = false
  }
}

// 加载工资发放记录
// 管理员/有工资记录查看权限：查看全部或按员工筛选
// 普通用户/仅有我的工资权限：只查看自己
const loadMyRecords = async () => {
  if (!canViewPayoutRecords.value) {
    myRecords.value = []
    myPagination.total = 0
    return
  }

  myLoading.value = true
  try {
    const params: any = {
      status: 'paid', // 只查询已发放的记录
      page: myPagination.page,
      limit: myPagination.size
    }

    // 团队工资视角下，允许切换到指定员工记录
    if (
      canViewTeamSalaryRecords.value &&
      canViewSalaryField('salary_mysalaryview', 'employee_name') &&
      selectedViewEmployeeId.value
    ) {
      params.employee_id = selectedViewEmployeeId.value
    }

    if (
      canViewSalaryField('salary_mysalaryview', 'period_start') &&
      myPeriodRange.value &&
      myPeriodRange.value.length === 2
    ) {
      // period_start = 开始月份的第一天
      params.period_start = myPeriodRange.value[0] + '-01'
      // period_end = 结束月份的最后一天
      const endYear = myPeriodRange.value[1].split('-')[0]
      const endMonth = myPeriodRange.value[1].split('-')[1]
      const daysInMonth = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate()
      params.period_end = `${endYear}-${endMonth}-${daysInMonth}`
    }

    const response = canViewTeamSalaryRecords.value
      ? await salaryApi.getSalaryRecords(params)
      : await salaryApi.getMySalaryRecords(params)

    if (response.data) {
      // response.data 已经是 {records: [...], pagination: {...}}
      myRecords.value = response.data.records || []
      myPagination.total = Number(response.data.pagination?.total || 0)
    }
  } catch (error) {
    ElMessage.error('加载工资记录失败')
  } finally {
    myLoading.value = false
  }
}

const loadMyStats = async () => {
  if (!canViewOwnSalary.value || canViewTeamSalaryRecords.value) {
    resetMyStats()
    return
  }

  const userId = Number(authStore.user?.id || 0)
  if (!userId) {
    resetMyStats()
    return
  }

  const { startDate, endDate } = getMonthDateRange()

  try {
    const currentMonthKey = `${startDate.slice(0, 7)}`
    const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number)
    const [employeeListResult, currentSalaryResult, attendanceResult, leaveBalanceResult, salesDetailResult] = await Promise.allSettled([
      unifiedApi.get('/employees/salary-list'),
      unifiedApi.get('/employees/current-salary', { params: { date: currentMonthKey } }),
      attendanceApi.getAttendanceRecords({
        start_date: startDate,
        end_date: endDate,
        status: 'approved',
        limit: 200
      }),
      attendanceApi.getLeaveBalance(),
      salaryApi.records.getEmployeeSalesDetails(userId, startDate, endDate)
    ])

    const employeesData = employeeListResult.status === 'fulfilled'
      ? (employeeListResult.value.data?.employees || [])
      : []
    const currentSalaryData = currentSalaryResult.status === 'fulfilled'
      ? (currentSalaryResult.value.data?.employees || [])
      : []

    const myEmployee = employeesData.find((employee: any) => Number(employee.id) === userId)
    const mySalaryInfo = currentSalaryData.find((employee: any) => Number(employee.id) === userId)
    const myTemplate = mySalaryInfo || templates.value.find((template: any) => Number(template.id) === Number(myEmployee?.salary_template_id))

    if (attendanceResult.status === 'fulfilled') {
      const attendanceRecords = attendanceResult.value.data?.records || attendanceResult.value.data?.data || []
      let myLeaveDays = 0
      let myOvertimeHours = 0
      let myRestDays = 0

      attendanceRecords.forEach((record: any) => {
        if (Number(record.employee_id) !== userId) {
          return
        }

        if (record.record_type === 'leave') {
          myLeaveDays += parseFloat(record.leave_days || 0)
        } else if (record.record_type === 'overtime') {
          myOvertimeHours += parseFloat(record.overtime_hours || 0)
        } else if (record.record_type === 'monthly_leave') {
          myRestDays += parseFloat(record.monthly_leave_days || 0)
        }
      })

      stats.value.myLeaveDays = parseFloat(myLeaveDays.toFixed(2))
      stats.value.myOvertimeHours = parseFloat(myOvertimeHours.toFixed(2))
      stats.value.myRestDays = parseFloat(myRestDays.toFixed(2))
    } else {
      stats.value.myLeaveDays = 0
      stats.value.myOvertimeHours = 0
      stats.value.myRestDays = 0
    }

    if (leaveBalanceResult.status === 'fulfilled') {
      const leaveBalance = leaveBalanceResult.value.data || {}
      stats.value.myRestQuota = parseFloat(leaveBalance.totalQuota || leaveBalance.monthlyLimit || 0) || 0
      stats.value.myRestRemaining = parseFloat(leaveBalance.available || 0) || 0
    } else {
      stats.value.myRestQuota = 0
      stats.value.myRestRemaining = 0
    }

    const salesDetails = salesDetailResult.status === 'fulfilled'
      ? (Array.isArray(salesDetailResult.value.data) ? salesDetailResult.value.data : [])
      : []

    const baseSalary = parseFloat(mySalaryInfo?.current_salary || mySalaryInfo?.base_salary || 0) || 0
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const dailySalary = daysInMonth > 0 ? baseSalary / daysInMonth : 0
    const leaveDeduction = dailySalary * (stats.value.myLeaveDays || 0)
    const overtimeRate = parseFloat(myTemplate?.overtime_hourly_rate || 0) || 0
    const overtimePay = (stats.value.myOvertimeHours || 0) * overtimeRate

    let commissionAmount = 0
    if (myTemplate) {
      if (myTemplate.commission_type === 'fixed') {
        const newRate = parseFloat(myTemplate.commission_new_fixed || myTemplate.commission_fixed || 0) || 0
        const usedRate = parseFloat(myTemplate.commission_used_fixed || 0) || 0

        salesDetails.forEach((item: any) => {
          const isNew = item.is_new === true || item.is_new === 1 || item.is_new === '1'
          if (isNew) {
            commissionAmount += newRate
          } else if (usedRate > 0) {
            commissionAmount += usedRate
          }
        })
      } else {
        const percentage = parseFloat(myTemplate.commission_percentage || 0) || 0
        const totalProfit = salesDetails.reduce((sum: number, item: any) => {
          const salePrice = parseFloat(item.sale_price || 0) || 0
          const purchaseCost = parseFloat(item.purchase_cost || 0) || 0
          return sum + (salePrice - purchaseCost)
        }, 0)
        commissionAmount = totalProfit * percentage / 100
      }
    }

    stats.value.myLeaveDeduction = parseFloat(leaveDeduction.toFixed(2))
    stats.value.myOvertimePay = parseFloat(overtimePay.toFixed(2))
    stats.value.myPendingSalary = parseFloat((baseSalary + commissionAmount + overtimePay - leaveDeduction).toFixed(2))
  } catch (err) {
    logger.error('加载个人工资统计失败:', err)
    resetMyStats()
  }
}

// 更新统计数据
const updateStats = () => {
  const currentUserId = authStore.user?.id
  const now = TimeUtil.now()
  const year = now.year()
  const month = now.month() + 1
  const periodDays = TimeUtil.endOf(now, 'month').date()

  // 团队工资统计
  if (canViewTeamSalaryRecords.value) {
    let pendingSalary = 0
    let pendingCount = 0
    let totalRestDays = 0
    let totalLeaveDays = 0
    let totalOvertimeHours = 0
    const restEmployees: string[] = []
    const leaveEmployees: string[] = []
    const overtimeEmployees: string[] = []

    // 统计所有关联工资模板的员工的待发工资
    employees.value.forEach((employee: any) => {
      // 只统计有工资模板的员工
      if (!employee.salary_template_id) return

      const empId = employee.id
      const attendanceData = employeeAttendanceData.value.get(empId)
      const salesData = employeeSalesData.value.get(empId)
      const employeeName = employee.name || employee.username

      // 计算该员工的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = parseFloat(employee.current_salary || employee.base_salary || 0)
      const overtimePay = parseFloat(salesData?.overtime_pay || 0)
      const commission = parseFloat(salesData?.commission_amount || 0)

      // 动态计算请假扣除
      const leaveDays = attendanceData?.leave_days || 0
      const dailySalary = periodDays > 0 ? baseSalary / periodDays : 0
      const leaveDeduction = dailySalary * leaveDays

      const netSalary = baseSalary + commission + overtimePay - leaveDeduction
      pendingSalary += netSalary
      pendingCount++

      // 累计休假天数和员工名单
      const restDays = attendanceData?.monthly_leave_days_used || 0
      totalRestDays += restDays
      if (restDays > 0) {
        restEmployees.push(employeeName)
      }

      // 累计请假天数和员工名单
      totalLeaveDays += leaveDays
      if (leaveDays > 0) {
        leaveEmployees.push(employeeName)
      }

      // 累计加班小时数和员工名单
      const overtimeHours = salesData?.overtime_hours || 0
      totalOvertimeHours += overtimeHours
      if (overtimeHours > 0) {
        overtimeEmployees.push(employeeName)
      }
    })

    stats.value.pendingSalary = parseFloat(pendingSalary.toFixed(2))
    stats.value.pendingCount = pendingCount
    stats.value.totalRestDays = Math.round(totalRestDays)
    stats.value.totalLeaveDays = Math.round(totalLeaveDays)
    stats.value.totalOvertimeHours = Math.round(totalOvertimeHours)
    stats.value.restEmployees = restEmployees
    stats.value.leaveEmployees = leaveEmployees
    stats.value.overtimeEmployees = overtimeEmployees
  } else {
    // 普通用户统计数据 - 只显示自己的待发工资
    const myAttendanceData = employeeAttendanceData.value.get(currentUserId)
    const mySalesData = employeeSalesData.value.get(currentUserId)
    const employee = employees.value.find((e: any) => e.id === currentUserId)

    if (employee) {
      // 计算自己的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = parseFloat(employee.current_salary || employee.base_salary || 0)
      const overtimePay = parseFloat(mySalesData?.overtime_pay || 0)
      const commission = parseFloat(mySalesData?.commission_amount || 0)

      // 动态计算请假扣除
      const leaveDays = myAttendanceData?.leave_days || 0
      const dailySalary = periodDays > 0 ? baseSalary / periodDays : 0
      const leaveDeduction = dailySalary * leaveDays

      const netSalary = baseSalary + commission + overtimePay - leaveDeduction
      stats.value.myPendingSalary = parseFloat(netSalary.toFixed(2))

      // 休假数据
      stats.value.myRestDays = myAttendanceData?.monthly_leave_days_used || 0
      stats.value.myRestRemaining = myAttendanceData?.monthly_leave_days_available || 0

      // 请假数据
      stats.value.myLeaveDays = leaveDays
      stats.value.myLeaveDeduction = parseFloat(leaveDeduction.toFixed(2))

      // 加班数据
      stats.value.myOvertimeHours = mySalesData?.overtime_hours || 0
      stats.value.myOvertimePay = parseFloat(overtimePay.toFixed(2))
    }
  }
}

// 获取员工名称
const getEmployeeName = (id: number) => {
  const emp = employees.value.find(e => e.id === id)
  return emp?.name || emp?.username || '-'
}

// 重置筛选
const resetTemplateFilters = () => {
  templateSearch.value = ''
  templateFilters.is_active = undefined
  syncVisibleSalaryFilters()
  loadTemplates()
}

const resetMyFilters = () => {
  myPeriodRange.value = null
  selectedViewEmployeeId.value = undefined
  myPagination.page = 1
  syncVisibleSalaryFilters()
  loadMyRecords()
}

// 我的工资分页处理
const handleMyPaginationChange = (page: number, pageSize: number) => {
  myPagination.page = page
  myPagination.size = pageSize
  loadMyRecords()
}

const resetPayoutFilters = () => {
  payoutSearch.value = ''
  payoutFilters.status = undefined
  syncVisibleSalaryFilters()
  loadPayoutList()
}

// 员工薪资相关方法
// 支持传入日期参数（YYYY-MM）来计算指定月份的底薪
const loadEmployeeList = async (dateParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employees.value = []
    employeeAttendanceData.value = new Map()
    employeeSalesData.value = new Map()
    return
  }

  employeesLoading.value = true
  try {
    if (templates.value.length === 0) {
      await loadTemplates()
    }

    // 获取员工列表（使用工资管理专用接口）
    const response = await unifiedApi.get('/employees/salary-list')
    if (response.data && response.data.employees) {
      // 接口已经过滤了在职员工，直接使用
      employees.value = response.data.employees || []

      // 获取员工当前底薪（包含工龄涨薪），传入日期参数
      const params = dateParam ? { date: dateParam } : {}
      const salaryResponse = await unifiedApi.get('/employees/current-salary', { params })

      if (salaryResponse.data && salaryResponse.data.employees) {
        const salaryData = salaryResponse.data.employees

        // 将当前底薪信息合并到员工数据
        employees.value = employees.value.map((emp: any) => {
          const salaryInfo = salaryData.find((s: any) => s.id === emp.id)
          return {
            ...emp,
            current_salary: salaryInfo?.current_salary || 0,
            base_salary: salaryInfo?.base_salary || 0,
            salary_adjustment: salaryInfo?.salary_adjustment || 0,
            salary_note: salaryInfo?.salary_note || ''
          }
        })
      }

      // 加载所有员工的考勤统计（传入日期参数）
      await loadAllEmployeesAttendance(dateParam)
      // 加载所有员工的销售数据（传入日期参数）
      await loadAllEmployeesSales(dateParam)
    }
  } catch (err) {
    logger.error('加载员工列表失败:', err)
    ElMessage.error('加载员工列表失败')
  } finally {
    employeesLoading.value = false
  }
}

// 加载所有员工的当月考勤统计
// monthParam 格式: "2025-01"，如果为空则使用当前月份
// 休假逻辑：每月休假天数从薪资模板读取，上个月没用完可以累积到本月
const loadAllEmployeesAttendance = async (monthParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employeeAttendanceData.value = new Map()
    return
  }

  try {
    let year: number
    let month: number

    if (monthParam) {
      const [y, m] = monthParam.split('-')
      year = parseInt(y)
      month = parseInt(m)
    } else {
      const now = TimeUtil.now()
      year = now.year()
      month = now.month() + 1
    }

    // 当前选择的月份范围（用于请假、加班统计）
    const daysInMonth = TimeUtil.endOf(TimeUtil.now().year(year).month(month - 1), 'month').date()
    const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const currentMonthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    // 查询范围：上个月 + 当前月（用于判断上月休假使用情况）
    let startDate: string
    const startMonth = month - 1
    if (startMonth <= 0) {
      // 跨年处理
      const prevYear = year - 1
      const prevMonth = startMonth + 12
      startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    } else {
      startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`
    }
    const endDate = currentMonthEnd

    // 获取所有考勤记录（查询2个月范围）
    const response = await attendanceApi.getAttendanceRecords({
      start_date: startDate,
      end_date: endDate,
      status: 'approved',
      limit: 1000
    })

    if (response.data) {
      const records = response.data?.records || response.data?.data || []

      // 按员工ID统计考勤数据
      const attendanceMap = new Map()
      const lastMonthRestMap = new Map() // 上个月实际使用的休假天数
      const lastMonthLeaveMap = new Map() // 上个月是否有请假
      const currentMonthUsedMap = new Map() // 当前月已使用的休假天数

      // 第一遍：统计上个月的休假使用情况和请假情况
      records.forEach((record: any) => {
        const recordDate = record.record_date || record.date || ''
        const isInLastMonth = recordDate < currentMonthStart

        if (isInLastMonth) {
          if (record.record_type === 'monthly_leave') {
            if (!lastMonthRestMap.has(record.employee_id)) {
              lastMonthRestMap.set(record.employee_id, 0)
            }
            const days = parseFloat(record.monthly_leave_days || 0)
            lastMonthRestMap.set(record.employee_id, lastMonthRestMap.get(record.employee_id) + days)
          } else if (record.record_type === 'leave') {
            // 标记该员工上月有请假
            lastMonthLeaveMap.set(record.employee_id, true)
          }
        }
      })

      // 第二遍：统计当前月的考勤数据
      records.forEach((record: any) => {
        const recordDate = record.record_date || record.date || ''
        const isInCurrentMonth = recordDate >= currentMonthStart && recordDate <= currentMonthEnd

        if (!attendanceMap.has(record.employee_id)) {
          attendanceMap.set(record.employee_id, {
            leave_days: 0,
            overtime_hours: 0,
            monthly_leave_days_used: 0, // 本月已用
            monthly_leave_days_available: 0 // 本月可用（含累积）
          })
        }
        const stats = attendanceMap.get(record.employee_id)

        if (isInCurrentMonth) {
          // 只统计当前月的请假和加班
          if (record.record_type === 'leave') {
            stats.leave_days += parseFloat(record.leave_days || 0)
          } else if (record.record_type === 'overtime') {
            const hours = parseFloat(record.overtime_hours || 0)
            stats.overtime_hours += hours
          } else if (record.record_type === 'monthly_leave') {
            // 当前月已使用的休假
            const days = parseFloat(record.monthly_leave_days || 0)
            stats.monthly_leave_days_used += days
            if (!currentMonthUsedMap.has(record.employee_id)) {
              currentMonthUsedMap.set(record.employee_id, 0)
            }
            currentMonthUsedMap.set(record.employee_id, currentMonthUsedMap.get(record.employee_id) + days)
          }
        }
      })

      // 第三遍：计算本月可用休假天数，并处理超出额度转为请假
      attendanceMap.forEach((stats, employeeId) => {
        // 从薪资模板获取每月休假天数
        const template = getTemplateById(getEmployeeTemplateId(employeeId))
        const monthlyRestDays = template?.rest_days || 2 // 默认2天

        // 统计2个月（当月+上月）的总休假天数
        let totalRestDays = 0
        records.forEach((record: any) => {
          if (record.employee_id === employeeId && record.record_type === 'monthly_leave') {
            totalRestDays += parseFloat(record.monthly_leave_days || 0)
          }
        })

        // 2个月的累积限额 = 月均天数 × 2
        const allowedRestDays = monthlyRestDays * 2

        // 超出部分转为请假
        if (totalRestDays > allowedRestDays) {
          const excessDays = totalRestDays - allowedRestDays
          stats.leave_days += excessDays // 超出部分加到请假天数
        }

        // 计算本月可用休假天数
        const lastMonthUsed = lastMonthRestMap.get(employeeId) || 0
        const hasLastMonthLeave = lastMonthLeaveMap.has(employeeId) && lastMonthLeaveMap.get(employeeId)

        let lastMonthRemaining = 0
        if (hasLastMonthLeave) {
          // 上月有请假，剩余额度为0
          lastMonthRemaining = 0
        } else {
          // 上月无请假，剩余额度 = 月均天数 - 上月已休天数
          lastMonthRemaining = Math.max(0, monthlyRestDays - lastMonthUsed)
        }

        // 本月可用休假 = 本月配额 + 上月剩余(最多等于配额)
        stats.monthly_leave_days_available = monthlyRestDays + Math.max(0, Math.min(lastMonthRemaining, monthlyRestDays))
        stats.monthly_leave_days_used = currentMonthUsedMap.get(employeeId) || 0
      })

      employeeAttendanceData.value = attendanceMap

      // 更新统计数据
      updateStats()
    }
  } catch (error) {
    logger.error('加载考勤统计失败:', error)
  }
}

// 加载所有员工的当月销售数据（含全新机和二手机）
// monthParam 格式: "2025-01"，如果为空则使用当前月份
const loadAllEmployeesSales = async (monthParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employeeSalesData.value = new Map()
    return
  }

  try {
    let year: number
    let month: number

    if (monthParam) {
      const [y, m] = monthParam.split('-')
      year = parseInt(y)
      month = parseInt(m)
    } else {
      const now = TimeUtil.now()
      year = now.year()
      month = now.month() + 1
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = TimeUtil.endOf(TimeUtil.now().year(year).month(month - 1), 'month').date()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    // 调用后端API获取员工销售数据
    const response = await salaryApi.records.getEmployeesSalesData(startDate, endDate)
    // unifiedApi 返回的已经是 response.data，所以直接用 response.data 获取数据
    const salesData = response.data || {}

    // 转换为Map格式
    const salesMap = new Map()

    // 为每个员工设置销售数据（如果没有销售记录则初始化为0）
    employees.value.forEach((emp: any) => {
      // 后端返回的键是字符串，需要用String(emp.id)来匹配
      const empSales = salesData[String(emp.id)] || {
        employee_id: emp.id,
        sales_count: 0,
        sales_amount: 0,
        total_profit: 0,
        new_count: 0,
        new_amount: 0,
        new_profit: 0,
        used_count: 0,
        used_amount: 0,
        used_profit: 0
      }

      // 兼容旧格式：如果没有 new_count/used_count，假设 sales_count 全部是全新机
      const hasNewFields = empSales.new_count !== undefined || empSales.used_count !== undefined
      const newCount = hasNewFields ? (parseInt(empSales.new_count) || 0) : (parseInt(empSales.sales_count) || 0)
      const usedCount = hasNewFields ? (parseInt(empSales.used_count) || 0) : 0
      const salesCount = newCount + usedCount
      const salesAmount = parseFloat(empSales.sales_amount) || 0
      const totalProfit = parseFloat(empSales.total_profit) || 0

      // 获取员工工资模板
      const template = getTemplateById(getEmployeeTemplateId(emp.id))

      // 计算提成（全新机和二手机分别计算，只有提成大于0的机型才统计）
      let commissionAmount = 0
      if (template) {
        if (template.commission_type === 'fixed') {
          const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0)
          const usedRate = parseFloat(template.commission_used_fixed || 0)
          // 只有当二手机提成大于0时，才统计二手机数量
          const countUsed = (usedRate > 0) ? usedCount : 0
          commissionAmount = (newCount * newRate) + (countUsed * usedRate)
        } else {
          commissionAmount = totalProfit * parseFloat(template.commission_percentage || 0) / 100
        }
      }

      // 获取考勤数据计算加班费
      const attendanceData = employeeAttendanceData.value.get(emp.id)
      const overtimeHours = attendanceData?.overtime_hours || 0
      const overtimePay = overtimeHours * parseFloat(template?.overtime_hourly_rate || 0)

      // 只有当二手机提成大于0时，才统计二手机数量
      const countUsed = (template?.commission_type === 'fixed' && parseFloat(template.commission_used_fixed || 0) > 0) ? usedCount : 0
      const displayCount = newCount + countUsed

      salesMap.set(emp.id, {
        sales_count: displayCount,  // 显示的销售数量（只统计有提成的机型）
        sales_amount: salesAmount,
        total_profit: totalProfit,
        new_count: newCount,
        new_amount: parseFloat(empSales.new_amount) || 0,
        new_profit: parseFloat(empSales.new_profit) || 0,
        used_count: usedCount,
        used_amount: parseFloat(empSales.used_amount) || 0,
        used_profit: parseFloat(empSales.used_profit) || 0,
        commission_amount: commissionAmount,
        overtime_hours: overtimeHours,
        overtime_pay: overtimePay
      })
    })

    employeeSalesData.value = salesMap

    // 更新统计数据
    updateStats()
  } catch (error) {
    // 销售数据加载失败不影响员工列表显示
    logger.error('加载销售数据失败:', error)
    // 出错时初始化为0
    const salesMap = new Map()
    employees.value.forEach((emp: any) => {
      salesMap.set(emp.id, {
        sales_count: 0,
        sales_amount: 0,
        total_profit: 0,
        new_count: 0,
        new_amount: 0,
        new_profit: 0,
        used_count: 0,
        used_amount: 0,
        used_profit: 0,
        commission_amount: 0,
        overtime_hours: 0,
        overtime_pay: 0
      })
    })
    employeeSalesData.value = salesMap
  }
}

// 计算请假扣款（当月底薪 ÷ 当月天数 × 请假天数）
const calculateLeaveDeduction = (employeeId: number, leaveDays: number) => {
  if (!leaveDays) return 0

  // 根据当前标签页获取选择的月份
  const monthStr = activeTab.value === 'payout' ? payoutMonth.value : employeeSalaryMonth.value
  const [year, month] = monthStr.split('-').map(Number)
  // new Date(year, month, 0) 会创建 year年month月0日，实际是 year年month-1月的最后一天
  // 所以要获取 month 月的天数，需要用 month + 1，然后取第0天
  const daysInMonth = new Date(year, month, 0).getDate()

  // 使用员工当前底薪（包含工龄涨薪）计算日薪
  const baseSalary = parseFloat(getEmployeeBaseSalary(employeeId)) || 0
  if (!baseSalary) return 0

  const dailySalary = baseSalary / daysInMonth

  // 请假扣款 = 日薪 × 请假天数
  return (dailySalary * leaveDays).toFixed(2)
}

// 计算加班费
const calculateOvertimePay = (employeeId: number, overtimeHours: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template || !overtimeHours) return 0
  const overtimeRate = template.overtime_hourly_rate || 0
  return (overtimeHours * overtimeRate).toFixed(2)
}

// 计算超出休假的扣款（由于loadAllEmployeesAttendance已将超出部分转为请假，此处返回0）
const calculateExcessRestDeduction = (employeeId: number, restDays: number) => {
  // 注意：超出的休假天数已在 loadAllEmployeesAttendance 中转为请假天数
  // 所以这里不再需要额外扣款，返回0
  return 0
}

// 获取模板设定的休假天数
const getTemplateRestDays = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  return template?.rest_days || 0
}

// 计算预计实发工资
const calculateEstimatedSalary = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template) return '-'

  const stats = getEmployeeAttendanceStats(employeeId)
  // 使用当前底薪（包含工龄涨薪）而不是模板的原始底薪
  const baseSalary = parseFloat(getEmployeeBaseSalary(employeeId)) || 0
  const overtimePay = parseFloat(String(calculateOvertimePay(employeeId, stats.overtime_hours))) || 0
  const leaveDeduction = parseFloat(String(calculateLeaveDeduction(employeeId, stats.leave_days))) || 0
  // 超出的休假天数已在 loadAllEmployeesAttendance 中转为请假天数，这里不再扣款
  const salesCommission = parseFloat(calculateSalesCommission(employeeId)) || 0

  const estimated = baseSalary + overtimePay + salesCommission - leaveDeduction

  // 检查是否为有效数字
  if (isNaN(estimated)) {
    return '-'
  }

  return estimated.toFixed(2)
}

// 获取员工模板ID
const getEmployeeTemplateId = (employeeId: number) => {
  const employee = employees.value.find(e => e.id === employeeId)
  return employee?.salary_template_id
}

// 获取员工考勤统计
const getEmployeeAttendanceStats = (employeeId: number) => {
  return employeeAttendanceData.value.get(employeeId) || {
    leave_days: 0,
    overtime_hours: 0,
    monthly_leave_days_used: 0,
    monthly_leave_days_available: 0
  }
}

// 获取员工销售统计
const getEmployeeSalesStats = (employeeId: number) => {
  return employeeSalesData.value.get(employeeId) || {
    sales_count: 0,
    sales_amount: 0,
    total_profit: 0,
    new_count: 0,
    new_amount: 0,
    new_profit: 0,
    used_count: 0,
    used_amount: 0,
    used_profit: 0
  }
}

// 计算工作天数（当月天数 - 请假天数）
// 注意：休假（monthly_leave）不影响工作天数计算
const calculateWorkDays = (employeeId: number) => {
  // 根据当前标签页获取选择的月份
  const monthStr = activeTab.value === 'payout' ? payoutMonth.value : employeeSalaryMonth.value
  const [year, month] = monthStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  const stats = getEmployeeAttendanceStats(employeeId)
  // 工作天数 = 当月天数 - 请假天数
  // 注意：休假（monthly_leave）不影响工作天数计算
  const workDays = daysInMonth - (stats.leave_days || 0)
  return Math.max(0, workDays)
}

// 计算销售提成（全新机和二手机分别计算，只有提成大于0的机型才统计）
const calculateSalesCommission = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  const salesStats = getEmployeeSalesStats(employeeId)

  if (!template || !salesStats.sales_count) return '0'

  const commissionType = template.commission_type || 'fixed'

  let commission = 0
  if (commissionType === 'fixed') {
    // 固定金额/台 - 分别计算全新机和二手机
    const newRate = template.commission_new_fixed || template.commission_fixed || 0
    const usedRate = template.commission_used_fixed || 0

    const newCount = salesStats.new_count || 0
    // 只有当二手机提成大于0时，才计算二手机提成
    const usedCount = (usedRate > 0) ? (salesStats.used_count || 0) : 0

    commission = (newCount * newRate) + (usedCount * usedRate)
  } else {
    // 利润百分比
    const percentage = template.commission_percentage || 0
    const totalProfit = salesStats.total_profit || 0
    commission = totalProfit * percentage / 100
  }

  return commission.toFixed(2)
}

// 获取员工有提成的机型数量（用于显示）
const getEmployeeCommissionCount = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  const salesStats = getEmployeeSalesStats(employeeId)

  if (!template) return 0

  const commissionType = template.commission_type || 'fixed'
  let count = 0

  if (commissionType === 'fixed') {
    const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0)
    const usedRate = parseFloat(template.commission_used_fixed || 0)

    // 只统计有提成的机型
    if (newRate > 0) count += (salesStats.new_count || 0)
    if (usedRate > 0) count += (salesStats.used_count || 0)
  } else {
    // 利润百分比模式：统计所有销售
    count = salesStats.sales_count || 0
  }

  return count
}

const resetEmployeeFilters = () => {
  employeeSearch.value = ''
  employeeTemplateFilter.value = undefined
  syncVisibleSalaryFilters()
}

// 员工薪资页面：月份变化处理
const handleEmployeeMonthChange = async () => {
  if (!canViewSalaryRecords.value) return

  // 重新加载员工数据（传入选择的月份，以便计算该月的工龄底薪）
  await loadEmployeeList(employeeSalaryMonth.value)
  // 重新加载考勤和销售数据（根据新选择的月份）
  await loadAllEmployeesAttendance(employeeSalaryMonth.value)
  await loadAllEmployeesSales(employeeSalaryMonth.value)
}

// 员工薪资页面：刷新数据
const handleRefreshEmployeeData = async () => {
  if (!canViewSalaryRecords.value) return

  await loadEmployeeList(employeeSalaryMonth.value)
  await loadAllEmployeesAttendance(employeeSalaryMonth.value)
  await loadAllEmployeesSales(employeeSalaryMonth.value)
}

// 获取模板相关信息的辅助方法
const getTemplateById = (id: number | undefined) => {
  if (!id) return null
  const template = templates.value.find(t => t.id === id)
  return template
}

const getTemplateName = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.name || '-'
}

// 获取员工底薪（使用实时计算的当前底薪，包含工龄涨薪）
const getEmployeeBaseSalary = (employeeId: number) => {
  const employee = employees.value.find((e: any) => e.id === employeeId)
  return employee?.current_salary || employee?.base_salary || '0'
}

// 获取员工工资发放状态
const getEmployeePayoutStatus = (employeeId: number) => {
  const record = payoutList.value.find((r: any) => r.employee_id === employeeId)
  return record?.status || null
}

// 获取员工工资记录
const getEmployeePayoutRecord = (employeeId: number) => {
  return payoutList.value.find((r: any) => r.employee_id === employeeId)
}

// 格式化结算时间（只显示年月日）
const formatPayoutTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取支付方式名称
const getPaymentMethodName = (method: string) => {
  const paymentMethodMap: Record<string, string> = {
    cash: '现金',
    bank_transfer: '银行转账',
    wechat: '微信支付',
    alipay: '支付宝',
    other: '其他'
  }
  return paymentMethodMap[method] || method || '-'
}

// 格式化工作天数（0或null显示为-）
const formatWorkDays = (days: any) => {
  // 转换为数字
  const numDays = Number(days)
  if (!numDays || numDays <= 0) return '-'
  // 如果是整数，去掉小数点
  return Number.isInteger(numDays) ? numDays : numDays.toFixed(1)
}

// 格式化请假天数（0显示为0，整数时不显示小数点）
const formatLeaveDays = (days: any) => {
  // 转换为数字
  const numDays = Number(days)
  if (isNaN(numDays) || numDays === null || numDays === undefined) return '0'
  // 如果是整数，去掉小数点
  return Number.isInteger(numDays) ? numDays : numDays.toFixed(1)
}

// 格式化加班时间（显示小时数）
const formatOvertimeHours = (hours: any) => {
  const numHours = Number(hours)
  if (!numHours || numHours <= 0) return '0小时'
  return `${numHours}小时`
}

// 格式化金额（整数不显示小数点，小数保留2位）
const formatAmount = (amount: any) => {
  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount === null || numAmount === undefined) return '0'
  // 如果是整数，直接返回
  if (Number.isInteger(numAmount)) return numAmount.toString()
  // 如果是小数，保留2位
  return numAmount.toFixed(2)
}

// 格式化工资月份（显示为 "2026-2月" 格式）
const formatSalaryMonth = (periodStart: string) => {
  if (!periodStart) return '-'
  const date = new Date(periodStart)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}-${month}月`
}

// 获取销售数量（优先使用 sales_count 字段）
const getSalesCount = (row: any) => {
  // 优先使用 sales_count 字段（新增字段）
  if (row.sales_count !== undefined && row.sales_count !== null) {
    return row.sales_count
  }
  // 备用方案：从 commission_detail JSON 字段解析
  if (row.commission_detail) {
    try {
      const details = JSON.parse(row.commission_detail)
      // commission_detail 是 details 数组，长度就是销售数量
      if (Array.isArray(details)) {
        return details.length
      }
      // 如果是对象且包含 count 字段
      if (details.count !== undefined) {
        return details.count
      }
    } catch (e) {
      logger.error('解析 commission_detail 失败:', e)
    }
  }
  // 如果都没有，返回 0
  return 0
}

// 月份变更处理
const handleMonthChange = async () => {
  if (!canViewSalaryRecords.value) return

  // 重新加载员工数据（传入选择的月份，以便计算该月的工龄底薪）
  await loadEmployeeList(payoutMonth.value)
  // 重新加载考勤和销售数据（根据新选择的月份）
  await loadAllEmployeesAttendance(payoutMonth.value)
  await loadAllEmployeesSales(payoutMonth.value)
  // 重新加载工资记录
  loadPayoutList()
}

// 工资发放：批量重算当月工资
const handleBulkRecalculatePayout = async () => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  if (!payoutMonth.value) {
    ElMessage.warning('请先选择月份')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    await ElMessageBox.confirm(
      `确认批量重算 ${payoutMonth.value} 全部员工工资？将覆盖历史记录`,
      '确认',
      { type: 'warning' }
    )

    payoutLoading.value = true
    const response = await salaryApi.records.recalculateMonth(startDate, endDate)
    const result = response.data
    ElMessage.success(`批量重算完成：成功 ${result.recalculated}/${result.total}`)

    await loadPayoutList()
    await loadAllEmployeesAttendance(payoutMonth.value)
    await loadAllEmployeesSales(payoutMonth.value)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量重算失败')
    }
  } finally {
    payoutLoading.value = false
  }
}

// 状态筛选变更处理
const handleFilterChange = () => {
  // 筛选由计算属性自动处理
}

// 我的工资：月份范围变更处理
const handleMyPeriodChange = () => {
  // 重置分页并加载数据
  myPagination.page = 1
  loadMyRecords()
}

// 临时存储计算数据，等待确认后保存
const pendingSalaryData = ref<any>(null)

// 关闭结算对话框并清空临时数据
const closeSettleDialog = () => {
  settleDialogVisible.value = false
  pendingSalaryData.value = null
}

const getCurrentDateTimeString = () => TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)

const normalizePaidAtDateTime = (value: string | null | undefined) => {
  if (!value) return null
  return value.length > 10 ? value : `${value} 00:00:00`
}

// 按员工结算工资
const handlePayoutByEmployee = async (employee: any) => {
  const existingRecord = getEmployeePayoutRecord(employee.id)
  if (!requireSalaryRecordPermission(existingRecord ? 'edit' : 'create')) {
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // period_end 是月底（统计当月所有数据）
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 使用后端计算 API（支持自动涨薪）
    let calculatedData: any
    try {
      const response = await salaryApi.calculateSalary(employee.id, startDate, endDate)
      calculatedData = response.data
    } catch (err: any) {
      logger.error('计算工资失败:', err)

      // 检查是否是模板错误（处理多种错误响应格式）
      const errorMessage = err.response?.data?.message || err.data?.message || err.message || ''
      if (errorMessage.includes('工资模板') || errorMessage.includes('template') || errorMessage.includes('关联')) {
        ElMessage.error(`无法结算：${employee.name || employee.username} 没有关联薪资模板，请先设置`)
      } else {
        ElMessage.error(`计算工资失败：${errorMessage}`)
      }
      return
    }

    // 检查是否已有记录
    let record = existingRecord

    // 临时存储计算的数据和员工信息，等待确认后保存
    pendingSalaryData.value = {
      employeeId: employee.id,
      employeeName: employee.name || employee.username,
      calculatedData: calculatedData,
      existingRecord: record,
      startDate: startDate,
      endDate: endDate
    }

    // 显示结算对话框，选择支付方式（此时还未保存到数据库）
    settleForm.value = {
      recordId: null, // 还没有保存，所以没有 recordId
      employeeId: employee.id,
      employeeName: employee.name || employee.username,
      netSalary: Number(calculatedData.net_salary || 0).toFixed(2),
      payment_method: record?.payment_method || '' // 预填充之前的支付方式
    }
    settleDialogVisible.value = true

  } catch (error) {
    logger.error('结算失败:', error)
    ElMessage.error('操作失败')
  }
}

// 确认结算
const confirmSettle = async () => {
  const action = (pendingSalaryData.value?.existingRecord || settleForm.value.recordId) ? 'edit' : 'create'
  if (!requireSalaryRecordPermission(action)) {
    return
  }

  if (canViewSalaryField('salary_salaryrecordsview', 'payment_method') && !settleForm.value.payment_method) {
    ElMessage.warning('请选择支付方式')
    return
  }

  // 如果没有待处理的数据，说明是已存在记录的结算（使用 recordId）
  if (!pendingSalaryData.value && !settleForm.value.recordId) {
    ElMessage.error('结算数据丢失，请重新操作')
    return
  }

  try {
    settleSaving.value = true

    // 情况1：新结算（有 pendingSalaryData）
    if (pendingSalaryData.value) {
      const { calculatedData, existingRecord } = pendingSalaryData.value
      const paymentMethod = settleForm.value.payment_method || existingRecord?.payment_method || null

      // 准备保存的数据
      const saveData = {
        ...calculatedData,
        status: existingRecord?.status === 'paid' ? 'paid' : 'approved',
        payment_method: paymentMethod
      }

      // 使用 UPSERT 接口保存
      const saveResponse = await salaryApi.saveCalculatedSalary(saveData)
      const savedRecord = saveResponse.data?.data

      if (!savedRecord) {
        ElMessage.error('保存工资记录失败')
        return
      }

      // 调用 markAsPaid 确保 paid_at 时间正确
      await salaryApi.records.markAsPaid(savedRecord.id, paymentMethod || undefined)

      ElMessage.success('结算成功')
      settleDialogVisible.value = false
      pendingSalaryData.value = null // 清空临时数据
      await loadPayoutList() // 等待列表刷新完成
    } else if (settleForm.value.recordId) {
      // 情况2：已有记录的结算（使用 recordId）
      const [year, month] = payoutMonth.value.split('-')
      const startDate = `${year}-${month}-01`
      const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
      const endDate = `${year}-${month}-${daysInMonth}`

      // 重新计算并覆盖保存，确保以最新数据为准
      const response = await salaryApi.calculateSalary(settleForm.value.employeeId, startDate, endDate)
      const calculatedData = response.data
      const existingRecord = getEmployeePayoutRecord(settleForm.value.employeeId)
      const paymentMethod = settleForm.value.payment_method || existingRecord?.payment_method || null

      const saveData = {
        ...calculatedData,
        status: existingRecord?.status === 'paid' ? 'paid' : 'approved',
        payment_method: paymentMethod
      }

      await salaryApi.saveCalculatedSalary(saveData)
      await salaryApi.records.markAsPaid(settleForm.value.recordId, paymentMethod || undefined)
      ElMessage.success('结算成功')
      settleDialogVisible.value = false
      await loadPayoutList() // 等待列表刷新完成
    }
  } catch (error) {
    logger.error('结算失败:', error)
    ElMessage.error('结算失败')
  } finally {
    settleSaving.value = false
  }
}

// 重新结算工资（使用最新的销售和考勤数据）
const handleRecalculatePayout = async (employee: any) => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!record) {
    ElMessage.error('未找到工资记录')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 重新计算工资
    const response = await salaryApi.calculateSalary(employee.id, startDate, endDate)
    const calculatedData = response.data

    // 保存数据，更新结算时间为当前时间
    const recordStatus = record.status === 'paid' ? 'paid' : 'approved'
    const saveData = {
      ...calculatedData,
      status: recordStatus,
      paid_at: recordStatus === 'paid' ? getCurrentDateTimeString() : null,
      payment_method: recordStatus === 'paid' ? (record.payment_method || null) : null
    }

    await salaryApi.saveCalculatedSalary(saveData)
    await loadPayoutList()
    ElMessage.success('重新结算成功，工资数据和结算时间已更新')
  } catch (err: any) {
    logger.error('重新结算失败:', err)
    ElMessage.error(err.response?.data?.message || '重新结算失败')
  }
}

// 按员工编辑工资
const handleEditPayoutByEmployee = (employee: any) => {
  const record = getEmployeePayoutRecord(employee.id)
  if (!requireSalaryRecordPermission(record ? 'edit' : 'create')) {
    return
  }

  if (record) {
    // 已有记录：编辑模式
    // 将 datetime 格式转换为 date 格式（用于 date 输入框）
    let paidAtDate = null
    if (record.paid_at) {
      const date = new Date(record.paid_at)
      paidAtDate = date.toISOString().slice(0, 10) // YYYY-MM-DD
    }

    editPayoutForm.value = {
      id: record.id,
      employee_id: record.employee_id,
      salary_template_id: record.salary_template_id || employee.salary_template_id || null,
      base_salary: record.base_salary || 0,
      commission_amount: record.commission_amount || 0,
      overtime_pay: record.overtime_pay || 0,
      leave_deduction: record.leave_deduction || 0,
      status: record.status || 'approved',
      paid_at: paidAtDate,
      payment_method: record.payment_method || null
    }
  } else {
    // 没有记录：新增模式，使用动态计算的数据
    const baseSalary = getEmployeeBaseSalary(employee.id)
    const commissionAmount = calculateSalesCommission(employee.id)
    const overtimePay = calculateOvertimePay(employee.id, getEmployeeAttendanceStats(employee.id).overtime_hours)
    const leaveDeduction = calculateLeaveDeduction(employee.id, getEmployeeAttendanceStats(employee.id).leave_days)

    editPayoutForm.value = {
      id: null,
      employee_id: employee.id,
      salary_template_id: employee.salary_template_id || null,
      base_salary: parseFloat(baseSalary) || 0,
      commission_amount: parseFloat(commissionAmount) || 0,
      overtime_pay: parseFloat(String(overtimePay)) || 0,
      leave_deduction: parseFloat(String(leaveDeduction)) || 0,
      status: 'approved',
      paid_at: null,
      payment_method: null
    }
  }
  editPayoutDialogVisible.value = true
}

// 保存编辑的工资
const handleSaveEditPayout = async () => {
  if (!requireSalaryRecordPermission(editPayoutForm.value.id ? 'edit' : 'create')) {
    return
  }

  try {
    editPayoutSaving.value = true

    // 计算应发工资
    const netSalary = calculateEditNetSalary()

    // 获取期间日期
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 获取员工统计数据
    const attendanceStats = getEmployeeAttendanceStats(editPayoutForm.value.employee_id)
    const existingRecord = editPayoutForm.value.id
      ? getEmployeePayoutRecord(editPayoutForm.value.employee_id)
      : null

    const saveData: any = {
      employee_id: editPayoutForm.value.employee_id,
      salary_template_id: editPayoutForm.value.salary_template_id || existingRecord?.salary_template_id || null,
      period_start: startDate,
      period_end: endDate,
      base_salary_adjustment: existingRecord?.base_salary_adjustment || 0,
      performance_bonus: existingRecord?.performance_bonus || 0,
      other_bonus: existingRecord?.other_bonus || 0,
      other_deduction: existingRecord?.other_deduction || 0,
    }

    if (canUseSalaryField('salary_salaryrecordsview', 'base_salary')) {
      saveData.base_salary = editPayoutForm.value.base_salary
    } else if (existingRecord) {
      saveData.base_salary = existingRecord.base_salary || 0
    } else {
      saveData.base_salary = editPayoutForm.value.base_salary
    }
    if (canUseSalaryField('salary_salaryrecordsview', 'commission_amount')) {
      saveData.commission_amount = editPayoutForm.value.commission_amount
    } else if (existingRecord) {
      saveData.commission_amount = existingRecord.commission_amount || 0
    } else {
      saveData.commission_amount = editPayoutForm.value.commission_amount
    }
    if (canUseSalaryField('salary_salaryrecordsview', 'overtime_pay')) {
      saveData.overtime_pay = editPayoutForm.value.overtime_pay
    } else if (existingRecord) {
      saveData.overtime_pay = existingRecord.overtime_pay || 0
    } else {
      saveData.overtime_pay = editPayoutForm.value.overtime_pay
    }
    saveData.overtime_hours = attendanceStats.overtime_hours ?? existingRecord?.overtime_hours ?? 0
    if (canUseSalaryField('salary_salaryrecordsview', 'leave_deduction')) {
      saveData.leave_deduction = editPayoutForm.value.leave_deduction
    } else if (existingRecord) {
      saveData.leave_deduction = existingRecord.leave_deduction || 0
    } else {
      saveData.leave_deduction = editPayoutForm.value.leave_deduction
    }
    saveData.leave_days = attendanceStats.leave_days ?? existingRecord?.leave_days ?? 0
    saveData.net_salary = netSalary
    if (canUseSalaryField('salary_salaryrecordsview', 'salary_status')) {
      saveData.status = editPayoutForm.value.status
    } else {
      saveData.status = existingRecord?.status || editPayoutForm.value.status || 'approved'
    }

    const isPaidStatus = saveData.status === 'paid'
    saveData.paid_at = isPaidStatus
      ? (
        canUseSalaryField('salary_salaryrecordsview', 'paid_at')
          ? (
            editPayoutForm.value.id
              ? normalizePaidAtDateTime(editPayoutForm.value.paid_at)
              : getCurrentDateTimeString()
          )
          : normalizePaidAtDateTime(existingRecord?.paid_at || editPayoutForm.value.paid_at) || getCurrentDateTimeString()
      )
      : null
    saveData.payment_method = isPaidStatus
      ? (
        canUseSalaryField('salary_salaryrecordsview', 'payment_method')
          ? (editPayoutForm.value.payment_method || null)
          : (existingRecord?.payment_method || editPayoutForm.value.payment_method || null)
      )
      : null

    // 使用 UPSERT 接口保存
    await salaryApi.saveCalculatedSalary(saveData)

    ElMessage.success(editPayoutForm.value.id ? '工资记录修改成功' : '工资记录创建成功')

    editPayoutDialogVisible.value = false
    loadPayoutList()
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    editPayoutSaving.value = false
  }
}

// 删除工资记录
const handleDeletePayout = async (employee: any) => {
  if (!requireSalaryRecordPermission('delete')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!record) return

  try {
    await ElMessageBox.confirm(`确认删除 ${employee.name || employee.username} 的工资记录？此操作不可恢复！`, '警告', {
      type: 'warning',
      customClass: 'message-box-purple'
    })
    await salaryApi.records.deleteSalaryRecord(record.id)
    ElMessage.success('删除成功')
    loadPayoutList()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const getTemplateBaseSalary = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template ? `¥${template.base_salary}` : '-'
}

const getTemplateCommissionType = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_type || 'fixed'
}

const getTemplateCommissionFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_fixed || 0
}

const getTemplateCommissionNewFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  // 优先使用新字段，如果没有则使用旧字段
  return template?.commission_new_fixed || template?.commission_fixed || 0
}

const getTemplateCommissionUsedFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_used_fixed || 0
}

const getTemplateCommissionPercentage = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_percentage || 0
}

const getTemplateOvertimeRate = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.overtime_hourly_rate || 0
}

const getTemplateLeaveRate = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.leave_daily_deduction || 0
}

// 编辑员工工资模板
const handleEditEmployeeTemplate = (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  currentEmployee.value = row
  selectedTemplateId.value = row.salary_template_id || undefined
  templateDialogVisible.value = true
}

// 保存员工工资模板
const handleSaveEmployeeTemplate = async () => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  if (!canEditSalaryField('salary_salaryrecordsview', 'salary_template_name')) {
    salaryTemplatePermissions.handleNoPermission('edit')
    return
  }

  if (!currentEmployee.value) return

  try {
    // 使用工资模板API，需要工资管理权限
    await salaryTemplateApi.setEmployeeTemplate(
      currentEmployee.value.id,
      selectedTemplateId.value || null
    )
    ElMessage.success('工资模板设置成功')
    templateDialogVisible.value = false
    // 根据当前标签页传递正确的月份参数
    const monthParam = activeTab.value === 'employees' ? employeeSalaryMonth.value : payoutMonth.value
    await loadEmployeeList(monthParam)
  } catch (error) {
    ElMessage.error('设置失败')
  }
}

// ========== 考勤记录相关 ==========
// 考勤记录对话框
const attendanceDialogVisible = ref(false)
const attendanceRecords = ref<any[]>([])
const attendanceLoading = ref(false)
const currentAttendanceEmployee = ref<any>(null)
const attendanceFormVisible = ref(false)
const attendanceSaving = ref(false)
const attendanceDialogTitle = ref('新增考勤记录')
const editingAttendanceId = ref<number | null>(null) // 正在编辑的考勤记录ID
const attendanceForm = ref<AttendanceRecord>({
  record_date: '',
  record_type: 'leave',
  leave_type: '事假',
  leave_days: 1,
  overtime_hours: 1,
  monthly_leave_days: 1,
  reason: '',
  status: 'approved' // 管理端默认添加为已通过
})

// 考勤类型变更处理
const handleAttendanceTypeChange = () => {
  // 类型变更时重置日期
  attendanceForm.value.record_date = TimeUtil.nowFormatted(TIME_FORMATS.DATE)
}

// 打开员工考勤记录对话框
const handleViewAttendance = async (row: any) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  currentAttendanceEmployee.value = row
  // 清空之前的数据
  attendanceRecords.value = []
  attendanceDialogVisible.value = true
  await loadEmployeeAttendance(row.id)
}

// 加载员工考勤记录
const loadEmployeeAttendance = async (employeeId: number) => {
  if (!canViewSalaryRecords.value) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  try {
    // 使用当前选择的月份（员工薪资页面的月份选择）
    const [year, month] = employeeSalaryMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // 获取当月的最后一天
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    const response = await attendanceApi.getAttendanceRecords({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate
    })

    if (response.data) {
      // unifiedApi 返回的是 response.data
      attendanceRecords.value = response.data?.records || response.data?.data || []
    }
  } catch (error) {
    logger.error('[员工考勤] 加载失败:', error)
    ElMessage.error('加载考勤记录失败')
  } finally {
    attendanceLoading.value = false
  }
}

// 打开新增考勤记录对话框
const handleAddAttendance = () => {
  if (!requireSalaryRecordPermission('create')) {
    return
  }

  editingAttendanceId.value = null // 清空编辑ID，表示新增模式
  attendanceDialogTitle.value = '新增考勤记录'
  attendanceForm.value = {
    record_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    record_type: 'leave',
    leave_type: '事假',
    leave_days: 1,
    overtime_hours: 2,
    monthly_leave_days: 1,
    reason: '',
    status: 'approved'
  }
  attendanceFormVisible.value = true
}

// 打开编辑考勤记录对话框
const handleEditAttendance = (row: any) => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  editingAttendanceId.value = row.id // 设置编辑ID
  attendanceDialogTitle.value = '编辑考勤记录'
  attendanceForm.value = {
    record_date: row.record_date,
    record_type: row.record_type,
    leave_type: row.leave_type || '事假',
    leave_days: row.leave_days || 0,
    overtime_hours: row.overtime_hours || 0,
    monthly_leave_days: row.monthly_leave_days || 0,
    reason: row.reason || '',
    status: row.status
  }
  attendanceFormVisible.value = true
}

// 快捷新增考勤记录
const handleQuickAdd = (type: 'overtime' | 'monthly_leave' | 'leave') => {
  if (!requireSalaryRecordPermission('create')) {
    return
  }

  editingAttendanceId.value = null // 清空编辑ID，表示新增模式
  const typeLabels: Record<string, string> = {
    overtime: '加班',
    monthly_leave: '休假',
    leave: '请假'
  }
  attendanceDialogTitle.value = `新增${typeLabels[type]}记录`
  attendanceForm.value = {
    record_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    record_type: type,
    leave_type: type === 'leave' ? '事假' : '',
    leave_days: type === 'leave' ? 1 : 0,
    overtime_hours: type === 'overtime' ? 2 : 0,
    monthly_leave_days: type === 'monthly_leave' ? 1 : 0,
    reason: '',
    status: 'approved'
  }
  attendanceFormVisible.value = true
}

// 保存考勤记录（支持新增和编辑）
const handleSaveAttendance = async () => {
  if (!requireSalaryRecordPermission(editingAttendanceId.value ? 'edit' : 'create')) {
    return
  }

  if (!currentAttendanceEmployee.value) return

  // 验证必填字段
  if (!attendanceForm.value.record_date) {
    ElMessage.warning('请选择记录日期')
    return
  }

  attendanceSaving.value = true
  try {
    const recordType = attendanceForm.value.record_type || 'leave'
    const recordDate = attendanceForm.value.record_date || TimeUtil.nowFormatted(TIME_FORMATS.DATE)
    const recordStatus = attendanceForm.value.status || 'approved'

    // 根据记录类型构建提交数据
    let submitData: any = {
      employee_id: currentAttendanceEmployee.value.id,
      record_type: recordType,
      record_date: recordDate,
      status: recordStatus
    }

    switch (recordType) {
      case 'monthly_leave':
        submitData.monthly_leave_days = attendanceForm.value.monthly_leave_days
        if (!submitData.monthly_leave_days || submitData.monthly_leave_days <= 0) {
          ElMessage.warning('请输入休假天数')
          return
        }
        break
      case 'leave':
        submitData.leave_type = attendanceForm.value.leave_type || '事假'
        submitData.leave_days = attendanceForm.value.leave_days
        submitData.leave_reason = attendanceForm.value.reason || '管理端手动添加'
        if (!submitData.leave_type) {
          ElMessage.warning('请选择请假类型')
          return
        }
        if (!submitData.leave_days || submitData.leave_days <= 0) {
          ElMessage.warning('请输入请假天数')
          return
        }
        break
      case 'overtime':
        submitData.overtime_hours = attendanceForm.value.overtime_hours
        submitData.overtime_reason = attendanceForm.value.reason || '管理端手动添加'
        if (!submitData.overtime_hours || submitData.overtime_hours <= 0) {
          ElMessage.warning('请输入加班时长')
          return
        }
        break
    }

    // 根据是否有编辑ID判断是新增还是编辑
    const isEdit = !!editingAttendanceId.value

    if (isEdit) {
      // 编辑模式：调用更新API
      await attendanceApi.updateAttendanceRecord(editingAttendanceId.value, submitData)
    } else {
      // 新增模式：调用创建API
      await attendanceApi.createAttendanceRecord(submitData)
    }

    const typeLabels: Record<string, string> = {
      monthly_leave: '休假',
      leave: '请假',
      overtime: '加班'
    }
    ElMessage.success(`${typeLabels[attendanceForm.value.record_type]}记录${isEdit ? '修改' : '添加'}成功`)

    // 关闭对话框并清除编辑ID
    attendanceFormVisible.value = false
    editingAttendanceId.value = null

    // 重新加载考勤记录
    await loadEmployeeAttendance(currentAttendanceEmployee.value.id)

    // 同时刷新考勤统计数据
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)

    // 刷新销售数据
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } catch (error) {
    ElMessage.error(`${editingAttendanceId.value ? '修改' : '添加'}失败`)
  } finally {
    attendanceSaving.value = false
  }
}

// 删除考勤记录
const handleDeleteAttendance = async (id: number) => {
  if (!requireSalaryRecordPermission('delete')) {
    return
  }

  try {
    await ElMessageBox.confirm('确认删除此考勤记录？', '警告')
    await attendanceApi.deleteAttendanceRecord(id)
    ElMessage.success('删除成功')
    if (currentAttendanceEmployee.value) {
      loadEmployeeAttendance(currentAttendanceEmployee.value.id)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 获取考勤类型文本
const getAttendanceTypeText = (type: string) => {
  const map: Record<string, string> = {
    monthly_leave: '休假',
    leave: '请假',
    overtime: '加班'
  }
  return map[type] || type
}

// 获取考勤类型标签样式
	type ValidTagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'
	const getAttendanceTypeTag = (type: string): ValidTagType => {
	  const map: Record<string, ValidTagType> = {
	    monthly_leave: 'success',
	    leave: 'warning',
	    overtime: 'primary'
	  }
	  return map[type] || 'info'
	}

// 模板操作
// 新增工资模板
const handleAddTemplate = () => {
  if (!requireSalaryTemplatePermission('create')) {
    return
  }

  templateForm.value = {
    id: undefined,
    name: '',
    description: '',
    base_salary: 2500,
    commission_type: 'fixed',
    commission_fixed: 20,
    commission_percentage: 10,
    overtime_hourly_rate: 10,
    rest_days: 2,
    // 自动涨薪规则
    auto_raise_enabled: false,
    auto_raise_months: 6,
    auto_raise_amount: 100,
    auto_raise_max_salary: 3000
  }
  templateFormDialogVisible.value = true
}

// 编辑工资模板
const handleEditTemplate = (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  // 解析自动涨薪规则
  let autoRaiseEnabled = false
  let autoRaiseMonths = 6
  let autoRaiseAmount = 100
  let autoRaiseMaxSalary = 3000

  if (row.auto_raise_rule) {
    try {
      const rule = typeof row.auto_raise_rule === 'string'
        ? JSON.parse(row.auto_raise_rule)
        : row.auto_raise_rule
      autoRaiseEnabled = rule.enabled || false
      autoRaiseMonths = rule.months || 6
      autoRaiseAmount = rule.amount || 100
      autoRaiseMaxSalary = rule.max_salary || 3000
    } catch (e) {
      // 忽略异常，使用默认值
    }
  }

  templateForm.value = {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    base_salary: row.base_salary || 0,
    commission_type: row.commission_type || 'fixed',
    commission_fixed: row.commission_fixed || 0,
    commission_new_fixed: row.commission_new_fixed || row.commission_fixed || 20,
    commission_used_fixed: row.commission_used_fixed || 0,
    commission_percentage: row.commission_percentage || 0,
    overtime_hourly_rate: row.overtime_hourly_rate || 0,
    rest_days: row.rest_days || 2,
    // 自动涨薪规则
    auto_raise_enabled: autoRaiseEnabled,
    auto_raise_months: autoRaiseMonths,
    auto_raise_amount: autoRaiseAmount,
    auto_raise_max_salary: autoRaiseMaxSalary
  }
  templateFormDialogVisible.value = true
}

// 保存工资模板
const handleSaveTemplate = async () => {
  if (!requireSalaryTemplatePermission(templateForm.value.id ? 'edit' : 'create')) {
    return
  }

  try {
    templateSaving.value = true

    // 构建保存数据
    const saveData: any = {}

    if (canUseSalaryField('salary_salarytemplatesview', 'template_name')) {
      saveData.name = templateForm.value.name
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_description')) {
      saveData.description = templateForm.value.description
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_base_salary')) {
      saveData.base_salary = templateForm.value.base_salary
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_type')) {
      saveData.commission_type = templateForm.value.commission_type
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_new_fixed')) {
      saveData.commission_new_fixed = templateForm.value.commission_new_fixed
      saveData.commission_fixed = templateForm.value.commission_new_fixed
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_used_fixed')) {
      saveData.commission_used_fixed = templateForm.value.commission_used_fixed
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_percentage')) {
      saveData.commission_percentage = templateForm.value.commission_percentage
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate')) {
      saveData.overtime_hourly_rate = templateForm.value.overtime_hourly_rate
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_rest_days')) {
      saveData.rest_days = templateForm.value.rest_days || 2
    }

    // 构建自动涨薪规则
    if (canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled')) {
      if (templateForm.value.auto_raise_enabled) {
        saveData.auto_raise_rule = JSON.stringify({
          enabled: true,
          months: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_months') ? templateForm.value.auto_raise_months : 6,
          amount: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_amount') ? templateForm.value.auto_raise_amount : 100,
          max_salary: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_max_salary') ? templateForm.value.auto_raise_max_salary : templateForm.value.base_salary
        })
      } else {
        saveData.auto_raise_rule = null
      }
    }

    if (templateForm.value.id) {
      // 更新
      await salaryTemplateApi.updateTemplate(templateForm.value.id, saveData)
      ElMessage.success('模板更新成功')
    } else {
      // 新增
      await salaryTemplateApi.createTemplate(saveData)
      ElMessage.success('模板创建成功')
    }

    templateFormDialogVisible.value = false
    loadTemplates()
  } catch (err: any) {
    logger.error('保存模板失败:', err)
    ElMessage.error(err.message || '保存失败')
  } finally {
    templateSaving.value = false
  }
}

const handleSetDefault = async (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认将 "${row.name}" 设为默认模板？`, '确认', {
      customClass: 'message-box-purple'
    })
    await salaryTemplateApi.setAsDefault(row.id)
    ElMessage.success('设置成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('设置失败')
    }
  }
}

const handleToggleTemplateStatus = async (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  try {
    const newStatus = !row.is_active
    const actionText = newStatus ? '启用' : '禁用'
    await ElMessageBox.confirm(`确认${actionText}模板 "${row.name}"？`, '确认', {
      customClass: 'message-box-purple'
    })
    await salaryTemplateApi.updateTemplate(row.id, { is_active: newStatus })
    ElMessage.success(`${actionText}成功`)
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

// 格式化数字（千分位）
const formatNumber = (num: number | string): string => {
  const number = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(number)) return '0'
  return number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// 获取使用指定模板的员工数量
const getEmployeeCountByTemplate = (templateId: number): number => {
  if (!employees.value || employees.value.length === 0) return 0
  return employees.value.filter((emp: any) => emp.salary_template_id === templateId).length
}

const handleDeleteTemplate = async (row: any) => {
  if (!requireSalaryTemplatePermission('delete')) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除模板 "${row.name}"？`, '警告', {
      type: 'warning',
      customClass: 'message-box-purple'
    })
    await salaryTemplateApi.deleteTemplate(row.id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 工资记录操作
const handleViewMyRecord = (row: any) => {
  if (!canViewPayoutRecords.value) {
    error('您没有查看工资发放记录的权限')
    return
  }

  currentRecord.value = row
  detailDialogVisible.value = true
}

// 删除的函数 - handleApproveRecord (已移除工资记录tab)

// 工资发放操作
const loadPayoutList = async () => {
  if (!canViewSalaryRecords.value) {
    payoutList.value = []
    return
  }

  if (!payoutMonth.value) {
    payoutList.value = []
    return
  }

  payoutLoading.value = true
  try {
    // 获取当月所有员工工资记录（不筛选状态，状态筛选由计算属性处理）
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    const response = await salaryApi.getSalaryRecords({
      period_start: startDate,
      period_end: endDate
    })

    if (response.data) {
      payoutList.value = response.data.records || []
    }
  } catch (error) {
    logger.error('加载工资发放列表失败:', error)
    ElMessage.error('加载工资发放列表失败')
  } finally {
    payoutLoading.value = false
  }
}

const handleViewPayout = (row: any) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  currentRecord.value = row
  detailDialogVisible.value = true
}

// TAB 切换
const handleTabChange = async (tabName: string) => {
  if (mobileExpandedTemplateId.value) {
    const previous = filteredTemplates.value.find((item: any) => item.id === mobileExpandedTemplateId.value)
    if (previous) {
      templateTableRef.value?.toggleRowExpansion(previous, false)
    }
    mobileExpandedTemplateId.value = null
  }
  lastTappedTemplateId.value = null
  lastTemplateTapTimestamp.value = 0

  if (tabName === 'templates') {
    if (!canViewSalaryTemplates.value) return
    loadTemplates()
  } else if (tabName === 'employees') {
    if (!canViewSalaryRecords.value) return
    // 员工薪资：加载用户选择的月份的实时数据
    await loadEmployeeList(employeeSalaryMonth.value)
    await loadTemplates()
    // 根据选择的月份加载考勤和销售数据（实时数据）
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } else if (tabName === 'payout') {
    if (!canViewSalaryRecords.value) return
    // 工资发放：根据用户选择的月份加载数据
    await loadEmployeeList(payoutMonth.value)
    // 根据选择的月份加载考勤和销售数据
    await loadAllEmployeesAttendance(payoutMonth.value)
    await loadAllEmployeesSales(payoutMonth.value)
    // 加载工资记录
    loadPayoutList()
  } else if (tabName === 'my') {
    if (!canViewPayoutRecords.value) return
    await Promise.all([loadMyRecords(), loadMyStats()])
  }
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    if (activeTab.value === 'templates') {
      await loadTemplates()
    } else if (activeTab.value === 'employees') {
      await Promise.all([loadEmployeeList(employeeSalaryMonth.value), loadTemplates()])
    } else if (activeTab.value === 'payout') {
      await loadTemplates()
      if (payoutMonth.value) {
        await loadPayoutList()
      }
    } else if (activeTab.value === 'my') {
      await Promise.all([loadMyRecords(), loadMyStats()])
    }
  })
  success('数据刷新成功', { duration: 2000 })
}

onMounted(async () => {
  if (!canAccessSalaryPage.value) {
    return
  }

  await initFieldPermissions()
  syncVisibleSalaryFilters()

  if (canViewSalaryTemplates.value) {
    activeTab.value = 'templates'
    await loadTemplates()
    if (canViewSalaryRecords.value) {
      const currentMonth = payoutMonth.value || employeeSalaryMonth.value
      await loadEmployeeList(currentMonth)
    }
  } else if (canViewSalaryRecords.value) {
    activeTab.value = 'employees'
    const currentMonth = payoutMonth.value || employeeSalaryMonth.value
    await loadEmployeeList(currentMonth)
  } else if (canViewPayoutRecords.value) {
    activeTab.value = 'my'
    await Promise.all([loadMyRecords(), loadMyStats()])
  }
})

// 监听标签切换，自动刷新数据（确保显示最新的考勤、销售等数据）
// 注意：handleTabChange 已经处理了数据加载，这里只需要在用户手动切换标签时补充刷新
// 使用一个标志避免重复加载
const isLoadingData = ref(false)

watch(activeTab, async (newTab, oldTab) => {
  // 避免在页面加载时重复触发（oldTab 为空表示首次加载）
  if (!oldTab || isLoadingData.value) {
    return
  }

  if (newTab === 'employees') {
    if (!canViewSalaryRecords.value) return
    // 切换到员工薪资标签时，自动刷新考勤和销售数据
    isLoadingData.value = true
    try {
      await loadAllEmployeesAttendance(employeeSalaryMonth.value)
      await loadAllEmployeesSales(employeeSalaryMonth.value)
    } finally {
      isLoadingData.value = false
    }
  } else if (newTab === 'payout') {
    if (!canViewSalaryRecords.value) return
    // 切换到工资发放标签时，自动刷新考勤和销售数据
    isLoadingData.value = true
    try {
      await loadAllEmployeesAttendance(payoutMonth.value)
      await loadAllEmployeesSales(payoutMonth.value)
      loadPayoutList()
    } finally {
      isLoadingData.value = false
    }
  }
})
</script>

<style lang="scss" scoped>
/* 页面容器 */
.page-container {
  padding: 20px;
}

/* 按钮样式 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: white;
  color: #667eea;
  border-color: white;
}

.btn-outline-secondary {
  background: white;
  color: #606266;
  border-color: #dcdfe6;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #f5f7fa;
  color: #409eff;
  border-color: #c6e2ff;
}

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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.success {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%);
}

.stat-icon.danger {
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.stat-desc {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 2px;
}

/* TAB 样式 */
.salary-tabs {
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
  align-items: center;
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.filter-item label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.filter-item .el-select,
.filter-item .el-date-picker,
.filter-item .el-input {
  min-width: 140px;
}

.filter-item.actions {
  margin-left: auto;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
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

/* 操作按钮容器 - 确保按钮在一行内并排显示 */
.operation-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
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

/* 金额文本样式 */
.amount-text {
  color: #67c23a;
  font-weight: 600;
}

.net-salary {
  color: #67c23a;
  font-weight: 700;
  font-size: 16px;
}

.net-salary-large {
  color: #67c23a;
  font-weight: 700;
  font-size: 20px;
}

.amount {
  color: #67c23a;
  font-weight: 500;
}

.amount-deduct {
  color: #f56c6c;
  font-weight: 500;
}

.income-detail,
.deduction-detail {
  font-size: 12px;
  line-height: 1.6;
}

.rate-info {
  font-size: 12px;
  line-height: 1.5;
}

.rate-label {
  color: #909399;
  margin-right: 4px;
}

.period-text,
.work-days {
  color: #606266;
  font-size: 13px;
}

/* 操作按钮样式 */
.data-table :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 6px;
  transition: all 0.3s;
  margin: 0 2px;
}

.data-table :deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.data-table :deep(.el-button--primary) {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border: none;
  color: white;
}

.data-table :deep(.el-button--success) {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  border: none;
  color: white;
}

.data-table :deep(.el-button--danger) {
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
  border: none;
  color: white;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-state p {
  font-size: 16px;
  margin: 0;
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

// 工资模块统一弹窗样式

:deep(.salary-dialog .el-dialog__body) {
  background: #ffffff !important;
  color: #303133;
  padding: 24px;
}

:deep(.salary-dialog .el-dialog__footer) {
  background: #fafafa !important;
  border-top: 1px solid #f0f0f0;
  padding: 16px 24px;
  border-radius: 0 0 12px 12px;
}

:deep(.salary-dialog-large .el-dialog) {
  max-width: min(1180px, calc(100vw - 32px)) !important;
}

.employee-template-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.form-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.template-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.template-detail {
  font-size: 12px;
  color: #909399;
}

.template-preview {
  margin-top: 10px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.preview-label {
  color: #606266;
}

.preview-value {
  color: #303133;
  font-weight: 500;
}

/* 员工信息单元格样式 */
.employee-info-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-username {
  font-size: 12px;
  color: #909399;
}

/* 员工信息单行显示 */
.employee-info-inline {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.commission-info {
  font-size: 12px;
  line-height: 1.5;
}

.commission-label,
.commission-value {
  display: inline-block;
}

.commission-label {
  color: #909399;
  margin-right: 4px;
}

.commission-value {
  color: #303133;
  font-weight: 500;
}

.text-muted {
  color: #c0c4cc;
}

/* 员工信息样式 */
.employee-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.employee-name {
  font-weight: 500;
  color: #303133;
}

.template-name {
  font-size: 12px;
  color: #909399;
}

/* 按钮样式 */
.btn-success {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  border: none;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #85ce61 0%, #67c23a 100%);
}

.attendance-actions {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

/* 考勤单元格样式 */
.attendance-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.rest-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.amount-deduction {
  font-size: 11px;
  color: #f56c6c;
  font-weight: 500;
}

.amount-overtime {
  font-size: 11px;
  color: #67c23a;
  font-weight: 500;
}

/* 表单样式 */
.form-section {
  margin-bottom: 24px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  padding-bottom: 8px;
  border-bottom: 2px solid #e4e7ed;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #595959;
  font-size: 14px;
}

.required {
  color: #ff4d4f;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: #40a9ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.form-control::placeholder {
  color: #bfbfbf;
}

textarea.form-control {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

/* 单选框组样式 */
.radio-group {
  display: flex;
  gap: 24px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #595959;
}

.radio-label input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.radio-label input[type="radio"]:checked {
  accent-color: #1890ff;
}

/* 开关样式 */
.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #1890ff;
}

input:checked + .slider:before {
  transform: translateX(22px);
}

/* 分隔线样式 */
.divider {
  margin: 24px 0;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
  text-align: left;
}

.divider span {
  color: #8c8c8c;
  font-size: 13px;
  font-weight: 500;
}

.divider i {
  margin-right: 6px;
}

/* 按钮样式 */
.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
}

.btn-secondary {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #595959;
}

.btn-secondary:hover {
  color: #40a9ff;
  border-color: #40a9ff;
}

.btn-primary {
  background: #1890ff;
  color: white;
}

.btn-primary:hover {
  background: #40a9ff;
}

.btn-primary:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}

/* 表单提示文字 */
.form-tip {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.5;
}

/* 详情视图样式 - 美化版 */
.detail-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  background: linear-gradient(135deg, #f8f9fc 0%, #f0f2f8 100%);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #e8ecf1;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
}

// 网格布局（基本信息区域）
.detail-section-grid {
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .detail-row {
    margin-bottom: 0;
  }
}

.detail-section h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  padding-bottom: 10px;
  border-bottom: 2px solid #e8ecf1;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    width: 4px;
    height: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 2px;
  }
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: white;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid #f0f2f5;
  transition: all 0.2s ease;

  &:hover {
    background: #fafbff;
    border-color: #e0e6ed;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.detail-row.full {
  flex-direction: column;
  align-items: flex-start;
}

.detail-row.highlight {
  background: linear-gradient(135deg, #fff8f0 0%, #fff0e6 100%);
  padding: 16px;
  border-radius: 12px;
  margin-top: 12px;
  border: 1px solid #ffd8a8;
  box-shadow: 0 4px 12px rgba(255, 153, 51, 0.15);

  .label {
    color: #d46b08;
    font-weight: 600;
  }

  .net-salary-large {
    background: linear-gradient(135deg, #ff6b35 0%, #f7931a 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 28px;
    font-weight: 700;
  }
}

.detail-row .label {
  font-weight: 500;
  color: #64748b;
  font-size: 14px;
  min-width: 100px;
}

.detail-row .value {
  color: #262626;
  text-align: right;
}

.net-salary-large {
  font-size: 24px;
  font-weight: 600;
  color: #ff4d4f;
}

/* 标签样式 - 美化版 */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tag-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;

  &::before {
    content: '⏱';
    margin-right: 6px;
    font-size: 11px;
  }
}

.tag-success {
  background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%);
  color: white;
  border: none;

  &::before {
    content: '✓';
    margin-right: 6px;
    font-size: 12px;
    font-weight: 700;
  }
}

/* 结算信息样式 */
.settle-info {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.settle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.settle-row .label {
  font-weight: 500;
  color: #595959;
}

.settle-row .value {
  font-size: 16px;
  font-weight: 500;
  color: #262626;
}

.settle-row .value.amount {
  font-size: 24px;
  font-weight: 600;
  color: #ff4d4f;
}

/* 模板预览样式 */
.template-preview-box {
  background: #f0f5ff;
  border: 1px solid #adc6ff;
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
}

.template-preview-box h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #2f54eb;
}

.template-preview-box .preview-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.template-preview-box .preview-label {
  color: #595959;
  font-size: 14px;
}

.template-preview-box .preview-value {
  color: #262626;
  font-weight: 500;
  font-size: 14px;
}

/* 考勤操作栏 */
.attendance-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.attendance-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-success {
  background: #52c41a;
  color: white;
}

.btn-success:hover {
  background: #73d13d;
}

.btn-warning {
  background: #faad14;
  color: white;
}

.btn-warning:hover {
  background: #ffc53d;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #8c8c8c;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

/* 预计工资样式 */
.estimated-salary {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
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

  .stat-desc {
    margin-top: 4px;
    font-size: 10px;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
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

  .filter-item.actions .btn {
    flex: 1;
    justify-content: center;
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

  .stat-desc {
    font-size: 9px;
  }
}

/* Element Plus 组件样式已移除 - 所有模态框已使用自定义样式 */

/* 销售明细样式 */
.sales-detail-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-info-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.detail-info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-info-item .label {
  font-size: 13px;
  color: #909399;
}

.detail-info-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.detail-info-item .value.highlight {
  color: #67c23a;
}

.detail-info-item .value.highlight-blue {
  color: #409eff;
}

.detail-info-item .value.highlight-green {
  color: #67c23a;
}

.sales-table-wrapper {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.sales-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.sales-table thead {
  background: #fafafa;
}

.sales-table th {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
  white-space: nowrap;
}

.sales-table td {
  padding: 12px 8px;
  text-align: center;
  border-bottom: 1px solid #ebeef5;
  color: #606266;
}

.sales-table tbody tr:last-child td {
  border-bottom: none;
}

.sales-table tbody tr:hover {
  background: #f5f7fa;
}

.sales-table .imei {
  color: #606266;
}

.sales-table .price {
  font-weight: 600;
  color: #303133;
}

.sales-table-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  background: #fafafa;
  border-top: 1px solid #ebeef5;
  gap: 24px;
}

/* 工资详情表格样式 */
.salary-detail-table-section {
  margin: 20px 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 20px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #e4e7ed;
}

.salary-detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.salary-detail-table tbody tr {
  border-bottom: 1px solid #ebeef5;
}

.salary-detail-table tbody tr:last-child {
  border-bottom: none;
}

.salary-detail-table tbody tr:hover {
  background: #f8f9fa;
}

.salary-detail-table td.label {
  padding: 12px 16px;
  font-weight: 500;
  color: #606266;
  background: #fafafa;
  width: 120px;
  border-right: 1px solid #ebeef5;
}

.salary-detail-table td.value {
  padding: 12px 16px;
  color: #303133;
  font-weight: 500;
}

.salary-detail-table td.value.highlight {
  color: #67c23a;
  font-weight: 600;
}

.salary-detail-table td.value.net-salary {
  color: #f56c6c;
  font-weight: 600;
  font-size: 16px;
}

.sales-summary-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.sales-summary-item .label {
  color: #909399;
}

.sales-summary-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.sales-summary-item .value.highlight {
  color: #67c23a;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ==================== 销售明细对话框样式（参考供应商打款页面） ==================== */

.sales-details {
  // 汇总信息区域
  .details-info {
    background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid #e4e7ed;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: nowrap;

    .info-row {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 6px;
      padding: 6px 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #ebeef5;
      transition: all 0.3s ease;
      flex-shrink: 0;
      min-width: fit-content;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }

      label {
        font-size: 12px;
        color: #909399;
        font-weight: 500;
        white-space: nowrap;
      }

      span {
        font-size: 14px;
        color: #303133;
        font-weight: 600;
        white-space: nowrap;

        &.amount {
          color: #e6a23c;
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.profit {
          color: #67c23a;
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.highlight {
          color: #409eff;
          font-size: 16px;
        }
      }
    }
  }

  // 工资详情区域
  .salary-info-section {
    margin-bottom: 24px;
    padding: 20px;
    background: #fafbfc;
    border-radius: 8px;
    border: 1px solid #e4e7ed;

    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e4e7ed;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child {
        border-bottom: none;
      }

      label {
        font-size: 14px;
        color: #606266;
        font-weight: 500;
      }

      span {
        font-size: 16px;
        color: #303133;
        font-weight: 600;

        &.amount {
          color: #67c23a;
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.net-salary {
          color: #e6a23c;
          font-size: 18px;
          font-weight: 700;
        }

        &.deduction {
          color: #f56c6c;
        }
      }
    }
  }

  // 销售明细表格区域
  .sales-details-table {
    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e4e7ed;
    }

    .table-responsive {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #dee2e6;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 0;
      background: white;
    }

    .data-table th {
      background: linear-gradient(135deg, #495057 0%, #343a40 100%);
      color: white;
      padding: 12px 10px;
      text-align: center;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-right: 1px solid #dee2e6;
      border-bottom: 2px solid #dee2e6;
      position: relative;
    }

    .data-table th:last-child {
      border-right: none;
    }

    .data-table th::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .data-table td {
      padding: 10px 8px;
      border-right: 1px solid #e9ecef;
      border-bottom: 1px solid #e9ecef;
      vertical-align: middle;
      font-size: 12px;
      color: #2c3e50;
      font-weight: 500;
      text-align: center;
      position: relative;
    }

    .data-table td:last-child {
      border-right: none;
    }

    .data-table tbody tr {
      transition: all 0.2s ease;
      position: relative;
    }

    .data-table tbody tr:nth-child(even) {
      background: #f8f9fa;
    }

    .data-table tbody tr:hover {
      background: #e3f2fd;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .data-table tbody tr:hover td {
      border-bottom-color: #dee2e6;
    }

    // IMEI 样式
    .imei {
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #495057;
      letter-spacing: 0.8px;
      background: #f8f9fa;
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid #e9ecef;
      display: inline-block;
      min-width: 100px;
      text-align: center;
      position: relative;
    }

    .imei:hover {
      background: #e9ecef;
      border-color: #dee2e6;
      transform: scale(1.02);
      transition: all 0.2s ease;
    }

    // 序号徽章
    .index-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
    }

    // 价格单元格
    .price {
      font-family: 'Monaco', 'Consolas', monospace;
      font-weight: 600;
      color: #67c23a;
      font-size: 13px;
    }

    // 时间单元格
    .time-cell {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      color: #606266;
    }

    // 提成显示样式
    .commission-display {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
    }

    .commission-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .commission-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .commission-label {
      color: #909399;
      font-size: 12px;
    }

    .commission-value {
      color: #303133;
      font-weight: 600;
      font-size: 12px;
    }
  }
}

// ==================== 工资模板表格专用样式 ====================

.salary-template-table {
  // 默认标识星标
  .default-star {
    font-size: 16px;
    color: #f59e0b;
    animation: star-pulse 2s ease-in-out infinite;
  }

  @keyframes star-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
  }

  // 模板名称单元格
  .template-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .name-text {
      font-weight: 500;
      color: #303133;
    }

    .status-badge {
      font-size: 11px;
      padding: 2px 6px;
      height: 18px;
      line-height: 18px;
    }
  }

  // 薪资单元格
  .salary-cell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-weight: 600;
    font-size: 15px;

    &.base-salary {
      color: #10b981;
    }

    i {
      font-size: 12px;
      opacity: 0.7;
    }
  }

  // 提成单元格
  .commission-cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;

    .commission-type {
      display: flex;
      justify-content: flex-start;
    }

    .commission-details {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding-left: 4px;

      .detail-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;

        .detail-label {
          color: #909399;
          font-size: 12px;
        }

        .detail-value {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          font-weight: 600;
          font-size: 12px;

          &.success {
            color: #67c23a;
          }

          &.info {
            color: #909399;
          }

          &.primary {
            color: #409eff;
          }
        }
      }
    }
  }

  // 费率单元格
  .rate-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 8px;
    background: #f8f9fa;
    border-radius: 6px;

    .rate-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: 11px;

      i {
        font-size: 11px;
        opacity: 0.6;
      }

      .rate-label {
        color: #909399;
        font-size: 11px;
      }

      .rate-value {
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        font-weight: 600;
        font-size: 11px;
        color: #303133;

        &.deduction {
          color: #f56c6c;
        }
      }

      &.overtime {
        color: #409eff;
      }

      &.leave {
        color: #f56c6c;
      }
    }

    .rate-divider {
      height: 1px;
      background: #e8ecef;
      margin: 2px 0;
    }
  }

  // 员工数量单元格
  .employee-count {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: #606266;

    i {
      font-size: 12px;
      color: #409eff;
    }

    span {
      font-weight: 500;
    }
  }

  // 操作按钮组 - 统一样式
  .template-action-buttons,
  .my-salary-action-buttons {
    display: flex !important;
    flex-direction: row !important;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex-wrap: nowrap !important;
    width: 100%;

    .el-button {
      display: inline-flex !important;
      flex-direction: row !important;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 6px;
      min-width: 50px !important;
      max-width: 58px;
      height: 28px;
      flex: 0 0 auto;
      white-space: nowrap;

      i {
        font-size: 11px;
      }

      .btn-text {
        font-size: 11px;
      }
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 10px;
      }

      .btn-text {
        display: inline;
      }
    }

    // Tooltip 样式
    :deep(.el-tooltip__popper) {
      font-size: 11px;
    }
  }

  // 工资发放操作按钮 - 强制一行显示（无图标）
  .payout-action-buttons {
    display: flex !important;
    flex-direction: row !important;
    align-items: center;
    justify-content: center;
    gap: 6px !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    width: 100% !important;
    overflow: visible !important;

    .el-button {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      padding: 4px 8px !important;
      font-size: 12px !important;
      border-radius: 4px;
      transition: all 0.2s ease;
      white-space: nowrap !important;
      flex-shrink: 0 !important;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  // 深度选择器 - 确保表格单元格内的按钮容器也是一行
  :deep(.el-table__cell) {
    .payout-action-buttons {
      flex-wrap: nowrap !important;

      .el-button {
        flex-shrink: 0 !important;
      }
    }
  }

  // 移除紧凑型样式，统一使用标准样式
}

.employee-action-buttons {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: nowrap !important;
  white-space: nowrap;
  width: 100%;
}

.employee-action-buttons .employee-action-item {
  display: inline-flex !important;
  flex: 1 1 0;
  min-width: 0;
}

.employee-action-buttons .employee-action-item :deep(.el-button) {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-width: 0 !important;
  max-width: none;
  height: 26px;
  padding: 4px 6px !important;
  margin: 0 !important;
  border-radius: 6px;
  white-space: nowrap;
  flex: 0 0 auto;
}

.employee-action-buttons .employee-action-item :deep(.el-button i) {
  font-size: 10px;
}

.employee-action-buttons .employee-action-item :deep(.el-button .btn-text) {
  font-size: 11px;
  line-height: 1;
}

.salary-employee-table,
.salary-payout-table {
  .employee-name-text {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #1f2937;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mobile-salary-value {
    display: inline-block;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  .mobile-salary-value.is-commission {
    color: #f97316;
  }

  .mobile-salary-value.is-overtime {
    color: #0f766e;
  }

  .mobile-salary-value.is-deduction {
    color: #dc2626;
  }

  .mobile-salary-value.is-estimated {
    color: #2563eb;
  }
}

:deep(.employee-action-column .cell) {
  padding: 0 6px !important;
  overflow: visible;
}

// 响应式优化 - 移动端表格样式调整
@media (max-width: 767px) {
  .salary-template-table,
  .salary-employee-table {
    :deep(.mobile-expand-column) {
      width: 0 !important;
      min-width: 0 !important;
      padding: 0 !important;
    }

    :deep(.mobile-expand-column .cell) {
      display: none !important;
    }

    :deep(.el-table__expand-column) {
      width: 0 !important;
      min-width: 0 !important;
    }

    :deep(.el-table__expand-icon) {
      display: none !important;
    }

    :deep(.el-table__expanded-cell) {
      padding: 6px 4px 10px !important;
      background: linear-gradient(180deg, #f8fbff 0%, #f4f7ff 100%) !important;
    }

    :deep(.el-table__body-wrapper) {
      overflow-x: hidden !important;
    }

    :deep(.el-table__header th .cell),
    :deep(.el-table__body td .cell) {
      padding: 0 4px;
    }

    :deep(.el-table__body td .cell) {
      font-size: 10px;
      line-height: 1.25;
      word-break: keep-all;
    }

    .name-col {
      .template-name-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .name-text {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.35;
      }
    }

    .salary-col .salary-cell {
      justify-content: center;
      font-size: 11px;
    }

    .employee-name-col {
      .employee-name-text {
        font-size: 12px;
      }
    }

    .employee-count {
      justify-content: center;
      font-size: 11px;
      gap: 4px;
    }

    // 移动端隐藏费率列
    .hide-on-mobile {
      display: none !important;
    }

    // 简化提成显示
    .commission-cell {
      .commission-details {
        .detail-item {
          font-size: 11px;
        }
      }
    }

    // 调整单元格内边距
    :deep(.el-table__body td) {
      padding: 7px 4px;
    }

    .mobile-inline-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: nowrap;
      width: 100%;
    }

    // 移动端操作按钮简化
    .template-action-buttons,
    .employee-action-buttons,
    .payout-action-buttons,
    .my-salary-action-buttons {
      gap: 3px;

      .el-button {
        padding: 3px 6px;
        font-size: 10px;

        i {
          font-size: 9px;
        }

        .btn-text {
          display: inline; // 移动端也显示文字
        }
      }
    }

    .mobile-inline-actions .mobile-action-btn {
      min-width: 0;
      height: 28px;
      padding: 4px 10px !important;
      border-radius: 8px;
      font-size: 11px;
      gap: 4px;
      box-shadow: none;

      i {
        font-size: 10px;
      }
    }
  }

}

@media (max-width: 767px) {
  .employee-action-buttons {
    gap: 3px;
  }

  .employee-action-buttons .employee-action-item :deep(.el-button) {
    height: 24px;
    padding: 2px 5px !important;
  }
}

@media (max-width: 1023px) {
  .salary-template-table {
    // 平板隐藏说明列
    .hide-on-tablet {
      display: none !important;
    }

    // 平板操作按钮保持原样
    .template-action-buttons,
    .employee-action-buttons,
    .payout-action-buttons,
    .my-salary-action-buttons {
      gap: 4px;

      .el-button {
        padding: 4px 8px;
        font-size: 11px;
      }
    }
  }
}

@media (max-width: 1023px) {
  .employee-action-buttons {
    gap: 4px;
  }

  .employee-action-buttons .employee-action-item :deep(.el-button) {
    padding: 4px 6px !important;
  }
}

// ==================== 模态框响应式优化 ====================

@media (max-width: 767px) {
  // 表单响应式
  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    font-size: 13px;
  }

  .form-control {
    padding: 8px 10px;
    font-size: 13px;
  }

  // 单选框组响应式
  .radio-group {
    gap: 16px;
  }

  .radio-label {
    font-size: 13px;
  }

  // 模板预览框响应式
  .template-preview-box {
    padding: 12px !important;
  }

  .preview-row {
    font-size: 13px !important;
    padding: 6px 0 !important;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .form-row {
    gap: 12px;
  }

  .form-control {
    padding: 9px 11px;
  }
}

// ==================== 模态框增强样式 ====================

// 模板预览框样式
.template-preview-box {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
  border-left: 4px solid #667eea;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #495057;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '\f05a';
      font-family: 'Font Awesome 6 Free';
      font-weight: 900;
      color: #667eea;
    }
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed #dee2e6;
    font-size: 14px;

    &:last-child {
      border-bottom: none;
    }

    .preview-label {
      color: #6c757d;
      font-weight: 500;
    }

    .preview-value {
      color: #212529;
      font-weight: 600;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    }
  }
}

// 表单提示文字
.form-tip {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
}

</style>
<style>
.salary-dialog,
.salary-dialog-large {
  --dialog-max-width: 760px;
}

@media (max-width: 767px) {
  .salary-dialog,
  .salary-dialog-large {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 10px 8px 8px;
    --mobile-dialog-footer-padding: 0 8px 8px;
  }

  .mobile-dialog-sheet-overlay.salary-dialog,
  .mobile-dialog-sheet-overlay.salary-dialog-large {
    padding: 12px 6px !important;
  }

  .detail-section-grid .detail-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 10px 12px;
  }

  .detail-row .label,
  .detail-row .value {
    min-width: 0;
    width: 100%;
    text-align: left;
  }

  .detail-row.highlight {
    padding: 14px 12px;
  }

  .detail-row.highlight .net-salary-large {
    font-size: 22px;
  }

  .sales-details .details-info,
  .sales-details .salary-info-section {
    padding: 12px 10px;
    border-radius: 14px;
  }

  .sales-details .details-info {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .sales-details .details-info .info-row,
  .sales-details .salary-info-section .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    padding: 8px 10px;
  }

  .sales-details .details-info .info-row label,
  .sales-details .salary-info-section .info-row label,
  .sales-details .details-info .info-row span,
  .sales-details .salary-info-section .info-row span {
    white-space: normal;
    word-break: break-word;
  }

  .sales-details .table-responsive {
    border-radius: 10px;
  }

  .sales-details .data-table {
    min-width: 640px;
  }

  .attendance-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .attendance-actions :deep(.el-button) {
    width: 100%;
    margin: 0;
  }

  .employee-template-form,
  .template-preview-box {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .salary-dialog,
  .salary-dialog-large {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 8px 6px 6px;
    --mobile-dialog-footer-padding: 0 6px 6px;
  }

  .mobile-dialog-sheet-overlay.salary-dialog,
  .mobile-dialog-sheet-overlay.salary-dialog-large {
    padding: 12px 4px !important;
  }

  .detail-row.highlight .net-salary-large {
    font-size: 20px;
  }

  .sales-details .data-table {
    min-width: 560px;
  }
}
</style>
