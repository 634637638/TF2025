<template>
  <div class="supplier-phone-payments-view admin-page">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="payments"
      module-name="供应商打款"
      permission-code="supplier-payments:view"
    />

    <!-- 权限验证通过后的内容 -->
    <div v-else class="admin-page-content">
    <PageHeader title="货款结算">
      <template #actions>
        <ImportExportActions
          :can-export="canExportPayment"
          :export-loading="exportingPaymentPhones"
          export-label="导出"
          export-loading-label="导出中..."
          export-icon-class="fas fa-file-excel"
          export-type="success"
          @export="exportPaymentPhones"
        />
        <el-button type="info" @click="refreshData" :disabled="loading">
          <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 统计卡片 - 重新设计 -->
    <div v-if="showPaymentStatsCards" class="stats-cards">
      <!-- 主要统计 - 3个关键指标 -->
      <div v-if="canViewPaymentField('stats_unpaid_count')" class="stat-card stat-card-unpaid">
        <div class="stat-icon-primary unpaid-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">待打款</div>
            <div class="stat-value-primary">{{ currentUnpaidCount || 0 }}台</div>
          </div>
          <div v-if="showPaymentStatsAmount" class="stat-sub">金额 ¥{{ formatAmount(currentUnpaidAmount || 0) }}</div>
        </div>
      </div>

      <div v-if="canViewPaymentField('stats_paid_count')" class="stat-card stat-card-paid">
        <div class="stat-icon-primary paid-icon">
          <i class="fas fa-check-double"></i>
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">已打款</div>
            <div class="stat-value-primary">{{ currentPaidCount || 0 }}台</div>
          </div>
          <div v-if="showPaymentStatsAmount" class="stat-sub">金额 ¥{{ formatAmount(currentPaidAmount || 0) }}</div>
        </div>
      </div>

      <div v-if="canViewPaymentField('stats_total_count')" class="stat-card stat-card-total">
        <div class="stat-icon-primary total-icon">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">手机总数</div>
            <div class="stat-value-primary">{{ currentTotalCount || 0 }}台</div>
          </div>
          <div v-if="showPaymentStatsAmount" class="stat-sub">金额 ¥{{ formatAmount(currentTotalAmount || 0) }}</div>
        </div>
      </div>

      <div v-if="canViewPaymentField('supplier_name')" class="stat-card stat-card-supplier">
        <div class="stat-icon-primary supplier-icon">
          <i class="fas fa-truck-loading"></i>
        </div>
        <div class="stat-content">
          <div class="stat-main-line">
            <div class="stat-label">供应商</div>
            <div class="stat-value-primary">{{ currentSupplierCount || 0 }}家</div>
          </div>
          <div class="stat-sub">{{ currentSupplierMeta }}</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      :loading="loading"
      @search="handleFilterChange"
      @reset="resetFilters"
    >
      <template #primary>
        <el-input
          v-if="showPaymentSearchKeyword"
          v-model="filters.keyword"
          @keyup.enter="handleFilterChange"
          @clear="clearKeyword"
          placeholder="搜索 IMEI、序列号、品牌、型号"
          clearable
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div v-if="canViewPaymentField('supplier_name')" class="form-group filter-item" data-field="supplier">
          <el-select
            v-model="filters.supplier_id"
            @change="handleFilterChange"
            @clear="handleFilterChange"
            placeholder="供应商"
            clearable
            filterable
          >
            <el-option
              v-for="stat in statistics"
              :key="stat.supplier_id"
              :label="`${stat.supplier_name} (待打款${stat.unpaid_count}台)`"
              :value="stat.supplier_id"
            />
          </el-select>
      </div>

      <div v-if="canViewPaymentField('sale_status')" class="form-group filter-item" data-field="sale_status">
          <el-select
            v-model="filters.sale_status"
            @change="handleFilterChange"
            @clear="handleFilterChange"
            placeholder="销售状态"
            clearable
          >
            <el-option label="全部" value="all" />
            <el-option label="已售" value="sold" />
            <el-option label="在库" value="stock" />
          </el-select>
      </div>

      <div v-if="canViewPaymentField('payment_status')" class="form-group filter-item" data-field="payment_status">
          <el-select
            v-model="filters.payment_status"
            @change="handleFilterChange"
            @clear="handleFilterChange"
            placeholder="打款状态"
            clearable
          >
            <el-option label="全部" value="all" />
            <el-option label="未打款" value="unpaid" />
            <el-option label="已打款" value="paid" />
          </el-select>
      </div>

      <div v-if="canViewPaymentField('store_name')" class="form-group filter-item" data-field="store">
          <el-select
            v-model="filters.store_id"
            @change="handleFilterChange"
            @clear="handleFilterChange"
            placeholder="店铺"
            clearable
            filterable
          >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
          </el-select>
      </div>

      <div v-if="canViewPaymentField('sale_time')" class="form-group filter-item" data-field="start_date">
          <el-date-picker
            v-model="filters.start_date"
            type="date"
            placeholder="开始日期"
            format="YYYY-M-D"
            value-format="YYYY-M-D"
            :clearable="true"
            @change="handleFilterChange"
          />
      </div>

      <div v-if="canViewPaymentField('sale_time')" class="form-group filter-item" data-field="end_date">
          <el-date-picker
            v-model="filters.end_date"
            type="date"
            placeholder="结束日期"
            format="YYYY-M-D"
            value-format="YYYY-M-D"
            :clearable="true"
            @change="handleFilterChange"
          />
      </div>
    </UnifiedSearchPanel>

    <!-- 数据表格区域 -->
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <div class="title-main">
          <i class="fas fa-list"></i>
          <span class="title-text">手机列表</span>
        </div>
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>
      <div class="selected-info" v-if="selectedPhones.length > 0">
        <div class="selected-summary">
          <span class="selected-count">已选择 {{ selectedPhones.length }} 台手机</span><span v-if="canViewPaymentField('purchase_cost')" class="selected-amount">总计: ¥{{ Number(selectedTotalAmount || 0) }}</span>
        </div>
        <el-button
          type="danger"
          class="selected-action-btn selected-action-btn-danger"
          @click="clearSelection"
        >
          <i class="fas fa-times"></i> 清空选择
        </el-button>
        <el-button
          v-if="canCreatePayment && canViewPaymentField('actions')"
          type="primary"
          class="selected-action-btn selected-action-btn-primary"
          @click="handleOpenBatchPaymentDialog"
        >
          <i class="fas fa-money-bill-wave"></i>
          批量打款
        </el-button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
        <thead>
          <tr>
            <th width="60">
              <input
                type="checkbox"
                v-model="selectAll"
                @change="handleSelectAll"
                :disabled="phones.length === 0"
              />
            </th>
            <th width="60">序号</th>
            <th v-if="shouldShowPaymentColumn('supplier_name')" class="col-supplier">供应商</th>
            <th v-if="shouldShowPaymentColumn('store_name')">店铺</th>
            <th v-if="shouldShowPaymentColumn('brand_name')">品牌</th>
            <th v-if="shouldShowPaymentColumn('model_name')" class="col-model">型号</th>
            <th v-if="shouldShowPaymentColumn('color_name')" class="col-color">颜色</th>
            <th v-if="shouldShowPaymentColumn('memory_name')" class="col-memory">内存</th>
            <th v-if="shouldShowPaymentColumn('serial_number')" class="col-serial">序列号</th>
            <th v-if="shouldShowPaymentColumn('imei')">IMEI</th>
            <th v-if="shouldShowPaymentColumn('purchase_cost')">入库价格</th>
            <th v-if="shouldShowPaymentColumn('sale_price')">销售价格</th>
            <th v-if="shouldShowPaymentColumn('profit')">利润</th>
            <th v-if="shouldShowPaymentColumn('sale_time')">入库时间</th>
            <th v-if="shouldShowPaymentColumn('sale_time')">销售时间</th>
            <th v-if="shouldShowPaymentColumn('payment_status')" class="col-status">打款状态</th>
            <th v-if="shouldShowPaymentColumn('payment_time')">打款时间</th>
            <th v-if="shouldShowPaymentActionColumn" class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading && phones.length > 0">
          <template v-for="(phone, index) in phones" :key="phone.id">
          <tr
            :class="{ 'row-selected': selectedPhones.includes(phone.id), 'mobile-action-expanded': isMobile && mobileActionRowId === phone.id }"
            @click="handlePaymentMobileRowTap(phone.id)"
            @dblclick="togglePaymentMobileActions(phone.id)"
          >
            <td>
              <input
                type="checkbox"
                v-model="selectedPhones"
                :value="phone.id"
                :disabled="phone.payment_status === 'paid'"
              />
            </td>
            <td>
              <span class="index-badge">{{ (pagination.page - 1) * pagination.limit + index + 1 }}</span>
            </td>
            <td v-if="shouldShowPaymentColumn('supplier_name')" class="col-supplier">{{ phone.supplier_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('store_name')">{{ phone.store_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('brand_name')">{{ phone.brand_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('model_name')" class="col-model">{{ phone.model_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('color_name')" class="col-color">{{ phone.color_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('memory_name')" class="col-memory">{{ phone.memory_name || '-' }}</td>
            <td v-if="shouldShowPaymentColumn('serial_number')" class="col-serial">
              <span class="serial-number">{{ phone.serial_number || '-' }}</span>
            </td>
            <td v-if="shouldShowPaymentColumn('imei')">
              <span :class="['imei', phone.phone_status === 'peer_transfer' ? 'imei-wholesale' : '']">{{ phone.imei || '-' }}</span>
            </td>
            <td v-if="shouldShowPaymentColumn('purchase_cost')" class="price">¥{{ formatAmount(phone.purchase_cost) }}</td>
            <td v-if="shouldShowPaymentColumn('sale_price')" class="price">¥{{ formatAmount(phone.sale_price) }}</td>
            <td v-if="shouldShowPaymentColumn('profit')" :class="['price-cell', (phone.sale_price - phone.purchase_cost) >= 0 ? 'profit-positive' : 'profit-negative']">
              ¥{{ formatAmount(phone.sale_price - phone.purchase_cost) }}
            </td>
            <td v-if="shouldShowPaymentColumn('sale_time')" class="time-cell">{{ formatDate(phone.purchase_date) }}</td>
            <td v-if="shouldShowPaymentColumn('sale_time')" class="time-cell">{{ formatDate(phone.sale_time) }}</td>
            <td v-if="shouldShowPaymentColumn('payment_status')" class="col-status">
              <span :class="['status-badge', phone.payment_status === 'paid' ? 'status-paid' : 'status-unpaid']">
                {{ phone.payment_status === 'paid' ? '已打款' : '未打款' }}
              </span>
            </td>
            <td v-if="shouldShowPaymentColumn('payment_time')" class="time-cell">
              <div
                v-if="phone.payment_time"
                class="time-badge payment-time-badge"
                :style="getPaymentTimeStyle(phone)"
                @click="handleShowPaymentDetails(phone)"
                title="点击查看详情"
              >
                <i class="fas fa-clock"></i>
                {{ formatDateTimeBeijing(phone.payment_time) }}
              </div>
              <span v-else>-</span>
            </td>
            <td v-if="shouldShowPaymentActionColumn" class="actions-col col-actions">
              <div class="action-buttons" v-if="phone.payment_status === 'unpaid'">
                <el-button
                  v-if="canCreatePayment && canViewPaymentField('actions')"
                  type="success"
                  size="small"
                  @click="handleSinglePayment(phone)"
                >
                  <i class="fas fa-money-bill-wave"></i>
                  <span>打款</span>
                </el-button>
              </div>
              <div class="action-buttons" v-else>
                <el-button
                  v-if="canViewPayments && canViewPaymentField('actions')"
                  type="primary"
                  size="small"
                  @click="handleShowPaymentDetails(phone)"
                >
                  <i class="fas fa-eye"></i>
                  <span>查看</span>
                </el-button>
                <el-button
                  v-if="canEditPayment && canViewPaymentField('actions')"
                  type="warning"
                  size="small"
                  @click="handleEditPayment(phone)"
                >
                  <i class="fas fa-edit"></i>
                  <span>编辑</span>
                </el-button>
                <el-button
                  v-if="canDeletePayment && canViewPaymentField('actions')"
                  type="danger"
                  @click="handleCancelPayment(phone)"
                  title="取消打款"
                  :disabled="removingPayment"
                >
                  <i class="fas fa-times-circle"></i>
                  <span>取消打款</span>
                </el-button>
              </div>
            </td>
          </tr>
          <tr
            v-if="isMobile && mobileActionRowId === phone.id && showPaymentActionField"
            class="mobile-action-row"
          >
            <td :colspan="paymentVisibleColumnCount">
              <div class="mobile-row-actions" v-if="phone.payment_status === 'unpaid'">
                <el-button
                  v-if="canCreatePayment && canViewPaymentField('actions')"
                  type="success"
                  size="small"
                  class="mobile-action-btn mobile-action-btn-pay"
                  @click.stop="handleSinglePayment(phone)"
                >
                  <i class="fas fa-money-bill-wave"></i>
                  <span>打款</span>
                </el-button>
              </div>
              <div class="mobile-row-actions" v-else>
                <el-button
                  v-if="canViewPayments && canViewPaymentField('actions')"
                  type="primary"
                  size="small"
                  class="mobile-action-btn mobile-action-btn-view"
                  @click.stop="handleShowPaymentDetails(phone)"
                >
                  <i class="fas fa-eye"></i>
                  <span>查看</span>
                </el-button>
                <el-button
                  v-if="canEditPayment && canViewPaymentField('actions')"
                  type="warning"
                  size="small"
                  class="mobile-action-btn mobile-action-btn-edit"
                  @click.stop="handleEditPayment(phone)"
                >
                  <i class="fas fa-edit"></i>
                  <span>编辑</span>
                </el-button>
                <el-button
                  v-if="canDeletePayment && canViewPaymentField('actions')"
                  type="danger"
                  size="small"
                  class="mobile-action-btn mobile-action-btn-delete"
                  @click.stop="handleCancelPayment(phone)"
                  :disabled="removingPayment"
                >
                  <i class="fas fa-times-circle"></i>
                  <span>取消打款</span>
                </el-button>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
        <tbody v-else-if="loading">
          <tr>
            <td :colspan="paymentVisibleColumnCount" class="text-center">
              <i class="fas fa-spinner fa-spin"></i> 加载中...
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td :colspan="paymentVisibleColumnCount" class="text-center text-muted">
              <i class="fas fa-inbox"></i> 暂无数据
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页 - 使用统一的 Pagination 组件 -->
      <div class="pagination-wrapper">
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :total="Number(pagination.total)"
          :page-sizes="[20, 50, 100, 200]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="loading"
          @change="handlePaginationChange"
        />
      </div>
      </div>
    </div>

    <!-- 批量打款对话框 - 使用和批次详情相同的布局 -->
    <MobileDialog
      v-model="showBatchPaymentDialog"
      title="确认批量打款"
      width="95%"
      dialog-class="supplier-phone-payments-dialog supplier-phone-payments-batch-dialog"
      :show-default-footer="false"
      :style="{ maxWidth: '1600px' }"
      :close-on-click-modal="false"
    >
      <div ref="batchPaymentTableForCapture" class="payment-details">
        <!-- 手机信息摘要 -->
        <div class="details-info payment-summary-cards payment-summary-cards-four" style="grid-template-columns: repeat(4, 1fr);">
          <div v-if="canViewPaymentField('supplier_name')" class="info-row">
            <label>供应商:</label>
            <span>{{ selectedPhoneObjects[0]?.supplier_name || '-' }}</span>
          </div>
          <div class="info-row">
            <label>数量:</label>
            <span class="highlight">{{ selectedPhones.length }} 台</span>
          </div>
          <div v-if="canViewPaymentField('purchase_cost')" class="info-row">
            <label>价格:</label>
            <span class="amount">¥{{ formatAmount(selectedTotalAmount) }}</span>
          </div>
          <div v-if="canViewPaymentField('profit')" class="info-row hide-in-capture">
            <label>利润:</label>
            <span :class="['amount', selectedTotalProfit >= 0 ? 'profit-positive' : 'profit-negative']">
              ¥{{ formatAmount(selectedTotalProfit) }}
            </span>
          </div>
        </div>

        <!-- 手机明细表格 - 显示所有待打款手机的完整信息 -->
        <div class="batch-details-table">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="60">序号</th>
                  <th v-if="canViewPaymentField('supplier_name')">供应商</th>
                  <th v-if="canViewPaymentField('sale_time')" width="120">销售时间</th>
                  <th v-if="canViewPaymentField('store_name')">店铺</th>
                  <th v-if="canViewPaymentField('brand_name')">品牌</th>
                  <th v-if="canViewPaymentField('model_name')">型号</th>
                  <th v-if="canViewPaymentField('color_name')">颜色</th>
                  <th v-if="canViewPaymentField('memory_name')">内存</th>
                  <th v-if="canViewPaymentField('serial_number')">序列号</th>
                  <th v-if="canViewPaymentField('imei')">IMEI</th>
                  <th v-if="canViewPaymentField('purchase_cost')">入库价格</th>
                  <th v-if="canViewPaymentField('profit')" class="hide-in-capture">利润</th>
                  <th v-if="canViewPaymentField('payment_time')" width="120">打款时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(phone, index) in selectedPhoneObjects" :key="phone.id">
                  <td><span class="index-badge">{{ index + 1 }}</span></td>
                  <td v-if="canViewPaymentField('supplier_name')">{{ phone.supplier_name || '-' }}</td>
                  <td v-if="canViewPaymentField('sale_time')" class="time-cell">{{ formatDateBeijing(phone.sale_time) }}</td>
                  <td v-if="canViewPaymentField('store_name')">{{ phone.store_name || '-' }}</td>
                  <td v-if="canViewPaymentField('brand_name')">{{ phone.brand_name || '-' }}</td>
                  <td v-if="canViewPaymentField('model_name')">{{ phone.model_name || '-' }}</td>
                  <td v-if="canViewPaymentField('color_name')">{{ phone.color_name || '-' }}</td>
                  <td v-if="canViewPaymentField('memory_name')">{{ phone.memory_name || '-' }}</td>
                  <td v-if="canViewPaymentField('serial_number')">
                    <span class="serial-number">{{ phone.serial_number || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('imei')">
                    <span :class="['imei', phone.phone_status === 'peer_transfer' ? 'imei-wholesale' : '']">{{ phone.imei || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('purchase_cost')" class="price">¥{{ formatAmount(phone.purchase_cost) }}</td>
                  <td v-if="canViewPaymentField('profit')" :class="['price-cell hide-in-capture', (phone.sale_price - phone.purchase_cost) >= 0 ? 'profit-positive' : 'profit-negative']">
                    ¥{{ formatAmount(phone.sale_price - phone.purchase_cost) }}
                  </td>
                  <td v-if="canViewPaymentField('payment_time')" class="time-cell">
                    <span class="payment-time-badge">{{ formatDateBeijing(phone.payment_time) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 打款信息卡片 -->
        <div class="details-info payment-form-cards mt-5">
          <div v-if="canViewPaymentField('payment_method')" class="info-row">
            <label>打款方式:</label>
            <el-select v-model="paymentForm.payment_method" placeholder="请选择打款方式" class="form-control el-select-form-control w-48" :disabled="!canEditPaymentField('payment_method')">
              <el-option label="银行转账" value="bank_transfer" />
              <el-option label="现金" value="cash" />
              <el-option label="支付宝" value="alipay" />
              <el-option label="微信" value="wechat" />
              <el-option label="其他" value="other" />
            </el-select>
          </div>
          <div v-if="canViewPaymentField('payment_time')" class="info-row">
            <label>打款时间:</label>
            <el-date-picker
              v-model="paymentForm.payment_time"
              type="datetime"
              placeholder="选择打款时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              class="form-control el-date-form-control w-52"
              :disabled="!canEditPaymentField('payment_time')"
            />
          </div>
          <div v-if="canViewPaymentField('payment_operator')" class="info-row">
            <label>打款人:</label>
            <el-input v-model="paymentForm.payment_operator" placeholder="打款人" class="form-control el-input-form-control w-36" readonly />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="payment-dialog-footer">
          <el-button type="default" @click="showBatchPaymentDialog = false">取消</el-button>
          <el-button
            type="success"
            @click="saveBatchPaymentAsImage"
            :loading="savingImage"
          >
            <i :class="savingImage ? 'fas fa-spinner fa-spin' : 'fas fa-camera'"></i>
            <span>保存图片</span>
          </el-button>
          <el-button type="primary" @click="handleBatchPayment" :loading="submitting">
            确认打款
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 单个打款对话框 - 使用和批次详情相同的布局 -->
    <MobileDialog
      v-model="showSinglePaymentDialog"
      title="确认打款"
      width="95%"
      dialog-class="supplier-phone-payments-dialog supplier-phone-payments-single-dialog"
      :show-default-footer="false"
      :style="{ maxWidth: '1600px' }"
      :close-on-click-modal="false"
    >
      <div ref="singlePaymentForCapture" class="payment-details">
        <!-- 手机信息摘要 -->
        <div class="details-info payment-summary-cards payment-summary-cards-four" style="grid-template-columns: repeat(4, 1fr);">
          <div v-if="canViewPaymentField('supplier_name')" class="info-row">
            <label>供应商:</label>
            <span>{{ currentPhone?.supplier_name || '-' }}</span>
          </div>
          <div class="info-row">
            <label>数量:</label>
            <span class="highlight">1 台</span>
          </div>
          <div v-if="canViewPaymentField('purchase_cost')" class="info-row">
            <label>价格:</label>
            <span class="amount">¥{{ formatAmount(currentPhone?.purchase_cost) }}</span>
          </div>
          <div v-if="canViewPaymentField('profit')" class="info-row">
            <label>利润:</label>
            <span :class="['amount', (currentPhone?.sale_price - currentPhone?.purchase_cost) >= 0 ? 'profit-positive' : 'profit-negative']">
              ¥{{ formatAmount((currentPhone?.sale_price || 0) - (currentPhone?.purchase_cost || 0)) }}
            </span>
          </div>
        </div>

        <!-- 手机明细表格 - 显示单个手机的完整信息 -->
        <div class="batch-details-table">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="60">序号</th>
                  <th v-if="canViewPaymentField('supplier_name')">供应商</th>
                  <th v-if="canViewPaymentField('sale_time')" width="120">销售时间</th>
                  <th v-if="canViewPaymentField('store_name')">店铺</th>
                  <th v-if="canViewPaymentField('brand_name')">品牌</th>
                  <th v-if="canViewPaymentField('model_name')">型号</th>
                  <th v-if="canViewPaymentField('color_name')">颜色</th>
                  <th v-if="canViewPaymentField('memory_name')">内存</th>
                  <th v-if="canViewPaymentField('serial_number')">序列号</th>
                  <th v-if="canViewPaymentField('imei')">IMEI</th>
                  <th v-if="canViewPaymentField('purchase_cost')">入库价格</th>
                  <th v-if="canViewPaymentField('profit')">利润</th>
                  <th v-if="canViewPaymentField('payment_time')" width="120">打款时间</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span class="index-badge">1</span>
                  </td>
                  <td v-if="canViewPaymentField('supplier_name')">{{ currentPhone?.supplier_name || '-' }}</td>
                  <td v-if="canViewPaymentField('sale_time')" class="time-cell">{{ formatDateBeijing(currentPhone?.sale_time) }}</td>
                  <td v-if="canViewPaymentField('store_name')">{{ currentPhone?.store_name || '-' }}</td>
                  <td v-if="canViewPaymentField('brand_name')">{{ currentPhone?.brand_name || '-' }}</td>
                  <td v-if="canViewPaymentField('model_name')">{{ currentPhone?.model_name || '-' }}</td>
                  <td v-if="canViewPaymentField('color_name')">{{ currentPhone?.color_name || '-' }}</td>
                  <td v-if="canViewPaymentField('memory_name')">{{ currentPhone?.memory_name || '-' }}</td>
                  <td v-if="canViewPaymentField('serial_number')">
                    <span class="serial-number">{{ currentPhone?.serial_number || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('imei')">
                    <span :class="['imei', currentPhone?.phone_status === 'peer_transfer' ? 'imei-wholesale' : '']">{{ currentPhone?.imei || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('purchase_cost')" class="price">¥{{ formatAmount(currentPhone?.purchase_cost) }}</td>
                  <td v-if="canViewPaymentField('profit')" :class="['price-cell', (currentPhone?.sale_price - currentPhone?.purchase_cost) >= 0 ? 'profit-positive' : 'profit-negative']">
                    ¥{{ formatAmount((currentPhone?.sale_price || 0) - (currentPhone?.purchase_cost || 0)) }}
                  </td>
                  <td v-if="canViewPaymentField('payment_time')" class="time-cell">
                    <span class="payment-time-badge">{{ formatDateBeijing(currentPhone?.payment_time) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 打款信息卡片 -->
        <div class="details-info payment-form-cards mt-5">
          <div v-if="canViewPaymentField('payment_method')" class="info-row">
            <label>打款方式:</label>
            <el-select v-model="paymentForm.payment_method" placeholder="请选择打款方式" class="form-control el-select-form-control w-48" :disabled="!canEditPaymentField('payment_method')">
              <el-option label="银行转账" value="bank_transfer" />
              <el-option label="现金" value="cash" />
              <el-option label="支付宝" value="alipay" />
              <el-option label="微信" value="wechat" />
              <el-option label="其他" value="other" />
            </el-select>
          </div>
          <div v-if="canViewPaymentField('payment_time')" class="info-row">
            <label>打款时间:</label>
            <el-date-picker
              v-model="paymentForm.payment_time"
              type="datetime"
              placeholder="选择打款时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              class="form-control el-date-form-control w-52"
              :disabled="!canEditPaymentField('payment_time')"
            />
          </div>
          <div v-if="canViewPaymentField('payment_operator')" class="info-row">
            <label>打款人:</label>
            <el-input v-model="paymentForm.payment_operator" placeholder="打款人" class="form-control el-input-form-control w-36" readonly />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="payment-dialog-footer">
          <el-button type="default" @click="showSinglePaymentDialog = false">取消</el-button>
          <el-button
            type="success"
            @click="saveSinglePaymentAsImage"
            :loading="savingImage"
          >
            <i :class="savingImage ? 'fas fa-spinner fa-spin' : 'fas fa-camera'"></i>
            <span>保存图片</span>
          </el-button>
          <el-button type="primary" @click="handleSinglePaymentSubmit" :loading="submitting">
            确认打款
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 打款详情对话框 -->
    <MobileDialog
      v-model="showPaymentDetailsDialog"
      title="打款批次详情"
      width="95%"
      dialog-class="supplier-phone-payments-dialog supplier-phone-payments-detail-dialog"
      :show-default-footer="false"
      :style="{ maxWidth: '1600px' }"
    >
      <div class="payment-details">
        <!-- 批次信息 -->
        <div class="details-info payment-summary-cards" style="grid-template-columns: repeat(4, 1fr);">
          <div v-if="canViewPaymentField('supplier_name')" class="info-row">
            <label>供应商:</label>
            <span>{{ paymentDetails.supplier_name }}</span>
          </div>
          <div v-if="canViewPaymentField('payment_time')" class="info-row">
            <label>打款时间:</label>
            <span>{{ formatDateTimeBeijing(paymentDetails.payment_time) }}</span>
          </div>
          <div v-if="canViewPaymentField('payment_method')" class="info-row">
            <label>支付方式:</label>
            <span class="highlight">{{ getPaymentMethodLabel(paymentDetails.payment_method) }}</span>
          </div>
          <div v-if="canViewPaymentField('payment_operator')" class="info-row">
            <label>打款人:</label>
            <span class="highlight">{{ paymentDetails.payment_operator || '-' }}</span>
          </div>
          <div class="info-row">
            <label>手机数量:</label>
            <span class="highlight">{{ paymentDetails.phones?.length || 0 }} 台</span>
          </div>
          <div v-if="canViewPaymentField('purchase_cost')" class="info-row">
            <label>总成本:</label>
            <span class="amount">¥{{ formatAmount(paymentDetails.total_cost) }}</span>
          </div>
          <div v-if="canViewPaymentField('sale_price')" class="info-row">
            <label>总销售:</label>
            <span class="amount">¥{{ formatAmount(paymentDetails.total_sale) }}</span>
          </div>
          <div v-if="canViewPaymentField('profit')" class="info-row hide-in-capture">
            <label>总利润:</label>
            <span :class="['amount', 'profit-value', paymentDetails.total_profit >= 0 ? 'profit-positive' : 'profit-negative']">
              ¥{{ formatAmount(paymentDetails.total_profit) }}
            </span>
          </div>
        </div>

        <!-- 手机明细表格 -->
        <div ref="paymentDetailsForCapture" class="batch-details-table">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="60">序号</th>
                  <th v-if="canViewPaymentField('supplier_name')">供应商</th>
                  <th v-if="canViewPaymentField('sale_time')" width="120">销售时间</th>
                  <th v-if="canViewPaymentField('store_name')">店铺</th>
                  <th v-if="canViewPaymentField('brand_name')">品牌</th>
                  <th v-if="canViewPaymentField('model_name')">型号</th>
                  <th v-if="canViewPaymentField('color_name')">颜色</th>
                  <th v-if="canViewPaymentField('memory_name')">内存</th>
                  <th v-if="canViewPaymentField('serial_number')">序列号</th>
                  <th v-if="canViewPaymentField('imei')">IMEI</th>
                  <th v-if="canViewPaymentField('purchase_cost')">入库价格</th>
                  <th v-if="canViewPaymentField('profit')" class="hide-in-capture">利润</th>
                  <th v-if="canViewPaymentField('payment_time')" width="120">打款时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(phone, index) in paymentDetails.phones" :key="phone.id">
                  <td>
                    <span class="index-badge">{{ index + 1 }}</span>
                  </td>
                  <td v-if="canViewPaymentField('supplier_name')">{{ phone.supplier_name || '-' }}</td>
                  <td v-if="canViewPaymentField('sale_time')" class="time-cell">{{ formatDateBeijing(phone.sale_time) }}</td>
                  <td v-if="canViewPaymentField('store_name')">{{ phone.store_name || '-' }}</td>
                  <td v-if="canViewPaymentField('brand_name')">{{ phone.brand_name || '-' }}</td>
                  <td v-if="canViewPaymentField('model_name')">{{ phone.model_name || '-' }}</td>
                  <td v-if="canViewPaymentField('color_name')">{{ phone.color_name || '-' }}</td>
                  <td v-if="canViewPaymentField('memory_name')">{{ phone.memory_name || '-' }}</td>
                  <td v-if="canViewPaymentField('serial_number')">
                    <span class="serial-number">{{ phone.serial_number || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('imei')">
                    <span :class="['imei', phone.phone_status === 'peer_transfer' ? 'imei-wholesale' : '']">{{ phone.imei || '-' }}</span>
                  </td>
                  <td v-if="canViewPaymentField('purchase_cost')" class="price">¥{{ formatAmount(phone.purchase_cost) }}</td>
                  <td v-if="canViewPaymentField('profit')" :class="['price-cell', (phone.sale_price - phone.purchase_cost) >= 0 ? 'profit-positive' : 'profit-negative', 'hide-in-capture']">
                    ¥{{ formatAmount(phone.sale_price - phone.purchase_cost) }}
                  </td>
                  <td v-if="canViewPaymentField('payment_time')" class="time-cell">
                    <span class="payment-time-badge">{{ formatDateBeijing(phone.payment_time) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="payment-dialog-footer">
          <el-button
            v-if="canDeletePayment && paymentDetails.phones?.length > 0"
            type="danger"
            @click="handleBatchCancelPayment"
            :loading="removingPayment"
          >
            <i class="fas fa-times-circle"></i>
            <span>批量取消 {{ paymentDetails.phones?.length || 0 }} 台</span>
          </el-button>
          <el-button
            type="primary"
            @click="savePaymentDetailsAsImage"
            :loading="savingImage"
          >
            <i :class="savingImage ? 'fas fa-spinner fa-spin' : 'fas fa-camera'"></i>
            <span>保存为图片</span>
          </el-button>
          <el-button type="default" @click="showPaymentDetailsDialog = false">关闭</el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 编辑打款对话框 -->
    <MobileDialog
      v-model="showEditPaymentDialog"
      title="编辑打款信息"
      width="600px"
      dialog-class="supplier-phone-payments-dialog supplier-phone-payments-edit-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
    >
      <div class="edit-payment-dialog">
        <!-- 手机信息 - 统一使用和批次详情一样的卡片样式 -->
        <div class="details-info payment-summary-cards payment-summary-cards-edit">
          <div v-if="canViewPaymentField('imei')" class="info-row summary-item summary-item-imei">
            <label>IMEI:</label>
            <span class="imei-number">{{ editingPhone?.imei || '-' }}</span>
          </div>
          <div v-if="canViewPaymentField('model_name')" class="info-row summary-item summary-item-model">
            <label>型号:</label>
            <span>{{ editingPhone?.full_model_name || editingPhone?.model_name || '-' }}</span>
          </div>
          <div v-if="canViewPaymentField('purchase_cost')" class="info-row summary-item summary-item-cost">
            <label>进价:</label>
            <span class="amount">¥{{ formatAmount(editingPhone?.purchase_cost) }}</span>
          </div>
        </div>

        <el-form :model="editPaymentForm" label-width="100px">
          <el-form-item v-if="canViewPaymentField('payment_method')" label="打款方式" prop="payment_method">
            <el-select v-model="editPaymentForm.payment_method" placeholder="请选择打款方式" :disabled="!canEditPaymentField('payment_method')">
              <el-option label="银行转账" value="bank_transfer" />
              <el-option label="现金" value="cash" />
              <el-option label="支付宝" value="alipay" />
              <el-option label="微信" value="wechat" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="canViewPaymentField('payment_time')" label="打款时间" prop="payment_time">
            <el-date-picker
              v-model="editPaymentForm.payment_time"
              type="datetime"
              placeholder="选择打款时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
              class="form-control el-date-form-control"
              :clearable="true"
              :disabled="!canEditPaymentField('payment_time')"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="payment-dialog-footer">
          <el-button type="default" @click="showEditPaymentDialog = false">取消</el-button>
          <el-button type="primary" @click="handleEditPaymentSubmit" :loading="submitting">
            保存修改
          </el-button>
        </div>
      </template>
    </MobileDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import unifiedApi from '@/utils/unified-api';
import { useNotification } from '@/composables/useNotification';
import { useImportExport } from '@/composables/useImportExport';
import { usePagePermissions } from '@/composables/usePagePermissions';
import { fieldPermissions } from '@/composables/useFieldPermissions';
import { useMobile } from '@/composables/mobile';
import { useLoadingState } from '@/composables'
import { useAuthStore } from '@/stores/auth';
import Pagination from '@/components/Pagination.vue';
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue';
import ImportExportActions from '@/components/business/ImportExportActions.vue';
import { PageHeader, PermissionDenied } from '@/components/base';
import html2canvas from 'html2canvas';
import { TimeUtil, TIME_FORMATS } from '@/utils/time';

const router = useRouter();
const { success, error, warning, info } = useNotification();
const authStore = useAuthStore();
const { isMobile } = useMobile();
const { exportFile, buildDateFilename } = useImportExport();
const { init: initFieldPermissions } = fieldPermissions;

// 权限检查 - 使用 usePagePermissions
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  handleNoPermission
} = usePagePermissions('supplier-payments')

// 权限计算属性（为了兼容现有代码）
const canViewPayments = computed(() => canView.value)
const canCreatePayment = computed(() => canCreate.value)
const canEditPayment = computed(() => canEdit.value)
const canDeletePayment = computed(() => canDelete.value)
const canExportPayment = computed(() => canExport.value)

const paymentFieldMap: Record<string, string> = {
  stats_unpaid_count: 'stats.unpaid_count',
  stats_paid_count: 'stats.paid_count',
  stats_total_count: 'stats.total_count',
  supplier_name: 'payment.supplier_name',
  store_name: 'payment.store_name',
  brand_name: 'payment.brand_name',
  model_name: 'payment.model_name',
  color_name: 'payment.color_name',
  memory_name: 'payment.memory_name',
  serial_number: 'payment.serial_number',
  imei: 'payment.imei',
  purchase_cost: 'payment.purchase_cost',
  sale_price: 'payment.sale_price',
  profit: 'payment.profit',
  sale_time: 'payment.sale_time',
  payment_status: 'payment.payment_status',
  payment_time: 'payment.payment_time',
  payment_method: 'payment.payment_method',
  payment_operator: 'payment.payment_operator',
  sale_status: 'payment.sale_status',
  actions: 'system_info.operations'
}

interface StoreOption {
  id: number
  name: string
}

interface SupplierPaymentStatistic {
  supplier_id: number
  supplier_name?: string
  unpaid_count?: number
  unpaid_amount?: number | string
  paid_count?: number
  paid_amount?: number | string
}

interface SupplierPaymentSummary {
  total_unpaid_count: number
  total_unpaid_amount: number | string
  total_paid_count: number
  total_paid_amount: number | string
}

interface SupplierPaymentPhone {
  id: number
  supplier_id?: number
  supplier_name?: string
  store_id?: number
  store_name?: string
  brand_name?: string
  model_name?: string
  full_model_name?: string
  color_name?: string
  memory_name?: string
  serial_number?: string
  imei?: string
  purchase_cost?: number | string
  sale_price?: number | string
  purchase_date?: string | null
  sale_time?: string | null
  payment_status?: 'paid' | 'unpaid' | string
  payment_method?: string | null
  payment_time?: string | null
  payment_operator_name?: string
  phone_status?: string | null
  status?: string | null
}

interface PaymentDetailsState {
  supplier_name: string
  payment_time: string | null
  payment_method: string
  payment_operator: string
  phones: SupplierPaymentPhone[]
  total_cost: number
  total_sale: number
  total_profit: number
}

interface SupplierPaymentListParams {
  sale_status: string
  payment_status: string
  page?: number
  limit?: number
  supplier_id?: string
  store_id?: string
  keyword?: string
  start_date?: string
  end_date?: string
}

interface SupplierPaymentPagination {
  total?: number
  totalPages?: number
}

interface SupplierPaymentApiResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: SupplierPaymentPagination
}

interface SupplierPaymentErrorResponse {
  message?: string
  error?: string | { message?: string }
}

interface SupplierPaymentError extends Error {
  code?: string
  response?: {
    data?: SupplierPaymentErrorResponse
  }
}

const getPaymentFieldKey = (fieldName: string) => paymentFieldMap[fieldName] || fieldName
const canViewPaymentField = (fieldName: string) => fieldPermissions.isFieldVisible('payments_supplierphonepaymentsview', getPaymentFieldKey(fieldName))
const canEditPaymentField = (fieldName: string) => {
  if (!canViewPaymentField(fieldName)) return false
  if (canCreate.value || canEdit.value) return true
  return fieldPermissions.isFieldEditable('payments_supplierphonepaymentsview', getPaymentFieldKey(fieldName))
}
const showPaymentStatsCards = computed(() => (
  canViewPaymentField('stats_unpaid_count') ||
  canViewPaymentField('stats_paid_count') ||
  canViewPaymentField('stats_total_count') ||
  canViewPaymentField('supplier_name')
))
const showPaymentStatsAmount = computed(() => canViewPaymentField('purchase_cost'))
const showPaymentSearchKeyword = computed(() => ['imei', 'serial_number', 'brand_name', 'model_name'].some(field => canViewPaymentField(field)))
const showPaymentActionField = computed(() => canViewPaymentField('actions') && (canViewPayments.value || canEditPayment.value || canDeletePayment.value || canCreatePayment.value))
const paymentMobileCoreFields = new Set([
  'supplier_name',
  'model_name',
  'color_name',
  'memory_name',
  'serial_number',
  'payment_status',
  'actions'
])
const shouldShowPaymentColumn = (fieldName: string) => {
  if (!canViewPaymentField(fieldName)) return false
  if (!isMobile.value) return true
  return paymentMobileCoreFields.has(fieldName)
}
const shouldShowPaymentActionColumn = computed(() => showPaymentActionField.value && !isMobile.value)
const paymentVisibleColumnCount = computed(() => {
  return [
    true,
    true,
    shouldShowPaymentColumn('supplier_name'),
    shouldShowPaymentColumn('store_name'),
    shouldShowPaymentColumn('brand_name'),
    shouldShowPaymentColumn('model_name'),
    shouldShowPaymentColumn('color_name'),
    shouldShowPaymentColumn('memory_name'),
    shouldShowPaymentColumn('serial_number'),
    shouldShowPaymentColumn('imei'),
    shouldShowPaymentColumn('purchase_cost'),
    shouldShowPaymentColumn('sale_price'),
    shouldShowPaymentColumn('profit'),
    shouldShowPaymentColumn('sale_time'),
    shouldShowPaymentColumn('sale_time'),
    shouldShowPaymentColumn('payment_status'),
    shouldShowPaymentColumn('payment_time'),
    shouldShowPaymentActionColumn.value
  ].filter(Boolean).length || 1
})

// 定义颜色调色板（扩展到20种颜色以更好地区分不同批次）
const paymentTimeColors = [
  { bg: '#ecf5ff', text: '#409eff' },   // 蓝色
  { bg: '#fef0f0', text: '#f56c6c' },   // 红色
  { bg: '#f0f9ff', text: '#67c23a' },   // 绿色
  { bg: '#fdf6ec', text: '#e6a23c' },   // 橙色
  { bg: '#f4f4f5', text: '#909399' },   // 灰色
  { bg: '#f5f0ff', text: '#a855f7' },   // 紫色
  { bg: '#fff0f5', text: '#ec4899' },   // 粉色
  { bg: '#f0fff4', text: '#10b981' },   // 青绿
  { bg: '#fffbeb', text: '#f59e0b' },   // 琥珀
  { bg: '#fff7ed', text: '#ea580c' },   // 深橙
  { bg: '#eff6ff', text: '#3b82f6' },   // 亮蓝
  { bg: '#fdf2f8', text: '#db2777' },   // 深粉
  { bg: '#f0fdf4', text: '#16a34a' },   // 深绿
  { bg: '#fefce8', text: '#ca8a04' },   // 黄色
  { bg: '#faf5ff', text: '#9333ea' },   // 深紫
  { bg: '#ecfeff', text: '#06b6d4' },   // 青色
  { bg: '#fff1f2', text: '#e11d48' },   // 玫瑰红
  { bg: '#f5f3ff', text: '#6366f1' },   // 靛蓝
  { bg: '#fef3c7', text: '#d97706' },   // 金色
  { bg: '#fce7f3', text: '#be185d' },   // 洋红
];

// 根据打款时间生成颜色索引（精确到分钟，每个不同的打款时间都是不同批次）
const getPaymentTimeColorIndex = (paymentTime: string): number => {
  if (!paymentTime) return 0;

  const date = new Date(paymentTime);
  // 使用年月日时分钟作为种子，精确到分钟
  // 使用质数乘数来增加随机性，避免相邻时间使用相近颜色
  const seed = (date.getFullYear() * 997 +
               (date.getMonth() + 1) * 101 +
               date.getDate() * 73 +
               date.getHours() * 37 +
               date.getMinutes() * 17) % 1000000007; // 使用大质数取模

  return Math.abs(seed) % paymentTimeColors.length;
};

// 获取当前北京时间（UTC+8）格式：YYYY-MM-DD HH:mm:ss
const getCurrentBeijingTime = (): string => {
  return TimeUtil.nowFormatted(TIME_FORMATS.DATETIME);
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isSupplierPaymentError = (err: unknown): err is SupplierPaymentError => {
  return typeof err === 'object' && err !== null;
};

const isRequestCanceled = (err: unknown): boolean => {
  if (!isSupplierPaymentError(err)) {
    return false;
  }

  return err.code === 'ERR_CANCELED'
    || err.name === 'CanceledError'
    || err.message?.includes('canceled') === true;
};

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (!isSupplierPaymentError(err)) {
    return fallback;
  }

  const responseError = err.response?.data?.error;
  if (typeof responseError === 'string' && responseError.trim()) {
    return responseError;
  }

  if (typeof responseError === 'object' && responseError?.message?.trim()) {
    return responseError.message;
  }

  if (err.response?.data?.message?.trim()) {
    return err.response.data.message;
  }

  if (err.message?.trim()) {
    return err.message;
  }

  return fallback;
};

const { loading } = useLoadingState()
const { loading: submitting } = useLoadingState()
const removingPayment = ref(false);
const savingImage = ref(false);

// 图片截图引用
const paymentDetailsForCapture = ref<HTMLElement | null>(null);
const batchPaymentTableForCapture = ref<HTMLElement | null>(null);
const singlePaymentForCapture = ref<HTMLElement | null>(null);

const withCaptureLayout = async (
  element: HTMLElement,
  action: () => Promise<void>
) => {
  const hideElements = Array.from(element.querySelectorAll('.hide-in-capture')) as HTMLElement[];
  const responsiveContainers = [
    element,
    ...Array.from(element.querySelectorAll('.table-responsive')) as HTMLElement[]
  ];
  const styleSnapshots = responsiveContainers.map((node) => ({
    node,
    overflowX: node.style.overflowX,
    overflowY: node.style.overflowY,
    maxWidth: node.style.maxWidth,
    width: node.style.width
  }));

  try {
    hideElements.forEach((node) => {
      node.style.display = 'none';
    });

    const captureWidth = responsiveContainers.reduce((maxWidth, node) => {
      return Math.max(maxWidth, node.scrollWidth, node.clientWidth);
    }, element.scrollWidth || element.clientWidth || 0);

    styleSnapshots.forEach(({ node }) => {
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
      node.style.maxWidth = 'none';
      if (captureWidth > 0) {
        node.style.width = `${captureWidth}px`;
      }
    });

    await nextTick();
    await action();
  } finally {
    styleSnapshots.forEach(({ node, overflowX, overflowY, maxWidth, width }) => {
      node.style.overflowX = overflowX;
      node.style.overflowY = overflowY;
      node.style.maxWidth = maxWidth;
      node.style.width = width;
    });

    hideElements.forEach((node) => {
      node.style.display = '';
    });
  }
};

const downloadCaptureImage = async (
  element: HTMLElement,
  fileName: string
) => {
  const captureWidth = Math.max(element.scrollWidth, element.clientWidth, 1200);
  const captureHeight = Math.max(element.scrollHeight, element.clientHeight);

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight
  });

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('生成图片失败'));
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
};

// 移动端搜索展开状态
const searchExpanded = ref(false);
const stores = ref<StoreOption[]>([]);
const statistics = ref<SupplierPaymentStatistic[]>([]);
const summaryStatistics = ref<SupplierPaymentSummary>({
  total_unpaid_count: 0,
  total_unpaid_amount: 0,
  total_paid_count: 0,
  total_paid_amount: 0
});
const phones = ref<SupplierPaymentPhone[]>([]);
const currentPhone = ref<SupplierPaymentPhone | null>(null);
const editingPhone = ref<SupplierPaymentPhone | null>(null);
const paymentDetails = ref<PaymentDetailsState>({
  supplier_name: '',
  payment_time: null,
  payment_method: '',
  payment_operator: '',
  phones: [],
  total_cost: 0,
  total_sale: 0,
  total_profit: 0
});

const selectAll = ref(false);
const selectedPhones = ref<number[]>([]);
// 存储已选择手机的完整对象，确保在任何筛选条件下都能获取完整数据
const selectedPhoneMap = ref<Map<number, SupplierPaymentPhone>>(new Map());
const exportingPaymentPhones = ref(false);
const mobileActionRowId = ref<number | null>(null);
const lastTappedRowId = ref<number | null>(null);
const lastTapTimestamp = ref(0);

const filters = reactive({
  keyword: '',
  supplier_id: '',
  store_id: '',
  sale_status: 'all',
  payment_status: 'all',  // 默认显示全部（已打款和未打款）
  start_date: '',  // 开始时间
  end_date: ''     // 结束时间
});

const hasPaymentFilterValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

const syncVisiblePaymentFilters = () => {
  if (!showPaymentSearchKeyword.value) {
    filters.keyword = '';
  }
  if (!canViewPaymentField('supplier_name')) {
    filters.supplier_id = '';
  }
  if (!canViewPaymentField('store_name')) {
    filters.store_id = '';
  }
  if (!canViewPaymentField('sale_status')) {
    filters.sale_status = 'all';
  }
  if (!canViewPaymentField('payment_status')) {
    filters.payment_status = 'all';
  }
  if (!canViewPaymentField('sale_time')) {
    filters.start_date = '';
    filters.end_date = '';
  }
};

const buildPaymentListParams = (includePagination = true) => {
  const params: SupplierPaymentListParams = {
    sale_status: canViewPaymentField('sale_status') ? filters.sale_status : 'all',
    payment_status: canViewPaymentField('payment_status') ? filters.payment_status : 'all'
  };

  if (includePagination) {
    params.page = pagination.page;
    params.limit = pagination.limit;
  }

  if (canViewPaymentField('supplier_name') && hasPaymentFilterValue(filters.supplier_id)) {
    params.supplier_id = filters.supplier_id;
  }

  if (canViewPaymentField('store_name') && hasPaymentFilterValue(filters.store_id)) {
    params.store_id = filters.store_id;
  }

  if (showPaymentSearchKeyword.value && hasPaymentFilterValue(filters.keyword)) {
    params.keyword = filters.keyword.trim();
  }

  if (canViewPaymentField('sale_time') && hasPaymentFilterValue(filters.start_date)) {
    params.start_date = filters.start_date.trim();
  }

  if (canViewPaymentField('sale_time') && hasPaymentFilterValue(filters.end_date)) {
    params.end_date = filters.end_date.trim();
  }

  return params;
};

const exportPaymentPhones = async () => {
  await exportFile({
    url: '/supplier-payments/phones/export',
    filename: buildDateFilename('供应商打款', 'xlsx'),
    params: buildPaymentListParams(false),
    allowed: canExportPayment,
    loading: exportingPaymentPhones,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '供应商打款数据导出成功',
    errorMessage: '供应商打款数据导出失败'
  });
};

const pagination = reactive({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0
});

const showBatchPaymentDialog = ref(false);
const showSinglePaymentDialog = ref(false);
const showPaymentDetailsDialog = ref(false);
const showEditPaymentDialog = ref(false);

// 获取当前用户显示名称（工号对应的姓名）
const getCurrentUserDisplayName = () => {
  const user = authStore.user;
  if (!user) return '';
  // 优先使用name（工号对应的姓名），如果没有则使用username（工号）
  return user.name || user.username || '';
};

const paymentForm = reactive({
  payment_method: 'bank_transfer',
  payment_time: getCurrentBeijingTime(),
  payment_operator: getCurrentUserDisplayName()
});

const editPaymentForm = reactive({
  payment_method: 'bank_transfer',
  payment_time: ''
});

// 计算卡片统计数据：根据当前筛选条件动态计算
const currentSupplierStats = computed(() => {
  if (!filters.supplier_id) return null;
  return statistics.value.find((supplierStat) => supplierStat.supplier_id === Number.parseInt(filters.supplier_id, 10)) || null;
});

const currentSupplierCount = computed(() => {
  const statsList = Array.isArray(statistics.value) ? statistics.value : [];

  if (filters.supplier_id && currentSupplierStats.value) {
    return 1;
  }

  if (filters.payment_status === 'paid') {
    return statsList.filter((item) => Number(item?.paid_count || 0) > 0).length;
  }

  if (filters.payment_status === 'unpaid') {
    return statsList.filter((item) => Number(item?.unpaid_count || 0) > 0).length;
  }

  return statsList.length;
});

const currentSupplierMeta = computed(() => {
  if (filters.supplier_id && currentSupplierStats.value?.supplier_name) {
    return currentSupplierStats.value.supplier_name;
  }

  if (filters.payment_status === 'paid') {
    return '已打款供应商';
  }

  if (filters.payment_status === 'unpaid') {
    return '待打款供应商';
  }

  return '全部供应商';
});

// 当前筛选条件下的统计数据 - 使用实际加载数据
const currentTotalCount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，使用实际分页的总数
    return pagination.total;
  } else {
    // 无筛选条件时，使用全局统计数据
    return Number((summaryStatistics.value.total_unpaid_count || 0) + (summaryStatistics.value.total_paid_count || 0));
  }
});

const togglePaymentMobileActions = (phoneId: number) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === phoneId ? null : phoneId
}

const handlePaymentMobileRowTap = (phoneId: number) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedRowId.value === phoneId && now - lastTapTimestamp.value <= 320) {
    togglePaymentMobileActions(phoneId)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = phoneId
  lastTapTimestamp.value = now
}

const currentTotalAmount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，根据当前筛选的手机列表计算总金额
    return phones.value.reduce((sum: number, phone) => {
      return sum + toNumber(phone?.purchase_cost);
    }, 0);
  } else {
    // 无筛选条件时，使用全局统计数据
    return Number((summaryStatistics.value.total_unpaid_amount || 0) + (summaryStatistics.value.total_paid_amount || 0));
  }
});

// 检查是否有筛选条件（除了默认的 'all' 值）
const hasFilters = computed(() => {
  return !!(
    (showPaymentSearchKeyword.value && filters.keyword) ||
    (canViewPaymentField('sale_time') && filters.start_date) ||
    (canViewPaymentField('sale_time') && filters.end_date) ||
    (canViewPaymentField('sale_status') && filters.sale_status !== 'all')
  );
});

// 基于实际加载数据计算当前筛选条件下的统计
const currentUnpaidCount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，使用当前页面的数据
    return phones.value.filter((phone) => phone.payment_status === 'unpaid').length;
  } else {
    // 无筛选条件或只筛选供应商/打款状态时，使用统计数据
    if (filters.supplier_id && currentSupplierStats.value) {
      // 按供应商筛选时，如果还按打款状态筛选，需要相应调整
      if (filters.payment_status === 'paid') {
        return 0;
      }
      return Number(currentSupplierStats.value.unpaid_count || 0);
    }
    // 按打款状态筛选时使用全局统计
    if (filters.payment_status === 'unpaid') {
      return Number(summaryStatistics.value.total_unpaid_count || 0);
    } else if (filters.payment_status === 'paid') {
      return 0; // 如果选了"已打款"但这里要显示"待打款"，返回0
    }
    // 默认显示全部未打款
    return Number(summaryStatistics.value.total_unpaid_count || 0);
  }
});

const currentUnpaidAmount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，使用当前页面的数据
    return phones.value
      .filter((phone) => phone.payment_status === 'unpaid')
      .reduce((sum: number, phone) => sum + toNumber(phone?.purchase_cost), 0);
  } else {
    // 无筛选条件或只筛选供应商/打款状态时，使用统计数据
    if (filters.supplier_id && currentSupplierStats.value) {
      // 按供应商筛选时，如果还按打款状态筛选，需要相应调整
      if (filters.payment_status === 'paid') {
        return 0;
      }
      return Number(currentSupplierStats.value.unpaid_amount || 0);
    }
    // 按打款状态筛选时使用全局统计
    if (filters.payment_status === 'unpaid') {
      return Number(summaryStatistics.value.total_unpaid_amount || 0);
    } else if (filters.payment_status === 'paid') {
      return 0;
    }
    return Number(summaryStatistics.value.total_unpaid_amount || 0);
  }
});

const currentPaidCount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，使用当前页面的数据
    return phones.value.filter((phone) => phone.payment_status === 'paid').length;
  } else {
    // 无筛选条件或只筛选供应商/打款状态时，使用统计数据
    if (filters.supplier_id && currentSupplierStats.value) {
      // 按供应商筛选时，如果还按打款状态筛选，需要相应调整
      if (filters.payment_status === 'unpaid') {
        return 0;
      }
      return Number(currentSupplierStats.value.paid_count || 0);
    }
    // 按打款状态筛选时使用全局统计
    if (filters.payment_status === 'paid') {
      return Number(summaryStatistics.value.total_paid_count || 0);
    } else if (filters.payment_status === 'unpaid') {
      return 0;
    }
    return Number(summaryStatistics.value.total_paid_count || 0);
  }
});

const currentPaidAmount = computed(() => {
  if (hasFilters.value) {
    // 有筛选条件时，使用当前页面的数据
    return phones.value
      .filter((phone) => phone.payment_status === 'paid')
      .reduce((sum: number, phone) => sum + toNumber(phone?.purchase_cost), 0);
  } else {
    // 无筛选条件或只筛选供应商/打款状态时，使用统计数据
    if (filters.supplier_id && currentSupplierStats.value) {
      // 按供应商筛选时，如果还按打款状态筛选，需要相应调整
      if (filters.payment_status === 'unpaid') {
        return 0;
      }
      return Number(currentSupplierStats.value.paid_amount || 0);
    }
    // 按打款状态筛选时使用全局统计
    if (filters.payment_status === 'paid') {
      return Number(summaryStatistics.value.total_paid_amount || 0);
    } else if (filters.payment_status === 'unpaid') {
      return 0;
    }
    return Number(summaryStatistics.value.total_paid_amount || 0);
  }
});

// 保留旧的计算属性以兼容现有代码
const totalUnpaidCount = currentUnpaidCount;
const totalUnpaidAmount = currentUnpaidAmount;
const totalPaidCount = currentPaidCount;
const totalPaidAmount = currentPaidAmount;

// 获取选中的完整手机对象 - 优先从 selectedPhoneMap 获取，确保已选择数据在任何筛选条件下都可见
const selectedPhoneObjects = computed(() => {
  const result: SupplierPaymentPhone[] = [];
  selectedPhones.value.forEach((phoneId: number) => {
    // 优先从 map 中获取已存储的完整数据
    if (selectedPhoneMap.value.has(phoneId)) {
      const selectedPhone = selectedPhoneMap.value.get(phoneId);
      if (selectedPhone) {
        result.push(selectedPhone);
      }
    } else {
      // 如果 map 中没有，尝试从当前页数据中获取
      const phone = phones.value.find((item) => item.id === phoneId);
      if (phone) {
        result.push(phone);
        // 同步到 map 中
        selectedPhoneMap.value.set(phoneId, phone);
      }
    }
  });
  return result;
});

const selectedTotalAmount = computed(() => {
  return selectedPhoneObjects.value.reduce((sum: number, phone) => {
    return sum + toNumber(phone?.purchase_cost);
  }, 0);
});

const selectedTotalProfit = computed(() => {
  return selectedPhoneObjects.value.reduce((sum: number, phone) => {
    return sum + (toNumber(phone?.sale_price) - toNumber(phone?.purchase_cost));
  }, 0);
});

const loadStatistics = async () => {
  try {
    loading.value = true;
    // 总是获取所有供应商的统计数据（不传 supplier_id），用于下拉框和卡片数据
    const response = await unifiedApi.get('/supplier-payments/statistics', {
      params: {
        sale_status: canViewPaymentField('sale_status') ? filters.sale_status : 'all'
      }
    }) as SupplierPaymentApiResponse<SupplierPaymentStatistic[]>;

    if (response.success) {
      statistics.value = Array.isArray(response.data) ? response.data : [];
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return;
    }
    logger.error('加载统计数据失败:', err);
    error('加载统计数据失败');
  } finally {
    loading.value = false;
  }
};

const loadSummaryStatistics = async () => {
  try {
    const response = await unifiedApi.get('/supplier-payments/summary-statistics', {
      params: {
        sale_status: canViewPaymentField('sale_status') ? filters.sale_status : 'all'
      }
    }) as SupplierPaymentApiResponse<Partial<SupplierPaymentSummary>>;

    if (response.success) {
      summaryStatistics.value = {
        total_unpaid_count: Number(response.data?.total_unpaid_count || 0),
        total_unpaid_amount: response.data?.total_unpaid_amount || 0,
        total_paid_count: Number(response.data?.total_paid_count || 0),
        total_paid_amount: response.data?.total_paid_amount || 0
      };
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return;
    }
    logger.error('加载汇总统计失败:', err);
    error('加载汇总统计失败');
  }
};

const loadStores = async () => {
  try {
    // 传递 all=true 参数获取所有店铺（用于下拉选择）
    const response = await unifiedApi.get('/stores?all=true') as SupplierPaymentApiResponse<StoreOption[]>;
    if (response.success) {
      stores.value = Array.isArray(response.data) ? response.data : [];
    }
  } catch (err) {
    logger.error('加载店铺列表失败:', err);
  }
};

const loadPhones = async () => {
  try {
    loading.value = true;
    const response = await unifiedApi.get('/supplier-payments/phones', {
      params: buildPaymentListParams()
    }) as SupplierPaymentApiResponse<SupplierPaymentPhone[]>;

    if (response.success) {
      const phoneList = Array.isArray(response.data) ? response.data : [];
      // 对返回的数据进行排序：已选中的数据排在前面，然后按销售时间降序（最近的靠前）
      const sortedData = [...phoneList].sort((a, b) => {
        const aSelected = selectedPhones.value.includes(a.id);
        const bSelected = selectedPhones.value.includes(b.id);

        // 如果两个都是选中或都是未选中，按销售时间降序排列
        if (aSelected === bSelected) {
          // 销售时间最近的靠前（降序）
          const timeA = new Date(a.sale_time || 0).getTime();
          const timeB = new Date(b.sale_time || 0).getTime();
          return timeB - timeA; // 降序，最新的在前
        }

        // 选中的排在前面
        return aSelected ? -1 : 1;
      });

      phones.value = sortedData;
      // pagination 是响应中的单独字段，不在 data 里
      pagination.total = Number(response.pagination?.total) || 0;
      pagination.totalPages = Number(response.pagination?.totalPages) || 0;
      // 移除清空已选择数据的逻辑，保持已选择状态
      // selectedPhones.value 和 selectedPhoneMap 不在此清空
      // 更新 selectedPhoneMap 中的数据（仅更新已存在的）
      phoneList.forEach((phone) => {
        if (selectedPhoneMap.value.has(phone.id)) {
          selectedPhoneMap.value.set(phone.id, phone);
        }
      });
      selectAll.value = false;
    }
  } catch (err: unknown) {
    // 忽略被取消的请求
    if (isRequestCanceled(err)) {
      return;
    }
    logger.error('加载手机列表失败:', err);
    error('加载手机列表失败');
  } finally {
    loading.value = false;
  }
};

// 监听 selectedPhones 变化，同步更新 selectedPhoneMap
watch(selectedPhones, (newIds, oldIds) => {
  // 找出新增的 ID
  const addedIds = newIds.filter((id: number) => !oldIds.includes(id));
  // 找出移除的 ID
  const removedIds = oldIds.filter((id: number) => !newIds.includes(id));

  // 从当前页数据中找到新增的手机对象并添加到 map
  addedIds.forEach((id: number) => {
    const phone = phones.value.find((item) => item.id === id);
    if (phone) {
      selectedPhoneMap.value.set(id, phone);
    }
  });

  // 从 map 中移除被取消选择的数据
  removedIds.forEach((id: number) => {
    selectedPhoneMap.value.delete(id);
  });
}, { deep: true });

const handleFilterChange = () => {
  syncVisiblePaymentFilters();

  // 确保筛选值是有效的字符串
  if (filters.supplier_id === null || filters.supplier_id === undefined) {
    filters.supplier_id = '';
  }
  if (filters.store_id === null || filters.store_id === undefined) {
    filters.store_id = '';
  }
  if (filters.sale_status === null || filters.sale_status === undefined) {
    filters.sale_status = 'all';
  }
  if (filters.payment_status === null || filters.payment_status === undefined) {
    filters.payment_status = 'all';
  }

  pagination.page = 1;
  // 注意：不清空已选择的数据，允许跨筛选条件批量选择
  selectAll.value = false;
  loadSummaryStatistics();
  loadStatistics();
  loadPhones();
};

const clearKeyword = () => {
  if (!showPaymentSearchKeyword.value) {
    return;
  }
  filters.keyword = '';
  handleFilterChange();
};

// 清空所有选择
const clearSelection = () => {
  selectedPhones.value = [];
  selectedPhoneMap.value.clear();
  selectAll.value = false;
  info('已清空所有选择');
};

const handleSelectAll = () => {
  if (selectAll.value) {
    const unpaidPhones = phones.value.filter((phone) => phone.payment_status === 'unpaid');
    // 增量选择：合并已选择的数据，而不是替换
    const newPhoneIds = unpaidPhones.map((phone) => phone.id);
    const combinedIds = [...new Set([...selectedPhones.value, ...newPhoneIds])];
    selectedPhones.value = combinedIds;
    // 更新 map
    unpaidPhones.forEach((phone) => {
      selectedPhoneMap.value.set(phone.id, phone);
    });

    // 如果当前页有已打款的手机，提示用户
    const paidCount = phones.value.length - unpaidPhones.length;
    const newlySelected = newPhoneIds.filter((id: number) => !selectedPhones.value.slice(0, -newPhoneIds.length).includes(id));
    if (paidCount > 0) {
      info(`当前页有 ${paidCount} 台手机已打款，已自动跳过。共选择 ${selectedPhones.value.length} 台未打款手机。`);
    } else if (newlySelected.length > 0) {
      info(`已选择 ${selectedPhones.value.length} 台手机（新增 ${newlySelected.length} 台）。`);
    }
    } else {
    // 取消全选时，只取消当前页的选择
    const currentPageIds = phones.value
      .filter((phone) => phone.payment_status === 'unpaid')
      .map((phone) => phone.id);
    selectedPhones.value = selectedPhones.value.filter((id: number) => !currentPageIds.includes(id));
    // 从 map 中移除当前页的数据
    currentPageIds.forEach((id: number) => {
      selectedPhoneMap.value.delete(id);
    });
  }
};

// 打开批量打款对话框时更新时间为当前时间
const handleOpenBatchPaymentDialog = () => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  paymentForm.payment_method = 'bank_transfer';
  paymentForm.payment_time = getCurrentBeijingTime();
  showBatchPaymentDialog.value = true;
};

const handleSinglePayment = (phone: SupplierPaymentPhone) => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  currentPhone.value = phone;
  paymentForm.payment_method = 'bank_transfer';
  paymentForm.payment_time = getCurrentBeijingTime();
  showSinglePaymentDialog.value = true;
};

const handleSinglePaymentSubmit = async () => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  try {
    // 验证必填字段
    if (canViewPaymentField('payment_method') && !paymentForm.payment_method) {
      warning('请选择打款方式');
      return;
    }
    if (canViewPaymentField('payment_time') && !paymentForm.payment_time) {
      warning('请选择打款时间');
      return;
    }

    submitting.value = true;

    const response = await unifiedApi.post(`/supplier-payments/${currentPhone.value.id}/payment`, paymentForm) as SupplierPaymentApiResponse<unknown>;

    if (response.success) {
      success('打款成功');
      showSinglePaymentDialog.value = false;
      // 清空选择状态
      clearSelection();
      refreshData();
    }
  } catch (err: unknown) {
    logger.error('打款失败:', err);
    error(getErrorMessage(err, '打款失败'));
  } finally {
    submitting.value = false;
  }
};

// 编辑打款
const handleEditPayment = (phone: SupplierPaymentPhone) => {
  if (!canEditPayment.value) {
    handleNoPermission('edit')
    return
  }

  editingPhone.value = phone;
  editPaymentForm.payment_method = phone.payment_method || 'bank_transfer';
  // 如果有打款时间则转换为正确格式，否则使用当前北京时间
  if (phone.payment_time) {
    const date = new Date(phone.payment_time);
    editPaymentForm.payment_time = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  } else {
    editPaymentForm.payment_time = getCurrentBeijingTime();
  }
  showEditPaymentDialog.value = true;
};

const handleEditPaymentSubmit = async () => {
  if (!canEditPayment.value) {
    handleNoPermission('edit')
    return
  }

  try {
    submitting.value = true;

    const response = await unifiedApi.put(`/supplier-payments/${editingPhone.value.id}`, editPaymentForm) as SupplierPaymentApiResponse<unknown>;

    if (response.success) {
      success('修改成功');
      showEditPaymentDialog.value = false;
      refreshData();
    }
  } catch (err) {
    logger.error('修改失败:', err);
    error('修改失败');
  } finally {
    submitting.value = false;
  }
};

// 取消打款（恢复到未打款状态）
const handleCancelPayment = async (phone: SupplierPaymentPhone) => {
  if (!canDeletePayment.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要取消该手机的打款记录吗？\n\nIMEI: ${phone.imei}\n此操作将清除打款时间和打款方式，恢复到未打款状态。`,
      '取消打款确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    removingPayment.value = true;

    const response = await unifiedApi.put(`/supplier-payments/${phone.id}`, {
      payment_method: null,
      payment_time: null
    });

    if (response.success) {
      success('已取消打款');
      refreshData();
    }
  } catch (err: unknown) {
    if (err !== 'cancel') {
      logger.error('取消打款失败:', err);
      error('取消打款失败');
    }
  } finally {
    removingPayment.value = false;
  }
};

// 批量取消打款（批次详情中的批量操作）
const handleBatchCancelPayment = async () => {
  if (!canDeletePayment.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const phoneIds = paymentDetails.value.phones.map((phone) => phone.id);
    if (phoneIds.length === 0) {
      warning('没有可取消打款的手机');
      return;
    }

    await ElMessageBox.confirm(
      `确定要取消该批次所有手机的打款记录吗？\n\n共 ${phoneIds.length} 台手机\n此操作将清除所有手机的打款时间和打款方式，恢复到未打款状态。`,
      '批量取消打款确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    removingPayment.value = true;

    const response = await unifiedApi.post('/supplier-payments/batch-cancel', {
      phone_ids: phoneIds
    }) as SupplierPaymentApiResponse<{ success?: boolean; count?: number; data?: { count?: number } }>;

    if (response.success || response.data?.success) {
      const count = response.data?.data?.count || response.data?.count || 0;
      success(`已取消 ${count} 台手机的打款`);
      showPaymentDetailsDialog.value = false;
      refreshData();
    } else {
      error(response.message || '批量取消打款失败');
    }
  } catch (err: unknown) {
    if (err !== 'cancel') {
      logger.error('批量取消打款失败:', err);
      error(getErrorMessage(err, '批量取消打款失败'));
    }
  } finally {
    removingPayment.value = false;
  }
};

// 保存批次详情为图片
const savePaymentDetailsAsImage = async () => {
  try {
    savingImage.value = true;

    await nextTick();

    const element = paymentDetailsForCapture.value;
    if (!element) {
      error('无法找到要截图的内容');
      return;
    }

    const supplierName = paymentDetails.value.supplier_name || '未知供应商';
    const paymentTime = paymentDetails.value.payment_time
      ? TimeUtil.format(paymentDetails.value.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE);

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `打款明细_${supplierName}_${paymentTime}.png`);
    });

    success('图片已保存');
  } catch (err) {
    logger.error('保存图片失败:', err);
    error('保存图片失败');
  } finally {
    savingImage.value = false;
  }
};

// 保存批量打款明细为图片
const saveBatchPaymentAsImage = async () => {
  try {
    savingImage.value = true;

    await nextTick();

    const element = batchPaymentTableForCapture.value;
    if (!element) {
      error('无法找到要截图的内容');
      return;
    }

    const supplierName = selectedPhoneObjects.value[0]?.supplier_name || '未知供应商';
    const paymentTime = paymentForm.payment_time
      ? TimeUtil.format(paymentForm.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE);

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `批量打款明细_${supplierName}_${paymentTime}.png`);
    });

    success('图片已保存');
  } catch (err) {
    logger.error('保存图片失败:', err);
    error('保存图片失败');
  } finally {
    savingImage.value = false;
  }
};

// 保存单个打款明细为图片
const saveSinglePaymentAsImage = async () => {
  try {
    savingImage.value = true;

    await nextTick();

    const element = singlePaymentForCapture.value;
    if (!element) {
      error('无法找到要截图的内容');
      return;
    }

    const supplierName = currentPhone.value?.supplier_name || '未知供应商';
    const paymentTime = paymentForm.payment_time
      ? TimeUtil.format(paymentForm.payment_time, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE);

    await withCaptureLayout(element, async () => {
      await downloadCaptureImage(element, `单个打款明细_${supplierName}_${paymentTime}.png`);
    });

    success('图片已保存');
  } catch (err) {
    logger.error('保存图片失败:', err);
    error('保存图片失败');
  } finally {
    savingImage.value = false;
  }
};

const handleBatchPayment = async () => {
  if (!canCreatePayment.value) {
    handleNoPermission('create')
    return
  }

  if (selectedPhones.value.length === 0) {
    warning('请选择要打款的手机');
    return;
  }

  // 验证必填字段
  if (canViewPaymentField('payment_method') && !paymentForm.payment_method) {
    warning('请选择打款方式');
    return;
  }
  if (canViewPaymentField('payment_time') && !paymentForm.payment_time) {
    warning('请选择打款时间');
    return;
  }

  try {
    submitting.value = true;

    const response = await unifiedApi.post('/supplier-payments/batch-payment', {
      phone_ids: selectedPhones.value,
      ...paymentForm
    });

    if (response.success) {
      success(`成功打款 ${response.data.count} 台手机，共计 ¥${formatAmount(response.data.total_amount)}`);
      showBatchPaymentDialog.value = false;
      // 清空选择状态
      clearSelection();
      refreshData();
    }
  } catch (err) {
    logger.error('批量打款失败:', err);
    error('批量打款失败');
  } finally {
    submitting.value = false;
  }
};

const handleShowPaymentDetails = async (phone: SupplierPaymentPhone) => {
  try {
    // 直接传递原始的打款时间，不进行时区转换
    // 数据库中存储的是UTC时间，后端会使用YEAR/MONTH/DAY/HOUR/MINUTE函数提取时间部分
    const paymentTime = phone.payment_time;

    const response = await unifiedApi.get(`/supplier-payments/batch-details`, {
      params: {
        supplier_id: phone.supplier_id,
        payment_time: paymentTime
      }
    }) as SupplierPaymentApiResponse<SupplierPaymentPhone[]>;

    if (response.success) {
      const detailPhones = Array.isArray(response.data) ? response.data : [];

      const totalCost = detailPhones.reduce((sum: number, currentItem) => sum + toNumber(currentItem.purchase_cost), 0);
      const totalSale = detailPhones.reduce((sum: number, currentItem) => sum + toNumber(currentItem.sale_price), 0);
      const totalProfit = totalSale - totalCost;

      paymentDetails.value = {
        supplier_name: phone.supplier_name,
        payment_time: phone.payment_time,
        payment_method: phone.payment_method || '',
        payment_operator: phone.payment_operator_name || '',
        phones: detailPhones,
        total_cost: totalCost,
        total_sale: totalSale,
        total_profit: totalProfit
      };

      showPaymentDetailsDialog.value = true;
    } else {
      error(response.message || '获取打款详情失败');
    }
  } catch (err) {
    logger.error('获取打款详情失败:', err);
    error('获取打款详情失败');
  }
};

const handlePageChange = (page: number) => {
  pagination.page = page;
  loadPhones();
};

// 处理统一分页组件的变化（页码、每页数量）
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.page = page;
  pagination.limit = pageSize;
  // 不再重置选中状态，保持跨页选择
  selectAll.value = false;
  loadPhones();
};

const refreshData = () => {
  loadSummaryStatistics();
  loadStatistics();
  loadPhones();
};

// 重置筛选条件
const resetFilters = () => {
  filters.keyword = '';
  filters.supplier_id = '';
  filters.store_id = '';
  filters.sale_status = 'all';
  filters.payment_status = 'all';
  filters.start_date = '';
  filters.end_date = '';
  syncVisiblePaymentFilters();
  handleFilterChange();
};

const formatAmount = (amount: number | string) => {
  const num = parseFloat(String(amount));
  // 如果是整数，不显示小数
  if (Number.isInteger(num)) {
    return num.toLocaleString('zh-CN');
  }
  // 如果有小数，只显示必要的小数位（最多2位）
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 格式化为北京时间（将 UTC 时间转换为北京时间 UTC+8）
const formatDateTimeBeijing = (dateString: string | null) => {
  if (!dateString) return '-';

  const date = new Date(dateString);

  // 检查日期是否有效
  if (isNaN(date.getTime())) return '-';

  // 转换为北京时间（UTC+8）
  const utcTime = date.getTime();
  const beijingTime = new Date(utcTime + (8 * 60 * 60 * 1000));

  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  const hours = String(beijingTime.getHours()).padStart(2, '0');
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 获取支付方式标签
const getPaymentMethodLabel = (method: string) => {
  const methodMap: Record<string, string> = {
    'bank_transfer': '银行转账',
    'cash': '现金',
    'alipay': '支付宝',
    'wechat': '微信',
    'other': '其他'
  };
  return methodMap[method] || method || '-';
};

// 格式化为北京时间（将 UTC 时间转换为北京时间 UTC+8，只显示年月日）
const formatDateBeijing = (dateString: string | null) => {
  if (!dateString) return '-';

  const date = new Date(dateString);

  // 检查日期是否有效
  if (isNaN(date.getTime())) return '-';

  // 转换为北京时间（UTC+8）
  const utcTime = date.getTime();
  const beijingTime = new Date(utcTime + (8 * 60 * 60 * 1000));

  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// 获取手机状态文本
const getPhoneStatusText = (status: string | null) => {
  const statusMap: Record<string, string> = {
    'in_stock': '在库',
    'sold': '已售',
    'reserved': '预留',
    'pending': '待处理'
  };
  return statusMap[status || ''] || status || '-';
};

// 获取打款时间的内联样式（精确到分钟区分，小巧精致版）
const getPaymentTimeStyle = (phone: SupplierPaymentPhone): Record<string, string> => {
  if (phone.payment_status !== 'paid' || !phone.payment_time) {
    return {};
  }

  const colorIndex = getPaymentTimeColorIndex(phone.payment_time);
  const color = paymentTimeColors[colorIndex];

  return {
    'background': `linear-gradient(135deg, ${color.bg}, ${color.bg}dd)`,
    'color': color.text,
    'border': `1px solid ${color.text}`,
    'box-shadow': `0 1px 3px ${color.text}30`,
    'font-weight': '500',
    'transition': 'all 0.2s ease'
  };
};

onMounted(async () => {
  if (!canView.value) {
    return
  }

  await initFieldPermissions()
  syncVisiblePaymentFilters();
  loadStores();
  loadSummaryStatistics();
  loadStatistics();
  loadPhones();
});
</script>

<style lang="scss" scoped>
.supplier-phone-payments-view {
  padding: 20px;

  // 权限不足页面样式 - 统一风格
  .permission-denied {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
    padding: 40px 20px;

    .permission-denied-wrapper {
      width: 100%;
      max-width: 600px;
    }

    .permission-denied-card {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .permission-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;

      i {
        font-size: 48px;
        color: rgba(255, 255, 255, 0.95);
      }
    }

    .permission-content {
      padding: 32px;
      text-align: center;
    }

    h2 {
      font-size: 24px;
      color: #303133;
      margin: 0 0 12px 0;
      font-weight: 600;
    }

    .permission-message {
      font-size: 14px;
      color: #606266;
      margin: 0 0 20px 0;
      line-height: 1.6;
    }

    .permission-status {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 24px;
      padding: 16px;
      background: #f5f7fa;
      border-radius: 8px;

      .status-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;

        &.has-menu {
          color: #67c23a;

          i {
            font-size: 18px;
          }
        }

        &.missing-view {
          color: #f56c6c;

          i {
            font-size: 18px;
          }
        }
      }
    }

    .permission-info {
      background: #ecf5ff;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: left;
      border-left: 4px solid #409eff;

      .info-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        label {
          font-size: 13px;
          color: #606266;
          font-weight: 500;
          margin-right: 8px;
        }

        .permission-name {
          font-size: 13px;
          color: #303133;
          font-weight: 600;
        }

        .permission-code {
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          color: #409eff;
          background: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
        }
      }
    }

    .permission-suggestion {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #fff7e6;
      border-left: 4px solid #e6a23c;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;

      i {
        color: #e6a23c;
        font-size: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: #606266;
        line-height: 1.6;
      }
    }

    .permission-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s;

        &.btn-primary {
          background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
          color: white;
          border: none;
          box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
          }
        }

        &.btn-outline-primary {
          background: white;
          color: #409eff;
          border: 1px solid #409eff;

          &:hover {
            background: #409eff;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
          }
        }

        &.btn-outline-secondary {
          background: white;
          color: #606266;
          border: 1px solid #dcdfe6;

          &:hover {
            border-color: #409eff;
            color: #409eff;
          }
        }
      }
    }

    .permission-details {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #ebeef5;
      text-align: left;

      h4 {
        font-size: 14px;
        color: #303133;
        margin: 0 0 12px 0;
        font-weight: 600;
      }

      .permission-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .permission-tag {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-weight: 600;
          background: #f5f7fa;
          color: #606266;
          border: 1px solid #dcdfe6;

          &.current-module {
            background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
            color: #409eff;
            border-color: #b3d8ff;
          }
        }
      }
    }
  }

  // 统计卡片样式
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-bottom: 24px;

    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      border: 1px solid #e8ecef;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
      }

      .stat-icon-primary {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;

        &.unpaid-icon {
          background: linear-gradient(135deg, #dc3545, #fd7e14);
          color: white;
        }

        &.paid-icon {
          background: linear-gradient(135deg, #28a745, #20c997);
          color: white;
        }

        &.total-icon {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        &.supplier-icon {
          background: linear-gradient(135deg, #0ea5e9, #14b8a6);
          color: white;
        }
      }

      .stat-content {
        flex: 1;

        .stat-main-line {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        .stat-value-primary {
          font-size: 24px;
          font-weight: 700;
          color: #2c3e50;
          line-height: 1.1;
          margin-bottom: 0;
          white-space: nowrap;
        }

        .stat-label {
          font-size: 14px;
          color: #7f8c8d;
          margin-bottom: 0;
          font-weight: 500;
          white-space: nowrap;
        }

        .stat-sub {
          font-size: 13px;
          color: #909399;
          font-weight: 700;
        }
      }
    }
  }

  @media (max-width: 768px) {
    .stats-cards {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 12px !important;
      margin-bottom: 16px !important;

      .stat-card {
        display: flex !important;
        flex: 0 0 calc((100% - 12px) / 2) !important;
        width: calc((100% - 12px) / 2) !important;
        min-width: calc((100% - 12px) / 2) !important;
        max-width: calc((100% - 12px) / 2) !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        padding: 14px !important;
        position: relative !important;
        overflow: hidden !important;
      }

      .stat-card:hover {
        transform: none !important;
      }

      .stat-card .stat-icon-primary {
        position: absolute !important;
        top: 10px !important;
        right: 10px !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 8px !important;
        font-size: 11px !important;
        opacity: 0.18 !important;
      }

      .stat-card .stat-content {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        width: 100% !important;
        padding-right: 16px !important;
      }

      .stat-card .stat-content .stat-main-line {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: 4px !important;
        margin-bottom: 4px !important;
      }

      .stat-card .stat-content .stat-label {
        font-size: 11px !important;
        line-height: 1.25 !important;
        white-space: nowrap !important;
      }

      .stat-card .stat-content .stat-value-primary {
        font-size: 18px !important;
        line-height: 1.1 !important;
        white-space: nowrap !important;
      }

      .stat-card .stat-content .stat-sub {
        display: block !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
      }
    }
  }

  @media (max-width: 480px) {
    .stats-cards {
      gap: 10px !important;
      margin-bottom: 12px !important;

      .stat-card {
        flex: 0 0 calc((100% - 10px) / 2) !important;
        width: calc((100% - 10px) / 2) !important;
        min-width: calc((100% - 10px) / 2) !important;
        max-width: calc((100% - 10px) / 2) !important;
        gap: 4px !important;
        padding: 12px !important;
      }

      .stat-card .stat-icon-primary {
        top: 8px !important;
        right: 8px !important;
        width: 22px !important;
        height: 22px !important;
        border-radius: 7px !important;
        font-size: 10px !important;
      }

      .stat-card .stat-content {
        padding-right: 14px !important;
      }

      .stat-card .stat-content .stat-main-line {
        gap: 2px !important;
      }

      .stat-card .stat-content .stat-label {
        font-size: 10px !important;
      }

      .stat-card .stat-content .stat-value-primary {
        font-size: 16px !important;
      }

      .stat-card .stat-content .stat-sub {
        font-size: 9px !important;
      }
    }
  }

  // 统一的表格区域样式
  .table-section {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: #409eff;
      }
    }

    .search-form {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: flex-end;

      .form-group {
        flex: 1;
        min-width: 200px;

        .form-label {
          display: block;
          font-size: 14px;
          color: #606266;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .input-group {
          position: relative;

          .input-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #909399;
            font-size: 14px;
          }

          .form-control {
            width: 100%;
            padding: 8px 12px 8px 36px;
            border: 1px solid #dcdfe6;
            border-radius: 4px;
            font-size: 14px;
            color: #606266;
            background: #fff;
            transition: all 0.3s;

            &:focus {
              outline: none;
              border-color: #409eff;
              box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
            }

            &::placeholder {
              color: #c0c4cc;
            }
          }
        }
      }

      .form-actions {
        display: flex;
        gap: 8px;
      }
    }
  }

  // 统一的表格区域样式
  .table-section {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      i {
        color: #409eff;
        margin-right: 8px;
      }

      .record-count {
        font-size: 14px;
        color: #909399;
        font-weight: normal;
      }
    }

    .title-main {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      .title-text {
        white-space: nowrap;
      }
    }

    .selected-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #fffaf2 0%, #fff 45%, #f8fbff 100%);
      border: 1px solid #edf2f7;
      border-radius: 16px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);

      .selected-summary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 7px 10px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(64, 158, 255, 0.12);
        border-radius: 999px;
      }

      .selected-count {
        font-size: 14px;
        color: #374151;
        font-weight: 700;
      }

      .selected-amount {
        font-size: 14px;
        font-weight: 700;
        color: #e6a23c;
        font-family: 'Monaco', 'Consolas', monospace;
      }

      .selected-action-btn {
        flex-shrink: 0;
        min-width: 92px;
        height: 36px;
        padding: 0 14px;
        white-space: nowrap;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;

        :deep(span) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        i {
          font-size: 12px;
        }
      }

      .selected-action-btn-danger {
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
        border-color: #fecdd3;
        color: #e11d48;
        box-shadow: none;

        &:hover,
        &:focus {
          background: linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%);
          border-color: #fda4af;
          color: #be123c;
        }
      }

      .selected-action-btn-primary {
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-color: #bfdbfe;
        color: #2563eb;
        box-shadow: none;

        &:hover,
        &:focus {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-color: #93c5fd;
          color: #1d4ed8;
        }
      }
    }
  }

  // 统一的表格样式
  .table-responsive {
    overflow-x: auto;

    .table {
      width: 100%;
      border-collapse: collapse;

      thead {
        tr {
          background: #fafafa;

          th {
            padding: 12px 16px;
            text-align: left;
            font-size: 14px;
            font-weight: 600;
            color: #606266;
            border-bottom: 2px solid #ebeef5;
            white-space: nowrap;
          }
        }
      }

      tbody {
        tr {
          transition: all 0.3s;

          &:hover {
            background: #f5f7fa;
          }

          td {
            padding: 12px 16px;
            font-size: 14px;
            color: #606266;
            border-bottom: 1px solid #ebeef5;

            &.amount {
              font-weight: 600;
              color: #303133;

              &.profit-positive {
                color: #67c23a;
              }

              &.profit-negative {
                color: #f56c6c;
              }
            }
          }

          &.loading-row,
          &.empty-row {
            background: #fff;

            td {
              text-align: center;
              padding: 40px 16px;
            }
          }
        }
      }
    }
  }

  // 状态徽章样式
  .status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;

    &.status-unpaid {
      background: #fef0f0;
      color: #f56c6c;
    }

    &.status-paid {
      background: #f0f9ff;
      color: #67c23a;
    }

    &.status-in_stock {
      background: #e1f3ff;
      color: #1a73e8;
      border: 1px solid #1a73e8;
    }

    &.status-sold {
      background: #f3e5f5;
      color: #9c27b0;
      border: 1px solid #9c27b0;
    }
  }

  // 时间徽章样式 - 小巧精致版
  .time-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease;
    border: 1px solid transparent;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    white-space: nowrap;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.4s ease;
    }

    i {
      font-size: 10px;
    }

    &.payment-time-badge {
      animation: fadeIn 0.2s ease;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &::before {
        left: 100%;
      }
    }
  }

  // 操作按钮组 - 统一使用 el-button 组件
  .action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  // 文本辅助类
  .text-muted {
    color: #909399;
  }

  .text-center {
    text-align: center;
  }

  // 按钮样式
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
    cursor: pointer;
    border: 1px solid transparent;

    &.btn-primary {
      background: #409eff;
      color: #fff;

      &:hover {
        background: #66b1ff;
      }
    }

    &.btn-outline-primary {
      background: transparent;
      border-color: #409eff;
      color: #409eff;

      &:hover {
        background: #409eff;
        color: #fff;
      }
    }

    &.btn-outline-secondary {
      background: transparent;
      border-color: #dcdfe6;
      color: #606266;

      &:hover {
        border-color: #409eff;
        color: #409eff;
      }
    }

    &.btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  // 分页样式
  .pagination-wrapper {
    padding: 16px;
    background: #fff;
    border-radius: 8px;
    margin-top: 16px;
  }

  // 批次详情对话框样式
  .payment-details {
    .details-info {
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid #e4e7ed;

      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px 24px;

      .info-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        border: 1px solid #ebeef5;
        transition: all 0.3s ease;

        &:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        label {
          font-size: 13px;
          color: #909399;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        span {
          font-size: 18px;
          color: #303133;
          font-weight: 600;

          &.amount {
            color: #e6a23c;
            font-family: 'Monaco', 'Consolas', monospace;

            &.profit-positive {
              color: #67c23a;
            }

            &.profit-negative {
              color: #f56c6c;
            }
          }

          &.highlight {
            color: #409eff;
            font-size: 20px;
          }

          &.profit-value {
            font-size: 20px;
            font-weight: 700;

            &.profit-positive {
              color: #67c23a;
            }

            &.profit-negative {
              color: #f56c6c;
            }
          }
        }

        // 表单控件样式
        :deep(.el-select),
        :deep(.el-date-picker),
        :deep(.el-input) {
          width: 100%;
        }

        :deep(.el-input__wrapper) {
          background: #f8f9fa;
          border: 1px solid #e4e7ed;
        }
      }
    }

    // 手机明细表格 - 使用全局样式
    .batch-details-table {
      .table-responsive {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #dee2e6;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
      }

      .data-table {
        width: 100%;
        min-width: 1200px;
        border-collapse: separate;
        border-spacing: 0;
        margin: 0;
        background: white;
      }
    }
  }
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

// ==================== 编辑打款对话框样式 ====================
.edit-payment-dialog {
  // IMEI 号码特殊样式
  .imei-number {
    font-family: 'Monaco', 'Consolas', monospace;
    color: #409eff;
    letter-spacing: 0.6px;
    font-size: 18px;
    line-height: 1.3;
    word-break: break-all;
  }

  // 表单优化
  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #606266;
  }

  :deep(.el-select),
  :deep(.el-date-picker) {
    width: 100%;
  }

  .details-info.payment-summary-cards-edit {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
    padding: 14px;
    border-radius: 14px;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
    border: 1px solid #e4e7ed;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

    .info-row {
      min-width: 0;
      min-height: 86px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 6px;
      border-radius: 12px;
      border: 1px solid #e7edf5;
      background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        border-radius: 12px 12px 0 0;
      }

      label {
        margin: 0;
        font-size: 11px;
        color: #8a94a6;
        font-weight: 600;
        letter-spacing: 0;
        text-transform: none;
      }

      span {
        display: block;
        min-width: 0;
        font-size: 15px;
        line-height: 1.3;
        color: #25324a;
        font-weight: 700;
        word-break: break-word;
      }

      .amount {
        color: #d97706;
        font-size: 20px;
        font-weight: 800;
        white-space: nowrap;
      }
    }

    .summary-item-imei {
      &::before {
        background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
      }
    }

    .summary-item-model {
      &::before {
        background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
      }
    }

    .summary-item-cost {
      &::before {
        background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
      }
    }
  }
}

@media (max-width: 768px) {
  .edit-payment-dialog {
    .details-info.payment-summary-cards-edit {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 12px;
      margin-bottom: 16px;

      .info-row {
        min-height: 82px;
        padding: 12px;
        gap: 6px;

        label {
          font-size: 11px;
        }

        span {
          font-size: 15px;
        }

        .amount {
          font-size: 18px;
        }
      }

      .summary-item-imei {
        grid-column: 1 / -1;
      }

      .imei-number {
        font-size: 16px;
      }
    }
  }
}

@media (max-width: 480px) {
  .edit-payment-dialog {
    .details-info.payment-summary-cards-edit {
      grid-template-columns: 1fr;

      .info-row {
        min-height: 76px;
        border-radius: 12px;
      }

      .summary-item-imei {
        grid-column: auto;
      }

      .imei-number {
        font-size: 15px;
        letter-spacing: 0.3px;
      }
    }
  }
}

/* ==================== Element Plus 组件统一样式 ==================== */

/* 输入框样式 - 完全无边框简洁设计 */
.el-input-form-control {
  width: 100%;
}

.el-input-form-control :deep(.el-input__wrapper) {
  width: 100%;
  padding: 10px 12px;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: all 0.3s ease;
  border-radius: 0;
}

.el-input-form-control :deep(.el-input__wrapper:hover),
.el-input-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
}

.el-input-form-control :deep(.el-input__inner) {
  font-size: 14px;
  color: #495057;
  height: auto;
  border: none !important;
  box-shadow: none !important;
}

/* Readonly 输入框样式 - 确保与其他输入框高度一致 */
.el-input-form-control :deep(.el-input.is-disabled .el-input__wrapper),
.el-input-form-control :deep(.el-input__wrapper.isreadonly),
.el-input-form-control :deep(.el-input__wrapper[readonly]) {
  background: transparent !important;
  cursor: not-allowed;
  padding: 10px 12px;
  min-height: 40px;
  box-shadow: none !important;
  border: none !important;
}

.el-input-form-control :deep(.el-input.is-disabled .el-input__inner),
.el-input-form-control :deep(.el-input__inner[readonly]) {
  color: #495057;
  font-weight: 500;
  border: none !important;
  box-shadow: none !important;
}

.el-input-form-control :deep(.el-input__wrapper:hover) {
  background: rgba(59, 130, 246, 0.02) !important;
  box-shadow: none !important;
}

.el-input-form-control :deep(.el-input__wrapper.is-focus) {
  background: rgba(59, 130, 246, 0.05) !important;
  box-shadow: none !important;
}

/* 选择器样式 - 完全无边框简洁设计 */
.el-select-form-control {
  width: 100%;
}

.el-select-form-control :deep(.el-input__wrapper) {
  width: 100%;
  padding: 10px 12px;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: all 0.3s ease;
  border-radius: 0;
}

.el-select-form-control :deep(.el-input__wrapper:hover),
.el-select-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
}

.el-select-form-control :deep(.el-input__inner) {
  font-size: 14px;
  color: #495057;
  height: auto;
  border: none !important;
  box-shadow: none !important;
}

.el-select-form-control :deep(.el-input__wrapper:hover) {
  background: rgba(59, 130, 246, 0.02) !important;
  box-shadow: none !important;
}

.el-select-form-control :deep(.el-input__wrapper.is-focus) {
  background: rgba(59, 130, 246, 0.05) !important;
  box-shadow: none !important;
}

/* 日期选择器样式 - 完全无边框简洁设计 */
.el-date-form-control {
  width: 100%;
}

.el-date-form-control :deep(.el-input__wrapper) {
  width: 100%;
  padding: 10px 12px;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  transition: all 0.3s ease;
  border-radius: 0;
}

.el-date-form-control :deep(.el-input__wrapper:hover),
.el-date-form-control :deep(.el-input__wrapper.is-focus) {
  box-shadow: none !important;
}

.el-date-form-control :deep(.el-input__inner) {
  font-size: 14px;
  color: #495057;
  height: auto;
  border: none !important;
  box-shadow: none !important;
}

.el-date-form-control :deep(.el-input__wrapper:hover) {
  background: rgba(59, 130, 246, 0.02) !important;
  box-shadow: none !important;
}

.el-date-form-control :deep(.el-input__wrapper.is-focus) {
  background: rgba(59, 130, 246, 0.05) !important;
  box-shadow: none !important;
}

/* ==================== 全局数据表格样式 ==================== */
/* 表格响应式容器 */
.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* 强制水平滚动 */
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

/* 数据表格基础样式 */
.data-table {
  width: 100%;
  min-width: 1200px; /* 确保表格有最小宽度，触发横向滚动 */
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

/* 表头样式 */
.data-table th {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  border-right: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  position: relative;
  white-space: nowrap;
}

.data-table th:last-child {
  border-right: none;
}

.data-table th::after {
  display: none;
}

/* 表格单元格样式 */
.data-table td {
  padding: 6px 6px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
  text-align: center;
  position: relative;
}

.data-table td:last-child {
  border-right: none;
}

/* 表格行样式 */
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

/* 已选中行的样式 */
.data-table tbody tr.row-selected {
  background: #fff9c4 !important;
  border-left: 3px solid #ffc107;
}

.data-table tbody tr.row-selected:hover {
  background: #fff59d !important;
}

.data-table tbody tr.row-selected td {
  font-weight: 500;
}

.data-table tbody tr.mobile-action-expanded {
  border-bottom-color: transparent;
}

/* IMEI 单元格样式 - 两种类名都支持 */
.data-table .imei,
.data-table .imei-cell {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.5px;
}

/* 批发数据的 IMEI 特殊颜色标识 */
.data-table .imei.imei-wholesale {
  color: #409eff;
  font-weight: 700;
  background: linear-gradient(135deg, #e6f4ff 0%, #d4e8ff 100%);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  box-shadow: 0 1px 3px rgba(64, 158, 255, 0.2);
}

.data-table td.imei-cell {
  padding: 10px 8px;
}

/* 序列号样式 */
.data-table .serial-number {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.5px;
}

/* 序号徽章 */
.data-table .index-badge {
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

/* 金额单元格 */
.data-table .price {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 600;
  color: #e6a23c;
  font-size: 13px;
}

/* 时间单元格 */
.data-table .time-cell {
  font-size: 12px;
  color: #2c3e50;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  text-align: center;
  font-weight: 500;
}

/* 打款时间徽章 */
.data-table .payment-time-badge {
  display: inline-block;
  padding: 4px 10px;
  background: linear-gradient(135deg, #f56c6c 0%, #e74c3c 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(245, 108, 108, 0.3);
}

/* 金额单元格 - 确保居中 */
.data-table .price {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 600;
  color: #e6a23c;
  font-size: 13px;
  text-align: center;
}

/* 利润单元格 - 确保居中 */
.data-table .price-cell {
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

/* 操作列 - 统一使用 el-button 组件，遵循 Element Plus 颜色系统 */
.data-table .actions-col {
  min-width: 100px;
  text-align: center;
}

.data-table .action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.data-table .mobile-action-row td {
  padding: 10px 12px;
  background: #f8fbff;
  border-top: none;
}

.data-table .mobile-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
}

.data-table .mobile-action-btn {
  min-width: 92px;
}

.data-table .col-supplier,
.data-table .col-model {
  min-width: 120px;
}

.data-table .col-color,
.data-table .col-memory {
  min-width: 82px;
}

.data-table .col-serial {
  min-width: 148px;
}

.data-table .col-status {
  min-width: 96px;
}

.data-table .col-actions {
  min-width: 110px;
}

/* 复选框样式 */
.data-table input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #409eff;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .supplier-phone-payments-view {
    .table-section {
      .section-title {
        justify-content: space-between;
        align-items: center;
        gap: 10px;

        .record-count {
          margin-left: 0;
        }
      }

      .selected-info {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 10px;
        gap: 8px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .selected-summary {
          padding: 6px 9px;
        }

        .selected-count,
        .selected-amount {
          font-size: 12px;
        }

        .selected-action-btn {
          min-width: 54px;
          width: auto;
          height: 28px !important;
          min-height: 28px !important;
          max-height: 28px;
          padding: 0 6px;
          font-size: 10px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          border-radius: 8px;
          box-sizing: border-box;
        }

        .selected-action-btn i,
        .selected-action-btn :deep(span) {
          font-size: 10px;
          line-height: 1;
        }
      }
    }
  }

  @media (min-width: 481px) and (max-width: 768px) {
    .supplier-phone-payments-view {
      .table-section {
        .selected-info {
          .selected-action-btn {
            min-width: 60px;
            width: auto;
            height: 30px !important;
            min-height: 30px !important;
            max-height: 30px;
            padding: 0 7px;
            font-size: 11px;
            line-height: 1;
            border-radius: 8px;
            box-sizing: border-box;
          }

          .selected-action-btn i,
          .selected-action-btn :deep(span) {
            font-size: 11px;
            line-height: 1;
          }
        }
      }
    }
  }

  .payment-details {
    .batch-payment-summary {
      display: none;
    }

    .details-info {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      padding: 12px !important;
      margin-bottom: 16px;
      border-radius: 14px;

      .info-row {
        min-height: 82px;
        padding: 12px;
        gap: 4px;
        justify-content: center;
        border-radius: 12px;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);

        label {
          font-size: 11px;
          letter-spacing: 0.2px;
          margin-bottom: 2px;
        }

        span {
          font-size: 16px;
          line-height: 1.25;
          word-break: break-word;
        }

        .highlight,
        .profit-value {
          font-size: 17px;
        }

        .amount {
          font-size: 16px;
        }
      }
    }

    .details-info.payment-summary-cards {
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border: 1px solid #e4e7ed;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

      .info-row {
        min-height: 88px;
        background: #ffffff;
        border: 1px solid #ebeef5;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }

      .info-row:first-child {
        grid-column: 1 / -1;
        min-height: 76px;
      }
    }

    .details-info.payment-summary-cards-four {
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: stretch;
      gap: 6px !important;
      padding: 14px !important;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border: 1px solid #e4e7ed;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

      .info-row {
        flex: 1 1 0;
        width: calc((100% - 18px) / 4);
        min-height: 72px;
        min-width: 0;
        padding: 8px 6px;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        border: 1px solid #e7edf5;
        border-radius: 12px;
        box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 12px 12px 0 0;
          background: linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%);
        }

        label {
          font-size: 10px;
          margin-bottom: 0;
          letter-spacing: 0;
          color: #8a94a6;
          font-weight: 600;
          flex-shrink: 0;
          white-space: nowrap;
        }

        span {
          font-size: 13px;
          line-height: 1.2;
          word-break: break-word;
          color: #25324a;
          font-weight: 700;
          text-align: left;
        }

        .highlight,
        .profit-value,
        .amount {
          font-size: 13px;
          font-weight: 800;
        }
      }

      .info-row:first-child {
        flex: 1 1 0;
        width: calc((100% - 18px) / 4);
        min-height: 72px;
      }

      .info-row:nth-child(1) {
        background: linear-gradient(180deg, #fffaf2 0%, #ffffff 100%);
        border-color: #f8dfb3;

        &::before {
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
        }
      }

      .info-row:nth-child(2) {
        background: linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%);
        border-color: #d8e7ff;

        &::before {
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
        }
      }

      .info-row:nth-child(3) {
        background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
        border-color: #fed7aa;

        &::before {
          background: linear-gradient(90deg, #f97316 0%, #fb923c 100%);
        }
      }

      .info-row:nth-child(4) {
        background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
        border-color: #bbf7d0;

        &::before {
          background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
        }
      }
    }

    .details-info.payment-form-cards {
      display: flex !important;
      flex-direction: column;
      gap: 10px !important;
      overflow: hidden;
      padding: 12px !important;
      border-radius: 16px;
      background: linear-gradient(180deg, #f8fbff 0%, #eef4fa 100%);
      border: 1px solid #e2eaf2;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);

      .info-row {
        min-width: 0;
        min-height: auto;
        padding: 2px 0;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        background: transparent;
        border: none;
        border-radius: 0;
        box-shadow: none;
        position: relative;
        gap: 10px;

        label {
          font-size: 13px;
          margin-bottom: 0;
          letter-spacing: 0;
          color: #516178;
          font-weight: 700;
          text-transform: none;
          white-space: nowrap;
          padding-left: 2px;
          flex: 0 0 68px;
        }

        span {
          font-size: 14px;
          line-height: 1.35;
          color: #24324a;
          font-weight: 700;
          flex: 1 1 auto;
          width: auto;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
        }

        :deep(.el-select),
        :deep(.el-date-picker),
        :deep(.el-input) {
          width: 100% !important;
          max-width: 100%;
          flex: 1 1 auto;
        }

        :deep(.el-input__wrapper) {
          min-height: 42px;
          padding: 0 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.96) !important;
          box-shadow: inset 0 0 0 1px #d7e1ec !important;
        }

        :deep(.el-date-editor.el-input),
        :deep(.el-date-editor.el-input__wrapper),
        :deep(.el-select .el-select__wrapper) {
          width: 100% !important;
          max-width: 100%;
        }

        :deep(.el-date-editor .el-input__prefix) {
          display: inline-flex;
          align-items: center;
          margin-right: 8px;
          padding-right: 8px;
          border-right: 1px solid #d7e1ec;
        }

        :deep(.el-date-editor .el-input__prefix-inner) {
          display: inline-flex;
          align-items: center;
        }

        :deep(.el-input__inner),
        :deep(.el-select__selected-item),
        :deep(.el-date-editor .el-range-input),
        :deep(.el-date-editor .el-input__inner) {
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .info-row + .info-row::before {
        display: none;
      }
    }
  }

  .table-responsive {
    overflow-x: scroll;
    -webkit-overflow-scrolling: touch;
  }

  .data-table {
    min-width: 760px;
  }

  .data-table th,
  .data-table td {
    padding: 8px 6px;
    font-size: 13px;
    white-space: nowrap;
  }

  .data-table .col-supplier,
  .data-table .col-model {
    min-width: 110px;
  }

  .data-table .col-color,
  .data-table .col-memory {
    min-width: 74px;
  }

  .data-table .col-serial {
    min-width: 136px;
  }

  .data-table .col-status {
    min-width: 88px;
  }

  .data-table .col-actions {
    min-width: 96px;
  }

  .data-table .serial-number,
  .data-table .imei,
  .data-table .imei-cell {
    font-size: 10px;
    letter-spacing: 0.3px;
  }

  .data-table .action-buttons {
    gap: 6px;
  }

  .data-table .mobile-action-row td {
    padding: 10px 8px;
  }

  .data-table .mobile-row-actions {
    gap: 6px;
  }

  .data-table .mobile-action-btn {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
  }
}
</style>

<!-- 修复 Element Plus 下拉菜单颜色问题 -->
<style lang="scss">
.el-select-dropdown {
  background-color: #ffffff !important;
  border: 1px solid #e4e7ed !important;

  .el-select-dropdown__item {
    color: #606266 !important;
    background-color: #ffffff !important;

    &:hover {
      background-color: #f5f7fa !important;
      color: #409eff !important;
    }

    &.is-selected {
      color: #409eff !important;
      font-weight: 700 !important;
    }

    &.is-disabled {
      color: #c0c4cc !important;
      cursor: not-allowed !important;
    }
  }

  .el-select-dropdown__empty {
    color: #909399 !important;
  }

  .el-select-dropdown__wrap {
    background-color: #ffffff !important;
  }

  .el-select-dropdown__list {
    background-color: #ffffff !important;
  }
}

.supplier-phone-payments-dialog {
  .el-dialog__header,
  &.mobile-dialog-sheet-panel .mobile-dialog-sheet-header {
    position: relative;
    background: var(--dialog-header-bg);
    overflow: hidden;
  }

  .el-dialog__header {
    margin-right: 0;
    padding: 18px 56px 18px 22px;
    border-bottom: 0;
    border-radius: 0;
  }

  .el-dialog__title,
  .mobile-dialog-sheet-title {
    color: #ffffff;
    font-weight: 700;
    letter-spacing: 0.2px;
  }

  .el-dialog__headerbtn,
  .mobile-dialog-sheet-close {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.16);
    color: #ffffff;
    transition: all 0.2s ease;
  }

  .el-dialog__headerbtn:hover,
  .mobile-dialog-sheet-close:hover {
    background: rgba(255, 255, 255, 0.24);
    transform: translateY(-1px);
  }

  .el-dialog__body {
    padding: 22px 22px 18px;
  }

  .el-dialog__footer,
  .mobile-dialog-sheet-footer {
    padding: 14px 22px 20px;
    border-top: 1px solid #edf2f7;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  }
}

.payment-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;

  .el-button {
    min-width: 104px;
    min-height: 40px;
    padding: 0 18px;
    border-radius: 12px;
    font-weight: 600;
    box-shadow: none;
    margin-left: 0 !important;
  }

  .el-button span {
    display: inline-flex;
    align-items: center;
  }

  .el-button i {
    margin-right: 6px;
  }
}

@media (max-width: 768px) {
  .supplier-phone-payments-dialog {
    .el-dialog__header,
    &.mobile-dialog-sheet-panel .mobile-dialog-sheet-header {
      padding-left: 16px;
      padding-right: 52px;
    }

    .el-dialog__body {
      padding: 16px 14px 12px;
    }

    .el-dialog__footer,
    .mobile-dialog-sheet-footer {
      padding: 12px 14px 16px;
    }
  }

  .payment-dialog-footer {
    gap: 8px;

    .el-button {
      flex: 1 1 calc(50% - 4px);
      min-width: 0;
      min-height: 40px;
      padding: 0 12px;
    }
  }
}

@media (max-width: 480px) {
  .supplier-phone-payments-dialog {
    .el-dialog__title,
    .mobile-dialog-sheet-title {
      font-size: 15px;
    }
  }

  .payment-dialog-footer {
    .el-button {
      width: 100%;
      flex-basis: 100%;
    }
  }
}
</style>
