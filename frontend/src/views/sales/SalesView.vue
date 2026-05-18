<template>
  <div class="sales-view admin-page safe-area-top">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionAccessNotice
      v-if="!canView"
      module-name="销售管理"
      permission-name="销售管理查看权限"
      permission-code="sales:view"
      :has-menu-permission-only="hasMenuPermissionOnly"
      :related-permissions="salesPermissions"
      detail-title="销售管理相关权限"
    />

    <!-- 页面头部 - 查看权限控制 -->
    <div v-else>
      <PageHeader
        icon="fas fa-store"
        title="销售管理"
      >
        <template #actions>
          <el-button
            @click="toggleBatchMode"
            :type="batchMode ? 'success' : 'primary'"
            :plain="!batchMode"
            :disabled="!canCreate"
          >
            <i :class="batchMode ? 'fas fa-check-square' : 'fas fa-mobile-alt'"></i>
            <span>{{ batchMode ? '批量模式' : '单台模式' }}</span>
          </el-button>
          <el-tag v-if="batchMode && selectedPhones.length > 0" type="success" effect="dark" class="ml-3">
            已选择: {{ selectedPhones.length }} 台
          </el-tag>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="exportingAvailablePhones"
            export-label="导出"
            export-loading-label="导出中..."
            export-icon-class="fas fa-file-excel"
            export-type="success"
            @export="exportAvailablePhones"
          />
          <el-button
            @click="handleRefresh"
            type="info"
            :disabled="refreshing"
          >
            <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>
    </div>

    <div v-if="canView" class="content admin-page-content">
      <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewSaleField('stats_available_inventory')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-boxes"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total || 0 }}</div>
          <div class="stat-label">库存总数</div>
        </div>
      </div>
      <div v-if="canViewSaleField('stats_today_sales')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-calendar-day"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ todaySold }}</div>
          <div class="stat-label">今日出库</div>
        </div>
      </div>
      <div class="stat-card" v-if="canViewPrice && canViewSaleField('stats_inventory_value')">
        <div class="stat-icon">
          <i class="fas fa-dollar-sign"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">¥{{ newInventoryValue }}</div>
          <div class="stat-label">全新库存金额</div>
        </div>
      </div>
      <div class="stat-card" v-if="canViewPrice && canViewSaleField('stats_avg_profit_margin')">
        <div class="stat-icon inactive">
          <i class="fas fa-chart-line"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">¥{{ usedInventoryValue }}</div>
          <div class="stat-label">二手库存金额</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      @search="loadAvailablePhones"
      @reset="resetFilters"
    >
      <template #primary>
        <el-input
          v-if="showSalesSearchKeyword"
          v-model="filters.search"
          placeholder="搜索关键词"
          clearable
          @input="debounceLoadAvailablePhones"
          @keyup.enter="loadAvailablePhones"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <!-- 供应商 -->
      <div v-if="canViewSaleField('supplier_name')" class="form-group filter-item" data-field="supplier">
          <el-select
            v-model="filters.supplier_id"
            placeholder="供应商"
            filterable
            clearable
            @change="loadAvailablePhones"
          >
            <el-option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
            />
          </el-select>
      </div>

      <!-- 店铺 -->
      <div v-if="canViewSaleField('store_name')" class="form-group filter-item" data-field="store">
          <el-select
            v-model="filters.store_id"
            placeholder="店铺"
            filterable
            clearable
            @change="loadAvailablePhones"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
      </div>

      <!-- 品牌 -->
      <div v-if="canViewSaleField('brand')" class="form-group filter-item" data-field="brand">
          <el-select
            v-model="filters.brand"
            placeholder="品牌"
            filterable
            clearable
            @change="handleBrandChange"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.id"
              :label="brand.name"
              :value="brand.name"
            />
          </el-select>
      </div>

      <!-- 型号 -->
      <div v-if="canViewSaleField('model')" class="form-group filter-item" data-field="model">
          <el-select
            v-model="filters.model"
            placeholder="型号"
            filterable
            clearable
            @change="loadAvailablePhones"
            :disabled="!filters.brand && brandModels.length === 0"
          >
            <el-option
              v-for="model in brandModels"
              :key="model.id"
              :label="model.name"
              :value="model.name"
            />
          </el-select>
      </div>

      <!-- 颜色 -->
      <div v-if="canViewSaleField('color')" class="form-group filter-item" data-field="color">
          <el-select
            v-model="filters.color"
            placeholder="颜色"
            filterable
            clearable
            @change="loadAvailablePhones"
            allow-create
          >
            <el-option
              v-for="color in colors"
              :key="color"
              :label="color"
              :value="color"
            />
          </el-select>
      </div>

      <!-- 内存 -->
      <div v-if="canViewSaleField('memory')" class="form-group filter-item" data-field="memory">
          <el-select
            v-model="filters.memory"
            placeholder="内存"
            filterable
            clearable
            @change="loadAvailablePhones"
            allow-create
          >
            <el-option
              v-for="memory in memories"
              :key="memory"
              :label="memory"
              :value="memory"
            />
          </el-select>
      </div>

      <!-- 机况 -->
      <div v-if="canViewSaleField('condition')" class="form-group filter-item" data-field="condition">
          <el-select
            v-model="filters.is_new"
            placeholder="机况"
            clearable
            :teleported="true"
            popper-class="condition-select-dropdown"
            @change="loadAvailablePhones"
          >
            <el-option label="全新" value="1" />
            <el-option label="二手" value="0" />
          </el-select>
      </div>

      <!-- 入库员 -->
      <div v-if="canViewSaleField('inventory_operator_name')" class="form-group filter-item" data-field="operator">
          <el-select
            v-model="filters.operator_id"
            placeholder="入库员"
            filterable
            clearable
            @change="loadAvailablePhones"
          >
            <el-option
              v-for="operator in operators"
              :key="operator.id"
              :label="operator.name || operator.username"
              :value="operator.id"
            />
          </el-select>
      </div>

      <!-- 入库日期 -->
      <div v-if="canViewSaleField('Inventorytime')" class="form-group filter-item">
          <el-date-picker
            v-model="filters.date_start"
            type="date"
            placeholder="开始日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :clearable="true"
            @change="loadAvailablePhones"
            style="width: 140px"
          />
      </div>

      <!-- 结束日期 -->
      <div v-if="canViewSaleField('Inventorytime')" class="form-group filter-item">
          <el-date-picker
            v-model="filters.date_end"
            type="date"
            placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :clearable="true"
            @change="loadAvailablePhones"
          />
      </div>
    </UnifiedSearchPanel>

    <!-- 数据表格区域 -->
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list"></i>
        可销售设备列表
        <span class="record-count">共 {{ pagination.total || 0 }} 条记录</span>
      </div>

      <div class="view-controls">
        <!-- 批发/划拨按钮组 -->
        <div v-if="canWholesalePermission || canProxyTransferPermission" class="wholesale-actions">
          <el-button
            v-if="canWholesalePermission"
            :type="operationMode === 'wholesale' ? 'success' : 'default'"
            :class="{ active: operationMode === 'wholesale' }"
            size="small"
            :disabled="!canWholesalePermission"
            @click="handleWholesale"
          >
            <i class="fas fa-boxes"></i>
            <span>调货</span>
            <span v-if="selectedPhones.length > 0" class="badge">({{ selectedPhones.length }})</span>
          </el-button>
          <el-button
            v-if="canProxyTransferPermission"
            :type="operationMode === 'proxy' ? 'warning' : 'default'"
            :class="{ active: operationMode === 'proxy' }"
            size="small"
            :disabled="!canProxyTransferPermission"
            @click="handleProxyTransfer"
          >
            <i class="fas fa-exchange-alt"></i>
            <span>划拨</span>
            <span v-if="selectedPhones.length > 0" class="badge">({{ selectedPhones.length }})</span>
          </el-button>
          <el-divider v-if="canWholesalePermission || canProxyTransferPermission" direction="vertical" />
        </div>

        <!-- 视图切换按钮组 -->
        <div class="view-toggle">
          <el-button
            @click="viewMode = 'summary'"
            :type="viewMode === 'summary' ? 'primary' : 'default'"
            title="对存表"
          >
            <i class="fas fa-table"></i>
            <span class="view-toggle-text">对库</span>
          </el-button>
          <el-button
            @click="viewMode = 'grid'"
            :type="viewMode === 'grid' ? 'primary' : 'default'"
            title="图文模式"
          >
            <i class="fas fa-th"></i>
            <span class="view-toggle-text">图文</span>
          </el-button>
          <el-button
            @click="viewMode = 'table'"
            :type="viewMode === 'table' ? 'primary' : 'default'"
            title="表格模式"
          >
            <i class="fas fa-list"></i>
            <span class="view-toggle-text">表格</span>
          </el-button>
        </div>
      </div>

      <!-- 批发/划拨操作提示 -->
      <div
        v-if="operationMode && ((operationMode === 'wholesale' && canWholesalePermission) || (operationMode === 'proxy' && canProxyTransferPermission))"
        class="operation-tip"
      >
        <div class="operation-bar" :class="operationMode === 'wholesale' ? 'wholesale-mode' : 'proxy-mode'">
          <div class="operation-info">
            <i class="fas" :class="operationMode === 'wholesale' ? 'fa-boxes' : 'fa-exchange-alt'"></i>
            <span v-if="selectedPhones.length === 0">请勾选需要{{ operationMode === 'wholesale' ? '调货' : '划拨' }}的手机</span>
            <span v-else>{{ operationMode === 'wholesale' ? '调货' : '划拨' }}数量 {{ selectedPhones.length }} 台</span>
          </div>
          <el-button
            v-if="selectedPhones.length > 0"
            :type="operationMode === 'wholesale' ? 'success' : 'warning'"
            :disabled="operationMode === 'wholesale' ? !canWholesale : !canProxy"
            @click="openWholesaleModal"
            size="default"
          >
            确认{{ operationMode === 'wholesale' ? '调货' : '划拨' }}
          </el-button>
        </div>
      </div>

      <!-- 批量销售表单 -->
      <div v-if="batchMode && selectedPhones.length > 0" class="batch-sale-form">
        <div class="form-header">
          <h3>批量销售信息 ({{ selectedPhones.length }}台)</h3>
          <el-button @click="clearBatchSelection" type="info" plain size="small">
            <i class="fas fa-times"></i>
            清空选择
          </el-button>
        </div>

        <div class="sale-form-grid">
          <!-- 客户信息 -->
          <div class="form-section">
            <h4>客户信息</h4>
            <div class="form-row">
              <div v-if="canViewSaleField('customer_name')" class="form-group">
                <label class="form-label required">客户姓名</label>
                <div class="input-group">
                  <input
                    ref="batchCustomerNameInputRef"
                    v-model="batchSaleForm.customer_name"
                    type="text"
                    class="form-control"
                    name="batch-customer-name"
                    placeholder=""
                    :readonly="!selectedBatchCustomer && !batchCustomerCreating ? true : !batchCustomerNameEditing"
                    @dblclick="enableBatchCustomerNameEdit"
                    @touchend="handleBatchCustomerNameTouchEnd"
                    @input="handleBatchCustomerNameInput"
                    @blur="disableBatchCustomerNameEdit"
                    :class="{ 'editable': selectedBatchCustomer || batchCustomerCreating }"
                    :title="selectedBatchCustomer ? '双击编辑客户信息' : (batchCustomerCreating ? '输入姓名后，点击其他地方自动创建客户' : '请先按手机号选择客户')"
                  />
                  <el-button
                    v-if="batchCustomerNameEditing"
                    class="customer-lock-button"
                    type="success"
                    plain
                    @click="saveBatchCustomerNameEdit"
                    title="当前已解锁，点击保存并锁定"
                  >
                    <i class="fas fa-lock-open"></i>
                  </el-button>
                  <el-button
                    v-if="selectedBatchCustomer !== null && !batchCustomerNameEditing"
                    class="customer-lock-button"
                    type="info"
                    plain
                    @click="clearSelectedBatchCustomer"
                    title="当前已锁定，点击清除客户选择"
                  >
                    <i class="fas fa-lock"></i>
                  </el-button>
                </div>
                <small v-if="selectedBatchCustomer && !batchCustomerNameEditing" class="form-hint">双击姓名可编辑客户信息</small>
              </div>
              <div v-if="canViewSaleField('customer_phone')" class="form-group">
                <label class="form-label required">客户电话</label>
                <div class="customer-search-container">
                  <input
                    v-model="batchSaleForm.customer_phone"
                    type="text"
                    class="form-control"
                    placeholder="请输入用户手机号"
                    required
                    @input="handleBatchCustomerPhoneInput"
                    @focus="showBatchCustomerSearch = true"
                    @blur="handleBatchCustomerBlur"
                    :readonly="selectedBatchCustomer !== null"
                    :class="{ 'locked': selectedBatchCustomer !== null }"
                    title="已选择客户后不可修改，请清除后重新选择"
                  />
                  <div v-if="showBatchCustomerSearch && (batchCustomerSearchResults.length > 0 || batchCustomerSearching || (batchSaleForm.customer_phone.length >= 11 && !selectedBatchCustomer && !batchCustomerSearching))" class="customer-search-results">
                    <div v-if="batchCustomerSearching" class="search-loading">
                      <i class="fas fa-spinner fa-spin"></i>
                      搜索中...
                    </div>
                    <template v-else>
                      <div
                        v-for="customer in batchCustomerSearchResults"
                        :key="customer.id"
                        class="customer-item"
                        @click="selectBatchCustomer(customer)"
                      >
                        <div class="customer-info">
                          <div class="customer-name">{{ customer.name }}</div>
                          <div class="customer-phone">{{ customer.phone }}</div>
                          <div class="customer-meta" v-if="customer.apple_id">
                            <i class="fas fa-apple"></i>
                            {{ customer.apple_id }}
                          </div>
                        </div>
                      </div>
                      <!-- 创建新客户提示 -->
                      <div v-if="batchSaleForm.customer_phone.length >= 11 && batchCustomerSearchResults.length === 0 && !selectedBatchCustomer" class="create-new-customer" @click="createNewBatchCustomer">
                        <i class="fas fa-user-plus"></i>
                        点击创建该用户
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-row">
              <div v-if="canViewSaleField('customer_apple_id')" class="form-group">
                <label class="form-label">Apple ID</label>
                <input
                  v-model="batchSaleForm.apple_id"
                  type="text"
                  class="form-control"
                  placeholder="请输入Apple ID（手机号或邮箱）"
                  @input="handleBatchCustomerAppleIdInput"
                />
              </div>
            </div>
          </div>

          <!-- 销售信息 -->
          <div class="form-section">
            <h4>销售信息</h4>
            <div class="form-row">
              <div v-if="canViewSaleField('sale_price')" class="form-group">
                <label class="form-label required">销售单价</label>
                <input
                  v-model.number="batchSaleForm.sale_price"
                  type="number"
                  class="form-control"
                  placeholder="请输入销售单价"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
              <div v-if="canViewSaleField('store_id')" class="form-group">
                <label class="form-label required">销售店铺</label>
                <select v-model="batchSaleForm.store_id" class="form-control" required>
                  <option value="">请选择销售店铺</option>
                  <option v-for="store in stores" :key="store.id" :value="store.id">
                    {{ store.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div v-if="canViewSaleField('operator_id')" class="form-group">
                <label class="form-label required">销售员</label>
                <select v-model="batchSaleForm.operator_id" class="form-control" required>
                  <option value="">请选择销售员</option>
                  <option v-for="operator in operators" :key="operator.id" :value="operator.id">
                    {{ operator.name || operator.username }}
                    <span v-if="isCurrentUser(operator)" class="current-user-badge">(当前用户)</span>
                  </option>
                </select>
              </div>
              <div v-if="canViewSaleField('sale_date')" class="form-group">
                <label class="form-label required">销售日期</label>
                <input
                  v-model="batchSaleForm.sale_date"
                  type="date"
                  class="form-control"
                  required
                />
              </div>
            </div>
          </div>

          <!-- 支付信息 -->
          <div class="form-section">
            <h4>支付信息</h4>
            <div class="form-row">
              <div v-if="canViewSaleField('payment_method')" class="form-group">
                <label class="form-label required">支付方式</label>
                <select v-model="batchSaleForm.payment_method" class="form-control" required>
                  <option value="">请选择支付方式</option>
                  <option value="cash">现金</option>
                  <option value="mobile">移动支付</option>
                  <option value="transfer">银行转账</option>
                </select>
              </div>
              <div class="form-group" v-if="canViewSaleField('payment_method') && (batchSaleForm.payment_method === 'mobile' || batchSaleForm.payment_method === 'transfer')">
                <label class="form-label">支付渠道</label>
                <select v-model="batchSaleForm.payment_channel" class="form-control">
                  <option value="">请选择支付渠道</option>
                  <option value="wechat">微信</option>
                  <option value="alipay">支付宝</option>
                </select>
              </div>
            </div>
            <div class="form-row" v-if="canViewSaleField('transaction_no') && (batchSaleForm.payment_method === 'mobile' || batchSaleForm.payment_method === 'transfer')">
              <div class="form-group">
                <label class="form-label">交易流水号</label>
                <input
                  v-model="batchSaleForm.transaction_no"
                  type="text"
                  class="form-control"
                  placeholder="请输入交易流水号（可选）"
                />
              </div>
            </div>
          </div>

          <!-- 利润计算 -->
          <div class="form-section" v-if="batchSaleForm.sale_price && canViewPrice">
            <h4>利润计算</h4>
            <div class="profit-summary">
              <div class="profit-item">
                <span class="label">总成本:</span>
                <span class="value">¥{{ getTotalCost() }}</span>
              </div>
              <div class="profit-item">
                <span class="label">总收入:</span>
                <span class="value">¥{{ (parseFloat(batchSaleForm.sale_price) * selectedPhones.length).toFixed(2) }}</span>
              </div>
              <div class="profit-item">
                <span class="label">总利润:</span>
                <span class="value" :class="Number(getTotalProfit) >= 0 ? 'positive' : 'negative'">
                  ¥{{ getTotalProfit }}
                </span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="form-actions">
            <el-button @click="debouncedSubmitBatchSale" type="success"
                    :disabled="submitting"
                    :class="{ 'btn-loading': submitting }"
                    @keydown.enter.prevent>
              <i class="fas fa-shopping-cart"></i>
              <span v-if="!submitting">确认批量销售</span>
              <span v-else>
                <i class="fas fa-spinner fa-spin"></i>
                处理中...
              </span>
            </el-button>
            <el-button @click="clearBatchSelection" type="info" plain>
              取消
            </el-button>
          </div>
        </div>
      </div>

        <!-- 网格视图 -->
        <div v-if="viewMode === 'grid'" class="devices-grid">
          <div v-if="loading" class="loading-state">
            <GlobalLoading />
            <p>加载中...</p>
          </div>
          <div v-else-if="availablePhones.length === 0" class="empty-state">
            <i class="fas" :class="hasActiveFilters ? 'fa-search' : 'fa-inbox'"></i>
            <h3>{{ hasActiveFilters ? '未找到匹配的设备' : '暂无可销售设备' }}</h3>
            <p>{{ hasActiveFilters ? '尝试调整筛选条件或清空部分筛选条件' : '调整筛选条件或添加新的库存设备' }}</p>
            <el-button v-if="hasActiveFilters" @click="resetFilters" type="primary" plain class="mt-3">
              <i class="fas fa-redo"></i> 清空筛选条件
            </el-button>
          </div>
          <div v-else class="grid-container">
            <div
              v-for="phone in sortedForGridView"
              :key="phone.id"
              class="device-card"
            >
              <div class="card-image">
                <Image
                  :src="getPhoneImageSrc(phone)"
                  :alt="phone.model"
                  mode="eager"
                  :product-info="{
                    brand: phone.brand || '',
                    model: phone.model || '',
                    color: phone.color || '',
                    memory: phone.memory || ''
                  }"
                />
                <div class="card-badges">
                  <span v-if="phone.is_new" class="badge badge-new">全新</span>
                  <span v-else class="badge badge-used">二手</span>
                  <span v-if="canViewSaleField('brand')" class="badge badge-brand">{{ phone.brand }}</span>
                </div>
              </div>
              <div class="card-content">
                <div class="device-title-row">
                  <h4 class="device-title">{{ canViewSaleField('model') ? phone.model : '设备信息' }}</h4>
                  <div class="device-title-meta">
                    <span v-if="canViewSaleField('memory')" class="title-memory">{{ phone.memory || '-' }}</span>
                    <span class="title-price">{{ canViewPrice ? `¥${formatNumber(phone.purchase_cost || phone.purchase_price || 0)}` : '***' }}</span>
                  </div>
                </div>
                <div class="device-specs">
                  <div v-if="canViewSaleField('supplier_name') || canViewSaleField('store_name')" class="spec-row spec-row-supplier-store">
                    <div v-if="canViewSaleField('supplier_name')" class="spec-item supplier-spec-item">
                      <span class="spec-label">供应商:</span>
                      <span class="spec-value">{{ phone.supplier_name || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('store_name')" class="spec-item store-spec-item">
                      <span class="spec-label">店铺:</span>
                      <span class="spec-value">{{ phone.store_name || '-' }}</span>
                    </div>
                  </div>
                  <div v-if="canViewSaleField('color')" class="spec-row">
                    <div class="spec-item">
                      <span class="spec-label">颜色:</span>
                      <span class="spec-value">{{ phone.color || '-' }}</span>
                    </div>
                  </div>
                  <div v-if="canViewSaleField('imei') || canViewSaleField('Inventorytime')" class="spec-row spec-row-imei-time">
                    <div v-if="canViewSaleField('imei')" class="spec-item">
                      <span class="spec-label">IMEI:</span>
                      <span class="spec-value">{{ phone.imei || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('Inventorytime')" class="spec-item">
                      <span class="spec-label">时间:</span>
                      <span class="spec-value">{{ formatDate((phone as any).Inventorytime || phone.purchase_date || phone.created_at) }}</span>
                    </div>
                  </div>
                  <div v-if="!canViewSaleField('color') && !canViewSaleField('imei') && !canViewSaleField('supplier_name') && !canViewSaleField('store_name')" class="spec-row">
                    <div class="spec-item">
                      <span class="spec-label">信息:</span>
                      <span class="spec-value">已按字段权限隐藏</span>
                    </div>
                  </div>
                </div>
                  <div class="card-actions">
                    <el-button
                      v-if="canCreate && canViewSaleField('actions')"
                      @click.stop="openSaleModal(phone)"
                      type="success"
                      title="销售出库"
                      size="small"
                    >
                      <i class="fas fa-shopping-cart"></i>
                      出库
                    </el-button>
                    <el-button
                      v-if="canEdit && canViewSaleField('actions')"
                      @click.stop="editPhone(phone)"
                      type="primary"
                      title="编辑设备信息"
                      size="small"
                    >
                      <i class="fas fa-edit"></i>
                      编辑
                    </el-button>
                    <el-button
                      v-if="canDelete && canViewSaleField('actions')"
                      @click.stop="deletePhone(phone)"
                      type="danger"
                      title="删除设备"
                      size="small"
                    >
                      <i class="fas fa-trash"></i>
                      删除
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 库存统计表视图 -->
        <div v-if="viewMode === 'summary'" class="table-section admin-panel admin-table-panel">
          <div v-if="inventorySummaryLoading" class="loading-state">
            <GlobalLoading />
            <p>加载库存统计中...</p>
          </div>
          <div v-else-if="sortedInventorySummary.length === 0" class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>暂无库存数据</h3>
            <p>调整筛选条件或添加新的库存设备</p>
          </div>
          <div v-else>
            <!-- 保存为图片按钮 -->
            <div class="inventory-summary-actions">
              <ImportExportActions
                :can-export="canExport"
                :export-loading="savingInventorySummary"
                export-type="primary"
                export-label="保存为图片"
                export-loading-label="生成中..."
                export-icon-class="fas fa-camera"
                size="small"
                @export="saveInventorySummaryAsImage"
              />
            </div>
            <!-- 库存统计表 -->
            <div class="table-responsive">
              <table ref="inventorySummaryTableRef" class="devices-table summary-table">
                <thead>
                  <tr>
                    <th v-if="canViewSaleField('supplier_name')">供应商</th>
                    <th v-if="canViewSaleField('store_name')">店铺</th>
                    <th v-if="canViewSaleField('brand')">品牌</th>
                    <th v-if="canViewSaleField('model')">型号</th>
                    <th v-if="canViewSaleField('color')">颜色</th>
                    <th v-if="canViewSaleField('memory')">内存</th>
                    <th v-if="canViewSaleField('condition')">机况</th>
                    <th>数量</th>
                    <th v-if="canViewSaleField('Inventorytime')">在库时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in sortedInventorySummary"
                    :key="index"
                    @dblclick="showInventoryDetail(item)"
                    class="inventory-row"
                  >
                    <td v-if="canViewSaleField('supplier_name')">{{ item.supplier_name || '-' }}</td>
                    <td v-if="canViewSaleField('store_name')">{{ item.store_name || '-' }}</td>
                    <td v-if="canViewSaleField('brand')">{{ item.brand || '-' }}</td>
                    <td v-if="canViewSaleField('model')">{{ item.model || '-' }}</td>
                    <td v-if="canViewSaleField('color')">{{ item.color || '-' }}</td>
                    <td v-if="canViewSaleField('memory')">
                      <span :class="['memory-badge', getMemoryBadgeClass(item.memory)]">
                        {{ item.memory || '-' }}
                      </span>
                    </td>
                    <td v-if="canViewSaleField('condition')">
                      <span :class="['badge', item.condition === '全新' ? 'badge-new' : 'badge-used']">
                        {{ item.condition }}
                      </span>
                    </td>
                    <td>
                      <span class="quantity-badge">{{ item.quantity }}</span>
                    </td>
                    <td v-if="canViewSaleField('Inventorytime')">
                      <span
                        :class="['days-badge', getInventoryDaysClass(getInventoryDays(item.earliest_date))]"
                        :title="`入库时间范围: ${item.earliest_date} ~ ${item.latest_date}\n最早入库: ${item.earliest_date} (${getInventoryDaysText(getInventoryDays(item.earliest_date))})\n最新入库: ${item.latest_date} (${getInventoryDaysText(getInventoryDays(item.latest_date))})`"
                      >
                        {{ getInventoryDaysText(getInventoryDays(item.earliest_date)) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 表格视图 -->
        <div v-if="viewMode === 'table'" class="table-section admin-panel admin-table-panel">
          <div class="table-responsive">
            <table class="devices-table">
              <thead>
                <tr>
                  <th v-if="batchMode || operationMode" class="checkbox-column">
                    <el-checkbox
                      v-model="selectAll"
                      @change="toggleSelectAll"
                      size="large"
                    />
                  </th>
                  <th v-if="canViewSaleField('supplier_name')">供应商</th>
                  <th v-if="canViewSaleField('store_name')">店铺</th>
                  <th v-if="canViewSaleField('brand')">品牌</th>
                  <th v-if="canViewSaleField('model')">型号</th>
                  <th v-if="canViewSaleField('color')">颜色</th>
                  <th v-if="canViewSaleField('memory')">内存</th>
                  <th v-if="canViewSaleField('serial_number')">序列号</th>
                  <th v-if="canViewSaleField('imei')">IMEI</th>
                  <th v-if="canViewPrice">入库价格</th>
                  <th v-if="canViewSaleField('inventory_operator_name')">入库员</th>
                  <th v-if="canViewSaleField('condition')">机况</th>
                  <th>状态</th>
                  <th v-if="canViewSaleField('Inventorytime')">入库时间</th>
                  <th v-if="!batchMode && !operationMode && canViewSaleField('actions')">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td :colspan="salesTableVisibleColumnCount" class="loading-cell">
                    <GlobalLoading size="medium" />
                    <span>加载中...</span>
                  </td>
                </tr>
                <tr v-else-if="availablePhones.length === 0">
                  <td :colspan="salesTableVisibleColumnCount" class="empty-cell">
                    <div class="empty-cell-content">
                      <i class="fas" :class="hasActiveFilters ? 'fa-search' : 'fa-inbox'"></i>
                      <span>{{ hasActiveFilters ? '未找到匹配的设备' : '暂无可销售设备' }}</span>
                      <div v-if="hasActiveFilters" class="mt-2">
                        <el-button @click="resetFilters" type="primary" plain size="small">
                          <i class="fas fa-redo"></i> 清空筛选条件
                        </el-button>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-for="phone in sortedAvailablePhones" :key="phone.id" v-else :class="{ 'selected-row': isPhoneSelected(phone) }">
                  <td v-if="batchMode || operationMode" class="checkbox-column">
                    <el-checkbox
                      :model-value="isPhoneSelected(phone)"
                      @change="togglePhoneSelection(phone)"
                      size="large"
                    />
                  </td>
                  <td v-if="canViewSaleField('supplier_name')">{{ phone.supplier_name || '-' }}</td>
                  <td v-if="canViewSaleField('store_name')">{{ phone.store_name || '-' }}</td>
                  <td v-if="canViewSaleField('brand')">{{ phone.brand || '-' }}</td>
                  <td v-if="canViewSaleField('model')">{{ phone.model || '-' }}</td>
                  <td v-if="canViewSaleField('color')">{{ phone.color || '-' }}</td>
                  <td v-if="canViewSaleField('memory')">{{ phone.memory || '-' }}</td>
                  <td v-if="canViewSaleField('serial_number')">{{ phone.serial_number || '-' }}</td>
                  <td v-if="canViewSaleField('imei')">
                    <span class="imei">{{ phone.imei || '-' }}</span>
                  </td>
                  <td v-if="canViewPrice" class="price-cell">
                    <div class="price">{{ canViewPrice ? `¥${formatNumber(phone.purchase_cost || 0)}` : '***' }}</div>
                  </td>
                  <td v-if="canViewSaleField('inventory_operator_name')">{{ phone.inventory_operator_name || '-' }}</td>
                  <td v-if="canViewSaleField('condition')">
                    <span :class="['condition-badge', phone.is_new ? 'new' : 'used']">
                      {{ getNewConditionLabel(phone.is_new) }}
                    </span>
                  </td>
                  <td>
                    <span :class="['status-badge', getSaleStatusClass(phone)]">
                      {{ getSaleStatusLabel(phone) }}
                    </span>
                  </td>
                  <td v-if="canViewSaleField('Inventorytime')">{{ formatDate((phone as any).Inventorytime || phone.purchase_date || phone.created_at) }}</td>
                  <td class="actions-cell" v-if="!batchMode && !operationMode && canViewSaleField('actions')">
                    <div class="action-buttons">
                      <el-button
                        v-if="canCreate"
                        @click.stop="handleSaleAction(phone)"
                        type="success"
                        size="small"
                        title="销售出库"
                      >
                        <i class="fas fa-shopping-cart"></i>
                        出库
                      </el-button>
                      <el-button
                        v-if="canEdit"
                        @click.stop="editPhone(phone)"
                        type="primary"
                        size="small"
                        title="编辑设备信息"
                      >
                        <i class="fas fa-edit"></i>
                        编辑
                      </el-button>
                      <el-button
                        v-if="canDelete"
                        @click.stop="deletePhone(phone)"
                        type="danger"
                        size="small"
                        title="删除设备"
                      >
                        <i class="fas fa-trash"></i>
                        删除
                      </el-button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <!-- 分页组件 -->
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[100, 200, 500, 1000]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="loading"
          @change="handlePaginationChange"
        />
      </div>
    </div>

    <!-- 销售模态框 -->
    <MobileDialog
      v-model="showSaleModal"
      :title="batchMode ? `批量销售出库 (${selectedPhones.length}台)` : '销售出库'"
      width="1000px"
      dialog-class="sales-sale-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
    >
      <div class="modal-body" @click="showCustomerSearch = false">
        <div class="sale-layout" @click.stop>
            <!-- 设备信息 -->
            <div class="device-info-section">
              <h4>设备信息</h4>

              <!-- 批量模式显示多台设备 -->
              <div v-if="batchMode" class="batch-devices-list">
                <div v-for="(phone, index) in selectedPhones" :key="phone.id" class="device-item compact">
                  <div class="device-number">{{ index + 1 }}</div>
                  <div class="device-image">
                    <Image
                      :src="getPhoneImageSrc(phone)"
                      :alt="phone.brand + ' ' + phone.model"
                      mode="eager"
                      :product-info="{
                        brand: phone.brand || '',
                        model: phone.model || '',
                        color: phone.color || '',
                        memory: phone.memory || ''
                      }"
                    />
                  </div>
                  <div class="device-details">
                    <div class="device-name">
                      {{ [canViewSaleField('brand') ? phone.brand : '', canViewSaleField('model') ? phone.model : ''].filter(Boolean).join(' ') || '设备信息' }}
                    </div>
                    <div class="device-specs">
                      <span v-if="canViewSaleField('color')" class="spec-item">{{ phone.color }}</span>
                      <span v-if="canViewSaleField('memory')" class="spec-item">{{ phone.memory }}</span>
                      <span v-if="canViewSaleField('condition')" class="condition-badge" :class="phone.is_new ? 'new' : 'used'">
                        {{ getNewConditionLabel(phone.is_new) }}
                      </span>
                    </div>
                    <div v-if="canViewSaleField('imei')" class="device-id">
                      <span class="label">IMEI:</span>
                      <span class="imei">{{ phone.imei || '-' }}</span>
                    </div>
                  </div>
                  <div v-if="canViewPrice" class="device-pricing">
                    <div class="cost-info">
                      <span class="cost-label">入库价格</span>
                      <span class="cost-value">{{ canViewPrice ? `¥${formatNumber(phone.purchase_cost || phone.purchase_price || 0)}` : '***' }}</span>
                    </div>
                  </div>
                </div>

                <!-- 批量统计信息 -->
                <div class="batch-summary">
                  <div class="summary-item">
                    <span class="label">总数量:</span>
                    <span class="value">{{ selectedPhones.length }}台</span>
                  </div>
                  <div class="summary-item" v-if="canViewPrice">
                    <span class="label">总成本:</span>
                    <span class="value">¥{{ getTotalCost() }}</span>
                  </div>
                  <div class="summary-item" v-if="canViewPrice && getTotalProfit !== 0">
                    <span class="label">预计总利润:</span>
                    <span class="value" :class="Number(getTotalProfit) >= 0 ? 'positive' : 'negative'">
                      ¥{{ getTotalProfit }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 单台模式显示单台设备 -->
              <div v-else class="device-card compact">
                <div v-if="!isMobile" class="device-image">
                  <Image
                    :src="getPhoneImageSrc(selectedPhone)"
                    :alt="selectedPhone?.model"
                    mode="eager"
                    :product-info="{
                      brand: selectedPhone?.brand || '',
                      model: selectedPhone?.model || '',
                      color: selectedPhone?.color || '',
                      memory: selectedPhone?.memory || ''
                    }"
                  />
                </div>
                <div class="device-details">
                  <template v-if="isMobile">
                    <div class="sale-mobile-device">
                      <div class="sale-mobile-device-card">
                        <div class="sale-mobile-device-head">
                          <div class="sale-mobile-device-main">
                            <span class="sale-mobile-device-name">
                              {{
                                [
                                  canViewSaleField('brand') ? selectedPhone?.brand : '',
                                  canViewSaleField('model') ? selectedPhone?.model : ''
                                ].filter(Boolean).join(' ')
                                  || '设备信息'
                              }}
                            </span>
                            <span class="sale-mobile-device-specs">
                              {{
                                [
                                  canViewSaleField('color') ? selectedPhone?.color : ''
                                ].filter(Boolean).join(' ')
                                  || '-'
                              }}
                            </span>
                          </div>
                          <div v-if="canViewSaleField('condition')" class="sale-mobile-device-tags">
                            <span v-if="canViewSaleField('condition')" class="sale-mobile-device-tag">
                              {{ getNewConditionLabel(selectedPhone?.is_new ?? false) }}
                            </span>
                          </div>
                        </div>

                        <div
                          v-if="canViewSaleField('supplier_name') || canViewSaleField('inventory_operator_name')"
                          class="sale-mobile-info-grid"
                        >
                          <div v-if="canViewSaleField('supplier_name')" class="sale-mobile-info-item">
                            <span class="sale-mobile-info-label">供应商</span>
                            <span class="sale-mobile-info-value">{{ selectedPhone?.supplier_name || '-' }}</span>
                          </div>
                          <div v-if="canViewSaleField('inventory_operator_name')" class="sale-mobile-info-item">
                            <span class="sale-mobile-info-label">入库员</span>
                            <span class="sale-mobile-info-value">{{ selectedPhone?.inventory_operator_name || '-' }}</span>
                          </div>
                        </div>

                        <div
                          v-if="canViewSaleField('memory') || canViewPrice"
                          class="sale-mobile-spec-grid"
                        >
                          <div v-if="canViewSaleField('memory')" class="sale-mobile-spec-item">
                            <span class="sale-mobile-spec-label">内存</span>
                            <span class="sale-mobile-spec-value">{{ selectedPhone?.memory || '-' }}</span>
                          </div>
                          <div v-if="canViewPrice" class="sale-mobile-spec-item">
                            <span class="sale-mobile-spec-label">入库价格</span>
                            <span class="sale-mobile-spec-value sale-mobile-spec-price">
                              ¥{{ formatNumber(selectedPhone?.purchase_cost || 0) }}
                            </span>
                          </div>
                        </div>

                        <div
                          v-if="canViewSaleField('imei') || canViewSaleField('serial_number')"
                          class="sale-mobile-code-row"
                        >
                          <div v-if="canViewSaleField('imei')" class="sale-mobile-code-item">
                            <span class="sale-mobile-code-label">IMEI</span>
                            <span class="sale-mobile-code-value">{{ selectedPhone?.imei || '-' }}</span>
                          </div>
                          <div v-if="canViewSaleField('serial_number')" class="sale-mobile-code-item">
                            <span class="sale-mobile-code-label">序列号</span>
                            <span class="sale-mobile-code-value">{{ selectedPhone?.serial_number || '-' }}</span>
                          </div>
                        </div>

                        <div
                          v-if="selectedPhone?.purchase_number || canViewSaleField('Inventorytime')"
                          class="sale-mobile-purchase-grid"
                        >
                          <div v-if="canViewSaleField('Inventorytime')" class="sale-mobile-purchase-row">
                            <span class="sale-mobile-purchase-label">入库时间</span>
                            <span class="sale-mobile-purchase-value">
                              {{ formatDate((selectedPhone as any)?.Inventorytime || selectedPhone?.purchase_date || selectedPhone?.created_at) || '-' }}
                            </span>
                          </div>
                          <div v-if="selectedPhone?.purchase_number" class="sale-mobile-purchase-row">
                            <span class="sale-mobile-purchase-label">采购编号</span>
                            <span class="sale-mobile-purchase-value">{{ selectedPhone?.purchase_number }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <div v-else class="device-meta">
                    <div v-if="canViewSaleField('supplier_name')" class="meta-item">
                      <span class="meta-label">供应商:</span>
                      <span class="meta-value">{{ selectedPhone?.supplier_name || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('brand')" class="meta-item">
                      <span class="meta-label">品牌:</span>
                      <span class="meta-value">{{ selectedPhone?.brand || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('model')" class="meta-item">
                      <span class="meta-label">型号:</span>
                      <span class="meta-value">{{ selectedPhone?.model || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('color')" class="meta-item">
                      <span class="meta-label">颜色:</span>
                      <span class="meta-value">{{ selectedPhone?.color || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('memory')" class="meta-item">
                      <span class="meta-label">内存:</span>
                      <span class="meta-value">{{ selectedPhone?.memory || '-' }}</span>
                    </div>
                    <div v-if="canViewPrice" class="meta-item">
                      <span class="meta-label">入库价格:</span>
                      <span class="meta-value price">¥{{ formatNumber(selectedPhone?.purchase_cost || 0) }}</span>
                    </div>
                    <div v-if="canViewSaleField('imei')" class="meta-item meta-item-wide">
                      <span class="meta-label">IMEI:</span>
                      <span class="meta-value">{{ selectedPhone?.imei || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('serial_number')" class="meta-item meta-item-wide">
                      <span class="meta-label">序列号:</span>
                      <span class="meta-value">{{ selectedPhone?.serial_number || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('condition')" class="meta-item">
                      <span class="meta-label">机况:</span>
                      <span class="meta-value">{{ getNewConditionLabel(selectedPhone?.is_new ?? false) }}</span>
                    </div>
                    <div v-if="canViewSaleField('inventory_operator_name')" class="meta-item">
                      <span class="meta-label">入库员:</span>
                      <span class="meta-value">{{ selectedPhone?.inventory_operator_name || '-' }}</span>
                    </div>
                    <div v-if="canViewSaleField('Inventorytime')" class="meta-item meta-item-wide">
                      <span class="meta-label">入库时间:</span>
                      <span class="meta-value">
                        {{ formatDate((selectedPhone as any)?.Inventorytime || selectedPhone?.purchase_date || selectedPhone?.created_at) || '-' }}
                      </span>
                    </div>
                    <div class="meta-item meta-item-wide">
                      <span class="meta-label">采购编号:</span>
                      <span class="meta-value">{{ selectedPhone?.purchase_number || '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 销售表单 -->
            <div class="sale-form-section">
              <h4>销售信息</h4>
              <form @submit.prevent="debouncedSubmitSale" class="sale-form">
                <div class="form-grid">
                  <div v-if="canViewSaleField('customer_phone')" class="form-group">
                    <label class="form-label required">手机号码</label>
                    <div class="customer-search-container">
                      <el-input
                        v-model="saleForm.customer_phone"
                        placeholder="请输入用户手机号"
                        maxlength="11"
                        clearable
                        @input="handleCustomerSearch"
                        @focus="showCustomerSearch = true"
                        :readonly="selectedCustomer !== null"
                        :class="{ 'locked': selectedCustomer !== null }"
                      />
                      <!-- 客户搜索结果 -->
                      <div v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (saleForm.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))" class="customer-search-results">
                        <div v-if="customerSearching" class="search-loading">
                          <i class="fas fa-spinner fa-spin"></i>
                          搜索中...
                        </div>
                        <template v-else>
                          <div
                            v-for="customer in customerSearchResults"
                            :key="customer.id"
                            class="customer-item"
                            @click="selectCustomer(customer)"
                          >
                            <div class="customer-info">
                              <div class="customer-headline">
                                <div class="customer-name">{{ customer.name }}</div>
                                <span v-if="customer.member_number" class="member-number">{{ customer.member_number }}</span>
                              </div>
                              <div class="customer-subline">
                                <span class="customer-phone">{{ customer.phone }}</span>
                                <span class="vip-badge">{{ getVipLabel(customer.vip_level) }}</span>
                              </div>
                            </div>
                          </div>
                          <!-- 当手机号输入完整（11位）且没有搜索结果时，显示创建新客户提示 -->
                          <div v-if="saleForm.customer_phone.length >= 11 && customerSearchResults.length === 0 && !selectedCustomer" class="create-new-customer" @click="createNewCustomer">
                            <i class="fas fa-user-plus"></i>
                            点击创建该用户
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                  <div v-if="canViewSaleField('customer_name')" class="form-group">
                    <label class="form-label">客户姓名</label>
                    <div class="input-group">
                      <el-input
                        ref="saleCustomerNameInputRef"
                        v-model="saleForm.customer_name"
                        name="sale-customer-name"
                        placeholder=""
                        :readonly="!selectedCustomer && !customerCreating ? true : !customerNameEditing"
                        @dblclick="enableCustomerNameEdit"
                        @touchend="handleCustomerNameTouchEnd"
                        @input="handleCustomerNameInput"
                        @blur="handleCustomerNameBlur"
                        @keyup.enter="saveCustomerNameEdit"
                        :class="{ 'editable': selectedCustomer || customerCreating }"
                      />
                      <el-button
                        v-if="customerNameEditing"
                        class="customer-lock-button"
                        type="success"
                        plain
                        @click="saveCustomerNameEdit"
                        title="当前已解锁，点击保存并锁定"
                      >
                        <i class="fas fa-lock-open"></i>
                      </el-button>
                      <el-button
                        v-if="selectedCustomer !== null && !customerNameEditing"
                        class="customer-lock-button"
                        type="info"
                        plain
                        @click="clearSelectedCustomer"
                        title="当前已锁定，点击清除客户选择"
                      >
                        <i class="fas fa-lock"></i>
                      </el-button>
                    </div>
                  </div>
                </div>

                <div class="form-grid">
                  <div v-if="canViewSaleField('customer_apple_id')" class="form-group">
                    <label class="form-label">Apple ID</label>
                    <el-input
                      v-model="saleForm.customer_apple_id"
                      placeholder="客户Apple ID（可选）"
                      clearable
                      @input="handleCustomerAppleIdInput"
                    />
                  </div>
                  <div v-if="canViewSaleField('sale_date')" class="form-group">
                    <label class="form-label required">销售时间</label>
                    <el-date-picker
                      v-model="saleForm.sale_date"
                      type="date"
                      class="sale-date-picker"
                      style="width: 140px"
                      popper-class="sales-sale-dialog-popper"
                      value-format="YYYY-MM-DD"
                      format="YYYY-M-D"
                      placeholder="请选择销售时间"
                      required
                    />
                  </div>
                </div>

                <!-- 价格信息：入库价格和销售价格一行展示 -->
                <div class="form-grid">
                  <div v-if="canViewPrice" class="form-group">
                    <label class="form-label">入库价格</label>
                    <el-input
                      v-model="saleForm.purchase_cost"
                      type="number"
                      placeholder="请输入入库价格"
                      @input="calculateProfit"
                    />
                  </div>
                  <div v-if="canViewSaleField('sale_price')" class="form-group">
                    <label class="form-label required">{{ batchMode ? '销售单价' : '销售价格' }}</label>
                    <el-input
                      v-model="saleForm.sale_price"
                      type="number"
                      placeholder="请输入销售价格"
                      required
                      @input="calculateProfit"
                    />
                  </div>
                </div>

                <div class="form-grid">
                  <div v-if="canViewSaleField('store_id')" class="form-group">
                    <label class="form-label required">销售门店</label>
                    <el-select
                      v-model="saleForm.store_id"
                      placeholder="请选择门店"
                      class="w-full"
                      clearable
                      teleported
                      popper-class="sales-sale-dialog-popper"
                    >
                      <el-option
                        v-for="store in stores"
                        :key="store.id"
                        :label="store.name"
                        :value="String(store.id)"
                      />
                    </el-select>
                  </div>
                  <div v-if="canViewSaleField('operator_id')" class="form-group">
                    <label class="form-label required">销售员</label>
                    <el-select
                      v-model="saleForm.operator_id"
                      placeholder="请选择销售员"
                      class="w-full"
                      clearable
                      teleported
                      popper-class="sales-sale-dialog-popper"
                    >
                      <el-option
                        v-for="operator in operators"
                        :key="operator.id"
                        :label="`${operator.name || operator.username}${isCurrentUser(operator) ? ' (当前用户)' : ''}`"
                        :value="String(operator.id)"
                      />
                    </el-select>
                  </div>
                </div>

                <div class="form-grid">
                  <div v-if="canViewSaleField('payment_method')" class="form-group">
                    <label class="form-label required">支付方式</label>
                    <el-select
                      v-model="saleForm.payment_method"
                      placeholder="请选择支付方式"
                      class="w-full"
                      clearable
                      teleported
                      popper-class="sales-sale-dialog-popper"
                      @change="handlePaymentMethodChange"
                    >
                      <el-option label="现金支付" value="cash" />
                      <el-option label="移动支付" value="mobile" />
                      <el-option label="银行卡" value="bank_card" />
                      <el-option label="国补刷卡" value="subsidy_card" />
                    </el-select>
                  </div>
                  <div class="form-group" v-if="canViewSaleField('payment_method') && (saleForm.payment_method === 'mobile' || saleForm.payment_method === 'bank_card' || saleForm.payment_method === 'subsidy_card')">
                    <label class="form-label">支付渠道</label>
                    <el-select
                      v-model="saleForm.payment_channel"
                      placeholder="请选择支付渠道"
                      class="w-full"
                      clearable
                      teleported
                      popper-class="sales-sale-dialog-popper"
                      @change="handlePaymentChannelChange"
                    >
                      <template v-if="saleForm.payment_method === 'mobile'">
                        <el-option label="微信" value="wechat" />
                        <el-option label="支付宝" value="alipay" />
                      </template>
                      <template v-if="saleForm.payment_method === 'bank_card'">
                        <el-option label="刷卡消费" value="card_consumption" />
                        <el-option label="银行转账" value="bank_transfer" />
                      </template>
                      <template v-if="saleForm.payment_method === 'subsidy_card'">
                        <el-option label="国补刷卡" value="subsidy_card" />
                      </template>
                    </el-select>
                  </div>
                </div>

                <div v-if="canViewSaleField('transaction_no') && (saleForm.payment_method === 'mobile' || saleForm.payment_method === 'transfer')" class="form-group">
                  <label class="form-label">交易流水号</label>
                  <el-input
                    v-model="saleForm.transaction_no"
                    placeholder="请输入交易流水号（可选）"
                    clearable
                  />
                  <small class="form-hint">用于记录支付平台的交易流水号</small>
                </div>

                <div v-if="canViewSaleField('remarks')" class="form-group">
                  <label class="form-label">备注</label>
                  <el-input
                    v-model="saleForm.remarks"
                    type="textarea"
                    :rows="3"
                    placeholder="销售备注信息"
                    resize="none"
                  />
                </div>

                <!-- 利润计算 -->
                <div v-if="profit !== null && canViewPrice" class="profit-calculator">
                  <h5>利润计算</h5>
                  <div class="profit-rows">
                    <div class="profit-row">
                      <span class="profit-label">进价:</span>
                      <span class="profit-value">¥{{ formatNumber(saleForm.purchase_cost || selectedPhone?.purchase_cost || 0) }}</span>
                    </div>
                    <div class="profit-row">
                      <span class="profit-label">销售价:</span>
                      <span class="profit-value">¥{{ saleForm.sale_price }}</span>
                    </div>
                    <div class="profit-row total" :class="profitClass">
                      <span class="profit-label">销售利润:</span>
                      <span class="profit-value">¥{{ profit }}</span>
                    </div>
                    <div class="profit-row margin" :class="profitClass">
                      <span class="profit-label">利润率:</span>
                      <span class="profit-value">{{ profitMargin }}%</span>
                    </div>
                  </div>
                </div>

              </form>
            </div>
          </div>
      </div>
      <template #footer>
        <div class="sale-dialog-footer">
          <el-button type="info" plain @click="closeSaleModal">
            取消
          </el-button>
          <el-button
            type="success"
            :disabled="submitting"
            :class="{ 'btn-loading': submitting }"
            @click="handleSale"
            @keydown.enter.prevent
          >
            <GlobalLoading v-if="submitting" size="medium" />
            {{ submitting ? '处理中...' : '确认出库' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 库存明细弹窗 -->
    <MobileDialog
      v-model="inventoryDetailModal"
      title="库存明细"
      width="50%"
      :close-on-click-modal="false"
      dialog-class="inventory-detail-modal"
      :show-default-footer="false"
      @close="closeInventoryDetailModal"
    >
      <div v-if="inventoryDetailLoading" class="loading-state">
        <GlobalLoading />
        <p>加载库存明细中...</p>
      </div>
      <div v-else class="inventory-detail-content">
        <!-- 上方汇总信息卡片 -->
        <div class="detail-summary-cards">
          <div v-if="canViewSaleField('supplier_name')" class="summary-card highlight">
            <div class="card-label">供应商</div>
            <div class="card-value">{{ inventoryDetailData[0]?.supplier_name || '-' }}</div>
          </div>
          <div v-if="canViewSaleField('store_name')" class="summary-card highlight">
            <div class="card-label">店铺</div>
            <div class="card-value">{{ inventoryDetailData[0]?.store_name || '-' }}</div>
          </div>
          <div v-if="canViewSaleField('brand')" class="summary-card highlight">
            <div class="card-label">品牌</div>
            <div class="card-value">{{ inventoryDetailData[0]?.brand || '-' }}</div>
          </div>
          <div v-if="canViewSaleField('condition')" class="summary-card highlight">
            <div class="card-label">机况</div>
            <div class="card-value">
              <span :class="['badge', inventoryDetailData[0]?.is_new ? 'badge-new' : 'badge-used']">
                {{ inventoryDetailData[0]?.is_new ? '全新' : '二手' }}
              </span>
            </div>
          </div>
          <div class="summary-card highlight">
            <div class="card-label">库存数量</div>
            <div class="card-value">{{ inventoryDetailData.length }} 台</div>
          </div>
          <div class="summary-card" :class="getLongestInventoryClass(longestInventoryDevice?.inventory_days || 0)">
            <div class="card-label">最长在库</div>
            <div class="card-value">
              {{ longestInventoryDevice ? getInventoryDaysText(longestInventoryDevice.inventory_days || 0) : '-' }}
            </div>
          </div>
        </div>

        <!-- 下方详细表格 -->
        <div class="detail-table-wrapper">
          <div class="detail-header">
            <h4>设备列表</h4>
            <span class="record-count">共 {{ inventoryDetailData.length }} 条记录</span>
          </div>
          <div class="table-responsive">
            <table class="devices-table detail-table">
              <thead>
                <tr>
                  <th>优先</th>
                  <th v-if="canViewSaleField('imei')">IMEI</th>
                  <th v-if="canViewSaleField('serial_number')">序列号</th>
                  <th v-if="canViewSaleField('model')">型号</th>
                  <th v-if="canViewSaleField('color')">颜色</th>
                  <th v-if="canViewSaleField('memory')">内存</th>
                  <th v-if="canViewPrice">入库价格</th>
                  <th v-if="canViewSaleField('Inventorytime')">入库时间</th>
                  <th>在库</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="phone in inventoryDetailData"
                  :key="phone.id"
                  :class="{ 'priority-row': phone.id === longestInventoryDevice?.id }"
                >
                  <td class="priority-column">
                    <span v-if="phone.id === longestInventoryDevice?.id" class="priority-badge">
                      <i class="fas fa-star"></i>
                      优先
                    </span>
                    <span v-else class="priority-rank">
                      {{ inventoryDetailData.indexOf(phone) + 1 }}
                    </span>
                  </td>
                  <td v-if="canViewSaleField('imei')" class="imei-cell">{{ phone.imei || '-' }}</td>
                  <td v-if="canViewSaleField('serial_number')" class="sn-cell">{{ phone.serial_number || '-' }}</td>
                  <td v-if="canViewSaleField('model')">{{ phone.model || '-' }}</td>
                  <td v-if="canViewSaleField('color')">{{ phone.color || '-' }}</td>
                  <td v-if="canViewSaleField('memory')">{{ phone.memory || '-' }}</td>
                  <td v-if="canViewPrice">¥{{ formatPrice(phone.purchase_cost) }}</td>
                  <td v-if="canViewSaleField('Inventorytime')">{{ phone.Inventorytime ? formatInventoryDate(phone.Inventorytime) : '-' }}</td>
                  <td>
                    <span :class="['days-badge', getInventoryDaysClass(phone.inventory_days || 0)]">
                      {{ getInventoryDaysText(phone.inventory_days || 0) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MobileDialog>

    <!-- 编辑设备对话框 -->
    <MobileDialog
      v-model="showEditModal"
      title="编辑设备信息"
      width="900px"
      :close-on-click-modal="false"
      dialog-class="sales-edit-dialog"
      :show-default-footer="false"
    >
      <div class="edit-phone-dialog">
        <!-- 商品信息卡片 -->
        <div class="info-cards-container">
          <div v-if="canViewSaleField('brand')" class="info-card">
            <div class="card-icon brand">
              <i class="fas fa-tag"></i>
            </div>
            <div class="card-details">
              <div class="card-label">品牌</div>
              <div class="card-primary-text">{{ editForm.brand || '未设置' }}</div>
            </div>
          </div>

          <div v-if="canViewSaleField('model')" class="info-card">
            <div class="card-icon model">
              <i class="fas fa-mobile-screen"></i>
            </div>
            <div class="card-details">
              <div class="card-label">型号</div>
              <div class="card-primary-text">{{ editForm.model || '未设置' }}</div>
            </div>
          </div>

          <div v-if="canViewSaleField('color')" class="info-card">
            <div class="card-icon color">
              <i class="fas fa-palette"></i>
            </div>
            <div class="card-details">
              <div class="card-label">颜色</div>
              <div class="card-primary-text">{{ editForm.color || '未设置' }}</div>
            </div>
          </div>

          <div v-if="canViewSaleField('memory')" class="info-card">
            <div class="card-icon memory">
              <i class="fas fa-memory"></i>
            </div>
            <div class="card-details">
              <div class="card-label">内存</div>
              <div class="card-primary-text">{{ editForm.memory || '未设置' }}</div>
            </div>
          </div>

          <div v-if="canViewSaleField('serial_number')" class="info-card">
            <div class="card-icon serial">
              <i class="fas fa-barcode"></i>
            </div>
            <div class="card-details">
              <div class="card-label">序列号</div>
              <div class="card-primary-text small-text">{{ editForm.serial_number || '未设置' }}</div>
            </div>
          </div>

          <div v-if="canViewPrice" class="info-card">
            <div class="card-icon price">
              <i class="fas fa-yen-sign"></i>
            </div>
            <div class="card-details">
              <div class="card-label">入库价格</div>
              <div class="card-primary-text">
                {{ canViewPrice ? (editForm.purchase_cost ? `¥${Math.round(editForm.purchase_cost)}` : '未定价') : '***' }}
              </div>
            </div>
          </div>
        </div>

        <div class="sales-edit-form-shell">
          <div class="sales-edit-form-grid">
            <div v-if="canViewSaleField('supplier_name')">
              <label class="sales-edit-field-label">供应商</label>
              <el-select v-model="editForm.supplier_id" placeholder="选择供应商" filterable clearable teleported popper-class="sales-edit-dialog-popper" class="full-width" :disabled="!canEditSaleField('supplier_name')">
                <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.name" :value="supplier.id" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('store_name')">
              <label class="sales-edit-field-label">入库店铺</label>
              <el-select v-model="editForm.store_id" placeholder="选择店铺" filterable clearable teleported popper-class="sales-edit-dialog-popper" class="full-width" :disabled="!canEditSaleField('store_name')">
                <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('Inventorytime')">
              <label class="sales-edit-field-label">入库时间</label>
              <el-date-picker v-model="editForm.created_at" type="date" placeholder="选择日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" teleported popper-class="sales-edit-dialog-popper" style="width: 140px" :disabled="!canEditSaleField('Inventorytime')" />
            </div>

            <div v-if="canViewSaleField('condition')">
              <label class="sales-edit-field-label">机况</label>
              <el-select v-model="editForm.condition" placeholder="选择机况" teleported popper-class="sales-edit-dialog-popper" class="full-width" :disabled="!canEditSaleField('condition')">
                <el-option label="全新" value="全新" />
                <el-option label="二手" value="二手" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('brand')">
              <label class="sales-edit-field-label">品牌</label>
              <el-select v-model="editForm.brand" placeholder="选择品牌" filterable clearable teleported popper-class="sales-edit-dialog-popper" @change="onEditBrandChange" class="full-width" :disabled="!canEditSaleField('brand')">
                <el-option v-for="brand in brands" :key="brand.id" :label="brand.name" :value="brand.name" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('model')">
              <label class="sales-edit-field-label">型号</label>
              <el-select v-if="editForm.brand && editBrandModels.length > 0" v-model="editForm.model" placeholder="选择型号" filterable clearable teleported popper-class="sales-edit-dialog-popper" :disabled="!canEditSaleField('model') || (!editForm.brand && editBrandModels.length === 0)" class="full-width">
                <el-option v-for="model in editBrandModels" :key="model" :label="model" :value="model" />
              </el-select>
              <el-input v-else v-model="editForm.model" placeholder="请输入型号" class="full-width" :disabled="!canEditSaleField('model')" />
            </div>

            <div v-if="canViewSaleField('color')">
              <label class="sales-edit-field-label">颜色</label>
              <el-select v-model="editForm.color" placeholder="选择颜色" filterable clearable teleported popper-class="sales-edit-dialog-popper" class="full-width" :disabled="!canEditSaleField('color')">
                <el-option v-for="color in colors" :key="color" :label="color" :value="color" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('memory')">
              <label class="sales-edit-field-label">内存</label>
              <el-select v-model="editForm.memory" placeholder="选择内存" filterable clearable teleported popper-class="sales-edit-dialog-popper" class="full-width" :disabled="!canEditSaleField('memory')">
                <el-option v-for="memory in memories" :key="memory" :label="memory" :value="memory" />
              </el-select>
            </div>

            <div v-if="canViewSaleField('serial_number')">
              <label class="sales-edit-field-label">序列号</label>
              <el-input
                v-model="editForm.serial_number"
                placeholder="请输入序列号（仅字母数字）"
                maxlength="18"
                class="full-width"
                @input="handleSerialNumberInput"
                :disabled="!canEditSaleField('serial_number')"
              />
            </div>

            <div v-if="canViewSaleField('imei')" class="sales-edit-imei-field">
              <label class="sales-edit-field-label">
                IMEI
                <span v-if="editIsNoIMEIMode" class="sales-edit-imei-badge">
                  <i class="fas fa-check-circle"></i> 无IMEI
                </span>
              </label>
              <div @dblclick="toggleEditNoIMEIMode" class="cursor-pointer" :title="editIsNoIMEIMode ? '双击切换回标准模式' : '双击启用无IMEI模式（支持字母+数字）'">
                <el-input
                  v-model="editForm.imei"
                  :placeholder="editIsNoIMEIMode ? '无IMEI模式' : '请输入IMEI'"
                  :maxlength="editIsNoIMEIMode ? 30 : 15"
                  class="full-width"
                  @input="handleImeiInput"
                  :disabled="!canEditSaleField('imei')"
                >
                  <template #suffix v-if="editIsNoIMEIMode">
                    <span class="sales-edit-imei-suffix">
                      <i class="fas fa-check-circle"></i> 无IMEI
                    </span>
                  </template>
                </el-input>
              </div>
              <div v-if="editIsNoIMEIMode" class="sales-edit-imei-hint">
                双击输入框可切换回标准模式
              </div>
            </div>

            <div v-if="canViewPrice" class="sales-edit-price-field">
              <label class="sales-edit-field-label">入库价格</label>
              <el-input-number
                v-model="editForm.purchase_cost"
                placeholder="请输入入库价格"
                :min="0"
                :step="1"
                :precision="0"
                :controls="false"
                class="full-width"
                :value-on-clear="null"
                :disabled="!canEditSaleField('purchase_cost')"
              />
            </div>

            <div v-if="canViewSaleField('remarks')" class="sales-edit-remarks-field">
              <label class="sales-edit-field-label">备注</label>
              <el-input v-model="editForm.remarks" type="textarea" :rows="2" placeholder="请输入备注信息" maxlength="500" show-word-limit class="full-width" :disabled="!canEditSaleField('remarks')" />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="default" @click="closeEditModal">取消</el-button>
          <el-button type="primary" @click="submitEdit" :loading="submitting">
            保存修改
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 批发/划拨对话框 -->
    <WholesaleModal
      v-model:visible="showWholesaleModal"
      :mode="wholesaleMode"
      :phone-ids="selectedPhones.map(p => p.id)"
      :phones="selectedPhones"
      :close-on-click-modal="false"
      @success="handleTransferSuccess"
    />
  </template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePermissionPreload } from '@/composables/usePermissionPreload'
import CustomSearch from '@/components/CustomSearch.vue'
import { useMobile, useMobileForm } from '@/composables/mobile'
import { usePagination } from '@/composables/index'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import GlobalLoading from '@/components/GlobalLoading.vue'
import Pagination from '../../components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { usePermissionModuleInfo } from '@/composables/usePermissionModuleInfo'
import { useRefreshData } from '@/composables/useRefreshData'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import WholesaleModal from '@/components/WholesaleModal.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { ElMessageBox } from 'element-plus'
import { PageHeader } from '@/components/base'
import Image from '@/components/Image.vue'
import PermissionAccessNotice from '@/components/base/PermissionAccessNotice.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import html2canvas from 'html2canvas'
import { storage } from '@/services/storage'
import { isValidMobilePhone, normalizeAppleId, normalizePersonName, normalizePhoneDigits, resolveAppleAccountEmail } from '@/utils/security'

// 导入格式化工具函数
import { formatNumber, generateProductPlaceholder } from '@/utils/format'

// 导入类型定义
import type { Phone, Store, Operator, Supplier, Customer, PhoneBrand, PhoneModel } from '@/types'

interface BatchCustomer extends Customer {
  apple_id?: string
}

interface InventorySummaryItem {
  supplier_id?: number | string
  supplier_name?: string
  store_id?: number | string
  store_name?: string
  brand: string
  model: string
  color: string
  memory: string
  condition: string
  quantity?: number
  earliest_date?: string
  latest_date?: string
}

interface InventoryDetailItem {
  id: number | string
  supplier_name?: string
  store_name?: string
  brand?: string
  model?: string
  color?: string
  memory?: string
  imei?: string
  serial_number?: string
  purchase_cost?: number | string
  Inventorytime?: string
  inventory_days?: number
  is_new?: boolean | number
}

// 使用 stores 和 composables
const router = useRouter()
const route = useRoute()
const { error: showError, warning: showWarning, success: showSuccess, info: showInfo } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  handleNoPermission
} = usePagePermissions('sales')
const { refreshing, refresh } = useRefreshData()
const { exportFile, saveBlobFile, buildDateFilename } = useImportExport()
const authStore = useAuthStore()
const { init: initFieldPermissions } = fieldPermissions
const salesFieldMap: Record<string, string> = {
  stats_available_inventory: 'stats.available_inventory',
  stats_today_sales: 'stats.today_sales',
  stats_inventory_value: 'stats.inventory_value',
  stats_avg_profit_margin: 'stats.avg_profit_margin',
  supplier_id: 'sale.supplier_id',
  supplier_name: 'sale.supplier_id',
  store_id: 'sale.store_id',
  store_name: 'sale.store_id',
  brand: 'sale.brand',
  model: 'sale.model',
  color: 'sale.color',
  memory: 'sale.memory',
  serial_number: 'sale.serial_number',
  imei: 'sale.imei',
  purchase_price: 'sale.purchase_price',
  purchase_cost: 'sale.purchase_cost',
  cost: 'sale.purchase_cost',
  sale_price: 'sale.sale_price',
  sale_date: 'sale.sale_date',
  payment_method: 'sale.payment_method',
  transaction_no: 'sale.transaction_no',
  operator_id: 'sale.operator_id',
  inventory_operator_name: 'sale.operator_id',
  is_new: 'sale.condition',
  condition: 'sale.condition',
  Inventorytime: 'sale.inventory_time',
  created_at: 'sale.inventory_time',
  remarks: 'sale.remarks',
  customer_name: 'sale.customer_name',
  customer_phone: 'sale.customer_phone',
  customer_apple_id: 'sale.customer_apple_id',
  apple_id: 'sale.customer_apple_id',
  actions: 'system_info.operations'
}
const getSalesFieldKey = (fieldName: string) => salesFieldMap[fieldName] || fieldName
const canViewSaleField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('sales_salesview', getSalesFieldKey(fieldName))
}
const canEditSaleField = (fieldName: string) => {
  if (!canViewSaleField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('sales_salesview', getSalesFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewSaleField('stats_available_inventory') ||
  canViewSaleField('stats_today_sales') ||
  (canViewPrice.value && canViewSaleField('stats_inventory_value')) ||
  (canViewPrice.value && canViewSaleField('stats_avg_profit_margin'))
))

const handleSalesPermissionsUpdated = async () => {

  permissionLoading.value = true
  try {
    await preloadPermissions()
    await authStore.fetchUserInfo()
  } catch (refreshError) {
    logger.error('销售页面权限刷新失败:', refreshError)
  } finally {
    permissionLoading.value = false
  }

  if (!canView.value) {
    availablePhones.value = []
    return
  }

  await initFieldPermissions(true)
  loadAvailablePhones(false, true, false)
}

const getTodayDate = () => TimeUtil.nowFormatted(TIME_FORMATS.DATE)

// 创建简化的别名函数
const warning = (message: string) => showWarning(message)
const error = (message: string) => showError(message)
const success = (message: string) => showSuccess(message)
const info = (message: string) => showInfo(message)

// 检查用户是否可以查看成本相关价格字段
const canViewPrice = computed(() => {
  const priceFields = ['purchase_price', 'purchase_cost', 'cost']
  if (priceFields.some(fieldName => !canViewSaleField(fieldName))) {
    return false
  }

  const hasEditPermission = authStore.hasPermission('sales:edit')
  const hasViewPermission = authStore.hasPermission('sales:view')
  const hasQueryPermission = authStore.hasPermission('query:view')
  const hasPermissionAdminAccess = authStore.isAdmin

  return hasEditPermission || hasViewPermission || hasQueryPermission || hasPermissionAdminAccess
})

// 获取用户权限列表用于显示
const userPermissions = computed(() => {
  return Array.isArray(authStore.userPermissions) ? authStore.userPermissions : []
})

const { hasMenuPermissionOnly, modulePermissions: salesPermissions } = usePermissionModuleInfo(
  userPermissions,
  'sales_salesview'
)

// 使用权限预加载Hook
const { isPreloaded, preloadPermissions } = usePermissionPreload()

// 确保权限数据加载完成后再显示权限相关内容
const showPermissionElements = ref(false)

// 权限加载状态
const permissionLoading = ref(false)

// 控制搜索筛选区域的显示
const showSearchSection = ref(true)

// 移动端抽屉状态
const showSearchDrawer = ref(false)

// 移动端高级搜索展开状态
const showAdvancedSearch = ref(false)

const { isMobile, isTablet, isIOS } = useMobile()
const { inputProps, numberInputProps } = useMobileForm()

// 响应式数据
const { loading } = useLoadingState()
const submitting = ref(false)

// 搜索相关状态
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）
const simpleSearchQuery = ref('')
const showDesktopSearch = ref(false)

// 防抖函数，避免快速重复点击
const debounceSubmit = (fn, delay = 500) => {
  let timeoutId = null
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// 全局键盘事件处理，防止提交过程中的Enter键重复提交
const handleGlobalKeydown = (event) => {
  // 如果正在提交，阻止Enter键触发表单提交
  if (submitting.value && event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}
// 根据设备类型设置默认显示模式：桌面端显示列表，移动端显示图文
const viewMode = ref<'grid' | 'table' | 'summary'>('table') // 默认列表模式

const showSaleModal = ref(false)
const selectedPhone = ref<Phone | null>(null)

// 编辑弹窗相关
const showEditModal = ref(false)
const selectedPhoneForEdit = ref<Phone | null>(null)

// 批发/划拨对话框相关
const showWholesaleModal = ref(false)
const wholesaleMode = ref<'wholesale' | 'proxy'>('wholesale')
const operationMode = ref<'wholesale' | 'proxy' | null>(null) // 操作模式

// 客户姓名编辑状态
const customerEditSubmitting = ref(false)
const customerNameEditing = ref(false) // 客户姓名是否正在编辑（单台模式）
const batchCustomerNameEditing = ref(false) // 客户姓名是否正在编辑（批量模式）
const customerCreating = ref(false)
const batchCustomerCreating = ref(false)
const saleCustomerNameInputRef = ref<any>(null)
const batchCustomerNameInputRef = ref<HTMLInputElement | null>(null)
const customerNameLastTapAt = ref(0)
const batchCustomerNameLastTapAt = ref(0)

// 批发/划拨权限检查
const canWholesale = computed(() => {
  return selectedPhones.value.length > 0 &&
    selectedPhones.value.every((p: Phone) => p.status === 'in_stock')
})

const canProxy = computed(() => {
  return selectedPhones.value.length > 0 &&
    selectedPhones.value.every((p: Phone) => p.status === 'in_stock')
})

const canWholesalePermission = computed(() => authStore.hasPermission('sales:wholesale'))
const canProxyTransferPermission = computed(() => authStore.hasPermission('sales:proxy-transfer'))

// 处理调货
const handleWholesale = () => {
  if (!canWholesalePermission.value) {
    handleNoPermission('wholesale')
    return
  }

  // 如果已经在批发模式，则取消
  if (operationMode.value === 'wholesale') {
    operationMode.value = null
  } else {
    // 切换到批发模式，并自动切换到表格视图
    operationMode.value = 'wholesale'
    viewMode.value = 'table' // 自动切换到表格视图
  }
}

// 处理划拨
const handleProxyTransfer = () => {
  if (!canProxyTransferPermission.value) {
    handleNoPermission('proxy-transfer')
    return
  }

  // 如果已经在划拨模式，则取消
  if (operationMode.value === 'proxy') {
    operationMode.value = null
  } else {
    // 切换到划拨模式，并自动切换到表格视图
    operationMode.value = 'proxy'
    viewMode.value = 'table' // 自动切换到表格视图
  }
}

// 打开批发/划拨对话框
const openWholesaleModal = () => {
  wholesaleMode.value = operationMode.value || 'wholesale'

  if (wholesaleMode.value === 'wholesale' && !canWholesalePermission.value) {
    handleNoPermission('wholesale')
    return
  }

  if (wholesaleMode.value === 'proxy' && !canProxyTransferPermission.value) {
    handleNoPermission('proxy-transfer')
    return
  }

  if (wholesaleMode.value === 'wholesale' && !canWholesale.value) {
    showWarning('请先选择可调货的在库手机')
    return
  }

  if (wholesaleMode.value === 'proxy' && !canProxy.value) {
    showWarning('请先选择可划拨的在库手机')
    return
  }

  // 划拨模式：验证供应商一致性
  if (wholesaleMode.value === 'proxy') {
    const suppliers = [...new Set(selectedPhones.value.map(p => p.supplier_id).filter(id => id != null))]

    if (suppliers.length > 1) {
      showError('相同供应商商品才能划拨')
      return
    }

    if (suppliers.length === 0) {
      showError('选中的商品没有供应商信息')
      return
    }
  }

  showWholesaleModal.value = true
}

// 批发/划拨成功回调
const handleTransferSuccess = (data?: { success_count: number; total_count: number; message: string }) => {
  operationMode.value = null
  clearBatchSelection()
  loadAvailablePhones()

  // 如果没有传递数据，显示默认消息
  if (!data) {
    showSuccess('操作成功')
  } else {
    // 显示详细的成功信息
    const { success_count, total_count, message } = data
    if (success_count === total_count) {
      showSuccess(`${message}，共 ${success_count} 台`)
    } else {
      showWarning(`${message} ${success_count}/${total_count} 台`)
    }
  }
}

const editForm = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  serial_number: '',
  imei: '',
  purchase_price: null,
  purchase_cost: null,
  sale_price: null,
  supplier_id: null,
  store_id: null,
  operator_id: '',
  operator_name: '',
  condition: '',
  status: '',
  created_at: null,
  remarks: ''
})

// 编辑模式的无IMEI状态
const editIsNoIMEIMode = ref(false)

// 批量选择相关
const batchMode = ref(false)
const selectedPhones = ref<Phone[]>([])
const handledRouteSalePhoneId = ref<string>('')
const selectAll = ref(false)
const showBatchSaleForm = ref(false)

// 批量销售表单数据
const batchSaleForm = reactive({
  customer_name: '',
  customer_phone: '',
  apple_id: '',
  sale_price: '',
  store_id: '',
  operator_id: '',
  sale_date: getTodayDate(),
  payment_method: '',
  payment_channel: '',
  transaction_no: '',
  remarks: ''
})

// 批量销售客户搜索相关
const batchCustomerSearchResults = ref<BatchCustomer[]>([])
const selectedBatchCustomer = ref<BatchCustomer | null>(null)
const showBatchCustomerSearch = ref(false)
const batchCustomerSearching = ref(false)
const batchCustomerSearchTimeout = ref(null)
const lastBatchSearchPhone = ref('')
const batchCustomerSearchCache = ref(new Map())

// 数据列表
const availablePhones = ref<Phone[]>([])
const stores = ref<Store[]>([])
const operators = ref<Operator[]>([])
const suppliers = ref<Supplier[]>([])
const brands = ref<Array<Pick<PhoneBrand, 'id' | 'name'> & { sort_order?: number }>>([])  // 品牌对象数组，包含 id 和 name
const brandsFull = ref<PhoneBrand[]>([])  // 存储完整的品牌数据（包含ID）
const models = ref<PhoneModel[]>([])  // 型号对象数组，包含 id 和 name
const colors = ref<string[]>([])
const memories = ref<string[]>([])
const brandModels = ref<PhoneModel[]>([])  // 存储当前品牌对应的型号列表（完整对象）

// 品牌名称字符串数组（用于筛选器）
const brandNames = computed(() => brands.value.map(b => b.name))

// 型号名称字符串数组（用于筛选器）
const modelNames = computed(() => brandModels.value.map(m => m.name))

// 库存统计数据
const inventorySummary = ref<InventorySummaryItem[]>([])
const inventorySummaryLoading = ref(false)
const inventoryDetailModal = ref(false)
const inventoryDetailData = ref<InventoryDetailItem[]>([])
const inventoryDetailLoading = ref(false)

// 库存统计表截图引用和状态
const inventorySummaryTableRef = ref<HTMLElement | null>(null)
const savingInventorySummary = ref(false)

// 提取型号系列号（如 iPhone 15 Pro -> 15）
const extractSeriesNumber = (model: string): number => {
  if (!model) return 0
  const match = model.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

// 内存大小排序权重
const getMemoryOrderWeight = (memory: string): number => {
  if (!memory) return 999
  const size = memory.toUpperCase().replace(/[^0-9A-Z]/g, '')

  // 处理 GB 和 TB
  if (size.includes('TB')) {
    const tb = parseInt(size) || 0
    return tb * 1000 // 1TB = 1000 权重
  } else if (size.includes('GB')) {
    const gb = parseInt(size) || 0
    return gb // 128GB = 128 权重
  }

  // 纯数字
  const num = parseInt(size) || 0
  return num
}

// 品牌排序权重（苹果优先，其他品牌按字母顺序）
const getBrandOrderWeight = (brand: string): number => {
  if (!brand) return 999
  // 移除 emoji 和特殊字符，只保留字母和中文
  const brandClean = brand.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').toLowerCase().trim()

  // 苹果品牌优先（包含中文"苹果"或英文 Apple、iPhone、iPad、AirPods 等关键词）
  if (brandClean.includes('苹果') || brandClean.includes('apple') || brandClean.includes('iphone') || brandClean.includes('ipad') || brandClean.includes('airpods')) {
    return 0
  }

  // 其他品牌返回一个大数字，确保在苹果之后
  return 1000
}

// 从品牌名称中提取纯净的品牌名（用于排序）
const extractBrandName = (brand: string): string => {
  if (!brand) return ''
  // 移除 emoji 和特殊字符，只保留字母和中文
  return brand.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').toLowerCase().trim()
}

// 获取品牌的排序键（用于确保不同品牌之间不继续比较）
const getBrandSortKey = (brand: string): string => {
  const weight = getBrandOrderWeight(brand)
  const brandName = extractBrandName(brand)
  // 格式：权重_品牌名，权重确保苹果在前，品牌名用于字母排序
  return `${weight.toString().padStart(4, '0')}_${brandName}`
}

// 排序后的库存数据 - 按品牌、机况、型号系列、内存大小排序
const sortedInventorySummary = computed(() => {
  if (!inventorySummary.value || inventorySummary.value.length === 0) {
    return []
  }

  // 复制数组进行排序
  const sorted = [...inventorySummary.value]

  return sorted.sort((a, b) => {
    const brandA = a.brand || ''
    const brandB = b.brand || ''

    // 1. 优先按品牌分组排序（苹果优先，其他品牌按字母顺序）
    // 使用权重而不是字符串比较，确保排序正确
    const weightA = getBrandOrderWeight(brandA)
    const weightB = getBrandOrderWeight(brandB)

    // 不同权重（品牌组）直接按权重排序
    if (weightA !== weightB) {
      return weightA - weightB
    }

    // 同一权重组内，按品牌名称排序
    const brandNameA = extractBrandName(brandA)
    const brandNameB = extractBrandName(brandB)
    if (brandNameA !== brandNameB) {
      return brandNameA.localeCompare(brandNameB, 'zh-CN')
    }

    // 2. 同一品牌内，按机况排序（全新在前，二手在后）
    if (a.condition !== b.condition) {
      return a.condition === '全新' ? -1 : 1
    }

    // 3. 机况相同，按型号系列号从小到大排序
    const seriesA = extractSeriesNumber(a.model)
    const seriesB = extractSeriesNumber(b.model)
    if (seriesA !== seriesB) {
      return seriesA - seriesB
    }

    // 4. 系列号相同，按型号名称排序
    if (a.model !== b.model) {
      return (a.model || '').localeCompare(b.model || '')
    }

    // 5. 型号相同，按内存从小到大排序
    const memoryWeightA = getMemoryOrderWeight(a.memory)
    const memoryWeightB = getMemoryOrderWeight(b.memory)
    if (memoryWeightA !== memoryWeightB) {
      return memoryWeightA - memoryWeightB
    }

    // 6. 内存相同，按颜色排序
    if (a.color !== b.color) {
      return (a.color || '').localeCompare(b.color || '')
    }

    return 0
  })
})

// 网格视图排序：按入库日期、品牌、系列排序（最新入库的在前，苹果优先）
const sortedForGridView = computed(() => {
  if (!availablePhones.value || availablePhones.value.length === 0) {
    return []
  }

  const sorted = [...availablePhones.value]

  return sorted.sort((a, b) => {
    // 1. 优先按入库日期排序（最新入库的在前面）
    const dateA = new Date((a as any).Inventorytime || a.purchase_date || a.created_at || 0).getTime()
    const dateB = new Date((b as any).Inventorytime || b.purchase_date || b.created_at || 0).getTime()
    if (dateA !== dateB) {
      return dateB - dateA // 降序，最新的在前面
    }

    // 2. 入库日期相同，按品牌排序（苹果优先）
    const brandWeightA = getBrandOrderWeight(a.brand)
    const brandWeightB = getBrandOrderWeight(b.brand)
    if (brandWeightA !== brandWeightB) {
      return brandWeightA - brandWeightB
    }

    // 3. 品牌相同，按机况排序（全新在前，二手在后）
    const conditionA = a.is_new ? '全新' : '二手'
    const conditionB = b.is_new ? '全新' : '二手'
    if (conditionA !== conditionB) {
      return conditionA === '全新' ? -1 : 1
    }

    // 4. 机况相同，按型号系列号从小到大排序
    const seriesA = extractSeriesNumber(a.model)
    const seriesB = extractSeriesNumber(b.model)
    if (seriesA !== seriesB) {
      return seriesA - seriesB
    }

    // 5. 系列号相同，按型号名称排序
    if (a.model !== b.model) {
      return (a.model || '').localeCompare(b.model || '')
    }

    // 6. 型号相同，按内存从小到大排序
    const memoryWeightA = getMemoryOrderWeight(a.memory)
    const memoryWeightB = getMemoryOrderWeight(b.memory)
    if (memoryWeightA !== memoryWeightB) {
      return memoryWeightA - memoryWeightB
    }

    // 7. 内存相同，按颜色排序
    if (a.color !== b.color) {
      return (a.color || '').localeCompare(b.color || '')
    }

    return 0
  })
})

// 排序后的可销售手机列表 - 按入库日期、品牌、系列排序（用于表格模式）
const sortedAvailablePhones = computed(() => {
  if (!availablePhones.value || availablePhones.value.length === 0) {
    return []
  }

  // 复制数组进行排序
  const sorted = [...availablePhones.value]

  return sorted.sort((a, b) => {
    // 1. 优先按入库日期排序（最新入库的在前面）
    const dateA = new Date((a as any).Inventorytime || a.purchase_date || a.created_at || 0).getTime()
    const dateB = new Date((b as any).Inventorytime || b.purchase_date || b.created_at || 0).getTime()
    if (dateA !== dateB) {
      return dateB - dateA // 降序，最新的在前面
    }

    // 2. 入库日期相同，按品牌排序（苹果优先）
    const brandWeightA = getBrandOrderWeight(a.brand)
    const brandWeightB = getBrandOrderWeight(b.brand)
    if (brandWeightA !== brandWeightB) {
      return brandWeightA - brandWeightB
    }

    // 3. 品牌相同，按机况排序（全新在前，二手在后）
    const conditionA = a.is_new ? '全新' : '二手'
    const conditionB = b.is_new ? '全新' : '二手'
    if (conditionA !== conditionB) {
      return conditionA === '全新' ? -1 : 1
    }

    // 4. 机况相同，按型号系列号从小到大排序
    const seriesA = extractSeriesNumber(a.model)
    const seriesB = extractSeriesNumber(b.model)
    if (seriesA !== seriesB) {
      return seriesA - seriesB
    }

    // 5. 系列号相同，按型号名称排序
    if (a.model !== b.model) {
      return (a.model || '').localeCompare(b.model || '')
    }

    // 6. 型号相同，按内存从小到大排序
    const memoryWeightA = getMemoryOrderWeight(a.memory)
    const memoryWeightB = getMemoryOrderWeight(b.memory)
    if (memoryWeightA !== memoryWeightB) {
      return memoryWeightA - memoryWeightB
    }

    // 7. 内存相同，按颜色排序
    if (a.color !== b.color) {
      return (a.color || '').localeCompare(b.color || '')
    }

    return 0
  })
})

// 获取最长在库天数的设备（用于高亮显示）
const longestInventoryDevice = computed(() => {
  if (inventoryDetailData.value.length === 0) return null
  // 第一个就是按在库天数排序后最长的
  return inventoryDetailData.value[0]
})

// 统计数据
const todaySold = ref(0)
const newInventoryValue = ref('0') // 全新库存金额
const usedInventoryValue = ref('0') // 二手库存金额
const exportingAvailablePhones = ref(false)

// 筛选条件
const filters = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  store_id: '',
  supplier_id: '',
  operator_id: '',
  is_new: '',
  date_range: '',
  date_start: '',
  date_end: '',
  search: ''
})

const showSalesSearchKeyword = computed(() => {
  return ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'customer_name', 'customer_phone'].some(fieldName => canViewSaleField(fieldName))
})

const salesTableVisibleColumnCount = computed(() => {
  return [
    batchMode.value || operationMode.value,
    canViewSaleField('supplier_name'),
    canViewSaleField('store_name'),
    canViewSaleField('brand'),
    canViewSaleField('model'),
    canViewSaleField('color'),
    canViewSaleField('memory'),
    canViewSaleField('serial_number'),
    canViewSaleField('imei'),
    canViewPrice.value,
    canViewSaleField('inventory_operator_name'),
    canViewSaleField('condition'),
    canViewSaleField('Inventorytime'),
    !batchMode.value && !operationMode.value && canViewSaleField('actions')
  ].filter(Boolean).length || 1
})

// GlobalSearch 筛选配置
const searchFilters = computed(() => [
  {
    key: 'brand',
    label: '品牌',
    type: 'editable-select',
    placeholder: '请输入或选择品牌',
    editableOptions: () => brandNames.value,
    showOptions: true, // 默认显示选项
    highlightedIndex: -1,
    onOptionsChange: async (filter, value) => {
      // 品牌变化时，获取对应的型号列表
      await fetchBrandModels(value)
    }
  },
  {
    key: 'model',
    label: '型号',
    type: 'editable-select',
    placeholder: filters.brand ? '请输入或选择型号' : '请先选择品牌',
    editableOptions: () => modelNames.value,
    showOptions: true, // 默认显示选项
    highlightedIndex: -1,
    disabled: !filters.brand // 没有选择品牌时禁用
  },
  {
    key: 'color',
    label: '颜色',
    type: 'editable-select',
    placeholder: '请输入或选择颜色',
    editableOptions: () => colors.value,
    showOptions: true, // 默认显示选项
    highlightedIndex: -1
  },
  {
    key: 'memory',
    label: '内存',
    type: 'editable-select',
    placeholder: '请输入或选择内存',
    editableOptions: () => memories.value,
    showOptions: true, // 默认显示选项
    highlightedIndex: -1
  },
  {
    key: 'supplier_id',
    label: '供应商',
    type: 'select',
    placeholder: '选择供应商',
    options: suppliers.value.map(supplier => ({
      label: supplier.name,
      value: supplier.id
    }))
  },
  {
    key: 'store_id',
    label: '店铺',
    type: 'select',
    placeholder: '选择店铺',
    options: stores.value.map(store => ({
      label: store.name,
      value: store.id
    }))
  },
  {
    key: 'operator_id',
    label: '入库员',
    type: 'select',
    placeholder: '选择入库员',
    options: operators.value.map(operator => ({
      label: operator.name || operator.username,
      value: operator.id
    }))
  },
  {
    key: 'is_new',
    label: '成色',
    type: 'select',
    placeholder: '选择成色',
    options: [
      { label: '全新', value: true },
      { label: '二手', value: false }
    ]
  },
  {
    key: 'date_range',
    label: '入库日期',
    type: 'daterange',
    placeholder: '选择日期范围'
  }
])

// 分页信息
const {
  page,
  limit,
  total,
  setTotal,
  setLimit,
  goToPage
} = usePagination({ limit: 100 })

// 创建 reactive 分页对象供模板使用（自动解包 ref）
const pagination = reactive({ page, limit, total, setTotal, setLimit, goToPage })

// 销售表单
const saleForm = reactive({
  customer_name: '',
  customer_phone: '',
  customer_apple_id: '',
  sale_price: '',
  purchase_cost: '', // 可编辑的入库价格
  store_id: '',
  operator_id: '',
  sale_date: getTodayDate(),
  payment_method: '',
  payment_channel: '',
  transaction_no: '',
  remarks: ''
})

// 客户搜索相关数据
const customerSearchResults = ref([])
const selectedCustomer = ref(null)
const showCustomerSearch = ref(false)
const customerSearching = ref(false)
const customerSearchTimeout = ref(null)
const customerSearchCache = ref(new Map())

const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

const handleCustomerNameInput = (valueOrEvent) => {
  const rawValue = typeof valueOrEvent === 'string'
    ? valueOrEvent
    : valueOrEvent?.target?.value || ''

  saleForm.customer_name = normalizePersonName(rawValue, 20)
}

const handleCustomerAppleIdInput = (valueOrEvent) => {
  const rawValue = typeof valueOrEvent === 'string'
    ? valueOrEvent
    : valueOrEvent?.target?.value || ''

  saleForm.customer_apple_id = normalizeAppleId(rawValue)
}

const handleBatchCustomerNameInput = (valueOrEvent) => {
  const rawValue = typeof valueOrEvent === 'string'
    ? valueOrEvent
    : valueOrEvent?.target?.value || ''

  batchSaleForm.customer_name = normalizePersonName(rawValue, 20)
}

const handleBatchCustomerAppleIdInput = (valueOrEvent) => {
  const rawValue = typeof valueOrEvent === 'string'
    ? valueOrEvent
    : valueOrEvent?.target?.value || ''

  batchSaleForm.apple_id = normalizeAppleId(rawValue)
}

// 当前预定信息（从预定页面跳转过来时使用）
const currentPreorderInfo = ref<{ preorder_id: string; advance_payment: number } | null>(null)

// 计算属性
const profit = computed(() => {
  if (!selectedPhone.value || !saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) return null
  // 使用表单中的入库价格（可编辑），如果没有则使用原价
  const cost = parseFloat(String(saleForm.purchase_cost || selectedPhone.value.purchase_cost || 0))
  return (parseFloat(saleForm.sale_price) - cost).toFixed(2)
})

// 检查是否是当前登录用户
const isCurrentUser = (operator) => {
  const currentUser = authStore.user
  if (!currentUser || !operator) return false
  return operator.username === currentUser.username || operator.name === currentUser.name
}

// 批量销售计算函数
const getTotalCost = () => {
  return selectedPhones.value.reduce((sum, phone) => {
    return sum + parseFloat(String(phone.purchase_cost || 0))
  }, 0);
};

const getTotalProfit = computed(() => {
  // 批量销售时使用 batchSaleForm.sale_price，单个销售时使用 saleForm.sale_price
  const price = batchSaleForm.sale_price || saleForm.sale_price;
  if (!price) return 0;
  const totalCost = getTotalCost();
  const totalRevenue = parseFloat(price) * selectedPhones.value.length;
  return (totalRevenue - totalCost).toFixed(2);
})

const profitMargin = computed(() => {
  if (!selectedPhone.value || !saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) return '0.0';
  // 使用表单中的入库价格（可编辑）
  const cost = parseFloat(String(saleForm.purchase_cost || selectedPhone.value.purchase_cost || 0));
  if (cost === 0) return '0.0';
  return ((parseFloat(saleForm.sale_price) - cost) / cost * 100).toFixed(1);
})

const profitClass = computed(() => {
  const profitValue = parseFloat(profit.value || '0');
  if (profitValue > 0) return 'positive';
  if (profitValue < 0) return 'negative';
  return 'zero';
})

// 判断是否有活跃的筛选条件
const hasActiveFilters = computed(() => {
  return !!(
    (showSalesSearchKeyword.value && filters.search) ||
    (canViewSaleField('brand') && filters.brand) ||
    (canViewSaleField('model') && filters.model) ||
    (canViewSaleField('color') && filters.color) ||
    (canViewSaleField('memory') && filters.memory) ||
    (canViewSaleField('supplier_name') && filters.supplier_id) ||
    (canViewSaleField('store_name') && filters.store_id) ||
    (canViewSaleField('inventory_operator_name') && filters.operator_id) ||
    (canViewSaleField('condition') && filters.is_new !== '') ||
    (canViewSaleField('Inventorytime') && filters.date_range)
  )
})

// 防抖定时器
let debounceTimer: NodeJS.Timeout;
let inventorySummaryDebounceTimer: NodeJS.Timeout | null = null;
let salesBaseDataWarmupTimer: ReturnType<typeof setTimeout> | null = null;

const debounceLoadPhones = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    loadAvailablePhones();
  }, 500);
};

// 防抖加载库存统计数据
const debounceLoadInventorySummary = () => {
  if (inventorySummaryDebounceTimer) {
    clearTimeout(inventorySummaryDebounceTimer)
  }
  inventorySummaryDebounceTimer = setTimeout(() => {
    if (viewMode.value === 'summary') {
      loadInventorySummary()
    }
  }, 300)
}

// 获取全新/二手标签
const getNewConditionLabel = (isNew: boolean) => {
  return isNew ? '全新' : '二手';
};

// 销售状态（综合判断）
const getSaleStatusClass = (phone: any) => {
  if (phone.is_preordered) return 'reserved'
  if (phone.status === 'repair') return 'repair'
  if (phone.status === 'sold') return 'sold'
  if (phone.status === 'reserved') return 'reserved'
  if (phone.status === 'lost') return 'lost'
  return 'in-stock' // 可售
}

const getSaleStatusLabel = (phone: any) => {
  if (phone.is_preordered) return '已预订'
  if (phone.status === 'repair') return '维修中'
  if (phone.status === 'sold') return '已售'
  if (phone.status === 'reserved') return '预留'
  if (phone.status === 'lost') return '丢失'
  return '可售'
}

// 获取活动筛选条件数量
const getActiveFiltersCount = () => {
  let count = 0
  if (showSalesSearchKeyword.value && filters.search) count++
  if (canViewSaleField('brand') && filters.brand) count++
  if (canViewSaleField('model') && filters.model) count++
  if (canViewSaleField('color') && filters.color) count++
  if (canViewSaleField('memory') && filters.memory) count++
  if (canViewSaleField('supplier_name') && filters.supplier_id) count++
  if (canViewSaleField('store_name') && filters.store_id) count++
  if (canViewSaleField('inventory_operator_name') && filters.operator_id) count++
  if (canViewSaleField('condition') && filters.is_new !== '') count++
  if (canViewSaleField('Inventorytime') && filters.date_range) count++
  return count
}

// 搜索并关闭抽屉
const handleSearchAndClose = () => {
  handleGlobalSearch(filters.search, filters)
  // 保存筛选条件到 localStorage
  saveFiltersToStorage()
  showSearchDrawer.value = false
}

// 重置并关闭抽屉
const handleResetAndClose = () => {
  resetFilters()
  clearFiltersStorage()
  showSearchDrawer.value = false
}

// 手势滑动相关
let touchStartY = 0
let touchStartX = 0
let isDragging = false

const handleTouchStart = (e: TouchEvent) => {
  touchStartY = e.touches[0].clientY
  touchStartX = e.touches[0].clientX
  isDragging = true
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging) return

  const touchY = e.touches[0].clientY
  const touchX = e.touches[0].clientX
  const deltaY = touchY - touchStartY
  const deltaX = touchX - touchStartX

  // 向右滑动超过50px时关闭抽屉
  if (deltaX > 50 && Math.abs(deltaY) < Math.abs(deltaX)) {
    e.preventDefault()
    const drawerWrapper = document.body.querySelector('.drawer-wrapper') as HTMLElement | null
    if (drawerWrapper) {
      drawerWrapper.style.transform = `translateX(${Math.min(deltaX, 150)}px)`
    }
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (!isDragging) return

  const touchY = e.changedTouches[0].clientY
  const touchX = e.changedTouches[0].clientX
  const deltaY = touchY - touchStartY
  const deltaX = touchX - touchStartX

  const drawerWrapper = document.body.querySelector('.drawer-wrapper') as HTMLElement | null
  if (drawerWrapper) {
    drawerWrapper.style.transform = ''
    drawerWrapper.style.transition = 'transform 0.3s'

    // 向右滑动超过100px时关闭抽屉
    if (deltaX > 100 && Math.abs(deltaY) < Math.abs(deltaX)) {
      showSearchDrawer.value = false
    }

    setTimeout(() => {
      drawerWrapper.style.transition = ''
    }, 300)
  }

  isDragging = false
}

// 防抖搜索
let searchTimer: NodeJS.Timeout | null = null
const debouncedSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    handleGlobalSearch(filters.search, filters)
  }, 500)
}

// localStorage 相关
const STORAGE_KEY = 'sales_search_filters'

// 保存筛选条件到 localStorage
const saveFiltersToStorage = () => {
  try {
    const userId = authStore.user?.id || 'anonymous'
    const key = `${STORAGE_KEY}_${userId}`
    const data = {
      brand: canViewSaleField('brand') ? filters.brand : '',
      model: canViewSaleField('model') ? filters.model : '',
      color: canViewSaleField('color') ? filters.color : '',
      memory: canViewSaleField('memory') ? filters.memory : '',
      is_new: canViewSaleField('condition') ? filters.is_new : '',
      supplier_id: canViewSaleField('supplier_name') ? filters.supplier_id : '',
      store_id: canViewSaleField('store_name') ? filters.store_id : '',
      operator_id: canViewSaleField('inventory_operator_name') ? filters.operator_id : '',
      saved_at: TimeUtil.now().toISOString()
    }
    storage.set(key, data, 'local')
  } catch (error) {
    logger.error('保存筛选条件失败:', error)
  }
}

// 从 localStorage 加载筛选条件
const loadFiltersFromStorage = () => {
  try {
    const userId = authStore.user?.id || 'anonymous'
    const key = `${STORAGE_KEY}_${userId}`
    const data = storage.get<any>(key, 'local')

    if (data) {
      // 只加载7天内的数据
      const savedAt = new Date(data.saved_at)
      const now = TimeUtil.now().toDate()
      const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff <= 7) {
        filters.brand = canViewSaleField('brand') ? (data.brand || '') : ''
        filters.model = canViewSaleField('model') ? (data.model || '') : ''
        filters.color = canViewSaleField('color') ? (data.color || '') : ''
        filters.memory = canViewSaleField('memory') ? (data.memory || '') : ''
        filters.is_new = canViewSaleField('condition') ? (data.is_new !== undefined ? data.is_new : '') : ''
        filters.supplier_id = canViewSaleField('supplier_name') ? (data.supplier_id || '') : ''
        filters.store_id = canViewSaleField('store_name') ? (data.store_id || '') : ''
        filters.operator_id = canViewSaleField('inventory_operator_name') ? (data.operator_id || '') : ''
      }
    }
  } catch (error) {
    logger.error('加载筛选条件失败:', error)
  }
}

// 清除 localStorage 中的筛选条件
const clearFiltersStorage = () => {
  try {
    const userId = authStore.user?.id || 'anonymous'
    const key = `${STORAGE_KEY}_${userId}`
    storage.remove(key, 'local')
  } catch (error) {
    logger.error('清除筛选条件失败:', error)
  }
}

// 防抖加载可销售手机列表（用于搜索输入框）
let loadPhonesDebounceTimer: any = null
const debounceLoadAvailablePhones = () => {
  if (loadPhonesDebounceTimer) {
    clearTimeout(loadPhonesDebounceTimer)
  }
  loadPhonesDebounceTimer = setTimeout(() => {
    loadAvailablePhones(false, true, false)
  }, 500) // 500ms 防抖延迟
}

// 加载统计数据（今日出库、平均利润率等）
const loadSalesStats = async () => {
  try {
    // 构建查询参数（与筛选条件一致）
    const params: any = {}
    if (canViewSaleField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
    if (canViewSaleField('store_name') && filters.store_id) params.store_id = filters.store_id
    if (canViewSaleField('brand') && filters.brand) params.brand = filters.brand
    if (canViewSaleField('model') && filters.model) params.model = filters.model
    if (canViewSaleField('color') && filters.color) params.color = filters.color
    if (canViewSaleField('memory') && filters.memory) params.memory = filters.memory

    const response = await api.get('/sales/phones/available/stats', { params })
    if (response.success && response.data) {
      todaySold.value = response.data.today_sold || 0
    }
  } catch (error) {
    logger.error('加载统计数据失败:', error)
    // 失败时保持默认值
    todaySold.value = 0
  }
}

// 加载库存统计数据
const loadInventorySummary = async () => {
  inventorySummaryLoading.value = true
  try {
    // 构建查询参数（与筛选条件一致）
    const params: any = {}
    if (canViewSaleField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
    if (canViewSaleField('store_name') && filters.store_id) params.store_id = filters.store_id
    if (canViewSaleField('brand') && filters.brand) params.brand = filters.brand
    // 将搜索关键词作为型号筛选参数传递
    if (showSalesSearchKeyword.value && filters.search) params.model = filters.search
    if (canViewSaleField('model') && filters.model) params.model = filters.model
    if (canViewSaleField('color') && filters.color) params.color = filters.color
    if (canViewSaleField('memory') && filters.memory) params.memory = filters.memory
    if (canViewSaleField('condition') && filters.is_new !== '') params.is_new = filters.is_new
    if (canViewSaleField('Inventorytime') && filters.date_start) params.date_start = filters.date_start
    if (canViewSaleField('Inventorytime') && filters.date_end) params.date_end = filters.date_end

    const response = await api.get('/sales/inventory-summary', { params })
    if (response.success && response.data) {
      inventorySummary.value = response.data
    } else {
      inventorySummary.value = []
    }
  } catch (error) {
    logger.error('加载库存统计失败:', error)
    showError('加载库存统计失败')
    inventorySummary.value = []
  } finally {
    inventorySummaryLoading.value = false
  }
}

// 计算在库天数
const getInventoryDays = (dateStr: string) => {
  if (!dateStr) return 0
  const inventoryDate = TimeUtil.parse(dateStr)
  const today = TimeUtil.now()
  const diffDays = TimeUtil.diff(inventoryDate, today, 'day')
  return diffDays > 0 ? diffDays : 0
}

// 格式化入库时间为北京时间（年-月-日）
const formatInventoryDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return TimeUtil.format(dateStr, TIME_FORMATS.DATE)
}

// 格式化价格，移除小数点后的 .00
const formatPrice = (price: number | string) => {
  if (!price && price !== 0) return '-'
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  // 如果是整数，直接返回整数部分
  if (Number.isInteger(numPrice)) {
    return numPrice.toString()
  }
  // 如果小数部分为0，返回整数部分
  if (numPrice % 1 === 0) {
    return Math.floor(numPrice).toString()
  }
  // 否则保留两位小数
  return numPrice.toFixed(2)
}

// 获取在库天数对应的颜色类
const getInventoryDaysClass = (days: number) => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

// 获取在库天数对应的文本
const getInventoryDaysText = (days: number) => {
  return `${days}天`
}

// 获取最长在库卡片样式类
const getLongestInventoryClass = (days: number) => {
  if (days <= 15) return 'days-green'
  if (days <= 30) return 'days-yellow'
  return 'days-red'
}

// 获取内存徽章样式类
const getMemoryBadgeClass = (memory: string) => {
  if (!memory) return ''

  // 根据内存大小返回不同颜色
  const memValue = parseInt(memory)
  if (isNaN(memValue)) return 'memory-other'

  if (memValue >= 1000) return 'memory-1tb'      // 1TB+
  if (memValue >= 512) return 'memory-512gb'    // 512GB
  if (memValue >= 256) return 'memory-256gb'    // 256GB
  if (memValue >= 128) return 'memory-128gb'    // 128GB
  if (memValue >= 64) return 'memory-64gb'      // 64GB
  return 'memory-small'                         // 32GB及以下
}

// 双击库存表行查看明细（优化版 - 使用专用 API）
const showInventoryDetail = async (item: InventorySummaryItem) => {

  // 验证必需字段（brand 必需，其他可以为空）
  const requiredFields = ['brand']
  const missingFields = requiredFields.filter(field => !item[field])

  if (missingFields.length > 0) {
    logger.error('❌ 缺少必需字段:', missingFields)
    logger.error('❌ 完整的 item 数据:', JSON.stringify(item, null, 2))
    showError(`数据不完整，缺少字段: ${missingFields.join(', ')}`)
    return
  }

  // 检查关键字段，如果为空给出提示
  if (!item.model || !item.color || !item.condition) {
    // 不返回，继续查询
  }

  inventoryDetailModal.value = true
  inventoryDetailLoading.value = true
  inventoryDetailData.value = []

  try {
    // 使用优化的库存明细 API
    // 后端直接使用精确匹配并排序，避免 LIKE 查询
    const params: Record<string, string | number> = {
      supplier_id: item.supplier_id,
      store_id: item.store_id,
      brand: item.brand,
      model: item.model || '',      // 如果 model 为空，传递空字符串
      color: item.color || '',      // 如果 color 为空，传递空字符串
      memory: item.memory || '',    // 如果 memory 为空，传递空字符串
      condition: item.condition || '', // 如果 condition 为空，传递空字符串
      limit: 500
    }


    // 使用新的优化 API
    const response = await api.get('/sales/inventory-detail', { params })
    if (response.success && response.data) {
      // 后端已按 inventory_days 排序，直接使用
      inventoryDetailData.value = response.data
    }
  } catch (error) {
    logger.error('加载库存明细失败:', error)
    showError('加载库存明细失败')
  } finally {
    inventoryDetailLoading.value = false
  }
}

// 关闭库存明细弹窗
const closeInventoryDetailModal = () => {
  inventoryDetailModal.value = false
  inventoryDetailData.value = []
}

const buildAvailablePhoneParams = (includePagination = true) => {
  const params: Record<string, any> = {}

  if (includePagination) {
    params.page = pagination.page || 1
    params.limit = pagination.limit || 100
  }

  const routePhoneId = String(route.query.sale_phone_id || '').trim()
  if (routePhoneId) {
    params.phone_id = routePhoneId
  }

  if (canViewSaleField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
  if (canViewSaleField('brand') && filters.brand) params.brand = filters.brand
  if (canViewSaleField('model') && filters.model) params.model = filters.model
  if (canViewSaleField('color') && filters.color) params.color = filters.color
  if (canViewSaleField('memory') && filters.memory) params.memory = filters.memory
  if (canViewSaleField('store_name') && filters.store_id) params.store_id = filters.store_id
  if (canViewSaleField('inventory_operator_name') && filters.operator_id) params.operator_id = filters.operator_id
  if (canViewSaleField('condition') && filters.is_new !== '') params.is_new = filters.is_new
  if (canViewSaleField('Inventorytime') && filters.date_start) params.date_start = filters.date_start
  if (canViewSaleField('Inventorytime') && filters.date_end) params.date_end = filters.date_end
  if (showSalesSearchKeyword.value && filters.search) params.search = filters.search

  return params
}

const exportAvailablePhones = async () => {
  await exportFile({
    url: '/sales/phones/available/export',
    filename: buildDateFilename('销售管理', 'xlsx'),
    params: buildAvailablePhoneParams(false),
    allowed: canExport,
    loading: exportingAvailablePhones,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '销售数据导出成功'
  })
}

// 保存库存统计表为图片
const saveInventorySummaryAsImage = async () => {
  if (!canExport.value) {
    handleNoPermission('export')
    return
  }

  if (!inventorySummaryTableRef.value) {
    showError('库存统计表未加载')
    return
  }

  if (sortedInventorySummary.value.length === 0) {
    showError('暂无库存数据可保存')
    return
  }

  try {
    savingInventorySummary.value = true

    // 等待DOM更新完成
    await nextTick()

    const element = inventorySummaryTableRef.value
    if (!element) {
      showError('无法找到库存统计表元素')
      return
    }

    // 保存原始样式
    const originalWidth = element.style.width
    const originalTableLayout = (element as HTMLTableElement).style.tableLayout
    const originalBorderSpacing = (element as HTMLTableElement).style.borderSpacing

    // 保存所有单元格的原始样式
    const cells = element.querySelectorAll('td, th')
    const originalCells: Array<{
      element: HTMLElement
      padding: string
      fontSize: string
      height: string
      lineHeight: string
    }> = []

    cells.forEach(cell => {
      const htmlCell = cell as HTMLElement
      originalCells.push({
        element: htmlCell,
        padding: htmlCell.style.padding,
        fontSize: htmlCell.style.fontSize,
        height: htmlCell.style.height,
        lineHeight: htmlCell.style.lineHeight
      })
    })

    // 保存行样式
    const rows = element.querySelectorAll('tr')
    const originalRows: Array<{
      element: HTMLElement
      height: string
      display: string
    }> = []

    rows.forEach(row => {
      const htmlRow = row as HTMLElement
      originalRows.push({
        element: htmlRow,
        height: htmlRow.style.height,
        display: htmlRow.style.display
      })
    })

    // 临时设置表格宽度为2000px，并使用紧凑样式
    element.style.width = '2000px'
    ;(element as HTMLTableElement).style.tableLayout = 'fixed'
    ;(element as HTMLTableElement).style.borderSpacing = '0'

    // 设置紧凑的单元格样式
    cells.forEach(cell => {
      const htmlCell = cell as HTMLElement
      htmlCell.style.padding = '8px 12px'
      htmlCell.style.fontSize = '18px'
      htmlCell.style.height = '40px'
      htmlCell.style.lineHeight = '1.4'
    })

    // 设置行样式
    rows.forEach(row => {
      const htmlRow = row as HTMLElement
      htmlRow.style.height = '40px'
      htmlRow.style.display = 'table-row'
    })

    // 等待布局更新
    await nextTick()

    // 生成高清图片（使用scale: 2提高清晰度）
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true
    })

    // 缩放到目标尺寸（2000px宽度）
    const targetWidth = 2000
    const scaleRatio = targetWidth / canvas.width
    const newHeight = Math.round(canvas.height * scaleRatio)

    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = targetWidth
    resizedCanvas.height = newHeight
    const ctx = resizedCanvas.getContext('2d')

    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetWidth, newHeight)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(canvas, 0, 0, targetWidth, newHeight)
    }

    // 恢复原始样式
    element.style.width = originalWidth
    ;(element as HTMLTableElement).style.tableLayout = originalTableLayout
    ;(element as HTMLTableElement).style.borderSpacing = originalBorderSpacing

    originalCells.forEach(item => {
      item.element.style.padding = item.padding
      item.element.style.fontSize = item.fontSize
      item.element.style.height = item.height
      item.element.style.lineHeight = item.lineHeight
    })

    originalRows.forEach(item => {
      item.element.style.height = item.height
      item.element.style.display = item.display
    })

    // 转换为图片并下载
    const finalCanvas = resizedCanvas || canvas
    finalCanvas.toBlob((blob) => {
      if (!blob) {
        showError('生成图片失败')
        return
      }

      // 生成文件名（包含时间戳）
      const filename = buildDateFilename('库存对库', 'png', 'YYYYMMDD')
      saveBlobFile(blob, { filename, mimeType: 'image/png' })

      success(`库存统计表已保存为图片 (${finalCanvas.width}x${finalCanvas.height})`)
    }, 'image/png')

  } catch (err) {
    logger.error('保存库存统计表失败:', err)
    showError('保存库存统计表失败')
  } finally {
    savingInventorySummary.value = false
  }
}

// 加载可销售手机列表
const loadAvailablePhones = async (bustCache = false, silentError = false, showLoadingState = true) => {

  // 权限检查：验证用户是否有查看销售页面的权限
  if (!canView.value) {
    if (!silentError) {
      showError('您没有查看销售页面的权限，请联系管理员分配相关权限')
    }
    return
  }

  if (showLoadingState) {
    loading.value = true;
  }
  try {
    const params: any = buildAvailablePhoneParams(true)

    const response = await api.get('/sales/phones/available', { params });

    if (response.success) {
      const responseData = extractResponseData<any>(response)
      let records = Array.isArray(responseData) ? responseData : (responseData.records || [])

      availablePhones.value = records;
      setTotal(Number(response.pagination?.total) || records.length || 0);

      // 从后端获取全新和二手库存金额统计
      const stats = (response as any)?.stats || {}
      const newValue = parseFloat(String(stats.new_value || 0))
      const usedValue = parseFloat(String(stats.used_value || 0))

      newInventoryValue.value = String(Math.round(newValue))
      usedInventoryValue.value = String(Math.round(usedValue))

      // 统计数据不阻塞主列表渲染
      void loadSalesStats()

      // 处理从预定页面跳转过来的交付请求（通过IMEI查找设备）
      const routeImei = String(route.query.imei || '').trim()
      const routePreorderId = String(route.query.preorder_id || '').trim()
      if (routeImei && routePreorderId && handledRouteSalePhoneId.value !== routeImei) {
        const matchedPhone = records.find((phone: Phone) => String(phone.imei) === routeImei)
        if (matchedPhone) {
          handledRouteSalePhoneId.value = routeImei
          await nextTick()
          // 打开销售模态框并预填预定信息
          openSaleModalWithPreorder(matchedPhone, {
            preorder_id: routePreorderId,
            customer_id: String(route.query.customer_id || ''),
            customer_name: String(route.query.customer_name || ''),
            customer_phone: String(route.query.customer_phone || ''),
            expected_price: String(route.query.expected_price || ''),
            advance_payment: String(route.query.advance_payment || '')
          })
          // 清理URL参数
          const nextQuery = { ...route.query }
          delete nextQuery.imei
          delete nextQuery.preorder_id
          delete nextQuery.customer_id
          delete nextQuery.customer_name
          delete nextQuery.customer_phone
          delete nextQuery.expected_price
          delete nextQuery.advance_payment
          router.replace({ path: route.path, query: nextQuery })
        }
      }
      // 处理原有的通过phone_id打开销售的方式
      else {
        const autoOpenSale = String(route.query.auto_open_sale || '') === '1'
        const routePhoneId = String(route.query.sale_phone_id || '').trim()
        if (autoOpenSale && routePhoneId && handledRouteSalePhoneId.value !== routePhoneId) {
          const matchedPhone = records.find((phone: Phone) => String(phone.id) === routePhoneId)
          if (matchedPhone) {
            handledRouteSalePhoneId.value = routePhoneId
            await nextTick()
            openSaleModal(matchedPhone)
            const nextQuery = { ...route.query }
            delete nextQuery.sale_phone_id
            delete nextQuery.auto_open_sale
            router.replace({ path: route.path, query: nextQuery })
          }
        }
      }
    } else {
      showError(response.message || '加载数据失败')
      availablePhones.value = []
      setTotal(0)
    }
  } catch (error) {
    logger.error('加载手机列表失败:', error)
    if (!silentError) {
      showError('加载数据失败')
    }
    availablePhones.value = []
    setTotal(0)
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 缓存键
const CACHE_KEYS = {
  stores: '/stores:all',
  suppliers: '/suppliers:all',
  brands: '/brands:all',
  models: '/models:all',
  colors: '/colors:all',
  memories: '/memories:all',
  operators: '/operators:all'
}

// 加载基础数据
const loadStores = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.stores, () =>
      api.get('/stores?all=true'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success) {
      stores.value = response.data
    }
  } catch (error) {
    logger.error('加载门店列表失败:', error)
    stores.value = [{ id: 1, name: '总店', code: 'MAIN', status: 1 }]
  }
}

const loadOperators = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.operators, () =>
      api.get('/operators'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      operators.value = response.data

      // 获取当前登录用户信息
      const currentUser = authStore.user
      let defaultOperatorId = null

      if (currentUser && operators.value.length > 0) {
        // 优先匹配用户名（如3333）
        let matchedOperator = operators.value.find(op =>
          op.username === currentUser.username ||
          op.name === currentUser.name
        )

        // 如果没有匹配到，使用第一个操作员
        if (!matchedOperator) {
          matchedOperator = operators.value[0]
        }

        defaultOperatorId = matchedOperator.id
      }

      // 设置默认选中当前用户
      if (defaultOperatorId) {
        saleForm.operator_id = defaultOperatorId
      } else if (operators.value.length > 0) {
        saleForm.operator_id = String(operators.value[0].id)
      }
    }
  } catch (error) {
    logger.error('加载操作员列表失败:', error)
    operators.value = []
  }
}

// 加载品牌数据（从数据库 brands 表获取所有品牌）
const loadBrands = async () => {
  try {
    const brandsResponse = await useCachedRequest(CACHE_KEYS.brands, () =>
      api.get('/brands'), DEFAULT_CACHE_TTL.STATIC)
    if (brandsResponse.success && brandsResponse.data) {
      // 品牌API返回的数据在 data 字段中
      const brandList = extractResponseData<any[]>(brandsResponse)

      brandsFull.value = brandList || []
      // 存储完整的品牌对象（包含 id 和 name）
      brands.value = brandList
        .filter(item => item && item.name)
        .map(item => ({
          id: item.id,
          name: item.name,
          sort_order: item.sort_order || 0
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order)  // 按 sort_order 排序
    }
  } catch (error) {
    logger.error('❌ 加载品牌数据失败:', error)
    brands.value = []
    brandsFull.value = []
  }
}

// 加载型号数据（从数据库 models 表获取所有型号）
const loadModels = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.models, () =>
      api.get('/models'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      // 型号API返回的数据在 models 字段中
      const modelList = Array.isArray(response.data.models)
        ? response.data.models
        : (Array.isArray(response.data) ? response.data : [])
      models.value = modelList
        .filter(item => item && item.name)
        .map(item => ({
          id: item.id,
          name: item.name,
          sort_order: item.sort_order || 0
        }))
        .sort((a: any, b: any) => a.sort_order - b.sort_order)  // 按 sort_order 排序
    }
  } catch (error) {
    logger.error('❌ 加载型号数据失败:', error)
    models.value = []
  }
}

// 加载颜色数据（从数据库 colors 表获取所有颜色）
const loadColors = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.colors, () =>
      api.get('/colors'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      const colorList = Array.isArray(response.data) ? response.data : response.data.colors || []
      colors.value = colorList
        .filter(item => item && item.name)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))  // 按 sort_order 排序
        .map(item => item.name)
    }
  } catch (error) {
    logger.error('❌ 加载颜色数据失败:', error)
    colors.value = []
  }
}

// 加载内存数据（从数据库 memories 表获取所有内存）
const loadMemories = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.memories, () =>
      api.get('/memories'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      const memoryList = Array.isArray(response.data) ? response.data : response.data.memories || []
      memories.value = memoryList
        .filter(item => item && item.name)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))  // 按 sort_order 排序
        .map(item => item.name)
    }
  } catch (error) {
    logger.error('❌ 加载内存数据失败:', error)
    memories.value = []
  }
}

const loadSuppliers = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.suppliers, () =>
      api.get('/suppliers?page=1&limit=100'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success) {
      suppliers.value = response.data || []
    }
  } catch (error) {
    logger.error('加载供应商列表失败:', error)
    suppliers.value = []
  }
}

// 获取品牌对应的型号列表
const fetchBrandModels = async (brandName: string | number) => {
  if (!brandName) {
    brandModels.value = []
    return
  }

  try {
    // 如果传入的是品牌名称，先获取品牌ID
    let brandId = brandName
    if (typeof brandName === 'string') {
      const brand = brands.value.find(b => b.name === brandName)
      if (!brand) {
        brandModels.value = []
        return
      }
      brandId = brand.id
    }


    // 根据品牌ID获取型号列表
    const modelsResponse = await api.get(`/brands/${brandId}/models`)
    if (modelsResponse.success) {
      brandModels.value = modelsResponse.data
        .filter((model: any) => model.status === 1) // 只获取启用状态的型号
        .sort((a: any, b: any) => a.sort_order - b.sort_order) // 按排序字段排序
        .map((model: any) => ({
          id: model.id,
          name: model.name
        }))

    } else {
      brandModels.value = []
    }
  } catch (error) {
    logger.error('❌ 获取品牌型号失败:', error)
    brandModels.value = []
  }
}

// 品牌变化处理
const handleBrandChange = async () => {
  // 清空型号筛选
  filters.model = ''

  // 如果有选择品牌，获取对应的型号列表
  if (filters.brand) {
    await fetchBrandModels(filters.brand)
  } else {
    brandModels.value = []
  }

  // 重新加载数据
  loadAvailablePhones()
}

// 编辑弹窗专用的品牌型号数据
const editBrandModels = ref<string[]>([])

// 编辑弹窗的品牌变更处理
const onEditBrandChange = async () => {
  // 清空型号选择
  editForm.model = ''

  if (editForm.brand) {
    await fetchEditBrandModels(editForm.brand)
  } else {
    editBrandModels.value = []
  }
}

// 获取编辑弹窗品牌对应的型号列表
const fetchEditBrandModels = async (brandName: string) => {
  if (!brandName) {
    editBrandModels.value = []
    return
  }

  try {

    // 确保 brandName 是字符串
    const brandNameStr = String(brandName || '').trim()

    // 先获取品牌ID
    const brandsResponse = await api.get('/brands')
    if (brandsResponse.success) {
      // 尝试多种匹配方式：中文名、英文名、部分匹配
      let brand = brandsResponse.data.find((b: any) => {
        const bName = String(b.name || '').trim()
        return bName === brandNameStr ||
          bName.toLowerCase() === brandNameStr.toLowerCase() ||
          brandNameStr.toLowerCase().includes(bName.toLowerCase()) ||
          bName.toLowerCase().includes(brandNameStr.toLowerCase())
      })

      if (brand) {

        // 根据品牌ID获取型号列表
        const modelsResponse = await api.get(`/brands/${brand.id}/models`)
        if (modelsResponse.success) {
          editBrandModels.value = modelsResponse.data
            .filter((model: any) => model.status === 1) // 只获取启用状态的型号
            .sort((a: any, b: any) => a.sort_order - b.sort_order) // 按排序字段排序
            .map((model: any) => model.name)

        } else {
          editBrandModels.value = []
        }
      } else {
        editBrandModels.value = []
      }
    } else {
      editBrandModels.value = []
    }
  } catch (error) {
    logger.error('❌ 编辑弹窗 - 获取品牌型号失败:', error)
    editBrandModels.value = []
  }
}

// 打开销售模态框
const openSaleModal = (phone: Phone) => {
  // 权限检查：验证用户是否有销售权限
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  // 隐藏搜索筛选区域
  showSearchSection.value = false

  selectedPhone.value = phone
  saleForm.sale_price = ''
  saleForm.purchase_cost = String(phone.purchase_cost || 0) // 初始化入库价格

  // 销售店铺默认为空，需要手动选择
  saleForm.store_id = ''

  // 初始化备注：加载手机的备注信息
  saleForm.remarks = phone.remarks || ''

  resetCustomerForm()
  showSaleModal.value = true
}

// 打开销售模态框（带预定信息预填）
const openSaleModalWithPreorder = (phone: Phone, preorderInfo: {
  preorder_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  expected_price: string
  advance_payment: string
}) => {
  // 权限检查
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  // 隐藏搜索筛选区域
  showSearchSection.value = false

  selectedPhone.value = phone
  saleForm.purchase_cost = String(phone.purchase_cost || 0)
  saleForm.store_id = ''
  saleForm.remarks = phone.remarks || ''

  // 预填预定信息
  saleForm.customer_name = normalizePersonName(preorderInfo.customer_name || '', 20)
  saleForm.customer_phone = normalizeCustomerPhone(preorderInfo.customer_phone)
  // 预填销售价格（预定的期望价格）
  saleForm.sale_price = preorderInfo.expected_price || ''

  // 存储预定相关信息，用于提交销售时关联
  currentPreorderInfo.value = {
    preorder_id: preorderInfo.preorder_id,
    advance_payment: parseFloat(preorderInfo.advance_payment) || 0
  }

  // 如果有客户ID，尝试设置selectedCustomer
  if (preorderInfo.customer_id) {
    selectedCustomer.value = {
      id: parseInt(preorderInfo.customer_id),
      name: normalizePersonName(preorderInfo.customer_name, 20),
      phone: normalizeCustomerPhone(preorderInfo.customer_phone)
    }
  }

  showSaleModal.value = true
}


// 客户搜索功能
const handleCustomerSearch = (valueOrEvent) => {
  const rawValue = typeof valueOrEvent === 'string'
    ? valueOrEvent
    : valueOrEvent?.target?.value || ''

  // 清洗手机号：移除所有非数字字符（空格、横杠等）
  const cleanedValue = normalizeCustomerPhone(rawValue)

  // 更新表单值为清洗后的数据
  saleForm.customer_phone = cleanedValue

  if (selectedCustomer.value && normalizeCustomerPhone(selectedCustomer.value.phone) !== cleanedValue) {
    selectedCustomer.value = null
    customerCreating.value = false
  }

  // 清除之前的搜索
  if (customerSearchTimeout.value) {
    clearTimeout(customerSearchTimeout.value)
  }

  // 如果输入为空，清空结果
  if (!cleanedValue) {
    customerSearchResults.value = []
    return;
  }

  // 防抖搜索
  customerSearchTimeout.value = setTimeout(async () => {
    await searchCustomers(cleanedValue)
  }, 300)
}

// 搜索客户
const searchCustomers = async (phoneNumber) => {
  try {
    customerSearching.value = true

    const response = await api.get(`/sales/customers?search=${encodeURIComponent(phoneNumber)}`)


    if (response.success) {
      const results = extractResponseData<any[]>(response)
      customerSearchResults.value = results

      // 缓存结果
      customerSearchCache.value.set(phoneNumber, results)

      // 限制缓存大小
      if (customerSearchCache.value.size > 20) {
        const firstKey = customerSearchCache.value.keys().next().value
        customerSearchCache.value.delete(firstKey)
      }
    } else {
      customerSearchResults.value = []
    }
  } catch (error) {
    logger.error('搜索客户失败:', error)
    customerSearchResults.value = []
  } finally {
    customerSearching.value = false
  }
}

const resolveNativeCustomerInput = (source: any): HTMLInputElement | null => {
  if (!source) {
    return null
  }

  if (source instanceof HTMLInputElement) {
    return source
  }

  if (source instanceof HTMLElement && typeof source.querySelector === 'function') {
    const nestedInput = source.querySelector('input, textarea')
    if (nestedInput instanceof HTMLInputElement) {
      return nestedInput
    }
  }

  if (source?.target instanceof HTMLInputElement) {
    return source.target
  }

  if (source?.target instanceof HTMLElement && typeof source.target.querySelector === 'function') {
    const nestedInput = source.target.querySelector('input, textarea')
    if (nestedInput instanceof HTMLInputElement) {
      return nestedInput
    }
  }

  if (source?.input instanceof HTMLInputElement) {
    return source.input
  }

  if (source?.$el && typeof source.$el.querySelector === 'function') {
    return source.$el.querySelector('input')
  }

  return null
}

const focusCustomerNameInput = (input: HTMLInputElement | null) => {
  if (!input) {
    return
  }

  input.readOnly = false
  input.removeAttribute('readonly')
  input.disabled = false
  input.removeAttribute('disabled')
  input.focus({ preventScroll: true })
  input.click()

  const textLength = input.value?.length || 0

  try {
    if (isIOS.value) {
      input.setSelectionRange(textLength, textLength)
    } else {
      input.select()
    }
  } catch {
    // 忽略不支持选择范围的浏览器
  }
}

const promptCustomerNameForIOS = async (
  currentName: string,
  onConfirm: (nextName: string) => Promise<void> | void
) => {
  const promptedName = window.prompt('请输入客户姓名', currentName)
  if (promptedName === null) {
    return
  }

  const normalizedName = normalizePersonName(promptedName, 20)
  if (!normalizedName) {
    showWarning('客户姓名不能为空')
    return
  }

  await onConfirm(normalizedName)
}

const unlockCustomerNameFromTouch = (
  source: EventTarget | null | undefined,
  unlockEditing: () => void,
  fallbackName: string
) => {
  const touchedInput = resolveNativeCustomerInput(source)
  const fallbackInput = resolveNativeCustomerInput(document.querySelector(`input[name="${fallbackName}"]`))

  unlockEditing()

  const targetInput = touchedInput || fallbackInput
  if (!targetInput) {
    return
  }

  targetInput.readOnly = false
  targetInput.removeAttribute('readonly')
  targetInput.disabled = false
  targetInput.removeAttribute('disabled')
  targetInput.focus()
  targetInput.click()

  try {
    const textLength = targetInput.value?.length || 0
    targetInput.setSelectionRange(textLength, textLength)
  } catch {
    // ignore
  }
}

const handleTouchBasedCustomerUnlock = (
  event: TouchEvent,
  lastTapRef: { value: number },
  unlock: () => void,
  fallbackName: string,
  iosPromptHandler?: () => Promise<void> | void
) => {
  if (!isIOS.value) {
    return
  }

  const now = Date.now()
  const interval = now - lastTapRef.value
  lastTapRef.value = now

  if (interval > 0 && interval < 320) {
    if (iosPromptHandler) {
      iosPromptHandler()
      return
    }
    unlockCustomerNameFromTouch(event.target, unlock, fallbackName)
  }
}

// 启用客户姓名编辑（双击时）
const enableCustomerNameEdit = (event?: MouseEvent) => {
  if (!selectedCustomer.value) return
  customerNameEditing.value = true

  focusCustomerNameInput(resolveNativeCustomerInput(event) || resolveNativeCustomerInput(saleCustomerNameInputRef.value))

  nextTick(() => {
    focusCustomerNameInput(
      resolveNativeCustomerInput(saleCustomerNameInputRef.value) ||
      document.querySelector('input[name="sale-customer-name"]')
    )
  })
}

const handleCustomerNameTouchEnd = (event: TouchEvent) => {
  handleTouchBasedCustomerUnlock(
    event,
    customerNameLastTapAt,
    () => enableCustomerNameEdit(),
    'sale-customer-name',
    () => {
      if (!selectedCustomer.value) return
      void promptCustomerNameForIOS(saleForm.customer_name, async (nextName) => {
        saleForm.customer_name = nextName
        await saveCustomerNameEdit()
      })
    }
  )
}

// 禁用客户姓名编辑（失焦时自动保存）
const handleCustomerNameBlur = () => {
  if (customerCreating.value && !selectedCustomer.value) {
    void createNewCustomer()
    return
  }

  if (customerNameEditing.value && selectedCustomer.value) {
    saveCustomerNameEdit()
  } else {
    customerNameEditing.value = false
  }
}

// 按 Enter 键保存
const saveCustomerNameEdit = async () => {
  if (!selectedCustomer.value || !saleForm.customer_name.trim()) {
    showError('客户姓名不能为空')
    return
  }

  const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

  if (!normalizedCustomerName) {
    showError('客户姓名不能为空')
    return
  }

  customerEditSubmitting.value = true

  try {
    const response = await api.put(`/customers/${selectedCustomer.value.id}`, {
      name: normalizedCustomerName,
      apple_id: normalizedAppleId || null
    })

    if (response.success) {
      // 更新选中的客户对象
      selectedCustomer.value.name = normalizedCustomerName
      selectedCustomer.value.apple_id = normalizedAppleId || ''
      saleForm.customer_name = normalizedCustomerName
      saleForm.customer_apple_id = normalizedAppleId || ''

      showSuccess('客户信息更新成功')
    } else {
      showError(response.message || '更新失败')
    }
  } catch (error: any) {
    logger.error('更新客户失败:', error)
    showError(error.response?.data?.message || '更新客户失败')
  } finally {
    customerEditSubmitting.value = false
    customerNameEditing.value = false
  }
}

// 选择客户
const selectCustomer = (customer) => {
  selectedCustomer.value = customer
  saleForm.customer_phone = normalizeCustomerPhone(customer.phone)
  saleForm.customer_name = normalizePersonName(customer.name, 20)
  saleForm.customer_apple_id = normalizeAppleId(customer.apple_id || '')
  customerNameEditing.value = false // 选择客户后重置编辑状态
  customerCreating.value = false
  showCustomerSearch.value = false
  customerSearchResults.value = []
}

// 清除选中的客户
const clearSelectedCustomer = () => {
  selectedCustomer.value = null
  saleForm.customer_phone = ''
  saleForm.customer_name = ''
  saleForm.customer_apple_id = ''
  customerNameEditing.value = false
  customerCreating.value = false
}

// 保存客户信息修改
const saveCustomerEdit = async () => {
  if (!selectedCustomer.value || !saleForm.customer_name.trim()) {
    showError('客户姓名不能为空')
    return
  }

  const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

  if (!normalizedCustomerName) {
    showError('客户姓名不能为空')
    return
  }

  customerEditSubmitting.value = true

  try {
    const response = await api.put(`/customers/${selectedCustomer.value.id}`, {
      name: normalizedCustomerName,
      apple_id: normalizedAppleId || null
    })

    if (response.success) {
      // 更新选中的客户对象
      selectedCustomer.value.name = normalizedCustomerName
      selectedCustomer.value.apple_id = normalizedAppleId || ''
      saleForm.customer_name = normalizedCustomerName
      saleForm.customer_apple_id = normalizedAppleId || ''

      showSuccess('客户信息更新成功')
      customerNameEditing.value = false
    } else {
      showError(response.message || '更新失败')
    }
  } catch (error: any) {
    logger.error('更新客户失败:', error)
    showError(error.response?.data?.message || '更新客户失败')
  } finally {
    customerEditSubmitting.value = false
  }
}

// 创建新客户
const createNewCustomer = async () => {
  const normalizedCustomerPhone = normalizeCustomerPhone(saleForm.customer_phone)
  const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    showError('请输入有效的手机号码')
    customerSearching.value = false
    return
  }

  if (!customerCreating.value) {
    customerCreating.value = true
    customerNameEditing.value = true
    showCustomerSearch.value = false
    nextTick(() => {
      focusCustomerNameInput(
        resolveNativeCustomerInput(saleCustomerNameInputRef.value) ||
        document.querySelector('input[name="sale-customer-name"]')
      )
    })
    return
  }

  if (!normalizedCustomerName) {
    showError('请输入客户姓名')
    return
  }

  customerSearching.value = true

  try {
    const response = await api.post('/customers', {
      name: normalizedCustomerName,
      phone: normalizedCustomerPhone,
      apple_id: normalizedAppleId || null,
      email: resolveAppleAccountEmail(normalizedAppleId),
      gender: null,
      birthday: null,
      id_card: null,
      address: null,
      city: null,
      province: null,
      postal_code: null,
      customer_type: 'individual',
      vip_level: 'normal',
      notes: '通过销售系统创建',
      tags: null,
      blacklist: 0,
      credit_rating: 'good',
      preferred_contact: 'phone',
      source: 'sales'
    }, { showError: false })

    if (response.success && response.data) {
      const newCustomer = response.data
      selectedCustomer.value = newCustomer
      saleForm.customer_phone = normalizeCustomerPhone(newCustomer.phone)
      saleForm.customer_name = normalizePersonName(newCustomer.name, 20)
      saleForm.customer_apple_id = normalizeAppleId(newCustomer.apple_id || '')
      customerCreating.value = false
      customerNameEditing.value = false
      showCustomerSearch.value = false
      customerSearchResults.value = []
      showSuccess(`新客户 "${saleForm.customer_name}" 创建成功`)
      return
    }

    showError(response.message || '创建客户失败')
  } catch (error: any) {
    logger.error('创建客户失败:', error)
    showError(error.response?.data?.message || '创建客户失败')
  } finally {
    customerSearching.value = false
  }
}

// 批量销售创建新客户
const createNewBatchCustomer = async () => {
  const normalizedCustomerPhone = normalizeCustomerPhone(batchSaleForm.customer_phone)
  const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(batchSaleForm.apple_id)

  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    showError('请输入有效的手机号码')
    batchCustomerSearching.value = false
    return
  }

  if (!batchCustomerCreating.value) {
    batchCustomerCreating.value = true
    batchCustomerNameEditing.value = true
    showBatchCustomerSearch.value = false
    nextTick(() => {
      const input = document.querySelector('input[name="batch-customer-name"]') as HTMLInputElement | null
      if (input) {
        input.focus()
        input.select()
      }
    })
    return
  }

  if (!normalizedCustomerName) {
    showError('请输入客户姓名')
    return
  }

  batchCustomerSearching.value = true

  try {
    const response = await api.post('/customers', {
      name: normalizedCustomerName,
      phone: normalizedCustomerPhone,
      apple_id: normalizedAppleId || null,
      email: resolveAppleAccountEmail(normalizedAppleId),
      gender: null,
      birthday: null,
      id_card: null,
      address: null,
      city: null,
      province: null,
      postal_code: null,
      customer_type: 'individual',
      vip_level: 'normal',
      notes: '通过销售系统创建',
      tags: null,
      blacklist: 0,
      credit_rating: 'good',
      preferred_contact: 'phone',
      source: 'sales'
    }, { showError: false })

    if (response.success && response.data) {
      const newCustomer = response.data
      selectedBatchCustomer.value = newCustomer
      batchSaleForm.customer_phone = normalizeCustomerPhone(newCustomer.phone)
      batchSaleForm.customer_name = normalizePersonName(newCustomer.name, 20)
      batchSaleForm.apple_id = normalizeAppleId(newCustomer.apple_id || '')
      batchCustomerCreating.value = false
      batchCustomerNameEditing.value = false
      showBatchCustomerSearch.value = false
      batchCustomerSearchResults.value = []
      showSuccess(`新客户 "${batchSaleForm.customer_name}" 创建成功`)
      return
    }

    showError(response.message || '创建客户失败')
  } catch (error: any) {
    logger.error('创建客户失败:', error)
    showError(error.response?.data?.message || '创建客户失败')
  } finally {
    batchCustomerSearching.value = false
  }
}

// 获取VIP等级标签
const getVipLabel = (vipLevel) => {
  const labels = {
    normal: '普通',
    silver: '银卡',
    gold: '金卡',
    platinum: '白金'
  }
  return labels[vipLevel] || '普通'
}

// 重置客户表单
const resetCustomerForm = () => {
  selectedCustomer.value = null
  saleForm.customer_name = ''
  saleForm.customer_phone = ''
  saleForm.customer_apple_id = ''
  showCustomerSearch.value = false
  customerSearchResults.value = []
}


// 快速销售
// 切换批量模式
const toggleBatchMode = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  batchMode.value = !batchMode.value
    if (!batchMode.value) {
    // 退出批量模式时清空选择
    selectedPhones.value = []
    selectAll.value = false
      }
}

// 处理销售动作
const handleSaleAction = (phone) => {
  if (batchMode.value) {
    // 批量模式下切换选择状态
    togglePhoneSelection(phone)
  } else {
    // 单台模式下直接打开销售弹窗
    openSaleModal(phone)
  }
}

// 打开快速销售弹窗
const openQuickSale = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  if (availablePhones.value.length === 0) {
    warning('暂无可销售设备')
    return;
  }

  saleCompleted.value = false

  // 隐藏搜索筛选区域
  showSearchSection.value = false

  if (batchMode.value) {
    // 批量模式
    if (selectedPhones.value.length === 0) {
      warning('请先选择要销售的设备')
      return;
    }
    selectedPhone.value = null // 批量模式下不选中单个设备
    saleForm.sale_price = ''
    // 批量模式下，使用所有设备的平均入库价作为默认值
    const avgCost = selectedPhones.value.reduce((sum, p) => sum + (p.purchase_cost || 0), 0) / selectedPhones.value.length
    saleForm.purchase_cost = String(avgCost || 0)
    showSaleModal.value = true
  } else {
    // 单台模式
    selectedPhone.value = availablePhones.value[0]
    saleForm.sale_price = ''
    saleForm.purchase_cost = String(availablePhones.value[0].purchase_cost || 0)
    // 初始化备注：加载手机的备注信息
    saleForm.remarks = availablePhones.value[0].remarks || ''
    showSaleModal.value = true
  }
}

// 检查手机是否被选中
const isPhoneSelected = (phone) => {
  return selectedPhones.value.some(p => p.id === phone.id)
}

// 切换手机选择状态
const togglePhoneSelection = (phone) => {
  const index = selectedPhones.value.findIndex(p => p.id === phone.id)
  if (index > -1) {
    selectedPhones.value.splice(index, 1)
      } else {
    selectedPhones.value.push(phone)
      }
  // 更新全选状态
  selectAll.value = selectedPhones.value.length === availablePhones.value.length
}

// 切换全选状态
const toggleSelectAll = async () => {
  if (selectAll.value) {
    selectedPhones.value = [...availablePhones.value]
      } else {
    selectedPhones.value = []
      }
  // 强制更新视图
  await nextTick()
  }

// 清空批量选择
const clearBatchSelection = () => {
  selectedPhones.value = []
  selectAll.value = false
  resetBatchSaleForm()
}

// 设置默认销售员为当前用户
const setDefaultOperator = () => {
  const currentUser = authStore.user
  if (!currentUser || !operators.value.length) return

  // 查找与当前用户匹配的操作员
  let matchedOperator = operators.value.find(op =>
    op.username === currentUser.username ||
    op.name === currentUser.name
  )

  // 设置默认销售员
  if (matchedOperator) {
    batchSaleForm.operator_id = String(matchedOperator.id)
    // 单个销售表单也设置
    saleForm.operator_id = String(matchedOperator.id)
  }
}

// 重置批量销售表单
const resetBatchSaleForm = () => {
  const currentUser = authStore.user
  let defaultOperatorId = null

  if (currentUser && operators.value.length > 0) {
    let matchedOperator = operators.value.find(op =>
      op.username === currentUser.username ||
      op.name === currentUser.name
    )

    if (matchedOperator) {
      defaultOperatorId = matchedOperator.id
    } else {
      defaultOperatorId = operators.value[0].id
    }
  }

  Object.assign(batchSaleForm, {
    customer_name: '',
    customer_phone: '',
    apple_id: '',
    sale_price: '',
    store_id: '',
    operator_id: defaultOperatorId || '',
    sale_date: getTodayDate(),
    payment_method: '',
    payment_channel: '',
    transaction_no: '',
    remarks: ''
  })
}

// 批量客户搜索处理
const handleBatchCustomerPhoneInput = () => {
  // 清洗手机号：移除所有非数字字符（空格、横杠等）
  const cleanedValue = normalizeCustomerPhone(batchSaleForm.customer_phone)

  // 更新表单值为清洗后的数据
  batchSaleForm.customer_phone = cleanedValue

  if (selectedBatchCustomer.value && normalizeCustomerPhone(selectedBatchCustomer.value.phone) !== cleanedValue) {
    selectedBatchCustomer.value = null
    batchCustomerCreating.value = false
  }

  const phone = cleanedValue

  // 清除之前的超时
  if (batchCustomerSearchTimeout.value) {
    clearTimeout(batchCustomerSearchTimeout.value)
  }

  // 如果输入为空，清空搜索结果
  if (!phone) {
    batchCustomerSearchResults.value = []
    showBatchCustomerSearch.value = false
    return;
  }

  // 如果输入没有变化，跳过搜索
  if (phone === lastBatchSearchPhone.value) {
    return;
  }
  lastBatchSearchPhone.value = phone

  // 显示搜索状态
  batchCustomerSearching.value = true
  showBatchCustomerSearch.value = true

  // 设置新的搜索超时，减少延迟以提高响应速度
  batchCustomerSearchTimeout.value = setTimeout(() => {
    searchBatchCustomers(phone)
  }, 200)
}

const searchBatchCustomers = async (phone) => {
  if (!phone) {
    batchCustomerSearchResults.value = []
    batchCustomerSearching.value = false
    return;
  }

  try {
    const response = await api.get(`/sales/customers?search=${encodeURIComponent(phone)}`)

    if (response.success) {
      const results = extractResponseData<any[]>(response)
      batchCustomerSearchResults.value = results

      // 缓存结果
      batchCustomerSearchCache.value.set(phone, results)

      // 限制缓存大小
      if (batchCustomerSearchCache.value.size > 20) {
        const firstKey = batchCustomerSearchCache.value.keys().next().value
        batchCustomerSearchCache.value.delete(firstKey)
      }
    } else {
      batchCustomerSearchResults.value = []
    }
  } catch (error) {
    logger.error('批量搜索客户失败:', error)
    batchCustomerSearchResults.value = []
  } finally {
    batchCustomerSearching.value = false
  }
}

const handleBatchCustomerBlur = () => {
  // 延迟隐藏，以便点击搜索结果
  setTimeout(() => {
    showBatchCustomerSearch.value = false
  }, 200)
}

// 启用批量模式客户姓名编辑（双击时）
const enableBatchCustomerNameEdit = (event?: MouseEvent) => {
  if (!selectedBatchCustomer.value) return
  batchCustomerNameEditing.value = true

  focusCustomerNameInput(resolveNativeCustomerInput(event) || resolveNativeCustomerInput(batchCustomerNameInputRef.value))

  nextTick(() => {
    focusCustomerNameInput(
      resolveNativeCustomerInput(batchCustomerNameInputRef.value) ||
      document.querySelector('input[name="batch-customer-name"]')
    )
  })
}

const handleBatchCustomerNameTouchEnd = (event: TouchEvent) => {
  handleTouchBasedCustomerUnlock(
    event,
    batchCustomerNameLastTapAt,
    () => enableBatchCustomerNameEdit(),
    'batch-customer-name',
    () => {
      if (!selectedBatchCustomer.value) return
      void promptCustomerNameForIOS(batchSaleForm.customer_name, async (nextName) => {
        batchSaleForm.customer_name = nextName
        await saveBatchCustomerNameEdit()
      })
    }
  )
}

// 禁用批量模式客户姓名编辑（失焦时自动保存）
const disableBatchCustomerNameEdit = () => {
  if (batchCustomerCreating.value && !selectedBatchCustomer.value) {
    void createNewBatchCustomer()
    return
  }

  if (batchCustomerNameEditing.value && selectedBatchCustomer.value) {
    saveBatchCustomerNameEdit()
  } else {
    batchCustomerNameEditing.value = false
  }
}

// 保存批量模式客户姓名编辑
const saveBatchCustomerNameEdit = async () => {
  if (!selectedBatchCustomer.value || !batchSaleForm.customer_name.trim()) {
    showError('客户姓名不能为空')
    return
  }

  const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(batchSaleForm.apple_id)

  if (!normalizedCustomerName) {
    showError('客户姓名不能为空')
    return
  }

  customerEditSubmitting.value = true

  try {
    const response = await api.put(`/customers/${selectedBatchCustomer.value.id}`, {
      name: normalizedCustomerName,
      apple_id: normalizedAppleId || null
    })

    if (response.success) {
      // 更新选中的客户对象
      selectedBatchCustomer.value.name = normalizedCustomerName
      selectedBatchCustomer.value.apple_id = normalizedAppleId || ''
      batchSaleForm.customer_name = normalizedCustomerName
      batchSaleForm.apple_id = normalizedAppleId || ''

      showSuccess('客户信息更新成功')
    } else {
      showError(response.message || '更新失败')
    }
  } catch (error: any) {
    logger.error('更新客户失败:', error)
    showError(error.response?.data?.message || '更新客户失败')
  } finally {
    customerEditSubmitting.value = false
    batchCustomerNameEditing.value = false
  }
}

const selectBatchCustomer = (customer) => {
  selectedBatchCustomer.value = customer
  batchSaleForm.customer_name = normalizePersonName(customer.name, 20)
  batchSaleForm.customer_phone = normalizeCustomerPhone(customer.phone)
  batchSaleForm.apple_id = normalizeAppleId(customer.apple_id || '')
  batchCustomerNameEditing.value = false // 选择客户后重置编辑状态
  batchCustomerCreating.value = false
  showBatchCustomerSearch.value = false
}

// 清除选中的批量客户
const clearSelectedBatchCustomer = () => {
  selectedBatchCustomer.value = null
  batchSaleForm.customer_name = ''
  batchSaleForm.customer_phone = ''
  batchSaleForm.apple_id = ''
  batchCustomerNameEditing.value = false
  batchCustomerCreating.value = false
}

// 提交批量销售
const submitBatchSale = async () => {
  // 防重复提交检查
  if (submitting.value) {
    return;
  }

  const normalizedCustomerPhone = normalizeCustomerPhone(batchSaleForm.customer_phone)
  const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(batchSaleForm.apple_id)

  // 表单验证
  if (!normalizedCustomerName) {
    showError('请输入客户姓名')
    return;
  }

  if (!normalizedCustomerPhone) {
    showError('请输入客户电话')
    return;
  }

  // 验证手机号格式
  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    showError('请输入有效的手机号码')
    return;
  }

  if (!batchSaleForm.sale_price || parseFloat(batchSaleForm.sale_price) <= 0) {
    showError('销售单价必须大于0')
    return;
  }

  if (!batchSaleForm.store_id) {
    showError('请选择销售店铺')
    return;
  }

  if (!batchSaleForm.operator_id) {
    showError('请选择销售员')
    return;
  }

  if (!batchSaleForm.payment_method) {
    showError('请选择支付方式')
    return;
  }

  submitting.value = true
  try {
    // 获取操作员名称
    const operatorName = operators.value.find(op => String(op.id) === batchSaleForm.operator_id)?.name ||
                        operators.value.find(op => String(op.id) === batchSaleForm.operator_id)?.username || ''

    const saleData = {
      phones: selectedPhones.value.map(phone => ({
        phone_id: phone.id,
        price: parseFloat(batchSaleForm.sale_price)
      })),
      customer_info: {
        name: normalizedCustomerName,
        phone: normalizedCustomerPhone,
        apple_id: normalizedAppleId || '',
        address: '',
        remarks: batchSaleForm.remarks
      },
      sale_type: 'batch',
      store_id: batchSaleForm.store_id,
      operator_id: batchSaleForm.operator_id,
      operator_name: operatorName,
      sale_date: batchSaleForm.sale_date || getTodayDate(),
      payment_info: {
        payment_method: batchSaleForm.payment_method,
        payment_channel: batchSaleForm.payment_channel || null,
        transaction_no: batchSaleForm.transaction_no || null,
        payment_amount: parseFloat(batchSaleForm.sale_price) * selectedPhones.value.length,
        payment_status: 'success',
        payment_time: batchSaleForm.sale_date || getTodayDate()
      },
      remarks: batchSaleForm.remarks
    }

    const response = await api.post('/sales/phone', saleData, { showError: false })

    if (response.success) {
      showSuccess(`批量销售成功！共销售 ${selectedPhones.value.length} 台设备`)
      clearBatchSelection()
      loadAvailablePhones()
      todaySold.value += selectedPhones.value.length
    } else {
      showError(response.message || '批量销售失败')
    }
  } catch (error) {
    logger.error('批量销售失败:', error)
    showError('批量销售失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

// 销售完成状态
const saleCompleted = ref(false)

// 检查销售表单是否有填写内容
const hasSaleFormData = () => {
  // 如果销售已完成，则不需要显示未保存数据警告
  if (saleCompleted.value) {
    return false
  }

  return saleForm.customer_name.trim() !== '' ||
         saleForm.customer_phone.trim() !== '' ||
         saleForm.customer_apple_id.trim() !== '' ||
         (saleForm.sale_price && parseFloat(saleForm.sale_price) > 0) ||
         saleForm.store_id !== '' ||
         saleForm.operator_id !== '' ||
         saleForm.remarks.trim() !== ''
}

// 显示确认对话框
const showConfirm = async (message) => {
  try {
    await ElMessageBox.confirm(
      message,
      '确认操作',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
    return true
  } catch {
    return false
  }
}

// 关闭销售模态框
const closeSaleModal = () => {
  showSaleModal.value = false
  selectedPhone.value = null

  // 重新显示搜索筛选区域
  showSearchSection.value = true

  // 清除预定信息
  currentPreorderInfo.value = null

  resetSaleForm()
}

// 重置销售表单
const resetSaleForm = () => {
  // 获取当前用户作为默认操作员
  const currentUser = authStore.user
  let defaultOperatorId = null

  if (currentUser && operators.value.length > 0) {
    // 优先匹配用户名或姓名
    let matchedOperator = operators.value.find(op =>
      op.username === currentUser.username ||
      op.name === currentUser.name
    )

    if (matchedOperator) {
      defaultOperatorId = matchedOperator.id
    } else {
      defaultOperatorId = operators.value[0].id
    }
  }

  Object.assign(saleForm, {
    customer_name: '',
    customer_phone: '',
    customer_apple_id: '',
    sale_price: '',
    purchase_cost: '', // 重置入库价格
    store_id: '',
    operator_id: defaultOperatorId || '',
    sale_date: getTodayDate(),
    payment_method: '',
    payment_channel: '',
    transaction_no: '',
    remarks: ''
  })

  // 重置销售完成状态
  saleCompleted.value = false

  // 重置客户相关状态
  resetCustomerForm()
}

// 计算利润
const calculateProfit = () => {
  // 利润会通过计算属性自动计算
  // 如果当前是国补刷卡模式，自动更新备注
  if (saleForm.payment_method === 'subsidy_card' || saleForm.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}

// 处理销售
const handleSale = async () => {
  // 防重复提交检查
  if (submitting.value) {
    return;
  }

  if (!selectedPhone.value) return;

  const normalizedCustomerPhone = normalizeCustomerPhone(saleForm.customer_phone)
  const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

  // 权限检查：验证用户是否有销售权限
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  // 表单验证
  if (!normalizedCustomerName) {
    showError('请输入客户姓名')
    return;
  }

  if (!normalizedCustomerPhone) {
    showError('请输入客户手机号码')
    return;
  }

  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    showError('请输入有效的手机号码')
    return;
  }

  if (!saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) {
    showError('销售价格必须大于0')
    return;
  }

  if (!saleForm.store_id) {
    showError('请选择销售门店')
    return;
  }

  if (!saleForm.operator_id) {
    showError('请选择销售员')
    return;
  }

  if (!saleForm.payment_method) {
    showError('请选择支付方式')
    return;
  }

  submitting.value = true
  try {
    // 获取操作员名称
    const operatorName = operators.value.find(op => String(op.id) === saleForm.operator_id)?.name ||
                        operators.value.find(op => String(op.id) === saleForm.operator_id)?.username || ''

    let saleData
    if (batchMode.value) {
      // 批量销售数据
      saleData = {
        phones: selectedPhones.value.map(phone => ({
          phone_id: phone.id,
          price: parseFloat(saleForm.sale_price),
          purchase_cost: saleForm.purchase_cost !== undefined && saleForm.purchase_cost !== ''
            ? parseFloat(saleForm.purchase_cost)
            : phone.purchase_cost // 入库价格
        })),
        customer_info: {
          name: normalizedCustomerName,
          phone: normalizedCustomerPhone,
          apple_id: normalizedAppleId || '',
          address: '',
          remarks: saleForm.remarks
        },
        sale_type: 'batch',
        store_id: saleForm.store_id,
        operator_name: operatorName,
        sale_date: saleForm.sale_date || getTodayDate(),
        payment_info: {
          payment_method: saleForm.payment_method,
          payment_channel: saleForm.payment_channel || null,
          transaction_no: saleForm.transaction_no || null,
          payment_amount: parseFloat(saleForm.sale_price) * selectedPhones.value.length,
          payment_status: 'success',
          payment_time: saleForm.sale_date || getTodayDate()
        },
        remarks: saleForm.remarks
      }
    } else {
      // 单台销售数据
      saleData = {
        phone_id: selectedPhone.value.id,
        customer_info: {
          name: normalizedCustomerName,
          phone: normalizedCustomerPhone,
          apple_id: normalizedAppleId || '',
          address: '',
          remarks: saleForm.remarks
        },
        sale_type: 'retail',
        price: parseFloat(saleForm.sale_price),
        purchase_cost: saleForm.purchase_cost !== undefined && saleForm.purchase_cost !== ''
          ? parseFloat(saleForm.purchase_cost)
          : selectedPhone.value.purchase_cost, // 入库价格
        sale_date: saleForm.sale_date || getTodayDate(), // 销售日期
        store_id: saleForm.store_id,
        operator_id: saleForm.operator_id,
        operator_name: operatorName,
        payment_info: {
          payment_method: saleForm.payment_method,
          payment_channel: saleForm.payment_channel || null,
          transaction_no: saleForm.transaction_no || null,
          payment_amount: parseFloat(saleForm.sale_price),
          payment_status: 'success',
          payment_time: saleForm.sale_date || getTodayDate()
        },
        remarks: saleForm.remarks,
        // 预定相关字段（从预定页面跳转过来时有值）
        preorder_id: currentPreorderInfo.value?.preorder_id || null,
        advance_payment: currentPreorderInfo.value?.advance_payment || 0
      }
    }

    const response = await api.post('/sales/phone', saleData, { showError: false })

    if (response.success) {
      showSuccess(batchMode.value ? `批量销售成功！共销售 ${selectedPhones.value.length} 台设备` : '销售出库成功！')
      // 标记销售已完成，这样关闭弹窗时不会显示未保存数据警告
      saleCompleted.value = true
      closeSaleModal()
      if (batchMode.value) {
        // 批量模式下清空选择
        selectedPhones.value = []
        selectAll.value = false
      }
      loadAvailablePhones()
      todaySold.value += batchMode.value ? selectedPhones.value.length : 1
    } else {
      showError(response.message || '销售出库失败')
    }
  } catch (error) {
    logger.error('销售出库失败:', error)
    showError('销售出库失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

// 防抖包装的提交函数
const debouncedSubmitSale = debounceSubmit(handleSale, 500)
const debouncedSubmitBatchSale = debounceSubmit(submitBatchSale, 500)

// 编辑手机信息
const editPhone = async (phone: any) => {

  // 权限检查：验证用户是否有编辑权限
  if (!canEdit.value) {
    showError('您没有编辑商品的权限，请联系管理员分配相关权限')
    return;
  }

  // 所有设备统一使用弹窗编辑
  selectedPhoneForEdit.value = phone
  showEditModal.value = true
}

// 提交编辑
const submitEdit = async () => {
  try {
    // 验证必填字段
    // 对于手机设备（品牌包含iPhone、华为、小米等），IMEI必须是15位
    // 对于非手机设备（AirPods、iPad等），IMEI可以不是15位
    const isPhoneDevice = /^(iPhone|华为|小米|红米|OPPO|vivo|三星|荣耀|realme|一加|魅族|诺基亚|索尼|LG|摩托罗拉)/i.test(editForm.brand || '')
    if (isPhoneDevice && editForm.imei !== editForm.serial_number && (!editForm.imei || editForm.imei.length < 15)) {
      showError('请输入完整的15位IMEI号')
      return
    }

    // 构建更新数据，包含所有可编辑字段（不包括销售价格）
    const updateData = {
      brand: editForm.brand || '',
      model: editForm.model || '',
      color: editForm.color || '',
      memory: editForm.memory || '',
      serial_number: editForm.serial_number || '',
      imei: editForm.imei || '',
      purchase_cost: editForm.purchase_cost !== null && editForm.purchase_cost !== undefined && editForm.purchase_cost !== '' ?
        Math.round(Number(editForm.purchase_cost)) : null,
      supplier_id: editForm.supplier_id || null,
      store_id: editForm.store_id || null,
      condition: editForm.condition === '全新' ? 'new' : 'used',
      created_at: editForm.created_at ? `${editForm.created_at}T12:00:00+08:00` : null,
      remarks: editForm.remarks || ''
    }

    // 移除空值（但保留必要的字段）
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === null || updateData[key] === '' || updateData[key] === undefined) {
        // 品牌型号颜色内存是关键字段，保留空字符串而不是删除
        if (!['brand', 'model', 'color', 'memory'].includes(key)) {
          delete updateData[key]
        }
      }
    })


    // 发送更新请求
    const response = await api.put(`/phones/${selectedPhoneForEdit.value.id}`, updateData, { showError: false })

    if (response.success) {
      showSuccess('更新成功')
      showEditModal.value = false
      await loadAvailablePhones() // 刷新列表
    } else {
      showError(response.message || '更新失败')
    }
  } catch (error) {
    logger.error('更新失败:', error)
    showError('更新失败，请重试')
  }
}

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false
  selectedPhoneForEdit.value = null
  // 清空编辑弹窗的品牌型号数据
  editBrandModels.value = []
  // 重置表单数据
  Object.assign(editForm, {
    brand: '',
    model: '',
    color: '',
    memory: '',
    serial_number: '',
    imei: '',
    purchase_price: null,
    purchase_cost: null,
    supplier_id: null,
    store_id: null,
    operator_id: '',
    operator_name: '',
    condition: '',
    status: '',
    created_at: null,
    remarks: ''
  })
}

// IMEI输入验证 - 根据模式决定格式化规则
const handleImeiInput = (value: string) => {
  if (editIsNoIMEIMode.value) {
    // 无IMEI模式：允许数字和字母，字母转大写
    editForm.imei = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 30)
  } else {
    // 标准模式：只允许数字
    editForm.imei = value.replace(/[^\d]/g, '').slice(0, 15)
  }
}

// 切换编辑模式的无IMEI状态
const toggleEditNoIMEIMode = () => {
  editIsNoIMEIMode.value = !editIsNoIMEIMode.value

  if (editIsNoIMEIMode.value) {
    // 启用无IMEI模式：如果有序列号，自动填充IMEI
    if (editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }
    showSuccess('已启用无IMEI模式，IMEI将支持字母+数字')
  } else {
    // 切换回标准模式：清空IMEI，重新输入15位纯数字
    editForm.imei = ''
    showInfo('已切换回标准IMEI模式，需要输入15位纯数字')
  }
}

// 检测编辑模式是否为无IMEI模式
const detectEditNoIMEIMode = (imei: string | undefined, serialNumber: string | undefined): boolean => {
  if (!imei) return false

  // 1. IMEI包含字母 → 无IMEI模式
  if (/[a-zA-Z]/.test(imei)) {
    return true
  }

  // 2. IMEI与序列号相同且长度不是15位 → 无IMEI模式
  if (imei === serialNumber && imei.length !== 15) {
    return true
  }

  // 3. IMEI长度不是15位 → 无IMEI模式
  if (imei.length !== 15) {
    return true
  }

  return false
}

// 序列号输入验证 - 只允许字母和数字
const handleSerialNumberInput = (value: string) => {
  editForm.serial_number = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18)
}

// 支付方式变化处理
const handlePaymentMethodChange = () => {
  // 如果选择了国补刷卡，检查金额是否超过6000
  if (saleForm.payment_method === 'subsidy_card') {
    const salePrice = parseFloat(saleForm.sale_price) || 0
    if (salePrice > 6000) {
      showError('销售金额超过6000元，无法使用国补刷卡，请重新选择支付方式')
      saleForm.payment_method = ''
      saleForm.payment_channel = ''
      saleForm.remarks = ''
      return
    }
    saleForm.payment_channel = 'subsidy_card'
    // 立即计算备注
    calculateSubsidyRemarks()
  } else {
    // 清空支付渠道和备注
    saleForm.payment_channel = ''
    saleForm.remarks = ''
  }
}

// 支付渠道变化处理（保留，以防手动选择时使用）
const handlePaymentChannelChange = () => {
  // 如果选择了国补刷卡，自动计算并填写备注
  if (saleForm.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}

// 计算国补备注
const calculateSubsidyRemarks = () => {
  const salePrice = parseFloat(saleForm.sale_price) || 0
  if (salePrice <= 0) return

  // 只有6000元以内才能参加国补
  if (salePrice > 6000) {
    // 清空国补刷卡选择
    if (saleForm.payment_method === 'subsidy_card') {
      showError('销售金额超过6000元，无法使用国补刷卡，请重新选择支付方式')
      saleForm.payment_method = ''
      saleForm.payment_channel = ''
    }
    // 只有原备注是国补备注时才清空
    if (saleForm.remarks && saleForm.remarks.startsWith('刷卡实际支付')) {
      saleForm.remarks = ''
    }
    return
  }

  // 计算优惠金额：15%，最高优惠500元
  const discount = Math.min(salePrice * 0.15, 500)
  // 保留两位小数
  const roundedDiscount = Math.round(discount * 100) / 100
  // 计算实际支付金额
  const actualPayment = Math.round((salePrice - roundedDiscount) * 100) / 100

  // 设置备注：只有当备注为空时才自动填充国补信息
  // 如果备注已有数据，则不替换（保留原备注）
  if (!saleForm.remarks || saleForm.remarks.trim() === '') {
    saleForm.remarks = `刷卡实际支付${actualPayment}元`
  }
}

// 监听视图模式变化，切换到库存表模式时加载数据
watch(viewMode, async (newMode) => {
  if (newMode === 'summary') {
    await loadInventorySummary()
  }
})

// 监听筛选条件变化，在库存表模式下重新加载数据（使用防抖优化）
watch(
  () => [filters.supplier_id, filters.store_id, filters.brand, filters.model, filters.color, filters.memory, filters.is_new, filters.date_start, filters.date_end, filters.search],
  () => {
    // 使用防抖，避免频繁API调用
    debounceLoadInventorySummary()
  }
)

// 监听编辑弹窗打开，填充表单数据
watch(showEditModal, async (newVal) => {
  if (newVal && selectedPhoneForEdit.value) {
    const phone = selectedPhoneForEdit.value as any

    // 参考 EditPhoneView 的逻辑获取入库员姓名
    const operatorName = phone.inventory_operator_name ||
                         phone.purchase_operator_name ||
                         phone.operator_name ||
                         phone.created_by_name ||
                         authStore.user?.name ||
                         '当前用户'

    // 填充表单数据
    Object.assign(editForm, {
      brand: phone.brand || '',
      model: phone.model || '',
      color: phone.color || '',
      memory: phone.memory || '',
      serial_number: phone.serial_number || '',
      imei: phone.imei || '',
      purchase_price: phone.purchase_price || null,
      purchase_cost: (phone.purchase_cost || phone.cost) ? Math.round(Number(phone.purchase_cost || phone.cost || 0)) : null,
      supplier_id: phone.supplier_id || null,
      store_id: phone.store_id || null,
      operator_id: phone.operator_id || '',
      operator_name: operatorName,
      condition: phone.condition || '',
      status: phone.status || '',
      created_at: phone.created_at || phone.inbound_date || phone.Inventorytime ?
        new Date(phone.created_at || phone.inbound_date || phone.Inventorytime).toISOString().slice(0, 10) : null,
      remarks: phone.remarks || ''
    })

    // 检测是否为无IMEI模式
    editIsNoIMEIMode.value = detectEditNoIMEIMode(editForm.imei, editForm.serial_number)

    // 如果选择了品牌，加载对应的型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
  }
})

// 删除手机记录
const deletePhone = async (phone: any) => {
  // 权限检查：验证用户是否有删除权限
  if (!canDelete.value) {
    showError('您没有删除商品的权限，请联系管理员分配相关权限')
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这台手机吗？\n\n品牌型号：${phone.brand} ${phone.model}\nIMEI：${phone.imei || '无'}\n\n此操作不可恢复！`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return;
  }

  try {
    const response = await api.delete(`/phones/${phone.id}`, { showError: false })

    if (response.success) {
      showSuccess('删除成功')
      await loadAvailablePhones()
    } else {
      showError(response.message || '删除失败')
    }
  } catch (error) {
    logger.error('删除失败:', error)
    showError('删除失败')
  }
}

// 分页处理
const changePage = (page: number) => {
  goToPage(page)
  loadAvailablePhones()
}

const handlePageSizeChange = () => {
  goToPage(1)
  loadAvailablePhones()
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    operator_id: '',
    is_new: '',
    date_range: '',
    date_start: '',
    date_end: '',
    search: ''
  })
  loadAvailablePhones()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await Promise.all([
      loadAvailablePhones(false, true, false),
      loadStores(),
      loadOperators(),
      loadSuppliers(),
      loadBrands(),
      loadModels(),
      loadColors(),
      loadMemories()
    ])
    setDefaultOperator()
  })
  showSuccess('数据刷新成功', { duration: 2000 })
}

// GlobalSearch 事件处理方法
const handleGlobalSearch = async (query: string, filterValues: Record<string, any>) => {
  // 检查品牌是否发生变化
  const oldBrand = filters.brand
  const newBrand = filterValues.brand

  // 合并搜索参数到filters
  Object.assign(filters, filterValues)
  filters.search = query

  // 如果品牌发生变化，获取对应的型号列表
  if (oldBrand !== newBrand && newBrand) {
    await fetchBrandModels(newBrand)
  } else if (!newBrand) {
    // 如果品牌被清空，清空型号列表
    brandModels.value = []
  }

  // 执行搜索
  loadAvailablePhones()
}

// 移动端快速搜索
const handleQuickSearch = () => {
  // 执行搜索
  loadAvailablePhones()
}

// 清空快速搜索
const clearQuickSearch = () => {
  filters.search = ''
  loadAvailablePhones()
}

// 切换高级搜索显示状态
const toggleAdvancedSearch = () => {
  if (isMobile.value) {
    showAdvancedSearch.value = !showAdvancedSearch.value
  } else {
    showDesktopSearch.value = !showDesktopSearch.value
  }
}

// 简化搜索输入处理
const handleSimpleSearchInput = () => {
  // 将简化搜索的值同步到主搜索框
  filters.search = simpleSearchQuery.value
}

// 简化搜索处理
const handleSimpleSearch = () => {
  // 将简化搜索的值同步到主搜索框
  filters.search = simpleSearchQuery.value
  // 执行搜索
  loadAvailablePhones()
}

// 清空简化搜索
const clearSimpleSearch = () => {
  simpleSearchQuery.value = ''
  filters.search = ''
  // 重新加载数据
  loadAvailablePhones()
}

// 应用筛选条件
const applyFilters = () => {
  loadAvailablePhones()
}

const handleGlobalReset = () => {
  // 重置所有筛选条件
  Object.keys(filters).forEach(key => {
    filters[key] = ''
  })

  // 清空品牌型号联动数据
  brandModels.value = []

  // 重新加载数据
  loadAvailablePhones()
}

const handleFilterChange = (key: string, value: any) => {
  // 更新对应的筛选值
  if (key === 'batch') {
    // 批量更新
    Object.assign(filters, value)
  } else {
    filters[key] = value
  }

  // 处理品牌型号联动
  if (key === 'brand' || key === 'brand-changed') {
    const brandValue = key === 'brand-changed' ? value : value
    filters.model = ''

    // 获取该品牌对应的型号列表
    if (brandValue) {
      fetchBrandModels(brandValue)
    } else {
      brandModels.value = []
    }
  }

  // 重新加载数据以应用筛选条件
  loadAvailablePhones()
}

const PHONE_IMAGE_FALLBACK = '/placeholder-phone.svg'
const phonePlaceholderCache = new Map<string, string>()

const getPhonePlaceholderKey = (phone?: Partial<Phone> | null) => {
  if (!phone) {
    return 'default'
  }

  return [
    phone.brand,
    phone.model,
    phone.color,
    phone.memory
  ]
    .map(value => String(value || '').trim())
    .join('|')
}

// 无模板图时，生成基于品牌、型号、颜色、内存的SVG占位图
const generatePhonePlaceholderImage = (phone?: Partial<Phone> | null): string => {
  const cacheKey = getPhonePlaceholderKey(phone)
  const cachedImage = phonePlaceholderCache.get(cacheKey)
  if (cachedImage) {
    return cachedImage
  }

  // 使用新的占位图生成工具（横向布局）
  const imageData = generateProductPlaceholder({
    brand: phone?.brand || '',
    model: phone?.model || '',
    color: phone?.color || '',
    memory: phone?.memory || '',
    size: 320,
    layout: 'horizontal'
  })

  phonePlaceholderCache.set(cacheKey, imageData)
  return imageData
}

const getPhoneImageSrc = (phone?: Partial<Phone> | null) => {
  const imageUrl = typeof phone?.image_url === 'string' ? phone.image_url.trim() : ''
  return imageUrl || generatePhonePlaceholderImage(phone)
}

// 图片处理
const handleImageError = (event: Event, phone?: Partial<Phone> | null) => {
  const img = event.target as HTMLImageElement
  if (img.dataset.placeholderUsed === 'true') {
    return
  }

  img.dataset.placeholderUsed = 'true'
  img.src = generatePhonePlaceholderImage(phone)
}

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return '-'
    }
    // 统一显示年月日格式：2024-01-15
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    logger.error(`日期格式化错误: ${String(dateString)}`, error)
    return '-'
  }
}


// 分页处理函数 - Element Plus
const handleSizeChange = (val: number) => {
  setLimit(val)
  goToPage(1)
  loadAvailablePhones()
}

const handlePageChange = (val: number) => {
  goToPage(val)
  loadAvailablePhones()
}

// 新的统一分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  goToPage(page)
  setLimit(pageSize)
  loadAvailablePhones()
}

// 页面挂载
onMounted(async () => {
  window.addEventListener('tf2025:permissions:updated', handleSalesPermissionsUpdated)

  // 检测是否为移动设备并调整显示模式
  const checkMobile = () => {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  // 如果是移动设备，切换到图文模式
  if (checkMobile()) {
    viewMode.value = 'grid'
  } else {
    viewMode.value = 'table'
  }

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (checkMobile()) {
      viewMode.value = 'grid'
    } else {
      viewMode.value = 'table'
    }
  })

  try {
    // 使用统一的权限预加载系统
    permissionLoading.value = true
    await preloadPermissions()
      } catch (error) {
    logger.error('❌ 权限数据预加载失败:', error)
    showError('权限加载失败，请刷新页面重试')
  } finally {
    permissionLoading.value = false
  }

  // 权限检查：验证用户是否有销售页面访问权限
  if (!canView.value) {
    showError('您没有查看销售页面的权限，请联系管理员分配相关权限')
    // 可以选择重定向到无权限页面或首页
    return
  }

  // 开发环境：等待认证状态完全初始化，避免并发API调用导致的401重定向
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // 初始化统一字段权限（用户→角色→字段权限）
  await initFieldPermissions()

  // 先恢复本地筛选，避免首屏加载后又因恢复筛选再打一轮请求
  loadFiltersFromStorage()

  // 优先加载可用手机列表，让用户快速看到商品
  const initialPhoneLoad = loadAvailablePhones(false, true, false)

  // 在后台延后加载基础数据，避免首屏和商品列表抢占请求
  initialPhoneLoad.finally(() => {
    salesBaseDataWarmupTimer = setTimeout(() => {
      Promise.all([
        loadStores(),
        loadOperators(),
        loadSuppliers(),
        loadBrands(),
        loadModels(),
        loadColors(),
        loadMemories()
      ]).then(() => {
        setDefaultOperator()
      }).catch(error => {
        logger.error('❌ 基础数据加载失败:', error)
      })
    }, 800)
  })

  // 添加全局键盘事件监听器
  document.addEventListener('keydown', handleGlobalKeydown)
})

watch(
  () => [route.query.sale_phone_id, route.query.auto_open_sale, route.query.imei, route.query.preorder_id],
  ([phoneId, autoOpen, imei, preorderId]) => {
    // 处理从预定页面跳转过来的交付请求（通过IMEI查找）
    if (String(imei || '').trim() && String(preorderId || '').trim()) {
      handledRouteSalePhoneId.value = ''
      pagination.page = 1
      loadAvailablePhones(false, true, false)
    }
    // 处理原有的通过phone_id打开销售的方式
    else if (String(autoOpen || '') === '1' && String(phoneId || '').trim()) {
      handledRouteSalePhoneId.value = ''
      pagination.page = 1
      loadAvailablePhones(false, true, false)
    }
  }
)

// 页面卸载时清理事件监听器和定时器
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('tf2025:permissions:updated', handleSalesPermissionsUpdated)
  // 清理防抖定时器
  if (debounceTimer) clearTimeout(debounceTimer)
  if (inventorySummaryDebounceTimer) clearTimeout(inventorySummaryDebounceTimer)
  if (loadPhonesDebounceTimer) clearTimeout(loadPhonesDebounceTimer)
  if (searchTimer) clearTimeout(searchTimer)
  if (salesBaseDataWarmupTimer) clearTimeout(salesBaseDataWarmupTimer)
})
</script>

<style scoped>
.sales-view {
  padding: 24px;
  padding-bottom: 0; /* 覆盖全局的safe-area-bottom */
  background: #f8fafc;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  overflow-x: hidden;

  /* 移动端通用样式 - 适用于所有手机设备 */
  @media (max-width: 768px) {
    padding: 16px 0;
    height: 100vh;
    height: -webkit-fill-available; /* iOS Safari */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0; /* 确保所有移动设备都没有底部padding */

    /* 隐藏滚动条 */
    &::-webkit-scrollbar {
      display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* 小屏幕手机优化 */
  @media (max-width: 480px) {
    padding: 14px 0;
  }

  /* 超小屏幕手机优化 */
  @media (max-width: 375px) {
    padding: 12px 0;
  }
}

/* 限制内容区域最大宽度并居中 */
.sales-view > .content {
  max-width: 100%;
  width: 100%;
  margin: 0 auto;

  /* 针对所有移动设备的通用规则 */
  @media (hover: none) and (pointer: coarse) {
    padding-bottom: 0 !important;
  }

  /* 针对iOS Safari的特殊处理 */
  @supports (-webkit-touch-callout: none) {
    padding-bottom: 0 !important;
  }
}

/* 区域标题样式 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f8f9fa;
  cursor: pointer;
  user-select: none;
  position: relative;
}

.section-title:hover {
  opacity: 0.8;
}

.section-title .toggle-icon {
  margin-left: auto;
  transition: transform 0.3s ease;
}

.section-title .toggle-icon.expanded {
  transform: rotate(180deg);
}

.section-title i {
  color: #28a745;
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: #6c757d;
  font-weight: 400;
}

.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid #e8ecef;
  overflow: hidden; /* 防止内容溢出 */

  /* 移动端去除左右内边距，让内容占据全屏宽度 */
  @media (max-width: 768px) {
    padding: 16px 0;
    margin: 0 0 0 0; /* 移除所有间距 */
  }

  @media (max-width: 375px) {
    padding: 12px 0;
    margin: 0 0 0 0; /* 移除所有间距 */
  }
}



.input-group {
  position: relative;
  display: flex;
  align-items: stretch;
}

.input-group:has(.customer-lock-button) .form-control {
  flex: 1;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.input-group .btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
  min-width: 40px;
  padding: 10px 12px;
}

.customer-lock-button {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 !important;
  flex: 0 0 36px !important;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

.customer-lock-button :deep(.el-button__content) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.customer-lock-button i {
  font-size: 14px;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 14px;
  z-index: 1;
}

/* 输入框样式 */
input.form-control, textarea.form-control {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: #f8f9fa;
}

/* 下拉框样式 */
select.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: #f8f9fa;
  appearance: auto;
  cursor: pointer;
}

select.form-control:focus {
  outline: none;
  border-color: #28a745;
  background: white;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

/* 日期输入框样式 - 让时间检索框宽度自适应 */
input[type="date"].form-control {
  width: 100%;
  padding: 10px 12px; /* 简化padding，让日历图标正常显示 */
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: #f8f9fa;
  box-sizing: border-box;
  /* 移除 appearance: none，让浏览器默认日历选择器正常工作 */

  /* 自适应父容器宽度，不设置固定最小宽度 */
  min-height: 44px;

  /* 确保在所有浏览器中显示一致 */
  &::-webkit-date-and-time-value {
    text-align: left;
    color: #495057;
    padding: 0;
    margin: 0;
  }

  &:focus {
    outline: none;
    border-color: #28a745;
    background: white;
    box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
  }
}

input.form-control:focus, textarea.form-control:focus {
  outline: none;
  border-color: #28a745;
  background: white;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: relative;
  z-index: 5;
}

.search-main {
  flex: 1.5;
  min-width: 300px;
}

.search-filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  flex: 2;
  position: relative;
  z-index: 10;
}

.search-filters .input-group {
  width: 130px;
  min-width: 120px;
  position: relative;
}

.search-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

/* 紧凑模式下的小按钮 */
.btn-sm {
  padding: 16px 32px;
  font-size: 13px;
  font-weight: 500;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .search-filters .input-group {
    width: 120px;
    min-width: 110px;
  }
}

@media (max-width: 768px) {
  .search-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .search-main {
    min-width: auto;
    width: 100%;
    order: -1;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }

  .search-filters {
    flex-direction: column;
    width: 100%;
    order: 0;
  }

  .search-filters .input-group {
    width: 100%;
  }

  .search-actions {
    justify-content: flex-start;
    order: 1;
    display: flex;
    gap: 4px;
    margin-top: 0;
  }

  .search-actions .btn {
    flex: 1;
    min-width: 80px;
  }
}

/* 按钮样式 */
.btn {
  padding: 16px 32px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
  text-decoration: none;
}

.btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn:hover::before {
  width: 300px;
  height: 300px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline-secondary {
  /* 紫色渐变背景 - 与搜索按钮保持一致 */
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover:not(:disabled) {
  /* 悬停时增强效果 */
  background: linear-gradient(135deg, #7c8ef0, #8a5bb8);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transform: translateY(-1px);
}

.btn-outline-secondary:active:not(:disabled) {
  /* 点击时的按压效果 */
  background: linear-gradient(135deg, #5a6fd8, #6a4190);
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.btn-sm {
  padding: 14px 28px;
  font-size: 12px;
}

/* 统计卡片样式 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;

  /* 移动端调整 */
  @media (max-width: 768px) {
    margin: 0 0 16px 0;
    gap: 16px;
  }

  /* 小屏幕进一步优化 */
  @media (max-width: 480px) {
    margin: 0 0 12px 0;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    margin: 0 0 8px 0;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
}

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

  /* 移动端调整 */
  @media (max-width: 768px) {
    padding: 16px;
    gap: 12px;
  }

  /* 小屏幕优化 */
  @media (max-width: 480px) {
    padding: 12px;
    gap: 10px;
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    padding: 10px;
    gap: 8px;
  }
}

.stat-card:hover {
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
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.inactive {
  background: linear-gradient(135deg, #dc3545, #fd7e14);
}

.stat-content {
  flex: 1;
}

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

/* 视图控制 */
.view-controls {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

/* 批发/划拨按钮组 */
.wholesale-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 8px;
  border: 1px solid #dee2e6;

  .el-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    height: 32px;
    padding: 0 12px;
    position: relative;
    transition: all 0.3s ease;

    &.active {
      transform: translateY(-1px);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    }

    i {
      font-size: 14px;
    }

    span {
      font-size: 13px;
    }

    .badge {
      margin-left: 4px;
      font-size: 11px;
      opacity: 0.85;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;

      .badge {
        display: none;
      }
    }
  }
}

.view-toggle {
  display: flex;
  gap: 4px;

  .el-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.view-toggle-text {
  font-size: 13px;
}

.operation-tip {
  margin: 16px 0;
  animation: slideDown 0.3s ease;

  .operation-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;

    &.wholesale-mode {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 1px solid #81c784;
      color: #2e7d32;
    }

    &.proxy-mode {
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
      border: 1px solid #ffb74d;
      color: #e65100;
    }

    .operation-info {
      display: flex;
      align-items: center;
      gap: 10px;

      i {
        font-size: 18px;
      }
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  max-width: 100%;
  /* 确保横向滚动条正常显示 */
  -webkit-overflow-scrolling: touch;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;

    &:hover {
      background: #555;
    }
  }
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
}

.table th {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  padding: 16px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e8ecef;
}

.table td {
  padding: 16px 12px;
  border-bottom: 1px solid #f8f9fa;
  vertical-align: middle;
}

.table tbody tr {
  transition: all 0.2s ease;
}

.table tbody tr:hover {
  background: #f8f9fa;
}

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e8ecef;
}

.pagination-info {
  color: #6c757d;
  font-size: 14px;
}


.page-numbers {
  display: flex;
  gap: 4px;
}

/* 设备列表样式 */
.devices-grid {
  padding: 12px;

  /* 移动端去除左右内边距，让内容占据全屏宽度 */
  @media (max-width: 768px) {
    padding: 12px 0;
  }

  /* 小屏幕优化 */
  @media (max-width: 480px) {
    padding: 8px 0;
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    padding: 6px 0;
  }

  /* 隐藏滚动条 */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.loading-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #495057;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  width: 100%;

  /* 仅在移动端确保占据全宽 */
  @media (max-width: 768px) {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
    padding-left: 0;
    padding-right: 0;
    box-sizing: border-box;
  }

  /* 小屏幕优化 */
  @media (max-width: 480px) {
    padding-left: 0;
    padding-right: 0;
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    padding-left: 0;
    padding-right: 0;
  }
}

/* 移动端优化 - 更小的卡片 */
@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }

  /* 极小屏幕优化 - 小于360px */
  @media (max-width: 360px) {
    .grid-container {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 6px;
    }

    .device-card {
      border-radius: 8px;
    }
  }

  /* 超小屏幕优化 - 小于320px */
  @media (max-width: 320px) {
    .grid-container {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 4px;
    }
  }
}

.device-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  }

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #28a745;
}

.card-image {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.card-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-badges {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-new {
  background: rgba(40, 167, 69, 0.9);
  color: white;
}

.badge-used {
  background: rgba(255, 193, 7, 0.9);
  color: #333;
}

.badge-brand {
  background: rgba(102, 126, 234, 0.9);
  color: white;
}

.card-content {
  padding: 16px 20px;

  /* 移动端调整 */
  @media (max-width: 768px) {
    padding: 12px 14px;
  }

  /* 小屏幕优化 */
  @media (max-width: 480px) {
    padding: 12px;
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    padding: 10px 12px;
  }

  /* 隐藏滚动条 */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.device-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.device-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.device-title-row .device-title {
  margin: 0;
  min-width: 0;
  flex: 1;
}

.device-title-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.title-memory {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.title-price {
  color: #e67e22;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.device-specs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.spec-row-supplier-store {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(108px, 0.9fr);
  align-items: center;
}

.spec-row-imei-time {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(108px, 0.95fr);
  align-items: center;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  flex: 1;
  min-width: 0;
}

.spec-row .spec-item {
  justify-content: flex-start;
  gap: 4px;
}

.supplier-spec-item,
.store-spec-item {
  min-width: 0;
}

.spec-label {
  color: #6c757d;
  font-weight: 500;
  flex-shrink: 0;
}

.spec-value {
  color: #495057;
  font-weight: 500;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
  flex-wrap: nowrap;
}

.card-actions .btn,
.card-actions .el-button {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 4px 8px;
  margin: 0;
}

.card-actions .el-button :deep(.el-button__content) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f8f9fa;
}

.price-info {
  text-align: left;
}

.cost-price {
  font-size: 18px;
  font-weight: 700;
  color: #e74c3c;
}

.price-label {
  font-size: 12px;
  color: #6c757d;
  margin-top: 2px;
}

/* 表格特定样式 - 使用库存页面的现代表格样式 */
.devices-table {
  width: 100%;
  min-width: 1200px;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.devices-table th {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-right: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  position: relative;
  white-space: nowrap;
}

.devices-table th:last-child {
  border-right: none;
}

.devices-table th::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.devices-table td {
  padding: 6px 6px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  font-size: 13px;
  color: #2c3e50;
  font-weight: 500;
  text-align: center;
  position: relative;
  white-space: nowrap;
}

.devices-table td:last-child {
  border-right: none;
}

.devices-table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.devices-table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.devices-table tbody tr:hover {
  background: #e3f2fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.devices-table tbody tr:hover td {
  border-bottom-color: #dee2e6;
}

.image-cell {
  width: 60px;
}

.device-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-name {
  font-weight: 600;
  color: #2c3e50;
}

.device-code {
  font-size: 12px;
  color: #6c757d;
}

.device-specs-inline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.imei {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.8px;
  background: #f8f9fa;
  padding: 16px 20px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  display: inline-block;
  min-width: 120px;
  text-align: center !important;
  position: relative;
}

.imei:hover {
  background: #e9ecef;
  border-color: #dee2e6;
  transform: scale(1.02);
  transition: all 0.2s ease;
}

.condition-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.condition-badge.new {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.condition-badge.used {
  background: rgba(253, 126, 20, 0.1);
  color: #fd7e14;
}

/* 状态样式 - 参考综合查询页面 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px;
  color: #ffffff !important;
}

.status-badge.in-stock {
  background: #28a745 !important;
  color: #ffffff !important;
}

.status-badge.sold {
  background: #6c757d !important;
  color: #ffffff !important;
}

.status-badge.reserved {
  background: #17a2b8 !important;
  color: #ffffff !important;
}

.status-badge.repair {
  background: #f59e0b !important;
  color: #ffffff !important;
}

.status-badge.lost {
  background: #dc3545 !important;
  color: #ffffff !important;
}

.price-cell {
  font-weight: 600;
  color: #e74c3c;
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.empty-cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-cell-content i {
  font-size: 2rem;
  margin-bottom: 8px;
}

.loading-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.sale-layout {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 32px;
}

.device-info-section h4,
.sale-form-section h4 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.device-card.compact {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.device-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.device-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.device-details h5 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.device-details {
  min-width: 0;
}

.device-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: #f8f9fc;
  border: 1px solid #e9eef5;
  border-radius: 10px;
  font-size: 13px;
}

.meta-item-wide {
  grid-column: span 2;
}

.meta-label {
  color: #6c757d;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
}

.meta-value {
  color: #495057;
  font-weight: 600;
  line-height: 1.35;
  word-break: break-all;
}

.meta-value.price {
  color: #e74c3c;
  font-weight: 600;
}

.sale-mobile-device {
  min-width: 0;
}

.sale-mobile-device-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.sale-mobile-device-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.2);
}

.sale-mobile-device-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.sale-mobile-device-name,
.sale-mobile-device-specs {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sale-mobile-device-name {
  font-size: 15px;
  font-weight: 700;
}

.sale-mobile-device-specs {
  font-size: 13px;
  opacity: 0.92;
}

.sale-mobile-device-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sale-mobile-device-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(10px);
}

.sale-mobile-info-grid,
.sale-mobile-code-row,
.sale-mobile-spec-grid {
  display: grid;
  gap: 10px;
}

.sale-mobile-info-grid,
.sale-mobile-code-row,
.sale-mobile-spec-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sale-mobile-purchase-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sale-mobile-info-item,
.sale-mobile-code-item,
.sale-mobile-spec-item,
.sale-mobile-purchase-row {
  min-width: 0;
  padding: 11px 12px;
  border-radius: 14px;
  background: #f8f9fc;
  border: 1px solid #ebeef5;
}

.sale-mobile-info-label,
.sale-mobile-code-label,
.sale-mobile-spec-label,
.sale-mobile-purchase-label {
  display: block;
  font-size: 11px;
  color: #909399;
}

.sale-mobile-info-value,
.sale-mobile-spec-value,
.sale-mobile-purchase-value {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  word-break: break-word;
}

.sale-mobile-spec-price {
  color: #f56c6c;
  font-weight: 800;
  white-space: nowrap;
}

.sale-mobile-code-value {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
  font-family: 'Courier New', monospace;
  color: #303133;
  word-break: break-all;
}

.sale-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sale-dialog-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.sale-dialog-footer :deep(.el-button) {
  width: 100%;
  height: 44px;
  margin: 0;
  border-radius: 14px;
  font-size: 15px;
}

.sale-form-section :deep(.el-input),
.sale-form-section :deep(.el-select),
.sale-form-section :deep(.el-date-editor.el-input),
.sale-form-section :deep(.el-date-editor.el-input__wrapper) {
  width: 100%;
}

.sale-form-section :deep(.el-input__wrapper),
.sale-form-section :deep(.el-select__wrapper),
.sale-form-section :deep(.el-textarea__inner) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.sale-form-section :deep(.el-input__wrapper),
.sale-form-section :deep(.el-select__wrapper),
.sale-form-section :deep(.el-date-editor .el-input__wrapper) {
  min-height: 42px;
  padding: 1px 12px;
}

.sale-form-section :deep(.el-input__inner),
.sale-form-section :deep(.el-select__selected-item),
.sale-form-section :deep(.el-date-editor .el-input__inner) {
  font-size: 14px;
}

.sale-form-section :deep(.el-input__wrapper.is-focus),
.sale-form-section :deep(.el-select__wrapper.is-focused),
.sale-form-section :deep(.el-date-editor .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #7c3aed inset;
}

.sale-form-section :deep(.el-textarea__inner) {
  min-height: 88px;
  padding: 10px 12px;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.form-label.required::after {
  content: ' *';
  color: #dc3545;
}

.form-hint {
  font-size: 12px;
  color: #6c757d;
  margin-top: 4px;
  display: block;
  font-style: italic;
}

.current-user-badge {
  color: #28a745;
  font-weight: 600;
  font-size: 12px;
  margin-left: 8px;
}

/* 批量选择相关样式 */
.checkbox-column {
  width: 60px;
  text-align: center;
  padding: 8px 0;
}

/* 选中行的样式 */
.selected-row {
  background-color: #f0f9ff;
  border-color: #409eff;
}

/* Element Plus Checkbox 自定义样式 - 保持默认绿色 */
.checkbox-column :deep(.el-checkbox) {
  display: flex;
  justify-content: center;
}

/* 移除自定义颜色，使用 Element Plus 默认的绿色主题 */

.selection-info {
  display: inline-flex;
  align-items: center;
  padding: 16px 32px;
  background: #e8f5e8;
  border: 1px solid #28a745;
  border-radius: 6px;
  font-size: 14px;
  color: #155724;
  margin-left: 12px;
  font-weight: 600;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 批量设备列表样式 */
.batch-devices-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.device-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  transition: background-color 0.2s;
}

.device-item:last-child {
  border-bottom: none;
}

.device-item:hover {
  background-color: #f8f9fa;
}

.device-number {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  margin-right: 12px;
  flex-shrink: 0;
}

.batch-summary {
  margin-top: 16px;
  padding: 16px;
  background: #e3f2fd;
  border-radius: 8px;
  display: flex;
  justify-content: space-around;
  border-left: 4px solid #2196f3;
}

.batch-summary .summary-item {
  text-align: center;
}

.batch-summary .label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.batch-summary .value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.batch-summary .value.positive {
  color: #28a745;
}

.batch-summary .value.negative {
  color: #dc3545;
}

/* 批量选择按钮样式 */
.actions-cell .btn-warning {
  background-color: #ffc107;
  border-color: #ffc107;
  color: #212529;
}

.actions-cell .btn-warning:hover {
  background-color: #e0a800;
  border-color: #d39e00;
}

/* 批量销售表单样式 */
.batch-sale-form {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.form-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.sale-form-grid {
  padding: 24px;
}

.form-section {
  margin-bottom: 32px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h4 {
  margin: 0 0 20px 0;
  color: #495057;
  font-size: 16px;
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 2px solid #007bff;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}


.profit-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
  padding: 20px;
  background: #e9ecef;
  border-radius: 8px;
}

.profit-item {
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.profit-item .label {
  display: block;
  font-size: 13px;
  color: #6c757d;
  margin-bottom: 8px;
}

.profit-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.profit-item .value.positive {
  color: #28a745;
}

.profit-item .value.negative {
  color: #dc3545;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .profit-summary {
    grid-template-columns: 1fr;
  }

  /* 销售表单的按钮保持水平排列 */
  .sale-form .form-actions {
    flex-direction: row !important;
    justify-content: space-between;
    gap: 10px;
  }

  .sale-form .form-actions .btn {
    flex: 1;
    width: auto;
    height: 48px;
    font-size: 16px;
  }

  /* 批量销售表单的按钮也保持水平排列 */
  .batch-sale-form .form-actions {
    flex-direction: row !important;
    gap: 10px;
  }

  .batch-sale-form .form-actions .btn {
    flex: 1;
    width: auto;
  }

  /* 其他表单的按钮保持垂直排列 */
  .form-actions:not(.sale-form .form-actions):not(.batch-sale-form .form-actions) {
    flex-direction: column;
  }

  .form-actions:not(.sale-form .form-actions):not(.batch-sale-form .form-actions) .btn {
    width: 100%;
  }
}

.profit-calculator {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
}

.profit-calculator h5 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.profit-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.profit-row.total {
  padding-top: 8px;
  border-top: 1px solid #dee2e6;
  font-weight: 600;
  font-size: 16px;
}

.profit-row.margin {
  font-weight: 500;
}

.profit-row.positive {
  color: #28a745;
}

.profit-row.negative {
  color: #dc3545;
}

.profit-row.zero {
  color: #6c757d;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .filters-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .grid-container {
    grid-template-columns: 1fr;
  }

  .sale-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .device-card.compact {
    flex-direction: column;
    text-align: center;
  }

  .device-image {
    align-self: center;
  }
}

@media (max-width: 480px) {

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 20px;
  }

  .stat-value {
    font-size: 24px;
  }

  .card-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .action-buttons {
    justify-content: center;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .device-info-section h4,
  .sale-form-section h4 {
    color: #ffffff;
  }

  .device-card.compact {
    background: rgba(40, 40, 40, 0.8);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .device-details h5 {
    color: #ffffff;
  }

  .form-label {
    color: #ffffff;
  }

  .profit-calculator {
    background: rgba(40, 40, 40, 0.8);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .profit-calculator h5 {
    color: #ffffff;
  }
}

/* 操作按钮增强样式 */
.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.action-buttons .btn {
  min-width: 60px;
  height: 32px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
}

.action-buttons .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-buttons .btn i {
  font-size: 11px;
}

/* 出库按钮 - 绿色 */
.action-buttons .btn-success {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border-color: #28a745;
}

.action-buttons .btn-success:hover {
  background: linear-gradient(135deg, #218838, #1ea085);
  border-color: #1e7e34;
}

/* 按钮加载状态 */
.btn-loading {
  position: relative;
  pointer-events: none !important;
  cursor: not-allowed !important;
  opacity: 0.8 !important;
}

.btn-loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: inherit;
}

/* 编辑按钮 - 蓝色边框 */
.action-buttons .btn-outline-primary {
  background: white;
  color: #007bff;
  border-color: #007bff;
}

.action-buttons .btn-outline-primary:hover {
  background: #007bff;
  color: white;
  border-color: #0056b3;
}

/* 销售按钮 - 橙色/黄色 */
.action-buttons .btn-warning {
  background: linear-gradient(135deg, #ffc107, #fd7e14);
  color: #212529;
  border-color: #ffc107;
  font-weight: 600;
}

.action-buttons .btn-warning:hover {
  background: linear-gradient(135deg, #e0a800, #dc6502);
  border-color: #d39e00;
  color: white;
}

/* 删除按钮 - 红色 */
.action-buttons .btn-danger {
  background: linear-gradient(135deg, #dc3545, #e74c3c);
  color: white;
  border-color: #dc3545;
}

.action-buttons .btn-danger:hover {
  background: linear-gradient(135deg, #c82333, #c0392b);
  border-color: #bd2130;
}

/* 响应式设计 - 移动端优化 */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: row;
    gap: 4px;
    width: 100%;
    flex-wrap: wrap;
  }

  .action-buttons .btn {
    flex: 1;
    min-width: 60px;
    height: 28px;
    font-size: 11px;
    padding: 4px 8px;
  }

  .action-buttons .btn i {
    font-size: 10px;
  }

  /* 图文卡片中的按钮特殊优化 */
  .device-card .action-buttons {
    gap: 3px;
  }

  .device-card .action-buttons .btn {
    height: 26px;
    font-size: 10px;
    padding: 3px 6px;
    min-width: 50px;
  }

  .device-card .action-buttons .btn i {
    font-size: 9px;
  }
}

@media (max-width: 480px) {
  .action-buttons .btn {
    height: 30px;
    font-size: 12px;
    padding: 6px 10px;
  }

  .action-buttons .btn i {
    font-size: 11px;
  }

  /* 图文卡片中的按钮 */
  .device-card .action-buttons .btn {
    height: 28px;
    font-size: 11px;
    padding: 4px 8px;
  }

  .device-card .action-buttons .btn i {
    font-size: 10px;
  }
}

/* 客户搜索样式 */
.customer-search-container {
  position: relative;
}

.customer-search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1001;
  margin-top: 4px;
}

.search-loading {
  padding: 16px 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.customer-item {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.customer-item:hover {
  background-color: #f8f9fa;
}

.customer-item:last-child {
  border-bottom: none;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.customer-headline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.customer-subline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.customer-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.2;
  min-width: 0;
}

.customer-phone {
  color: #475569;
  font-size: 12px;
  line-height: 1.2;
}

.member-number {
  background: linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  justify-self: end;
}

.vip-badge {
  background: linear-gradient(135deg, #fb7185 0%, #f59e0b 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  flex-shrink: 0;
  justify-self: end;
  box-shadow: 0 6px 14px rgba(245, 158, 11, 0.18);
}

.vip-badge:empty {
  display: none;
}

.create-new-customer {
  padding: 16px 20px;
  background: #f8f9fa;
  color: #28a745;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.create-new-customer:hover {
  background: #e9ecef;
}

.create-new-customer i {
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .customer-search-results {
    max-height: 250px;
  }

  .customer-item {
    padding: 9px 10px;
  }

  .customer-name {
    font-size: 12px;
  }

  .customer-phone {
    font-size: 11px;
  }

  .customer-headline,
  .customer-subline {
    gap: 4px;
  }

  .customer-info {
    gap: 5px;
  }

  .member-number,
  .vip-badge {
    font-size: 8px;
    padding: 1px 5px;
    line-height: 1.1;
    white-space: nowrap;
  }

  .create-new-customer {
    padding: 10px 12px;
    font-size: 12px;
    gap: 6px;
  }

  .create-new-customer i {
    font-size: 12px;
  }
}

/* 特殊列样式 - 与库存页面保持一致 */
.devices-table td:nth-child(1), /* 供应商列 */
.devices-table td:nth-child(2), /* 品牌列 */
.devices-table td:nth-child(3) { /* 型号列 */
  font-weight: 600;
  color: #2c3e50;
  background: rgba(102, 126, 234, 0.03);
}

.devices-table td:nth-child(8), /* 入库价格列 */
.devices-table td:nth-child(13) { /* 店铺列 */
  font-weight: 600;
  color: #495057;
  background: rgba(40, 167, 69, 0.05);
}

.devices-table td:nth-child(9) { /* 入库员列 */
  font-weight: 500;
  color: #6c757d;
  font-style: italic;
}

/* ===== 桌面端搜索样式 ===== */
.desktop-search-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  overflow: hidden;
}

/* 简化搜索栏样式 */
.simple-search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease;
}

.simple-search-bar:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}

.simple-search-bar .search-input-wrapper {
  position: relative;
  flex: 1;
  max-width: 500px;
  cursor: text;
}

.simple-search-bar .search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 16px;
  z-index: 2;
  pointer-events: none;
}

.simple-search-input {
  width: 100%;
  height: 44px;
  padding: 0 48px 0 44px;
  border: none;
  border-radius: 22px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.95);
  color: #2c3e50;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.simple-search-input:focus {
  outline: none;
  background: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.simple-search-input::placeholder {
  color: #6c757d;
  font-style: italic;
}

.search-clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s ease;
  z-index: 2;
}

.search-clear-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #495057;
}

.expand-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  cursor: pointer;
}

.expand-indicator:hover {
  background: rgba(255, 255, 255, 0.3);
}

.advanced-search-content {
  background: white;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e8ecef;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 800px;
  }
}

.advanced-search-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8ecef;
}

.advanced-search-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.close-advanced {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-advanced:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #495057;
}

.advanced-search-body {
  padding: 20px;
}


/* ===== 移动端搜索样式 ===== */
.mobile-search-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
  padding: 16px;

  /* 超小屏幕优化 */
  @media (max-width: 480px) {
    padding: 10px;
    margin-bottom: 12px;
  }

  /* 极小屏幕优化 */
  @media (max-width: 360px) {
    padding: 8px;
    margin-bottom: 10px;
  }
}

.mobile-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;

  /* 超小屏幕优化 */
  @media (max-width: 480px) {
    gap: 6px;
  }

  /* 极小屏幕优化 */
  @media (max-width: 360px) {
    gap: 4px;
  }
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.mobile-search-input {
  width: 100%;
  height: 40px;
  padding: 0 40px 0 36px;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  font-size: 14px;
  background: #f5f7fa;

  &:focus {
    outline: none;
    border-color: #409eff;
    background: white;
  }
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #909399;
  z-index: 1;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #909399;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #606266;
    background: #f5f7fa;
  }
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 32px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;

  &:hover {
    border-color: #409eff;
    color: #409eff;
    background: #ecf5ff;
  }

  &.active {
    background: #409eff;
    color: white;
    border-color: #409eff;
  }

  i {
    font-size: 12px;
  }
}

.mobile-advanced-search {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.simple-filters {
  padding: 12px 0;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-select {
  flex: 1;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 14px;
  background: white;

  &:focus {
    outline: none;
    border-color: #409eff;
  }
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;

  .btn {
    flex: 1;
    height: 36px;
  }
}

.mobile-search {
  padding: 0 16px 16px;
  margin-bottom: 16px;
}

.drawer-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e8ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  h3 {
    margin: 0;
    font-size: 18px;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      color: #28a745;
    }
  }

  .close-btn {
    font-size: 18px;
    color: #6c757d;
    padding: 8px;

    &:hover {
      color: #dc3545;
    }
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  max-width: 500px; /* 限制内容最大宽度 */
  margin: 0 auto; /* 居中显示 */

  .filter-section {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    .section-title {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #495057;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: #28a745;
        width: 20px;
      }
    }

    .filter-group {
      .el-input,
      .el-select {
        margin-bottom: 12px;
      }
    }

    .filter-row {
      display: flex;
      gap: 8px;
    }
  }
}

.quick-actions {
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-top: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.mobile-search-trigger {
  padding: 0 16px 16px;

  .search-trigger-btn {
    height: 48px;
    font-size: 16px;
    position: relative;

    span {
      margin-left: 8px;
    }

    .filter-badge {
      position: absolute;
      top: 8px;
      right: 8px;
    }
  }
}

/* 触摸反馈优化 */
.drawer-wrapper {
  -webkit-overflow-scrolling: touch;
  -webkit-tap-highlight-color: transparent;
}

/* 移动端抽屉中的输入框样式优化 */
@media (max-width: 768px) {
  .drawer-content {
    max-width: none; /* 移动端允许占满宽度 */
    padding: 16px 20px; /* 减小内边距 */
  }

  .search-input-group {
    max-width: 100%; /* 移动端占满容器宽度 */
    margin-bottom: 12px;

    .search-input {
      height: 40px; /* 稍微小一点的高度 */
      font-size: 16px; /* 保持16px防止iOS缩放 */
    }
  }
}

/* 小屏幕手机优化 */
@media (max-width: 480px) {
  .drawer-content {
    padding: 16px 20px; /* 更小的内边距 */
  }

  .filter-section {
    padding: 12px;
  }
}

/* 抽屉中的搜索输入框样式 */
.search-input-group {
  position: relative;
  width: 100%;
  max-width: 400px; /* 限制最大宽度 */

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #909399;
    z-index: 1;
    font-size: 16px;
  }

  .search-input {
    width: 100%;
    height: 44px;
    padding: 0 40px 0 40px;
    border: 1px solid #DCDFE6;
    border-radius: 8px;
    font-size: 16px; /* Prevent iOS zoom */
    background: #fff;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #409EFF;
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    }

    &::placeholder {
      color: #C0C4CC;
    }
  }

  .search-clear {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #909399;
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    transition: color 0.2s;

    &:hover {
      color: #606266;
    }
  }
}

/* Combobox 组件样式 ===== */
.editable-select {
  position: relative;
  width: 100%;
  z-index: 100;
}

.editable-select .form-control {
  width: 100%;
  padding-right: 30px;
  padding-right: 60px;
}

.clear-icon {
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.clear-icon:hover {
  opacity: 1;
  color: #dc3545;
}

.dropdown-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.dropdown-icon:hover {
  opacity: 1;
  color: #495057;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  max-height: 200px;
  overflow-y: auto;
  z-index: 999999;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
  font-size: 14px;
  color: #495057;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
  color: #495057;
}

.dropdown-item.highlighted {
  background-color: #007bff;
  color: white;
}

.dropdown-item.new-item {
  background-color: #e3f2fd;
  color: #1976d2;
  font-weight: 500;
}

.dropdown-item.new-item:hover {
  background-color: #bbdefb;
}

.dropdown-item.new-item i {
  margin-right: 6px;
  font-size: 12px;
}

/* 滚动条样式 */
.dropdown-list::-webkit-scrollbar {
  width: 6px;
}

.dropdown-list::-webkit-scrollbar-track {
  background: #f8f9fa;
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: #dee2e6;
  border-radius: 3px;
}

.dropdown-list::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .dropdown-list {
    max-height: 150px;
  }

  .dropdown-item {
    padding: 8px 10px;
    font-size: 13px;
  }
}

/* ===== 加载状态样式 ===== */
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  gap: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ===== 统一权限提示样式 ===== */
.permission-denied {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(2px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.permission-denied-wrapper {
  width: 100%;
  max-width: 1200px;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

.permission-denied-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  text-align: center;
  width: 100%;
  max-width: 600px;
  border: 1px solid #e4e7ed;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 25%, #feca57 50%, #48dbfb 75%, #0abde3 100%);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
}

.permission-icon {
  margin-bottom: 2rem;

  i {
    font-size: 5rem;
    color: #f56c6c;
  }
}

.permission-content h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #303133;
  margin-bottom: 1rem;
}

.permission-message {
  font-size: 1.1rem;
  color: #606266;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.permission-status {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;

  &.has-menu {
    background-color: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;

    i {
      color: #0284c7;
    }
  }

  &.missing-view {
    background-color: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;

    i {
      color: #dc2626;
    }
  }
}

.permission-info {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;

  label {
    font-weight: 600;
    color: #495057;
    min-width: 100px;
  }

  .permission-name {
    color: #28a745;
    font-weight: 500;
  }

  .permission-code {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    color: #495057;
  }
}

.permission-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 2rem;

  i {
    color: #0284c7;
    margin-top: 0.25rem;
  }

  p {
    margin: 0;
    color: #0c4a6e;
    font-size: 0.95rem;
    line-height: 1.5;
  }
}

.permission-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.permission-details {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e4e7ed;

  h4 {
    font-size: 1.1rem;
    color: #303133;
    margin-bottom: 1rem;
  }
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.permission-tag {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 16px;
  font-size: 0.8rem;
  color: #6c757d;
  font-family: monospace;

  &.current-module {
    background: #e3f2fd;
    border-color: #2196f3;
    color: #1976d2;
    font-weight: 500;
  }
}

/* 编辑弹窗样式 */
.edit-phone-dialog {
  /* 信息卡片容器 */
  .info-cards-container {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .info-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .info-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }

  .card-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: white;
    flex-shrink: 0;
  }

  /* 彩色图标渐变 */
  .card-icon.brand {
    background: linear-gradient(135deg, #667eea, #764ba2);
  }

  .card-icon.model {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }

  .card-icon.color {
    background: linear-gradient(135deg, #ec4899, #db2777);
  }

  .card-icon.memory {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }

  .card-icon.serial {
    background: linear-gradient(135deg, #0891b2, #0e7490);
  }

  .card-icon.price {
    background: linear-gradient(135deg, #10b981, #059669);
  }

  .card-details {
    flex: 1;
    min-width: 0;
    width: 100%;
    text-align: center;
  }

  .card-label {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .card-primary-text {
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-primary-text.small-text {
    font-size: 11px;
    font-weight: 600;
  }

  /* 编辑表格容器 */
  .sales-edit-form-shell {
    background: white;
    border-radius: 12px;
    padding: 18px 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .sales-edit-form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 14px;
  }

  .sales-edit-field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #4b5563;
  }

  .sales-edit-imei-badge {
    margin-left: 8px;
    font-size: 12px;
    color: #10b981;
  }

  .sales-edit-imei-suffix,
  .sales-edit-imei-hint {
    font-size: 11px;
    color: #6b7280;
  }

  .sales-edit-imei-field,
  .sales-edit-remarks-field {
    grid-column: span 2;
  }

  .full-width {
    width: 100%;
  }
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .edit-phone-dialog {
    .info-cards-container {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .info-card {
      padding: 12px;
    }

    .card-icon {
      width: 36px;
      height: 36px;
      font-size: 16px;
    }

    .card-label {
      font-size: 9px;
    }

    .card-primary-text {
      font-size: 12px;
    }

    .sales-edit-form-shell {
      padding: 12px 10px;
      border-radius: 12px;
    }

    .sales-edit-form-grid {
      grid-template-columns: minmax(0, 0.92fr) minmax(0, 0.92fr) minmax(112px, 1.16fr);
      gap: 10px;
    }

    .sales-edit-field-label {
      font-size: 12px;
      margin-bottom: 5px;
    }

    .sales-edit-imei-field {
      grid-column: span 2;
    }

    .sales-edit-remarks-field {
      grid-column: 1 / -1;
    }

    .sales-edit-form-grid :deep(.el-input__wrapper),
    .sales-edit-form-grid :deep(.el-select__wrapper),
    .sales-edit-form-grid :deep(.el-date-editor .el-input__wrapper),
    .sales-edit-form-grid :deep(.el-input-number) {
      min-height: 36px;
    }

    .sales-edit-form-grid :deep(.el-input__inner),
    .sales-edit-form-grid :deep(.el-select__selected-item),
    .sales-edit-form-grid :deep(.el-date-editor .el-input__inner),
    .sales-edit-form-grid :deep(.el-textarea__inner),
    .sales-edit-form-grid :deep(.el-input-number .el-input__inner) {
      font-size: 13px;
    }

    .sales-edit-form-grid :deep(.el-textarea__inner) {
      min-height: 68px;
      padding: 8px 10px;
    }
  }
}

/* 库存统计表样式 */
.summary-table {
  border-collapse: separate;
  border-spacing: 0;
}

/* 库存统计表操作按钮区 */
.inventory-summary-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.summary-table .quantity-badge {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 15px;
  min-width: 40px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.summary-table .date-range {
  font-size: 13px;
  color: #6c757d;
  white-space: nowrap;
}

.summary-table tbody tr:hover {
  background: linear-gradient(90deg, #f8f9ff 0%, #fff 100%) !important;
}

/* 库存表行样式 */
.inventory-row {
  cursor: pointer;
  transition: all 0.2s ease;
}

.inventory-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 在库天数样式 */
.days-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
}

.days-normal {
  background: #e8f5e9;
  color: #2e7d32;
}

.days-caution {
  background: #fff3e0;
  color: #e65100;
}

.days-warning {
  background: #fff8e1;
  color: #f57f17;
}

.days-critical {
  background: #ffebee;
  color: #c62828;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 内存徽章样式 */
/* 内存标签样式 - 重新设计 */
.memory-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.memory-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
}

/* 1TB+ - 深紫色渐变 */
.memory-1tb {
  background: linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%);
  color: white;
  border-color: #6D28D9;
}

/* 512GB - 橙红色渐变 */
.memory-512gb {
  background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
  color: white;
  border-color: #F87171;
}

/* 256GB - 亮蓝色渐变 */
.memory-256gb {
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  color: white;
  border-color: #22D3EE;
}

/* 128GB - 翠绿色渐变 */
.memory-128gb {
  background: linear-gradient(135deg, #047857 0%, #10B981 100%);
  color: white;
  border-color: #34D399;
}

/* 64GB - 金黄色渐变 */
.memory-64gb {
  background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%);
  color: white;
  border-color: #FBBF24;
}

/* 32GB及以下 - 灰蓝色 */
.memory-small {
  background: linear-gradient(135deg, #64748B 0%, #94A3B8 100%);
  color: white;
  border-color: #CBD5E1;
}

/* 其他/未知 */
.memory-other {
  background: linear-gradient(135deg, #CBD5E1 0%, #E2E8F0 100%);
  color: #475569;
  border-color: #E2E8F0;
}

/* 库存明细弹窗样式 */
.inventory-detail-modal :deep(.el-dialog__body) {
  padding: 20px;
}

.inventory-detail-content {
  padding: 8px 0;
}

/* 汇总卡片区域 - 6个卡片一行展示 */
.detail-summary-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  background: white;
  border-radius: 12px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid #e8ecef;
  cursor: default;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.summary-card.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

.summary-card.highlight .card-label {
  color: rgba(255, 255, 255, 0.9);
}

.summary-card.highlight .card-value {
  color: white;
}

.summary-card.warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-color: #f5576c;
}

.summary-card.warning .card-label {
  color: rgba(255, 255, 255, 0.9);
}

.summary-card.warning .card-value {
  color: white;
}

/* 最长在库天数卡片样式 - 根据天数显示不同颜色 */
.summary-card.days-green {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  border-color: #28a745;
}

.summary-card.days-green .card-label {
  color: rgba(255, 255, 255, 0.9);
}

.summary-card.days-green .card-value {
  color: white;
}

.summary-card.days-yellow {
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  border-color: #ffc107;
}

.summary-card.days-yellow .card-label {
  color: rgba(255, 255, 255, 0.95);
}

.summary-card.days-yellow .card-value {
  color: white;
}

.summary-card.days-red {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-color: #f5576c;
}

.summary-card.days-red .card-label {
  color: rgba(255, 255, 255, 0.9);
}

.summary-card.days-red .card-value {
  color: white;
}

.summary-card .card-label {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
  text-align: center;
  font-weight: 500;
}

.summary-card .card-value {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
  text-align: center;
}

/* 表格区域 */
.detail-table-wrapper {
  margin-bottom: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.detail-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.record-count {
  font-size: 13px;
  color: #6c757d;
}

.detail-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.record-count {
  font-size: 14px;
  color: #6c757d;
  background: #f8f9fa;
  padding: 6px 14px;
  border-radius: 12px;
}

/* 库存明细表格 - 使用与综合查询相同的devices-table样式 */
/* 移除detail-table的覆盖样式，使用devices-table的基础样式 */

/* 优先列样式 */
.priority-column {
  text-align: center;
  white-space: nowrap;
}

/* 库存明细表格禁用滚动条 */
.inventory-detail-modal .table-responsive {
  overflow-x: auto !important;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  max-height: calc(100vh - 400px);
  width: 100%;
}

.inventory-detail-modal .detail-table-wrapper {
  overflow: visible;
  margin: 0;
  padding: 0;
  max-height: calc(100vh - 400px);
  width: 100%;
}

/* 库存明细表格紧凑样式 */
.inventory-detail-modal .devices-table {
  min-width: 100%;
  width: 100%;
  table-layout: auto;
  font-size: 13px;
}

.inventory-detail-modal .devices-table th {
  padding: 10px 6px;
  font-size: 12px;
  white-space: nowrap;
}

.inventory-detail-modal .devices-table td {
  padding: 10px 6px;
  font-size: 13px;
  white-space: normal;
  word-wrap: break-word;
}

/* 优化各列宽度 - 使用最小宽度确保内容完整显示 */
.inventory-detail-modal .priority-column {
  min-width: 55px;
  width: auto;
}

.inventory-detail-modal .imei-cell {
  min-width: 160px;
  width: auto;
  font-size: 12px;
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
  max-width: none;
}

.inventory-detail-modal .sn-cell {
  min-width: 140px;
  width: auto;
  font-size: 12px;
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
  max-width: none;
}

/* 型号列 */
.inventory-detail-modal .devices-table td:nth-of-type(4) {
  min-width: 90px;
  width: auto;
}

/* 颜色列 */
.inventory-detail-modal .devices-table td:nth-of-type(5) {
  min-width: 55px;
  width: auto;
}

/* 内存列 */
.inventory-detail-modal .devices-table td:nth-of-type(6) {
  min-width: 55px;
  width: auto;
}

/* 价格列 */
.inventory-detail-modal .devices-table td:nth-of-type(7) {
  min-width: 75px;
  width: auto;
}

/* 入库时间列 */
.inventory-detail-modal .devices-table td:nth-of-type(8) {
  min-width: 100px;
  width: auto;
  font-size: 12px;
}

/* 在库天数列 */
.inventory-detail-modal .devices-table td:last-child {
  min-width: 65px;
  width: auto;
}

/* 库存明细模态框中的优先徽章紧凑样式 */
.inventory-detail-modal .priority-badge {
  padding: 3px 8px;
  font-size: 11px;
  gap: 3px;
}

.inventory-detail-modal .priority-badge i {
  font-size: 10px;
}

.inventory-detail-modal .priority-rank {
  font-size: 12px;
}

.inventory-detail-modal .days-badge {
  padding: 3px 8px;
  font-size: 11px;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 12px;
  animation: pulse-priority 2s ease-in-out infinite;
}

@keyframes pulse-priority {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.6);
  }
}

.priority-rank {
  display: inline-block;
  background: #e9ecef;
  color: #6c757d;
  padding: 4px 8px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  min-width: 24px;
}

/* 优先行高亮 */
.priority-row {
  background: linear-gradient(90deg, #fff5f5 0%, #fff 50%, #fff5f5 100%) !important;
  border-left: 3px solid #ff6b6b;
}

.priority-row td {
  font-weight: 600;
}

/* 平板端适配 - 4列布局 */
@media (max-width: 1024px) and (min-width: 769px) {
  .detail-summary-cards {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .summary-card {
    padding: 10px 6px;
  }

  .summary-card .card-label {
    font-size: 11px;
  }

  .summary-card .card-value {
    font-size: 15px;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .view-controls {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .wholesale-actions {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    flex-wrap: nowrap;

    :deep(.el-divider) {
      display: none;
    }

    .el-button {
      flex: 1;
      min-width: 0;
      margin: 0;
      justify-content: center;
      padding: 0 6px;
      height: 30px;
      min-height: 30px;
      font-size: 11px;

      i {
        font-size: 11px;
      }

      span {
        font-size: 11px;
      }

      .badge {
        font-size: 10px;
        margin-left: 2px;
      }
    }
  }

  .view-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 4px;
    flex-wrap: nowrap;

    .el-button {
      flex: 1;
      min-width: 0;
      margin: 0;
      justify-content: center;
      padding: 0 6px;
      height: 30px;
      min-height: 30px;

      i {
        font-size: 11px;
      }
    }
  }

  .view-toggle-text {
    font-size: 11px;
  }

  .detail-summary-cards {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px;
  }

  .summary-card {
    padding: 8px 4px;
  }

  .summary-card .card-label {
    font-size: 10px;
  }

  .summary-card .card-value {
    font-size: 13px;
  }

  .summary-card.highlight .card-value,
  .summary-card.warning .card-value {
    font-size: 16px;
  }

  .detail-table-wrapper {
    padding: 12px;
  }

  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  /* 移动端弹窗宽度 */
  .inventory-detail-modal :deep(.el-dialog) {
    width: 95% !important;
  }
}

@media (max-width: 480px) {
  .view-controls {
    gap: 4px;
  }

  .wholesale-actions {
    gap: 3px;

    .el-button {
      height: 28px;
      min-height: 28px;
      padding: 0 4px;
      font-size: 10px;

      i {
        font-size: 10px;
      }

      span {
        font-size: 10px;
      }
    }
  }

  .view-toggle {
    gap: 3px;

    .el-button {
      height: 28px;
      min-height: 28px;
      padding: 0 4px;

      i {
        font-size: 10px;
      }
    }
  }

  .view-toggle-text {
    font-size: 10px;
  }

  .detail-summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ===== 销售模态框移动端优化 ===== */
@media (max-width: 767px) {
  /* 模态框主体 */
  .modal-body {
    padding: 10px 8px;
    max-height: calc(90vh - 60px);
  }

  /* 布局优化：改为单列 */
  .sale-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  /* 设备信息区域 */
  .device-info-section h4,
  .sale-form-section h4 {
    font-size: 15px;
    margin-bottom: 16px;
  }

  /* 设备卡片优化 */
  .device-card.compact {
    padding: 8px 0 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .device-details h5 {
    font-size: 13px;
    text-align: left;
    margin-bottom: 0;
  }

  .sale-mobile-device-card {
    gap: 8px;
  }

  .sale-mobile-device-head {
    padding: 10px 12px;
    border-radius: 14px;
  }

  .sale-mobile-device-main {
    gap: 6px;
  }

  .sale-mobile-device-name {
    font-size: 14px;
  }

  .sale-mobile-device-specs {
    font-size: 12px;
  }

  .sale-mobile-device-tag {
    min-height: 24px;
    padding: 0 8px;
    font-size: 11px;
  }

  .sale-mobile-info-grid,
  .sale-mobile-code-row,
  .sale-mobile-purchase-grid {
    gap: 8px;
  }

  .sale-mobile-info-item,
  .sale-mobile-code-item,
  .sale-mobile-purchase-row {
    padding: 10px;
    border-radius: 12px;
  }

  .sale-mobile-info-label,
  .sale-mobile-code-label,
  .sale-mobile-purchase-label {
    font-size: 10px;
  }

  .sale-mobile-info-value,
  .sale-mobile-purchase-value {
    font-size: 12px;
  }

  .sale-mobile-code-value {
    font-size: 11px;
  }

  /* 批量设备列表优化 */
  .batch-devices-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .device-item.compact {
    padding: 10px;
  }

  .device-number {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }

  .device-item .device-image {
    width: 40px;
    height: 40px;
  }

  .device-name {
    font-size: 13px;
  }

  .device-specs .spec-item {
    font-size: 11px;
  }

  /* 批量统计信息 */
  .batch-summary {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
  }

  .batch-summary .summary-item {
    font-size: 13px;
  }

  /* 表单优化 */
  .sale-form {
    display: flex;
    flex-direction: column;
  }

  .sale-dialog-footer {
    gap: 8px;
  }

  .sale-dialog-footer :deep(.el-button) {
    height: 42px;
    border-radius: 12px;
    font-size: 14px;
  }

  .sale-form-section :deep(.el-input__wrapper),
  .sale-form-section :deep(.el-select__wrapper),
  .sale-form-section :deep(.el-date-editor .el-input__wrapper) {
    min-height: 40px;
    padding: 1px 10px;
  }

  .sale-form-section :deep(.el-input__inner),
  .sale-form-section :deep(.el-select__selected-item),
  .sale-form-section :deep(.el-date-editor .el-input__inner),
  .sale-form-section :deep(.el-textarea__inner) {
    font-size: 13px;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px;
  }

  .form-group {
    margin-bottom: 4px;
    min-width: 0;
  }

  .form-label {
    font-size: 13px;
    margin-bottom: 6px;
  }

  .form-control {
    font-size: 14px;
    padding: 10px 12px;
  }

  /* 客户搜索结果优化 */
  .customer-search-results {
    max-height: 180px;
  }

  .customer-item {
    padding: 10px;
  }

  .customer-name {
    font-size: 14px;
  }

  .customer-phone {
    font-size: 12px;
  }

  .create-new-customer {
    font-size: 13px;
    padding: 10px;
  }

  /* 利润计算器优化 */
  .profit-calculator {
    padding: 12px;
    margin-top: 16px;
  }

  .profit-calculator h5 {
    font-size: 13px;
    margin-bottom: 12px;
  }

  .profit-rows {
    gap: 6px;
  }

  .profit-row {
    font-size: 13px;
  }

  .profit-row.total {
    font-size: 15px;
    padding-top: 10px;
  }

  /* 表单按钮优化 */
  .form-actions {
    position: sticky;
    bottom: 0;
    background: white;
    padding: 12px 0;
    margin: 16px -16px 0;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    gap: 10px;
  }

  .form-actions .el-button {
    flex: 1;
    height: 44px;
    font-size: 15px;
    margin: 0;
  }

  /* 小提示文字 */
  .form-hint {
    font-size: 11px;
  }

  /* 输入组优化 */
  .input-group {
    display: flex;
    gap: 6px;
  }

  .input-group .form-control {
    flex: 1;
  }

  .input-group .el-button {
    flex-shrink: 0;
  }

  .customer-lock-button {
    width: 32px !important;
    min-width: 32px !important;
    height: 32px !important;
    flex-basis: 32px !important;
  }

  .customer-lock-button i {
    font-size: 13px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .form-label {
    font-size: 12px;
  }

  .form-control {
    font-size: 13px;
    padding: 9px 11px;
  }

  .device-meta {
    font-size: 11px;
  }

  .meta-label {
    min-width: 55px;
    font-size: 10px;
  }

  .meta-value {
    font-size: 11px;
  }

  .profit-row {
    font-size: 12px;
  }

  .profit-row.total {
    font-size: 14px;
  }

  .form-actions .el-button {
    height: 42px;
    font-size: 14px;
  }
}
</style>

<!-- 非 scoped 样式：修复 el-select 下拉菜单问题 -->
<style lang="scss">
/* 确保机况选择器的下拉菜单正常显示 */
.condition-select-dropdown {
  z-index: 9999 !important;
}

.sales-sale-dialog-popper {
  z-index: 4001 !important;
}

.sales-sale-dialog,
.sales-edit-dialog,
.inventory-detail-modal {
  --dialog-vertical-gap: 24px;
}

.sales-edit-dialog {
  --dialog-side-gap: 4px;
  --dialog-max-width: calc(100vw - 8px);
  --mobile-dialog-body-padding: 8px 4px 8px;
  --mobile-dialog-footer-padding: 0 4px 4px;
}

.sales-sale-dialog .el-dialog {
  margin: auto !important;
  width: min(1000px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 24px !important;
  overflow: hidden;
}

.sales-sale-dialog .el-dialog__body {
  padding: 0 !important;
}

.sales-edit-dialog .el-dialog {
  margin: auto !important;
  width: min(900px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 24px !important;
  overflow: hidden;
}

.sales-edit-dialog .el-dialog__body {
  padding: 28px !important;
  background: #ffffff !important;
}

.sales-edit-dialog .el-dialog__footer {
  padding: 18px 28px 28px !important;
  background: #ffffff !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
}

.inventory-detail-modal .el-dialog {
  margin: auto !important;
  width: min(1200px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 24px !important;
  overflow: hidden;
}

.inventory-detail-modal .el-dialog__body {
  padding: 16px !important;
  background: #ffffff !important;
}

@media (max-width: 767px) {
  .sales-sale-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .mobile-dialog-sheet-overlay.sales-sale-dialog {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.sales-sale-dialog .mobile-dialog-sheet-body,
  .mobile-dialog-sheet-panel.sales-sale-dialog .mobile-dialog-sheet-footer {
    padding: 0 !important;
  }

  .sales-edit-dialog .el-dialog,
  .inventory-detail-modal .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .mobile-dialog-sheet-overlay.sales-edit-dialog,
  .mobile-dialog-sheet-overlay.inventory-detail-modal {
    padding: 8px 4px !important;
  }

  .sales-edit-dialog .el-dialog__body {
    padding: 8px 4px !important;
  }

  .sales-edit-dialog .el-dialog__footer,
  .inventory-detail-modal .el-dialog__footer {
    padding: 0 4px 4px !important;
  }

  .mobile-dialog-sheet-panel.sales-edit-dialog .mobile-dialog-sheet-body {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.sales-edit-dialog .mobile-dialog-sheet-footer,
  .mobile-dialog-sheet-panel.inventory-detail-modal .mobile-dialog-sheet-footer {
    padding: 0 4px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-detail-modal .mobile-dialog-sheet-body {
    padding: 4px !important;
  }
}

</style>

<style scoped lang="scss">
/* PC端图文模式按钮优化 */
@media (min-width: 769px) {
  .device-card .card-actions {
    gap: 4px;
  }

  .device-card .card-actions .btn {
    min-height: 30px;
    font-size: 12px;
    padding: 6px 10px;
  }

  .device-card .card-actions .btn i {
    font-size: 11px;
  }
}

/* ===== PC端图文模式按钮优化 ===== */
/* 图文卡片中的 el-button 优化 */
@media (min-width: 769px) {
  .device-card .card-actions {
    display: flex;
    gap: 4px;
    padding-top: 6px;
    flex-wrap: nowrap;
  }

  /* 减小 el-button 的尺寸 */
  .device-card .card-actions .el-button {
    height: 28px !important;
    min-height: 28px !important;
    padding: 4px 8px !important;
    font-size: 11px !important;
  }

  /* 减小图标大小 */
  .device-card .card-actions .el-button i {
    font-size: 11px !important;
  }

  /* 减小按钮内部间距 */
  .device-card .card-actions .el-button :deep(.el-button__content) {
    gap: 3px !important;
  }
}

/* ===== 手机端图文卡片和表格优化 ===== */
@media (max-width: 767px) {
  /* 图文卡片容器优化 */
  .grid-container {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 0;
  }

  /* 图文卡片优化 */
  .device-card {
    border-radius: 8px;
    overflow: hidden;
  }

  .card-image {
    height: 200px;
  }

  .card-badges {
    top: 8px;
    right: 8px;
    left: auto;
    align-items: flex-end;
    gap: 4px;
  }

  .card-badges .badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .card-body {
    padding: 12px;
  }

  .card-title {
    font-size: 14px;
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .card-meta {
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .card-meta .meta-item {
    font-size: 11px;
    padding: 2px 6px;
  }

  .card-specs {
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .card-specs .spec-item {
    font-size: 11px;
  }

  /* 卡片按钮区域优化 */
  .card-actions {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    padding: 8px 12px;
    margin: 0;
    border-top: 1px solid #f0f0f0;
  }

  .card-actions .el-button {
    flex: 1 !important;
    min-width: 0 !important;
    max-width: none !important;
    height: 32px !important;
    padding: 4px 6px !important;
    font-size: 11px !important;
    margin: 0 !important;
  }

  .card-actions .el-button i {
    font-size: 10px !important;
    margin-right: 2px;
  }

  .card-actions .el-button :deep(.el-button__content) {
    gap: 2px !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 卡片底部信息优化 */
  .card-footer {
    padding: 10px 12px;
    gap: 8px;
  }

  .price-info {
    flex: 1;
  }

  .cost-price {
    font-size: 16px;
  }

  .price-label {
    font-size: 11px;
  }

  .stock-status {
    font-size: 11px;
  }

  /* 表格模式优化 */
  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modern-table {
    min-width: 600px;
    font-size: 12px;
  }

  .modern-table thead th {
    padding: 10px 8px;
    font-size: 11px;
    white-space: nowrap;
  }

  .modern-table tbody td {
    padding: 10px 8px;
    font-size: 11px;
  }

  /* 表格中的操作按钮 */
  .modern-table .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    justify-content: flex-start;
  }

  .modern-table .action-buttons .btn {
    min-width: 40px !important;
    height: 26px !important;
    font-size: 10px !important;
    padding: 3px 6px !important;
  }

  .modern-table .action-buttons .btn i {
    font-size: 9px !important;
  }

  /* 批量模式选择框 */
  .device-checkbox {
    width: 18px;
    height: 18px;
  }

  /* 统计卡片优化 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .card-image {
    height: 188px;
  }

  .card-title {
    font-size: 13px;
  }

  .card-meta .meta-item,
  .card-specs .spec-item {
    font-size: 10px;
  }

  .card-actions .el-button {
    font-size: 10px !important;
    height: 30px !important;
  }

  .modern-table {
    font-size: 11px;
  }

  .modern-table thead th {
    padding: 8px 6px;
    font-size: 10px;
  }

  .modern-table tbody td {
    padding: 8px 6px;
    font-size: 10px;
  }
}
</style>
