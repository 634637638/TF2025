<template>
  <div class="page-container admin-page">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="customers"
      module-name="客户管理"
      permission-code="customers:view"
    />

    <!-- 主要内容 -->
    <div v-else class="page-content admin-page-content">
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
            <!-- 加载状态 -->
            <div v-if="isLoading" class="table-loading">
              <el-skeleton :rows="5" animated />
            </div>

            <!-- 错误状态 -->
            <div v-else-if="hasError" class="table-error">
              <el-empty description="加载失败" :image-size="200">
                <el-button type="primary" @click="refresh(() => loadCustomers())">
                  重试
                </el-button>
              </el-empty>
            </div>

            <!-- 正常内容 -->
            <div v-else>
              <table class="data-table">
                <thead>
                  <tr>
                    <th v-if="!isMobile" width="40">
                      <input
                        type="checkbox"
                        :checked="isAllSelected"
                        @change="handleSelectAll"
                      />
                    </th>
                    <th v-if="isMobile && showMemberNumberColumn">会员号</th>
                    <th v-if="showCustomerInfoColumn">{{ isMobile ? '姓名' : '客户信息' }}</th>
                    <th v-if="showContactColumn">{{ isMobile ? '手机号' : '联系方式' }}</th>
                    <th v-if="!isMobile && showCustomerTypeColumn">客户类型</th>
                    <th v-if="!isMobile && showVipColumn">VIP等级</th>
                    <th v-if="!isMobile && showAccountColumn">账户信息</th>
                    <th v-if="!isMobile && showRegionColumn">地区</th>
                    <th v-if="!isMobile && showStatsColumn">消费统计</th>
                    <th v-if="!isMobile && showStatusColumn">状态</th>
                    <th v-if="showActionField" width="150">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!customers.length && !isLoading">
                    <td :colspan="visibleColumnCount" class="text-center py-8">
                      <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>暂无客户数据</p>
                      </div>
                    </td>
                  </tr>
                  <template v-for="customer in customers" :key="customer.id">
                  <tr @click="handleMobileRowTap(customer.id)" @dblclick="toggleMobileActions(customer.id)">
                    <td v-if="!isMobile">
                      <input
                        type="checkbox"
                        :checked="isSelected(customer)"
                        @change="toggleRowSelection(customer)"
                      />
                    </td>
                    <td v-if="isMobile && showMemberNumberColumn">
                      <div class="mobile-member-number">
                        <span v-if="customer.member_number" v-html="highlightText(customer.member_number, searchKeyword)"></span>
                        <span v-else>-</span>
                      </div>
                    </td>
                    <td v-if="showCustomerInfoColumn">
                      <div class="customer-info">
                        <div v-if="canViewField('name')" class="customer-name">
                          <strong v-html="highlightText(customer.name || '-', searchKeyword)"></strong>
                          <div v-if="!isMobile && canViewField('id')" class="customer-id text-muted small">#{{ String(customer.id).padStart(6, '0') }}</div>
                        </div>
                        <div v-else-if="canViewField('id')" class="customer-name">
                          <strong>客户 #{{ String(customer.id).padStart(6, '0') }}</strong>
                        </div>
                        <div v-if="!isMobile && canViewField('member_number') && customer.member_number" class="member-number small text-primary">
                          <i class="fas fa-id-card"></i>
                          <span v-html="highlightText(customer.member_number, searchKeyword)"></span>
                        </div>
                        <div v-if="!isMobile && (canViewField('gender') || canViewField('birthday'))" class="gender-info small">
                          <i :class="getGenderIcon(customer.gender)"></i>
                          <span v-if="canViewField('gender')">{{ getGenderLabel(customer.gender) }}</span>
                          <span v-if="canViewField('birthday') && customer.birthday" class="text-muted">({{ customer.birthday }})</span>
                        </div>
                      </div>
                    </td>
                    <td v-if="showContactColumn">
                      <div class="contact-info">
                        <div v-if="canViewField('phone') && customer.phone" class="phone primary">
                          <i class="fas fa-phone"></i>
                          <span v-html="highlightText(customer.phone, searchKeyword)"></span>
                        </div>
                        <div v-if="!isMobile && canViewField('email') && customer.email" class="email small text-muted">
                          <i class="fas fa-envelope"></i>
                          <span v-html="highlightText(customer.email, searchKeyword)"></span>
                        </div>
                        <div v-if="!isMobile && ((canViewField('wechat') && customer.wechat) || (canViewField('qq') && customer.qq) || (canViewField('apple_id') && customer.apple_id))" class="social-links small">
                          <span v-if="canViewField('wechat') && customer.wechat" class="social-tag" title="微信">
                            <i class="fab fa-weixin"></i>
                            <span v-html="highlightText(customer.wechat, searchKeyword)"></span>
                          </span>
                          <span v-if="canViewField('qq') && customer.qq" class="social-tag" title="QQ">
                            <i class="fab fa-qq"></i>
                            <span v-html="highlightText(customer.qq, searchKeyword)"></span>
                          </span>
                          <span v-if="canViewField('apple_id') && customer.apple_id" class="social-tag" title="Apple ID">
                            <i class="fab fa-apple"></i>
                            <span v-html="highlightText(customer.apple_id, searchKeyword)"></span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td v-if="!isMobile && showCustomerTypeColumn">
                      <el-tag v-if="canViewField('customer_type')" :type="getCustomerTypeTagType(customer.customer_type)" size="small">
                        {{ getCustomerTypeLabel(customer.customer_type) }}
                      </el-tag>
                      <div v-if="canViewField('blacklist') && customer.blacklist" class="small text-danger mt-1">
                        <i class="fas fa-exclamation-triangle"></i> 黑名单
                      </div>
                    </td>
                    <td v-if="!isMobile && showVipColumn">
                      <el-tag :type="getVipLevelType(customer.vip_level)" size="small">
                        <i :class="getVipLevelIcon(customer.vip_level)" class="mr-1"></i>
                        {{ getVipLevelLabel(customer.vip_level) }}
                      </el-tag>
                    </td>
                    <td v-if="!isMobile && showAccountColumn">
                      <div class="account-info">
                        <div v-if="canViewField('balance')" class="balance">
                          <span class="amount-label">余额:</span>
                          <span class="amount-value">¥{{ formatNumber(customer.balance || 0) }}</span>
                        </div>
                        <div v-if="canViewField('points')" class="points">
                          <span class="points-label">积分:</span>
                          <span class="points-value">{{ customer.points || 0 }}</span>
                        </div>
                      </div>
                    </td>
                    <td v-if="!isMobile && showRegionColumn">
                      <div class="location-info">
                        <div v-if="canViewField('city') && customer.city" class="city">
                          <i class="fas fa-map-marker-alt"></i>
                          <span v-html="highlightText(customer.city, searchKeyword)"></span>
                        </div>
                        <div v-if="canViewField('province') && customer.province" class="province small text-muted">
                          <span v-html="highlightText(customer.province, searchKeyword)"></span>
                        </div>
                        <div v-if="canViewField('address') && customer.address" class="address small text-muted">
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
                    </td>
                    <td v-if="!isMobile && showStatsColumn">
                      <div class="purchase-info">
                        <div v-if="canViewField('total_spent')" class="total-spent">
                          <span class="spent-label">总消费:</span>
                          <span class="spent-value">¥{{ formatNumber(customer.total_spent || 0) }}</span>
                        </div>
                        <div v-if="canViewField('purchase_count')" class="purchase-count">
                          <span class="count-label">购买次数:</span>
                          <span class="count-value">{{ customer.purchase_count || 0 }} 台</span>
                        </div>
                        <div v-if="canViewField('last_purchase_date') && customer.last_purchase_date" class="last-purchase small text-muted">
                          <span class="purchase-label">最后购买:</span>
                          {{ formatDate(customer.last_purchase_date) }}
                        </div>
                        <div v-if="canViewField('created_at')" class="register-date small text-muted">
                          <span class="register-label">注册:</span>
                          {{ formatDate(customer.created_at) }}
                        </div>
                      </div>
                    </td>
                    <td v-if="!isMobile && showStatusColumn">
                      <el-tag :type="getStatusTagType(customer.status)" size="small">
                        {{ getStatusLabel(customer.status) }}
                      </el-tag>
                    </td>
                    <td v-if="showActionField">
                      <div class="action-buttons">
                        <el-button
                          v-if="canEdit"
                          type="primary"
                          size="small"
                          @click="requirePermission('edit', () => editCustomer(customer))"
                          title="编辑客户"
                        >
                          <i class="fas fa-edit"></i>
                          编辑
                        </el-button>
                        <el-button
                          type="info"
                          size="small"
                          @click="viewCustomerDetail(customer)"
                          title="查看详情"
                        >
                          <i class="fas fa-eye"></i>
                          详情
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          type="danger"
                          size="small"
                          @click="requirePermission('delete', () => deleteCustomer(customer))"
                          title="删除客户"
                        >
                          <i class="fas fa-trash"></i>
                          删除
                        </el-button>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-if="isMobile && mobileActionRowId === customer.id && (canEdit || canDelete || canView)"
                    class="mobile-action-row"
                  >
                    <td :colspan="visibleColumnCount">
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
                    </td>
                  </tr>
                  </template>
                </tbody>
              </table>
            </div>
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
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            {{ isSubmitting ? '保存中...' : (modalMode === 'add' ? '新增' : '保存') }}
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
        <div v-if="selectedCustomer" class="customer-detail-view">
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
                  </div>
                </div>
              </div>

              <div class="info-grid">
                <div v-if="canViewField('phone')" class="info-row">
                  <span class="label">电话</span>
                  <span class="value phone">{{ selectedCustomer.phone }}</span>
                </div>
                <div v-if="canViewField('member_number')" class="info-row">
                  <span class="label">会员号</span>
                  <span class="value">{{ selectedCustomer.member_number || '-' }}</span>
                </div>
                <div v-if="canViewField('gender')" class="info-row">
                  <span class="label">性别</span>
                  <span class="value">
                    <i v-if="selectedCustomer.gender === 'male'" class="fas fa-mars text-blue"></i>
                    <i v-else-if="selectedCustomer.gender === 'female'" class="fas fa-venus text-danger"></i>
                    <span v-else>-</span>
                  </span>
                </div>
                <div v-if="canViewField('email')" class="info-row">
                  <span class="label">邮箱</span>
                  <span class="value">{{ selectedCustomer.email || '-' }}</span>
                </div>
                <div v-if="canViewField('address')" class="info-row">
                  <span class="label">地址</span>
                  <span class="value">{{ selectedCustomer.address || '-' }}</span>
                </div>
                <div v-if="canViewField('city') || canViewField('province')" class="info-row">
                  <span class="label">地区</span>
                  <span class="value">{{ selectedCustomer.city || '-' }} {{ selectedCustomer.province ? ', ' + selectedCustomer.province : '' }}</span>
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
            <!-- 购买记录表格 - 参考供应商打款明细样式 -->
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th width="60">序号</th>
                    <th>型号</th>
                    <th>颜色</th>
                    <th>内存</th>
                    <th>成色</th>
                    <th>IMEI</th>
                    <th>序列号</th>
                    <th>售价</th>
                    <th>利润</th>
                    <th width="110">销售日期</th>
                    <th>销售员</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(purchase, index) in customerPurchases" :key="index">
                    <td><span class="index-badge">{{ index + 1 }}</span></td>
                    <td>{{ purchase.model || '-' }}</td>
                    <td>{{ purchase.color || '-' }}</td>
                    <td>{{ purchase.memory || '-' }}</td>
                    <td>
                      <el-tag :type="purchase.is_new === '全新' ? 'success' : 'warning'" size="small">
                        {{ purchase.is_new }}
                      </el-tag>
                    </td>
                    <td><span class="imei">{{ purchase.imei || '-' }}</span></td>
                    <td><span class="serial-number">{{ purchase.serial_number || '-' }}</span></td>
                    <td class="price">¥{{ formatNumber(purchase.sale_price) }}</td>
                    <td :class="['price-cell', purchase.profit > 0 ? 'profit-positive' : 'profit-negative']">
                      ¥{{ formatNumber(purchase.profit) }}
                    </td>
                    <td class="time-cell">{{ formatDate(purchase.sale_date) }}</td>
                    <td>{{ purchase.salesperson || '-' }}</td>
                  </tr>
                </tbody>
              </table>
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
import { useMobile } from '@/composables/useMobile'
import { ElSkeleton, ElEmpty, ElButton, ElMessageBox } from 'element-plus'
import Pagination from '../../components/Pagination.vue'
import CitySelector from '../../components/CitySelector.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionDenied, PageHeader } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { isValidAppleAccount, isValidEmail, isValidIdCard, isValidMobilePhone, normalizeAppleId, normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'

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
const { loading: isSubmitting } = useLoadingState()
const errorMessage = ref('')
const hasError = computed(() => !!errorMessage.value)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})
const selectedRows = ref<CustomerListItem[]>([])
const searchKeyword = ref('')
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
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
const showNameColumn = computed(() => canViewField('name') || canViewField('id'))
const showPhoneColumn = computed(() => canViewField('phone'))

const showCustomerInfoColumn = computed(() => {
  if (isMobile.value) {
    return showNameColumn.value
  }
  return ['id', 'name', 'member_number', 'gender', 'birthday'].some(fieldName => canViewField(fieldName))
})

const showContactColumn = computed(() => {
  if (isMobile.value) {
    return showPhoneColumn.value
  }
  return ['phone', 'email', 'wechat', 'qq', 'apple_id'].some(fieldName => canViewField(fieldName))
})

const showCustomerTypeColumn = computed(() => {
  return canViewField('customer_type') || canViewField('blacklist')
})

const showVipColumn = computed(() => canViewField('vip_level'))
const showAccountColumn = computed(() => ['balance', 'points'].some(fieldName => canViewField(fieldName)))
const showRegionColumn = computed(() => ['city', 'province', 'address'].some(fieldName => canViewField(fieldName)))
const showStatsColumn = computed(() => ['total_spent', 'purchase_count', 'last_purchase_date', 'created_at'].some(fieldName => canViewField(fieldName)))
const showStatusColumn = computed(() => canViewField('status'))
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value || canView.value) && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_customers') ||
  canViewField('stats_active_customers') ||
  canViewField('stats_new_customers') ||
  canViewField('stats_premium_customers')
))
const visibleColumnCount = computed(() => {
  return [
    !isMobile.value,
    isMobile.value ? showMemberNumberColumn.value : false,
    showCustomerInfoColumn.value,
    showContactColumn.value,
    isMobile.value ? false : showCustomerTypeColumn.value,
    isMobile.value ? false : showVipColumn.value,
    isMobile.value ? false : showAccountColumn.value,
    isMobile.value ? false : showRegionColumn.value,
    isMobile.value ? false : showStatsColumn.value,
    isMobile.value ? false : showStatusColumn.value,
    showActionField.value
  ].filter(Boolean).length || 1
})

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === id ? null : id
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedRowId.value === id && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = id
  lastTapTimestamp.value = now
}

// 表格操作方法
const toggleRowSelection = (row) => {
  const index = selectedRows.value.findIndex(r => r.id === row.id)
  if (index > -1) {
    selectedRows.value.splice(index, 1)
  } else {
    selectedRows.value.push(row)
  }
}

const selectAllRows = (rows) => {
  selectedRows.value = [...rows]
}

const clearSelection = () => {
  selectedRows.value = []
}

const toggleAllSelection = (checked) => {
  if (checked) {
    selectAllRows(customers.value)
  } else {
    clearSelection()
  }
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
          loadCustomers(),
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
  { value: 'bronze', label: '青铜会员', color: 'info', icon: 'fas fa-medal' },
  { value: 'silver', label: '白银会员', color: 'primary', icon: 'fas fa-star' },
  { value: 'gold', label: '黄金会员', color: 'warning', icon: 'fas fa-crown' },
  { value: 'platinum', label: '铂金会员', color: 'danger', icon: 'fas fa-gem' },
  { value: 'diamond', label: '钻石会员', color: 'success', icon: 'fas fa-diamond' },
  { value: 'vip', label: 'VIP至尊', color: 'danger', icon: 'fas fa-trophy' }
] as const

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

// 表单验证错误
const errors = ref<Record<string, string>>({})

// 客户消费记录
const customerPurchases = ref<CustomerPurchaseItem[]>([])
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

// 计算属性
const isAllSelected = computed(() => {
  return customers.value.length > 0 && selectedRows.value.length === customers.value.length
})

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

const handleReset = () => {
  // 清空搜索关键词
  searchKeyword.value = ''
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

const handleSelectAll = (event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  if (isChecked) {
    selectAllRows(customers.value)
  } else {
    clearSelection()
  }
}

const isSelected = (customer: CustomerListItem) => {
  return selectedRows.value.some(row => row.id === customer.id)
}

const loadCustomers = async () => {
  if (!canView.value) {
    customers.value = []
    setPagination(1, pagination.pageSize, 0)
    return
  }

  try {
    setDataLoading(true)
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
    setDataLoading(false)
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
      loadCustomers()
      loadStats()
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
        customClass: 'message-box-purple'
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
      loadCustomers()
      loadStats()
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

// 格式化身份证号（隐藏中间部分）
const formatIdNumber = (idCard: string) => {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4)
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
    border: 1px solid #e8ecef;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.12);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
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

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 14px;
        color: #6c757d;
        font-weight: 500;
      }
    }
  }
}

.table-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--el-border-color-light);

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      color: var(--el-text-color-primary);

      .record-count {
        font-size: 12px;
        color: var(--el-text-color-regular);
        background: var(--el-color-primary-light-9);
        padding: 2px 8px;
        border-radius: 12px;
      }
    }

    .table-actions {
      .selection-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }
  }

  .table-responsive {
    min-height: 400px;
  }

  .table-loading,
  .table-error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .table-pagination {
    padding: 16px 24px;
    border-top: 1px solid var(--el-border-color-light);
  }
}

// 表格样式（与库存管理页面保持一致）
.data-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--el-border-color-lighter);
    vertical-align: middle;
  }

  th {
    background: var(--el-bg-color-page);
    font-weight: 500;
    color: var(--el-text-color-primary);
    font-size: 14px;
  }

  tbody tr:hover {
    background: var(--el-bg-color-page);
  }

  // 客户信息样式
  .customer-name {
    .customer-id {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  // 会员编号样式
  .member-number {
    font-family: monospace;
    font-size: 13px;
    color: var(--el-color-primary);
    font-weight: 500;
  }

  // 联系信息样式
  .phone-info {
    .phone {
      color: var(--el-text-color-primary);
      font-weight: 500;
    }
  }

  .email {
    font-size: 13px;
    color: var(--el-text-color-regular);
    word-break: break-all;
  }

  // 金额样式
  .amount {
    .price {
      color: var(--el-color-danger);
      font-weight: 500;
    }
  }

  // 积分样式
  .points {
    font-weight: 500;
    color: var(--el-color-warning);
  }

  // 性别图标样式
  .gender-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 13px;
  }

  // 地址信息样式
  .city {
    font-weight: 500;
  }

  .province {
    color: var(--el-text-color-placeholder);
  }

  // 日期信息样式
  .date-info {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  // 新增的客户信息样式
  .customer-info {
    .customer-name {
      strong {
        color: var(--el-text-color-primary);
        font-size: 14px;
      }

      .customer-id {
        font-size: 11px;
        color: var(--el-text-color-placeholder);
      }
    }

    .member-number {
      font-family: monospace;
      font-size: 12px;
      color: var(--el-color-primary);
      font-weight: 500;
    }

    .gender-info {
      color: var(--el-text-color-regular);
      font-size: 12px;

      i {
        margin-right: 2px;
      }
    }
  }

  // 联系信息样式
  .contact-info {
    .phone {
      color: var(--el-text-color-primary);
      font-weight: 500;
      font-size: 14px;

      i {
        color: var(--el-color-success);
        margin-right: 4px;
      }
    }

    .email {
      font-size: 12px;
      color: var(--el-text-color-regular);

      i {
        color: var(--el-color-info);
        margin-right: 4px;
      }
    }

    .social-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;

      .social-tag {
        font-size: 11px;
        color: var(--el-text-color-regular);
        background: var(--el-bg-color-page);
        padding: 2px 6px;
        border-radius: 4px;

        i {
          margin-right: 2px;
        }

        &:hover {
          background: var(--el-color-primary-light-9);
          color: var(--el-color-primary);
        }
      }
    }
  }

  // 账户信息样式
  .account-info {
    .balance {
      margin-bottom: 4px;

      .amount-label {
        font-size: 11px;
        color: var(--el-text-color-placeholder);
      }

      .amount-value {
        color: var(--el-color-success);
        font-weight: 500;
        margin-left: 4px;
      }
    }

    .points {
      .points-label {
        font-size: 11px;
        color: var(--el-text-color-placeholder);
      }

      .points-value {
        color: var(--el-color-warning);
        font-weight: 500;
        margin-left: 4px;
      }
    }
  }

  // 地区信息样式
  .location-info {
    .city {
      font-weight: 500;
      color: var(--el-text-color-primary);
      font-size: 13px;
    }

    .province {
      color: var(--el-text-color-placeholder);
      font-size: 11px;
    }

    .address {
      color: var(--el-text-color-regular);
      font-size: 11px;
      line-height: 1.3;
    }
  }

  // 消费信息样式
  .purchase-info {
    .total-spent {
      margin-bottom: 4px;

      .spent-label {
        font-size: 11px;
        color: var(--el-text-color-placeholder);
      }

      .spent-value {
        color: var(--el-color-danger);
        font-weight: 600;
        margin-left: 4px;
      }
    }

    .last-purchase,
    .register-date {
      font-size: 11px;
      color: var(--el-text-color-placeholder);

      .purchase-label,
      .register-label {
        color: var(--el-text-color-placeholder);
      }
    }
  }

  // 操作按钮样式（与库存页面一致）
  .action-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;

    .btn {
      padding: 4px 8px;
      font-size: 12px;
      white-space: nowrap;

      i {
        font-size: 11px;
        margin-right: 2px;
      }
    }
  }

  // 空状态样式
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--el-text-color-placeholder);

    i {
      font-size: 48px;
      margin-bottom: 16px;
      color: var(--el-border-color-darker);
    }

    p {
      margin: 0;
      font-size: 14px;
    }
  }

  // 辅助文本样式
  .text-muted {
    color: var(--el-text-color-placeholder);
  }

  .small {
    font-size: 12px;
  }

  .text-center {
    text-align: center;
  }

  .py-8 {
    padding-top: 32px;
    padding-bottom: 32px;
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

// 响应式设计
@media (max-width: 767px) {
  .page-body {
    padding: 12px;
    margin-top: 16px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .stats-cards .stat-card {
    padding: 12px 10px;
    border-radius: 16px;
    gap: 10px;
    align-items: center;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  .stats-cards .stat-card .stat-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 16px;
    flex-shrink: 0;
  }

  .stats-cards .stat-card .stat-content {
    min-width: 0;
  }

  .stats-cards .stat-card .stat-content .stat-value {
    font-size: 18px;
    line-height: 1.1;
    margin-bottom: 2px;
  }

  .stats-cards .stat-card .stat-content .stat-label {
    font-size: 11px;
    line-height: 1.35;
  }

  .page-title {
    font-size: 24px;
    margin-bottom: 6px;
  }

  .page-subtitle {
    font-size: 14px;
  }

  // 新增客户按钮在移动端保持突出
  .btn-add-customer {
    background: linear-gradient(135deg, #10b981, #059669);
    min-width: 120px !important;
  }
}

// 小屏幕手机适配（小于480px）
@media (max-width: 480px) {
  .page-body {
    padding: 10px;
  }

  .stats-cards {
    gap: 8px;
    margin-bottom: 14px;
  }

  .stats-cards .stat-card {
    padding: 10px 8px;
    gap: 8px;
    border-radius: 14px;
  }

  .stats-cards .stat-card .stat-icon {
    width: 34px;
    height: 34px;
    font-size: 14px;
    border-radius: 10px;
  }

  .stats-cards .stat-card .stat-content .stat-value {
    font-size: 16px;
  }

  .stats-cards .stat-card .stat-content .stat-label {
    font-size: 10px;
  }

}

.page-body {
  padding: 16px;
}

// 继续添加移动端适配的媒体查询
@media (max-width: 767px) {
  .table-section {
    .section-header {
      padding: 12px 16px;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .table-pagination {
      padding: 12px 16px;
    }

    // 移动端表格适配
    .data-table {
      font-size: 12px;
      width: 100%;
      table-layout: fixed;

      th,
      td {
        padding: 8px 4px;
        font-size: 11px;
        white-space: normal;
        word-break: break-word;
        box-sizing: border-box;
      }

      th:nth-child(1),
      td:nth-child(1) {
        width: 32%;
      }

      th:nth-child(2),
      td:nth-child(2) {
        width: 30%;
      }

      th:nth-child(3),
      td:nth-child(3) {
        width: 38%;
      }

      .customer-info {
        width: 100%;
        text-align: center;

        .customer-name {
          strong {
            font-size: 13px;
            line-height: 1.35;
          }
        }

        .member-number {
          font-size: 10px;
        }

        .gender-info {
          font-size: 10px;
        }
      }

      .contact-info {
        text-align: center;

        .phone {
          justify-content: center;
          font-size: 11px;
          line-height: 1.35;
        }
      }

      .action-buttons {
        flex-direction: column;
        gap: 2px;

        .btn {
          font-size: 10px;
          padding: 2px 6px;
          min-height: 24px;
          min-width: auto;
        }
      }
    }
  }

  .table-section .table-responsive {
    overflow-x: hidden;
  }

  .mobile-member-number {
    font-size: 10px;
    line-height: 1.35;
    color: var(--el-color-primary);
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-weight: 600;
    text-align: center;
  }

  // 搜索和操作按钮适配
  .search-actions {
    flex-direction: column;
    gap: 8px;

    .btn {
      width: 100%;
      justify-content: center;
    }
  }

  // 分页适配
  .table-pagination {
    .Pagination {
      text-align: center;
    }
  }
}

@media (max-width: 480px) {
  .table-section .data-table th,
  .table-section .data-table td {
    padding: 6px 4px;
    font-size: 10px;
  }

  .mobile-member-number {
    font-size: 9px;
  }

  .table-section .customer-info .customer-name strong {
    font-size: 12px;
  }

  .table-section .contact-info .phone {
    font-size: 10px;
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
          gap: 8px;
          flex-wrap: wrap;
        }
      }
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 0 4px;

      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: #f8f9fa;
        border-radius: 8px;
        transition: all 0.2s ease;

        &:hover {
          background: #e9ecef;
        }

        .label {
          font-size: 13px;
          color: #6c757d;
          font-weight: 500;
        }

        .value {
          font-size: 14px;
          color: #212529;
          font-weight: 500;

          &.phone {
            font-family: 'Courier New', monospace;
            letter-spacing: 0.5px;
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

    .purchases-section {
      // 移动端表格适配
      .table-responsive {
        overflow-x: scroll;
        -webkit-overflow-scrolling: touch;
      }

      .data-table {
        thead th {
          padding: 10px 8px;
          font-size: 11px;
        }

        tbody td {
          padding: 8px 6px;
          font-size: 11px;
        }

        .imei,
        .serial-number {
          font-size: 10px;
        }
      }
    }

    .panel-left {
      .info-grid {
        padding: 0;
      }

      .info-grid .info-row {
        padding: 10px 12px;
        gap: 10px;

        .label {
          font-size: 12px;
        }

        .value {
          font-size: 13px;
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

    .btn {
      width: 100%;
    }

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
// 客户详情对话框中的购买记录表格样式
.customer-detail-view {
  .purchases-section {
    .table-responsive {
      overflow-x: auto;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 0;
      background: white;

      // 表头样式 - 深色渐变背景
      thead {
        th {
          background: linear-gradient(135deg, #495057 0%, #343a40 100%);
          color: white;
          padding: 12px 10px;
          text-align: center;
          font-weight: 600;
          font-size: 14px;
          text-transform: none;
          letter-spacing: 0.5px;
          border-right: 1px solid #dee2e6;
          border-bottom: 2px solid #dee2e6;
          position: relative;
          white-space: nowrap;
          min-width: 60px;

          &:last-child {
            border-right: none;
          }

          // 底部装饰线
          &::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
          }
        }
      }

      // 表格单元格样式
      tbody {
        tr {
          transition: all 0.2s ease;
          position: relative;

          &:nth-child(even) {
            background: #f8f9fa;
          }

          &:hover {
            background: #e3f2fd;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

            td {
              border-bottom-color: #dee2e6;
            }
          }

          td {
            padding: 6px 6px;
            border-right: 1px solid #e9ecef;
            border-bottom: 1px solid #e9ecef;
            vertical-align: middle;
            font-size: 14px;
            color: #2c3e50;
            font-weight: 500;
            text-align: center;
            position: relative;

            &:last-child {
              border-right: none;
            }
          }
        }
      }

      // 序号徽章样式 - 紫色渐变
      .index-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
      }

      // IMEI 样式 - 等宽字体
      .imei {
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
        font-size: 11px;
        font-weight: 600;
        color: #495057;
        letter-spacing: 0.5px;
      }

      // 序列号样式 - 等宽字体
      .serial-number {
        font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
        font-size: 11px;
        font-weight: 600;
        color: #495057;
        letter-spacing: 0.5px;
      }

      // 价格单元格样式
      .price {
        font-family: 'Monaco', 'Consolas', monospace;
        font-weight: 600;
        color: #e6a23c;
        font-size: 13px;
        text-align: center;
      }

      // 利润单元格样式
      .price-cell {
        font-family: 'Monaco', 'Consolas', monospace;
        font-weight: 600;
        font-size: 13px;
        text-align: center;

        &.profit-positive {
          color: #67c23a;
        }

        &.profit-negative {
          color: #f56c6c;
        }
      }

      // 时间单元格样式
      .time-cell {
        font-size: 12px;
        color: #2c3e50;
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        text-align: center;
        font-weight: 500;
      }
    }
  }
}

// 移动端响应式
@media (max-width: 768px) {
  .customer-detail-view {
    .purchases-section {
      .table-responsive {
        overflow-x: scroll;
        -webkit-overflow-scrolling: touch;
      }

      .data-table {
        thead th {
          padding: 6px 4px;
          font-size: 10px;
        }

        tbody td {
          padding: 4px 2px;
          font-size: 10px;
        }

        .imei,
        .serial-number {
          font-size: 9px;
        }
      }
    }
  }

  // 主页面客户列表表格移动端自适应
  .table-section {
    border-radius: 0;
    border-left: none;
    border-right: none;

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;

      h4 {
        font-size: 14px;
      }

      .record-count {
        font-size: 12px;
      }
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 0;
    }

    .data-table {
      font-size: 12px;

      thead th {
        padding: 8px 6px;
        font-size: 11px;
        white-space: nowrap;
      }

      tbody td {
        padding: 6px 4px;
        font-size: 11px;
      }

      // 移动端隐藏次要列 - 使用 nth-child
      // 第1列: checkbox, 第2列: 客户信息, 第3列: 联系方式, 第4列: 客户类型
      // 第5列: VIP等级, 第6列: 账户信息, 第7列: 地区, 第8列: 消费统计
      // 第9列: 状态, 第10列: 操作
      thead th:nth-child(5),
      thead th:nth-child(6),
      thead th:nth-child(7),
      thead th:nth-child(8),
      tbody td:nth-child(5),
      tbody td:nth-child(6),
      tbody td:nth-child(7),
      tbody td:nth-child(8) {
        display: none;
      }

      // 优化联系方式列显示
      tbody td:nth-child(3) {
        .contact-info {
          .email,
          .social-links {
            display: none;
          }
        }
      }

      // 优化客户信息列显示
      tbody td:nth-child(2) {
        .customer-info {
          .gender-info,
          .member-number {
            font-size: 10px;
          }
        }
      }

      // 操作按钮只显示图标
      .action-buttons {
        .btn-action {
          padding: 4px 8px;
          font-size: 11px;

          .btn-text {
            display: none;
          }

          i {
            margin: 0;
          }
        }
      }
    }

    .table-pagination {
      padding: 10px;
      flex-direction: column;
      gap: 8px;

      .pagination-info {
        font-size: 12px;
      }
    }
  }

  // 客户信息卡片样式移动端优化
  .customer-info {
    .customer-name {
      font-size: 14px;
    }

    .customer-phone {
      font-size: 12px;
    }
  }

  // 操作按钮移动端优化
  .action-buttons {
    gap: 4px;

    .btn-action {
      padding: 4px 8px;
      font-size: 11px;

      span {
        display: none; // 移动端只显示图标
      }
    }
  }
}
</style>
