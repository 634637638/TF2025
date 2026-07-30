<template>
  <div class="page-container admin-page admin-unified-base-data-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="customers"
      module-name="客户管理"
      permission-code="customers:view"
    >

    <!-- 主要内容 -->
    <div class="page-content admin-page-content">
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader
        icon="fas fa-user"
        title="客户管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="requirePermission('create', openAddModal)"
            :disabled="isLoading"
          >
            <i class="fas fa-plus"></i>
            <span>新增</span>
          </el-button>
          <el-button
            v-if="canManagePoints"
            type="warning"
            plain
            :disabled="isLoading"
            @click="requirePermission('manage', openPointsSettings)"
          >
            <i class="fas fa-coins"></i>
            <span>积分设置</span>
          </el-button>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="isExporting"
            :export-disabled="isLoading || isExporting"
            @export="handleExport"
          />
          <el-button type="info" @click="handleRefresh" :disabled="isLoading || refreshing" :loading="refreshing">
            <i class="fas fa-sync-alt"></i>
            <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
          </el-button>
        </template>
      </PageHeader>

      <!-- 页面主体 -->
      <div class="page-body admin-page-content">
        <!-- 统计卡片 -->
        <div v-if="showStatsCards" class="stats-cards">
          <div v-if="canViewField('stats_total_customers')" class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-users"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalCustomers || 0 }}</div>
              <div class="stat-label">总客户数</div>
            </div>
          </div>
          <div v-if="canViewField('stats_active_customers')" class="stat-card">
            <div class="stat-icon active">
              <i class="fas fa-user-check"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.activeCustomers || 0 }}</div>
              <div class="stat-label">活跃客户</div>
            </div>
          </div>
          <div v-if="canViewField('stats_new_customers')" class="stat-card">
            <div class="stat-icon recent">
              <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.newCustomers || 0 }}</div>
              <div class="stat-label">本月新增</div>
            </div>
          </div>
          <div v-if="canViewField('stats_premium_customers')" class="stat-card">
            <div class="stat-icon premium">
              <i class="fas fa-crown"></i>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.premiumCustomers || 0 }}</div>
              <div class="stat-label">VIP客户</div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="isLoading"
          @search="handleSearch"
          @reset="handleReset"
        >
          <template #primary>
            <el-input
              v-if="showSearchKeyword"
              v-model="searchKeyword"
              placeholder="搜索姓名、手机号、邮箱、会员号、公司、地址..."
              clearable
              @input="debounceSearch"
              @keyup.enter="handleSearch"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search"></i>
              </template>
            </el-input>
          </template>

          <div v-if="canViewField('customer_type')" class="form-group filter-item" data-field="customerType">
              <el-select
                v-model="filterValues.customerType"
                placeholder="客户类型"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="type in CUSTOMER_TYPES"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                >
                  <span class="float-left">
                    <i :class="type.icon"></i>
                    {{ type.label }}
                  </span>
                </el-option>
              </el-select>
          </div>

          <div v-if="canViewField('status')" class="form-group filter-item" data-field="status">
              <el-select
                v-model="filterValues.status"
                placeholder="客户状态"
                clearable
                @change="handleSearch"
              >
                <el-option label="活跃" value="1" />
                <el-option label="非活跃" value="0" />
              </el-select>
          </div>

          <div v-if="canViewField('vip_level')" class="form-group filter-item" data-field="vipLevel">
              <el-select
                v-model="filterValues.vipLevel"
                placeholder="VIP等级"
                clearable
                @change="handleSearch"
              >
                <el-option label="普通会员" value="normal" />
                <el-option label="银卡会员" value="silver" />
                <el-option label="金卡会员" value="gold" />
                <el-option label="白金会员" value="platinum" />
              </el-select>
          </div>

          <!-- 注册日期范围筛选 -->
          <div v-if="canViewField('created_at')" class="form-group filter-item" data-field="registerDate">
              <el-date-picker
                v-model="registerDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="注册开始日期"
                end-placeholder="注册结束日期"
                value-format="YYYY-MM-DD"
                format="YYYY-MM-DD"
                clearable
                @change="handleDateRangeChange"
              />
          </div>
        </UnifiedSearchPanel>

        <!-- 数据表格区域 -->
        <div class="table-section admin-panel admin-table-panel">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list"></i>
              客户列表
              <span class="record-count">共 {{ pagination.total }} 条记录</span>
            </div>
            <div class="table-actions">
              <div v-if="hasSelection" class="selection-info">
                已选择 {{ selectedCount }} 项
                <el-button size="small" @click="clearSelection">
                  清空选择
                </el-button>
              </div>
            </div>
          </div>

          <div class="table-responsive">
            <!-- 错误状态 -->
            <div v-if="hasError" class="table-error">
              <el-empty description="加载失败" :image-size="200">
                <el-button type="primary" @click="refresh(() => loadCustomers())">
                  重试
                </el-button>
              </el-empty>
            </div>

            <!-- 正常内容 -->
            <el-table
              v-else
              ref="customersTableRef"
              :data="isLoading ? [] : customers"
              border
              stripe
              class="data-table devices-table base-data-table customers-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getCustomerRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @selection-change="handleSelectionChange"
              @row-click="handleCustomerRowClick"
            >
              <template #empty>
                <TableLoadingRow v-if="isLoading" mode="block" text="加载客户列表..." />
                <div v-else class="empty-state">
                  <i class="fas fa-users"></i>
                  <p>暂无客户数据</p>
                </div>
              </template>

              <el-table-column v-if="!isMobile" type="selection" width="48" align="center" />

              <el-table-column
                v-if="isMobile && showMemberNumberColumn"
                label="会员号"
                :min-width="customerMobileColumnWidths.memberNumber"
                align="center"
                class-name="identifier-column customers-cell-member"
              >
                <template #default="{ row: customer }">
                  <span v-if="customer.member_number" class="mobile-member-number" v-html="highlightText(customer.member_number, searchKeyword)"></span>
                  <span v-else>-</span>
                </template>
              </el-table-column>

              <el-table-column
                v-if="showCustomerInfoColumn"
                :label="isMobile ? '姓名' : '客户信息'"
                :min-width="isMobile ? customerMobileColumnWidths.name : 220"
                align="center"
              >
                <template #default="{ row: customer }">
                      <div class="customer-info">
                        <div class="customer-primary-line">
                          <strong v-if="canViewField('name')" class="customer-name" v-html="highlightText(customer.name || '-', searchKeyword)"></strong>
                          <span v-if="!isMobile && canViewField('id')" class="customer-id text-muted small">#{{ String(customer.id).padStart(6, '0') }}</span>
                          <span v-if="!isMobile && canViewField('member_number') && customer.member_number" class="member-number small text-primary">
                            <i class="fas fa-id-card"></i>
                            <span v-html="highlightText(customer.member_number, searchKeyword)"></span>
                          </span>
                        </div>
                      </div>
                </template>
              </el-table-column>

              <el-table-column
                v-if="!isMobile && showAppleIdColumn"
                label="Apple ID"
                min-width="170"
                align="center"
                class-name="customers-cell-apple-id identifier-column"
              >
                <template #default="{ row: customer }">
                  <span v-if="customer.apple_id" class="apple-id-value">
                    <i class="fab fa-apple"></i>
                    <span v-html="highlightText(customer.apple_id, searchKeyword)"></span>
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>

              <el-table-column
                v-if="showContactColumn"
                :label="isMobile ? '手机号' : '联系方式'"
                :min-width="isMobile ? customerMobileColumnWidths.phone : 220"
                align="center"
                class-name="customers-cell-phone"
              >
                <template #default="{ row: customer }">
                      <div class="contact-info">
                        <div v-if="canViewField('phone') && customer.phone" class="phone primary">
                          <i class="fas fa-phone"></i>
                          <span v-html="highlightText(customer.phone, searchKeyword)"></span>
                        </div>
                        <div v-if="!isMobile && ((canViewField('wechat') && customer.wechat) || (canViewField('qq') && customer.qq))" class="social-links small">
                          <span v-if="canViewField('wechat') && customer.wechat" class="social-tag" title="微信">
                            <i class="fab fa-weixin"></i>
                            <span v-html="highlightText(customer.wechat, searchKeyword)"></span>
                          </span>
                          <span v-if="canViewField('qq') && customer.qq" class="social-tag" title="QQ">
                            <i class="fab fa-qq"></i>
                            <span v-html="highlightText(customer.qq, searchKeyword)"></span>
                          </span>
                        </div>
                      </div>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showCustomerTypeColumn" label="客户类型" min-width="104" align="center">
                <template #default="{ row: customer }">
                      <el-tag v-if="canViewField('customer_type')" :type="getCustomerTypeTagType(customer.customer_type)" size="small">
                        {{ getCustomerTypeLabel(customer.customer_type) }}
                      </el-tag>
                      <div v-if="canViewField('blacklist') && customer.blacklist" class="small text-danger mt-1">
                        <i class="fas fa-exclamation-triangle"></i> 黑名单
                      </div>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showVipColumn" label="VIP等级" min-width="112" align="center">
                <template #default="{ row: customer }">
                      <el-tag :type="getVipLevelType(customer.vip_level)" size="small">
                        <i :class="getVipLevelIcon(customer.vip_level)" class="mr-1"></i>
                        {{ getVipLevelLabel(customer.vip_level) }}
                      </el-tag>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showAccountColumn" label="账户信息" min-width="126" align="center">
                <template #default="{ row: customer }">
                      <div class="account-info">
                        <div v-if="canViewField('balance')" class="table-info-line">
                          <span class="amount-label">余额</span>
                          <span class="amount-value">¥{{ formatNumber(customer.balance || 0) }}</span>
                        </div>
                        <div v-if="canViewField('points')" class="table-info-line">
                          <span class="points-label">积分</span>
                          <span class="points-value">{{ customer.points || 0 }}</span>
                        </div>
                      </div>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showRegionColumn" label="地区" min-width="178" align="center">
                <template #default="{ row: customer }">
                      <div class="location-info">
                        <div v-if="(canViewField('province') || canViewField('city')) && formatCustomerRegion(customer, { province: canViewField('province'), city: canViewField('city') }) !== '-'" class="table-info-line city">
                          <i class="fas fa-map-marker-alt"></i>
                          <span v-html="highlightText(formatCustomerRegion(customer, { province: canViewField('province'), city: canViewField('city') }), searchKeyword)"></span>
                        </div>
                        <div v-if="canViewField('address') && customer.address" class="table-info-line address small text-muted">
                          <i class="fas fa-home"></i>
                          <!-- 如果有搜索关键词，显示匹配的片段 -->
                          <span v-if="searchKeyword && isMatch(customer.address, searchKeyword)">
                            <span v-html="getMatchSnippet(customer.address, searchKeyword, 50, 20)"></span>
                          </span>
                          <!-- 否则显示截断的地址 -->
                          <span v-else>
                            {{ customer.address.length > 25 ? customer.address.substring(0, 25) + '...' : customer.address }}
                          </span>
                        </div>
                      </div>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showStatsColumn" label="消费统计" min-width="170" align="center">
                <template #default="{ row: customer }">
                      <div class="purchase-info">
                        <div class="table-info-line purchase-summary">
                          <span v-if="canViewField('purchase_count')" class="purchase-count">
                            <span class="count-label">购买数量</span>
                            <span class="count-value">{{ customer.purchase_count || 0 }} 台</span>
                          </span>
                          <span v-if="canViewField('total_spent')" class="total-spent">
                            <span class="spent-label">总消费</span>
                            <span class="spent-value">¥{{ formatNumber(customer.total_spent || 0) }}</span>
                          </span>
                        </div>
                        <div v-if="canViewField('last_purchase_date') && customer.last_purchase_date" class="table-info-line last-purchase small text-muted">
                          <span class="purchase-label">最后</span>
                          {{ formatDate(customer.last_purchase_date) }}
                        </div>
                      </div>
                </template>
              </el-table-column>

              <el-table-column v-if="!isMobile && showStatusColumn" label="状态" min-width="82" align="center">
                <template #default="{ row: customer }">
                      <el-tag :type="getStatusTagType(customer.status)" size="small">
                        {{ getStatusLabel(customer.status) }}
                      </el-tag>
                </template>
              </el-table-column>

              <el-table-column v-if="showActionField" label="操作" :width="customerActionColumnWidth" align="center" class-name="actions-column">
                <template #default="{ row: customer }">
                      <div class="action-buttons">
                        <el-button
                          v-if="canEdit"
                          type="primary"
                          size="small"
                          @click.stop="requirePermission('edit', () => editCustomer(customer))"
                          title="编辑客户"
                        >
                          <i class="fas fa-edit"></i>
                          编辑
                        </el-button>
                        <el-button
                          type="info"
                          size="small"
                          @click.stop="viewCustomerDetail(customer)"
                          title="查看详情"
                        >
                          <i class="fas fa-eye"></i>
                          详情
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          type="danger"
                          size="small"
                          @click.stop="requirePermission('delete', () => deleteCustomer(customer))"
                          title="删除客户"
                        >
                          <i class="fas fa-trash"></i>
                          删除
                        </el-button>
                      </div>
                </template>
              </el-table-column>

              <el-table-column
                v-if="isMobile && canViewField('actions') && (canEdit || canDelete || canView)"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row: customer }">
                  <div class="mobile-row-actions">
                        <el-button
                          v-if="canEdit"
                          type="primary"
                          size="small"
                          class="mobile-action-btn mobile-action-btn-edit"
                          @click.stop="requirePermission('edit', () => editCustomer(customer))"
                        >
                          <i class="fas fa-edit"></i>
                          <span>编辑</span>
                        </el-button>
                        <el-button
                          type="info"
                          size="small"
                          class="mobile-action-btn mobile-action-btn-view"
                          @click.stop="viewCustomerDetail(customer)"
                        >
                          <i class="fas fa-eye"></i>
                          <span>详情</span>
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          type="danger"
                          size="small"
                          class="mobile-action-btn mobile-action-btn-delete"
                          @click.stop="requirePermission('delete', () => deleteCustomer(customer))"
                        >
                          <i class="fas fa-trash"></i>
                          <span>删除</span>
                        </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 统一分页组件 -->
          <div class="table-pagination">
            <Pagination
              v-if="pagination.total > 0"
              v-model:current="pagination.page"
              v-model:page-size="pagination.pageSize"
              :total="pagination.total"
              :page-sizes="[20, 50, 100]"
              :show-total="true"
              :show-range="true"
              :show-page-sizes="true"
              :show-quick-jumper="true"
              :disabled="isLoading"
              @change="handlePaginationChange"
            />
          </div>
        </div>
      </div>

      <!-- 积分设置对话框 -->
      <MobileDialog
        v-model="showPointsSettingsModal"
        title="积分设置"
        width="560px"
        dialog-class="customers-points-dialog"
        :close-on-click-modal="false"
        :show-default-footer="false"
      >
        <el-form
          :model="pointsConfigForm"
          label-width="120px"
          class="points-settings-form"
          :disabled="pointsConfigLoading || pointsConfigSaving"
        >
          <el-form-item label="自动累计">
            <el-switch
              v-model="pointsConfigForm.enabled"
              active-text="启用"
              inactive-text="停用"
            />
          </el-form-item>

          <el-form-item label="积分比例" required>
            <div class="points-ratio-control">
              <span>消费</span>
              <el-input-number
                v-model="pointsConfigForm.amount_per_point"
                :min="1"
                :precision="2"
                :step="100"
                controls-position="right"
                class="points-ratio-input"
              />
              <span>元 = 1 积分</span>
            </div>
          </el-form-item>

          <el-form-item label="参与机况" required>
            <el-checkbox-group v-model="pointsIncludedConditions">
              <el-checkbox label="new">全新</el-checkbox>
              <el-checkbox label="used">二手</el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <div class="points-settings-preview">
            <div class="preview-title">
              <i class="fas fa-calculator"></i>
              当前规则
            </div>
            <div class="preview-content">
              {{ pointsConfigPreview }}
            </div>
          </div>
        </el-form>

        <template #footer>
          <el-button type="default" @click="closePointsSettings" :disabled="pointsConfigSaving">
            取消
          </el-button>
          <el-button
            type="primary"
            @click="savePointsSettings"
            :disabled="pointsConfigSaving || !pointsConfigValid"
            :loading="pointsConfigSaving"
          >
            保存设置
          </el-button>
        </template>
      </MobileDialog>

      <!-- 新增/编辑客户对话框 -->
      <MobileDialog
        v-model="showCustomerModal"
        :title="modalMode === 'add' ? '新增客户' : '编辑客户'"
        width="800px"
        dialog-class="customers-form-dialog"
        :close-on-click-modal="false"
        @close="closeCustomerModal"
        :show-default-footer="false"
      >
        <el-form :model="customerForm" label-width="100px" :disabled="isSubmitting" class="customers-dialog-form">
          <!-- 基本信息 -->
          <el-divider content-position="left">
            <i class="fas fa-user"></i> 基本信息
          </el-divider>

          <el-row :gutter="20">
            <el-col v-if="canViewField('name')" :span="12">
              <el-form-item label="客户姓名" required>
                <el-input
                  v-model="customerForm.name"
                  @input="handleCustomerNameInput"
                  placeholder="请输入客户姓名"
                  clearable
                  maxlength="50"
                  show-word-limit
                  :disabled="!canEditField('name')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('phone')" :span="12">
              <el-form-item label="联系电话" required>
                <el-input
                  v-model="customerForm.phone"
                  @input="handleCustomerPhoneInput"
                  placeholder="请输入联系电话"
                  clearable
                  maxlength="11"
                  :disabled="!canEditField('phone')"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col v-if="canViewField('email')" :span="12">
              <el-form-item label="邮箱地址">
                <el-input
                  v-model="customerForm.email"
                  placeholder="请输入邮箱地址"
                  clearable
                  :disabled="!canEditField('email')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('id_card')" :span="12">
              <el-form-item label="身份证号">
                <el-input
                  v-model="customerForm.id_card"
                  @input="handleIdCardInput"
                  placeholder="请输入身份证号"
                  clearable
                  maxlength="18"
                  :disabled="!canEditField('id_card')"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item v-if="canViewField('address')" label="地址">
            <el-input
              v-model="customerForm.address"
              placeholder="请输入详细地址"
              clearable
              maxlength="200"
              show-word-limit
              :disabled="!canEditField('address')"
            />
          </el-form-item>

          <!-- 客户属性 -->
          <el-divider content-position="left">
            <i class="fas fa-tag"></i> 客户属性
          </el-divider>

          <el-row :gutter="20">
            <el-col v-if="canViewField('customer_type')" :span="12">
              <el-form-item label="客户类型">
                <el-select
                  v-model="customerForm.customer_type"
                  placeholder="请选择客户类型"
                  class="w-full"
                  :disabled="!canEditField('customer_type')"
                >
                  <el-option
                    v-for="type in CUSTOMER_TYPES"
                    :key="type.value"
                    :label="type.label"
                    :value="type.value"
                  >
                    <span class="float-left">
                      <i :class="type.icon"></i>
                      {{ type.label }}
                    </span>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('vip_level')" :span="12">
              <el-form-item label="VIP等级">
                <el-select
                  v-model="customerForm.vip_level"
                  placeholder="请选择VIP等级"
                  class="w-full"
                  :disabled="!canEditField('vip_level')"
                >
                  <el-option
                    v-for="vip in VIP_LEVELS"
                    :key="vip.value"
                    :label="vip.label"
                    :value="vip.value"
                  >
                    <span class="float-left">
                      <i :class="vip.icon" :style="{ color: getVipColor(vip.value) }"></i>
                      {{ vip.label }}
                    </span>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col v-if="canViewField('gender')" :span="12">
              <el-form-item label="性别">
                <el-radio-group v-model="customerForm.gender" :disabled="!canEditField('gender')">
                  <el-radio value="male">男</el-radio>
                  <el-radio value="female">女</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('birthday')" :span="12">
              <el-form-item label="生日">
                <el-date-picker
                  v-model="customerForm.birthday"
                  type="date"
                  placeholder="请选择生日"
                  class="w-full"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  :disabled="!canEditField('birthday')"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item v-if="canViewField('city') || canViewField('province')" label="城市省份">
            <CitySelector
              v-model="cityLocation"
              @change="handleLocationChange"
            />
          </el-form-item>

          <!-- 联系方式 -->
          <el-divider content-position="left">
            <i class="fas fa-address-book"></i> 联系方式
          </el-divider>

          <el-row :gutter="20">
            <el-col v-if="canViewField('wechat')" :span="12">
              <el-form-item label="微信号">
                <el-input
                  v-model="customerForm.wechat"
                  placeholder="请输入微信号"
                  clearable
                  :disabled="!canEditField('wechat')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('qq')" :span="12">
              <el-form-item label="QQ号">
                <el-input
                  v-model="customerForm.qq"
                  placeholder="请输入QQ号"
                  clearable
                  maxlength="15"
                  :disabled="!canEditField('qq')"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item v-if="canViewField('apple_id')" label="Apple ID">
            <el-input
              v-model="customerForm.apple_id"
              placeholder="请输入Apple ID手机号或邮箱"
              clearable
              @input="handleAppleIdInput"
              :disabled="!canEditField('apple_id')"
            >
              <template #suffix>
                <i v-if="errors.apple_id" class="el-icon-warning text-danger"></i>
              </template>
            </el-input>
            <div v-if="errors.apple_id" class="el-form-item__error">
              {{ errors.apple_id }}
            </div>
            <div v-else class="el-form-item__tip">
              请输入有效的 Apple ID 手机号或邮箱
            </div>
          </el-form-item>

          <!-- 账户信息 -->
          <el-divider content-position="left">
            <i class="fas fa-wallet"></i> 账户信息
          </el-divider>

          <el-row :gutter="20">
            <el-col v-if="canViewField('balance')" :span="8">
              <el-form-item label="余额">
                <el-input-number
                  v-model="customerForm.balance"
                  :precision="2"
                  :step="0.01"
                  :min="0"
                  placeholder="请输入余额"
                  controls-position="right"
                  class="w-full"
                  :disabled="!canEditField('balance')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('points')" :span="8">
              <el-form-item label="积分">
                <el-input-number
                  v-model="customerForm.points"
                  :min="0"
                  placeholder="请输入积分"
                  controls-position="right"
                  class="w-full"
                  :disabled="!canEditField('points')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="canViewField('blacklist')" :span="8">
              <el-form-item label="黑名单状态">
                <el-switch
                  v-model="customerForm.blacklist"
                  active-text="黑名单"
                  inactive-text="正常"
                  :disabled="!canEditField('blacklist')"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 密码设置（仅编辑模式显示） -->
          <el-divider v-if="modalMode === 'edit'" content-position="left">
            <i class="fas fa-key"></i> 密码设置
          </el-divider>

          <el-row v-if="modalMode === 'edit'" :gutter="20">
            <el-col :span="24">
              <el-form-item label="修改密码">
                <el-checkbox v-model="customerForm.changePassword">启用密码修改</el-checkbox>
                <span class="text-secondary text-xs ml-3">
                  勾选后可为H5商城用户设置或修改登录密码
                </span>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row v-if="modalMode === 'edit' && customerForm.changePassword" :gutter="20">
            <el-col :span="12">
              <el-form-item label="新密码" required>
                <el-input
                  v-model="customerForm.password"
                  type="password"
                  placeholder="请输入新密码（至少6位）"
                  clearable
                  show-password
                  maxlength="20"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="确认密码" required>
                <el-input
                  v-model="customerForm.confirmPassword"
                  type="password"
                  placeholder="请再次输入新密码"
                  clearable
                  show-password
                  maxlength="20"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 备注 -->
          <el-divider content-position="left">
            <i class="fas fa-comment"></i> 备注
          </el-divider>

          <el-form-item v-if="canViewField('remarks')" label="备注">
            <el-input
              v-model="customerForm.remarks"
              type="textarea"
              placeholder="请输入备注信息"
              :rows="3"
              maxlength="500"
              show-word-limit
              :disabled="!canEditField('remarks')"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button type="default" @click="closeCustomerModal" :disabled="isSubmitting">
            取消
          </el-button>
          <el-button type="primary" @click="saveCustomer" :disabled="isSubmitting" :loading="isSubmitting">
            <span v-if="isSubmitting">保存中...</span>
            <template v-else>{{ modalMode === 'add' ? '新增' : '保存' }}</template>
          </el-button>
        </template>
      </MobileDialog>

      <!-- 客户详情对话框 -->
      <MobileDialog
        v-model="showDetailModal"
        title="客户详情"
        width="1000px"
        dialog-class="customers-detail-dialog"
        :close-on-click-modal="false"
        @close="closeDetailModal"
        :show-default-footer="false"
      >
        <div v-if="selectedCustomer" class="customer-detail-view admin-page">
          <!-- 客户信息面板 - 简洁设计 -->
          <div class="customer-info-panel">
            <!-- 左侧：基本信息和属性 -->
            <div class="panel-left">
              <div class="info-header">
                <div class="customer-avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="customer-basic">
                  <h3 class="customer-name">
                    {{ canViewField('name') ? selectedCustomer.name : `客户 #${String(selectedCustomer.id || '').padStart(6, '0')}` }}
                  </h3>
                  <div class="customer-meta">
                    <el-tag v-if="canViewField('customer_type')" :type="getCustomerTypeTagType(selectedCustomer.customer_type)" size="small">
                      {{ getCustomerTypeLabel(selectedCustomer.customer_type) }}
                    </el-tag>
                    <el-tag v-if="canViewField('vip_level')" :type="getVipLevelType(selectedCustomer.vip_level)" size="small">
                      <i :class="getVipLevelIcon(selectedCustomer.vip_level)"></i> {{ getVipLevelLabel(selectedCustomer.vip_level) }}
                    </el-tag>
                    <el-tag v-if="canViewField('status')" :type="selectedCustomer.status === 1 ? 'success' : 'info'" size="small">
                      {{ selectedCustomer.status === 1 ? '正常' : '禁用' }}
                    </el-tag>
                    <span v-if="canViewField('gender')" class="customer-gender-meta">
                      {{ getGenderLabel(selectedCustomer.gender) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="info-grid">
                <div v-if="canViewField('phone')" class="info-row info-row-phone">
                  <span class="label" title="电话" aria-label="电话">
                    <i class="fas fa-mobile-alt"></i>
                  </span>
                  <span class="value phone" :title="selectedCustomer.phone || '-'">{{ selectedCustomer.phone || '-' }}</span>
                </div>
                <div v-if="canViewField('member_number')" class="info-row info-row-member">
                  <span class="label" title="会员号" aria-label="会员号">
                    <i class="fas fa-id-badge"></i>
                  </span>
                  <span class="value" :title="selectedCustomer.member_number || '-'">{{ selectedCustomer.member_number || '-' }}</span>
                </div>
                <div v-if="canViewField('id_card')" class="info-row wide-info-row info-row-id-card">
                  <span class="label" title="身份证号" aria-label="身份证号">
                    <i class="fas fa-address-card"></i>
                  </span>
                  <span class="value" :title="selectedCustomer.id_card || '-'">{{ selectedCustomer.id_card || '-' }}</span>
                </div>
                <div v-if="canViewField('email')" class="info-row wide-info-row info-row-email">
                  <span class="label" title="邮箱" aria-label="邮箱">
                    <i class="fas fa-envelope"></i>
                  </span>
                  <span class="value" :title="selectedCustomer.email || '-'">{{ selectedCustomer.email || '-' }}</span>
                </div>
                <div v-if="canViewField('address')" class="info-row wide-info-row info-row-address">
                  <span class="label" title="地址" aria-label="地址">
                    <i class="fas fa-home"></i>
                  </span>
                  <span class="value" :title="selectedCustomer.address || '-'">{{ selectedCustomer.address || '-' }}</span>
                </div>
                <div v-if="canViewField('city') || canViewField('province')" class="info-row wide-info-row info-row-region">
                  <span class="label" title="地区" aria-label="地区">
                    <i class="fas fa-map-marker-alt"></i>
                  </span>
                  <span class="value" :title="formatCustomerRegion(selectedCustomer, { province: canViewField('province'), city: canViewField('city') })">{{ formatCustomerRegion(selectedCustomer, { province: canViewField('province'), city: canViewField('city') }) }}</span>
                </div>
              </div>
            </div>

            <!-- 右侧：账户统计 -->
            <div class="panel-right">
              <div class="stats-card">
                <div v-if="canViewField('balance')" class="stat-item">
                  <div class="stat-icon balance">
                    <i class="fas fa-wallet"></i>
                  </div>
                  <div class="stat-content">
                    <div class="stat-label">账户余额</div>
                    <div class="stat-value">¥{{ formatNumber(selectedCustomer.balance || 0) }}</div>
                  </div>
                </div>
                <div v-if="canViewField('points')" class="stat-item">
                  <div class="stat-icon points">
                    <i class="fas fa-star"></i>
                  </div>
                  <div class="stat-content">
                    <div class="stat-label">积分</div>
                    <div class="stat-value">{{ selectedCustomer.points || 0 }}</div>
                  </div>
                </div>
                <div v-if="canViewField('total_spent')" class="stat-item">
                  <div class="stat-icon spent">
                    <i class="fas fa-shopping-cart"></i>
                  </div>
                  <div class="stat-content">
                    <div class="stat-label">总消费</div>
                    <div class="stat-value">¥{{ formatNumber(selectedCustomer.total_spent || 0) }}</div>
                  </div>
                </div>
                <div v-if="canViewField('purchase_count')" class="stat-item">
                  <div class="stat-icon count">
                    <i class="fas fa-shopping-bag"></i>
                  </div>
                  <div class="stat-content">
                    <div class="stat-label">购买次数</div>
                    <div class="stat-value">{{ selectedCustomer.purchase_count || 0 }} 次</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 其他信息 -->
          <div class="extra-info" v-if="(canViewField('wechat') && selectedCustomer.wechat) || (canViewField('qq') && selectedCustomer.qq) || (canViewField('apple_id') && selectedCustomer.apple_id) || (canViewField('remarks') && selectedCustomer.remarks) || (canViewField('created_at') && selectedCustomer.created_at) || (canViewField('last_purchase_date') && selectedCustomer.last_purchase_date)">
            <div v-if="canViewField('wechat') && selectedCustomer.wechat" class="extra-info-item">
              <i class="fab fa-weixin text-wechat"></i>
              <span>微信: {{ selectedCustomer.wechat }}</span>
            </div>
            <div v-if="canViewField('qq') && selectedCustomer.qq" class="extra-info-item">
              <i class="fab fa-qq text-qq"></i>
              <span>QQ: {{ selectedCustomer.qq }}</span>
            </div>
            <div v-if="canViewField('apple_id') && selectedCustomer.apple_id" class="extra-info-item">
              <i class="fab fa-apple"></i>
              <span>Apple ID: {{ selectedCustomer.apple_id }}</span>
            </div>
            <div v-if="canViewField('created_at') && selectedCustomer.created_at" class="extra-info-item">
              <i class="fas fa-calendar-alt"></i>
              <span>注册时间: {{ formatDate(selectedCustomer.created_at) }}</span>
            </div>
            <div v-if="canViewField('last_purchase_date') && selectedCustomer.last_purchase_date" class="extra-info-item">
              <i class="fas fa-clock"></i>
              <span>最后购买: {{ formatDate(selectedCustomer.last_purchase_date) }}</span>
            </div>
            <div v-if="canViewField('remarks') && selectedCustomer.remarks" class="extra-info-item remarks">
              <i class="fas fa-comment"></i>
              <span>备注: {{ selectedCustomer.remarks }}</span>
            </div>
          </div>

          <!-- 购买记录表格 -->
          <el-divider content-position="left">
            <i class="fas fa-shopping-cart"></i> 购买记录
            <el-tag size="small" class="ml-3">共 {{ purchasesPagination.total }} 条</el-tag>
          </el-divider>

          <div v-if="customerPurchases.length > 0" class="purchases-section">
            <div class="table-responsive">
              <el-table
                :data="customerPurchases"
                border
                stripe
                class="data-table devices-table customer-purchases-table"
                table-layout="fixed"
                :fit="true"
                row-key="id"
              >
                <el-table-column label="序号" width="60" align="center">
                  <template #default="{ $index }">
                    <span class="index-badge">{{ $index + 1 }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="model" label="型号" min-width="116" align="center">
                  <template #default="{ row }">{{ row.model || '-' }}</template>
                </el-table-column>
                <el-table-column prop="color" label="颜色" min-width="82" align="center">
                  <template #default="{ row }">{{ row.color || '-' }}</template>
                </el-table-column>
                <el-table-column prop="memory" label="内存" min-width="86" align="center">
                  <template #default="{ row }">{{ row.memory || '-' }}</template>
                </el-table-column>
                <el-table-column label="成色" min-width="82" align="center">
                  <template #default="{ row: purchase }">
                      <el-tag :type="purchase.is_new === '全新' ? 'success' : 'warning'" size="small">
                        {{ purchase.is_new }}
                      </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="IMEI" :min-width="purchaseImeiColumnWidth" align="center" class-name="identifier-column">
                  <template #default="{ row: purchase }"><span class="imei">{{ purchase.imei || '-' }}</span></template>
                </el-table-column>
                <el-table-column label="序列号" :min-width="purchaseSerialColumnWidth" align="center" class-name="identifier-column">
                  <template #default="{ row: purchase }"><span class="serial-number">{{ purchase.serial_number || '-' }}</span></template>
                </el-table-column>
                <el-table-column label="售价" min-width="96" align="center">
                  <template #default="{ row: purchase }"><span class="price">¥{{ formatNumber(purchase.sale_price) }}</span></template>
                </el-table-column>
                <el-table-column label="利润" min-width="96" align="center">
                  <template #default="{ row: purchase }">
                    <span :class="['price-cell', Number(purchase.profit) > 0 ? 'profit-positive' : 'profit-negative']">
                      ¥{{ formatNumber(purchase.profit) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="销售日期" min-width="132" align="center">
                  <template #default="{ row: purchase }"><span class="time-cell">{{ formatDate(purchase.sale_date) }}</span></template>
                </el-table-column>
                <el-table-column prop="salesperson" label="销售员" min-width="96" align="center">
                  <template #default="{ row }">{{ row.salesperson || '-' }}</template>
                </el-table-column>
              </el-table>
            </div>

            <Pagination
              v-if="customerPurchases.length > 0"
              v-model:current="purchasesPagination.page"
              v-model:page-size="purchasesPagination.limit"
              :total="Number(purchasesPagination.total)"
              :page-sizes="[10, 20, 50, 100]"
              size="small"
              :show-range="true"
              @change="handlePurchasesPaginationChange"
            />
          </div>
          <el-empty v-else description="暂无购买记录" :image-size="200">
            <template #description>
              <p class="text-muted">该客户还没有购买记录</p>
            </template>
          </el-empty>
        </div>

        <template #footer>
          <el-button type="default" @click="closeDetailModal">
            关闭
          </el-button>
        </template>
      </MobileDialog>
    </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { useRefreshData } from '@/composables/useRefreshData'
import { useDebounce, useSearchDebounce } from '@/composables/useDebounce'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useSearchHighlight } from '@/composables/useSearchHighlight'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { unifiedApi } from '@/utils/unified-api'
import { useMobile } from '@/composables/mobile'
import { ElEmpty, ElButton, ElMessageBox, ElTable } from 'element-plus'
import Pagination from '../../components/Pagination.vue'
import CitySelector from '../../components/CitySelector.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionGate, PageHeader } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { getActionColumnMinWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { isValidAppleAccount, isValidEmail, isValidIdCard, isValidMobilePhone, normalizeAppleId, normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'

interface CustomerListItem {
  id: number
  name?: string
  phone?: string
  email?: string
  member_number?: string
  customer_type?: string
  vip_level?: string
  gender?: string
  birthday?: string
  id_card?: string
  wechat?: string
  qq?: string
  apple_id?: string
  address?: string
  city?: string
  province?: string
  balance?: number | string
  points?: number | string
  blacklist?: boolean
  remarks?: string
  purchase_count?: number | string
  total_spent?: number | string
  last_purchase_date?: string
  created_at?: string
  status?: string | number
}

interface CustomerFormState {
  id: number | null
  name: string
  phone: string
  email: string
  customer_type: string
  vip_level: string
  gender: string
  birthday: string
  id_card: string
  wechat: string
  qq: string
  apple_id: string
  address: string
  city: string
  province: string
  balance: number
  points: number
  blacklist: boolean
  remarks: string
  changePassword: boolean
  password: string
  confirmPassword: string
}

interface CustomerPurchaseItem {
  id: number
  brand?: string
  model?: string
  color?: string
  memory?: string
  imei?: string
  serial_number?: string
  sale_price?: number | string
  purchase_price?: number | string
  sale_date?: string
  created_at?: string
  payment_method?: string
  status?: string
  is_new?: string
  profit?: number | string
  salesperson?: string
}

interface CustomerPurchasesPagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface CustomerStatsState {
  totalCustomers: number
  activeCustomers: number
  newCustomers: number
  premiumCustomers: number
}

interface CustomersQueryParams {
  page: number
  limit: number
  search?: string
  search_fields?: string
  search_type?: string
  customer_type?: string
  status?: string
  vip_level?: string
  register_date_start?: string
  register_date_end?: string
  sort_by: string
  sort_order: string
}

interface CustomerListResponseData {
  customers?: CustomerListItem[]
  pagination?: {
    total?: number
  }
  stats?: Partial<CustomerStatsState>
}

interface CustomerPurchasesResponseData {
  purchases?: CustomerPurchaseItem[]
  pagination?: Partial<CustomerPurchasesPagination>
}

interface CustomerPointsConfig {
  enabled: boolean
  amount_per_point: number
  include_new: boolean
  include_used: boolean
}

// 权限管理
const {
  hasPermission,
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  getModulePermissions,
  requirePermission,
  handleNoPermission
} = usePagePermissions('customers')

const canManagePoints = computed(() => hasPermission('manage'))

// 路由和状态管理
const router = useRouter()
const { success, error, warning, info, handleApiError, confirm } = useNotification({ debounce: true })
const { refreshing, refresh } = useRefreshData()
const { init: initFieldPermissions } = fieldPermissions
const { isMobile } = useMobile()

// 搜索高亮
const { highlightText, isMatch, getMatchSnippet } = useSearchHighlight()

// 基础状态管理
const { loading: isLoading } = useLoadingState()
isLoading.value = true
const { loading: isSubmitting } = useLoadingState()
const errorMessage = ref('')
const hasError = computed(() => !!errorMessage.value)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const selectedRows = ref<CustomerListItem[]>([])
const customersTableRef = ref<InstanceType<typeof ElTable> | null>(null)
const searchKeyword = ref('')
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const customerFieldMap: Record<string, string> = {
  stats_total_customers: 'stats.total_customers',
  stats_active_customers: 'stats.active_customers',
  stats_new_customers: 'stats.new_customers',
  stats_premium_customers: 'stats.premium_customers',
  id: 'customer.id',
  name: 'customer.name',
  phone: 'customer.phone',
  email: 'customer.email',
  customer_type: 'customer.customer_type',
  vip_level: 'customer.vip_level',
  gender: 'customer.gender',
  birthday: 'customer.birthday',
  id_card: 'customer.id_card',
  wechat: 'customer.wechat',
  qq: 'customer.qq',
  apple_id: 'customer.apple_id',
  address: 'customer.address',
  city: 'customer.city',
  province: 'customer.province',
  balance: 'customer.balance',
  points: 'customer.points',
  blacklist: 'customer.blacklist',
  remarks: 'customer.remarks',
  purchase_count: 'customer.purchase_count',
  total_spent: 'customer.total_spent',
  last_purchase_date: 'customer.last_purchase_date',
  member_number: 'customer.member_number',
  status: 'customer.status',
  created_at: 'customer.created_at',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => customerFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('customers_customersview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('customers_customersview', getFieldKey(fieldName))
}

const showSearchKeyword = computed(() => {
  return ['name', 'phone', 'email', 'member_number', 'address'].some(fieldName => canViewField(fieldName))
})

const showMemberNumberColumn = computed(() => canViewField('member_number'))
const showNameColumn = computed(() => canViewField('name'))
const showPhoneColumn = computed(() => canViewField('phone'))
const showAppleIdColumn = computed(() => canViewField('apple_id'))

const showCustomerInfoColumn = computed(() => {
  if (isMobile.value) {
    return showNameColumn.value
  }
  return ['id', 'name', 'member_number'].some(fieldName => canViewField(fieldName))
})

const showContactColumn = computed(() => {
  if (isMobile.value) {
    return showPhoneColumn.value
  }
  return ['phone', 'wechat', 'qq'].some(fieldName => canViewField(fieldName))
})

const showCustomerTypeColumn = computed(() => {
  return canViewField('customer_type') || canViewField('blacklist')
})

const showVipColumn = computed(() => canViewField('vip_level'))
const showAccountColumn = computed(() => ['balance', 'points'].some(fieldName => canViewField(fieldName)))
const showRegionColumn = computed(() => ['city', 'province', 'address'].some(fieldName => canViewField(fieldName)))
const showStatsColumn = computed(() => ['total_spent', 'purchase_count', 'last_purchase_date'].some(fieldName => canViewField(fieldName)))
const showStatusColumn = computed(() => canViewField('status'))
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value || canView.value) && !isMobile.value)
const customerActionColumnWidth = computed(() => getActionColumnMinWidth([
  ...(canEdit.value ? ['编辑'] : []),
  '详情',
  ...(canDelete.value ? ['删除'] : [])
]))
const showStatsCards = computed(() => (
  canViewField('stats_total_customers') ||
  canViewField('stats_active_customers') ||
  canViewField('stats_new_customers') ||
  canViewField('stats_premium_customers')
))
const customerMobileColumnWidths = computed(() => ({
  memberNumber: getIdentifierColumnMinWidth(
    ['会员号', ...customers.value.map(customer => customer.member_number)],
    { minWidth: 88, horizontalPadding: 24 }
  ),
  name: getTextColumnMinWidth(
    ['姓名', ...customers.value.map(customer => customer.name)],
    { minWidth: 84, horizontalPadding: 24 }
  ),
  phone: getIdentifierColumnMinWidth(
    ['手机号', ...customers.value.map(customer => customer.phone)],
    { minWidth: 116, horizontalPadding: 24 }
  )
}))

const getCustomerRowKey = (row: CustomerListItem) => String(row.id)

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  const rowId = String(id)
  mobileActionRowId.value = mobileActionRowId.value === rowId ? null : rowId
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return

  const rowId = String(id)
  const now = Date.now()
  if (lastTappedRowId.value === rowId && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = rowId
  lastTapTimestamp.value = now
}

const handleCustomerRowClick = (row: CustomerListItem, _column: unknown, event: Event) => {
  if (!isMobile.value) return

  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select, .el-button, .el-input, .el-select')) return
  handleMobileRowTap(row.id)
}

// 表格操作方法
const clearSelection = () => {
  customersTableRef.value?.clearSelection()
  selectedRows.value = []
}

const handleSelectionChange = (rows: CustomerListItem[]) => {
  selectedRows.value = rows
}

const setPagination = (page, pageSize, total) => {
  pagination.page = page
  pagination.pageSize = pageSize
  pagination.total = total
}

const setDataLoading = (loading) => {
  isLoading.value = loading
}

const setError = (message) => {
  errorMessage.value = message
}

const clearError = () => {
  errorMessage.value = ''
}

const handlePageError = (err, defaultMessage) => {
  logger.error(defaultMessage, err)
  setError(err.message || defaultMessage)
  error(err.message || defaultMessage)
}

const setSubmitLoading = (loading) => {
  isSubmitting.value = loading
}

// 加载状态
const { loading: isExporting } = useLoadingState()
const { loading: isRefreshing } = useLoadingState()
const { exportFile, buildDateFilename, sanitizeParams } = useImportExport()

// 搜索和筛选
const { handleSearchInput, clearSearch: resetSearchKeyword } = useSearchDebounce(
  (keyword: string) => {
    performSearch(keyword)
  },
  500
)

// 刷新防抖 - 使用防抖防止频繁刷新
let refreshTimeoutId: NodeJS.Timeout | null = null

const debouncedRefresh = async () => {
  // 取消之前的刷新
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId)
  }

  // 返回一个 Promise，在延迟后执行
  return new Promise((resolve) => {
    refreshTimeoutId = setTimeout(async () => {
      try {
        await Promise.all([
          loadCustomers(false),
          loadStats()
        ])
        success('数据刷新成功')
      } catch (err) {
        error('刷新失败：请稍后重试')
      } finally {
        resolve(true)
      }
    }, 300) // 300ms 防抖
  })
}

// 工具函数：获取本月开始和结束日期
const getMonthStart = () => {
  return TimeUtil.format(TimeUtil.startOf(TimeUtil.now(), 'month'), TIME_FORMATS.DATE)
}

const getMonthEnd = () => {
  return TimeUtil.format(TimeUtil.endOf(TimeUtil.now(), 'month'), TIME_FORMATS.DATE)
}

const filterValues = reactive({
  customerType: '',
  status: '',
  vipLevel: '',
  registerDateStart: '',
  registerDateEnd: ''
})

// 搜索相关状态
const searchExpanded = ref(false)

// 日期范围选择器变量
const registerDateRange = ref<[string, string] | null>(null)

// 客户类型配置（统一管理）
const CUSTOMER_TYPES = [
  { value: 'individual', label: '个人客户', icon: 'fas fa-user' },
  { value: 'enterprise', label: '企业客户', icon: 'fas fa-building' },
  { value: 'wholesale', label: '同行调货', icon: 'fas fa-exchange-alt' },
  { value: 'allocate', label: '同行划拨', icon: 'fas fa-dolly' }
] as const

// VIP等级配置（统一管理）- 必须在 filterConfigs 之前定义
const VIP_LEVELS = [
  { value: 'normal', label: '普通会员', color: 'info', icon: 'fas fa-user' },
  { value: 'silver', label: '白银会员', color: 'primary', icon: 'fas fa-star' },
  { value: 'gold', label: '黄金会员', color: 'warning', icon: 'fas fa-crown' },
  { value: 'platinum', label: '铂金会员', color: 'danger', icon: 'fas fa-gem' }
] as const

const ALLOWED_VIP_LEVELS = new Set<string>(VIP_LEVELS.map(vip => vip.value))

const PROVINCE_NAME_BY_CODE: Record<string, string> = {
  '11': '北京市',
  '12': '天津市',
  '13': '河北省',
  '14': '山西省',
  '15': '内蒙古自治区',
  '21': '辽宁省',
  '22': '吉林省',
  '23': '黑龙江省',
  '31': '上海市',
  '32': '江苏省',
  '33': '浙江省',
  '34': '安徽省',
  '35': '福建省',
  '36': '江西省',
  '37': '山东省',
  '41': '河南省',
  '42': '湖北省',
  '43': '湖南省',
  '44': '广东省',
  '45': '广西壮族自治区',
  '46': '海南省',
  '50': '重庆市',
  '51': '四川省',
  '52': '贵州省',
  '53': '云南省',
  '54': '西藏自治区',
  '61': '陕西省',
  '62': '甘肃省',
  '63': '青海省',
  '64': '宁夏回族自治区',
  '65': '新疆维吾尔自治区',
  '71': '台湾省',
  '81': '香港特别行政区',
  '82': '澳门特别行政区'
}

// 筛选器配置
const filterConfigs = [
  {
    key: 'customerType',
    label: '客户类型',
    type: 'select' as const,
    options: CUSTOMER_TYPES.map(t => ({ label: t.label, value: t.value })),
    allText: '全部类型'
  },
  {
    key: 'status',
    label: '客户状态',
    type: 'select' as const,
    options: [
      { label: '活跃', value: 'active' },
      { label: '非活跃', value: 'inactive' },
      { label: '黑名单', value: 'blacklist' }
    ],
    allText: '全部状态'
  },
  {
    key: 'vipLevel',
    label: 'VIP等级',
    type: 'select' as const,
    options: VIP_LEVELS.map(v => ({ label: v.label, value: v.value })),
    allText: '全部等级'
  },
  {
    key: 'registerDate',
    label: '注册日期',
    type: 'daterange' as const
  }
]

// 快捷标签
const quickTags = [
  {
    key: 'vip-customers',
    label: 'VIP客户',
    filters: { customerType: 'vip' }
  },
  {
    key: 'wholesale-customers',
    label: '同行（批发）',
    filters: { customerType: 'wholesale' }
  },
  {
    key: 'new-customers',
    label: '本月新增',
    filters: {
      registerDateStart: getMonthStart(),
      registerDateEnd: getMonthEnd()
    }
  },
  {
    key: 'active-customers',
    label: '活跃客户',
    filters: { status: 'active' }
  },
  {
    key: 'blacklist',
    label: '黑名单',
    filters: { status: 'blacklist' }
  }
]

// 数据状态
const customers = ref<CustomerListItem[]>([])
const stats = reactive<CustomerStatsState>({
  totalCustomers: 0,
  activeCustomers: 0,
  newCustomers: 0,
  premiumCustomers: 0
})

// 模态框状态
const showCustomerModal = ref(false)
const showDetailModal = ref(false)
const showPointsSettingsModal = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const customerForm = ref<CustomerFormState>({
  id: null,
  name: '',
  phone: '',
  email: '',
  customer_type: 'individual',
  vip_level: 'normal',
  gender: '',
  birthday: '',
  id_card: '',
  wechat: '',
  qq: '',
  apple_id: '',
  address: '',
  city: '',
  province: '',
  balance: 0,
  points: 0,
  blacklist: false,
  remarks: '',
  changePassword: false,
  password: '',
  confirmPassword: ''
})
const selectedCustomer = ref<CustomerListItem | null>(null)
const pointsConfigLoading = ref(false)
const pointsConfigSaving = ref(false)
const pointsConfigForm = ref<CustomerPointsConfig>({
  enabled: true,
  amount_per_point: 100,
  include_new: true,
  include_used: true
})

const pointsIncludedConditions = computed<string[]>({
  get: () => {
    const conditions: string[] = []
    if (pointsConfigForm.value.include_new) conditions.push('new')
    if (pointsConfigForm.value.include_used) conditions.push('used')
    return conditions
  },
  set: (conditions) => {
    pointsConfigForm.value.include_new = conditions.includes('new')
    pointsConfigForm.value.include_used = conditions.includes('used')
  }
})

const pointsConfigValid = computed(() => (
  Number(pointsConfigForm.value.amount_per_point) > 0 &&
  (pointsConfigForm.value.include_new || pointsConfigForm.value.include_used)
))

const pointsConfigPreview = computed(() => {
  const amount = Number(pointsConfigForm.value.amount_per_point) || 0
  const conditions = [
    pointsConfigForm.value.include_new ? '全新' : '',
    pointsConfigForm.value.include_used ? '二手' : ''
  ].filter(Boolean).join('、') || '未选择机况'

  if (!pointsConfigForm.value.enabled) {
    return `自动积分已停用；销售出库暂不累计积分。`
  }

  return `${conditions}参与积分，销售出库按消费 ${amount} 元累计 1 积分；批发、划拨不计积分。`
})

// 表单验证错误
const errors = ref<Record<string, string>>({})

// 客户消费记录
const customerPurchases = ref<CustomerPurchaseItem[]>([])
const purchaseImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...customerPurchases.value.map(purchase => purchase.imei)],
  { minWidth: 146, horizontalPadding: 32 }
))
const purchaseSerialColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['序列号', ...customerPurchases.value.map(purchase => purchase.serial_number)],
  { minWidth: 132, horizontalPadding: 32 }
))
const purchasesPagination = ref<CustomerPurchasesPagination>({
  page: 1,
  limit: 10,
  total: 0,
  pages: 0
})
const { loading: purchasesLoading } = useLoadingState()

// 城市省份选择器数据
const cityLocation = ref({
  province: '',
  city: ''
})

// 处理城市省份变化
const handleLocationChange = (location: { province: string; city: string }) => {
  customerForm.value.province = location.province
  customerForm.value.city = location.city
}

const handleCustomerNameInput = (value: string) => {
  customerForm.value.name = normalizePersonName(value, 50)
}

const handleCustomerPhoneInput = (value: string) => {
  customerForm.value.phone = normalizePhoneDigits(value)
}

const handleIdCardInput = (value: string) => {
  customerForm.value.id_card = normalizeIdCard(value)
}

// 处理 Apple ID 输入，统一过滤非法字符并校验手机号/邮箱格式
const handleAppleIdInput = (value: string) => {
  const filteredValue = normalizeAppleId(value)

  // 更新输入框的值
  if (value !== filteredValue) {
    customerForm.value.apple_id = filteredValue
  }

  // 如果有值，验证手机号或邮箱格式
  if (filteredValue) {
    if (!isValidAppleAccount(filteredValue)) {
      errors.value.apple_id = '请输入有效的 Apple ID 手机号或邮箱'
    } else {
      delete errors.value.apple_id
    }
  } else {
    delete errors.value.apple_id
  }
}

const applyPointsConfig = (config?: Partial<CustomerPointsConfig>) => {
  pointsConfigForm.value = {
    enabled: config?.enabled ?? true,
    amount_per_point: Number(config?.amount_per_point) > 0 ? Number(config?.amount_per_point) : 100,
    include_new: config?.include_new ?? true,
    include_used: config?.include_used ?? true
  }
}

const loadPointsSettings = async () => {
  pointsConfigLoading.value = true
  try {
    const response = await unifiedApi.get('/customers/points-config')
    if (response.success) {
      applyPointsConfig(response.data)
    }
  } catch (err) {
    handleApiError(err, '获取积分设置失败')
  } finally {
    pointsConfigLoading.value = false
  }
}

const openPointsSettings = async () => {
  showPointsSettingsModal.value = true
  await loadPointsSettings()
}

const closePointsSettings = () => {
  showPointsSettingsModal.value = false
}

const savePointsSettings = async () => {
  if (!pointsConfigValid.value) {
    warning('请设置有效的积分比例，并至少选择一种参与机况')
    return
  }

  pointsConfigSaving.value = true
  try {
    const response = await unifiedApi.put('/customers/points-config', {
      enabled: pointsConfigForm.value.enabled,
      amount_per_point: Number(pointsConfigForm.value.amount_per_point),
      include_new: pointsConfigForm.value.include_new,
      include_used: pointsConfigForm.value.include_used
    })

    if (response.success) {
      applyPointsConfig(response.data)
      success('积分设置保存成功')
      closePointsSettings()
    } else {
      error(response.message || '积分设置保存失败')
    }
  } catch (err) {
    handleApiError(err, '积分设置保存失败')
  } finally {
    pointsConfigSaving.value = false
  }
}

// 方法
const performSearch = (keyword: string) => {
  // 更新搜索并重新加载数据
  pagination.page = 1
  loadCustomers()
}

// 防抖搜索 - 输入框输入时延迟搜索
let debounceSearchTimeoutId: NodeJS.Timeout | null = null

const debounceSearch = () => {
  // 取消之前的搜索
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
  }
  // 设置延迟搜索
  debounceSearchTimeoutId = setTimeout(() => {
    pagination.page = 1
    loadCustomers()
  }, 500) // 500ms 防抖
}

const handleSearch = () => {
  // 重置到第一页
  pagination.page = 1
  loadCustomers()
}

// 日期范围变化处理
const handleDateRangeChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filterValues.registerDateStart = value[0]
    filterValues.registerDateEnd = value[1]
  } else {
    filterValues.registerDateStart = ''
    filterValues.registerDateEnd = ''
  }
  handleSearch()
}

const handleReset = () => {
  // 清空搜索关键词
  searchKeyword.value = ''
  // 清空日期范围
  registerDateRange.value = null
  // 清空筛选条件
  Object.keys(filterValues).forEach(key => {
    filterValues[key] = ''
  })
  // 重置到第一页
  pagination.page = 1
  loadCustomers()
}

const handlePaginationChange = (page: number, pageSize: number) => {
  setPagination(page, pageSize, pagination.total)
  loadCustomers()
}

const loadCustomers = async (showLoadingState = true) => {
  if (!canView.value) {
    customers.value = []
    setPagination(1, pagination.pageSize, 0)
    setDataLoading(false)
    return
  }

  try {
    if (showLoadingState) {
      setDataLoading(true)
    }
    clearError()

    // 构建搜索参数
    const params: CustomersQueryParams = {
      page: pagination.page,
      limit: pagination.pageSize,
      sort_by: 'created_at',
      sort_order: 'desc'
    }

    // 添加关键词搜索（支持多字段模糊搜索）
    if (searchKeyword.value) {
      params.search = searchKeyword.value
      // 指定搜索字段
      params.search_fields = [
        'name',           // 客户姓名
        'phone',          // 手机号
        'email',          // 邮箱
        'member_number',  // 会员号
        'company_name',  // 企业名称
        'contact_person', // 联系人
        'address',        // 地址
        'remark'          // 备注
      ].join(',')
      params.search_type = 'fuzzy' // 模糊搜索模式
    }

    // 添加筛选条件
    if (filterValues.customerType) {
      params.customer_type = filterValues.customerType
    }
    if (filterValues.status) {
      params.status = filterValues.status
    }
    if (filterValues.vipLevel) {
      params.vip_level = filterValues.vipLevel
    }
    if (filterValues.registerDateStart) {
      params.register_date_start = filterValues.registerDateStart
    }
    if (filterValues.registerDateEnd) {
      params.register_date_end = filterValues.registerDateEnd
    }

    const response = await unifiedApi.get('/customers', { params })

    if (response.success) {
      const responseData = (response.data || {}) as CustomerListResponseData
      customers.value = Array.isArray(responseData.customers) ? responseData.customers : []
      setPagination(
        pagination.page,
        pagination.pageSize,
        Number(responseData.pagination?.total) || 0
      )

      // 更新统计数据
      Object.assign(stats, responseData.stats || {})

      // 搜索成功通知（仅在实际搜索时显示）
      if (searchKeyword.value && !isLoading.value) {
        // 高亮显示搜索结果统计
        const searchResults = responseData.pagination?.total || 0
        if (searchResults > 0) {
          info(`找到 ${searchResults} 条匹配的客户`)
        }
      }
    } else {
      setError(response.message || '加载客户列表失败')
    }
  } catch (err) {
    handlePageError(err, '加载客户列表失败')
  } finally {
    if (showLoadingState) {
      setDataLoading(false)
    }
  }
}

// 缓存键
const CACHE_KEYS = {
  customerStats: '/customers/stats'
}

const loadStats = async () => {
  if (!canView.value) {
    Object.assign(stats, {
      totalCustomers: 0,
      activeCustomers: 0,
      newCustomers: 0,
      premiumCustomers: 0
    })
    return
  }

  try {
    const response = await useCachedRequest(CACHE_KEYS.customerStats, () =>
      unifiedApi.get('/customers/stats'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success) {
      Object.assign(stats, response.data)
    }
  } catch (err) {
    logger.error('加载统计数据失败:', err)
  }
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  if (!canView.value) {
    return
  }

  if (refreshing.value) return
  await refresh(async () => {
    await debouncedRefresh()
  })
  success('数据刷新成功')
}

// 模态框操作函数
const openAddModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  modalMode.value = 'add'
  resetCustomerForm()
  errors.value = {} // 重置错误信息
  showCustomerModal.value = true
}

const openEditModal = (customer: CustomerListItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  modalMode.value = 'edit'
  Object.assign(customerForm.value, {
    id: customer.id,
    name: normalizePersonName(customer.name || '', 50),
    phone: normalizePhoneDigits(customer.phone || ''),
    email: customer.email || '',
    customer_type: customer.customer_type || 'individual',
    vip_level: customer.vip_level || 'normal',
    gender: customer.gender || '',
    birthday: customer.birthday || '',
    id_card: normalizeIdCard(customer.id_card || ''),
    wechat: customer.wechat || '',
    qq: customer.qq || '',
    apple_id: normalizeAppleId(customer.apple_id || ''),
    address: customer.address || '',
    city: customer.city || '',
    province: customer.province || '',
    // 确保数值字段是数字类型，避免 ElInputNumber 类型错误
    balance: Number(customer.balance) || 0,
    points: Number(customer.points) || 0,
    blacklist: customer.blacklist || false,
    remarks: customer.remarks || ''
  })

  // 设置城市省份选择器的值
  cityLocation.value = {
    province: customer.province || '',
    city: customer.city || ''
  }
  errors.value = {} // 重置错误信息
  showCustomerModal.value = true
}

const closeCustomerModal = () => {
  showCustomerModal.value = false
  resetCustomerForm()
  errors.value = {} // 重置错误信息
}

const resetCustomerForm = () => {
  customerForm.value = {
    id: null,
    name: '',
    phone: '',
    email: '',
    customer_type: 'individual',
    vip_level: 'normal',
    gender: '',
    birthday: '',
    id_card: '',
    wechat: '',
    qq: '',
    apple_id: '',
    address: '',
    city: '',
    province: '',
    balance: 0,
    points: 0,
    blacklist: false,
    remarks: '',
    changePassword: false,
    password: '',
    confirmPassword: ''
  }

  // 重置城市省份选择器
  cityLocation.value = {
    province: '',
    city: ''
  }
}

const saveCustomer = async () => {
  if (isSubmitting.value) return
  if (modalMode.value === 'add' && !canCreate.value) {
    handleNoPermission('create')
    return
  }

  if (modalMode.value === 'edit' && !canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    customerForm.value.name = normalizePersonName(customerForm.value.name, 50)
    customerForm.value.phone = normalizePhoneDigits(customerForm.value.phone)
    customerForm.value.id_card = normalizeIdCard(customerForm.value.id_card)
    customerForm.value.apple_id = normalizeAppleId(customerForm.value.apple_id)

    // 表单验证
    if (!customerForm.value.name?.trim()) {
      error('请输入客户姓名')
      return
    }
    if (!customerForm.value.phone?.trim()) {
      error('请输入手机号码')
      return
    }
    if (!isValidMobilePhone(customerForm.value.phone)) {
      error('请输入正确的手机号码')
      return
    }

    if (customerForm.value.id_card && !isValidIdCard(customerForm.value.id_card)) {
      error('请输入正确的身份证号')
      return
    }

    // 密码验证（仅编辑模式且勾选了修改密码时）
    if (modalMode.value === 'edit' && customerForm.value.changePassword) {
      if (!customerForm.value.password || customerForm.value.password.length < 6) {
        error('新密码至少需要6位')
        return
      }
      if (customerForm.value.password !== customerForm.value.confirmPassword) {
        error('两次输入的密码不一致')
        return
      }
    }

    // Apple ID 验证（如果填写了）
    if (customerForm.value.apple_id && customerForm.value.apple_id.trim()) {
      const appleId = customerForm.value.apple_id.trim()
      if (!isValidAppleAccount(appleId)) {
        error('请输入有效的 Apple ID 手机号或邮箱')
        return
      }
    }

    // 使用统一的提交状态管理
    setSubmitLoading(true)

    // 准备提交数据
    const submitData = { ...customerForm.value }

    if (!ALLOWED_VIP_LEVELS.has(submitData.vip_level)) {
      error('VIP等级无效，请重新选择')
      return
    }

    // 如果是编辑模式且勾选了修改密码，包含密码字段
    if (modalMode.value === 'edit') {
      if (submitData.changePassword && submitData.password) {
        // 保留密码字段，移除确认密码和修改密码标记
        delete submitData.confirmPassword
        delete submitData.changePassword
      } else {
        // 如果没有修改密码，移除所有密码相关字段
        delete submitData.password
        delete submitData.confirmPassword
        delete submitData.changePassword
      }
    } else {
      // 新增模式，移除密码相关字段
      delete submitData.password
      delete submitData.confirmPassword
      delete submitData.changePassword
    }

    let response: { success?: boolean; message?: string } | null = null
    if (modalMode.value === 'edit') {
      response = await unifiedApi.put(`/customers/${customerForm.value.id}`, submitData)
    } else {
      response = await unifiedApi.post('/customers', submitData)
    }

    if (response.success) {
      success(modalMode.value === 'edit' ? '客户信息更新成功' : '客户创建成功')
      closeCustomerModal()
      await Promise.all([loadCustomers(), loadStats()])
    } else {
      error(response.message || `${modalMode.value === 'edit' ? '更新' : '创建'}客户失败`)
    }
  } catch (err) {
    handleApiError(err, `${modalMode.value === 'edit' ? '更新' : '创建'}客户失败`)
  } finally {
    setSubmitLoading(false)
  }
}

const viewCustomerDetail = (customer: CustomerListItem) => {
  if (!canView.value) {
    handleNoPermission('view')
    return
  }

  selectedCustomer.value = customer
  showDetailModal.value = true
  // 加载客户的消费记录
  loadCustomerPurchases(customer.id)
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedCustomer.value = null
  customerPurchases.value = []
  purchasesPagination.value = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  }
}

// 加载客户消费记录
const loadCustomerPurchases = async (customerId: number, page: number = 1) => {
  if (!canView.value) {
    customerPurchases.value = []
    return
  }

  // 如果没有传入 customerId，尝试从 selectedCustomer 获取
  if (!customerId) {
    customerId = selectedCustomer.value?.id
  }

  if (!customerId) {
    return
  }

  // 更新当前页码
  purchasesPagination.value.page = page

  purchasesLoading.value = true
  try {
    const response = await unifiedApi.get(`/customers/${customerId}/purchases`, {
      params: {
        page,
        limit: purchasesPagination.value.limit
      }
    })
    if (response.success) {
      const responseData = (response.data || {}) as CustomerPurchasesResponseData
      customerPurchases.value = Array.isArray(responseData.purchases) ? responseData.purchases : []
      // 使用可选链和空值合并运算符正确处理 pagination
      purchasesPagination.value = {
        ...purchasesPagination.value,
        ...(responseData.pagination || {}),
        page: page
      }
    }
  } catch (error) {
    logger.error('加载客户消费记录失败:', error)
  } finally {
    purchasesLoading.value = false
  }
}

// 处理分页大小变化
const handlePageSizeChange = (limit: number) => {
  purchasesPagination.value.limit = limit
  purchasesPagination.value.page = 1 // 重置到第一页
  loadCustomerPurchases(selectedCustomer.value?.id, 1)
}

const handlePurchasesPaginationChange = (page: number, pageSize: number) => {
  if (pageSize !== purchasesPagination.value.limit) {
    handlePageSizeChange(pageSize)
    return
  }

  loadCustomerPurchases(selectedCustomer.value?.id, page)
}

// 切换消费记录分页
const loadPurchasePurchases = (page: number) => {
  if (selectedCustomer.value) {
    loadCustomerPurchases(selectedCustomer.value.id, page)
  }
}

const editCustomer = (customer: CustomerListItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  openEditModal(customer)
}

const deleteCustomer = async (customer: CustomerListItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除客户 "${customer.name}" 吗？此操作不可恢复。`,
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
    setDataLoading(true)
    const response = await unifiedApi.delete(`/customers/${customer.id}`)

    if (response.success) {
      success('客户删除成功')
      await Promise.all([loadCustomers(), loadStats()])
    } else {
      setError(response.message || '删除客户失败')
    }
  } catch (err) {
    handlePageError(err, '删除客户失败')
  } finally {
    setDataLoading(false)
  }
}

const handleExport = async () => {
  await exportFile({
    url: '/customers/export',
    filename: buildDateFilename('客户列表', 'xlsx'),
    params: sanitizeParams({
      keyword: searchKeyword.value,
      customer_type: filterValues.customerType,
      status: filterValues.status
    }),
    allowed: canExport,
    loading: isExporting,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '导出成功',
    errorMessage: '导出失败',
    onError: (err, defaultMessage) => handlePageError(err, defaultMessage)
  })
}

// 工具方法
const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

const getCustomerTypeTagType = (type: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const typeMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    individual: 'info',       // 个人客户 - 蓝色
    enterprise: 'success',    // 企业客户 - 绿色
    wholesale: 'warning',     // 同行调货 - 橙色
    allocate: 'primary'       // 同行划拨 - 蓝色
  }
  return typeMap[type] || 'info'
}

const getCustomerTypeLabel = (type: string) => {
  const customerType = CUSTOMER_TYPES.find(t => t.value === type)
  return customerType?.label || type
}

const getStatusTagType = (status: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const statusMap: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    active: 'success',    // 活跃 - 绿色
    inactive: 'info',      // 非活跃 - 蓝色
    blacklist: 'danger'    // 黑名单 - 红色
  }
  return statusMap[status] || 'info' // 默认返回 info 类型
}

const getStatusLabel = (status: string) => {
  const labelMap: Record<string, string> = {
    1: '活跃',
    0: '非活跃',
    active: '活跃',
    inactive: '非活跃',
    blacklist: '黑名单'
  }
  return labelMap[status] || status
}

// VIP等级相关函数
const getVipLevelType = (level: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const vipLevel = VIP_LEVELS.find(v => v.value === level)
  return (vipLevel?.color as 'success' | 'warning' | 'info' | 'primary' | 'danger') || 'info'
}

const getVipLevelLabel = (level: string) => {
  const vipLevel = VIP_LEVELS.find(v => v.value === level)
  return vipLevel?.label || '普通'
}

const getVipLevelIcon = (level: string) => {
  const vipLevel = VIP_LEVELS.find(v => v.value === level)
  return vipLevel?.icon || 'fas fa-user'
}

// 获取VIP等级对应的颜色值（用于自定义样式）
const getVipColor = (level: string) => {
  const colorMap: Record<string, string> = {
    normal: '#909399',
    bronze: '#cd7f32',
    silver: '#409EFF',
    gold: '#E6A23C',
    platinum: '#F56C6C',
    diamond: '#67C23A',
    vip: '#F56C6C'
  }
  return colorMap[level] || '#909399'
}

// 性别相关函数
const getGenderIcon = (gender: string) => {
  const iconMap: Record<string, string> = {
    1: 'fas fa-male text-primary',
    2: 'fas fa-female text-danger',
    male: 'fas fa-male text-primary',
    female: 'fas fa-female text-danger',
    unknown: 'fas fa-user text-muted'
  }
  return iconMap[gender] || 'fas fa-user text-muted'
}

const getGenderLabel = (gender: string) => {
  const labelMap: Record<string, string> = {
    1: '男',
    2: '女',
    male: '男',
    female: '女',
    unknown: '未知'
  }
  return labelMap[gender] || '未知'
}

const getProvinceDisplayName = (province?: string) => {
  const rawProvince = String(province || '').trim()
  return PROVINCE_NAME_BY_CODE[rawProvince] || rawProvince
}

const formatCustomerRegion = (
  customer: Pick<CustomerListItem, 'province' | 'city'> | null,
  visible: { province?: boolean; city?: boolean } = { province: true, city: true }
) => {
  if (!customer) return '-'

  const province = visible.province ? getProvinceDisplayName(customer.province) : ''
  const city = visible.city ? String(customer.city || '').trim() : ''
  const regionParts = [province, city].filter(Boolean)
  return regionParts.length > 0 ? regionParts.join('，') : '-'
}

// 格式化数字
const formatNumber = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return '0'
  return n.toFixed(2)
}


// 生命周期
onMounted(async () => {
  if (!canView.value) {
    setDataLoading(false)
    return
  }

  await initFieldPermissions()
  loadCustomers()
  loadStats()
})

// 清理定时器
onUnmounted(() => {
  if (refreshTimeoutId) {
    clearTimeout(refreshTimeoutId)
  }
})
</script>

<style lang="scss" scoped>
// 搜索高亮样式
:deep(.highlight) {
  background-color: #fff3cd;
  color: #856404;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}

.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.permission-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--el-border-color-lighter);
    border-top: 4px solid var(--el-color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  p {
    color: var(--el-text-color-regular);
    margin: 0;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

// 旋转动画
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.page-body {
  flex: 1;
  padding: 0 24px 24px 24px;
  overflow: auto;
  margin-top: 24px;
}

.table-section {
  .selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-regular);
  }

  .table-error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }
}

.stat-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;

  &.active {
    background: linear-gradient(135deg, #28a745, #20c997);
  }

  &.recent {
    background: linear-gradient(135deg, #ffc107, #ff9800);
  }

  &.premium {
    background: linear-gradient(135deg, #dc3545, #fd7e14);
  }
}

.customers-data-table {
  .account-info,
  .location-info,
  .purchase-info {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    width: 100%;
    line-height: 1.35;
    white-space: nowrap;
  }

  .table-info-line {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    min-height: 18px;
    overflow: hidden;
    text-overflow: ellipsis;

    > span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .purchase-summary {
    gap: 8px;
  }

  .total-spent,
  .purchase-count {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }

  .customer-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    width: 100%;
    line-height: 1.35;
    text-align: center;
  }

  .customer-primary-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 8px;
    max-width: 100%;
    min-width: 0;
  }

  .contact-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 5px 10px;
    min-width: 0;
    width: 100%;
    line-height: 1.35;
    text-align: center;
    white-space: normal;
  }

  .customer-name {
    display: inline-block;
    color: var(--el-text-color-primary);
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .customer-id,
  .province,
  .address,
  .last-purchase {
    color: var(--el-text-color-placeholder);
  }

  .member-number > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-number,
  .mobile-member-number {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
    color: var(--el-color-primary);
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .apple-id-value {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
    color: var(--el-text-color-secondary);
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 12px;

    i {
      flex: 0 0 auto;
      margin-right: 4px;
      color: var(--el-text-color-placeholder);
    }

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .contact-info .phone {
    color: var(--el-text-color-primary);
    font-weight: 500;

    i {
      color: var(--el-color-success);
      margin-right: 4px;
    }
  }

  .contact-info .phone,
  .social-tag {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-width: 0;
  }

  .contact-info .phone > span,
  .social-tag > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .social-links {
    display: contents;
  }

  .social-tag {
    color: var(--el-text-color-secondary);

    i {
      margin-right: 4px;
    }
  }

  .amount-value {
    color: var(--el-color-success);
    font-weight: 500;
  }

  .points-value {
    color: var(--el-color-warning);
    font-weight: 500;
  }

  .spent-value {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  .location-info .address {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// 注意：不再使用的通用按钮样式已删除，改用 el-button

// 统一表单控件样式
.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--el-color-primary);
  }

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}

.points-settings-form {
  .points-ratio-control {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    color: var(--el-text-color-regular);
    font-size: 14px;
  }

  .points-ratio-input {
    width: 180px;
  }
}

.points-settings-preview {
  margin: 8px 0 0 120px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;

  .preview-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    color: var(--el-text-color-primary);
    font-weight: 600;
  }
}

// 响应式设计
@media (max-width: 767px) {
  .page-body {
    padding: 0;
    margin-top: 0;
    overflow: visible;
  }

  .page-title {
    font-size: 24px;
    margin-bottom: 6px;
  }

  .page-subtitle {
    font-size: 14px;
  }

  .points-settings-form {
    .points-ratio-input {
      width: 150px;
    }
  }

  .points-settings-preview {
    margin-left: 0;
  }

}

// 小屏幕手机适配（小于480px）
@media (max-width: 480px) {
  .page-body {
    padding: 0;
  }

}

.page-body {
  padding: 16px;
}

@media (max-width: 767px) {
  .page-body.admin-page-content {
    padding: 0;
    margin-top: 0;
    overflow: visible;
  }
}

// 对话框表单样式
.form-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 16px 0;
    padding: 8px 0;
    border-bottom: 1px solid #e5e7eb;
    color: #374151;
    font-size: 16px;
    font-weight: 600;
  }
}

// 客户详情视图样式 - 简洁设计
.customer-detail-view {
  padding: 0;

  // 客户信息面板
  .customer-info-panel {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 20px;
    margin-bottom: 20px;
  }

  // 左侧面板
  .panel-left {
    .info-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
      margin-bottom: 16px;

      .customer-avatar {
        width: 60px;
        height: 60px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        i {
          font-size: 28px;
        }
      }

      .customer-basic {
        flex: 1;

        .customer-name {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 600;
        }

        .customer-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .customer-gender-meta {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.16);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          line-height: 1;
        }
      }
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      align-items: start;
      padding: 0 4px;

      .info-row {
        display: grid;
        grid-template-columns: 26px minmax(0, 1fr);
        align-items: center;
        column-gap: 8px;
        min-width: 0;
        padding: 9px 14px;
        background: #f8f9fa;
        border-radius: 8px;
        transition: all 0.2s ease;

        &:hover {
          background: #e9ecef;
        }

        &.info-row-phone {
          background: #f0f9f2;

          .label i {
            color: #2f9e44;
          }
        }

        &.info-row-member {
          background: #f0f7ff;

          .label i {
            color: #2f80ed;
          }
        }

        &.info-row-id-card {
          background: #f6f2ff;

          .label i {
            color: #7048e8;
          }
        }

        &.info-row-email {
          background: #effafd;

          .label i {
            color: #1098ad;
          }
        }

        &.info-row-address {
          background: #fff7ed;

          .label i {
            color: #f08c00;
          }
        }

        &.info-row-region {
          background: #fff1f2;

          .label i {
            color: #e03131;
          }
        }

        &.info-row-phone:hover,
        &.info-row-member:hover,
        &.info-row-id-card:hover,
        &.info-row-email:hover,
        &.info-row-address:hover,
        &.info-row-region:hover {
          filter: saturate(1.06) brightness(0.985);
        }

        .label {
          font-size: 13px;
          color: #6c757d;
          font-weight: 500;
          line-height: 1.35;
          white-space: nowrap;
          text-align: center;

          i {
            color: #6c757d;
            font-size: 14px;
          }
        }

        .value {
          min-width: 0;
          font-size: 13px;
          color: #212529;
          font-weight: 500;
          line-height: 1.3;
          text-align: right;
          overflow: visible;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;

          &.phone {
            letter-spacing: 0;
            white-space: nowrap;
          }
        }

        &.wide-info-row {
          grid-column: 1 / -1;

          .value {
            text-align: left;
          }
        }
      }
    }
  }

  // 右侧面板
  .panel-right {
    .stats-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

      .stat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 10px;
        transition: all 0.2s ease;

        &:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;

          &.balance {
            background: linear-gradient(135deg, #198754, #20c997);
            color: white;
          }

          &.points {
            background: linear-gradient(135deg, #fd7e14, #ffc107);
            color: white;
          }

          &.spent {
            background: linear-gradient(135deg, #dc3545, #e74c3c);
            color: white;
          }

          &.count {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
          }
        }

        .stat-content {
          flex: 1;

          .stat-label {
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 4px;
          }

          .stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #212529;
          }
        }
      }
    }
  }

  // 其他信息
  .extra-info {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 12px;

    .extra-info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: white;
      border-radius: 8px;
      font-size: 13px;
      color: #495057;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      i {
        font-size: 14px;
      }

      &.remarks {
        flex-basis: 100%;
        background: #fff9e6;
        border: 1px solid #ffeeba;
      }
    }
  }

  // 购买记录区域
  .purchases-section {
    margin-top: 24px;
  }

  // 金额和特殊值的样式
  .amount-value {
    color: #dc2626;
    font-weight: 700;
    font-size: 16px;
  }

  .total-spent {
    color: #dc2626;
    font-weight: 700;
    font-size: 16px;
  }

  .text-success {
    color: #28a745;
    font-weight: 600;
  }

  .text-danger {
    color: #dc3545;
    font-weight: 600;
  }

  .text-muted {
    color: #6c757d;
  }

  .small {
    font-size: 12px;
  }

  .remarks-text {
    color: #2c3e50;
    line-height: 1.6;
    white-space: pre-wrap;
  }
}

// 保留旧的详情样式（向后兼容）
.detail-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;

  &:last-child {
    margin-bottom: 0;
    border-bottom: none;
  }

  h4 {
    margin: 0 0 12px 0;
    color: #374151;
    font-size: 16px;
    font-weight: 600;
  }
}

.detail-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  padding: 4px 0;

  &.full-width {
    flex-direction: column;
    align-items: flex-start;
  }

  .label {
    flex-shrink: 0;
    width: 100px;
    color: #6b7280;
    font-weight: 500;
    font-size: 14px;
  }

  .value {
    flex: 1;
    color: #374151;
    font-size: 14px;
    word-break: break-word;

    &.status-active {
      color: #10b981;
      font-weight: 500;
    }

    &.status-inactive {
      color: #ef4444;
      font-weight: 500;
    }

    &.text-danger {
      color: #ef4444;
      font-weight: 500;
    }

    &.text-success {
      color: #10b981;
      font-weight: 500;
    }
  }
}

// 消费记录表格（旧样式，保留兼容）
.purchase-table-container {
  margin-top: 16px;
  overflow-x: auto;
}

// 移动端响应式样式
@media (max-width: 768px) {
  .customers-dialog-form {
    :deep(.el-row) {
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    :deep(.el-col) {
      max-width: 100%;
      flex: 0 0 100%;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    :deep(.el-form-item) {
      margin-bottom: 12px;
    }

    :deep(.el-form-item__label) {
      font-size: 13px;
      line-height: 1.4;
      padding-bottom: 4px;
    }

    :deep(.el-input),
    :deep(.el-input-number),
    :deep(.el-select),
    :deep(.el-date-editor),
    :deep(.el-radio-group),
    :deep(.el-checkbox),
    :deep(.el-switch) {
      width: 100%;
    }

    :deep(.el-input__wrapper),
    :deep(.el-textarea__inner),
    :deep(.el-input-number .el-input__wrapper) {
      border-radius: 12px;
    }

    :deep(.el-input__wrapper),
    :deep(.el-input-number .el-input__wrapper),
    :deep(.el-date-editor .el-input__wrapper) {
      min-height: 42px;
      padding: 1px 12px;
    }

    :deep(.el-radio-group) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    :deep(.el-radio) {
      margin-right: 0;
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid #dbe3ef;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }

  .customer-detail-view {
    .customer-info-panel {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .panel-left {
      .info-header {
        padding: 16px;
        flex-direction: column;
        text-align: center;

        .customer-avatar {
          width: 50px;
          height: 50px;

          i {
            font-size: 24px;
          }
        }

        .customer-basic {
          .customer-name {
            font-size: 18px;
          }
        }
      }

      .info-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }

    .panel-right {
      .stats-card {
        padding: 12px;

        .stat-item {
          padding: 10px;

          .stat-icon {
            width: 36px;
            height: 36px;
            font-size: 16px;
          }

          .stat-content {
            .stat-value {
              font-size: 16px;
            }
          }
        }
      }
    }

    .extra-info {
      flex-direction: column;
      padding: 12px;

      .extra-info-item {
        padding: 6px 12px;
        font-size: 12px;
      }
    }

    .panel-left {
      .info-grid {
        padding: 0;
      }

      .info-grid .info-row {
        padding: 10px 12px;
        column-gap: 8px;

        .label {
          font-size: 12px;

          i {
            font-size: 13px;
          }
        }

        .value {
          font-size: 12px;
          text-align: right;
        }
      }
    }
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;

    h4 {
      font-size: 14px;
    }

    .record-count {
      font-size: 12px;
    }
  }

  .purchase-table-wrapper {
    border-radius: 6px;
  }

  .purchase-table {
    font-size: 12px;

    thead {
      th {
        padding: 8px 10px;
        font-size: 11px;
      }
    }

    tbody {
      td {
        padding: 8px 10px;
        font-size: 11px;
      }
    }
  }

  .pagination-wrapper {
    flex-direction: column;
    gap: 10px;
    padding: 10px;

    .pagination-info {
      font-size: 12px;
    }
  }
}

</style>

<style>
.customers-form-dialog,
.customers-detail-dialog {
  --dialog-max-width: 800px;
}

@media (max-width: 767px) {
  .customers-form-dialog,
  .customers-detail-dialog {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 10px 8px 8px;
    --mobile-dialog-footer-padding: 0 8px 8px;
  }

  .mobile-dialog-sheet-overlay.customers-form-dialog,
  .mobile-dialog-sheet-overlay.customers-detail-dialog {
    padding: 12px 6px !important;
  }

}

@media (max-width: 480px) {
  .customers-form-dialog,
  .customers-detail-dialog {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 8px 6px 6px;
    --mobile-dialog-footer-padding: 0 6px 6px;
  }

  .mobile-dialog-sheet-overlay.customers-form-dialog,
  .mobile-dialog-sheet-overlay.customers-detail-dialog {
    padding: 12px 4px !important;
  }

  .customers-dialog-form :deep(.el-form-item) {
    margin-bottom: 10px;
  }

  .customers-dialog-form :deep(.el-divider) {
    margin: 14px 0 12px;
  }

  .customer-detail-view .panel-left .info-header {
    padding: 14px 12px;
  }

  .customer-detail-view .panel-left .info-header .customer-basic .customer-name {
    font-size: 16px;
  }

  .customer-detail-view .panel-right .stats-card {
    padding: 10px;
  }

  .customer-detail-view .panel-right .stats-card .stat-item {
    padding: 9px;
  }
}
</style>

<style lang="scss">
.customer-purchases-table {
  .index-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--el-color-primary);
    color: #fff;
    font-weight: 600;
  }

  .imei,
  .serial-number,
  .price,
  .price-cell,
  .time-cell {
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .price {
    color: var(--el-color-warning);
  }

  .profit-positive {
    color: var(--el-color-success);
  }

  .profit-negative {
    color: var(--el-color-danger);
  }
}
</style>
