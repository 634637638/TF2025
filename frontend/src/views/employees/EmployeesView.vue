<template>
  <div class="employees-view admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      module-name="员工管理"
      permission-code="employee:view"
    >
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader
        icon="fas fa-users"
        title="员工管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            :icon="Plus"
            @click="openAddEmployee"
          >
            新增
          </el-button>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="exporting"
            :export-disabled="loading || exporting"
            @export="handleExport"
          />
          <el-button
            type="info"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <InlineLoading
              v-if="refreshing"
              text="刷新中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <el-icon><Refresh /></el-icon>
              刷新
            </template>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
        <!-- 统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewField('stats_total_employees')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-users" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ employeeStats.total }}
              </div>
              <div class="stat-label">
                员工总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_active_employees')"
            class="stat-card stat-card--success"
          >
            <div class="stat-icon">
              <i class="fas fa-check-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ employeeStats.active }}
              </div>
              <div class="stat-label">
                在职员工
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_inactive_employees')"
            class="stat-card stat-card--danger"
          >
            <div class="stat-icon">
              <i class="fas fa-pause-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ employeeStats.inactive }}
              </div>
              <div class="stat-label">
                离职员工
              </div>
            </div>
          </div>
          <div
            v-if="canViewField('stats_phone_completion')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-phone" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ employeeStats.withPhone }}
              </div>
              <div class="stat-label">
                已留电话
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="loading"
          @search="handleSearch"
          @reset="resetFilters"
        >
          <template #primary>
            <el-input
              v-if="showSearchKeyword"
              v-model="searchQuery"
              placeholder="搜索关键词"
              clearable
              @keyup.enter="handleSearch"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            v-if="canViewField('status')"
            class="form-group filter-item"
            data-field="status"
          >
            <el-select
              v-model="statusFilter"
              placeholder="状态"
              clearable
              @change="handleSearch"
            >
              <el-option
                label="在职"
                value="1"
              />
              <el-option
                label="离职"
                value="0"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <!-- 员工管理区域 -->
        <div class="table-section admin-panel admin-table-panel">
          <div class="section-title">
            <i class="fas fa-list" />
            员工列表
            <span class="record-count">共 {{ employeeTotal }} 条记录</span>
          </div>

          <div class="table-responsive">
            <el-table
              ref="employeesTableRef"
              :data="loading ? [] : paginatedEmployees"
              border
              stripe
              class="data-table devices-table base-data-table employees-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getEmployeeRowKey"
              :row-class-name="getEmployeeRowClass"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="(row) => handleMobileRowTap(row.id)"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="loading"
                  mode="block"
                  text="加载员工列表..."
                />
                <DataEmptyState
                  v-else
                  description="暂无员工数据"
                >
                  <el-button
                    size="small"
                    type="info"
                    @click="loadEmployees()"
                  >
                    重新加载
                  </el-button>
                </DataEmptyState>
              </template>
              <el-table-column
                v-if="showIdColumn"
                label="ID"
                width="70"
                align="center"
              >
                <template #default="{ row }">
                  <span class="id-badge">{{ getEmployeeIndex(row.id) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('name')"
                prop="name"
                label="姓名"
                :min-width="isMobile ? 72 : 110"
                align="center"
              >
                <template #default="{ row }">
                  <strong>{{ row.name || '未命名' }}</strong>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('username')"
                prop="username"
                label="工号"
                :min-width="isMobile ? 76 : 110"
                align="center"
              />
              <el-table-column
                v-if="showRoleColumn"
                label="角色"
                :min-width="isMobile ? 102 : 130"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['role-badge', getRoleBadgeClass(row)]"><i :class="getRoleIcon(row)" />{{ getRoleDisplayName(row) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showPhoneColumn"
                label="电话"
                min-width="132"
                align="center"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.phone"
                    class="phone-number"
                  ><i class="fas fa-phone" />{{ row.phone }}</span><span
                    v-else
                    class="no-data"
                  >-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showEmailColumn"
                label="邮箱"
                min-width="190"
                align="center"
                class-name="complete-text-column"
              >
                <template #default="{ row }">
                  <span
                    v-if="row.email"
                    class="phone-number"
                  ><i class="fas fa-envelope" />{{ row.email }}</span><span
                    v-else
                    class="no-data"
                  >-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showStatusColumn"
                label="状态"
                :min-width="isMobile ? 72 : 84"
                align="center"
              >
                <template #default="{ row }">
                  <span :class="['status-badge', isEmployeeActive(row.status) ? 'status-active' : 'status-inactive']"><i :class="isEmployeeActive(row.status) ? 'fas fa-circle' : 'fas fa-user-slash'" />{{ isEmployeeActive(row.status) ? '在职' : '离职' }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showLastLoginColumn"
                label="最后登录"
                min-width="156"
                align="center"
              >
                <template #default="{ row }">
                  <div class="time-info">
                    <i class="fas fa-clock" /><span v-if="row.last_login">{{ formatDate(row.last_login) }}</span><span
                      v-else
                      class="no-data"
                    >从未登录</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showCreatedAtColumn"
                label="创建时间"
                min-width="126"
                align="center"
              >
                <template #default="{ row }">
                  <div class="time-info">
                    <i class="fas fa-clock" />{{ formatDate(row.created_at, false) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showHireDateColumn"
                label="入职时间"
                min-width="126"
                align="center"
              >
                <template #default="{ row }">
                  <div class="time-info">
                    <i class="fas fa-user-clock" /><span v-if="row.hire_date">{{ formatDate(row.hire_date, false) }}</span><span
                      v-else
                      class="no-data"
                    >未设置</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showActionField"
                label="操作"
                :width="$getActionColumnWidth((Number(canEdit) * 2) + Number(canDelete))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      v-if="canEdit"
                      v-permission="'employee:edit'"
                      type="primary"
                      size="small"
                      :icon="Edit"
                      @click.stop="editEmployee(row)"
                    >
                      编辑
                    </el-button><el-button
                      v-if="canEdit && isEmployeeActive(row.status)"
                      v-permission="'employee:edit'"
                      type="warning"
                      size="small"
                      :icon="UserFilled"
                      @click.stop="toggleStatus(row)"
                    >
                      离职
                    </el-button><el-button
                      v-else-if="canEdit"
                      v-permission="'employee:edit'"
                      type="info"
                      size="small"
                      :icon="CircleCheck"
                      @click.stop="toggleStatus(row)"
                    >
                      恢复
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'employee:delete'"
                      type="danger"
                      size="small"
                      :icon="Delete"
                      @click.stop="deleteEmployee(row)"
                    >
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile && (canEdit || canDelete)"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button
                      v-if="canEdit"
                      v-permission="'employee:edit'"
                      type="primary"
                      size="small"
                      @click.stop="editEmployee(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button><el-button
                      v-if="canEdit && isEmployeeActive(row.status)"
                      v-permission="'employee:edit'"
                      type="warning"
                      size="small"
                      @click.stop="toggleStatus(row)"
                    >
                      <i class="fas fa-user-slash" /><span>离职</span>
                    </el-button><el-button
                      v-else-if="canEdit"
                      v-permission="'employee:edit'"
                      type="info"
                      size="small"
                      @click.stop="toggleStatus(row)"
                    >
                      <i class="fas fa-rotate-left" /><span>恢复</span>
                    </el-button><el-button
                      v-if="canDelete"
                      v-permission="'employee:delete'"
                      type="danger"
                      size="small"
                      @click.stop="deleteEmployee(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 分页组件 -->
          <Pagination
            v-if="filteredEmployees.length > 0"
            v-model:current="page"
            v-model:page-size="page_size"
            :total="employeeTotal"
            :page-sizes="[10, 20, 50, 100]"
            :show-total="true"
            :show-range="true"
            :show-page-sizes="true"
            :show-quick-jumper="true"
            :disabled="loading"
            @change="handlePaginationChange"
          />
        </div>


        <!-- 添加/编辑员工模态框 -->
        <MobileDialog
          v-model="dialogVisible"
          :title="isEditMode ? '编辑员工' : '新增员工'"
          width="700px"
          dialog-class="employees-form-dialog"
          :close-on-click-modal="false"
          :show-default-footer="false"
          @close="attemptCloseModal"
        >
          <el-form
            :model="employeeForm"
            label-width="100px"
          >
            <el-row :gutter="20">
              <el-col
                v-if="canViewField('name')"
                :span="12"
              >
                <el-form-item
                  label="姓名"
                  required
                >
                  <el-input
                    v-model="employeeForm.name"
                    placeholder="请输入员工姓名"
                    clearable
                    maxlength="50"
                    show-word-limit
                    :disabled="!canEditField('name')"
                  />
                </el-form-item>
              </el-col>
              <el-col
                v-if="canViewField('username')"
                :span="12"
              >
                <el-form-item
                  label="用户名"
                  required
                >
                  <el-input
                    v-model="employeeForm.username"
                    placeholder="请输入用户名"
                    clearable
                    maxlength="50"
                    show-word-limit
                    :disabled="!canEditField('username')"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col
                v-if="canViewField('phone')"
                :span="12"
              >
                <el-form-item label="手机号">
                  <el-input
                    v-model="employeeForm.phone"
                    placeholder="请输入手机号"
                    clearable
                    maxlength="11"
                    show-word-limit
                    :disabled="!canEditField('phone')"
                  />
                </el-form-item>
              </el-col>
              <el-col
                v-if="canViewField('email')"
                :span="12"
              >
                <el-form-item label="邮箱">
                  <el-input
                    v-model="employeeForm.email"
                    placeholder="请输入邮箱地址"
                    clearable
                    maxlength="100"
                    show-word-limit
                    :disabled="!canEditField('email')"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item
              v-if="canViewField('role') || canViewField('role_ids')"
              label="角色"
              required
            >
              <el-checkbox-group
                v-model="employeeForm.role_ids"
                :disabled="!canEditField('role_ids')"
              >
                <template v-if="loadingRoles">
                  <div class="loading-roles">
                    <InlineLoading text="正在加载角色..." />
                  </div>
                </template>
                <template v-else-if="roles.length === 0">
                  <DataEmptyState
                    description="暂无可用角色"
                    :image-size="60"
                  />
                </template>
                <template v-else>
                  <el-checkbox
                    v-for="role in roles"
                    :key="role.id"
                    :label="role.id"
                    :value="role.id"
                  >
                    <div class="role-checkbox-content">
                      <span class="role-checkbox-name">{{ role.name }}</span>
                    </div>
                  </el-checkbox>
                </template>
              </el-checkbox-group>
            </el-form-item>

            <el-form-item
              v-if="canViewField('status')"
              label="状态"
            >
              <el-radio-group
                v-model="employeeForm.status"
                :disabled="!canEditField('status')"
              >
                <el-radio :value="1">
                  在职
                </el-radio>
                <el-radio :value="0">
                  离职
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item
              v-if="canViewField('hire_date')"
              label="入职时间"
            >
              <el-date-picker
                v-model="employeeForm.hire_date"
                type="date"
                placeholder="请选择入职时间"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="!canEditField('hire_date')"
              />
            </el-form-item>

            <!-- 新增员工时的密码设置 -->
            <template v-if="showAddModal">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item
                    label="初始密码"
                    required
                  >
                    <el-input
                      v-model="employeeForm.password"
                      type="password"
                      placeholder="请输入初始密码"
                      clearable
                      show-password
                      maxlength="50"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item
                    label="确认密码"
                    required
                  >
                    <el-input
                      v-model="employeeForm.confirm_password"
                      type="password"
                      placeholder="请再次输入密码"
                      clearable
                      show-password
                      maxlength="50"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </template>

            <!-- 编辑员工时的密码修改区域 -->
            <template v-if="showEditModal">
              <el-divider content-position="left">
                <el-icon><Key /></el-icon>
                密码管理
                <el-button
                  type="primary"
                  link
                  style="margin-left: 10px"
                  @click="togglePasswordSection"
                >
                  <el-icon><component :is="showPasswordFields ? ArrowUp : ArrowDown" /></el-icon>
                  {{ showPasswordFields ? '收起' : '展开' }}密码修改
                </el-button>
              </el-divider>

              <div v-if="showPasswordFields">
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="新密码">
                      <el-input
                        v-model="employeeForm.password"
                        type="password"
                        placeholder="留空表示不修改密码"
                        clearable
                        show-password
                        maxlength="50"
                      />
                      <div class="form-help">
                        如需修改密码请输入新密码，否则留空
                      </div>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="确认新密码">
                      <el-input
                        v-model="employeeForm.confirm_password"
                        type="password"
                        placeholder="请再次输入新密码"
                        clearable
                        show-password
                        maxlength="50"
                      />
                      <div
                        v-if="employeeForm.password && !employeeForm.confirm_password"
                        class="form-help"
                      >
                        请确认新密码
                      </div>
                      <div
                        v-if="employeeForm.password && employeeForm.confirm_password && employeeForm.password !== employeeForm.confirm_password"
                        class="form-help error"
                      >
                        ⚠️ 两次输入的密码不一致
                      </div>
                    </el-form-item>
                  </el-col>
                </el-row>

                <!-- 密码操作按钮 -->
                <div class="password-actions">
                  <el-button
                    type="warning"
                    size="small"
                    :disabled="passwordResetting"
                    @click="resetToDefaultPassword"
                  >
                    <InlineLoading
                      v-if="passwordResetting"
                      text="重置中..."
                      size="small"
                      variant="inherit"
                    />
                    <template v-else>
                      <el-icon><RefreshLeft /></el-icon>
                      重置为随机密码
                    </template>
                  </el-button>
                  <el-button
                    type="info"
                    size="small"
                    :icon="RefreshRight"
                    @click="generateRandomPassword"
                  >
                    生成随机密码
                  </el-button>
                  <el-button
                    size="small"
                    :icon="Close"
                    @click="clearPasswordFields"
                  >
                    取消密码修改
                  </el-button>
                </div>
              </div>
            </template>
          </el-form>

          <template #footer>
            <el-button
              type="default"
              :icon="Close"
              @click="attemptCloseModal"
            >
              取消
            </el-button>
            <el-button
              type="primary"
              :disabled="submitting"
              @click="saveEmployee"
            >
              <InlineLoading
                v-if="submitting"
                :text="isEditMode ? '保存中...' : '添加中...'"
                size="small"
                variant="inherit"
              />
              <template v-else>
                <el-icon><component :is="isEditMode ? Check : Plus" /></el-icon>
                {{ isEditMode ? '保存' : '添加' }}
              </template>
            </el-button>
          </template>
        </MobileDialog>

        <!-- 薪资详情模态框 -->
        <MobileDialog
          v-model="showSalaryModal"
          :title="`${selectedEmployee?.name} - 薪资详情`"
          width="600px"
          dialog-class="employees-salary-dialog"
          :show-default-footer="false"
        >
          <div
            v-if="employeeSalary"
            class="salary-info"
          >
            <el-descriptions
              :column="3"
              border
            >
              <el-descriptions-item label="基本工资">
                <span class="amount">¥{{ employeeSalary.base_salary || 0 }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="提成比例">
                {{ employeeSalary.commission_new || 0 }}% / {{ employeeSalary.commission_used || 0 }}%
              </el-descriptions-item>
              <el-descriptions-item label="利润提成">
                {{ employeeSalary.commission_profit_percentage || 0 }}%
              </el-descriptions-item>
            </el-descriptions>

            <el-divider content-position="left">
              详细配置
            </el-divider>

            <el-descriptions
              :column="2"
              border
            >
              <el-descriptions-item label="加班费率">
                ¥{{ employeeSalary.overtime_rate || 0 }}/小时
              </el-descriptions-item>
              <el-descriptions-item label="缺勤扣除">
                ¥{{ employeeSalary.deduction_absent || 0 }}/天
              </el-descriptions-item>
              <el-descriptions-item label="全勤奖金">
                ¥{{ employeeSalary.bonus_attendance || 0 }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="canViewField('salary_template_name')"
                label="薪资模板"
              >
                {{ employeeSalary.salary_template_name || '未设置' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <DataEmptyState
            v-else
            description="该员工暂未配置薪资信息"
          />
        </MobileDialog>

        <!-- 角色管理模态框 -->
        <MobileDialog
          v-model="showRoleManagement"
          title="角色管理"
          width="800px"
          dialog-class="employees-role-management-dialog"
          :show-default-footer="false"
        >
          <div class="role-management-section">
            <div class="section-header">
              <h4>
                <el-icon><PriceTag /></el-icon>
                角色列表
              </h4>
              <el-button
                type="primary"
                size="small"
                :icon="Plus"
                @click="openAddRoleModal"
              >
                新增
              </el-button>
            </div>

            <div class="roles-list">
              <TableLoadingRow
                v-if="loadingRoles"
                mode="block"
                text="加载中..."
              />
              <DataEmptyState
                v-else-if="roles.length === 0"
                size="compact"
                description="暂无角色，请点击上方新增角色按钮添加"
              />
              <div
                v-else
                class="roles-grid"
              >
                <el-card
                  v-for="role in roles"
                  :key="role.id"
                  class="role-card"
                  shadow="hover"
                >
                  <template #header>
                    <div class="role-header">
                      <h5>{{ role.name }}</h5>
                      <div class="role-actions">
                        <el-button
                          size="small"
                          type="primary"
                          :icon="Edit"
                          @click="editRole(role)"
                        />
                        <el-button
                          size="small"
                          type="danger"
                          :disabled="role.user_count > 0"
                          :title="role.user_count > 0 ? '该角色仍有用户使用，无法删除' : '删除角色'"
                          :icon="Delete"
                          @click="deleteRole(role)"
                        />
                      </div>
                    </div>
                  </template>
                  <div class="role-description">
                    {{ role.description || '暂无描述' }}
                  </div>
                  <div class="role-stats">
                    <el-tag size="small">
                      {{ role.user_count }} 个用户
                    </el-tag>
                    <span class="create-time">创建于 {{ formatDate(role.created_at) }}</span>
                  </div>
                </el-card>
              </div>
            </div>
          </div>
        </MobileDialog>

  
        <!-- 添加/编辑角色模态框 -->
        <MobileDialog
          v-model="roleDialogVisible"
          :title="showAddRoleModal ? '添加角色' : '编辑角色'"
          width="500px"
          dialog-class="employees-role-form-dialog"
          :close-on-click-modal="false"
          :show-default-footer="false"
          @close="closeRoleModal"
        >
          <el-form
            :model="roleForm"
            label-width="100px"
          >
            <el-form-item
              label="角色名称"
              required
            >
              <el-input
                v-model="roleForm.name"
                placeholder="请输入角色名称"
                clearable
                maxlength="50"
                show-word-limit
                @input="roleFormError = ''"
              />
              <el-alert
                v-if="roleFormError"
                :title="roleFormError"
                type="error"
                :closable="false"
                show-icon
                style="margin-top: 5px"
              />
            </el-form-item>

            <el-form-item label="角色描述">
              <el-input
                v-model="roleForm.description"
                type="textarea"
                placeholder="请输入角色描述"
                :rows="3"
                clearable
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </el-form>

          <template #footer>
            <el-button
              type="default"
              :icon="Close"
              @click="closeRoleModal"
            >
              取消
            </el-button>
            <el-button
              type="primary"
              :disabled="savingRole"
              @click="saveRole"
            >
              <InlineLoading
                v-if="savingRole"
                :text="showAddRoleModal ? '添加中...' : '保存中...'"
                size="small"
                variant="inherit"
              />
              <template v-else>
                <el-icon><Check /></el-icon>
                {{ showAddRoleModal ? '添加' : '保存' }}
              </template>
            </el-button>
          </template>
        </MobileDialog>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import type { Employee, EmployeeForm, Role } from '@/types/employee'
import Pagination from '../../components/Pagination.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { useMobile } from '@/composables/mobile'
import {
  Plus,
  Refresh,
  Key,
  RefreshRight,
  Edit,
  UserFilled,
  CircleCheck,
  Delete,
  ArrowUp,
  ArrowDown,
  RefreshLeft,
  Close,
  Check,
  PriceTag
} from '@element-plus/icons-vue'

// 权限和路由
const router = useRouter()
// 使用统一的 composable
const { success, error, warning, info: _info, handleApiError, confirm: _confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport } = usePagePermissions('employees')
const { refreshing, refresh } = useRefreshData()
const authStore = useAuthStore()
const { init: initFieldPermissions } = fieldPermissions
const { isMobile } = useMobile()

// 响应式数据
const employees = ref<Employee[]>([])
const employeeTotal = ref(0)
const employeeStats = ref({ total: 0, active: 0, inactive: 0, withPhone: 0 })
const { loading } = useLoadingState()
loading.value = true
const { loading: submitting } = useLoadingState()
const { loading: exporting } = useLoadingState()
const { exportFile, buildDateFilename, sanitizeParams } = useImportExport()
const employeesTableRef = ref<any>(null)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)
const getEmployeeRowKey = (employee: Employee) => String(employee.id)
const isEmployeeActive = (status: Employee['status'] | string) => status === 1 || status === 'active'
const getEmployeeRowClass = ({ row }: { row: Employee }) => isEmployeeActive(row.status) ? 'status-active-row' : 'status-inactive-row'

// 搜索相关状态
const searchExpanded = ref(false)
const { loading: passwordResetting } = useLoadingState()
const searchQuery = ref('')
const statusFilter = ref('')
const page = ref(1)
const page_size = ref(10)

const employeeFieldMap: Record<string, string> = {
  stats_total_employees: 'stats.total_employees',
  stats_active_employees: 'stats.active_employees',
  stats_inactive_employees: 'stats.inactive_employees',
  stats_phone_completion: 'stats.phone_completion',
  id: 'employee.id',
  name: 'employee.name',
  username: 'employee.username',
  role: 'employee.role',
  role_ids: 'employee.role_ids',
  phone: 'employee.phone',
  email: 'employee.email',
  status: 'employee.status',
  last_login: 'employee.last_login',
  created_at: 'employee.created_at',
  hire_date: 'employee.hire_date',
  salary_template_name: 'employee.salary_template_name',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => employeeFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('employees_employeesview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('employees_employeesview', getFieldKey(fieldName))
}

const showSearchKeyword = computed(() => {
  return ['name', 'username', 'phone', 'email'].some(fieldName => canViewField(fieldName))
})

const showIdColumn = computed(() => canViewField('id') && !isMobile.value)
const showRoleColumn = computed(() => canViewField('role') || canViewField('role_ids'))
const showPhoneColumn = computed(() => canViewField('phone') && !isMobile.value)
const showEmailColumn = computed(() => canViewField('email') && !isMobile.value)
const showStatusColumn = computed(() => canViewField('status'))
const showLastLoginColumn = computed(() => canViewField('last_login') && !isMobile.value)
const showCreatedAtColumn = computed(() => canViewField('created_at') && !isMobile.value)
const showHireDateColumn = computed(() => canViewField('hire_date') && !isMobile.value)
const showActionField = computed(() => (
  shouldShowActionColumn(canViewField('actions'), [canEdit.value, canDelete.value]) && !isMobile.value
))
const showStatsCards = computed(() => (
  canViewField('stats_total_employees') ||
  canViewField('stats_active_employees') ||
  canViewField('stats_inactive_employees') ||
  canViewField('stats_phone_completion')
))
const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  const rowKey = String(id)
  mobileActionRowId.value = mobileActionRowId.value === rowKey ? null : rowKey
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return
  const rowKey = String(id)

  const now = Date.now()
  if (lastTappedRowId.value === rowKey && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = rowKey
  lastTapTimestamp.value = now
}

// 模态框状态
const showAddModal = ref(false)
const showEditModal = ref(false)
const showSalaryModal = ref(false)
const selectedEmployee = ref<Employee | null>(null)
interface EmployeeSalaryDetail {
  base_salary?: number
  commission_new?: number
  commission_used?: number
  commission_profit_percentage?: number
  overtime_rate?: number
  deduction_absent?: number
  bonus_attendance?: number
  salary_template_name?: string
}

const employeeSalary = ref<EmployeeSalaryDetail | null>(null)

// 角色管理状态
const showRoleManagement = ref(false)
const showAddRoleModal = ref(false)
const showEditRoleModal = ref(false)
const { loading: loadingRoles } = useLoadingState()
const { loading: savingRole } = useLoadingState()

// 密码字段控制
const showPasswordFields = ref(false)

// 表单数据
const employeeForm = ref<EmployeeForm>({
  username: '',
  name: '',
  phone: '',
  email: '',
  role_ids: [],
  status: 1,
  password: '',
  confirm_password: '',
  hire_date: ''
})

// 角色相关数据
const roles = ref<Role[]>([])
const roleForm = ref({
  name: '',
  description: ''
})
const editingRole = ref<Role | null>(null)
const roleFormError = ref('')

// 模态框显示状态
const dialogVisible = computed({
  get: () => showAddModal.value || showEditModal.value,
  set: (value: boolean) => {
    if (!value) {
      closeModal()
    }
  }
})

// 角色模态框显示状态
const roleDialogVisible = computed({
  get: () => showAddRoleModal.value || showEditRoleModal.value,
  set: (value: boolean) => {
    if (!value) {
      closeRoleModal()
    }
  }
})

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value)

// 计算属性
// 搜索和分页由后端处理，避免只在前 100 条员工数据中筛选。
const filteredEmployees = computed(() => employees.value)

const paginatedEmployees = computed(() => {
  return employees.value
})

const handlePaginationChange = (current_page, page_size_value) => {
  page.value = current_page
  page_size.value = page_size_value
  loadEmployees()
}

// 方法
const loadEmployeeStats = async () => {
  const params: Record<string, string> = {}
  if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
  if (statusFilter.value !== '') params.status = statusFilter.value
  try {
    const response = await unifiedApi.get('/employees/stats/overview', { params })
    if (response.success) {
      const data = response.data || {}
      employeeStats.value = {
        total: Number(data.total) || 0,
        active: Number(data.active) || 0,
        inactive: Number(data.inactive) || 0,
        withPhone: Number(data.with_phone) || 0
      }
    }
  } catch (err) {
    logger.error('获取员工统计失败:', err)
    employeeStats.value = { total: 0, active: 0, inactive: 0, withPhone: 0 }
  }
}

const loadEmployees = async (bustCache: boolean = false, silentError: boolean = false, showLoadingState: boolean = true) => {
  if (!canView.value) {
    employees.value = []
    loading.value = false
    return
  }

  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params: any = { page: page.value, page_size: page_size.value }
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    if (statusFilter.value !== '') params.status = statusFilter.value
    if (bustCache) {
      params._t = Date.now()
    }
    const response = await unifiedApi.get('/employees', { params })
    if (response.success) {
      employees.value = response.data.employees || []
      const apiPagination = response.data.pagination || {}
      page.value = Number(apiPagination.page) || page.value
      page_size.value = Number(apiPagination.page_size) || page_size.value
      employeeTotal.value = Number(apiPagination.total) || 0
      await loadEmployeeStats()
    }
  } catch (error: any) {
    logger.error('加载员工列表失败:', error)
    employees.value = []
    employeeTotal.value = 0

    // 静默处理页面卸载导致的取消错误
    if (error.name === 'CanceledError') {
      return
    }

    if (!silentError) {
      handleApiError(error, '获取员工列表失败')
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 刷新当前页 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadEmployees(true, false, false)
  })
  success('数据刷新成功', { duration: 2000 })
}

const handleSearch = () => {
  page.value = 1
  loadEmployees()
}

const resetFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
  page.value = 1
  loadEmployees()
}

const openAddEmployee = async () => {
  if (!canCreate.value) {
    error('权限不足：您没有新增员工的权限')
    return
  }

  try {
    await loadRoles()
  } catch (err) {
    logger.error('加载角色失败:', err)
    error('加载角色列表失败，请稍后重试')
    return
  }

  selectedEmployee.value = null
  showPasswordFields.value = false
  employeeForm.value = {
    username: '',
    name: '',
    phone: '',
    email: '',
    role_ids: [],
    status: 1,
    password: '',
    confirm_password: '',
    hire_date: ''
  }
  showAddModal.value = true
}

const editEmployee = async (employee: Employee) => {
  if (!canEdit.value) {
    error('权限不足：您没有编辑员工的权限')
    return
  }

  selectedEmployee.value = employee
  showPasswordFields.value = false // 默认不显示密码字段

  // 始终重新加载角色数据，确保是最新的
  try {
    await loadRoles()
  } catch (err) {
    logger.error('加载角色失败:', err)
    error('加载角色列表失败，请稍后重试')
    return
  }

  employeeForm.value = {
    username: employee.username,
    name: employee.name,
    phone: employee.phone || '',
    email: employee.email || '',
    role_ids: employee.role_ids,
    status: employee.status,
    password: '',
    confirm_password: '',
    hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : (employee.created_at ? employee.created_at.split('T')[0] : '')
  }

  // 延迟显示模态框，确保角色加载完成
  setTimeout(() => {
    showEditModal.value = true
  }, 100)
}

const saveEmployee = async () => {
  if (submitting.value) return

  // 检查权限
  if (showAddModal.value && !canCreate.value) {
    error('权限不足：您没有新增员工的权限')
    return
  }
  if (showEditModal.value && !canEdit.value) {
    error('权限不足：您没有编辑员工的权限')
    return
  }

  // 验证密码
  if (showAddModal.value && employeeForm.value.password !== employeeForm.value.confirm_password) {
    error('两次输入的密码不一致')
    return
  }

  // 编辑模式下验证密码（如果填写了密码）
  if (showEditModal.value && employeeForm.value.password) {
    if (employeeForm.value.password !== employeeForm.value.confirm_password) {
      error('两次输入的密码不一致')
      return
    }
  }

  // 验证至少选择了一个角色
  if ((canViewField('role') || canViewField('role_ids')) && employeeForm.value.role_ids && employeeForm.value.role_ids.length === 0) {
    error('请至少选择一个角色')
    return
  }

  submitting.value = true
  try {
    const data: any = {
      username: employeeForm.value.username,
      name: employeeForm.value.name,
      phone: employeeForm.value.phone || null,
      email: employeeForm.value.email || null,
      role_ids: employeeForm.value.role_ids,
      status: employeeForm.value.status,
      hire_date: employeeForm.value.hire_date || null
    }

    // 处理密码
    let response
    if (showAddModal.value) {
      // 新增员工必须有密码
      data.password = employeeForm.value.password
      response = await unifiedApi.post('/employees', data)
    } else {
      // 编辑员工，如果填写了密码则更新密码
      if (employeeForm.value.password) {
        data.password = employeeForm.value.password
      }
      response = await unifiedApi.put(`/employees/${selectedEmployee.value?.id}`, data)
    }

    // 检查是否需要重新登录（密码修改后）
    if (response.data?.require_relogin || response.data?.code === 'PASSWORD_CHANGED') {
      closeModal()
      await loadEmployees()

      // 提示用户需要重新登录
      warning('密码已修改，为了安全起见，请重新登录', { duration: 5000 })

      // 延迟后自动退出登录
      setTimeout(() => {
        authStore.logout()
        router.push('/login')
      }, 2000)

      return
    }

    closeModal()
    await loadEmployees()
    success(showAddModal.value ? '员工添加成功' : '员工信息更新成功')
  } catch (error: any) {
    logger.error('保存员工失败:', error)
    logger.error('错误详情:', error.response?.data)

    handleApiError(error, showAddModal.value ? '添加员工失败' : '更新员工失败')
  } finally {
    submitting.value = false
  }
}

const _hasUnsavedChanges = (): boolean => {
  if (!showAddModal.value && !showEditModal.value) return false

  const currentForm = employeeForm.value

  if (showEditModal.value && selectedEmployee.value) {
    return (
      currentForm.name !== selectedEmployee.value.name ||
      currentForm.phone !== selectedEmployee.value.phone ||
      currentForm.email !== selectedEmployee.value.email ||
      JSON.stringify(currentForm.role_ids) !== JSON.stringify(selectedEmployee.value.role_ids) ||
      currentForm.status !== selectedEmployee.value.status
    )
  }

  // For add modal, check if any field has been filled
  return (
    currentForm.username !== '' ||
    currentForm.name !== '' ||
    currentForm.phone !== '' ||
    currentForm.email !== '' ||
    currentForm.password !== '' ||
    currentForm.confirm_password !== ''
  )
}

const attemptCloseModal = () => {
  closeModal()
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  showPasswordFields.value = false
  selectedEmployee.value = null
  employeeForm.value = {
    username: '',
    name: '',
    phone: '',
    email: '',
    role_ids: [],
    status: 1,
    password: '',
    confirm_password: '',
    hire_date: ''
  }
}

// 密码相关方法
const togglePasswordSection = () => {
  showPasswordFields.value = !showPasswordFields.value
  if (!showPasswordFields.value) {
    // 收起时清空密码字段
    employeeForm.value.password = ''
    employeeForm.value.confirm_password = ''
  }
}

const clearPasswordFields = () => {
  employeeForm.value.password = ''
  employeeForm.value.confirm_password = ''
  showPasswordFields.value = false
}

const resetToDefaultPassword = async () => {
  const generatedPassword = generateSecurePassword()

  try {
    await ElMessageBox.confirm(
      `确定要将员工 "${selectedEmployee.value?.name}" 的密码重置为随机密码吗？\n\n新密码：${generatedPassword}`,
      '密码重置确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  passwordResetting.value = true
  try {
    employeeForm.value.password = generatedPassword
    employeeForm.value.confirm_password = generatedPassword
    showPasswordFields.value = true

    // 直接调用保存
    await saveEmployee()
    success(`密码已重置，新密码：${generatedPassword}`, { duration: 8000 })
  } catch (err) {
    logger.error('重置密码失败:', err)
    error('重置密码失败')
  } finally {
    passwordResetting.value = false
  }
}

const generateRandomPassword = () => {
  const password = generateSecurePassword()
  employeeForm.value.password = password
  employeeForm.value.confirm_password = password
  showPasswordFields.value = true

  // 显示生成的密码
  success(`已生成随机密码：${password}，请点击"保存"按钮生效`, { duration: 5000 })
}

const generateSecurePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const randomValues = new Uint32Array(12)
  window.crypto.getRandomValues(randomValues)
  let password = ''
  for (const value of randomValues) {
    password += chars.charAt(value % chars.length)
  }

  return password
}



const toggleStatus = async (employee: Employee) => {
  if (!canEdit.value) {
    error('权限不足：您没有修改员工状态的权限')
    return
  }

  const currentStatus = employee.status === 1
  const action = currentStatus ? '设为离职' : '设为在职'
  try {
    await ElMessageBox.confirm(
      `确定要${action}员工 "${employee.name}" 吗？`,
      '状态变更确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  try {
    await unifiedApi.put(`/employees/${employee.id}`, { status: currentStatus ? 0 : 1 })
    await loadEmployees()
  } catch (error: any) {
    logger.error('更新状态失败:', error)
    handleApiError(error, '更新员工状态失败')
  }
}

const deleteEmployee = async (employee: Employee) => {
  if (!canDelete.value) {
    error('权限不足：您没有删除员工的权限')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除员工 "${employee.name}" 吗？\n\n⚠️ 此操作不可撤销，员工的所有数据将被永久删除！`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  try {
    await unifiedApi.delete(`/employees/${employee.id}`)
    success(`员工 "${employee.name}" 删除成功`)
    await loadEmployees()
  } catch (error: any) {
    logger.error('删除员工失败:', error)
    handleApiError(error, '删除员工失败')
  }
}


const getEmployeeIndex = (employeeId: number) => {
  // 根据员工在当前页的顺序计算序号（降序显示）
  const currentIndex = paginatedEmployees.value.findIndex(emp => emp.id === employeeId)
  const globalIndex = (page.value - 1) * page_size.value + currentIndex
  return filteredEmployees.value.length - globalIndex
}

const formatDate = (dateString: string | undefined, showTime = true) => {
  if (!dateString) return ''

  try {
    // 创建日期对象
    const date = new Date(dateString)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      logger.warn('无效的日期格式:', dateString)
      return '无效日期'
    }

    // 转换为中国时区时间
    const chinaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60 * 1000))

    // 格式化日期时间
    const year = chinaTime.getFullYear()
    const month = String(chinaTime.getMonth() + 1).padStart(2, '0')
    const day = String(chinaTime.getDate()).padStart(2, '0')

    // 如果只需要日期部分
    if (!showTime) {
      return `${year}-${month}-${day}`
    }

    const hours = String(chinaTime.getHours()).padStart(2, '0')
    const minutes = String(chinaTime.getMinutes()).padStart(2, '0')
    const seconds = String(chinaTime.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    logger.error('日期格式化错误:', { error, dateString })
    return '格式错误'
  }
}

// 角色显示辅助方法
const ROLE_ICON_PRESETS = [
  'fas fa-user-shield',
  'fas fa-user-tag',
  'fas fa-user-check',
  'fas fa-user-tie',
  'fas fa-user-cog',
  'fas fa-user'
]

const ROLE_BADGE_PRESETS = [
  'role-badge-admin',
  'role-badge-sales',
  'role-badge-purchase',
  'role-badge-finance',
  'role-badge-warehouse',
  'role-badge-repair',
  'role-badge-default'
]

const getRoleSeed = (roleName: string) => {
  return roleName.split('').reduce((seed, char) => ((seed * 31) + char.charCodeAt(0)) >>> 0, 0)
}

const getRoleDisplayName = (employee: Employee) => {
  // 优先显示自定义角色名称
  if (employee.role_names && employee.role_names !== '未分配角色' && employee.role_names !== '未分配') {
    return employee.role_names
  }
  return '未分配角色'
}

const getRoleIcon = (employee: Employee) => {
  const roleName = getRoleDisplayName(employee)
  if (!roleName || roleName === '未分配角色') {
    return 'fas fa-user'
  }

  return ROLE_ICON_PRESETS[getRoleSeed(roleName) % ROLE_ICON_PRESETS.length]
}

const getRoleBadgeClass = (employee: Employee) => {
  const roleName = getRoleDisplayName(employee)
  if (!roleName || roleName === '未分配角色') {
    return 'role-badge-default'
  }

  return ROLE_BADGE_PRESETS[getRoleSeed(roleName) % ROLE_BADGE_PRESETS.length]
}

// 角色管理相关方法

// 缓存键
const CACHE_KEYS = {
  roles: '/permissions/roles'
}

const loadRoles = async () => {
  loadingRoles.value = true
  try {
    // 使用API获取角色列表（使用缓存）
    const response = await useCachedRequest(CACHE_KEYS.roles, () =>
      unifiedApi.get('/permissions/roles'), DEFAULT_CACHE_TTL.STATIC)
    if (response && response.success && response.data) {
      roles.value = response.data.roles || []
    } else {
      roles.value = []
    }
  } catch (error) {
    logger.error('加载角色列表失败:', error)
    roles.value = []
  } finally {
    loadingRoles.value = false
  }
}


const editRole = (role: Role) => {
  if (!canEdit.value) {
    error('权限不足：您没有编辑角色的权限')
    return
  }

  editingRole.value = role
  roleForm.value = {
    name: role.name,
    description: role.description || ''
  }
  showEditRoleModal.value = true
}

const saveRole = async () => {
  if (savingRole.value) return

  if (showAddRoleModal.value && !canCreate.value) {
    error('权限不足：您没有新增角色的权限')
    return
  }

  if (showEditRoleModal.value && !canEdit.value) {
    error('权限不足：您没有编辑角色的权限')
    return
  }

  if (!roleForm.value.name.trim()) {
    roleFormError.value = '请输入角色名称'
    return
  }

  savingRole.value = true
  roleFormError.value = ''

  try {
    if (showAddRoleModal.value) {
      // 新增角色
      await unifiedApi.post('/employees/roles', roleForm.value)
      success('角色添加成功')
    } else {
      // 编辑角色
      if (editingRole.value) {
        await unifiedApi.put(`/employees/roles/${editingRole.value.id}`, roleForm.value)
        success('角色更新成功')
      }
    }

    closeRoleModal()
    await loadRoles()
  } catch (error: any) {
    logger.error('保存角色失败:', error)

    // 处理特定错误消息
    if (error.response?.data?.message) {
      const errorMessage = error.response.data.message
      if (errorMessage.includes('角色名称已存在')) {
        roleFormError.value = '该角色名称已存在，请使用其他名称'
      } else if (errorMessage.includes('角色不能为空')) {
        roleFormError.value = '角色名称不能为空'
      } else {
        roleFormError.value = errorMessage
      }
    } else {
      roleFormError.value = '保存角色失败，请稍后重试'
    }
  } finally {
    savingRole.value = false
  }
}

const deleteRole = async (role: Role) => {
  if (!canDelete.value) {
    error('权限不足：您没有删除角色的权限')
    return
  }

  if (role.user_count > 0) {
    warning(`该角色仍有 ${role.user_count} 个用户使用，无法删除`)
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除角色 "${role.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  try {
    await unifiedApi.delete(`/employees/roles/${role.id}`)
    success('角色删除成功')
    await loadRoles()
  } catch (error) {
    logger.error('删除角色失败:', error)
    handleApiError(error, '删除角色失败')
  }
}

const openAddRoleModal = () => {
  if (!canCreate.value) {
    error('权限不足：您没有新增角色的权限')
    return
  }

  roleFormError.value = ''
  showAddRoleModal.value = true
}

const closeRoleModal = () => {
  showAddRoleModal.value = false
  showEditRoleModal.value = false
  editingRole.value = null
  roleFormError.value = ''
  roleForm.value = {
    name: '',
    description: ''
  }
}

// 导出功能
const handleExport = async () => {
  await exportFile({
    url: '/employees/export',
    filename: buildDateFilename('员工数据', 'xlsx'),
    params: sanitizeParams({
      search: searchQuery.value,
      status: statusFilter.value
    }),
    allowed: canExport,
    loading: exporting,
    onNoPermission: () => error('权限不足：您没有导出员工数据的权限'),
    successMessage: '员工数据导出成功',
    errorMessage: '导出员工数据失败',
    onError: (err, defaultMessage) => handleApiError(err, defaultMessage)
  })
}

// 生命周期
onMounted(async () => {
  // 权限预检查，避免不必要的API调用
  if (!canView.value) {
    loading.value = false
    return
  }

  await initFieldPermissions()
  loadEmployees()
  loadRoles()
})
</script>

<style scoped>
.employees-view {
  padding: 24px;
  background: var(--tf-color-surface);
  min-height: 100vh;
}

/* 用户信息区域和操作按钮区域样式 */
.user-info-section {
  display: flex;
  align-items: center;
}

.action-buttons {
  display: flex;
}

/* 区域标题样式 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--tf-color-heading);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--tf-color-surface-muted);
}

.section-title i {
  color: var(--tf-color-indigo-brand);
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: var(--tf-color-muted);
  font-weight: 400;
}

.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid var(--tf-color-border-cool);
}

/* 表格区域样式 */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.table th {
  background: linear-gradient(135deg, var(--tf-color-gray-bootstrap-700) 0%, var(--tf-color-gray-bootstrap-800) 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  border-right: 1px solid var(--tf-color-border-subtle);
  border-bottom: 2px solid var(--tf-color-border-subtle);
  white-space: nowrap;
  position: relative;
  letter-spacing: 0.5px;
}

.table th:last-child {
  border-right: none;
  border-top-right-radius: 0;
}

.table th:first-child {
  border-top-left-radius: 0;
}

.table th::after {
  display: none;
}

.table td {
  padding: 6px 6px;
  font-size: 14px;
  border-right: 1px solid var(--tf-color-border-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
  vertical-align: middle;
  text-align: center;
  color: var(--tf-color-heading);
  font-weight: 500;
}

.table td:last-child {
  border-right: none;
}

.table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.table tbody tr:nth-child(even):not(.status-active-row):not(.status-inactive-row) {
  background: var(--tf-color-surface-muted);
}

.table tbody tr:hover:not(.status-active-row):not(.status-inactive-row) {
  background: var(--tf-color-blue-100);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.table tbody tr:hover td {
  border-bottom-color: var(--tf-color-border-subtle);
}

/* 表格内容样式 */
.id-badge {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.employee-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.employee-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  justify-content: center;
  font-size: 14px;
}

.employee-name strong {
  font-weight: 600;
  color: var(--tf-color-heading);
}

.employee-code {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--tf-color-gray-bootstrap-700);
  letter-spacing: 0.8px;
  background: var(--tf-color-surface-muted);
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--tf-color-border-muted);
  display: inline-block;
}

.employee-role {
  font-size: 12px;
  color: var(--tf-color-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.system-role {
  font-size: 12px;
  color: var(--tf-color-gray-bootstrap-700);
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
}

/* 角色徽章基础样式 */
.role-badge {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 16px;
  font-weight: 600;
  border: 1px solid transparent;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}

.role-badge i {
  font-size: 11px;
}

/* 管理员 - 橙红色渐变 */
.role-badge-admin {
  background: linear-gradient(135deg, var(--tf-color-orange-coral), var(--tf-color-orange-ant));
  color: white;
  border-color: var(--tf-color-red-legacy);
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}

/* 销售员 - 蓝绿色渐变 */
.role-badge-sales {
  background: linear-gradient(135deg, var(--tf-color-green-mint), var(--tf-color-cyan-mint));
  color: white;
  border-color: var(--tf-color-green-mint);
  box-shadow: 0 2px 8px rgba(0, 184, 148, 0.3);
}

/* 采购员 - 紫色渐变 */
.role-badge-purchase {
  background: linear-gradient(135deg, var(--tf-color-purple-flat), var(--tf-color-purple-flat-dark));
  color: white;
  border-color: var(--tf-color-purple-brand);
  box-shadow: 0 2px 8px rgba(155, 89, 182, 0.3);
}

/* 财务 - 金黄色渐变 */
.role-badge-finance {
  background: linear-gradient(135deg, var(--tf-color-amber-legacy), var(--tf-color-orange-legacy));
  color: white;
  border-color: var(--tf-color-amber-600);
  box-shadow: 0 2px 8px rgba(243, 156, 18, 0.3);
}

/* 仓管 - 青色渐变 */
.role-badge-warehouse {
  background: linear-gradient(135deg, var(--tf-color-teal-tailwind-500), var(--tf-color-transfer-chart-teal));
  color: white;
  border-color: var(--tf-color-emerald-600);
  box-shadow: 0 2px 8px rgba(26, 188, 156, 0.3);
}

/* 维修 - 灰蓝色渐变 */
.role-badge-repair {
  background: linear-gradient(135deg, var(--tf-color-gray-blue), var(--tf-color-slate-500));
  color: white;
  border-color: var(--tf-color-slate-600);
  box-shadow: 0 2px 8px rgba(96, 125, 139, 0.3);
}

/* 默认员工 - 蓝紫色渐变 */
.role-badge-default {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand), var(--tf-color-purple-brand));
  color: white;
  border-color: var(--tf-color-primary-legacy-dark);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.custom-roles {
  font-size: 11px;
  color: var(--tf-color-purple-bootstrap);
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  background: rgba(111, 66, 193, 0.1);
  padding: 2px 6px;
  border-radius: 12px;
  border: 1px solid rgba(111, 66, 193, 0.2);
  width: fit-content;
}

.employee-username {
  font-size: 12px;
  color: var(--tf-color-muted);
  margin-top: 2px;
}

.warning-badge {
  background: var(--warning-color);
  color: var(--tf-color-gray-bootstrap-900);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.contact-info {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
}

.phone-number {
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  text-align: center;
}

.no-data {
  color: var(--tf-color-gray-bootstrap-500);
  font-style: italic;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.status-badge i {
  font-size: 10px;
}

.status-active {
  background: rgba(40, 167, 69, 0.15);
  color: var(--success-color);
  border: 1px solid rgba(40, 167, 69, 0.4);
}

.status-inactive {
  background: rgba(220, 53, 69, 0.15);
  color: var(--danger-color);
  border: 1px solid rgba(220, 53, 69, 0.4);
}

/* 员工状态行背景 */
.status-active-row {
  background-color: white !important;
  transition: background-color 0.3s ease;
  border-left: 4px solid var(--success-color);
}

.status-active-row:hover {
  background-color: var(--tf-color-surface-muted) !important;
}

.status-inactive-row {
  background-color: rgba(220, 53, 69, 0.1) !important;
  transition: background-color 0.3s ease;
  border-left: 4px solid var(--danger-color);
}

.status-inactive-row:hover {
  background-color: rgba(220, 53, 69, 0.2) !important;
}

.time-info {
  font-size: 13px;
  color: var(--tf-color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 最后登录时间 - 蓝色 */
.time-info.last-login {
  color: var(--tf-color-blue-corporate);
  background: rgba(0, 102, 204, 0.08);
  font-weight: 500;
}

.time-info.last-login i {
  color: var(--tf-color-blue-corporate);
}

/* 创建时间 - 绿色 */
.time-info.created-time {
  color: var(--success-color);
  background: rgba(40, 167, 69, 0.08);
  font-weight: 500;
}

.time-info.created-time i {
  color: var(--success-color);
}

/* 入职时间 - 紫色 */
.time-info.hire-date {
  color: var(--tf-color-purple-bootstrap);
  background: rgba(111, 66, 193, 0.08);
  font-weight: 500;
}

.time-info.hire-date i {
  color: var(--tf-color-purple-bootstrap);
}

/* 空状态样式 */
.empty-row td {
  padding: 60px 12px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--tf-color-muted);
}

.empty-content i {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text h4 {
  margin: 0 0 8px 0;
  color: var(--tf-color-gray-bootstrap-700);
}

.empty-text p {
  margin: 0;
  font-size: 14px;
}

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

/* 自定义状态按钮样式 */
.btn[style*="var(--tf-color-orange-coral)"]:hover {
  background: var(--tf-button-neutral-hover-bg) !important;
  transform: translateY(-1px);
  box-shadow: var(--tf-button-shadow-hover);
}

.btn[style*="var(--tf-color-muted)"]:hover {
  background: var(--tf-button-neutral-hover-bg) !important;
  transform: translateY(-1px);
  box-shadow: var(--tf-button-shadow-hover);
}

/* 操作按钮容器样式 */
.actions {
  display: flex;
  justify-content: center;
}

.action-buttons {
  display: flex;
}

.action-buttons .btn {
  white-space: nowrap;
}



/* 密码管理区域样式 */
.password-section {
  margin: 20px 0;
  padding: 20px;
  border: 2px dashed var(--tf-color-border-subtle);
  border-radius: 8px;
  background: var(--tf-color-surface-muted);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--tf-color-border-subtle);
}

.section-header h4 {
  margin: 0;
  color: var(--tf-color-gray-bootstrap-700);
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h4 i {
  color: var(--warning-color);
  font-size: 18px;
}

.password-fields {
  margin-top: 15px;
}

.form-help {
  font-size: 12px;
  color: var(--tf-color-muted);
  margin-top: 4px;
  display: block;
}

.form-help.error {
  color: var(--danger-color);
  font-weight: 500;
}

.password-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--tf-color-border-subtle);
  justify-content: center;
  flex-wrap: wrap;
}

/* 密码输入框特殊样式 */
.password-fields input[type="password"] {
  border: 2px solid var(--tf-color-gray-bootstrap-300);
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
}

.password-fields input[type="password"]:focus {
  border-color: var(--warning-color);
  box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.1);
  outline: none;
}

.password-fields input[type="password"]::placeholder {
  color: var(--tf-color-gray-bootstrap-500);
  font-style: italic;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 5px;
  font-weight: 500;
  color: var(--tf-color-heading);
}

.form-group input,
.form-group select {
  padding: 10px;
  border: 1px solid var(--tf-color-gray-300-alt);
  border-radius: 5px;
  font-size: 14px;
}

.form-group input:disabled {
  background: var(--tf-color-surface-muted);
  color: var(--tf-color-muted);
}

.error-message {
  margin-top: 5px;
  padding: 8px 12px;
  background-color: var(--tf-color-red-surface-light);
  border: 1px solid var(--tf-color-red-pastel);
  border-radius: 4px;
  color: var(--tf-color-red-material-800);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.error-message i {
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--tf-color-gray-200-alt);
}

.salary-info {
  padding: 20px;
}

.salary-overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.overview-item {
  text-align: center;
  padding: 20px;
  background: var(--tf-color-surface-muted);
  border-radius: 8px;
}

.overview-item label {
  display: block;
  font-size: 14px;
  color: var(--tf-color-muted);
  margin-bottom: 8px;
}

.overview-item .amount {
  font-size: 24px;
  font-weight: 600;
  color: var(--tf-color-heading);
}

.salary-details h4 {
  margin-bottom: 15px;
  color: var(--tf-color-heading);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: var(--tf-color-surface-muted);
  border-radius: 5px;
}

.detail-item label {
  font-weight: 500;
  color: var(--tf-color-gray-bootstrap-700);
}

.detail-item span {
  color: var(--tf-color-heading);
  font-weight: 600;
}

.no-salary-info {
  text-align: center;
  padding: 40px;
  color: var(--tf-color-muted);
}

.no-salary-info i {
  font-size: 48px;
  margin-bottom: 15px;
  opacity: 0.5;
}

/* 角色管理样式 */
.role-management-section {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--tf-color-border-subtle);
}

.section-header h4 {
  margin: 0;
  color: var(--tf-color-gray-bootstrap-700);
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h4 i {
  color: var(--info-color);
  font-size: 18px;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.role-card {
  background: var(--tf-color-surface-muted);
  border: 1px solid var(--tf-color-border-subtle);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
}

.role-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.role-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.role-header h5 {
  margin: 0;
  color: var(--tf-color-heading);
  font-size: 16px;
  font-weight: 600;
}

.role-actions {
  display: flex;
  gap: 8px;
}

.role-description {
  color: var(--tf-color-muted);
  font-size: 14px;
  margin-bottom: 15px;
  line-height: 1.4;
}

.role-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--tf-color-muted);
}

.user-count {
  background: var(--info-color);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

/* 角色分配样式 */
.role-assignment-section {
  padding: 10px;
}

.current-roles, .available-roles {
  margin-bottom: 25px;
}

.current-roles h4, .available-roles h4 {
  margin-bottom: 15px;
  color: var(--tf-color-gray-bootstrap-700);
  font-size: 14px;
  font-weight: 600;
}

.no-roles {
  text-align: center;
  padding: 20px;
  color: var(--tf-color-muted);
  font-style: italic;
  background: var(--tf-color-surface-muted);
  border-radius: 8px;
  border: 1px dashed var(--tf-color-border-subtle);
}

.no-roles i {
  font-size: 24px;
  margin-bottom: 8px;
  opacity: 0.6;
}

.assigned-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--tf-color-purple-bootstrap);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.role-tag .remove-role {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0;
  font-size: 10px;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.role-tag .remove-role:hover {
  background: rgba(255,255,255,0.2);
}

.role-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  border: 1px solid var(--tf-color-border-subtle);
  border-radius: 8px;
  transition: all 0.3s ease;
  background: white;
}

.role-checkbox:hover {
  border-color: var(--tf-color-purple-bootstrap);
  background: var(--tf-color-surface-indigo-pale);
}

.role-checkbox input[type="checkbox"] {
  margin-top: 2px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.role-info {
  flex: 1;
}

.role-info strong {
  display: block;
  color: var(--tf-color-heading);
  margin-bottom: 4px;
}

.role-info small {
  color: var(--tf-color-muted);
  font-size: 12px;
  line-height: 1.3;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--tf-color-gray-200-alt);
}

/* 响应式设计 */
@media (max-width: 767px) {
  .employees-view {
    padding: 8px;
  }

  /* 页头内容保持水平一行显示 */
  .header-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .user-info-section {
    order: 2;
    width: 100%;
    justify-content: center;
  }

  .action-buttons {
    order: 1;
    display: flex;
    flex-direction: row;
    width: auto;
  }

  .form-actions {
    flex-direction: column;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .salary-overview {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .action-buttons {
    flex-direction: column;
  }

}

/* 角色复选框样式 */
.role-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--tf-color-border-muted);
  border-radius: 4px;
  background: var(--tf-color-surface-muted);
}

.role-checkbox {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-checkbox:hover {
  background: var(--tf-color-border-muted);
}

.role-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  cursor: pointer;
}

.role-info {
  flex: 1;
}

.role-info strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.role-info small {
  color: var(--tf-color-muted);
  font-size: 12px;
}

.no-roles {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--tf-color-muted);
}

.no-roles i {
  margin-right: 8px;
}

/* 状态按钮样式 */
.status-buttons {
  display: flex;
  gap: 10px;
}

.status-btn {
  flex: 1;
  padding: 10px 16px;
  border: 2px solid var(--tf-button-neutral-border);
  background: var(--tf-button-neutral-bg);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
  color: var(--tf-button-tool-color);
}

.status-btn:hover {
  border-color: var(--tf-button-neutral-hover-border);
  background: var(--tf-button-neutral-hover-bg);
}

.status-btn.active {
  border-color: var(--tf-status-success-border);
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
}

.status-btn.inactive {
  border-color: var(--tf-status-danger-border);
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
}

.status-btn i {
  font-size: 14px;
}

</style>

<style>
.employees-form-dialog {
  --dialog-max-width: 700px;
}

@media (max-width: 767px) {
  .employees-form-dialog {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 10px 8px 8px;
    --mobile-dialog-footer-padding: 0 8px 8px;
  }

  .mobile-dialog-sheet-overlay.employees-form-dialog {
    padding: 12px 6px !important;
  }

  .employees-form-dialog .el-form-item {
    margin-bottom: 12px;
  }

  .employees-form-dialog .el-form-item__label {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .employees-form-dialog .el-input__wrapper,
  .employees-form-dialog .el-select__wrapper,
  .employees-form-dialog .el-date-editor.el-input__wrapper,
  .employees-form-dialog .el-date-editor.el-input,
  .employees-form-dialog .el-textarea__inner {
    min-height: 42px;
    border-radius: 12px;
  }

  .employees-form-dialog .el-row {
    margin-left: 0 !important;
    margin-right: 0 !important;
    display: block;
  }

  .employees-form-dialog .el-row > .el-col {
    max-width: 100% !important;
    flex: 0 0 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .employees-form-dialog .el-checkbox-group {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .employees-form-dialog .el-checkbox {
    margin-right: 0;
    min-height: 40px;
    padding: 0;
    border: 1px solid var(--tf-color-border-blue);
    border-radius: 12px;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    background: var(--tf-color-surface-blue);
  }

  .employees-form-dialog .el-checkbox__label {
    width: 100%;
    padding: 0;
  }

  .employees-form-dialog .role-checkbox-content {
    width: 100%;
    min-height: 40px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    border-radius: 12px;
    background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-gray) 100%);
  }

  .employees-form-dialog .role-checkbox-name {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--tf-color-neutral-800);
  }

  .employees-form-dialog .el-radio-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .employees-form-dialog .el-radio {
    margin-right: 0;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--tf-color-border-blue);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
  }
}

@media (max-width: 480px) {
  .employees-form-dialog {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 8px 6px 6px;
    --mobile-dialog-footer-padding: 0 6px 6px;
  }

  .mobile-dialog-sheet-overlay.employees-form-dialog {
    padding: 12px 4px !important;
  }
}
</style>
